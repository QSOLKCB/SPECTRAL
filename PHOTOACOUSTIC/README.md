# SPECTRAL Photoacoustic Laboratory 2.0

**Deterministic light-to-sound modelling and music generation—entirely inside the browser.**

SPECTRAL Photoacoustic Laboratory 2.0 is a zero-install, dependency-free DHTML redesign of `photoacoustic_sonifier.py`. It turns synthetic light signals or local WAV files into reproducible PCM16 audio through an explicit optical → thermal → pressure → cavity model.

The application has no server, localhost process, Python runtime, Node runtime, package manager, build step, CDN, cloud dependency, telemetry, or network request. The browser is the application runtime.

> **Scientific boundary:** this is a simplified audio-rate artistic and educational model of photoacoustic conversion. Material and cell presets are illustrative. Outputs are not calibrated measurements, engineering predictions, biomedical claims, or substitutes for physical apparatus modelling.

## Start the laboratory

1. Download or clone SPECTRAL.
2. Open `PHOTOACOUSTIC/index.html` in a modern browser.
3. Choose a determinism mode and light-source preset.
4. Select or edit the absorber and acoustic cell.
5. Render.

No local web server is necessary. The application remains functional while the computer is offline.

Open `PHOTOACOUSTIC/tests/index.html` to run the browser-native known-answer and acceptance suite.

## Architectural redesign

This is not a line-for-line transpilation of NumPy and SciPy. It preserves the Python instrument’s model, presets, and creative purpose while defining the browser-specific reproducibility contract that the original script did not have.

The original signal chain remains visible and inspectable:

```text
light intensity I(t)
  → optical absorption × laser power
  → material nonlinearity
  → thermal RC response T(t)
  → steady-heating/DC removal
  → Γβ pressure conversion
  → direct/derivative pressure blend
  → parallel cavity modes
  → optional FX
  → explicit PCM16 quantization
  → canonical WAV
```

The pressure derivative follows the original Python model in **sample units**, not seconds:

```text
p[n] = 0.65 × gradient(ΓβT)[n] + 0.35 × ΓβT[n]
```

The derivative can be disabled to use direct temperature-to-pressure mapping.

## Two determinism contracts

### Canonical Strict

Canonical Strict is the archival and cross-runtime path.

- Q15 integer signal ABI
- integer phase accumulators
- integer-only Bhaskara sine approximation
- fixed-point thermal state
- fixed-point pressure conversion
- fixed-point parallel state-variable resonators
- fixed-point versions of enabled FX
- canonical safe-integer JSON
- bundled synchronous SHA-256
- explicit PCM16 quantization and little-endian WAV packing
- fixed ZIP ordering, timestamps, CRC-32 values, and metadata fields
- no WebAudio-generated identity-bearing samples
- integer PCM WAV input through the bundled RIFF parser

Canonical Strict is a separately versioned browser DSP ABI. It is **not** presented as byte-identical to NumPy/SciPy output.

The intended guarantee is:

```text
same application and engine versions
+ same Canonical Strict mode
+ same normalized recipe
+ same seed and mutation index
+ same source bytes, when used
= same PCM, WAV, fingerprint, contract, manifest, and ZIP bytes
```

### Replay Safe

Replay Safe is the browser Float64 reinterpretation and creative iteration path. It preserves the original model topology and SciPy-compatible cavity peak coefficients without claiming complete numerical parity with every NumPy/SciPy generator and effect.

- Float64 optical and thermal processing
- Python-inspired nonlinear absorption
- SciPy-compatible `iirpeak` coefficient form
- explicit Float64-to-PCM16 quantization
- locally parsed PCM or IEEE Float WAV input
- deterministic linear resampling
- runtime fingerprint in recipe identity
- same-runtime replay scope

JavaScript transcendental functions such as `sin`, `cos`, `tan`, `tanh`, and `exp` are not claimed to be byte-identical across every browser engine. Replay Safe therefore records and binds the current runtime fingerprint.

Strict and Replay Safe recipes can never share the same recipe or observation-contract identity.

