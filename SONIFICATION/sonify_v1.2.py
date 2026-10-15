import numpy as np
from scipy.io import wavfile
import os


def _smooth_dark_noise(noise):
    """Private width-60, zero-padded smoother for this prototype's noise.

    Only plain ndarray bounded, contiguous float64 vectors of 8192..1440000 samples use
    block-reset prefix sums. All other inputs retain NumPy's original path,
    including its short-input shape and nonfinite propagation. Within this
    bound the absolute error budget versus the direct FIR is 1e-9; equality
    of float64 values or arbitrary float32 renders is NOT promised. The
    fixed seed-2026 render has a separate exact PCM/WAV regression test.
    """
    if (type(noise) is not np.ndarray or noise.ndim != 1
            or noise.dtype != np.dtype(np.float64)
            or not noise.flags.c_contiguous
            or not 8192 <= noise.size <= 1_440_000
            or not (noise.min() >= -1.0 and noise.max() <= 1.0)):
        return np.convolve(noise, np.ones(60)/60, mode='same')

    # np.convolve(..., mode='same') for even width 60 uses x[i-30:i+30].
    # Reset every 8192 outputs to bound cancellation history; overlap 59
    # inputs between blocks. Accumulation and subtraction stay float64.
    padded = np.pad(noise, (30, 29))
    result = np.empty(noise.size, dtype=np.float64)
    for start in range(0, noise.size, 8192):
        stop = min(start + 8192, noise.size)
        chunk = padded[start:stop + 59]
        prefix = np.empty(chunk.size + 1, dtype=np.float64)
        prefix[0] = 0.0
        np.cumsum(chunk, dtype=np.float64, out=prefix[1:])
        result[start:stop] = (prefix[60:] - prefix[:-60]) / 60
    return result

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
dark = _smooth_dark_noise(noise)
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
