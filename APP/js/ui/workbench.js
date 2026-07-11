(function defineWorkbench(S) {
  "use strict";

  function element(id) {
    const found = document.getElementById(id);
    if (!found) throw new Error("Missing UI element: " + id);
    return found;
  }

  function shortHash(hash, length) {
    if (!hash) return "—";
    const size = length || 16;
    return hash.slice(0, size) + "…" + hash.slice(-6);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"})[character]);
  }

  class Workbench {
    constructor() {
      this.currentEngine = null;
      this.currentParameters = {};
      this.customPresets = [];
      this.currentInspectorTab = "manifest";
      this.audioUrl = null;
      this.derivativePending = null;
      this.rendering = false;
      this.renderController = null;
      this.waveform = new S.UI.WaveformView(element("waveform-canvas"), {
        onViewChange: view => this.spectrogram && this.spectrogram.setView(view),
        onRangeChange: (start, end) => { element("waveform-range").textContent = start.toFixed(3) + " — " + end.toFixed(3) + " s"; },
        onSelectionChange: selection => {
          element("selection-readout").textContent = selection
            ? "SELECTION · " + Math.min(selection.start, selection.end).toFixed(3) + " — " + Math.max(selection.start, selection.end).toFixed(3) + " s"
            : "SELECTION · NONE";
        }
      });
      this.spectrogram = new S.UI.SpectrogramView(element("spectrogram-canvas"));
    }

    async initialize() {
      element("app-version").textContent = S.APP.version;
      this.populateProfiles();
      this.populateEngines();
      this.bindEvents();
      this.selectEngine(S.Engines.Registry.list()[0].id, true);
      const storage = await S.Storage.Database.open();
      const storageStatus = element("storage-status");
      if (storage.persistent) {
        storageStatus.textContent = "STORAGE · INDEXEDDB";
        storageStatus.classList.add("status-local");
      } else {
        storageStatus.textContent = "STORAGE · SESSION ONLY";
        storageStatus.title = storage.reason || "Persistent storage is unavailable.";
        this.toast("IndexedDB is unavailable for this file origin. Jobs will last only for this open page.", "error", 7000);
      }
      this.customPresets = await S.Storage.Database.listPresets();
      this.renderPresetBrowser();
      await this.refreshHistory();
      element("runtime-status").textContent = "RUNTIME · " + (location.protocol === "file:" ? "FILE" : "BROWSER");
    }

    bindEvents() {
      document.querySelectorAll('input[name="determinism-mode"]').forEach(input => input.addEventListener("change", () => this.setMode(input.value)));
      element("engine-select").addEventListener("change", event => this.selectEngine(event.target.value, true));
      element("profile-select").addEventListener("change", () => this.markPresetInactive());
      element("render-button").addEventListener("click", () => this.render());
      element("cancel-render-button").addEventListener("click", () => this.cancelRender());
      element("replay-manifest-button").addEventListener("click", () => element("replay-manifest-file").click());
      element("replay-manifest-file").addEventListener("change", event => this.replayManifestFile(event.target.files[0]));
      element("determinism-help").addEventListener("click", () => element("mode-dialog").showModal());
      element("dismiss-notice").addEventListener("click", () => element("startup-notice").remove());
      element("reset-params").addEventListener("click", () => this.renderParameterControls(S.Engines.Registry.defaults(this.currentEngine)));
      element("save-preset").addEventListener("click", () => this.savePreset());

      element("choose-source").addEventListener("click", event => { event.stopPropagation(); element("source-file").click(); });
      element("source-file").addEventListener("change", event => this.loadSourceFile(event.target.files[0]));
      const drop = element("drop-zone");
      drop.addEventListener("click", event => { if (event.target === drop || event.target.classList.contains("drop-icon")) element("source-file").click(); });
      drop.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); element("source-file").click(); } });
      ["dragenter","dragover"].forEach(type => drop.addEventListener(type, event => { event.preventDefault(); drop.classList.add("dragover"); }));
      ["dragleave","drop"].forEach(type => drop.addEventListener(type, event => { event.preventDefault(); drop.classList.remove("dragover"); }));
      drop.addEventListener("drop", event => this.loadSourceFile(event.dataTransfer.files[0]));
      element("clear-source").addEventListener("click", () => this.clearSource());
      element("use-pasted-source").addEventListener("click", () => this.usePastedSource());

      element("fft-size").addEventListener("change", () => this.updateSpectrogramOptions());
      element("frequency-scale").addEventListener("change", () => this.updateSpectrogramOptions());
      element("reset-view").addEventListener("click", () => this.waveform.reset());
      element("loop-toggle").addEventListener("change", event => { element("audio-player").loop = event.target.checked; });

      element("assign-a").addEventListener("click", () => this.assignAb("A"));
      element("assign-b").addEventListener("click", () => this.assignAb("B"));
      element("play-a").addEventListener("click", () => this.playAb("A"));
      element("play-b").addEventListener("click", () => this.playAb("B"));
      element("copy-hashes").addEventListener("click", () => this.copyHashes());
      document.querySelectorAll("[data-artifact]").forEach(button => button.addEventListener("click", () => this.downloadArtifact(button.dataset.artifact)));

      document.querySelectorAll("[data-inspector-tab]").forEach(button => button.addEventListener("click", () => {
        this.currentInspectorTab = button.dataset.inspectorTab;
        document.querySelectorAll("[data-inspector-tab]").forEach(tab => tab.classList.toggle("active", tab === button));
        this.refreshInspector();
      }));

      element("clear-history").addEventListener("click", () => this.clearHistory());
      element("history-body").addEventListener("click", event => {
        const button = event.target.closest("[data-load-job]");
        if (button) this.loadHistoryJob(button.dataset.loadJob);
      });

      element("choose-derivative").addEventListener("click", () => element("derivative-file").click());
      element("derivative-file").addEventListener("change", event => this.loadDerivative(event.target.files[0]));
      element("save-lineage").addEventListener("click", () => this.saveLineage());
    }

    populateProfiles() {
      const select = element("profile-select");
      select.innerHTML = "";
      Object.values(S.EXPORT_PROFILES).forEach(profile => {
        const option = document.createElement("option");
        option.value = profile.id;
        option.textContent = profile.name + " · " + profile.sampleRate / 1000 + " kHz";
        select.appendChild(option);
      });
    }

    populateEngines() {
      const select = element("engine-select");
      select.innerHTML = "";
      S.Engines.Registry.list().forEach(engine => {
        const option = document.createElement("option");
        option.value = engine.id;
        option.textContent = engine.name;
        select.appendChild(option);
      });
    }

    selectedMode() {
      return document.querySelector('input[name="determinism-mode"]:checked').value;
    }

    setMode(mode, quiet) {
      if (this.currentEngine && !this.currentEngine.supportedModes.includes(mode)) {
        const fallback = this.currentEngine.supportedModes[0];
        document.querySelector('input[name="determinism-mode"][value="' + fallback + '"]').checked = true;
        mode = fallback;
        if (!quiet) this.toast(this.currentEngine.name + " is Replay Safe because browser-native pixel decoding is runtime-dependent.", "error", 6500);
      }
      document.querySelectorAll("[data-mode-card]").forEach(card => card.classList.toggle("selected", card.dataset.modeCard === mode));
      element("render-mode-label").textContent = mode === S.MODES.CANONICAL_STRICT ? "CANONICAL STRICT" : "REPLAY SAFE";
      element("mode-contract").textContent = mode === S.MODES.CANONICAL_STRICT
        ? "Fixed-point DSP · canonical PCM16 · pure integer render path"
        : "Deterministic float DSP · same-runtime replay · runtime fingerprinted";
    }

    selectEngine(id, useDefaultProfile) {
      this.currentEngine = S.Engines.Registry.get(id);
      element("engine-select").value = id;
      element("engine-version").textContent = "v" + this.currentEngine.version;
      element("engine-description").textContent = this.currentEngine.description;
      element("claim-boundary").textContent = this.currentEngine.claimBoundary || S.APP.claimBoundary;
      if (!this.currentEngine.supportedModes.includes(this.selectedMode())) {
        const mode = this.currentEngine.supportedModes[0];
        document.querySelector('input[name="determinism-mode"][value="' + mode + '"]').checked = true;
        this.setMode(mode, true);
        this.toast("Image Scan selected Replay Safe: decoded image pixels can differ across browser runtimes.", "error", 6000);
      }
      if (useDefaultProfile !== false) element("profile-select").value = this.currentEngine.defaultExportProfile;
      this.renderParameterControls(S.Engines.Registry.defaults(this.currentEngine));
      this.renderPresetBrowser();
    }

    renderPresetBrowser() {
      if (!this.currentEngine) return;
      const browser = element("preset-browser");
      browser.innerHTML = "";
      const presets = this.currentEngine.presets.concat(this.customPresets.filter(preset => preset.engineId === this.currentEngine.id));
      presets.forEach(preset => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "preset-card";
        button.dataset.presetId = preset.id;
        button.setAttribute("role", "listitem");
        button.innerHTML = "<strong>" + escapeHtml(preset.name) + "</strong><small>" + escapeHtml(preset.subtitle || "Local preset") + "</small>";
        button.addEventListener("click", () => {
          this.renderParameterControls(Object.assign(S.Engines.Registry.defaults(this.currentEngine), preset.params));
          browser.querySelectorAll(".preset-card").forEach(card => card.classList.toggle("active", card === button));
        });
        browser.appendChild(button);
      });
    }

    markPresetInactive() {
      document.querySelectorAll(".preset-card").forEach(card => card.classList.remove("active"));
    }

    renderParameterControls(values) {
      const container = element("parameter-controls");
      container.innerHTML = "";
      this.currentParameters = Object.assign({}, values);
      for (const field of this.currentEngine.parameterSchema) {
        if (field.type === "range") {
          const wrapper = document.createElement("div");
          wrapper.className = "range-field";
          const label = document.createElement("label");
          const title = document.createElement("span");
          title.className = "field-label";
          title.textContent = field.label + (field.unit ? " · " + field.unit : "");
          const input = document.createElement("input");
          input.type = "range"; input.min = field.min; input.max = field.max; input.step = field.step; input.value = values[field.id]; input.dataset.parameter = field.id;
          const output = document.createElement("output");
          output.className = "range-output"; output.textContent = input.value;
          input.addEventListener("input", () => { output.textContent = input.value; this.currentParameters[field.id] = input.value; this.markPresetInactive(); });
          label.append(title, input); wrapper.append(label, output); container.appendChild(wrapper);
        } else if (field.type === "select") {
          const label = document.createElement("label");
          const title = document.createElement("span"); title.className = "field-label"; title.textContent = field.label;
          const select = document.createElement("select"); select.dataset.parameter = field.id;
          field.options.forEach(choice => { const option = document.createElement("option"); option.value = choice.value; option.textContent = choice.label; select.appendChild(option); });
          select.value = values[field.id]; select.addEventListener("change", () => { this.currentParameters[field.id] = select.value; this.markPresetInactive(); });
          label.append(title, select); container.appendChild(label);
        } else if (field.type === "boolean") {
          const label = document.createElement("label"); label.className = "boolean-field";
          const input = document.createElement("input"); input.type = "checkbox"; input.checked = Boolean(values[field.id]); input.dataset.parameter = field.id;
          input.addEventListener("change", () => { this.currentParameters[field.id] = input.checked; this.markPresetInactive(); });
          label.append(input, document.createTextNode(field.label)); container.appendChild(label);
        } else {
          const label = document.createElement("label");
          const title = document.createElement("span"); title.className = "field-label"; title.textContent = field.label + (field.unit ? " · " + field.unit : "");
          const input = document.createElement("input"); input.type = "number"; input.min = field.min; input.max = field.max; input.step = field.step; input.value = values[field.id]; input.dataset.parameter = field.id;
          input.addEventListener("input", () => { this.currentParameters[field.id] = input.value; this.markPresetInactive(); });
          label.append(title, input); container.appendChild(label);
        }
      }
    }

    collectParameters() {
      const values = {};
      this.currentEngine.parameterSchema.forEach(field => {
        const control = document.querySelector('[data-parameter="' + field.id + '"]');
        values[field.id] = field.type === "boolean" ? control.checked : control.value;
      });
      return values;
    }

    async savePreset() {
      const name = window.prompt("Name this local preset:", this.currentEngine.name + " Custom");
      if (!name || !name.trim()) return;
      const idMaterial = this.currentEngine.id + "\0" + name.trim() + "\0" + S.Core.stableStringify(S.Core.canonicalize(this.collectParameters()));
      const preset = {
        id: "user_" + S.Core.hashDomain("SPECTRAL/PRESET/v1", idMaterial).slice(0, 16),
        engineId: this.currentEngine.id,
        name: name.trim().slice(0, 60),
        subtitle: "Saved in this browser",
        params: this.collectParameters()
      };
      await S.Storage.Database.savePreset(preset);
      this.customPresets = await S.Storage.Database.listPresets();
      this.renderPresetBrowser();
      this.toast("Preset saved locally.", "success");
    }

    async loadSourceFile(file) {
      if (!file) return;
      try {
        element("source-summary").innerHTML = "<span>READING LOCAL SOURCE</span><small>" + escapeHtml(file.name) + "</small>";
        const source = await S.Core.Input.fromFile(file);
        S.state.currentSource = source;
        const summary = element("source-summary");
        summary.classList.add("loaded");
        summary.innerHTML = "<span>" + escapeHtml(source.kind.toUpperCase()) + " · " + source.size.toLocaleString() + " B</span><small title=\"" + source.hash + "\">" + escapeHtml(file.name) + " · " + shortHash(source.hash, 10) + "</small>";
        this.toast("Local source hashed. Nothing was uploaded.", "success");
      } catch (error) {
        this.clearSource();
        this.toast(error.message, "error", 6500);
      }
    }

    clearSource() {
      S.state.currentSource = null;
      element("source-file").value = "";
      element("source-summary").classList.remove("loaded");
      element("source-summary").innerHTML = "<span>NO EXTERNAL SOURCE</span><small>Engine seed data will be used.</small>";
    }

    usePastedSource() {
      const text = element("pasted-source").value;
      if (!text.trim()) { this.toast("Paste source text before using it.", "error"); return; }
      const first = text.trimStart()[0];
      const name = first === "{" || first === "[" ? "pasted-source.json" : text.includes(",") ? "pasted-source.csv" : "pasted-source.txt";
      let source;
      try { source = S.Core.Input.fromText(text, name); }
      catch (error) { this.toast("Pasted source is invalid: " + error.message, "error", 6500); return; }
      S.state.currentSource = source;
      const summary = element("source-summary");
      summary.classList.add("loaded");
      summary.innerHTML = "<span>PASTED " + escapeHtml(source.kind.toUpperCase()) + " · " + source.size.toLocaleString() + " B</span><small>" + shortHash(source.hash, 10) + "</small>";
      this.toast("Pasted data canonicalized locally.", "success");
    }

    setProgress(percent, label) {
      element("render-progress").hidden = false;
      element("render-progress-bar").style.width = percent + "%";
      element("render-progress-label").textContent = label;
    }

    async render() {
      if (this.rendering) return;
      if (this.currentEngine.requiresSourceKind && (!S.state.currentSource || S.state.currentSource.kind !== this.currentEngine.requiresSourceKind)) {
        this.toast(this.currentEngine.name + " requires a local " + this.currentEngine.requiresSourceKind + " source.", "error", 6000);
        return;
      }
      this.rendering = true;
      this.renderController = new AbortController();
      const button = element("render-button");
      button.disabled = true;
      element("cancel-render-button").hidden = false;
      try {
        this.setProgress(2, "Validating render request…");
        const job = await S.Provenance.render({
          engineId: this.currentEngine.id,
          mode: this.selectedMode(),
          seed: element("seed-input").value,
          mutationIndex: element("mutation-input").valueAsNumber,
          durationSeconds: element("duration-input").valueAsNumber,
          profileId: element("profile-select").value,
          parameters: this.collectParameters(),
          source: S.state.currentSource,
          priorJobs: S.state.jobs,
          signal: this.renderController.signal
        }, (percent, label) => this.setProgress(percent, label));
        job.localCreatedAt = new Date().toISOString();
        S.state.currentJob = job;
        this.showJob(job);
        try {
          await S.Storage.Database.saveJob(job);
          await this.refreshHistory();
          this.toast("Deterministic render sealed: " + shortHash(job.contractHash, 12), "success", 5000);
        } catch (storageError) {
          console.warn(storageError);
          this.toast("Render complete and downloadable, but local persistence failed: " + storageError.message, "error", 8500);
        }
      } catch (error) {
        if (error.name === "AbortError") this.toast("Render cancelled without producing a partial artifact.", "error", 5000);
        else { console.error(error); this.toast(error.message || "Render failed.", "error", 8000); }
      } finally {
        this.rendering = false;
        this.renderController = null;
        button.disabled = false;
        element("cancel-render-button").hidden = true;
        setTimeout(() => { element("render-progress").hidden = true; }, 900);
      }
    }

    async replayManifestFile(file) {
      if (!file || this.rendering) return;
      this.rendering = true;
      this.renderController = new AbortController();
      element("render-button").disabled = true;
      element("replay-manifest-button").disabled = true;
      element("cancel-render-button").hidden = false;
      try {
        this.setProgress(8, "Reading local manifest…");
        const text = await file.text();
        const manifest = JSON.parse(text);
        const source = manifest.recipe && manifest.recipe.source && manifest.recipe.source.present ? S.state.currentSource : null;
        if (manifest.recipe && manifest.recipe.source && manifest.recipe.source.present && !source) {
          throw new Error("This manifest requires its original source. Load that source first, then replay the manifest.");
        }
        this.setProgress(25, "Verifying source and engine version…");
        const job = await S.Provenance.replay(manifest, source, S.state.jobs, this.renderController.signal);
        job.localCreatedAt = new Date().toISOString();
        this.selectEngine(job.engineId, false);
        this.renderParameterControls(S.Engines.Registry.displayParameters(this.currentEngine, job.parameters));
        document.querySelector('input[name="determinism-mode"][value="' + job.mode + '"]').checked = true;
        this.setMode(job.mode, true);
        element("profile-select").value = job.profileId;
        element("seed-input").value = job.seed;
        element("mutation-input").value = job.mutationIndex;
        element("duration-input").value = job.durationSeconds;
        this.showJob(job);
        try {
          await S.Storage.Database.saveJob(job);
          await this.refreshHistory();
        } catch (storageError) {
          console.warn(storageError);
          this.toast("Replay verified and downloadable, but local persistence failed: " + storageError.message, "error", 8500);
        }
        this.setProgress(100, "Manifest replay verified.");
        this.toast("Replay verified: WAV and contract identities match the manifest.", "success", 6500);
      } catch (error) {
        if (error.name === "AbortError") this.toast("Manifest replay cancelled.", "error", 5000);
        else this.toast("Replay failed closed: " + (error.message || String(error)), "error", 8500);
      } finally {
        this.rendering = false;
        this.renderController = null;
        element("render-button").disabled = false;
        element("replay-manifest-button").disabled = false;
        element("cancel-render-button").hidden = true;
        element("replay-manifest-file").value = "";
        setTimeout(() => { element("render-progress").hidden = true; }, 1000);
      }
    }

    cancelRender() {
      if (this.renderController) this.renderController.abort();
    }

    showJob(job) {
      S.state.currentJob = job;
      const pcm = S.Audio.Wav.bytesToPcm(job.pcmBytes);
      this.waveform.setPcm(pcm, job.sampleRate, job.channels);
      this.spectrogram.setPcm(pcm, job.sampleRate, job.channels);
      element("waveform-empty").hidden = true;
      element("spectrogram-empty").hidden = true;
      this.updateSpectrogramOptions();
      this.loadAudio(job);
      element("current-render-name").textContent = job.name + " · " + job.profileName;
      element("lineage-source-name").textContent = job.name;
      element("lineage-source-hash").textContent = job.wavHash;
      this.derivativePending = null;
      element("derivative-name").textContent = "Choose local WAV / MP3 / audio file";
      element("derivative-hash").textContent = "Nothing is uploaded.";
      element("save-lineage").disabled = true;
      this.renderHashes(job);
      this.renderReadiness(job);
      this.renderMetrics(job);
      document.querySelectorAll("[data-artifact]").forEach(button => { button.disabled = false; });
      element("copy-hashes").disabled = false;
      this.refreshInspector();
    }

    loadAudio(job) {
      if (this.audioUrl) URL.revokeObjectURL(this.audioUrl);
      this.audioUrl = URL.createObjectURL(new Blob([job.wavBytes], { type: "audio/wav" }));
      const player = element("audio-player");
      player.src = this.audioUrl;
      player.load();
    }

    renderHashes(job) {
      const values = [job.pcmHash, job.wavHash, job.contractHash, job.fingerprintHash];
      document.querySelectorAll("#hash-list dd").forEach((node, index) => { node.textContent = values[index]; node.title = values[index]; });
    }

    renderReadiness(job) {
      const report = job.readiness;
      const badge = element("readiness-badge");
      badge.className = "readiness-badge " + report.recommendation;
      badge.textContent = report.recommendation.replaceAll("_", " ").toUpperCase();
      const list = element("readiness-checks");
      list.innerHTML = "";
      const labels = {
        deterministic_contract_complete: "Deterministic contract complete",
        generator_uses_third_party_samples: "Generator contains no third-party samples",
        no_external_network_used: "No external network used",
        pcm_clipping_absent: "PCM clipping absent",
        peak_level_within_pcm_range: "Peak within PCM range",
        dc_offset_within_advisory_limit: "DC offset within advisory limit",
        repeated_exact_chunks_absent: "No repeated exact chunks",
        provenance_bundle_complete: "Provenance bundle complete"
      };
      Object.entries(report.checks).forEach(([key, value]) => {
        const expected = key === "generator_uses_third_party_samples" || key === "local_catalog_exact_match" ? !value : value;
        const item = document.createElement("li");
        item.className = expected ? "" : "fail";
        item.innerHTML = "<span>" + (expected ? "✓" : "×") + "</span> " + escapeHtml(labels[key] || key);
        list.appendChild(item);
      });
      report.warnings.forEach(warning => {
        const item = document.createElement("li"); item.className = "fail"; item.innerHTML = "<span>!</span> " + escapeHtml(warning); list.appendChild(item);
      });
      if (job.catalogObservation) {
        const item = document.createElement("li");
        item.className = job.catalogObservation.exact_prior_wav_match ? "fail" : "";
        item.innerHTML = "<span>" + (job.catalogObservation.exact_prior_wav_match ? "=" : "✓") + "</span> " + (job.catalogObservation.exact_prior_wav_match
          ? "Exact local replay already cataloged (" + job.catalogObservation.exact_prior_match_count + ")"
          : "No exact prior WAV in local catalog");
        list.appendChild(item);
      }
    }

    renderMetrics(job) {
      const f = job.fingerprint.fingerprint;
      const duration = f.frame_count / f.sample_rate;
      const values = [f.peak_dbfs + " dBFS", f.rms_dbfs + " dBFS", f.dc_offset_ppm_fs + " ppm", (f.zero_crossing_rate_ppm / 10000).toFixed(2) + "%", (f.stereo_correlation_ppm / 1000000).toFixed(3), duration.toFixed(3) + " s"];
      document.querySelectorAll("#metric-grid strong").forEach((node, index) => { node.textContent = values[index]; });
    }

    refreshInspector() {
      const job = S.state.currentJob;
      if (!job) return;
      let value;
      if (this.currentInspectorTab === "contract") value = job.contract;
      else if (this.currentInspectorTab === "runtime") value = job.runtime;
      else value = job.manifest;
      element("inspector-content").textContent = S.Core.prettyStable(value);
    }

    updateSpectrogramOptions() {
      const fftSize = element("fft-size").value;
      const scale = element("frequency-scale").value;
      element("spectrogram-meta").textContent = "FFT " + fftSize + " · " + scale.toUpperCase() + " Hz";
      this.spectrogram.setOptions(fftSize, scale);
    }

    artifactData(job, type) {
      switch (type) {
        case "audio": return { name: "audio.wav", bytes: job.wavBytes, mime: "audio/wav" };
        case "manifest": return { name: "manifest.json", bytes: S.Provenance.outputBytes(job.manifest), mime: "application/json" };
        case "fingerprint": return { name: "fingerprint.json", bytes: S.Provenance.outputBytes(job.fingerprint), mime: "application/json" };
        case "readiness": return { name: "upload_readiness.json", bytes: S.Provenance.outputBytes(job.readiness), mime: "application/json" };
        case "derivation": return { name: "derivation_graph.json", bytes: S.Provenance.outputBytes(job.derivation), mime: "application/json" };
        case "origin": return { name: "README_ORIGIN.txt", bytes: S.Core.utf8(job.origin), mime: "text/plain;charset=utf-8" };
        case "bundle": return { name: job.id + "_provenance.zip", bytes: job.bundleBytes, mime: "application/zip" };
        default: throw new Error("Unknown artifact type");
      }
    }

    downloadArtifact(type) {
      const job = S.state.currentJob;
      if (!job) return;
      const artifact = this.artifactData(job, type);
      const url = URL.createObjectURL(new Blob([artifact.bytes], { type: artifact.mime }));
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = artifact.name; anchor.style.display = "none";
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async copyHashes() {
      const job = S.state.currentJob;
      if (!job) return;
      const text = ["PCM_SHA256=" + job.pcmHash,"WAV_SHA256=" + job.wavHash,"CONTRACT_SHA256=" + job.contractHash,"FINGERPRINT_SHA256=" + job.fingerprintHash].join("\n");
      try {
        if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
        else {
          const area = document.createElement("textarea"); area.value = text; area.style.position = "fixed"; area.style.opacity = "0"; document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove();
        }
        this.toast("Hashes copied.", "success");
      } catch (_) { this.toast("Clipboard permission was denied. Hashes remain visible in the panel.", "error"); }
    }

    assignAb(slot) {
      const job = S.state.currentJob;
      if (!job) return;
      S.state.ab[slot] = job;
      const button = element("play-" + slot.toLowerCase());
      button.disabled = false;
      button.querySelector("small").textContent = job.engineName;
      this.toast("Assigned current render to slot " + slot + ".", "success");
    }

    playAb(slot) {
      const job = S.state.ab[slot];
      if (!job) return;
      this.loadAudio(job);
      element("current-render-name").textContent = "A/B " + slot + " · " + job.name;
      element("audio-player").play().catch(() => this.toast("Press play in the transport to authorize audio.", "error"));
    }

    async refreshHistory() {
      S.state.jobs = await S.Storage.Database.listJobs();
      const body = element("history-body");
      element("history-count").textContent = S.state.jobs.length + (S.state.jobs.length === 1 ? " JOB" : " JOBS");
      if (!S.state.jobs.length) {
        body.innerHTML = '<tr class="empty-row"><td colspan="8">No local jobs have been rendered.</td></tr>';
        return;
      }
      body.innerHTML = S.state.jobs.map(job => '<tr><td><code>' + escapeHtml(job.id.slice(0, 24)) + '</code></td><td>' + escapeHtml(job.engineName) + '</td><td>' + escapeHtml(job.mode === S.MODES.CANONICAL_STRICT ? "STRICT" : "REPLAY") + '</td><td>' + escapeHtml(job.profileName) + '</td><td>' + job.durationSeconds + ' s</td><td><code title="' + job.wavHash + '">' + escapeHtml(shortHash(job.wavHash, 10)) + '</code></td><td>' + escapeHtml(new Date(job.localCreatedAt).toLocaleString()) + '</td><td><button class="history-load" type="button" data-load-job="' + escapeHtml(job.id) + '">LOAD</button></td></tr>').join("");
    }

    async loadHistoryJob(id) {
      const job = await S.Storage.Database.getJob(id);
      if (!job) { this.toast("That local job is no longer available.", "error"); return; }
      this.selectEngine(job.engineId, false);
      this.renderParameterControls(S.Engines.Registry.displayParameters(this.currentEngine, job.parameters));
      document.querySelector('input[name="determinism-mode"][value="' + job.mode + '"]').checked = true;
      this.setMode(job.mode, true);
      element("profile-select").value = job.profileId;
      element("seed-input").value = job.seed;
      element("mutation-input").value = job.mutationIndex;
      element("duration-input").value = job.durationSeconds;
      this.showJob(job);
      this.toast("Loaded persisted job " + shortHash(job.contractHash, 10) + ".", "success");
    }

    async clearHistory() {
      if (!S.state.jobs.length) return;
      if (!window.confirm("Delete all locally stored SPECTRAL jobs from this browser?")) return;
      await S.Storage.Database.clearJobs();
      S.state.jobs = [];
      await this.refreshHistory();
      this.toast("Local job history cleared.", "success");
    }

    async loadDerivative(file) {
      if (!file) return;
      if (!S.state.currentJob) { this.toast("Render or load a source seed first.", "error"); return; }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const hash = S.Core.sha256Hex(bytes);
      this.derivativePending = { file, bytes, hash };
      element("derivative-name").textContent = file.name + " · " + bytes.length.toLocaleString() + " B";
      element("derivative-hash").textContent = hash;
      element("save-lineage").disabled = false;
      this.toast("Derivative hashed locally. Audio was not uploaded.", "success");
    }

    async saveLineage() {
      const job = S.state.currentJob;
      if (!job || !this.derivativePending) return;
      const updated = S.Provenance.attachDerivative(job, this.derivativePending.file.name, this.derivativePending.bytes, element("relationship-select").value, element("lineage-notes").value);
      try {
        await S.Storage.Database.saveJob(job);
        await this.refreshHistory();
      } catch (storageError) {
        console.warn(storageError);
        this.toast("Lineage updated in the current downloadable job, but persistence failed: " + storageError.message, "error", 8500);
      }
      element("derivative-hash").textContent = updated.derivative.sha256 + " · SAVED";
      element("save-lineage").disabled = true;
      this.refreshInspector();
      this.toast("Derivative lineage saved into the local provenance graph.", "success", 5000);
    }

    toast(message, type, duration) {
      const toast = document.createElement("div");
      toast.className = "toast " + (type || "");
      toast.textContent = message;
      element("toast-region").appendChild(toast);
      setTimeout(() => toast.remove(), duration || 3600);
    }
  }

  S.UI.Workbench = Workbench;
})(window.SPECTRAL);