## Absorber materials

The original Python material registry is preserved:

| Material | Absorption | Thermal τ | Γ | Expansion | Nonlinearity |
|---|---:|---:|---:|---:|---:|
| Soot / candle black | 0.98 | 1.5 ms | 0.40 | 1.20 | 0.15 |
| Charcoal | 0.95 | 4.0 ms | 0.55 | 1.00 | 0.25 |
| Ethene gas cell | 0.60 | 0.8 ms | 0.80 | 1.50 | 0.05 |
| CS/PDMS nanocomposite | 0.90 | 0.3 ms | 1.20 | 0.80 | 0.10 |
| Black aluminium foil | 0.85 | 8.0 ms | 0.30 | 0.70 | 0.40 |
| Custom | editable | editable | editable | editable | editable |

These values are creative model parameters, not a calibrated database of material properties.

## Acoustic cells and resonators

| Cell | Modal frequencies | Q factors | Gain |
|---|---|---|---:|
| Glass jar | 180, 360, 720, 1100 Hz | 8, 6, 5, 4 | 1.2 |
| Helmholtz | 110, 220 Hz | 15, 10 | 1.5 |
| H-type PA cell | 250, 500, 1000, 2000 Hz | 20, 18, 12, 8 | 1.8 |
| Open-air approximation | 1000 Hz | 0.7 | 0.6 |
| Industrial pipe | 85, 170, 340, 680, 1360 Hz | 12, 10, 8, 6, 4 | 1.4 |
| Custom | editable | editable | editable |

The inherited `open_air` preset remains a broad 1 kHz response. It is not described as a physically flat free field.

Custom resonators accept one to eight comma-separated modal frequencies with exactly the same number of Q values. Invalid, empty, mismatched, non-positive, or above-Nyquist modes fail closed.

## Light-source presets

### Industrial Fibonacci

Fibonacci-spaced light impulses plus a secondary exponential pulse layer, passed through charcoal and the industrial pipe. Distortion and chamber reflection supply controlled grit.

### Soot Music

The original fixed note sequence and harmony are treated as light modulation, passed through soot and glass-jar modes with direct pressure conversion.

### Resonant Gas Cell

A 110/165/220/277 Hz chord is optically chopped at 4.5 Hz and passed through the ethene/H-cell model.

### Ultrasonic Edge

Fast 45 Hz and 67 Hz optical pulse trains excite the rapid CS/PDMS model and broad open response. The result is deliberately bright and granular while remaining in the exported audio band.

### Dark Thermal Drone

A 60 BPM industrial light pattern excites black aluminium and low Helmholtz modes, with dark EQ and long reflections.

### Evolving Material Demo

One industrial light signal moves through four sections:

1. soot + glass jar;
2. charcoal + industrial pipe;
3. ethene + H-cell;
4. CS/PDMS + open response.

The section boundaries scale to the selected duration, fixing the original Python demo’s short-duration boundary problem.

### Pulse and Tone Laboratories

Editable pulse rate, pulse width, shape, carrier frequency, material, cell, power, and FX controls expose the engine directly.

### WAV Through Light

A local WAV is parsed without uploading it anywhere, downmixed to mono, DC-centred, normalized, and mapped to:

```text
0.50 bias + 0.45 AC modulation
```

Canonical Strict accepts integer PCM WAV files. Replay Safe additionally accepts IEEE Float32/Float64 WAV files. Supported PCM depths are 8, 16, 24, and 32 bits. Files are limited to 128 MiB and 120 seconds of rendered output.

Compressed formats are intentionally not passed through browser `decodeAudioData()`, because native codec and resampling behaviour would weaken the render contract.

## Post-processing

The browser instrument includes versioned implementations of:

- optical saturation/distortion;
- three-band tone shaping;
- modulated-delay chorus;
- and four-tap chamber reflection/reverb.

FX order is fixed and identity-bearing:

```text
distortion → EQ → chorus → reverb
```

