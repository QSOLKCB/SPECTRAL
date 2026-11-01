"""Metadata-only PHOTOACOUSTIC resource checks; no actual sound synthesis."""
from __future__ import annotations
import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np

SOURCE = Path(__file__).resolve().parents[1] / "PHOTOACOUSTIC/scripts/photoacoustic_sonifier.py"
spec = importlib.util.spec_from_file_location("spectral_pa_test_target", SOURCE)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)

class InputBudgetTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "input.wav"
        self.path.write_bytes(b"small synthetic file")

    def tearDown(self):
        self.tmp.cleanup()

    def run_with_header(self, rate, frames=100, channels=1, output=44100):
        header = SimpleNamespace(samplerate=rate, frames=frames, channels=channels)
        with patch.object(module.sf, "info", return_value=header), patch.object(
            module.sf, "read", side_effect=AssertionError("decoded before preflight")
        ):
            return module.process_input_wav(
                str(self.path), None, None, output, 1.0, []
            )

    def test_reject_implausible_and_expanding_rates_without_read(self):
        for rate in (0, 1, 200, 192001):
            with self.subTest(rate=rate), self.assertRaises(ValueError):
                self.run_with_header(rate)
        with self.assertRaises(ValueError):
            self.run_with_header(8000, output=192000)

    def test_reject_excessive_projected_frames_before_read(self):
        with self.assertRaises(ValueError):
            self.run_with_header(22050, frames=4_000_000, output=176400)

    def test_reject_excessive_decoded_channels(self):
        with self.assertRaises(ValueError):
            self.run_with_header(44100, frames=100, channels=16)

    def test_normal_rate_still_passes_preflight(self):
        frames = np.zeros(2205, dtype=np.float64)
        header = SimpleNamespace(samplerate=44100, frames=2205, channels=1)
        with patch.object(module.sf, "info", return_value=header), \
             patch.object(module.sf, "read", return_value=(frames,44100)), \
             patch.object(module, "photoacoustic_transform", return_value=frames):
            result = module.process_input_wav(str(self.path), None, None, 44100, 1.0, [])
            self.assertEqual(result.size, 2205)

if __name__ == "__main__":
    unittest.main()
