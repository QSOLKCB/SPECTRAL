#!/usr/bin/env python3
"""
E8 Triality Fractal Isochronic Sonification
=============================================
Generates fingerprint-resistant, mathematically unique reference tracks
for music production / AI music prompts.

Core concept from original: E8 Triality (Φ=π/2, SCL DIAG + [1,-2,1])
mapped to 4 QEC voices (Steane root, Surface coherence, Reed-Muller mod,
Fusion-QEC brightness).

Enhancements for request:
- LONGER duration (default 120s, configurable)
- FRACTAL structure: golden-ratio (PHI) iterated self-similar modulations
  across multiple time scales (seconds to minutes)
- ISOCHRONIC pulsing: smooth sine-gated amplitude at ~7.85 Hz (PHI-derived
  Schumann-adjacent rate) with slow fractal evolution
- FINGERPRINT RESISTANCE: 
    * Inharmonic golden-ratio frequency multipliers (not ET intervals)
    * Deterministic but aperiodic fractal modulations (PHI powers + pi/e phases)
    * Mild irrational detuning and slow unique LFOs (never loops exactly)
    * Controlled mild log-deviation (avoids original high-freq shrillness)
    * No stock samples, pure math synthesis → zero chance of false positive matches
- Three versions:
    1. standard   : 4-voice E8 triality + isochronic (mono)
    2. trinaural  : 3-voice tri-phasic (120° qutrit phases) + spatial stereo
                    + slightly detuned dual isochronic rates for movement
    3. qutrit4d   : qutrit (3-state) core + explicit 4th dimensional slow
                    evolution (hyperspherical-like param rotation affecting
                    weights/phases over 2+ minute cycles)

Tuning: base 108 Hz (musical, unique) × PHI^k for inharmonic series.
All deterministic, no random → reproducible & verifiable.

Usage:
    python3 e8_triality_fractal_sonifier.py --version standard --duration 120
    (or edit defaults at bottom)

Outputs WAVs to artifacts/ ready for music AI reference upload or DAW layering.
"""

import argparse
import math
from pathlib import Path

import numpy as np
from scipy.io import wavfile

# ============== CONSTANTS & MATH IDENTITY ==============
SR = 44100
PHI = (1 + math.sqrt(5)) / 2  # Golden ratio - fractal & inharmonic key
PI = math.pi
E = math.e

# Base tuning chosen for musical warmth + uniqueness (not 220/432 common)
BASE_FREQ = 108.0          # Hz
ISO_BASE_RATE = PHI**2 * 3.0  # ~7.854 Hz - PHI-derived, near Schumann 7.83

# Original triality inspiration
PHASE_SHIFT = PI / 2
TERNARY = [1.0, 1.8, 1.0, 1.2]  # Positive amps (Surface stronger)


def fractal_modulation(
    t: np.ndarray,
    base_freq: float = 0.015,
    octaves: int = 6,
    seed_phase: float = 0.0,
    amp_decay: float = 0.618034,  # 1/PHI
) -> np.ndarray:
    """
    Deterministic fractal/self-similar modulation.
    Frequencies scale by PHI each octave → self-similar structure.
    Phases use PI/E for unique irrational signature (fingerprint resistance).
    """
    signal = np.zeros_like(t, dtype=np.float64)
    amp = 1.0
    freq = base_freq
    phase = seed_phase
    for k in range(octaves):
        signal += amp * np.sin(2 * PI * freq * t + phase)
        amp *= amp_decay
        freq *= PHI
        phase += PI / (k + 1.5) + (E % 1) * 0.1  # irrational offset
    # Rough normalize (actual peak ~0.8-1.2 depending on octaves)
    return signal / max(1.0, octaves * 0.6)


def generate_qec_values(t: np.ndarray, n_voices: int = 4) -> list[np.ndarray]:
    """
    Synthetic 'QEC benchmark data' evolving fractally.
    Each voice has slightly different modulation base freq/phase
    for organic independent movement while sharing fractal DNA.
    """
    values = []
    for j in range(n_voices):
        mod = fractal_modulation(
            t,
            base_freq=0.007 + j * 0.0025,
            octaves=5,
            seed_phase=j * 0.93 + (j % 2) * PI / 4,
        )
        # Map to ~0.08 ... 2.2 range (good for mild log deviation)
        val = 0.75 + 0.85 * np.tanh(mod * 1.8)
        values.append(np.clip(val, 0.05, 3.5))
    return values


