"""
Field-by-field diff: our generator's EV2 vs a browser-captured real EV2.

Compares against several real batches (sample/1..6/decoded_payload_2.json) to
distinguish PER-SESSION DYNAMIC values (uuid/timestamps/hashes — expected to
differ) from STATIC fields where we differ in a way that signals BOT to PX.

Output sections:
  1. Field-set diff (keys we added that browser doesn't have / vice versa)
  2. Type mismatches (string vs number — the classic Gotcha #1 / #10)
  3. STATIC value mismatches (we differ in a field that's identical across all browser batches)
  4. Field order at template top + anti-tamper slot position
"""

import json, sys
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parent.parent    # stample/totalwine

# To produce our_ev2.json: run generator with env DUMP_EV_DIR set
#   DUMP_EV_DIR=stample/totalwine/sample/_our_ev node px_cookie/totalwine_px2.js
OURS_PATH = ROOT / "sample/_our_ev/our_ev2.json"
REAL_BATCHES = [p for p in (ROOT / f"sample/{i}/decoded_payload_2.json" for i in range(1, 8)) if p.exists()]


def _check_counter_sync(our_d, real_batches):
    """Gotcha #17: check dict-typed fields preserve real sub-field invariants
    (sub-fields equal, or sub-field is a constant).
    Catches counters like PX12738 == PX12739 going independent-random."""
    violations = []
    for k, ours_val in our_d.items():
        if not isinstance(ours_val, dict):
            continue
        real_dicts = [rb.get(k) for rb in real_batches if isinstance(rb.get(k), dict)]
        if len(real_dicts) < 3:
            continue
        sub_keys = sorted(set().union(*(d.keys() for d in real_dicts)))
        if len(sub_keys) < 2:
            continue
        for i, a in enumerate(sub_keys):
            for b in sub_keys[i+1:]:
                pairs = [(d.get(a), d.get(b)) for d in real_dicts]
                if any(p[0] is None or p[1] is None for p in pairs):
                    continue
                # Strict EQ: real always has a == b
                if all(p[0] == p[1] for p in pairs):
                    ov_a, ov_b = ours_val.get(a), ours_val.get(b)
                    if ov_a is not None and ov_b is not None and ov_a != ov_b:
                        violations.append({
                            "key": k,
                            "rule": f"real always has {a} == {b}, ours has {a}={ov_a} vs {b}={ov_b}",
                            "real_examples": [{a: d.get(a), b: d.get(b)} for d in real_dicts[:3]],
                            "our_value": {a: ov_a, b: ov_b},
                        })
                        continue
                # Weaker EQ-or-fixed: real always has b ∈ {fixed_sentinel, a} (e.g., b == 0 or b == a)
                # Common pattern for "this counter category had no events this session"
                sentinels = {0, "", None, False}
                if all(p[1] in sentinels or p[0] == p[1] for p in pairs):
                    # And there exists at least one batch where b is non-sentinel AND equals a
                    if any(p[1] not in sentinels and p[0] == p[1] for p in pairs):
                        ov_a, ov_b = ours_val.get(a), ours_val.get(b)
                        if (ov_a is not None and ov_b is not None
                                and ov_b not in sentinels and ov_a != ov_b):
                            violations.append({
                                "key": k,
                                "rule": f"real always has {b} ∈ {{0, {a}}} (b=0 means 'no events' / else mirrors a); ours has {a}={ov_a} vs {b}={ov_b} (independent random — bot signal)",
                                "real_examples": [{a: d.get(a), b: d.get(b)} for d in real_dicts[:3]],
                                "our_value": {a: ov_a, b: ov_b},
                            })
        for a in sub_keys:
            real_vals = [d.get(a) for d in real_dicts if a in d]
            if len(real_vals) == len(real_dicts):
                # use json.dumps for hash-stable equality (handles dict/list values)
                serialized = {json.dumps(v, sort_keys=True, default=str) for v in real_vals}
                if len(serialized) == 1:
                    ov = ours_val.get(a)
                    if ov is not None and json.dumps(ov, sort_keys=True, default=str) != next(iter(serialized)):
                        violations.append({
                            "key": k,
                            "rule": f"real always has {a}={real_vals[0]!r} (constant), ours has {a}={ov!r}",
                            "real_examples": [{a: v} for v in real_vals[:3]],
                            "our_value": {a: ov},
                        })
    return violations


