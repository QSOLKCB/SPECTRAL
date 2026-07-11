(function defineWav(S) {
  "use strict";

  function writeAscii(view, offset, text) {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  }

  function pcmToBytes(pcm) {
    if (!(pcm instanceof Int16Array)) throw new TypeError("PCM must be Int16Array");
    const bytes = new Uint8Array(pcm.length * 2);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < pcm.length; i += 1) view.setInt16(i * 2, pcm[i], true);
    return bytes;
  }

  function bytesToPcm(bytes) {
    const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (input.length % 2) throw new TypeError("PCM byte length must be even");
    const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
    const pcm = new Int16Array(input.length / 2);
    for (let i = 0; i < pcm.length; i += 1) pcm[i] = view.getInt16(i * 2, true);
    return pcm;
  }

  function encodePcm16(pcm, sampleRate, channels) {
    if (channels !== 1 && channels !== 2) throw new RangeError("WAV writer supports mono or stereo PCM");
    if (!Number.isSafeInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new RangeError("Invalid sample rate");
    if (pcm.length % channels) throw new RangeError("PCM sample count does not align with channel count");
    const pcmBytes = pcmToBytes(pcm);
    const output = new Uint8Array(44 + pcmBytes.length);
    const view = new DataView(output.buffer);
    writeAscii(view, 0, "RIFF");
    view.setUint32(4, 36 + pcmBytes.length, true);
    writeAscii(view, 8, "WAVE");
    writeAscii(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true);
    writeAscii(view, 36, "data");
    view.setUint32(40, pcmBytes.length, true);
    output.set(pcmBytes, 44);
    return { wavBytes: output, pcmBytes };
  }

  function validate(bytes) {
    const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (input.length < 44) return false;
    const signature = String.fromCharCode(...input.slice(0, 4));
    const wave = String.fromCharCode(...input.slice(8, 12));
    const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
    return signature === "RIFF" && wave === "WAVE" && view.getUint32(4, true) === input.length - 8;
  }

  S.Audio.Wav = Object.freeze({ pcmToBytes, bytesToPcm, encodePcm16, validate });
})(window.SPECTRAL);
