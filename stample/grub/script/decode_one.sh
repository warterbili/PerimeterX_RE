#!/bin/bash
# decode_one.sh — Grubhub 单批解码器
#
# 把 ../sample/<N>/ 里的 request_*.txt + response_*.json 全部解码，
# 写出 decoded_*.json 到同一目录。
#
# 用法:
#   ./decode_one.sh 1            # 解 batch 1
#   ./decode_one.sh 6            # 解 batch 6

set -e

N="${1:?用法: ./decode_one.sh <batch_number>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
SAMPLE_DIR="$HERE/../sample/$N"
AI_RE="$HERE/../../../skill/AI_re/scripts"
TAG="FmYgK1gdJEAP"   # Grubhub 固定 TAG

[ -d "$SAMPLE_DIR" ] || { echo "目录不存在: $SAMPLE_DIR"; exit 1; }

echo "[Grubhub batch $N] 解码 payload + response..."

# Grubhub 一次会话只有 2 个 collector POST（iFood 是 3 个）
node "$AI_RE/decode_payload.js" "$SAMPLE_DIR/request_1.txt" \
    > "$SAMPLE_DIR/decoded_payload_1.json"
node "$AI_RE/decode_payload.js" "$SAMPLE_DIR/request_2.txt" \
    > "$SAMPLE_DIR/decoded_payload_2.json"

node "$AI_RE/decode_response.js" "$TAG" "$SAMPLE_DIR/response_1.json" \
    > "$SAMPLE_DIR/decoded_response_1.json"
node "$AI_RE/decode_response.js" "$TAG" "$SAMPLE_DIR/response_2.json" \
    > "$SAMPLE_DIR/decoded_response_2.json"

echo "[Grubhub batch $N] ✓ 解码完成"
echo "  $SAMPLE_DIR/decoded_payload_1.json   ($(wc -c < "$SAMPLE_DIR/decoded_payload_1.json") bytes)"
echo "  $SAMPLE_DIR/decoded_payload_2.json   ($(wc -c < "$SAMPLE_DIR/decoded_payload_2.json") bytes)"
echo "  $SAMPLE_DIR/decoded_response_1.json  ($(wc -c < "$SAMPLE_DIR/decoded_response_1.json") bytes)"
echo "  $SAMPLE_DIR/decoded_response_2.json  ($(wc -c < "$SAMPLE_DIR/decoded_response_2.json") bytes)"
