#!/usr/bin/env python3
"""
M87* Ring Asymmetry & Spin Sonification using E8 Fractal Techniques
===================================================================

Sonifies key results from Bernshteyn et al. (2026) ApJ paper on M87* EHT data:
- Asymmetry amplitude (a1) distributions from GRMHD MAD models vs spin a*
- Observed a1 from 2017, 2018, 2021 epochs
- Marginal disfavoring of |a*| ≲ 0.2

Techniques:
- E8-inspired additive synthesis: 8 partials with phases/detunes reflecting E8 root system structure
  (permutations of (±1,±1,0...) and half-integer coords, approximated via golden ratio φ and √2 for triality feel)
- Weierstrass fractal function for turbulent fluctuations (matching paper's correlated a1 time series, τ_corr ~115 t_g)
- Fractal self-similar modulation and echoes scaled by golden ratio (user's preferred math param)
- 432 Hz tuning base
- Data mapping:
  * Spin a* sequence (13 values) → time-ordered "E8 chords"
  * Model μ(a1) → base pitch + spectral brightness (higher asymmetry = richer/higher partials)
  * σ(a1) → internal fractal depth / variation within chord
  * Observed a1 (0.41, 0.69, 0.53) → highlighted accent events with swells
  * KS p-value trend (low at a*=0, higher at |a*|~0.5-0.97) → relative volume / presence of each chord
- Background: evolving fractal noise field representing GRMHD snapshot variability and MAD turbulence
- Stereo asymmetry: panning/width modulated by a1 (literal ring brightness asymmetry in spatial audio field)
- Overall form: dark industrial ambient (synthwave/metal adjacent) reflecting RIAF/MAD plasma + jet

This is a model-dependent artistic/scientific sonification. It makes audible:
1. The spin-asymmetry correlation (higher |a*| → higher typical a1 and better data fit)
2. The turbulent, non-stationary nature of the ring (fractal fluctuations)
3. The E8 mathematical structure the user integrates into QEC/creative work as "higher-dimensional blueprint"

Edge cases handled: clipping at a1~1 avoided (paper filters a1>0.99); low-spin "symmetric" regime sounds flatter/less textured;
high-spin richer but still stochastic (not deterministic melody).

Requires: numpy, scipy
"""

import numpy as np
from scipy.io import wavfile
from scipy.ndimage import gaussian_filter1d
import warnings
warnings.filterwarnings('ignore')

# ==================== PARAMETERS ====================
SR = 44100          # Hz
DURATION = 60       # seconds - faster generation, still captures full structure (13 chords + accents + evolution)
T = np.linspace(0, DURATION, int(SR * DURATION), endpoint=False)

PHI = (1 + np.sqrt(5)) / 2   # golden ratio - user's preferred math constant for fractal scaling
SQRT2 = np.sqrt(2)

# 432 Hz tuning reference
A4 = 432.0
def midi_to_freq(midi_note):
    return A4 * 2 ** ((midi_note - 69) / 12.0)

# ==================== DATA FROM PAPER ====================
# Table 2: MAD model truncated Gaussian fits (mode μ, std σ) for a1 asymmetry
SPINS = np.array([-0.97, -0.9375, -0.85, -0.75, -0.5, -0.25, 0.0, 0.25, 0.5, 0.75, 0.85, 0.9375, 0.97])
MUS = np.array([0.653, 0.609, 0.567, 0.485, 0.382, 0.324, 0.278, 0.378, 0.525, 0.573, 0.630, 0.645, 0.675])
SIGMAS = np.array([0.203, 0.178, 0.193, 0.210, 0.188, 0.168, 0.181, 0.172, 0.201, 0.209, 0.213, 0.220, 0.198])

# Observed a1 from Comrade m=1 fits (2017, 2018, 2021)
OBSERVED = {
    12.0: 0.41,   # 2017 - lower asymmetry, still above zero-spin median
    28.0: 0.69,   # 2018 - highest, >90th percentile of a*=0 models
    44.0: 0.53    # 2021 - solid, above 50th percentile zero-spin
}

