(function defineProvenance(S) {
  "use strict";

  function abortIfRequested(signal) {
    if (signal && signal.aborted) {
      const error = new Error("Render cancelled");
      error.name = "AbortError";
      throw error;
    }
  }

  function yieldTask() {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  function integerSqrt(value) {
    if (value < 0n) throw new RangeError("Square root of a negative integer");
    if (value < 2n) return value;
    let x0 = 1n << (BigInt(value.toString(2).length) + 1n >> 1n);
    let x1 = (x0 + value / x0) >> 1n;
    while (x1 < x0) {
      x0 = x1;
      x1 = (x0 + value / x0) >> 1n;
    }
    return x0;
  }

  function fixedLog2Q16(integer) {
    if (integer <= 0) return -2147483648;
    const value = BigInt(integer);
    const exponent = value.toString(2).length - 1;
    let normalized = exponent <= 31 ? value << BigInt(31 - exponent) : value >> BigInt(exponent - 31);
    let fraction = 0;
    for (let bit = 15; bit >= 0; bit -= 1) {
      normalized = (normalized * normalized) >> 31n;
      if (normalized >= (2n << 31n)) {
        normalized >>= 1n;
        fraction |= 1 << bit;
      }
    }
    return exponent * 65536 + fraction;
  }

  function dbfsHundredths(amplitude) {
    if (amplitude <= 0) return -12000;
    const log2RatioQ16 = fixedLog2Q16(amplitude) - 15 * 65536;
    const numerator = BigInt(log2RatioQ16) * 20n * 19728n * 100n;
    const denominator = 65536n * 65536n;
    return Number(numerator / denominator);
  }

  function formatHundredths(value) {
    const sign = value < 0 ? "-" : "";
    const absolute = Math.abs(value);
    return sign + Math.floor(absolute / 100) + "." + String(absolute % 100).padStart(2, "0");
  }

  async function fingerprintCore(pcm, pcmBytes, wavHash, sampleRate, channels, signal) {
    let peak = 0;
    let sumSquares = 0n;
    let sum = 0n;
    let clipping = 0;
    let crossings = 0;
    let sumLR = 0n;
    let sumL2 = 0n;
    let sumR2 = 0n;
    let priorMono = 0;
    const frames = Math.floor(pcm.length / channels);
    const envelope = [];
    const envelopeBlock = 2048;
    let envelopeSquare = 0n;
    let envelopeCount = 0;

    for (let frame = 0; frame < frames; frame += 1) {
      const left = pcm[frame * channels];
      const right = channels > 1 ? pcm[frame * channels + 1] : left;
      const mono = Math.trunc((left + right) / 2);
      if (frame > 0 && ((priorMono < 0 && mono >= 0) || (priorMono >= 0 && mono < 0))) crossings += 1;
      priorMono = mono;
      sumLR += BigInt(left) * BigInt(right);
      sumL2 += BigInt(left) * BigInt(left);
      sumR2 += BigInt(right) * BigInt(right);
      for (let channel = 0; channel < channels; channel += 1) {
        const sample = pcm[frame * channels + channel];
        const absolute = Math.abs(sample);
        peak = Math.max(peak, absolute);
        if (absolute >= 32767) clipping += 1;
        sum += BigInt(sample);
        sumSquares += BigInt(sample) * BigInt(sample);
        envelopeSquare += BigInt(sample) * BigInt(sample);
        envelopeCount += 1;
      }
      if ((frame + 1) % envelopeBlock === 0 || frame === frames - 1) {
        envelope.push(Number(integerSqrt(envelopeSquare / BigInt(Math.max(1, envelopeCount)))));
        envelopeSquare = 0n;
        envelopeCount = 0;
      }
      if ((frame + 1) % 16384 === 0) { abortIfRequested(signal); await yieldTask(); }
    }

    const sampleCount = Math.max(1, pcm.length);
    const rms = Number(integerSqrt(sumSquares / BigInt(sampleCount)));
    const dcPpm = Number(sum * 1000000n / (BigInt(sampleCount) * 32768n));
    const zeroCrossPpm = frames > 1 ? Math.trunc(crossings * 1000000 / (frames - 1)) : 0;
    const correlationDenominator = integerSqrt(sumL2 * sumR2);
    const correlationPpm = correlationDenominator ? Number(sumLR * 1000000n / correlationDenominator) : 0;
    const chunkHashes = [];
    const chunkSize = 65536;
    for (let offset = 0; offset < pcmBytes.length; offset += chunkSize) {
      chunkHashes.push(S.Core.sha256Hex(pcmBytes.slice(offset, Math.min(pcmBytes.length, offset + chunkSize))));
      if ((offset / chunkSize + 1) % 16 === 0) { abortIfRequested(signal); await yieldTask(); }
    }
    abortIfRequested(signal);
    const repeated = new Set(chunkHashes).size !== chunkHashes.length;
    const envelopeHash = S.Core.hashCanonical("SPECTRAL/ENVELOPE/v1", envelope);

    return {
      schema: S.APP.fingerprintVersion,
      pcm_sha256: S.Core.sha256Hex(pcmBytes),
      wav_sha256: wavHash,
      sample_rate: sampleRate,
      channels,
      frame_count: frames,
      duration_samples: frames,
      peak_abs_i16: peak,
      peak_dbfs: formatHundredths(dbfsHundredths(peak)),
      rms_i16: rms,
      rms_dbfs: formatHundredths(dbfsHundredths(rms)),
      dc_offset_ppm_fs: dcPpm,
      zero_crossing_rate_ppm: zeroCrossPpm,
      stereo_correlation_ppm: correlationPpm,
      clipping_sample_count: clipping,
      exact_chunk_repeat_detected: repeated,
      chunk_size_bytes: chunkSize,
      chunk_sha256: chunkHashes,
      rms_envelope_sha256: envelopeHash
    };
  }

  function originText(recipe, hashes, engine) {
    return [
      "SPECTRAL DETERMINISTIC SONIFICATION — ORIGIN RECEIPT",
      "===================================================",
      "",
      "This audio file is an original deterministic data sonification generated by",
      "SPECTRAL Deterministic Sonification Workbench 2.0.",
      "",
      "The generator contains no third-party samples, loops, stems, melodies, or lyrics.",
      "User-provided source rights remain the user's responsibility.",
      "",
      "RENDER IDENTITY",
      "App version: " + S.APP.version,
      "Engine: " + engine.id + " @ " + engine.version,
      "Determinism mode: " + recipe.determinism_mode,
      "Seed: " + recipe.seed,
      "Mutation index: " + recipe.mutation_index,
      "Export profile: " + recipe.export_profile.id + " @ " + recipe.export_profile.version,
      "Source SHA-256: " + recipe.source.sha256,
      "Recipe SHA-256: " + hashes.recipe,
      "PCM SHA-256: " + hashes.pcm,
      "WAV SHA-256: " + hashes.wav,
      "Fingerprint SHA-256: " + hashes.fingerprint,
      "Contract SHA-256: " + hashes.contract,
      "",
      "CLAIM BOUNDARY",
      engine.claimBoundary || S.APP.claimBoundary,
      "",
      "ProvenanceGuard documents original generation and local uniqueness. It does not",
      "guarantee acceptance by any external platform.",
      ""
    ].join("\n");
  }

  function readinessReport(recipe, fingerprint, engine) {
    const clippingOk = fingerprint.clipping_sample_count === 0;
    const dcOk = Math.abs(fingerprint.dc_offset_ppm_fs) <= 1000;
    const peakOk = fingerprint.peak_abs_i16 < 32767;
    const repeatOk = !fingerprint.exact_chunk_repeat_detected;
    const sourceAdvisory = recipe.source.present;
    const profileAggressive = recipe.export_profile.id === "brutalist";
    const checks = {
      deterministic_contract_complete: true,
      generator_uses_third_party_samples: false,
      no_external_network_used: true,
      pcm_clipping_absent: clippingOk,
      peak_level_within_pcm_range: peakOk,
      dc_offset_within_advisory_limit: dcOk,
      repeated_exact_chunks_absent: repeatOk,
      provenance_bundle_complete: true
    };
    const warnings = [];
    if (!clippingOk) warnings.push("Full-scale clipping samples were detected.");
    if (!dcOk) warnings.push("DC offset exceeds the conservative local advisory limit.");
    if (!repeatOk) warnings.push("Repeated exact PCM chunks were detected; review intentional looping.");
    if (profileAggressive) warnings.push("Brutalist profile is intentionally aggressive and may be better suited to local/archive use.");
    if (sourceAdvisory) warnings.push("Confirm that you have the rights to use the selected local source material.");
    let recommendation = "ready";
    if (!clippingOk || !peakOk) recommendation = "archive_only";
    else if (!dcOk || !repeatOk || profileAggressive) recommendation = "revise";
    return {
      schema: "spectral-upload-readiness-v1",
      scope: "offline technical advisory",
      recommendation,
      checks,
      warnings,
      source_rights: "user_responsibility",
      local_catalog: "Observed separately in browser history; excluded from deterministic artifact identity.",
      guarantee: "No external-platform acceptance guarantee is made."
    };
  }

  function derivationGraph(jobId, wavHash, contractHash) {
    return {
      schema: "spectral-derivation-graph-v1",
      source_seed: {
        job_id: jobId,
        relationship: "deterministic_source_stem",
        wav_sha256: wavHash,
        contract_sha256: contractHash
      },
      derivatives: []
    };
  }

  function outputBytes(value) {
    return S.Core.utf8(S.Core.prettyStable(value));
  }

  function profileIdentity(profile) {
    return {
      id: profile.id,
      version: profile.version,
      sample_rate: profile.sampleRate,
      bit_depth: profile.bitDepth,
      channels: profile.channels,
      ceiling_q15: profile.ceilingQ15,
      peak_ceiling_dbfs: profile.peakCeilingDbfs,
      fade_in_ms: profile.fadeInMs,
      fade_out_ms: profile.fadeOutMs,
      remove_dc: profile.removeDc,
      normalize: profile.normalize
    };
  }

  async function render(request, onProgress) {
    const progress = typeof onProgress === "function" ? onProgress : function noop() {};
    const engine = S.Engines.Registry.get(request.engineId);
    const mode = request.mode;
    if (!engine.supportedModes.includes(mode)) throw new Error(engine.name + " does not support " + mode.replaceAll("_", " ") + ".");
    const mutation = Number(request.mutationIndex);
    if (!Number.isSafeInteger(mutation) || mutation < 0 || mutation > 4294967295) throw new RangeError("Mutation index must be an integer from 0 to 4294967295");
    const duration = Number(request.durationSeconds);
    if (!Number.isSafeInteger(duration) || duration < 1 || duration > 60) throw new RangeError("Duration must be a whole number from 1 to 60 seconds");
    const seed = String(request.seed || "").trim();
    if (!seed || seed.length > 128) throw new RangeError("Seed must contain 1 to 128 characters");
    const profile = S.EXPORT_PROFILES[request.profileId];
    if (!profile) throw new Error("Unknown export profile: " + request.profileId);
    const parameters = request.parametersAreNormalized
      ? S.Engines.Registry.validateNormalizedParameters(engine, request.parameters)
      : S.Engines.Registry.normalizeParameters(engine, request.parameters || {});
    const runtime = S.Core.runtimeFingerprint();
    const source = S.Core.Input.descriptor(request.source || null);

    progress(8, "Canonicalizing recipe…");
    const recipe = {
      schema: "spectral-render-recipe-v2",
      application: { name: S.APP.name, version: S.APP.version },
      canonical_json: S.APP.canonicalJsonVersion,
      dsp_abi: mode === S.MODES.CANONICAL_STRICT ? S.APP.dspAbi : S.APP.floatDspAbi,
      engine: { id: engine.id, version: engine.version },
      determinism_mode: mode,
      seed,
      mutation_index: mutation,
      duration_samples: duration * profile.sampleRate,
      parameters,
      export_profile: profileIdentity(profile),
      input_parser: S.APP.inputParserVersion,
      source,
      runtime_scope: mode === S.MODES.CANONICAL_STRICT ? "runtime_independent" : "same_runtime",
      runtime_fingerprint_sha256: mode === S.MODES.CANONICAL_STRICT ? "not_identity_bearing" : runtime.hash
    };
    const recipeHash = S.Core.hashCanonical("SPECTRAL/RECIPE/v2", recipe);
    const frameCount = recipe.duration_samples;
    const context = { mode, profile, frameCount, parameters, source: request.source || null, recipeHash, runtime, signal: request.signal || null };

    progress(20, "Compiling " + engine.name + "…");
    await new Promise(resolve => setTimeout(resolve, 0));
    const plan = engine.buildPlan(context);
    progress(32, mode === S.MODES.CANONICAL_STRICT ? "Rendering fixed-point PCM…" : "Rendering replay-safe PCM…");
    await new Promise(resolve => setTimeout(resolve, 0));
    const pcm = await S.Audio.DSP.renderTonePlan(plan, context);

    progress(58, "Writing canonical RIFF/WAV…");
    abortIfRequested(context.signal);
    const encoded = S.Audio.Wav.encodePcm16(pcm, profile.sampleRate, profile.channels);
    const pcmHash = S.Core.sha256Hex(encoded.pcmBytes);
    const wavHash = S.Core.sha256Hex(encoded.wavBytes);
    const webCryptoWavHash = await S.Core.webCryptoSha256Hex(encoded.wavBytes);
    if (webCryptoWavHash !== null && webCryptoWavHash !== wavHash) throw new Error("SHA-256 backend disagreement; render refused");

    progress(70, "Measuring local fingerprint…");
    await new Promise(resolve => setTimeout(resolve, 0));
    const fingerprint = await fingerprintCore(pcm, encoded.pcmBytes, wavHash, profile.sampleRate, profile.channels, context.signal);
    const fingerprintHash = S.Core.hashCanonical("SPECTRAL/FINGERPRINT/v2", fingerprint);

    const contractCore = {
      schema: S.APP.contractVersion,
      application_version: S.APP.version,
      engine: recipe.engine,
      determinism_mode: mode,
      backend: recipe.dsp_abi,
      claim_boundary: engine.claimBoundary || S.APP.claimBoundary,
      seed,
      mutation_index: mutation,
      parameters,
      source_hashes: [source.sha256],
      recipe_sha256: recipeHash,
      pcm_sha256: pcmHash,
      wav_sha256: wavHash,
      fingerprint_sha256: fingerprintHash,
      sample_rate: profile.sampleRate,
      channels: profile.channels,
      bit_depth: profile.bitDepth,
      frame_count: frameCount,
      wav_writer: S.APP.wavWriterVersion,
      prng: S.APP.prngVersion,
      replay_requirements: {
        engine_version: engine.version,
        source_sha256: source.sha256,
        runtime_fingerprint_sha256: recipe.runtime_fingerprint_sha256
      }
    };
    const contractHash = S.Core.hashCanonical("SPECTRAL/CONTRACT/v2", contractCore);
    const contract = Object.assign({}, contractCore, { contract_sha256: contractHash });
    const jobId = engine.id + "_" + contractHash.slice(0, 16);

    progress(82, "Assembling provenance artifacts…");
    const readiness = readinessReport(recipe, fingerprint, engine);
    const matchingPriorJobs = (request.priorJobs || []).filter(job => job && job.wavHash === wavHash);
    const catalogObservation = {
      scope: "local_non_identity_bearing_observation",
      exact_prior_wav_match: matchingPriorJobs.length > 0,
      exact_prior_match_count: matchingPriorJobs.length
    };
    const derivation = derivationGraph(jobId, wavHash, contractHash);
    const hashes = { recipe: recipeHash, pcm: pcmHash, wav: wavHash, fingerprint: fingerprintHash, contract: contractHash };
    const origin = originText(recipe, hashes, engine);
    const fingerprintDocument = {
      fingerprint,
      fingerprint_sha256: fingerprintHash,
      runtime_observation: mode === S.MODES.CANONICAL_STRICT
        ? { identity_bearing: false, scope: "canonical_strict_runtime_independent" }
        : runtime
    };
    const fingerprintBytes = outputBytes(fingerprintDocument);
    const readinessBytes = outputBytes(readiness);
    const derivationBytes = outputBytes(derivation);
    const originBytes = S.Core.utf8(origin);

    const manifestCore = {
      schema: "spectral-manifest-v2",
      recipe,
      recipe_sha256: recipeHash,
      contract,
      derivation_graph: derivation,
      artifacts: {
        audio_wav: { filename: "audio.wav", byte_length: encoded.wavBytes.length, sha256: wavHash },
        pcm_payload: { byte_length: encoded.pcmBytes.length, sha256: pcmHash },
        fingerprint_json: { filename: "fingerprint.json", sha256: S.Core.sha256Hex(fingerprintBytes) },
        upload_readiness_json: { filename: "upload_readiness.json", sha256: S.Core.sha256Hex(readinessBytes) },
        derivation_graph_json: { filename: "derivation_graph.json", sha256: S.Core.sha256Hex(derivationBytes) },
        readme_origin_txt: { filename: "README_ORIGIN.txt", sha256: S.Core.sha256Hex(originBytes) }
      }
    };
    const manifestCoreHash = S.Core.hashCanonical("SPECTRAL/MANIFEST-CORE/v2", manifestCore);
    const manifest = Object.assign({}, manifestCore, { manifest_core_sha256: manifestCoreHash });
    const manifestBytes = outputBytes(manifest);
    const bundle = S.Audio.Zip.create([
      { name: "README_ORIGIN.txt", bytes: originBytes },
      { name: "audio.wav", bytes: encoded.wavBytes },
      { name: "derivation_graph.json", bytes: derivationBytes },
      { name: "fingerprint.json", bytes: fingerprintBytes },
      { name: "manifest.json", bytes: manifestBytes },
      { name: "upload_readiness.json", bytes: readinessBytes }
    ]);

    progress(100, "Render contract sealed.");
    return {
      id: jobId,
      name: jobId,
      engineId: engine.id,
      engineName: engine.name,
      engineVersion: engine.version,
      mode,
      profileId: profile.id,
      profileName: profile.name,
      durationSeconds: duration,
      sampleRate: profile.sampleRate,
      channels: profile.channels,
      seed,
      mutationIndex: mutation,
      parameters,
      sourceDescriptor: source,
      recipe,
      recipeHash,
      contract,
      contractHash,
      fingerprint: fingerprintDocument,
      fingerprintHash,
      readiness,
      derivation,
      origin,
      manifest,
      manifestCoreHash,
      runtime,
      catalogObservation,
      pcmBytes: encoded.pcmBytes,
      wavBytes: encoded.wavBytes,
      bundleBytes: bundle,
      pcmHash,
      wavHash
    };
  }

  async function replay(manifest, source, priorJobs, signal) {
    if (!manifest || manifest.schema !== "spectral-manifest-v2") throw new Error("Unsupported manifest schema");
    const recipe = manifest.recipe;
    if (!recipe || recipe.schema !== "spectral-render-recipe-v2") throw new Error("Unsupported recipe schema");
    if (!manifest.contract || manifest.contract.schema !== S.APP.contractVersion) throw new Error("Unsupported contract schema");
    const recipeHash = S.Core.hashCanonical("SPECTRAL/RECIPE/v2", recipe);
    if (manifest.recipe_sha256 !== recipeHash || manifest.contract.recipe_sha256 !== recipeHash) throw new Error("Manifest recipe receipt mismatch");
    const contractCore = Object.assign(Object.create(null), manifest.contract);
    const statedContractHash = contractCore.contract_sha256;
    delete contractCore.contract_sha256;
    const computedContractHash = S.Core.hashCanonical("SPECTRAL/CONTRACT/v2", contractCore);
    if (statedContractHash !== computedContractHash) throw new Error("Manifest contract receipt mismatch");
    const manifestCore = Object.assign(Object.create(null), manifest);
    const statedManifestHash = manifestCore.manifest_core_sha256;
    delete manifestCore.manifest_core_sha256;
    const computedManifestHash = S.Core.hashCanonical("SPECTRAL/MANIFEST-CORE/v2", manifestCore);
    if (statedManifestHash !== computedManifestHash) throw new Error("Manifest-core receipt mismatch");
    if (recipe.application.version !== S.APP.version || recipe.engine.id !== manifest.contract.engine.id || recipe.engine.version !== manifest.contract.engine.version) throw new Error("Manifest engine/application cross-reference mismatch");
    if (recipe.determinism_mode !== manifest.contract.determinism_mode || recipe.seed !== manifest.contract.seed || recipe.mutation_index !== manifest.contract.mutation_index) throw new Error("Manifest recipe/contract identity mismatch");
    if (recipe.dsp_abi !== manifest.contract.backend || recipe.export_profile.sample_rate !== manifest.contract.sample_rate || recipe.export_profile.channels !== manifest.contract.channels || recipe.export_profile.bit_depth !== manifest.contract.bit_depth) throw new Error("Manifest backend/profile cross-reference mismatch");
    if (!manifest.derivation_graph || manifest.derivation_graph.schema !== "spectral-derivation-graph-v1") throw new Error("Manifest derivation graph is missing or unsupported");
    if (!manifest.artifacts || manifest.artifacts.audio_wav.sha256 !== manifest.contract.wav_sha256 || manifest.artifacts.pcm_payload.sha256 !== manifest.contract.pcm_sha256) throw new Error("Manifest artifact cross-reference mismatch");
    const engine = S.Engines.Registry.get(recipe.engine.id);
    if (engine.version !== recipe.engine.version) throw new Error("Exact engine version is unavailable");
    const descriptor = S.Core.Input.descriptor(source || null);
    if (descriptor.sha256 !== recipe.source.sha256) throw new Error("Replay source hash mismatch");
    const result = await render({
      engineId: engine.id,
      mode: recipe.determinism_mode,
      seed: recipe.seed,
      mutationIndex: recipe.mutation_index,
      durationSeconds: recipe.duration_samples / recipe.export_profile.sample_rate,
      profileId: recipe.export_profile.id,
      parameters: recipe.parameters,
      parametersAreNormalized: true,
      source: source || null,
      priorJobs: priorJobs || [],
      signal: signal || null
    });
    applyDerivationGraph(result, manifest.derivation_graph);
    if (result.recipeHash !== manifest.recipe_sha256) throw new Error("Replay recipe hash mismatch");
    if (result.contractHash !== manifest.contract.contract_sha256) throw new Error("Replay contract hash mismatch");
    if (result.wavHash !== manifest.contract.wav_sha256) throw new Error("Replay WAV hash mismatch");
    if (result.pcmHash !== manifest.contract.pcm_sha256 || result.fingerprintHash !== manifest.contract.fingerprint_sha256) throw new Error("Replay payload/fingerprint hash mismatch");
    if (result.manifestCoreHash !== manifest.manifest_core_sha256) throw new Error("Replay manifest-core hash mismatch");
    if (S.Core.stableStringify(result.manifest) !== S.Core.stableStringify(manifest)) throw new Error("Replay manifest artifact mismatch");
    return result;
  }

  function addDerivative(graph, fileName, bytes, relationship, notes) {
    const cleanGraph = S.Core.canonicalize(graph);
    const derivative = {
      relationship: String(relationship || "User arrangement / production"),
      filename: String(fileName || "derivative-audio"),
      byte_length: bytes.length,
      sha256: S.Core.sha256Hex(bytes),
      created_by_user: true,
      notes: String(notes || "")
    };
    const updated = {
      schema: cleanGraph.schema,
      source_seed: cleanGraph.source_seed,
      derivatives: cleanGraph.derivatives.concat([derivative])
    };
    return { graph: updated, derivative };
  }

  function attachDerivative(job, fileName, bytes, relationship, notes) {
    if (!job || !job.derivation || !job.manifest) throw new TypeError("A completed source job is required");
    const priorContractHash = job.contractHash;
    const priorManifestHash = job.manifestCoreHash;
    const updated = addDerivative(job.derivation, fileName, bytes, relationship, notes);
    applyDerivationGraph(job, updated.graph);
    if (job.contractHash !== priorContractHash) throw new Error("Derivative documentation attempted to mutate the seed contract");
    return { derivative: updated.derivative, priorManifestHash, manifestCoreHash: job.manifestCoreHash };
  }

  function applyDerivationGraph(job, graph) {
    if (!job || !job.manifest || !job.contractHash) throw new TypeError("A completed source job is required");
    const cleanGraph = S.Core.canonicalize(graph);
    if (cleanGraph.schema !== "spectral-derivation-graph-v1" || !cleanGraph.source_seed || !Array.isArray(cleanGraph.derivatives)) throw new TypeError("Invalid derivation graph schema");
    if (cleanGraph.source_seed.job_id !== job.id || cleanGraph.source_seed.wav_sha256 !== job.wavHash || cleanGraph.source_seed.contract_sha256 !== job.contractHash) throw new Error("Derivation graph source identity mismatch");
    job.derivation = cleanGraph;
    job.manifest.derivation_graph = cleanGraph;
    const derivationBytes = outputBytes(job.derivation);
    job.manifest.artifacts.derivation_graph_json.sha256 = S.Core.sha256Hex(derivationBytes);
    const manifestCore = Object.assign(Object.create(null), job.manifest);
    delete manifestCore.manifest_core_sha256;
    job.manifestCoreHash = S.Core.hashCanonical("SPECTRAL/MANIFEST-CORE/v2", manifestCore);
    job.manifest.manifest_core_sha256 = job.manifestCoreHash;
    job.bundleBytes = S.Audio.Zip.create([
      { name: "README_ORIGIN.txt", bytes: S.Core.utf8(job.origin) },
      { name: "audio.wav", bytes: job.wavBytes },
      { name: "derivation_graph.json", bytes: derivationBytes },
      { name: "fingerprint.json", bytes: outputBytes(job.fingerprint) },
      { name: "manifest.json", bytes: outputBytes(job.manifest) },
      { name: "upload_readiness.json", bytes: outputBytes(job.readiness) }
    ]);
    return job;
  }

  S.Provenance = Object.assign(S.Provenance, {
    render,
    replay,
    addDerivative,
    attachDerivative,
    applyDerivationGraph,
    fingerprintCore,
    outputBytes,
    dbfsHundredths,
    formatHundredths
  });
})(window.SPECTRAL);
