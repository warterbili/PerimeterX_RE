# Playbook: EV 字段值来源定位

> EV2 有 ~204 个字段，每个字段的值都从 SDK 里**某个函数 / 变量 / API 调用**来。
> 要写 generator 就必须知道**每个字段值的来源**。
>
> 本 playbook 教你"看到一个 EV2 字段 `XXX=` → 找到它在 SDK 哪里被赋值"。
>
> 预计时间：**30 分钟到 1 小时**（取决于多少个字段要定位）

---

## 核心心智模型

EV2 字段值的来源可以分 5 类：

```
                                                覆盖率   定位难度
┌──────────────────────────────────────┐
│ 1. 浏览器原生 API 直接读              │  ~40%   ⭐ 最易
│    (navigator.platform, screen.width...)│
├──────────────────────────────────────┤
│ 2. JS 表达式 / 字面量                 │  ~20%   ⭐⭐
│    (固定 true/false/数字)             │
├──────────────────────────────────────┤
│ 3. PX 算法函数调用                    │  ~15%   ⭐⭐⭐
│    (HMAC, ml(), Date.now(), uuidV1())  │
├──────────────────────────────────────┤
│ 4. state.* 注入（从 OB#1 来）         │   ~5%   ⭐⭐⭐⭐  
│    (parseInt(state.no) etc.)           │
├──────────────────────────────────────┤
│ 5. 跨样本 diff 反推                   │   ~20%  ⭐⭐⭐⭐ 兜底
└──────────────────────────────────────┘
```

每个字段都用其中一种方法定位。掌握 5 种方法 + 决策树 = 任何字段都能找到来源。

---

## 5 个定位方法

### 方法 A：浏览器 API 名 grep（覆盖 40% — 最易）

**适用**：值看起来是浏览器属性（`"Win32"`、`1920`、`"webkit"`、`"visible"` 等）。

**核心洞察**：混淆器**改不了** `navigator.platform` 这种 native API 名 — 改了就调不到。

```bash
SDK="main.min.js"

# 列常见浏览器 API 字面值 → 对应 EV2 字段
grep -boE 'navigator\.platform'             $SDK   # → "Win32"/"MacIntel"/...
grep -boE 'navigator\.userAgent'            $SDK   # → 完整 UA 字符串
grep -boE 'navigator\.language'             $SDK   # → "zh-CN" 等
grep -boE 'navigator\.languages'            $SDK   # → ["en-US","zh-CN"...]
grep -boE 'navigator\.vendor'               $SDK   # → "Google Inc."
grep -boE 'navigator\.connection'           $SDK   # → connection object
grep -boE 'screen\.width\|screen\['         $SDK   # → 1920/2560/...
grep -boE 'screen\.height'                  $SDK   # → 1080/...
grep -boE 'performance\.memory'             $SDK   # → memory object
grep -boE 'performance\.now\b'              $SDK   # → 浮点数
grep -boE 'document\.visibilityState'       $SDK   # → "visible"
grep -boE 'location\.protocol'              $SDK   # → "https:"
grep -boE 'location\.href'                  $SDK   # → 当前 URL
grep -boE 'new Date\(\)\.toString\b'        $SDK   # → "Tue May 19 ..."
grep -boE 'getTimezoneOffset'               $SDK   # → 时区数字
```

**用法**：在抓包里看到字段 `d['XXX=']` 值是 `"Win32"`，立即知道**它来自 `navigator.platform`**。

### 方法 B：明文 b64 key grep（覆盖 30%）

**适用**：当 SDK 不用 hQ 字典间接引用，而是直接在源码里写明文。

```bash
# 假设你有 EV2 里的 b64 key "RTEwewNQMUg="
grep -boE '"RTEwewNQMUg="' sdk.js
# → 命中字节位置 + 周围代码
```

命中后看上下文：

```js
"RTEwewNQMUg=": parseInt(t.no),   // ← state.no parseInt 后赋值
// 或
"RTEwewNQMUg=": Date.now(),       // ← Date.now 赋值
```

**注意**：grep b64 key 时加上**引号 + 等号**，否则会被 base64 里的 `+/` 误匹配。

### 方法 C：hQ 字典反查（覆盖 ~50%，跟方法 B 互补）

**适用**：SDK 通过 `hQ(N)` 间接引用 b64 key。

```bash
# 1. 先提 hQ 字典
node skill/AI_re/scripts/extract_hQ.js sdk.js > hQ_map.json

# 2. 反查 b64 key → N
node -e "
const map = require('./hQ_map.json');
const target = 'RTEwewNQMUg=';
const N = Object.entries(map).find(([k,v]) => v === target)?.[0];
console.log('hQ index:', N);
"
# → 假设输出 hQ index: 247

# 3. 在 SDK 里找 hQ(247) 调用
grep -boE 'hQ\(\s*247\s*\)' sdk.js
```

命中后看上下文是怎么用 `hQ(247)` 的（赋值给什么 / 当作 key 用）。

### 方法 D：算法魔法常量定位（覆盖 PC/HMAC/hash 字段）

**适用**：值看起来是哈希 (32 hex 是 MD5、64 hex 是 SHA-256)、UUID、时间戳。

