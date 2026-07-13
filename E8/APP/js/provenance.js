(function defineE8StudioProvenance(S) {
  "use strict";

  const DOMAIN = "SPECTRAL/E8-STUDIO";

  function cloneProfile(profile) {
    return {
      id: profile.id,
      name: profile.name,
      version: profile.version,
      sample_rate: profile.sample_rate,
      channels: profile.channels,
      bit_depth: profile.bit_depth,
      ceiling_q15: profile.ceiling_q15,
      ceiling_dbfs: profile.ceiling_dbfs,
      fade_in_ms: profile.fade_in_ms,
      fade_out_ms: profile.fade_out_ms,
      remove_dc: profile.remove_dc,
      normalize: profile.normalize
    };
  }

  function modeDomain(mode, leaf) {
    const meta = S.MODE_META[mode];
    if (!meta) throw new RangeError("Unknown mode domain");
    return meta.domain + "/" + leaf;
  }

  function buildRecipe(paramsInput, profileId, mode, creativeEntropy) {
    const params = S.Core.validateParams(paramsInput);
    const profileSource = S.EXPORT_PROFILES[profileId];
    if (!profileSource) throw new RangeError("Unknown export profile");
    if (!S.MODE_META[mode]) throw new RangeError("Unknown determinism mode");
    const runtime = mode === S.MODES.STRICT ? null : S.Core.runtimeFingerprint();
    const recipe = {
      schema: S.APP.recipeSchema,
      app: { id: S.APP.id, version: S.APP.version },
      engine: {
        id: "e8_root_torus_studio",
        version: "1.0.0",
        root_system: S.APP.rootSystem,
        backend: mode === S.MODES.STRICT ? S.APP.strictAbi : mode === S.MODES.REPLAY ? S.APP.replayAbi : S.APP.creativeAbi
      },
      mode,
      mode_family: S.MODE_META[mode].short,
      parameters: params,
      export_profile: cloneProfile(profileSource),
      runtime: runtime ? runtime.core : null,
      runtime_sha256: runtime ? runtime.hash : null,
      creative_entropy: mode === S.MODES.CREATIVE ? {
        source: creativeEntropy.source,
        nonce_sha256: S.Core.sha256Hex(S.Core.fromHex(creativeEntropy.hex)),
        nonce_exported: false
      } : null
    };
    const recipeSha256 = S.Core.hashCanonical(modeDomain(mode, "RECIPE/v1"), recipe);
    return { params, profile: cloneProfile(profileSource), mode, recipe, recipeSha256, runtime, creativeEntropy };
  }

  function buildReadiness(profile, metrics, mode) {
    const observations = [];
    function add(id, level, message) { observations.push({ id, level, message }); }
    if (metrics.clipping_frame_count > 0) add("clipping", "warn", metrics.clipping_frame_count + " frames reached the PCM ceiling.");
    else add("clipping", "pass", "No PCM clipping frames were observed.");
    if (Math.abs(metrics.dc_left_ppm) > 2500 || Math.abs(metrics.dc_right_ppm) > 2500) add("dc", "warn", "A strong DC component remains in at least one channel.");
    else add("dc", "pass", "DC offset is within the conservative local threshold.");
    if (metrics.rms_dbfs_milli < -42000) add("level", "note", "The render is quiet and may need gain in a DAW.");
    else add("level", "pass", "RMS level is usable as a source stem.");
    if (profile.id === "daw_headroom") add("headroom", "pass", "The DAW Headroom profile preserves approximately 6 dB of peak space.");
    else add("headroom", "note", "This profile is louder than the dedicated DAW Headroom profile.");
    if (mode === S.MODES.CREATIVE) add("identity", "note", "This is an archived creative take, not a same-settings replay promise.");
    else add("identity", "pass", "The render includes a mode-scoped recipe and observation contract.");
    return {
      schema: "spectral-e8-readiness-v1",
      advisory_only: true,
      external_platform_queried: false,
      legal_or_ownership_validation: false,
      observations
    };
  }

  function trajectoryDocument(recipeSha256, trajectory, engineObservations) {
    return {
      schema: "spectral-e8-trajectory-v1",
      recipe_sha256: recipeSha256,
      coordinate_unit: "microturns modulo 1000000",
      root_system: S.APP.rootSystem,
      root_count: 240,
      points: trajectory,
      final_state: engineObservations.final_theta_microturns
    };
  }

  function trajectoryCsv(trajectory) {
    const rows = ["control_index,theta_1_microturns,theta_2_microturns,theta_3_microturns,theta_4_microturns,theta_5_microturns,theta_6_microturns,theta_7_microturns,theta_8_microturns"];
    for (const point of trajectory) rows.push([point.control_index, ...point.theta_microturns].join(","));
    return rows.join("\n") + "\n";
  }

  function originText(recipeBundle, identities) {
    const reproducibility = recipeBundle.mode === S.MODES.STRICT
      ? "Canonical Deterministic: byte identity is scoped to the versioned integer ABI."
      : recipeBundle.mode === S.MODES.REPLAY
        ? "Replay-Safe: exact replay is scoped to the recorded browser/runtime fingerprint."
        : "Creative Non-Deterministic: this WAV is the authoritative take; the entropy nonce is not exported and same settings intentionally create a new take.";
    return [
      "SPECTRAL E8 GEOMETRY STUDIO 1.0",
      "================================",
      "",
      reproducibility,
      "",
      "The audio was synthesized locally from the 240 roots of E8, an evolving 8D Cartan-torus state, and the declared musical mapping in e8_recipe.json.",
      "No samples, remote services, network requests, wall-clock metadata, or hidden source files are embedded in the WAV.",
      "",
      "Recipe SHA-256: " + identities.recipe_sha256,
      "PCM SHA-256:    " + identities.pcm_sha256,
      "WAV SHA-256:    " + identities.wav_sha256,
      "Contract SHA-256: " + identities.contract_sha256,
      "",
      S.APP.claimBoundary,
      "",
      "Copyright 2026 Trent Slade / QSOL-IMC. MIT License.",
      ""
    ].join("\n");
  }

  function makeFilename(recipeBundle) {
    const mode = recipeBundle.mode === S.MODES.STRICT ? "canonical" : recipeBundle.mode === S.MODES.REPLAY ? "replay" : "creative";
    const path = recipeBundle.params.path.replace(/_/g, "-");
    return "spectral-e8-" + path + "-" + mode + "-" + Math.round(recipeBundle.params.duration_ms / 1000) + "s";
  }

  async function renderJob(paramsInput, profileId, mode, options) {
    const settings = options || {};
    const creativeEntropy = mode === S.MODES.CREATIVE ? S.Core.creativeEntropy() : null;
    const recipeBundle = buildRecipe(paramsInput, profileId, mode, creativeEntropy);
    const render = await S.Engine.render(
      recipeBundle.params,
      recipeBundle.profile,
      mode,
      recipeBundle.recipeSha256,
      creativeEntropy,
      { signal: settings.signal, progress: settings.progress }
    );
    const pcm = await S.Audio.finalize(
      render.buffer,
      render.frameCount,
      recipeBundle.profile,
      mode,
      { signal: settings.signal, progress: settings.progress }
    );
    S.Audio.abortIfRequested(settings.signal);
    const encoded = S.Audio.encodePcm16(pcm, recipeBundle.profile.sample_rate, 2);
    const pcmSha256 = S.Core.sha256Hex(encoded.pcmBytes);
    const wavSha256 = S.Core.sha256Hex(encoded.wavBytes);
    const metrics = S.Audio.analyzePcm(pcm, recipeBundle.profile.sample_rate);
    const fingerprintCore = {
      schema: "spectral-e8-audio-fingerprint-v1",
      recipe_sha256: recipeBundle.recipeSha256,
      pcm_sha256: pcmSha256,
      wav_sha256: wavSha256,
      sample_rate: recipeBundle.profile.sample_rate,
      channels: 2,
      bit_depth: 16,
      metrics
    };
    const fingerprintSha256 = S.Core.hashCanonical(modeDomain(mode, "FINGERPRINT/v1"), fingerprintCore);
    const trajectory = trajectoryDocument(recipeBundle.recipeSha256, render.trajectory, render.engine_observations);
    const trajectorySha256 = S.Core.hashCanonical(modeDomain(mode, "TRAJECTORY/v1"), trajectory);
    const replayRequirements = mode === S.MODES.STRICT
      ? { scope: "versioned-cross-runtime-integer-abi", runtime_match_required: false, exact_manifest_replay_supported: true }
      : mode === S.MODES.REPLAY
        ? { scope: "same-recorded-runtime", runtime_match_required: true, exact_manifest_replay_supported: true }
        : { scope: "archived-audio-take-only", runtime_match_required: false, exact_manifest_replay_supported: false };
    const contractCore = {
      schema: "spectral-e8-observation-contract-v1",
      recipe_sha256: recipeBundle.recipeSha256,
      pcm_sha256: pcmSha256,
      wav_sha256: wavSha256,
      fingerprint_sha256: fingerprintSha256,
      trajectory_sha256: trajectorySha256,
      mode,
      backend: recipeBundle.recipe.engine.backend,
      replay_requirements: replayRequirements,
      audio_format: {
        container: "RIFF/WAVE",
        encoding: "signed PCM little-endian",
        bit_depth: 16,
        channels: 2,
        sample_rate: recipeBundle.profile.sample_rate,
        frame_count: render.frameCount
      },
      claim_boundary: S.APP.claimBoundary
    };
    const contractSha256 = S.Core.hashCanonical(modeDomain(mode, "CONTRACT/v1"), contractCore);
    const readiness = buildReadiness(recipeBundle.profile, metrics, mode);
    const readinessSha256 = S.Core.hashCanonical(modeDomain(mode, "READINESS/v1"), readiness);
    const identities = {
      recipe_sha256: recipeBundle.recipeSha256,
      pcm_sha256: pcmSha256,
      wav_sha256: wavSha256,
      fingerprint_sha256: fingerprintSha256,
      trajectory_sha256: trajectorySha256,
      contract_sha256: contractSha256,
      readiness_sha256: readinessSha256
    };
    const manifestCore = {
      schema: S.APP.schema,
      app: { id: S.APP.id, name: S.APP.name, version: S.APP.version },
      recipe: recipeBundle.recipe,
      identities,
      contract: contractCore,
      fingerprint: fingerprintCore,
      trajectory,
      readiness,
      engine_observations: render.engine_observations
    };
    const manifestCoreSha256 = S.Core.hashCanonical(modeDomain(mode, "MANIFEST-CORE/v1"), manifestCore);
    const manifest = { ...manifestCore, manifest_core_sha256: manifestCoreSha256 };
    const origin = originText(recipeBundle, { ...identities, contract_sha256: contractSha256 });
    const filename = makeFilename(recipeBundle);
    const artifacts = {
      "audio.wav": encoded.wavBytes,
      "e8_recipe.json": S.Core.utf8(S.Core.prettyStable(recipeBundle.recipe)),
      "fingerprint.json": S.Core.utf8(S.Core.prettyStable({ ...fingerprintCore, fingerprint_sha256: fingerprintSha256 })),
      "manifest.json": S.Core.utf8(S.Core.prettyStable(manifest)),
      "observation_contract.json": S.Core.utf8(S.Core.prettyStable({ ...contractCore, contract_sha256: contractSha256 })),
      "root_trajectory.csv": S.Core.utf8(trajectoryCsv(render.trajectory)),
      "root_trajectory.json": S.Core.utf8(S.Core.prettyStable({ ...trajectory, trajectory_sha256: trajectorySha256 })),
      "upload_readiness.json": S.Core.utf8(S.Core.prettyStable({ ...readiness, readiness_sha256: readinessSha256 })),
      "README_ORIGIN.txt": S.Core.utf8(origin)
    };
    let zipCache = null;
    return {
      filename,
      mode,
      params: recipeBundle.params,
      profile: recipeBundle.profile,
      recipe: recipeBundle.recipe,
      recipeSha256: recipeBundle.recipeSha256,
      pcm,
      pcmBytes: encoded.pcmBytes,
      wavBytes: encoded.wavBytes,
      metrics,
      trajectory: render.trajectory,
      contract: contractCore,
      contractSha256,
      manifest,
      manifestCoreSha256,
      identities,
      readiness,
      artifacts,
      getZip() {
        if (!zipCache) zipCache = S.Audio.createZip(Object.keys(artifacts).map(name => ({ name, bytes: artifacts[name] })));
        return zipCache;
      }
    };
  }

  function authenticateManifest(manifest) {
    if (!manifest || manifest.schema !== S.APP.schema) throw new Error("Unsupported E8 Studio manifest schema");
    if (!manifest.recipe || manifest.recipe.schema !== S.APP.recipeSchema) throw new Error("Manifest recipe is missing or unsupported");
    const mode = manifest.recipe.mode;
    if (!S.MODE_META[mode]) throw new Error("Manifest mode is unsupported");
    const expectedRecipe = S.Core.hashCanonical(modeDomain(mode, "RECIPE/v1"), manifest.recipe);
    if (expectedRecipe !== manifest.identities.recipe_sha256) throw new Error("Recipe hash authentication failed");
    const core = { ...manifest };
    delete core.manifest_core_sha256;
    const expectedCore = S.Core.hashCanonical(modeDomain(mode, "MANIFEST-CORE/v1"), core);
    if (expectedCore !== manifest.manifest_core_sha256) throw new Error("Manifest-core authentication failed");
    const expectedContract = S.Core.hashCanonical(modeDomain(mode, "CONTRACT/v1"), manifest.contract);
    if (expectedContract !== manifest.identities.contract_sha256) throw new Error("Contract authentication failed");
    return true;
  }

  async function replayManifest(manifest, options) {
    authenticateManifest(manifest);
    const mode = manifest.recipe.mode;
    if (mode === S.MODES.CREATIVE) throw new Error("Creative manifests archive a take but intentionally omit the entropy nonce; clone the settings instead of claiming exact replay.");
    if (manifest.recipe.app.version !== S.APP.version) throw new Error("The manifest requires E8 Studio " + manifest.recipe.app.version);
    if (mode === S.MODES.REPLAY) {
      const runtime = S.Core.runtimeFingerprint();
      if (runtime.hash !== manifest.recipe.runtime_sha256) throw new Error("Replay-Safe runtime fingerprint mismatch");
    }
    const job = await renderJob(manifest.recipe.parameters, manifest.recipe.export_profile.id, mode, options || {});
    if (job.identities.wav_sha256 !== manifest.identities.wav_sha256) throw new Error("WAV replay hash mismatch");
    if (job.identities.contract_sha256 !== manifest.identities.contract_sha256) throw new Error("Contract replay hash mismatch");
    if (job.manifestCoreSha256 !== manifest.manifest_core_sha256) throw new Error("Manifest replay hash mismatch");
    return job;
  }

  function recipeSettings(recipe) {
    if (!recipe || recipe.schema !== S.APP.recipeSchema) throw new Error("Unsupported E8 Studio recipe");
    if (recipe.app.version !== S.APP.version) throw new Error("The recipe requires E8 Studio " + recipe.app.version);
    return {
      params: S.Core.validateParams(recipe.parameters),
      profileId: recipe.export_profile.id,
      mode: recipe.mode
    };
  }

  S.Provenance = Object.freeze({
    buildRecipe, renderJob, authenticateManifest, replayManifest, recipeSettings,
    trajectoryCsv, modeDomain
  });
})(window.E8STUDIO);
