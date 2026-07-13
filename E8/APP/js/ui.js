(function defineE8StudioUI(S) {
  "use strict";

  const STORAGE_KEY = "spectral-e8-studio-custom-presets-v1";
  const uiState = {
    params: S.Core.mergeParams({}),
    mode: S.MODES.STRICT,
    profileId: "studio",
    currentObjectUrl: null,
    activeView: "geometry",
    customPresets: Object.create(null),
    rendering: false,
    resizeToken: 0
  };

  function byId(id) { return document.getElementById(id); }
  function all(selector) { return Array.from(document.querySelectorAll(selector)); }
  function deepCopy(value) { return JSON.parse(JSON.stringify(value)); }

  function setStatus(message, kind) {
    const node = byId("render-status");
    node.textContent = message;
    node.dataset.kind = kind || "note";
  }

  function setProgress(value) { byId("render-progress").style.width = Math.max(0, Math.min(100, value * 100)).toFixed(1) + "%"; }

  function parseSeed(raw) {
    const text = String(raw).trim();
    let value;
    if (/^0x[0-9a-f]+$/i.test(text)) value = parseInt(text.slice(2), 16);
    else if (/^\d+$/.test(text)) value = Number(text);
    else throw new Error("Seed must be an unsigned decimal integer or 0x hexadecimal value");
    if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) throw new Error("Seed must fit in an unsigned 32-bit integer");
    return value >>> 0;
  }

  function numberFromControl(control, scale) {
    return S.Core.decimalToScaled(control.value, scale || 1);
  }

  function collectParams() {
    const params = S.Core.mergeParams(uiState.params);
    params.duration_ms = numberFromControl(byId("duration-seconds"), 1000);
    params.seed_u32 = parseSeed(byId("seed-input").value);
    params.mutation_index = numberFromControl(byId("mutation-input"), 1);
    for (const control of all("[data-param]")) {
      const key = control.dataset.param;
      if (key === "anchor_hz") params.anchor_millihz = numberFromControl(control, 1000);
      else if (key === "pulse_rate_hz") params.pulse_rate_millihz = numberFromControl(control, 1000);
      else if (key === "haas_ms") params.haas_micros = numberFromControl(control, 1000);
      else if (["lattice", "path", "spatial_mode"].includes(key)) params[key] = control.value;
      else params[key] = numberFromControl(control, 1);
    }
    params.axis_gains_milli = all("[data-axis]").sort((a, b) => Number(a.dataset.axis) - Number(b.dataset.axis)).map(control => numberFromControl(control, 1));
    return S.Core.validateParams(params);
  }

  function formatMacro(key, value) {
    if (key === "drift_millirad") return (value / 1000).toFixed(3) + " rad/s";
    if (["bloom_milli", "phase_gain_milli", "amplitude_gain_milli", "ternary_bias_milli"].includes(key)) return (value >= 0 ? "+" : "") + (value / 1000).toFixed(3);
    if (["wave_morph_milli", "triality_milli", "pulse_depth_milli", "width_milli"].includes(key)) return (value / 10).toFixed(1) + "%";
    if (key === "drive_milli") return "×" + (value / 1000).toFixed(3);
    if (key === "feedback_milli") return (value / 10).toFixed(1) + "%";
    return String(value);
  }

  function updateOutputs() {
    for (const output of all("[data-output-for]")) {
      const control = document.querySelector('[data-param="' + output.dataset.outputFor + '"]');
      if (control) output.value = formatMacro(output.dataset.outputFor, Number(control.value));
    }
    for (const output of all("[data-axis-output]")) {
      const control = document.querySelector('[data-axis="' + output.dataset.axisOutput + '"]');
      output.value = (Number(control.value) / 1000).toFixed(3);
    }
    byId("scene-morph-output").value = (Number(byId("scene-morph").value) / 10).toFixed(1) + "%";
  }

  function syncControls(paramsInput) {
    const params = S.Core.validateParams(paramsInput);
    uiState.params = deepCopy(params);
    byId("duration-seconds").value = (params.duration_ms / 1000).toString();
    byId("seed-input").value = "0x" + params.seed_u32.toString(16).toUpperCase().padStart(8, "0");
    byId("mutation-input").value = params.mutation_index;
    for (const control of all("[data-param]")) {
      const key = control.dataset.param;
      if (key === "anchor_hz") control.value = (params.anchor_millihz / 1000).toString();
      else if (key === "pulse_rate_hz") control.value = (params.pulse_rate_millihz / 1000).toString();
      else if (key === "haas_ms") control.value = (params.haas_micros / 1000).toString();
      else control.value = params[key];
    }
    all("[data-axis]").forEach(control => { control.value = params.axis_gains_milli[Number(control.dataset.axis)]; });
    updateOutputs();
    refreshEstimateAndGeometry();
  }

  function selectedMode() {
    const control = document.querySelector('input[name="render-mode"]:checked');
    return control ? control.value : S.MODES.STRICT;
  }

  function syncMode(mode) {
    uiState.mode = mode;
    const meta = S.MODE_META[mode];
    const radio = document.querySelector('input[name="render-mode"][value="' + mode + '"]');
    if (radio) radio.checked = true;
    document.body.classList.toggle("mode-replay", mode === S.MODES.REPLAY);
    document.body.classList.toggle("mode-creative", mode === S.MODES.CREATIVE);
    const lamp = byId("mode-lamp");
    lamp.className = "state-lamp " + (mode === S.MODES.STRICT ? "strict" : mode === S.MODES.REPLAY ? "replay" : "creative");
    lamp.textContent = meta.short;
    const notice = byId("mode-notice");
    notice.className = "mode-notice " + (mode === S.MODES.STRICT ? "" : mode === S.MODES.REPLAY ? "replay" : "creative");
    notice.querySelector("strong").textContent = meta.name;
    notice.querySelector("span").textContent = meta.promise;
    byId("new-take").disabled = uiState.rendering || mode !== S.MODES.CREATIVE;
    byId("mutate-settings").textContent = mode === S.MODES.CREATIVE ? "Randomise" : "Mutate";
    refreshEstimateAndGeometry();
  }

  function refreshEstimateAndGeometry() {
    try {
      const params = collectParams();
      uiState.params = deepCopy(params);
      uiState.profileId = byId("profile-select").value;
      const estimate = S.Engine.estimate(params, S.EXPORT_PROFILES[uiState.profileId]);
      byId("estimate-wav").textContent = S.Visuals.formatBytes(estimate.wav_bytes);
      byId("estimate-memory").textContent = S.Visuals.formatBytes(estimate.working_bytes);
      byId("estimate-roots").textContent = estimate.root_evaluations >= 1000000 ? (estimate.root_evaluations / 1000000).toFixed(2) + " M" : estimate.root_evaluations.toLocaleString("en-US");
      S.Visuals.drawGeometry(byId("geometry-canvas"), params, S.state.currentJob ? S.state.currentJob.trajectory : null);
    } catch (error) {
      byId("estimate-wav").textContent = "INVALID";
      byId("estimate-memory").textContent = "—";
      byId("estimate-roots").textContent = "—";
    }
  }

  function loadCustomPresets() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) uiState.customPresets = parsed;
    } catch (_) { uiState.customPresets = Object.create(null); }
  }

  function persistCustomPresets() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(uiState.customPresets)); return true; }
    catch (_) { return false; }
  }

  function populatePresets() {
    const select = byId("preset-select");
    select.textContent = "";
    const factoryGroup = document.createElement("optgroup"); factoryGroup.label = "Factory geometry";
    for (const [id, preset] of Object.entries(S.PRESETS)) {
      const option = document.createElement("option"); option.value = "factory:" + id; option.textContent = preset.name; factoryGroup.appendChild(option);
    }
    select.appendChild(factoryGroup);
    const names = Object.keys(uiState.customPresets).sort();
    if (names.length) {
      const customGroup = document.createElement("optgroup"); customGroup.label = "My presets";
      for (const name of names) { const option = document.createElement("option"); option.value = "custom:" + name; option.textContent = name; customGroup.appendChild(option); }
      select.appendChild(customGroup);
    }
    select.value = "factory:deep_sweep";
    updatePresetDescription();
  }

  function currentPreset() {
    const [kind, id] = byId("preset-select").value.split(/:(.*)/s);
    if (kind === "factory") return S.PRESETS[id];
    if (kind === "custom" && uiState.customPresets[id]) return { name: id, description: "Saved locally in this browser profile.", values: uiState.customPresets[id] };
    return null;
  }

  function updatePresetDescription() {
    const preset = currentPreset();
    byId("preset-description").textContent = preset ? preset.description : "";
  }

  function applySelectedPreset() {
    const preset = currentPreset();
    if (!preset) return;
    let current;
    try { current = collectParams(); } catch (_) { current = S.Core.mergeParams({}); }
    const params = S.Core.mergeParams(preset.values || {});
    params.duration_ms = current.duration_ms;
    params.seed_u32 = current.seed_u32;
    params.mutation_index = current.mutation_index;
    syncControls(params);
    setStatus("Preset applied: " + preset.name + ".", "pass");
  }

  function mutateSettings() {
    let params = collectParams();
    let identity;
    if (uiState.mode === S.MODES.CREATIVE) identity = S.Core.creativeEntropy().hex;
    else {
      params.mutation_index = Math.min(0x7fffffff, params.mutation_index + 1);
      identity = S.Core.hashCanonical("SPECTRAL/E8-STUDIO/CONTROL-MUTATION/v1", params);
    }
    const prng = new S.Core.Xoshiro128ss(S.Core.fromHex(identity));
    function vary(key, amount, minimum, maximum) {
      params[key] = Math.max(minimum, Math.min(maximum, Math.round(params[key] * (1 + prng.nextSigned() * amount))));
    }
    vary("drift_millirad", 0.35, 0, 240); vary("bloom_milli", 0.8, 0, 1000);
    vary("phase_gain_milli", 0.35, 0, 2000); vary("amplitude_gain_milli", 0.35, 0, 1200);
    vary("wave_morph_milli", 0.4, 0, 1000); vary("triality_milli", 0.5, 0, 1000);
    vary("width_milli", 0.25, 0, 1000); vary("drive_milli", 0.18, 250, 2500);
    params.root_offset = (params.root_offset + 1 + prng.nextUint32() % 47) % 240;
    params.axis_gains_milli = params.axis_gains_milli.map(value => Math.max(0, Math.min(1500, Math.round(value * (0.72 + prng.nextFloat() * 0.56)))));
    syncControls(params);
    setStatus(uiState.mode === S.MODES.CREATIVE ? "Controls randomised. Render creates a fresh entropy take." : "Deterministic mutation " + params.mutation_index + " prepared.", "pass");
  }

  function savePreset() {
    const suggested = "My E8 " + (Object.keys(uiState.customPresets).length + 1);
    const name = window.prompt("Name this local E8 preset:", suggested);
    if (!name) return;
    const clean = name.trim().slice(0, 60);
    if (!clean) return;
    uiState.customPresets[clean] = collectParams();
    const persisted = persistCustomPresets();
    populatePresets(); byId("preset-select").value = "custom:" + clean; updatePresetDescription();
    setStatus(persisted ? "Preset saved locally: " + clean + "." : "Preset is available for this session; local storage was unavailable.", persisted ? "pass" : "note");
  }

  function progressUpdate(event) {
    const phase = event.phase || "render";
    let base = 0, span = 0.72;
    if (phase === "dc scan") { base = 0.72; span = 0.08; }
    else if (phase === "peak scan") { base = 0.80; span = 0.08; }
    else if (phase === "pcm quantize") { base = 0.88; span = 0.10; }
    setProgress(base + event.ratio * span);
    setStatus(phase.toUpperCase() + " · " + Math.round(event.ratio * 100) + "%", "working");
  }

  function setRendering(active) {
    uiState.rendering = active;
    document.body.classList.toggle("rendering", active);
    byId("render-full").disabled = active;
    byId("render-preview").disabled = active;
    byId("cancel-render").disabled = !active;
    byId("new-take").disabled = active || uiState.mode !== S.MODES.CREATIVE;
  }

  async function renderTake(preview) {
    if (uiState.rendering) return;
    let params;
    try { params = collectParams(); }
    catch (error) { setStatus(error.message, "error"); return; }
    if (preview) params.duration_ms = Math.min(8000, params.duration_ms);
    uiState.profileId = byId("profile-select").value;
    uiState.mode = selectedMode();
    const controller = new AbortController(); S.state.renderAbort = controller;
    setRendering(true); setProgress(0); setStatus(preview ? "Preparing an 8-second preview…" : "Preparing full E8 take…", "working");
    try {
      const job = await S.Provenance.renderJob(params, uiState.profileId, uiState.mode, { signal: controller.signal, progress: progressUpdate });
      setProgress(1); acceptJob(job, false);
    } catch (error) {
      if (error && error.name === "AbortError") setStatus("Render cancelled. No partial artifacts were retained.", "note");
      else setStatus("Render failed: " + (error && error.message ? error.message : String(error)), "error");
    } finally {
      S.state.renderAbort = null; setRendering(false);
      window.setTimeout(() => { if (!uiState.rendering) setProgress(0); }, 900);
    }
  }

  function revokeCurrentUrl() {
    if (uiState.currentObjectUrl) { URL.revokeObjectURL(uiState.currentObjectUrl); uiState.currentObjectUrl = null; }
  }

  function acceptJob(job, replayed) {
    revokeCurrentUrl();
    S.state.currentJob = job;
    uiState.currentObjectUrl = URL.createObjectURL(new Blob([job.wavBytes], { type: "audio/wav" }));
    const player = byId("audio-player"); player.src = uiState.currentObjectUrl; player.load();
    S.Visuals.drawGeometry(byId("geometry-canvas"), job.params, job.trajectory);
    S.Visuals.drawWaveform(byId("waveform-canvas"), job.pcm);
    S.Visuals.drawSpectrogram(byId("spectrum-canvas"), job.pcm, job.profile.sample_rate, byId("log-frequency").checked);
    byId("metric-peak").textContent = S.Visuals.formatDb(job.metrics.peak_dbfs_milli);
    byId("metric-rms").textContent = S.Visuals.formatDb(job.metrics.rms_dbfs_milli);
    byId("metric-correlation").textContent = (job.metrics.stereo_correlation_millionths / 1000000).toFixed(3);
    byId("metric-clips").textContent = job.metrics.clipping_frame_count.toLocaleString("en-US");
    byId("metric-trajectory").textContent = job.trajectory.length + " points";
    byId("metric-contract").textContent = job.contractSha256.slice(0, 12) + "…";
    byId("render-hash-short").textContent = job.identities.wav_sha256.slice(0, 16).toUpperCase();
    byId("geometry-caption").textContent = "240 ROOTS · " + job.params.path.replace(/_/g, " ").toUpperCase() + " · " + job.params.voice_count + " VOICES";
    all("[data-artifact]").forEach(button => { button.disabled = false; });
    ["store-audio-a","store-audio-b"].forEach(id => { byId(id).disabled = false; });
    const modeName = S.MODE_META[job.mode].name;
    byId("artifact-note").textContent = job.mode === S.MODES.CREATIVE
      ? "Creative take archived by exact WAV hash. Its entropy nonce is deliberately not exported."
      : "Mode-scoped recipe, trajectory, fingerprint, contract, and WAV are ready.";
    setStatus((replayed ? "Manifest replay verified" : "Render complete") + " · " + modeName + " · WAV " + job.identities.wav_sha256.slice(0, 12) + "…", "pass");
  }

  function cancelRender() { if (S.state.renderAbort) S.state.renderAbort.abort(); }

  function downloadBytes(bytes, filename, type) {
    const url = URL.createObjectURL(new Blob([bytes], { type: type || "application/octet-stream" }));
    const link = document.createElement("a"); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function artifactFilename(job, artifact) {
    if (artifact === "audio.wav") return job.filename + ".wav";
    if (artifact === "bundle.zip") return job.filename + "-provenance.zip";
    return job.filename + "-" + artifact;
  }

  function downloadArtifact(artifact) {
    const job = S.state.currentJob;
    if (!job) return;
    if (artifact === "bundle.zip") {
      setStatus("Building the local provenance bundle…", "working");
      window.setTimeout(() => {
        const bytes = job.getZip(); downloadBytes(bytes, artifactFilename(job, artifact), "application/zip");
        setStatus("Provenance bundle ready · " + S.Visuals.formatBytes(bytes.length) + ".", "pass");
      }, 0);
      return;
    }
    const bytes = job.artifacts[artifact];
    if (!bytes) return;
    const type = artifact.endsWith(".wav") ? "audio/wav" : artifact.endsWith(".json") ? "application/json" : artifact.endsWith(".csv") ? "text/csv" : "text/plain";
    downloadBytes(bytes, artifactFilename(job, artifact), type);
  }

  function captureScene(slot) {
    S.state.scenes[slot] = deepCopy(collectParams());
    const button = byId("capture-scene-" + slot.toLowerCase()); button.textContent = "Update " + slot; button.dataset.captured = "true";
    const ready = Boolean(S.state.scenes.A && S.state.scenes.B); byId("scene-morph").disabled = !ready;
    setStatus("Scene " + slot + " captured" + (ready ? "; the morph rail is active." : ". Capture the other scene to enable morphing."), "pass");
  }

  function morphScenes() {
    const a = S.state.scenes.A, b = S.state.scenes.B;
    if (!a || !b) return;
    const amount = Number(byId("scene-morph").value) / 1000;
    const output = {};
    for (const key of Object.keys(a)) {
      if (Array.isArray(a[key])) output[key] = a[key].map((value, index) => Math.round(value + (b[key][index] - value) * amount));
      else if (typeof a[key] === "number" && !["seed_u32", "mutation_index"].includes(key)) output[key] = Math.round(a[key] + (b[key] - a[key]) * amount);
      else output[key] = amount < 0.5 ? a[key] : b[key];
    }
    syncControls(output); updateOutputs();
  }

  function storeComparison(slot) {
    const job = S.state.currentJob;
    if (!job) return;
    const previous = S.state.comparisons[slot]; if (previous && previous.url) URL.revokeObjectURL(previous.url);
    const url = URL.createObjectURL(new Blob([job.wavBytes], { type: "audio/wav" }));
    S.state.comparisons[slot] = { url, label: job.filename, wavSha256: job.identities.wav_sha256 };
    byId("play-audio-" + slot.toLowerCase()).disabled = false;
    setStatus("Current take stored in comparison slot " + slot + ".", "pass");
  }

  function playComparison(slot) {
    const comparison = S.state.comparisons[slot]; if (!comparison) return;
    const player = byId("audio-player"); player.src = comparison.url; player.play().catch(() => {});
    setStatus("Playing comparison " + slot + " · " + comparison.wavSha256.slice(0, 12) + "…", "note");
  }

  async function readJsonFile(file) {
    const text = typeof file.text === "function" ? await file.text() : await new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsText(file);
    });
    return JSON.parse(text);
  }

  async function loadRecipeFile(file) {
    try {
      const recipe = await readJsonFile(file); const settings = S.Provenance.recipeSettings(recipe);
      byId("profile-select").value = settings.profileId; uiState.profileId = settings.profileId;
      syncMode(settings.mode); syncControls(settings.params);
      setStatus(settings.mode === S.MODES.CREATIVE ? "Creative settings cloned. The next render will use new entropy." : "Recipe loaded and authenticated structurally.", "pass");
    } catch (error) { setStatus("Recipe load failed: " + error.message, "error"); }
  }

  async function replayManifestFile(file) {
    if (uiState.rendering) return;
    let manifest;
    try { manifest = await readJsonFile(file); }
    catch (error) { setStatus("Manifest parse failed: " + error.message, "error"); return; }
    const controller = new AbortController(); S.state.renderAbort = controller; setRendering(true); setProgress(0);
    setStatus("Authenticating and replaying the manifest…", "working");
    try {
      const job = await S.Provenance.replayManifest(manifest, { signal: controller.signal, progress: progressUpdate });
      byId("profile-select").value = job.profile.id; syncMode(job.mode); syncControls(job.params); setProgress(1); acceptJob(job, true);
    } catch (error) { setStatus("Manifest replay failed closed: " + error.message, "error"); }
    finally { S.state.renderAbort = null; setRendering(false); window.setTimeout(() => setProgress(0), 900); }
  }

  function switchView(view) {
    uiState.activeView = view;
    all(".view-tab").forEach(button => { const active = button.dataset.view === view; button.classList.toggle("active", active); button.setAttribute("aria-selected", String(active)); });
    all(".canvas-panel").forEach(panel => panel.classList.toggle("active", panel.dataset.panel === view));
    const job = S.state.currentJob;
    if (view === "geometry") S.Visuals.drawGeometry(byId("geometry-canvas"), job ? job.params : collectParams(), job ? job.trajectory : null);
    if (view === "waveform") S.Visuals.drawWaveform(byId("waveform-canvas"), job ? job.pcm : null);
    if (view === "spectrum") S.Visuals.drawSpectrogram(byId("spectrum-canvas"), job ? job.pcm : null, job ? job.profile.sample_rate : 48000, byId("log-frequency").checked);
  }

  function handleResize() {
    cancelAnimationFrame(uiState.resizeToken);
    uiState.resizeToken = requestAnimationFrame(() => {
      try { switchView(uiState.activeView); } catch (_) {}
    });
  }

  function populateProfiles() {
    const select = byId("profile-select"); select.textContent = "";
    for (const [id, profile] of Object.entries(S.EXPORT_PROFILES)) {
      const option = document.createElement("option"); option.value = id; option.textContent = profile.name; if (id === uiState.profileId) option.selected = true; select.appendChild(option);
    }
  }

  function bindEvents() {
    all('input[name="render-mode"]').forEach(control => control.addEventListener("change", () => syncMode(selectedMode())));
    byId("preset-select").addEventListener("change", updatePresetDescription);
    byId("apply-preset").addEventListener("click", applySelectedPreset);
    byId("mutate-settings").addEventListener("click", mutateSettings);
    byId("save-preset").addEventListener("click", savePreset);
    byId("render-full").addEventListener("click", () => renderTake(false));
    byId("render-preview").addEventListener("click", () => renderTake(true));
    byId("new-take").addEventListener("click", () => renderTake(false));
    byId("cancel-render").addEventListener("click", cancelRender);
    byId("capture-scene-a").addEventListener("click", () => captureScene("A"));
    byId("capture-scene-b").addEventListener("click", () => captureScene("B"));
    byId("scene-morph").addEventListener("input", morphScenes);
    byId("reset-axes").addEventListener("click", () => { all("[data-axis]").forEach(control => { control.value = 1000; }); updateOutputs(); refreshEstimateAndGeometry(); });
    byId("profile-select").addEventListener("change", refreshEstimateAndGeometry);
    byId("load-recipe").addEventListener("click", () => byId("recipe-file").click());
    byId("replay-manifest").addEventListener("click", () => byId("manifest-file").click());
    byId("recipe-file").addEventListener("change", event => { const file = event.target.files[0]; if (file) loadRecipeFile(file); event.target.value = ""; });
    byId("manifest-file").addEventListener("change", event => { const file = event.target.files[0]; if (file) replayManifestFile(file); event.target.value = ""; });
    all("[data-param], [data-axis], #duration-seconds, #seed-input, #mutation-input").forEach(control => {
      control.addEventListener("input", () => { updateOutputs(); refreshEstimateAndGeometry(); });
      control.addEventListener("change", () => { updateOutputs(); refreshEstimateAndGeometry(); });
    });
    all(".view-tab").forEach(button => button.addEventListener("click", () => switchView(button.dataset.view)));
    byId("log-frequency").addEventListener("change", () => { if (uiState.activeView === "spectrum") switchView("spectrum"); });
    all("[data-artifact]").forEach(button => button.addEventListener("click", () => downloadArtifact(button.dataset.artifact)));
    byId("store-audio-a").addEventListener("click", () => storeComparison("A"));
    byId("store-audio-b").addEventListener("click", () => storeComparison("B"));
    byId("play-audio-a").addEventListener("click", () => playComparison("A"));
    byId("play-audio-b").addEventListener("click", () => playComparison("B"));
    window.addEventListener("resize", handleResize);
    window.addEventListener("beforeunload", () => {
      revokeCurrentUrl();
      for (const slot of ["A","B"]) { const item = S.state.comparisons[slot]; if (item && item.url) URL.revokeObjectURL(item.url); }
    });
    document.addEventListener("keydown", event => {
      const target = event.target;
      if (event.key.toLowerCase() === "r" && !event.ctrlKey && !event.metaKey && !(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement) && !(target instanceof HTMLTextAreaElement)) {
        event.preventDefault(); renderTake(false);
      }
    });
  }

  function init() {
    loadCustomPresets(); populateProfiles(); populatePresets(); bindEvents();
    syncMode(S.MODES.STRICT); syncControls(S.Core.mergeParams({}));
    S.Visuals.drawWaveform(byId("waveform-canvas"), null);
    S.Visuals.drawSpectrogram(byId("spectrum-canvas"), null, 48000, true);
    byId("runtime-state").textContent = "OFFLINE · 240 ROOTS · LOCAL DSP";
  }

  S.UI = Object.freeze({ init, collectParams, syncControls, syncMode, renderTake, acceptJob });
})(window.E8STUDIO);