```bash
# 看到 EV2 字段值是 32 hex 字符 → HMAC-MD5
# 找 SDK 里 HMAC 调用周围的代码块
grep -B2 -A5 "909522486" sdk.js   # HMAC ipad 附近

# 看到 13 位 ms 时间戳 → Date.now() 或 state.no
grep -nE 'Date\.now\(\)' sdk.js

# 看到 UUID → uuidV1() 或 state.{pxsid,vid,cts}
grep -nE 'uuid|122192928e5' sdk.js
```

### 方法 E：跨样本 diff 反推（兜底，覆盖剩余）

**适用**：上面 4 种都没命中，或想从值的模式直接判断语义。

```bash
# 跑 6 批 diff 看每个 DYNAMIC 字段的值模式
python skill/AI_re/scripts/identify_dynamic_semantics.py \
    field_classes.json \
    --samples samples/<site>
# → 输出 each DYNAMIC field 的推断语义（timestamp/UUID/HMAC/...)
```

按值模式归类：

| 6 批样本值的模式 | 推断 |
|---|---|
| 全一致 | STATIC，照抄 batch 1 |
| 6 批都不同，13 位数字 | `Date.now()` |
| 6 批都不同，UUID 格式 | `uuidV1()` 或 `state.{pxsid,vid,cts}` |
| 6 批都不同，32 hex | HMAC-MD5 (input 看上下文) |
| 6 批都不同，64 hex | SHA-256 / state.qa |
| 6 批都不同，长 base64 | `/ns sm` |
| 6 批都不同，大整数 1e7-1e9 | `performance.memory.usedJSHeapSize` |
| 6 批都不同，浮点 0-10000 | `performance.now()` |
| 6 批都不同，object | 嵌套（如 `navigator.connection`） |
| 部分批次有 | CONDITIONAL（warm visit 字段） |

---

## 标准定位流程（每个未知字段）

```
我看到 EV2 里有字段 d['XXX=']，值是 V
  │
  ├─ V 是不是 "Win32"/"webkit"/数字 1920 等浏览器属性？
  │   → 方法 A: grep navigator.platform 或对应 API
  │
  ├─ 直接 grep "XXX=" 在 SDK 里？
  │   → 方法 B: 看上下文怎么赋的值
  │   → 命中赋值表达式 = 找到来源 ✓
  │
  ├─ B 没命中？反查 hQ 字典看是不是间接引用
  │   → 方法 C: 找 hQ(N) 对应的 N，再 grep hQ(N) 调用
  │
  ├─ 看 V 的模式（hash/UUID/ts/memory）
  │   → 方法 D: 用魔法常量定位附近代码
  │
  └─ 都不行？最后 fallback
        → 方法 E: 跨 6 批 diff，按值模式归类
        → 没法 grep 但可以推断 (timestamp/HMAC/...)
```

---

## 案例研究：iFood EV2 关键 DYNAMIC 字段定位

实战追溯每个字段的来源（跨方法 A-E）：

### 1. `RTEwewNQMUg=` → `parseInt(state.no)` ⭐⭐⭐

```bash
# 方法 B
grep -boE '"RTEwewNQMUg="' main.min.js
# → 7675:"RTEwewNQMUg="] % 10 + 1); t["egoPQD9rD3I="]...
```

看上下文：

```js
// 上面那行实际是 anti-tamper 的位置，
// 真正赋值在另一处:
"RTEwewNQMUg=": parseInt(t.no),   // ← state.no 强制转 number
```

### 2. `VQEgCxNnKjw=` → `Date.now()`

```bash
grep -boE '"VQEgCxNnKjw="' main.min.js
# → 10093: i.d["VQEgCxNnKjw="] = qj()
```

上下文 `qj()` 是 PX 的 initTime getter，内部就是 `Date.now()`。

### 3. `M2MGKXUOBB8=` → `HMAC-MD5(uuid, UA)`

值看起来是 32 hex（如 `5ce8e2d80f4d74636045c6b38ef4aee0`）→ 方法 D：

```bash
grep -boE '"M2MGKXUOBB8="' main.min.js
# 命中后看上下文:
# d["M2MGKXUOBB8="] = iR(oB(), t)
# iR = HMAC, oB() = uuid, t = UA
```

### 4. `Czt+cU1WeEM=` → `new Date().toString()`

值是 `"Tue May 19 2026 ..."` 这种格式 → 方法 A：

```bash
grep -boE 'new Date\(\)\.toString\b\|hS\.toString' main.min.js
# 命中后看赋值给哪个字段
```

### 5. `NABBSnJgQXE=` → `performance.memory.usedJSHeapSize`

值是 8 位整数（如 `106414918`）→ 方法 A：

```bash
grep -nE 'usedJSHeapSize\|performance\.memory' main.min.js
# 命中后看附近的字段赋值
```

### 6. `BzdyfUJXdks=` → /ns sm response

值是 ~30 字节 base64（如 `3rxcTzITchdNlbgaO9_MUu8IqNIMSoBu...`）→ 方法 D + E：

