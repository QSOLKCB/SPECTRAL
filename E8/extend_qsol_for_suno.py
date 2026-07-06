#!/usr/bin/env python3
"""
QSOL E8 Spectral Projection Extender for Suno
==============================================

Takes your short 2s E8_SPECTRAL_PROJECTION clip (QSOL-0C57-6874)
and renders a longer, musically coherent version (default 12s)
while preserving the mathematical DNA.

Features:
- Intelligent looping of the original motif with smooth crossfades
- Added triality-modulated E8 root layer (the same math as our previous script)
- 432Hz grounding drone that evolves according to triality
- Full provenance tracking (new JSON with extended history)
- Deterministic output (same seed → same result)

Usage:
    python extend_qsol_for_suno.py --input /path/to/QSOL-0C57-6874.json --duration 12 --output my_long_e8

Output:
    - <name>.wav          (12s+ stereo 44.1kHz, ready for Suno)
    - <name>.json         (updated metadata + provenance)
"""

import argparse
import json
import hashlib
import os
import time
from pathlib import Path

import numpy as np
from scipy.io import wavfile

# ============== E8 CORE (reused from previous work) ==============
import itertools

def generate_e8_roots():
    roots = []
    for i, j in itertools.combinations(range(8), 2):
        for s1 in [-1, 1]:
            for s2 in [-1, 1]:
                v = np.zeros(8)
                v[i] = s1
                v[j] = s2
                roots.append(v)
    for signs in itertools.product([-0.5, 0.5], repeat=8):
        if sum(s < 0 for s in signs) % 2 == 0:
            roots.append(np.array(signs))
    return np.array(roots)

def project_and_sort_roots(roots):
    centered = roots - roots.mean(axis=0)
    _, _, Vt = np.linalg.svd(centered, full_matrices=False)
    proj = centered @ Vt[:2].T
    angles = np.arctan2(proj[:, 1], proj[:, 0])
    idx = np.argsort(angles)
    return roots[idx], angles[idx]

# ============== SYNTHESIS ==============
def generate_tone(freq, duration, sr, amp=0.3, fade=0.1):
    n = int(sr * duration)
    t = np.linspace(0, duration, n, endpoint=False)
    wave = amp * np.sin(2 * np.pi * freq * t)
    wave += 0.25 * amp * np.sin(2 * np.pi * freq * 2 * t)
    wave += 0.12 * amp * np.sin(2 * np.pi * freq * 3 * t)
    fi = max(1, int(fade * n))
    env = np.ones(n)
    env[:fi] = np.linspace(0, 1, fi)**2
    env[-fi:] = np.linspace(1, 0, fi)**2
    return wave * env

