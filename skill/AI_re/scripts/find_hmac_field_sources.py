"""Step 2 + 3 of playbooks/recover-hmac-formulas.md:
Locate where a list of HMAC-output fields are assigned in the SDK, then dump
the source function definitions of the input/key extractors so you can read
what's being hashed.

How to adapt to your site:
  1. Set SDK_PATH to your captured main.min.js (or init.js for Grubhub).
  2. Set TARGET_B64_KEYS to the EV2 field keys you want to trace.
  3. Run. For each target key it grepts assignments like `i["..."] = jm(X(), Y())`.
  4. Read the X()/Y() definitions printed and feed them to crypto verification
     (Step 4 of the playbook).

Example: see how 4 HMAC fields were recovered for totalwine in
references/gotchas.md Bug #18."""
import re, sys, os
from pathlib import Path

# Adapt these for your site (default: the in-repo totalwine SDK; override with SDK_PATH):
SDK_PATH = Path(os.environ.get("SDK_PATH", "stample/totalwine/source/main.min.js"))
TARGET_B64_KEYS = ['Cho5UEx3PWY', 'Lx8cFWl9HCE', 'UiJhKBREYhs', 'EFwjFlU8JyU']
# Append helper functions you found in the grep output (X/Y in jm(X,Y) calls):
HELPER_FNS = ['oU', 'ku', 'qy', 'qT', 'jm']

SDK = open(SDK_PATH, encoding='utf-8', errors='ignore').read()


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


# First: grep where each target b64 key is assigned
print('═' * 60)
print('STEP 1: where each target field is assigned in SDK')
print('═' * 60)
for k in TARGET_B64_KEYS:
    print(f'\n--- "{k}=" ---')
    for m in re.finditer(re.escape(k + '='), SDK):
        s = max(0, m.start() - 100)
        e = min(len(SDK), m.end() + 100)
        print(f'  pos {m.start()}: ...{SDK[s:e]}...')

print('\n')
print('═' * 60)
print('STEP 2: function definitions of helpers in the assignment')
print('  (Read the printed `i = ... ; return i` pattern to see what input is hashed)')
print('═' * 60)
for fn in HELPER_FNS:
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
