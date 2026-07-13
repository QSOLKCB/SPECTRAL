# SPECTRAL QEC Sonification Laboratory 1.0

**A zero-install, browser-native laboratory for hearing deterministic quantum-error-correction models and event datasets.**

Open index.html directly in a modern browser. No server, Node, npm, build step, account, cloud service, or network connection is required.

## Core idea

    configure or load dataset
            ↓
    event outcomes remain observation-dark
            ↓
    render deterministic PCM + WAV
            ↓
    hash WAV, event stream, and recipe
            ↓
    bind observation receipt
            ↓
    reveal errors, syndromes, corrections, residuals, visuals, and hashes

Changing any render-identity control invalidates the receipt and immediately returns the laboratory to its dark state.

This is an epistemic software workflow inspired by observation-dark modes. It is not a claim that browser rendering performs quantum measurement or wavefunction collapse.

## Quick start

1. Download this directory.
2. Open index.html.
3. Select a state, code, channel, decoder, and sonic texture.
4. Optionally load a local QEC CSV, TSV, or JSON event dataset. Or you can use this file: qec_data_prepared.csv
5. Select **Render WAV + Observe**.
6. Audition the render or export the bound artifacts.

Run tests/index.html to execute the browser-native contract suite.

## Included state signatures

- |0⟩, |1⟩, and |+⟩
- Bell Φ+, Φ−, Ψ+, and Ψ−
- three-qubit GHZ and W signatures
- qutrit Fourier phase-lane signature

State signatures set the sustained tonal centre and the post-render amplitude constellation.

## Included QEC models

| Model | Parameters | Purpose |
|---|---:|---|
| Bell parity observer | 2-body | Hear parity changes in Bell-state experiments |
| GHZ parity observer | 3-body | Pair-parity and global-phase checks |
| Bit-flip repetition | [[3,1,3]] projection | Single-X recovery |
| Phase-flip repetition | [[3,1,3]] projection | Single-Z recovery |
| Perfect code | [[5,1,3]] | Cyclic stabilizer lookup |
| Steane code | [[7,1,3]] | Paired CSS X/Z checks |
| Surface CSS projection | 3×3, distance-3 projection | Planar syndrome-flow experiments |
| Sparse QLDPC projection | 12-node Tanner model | Sparse iterative decoding |
| Qutrit shift code | 3-qutrit projection | Modulo-three recovery |

The larger-code implementations are compact deterministic classical projections intended for sonification and workflow experiments. They are not hardware-calibrated simulators.

## Error channels and decoders

Channels:

- bit-flip X
- phase-flip Z
- depolarizing X/Y/Z
- biased X/Z
- correlated burst
- erasure projection
- qutrit shift

Decoder projections:

- minimum-weight single-site lookup followed by greedy descent
- iterative syndrome descent
- observe-only mode
- modulo-three lookup

## Audible mapping

| QEC quantity | Mapping |
|---|---|
| Selected state | Sustained root, fifth, and octave signature |
| Error type | Pitch offset and oscillator colour |
| Qubit / qutrit site | Stereo location and pitch index |
| Syndrome weight | Upper-register check pulse |
| Decoder correction | Resolving glass transient |
| Residual error | Dark semitone-offset tone |
| Cycle index | Deterministic event time |
| Tempo | Event-gate duration |

Sonic textures:

- **Harmonic Glass**
- **MOS 6581 Lattice**
- **Industrial Pauli Frame**
- **Dark Subspace**

The resulting WAV is deliberately useful as both an analytical listening artifact and a source stem for music production.

## Local dataset schema

CSV and TSV files use a header row. JSON may be an array or an object containing an events array.

Canonical columns:

    cycle,qubit,error,syndrome,correction,residual

Aliases accepted by the parser:

- round → cycle
- site or node → qubit
- pauli → error
- checks → syndrome
- recovery → correction
- post_error → residual

Example:

    cycle,qubit,error,syndrome,correction,residual
    0,1,X,11,X,I
    1,-1,I,00,I,I
    2,0,Z,101000,Z,I

Dataset contents are not displayed before the render finishes. The pre-render source panel exposes only the local filename, normalized row count, and byte hash.

## Determinism modes

### Canonical Strict

- fixed 44.1 kHz stereo 16-bit PCM
- seeded integer event generation
- deterministic integer phase accumulators and envelopes
- canonical JSON key ordering
- SHA-256 identities
- fixed-metadata store-only ZIP bundles

### Replay Safe

Uses the same deterministic renderer while explicitly labelling the recipe as runtime-bound. This mode is useful when a downstream derivative records browser/runtime context separately.

Neither mode uses Math.random, wall-clock time, network data, or hidden external state.

## Exported artifacts

Every observed render can export:

- stereo PCM WAV
- provenance manifest
- canonical render recipe
- normalized QEC event CSV
- observation receipt
- deterministic ZIP laboratory bundle

The manifest binds:

- application and engine version
- observation protocol
- normalized settings
- source-dataset identity
- WAV SHA-256
- event-stream SHA-256
- recipe SHA-256
- observation-receipt SHA-256
- decoder summary
- scientific claim boundary
- manifest integrity hash

Manifest tampering fails authentication. Replaying a dataset-bound manifest requires the exact source identity.

## Privacy and offline operation

The content-security policy disables network connections. Local data is read with browser file APIs, processed in memory, and never uploaded.

The application contains no analytics, telemetry, remote fonts, third-party JavaScript, service worker, package manager, or CDN dependency.

## Scientific boundary

The application represents quantum states, stabilizers, error channels, syndrome extraction, and recovery through deterministic classical data structures and DSP mappings.

It does **not** claim:

- access to quantum hardware
- physical state preparation
- physical measurement or collapse
- state tomography
- device-calibrated noise inference
- fault-tolerance certification
- experimental validation of a QEC implementation

See [Scientific Boundaries](docs/SCIENTIFIC_BOUNDARIES.md).

## Source lineage

The design is grounded in:

- the SPECTRAL zero-install browser-application architecture;
- the QSOLKCB/QEC deterministic, replay-safe, canonical-hashing, event-stream, and sonification work;
- the QEC v167 symbolic-sonification runtime/event-mapping direction;
- SPECTRAL’s receipt-bound deterministic sonification philosophy.

The lab is a clean browser implementation rather than a direct execution of the Python QEC repository.

## Files

    QEC/APP/
    ├── index.html
    ├── app.js
    ├── style.css
    ├── README.md
    ├── LICENSE.txt
    ├── datasets/
    │   └── sample_qec_events.csv
    ├── docs/
    │   └── SCIENTIFIC_BOUNDARIES.md
    └── tests/
        ├── index.html
        ├── test-runner.js
        └── test-style.css

## License

MIT. See LICENSE.txt.
