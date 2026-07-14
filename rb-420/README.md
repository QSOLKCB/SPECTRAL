# RB-420 Acid Tracker Workstation

**A zero-install browser groovebox, deterministic loop recorder, Impulse-style tracker, and seeded guitar/synth laboratory.**

RB-420 combines the immediate feel of a classic dual-acid groovebox with a visual piano-roll editor, a two-mode 30-second PCM recorder, an eight-channel tracker, and a deterministic sound-design laboratory.

Everything runs locally by opening `index.html`. There is no server, Node runtime, npm package, build step, framework, CDN, cloud service, account, telemetry, cookie, or network request.

## Start

1. Download or clone the repository.
2. Open `rb-420/index.html` in a modern desktop browser.
3. Press **PLAY** once to initialize Web Audio.
4. Program a pattern, render or record a loop, then send it to the Tracker.

Chrome/Chromium and Firefox are the primary targets. Safari should run the workstation, but live PCM capture support depends on its Web Audio implementation.

## Workstation sections

### 1. Groovebox

- two monophonic acid synthesizers with saw/square oscillators
- 16-step note, accent, and slide programming
- independent cutoff, resonance, envelope modulation, decay, accent, level, mute, and solo controls
- algorithmic 808-style and 909-style drum voices—no commercial samples
- kick, snare, closed/open hats, clap, and rim lanes
- Euclidean rhythm generator for every drum lane
- seeded pattern mutation
- distortion, pattern-style master filter, ping-pong delay, feedback, wet mix, and compression
- live oscilloscope and level meter

On an acid step:

- click toggles the note
- Shift-click adds or toggles accent
- Alt-click adds or toggles slide

### 2. Pattern Master

The Pattern Master view replaces hardware-style pitch buttons with a large piano roll designed specifically for the two acid lanes.

- click a cell to place or remove a note
- Shift-click places an accented note
- Alt-click places a sliding note
- edit note, gate, accent, and slide in the step inspector
- copy, paste, clear, transpose, and create seeded variations
- import/export open `.rb420-pattern.json` files

#### About original `.rbs` files

RB-420 does **not** rename JSON as `.rbs` or claim binary compatibility with ReBirth songs. Original `.rbs` is a versioned IFF-style song container with device banks, automation, and arrangement data. A safe importer/exporter needs a separately tested, clean-room implementation and licensed fixtures. The native RB-420 pattern/project formats are deliberately open and human-readable.

### 3. Two-mode 30-second recorder

The recorder has two explicitly different contracts.

#### Deterministic Render

- freezes BPM, swing, seed, patterns, synth parameters, drum lanes, effects, tracker rows, and sample identities
- renders with the bundled seeded PCM engine at 44.1 or 48 kHz
- writes stereo PCM16 little-endian WAV directly
- supports any duration from 1 to 30 seconds
- exports a JSON recipe containing the complete reproducible project state and PCM digest
- the same recipe under the same RB-420 renderer version is intended to reproduce the same PCM loop

This is a deterministic creative-render contract, not the stronger cross-runtime **SPECTRAL Canonical Strict** contract. The recipe identifies the renderer and app version so intentional engine changes remain visible.

#### Live Performance

- captures the workstation’s live Web Audio output to PCM
- includes real-time knob moves, mutes, solos, pattern changes, and tracker playback
- stops automatically at the chosen duration, up to 30 seconds
- exports PCM16 WAV
- is intentionally take-specific and therefore has no deterministic recipe

Use **Send to Tracker** after either kind of recording. RB-420 creates a sample instrument and places it on channel 1, row 00.

### 4. Tracker

The tracker uses an original eight-channel interface inspired by the fast keyboard workflow of Impulse Tracker and Schism Tracker.

Each channel contains:

```text
NOTE · INSTRUMENT · VOLUME · EFFECT
```

Features:

