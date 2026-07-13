# SPECTRAL

**Deterministic sonification, creative audible geometry, spectral analysis, and reproducible source-stem generation.**

[![DOI: Spectral Algebraics](https://zenodo.org/badge/DOI/10.5281/zenodo.21308248.svg)](https://doi.org/10.5281/zenodo.21308248)
[![DOI: Collective Modes v1.2](https://zenodo.org/badge/DOI/10.5281/zenodo.21293821.svg)](https://doi.org/10.5281/zenodo.21293821)
[![DOI: Collective Modes v1.0](https://zenodo.org/badge/DOI/10.5281/zenodo.21292906.svg)](https://doi.org/10.5281/zenodo.21292906)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

SPECTRAL is an experimental research and development repository by **Trent Slade / QSOL-IMC**. It explores deterministic, replay-aware, and explicitly creative mappings between data, symbolic structures, mathematical symmetry, signal synthesis, time-frequency analysis, three-dimensional visualization, and audible perception.

The repository combines five zero-install browser applications with Python research scripts, reproducible audio artifacts, visualization experiments, and provenance-oriented workflows. The browser applications run directly from their folders without a server, build system, package manager, cloud service, or network connection.

## Project areas

| Area | Description |
|---|---|
| [APP](APP/) | Browser-native **SPECTRAL Deterministic Sonification Workbench 2.0**. Open `APP/index.html` directlyâ€”no server, Node, npm, build system, or network connection required. Supports Canonical Strict and Replay Safe determinism modes, WAV export, fingerprints, manifests, hashes, and derivative-lineage documentation. |
| [E8/APP](E8/APP/) | Browser-native **SPECTRAL E8 Geometry Studio 1.0**. A fast musical instrument for exploring all 240 E8 roots across an evolving eight-dimensional Cartan torus, with Canonical Deterministic, Replay-Safe, and explicitly Non-Deterministic Creative modes, long-form WAV rendering, scene morphing, spatial variants, and provenance bundles. |
| [E8](E8/) | E8-inspired signal generators, astronomical-data sonification, triality/φ mappings, QEC-oriented event mapping, WAV material, experimental visualization code, and the E8 Geometry Studio above. |
| [SMBH](SMBH/) | Browser-native **SPECTRAL Photon-Sphere Sonification Laboratory 1.0**. Sonifies photon-sphere and whispering-gallery mode relationships from a curved optical black-hole analogue, with a clearly separate Kerr 220 extension, Canonical Strict and Replay Safe modes, WAV/provenance export, and explicit scientific claim boundaries. |
| [QEC/APP](QEC/APP/) | Browser-native **SPECTRAL QEC Sonification Laboratory 1.0**. Uses a Render → Commit → Reveal protocol to sonify Bell, GHZ, W, qutrit, repetition, perfect, Steane, surface-code, and sparse QLDPC models or local QEC event datasets, with deterministic WAV, manifest, event-stream, observation-receipt, and bundle exports. |
| [OMI-ISA](OMI-ISA/) | OMI/XOR/E8 sonification experiments, including XOR-ring and fractal-cosmovirus mappings. |
| [PHOTOACOUSTIC](PHOTOACOUSTIC/) | Browser-native **SPECTRAL Photoacoustic Laboratory 2.0**. A deterministic light-to-sound model and music generator that maps synthetic or local WAV-derived light intensity through explicit optical, thermal, pressure, and resonator stages. |
| [SONIFICATION](SONIFICATION/) | Scripts, datasets, audio, figures, and supporting material associated with the receipt-bound deterministic information-lattice sonification research cited below. |

## Quick start

### Browser applications

```bash
git clone https://github.com/QSOLKCB/SPECTRAL.git
cd SPECTRAL
```

Open any application directly in a modern browser:

```text
APP/index.html                 Deterministic Sonification Workbench 2.0
E8/APP/index.html              E8 Geometry Studio 1.0
SMBH/index.html                Photon-Sphere Sonification Laboratory 1.0
QEC/APP/index.html             QEC Sonification Laboratory 1.0
PHOTOACOUSTIC/index.html       Photoacoustic Laboratory 2.0
```

Each application has a browser-native known-answer or contract suite:

```text
APP/tests/index.html
E8/APP/tests/index.html
SMBH/tests/index.html
QEC/APP/tests/index.html
PHOTOACOUSTIC/tests/index.html
```

See the [Workbench README](APP/README.md), [E8 Geometry Studio README](E8/APP/README.md), [Photon-Sphere Laboratory README](SMBH/README.md), [QEC Sonification Laboratory README](QEC/APP/README.md), and [Photoacoustic Laboratory README](PHOTOACOUSTIC/README.md) for their mappings, determinism contracts, export artifacts, replay rules, privacy boundaries, and acceptance tests.

### Python experiments

Scripts have experiment-specific dependencies. Inspect the selected script before running it; commonly used packages include NumPy, SciPy, Matplotlib, Plotly, and SoundFile.

Example:

```bash
python3 E8/e8_triality_fractal_sonifier.py
```

## Reproducibility

SPECTRAL prioritizes:

- hard separation between cross-runtime deterministic, runtime-bound replay, and explicitly non-deterministic creative synthesis;
- inspectable data-to-sound mappings;
- canonical hashes and provenance manifests;
- versioned engines and render contracts;
- reproducible PCM/WAV artifacts;
- clear separation between source artifacts and creative derivatives;
- explicit scientific and symbolic claim boundaries.

When citing or archiving a generated artifact, retain its application version, engine version, normalized parameters, source hash, recipe or manifest, contract hash, determinism mode, and runtime fingerprint whenever that mode requires one.

## Research scope and claim boundary

Terms such as *E8-inspired*, *Coxeter-inspired*, *triality*, *qutrit*, *Bell-state*, and *quantum-error-correction-style* describe mathematical, computational, or symbolic structures used by individual mappings.

Unless a specific experiment supplies and validates a separate physical method, these terms do **not** claim that generated audio performs physical quantum computation, exactly represents the complete E8 Lie group, proves a biomedical or cosmological hypothesis, or provides empirical evidence for a physical theory.

The SMBH application sonifies a curved optical black-hole analogue and a separately labelled Kerr fit. It does **not** simulate a merger, a gravitational-wave detector, laser gain dynamics, or the complete electromagnetic experiment. The E8 Geometry Studio uses E8 as a control and composition geometry; its audio is not presented as a physical E8 measurement.

The QEC Sonification Laboratory sonifies deterministic classical QEC models or supplied event datasets. Its render-bound observation protocol does **not** perform physical quantum measurement, state tomography, quantum-hardware access, or fault-tolerance validation.

## Publications and datasets

### Spectral Algebraics

[![DOI: 10.5281/zenodo.21308248](https://zenodo.org/badge/DOI/10.5281/zenodo.21308248.svg)](https://doi.org/10.5281/zenodo.21308248)

The primary publication dataset for the E8-inspired audible-geometry, signal-synthesis, spectral-analysis, and 3D-visualization work.

> Slade, T. (2026). *Spectral Algebraics: Audible Geometry via E8-Inspired Signal Synthesis and 3D Visualization* [Dataset]. Zenodo. https://doi.org/10.5281/zenodo.21308248

The repository includes the paper as [spectral_algebraics.pdf](spectral_algebraics.pdf), together with related code, presets, analysis material, and demonstration artifacts.

### Collective Modes and Receipt-Bound Sonification

The [SONIFICATION](SONIFICATION/) materials accompany the following archived versions:

[![DOI: v1.2](https://zenodo.org/badge/DOI/10.5281/zenodo.21293821.svg)](https://doi.org/10.5281/zenodo.21293821)

> Slade, T. (2026). *Collective Modes, Stable Supports, and Observation-Dark Subspaces in Deterministic Information Lattices: Graph Dynamics and a Reproducible Protocol for Receipt-Bound Sonification* (Version v1.2). Zenodo. https://doi.org/10.5281/zenodo.21293821

[![DOI: v1.0](https://zenodo.org/badge/DOI/10.5281/zenodo.21292906.svg)](https://doi.org/10.5281/zenodo.21292906)

> Slade, T. (2026). *Collective Modes, Stable Supports, and Observation-Dark Subspaces in Deterministic Information Lattices: Graph Dynamics and a Reproducible Protocol for Receipt-Bound Sonification* (Version v1.0). Zenodo. https://doi.org/10.5281/zenodo.21292906

For new citations, prefer **v1.2** unless reproducing or discussing the earlier v1.0 release specifically.

## BibTeX

```bibtex
@dataset{slade_spectral_algebraics_2026,
  author    = {Slade, Trent},
  title     = {Spectral Algebraics: Audible Geometry via E8-Inspired Signal Synthesis and 3D Visualization},
  year      = {2026},
  publisher = {Zenodo},
  doi       = {10.5281/zenodo.21308248},
  url       = {https://doi.org/10.5281/zenodo.21308248}
}

@misc{slade_collective_modes_v12_2026,
  author    = {Slade, Trent},
  title     = {Collective Modes, Stable Supports, and Observation-Dark Subspaces in Deterministic Information Lattices: Graph Dynamics and a Reproducible Protocol for Receipt-Bound Sonification},
  year      = {2026},
  version   = {v1.2},
  publisher = {Zenodo},
  doi       = {10.5281/zenodo.21293821},
  url       = {https://doi.org/10.5281/zenodo.21293821}
}

@misc{slade_collective_modes_v10_2026,
  author    = {Slade, Trent},
  title     = {Collective Modes, Stable Supports, and Observation-Dark Subspaces in Deterministic Information Lattices: Graph Dynamics and a Reproducible Protocol for Receipt-Bound Sonification},
  year      = {2026},
  version   = {v1.0},
  publisher = {Zenodo},
  doi       = {10.5281/zenodo.21292906},
  url       = {https://doi.org/10.5281/zenodo.21292906}
}
```

## Applications

Potential uses include scientific and engineering data sonification, accessibility-oriented data representation, deterministic source-stem generation, anomaly exploration, QEC-style event-stream monitoring, mathematical and curved-space education, audible-geometry composition, generative-audio research, provenance-aware creative production, installations, laboratory instruments, embedded systems, and physical devices.

## Creator

**Trent Slade**  
QSOL-IMC / LostSound Technologies  
ORCID: [0009-0002-4515-9237](https://orcid.org/0009-0002-4515-9237)

## License

SPECTRAL is licensed under the [MIT License](LICENSE). It may be used, copied, modified, merged, published, distributed, sublicensed, sold, commercialized, and incorporated into software or physical systems, provided the copyright and permission notices are retained.

## Status

SPECTRAL is active experimental research software. Interfaces, engines, schemas, presets, and research claims may evolve. For archival work, use the cited Zenodo records and retain the exact versions and provenance artifacts associated with each render.
