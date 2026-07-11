#!/usr/bin/env python3
"""
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
"""

from __future__ import annotations

import argparse
import math
import os
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Callable, Dict, List, Optional, Sequence, Tuple

import numpy as np
from scipy import signal
import soundfile as sf


# ---------------------------------------------------------------------------
# Constants & helpers
# ---------------------------------------------------------------------------

SR_DEFAULT = 44100
DTYPE = np.float64


def db_to_lin(db: float) -> float:
    return 10.0 ** (db / 20.0)


def lin_to_db(x: float) -> float:
    return 20.0 * math.log10(max(abs(x), 1e-12))


def normalize(x: np.ndarray, peak: float = 0.95) -> np.ndarray:
    m = np.max(np.abs(x))
    if m < 1e-12:
        return x
    return (x / m) * peak


def soft_clip(x: np.ndarray, drive: float = 2.0) -> np.ndarray:
    """Soft saturation (tanh) for 'high laser power' distortion."""
    return np.tanh(drive * x) / np.tanh(drive)


def apply_envelope(x: np.ndarray, attack: float = 0.01, release: float = 0.05, sr: int = SR_DEFAULT) -> np.ndarray:
    n = len(x)
    env = np.ones(n, dtype=DTYPE)
    a_samp = int(attack * sr)
    r_samp = int(release * sr)
    if a_samp > 0:
        env[:a_samp] = np.linspace(0, 1, a_samp)
    if r_samp > 0 and r_samp < n:
        env[-r_samp:] = np.linspace(1, 0, r_samp)
    return x * env


# ---------------------------------------------------------------------------
# Core Photoacoustic Model
# ---------------------------------------------------------------------------

@dataclass
class Material:
    """Optical + thermal properties of the absorber (soot, charcoal, gas, PDMS, etc.)."""
    name: str
    absorption: float = 1.0          # μ_a effective (0..1+)
    thermal_tau: float = 0.002       # thermal time constant [s] (low-pass)
    gruneisen: float = 0.5           # Γ (pressure conversion efficiency)
    expansion: float = 1.0           # β scaling
    nonlinearity: float = 0.0        # 0 = linear, >0 adds saturation / higher harmonics
    comment: str = ""


@dataclass
class Resonator:
    """Acoustic cavity / jar / cell that shapes the pressure into audible sound."""
    name: str
    resonances: List[float]          # center frequencies [Hz]
    q_factors: List[float]           # Q for each mode
    gain: float = 1.0
    comment: str = ""


# Presets -------------------------------------------------------------------

MATERIALS: Dict[str, Material] = {
    "soot": Material(
        "soot (candle black)", absorption=0.98, thermal_tau=0.0015,
        gruneisen=0.4, expansion=1.2, nonlinearity=0.15,
        comment="Classic jar transducer – broadband, slightly gritty"
    ),
    "charcoal": Material(
        "charcoal", absorption=0.95, thermal_tau=0.004,
        gruneisen=0.55, expansion=1.0, nonlinearity=0.25,
        comment="Slower thermal, warmer, more saturated"
    ),
    "gas_ethene": Material(
        "ethene gas cell", absorption=0.6, thermal_tau=0.0008,
        gruneisen=0.8, expansion=1.5, nonlinearity=0.05,
        comment="Faster response, cleaner, good for high freq / musical notes"
    ),
    "pdms_composite": Material(
        "CS/PDMS nanocomposite", absorption=0.9, thermal_tau=0.0003,
        gruneisen=1.2, expansion=0.8, nonlinearity=0.1,
        comment="Fast, efficient solid absorber – brighter, more ultrasonic character (audio band)"
    ),
    "black_aluminum": Material(
        "black aluminum foil", absorption=0.85, thermal_tau=0.008,
        gruneisen=0.3, expansion=0.7, nonlinearity=0.4,
        comment="Heavy thermal mass – dark, bassy, lots of nonlinear grit"
    ),
    "custom": Material("custom", 1.0, 0.002, 0.5, 1.0, 0.1, "User editable"),
}

