#!/usr/bin/env python3
"""
QEC v167.0 SymbolicSonificationRuntimeSkeleton Sonification Generator
===================================================================

This script generates a deterministic MIDI file that sonifies the v167.0 release.

It translates the core concepts of the Symbolic Sonification Runtime into
musical structure, events, and narrative:

- The MIDI event stream itself mirrors the SymbolicEventStream model
  (ordered by start "tick" / musical time, lane/channel, event identity).
- Modules (canonical, events, mapping) are mapped to distinct musical layers
  and motifs.
- Gremlin Notes are rendered as short character motifs with boundary
  enforcement (some "rejected", some resolved).
- Mathematical determinism: Fibonacci-derived timings, durations, densities,
  and interval choices. No randomness. Fixed PYTHONHASHSEED-equivalent behavior.
- Claim boundaries & forbidden scopes are musically enforced as tension ->
  resolution or abrupt valid cutoffs. The music stays strictly symbolic/creative.
- Future arc hints (ternary, phi-rhythm, MIDI export) appear as brief controlled
  previews that do not overstep v167.0 boundaries.

Tuning / Performance Notes:
- Conceptual base: A=432 Hz (retune your synth/DAW accordingly for full intent).
- MIDI uses standard 12TET; the structure is designed for just-intonation
  or microtonal extension in later v167.x (e.g. qutrit/neon mappings).
- 89 BPM (Fibonacci number) for organic yet precise pulse.
- Recommended sound: Industrial/synthwave or dark cinematic patches.
  - Foundation layer: Warm pad or sustained strings / square lead
  - Event layer: Sharp saw or electric piano / metallic percussion
  - Stabs/Glitches: Short decay synth brass or FM pluck
  - Markers: Orchestral or bell-like

The resulting .mid is a "SymbolicSonificationRuntimeSkeleton" in the literal
sense: the event layer is executable (load in any DAW or player) and
reproducible. It does not render audio, matching v167.0 scope exactly.

Later releases can extend this generator into the full v167.5 MIDI exporter,
v167.4 GoldenRatioRhythmPitchEngine, etc.

Gremlin-approved: same bytes -> same MIDI -> same musical identity across runs.
"""

import mido
from mido import MidiFile, MidiTrack, Message, MetaMessage
import os

# =============================================================================
# DETERMINISTIC PARAMETERS (Fibonacci-rooted, no RNG)
# =============================================================================
BPM = 89  # Fibonacci number for tempo
TICKS_PER_BEAT = 480
ROOT_PITCH = 48  # C3 - foundation register
MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10]  # C natural minor degrees

FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233]

def degree_to_pitch(degree: int, octave_shift: int = 0) -> int:
    """Map scale degree to MIDI pitch. Deterministic."""
    idx = degree % len(MINOR_SCALE)
    return ROOT_PITCH + octave_shift * 12 + MINOR_SCALE[idx]

def beats_to_ticks(beats: float) -> int:
    return int(beats * TICKS_PER_BEAT)

# =============================================================================
# MOTIF DEFINITIONS (Symbolic Event Type -> Musical Behavior)
# =============================================================================
# These map directly to allowed_event_types in event_schema_v167.json
# SYMBOLIC_CONTROL, SYMBOLIC_GLITCH, SYMBOLIC_LOOP_BOUNDARY, SYMBOLIC_MARKER,
# SYMBOLIC_NOTE, SYMBOLIC_REST, SYMBOLIC_STAB

def build_foundation_motif(track: MidiTrack, current_time: int) -> int:
    """canonical.py layer: stable, immutable, hash-like consonance.
    Long tones + perfect intervals (4th/5th/octave) for determinism & validation.
    """
    # Low C drone feel (sustained via long note)
    pitches = [degree_to_pitch(0, 0), degree_to_pitch(4, 0), degree_to_pitch(0, 1)]  # C G C'
    for i, p in enumerate(pitches):
        dur_beats = FIB[4 + i] / 4.0  # 5/4, 8/4, 13/4 -> substantial holds
        ticks = beats_to_ticks(dur_beats)
        track.append(Message('note_on', note=p, velocity=70, time=0, channel=0))
        track.append(Message('note_off', note=p, velocity=0, time=ticks, channel=0))
        current_time += ticks
    # Add a resolving 5th above for canonical "hash" stability feel
    track.append(Message('note_on', note=degree_to_pitch(4, 1), velocity=55, time=0, channel=0))
    track.append(Message('note_off', note=degree_to_pitch(4, 1), velocity=0, time=beats_to_ticks(8), channel=0))
    current_time += beats_to_ticks(8)
    return current_time

