# Stage 4: 字段语义定位 — 7 大手段（grep 工具书）⭐

> **时间预算**：熟练 1 h，第一次 **4 h**（这是 Stage 4-7 里最大的一章）
> **产出**：把每个 DYNAMIC 字段定位到 SDK 源码哪一行赋值
> *融合*: C/§3（7 大手段）+ A/§3-9（全套 grep 模式）+ B/04_stage4_locate

---

## 章节目标

知道每个 DYNAMIC 字段**从哪个浏览器 API / 算法 / state.\* 来**。
做完这章你的 Stage 6 写代码就**纯机械**了。

## 核心原则

> **不搜 key，搜值的来源。**

PX SDK 的 base64 key 在 `main.min.js` 中**不是明文**。它们通过数组查表函数间接引用。直接 grep `RTEwewNQMUg=` 经常找不到（因为 SDK 内部用 `hQ(521)` 形式引用）。**正确做法是反过来 —— 知道值，找它从哪儿来**。

---

## 4.1 手段 1：破解查表函数 hQ（最高效，覆盖 80%）

### 4.1.1 定位查表函数

在 `main.min.js`（beautified）里搜：

```javascript
function hQ(t) {
    return void 0 === hO[t] ? hO[t] = hM(hP[t]) : hO[t]
}
```

或类似模式：`function XX(t) { return ARR[t - OFFSET] }`。

`hQ` 是查表函数，`hP` 是被编码的字符串数组，`hM` 是解码器。

跨版本 `hQ`/`hP`/`hM` 名字会变，**按模式搜**：

```bash
# 找 hQ 模式（return cache OR populate）
grep -nE 'return void 0 === [a-zA-Z]+\[t\] \?' main.min.js

# 或者找 cache 模式
grep -nE 'function [a-zA-Z]+\(t\)\s*\{\s*return [a-zA-Z]+\[t\] = [a-zA-Z]+\([a-zA-Z]+\[t\]' main.min.js
```

### 4.1.2 提取 hP 数组

`hP` 是个巨大字符串数组（通常 ~1152 项）。通过文本切片提取（用括号匹配）：

```javascript
const start = sdk.indexOf(', hP = [');   // 或者 `var hP = `
let i = sdk.indexOf('[', start), depth = 1, inStr = false, strCh = '';
i++;
const arrStart = i - 1;
while (i < sdk.length && depth > 0) {
    const c = sdk[i];
    if (inStr) {
        if (c === '\\' && i+1 < sdk.length) { i += 2; continue; }
        if (c === strCh) inStr = false;
        i++; continue;
    }
    if (c === '"' || c === "'") { inStr = true; strCh = c; i++; continue; }
    if (c === '[') depth++;
    else if (c === ']') depth--;
    i++;
}
const arrayLiteral = sdk.slice(arrStart, i);
const hP = eval(arrayLiteral);   // hP 现在是数组
console.log('hP length:', hP.length);   // 期望 ~1152
```

实战脚本见 [`../../../skill/AI_re/scripts/extract_hQ.js`](../../../skill/AI_re/scripts/extract_hQ.js)。

### 4.1.3 提取 hM 解码器

PX 用自定义 base91-like 编码：

```javascript
function hM(t) {
    var n = "" + (t || ""), e = n.length, r = [], h = 0, i = 0, o = -1, c = 0;
    for (; c < e; c++) {
        var a = 'F@bt;"m:x3&#LiZ[)TE/}%QD1Iu.6f0R]78|4{zvWC>`$Se(rJ=*c^2_?qOpB,d<AVy~YwoP!+9g5nXhUsNGjaMKHlk'.indexOf(n[c]);
        if (a !== -1) {
            if (o < 0) o = a;
            else {
                h |= (o += 91 * a) << i;
                i += (8191 & o) > 88 ? 13 : 14;
                do { r.push(255 & h); h >>= 8; i -= 8; } while (i > 7);
                o = -1;
            }
        }
    }
    if (o > -1) r.push(255 & (h | (o << i)));
    return Buffer.from(r).toString('utf-8');
}
```

⭐ **关键特征**：字母表起头是 `'F@bt'`。`grep 'F@bt' main.min.js` 一定命中。

### 4.1.4 导出完整 hQ 映射

```javascript
const map = {};
for (let n = 0; n < hP.length; n++) map[n] = hM(hP[n]);
fs.writeFileSync('hQ_map.json', JSON.stringify(map, null, 2));
```

效果：1152+ 条 `index → 字符串` 映射，包含所有 base64 key、API 名、URL 等。

### 4.1.5 反查 b64 key → SDK 位置

```bash
# 假设 hQ_map.json 已有 → 反查 RTEwewNQMUg= 对应的 index
jq 'to_entries | map(select(.value == "RTEwewNQMUg=")) | .[].key' hQ_map.json
# "212"

