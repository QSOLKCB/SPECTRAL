(function (root) {
  "use strict";

  const PA = root.PHOTOACOUSTIC = root.PHOTOACOUSTIC || {};
  PA.VERSION = "2.0.0";
  PA.ENGINE_VERSION = "photoacoustic-browser-2.0.0";
  PA.SCHEMA_VERSION = "spectral-photoacoustic-manifest/v1";
  PA.MODES = Object.freeze({ STRICT: "canonical-strict", REPLAY: "replay-safe" });

  const K = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ]);

  function rotr(value, bits) { return (value >>> bits) | (value << (32 - bits)); }
  function utf8(text) { return new TextEncoder().encode(String(text)); }
  function concatBytes() {
    let size = 0;
    for (const value of arguments) size += value.length;
    const out = new Uint8Array(size);
    let offset = 0;
    for (const value of arguments) { out.set(value, offset); offset += value.length; }
    return out;
  }
  function hex(bytes) { return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join(""); }

  function sha256Bytes(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const bitLength = BigInt(bytes.length) * 8n;
    const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
    const padded = new Uint8Array(paddedLength);
    padded.set(bytes);
    padded[bytes.length] = 0x80;
    const tail = new DataView(padded.buffer);
    tail.setUint32(paddedLength - 8, Number((bitLength >> 32n) & 0xffffffffn), false);
    tail.setUint32(paddedLength - 4, Number(bitLength & 0xffffffffn), false);

    const h = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
    const w = new Uint32Array(64);
    for (let offset = 0; offset < padded.length; offset += 64) {
      for (let i = 0; i < 16; i += 1) w[i] = tail.getUint32(offset + i * 4, false);
      for (let i = 16; i < 64; i += 1) {
        const s0 = (rotr(w[i-15],7) ^ rotr(w[i-15],18) ^ (w[i-15] >>> 3)) >>> 0;
        const s1 = (rotr(w[i-2],17) ^ rotr(w[i-2],19) ^ (w[i-2] >>> 10)) >>> 0;
        w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0;
      }
      let a=h[0],b=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],hh=h[7];
      for (let i = 0; i < 64; i += 1) {
        const s1 = (rotr(e,6) ^ rotr(e,11) ^ rotr(e,25)) >>> 0;
        const ch = ((e & f) ^ (~e & g)) >>> 0;
        const t1 = (hh + s1 + ch + K[i] + w[i]) >>> 0;
        const s0 = (rotr(a,2) ^ rotr(a,13) ^ rotr(a,22)) >>> 0;
        const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
        const t2 = (s0 + maj) >>> 0;
        hh=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
      }
      h[0]=(h[0]+a)>>>0; h[1]=(h[1]+b)>>>0; h[2]=(h[2]+c)>>>0; h[3]=(h[3]+d)>>>0;
      h[4]=(h[4]+e)>>>0; h[5]=(h[5]+f)>>>0; h[6]=(h[6]+g)>>>0; h[7]=(h[7]+hh)>>>0;
    }
    const output = new Uint8Array(32);
    const view = new DataView(output.buffer);
    for (let i = 0; i < 8; i += 1) view.setUint32(i * 4, h[i], false);
    return output;
  }
  function sha256Hex(input) { return hex(sha256Bytes(input)); }

  function stableStringify(value) {
    const active = new Set();
    function encode(item) {
      if (item === null) return "null";
      if (typeof item === "boolean") return item ? "true" : "false";
      if (typeof item === "string") return JSON.stringify(item);
      if (typeof item === "number") {
        if (!Number.isSafeInteger(item) || Object.is(item, -0)) throw new TypeError("Canonical JSON permits safe integers only");
        return String(item);
      }
      if (Array.isArray(item)) {
        if (active.has(item)) throw new TypeError("Canonical JSON cannot contain cycles");
        active.add(item); const out = "[" + item.map(encode).join(",") + "]"; active.delete(item); return out;
      }
      if (typeof item === "object" && (Object.getPrototypeOf(item) === Object.prototype || Object.getPrototypeOf(item) === null)) {
        if (active.has(item)) throw new TypeError("Canonical JSON cannot contain cycles");
        active.add(item);
        const out = "{" + Object.keys(item).sort().map(key => JSON.stringify(key) + ":" + encode(item[key])).join(",") + "}";
        active.delete(item); return out;
      }
      throw new TypeError("Unsupported canonical JSON value");
    }
    return encode(value);
  }
  function prettyStable(value) { return JSON.stringify(JSON.parse(stableStringify(value)), null, 2) + "\n"; }
  function domainHash(domain, value) { return sha256Hex(concatBytes(utf8(domain + "\0"), value instanceof Uint8Array ? value : utf8(stableStringify(value)))); }

  function decimalToScaled(text, scale) {
    const match = String(text).trim().match(/^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/);
    if (!match) throw new TypeError("Invalid decimal: " + text);
    const sign = match[1] === "-" ? -1n : 1n;
    const fraction = match[3] || "";
    const exponent = Number(match[4] || 0) - fraction.length;
    let numerator = BigInt(match[2] + fraction) * BigInt(scale);
    let denominator = 1n;
    if (exponent >= 0) numerator *= 10n ** BigInt(exponent); else denominator = 10n ** BigInt(-exponent);
    let rounded = numerator / denominator;
    const remainder = numerator % denominator;
    if (remainder * 2n >= denominator) rounded += 1n;
    const result = sign * rounded;
    if (result > BigInt(Number.MAX_SAFE_INTEGER) || result < BigInt(Number.MIN_SAFE_INTEGER)) throw new RangeError("Scaled decimal exceeds safe integer range");
    return Number(result);
  }

  function roundDiv(numerator, denominator) {
    if (!Number.isFinite(numerator) || !Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) throw new RangeError("roundDiv requires safe integers and positive denominator");
    if (numerator < 0) return -Math.floor((-numerator + Math.floor(denominator / 2)) / denominator);
    return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
  }
  function clamp(value, low, high) { return Math.min(high, Math.max(low, value)); }
  function clampInt(value, low, high) { return Math.trunc(clamp(Math.trunc(value), low, high)); }
  function milli(value) { return decimalToScaled(String(value), 1000); }
  function ppm(value) { return decimalToScaled(String(value), 1000000); }

  class Xoshiro128ss {
    constructor(seedBytes) {
      const seed = seedBytes.length >= 16 ? seedBytes : sha256Bytes(seedBytes);
      const view = new DataView(seed.buffer, seed.byteOffset, seed.byteLength);
      this.s = new Uint32Array([view.getUint32(0,true),view.getUint32(4,true),view.getUint32(8,true),view.getUint32(12,true)]);
      if (!(this.s[0] | this.s[1] | this.s[2] | this.s[3])) this.s[0] = 1;
    }
    nextUint32() {
      const s=this.s; const result=Math.imul(((Math.imul(s[1],5)<<7)|(Math.imul(s[1],5)>>>25))>>>0,9)>>>0;
      const t=(s[1]<<9)>>>0; s[2]^=s[0]; s[3]^=s[1]; s[1]^=s[2]; s[0]^=s[3]; s[2]^=t; s[3]=((s[3]<<11)|(s[3]>>>21))>>>0; return result;
    }
  }

  // Integer-only Bhaskara approximation. It is intentionally part of the strict ABI.
  function strictSinQ15(phase) {
    const p = phase >>> 0;
    const negative = p >= 0x80000000;
    const half = negative ? (p - 0x80000000) >>> 0 : p;
    const u = half >>> 16; // 0..32767 maps 0..pi
    const product = u * (32768 - u);
    const denominator = 5 * 32768 * 32768 - 4 * product;
    const magnitude = denominator ? roundDiv(16 * product * 32767, denominator) : 0;
    return negative ? -magnitude : magnitude;
  }
  function phaseIncrement(freqMilli, sampleRate) {
    const numerator = BigInt(freqMilli) * 4294967296n;
    const denominator = BigInt(sampleRate) * 1000n;
    return Number((numerator + denominator / 2n) / denominator) >>> 0;
  }
  function runtimeFingerprint() {
    const endianProbe=new Uint16Array([0x0102]),endianness=new Uint8Array(endianProbe.buffer)[0]===0x02?"little":"big",mathKat=[Math.sin(1),Math.cos(1),Math.tan(.5),Math.tanh(1),Math.exp(.125),Math.log(2),Math.atan2(1,-1),Math.sqrt(2)].map(value=>value.toPrecision(17));
    const fields={user_agent:navigator.userAgent,platform:navigator.platform||"",hardware_concurrency:Number.isInteger(navigator.hardwareConcurrency)?navigator.hardwareConcurrency:0,endianness,math_kat:mathKat};
    return Object.assign({},fields,{hash:sha256Hex(utf8(stableStringify(fields)))});
  }
  function abortError() { const error = new Error("Render cancelled"); error.name = "AbortError"; return error; }
  async function checkpoint(signal, progress, fraction, label) {
    if (signal && signal.aborted) throw abortError();
    if (progress) progress(clamp(fraction, 0, 1), label);
    await new Promise(resolve => setTimeout(resolve, 0));
    if (signal && signal.aborted) throw abortError();
  }
  function filenameSafe(text) { return String(text).replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 96) || "photoacoustic"; }
  function blobUrl(bytes, type) { return URL.createObjectURL(new Blob([bytes], {type})); }
  function download(bytes, name, type) {
    const url = blobUrl(bytes, type || "application/octet-stream");
    const link = document.createElement("a"); link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  PA.Core = Object.freeze({
    utf8, concatBytes, hex, sha256Bytes, sha256Hex, stableStringify, prettyStable, domainHash,
    decimalToScaled, roundDiv, clamp, clampInt, milli, ppm, Xoshiro128ss, strictSinQ15,
    phaseIncrement, runtimeFingerprint, checkpoint, abortError, filenameSafe, blobUrl, download
  });
})(window);
