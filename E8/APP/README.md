# SPECTRAL E8 Geometry Studio 1.0

**A zero-install musical instrument for exploring the 240 roots of E8 across an evolving eight-dimensional Cartan torus.**

SPECTRAL E8 Geometry Studio is the deliberately less restrictive, music-making counterpart to the repository's deterministic Sonification Workbench and Photoacoustic Laboratory. It preserves their honest identity boundaries and local provenance, but puts fast experimentation, scene morphing, long sweeps, spatial variants, and reusable source stems at the centre of the interface.

It is a dependency-free DHTML application. There is no server, localhost process, Python runtime, Node runtime, package manager, build step, CDN, cloud service, telemetry, or network request. Double-click [`index.html`](index.html) and the browser becomes the instrument.

## Start making sound

1. Download or clone SPECTRAL.
2. Open `E8/APP/index.html` directly in a modern browser.
3. Choose **Canonical**, **Replay-Safe**, or **Creative**.
4. Start with **Deep 8D Sweep** to reproduce the long Cartan-space workflow.
5. Adjust the geometry macros, pitch field, spatial map, or individual Cartan axes.
6. Use **8 s Preview** while exploring and **Render Full Take** when the geometry is ready.
7. Download the WAV alone or the complete provenance bundle.

The app remains functional offline and does not upload the audio, recipe, or settings anywhere.

Open [`tests/index.html`](tests/index.html) directly to run the browser-native known-answer and contract suite.

## Three genuinely separate render domains

The mode is part of the recipe and observation-contract identity. A Creative take can never be presented as Canonical or Replay-Safe merely because its controls look similar.

### Canonical Deterministic

The archival and cross-runtime path uses a separately versioned integer DSP ABI:

- the E8 root system is represented exactly as doubled integer coordinates;
- all 240 roots are generated in a fixed order;
- oscillator scheduling uses unsigned 32-bit phase accumulators;
- sine uses a fixed integer parabolic/Bhaskara-style approximation;
- triangle morphing, qutrit state, triality exchange, amplitude, panning, feedback, saturation, fades, normalization, and PCM quantization use explicit integer arithmetic;
- the render recipe accepts safe integers, strings, booleans, arrays, plain objects, and nulls only;
- SHA-256, PCM16 packing, RIFF fields, ZIP ordering, CRC-32, and fixed ZIP time fields are bundled locally;
- WebAudio is playback only and never generates identity-bearing samples;
- no runtime fingerprint, wall clock, filename, UI layout, or visualization state enters the strict recipe.

The intended guarantee is:

```text
same E8 Studio version and strict ABI
+ same normalized parameters and export profile
+ same seed and mutation index
= same PCM, WAV, hashes, trajectory receipt, contract, manifest, and bundle
```

Canonical Deterministic is not claimed to reproduce NumPy's floating-point output byte-for-byte. It is its own documented browser ABI.

### Replay-Safe

Replay-Safe is the closest browser interpretation of the Float32/Float64 Python E8 sweep workflow:

- normalized floating-point E8 roots;
- Float64 root projections and control-state evolution;
- a versioned sine lookup table for efficient audio-rate synthesis;
- continuously evolving frequency, amplitude, qutrit morph, fractal modulation, pan, and spatial state;
- seeded entropy bloom rather than hidden randomness;
- explicit PCM16 quantization and canonical WAV packing;
- a browser/runtime fingerprint in the recipe and contract.

Exact replay is promised only when the recorded runtime fingerprint matches.

### Creative Non-Deterministic

Creative mode is for deliberately unconstrained take generation:

- every render draws a fresh 256-bit local entropy nonce;
- bloom is wider and root selection can wander during the render;
- **New Creative Take** keeps the controls but generates a different trajectory;
- the manifest records the nonce hash and entropy source, but deliberately does not export the nonce itself;
- the exact WAV hash is the authoritative identity of the take;
- a Creative manifest cannot be replayed under a deterministic claim.

Loading a Creative recipe clones its settings and produces a new take. It does not pretend to reconstruct the previous audio.

## The E8 mapping

The app generates the complete E8 root system in the conventional two families:

```text
112 roots: (±1, ±1, 0, 0, 0, 0, 0, 0), with every coordinate placement
128 roots: ½(±1, ±1, ±1, ±1, ±1, ±1, ±1, ±1), with even minus parity
```

