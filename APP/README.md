# SPECTRAL Deterministic Sonification Workbench 2.0

**Original deterministic source stems for audible geometry â€” entirely inside the browser.**

SPECTRAL 2.0 is a zero-install, dependency-free DHTML application for turning local data, images, byte streams, QEC-style events, and symbolic E8/Ï† engines into reproducible PCM16 WAV files with provenance receipts.

There is no server, localhost process, Python runtime, Node runtime, package manager, build step, CDN, cloud service, telemetry, or network request. The browser is the application runtime.

## Start the workbench

1. Download or clone the repository.
2. Open `APP/index.html` in a modern browser by double-clicking it.
3. Choose a determinism mode and engine.
4. Optionally drop a local source file.
5. Choose the seed, mutation index, duration, and export profile.
6. Render.

The app continues to work with the computer offline. All source bytes, decoded pixels, generated PCM, hashes, manifests, catalog entries, and job history remain in the browser.

Run the browser-native known-answer suite by opening `APP/tests/index.html`, or use **RUN SELF-TESTS** in the footer. The suite deliberately reloads itself once to verify that a full job-shaped IndexedDB record survives the actual `file://` page lifecycle.

## The two determinism contracts

### Canonical Strict

Canonical Strict is the archival and publication path.

- signed interleaved PCM16 is the signal ABI
- 32-bit integer phase accumulators schedule oscillators
- gains and modulation use explicit fixed-point integers
- profile normalization, fades, clipping, and WAV packing have explicit rounding
- all RIFF fields are written with `DataView` in little-endian order
- WAV files contain no timestamp, encoder tag, or browser metadata
- canonical JSON accepts only nulls, booleans, strings, arrays, plain objects, and safe integers
- a bundled bitwise SHA-256 implementation defines hashing even when Web Crypto is unavailable under `file://`
- WebAudio is playback only; it never supplies identity-bearing samples
- runtime observations do not enter the strict recipe
- long renders advance through fixed sample-count chunks with event-loop yields and cancellation checks; chunk boundaries never enter DSP state or identity

The intended guarantee is:

```text
same app version
+ same engine version
+ same determinism mode
+ same normalized parameters
+ same export-profile version
+ same seed and mutation index
+ same source bytes
= same PCM payload, WAV bytes, fingerprint, recipe, and contract
```

### Replay Safe

Replay Safe is the creative iteration path.

- deterministic float64 JavaScript DSP is allowed
- explicit PCM16 quantization still produces downloadable WAV bytes
- no nondeterministic entropy or hidden mutable engine state is allowed
- the runtime fingerprint is recorded and participates in the recipe identity
- the replay promise is scoped to the same recorded runtime

The determinism mode is in the domain-separated recipe preimage. Strict and Replay Safe can never share a SPECTRAL recipe or contract identity, even in the degenerate case where two PCM payloads happen to match.

## Initial engine registry

| Engine | Canonical Strict | Replay Safe | Purpose |
|---|---:|---:|---|
| `omi_xor_ring` | Yes | Yes | XOR/rotation orbits and hard-edged byte-state textures |
| `e8_cosmovirus` | Yes | Yes | Triality, Ï† lanes, DIAG events, Fibonacci gates, Ouroboros feedback |
| `e8_bell` | Yes | Yes | Bell-parity phase mappings and rational Ï† harmonic ladders |
| `qec_triality` | Yes | Yes | Numeric/QEC event streams mapped through `[1,-2,1]` triality lanes |
| `spectral_algebraics` | Yes | Yes | Coxeter/Ï†/qutrit macro synthesis with seeded entropy bloom |
| `image_scan` | No | Yes | Luminance, DIAG-edge, and radial pixel scanning |
| `data_mapper` | Yes | Yes | General CSV, JSON, text-number, and binary mapping |

`image_scan` is intentionally Replay Safe. Native PNG/JPEG/WEBP decode, color management, and image codecs can vary between browsers. SPECTRAL refuses to label browser-decoded pixels Canonical Strict without a separately specified canonical image decoder.

Every engine descriptor declares its ID, display name, version, supported modes, parameter schema, presets, default export profile, claim boundary, and tone-plan compiler. New engines register through `js/engines/registry.js`; no central switch statement needs redesign.

## Inputs

The local input surface accepts:

- CSV and TSV
- JSON
- plain text and pasted text
- arbitrary binary and byte streams
- PNG
- JPEG
- WEBP

Raw source bytes are SHA-256 hashed before rendering. A literal filename, filesystem path, file modification time, UI selection, or wall clock is never part of render identity. The detected input adapter (`tabular`, `json`, `text`, `binary`, or `image`) is identity-bearing because it determines how the same bytes are interpreted. Renaming a source preserves identity when it does not change that detected adapter; changing an extension from, for example, `.bin` to `.txt` intentionally changes the recipe.

