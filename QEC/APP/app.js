(function () {
  "use strict";

  var VERSION = "1.0.0";
  var PROTOCOL = "spectral-qec-render-commit-reveal-v1";
  var SAMPLE_RATE = 44100;

  var STATES = {
    zero: { name: "|0⟩", radix: 2, qudits: 1, root: 50, note: "Computational ground-state signature.", amplitudes: [[1, 0], [0, 0]] },
    one: { name: "|1⟩", radix: 2, qudits: 1, root: 53, note: "Computational excited-state signature.", amplitudes: [[0, 0], [1, 0]] },
    plus: { name: "|+⟩", radix: 2, qudits: 1, root: 55, note: "Equal X-basis superposition signature.", amplitudes: [[0.7071, 0], [0.7071, 0]] },
    bell_phi_plus: { name: "Bell Φ+", radix: 2, qudits: 2, root: 50, note: "Even-parity Bell signature: (|00⟩ + |11⟩)/√2.", amplitudes: [[0.7071, 0], [0, 0], [0, 0], [0.7071, 0]] },
    bell_phi_minus: { name: "Bell Φ−", radix: 2, qudits: 2, root: 51, note: "Phase-inverted even-parity Bell signature.", amplitudes: [[0.7071, 0], [0, 0], [0, 0], [-0.7071, 0]] },
    bell_psi_plus: { name: "Bell Ψ+", radix: 2, qudits: 2, root: 53, note: "Odd-parity Bell signature: (|01⟩ + |10⟩)/√2.", amplitudes: [[0, 0], [0.7071, 0], [0.7071, 0], [0, 0]] },
    bell_psi_minus: { name: "Bell Ψ−", radix: 2, qudits: 2, root: 54, note: "Antisymmetric singlet-state signature.", amplitudes: [[0, 0], [0.7071, 0], [-0.7071, 0], [0, 0]] },
    ghz3: { name: "GHZ₃", radix: 2, qudits: 3, root: 45, note: "Three-qubit global-parity signature: (|000⟩ + |111⟩)/√2.", amplitudes: [[0.7071,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0.7071,0]] },
    w3: { name: "W₃", radix: 2, qudits: 3, root: 47, note: "Single-excitation tripartite signature.", amplitudes: [[0,0],[0.57735,0],[0.57735,0],[0,0],[0.57735,0],[0,0],[0,0],[0,0]] },
    qutrit_fourier: { name: "Qutrit Fourier", radix: 3, qudits: 1, root: 48, note: "Equal three-level phase-lane signature.", amplitudes: [[0.57735,0],[-0.288675,0.5],[-0.288675,-0.5]] }
  };

  function row(label, paulis) {
    var map = { I: 0, X: 1, Z: 2, Y: 3 };
    return { label: label, operators: paulis.split("").map(function (p) { return map[p]; }) };
  }

  var CODES = {
    bell_observer: {
      name: "Bell parity observer", n: 2, k: 1, d: 1, radix: 2,
      note: "Two-body parity observer for hearing Bell-state channel changes; not a full fault-tolerant code.",
      checks: [row("ZZ", "ZZ"), row("XX", "XX")]
    },
    ghz_observer: {
      name: "GHZ parity observer", n: 3, k: 1, d: 1, radix: 2,
      note: "Pair-parity and global-phase checks for a three-qubit GHZ signature.",
      checks: [row("Z₀Z₁", "ZZI"), row("Z₁Z₂", "IZZ"), row("X⊗3", "XXX")]
    },
    repetition_bit_3: {
      name: "3-qubit bit-flip code", n: 3, k: 1, d: 3, radix: 2,
      note: "Repetition-code projection correcting a single X error.",
      checks: [row("Z₀Z₁", "ZZI"), row("Z₁Z₂", "IZZ")]
    },
    repetition_phase_3: {
      name: "3-qubit phase-flip code", n: 3, k: 1, d: 3, radix: 2,
      note: "Hadamard-basis repetition projection correcting a single Z error.",
      checks: [row("X₀X₁", "XXI"), row("X₁X₂", "IXX")]
    },
    perfect_5: {
      name: "[[5,1,3]] perfect code", n: 5, k: 1, d: 3, radix: 2,
      note: "Five-qubit cyclic stabilizer model with single-Pauli lookup recovery.",
      checks: [row("XZZXI", "XZZXI"), row("IXZZX", "IXZZX"), row("XIXZZ", "XIXZZ"), row("ZXIXZ", "ZXIXZ")]
    },
    steane_7: {
      name: "Steane [[7,1,3]]", n: 7, k: 1, d: 3, radix: 2,
      note: "CSS Hamming-code projection with paired X/Z stabilizer checks.",
      checks: [
        row("IIIXXXX", "IIIXXXX"), row("IXXIIXX", "IXXIIXX"), row("XIXIXIX", "XIXIXIX"),
        row("IIIZZZZ", "IIIZZZZ"), row("IZZ IIZZ".replace(/ /g, ""), "IZZIIZZ"), row("ZIZIZIZ", "ZIZIZIZ")
      ]
    },
    surface_d3_projection: {
      name: "3×3 surface CSS projection", n: 9, k: 1, d: 3, radix: 2,
      note: "Compact planar CSS check projection for audible syndrome-flow experiments.",
      checks: [
        row("X p0", "XXIXXIIII"), row("X p1", "IXXIXXIII"), row("X p2", "IIIXXIXXI"), row("X p3", "IIIIXXIXX"),
        row("Z s0", "ZZIZZIIII"), row("Z s1", "IZZIZZIII"), row("Z s2", "IIIZZIZZI"), row("Z s3", "IIIIZZIZZ")
      ]
    },
    qldpc_12_projection: {
      name: "Sparse QLDPC/Tanner projection", n: 12, k: 2, d: 3, radix: 2,
      note: "Sparse twelve-node Tanner graph used as an exploratory QLDPC event projection.",
      checks: [
        row("X0", "XIIXIIXIIXII"), row("X1", "IXIIXIIXIIXI"), row("X2", "IIXIIXIIXIIX"),
        row("X3", "XXIIIIXXIIII"), row("Z0", "ZIIZIIZIIZII"), row("Z1", "IZIIZIIZIIZI"),
        row("Z2", "IIZIIZIIZIIZ"), row("Z3", "ZZIIIIZZIIII")
      ]
    },
    qutrit_repetition_3: {
      name: "3-qutrit shift code", n: 3, k: 1, d: 3, radix: 3,
      note: "Modulo-three repetition projection for X₃ shift errors.",
      checks: [{ label: "q0−q1", coefficients: [1, 2, 0] }, { label: "q1−q2", coefficients: [0, 1, 2] }]
    }
  };

  var NOISE = {
    bit_flip: { name: "Bit-flip X", note: "Independent Pauli-X events." },
    phase_flip: { name: "Phase-flip Z", note: "Independent Pauli-Z events." },
    depolarizing: { name: "Depolarizing X/Y/Z", note: "Equal deterministic selection among X, Y, and Z." },
    biased_xz: { name: "Biased X/Z", note: "X-dominant channel with a lower Z component." },
    correlated_burst: { name: "Correlated burst", note: "Seeded neighbouring errors create audible spatial bursts." },
    erasure_projection: { name: "Erasure projection", note: "Known-location X/Z erasure proxy." },
    qutrit_shift: { name: "Qutrit shift X₃", note: "Modulo-three +1/+2 shift events." }
  };

  var DECODERS = {
    minimum_weight: { name: "Minimum-weight lookup", note: "Exact single-site syndrome lookup, then deterministic greedy descent." },
    syndrome_descent: { name: "Iterative syndrome descent", note: "Chooses the lowest-index action that most reduces syndrome weight." },
    observe_only: { name: "Observe only", note: "Reports checks without applying a correction." },
    mod3_lookup: { name: "Modulo-three lookup", note: "Greedy qutrit shift cancellation over GF(3)." }
  };

  var PRESETS = {
    bell: { state: "bell_phi_plus", code: "bell_observer", noise: "bit_flip", decoder: "minimum_weight", rate: 12, cycles: 12, texture: "harmonic_glass", tempo: 132 },
    ghz: { state: "ghz3", code: "ghz_observer", noise: "correlated_burst", decoder: "minimum_weight", rate: 16, cycles: 15, texture: "dark_subspace", tempo: 135 },
    steane: { state: "plus", code: "steane_7", noise: "depolarizing", decoder: "minimum_weight", rate: 9, cycles: 16, texture: "harmonic_glass", tempo: 140 },
    surface: { state: "bell_phi_plus", code: "surface_d3_projection", noise: "biased_xz", decoder: "syndrome_descent", rate: 11, cycles: 18, texture: "industrial_pauli", tempo: 140 },
    qldpc: { state: "ghz3", code: "qldpc_12_projection", noise: "correlated_burst", decoder: "syndrome_descent", rate: 8, cycles: 20, texture: "mos_lattice", tempo: 147 },
    qutrit: { state: "qutrit_fourier", code: "qutrit_repetition_3", noise: "qutrit_shift", decoder: "mod3_lookup", rate: 14, cycles: 15, texture: "mos_lattice", tempo: 147 }
  };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function int(v, fallback) {
    var n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
  }
  function num(v, fallback) {
    var n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  function textBytes(s) { return new TextEncoder().encode(String(s)); }
  function concatBytes(parts) {
    var size = parts.reduce(function (n, p) { return n + p.length; }, 0);
    var out = new Uint8Array(size), offset = 0;
    parts.forEach(function (p) { out.set(p, offset); offset += p.length; });
    return out;
  }
  function canonical(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
    return "{" + Object.keys(value).sort().map(function (k) { return JSON.stringify(k) + ":" + canonical(value[k]); }).join(",") + "}";
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
  function sha256Hex(input) {
    var bytes = typeof input === "string" ? textBytes(input) : new Uint8Array(input);
    var K = [
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ];
    var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    var bitLenHi = Math.floor(bytes.length / 0x20000000);
    var bitLenLo = (bytes.length << 3) >>> 0;
    var paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
    var msg = new Uint8Array(paddedLength);
    msg.set(bytes); msg[bytes.length] = 0x80;
    var dv = new DataView(msg.buffer);
    dv.setUint32(paddedLength - 8, bitLenHi, false);
    dv.setUint32(paddedLength - 4, bitLenLo, false);
    var w = new Uint32Array(64);
    for (var off = 0; off < paddedLength; off += 64) {
      for (var i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
      for (i = 16; i < 64; i++) {
        var s0 = (rotr(w[i-15],7) ^ rotr(w[i-15],18) ^ (w[i-15] >>> 3)) >>> 0;
        var s1 = (rotr(w[i-2],17) ^ rotr(w[i-2],19) ^ (w[i-2] >>> 10)) >>> 0;
        w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0;
      }
      var a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
      for (i = 0; i < 64; i++) {
        var S1 = (rotr(e,6) ^ rotr(e,11) ^ rotr(e,25)) >>> 0;
        var ch = ((e & f) ^ (~e & g)) >>> 0;
        var t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
        var S0 = (rotr(a,2) ^ rotr(a,13) ^ rotr(a,22)) >>> 0;
        var maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
        var t2 = (S0 + maj) >>> 0;
        h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
      }
      H[0]=(H[0]+a)>>>0;H[1]=(H[1]+b)>>>0;H[2]=(H[2]+c)>>>0;H[3]=(H[3]+d)>>>0;
      H[4]=(H[4]+e)>>>0;H[5]=(H[5]+f)>>>0;H[6]=(H[6]+g)>>>0;H[7]=(H[7]+h)>>>0;
    }
    return H.map(function (x) { return x.toString(16).padStart(8, "0"); }).join("");
  }

  function fnv1a(s) {
    var h = 0x811c9dc5;
    var bytes = textBytes(s);
    for (var i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function RNG(seed) { this.state = fnv1a(seed) || 0x9e3779b9; }
  RNG.prototype.next = function () {
    var x = this.state;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.state = x >>> 0;
    return this.state;
  };
  RNG.prototype.below = function (n) { return this.next() % n; };

  function normalizeSettings(s) {
    var code = CODES[s.code] ? s.code : "steane_7";
    var state = STATES[s.state] ? s.state : "bell_phi_plus";
    var errorRate = s.errorRate != null ? s.errorRate : (s.errorPermille != null ? Number(s.errorPermille) / 10 : 12);
    var tuning = s.tuning != null ? s.tuning : s.tuningHz;
    var tempo = s.tempo != null ? s.tempo : s.tempoBpm;
    var duration = s.duration != null ? s.duration : (s.durationMillis != null ? Number(s.durationMillis) / 1000 : 8);
    var width = s.width != null ? s.width : s.stereoWidth;
    var drone = s.drone != null ? s.drone : s.stateDrone;
    if (CODES[code].radix === 3) state = "qutrit_fourier";
    if (CODES[code].radix === 3 && s.noise !== "qutrit_shift") s.noise = "qutrit_shift";
    return {
      protocol: PROTOCOL,
      mode: s.mode === "replay_safe" ? "replay_safe" : "canonical_strict",
      state: state,
      code: code,
      noise: NOISE[s.noise] ? s.noise : "depolarizing",
      decoder: DECODERS[s.decoder] ? s.decoder : "minimum_weight",
      errorPermille: clamp(Math.round(num(errorRate, 12) * 10), 0, 750),
      cycles: clamp(int(s.cycles, 16), 1, 64),
      iterations: clamp(int(s.iterations, 8), 1, 32),
      mutation: int(s.mutation, 0) >>> 0,
      texture: ["harmonic_glass","mos_lattice","industrial_pauli","dark_subspace"].indexOf(s.texture) >= 0 ? s.texture : "harmonic_glass",
      tuningHz: clamp(int(tuning, 432), 400, 480),
      tempoBpm: clamp(int(tempo, 140), 40, 240),
      durationMillis: clamp(Math.round(num(duration, 8) * 1000), 250, 30000),
      stereoWidth: clamp(int(width, 72), 0, 100),
      intensity: clamp(int(s.intensity, 70), 10, 100),
      stateDrone: drone !== false,
      sampleRate: SAMPLE_RATE,
      seed: "qec-lab:" + (int(s.mutation, 0) >>> 0)
    };
  }

  function anticommutes(error, stabilizer) {
    var a = ((error & 1) && (stabilizer & 2)) ? 1 : 0;
    var b = ((error & 2) && (stabilizer & 1)) ? 1 : 0;
    return a ^ b;
  }
  function syndrome(errors, model) {
    if (model.radix === 3) {
      return model.checks.map(function (check) {
        var sum = 0;
        check.coefficients.forEach(function (c, i) { sum += c * (errors[i] || 0); });
        return ((sum % 3) + 3) % 3;
      });
    }
    return model.checks.map(function (check) {
      var parity = 0;
      check.operators.forEach(function (op, i) { parity ^= anticommutes(errors[i] || 0, op); });
      return parity;
    });
  }
  function syndromeWeight(values) { return values.reduce(function (n, v) { return n + (v ? 1 : 0); }, 0); }
  function applyCorrection(errors, correction, radix) {
    return errors.map(function (e, i) { return radix === 3 ? (e + correction[i]) % 3 : e ^ correction[i]; });
  }
  function sameArray(a, b) { return a.length === b.length && a.every(function (v, i) { return v === b[i]; }); }

  function decode(errors, model, decoder, maxIterations) {
    var correction = new Array(model.n).fill(0);
    var initial = syndrome(errors, model);
    if (decoder === "observe_only" || syndromeWeight(initial) === 0) return { correction: correction, residual: errors.slice(), iterations: 0 };
    var radix = model.radix;
    var candidates = [];
    for (var q = 0; q < model.n; q++) {
      var max = radix === 3 ? 2 : 3;
      for (var p = 1; p <= max; p++) {
        var c = new Array(model.n).fill(0); c[q] = p;
        candidates.push({ q: q, p: p, vector: c });
      }
    }
    if (decoder === "minimum_weight" || decoder === "mod3_lookup") {
      for (var i = 0; i < candidates.length; i++) {
        var r = applyCorrection(errors, candidates[i].vector, radix);
        if (syndromeWeight(syndrome(r, model)) === 0) {
          return { correction: candidates[i].vector, residual: r, iterations: 1 };
        }
      }
    }
    var current = errors.slice(), iterations = 0;
    while (iterations < maxIterations) {
      var currentWeight = syndromeWeight(syndrome(current, model));
      if (!currentWeight) break;
      var best = null, bestWeight = currentWeight;
      for (i = 0; i < candidates.length; i++) {
        var trial = applyCorrection(current, candidates[i].vector, radix);
        var weight = syndromeWeight(syndrome(trial, model));
        if (weight < bestWeight) { bestWeight = weight; best = candidates[i]; }
      }
      if (!best) break;
      correction[best.q] = radix === 3 ? (correction[best.q] + best.p) % 3 : correction[best.q] ^ best.p;
      current = applyCorrection(errors, correction, radix);
      iterations++;
    }
    return { correction: correction, residual: current, iterations: iterations };
  }

  function injectedError(noise, radix, rng) {
    if (radix === 3 || noise === "qutrit_shift") return 1 + rng.below(2);
    if (noise === "bit_flip") return 1;
    if (noise === "phase_flip") return 2;
    if (noise === "depolarizing") return 1 + rng.below(3);
    if (noise === "biased_xz") return rng.below(100) < 76 ? 1 : 2;
    if (noise === "erasure_projection") return rng.below(2) ? 1 : 2;
    return 1 + rng.below(3);
  }

  function pauliName(v, radix) {
    if (radix === 3) return v === 0 ? "I" : "X₃^" + v;
    return ["I","X","Z","Y"][v] || "I";
  }
  function pauliValue(v, radix) {
    if (typeof v === "number") return radix === 3 ? ((v % 3) + 3) % 3 : (v & 3);
    var s = String(v || "").trim().toUpperCase();
    if (radix === 3) {
      if (s.indexOf("2") >= 0) return 2;
      return s === "I" || s === "0" || !s ? 0 : 1;
    }
    return { I:0, X:1, Z:2, Y:3, "0":0, "1":1, "2":2, "3":3 }[s] || 0;
  }

  function simulate(settings) {
    var model = CODES[settings.code], rng = new RNG(canonical(settings));
    var cycles = [], events = [];
    for (var cycle = 0; cycle < settings.cycles; cycle++) {
      var errors = new Array(model.n).fill(0);
      if (settings.noise === "correlated_burst" && rng.below(1000) < settings.errorPermille) {
        var centre = rng.below(model.n), span = 2 + rng.below(Math.min(3, model.n));
        for (var b = 0; b < span; b++) errors[(centre + b) % model.n] = injectedError(settings.noise, model.radix, rng);
      } else {
        for (var q = 0; q < model.n; q++) {
          if (rng.below(1000) < settings.errorPermille) errors[q] = injectedError(settings.noise, model.radix, rng);
        }
      }
      var before = syndrome(errors, model);
      var decoded = decode(errors, model, settings.decoder, settings.iterations);
      var after = syndrome(decoded.residual, model);
      var cycleRecord = {
        cycle: cycle, errors: errors, syndrome: before, correction: decoded.correction,
        residual: decoded.residual, residualSyndrome: after, iterations: decoded.iterations
      };
      cycles.push(cycleRecord);
      var emitted = false;
      for (q = 0; q < model.n; q++) {
        if (errors[q] || decoded.correction[q] || decoded.residual[q]) {
          events.push({
            cycle: cycle, qubit: q, error: pauliName(errors[q], model.radix),
            syndrome: before.join(model.radix === 3 ? "" : ""),
            correction: pauliName(decoded.correction[q], model.radix),
            residual: pauliName(decoded.residual[q], model.radix)
          });
          emitted = true;
        }
      }
      if (!emitted) events.push({ cycle: cycle, qubit: -1, error: "I", syndrome: before.join(""), correction: "I", residual: "I" });
    }
    return { cycles: cycles, events: events, model: settings.code, radix: model.radix };
  }

  function splitDelimited(line, delimiter) {
    var out = [], field = "", quoted = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"') {
        if (quoted && line[i+1] === '"') { field += '"'; i++; }
        else quoted = !quoted;
      } else if (ch === delimiter && !quoted) { out.push(field.trim()); field = ""; }
      else field += ch;
    }
    out.push(field.trim());
    return out;
  }
  function parseDataset(text, filename) {
    var rows;
    if (/\.json$/i.test(filename || "") || String(text).trim()[0] === "[") {
      var parsed = JSON.parse(text);
      rows = Array.isArray(parsed) ? parsed : (parsed.events || parsed.rows);
      if (!Array.isArray(rows)) throw new Error("JSON must contain an array or an events array.");
    } else {
      var lines = String(text).split(/\r?\n/).filter(function (line) { return line.trim(); });
      if (lines.length < 2) throw new Error("Dataset requires a header and at least one event row.");
      var delimiter = lines[0].indexOf("\t") >= 0 ? "\t" : ",";
      var headers = splitDelimited(lines[0], delimiter).map(function (h) { return h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"); });
      rows = lines.slice(1).map(function (line) {
        var fields = splitDelimited(line, delimiter), obj = {};
        headers.forEach(function (h, i) { obj[h] = fields[i] == null ? "" : fields[i]; });
        return obj;
      });
    }
    var normalized = rows.map(function (r, index) {
      return {
        cycle: Math.max(0, int(r.cycle != null ? r.cycle : r.round, index)),
        qubit: Math.max(-1, int(r.qubit != null ? r.qubit : (r.site != null ? r.site : r.node), -1)),
        error: r.error != null ? r.error : (r.pauli != null ? r.pauli : "I"),
        syndrome: String(r.syndrome != null ? r.syndrome : (r.checks != null ? r.checks : "0")),
        correction: r.correction != null ? r.correction : (r.recovery != null ? r.recovery : "I"),
        residual: r.residual != null ? r.residual : (r.post_error != null ? r.post_error : "I")
      };
    });
    normalized.sort(function (a, b) { return a.cycle - b.cycle || a.qubit - b.qubit; });
    return normalized;
  }

  function datasetSimulation(settings, rows) {
    var model = CODES[settings.code], maxCycle = rows.reduce(function (m, r) { return Math.max(m, r.cycle); }, 0);
    var totalCycles = Math.max(settings.cycles, maxCycle + 1), cycles = [], events = [];
    for (var c = 0; c < totalCycles; c++) {
      var errors = new Array(model.n).fill(0), correction = new Array(model.n).fill(0), residual = new Array(model.n).fill(0);
      var group = rows.filter(function (r) { return r.cycle === c; });
      group.forEach(function (r) {
        if (r.qubit >= 0 && r.qubit < model.n) {
          errors[r.qubit] = pauliValue(r.error, model.radix);
          correction[r.qubit] = pauliValue(r.correction, model.radix);
          residual[r.qubit] = pauliValue(r.residual, model.radix);
        }
        events.push({
          cycle: r.cycle, qubit: r.qubit, error: pauliName(pauliValue(r.error, model.radix), model.radix),
          syndrome: String(r.syndrome), correction: pauliName(pauliValue(r.correction, model.radix), model.radix),
          residual: pauliName(pauliValue(r.residual, model.radix), model.radix)
        });
      });
      var syn = group.length ? String(group[0].syndrome).split("").map(function (x) { return int(x, 0); }) : syndrome(errors, model);
      cycles.push({ cycle:c, errors:errors, syndrome:syn, correction:correction, residual:residual, residualSyndrome:syndrome(residual,model), iterations:0 });
    }
    if (!events.length) throw new Error("Dataset contains no usable event rows.");
    return { cycles: cycles, events: events, model: settings.code, radix: model.radix };
  }

  var SEMITONE_Q24 = [16777216,17774841,18831878,19951728,21138115,22395026,23726789,25137453,26632374,28216119,29894017,31671772];
  function frequencyMilliHz(midi, tuning) {
    var delta = midi - 69, octave = Math.floor(delta / 12), note = ((delta % 12) + 12) % 12;
    var value = tuning * 1000 * SEMITONE_Q24[note] / 16777216;
    return Math.round(octave >= 0 ? value * Math.pow(2, octave) : value / Math.pow(2, -octave));
  }
  function phaseIncrement(freqMilliHz, sampleRate) {
    return Math.round(freqMilliHz * 4294967296 / (sampleRate * 1000)) >>> 0;
  }
  function waveSample(phase, kind, noiseState) {
    var top = phase >>> 16;
    var tri = top < 32768 ? top * 2 - 32768 : 98303 - top * 2;
    if (kind === "pulse") return top < 19000 ? 28000 : -15000;
    if (kind === "industrial") return ((top < 32768 ? 23000 : -23000) + (tri >> 2));
    if (kind === "dark") {
      noiseState.value ^= noiseState.value << 13; noiseState.value ^= noiseState.value >>> 17; noiseState.value ^= noiseState.value << 5;
      return (tri >> 1) + (((noiseState.value >>> 16) - 32768) >> 2);
    }
    return tri + ((top < 32768 ? 1 : -1) * 2500);
  }
  function textureWave(texture) {
    return texture === "mos_lattice" ? "pulse" : texture === "industrial_pauli" ? "industrial" : texture === "dark_subspace" ? "dark" : "glass";
  }
  function addTone(left, right, start, length, freq, gain, pan, kind, seed) {
    start = clamp(Math.trunc(start), 0, left.length);
    length = clamp(Math.trunc(length), 0, left.length - start);
    if (!length) return;
    var phase = fnv1a(seed), inc = phaseIncrement(freq, SAMPLE_RATE);
    var panQ = clamp(Math.round(pan * 32767), -32767, 32767);
    var gainL = Math.round(gain * (32767 - panQ) / 32767);
    var gainR = Math.round(gain * (32767 + panQ) / 32767);
    var attack = Math.max(1, Math.min(Math.round(SAMPLE_RATE * .012), Math.floor(length / 4)));
    var release = Math.max(1, Math.min(Math.round(SAMPLE_RATE * .04), Math.floor(length / 3)));
    var ns = { value: fnv1a(seed + ":noise") || 1 };
    for (var i = 0; i < length; i++) {
      var env = i < attack ? Math.floor(i * 32767 / attack) : (i > length - release ? Math.floor((length - i) * 32767 / release) : 32767);
      var sample = waveSample(phase, kind, ns);
      left[start+i] += Math.trunc(sample * gainL * env / 1073676289);
      right[start+i] += Math.trunc(sample * gainR * env / 1073676289);
      phase = (phase + inc) >>> 0;
    }
  }
  function eventValue(name, radix) { return pauliValue(name, radix); }

  function synthesize(settings, simulation) {
    var frames = Math.round(settings.sampleRate * settings.durationMillis / 1000);
    var left = new Int32Array(frames), right = new Int32Array(frames);
    var state = STATES[settings.state], wave = textureWave(settings.texture);
    var baseGain = Math.round(1900 * settings.intensity / 100);
    if (settings.stateDrone) {
      addTone(left,right,0,frames,frequencyMilliHz(state.root,settings.tuningHz),baseGain,-.22,wave,settings.seed+":drone0");
      addTone(left,right,0,frames,frequencyMilliHz(state.root+7,settings.tuningHz),Math.round(baseGain*.55),.18,"glass",settings.seed+":drone1");
      addTone(left,right,0,frames,frequencyMilliHz(state.root+12,settings.tuningHz),Math.round(baseGain*.28),0,"glass",settings.seed+":drone2");
    }
    var cycleFrames = frames / simulation.cycles.length;
    var beatFrames = settings.sampleRate * 60 / settings.tempoBpm;
    var gate = Math.max(500, Math.min(cycleFrames * .72, beatFrames * .32));
    var width = settings.stereoWidth / 100;
    simulation.cycles.forEach(function (cycle, ci) {
      var start = Math.floor(ci * cycleFrames);
      var synWeight = syndromeWeight(cycle.syndrome);
      if (synWeight) addTone(left,right,start,gate,frequencyMilliHz(state.root+19+synWeight*2,settings.tuningHz),Math.round(baseGain*1.5),0,"glass",settings.seed+":s:"+ci);
      cycle.errors.forEach(function (v, q) {
        if (!v) return;
        var pan = cycle.errors.length === 1 ? 0 : ((q/(cycle.errors.length-1))*2-1)*width;
        addTone(left,right,start+Math.floor(gate*.08*q),gate,frequencyMilliHz(state.root+12+q+(v*2),settings.tuningHz),Math.round(baseGain*2.5),pan,wave,settings.seed+":e:"+ci+":"+q);
      });
      cycle.correction.forEach(function (v, q) {
        if (!v) return;
        var pan = cycle.correction.length === 1 ? 0 : -((q/(cycle.correction.length-1))*2-1)*width;
        addTone(left,right,start+Math.floor(gate*.42),Math.floor(gate*.65),frequencyMilliHz(state.root+7+q,settings.tuningHz),Math.round(baseGain*1.7),pan,"glass",settings.seed+":c:"+ci+":"+q);
      });
      cycle.residual.forEach(function (v, q) {
        if (!v) return;
        var pan = cycle.residual.length === 1 ? 0 : ((q/(cycle.residual.length-1))*2-1)*width;
        addTone(left,right,start+Math.floor(gate*.58),Math.floor(gate*.9),frequencyMilliHz(state.root+1+q,settings.tuningHz),Math.round(baseGain*2.1),pan,"dark",settings.seed+":r:"+ci+":"+q);
      });
    });
    var pcm = new Int16Array(frames * 2);
    for (var i = 0; i < frames; i++) {
      pcm[i*2] = clamp(left[i], -32768, 32767);
      pcm[i*2+1] = clamp(right[i], -32768, 32767);
    }
    return pcm;
  }

  function wavBytes(pcm, sampleRate) {
    var out = new Uint8Array(44 + pcm.length * 2), dv = new DataView(out.buffer);
    function str(off, s) { for (var i=0;i<s.length;i++) out[off+i]=s.charCodeAt(i); }
    str(0,"RIFF"); dv.setUint32(4,out.length-8,true); str(8,"WAVE"); str(12,"fmt ");
    dv.setUint32(16,16,true); dv.setUint16(20,1,true); dv.setUint16(22,2,true); dv.setUint32(24,sampleRate,true);
    dv.setUint32(28,sampleRate*4,true); dv.setUint16(32,4,true); dv.setUint16(34,16,true); str(36,"data"); dv.setUint32(40,pcm.length*2,true);
    for (var p=0;p<pcm.length;p++) dv.setInt16(44+p*2,pcm[p],true);
    return out;
  }
  function summarize(sim) {
    var errors=0,syndromes=0,corrections=0,residuals=0,clean=0;
    sim.cycles.forEach(function (c) {
      errors += c.errors.filter(Boolean).length;
      syndromes += syndromeWeight(c.syndrome);
      corrections += c.correction.filter(Boolean).length;
      residuals += c.residual.filter(Boolean).length;
      if (!c.residual.some(Boolean)) clean++;
    });
    return { errors:errors, syndromeWeight:syndromes, corrections:corrections, residuals:residuals, cleanCycles:clean, cycles:sim.cycles.length };
  }

  function renderExperiment(input, dataset) {
    var settings = normalizeSettings(clone(input));
    var source = dataset && dataset.rows ? {
      kind: "local_dataset", name: dataset.name || "dataset", byteHash: dataset.byteHash || sha256Hex(canonical(dataset.rows)), rows: dataset.rows.length
    } : { kind: "generated_experiment", name: null, byteHash: null, rows: 0 };
    var sim = source.kind === "local_dataset" ? datasetSimulation(settings, dataset.rows) : simulate(settings);
    var pcm = synthesize(settings, sim), wav = wavBytes(pcm, settings.sampleRate), summary = summarize(sim);
    var recipe = {
      schema: "spectral-qec-recipe-v1", protocol: PROTOCOL, engineVersion: VERSION,
      settings: settings, source: source,
      mapping: {
        stateDrone: "selected state → sustained root/fifth/octave signature",
        errors: "error type + qubit → pitched transient and stereo site",
        syndrome: "check weight → upper-register pulse",
        corrections: "decoder action → resolving glass transient",
        residuals: "post-recovery error → dark semitone-offset tone"
      }
    };
    var eventDocument = { schema:"spectral-qec-event-stream-v1", code:settings.code, radix:sim.radix, events:sim.events };
    var hashes = {
      wav: sha256Hex(wav), eventStream: sha256Hex(canonical(eventDocument)), recipe: sha256Hex(canonical(recipe))
    };
    var receiptCore = {
      schema:"spectral-qec-observation-receipt-v1", protocol:PROTOCOL, mode:settings.mode,
      wavHash:hashes.wav, eventHash:hashes.eventStream, recipeHash:hashes.recipe,
      revealedFields:["errors","syndromes","corrections","residuals","waveform","spectrum","hashes"],
      summary:summary
    };
    var receipt = clone(receiptCore); receipt.receiptHash = sha256Hex(canonical(receiptCore)); hashes.observation = receipt.receiptHash;
    var manifestCore = {
      schema:"spectral-qec-manifest-v1", application:"SPECTRAL QEC Sonification Laboratory", engineVersion:VERSION,
      protocol:PROTOCOL, recipe:recipe, hashes:hashes, summary:summary, receipt:receipt,
      boundary:"Deterministic classical QEC sonification; not physical measurement, tomography, or hardware telemetry."
    };
    var manifest = clone(manifestCore); manifest.integrityHash = sha256Hex(canonical(manifestCore));
    return { settings:settings, simulation:sim, pcm:pcm, wav:wav, recipe:recipe, eventDocument:eventDocument, hashes:hashes, receipt:receipt, manifest:manifest, summary:summary };
  }

  function verifyManifest(manifest) {
    if (!manifest || manifest.schema !== "spectral-qec-manifest-v1") return false;
    var copy = clone(manifest), expected = copy.integrityHash;
    delete copy.integrityHash;
    if (sha256Hex(canonical(copy)) !== expected) return false;
    var receipt = clone(manifest.receipt), receiptHash = receipt.receiptHash;
    delete receipt.receiptHash;
    return sha256Hex(canonical(receipt)) === receiptHash;
  }
  function replay(manifest, dataset) {
    if (!verifyManifest(manifest)) throw new Error("Manifest authentication failed.");
    if (manifest.recipe.source.kind === "local_dataset") {
      if (!dataset || !dataset.rows) throw new Error("Exact local dataset is required for replay.");
      var supplied = dataset.byteHash || sha256Hex(canonical(dataset.rows));
      if (supplied !== manifest.recipe.source.byteHash) throw new Error("Dataset identity mismatch.");
    }
    var rerender = renderExperiment(manifest.recipe.settings, dataset);
    ["wav","eventStream","recipe","observation"].forEach(function (key) {
      if (rerender.hashes[key] !== manifest.hashes[key]) throw new Error("Replay mismatch: " + key);
    });
    return rerender;
  }

  var crcTable;
  function crc32(bytes) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (var n=0;n<256;n++) { var c=n; for(var k=0;k<8;k++) c=(c&1)?0xedb88320^(c>>>1):c>>>1; crcTable[n]=c>>>0; }
    }
    var crc=0xffffffff;
    for(var i=0;i<bytes.length;i++) crc=crcTable[(crc^bytes[i])&255]^(crc>>>8);
    return (crc^0xffffffff)>>>0;
  }
  function le16(v){return new Uint8Array([v&255,(v>>>8)&255]);}
  function le32(v){return new Uint8Array([v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255]);}
  function zipStore(files) {
    var locals=[],centrals=[],offset=0;
    files.forEach(function(file){
      var name=textBytes(file.name),data=file.bytes instanceof Uint8Array?file.bytes:textBytes(file.bytes),crc=crc32(data);
      var local=concatBytes([le32(0x04034b50),le16(20),le16(0),le16(0),le16(0),le16(33),le32(crc),le32(data.length),le32(data.length),le16(name.length),le16(0),name,data]);
      locals.push(local);
      centrals.push(concatBytes([le32(0x02014b50),le16(20),le16(20),le16(0),le16(0),le16(0),le16(33),le32(crc),le32(data.length),le32(data.length),le16(name.length),le16(0),le16(0),le16(0),le16(0),le32(0),le32(offset),name]));
      offset+=local.length;
    });
    var central=concatBytes(centrals);
    var end=concatBytes([le32(0x06054b50),le16(0),le16(0),le16(files.length),le16(files.length),le32(central.length),le32(offset),le16(0)]);
    return concatBytes(locals.concat([central,end]));
  }
  function eventsCsv(events) {
    var esc=function(v){var s=String(v);return /[\",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
    return "cycle,qubit,error,syndrome,correction,residual\n"+events.map(function(e){return [e.cycle,e.qubit,e.error,e.syndrome,e.correction,e.residual].map(esc).join(",");}).join("\n")+"\n";
  }

  var API = {
    VERSION:VERSION, PROTOCOL:PROTOCOL, STATES:STATES, CODES:CODES, NOISE:NOISE, DECODERS:DECODERS,
    canonical:canonical, sha256Hex:sha256Hex, normalizeSettings:normalizeSettings, syndrome:syndrome,
    simulate:simulate, parseDataset:parseDataset, renderExperiment:renderExperiment, verifyManifest:verifyManifest,
    replay:replay, wavBytes:wavBytes, eventsCsv:eventsCsv, zipStore:zipStore, textBytes:textBytes
  };
  window.QECLab = API;

  if (!document.getElementById("qec-lab")) return;

  var $ = function(id){return document.getElementById(id);};
  var current = null, dataset = null, audioUrl = null, toastTimer = null;

  function optionList(select, source) {
    Object.keys(source).forEach(function(key){var o=document.createElement("option");o.value=key;o.textContent=source[key].name;select.appendChild(o);});
  }
  optionList($("state"),STATES); optionList($("code"),CODES); optionList($("noise"),NOISE); optionList($("decoder"),DECODERS);
  $("state").value="bell_phi_plus"; $("code").value="bell_observer"; $("noise").value="bit_flip"; $("decoder").value="minimum_weight";

  function toast(message,error){
    var el=$("toast");el.textContent=message;el.className="toast visible"+(error?" error":"");
    clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.className="toast";},3200);
  }
  function drawLocked(canvas,label){
    var ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height;
    ctx.clearRect(0,0,w,h);ctx.fillStyle="#070a0f";ctx.fillRect(0,0,w,h);
    ctx.strokeStyle="#18232d";ctx.lineWidth=1;
    for(var x=0;x<w;x+=45){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
    for(var y=0;y<h;y+=45){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
    ctx.fillStyle="#9275d6";ctx.font="700 17px monospace";ctx.textAlign="center";ctx.fillText("OBSERVATION-DARK",w/2,h/2-8);
    ctx.fillStyle="#596b77";ctx.font="12px monospace";ctx.fillText(label,w/2,h/2+20);
  }
  function lockObservation(){
    current=null;
    if(audioUrl){URL.revokeObjectURL(audioUrl);audioUrl=null;}
    $("audio").removeAttribute("src");$("audio").load();
    $("chamber").classList.remove("observed");$("summary-grid").classList.add("hidden");
    $("observation-badge").className="observation-badge dark";$("observation-badge").lastElementChild.textContent="UNOBSERVED";
    $("header-observation").className="chip dark";$("header-observation").textContent="OBSERVATION · DARK";
    $("lock-card").querySelector("strong").textContent="OBSERVATION-DARK";
    $("lock-card").querySelector("p").textContent="Error locations, syndrome bits, decoder actions, residuals, waveform, spectrum, PCM hash, and receipt are withheld.";
    $("lock-card").querySelector("code").textContent="NO WAV · NO RECEIPT · NO REVEAL";
    ["wav-hash","event-hash","recipe-hash","receipt-hash"].forEach(function(id){$(id).textContent="WITHHELD";});
    $("logical-status").textContent="WITHHELD";$("correction-ratio").textContent="—";$("clean-cycles").textContent="—";
    $("recovery-badge").className="result neutral";$("recovery-badge").textContent="PENDING";
    $("render-name").textContent="No observed render";$("download-wav").disabled=true;
    document.querySelectorAll("[data-download]").forEach(function(b){b.disabled=true;});
    $("event-body").innerHTML='<tr><td colspan="6">OBSERVATION-DARK · RENDER WAV TO REVEAL</td></tr>';
    $("json-view").textContent="OBSERVATION-DARK";
    $("state-tag").textContent="DARK";$("syndrome-tag").textContent="DARK";$("audio-tag").textContent="SEALED";
    drawLocked($("state-canvas"),"STATE AMPLITUDES WITHHELD");
    drawLocked($("syndrome-canvas"),"SYNDROME TRAJECTORY WITHHELD");
    drawLocked($("waveform"),"PCM WAVEFORM WITHHELD");
    drawLocked($("spectrum"),"TIME–FREQUENCY VIEW WITHHELD");
    $("progress").querySelector("span").style.width="0";
    $("progress").querySelector("p").textContent="READY · OBSERVATION REMAINS DARK";
  }
  function selectedMode(){var r=document.querySelector('input[name="mode"]:checked');return r?r.value:"canonical_strict";}
  function settingsFromUI(){
    return {mode:selectedMode(),state:$("state").value,code:$("code").value,noise:$("noise").value,decoder:$("decoder").value,
      errorRate:$("error-rate").value,cycles:$("cycles").value,iterations:$("iterations").value,mutation:$("mutation").value,
      texture:$("texture").value,tuning:$("tuning").value,tempo:$("tempo").value,duration:$("duration").value,
      width:$("width").value,intensity:$("intensity").value,drone:$("drone").checked};
  }
  function updateLabels(){
    var state=STATES[$("state").value],code=CODES[$("code").value],noise=NOISE[$("noise").value],decoder=DECODERS[$("decoder").value];
    $("state-note").textContent=state.note;$("code-note").textContent=code.note;$("noise-note").textContent=noise.note;$("decoder-note").textContent=decoder.note;
    var values=[code.n,code.k,code.d,code.checks.length];$("code-spec").querySelectorAll("b").forEach(function(b,i){b.textContent=values[i];});
    $("latent-state").textContent=state.name;$("latent-code").textContent=code.name;$("latent-noise").textContent=noise.name;$("latent-seed").textContent="qec-lab:"+(int($("mutation").value,0)>>>0);
    $("intensity-out").textContent=$("intensity").value+"%";
    document.querySelectorAll(".mode-card").forEach(function(c){c.classList.toggle("selected",c.querySelector("input").checked);});
  }
  function enforceCompatibility(changed){
    var code=CODES[$("code").value];
    if(code.radix===3){$("state").value="qutrit_fourier";$("noise").value="qutrit_shift";$("decoder").value="mod3_lookup";}
    else if(changed==="code" && STATES[$("state").value].radix===3){$("state").value="plus";$("noise").value="depolarizing";$("decoder").value="minimum_weight";}
    if(STATES[$("state").value].radix===3 && code.radix!==3)$("code").value="qutrit_repetition_3";
  }
  document.querySelectorAll(".identity").forEach(function(el){
    var handler=function(){enforceCompatibility(el.id);updateLabels();lockObservation();};
    el.addEventListener(el.type==="range"?"input":"change",handler);
  });

  document.querySelectorAll("[data-preset]").forEach(function(button){
    button.addEventListener("click",function(){
      var p=PRESETS[button.dataset.preset];
      $("state").value=p.state;$("code").value=p.code;$("noise").value=p.noise;$("decoder").value=p.decoder;
      $("error-rate").value=p.rate;$("cycles").value=p.cycles;$("texture").value=p.texture;$("tempo").value=p.tempo;
      document.querySelectorAll("[data-preset]").forEach(function(b){b.classList.toggle("active",b===button);});
      updateLabels();lockObservation();
    });
  });
  $("reset").addEventListener("click",function(){
    $("state").value="bell_phi_plus";$("code").value="bell_observer";$("noise").value="bit_flip";$("decoder").value="minimum_weight";
    $("error-rate").value=12;$("cycles").value=16;$("iterations").value=8;$("mutation").value=0;$("texture").value="harmonic_glass";
    $("tuning").value=432;$("tempo").value=140;$("duration").value=8;$("width").value=72;$("intensity").value=70;$("drone").checked=true;
    document.querySelector('input[name="mode"][value="canonical_strict"]').checked=true;
    document.querySelectorAll("[data-preset]").forEach(function(b){b.classList.remove("active");});
    updateLabels();lockObservation();toast("Experiment reset. Observation is dark.");
  });

  function handleFile(file){
    if(!file)return;
    file.text().then(function(text){
      var rows=parseDataset(text,file.name),bytes=textBytes(text);
      dataset={name:file.name,rows:rows,byteHash:sha256Hex(bytes)};
      $("source-status").innerHTML="<span></span><small></small>";
      $("source-status").firstElementChild.textContent=file.name;
      $("source-status").lastElementChild.textContent=rows.length+" normalized rows · SHA-256 "+dataset.byteHash.slice(0,12)+"…";
      $("clear-source").hidden=false;lockObservation();toast("Dataset loaded locally. Event values remain hidden until render.");
    }).catch(function(error){toast(error.message,true);});
  }
  $("choose-file").addEventListener("click",function(){$("file-input").click();});
  $("file-input").addEventListener("change",function(){handleFile(this.files[0]);this.value="";});
  ["dragenter","dragover"].forEach(function(name){$("drop-zone").addEventListener(name,function(e){e.preventDefault();this.classList.add("dragging");});});
  ["dragleave","drop"].forEach(function(name){$("drop-zone").addEventListener(name,function(e){e.preventDefault();this.classList.remove("dragging");if(name==="drop")handleFile(e.dataTransfer.files[0]);});});
  $("clear-source").addEventListener("click",function(){dataset=null;$("source-status").innerHTML="<span>GENERATED EXPERIMENT</span><small>No external source loaded</small>";this.hidden=true;lockObservation();});

  function drawState(result){
    var canvas=$("state-canvas"),ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height,state=STATES[result.settings.state],amps=state.amplitudes;
    ctx.fillStyle="#070a0f";ctx.fillRect(0,0,w,h);ctx.strokeStyle="#1a2630";ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(55,h/2);ctx.lineTo(w-35,h/2);ctx.stroke();ctx.beginPath();ctx.moveTo(w/2,35);ctx.lineTo(w/2,h-45);ctx.stroke();
    amps.forEach(function(a,i){
      var mag=Math.sqrt(a[0]*a[0]+a[1]*a[1]),angle=Math.atan2(a[1],a[0]);
      var x=80+(w-160)*(i+1)/(amps.length+1),y=h/2-Math.sin(angle)*90;
      ctx.beginPath();ctx.arc(x,y,8+mag*29,0,Math.PI*2);ctx.fillStyle="rgba(139,216,231,"+(0.18+mag*.72)+")";ctx.fill();
      ctx.strokeStyle="#8bd8e7";ctx.stroke();ctx.fillStyle="#8bd8e7";ctx.font="11px monospace";ctx.textAlign="center";ctx.fillText("|"+i.toString(state.radix).padStart(state.qudits,"0")+"⟩",x,h-35);
      ctx.fillStyle="#768894";ctx.fillText(mag.toFixed(3),x,y+4);
    });
  }
  function drawSyndrome(result){
    var canvas=$("syndrome-canvas"),ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height,cycles=result.simulation.cycles,checks=CODES[result.settings.code].checks.length;
    ctx.fillStyle="#070a0f";ctx.fillRect(0,0,w,h);
    var left=48,top=38,cw=(w-left-25)/cycles.length,ch=(h-top-42)/Math.max(1,checks);
    cycles.forEach(function(c,ci){for(var s=0;s<checks;s++){var v=c.syndrome[s]||0;ctx.fillStyle=v===0?"#101922":v===1?"#36a9be":"#9275d6";ctx.fillRect(left+ci*cw+1,top+s*ch+1,Math.max(2,cw-2),Math.max(2,ch-2));}});
    ctx.fillStyle="#768894";ctx.font="10px monospace";ctx.textAlign="right";
    for(var s=0;s<checks;s++)ctx.fillText("S"+s,left-8,top+s*ch+ch/2+3);
    ctx.textAlign="center";for(var i=0;i<cycles.length;i+=Math.max(1,Math.ceil(cycles.length/8)))ctx.fillText(String(i),left+i*cw+cw/2,h-18);
  }
  function drawWave(result){
    var canvas=$("waveform"),ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height,pcm=result.pcm,frames=pcm.length/2;
    ctx.fillStyle="#070a0f";ctx.fillRect(0,0,w,h);ctx.strokeStyle="#1a2630";ctx.beginPath();ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();
    ctx.strokeStyle="#8bd8e7";ctx.lineWidth=1;ctx.beginPath();
    for(var x=0;x<w;x++){var start=Math.floor(x*frames/w),end=Math.max(start+1,Math.floor((x+1)*frames/w)),peak=0;for(var i=start;i<end;i++)peak=Math.max(peak,Math.abs(pcm[i*2]),Math.abs(pcm[i*2+1]));var y=peak/32768*(h*.44);ctx.moveTo(x,h/2-y);ctx.lineTo(x,h/2+y);}ctx.stroke();
  }
  function drawSpectrum(result){
    var canvas=$("spectrum"),ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height,pcm=result.pcm,frames=pcm.length/2;
    ctx.fillStyle="#070a0f";ctx.fillRect(0,0,w,h);
    var cols=150,bins=64,win=128;
    for(var cx=0;cx<cols;cx++){
      var centre=Math.floor((cx+.5)*frames/cols),start=clamp(centre-win/2,0,frames-win);
      for(var b=1;b<bins;b++){
        var re=0,im=0;
        for(var n=0;n<win;n++){var sample=(pcm[(start+n)*2]+pcm[(start+n)*2+1])/65536;var angle=2*Math.PI*b*n/win;re+=sample*Math.cos(angle);im-=sample*Math.sin(angle);}
        var mag=Math.sqrt(re*re+im*im)/win,level=clamp(Math.log10(1+mag*40),0,1);
        var r=Math.round(20+level*119),g=Math.round(28+level*188),bl=Math.round(42+level*205);
        ctx.fillStyle="rgb("+r+","+g+","+bl+")";ctx.fillRect(cx*w/cols,h-(b+1)*h/bins,Math.ceil(w/cols)+1,Math.ceil(h/bins)+1);
      }
    }
    ctx.fillStyle="#dbe7ed";ctx.font="10px monospace";ctx.fillText("0 Hz",8,h-8);ctx.fillText("≈ 22 kHz",8,14);
  }

  function populateEvents(events){
    $("event-body").innerHTML="";
    events.slice(0,1000).forEach(function(e){var tr=document.createElement("tr");[e.cycle,e.qubit<0?"—":e.qubit,e.error,e.syndrome||"0",e.correction,e.residual].forEach(function(v){var td=document.createElement("td");td.textContent=v;tr.appendChild(td);});$("event-body").appendChild(tr);});
  }
  function jsonBytes(obj){return textBytes(JSON.stringify(obj,null,2)+"\n");}
  function buildBundle(result){
    return zipStore([
      {name:"qec-sonification.wav",bytes:result.wav},
      {name:"manifest.json",bytes:jsonBytes(result.manifest)},
      {name:"recipe.json",bytes:jsonBytes(result.recipe)},
      {name:"events.csv",bytes:textBytes(eventsCsv(result.simulation.events))},
      {name:"observation-receipt.json",bytes:jsonBytes(result.receipt)},
      {name:"README.txt",bytes:textBytes("SPECTRAL QEC deterministic render bundle\\nProtocol: "+PROTOCOL+"\\nWAV SHA-256: "+result.hashes.wav+"\\n")}
    ]);
  }
  function reveal(result){
    current=result;current.bundle=buildBundle(result);
    $("chamber").classList.add("observed");$("summary-grid").classList.remove("hidden");
    $("observation-badge").className="observation-badge observed";$("observation-badge").lastElementChild.textContent="RECEIPT BOUND";
    $("header-observation").className="chip observed";$("header-observation").textContent="OBSERVATION · RECEIPT BOUND";
    $("lock-card").querySelector("strong").textContent="AUDIO-BOUND OBSERVATION";
    $("lock-card").querySelector("p").textContent="The WAV bytes, event stream, recipe, and observation receipt now share a verified render identity.";
    $("lock-card").querySelector("code").textContent=result.hashes.observation.slice(0,32)+"…";
    $("sum-errors").textContent=result.summary.errors;$("sum-syndrome").textContent=result.summary.syndromeWeight;$("sum-corrections").textContent=result.summary.corrections;$("sum-residuals").textContent=result.summary.residuals;
    $("wav-hash").textContent=result.hashes.wav;$("event-hash").textContent=result.hashes.eventStream;$("recipe-hash").textContent=result.hashes.recipe;$("receipt-hash").textContent=result.hashes.observation;
    var passed=result.summary.residuals===0;
    $("logical-status").textContent=passed?"NO RESIDUAL DETECTED":"RESIDUAL PRESENT";
    $("correction-ratio").textContent=result.summary.errors?Math.round((result.summary.errors-result.summary.residuals)*100/result.summary.errors)+"%":"100%";
    $("clean-cycles").textContent=result.summary.cleanCycles+" / "+result.summary.cycles;
    $("recovery-badge").className="result "+(passed?"pass":"warn");$("recovery-badge").textContent=passed?"RECOVERED":"RESIDUAL";
    $("render-name").textContent="qec_"+result.settings.code+"_"+result.hashes.wav.slice(0,12)+".wav";
    if(audioUrl)URL.revokeObjectURL(audioUrl);audioUrl=URL.createObjectURL(new Blob([result.wav],{type:"audio/wav"}));$("audio").src=audioUrl;
    $("download-wav").disabled=false;document.querySelectorAll("[data-download]").forEach(function(b){b.disabled=false;});
    $("state-tag").textContent=STATES[result.settings.state].name;$("syndrome-tag").textContent=result.settings.cycles+" CYCLES";$("audio-tag").textContent=result.settings.durationMillis/1000+" s · 44.1 kHz";
    drawState(result);drawSyndrome(result);drawWave(result);drawSpectrum(result);populateEvents(result.simulation.events);
    $("json-view").textContent=JSON.stringify(result.manifest,null,2);
    $("progress").querySelector("span").style.width="100%";$("progress").querySelector("p").textContent="COMPLETE · WAV COMMITTED · OBSERVATION REVEALED";
  }
  $("render").addEventListener("click",function(){
    var button=this;button.disabled=true;$("progress").querySelector("span").style.width="36%";$("progress").querySelector("p").textContent="RENDERING DETERMINISTIC PCM · OBSERVATION SEALED";
    setTimeout(function(){
      try{var result=renderExperiment(settingsFromUI(),dataset);reveal(result);toast("WAV committed. QEC observation revealed.");}
      catch(error){lockObservation();toast(error.message,true);}
      button.disabled=false;
    },30);
  });
  function save(bytes,name,type){
    var url=URL.createObjectURL(new Blob([bytes],{type:type||"application/octet-stream"})),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);
  }
  $("download-wav").addEventListener("click",function(){if(current)save(current.wav,$("render-name").textContent,"audio/wav");});
  document.querySelectorAll("[data-download]").forEach(function(button){button.addEventListener("click",function(){
    if(!current)return;var kind=button.dataset.download,prefix="qec_"+current.hashes.wav.slice(0,12)+"_";
    if(kind==="manifest")save(jsonBytes(current.manifest),prefix+"manifest.json","application/json");
    if(kind==="recipe")save(jsonBytes(current.recipe),prefix+"recipe.json","application/json");
    if(kind==="events")save(textBytes(eventsCsv(current.simulation.events)),prefix+"events.csv","text/csv");
    if(kind==="receipt")save(jsonBytes(current.receipt),prefix+"observation-receipt.json","application/json");
    if(kind==="bundle")save(current.bundle,prefix+"bundle.zip","application/zip");
  });});

  document.querySelectorAll("[data-tab]").forEach(function(button){button.addEventListener("click",function(){
    document.querySelectorAll("[data-tab]").forEach(function(b){b.classList.toggle("active",b===button);});
    var events=button.dataset.tab==="events";$("event-view").hidden=!events;$("json-view").hidden=events;
    if(!events){if(!current)$("json-view").textContent="OBSERVATION-DARK";else if(button.dataset.tab==="manifest")$("json-view").textContent=JSON.stringify(current.manifest,null,2);else if(button.dataset.tab==="receipt")$("json-view").textContent=JSON.stringify(current.receipt,null,2);else $("json-view").textContent=JSON.stringify(current.recipe.mapping,null,2);}
  });});

  updateLabels();lockObservation();
})();
