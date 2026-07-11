#!/usr/bin/env python3
"""
E8 Fractal Power Module – 30s Nice Sweep Sonification
=====================================================
Clean, self-contained recreation of the e8_demo.wav generator
from SPECTRAL / e8_fractal_power_module.py (Trent Slade / QSOL-IMC).

Maps the 8-dimensional Cartan torus of E8 (via its 240 roots) into
stereo audio: 8 golden-ratio lattice oscillators whose instantaneous
frequency, amplitude, waveshape (sine↔triangle) and stereo image are
continuously driven by the evolving 8D torus state + sparse root
projections. Produces a continuous, deterministic “sweep” through
configuration space of the E8 lattice.

Default: 30 s @ 48 kHz stereo 16-bit WAV, matching the demo style
but longer and with a gentle, musically pleasing evolution.
"""

from __future__ import annotations
import math
import wave
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Tuple

import numpy as np

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
PHI = (1.0 + math.sqrt(5.0)) / 2.0
TWO_PI = 2.0 * math.pi

# ---------------------------------------------------------------------------
# E8 Root System
# ---------------------------------------------------------------------------
def generate_e8_roots() -> np.ndarray:
    """Return (240, 8) float32 array of unit-length E8 roots."""
    roots: List[np.ndarray] = []

    # Family A – 112 roots of form (±1, ±1, 0^6) / √2
    is2 = 1.0 / math.sqrt(2.0)
    for i in range(8):
        for j in range(i + 1, 8):
            for s0 in (-1.0, 1.0):
                for s1 in (-1.0, 1.0):
                    v = np.zeros(8, dtype=np.float32)
                    v[i] = s0 * is2
                    v[j] = s1 * is2
                    roots.append(v)

    # Family B – 128 roots of form (±½)⁸ with even # of minus signs
    for mask in range(256):
        minus = 0
        vals = np.empty(8, dtype=np.float32)
        for b in range(8):
            if (mask >> b) & 1:
                vals[b] = -0.5
                minus += 1
            else:
                vals[b] = 0.5
        if minus % 2 == 0:
            n = np.linalg.norm(vals)
            if n > 0:
                vals /= n
            roots.append(vals.astype(np.float32))
            if len(roots) == 240:
                break

    roots_arr = np.stack(roots, axis=0)
    assert roots_arr.shape == (240, 8)
    return roots_arr


# ---------------------------------------------------------------------------
# Supporting dataclasses
# ---------------------------------------------------------------------------
@dataclass
class QutritState:
    """Simple 8-component qutrit-like state (Gell-Mann proxy)."""
    r: np.ndarray = field(default_factory=lambda: np.zeros(8, dtype=np.float32))

    def soft_project(self, r_max: float = 1.2) -> None:
        n2 = float(np.dot(self.r, self.r))
        if n2 <= r_max * r_max:
            return
        n = math.sqrt(n2)
        s = r_max * math.tanh(n / r_max) / (n + 1e-12)
        self.r *= s


@dataclass
class E8Torus:
    """8D Cartan torus: angles θ and angular velocities ω (rad, rad/s)."""
    theta: np.ndarray = field(default_factory=lambda: np.zeros(8, dtype=np.float32))
    omega: np.ndarray = field(default_factory=lambda: np.zeros(8, dtype=np.float32))

    def advance(self, dt: float) -> None:
        self.theta = (self.theta + self.omega * dt) % TWO_PI

    def phases(self, roots: np.ndarray) -> np.ndarray:
        """φ_k = α_k · θ for every root → (240,)"""
        return roots @ self.theta


@dataclass
class Macros:
    PhiDrift: float = 0.02          # base angular drift (rad/s)
    EntropyBloom: float = 0.015     # mild random torsion (kept low for “nice”)
    TernaryBias: float = 0.10
    PhaseGain: float = 0.28
    AmpGain: float = 0.22
    EnergyFlow: float = 1.05
    CosmicDepth: int = 5            # informational