def load_ev2(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    e = data[0] if isinstance(data, list) else data
    # tolerate _meta field
    d = e.get("d") or e["d"]
    return e, d


def main():
    our_e, our_d = load_ev2(OURS_PATH)
    real_batches = [load_ev2(p)[1] for p in REAL_BATCHES]

    print(f"Ours:    {len(our_d)} fields")
    for i, rd in enumerate(real_batches, 1):
        print(f"Real#{i}: {len(rd)} fields")
    print()

    # ─── 1. Field set diff (using latest available batch as primary reference) ───
    primary = real_batches[-1]
    only_ours = set(our_d) - set(primary)
    only_real = set(primary) - set(our_d)
    both = set(our_d) & set(primary)

    print(f"━━━ 1. Field set diff (ours vs real#6) ━━━")
    print(f"   in both:      {len(both)}")
    print(f"   only in ours: {len(only_ours)}")
    print(f"   only in real: {len(only_real)}")
    if only_ours:
        print(f"\n   🔴 KEYS ONLY IN OURS (we added wrongly):")
        for k in sorted(only_ours):
            print(f"      {k}  -> {json.dumps(our_d[k])[:80]}")
    if only_real:
        print(f"\n   🔴 KEYS ONLY IN REAL (we dropped):")
        for k in sorted(only_real):
            print(f"      {k}  -> {json.dumps(primary[k])[:80]}")
    print()

    # ─── 2. Type mismatches across all real batches ───
    print(f"━━━ 2. Type mismatches (ours vs real#6) ━━━")
    type_mismatches = []
    for k in both:
        ot = type(our_d[k]).__name__
        rt = type(primary[k]).__name__
        if ot != rt:
            type_mismatches.append((k, ot, rt, our_d[k], primary[k]))
    if not type_mismatches:
        print("   ✅ none")
    for k, ot, rt, ov, rv in type_mismatches:
        print(f"   🔴 {k}  ours={ot}({json.dumps(ov)[:40]}) vs real={rt}({json.dumps(rv)[:40]})")
    print()

    # ─── 3. STATIC value mismatches (real value identical across 6 batches but ours differs) ───
    print(f"━━━ 3. STATIC fields where we differ from the universal value ━━━")
    static_diffs = []
    for k in both:
        # is this STATIC across real batches?
        real_vals = [json.dumps(rb.get(k, "<MISSING>"), sort_keys=True) for rb in real_batches]
        if all(rb.get(k, "<MISSING>") != "<MISSING>" for rb in real_batches) and len(set(real_vals)) == 1:
            # field is STATIC across all 6 real batches
            ov_s = json.dumps(our_d[k], sort_keys=True)
            if ov_s != real_vals[0]:
                static_diffs.append((k, our_d[k], json.loads(real_vals[0])))
    if not static_diffs:
        print("   ✅ none — all STATIC fields match the canonical browser value")
    else:
        print(f"   🔴 {len(static_diffs)} STATIC fields with WRONG values:")
        for k, ov, rv in static_diffs[:40]:
            print(f"      {k}")
            print(f"         ours = {json.dumps(ov)[:120]}")
            print(f"         real = {json.dumps(rv)[:120]}")
    print()

    # ─── 4. Top-of-template field order ───
    print(f"━━━ 4. Field order check (first 15 keys) ━━━")
    our_keys = list(our_d.keys())
    real_keys = list(primary.keys())
    for i in range(min(15, len(our_keys), len(real_keys))):
        mark = "  " if our_keys[i] == real_keys[i] else "🔴"
        print(f"   {mark} pos {i:>3}: ours={our_keys[i]}   real={real_keys[i]}")
    diffs = sum(1 for a, b in zip(our_keys, real_keys) if a != b)
    print(f"   total positions differing: {diffs}/{min(len(our_keys), len(real_keys))}")
    print()

    # ─── 5. Anti-tamper slot position (find AT key in both, compare index) ───
    import re
    AT_RE = re.compile(r"^[0-9:;<=>?@]{15,25}$")
    def find_at(d):
        for i, (k, v) in enumerate(d.items()):
            if AT_RE.match(k) and isinstance(v, str) and AT_RE.match(v):
                return i, k, v
        return None
    at_ours = find_at(our_d)
    at_real = find_at(primary)
    print(f"━━━ 5. Anti-tamper slot ━━━")
    print(f"   ours: idx={at_ours[0] if at_ours else 'N/A'}  key={at_ours[1] if at_ours else 'N/A'}")
    print(f"   real: idx={at_real[0] if at_real else 'N/A'}  key={at_real[1] if at_real else 'N/A'}")
    if at_ours and at_real and at_ours[0] != at_real[0]:
        print(f"   🔴 ANTI-TAMPER POSITION DIFFERS by {abs(at_ours[0] - at_real[0])} slots")
    print()

    # ─── 6. Counter / dict sub-field synchronization (Gotcha #17) ───
    print(f"━━━ 6. Dict sub-field synchronization (Gotcha #17) ━━━")
    counter_violations = _check_counter_sync(our_d, real_batches)
    if not counter_violations:
        print("   ✅ none — all dict-typed fields preserve real sub-field invariants")
    else:
        for v in counter_violations:
            print(f"   🔴 {v['key']}  {v['rule']}")
            print(f"      real examples: {v['real_examples']}")
            print(f"      ours:          {v['our_value']}")
    print()

    # ─── 7. Save the side-by-side for follow-up ───
    out = {
        "summary": {
            "our_field_count": len(our_d),
            "real_field_count_avg": sum(len(rb) for rb in real_batches) / len(real_batches),
            "only_ours": sorted(only_ours),
            "only_real": sorted(only_real),
            "type_mismatches": [(k, ot, rt) for k, ot, rt, _, _ in type_mismatches],
            "static_value_mismatches": [(k, our_d[k], rv) for k, _, rv in static_diffs],
            "counter_sync_violations": counter_violations,
        }
    }
    out_path = ROOT / "sample/_diff_report/diff_ours_vs_real.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2, default=str), encoding="utf-8")
    print(f"→ {out_path}")


if __name__ == "__main__":
    main()
