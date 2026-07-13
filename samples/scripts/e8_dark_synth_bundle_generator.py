#!/usr/bin/env python3
"""
E8 Sonified Dark Synth Bundle Generator
=======================================
Creates a collection of WAV samples (>=15s each) that sonify E8 lattice geometry
while applying the specific "dark / evil / heavy" synth techniques from the
referenced video:

- Instability: oscillator detune + random pitch automation + uneven unison
- Chaos Layer: noise + distortion (and noise-as-FM)
- Subtle Chaos: micro pitch/FM/unison inconsistencies stacked
- Filter Corruptions: multiple filters modulated at different (incommensurate) rates
- FM Gone Wrong: unstable / in-between / slightly wrong FM ratios

All base frequencies, detunes, LFO rates, FM ratios, filter speeds, and
modulation depths are derived from the 240 roots of the E8 root system
(and simple roots / projections) to make the sounds "E8-sonified".

Tuning reference: 432 Hz (user preference). Sample rate 44100 Hz, 24-bit optional
but we write 16-bit PCM for compatibility. Stereo with subtle width from detune.

Author: generated for Trent Slade / QSOL-IMC E8 Spectral work
"""

import numpy as np
from scipy.io import wavfile
from scipy import signal
from pathlib import Path
import itertools
import json
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
SR = 44100
DURATION_BASE = 22.0          # seconds, all clips >= 15s
A4 = 432.0                    # user-preferred tuning
OUTPUT_DIR = Path(__file__).parent
RNG = np.random.default_rng(0xE8)  # deterministic E8 seed

# ---------------------------------------------------------------------------
# E8 Root System
# ---------------------------------------------------------------------------
def generate_e8_roots() -> np.ndarray:
    """Generate all 240 roots of E8 (standard realization)."""
    roots = []
    # 112 D8-type: ±e_i ± e_j
    for i, j in itertools.combinations(range(8), 2):
        for s1, s2 in itertools.product([-1.0, 1.0], repeat=2):
            v = np.zeros(8)
            v[i] = s1
            v[j] = s2
            roots.append(v)
    # 128 half-integer: (±1/2)^8 with even number of minuses
    for signs in itertools.product([-0.5, 0.5], repeat=8):
        if sum(1 for s in signs if s < 0) % 2 == 0:
            roots.append(np.array(signs))
    roots = np.array(roots, dtype=np.float64)
    assert len(roots) == 240, len(roots)
    # All have ||r||^2 = 2
    return roots