Playback volume, visualization scale, selected stage trace, window size, and spectrogram settings are observational only and never enter render identity.

## Export profiles

| Profile | Rate | Channels | Ceiling | Intended use |
|---|---:|---:|---:|---|
| Archive | 44.1 kHz | Mono | −0.70 dBFS | preservation and analysis |
| Suno Seed | 48 kHz | Dual mono | −6.00 dBFS | conservative original source-stem headroom |
| Laboratory Hot | 44.1 kHz | Mono | −0.10 dBFS | aggressive local experiments |

Suno Seed is not a detector bypass, copyright-evasion feature, or guarantee that an external service will accept an upload.

## Every render

The Artifacts panel exposes:

```text
audio.wav
manifest.json
fingerprint.json
stage_receipt.json
derivation_graph.json
upload_readiness.json
README_ORIGIN.txt
photoacoustic_provenance.zip
```

The deterministic ZIP contains the seven primary artifacts, sorted lexically and stored without compression using fixed DOS epoch fields, explicit CRC-32 values, no comments, and no extra fields. The initial derivative graph binds the source-stem recipe, contract, and WAV while beginning with an empty derivative list.

### Recipe

The normalized recipe freezes:

- application, engine, schema, and algorithm versions;
- determinism mode;
- seed and mutation index;
- preset and generator parameters;
- sample rate and integer duration;
- fully expanded material parameters;
- fully expanded resonator modes and Q factors;
- laser power and pressure method;
- enabled FX and normalized parameters;
- export profile;
- source-byte hash and canonical WAV metadata;
- and the Replay Safe runtime fingerprint where applicable.

Filenames, filesystem paths, modification dates, wall-clock time, playback state, history, and visualization settings never enter render identity.

### Observation contract

The contract binds:

- recipe SHA-256;
- PCM payload SHA-256;
- canonical WAV SHA-256;
- fingerprint SHA-256;
- stage-receipt SHA-256;
- backend and signal ABI;
- sample format, rate, channels, and frame count;
- and replay requirements.

Hash domains are separated:

```text
SPECTRAL/PHOTOACOUSTIC/RECIPE/v1\0
SPECTRAL/PHOTOACOUSTIC/STAGE/v1\0
SPECTRAL/PHOTOACOUSTIC/FINGERPRINT/v1\0
SPECTRAL/PHOTOACOUSTIC/CONTRACT/v1\0
SPECTRAL/PHOTOACOUSTIC/MANIFEST-CORE/v1\0
```

The manifest core is hashed before `manifest_core_sha256` is attached. No artifact claims to contain a hash of its own final bytes.

## Manifest replay

Use **REPLAY MANIFEST** beside Render.

Replay fails closed unless:

- the manifest schema is supported;
- the manifest, recipe, and contract hashes authenticate;
- the original source is loaded when required;
- the source hash and length match;
- the Replay Safe runtime matches, when applicable;
- the regenerated WAV hash matches;
- the regenerated contract hash matches;
- and the regenerated manifest-core hash matches.

Failed and cancelled replays create no saved job and no partial artifact set.

## Fingerprint and readiness

The deterministic fingerprint contains:

- PCM and WAV hashes;
- peak and RMS;
- DC offset;
- zero crossings;
- clipping count;
- fixed-size PCM chunk hashes;
- repeated-exact-chunk observation;
- and a 64-bin RMS envelope hash.

Upload readiness is a local technical advisory only. It checks clipping, strong DC, very low level, and exact chunk repetition. It does not query or imitate an external matching system and is not legal advice, ownership validation, or an upload guarantee.

## Visual analysis

The application provides:

- PCM waveform rendering;
- FFT spectrogram rendering;
- logarithmic or linear frequency display;
- light, thermal, pressure, and acoustic stage traces;
- peak, RMS, duration, and hash metrics;
- native local audio transport;
- and an observation-contract hash summary.

Canvas visualization uses floating-point math because pixels are observations, not identity-bearing samples.

## Local storage and privacy

