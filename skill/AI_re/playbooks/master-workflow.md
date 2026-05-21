# Master Playbook: 全流程端到端（CDP 抓包 → 生成器 → 测试）

> 你拿到一个**全新 PX 保护站点**（或现有站点 SDK 更新了），**从零到拿
> cookie 跑通 10/10** 的完整流程。
>
> 本 playbook 是其它 7 份 playbook 的**串联指南**，按时序把它们组装起来。
>
> 预计总耗时：**6-12 小时**（顺利时 6h，遇坑 12h）

---

## 全流程图

```
                    用户提供：目标站点 URL
                           ↓
┌──────────────────────────────────────────────────┐
│ Stage 0: 用 cdp skill 启 Chrome + 抓初步流量      │ 15 min
│   skill/cdp/scripts/cdp.py                        │
└──────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────┐
│ Stage 1: 下 SDK + 识别版本                        │ 10 min
│   playbooks/identify-sdk-version.md               │
│   playbooks/extract-constants.md  (运行时提常量)   │
└──────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────┐
│ Stage 2: 固定 SDK 版本                            │ 5 min
│   sha256sum → 锁版本                              │
│   skill/cdp/scripts/fetch_sdk.py                  │
└──────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────┐
│ Stage 3: 抓 6 批 cold-visit 样本                  │ 15-30 min
│   skill/cdp/scripts/capture_via_cdp_<site>.py     │
│   每批必须用相同的 SDK SHA                         │
└──────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────┐
│ Stage 4: 从 SDK 源码补齐常量定位                  │ 10 min
│   playbooks/locate-all-constants.md  (5 常量)      │
│   playbooks/locate-functions.md  (9 类函数)        │
└──────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────┐
│ Stage 5: 解码器 — 复用 reverse/ 9 模块             │ 30 min
│   skill/AI_re/scripts/decode_{payload,response}   │
│   skill/AI_re/scripts/verify_batch.js 跑闭环       │
│   如解码器失败 → playbooks/reverse-algorithms.md   │
└──────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────┐
│ Stage 6: 字段三分类 + state.* 注入位置匹配         │ 1 h
│   scripts/diff_samples.js  →  STATIC/DYNAMIC/COND │
│   scripts/find_state_keys_in_ev2.py  ⭐ 关键      │
│   playbooks/locate-field-sources.md  (字段值来源)  │
└──────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────┐
│ Stage 7: 写 generator                              │ 1-3 h
│   playbooks/build-generator.md                    │
│   抄 stample/ifood/px_cookie/ifood_px3.js 改常量    │
│   模板：抓的 batch 1 当 STATIC，DYNAMIC 算法生成    │
└──────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────┐
│ Stage 8: 验证 + 10/10 测试                         │ 30 min
│   playbooks/validate-generator.md (3 层验证)       │
│   1. smoke test (require + 常量同步)               │
│   2. verify_batch (解码闭环)                       │
│   3. 实战 10 次（间隔 ≥ 10s 避免 throttle）         │
└──────────────────────────────────────────────────┘
                           ↓
                       ✅ 完成
```

---

## Stage 0：用 cdp skill 启 Chrome 抓初步流量（15 min）

**目的**：看目标站点是不是 PX 保护、抓 1 次 collector POST 当样本。

```bash
# 1. 启 CDP Chrome（真浏览器，无 webdriver 痕迹）
python skill/cdp/scripts/cdp.py start

# 2. 导航
python skill/cdp/scripts/cdp.py navigate "https://www.<目标站点>.com"

# 3. 抓 20 秒所有网络流量
python skill/cdp/scripts/cdp.py network 20 | grep -iE 'px|sensor\.|collector' > raw_traffic.txt
cat raw_traffic.txt | head -20
```

**判断这站是不是 PX**：

```bash
# 看 raw_traffic.txt 里有没有这些 URL 模式
grep -E "px-cloud\.net|/api/v2/collector|/xhr/api/v2/collector|sensor\.[a-z]+\.com" raw_traffic.txt
```

- ✅ 有命中 → PX 保护，继续
- ❌ 无命中 → 不是 PX，本 playbook 不适用

