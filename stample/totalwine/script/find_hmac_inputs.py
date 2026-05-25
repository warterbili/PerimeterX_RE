"""Locate the function definitions of oU/ku/qy/qT/jm in main.min.js, plus their
return statements, so we can reverse what inputs they hash.

This is the recorded discovery path for totalwine 2026-05-25: it grepped these
5 function names in the locked SDK and found that the 4 HMAC fields use
state.vid / state.pxsid / md5(state.vid) — not the iFood-style uuid+suffix.

For new sites, see skill/AI_re/playbooks/recover-hmac-formulas.md (generalized SOP)."""
import re, sys
from pathlib import Path

SDK_PATH = Path(__file__).resolve().parent.parent / "source" / "main.min.js"
SDK = SDK_PATH.read_text(encoding='utf-8', errors='ignore')


def find_braced(start_idx):
    depth = 0
    in_str = False
    quote = None
    i = SDK.index('{', start_idx)
    depth = 1
    i += 1
    while i < len(SDK) and depth > 0 and (i - start_idx) < 4000:
        c = SDK[i]
        if in_str:
            if c == '\\':
                i += 2
                continue
            if c == quote:
                in_str = False
        elif c in '"\'':
            in_str = True
            quote = c
        elif c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
        i += 1
    return SDK[start_idx:i]


for fn in ['oU', 'ku', 'qy', 'qT', 'jm']:
    print(f'\n=== function {fn} ===')
    found = False
    for m in re.finditer(rf'function {re.escape(fn)}\(', SDK):
        body = find_braced(m.start())
        print(f'  pos {m.start()}: {body[:600]}')
        print()
        found = True
        break
    if not found:
        # try var X = function() style
        for m in re.finditer(rf'\b{re.escape(fn)}\s*=\s*function\s*\(', SDK):
            body = find_braced(m.start())
            print(f'  pos {m.start()} (var=func): {body[:600]}')
            found = True
            break
    if not found:
        print('  (not found as function — likely an arrow or assigned-from-var)')
