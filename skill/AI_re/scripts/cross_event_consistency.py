"""
cross_event_consistency.py — the missing diff dimension for PX EV reversing.

WHY THIS EXISTS
---------------
The other diff tools (diff_ev_ours_vs_real, compare_ev2_field_by_field, diff_samples)
compare a SINGLE event snapshot: field-set, type, static-value, shape. They are
structurally blind to constraints that only exist ACROSS the EV1→EV2→EV3 sequence
of ONE session:

  - CONSTANT  : a field that MUST hold the same value in every event of a session
                (page-load timestamp, uuid, navigator.platform, location.href).
  - MONOTONIC : a field that MUST strictly increase across the events
                (performance.now timer, event counters, the current-time stamp).
  - DICT/counter sub-field invariants across events (e.g. PX12738 == PX12739,
                a sub-counter that is 0 or mirrors another, and monotonic growth).

A generator can pass every single-snapshot diff yet still be DISTRUSTED on a strict
tier because it broke one of these cross-event rules (e.g. emitted a different
page-load timestamp in EV1 vs EV2, or a perf timer that doesn't increase, or a
counter that doesn't track time). The strict-tier backend re-checks these.

The rules are derivable from REAL browser captures alone — every CDP capture that
contains seq=0/1/2 carries EV1/EV2/EV3 of one session. Run this on the real
captures FIRST; then run it on your generator's dumped EVs and make every CONSTANT
and MONOTONIC verdict match.

USAGE
-----
  python cross_event_consistency.py <samples_root> [batch_ids...]

  <samples_root>  dir containing <id>/decoded_payload_{1,2,3}.json per session
                  (produce these with decode_payload.js / decode_all.js)
  [batch_ids]     optional subset; default = all numeric subdirs

Run it twice and eyeball that the CONSTANT/MONOTONIC verdicts agree:
  python cross_event_consistency.py samples            # real captures
  python cross_event_consistency.py samples/_our_ev    # generator dumps
"""
import json
import sys
from pathlib import Path
from collections import defaultdict


def load_events(d: Path):
    """Return [ev1_d, ev2_d, ev3_d]; None for any missing event."""
    evs = []
    for i in (1, 2, 3):
        p = d / f"decoded_payload_{i}.json"
        if p.exists():
            arr = json.loads(p.read_text(encoding="utf-8"))
            evs.append(arr[0].get("d", {}) if arr else None)
        else:
            evs.append(None)
    return evs


def classify(evs):
    """Per key present in >=2 events: CONSTANT / MONOTONIC(up|down) / VARY."""
    present = [e for e in evs if e is not None]
    if len(present) < 2:
        return {}
    keys = set().union(*[set(e.keys()) for e in present])
    out = {}
    for k in keys:
        vals = [e.get(k) for e in evs if e is not None and k in e]
        if len(vals) < 2:
            continue
        if all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in vals):
            if len(set(vals)) == 1:
                out[k] = ("CONSTANT", vals)
            elif all(vals[i] <= vals[i + 1] for i in range(len(vals) - 1)):
                out[k] = ("MONOTONIC^", vals)
            elif all(vals[i] >= vals[i + 1] for i in range(len(vals) - 1)):
                out[k] = ("MONOTONICv", vals)
            else:
                out[k] = ("VARY-num", vals)
        else:
            sv = [json.dumps(v, sort_keys=True, default=str) for v in vals]
            out[k] = ("CONSTANT" if len(set(sv)) == 1 else "VARY", vals)
    return out


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    root = Path(sys.argv[1])
    batch_ids = sys.argv[2:] or [p.name for p in sorted(root.iterdir())
                                 if p.is_dir() and p.name.isdigit()]

    agg = defaultdict(lambda: defaultdict(int))
    samples = {}
    for b in batch_ids:
        cls = classify(load_events(root / b))
        if cls:
            samples[b] = cls
            for k, (cat, _) in cls.items():
                agg[k][cat] += 1

    n = len(samples)
    print(f"Analyzed {n} sessions with >=2 events from {root}\n")
    print(f"{'KEY':<22} {'consensus':<12} note")
    print("-" * 72)

    def rank(cats):
        top = max(cats.items(), key=lambda x: x[1])[0]
        return {"CONSTANT": 0, "MONOTONIC^": 1, "MONOTONICv": 2}.get(top, 9)

    for k in sorted(agg, key=lambda k: (rank(agg[k]), k)):
        cats = agg[k]
        cat, cnt = max(cats.items(), key=lambda x: x[1])
        ex = next((s[k][1] for s in samples.values() if k in s and s[k][0] == cat), None)
        exs = json.dumps(ex, default=str)[:40] if ex is not None else ""
        flag = "  <-- generator MUST preserve" if cat in ("CONSTANT", "MONOTONIC^") else ""
        print(f"{k:<22} {cat:<12} {cnt}/{n}  {exs}{flag}")

    # Dict-valued fields (counters): show sub-field progression — auto-detected.
    dict_keys = sorted({k for s in samples.values()
                        for k, (_, vals) in s.items() if isinstance(vals[0], dict)})
    if dict_keys:
        print("\n-- dict/counter sub-field progression across events --")
        for b in list(samples.keys())[:3]:
            evs = load_events(root / b)
            for dk in dict_keys:
                prog = [e.get(dk) for e in evs if e and dk in e]
                if prog:
                    print(f"  [{b}] {dk}: " + "  ".join(json.dumps(p) for p in prog))


if __name__ == "__main__":
    main()
