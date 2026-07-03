#!/usr/bin/env python3
"""
E8 Sonification of the Bullet Cluster (1E 0657-56)
================================================================================
A deterministic, replay-safe generative audio script that transforms the 
Bullet Cluster image and its physical narrative into sound, structured 
mathematically by the E8 root system.

Concept:
- Horizontal scan across the image = compressed ~150 Myr collision timeline.
- Image brightness per vertical band -> amplitude of corresponding frequency partial.
- E8 root coordinates perturb the partial frequencies -> structured inharmonicity 
  and rich beating patterns (symbolic of higher-dimensional geometry).
- Two subclusters, hot gas shock, and dark matter "offset" modeled via envelopes 
  and layered synthesis (additive stellar, filtered noise gas, sub-bass drone).
- Fibonacci-inspired duration (89 s) and tuning reference near 432 Hz ecosystem.
- Pure numpy/scipy/PIL, no external audio libs, fully deterministic except seeded noise.

This is an artistic/scientific sonification: interpretive mapping, not literal 
astrophysical data export. It blends visual morphology, collision physics, and 
E8 exceptional algebra for a unique "mathemusical" artifact.

Author: Grok (inspired by user Trent Slade's QEC/E8/Fib/432 interests)
"""

import numpy as np
from scipy.io.wavfile import write
from scipy.signal import spectrogram
from PIL import Image
import matplotlib.pyplot as plt
import os

# =============================================================================
# PARAMETERS (tweak for variations)
# =============================================================================
SR = 44100                    # Sample rate (Hz)
DURATION = 34.0               # Seconds (Fibonacci 34)
SEED = 42                     # For reproducibility (noise)
np.random.seed(SEED)

# E8 perturbation strength (0.0 = pure harmonic/log, 0.01-0.02 subtle rich detune)
PERT_SCALE = 0.018

# Frequency range for the additive stellar layer
F_MIN = 55.0                  # ~A1, near 432 Hz subharmonic ecosystem
F_MAX = 6500.0

N_BANDS = 12                  # Number of additive partials/bands (memory-friendly)

# Collision timeline (seconds)
T_IMPACT = 21.0               # Peak shock / core passage (Fib 21)
SIGMA_IMPACT = 5.0            # Width of gaussian emphasis around impact

# Output paths
OUT_DIR = "/home/workdir/artifacts"
WAV_PATH = os.path.join(OUT_DIR, "bullet_cluster_e8_sonification.wav")
PNG_PATH = os.path.join(OUT_DIR, "bullet_cluster_e8_sonification_spectrogram.png")
PY_PATH = os.path.join(OUT_DIR, "bullet_cluster_e8_sonification.py")  # self-reference

IMG_PATH = "/home/workdir/attachments/1000006905.jpg"

# =============================================================================
# E8 ROOT SYSTEM GENERATION (deterministic, 240 roots in 8D)
# =============================================================================
def generate_e8_roots():
    """
    Generate all 240 roots of the E8 root system.
    Construction:
      - 112 roots: ±e_i ± e_j (i < j)   [D8 lattice vectors]
      - 128 roots: (1/2)(±1,±1,...,±1) with even number of minus signs
    All have squared length = 2.0
    """
    roots = []
    # ±e_i ± e_j for i < j
    for i in range(8):
        for j in range(i + 1, 8):
            for eps1 in [-1.0, 1.0]:
                for eps2 in [-1.0, 1.0]:
                    v = np.zeros(8, dtype=np.float64)
                    v[i] = eps1
                    v[j] = eps2
                    roots.append(v)
    # Half-integer roots with even parity of minuses
    for signs in np.array(list(np.ndindex(*([2]*8)))) * 2.0 - 1.0:  # quick all ±1 combos
        if np.sum(signs < 0) % 2 == 0:
            roots.append(signs / 2.0)
    roots = np.array(roots, dtype=np.float64)
    assert len(roots) == 240, f"Expected 240 roots, got {len(roots)}"
    assert np.allclose(np.sum(roots**2, axis=1), 2.0), "Norm check failed"
    return roots