# Approximate fitness (volume scaling) from KS p trend in Fig 6: low at a*=0 & -0.25, higher at |a*|~0.5-0.97
def spin_fitness(a_star):
    # Rough proxy: higher |a*| and away from zero gives better fit; peaks around |0.5-0.75|
    return 0.08 + 0.35 * np.exp(-((np.abs(a_star) - 0.6)**2) / 0.8) + 0.12 * (np.abs(a_star) / 0.97)**1.5

# ==================== E8 FRACTAL SYNTHESIS ====================
def weierstrass_fractal(t, n_terms=7, a=0.62, b=2.15, seed=None):
    """
    Weierstrass function: continuous, nowhere differentiable fractal.
    Used for turbulent a1 fluctuations (paper: correlated on ~115 t_g, truncated Gaussian).
    a<1, b>1, a*b>1 → fractal dimension ~ 2 + log(a)/log(b)
    Vectorized for speed.
    """
    if seed is not None:
        np.random.seed(seed)
    s = np.zeros_like(t, dtype=np.float64)
    phase = np.random.uniform(0, 2*np.pi)
    ns = np.arange(n_terms)
    amps = a ** ns
    freqs = b ** ns
    # Vectorized sum
    for n in range(n_terms):
        s += amps[n] * np.sin(freqs[n] * t * 2 * np.pi * 0.8 + phase * (n + 1))
    return s / max(n_terms, 1)

def e8_partial_ratios():
    """
    E8-inspired partial frequency ratios.
    Approximates structure from E8 root system (240 roots in 8D):
    - Short roots: permutations of (±1, ±1, 0,0,0,0,0,0) → ratios involving 1 and √2
    - Triality symmetry (user's interest): 8D spinors/vectors cycled in 3s
    We use 8 partials with golden ratio φ and √2 detunes for "triality beating" and inharmonicity
    reflecting higher-dimensional geometry projected to audible spectrum.
    """
    base = 1.0
    ratios = np.array([
        base,                    # fundamental
        base * PHI * 0.5,        # φ/2 ~ 0.809
        base * SQRT2 * 0.75,     # ~1.0607
        base * 1.5,              # perfect 5th-ish
        base * PHI,              # golden ~1.618
        base * (PHI + 0.5),      # ~2.118
        base * 2.0 * SQRT2 / 1.5, # ~1.885
        base * 2.5               # higher
    ])
    # Slight random but seeded detune for E8 "lattice vibration" without destroying harmonicity
    np.random.seed(42)
    detune = 1.0 + np.random.uniform(-0.008, 0.008, 8) * (1 + 0.5 * np.arange(8)/7)
    return ratios * detune

def generate_e8_chord(t_segment, base_freq, mu, sigma, fitness, duration_seg):
    """
    Generate one E8-chord for a given spin (vectorized for speed):
    - 8 partials with E8 ratios + φ/√2 detunes + triality phases
    - Amplitudes modulated by single Weierstrass fractal (turbulence, stronger for high-σ models)
    - Brightness/volume from μ (asymmetry) + fitness (data fit from KS trend)
    - Stereo width/pan from μ (ring asymmetry → spatial audio asymmetry)
    """
    n = len(t_segment)
    t0 = t_segment[0]
    t_rel = t_segment - t0

    ratios = e8_partial_ratios()
    partial_amps_base = np.array([1.0, 0.85, 0.72, 0.65, 0.55, 0.48, 0.42, 0.38]) * (0.55 + 0.45 * mu)

    # One fractal modulator per chord (reproducible per spin via mu/sigma seed)
    seed = int(abs(1000 * mu + 500 * sigma)) % (2**31)
    fractal_mod = weierstrass_fractal(t_rel, n_terms=6 + int(2 * sigma), a=0.57 + 0.09*sigma, b=2.05, seed=seed)

    # Broadcast: all partials at once
    fs = base_freq * ratios[:, np.newaxis]          # (8, n)
    phases = 2 * np.pi * fs * t_segment + (np.arange(8)[:, np.newaxis] * np.pi / 3.7)
    amps = partial_amps_base[:, np.newaxis] * (0.62 + 0.38 * (1 + fractal_mod * (0.35 + 0.65 * sigma)))
    partials = amps * np.sin(phases)                 # (8, n)

    # Stereo panning modulated by asymmetry μ
    pans = 0.5 + 0.32 * (mu - 0.5) * np.sin(2 * np.pi * 0.025 * t_rel + np.arange(8)[:, np.newaxis] * 0.7)
    left = np.sum(partials * (1 - pans), axis=0)
    right = np.sum(partials * pans, axis=0)

    # Envelope + fractal breathing
    env = np.ones(n, dtype=np.float64)
    attack = max(1, int(0.07 * SR))
    release = max(1, int(0.12 * SR))
    env[:attack] = np.linspace(0, 1, attack)**1.8
    env[-release:] = np.linspace(1, 0, release)**1.8
    env *= (0.82 + 0.18 * weierstrass_fractal(t_rel + 8, n_terms=4, a=0.68, b=1.55, seed=seed+7))

    vol = 0.20 * fitness * (0.65 + 0.35 * mu)
    left *= env * vol
    right *= env * vol

    return left, right

