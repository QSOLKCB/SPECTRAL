# Scientific Boundaries

## What the laboratory does

SPECTRAL QEC Sonification Laboratory converts deterministic classical representations of quantum-error-correction experiments into audible and visual artifacts.

Its internal models represent named source-state signatures, stabilizer or parity-check operators, seeded Pauli or qutrit-shift error events, classical syndrome values, compact decoder actions, post-recovery residuals, and explicit data-to-audio mappings.

The Render–Commit–Reveal protocol makes an outcome unavailable in the interface until the corresponding WAV, event stream, recipe, hashes, and observation receipt have been constructed.

## Meaning of “observation”

“Observation” is a software protocol term. It describes when generated or dataset-derived values become visible to the user.

It does not mean:

- a quantum system was measured;
- a wavefunction collapsed;
- a browser prepared a Bell, GHZ, W, or qutrit state;
- amplitudes were estimated through tomography;
- a quantum processor supplied telemetry.

The protocol is useful because it binds listening, inspection, and provenance to the same immutable render identity.

## Model scope

The Bell and GHZ observers are parity-listening models. The repetition, five-qubit, Steane, surface, QLDPC, and qutrit models implement compact classical check and recovery projections.

They are suitable for deterministic sonification research, auditory display design, teaching and exploratory listening, event-dataset inspection, reproducible music-source generation, and testing receipt-bound research workflows.

They are not suitable by themselves for predicting a particular hardware device, claiming thresholds or logical error rates, certifying a decoder, benchmarking fault tolerance, or validating experimental QEC results.

## Visualizations

The amplitude constellation is a symbolic view of the selected named state signature. The syndrome lattice is derived from the classical event model or supplied dataset. The waveform and time-frequency view are computed from the rendered PCM.

None is a physical oscilloscope, spectrum analyser attached to quantum hardware, or tomography display.

## Reproducibility

Reproducibility covers the software inputs, normalized event representation, audio mapping, WAV bytes, manifests, and hashes. It does not establish empirical reproducibility of a physical quantum experiment.

## Recommended citation language

Appropriate:

> A deterministic classical sonification of a QEC event model using a render-bound observation protocol.

Avoid:

> A recording of a quantum state collapsing.

> Audio measured directly from a quantum computer.

> Experimental proof that this decoder corrects a hardware code.
