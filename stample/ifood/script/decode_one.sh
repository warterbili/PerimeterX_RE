#!/bin/bash
# decode_one.sh — iFood 单批解码器
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
TAG="U0MmDhUmOnhXSw=="   # iFood 固定 TAG

[ -d "$SAMPLE_DIR" ] || { echo "目录不存在: $SAMPLE_DIR"; exit 1; }

echo "[iFood batch $N] 解码 payload + response..."

# 解 EV1 + EV2 payload
node "$AI_RE/decode_payload.js" "$SAMPLE_DIR/request_1.txt" \
    > "$SAMPLE_DIR/decoded_payload_1.json"
node "$AI_RE/decode_payload.js" "$SAMPLE_DIR/request_2.txt" \
    > "$SAMPLE_DIR/decoded_payload_2.json"

# 解 OB 响应
node "$AI_RE/decode_response.js" "$TAG" "$SAMPLE_DIR/response_1.json" \
    > "$SAMPLE_DIR/decoded_response_1.json"
node "$AI_RE/decode_response.js" "$TAG" "$SAMPLE_DIR/response_2.json" \
    > "$SAMPLE_DIR/decoded_response_2.json"

echo "[iFood batch $N] ✓ 解码完成"
echo "  $SAMPLE_DIR/decoded_payload_1.json   ($(wc -c < "$SAMPLE_DIR/decoded_payload_1.json") bytes)"
echo "  $SAMPLE_DIR/decoded_payload_2.json   ($(wc -c < "$SAMPLE_DIR/decoded_payload_2.json") bytes)"
echo "  $SAMPLE_DIR/decoded_response_1.json  ($(wc -c < "$SAMPLE_DIR/decoded_response_1.json") bytes)"
echo "  $SAMPLE_DIR/decoded_response_2.json  ($(wc -c < "$SAMPLE_DIR/decoded_response_2.json") bytes)"
