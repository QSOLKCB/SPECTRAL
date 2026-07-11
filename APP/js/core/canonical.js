(function defineCanonical(S) {
  "use strict";

  const SHA256_K = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ]);

  function utf8(text) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(String(text));
    const escaped = unescape(encodeURIComponent(String(text)));
    const output = new Uint8Array(escaped.length);
    for (let i = 0; i < escaped.length; i += 1) output[i] = escaped.charCodeAt(i);
    return output;
  }

  function concatBytes(parts) {
    let length = 0;
    for (const part of parts) length += part.length;
    const joined = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) {
      joined.set(part, offset);
      offset += part.length;
    }
    return joined;
  }

  function toHex(bytes) {
    let result = "";
    for (let i = 0; i < bytes.length; i += 1) result += bytes[i].toString(16).padStart(2, "0");
    return result;
  }

  function fromHex(hex) {
    if (typeof hex !== "string" || hex.length % 2 || !/^[0-9a-f]*$/i.test(hex)) throw new TypeError("Invalid hexadecimal string");
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return bytes;
  }

  function rotateRight(value, bits) {
    return ((value >>> bits) | (value << (32 - bits))) >>> 0;
  }

  function sha256Bytes(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const bitLength = bytes.length * 8;
    const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
    const padded = new Uint8Array(paddedLength);
    padded.set(bytes);
    padded[bytes.length] = 0x80;
    const view = new DataView(padded.buffer);
    const highBits = Math.floor(bitLength / 0x100000000);
    const lowBits = bitLength >>> 0;
    view.setUint32(paddedLength - 8, highBits, false);
    view.setUint32(paddedLength - 4, lowBits, false);

    let h0 = 0x6a09e667;
    let h1 = 0xbb67ae85;
    let h2 = 0x3c6ef372;
    let h3 = 0xa54ff53a;
    let h4 = 0x510e527f;
    let h5 = 0x9b05688c;
    let h6 = 0x1f83d9ab;
    let h7 = 0x5be0cd19;
    const words = new Uint32Array(64);

    for (let offset = 0; offset < paddedLength; offset += 64) {
      for (let i = 0; i < 16; i += 1) words[i] = view.getUint32(offset + i * 4, false);
      for (let i = 16; i < 64; i += 1) {
        const x = words[i - 15];
        const y = words[i - 2];
        const s0 = rotateRight(x, 7) ^ rotateRight(x, 18) ^ (x >>> 3);
        const s1 = rotateRight(y, 17) ^ rotateRight(y, 19) ^ (y >>> 10);
        words[i] = (words[i - 16] + s0 + words[i - 7] + s1) >>> 0;
      }

      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let i = 0; i < 64; i += 1) {
        const upper1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
        const choose = (e & f) ^ (~e & g);
        const temp1 = (h + upper1 + choose + SHA256_K[i] + words[i]) >>> 0;
        const upper0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
        const majority = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (upper0 + majority) >>> 0;
        h = g; g = f; f = e; e = (d + temp1) >>> 0;
        d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0;
      h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0;
      h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
    }

    const digest = new Uint8Array(32);
    const digestView = new DataView(digest.buffer);
    [h0,h1,h2,h3,h4,h5,h6,h7].forEach((word, index) => digestView.setUint32(index * 4, word, false));
    return digest;
  }

  function sha256Hex(input) {
    return toHex(sha256Bytes(input));
  }

  async function webCryptoSha256Hex(input) {
    if (typeof crypto !== "object" || !crypto || !crypto.subtle || typeof crypto.subtle.digest !== "function") return null;
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const isolated = bytes.slice();
    try {
      const digest = await crypto.subtle.digest("SHA-256", isolated.buffer);
      return toHex(new Uint8Array(digest));
    } catch (_) {
      return null;
    }
  }

  function hashDomain(domain, value) {
    const body = value instanceof Uint8Array ? value : utf8(String(value));
    return sha256Hex(concatBytes([utf8(domain), new Uint8Array([0]), body]));
  }

  function validateCanonical(value, seen) {
    if (value === null || typeof value === "string" || typeof value === "boolean") return;
    if (typeof value === "number") {
      if (!Number.isSafeInteger(value) || Object.is(value, -0)) throw new TypeError("Canonical JSON permits safe integers only");
      return;
    }
    if (typeof value !== "object") throw new TypeError("Unsupported canonical JSON value");
    if (seen.has(value)) throw new TypeError("Canonical JSON cannot encode cycles");
    seen.add(value);
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) {
        if (!(i in value)) throw new TypeError("Canonical JSON cannot encode sparse arrays");
        validateCanonical(value[i], seen);
      }
    } else {
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) throw new TypeError("Canonical JSON requires plain objects");
      for (const key of Object.keys(value)) validateCanonical(value[key], seen);
    }
    seen.delete(value);
  }

  function canonicalize(value) {
    validateCanonical(value, new Set());
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(canonicalize);
    const result = Object.create(null);
    const keys = Object.keys(value).sort();
    for (const key of keys) result[key] = canonicalize(value[key]);
    return result;
  }

  function stableStringify(value) {
    return JSON.stringify(canonicalize(value));
  }

  function prettyStable(value) {
    return JSON.stringify(canonicalize(value), null, 2) + "\n";
  }

  function hashCanonical(domain, value) {
    return hashDomain(domain, utf8(stableStringify(value)));
  }

  function decimalToScaled(raw, scale) {
    const text = String(raw).trim();
    const match = /^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text);
    if (!match) throw new TypeError("Invalid decimal: " + text);
    const negative = match[1] === "-";
    const fraction = match[3] || "";
    const exponent = parseInt(match[4] || "0", 10) - fraction.length;
    if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 40) throw new RangeError("Decimal exponent is outside the canonical range");
    let numerator = BigInt((match[2] + fraction).replace(/^0+(?=\d)/, ""));
    let denominator = 1n;
    if (exponent >= 0) numerator *= 10n ** BigInt(exponent);
    else denominator = 10n ** BigInt(-exponent);
    numerator *= BigInt(scale);
    let quotient = numerator / denominator;
    const remainder = numerator % denominator;
    if (remainder * 2n >= denominator) quotient += 1n;
    if (negative) quotient = -quotient;
    const output = Number(quotient);
    if (!Number.isSafeInteger(output)) throw new RangeError("Scaled decimal exceeds safe integer range");
    return output;
  }

  function clampInteger(value, minimum, maximum) {
    if (!Number.isSafeInteger(value)) throw new TypeError("Expected a safe integer");
    return Math.max(minimum, Math.min(maximum, value));
  }

  function rotl32(value, bits) {
    const amount = bits & 31;
    return ((value << amount) | (value >>> ((32 - amount) & 31))) >>> 0;
  }

  class Xoshiro128ss {
    constructor(seedBytes) {
      if (!(seedBytes instanceof Uint8Array) || seedBytes.length < 16) throw new TypeError("PRNG seed requires at least 16 bytes");
      const view = new DataView(seedBytes.buffer, seedBytes.byteOffset, seedBytes.byteLength);
      this.state = new Uint32Array([
        view.getUint32(0, false), view.getUint32(4, false), view.getUint32(8, false), view.getUint32(12, false)
      ]);
      if ((this.state[0] | this.state[1] | this.state[2] | this.state[3]) === 0) this.state[0] = 0x6a09e667;
    }

    nextUint32() {
      const s = this.state;
      const result = Math.imul(rotl32(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0;
      const t = (s[1] << 9) >>> 0;
      s[2] = (s[2] ^ s[0]) >>> 0;
      s[3] = (s[3] ^ s[1]) >>> 0;
      s[1] = (s[1] ^ s[2]) >>> 0;
      s[0] = (s[0] ^ s[3]) >>> 0;
      s[2] = (s[2] ^ t) >>> 0;
      s[3] = rotl32(s[3], 11);
      return result;
    }

    nextSigned16() {
      return (this.nextUint32() >>> 16) - 32768;
    }

    nextFloat() {
      return this.nextUint32() / 4294967296;
    }
  }

  function createPrng(identityHex, lane) {
    const material = sha256Bytes(concatBytes([utf8("SPECTRAL/PRNG/v1"), new Uint8Array([0]), fromHex(identityHex), utf8(String(lane || "main"))]));
    return new Xoshiro128ss(material);
  }

  function runtimeFingerprint() {
    const nav = typeof navigator === "object" ? navigator : {};
    const screenInfo = typeof screen === "object" ? screen : {};
    const core = {
      app_version: S.APP.version,
      audio_context: typeof AudioContext === "function" || typeof webkitAudioContext === "function",
      hardware_concurrency: Number.isSafeInteger(nav.hardwareConcurrency) ? nav.hardwareConcurrency : 0,
      language: String(nav.language || "unknown"),
      platform: String(nav.platform || "unknown"),
      screen_color_depth: Number.isSafeInteger(screenInfo.colorDepth) ? screenInfo.colorDepth : 0,
      user_agent: String(nav.userAgent || "unknown"),
      web_crypto: typeof crypto === "object" && Boolean(crypto && crypto.subtle)
    };
    return {
      core: core,
      hash: hashCanonical("SPECTRAL/RUNTIME/v1", core)
    };
  }

  S.Core = Object.assign(S.Core, {
    utf8,
    concatBytes,
    toHex,
    fromHex,
    sha256Bytes,
    sha256Hex,
    webCryptoSha256Hex,
    hashDomain,
    canonicalize,
    stableStringify,
    prettyStable,
    hashCanonical,
    decimalToScaled,
    clampInteger,
    rotl32,
    Xoshiro128ss,
    createPrng,
    runtimeFingerprint
  });
})(window.SPECTRAL);
