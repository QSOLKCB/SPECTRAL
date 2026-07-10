# QSOL-IMC Spectral Sonification — Architectural Constitution

## Canonical Engineering Constitution — v1.0

**Location:** `SPECTRAL/SONIFICATION/`

This document governs **all AI-assisted activity** inside the `SONIFICATION/` directory and any code generated for the QSOL-IMC Spectral Data Synth / SpectralForge project.

This is the **constitutional layer** for deterministic sonification tooling.

All code generation, refactoring, feature addition, testing, and architectural decisions **must** obey this file.

This is not guidance.  
This is **law** for the Genius layer.

---

## Core System Principle

```text
same input data + same parameters + same seed
    → same canonical ordering
    → same canonical form
    → same hash
    → same bytes (WAV / MIDI / contract JSON)
    → same proof
```

**Violation invalidates the result.**

Every sonification is a **provable artifact**.

---

## Core Values

1. **Determinism** — First, always, non-negotiable.
2. **Reproducibility** — Byte-for-byte replay from contract.
3. **Contract Integrity** — Every render produces a verifiable Observation Contract.
4. **Mathematical Transparency** — E8, qutrit, Fibonacci, Euclidean, spectral methods preferred over heuristics.
5. **Safety over Cleverness** — Correctness and replay safety beat performance or "magic".
6. **Scientific + Creative Power** — This tool serves both rigorous research and deep artistic work.
7. **Minimal Complexity** — Smallest viable implementation that still satisfies the laws.

---

## 0. Operating Model — Deterministic Direct Work

- Work directly toward working, validated code.
- Prefer minimal, single-purpose changes.
- Every significant change that touches identity, contracts, hashing, or core synthesis **must** be validated before considered complete.
- Tags and clear commit messages define boundaries.

---

## 1. Determinism is Architecture (HARD INVARIANT)

### Forbidden in Core Layers
- Any use of `random`, `np.random`, `secrets`, or time-based entropy **unless**:
  - Explicitly seeded from a contract-recorded value, **and**
  - The seed + method are written into the Observation Contract.
- Wall-clock dependence in render pipelines.
- Implicit dict ordering or set ordering.
- Async or threading that affects output ordering.

### Required
- Canonical ordering of all arrays, dicts, and sequences before hashing or serialization.
- Stable, deterministic serialization (canonical JSON).
- All transformations are pure or explicitly state-captured.
- Every render path must be replayable from the exported contract alone.

---

## 2. Identity Law for Sonification Artifacts

Identity is the root of truth for every data snapshot, render, and contract.

**Rules:**
- Every meaningful artifact (data array after transforms, final WAV render, MIDI sequence, full render contract) **must** be able to produce a stable identity via `canonical_hash_identity` or equivalent.
- Identity must be:
  - Sorted (where applicable)
  - Unique within its scope
  - Derived from canonical form only
- Identity is **never** inferred or reconstructed after the fact.

Invalid or unstable identity = invalid sonification result.

---

## 3. Hashing & Proof Law

**Rules:**
- All hashes for contracts and receipts are computed over **canonical JSON**.
- Keys must be sorted.
- Compact separators, UTF-8 encoding.
- Self-referential hash fields (e.g. `"self_hash"`) **must be excluded** from the hash computation that produces them.
- Hashes must recompute exactly on replay. Mismatch → `ValueError("INVALID_CONTRACT_OR_RENDER")`.

**Guarantee:** A contract + the same code version must always produce identical output bytes.

---

## 4. Contract & Provenance Law (Core of the Genius)

This project’s primary deliverable is not just audio — it is a **verifiable sonification contract**.

**Every render must produce:**
- A complete `ObservationContract` / `RenderReceipt` (JSON) containing:
  - Input identity (hash of original data/text/image + metadata)
  - Full ordered list of transformations + exact parameters used
  - All seeds (explicitly recorded)
  - Synth engine parameters and version
  - Output hashes (WAV, MIDI, any stems)
  - Provenance chain (what produced this contract)
  - Timestamp (for human reference only — not used in determinism)
  - Code version / git commit (recommended)

**Rules:**
- Contracts are **immutable** once created.
- Contracts are **self-verifying** (replay the contract → must match recorded output hashes).
- The `genius.py` core is responsible for building, validating, and exporting these contracts.
- GUI and CLI are consumers of the core contract system — they must not bypass it.

A render without a valid accompanying contract is considered incomplete.

---

