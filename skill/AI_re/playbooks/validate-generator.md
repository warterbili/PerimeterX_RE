# Playbook: 生成器验证 + 失败诊断

> 你的生成器写完了，要确认它**真的能工作** + 出问题怎么诊断。
>
> 预计时间：**10-30 分钟**（一切顺利）/ 0.5-3 小时（debug）

---

## 验证三层

```
┌────────────────────────────────────────┐
│  Layer 1: 加载 + 静态检查（无 HTTP）    │  5 秒
└──────────────────┬─────────────────────┘
                   ▼
┌────────────────────────────────────────┐
│  Layer 2: 解码闭环验证（无外网）        │  30 秒
└──────────────────┬─────────────────────┘
                   ▼
┌────────────────────────────────────────┐
│  Layer 3: 10/10 实战验证（打 PX）       │  2-3 分钟
└────────────────────────────────────────┘
```

每层失败都有专属诊断路径。先过 Layer 1，再 Layer 2，再 Layer 3。

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
| 业务 API | 拿到的 cookie 喂给业务 API → 200 OK |

**全过 = 完成**。

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
