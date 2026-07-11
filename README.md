# SPECTRAL

**Deterministic sonification, audible geometry, spectral analysis, and reproducible source-stem generation.**

[![DOI: Spectral Algebraics](https://zenodo.org/badge/DOI/10.5281/zenodo.21308248.svg)](https://doi.org/10.5281/zenodo.21308248)
[![DOI: Collective Modes v1.2](https://zenodo.org/badge/DOI/10.5281/zenodo.21293821.svg)](https://doi.org/10.5281/zenodo.21293821)
[![DOI: Collective Modes v1.0](https://zenodo.org/badge/DOI/10.5281/zenodo.21292906.svg)](https://doi.org/10.5281/zenodo.21292906)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

SPECTRAL is an experimental research and development repository by **Trent Slade / QSOL-IMC**. It explores deterministic and replay-aware mappings between data, symbolic structures, mathematical symmetry, signal synthesis, time-frequency analysis, three-dimensional visualization, and audible perception.

The repository combines a zero-install browser workbench with Python research scripts, reproducible audio artifacts, visualization experiments, and provenance-oriented workflows.

## Project areas

| Area | Description |
|---|---|
| [APP](APP/) | Browser-native **SPECTRAL Deterministic Sonification Workbench 2.0**. Open `APP/index.html` directly—no server, Node, npm, build system, or network connection required. Supports Canonical Strict and Replay Safe determinism modes, WAV export, fingerprints, manifests, hashes, and derivative-lineage documentation. |
| [E8](E8/) | E8-inspired signal generators, astronomical-data sonification, triality/φ mappings, QEC-oriented event mapping, WAV material, and experimental visualization code. |
| [OMI-ISA](OMI-ISA/) | OMI/XOR/E8 sonification experiments, including XOR-ring and fractal-cosmovirus mappings. |
| [PHOTOACOUSTIC](PHOTOACOUSTIC/) | A simplified deterministic photoacoustic sonifier and music generator that maps modulated light intensity through thermal and resonator models. See the [PHOTOACOUSTIC README](PHOTOACOUSTIC/README.md). |
| [SONIFICATION](SONIFICATION/) | Scripts, datasets, audio, figures, and supporting material associated with the receipt-bound deterministic information-lattice sonification research cited below. |

## Quick start

### Browser workbench

```bash
git clone https://github.com/QSOLKCB/SPECTRAL.git
cd SPECTRAL
```

Open:

```text
APP/index.html
```

For the browser-native known-answer tests, open:

```text
APP/tests/index.html
```

See [APP/README.md](APP/README.md) for the determinism contracts, engine registry, supported inputs, export profiles, provenance artifacts, replay workflow, privacy model, and acceptance tests.

### Python experiments

Scripts have experiment-specific dependencies. Inspect the selected script before running it; commonly used packages include NumPy, SciPy, Matplotlib, Plotly, and SoundFile.

Example:

```bash
python3 E8/e8_triality_fractal_sonifier.py
```

## Reproducibility

SPECTRAL prioritizes:

- deterministic or explicitly replay-scoped synthesis;
- inspectable data-to-sound mappings;
- canonical hashes and provenance manifests;
- versioned engines and render contracts;
- reproducible PCM/WAV artifacts;
- clear separation between source artifacts and creative derivatives;
- explicit scientific and symbolic claim boundaries.

When citing or archiving a generated artifact, retain its application version, engine version, normalized parameters, source hash, recipe or manifest, contract hash, and determinism mode whenever available.

## Research scope and claim boundary

Terms such as *E8-inspired*, *Coxeter-inspired*, *triality*, *qutrit*, *Bell-state*, and *quantum-error-correction-style* describe mathematical, computational, or symbolic structures used by individual mappings.

Unless a specific experiment supplies and validates a separate physical method, these terms do **not** claim that generated audio performs physical quantum computation, exactly represents the complete E8 Lie group, proves a biomedical or cosmological hypothesis, or provides empirical evidence for a physical theory.

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

Potential uses include scientific and engineering data sonification, accessibility-oriented data representation, deterministic source-stem generation, anomaly exploration, QEC-style event-stream monitoring, mathematical education, generative-audio research, provenance-aware creative production, installations, laboratory instruments, embedded systems, and physical devices.

## Creator

**Trent Slade**  
QSOL-IMC / LostSound Technologies  
ORCID: [0009-0002-4515-9237](https://orcid.org/0009-0002-4515-9237)

## License

SPECTRAL is licensed under the [Apache License 2.0](LICENSE). It may be used, modified, distributed, commercialized, and incorporated into software or physical systems subject to the license terms, including preservation of the required notices.

## Status

SPECTRAL is active experimental research software. Interfaces, engines, schemas, presets, and research claims may evolve. For archival work, use the cited Zenodo records and retain the exact versions and provenance artifacts associated with each render.
