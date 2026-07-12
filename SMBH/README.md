## SPECTRAL Photon-Sphere Sonification Laboratory 1.0
A deterministic auditory model of photon-sphere and whispering-gallery modes in a curved optical black-hole analogue.

**A zero-install, browser-native laboratory for sonifying photon-sphere and whispering-gallery mode families from Xu et al.'s curved optical microcavity, with an explicitly separate Kerr 220 extension.**

Open `index.html` directly in a modern browser. There is no server, Python runtime, Node runtime, package manager, build step, CDN, telemetry, or network request.

## Start

1. Download the `SMBH/` folder without changing its internal paths.
2. Double-click `index.html`.
3. Choose an engine, scene, determinism mode, and mapping parameters.
4. Render, listen, inspect the waveform and spectrogram, then export the provenance artifacts.

Open `tests/index.html` to run the browser-native known-answer checks.

## What this app emulates

Xu et al. fabricated a dye-doped, 3D-printed curved optical microcavity whose two-dimensional Fermat metric is derived from Schwarzschild spacetime and preserves the spatial projection of its null geodesics. Their analysis and experiment identify:

- photon-sphere modes (PSMs) localized around the unstable circular orbit at the waist;
- whispering-gallery modes (WGMs) confined near boundaries by total internal reflection;
- a waist-selective pump configuration that reveals PSM lasing;
- an edge-selective configuration dominated by the outer WGM;
- a uniform-pump configuration dominated by the lowest-loss outer WGM.

The browser turns those mode-family relationships into audible oscillators. It does **not** recreate the fabrication process, solve the full eigenproblem or Maxwell field, simulate dye gain and threshold competition, or recover an experimental time-domain ringdown.

## Experimental data and auditory mapping

| Family | Paper optical path | Paper-derived diameter | Default audio | Default Q |
|---|---:|---:|---:|---:|
| Photon sphere | 217 µm | 44.3 µm | 400.0 Hz | 65 |
| Edge WGM | 237 µm | 48.4 µm | 366.24 Hz | 420 |
| Outer WGM | 268 µm | 54.7 µm | 323.88 Hz | 420 |

The optical paths and corresponding diameters are paper-grounded. The 400 Hz anchor and Q values are **sonification assumptions**, not measured values quoted by the paper.

The audible family ratios are derived as

```text
f_audio,i = f_audio,PSM × (nL_PSM / nL_i)
```

because the optical free spectral range is inversely proportional to optical path length. With a 400 Hz PSM anchor:

```text
edge WGM = 400 × 217/237 ≈ 366.24 Hz
outer WGM = 400 × 217/268 ≈ 323.88 Hz
```

For a freely decaying mode, the Replay Safe engine uses

```text
x(t) = A exp(-π f t / Q) sin(2π f t + φ)
```

Canonical Strict uses a versioned integer oscillator and integer one-pole envelope that approximates the same decay while prioritising byte reproducibility.

## Scenes

### Xu optical analogue

- **PSM pure ringdown** and **outer WGM pure ringdown** isolate the audible damping contrast.
- **PSM**, **edge-WGM**, and **outer-WGM mode-family combs** render partial stacks whose spacing follows the selected audible family fundamental.
- **Selective → edge → uniform pump** is a constructed auditory montage of the three separate Figure 4 configurations. It is not an experimental time trace.
- **Analogue laboratory narrative** is a pedagogical sequence with PSM, WGM, coexistence, sustained, and decay sections. Its timeline is aesthetic.
- **Virtual pump-position scan** uses an explicit Gaussian overlap model to crossfade family amplitudes. It is not a laser rate-equation solver.

### Kerr 220 extension

The Kerr engine is deliberately segregated because Xu et al. implement a non-rotating, uncharged Schwarzschild analogue. It uses a common analytic fit for the co-rotating fundamental 220 mode to make increasing spin audible as rising pitch and increasing Q. Its overtone is illustrative, not a precision Kerr spectrum.

See `docs/PHYSICS_BOUNDARIES.md` for the formulas and limitations.

## Determinism modes

### Canonical Strict

