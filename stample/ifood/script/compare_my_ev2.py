#!/usr/bin/env python3
"""
compare_my_ev2.py — 把"我生成的 iFood EV2" vs"真抓的 iFood EV2"逐字段比对

用途：debug 我写的 iFood 生成器为什么拿不到 _px3。一字段一字段告诉你
"哪个字段我写错了、哪个字段我多/少了"。

用法:
  python compare_my_ev2.py <my_ev2.json>
    my_ev2.json 是我生成器输出的 EV2 JSON，格式 [{ "t": "...", "d": {...} }]

  默认 reference = ../sample/1/decoded_payload_2.json

输出:
  - 每个字段一行: ✓ 一致 / ❌🤖 我多了 / ❌🌐 我少了 / ⚠️ 值不一样
  - 末尾 summary
"""
import json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REF = HERE.parent / "sample" / "1" / "decoded_payload_2.json"

if len(sys.argv) < 2:
    print(f"用法: python {Path(__file__).name} <my_ev2.json>")
    print(f"  reference 默认为: {REF}")
    sys.exit(1)

my_file = Path(sys.argv[1])
if not my_file.exists():
    print(f"❌ 不存在: {my_file}")
    sys.exit(1)

mine = json.loads(my_file.read_text(encoding="utf-8"))
real = json.loads(REF.read_text(encoding="utf-8"))

# 提取 .d 字典
my_d = mine[0]["d"] if isinstance(mine, list) else mine.get("d", mine)
real_d = real[0]["d"]

all_keys = sorted(set(my_d.keys()) | set(real_d.keys()))

ok = mismatched = extra = missing = 0

print(f"═══ iFood EV2 字段级对比 ═══")
print(f"  我:    {my_file}     ({len(my_d)} 字段)")
print(f"  真抓:  {REF.name}     ({len(real_d)} 字段)")
print(f"  并集:  {len(all_keys)} 字段")
print()

for k in all_keys:
    in_mine = k in my_d
    in_real = k in real_d
    if not in_mine:
        print(f"  ❌🌐 {k:<24}  missing in mine (real has it)")
        print(f"      real    = {json.dumps(real_d[k])[:80]}")
        missing += 1
    elif not in_real:
        print(f"  ❌🤖 {k:<24}  extra in mine (real doesn't have)")
        print(f"      mine    = {json.dumps(my_d[k])[:80]}")
        extra += 1
    elif json.dumps(my_d[k], sort_keys=True) != json.dumps(real_d[k], sort_keys=True):
        print(f"  ⚠️  {k:<24}  value mismatch")
        print(f"      mine    = {json.dumps(my_d[k])[:80]}")
        print(f"      real    = {json.dumps(real_d[k])[:80]}")
        mismatched += 1
    else:
        ok += 1
        # 一致的不打印；要看可改成 print(f"  ✓  {k}")

print()
print("─" * 60)
print(f"OK              : {ok:4d} 字段（值完全一致）")
print(f"⚠️  值不一样     : {mismatched:4d} 字段")
print(f"❌🤖 我多了      : {extra:4d} 字段（应删）")
print(f"❌🌐 我少了      : {missing:4d} 字段（应补）")
print(f"总计            : {len(all_keys):4d} 字段")

# 退出码：用于 CI
sys.exit(0 if (mismatched + extra + missing == 0) else 1)