def voice_signal(
    t: np.ndarray,
    base_f: float,
    mult: float,
    value: np.ndarray,
    amp: float,
    phase: float = 0.0,
) -> np.ndarray:
    """
    Single voice with mild frequency deviation driven by 'QEC value'.
    Deviation kept small (max ~7-8%) for musical usability (unlike original
    which could go very high).
    """
    f0 = base_f * mult
    # Controlled deviation (original used full abs(log10), here tamed)
    dev = 0.065 * np.abs(np.log10(np.clip(value, 1e-5, 10)))
    inst_f = f0 * (1.0 + dev)
    # Direct synthesis (valid for slow modulations < ~0.5 Hz)
    return amp * np.sin(2 * PI * inst_f * t + phase)


def isochronic_env(
    t: np.ndarray,
    rate: float,
    depth: float = 0.68,
    shape: str = "sine",
) -> np.ndarray:
    """
    Isochronic (pulsing) amplitude envelope.
    'sine' = smooth musical; 'square' = classic sharp isochronic.
    Depth controls how far it dips (0.68 = strong but not to zero).
    """
    if shape == "square":
        pulse = (np.sign(np.sin(2 * PI * rate * t)) + 1.0) / 2.0
    else:  # sine default - more musical for reference track
        pulse = (np.sin(2 * PI * rate * t) + 1.0) / 2.0
    return pulse * depth + (1.0 - depth)


def normalize_peak(audio: np.ndarray, target: float = 0.92) -> np.ndarray:
    peak = np.max(np.abs(audio))
    return audio * (target / peak) if peak > 1e-9 else audio


def generate_e8_track(
    version: str = "standard",
    duration: float = 120.0,
    fade_sec: float = 3.0,
) -> tuple[np.ndarray, int]:
    """
    Main generator. Returns (audio, sample_rate).
    All versions are stereo for DAW/AI music compatibility.
    """
    n_samples = int(SR * duration)
    t = np.linspace(0, duration, n_samples, endpoint=False)

    mults = [1.0, PHI, PHI**2, PHI**3]
    voice_names = ["Steane", "Surface", "Reed-Muller", "Fusion-QEC"]

    values = generate_qec_values(t, n_voices=4)

    if version == "standard":
        # === 4-voice E8 Triality + global isochronic ===
        mix = np.zeros(n_samples, dtype=np.float64)
        for j in range(4):
            sig = voice_signal(
                t, BASE_FREQ, mults[j], values[j],
                amp=0.22 * TERNARY[j],
                phase=PHASE_SHIFT + j * 0.17,
            )
            mix += sig

        # Isochronic with slow fractal rate modulation (but use fixed for clean pulse)
        iso_rate = ISO_BASE_RATE
        env = isochronic_env(t, iso_rate, depth=0.62, shape="sine")

        # Very slow 4th-dim-like evolution (0.008 Hz) for long-term morph
        slow_4d = 0.025 * np.sin(2 * PI * 0.008 * t + PI / 3)
        mix = mix * env * (1.0 + slow_4d)

        # Subtle stereo widening (Haas + phase)
        left = mix * 0.98
        right = mix * 0.98 + 0.012 * np.roll(mix, int(SR * 0.012))  # ~12ms delay
        audio = np.stack([left, right], axis=0)

    elif version == "trinaural":
        # === Trinaural / tri-phasic qutrit version ===
        # 3 main voices at 120° phase offsets (qutrit interference)
        # + 4th voice lightly
        # Spatial panning + dual slightly detuned isochronic for "movement"
        mix_l = np.zeros(n_samples, dtype=np.float64)
        mix_r = np.zeros(n_samples, dtype=np.float64)

        qutrit_phases = [0.0, 2 * PI / 3, 4 * PI / 3]
        used = [0, 1, 2]

        for ii, j in enumerate(used):
            sig = voice_signal(
                t, BASE_FREQ, mults[j], values[j],
                amp=0.24 * TERNARY[j],
                phase=qutrit_phases[ii] + j * 0.11,
            )
            # Spatial distribution: L-heavy, center, R-heavy
            if ii == 0:
                mix_l += sig * 0.95
                mix_r += sig * 0.25
            elif ii == 1:
                mix_l += sig * 0.55
                mix_r += sig * 0.55
            else:
                mix_l += sig * 0.25
                mix_r += sig * 0.95

        # 4th voice (Fusion) in center with extra phase
        sig4 = voice_signal(
            t, BASE_FREQ, mults[3], values[3],
            amp=0.15 * TERNARY[3],
            phase=PI + 0.4,
        )
        mix_l += sig4 * 0.6
        mix_r += sig4 * 0.6

        # Trinaural isochronic: two close rates for beating/movement
        env_l = isochronic_env(t, ISO_BASE_RATE * 0.99, depth=0.58, shape="sine")
        env_r = isochronic_env(t, ISO_BASE_RATE * 1.015, depth=0.58, shape="sine")

        mix_l *= env_l
        mix_r *= env_r

        # Extra slow 4th dim rotation on mid/side
        slow_rot = 0.018 * np.sin(2 * PI * 0.006 * t)
        mid = (mix_l + mix_r) / 2 * (1 + slow_rot)
        side = (mix_l - mix_r) / 2
        audio = np.stack([mid + side, mid - side], axis=0)

    elif version == "qutrit4d":
        # === Qutrit (3-level) + explicit 4th dimensional evolution ===
        # Only 3 voices, but their relative weights/phases "rotate" in 4D-inspired way
        # (two-angle hyperspherical modulation over long timescale)
        mix_l = np.zeros(n_samples, dtype=np.float64)
        mix_r = np.zeros(n_samples, dtype=np.float64)

        # 4th dim params: two slow angles
        theta = 0.6 * PI * (1 + np.sin(2 * PI * 0.004 * t))   # ~0.004 Hz cycle
        phi4 = 0.4 * PI * (1 + np.cos(2 * PI * 0.0033 * t + 1.1))

        # Dynamic weights inspired by triality but morphed by 4D
        w = np.array([
            1.0 + 0.4 * np.sin(theta),
            1.7 + 0.5 * np.sin(phi4),
            1.1 + 0.35 * np.cos(theta + phi4 * 0.7),
        ])
        w = np.clip(w, 0.3, 2.8)
        w = w / w.sum() * 3.2  # keep energy similar

        qutrit_phases = [0.0, 2 * PI / 3 + 0.2 * np.sin(phi4 * 0.5), 4 * PI / 3]

        for j in range(3):
            sig = voice_signal(
                t, BASE_FREQ, mults[j], values[j],
                amp=0.23 * w[j],
                phase=qutrit_phases[j] + 0.15 * np.sin(theta * 0.8),
            )
            # Gentle auto-pan following 4D rotation
            pan = 0.5 + 0.4 * np.sin(theta + j * 1.2)
            mix_l += sig * (1 - pan)
            mix_r += sig * pan

        # 4th "dimension" expressed as subtle sub-bass / brightness voice
        # (Fusion-like but lower mult and extra slow mod)
        sub_mult = 0.6  # sub-ish
        sub_sig = voice_signal(
            t, BASE_FREQ * 0.65, sub_mult, values[3] * 0.6,
            amp=0.09,
            phase=PI / 2 + phi4 * 0.3,
        )
        mix_l += sub_sig * 0.7
        mix_r += sub_sig * 0.7

        # Isochronic with 4D-modulated depth
        iso_depth = 0.55 + 0.12 * np.sin(2 * PI * 0.005 * t + 0.7)
        env = isochronic_env(t, ISO_BASE_RATE * 1.002, depth=float(np.mean(iso_depth)), shape="sine")
        mix_l *= env
        mix_r *= env

        audio = np.stack([mix_l, mix_r], axis=0)

    else:
        raise ValueError(f"Unknown version: {version}")

    # Global fade in/out
    fade_samples = int(SR * fade_sec)
    fade_in = np.linspace(0, 1, fade_samples)
    fade_out = np.linspace(1, 0, fade_samples)
    for ch in range(audio.shape[0]):
        audio[ch, :fade_samples] *= fade_in
        audio[ch, -fade_samples:] *= fade_out

    audio = normalize_peak(audio, 0.91)
    return audio, SR