RESONATORS: Dict[str, Resonator] = {
    "jar": Resonator(
        "glass jar (ear)", resonances=[180, 360, 720, 1100], q_factors=[8, 6, 5, 4],
        gain=1.2, comment="Simple soot-jar – mid emphasis, natural roomy feel"
    ),
    "helmholtz": Resonator(
        "Helmholtz resonator", resonances=[110, 220], q_factors=[15, 10],
        gain=1.5, comment="Strong low-mid resonance, boomy"
    ),
    "h_cell": Resonator(
        "H-type PA cell", resonances=[250, 500, 1000, 2000], q_factors=[20, 18, 12, 8],
        gain=1.8, comment="High-Q scientific cell – clear ringing modes"
    ),
    "open_air": Resonator(
        "open air (no cavity)", resonances=[1000], q_factors=[0.7],
        gain=0.6, comment="Almost flat – pure thermal pressure, dry"
    ),
    "industrial_pipe": Resonator(
        "industrial pipe / duct", resonances=[85, 170, 340, 680, 1360], q_factors=[12, 10, 8, 6, 4],
        gain=1.4, comment="Longitudinal modes – industrial metal / cyber-western vibe"
    ),
    "custom": Resonator("custom", [440], [10], 1.0, "User editable"),
}


def thermal_response(i: np.ndarray, tau: float, sr: int) -> np.ndarray:
    """First-order low-pass: dT/dt = (I - T)/tau   (temperature from absorbed intensity)."""
    # Digital RC: alpha = dt / (tau + dt)
    dt = 1.0 / sr
    alpha = dt / (tau + dt)
    # lfilter for efficiency: y[n] = alpha * x[n] + (1-alpha) * y[n-1]
    b = [alpha]
    a = [1.0, -(1.0 - alpha)]
    return signal.lfilter(b, a, i)


def pressure_from_temp(t: np.ndarray, gruneisen: float, expansion: float, use_derivative: bool = True) -> np.ndarray:
    """
    Convert temperature fluctuation to acoustic pressure.
    - Simple: p ∝ Γ · β · T
    - More physical for pulsed / fast: p ∝ d(Γ · β · T)/dt  (rate of expansion)
    We blend both for musical interest.
    """
    p_direct = gruneisen * expansion * t
    if use_derivative:
        # Central difference approx of derivative, then scale
        dt = 1.0  # sample units; we normalize later
        dp = np.gradient(p_direct)
        # Blend: mostly rate for "PA click", some direct for body
        p = 0.65 * dp + 0.35 * p_direct
    else:
        p = p_direct
    return p


def apply_resonator(p: np.ndarray, res: Resonator, sr: int) -> np.ndarray:
    """Sum of parallel bandpass (biquad) resonators for cavity modes."""
    out = np.zeros_like(p)
    for f0, q in zip(res.resonances, res.q_factors):
        if f0 <= 0 or f0 >= sr / 2:
            continue
        # Second-order peaking / resonator filter
        # Using iirpeak for high Q
        b, a = signal.iirpeak(f0, q, fs=sr)
        mode = signal.lfilter(b, a, p)
        out += mode
    return out * res.gain


def photoacoustic_transform(
    light: np.ndarray,
    material: Material,
    resonator: Resonator,
    sr: int = SR_DEFAULT,
    laser_power: float = 1.0,
    use_derivative: bool = True,
) -> np.ndarray:
    """
    Full PA chain: light intensity -> absorption -> heat/T -> pressure -> resonator.
    light: typically [0,1] intensity or bipolar AC modulation around bias.
    """
    # 1. Absorption + power (with optional soft saturation / nonlinearity)
    absorbed = material.absorption * laser_power * light
    if material.nonlinearity > 0:
        # Soft clip + mild quadratic for even harmonics (real absorbers saturate)
        absorbed = soft_clip(absorbed, drive=1.0 + material.nonlinearity * 3)
        absorbed = absorbed + material.nonlinearity * 0.15 * absorbed**2

    # 2. Thermal inertia
    temp = thermal_response(absorbed, material.thermal_tau, sr)

    # Remove DC (steady heating produces no sound)
    temp = temp - np.mean(temp)

    # 3. Pressure generation
    pressure = pressure_from_temp(temp, material.gruneisen, material.expansion, use_derivative)

    # 4. Acoustic resonator / cavity
    acoustic = apply_resonator(pressure, resonator, sr)

    # Final DC removal + light normalization
    acoustic = acoustic - np.mean(acoustic)
    return acoustic


