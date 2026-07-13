# SPECTRAL E8 Geometry Studio Contributor Contract

This file governs all work under `E8/APP/`.

## Runtime boundary

The Studio must continue to work by double-clicking `index.html`.

Do not add:

- a server or localhost requirement;
- Python, Node, npm, a package manifest, or a lockfile;
- a build, bundle, compile, or transpile step;
- ES-module imports that fail under ordinary `file://` loading;
- a frontend framework;
- a CDN, external font, remote asset, or remote stylesheet;
- a network client, telemetry, cookies, or service worker;
- microphone, camera, account, or cloud-storage requirements.

Classic scripts attach APIs beneath `window.E8STUDIO` and load in the fixed order declared by `index.html`.

## Three identity domains

Keep these domains separate in recipes, contracts, manifests, UI labels, and replay behaviour:

1. `canonical_strict`
2. `replay_safe`
3. `creative_nondeterministic`

Never relabel a Creative take as Canonical or Replay-Safe.

### Canonical Deterministic

Identity-bearing strict code must:

- represent E8 roots through the doubled integer root ABI;
- preserve the reviewed root ordering: 112 integer-family, then 128 even-parity half-family roots;
- use safe-integer recipe values;
- use explicit fixed-point rounding, clipping, saturation, fades, and PCM quantization;
- use 32-bit phase accumulators and the shared strict oscillator ABI;
- keep fingerprint and trajectory receipts integer-defined;
- exclude runtime fingerprints, wall clocks, filenames, playback, Canvas, viewport, and UI state;
- bump an ABI/version when intentional PCM or artifact bytes change;
- update the frozen strict golden hash only after human review.

### Replay-Safe

Replay-Safe may use finite Float64 control/DSP operations and the versioned sine table. It must:

- use only seeded pseudo-random modulation;
- include the runtime fingerprint in recipe identity;
- fail manifest replay when the current runtime hash differs;
- never claim universal cross-runtime byte identity.

### Creative Non-Deterministic

Creative mode must:

- draw a fresh local entropy nonce for each render;
- record the entropy source and nonce hash;
- omit the raw nonce from exported artifacts;
- declare the WAV hash as the authoritative take identity;
- refuse exact manifest replay;
- allow recipe loading only as settings for a new take.

Do not silently make Creative mode reproducible by exporting its raw entropy.

## E8 and claim boundaries

The generated root registry must remain the complete 240-root E8 system. Musical paths, φ ladders, qutrit states, triality exchange, trinaural maps, Coxeter-like motion, and root walks are declared sonification choices unless a separate scientific method establishes more.

Do not describe outputs as:

- physical E8 measurements;
- proof of a cosmological or quantum claim;
- calibrated scientific observations;
- copyright-filter bypasses or detector evasion;
- ownership validation or upload guarantees.

## Performance boundary

Preserve the lean browser design:

- maximum 120-second render;
- 44.1 or 48 kHz PCM16 stereo only;
- 3–8 audio-rate oscillators;
- root projections at a bounded 100–500 Hz control rate;
- one primary mix buffer plus PCM finalization;
- bounded trajectory capture;
- cooperative frame-chunk yielding and cancellation;
- lazy ZIP assembly;
- Canvas 2D observation rather than an identity-bearing GPU path.

Increasing limits or retaining extra full-audio copies requires an explicit memory review.

## Hash dependency order

Preserve the acyclic pipeline:

```text
settings → recipe → PCM/WAV → fingerprint + trajectory → contract → manifest core → manifest envelope → optional ZIP
```

Never imply that an artifact contains an ordinary SHA-256 hash of all its own final bytes.

## Verification before handoff

1. Run `node --check` on all JavaScript files.
2. Open `tests/index.html` directly and require all tests to pass when a local browser is available.
3. Confirm the 112 + 128 root count, norm, parity, and uniqueness tests.
4. Render the frozen 250 ms strict vector and compare its reviewed WAV hash.
5. Repeat the same strict render and compare WAV, contract, manifest, and ZIP identities.
6. Confirm mutation changes actual PCM/WAV bytes.
7. Confirm Strict and Replay-Safe recipe/contract identities differ.
8. Confirm two Creative takes differ and omit the raw nonce.
9. Tamper with one manifest parameter and require rejection.
10. Replay an authentic strict manifest and require exact equality.
11. Scan for network clients, remote assets, module imports, package manifests, and build files.
12. Run `git diff --check`.

Do not automatically overwrite the frozen strict hash. Intentional byte changes require a version bump and review.
