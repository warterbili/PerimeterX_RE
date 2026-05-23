#!/usr/bin/env bash
# stample/live_validation/run_validation.sh
#
# 一键跑完整 validation 链路（算法层 + 解码闭环 + 业务 API 端到端）
# 对应 package.json 里的 `npm run validate`。
#
# Layer 1: 算法 smoke_test     (iFood 21/21 + Grub 17/17)
# Layer 2: 解码闭环 verify_all (iFood 6/6 + Grub 6/6 批样本)
# Layer 3: 业务 API demo      (iFood GraphQL 200 + Grub /auth 200; full chain 可选)
#
# 用法:
#   bash stample/live_validation/run_validation.sh           # 跑 layer 1 + 2（无需代理）
#   bash stample/live_validation/run_validation.sh --live    # 加跑 layer 3（需要 HTTPS_PROXY env）
#
# 退出码:
#   0 = 全过
#   1 = 算法层挂 (smoke_test)
#   2 = 解码闭环挂 (verify_all)
#   3 = 业务 API 挂 (--live 模式)

set -e

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

GREEN='\033[32m'
RED='\033[31m'
RESET='\033[0m'

ok()   { echo -e "${GREEN}✓${RESET} $1"; }
fail() { echo -e "${RED}✗${RESET} $1"; exit "$2"; }

echo "═══════════════════════════════════════════════════════════════"
echo " Layer 1 — 算法 smoke_test"
echo "═══════════════════════════════════════════════════════════════"
node stample/ifood/px_cookie/smoke_test.js > /tmp/ifood_smoke.log 2>&1 \
    && ok "iFood smoke_test 21/21" \
    || { cat /tmp/ifood_smoke.log; fail "iFood smoke_test 失败" 1; }
node stample/grub/px_cookie/smoke_test.js > /tmp/grub_smoke.log 2>&1 \
    && ok "Grub  smoke_test 17/17" \
    || { cat /tmp/grub_smoke.log; fail "Grub smoke_test 失败" 1; }

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo " Layer 2 — 解码闭环 verify_all (6 批样本对照)"
echo "═══════════════════════════════════════════════════════════════"
bash stample/ifood/script/verify_all.sh > /tmp/ifood_verify.log 2>&1 \
    && ok "iFood verify_all 6/6" \
    || { cat /tmp/ifood_verify.log; fail "iFood verify_all 失败" 2; }
bash stample/grub/script/verify_all.sh > /tmp/grub_verify.log 2>&1 \
    && ok "Grub  verify_all 6/6" \
    || { cat /tmp/grub_verify.log; fail "Grub verify_all 失败" 2; }

if [ "$1" != "--live" ]; then
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo " 跳过 Layer 3 (业务 API 实战)"
    echo "═══════════════════════════════════════════════════════════════"
    echo " 要跑 Layer 3：bash $0 --live"
    echo " 需要 export HTTPS_PROXY=... (iFood 用 BR，Grub 用 US 住宅代理)"
    echo ""
    ok "全部验证通过（Layer 1 + 2）"
    exit 0
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo " Layer 3 — 业务 API 端到端实战 (--live)"
echo "═══════════════════════════════════════════════════════════════"
if [ -z "${HTTPS_PROXY:-}" ] && [ -z "${https_proxy:-}" ]; then
    echo "⚠️  HTTPS_PROXY 未设；demo 默认占位符会直接退出"
fi
node stample/ifood/px_cookie/business_api_demo.js \
    && ok "iFood business_api_demo 200" \
    || fail "iFood demo 失败" 3
node stample/grub/px_cookie/business_api_demo.js \
    && ok "Grub  business_api_demo 200" \
    || fail "Grub demo 失败" 3

echo ""
ok "全部验证通过（Layer 1 + 2 + 3）"
