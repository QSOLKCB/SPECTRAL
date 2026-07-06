# SPECTRAL Deterministic Sonification Workbench

**Original deterministic source-stems for audible geometry.**

`APP/` is the local browser app for SPECTRAL’s deterministic data-sonification workflow. It turns data, symbols, images, byte streams, QEC-style event streams, and E8/φ/SPECTRAL presets into reproducible WAV source-stems with provenance, fingerprints, manifests, and local upload-readiness reports.

The intended creative flow is:

```text
data / image / symbolic engine / byte orbit
        ↓
deterministic sonification seed WAV
        ↓
provenance + fingerprint bundle
        ↓
creative production, arrangement, remix, or AI-assisted musical expansion
        ↓
derivative track linked back to the original seed
```

This app is designed to make strange, beautiful, replayable audio artifacts — not one-off random renders that can never be found again.

---

## What this app is

SPECTRAL Deterministic Sonification Workbench is a **localhost-only creative/scientific audio tool** for generating original WAV stems from deterministic engines.

It provides:

- deterministic sonification engines
- local browser control surface
- WAV rendering
- seed and mutation controls
- cryptographic hashes
- provenance manifests
- local audio fingerprints
- upload-readiness reports for original generated stems
- derivative-track lineage documentation
- SPECTRAL/E8/φ/QEC-inspired preset language

The core guarantee is:

```text
same source data + same engine + same parameters = same WAV bytes
```

That makes each sound reproducible, citeable, inspectable, remixable, and defensible as an original generated artifact.

---

## What this app is not

This app is **not** a copyright-filter bypass tool.

It does **not**:

- evade Suno, YouTube, Spotify, Content ID, copyright, or audio-matching systems
- disguise copyrighted music
- remove watermarks from protected material
- validate legal ownership
- provide legal advice
- guarantee that any external platform will accept an upload
- make biomedical, archaeological, or scientific proof-claims from symbolic/art-mode presets

The provenance and fingerprint features are for **authorship documentation, reproducibility, and false-positive-resistance for user-owned original material**.

---

## Quick start

From the repository root:

```bash
python APP/run_app.py
```

Then open:

```text
http://127.0.0.1:8765
```

Default behavior:

```text
host: 127.0.0.1
port: 8765
artifacts: APP/artifacts/sonification/
```

Optional form, if implemented by the runner:

```bash
python APP/run_app.py --host 127.0.0.1 --port 8765
```

Run tests:

```bash
python -m pytest APP/tests
```

---

## App modes

### 1. Seed Mode

Seed Mode generates original deterministic source-stems.

Typical workflow:

1. Choose an engine.
2. Adjust seed, mutation index, duration, export profile, and engine parameters.
3. Render the WAV.
4. Listen in the browser.
5. Inspect hashes, fingerprint, and readiness report.
6. Export the provenance bundle.

Seed Mode is for creating the first-generation audio material: the raw data-sonification “DNA” that can later become music.

### 2. Derivative Track Mode

Derivative Track Mode links later musical outputs back to a generated source seed.

Typical workflow:

1. Select an existing seed job.
2. Import a later WAV/MP3 track created from that seed.
3. Compute hashes and local fingerprints.
4. Save a derivation graph.

This creates a local provenance chain such as:

```text
e8_cosmovirus_seed_00017/audio.wav
        ↓
AI continuation / musical expansion / user arrangement
        ↓
finished_track.wav
```

Derivative Track Mode does not upload anything externally.

---

## Directory layout

Expected `APP/` structure:

```text
APP/
  README.md
  AGENTS.md
  run_app.py

  spectral_sonification/
    __init__.py

    core/
      canonical.py
      hashing.py
      manifest.py
      models.py
      paths.py

    engines/
      registry.py
      e8_cosmovirus.py
      omi_xor_ring.py
      e8_bell.py
      qec_triality.py
      spectral_algebraics.py
      image_scan.py
      data_mapper.py

    render/
      pcm.py
      wav_writer.py
      normalize.py
      export_profiles.py

    provenance_guard/
      fingerprint.py
      collision_catalog.py
      upload_readiness.py
      derivation_graph.py
      bundle.py

    server/
      app.py
      routes.py
      static/
        index.html
        app.js
        style.css

  tests/
    test_canonical_hash.py
    test_deterministic_engines.py
    test_wav_writer.py
    test_manifest.py
    test_fingerprint.py
    test_upload_readiness.py
    test_http_routes.py
    test_no_network.py

  artifacts/
    .gitkeep
```

