Photoacoustic Sonifier / Music Generator
========================================
Simulate the photoacoustic (PA) effect to create music and experimental sounds
from "light" intensity modulations. Inspired by simple soot-jar transducers
that let you literally hear light (modulated intensity -> thermal expansion -> pressure waves).

Physics model (simplified, audio-rate):
  1. Light intensity I(t) [0..1 or bipolar AC] is absorbed by material (soot/gas/solid).
  2. Heat capacity + thermal losses -> temperature T(t) via low-pass (RC-like thermal inertia).
  3. Thermal expansion / Grüneisen parameter produces pressure p ~ Γ · β · ΔT  (or rate of change).
  4. Cavity / jar / resonator filters the pressure (band-pass or multi-mode resonances).
  5. Resulting acoustic pressure is the audible "sound of light".

You can:
  - Feed any WAV as the light modulation and hear it through different "materials" + resonators.
  - Generate synthetic light (tones, chords, pulse trains, Fibonacci rhythms, industrial sequences).
  - Apply post-FX (distortion from high intensity, reverb, EQ, chorus-ish) to sculpt new timbres.
  - Tweak parameters for different materials, laser powers, cavity sizes → totally different sounds.

Deterministic, pure NumPy/SciPy, no recursion/heuristics. Clean, commented, easy to extend.
Author-friendly for QEC-style validation: every stage is pure functions + explicit params.

Usage examples:
  python photoacoustic_sonifier.py --mode demo --out artifacts/
  python photoacoustic_sonifier.py --mode generate --preset industrial_fib --duration 30 --out my_pa.wav
  python photoacoustic_sonifier.py --mode through --input my_song.wav --material soot --resonator jar --fx reverb,dist --out heard_light.wav
  python photoacoustic_sonifier.py --list-presets

Dependencies: numpy, scipy, soundfile  (pip install if needed)
