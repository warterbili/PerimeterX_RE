"""
为每个 state.* (从 ob#1 解出) 在 ev2 中找对应 b64 key（值匹配）。

输出 deliverables/ev2_state_key_map.json:
  { "state.no":    "<b64_key>",
    "state.vid":   "<b64_key>",
    "state.pxsid": "<b64_key>",
    "state.appId": "<b64_key>",
    "state.to":    "<b64_key>",
    ...
  }
"""
import json, sys, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, r"C:\Users\lsd\projects\ICT")
from ICT.px_pure_cookie import decode_ob, GT  # type: ignore

def main():
    # Try matching state.* values per batch
    mapping = {}      # state field -> {b64_key: count}
    for b in range(1, 7):
        resp_body = (ROOT / f"samples/{b}/1.json").read_text(encoding="utf-8")
        decoded = decode_ob(resp_body, GT)
        st = decoded.get("state", {})
        ev2 = json.loads((ROOT / f"event_json/{b}-2.json").read_text(encoding="utf-8"))[0]
        d = ev2["d"]

        print(f"\n== batch {b} ==")
        print(f"  state keys: {list(st.keys())}")
        print(f"  state.no    = {st.get('no')!r}")
        print(f"  state.to    = {st.get('to')!r}")
        print(f"  state.appId = {st.get('appId')!r}")
        print(f"  state.vid   = {st.get('vid')!r}")
        print(f"  state.pxsid = {st.get('pxsid')!r}")
        print(f"  state.cts   = {st.get('cts')!r}")
        print(f"  state.qa    = {(st.get('qa') or '')[:20]}...")
        print(f"  state.jf    = {st.get('jf')!r}")
        print(f"  state.ao    = {st.get('ao')!r}")
        print(f"  state.o111val = {st.get('o111val')!r}")
        # state.no as both string and int
        candidates = {
            'state.no':      [st.get('no'), int(st['no']) if st.get('no') else None],
            'state.to':      [st.get('to'), int(st['to']) if st.get('to') else None],
            'state.appId':   [st.get('appId')],
            'state.vid':     [st.get('vid')],
            'state.pxsid':   [st.get('pxsid')],
            'state.cts':     [st.get('cts')],
            'state.qa':      [st.get('qa')],
            'state.jf':      [st.get('jf')],
            'state.ao':      [st.get('ao'), int(st['ao']) if st.get('ao') else None],
            'state.o111val': [st.get('o111val'), str(st['o111val']) if st.get('o111val') is not None else None],
        }

        for sname, vals in candidates.items():
            vals = [v for v in vals if v is not None]
            for k, v in d.items():
                if v in vals:
                    mapping.setdefault(sname, {}).setdefault(k, 0)
                    mapping[sname][k] += 1

    # Print summary
    print("\n" + "="*78)
    print("Cross-batch consistency:")
    print("="*78)
    out = {}
    for sname in sorted(mapping.keys()):
        candidates = mapping[sname]
        best = max(candidates.items(), key=lambda kv: kv[1])
        if best[1] >= 4:  # consistent across most batches
            out[sname] = best[0]
            print(f"  {sname:<15}  →  {best[0]}  ({best[1]}/6 batches)")
        else:
            print(f"  {sname:<15}  →  AMBIGUOUS  candidates={candidates}")

    # Save
    out_path = ROOT / "deliverables" / "ev2_state_key_map.json"
    out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nwrote {out_path}")

main()