Canonical mode stores twice these values, so both families remain exact integers with squared doubled-coordinate norm 8. Replay-Safe and Creative modes divide the doubled coordinates by `2√2` to obtain unit roots.

The eight Cartan angles are:

```text
θ = (θ1, θ2, θ3, θ4, θ5, θ6, θ7, θ8)
```

For each coupled root `α`, the control engine evaluates:

```text
root phase        φα = α · θ
frequency field  ∝ mean(sin φα)
amplitude field  ∝ 1 + mean(cos φα)
```

The root projections drive eight oscillators, one per Cartan direction. A three-component decaying control state supplies the qutrit/ternary waveshape morph. Triality exchanges signal between three voice lanes. Stereo position follows selected torus angles or the chosen spatial map.

These are explicit sonification and composition mappings. E8 supplies the control geometry; the app does not claim that an exported WAV is a physical E8 measurement, cosmological observation, or quantum-computing experiment.

## Relationship to the Python generators

The baseline **Deep 8D Sweep** follows the architecture in [`../scripts/e8_sonify_30s.py`](../scripts/e8_sonify_30s.py):

- all 240 E8 roots;
- an evolving 8D Cartan torus;
- deterministic sparse root coupling;
- eight φ-spaced oscillators;
- root-driven frequency and amplitude modulation;
- sine-to-triangle qutrit morphing;
- torus-driven stereo position;
- optional Haas width, fades, normalization, and PCM16 WAV export.

The Studio also adapts declared musical ideas from:

- [`../e8_triality_fractal_sonifier.py`](../e8_triality_fractal_sonifier.py): triality lanes, φ-fractal modulation, isochronic envelopes, trinaural distribution, and qutrit-4D weight rotation;
- [`../../OMI-ISA/e8_fractal_cosmovirus_sonify.py`](../../OMI-ISA/e8_fractal_cosmovirus_sonify.py): Fibonacci/φ recursion, triality exchange, root-directed mutation, and controlled feedback as symbolic musical devices;
- [`../m87_e8_fractal_sonification.py`](../m87_e8_fractal_sonification.py): Weierstrass-style multi-scale modulation, E8 partial fields, and slow stereo asymmetry;
- the main [`../../APP/`](../../APP/) and [`../../PHOTOACOUSTIC/`](../../PHOTOACOUSTIC/) browser applications: canonical JSON, local SHA-256, explicit WAV writing, deterministic ZIPs, mode-scoped contracts, manifests, and offline-only operation.

This is an architectural browser redesign, not a line-for-line NumPy translation. The Python and browser Float64 renders are not expected to have identical bytes.

## Factory geometries

| Preset | Main purpose |
|---|---|
| **Deep 8D Sweep** | Gentle long-form Cartan motion over the deep φ ladder. With a 110 Hz anchor, the strict ladder is approximately 3.789, 6.130, 9.918, 16.048, 25.967, 42.016, 67.984, and 110 Hz. |
| **Open D Field** | A warmer 432 Hz-derived D field intended for later DAW layering. |
| **Triality Fractal** | Three-lane exchange, seven modulation octaves, and a restrained φ-derived pulse. |
| **Qutrit 4D** | Four voices with a strong three-state core and slow higher-dimensional weight rotation. |
| **Trinaural Orbit** | Three 120° lanes, wide spatial distribution, and close left/right pulse motion. |
| **Coxeter Glass** | Brighter E8-height partials, a coupled orbit, and controlled recursive feedback. |
| **240-Root Cloud** | Dense root use, a root-directed walk, wider modulation, and more aggressive drive. |
| **Quiet Lattice** | Clean, low-bloom, near-mono geometry for later processing. |

Factory presets are starting points, not locked templates. Every exposed value remains editable.

## Creative controls

### Pitch and trajectory

- **Path:** Cartan Sweep, Coxeter Orbit, Triality Spiral, Qutrit 4D Orbit, or Root Walk.
- **Lattice:** deep φ ladder, centred φ ladder, harmonic field, minor field, or E8-height field.
- **Anchor:** 8–4000 Hz.
- **Voices:** 3–8.
- **Root density:** 8, 12, 20, or 30 roots per voice. Across voices, the full union can span the 240-root set.
- **Root offset:** rotates the deterministic coupling selection without changing the root generator.

### Geometry macros