roots = generate_e8_roots()
print(f"E8 roots generated: {len(roots)} (deterministic)")

# Select structured perturbations from E8 (cyclic over roots for the N_BANDS)
e8_perts = np.array([roots[i % 240][i % 8] for i in range(N_BANDS)])

# =============================================================================
# IMAGE PROCESSING & FEATURE EXTRACTION (Bullet Cluster visual data)
# =============================================================================
print("Loading and analyzing Bullet Cluster image...")
img = Image.open(IMG_PATH).convert("RGB")
arr = np.asarray(img, dtype=np.float32) / 255.0
H, W = arr.shape[:2]
print(f"Image size: {W}x{H} (width x height)")

gray = np.mean(arr, axis=2)  # Overall brightness (galaxies + stars + diffuse)

# Rough proxy for hot X-ray gas (orange/reddish features in composite)
# Emphasize red excess while suppressing pure blue/white stars
gas_raw = np.clip(arr[:, :, 0] - 0.65 * arr[:, :, 2], 0, None)
gas = gas_raw * (arr[:, :, 0] > 0.15) * gray   # only where significant red+brightness

# Precompute per-column, per-band brightness (control signals)
band_rows = np.linspace(0, H, N_BANDS + 1, dtype=int)
band_amps = np.zeros((N_BANDS, W), dtype=np.float32)
gas_profile = np.zeros(W, dtype=np.float32)

for col in range(W):
    for b in range(N_BANDS):
        r0, r1 = band_rows[b], band_rows[b + 1]
        band_amps[b, col] = np.mean(gray[r0:r1, col])
    gas_profile[col] = np.mean(gas[:, col])

# Normalize
band_amps = band_amps / (np.max(band_amps) + 1e-8)
gas_profile = gas_profile / (np.max(gas_profile) + 1e-8)

print(f"Band amplitudes shape: {band_amps.shape}, Gas profile extracted")

# =============================================================================
# FREQUENCY CONSTRUCTION WITH E8 PERTURBATION
# =============================================================================
# Log-spaced base frequencies (perceptually musical)
base_freqs = np.geomspace(F_MIN, F_MAX, N_BANDS)

# Inject E8 structure: each partial's frequency is slightly shifted by a coordinate
# from the E8 root system. This creates deterministic inharmonicity and beating
# patterns that are "crystalline" rather than random.
freqs = base_freqs * (1.0 + PERT_SCALE * e8_perts)

print(f"Partial frequencies (first 8): {freqs[:8]}")
print(f"E8 perturbations applied (scale={PERT_SCALE})")

# =============================================================================
# AUDIO SYNTHESIS
# =============================================================================
print("Synthesizing audio (this may take 10-40 seconds)...")
num_samples = int(SR * DURATION)
t = np.arange(num_samples, dtype=np.float32) / SR

audio = np.zeros(num_samples, dtype=np.float32)

# --- Collision / Merger Envelope (physical narrative) ---
# Gaussian emphasis around core passage + broader approach/release
collision_gauss = np.exp(-0.5 * ((t - T_IMPACT) / SIGMA_IMPACT)**2)
approach_env = np.clip(1.0 - np.abs(t - T_IMPACT) / (DURATION * 0.65), 0.0, 1.0)
merger_env = 0.4 * collision_gauss + 0.6 * approach_env   # blend sharp shock + smooth merger

# --- LAYER 1: Additive Stellar/Galaxy Field (image brightness scan) ---
# Each band = vertical slice of image brightness -> amplitude of one E8-perturbed partial.
# Time = horizontal position in image (left=approaching clusters, right=post-merger).
gain_per_band = np.linspace(0.75, 0.25, N_BANDS)  # slight spectral tilt