# ---------------------------------------------------------------------------
# Light generators (the "music" sources)
# ---------------------------------------------------------------------------

def gen_tone(freq: float, duration: float, sr: int, amp: float = 0.8, phase: float = 0.0) -> np.ndarray:
    t = np.arange(int(duration * sr)) / sr
    return amp * np.sin(2 * np.pi * freq * t + phase)


def gen_chord(freqs: Sequence[float], duration: float, sr: int, amp: float = 0.6) -> np.ndarray:
    x = np.zeros(int(duration * sr), dtype=DTYPE)
    for f in freqs:
        x += gen_tone(f, duration, sr, amp / len(freqs))
    return x


def gen_pulse_train(
    rate_hz: float,
    duration: float,
    sr: int,
    pulse_width: float = 0.001,
    amp: float = 1.0,
    shape: str = "rect",
) -> np.ndarray:
    """Laser-like intensity pulses. shape: rect | gaussian | exp"""
    n = int(duration * sr)
    t = np.arange(n) / sr
    period = 1.0 / rate_hz
    x = np.zeros(n, dtype=DTYPE)
    pulse_samples = max(1, int(pulse_width * sr))
    for start in np.arange(0, duration, period):
        i0 = int(start * sr)
        if i0 >= n:
            break
        i1 = min(i0 + pulse_samples, n)
        if shape == "rect":
            x[i0:i1] = amp
        elif shape == "gaussian":
            tt = np.arange(i1 - i0) - (i1 - i0) / 2
            sigma = pulse_samples / 6
            x[i0:i1] = amp * np.exp(-0.5 * (tt / sigma) ** 2)
        elif shape == "exp":
            x[i0:i1] = amp * np.exp(-np.linspace(0, 5, i1 - i0))
    return x


def gen_fibonacci_rhythm(
    base_rate: float,
    duration: float,
    sr: int,
    fib_depth: int = 8,
    pulse_width: float = 0.002,
    amp: float = 0.9,
) -> np.ndarray:
    """Industrial / math pulse sequence using Fibonacci intervals (user favorite)."""
    fib = [1, 1]
    while len(fib) < fib_depth:
        fib.append(fib[-1] + fib[-2])
    # Normalize intervals to fit roughly in duration
    total_units = sum(fib)
    unit = duration / (total_units * 1.5)  # leave some space
    times = []
    t = 0.0
    for f in fib * 3:  # repeat pattern
        times.append(t)
        t += f * unit
        if t > duration:
            break
    n = int(duration * sr)
    x = np.zeros(n, dtype=DTYPE)
    pulse_samp = max(1, int(pulse_width * sr))
    for tt in times:
        i0 = int(tt * sr)
        if 0 <= i0 < n:
            i1 = min(i0 + pulse_samp, n)
            # Gaussian-ish pulse
            tt_local = np.arange(i1 - i0) - (i1 - i0) / 2
            sigma = pulse_samp / 5
            x[i0:i1] += amp * np.exp(-0.5 * (tt_local / sigma) ** 2)
    return np.clip(x, 0, 1.5)


def gen_industrial_sequence(duration: float, sr: int, bpm: float = 90.0) -> np.ndarray:
    """Evolving industrial light pattern: pulse trains + drones + occasional chords."""
    n = int(duration * sr)
    x = np.zeros(n, dtype=DTYPE)
    t = np.arange(n) / sr

    # Slow evolving drone (low frequency intensity envelope)
    drone = 0.3 + 0.2 * np.sin(2 * np.pi * 0.07 * t) + 0.1 * np.sin(2 * np.pi * 0.13 * t)

    # Main pulse rhythm at ~ BPM
    beat = gen_pulse_train(bpm / 60.0, duration, sr, pulse_width=0.008, amp=0.7, shape="exp")

    # Faster 16th / breakbeat layer
    fast = gen_pulse_train(bpm / 60.0 * 4, duration, sr, pulse_width=0.0015, amp=0.35, shape="gaussian")

    # Occasional Fibonacci stutters
    fib = gen_fibonacci_rhythm(bpm / 60.0 * 2, duration, sr, fib_depth=7, pulse_width=0.003, amp=0.5)

    # Mid-frequency "laser sweep" tones modulated
    sweep_freq = 80 + 40 * np.sin(2 * np.pi * 0.05 * t)
    sweep = 0.15 * np.sin(2 * np.pi * np.cumsum(sweep_freq) / sr) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.2 * t))

    x = drone * 0.4 + beat + fast * 0.6 + fib * 0.4 + sweep
    x = np.clip(x, 0.0, 1.2)
    return x


