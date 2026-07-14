(function (root) {
  'use strict';

  const RB420 = root.RB420 = root.RB420 || {};
  const DSP = RB420.DSP;

  class LiveEngine {
    constructor() {
      this.context = null;
      this.input = null;
      this.master = null;
      this.analyser = null;
      this.filter = null;
      this.distortion = null;
      this.delay = null;
      this.delayFeedback = null;
      this.delayWet = null;
      this.compressor = null;
      this.isPlaying = false;
      this.stepIndex = 0;
      this.nextStepTime = 0;
      this.scheduler = null;
      this.stateProvider = null;
      this.onStep = null;
      this.activeSources = new Set();
      this.previousAcidFrequency = [110, 110];
      this.noiseSeed = new DSP.XorShift32(420338);
      this.capture = null;
      this.curveAmount = -1;
    }

    async ensureContext() {
      if (!this.context) {
        const AudioContextClass = root.AudioContext || root.webkitAudioContext;
        if (!AudioContextClass) throw new Error('Web Audio is not supported by this browser.');
        this.context = new AudioContextClass({ latencyHint: 'interactive' });
        this.buildGraph();
      }
      if (this.context.state === 'suspended') await this.context.resume();
      return this.context;
    }

    buildGraph() {
      const context = this.context;
      this.input = context.createGain();
      this.distortion = context.createWaveShaper();
      this.distortion.oversample = '2x';
      this.filter = context.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.compressor = context.createDynamicsCompressor();
      this.delay = context.createDelay(2.5);
      this.delayFeedback = context.createGain();
      this.delayWet = context.createGain();
      this.master = context.createGain();
      this.analyser = context.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = .72;

      this.input.connect(this.distortion);
      this.distortion.connect(this.filter);
      this.filter.connect(this.compressor);
      this.compressor.connect(this.master);

      this.input.connect(this.delay);
      this.delay.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delay);
      this.delay.connect(this.delayWet);
      this.delayWet.connect(this.master);

      this.master.connect(this.analyser);
      this.analyser.connect(context.destination);
      this.setMasterVolume(78);
      this.updateFX({ distortion: 34, filter: 72, delayTime: 32, feedback: 38, delayMix: 22, compression: 48, bypass: false }, 128);
    }

    setMasterVolume(value) {
      if (!this.master || !this.context) return;
      const gain = DSP.clamp(Number(value) || 0, 0, 100) / 100;
      this.master.gain.setTargetAtTime(gain, this.context.currentTime, .018);
    }

    makeDistortionCurve(amount) {
      const normalized = Math.round(DSP.clamp(Number(amount) || 0, 0, 100));
      if (normalized === this.curveAmount && this.distortion.curve) return this.distortion.curve;
      this.curveAmount = normalized;
      const samples = 2048;
      const curve = new Float32Array(samples);
      const k = normalized * 4.5;
      for (let i = 0; i < samples; i += 1) {
        const x = i * 2 / (samples - 1) - 1;
        curve[i] = normalized === 0 ? x : ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
      }
      return curve;
    }

    updateFX(fx, bpm) {
      if (!this.context || !fx) return;
      const now = this.context.currentTime;
      const bypass = Boolean(fx.bypass);
      this.distortion.curve = this.makeDistortionCurve(bypass ? 0 : fx.distortion);
      const cutoff = bypass ? 20000 : 180 + Math.pow(DSP.clamp(Number(fx.filter) || 0, 0, 100) / 100, 2) * 19000;
      this.filter.frequency.setTargetAtTime(cutoff, now, .02);
      this.filter.Q.setTargetAtTime(bypass ? .0001 : 1.4, now, .02);
      const beat = 60 / DSP.clamp(Number(bpm) || 128, 40, 250);
      const delaySeconds = beat * (.125 + DSP.clamp(Number(fx.delayTime) || 32, 1, 75) / 100 * .875);
      this.delay.delayTime.setTargetAtTime(Math.min(2.4, delaySeconds), now, .02);
      this.delayFeedback.gain.setTargetAtTime(bypass ? 0 : DSP.clamp(Number(fx.feedback) || 0, 0, 90) / 100, now, .02);
      this.delayWet.gain.setTargetAtTime(bypass ? 0 : DSP.clamp(Number(fx.delayMix) || 0, 0, 70) / 100, now, .02);
      const compression = bypass ? 0 : DSP.clamp(Number(fx.compression) || 0, 0, 100);
      this.compressor.threshold.setTargetAtTime(-3 - compression * .32, now, .02);
      this.compressor.ratio.setTargetAtTime(1 + compression * .12, now, .02);
      this.compressor.attack.setTargetAtTime(.004 + (100 - compression) * .00008, now, .02);
      this.compressor.release.setTargetAtTime(.12 + compression * .002, now, .02);
    }

    async start(stateProvider, onStep) {
      await this.ensureContext();
      if (this.isPlaying) return;
      this.stateProvider = stateProvider;
      this.onStep = onStep;
      this.stepIndex = 0;
      this.nextStepTime = this.context.currentTime + .055;
      this.isPlaying = true;
      this.scheduler = root.setInterval(() => this.scheduleAhead(), 20);
      this.scheduleAhead();
    }

    scheduleAhead() {
      if (!this.isPlaying || !this.context || !this.stateProvider) return;
      const horizon = this.context.currentTime + .14;
      while (this.nextStepTime < horizon) {
        const state = this.stateProvider();
        const bpm = DSP.clamp(Number(state.tempo) || 128, 40, 250);
        const swing = DSP.clamp(Number(state.swing) || 0, 0, 60) / 100;
        const base = 60 / bpm / 4;
        const stepDuration = (this.stepIndex & 1) === 0 ? base * (1 + swing) : base * (1 - swing);
        this.updateFX(state.fx, bpm);
        this.setMasterVolume(state.masterVolume);
        this.scheduleStep(state, this.stepIndex, this.nextStepTime, Math.max(.015, stepDuration));
        if (this.onStep) this.onStep(this.stepIndex, this.nextStepTime);
        this.nextStepTime += Math.max(.015, stepDuration);
        this.stepIndex += 1;
      }
    }

    scheduleStep(state, stepIndex, time, duration) {
      const acid = state.acid || [];
      const anySolo = acid.some(machine => machine.solo);
      acid.forEach((machine, index) => {
        if (machine.mute || (anySolo && !machine.solo)) return;
        const pattern = machine.pattern || [];
        const step = pattern.length ? pattern[stepIndex % pattern.length] : null;
        if (step && step.note !== null && step.note !== undefined && step.gate !== false) {
          this.triggerAcid(machine, step, index, time, duration);
        }
      });
      if (state.drums && !state.drums.mute) this.triggerDrumStep(state.drums, stepIndex, time);

      const tracker = state.tracker;
      if (tracker && !tracker.mute && tracker.pattern && tracker.pattern.length) {
        const rowsPerBeat = DSP.clamp(Number(tracker.rowsPerBeat) || 4, 1, 16);
        const row = Math.floor(stepIndex * rowsPerBeat / 4) % tracker.pattern.length;
        if (stepIndex * rowsPerBeat % 4 === 0) this.triggerTrackerRow(tracker, state.samples || [], row, time);
      }
    }

    registerSource(source) {
      this.activeSources.add(source);
      source.addEventListener('ended', () => this.activeSources.delete(source), { once: true });
    }

    triggerAcid(machine, step, index, time, duration) {
      const context = this.context;
      const oscillator = context.createOscillator();
      const filter = context.createBiquadFilter();
      const envelope = context.createGain();
      oscillator.type = machine.waveform === 'square' ? 'square' : 'sawtooth';
      const frequency = 440 * Math.pow(2, (Number(step.note) - 69) / 12);
      const prior = this.previousAcidFrequency[index] || frequency;
      if (step.slide) {
        oscillator.frequency.setValueAtTime(prior, time);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(10, frequency), time + Math.min(duration * .8, .12));
      } else {
        oscillator.frequency.setValueAtTime(frequency, time);
      }
      this.previousAcidFrequency[index] = frequency;
      filter.type = 'lowpass';
      const cutoff = 90 + Math.pow(DSP.clamp(Number(machine.cutoff) || 0, 0, 100) / 100, 2) * 7200;
      const envBoost = 1 + DSP.clamp(Number(machine.envMod) || 0, 0, 100) / 24;
      filter.frequency.setValueAtTime(Math.min(18000, cutoff * envBoost), time);
      filter.frequency.exponentialRampToValueAtTime(Math.max(80, cutoff), time + .05 + DSP.clamp(Number(machine.decay) || 0, 0, 100) * .006);
      filter.Q.setValueAtTime(.5 + DSP.clamp(Number(machine.resonance) || 0, 0, 100) * .22, time);
      const accent = step.accent ? 1 + DSP.clamp(Number(machine.accent) || 0, 0, 100) / 100 : 1;
      const peak = .055 * accent * DSP.clamp(Number(machine.volume) || 0, 0, 100) / 100;
      const release = .045 + DSP.clamp(Number(machine.decay) || 0, 0, 100) * .007;
      envelope.gain.setValueAtTime(.0001, time);
      envelope.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), time + .004);
      envelope.gain.exponentialRampToValueAtTime(.0001, time + Math.max(.04, Math.min(release, duration * (step.slide ? 1.7 : 1.25))));
      oscillator.connect(filter);
      filter.connect(envelope);
      envelope.connect(this.input);
      oscillator.start(time);
      oscillator.stop(time + Math.max(.08, Math.min(release + .08, duration * 2)));
      this.registerSource(oscillator);
    }

    makeNoiseBuffer(seconds) {
      const frames = Math.max(1, Math.round(this.context.sampleRate * seconds));
      const buffer = this.context.createBuffer(1, frames, this.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frames; i += 1) data[i] = this.noiseSeed.signed16() / 32768;
      return buffer;
    }

    triggerKick(time, kit909, level) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(kit909 ? 150 : 105, time);
      oscillator.frequency.exponentialRampToValueAtTime(kit909 ? 42 : 47, time + (kit909 ? .16 : .24));
      gain.gain.setValueAtTime(.0001, time);
      gain.gain.exponentialRampToValueAtTime(.42 * level, time + .003);
      gain.gain.exponentialRampToValueAtTime(.0001, time + (kit909 ? .28 : .42));
      oscillator.connect(gain).connect(this.input);
      oscillator.start(time);
      oscillator.stop(time + .46);
      this.registerSource(oscillator);
    }

    triggerNoiseDrum(time, type, kit909, level) {
      const duration = type === 'openHat' ? .48 : type === 'closedHat' ? .085 : type === 'clap' ? .24 : .28;
      const source = this.context.createBufferSource();
      const filter = this.context.createBiquadFilter();
      const gain = this.context.createGain();
      source.buffer = this.makeNoiseBuffer(duration + .02);
      filter.type = type === 'snare' || type === 'clap' ? 'bandpass' : 'highpass';
      filter.frequency.value = type === 'snare' ? (kit909 ? 1900 : 1300) : type === 'clap' ? 1200 : (kit909 ? 7200 : 5800);
      filter.Q.value = type === 'clap' ? .7 : 1.2;
      gain.gain.setValueAtTime(.0001, time);
      gain.gain.exponentialRampToValueAtTime((type === 'snare' ? .22 : .13) * level, time + .002);
      if (type === 'clap') {
        gain.gain.setValueAtTime(.04 * level, time + .035);
        gain.gain.setValueAtTime(.13 * level, time + .052);
      }
      gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
      source.connect(filter).connect(gain).connect(this.input);
      source.start(time);
      source.stop(time + duration + .03);
      this.registerSource(source);
    }

    triggerRim(time, level) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = 'square';
      oscillator.frequency.value = 940;
      gain.gain.setValueAtTime(.12 * level, time);
      gain.gain.exponentialRampToValueAtTime(.0001, time + .045);
      oscillator.connect(gain).connect(this.input);
      oscillator.start(time);
      oscillator.stop(time + .055);
      this.registerSource(oscillator);
    }

    triggerDrumStep(drums, stepIndex, time) {
      const index = stepIndex % 16;
      const patterns = drums.patterns || {};
      const kit909 = String(drums.kit) === '909';
      const level = DSP.clamp(Number(drums.volume) || 0, 0, 100) / 100;
      if (patterns.kick && patterns.kick[index]) this.triggerKick(time, kit909, level);
      ['snare', 'closedHat', 'openHat', 'clap'].forEach(type => {
        if (patterns[type] && patterns[type][index]) this.triggerNoiseDrum(time, type, kit909, level);
      });
      if (patterns.rim && patterns.rim[index]) this.triggerRim(time, level);
    }

    triggerTrackerRow(tracker, samples, rowIndex, time) {
      const row = tracker.pattern[rowIndex] || [];
      row.forEach((cell, channel) => {
        if (!cell || cell.note === null || cell.note === undefined || !cell.instrument) return;
        const sample = samples[cell.instrument - 1];
        if (!sample || !sample.audioBuffer) return;
        const source = this.context.createBufferSource();
        const gain = this.context.createGain();
        const pan = this.context.createStereoPanner ? this.context.createStereoPanner() : null;
        source.buffer = sample.audioBuffer;
        source.playbackRate.value = Math.pow(2, (Number(cell.note) - Number(sample.rootNote || 60)) / 12);
        gain.gain.value = DSP.clamp(Number(cell.volume) || 64, 0, 64) / 64 * DSP.clamp(Number(tracker.volume) || 78, 0, 100) / 100;
        source.connect(gain);
        if (pan) {
          pan.pan.value = row.length > 1 ? channel / (row.length - 1) * 1.2 - .6 : 0;
          gain.connect(pan).connect(this.input);
        } else gain.connect(this.input);
        source.start(time);
        this.registerSource(source);
      });
    }

    stop() {
      if (this.scheduler) root.clearInterval(this.scheduler);
      this.scheduler = null;
      this.isPlaying = false;
      this.activeSources.forEach(source => {
        try { source.stop(); } catch (error) { /* already stopped */ }
      });
      this.activeSources.clear();
    }

    async playPCM(pcm, when) {
      await this.ensureContext();
      const source = this.context.createBufferSource();
      source.buffer = DSP.audioBufferFromPCM(this.context, pcm);
      source.connect(this.input);
      source.start(when || this.context.currentTime);
      this.registerSource(source);
      return source;
    }

    async installAudioBuffer(sample) {
      await this.ensureContext();
      sample.audioBuffer = DSP.audioBufferFromPCM(this.context, sample);
      return sample.audioBuffer;
    }

    async startLiveCapture(durationSeconds, onProgress, onDone) {
      await this.ensureContext();
      if (this.capture) throw new Error('A live capture is already in progress.');
      const framesTarget = Math.max(1, Math.round(this.context.sampleRate * DSP.clamp(Number(durationSeconds) || 1, .1, 30)));
      const left = new Float32Array(framesTarget);
      const right = new Float32Array(framesTarget);
      const processor = this.context.createScriptProcessor(4096, 2, 2);
      const silent = this.context.createGain();
      silent.gain.value = 0;
      const capture = this.capture = { processor, silent, left, right, written: 0, framesTarget, onProgress, onDone, finishing: false };
      processor.onaudioprocess = event => {
        const out = event.outputBuffer;
        for (let c = 0; c < out.numberOfChannels; c += 1) out.getChannelData(c).fill(0);
        if (!this.capture || capture.finishing) return;
        const input = event.inputBuffer;
        const sourceL = input.getChannelData(0);
        const sourceR = input.numberOfChannels > 1 ? input.getChannelData(1) : sourceL;
        const count = Math.min(sourceL.length, capture.framesTarget - capture.written);
        capture.left.set(sourceL.subarray(0, count), capture.written);
        capture.right.set(sourceR.subarray(0, count), capture.written);
        capture.written += count;
        if (capture.onProgress) capture.onProgress(capture.written / capture.framesTarget);
        if (capture.written >= capture.framesTarget) {
          capture.finishing = true;
          root.setTimeout(() => this.finishLiveCapture(false), 0);
        }
      };
      this.master.connect(processor);
      processor.connect(silent);
      silent.connect(this.context.destination);
    }

    finishLiveCapture(cancelled) {
      const capture = this.capture;
      if (!capture) return null;
      this.capture = null;
      capture.finishing = true;
      capture.processor.onaudioprocess = null;
      try { this.master.disconnect(capture.processor); } catch (error) { /* disconnected */ }
      try { capture.processor.disconnect(); } catch (error) { /* disconnected */ }
      try { capture.silent.disconnect(); } catch (error) { /* disconnected */ }
      if (cancelled || capture.written === 0) return null;
      const floatsL = capture.left.subarray(0, capture.written);
      const floatsR = capture.right.subarray(0, capture.written);
      const pcm = DSP.floatToInt16(floatsL, floatsR);
      const result = {
        left: pcm.left,
        right: pcm.right,
        sampleRate: this.context.sampleRate,
        frames: pcm.left.length,
        duration: pcm.left.length / this.context.sampleRate,
        digest: DSP.hashInt16(pcm.left, pcm.right)
      };
      if (capture.onDone) capture.onDone(result);
      return result;
    }

    stopLiveCapture() {
      return this.finishLiveCapture(false);
    }

    cancelLiveCapture() {
      return this.finishLiveCapture(true);
    }
  }

  RB420.LiveEngine = LiveEngine;
}(typeof window !== 'undefined' ? window : globalThis));
