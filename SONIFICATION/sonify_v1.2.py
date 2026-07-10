import numpy as np
from scipy.io import wavfile
import os

# === OUTPUT DIRECTORY (works on your machine) ===
output_dir = os.path.expanduser("~/artifacts")
os.makedirs(output_dir, exist_ok=True)

SR = 48000
DURATION = 30.0
N = int(SR * DURATION)
T = np.linspace(0, DURATION, N, endpoint=False)

signal = np.zeros(N)

# Layer 1: Provenance lattice (cleaner, more "receipt-like" drone)
f_base = 48.0
signal += 0.32 * np.sin(2*np.pi*f_base*T) * (0.8 + 0.2*np.sin(2*np.pi*0.07*T))
signal += 0.11 * np.sin(2*np.pi*f_base*1.618*T)   # phi harmonic (recursive nod)

# Layer 2: Modal activity bursts (denser than v1.0)
for i in range(7):
    f = 195 + i*88
    env = np.zeros_like(T)
    for center in [5.5 + i*1.2, 18 + i*0.7]:
        env += np.exp(-((T-center)**2)/(2*1.6**2))
    signal += 0.07 * np.sin(2*np.pi*f*T) * np.clip(env,0,1)

# Layer 3: Dark subspaces + visibility leaks
rng = np.random.default_rng(2026)
noise = rng.standard_normal(N) * 0.07
dark = np.convolve(noise, np.ones(60)/60, mode='same')
dark_env = 0.22 + 0.18*np.sin(2*np.pi*0.025*T)
dark_env += 0.45 * np.exp(-((T-21)**2)/(2*2.2**2))
signal += dark * np.clip(dark_env, 0.15, 0.85)

# Layer 4: Receipt pulses + recursive fingerprint echo
pulse = 0.22 * ((np.sin(2*np.pi*7.5*T) > 0).astype(float))
signal += pulse * 0.12

# Recursive fingerprint (old motif returns as echo)
fp_start = int(2.2*SR)
fp_len = int(2.8*SR)
fp_t = T[fp_start:fp_start+fp_len]
fp = 0.28 * np.sin(2*np.pi*440*fp_t) * np.linspace(0.9,0.15,fp_len)
signal[fp_start:fp_start+fp_len] += fp

# Normalize + fade
signal = signal / np.max(np.abs(signal)) * 0.93
fade = int(0.7*SR)
signal[:fade] *= np.linspace(0,1,fade)
signal[-fade:] *= np.linspace(1,0,fade)

# === SAVE ===
output_path = os.path.join(output_dir, "collective_modes_v1.2_30s_prototype.wav")
wavfile.write(output_path, SR, signal.astype(np.float32))
print(f"✅ New v1.2 30s prototype saved to: {output_path}")
