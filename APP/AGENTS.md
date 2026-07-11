# SPECTRAL APP Contributor Contract

This file governs all work under `APP/`.

## Runtime boundary

The application must continue to open by double-clicking `index.html`.

Do not add:

- a server or localhost requirement
- Python, Node, npm, a package manifest, or lockfile
- a build, bundle, compile, or transpile step
- ES-module imports that fail under ordinary `file://` loading
- a frontend framework
- a CDN, external font, remote image, or remote stylesheet
- a network client, analytics, telemetry, cookies, or service worker
- nondeterministic entropy, wall-clock input, or hidden engine state

Classic scripts may be split further, but they must attach APIs beneath `window.SPECTRAL` and load in a fixed dependency order.

## Identity boundary

The generated PCM payload and canonical WAV bytes define the audio identity. WebAudio, Canvas, UI state, viewport size, playback volume, FFT display, IndexedDB order, and browser timestamps must not feed a render.

The determinism mode is mandatory in the recipe and contract preimages.

Canonical Strict code must:

- keep identity-bearing parameter values as integers, booleans, or strings
- use the shared decimal normalizer instead of first passing decimal controls through a floating-point conversion
- use explicit fixed-point operations, rounding, saturation, and clipping
- use 32-bit phase accumulators and the shared DSP ABI
- encode PCM bytes and RIFF fields explicitly as little-endian
- use the shared canonical JSON and SHA-256 functions
- exclude wall clocks, filenames, paths, MIME guesses, locales, and runtime fingerprints
- bump the relevant engine/ABI/writer version when intentional output bytes change
- add or update reviewed golden vectors for every intentional strict-output change

Replay Safe code may use finite floating-point DSP. It still must not use nondeterministic entropy or external state, and its runtime fingerprint must remain in the recipe.

Do not force PCM hashes to differ between modes by salting content hashes. PCM/WAV hashes must remain honest hashes of bytes. Mode separation belongs in the recipe and contract identities.

## Hash dependency order

Preserve the acyclic sequence:

```text
source → recipe → PCM/WAV → fingerprint → contract → derived artifacts → manifest
```

If a document displays a self-receipt, define and name the exact core object that is hashed before the receipt field is added. Never imply that a file can contain an ordinary SHA-256 hash of all its own bytes.

## Engine rules

Every engine declares:

- `id`
- `name`
- `version`
- description and claim boundary
- supported determinism modes
- default export profile
- parameter schema
- built-in presets
- a pure tone-plan compiler

Engine registration must be additive through `js/engines/registry.js`.

Do not label native Canvas decoding of JPEG, WEBP, color-managed PNG, browser-resampled pixels, platform fonts, WebAudio output, GPU shaders, or another runtime-dependent source as Canonical Strict without a separately specified canonical implementation and cross-runtime golden vectors.

## Provenance safety boundary

ProvenanceGuard supports authorship documentation, reproducibility, exact local replay checks, and conservative technical-readiness observations for user-owned original material.

Do not describe it as:

- a copyright-filter bypass
- detector evasion
- ownership or copyright validation
- legal advice
- a guarantee of acceptance by Suno, YouTube, Spotify, or another platform

Keep symbolic biological, archaeological, cosmological, and quantum terms inside their explicit creative claim boundary.

## Storage

Identity-bearing artifacts must remain deterministic regardless of IndexedDB contents. Local creation time is history metadata only. Always handle IndexedDB rejection under `file://` visibly and without breaking rendering.

Do not silently discard persistent WAV bytes while claiming that refresh preserves jobs. If a quota error prevents storage, surface it to the user.

## Verification before handoff

1. Open `tests/index.html` directly from disk.
2. Require all applicable tests to pass.
3. Render the same strict recipe before and after another render and compare every identity hash.
4. Verify mutation changes actual PCM/WAV bytes and identities.
5. Verify changing mode changes recipe/contract identities.
6. Export `audio.wav` and compare its browser hash with an independent SHA-256 tool.
7. Replay a manifest with the correct source and require exact equality.
8. Change one source byte and require replay to fail closed.
9. Refresh the same page and reload a persisted job.
10. Inspect browser network activity while offline; no application request is permitted.
11. Run static scans for network clients, remote assets, module imports, package manifests, and build-tool files.

Do not automatically overwrite golden hashes. An intentional change to canonical bytes requires a version bump and human review.
