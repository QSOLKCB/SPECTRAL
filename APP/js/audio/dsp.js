(function defineDsp(S) {
  "use strict";

  const UINT32_RANGE = 4294967296n;
  const FRAME_CHUNK = 16384;

  function abortIfRequested(signal) {
    if (signal && signal.aborted) {
      const error = new Error("Render cancelled");
      error.name = "AbortError";
      throw error;
    }
  }

  function yieldTask() {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  function clamp16(value) {
    if (value > 32767) return 32767;
    if (value < -32768) return -32768;
    return value < 0 ? Math.ceil(value) : Math.floor(value);
  }

  function phaseStep(freqMilliHz, sampleRate) {
    if (!Number.isSafeInteger(freqMilliHz) || freqMilliHz < 0) throw new TypeError("Frequency must be a non-negative integer in millihertz");
    return Number((BigInt(freqMilliHz) * UINT32_RANGE) / (BigInt(sampleRate) * 1000n)) >>> 0;
  }

  function triangle(phase) {
    const upper = phase >>> 16;
    const folded = (upper & 0x8000) ? 0xffff - upper : upper;
    return (folded << 1) - 32767;
  }

  function softSine(phase) {
    const x = triangle(phase);
    return Math.trunc((x * (65536 - Math.abs(x))) / 32768);
  }

  function oscillator(kind, phase, prng) {
    switch (kind) {
      case "square": return (phase & 0x80000000) ? -32768 : 32767;
      case "saw": return (phase >>> 16) - 32768;
      case "triangle": return triangle(phase);
      case "pulse": return (phase >>> 0) < 0x30000000 ? 32767 : -32768;
      case "noise": return prng.nextSigned16();
      case "sine":
      default: return softSine(phase);
    }
  }

  function compileStrictTone(tone, sampleRate, identityHash, index) {
    const sequence = (tone.sequence_millihz || [tone.freq_millihz]).map(value => phaseStep(value, sampleRate));
    const identityBytes = S.Core.fromHex(identityHash);
    const phaseSeed = new DataView(identityBytes.buffer, identityBytes.byteOffset, identityBytes.byteLength).getUint32((index % 8) * 4, false);
    return {
      kind: tone.kind || "sine",
      phase: ((tone.phase_u32 || 0) + phaseSeed) >>> 0,
      steps: sequence,
      sequencePeriod: Math.max(1, tone.sequence_period_samples || sampleRate),
      ampQ15: S.Core.clampInteger(tone.amp_q15, 0, 32767),
      panQ15: S.Core.clampInteger(tone.pan_q15 || 0, -32768, 32767),
      start: Math.max(0, tone.start_sample || 0),
      end: Math.max(0, tone.end_sample || 0x7fffffff),
      gatePeriod: Math.max(0, tone.gate_period_samples || 0),
      gateDutyQ15: S.Core.clampInteger(tone.gate_duty_q15 == null ? 32767 : tone.gate_duty_q15, 0, 32767),
      lfoPhase: (tone.lfo_phase_u32 || 0) >>> 0,
      lfoStep: phaseStep(tone.lfo_rate_millihz || 0, sampleRate),
      lfoDepthQ15: S.Core.clampInteger(tone.lfo_depth_q15 || 0, 0, 32767),
      prng: S.Core.createPrng(identityHash, "tone-" + index)
    };
  }

  async function finalizeStrict(mix, frameCount, profile, signal) {
    const channels = 2;
    if (profile.removeDc && frameCount > 0) {
      let sumL = 0;
      let sumR = 0;
      for (let frame = 0; frame < frameCount; frame += 1) {
        sumL += mix[frame * 2];
        sumR += mix[frame * 2 + 1];
        if ((frame + 1) % FRAME_CHUNK === 0) { abortIfRequested(signal); await yieldTask(); }
      }
      const meanL = Math.trunc(sumL / frameCount);
      const meanR = Math.trunc(sumR / frameCount);
      for (let frame = 0; frame < frameCount; frame += 1) {
        mix[frame * 2] -= meanL;
        mix[frame * 2 + 1] -= meanR;
        if ((frame + 1) % FRAME_CHUNK === 0) { abortIfRequested(signal); await yieldTask(); }
      }
    }

    let peak = 1;
    for (let i = 0; i < mix.length; i += 1) {
      peak = Math.max(peak, Math.abs(mix[i]));
      if ((i + 1) % (FRAME_CHUNK * 2) === 0) { abortIfRequested(signal); await yieldTask(); }
    }
    let numerator = 32767;
    let denominator = 32767;
    if (profile.normalize) {
      numerator = profile.ceilingQ15;
      denominator = peak;
    }
    const fadeIn = Math.min(frameCount, Math.trunc(profile.sampleRate * profile.fadeInMs / 1000));
    const fadeOut = Math.min(frameCount, Math.trunc(profile.sampleRate * profile.fadeOutMs / 1000));
    const pcm = new Int16Array(frameCount * channels);
    for (let frame = 0; frame < frameCount; frame += 1) {
      let fadeQ15 = 32767;
      if (fadeIn > 0 && frame < fadeIn) fadeQ15 = Math.trunc(frame * 32767 / fadeIn);
      const remaining = frameCount - 1 - frame;
      if (fadeOut > 0 && remaining < fadeOut) fadeQ15 = Math.min(fadeQ15, Math.trunc(remaining * 32767 / fadeOut));
      for (let channel = 0; channel < channels; channel += 1) {
        const index = frame * 2 + channel;
        let value = Math.trunc(mix[index] * numerator / denominator);
        value = Math.trunc(value * fadeQ15 / 32767);
        pcm[index] = clamp16(value);
      }
      if ((frame + 1) % FRAME_CHUNK === 0) { abortIfRequested(signal); await yieldTask(); }
    }
    abortIfRequested(signal);
    return pcm;
  }

  async function renderStrict(plan, context) {
    const sampleRate = context.profile.sampleRate;
    const frameCount = context.frameCount;
    const tones = plan.tones.map((tone, index) => compileStrictTone(tone, sampleRate, context.recipeHash, index));
    const mix = new Int32Array(frameCount * 2);
    const masterQ15 = S.Core.clampInteger(plan.master_q15 || 26000, 1, 32767);
    const feedbackQ15 = S.Core.clampInteger(plan.feedback_q15 || 0, 0, 30000);
    let previousL = 0;
    let previousR = 0;

    for (let frame = 0; frame < frameCount; frame += 1) {
      let left = 0;
      let right = 0;
      for (let index = 0; index < tones.length; index += 1) {
        const tone = tones[index];
        if (frame < tone.start || frame >= tone.end) continue;
        if (tone.gatePeriod > 0) {
          const gatePosition = (frame - tone.start) % tone.gatePeriod;
          const gateLimit = Math.trunc(tone.gatePeriod * tone.gateDutyQ15 / 32767);
          if (gatePosition >= gateLimit) continue;
        }
        const sequenceIndex = Math.floor((frame - tone.start) / tone.sequencePeriod) % tone.steps.length;
        tone.phase = (tone.phase + tone.steps[sequenceIndex]) >>> 0;
        tone.lfoPhase = (tone.lfoPhase + tone.lfoStep) >>> 0;
        const wave = oscillator(tone.kind, tone.phase, tone.prng);
        const lfo = triangle(tone.lfoPhase);
        const lfoGain = 32767 - tone.lfoDepthQ15 + Math.trunc((lfo + 32768) * tone.lfoDepthQ15 / 65535);
        const amplitude = Math.trunc(tone.ampQ15 * lfoGain / 32767);
        const sample = Math.trunc(wave * amplitude / 32767);
        const leftGain = Math.trunc((32767 - tone.panQ15) / 2);
        const rightGain = Math.trunc((32767 + tone.panQ15) / 2);
        left += Math.trunc(sample * leftGain / 32767);
        right += Math.trunc(sample * rightGain / 32767);
      }
      if (feedbackQ15) {
        left += Math.trunc(previousR * feedbackQ15 / 32767);
        right += Math.trunc(previousL * feedbackQ15 / 32767);
      }
      left = Math.trunc(left * masterQ15 / 32767);
      right = Math.trunc(right * masterQ15 / 32767);
      previousL = clamp16(left);
      previousR = clamp16(right);
      mix[frame * 2] = left;
      mix[frame * 2 + 1] = right;
      if ((frame + 1) % FRAME_CHUNK === 0) { abortIfRequested(context.signal); await yieldTask(); }
    }
    return finalizeStrict(mix, frameCount, context.profile, context.signal);
  }

  function floatWave(kind, phase, prng) {
    const cycle = phase - Math.floor(phase);
    switch (kind) {
      case "square": return cycle < 0.5 ? 1 : -1;
      case "saw": return cycle * 2 - 1;
      case "triangle": return 1 - 4 * Math.abs(cycle - 0.5);
      case "pulse": return cycle < 0.19 ? 1 : -1;
      case "noise": return prng.nextFloat() * 2 - 1;
      case "sine":
      default: return Math.sin(phase * Math.PI * 2);
    }
  }

  async function renderReplaySafe(plan, context) {
    const sampleRate = context.profile.sampleRate;
    const frameCount = context.frameCount;
    const identityBytes = S.Core.fromHex(context.recipeHash);
    const identityView = new DataView(identityBytes.buffer, identityBytes.byteOffset, identityBytes.byteLength);
    const tones = plan.tones.map((tone, index) => ({
      kind: tone.kind || "sine",
      phase: (((tone.phase_u32 || 0) + identityView.getUint32((index % 8) * 4, false)) >>> 0) / 4294967296,
      frequencies: (tone.sequence_millihz || [tone.freq_millihz]).map(value => value / 1000),
      sequencePeriod: Math.max(1, tone.sequence_period_samples || sampleRate),
      gain: tone.amp_q15 / 32767,
      pan: (tone.pan_q15 || 0) / 32767,
      start: Math.max(0, tone.start_sample || 0),
      end: Math.max(0, tone.end_sample || 0x7fffffff),
      gatePeriod: Math.max(0, tone.gate_period_samples || 0),
      gateDuty: (tone.gate_duty_q15 == null ? 32767 : tone.gate_duty_q15) / 32767,
      lfoPhase: (tone.lfo_phase_u32 || 0) / 4294967296,
      lfoRate: (tone.lfo_rate_millihz || 0) / 1000,
      lfoDepth: (tone.lfo_depth_q15 || 0) / 32767,
      prng: S.Core.createPrng(context.recipeHash, "float-tone-" + index)
    }));
    const floatMix = new Float64Array(frameCount * 2);
    const master = (plan.master_q15 || 26000) / 32767;
    const feedback = (plan.feedback_q15 || 0) / 32767;
    let previousL = 0;
    let previousR = 0;
    for (let frame = 0; frame < frameCount; frame += 1) {
      let left = 0;
      let right = 0;
      for (const tone of tones) {
        if (frame < tone.start || frame >= tone.end) continue;
        if (tone.gatePeriod && ((frame - tone.start) % tone.gatePeriod) / tone.gatePeriod >= tone.gateDuty) continue;
        const sequenceIndex = Math.floor((frame - tone.start) / tone.sequencePeriod) % tone.frequencies.length;
        tone.phase += tone.frequencies[sequenceIndex] / sampleRate;
        if (tone.phase >= 1) tone.phase -= Math.floor(tone.phase);
        tone.lfoPhase += tone.lfoRate / sampleRate;
        if (tone.lfoPhase >= 1) tone.lfoPhase -= Math.floor(tone.lfoPhase);
        const lfo = 1 - tone.lfoDepth * 0.5 + Math.sin(tone.lfoPhase * Math.PI * 2) * tone.lfoDepth * 0.5;
        const sample = floatWave(tone.kind, tone.phase, tone.prng) * tone.gain * lfo;
        left += sample * (1 - tone.pan) * 0.5;
        right += sample * (1 + tone.pan) * 0.5;
      }
      left = (left + previousR * feedback) * master;
      right = (right + previousL * feedback) * master;
      if (!Number.isFinite(left)) left = 0;
      if (!Number.isFinite(right)) right = 0;
      previousL = Math.max(-1, Math.min(1, left));
      previousR = Math.max(-1, Math.min(1, right));
      floatMix[frame * 2] = left;
      floatMix[frame * 2 + 1] = right;
      if ((frame + 1) % FRAME_CHUNK === 0) { abortIfRequested(context.signal); await yieldTask(); }
    }

    const integerMix = new Int32Array(floatMix.length);
    for (let i = 0; i < floatMix.length; i += 1) {
      integerMix[i] = Math.round(floatMix[i] * 32767);
      if ((i + 1) % (FRAME_CHUNK * 2) === 0) { abortIfRequested(context.signal); await yieldTask(); }
    }
    return finalizeStrict(integerMix, frameCount, context.profile, context.signal);
  }

  async function renderTonePlan(plan, context) {
    if (!plan || !Array.isArray(plan.tones) || plan.tones.length === 0) throw new Error("Engine produced an empty tone plan");
    abortIfRequested(context.signal);
    return context.mode === S.MODES.CANONICAL_STRICT ? renderStrict(plan, context) : renderReplaySafe(plan, context);
  }

  S.Audio.DSP = Object.freeze({ clamp16, phaseStep, triangle, softSine, renderTonePlan });
})(window.SPECTRAL);