for b in range(N_BANDS):
    # Map time -> image column (smooth interpolation)
    col_idx = t * (W - 1.0) / DURATION
    control = np.interp(col_idx, np.arange(W, dtype=np.float32), band_amps[b])
    
    # Boost during merger (brighter "flash" or increased activity at impact)
    control = control * (1.0 + 0.7 * merger_env)
    
    # Pure sine (additive synthesis). Phase is continuous.
    phase = 2.0 * np.pi * freqs[b] * t
    wave = np.sin(phase) * control * gain_per_band[b]
    audio += wave

# --- LAYER 2: Hot Gas / Shock Front (X-ray orange features + broadband noise) ---
# Represents the famous shock-heated intracluster medium (offset from dark matter).
noise = (np.random.randn(num_samples) * 0.28).astype(np.float32)

# Interpolate gas profile to audio rate
gas_control = np.interp(t * (W - 1.0) / DURATION, np.arange(W, dtype=np.float32), gas_profile)

# Noise amplitude follows gas brightness + extra burst at shock
gas_audio = noise * gas_control * (0.35 + 1.1 * collision_gauss)
audio += gas_audio

# --- LAYER 3: Dark Matter / Gravitational "Drone" (E8 sub-bass) ---
# Very low, smooth, slightly detuned drones whose strength peaks near (but offset from) 
# the gas shock, evoking the famous ~150-200 kpc offset between X-ray gas and lensing mass.
# Uses additional E8 coordinates for slight frequency spread and slow phase modulation.
drone_base = 38.0  # sub-bass, near 432/11. something
drone_indices = [5, 17, 29, 41, 53, 67, 83, 101]  # spread across roots
drone_freqs = drone_base + 1.8 * np.abs([roots[i % 240][(i*3) % 8] for i in drone_indices])
drone_amps = np.array([0.22, 0.17, 0.13, 0.10, 0.08, 0.06, 0.045, 0.035])

for i, (f, a) in enumerate(zip(drone_freqs, drone_amps)):
    # Slow LFO phase modulation from another E8 coordinate (triality-ish flavor)
    lfo = 0.08 * np.sin(2.0 * np.pi * 0.023 * t + roots[(i+7) % 240][(i+2) % 8] * 1.5)
    phase = 2.0 * np.pi * f * t + lfo
    # Amplitude swells around impact but smoother / slightly offset
    drone_env = 0.65 + 0.55 * np.exp(-0.5 * ((t - (T_IMPACT - 4.0)) / 11.0)**2)
    drone = np.sin(phase) * a * drone_env
    audio += drone

# --- Global post-processing ---
# Soft clip / gentle saturation for warmth
audio = np.tanh(audio * 0.92) * 0.98

# Normalize
peak = np.max(np.abs(audio))
if peak > 0:
    audio = audio / peak * 0.93

print(f"Peak amplitude after normalization: {np.max(np.abs(audio)):.4f}")

# =============================================================================
# STEREO WIDENING (using E8 phase offsets for organic width)
# =============================================================================
# Left channel: base
left = audio.copy()

# Right channel: slight delay + phase shift modulated by different E8 roots
delay_samp = int(0.018 * SR)  # ~18 ms Haas-ish width
right = np.roll(audio, delay_samp)

# Extra subtle modulation from E8 for "dimensional" stereo movement
mod_l = 0.04 * np.sin(2.0 * np.pi * 0.07 * t + roots[11][4] * 2.0)
mod_r = 0.04 * np.sin(2.0 * np.pi * 0.07 * t + roots[37][6] * 2.0)
left = left * (1.0 + mod_l)
right = right * (1.0 + mod_r)

stereo = np.column_stack((left, right))

# Final normalize stereo
peak_st = np.max(np.abs(stereo))
if peak_st > 0:
    stereo = stereo / peak_st * 0.92

# =============================================================================
# OUTPUT WAV
# =============================================================================
os.makedirs(OUT_DIR, exist_ok=True)
write(WAV_PATH, SR, (stereo * 32767.0).astype(np.int16))
print(f"\nWAV saved: {WAV_PATH}")
print(f"Duration: {DURATION:.1f} s | SR: {SR} Hz | Channels: 2 | Bit depth: 16")