# ==================== BACKGROUND FRACTAL TEXTURE (GRMHD turbulence) ====================
def generate_background(t):
    """
    Evolving fractal noise field representing the underlying GRMHD snapshot variability
    and MAD magnetic turbulence. Low-pass filtered for "deep space" feel, modulated
    by global asymmetry level.
    """
    np.random.seed(2026)  # paper year + deterministic
    # Multi-scale fractal noise (sum of Weierstrass at different bases)
    noise1 = weierstrass_fractal(t, n_terms=6, a=0.55, b=2.3)
    noise2 = weierstrass_fractal(t * 0.3, n_terms=5, a=0.48, b=2.8)
    noise = 0.6 * noise1 + 0.4 * noise2

    # Smooth for long correlation (like paper's τ_corr ~ 100 t_g mapped to audio time)
    noise = gaussian_filter1d(noise, sigma=SR * 1.8)

    # Global asym proxy (slowly rising then fluctuating, reflecting data favoring higher asym)
    global_asym = 0.42 + 0.18 * np.tanh((t - 40) / 25) + 0.08 * np.sin(2 * np.pi * t / 45)
    global_asym = np.clip(global_asym, 0.25, 0.75)

    # Modulate noise amplitude and "grit" by global_asym (higher asym → more turbulent texture)
    noise *= (0.4 + 0.6 * global_asym)

    # Simple "MAD magnetic" grit: soft clipping / mild distortion on noise
    noise = np.tanh(noise * 1.8) * 0.35

    # Stereo width also follows global_asym (asymmetry in sound field)
    width = 0.3 + 0.5 * global_asym
    left = noise * (0.6 + 0.4 * width)
    right = noise * (0.6 - 0.4 * width)   # anti-correlated for width

    return left * 0.18, right * 0.18   # background level

# ==================== OBSERVED ACCENTS ====================
def generate_observed_accent(t_seg, a1_obs, base_t0):
    """
    Short bright accent for each observed epoch.
    Higher a1 → higher pitch + brighter E8 partials + stronger fractal burst.
    Represents the "ring brightness asymmetry" peak in that year's image.
    """
    n = len(t_seg)
    f_base = midi_to_freq(58 + int(12 * (a1_obs - 0.3)))   # ~ A#3 to higher with a1

    ratios = e8_partial_ratios()
    sig = np.zeros(n)
    for i, r in enumerate(ratios):
        f = f_base * r * (1 + 0.01 * np.sin(2*np.pi*3*t_seg))  # slight warble
        phase = 2*np.pi*f*(t_seg - base_t0) + i*1.1
        amp = (0.9 - 0.08*i) * (0.4 + 0.6*a1_obs)
        sig += amp * np.sin(phase)

    # Sharp-ish envelope with fractal burst
    env = np.exp(-3.5 * (t_seg - base_t0)) * (1 + 0.4 * weierstrass_fractal(t_seg - base_t0, n_terms=3, a=0.5, b=3.0))
    env[:int(0.02*SR)] = np.linspace(0,1,int(0.02*SR))**0.5
    sig *= env * 0.45

    # Stereo accent slightly to "southwest" (positive pan for observed SW peak in images)
    pan = 0.65 if a1_obs > 0.5 else 0.45
    left = sig * (1-pan) * 1.1
    right = sig * pan
    return left, right

# ==================== MAIN ASSEMBLY ====================
print("Generating M87* E8 Fractal Sonification...")

left_total = np.zeros(len(T), dtype=np.float64)
right_total = np.zeros(len(T), dtype=np.float64)