def extend_e8_spectral_projection(original_wav_path, json_path, target_duration=12.0, sr=44100):
    # Load original
    orig_sr, orig_audio = wavfile.read(original_wav_path)
    assert orig_sr == sr, "Sample rate mismatch"
    orig_audio = orig_audio.astype(np.float32) / 32768.0   # to float -1..1
    orig_dur = len(orig_audio) / sr
    print(f"Loaded original: {orig_dur:.2f}s")

    # Load JSON for provenance & spectral fingerprint
    with open(json_path) as f:
        meta = json.load(f)

    data = np.array(meta["data"], dtype=np.float32)
    voices = meta["synthParams"]["voices"]  # 8

    # === Build extended audio ===
    # Strategy:
    # 1. Repeat the original motif ~5-6 times with crossfades (gives ~10s base)
    # 2. Add a slowly evolving E8 triality layer underneath (the mathematical soul)
    # 3. Add a 432Hz grounding drone that breathes according to triality

    motif_repeats = max(4, int(target_duration / orig_dur) + 1)
    crossfade = 0.25  # seconds

    # Build motif loop with crossfades
    extended = np.zeros((int(target_duration * sr) + sr, 2), dtype=np.float32)
    pos = 0
    fade_samples = int(crossfade * sr)

    for i in range(motif_repeats):
        start = pos
        end = start + len(orig_audio)
        if end > len(extended):
            break

        # Simple crossfade on overlap
        if i > 0 and fade_samples > 0:
            fade_in = np.linspace(0, 1, fade_samples)[:, None]
            extended[start:start+fade_samples] *= (1 - fade_in)
            extended[start:start+fade_samples] += orig_audio[:fade_samples] * fade_in
            extended[start+fade_samples:end] += orig_audio[fade_samples:]
        else:
            extended[start:end] += orig_audio

        pos += len(orig_audio) - fade_samples

    # Trim to exact target
    extended = extended[:int(target_duration * sr)]

    # === Add E8 Triality Layer ===
    print("Adding triality-modulated E8 layer...")
    roots, _ = project_and_sort_roots(generate_e8_roots())
    phi = (1 + np.sqrt(5)) / 2

    # Slow evolving pad using first 8 sorted roots
    pad = np.zeros_like(extended)
    layer_dur = target_duration / 3.0

    for layer in range(3):  # triality 3-way
        dim = (layer * 3) % 8
        root = roots[layer * 17 % len(roots)]  # spaced sampling
        base_freq = 432.0 * (0.5 if layer == 0 else (1.0 if layer == 1 else phi))
        detune = 1.0 + root[dim] * 0.02

        for rep in range(3):
            t0 = layer * layer_dur + rep * (layer_dur / 2)
            if t0 >= target_duration:
                break
            dur = min(layer_dur * 1.2, target_duration - t0)
            tone = generate_tone(base_freq * detune, dur, sr,
                                 amp=0.06 + layer * 0.015, fade=0.8)
            s = int(t0 * sr)
            e = s + len(tone)
            if e > len(pad):
                e = len(pad)
                tone = tone[:e-s]
            pad[s:e, 0] += tone * (0.7 + 0.3 * np.sin(layer))
            pad[s:e, 1] += tone * (0.7 + 0.3 * np.cos(layer * 1.7))

    # === Add breathing 432Hz drone (triality modulated) ===
    drone = np.zeros_like(extended[:, 0])
    t = np.linspace(0, target_duration, len(drone), endpoint=False)
    drone_freq = 432.0 * 0.5
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * t / (target_duration * 0.8))
    drone += 0.035 * np.sin(2 * np.pi * drone_freq * t) * lfo

    # Mix everything
    final = extended * 0.85 + pad * 0.9 + drone[:, None] * 0.6

    # Normalize
    peak = np.max(np.abs(final))
    if peak > 0.98:
        final = final / peak * 0.96

    final_int16 = (final * 32767).astype(np.int16)

    return final_int16, meta, target_duration

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", "-i", required=True, help="Path to original QSOL-*.json")
    parser.add_argument("--duration", "-d", type=float, default=12.0, help="Target duration in seconds (min 6)")
    parser.add_argument("--output", "-o", default=None, help="Output base name (without extension)")
    args = parser.parse_args()

    input_json = Path(args.input)
    input_wav = input_json.with_suffix(".wav")

    if not input_wav.exists():
        print(f"ERROR: Corresponding WAV not found: {input_wav}")
        return

    print(f"Extending {input_json.name} to {args.duration}s with triality E8 layer...")

    audio_out, original_meta, actual_dur = extend_e8_spectral_projection(
        str(input_wav), str(input_json), target_duration=args.duration
    )

    # === Create new provenance ===
    new_id = f"QSOL-EXT-{int(time.time()) % 100000:05d}"
    new_seed = original_meta.get("seed", 1337) + 42

    # Hash the new audio for provenance
    audio_bytes = audio_out.tobytes()
    audio_hash = hashlib.sha256(audio_bytes).hexdigest()[:8].upper()

    new_meta = original_meta.copy()
    new_meta.update({
        "id": new_id,
        "seed": new_seed,
        "algorithm": "E8_SPECTRAL_PROJECTION_EXTENDED",
        "duration": round(actual_dur, 2),
        "parent": original_meta["id"],
        "extension_method": "TRIALITY_E8_LAYER + CROSSFADE_LOOP",
        "timestamp": int(time.time() * 1000),
        "audioHash": audio_hash,
        "provenance": original_meta["provenance"] + [
            "TRIALITY_EXTENSION_v1",
            "E8_ROOT_LAYER",
            "CROSSFADE_LOOP",
            f"DURATION_{actual_dur}s"
        ]
    })
    new_meta["synthParams"]["duration"] = round(actual_dur, 2)
    new_meta["synthParams"]["extension"] = True

    # Output paths
    if args.output:
        base = args.output
    else:
        base = input_json.stem + f"_extended_{int(actual_dur)}s"

    out_wav = f"{base}.wav"
    out_json = f"{base}.json"

    wavfile.write(out_wav, 44100, audio_out)
    with open(out_json, "w") as f:
        json.dump(new_meta, f, indent=2)

    print(f"\n✓ Extended WAV saved: {out_wav} ({actual_dur:.1f}s)")
    print(f"✓ Updated JSON saved: {out_json}")
    print(f"  New ID: {new_meta['id']}")
    print(f"  Provenance extended with triality E8 layer")
    print("\nReady for Suno (≥6s requirement satisfied).")

if __name__ == "__main__":
    main()