# ---------------------------------------------------------------------------
# Main Module
# ---------------------------------------------------------------------------
class E8FractalPowerModule:
    """
    Maps an evolving 8-dimensional E8 Cartan torus into continuous stereo audio.
    8 oscillators (one per “node” / simple root direction) are driven by:
      • base frequencies on a golden-ratio lattice centred ~110 Hz
      • instantaneous frequency offset from sparse root-phase sums
      • amplitude from cosine sums over the same sparse roots
      • waveshape morph (sine → triangle) from qutrit magnitude
      • stereo pan from one of the torus angles
    The result is a smooth, non-repeating sweep through the geometry of E8.
    """

    def __init__(
        self,
        num_nodes: int = 8,
        sample_rate: float = 48000.0,
        control_rate: float = 1000.0,
        seed: int = 0xE8E8E8E8,
    ):
        self.num_nodes = num_nodes
        self.sample_rate = float(sample_rate)
        self.control_rate = float(control_rate)
        self.macros = Macros()
        self.rng = np.random.default_rng(seed)

        self.roots = generate_e8_roots()
        self.torus = E8Torus()
        self.qs: List[QutritState] = [QutritState() for _ in range(num_nodes)]

        # Sparse, deterministic coupling of each node to 12 roots
        self.sparse_idx = self._choose_sparse_roots(num_nodes, roots_per_node=12)

        # Modulation buffers (updated at control rate)
        self._dphi = np.zeros(num_nodes, dtype=np.float32)   # rad/s phase mod
        self._damp = np.ones(num_nodes, dtype=np.float32)    # amplitude multiplier
        self._morph = np.zeros(num_nodes, dtype=np.float32)  # 0=sine … 1=triangle

        # Audio state
        self._node_phase = np.zeros(num_nodes, dtype=np.float32)
        # Golden-ratio lattice of base frequencies around ~110 Hz
        ratios = PHI ** (np.arange(num_nodes) - (num_nodes // 2))
        self._base_freq = (110.0 * ratios / ratios.max()).astype(np.float32)

        self._samples_per_control = max(1, int(round(sample_rate / control_rate)))
        self._sample_counter = 0

    def _choose_sparse_roots(self, num_nodes: int, roots_per_node: int = 12) -> List[np.ndarray]:
        out = []
        stride = 240 // roots_per_node
        for i in range(num_nodes):
            offset = (i * 17) % 240
            idx = (offset + np.arange(roots_per_node) * stride) % 240
            out.append(idx.astype(np.int32))
        return out

    def _apply_torus_macros(self) -> None:
        drift = self.macros.PhiDrift
        # Gentle slope across the 8 axes so the sweep is anisotropic & interesting
        base = drift * (0.55 + 0.12 * np.arange(8, dtype=np.float32))
        self.torus.omega = base.copy()

        # Mild entropy bloom (kept small for a “nice” musical sweep)
        e = self.macros.EntropyBloom
        if e > 1e-6:
            self.torus.omega += e * self.rng.uniform(-0.04, 0.04, size=8).astype(np.float32)
            self.torus.theta = (
                self.torus.theta + e * self.rng.uniform(-0.0015, 0.0015, size=8).astype(np.float32)
            ) % TWO_PI

    def set_macros(self, **kwargs) -> None:
        for k, v in kwargs.items():
            if hasattr(self.macros, k):
                setattr(self.macros, k, type(getattr(self.macros, k))(v))

    def control_step(self) -> None:
        """One control-rate tick: advance torus + recompute all modulations."""
        self._apply_torus_macros()
        dt = 1.0 / self.control_rate
        self.torus.advance(dt)

        # 240-dimensional phase vector from current torus state
        ph_all = self.torus.phases(self.roots)  # (240,)

        phase_gain = float(self.macros.PhaseGain)
        amp_gain = float(self.macros.AmpGain)
        bias = float(self.macros.TernaryBias)
        lam = 0.78  # qutrit decay

        for i in range(self.num_nodes):
            idx = self.sparse_idx[i]
            ph = ph_all[idx]
            s = float(np.sin(ph).sum())
            c = float(np.cos(ph).sum())
            norm = 1.0 / max(1, len(idx))

            self._dphi[i] = phase_gain * s * norm
            self._damp[i] = np.clip(1.0 + amp_gain * c * norm, 0.15, 3.8)

            # Qutrit drive from a couple of torus angles (ternary flavour)
            drive0 = 0.5 * math.sin(self.torus.theta[0]) + 0.5 * math.sin(self.torus.theta[1])
            drive1 = 0.5 * math.cos(self.torus.theta[2]) + 0.5 * math.cos(self.torus.theta[3])

            qs = self.qs[i]
            qs.r[0] += dt * (-lam * qs.r[0] + drive0 + bias)
            qs.r[3] += dt * (-lam * qs.r[3] + drive1 - 0.5 * bias)
            qs.r[7] += dt * (-lam * qs.r[7] + 0.25 * (drive0 + drive1) - 0.5 * bias)

            mag = math.sqrt(float(qs.r[0]**2 + qs.r[3]**2 + qs.r[7]**2))
            self._morph[i] = float(np.clip(0.55 * mag, 0.0, 1.0))
            qs.soft_project(1.15)

    def process_control_for_samples(self, num_samples: int) -> None:
        remaining = num_samples
        while remaining > 0:
            step = min(self._samples_per_control - self._sample_counter, remaining)
            self._sample_counter += step
            remaining -= step
            if self._sample_counter >= self._samples_per_control:
                self._sample_counter = 0
                self.control_step()

    def _morph_wave(self, phase: np.ndarray, morph: np.ndarray) -> np.ndarray:
        """Vectorised sine ↔ triangle morph. phase, morph broadcastable."""
        s = np.sin(phase)
        tri = (2.0 / math.pi) * np.arcsin(np.clip(np.sin(phase), -1.0, 1.0))
        return (1.0 - morph) * s + morph * tri

    def render(self, num_samples: int, base_gain: float = 0.18) -> Tuple[np.ndarray, np.ndarray]:
        """
        Render stereo float32 audio of length num_samples.
        Processes in short control-aligned blocks so that pan, morph,
        amp and frequency continuously evolve over the full duration
        (essential for a long 30 s sweep; the original short demo never
        noticed the final-state pan).
        Returns (L, R) each shape (num_samples,).
        """
        N = int(num_samples)
        L_out = np.zeros(N, dtype=np.float32)
        R_out = np.zeros(N, dtype=np.float32)

        # Block size ≈ 20–30 ms (multiple of control period for cleanliness)
        block = max(self._samples_per_control * 16, 512)
        k = TWO_PI / self.sample_rate
        g = float(self.macros.EnergyFlow)
        pos = 0

        while pos < N:
            n = min(block, N - pos)
            # Advance control state for this block
            self.process_control_for_samples(n)

            dphi_hz = self._dphi / TWO_PI
            amp = base_gain * self._damp
            freq = np.clip(self._base_freq + dphi_hz, 8.0, 12000.0).astype(np.float32)
            phase_inc = k * freq

            t_idx = np.arange(n, dtype=np.float32)
            phase_t = self._node_phase[:, None] + phase_inc[:, None] * t_idx[None, :]

            morph = self._morph[:, None]
            wave = self._morph_wave(phase_t, morph)
            sig = wave * amp[:, None]          # (nodes, n)

            # Carry oscillator phases forward
            self._node_phase = (self._node_phase + phase_inc * n) % TWO_PI

            # Mild torus-driven pan (original demo is nearly mono/correlated;
            # keep motion subtle so L/R stay balanced over long sweeps)
            pan = 0.5 + 0.18 * np.sin(self.torus.theta[4]) + 0.07 * np.sin(self.torus.theta[5] * 1.37)
            pan = float(np.clip(pan, 0.32, 0.68))
            left_mix = 1.0 - pan
            right_mix = pan

            mix = sig.sum(axis=0)
            # Soft clip after energy (matches demo character)
            mix = np.tanh(mix * g)
            L_out[pos:pos + n] = mix * left_mix
            R_out[pos:pos + n] = mix * right_mix

            pos += n

        return L_out, R_out


# ---------------------------------------------------------------------------
# Convenience: generate the 30 s nice sweep
# ---------------------------------------------------------------------------
def generate_30s_sweep(
    path: str | Path = "/home/workdir/artifacts/e8_space_sweep_30s.wav",
    seconds: float = 30.0,
    sr: float = 48000.0,
    seed: int = 0xE8E83030,
) -> Path:
    """
    Produce a polished 30-second E8 8D-space sweep.
    Slightly richer macros than the original 3–4 s demo for a more
    satisfying long-form evolution while remaining faithful to the model.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    e8 = E8FractalPowerModule(
        num_nodes=8,
        sample_rate=sr,
        control_rate=1000.0,
        seed=seed,
    )
    # “Nice sweep” macro set – a little more motion & depth than the tiny demo
    e8.set_macros(
        PhiDrift=0.028,          # slightly faster torus drift so 30 s covers more space
        EntropyBloom=0.012,      # gentle aperiodicity
        TernaryBias=0.12,
        PhaseGain=0.30,
        AmpGain=0.24,
        EnergyFlow=1.08,
    )

    print(f"🌀 Generating E8 8D-space sweep  →  {seconds:.1f}s @ {int(sr)} Hz …")
    num_samples = int(seconds * sr)
    L, R = e8.render(num_samples=num_samples, base_gain=0.175)

    # Subtle Haas / mid-side width so it feels dimensional without unbalancing
    # (mirrors the spirit of the original demo + triality sonifiers)
    delay = int(0.0095 * sr)  # ~9.5 ms
    R = 0.96 * R + 0.04 * np.roll(L, delay)

    # Gentle 1.2 s fade-in / fade-out for a polished listen
    fade = int(1.2 * sr)
    fade_in = np.linspace(0.0, 1.0, fade, dtype=np.float32)
    fade_out = np.linspace(1.0, 0.0, fade, dtype=np.float32)
    L[:fade] *= fade_in
    R[:fade] *= fade_in
    L[-fade:] *= fade_out
    R[-fade:] *= fade_out

    # Peak-normalise to ~-1 dB
    data = np.stack([L, R], axis=1)
    peak = float(np.max(np.abs(data)))
    if peak > 1e-9:
        data = data * (0.89 / peak)

    pcm = (data * 32767.0).astype(np.int16)

    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(int(sr))
        wf.writeframes(pcm.tobytes())

    print(f"✅ Wrote {path}")
    print(f"   duration={seconds}s  sr={int(sr)}  peak≈{peak:.3f} → normalised")
    print("   8 oscillators × E8 root projections × Cartan-torus sweep")
    return path


if __name__ == "__main__":
    generate_30s_sweep()