### 失败兜底

| 现象 | 修 |
|---|---|
| Chrome 启不起来 | 看 cdp 端口被占（9222/9223）— `pkill chrome` 重启 |
| `cdp.py navigate` 直接 403 | TLS 指纹被 CDN 识破 → 检查 Chrome 不是 headless 模式 |
| 看不到 px-cloud 请求但页面加载正常 | 等更久（PX SDK 可能延迟加载），或 PX 用了第一方部署（搜 `sensor.<host>.com`） |

---

## Stage 1：下 SDK + 识别版本（10 min）

参考 [`identify-sdk-version.md`](identify-sdk-version.md) 完整流程。

```bash
# 1. 从 Stage 0 的 raw_traffic 提 SDK URL
SDK_URL=$(grep -oE 'https?://[^"]*\.(min\.)?js[^"]*' raw_traffic.txt | head -1)
echo "SDK URL: $SDK_URL"

# 2. 下 SDK
curl -sS "$SDK_URL" > sdk.js
sha256sum sdk.js
# → 锁定该版本的 SHA

# 3. 跑 5 点探测确认是 PX
for c in 1732584193 909522486 122192928e5 2147483647 F@bt; do
    echo "$c: $(grep -c "$c" sdk.js)"
done
# 5/5 命中 = 标准 PX SDK
```

同时从 Stage 0 的抓包 POST body 里提 5 个常量（参考 [`extract-constants.md`](extract-constants.md)）：

```bash
# 假设 raw_traffic.txt 里有完整 collector POST body
APP_ID=$(grep -oE 'appId=[^&]+' raw_traffic.txt | head -1 | cut -d= -f2)
TAG=$(grep -oE 'tag=[^&]+' raw_traffic.txt | head -1 | cut -d= -f2 \
    | python -c 'import sys,urllib.parse;print(urllib.parse.unquote(sys.stdin.read()))')
FT=$(grep -oE 'ft=[^&]+' raw_traffic.txt | head -1 | cut -d= -f2)
echo "APP_ID=$APP_ID TAG=$TAG FT=$FT"
```

---

## Stage 2：固定 SDK 版本（5 min）

**目的**：保证下面 6 批抓包**都用同一个 SDK** — 不固定的话每批 hQ 字典内容不一样，diff 出来全是噪音。

```bash
# 把 SDK 存到项目里
SITE="<site>"   # 替换成站点名（如 ifood）
mkdir -p "stample/$SITE/source"
cp sdk.js "stample/$SITE/source/main.min.js"

# 算 SHA + 写 SDK_INFO.md（参考 stample/ifood/source/SDK_INFO.md 格式）
SHA=$(sha256sum "stample/$SITE/source/main.min.js" | cut -d' ' -f1)

cat > "stample/$SITE/source/SDK_INFO.md" <<EOF
# $SITE — Locked SDK Snapshot

| Property | Value |
|---|---|
| File | \`main.min.js\` |
| **SHA-256** | \`$SHA\` |
| Size | $(wc -c < stample/$SITE/source/main.min.js) bytes |
| Source URL | $SDK_URL |
| Captured | $(date -u +%Y-%m-%dT%H:%M:%SZ) |

## Constants
| Constant | Value |
|---|---|
| AppID | \`$APP_ID\` |
| TAG | \`$TAG\` |
| FT | \`$FT\` |
| Cookie | \`_px2 or _px3\` |
EOF
```

### Chrome Local Overrides（推荐）

DevTools → Sources → Overrides → 指向 `stample/$SITE/source/`。Chrome 之后
所有对 `client.px-cloud.net/.../main.min.js` 的请求都返回**本地这个文件**。
**6 批抓包绝对锁定同 SDK**。

---

## Stage 3：抓 6 批 cold-visit 样本（15-30 min）

```bash
# 复用 skill/cdp/ 里的 capture 脚本（或仿写新平台版本）
cp skill/cdp/scripts/capture_via_cdp_ifood.py \
   skill/cdp/scripts/capture_via_cdp_<site>.py
# 改改里面的 URL / cookie 名 / 输出路径

# 抓 6 批
for i in 1 2 3 4 5 6; do
    python skill/cdp/scripts/capture_via_cdp_<site>.py $i
    sleep 15   # 避免 IP throttle
done
```

