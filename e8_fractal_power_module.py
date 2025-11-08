
# e8_fractal_power_module.py
# -------------------------------------------------------------
# Pure NumPy, pythonic implementation of an E8–Qutrit Fractal
# Power Module suitable for research & Jupyter prototyping.
#
# Highlights:
# - Vectorized E8 root system (240 x 8)
# - Cartan torus evolution with macro controls
# - Qutrit "Bloch-like" evolution with ternary bias
# - Sparse root coupling per node (phase/amp mod)
# - Optional minimal audio renderer for quick auditioning
#
# Author: ChatGPT (for Trent Slade / QSOL IMC)
# License: MIT
#
# Usage (quick):
#   from e8_fractal_power_module import E8FractalPowerModule
#   e8 = E8FractalPowerModule(num_nodes=8, sample_rate=48000)
#   L, R = e8.render(num_samples=48000*3)  # 3 seconds stereo numpy float32


from __future__ import annotations
import numpy as np
from dataclasses import dataclass, field
from typing import Optional, List, Tuple


# ------------------------- E8 Root System -------------------------

def generate_e8_roots() -> np.ndarray:
    """
    Generate the 240 E8 roots as a (240, 8) float32 array.

    Two families:
      (A) 112 roots of the form (±1, ±1, 0^6) / sqrt(2) across all permutations.
      (B) 128 roots of the form (±1/2)^8 with an even number of minus signs.

    Returns
    -------
    roots : np.ndarray
        Shape (240, 8), dtype float32
    """
    roots = []

    # Family A: 112 roots
    is2 = 1.0 / np.sqrt(2.0)
    for i in range(8):
        for j in range(i + 1, 8):
            for s0 in (-1.0, 1.0):
                for s1 in (-1.0, 1.0):
                    v = np.zeros(8, dtype=np.float32)
                    v[i] = s0 * is2
                    v[j] = s1 * is2
                    roots.append(v)

    # Family B: 128 roots
    # We iterate all 8-bit masks, keep those with even # of minus signs.
    for mask in range(256):
        minus = 0
        vals = np.empty(8, dtype=np.float32)
        for b in range(8):
            bit = (mask >> b) & 1
            if bit:
                vals[b] = -0.5
                minus += 1
            else:
                vals[b] = 0.5
        if (minus % 2) == 0:
            # Normalize for safety; should already be unit up to scale constants
            n = np.linalg.norm(vals)
            if n > 0:
                vals = vals / n
            roots.append(vals.astype(np.float32))
            if len(roots) == 240:
                break

    roots = np.stack(roots, axis=0)
    assert roots.shape == (240, 8)
    return roots.astype(np.float32)


# ------------------------- Data Classes -------------------------

@dataclass
class QutritState:
    """Qutrit-like 8D state in Gell–Mann coordinates (Bloch-style)."""
    r: np.ndarray = field(default_factory=lambda: np.zeros(8, dtype=np.float32))

    def soft_project(self, r_max: float = 1.2) -> None:
        n2 = float(np.dot(self.r, self.r))
        if n2 <= r_max * r_max:
            return
        n = np.sqrt(n2)
        # Smoothly compress excess radius
        s = r_max * np.tanh(n / r_max) / (n + 1e-12)
        self.r *= s


@dataclass
class E8Torus:
    """8D Cartan torus angles & angular velocities (rad, rad/s)."""
    theta: np.ndarray = field(default_factory=lambda: np.zeros(8, dtype=np.float32))
    omega: np.ndarray = field(default_factory=lambda: np.zeros(8, dtype=np.float32))

    def advance(self, dt: float) -> None:
        self.theta = (self.theta + self.omega * dt) % (2.0 * np.pi)

    def phases(self, roots: np.ndarray) -> np.ndarray:
        """
        Compute phi_k = alpha_k · theta for all 240 roots.
        roots: (240, 8), theta: (8,)
        Returns (240,) float32
        """
        return roots @ self.theta


@dataclass
class Macros:
    CosmicDepth: int = 5          # 1..12 (used for external engines; here informational)
    PhiDrift: float = 0.02        # rad/s base drift
    CoxeterPhase: float = 0.0     # extra rotation phase
    EntropyBloom: float = 0.02    # random torsion amount
    TernaryBias: float = 0.10     # ± push towards a ternary mode
    PhaseGain: float = 0.25       # phase modulation depth
    AmpGain: float = 0.20         # amplitude modulation depth
    EnergyFlow: float = 1.00      # final output gain (applied in renderer)
    SpatialWarp: float = 0.00     # reserved for 3D panning (not used in minimal renderer)


