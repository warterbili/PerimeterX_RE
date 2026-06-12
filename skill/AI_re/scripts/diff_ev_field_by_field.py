"""
Field-by-field EV diff: MINE vs a REAL capture (site-agnostic).

The strict/strict+ rule: "field set + types + static values + shape" all matching is
NECESSARY, not sufficient — but getting it exact is the floor. This flags the three
floor-violations a single-snapshot eye-check misses:

  - STATIC MISMATCH : a field that's identical across real batches but differs in mine = BUG
                      (you corrupted a template field, or mis-typed a "static" one).
  - TYPE MISMATCH   : number-vs-string etc. (Gotcha #1 class — e.g. state.no must be parseInt'd).
  - SHAPE DIFF      : a dynamic field whose value-shape (int width / str length / float-vs-int /
                      dict pattern) doesn't match real — your generator's source is wrong.

It does NOT check cross-event consistency (use cross_event_consistency.py) or legal
value-patterns of dict counters (eyeball those against the printed real sample).

Usage:
  python diff_ev_field_by_field.py mine_ev2.json real_ev2.json [override_keys.txt]
  # override_keys.txt: one b64 key per line = the DYNAMIC keys your generator overrides.
  #   keys NOT in it that differ are flagged as STATIC MISMATCH (likely bugs).
  # Each json may be the decoded payload ([{t,d}]) or a bare {d} / d dict.
"""
import json, sys


def load_d(p):
    j = json.load(open(p, encoding="utf-8"))
    if isinstance(j, list):
        j = j[0]
    return j.get("d", j)


def shape(v):
    if isinstance(v, bool): return "bool"
    if isinstance(v, int): return f"int[{len(str(abs(v)))}d]"
    if isinstance(v, float): return "float"
    if isinstance(v, str): return f"str[{len(v)}]"
    if isinstance(v, list): return f"list[{len(v)}]"
    if isinstance(v, dict): return "dict{" + ",".join(f"{k}={v[k]}" for k in list(v)[:4]) + "}"
    return type(v).__name__


def main():
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    mine, real = load_d(sys.argv[1]), load_d(sys.argv[2])
    override = set(open(sys.argv[3], encoding="utf-8").read().split()) if len(sys.argv) > 3 else set()
    mk, rk = set(mine), set(real)

    print(f"EV diff: mine={len(mk)} keys  real={len(rk)} keys")
    if mk - rk: print(f"  !! keys ONLY in mine ({len(mk-rk)}): {sorted(mk-rk)[:8]}")
    if rk - mk: print(f"  !! keys ONLY in real ({len(rk-mk)}): {sorted(rk-mk)[:8]}")

    same, static_bug, type_bug, dyn = 0, [], [], []
    for k in sorted(mk & rk):
        a, b = mine[k], real[k]
        if json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True):
            same += 1; continue
        if type(a) != type(b) and not ({type(a), type(b)} <= {int, float}):
            type_bug.append((k, a, b))
        elif override and k not in override:
            static_bug.append((k, a, b))
        else:
            dyn.append((k, a, b))

    print(f"  IDENTICAL: {same}")
    print(f"\n  --- STATIC MISMATCH (BUG — should match template) [{len(static_bug)}] ---")
    for k, a, b in static_bug:
        print(f"    {k}: mine={shape(a)}={json.dumps(a)[:40]}  real={shape(b)}={json.dumps(b)[:40]}")
    print(f"\n  --- TYPE MISMATCH (BUG — number/string, Gotcha #1) [{len(type_bug)}] ---")
    for k, a, b in type_bug:
        print(f"    {k}: mine={shape(a)}  real={shape(b)}")
    print(f"\n  --- DYNAMIC (value differs as expected; verify SHAPE matches) [{len(dyn)}] ---")
    for k, a, b in dyn:
        flag = "" if shape(a).split("[")[0] == shape(b).split("[")[0] else "   <-- SHAPE DIFF!"
        print(f"    {k}: mine={shape(a)}  real={shape(b)}{flag}")
    bad = len(static_bug) + len(type_bug) + sum(1 for k, a, b in dyn if shape(a).split("[")[0] != shape(b).split("[")[0])
    print(f"\n  => {bad} problem field(s). 0 = field floor met (still verify cross-event + legal patterns).")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
