#!/usr/bin/env python3
"""
Sonification of Hubble M81 image (opo1438b)
Creates an ambient / cosmic Documentationcore-style track from the galaxy structure.
"""

import numpy as np
from PIL import Image
from scipy.io import wavfile
from scipy import signal
import os

# ============== CONFIG ==============
IMG_PATH = "/home/workdir/attachments/opo1438b.jpg"
OUTPUT_WAV = "/home/workdir/artifacts/M81_Hubble_Sonification.wav"
SAMPLE_RATE = 44100
DURATION_SEC = 90.0          # ~1.5 min ambient track
FADE_IN = 3.0
FADE_OUT = 8.0

# Musical parameters (432 Hz base for your preference)
BASE_FREQ = 432.0 / 4        # low C-ish / cosmic drone
# ============== LOAD & PREPROCESS ==============
print("Loading and preprocessing image...")
img = Image.open(IMG_PATH).convert("RGB")
# Resize for performance while keeping detail (width = time resolution-ish)
W, H = 800, 550
img = img.resize((W, H), Image.Resampling.LANCZOS)
arr = np.asarray(img, dtype=np.float32) / 255.0   # [0,1]

# Luminosity (ITU-R BT.601)
lum = 0.299 * arr[:,:,0] + 0.587 * arr[:,:,1] + 0.114 * arr[:,:,2]

# Color channels
R, G, B = arr[:,:,0], arr[:,:,1], arr[:,:,2]

# Color temperature proxy: blue - red (positive = blue young stars / SF regions)
color_temp = B - R

# Brightness of spiral arms / features
print(f"Image shape after resize: {arr.shape}")
print(f"Lum mean={lum.mean():.3f}, max={lum.max():.3f}")

# ============== SONIFICATION STRATEGY ==============
# 1. Time axis = horizontal scan (left → right across the galaxy)
# 2. Multiple layers:
#    - Deep drone from overall luminosity + core
#    - Mid pads from green / intermediate stars
#    - High crystalline tones from blue star-forming regions
#    - Sparse "star plucks" from brightest pixels
#    - Subtle spiral arm modulation via vertical gradients
# 3. Stereo: left/right panning based on vertical position of features

n_samples = int(SAMPLE_RATE * DURATION_SEC)
t = np.linspace(0, DURATION_SEC, n_samples, endpoint=False)

# Map image columns to time
# Use linear mapping: column 0 → t=0, column W-1 → t=DURATION
col_times = np.linspace(0, DURATION_SEC, W)

# Precompute per-column statistics (smoothed)
def smooth(x, win=7):
    return np.convolve(x, np.ones(win)/win, mode="same")

col_lum = smooth(lum.mean(axis=0))
col_blue = smooth(B.mean(axis=0))
col_red  = smooth(R.mean(axis=0))
col_green= smooth(G.mean(axis=0))
col_temp = smooth(color_temp.mean(axis=0))

# Normalize
col_lum = (col_lum - col_lum.min()) / (col_lum.max() - col_lum.min() + 1e-8)
col_blue = (col_blue - col_blue.min()) / (col_blue.max() - col_blue.min() + 1e-8)
col_red  = (col_red  - col_red.min())  / (col_red.max()  - col_red.min()  + 1e-8)
col_temp = (col_temp - col_temp.min()) / (col_temp.max() - col_temp.min() + 1e-8)

# Core brightness (central columns are brighter)
core_mask = np.exp(-0.5 * ((np.arange(W) - W/2) / (W*0.15))**2)
core_strength = col_lum * core_mask
core_strength = (core_strength - core_strength.min()) / (core_strength.max() + 1e-8)

# ============== AUDIO LAYERS ==============
print("Synthesizing layers...")

audio = np.zeros((n_samples, 2), dtype=np.float64)  # stereo

# --- Layer 1: Cosmic drone (low, from luminosity + core) ---
# Frequency slowly modulated by overall brightness
drone_base = BASE_FREQ * 0.5  # ~54 Hz
drone_mod = 0.15 * np.interp(t, col_times, col_lum)   # slight pitch wander
drone_freq = drone_base * (1.0 + drone_mod)

# Phase accumulation for clean FM-free sine
phase = np.cumsum(2 * np.pi * drone_freq / SAMPLE_RATE)
drone = 0.35 * np.sin(phase)

# Add sub-octave and 5th for richness
drone += 0.18 * np.sin(phase * 0.5)
drone += 0.12 * np.sin(phase * 1.5)

# Amplitude follows core + overall
drone_env = 0.4 + 0.6 * np.interp(t, col_times, core_strength)
drone *= drone_env
audio[:, 0] += drone * 0.7
audio[:, 1] += drone * 0.7

# --- Layer 2: Mid "starlight pads" (green/yellow intermediate) ---
# Three harmonic voices
for i, ratio in enumerate([1.0, 1.25, 1.5]):  # major triad-ish
    f0 = BASE_FREQ * 1.5 * ratio
    phase = np.cumsum(2 * np.pi * f0 * (1 + 0.08*np.interp(t, col_times, col_green)) / SAMPLE_RATE)
    pad = np.sin(phase) * 0.5 + 0.3 * np.sin(phase * 2)  # soft saw-ish
    env = 0.15 + 0.55 * np.interp(t, col_times, col_green)
    # Slow amplitude modulation for movement
    env *= (0.7 + 0.3 * np.sin(2*np.pi * 0.07 * t + i))
    audio[:, 0] += pad * env * 0.55
    audio[:, 1] += pad * env * 0.55