- 32- or 64-row patterns
- 2, 4, or 8 rows per beat
- 16 sample/instrument slots
- PCM16 WAV import without browser decoding when the source is standard PCM16
- browser-decoded import fallback for other supported audio formats
- deterministic tracker-only loop render
- horizontal channel panning during live playback

Keyboard entry:

- `Z S X D C V G B H N J M` — chromatic notes from C4
- `Q 2 W 3 E R 5 T 6 Y 7 U I` — next octave
- arrow keys — move through rows, channels, and columns
- Delete, Backspace, or `.` — clear the selected field
- `+` / `-` — change volume in the volume column
- letter keys — enter a tracker effect code in the effect column
- Space — start or stop the global transport

Effect codes are currently stored as project data for forward compatibility. The first release does not execute arbitrary Impulse Tracker effect commands.

### 5. Sound Lab

Sound Lab creates new loop material without bundled samples.

- seeded Karplus–Strong-style plucked guitar
- saw/square analog-style synth lane
- triangle sub-bass lane
- seeded metal/noise texture lane
- selectable root, scale, octave, style, and one/two/four-bar length
- Acid Rock, Machine Funk, Dark Country, Industrial, and Tracker Core pattern characters
- drive and stereo space controls
- deterministic WAV output and direct Tracker transfer

### 6. Project

- save/load `.rb420.json` projects
- embedded PCM samples use base64 so the project remains one portable file
- project name, author, and notes
- musical-state summary
- undo/redo for pattern-oriented edits

Large projects with many 30-second samples produce correspondingly large JSON files. WAVs remain available separately from the Recorder and Sound Lab.

## Determinism boundary

Identity-bearing deterministic renders use:

- a fixed sample rate selected before rendering
- a fixed frame count rather than a wall clock
- seeded XorShift32 noise
- explicit PCM16 quantization and clipping
- explicit RIFF/WAVE little-endian packing
- stable-key recipe serialization
- a deterministic FNV-1a receipt for quick local identity checks

The live Web Audio path is for performance and monitoring. AudioContext sample rate, browser scheduling, device latency, ScriptProcessor callback timing, and interactive moves do not enter the deterministic renderer.

Imported standard PCM16 WAV data can participate directly in deterministic tracker rendering. Other formats are decoded through the browser; the decoded PCM is then frozen into the RB-420 sample slot and identified by its PCM digest.

## Privacy and security

The application’s Content Security Policy disables network connections and remote assets. It uses only local browser capabilities:

- Web Audio
- Canvas
- File and Blob APIs
- typed arrays and ArrayBuffers
- local object URLs for downloads

No source file or audio data leaves the computer.

## Tests

Open `tests/index.html` directly to run the browser-native DSP suite.

The suite checks:

- identical recipes produce identical PCM
- seed changes alter identity-bearing PCM
- PCM16 WAV encode/decode round trips exactly
- deterministic recipe IDs remain stable
- Sound Lab generation replays exactly
- malformed WAV data fails closed

The main workstation also runs a short deterministic render and WAV round-trip self-check during startup. A passing result is exposed as `data-self-test="passed"` on the document root for diagnostics.

## Directory structure

```text
rb-420/
├── index.html
├── style.css
├── app.js
├── README.md
├── LICENSE.txt
├── THIRD_PARTY.md
├── js/
│   ├── dsp.js
│   └── engine.js
└── tests/
    ├── index.html
    └── tests.js
```

## Independence and trademarks

RB-420 is an original browser instrument inspired by classic acid-groovebox and tracker workflows. It contains no code, binary assets, samples, skins, trade dress, or proprietary file fixtures from ReBirth RB-338, Roland hardware, Pattern Master, Impulse Tracker, or Schism Tracker.

ReBirth and Reason are associated with Reason Studios. Roland, TB-303, TR-808, and TR-909 are associated with Roland Corporation. Impulse Tracker and Schism Tracker belong to their respective authors and communities. Names are used descriptively; no affiliation or endorsement is implied.

## Licence

RB-420 is supplied under the MIT License. See `LICENSE.txt`.