def gen_musical_notes(
    notes: Sequence[Tuple[float, float, float]],  # (start, duration, freq)
    sr: int,
    amp: float = 0.7,
) -> np.ndarray:
    """Simple sequencer of pure tones as light modulation."""
    if not notes:
        return np.zeros(0)
    total_dur = max(s + d for s, d, _ in notes) + 0.1
    n = int(total_dur * sr)
    x = np.zeros(n, dtype=DTYPE)
    for start, dur, freq in notes:
        i0 = int(start * sr)
        seg = gen_tone(freq, dur, sr, amp)
        seg = apply_envelope(seg, 0.005, 0.03, sr)
        i1 = min(i0 + len(seg), n)
        x[i0:i1] += seg[: i1 - i0]
    return np.clip(x, -1, 1)


# ---------------------------------------------------------------------------
# Post FX for "messing with" the sound
# ---------------------------------------------------------------------------

def fx_reverb(x: np.ndarray, sr: int, room_size: float = 0.6, damping: float = 0.4, wet: float = 0.35) -> np.ndarray:
    """Simple multi-tap feedback delay reverb (no external deps)."""
    delays = [int(d * sr) for d in [0.0297, 0.0371, 0.0411, 0.0437]]  # prime-ish
    y = x.copy()
    for d in delays:
        if d >= len(x):
            continue
        feedback = (1.0 - damping) * 0.45
        delayed = np.zeros_like(x)
        delayed[d:] = x[:-d]
        # Mild lowpass on feedback
        b, a = signal.butter(1, 0.4)
        delayed = signal.lfilter(b, a, delayed)
        y = y + wet * delayed
        # Feedback path (simple)
        x = x + feedback * delayed
    return normalize(y * (1 - wet * 0.3) + wet * y)


def fx_distortion(x: np.ndarray, drive: float = 3.0, mix: float = 0.6) -> np.ndarray:
    dry = x
    wet = soft_clip(x, drive)
    return normalize((1 - mix) * dry + mix * wet)


def fx_eq(x: np.ndarray, sr: int, low_gain: float = 1.0, mid_gain: float = 1.2, high_gain: float = 0.9) -> np.ndarray:
    """Simple 3-band shelving-ish EQ."""
    # Low shelf
    b_lo, a_lo = signal.butter(2, 200 / (sr / 2), btype="low")
    lo = signal.lfilter(b_lo, a_lo, x) * low_gain
    # High shelf
    b_hi, a_hi = signal.butter(2, 3000 / (sr / 2), btype="high")
    hi = signal.lfilter(b_hi, a_hi, x) * high_gain
    # Mid (band)
    b_m, a_m = signal.butter(2, [400 / (sr / 2), 2500 / (sr / 2)], btype="band")
    mid = signal.lfilter(b_m, a_m, x) * mid_gain
    return normalize(lo + mid + hi)


def fx_chorus(x: np.ndarray, sr: int, depth: float = 0.003, rate: float = 1.5, mix: float = 0.4) -> np.ndarray:
    """Very simple chorus via modulated delay."""
    n = len(x)
    t = np.arange(n) / sr
    mod = depth * np.sin(2 * np.pi * rate * t)
    delay_samp = (0.01 + mod) * sr  # base 10ms
    y = np.zeros(n)
    for i in range(n):
        d = delay_samp[i]
        i0 = int(i - d)
        frac = d - int(d)
        if 0 <= i0 < n - 1:
            y[i] = (1 - frac) * x[i0] + frac * x[i0 + 1]
        elif 0 <= i0 < n:
            y[i] = x[i0]
    return normalize((1 - mix) * x + mix * y)