Generated artifacts should stay under `APP/artifacts/` and should generally not be committed.

---

## Generated artifact bundle

Each render creates a job folder:

```text
APP/artifacts/sonification/{job_id}/
  audio.wav
  manifest.json
  fingerprint.json
  upload_readiness.json
  derivation_graph.json
  README_ORIGIN.txt
```

### `audio.wav`

The rendered deterministic source-stem.

### `manifest.json`

Canonical render metadata and reproducibility data.

Expected fields include:

```text
app_name
app_version
engine_id
engine_version
engine_params
source_file_hashes
source_data_hash
canonical_params_hash
pcm_sha256
audio_wav_sha256
manifest_sha256
sample_rate
channels
bit_depth
duration_sec
export_profile
git_commit
symbolic_mode
claim_boundary
```

Wall-clock render time may appear as human metadata, but it must not affect the deterministic render hash.

### `fingerprint.json`

Local audio fingerprint information for comparing against the app’s own catalog.

Expected fields include:

```text
pcm_sha256
wav_sha256
duration_sec
sample_rate
channels
peak_dbfs
rms_dbfs
dc_offset
zero_crossing_rate
stereo_correlation
rms_envelope_hash
peak_constellation_hash
chunk_hashes
spectral_centroid_summary
spectral_flatness_summary
band_energy_hash
```

Spectral features may be optional when NumPy is unavailable.

### `upload_readiness.json`

A local readiness report for original generated material.

Expected checks include:

```text
original_generation_declared
no_third_party_samples_declared
no_external_network_used
manifest_complete
clipping_detected
peak_level_ok
dc_offset_ok
repeated_exact_chunks_detected
local_catalog_collision_score
provenance_bundle_complete
warnings
recommendation
```

Recommendations should be one of:

```text
ready
revise
archive_only
```

### `derivation_graph.json`

A lineage file linking seed stems and later derivative tracks.

Example:

```json
{
  "source_seed_job_id": "e8_cosmovirus_00017",
  "source_audio_sha256": "...",
  "derivative_audio_sha256": "...",
  "relationship": "AI continuation / musical expansion / user arrangement",
  "notes": "Created from the deterministic seed stem.",
  "created_by_user": true
}
```

### `README_ORIGIN.txt`

A human-readable origin statement for the generated audio.

Example language:

```text
This audio file is an original deterministic data sonification generated by
SPECTRAL Deterministic Sonification Workbench.

No third-party samples, loops, stems, copyrighted melodies, or lyrics were used
by the generator.

Generated from:
- engine
- seed
- mutation_index
- engine params hash
- source data hash
- audio sha256
- manifest sha256
- app version
- git commit if available

This file is intended as original source material for creative production.
```

---

## Engines

The app uses an engine registry. Each engine should declare:

```text
engine_id
display_name
description
parameter_schema
render_function
deterministic: true
symbolic_mode: optional
export_profile_default
```

Each render function returns a common object containing PCM audio and metadata.

```python
@dataclass(frozen=True)
class EngineRenderResult:
    sample_rate: int
    channels: int
    pcm_int16: bytes
    events: list[dict]
    engine_metadata: dict
```

### `e8_cosmovirus`

A symbolic-art sonification engine based on deterministic XOR/rotation dynamics, E8-style triality, φ mixing, DIAG `(1,-2,1)`, Fibonacci-period events, and Ouroboros feedback.

Default identity:

```text
engine family: E8 / OMI XOR / φ / DIAG / Ouroboros
mode: SYMBOLIC_ART_MODE
```

Important claim boundary:

```text
creative symbolic metadata only; not biomedical, archaeological, or scientific proof
```

Core ingredients:

```text
OMI delta law
3-register triality mixing
φ golden-hash state
DIAG second-derivative edge response
Fibonacci update periods
Ouroboros feedback
stereo split between ideal/math layer and infected/symbolic-reality layer
```

This engine is for intense deterministic glitch, texture, and seed-stem generation.

### `omi_xor_ring`

A pure deterministic XOR/rotation orbit engine.

Core delta law:

```text
Δ(x) = rotl32(x,1) ⊕ rotl32(x,3) ⊕ rotr32(x,2) ⊕ 0xA5A5A5A5
```

Useful for:

- raw deterministic data-bending
- bit-orbit audification
- crunchy digital textures
- seed stems with strong synthetic identity

### `e8_bell`

