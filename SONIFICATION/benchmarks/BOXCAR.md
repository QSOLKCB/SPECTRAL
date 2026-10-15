# Bounded boxcar smoothing, v1

This change is private to `SONIFICATION/sonify_v1.2.py`. It does not modify the browser engines, other filters, or historical WAVs and receipts.

## Contract

The original `np.convolve(noise, np.ones(60)/60, mode='same')` remains the fallback. Only C-contiguous one-dimensional native float64 NumPy arrays, length 8192 through 1,440,000 inclusive, whose minimum and maximum are within [-1,1], use the optimized path. Min/max comparisons reject NaN and infinity. Other dtypes, layouts, dimensions, sizes and amplitudes retain the original computation, output shape, dtype and exception behavior. In particular N<60 still returns NumPy's length-60 result for nonempty input. Empty input still raises.

The fixed width is 60. Output i averages input indices i-30 through i+29 inclusive, padding out-of-range positions with zero. A float64 prefix sum resets every 8192 output samples, using 59 overlapping inputs. This bounds cumulative-sum history to 8251 samples. No new runtime dependency is added.

Accepted inputs have an absolute-error budget of 1e-9 against the direct NumPy FIR. For IEEE binary64, u=2^-53 and gamma_k=k*u/(1-k*u); a conservative two-prefix accumulation contribution is 2*gamma_8251*8251/60, approximately 2.52e-10. Subtraction, division and the direct 60-term FIR contribute a much smaller absolute allowance. This is an absolute budget, not a relative-error guarantee around zero. The suite exercises the implemented bound; it is not a machine-checked floating-point proof.

Generic float64 or float32 bit equality is not promised, even within the accepted range. A bounded 1e-16 background after a unit impulse supplies a retained counterexample to generic float32 equality. The complete fixed seed-2026, 48 kHz, 30-second render has separate exact PCM and WAV tests. If changing its recipe or supported numerical stack, rerun those tests before accepting the new output; do not silently update the expected hashes.

## Source and unchanged artifact oracle

Baseline: QSOLKCB/SPECTRAL commit `5265b7f130287f80b5cf0d3de5bb2953152f90cd`, source blob `42a2c6564136f9aa24fe97de300aace00b822e7d`.

The test fixture is the complete unmodified baseline script, retained under the repository MIT license. The suite checks its Git blob hash, and asserts that removing the new helper and restoring the single call makes the current production AST identical to the baseline. Tests execute synthesis without filesystem setup/save; WAV bytes are serialized separately to memory using the real SciPy writer.

- PCM SHA256: `429b4ead52dc15453faa67fb2312f970333bb6b116016c8fc4a093127e292e44`
- WAV SHA256: `a6caa42c91ae3ffd5d60c81a3ea56566c17f671b8833bd97e394a1366b354957`
- WAV length: 5,760,058 bytes

## Reproduce

From the repository root, with Python 3.12, SciPy 1.17.0 and NumPy 2.3.5 or 2.2.6:

```sh
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python -m unittest discover -s SONIFICATION/tests -v
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python SONIFICATION/benchmarks/bench_boxcar.py --output /tmp/boxcar-new-run.json
```

Write new benchmark receipts to a fresh path; preserve published historical evidence. CI runs parity tests under both NumPy versions, never a noisy performance threshold.

The benchmark uses 31 pairs with seeded randomized order, warming both methods first. It times actual current-source and original-source computation, including eligibility scans, all synthesis allocation, final float32 conversion, and destruction of returned output. It excludes imports, process startup, WAV serialization and disk I/O. This is a complete **in-memory compute** measurement, not end-to-end CLI latency. Filter-only results must not be advertised as overall speedups. Paired bootstrap intervals describe observed run variability, not cross-machine uncertainty.

The candidate allocates a padded input and output plus small temporary prefix blocks. Traced allocation peaks are recorded separately; these are not RSS and there is no memory-saving claim. Small fallback timings preserve dispatch overhead as a negative case. Arbitrary large DC, huge impulses and nonfinite data are excluded because prefix cancellation/contamination is unsuitable there; tests prove they use the exact original path.

## Academic basis and license

The running-sum identity is related to the integrator/comb construction in E. B. Hogenauer, “An Economical Class of Digital Filters for Decimation and Interpolation,” IEEE TASSP 29(2), 155–162 (1981), DOI https://doi.org/10.1109/TASSP.1981.1163535 . This single-rate blocked adaptation is independently written and does not reproduce a multirate CIC architecture. Floating-point drift is discussed in Steven W. Smith's author textbook, https://www.dspguide.com/ch15/5.htm . No external implementation or paper text is copied. The repository MIT license continues to apply.

## Recorded integration measurements

See adjacent dated JSON receipts for complete raw timings, order, environment, source/harness hashes, memory counts and unchanged artifact checks. These measurements cover two NumPy versions on the same Linux host, not two independent machines or all platforms. They supersede neither historical research evidence nor future deployment measurements.

On this host, NumPy 2.3.5 median whole-compute time fell from 314.296 to 301.610 ms (4.04%); NumPy 2.2.6 fell from 317.827 to 305.748 ms (3.80%). Both retained exact baseline PCM/WAV. Bootstrap 95% median-ratio intervals were [1.0311, 1.0562] and [1.0307, 1.0472], respectively. The measured filter traced-allocation peak rose from 11,521,488 to 23,249,590 bytes. This roughly 11.7 MB extra allocation is an explicit tradeoff for the bounded compute gain, not a memory optimization.
