(function defineE8StudioAudio(S) {
  "use strict";

  const CHUNK_FRAMES = 16384;
  const CRC_TABLE = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    CRC_TABLE[index] = value >>> 0;
  }

  function abortIfRequested(signal) {
    if (signal && signal.aborted) {
      const error = new Error("Render cancelled");
      error.name = "AbortError";
      throw error;
    }
  }

  function yieldTask() { return new Promise(resolve => setTimeout(resolve, 0)); }

  function clamp16(value) {
    if (value > 32767) return 32767;
    if (value < -32768) return -32768;
    return value < 0 ? Math.ceil(value) : Math.floor(value);
  }

  function report(callback, phase, completed, total) {
    if (typeof callback === "function") callback({ phase, completed, total, ratio: total ? completed / total : 0 });
  }

  async function finalizeStrict(buffer, frameCount, profile, options) {
    const signal = options && options.signal;
    const progress = options && options.progress;
    let meanL = 0, meanR = 0;
    if (profile.remove_dc && frameCount > 0) {
      let sumL = 0, sumR = 0;
      for (let frame = 0; frame < frameCount; frame += 1) {
        sumL += buffer[frame * 2]; sumR += buffer[frame * 2 + 1];
        if ((frame + 1) % CHUNK_FRAMES === 0) { abortIfRequested(signal); report(progress, "dc scan", frame + 1, frameCount); await yieldTask(); }
      }
      meanL = Math.trunc(sumL / frameCount); meanR = Math.trunc(sumR / frameCount);
    }
    let peak = 1;
    for (let frame = 0; frame < frameCount; frame += 1) {
      const left = buffer[frame * 2] - meanL;
      const right = buffer[frame * 2 + 1] - meanR;
      peak = Math.max(peak, Math.abs(left), Math.abs(right));
      if ((frame + 1) % CHUNK_FRAMES === 0) { abortIfRequested(signal); report(progress, "peak scan", frame + 1, frameCount); await yieldTask(); }
    }
    const fadeIn = Math.min(frameCount, Math.trunc(profile.sample_rate * profile.fade_in_ms / 1000));
    const fadeOut = Math.min(frameCount, Math.trunc(profile.sample_rate * profile.fade_out_ms / 1000));
    const numerator = profile.normalize ? profile.ceiling_q15 : 32767;
    const denominator = profile.normalize ? peak : 32767;
    const pcm = new Int16Array(frameCount * 2);
    for (let frame = 0; frame < frameCount; frame += 1) {
      let fadeQ15 = 32767;
      if (fadeIn && frame < fadeIn) fadeQ15 = Math.trunc(frame * 32767 / fadeIn);
      const remaining = frameCount - 1 - frame;
      if (fadeOut && remaining < fadeOut) fadeQ15 = Math.min(fadeQ15, Math.trunc(remaining * 32767 / fadeOut));
      const left = Math.trunc(Math.trunc((buffer[frame * 2] - meanL) * numerator / denominator) * fadeQ15 / 32767);
      const right = Math.trunc(Math.trunc((buffer[frame * 2 + 1] - meanR) * numerator / denominator) * fadeQ15 / 32767);
      pcm[frame * 2] = clamp16(left); pcm[frame * 2 + 1] = clamp16(right);
      if ((frame + 1) % CHUNK_FRAMES === 0) { abortIfRequested(signal); report(progress, "pcm quantize", frame + 1, frameCount); await yieldTask(); }
    }
    abortIfRequested(signal);
    return pcm;
  }

  async function finalizeFloat(buffer, frameCount, profile, options) {
    const signal = options && options.signal;
    const progress = options && options.progress;
    let meanL = 0, meanR = 0;
    if (profile.remove_dc && frameCount > 0) {
      for (let frame = 0; frame < frameCount; frame += 1) {
        meanL += buffer[frame * 2]; meanR += buffer[frame * 2 + 1];
        if ((frame + 1) % CHUNK_FRAMES === 0) { abortIfRequested(signal); report(progress, "dc scan", frame + 1, frameCount); await yieldTask(); }
      }
      meanL /= frameCount; meanR /= frameCount;
    }
    let peak = 1e-12;
    for (let frame = 0; frame < frameCount; frame += 1) {
      peak = Math.max(peak, Math.abs(buffer[frame * 2] - meanL), Math.abs(buffer[frame * 2 + 1] - meanR));
      if ((frame + 1) % CHUNK_FRAMES === 0) { abortIfRequested(signal); report(progress, "peak scan", frame + 1, frameCount); await yieldTask(); }
    }
    const target = profile.ceiling_q15 / 32767;
    const gain = profile.normalize ? target / peak : 1;
    const fadeIn = Math.min(frameCount, Math.trunc(profile.sample_rate * profile.fade_in_ms / 1000));
    const fadeOut = Math.min(frameCount, Math.trunc(profile.sample_rate * profile.fade_out_ms / 1000));
    const pcm = new Int16Array(frameCount * 2);
    for (let frame = 0; frame < frameCount; frame += 1) {
      let fade = 1;
      if (fadeIn && frame < fadeIn) fade = frame / fadeIn;
      const remaining = frameCount - 1 - frame;
      if (fadeOut && remaining < fadeOut) fade = Math.min(fade, remaining / fadeOut);
      const left = (buffer[frame * 2] - meanL) * gain * fade;
      const right = (buffer[frame * 2 + 1] - meanR) * gain * fade;
      pcm[frame * 2] = clamp16(Math.round(Math.max(-1, Math.min(1, left)) * 32767));
      pcm[frame * 2 + 1] = clamp16(Math.round(Math.max(-1, Math.min(1, right)) * 32767));
      if ((frame + 1) % CHUNK_FRAMES === 0) { abortIfRequested(signal); report(progress, "pcm quantize", frame + 1, frameCount); await yieldTask(); }
    }
    abortIfRequested(signal);
    return pcm;
  }

  function finalize(buffer, frameCount, profile, mode, options) {
    return mode === S.MODES.STRICT ? finalizeStrict(buffer, frameCount, profile, options) : finalizeFloat(buffer, frameCount, profile, options);
  }

  function writeAscii(view, offset, text) {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
  }

  function pcmToBytes(pcm) {
    if (!(pcm instanceof Int16Array)) throw new TypeError("PCM must be an Int16Array");
    const bytes = new Uint8Array(pcm.length * 2);
    const view = new DataView(bytes.buffer);
    for (let index = 0; index < pcm.length; index += 1) view.setInt16(index * 2, pcm[index], true);
    return bytes;
  }

  function encodePcm16(pcm, sampleRate, channels) {
    if (channels !== 1 && channels !== 2) throw new RangeError("Only mono and stereo are supported");
    if (pcm.length % channels) throw new RangeError("PCM is not channel-aligned");
    const pcmBytes = pcmToBytes(pcm);
    const wavBytes = new Uint8Array(44 + pcmBytes.length);
    const view = new DataView(wavBytes.buffer);
    writeAscii(view, 0, "RIFF"); view.setUint32(4, 36 + pcmBytes.length, true);
    writeAscii(view, 8, "WAVE"); writeAscii(view, 12, "fmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true);
    writeAscii(view, 36, "data"); view.setUint32(40, pcmBytes.length, true); wavBytes.set(pcmBytes, 44);
    return { pcmBytes, wavBytes };
  }

  function validateWav(bytes) {
    const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (input.length < 44) return false;
    const signature = String.fromCharCode(...input.slice(0, 4));
    const wave = String.fromCharCode(...input.slice(8, 12));
    const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
    return signature === "RIFF" && wave === "WAVE" && view.getUint32(4, true) === input.length - 8;
  }

  function integerSqrtBig(value) {
    if (value < 0n) throw new RangeError("Integer square root requires a non-negative value");
    if (value < 2n) return value;
    let x = 1n << BigInt(Math.ceil(value.toString(2).length / 2));
    let y = (x + value / x) >> 1n;
    while (y < x) { x = y; y = (x + value / x) >> 1n; }
    return x;
  }

  function fixedLog2Q20(value) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new RangeError("Fixed log2 requires a positive safe integer");
    const integer = 31 - Math.clz32(value);
    let x = BigInt(value) << BigInt(31 - integer);
    let fraction = 0;
    for (let bit = 1; bit <= 20; bit += 1) {
      x = (x * x) >> 31n;
      if (x >= 0x100000000n) {
        x >>= 1n;
        fraction |= 1 << (20 - bit);
      }
    }
    return integer * 1048576 + fraction;
  }

  function divideRoundedSigned(numerator, denominator) {
    if (denominator <= 0n) throw new RangeError("Positive denominator required");
    if (numerator < 0n) return -((-numerator + denominator / 2n) / denominator);
    return (numerator + denominator / 2n) / denominator;
  }

  function dbfsMilliFromQ15(value) {
    if (value <= 0) return -120000;
    const log2RatioQ20 = fixedLog2Q20(value) - fixedLog2Q20(32767);
    return Number(divideRoundedSigned(BigInt(log2RatioQ20) * 6020600n, 1048576000n));
  }

  function analyzePcm(pcm, sampleRate) {
    const frames = pcm.length / 2;
    let peak = 0, sumL = 0, sumR = 0, clipCount = 0, zeroCrossings = 0, previousMono = 0;
    let sumSquares = 0n, cross = 0n, energyL = 0n, energyR = 0n;
    let chunkSquares = 0, chunkCross = 0, chunkEnergyL = 0, chunkEnergyR = 0, chunkSamples = 0;
    for (let frame = 0; frame < frames; frame += 1) {
      const left = pcm[frame * 2], right = pcm[frame * 2 + 1];
      const mono = Math.trunc((left + right) / 2);
      peak = Math.max(peak, Math.abs(left), Math.abs(right));
      chunkSquares += left * left + right * right; sumL += left; sumR += right;
      chunkEnergyL += left * left; chunkEnergyR += right * right; chunkCross += left * right; chunkSamples += 2;
      if (Math.abs(left) >= 32767 || Math.abs(right) >= 32767) clipCount += 1;
      if (frame && ((mono >= 0 && previousMono < 0) || (mono < 0 && previousMono >= 0))) zeroCrossings += 1;
      previousMono = mono;
      if (chunkSamples >= 4096 || frame === frames - 1) {
        sumSquares += BigInt(chunkSquares); energyL += BigInt(chunkEnergyL); energyR += BigInt(chunkEnergyR); cross += BigInt(chunkCross);
        chunkSquares = 0; chunkEnergyL = 0; chunkEnergyR = 0; chunkCross = 0; chunkSamples = 0;
      }
    }
    const rmsRaw = Number(integerSqrtBig(sumSquares / BigInt(Math.max(1, pcm.length))));
    const correlationDenominator = energyL && energyR ? integerSqrtBig(energyL * energyR) : 0n;
    const correlationMillionths = correlationDenominator ? Number(divideRoundedSigned(cross * 1000000n, correlationDenominator)) : 0;
    const envelopeBins = 64;
    const envelope = [];
    for (let bin = 0; bin < envelopeBins; bin += 1) {
      const start = Math.floor(bin * frames / envelopeBins), end = Math.floor((bin + 1) * frames / envelopeBins);
      let energy = 0n, chunkEnergy = 0, chunkCount = 0, count = 0;
      for (let frame = start; frame < end; frame += 1) {
        const mono = Math.trunc((pcm[frame * 2] + pcm[frame * 2 + 1]) / 2);
        chunkEnergy += mono * mono; chunkCount += 1; count += 1;
        if (chunkCount >= 2048 || frame === end - 1) { energy += BigInt(chunkEnergy); chunkEnergy = 0; chunkCount = 0; }
      }
      envelope.push(Number(integerSqrtBig(energy / BigInt(Math.max(1, count)))));
    }
    const chunkHashes = [];
    const pcmBytes = pcmToBytes(pcm);
    const chunkSize = Math.max(1, Math.ceil(pcmBytes.length / 16));
    for (let offset = 0; offset < pcmBytes.length; offset += chunkSize) chunkHashes.push(S.Core.sha256Hex(pcmBytes.slice(offset, Math.min(pcmBytes.length, offset + chunkSize))));
    return {
      frame_count: frames,
      duration_ms: Math.trunc(frames * 1000 / sampleRate),
      peak_q15: peak,
      peak_dbfs_milli: dbfsMilliFromQ15(peak),
      rms_q15: rmsRaw,
      rms_dbfs_milli: dbfsMilliFromQ15(rmsRaw),
      dc_left_ppm: Math.round(sumL * 1000000 / Math.max(1, frames * 32767)),
      dc_right_ppm: Math.round(sumR * 1000000 / Math.max(1, frames * 32767)),
      zero_crossings_per_million_frames: Math.round(zeroCrossings * 1000000 / Math.max(1, frames)),
      stereo_correlation_millionths: correlationMillionths,
      clipping_frame_count: clipCount,
      crest_factor_milli: rmsRaw ? Math.round(peak * 1000 / rmsRaw) : 0,
      rms_envelope_q15: envelope,
      rms_envelope_sha256: S.Core.hashCanonical("SPECTRAL/E8-STUDIO/ENVELOPE/v1", envelope),
      pcm_chunk_sha256: chunkHashes
    };
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let index = 0; index < bytes.length; index += 1) crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function u16(value) { const bytes = new Uint8Array(2); new DataView(bytes.buffer).setUint16(0, value, true); return bytes; }
  function u32(value) { const bytes = new Uint8Array(4); new DataView(bytes.buffer).setUint32(0, value >>> 0, true); return bytes; }

  function createZip(entries) {
    const normalized = entries.map(entry => ({
      name: String(entry.name),
      nameBytes: S.Core.utf8(String(entry.name)),
      bytes: entry.bytes instanceof Uint8Array ? entry.bytes : new Uint8Array(entry.bytes)
    })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    const local = [], central = [];
    let offset = 0;
    for (const entry of normalized) {
      const crc = crc32(entry.bytes);
      const header = S.Core.concatBytes([
        u32(0x04034b50),u16(20),u16(0x0800),u16(0),u16(0),u16(33),u32(crc),u32(entry.bytes.length),u32(entry.bytes.length),u16(entry.nameBytes.length),u16(0),entry.nameBytes
      ]);
      local.push(header, entry.bytes);
      central.push(S.Core.concatBytes([
        u32(0x02014b50),u16(20),u16(20),u16(0x0800),u16(0),u16(0),u16(33),u32(crc),u32(entry.bytes.length),u32(entry.bytes.length),u16(entry.nameBytes.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),entry.nameBytes
      ]));
      offset += header.length + entry.bytes.length;
    }
    const centralBytes = S.Core.concatBytes(central);
    const end = S.Core.concatBytes([u32(0x06054b50),u16(0),u16(0),u16(normalized.length),u16(normalized.length),u32(centralBytes.length),u32(offset),u16(0)]);
    return S.Core.concatBytes([...local, centralBytes, end]);
  }

  S.Audio = Object.freeze({
    CHUNK_FRAMES, abortIfRequested, yieldTask, clamp16, finalize,
    pcmToBytes, encodePcm16, validateWav, analyzePcm, crc32, createZip
  });
})(window.E8STUDIO);