A φ-scaled E8 Bell-state fractal synthesis engine.

Mapping:

```text
|Φ⁺⟩ : in-phase f and f·φ
|Φ⁻⟩ : anti-phase f and f·φ
|Ψ⁺⟩ : odd-parity φ⁻¹ and φ² tones
|Ψ⁻⟩ : odd-parity phase-flipped tones
```

Useful for:

- harmonic/fractal pads
- mathematically structured drones
- 432 Hz / φ-scaled spectral material
- gentler source stems than the XOR engines

### `qec_triality`

A CSV-based QEC/data sonification engine.

Typical mapping:

```text
error_rate column: frame/time reference
other numeric columns: harmonic voices
phase shift: π/2
ternary relation: [1, -2, 1]
```

Unlike earlier standalone scripts, this engine should accept uploaded CSV data rather than relying on a hardcoded filename.

### `spectral_algebraics`

A SPECTRAL-native synthesis engine using macro controls.

Preset language:

```text
PhiDrift
CoxeterPhase
AmpGain
PhaseGain
TernaryBias
CosmicDepth
EnergyFlow
EntropyBloom
```

Suggested presets:

```text
Coxeter Orbit
φ-Pulse Grit
E8 Pad Swell
```

`EntropyBloom` should be deterministic, derived from hash bytes or seeded integer state — not from nondeterministic randomness.

### `image_scan`

An image-to-sound engine.

MVP modes:

```text
luminance_scanline
edge_diag_scanline
radial_scan
```

Typical mapping:

```text
x position → time
y/luminance → pitch or amplitude
DIAG edge response → transient density
image hash → manifest source hash
```

Image decoding may use Pillow if available. If image decoding dependencies are missing, the app should fail gracefully with a clear message.

### `data_mapper`

A generic CSV/JSON numeric data sonification engine.

MVP mapping controls:

```text
time column
pitch column
amplitude column
pan column
duration column
timbre/noise column optional
```

Useful for:

- public datasets
- scientific measurements
- time series
- tabular experiments
- quick “sonify this” workflows

---

## Export profiles

### Archive

For high-fidelity local preservation.

```text
sample_rate: 44100
bit_depth: 16
peak_ceiling_dbfs: -0.7
fades: true
```

### Suno Seed Export

For clean, conservative original source-stem exports intended for later creative use.

```text
sample_rate: 48000
bit_depth: 16
peak_ceiling_dbfs: -6.0
target_rms_dbfs: conservative, approximately -18 to -12 when possible
fade_in_ms: 10
fade_out_ms: 50
remove_dc_offset: true
normalize: true
write_provenance_bundle: true
```

This is **not** a bypass or evasion profile. It is a clean export profile for original generated material.

### Brutalist Full-Scale

For aggressive local experiments.

```text
sample_rate: 44100
bit_depth: 16
peak_ceiling_dbfs: -0.1
normalize: false or minimal
warning: may clip or trigger loudness/readiness warnings
```

---

## ProvenanceGuard

`ProvenanceGuard` is the local authorship and reproducibility layer.

It exists to answer:

```text
What generated this audio?
With what data?
With what parameters?
From what engine?
At what code version?
Does the app locally recognize it as unique compared with prior app outputs?
Is the audio technically clean enough for a conservative stem export?
```

It does not answer:

```text
Does an external platform guarantee acceptance?
Is this legally copyrightable in every jurisdiction?
Does this bypass any detector?
```

The local collision catalog lives at:

```text
APP/artifacts/catalog.jsonl
```

It compares new fingerprints against previous local outputs from this app only.

---

## Determinism contract

The app’s deterministic contract is strict:

1. No hidden randomness.
2. No network calls.
3. No wall-clock time in render hashes.
4. Canonical JSON for parameter hashing.
5. Stable ordering of dictionary keys and event streams.
6. Centralized WAV writing.
7. Fixed PCM quantization rules.
8. All mutation is seed-derived.
9. Every render gets a manifest.
10. Every render can be regenerated from its manifest inputs.

Canonical JSON should use:

```python
json.dumps(
    obj,
    sort_keys=True,
    separators=(",", ":"),
    ensure_ascii=False,
)
```

Creative mutation should be deterministic:

```text
render_seed = sha256(base_seed + identity_seed + mutation_index + engine_name)
```

Changing `mutation_index` should change the sound while preserving reproducibility.

---

## Localhost API

Expected MVP routes:

