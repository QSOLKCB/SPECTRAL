(function registerDataEngines(S) {
  "use strict";

  const Registry = S.Engines.Registry;
  const BOTH = [S.MODES.CANONICAL_STRICT, S.MODES.REPLAY_SAFE];

  function fallbackNumeric(context) {
    const bytes = S.Core.fromHex(context.recipeHash);
    return Int32Array.from(bytes, value => value * 1000000);
  }

  function numericSource(context) {
    if (context.mode === S.MODES.CANONICAL_STRICT && context.source && context.source.kind === "image") {
      return Int32Array.from(context.source.bytes, value => value * 1000000);
    }
    if (context.source && context.source.numeric && context.source.numeric.length) return context.source.numeric;
    return fallbackNumeric(context);
  }

  function sampleSeries(values, count) {
    const output = new Int32Array(Math.min(count, values.length));
    if (output.length === 0) return output;
    for (let i = 0; i < output.length; i += 1) {
      const index = Math.min(values.length - 1, Math.floor(i * values.length / output.length));
      output[i] = values[index];
    }
    return output;
  }

  function range(values) {
    let minimum = values.length ? values[0] : 0;
    let maximum = minimum;
    for (let i = 1; i < values.length; i += 1) {
      minimum = Math.min(minimum, values[i]);
      maximum = Math.max(maximum, values[i]);
    }
    return { minimum, maximum };
  }

  function mapRange(value, sourceMin, sourceMax, targetMin, targetMax) {
    if (sourceMax === sourceMin) return Math.trunc((targetMin + targetMax) / 2);
    const numerator = BigInt(value - sourceMin) * BigInt(targetMax - targetMin);
    const denominator = BigInt(sourceMax - sourceMin);
    return targetMin + Number(numerator / denominator);
  }

  Registry.register({
    id: "qec_triality",
    name: "QEC Triality",
    version: "2.0.0",
    description: "Numeric and QEC-style event streams mapped across three phase lanes with the canonical [1, −2, 1] relation.",
    claimBoundary: "A data-mapping instrument. Audio is not a decoder benchmark or evidence of quantum advantage.",
    supportedModes: BOTH,
    defaultExportProfile: "suno_seed",
    parameterSchema: [
      {id:"base_hz",label:"Base frequency",type:"range",min:"30",max:"880",step:"1",default:"90",scale:1000,unit:"Hz"},
      {id:"frequency_span_hz",label:"Frequency span",type:"range",min:"50",max:"4000",step:"10",default:"1200",scale:1000,unit:"Hz"},
      {id:"phase_relation",label:"Phase relation",type:"select",default:"diag_1m21",options:[{value:"diag_1m21",label:"DIAG [1,−2,1]"},{value:"triality",label:"Triality rotation"},{value:"syndrome",label:"Syndrome split"}]},
      {id:"event_ms",label:"Event period",type:"range",min:"20",max:"1000",step:"5",default:"125",scale:1,unit:"ms"},
      {id:"voices",label:"Mapped columns",type:"number",min:"1",max:"8",step:"1",default:"4",scale:1},
      {id:"gain_q15",label:"Master gain",type:"range",min:"0.1",max:"1",step:"0.01",default:"0.67",scale:32767}
    ],
    presets: [
      {id:"logical_error_glides",name:"Logical Error Glides",subtitle:"four mapped voices",params:{base_hz:"90",frequency_span_hz:"1200",phase_relation:"diag_1m21",event_ms:"125",voices:"4",gain_q15:"0.67"}},
      {id:"syndrome_bursts",name:"Syndrome Bursts",subtitle:"fast sparse events",params:{base_hz:"55",frequency_span_hz:"2200",phase_relation:"syndrome",event_ms:"55",voices:"6",gain_q15:"0.58"}},
      {id:"triality_drift",name:"Triality Drift",subtitle:"slow phase mapping",params:{base_hz:"130",frequency_span_hz:"800",phase_relation:"triality",event_ms:"377",voices:"3",gain_q15:"0.72"}}
    ],
    buildPlan(context) {
      const p = context.parameters;
      const sampled = sampleSeries(numericSource(context), 96);
      const bounds = range(sampled);
      const tones = [];
      const relation = p.phase_relation === "diag_1m21" ? [1,-2,1] : p.phase_relation === "triality" ? [1,0,-1] : [1,-1,1];
      const period = Math.max(1, Math.trunc(context.profile.sampleRate * p.event_ms / 1000));
      for (let voice = 0; voice < p.voices; voice += 1) {
        const sequence = [];
        for (let i = voice; i < sampled.length; i += p.voices) {
          let value = sampled[i];
          if (p.phase_relation === "diag_1m21" && i > 0 && i + 1 < sampled.length) value = sampled[i - 1] - 2 * sampled[i] + sampled[i + 1];
          const freq = mapRange(Math.max(bounds.minimum, Math.min(bounds.maximum, value)), bounds.minimum, bounds.maximum, p.base_hz, p.base_hz + p.frequency_span_hz);
          sequence.push(Math.max(12000, freq + voice * 17000));
        }
        if (!sequence.length) sequence.push(p.base_hz + voice * 23000);
        tones.push({
          kind: voice % 3 === 0 ? "sine" : voice % 3 === 1 ? "triangle" : "pulse",
          freq_millihz: sequence[0], sequence_millihz: sequence,
          sequence_period_samples: period,
          amp_q15: Math.max(900, Math.trunc(21000 / p.voices)),
          pan_q15: relation[voice % 3] * 12000,
          phase_u32: relation[voice % 3] < 0 ? 0x40000000 : 0,
          gate_period_samples: p.phase_relation === "syndrome" ? period : 0,
          gate_duty_q15: 13000,
          lfo_rate_millihz: 17 + voice * 11,
          lfo_depth_q15: 2800
        });
      }
      return { tones, master_q15: p.gain_q15, feedback_q15: 1100 };
    }
  });

  Registry.register({
    id: "image_scan",
    name: "Image Scan",
    version: "2.0.0",
    description: "Browser-decoded pixels scanned into time, pitch, edge density, and radial brightness trajectories.",
    claimBoundary: "Native browser image decoding is runtime-dependent; this engine is Replay Safe and never claims cross-browser byte identity.",
    supportedModes: [S.MODES.REPLAY_SAFE],
    defaultExportProfile: "archive",
    requiresSourceKind: "image",
    parameterSchema: [
      {id:"scan_mode",label:"Scan mode",type:"select",default:"luminance",options:[{value:"luminance",label:"Luminance scanline"},{value:"edge_diag",label:"DIAG edge scanline"},{value:"radial",label:"Radial scan"}]},
      {id:"base_hz",label:"Base frequency",type:"range",min:"30",max:"880",step:"1",default:"80",scale:1000,unit:"Hz"},
      {id:"span_hz",label:"Frequency span",type:"range",min:"100",max:"6000",step:"10",default:"2400",scale:1000,unit:"Hz"},
      {id:"bands",label:"Image bands",type:"number",min:"2",max:"12",step:"1",default:"7",scale:1},
      {id:"scan_ms",label:"Column period",type:"range",min:"5",max:"250",step:"1",default:"32",scale:1,unit:"ms"},
      {id:"gain_q15",label:"Master gain",type:"range",min:"0.1",max:"1",step:"0.01",default:"0.64",scale:32767}
    ],
    presets: [
      {id:"luminance_field",name:"Luminance Field",subtitle:"smooth horizontal scan",params:{scan_mode:"luminance",base_hz:"80",span_hz:"2400",bands:"7",scan_ms:"32",gain_q15:"0.64"}},
      {id:"diag_edges",name:"DIAG Edges",subtitle:"transient geometry",params:{scan_mode:"edge_diag",base_hz:"48",span_hz:"3800",bands:"9",scan_ms:"18",gain_q15:"0.56"}},
      {id:"radial_mass",name:"Radial Mass",subtitle:"centre-out orbit",params:{scan_mode:"radial",base_hz:"110",span_hz:"1600",bands:"6",scan_ms:"55",gain_q15:"0.70"}}
    ],
    buildPlan(context) {
      if (!context.source || !context.source.image) throw new Error("Image Scan requires a local PNG, JPEG, or WEBP source.");
      const p = context.parameters;
      const image = context.source.image;
      const luminance = context.source.numeric;
      const tones = [];
      const sequenceLength = Math.min(128, image.width);
      const bounds = { minimum: 0, maximum: 255000000 };
      for (let band = 0; band < p.bands; band += 1) {
        const y0 = Math.floor(band * image.height / p.bands);
        const y1 = Math.max(y0 + 1, Math.floor((band + 1) * image.height / p.bands));
        const sequence = [];
        for (let step = 0; step < sequenceLength; step += 1) {
          const x = Math.min(image.width - 1, Math.floor(step * image.width / sequenceLength));
          let sum = 0;
          let count = 0;
          for (let y = y0; y < y1; y += 1) {
            const center = luminance[y * image.width + x];
            if (p.scan_mode === "edge_diag") {
              const left = luminance[y * image.width + Math.max(0, x - 1)];
              const right = luminance[y * image.width + Math.min(image.width - 1, x + 1)];
              sum += Math.min(bounds.maximum, Math.abs(left - 2 * center + right));
            } else if (p.scan_mode === "radial") {
              const rx = Math.abs(x - image.width / 2);
              const ry = Math.abs(y - image.height / 2);
              sum += Math.trunc(center / (1 + (rx + ry) / Math.max(1, image.width + image.height)));
            } else sum += center;
            count += 1;
          }
          const average = Math.trunc(sum / Math.max(1, count));
          sequence.push(mapRange(average, bounds.minimum, bounds.maximum, p.base_hz, p.base_hz + p.span_hz));
        }
        tones.push({
          kind: p.scan_mode === "edge_diag" ? "pulse" : "sine",
          freq_millihz: sequence[0], sequence_millihz: sequence,
          sequence_period_samples: Math.max(1, Math.trunc(context.profile.sampleRate * p.scan_ms / 1000)),
          amp_q15: Math.max(650, Math.trunc(18000 / p.bands)),
          pan_q15: Math.trunc(-26000 + band * 52000 / Math.max(1, p.bands - 1)),
          phase_u32: (band * 0x1f123bb5) >>> 0,
          lfo_rate_millihz: 19 + band * 7,
          lfo_depth_q15: 3200
        });
      }
      return { tones, master_q15: p.gain_q15, feedback_q15: 900 };
    }
  });

  Registry.register({
    id: "data_mapper",
    name: "Data Mapper",
    version: "2.0.0",
    description: "Generic deterministic mapping for CSV, JSON, text numerics, and binary bytes with explicit time, pitch, amplitude, and pan rules.",
    claimBoundary: "The mapping is reproducible; interpretation and scientific validity remain the user's responsibility.",
    supportedModes: BOTH,
    defaultExportProfile: "archive",
    parameterSchema: [
      {id:"waveform",label:"Timbre",type:"select",default:"sine",options:[{value:"sine",label:"Soft sine"},{value:"triangle",label:"Triangle"},{value:"square",label:"Square"},{value:"saw",label:"Saw"},{value:"pulse",label:"Pulse"}]},
      {id:"base_hz",label:"Base frequency",type:"range",min:"20",max:"1000",step:"1",default:"70",scale:1000,unit:"Hz"},
      {id:"span_hz",label:"Frequency span",type:"range",min:"20",max:"8000",step:"10",default:"1800",scale:1000,unit:"Hz"},
      {id:"voices",label:"Voices",type:"number",min:"1",max:"12",step:"1",default:"5",scale:1},
      {id:"event_ms",label:"Event period",type:"range",min:"5",max:"1000",step:"5",default:"90",scale:1,unit:"ms"},
      {id:"pan_spread_q15",label:"Pan spread",type:"range",min:"0",max:"1",step:"0.01",default:"0.72",scale:32767},
      {id:"gain_q15",label:"Master gain",type:"range",min:"0.1",max:"1",step:"0.01",default:"0.66",scale:32767}
    ],
    presets: [
      {id:"measurement_lines",name:"Measurement Lines",subtitle:"clean mapped voices",params:{waveform:"sine",base_hz:"70",span_hz:"1800",voices:"5",event_ms:"90",pan_spread_q15:"0.72",gain_q15:"0.66"}},
      {id:"binary_geometry",name:"Binary Geometry",subtitle:"hard byte audification",params:{waveform:"square",base_hz:"45",span_hz:"3200",voices:"8",event_ms:"34",pan_spread_q15:"0.90",gain_q15:"0.54"}},
      {id:"slow_series",name:"Slow Series",subtitle:"archival data drone",params:{waveform:"triangle",base_hz:"110",span_hz:"650",voices:"3",event_ms:"377",pan_spread_q15:"0.48",gain_q15:"0.75"}}
    ],
    buildPlan(context) {
      const p = context.parameters;
      const sampled = sampleSeries(numericSource(context), 144);
      const bounds = range(sampled);
      const tones = [];
      const period = Math.max(1, Math.trunc(context.profile.sampleRate * p.event_ms / 1000));
      for (let voice = 0; voice < p.voices; voice += 1) {
        const sequence = [];
        for (let i = voice; i < sampled.length; i += p.voices) {
          sequence.push(mapRange(sampled[i], bounds.minimum, bounds.maximum, p.base_hz, p.base_hz + p.span_hz));
        }
        if (!sequence.length) sequence.push(p.base_hz);
        const spread = Math.trunc(p.pan_spread_q15 * 28000 / 32767);
        tones.push({
          kind: p.waveform,
          freq_millihz: sequence[0], sequence_millihz: sequence,
          sequence_period_samples: period,
          amp_q15: Math.max(700, Math.trunc(19000 / p.voices)),
          pan_q15: p.voices === 1 ? 0 : Math.trunc(-spread + voice * spread * 2 / (p.voices - 1)),
          phase_u32: (voice * 0x9e3779b9) >>> 0,
          lfo_rate_millihz: 9 + voice * 13,
          lfo_depth_q15: 2400
        });
      }
      return { tones, master_q15: p.gain_q15, feedback_q15: p.waveform === "sine" ? 1200 : 0 };
    }
  });
})(window.SPECTRAL);
