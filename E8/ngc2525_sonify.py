#!/usr/bin/env python3
"""
NGC 2525 (heic2018b) Hubble Image Sonification Generator

Creates a .wav file that sonifies the spiral galaxy NGC 2525 using a polar
"radar scan" method: the virtual scanner rotates around the galactic center
multiple times. 

Mapping (inspired by SYSTEM Sounds / NASA style sonifications):
  - Radial distance from center -> musical pitch (log-spaced frequencies)
      * Inner core/bulge (dense, older stars) -> deep bass frequencies
      * Outer spiral arms & star-forming regions -> higher, brighter tones
  - Local brightness (luminance from RGB) -> amplitude/volume of that frequency partial
  - Angular position (theta, multiple revolutions) -> progression of time
  - Subtle color accent: blue channel (star-forming regions in the image) slightly
    boosts amplitude of higher-frequency bins for extra "sparkle"

This produces an evolving, swirling cosmic soundscape where the spiral arms
create rhythmic variations and the core provides a continuous low drone that
brightens dramatically when the scanner aligns with bright structures.

The code is fully deterministic (no RNG), pure Python + numpy/scipy/PIL, and
designed for easy modification (params at top or via CLI args).

Usage:
  python ngc2525_sonify.py --help
  python ngc2525_sonify.py --duration 15 --revs 2 --size 256 --bins 24

Outputs: ngc2525_sonification.wav (and can be customized)

Requirements: pillow, numpy, scipy (standard scientific Python stack)
"""

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.io import wavfile


def compute_luminance(arr: np.ndarray) -> np.ndarray:
    """Standard perceptual luminance from linear RGB [0,1]."""
    return 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]