Text-like inputs are decoded as UTF-8 and normalized into signed fixed-point integers. The versioned CSV/TSV adapter respects quoted fields and maps only cells that are entirely numeric. The JSON adapter validates the document and maps JSON number tokens while ignoring digits in keys and string labels. Plain text intentionally uses decimal-token extraction. Binary sources expose canonical byte values. Adapter selection is based only on canonical filename-extension rules, never an OS/browser MIME guess. Image Scan uses a nearest-neighbour, bounded Canvas decode for Replay Safe mapping while the raw compressed file hash remains in provenance. If an image is routed into a generic Strict `data_mapper` or `qec_triality` engine, those engines map the raw compressed bytesâ€”not browser-decoded pixels.

## Export profiles

| Profile | Rate | Ceiling | Intent |
|---|---:|---:|---|
| Archive | 44.1 kHz PCM16 stereo | âˆ’0.70 dBFS | clean preservation and analysis |
| Suno Seed Export | 48 kHz PCM16 stereo | âˆ’6.00 dBFS | conservative original source-stem headroom |
| Brutalist | 44.1 kHz PCM16 stereo | âˆ’0.10 dBFS | aggressive local experiments |

**Suno Seed Export is not a detector bypass or copyright-evasion feature.** It is a conservative technical profile for original, user-owned source material. ProvenanceGuard documents generation and local identity; it cannot guarantee that any external platform will accept an upload.

## Every render

The Downloads panel exposes:

```text
audio.wav
manifest.json
fingerprint.json
upload_readiness.json
derivation_graph.json
README_ORIGIN.txt
```

It also creates a deterministic, uncompressed provenance ZIP containing the six files. ZIP entries are sorted lexically, use fixed DOS epoch fields, contain no comments or extra fields, and use explicit CRC-32 values.

### Render recipe

The recipe freezes all identity-bearing inputs before synthesis:

- application and engine versions
- canonical JSON, parser, DSP, PRNG, and WAV-writer versions
- determinism mode
- seed and mutation index
- duration in integer samples
- normalized engine parameters
- fully expanded export profile
- source hash and byte length
- Replay Safe runtime hash when applicable

### Observation contract

The contract records:

- recipe hash
- source hashes
- PCM payload hash
- canonical WAV hash
- fingerprint hash
- backend/ABI
- sample format
- replay requirements
- engine claim boundary

Hashing is domain separated:

```text
SPECTRAL/RECIPE/v2\0       + canonical recipe bytes
SPECTRAL/FINGERPRINT/v2\0  + canonical fingerprint bytes
SPECTRAL/CONTRACT/v2\0     + canonical contract-core bytes
SPECTRAL/MANIFEST-CORE/v2\0 + canonical manifest-core bytes
```

The pipeline has no circular self-hash:

```text
source bytes
  â†’ source hash + normalized recipe
  â†’ PCM + WAV
  â†’ PCM/WAV hashes
  â†’ audio fingerprint + fingerprint hash
  â†’ observation contract + contract hash
  â†’ readiness, derivation, origin receipt
  â†’ manifest envelope
```

`manifest_core_sha256` hashes the manifest core before that field is added. It is not presented as a hash of a file that contains its own hash.

## Manifest replay

Use **REPLAY MANIFEST** beneath Render.

The replay path fails closed unless:

- the manifest schema is supported
- the exact engine version is present
- the selected source hash matches, when the recipe used a source
- the regenerated WAV hash matches
- the regenerated contract hash matches

For a source-backed render, load the original source first and then choose its `manifest.json`. A replay creates a normal persisted job only after verification succeeds.

## Fingerprint and readiness

The fingerprint is local and deterministic. It includes exact content hashes plus integer signal observations:

- peak and RMS
- DC-offset parts per million
- zero-crossing rate
- stereo correlation
- clipping-sample count
- fixed-size PCM chunk hashes
- repeated-exact-chunk observation
- RMS-envelope hash

The local catalog can identify an exact replay of an existing WAV. This observation is displayed beside readiness but is deliberately excluded from `upload_readiness.json`, the manifest, and the deterministic ZIP so browser history cannot alter reproducible artifact bytes. It does not query or imitate YouTube Content ID, Suno, Spotify, or another external matching system.

Upload readiness is an offline advisory for clipping, peak range, DC offset, exact chunk repetition, profile aggressiveness, and bundle completeness. The UI adds the separate non-identity-bearing local replay observation. Neither is legal advice, ownership validation, or an upload guarantee.

## Waveform, spectrogram, transport, and A/B

- Canvas waveform with wheel zoom, drag pan, and Shift-drag selection
- Canvas FFT spectrogram with 256/512/1024/2048 windows
- log- or linear-frequency display
- native local audio transport with seeking and looping
- two in-memory A/B slots for quick render comparison

Visualization uses floating-point math because pixels are observations, not identity. Changing FFT size, frequency scale, zoom, selection, browser size, or playback volume cannot affect generated PCM.

## Derivative lineage

Load or render a seed, then choose a later local audio file in the Lineage panel. SPECTRAL hashes the derivative bytes locally and adds a relationship, user-authorship declaration, and optional note to `derivation_graph.json`.

