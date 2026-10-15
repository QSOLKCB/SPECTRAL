"""Paired, source-bound whole-compute and filter benchmarks (no speed gate in CI)."""
import argparse
import gc
import hashlib
import io
import json
import os
import platform
import statistics
import sys
import time
import tracemalloc
from pathlib import Path
import numpy as np
import scipy
from scipy.io import wavfile
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tests'))
from boxcar_support import SOURCE, REFERENCE, load_helper, render, render_code, verify_reference


def paired(methods, repeats, seed):
    rng = np.random.default_rng(seed)
    samples = {name: [] for name in methods}
    for fn in methods.values():
        fn()
    order = []
    for _ in range(repeats):
        names = list(rng.permutation(list(methods)))
        order.append(names)
        for name in names:
            gc.collect()
            start = time.perf_counter_ns()
            methods[name]()  # returned output destruction is included
            samples[name].append((time.perf_counter_ns()-start)/1e6)
    old, new = np.array(samples['direct']), np.array(samples['bounded'])
    ix = np.random.default_rng(seed+1).integers(0, repeats, (10000, repeats))
    ratio = np.median(old[ix], axis=1)/np.median(new[ix], axis=1)
    return {'raw_ms': samples, 'order': order,
            'median_ms': {k: statistics.median(v) for k,v in samples.items()},
            'median_ratio': float(np.median(old)/np.median(new)),
            'median_elapsed_reduction_percent': float(100*(1-np.median(new)/np.median(old))),
            'paired_bootstrap_ratio_95_interval': np.quantile(ratio,[.025,.975]).tolist()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--repeats', type=int, default=31)
    args = parser.parse_args()
    if args.repeats < 3:
        parser.error('at least 3 repeats required')
    verify_reference()
    helper = load_helper()
    codes = {'direct': render_code(REFERENCE), 'bounded': render_code(SOURCE)}
    methods = {name: (lambda code=code: render(code)) for name, code in codes.items()}
    outputs = {}
    pcm = {}
    for name, fn in methods.items():
        pcm[name] = fn()
        wav = io.BytesIO(); wavfile.write(wav,48000,pcm[name])
        outputs[name] = {'pcm_sha256':hashlib.sha256(pcm[name].tobytes()).hexdigest(),
                         'wav_sha256':hashlib.sha256(wav.getvalue()).hexdigest(),
                         'wav_bytes':len(wav.getvalue())}
    assert np.array_equal(pcm['direct'].view(np.uint32), pcm['bounded'].view(np.uint32))
    assert outputs['direct'] == outputs['bounded']
    del pcm
    result = {'schema':'spectral-boxcar-v1',
        'baseline_commit':'5265b7f130287f80b5cf0d3de5bb2953152f90cd',
        'baseline_git_blob':'42a2c6564136f9aa24fe97de300aace00b822e7d',
        'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'harness_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'support_sha256':hashlib.sha256((SOURCE.parent/'tests/boxcar_support.py').read_bytes()).hexdigest(),
        'environment':{'python':sys.version,'numpy':np.__version__,'scipy':scipy.__version__,
          'platform':platform.platform(),'cpu_count':os.cpu_count(),
          'threads':{k:os.environ.get(k) for k in ['OPENBLAS_NUM_THREADS','OMP_NUM_THREADS']}},
        'repeats':args.repeats,'outputs':outputs,
        'scope':'Whole compute includes all source synthesis, helper eligibility scans, allocations, output float32 conversion and destruction. Excludes imports, process startup, WAV serialization and filesystem I/O. Stage speedup is not whole-compute speedup. Bootstrap estimates observed run variability, not portability.',
        'whole_compute':paired(methods,args.repeats,202610151030)}
    noise = np.random.default_rng(2026).standard_normal(1_440_000)*.07
    stage = {'direct':lambda:np.convolve(noise,np.ones(60)/60,mode='same'),
             'bounded':lambda:helper(noise)}
    result['filter'] = paired(stage,args.repeats,202610151031)
    # Honest small-input negative case: bounded dispatch overhead, exact fallback.
    small = noise[:60]
    result['small_fallback'] = paired({'direct':lambda:np.convolve(small,np.ones(60)/60,mode='same'),
                                       'bounded':lambda:helper(small)},args.repeats,202610151032)
    peaks = {}
    for name, fn in stage.items():
        gc.collect(); tracemalloc.start(); fn()
        _, peaks[name] = tracemalloc.get_traced_memory(); tracemalloc.stop()
    result['filter_traced_peak_bytes'] = peaks
    result['memory_scope'] = 'Python/NumPy traced allocations only; not process RSS. The bounded helper allocates a padded input, output and small block temporaries; no memory-saving claim.'
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,indent=2,allow_nan=False)+'\n')
    print(json.dumps({k:result[k] for k in ['environment','outputs','whole_compute','filter_traced_peak_bytes']},indent=2))

if __name__ == '__main__':
    main()