# 现在搜 hQ(212) 上下文
grep -n 'hQ(212)' main.min.js
# 或者搜 hQ\([^)]*212[^)]*\) 处理变量索引
```

实战脚本见 [`../../../skill/AI_re/scripts/lookup_keys.js`](../../../skill/AI_re/scripts/lookup_keys.js)。

---

## 4.2 手段 2：搜 `["base64key="]` 明文（覆盖 40-60%）

并非所有 key 都过 `hQ`。SDK 中两种写法并存：

```javascript
// 写法 A — 明文（grep 能找到）
e["fyNFZTlCSFM="] = N(Pa(), t);
ty["N2sNLXEGAx4="] = ti();

// 写法 B — 数组查表（grep 找不到，需要手段 1）
t[S(521)] = eo;
```

### 4.2.1 搜索技巧

```bash
# 加引号 + 加等号比裸 key 精确（避免 base64 里 + / 引起的误匹配）
grep -n '"cgIHSDRhAX8="' main.min.js
grep -n '\["cgIHSDRhAX8="\]' main.min.js
```

### 4.2.2 批量反查全部 DYNAMIC

```bash
# 用 probe_dynamic.js 一次性查所有 DYNAMIC 字段
node ../../../skill/AI_re/scripts/probe_dynamic.js \
    field_classes_ev2.json \
    hQ_map.json \
    ../../source/main.min.js
```

输出每个 DYNAMIC 字段的 SDK 上下文，类似：

```
RTEwewNQMUg= (plain): "RTEwewNQMUg="] % 10 + 1) ...        → state.no
M2MGKXUOBB8= (plain): "M2MGKXUOBB8="] = iR(oB(), n)) ...   → HMAC(uuid, UA)
M2EHKXUOBB4= (hQ):    hQ(521) ... NSEAa3NAC18= ... = Xa() → uuid
```

---

## 4.3 手段 3：搜浏览器 API 名（覆盖环境采集字段）

混淆工具不能改 API 名（改了就调不到原生方法）。所以**所有 navigator/screen/window/document 属性都能 grep**。

### 4.3.1 常用 API grep 模式

```bash
# 解码后值是 "Win32" → 搜 navigator.platform
grep -n 'navigator.platform' main.min.js
# → 命中行: e["dEABCjEhBjA="] = hU && hU.platform

# 值是 1920 → 搜 screen.width
grep -n 'screen.width\|screen\[' main.min.js
# → e["KV0dX284Gm4="] = screen.width

# UA
grep -n 'navigator.userAgent' main.min.js

# 浏览器特征
grep -n 'navigator.cookieEnabled\|navigator.onLine\|navigator.language' main.min.js

# 屏幕
grep -n 'window.innerWidth\|window.outerWidth\|screen.colorDepth' main.min.js