每批输出到 `stample/<site>/sample/N/`：

```
stample/<site>/sample/1/
├── request_1.txt   POST #1
├── request_2.txt   POST #2
├── request_3.txt   POST #3
├── response_1.json
├── response_2.json
├── response_3.json
└── meta.json   (含 sdk_sha256)
```

### 6 批 SDK 一致性校验

```bash
for i in 1 2 3 4 5 6; do
    jq -r '.sdk_sha256' stample/<site>/sample/$i/meta.json
done | sort -u
# 必须只出一行，否则 Stage 2 的固定 SDK 没生效
```

---

## Stage 4：从 SDK 源码补齐常量定位（10 min）

参考 [`locate-all-constants.md`](locate-all-constants.md)（5 常量）+ [`locate-functions.md`](locate-functions.md)（9 类函数）。

```bash
# 跑全函数探测脚本（在 locate-functions.md 里有完整 bash）
bash <<'EOF'
SDK="stample/<site>/source/main.min.js"
echo "[main.min.js 函数布局探测]"
echo "  base91 字母表 F@bt:    $(grep -c F@bt $SDK)"
echo "  /ns 探针:               $(grep -c tzm.px-cloud.net $SDK)"
echo "  OB 集中调度:            $(grep -cE 'split\("\|"\)[^;]{0,40}shift' $SDK)"
echo "  事件构造 (payload=):    $(grep -cE '\"payload=\"' $SDK)"
echo "  cookie 读写:            $(grep -c 'document.cookie' $SDK)"
EOF
```

---

## Stage 5：解码器 — 直接复用 AI_re/reverse 模块（30 min）

**核心策略**：PX 算法 3 年未变，**直接复用 `revers/` 里的 9 个模块**。

```bash
# 1. 解 6 批所有 payload + response
for i in 1 2 3 4 5 6; do
    node skill/AI_re/scripts/decode_payload.js  stample/<site>/sample/$i/request_1.txt \
        > stample/<site>/sample/$i/decoded_payload_1.json
    node skill/AI_re/scripts/decode_payload.js  stample/<site>/sample/$i/request_2.txt \
        > stample/<site>/sample/$i/decoded_payload_2.json
    node skill/AI_re/scripts/decode_response.js "$TAG" stample/<site>/sample/$i/response_1.json \
        > stample/<site>/sample/$i/decoded_response_1.json
    node skill/AI_re/scripts/decode_response.js "$TAG" stample/<site>/sample/$i/response_2.json \
        > stample/<site>/sample/$i/decoded_response_2.json
done

# 2. 跑闭环验证（确保解码器对当前 SDK 通用）
for i in 1 2 3 4 5 6; do
    node skill/AI_re/scripts/verify_batch.js stample/<site>/sample/$i
done
# 全 PASS → 解码器 100% 通用，进 Stage 6
```

### 解码失败 → 算法层有问题，走 reverse-algorithms.md

如果 `decode_payload` 或 `decode_response` 失败：

| 解码失败位置 | 看哪条 |
|---|---|
| payload base64 → XOR 阶段出乱码 | [`reverse-algorithms.md`](reverse-algorithms.md) §1-2-3 (MD5/HMAC/XOR) |
| OB 段解码出乱码 | [`reverse-algorithms.md`](reverse-algorithms.md) §6 (ml() / OB XOR key) |
| 字段名不对 | [`reverse-algorithms.md`](reverse-algorithms.md) §5 (base91 hQ 字典) |

**罕见情况**：PX 改了算法（3 年未见过）— 完全要重新 reverse algorithms。

---

## Stage 6：字段三分类 + state.* 匹配（1 h）

