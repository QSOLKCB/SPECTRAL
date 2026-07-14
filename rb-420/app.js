(function () {
  'use strict';

  const RB420 = window.RB420;
  const DSP = RB420.DSP;
  const engine = new RB420.LiveEngine();
  const CHANNELS = 8;
  const DRUM_LANES = [
    ['kick', 'KICK', 'BD'],
    ['snare', 'SNARE', 'SD'],
    ['closedHat', 'CLOSED HAT', 'CH'],
    ['openHat', 'OPEN HAT', 'OH'],
    ['clap', 'CLAP', 'CP'],
    ['rim', 'RIM SHOT', 'RS']
  ];

  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));

  function makeStep(note, accent, slide) {
    return note === null ? null : { note: note, gate: true, accent: Boolean(accent), slide: Boolean(slide) };
  }

  function makeEmptyPattern(length) {
    return Array.from({ length: length || 16 }, () => null);
  }

  function makeTrackerPattern(rows) {
    return Array.from({ length: rows }, () => Array.from({ length: CHANNELS }, () => ({ note: null, instrument: 0, volume: 64, effect: '---' })));
  }

  function defaultState() {
    const acidA = [
      makeStep(36, true, false), null, makeStep(36, false, false), makeStep(43, false, true),
      makeStep(39, false, false), null, makeStep(46, true, false), null,
      makeStep(36, false, false), makeStep(48, true, true), null, makeStep(43, false, false),
      makeStep(39, false, true), null, makeStep(34, true, false), makeStep(36, false, false)
    ];
    const acidB = [
      makeStep(48, false, false), null, null, makeStep(51, true, false),
      null, makeStep(55, false, true), null, makeStep(53, false, false),
      makeStep(48, false, false), null, makeStep(46, false, false), null,
      makeStep(51, true, true), null, makeStep(55, false, false), null
    ];
    return {
      schema: 'rb420.project-state.v1',
      tempo: 128,
      swing: 0,
      masterVolume: 78,
      seed: 420338,
      acid: [
        { cutoff: 58, resonance: 72, envMod: 64, decay: 54, accent: 76, volume: 76, waveform: 'saw', mute: false, solo: false, pattern: acidA },
        { cutoff: 44, resonance: 60, envMod: 46, decay: 68, accent: 62, volume: 65, waveform: 'square', mute: false, solo: false, pattern: acidB }
      ],
      drums: {
        kit: '808', volume: 82, drive: 28, humanize: 0, mute: false,
        patterns: {
          kick: [true, false, false, false, true, false, false, false, true, false, true, false, true, false, false, false],
          snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
          closedHat: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
          openHat: [false, false, false, false, false, false, false, true, false, false, false, false, false, false, false, true],
          clap: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
          rim: [false, false, false, true, false, false, false, false, false, false, false, true, false, false, false, false]
        }
      },
      fx: { distortion: 34, filter: 72, delayTime: 32, feedback: 38, delayMix: 22, compression: 48, bypass: false },
      tracker: { rows: 64, rowsPerBeat: 4, volume: 78, mute: false, pattern: makeTrackerPattern(64) },
      samples: [],
      meta: { name: 'RB-420 Session', author: 'Trent Slade / QSOL-IMC', notes: '' }
    };
  }

  let state = defaultState();
  let selectedPatternMachine = 0;
  let selectedPatternStep = 0;
  let patternClipboard = null;
  let currentPlayStep = -1;
  let currentTrackerRow = -1;
  let selectedTracker = { row: 0, channel: 0, column: 'note' };
  let selectedSample = 0;
  let lastLoop = null;
  let soundLoop = null;
  let history = [];
  let future = [];
  let toastTimer = null;
  let scopeFrame = null;
  let liveProgressTimer = null;

  function cloneMusicalState() {
    return JSON.parse(JSON.stringify({
      tempo: state.tempo,
      swing: state.swing,
      masterVolume: state.masterVolume,
      seed: state.seed,
      acid: state.acid,
      drums: state.drums,
      fx: state.fx,
      tracker: state.tracker,
      meta: state.meta
    }));
  }

  function restoreMusicalState(snapshot) {
    const samples = state.samples;
    state = Object.assign(defaultState(), snapshot);
    state.samples = samples;
    syncAllControls();
    renderAll();
  }

  function pushHistory(label) {
    history.push({ label: label || 'Edit', snapshot: cloneMusicalState() });
    if (history.length > 40) history.shift();
    future = [];
    updateUndoButtons();
  }

  function undo() {
    if (!history.length) return;
    future.push({ label: 'Redo', snapshot: cloneMusicalState() });
    const item = history.pop();
    restoreMusicalState(item.snapshot);
    toast('Undid: ' + item.label);
    updateUndoButtons();
  }

  function redo() {
    if (!future.length) return;
    history.push({ label: 'Undo', snapshot: cloneMusicalState() });
    const item = future.pop();
    restoreMusicalState(item.snapshot);
    toast('Redid edit');
    updateUndoButtons();
  }

  function updateUndoButtons() {
    $('#undo').disabled = history.length === 0;
    $('#redo').disabled = future.length === 0;
  }

  function toast(message, error) {
    const node = $('#toast');
    node.textContent = message;
    node.classList.toggle('is-error', Boolean(error));
    node.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('is-visible'), 2800);
  }

  function setStatus(message, online) {
    const node = $('#app-status');
    node.innerHTML = '<i></i> ' + message;
    node.classList.toggle('is-online', Boolean(online));
  }

  function sanitizeFilename(name) {
    return String(name || 'rb-420').trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'rb-420';
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds - mins * 60;
    return mins + ':' + secs.toFixed(2).padStart(5, '0');
  }

  function bindTabs() {
    $$('.tab').forEach(button => {
      button.addEventListener('click', () => showTab(button.dataset.tab));
    });
  }

  function showTab(tab) {
    $$('.tab').forEach(button => button.classList.toggle('is-active', button.dataset.tab === tab));
    $$('.panel').forEach(panel => panel.classList.toggle('is-active', panel.dataset.panel === tab));
    if (tab === 'pattern') drawPianoRoll();
    if (tab === 'tracker') restoreTrackerFocus();
    if (tab === 'project') updateProjectSummary();
  }

  function bindRangeOutputs() {
    $$('input[type="range"]').forEach(input => {
      const output = input.parentElement && input.parentElement.querySelector('output');
      if (!output) return;
      const update = () => {
        output.value = input.id === 'record-duration' ? Number(input.value).toFixed(1) + ' s' : input.value;
        output.textContent = output.value;
      };
      input.addEventListener('input', update);
      update();
    });
  }

  function bindGlobalControls() {
    $('#tempo').addEventListener('change', event => {
      state.tempo = DSP.clamp(Number(event.target.value) || 128, 40, 250);
      event.target.value = state.tempo;
      updateProjectSummary();
    });
    $('#swing').addEventListener('input', event => {
      state.swing = Number(event.target.value);
      $('#swing-value').textContent = state.swing + '%';
    });
    $('#master-volume').addEventListener('input', event => {
      state.masterVolume = Number(event.target.value);
      $('#master-value').textContent = event.target.value;
      engine.setMasterVolume(state.masterVolume);
    });
    $('#global-seed').addEventListener('change', event => {
      state.seed = (Number(event.target.value) >>> 0) || 1;
      event.target.value = state.seed;
    });
    $('#transport-play').addEventListener('click', togglePlay);
    $('#transport-stop').addEventListener('click', stopTransport);
    $('#undo').addEventListener('click', undo);
    $('#redo').addEventListener('click', redo);
    $('#demo-pattern').addEventListener('click', loadDemo);
    $('#mutate-pattern').addEventListener('click', mutateProject);
    window.addEventListener('keydown', globalKeyboard);
    window.addEventListener('resize', () => {
      if ($('#panel-pattern').classList.contains('is-active')) drawPianoRoll();
      if (lastLoop) drawWaveform($('#record-waveform'), lastLoop);
      if (soundLoop) drawWaveform($('#sound-waveform'), soundLoop);
    });
  }

  async function togglePlay() {
    if (engine.isPlaying) {
      stopTransport();
      return;
    }
    try {
      await prepareSampleBuffers();
      await engine.start(() => state, updatePlayhead);
      $('#transport-play').textContent = '❚❚ PAUSE';
      $$('.machine').forEach(node => node.classList.add('is-playing'));
      setStatus('AUDIO ONLINE · ' + Math.round(engine.context.sampleRate / 100) / 10 + ' kHz', true);
      startScope();
    } catch (error) {
      toast(error.message, true);
    }
  }

  function stopTransport() {
    engine.stop();
    $('#transport-play').textContent = '▶ PLAY';
    $$('.machine').forEach(node => node.classList.remove('is-playing'));
    currentPlayStep = -1;
    currentTrackerRow = -1;
    updateStepPlayheads();
    updateTrackerPlayhead();
    setStatus(engine.context ? 'AUDIO READY · TRANSPORT STOPPED' : 'AUDIO OFFLINE — PRESS PLAY TO INITIALIZE', Boolean(engine.context));
  }

  function updatePlayhead(step) {
    currentPlayStep = step % 16;
    currentTrackerRow = Math.floor(step * state.tracker.rowsPerBeat / 4) % state.tracker.rows;
    requestAnimationFrame(() => {
      updateStepPlayheads();
      updateTrackerPlayhead();
      $('#play-position').textContent = 'PAT 00 · STEP ' + String(currentPlayStep + 1).padStart(2, '0') + ' · ROW ' + String(currentTrackerRow).padStart(2, '0');
    });
  }

  function updateStepPlayheads() {
    $$('.step[data-step], .drum-step[data-step]').forEach(node => node.classList.toggle('is-current', Number(node.dataset.step) === currentPlayStep));
  }

  function startScope() {
    if (scopeFrame) return;
    const canvas = $('#scope');
    const context2d = canvas.getContext('2d');
    const data = new Uint8Array(2048);
    const tick = () => {
      scopeFrame = requestAnimationFrame(tick);
      const width = canvas.width;
      const height = canvas.height;
      context2d.fillStyle = '#11170f';
      context2d.fillRect(0, 0, width, height);
      context2d.strokeStyle = 'rgba(139, 151, 100, .12)';
      context2d.lineWidth = 1;
      for (let x = 0; x < width; x += width / 16) { context2d.beginPath(); context2d.moveTo(x, 0); context2d.lineTo(x, height); context2d.stroke(); }
      context2d.beginPath(); context2d.moveTo(0, height / 2); context2d.lineTo(width, height / 2); context2d.stroke();
      if (!engine.analyser) return;
      engine.analyser.getByteTimeDomainData(data);
      context2d.beginPath();
      context2d.strokeStyle = '#d79a3b';
      context2d.lineWidth = 2;
      let peak = 0;
      for (let i = 0; i < data.length; i += 1) {
        const normalized = (data[i] - 128) / 128;
        peak = Math.max(peak, Math.abs(normalized));
        const x = i / (data.length - 1) * width;
        const y = height / 2 + normalized * height * .43;
        if (i === 0) context2d.moveTo(x, y); else context2d.lineTo(x, y);
      }
      context2d.stroke();
      $('#meter-fill').style.height = Math.max(3, peak * 100) + '%';
    };
    tick();
  }

  function globalKeyboard(event) {
    const target = event.target;
    if (target && (target.matches('input, select, textarea') || target.isContentEditable)) return;
    if (event.code === 'Space') {
      event.preventDefault();
      togglePlay();
    } else if (event.key === 'Escape') {
      stopTransport();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
    }
  }

  function renderAcidSteps() {
    state.acid.forEach((machine, machineIndex) => {
      const container = machineIndex === 0 ? $('#acid-a-steps') : $('#acid-b-steps');
      container.innerHTML = '';
      machine.pattern.forEach((step, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'step';
        button.dataset.step = index;
        button.dataset.machine = machineIndex;
        button.setAttribute('aria-label', (machineIndex ? 'Acid B' : 'Acid A') + ' step ' + (index + 1));
        if (step) {
          button.classList.add('is-on');
          button.classList.toggle('is-accent', step.accent);
          button.classList.toggle('is-slide', step.slide);
          button.innerHTML = '<em>' + DSP.noteName(step.note) + '</em>';
        } else button.innerHTML = '<em>—</em>';
        button.addEventListener('click', event => editAcidStep(event, machineIndex, index));
        container.appendChild(button);
      });
    });
    updateStepPlayheads();
  }

  function editAcidStep(event, machineIndex, index) {
    pushHistory('acid step');
    const pattern = state.acid[machineIndex].pattern;
    let step = pattern[index];
    if (event.shiftKey || event.altKey) {
      if (!step) step = pattern[index] = makeStep(machineIndex === 0 ? 36 : 48, false, false);
      if (event.shiftKey) step.accent = !step.accent;
      if (event.altKey) step.slide = !step.slide;
    } else {
      pattern[index] = step ? null : makeStep(machineIndex === 0 ? 36 : 48, false, false);
    }
    selectedPatternMachine = machineIndex;
    selectedPatternStep = index;
    renderAcidSteps();
    syncPatternEditor();
  }

  function bindMachineControls() {
    $$('.acid-machine').forEach(machineNode => {
      const index = Number(machineNode.dataset.acid);
      machineNode.querySelectorAll('[data-acid-param]').forEach(input => {
        input.addEventListener('input', event => {
          state.acid[index][event.target.dataset.acidParam] = Number(event.target.value);
          const output = event.target.parentElement.querySelector('output');
          if (output) output.textContent = event.target.value;
        });
      });
      machineNode.querySelectorAll('[data-wave]').forEach(button => {
        button.addEventListener('click', () => {
          pushHistory('waveform');
          state.acid[index].waveform = button.dataset.wave;
          machineNode.querySelectorAll('[data-wave]').forEach(node => node.classList.toggle('is-active', node === button));
        });
      });
    });
    $$('[data-machine-mute]').forEach(button => button.addEventListener('click', () => {
      const key = button.dataset.machineMute;
      pushHistory('mute');
      if (key === 'drums') state.drums.mute = !state.drums.mute;
      else state.acid[key === 'acidA' ? 0 : 1].mute = !state.acid[key === 'acidA' ? 0 : 1].mute;
      button.classList.toggle('is-active');
    }));
    $$('[data-machine-solo]').forEach(button => button.addEventListener('click', () => {
      const index = button.dataset.machineSolo === 'acidA' ? 0 : 1;
      pushHistory('solo');
      state.acid[index].solo = !state.acid[index].solo;
      button.classList.toggle('is-active', state.acid[index].solo);
    }));
    $$('[data-kit]').forEach(button => button.addEventListener('click', () => {
      pushHistory('drum kit');
      state.drums.kit = button.dataset.kit;
      $$('[data-kit]').forEach(node => node.classList.toggle('is-active', node === button));
    }));
    bindNumericControl('#drum-volume', value => state.drums.volume = value);
    bindNumericControl('#drum-drive', value => state.drums.drive = value);
    bindNumericControl('#drum-humanize', value => state.drums.humanize = value);
    bindNumericControl('#fx-distortion', value => state.fx.distortion = value);
    bindNumericControl('#fx-filter', value => state.fx.filter = value);
    bindNumericControl('#fx-delay-time', value => state.fx.delayTime = value);
    bindNumericControl('#fx-feedback', value => state.fx.feedback = value);
    bindNumericControl('#fx-delay-mix', value => state.fx.delayMix = value);
    bindNumericControl('#fx-compression', value => state.fx.compression = value);
    $('#fx-bypass').addEventListener('click', () => {
      state.fx.bypass = !state.fx.bypass;
      $('#fx-bypass').classList.toggle('is-active', state.fx.bypass);
      $('#fx-bypass').textContent = state.fx.bypass ? 'BYPASSED' : 'BYPASS';
    });
  }

  function bindNumericControl(selector, setter) {
    const input = $(selector);
    input.addEventListener('input', () => {
      setter(Number(input.value));
      const output = input.parentElement.querySelector('output');
      if (output) output.textContent = input.value;
    });
  }

  function renderDrumGrid() {
    const grid = $('#drum-grid');
    grid.innerHTML = '';
    DRUM_LANES.forEach(([key, name, short]) => {
      const row = document.createElement('div');
      row.className = 'drum-row';
      const label = document.createElement('div');
      label.className = 'drum-label';
      label.innerHTML = '<span>' + name + '</span><small>' + short + '</small>';
      row.appendChild(label);
      state.drums.patterns[key].forEach((active, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'drum-step' + (active ? ' is-on' : '');
        button.dataset.step = index;
        button.dataset.lane = key;
        button.setAttribute('aria-label', name + ' step ' + (index + 1));
        button.addEventListener('click', () => {
          pushHistory('drum step');
          state.drums.patterns[key][index] = !state.drums.patterns[key][index];
          renderDrumGrid();
        });
        row.appendChild(button);
      });
      grid.appendChild(row);
    });
    updateStepPlayheads();
  }

  function euclidean(steps, hits) {
    const pattern = [];
    for (let i = 0; i < steps; i += 1) pattern.push(Math.floor((i + 1) * hits / steps) !== Math.floor(i * hits / steps));
    return pattern;
  }

  function bindEuclidean() {
    $('#apply-euclid').addEventListener('click', () => {
      pushHistory('Euclidean rhythm');
      const lane = $('#euclid-lane').value;
      const hits = DSP.clamp(Number($('#euclid-hits').value) || 1, 1, 16);
      state.drums.patterns[lane] = euclidean(16, hits);
      renderDrumGrid();
      toast('Generated E(' + hits + ',16) on ' + lane);
    });
  }

  function loadDemo() {
    pushHistory('load demo');
    const fresh = defaultState();
    fresh.samples = state.samples;
    fresh.meta = state.meta;
    state = fresh;
    syncAllControls();
    renderAll();
    toast('Loaded the RB-420 acid demo');
  }

  function mutateProject() {
    pushHistory('seeded mutation');
    const rng = new DSP.XorShift32(state.seed);
    state.acid.forEach((machine, machineIndex) => {
      machine.pattern.forEach((step, index) => {
        if (step && rng.int(100) < 30) {
          const delta = [-5, -2, 0, 2, 3, 5, 7][rng.int(7)];
          step.note = DSP.clamp(step.note + delta, 24, 84);
          if (rng.int(4) === 0) step.accent = !step.accent;
          if (rng.int(6) === 0) step.slide = !step.slide;
        } else if (!step && rng.int(100) < 8) {
          machine.pattern[index] = makeStep((machineIndex ? 48 : 36) + rng.int(12), rng.int(4) === 0, rng.int(7) === 0);
        }
      });
    });
    DRUM_LANES.forEach(([key]) => {
      state.drums.patterns[key] = state.drums.patterns[key].map(value => rng.int(100) < 9 ? !value : value);
    });
    state.seed = rng.next() || 1;
    $('#global-seed').value = state.seed;
    renderAcidSteps();
    renderDrumGrid();
    drawPianoRoll();
    toast('Applied reproducible mutation · next seed ' + state.seed);
  }

  function bindPatternEditor() {
    const noteSelect = $('#inspector-note');
    for (let note = 24; note <= 96; note += 1) {
      const option = document.createElement('option');
      option.value = note;
      option.textContent = DSP.noteName(note);
      noteSelect.appendChild(option);
    }
    $('#pattern-machine').addEventListener('change', event => {
      selectedPatternMachine = Number(event.target.value);
      syncPatternEditor();
    });
    $('#pattern-root').addEventListener('change', drawPianoRoll);
    $('#pattern-octaves').addEventListener('change', drawPianoRoll);
    $('#piano-roll').addEventListener('pointerdown', pianoPointer);
    $('#inspector-note').addEventListener('change', event => {
      pushHistory('pattern note');
      const pattern = state.acid[selectedPatternMachine].pattern;
      pattern[selectedPatternStep] = pattern[selectedPatternStep] || makeStep(Number(event.target.value), false, false);
      pattern[selectedPatternStep].note = Number(event.target.value);
      renderAcidSteps(); drawPianoRoll(); syncInspector();
    });
    $('#inspector-gate').addEventListener('click', () => toggleStepFlag('gate'));
    $('#inspector-accent').addEventListener('click', () => toggleStepFlag('accent'));
    $('#inspector-slide').addEventListener('click', () => toggleStepFlag('slide'));
    $('#inspector-delete').addEventListener('click', () => {
      pushHistory('delete note');
      state.acid[selectedPatternMachine].pattern[selectedPatternStep] = null;
      renderAcidSteps(); drawPianoRoll(); syncInspector();
    });
    $('#pattern-copy').addEventListener('click', () => {
      patternClipboard = JSON.parse(JSON.stringify(state.acid[selectedPatternMachine].pattern));
      toast('Pattern copied');
    });
    $('#pattern-paste').addEventListener('click', () => {
      if (!patternClipboard) return toast('Copy a pattern first', true);
      pushHistory('paste pattern');
      state.acid[selectedPatternMachine].pattern = JSON.parse(JSON.stringify(patternClipboard));
      renderAcidSteps(); drawPianoRoll();
    });
    $('#pattern-clear').addEventListener('click', () => {
      pushHistory('clear pattern');
      state.acid[selectedPatternMachine].pattern = makeEmptyPattern(16);
      renderAcidSteps(); drawPianoRoll(); syncInspector();
    });
    $('#pattern-randomize').addEventListener('click', mutateSelectedPattern);
    $('#pattern-apply-transpose').addEventListener('click', transposePattern);
    $('#pattern-export').addEventListener('click', exportPattern);
    $('#pattern-import').addEventListener('click', () => $('#pattern-file').click());
    $('#pattern-file').addEventListener('change', importPattern);
  }

  function pianoPointer(event) {
    const canvas = $('#piano-roll');
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * canvas.width;
    const y = (event.clientY - rect.top) / rect.height * canvas.height;
    const keyboardWidth = 78;
    if (x < keyboardWidth) return;
    const root = Number($('#pattern-root').value);
    const octaves = Number($('#pattern-octaves').value);
    const noteCount = octaves * 12;
    const cellWidth = (canvas.width - keyboardWidth) / 16;
    const cellHeight = canvas.height / noteCount;
    const stepIndex = DSP.clamp(Math.floor((x - keyboardWidth) / cellWidth), 0, 15);
    const note = DSP.clamp(root + noteCount - 1 - Math.floor(y / cellHeight), 0, 127);
    pushHistory('piano roll note');
    const pattern = state.acid[selectedPatternMachine].pattern;
    if (pattern[stepIndex] && pattern[stepIndex].note === note) pattern[stepIndex] = null;
    else pattern[stepIndex] = makeStep(note, event.shiftKey, event.altKey);
    selectedPatternStep = stepIndex;
    renderAcidSteps(); drawPianoRoll(); syncInspector();
  }

  function drawPianoRoll() {
    const canvas = $('#piano-roll');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const keyboardWidth = 78;
    const root = Number($('#pattern-root').value);
    const octaves = Number($('#pattern-octaves').value);
    const noteCount = octaves * 12;
    const cellWidth = (width - keyboardWidth) / 16;
    const cellHeight = height / noteCount;
    const pattern = state.acid[selectedPatternMachine].pattern;
    ctx.fillStyle = '#0b0e0a'; ctx.fillRect(0, 0, width, height);
    ctx.font = '700 12px monospace'; ctx.textBaseline = 'middle';
    for (let row = 0; row < noteCount; row += 1) {
      const note = root + noteCount - 1 - row;
      const black = [1, 3, 6, 8, 10].includes(note % 12);
      const y = row * cellHeight;
      ctx.fillStyle = black ? '#121611' : '#181c16';
      ctx.fillRect(keyboardWidth, y, width - keyboardWidth, cellHeight);
      ctx.fillStyle = black ? '#1c1e19' : '#d5cfbd';
      ctx.fillRect(0, y, keyboardWidth - (black ? 19 : 2), cellHeight - 1);
      ctx.fillStyle = black ? '#aaa99d' : '#1a1b18';
      if (note % 12 === 0 || black) ctx.fillText(DSP.noteName(note), 8, y + cellHeight / 2);
      ctx.strokeStyle = note % 12 === 0 ? '#4d5241' : '#292e25';
      ctx.beginPath(); ctx.moveTo(keyboardWidth, y); ctx.lineTo(width, y); ctx.stroke();
    }
    for (let step = 0; step <= 16; step += 1) {
      const x = keyboardWidth + step * cellWidth;
      ctx.strokeStyle = step % 4 === 0 ? '#7c765d' : '#33382e';
      ctx.lineWidth = step % 4 === 0 ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      if (step < 16) {
        ctx.fillStyle = '#807f70';
        ctx.fillText(String(step + 1).padStart(2, '0'), x + 5, 12);
      }
    }
    pattern.forEach((step, index) => {
      if (!step || step.note < root || step.note >= root + noteCount) return;
      const row = root + noteCount - 1 - step.note;
      const x = keyboardWidth + index * cellWidth + 3;
      const y = row * cellHeight + 2;
      const w = cellWidth - 6;
      const h = Math.max(5, cellHeight - 4);
      ctx.fillStyle = step.accent ? '#efb85d' : '#b97b2c';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = index === selectedPatternStep ? '#fff2bf' : '#4e2f12';
      ctx.lineWidth = index === selectedPatternStep ? 3 : 1;
      ctx.strokeRect(x, y, w, h);
      if (step.slide) {
        ctx.fillStyle = '#fff0b5';
        ctx.font = '900 16px monospace';
        ctx.fillText('↗', x + w - 17, y + h / 2);
        ctx.font = '700 12px monospace';
      }
    });
  }

  function syncPatternEditor() {
    $('#pattern-machine').value = String(selectedPatternMachine);
    drawPianoRoll();
    syncInspector();
  }

  function syncInspector() {
    const step = state.acid[selectedPatternMachine].pattern[selectedPatternStep];
    $('#selected-step-label').textContent = String(selectedPatternStep + 1).padStart(2, '0');
    $('#inspector-note').value = String(step ? step.note : 48);
    $('#inspector-gate').classList.toggle('is-active', Boolean(step && step.gate !== false));
    $('#inspector-accent').classList.toggle('is-active', Boolean(step && step.accent));
    $('#inspector-slide').classList.toggle('is-active', Boolean(step && step.slide));
  }

  function toggleStepFlag(flag) {
    pushHistory('toggle ' + flag);
    const pattern = state.acid[selectedPatternMachine].pattern;
    const step = pattern[selectedPatternStep] = pattern[selectedPatternStep] || makeStep(Number($('#inspector-note').value), false, false);
    step[flag] = !step[flag];
    renderAcidSteps(); drawPianoRoll(); syncInspector();
  }

  function transposePattern() {
    const delta = Number($('#pattern-transpose').value);
    if (!delta) return;
    pushHistory('transpose pattern');
    state.acid[selectedPatternMachine].pattern.forEach(step => { if (step) step.note = DSP.clamp(step.note + delta, 0, 127); });
    renderAcidSteps(); drawPianoRoll(); syncInspector();
  }

  function mutateSelectedPattern() {
    pushHistory('pattern variation');
    const rng = new DSP.XorShift32(state.seed ^ (selectedPatternMachine + 1) * 0x9e3779b9);
    state.acid[selectedPatternMachine].pattern.forEach((step, index, pattern) => {
      if (step && rng.int(100) < 38) {
        step.note = DSP.clamp(step.note + [-5, -2, 0, 2, 3, 5, 7][rng.int(7)], 24, 96);
        if (rng.int(3) === 0) step.accent = !step.accent;
      } else if (!step && rng.int(100) < 10) pattern[index] = makeStep((selectedPatternMachine ? 48 : 36) + rng.int(12), false, rng.int(7) === 0);
    });
    renderAcidSteps(); drawPianoRoll(); syncInspector();
  }

  function exportPattern() {
    const data = {
      schema: 'rb420.pattern.v1',
      appVersion: DSP.VERSION,
      machine: selectedPatternMachine,
      parameters: Object.assign({}, state.acid[selectedPatternMachine], { pattern: undefined }),
      steps: state.acid[selectedPatternMachine].pattern
    };
    DSP.download('acid-' + (selectedPatternMachine ? 'b' : 'a') + '.rb420-pattern.json', JSON.stringify(data, null, 2), 'application/json');
  }

  async function importPattern(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.schema !== 'rb420.pattern.v1' || !Array.isArray(data.steps) || data.steps.length !== 16) throw new Error('Not a valid RB-420 pattern file.');
      pushHistory('import pattern');
      state.acid[selectedPatternMachine].pattern = data.steps.map(step => step ? makeStep(DSP.clamp(Number(step.note), 0, 127), step.accent, step.slide) : null);
      if (data.parameters) ['cutoff', 'resonance', 'envMod', 'decay', 'accent', 'volume', 'waveform'].forEach(key => {
        if (data.parameters[key] !== undefined) state.acid[selectedPatternMachine][key] = data.parameters[key];
      });
      syncAllControls(); renderAcidSteps(); drawPianoRoll(); syncInspector();
      toast('Imported ' + file.name);
    } catch (error) { toast(error.message, true); }
  }

  function bindRecorder() {
    $$('input[name="record-mode"]').forEach(radio => radio.addEventListener('change', () => {
      $$('.mode-card').forEach(card => card.classList.toggle('is-selected', card.querySelector('input').checked));
      const deterministic = recordMode() === 'deterministic';
      $('#record-start').innerHTML = deterministic ? '<span></span> RENDER LOOP' : '<span></span> START LIVE CAPTURE';
      $('#record-rate').disabled = !deterministic;
    }));
    $('#record-duration').addEventListener('input', () => $('#record-duration-value').textContent = Number($('#record-duration').value).toFixed(1) + ' s');
    $('#record-start').addEventListener('click', startRecorder);
    $('#record-stop').addEventListener('click', stopLiveRecorder);
    $('#loop-preview').addEventListener('click', () => previewPCM(lastLoop));
    $('#loop-download').addEventListener('click', downloadLastLoop);
    $('#recipe-download').addEventListener('click', downloadRecipe);
    $('#loop-to-tracker').addEventListener('click', () => sendPCMToTracker(lastLoop, lastLoop && lastLoop.mode === 'live' ? 'Live Capture' : 'Deterministic Loop'));
    $('#loop-to-sample').addEventListener('click', () => {
      if (!lastLoop) return;
      soundLoop = Object.assign({}, lastLoop, { name: 'Recorder Loop' });
      drawWaveform($('#sound-waveform'), soundLoop);
      setSoundButtons(true);
      $('#sound-meta').textContent = 'Recorder loop staged in Sound Lab · ' + soundLoop.digest;
      showTab('soundlab');
    });
  }

  function recordMode() {
    const checked = $('input[name="record-mode"]:checked');
    return checked ? checked.value : 'deterministic';
  }

  async function startRecorder() {
    const duration = Number($('#record-duration').value);
    if (recordMode() === 'deterministic') return deterministicRecord(duration);
    try {
      if (!engine.isPlaying) await togglePlay();
      $('#record-start').disabled = true;
      $('#record-stop').disabled = false;
      setRecorderStatus('LIVE CAPTURE', true);
      $('#record-progress').style.width = '0%';
      await engine.startLiveCapture(duration, progress => {
        $('#record-progress').style.width = (progress * 100).toFixed(1) + '%';
      }, result => finishLiveRecord(result));
    } catch (error) {
      $('#record-start').disabled = false;
      $('#record-stop').disabled = true;
      setRecorderStatus('ERROR', false);
      toast(error.message, true);
    }
  }

  function deterministicRecord(duration) {
    const rate = Number($('#record-rate').value);
    $('#record-start').disabled = true;
    $('#record-stop').disabled = true;
    setRecorderStatus('RENDERING PCM', true);
    $('#record-progress').style.width = '15%';
    setTimeout(() => {
      try {
        const serial = serializableProject(false);
        const sampleMeta = state.samples.map(sample => ({ name: sample.name, digest: sample.digest, frames: sample.frames, sampleRate: sample.sampleRate, rootNote: sample.rootNote }));
        const recipe = DSP.makeRecipe(serial.project, duration, rate, sampleMeta);
        $('#record-progress').style.width = '45%';
        const pcm = DSP.renderProject(state, duration, rate);
        recipe.pcmDigestFNV1a = pcm.digest;
        recipe.wavEncoding = 'PCM16_LE_STEREO';
        const wav = DSP.encodeWav(pcm.left, pcm.right, pcm.sampleRate);
        lastLoop = Object.assign(pcm, { wav: wav, mode: 'deterministic', recipe: recipe, name: 'RB-420 Deterministic Loop' });
        $('#record-progress').style.width = '100%';
        setLastLoopUI();
        setRecorderStatus('DETERMINISTIC LOOP READY', false);
        toast('Deterministic WAV rendered · ' + pcm.digest);
      } catch (error) {
        setRecorderStatus('RENDER FAILED', false);
        toast(error.message, true);
      } finally {
        $('#record-start').disabled = false;
      }
    }, 40);
  }

  function stopLiveRecorder() {
    engine.stopLiveCapture();
  }

  function finishLiveRecord(result) {
    if (!result) return;
    clearInterval(liveProgressTimer);
    result.wav = DSP.encodeWav(result.left, result.right, result.sampleRate);
    result.mode = 'live';
    result.recipe = null;
    result.name = 'RB-420 Live Capture';
    lastLoop = result;
    $('#record-progress').style.width = '100%';
    $('#record-start').disabled = false;
    $('#record-stop').disabled = true;
    setLastLoopUI();
    setRecorderStatus('LIVE TAKE READY', false);
    toast('Live performance captured · ' + result.digest);
  }

  function setRecorderStatus(text, recording) {
    $('#recorder-badge').textContent = text;
    $('#recorder-badge').classList.toggle('is-recording', recording);
  }

  function setLastLoopUI() {
    drawWaveform($('#record-waveform'), lastLoop);
    $('#record-meta').textContent = lastLoop.mode.toUpperCase() + ' · ' + lastLoop.sampleRate + ' Hz · ' + lastLoop.frames.toLocaleString() + ' frames · ' + formatTime(lastLoop.duration) + ' · PCM ' + lastLoop.digest;
    $('#loop-preview').disabled = false;
    $('#loop-download').disabled = false;
    $('#loop-to-tracker').disabled = false;
    $('#loop-to-sample').disabled = false;
    $('#recipe-download').disabled = !lastLoop.recipe;
    $('#recipe-preview').textContent = lastLoop.recipe ? JSON.stringify(lastLoop.recipe, null, 2) : 'Live Capture is intentionally take-specific and has no deterministic render recipe.';
  }

  async function previewPCM(pcm) {
    if (!pcm) return;
    try {
      await engine.playPCM(pcm);
      setStatus('PREVIEWING LOOP', true);
    } catch (error) { toast(error.message, true); }
  }

  function downloadLastLoop() {
    if (!lastLoop) return;
    const suffix = lastLoop.mode === 'deterministic' ? 'deterministic' : 'live';
    DSP.download(sanitizeFilename(state.meta.name) + '-' + suffix + '-' + lastLoop.digest + '.wav', lastLoop.wav, 'audio/wav');
  }

  function downloadRecipe() {
    if (!lastLoop || !lastLoop.recipe) return;
    DSP.download(sanitizeFilename(state.meta.name) + '-' + lastLoop.recipe.recipeId + '.recipe.json', JSON.stringify(lastLoop.recipe, null, 2), 'application/json');
  }

  function drawWaveform(canvas, pcm) {
    if (!canvas || !pcm || !pcm.left) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.fillStyle = '#11170f'; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(139,151,100,.12)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 16; i += 1) { const x = i / 16 * width; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();
    const samplesPerPixel = Math.max(1, Math.floor(pcm.left.length / width));
    ctx.strokeStyle = pcm.mode === 'live' ? '#e26d53' : '#d79a3b';
    ctx.fillStyle = pcm.mode === 'live' ? 'rgba(226,109,83,.22)' : 'rgba(215,154,59,.22)';
    ctx.beginPath();
    for (let x = 0; x < width; x += 1) {
      let min = 32767, max = -32768;
      const start = x * samplesPerPixel;
      const end = Math.min(pcm.left.length, start + samplesPerPixel);
      for (let i = start; i < end; i += 1) { const value = (pcm.left[i] + (pcm.right || pcm.left)[i]) >> 1; if (value < min) min = value; if (value > max) max = value; }
      const y1 = height / 2 - max / 32768 * height * .43;
      const y2 = height / 2 - min / 32768 * height * .43;
      ctx.moveTo(x, y1); ctx.lineTo(x, y2);
    }
    ctx.stroke();
    ctx.fillStyle = '#9ba674'; ctx.font = '700 13px monospace';
    ctx.fillText(pcm.digest || '', 14, 22);
  }

  function bindTracker() {
    $('#tracker-grid').addEventListener('click', event => {
      const target = event.target.closest('[data-row][data-channel][data-column]');
      if (!target) return;
      selectedTracker = { row: Number(target.dataset.row), channel: Number(target.dataset.channel), column: target.dataset.column };
      selectTrackerCell();
    });
    $('#tracker-grid').addEventListener('keydown', trackerKeydown);
    $('#tracker-clear').addEventListener('click', () => {
      pushHistory('clear tracker');
      state.tracker.pattern = makeTrackerPattern(state.tracker.rows);
      renderTracker();
    });
    $('#tracker-import-audio').addEventListener('click', () => $('#audio-file').click());
    $('#audio-file').addEventListener('change', importAudio);
    $('#tracker-render').addEventListener('click', renderTrackerLoop);
    $('#tracker-rows').addEventListener('change', changeTrackerRows);
    $('#tracker-speed').addEventListener('change', event => state.tracker.rowsPerBeat = Number(event.target.value));
    $('#tracker-volume').addEventListener('input', event => {
      state.tracker.volume = Number(event.target.value);
      event.target.parentElement.querySelector('output').textContent = event.target.value;
    });
  }

  function renderTracker() {
    const grid = $('#tracker-grid');
    const fragment = document.createDocumentFragment();
    const header = document.createElement('div');
    header.className = 'tracker-header';
    header.innerHTML = '<div>ROW</div>' + Array.from({ length: CHANNELS }, (_, i) => '<div>CHANNEL ' + String(i + 1).padStart(2, '0') + '</div>').join('');
    fragment.appendChild(header);
    state.tracker.pattern.forEach((row, rowIndex) => {
      const rowNode = document.createElement('div');
      rowNode.className = 'tracker-row' + (rowIndex % state.tracker.rowsPerBeat === 0 ? ' is-beat' : '');
      rowNode.dataset.trackerRow = rowIndex;
      const number = document.createElement('div');
      number.className = 'row-number';
      number.textContent = rowIndex.toString(16).toUpperCase().padStart(2, '0');
      rowNode.appendChild(number);
      row.forEach((cell, channel) => {
        const cellNode = document.createElement('div');
        cellNode.className = 'tracker-cell';
        const values = {
          note: cell.note === null || cell.note === undefined ? '---' : DSP.trackerNoteName(cell.note),
          instrument: cell.instrument ? String(cell.instrument).padStart(2, '0') : '..',
          volume: cell.note === null || cell.note === undefined ? '..' : Number(cell.volume || 0).toString(16).toUpperCase().padStart(2, '0'),
          effect: cell.effect || '---'
        };
        ['note', 'instrument', 'volume', 'effect'].forEach(column => {
          const span = document.createElement('span');
          span.tabIndex = 0;
          span.dataset.row = rowIndex;
          span.dataset.channel = channel;
          span.dataset.column = column;
          span.textContent = values[column];
          cellNode.appendChild(span);
        });
        rowNode.appendChild(cellNode);
      });
      fragment.appendChild(rowNode);
    });
    grid.innerHTML = '';
    grid.appendChild(fragment);
    selectTrackerCell(false);
    updateTrackerPlayhead();
    $('#tracker-position').textContent = 'ROW ' + String(Math.max(0, selectedTracker.row)).padStart(2, '0') + ' / ' + state.tracker.rows;
  }

  function selectTrackerCell(scroll) {
    $$('.tracker-cell span.is-selected').forEach(node => node.classList.remove('is-selected'));
    const selector = '[data-row="' + selectedTracker.row + '"][data-channel="' + selectedTracker.channel + '"][data-column="' + selectedTracker.column + '"]';
    const target = $('#tracker-grid').querySelector(selector);
    if (target) {
      target.classList.add('is-selected');
      if (scroll !== false) target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    $('#tracker-position').textContent = 'ROW ' + String(selectedTracker.row).padStart(2, '0') + ' / ' + state.tracker.rows;
  }

  function restoreTrackerFocus() { setTimeout(() => selectTrackerCell(false), 0); }

  function trackerKeydown(event) {
    const target = event.target.closest('[data-row][data-channel][data-column]');
    if (!target) return;
    selectedTracker = { row: Number(target.dataset.row), channel: Number(target.dataset.channel), column: target.dataset.column };
    const cell = state.tracker.pattern[selectedTracker.row][selectedTracker.channel];
    const columns = ['note', 'instrument', 'volume', 'effect'];
    let changed = false;
    const key = event.key.toLowerCase();
    const piano = { z: 48, s: 49, x: 50, d: 51, c: 52, v: 53, g: 54, b: 55, h: 56, n: 57, j: 58, m: 59, q: 60, '2': 61, w: 62, '3': 63, e: 64, r: 65, '5': 66, t: 67, '6': 68, y: 69, '7': 70, u: 71, i: 72 };
    if (event.key === 'ArrowDown') selectedTracker.row = (selectedTracker.row + 1) % state.tracker.rows;
    else if (event.key === 'ArrowUp') selectedTracker.row = (selectedTracker.row - 1 + state.tracker.rows) % state.tracker.rows;
    else if (event.key === 'ArrowRight') {
      let index = columns.indexOf(selectedTracker.column) + 1;
      if (index >= columns.length) { index = 0; selectedTracker.channel = (selectedTracker.channel + 1) % CHANNELS; }
      selectedTracker.column = columns[index];
    } else if (event.key === 'ArrowLeft') {
      let index = columns.indexOf(selectedTracker.column) - 1;
      if (index < 0) { index = columns.length - 1; selectedTracker.channel = (selectedTracker.channel - 1 + CHANNELS) % CHANNELS; }
      selectedTracker.column = columns[index];
    } else if (event.key === 'Delete' || event.key === 'Backspace' || event.key === '.') {
      if (selectedTracker.column === 'note') Object.assign(cell, { note: null, instrument: 0, volume: 64, effect: '---' });
      else if (selectedTracker.column === 'instrument') cell.instrument = 0;
      else if (selectedTracker.column === 'volume') cell.volume = 64;
      else cell.effect = '---';
      changed = true;
    } else if (selectedTracker.column === 'note' && piano[key] !== undefined) {
      cell.note = piano[key];
      cell.instrument = selectedSample + 1;
      cell.volume = 64;
      changed = true;
      selectedTracker.row = (selectedTracker.row + 1) % state.tracker.rows;
    } else if (selectedTracker.column === 'instrument' && /^[0-9]$/.test(key)) {
      cell.instrument = DSP.clamp(Number(key), 0, Math.min(16, state.samples.length || 1));
      changed = true;
    } else if (selectedTracker.column === 'volume' && (key === '+' || key === '=' || key === '-')) {
      cell.volume = DSP.clamp(cell.volume + (key === '-' ? -4 : 4), 0, 64);
      changed = true;
    } else if (selectedTracker.column === 'effect' && /^[a-z]$/.test(key)) {
      cell.effect = key.toUpperCase() + '00';
      changed = true;
    } else return;
    event.preventDefault();
    if (changed) renderTracker();
    selectTrackerCell();
  }

  function updateTrackerPlayhead() {
    $$('.tracker-row.is-current').forEach(node => node.classList.remove('is-current'));
    if (currentTrackerRow >= 0) {
      const row = $('#tracker-grid').querySelector('[data-tracker-row="' + currentTrackerRow + '"]');
      if (row) row.classList.add('is-current');
    }
  }

  function changeTrackerRows(event) {
    const rows = Number(event.target.value);
    pushHistory('tracker length');
    if (rows > state.tracker.pattern.length) {
      while (state.tracker.pattern.length < rows) state.tracker.pattern.push(Array.from({ length: CHANNELS }, () => ({ note: null, instrument: 0, volume: 64, effect: '---' })));
    } else state.tracker.pattern.length = rows;
    state.tracker.rows = rows;
    selectedTracker.row = Math.min(selectedTracker.row, rows - 1);
    renderTracker();
  }

  function renderSampleSlots() {
    const container = $('#sample-slots');
    container.innerHTML = '';
    for (let i = 0; i < 16; i += 1) {
      const sample = state.samples[i];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sample-slot' + (sample ? ' is-loaded' : '') + (i === selectedSample ? ' is-selected' : '');
      button.innerHTML = '<strong>' + String(i + 1).padStart(2, '0') + '</strong><small>' + (sample ? sample.name : 'EMPTY') + '</small>';
      button.title = sample ? sample.name + ' · ' + sample.digest : 'Empty sample slot';
      button.addEventListener('click', () => { selectedSample = i; renderSampleSlots(); });
      container.appendChild(button);
    }
    $('#sample-count').textContent = state.samples.filter(Boolean).length + ' / 16 loaded';
  }

  async function sendPCMToTracker(pcm, name) {
    if (!pcm) return;
    try {
      const sample = {
        name: name || pcm.name || 'RB-420 Loop',
        pcmLeft: new Int16Array(pcm.left),
        pcmRight: new Int16Array(pcm.right || pcm.left),
        sampleRate: pcm.sampleRate,
        frames: pcm.left.length,
        duration: pcm.left.length / pcm.sampleRate,
        digest: pcm.digest || DSP.hashInt16(pcm.left, pcm.right || pcm.left),
        rootNote: 60,
        sourceMode: pcm.mode || 'generated',
        audioBuffer: null
      };
      let index = state.samples.findIndex(value => !value);
      if (index < 0) index = state.samples.length < 16 ? state.samples.length : selectedSample;
      state.samples[index] = sample;
      selectedSample = index;
      await engine.installAudioBuffer(sample);
      const targetCell = state.tracker.pattern[0][0];
      Object.assign(targetCell, { note: 60, instrument: index + 1, volume: 64, effect: '---' });
      renderSampleSlots(); renderTracker();
      showTab('tracker');
      toast('Loaded as instrument ' + String(index + 1).padStart(2, '0') + ' and placed on row 00');
    } catch (error) { toast(error.message, true); }
  }

  async function importAudio(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const bytes = await file.arrayBuffer();
      let pcm = DSP.decodeWavPCM16(bytes);
      if (!pcm) {
        await engine.ensureContext();
        const audioBuffer = await engine.context.decodeAudioData(bytes.slice(0));
        const converted = DSP.floatToInt16(audioBuffer.getChannelData(0), audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : null);
        pcm = { left: converted.left, right: converted.right, sampleRate: audioBuffer.sampleRate, frames: audioBuffer.length, duration: audioBuffer.duration, digest: DSP.hashInt16(converted.left, converted.right), mode: 'browser-decoded' };
      }
      await sendPCMToTracker(pcm, file.name.replace(/\.[^.]+$/, ''));
    } catch (error) { toast('Could not import audio: ' + error.message, true); }
  }

  function renderTrackerLoop() {
    const snapshot = serializableRenderState();
    snapshot.acid.forEach(machine => machine.mute = true);
    snapshot.drums.mute = true;
    snapshot.samples = state.samples;
    const duration = Number($('#record-duration').value);
    const rate = Number($('#record-rate').value);
    try {
      const pcm = DSP.renderProject(snapshot, duration, rate);
      pcm.wav = DSP.encodeWav(pcm.left, pcm.right, pcm.sampleRate);
      pcm.mode = 'deterministic';
      pcm.name = 'Tracker Render';
      const serial = serializableProject(false);
      pcm.recipe = DSP.makeRecipe(serial.project, duration, rate, state.samples.map(sample => ({ name: sample.name, digest: sample.digest })));
      pcm.recipe.scope = 'tracker-only';
      pcm.recipe.pcmDigestFNV1a = pcm.digest;
      lastLoop = pcm;
      setLastLoopUI();
      showTab('recorder');
      toast('Tracker loop rendered · ' + pcm.digest);
    } catch (error) { toast(error.message, true); }
  }

  async function prepareSampleBuffers() {
    await engine.ensureContext();
    for (const sample of state.samples) if (sample && !sample.audioBuffer) await engine.installAudioBuffer(sample);
  }

  function bindSoundLab() {
    ['#sound-guitar', '#sound-synth', '#sound-bass', '#sound-texture', '#sound-drive', '#sound-space'].forEach(selector => bindNumericControl(selector, () => {}));
    $('#sound-randomize').addEventListener('click', () => {
      const rng = new DSP.XorShift32(Number($('#sound-seed').value) || 1);
      $('#sound-seed').value = rng.next() || 1;
      toast('New deterministic Sound Lab seed');
    });
    $('#sound-generate').addEventListener('click', generateSound);
    $('#sound-preview').addEventListener('click', () => previewPCM(soundLoop));
    $('#sound-download').addEventListener('click', () => {
      if (!soundLoop) return;
      DSP.download('sound-lab-' + soundLoop.digest + '.wav', soundLoop.wav, 'audio/wav');
    });
    $('#sound-to-tracker').addEventListener('click', () => sendPCMToTracker(soundLoop, 'Sound Lab ' + $('#sound-style').selectedOptions[0].text));
  }

  function soundConfig() {
    return {
      style: $('#sound-style').value,
      root: Number($('#sound-root').value),
      scale: $('#sound-scale').value,
      bars: Number($('#sound-bars').value),
      seed: Number($('#sound-seed').value),
      octave: Number($('#sound-octave').value),
      guitar: Number($('#sound-guitar').value),
      synth: Number($('#sound-synth').value),
      bass: Number($('#sound-bass').value),
      texture: Number($('#sound-texture').value),
      drive: Number($('#sound-drive').value),
      space: Number($('#sound-space').value)
    };
  }

  function generateSound() {
    $('#sound-generate').disabled = true;
    $('#sound-meta').textContent = 'Generating seeded instrument loop…';
    setTimeout(() => {
      try {
        const config = soundConfig();
        soundLoop = DSP.renderSoundLab(config, state.tempo, Number($('#record-rate').value));
        soundLoop.wav = DSP.encodeWav(soundLoop.left, soundLoop.right, soundLoop.sampleRate);
        soundLoop.mode = 'deterministic';
        soundLoop.name = 'Sound Lab ' + config.style;
        soundLoop.recipe = { schema: 'rb420.soundlab-recipe.v1', appVersion: DSP.VERSION, tempo: state.tempo, config: config, pcmDigestFNV1a: soundLoop.digest };
        drawWaveform($('#sound-waveform'), soundLoop);
        $('#sound-meta').textContent = config.style.toUpperCase() + ' · ' + DSP.noteName(config.root) + ' ' + config.scale.toUpperCase() + ' · ' + config.bars + ' bars · ' + formatTime(soundLoop.duration) + ' · PCM ' + soundLoop.digest;
        setSoundButtons(true);
        toast('Sound Lab loop forged · ' + soundLoop.digest);
      } catch (error) { toast(error.message, true); }
      finally { $('#sound-generate').disabled = false; }
    }, 30);
  }

  function setSoundButtons(enabled) {
    $('#sound-preview').disabled = !enabled;
    $('#sound-download').disabled = !enabled;
    $('#sound-to-tracker').disabled = !enabled;
  }

  function bindProject() {
    $('#project-name').addEventListener('input', event => { state.meta.name = event.target.value; updateProjectSummary(); });
    $('#project-author').addEventListener('input', event => { state.meta.author = event.target.value; });
    $('#project-notes').addEventListener('input', event => { state.meta.notes = event.target.value; });
    $('#project-save').addEventListener('click', saveProject);
    $('#project-load').addEventListener('click', () => $('#project-file').click());
    $('#project-file').addEventListener('change', loadProject);
    $('#project-new').addEventListener('click', () => {
      if (!window.confirm('Start a new RB-420 project? Unsaved changes will be lost.')) return;
      stopTransport();
      state = defaultState();
      history = []; future = []; lastLoop = null; soundLoop = null;
      syncAllControls(); renderAll(); clearLoopUI();
      toast('New project created');
    });
  }

  function serializableRenderState() {
    const core = cloneMusicalState();
    core.samples = state.samples;
    return core;
  }

  function int16ToBase64(array) {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(bytes.length, i + chunk)));
    return btoa(binary);
  }

  function base64ToInt16(text) {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Int16Array(bytes.buffer);
  }

  function serializableProject(includeAudio) {
    const project = cloneMusicalState();
    return {
      schema: 'rb420.project.v1',
      appVersion: DSP.VERSION,
      project: project,
      samples: state.samples.map(sample => {
        const item = { name: sample.name, sampleRate: sample.sampleRate, frames: sample.frames, duration: sample.duration, digest: sample.digest, rootNote: sample.rootNote, sourceMode: sample.sourceMode };
        if (includeAudio) {
          item.pcm16LeftBase64 = int16ToBase64(sample.pcmLeft);
          item.pcm16RightBase64 = int16ToBase64(sample.pcmRight || sample.pcmLeft);
        }
        return item;
      })
    };
  }

  function saveProject() {
    try {
      const data = serializableProject(true);
      data.projectId = 'rb420-' + DSP.fnv1aString(DSP.stableStringify(serializableProject(false)));
      DSP.download(sanitizeFilename(state.meta.name) + '.rb420.json', JSON.stringify(data), 'application/json');
      toast('Project saved with ' + state.samples.length + ' embedded sample(s)');
    } catch (error) { toast('Project save failed: ' + error.message, true); }
  }

  async function loadProject(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.schema !== 'rb420.project.v1' || !data.project) throw new Error('Not an RB-420 project file.');
      stopTransport();
      const fresh = defaultState();
      state = Object.assign(fresh, data.project);
      state.samples = (data.samples || []).map(item => {
        if (!item.pcm16LeftBase64) return null;
        const left = base64ToInt16(item.pcm16LeftBase64);
        const right = item.pcm16RightBase64 ? base64ToInt16(item.pcm16RightBase64) : new Int16Array(left);
        return Object.assign({}, item, { pcmLeft: left, pcmRight: right, frames: left.length, duration: left.length / item.sampleRate, audioBuffer: null });
      }).filter(Boolean);
      history = []; future = [];
      syncAllControls(); renderAll();
      await prepareSampleBuffers();
      toast('Loaded ' + file.name + ' · ' + state.samples.length + ' sample(s)');
    } catch (error) { toast('Project load failed: ' + error.message, true); }
  }

  function updateProjectSummary() {
    const activeAcid = state.acid.reduce((sum, machine) => sum + machine.pattern.filter(Boolean).length, 0);
    const drumHits = Object.values(state.drums.patterns).reduce((sum, pattern) => sum + pattern.filter(Boolean).length, 0);
    const trackerNotes = state.tracker.pattern.reduce((sum, row) => sum + row.filter(cell => cell.note !== null && cell.note !== undefined).length, 0);
    const summary = 'PROJECT · ' + (state.meta.name || 'Untitled') + '  |  ' + state.tempo + ' BPM  |  ' + activeAcid + ' ACID NOTES  |  ' + drumHits + ' DRUM HITS  |  ' + trackerNotes + ' TRACKER EVENTS  |  ' + state.samples.length + ' SAMPLES';
    $('#project-summary').textContent = summary;
  }

  function clearLoopUI() {
    const canvases = [$('#record-waveform'), $('#sound-waveform')];
    canvases.forEach(canvas => { const ctx = canvas.getContext('2d'); ctx.fillStyle = '#11170f'; ctx.fillRect(0, 0, canvas.width, canvas.height); });
    $('#record-meta').textContent = 'No loop recorded yet.';
    $('#sound-meta').textContent = 'Choose a style and generate a deterministic guitar/synth loop.';
    ['#loop-preview', '#loop-download', '#recipe-download', '#loop-to-tracker', '#loop-to-sample'].forEach(selector => $(selector).disabled = true);
    setSoundButtons(false);
  }

  function syncAllControls() {
    $('#tempo').value = state.tempo;
    $('#swing').value = state.swing;
    $('#swing-value').textContent = state.swing + '%';
    $('#master-volume').value = state.masterVolume;
    $('#master-value').textContent = state.masterVolume;
    $('#global-seed').value = state.seed;
    state.acid.forEach((machine, index) => {
      const node = $$('.acid-machine')[index];
      node.querySelectorAll('[data-acid-param]').forEach(input => {
        input.value = machine[input.dataset.acidParam];
        input.parentElement.querySelector('output').textContent = input.value;
      });
      node.querySelectorAll('[data-wave]').forEach(button => button.classList.toggle('is-active', button.dataset.wave === machine.waveform));
      node.querySelector('[data-machine-mute]').classList.toggle('is-active', machine.mute);
      node.querySelector('[data-machine-solo]').classList.toggle('is-active', machine.solo);
    });
    $$('[data-kit]').forEach(button => button.classList.toggle('is-active', button.dataset.kit === state.drums.kit));
    $('#drum-volume').value = state.drums.volume; $('#drum-volume').parentElement.querySelector('output').textContent = state.drums.volume;
    $('#drum-drive').value = state.drums.drive; $('#drum-drive').parentElement.querySelector('output').textContent = state.drums.drive;
    $('#drum-humanize').value = state.drums.humanize; $('#drum-humanize').parentElement.querySelector('output').textContent = state.drums.humanize;
    $('#fx-distortion').value = state.fx.distortion;
    $('#fx-filter').value = state.fx.filter;
    $('#fx-delay-time').value = state.fx.delayTime;
    $('#fx-feedback').value = state.fx.feedback;
    $('#fx-delay-mix').value = state.fx.delayMix;
    $('#fx-compression').value = state.fx.compression;
    ['#fx-distortion', '#fx-filter', '#fx-delay-time', '#fx-feedback', '#fx-delay-mix', '#fx-compression'].forEach(selector => $(selector).parentElement.querySelector('output').textContent = $(selector).value);
    $('#fx-bypass').classList.toggle('is-active', state.fx.bypass);
    $('#tracker-rows').value = state.tracker.rows;
    $('#tracker-speed').value = state.tracker.rowsPerBeat;
    $('#tracker-volume').value = state.tracker.volume;
    $('#tracker-volume').parentElement.querySelector('output').textContent = state.tracker.volume;
    $('#project-name').value = state.meta.name || '';
    $('#project-author').value = state.meta.author || '';
    $('#project-notes').value = state.meta.notes || '';
  }

  function renderAll() {
    renderAcidSteps();
    renderDrumGrid();
    renderSampleSlots();
    renderTracker();
    syncPatternEditor();
    updateProjectSummary();
    updateUndoButtons();
  }

  function runStartupSelfCheck() {
    try {
      const test = defaultState();
      test.tracker.pattern = makeTrackerPattern(4);
      const a = DSP.renderProject(test, .08, 44100);
      const b = DSP.renderProject(test, .08, 44100);
      if (a.digest !== b.digest || a.left.length !== b.left.length) throw new Error('deterministic renderer mismatch');
      const wav = DSP.encodeWav(a.left, a.right, a.sampleRate);
      const decoded = DSP.decodeWavPCM16(wav);
      if (!decoded || decoded.digest !== a.digest) throw new Error('WAV round-trip mismatch');
      document.documentElement.dataset.selfTest = 'passed';
    } catch (error) {
      document.documentElement.dataset.selfTest = 'failed';
      toast('Startup self-check failed: ' + error.message, true);
    }
  }

  function initialize() {
    bindTabs();
    bindRangeOutputs();
    bindGlobalControls();
    bindMachineControls();
    bindEuclidean();
    bindPatternEditor();
    bindRecorder();
    bindTracker();
    bindSoundLab();
    bindProject();
    syncAllControls();
    renderAll();
    clearLoopUI();
    runStartupSelfCheck();
  }

  initialize();
}());