# WebGL/Canvas/Audio（混淆少）
grep -n 'WebGLRenderingContext\|HTMLCanvasElement\|AudioContext\|OfflineAudioContext' main.min.js
```

### 4.3.2 全部 navigator/screen/window 属性一次扫

```bash
grep -oE '(navigator|screen|window|document|location|history|performance)\.[a-zA-Z]+' main.min.js | sort -u
```

可能输出 50+ 种。逐个匹配到 DYNAMIC 字段。

---

## 4.4 手段 4：搜魔法数字（覆盖算法字段）

每个算法都有"标志性数字"。用它定位：

### 4.4.1 算法层魔法常量速查表

| 常量 | 算法 | 用途 |
|---|---|---|
| `1732584193` | MD5 init A | MD5 实现 |
| `909522486` | HMAC ipad (0x36363636) | HMAC |
| `1549556828` | HMAC opad (0x5C5C5C5C) | HMAC |
| `122192928e5` 或 `12219292800000` | UUID v1 | RFC 4122 Gregorian → Unix |
| `2147483647` | INT32_MAX | `ml()` 哈希函数 |
| `4294967296` | `2^32` | memory.jsHeapSizeLimit (4 GB) |
| `268435455` | `0x0FFFFFFF` | UUID v1 timeLow mask |
| `0xE0100` 或 `917760` | Plane 14 起点 | sid Unicode Tag 隐写 |
| `4210` 或 `0x1072` | XOR mask | Bundle Myanmar DOM 编码 |
| `2863` | hash factor | 某些字段的 mixing function |

### 4.4.2 PX 自定义常量

```bash
grep -nE "1732584193" main.min.js              # MD5 init
grep -nE "909522486|0x36363636" main.min.js    # HMAC ipad
grep -nE "122192928e5" main.min.js             # UUID v1
grep -nE "2147483647" main.min.js              # ml()
grep -nE "4294967296" main.min.js              # 2^32
grep -nE "0xE0100|917760" main.min.js          # sid 隐写
grep -nE "F@bt" main.min.js                    # base91 字母表
```

### 4.4.3 算法控制流模式

```bash
# djb2 hash 变体
grep -nE "<<\s*5\)\s*-\s*[a-z]" main.min.js   # (hash << 5) - hash

# ml() 函数
grep -nE "31\s*\*\s*[a-z]\s*\+.*charCodeAt" main.min.js
# 命中: n = (31 * n + t.charCodeAt(e)) % 2147483647

# anti-tamper 动态 key 计算
grep -nE "% 10 \+ 2\|% 10 \+ 1" main.min.js
# 命中 te() 计算 anti-tamper

# OB 分段
grep -nE 'split\("\|"\)\|split\("~~~~"\)' main.min.js
```

---

## 4.5 手段 5：从入口函数静态分析（理解分组）

SDK 的指纹采集主入口（一般叫 `Dd` / `mh` / `Gl` / `lp`）调用多个子函数，每个子函数填一组字段：

```javascript
function Dd(t) {
    ev(t);    // 安全检测 (~15 字段)
    nv(t);    // 特殊值
    av(t);    // 时间戳
    ov(t);    // 屏幕/显示 (~10 字段)
    iv(t);    // 语言/时区
    cv(t);    // 硬件
    $d(t);    // anti-tamper
    tv(t);    // 单值字段
}
```

### 4.5.1 定位主入口

```bash
# 找最大的"采集器"函数（多次调用其它 v* 函数）
grep -nE '^function [a-zA-Z]{2}\(.\) \{' main.min.js | head -20