## 5. Synth Engine & Core Mapping Protection

The following are treated as **high-integrity zones** (similar to decoder protection in QEC):

- `core/genius.py`
- `core/data_processor.py` (all transform functions)
- `core/mapper.py` (pitch, rhythm, modulation mapping)
- `synth/engine.py`, `synth/oscillator.py`, `synth/envelope.py`, `synth/filter.py`

**Rules:**
- Changes here trigger full Validation Escalation (see below).
- No ad-hoc randomness or hidden state.
- All mapping from data → musical parameters must be deterministic and documented.
- Wavetable / spectral frame generation from data must be canonical and replayable.

Higher layers (GUI, some IO) may depend on these but **must never** modify core behavior without going through the contract system.

---

## 6. Validation Law (Escalation Rule)

Validation is **conditionally mandatory** and triggered by impact on invariants.

### Mandatory Full Validation Triggered When Touching:
- `contracts.py` or any contract / receipt logic
- `canonical_hash_identity` or identity-bearing structures
- Hashing or canonical JSON logic
- Core data transforms in `data_processor.py`
- Synth engine core (`engine.py`, `oscillator.py`, etc.)
- Mapper logic that affects pitch/rhythm determinism
- Any change that affects replayability or contract contents

**When triggered, you MUST:**
1. Run the full test suite: `pytest -q`
2. Run any dedicated replay / contract verification tests
3. Fix any breakage caused by the change
4. Confirm that example contracts still replay correctly

If full validation is not performed when required → **the change is invalid**.

### Local / Module Testing
When escalation is **not** triggered, module-level tests are acceptable, **but** you must re-evaluate escalation before any commit that could affect contracts or determinism.

---

## 7. Layering & Import Discipline (Lightweight but Strict)

Proposed initial layering (respect this direction):

| Layer       | Path                        | Role                              | Import Rules                     |
|-------------|-----------------------------|-----------------------------------|----------------------------------|
| Core (Sacred) | `qsol_spectral_data_synth/core/` | Genius, contracts, processor, mapper | Never imports higher layers     |
| Synth       | `qsol_spectral_data_synth/synth/` | Engine, oscillators, envelopes, filters | Only imports from core          |
| IO          | `qsol_spectral_data_synth/io/`   | Loaders, exporters, MIDI patterns | Imports core + synth            |
| Viz         | `qsol_spectral_data_synth/viz/`  | Plots, previews                   | Imports core + synth            |
| GUI         | `qsol_spectral_data_synth/gui/`  | DearPyGui application             | Highest layer — can depend on all |
| CLI         | `cli.py`                    | Typer interface                   | Thin wrapper over core          |

**Hard Rules:**
- Lower layers **never** import higher layers.
- No circular imports.
- Core must remain importable in complete isolation for headless/pipeline use.
- GUI and CLI are allowed to be richer but must delegate all deterministic work to the core.

---

## 8. Integration with SPECTRAL & QEC

- This tool lives in the `SPECTRAL` ecosystem and should feel native.
- Prefer using or extending existing SPECTRAL modules (E8, fractal power, qutrit morphing, etc.) for modulation and timbre generation where mathematically appropriate.
- Contracts and identity mechanisms should be designed for potential future compatibility or data exchange with the QEC repository’s proof and receipt systems.
- When in doubt, favor mathematical constructions that align with E8 triality, Coxeter geometry, Fibonacci, and spectral algebraics.

---

## 9. Minimal Diff & Commit Discipline

- Smallest viable change that preserves all invariants.
- Single-purpose commits.
- No refactor noise mixed with feature work.
- Every commit that touches escalated areas must have evidence of validation (test output or explicit statement).

---

## 10. Test Discipline

Required test categories for this project:
- Deterministic replay tests (contract → identical output)
- Hash stability tests
- Identity canonicalization tests
- Boundary + edge-case tests (empty data, extreme values, large images, etc.)
- Invariant tests (ordering, no upward leakage, contract self-verification)
- Golden-master style tests for key example renders

---

## Final Law

> If it cannot be reproduced **byte-for-byte** from the exported contract using the same code version,
> it is not a valid sonification result.

This law applies to every WAV, every MIDI file, every modulation sequence, and every contract produced by this system.

---

**End of Constitution**

When working in this directory, internalize these principles.  
The goal is not just to build a cool data synth — it is to build one worthy of the QSOL-IMC name: rigorous, reproducible, mathematically grounded, and creatively liberating.
