(function () {
  'use strict';

  const DSP = window.RB420.DSP;
  const results = [];

  function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
  }

  function equalInt16(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
    return true;
  }

  function testState(seed) {
    const acidPattern = Array(16).fill(null);
    acidPattern[0] = { note: 36, gate: true, accent: true, slide: false };
    acidPattern[3] = { note: 43, gate: true, accent: false, slide: true };
    acidPattern[6] = { note: 46, gate: true, accent: false, slide: false };
    const empty = Array(16).fill(false);
    return {
      tempo: 128,
      swing: 12,
      masterVolume: 78,
      seed: seed,
      acid: [{ cutoff: 58, resonance: 72, envMod: 64, decay: 54, accent: 76, volume: 76, waveform: 'saw', mute: false, solo: false, pattern: acidPattern }],
      drums: {
        kit: '808', volume: 82, drive: 28, mute: false,
        patterns: {
          kick: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
          snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
          closedHat: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
          openHat: empty.slice(), clap: empty.slice(), rim: empty.slice()
        }
      },
      fx: { distortion: 34, filter: 72, delayTime: 32, feedback: 38, delayMix: 22, compression: 48, bypass: false },
      tracker: { rows: 4, rowsPerBeat: 4, volume: 78, mute: false, pattern: Array.from({ length: 4 }, () => Array.from({ length: 8 }, () => ({ note: null, instrument: 0, volume: 64, effect: '---' }))) },
      samples: []
    };
  }

  function run(name, fn) {
    const started = performance.now();
    try {
      fn();
      results.push({ name: name, passed: true, ms: performance.now() - started });
    } catch (error) {
      results.push({ name: name, passed: false, ms: performance.now() - started, error: error.message });
    }
  }

  run('Stable serialization sorts object keys', function () {
    assert(DSP.stableStringify({ z: 1, a: 2 }) === DSP.stableStringify({ a: 2, z: 1 }), 'canonical strings differ');
  });

  run('Identical project renders identical PCM', function () {
    const a = DSP.renderProject(testState(420338), .4, 44100);
    const b = DSP.renderProject(testState(420338), .4, 44100);
    assert(a.digest === b.digest, 'digests differ');
    assert(equalInt16(a.left, b.left) && equalInt16(a.right, b.right), 'sample arrays differ');
  });

  run('Seed mutation changes noise-bearing PCM', function () {
    const a = DSP.renderProject(testState(1), .4, 44100);
    const b = DSP.renderProject(testState(2), .4, 44100);
    assert(a.digest !== b.digest, 'different seeds produced the same digest');
  });

  run('PCM16 WAV round-trip is exact', function () {
    const source = DSP.renderProject(testState(73), .25, 44100);
    const wav = DSP.encodeWav(source.left, source.right, source.sampleRate);
    const decoded = DSP.decodeWavPCM16(wav);
    assert(decoded !== null, 'decoder rejected generated WAV');
    assert(decoded.sampleRate === source.sampleRate, 'sample rate changed');
    assert(decoded.digest === source.digest, 'PCM digest changed');
    assert(equalInt16(decoded.left, source.left) && equalInt16(decoded.right, source.right), 'decoded samples differ');
  });

  run('48 kHz duration resolves to an exact frame count', function () {
    const render = DSP.renderProject(testState(9), 1.25, 48000);
    assert(render.frames === 60000, 'expected 60,000 frames, received ' + render.frames);
  });

  run('Deterministic recipe ID is stable and state-sensitive', function () {
    const project = { tempo: 128, seed: 12, pattern: [1, 0, 1, 0] };
    const a = DSP.makeRecipe(project, 1, 44100, []);
    const b = DSP.makeRecipe({ pattern: [1, 0, 1, 0], seed: 12, tempo: 128 }, 1, 44100, []);
    const c = DSP.makeRecipe({ pattern: [1, 0, 1, 0], seed: 13, tempo: 128 }, 1, 44100, []);
    assert(a.recipeId === b.recipeId, 'key order changed recipe identity');
    assert(a.recipeId !== c.recipeId, 'seed mutation did not change recipe identity');
  });

  run('Sound Lab loop replays exactly', function () {
    const config = { style: 'industrial', root: 36, scale: 'minor', bars: 1, seed: 6581420, octave: 0, guitar: 70, synth: 64, bass: 48, texture: 22, drive: 38, space: 20 };
    const a = DSP.renderSoundLab(config, 128, 44100);
    const b = DSP.renderSoundLab(config, 128, 44100);
    assert(a.digest === b.digest, 'Sound Lab digest differs');
    assert(equalInt16(a.left, b.left), 'Sound Lab PCM differs');
  });

  run('Sound Lab seed changes loop identity', function () {
    const config = { style: 'dark-country', root: 38, scale: 'pentatonic', bars: 1, seed: 4, octave: 0, guitar: 80, synth: 20, bass: 35, texture: 10, drive: 20, space: 28 };
    const a = DSP.renderSoundLab(config, 110, 44100);
    const b = DSP.renderSoundLab(Object.assign({}, config, { seed: 5 }), 110, 44100);
    assert(a.digest !== b.digest, 'different seeds produced the same Sound Lab digest');
  });

  run('Malformed WAV fails closed', function () {
    assert(DSP.decodeWavPCM16(new Uint8Array([1, 2, 3, 4]).buffer) === null, 'malformed data was accepted');
  });

  const list = document.querySelector('#test-results');
  results.forEach(result => {
    const item = document.createElement('li');
    item.className = result.passed ? 'is-pass' : 'is-fail';
    item.innerHTML = '<strong>' + (result.passed ? 'PASS' : 'FAIL') + '</strong><span>' + result.name + '</span><small>' + result.ms.toFixed(1) + ' ms' + (result.error ? ' · ' + result.error : '') + '</small>';
    list.appendChild(item);
  });
  const passed = results.filter(result => result.passed).length;
  const failed = results.length - passed;
  document.querySelector('#test-summary').textContent = passed + ' passed · ' + failed + ' failed · RB-420 DSP ' + DSP.VERSION;
  const badge = document.querySelector('#test-status');
  badge.textContent = failed ? 'FAILED' : 'ALL TESTS PASSED';
  badge.classList.toggle('is-recording', Boolean(failed));
  document.documentElement.dataset.tests = failed ? 'failed' : 'passed';
}());
