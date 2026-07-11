````markdown
# SPECTRAL

## Deterministic Sonification, Audible Geometry, and Reproducible Signal Synthesis

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.21308248.svg)](https://doi.org/10.5281/zenodo.21308248)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.txt)
[![Browser App](https://img.shields.io/badge/SPECTRAL-Workbench%202.0-6f42c1)](APP/)
[![ORCID](https://img.shields.io/badge/ORCID-0009--0002--4515--9237-a6ce39)](https://orcid.org/0009-0002-4515-9237)

**SPECTRAL** is an open framework for deterministic data sonification,
E8-inspired signal synthesis, audible geometry, provenance-aware WAV
generation, and reproducible audio research.

The repository includes:

- the published **Spectral Algebraics** paper;
- archived research materials associated with its Zenodo DOI;
- Python sonification generators and example WAV files;
- E8-, φ-, triality-, QEC-, astronomical-, image-, and data-driven experiments;
- and the zero-install **SPECTRAL Deterministic Sonification Workbench 2.0**.

> **Zenodo DOI:**  
> [https://doi.org/10.5281/zenodo.21308248](https://doi.org/10.5281/zenodo.21308248)

---

## SPECTRAL Workbench 2.0

The primary application is the browser-native workbench located in:

```text
APP/
````

### Launch

1. Download or clone this repository.
2. Open [`APP/index.html`](APP/index.html) in a modern browser.
3. Select a determinism mode and sonification engine.
4. Optionally load a local CSV, JSON, image, text, or binary file.
5. Render and download the resulting WAV and provenance bundle.

No installation is required.

There is:

* no Python requirement;
* no Node.js;
* no npm;
* no build process;
* no server;
* no cloud service;
* no telemetry;
* no external runtime dependency;
* and no network connection required.

The browser is the application runtime.

### Workbench documentation

See:

* [APP README](APP/README.md)
* [Open the Workbench](APP/index.html)
* [Run the Browser Test Suite](APP/tests/index.html)

---

## Two Determinism Modes

### Canonical Strict

Canonical Strict is intended for archival, publication, verification, and
cross-run identity.

It uses explicitly defined integer and fixed-point signal operations,
canonical JSON, deterministic SHA-256 hashing, deterministic PCM16 WAV
packing, and versioned render recipes.

The intended contract is:

```text
same application version
+ same engine version
+ same determinism mode
+ same normalized parameters
+ same export profile
+ same seed and mutation index
+ same source bytes
= same PCM, WAV, hashes, fingerprint, recipe, and contract
```

### Replay Safe

Replay Safe is intended for deterministic creative exploration when an engine
or browser operation cannot make a portable Canonical Strict claim.

It permits deterministic JavaScript floating-point DSP while recording the
runtime environment as part of the replay contract.

Canonical Strict and Replay Safe occupy separate identity domains and cannot
accidentally share the same SPECTRAL recipe or contract identifier.

---

## Workbench Engines

SPECTRAL Workbench 2.0 currently includes engines for:

| Engine                | Purpose                                                              |
| --------------------- | -------------------------------------------------------------------- |
| `spectral_algebraics` | Coxeter-, φ-, and qutrit-inspired macro synthesis                    |
| `e8_cosmovirus`       | Triality lanes, Fibonacci gates, DIAG events, and recursive feedback |
| `e8_bell`             | Bell-parity phase mappings and rational φ harmonic ladders           |
| `qec_triality`        | QEC-style numeric event streams mapped through `[1, -2, 1]` lanes    |
| `omi_xor_ring`        | XOR and rotation orbits with hard-edged byte-state textures          |
| `data_mapper`         | General CSV, JSON, text-number, and binary sonification              |
| `image_scan`          | Replay-safe luminance, edge, radial, and pixel scanning              |

The application can accept:

* CSV and TSV;
* JSON;
* plain text;
* pasted numeric data;
* arbitrary binary files;
* PNG;
* JPEG;
* WEBP;
* symbolic engine presets;
* and QEC-style event streams.

---

## Deterministic Output Bundle

Each completed Workbench render can produce:

```text
audio.wav
manifest.json
fingerprint.json
upload_readiness.json
derivation_graph.json
README_ORIGIN.txt
```

The application can also export these files as a deterministic,
uncompressed provenance ZIP.

The artifacts document:

* source hashes;
* normalized render parameters;
* engine and application versions;
* determinism mode;
* seed and mutation index;
* PCM and WAV hashes;
* audio fingerprint observations;
* replay requirements;
* derivation lineage;
* and the engine’s stated claim boundary.

These records are designed to distinguish an original deterministic
source-stem from later derivatives without pretending to establish legal
ownership or guarantee acceptance by an external platform.

---

## Python Sonification Collection

The repository also contains Python generators and WAV examples developed
during the earlier phases of SPECTRAL.

### [`E8/`](E8/)

The `E8` directory contains E8-inspired and related deterministic
sonification experiments, including generators associated with:

* triality and fractal mappings;
* φ-scaled harmonic systems;
* Coxeter-plane-inspired motion;
* astronomical and cosmological datasets;
* QEC event mappings;
* Bell-style phase relationships;
* and generated WAV source material.

Representative scripts include:

```text
E8/e8_triality_fractal_sonifier.py
E8/qec_v167_sonification_generator.py
E8/m87_e8_fractal_sonification.py
E8/m87_sonify_simple.py
E8/ngc2525_sonify.py
E8/bullet_cluster_e8_sonification.py
E8/sonify_m81.py
```

### [`SONIFICATION/`](SONIFICATION/)

The `SONIFICATION` directory contains earlier general-purpose sonification
scripts, experiments, presets, and generated audio.

Representative entry point:

```text
SONIFICATION/sonify_v1.2.py
```

These Python implementations remain available for:

* inspecting the synthesis process;
* regenerating experimental WAV files;
* modifying mappings;
* conducting offline analysis;
* comparing Python output with browser-native engines;
* and extending the research into new datasets.

Python requirements vary by script. Inspect each script before execution for
its imports, expected input files, and output path.

---

## Spectral Algebraics Publication

**Spectral Algebraics: Audible Geometry via E8-Inspired Signal Synthesis and
3D Visualization**

**Author:** Trent Slade
**Affiliation:** QSOL-IMC / LostSound Technologies
**ORCID:** [0009-0002-4515-9237](https://orcid.org/0009-0002-4515-9237)

The original work explores mappings between E8-inspired algebraic structures,
algorithmic signal synthesis, time-frequency analysis, and three-dimensional
visualization.

Generated waveforms are analysed through short-time Fourier transforms.
Amplitude is represented as spatial topology, while instantaneous phase can
be mapped into colour. The resulting visual and sonic structures provide an
experimental form of **audible geometry** in which mathematical mappings may
be inspected through both sound and visualization.

### Paper

* [Read the PDF](spectral_algebraics.pdf)
* [Open the Zenodo record](https://doi.org/10.5281/zenodo.21308248)

### Dataset

The Zenodo record includes research materials associated with the
publication, including combinations of:

* the paper;
* demonstration audio;
* WAV and compressed listening examples;
* spectral-analysis data;
* spectrogram imagery;
* preset definitions;
* and supporting documentation.

---

## Repository Structure

```text
SPECTRAL/
├── APP/                    # Browser-native Workbench 2.0
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   ├── js/
│   ├── tests/
│   └── README.md
│
├── E8/                     # E8-inspired Python generators and WAV material
├── SONIFICATION/           # General sonification scripts and experiments
├── OMI-ISA/                # OMI/XOR/E8 sonification experiments
├── PHOTOACOUSTIC/          # Photoacoustic sonification work
├── spectral_algebraics.pdf # Published paper
├── LICENSE.txt
└── README.md
```

The exact collection will continue to evolve as new engines, datasets,
fixtures, analyses, and deterministic render profiles are added.

---

## Quick Start

### Browser-native workflow

```bash
git clone https://github.com/QSOLKCB/SPECTRAL.git
cd SPECTRAL
```

Then open:

```text
APP/index.html
```

No local server is necessary.

### Python workflow

Clone the repository and inspect the selected script:

```bash
git clone https://github.com/QSOLKCB/SPECTRAL.git
cd SPECTRAL
python3 E8/e8_triality_fractal_sonifier.py
```

Some scripts may require packages such as NumPy, SciPy, Matplotlib, Plotly,
or audio-writing libraries. Requirements are script-specific rather than
defined as a single repository-wide environment.

---

## Research Scope and Claim Boundary

SPECTRAL investigates deterministic and replay-aware mappings between:

* numerical data;
* symbolic structures;
* signal synthesis;
* spectral analysis;
* mathematical symmetry;
* error-correction-style event streams;
* visual geometry;
* and audible perception.

Terms such as **E8-inspired**, **Coxeter-inspired**, **qutrit**, **triality**,
and **quantum-error-correction-style** describe the mathematical or symbolic
structures used by individual mappings.

Unless an experiment explicitly demonstrates otherwise, these terms should
not be interpreted as claims that generated audio constitutes a physical
quantum computation, an exact representation of the complete E8 Lie group,
or empirical evidence for a physical theory.

SPECTRAL prioritizes reproducibility, transparent mappings, explicit claim
boundaries, and inspectable artifacts.

---

## Applications

Potential applications include:

* scientific and engineering data sonification;
* deterministic source-stem generation;
* accessibility-oriented data representation;
* QEC event-stream monitoring;
* anomaly and pattern exploration;
* mathematical and educational visualization;
* generative audio research;
* provenance-aware creative production;
* embedded sonification systems;
* laboratory instruments;
* museum and installation systems;
* and physical hardware implementations.

---

## Preset Pack

The original Producer.ai preset specification is retained as:

* [`E8_Spectral_Algebraics_PresetPack.md`](E8_Spectral_Algebraics_PresetPack.md)

It documents the experimental **E8 Spectral Algebraics** tri-preset concept,
including:

* `Coxeter Orbit`;
* `φ-Pulse Grit`;
* and `E8 Pad Swell`.

The preset document is a conceptual and production artifact. The current
browser Workbench implements its own versioned engines, parameters, render
contracts, and export pipeline.

---

## Citation

### Plain text

```text
Slade, Trent. Spectral Algebraics: Audible Geometry via E8-Inspired
Signal Synthesis and 3D Visualization. QSOL-IMC, 2026.
https://doi.org/10.5281/zenodo.21308248
```

### BibTeX

```bibtex
@dataset{slade_spectral_algebraics_2026,
  author       = {Slade, Trent},
  title        = {Spectral Algebraics: Audible Geometry via E8-Inspired
                  Signal Synthesis and 3D Visualization},
  year         = {2026},
  publisher    = {Zenodo},
  doi          = {10.5281/zenodo.21308248},
  url          = {https://doi.org/10.5281/zenodo.21308248}
}
```

When citing a particular generated artifact, also retain its SPECTRAL
manifest, engine version, recipe identifier, and contract hash where
available.

---

## Creator

**Trent Slade**
QSOL-IMC
ORCID: [0009-0002-4515-9237](https://orcid.org/0009-0002-4515-9237)

---

## License

SPECTRAL is released under the **MIT License**.

You may use, copy, modify, merge, publish, distribute, sublicense, sell,
commercialize, or incorporate the software into proprietary software,
embedded systems, scientific instruments, and physical devices, provided
that the required copyright and permission notice is retained.

See [`LICENSE.txt`](LICENSE.txt).

### Licensing Philosophy

SPECTRAL is licensed permissively to encourage scientific, educational,
creative, industrial, commercial, and governmental adoption.

The project may be incorporated into software, hardware, embedded devices,
research infrastructure, and manufactured systems while preserving
attribution to the original author.

---

## Status

SPECTRAL is an active experimental research and development repository.

Interfaces, engines, schemas, presets, and research claims may evolve.
For archival or publication use, retain the exact application version,
engine version, source hashes, manifest, and observation contract associated
with a render.

```
- The new MIT licensing intention explicitly covers commercial, governmental, embedded, and physical-device use.
```