- Cartan drift;
- seeded or creative entropy bloom;
- root-phase frequency depth;
- root-cosine amplitude depth;
- qutrit/ternary bias;
- sine-to-triangle morph;
- triality exchange;
- and one to eight φ-scaled fractal modulation layers.

### Pulse, space, and drive

- editable pulse rate and depth, including the `φ² × 3 ≈ 7.854 Hz` starting point used by the Triality preset;
- near-mono, torus-field, orbit, triality, trinaural, and qutrit-4D spatial maps;
- 0–30 ms Haas width;
- rational soft saturation;
- bounded cross-feedback;
- and 100, 200, 250, or 500 Hz control rates.

### Eight-axis mixer

Each Cartan direction can be weighted from 0.000 to 1.500. Muting an axis changes the path through the eight-dimensional control field; it does not delete roots from the mathematical root registry.

### Scene morphing

Capture two complete settings as **Scene A** and **Scene B**, then move the morph rail between them. Integer controls and all eight axis weights interpolate. Discrete path, lattice, and spatial choices switch at the midpoint.

Scene morphing is deterministic when used in a deterministic mode because the resulting normalized parameters—not the UI gesture—enter the recipe.

### A/B audio

Rendered takes can be kept temporarily in memory as A and B for quick listening comparisons. A/B history, playback position, and browser volume never enter render identity.

## Export profiles

| Profile | Rate | Peak target | Use |
|---|---:|---:|---|
| **Sketch** | 44.1 kHz stereo PCM16 | −1.5 dBFS | fast musical iteration |
| **Studio** | 48 kHz stereo PCM16 | −1.0 dBFS | polished full take |
| **DAW Headroom** | 48 kHz stereo PCM16 | −6.0 dBFS | later effects, layering, or music-model reference input |
| **Raw Geometry** | 48 kHz stereo PCM16 | no normalization | inspect direct engine character |

The DAW Headroom profile is a conservative technical export for original material. It is not a detector bypass, copyright-evasion mechanism, ownership validator, or guarantee that Suno, YouTube, Spotify, or another service will accept an upload.

## Every completed take

The interface exposes:

```text
audio.wav
e8_recipe.json
fingerprint.json
manifest.json
observation_contract.json
root_trajectory.csv
root_trajectory.json
upload_readiness.json
README_ORIGIN.txt
```

**Full bundle ZIP** stores the nine entries without compression, in lexical order, with fixed ZIP time fields, explicit CRC-32 values, no comments, and no extra fields. The ZIP is assembled only when requested so ordinary rendering does not retain another full copy of the WAV in memory.

The identity chain is acyclic:

```text
normalized settings
  → mode-scoped recipe
  → E8 render → PCM16 → canonical WAV
  → PCM/WAV hashes
  → audio fingerprint + bounded trajectory receipt
  → observation contract + readiness advisory
  → manifest core → manifest-core receipt
  → optional bundle
```

No document claims to contain an ordinary SHA-256 hash of all of its own final bytes.

## Fingerprint and local readiness

The deterministic audio fingerprint records:

- exact PCM and WAV hashes;
- peak and RMS;
- DC offset;
- zero-crossing rate;
- stereo correlation;
- clipping-frame count;
- crest factor;
- 64-bin RMS envelope and its hash;
- and fixed PCM chunk hashes.

Readiness is a local technical advisory for clipping, DC offset, level, and headroom. It does not query or imitate an external content-matching service.

## Manifest replay

Choose **Replay Manifest** and load a `manifest.json` created by the app.

Canonical and Replay-Safe replay fails closed unless:

- the manifest, recipe, contract, and manifest-core hashes authenticate;
- the app and engine versions match;
- the Replay-Safe runtime fingerprint matches when required;
- the regenerated WAV hash matches;
- and the regenerated contract and manifest-core identities match.

Creative manifests are intentionally refused for exact replay because the entropy nonce is not exported. Their settings can still be loaded through `e8_recipe.json` to create a new take.

## Performance and limits

The renderer is deliberately conservative:

- duration is limited to 120 seconds;
- output is PCM16 stereo at 44.1 or 48 kHz—there is no high-overhead 96/192 kHz vanity mode;
- root projections run at a selectable 100–500 Hz control rate rather than once per audio sample;
- only 3–8 audio-rate oscillators are evaluated;
- Float64 control math stages directly into one Float32 audio buffer;
- Canonical mode uses one Int32 mix buffer;
- rendering yields to the browser in fixed frame chunks and can be cancelled;
- trajectory capture is bounded to approximately 256 points;
- visualization is observational Canvas 2D, not WebGL;
- provenance ZIP memory is allocated lazily.

