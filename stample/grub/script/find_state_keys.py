#!/usr/bin/env python3
"""
find_state_keys.py — Grubhub Stage 5 关键脚本

对每个 state.* 变量（从 OB#1 解出），在 EV2 中找对应的 b64 key（值匹配）。
6 批同时命中的 key 才算确认 = "这个 EV2 b64 key 就是写入 state.X 的槽位"。

这一步是方法论 Stage 5 — 跨平台移植和新版本迁移的核心定位手段。
（state.* → EV2 b64 key 映射没有算法可推，只能值匹配。）

用法:
  python find_state_keys.py

前置条件:
  6 批样本都已经解码完成（运行过 decode_all.sh）

输出:
  ../state_key_map.json  — 含每个 state.X → b64 key 的映射 + 6 批值印证

⚠️ Grubhub 的 state.* → EV2 key 跟 iFood 完全不同！例如：
  iFood:    state.no → RTEwewNQMUg=
  Grubhub:  state.no → UT0ndxdcJUQ=
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
SAMPLE_DIR = HERE.parent / "sample"

STATE_VARS = ["no", "to", "qa", "vid", "pxsid", "appId", "cts", "jf"]

# 加载 6 批 (state + ev2)
batches = []
for n in range(1, 7):
    bdir = SAMPLE_DIR / str(n)
    state_file = bdir / "decoded_response_1.json"
    ev2_file = bdir / "decoded_payload_2.json"
    if not state_file.exists() or not ev2_file.exists():
        print(f"❌ batch {n} 缺解码文件，先跑 decode_all.sh")
        exit(1)
    state = json.loads(state_file.read_text(encoding="utf-8")).get("state", {})
    ev2 = json.loads(ev2_file.read_text(encoding="utf-8"))[0]["d"]
    batches.append({"n": n, "state": state, "ev2": ev2})

# 对每个 state.X 找匹配的 b64 key
mapping = {}
for var in STATE_VARS:
    candidate_sets = []
    for b in batches:
        v = b["state"].get(var)
        if v is None:
            continue
        v_str = str(v)
        candidates = set()
        for k, ev2_v in b["ev2"].items():
            if str(ev2_v) == v_str:
                candidates.add(k)
        candidate_sets.append(candidates)

    if not candidate_sets:
        mapping[f"state.{var}"] = None
        continue

    confirmed = candidate_sets[0]
    for s in candidate_sets[1:]:
        confirmed &= s

    if confirmed:
        b64_key = list(confirmed)[0]
        mapping[f"state.{var}"] = {
            "ev2_b64_key": b64_key,
            "candidates_per_batch": [len(s) for s in candidate_sets],
            "confirmed_across_batches": len(candidate_sets),
            "sample_value": str(batches[0]["state"].get(var, ""))[:40]
        }
    else:
        mapping[f"state.{var}"] = {
            "ev2_b64_key": None,
            "candidates_per_batch": [len(s) for s in candidate_sets],
            "note": "no key matched across all batches (try checking type: parseInt 后再值匹配？)"
        }

print("═══ Grubhub state.* → EV2 b64 key 映射 ═══")
print(f"{'state':<20} {'EV2 b64 key':<22} 印证")
print("─" * 65)
for k, info in mapping.items():
    if info is None or info.get("ev2_b64_key") is None:
        print(f"{k:<20} (无)                  跨批不一致")
    else:
        print(f"{k:<20} {info['ev2_b64_key']:<22} 6/6 ✓  sample={info['sample_value']}")

out = HERE.parent / "state_key_map.json"
out.write_text(json.dumps(mapping, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"\n→ 写入 {out}")