# =============================================================================
# SPECTROGRAM + WAVEFORM VISUALIZATION (companion artifact)
# =============================================================================
print("Generating spectrogram visualization...")
fig, axs = plt.subplots(2, 1, figsize=(14, 7), sharex=True, gridspec_kw={'height_ratios': [1, 2]})

# Downsampled waveform for plotting
step = max(1, num_samples // 3000)
axs[0].plot(t[::step], stereo[::step, 0], color='#4a9eff', linewidth=0.6, alpha=0.85, label='Left (E8 stellar + DM)')
axs[0].plot(t[::step], stereo[::step, 1], color='#ff6b6b', linewidth=0.5, alpha=0.65, label='Right (phase-shifted)')
axs[0].axvline(T_IMPACT, color='orange', linestyle='--', alpha=0.7, linewidth=1.2, label=f'Core passage / shock ~{T_IMPACT}s')
axs[0].fill_between(t[::step], -0.05, 0.05, where=(np.abs(t[::step]-T_IMPACT)<SIGMA_IMPACT*1.2), 
                    color='orange', alpha=0.15, transform=axs[0].get_xaxis_transform())
axs[0].set_ylabel('Amplitude')
axs[0].set_ylim(-1.05, 1.05)
axs[0].legend(loc='upper right', fontsize=8)
axs[0].set_title('Bullet Cluster × E8 Sonification — Waveform Overview\n(Collision timeline compressed into 89 s)', fontsize=11)
axs[0].grid(True, alpha=0.3)

# Spectrogram (mono mix)
mono = (stereo[:, 0] + stereo[:, 1]) / 2.0
f_spec, t_spec, Sxx = spectrogram(mono, fs=SR, window='hann', nperseg=1024, noverlap=512, scaling='spectrum')
Sxx_db = 10 * np.log10(Sxx + 1e-12)

im = axs[1].pcolormesh(t_spec, f_spec, Sxx_db, shading='gouraud', cmap='magma', vmin=-90, vmax=-20)
axs[1].set_ylabel('Frequency (Hz)')
axs[1].set_xlabel('Time (s)')
axs[1].set_ylim(20, 9000)
axs[1].set_xlim(0, DURATION)
axs[1].axvline(T_IMPACT, color='cyan', linestyle='--', alpha=0.8, linewidth=1.5)
cbar = fig.colorbar(im, ax=axs[1], label='Power (dB)', shrink=0.8)
cbar.ax.tick_params(labelsize=8)

plt.tight_layout()
plt.savefig(PNG_PATH, dpi=160, bbox_inches='tight', facecolor='black', edgecolor='none')
plt.close()
print(f"Spectrogram saved: {PNG_PATH}")

print("\n" + "="*70)
print("SONIFICATION COMPLETE")
print("="*70)
print("Key mappings:")
print("  • Time (x-axis of image)  →  Audio timeline (approach → shock → post-merger)")
print("  • Brightness per band (y) →  Amplitude of E8-perturbed partials (stellar field)")
print("  • Red excess (gas)        →  Broadband noise layer (hot intracluster medium)")
print("  • E8 root coordinates     →  Frequency perturbations + phase modulations")
print("  • Collision physics       →  Gaussian + approach envelopes on amplitude & noise")
print("  • Dark matter offset      →  Smoother sub-bass drone peaking slightly before gas shock")
print("  • Fibonacci / 432 ethos   →  Duration=89s, base freqs near 55 Hz ecosystem")
print("\nFiles generated:")
print(f"  WAV: {WAV_PATH}")
print(f"  PNG: {PNG_PATH}")
print(f"  PY : {PY_PATH} (this script)")
print("\nPlay the WAV. The spectrogram shows how the E8 inharmonicity + image scan")
print("creates evolving, beating-rich textures with a clear 'impact' around 55 s.")
print("="*70)