Approximate stereo WAV sizes are:

| Duration | 44.1 kHz | 48 kHz |
|---:|---:|---:|
| 8 s | 1.35 MiB | 1.46 MiB |
| 30 s | 5.05 MiB | 5.49 MiB |
| 60 s | 10.09 MiB | 10.99 MiB |
| 120 s | 20.19 MiB | 21.97 MiB |

The interface displays an estimate before rendering. A 120-second render temporarily needs substantially more memory than the WAV because the mix and PCM buffers coexist during finalization.

## Visual inspection

- projected map of all 240 roots;
- highlight of the roots coupled by the current voices;
- rendered Cartan trajectory over the root map;
- stereo waveform;
- logarithmic or linear-frequency spectrogram;
- peak, RMS, stereo-correlation, clipping, trajectory, and contract summaries.

Canvas size, FFT display, log/linear selection, viewport, playback state, and volume are observations only and never affect the WAV.

## Privacy and security boundary

The production page:

- has no network client;
- loads no remote asset, font, image, script, or stylesheet;
- uses a restrictive Content Security Policy with `connect-src 'none'`;
- registers no service worker;
- requests no microphone, camera, MIDI device, login, or cloud storage;
- creates no cookies;
- and keeps custom presets in optional browser-local storage only.

Local preset storage is convenience state and never changes a render unless the user loads the preset.

## Directory layout

```text
E8/APP/
  index.html
  style.css
  app.js
  README.md
  LICENSE.txt
  AGENTS.md         # contributor and identity-boundary contract
  js/
    core.js          # namespace, root system, canonical JSON, SHA-256, PRNG
    audio.js         # finalization, PCM16 WAV, fingerprint metrics, ZIP
    engine.js        # strict, replay-safe, and creative E8 renderers
    provenance.js    # recipes, contracts, manifests, replay, artifacts
    visuals.js       # E8 projection, waveform, FFT spectrogram
    ui.js            # controls, presets, scenes, A/B, render orchestration
  tests/
    index.html
    test-style.css
    test-runner.js
```

Classic deferred scripts attach APIs beneath `window.E8STUDIO` in a fixed order. ES modules are intentionally avoided because direct `file://` module loading remains inconsistent across browser configurations.

## Test and acceptance workflow

Open `E8/APP/tests/index.html` directly. The suite checks:

- the standard SHA-256 `abc` vector;
- canonical JSON ordering and floating-point rejection;
- 112 + 128 E8 root cardinality;
- doubled-coordinate norm, half-family parity, and root uniqueness;
- a frozen strict φ-ladder vector;
- PCM16 RIFF structure;
- a frozen end-to-end Canonical render hash;
- repeated strict WAV, contract, manifest, and ZIP equality;
- mutation changing actual PCM and WAV bytes;
- Strict/Replay-Safe recipe and contract separation;
- Replay-Safe runtime binding;
- fresh Creative entropy and take identity;
- manifest tamper rejection;
- exact strict manifest replay;
- bounded eight-coordinate trajectory receipts;
- and absence of remote production resources.

For publication-grade cross-runtime Canonical claims, run the same suite in current Chromium, Firefox, Safari, and Edge releases and compare the frozen strict hashes.

Static audits from the repository root:

```bash
rg -n --pcre2 -g '*.js' -g '*.html' \
  '\bfetch\s*\(|new\s+XMLHttpRequest|new\s+WebSocket|EventSource\s*\(|sendBeacon\s*\(' E8/APP

rg -n --pcre2 -g '*.html' -g '*.css' \
  "(?i)(src|href)\s*=\s*['\"](?:https?:)?//" E8/APP

find E8/APP -maxdepth 2 -type f \
  \( -name package.json -o -name package-lock.json -o -name yarn.lock -o -name pnpm-lock.yaml \)
```

Expected result: no production network client, no remote HTML/CSS asset, and no package-manager file.

## License

SPECTRAL E8 Geometry Studio is distributed under the MIT License. See [`LICENSE.txt`](LICENSE.txt) and the [repository-root license](../../LICENSE).

Copyright © 2026 Trent Slade / QSOL-IMC.