def add_symbolic_event(track: MidiTrack, event_type: str, start_offset_beats: float,
                       lane: int, symbolic_token: str, duration_beats: float,
                       velocity: int, current_time: int, channel: int = 1) -> int:
    """Add one symbolic event as MIDI note(s). Mirrors build_symbolic_event + ordering."""
    ticks_offset = beats_to_ticks(start_offset_beats)
    dur_ticks = beats_to_ticks(duration_beats)

    # Lane -> octave/register shift + slight velocity bias
    octave = lane % 3
    vel = max(40, min(127, velocity + lane * 3))

    if event_type == "SYMBOLIC_REST":
        # Explicit rest: advance time, no note
        current_time += ticks_offset + dur_ticks
        return current_time

    if event_type == "SYMBOLIC_STAB":
        # Short, accented, higher register stab (boundary enforcement)
        pitch = degree_to_pitch(2 + lane, octave + 1)  # Eb-ish color
        track.append(Message('note_on', note=pitch, velocity=min(127, vel + 20), time=ticks_offset, channel=channel))
        track.append(Message('note_off', note=pitch, velocity=0, time=max(60, dur_ticks // 3), channel=channel))
        current_time += ticks_offset + dur_ticks
        return current_time

    if event_type == "SYMBOLIC_GLITCH":
        # Quick deterministic "glitch" run (Fib-derived 16ths, chromatic twist)
        glitch_notes = [degree_to_pitch(d, octave) for d in [0, 1, 3, 2, 5][:3]]  # small twist
        step = max(40, dur_ticks // len(glitch_notes))
        for i, p in enumerate(glitch_notes):
            track.append(Message('note_on', note=p, velocity=vel - 10, time=ticks_offset if i == 0 else 0, channel=channel))
            track.append(Message('note_off', note=p, velocity=0, time=step, channel=channel))
        current_time += ticks_offset + dur_ticks
        return current_time

    if event_type == "SYMBOLIC_MARKER":
        # Landmark chord (C minor triad + extension) for schema/mapping alignment
        chord = [degree_to_pitch(0, octave), degree_to_pitch(2, octave), degree_to_pitch(4, octave + 1)]
        for i, p in enumerate(chord):
            track.append(Message('note_on', note=p, velocity=vel, time=ticks_offset if i == 0 else 0, channel=channel))
        # All off after duration
        for p in chord:
            track.append(Message('note_off', note=p, velocity=0, time=dur_ticks if p == chord[-1] else 0, channel=channel))
        current_time += ticks_offset + dur_ticks
        return current_time

    if event_type == "SYMBOLIC_LOOP_BOUNDARY":
        # Short looping motif (3-note) that "validates" and resolves
        loop_pitches = [degree_to_pitch(0, octave), degree_to_pitch(3, octave), degree_to_pitch(4, octave)]
        step = max(80, dur_ticks // 3)
        for i, p in enumerate(loop_pitches):
            track.append(Message('note_on', note=p, velocity=vel, time=ticks_offset if i == 0 else 0, channel=channel))
            track.append(Message('note_off', note=p, velocity=0, time=step, channel=channel))
        current_time += ticks_offset + dur_ticks
        return current_time

    # Default / SYMBOLIC_NOTE / SYMBOLIC_CONTROL -> clean melodic tone
    pitch = degree_to_pitch(lane + 1, octave)
    track.append(Message('note_on', note=pitch, velocity=vel, time=ticks_offset, channel=channel))
    track.append(Message('note_off', note=pitch, velocity=0, time=dur_ticks, channel=channel))
    current_time += ticks_offset + dur_ticks
    return current_time

def add_gremlin_interlude(track: MidiTrack, gremlin: str, current_time: int) -> int:
    """Narrative layer from the Gremlin Notes. Each has signature behavior + boundary response."""
    if gremlin == "receipt":
        # Ascending perfect 5th blip, resolved cleanly (manifest accepted -> executable Python)
        track.append(Message('note_on', note=degree_to_pitch(0, 2), velocity=90, time=0, channel=2))
        track.append(Message('note_off', note=degree_to_pitch(0, 2), velocity=0, time=beats_to_ticks(0.5), channel=2))
        track.append(Message('note_on', note=degree_to_pitch(4, 2), velocity=85, time=0, channel=2))
        track.append(Message('note_off', note=degree_to_pitch(4, 2), velocity=0, time=beats_to_ticks(1.5), channel=2))
        current_time += beats_to_ticks(2)
        track.append(MetaMessage('text', text="Receipt goblin: manifest accepted. Runtime: here is executable Python.", time=0))
        return current_time

    if gremlin == "entropy":
        # Tries to introduce chaos (rapid descending run) -> rejected by canonical boundary
        for i in range(5):
            p = degree_to_pitch(6 - i, 1)  # descending twist
            track.append(Message('note_on', note=p, velocity=100, time=0, channel=2))
            track.append(Message('note_off', note=p, velocity=0, time=beats_to_ticks(0.15), channel=2))
        current_time += beats_to_ticks(1)
        # Sharp low stab rejects it (boundary enforcement)
        track.append(Message('note_on', note=degree_to_pitch(0, 0), velocity=110, time=0, channel=0))
        track.append(Message('note_off', note=degree_to_pitch(0, 0), velocity=0, time=beats_to_ticks(0.3), channel=0))
        current_time += beats_to_ticks(0.5)
        track.append(MetaMessage('text', text="Entropy goblin smuggled PYTHONHASHSEED. Canonical SHA-256: same bytes, same hash, different seed, still no chaos.", time=0))
        return current_time

    if gremlin == "midi":
        # Shows up early with a clean future-MIDI hint (major-ish fragment) -> truncated
        preview = [degree_to_pitch(d, 2) for d in [0, 2, 4, 5, 7]]  # hint of resolution
        for i, p in enumerate(preview):
            track.append(Message('note_on', note=p, velocity=75, time=0, channel=2))
            track.append(Message('note_off', note=p, velocity=0, time=beats_to_ticks(0.2), channel=2))
        current_time += beats_to_ticks(1.2)
        # Abrupt cutoff + marker
        track.append(Message('note_on', note=degree_to_pitch(2, 1), velocity=120, time=0, channel=0))
        track.append(Message('note_off', note=degree_to_pitch(2, 1), velocity=0, time=beats_to_ticks(0.25), channel=0))
        current_time += beats_to_ticks(0.5)
        track.append(MetaMessage('text', text="MIDI goblin showed up early. v167.0: come back in v167.5.", time=0))
        return current_time

    if gremlin == "cosmovirus":
        # Wide cosmic leaps (large intervals) trying to claim physics -> pulled back to symbolic boundary
        leaps = [degree_to_pitch(0, 1), degree_to_pitch(7, 3), degree_to_pitch(2, 1)]  # wide then corrected
        for i, p in enumerate(leaps):
            track.append(Message('note_on', note=p, velocity=95, time=0, channel=2))
            track.append(Message('note_off', note=p, velocity=0, time=beats_to_ticks(0.4), channel=2))
        current_time += beats_to_ticks(1.5)
        # Boundary stab resolves to claim_scope
        track.append(Message('note_on', note=degree_to_pitch(4, 0), velocity=85, time=0, channel=0))
        track.append(Message('note_off', note=degree_to_pitch(4, 0), velocity=0, time=beats_to_ticks(1), channel=0))
        current_time += beats_to_ticks(1)
        track.append(MetaMessage('text', text="Cosmovirus gremlin tried to become physics. Claim boundary: symbolic motif only, cosmic cowboy.", time=0))
        return current_time

    return current_time

# =============================================================================
# MAIN GENERATOR
# =============================================================================
def generate_v167_sonification() -> str:
    mid = MidiFile(ticks_per_beat=TICKS_PER_BEAT)
    track = MidiTrack()
    mid.tracks.append(track)

    # --- HEADER / RUNTIME IDENTITY ---
    track.append(MetaMessage('track_name', name='QEC_v167.0_SymbolicSonificationRuntimeSkeleton'))
    track.append(MetaMessage('copyright', text='QSOLKCB/QEC | Deterministic Creative Artifact | v167.0 | claim_scope=SYMBOLIC_CREATIVE_ARTIFACT | no scientific/medical/biological/cosmological/QEC claims'))
    track.append(MetaMessage('set_tempo', tempo=mido.bpm2tempo(BPM)))
    track.append(MetaMessage('time_signature', numerator=4, denominator=4))
    track.append(MetaMessage('key_signature', key='Cm'))
    track.append(MetaMessage('text', text='SONIFY_RUNTIME_KIND=SymbolicSonificationRuntimeSkeleton | version=v167.0 | ordering=START_TICK_THEN_LANE_THEN_EVENT_ID', time=0))
    track.append(MetaMessage('text', text='This MIDI is the executable event layer. Same bytes -> same performance. Hash-stable across PYTHONHASHSEED.', time=0))

    # Program / timbre hints (DAW can override)
    track.append(Message('program_change', program=48, time=0, channel=0))   # 48 = String Ensemble 1 (foundation skeleton)
    track.append(Message('program_change', program=81, time=0, channel=1))   # 81 = Lead 1 square (precise symbolic events)
    track.append(Message('program_change', program=38, time=0, channel=2))   # 38 = Synth Bass or lead for gremlins/narrative

    current_time = 0

    # --- SECTION 1: BOOT / CANONICAL FOUNDATION (init.py + canonical.py) ---
    track.append(MetaMessage('marker', text='BOOT: SymbolicSonificationRuntimeSkeleton v167.0', time=0))
    current_time = build_foundation_motif(track, current_time)
    track.append(MetaMessage('text', text='canonical_json | canonical_sha256 | validate_sha256 | assert_json_safe | require_* validators active. Immutable payload behavior enforced.', time=0))

    # Short rest (SYMBOLIC_REST)
    current_time = add_symbolic_event(track, "SYMBOLIC_REST", 0.5, lane=0, symbolic_token="CANONICAL_VALIDATED", duration_beats=1.0, velocity=0, current_time=current_time)

    # --- SECTION 2: SYMBOLIC EVENT STREAM (events.py) ---
    track.append(MetaMessage('marker', text='EVENT STREAM: Ordered by START_TICK_THEN_LANE_THEN_EVENT_ID', time=0))

    # Representative deterministic event stream (mirrors test fixtures & schema)
    # Each call advances musical time; ordering is strictly sequential here (as sorted stream would be)
    event_stream = [
        ("SYMBOLIC_CONTROL", 0.0, 0, "RUNTIME_SKELETON_BOOT", 2.0, 75),
        ("SYMBOLIC_NOTE", 0.1, 1, "EVENT_ID_001", 1.5, 82),
        ("SYMBOLIC_STAB", 0.3, 0, "SCHEMA_ALIGNMENT", 0.6, 95),
        ("SYMBOLIC_GLITCH", 1.0, 2, "FORGED_HASH_REJECTED", 1.2, 88),
        ("SYMBOLIC_MARKER", 0.0, 1, "STREAM_HASH_LOCK", 2.5, 70),  # same tick as previous in logical ordering, different lane
        ("SYMBOLIC_LOOP_BOUNDARY", 0.8, 0, "VALIDATION_LOOP", 1.8, 80),
        ("SYMBOLIC_REST", 0.2, 0, "DETERMINISTIC_GAP", 0.8, 0),
        ("SYMBOLIC_NOTE", 0.0, 2, "EVENT_ID_007", 1.3, 78),
    ]

    for etype, soff, lane, token, dur, vel in event_stream:
        current_time = add_symbolic_event(
            track, etype, soff, lane, token, dur, vel, current_time, channel=1
        )

    track.append(MetaMessage('text', text='All events validated: duplicate IDs rejected, stale hashes rejected, forged counts rejected, immutable payloads preserved.', time=0))

    # --- SECTION 3: MAPPING SCHEMA & BOUNDARY ENFORCEMENT (mapping.py) ---
    track.append(MetaMessage('marker', text='MAPPING SCHEMA: creative_status=SYMBOLIC_CREATIVE_ARTIFACT | claim_scope=NO_SCIENTIFIC_...', time=0))

    # A mapping "chord" that aligns schema
    current_time = add_symbolic_event(track, "SYMBOLIC_MARKER", 0.0, 0, "SYMBOLIC_MAPPING_SCHEMA_HASH", 3.0, 65, current_time, channel=0)

    # Enforce a forbidden scope musically (tension then clean cutoff)
    # Dissonant cluster (symbolic "overclaim attempt") -> resolved by low boundary stab
    for deg in [1, 3, 6]:  # tension notes
        p = degree_to_pitch(deg, 2)
        track.append(Message('note_on', note=p, velocity=60, time=0, channel=1))
        track.append(Message('note_off', note=p, velocity=0, time=beats_to_ticks(0.8), channel=1))
    current_time += beats_to_ticks(1.0)

    # Resolution stab (claim boundary holds)
    current_time = add_symbolic_event(track, "SYMBOLIC_STAB", 0.0, 0, "FORBIDDEN_SCOPE_REJECTED", 0.4, 115, current_time, channel=0)

    track.append(MetaMessage('text', text='forbidden_scopes active: no MIDI export (yet), no mapping packs, no audio rendering, no LLM/network/decoder imports, no physics/medical/cosmology/QEC claims. v167.0 is skeleton only.', time=0))

    # --- SECTION 4: GREMLIN NOTES (Narrative layer, playful but boundary-guarded) ---
    track.append(MetaMessage('marker', text='GREMLIN NOTES: The receipt goblin asked for another manifest...', time=0))
    current_time = add_gremlin_interlude(track, "receipt", current_time)

    current_time = add_gremlin_interlude(track, "entropy", current_time)

    current_time = add_gremlin_interlude(track, "midi", current_time)

    current_time = add_gremlin_interlude(track, "cosmovirus", current_time)

    # Final decoder goblin knock (wrong arc)
    track.append(Message('note_on', note=degree_to_pitch(5, 3), velocity=70, time=0, channel=2))
    track.append(Message('note_off', note=degree_to_pitch(5, 3), velocity=0, time=beats_to_ticks(0.3), channel=2))
    current_time += beats_to_ticks(0.5)
    track.append(Message('note_on', note=degree_to_pitch(0, 0), velocity=100, time=0, channel=0))
    track.append(Message('note_off', note=degree_to_pitch(0, 0), velocity=0, time=beats_to_ticks(0.6), channel=0))
    current_time += beats_to_ticks(0.8)
    track.append(MetaMessage('text', text="Decoder goblin knocked on src/qec/decoder/. Sonifier: wrong arc, wrong door. This is the sonify arc.", time=0))

    # --- SECTION 5: RUNTIME IDENTITY & HASH STABILITY (closing) ---
    track.append(MetaMessage('marker', text='RUNTIME HASH: symbolic_sonification_runtime_skeleton_hash() - STABLE', time=0))

    # The "hash" motif: a fixed, reproducible resolving phrase (same every run)
    # C Eb G Bb C (minor 7th color) -> final low C for identity lock
    hash_motif = [
        (degree_to_pitch(0, 1), 1.0, 70),
        (degree_to_pitch(2, 1), 0.8, 65),
        (degree_to_pitch(4, 1), 0.8, 60),
        (degree_to_pitch(6, 1), 1.2, 55),
        (degree_to_pitch(0, 0), 2.5, 80),  # final root lock
    ]
    for p, dur, vel in hash_motif:
        track.append(Message('note_on', note=p, velocity=vel, time=0, channel=0))
        track.append(Message('note_off', note=p, velocity=0, time=beats_to_ticks(dur), channel=0))
        current_time += beats_to_ticks(dur)

    # Final meta
    track.append(MetaMessage('text', text='v167.0 complete. Deterministic event layer ready for v167.1 CosmovirusMappingPack, v167.2 TernaryFuzzyMusicStateEngine, v167.4 GoldenRatioRhythmPitchEngine, v167.5 SymbolicEventMIDIExporter, ...', time=0))
    track.append(MetaMessage('text', text='This file is the skeleton. Future releases will flesh out MIDI export, phi/Fibonacci engines, proof telemetry sonification, and demo corpus. Same canonical rules apply.', time=0))
    track.append(MetaMessage('end_of_track', time=0))

    # Save
    out_path = "/home/workdir/artifacts/QEC_v167.0_SymbolicSonificationRuntimeSkeleton.mid"
    mid.save(out_path)
    print(f"Generated: {out_path}")
    print(f"Total MIDI ticks approx: {current_time}")
    print(f"Tempo: {BPM} BPM | Scale: C minor (conceptual 432 Hz base) | Fibonacci-timed | Deterministic")
    return out_path

if __name__ == "__main__":
    generate_v167_sonification()