def sonify(
    image_path: str | Path,
    output_path: str | Path,
    duration: float = 18.0,
    revs: float = 2.0,
    resize_size: int = 280,
    num_bins: int = 26,
    f_min: float = 58.0,
    f_max: float = 2350.0,
    sample_rate: int = 44100,
    num_steps: int = 2200,
    color_boost: float = 0.35,
) -> None:
    """
    Perform the polar radar-scan sonification and write the .wav file.

    Parameters are tunable for exploration of different "interpretations" of the galaxy.
    """
    print(f"Loading image: {image_path}")
    img = Image.open(image_path).convert("RGB")
    img_resized = img.resize((resize_size, resize_size), Image.LANCZOS)
    arr = np.asarray(img_resized, dtype=np.float32) / 255.0

    gray = compute_luminance(arr)
    blue = arr[:, :, 2]  # for color accent on high bins

    h, w = gray.shape
    cx = w / 2.0
    cy = h / 2.0

    r_max = min(cx, cy, w - cx, h - cy) * 0.90

    freqs = np.geomspace(f_min, f_max, num_bins)

    print(
        f"Sonification params: duration={duration}s, revs={revs}, "
        f"size={resize_size}x{resize_size}, bins={num_bins}, "
        f"f_range=({f_min:.0f}-{f_max:.0f} Hz), steps={num_steps}"
    )

    total_samples = int(sample_rate * duration)
    audio = np.zeros(total_samples, dtype=np.float32)

    dtheta = 2.0 * np.pi * revs / num_steps
    phases = np.zeros(num_bins, dtype=np.float64)

    print("Scanning galaxy and synthesizing audio (this may take a few seconds)...")

    for i in range(num_steps):
        theta = i * dtheta

        amps = np.zeros(num_bins, dtype=np.float32)

        for b in range(num_bins):
            r_mid = (b + 0.5) / num_bins * r_max

            # Sample a small radial neighborhood for robustness against single-pixel noise
            radial_samples = []
            blue_samples = []
            for r_scale in [0.96, 1.0, 1.04]:
                r = r_mid * r_scale
                if r <= 0:
                    continue
                x = cx + r * np.cos(theta)
                y = cy + r * np.sin(theta)
                xi = int(round(x))
                yi = int(round(y))
                if 0 <= xi < w and 0 <= yi < h:
                    radial_samples.append(gray[yi, xi])
                    blue_samples.append(blue[yi, xi])

            if radial_samples:
                base_amp = float(np.mean(radial_samples))
                # Color accent: blue-rich regions (star formation) boost high-frequency bins
                blue_factor = 1.0 + color_boost * float(np.mean(blue_samples)) if b > num_bins * 0.55 else 1.0
                amps[b] = base_amp * blue_factor

        # Synthesize this angular slice
        start_idx = int(i * sample_rate * duration / num_steps)
        end_idx = int((i + 1) * sample_rate * duration / num_steps)
        if end_idx > total_samples:
            end_idx = total_samples
        n_samps = end_idx - start_idx
        if n_samps <= 0:
            continue

        tt = np.arange(n_samps, dtype=np.float64) / sample_rate

        for b in range(num_bins):
            amp = amps[b]
            if amp < 0.008:  # light noise gate
                continue
            omega = 2.0 * np.pi * freqs[b]
            wave = amp * np.sin(omega * tt + phases[b])
            audio[start_idx:end_idx] += wave.astype(np.float32)

            # Advance oscillator phase for continuity (prevents clicks)
            phases[b] = (phases[b] + omega * (n_samps / sample_rate)) % (2.0 * np.pi)

    # Post-processing: normalize + gentle fades
    print("Post-processing audio...")
    peak = np.max(np.abs(audio))
    if peak > 1e-9:
        audio = audio / peak * 0.82

    # 250 ms fade in/out
    fade_samples = int(sample_rate * 0.25)
    if fade_samples > 0 and total_samples > 2 * fade_samples:
        audio[:fade_samples] *= np.linspace(0.0, 1.0, fade_samples, dtype=np.float32)
        audio[-fade_samples:] *= np.linspace(1.0, 0.0, fade_samples, dtype=np.float32)

    # Write 16-bit PCM WAV
    audio_int16 = np.clip(audio * 32767, -32767, 32767).astype(np.int16)
    wavfile.write(str(output_path), sample_rate, audio_int16)

    print(f"\n✓ Sonification complete!")
    print(f"  Saved: {output_path}")
    print(f"  Duration: {duration:.1f} s | Revolutions: {revs} | Sample rate: {sample_rate} Hz")
    print(f"  Frequency mapping: {f_min:.0f} Hz (core) → {f_max:.0f} Hz (outer arms)")
    print(f"  Radial bins: {num_bins} | Angular steps: {num_steps}")
    print("\nInterpretation notes:")
    print("  • Deep continuous tones = galactic core / central bulge")
    print("  • Rising sparkling textures = spiral arms & star-forming regions (blue boosted)")
    print("  • Rhythmic pulses/variations = passage of arms across the scanner")
    print("  • Multiple revolutions let the ear track the winding structure repeating")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate a polar radar-scan sonification of NGC 2525 Hubble image",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--image", default="/home/workdir/attachments/heic2018b.jpg",
        help="Path to the input Hubble JPEG of NGC 2525"
    )
    parser.add_argument(
        "--output", default="/home/workdir/artifacts/ngc2525_sonification.wav",
        help="Output WAV file path"
    )
    parser.add_argument("--duration", type=float, default=18.0, help="Total audio duration in seconds")
    parser.add_argument("--revs", type=float, default=2.0, help="Number of full revolutions around the galaxy")
    parser.add_argument("--size", type=int, default=280, help="Square resize dimension (pixels)")
    parser.add_argument("--bins", type=int, default=26, help="Number of radial frequency bins (voices)")
    parser.add_argument("--fmin", type=float, default=58.0, help="Lowest frequency (Hz) for galactic core")
    parser.add_argument("--fmax", type=float, default=2350.0, help="Highest frequency (Hz) for outer arms")
    parser.add_argument(
        "--steps", type=int, default=2200, help="Number of angular time steps (higher = smoother)"
    )
    parser.add_argument(
        "--color-boost", type=float, default=0.35,
        help="Strength of blue-channel boost for high-frequency bins (star formation sparkle)"
    )

    args = parser.parse_args()

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    sonify(
        image_path=args.image,
        output_path=output_path,
        duration=args.duration,
        revs=args.revs,
        resize_size=args.size,
        num_bins=args.bins,
        f_min=args.fmin,
        f_max=args.fmax,
        num_steps=args.steps,
        color_boost=args.color_boost,
    )


if __name__ == "__main__":
    main()