# 找 collector POST 调用上方的函数
grep -nB 30 '/api/v2/collector' main.min.js | grep -E 'function [a-zA-Z]+\('
```

### 4.5.2 读子函数推理

读每个子函数（如 `ev(t)`），用导出的 hQ 映射把里面的 `hQ(499)`, `hQ(829)` 等翻译成实际 key：

```javascript
function ev(t) {
    t.d[hQ(499)] = !!navigator.webdriver;       // hQ(499) = "Azt3eUVVd0w="
    t.d[hQ(521)] = navigator.platform;           // hQ(521) = "U0snSRYiIXM="
    t.d[hQ(842)] = navigator.language;           // hQ(842) = "aR1dHy91Vi4="
    // ...
}
```

→ 整组浏览器标识字段一次性定位 14 个。

---

## 4.6 手段 6：调用栈追踪（覆盖 HMAC 等链式字段）

在 Chrome DevTools 里：

```
1. Sources → 找到 main.min.js → 右键 Pretty Print
2. Search → 搜 "btoa" 或 "fetch"，在调用 collector 的地方设断点
3. 触发 PX → 断点命中
4. Call Stack 向上找事件构造函数（通常叫 mh / build_ev2）
5. 在事件构造的行下断点
6. 重新触发，逐个查看每个字段是怎么赋值的
```

### 4.6.1 实战例子

想知道 `M2MGKXUOBB8=` 字段是怎么算的：

```
1. 在 collector POST 调用前设断点
2. 触发，断下后看 events[0].d['M2MGKXUOBB8=']
3. 在断点上方找最近一处 `e.d["M2MGKXUOBB8="] = ...` 赋值
4. 单步进 RHS 函数 → 看到是 HMAC-MD5(uuid, UA)
```

---

## 4.7 手段 7：模式识别反推（兜底）

对前 6 种手段都找不到的字段，靠 6+ 批样本的**值模式**反推：

```
8 次样本: 3885, 4754, 4325, 3199, 5102, 4880, 3503, 4211
观察: 范围 3000-5000，总是比 initTime→sendTs 接近
推断: 这是 performance.now()，等于 sendTs - initTime
验证: 搜 SDK 中 'performance.now()' → 命中 ci() L1571 ✓
```

或者：

```
6 次样本: false, false, false, false, false, false
推断: 这是个 boolean STATIC 字段
查它周围字段 → 看是不是 bot 检测组的（webdriver 等）
```

---

## 4.8 跨版本不变量速查表（grep 优先级）

按抗混淆能力排序，越上面越稳定：

| 优先级 | 类型 | grep 示例 | 为什么稳定 |
|---|---|---|---|
| ⭐⭐⭐⭐⭐ | RFC 标准常量 | `grep "1732584193"` | RFC 写死，改了算法就废了 |
| ⭐⭐⭐⭐⭐ | 协议分隔符 | `grep '"~~~~"'`、`grep "split"` | 服务端写死 |
| ⭐⭐⭐⭐ | 浏览器 API 名 | `grep "navigator.platform"` | 改了就调不到 native |
| ⭐⭐⭐⭐ | 算法控制流模式 | `grep "<< 5\) -"`、`grep "31\s\*\s.\s\*\+"` | 算法本身不变 |
| ⭐⭐⭐⭐ | 算法魔法常量 | `grep "2147483647"`、`grep "0xE0100"` | 算法专属常量 |
| ⭐⭐⭐ | 协议端点 URL | `grep "tzm.px-cloud.net"` | 端点不能随意改 |
| ⭐⭐ | EV b64 key | `grep '"RTEwewNQMUg="'` | 跨小版本稳，大版本会变 |
| ⭐⭐ | Handler 形状 | "1 arg + 13 digits = state.no" | 协议形状稳，wire 字节会变 |
| ⭐ | 函数命名前缀 | `grep "function h"` | 前缀分组稳定 |
| ✗ | 变量名 / 函数名 | `hQ`, `mh`, `jt` | 每次混淆全变 |
| ✗ | 行号 | "L596" | 每次发布错位 |

**建议**：定位时**总是优先用上面的方法**（grep 模式），少用具体名字。这样你的方法论 3 年不需要重写。

---

## 4.9 27 个 OB Handler 形状匹配通用表

OB 段 handler 不能按名字识别（key 字符 `0/l` ↔ `o/I` ↔ `1/o` 跨版本变），按 args shape 识别：

| Handler 形状 | args 数量 + 类型 | 语义 |
|---|---|---|
| 1 arg + UUID（36 chars） | 1 string | state.pxsid / vid / cts |
| 1 arg + 13-digit ms timestamp | 1 string | state.no（serverNo） |
| 1 arg + 16-22 digit number | 1 string | state.to（anti-tamper 种子） |
| 1 arg + 64 hex chars | 1 string | state.qa（challenge hash） |
| 1 arg + 12-30 lower alnum | 1 string | state.appId |
| 1 arg + 2-4 lower letters | 1 string | state.jf（cu / success / blocked） |
| 4+ args + 第 1 个是 `_px*` | 4+ mixed | set_cookie segment ⭐ |
| 3 args + features config | 3 mixed | Mr 内部存储 |
| 1 arg + base64 | 1 string | 内部状态 |
| 5 args + visual config（int+int+int+int+64hex） | 5 mixed | 视觉挑战（Bundle 用） |
| ... | ... | ... |

完整 27 个 handler 形状表见 [`../../../skill/AI_re/references/handler-table.md`](../../../skill/AI_re/references/handler-table.md)。

---

## 4.10 完整 grep 速查（按算法层）

⭐ **本节是项目最值钱的速查表**。新 SDK 拿到手照此 grep 一遍，30 分钟定位完。

### 4.10.1 MD5 — 搜 init 常量

```bash
grep -nE "1732584193" main.min.js
# 命中 1 行: var ... = 1732584193, ... = -271733879, ... = -1732584194, ... = 271733878;
#                       ↑              ↑                ↑                  ↑
#                       A              B                C                  D
```

### 4.10.2 HMAC — 搜 ipad / opad

```bash
grep -nE "909522486" main.min.js     # ipad
grep -nE "1549556828" main.min.js    # opad
# 命中 2 行紧邻: h[e] = 909522486 ^ r[e], i[e] = 1549556828 ^ r[e];
```

### 4.10.3 XOR cipher — 搜 charCodeAt ^

```bash
grep -nE "charCodeAt\([^)]+\)\s*\^" main.min.js
grep -nE "\^\s*[a-z]\.charCodeAt" main.min.js
```

| 上下文 | 用途 |
|---|---|
| `^ 50` 或 `^ "2"` (ASCII 50) | payload 主 XOR |
| `^ 10` | padding XOR |
| `^ <动态变量>` | anti-tamper te() |
| `^ 120` 或 `% 128` | ob 响应 XOR key |

### 4.10.4 base64 UTF-8 — 搜 fromCharCode + "0x"

```bash
grep -nE 'String\.fromCharCode\("0x"' main.min.js
grep -nE 'encodeURIComponent.*\.replace' main.min.js
```

命中 PX 的 base64 UTF-8 函数 `z()`：

```js
function z(t) {
    return btoa(encodeURIComponent(t).replace(/%([0-9A-F]{2})/g, function(e, n) {
        return String.fromCharCode("0x" + n);   // ← 标志行
    }));
}
```

### 4.10.5 UUID v1 — 搜 Gregorian 偏移

```bash
grep -nE "122192928e5|12219292800000" main.min.js
# 命中: var p = (1e4 * (268435455 & (f += 122192928e5)) + s) % 4294967296;
```

### 4.10.6 djb2 hash — 搜 `<< 5 -`

```bash
grep -nE "<<\s*5\)\s*-\s*[a-z]" main.min.js
# 命中 djb2 标准形式（hash * 33 = (hash << 5) + hash 的变体）
```

### 4.10.7 ml() — 搜 31 * acc 或 INT32_MAX

```bash
grep -nE "31\s*\*\s*[a-z]\s*\+.*charCodeAt" main.min.js
grep -nE "%\s*2147483647" main.min.js
# 命中: n = (31 * n + t.charCodeAt(e)) % 2147483647
```

### 4.10.8 OB 解码 — 搜 split 模式

```bash
grep -nE 'split\("\|"\)' main.min.js                   # 段内 split
grep -nE 'split\("~~~~"\)\|split\(.~{3,4}.\)' main.min.js  # 段间 split
```

### 4.10.9 SID Unicode 隐写 — 搜 Plane 14

```bash
grep -nE "0xE0100|917760|U\+E01" main.min.js
grep -nE 'codePointAt\(0\)\.toString\(16\)' main.min.js
```

### 4.10.10 Anti-tamper — 搜 % 10 ± 系数

```bash
grep -nE "% 10 \+ 2\|% 10 \+ 1" main.min.js
grep -nE "\.charCodeAt\([^)]+\) \^ \(.+ % 10" main.min.js
```

---

## 4.11 Stage 4 完成标准 ✓

| 项 | 验证 |
|---|---|
| ✅ hQ_map.json 生成 | 1000+ 项 |
| ✅ 算法层全定位（grep 全命中） | 6 个核心常量都搜到 |
| ✅ DYNAMIC 字段全定位 | 32 个 DYNAMIC 字段每个都标注了 SDK 来源 |
| ✅ Anti-tamper 规则确认 | regex `/^[0-9:;<=>?@]{15,25}$/` |
| ✅ OB handler 27 个形状 | 跟 [handler-table.md](../../../skill/AI_re/references/handler-table.md) 对照 |

---

## 4.12 进入 Stage 5

Stage 4 完成 → 你知道每个 DYNAMIC 字段是从哪来的，但有 4 个**特殊字段是 state.\* 注入到 EV2 的特定 b64 key**，需要单独靠"值匹配"定位 → 进入 [Stage 5: Value-match ⭐⭐⭐](05_stage5_value_match.md)。
