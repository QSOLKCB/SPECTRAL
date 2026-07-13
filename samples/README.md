# SPECTRAL E8 Sample Library

**E8-inspired one-shots, industrial loops, evolving dark-synth sources, and an inspectable offline generator.**

[![Audio: WAV 44.1 kHz](https://img.shields.io/badge/audio-WAV%2044.1%20kHz-5b5bd6.svg)](#audio-format)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](../LICENSE)
[![DOI: Spectral Algebraics](https://zenodo.org/badge/DOI/10.5281/zenodo.21308248.svg)](https://doi.org/10.5281/zenodo.21308248)

This directory is the ready-to-use sample library for [SPECTRAL](../README.md). It contains **36 WAV files** across four ZIP archives: 15 one-shots and short textures, 13 tempo-aligned industrial loops, and eight long-form dark-synth renders. Together, the packs provide approximately six minutes of source audio plus three JPEG artwork files.

No installation is required to use the audio. Download a pack, extract it, and import the WAV files into a DAW, sampler, audio editor, granular engine, or other music-production workflow.

## Download the packs

| Archive | Contents | Audio format | Size |
|---|---|---|---:|
| [E8_Sample_Pack.zip](E8_Sample_Pack.zip) | 15 percussion, impact, bass, stab, glitch, and texture samples | 44.1 kHz, 16-bit PCM, mono | 0.90 MB |
| [E8_Industrial_Loops.zip](E8_Industrial_Loops.zip) | 13 industrial loops and beds at 128 BPM, plus three JPEG artwork files | 44.1 kHz, 16-bit PCM, mono | 11.34 MB |
| [E8_Dark_Synth_Bundle.zip](E8_Dark_Synth_Bundle.zip) | Dark-synth renders 01–05 | 44.1 kHz, 16-bit PCM, stereo | 18.03 MB |
| [E8_Dark_Synth_Bundle_2.zip](E8_Dark_Synth_Bundle_2.zip) | Dark-synth renders 06–08 | 44.1 kHz, 16-bit PCM, stereo | 10.79 MB |

The two dark-synth archives are consecutive parts of one eight-render collection produced by the included generator.

## Quick start

Clone the repository if you want every pack and the generator:

```bash
git clone https://github.com/QSOLKCB/SPECTRAL.git
cd SPECTRAL/samples
```

Extract only the archive you need, for example:

```bash
unzip E8_Sample_Pack.zip
unzip E8_Industrial_Loops.zip
```

The industrial archive expands into `E8_Industrial_Suno_v2/`, with separate `loops/` and `art/` directories.

## Pack contents

### E8 Sample Pack

A compact set of 15 mono one-shots and short source textures.

| File | Material | Duration |
|---|---|---:|
| `01_E8_Lattice_Kick.wav` | Kick | 0.60 s |
| `02_Triality_Snare.wav` | Snare | 0.45 s |
| `03_Root_Closed_Hat.wav` | Closed hi-hat | 0.12 s |
| `04_Root_Open_Hat.wav` | Open hi-hat | 0.35 s |
| `05_Exceptional_Metal_Hit_A.wav` | Metallic hit A | 0.95 s |
| `06_Exceptional_Metal_Hit_B.wav` | Metallic hit B | 1.10 s |
| `07_Hammer_Impact.wav` | Hammer impact | 0.35 s |
| `08_E8_16th_Bass_OneShot.wav` | Sixteenth-note bass hit | 0.35 s |
| `09_EBM_8th_Bass_OneShot.wav` | EBM eighth-note bass hit | 0.70 s |
| `10_Virus_FM_Stab.wav` | FM synth stab | 0.55 s |
| `11_Microwave_Icy_Stab.wav` | Icy digital stab | 0.70 s |
| `12_Arp_Loop_128BPM_E8.wav` | Short 128 BPM arpeggio loop | 2.00 s |
| `13_Scrap_Noise_Texture.wav` | Scrap-noise texture | 1.80 s |
| `14_Singularity_Glitch.wav` | Glitch texture | 1.20 s |
| `15_PalmMute_Chug_Hit.wav` | Palm-muted chug hit | 0.55 s |

Use these as a drum kit, layer them beneath existing percussion, resample them into instruments, or process them into new transient and texture families.

### E8 Industrial Loops

This archive contains 13 mono loops and beds. Its four-, six-, and eight-bar durations align to a **128 BPM, 4/4 grid**.

| File | Bars | Duration |
|---|---:|---:|
| `01_E8_4OTF_Drum_Loop_8bars_128BPM.wav` | 8 | 15.00 s |
| `02_E8_Hammer_Drum_Loop_8bars_128BPM.wav` | 8 | 15.00 s |
| `03_E8_16th_Bass_Loop_8bars_128BPM.wav` | 8 | 15.00 s |
| `04_E8_EBM_8th_Bass_Loop_8bars_128BPM.wav` | 8 | 15.00 s |
| `05_E8_Virus_Arp_Loop_8bars_128BPM.wav` | 8 | 15.00 s |
| `06_E8_Microwave_Icy_Loop_8bars_128BPM.wav` | 8 | 15.00 s |
| `07_E8_PalmMute_Guitar_Loop_8bars_128BPM.wav` | 8 | 15.00 s |
| `08_E8_Full_Hybrid_Groove_8bars_128BPM.wav` | 8 | 15.00 s |
| `09_E8_Metal_Hit_Scrap_Bed_8bars.wav` | 8 | 15.00 s |
| `10_E8_Singularity_Glitch_Bed_6bars.wav` | 6 | 11.25 s |
| `11_E8_Industrial_Metal_Groove_8bars_128BPM.wav` | 8 | 15.00 s |
| `12_E8_Texture_Scrap_Loop_4bars.wav` | 4 | 7.50 s |
| `13_E8_Arp_Plus_Drums_Hybrid_4bars.wav` | 4 | 7.50 s |

The archive also includes:

- `art/cover.jpg`
- `art/drum_machine.jpg`
- `art/lattice_gears.jpg`

Set the project tempo to 128 BPM before importing the loops. For other tempos, use your DAW's time-stretching or warping mode. Reduce channel gain before stacking several full-spectrum loops to preserve headroom.

### E8 Dark Synth Bundle — Parts 1 and 2

These eight stereo renders explore progressively unstable and corrupted synthesis processes. The first five files are in `E8_Dark_Synth_Bundle.zip`; files 06–08 continue the set in `E8_Dark_Synth_Bundle_2.zip`.

| File | Principal sound-design mapping | Duration |
|---|---|---:|
| `01_e8_instability_detune_unison.wav` | Uneven unison, detuning, and slow pitch instability | 22.00 s |
| `02_e8_chaos_layer_noise_dist.wav` | Noise layers, distortion, and noise-driven modulation | 20.50 s |
| `03_e8_subtle_chaos_micro.wav` | Stacked micro-pitch, unison, and FM inconsistencies | 24.00 s |
| `04_e8_filter_corruptions.wav` | Parallel filters moving at independent rates | 21.00 s |
| `05_e8_fm_gone_wrong.wav` | Deliberately non-integer FM ratios and evolving modulation index | 19.50 s |
| `06_e8_triality_drone_stack.wav` | Long-form composite drone combining the major processes | 28.00 s |
| `07_e8_doom_chaos_lead.wav` | Aggressive detuned lead with distorted-noise corruption | 18.00 s |
| `08_e8_roots_pulse_sequence.wav` | Root-projection pitch sequence with pulsed articulation | 18.50 s |

The dark-synth files are source material rather than tempo-locked loops. They work well as drones, intros, transitions, resampling sources, spectral layers, granular material, and raw stems for industrial, dark ambient, cybercore, EBM, and experimental electronic production.

## Included generator

[`scripts/e8_dark_synth_bundle_generator.py`](scripts/e8_dark_synth_bundle_generator.py) is the inspectable Python source used to render the eight dark-synth files.

The generator:

- constructs the standard 240-root realization of the E8 root system;
- derives a deterministic control bank from absolute root projections and related transforms;
- maps those values into base frequencies, detuning, LFO rates, FM ratios, filter motion, and modulation depths;
- uses a fixed NumPy random seed, `0xE8`;
- combines uneven unison, slow pitch drift, white and pink noise, waveshaping, non-integer FM, and independently moving filters;
- renders offline at A4 = 432 Hz and 44.1 kHz as 16-bit stereo PCM WAV.

The golden ratio and `1 + sqrt(2)` also appear as artistic scaling constants. They are part of the mapping design, not a claim that those constants or the resulting timbres provide a unique or canonical representation of E8.

### Run the generator

From the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install numpy scipy
python3 samples/scripts/e8_dark_synth_bundle_generator.py
```

The script writes eight WAV files, `metadata.json`, and a generated `README.md` into `samples/scripts/`, because its output directory is the script's own directory. It does not assemble the two ZIP archives automatically.

### Determinism boundary

The generator is seeded and algorithmically repeatable, but it does not implement the SPECTRAL browser applications' Canonical Strict or Replay Safe render contracts. For archival reproduction, record the Python, NumPy, and SciPy versions together with the operating system and output hashes.

Floating-point and DSP-library differences may affect byte-for-byte output across environments. The generated metadata also contains a UTC creation timestamp, so its bytes change from run to run even when the synthesis settings are unchanged.

## Audio format

| Collection | Sample rate | Encoding | Channels | Duration range |
|---|---:|---|---:|---:|
| One-shots and short textures | 44.1 kHz | 16-bit signed PCM WAV | Mono | 0.12–2.00 s |
| Industrial loops | 44.1 kHz | 16-bit signed PCM WAV | Mono | 7.50–15.00 s |
| Dark-synth renders | 44.1 kHz | 16-bit signed PCM WAV | Stereo | 18.00–28.00 s |

## Scientific and creative scope

These packs use **E8-inspired parameter mapping** as a compositional and sonification framework. They are not recordings of a physical E8 system, an exact auditory encoding of the complete E8 Lie group, evidence for a physical theory, or the only valid way to sonify E8 geometry.

The value of the collection lies in making the mapping inspectable: the mathematical source, control transforms, DSP operations, generated audio, and practical creative outputs can be examined separately.

## Archive verification

SHA-256 hashes for the archives currently on the `main` branch:

```text
f554a4138178ce180d94684b0987e9f2441ed1d04fd5fc37fac7b037387accbc  E8_Dark_Synth_Bundle.zip
93d8b2276d2505777b9ede0dcca974fe9bda85befce185126e9ef48d55eb799b  E8_Dark_Synth_Bundle_2.zip
5d30e5abb0a79b88dd4e0a570983fc45dd0610f35ff7dd8de2c9bf1f9175f6d5  E8_Industrial_Loops.zip
b0fe8b65f85beccb9bc95b0b6a986c83d4e5811b9529f54d78878e876bd46adc  E8_Sample_Pack.zip
```

Verify a downloaded archive on Linux or macOS with:

```bash
sha256sum E8_Sample_Pack.zip
```

Update this section whenever an archive is rebuilt or repackaged.

## Research context

The broader E8-inspired sonification and visualization work is archived as:

> Slade, T. (2026). *Spectral Algebraics: Audible Geometry via E8-Inspired Signal Synthesis and 3D Visualization* [Dataset]. Zenodo. <https://doi.org/10.5281/zenodo.21308248>

## License

Unless a file states otherwise, this directory is distributed under the repository's [MIT License](../LICENSE). The license permits use, modification, redistribution, and commercial use, subject to its copyright-notice and permission-notice requirements.

When redistributing a pack or a substantial portion of it, retain the repository's copyright and license notice. Attribution in musical releases is appreciated:

```text
SPECTRAL E8 Sample Library — Trent Slade / QSOL-IMC
https://github.com/QSOLKCB/SPECTRAL
```

## Creator

**Trent Slade**  
**QSOL-IMC**

Part of the [SPECTRAL deterministic sonification and audible-geometry project](../README.md).