IndexedDB retains the most recent 24 completed jobs, including canonical WAV bytes, receipts, and provenance ZIPs. When IndexedDB is unavailable for a `file://` origin, the application displays **STORAGE · SESSION ONLY** and continues in memory.

The application:

- creates no cookies;
- registers no service worker;
- requests no microphone, camera, or MIDI access;
- contains no network client;
- uses no remote assets, fonts, services, or analytics;
- and keeps every selected source file on the local computer.

The restrictive Content Security Policy includes `connect-src 'none'`.

## Directory layout

```text
PHOTOACOUSTIC/
  index.html
  style.css
  app.js
  README.md
  LICENSE.txt
  photoacoustic_sonifier.py       # original Python implementation
  js/
    core.js                       # namespace, canonical JSON, SHA-256, strict math
    wav.js                        # RIFF parser, PCM16 writer, resampler, ZIP
    model.js                      # registries, generators, strict/replay DSP
    provenance.js                 # recipes, fingerprints, contracts, replay
    storage.js                    # IndexedDB with session fallback
    visuals.js                    # waveform, FFT spectrogram, stage traces
    ui.js                         # application controller
  tests/
    index.html
    network-guard.js
    test-style.css
    test-runner.js
```

Classic deferred scripts are intentional. ES-module imports are not consistently available between local `file://` resources, so production APIs attach to one versioned `window.PHOTOACOUSTIC` namespace in a fixed order.

## Test and acceptance workflow

Open `tests/index.html` directly. The suite checks:

- SHA-256 standard vectors;
- canonical JSON ordering and number rejection;
- exact decimal scaling and rounding;
- strict integer oscillator quadrants;
- hand-built PCM16 WAV bytes and hash;
- WAV parse/write round trips;
- deterministic resampling;
- material and resonator registry values;
- invalid resonator rejection;
- a frozen end-to-end Canonical Strict golden render;
- repeated-render byte equality;
- mutation and mode identity separation;
- all five original musical mappings;
- the 25-pair material/resonator matrix;
- exact manifest replay;
- tamper rejection;
- cancellation without artifacts;
- deterministic ZIP ordering;
- IndexedDB ArrayBuffer persistence when available;
- and absence of remote resources.

For a publication-grade Canonical Strict claim, run the same suite in current Chromium, Firefox, Safari, and Edge releases and compare frozen hashes.

Static network audits from the repository root:

```bash
rg -n --pcre2 -g '*.js' -g '*.html' -g '!tests/network-guard.js' \
  '\bfetch\s*\(|new\s+XMLHttpRequest|new\s+WebSocket|EventSource\s*\(|sendBeacon\s*\(' PHOTOACOUSTIC

rg -n --pcre2 -g '*.html' -g '*.css' \
  "(?i)(src|href)\s*=\s*['\"](?:https?:)?//" PHOTOACOUSTIC

find PHOTOACOUSTIC -maxdepth 2 -type f \
  \( -name package.json -o -name 'package-lock.json' -o -name 'yarn.lock' -o -name 'pnpm-lock.yaml' \)
```

Expected result: no production network client, no remote HTML/CSS asset, and no package-manager file.

## Legacy Python implementation
Moved To 'PHOTOACOUSTIC/scripts'
`photoacoustic_sonifier.py` remains useful for command-line generation and for comparing the browser’s Replay Safe character with the original NumPy/SciPy model.

The browser and Python engines should not be expected to produce identical bytes because:

- the Python environment does not pin NumPy, SciPy, or libsndfile versions;
- Python uses NumPy/SciPy Float64 filters and libsndfile output;
- Canonical Strict deliberately uses an integer browser ABI;
- Replay Safe uses explicit browser-side quantization;
- and the browser resampler is versioned linear interpolation rather than SciPy `resample_poly`.

These differences are declared in the recipe instead of being hidden.

## License

SPECTRAL Photoacoustic Laboratory is distributed under the MIT License. See the repository-root `LICENSE` and `PHOTOACOUSTIC/LICENSE.txt`.

Copyright (c) 2026 Trent Slade (QSOL-IMC).
