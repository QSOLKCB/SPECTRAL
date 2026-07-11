(function bootstrapNamespace(global) {
  "use strict";

  const APP = {
    name: "SPECTRAL Deterministic Sonification Workbench",
    version: "2.0.0",
    contractVersion: "spectral-contract-v2",
    canonicalJsonVersion: "spectral-cjson-v1",
    dspAbi: "spectral-fixed-pcm16-v1",
    floatDspAbi: "spectral-float64-v1",
    wavWriterVersion: "spectral-riff-pcm16-v1",
    prngVersion: "spectral-xoshiro128ss-v1",
    inputParserVersion: "spectral-input-v1",
    fingerprintVersion: "spectral-audio-fingerprint-v1",
    databaseVersion: 2,
    claimBoundary: "creative symbolic metadata only; not biomedical, archaeological, or scientific proof"
  };

  const MODES = Object.freeze({
    CANONICAL_STRICT: "canonical_strict",
    REPLAY_SAFE: "replay_safe"
  });

  const EXPORT_PROFILES = Object.freeze({
    archive: Object.freeze({
      id: "archive",
      name: "Archive",
      version: "1.0.0",
      sampleRate: 44100,
      bitDepth: 16,
      channels: 2,
      ceilingQ15: 30247,
      peakCeilingDbfs: "-0.70",
      fadeInMs: 10,
      fadeOutMs: 30,
      removeDc: true,
      normalize: true
    }),
    suno_seed: Object.freeze({
      id: "suno_seed",
      name: "Suno Seed Export",
      version: "1.0.0",
      sampleRate: 48000,
      bitDepth: 16,
      channels: 2,
      ceilingQ15: 16422,
      peakCeilingDbfs: "-6.00",
      fadeInMs: 10,
      fadeOutMs: 50,
      removeDc: true,
      normalize: true
    }),
    brutalist: Object.freeze({
      id: "brutalist",
      name: "Brutalist",
      version: "1.0.0",
      sampleRate: 44100,
      bitDepth: 16,
      channels: 2,
      ceilingQ15: 32392,
      peakCeilingDbfs: "-0.10",
      fadeInMs: 2,
      fadeOutMs: 8,
      removeDc: false,
      normalize: false
    })
  });

  global.SPECTRAL = {
    APP: Object.freeze(APP),
    MODES: MODES,
    EXPORT_PROFILES: EXPORT_PROFILES,
    Core: {},
    Audio: {},
    Engines: {},
    Provenance: {},
    Storage: {},
    UI: {},
    state: {
      currentSource: null,
      currentJob: null,
      jobs: [],
      ab: { A: null, B: null }
    }
  };
})(window);
