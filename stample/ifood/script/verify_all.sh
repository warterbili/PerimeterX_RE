#!/bin/bash
# verify_all.sh — 验证所有 6 批 iFood 抓包的解码闭环
#
# 对每一批跑 verify_batch.js：
#   1. 用 decode_payload 重解 request_1/2.txt → 跟 decoded_payload_*.json 对比
#   2. 用 decode_response 重解 response_1/2.json → 跟 decoded_response_*.json 对比
#   3. 全部一致 = 解码器跟当前 SDK 通用，可以放心改 generator
#
# 用法:
#   ./verify_all.sh             # 验所有 6 批
#   ./verify_all.sh --verbose   # 详细输出每步
#
# 退出码:
#   0 — 6 批全过
#   1 — 至少 1 批失败

HERE="$(cd "$(dirname "$0")" && pwd)"
SAMPLE_DIR="$HERE/../sample"
AI_RE="$HERE/../../../skill/AI_re/scripts"
VERBOSE=""
[ "$1" = "--verbose" ] && VERBOSE="--verbose"

total=0
passed=0
failed_batches=""

for N in 1 2 3 4 5 6; do
    total=$((total + 1))
    if node "$AI_RE/verify_batch.js" "$SAMPLE_DIR/$N" $VERBOSE; then
        passed=$((passed + 1))
    else
        failed_batches="$failed_batches $N"
    fi
done

echo ""
echo "═══════════════════════════════════════════"
echo "  iFood 解码闭环验证: $passed / $total 通过"
if [ -n "$failed_batches" ]; then
    echo "  ❌ 失败批次:$failed_batches"
    exit 1
fi
echo "  ✓ 全过 — 解码器对当前 SDK (e042d5de…) 工作正常"
echo "═══════════════════════════════════════════"
