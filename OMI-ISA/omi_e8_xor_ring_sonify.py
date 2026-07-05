#!/usr/bin/env python3
"""
OMI-ISA E8 Fractal XOR Ring Sonification
=======================================

Generates a 16-bit PCM .wav file by sonifying the deterministic
reversible delta law from the OMI-ISA project:
    https://github.com/bthornemail/omi-isa

Delta Law (core of the "16-bit deterministic ring with XOR"):
    Δ(x) = rotl(x,1) ⊕ rotl(x,3) ⊕ rotr(x,2) ⊕ 0xA5A5A5A5

This map is information-preserving (XOR + rotations are bijective),
so iteration produces a deterministic orbit ("ring") in 32-bit space.
The delta_acc accumulator tracks cumulative XOR of results (mimicking
the VM's invariant trace, excluding R0).

Sonification approach:
- Iterate the delta map at audio rate (or controlled sub-rate).
- Derive 16-bit samples directly from the evolving 32-bit state
  using XOR mixing of high/low words (captures the "XOR ring" spirit).
- This is raw deterministic data-bending / math sonification:
  you are literally *listening to the orbit* of this dynamical system.
- Connection to E8 / user's QEC work: The bit-mixing via rotations
  and XOR has structural similarities to lattice automorphisms,
  triality mixing, and error-correcting code state evolution.
  The 8 registers in OMI-ISA loosely echo E8's 8-dimensional nature.

Why it sounds the way it does:
- Rapid state evolution → broadband digital noise with deterministic
  correlations (not pure white noise; has "character" from the specific
  mixing function).
- The constant 0xA5A5A5A5 (alternating bit pattern) seeds strong
  high-frequency content and prevents trivial fixed points.
- Over long time, the orbit may exhibit subtle periodicities or
  spectral evolution as it traverses the state space.

Usage examples:
    python omi_e8_xor_ring_sonify.py --duration 15 --output omi_xor_ring_15s.wav
    python omi_e8_xor_ring_sonify.py --seed 0xDEADBEEF --update-rate 4410 --duration 60

Requirements: Pure Python stdlib (wave, struct, argparse). No external deps.

Author: Grok (inspired by Trent Slade / QSOL-IMC QEC + E8 interests)
"""

import wave
import struct
import argparse
import sys

# --- Core OMI Delta Law (exact match to cpu.c) ---

def rotl32(x: int, r: int) -> int:
    """Rotate left 32-bit unsigned."""
    r = r % 32
    return ((x << r) | (x >> (32 - r))) & 0xFFFFFFFF

def rotr32(x: int, r: int) -> int:
    """Rotate right 32-bit unsigned."""
    r = r % 32
    return ((x >> r) | (x << (32 - r))) & 0xFFFFFFFF

def omi_delta(x: int) -> int:
    """
    The reversible XOR-rotation delta law.
    Exactly as implemented in OMI-ISA DELTA instruction and initial seed.
    """
    C = 0xA5A5A5A5
    return (rotl32(x, 1) ^ rotl32(x, 3) ^ rotr32(x, 2) ^ C) & 0xFFFFFFFF

# --- Sonification ---

