(function defineE8StudioCore(global) {
  "use strict";

  const APP = Object.freeze({
    id: "spectral-e8-geometry-studio",
    name: "SPECTRAL E8 Geometry Studio",
    version: "1.0.0",
    schema: "spectral-e8-studio-manifest-v1",
    recipeSchema: "spectral-e8-studio-recipe-v1",
    strictAbi: "e8-q15-root-torus-v1",
    replayAbi: "e8-float64-root-torus-v1",
    creativeAbi: "e8-creative-root-torus-v1",
    wavWriter: "spectral-riff-pcm16-v1",
    rootSystem: "e8-doubled-coordinate-roots-v1",
    prng: "xoshiro128ss-v1",
    claimBoundary: "E8 is the mathematical control geometry; musical mappings and spatial metaphors are declared sonification choices."
  });

  const MODES = Object.freeze({
    STRICT: "canonical_strict",
    REPLAY: "replay_safe",
    CREATIVE: "creative_nondeterministic"
  });

  const MODE_META = Object.freeze({
    canonical_strict: Object.freeze({
      name: "Canonical Deterministic",
      short: "CANONICAL",
      promise: "Cross-runtime byte identity inside the versioned Q15 ABI.",
      domain: "SPECTRAL/E8-STUDIO/CANONICAL/v1"
    }),
    replay_safe: Object.freeze({
      name: "Replay-Safe",
      short: "REPLAY SAFE",
      promise: "Float64 musical DSP with a bound browser/runtime fingerprint.",
      domain: "SPECTRAL/E8-STUDIO/REPLAY/v1"
    }),
    creative_nondeterministic: Object.freeze({
      name: "Creative Non-Deterministic",
      short: "CREATIVE",
      promise: "A fresh local-entropy take on every render; same settings do not promise the same audio.",
      domain: "SPECTRAL/E8-STUDIO/CREATIVE/v1"
    })
  });

  const EXPORT_PROFILES = Object.freeze({
    sketch: Object.freeze({
      id: "sketch",
      name: "Sketch · 44.1 kHz",
      version: "1.0.0",
      sample_rate: 44100,
      channels: 2,
      bit_depth: 16,
      ceiling_q15: 27570,
      ceiling_dbfs: "-1.50",
      fade_in_ms: 80,
      fade_out_ms: 180,
      remove_dc: true,
      normalize: true
    }),
    studio: Object.freeze({
      id: "studio",
      name: "Studio · 48 kHz",
      version: "1.0.0",
      sample_rate: 48000,
      channels: 2,
      bit_depth: 16,
      ceiling_q15: 29204,
      ceiling_dbfs: "-1.00",
      fade_in_ms: 300,
      fade_out_ms: 800,
      remove_dc: true,
      normalize: true
    }),
    daw_headroom: Object.freeze({
      id: "daw_headroom",
      name: "DAW Headroom · 48 kHz",
      version: "1.0.0",
      sample_rate: 48000,
      channels: 2,
      bit_depth: 16,
      ceiling_q15: 16422,
      ceiling_dbfs: "-6.00",
      fade_in_ms: 300,
      fade_out_ms: 1000,
      remove_dc: true,
      normalize: true
    }),
    raw_geometry: Object.freeze({
      id: "raw_geometry",
      name: "Raw Geometry · 48 kHz",
      version: "1.0.0",
      sample_rate: 48000,
      channels: 2,
      bit_depth: 16,
      ceiling_q15: 30928,
      ceiling_dbfs: "-0.50",
      fade_in_ms: 20,
      fade_out_ms: 80,
      remove_dc: false,
      normalize: false
    })
  });

  const DEFAULT_PARAMS = Object.freeze({
    duration_ms: 30000,
    seed_u32: 3907530800,
    mutation_index: 0,
    anchor_millihz: 110000,
    voice_count: 8,
    lattice: "phi_deep",
    path: "cartan_sweep",
    root_density: 12,
    control_rate_hz: 250,
    drift_millirad: 28,
    bloom_milli: 12,
    phase_gain_milli: 300,
    amplitude_gain_milli: 240,
    ternary_bias_milli: 120,
    wave_morph_milli: 480,
    triality_milli: 180,
    fractal_depth: 5,
    pulse_rate_millihz: 0,
    pulse_depth_milli: 0,
    spatial_mode: "torus_field",
    width_milli: 520,
    haas_micros: 9500,
    drive_milli: 1080,
    feedback_milli: 35,
    root_offset: 0,
    axis_gains_milli: Object.freeze([1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000])
  });

  const PRESETS = Object.freeze({
    deep_sweep: Object.freeze({
      name: "Deep 8D Sweep",
      description: "The 5.8–110 Hz φ ladder and gentle Cartan trajectory behind the long E8 space-sweep workflow.",
      values: Object.freeze({})
    }),
    open_d_field: Object.freeze({
      name: "Open D Field",
      description: "A warmer 432 Hz-derived D field for layering under industrial and dark-electronica sessions.",
      values: Object.freeze({
        anchor_millihz: 146832,
        lattice: "minor_field",
        path: "cartan_sweep",
        drift_millirad: 34,
        phase_gain_milli: 380,
        wave_morph_milli: 360,
        width_milli: 620,
        drive_milli: 1140
      })
    }),
    triality_fractal: Object.freeze({
      name: "Triality Fractal",
      description: "Three-lane phase exchange, φ-scaled modulation octaves, and restrained isochronic motion.",
      values: Object.freeze({
        anchor_millihz: 108000,
        lattice: "phi_centered",
        path: "triality_spiral",
        root_density: 20,
        drift_millirad: 42,
        bloom_milli: 18,
        phase_gain_milli: 520,
        amplitude_gain_milli: 310,
        wave_morph_milli: 540,
        triality_milli: 680,
        fractal_depth: 7,
        pulse_rate_millihz: 7854,
        pulse_depth_milli: 260,
        spatial_mode: "triality",
        width_milli: 720,
        drive_milli: 1160
      })
    }),
    qutrit_4d: Object.freeze({
      name: "Qutrit 4D",
      description: "A three-state core with slow fourth-dimensional weight rotation and sub-field reinforcement.",
      values: Object.freeze({
        voice_count: 4,
        anchor_millihz: 72000,
        lattice: "phi_centered",
        path: "qutrit_orbit",
        root_density: 30,
        drift_millirad: 22,
        bloom_milli: 9,
        phase_gain_milli: 440,
        amplitude_gain_milli: 380,
        ternary_bias_milli: 520,
        wave_morph_milli: 690,
        triality_milli: 760,
        fractal_depth: 6,
        pulse_rate_millihz: 7869,
        pulse_depth_milli: 180,
        spatial_mode: "qutrit4d",
        width_milli: 820,
        haas_micros: 7000,
        feedback_milli: 60
      })
    }),
    trinaural_orbit: Object.freeze({
      name: "Trinaural Orbit",
      description: "Three 120°-offset lanes distributed left, centre, and right with close pulse-rate motion.",
      values: Object.freeze({
        voice_count: 6,
        anchor_millihz: 96000,
        lattice: "phi_centered",
        path: "triality_spiral",
        root_density: 20,
        drift_millirad: 31,
        bloom_milli: 14,
        phase_gain_milli: 410,
        amplitude_gain_milli: 280,
        ternary_bias_milli: 360,
        wave_morph_milli: 430,
        triality_milli: 610,
        pulse_rate_millihz: 7854,
        pulse_depth_milli: 340,
        spatial_mode: "trinaural",
        width_milli: 900,
        haas_micros: 12000
      })
    }),
    coxeter_glass: Object.freeze({
      name: "Coxeter Glass",
      description: "A brighter Coxeter-like orbit with sparse roots, glassy partials, and slow recursive feedback.",
      values: Object.freeze({
        anchor_millihz: 220000,
        lattice: "e8_heights",
        path: "coxeter_orbit",
        root_density: 12,
        drift_millirad: 56,
        bloom_milli: 20,
        phase_gain_milli: 620,
        amplitude_gain_milli: 190,
        wave_morph_milli: 240,
        triality_milli: 390,
        fractal_depth: 8,
        spatial_mode: "torus_field",
        width_milli: 740,
        drive_milli: 1240,
        feedback_milli: 95
      })
    }),
    root_cloud: Object.freeze({
      name: "240-Root Cloud",
      description: "Dense use of the whole root set, wider modulation, and a slow root-directed walk.",
      values: Object.freeze({
        anchor_millihz: 88000,
        lattice: "harmonic",
        path: "root_walk",
        root_density: 30,
        control_rate_hz: 200,
        drift_millirad: 48,
        bloom_milli: 28,
        phase_gain_milli: 760,
        amplitude_gain_milli: 420,
        wave_morph_milli: 620,
        triality_milli: 460,
        fractal_depth: 7,
        spatial_mode: "orbit",
        width_milli: 860,
        drive_milli: 1320,
        feedback_milli: 120
      })
    }),
    quiet_lattice: Object.freeze({
      name: "Quiet Lattice",
      description: "Near-mono, low-bloom geometry for clean source stems and later processing.",
      values: Object.freeze({
        anchor_millihz: 110000,
        lattice: "phi_deep",
        path: "cartan_sweep",
        root_density: 12,
        drift_millirad: 18,
        bloom_milli: 0,
        phase_gain_milli: 190,
        amplitude_gain_milli: 120,
        wave_morph_milli: 180,
        triality_milli: 0,
        pulse_depth_milli: 0,
        spatial_mode: "near_mono",
        width_milli: 120,
        haas_micros: 0,
        drive_milli: 1000,
        feedback_milli: 0
      })
    })
  });

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
    for (let index = 0; index < escaped.length; index += 1) output[index] = escaped.charCodeAt(index);
    return output;
  }

  function concatBytes(parts) {
    let length = 0;
    for (const part of parts) length += part.length;
    const output = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) { output.set(part, offset); offset += part.length; }
    return output;
  }

  function toHex(bytes) {
    let output = "";
    for (let index = 0; index < bytes.length; index += 1) output += bytes[index].toString(16).padStart(2, "0");
    return output;
  }

  function fromHex(hex) {
    if (typeof hex !== "string" || hex.length % 2 || !/^[0-9a-f]+$/i.test(hex)) throw new TypeError("Invalid hexadecimal string");
    const output = new Uint8Array(hex.length / 2);
    for (let index = 0; index < output.length; index += 1) output[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    return output;
  }

  function rotr(value, bits) { return ((value >>> bits) | (value << (32 - bits))) >>> 0; }

  function sha256Bytes(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const bitLength = bytes.length * 8;
    const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
    const padded = new Uint8Array(paddedLength);
    padded.set(bytes);
    padded[bytes.length] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
    view.setUint32(paddedLength - 4, bitLength >>> 0, false);
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    const words = new Uint32Array(64);
    for (let offset = 0; offset < paddedLength; offset += 64) {
      for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false);
      for (let index = 16; index < 64; index += 1) {
        const x = words[index - 15], y = words[index - 2];
        const s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
        const s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
        words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let index = 0; index < 64; index += 1) {
        const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const choose = (e & f) ^ (~e & g);
        const temp1 = (h + s1 + choose + SHA256_K[index] + words[index]) >>> 0;
        const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const majority = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (s0 + majority) >>> 0;
        h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
    }
    const digest = new Uint8Array(32);
    const digestView = new DataView(digest.buffer);
    [h0,h1,h2,h3,h4,h5,h6,h7].forEach((word, index) => digestView.setUint32(index * 4, word, false));
    return digest;
  }

  function sha256Hex(input) { return toHex(sha256Bytes(input)); }

  function validateCanonical(value, seen) {
    if (value === null || typeof value === "string" || typeof value === "boolean") return;
    if (typeof value === "number") {
      if (!Number.isSafeInteger(value) || Object.is(value, -0)) throw new TypeError("Canonical JSON accepts safe integers only");
      return;
    }
    if (typeof value !== "object") throw new TypeError("Unsupported canonical value");
    if (seen.has(value)) throw new TypeError("Canonical JSON cannot contain a cycle");
    seen.add(value);
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        if (!(index in value)) throw new TypeError("Canonical JSON cannot contain sparse arrays");
        validateCanonical(value[index], seen);
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
    const output = Object.create(null);
    for (const key of Object.keys(value).sort()) output[key] = canonicalize(value[key]);
    return output;
  }

  function stableStringify(value) { return JSON.stringify(canonicalize(value)); }
  function prettyStable(value) { return JSON.stringify(canonicalize(value), null, 2) + "\n"; }
  function hashDomain(domain, bytes) { return sha256Hex(concatBytes([utf8(domain), new Uint8Array([0]), bytes instanceof Uint8Array ? bytes : utf8(String(bytes))])); }
  function hashCanonical(domain, value) { return hashDomain(domain, utf8(stableStringify(value))); }

  function decimalToScaled(raw, scale) {
    const text = String(raw).trim();
    const match = /^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text);
    if (!match) throw new TypeError("Invalid decimal: " + text);
    const negative = match[1] === "-";
    const fraction = match[3] || "";
    const exponent = parseInt(match[4] || "0", 10) - fraction.length;
    if (Math.abs(exponent) > 40) throw new RangeError("Decimal exponent is outside the accepted range");
    let numerator = BigInt((match[2] + fraction).replace(/^0+(?=\d)/, ""));
    let denominator = 1n;
    if (exponent >= 0) numerator *= 10n ** BigInt(exponent);
    else denominator = 10n ** BigInt(-exponent);
    numerator *= BigInt(scale);
    let quotient = numerator / denominator;
    if ((numerator % denominator) * 2n >= denominator) quotient += 1n;
    if (negative) quotient = -quotient;
    const output = Number(quotient);
    if (!Number.isSafeInteger(output)) throw new RangeError("Scaled decimal exceeds the safe-integer range");
    return output;
  }

  function rotl32(value, bits) {
    const amount = bits & 31;
    return ((value << amount) | (value >>> ((32 - amount) & 31))) >>> 0;
  }

  class Xoshiro128ss {
    constructor(seedBytes) {
      if (!(seedBytes instanceof Uint8Array) || seedBytes.length < 16) throw new TypeError("Xoshiro requires sixteen seed bytes");
      const view = new DataView(seedBytes.buffer, seedBytes.byteOffset, seedBytes.byteLength);
      this.s = new Uint32Array([view.getUint32(0, false), view.getUint32(4, false), view.getUint32(8, false), view.getUint32(12, false)]);
      if ((this.s[0] | this.s[1] | this.s[2] | this.s[3]) === 0) this.s[0] = 0x9e3779b9;
    }
    nextUint32() {
      const s = this.s;
      const result = Math.imul(rotl32(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0;
      const t = (s[1] << 9) >>> 0;
      s[2] = (s[2] ^ s[0]) >>> 0; s[3] = (s[3] ^ s[1]) >>> 0;
      s[1] = (s[1] ^ s[2]) >>> 0; s[0] = (s[0] ^ s[3]) >>> 0;
      s[2] = (s[2] ^ t) >>> 0; s[3] = rotl32(s[3], 11);
      return result;
    }
    nextFloat() { return this.nextUint32() / 4294967296; }
    nextSigned() { return this.nextFloat() * 2 - 1; }
  }

  function createPrng(identityHex, lane) {
    const bytes = hashDomain("SPECTRAL/E8-STUDIO/PRNG/v1/" + String(lane || "main"), fromHex(identityHex));
    return new Xoshiro128ss(fromHex(bytes));
  }

  function creativeEntropy() {
    const bytes = new Uint8Array(32);
    let source = "crypto.getRandomValues";
    if (global.crypto && typeof global.crypto.getRandomValues === "function") global.crypto.getRandomValues(bytes);
    else {
      source = "Math.random+clock-fallback";
      for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
      const clock = utf8(String(Date.now()) + ":" + String(global.performance && performance.now ? performance.now() : 0));
      bytes.set(sha256Bytes(concatBytes([bytes, clock])).slice(0, 32));
    }
    return { hex: toHex(bytes), source };
  }

  function runtimeFingerprint() {
    const nav = typeof navigator === "object" ? navigator : {};
    const core = {
      app_version: APP.version,
      language: String(nav.language || "unknown"),
      platform: String(nav.platform || "unknown"),
      user_agent: String(nav.userAgent || "unknown"),
      hardware_concurrency: Number.isSafeInteger(nav.hardwareConcurrency) ? nav.hardwareConcurrency : 0,
      float_math_probe: [Math.sin(1), Math.cos(1), Math.tanh(1), Math.sqrt(5)].map(value => value.toPrecision(17)).join("|")
    };
    return { core, hash: hashCanonical("SPECTRAL/E8-STUDIO/RUNTIME/v1", core) };
  }

  function generateRootsDoubled() {
    const roots = [];
    for (let i = 0; i < 8; i += 1) {
      for (let j = i + 1; j < 8; j += 1) {
        for (const a of [-2, 2]) for (const b of [-2, 2]) {
          const root = new Int8Array(8);
          root[i] = a; root[j] = b; roots.push(root);
        }
      }
    }
    for (let mask = 0; mask < 256; mask += 1) {
      let minus = 0;
      const root = new Int8Array(8);
      for (let axis = 0; axis < 8; axis += 1) {
        if ((mask >>> axis) & 1) { root[axis] = -1; minus += 1; }
        else root[axis] = 1;
      }
      if (minus % 2 === 0) roots.push(root);
    }
    if (roots.length !== 240) throw new Error("E8 root generator invariant failed");
    return Object.freeze(roots);
  }

  const ROOTS_DOUBLED = generateRootsDoubled();
  const ROOTS_FLOAT = Object.freeze(ROOTS_DOUBLED.map(root => {
    const scale = 1 / (2 * Math.sqrt(2));
    return Object.freeze(Array.from(root, value => value * scale));
  }));

  function sparseRootIndices(voice, count, offset) {
    const output = new Int16Array(count);
    const stride = Math.max(1, Math.floor(240 / count));
    const start = ((voice * 17 + offset) % 240 + 240) % 240;
    for (let index = 0; index < count; index += 1) output[index] = (start + index * stride) % 240;
    return output;
  }

  function mergeParams(overrides) {
    const output = {};
    for (const key of Object.keys(DEFAULT_PARAMS)) {
      const value = Object.prototype.hasOwnProperty.call(overrides || {}, key) ? overrides[key] : DEFAULT_PARAMS[key];
      output[key] = Array.isArray(value) ? value.slice() : value;
    }
    return output;
  }

  function clampInteger(value, minimum, maximum, name) {
    if (!Number.isSafeInteger(value)) throw new TypeError((name || "Value") + " must be a safe integer");
    return Math.max(minimum, Math.min(maximum, value));
  }

  function validateParams(input) {
    const p = mergeParams(input);
    p.duration_ms = clampInteger(p.duration_ms, 250, 120000, "Duration");
    p.seed_u32 = clampInteger(p.seed_u32, 0, 0xffffffff, "Seed") >>> 0;
    p.mutation_index = clampInteger(p.mutation_index, 0, 0x7fffffff, "Mutation index");
    p.anchor_millihz = clampInteger(p.anchor_millihz, 8000, 4000000, "Anchor frequency");
    p.voice_count = clampInteger(p.voice_count, 3, 8, "Voice count");
    if (!["phi_deep","phi_centered","harmonic","minor_field","e8_heights"].includes(p.lattice)) throw new RangeError("Unknown lattice");
    if (!["cartan_sweep","coxeter_orbit","triality_spiral","qutrit_orbit","root_walk"].includes(p.path)) throw new RangeError("Unknown path");
    if (![8,12,20,30].includes(p.root_density)) throw new RangeError("Root density must be 8, 12, 20, or 30");
    p.control_rate_hz = clampInteger(p.control_rate_hz, 100, 500, "Control rate");
    p.drift_millirad = clampInteger(p.drift_millirad, 0, 240, "Cartan drift");
    p.bloom_milli = clampInteger(p.bloom_milli, 0, 1000, "Entropy bloom");
    p.phase_gain_milli = clampInteger(p.phase_gain_milli, 0, 2000, "Phase gain");
    p.amplitude_gain_milli = clampInteger(p.amplitude_gain_milli, 0, 1200, "Amplitude gain");
    p.ternary_bias_milli = clampInteger(p.ternary_bias_milli, -1000, 1000, "Ternary bias");
    p.wave_morph_milli = clampInteger(p.wave_morph_milli, 0, 1000, "Wave morph");
    p.triality_milli = clampInteger(p.triality_milli, 0, 1000, "Triality");
    p.fractal_depth = clampInteger(p.fractal_depth, 1, 8, "Fractal depth");
    p.pulse_rate_millihz = clampInteger(p.pulse_rate_millihz, 0, 30000, "Pulse rate");
    p.pulse_depth_milli = clampInteger(p.pulse_depth_milli, 0, 1000, "Pulse depth");
    if (!["near_mono","torus_field","orbit","triality","trinaural","qutrit4d"].includes(p.spatial_mode)) throw new RangeError("Unknown spatial mode");
    p.width_milli = clampInteger(p.width_milli, 0, 1000, "Stereo width");
    p.haas_micros = clampInteger(p.haas_micros, 0, 30000, "Haas delay");
    p.drive_milli = clampInteger(p.drive_milli, 250, 2500, "Drive");
    p.feedback_milli = clampInteger(p.feedback_milli, 0, 350, "Feedback");
    p.root_offset = clampInteger(p.root_offset, 0, 239, "Root offset");
    if (!Array.isArray(p.axis_gains_milli) || p.axis_gains_milli.length !== 8) throw new RangeError("Eight axis gains are required");
    p.axis_gains_milli = p.axis_gains_milli.map((value, index) => clampInteger(value, 0, 1500, "Axis " + (index + 1) + " gain"));
    return p;
  }

  global.E8STUDIO = {
    APP, MODES, MODE_META, EXPORT_PROFILES, DEFAULT_PARAMS, PRESETS,
    Core: {
      utf8, concatBytes, toHex, fromHex, sha256Bytes, sha256Hex,
      stableStringify, prettyStable, hashDomain, hashCanonical,
      decimalToScaled, rotl32, Xoshiro128ss, createPrng,
      creativeEntropy, runtimeFingerprint, ROOTS_DOUBLED, ROOTS_FLOAT,
      sparseRootIndices, mergeParams, validateParams, clampInteger
    },
    Audio: {}, Engine: {}, Provenance: {}, Visuals: {}, UI: {},
    state: { currentJob: null, renderAbort: null, scenes: { A: null, B: null }, comparisons: { A: null, B: null } }
  };
})(window);