def apply_fx_chain(x: np.ndarray, fx_list: List[str], sr: int) -> np.ndarray:
    for fx in fx_list:
        fx = fx.strip().lower()
        if fx in ("reverb", "rev"):
            x = fx_reverb(x, sr)
        elif fx in ("dist", "distortion", "drive"):
            x = fx_distortion(x, drive=2.8, mix=0.55)
        elif fx in ("eq", "tone"):
            x = fx_eq(x, sr, low_gain=0.9, mid_gain=1.3, high_gain=1.1)
        elif fx in ("chorus", "chor"):
            x = fx_chorus(x, sr)
        elif fx in ("none", ""):
            pass
        else:
            print(f"  [warn] unknown fx '{fx}', skipping")
    return x


# ---------------------------------------------------------------------------
# High-level generators / modes
# ---------------------------------------------------------------------------

def make_demo_track(sr: int = SR_DEFAULT, duration: float = 45.0) -> Tuple[np.ndarray, str]:
    """A complete little piece that showcases the PA effect with evolving materials & resonators."""
    print("Generating demo track (evolving materials + Fibonacci industrial)...")
    n = int(duration * sr)
    light = gen_industrial_sequence(duration, sr, bpm=88)

    # Split into sections with different materials / resonators
    sections = [
        (0.0, 12.0, "soot", "jar", 1.0),
        (12.0, 22.0, "charcoal", "industrial_pipe", 1.3),
        (22.0, 32.0, "gas_ethene", "h_cell", 0.9),
        (32.0, duration, "pdms_composite", "open_air", 1.5),
    ]

    out = np.zeros(n, dtype=DTYPE)
    for start, end, mat_name, res_name, power in sections:
        i0 = int(start * sr)
        i1 = int(end * sr)
        seg_light = light[i0:i1]
        mat = MATERIALS[mat_name]
        res = RESONATORS[res_name]
        pa = photoacoustic_transform(seg_light, mat, res, sr, laser_power=power)
        # Crossfade
        fade = int(0.4 * sr)
        if i0 > 0 and fade > 0:
            pa[:fade] *= np.linspace(0, 1, fade)
        if i1 < n and fade > 0:
            pa[-fade:] *= np.linspace(1, 0, fade)
        out[i0:i1] += pa

    # Global FX for cohesion
    out = fx_eq(out, sr, low_gain=1.1, mid_gain=1.25, high_gain=0.95)
    out = fx_reverb(out, sr, room_size=0.55, wet=0.28)
    out = normalize(out, 0.92)
    desc = "Demo: industrial PA sequence evolving soot-jar → charcoal-pipe → ethene-Hcell → PDMS-open"
    return out, desc


