(function defineE8StudioEngine(S) {
  "use strict";

  const UINT32 = 4294967296;
  const UINT32_BIG = 4294967296n;
  const TWO_PI = Math.PI * 2;
  const STRICT_TWO_PI_MICRO = 6283185n;
  const FRAME_CHUNK = 16384;
  const PHI = (1 + Math.sqrt(5)) / 2;
  const STRICT_PHI_NUM = 1597n;
  const STRICT_PHI_DEN = 987n;
  const AXIS_MULTIPLIERS_MILLI = Object.freeze([550, 670, 790, 910, 1030, 1150, 1270, 1390]);
  const MINOR_RATIOS_PPM = Object.freeze([500000, 561231, 594604, 667420, 749154, 793701, 890899, 1000000]);
  const E8_HEIGHT_RATIOS_PPM = Object.freeze([500000, 618034, 707107, 809017, 1000000, 1122570, 1309017, 1618034]);
  const SIN_TABLE_SIZE = 8192;
  const SIN_TABLE = new Float64Array(SIN_TABLE_SIZE + 1);
  for (let index = 0; index <= SIN_TABLE_SIZE; index += 1) SIN_TABLE[index] = Math.sin(index * TWO_PI / SIN_TABLE_SIZE);

  function fastSin(cycles) {
    const wrapped = cycles - Math.floor(cycles);
    const position = wrapped * SIN_TABLE_SIZE;
    const index = Math.floor(position);
    const fraction = position - index;
    return SIN_TABLE[index] + (SIN_TABLE[index + 1] - SIN_TABLE[index]) * fraction;
  }

  function triangleFloat(cycles) {
    const wrapped = cycles - Math.floor(cycles);
    return 1 - 4 * Math.abs(wrapped - 0.5);
  }

  function triangleStrict(phase) {
    const upper = phase >>> 16;
    const folded = (upper & 0x8000) ? 0xffff - upper : upper;
    return (folded << 1) - 32767;
  }

  function softSineStrict(phase) {
    const x = triangleStrict(phase);
    return Math.trunc((x * (65536 - Math.abs(x))) / 32768);
  }

  function phaseStepStrict(freqMilliHz, sampleRate) {
    return Number((BigInt(freqMilliHz) * UINT32_BIG) / (BigInt(sampleRate) * 1000n)) >>> 0;
  }

  function axisStepStrict(driftMilliRad, multiplierMilli, axisGainMilli, controlRate) {
    const numerator = BigInt(driftMilliRad) * BigInt(multiplierMilli) * BigInt(axisGainMilli) * UINT32_BIG;
    const denominator = STRICT_TWO_PI_MICRO * BigInt(controlRate) * 1000n;
    return Number(numerator / denominator) >>> 0;
  }

  function ratioPowStrict(value, exponent) {
    let output = BigInt(value);
    if (exponent > 0) for (let step = 0; step < exponent; step += 1) output = (output * STRICT_PHI_NUM + STRICT_PHI_DEN / 2n) / STRICT_PHI_DEN;
    if (exponent < 0) for (let step = 0; step < -exponent; step += 1) output = (output * STRICT_PHI_DEN + STRICT_PHI_NUM / 2n) / STRICT_PHI_NUM;
    return Number(output);
  }

  function baseFrequenciesStrict(params) {
    const output = new Int32Array(params.voice_count);
    if (params.lattice === "phi_deep") {
      for (let voice = 0; voice < params.voice_count; voice += 1) output[voice] = ratioPowStrict(params.anchor_millihz, voice - params.voice_count + 1);
    } else if (params.lattice === "phi_centered") {
      const centre = Math.floor((params.voice_count - 1) / 2);
      for (let voice = 0; voice < params.voice_count; voice += 1) output[voice] = ratioPowStrict(params.anchor_millihz, voice - centre);
    } else if (params.lattice === "harmonic") {
      for (let voice = 0; voice < params.voice_count; voice += 1) output[voice] = Math.max(8000, Math.trunc(params.anchor_millihz * (voice + 1) / params.voice_count));
    } else {
      const table = params.lattice === "minor_field" ? MINOR_RATIOS_PPM : E8_HEIGHT_RATIOS_PPM;
      for (let voice = 0; voice < params.voice_count; voice += 1) {
        const tableIndex = Math.round(voice * (table.length - 1) / Math.max(1, params.voice_count - 1));
        output[voice] = Math.max(8000, Math.trunc(params.anchor_millihz * table[tableIndex] / 1000000));
      }
    }
    return output;
  }

  function baseFrequenciesFloat(params) {
    const output = new Float64Array(params.voice_count);
    const anchor = params.anchor_millihz / 1000;
    if (params.lattice === "phi_deep") {
      for (let voice = 0; voice < params.voice_count; voice += 1) output[voice] = anchor * Math.pow(PHI, voice - params.voice_count + 1);
    } else if (params.lattice === "phi_centered") {
      const centre = (params.voice_count - 1) / 2;
      for (let voice = 0; voice < params.voice_count; voice += 1) output[voice] = anchor * Math.pow(PHI, voice - centre);
    } else if (params.lattice === "harmonic") {
      for (let voice = 0; voice < params.voice_count; voice += 1) output[voice] = Math.max(8, anchor * (voice + 1) / params.voice_count);
    } else {
      const table = params.lattice === "minor_field" ? MINOR_RATIOS_PPM : E8_HEIGHT_RATIOS_PPM;
      for (let voice = 0; voice < params.voice_count; voice += 1) {
        const tableIndex = Math.round(voice * (table.length - 1) / Math.max(1, params.voice_count - 1));
        output[voice] = Math.max(8, anchor * table[tableIndex] / 1000000);
      }
    }
    return output;
  }

  function strictRootPhase(root, axisPhase) {
    let phase = 0;
    for (let axis = 0; axis < 8; axis += 1) {
      const coordinate = root[axis];
      const value = axisPhase[axis] >>> 0;
      if (coordinate === 2) phase = (phase + value) >>> 0;
      else if (coordinate === -2) phase = (phase - value) >>> 0;
      else if (coordinate === 1) phase = (phase + (value >>> 1)) >>> 0;
      else if (coordinate === -1) phase = (phase - (value >>> 1)) >>> 0;
    }
    return phase >>> 0;
  }

  function strictSaturate(value, driveMilli) {
    const driven = Math.trunc(value * driveMilli / 1000);
    const magnitude = Math.abs(driven);
    return Math.trunc(driven * 65536 / (65536 + magnitude));
  }

  function floatSaturate(value, driveMilli) {
    const driven = value * driveMilli / 1000;
    return driven / (1 + Math.abs(driven) * 0.62);
  }

  function trajectoryPointStrict(controlIndex, axisPhase) {
    return {
      control_index: controlIndex,
      theta_microturns: Array.from(axisPhase, phase => Math.trunc((phase >>> 0) * 1000000 / UINT32))
    };
  }

  function trajectoryPointFloat(controlIndex, theta) {
    return {
      control_index: controlIndex,
      theta_microturns: Array.from(theta, angle => Math.round((((angle / TWO_PI) % 1 + 1) % 1) * 1000000))
    };
  }

  function panForModeStrict(params, voice, voiceCount, torusPan, orbitPan, qutritPan) {
    let base = voiceCount === 1 ? 0 : Math.trunc((voice * 65534 / (voiceCount - 1)) - 32767);
    if (params.spatial_mode === "near_mono") base = Math.trunc(base / 8);
    else if (params.spatial_mode === "triality" || params.spatial_mode === "trinaural") base = [-24576, 0, 24576][voice % 3];
    else if (params.spatial_mode === "qutrit4d") base = Math.trunc((base + qutritPan) / 2);
    else if (params.spatial_mode === "orbit") base = orbitPan;
    else base = Math.trunc((base + torusPan) / 2);
    return Math.max(-32767, Math.min(32767, Math.trunc(base * params.width_milli / 1000)));
  }

  function panForModeFloat(params, voice, voiceCount, torusPan, orbitPan, qutritPan) {
    let base = voiceCount === 1 ? 0 : voice * 2 / (voiceCount - 1) - 1;
    if (params.spatial_mode === "near_mono") base *= 0.125;
    else if (params.spatial_mode === "triality" || params.spatial_mode === "trinaural") base = [-0.75, 0, 0.75][voice % 3];
    else if (params.spatial_mode === "qutrit4d") base = (base + qutritPan) * 0.5;
    else if (params.spatial_mode === "orbit") base = orbitPan;
    else base = (base + torusPan) * 0.5;
    return Math.max(-1, Math.min(1, base * params.width_milli / 1000));
  }

  async function renderStrict(params, profile, recipeHash, options) {
    const frameCount = Math.trunc(profile.sample_rate * params.duration_ms / 1000);
    const buffer = new Int32Array(frameCount * 2);
    const identityView = new DataView(S.Core.fromHex(recipeHash).buffer);
    const prng = S.Core.createPrng(recipeHash, "strict-engine");
    const axisPhase = new Uint32Array(8);
    const baseAxisStep = new Uint32Array(8);
    const axisStep = new Uint32Array(8);
    for (let axis = 0; axis < 8; axis += 1) {
      axisPhase[axis] = (identityView.getUint32((axis % 8) * 4, false) + Math.imul(params.seed_u32, axis + 1) + params.mutation_index) >>> 0;
      baseAxisStep[axis] = axisStepStrict(params.drift_millirad, AXIS_MULTIPLIERS_MILLI[axis], params.axis_gains_milli[axis], params.control_rate_hz);
      axisStep[axis] = baseAxisStep[axis];
    }
    const rootsByVoice = [];
    for (let voice = 0; voice < params.voice_count; voice += 1) rootsByVoice.push(S.Core.sparseRootIndices(voice, params.root_density, params.root_offset));
    const baseFreq = baseFrequenciesStrict(params);
    const baseOscStep = Array.from(baseFreq, value => phaseStepStrict(value, profile.sample_rate));
    const oscStep = new Uint32Array(baseOscStep);
    const oscPhase = new Uint32Array(params.voice_count);
    const ampQ15 = new Int32Array(params.voice_count);
    const morphQ15 = new Int32Array(params.voice_count);
    const panQ15 = new Int32Array(params.voice_count);
    const qutrit = new Int32Array(params.voice_count * 3);
    const rawVoices = new Int32Array(params.voice_count);
    const controlFrames = Math.max(1, Math.round(profile.sample_rate / params.control_rate_hz));
    const totalControls = Math.ceil(frameCount / controlFrames);
    const trajectoryStride = Math.max(1, Math.ceil(totalControls / 256));
    const trajectory = [];
    let controlIndex = 0;
    let pulsePhase = 0;
    const pulseStep = phaseStepStrict(params.pulse_rate_millihz, profile.sample_rate);
    const delayFrames = Math.max(0, Math.trunc(params.haas_micros * profile.sample_rate / 1000000));
    const delay = new Int32Array(Math.max(1, delayFrames + 1));
    let delayIndex = 0, previousL = 0, previousR = 0;
    let activeRoot = params.root_offset;

    function updateControl() {
      if (params.path === "root_walk" && controlIndex % Math.max(1, params.control_rate_hz * 2) === 0) activeRoot = (activeRoot + 37 + (prng.nextUint32() % 19)) % 240;
      const rootWalk = S.Core.ROOTS_DOUBLED[activeRoot];
      for (let axis = 0; axis < 8; axis += 1) {
        let step = baseAxisStep[axis];
        if (params.bloom_milli) {
          const jitter = (prng.nextUint32() >>> 16) - 32768;
          const delta = Math.trunc(step * jitter * params.bloom_milli / (32768 * 24000));
          step = (step + delta) >>> 0;
        }
        if (params.path === "coxeter_orbit") {
          const coupling = softSineStrict(axisPhase[(axis + 1) % 8]);
          step = (step + Math.trunc(baseAxisStep[axis] * coupling * params.triality_milli / (32767 * 3000))) >>> 0;
        } else if (params.path === "triality_spiral") {
          const lane = axis % 3;
          step = (step + Math.trunc(baseAxisStep[axis] * [0, 113, -89][lane] / 1000)) >>> 0;
        } else if (params.path === "qutrit_orbit") {
          const state = ((Math.floor(controlIndex / Math.max(1, params.control_rate_hz * 3))) + axis) % 3;
          step = (step + Math.trunc(baseAxisStep[axis] * [-170, 0, 210][state] / 1000)) >>> 0;
        } else if (params.path === "root_walk") {
          step = (step + Math.trunc(baseAxisStep[axis] * rootWalk[axis] / 3)) >>> 0;
        }
        axisStep[axis] = step;
        axisPhase[axis] = (axisPhase[axis] + step) >>> 0;
      }
      const torusPan = softSineStrict(axisPhase[4]);
      const orbitPan = softSineStrict(axisPhase[5]);
      const qutritPan = Math.trunc((softSineStrict(axisPhase[2]) + softSineStrict(axisPhase[7])) / 2);
      for (let voice = 0; voice < params.voice_count; voice += 1) {
        let sumSin = 0, sumCos = 0;
        const indices = rootsByVoice[voice];
        for (let item = 0; item < indices.length; item += 1) {
          const phase = strictRootPhase(S.Core.ROOTS_DOUBLED[indices[item]], axisPhase);
          sumSin += softSineStrict(phase); sumCos += softSineStrict((phase + 0x40000000) >>> 0);
        }
        const averageSin = Math.trunc(sumSin / indices.length);
        const averageCos = Math.trunc(sumCos / indices.length);
        const modulation = Math.max(-32767, Math.min(32767, Math.trunc(averageSin * params.phase_gain_milli / 1000)));
        const stepDelta = Math.trunc(baseOscStep[voice] * modulation / (32767 * 18));
        oscStep[voice] = Math.max(1, (baseOscStep[voice] + stepDelta) >>> 0);
        const axisGain = params.axis_gains_milli[voice];
        const baseAmp = Math.trunc(29200 * axisGain / (params.voice_count * 1000));
        ampQ15[voice] = Math.max(256, Math.trunc(baseAmp * (1000 + Math.trunc(averageCos * params.amplitude_gain_milli / 32767)) / 1000));
        const q0 = voice * 3;
        const drive0 = Math.abs(softSineStrict(axisPhase[(voice + 0) % 8]));
        const drive1 = Math.abs(softSineStrict(axisPhase[(voice + 3) % 8]));
        const drive2 = Math.abs(averageSin);
        qutrit[q0] += Math.trunc((drive0 + params.ternary_bias_milli * 12 - qutrit[q0]) / 24);
        qutrit[q0 + 1] += Math.trunc((drive1 - params.ternary_bias_milli * 6 - qutrit[q0 + 1]) / 28);
        qutrit[q0 + 2] += Math.trunc((drive2 - qutrit[q0 + 2]) / 32);
        const qMag = Math.min(32767, Math.trunc((Math.abs(qutrit[q0]) + Math.abs(qutrit[q0 + 1]) + Math.abs(qutrit[q0 + 2])) / 3));
        morphQ15[voice] = Math.max(0, Math.min(32767, Math.trunc(params.wave_morph_milli * 32767 / 1000) + Math.trunc(qMag * Math.abs(params.ternary_bias_milli) / 2400)));
        panQ15[voice] = panForModeStrict(params, voice, params.voice_count, torusPan, orbitPan, qutritPan);
      }
      if (controlIndex % trajectoryStride === 0) trajectory.push(trajectoryPointStrict(controlIndex, axisPhase));
      controlIndex += 1;
    }

    for (let frame = 0; frame < frameCount; frame += 1) {
      if (frame % controlFrames === 0) updateControl();
      for (let voice = 0; voice < params.voice_count; voice += 1) {
        oscPhase[voice] = (oscPhase[voice] + oscStep[voice]) >>> 0;
        const sine = softSineStrict(oscPhase[voice]);
        const triangle = triangleStrict(oscPhase[voice]);
        rawVoices[voice] = Math.trunc((sine * (32767 - morphQ15[voice]) + triangle * morphQ15[voice]) / 32767);
      }
      pulsePhase = (pulsePhase + pulseStep) >>> 0;
      const pulse = params.pulse_rate_millihz ? Math.trunc((softSineStrict(pulsePhase) + 32767) / 2) : 32767;
      const pulseGain = 32767 - Math.trunc(params.pulse_depth_milli * 32767 / 1000) + Math.trunc(pulse * params.pulse_depth_milli / 1000);
      let left = 0, right = 0;
      for (let voice = 0; voice < params.voice_count; voice += 1) {
        const partner = rawVoices[(voice + Math.max(1, Math.floor(params.voice_count / 3))) % params.voice_count];
        const mixedWave = Math.trunc((rawVoices[voice] * (1000 - params.triality_milli) + partner * params.triality_milli) / 1000);
        const sample = Math.trunc(Math.trunc(mixedWave * ampQ15[voice] / 32767) * pulseGain / 32767);
        const leftGain = Math.trunc((32767 - panQ15[voice]) / 2);
        const rightGain = Math.trunc((32767 + panQ15[voice]) / 2);
        left += Math.trunc(sample * leftGain / 32767);
        right += Math.trunc(sample * rightGain / 32767);
      }
      if (params.feedback_milli) {
        left += Math.trunc(previousR * params.feedback_milli / 1000);
        right += Math.trunc(previousL * params.feedback_milli / 1000);
      }
      if (delayFrames) {
        const delayed = delay[delayIndex]; delay[delayIndex] = left; delayIndex = (delayIndex + 1) % delay.length;
        right += Math.trunc(delayed * params.width_milli / 16000);
      }
      left = strictSaturate(left, params.drive_milli); right = strictSaturate(right, params.drive_milli);
      previousL = left; previousR = right;
      buffer[frame * 2] = left; buffer[frame * 2 + 1] = right;
      if ((frame + 1) % FRAME_CHUNK === 0) {
        S.Audio.abortIfRequested(options.signal);
        if (options.progress) options.progress({ phase: "E8 Q15 render", completed: frame + 1, total: frameCount, ratio: (frame + 1) / frameCount });
        await S.Audio.yieldTask();
      }
    }
    S.Audio.abortIfRequested(options.signal);
    if (!trajectory.length || trajectory[trajectory.length - 1].control_index !== controlIndex - 1) trajectory.push(trajectoryPointStrict(controlIndex - 1, axisPhase));
    return {
      buffer, frameCount, trajectory,
      engine_observations: {
        backend: S.APP.strictAbi,
        root_count: 240,
        root_evaluations: controlIndex * params.voice_count * params.root_density,
        control_steps: controlIndex,
        final_theta_microturns: trajectory[trajectory.length - 1].theta_microturns,
        creative_entropy: null
      }
    };
  }

  function floatRootPhase(root, theta) {
    let phase = 0;
    for (let axis = 0; axis < 8; axis += 1) phase += root[axis] * theta[axis];
    return phase;
  }

  async function renderFloat(params, profile, mode, recipeHash, creativeEntropy, options) {
    const frameCount = Math.trunc(profile.sample_rate * params.duration_ms / 1000);
    const buffer = new Float32Array(frameCount * 2);
    const seedIdentity = mode === S.MODES.CREATIVE ? S.Core.hashDomain("SPECTRAL/E8-STUDIO/CREATIVE-SEED/v1", S.Core.concatBytes([S.Core.fromHex(recipeHash), S.Core.fromHex(creativeEntropy.hex)])) : recipeHash;
    const prng = S.Core.createPrng(seedIdentity, mode === S.MODES.CREATIVE ? "creative-engine" : "replay-engine");
    const theta = new Float64Array(8), baseOmega = new Float64Array(8), omega = new Float64Array(8);
    for (let axis = 0; axis < 8; axis += 1) {
      theta[axis] = prng.nextFloat() * TWO_PI;
      baseOmega[axis] = params.drift_millirad / 1000 * AXIS_MULTIPLIERS_MILLI[axis] / 1000 * params.axis_gains_milli[axis] / 1000;
      omega[axis] = baseOmega[axis];
    }
    const rootsByVoice = [];
    for (let voice = 0; voice < params.voice_count; voice += 1) rootsByVoice.push(S.Core.sparseRootIndices(voice, params.root_density, params.root_offset));
    const baseFreq = baseFrequenciesFloat(params);
    const frequency = new Float64Array(baseFreq);
    const phase = new Float64Array(params.voice_count);
    const amplitude = new Float64Array(params.voice_count);
    const morph = new Float64Array(params.voice_count);
    const pan = new Float64Array(params.voice_count);
    const qutrit = Array.from({ length: params.voice_count }, () => new Float64Array(3));
    const rawVoices = new Float64Array(params.voice_count);
    const controlFrames = Math.max(1, Math.round(profile.sample_rate / params.control_rate_hz));
    const totalControls = Math.ceil(frameCount / controlFrames);
    const trajectoryStride = Math.max(1, Math.ceil(totalControls / 256));
    const trajectory = [];
    const dt = 1 / params.control_rate_hz;
    let controlIndex = 0, pulsePhase = 0, activeRoot = params.root_offset, creativeRootShift = 0;
    const pulseRate = params.pulse_rate_millihz / 1000;
    const delayFrames = Math.max(0, Math.trunc(params.haas_micros * profile.sample_rate / 1000000));
    const delay = new Float64Array(Math.max(1, delayFrames + 1));
    let delayIndex = 0, previousL = 0, previousR = 0;

    function updateControl() {
      if (params.path === "root_walk" && controlIndex % Math.max(1, params.control_rate_hz * 2) === 0) activeRoot = (activeRoot + 37 + (prng.nextUint32() % 19)) % 240;
      if (mode === S.MODES.CREATIVE && controlIndex % Math.max(1, params.control_rate_hz) === 0 && prng.nextFloat() < 0.28) creativeRootShift = (creativeRootShift + 1 + (prng.nextUint32() % 29)) % 240;
      const rootWalk = S.Core.ROOTS_FLOAT[activeRoot];
      const time = controlIndex * dt;
      for (let axis = 0; axis < 8; axis += 1) {
        let speed = baseOmega[axis];
        const bloomScale = params.bloom_milli / 1000 * (mode === S.MODES.CREATIVE ? 4.0 : 1.0);
        speed += baseOmega[axis] * prng.nextSigned() * bloomScale * 0.04;
        if (params.path === "coxeter_orbit") speed += baseOmega[axis] * Math.sin(theta[(axis + 1) % 8]) * params.triality_milli / 3000;
        else if (params.path === "triality_spiral") speed *= 1 + [0, 0.113, -0.089][axis % 3];
        else if (params.path === "qutrit_orbit") speed *= 1 + [-0.17, 0, 0.21][(Math.floor(time / 3) + axis) % 3];
        else if (params.path === "root_walk") speed += baseOmega[axis] * rootWalk[axis] * 0.72;
        for (let octave = 0; octave < params.fractal_depth; octave += 1) {
          speed += baseOmega[axis] * Math.pow(1 / PHI, octave + 2) * Math.sin(TWO_PI * (0.0017 + axis * 0.00031) * Math.pow(PHI, octave) * time + axis * 0.71 + octave * Math.PI / 3);
        }
        omega[axis] = speed;
        theta[axis] = (theta[axis] + speed * dt + prng.nextSigned() * bloomScale * 0.0000015) % TWO_PI;
        if (theta[axis] < 0) theta[axis] += TWO_PI;
      }
      const torusPan = Math.sin(theta[4]);
      const orbitPan = Math.sin(theta[5] + time * 0.11);
      const qutritPan = 0.5 * (Math.sin(theta[2]) + Math.sin(theta[7]));
      for (let voice = 0; voice < params.voice_count; voice += 1) {
        let sumSin = 0, sumCos = 0;
        const indices = rootsByVoice[voice];
        for (let item = 0; item < indices.length; item += 1) {
          const rootIndex = (indices[item] + creativeRootShift) % 240;
          const projected = floatRootPhase(S.Core.ROOTS_FLOAT[rootIndex], theta);
          sumSin += Math.sin(projected); sumCos += Math.cos(projected);
        }
        const averageSin = sumSin / indices.length, averageCos = sumCos / indices.length;
        frequency[voice] = Math.max(8, Math.min(profile.sample_rate * 0.42, baseFreq[voice] * (1 + averageSin * params.phase_gain_milli / 1000 * 0.055)));
        const axisGain = params.axis_gains_milli[voice] / 1000;
        amplitude[voice] = Math.max(0.002, axisGain * (0.82 + averageCos * params.amplitude_gain_milli / 1000) / params.voice_count);
        const state = qutrit[voice];
        const drive0 = 0.5 * Math.sin(theta[0]) + 0.5 * Math.sin(theta[1]) + params.ternary_bias_milli / 1000;
        const drive1 = 0.5 * Math.cos(theta[2]) + 0.5 * Math.cos(theta[3]) - params.ternary_bias_milli / 2000;
        const drive2 = 0.25 * (drive0 + drive1) - params.ternary_bias_milli / 2000;
        state[0] += dt * (-0.78 * state[0] + drive0);
        state[1] += dt * (-0.78 * state[1] + drive1);
        state[2] += dt * (-0.78 * state[2] + drive2);
        const magnitude = Math.sqrt(state[0] * state[0] + state[1] * state[1] + state[2] * state[2]);
        morph[voice] = Math.max(0, Math.min(1, params.wave_morph_milli / 1000 + magnitude * Math.abs(params.ternary_bias_milli) / 2200));
        pan[voice] = panForModeFloat(params, voice, params.voice_count, torusPan, orbitPan, qutritPan);
      }
      if (controlIndex % trajectoryStride === 0) trajectory.push(trajectoryPointFloat(controlIndex, theta));
      controlIndex += 1;
    }

    for (let frame = 0; frame < frameCount; frame += 1) {
      if (frame % controlFrames === 0) updateControl();
      for (let voice = 0; voice < params.voice_count; voice += 1) {
        phase[voice] += frequency[voice] / profile.sample_rate;
        if (phase[voice] >= 1) phase[voice] -= Math.floor(phase[voice]);
        const sine = fastSin(phase[voice]);
        const triangle = triangleFloat(phase[voice] + 0.25);
        rawVoices[voice] = sine * (1 - morph[voice]) + triangle * morph[voice];
      }
      pulsePhase += pulseRate / profile.sample_rate;
      if (pulsePhase >= 1) pulsePhase -= 1;
      const pulse = pulseRate ? (fastSin(pulsePhase) + 1) * 0.5 : 1;
      const pulseGain = 1 - params.pulse_depth_milli / 1000 + pulse * params.pulse_depth_milli / 1000;
      let left = 0, right = 0;
      for (let voice = 0; voice < params.voice_count; voice += 1) {
        const partner = rawVoices[(voice + Math.max(1, Math.floor(params.voice_count / 3))) % params.voice_count];
        const wave = rawVoices[voice] * (1 - params.triality_milli / 1000) + partner * params.triality_milli / 1000;
        const sample = wave * amplitude[voice] * pulseGain;
        left += sample * (1 - pan[voice]) * 0.5;
        right += sample * (1 + pan[voice]) * 0.5;
      }
      if (params.spatial_mode === "trinaural") {
        left *= 0.88 + 0.12 * fastSin(pulsePhase * 0.99);
        right *= 0.88 + 0.12 * fastSin(pulsePhase * 1.015 + 0.17);
      }
      if (params.feedback_milli) {
        left += previousR * params.feedback_milli / 1000;
        right += previousL * params.feedback_milli / 1000;
      }
      if (delayFrames) {
        const delayed = delay[delayIndex]; delay[delayIndex] = left; delayIndex = (delayIndex + 1) % delay.length;
        right += delayed * params.width_milli / 16000;
      }
      left = floatSaturate(left, params.drive_milli); right = floatSaturate(right, params.drive_milli);
      previousL = left; previousR = right;
      buffer[frame * 2] = left; buffer[frame * 2 + 1] = right;
      if ((frame + 1) % FRAME_CHUNK === 0) {
        S.Audio.abortIfRequested(options.signal);
        if (options.progress) options.progress({ phase: mode === S.MODES.CREATIVE ? "creative E8 render" : "Float64 E8 render", completed: frame + 1, total: frameCount, ratio: (frame + 1) / frameCount });
        await S.Audio.yieldTask();
      }
    }
    S.Audio.abortIfRequested(options.signal);
    if (!trajectory.length || trajectory[trajectory.length - 1].control_index !== controlIndex - 1) trajectory.push(trajectoryPointFloat(controlIndex - 1, theta));
    return {
      buffer, frameCount, trajectory,
      engine_observations: {
        backend: mode === S.MODES.CREATIVE ? S.APP.creativeAbi : S.APP.replayAbi,
        root_count: 240,
        root_evaluations: controlIndex * params.voice_count * params.root_density,
        control_steps: controlIndex,
        final_theta_microturns: trajectory[trajectory.length - 1].theta_microturns,
        creative_entropy: mode === S.MODES.CREATIVE ? { source: creativeEntropy.source, nonce_sha256: S.Core.sha256Hex(S.Core.fromHex(creativeEntropy.hex)) } : null
      }
    };
  }

  async function render(paramsInput, profile, mode, recipeHash, creativeEntropy, options) {
    const params = S.Core.validateParams(paramsInput);
    if (!Object.values(S.MODES).includes(mode)) throw new RangeError("Unknown render mode");
    if (!profile || !Number.isSafeInteger(profile.sample_rate)) throw new TypeError("A normalized export profile is required");
    if (mode === S.MODES.CREATIVE && (!creativeEntropy || !creativeEntropy.hex)) throw new TypeError("Creative mode requires fresh entropy");
    return mode === S.MODES.STRICT
      ? renderStrict(params, profile, recipeHash, options || {})
      : renderFloat(params, profile, mode, recipeHash, creativeEntropy, options || {});
  }

  function estimate(paramsInput, profile) {
    const params = S.Core.validateParams(paramsInput);
    const frames = Math.trunc(profile.sample_rate * params.duration_ms / 1000);
    const workingBytesStrict = frames * 2 * 4 + frames * 2 * 2;
    const workingBytesFloat = frames * 2 * 4 + frames * 2 * 2;
    const controls = Math.ceil(frames / Math.max(1, Math.round(profile.sample_rate / params.control_rate_hz)));
    return {
      frames,
      wav_bytes: 44 + frames * 4,
      working_bytes: Math.max(workingBytesStrict, workingBytesFloat),
      root_evaluations: controls * params.voice_count * params.root_density,
      oscillator_evaluations: frames * params.voice_count
    };
  }

  S.Engine = Object.freeze({
    PHI, fastSin, triangleStrict, softSineStrict, phaseStepStrict,
    baseFrequenciesStrict, baseFrequenciesFloat, render, estimate
  });
})(window.E8STUDIO);
