"""Quick STATIC/DYNAMIC classifier across our 6 decoded batches."""
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EVENT_DIR = ROOT / "event_json"


def classify(prefix):
    """prefix = '1', '2', or '3' (collector index)"""
    samples = []
    for b in range(1, 17):
        p = EVENT_DIR / f"{b}-{prefix}.json"
        if not p.exists():
            continue
        d = json.loads(p.read_text())[0]
        samples.append((b, d))

    if not samples:
        print(f"no samples for collector#{prefix}")
        return

    # all keys across all samples (union)
    all_keys = set()
    for _, s in samples:
        all_keys.update(s["d"].keys())

    print(f"\n{'='*78}")
    print(f"EV{prefix} — {len(samples)} batches | t={samples[0][1]['t']} | union keys={len(all_keys)}")
    print(f"{'='*78}")

    static = []
    dynamic = []
    conditional = []  # key not present in all batches

    for k in all_keys:
        present = [s["d"].get(k, "<missing>") for _, s in samples]
        if any(v == "<missing>" for v in present):
            conditional.append((k, present))
        else:
            distinct = set()
            for v in present:
                try:
                    distinct.add(json.dumps(v, sort_keys=True))
                except TypeError:
                    distinct.add(str(v))
            if len(distinct) == 1:
                static.append((k, present[0]))
            else:
                dynamic.append((k, present))

    print(f"  STATIC: {len(static)}  DYNAMIC: {len(dynamic)}  CONDITIONAL: {len(conditional)}")
    print(f"  ratios: {len(static)/len(all_keys):.0%}/{len(dynamic)/len(all_keys):.0%}/{len(conditional)/len(all_keys):.0%}")

    print(f"\n  --- DYNAMIC keys ({len(dynamic)}) ---")
    for k, vals in dynamic[:30]:
        s = ", ".join(json.dumps(v) if isinstance(v, (str, int, float, bool, type(None))) else str(v)[:30] for v in vals)
        print(f"    {k}  ->  [{s[:140]}]")

    if conditional:
        print(f"\n  --- CONDITIONAL keys ({len(conditional)}) (in some batches only) ---")
        for k, vals in conditional[:30]:
            present_batches = [i for i, v in enumerate(vals, 1) if v != "<missing>"]
            absent_batches = [i for i, v in enumerate(vals, 1) if v == "<missing>"]
            sample_val = next((v for v in vals if v != "<missing>"), None)
            print(f"    {k}  present in batches {present_batches}, absent in {absent_batches}, sample={json.dumps(sample_val)[:80]}")

    # save to JSON for downstream
    out = {
        "event_type": samples[0][1]["t"],
        "batches_used": [b for b, _ in samples],
        "static": [k for k, _ in static],
        "dynamic": [k for k, _ in dynamic],
        "conditional": [k for k, _ in conditional],
    }
    (ROOT / f"diff_ev{prefix}.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(f"\n  wrote diff_ev{prefix}.json")


for p in ("1", "2", "3"):
    classify(p)