# --- Layer 3: Blue star-forming crystalline highs (spiral arms) ---
# Higher frequencies, more sparse, brighter when blue dominates
blue_f = BASE_FREQ * 4.0   # ~432*4 / something wait, ~ higher
for i, ratio in enumerate([1.0, 1.333, 2.0, 2.5]):
    f = blue_f * ratio
    # Slight detune based on color temp
    detune = 1.0 + 0.04 * (np.interp(t, col_times, col_temp) - 0.5)
    phase = np.cumsum(2 * np.pi * f * detune / SAMPLE_RATE)
    # Soft square / pure for crystalline
    cryst = np.sin(phase) ** 3   # softens
    env = 0.08 + 0.45 * np.interp(t, col_times, col_blue)**1.5
    # Sparkle LFO
    env *= (0.6 + 0.4 * np.sin(2*np.pi * (0.3 + 0.1*i) * t))
    # Pan based on "arm" position (vertical mean of blue)
    pan = 0.5 + 0.35 * np.sin(2*np.pi * 0.05 * t + i*1.2)  # slow swirl
    audio[:, 0] += cryst * env * (1 - pan)
    audio[:, 1] += cryst * env * pan

# --- Layer 4: Discrete bright stars as short "plucks" / glints ---
print("Adding stellar glints...")
# Find brightest local maxima in a downsampled grid
from scipy.ndimage import maximum_filter
lum_ds = lum[::4, ::4]
local_max = (lum_ds == maximum_filter(lum_ds, size=5)) & (lum_ds > 0.75)
ys, xs = np.where(local_max)
print(f"Found {len(xs)} bright star candidates")

# Map to time and frequency
rng = np.random.default_rng(42)
for y, x in zip(ys, xs):
    # Time = horizontal position
    onset = (x / (W//4 - 1)) * DURATION_SEC * 0.92 + 2.0
    if onset > DURATION_SEC - 1.5:
        continue
    # Pitch from vertical position + random
    # Higher in image (small y) → higher pitch (blue top? arbitrary aesthetic)
    pitch_ratio = 0.6 + 1.8 * (1.0 - y / (H//4))
    f = BASE_FREQ * 2.0 * pitch_ratio * (0.9 + 0.2*rng.random())
    
    # Short exponential decay pluck
    n_pluck = int(0.8 * SAMPLE_RATE)
    t_pluck = np.arange(n_pluck) / SAMPLE_RATE
    pluck = np.sin(2*np.pi * f * t_pluck) * np.exp(-t_pluck * 6.0)
    # Add harmonics
    pluck += 0.4 * np.sin(2*np.pi * f*2 * t_pluck) * np.exp(-t_pluck * 9)
    pluck += 0.2 * np.sin(2*np.pi * f*3 * t_pluck) * np.exp(-t_pluck * 12)
    pluck *= 0.25 * (lum_ds[y, x] ** 1.5)   # amplitude by brightness
    
    # Place in stereo with pan from vertical
    pan = y / (H//4)
    start = int(onset * SAMPLE_RATE)
    end = min(start + n_pluck, n_samples)
    audio[start:end, 0] += pluck[:end-start] * (1 - pan)
    audio[start:end, 1] += pluck[:end-start] * pan

# --- Layer 5: Subtle noise / dust lane texture from dark regions ---
# Pink-ish noise modulated by inverse luminosity (dust)
noise = rng.standard_normal(n_samples)
# Simple pink filter
b, a = signal.butter(1, 0.02, btype="low")
noise = signal.lfilter(b, a, noise)
noise = noise / (np.max(np.abs(noise)) + 1e-8)
dust_env = 0.08 * (1.0 - np.interp(t, col_times, col_lum))**1.2
audio[:, 0] += noise * dust_env * 0.6
audio[:, 1] += noise * dust_env * 0.6

# ============== ENVELOPES & MASTERING ==============
print("Applying fades and normalizing...")

# Fade in/out
fade_in_samples = int(FADE_IN * SAMPLE_RATE)
fade_out_samples = int(FADE_OUT * SAMPLE_RATE)
audio[:fade_in_samples] *= np.linspace(0, 1, fade_in_samples)[:, None]
audio[-fade_out_samples:] *= np.linspace(1, 0, fade_out_samples)[:, None]

# Soft clip / normalize to -1..1 with headroom
peak = np.max(np.abs(audio))
if peak > 0:
    audio = audio / peak * 0.92

# Gentle high-pass to remove DC
b, a = signal.butter(2, 25 / (SAMPLE_RATE/2), btype="high")
audio[:, 0] = signal.lfilter(b, a, audio[:, 0])
audio[:, 1] = signal.lfilter(b, a, audio[:, 1])

# Convert to int16
audio_int16 = np.int16(audio * 32767)

# Write WAV
wavfile.write(OUTPUT_WAV, SAMPLE_RATE, audio_int16)
print(f"Wrote {OUTPUT_WAV}")
print(f"Duration: {DURATION_SEC}s @ {SAMPLE_RATE} Hz")
print("Done.")
