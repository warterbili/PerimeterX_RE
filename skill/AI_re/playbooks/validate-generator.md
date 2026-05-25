# Playbook: 生成器验证 + 失败诊断

> 你的生成器写完了，要确认它**真的能工作** + 出问题怎么诊断。
>
> 预计时间：**10-30 分钟**（一切顺利）/ 0.5-3 小时（debug）

---

## 验证四层（2026-05-25 更新：加 Layer 3.5）

```
┌────────────────────────────────────────────┐
│  Layer 1:   加载 + 静态检查（无 HTTP）       │  5 秒
└──────────────────┬─────────────────────────┘
                   ▼
┌────────────────────────────────────────────┐
│  Layer 2:   解码闭环验证（无外网）          │  30 秒
└──────────────────┬─────────────────────────┘
                   ▼
┌────────────────────────────────────────────┐
│  Layer 3:   10/10 collector 接受 payload  │  2-3 分钟
│             ⚠️ 通过 Layer 3 ≠ generator 真能用 │
└──────────────────┬─────────────────────────┘
                   ▼
┌────────────────────────────────────────────┐
│  Layer 3.5: 10/10 真打 PX-gated 端点 (NEW) │  3-5 分钟
│             拿 cookie 去 GET 一个会 403 空 cookie 的端点   │
│             → 拿到真实 200 + 真实 HTML/JSON                │
└────────────────────────────────────────────┘
```

每层失败都有专属诊断路径。先过 Layer 1，再 Layer 2，再 Layer 3，**再 Layer 3.5**。