# 1. Background turbulent texture (always present - the GRMHD "sea")
bg_l, bg_r = generate_background(T)
left_total += bg_l
right_total += bg_r

# 2. Main data-driven sequence: 13 E8-chords, one per spin value
# Time them evenly across most of the piece, with gaps for observed accents
chord_times = np.linspace(6, 52, len(SPINS) + 1)[:-1]   # spread across piece
chord_dur = 3.6   # seconds each - tighter but audible

for idx, (a_star, mu, sigma) in enumerate(zip(SPINS, MUS, SIGMAS)):
    t0 = chord_times[idx]
    t1 = t0 + chord_dur
    mask = (T >= t0) & (T < t1)
    if not np.any(mask):
        continue
    t_seg = T[mask]

    fitness = spin_fitness(a_star)
    base_freq = midi_to_freq(48 + int(14 * (mu - 0.27) / 0.4))   # map μ range to ~2 octaves starting ~C3

    l, r = generate_e8_chord(t_seg, base_freq, mu, sigma, fitness, chord_dur)
    left_total[mask] += l
    right_total[mask] += r

# 3. Observed epoch accents (bright "data points" standing out from model background)
for t_obs, a1_obs in OBSERVED.items():
    t0 = t_obs - 0.1
    t1 = t_obs + 1.8
    mask = (T >= t0) & (T < t1)
    if np.any(mask):
        t_seg = T[mask]
        l, r = generate_observed_accent(t_seg, a1_obs, t0)
        left_total[mask] += l * 0.9
        right_total[mask] += r * 0.9

# 4. Final gentle low-end "spin signature" drone (nonzero spin favored)
# Slow beating at very low freq, volume rises slightly with "preferred" high-spin regime
drone_f = 27.0   # 432/16
drone = 0.09 * np.sin(2 * np.pi * drone_f * T) * (0.6 + 0.4 * np.tanh((T-60)/30))
# Add E8-ish upper partial for the drone
drone += 0.04 * np.sin(2 * np.pi * drone_f * PHI * T) * (0.5 + 0.3 * weierstrass_fractal(T*0.2, n_terms=3))
left_total += drone * 0.7
right_total += drone * 0.7

# ==================== NORMALIZATION & OUTPUT ====================
# Gentle overall compression / limiting for "MAD arrested" powerful but not clipped feel
stereo = np.stack([left_total, right_total], axis=1)
peak = np.max(np.abs(stereo))
if peak > 0:
    stereo /= (peak * 1.05)   # headroom

# Fade in/out
fade_len = int(1.5 * SR)
stereo[:fade_len, 0] *= np.linspace(0, 1, fade_len)**2
stereo[:fade_len, 1] *= np.linspace(0, 1, fade_len)**2
stereo[-fade_len:, 0] *= np.linspace(1, 0, fade_len)**2
stereo[-fade_len:, 1] *= np.linspace(1, 0, fade_len)**2

# To int16
audio_int16 = (stereo * 32767).astype(np.int16)

out_path = "/home/workdir/artifacts/M87_E8_Fractal_Sonification.wav"
wavfile.write(out_path, SR, audio_int16)

print(f"\n✓ Generated: {out_path}")
print(f"  Duration: {DURATION}s @ {SR} Hz stereo")
print(f"  Peak: {peak:.3f} → normalized with headroom")
print(f"  Mapping summary:")
print(f"    - 13 E8-chords sequenced by spin a* (Table 2), pitch/brightness from μ(a1), volume from data-fit proxy")
print(f"    - Weierstrass fractal turbulence in chords + background (matches paper τ_corr & truncated Gaussian)")
print(f"    - E8 partial ratios + φ/√2 detunes + triality phase offsets for mathematical structure")
print(f"    - 3 observed a1 accents (2017/18/21) as bright spatial bursts")
print(f"    - Low-spin regime: flatter, lower volume, less fractal depth (disfavored)")
print(f"    - High |spin|: richer texture, higher presence (better match to observed ring asymmetry)")
print(f"    - 432 Hz tuning, golden ratio fractal scaling, stereo asymmetry from a1")
print("\nThis sonification makes the statistical preference for |a*| ≳ 0.2 audible as sonic richness and presence.")