def make_preset(
    name: str,
    duration: float = 20.0,
    sr: int = SR_DEFAULT,
) -> Tuple[np.ndarray, str]:
    """Named musical presets built on the PA engine."""
    if name == "industrial_fib":
        light = gen_fibonacci_rhythm(3.5, duration, sr, fib_depth=9, pulse_width=0.004, amp=1.0)
        light += 0.25 * gen_pulse_train(1.8, duration, sr, 0.012, 0.6, "exp")
        mat = MATERIALS["charcoal"]
        res = RESONATORS["industrial_pipe"]
        pa = photoacoustic_transform(light, mat, res, sr, laser_power=1.4)
        pa = fx_distortion(pa, drive=2.2, mix=0.4)
        pa = fx_reverb(pa, sr, wet=0.4)
        return normalize(pa), "Fibonacci industrial pulse train through charcoal + pipe resonator + grit"

    elif name == "soot_music":
        # Classic "hear the light" – pure tones + simple melody as intensity
        notes = [
            (0.0, 1.5, 220), (1.5, 1.5, 277), (3.0, 1.5, 330),
            (4.5, 2.0, 440), (6.5, 1.0, 330), (7.5, 1.0, 277),
            (8.5, 2.5, 220), (11.0, 1.5, 165), (12.5, 3.0, 110),
        ]
        light = gen_musical_notes(notes, sr, amp=0.85)
        # Add some higher harmonics / second voice (pad to same length)
        harmony = gen_musical_notes([(0.5 + s, d * 0.8, f * 1.5) for s, d, f in notes], sr, 0.5)
        if len(harmony) < len(light):
            harmony = np.pad(harmony, (0, len(light) - len(harmony)))
        else:
            harmony = harmony[:len(light)]
        light = light + 0.35 * harmony
        mat = MATERIALS["soot"]
        res = RESONATORS["jar"]
        pa = photoacoustic_transform(light, mat, res, sr, laser_power=1.1, use_derivative=False)
        pa = fx_reverb(pa, sr, wet=0.25)
        return normalize(pa), "Simple melody through classic soot-jar (closest to the YouTube demo)"

    elif name == "resonant_gas":
        light = gen_chord([110, 165, 220, 277], duration, sr, amp=0.7)
        # Slow amplitude modulation (like chopper)
        t = np.arange(len(light)) / sr
        light *= 0.5 + 0.5 * signal.square(2 * np.pi * 4.5 * t)  # 4.5 Hz chop
        mat = MATERIALS["gas_ethene"]
        res = RESONATORS["h_cell"]
        pa = photoacoustic_transform(light, mat, res, sr, laser_power=0.9)
        pa = fx_eq(pa, sr, low_gain=0.7, mid_gain=1.4, high_gain=1.2)
        return normalize(pa), "Chord + optical chopper through ethene gas + high-Q H-cell"

    elif name == "ultrasonic_edge":
        # Fast pulses + high material speed → bright, almost granular
        light = gen_pulse_train(45.0, duration, sr, pulse_width=0.0008, amp=1.0, shape="gaussian")
        light += 0.4 * gen_pulse_train(67.0, duration, sr, 0.0005, 0.7, "exp")
        mat = MATERIALS["pdms_composite"]
        res = RESONATORS["open_air"]
        pa = photoacoustic_transform(light, mat, res, sr, laser_power=1.8, use_derivative=True)
        pa = fx_distortion(pa, drive=1.8, mix=0.3)
        pa = fx_chorus(pa, sr, depth=0.002, rate=0.8, mix=0.25)
        return normalize(pa), "Fast PDMS pulses – bright edge-of-ultrasonic texture (audio band)"

    elif name == "drone_dark":
        light = gen_industrial_sequence(duration, sr, bpm=60)
        mat = MATERIALS["black_aluminum"]
        res = RESONATORS["helmholtz"]
        pa = photoacoustic_transform(light, mat, res, sr, laser_power=1.6)
        pa = fx_eq(pa, sr, low_gain=1.4, mid_gain=0.9, high_gain=0.6)
        pa = fx_reverb(pa, sr, room_size=0.75, wet=0.5)
        return normalize(pa), "Dark slow drone through heavy aluminum + Helmholtz (dystopian rezoning vibes)"

    else:
        raise ValueError(f"Unknown preset '{name}'. Use --list-presets")


def process_input_wav(
    path: str,
    material: Material,
    resonator: Resonator,
    sr_out: int,
    laser_power: float,
    fx: List[str],
) -> np.ndarray:
    """Load a WAV (or any audio), treat samples as light intensity modulation, run through PA."""
    data, sr_in = sf.read(path, always_2d=False)
    if data.ndim > 1:
        data = data.mean(axis=1)  # mono
    # Resample if needed
    if sr_in != sr_out:
        # Simple polyphase
        data = signal.resample_poly(data, sr_out, sr_in)
    # Map to [0,1] intensity with bias (real light is positive)
    data = data - np.mean(data)
    data = 0.5 + 0.45 * normalize(data, 1.0)  # bias + AC
    pa = photoacoustic_transform(data, material, resonator, sr_out, laser_power=laser_power)
    if fx:
        pa = apply_fx_chain(pa, fx, sr_out)
    return normalize(pa)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def list_presets() -> None:
    print("\n=== Materials ===")
    for k, m in MATERIALS.items():
        print(f"  {k:18s}  τ={m.thermal_tau*1000:.1f}ms  Γ={m.gruneisen:.2f}  nonlin={m.nonlinearity:.2f}  | {m.comment}")
    print("\n=== Resonators ===")
    for k, r in RESONATORS.items():
        freqs = ",".join(f"{f:.0f}" for f in r.resonances[:4])
        print(f"  {k:18s}  modes≈[{freqs}...]  Q≈{r.q_factors[0]:.0f}  | {r.comment}")
    print("\n=== Musical Presets (--preset) ===")
    for p in ["industrial_fib", "soot_music", "resonant_gas", "ultrasonic_edge", "drone_dark"]:
        print(f"  {p}")
    print("\n=== Modes ===")
    print("  demo       Full evolving demo track")
    print("  generate   Named preset")
    print("  through    Process an input WAV as light modulation")
    print("  pulse      Raw pulse-train playground")
    print()