⚠️ **重要变化（2026-05-25）**: 历史上 skill 默认 Layer 3 通过即等于 generator OK。totalwine 案例证明这在严档部署下是错的 ([deployment-tiers.md](../references/deployment-tiers.md), [gotchas.md #15](../references/gotchas.md))——必须加 Layer 3.5 才算真过。iFood/Grub 的 `business_api_demo.js` 实际上一直在做这一步，只是没作为正式 Layer 单独列出。

---

## Layer 1: 加载 + 静态检查（5 秒）

**目的**：确保生成器能 `require()`、模板能加载、常量没拼错。

```bash
node -e "
const gen = require('./stample/<site>/px_cookie/<site>_pxN.js');
console.log('  ✓ require 成功');
console.log('  exports type:', typeof gen);
console.log('  async function?:', gen.constructor.name === 'AsyncFunction');
"
```

**预期输出**：

```
  ✓ require 成功
  exports type: function
  async function?: true
```

更完整的 smoke test（推荐写一份）：

```bash
node stample/<site>/px_cookie/smoke_test.js
# 13/13 ✓ 通过即可（参考 ifood/px_cookie/smoke_test.js）
```

### Layer 1 失败诊断

| 错误 | 原因 | 修 |
|---|---|---|
| `Cannot find module '../reverse/payload'` | reverse 路径错 | 改成 `../../../revers/payload` |
| `Cannot find module './templates/...'` | template 路径错 | 改 path.join 或拷模板到同目录 |
| `SyntaxError` | JS 语法错 | 看错误行号修 |
| `templates/ev2_template.json: Unexpected token` | template JSON 坏了 | 重抓 6 批样本 |

---

## Layer 2: 解码闭环验证（30 秒）

**目的**：用现有 6 批 sample 验证解码器在当前 SDK 下工作。
这一步**不打 PX**，纯本地。

```bash
bash stample/<site>/script/verify_all.sh
```

或者通用版：

```bash
for i in 1 2 3 4 5 6; do
    node skill/AI_re/scripts/verify_batch.js stample/<site>/sample/$i
done
```

**预期输出**：

```
[1/6] stample/<site>/sample/1
  payload_1 decode:   PASS
  payload_1 round:    PASS
  pc_1:               PASS
  payload_2 decode:   PASS
  payload_2 round:    PASS
  pc_2:               PASS
  state mapping:      PASS
[OVERALL] 6/6 PASS
```

### Layer 2 失败诊断

按失败 stage：

| 失败 stage | 含义 | 看哪条 gotcha |
|---|---|---|
| `payload decode FAIL` | base64 / XOR 出错 | [#2 base64 UTF-8](../references/gotchas.md), [#5 + 字符](../references/gotchas.md) |
| `payload round FAIL` | 我重编码跟原 payload 不一致 | [#10 interleave 偶数长度](../references/gotchas.md) |
| `pc FAIL` | HMAC-MD5 算的 PC 跟原 PC 不等 | TAG 错？UA 跟 HTTP 不同步？|
| `state mapping FAIL` | state.* → EV2 b64 key 错 | [#11 跨平台 key 不同](../references/gotchas.md) |
| `anti-tamper FAIL` | 槽位 / 算法错 | [#3 原位置替换](../references/gotchas.md) |

⚠️ Layer 2 失败说明**生成器没建在正确的解码器之上** —— 不要急着跑 Layer 3，先把解码器修好。

---

## Layer 3: 10/10 实战验证（2-3 分钟）

**目的**：真打 PX collector，看能不能拿 cookie，10 次稳定通过。

```bash
PASS=0
FAIL=0
for i in 1 2 3 4 5 6 7 8 9 10; do
    echo "─── run $i ───"
    output=$(timeout 30s node stample/<site>/px_cookie/<site>_pxN.js 2>&1)
    if echo "$output" | grep -q '"cookie_name":"_px[23]"'; then
        cookie=$(echo "$output" | jq -r '.cookie_value' | cut -c1-30)
        echo "  ✓ got cookie: $cookie..."
        PASS=$((PASS+1))
    else
        err=$(echo "$output" | head -c 200)
        echo "  ❌ failed: $err"
        FAIL=$((FAIL+1))
    fi
    sleep 12   # 必须 ≥ 10s，否则 IP throttle
done
echo ""
echo "═══════════════════════════════"
echo "  10/10 test: $PASS passed, $FAIL failed"
echo "═══════════════════════════════"
```

**通过标准**：10/10。任何失败立即看下面诊断。

### Layer 3 失败诊断决策树

```
拿到 cookie_value？
├─ ❌ 看错误信息
│
│   ├─ "collector#1 HTTP 403/4xx"
│   │   → TLS 指纹问题。**用真 Chrome + CDP，不要用脚本直发**
│   │   → 或检查 headers (Origin, Referer)
│   │
│   ├─ "collector#1 HTTP 200 但 ob 为空"
│   │   → PC 算错。检查：
│   │     - TAG 是否对（grep 真抓 POST 的 tag=）
│   │     - UA 跟 HTTP header 是否同一个变量
│   │     - 是否用了 unquote_plus 把 + 替成空格了（gotchas #5）
│   │
│   ├─ "解码 ob#1 后没有 state.no / state.to / state.qa"
│   │   → OB XOR key 错。验证 ml(TAG) % 128 是不是正确值
│   │   → 或 OB 用 binary 不是 utf-8 decode（gotchas #7）
│   │
│   ├─ "collector#2 HTTP 200 但 do:null, ob 只 2 段，没 set_cookie"
│   │   → ⭐⭐⭐ state.no 没 parseInt（gotchas #1）
│   │   → 或 EV2 字段顺序错（gotchas #3 anti-tamper）
│   │   → 或 EV2 多了/少了字段（看 compare_my_ev2.py）
│   │
│   ├─ "collector#2 HTTP 200 有 set_cookie，但业务 API 还是 403"
│   │   → cookie 写错了？检查最终 _pxN 字符串
│   │   → 或触发 Bundle path？看 Bundle 章节
│   │
│   └─ "部分批次成功（如 5/10）"
│       → ⭐ IP throttle（最常见）。间隔加到 ≥ 15s
│       → 或 UA 一致性问题
│
└─ ✅ 全 10 个都拿到 _pxN
    → 生成器工作！下一步用 cookie 实战业务 API
```

---

## ⭐ MANDATORY Pre-Layer-3.5 step: 跑 `diff_ev_ours_vs_real.py` (2026-05-25 闭环)

> 不跑这一步就声称 Layer 3 完成是禁止的。这一步是 5 类严档陷阱的**自动化扫雷器**：
> Gotcha #12（多塞字段）、#1/#10（类型错）、#3（STATIC 值/AT 槽位）、#17（counter 同步性）。

```bash
# 1. 让 generator dump EV1/EV2/EV3 到 JSON
DUMP_EV_DIR=stample/<site>/sample/_our_ev node stample/<site>/px_cookie/<site>_pxN.js

# 2. 跑诊断 (skill 通用版 或 stample/<site>/script/ 站点版)
python skill/AI_re/scripts/diff_ev_ours_vs_real.py
```

**通过标准**：6 段全 ✅，**任何一段 🔴 都禁止进入 Layer 3.5**。

| 段 | 检查 | 红色违规对应 gotcha |
|---|---|---|
| 1 | 字段集差异（only-ours / only-real） | #12 多塞字段 / 少 key |
| 2 | 类型不一致 (string vs number etc) | #1 state.no 没 parseInt / #10 字段类型表 |
| 3 | STATIC 字段值偏差 | 模板 bake 自污染 batch / 抄错值 |
| 4 | 字段顺序（一般可忽略 — PX 自己也随机化）| #3 anti-tamper 位置漂移 |
| 5 | Anti-tamper 槽位位置 | #3 anti-tamper |
| 6 ⭐ | **Dict 子字段同步性 (EQ / EQ-or-sentinel / CONST)** | **#17 counter 同步性**（NEW 2026-05-25 闭环） |

第 6 段是 2026-05-25 闭环新加的——自动检测 `PX12738 == PX12739` 这种隐形约束。totalwine 案例验证：用独立 random 给 PX12738/PX12739 立刻被这一段 🔴 报出。

---

## Layer 3.5: 10/10 真打 PX-gated 端点（3-5 分钟）—— ⭐ 严档部署必跑

> 严档部署（如 totalwine）下，Layer 3 通过≠ generator 真的能用。必须再加一层 apples-to-apples 测试：
> 拿生成的 cookie 真去打一个 PX 会拦的端点，对比"空 cookie / 浏览器 cookie / 我们 cookie"三种结果。
>
> ⚠️ **前置条件**：Pre-Layer-3.5 的 `diff_ev_ours_vs_real.py` 必须 6 段全 ✅。任何 🔴 不该到 Layer 3.5。

**目的**: 区分以下三种情况:
1. 我们的 cookie 真能让 PX 边缘放行 → ✅ generator OK
2. 我们的 cookie 跟空 cookie 表现完全一样 → cookie 内容被 PX 后端标 trust=low
3. 浏览器 cookie 也过不了 → transport/IP/TLS 问题（不是我们 generator 的事）

**前置准备**:

```bash
# 1. 选一个 PX-gated 目标 URL（无 cookie 时会返回 PX block，不是 captcha 也不是 200）
#    探测方法：
curl_cffi -X GET 'https://<site>/<some-srp-or-pdp-path>' \
    --impersonate chrome124 \
    --proxy 'http://<US-residential-proxy>'  # 需要 US 出口
# 期望: 403 + body 含 "PXFF0j69T5" / "jsClientSrc" / "px-captcha"

# 2. 准备一个真实浏览器拿到的 cookie 作为 control
#    用 CDP 或手动从 Chrome devtools 拿
```

**测试脚本（伪代码，按 [smoke_10x_e2e](../../../tmp/totalwine/script/smoke_10x_e2e.py) 改写）**:

```python
import time
from curl_cffi import requests

URL = 'https://<site>/<PX-gated-path>'
PROXY = 'http://<US-residential>'  # 严档通常需要 country 匹配

def generate_via_proxy(proxy):
    # 调你的 Node generator，让它走该代理
    ...

def fetch(cookie, proxy):
    r = requests.get(URL, impersonate='chrome124', proxies={'https': proxy},
                     headers={'Cookie': cookie} if cookie else {},
                     verify=False, timeout=30)
    return r.status_code, len(r.text), 'PX-BLOCK' in r.text[:600]

# 10 次独立 session（不同 sticky IP）
pass_count = 0
for i in range(10):
    session_id = f'test-{i}'
    proxy = build_proxy(session_id)
    g = generate_via_proxy(proxy)
    status, length, blocked = fetch(f'_px2={g.cookie}', proxy)
    if status == 200 and length > 100_000 and not blocked:
        pass_count += 1
        print(f'iter {i+1}: ✅ PASS {length:,}B')
    else:
        print(f'iter {i+1}: ❌ status={status} blocked={blocked}')
    time.sleep(15)   # Gotcha #13

print(f'{pass_count}/10')
```

**通过标准**: **10/10**。任何 < 10 都是部署级问题，不是偶发。

### Layer 3.5 失败诊断决策树

```
你的 cookie 在 PX-gated 端点结果是？
├─ ❌ 全部 PX-BLOCK (跟空 cookie 表现一样)
│   → cookie 被 PX 后端标 trust=low
│   → 这是 Gotcha #15 的症状
│   → 排查顺序：
│       1. compare_ev2_field_by_field.py → 字段集 / STATIC 值 / 类型
│       2. 抓包看是否漏了 seq=2 POST (Gotcha #16)
│       3. recover-hmac-formulas.md → 4 个 HMAC 字段 input 全部 6 批实测
│       4. 检查 counter 子字段同步性 (Gotcha #17)
│
├─ ⚠️  混合（如 6/10 通过）
│   → IP 质量问题：BrightData residential 偶尔会有刚被烫过的 IP
│   → 间隔加到 20-30s 或换更高质量的住宅代理池
│   → 不是 generator bug
│
├─ ⚠️  全部 PX-CAPTCHA（5KB+ HTML 含 px-captcha 字符串）
│   → cookie 根本没被 PX 接受（按"无 cookie"对待）
│   → 检查 cookie 是否正确放进 Cookie header
│   → 或 URL 写错了
│
└─ ✅ 10/10 PASS
    → generator 真的过了 PX 边缘
    → 可以下一步实现 business_api_demo
```

---

## 高级诊断：用对比工具

如果上面表里找不到匹配的症状，用对比工具：

### A. 我生成的 EV2 vs 真抓 EV2（字段级）

```bash
# 跑生成器把 EV2 dump 出来
node stample/<site>/px_cookie/<site>_pxN.js --dump-ev2 > /tmp/my_ev2.json

# 跟真抓的 batch 1 EV2 对比
python stample/<site>/script/compare_my_ev2.py /tmp/my_ev2.json
```

输出示例：

```
✓ STATIC 字段 169 个一致
⚠️  RTEwewNQMUg=  value mismatch
   mine='1779263519570' (string)
   real= 1779263519570  (number)
   → gotchas #1: parseInt 漏了

❌🤖 BzdyfUJXdks=  extra in mine  (我多了 /ns 字段)
   → gotchas #11: Grubhub EV2 不该有这个字段
```

### B. 我的 POST vs 真抓 POST（字节级）

```bash
# 用 mitmproxy 或类似工具记录我的 generator 发出的 POST 到 /tmp/my_post.txt
python stample/<site>/script/diff_http.py /tmp/my_post.txt
```

输出 headers 差异 + params 顺序差异 + body 长度差。

### C. 抓真请求时的 cookie，跟我生成的 cookie 字段级对比

```bash
# 解我生成的 cookie
node -e "
const cookie = process.argv[1];
console.log(JSON.parse(Buffer.from(cookie, 'base64').toString()));
" "<我的 cookie 值>"

# 解真抓的 cookie
node -e "..." "<真抓的 cookie 值>"
```

看哪些字段不一样。

---

## 常见错误案例

### 案例 1: state.no 字符串/数字混淆

```
症状: collector#2 → do:null，OB 只 2 段
错误代码:
   d['RTEwewNQMUg='] = ctx.state.no;                  // ← string '1779...'

修复:
   d['RTEwewNQMUg='] = parseInt(ctx.state.no);        // ✅ number 1779...
```

### 案例 2: UA 不一致

```
症状: collector 偶尔 403，每次重启 generator 又不一样
错误代码:
   const UA = 'Mozilla/5.0 ...';
   d['M2MGKXUOBB8='] = hmacMD5(uuid, UA);   // 算时用 const UA
   req.headers['User-Agent'] = 'Mozilla/5.0 ...';   // ← 但 HTTP 又另写一份，多一个空格

修复:
   const UA = 'Mozilla/5.0 ...';
   d['M2MGKXUOBB8='] = hmacMD5(uuid, UA);
   req.headers['User-Agent'] = UA;   // ✅ 同一个变量
```

### 案例 3: anti-tamper 位置错

```
症状: 字段都对，collector 接受 PC，但永远不下发 cookie
错误代码:
   delete d[oldAntiTamperKey];
   d[newAntiTamperKey] = newValue;   // ← newKey 跑到字典末尾，迭代顺序变了

修复:
   const out = {};
   for (const k of Object.keys(d)) {
       out[ANTI_TAMPER_RE.test(k) ? newAntiTamperKey : k]
         = ANTI_TAMPER_RE.test(k) ? newValue : d[k];
   }
   return out;   // ✅ 重建字典保持位置
```

---

## 完成标准

| 维度 | 通过标准 |
|---|---|
| Layer 1 | require 成功，smoke test 13/13 |
| Layer 2 | verify_batch 6/6 |
| Layer 3 | 间隔 ≥ 10s 跑 10 次，10/10 拿到不同的 `_pxN` 字符串 |
| **Pre-3.5** ⭐ | **`diff_ev_ours_vs_real.py` 6 段全 ✅**（强制 — 2026-05-25 闭环要求）|
| **Layer 3.5** | **10 次独立 session 真打 PX-gated 端点全 200 + 真实内容**（严档部署必过） |
| 业务 API | 拿到的 cookie 喂给业务 API → 200 OK |

**全过 = 完成**。

⚠️ 不要把 Layer 3 当 Layer 3.5：
- "cookie 签发 10/10" 是必要条件，不是充分条件
- iFood/Grub 历史经验里两者重合，但**严档部署里两者会分开**
- README 里写 "Validated 10/10" 时务必明确是哪一层（建议固定写「Layer 3.5: end-to-end 10/10 against `<gated-endpoint>` via `<transport>` from `<IP-tier>`」）

---

## 长期稳定性

10/10 不代表"永远能用"。建议：

```bash
# 每天跑 1 次 smoke test
0 9 * * * cd /path/to/perimeter && node stample/ifood/px_cookie/smoke_test.js \
    || echo "smoke test failed" | mail -s "PX SDK drift?" admin@...

# 每周抓 1 批新样本核对 SDK SHA
0 9 * * 1 cd /path/to/perimeter && \
    python skill/cdp/scripts/capture_via_cdp_ifood.py 99 && \
    diff <(jq .sdk_sha256 stample/ifood/sample/{1,99}/meta.json | sort -u) \
         <(echo "1")
```

如果 SDK 升了 → 走 [`identify-sdk-version.md`](identify-sdk-version.md) 评估影响。

---

## 配套资源

| 想看什么 | 去哪 |
|---|---|
| 19 条踩坑详解 | [`../references/gotchas.md`](../references/gotchas.md) |
| 跨工具关系矩阵 | [`../SKILL.md`](../SKILL.md) §跨工具关系矩阵 |
| iFood 生成器（参考实现） | [`../../../stample/ifood/px_cookie/ifood_px3.js`](../../../stample/ifood/px_cookie/ifood_px3.js) |
| iFood 6 批样本（参考数据） | [`../../../stample/ifood/sample/`](../../../stample/ifood/sample/) |
| SDK 漂移应对 | [`identify-sdk-version.md`](identify-sdk-version.md) |

---

*建议把所有的 generator 都加上 `smoke_test.js` + `verify_all.sh`，
组成"加载验证 / 解码闭环 / 实战 10/10"三层自动化测试。新 SDK 出来时
跑一遍立刻知道有没有 break。*
