import hashlib
import io
import unittest
from unittest.mock import patch
import numpy as np
from scipy.io import wavfile
from boxcar_support import SOURCE, REFERENCE, load_helper, render, render_code, verify_reference

smooth = load_helper()

def direct(x):
    return np.convolve(x, np.ones(60)/60, mode='same')

class BoxcarTests(unittest.TestCase):
    def test_reference_blob_and_narrow_source_change(self):
        verify_reference()
        # The helper and the one call site are the only production changes.
        import ast
        old = ast.parse(REFERENCE.read_text())
        new = ast.parse(SOURCE.read_text())
        new.body = [n for n in new.body if not isinstance(n, ast.FunctionDef)]
        for node in new.body:
            if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'dark' for t in node.targets):
                node.value = next(n.value for n in old.body if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'dark' for t in n.targets))
        self.assertEqual(ast.dump(old), ast.dump(new))

    def test_bounded_numerical_cases_and_lengths(self):
        rng = np.random.default_rng(731)
        for n in [8192, 8193, 16383, 16384, 16385, 65536, 1_440_000]:
            cases = [np.zeros(n), np.ones(n), np.full(n, -1.), np.linspace(-1, 1, n),
                     np.resize(np.array([-1., 1.]), n), rng.uniform(-1, 1, n),
                     rng.uniform(-1e-14, 1e-14, n), np.full(n, 1e-16)]
            cases[-1][0] = 1.
            for x in cases:
                with self.subTest(n=n, first=float(x[0])):
                    ref = direct(x)
                    with patch.object(np, 'convolve', side_effect=AssertionError('unexpected fallback')):
                        got = smooth(x)
                    self.assertEqual(got.shape, x.shape)
                    self.assertEqual(got.dtype, np.dtype('float64'))
                    self.assertLessEqual(float(np.max(np.abs(got-ref))), 1e-9)

    def test_impulse_alignment_edges_and_all_block_seams(self):
        n = 1_440_000
        x = np.zeros(n)
        # Disjoint impulses near all 175 block seams and both signal edges.
        indices = [0, 29, 30, n-1] + [i+j for i in range(8192, n-31, 8192) for j in (-30,-1,0,1,29,30)]
        x[indices] = 1.
        np.testing.assert_allclose(smooth(x), direct(x), rtol=0, atol=1e-12)
        for i in [0,29,30,8191,8192,8193,16383,16384,16444]:
            x = np.zeros(16445); x[i] = 1.
            got = smooth(x)
            expected = np.zeros_like(x)
            expected[max(0,i-29):min(len(x),i+31)] = 1/60
            np.testing.assert_array_equal(got, expected)

    def test_outside_contract_is_exact_direct_fallback(self):
        rng = np.random.default_rng(2026)
        cases = [np.arange(n, dtype=float) for n in [1, 59, 60, 61, 8191]]
        cases += [np.zeros(1_440_001), np.zeros(8192, dtype=np.float32),
                  np.zeros(8192, dtype=np.int64), np.zeros(8192, dtype=complex),
                  np.zeros(16384)[::2], [0.] * 8192,
                  np.full(8192, 1e12)+np.linspace(-1,1,8192),
                  np.resize(np.array([-1e12,1e12]),8192),
                  np.full(8192, np.nextafter(1., 2.)),
                  np.full(8192, np.nextafter(-1., -2.))]
        for value in [np.nan,np.inf,-np.inf,1e12]:
            x = rng.uniform(-.1,.1,8192); x[4000] = value; cases.append(x)
        for x in cases:
            with self.subTest(dtype=str(np.asarray(x).dtype), length=len(x)), np.errstate(all='ignore'):
                ref = direct(x)
                with patch.object(np, 'cumsum', side_effect=AssertionError('unexpected fast path')):
                    got = smooth(x)
                np.testing.assert_array_equal(got, ref)
                self.assertEqual(got.dtype, ref.dtype)
        np.testing.assert_array_equal(smooth(np.array(1.)), direct(np.array(1.)))
        for x in [np.array([]), np.zeros((2,8192))]:
            with self.subTest(shape=x.shape):
                with self.assertRaises(ValueError): direct(x)
                with self.assertRaises(ValueError): smooth(x)

    def test_generic_float32_equality_is_not_a_contract(self):
        x = np.full(8192, 1e-16); x[0] = 1.
        got, ref = smooth(x), direct(x)
        self.assertLessEqual(float(np.max(np.abs(got-ref))), 1e-9)
        self.assertGreater(np.count_nonzero(got.astype(np.float32) != ref.astype(np.float32)), 0)

    def test_complete_default_pcm_and_wav_parity(self):
        old = render(render_code(REFERENCE))
        new = render(render_code(SOURCE))
        np.testing.assert_array_equal(new.view(np.uint32), old.view(np.uint32))
        self.assertEqual(hashlib.sha256(old.tobytes()).hexdigest(), '429b4ead52dc15453faa67fb2312f970333bb6b116016c8fc4a093127e292e44')
        streams = []
        for pcm in (old,new):
            stream = io.BytesIO(); wavfile.write(stream,48000,pcm); streams.append(stream.getvalue())
        self.assertEqual(streams[0],streams[1])
        self.assertEqual(len(streams[0]),5_760_058)
        self.assertEqual(hashlib.sha256(streams[0]).hexdigest(),'a6caa42c91ae3ffd5d60c81a3ea56566c17f671b8833bd97e394a1366b354957')

if __name__ == '__main__':
    unittest.main()