class E8FractalPowerModule:
    """
    Pythonic + NumPy-idiomatic implementation.

    This class provides:
      - Torus + qutrit evolution and per-node modulation signals.
      - Minimal audio renderer for quick auditioning (not a JUCE replacement).
    """

    def __init__(self, num_nodes: int = 8, sample_rate: float = 48000.0, control_rate: float = 1000.0, seed: int = 0xE8E8E8E8):
        self.num_nodes = int(num_nodes)
        self.sample_rate = float(sample_rate)
        self.control_rate = float(control_rate)
        self.macros = Macros()
        self.rng = np.random.default_rng(seed)

        # E8 roots
        self.roots = generate_e8_roots()  # (240, 8)

        # Torus
        self.torus = E8Torus()

        # Per-node qutrit states
        self.qs: List[QutritState] = [QutritState() for _ in range(self.num_nodes)]

        # Sparse root indices per node (list of arrays)
        self.sparse_idx: List[np.ndarray] = self._choose_sparse_roots_per_node(self.num_nodes, roots_per_node=12)

        # Internal mod outputs per node
        self._dphi = np.zeros(self.num_nodes, dtype=np.float32)
        self._damp = np.ones(self.num_nodes, dtype=np.float32)
        self._morph = np.zeros(self.num_nodes, dtype=np.float32)

        # Minimal audio renderer state
        self._node_phase = np.zeros(self.num_nodes, dtype=np.float32)
        # Base freqs: golden-ratio-ish lattice around 110Hz
        phi = (1 + np.sqrt(5)) * 0.5
        ratios = phi ** (np.arange(self.num_nodes) - (self.num_nodes//2))
        self._base_freq = 110.0 * (ratios / np.max(ratios)).astype(np.float32)

        # Control scheduling
        self._samples_per_control = max(1, int(round(self.sample_rate / self.control_rate)))
        self._sample_counter = 0

    # ---------------- Vectorized helpers ----------------

    def _choose_sparse_roots_per_node(self, num_nodes: int, roots_per_node: int = 12) -> List[np.ndarray]:
        """
        Deterministic strided sampling across the 240 roots
        to ensure diverse coupling per node.
        """
        out = []
        stride = 240 // roots_per_node
        for i in range(num_nodes):
            offset = (i * 17) % 240  # decorrelate
            idx = (offset + np.arange(roots_per_node) * stride) % 240
            out.append(idx.astype(np.int32))
        return out

    def _apply_torus_macros(self) -> None:
        # Base omega from PhiDrift; gentle slope across axes
        drift = self.macros.PhiDrift
        base = drift * (0.6 + 0.1 * np.arange(8, dtype=np.float32))
        self.torus.omega = base.copy()

        # Apply a tiny Coxeter-like slow skew on angles
        cp = self.macros.CoxeterPhase
        self.torus.theta[0] = (self.torus.theta[0] + 0.001 * np.sin(cp)) % (2*np.pi)
        self.torus.theta[1] = (self.torus.theta[1] + 0.001 * np.cos(cp)) % (2*np.pi)

        # Entropy bloom adds small random torsion to omega & theta
        e = self.macros.EntropyBloom
        if e > 1e-6:
            self.torus.omega += e * (self.rng.uniform(-0.05, 0.05, size=8).astype(np.float32))
            self.torus.theta = (self.torus.theta + e * self.rng.uniform(-0.002, 0.002, size=8).astype(np.float32)) % (2*np.pi)

    # ---------------- Public API ----------------

    def set_macros(self, **overrides) -> None:
        for k, v in overrides.items():
            if hasattr(self.macros, k):
                setattr(self.macros, k, type(getattr(self.macros, k))(v))

    def control_step(self) -> None:
        """Run a single control-rate update across all nodes."""
        self._apply_torus_macros()
        dt = 1.0 / self.control_rate
        self.torus.advance(dt)

        # Compute all root phases once
        ph_all = self.torus.phases(self.roots)  # (240,)

        # For each node, accumulate coupling over its sparse subset
        phase_gain = float(self.macros.PhaseGain)
        amp_gain = float(self.macros.AmpGain)
        bias = float(self.macros.TernaryBias)
        lam = 0.8  # decay

        for i in range(self.num_nodes):
            idx = self.sparse_idx[i]
            ph = ph_all[idx]  # (roots_per_node,)
            s = np.sin(ph).sum()
            c = np.cos(ph).sum()
            norm = 1.0 / max(1, idx.size)

            self._dphi[i] = phase_gain * s * norm
            self._damp[i] = np.clip(1.0 + amp_gain * c * norm, 0.0, 4.0)

            # qutrit drive from torus angles (simple, musical proxy)
            drive0 = 0.5 * np.sin(self.torus.theta[0]) + 0.5 * np.sin(self.torus.theta[1])
            drive1 = 0.5 * np.cos(self.torus.theta[2]) + 0.5 * np.cos(self.torus.theta[3])

            qs = self.qs[i]
            qs.r[0] += dt * (-lam * qs.r[0] + drive0 + bias)
            qs.r[3] += dt * (-lam * qs.r[3] + drive1 - 0.5 * bias)
            qs.r[7] += dt * (-lam * qs.r[7] + 0.25 * (drive0 + drive1) - 0.5 * bias)

            # morph mapped to magnitude of selected components
            mag = float(np.sqrt(qs.r[0]**2 + qs.r[3]**2 + qs.r[7]**2))
            self._morph[i] = float(np.clip(0.5 * mag, 0.0, 1.0))
            qs.soft_project(1.2)

    def process_control_for_samples(self, num_samples: int) -> None:
        """
        Advance control-rate updates according to a sample count.
        """
        remaining = num_samples
        while remaining > 0:
            step = min(self._samples_per_control - self._sample_counter, remaining)
            self._sample_counter += step
            remaining -= step
            if self._sample_counter >= self._samples_per_control:
                self._sample_counter = 0
                self.control_step()

    # ---------------- Minimal Renderer (Research-Only) ----------------

    def _morph_wave(self, phase: np.ndarray, morph: np.ndarray) -> np.ndarray:
        """
        Simple sine->triangle morph. morph in [0,1].
        Returns the per-node signal mixed down to mono (vectorized).
        """
        # Sine:
        s = np.sin(phase)
        # Triangle (naive): scale arcsin(sin) to [-1,1]
        tri = (2/np.pi) * np.arcsin(np.sin(phase))
        # Linear morph
        return (1.0 - morph) * s + morph * tri

    def render(self, num_samples: int, base_gain: float = 0.2) -> Tuple[np.ndarray, np.ndarray]:
        """
        Generate stereo audio using a simple additive engine.
        Not a replacement for your SIMD LFO — this is for fast auditioning.

        Returns L, R as float32 arrays in [-1,1].
        """
        N = int(num_samples)
        L = np.zeros(N, dtype=np.float32)
        R = np.zeros(N, dtype=np.float32)

        # Precompute 2π / fs
        k = (2.0 * np.pi) / float(self.sample_rate)

        # Process in one go (research, not RT safe)
        # 1) Ensure control is up-to-date for this buffer
        self.process_control_for_samples(N)

        # 2) Vectorized per-node synthesis
        #    Phase increment = base_freq + dphi*(scaled)
        #    We'll scale dphi (rad/s) into Hz by 1/(2π), keep it subtle.
        dphi_hz = self._dphi / (2.0 * np.pi)
        amp = base_gain * self._damp

        # Evolve per-node phase across N samples
        # For a cheap approximation, assume dphi is constant over the block.
        # You can sub-chunk if you need tighter coupling to control updates.
        freq = np.clip(self._base_freq + dphi_hz, 1.0, 20000.0).astype(np.float32)
        phase_inc = k * freq  # radians per sample

        # Broadcast per-node phase over time using outer-add trick
        # phase_t[n, t] = phase0[n] + t * phase_inc[n]
        t_idx = np.arange(N, dtype=np.float32)
        phase_t = self._node_phase[:, None] + phase_inc[:, None] * t_idx[None, :]

        # Morph per node (constant over block)
        morph = self._morph[:, None]

        # Node signals
        sig = self._morph_wave(phase_t, morph) * amp[:, None]

        # Update node phases (carry final phase forward, mod 2π)
        self._node_phase = (self._node_phase + phase_inc * N) % (2.0 * np.pi)

        # Pan via two torus angles for a bit of motion (very gentle)
        pan = 0.5 + 0.5 * np.sin(self.torus.theta[4])  # 0..1
        left_mix = (1.0 - pan)
        right_mix = pan

        # Mix down
        mix = sig.sum(axis=0)  # (N,)
        L = (left_mix * mix).astype(np.float32)
        R = (right_mix * mix).astype(np.float32)

        # EnergyFlow scaling
        gain = float(self.macros.EnergyFlow)
        L *= gain
        R *= gain
        # Soft clip
        L = np.tanh(L)
        R = np.tanh(R)
        return L, R


# ------------------------- Convenience Demo -------------------------

def demo_to_wav(path: str = "e8_demo.wav", seconds: float = 3.0, sr: float = 48000.0) -> str:
    """
    Quick smoke test: render a short stereo file to disk.
    """
    e8 = E8FractalPowerModule(num_nodes=8, sample_rate=sr, control_rate=1000.0)
    e8.set_macros(CosmicDepth=5, PhiDrift=0.02, EntropyBloom=0.02, PhaseGain=0.25, AmpGain=0.20, TernaryBias=0.10)
    num_samples = int(seconds * sr)
    L, R = e8.render(num_samples=num_samples, base_gain=0.2)

    # 16-bit PCM WAV write (no external deps)
    data = np.stack([L, R], axis=1)
    # normalize to int16 range (conservative)
    peak = max(1e-9, float(np.max(np.abs(data))))
    data = (data / peak * 0.9)  # -1..1 scaled
    pcm = (data * 32767.0).astype(np.int16)

    import wave, struct
    with wave.open(path, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(int(sr))
        wf.writeframes(pcm.tobytes())

    return path