```text
GET  /
GET  /api/engines
POST /api/upload
POST /api/render
GET  /api/jobs/{job_id}
GET  /api/jobs/{job_id}/audio.wav
GET  /api/jobs/{job_id}/manifest.json
GET  /api/jobs/{job_id}/fingerprint.json
GET  /api/jobs/{job_id}/upload_readiness.json
GET  /api/jobs/{job_id}/README_ORIGIN.txt
POST /api/derivatives
```

Security rules:

- serve on `127.0.0.1` by default
- never serve arbitrary filesystem paths
- sanitize filenames
- write only under `APP/artifacts/`
- do not run shell commands from request parameters
- do not make external network calls

---

## Browser UI

The browser UI should be simple, dark, and usable.

Recommended sections:

```text
Header
Seed Mode
Engine selector
Engine parameter controls
Export profile selector
Preset cards
Render button
Audio player
Manifest/hash panel
Upload readiness panel
Download provenance bundle links
Derivative Track Mode
Warnings / claim boundaries
```

Required warning text:

```text
ProvenanceGuard documents original generation and local uniqueness. It does not guarantee acceptance by any external platform.
```

---

## Input types

MVP inputs:

```text
CSV
JSON
binary files
PNG/JPG/WebP images, if image decoding is available
WAV/MP3 derivative tracks for local lineage documentation
```

Future inputs:

```text
FITS files
spectral cubes
spaxel data
QEC event streams
graph data
geospatial paths
MIDI export
```

---

## Testing

Run:

```bash
python -m pytest APP/tests
```

Important tests:

```text
same params produce same PCM hash
same params produce same WAV hash
mutation_index changes WAV hash
manifest hash is stable
fingerprint hash is stable
upload readiness catches clipping/full-scale audio
HTTP routes serve the UI and render endpoint
no network imports are present
all generated artifacts stay under APP/artifacts/
```

The no-network test should reject APP code that imports or uses external clients such as:

```text
requests
urllib.request
httpx
aiohttp
openai
anthropic
```

The localhost server may use `http.server` and `socketserver` for `127.0.0.1` serving.

---

## Symbolic art mode

Some SPECTRAL presets use mythic, biological, mathematical, or cosmological language as part of their artistic interface.

For example, `e8_cosmovirus` may refer to:

```text
E8
φ
DIAG (1,-2,1)
triality
Ouroboros
cosmovirus
HPV16 symbolic layer
Sumerian symbolic layer
```

These are treated as **creative symbolic metadata only**.

Required metadata boundary:

```json
{
  "mode": "SYMBOLIC_ART_MODE",
  "claim_boundary": "creative symbolic metadata only; not biomedical, archaeological, or scientific proof"
}
```

Do not represent symbolic presets as medical, archaeological, or scientific validation.

---

## Development notes

Preferred MVP implementation:

- Python stdlib first
- optional NumPy for faster synthesis/fingerprinting
- optional Pillow for image decoding
- no heavy frontend framework
- no external services
- no telemetry
- no generated WAVs committed to git

Large generated audio files should remain local under `APP/artifacts/`.

---

## Troubleshooting

### The browser cannot connect

Make sure the app is running:

```bash
python APP/run_app.py
```

Then open:

```text
http://127.0.0.1:8765
```

### A render sounds clipped or harsh

Use the `Suno Seed Export` profile or lower engine gain. Check `upload_readiness.json` for clipping and peak warnings.

### The same settings do not produce the same hash

Check for:

- nondeterministic random calls
- wall-clock values included in render inputs
- unordered data structures
- dependency/version differences
- non-canonical JSON serialization

### Image upload fails

Install or enable Pillow, or use CSV/JSON/binary engines until image decoding is available.

### Upload readiness says `archive_only`

That does not mean the audio is bad. It means the render is better treated as an experimental/local artifact rather than a conservative source-stem export.

---

## Roadmap

Planned follow-ups:

- richer image sonification
- FITS/spaxel cube adapter
- waveform and spectrogram display
- optional NumPy FFT spectral fingerprints
- preset morphing
- A/B render comparison
- MIDI export
- WebAudio preview synth
- QEC event-stream adapter
- geospatial sonification
- SPECTRAL 3D visualizer bridge
- provenance bundle ZIP export

---

## License and ownership notes

This app generates deterministic audio from user-provided data, local parameters, and original synthesis engines.

Users are responsible for ensuring they have rights to any uploaded source files or derivative tracks they import into the local lineage system.

ProvenanceGuard helps document origin. It does not replace legal review.
