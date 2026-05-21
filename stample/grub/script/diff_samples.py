#!/usr/bin/env python3
"""
diff_samples.py — Grubhub 6 批 EV 字段三分类

对 ../sample/{1..6}/decoded_payload_<n>.json 做跨批次 diff，
分类为：
  - STATIC：6 批同值（直接抄模板）
  - DYNAMIC：6 批不同值（要算法生成）
  - CONDITIONAL：部分批次缺失（warm visit 字段）

用法:
  python diff_samples.py 1      # 看 EV1 (POST #1 的 payload, 12 字段)
  python diff_samples.py 2      # 看 EV2 (POST #2 的 payload, ~205 字段)
  python diff_samples.py        # 默认 2 (EV2)
"""
import json, sys
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
SAMPLE_DIR = HERE.parent / "sample"
WHICH = int(sys.argv[1]) if len(sys.argv) > 1 else 2

# 读 6 批
batches = []
for n in range(1, 7):
    f = SAMPLE_DIR / str(n) / f"decoded_payload_{WHICH}.json"
    if not f.exists():
        print(f"❌ 缺文件: {f}", file=sys.stderr)
        sys.exit(1)
    data = json.loads(f.read_text(encoding="utf-8"))
    # 标准格式: [{ "t": "...", "d": {...} }]
    batches.append(data[0]["d"])

# 字段三分类
all_keys = set()
for b in batches:
    all_keys.update(b.keys())

result = {"static": {}, "dynamic": {}, "conditional": {}}

for k in sorted(all_keys):
    present_in = [i for i, b in enumerate(batches) if k in b]
    if len(present_in) < len(batches):
        result["conditional"][k] = {
            "present_in_batches": [i+1 for i in present_in],
            "sample_value": batches[present_in[0]][k]
        }
        continue
    values = [json.dumps(b[k], sort_keys=True) for b in batches]
    if len(set(values)) == 1:
        result["static"][k] = batches[0][k]
    else:
        result["dynamic"][k] = {
            "samples": [b[k] for b in batches]
        }

# 打印 summary
print(f"═══ Grubhub EV{WHICH} 字段三分类（{len(batches)} 批）═══")
print(f"STATIC      : {len(result['static']):4d} 个字段")
print(f"DYNAMIC     : {len(result['dynamic']):4d} 个字段")
print(f"CONDITIONAL : {len(result['conditional']):4d} 个字段")
print(f"总计        : {len(all_keys):4d} 个字段")
print()

# 写文件
out = HERE.parent / f"field_classes_ev{WHICH}.json"
out.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"→ 写入 {out}")

# 列前 10 个 DYNAMIC 字段（最关注的）
print(f"\n前 10 个 DYNAMIC 字段（最关注 — 这些要算法生成）：")
for k in list(result["dynamic"].keys())[:10]:
    samples = result["dynamic"][k]["samples"]
    sample_strs = [str(s)[:30] for s in samples[:2]]
    print(f"  {k}  → 样本: {sample_strs}")
