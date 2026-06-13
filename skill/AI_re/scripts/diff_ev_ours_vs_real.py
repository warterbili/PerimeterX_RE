"""
Field-by-field diff: our generator's EV vs browser-captured real EVs.

Use case: cookie issued OK but Layer 3.5 fails (cookie rejected at PX-gated
endpoint). This script identifies the bot signal hiding in our EV2/EV3.

How to adapt to your site (this template targets totalwine — replace paths):
  1. Make your generator dump its in-flight EV1/EV2/EV3 to JSON (see
     stample/totalwine/px_cookie/totalwine_px2.js for the DUMP_EV_DIR pattern —
     env-gated side effect that writes our_ev1.json / our_ev2.json after
     each build).
  2. Set OURS_PATH below to that dump file.
  3. Set REAL_BATCHES to your 6 cold-capture batches.
  4. Run, read sections in order — first non-zero section is usually the bug.

Output sections:
  1. Field-set diff (keys we added that browser doesn't have / vice versa) — Gotcha #12
  2. Type mismatches (string vs number) — Gotcha #1 / #10
  3. STATIC value mismatches (we differ in a field that's identical across all browser batches)
  4. Field order at template top + anti-tamper slot position — Gotcha #3
  5. Counter sub-field synchronization (whether PX12xxx fields match) — Gotcha #17 (2026-05-25)

Strict-tier PX deployments (see references/deployment-tiers.md) need ALL
sections clean. Lenient deployments (iFood/Grub) can tolerate small drift in 5.
"""

import json, sys, os
from pathlib import Path
from collections import Counter

# Adapt these paths for your site (default: the in-repo totalwine package; override with EV_DIFF_ROOT):
ROOT = Path(os.environ.get("EV_DIFF_ROOT", "stample/totalwine"))

OURS_PATH = ROOT / "sample/replay/our_ev_v2/our_ev2.json"
REAL_BATCHES = [p for p in (ROOT / f"sample/{i}/decoded_payload_2.json" for i in range(1, 8)) if p.exists()]


def load_ev2(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    e = data[0] if isinstance(data, list) else data
    # tolerate _meta field
    d = e.get("d") or e["d"]
    return e, d


def _check_counter_sync(our_d, real_batches):
    """For each dict-typed field, infer sub-field invariants from real batches
    and check ours preserves them.

    Detected invariants:
      - EQ(a, b): sub-fields a and b are always equal across all real batches
      - CONST(a, v): sub-field a is always the constant v
      - MONOTONIC(a): sub-field a is monotonically increasing across batches
        (only meaningful if EV ordering matches session ordering; conservatively
        skipped here — main goal is catching EQ violations like PX12738==PX12739)

    Returns: list of {key, rule, real_examples, our_value} violation dicts.
    """
    violations = []
    for k, ours_val in our_d.items():
        if not isinstance(ours_val, dict):
            continue
        # Collect real dict values for this key across batches
        real_dicts = [rb.get(k) for rb in real_batches if isinstance(rb.get(k), dict)]
        if len(real_dicts) < 3:
            continue   # need ≥3 batches to be confident about invariants
        sub_keys = sorted(set().union(*(d.keys() for d in real_dicts)))
        if len(sub_keys) < 2:
            continue
        # Invariant 1: EQ(a, b) — for every batch, real[a] == real[b]
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
                # Weaker EQ-or-sentinel: e.g. real always has b ∈ {0, a}
                # (Common: "this counter category had no events this session" → b=0; else mirrors a)
                sentinels = {0, "", None, False}
                if all(p[1] in sentinels or p[0] == p[1] for p in pairs):
                    if any(p[1] not in sentinels and p[0] == p[1] for p in pairs):
                        ov_a, ov_b = ours_val.get(a), ours_val.get(b)
                        if (ov_a is not None and ov_b is not None
                                and ov_b not in sentinels and ov_a != ov_b):
                            violations.append({
                                "key": k,
                                "rule": f"real always has {b} ∈ {{0, {a}}}; ours has {a}={ov_a} vs {b}={ov_b} (independent random — bot signal)",
                                "real_examples": [{a: d.get(a), b: d.get(b)} for d in real_dicts[:3]],
                                "our_value": {a: ov_a, b: ov_b},
                            })
        # Invariant 2: CONST(a, v) — sub-field a is the same value across all real batches
        for a in sub_keys:
            real_vals = [d.get(a) for d in real_dicts if a in d]
            if len(real_vals) == len(real_dicts):
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

    # ─── 6. Counter/dict sub-field synchronization (Gotcha #17) ───
    # For any dict-valued field where real captures show a structural invariant
    # between sub-fields (equality, monotonic growth, fixed sentinel value),
    # check that ours preserves that invariant.
    print(f"━━━ 6. Dict sub-field synchronization (Gotcha #17) ━━━")
    counter_violations = _check_counter_sync(our_d, real_batches)
    if not counter_violations:
        print("   ✅ none — all dict-typed fields preserve real sub-field invariants")
    else:
        for v in counter_violations:
            print(f"   🔴 {v['key']}  {v['rule']}")
            print(f"      real samples: {v['real_examples']}")
            print(f"      ours:         {v['our_value']}")
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
    out_path = ROOT / "sample/replay/diff_ours_vs_real.json"
    out_path.write_text(json.dumps(out, indent=2, default=str), encoding="utf-8")
    print(f"→ {out_path}")


if __name__ == "__main__":
    main()