def main():
    parser = argparse.ArgumentParser(
        description="Photoacoustic Sonifier – turn light into music / experiment with PA sounds",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--mode", choices=["demo", "generate", "through", "pulse", "list"], default="demo")
    parser.add_argument("--preset", default="industrial_fib", help="For --mode generate")
    parser.add_argument("--input", "-i", help="Input WAV for --mode through")
    parser.add_argument("--material", "-m", default="soot", choices=list(MATERIALS.keys()))
    parser.add_argument("--resonator", "-r", default="jar", choices=list(RESONATORS.keys()))
    parser.add_argument("--duration", "-d", type=float, default=20.0)
    parser.add_argument("--sr", type=int, default=SR_DEFAULT)
    parser.add_argument("--laser-power", type=float, default=1.0, help="Relative optical power (drive)")
    parser.add_argument("--fx", default="reverb", help="Comma-separated: reverb,dist,eq,chorus,none")
    parser.add_argument("--out", "-o", default="pa_output.wav")
    parser.add_argument("--list-presets", action="store_true")
    parser.add_argument("--seed", type=int, default=42, help="For any stochastic bits (none currently)")

    args = parser.parse_args()
    np.random.seed(args.seed)

    if args.list_presets or args.mode == "list":
        list_presets()
        return

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    fx_list = [f.strip() for f in args.fx.split(",") if f.strip()]

    if args.mode == "demo":
        audio, desc = make_demo_track(args.sr, max(args.duration, 30.0))
        print(f"  {desc}")

    elif args.mode == "generate":
        audio, desc = make_preset(args.preset, args.duration, args.sr)
        print(f"  Preset: {args.preset} → {desc}")

    elif args.mode == "through":
        if not args.input:
            raise SystemExit("--input WAV required for --mode through")
        mat = MATERIALS[args.material]
        res = RESONATORS[args.resonator]
        print(f"  Passing '{args.input}' through material={mat.name}, resonator={res.name}, power={args.laser_power}")
        audio = process_input_wav(args.input, mat, res, args.sr, args.laser_power, fx_list)
        desc = f"Input audio sonified via PA ({mat.name} + {res.name})"

    elif args.mode == "pulse":
        # Playground: pure pulse train
        light = gen_pulse_train(8.0, args.duration, args.sr, pulse_width=0.003, amp=1.0, shape="gaussian")
        light += 0.5 * gen_pulse_train(12.5, args.duration, args.sr, 0.001, 0.7, "exp")
        mat = MATERIALS[args.material]
        res = RESONATORS[args.resonator]
        audio = photoacoustic_transform(light, mat, res, args.sr, laser_power=args.laser_power)
        if fx_list:
            audio = apply_fx_chain(audio, fx_list, args.sr)
        audio = normalize(audio)
        desc = f"Pulse playground ({args.material} + {args.resonator})"

    else:
        raise SystemExit("Unknown mode")

    # Write
    sf.write(str(out_path), audio.astype(np.float32), args.sr)
    print(f"\nWrote: {out_path}  ({len(audio)/args.sr:.1f}s @ {args.sr} Hz)")
    print(f"Peak: {np.max(np.abs(audio)):.3f}   RMS: {np.sqrt(np.mean(audio**2)):.3f}")
    print("Done. Load the WAV into your DAW / Audacity / VLC and mess with more FX!")
    print("Tip: re-run with different --material / --resonator / --laser-power / --fx for new timbres.")


if __name__ == "__main__":
    main()