def e8_simple_roots() -> np.ndarray:
    """Standard simple roots of E8."""
    return np.array([
        [1, -1, 0, 0, 0, 0, 0, 0],
        [0, 1, -1, 0, 0, 0, 0, 0],
        [0, 0, 1, -1, 0, 0, 0, 0],
        [0, 0, 0, 1, -1, 0, 0, 0],
        [0, 0, 0, 0, 1, -1, 0, 0],
        [0, 0, 0, 0, 0, 1, -1, 0],
        [0, 0, 0, 0, 0, 0, 1, -1],
        [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    ], dtype=np.float64)


ROOTS = generate_e8_roots()
SIMPLE = e8_simple_roots()

# Pre-compute useful 1D projections / invariants for sonification
# Use first principal-ish projections + norms of subsets + angles
def e8_derived_params(n=96):
    """Return a rich set of positive scalars derived from E8 for use as
    freqs, detunes, LFO rates, ratios, depths, etc. All deterministic."""
    # Project onto a few directions (including simple roots)
    dirs = np.vstack([
        SIMPLE,
        np.eye(8),
        ROOTS[::8],           # denser sampling of roots
        ROOTS[::17],
        np.ones(8) / np.sqrt(8),
        np.array([1,1,1,1,-1,-1,-1,-1]) / np.sqrt(8),
    ])
    projs = np.abs(ROOTS @ dirs.T)  # (240, n_dirs)
    # Flatten + take unique-ish sorted positive values
    vals = np.unique(np.round(projs.flatten(), decimals=4))
    vals = vals[vals > 1e-6]
    vals = np.sort(vals)
    # Silver ratio (appears in E8 / quasicrystal literature) + golden + root norms
    phi_s = 1 + np.sqrt(2)          # ~2.414
    phi = (1 + np.sqrt(5)) / 2      # golden
    # Create rich bank by products, powers, and linear combos
    bank = list(vals)
    for v in vals[:40]:
        bank.append(v * 0.5)
        bank.append(v * phi_s * 0.07)
        bank.append(v * phi * 0.11)
        bank.append(v ** 0.5 * 0.3)
        bank.append(np.abs(np.sin(v * 2.7)) * 0.8 + 0.05)
    # Add a few explicit E8-ish constants
    bank.extend([0.5, 1.0, np.sqrt(2)/2, 1/phi, 1/phi_s, 0.7071, 1.414, 2.0, 0.25, 0.125])
    bank = np.array(bank, dtype=np.float64)
    bank = bank[bank > 1e-5]
    bank = np.sort(np.unique(np.round(bank, 5)))
    return bank[:n]


PARAMS = e8_derived_params(96)

# Map a param index into musical / control ranges
def p_freq(i, base=A4, octaves=2.5):
    """Map E8 param to frequency around base."""
    # Use log spacing for musicality
    r = PARAMS[i % len(PARAMS)]
    # Compact into ~ 3 octaves
    log_scale = np.log1p(r) / np.log1p(PARAMS.max())
    return base * (2 ** (log_scale * octaves - 1.2))

def p_detune_cents(i, max_cents=18.0):
    r = PARAMS[i % len(PARAMS)]
    return (r / PARAMS.max() - 0.5) * 2 * max_cents

def p_ratio(i, center=1.0, spread=0.35):
    """Slightly wrong FM ratio around center."""
    r = PARAMS[i % len(PARAMS)]
    return center + (r / PARAMS.max() - 0.5) * 2 * spread

def p_rate(i, min_hz=0.03, max_hz=0.9):
    r = PARAMS[i % len(PARAMS)]
    return min_hz + (r / PARAMS.max()) * (max_hz - min_hz)

def p_depth(i, max_depth=0.08):
    r = PARAMS[i % len(PARAMS)]
    return (r / PARAMS.max()) * max_depth

# ---------------------------------------------------------------------------
# Low-level DSP primitives
# ---------------------------------------------------------------------------
def soft_clip(x, drive=1.5):
    return np.tanh(x * drive) / np.tanh(drive)

def hard_clip(x, thresh=0.85):
    return np.clip(x, -thresh, thresh)

def waveshape(x, amount=0.4):
    """Gentle asymmetric waveshaping for 'evil' color."""
    return x + amount * (x ** 3) + 0.15 * amount * np.sin(np.pi * x)

def adsr(n_samples, attack=0.08, decay=0.25, sustain=0.7, release=1.8, sr=SR):
    a = int(attack * sr)
    d = int(decay * sr)
    r = int(release * sr)
    s_len = max(0, n_samples - a - d - r)
    env = np.zeros(n_samples)
    # attack
    if a > 0:
        env[:a] = np.linspace(0, 1, a)
    # decay
    if d > 0:
        env[a:a+d] = np.linspace(1, sustain, d)
    # sustain
    if s_len > 0:
        env[a+d:a+d+s_len] = sustain
    # release
    start_r = a + d + s_len
    if r > 0 and start_r < n_samples:
        rem = n_samples - start_r
        env[start_r:] = np.linspace(sustain, 0, rem) * (sustain if rem == r else 1)
        if rem < r:
            env[start_r:] = np.linspace(sustain, 0, rem)
    return env

def pink_noise(n, rng=RNG):
    """Approximate pink noise via filtering white."""
    white = rng.standard_normal(n)
    # simple 1/f filter (b0, b1, a1) style recursive
    b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
    a = [1, -2.494956002, 2.017265875, -0.522189400]
    pink = signal.lfilter(b, a, white)
    return pink / (np.std(pink) + 1e-9)

def white_noise(n, rng=RNG):
    return rng.standard_normal(n)

def lowpass(x, cutoff, sr=SR, order=2):
    """Supports scalar or array (time-varying) cutoff via one-pole when array."""
    x = np.asarray(x, dtype=np.float64)
    if np.isscalar(cutoff) or (isinstance(cutoff, np.ndarray) and cutoff.ndim == 0):
        c = float(cutoff)
        if c >= sr * 0.49:
            return x
        nyq = sr / 2.0
        wn = max(20.0, min(c, nyq - 100)) / nyq
        b, a = signal.butter(order, wn, btype='low')
        return signal.lfilter(b, a, x)
    # Time-varying: simple one-pole lowpass (vectorized recursive via numba-free loop unrolled in chunks or pure np)
    # For speed we process in overlapping frames with fixed coeff per frame (good enough for slow LFOs)
    cutoff = np.asarray(cutoff, dtype=np.float64)
    if cutoff.shape[0] != x.shape[0]:
        cutoff = np.resize(cutoff, x.shape[0])
    cutoff = np.clip(cutoff, 30.0, sr * 0.45)
    # Frame-based approximation (LFO rates are << 1 Hz so frames of 512-2048 are fine)
    frame = 1024
    y = np.zeros_like(x)
    n = len(x)
    for start in range(0, n, frame):
        end = min(start + frame, n)
        # Use median or mean cutoff in frame
        c = float(np.mean(cutoff[start:end]))
        alpha = 1.0 - np.exp(-2.0 * np.pi * c / sr)
        # Apply recursive in the small frame (still pure py but short)
        # Better: use scipy lfilter with fixed for the frame, carry state
        b = [alpha]
        a = [1.0, -(1.0 - alpha)]
        if start == 0:
            yi, zf = signal.lfilter(b, a, x[start:end], zi=[0.0])
        else:
            yi, zf = signal.lfilter(b, a, x[start:end], zi=zf)
        y[start:end] = yi
    return y

def highpass(x, cutoff, sr=SR, order=2):
    x = np.asarray(x, dtype=np.float64)
    if np.isscalar(cutoff) or (isinstance(cutoff, np.ndarray) and cutoff.ndim == 0):
        nyq = sr / 2.0
        wn = max(20.0, min(float(cutoff), nyq - 100)) / nyq
        b, a = signal.butter(order, wn, btype='high')
        return signal.lfilter(b, a, x)
    # Time-var approx via lowpass residual
    lp = lowpass(x, cutoff, sr=sr)
    return x - lp

def bandpass(x, low, high, sr=SR, order=2):
    x = np.asarray(x, dtype=np.float64)
    if (np.isscalar(low) or (isinstance(low, np.ndarray) and low.ndim == 0)) and \
       (np.isscalar(high) or (isinstance(high, np.ndarray) and high.ndim == 0)):
        nyq = sr / 2.0
        lo = max(30.0, float(low))
        hi = min(float(high), nyq - 50)
        if lo >= hi:
            return x
        b, a = signal.butter(order, [lo/nyq, hi/nyq], btype='band')
        return signal.lfilter(b, a, x)
    # Approximate: HP then LP
    return lowpass(highpass(x, low, sr=sr), high, sr=sr)

def make_lfo(n, rate_hz, phase=0.0, shape='sine', sr=SR):
    t = np.arange(n) / sr
    if shape == 'sine':
        return np.sin(2 * np.pi * rate_hz * t + phase)
    elif shape == 'tri':
        return signal.sawtooth(2 * np.pi * rate_hz * t + phase, 0.5)
    elif shape == 'snh':  # sample & hold-ish via low-rate noise
        # crude: hold random values
        period = max(1, int(sr / max(rate_hz, 0.01)))
        vals = RNG.uniform(-1, 1, size=(n // period + 2))
        return np.repeat(vals, period)[:n]
    else:
        return np.sin(2 * np.pi * rate_hz * t + phase)

def oscillator(n, freq, waveform='saw', phase0=0.0, sr=SR, detune_cents=0.0):
    """Basic anti-aliased-ish oscillator (simple polyBLEP would be better but keep light)."""
    freq = freq * (2 ** (detune_cents / 1200.0))
    t = np.arange(n) / sr
    phase = 2 * np.pi * freq * t + phase0
    if waveform == 'sine':
        return np.sin(phase)
    elif waveform == 'saw':
        # naive + mild polyBLEP-ish correction via highpass of square residual
        raw = 2 * (phase / (2 * np.pi) % 1) - 1
        return raw
    elif waveform == 'square':
        return np.sign(np.sin(phase))
    elif waveform == 'tri':
        return signal.sawtooth(phase, 0.5)
    else:
        return np.sin(phase)

def unison(n, base_freq, voices=5, detune_cents=12.0, waveform='saw',
           uneven=True, stereo=True, sr=SR):
    """Uneven unison: detunes not perfectly symmetric + slight amplitude/phase variation."""
    left = np.zeros(n)
    right = np.zeros(n)
    half = (voices - 1) / 2.0
    for i in range(voices):
        # E8-influenced uneven spacing
        offset = (i - half) / max(half, 1)
        # Slight asymmetry from PARAMS
        asym = 1.0 + 0.12 * np.sin(PARAMS[i % len(PARAMS)] * 3.7)
        det = offset * detune_cents * asym
        # Random but deterministic per-voice phase & micro amp
        ph = 2 * np.pi * (PARAMS[(i*7) % len(PARAMS)] % 1)
        amp = 0.85 + 0.15 * np.cos(PARAMS[(i*3) % len(PARAMS)])
        osc = oscillator(n, base_freq, waveform, phase0=ph, detune_cents=det)
        # Stereo pan: outer voices wider
        pan = offset * 0.75 if stereo else 0.0
        left  += osc * amp * (0.5 - 0.5 * pan)
        right += osc * amp * (0.5 + 0.5 * pan)
    # Normalize voice count
    left  /= voices * 0.65
    right /= voices * 0.65
    return left, right

# ---------------------------------------------------------------------------
# High-level patch builders (each embodies one or more techniques + E8)
# ---------------------------------------------------------------------------
def patch_instability(duration=DURATION_BASE, base_freq=None):
    """Technique 1: Instability – detune + random pitch automation + uneven unison.
    E8 supplies the detune amounts and the slow random-walk seed."""
    n = int(duration * SR)
    if base_freq is None:
        base_freq = p_freq(3, A4 * 0.5)   # low-ish lead/pad

    # Core uneven unison (5-7 voices)
    voices = 7
    det_cents = abs(p_detune_cents(11, max_cents=14)) + 4.5
    L, R = unison(n, base_freq, voices=voices, detune_cents=det_cents,
                  waveform='saw', uneven=True)

    # Slight random pitch automation (very slow, a few %)
    # Use cumulative sum of filtered noise scaled by E8 depth
    depth = p_depth(17, max_depth=0.035)   # ~ 3.5 % peak
    noise = pink_noise(n)
    # Lowpass the noise heavily so it is "random automation" not flutter
    mod = lowpass(noise, 0.8, order=3)
    mod = mod / (np.max(np.abs(mod)) + 1e-9) * depth
    # Apply as time-varying pitch (simple: modulate phase increment)
    # Approximate by resampling-ish or just ring-mod style for subtlety
    # Better: create a frequency envelope and re-generate, but for speed we
    # use a mild FM of the already-rendered signal with very low rate.
    # For true pitch auto we re-synthesize a carrier with modulated freq.
    # Re-do with explicit freq modulation for accuracy.
    t = np.arange(n) / SR
    # Instantaneous freq = base * (1 + mod)
    # Integrate phase
    inst_freq = base_freq * (1.0 + mod)
    phase = 2 * np.pi * np.cumsum(inst_freq) / SR
    # Multi-voice re-render with the same uneven detunes but shared pitch envelope
    L = np.zeros(n)
    R = np.zeros(n)
    half = (voices - 1) / 2.0
    for i in range(voices):
        offset = (i - half) / max(half, 1)
        asym = 1.0 + 0.11 * np.sin(PARAMS[i % len(PARAMS)] * 4.1)
        det = offset * det_cents * asym
        ph0 = 2 * np.pi * (PARAMS[(i*5) % len(PARAMS)] % 1)
        f_local = inst_freq * (2 ** (det / 1200.0))
        ph = 2 * np.pi * np.cumsum(f_local) / SR + ph0
        osc = 2 * (ph / (2 * np.pi) % 1) - 1   # saw
        amp = 0.82 + 0.18 * np.cos(PARAMS[(i*2) % len(PARAMS)])
        pan = offset * 0.7
        L += osc * amp * (0.5 - 0.5 * pan)
        R += osc * amp * (0.5 + 0.5 * pan)
    L /= voices * 0.62
    R /= voices * 0.62

    # Gentle filter to tame aliasing / add body
    L = lowpass(L, 3200 + 800 * make_lfo(n, p_rate(5, 0.05, 0.25), shape='tri'))
    R = lowpass(R, 3200 + 800 * make_lfo(n, p_rate(6, 0.04, 0.22), shape='tri'))

    # Light waveshaping for weight
    L = soft_clip(waveshape(L, 0.25), 1.3)
    R = soft_clip(waveshape(R, 0.25), 1.3)

    env = adsr(n, attack=0.4, decay=1.2, sustain=0.75, release=3.5)
    L *= env
    R *= env

    # Stereo width + final normalize
    mix = np.stack([L, R], axis=1)
    peak = np.max(np.abs(mix)) + 1e-9
    mix = mix / peak * 0.89
    return mix


def patch_chaos_layer(duration=DURATION_BASE, base_freq=None):
    """Technique 2: Chaos Layer – noise + distortion, noise-as-FM.
    Classic Doom / industrial 'corrupted tone'."""
    n = int(duration * SR)
    if base_freq is None:
        base_freq = p_freq(7, A4 * 0.25)  # subby

    t = np.arange(n) / SR

    # Carrier: detuned saws (already unstable)
    L, R = unison(n, base_freq, voices=5, detune_cents=9.5, waveform='saw')

    # Noise sources (white + pink)
    wn = white_noise(n)
    pn = pink_noise(n)

    # Noise to FM the carrier slightly (the "feel it corrupting" trick)
    fm_depth = p_depth(22, 0.12)  # radians-ish scale via phase
    noise_mod = lowpass(0.65 * pn + 0.35 * wn, 180)
    noise_mod = noise_mod / (np.std(noise_mod) + 1e-9)
    # Apply as mild phase modulation / FM
    phase_mod = np.cumsum(noise_mod * fm_depth * base_freq * 0.15) / SR
    # Re-modulate existing signal by rotating phase (approx via Hilbert or simple AM+PM)
    # Simple effective: ring-modulate with a slow version + add filtered noise
    L = L * (1.0 + 0.35 * lowpass(noise_mod, 40)) + 0.22 * bandpass(wn, 80, 2800)
    R = R * (1.0 + 0.35 * lowpass(noise_mod, 45)) + 0.22 * bandpass(wn, 90, 3100)

    # Distortion on the whole (makes harmonics explode from the noise)
    drive = 2.8 + 0.6 * make_lfo(n, p_rate(9, 0.02, 0.08))
    L = soft_clip(L * drive, 1.8)
    R = soft_clip(R * drive, 1.8)

    # Additional filtered noise layer mixed low
    noise_layer = bandpass(0.7 * pn + 0.3 * wn, 200, 4500)
    noise_layer = soft_clip(noise_layer * 1.6, 1.4) * 0.18
    L += noise_layer
    R += noise_layer * 0.92   # slight stereo difference

    # Dual filter corruption (preview of technique 4)
    cut1 = 900 + 1400 * (0.5 + 0.5 * make_lfo(n, p_rate(13, 0.07, 0.35), shape='sine'))
    cut2 = 1400 + 1800 * (0.5 + 0.5 * make_lfo(n, p_rate(19, 0.11, 0.48), shape='tri'))
    L = 0.55 * lowpass(L, cut1) + 0.45 * lowpass(L, cut2)
    R = 0.55 * lowpass(R, cut1 * 1.03) + 0.45 * lowpass(R, cut2 * 0.97)

    env = adsr(n, attack=0.15, decay=0.8, sustain=0.82, release=4.0)
    L *= env
    R *= env

    mix = np.stack([L, R], axis=1)
    peak = np.max(np.abs(mix)) + 1e-9
    mix = mix / peak * 0.87
    return mix


def patch_subtle_chaos(duration=DURATION_BASE, base_freq=None):
    """Technique 3: Subtle Chaos – micro instability stacked (pitch, unison, FM).
    Almost imperceptible alone, evil when layered. Perfect for pads/drones."""
    n = int(duration * SR)
    if base_freq is None:
        base_freq = p_freq(2, A4 * 0.5)

    t = np.arange(n) / SR

    # Base: clean-ish sine + saw for body
    # Micro pitch mod (few cents)
    micro_depth = p_depth(4, 0.012)  # ~1.2 %
    micro_lfo = make_lfo(n, p_rate(8, 0.04, 0.18), shape='sine')
    micro_lfo2 = make_lfo(n, p_rate(14, 0.06, 0.25), shape='tri')
    inst_freq = base_freq * (1.0 + micro_depth * micro_lfo + 0.6 * micro_depth * micro_lfo2)

    # Unison with micro inconsistency
    L = np.zeros(n)
    R = np.zeros(n)
    voices = 6
    half = (voices - 1) / 2.0
    for i in range(voices):
        offset = (i - half) / max(half, 1)
        # Micro uneven
        det = offset * 3.8 * (1.0 + 0.08 * np.sin(PARAMS[i*3 % len(PARAMS)]))
        f = inst_freq * (2 ** (det / 1200.0))
        ph0 = PARAMS[(i*11) % len(PARAMS)] * 0.7
        ph = 2 * np.pi * np.cumsum(f) / SR + ph0
        # Mix sine + soft saw
        osc = 0.55 * np.sin(ph) + 0.45 * (2 * (ph/(2*np.pi) % 1) - 1)
        # Tiny amplitude inconsistency
        amp = 0.9 + 0.1 * np.sin(PARAMS[(i+4) % len(PARAMS)] + t * 0.3)
        pan = offset * 0.55
        L += osc * amp * (0.5 - 0.5 * pan)
        R += osc * amp * (0.5 + 0.5 * pan)
    L /= voices * 0.7
    R /= voices * 0.7

    # Barely-moving FM (touch of FM)
    mod_ratio = p_ratio(27, center=1.41, spread=0.08)  # slightly wrong
    mod_depth = p_depth(31, 0.035)
    mod_sig = np.sin(2 * np.pi * base_freq * mod_ratio * t)
    # Apply as PM
    L = L * (1.0 + mod_depth * 0.4 * mod_sig) + 0.15 * mod_depth * mod_sig * L
    R = R * (1.0 + mod_depth * 0.4 * mod_sig) + 0.15 * mod_depth * mod_sig * R

    # Soft filter that also moves microscopically
    cut = 1800 + 400 * make_lfo(n, p_rate(21, 0.03, 0.12))
    L = lowpass(L, cut)
    R = lowpass(R, cut * 1.02)

    # Very light waveshape for harmonic grit
    L = waveshape(L, 0.12)
    R = waveshape(R, 0.12)

    env = adsr(n, attack=1.2, decay=2.0, sustain=0.78, release=5.5)
    L *= env
    R *= env

    mix = np.stack([L, R], axis=1)
    peak = np.max(np.abs(mix)) + 1e-9
    mix = mix / peak * 0.88
    return mix


def patch_filter_corruptions(duration=DURATION_BASE, base_freq=None):
    """Technique 4: Filter Corruptions – multiple filters at different speeds,
    never in sync → constant unpredictable shifting tone."""
    n = int(duration * SR)
    if base_freq is None:
        base_freq = p_freq(5, A4 * 0.33)

    # Rich source: unison saw + square + a bit of noise
    L1, R1 = unison(n, base_freq, voices=5, detune_cents=7.0, waveform='saw')
    L2, R2 = unison(n, base_freq * 0.5, voices=3, detune_cents=5.0, waveform='square')
    noise = 0.12 * bandpass(pink_noise(n), 100, 6000)
    L = 0.65 * L1 + 0.25 * L2 + noise
    R = 0.65 * R1 + 0.25 * R2 + noise * 0.95

    # Three independent filter paths with incommensurate rates (E8 derived)
    r1 = p_rate(12, 0.05, 0.22)
    r2 = p_rate(18, 0.09, 0.37)
    r3 = p_rate(25, 0.13, 0.51)   # golden-ish incommensurate
    # Different shapes / phases
    lfo1 = 0.5 + 0.5 * make_lfo(n, r1, phase=0.0, shape='sine')
    lfo2 = 0.5 + 0.5 * make_lfo(n, r2, phase=1.7, shape='tri')
    lfo3 = 0.5 + 0.5 * make_lfo(n, r3, phase=3.1, shape='sine')

    # Cutoffs in different ranges so they fight
    cut_a = 400 + 2200 * lfo1
    cut_b = 900 + 2800 * lfo2
    cut_c = 300 + 1600 * lfo3   # lower, darker

    # Parallel multi-filter (classic "constantly shifting")
    fa = lowpass(L, cut_a)
    fb = lowpass(L, cut_b)
    fc = bandpass(L, cut_c * 0.6, cut_c * 2.8)
    L = 0.42 * fa + 0.33 * fb + 0.25 * fc

    fa = lowpass(R, cut_a * 1.04)
    fb = lowpass(R, cut_b * 0.96)
    fc = bandpass(R, cut_c * 0.65, cut_c * 2.6)
    R = 0.42 * fa + 0.33 * fb + 0.25 * fc

    # Light drive after filters (makes the movement more audible)
    L = soft_clip(L * 1.7, 1.5)
    R = soft_clip(R * 1.7, 1.5)

    env = adsr(n, attack=0.6, decay=1.5, sustain=0.8, release=4.5)
    L *= env
    R *= env

    mix = np.stack([L, R], axis=1)
    peak = np.max(np.abs(mix)) + 1e-9
    mix = mix / peak * 0.86
    return mix


def patch_fm_gone_wrong(duration=DURATION_BASE, base_freq=None):
    """Technique 5: FM Gone Wrong – unstable / slightly wrong ratios.
    Front 242 / industrial heavy FM tones."""
    n = int(duration * SR)
    if base_freq is None:
        base_freq = p_freq(9, A4 * 0.5)

    t = np.arange(n) / SR

    # Carrier
    # Two carriers with slight detune (instability)
    c1 = oscillator(n, base_freq, 'sine')
    c2 = oscillator(n, base_freq * (1 + p_detune_cents(33, 6)/1200), 'sine', phase0=0.4)

    # Modulators with *wrong* ratios derived from E8
    # Classic evil: 1.41, 2.17, 3.07, 0.73, etc. instead of 1,2,3
    ratio1 = p_ratio(15, center=1.0, spread=0.55)   # e.g. ~1.3-1.7
    ratio2 = p_ratio(29, center=2.0, spread=0.45)
    ratio3 = p_ratio(41, center=3.0, spread=0.6)

    # Time-varying ratios (subtle instability on the ratio itself)
    r_lfo = 1.0 + 0.04 * make_lfo(n, p_rate(7, 0.02, 0.09))
    m1 = np.sin(2 * np.pi * base_freq * ratio1 * r_lfo * t)
    m2 = np.sin(2 * np.pi * base_freq * ratio2 * t + 0.7)
    m3 = np.sin(2 * np.pi * base_freq * ratio3 * (1 + 0.02 * make_lfo(n, 0.11)) * t)

    # Index (depth) also slowly evolving
    idx1 = 1.8 + 1.2 * make_lfo(n, p_rate(11, 0.04, 0.2))
    idx2 = 0.9 + 0.7 * make_lfo(n, p_rate(16, 0.07, 0.28))
    idx3 = 0.5 + 0.4 * make_lfo(n, p_rate(23, 0.05, 0.15))

    # FM: phase modulation of carriers
    # c_mod = sin( 2π fc t + I * m )
    # We approximate by instantaneous phase
    phase1 = 2 * np.pi * base_freq * t + idx1 * m1 + 0.6 * idx2 * m2
    phase2 = 2 * np.pi * base_freq * 1.003 * t + 0.7 * idx1 * m1 + idx3 * m3 + 0.5

    car1 = np.sin(phase1)
    car2 = np.sin(phase2)

    L = 0.55 * car1 + 0.45 * car2
    R = 0.48 * car1 + 0.52 * car2   # slight stereo

    # Add a little noise-FM for extra chaos
    nmod = lowpass(pink_noise(n), 60) * 0.08
    L = L * (1 + nmod) + 0.1 * nmod
    R = R * (1 + nmod * 0.9)

    # Post filter that also moves
    cut = 1200 + 2200 * (0.5 + 0.5 * make_lfo(n, p_rate(20, 0.08, 0.4), shape='tri'))
    L = lowpass(L, cut)
    R = lowpass(R, cut * 0.95)

    # Distortion to make the inharmonic sidebands aggressive
    L = soft_clip(L * 2.1, 1.6)
    R = soft_clip(R * 2.1, 1.6)

    env = adsr(n, attack=0.25, decay=1.0, sustain=0.7, release=3.8)
    L *= env
    R *= env

    mix = np.stack([L, R], axis=1)
    peak = np.max(np.abs(mix)) + 1e-9
    mix = mix / peak * 0.85
    return mix


def patch_e8_triality_drone(duration=28.0):
    """All techniques stacked + E8 triality flavor (3-way interactions).
    Slow evolving dark drone / pad for cinematic or industrial use."""
    n = int(duration * SR)
    base = p_freq(1, A4 * 0.25)

    # Layer A: instability unison
    La, Ra = patch_instability(duration, base_freq=base * 1.0)[:, 0], patch_instability(duration, base_freq=base * 1.0)[:, 1]
    # We re-generate lighter versions to avoid double computation cost
    # (for real would cache, but fine)

    # Actually re-implement a composite to keep code self-contained & faster
    t = np.arange(n) / SR

    # --- Layer 1: detuned + micro pitch (instability + subtle)
    voices = 5
    L = np.zeros(n)
    R = np.zeros(n)
    micro = 0.018 * make_lfo(n, 0.07) + 0.012 * make_lfo(n, 0.13, shape='tri')
    inst_f = base * (1 + micro)
    for i in range(voices):
        det = (i - 2) * 4.2 * (1 + 0.09 * np.sin(PARAMS[i*2 % 40]))
        f = inst_f * (2 ** (det / 1200))
        ph = 2 * np.pi * np.cumsum(f) / SR + PARAMS[i*3 % 40]
        osc = 0.6 * np.sin(ph) + 0.4 * (2*(ph/(2*np.pi)%1)-1)
        pan = (i-2)*0.35
        L += osc * (0.5 - 0.5*pan)
        R += osc * (0.5 + 0.5*pan)
    L /= 3.2
    R /= 3.2

    # --- Layer 2: FM gone wrong (low)
    ratio = p_ratio(8, 1.5, 0.4)
    m = np.sin(2 * np.pi * base * 0.5 * ratio * t)
    idx = 1.4 + 0.9 * make_lfo(n, 0.05)
    ph_fm = 2 * np.pi * base * 0.5 * t + idx * m
    fm_layer = np.sin(ph_fm) * 0.35
    L += fm_layer
    R += fm_layer * 0.9

    # --- Layer 3: chaos noise corruption
    pn = pink_noise(n)
    noise_fm = lowpass(pn, 90) * 0.09
    L = L * (1 + noise_fm) + 0.12 * bandpass(pn, 150, 3500)
    R = R * (1 + noise_fm * 0.95) + 0.11 * bandpass(pn, 160, 3400)

    # --- Filter corruptions (dual + different rates)
    lfo_a = 0.5 + 0.5 * make_lfo(n, p_rate(4, 0.04, 0.18))
    lfo_b = 0.5 + 0.5 * make_lfo(n, p_rate(10, 0.09, 0.33), shape='tri')
    ca = 500 + 1800 * lfo_a
    cb = 1100 + 2400 * lfo_b
    L = 0.55 * lowpass(L, ca) + 0.45 * lowpass(L, cb)
    R = 0.55 * lowpass(R, ca*1.03) + 0.45 * lowpass(R, cb*0.97)

    # Final drive + waveshape
    L = soft_clip(waveshape(L, 0.3) * 1.9, 1.55)
    R = soft_clip(waveshape(R, 0.3) * 1.9, 1.55)

    # Long slow envelope (drone)
    env = adsr(n, attack=2.5, decay=3.0, sustain=0.85, release=8.0)
    # Extra slow amp breath
    breath = 0.75 + 0.25 * make_lfo(n, 0.03, shape='sine')
    L *= env * breath
    R *= env * breath

    mix = np.stack([L, R], axis=1)
    peak = np.max(np.abs(mix)) + 1e-9
    mix = mix / peak * 0.84
    return mix


def patch_doom_chaos(duration=20.0):
    """Mick Gordon / Doom-inspired: heavy noise+distortion chaos layer
    under a detuned aggressive mid lead. Pure evil."""
    n = int(duration * SR)
    base = p_freq(12, A4 * 0.75)

    # Aggressive mid lead with instability
    L, R = unison(n, base, voices=6, detune_cents=11.0, waveform='saw', uneven=True)

    # Extra sub
    sub = oscillator(n, base * 0.5, 'sine') * 0.4
    L += sub
    R += sub

    # Heavy chaos: white noise distorted and filtered, used both as layer and FM
    wn = white_noise(n)
    pn = pink_noise(n)
    chaos = 0.6 * wn + 0.4 * pn
    chaos = soft_clip(chaos * 3.5, 2.2)
    chaos = bandpass(chaos, 300, 5500)
    # FM the lead a bit with it
    L = L * (1.0 + 0.28 * lowpass(chaos, 200)) + 0.35 * chaos
    R = R * (1.0 + 0.28 * lowpass(chaos, 210)) + 0.33 * chaos

    # More drive
    L = soft_clip(L * 2.4, 1.7)
    R = soft_clip(R * 2.4, 1.7)

    # Filter movement (corrupt)
    cut = 800 + 2500 * (0.5 + 0.5 * make_lfo(n, 0.14, shape='tri'))
    L = lowpass(L, cut)
    R = lowpass(R, cut * 0.98)

    env = adsr(n, attack=0.05, decay=0.4, sustain=0.75, release=2.5)
    L *= env
    R *= env

    mix = np.stack([L, R], axis=1)
    peak = np.max(np.abs(mix)) + 1e-9
    mix = mix / peak * 0.88
    return mix


def patch_e8_roots_pulse(duration=18.0):
    """Sonify actual E8 root projections as a rhythmic / arpeggiated dark sequence.
    Uses successive root projections for pitch + the techniques on top."""
    n = int(duration * SR)
    t = np.arange(n) / SR

    # Take a path through roots: successive inner products give "melody"
    # Simple: project all roots onto a time-varying direction or just cycle a sequence
    # of 16 "notes" derived from sorted projections
    proj = np.abs(ROOTS @ (SIMPLE[0] + 0.3 * SIMPLE[7]))
    # Pick 12 unique-ish frequencies
    idxs = np.argsort(proj)[::20][:16]
    freqs = []
    for k, i in enumerate(idxs):
        # Map root coord sum / norm to freq around A4
        s = np.sum(np.abs(ROOTS[i]))
        f = A4 * 0.5 * (2 ** ((s - 2.0) * 0.6 + (k % 5) * 0.15))
        freqs.append(f)
    freqs = np.array(freqs)

    # Step sequence, 1/4 note ~ 0.4s at ~150 bpm feel
    step_len = int(0.38 * SR)
    L = np.zeros(n)
    R = np.zeros(n)
    for step in range(n // step_len + 1):
        start = step * step_len
        end = min(start + step_len, n)
        if start >= n:
            break
        f = freqs[step % len(freqs)]
        # local length
        nn = end - start
        # detuned unison short note
        for v in range(4):
            det = (v - 1.5) * 7.5
            osc = oscillator(nn, f, 'saw', detune_cents=det)
            pan = (v - 1.5) * 0.4
            env_note = np.linspace(1, 0.15, nn) ** 1.8   # percussive-ish
            L[start:end] += osc * env_note * (0.5 - 0.5*pan)
            R[start:end] += osc * env_note * (0.5 + 0.5*pan)
        # Add a little noise hit
        hit = white_noise(nn) * np.linspace(1, 0, nn)**3 * 0.15
        L[start:end] += hit
        R[start:end] += hit * 0.9

    L /= 3.5
    R /= 3.5

    # Global chaos + filter
    L = soft_clip(L * 1.8, 1.4)
    R = soft_clip(R * 1.8, 1.4)
    cut = 1500 + 1200 * make_lfo(n, 0.08)
    L = lowpass(L, cut)
    R = lowpass(R, cut)

    # Overall envelope
    env = adsr(n, 0.01, 0.1, 0.9, 1.5)
    L *= env
    R *= env

    mix = np.stack([L, R], axis=1)
    peak = np.max(np.abs(mix)) + 1e-9
    mix = mix / peak * 0.87
    return mix


# ---------------------------------------------------------------------------
# Main generation
# ---------------------------------------------------------------------------
def write_wav(path: Path, mix: np.ndarray, sr=SR):
    """Write stereo float32 [-1,1] as 16-bit PCM WAV."""
    # Ensure 2D
    if mix.ndim == 1:
        mix = np.stack([mix, mix], axis=1)
    # Clip + convert
    mix = np.clip(mix, -1.0, 1.0)
    pcm = (mix * 32767.0).astype(np.int16)
    wavfile.write(str(path), sr, pcm)
    print(f"  wrote {path.name}  ({mix.shape[0]/sr:.1f}s, peak={np.max(np.abs(mix)):.3f})")


def main():
    print("Generating E8-sonified dark synth bundle...")
    print(f"E8 roots loaded: {len(ROOTS)}")
    print(f"Parameter bank size: {len(PARAMS)}")
    print(f"Output dir: {OUTPUT_DIR}")
    print()

    patches = [
        ("01_e8_instability_detune_unison.wav",
         "Instability (detune + random pitch automation + uneven unison). E8 roots → detune cents & LFO seeds.",
         lambda: patch_instability(22.0)),

        ("02_e8_chaos_layer_noise_dist.wav",
         "Chaos Layer (noise + distortion + noise-as-FM). Classic Doom-style corruption. E8 → FM depth & filter rates.",
         lambda: patch_chaos_layer(20.5)),

        ("03_e8_subtle_chaos_micro.wav",
         "Subtle Chaos (stacked micro pitch / unison / barely-moving FM). The evil that accumulates. E8 micro depths.",
         lambda: patch_subtle_chaos(24.0)),

        ("04_e8_filter_corruptions.wav",
         "Filter Corruptions (multiple independent filters at incommensurate E8-derived rates). Constant unstable shift.",
         lambda: patch_filter_corruptions(21.0)),

        ("05_e8_fm_gone_wrong.wav",
         "FM Gone Wrong (unstable / slightly-wrong ratios + evolving index). Front 242 industrial heavy FM. E8 ratios.",
         lambda: patch_fm_gone_wrong(19.5)),

        ("06_e8_triality_drone_stack.wav",
         "Full stack + E8 triality drone (all techniques layered, long evolving, 3-way interactions).",
         lambda: patch_e8_triality_drone(28.0)),

        ("07_e8_doom_chaos_lead.wav",
         "Doom / Mick Gordon chaos lead (aggressive detuned + heavy distorted noise layer + filter).",
         lambda: patch_doom_chaos(18.0)),

        ("08_e8_roots_pulse_sequence.wav",
         "E8 root projections sonified as dark arpeggiated / pulsed sequence + chaos techniques.",
         lambda: patch_e8_roots_pulse(18.5)),
    ]

    meta = {
        "title": "E8 Sonified Dark Synth Bundle",
        "description": "WAV samples sonifying the E8 root system / lattice using the 'make any synth sound darker and meaner' techniques (instability, chaos layer, subtle chaos, filter corruptions, FM gone wrong).",
        "tuning": f"A4 = {A4} Hz",
        "sample_rate": SR,
        "bit_depth": 16,
        "channels": 2,
        "created": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "techniques_source": "YouTube transcript on dark/evil synth design (detune instability, noise+distortion, micro mods, multi-filter, unstable FM ratios)",
        "e8_source": "Standard 240 roots (D8-type + half-integer even parity) + simple roots. Parameters derived from absolute projections, silver/golden ratios, combinatorial invariants.",
        "files": []
    }

    for fname, desc, gen_fn in patches:
        print(f"Generating {fname} ...")
        audio = gen_fn()
        path = OUTPUT_DIR / fname
        write_wav(path, audio)
        dur = audio.shape[0] / SR
        meta["files"].append({
            "filename": fname,
            "duration_sec": round(dur, 2),
            "description": desc,
            "techniques": ["instability", "chaos_layer", "subtle_chaos", "filter_corruptions", "fm_gone_wrong"]
            if "triality" in fname or "doom" in fname else
            [k for k in ["instability", "chaos_layer", "subtle_chaos", "filter_corruptions", "fm_gone_wrong"] if k.split("_")[0] in desc.lower() or k in desc.lower()]
        })

    # Write README + JSON metadata
    readme = f"""# E8 Sonified Dark Synth Bundle
## QSOL-IMC / Spectral Algebraics style

Generated: {meta['created']}
Tuning: A4 = {A4} Hz | SR = {SR} | 16-bit stereo PCM

### Concept
These 8 WAV samples sonify geometry and invariants of the **E8 root system**
(240 roots in 8 dimensions) while deliberately applying the exact sound-design
techniques that make synths sound "heavy, dark and evil":

1. **Instability** – oscillators never perfectly in tune; few-percent detune +
   slight random pitch automation + uneven unison voices.
2. **Chaos Layer** – noise (white/pink) combined with distortion; noise used
   as subtle FM / corruption of the tone (Doom / Mick Gordon aesthetic).
3. **Subtle Chaos** – micro (almost inaudible alone) pitch / FM / unison
   inconsistencies stacked until the sum feels wrong.
4. **Filter Corruptions** – two or more filters modulated at *different*
   (incommensurate) rates so the spectrum is constantly shifting.
5. **FM Gone Wrong** – FM ratios that are deliberately slightly off
   (1.3x, 2.17x, 0.73x …) instead of clean integers; index slowly evolving.

All numerical parameters (detune cents, LFO rates, FM ratios, filter speeds,
modulation depths, base frequencies) are derived from projections and
combinatorial features of the E8 roots + simple roots + silver ratio
(φ_s = 1+√2) that appears in E8 literature.

### Files
"""
    for f in meta["files"]:
        readme += f"- **{f['filename']}** ({f['duration_sec']}s)\n  {f['description']}\n\n"

    readme += """
### Usage
Drop into any sampler / DAW. They are already stereo, normalized, and have
natural attacks/releases. Layer freely. The longer drones work well under
industrial / dark ambient / cyber-western / dystopian tracks.

### Technical notes
- Pure Python + NumPy + SciPy (no proprietary plugins).
- Deterministic (seeded with 0xE8).
- All processing is offline; no real-time constraints.
- Anti-aliasing is rudimentary (naive oscillators + post LP); for final masters
  you may want to re-render with better anti-aliased oscillators or oversampling.

### License / Credit
Free for personal / creative use in the spirit of open spectral algebraics.
If you release music with these, a nod to E8 + the original technique video
is appreciated but not required.

— generated for the QEC / SPECTRAL / E8 music continuum
"""

    (OUTPUT_DIR / "README.md").write_text(readme)
    (OUTPUT_DIR / "metadata.json").write_text(json.dumps(meta, indent=2))

    print("\nDone. Bundle contents:")
    for p in sorted(OUTPUT_DIR.glob("*.wav")):
        print(f"  {p.name}")
    print(f"\nREADME + metadata written. Total WAVs: {len(list(OUTPUT_DIR.glob('*.wav')))}")


if __name__ == "__main__":
    main()