The seed contract remains immutable. The derivation graph is also embedded in the manifest envelope, so a lineage-updated manifest can replay its seed and reconstruct the exact documented bundle without needing derivative audio bytes again. Updating derivative documentation updates the derivation artifact, manifest-core receipt, and downloadable ZIP without pretending the derivative existed at seed-render time.

## Local storage

SPECTRAL uses IndexedDB for jobs, presets, contracts, fingerprint records, canonical WAV bytes, and history. PCM payload views and deterministic ZIPs are reconstructed from the one stored WAV plus the receipt documents, avoiding three copies of the same audio in browser quota. The most recent 24 jobs are retained by default, and old jobs are evicted before a new write. A completed render remains playable and downloadable even if persistence fails. Refreshing the same `index.html` retains jobs when the browser permits IndexedDB for local-file origins.

Browser handling of `file://` storage is implementation-dependent. If IndexedDB is rejected, the header displays **STORAGE Â· SESSION ONLY** and the app continues with an explicit in-memory fallback. Moving the APP directory or using a different browser profile may also produce a different local-file storage origin.

No cookies are created.

## Security and privacy

The production source contains no network client. It uses no remote assets, fonts, services, analytics, workers, or service worker. `index.html` and the test page include a restrictive Content Security Policy with `connect-src 'none'`.

Allowed browser capabilities are limited to local application functions:

- File and Blob APIs
- Canvas
- native audio playback
- IndexedDB
- typed arrays and ArrayBuffers
- local object URLs
- optional clipboard write permission for the Copy button

The ordinary paste textarea works without privileged clipboard-read permission.

## Directory layout

```text
APP/
  index.html
  style.css
  app.js
  README.md
  AGENTS.md
  CLAUDE.md
  LICENSE-NOTICE.txt
  js/
    core/
      namespace.js
      canonical.js
      input.js
    audio/
      dsp.js
      wav.js
      zip.js
    engines/
      registry.js
      symbolic.js
      data.js
    provenance/
      artifacts.js
    storage/
      database.js
    ui/
      waveform.js
      spectrogram.js
      workbench.js
  tests/
    index.html
    test-runner.js
```

Classic deferred scripts are intentional. ES-module imports are inconsistently allowed between local files, so SPECTRAL modules attach versioned APIs to the single `window.SPECTRAL` namespace in a fixed dependency order.

## Test and acceptance workflow

Open `tests/index.html` directly. The self-test page checks:

- standard SHA-256 vectors
- UTF-8 bytes
- canonical JSON ordering and invalid-value rejection
- exact decimal scaling and rounding
- PRNG known answers
- hand-built PCM16 WAV bytes and hash
- deterministic ZIP bytes and hash
- required engine registry entries
- the Image Scan strict-mode safety gate
- repeated strict-render byte equality
- mutation changes PCM/WAV/fingerprint/contract identity
- mode changes recipe and contract identity
- manifest replay equality, full receipt-layer tamper rejection, lineage-manifest replay, and changed-source rejection
- CSV, JSON, text, and binary source-backed golden vectors
- raw-byte isolation for images routed through generic Strict engines
- cancellable chunked rendering without partial artifacts
- isolation of browser-history/catalog observations from deterministic artifacts
- isolated IndexedDB full-job ArrayBuffer write, close, reopen, read, and delete when available
- a real same-page reload persistence check (the browser suite fails rather than silently skipping when `file://` IndexedDB is unavailable)
- absence of remote resource loads

For publication-grade Canonical Strict claims, run the same golden suite in current Chromium, Firefox, Safari, and Edge builds and compare strict hashes. A browser update that changes Replay Safe output requires a new runtime fingerprint, not a retroactive strict claim.

Static audit examples from the repository root:

```bash
rg -n --pcre2 -g '*.js' -g '*.html' \
  '\bfetch\s*\(|new\s+XMLHttpRequest|new\s+WebSocket|EventSource\s*\(|sendBeacon\s*\(' APP

rg -n --pcre2 -g '*.html' -g '*.css' \
  '(?i)(src|href)\s*=\s*["'"'](?:https?:)?//' APP

find APP -maxdepth 2 -type f \
  \( -name package.json -o -name 'package-lock.json' -o -name 'yarn.lock' -o -name 'pnpm-lock.yaml' \)
```

Expected result: no application network client, no remote HTML/CSS asset, and no package-manager file.

## Claim boundaries

Some engines use E8, Ï†, Bell-state, QEC, cosmovirus, biological, mythic, or cosmological terminology as an artistic interface. Unless a source dataset and separate scientific method establish otherwise, those labels are creative symbolic metadata onlyâ€”not biomedical, archaeological, experimental-physics, or scientific proof.

Users are responsible for the rights to any source or derivative file they select.

## License

The APP source is part of the SPECTRAL repository and is distributed under its Apache License 2.0. See the repository-root `LICENSE` and `APP/LICENSE-NOTICE.txt`.
