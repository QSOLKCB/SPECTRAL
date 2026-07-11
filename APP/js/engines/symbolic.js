(function registerSymbolicEngines(S) {
  "use strict";

  const Registry = S.Engines.Registry;
  const BOTH = [S.MODES.CANONICAL_STRICT, S.MODES.REPLAY_SAFE];
  const PHI_NUM = 1618;
  const PHI_DEN = 1000;

  function digestBytes(recipeHash) {
    return S.Core.fromHex(recipeHash);
  }

  function sourceByte(context, index) {
    const bytes = context.source && context.source.bytes && context.source.bytes.length ? context.source.bytes : digestBytes(context.recipeHash);
    return bytes[index % bytes.length];
  }

  function hzMilliFromScaled(value) {
    return value;
  }

  Registry.register({
    id: "omi_xor_ring",
    name: "OMI XOR Ring",
    version: "2.0.0",
    description: "Integer XOR/rotation orbits mapped to hard-edged synthetic voices and deterministic bit-state percussion.",
    claimBoundary: "Formal integer signal process; artistic sonification, not a physical-system measurement.",
    supportedModes: BOTH,
    defaultExportProfile: "brutalist",
    parameterSchema: [
      { id: "base_hz", label: "Base frequency", type: "range", min: "35", max: "880", step: "1", default: "110", scale: 1000, unit: "Hz" },
      { id: "orbit_lanes", label: "Orbit lanes", type: "number", min: "2", max: "16", step: "1", default: "8", scale: 1 },
      { id: "rotation", label: "Rotation", type: "number", min: "1", max: "31", step: "1", default: "3", scale: 1 },
      { id: "gate_ms", label: "Gate period", type: "range", min: "20", max: "800", step: "5", default: "89", scale: 1, unit: "ms" },
      { id: "noise_q15", label: "Bit noise", type: "range", min: "0", max: "0.6", step: "0.01", default: "0.12", scale: 32767 },
      { id: "gain_q15", label: "Master gain", type: "range", min: "0.1", max: "1", step: "0.01", default: "0.72", scale: 32767 }
    ],
    presets: [
      { id: "raw_orbit", name: "Raw Orbit", subtitle: "8 lanes · hard state", params: { base_hz: "110", orbit_lanes: "8", rotation: "3", gate_ms: "89", noise_q15: "0.12", gain_q15: "0.72" } },
      { id: "slow_machine", name: "Slow Machine", subtitle: "low register", params: { base_hz: "55", orbit_lanes: "6", rotation: "7", gate_ms: "233", noise_q15: "0.08", gain_q15: "0.80" } },
      { id: "byte_storm", name: "Byte Storm", subtitle: "dense mutation", params: { base_hz: "180", orbit_lanes: "14", rotation: "13", gate_ms: "34", noise_q15: "0.32", gain_q15: "0.62" } }
    ],
    buildPlan(context) {
      const p = context.parameters;
      const tones = [];
      let state = new DataView(digestBytes(context.recipeHash).buffer).getUint32(0, false);
      for (let lane = 0; lane < p.orbit_lanes; lane += 1) {
        state = (S.Core.rotl32(state, p.rotation) ^ S.Core.rotl32(state, lane + 1) ^ 0xa5a5a5a5 ^ sourceByte(context, lane)) >>> 0;
        const byte = (state >>> ((lane & 3) * 8)) & 0xff;
        tones.push({
          kind: lane % 4 === 0 ? "square" : lane % 4 === 1 ? "saw" : lane % 4 === 2 ? "triangle" : "pulse",
          freq_millihz: hzMilliFromScaled(p.base_hz) + (byte + 17 * lane) * 1370,
          amp_q15: Math.max(900, Math.trunc(15000 / Math.max(2, p.orbit_lanes))),
          pan_q15: Math.trunc(-28000 + lane * 56000 / Math.max(1, p.orbit_lanes - 1)),
          phase_u32: state,
          gate_period_samples: Math.max(1, Math.trunc(context.profile.sampleRate * p.gate_ms * (1 + lane % 3) / 1000)),
          gate_duty_q15: 9000 + (byte % 17000),
          lfo_rate_millihz: 70 + lane * 31,
          lfo_depth_q15: 1800 + (byte << 4)
        });
      }
      if (p.noise_q15 > 0) tones.push({ kind: "noise", freq_millihz: 1, amp_q15: p.noise_q15, pan_q15: 0, gate_period_samples: Math.trunc(context.profile.sampleRate * 34 / 1000), gate_duty_q15: 5000 });
      return { tones, master_q15: p.gain_q15, feedback_q15: 0 };
    }
  });

  Registry.register({
    id: "e8_cosmovirus",
    name: "E8 Cosmovirus",
    version: "2.0.0",
    description: "Triality registers, φ-scaled mutation lanes, DIAG edges, Fibonacci events, and Ouroboros feedback.",
    claimBoundary: S.APP.claimBoundary,
    supportedModes: BOTH,
    defaultExportProfile: "suno_seed",
    parameterSchema: [
      { id: "fundamental_hz", label: "Fundamental", type: "range", min: "27", max: "432", step: "1", default: "54", scale: 1000, unit: "Hz" },
      { id: "triality_depth", label: "Triality depth", type: "number", min: "3", max: "12", step: "1", default: "8", scale: 1 },
      { id: "diag_q15", label: "DIAG weight", type: "range", min: "0", max: "1", step: "0.01", default: "0.62", scale: 32767 },
      { id: "infection_q15", label: "Symbolic infection", type: "range", min: "0", max: "1", step: "0.01", default: "0.38", scale: 32767 },
      { id: "fib_gate", label: "Fibonacci gate", type: "select", default: "55", options: [{value:"34",label:"34"},{value:"55",label:"55"},{value:"89",label:"89"},{value:"144",label:"144"}] },
      { id: "ouroboros_q15", label: "Ouroboros feedback", type: "range", min: "0", max: "0.75", step: "0.01", default: "0.21", scale: 32767 },
      { id: "gain_q15", label: "Master gain", type: "range", min: "0.1", max: "1", step: "0.01", default: "0.68", scale: 32767 }
    ],
    presets: [
      { id: "validated_breach", name: "Validated Breach", subtitle: "balanced triality", params: { fundamental_hz:"54",triality_depth:"8",diag_q15:"0.62",infection_q15:"0.38",fib_gate:"55",ouroboros_q15:"0.21",gain_q15:"0.68" } },
      { id: "dark_subspace", name: "Dark Subspace", subtitle: "slow hidden modes", params: { fundamental_hz:"40",triality_depth:"6",diag_q15:"0.36",infection_q15:"0.22",fib_gate:"144",ouroboros_q15:"0.31",gain_q15:"0.73" } },
      { id: "recursive_receipt", name: "Recursive Receipt", subtitle: "dense DIAG events", params: { fundamental_hz:"72",triality_depth:"11",diag_q15:"0.83",infection_q15:"0.57",fib_gate:"34",ouroboros_q15:"0.16",gain_q15:"0.59" } }
    ],
    buildPlan(context) {
      const p = context.parameters;
      const fib = parseInt(p.fib_gate, 10);
      const digest = digestBytes(context.recipeHash);
      const tones = [];
      const ratios = [[1,1],[1618,1000],[2584,1000],[1000,1618],[4236,1000],[6770,1000]];
      for (let lane = 0; lane < p.triality_depth; lane += 1) {
        const ratio = ratios[lane % ratios.length];
        const base = Math.trunc(p.fundamental_hz * ratio[0] / ratio[1]);
        const sequence = [];
        for (let step = 0; step < 6; step += 1) {
          const a = digest[(lane + step) % digest.length];
          const b = sourceByte(context, lane * 7 + step);
          const diag = Math.abs(a - 2 * b + digest[(lane + step + 1) % digest.length]);
          sequence.push(base + Math.trunc((a * 1700 + diag * p.diag_q15 / 32767) * (1 + (step % 3))));
        }
        tones.push({
          kind: lane % 3 === 0 ? "sine" : lane % 3 === 1 ? "triangle" : "pulse",
          freq_millihz: sequence[0], sequence_millihz: sequence,
          sequence_period_samples: Math.max(1, Math.trunc(context.profile.sampleRate * fib / 1000)),
          amp_q15: Math.max(700, Math.trunc((19000 + p.infection_q15 / 4) / p.triality_depth)),
          pan_q15: lane % 3 === 0 ? -22000 : lane % 3 === 1 ? 0 : 22000,
          phase_u32: new DataView(digest.buffer).getUint32((lane % 8) * 4, false),
          gate_period_samples: Math.trunc(context.profile.sampleRate * fib * (1 + lane % 5) / 1000),
          gate_duty_q15: 8000 + (digest[lane % digest.length] << 5),
          lfo_rate_millihz: 34 + lane * 13,
          lfo_depth_q15: Math.trunc(p.infection_q15 / 2)
        });
      }
      tones.push({ kind: "noise", freq_millihz: 1, amp_q15: Math.trunc(p.infection_q15 / 5), pan_q15: 0, gate_period_samples: Math.trunc(context.profile.sampleRate * 55 / 1000), gate_duty_q15: 4200 });
      return { tones, master_q15: p.gain_q15, feedback_q15: p.ouroboros_q15 };
    }
  });

  Registry.register({
    id: "e8_bell",
    name: "E8 Bell",
    version: "2.0.0",
    description: "Bell-state parity mapped onto rational φ ladders for harmonic pads, drones, and slowly rotating spectra.",
    claimBoundary: "E8/Bell terminology is an artistic mapping of phase and parity; it does not claim laboratory entanglement.",
    supportedModes: BOTH,
    defaultExportProfile: "archive",
    parameterSchema: [
      { id: "bell_state", label: "Bell state", type: "select", default: "phi_plus", options: [{value:"phi_plus",label:"Φ+ in phase"},{value:"phi_minus",label:"Φ− anti phase"},{value:"psi_plus",label:"Ψ+ odd parity"},{value:"psi_minus",label:"Ψ− phase flip"}] },
      { id: "tuning_hz", label: "Reference tuning", type: "range", min: "216", max: "480", step: "1", default: "432", scale: 1000, unit: "Hz" },
      { id: "root_divisor", label: "Root divisor", type: "number", min: "2", max: "12", step: "1", default: "6", scale: 1 },
      { id: "harmonic_depth", label: "Harmonic depth", type: "number", min: "2", max: "12", step: "1", default: "7", scale: 1 },
      { id: "drift_q15", label: "φ drift", type: "range", min: "0", max: "0.8", step: "0.01", default: "0.18", scale: 32767 },
      { id: "gain_q15", label: "Master gain", type: "range", min: "0.1", max: "1", step: "0.01", default: "0.74", scale: 32767 }
    ],
    presets: [
      { id:"phi_plus_pad",name:"Φ+ Lattice Pad",subtitle:"in-phase orbit",params:{bell_state:"phi_plus",tuning_hz:"432",root_divisor:"6",harmonic_depth:"7",drift_q15:"0.18",gain_q15:"0.74"}},
      { id:"psi_odd",name:"Ψ Odd-Parity",subtitle:"wide phase field",params:{bell_state:"psi_plus",tuning_hz:"432",root_divisor:"8",harmonic_depth:"9",drift_q15:"0.31",gain_q15:"0.65"}},
      { id:"anti_bell",name:"Anti-Phase Bell",subtitle:"slow cancellation",params:{bell_state:"phi_minus",tuning_hz:"440",root_divisor:"5",harmonic_depth:"6",drift_q15:"0.11",gain_q15:"0.78"}}
    ],
    buildPlan(context) {
      const p = context.parameters;
      const base = Math.trunc(p.tuning_hz / p.root_divisor);
      const odd = p.bell_state.indexOf("psi") === 0;
      const negative = p.bell_state.endsWith("minus");
      const tones = [];
      let numerator = odd ? 1000 : PHI_NUM;
      let denominator = odd ? PHI_NUM : PHI_DEN;
      for (let lane = 0; lane < p.harmonic_depth; lane += 1) {
        const frequency = Math.max(12000, Math.trunc(base * numerator / denominator));
        tones.push({
          kind: "sine", freq_millihz: frequency,
          amp_q15: Math.max(500, Math.trunc(18000 / (lane + 2))),
          pan_q15: Math.trunc((lane % 2 ? 1 : -1) * (7000 + lane * 1800)),
          phase_u32: negative && lane % 2 ? 0x80000000 : 0,
          lfo_rate_millihz: 13 + lane * 8,
          lfo_depth_q15: Math.trunc(p.drift_q15 * (lane + 1) / p.harmonic_depth)
        });
        numerator = Math.trunc(numerator * PHI_NUM / PHI_DEN);
      }
      return { tones, master_q15: p.gain_q15, feedback_q15: 2500 };
    }
  });

  Registry.register({
    id: "spectral_algebraics",
    name: "Spectral Algebraics",
    version: "2.0.0",
    description: "SPECTRAL-native macro engine for Coxeter rotation, φ drift, qutrit bias, deterministic entropy, and energy flow.",
    claimBoundary: "Audible geometry is a deterministic artistic model; controls do not establish a physical E8 realization.",
    supportedModes: BOTH,
    defaultExportProfile: "archive",
    parameterSchema: [
      {id:"phi_drift",label:"PhiDrift",type:"range",min:"0",max:"1",step:"0.01",default:"0.25",scale:32767},
      {id:"coxeter_phase",label:"CoxeterPhase",type:"range",min:"0",max:"1",step:"0.01",default:"0.50",scale:32767},
      {id:"amp_gain",label:"AmpGain",type:"range",min:"0.05",max:"1",step:"0.01",default:"0.42",scale:32767},
      {id:"phase_gain",label:"PhaseGain",type:"range",min:"0",max:"1",step:"0.01",default:"0.25",scale:32767},
      {id:"ternary_bias",label:"TernaryBias",type:"range",min:"-1",max:"1",step:"0.01",default:"0.10",scale:32767},
      {id:"cosmic_depth",label:"CosmicDepth",type:"number",min:"2",max:"12",step:"1",default:"7",scale:1},
      {id:"energy_flow",label:"EnergyFlow",type:"range",min:"0.1",max:"1",step:"0.01",default:"0.78",scale:32767},
      {id:"entropy_bloom",label:"EntropyBloom",type:"range",min:"0",max:"1",step:"0.01",default:"0.12",scale:32767}
    ],
    presets: [
      {id:"coxeter_orbit",name:"Coxeter Orbit",subtitle:"smooth φ pad",params:{phi_drift:"0.25",coxeter_phase:"0.50",amp_gain:"0.42",phase_gain:"0.25",ternary_bias:"0.10",cosmic_depth:"7",energy_flow:"0.78",entropy_bloom:"0.08"}},
      {id:"phi_pulse_grit",name:"φ-Pulse Grit",subtitle:"fractal metallic",params:{phi_drift:"0.32",coxeter_phase:"0.24",amp_gain:"0.58",phase_gain:"0.61",ternary_bias:"-0.22",cosmic_depth:"6",energy_flow:"0.91",entropy_bloom:"0.19"}},
      {id:"e8_pad_swell",name:"E8 Pad Swell",subtitle:"spectral ascent",params:{phi_drift:"0.18",coxeter_phase:"0.73",amp_gain:"0.36",phase_gain:"0.31",ternary_bias:"0.18",cosmic_depth:"10",energy_flow:"0.63",entropy_bloom:"0.11"}}
    ],
    buildPlan(context) {
      const p = context.parameters;
      const digest = digestBytes(context.recipeHash);
      const tones = [];
      let frequency = 54000 + Math.trunc(p.coxeter_phase * 110000 / 32767);
      for (let lane = 0; lane < p.cosmic_depth; lane += 1) {
        const ternary = (lane % 3) - 1;
        const entropy = Math.trunc(digest[lane % digest.length] * p.entropy_bloom / 160);
        tones.push({
          kind: lane % 4 === 3 ? "triangle" : "sine",
          freq_millihz: Math.max(14000, frequency + entropy + ternary * Math.trunc(p.ternary_bias / 8)),
          amp_q15: Math.max(450, Math.trunc(p.amp_gain / (2 + lane / 2))),
          pan_q15: Math.trunc(Math.max(-30000, Math.min(30000, ternary * 13000 + (lane % 2 ? p.phase_gain / 3 : -p.phase_gain / 3)))),
          phase_u32: (digest[lane % digest.length] << 24) >>> 0,
          lfo_rate_millihz: 11 + Math.trunc(p.energy_flow * (lane + 1) / 1200),
          lfo_depth_q15: Math.trunc(p.phi_drift * (lane + 1) / p.cosmic_depth),
          gate_period_samples: lane % 4 === 3 ? Math.trunc(context.profile.sampleRate * 233 / 1000) : 0,
          gate_duty_q15: 15000
        });
        frequency = Math.trunc(frequency * PHI_NUM / PHI_DEN);
        if (frequency > 4800000) frequency = Math.trunc(frequency / 4);
      }
      return { tones, master_q15: p.energy_flow, feedback_q15: Math.trunc(p.phase_gain / 10) };
    }
  });
})(window.SPECTRAL);