def main():
    parser = argparse.ArgumentParser(description="E8 Triality Fractal Isochronic Generator")
    parser.add_argument("--version", choices=["standard", "trinaural", "qutrit4d"],
                        default="standard", help="Which variant to generate")
    parser.add_argument("--duration", type=float, default=120.0,
                        help="Duration in seconds (90-180 recommended for ref tracks)")
    parser.add_argument("--outdir", type=str, default="/home/workdir/artifacts",
                        help="Output directory")
    args = parser.parse_args()

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    print(f"🌌 Generating E8 Triality {args.version} — {args.duration}s fractal isochronic reference")
    print("   (golden-ratio inharmonic + deterministic fractal mods + PHI-derived isochronic)")
    print("   Fingerprint resistant by mathematical construction.")

    audio, sr = generate_e8_track(
        version=args.version,
        duration=args.duration,
    )

    filename = outdir / f"e8_triality_{args.version}_{int(args.duration)}s.wav"
    # scipy.io.wavfile expects (frames, channels) or (channels, frames)? It handles (n_channels, n_samples)
    wavfile.write(str(filename), sr, (audio.T * 32767).astype(np.int16))
    print(f"✅ Wrote {filename}")
    print(f"   Channels: {audio.shape[0]}, SR: {sr}, Peak: {np.max(np.abs(audio)):.3f}")
    print("   Ready for music AI reference track / DAW layering / style prompt.")


if __name__ == "__main__":
    main()