```bash
# 6.1 三分类（STATIC/DYNAMIC/CONDITIONAL）
node skill/AI_re/scripts/diff_samples.js \
    stample/<site>/sample/{1..6}/decoded_payload_2.json \
    --out stample/<site>/field_classes.json

# 6.2 ⭐ state.* → EV2 b64 key 映射（最关键）
python skill/AI_re/scripts/find_state_keys_in_ev2.py \
    --samples stample/<site>/sample \
    --batches 1 2 3 4 5 6 \
    > stample/<site>/state_key_map.json

# 6.3 DYNAMIC 字段语义分类
python skill/AI_re/scripts/identify_dynamic_semantics.py \
    stample/<site>/field_classes.json \
    --samples stample/<site>/sample \
    > stample/<site>/dynamic_semantic_map.json
```

如果某字段语义自动识别不出来 → 用 [`locate-field-sources.md`](locate-field-sources.md) 的 5 种方法手动定位。

---

## Stage 7：写 generator（1-3 h）

```bash
# 从 iFood 现成 generator 拷一份当起点
cp -r stample/ifood/px_cookie stample/<site>/px_cookie

cd stample/<site>/px_cookie
mv ifood_px3.js <site>_pxN.js
```

在新 generator 里改 5 处：

1. 常量（APP_ID/TAG/FT/COLLECTOR_URL/BI）
2. 模板（用 batch 1 当 STATIC 模板）
3. state.* → EV2 b64 key 映射（用 Stage 6.2 的输出）
4. DYNAMIC 字段名（用 Stage 6.3 的输出）
5. 入口 collector URL

参考 [`build-generator.md`](build-generator.md) 的 Stage 5-6 详细 step-by-step。

**关键提醒**（从 19 条 gotchas 里精选必读）：

```js
// ❌ 错（永远 403）
d['<state.no key>'] = ctx.state.no;             // string

// ✅ 对
d['<state.no key>'] = parseInt(ctx.state.no);   // number ⭐⭐⭐
```

完整 19 条 → [`../references/gotchas.md`](../references/gotchas.md)。

---

## Stage 8：验证 + 10/10 测试（30 min）

参考 [`validate-generator.md`](validate-generator.md)。

```bash
# Layer 1: smoke test（require + 常量同步）
node stample/<site>/px_cookie/smoke_test.js

# Layer 2: 解码闭环
bash stample/<site>/script/verify_all.sh

# Layer 3: 实战 10 次
PASS=0; FAIL=0
for i in 1 2 3 4 5 6 7 8 9 10; do
    out=$(timeout 30s node stample/<site>/px_cookie/<site>_pxN.js 2>&1)
    if echo "$out" | grep -q '"cookie_name":"_px[23]"'; then
        PASS=$((PASS+1))
    else
        FAIL=$((FAIL+1))
        echo "run $i: $(echo $out | head -c 100)"
    fi
    sleep 12   # 避免 IP throttle
done
echo "Result: $PASS/$FAIL passed/failed"
```

**通过标准**：Layer 1+2 全过，Layer 3 ≥ 9/10。

---

## 🚨 失败兜底：纯静态 SDK 逆向（按经验独立逆向）

如果上面流程中**抓包失败、解码不工作、字段定位不出来**，回到**纯静态 SDK 分析**：

### 失败场景 1：抓不到 collector POST（Stage 0 / 3 失败）

可能原因 + 修：

```
TLS 指纹被前置层拦
  → 用真 Chrome（不 headless）+ CDP，不要用脚本直发
  → 或目标站点用 Cloudflare 前置层 — 需要先解 Cloudflare

PX 用了奇怪的端点
  → 在 SDK 里搜 fetch / XMLHttpRequest 调用
  → grep -nE 'fetch\(|new XMLHttpRequest' main.min.js
  → 看实际 POST 的 URL 是不是标准 collector

完全没 PX SDK 加载
  → 目标站点不用 PX（看其它指纹：Akamai/Cloudflare/DataDome）
```

### 失败场景 2：解码器对新 SDK 不工作

5 个魔法常量探测看是不是 PX：

```bash
for c in 1732584193 909522486 122192928e5 2147483647 F@bt; do
    echo "$c: $(grep -c "$c" main.min.js)"
done
```

- 5/5 → 是 PX，算法层应该通用 → 看 OB XOR key（可能 ml() 输入不是 TAG）
- < 5 命中 → PX 大改版（极罕见）→ 走完整 [`reverse-algorithms.md`](reverse-algorithms.md)

