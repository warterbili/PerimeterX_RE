#!/bin/bash
# decode_all.sh — 解码所有 6 批 iFood 抓包
#
# 用法:
#   ./decode_all.sh

HERE="$(cd "$(dirname "$0")" && pwd)"
for N in 1 2 3 4 5 6; do
    "$HERE/decode_one.sh" "$N"
    echo ""
done

echo "═══════════════════════════════════════════"
echo "  全部 6 批解码完成"
echo "═══════════════════════════════════════════"