- integer identity-bearing controls;
- 32-bit phase accumulator;
- integer Bhaskara sine approximation;
- integer envelope recurrence with a fixed rational approximation to π;
- explicit PCM16 quantisation and little-endian RIFF/WAV writing;
- bundled canonical JSON and SHA-256;
- no runtime fingerprint in the recipe;
- identical settings are intended to produce identical bytes.

Canonical Strict prioritises a stable signal ABI. It is not automatically the more physically accurate mode.

### Replay Safe

- Float64 sine and exponential DSP;
- deterministic seeded starting phases;
- explicit PCM16 quantisation and WAV writing;
- browser/runtime fingerprint bound into the recipe;
- intended for same-runtime replay and scientific exploration.

## Exported artifacts

Every successful render creates:

- `*.wav` — stereo PCM16 audio;
- `*.manifest.json` — recipe, hashes, citation, mode table, and claim boundary;
- `*.recipe.json` — normalized identity-bearing settings;
- `*.fingerprint.json` — recipe, PCM, and WAV identities;
- `*.modes.csv` — human-readable mode-family values and evidence notes.

Manifest replay loads all normalized settings, re-renders, and fails closed if the WAV or contract identity differs.

## Relationship to UFF

The UFF repository supplied a useful conceptual precedent: a deterministic data-to-pitch pipeline, phase accumulation, PCM16 WAV output, fixed seeds, explicit units, and inspectable analysis. Its present `uff_model.py` describes its circular-velocity law as a placeholder galaxy rotation-curve model. UFF therefore does **not** provide the photon-sphere microcavity physics and is not represented as doing so here.

The SMBH app reuses the philosophy:

```text
source data → derived quantities → audible mapping → oscillator plan → WAV
```

The actual source layer is independently bound to Xu et al.'s optical-path measurements and the app's declared assumptions.

## Scientific claim boundary

- The scientists did not perform this sonification; the app is a downstream auditory interpretation.
- Optical QNMs are used in the open-cavity optics sense. They have a rigorous structural analogy to gravitational QNMs but are not literally a LIGO waveform.
- The paper states that PSM Q is lower than the first-order WGM family, while PSM Q can be comparable to or exceed higher-order WGMs. The two default Q controls are pedagogical.
- The partial stack is not the experiment's large azimuthal number `l ≈ 371–383` rewritten as ordinary harmonics. It is a perceptual representation of a regular spectral family.
- Optional echo, stereo, sustained sections, and all scene timelines are non-physical presentation layers.
- Kerr is an independent theoretical extension and must not be cited as a result of Xu et al.

## Source citation

> Xu et al. (2026). *Photon-Sphere Modes in Curved Optical Microcavities: A Black-Hole Analogue Laser*. Advanced Science, 13, e17466. https://doi.org/10.1002/advs.202517466

Important paper locations:

- Equations 1–3: Schwarzschild and Fermat metrics.
- Equation 5: Jacobi equation and orbit stability.
- Equation 6: massless Klein–Gordon equation.
- Figure 3: numerical mode families and Q-factor comparison.
- Section 3.1 and Figure 4: selective and uniform pumping, optical-path peaks, and direct mode observations.
- Section 3.2 and Figure 5: spatial PSM profile and comparison with theory.

## Files

```text
SMBH/
  index.html
  app.js
  style.css
  README.md
  LICENSE.txt
  datasets/
    xu2026_mode_table.csv
  docs/
    PHYSICS_BOUNDARIES.md
  tests/
    index.html
    test-runner.js
```

## Static offline audit

From the SPECTRAL repository root:

```bash
rg -n --pcre2 -g '*.js' -g '*.html' '\bfetch\s*\(|new\s+XMLHttpRequest|new\s+WebSocket|EventSource\s*\(|sendBeacon\s*\(' SMBH

rg -n --pcre2 -g '*.html' -g '*.css' "(?i)(src|href)\s*=\s*['\"](?:https?:)?//" SMBH

find SMBH -type f \( -name package.json -o -name package-lock.json -o -name yarn.lock -o -name pnpm-lock.yaml \)
```

Expected: no production network client, remote asset, or package-manager file.

## License

MIT License. See `LICENSE.txt` and the SPECTRAL repository-root license.

Copyright © 2026 Trent Slade / QSOL-IMC.