def generate_xor_ring_wav(
    output_path: str,
    duration_sec: float = 30.0,
    sample_rate: int = 44100,
    seed: int = 0xA5A5A5A5,
    state_update_rate: float = 44100.0,  # Hz: how often to apply delta
    stereo: bool = False,
    verbose: bool = True
) -> None:
    """
    Generate 16-bit PCM WAV by iterating the OMI delta law.

    state_update_rate controls evolution speed:
      - 44100 Hz → state changes every sample (very rapid, noisy texture)
      -  4410 Hz → state changes every ~10 samples (richer evolving texture)
      -   100 Hz → slower, more "ringing" / tonal character possible

    The sample is derived as:
        low = state & 0xFFFF
        high = (state >> 16) & 0xFFFF
        mixed = (low ^ high) & 0xFFFF
    This emphasizes the XOR at the heart of the delta law.
    Centered to signed 16-bit range.
    """
    num_samples = int(duration_sec * sample_rate)
    if num_samples <= 0:
        raise ValueError("Duration must produce at least one sample")

    # Update state every N audio samples
    if state_update_rate <= 0:
        state_update_rate = sample_rate
    samples_per_update = max(1, int(sample_rate / state_update_rate))

    state = seed & 0xFFFFFFFF
    delta_acc = seed & 0xFFFFFFFF   # mimic VM accumulator
    # Extra "register" to create compound long-period dynamics (like multi-reg VM)
    aux = (seed ^ 0xDEADBEEF) & 0xFFFFFFFF

    n_channels = 2 if stereo else 1

    with wave.open(output_path, 'w') as wf:
        wf.setnchannels(n_channels)
        wf.setsampwidth(2)          # 16-bit
        wf.setframerate(sample_rate)

        prev_mixed = 0
        for i in range(num_samples):
            # Evolve state at controlled rate using *compound* delta + XOR ops
            # This mimics the multi-register, multi-instruction nature of OMI-ISA
            # and produces much longer deterministic orbits than single delta iteration.
            if i % samples_per_update == 0:
                # Chain of operations inspired by DELTA + XOR + rotation mixing
                d1 = omi_delta(state)
                d2 = omi_delta(aux)
                # Cross-XOR and feed back (like register exchange + accumulate)
                new_state = (state ^ d1 ^ (d2 >> 7)) & 0xFFFFFFFF
                new_aux = (aux ^ d2 ^ (d1 << 3)) & 0xFFFFFFFF
                # Accumulate into delta_acc exactly as the VM does for non-R0 results
                delta_acc = (delta_acc ^ new_state ^ new_aux) & 0xFFFFFFFF

                state = new_state
                aux = new_aux

            # Derive 16-bit sample from current state (XOR ring emphasis)
            low = state & 0xFFFF
            high = (state >> 16) & 0xFFFF
            mixed = (low ^ high) & 0xFFFF

            # Optional simple linear interpolation toward new value for anti-aliasing
            # when updates are infrequent (makes it less stair-steppy)
            if samples_per_update > 1:
                alpha = (i % samples_per_update) / samples_per_update
                mixed = int(prev_mixed * (1 - alpha) + mixed * alpha) & 0xFFFF

            # Center to signed 16-bit: 0..65535 -> -32768..+32767
            signed_sample = mixed - 32768

            if stereo:
                # Simple stereo: left = mixed from state, right = variant from delta_acc + aux
                low_acc = delta_acc & 0xFFFF
                high_acc = (delta_acc >> 16) & 0xFFFF
                mixed_r = (low_acc ^ (high_acc >> 1) ^ (aux & 0xFFFF)) & 0xFFFF
                signed_r = mixed_r - 32768
                wf.writeframes(struct.pack('<hh', signed_sample, signed_r))
            else:
                wf.writeframes(struct.pack('<h', signed_sample))

            prev_mixed = mixed

    if verbose:
        print(f"✓ Generated: {output_path}")
        print(f"  Duration: {duration_sec:.1f}s | SR: {sample_rate} Hz | Samples: {num_samples}")
        print(f"  Seed: 0x{seed:08X} | State update rate: {state_update_rate:.1f} Hz")
        print(f"  Channels: {'stereo' if stereo else 'mono'}")
        print(f"  Final state: 0x{state:08X} | aux: 0x{aux:08X} | delta_acc: 0x{delta_acc:08X}")
        print("  This is the sound of the compound OMI delta + XOR ring orbit (long-period deterministic).")

def main():
    parser = argparse.ArgumentParser(
        description="OMI-ISA E8 Fractal XOR Ring Sonification - 16-bit deterministic .wav from delta law"
    )
    parser.add_argument("--output", "-o", default="omi_e8_xor_ring.wav",
                        help="Output WAV filename (default: omi_e8_xor_ring.wav)")
    parser.add_argument("--duration", "-d", type=float, default=30.0,
                        help="Duration in seconds (default: 30)")
    parser.add_argument("--sample-rate", "-sr", type=int, default=44100,
                        help="Sample rate in Hz (default: 44100)")
    parser.add_argument("--seed", type=lambda x: int(x, 0), default=0xA5A5A5A5,
                        help="32-bit seed in hex or decimal (default: 0xA5A5A5A5, the OMI constant)")
    parser.add_argument("--update-rate", "-u", type=float, default=4410.0,
                        help="State evolution rate in Hz (default: 4410 = every ~10 samples). "
                             "Higher = noisier/faster; lower = slower evolving texture.")
    parser.add_argument("--stereo", action="store_true",
                        help="Enable stereo output (left = state XOR, right = delta_acc variant)")
    parser.add_argument("--quiet", "-q", action="store_true",
                        help="Suppress verbose output")

    args = parser.parse_args()

    try:
        generate_xor_ring_wav(
            output_path=args.output,
            duration_sec=args.duration,
            sample_rate=args.sample_rate,
            seed=args.seed,
            state_update_rate=args.update_rate,
            stereo=args.stereo,
            verbose=not args.quiet
        )
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
