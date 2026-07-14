(function (root) {
  'use strict';

  const RB420 = root.RB420 = root.RB420 || {};
  const TWO32 = 4294967296;
  const VERSION = '1.0.0';

  function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
  }

  function toInt(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : (fallback || 0);
  }

  function stableStringify(value) {
    if (value === null) return 'null';
    if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null';
    if (typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
    if (ArrayBuffer.isView(value)) return '[' + Array.prototype.map.call(value, stableStringify).join(',') + ']';
    if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
    if (typeof value === 'object') {
      return '{' + Object.keys(value).sort().map(function (key) {
        return JSON.stringify(key) + ':' + stableStringify(value[key]);
      }).join(',') + '}';
    }
    return 'null';
  }

  function fnv1aString(text) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      hash ^= code & 255;
      hash = Math.imul(hash, 0x01000193) >>> 0;
      hash ^= code >>> 8;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return ('00000000' + hash.toString(16)).slice(-8);
  }

  function hashInt16(left, right) {
    let hash = 0x811c9dc5;
    const len = left.length;
    for (let i = 0; i < len; i += 1) {
      let v = left[i] & 0xffff;
      hash ^= v & 255;
      hash = Math.imul(hash, 0x01000193) >>> 0;
      hash ^= v >>> 8;
      hash = Math.imul(hash, 0x01000193) >>> 0;
      if (right) {
        v = right[i] & 0xffff;
        hash ^= v & 255;
        hash = Math.imul(hash, 0x01000193) >>> 0;
        hash ^= v >>> 8;
        hash = Math.imul(hash, 0x01000193) >>> 0;
      }
    }
    return ('00000000' + hash.toString(16)).slice(-8);
  }

  class XorShift32 {
    constructor(seed) {
      this.state = (toInt(seed, 1) >>> 0) || 0x6d2b79f5;
    }
    next() {
      let x = this.state >>> 0;
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      this.state = x >>> 0;
      return this.state;
    }
    int(max) {
      return max > 0 ? this.next() % max : 0;
    }
    signed16() {
      return (this.next() >>> 16) - 32768;
    }
  }

  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  function noteName(midi) {
    const note = clamp(toInt(midi, 60), 0, 127);
    return NOTE_NAMES[note % 12] + (Math.floor(note / 12) - 1);
  }

  function trackerNoteName(midi) {
    return noteName(midi).replace('#', '#').padEnd(3, '-').slice(0, 3);
  }

  function phaseIncrement(midi, sampleRate) {
    const freq = 440 * Math.pow(2, (clamp(midi, 0, 127) - 69) / 12);
    return Math.max(1, Math.round(freq * TWO32 / sampleRate)) >>> 0;
  }

  function sawFromPhase(phase) {
    return (phase >>> 16) - 32768;
  }

  function squareFromPhase(phase) {
    return (phase >>> 31) ? -32768 : 32767;
  }

  function triangleFromPhase(phase) {
    const p = phase >>> 16;
    return p < 32768 ? (p * 2 - 32768) : (98303 - p * 2);
  }

  function stepBoundary(step, sampleRate, bpm, swing) {
    const numerator = step * sampleRate * 15;
    let boundary = Math.floor(numerator / bpm);
    if ((step & 1) === 1 && swing > 0) {
      boundary += Math.floor(sampleRate * 15 * clamp(swing, 0, 60) / (bpm * 200));
    }
    return boundary;
  }

  function rowBoundary(row, sampleRate, bpm, rowsPerBeat) {
    return Math.floor(row * sampleRate * 60 / (bpm * rowsPerBeat));
  }

  function makeAcidVoice() {
    return {
      phase: 0,
      increment: 0,
      targetIncrement: 0,
      envelope: 0,
      filter: 0,
      filterPrevious: 0,
      gateUntil: 0,
      accent: false,
      slide: false,
      active: false
    };
  }

  function triggerAcid(voice, machine, step, frame, nextFrame, sampleRate) {
    if (!step || step.note === null || step.note === undefined || step.gate === false) {
      voice.gateUntil = frame;
      return;
    }
    const target = phaseIncrement(toInt(step.note, 48), sampleRate);
    if (!voice.active || !step.slide) voice.increment = target;
    voice.targetIncrement = target;
    voice.phase = step.slide && voice.active ? voice.phase : 0;
    voice.envelope = 32767;
    voice.gateUntil = frame + Math.max(1, Math.floor((nextFrame - frame) * (step.slide ? 1.18 : .88)));
    voice.accent = Boolean(step.accent);
    voice.slide = Boolean(step.slide);
    voice.active = true;
  }

  function acidSample(voice, machine, frame) {
    if (!voice.active) return 0;
    if (voice.slide && voice.increment !== voice.targetIncrement) {
      const delta = voice.targetIncrement - voice.increment;
      voice.increment = (voice.increment + (delta > 0 ? Math.max(1, Math.floor(delta / 1600)) : Math.min(-1, Math.ceil(delta / 1600)))) >>> 0;
    }
    voice.phase = (voice.phase + voice.increment) >>> 0;
    const waveform = machine.waveform === 'square' ? squareFromPhase(voice.phase) : sawFromPhase(voice.phase);
    const decay = 5 + (100 - clamp(toInt(machine.decay, 50), 0, 100)) * 3;
    if (voice.envelope > 0) {
      voice.envelope -= Math.max(1, Math.floor(voice.envelope * decay / 65536));
      if (voice.envelope < 2) voice.envelope = 0;
    }
    if (frame >= voice.gateUntil && voice.envelope > 0) {
      voice.envelope -= Math.max(1, Math.floor(voice.envelope / 800));
    }
    const cutoff = clamp(toInt(machine.cutoff, 50), 0, 100);
    const envMod = clamp(toInt(machine.envMod, 50), 0, 100);
    const resonance = clamp(toInt(machine.resonance, 50), 0, 100);
    const coefficient = clamp(650 + cutoff * 165 + Math.floor(voice.envelope * envMod / 250), 350, 30700);
    const velocity = voice.accent ? 100 + Math.floor(clamp(toInt(machine.accent, 70), 0, 100) * .5) : 82;
    const feedback = Math.trunc((voice.filter - voice.filterPrevious) * resonance / 112);
    const input = clamp(waveform - feedback, -49152, 49151);
    voice.filterPrevious = voice.filter;
    voice.filter += Math.trunc((input - voice.filter) * coefficient / 32768);
    let out = Math.trunc(voice.filter * voice.envelope / 32768);
    out = Math.trunc(out * velocity / 100);
    out = Math.trunc(out * clamp(toInt(machine.volume, 75), 0, 100) / 100);
    return clamp(out, -32768, 32767);
  }

  function makeDrumState() {
    return {
      env: { kick: 0, snare: 0, closedHat: 0, openHat: 0, clap: 0, rim: 0 },
      kickPhase: 0,
      snarePhase: 0,
      rimPhase: 0,
      previousNoise: 0,
      clapCounter: 0
    };
  }

  function triggerDrums(drumState, drums, stepIndex) {
    const length = 16;
    const index = ((stepIndex % length) + length) % length;
    Object.keys(drumState.env).forEach(function (lane) {
      const pattern = drums.patterns && drums.patterns[lane];
      if (pattern && pattern[index]) {
        drumState.env[lane] = 32767;
        if (lane === 'kick') drumState.kickPhase = 0;
        if (lane === 'snare') drumState.snarePhase = 0;
        if (lane === 'rim') drumState.rimPhase = 0;
        if (lane === 'clap') drumState.clapCounter = 0;
      }
    });
  }

  function decayEnvelope(state, key, amount) {
    const value = state.env[key];
    if (value <= 0) return 0;
    const next = value - Math.max(1, Math.floor(value * amount / 65536));
    state.env[key] = next < 2 ? 0 : next;
    return value;
  }

  function drumSample(state, drums, rng, sampleRate) {
    const kit909 = String(drums.kit) === '909';
    let out = 0;
    const noiseNeeded = state.env.snare || state.env.closedHat || state.env.openHat || state.env.clap;
    const noise = noiseNeeded ? rng.signed16() : 0;
    const highNoise = clamp(noise - state.previousNoise, -32768, 32767);
    state.previousNoise = noise;

    const kickEnv = decayEnvelope(state, 'kick', kit909 ? 82 : 58);
    if (kickEnv) {
      state.kickPhase = (state.kickPhase + 4200000 + kickEnv * (kit909 ? 58 : 76)) >>> 0;
      const body = triangleFromPhase(state.kickPhase);
      out += Math.trunc(body * kickEnv / 32768);
      if (kit909 && kickEnv > 28000) out += Math.trunc(highNoise * (kickEnv - 28000) / 9000);
    }

    const snareEnv = decayEnvelope(state, 'snare', kit909 ? 112 : 85);
    if (snareEnv) {
      state.snarePhase = (state.snarePhase + (kit909 ? 17500000 : 13200000)) >>> 0;
      const tone = triangleFromPhase(state.snarePhase);
      out += Math.trunc((noise * 3 + tone) * snareEnv / 131072);
    }

    const closedEnv = decayEnvelope(state, 'closedHat', kit909 ? 390 : 330);
    if (closedEnv) out += Math.trunc(highNoise * closedEnv / 65536);

    const openEnv = decayEnvelope(state, 'openHat', kit909 ? 48 : 38);
    if (openEnv) out += Math.trunc(highNoise * openEnv / 98304);

    const clapEnv = decayEnvelope(state, 'clap', kit909 ? 105 : 86);
    if (clapEnv) {
      state.clapCounter += 1;
      const burst = state.clapCounter < sampleRate / 90 || (state.clapCounter > sampleRate / 70 && state.clapCounter < sampleRate / 48) ? 1 : .42;
      out += Math.trunc(noise * clapEnv * burst / 65536);
    }

    const rimEnv = decayEnvelope(state, 'rim', 540);
    if (rimEnv) {
      state.rimPhase = (state.rimPhase + 31000000) >>> 0;
      out += Math.trunc(squareFromPhase(state.rimPhase) * rimEnv / 98304);
    }

    const drive = 1 + clamp(toInt(drums.drive, 20), 0, 100) * 3 / 100;
    out = clamp(Math.trunc(out * drive), -32768, 32767);
    out = Math.trunc(out * clamp(toInt(drums.volume, 82), 0, 100) / 100);
    return out;
  }

  function makeSamplePlayers(count) {
    return Array.from({ length: count }, function () {
      return { sample: null, positionQ16: 0, stepQ16: 65536, volume: 64, active: false };
    });
  }

  function triggerTrackerRow(players, tracker, samples, rowIndex, sampleRate) {
    const rows = tracker.pattern || [];
    if (!rows.length) return;
    const row = rows[rowIndex % rows.length] || [];
    for (let channel = 0; channel < players.length; channel += 1) {
      const cell = row[channel];
      if (!cell || cell.note === null || cell.note === undefined || !cell.instrument) continue;
      const sample = samples[cell.instrument - 1];
      if (!sample || !sample.pcmLeft || !sample.pcmLeft.length) continue;
      const rootNote = toInt(sample.rootNote, 60);
      const ratio = Math.pow(2, (toInt(cell.note, rootNote) - rootNote) / 12);
      const sourceRate = toInt(sample.sampleRate, sampleRate);
      players[channel] = {
        sample: sample,
        positionQ16: 0,
        stepQ16: Math.max(1, Math.round(sourceRate / sampleRate * ratio * 65536)),
        volume: clamp(toInt(cell.volume, 64), 0, 64),
        active: true
      };
    }
  }

  function trackerSample(players, trackerVolume) {
    let left = 0;
    let right = 0;
    for (let i = 0; i < players.length; i += 1) {
      const player = players[i];
      if (!player.active || !player.sample) continue;
      const index = player.positionQ16 >>> 16;
      const sourceLeft = player.sample.pcmLeft;
      const sourceRight = player.sample.pcmRight || sourceLeft;
      if (index >= sourceLeft.length) {
        player.active = false;
        continue;
      }
      const level = player.volume / 64;
      const pan = players.length > 1 ? i / (players.length - 1) : .5;
      left += Math.trunc(sourceLeft[index] * level * (1.15 - pan * .3));
      right += Math.trunc(sourceRight[index] * level * (.85 + pan * .3));
      player.positionQ16 += player.stepQ16;
    }
    const gain = clamp(toInt(trackerVolume, 78), 0, 100) / 100;
    return [Math.trunc(left * gain), Math.trunc(right * gain)];
  }

  function hasSolo(project) {
    return Boolean(project.acid && project.acid.some(function (machine) { return machine.solo; }));
  }

  function renderProject(project, durationSeconds, requestedSampleRate) {
    const sampleRate = requestedSampleRate === 48000 ? 48000 : 44100;
    const duration = clamp(Number(durationSeconds) || 1, .1, 30);
    const frames = Math.max(1, Math.round(sampleRate * duration));
    const left = new Int16Array(frames);
    const right = new Int16Array(frames);
    const bpm = clamp(toInt(project.tempo, 128), 40, 250);
    const swing = clamp(toInt(project.swing, 0), 0, 60);
    const seed = toInt(project.seed, 420338) >>> 0;
    const rng = new XorShift32(seed);
    const acidMachines = project.acid || [];
    const acidVoices = [makeAcidVoice(), makeAcidVoice()];
    const drumState = makeDrumState();
    const samples = project.samples || [];
    const tracker = project.tracker || { pattern: [], rowsPerBeat: 4, volume: 78, mute: false };
    const players = makeSamplePlayers(8);
    const solo = hasSolo(project);

    const fx = project.fx || {};
    const delayRatio = .125 + clamp(toInt(fx.delayTime, 32), 1, 75) / 100 * .875;
    const delayFrames = Math.max(1, Math.floor(sampleRate * 60 / bpm * delayRatio));
    const delayLeft = new Int32Array(delayFrames);
    const delayRight = new Int32Array(delayFrames);
    let delayIndex = 0;
    let masterFilterLeft = 0;
    let masterFilterRight = 0;

    let sequenceStep = 0;
    let nextStep = 0;
    let trackerRow = 0;
    let nextRow = 0;
    const rowsPerBeat = clamp(toInt(tracker.rowsPerBeat, 4), 1, 16);

    for (let frame = 0; frame < frames; frame += 1) {
      while (frame >= nextStep) {
        const nextBoundary = stepBoundary(sequenceStep + 1, sampleRate, bpm, swing);
        for (let m = 0; m < acidMachines.length && m < acidVoices.length; m += 1) {
          const machine = acidMachines[m];
          const pattern = machine.pattern || [];
          const step = pattern.length ? pattern[sequenceStep % pattern.length] : null;
          triggerAcid(acidVoices[m], machine, step, frame, nextBoundary, sampleRate);
        }
        if (project.drums && !project.drums.mute) triggerDrums(drumState, project.drums, sequenceStep);
        sequenceStep += 1;
        nextStep = stepBoundary(sequenceStep, sampleRate, bpm, swing);
      }

      while (frame >= nextRow) {
        if (!tracker.mute) triggerTrackerRow(players, tracker, samples, trackerRow, sampleRate);
        trackerRow += 1;
        nextRow = rowBoundary(trackerRow, sampleRate, bpm, rowsPerBeat);
      }

      let acidMix = 0;
      for (let m = 0; m < acidMachines.length && m < acidVoices.length; m += 1) {
        const machine = acidMachines[m];
        if (machine.mute || (solo && !machine.solo)) continue;
        acidMix += acidSample(acidVoices[m], machine, frame);
      }
      const drums = project.drums && !project.drums.mute ? drumSample(drumState, project.drums, rng, sampleRate) : 0;
      const trackerMix = tracker.mute ? [0, 0] : trackerSample(players, tracker.volume);
      let dryLeft = acidMix + drums + trackerMix[0];
      let dryRight = acidMix + drums + trackerMix[1];

      if (!fx.bypass) {
        const drive = 1 + clamp(toInt(fx.distortion, 30), 0, 100) * 7 / 100;
        dryLeft = clamp(Math.trunc(dryLeft * drive), -39321, 39321);
        dryRight = clamp(Math.trunc(dryRight * drive), -39321, 39321);
        const filterCoefficient = clamp(500 + clamp(toInt(fx.filter, 72), 0, 100) * 295, 400, 30100);
        masterFilterLeft += Math.trunc((dryLeft - masterFilterLeft) * filterCoefficient / 32768);
        masterFilterRight += Math.trunc((dryRight - masterFilterRight) * filterCoefficient / 32768);
        dryLeft = masterFilterLeft;
        dryRight = masterFilterRight;
      }

      const delayedLeft = delayLeft[delayIndex];
      const delayedRight = delayRight[delayIndex];
      if (!fx.bypass) {
        const feedback = clamp(toInt(fx.feedback, 38), 0, 90);
        delayLeft[delayIndex] = clamp(dryLeft + Math.trunc(delayedRight * feedback / 100), -65536, 65535);
        delayRight[delayIndex] = clamp(dryRight + Math.trunc(delayedLeft * feedback / 100), -65536, 65535);
        const mix = clamp(toInt(fx.delayMix, 22), 0, 70);
        dryLeft += Math.trunc(delayedLeft * mix / 100);
        dryRight += Math.trunc(delayedRight * mix / 100);
      }
      delayIndex += 1;
      if (delayIndex >= delayFrames) delayIndex = 0;

      const compression = fx.bypass ? 0 : clamp(toInt(fx.compression, 48), 0, 100);
      const threshold = 30000 - compression * 150;
      if (Math.abs(dryLeft) > threshold) dryLeft = (dryLeft < 0 ? -1 : 1) * (threshold + Math.floor((Math.abs(dryLeft) - threshold) / 4));
      if (Math.abs(dryRight) > threshold) dryRight = (dryRight < 0 ? -1 : 1) * (threshold + Math.floor((Math.abs(dryRight) - threshold) / 4));
      const master = clamp(toInt(project.masterVolume, 78), 0, 100);
      left[frame] = clamp(Math.trunc(dryLeft * master / 135), -32768, 32767);
      right[frame] = clamp(Math.trunc(dryRight * master / 135), -32768, 32767);
    }

    const digest = hashInt16(left, right);
    return { left: left, right: right, sampleRate: sampleRate, frames: frames, duration: frames / sampleRate, digest: digest };
  }

  const SCALES = {
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    pentatonic: [0, 3, 5, 7, 10],
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  };

  function makePluck(note, sampleRate, rng, level) {
    const frequency = 440 * Math.pow(2, (note - 69) / 12);
    const size = clamp(Math.round(sampleRate / frequency), 16, 1400);
    const line = new Int32Array(size);
    for (let i = 0; i < size; i += 1) line[i] = Math.trunc(rng.signed16() * level / 100);
    return { line: line, index: 0, age: 0, maxAge: sampleRate * 3, active: true };
  }

  function renderSoundLab(config, tempo, requestedSampleRate) {
    const sampleRate = requestedSampleRate === 48000 ? 48000 : 44100;
    const bpm = clamp(toInt(tempo, 128), 40, 250);
    const bars = clamp(toInt(config.bars, 2), 1, 4);
    const frames = Math.max(1, Math.floor(sampleRate * 60 / bpm * 4 * bars));
    const left = new Int16Array(frames);
    const right = new Int16Array(frames);
    const seed = toInt(config.seed, 6581420) >>> 0;
    const rng = new XorShift32(seed);
    const scale = SCALES[config.scale] || SCALES.minor;
    const rootNote = clamp(toInt(config.root, 36) + toInt(config.octave, 0), 24, 84);
    const style = String(config.style || 'acid-rock');
    const guitarLevel = clamp(toInt(config.guitar, 70), 0, 100);
    const synthLevel = clamp(toInt(config.synth, 64), 0, 100);
    const bassLevel = clamp(toInt(config.bass, 48), 0, 100);
    const textureLevel = clamp(toInt(config.texture, 22), 0, 100);
    const drive = clamp(toInt(config.drive, 38), 0, 100);
    const space = clamp(toInt(config.space, 20), 0, 100);
    const eighth = sampleRate * 30 / bpm;
    const sixteenth = sampleRate * 15 / bpm;
    let nextEvent = 0;
    let event = 0;
    let synthPhase = 0;
    let synthIncrement = phaseIncrement(rootNote + 12, sampleRate);
    let synthEnvelope = 0;
    let synthFilter = 0;
    let bassPhase = 0;
    let bassIncrement = phaseIncrement(rootNote - 12, sampleRate);
    let bassEnvelope = 0;
    let textureEnvelope = 0;
    const plucks = [];
    const delayFrames = Math.max(1, Math.floor(sampleRate * 60 / bpm * (.25 + space / 200)));
    const delayL = new Int32Array(delayFrames);
    const delayR = new Int32Array(delayFrames);
    let delayIndex = 0;

    const styleBias = {
      'acid-rock': [0, 4, 2, 5, 1, 4, 6, 2],
      'machine-funk': [0, 2, 4, 1, 5, 3, 6, 1],
      'dark-country': [0, 2, 4, 3, 1, 5, 2, 0],
      industrial: [0, 1, 4, 2, 6, 1, 3, 5],
      'tracker-core': [0, 4, 1, 5, 2, 6, 3, 1]
    }[style] || [0, 2, 4, 1, 5, 3, 6, 1];

    for (let frame = 0; frame < frames; frame += 1) {
      if (frame >= nextEvent) {
        const degree = styleBias[event % styleBias.length] + (rng.int(5) === 0 ? 1 : 0);
        const note = rootNote + scale[degree % scale.length] + (degree >= scale.length ? 12 : 0);
        synthIncrement = phaseIncrement(note + 12, sampleRate);
        synthEnvelope = 32767;
        if ((event & 1) === 0) plucks.push(makePluck(note + (style === 'dark-country' ? 12 : 0), sampleRate, rng, guitarLevel));
        if (event % 4 === 0) {
          bassIncrement = phaseIncrement(rootNote - 12 + scale[(event / 4) % scale.length | 0], sampleRate);
          bassEnvelope = 32767;
        }
        if (style === 'industrial' || style === 'tracker-core') textureEnvelope = 32767;
        event += 1;
        nextEvent = Math.floor(event * (style === 'tracker-core' ? sixteenth : eighth));
      }

      let guitar = 0;
      for (let p = plucks.length - 1; p >= 0; p -= 1) {
        const voice = plucks[p];
        if (!voice.active) { plucks.splice(p, 1); continue; }
        const a = voice.line[voice.index];
        const b = voice.line[(voice.index + 1) % voice.line.length];
        const damping = style === 'dark-country' ? 32620 : 32440;
        voice.line[voice.index] = Math.trunc(((a + b) >> 1) * damping / 32768);
        voice.index = (voice.index + 1) % voice.line.length;
        voice.age += 1;
        if (voice.age > voice.maxAge || Math.abs(a) < 2) voice.active = false;
        guitar += a;
      }

      synthPhase = (synthPhase + synthIncrement) >>> 0;
      let synth = style === 'tracker-core' ? squareFromPhase(synthPhase) : sawFromPhase(synthPhase);
      synthEnvelope -= synthEnvelope > 0 ? Math.max(1, Math.floor(synthEnvelope * 22 / 65536)) : 0;
      synthFilter += Math.trunc((synth - synthFilter) * (6000 + synthEnvelope / 2) / 32768);
      synth = Math.trunc(synthFilter * synthEnvelope / 32768 * synthLevel / 100);

      bassPhase = (bassPhase + bassIncrement) >>> 0;
      let bass = triangleFromPhase(bassPhase);
      bassEnvelope -= bassEnvelope > 0 ? Math.max(1, Math.floor(bassEnvelope * 8 / 65536)) : 0;
      bass = Math.trunc(bass * bassEnvelope / 32768 * bassLevel / 100);

      let texture = 0;
      if (textureEnvelope > 0) {
        const noise = rng.signed16();
        texture = Math.trunc(noise * textureEnvelope / 32768 * textureLevel / 100);
        textureEnvelope -= Math.max(1, Math.floor(textureEnvelope * 155 / 65536));
      }

      let dry = Math.trunc(guitar * guitarLevel / 130) + synth + bass + texture;
      dry = clamp(Math.trunc(dry * (1 + drive * .065)), -42000, 42000);
      const delayedL = delayL[delayIndex];
      const delayedR = delayR[delayIndex];
      delayL[delayIndex] = clamp(dry + Math.trunc(delayedR * space / 130), -65536, 65535);
      delayR[delayIndex] = clamp(Math.trunc(dry * .92) + Math.trunc(delayedL * space / 130), -65536, 65535);
      delayIndex = (delayIndex + 1) % delayFrames;
      left[frame] = clamp(Math.trunc((dry + delayedL * space / 100) * .42), -32768, 32767);
      right[frame] = clamp(Math.trunc((dry * .94 + delayedR * space / 100) * .42), -32768, 32767);
    }

    let peak = 1;
    for (let i = 0; i < frames; i += 1) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    const normalize = Math.min(1, 29200 / peak);
    if (normalize < 1) {
      for (let i = 0; i < frames; i += 1) {
        left[i] = Math.trunc(left[i] * normalize);
        right[i] = Math.trunc(right[i] * normalize);
      }
    }
    return { left: left, right: right, sampleRate: sampleRate, frames: frames, duration: frames / sampleRate, digest: hashInt16(left, right) };
  }

  function encodeWav(left, right, sampleRate) {
    const channels = right ? 2 : 1;
    const frames = left.length;
    const dataSize = frames * channels * 2;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    function ascii(offset, text) {
      for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
    }
    ascii(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    ascii(8, 'WAVE');
    ascii(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true);
    ascii(36, 'data');
    view.setUint32(40, dataSize, true);
    let offset = 44;
    for (let i = 0; i < frames; i += 1) {
      view.setInt16(offset, left[i], true);
      offset += 2;
      if (right) {
        view.setInt16(offset, right[i], true);
        offset += 2;
      }
    }
    return buffer;
  }

  function decodeWavPCM16(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    if (view.byteLength < 44) return null;
    function text(offset, length) {
      let value = '';
      for (let i = 0; i < length; i += 1) value += String.fromCharCode(view.getUint8(offset + i));
      return value;
    }
    if (text(0, 4) !== 'RIFF' || text(8, 4) !== 'WAVE') return null;
    let offset = 12;
    let format = null;
    let dataOffset = -1;
    let dataSize = 0;
    while (offset + 8 <= view.byteLength) {
      const id = text(offset, 4);
      const size = view.getUint32(offset + 4, true);
      const payload = offset + 8;
      if (payload + size > view.byteLength) return null;
      if (id === 'fmt ' && size >= 16) {
        format = {
          audioFormat: view.getUint16(payload, true),
          channels: view.getUint16(payload + 2, true),
          sampleRate: view.getUint32(payload + 4, true),
          bits: view.getUint16(payload + 14, true)
        };
      } else if (id === 'data') {
        dataOffset = payload;
        dataSize = size;
      }
      offset = payload + size + (size & 1);
    }
    if (!format || dataOffset < 0 || format.audioFormat !== 1 || format.bits !== 16 || (format.channels !== 1 && format.channels !== 2)) return null;
    const frames = Math.floor(dataSize / (format.channels * 2));
    const left = new Int16Array(frames);
    const right = new Int16Array(frames);
    let cursor = dataOffset;
    for (let i = 0; i < frames; i += 1) {
      left[i] = view.getInt16(cursor, true);
      cursor += 2;
      right[i] = format.channels === 2 ? view.getInt16(cursor, true) : left[i];
      if (format.channels === 2) cursor += 2;
    }
    return { left: left, right: right, sampleRate: format.sampleRate, frames: frames, duration: frames / format.sampleRate, digest: hashInt16(left, right) };
  }

  function floatToInt16(leftFloat, rightFloat) {
    const frames = leftFloat.length;
    const left = new Int16Array(frames);
    const right = new Int16Array(frames);
    for (let i = 0; i < frames; i += 1) {
      left[i] = clamp(Math.round(clamp(leftFloat[i], -1, 1) * (leftFloat[i] < 0 ? 32768 : 32767)), -32768, 32767);
      const sample = rightFloat ? rightFloat[i] : leftFloat[i];
      right[i] = clamp(Math.round(clamp(sample, -1, 1) * (sample < 0 ? 32768 : 32767)), -32768, 32767);
    }
    return { left: left, right: right };
  }

  function audioBufferFromPCM(context, pcm) {
    const sourceLeft = pcm.left || pcm.pcmLeft;
    const sourceRight = pcm.right || pcm.pcmRight || sourceLeft;
    if (!sourceLeft || !sourceLeft.length) throw new Error('PCM source has no samples.');
    const buffer = context.createBuffer(2, sourceLeft.length, pcm.sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    for (let i = 0; i < sourceLeft.length; i += 1) {
      left[i] = sourceLeft[i] / 32768;
      right[i] = sourceRight[i] / 32768;
    }
    return buffer;
  }

  function makeRecipe(serializableProject, duration, sampleRate, sampleMetadata) {
    const core = {
      schema: 'rb420.deterministic-recipe.v1',
      appVersion: VERSION,
      renderer: 'RB420_INTEGER_PCM_V1',
      mode: 'deterministic',
      durationFrames: Math.round(sampleRate * duration),
      sampleRate: sampleRate,
      project: serializableProject,
      samples: sampleMetadata || []
    };
    const canonical = stableStringify(core);
    return Object.assign({}, core, { recipeId: 'rb420-' + fnv1aString(canonical) });
  }

  function download(filename, data, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: type || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
  }

  RB420.DSP = {
    VERSION: VERSION,
    XorShift32: XorShift32,
    clamp: clamp,
    stableStringify: stableStringify,
    fnv1aString: fnv1aString,
    hashInt16: hashInt16,
    noteName: noteName,
    trackerNoteName: trackerNoteName,
    phaseIncrement: phaseIncrement,
    renderProject: renderProject,
    renderSoundLab: renderSoundLab,
    encodeWav: encodeWav,
    decodeWavPCM16: decodeWavPCM16,
    floatToInt16: floatToInt16,
    audioBufferFromPCM: audioBufferFromPCM,
    makeRecipe: makeRecipe,
    download: download
  };
}(typeof window !== 'undefined' ? window : globalThis));