### 失败场景 3：字段值定位不出来

按 [`locate-field-sources.md`](locate-field-sources.md) 5 种方法逐个试：

```
方法 A: 浏览器 API 名 grep（覆盖 40%）
方法 B: 明文 b64 key grep（覆盖 30%）
方法 C: hQ 字典反查（覆盖 50%）
方法 D: 算法魔法常量定位（HMAC/UUID/...）
方法 E: 跨样本 diff 反推（兜底）
```

5 种全失败的话，**人工读 SDK** — 找到 `Dd()` 主入口（连续短名函数调用），
顺着调用链一个个看。

### 失败场景 4：纯算 generator 拿不到 cookie

跑 [`validate-generator.md`](validate-generator.md) 的失败诊断决策树。
关键检查：

```
collector#1 → 200, ob 解出 state.* ?
   ↓ Yes
collector#2 → 200, ob 含 set_cookie 段 ?
   ↓ No (do:null)
   ⭐ 99% 是 state.no parseInt 漏了（gotchas #1）
```

---

## 整套 skill 协作图

```
任务: 给一个新 PX 站点逆出 _px3 cookie
     │
     ▼
┌──────────────────────────┐
│  skill/cdp/   ←─── 抓包 + SDK 下载                       │
│   ├─ cdp.py                                              │
│   ├─ capture_via_cdp_<site>.py                            │
│   └─ fetch_sdk.py                                        │
└───────────────┬──────────────────────────────────────────┘
                │ 输出 6 批样本 + SDK 文件
                ▼
┌──────────────────────────────────────────────────────────┐
│  skill/AI_re/   ←─── 解码 + 分析 + 生成器                  │
│   ├─ references/    (5 份知识: 算法/handler/字段/坑)      │
│   ├─ playbooks/     (8 份操作: 提常量/逆算法/...)         │
│   ├─ reverse/       (9 个算法模块: payload/pc/ob/...)     │
│   └─ scripts/       (14 个工具: decode/diff/verify/...)   │
└───────────────┬──────────────────────────────────────────┘
                │ 输出 generator + 模板
                ▼
┌──────────────────────────────────────────────────────────┐
│  stample/<site>/                                          │
│   ├─ source/        SDK 文件 + SHA                       │
│   ├─ sample/        6 批样本                              │
│   ├─ script/        iFood/Grubhub 专用脚本                │
│   └─ px_cookie/     端到端 generator + 模板               │
└──────────────────────────────────────────────────────────┘
                │
                ▼
            ✅ 10/10 通过
```

---

## 时长估算

| 经验 | 时长 |
|---|---|
| 第一次走完整流程 | 12-15 小时 |
| 第二个 PX 站点（套同方法） | 6-8 小时 |
| 同站点 SDK 升级重做 | 1-2 小时（常量 + 模板更新） |
| 同站点 hQ 字典轮换 | 30 分钟（生成器多半不受影响） |

---

## 配套 playbook 索引

| Playbook | 何时用 |
|---|---|
| **本文** | 端到端总览 |
| [`extract-constants.md`](extract-constants.md) | Stage 1（从抓包提常量） |
| [`identify-sdk-version.md`](identify-sdk-version.md) | Stage 1（判 SDK 版本） |
| [`locate-all-constants.md`](locate-all-constants.md) | Stage 4（SDK 源码找 5 常量） |
| [`locate-functions.md`](locate-functions.md) | Stage 4（SDK 源码找 9 类函数） |
| [`reverse-algorithms.md`](reverse-algorithms.md) | Stage 5 失败时（逆算法） |
| [`locate-field-sources.md`](locate-field-sources.md) | Stage 6（字段值来源） |
| [`build-generator.md`](build-generator.md) | Stage 7（详细 8 步） |
| [`validate-generator.md`](validate-generator.md) | Stage 8（验证 + 失败诊断） |

---

*完整端到端走一次 → 你就掌握了 PX 逆向的完整 mental model。新站点上手
时间会从 12 小时降到 6 小时再降到 1-2 小时。*
