"""Field-by-field equality check: our generated ev2 vs a browser-captured ev2.

Requires a local Python decoder module (`px_pure_cookie`) exposing `decode_ob` and
`GT`. Set the env var `PX_PY_DECODER_DIR` to its directory.
"""
import os, sys, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
_decoder_dir = os.environ.get("PX_PY_DECODER_DIR")
if not _decoder_dir:
    raise RuntimeError(
        "Set PX_PY_DECODER_DIR to the directory containing px_pure_cookie.py "
        "(must expose decode_ob and GT)."
    )
sys.path.insert(0, _decoder_dir)
sys.path.insert(0, str(ROOT / "deliverables"))
from px_pure_cookie_v2 import _generate_cookie, EV2_TEMPLATE, build_ev2  # type: ignore
from px_pure_cookie import decode_ob, GT  # type: ignore

# Generate one round of our payload + state
r = _generate_cookie()
state = r['state']

# Reconstruct what build_ev2 produced (call it again with same state)
import time, random
ev2_ours = build_ev2(
    state=state,
    uuid_str=r['uuid'],
    ua='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    init_time=int(time.time()*1000),
    send_ts=int(time.time()*1000)+1200,
    perf_now=1200.5,
    ns_result={'sm': None, 'duration': 0},
)
our_d = ev2_ours['d']

# Browser-captured reference (batch6 = cold)
browser = json.loads((ROOT / "event_json" / "6-2.json").read_text())[0]
browser_d = browser['d']

# Diff
all_keys = set(our_d.keys()) | set(browser_d.keys())

only_ours = set(our_d.keys()) - set(browser_d.keys())
only_browser = set(browser_d.keys()) - set(our_d.keys())
both = set(our_d.keys()) & set(browser_d.keys())

print(f"Our:     {len(our_d)} fields")
print(f"Browser: {len(browser_d)} fields")
print(f"Only ours:    {len(only_ours)}")
print(f"Only browser: {len(only_browser)}")
print()

if only_ours:
    print("KEYS ONLY IN OURS (we added/replaced wrongly):")
    for k in list(only_ours)[:20]:
        print(f"  {k}  -> {json.dumps(our_d[k])[:80]}")
    print()

if only_browser:
    print("KEYS ONLY IN BROWSER (we DROPPED!):")
    for k in list(only_browser)[:20]:
        print(f"  {k}  -> {json.dumps(browser_d[k])[:80]}")
    print()

# Type mismatches
type_mismatches = []
value_mismatches = []  # static fields where we differ
for k in both:
    ov = our_d[k]
    bv = browser_d[k]
    if type(ov) != type(bv):
        type_mismatches.append((k, type(ov).__name__, type(bv).__name__, ov, bv))

print(f"TYPE MISMATCHES ({len(type_mismatches)}):")
for k, ot, bt, ov, bv in type_mismatches[:30]:
    print(f"  {k}  ours={ot}({json.dumps(ov)[:40]}) vs browser={bt}({json.dumps(bv)[:40]})")
print()

# Field order check: same first 10 keys?
our_keys_order = list(our_d.keys())
browser_keys_order = list(browser_d.keys())
mismatches_in_order = 0
for i, (ok, bk) in enumerate(zip(our_keys_order, browser_keys_order)):
    if ok != bk:
        mismatches_in_order += 1
        if mismatches_in_order <= 5:
            print(f"ORDER DIFF @ pos {i}: ours={ok} vs browser={bk}")
print(f"\nTotal positions where order differs: {mismatches_in_order}/{min(len(our_keys_order),len(browser_keys_order))}")
