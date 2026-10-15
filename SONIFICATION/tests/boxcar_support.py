"""Source-bound, I/O-free execution of the complete prototype computation."""
import ast
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'sonify_v1.2.py'
REFERENCE = ROOT / 'tests/fixtures/boxcar-v1/sonify_v1.2.reference.py'
REFERENCE_BLOB = '42a2c6564136f9aa24fe97de300aace00b822e7d'

def verify_reference():
    data = REFERENCE.read_bytes()
    assert hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() == REFERENCE_BLOB

def load_helper():
    tree = ast.parse(SOURCE.read_text())
    definitions = [node for node in tree.body if isinstance(node, ast.FunctionDef)]
    assert [node.name for node in definitions] == ['_smooth_dark_noise']
    import numpy as np
    scope = {'np': np}
    exec(compile(ast.Module(body=definitions, type_ignores=[]), str(SOURCE), 'exec'), scope)
    return scope['_smooth_dark_noise']

def render_code(path):
    # Exclude only output-directory setup, imports and the save/print tail.
    # Synthesis statements are otherwise unchanged, including the real helper.
    tree = ast.parse(path.read_text().split('# === SAVE ===')[0])
    body = []
    for node in tree.body:
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            continue
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'output_dir' for t in node.targets):
            continue
        if isinstance(node, ast.Expr) and isinstance(node.value, ast.Call) and isinstance(node.value.func, ast.Attribute) and node.value.func.attr == 'makedirs':
            continue
        body.append(node)
    return compile(ast.Module(body=body, type_ignores=[]), str(path), 'exec')

def render(code):
    import numpy as np
    scope = {'np': np}
    exec(code, scope)
    # Include the output conversion in whole-compute timing, but not SciPy
    # serialization, filesystem operations or interpreter/library startup.
    return scope['signal'].astype(np.float32)