```bash
# 方法 D: /ns URL
grep -nE 'tzm.px-cloud.net' main.min.js

# 看附近的字段赋值
grep -B5 -A5 'tzm.px-cloud.net' main.min.js | grep -oE '"[A-Za-z0-9+/]{8,}=="'
```

---

## 工具：一键定位所有 EV2 字段

写一个脚本对 EV2 模板里每个字段跑完整定位流程：

```bash
# field_locator.sh
#!/bin/bash
EV2_TEMPLATE="$1"   # decoded EV2 JSON
SDK="$2"
HQ_MAP="${3:-hQ_map.json}"

# 提取所有 b64 keys
keys=$(jq -r '.[0].d | keys[]' "$EV2_TEMPLATE")

for key in $keys; do
    # 方法 B: 明文 grep
    plain_pos=$(grep -boE "\"$key\"" "$SDK" | head -1)
    if [ -n "$plain_pos" ]; then
        ctx=$(grep -oE "\"$key\".\{0,80\}" "$SDK" | head -1 | cut -c1-100)
        echo "$key: plain@$plain_pos | $ctx"
        continue
    fi

    # 方法 C: hQ 反查
    N=$(jq -r --arg t "$key" 'to_entries[] | select(.value == $t) | .key' "$HQ_MAP" | head -1)
    if [ -n "$N" ]; then
        hq_pos=$(grep -boE "hQ\\(\\s*$N\\s*\\)" "$SDK" | head -1)
        echo "$key: via_hQ($N)@$hq_pos"
        continue
    fi

    # 方法 E: 标记为需 diff 反推
    echo "$key: NOT_FOUND (try cross-sample diff)"
done
```

跑一遍把所有字段分 3 类：

- `plain`: 直接 grep 命中（最易处理）
- `via_hQ(N)`: 通过字典间接（中等）
- `NOT_FOUND`: 需要跨样本 diff（少数难处理）

---

## 字段类型 → 来源类型决策表

| 字段值类型 | 优先方法 | 次选方法 |
|---|---|---|
| `"Win32"/"webkit"` 等字符串 | A (navigator API) | B (明文 grep) |
| `1920/1080` 等屏幕数字 | A (screen API) | B |
| `true/false` 固定 boolean | B (明文 grep) | E (diff) |
| 13 位 ms 时间戳 | A (Date.now) 或 D (state.no) | E |
| UUID (36 chars) | A (uuidV1) 或 D (state.pxsid) | E |
| 32 hex (HMAC) | D (909522486 周围) | B + E |
| 64 hex (SHA) | D (state.qa) | E |
| 长 base64 (40+ chars) | A (/ns sm) | E |
| 大整数 1e7-1e9 (memory) | A (performance.memory) | D |
| 浮点 0-10000 (perf.now) | A (performance.now) | D |
| nested object | A 或 B | E |
| 不规则字符串 | E (diff 反推) | - |

---

## 字段总览案例：iFood EV2 209 字段分类

```
浏览器 API 直接读        ~80 字段 (38%)
  navigator.* (~30)
  screen.* (~10)
  document.* (~10)
  performance.memory (~5)
  location.* (~3)
  window.* (~5)
  其它 (~17)

固定字面量 (boolean/数字)  ~45 字段 (21%)
  webdriver 探测 (true/false)
  各种安全 flag

PX 算法函数               ~30 字段 (14%)
  initTime, sendTime (Date.now)
  uuid (uuidV1)
  Date.toString
  HMAC × 3 (uuid/vid/pxsid + UA)
  performance.now
  memory.used + total
  /ns sm + duration
  错误栈
  其它 dynamic counters

state.* 注入              ~9 字段 (4%)
  state.no, state.to, state.qa, state.vid,
  state.pxsid, state.appId, state.cts, state.jf, state.o111val

anti-tamper                1 对 (key + value)

跨样本 diff 反推            ~30 字段 (14%)
  各种 hash / counter / 探测结果
  需要 6 批样本对比反推语义
```

---

## 配套资源

| 想看什么 | 去哪 |
|---|---|
| 字段三分类（STATIC/DYNAMIC/CONDITIONAL）原理 | [`../references/field-categories.md`](../references/field-categories.md) |
| 关键函数定位（hQ/mh/Dd 等） | [`locate-functions.md`](locate-functions.md) |
| 9 个加密算法逆向 | [`reverse-algorithms.md`](reverse-algorithms.md) |
| EV1/EV2 字段语义完整表 | [`../../../main/ZH/PX_SDK_逆向技术文档.md`](../../../main/ZH/PX_SDK_逆向技术文档.md) 附录 E |
| 现成的 iFood 字段映射 | [`../../../stample/ifood/px_cookie/ifood_ev2_template.json`](../../../stample/ifood/px_cookie/ifood_ev2_template.json) |
| 自动化定位脚本 | [`../scripts/lookup_keys.js`](../scripts/lookup_keys.js) + [`../scripts/probe_dynamic.js`](../scripts/probe_dynamic.js) |

---

*把方法 A-E 5 种工具组合用，新 SDK 的 200+ 字段一般能定位 ~85%，剩下 15%
用 diff 反推语义。完全定位 = 能写完整 generator。*
