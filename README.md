Spectral Algebraics Publication

Spectral Algebraics: Audible Geometry via E8-Inspired Signal Synthesis and
3D Visualization

Author: Trent Slade
Affiliation: QSOL-IMC / LostSound Technologies
ORCID: 0009-0002-4515-9237

The original work explores mappings between E8-inspired algebraic structures,
algorithmic signal synthesis, time-frequency analysis, and three-dimensional
visualization.

Generated waveforms are analysed through short-time Fourier transforms.
Amplitude is represented as spatial topology, while instantaneous phase can
be mapped into colour. The resulting visual and sonic structures provide an
experimental form of audible geometry in which mathematical mappings may
be inspected through both sound and visualization.

Paper
Read the PDF
Open the Zenodo record
Dataset

The Zenodo record includes research materials associated with the
publication, including combinations of:

the paper;
demonstration audio;
WAV and compressed listening examples;
spectral-analysis data;
spectrogram imagery;
preset definitions;
and supporting documentation.
Repository Structure
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

The exact collection will continue to evolve as new engines, datasets,
fixtures, analyses, and deterministic render profiles are added.

Quick Start
Browser-native workflow
git clone https://github.com/QSOLKCB/SPECTRAL.git
cd SPECTRAL

Then open:

APP/index.html

No local server is necessary.

Python workflow

Clone the repository and inspect the selected script:

git clone https://github.com/QSOLKCB/SPECTRAL.git
cd SPECTRAL
python3 E8/e8_triality_fractal_sonifier.py

Some scripts may require packages such as NumPy, SciPy, Matplotlib, Plotly,
or audio-writing libraries. Requirements are script-specific rather than
defined as a single repository-wide environment.

Research Scope and Claim Boundary

SPECTRAL investigates deterministic and replay-aware mappings between:

numerical data;
symbolic structures;
signal synthesis;
spectral analysis;
mathematical symmetry;
error-correction-style event streams;
visual geometry;
and audible perception.

Terms such as E8-inspired, Coxeter-inspired, qutrit, triality,
and quantum-error-correction-style describe the mathematical or symbolic
structures used by individual mappings.

Unless an experiment explicitly demonstrates otherwise, these terms should
not be interpreted as claims that generated audio constitutes a physical
quantum computation, an exact representation of the complete E8 Lie group,
or empirical evidence for a physical theory.

SPECTRAL prioritizes reproducibility, transparent mappings, explicit claim
boundaries, and inspectable artifacts.

Applications

Potential applications include:

scientific and engineering data sonification;
deterministic source-stem generation;
accessibility-oriented data representation;
QEC event-stream monitoring;
anomaly and pattern exploration;
mathematical and educational visualization;
generative audio research;
provenance-aware creative production;
embedded sonification systems;
laboratory instruments;
museum and installation systems;
and physical hardware implementations.
Preset Pack

The original Producer.ai preset specification is retained as:

E8_Spectral_Algebraics_PresetPack.md

It documents the experimental E8 Spectral Algebraics tri-preset concept,
including:

Coxeter Orbit;
φ-Pulse Grit;
and E8 Pad Swell.

The preset document is a conceptual and production artifact. The current
browser Workbench implements its own versioned engines, parameters, render
contracts, and export pipeline.

Citation
Plain text
Slade, Trent. Spectral Algebraics: Audible Geometry via E8-Inspired
Signal Synthesis and 3D Visualization. QSOL-IMC, 2026.
https://doi.org/10.5281/zenodo.21308248
BibTeX
@dataset{slade_spectral_algebraics_2026,
  author       = {Slade, Trent},
  title        = {Spectral Algebraics: Audible Geometry via E8-Inspired
                  Signal Synthesis and 3D Visualization},
  year         = {2026},
  publisher    = {Zenodo},
  doi          = {10.5281/zenodo.21308248},
  url          = {https://doi.org/10.5281/zenodo.21308248}
}

When citing a particular generated artifact, also retain its SPECTRAL
manifest, engine version, recipe identifier, and contract hash where
available.

Creator

Trent Slade
QSOL-IMC
ORCID: 0009-0002-4515-9237

License

SPECTRAL is released under the MIT License.

You may use, copy, modify, merge, publish, distribute, sublicense, sell,
commercialize, or incorporate the software into proprietary software,
embedded systems, scientific instruments, and physical devices, provided
that the required copyright and permission notice is retained.

See LICENSE.txt.

Licensing Philosophy

SPECTRAL is licensed permissively to encourage scientific, educational,
creative, industrial, commercial, and governmental adoption.

The project may be incorporated into software, hardware, embedded devices,
research infrastructure, and manufactured systems while preserving
attribution to the original author.

Status

SPECTRAL is an active experimental research and development repository.

Interfaces, engines, schemas, presets, and research claims may evolve.
For archival or publication use, retain the exact application version,
engine version, source hashes, manifest, and observation contract associated
with a render.
