"""
Identify the semantic role of each EV2 DYNAMIC field by value pattern + position.

Outputs deliverables/ev2_dynamic_map.json:
  { "<b64_key>": {"role": "uuid|initTime|sendTime|state.no|state.vid|...", "samples": [...], "value_pattern": ...} }
"""
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EVENT_DIR = ROOT / "event_json"

# Load decoded params (uuid + seq + vid + cts + sid) from each batch's 1.txt/2.txt
def parse_form(body_path):
    body = body_path.read_text(encoding="utf-8")
    idx = body.find("# request body")
    body = body[idx:].split("\n", 1)[1] if idx >= 0 else body
    out = {}
    for p in body.replace("\n", "").split("&"):
        if "=" in p:
            k, v = p.split("=", 1)
            from urllib.parse import unquote
            out[k] = unquote(v)
    return out

uuid_re = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
hex32_re = re.compile(r"^[a-f0-9]{32}$")
hex64_re = re.compile(r"^[a-f0-9]{64}$")
digits16p_re = re.compile(r"^\d{16,}$")  # state.no
date_str_re = re.compile(r"^[A-Z][a-z]{2} [A-Z][a-z]{2} \d+ \d+ \d+:\d+:\d+")

def classify_value(vals):
    """Given list of values from 6 batches, infer semantic type."""
    # all none?
    samp = vals[0]
    if all(v is None for v in vals): return "all_null"
    if all(isinstance(v, bool) for v in vals): return "bool"
    if all(isinstance(v, int) for v in vals):
        if all(v > 1_000_000_000_000 for v in vals if v): return "timestamp_ms"
        if all(0 <= v < 100 for v in vals): return "small_int"
        if all(1_000_000 < v < 1_000_000_000 for v in vals): return "memory_bytes"
        return "int"
    if all(isinstance(v, float) for v in vals):
        if all(0 < v < 100000 for v in vals): return "perf_now_float"
        return "float"
    if all(isinstance(v, str) for v in vals):
        if all(uuid_re.match(v) for v in vals): return "uuid"
        if all(hex32_re.match(v) for v in vals): return "hex32_hmac_md5"
        if all(hex64_re.match(v) for v in vals): return "hex64"
        if all(digits16p_re.match(v) for v in vals): return "state_no_digits"
        if all(date_str_re.match(v) for v in vals): return "date_toString"
        if all(len(v) > 100 for v in vals): return "long_b64_ns_sm"
        if all(re.match(r"^[a-z0-9]{15,25}$", v) for v in vals): return "short_id_b62"
        if all(re.match(r"^\d{15,25}$", v) for v in vals): return "digit_string"
        return "string"
    if all(isinstance(v, dict) for v in vals):
        return "object"
    return "mixed"

def main():
    # load all 6 ev2 samples
    samples = []
    for b in range(1, 7):
        p = EVENT_DIR / f"{b}-2.json"
        samples.append((b, json.loads(p.read_text())[0]))

    # also pull collector#2 form params (vid, cts, sid, uuid) so we can match values
    params_per_batch = {}
    for b in range(1, 7):
        params_per_batch[b] = parse_form(ROOT / "samples" / str(b) / "2.txt")

    # cross-reference DYNAMIC fields
    diff = json.loads((ROOT / "diff_ev2.json").read_text())
    dynamic_keys = diff["dynamic"]
    conditional_keys = diff["conditional"]

    result = {}
    for k in dynamic_keys:
        vals = [s["d"].get(k) for _, s in samples]
        cls = classify_value(vals)
        # Try matching with form params
        roles = []
        for v in vals[:6]:
            for b, params in params_per_batch.items():
                if v == params.get("uuid"): roles.append("=uuid"); break
                if v == params.get("vid"): roles.append("=state.vid"); break
                if v == params.get("cts"): roles.append("=state.cts"); break
        result[k] = {
            "value_pattern": cls,
            "samples": vals,
            "form_match": ",".join(set(roles)) if roles else None,
        }

    # Conditional = anti-tamper (keys themselves are anti-tamper-style)
    at_keys = []
    for k in conditional_keys:
        if re.match(r"^[0-9:;<=>?@]{15,25}$", k):
            at_keys.append(k)
    result["__ANTI_TAMPER_KEYS__"] = at_keys

    out_path = ROOT / "deliverables" / "ev2_dynamic_map.json"
    out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")

    # Print summary
    print(f"DYNAMIC fields by inferred semantic:")
    by_cls = {}
    for k, info in result.items():
        if k.startswith("__"): continue
        by_cls.setdefault(info["value_pattern"], []).append(k)
    for cls, keys in sorted(by_cls.items()):
        print(f"  {cls:<22} ({len(keys)}):")
        for k in keys:
            samp = result[k]["samples"][0]
            samp_s = str(samp)[:60] if samp is not None else "null"
            extra = f"  [match: {result[k]['form_match']}]" if result[k]['form_match'] else ""
            print(f"    {k}  e.g. {samp_s}{extra}")
    print(f"\nanti-tamper keys: {len(result['__ANTI_TAMPER_KEYS__'])}")
    for k in result["__ANTI_TAMPER_KEYS__"]:
        print(f"  {k}")
    print(f"\nwrote {out_path}")

main()
