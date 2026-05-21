# PerimeterX SDK 通用逆向方法论

> 目标：拿到**任何版本**的 PX SDK（main.min.js / init.js / captcha.js），
> 在 30 分钟内定位所有关键算法、handler、解码函数、协议常量。
>
> 核心原则：**不依赖任何会变的东西**。
> - ❌ 不用行号（每次发布都错位）
> - ❌ 不用变量名（混淆器全改名）
> - ❌ 不用函数名（混淆器全改名）
> - ✅ 用 RFC 标准魔法常量
> - ✅ 用协议字符串字面量
> - ✅ 用浏览器原生 API 名
> - ✅ 用算法控制流特征
> - ✅ 用参数形状（不用 handler 名）

---

## 目录

- [0. 总原则：什么稳定，什么不稳定](#0-总原则什么稳定什么不稳定)
- [1. 准备工作](#1-准备工作)
- [2. 跨版本不变量清单](#2-跨版本不变量清单)
- [3. 加密原语定位（6 个）](#3-加密原语定位6-个)
- [4. PX 自定义算法定位（8 个）](#4-px-自定义算法定位8-个)
- [5. 协议常量定位](#5-协议常量定位)
- [6. 入口与调度函数定位](#6-入口与调度函数定位)
- [7. hP/hM/hQ 字典提取与反查](#7-hphmhq-字典提取与反查)
- [8. EV 字段定位的 5 大手段](#8-ev-字段定位的-5-大手段)
- [9. Handler 形状匹配通用表](#9-handler-形状匹配通用表)
- [10. 字段三分类方法](#10-字段三分类方法)
- [11. 完整标准流程（新 SDK 30 分钟上手）](#11-完整标准流程新-sdk-30-分钟上手)
- [12. 故障排查决策树](#12-故障排查决策树)
- [13. 工具脚本一览](#13-工具脚本一览)
- [附录 A：全部 grep 模式索引](#附录-a全部-grep-模式索引)
- [附录 B：全部魔法常量索引](#附录-b全部魔法常量索引)
- [附录 C：全部协议字符串索引](#附录-c全部协议字符串索引)
- [附录 D：跨版本稳定性等级矩阵](#附录-d跨版本稳定性等级矩阵)
- [附录 E：新 SDK 30 分钟定位 checklist](#附录-e新-sdk-30-分钟定位-checklist)

---

## 0. 总原则：什么稳定，什么不稳定

PX SDK 平均 3 个月推一个新版本（main.min.js）+ 2-3 周推一个 captcha.js
更新。每次更新会让以下东西**全部失效**：

| 失效项 | 频率 |
|---|---|
| 所有变量名（如 `jE`、`hQ`、`Dd`） | 每次 |
| 所有函数名（如 `mh`、`Jf`、`ml`） | 每次 |
| 所有行号 | 每次 |
| hQ 字典里的字符串顺序 | 经常 |
| handler 的 wire 字节（如 `0lll000l`） | 偶尔 |
| EV 字段的 b64 key | 跨大版本会变 |

但以下东西**永远不变**（或几年不变一次）：

| 稳定项 | 为什么 |
|---|---|
| RFC 标准算法常量 | 改了算法就不对了 |
| 协议字符串 `~~~~` / `\|` | 服务端写死，客户端必须匹配 |
| 浏览器原生 API 名 | 改了就调不到 |
| 算法的控制流模式 | 改了就坏 |
| handler 的参数形状 | 改了协议就破了 |

**结论：所有定位工作都建立在"稳定项"上**，跨版本通用。

---

## 1. 准备工作

### 1.1 抓取 SDK

PX 主 SDK 一般在 `https://client.px-cloud.net/<APP_ID>/main.min.js`：

```bash
# 浏览器开 DevTools Network 看 client.px-cloud.net 的请求，复制 URL
curl 'https://client.px-cloud.net/<APP_ID>/main.min.js' > main.js
wc -c main.js   # 一般 230-280 KB
```

按压挑战的 SDK 在 `https://client.px-cloud.net/<APP_ID>/captcha.js`：

```bash
curl 'https://client.px-cloud.net/<APP_ID>/captcha.js' > captcha.js
wc -c captcha.js   # 一般 220-260 KB
```

### 1.2 抓真实流量

用 CDP（Chrome DevTools Protocol）连真实浏览器，**不要用 Selenium/Playwright**
（有 webdriver 痕迹）。

抓 6 批以上 cold-visit 流量，每批包含：

```
request_1.txt    # POST #1 完整 curl
response_1.txt   # 响应
request_2.txt    # POST #2 完整 curl
response_2.txt   # 响应
meta.json        # uuid, ts, SDK SHA-256
```

为什么 6 批：3 批不足以稳定区分 STATIC/DYNAMIC，6 批让 mode-value 模板生效。

### 1.3 准备 base 工具

任意一个 Node.js 环境 + 几个标准包：

```bash
npm install crypto-js   # MD5/HMAC
# Node 内置 crypto / Buffer 够用
```

---

## 2. 跨版本不变量清单

按抗混淆能力排序：

| 优先级 | 类型 | 示例 | 为什么稳定 |
|---|---|---|---|
| ⭐⭐⭐⭐⭐ | RFC 标准常量 | MD5 init `1732584193`、HMAC pad `909522486`、UUID Gregorian `122192928e5` | RFC 写死，改了算法就废了 |
| ⭐⭐⭐⭐⭐ | 协议分隔符字符 | `~~~~`、`\|` | 服务端写死 |
| ⭐⭐⭐⭐ | 浏览器 API 名 | `navigator.platform`、`performance.now` | 改了就调不到原生方法 |
| ⭐⭐⭐⭐ | 算法控制流模式 | `split("\|").shift()`、`charCodeAt^k`、`31*acc+charCodeAt` | 算法本身不变 |
| ⭐⭐⭐⭐ | 算法魔法常量 | `2147483647` (INT32_MAX)、`0xE0100` (Plane 14 起点)、`2863` (hash 因子) | PX 自己用的常量，但同算法必同值 |
| ⭐⭐⭐ | 协议端点 URL | `tzm.px-cloud.net/ns`、`/api/v2/collector` | 端点不能随意改 |
| ⭐⭐ | EV b64 key | `RTEwewNQMUg=`、`NSEAa3NAC18=` | 跨小版本稳定，跨大版本可能变 |
| ⭐⭐ | Handler 形状 | "1 arg + 13 digits = state.no" | 协议形状稳定，wire 字节会变 |
| ⭐ | 函数命名前缀 | `h*` 全局，`q*` getter | 前缀分组稳定，具体名不稳定 |
| ✗ | 变量名 / 函数名 | `hQ`、`mh`、`jt` | 每次混淆全变 |
| ✗ | 行号 | "L596" | 每次发布错位 |

---

## 3. 加密原语定位（6 个）

PX 用 6 个加密 / 哈希原语。每个都能用 RFC 标准常量直接 grep 到。

### 3.1 MD5 — 搜 init 常量

```bash
grep -nE "1732584193" main.js
```

会命中 1 行，格式：

```js
var ... = 1732584193, ... = -271733879, ... = -1732584194, ... = 271733878;
//         ↑           ↑                ↑                  ↑
//         A           B                C                  D
```

**为什么稳定**：这 4 个数是 MD5 的 RFC 1321 标准 A/B/C/D init 值，任何
MD5 实现都有。即便 PX 自己手写一份混淆 MD5，这 4 个数也改不了。

附带可见 64 个 round 常量（`-680876936` 是第一个），但不需要全 grep。

### 3.2 HMAC — 搜 ipad / opad

```bash
grep -nE "909522486" main.js     # ipad (0x36363636)
grep -nE "1549556828" main.js    # opad (0x5C5C5C5C)
```

会命中 2 行，紧邻：

```js
h[e] = 909522486 ^ r[e],
i[e] = 1549556828 ^ r[e];
```

**为什么稳定**：HMAC RFC 2104 标准 pad mask，任何 HMAC 实现都有。

### 3.3 XOR cipher — 搜 charCodeAt ^

```bash
grep -nE "charCodeAt\([^)]+\)\s*\^" main.js
grep -nE "\^\s*[a-z]\.charCodeAt" main.js
```

会命中多处，每处看上下文区分用途：

| 上下文 | 用途 |
|---|---|
| `^ 50` 或 `^ "2"` (ASCII 50 = "2") | payload 主 XOR key |
| `^ 10` | padding XOR key |
| `^ <动态变量>` | anti-tamper te() |
| `^ 120` 或 `% 128` | ob 响应 XOR key |

### 3.4 base64 UTF-8 编码 — 搜 fromCharCode + "0x"

```bash
grep -nE 'String\.fromCharCode\("0x"' main.js
grep -nE 'encodeURIComponent.*\.replace' main.js
```

PX 的 base64 UTF-8 函数永远用这个固定模式：

```js
function z(t) {
    return btoa(encodeURIComponent(t).replace(/%([0-9A-F]{2})/g, function(e, n) {
        return String.fromCharCode("0x" + n);   // ← 这一行
    }));
}
```

**为什么稳定**：UTF-8 字节流 → btoa 必须先把 multi-byte 字符变 single-byte，
PX 的实现方式就这一种。

### 3.5 UUID v1 — 搜 Gregorian 偏移

```bash
grep -nE "122192928e5|12219292800000" main.js
```

命中一行：

```js
var p = (1e4 * (268435455 & (f += 122192928e5)) + s) % 4294967296;
//                              ↑↑↑↑↑↑↑↑↑↑↑↑
```

**为什么稳定**：`(1970 - 1582) × 365.25 × 86400 × 1000 = 12219292800000`，
RFC 4122 UUID v1 标准。

附带可见两个 mask：
- `268435455` = 0x0FFFFFFF（28-bit timeLow mask）
- `4294967296` = 2^32（32-bit wrap）

### 3.6 djb2 hash 变体 — 搜 (e << 5) - e

```bash
grep -nE "<<\s*5\)\s*-\s*[a-z]" main.js
```

会命中 djb2 的标准形式（`hash * 33 = (hash << 5) + hash` 的变体）。
PX 用作 hash 字段（如某些字段的 mixing function）。

---

## 4. PX 自定义算法定位（8 个）

PX 在标准算法基础上自定义了 8 个，每个都有独特的特征常量或控制流。

### 4.1 ml() hash — INT32_MAX + 31×

```bash
grep -nE "31\s*\*\s*[a-z]\s*\+.*charCodeAt" main.js
grep -nE "%\s*2147483647" main.js
```

两个搜索都会命中同一行：

```js
n = (31 * n + t.charCodeAt(e)) % 2147483647
```

**特征**：`31 * acc + charCodeAt(i)` 是 djb2 变体；`% 2147483647` 是
INT32_MAX。`ml()` 函数的标志。

**用途**：从 TAG 推导出 OB 响应的 XOR key（`parseInt(ml(TAG)) % 128`）。

### 4.2 OB 分段处理 — 搜 split("|") 和 split("~~~~")

```bash
grep -nE 'split\("\|"\)' main.js
grep -nE 'split\(.~~~~.\)' main.js
```

两个 grep 命中相邻的代码块。OB 处理永远是：

```js
ob_decoded.split("~~~~")              // 拆段
  → each_segment.split("|")           // 拆 handler + args
    → args.shift()                     // 取 handler wire 字节
      → registry[handler].apply(args)   // 查表执行
```

**为什么稳定**：`~~~~` 和 `|` 是 PX 协议格式，服务端写死，客户端必须用同一个。

### 4.3 set_cookie handler — 搜 "bake" 或 "_px3"

```bash
grep -nE '"bake"|jb\("YmFrZQ=="\)|atob\("YmFrZQ=="\)' main.js
grep -nE '"_px3"|"_px2"' main.js
```

`YmFrZQ==` 是 `"bake"` 的 base64，PX 内部用这个标志区分 cookie handler。

set_cookie handler 一般在 27 个 handler 中的位置稳定（通过下面的形状匹配
找它）。

### 4.4 PC 计算 — 搜 HMAC + 数字提取

```bash
grep -nE ">=\s*48.*<=\s*57|charCodeAt.*%\s*10" main.js
```

PC 公式：
1. HMAC-MD5 得到 32 hex
2. 把 ASCII 48-57（即 `'0'`-`'9'`）的字符抽出
3. 其它字符（a-f）的 ASCII 码 mod 10
4. 拼接后按偶数下标取（间隔 2）

第 2、3 步会用 `>= 48 && <= 57` 或 `% 10` 的代码模式。grep 这两个即可
定位 PC 函数。

### 4.5 SID Unicode 隐写 — 搜 Plane 14 Tag

```bash
grep -nE "917760|0xE0100|fromCodePoint" main.js
```

`0xE0100` (= 917760) 是 Unicode Plane 14 Tag Characters 起点。SID 隐写
把 ASCII 数字加上这个偏移得到不可见字符。

**为什么稳定**：Unicode Tag 区由 IETF 定义，PX 改不了。

### 4.6 anti-tamper — 搜 % 10 + 1 / % 10 + 2

```bash
grep -nE "%\s*10\s*\+\s*[12]" main.js
```

anti-tamper 用 `state.no % 10 + 1` 和 `state.no % 10 + 2` 生成两个不同的
XOR 强度，分别得到 key 和 value：

```js
t[te(t.to, t.no % 10 + 2)] = te(t.to, t.no % 10 + 1);
//         ↑↑↑↑↑↑↑↑↑↑↑↑              ↑↑↑↑↑↑↑↑↑↑↑↑
//         key 的 XOR              value 的 XOR
```

**为什么稳定**：`% 10 + 1` 和 `% 10 + 2` 是 PX 写死的 magic，不变就不
破坏算法。

### 4.7 hash 字段 — 搜 2863 + charCodeAt(9)

```bash
grep -nE "2863" main.js
grep -nE "charCodeAt\(9\)" main.js
```

PX 有一个 mixing function 用 `vid.charCodeAt(9) * 2863 + ...` 这种模式。
`2863` 是 PX 自选的素数因子，跨版本不变。

### 4.8 PoW SHA-256 求解 — 搜难度 + sha256 + 暴搜

```bash
grep -nE "difficulty|sha-?256|crypto\.subtle\.digest" main.js
grep -nE "0x\w*ffff\b" main.js   # 16-bit mask
```

PoW 的特征：`for` 循环里反复算 SHA-256，配合 `& 0xFFFF` 或 `>> 16` 之类
的位操作。难度=16 时搜 `0xFFFF` 经常能定位。

---

## 5. 协议常量定位

### 5.1 Collector / Bundle 端点

```bash
grep -nE "/api/v2/collector|/b/s" main.js
grep -nE "px-cloud\.net" main.js
grep -nE "/assets/js/bundle" main.js   # bundle 端点
```

主机名总是 `collector-{appId 小写}.px-cloud.net`。

### 5.2 /ns 测速端点

```bash
grep -nE "tzm\.px-cloud\.net|/ns\?" main.js
```

### 5.3 TAG / APP_ID / BI / FT 常量（一行 4 个）

PX 把 4 个常量打包定义在一行：

```js
var ?? = "U0MmDhUmOnhXSw==",   // TAG
    ?? = "401",                  // FT
    ?? = "PXO1GDTa7Q",            // APP_ID
    ?? = "EwNm…",                 // BI
    ??;
```

定位方法：搜任何一个常量，4 个一起出现。

```bash
# 方法 1：用已知 APP_ID（最稳）
grep -nE '"PX[A-Za-z0-9]{8,}"' main.js | head -5
# 方法 2：搜长 base64 常量
grep -nE 'var\s+\w+\s*=\s*"[A-Za-z0-9+/=]{12,}=="' main.js | head -5
# 方法 3：搜 FT 数字（330/388/401 等 PX 常见值）
grep -nE '"(330|388|401|359|421)"' main.js
```

### 5.4 默认 fallback 时间戳

```bash
grep -nE "1604064986" main.js
```

PX 写死的 fallback timestamp（2020-10-30 UTC）。当 server timestamp 还
没拿到时用这个。

### 5.5 OB XOR key 的种子（gt）

OB XOR key = `parseInt(ml(gt), 10) % 128`，其中 `gt` 是另一个 base64
常量（不是 TAG）。

```bash
# 搜 ml 函数附近的 base64 字面量
grep -nE "ml\(\s*\"[A-Za-z0-9+/=]{8,}=" main.js
```

或者通过反解抓包验证：

```js
// 试候选 base64 常量
const candidates = [...];
for (const gt of candidates) {
    const key = parseInt(ml(gt), 10) % 128;
    const dec = xor(atob(resp.ob), key);
    if (dec.includes('~~~~')) console.log('FOUND:', gt);
}
```

---

## 6. 入口与调度函数定位

### 6.1 hQ 查表函数（字符串解码器）

特征：
- 一个函数 + 一个最长的字符串数组 + 一个缓存对象
- 函数体含 `void 0 === ?[t] ? ?[t] = ?(?[t]) : ?[t]`

```bash
# 1. 找最长的字面数组（一般是 hP）
grep -nE ',\s*[a-zA-Z]{1,3}\s*=\s*\[' main.js | head -10
# 2. 找 hM 解码器（base91 字符集是关键特征）
grep -nE 'F@bt|"F@bt;\\"m:x3' main.js
# 3. 找 hQ cache 模式
grep -nE 'void\s+0\s*===.*\?.*=' main.js | head -5
```

### 6.2 OB 分发主函数

特征：循环 → `split('~~~~')` → `split('|')` → `.shift()` → 查表 → `apply`。

```bash
# 找 split('|') 紧跟 apply / call
grep -nE 'split\("\|"\)' main.js -A 5 | grep -E 'apply|call' | head -5
```

### 6.3 27 个 handler 注册表

特征：连续给一个对象的多个键赋值，键是字面 wire 字节（`I` / `0` / `o` /
`l` 组合）或 hQ(N) 引用。

```bash
# 搜字面 wire 字节 + handler 函数引用
grep -nE '\["?(I|0|o|l|1){6,}"?\]\s*=' main.js | head -20
grep -nE 'SP\["?[Il0o1]{6,}"?\]\s*=' main.js | head -20
```

### 6.4 事件构造主入口（mh / 等价物）

特征：组装 POST 参数 `payload=` `appId=` `tag=` `pc=` `sid=` 等。

```bash
grep -nE '"payload="|"&payload="' main.js
grep -nE '"&pc="|"&cs="|"&sid="|"&uuid="' main.js
grep -nE '"appId="' main.js
```

### 6.5 指纹采集主入口（Dd / 等价物）

特征：连续调用一组短名函数（`ev(t); nv(t); av(t); ...`），每个采集一组字段。

```bash
grep -nE '\b[a-z]{1,3}\(t\);\s*[a-z]{1,3}\(t\);\s*[a-z]{1,3}\(t\)' main.js | head -5
```

### 6.6 PoW 求解函数（仅 captcha.js）

```bash
grep -nE 'for\s*\([^)]*<<\s*1[56]' captcha.js   # 难度 16 的循环
grep -nE 'crypto\.subtle\.digest\("SHA-256"' captcha.js
grep -nE 'sha-?256' captcha.js -i
```

### 6.7 WASM 加载函数（仅 captcha.js）

```bash
grep -nE 'WebAssembly\.instantiate|new WebAssembly\.Module' captcha.js
grep -nE 'Us\(\)\[10\]|\\x00asm' captcha.js   # WASM magic
```

---

## 7. hP/hM/hQ 字典提取与反查

### 7.1 三件套结构

```
hP[1152 项]   ← base91 压缩的字符串数组
   ↓ hM(s)
bytes       ← 解码字节流
   ↓ hY(bytes)
UTF-8 string  ← 实际语义
   ↓ hQ(N) cached in hO[]
```

### 7.2 hM base91 解码器（Node 实现）

字母表 91 字符（PX 自定义打乱顺序，跨版本一致）：

```
F@bt;"m:x3&#LiZ[)TE/}%QD1Iu.6f0R]78|4{zvWC>`$Se(rJ=*c^2_?qOpB,d<AVy~YwoP!+9g5nXhUsNGjaMKHlk
```

完整实现：

```js
// hM.js
const ALPHABET = 'F@bt;"m:x3&#LiZ[)TE/}%QD1Iu.6f0R]78|4{zvWC>`$Se(rJ=*c^2_?qOpB,d<AVy~YwoP!+9g5nXhUsNGjaMKHlk';

function hM(input) {
    const s = String(input || '');
    const out = [];
    let buf = 0, bits = 0, val = -1;
    for (let i = 0; i < s.length; i++) {
        const idx = ALPHABET.indexOf(s[i]);
        if (idx === -1) continue;
        if (val < 0) val = idx;
        else {
            val += idx * 91;
            buf |= val << bits;
            bits += ((val & 8191) > 88) ? 13 : 14;
            do {
                out.push(buf & 0xFF);
                buf >>= 8;
                bits -= 8;
            } while (bits > 7);
            val = -1;
        }
    }
    if (val > -1) out.push((buf | (val << bits)) & 0xFF);
    return Buffer.from(out).toString('utf-8');
}
```

### 7.3 字典旋转 IIFE

启动时 SDK 跑一个 IIFE 反复 `push(shift())` 直到通过数学校验。**这导致源码
里 hP 的顺序 ≠ 运行时顺序**。

最简单的处理：**用浏览器导出**（步骤 7.4），不要尝试在 Node 里复刻校验。

### 7.4 浏览器 Console 导出（最稳）

在任意 PX 保护的页面打开 DevTools Console：

```js
// 1. 探测 hQ 全局可见性
typeof hQ;   // → "function" ✓

// 2. 批量 dump
var map = {};
for (var i = 0; i < 1200; i++) {
    try { map[i] = hQ(i); } catch (e) {}
}
console.log('Decoded', Object.keys(map).length, 'entries');
copy(JSON.stringify(map, null, 2));   // 复制到剪贴板
```

粘贴到 `hQ_map.json`，得到 1152 个 index → 字符串映射。

> 如果 `hQ` 不在全局（被关到闭包里）：在 DevTools 任意 hQ 调用处下断点，
> paused 时再 dump。

### 7.5 Node.js 提取（不需要浏览器）

```js
// extract_hQ.js
const fs = require('fs');
const { hM } = require('./hM');

const sdk = fs.readFileSync('main.js', 'utf-8');

// 1. 提取 hP 字面量
const start = sdk.indexOf(', hP = [');
let arrStart = sdk.indexOf('[', start);
let i = arrStart + 1, depth = 1;
while (i < sdk.length && depth > 0) {
    const c = sdk[i];
    if (c === '"' || c === "'") {
        const q = c;
        i++;
        while (i < sdk.length && sdk[i] !== q) {
            if (sdk[i] === '\\') i++;
            i++;
        }
    } else if (c === '[') depth++;
    else if (c === ']') depth--;
    i++;
}
const hP = eval(sdk.slice(arrStart, i));

// 2. 旋转：用浏览器一次性导出的顺序，或在 Node 跑 SDK
// (推荐先用浏览器导出 rotated_hP.json，再加载)

// 3. 批量解码
const map = {};
for (let n = 0; n < hP.length; n++) {
    try { map[n] = hM(hP[n]); } catch (e) {}
}
fs.writeFileSync('hQ_map.json', JSON.stringify(map, null, 2));
```

### 7.6 反查 b64 key → SDK callsite

```js
// reverse_lookup.js
const map = require('./hQ_map.json');
const sdk = require('fs').readFileSync('main.js', 'utf-8');

// 构建反向表
const rev = {};
for (const [n, v] of Object.entries(map)) {
    if (!(v in rev)) rev[v] = +n;
}

function locate(b64Key) {
    // 1. 通过 hQ(N) 引用？
    if (b64Key in rev) {
        const N = rev[b64Key];
        const re = new RegExp(`hQ\\(\\s*${N}\\s*\\)`, 'g');
        const m = re.exec(sdk);
        return m ? { via: 'hQ', N, idx: m.index } : null;
    }
    // 2. 明文出现？
    const idx = sdk.indexOf(`"${b64Key}"`);
    return idx >= 0 ? { via: 'plain', idx } : null;
}
```

---

## 8. EV 字段定位的 5 大手段

按覆盖率从高到低：

### 手段 A：hQ 字典反查（覆盖 50%）

见第 7.6 节。任何通过 `hQ(N)` 引用的字段都能定位。

### 手段 B：搜明文 ["KEY="]（覆盖 40%）

```bash
grep -nE '"RTEwewNQMUg="' main.js
# 加引号 + 加等号比裸 key 精确（避免 base64 里 + / 引起的误匹配）
```

PX 一部分字段直接以 b64 字面量写在源码里（约 40%）。

### 手段 C：搜值来源的浏览器 API（覆盖环境字段）

| 字段值 | 搜什么 |
|---|---|
| `"Win32"`, `"MacIntel"` | `navigator.platform` |
| `1920`, `1080`, `2560` | `screen.width`, `screen.height` |
| 大数字 1e7-1e9 | `performance.memory`, `usedJSHeapSize`, `totalJSHeapSize` |
| `"visible"` | `document.visibilityState` |
| `"webkit"`, `"Mozilla"` | `navigator.userAgent`, `navigator.vendor` |
| `"en-US"`, `"zh-CN"` | `navigator.language`, `navigator.languages` |
| `"https:"` | `location.protocol` |
| 时区数字（-480 等） | `Date.getTimezoneOffset` |

混淆器**不能改浏览器原生 API 名**，因为改了就调不到。

### 手段 D：搜算法魔法常量（覆盖 PC / HMAC / hash 字段）

| 字段语义 | 魔法常量 |
|---|---|
| HMAC(uuid, UA) | 跟 HMAC ipad/opad (`909522486`) 同代码块 |
| Date.toString() | `new Date()` 或 `Date.prototype.toString` |
| anti-tamper | `% 10 + 2` 和 `% 10 + 1` |
| hash 字段 | `2863` 和 `charCodeAt(9)` |
| sid 隐写 | `0xE0100` / `917760` |
| UUID v1 | `122192928e5` |

### 手段 E：跨样本 diff 反推（兜底，覆盖剩余）

对 6 批样本逐字段比较：

| 模式 | 推断 |
|---|---|
| 6 批同值 | STATIC，照搬模板 |
| 6 批不同值，均 13 位数字 | timestamp |
| 6 批不同值，均 UUID 格式 | uuid 类 |
| 6 批不同值，均 32 hex | HMAC-MD5 |
| 6 批不同值，均 64 hex | SHA-256 / state.qa |
| 6 批不同值，长 b64 | /ns sm |
| 6 批不同值，大整数 1e7-1e9 | memory bytes |
| 6 批不同值，浮点 < 10000 | performance.now() |
| 6 批不同值，object | 嵌套子结构（如 navigator.connection） |
| 部分批次有 | CONDITIONAL（warm visit 字段） |

---

## 9. Handler 形状匹配通用表

⚠️ **永远不要用 handler wire 字节识别**（如 `0lll0l`、`o111oo` —— 每次
SDK 升级都可能变）。**用参数形状**。

| handler 语义 | 形状特征 | 写入 state |
|---|---|---|
| server timestamp | 1 arg, `/^1[5-9]\d{11}$/` (13 位毫秒) | `state.no` |
| second-tick ts | 1 arg, `/^1[5-9]\d{8,9}$/` (10 位秒) | `state.ro` |
| challenge_hash | 1 arg, `/^[0-9a-f]{64}$/` (SHA-256) | `state.qa` |
| vid | 3 args, UUID + 数字 + flag | `state.vid` |
| cts | 2 args, UUID + flag | `state.cts` |
| pxsid | 1 arg, UUID 格式 | `state.pxsid` |
| session_id (to) | 1-2 args, `/^[A-Za-z0-9]{16,}$/` | `state.to` |
| status code | 1 arg, `/^\d{3}$/` | `state.ao` |
| **set_cookie** | **4+ args, 第 1 个 `/^_?px/i` 开头** | **`state.px3 = {name, value, ttl}`** |
| app_id (bundle) | 1 arg, `/^[a-z0-9]{12,30}$/` | `state.appId` |
| control_flag | 1 arg, `/^[a-z]{2,4}$/`（如 `"cu"`, `"fc"`, `"o"`, `"b"`） | `state.jf` |
| o111val | 1 arg, `/^\d{4,5}$/` | `state.o111val` |
| feature_flags | 1 arg, `/^[a-z]+:\d.*,/` (如 `"ccc:0,ic:0,nf:0,ai:0"`) | `state.cc` |
| cookie_config | 4-5 args, [name, value, ttl, opts...] | `state.cookieConfig` |
| localStorage write | 2 args, key + value | (副作用) |
| navigation | 1 arg, URL 或 path | (副作用) |
| trigger_event | 1 arg, event 名 | (副作用) |
| noop | 0-1 args, 不匹配以上 | (跳过) |

实现：

```js
function decodeHandler(handlerByte, args) {
    if (args.length === 1) {
        const a = args[0];
        if (/^1[5-9]\d{11}$/.test(a)) return { type: 'state.no', value: a };
        if (/^[0-9a-f]{64}$/.test(a)) return { type: 'state.qa', value: a };
        if (/^[0-9a-f-]{36}$/.test(a)) return { type: 'state.pxsid_or_vid', value: a };
        if (/^[a-z]{2,4}$/.test(a)) return { type: 'state.jf', value: a };
        if (/^\d{3}$/.test(a)) return { type: 'state.ao', value: a };
        if (/^[a-z0-9]{12,30}$/.test(a)) return { type: 'state.appId', value: a };
        if (/^[A-Za-z0-9]{16,}$/.test(a)) return { type: 'state.to', value: a };
    }
    if (args.length >= 4 && /^_?px/i.test(args[0])) {
        return { type: 'set_cookie', name: args[0], value: args[2], ttl: +args[1] };
    }
    if (args.length === 2 && /^[a-z]+:\d/.test(args[0])) {
        return { type: 'feature_flags', value: args[0] };
    }
    return { type: 'noop', args };
}
```

这套形状匹配**已在 iFood / Grubhub / 多个时期的 PX 版本上验证通用**。

---

## 10. 字段三分类方法

### 10.1 STATIC / DYNAMIC / CONDITIONAL 定义

| 类别 | 特征 | 处理 |
|---|---|---|
| **STATIC** | 同浏览器同设备多批抓包**完全一致** | 模板里抄真值，永不动 |
| **DYNAMIC** | 多批之间**变化**，可能有模式 | 算法生成（时间戳、UUID、HMAC 等） |
| **CONDITIONAL** | 部分批次**缺失** | warm visit 才有；cold visit 不发 |

### 10.2 自动 diff 脚本

```js
// diff_samples.js
const fs = require('fs');
const batches = process.argv.slice(2);   // batch1.json batch2.json ...

const allKeys = new Set();
const valuesByKey = {};

for (const f of batches) {
    const ev = JSON.parse(fs.readFileSync(f));
    for (const k of Object.keys(ev.d)) {
        allKeys.add(k);
        if (!valuesByKey[k]) valuesByKey[k] = [];
        valuesByKey[k].push(JSON.stringify(ev.d[k]));
    }
}

const result = { static: [], dynamic: [], conditional: [] };
for (const k of allKeys) {
    const values = valuesByKey[k];
    if (values.length < batches.length) {
        result.conditional.push(k);
    } else if (new Set(values).size === 1) {
        result.static.push(k);
    } else {
        result.dynamic.push(k);
    }
}

fs.writeFileSync('field_classes.json', JSON.stringify(result, null, 2));
```

### 10.3 DYNAMIC 字段子分类

对每个 DYNAMIC 字段，看 6 批值的模式，按下表归类：

| 值模式 | 子类 | 生成算法 |
|---|---|---|
| `/^1[5-9]\d{11}$/` | timestamp ms | `Date.now()` |
| `/^[0-9a-f-]{36}$/` | UUID | `uuidV1()` 或 `state.<var>` |
| `/^[0-9a-f]{32}$/` | HMAC-MD5 | `hmacMD5(input, key)` |
| `/^[0-9a-f]{64}$/` | SHA-256 / `state.qa` | 从 OB#1 复制 |
| `/^[A-Za-z0-9+/=]{40,}$/` | /ns sm | `await fetch('/ns?c=...')` |
| 浮点 0-10000 | `performance.now()` | `sendTime - initTime` |
| 整数 1e7-1e9 | memory bytes | `random(40_000_000, 140_000_000)` |
| 整数 100-9999 | perf 指标 / counter | `random(...)` |
| `"Tue May 19 ..."` | `Date.toString()` | `new Date().toString()` |
| object | 嵌套子结构 | 看子结构内字段 |

---

## 11. 完整标准流程（新 SDK 30 分钟上手）

### 阶段 1：下载 + 探测（5 分钟）

```bash
# 1. 下 SDK
curl 'https://client.px-cloud.net/<APP_ID>/main.min.js' > main.js
wc -c main.js   # 应 200-300 KB

# 2. 探测主要算法是否在场
grep -c "1732584193" main.js     # MD5: 应 = 1
grep -c "909522486" main.js       # HMAC: 应 = 1
grep -c "122192928e5" main.js     # UUID v1: 应 = 1
grep -c "2147483647" main.js      # ml(): 应 ≥ 1
grep -c "917760\|0xE0100" main.js # SID stego: 应 ≥ 1（如果用）
grep -c "~~~~" main.js            # OB 分隔符: 应 ≥ 1
```

如果上述任何一个 = 0，说明 SDK 出现重大变化，整体方法论需要重新评估。

### 阶段 2：抓 6 批样本（10-15 分钟）

CDP 接真实 Chrome，每批：

```
samples/N/
├── request_1.txt        # POST #1 完整 curl
├── response_1.txt       # 响应
├── request_2.txt        # POST #2 完整 curl
├── response_2.txt       # 响应
└── meta.json            # uuid, ts, SDK SHA-256
```

6 批用同一个 SDK SHA-256（meta.json 里记录）。

### 阶段 3：解码 + 提取常量（5 分钟）

```js
// 解码 POST #1 payload → 拿到 EV1
const ev1 = decodePayload(captureFile1.payload);

// 拆出常量
const APP_ID = captureFile1.body.appId;      // POST 参数
const TAG = captureFile1.body.tag;
const FT = captureFile1.body.ft;
const BI = captureFile1.body.bi || null;

// 解码 response_1 → 拿到 state.*
const state = decodeOb(captureFile1.response_1, TAG);
console.log(state);
// { no: '...', to: '...', qa: '...', pxsid: '...', vid: '...', appId: '...' }
```

### 阶段 4：提取 hQ 字典（5 分钟）

浏览器 Console 跑步骤 7.4 的 dump 脚本，得到 `hQ_map.json`。

### 阶段 5：字段定位（10-30 分钟）

```js
// 对每个抓到的 EV2 字段，找其 SDK 源头
for (const [b64Key, value] of Object.entries(ev2.d)) {
    const located = locate(b64Key);   // 7.6 节
    console.log(b64Key, '→', located);
}
// → 大部分能定位到 hQ(N) 或明文
// → 剩下少数用手段 C/D/E
```

### 阶段 6：分类（10 分钟）

跑 10.2 节的 diff_samples.js，得到 `field_classes.json`。

### 阶段 7：定 state.* 注入位置（30 分钟 — 关键的一步）

`state.*` 在 EV2 里的 b64 key **没有算法可推**，必须**值匹配**：

```js
// find_state_keys.js
for (const stateVar of ['no', 'to', 'qa', 'vid', 'pxsid', 'appId', 'cts', 'o111val']) {
    const matches = [];
    for (const batch of batches) {
        const candidates = [];
        for (const [k, v] of Object.entries(batch.ev2.d)) {
            if (String(v) === String(batch.state[stateVar])) candidates.push(k);
        }
        matches.push(new Set(candidates));
    }
    // 6 批交集 = 唯一的 b64 key
    const final = [...matches[0]].filter(k => matches.every(s => s.has(k)));
    console.log(`state.${stateVar} →`, final[0]);
}
```

### 阶段 8：写生成器（1-3 小时）

```js
// 用模板 + DYNAMIC 覆盖 + state 注入 + anti-tamper
function generateCookie(ua) {
    const uuid = uuidV1();
    const initTime = Date.now();
    const nsResult = await fetchNs(uuid);

    // POST #1
    const ev1 = buildEv1({ uuid, initTime, sendTime: Date.now(), nsResult });
    const resp1 = await postCollector(ev1, /* ... */);

    // 解 OB#1 → state
    const state = decodeOb(resp1, TAG);

    // POST #2
    const ev2 = buildEv2({ uuid, state, ua, initTime, sendTime, nsResult });
    const resp2 = await postCollector(ev2, /* ... */);

    // 解 OB#2 → _px3
    return decodeOb(resp2, TAG).px3;
}
```

### 阶段 9：10/10 验证

间隔 ≥10 秒跑 10 次，全部业务 API 接受。失败按第 12 节决策树排查。

---

## 12. 故障排查决策树

### 12.1 顶级症状分类

```
Collector 返 200 但没有 _px3 cookie？
  ├─ 响应 body 是 {"do":[]} → PC 错（第 4.4 节算法）
  ├─ 响应 body 是 {"do":[...]} 但无 set_cookie 段 → ev2 错（看 12.2）
  └─ 响应 body 含 set_cookie 但你 parse 不到 → OB 解码错（第 4.2 节）

Collector 直接拒绝（403 / 4xx）？
  ├─ 请求头 Origin/Referer 错 → 改头
  ├─ payload= URL-encode 错 → 检查 encodeURIComponent
  ├─ TLS fingerprint 被 Cloudflare 识别 → 用 curl_cffi 或真浏览器
  └─ IP 速率限制 → 间隔 ≥10 秒重试

业务 API 拒绝但 collector 通过？
  ├─ cookie 写得不对 → 检查 _px3 完整字符串
  ├─ EV2 缺字段或多字段 → 跨平台移植踩坑（Grubhub EV2 不该有 /ns dur）
  └─ 触发了 bundle path → 看 Bundle 章节

间歇失败（10 次有 4-5 次过）？
  └─ IP 速率限制（最常见）→ 间隔 ≥15 秒
```

### 12.2 EV2 错的子诊断

```
解你自己生成的 payload，对比模板的 ev2：
  ├─ 字段数不同 → 多了 / 少了字段
  │   ├─ 多了 → 检查是不是把 EV1 字段误塞 EV2
  │   └─ 少了 → 检查 STATIC 字段是否完整复制
  │
  ├─ 字段数同但 anti-tamper 位置错 → 检查 anti-tamper 是原位置替换吗
  │   └─ 必须找到匹配 /^[0-9:;<=>?@]{15,25}$/ 的字段，**原地**改 key + value
  │
  ├─ state.no 是字符串不是数字 → parseInt（第 4.6 节，坑 #1）
  ├─ HMAC 算的跟模板对不上 → 检查 UA 是否跟 HTTP header 完全一致
  ├─ Date.toString() 是英文不是中文标准时间 → strftime 写错时区
  └─ /ns sm 字段为 null → /ns 请求没发或失败
```

### 12.3 OB 解码错的子诊断

```
解出来全是乱码？
  ├─ XOR key 错 → 第 5.5 节定 ml 的输入（gt）
  ├─ atob 用了 utf-8 不是 binary/latin-1 → 改 binary
  ├─ split 用了 3 个波浪号不是 4 个 → 用 "~~~~"（4 个）
  └─ split 用了别的分隔符 → 必须是 "|"

解出来部分对，部分乱？
  └─ XOR key 跨段不一致 → 检查 ml(TAG) 算得对吗
```

### 12.4 调试速查命令

```bash
# 解我自己的 payload
node decode_payload.js my_request.txt > my_ev2.json
diff template_ev2.json my_ev2.json

# 解 collector 响应
node decode_response.js resp.json TAG > state.json

# 类型检查（state.no 必须是 number）
jq '.state.no | type' state.json   # 应是 "string"，但写入 ev2 时要 parseInt
```

---

## 13. 工具脚本一览

新 SDK 上手需要这套脚本（每个 ≤ 200 行）：

| 脚本 | 用途 | 输入 | 输出 |
|---|---|---|---|
| `extract_hQ.js` | 提 hQ 字典 | `main.js` | `hQ_map.json` |
| `decode_payload.js` | 解 POST payload | request_*.txt | EV JSON |
| `decode_response.js` | 解 OB 响应 | response_*.txt + TAG | state + segments |
| `diff_samples.js` | STATIC/DYNAMIC/CONDITIONAL 分类 | N 批 EV JSON | field_classes.json |
| `lookup_keys.js` | 字段 → SDK 位置 | b64 key + hQ_map + main.js | via/idx 信息 |
| `find_state_keys.js` | state.* → EV2 b64 key | 6 批 state + 6 批 EV2 | state_key_map.json |
| `probe_dynamic.js` | DYNAMIC 字段子分类 | DYNAMIC keys + 6 批值 | semantic.json |

实现起来一晚上能搞完，跨版本通用。

---

## 附录 A：全部 grep 模式索引

```bash
# === 加密原语 ===
grep -nE "1732584193" main.js                                          # MD5 init A
grep -nE "909522486" main.js                                            # HMAC ipad
grep -nE "1549556828" main.js                                           # HMAC opad
grep -nE "122192928e5|12219292800000" main.js                            # UUID v1
grep -nE "charCodeAt\([^)]+\)\s*\^" main.js                              # XOR cipher
grep -nE 'String\.fromCharCode\("0x"' main.js                            # base64 UTF-8

# === PX 自定义算法 ===
grep -nE "%\s*2147483647" main.js                                        # ml() INT32_MAX
grep -nE "31\s*\*\s*[a-z]\s*\+.*charCodeAt" main.js                       # ml() djb2
grep -nE 'split\("\|"\)' main.js                                          # OB segment
grep -nE 'split\(.~~~~.\)' main.js                                        # OB delimiter
grep -nE ">=\s*48.*<=\s*57|charCodeAt.*%\s*10" main.js                    # PC digit extract
grep -nE "917760|0xE0100|fromCodePoint" main.js                          # SID Plane 14
grep -nE "%\s*10\s*\+\s*[12]" main.js                                    # anti-tamper
grep -nE "2863" main.js                                                  # hash 因子
grep -nE '"bake"|jb\("YmFrZQ=="\)' main.js                                # set_cookie 标志

# === 协议常量 ===
grep -nE "/api/v2/collector|/b/s" main.js                                # collector
grep -nE "tzm\.px-cloud\.net|/ns\?" main.js                              # /ns
grep -nE "/assets/js/bundle" main.js                                     # bundle
grep -nE "px-cloud\.net" main.js                                         # 主域
grep -nE "1604064986" main.js                                            # fallback ts

# === 浏览器 API 名（用于字段定位） ===
grep -nE 'navigator\.platform' main.js
grep -nE 'navigator\.userAgent' main.js
grep -nE 'navigator\.language' main.js
grep -nE 'navigator\.connection' main.js
grep -nE 'screen\.width|screen\[' main.js
grep -nE 'screen\.height' main.js
grep -nE 'performance\.now' main.js
grep -nE 'performance\.memory' main.js
grep -nE 'document\.visibilityState' main.js
grep -nE 'location\.protocol' main.js
grep -nE 'location\.href' main.js
grep -nE 'Date\.prototype\.toString|new Date\(\)\.toString' main.js
grep -nE 'getTimezoneOffset' main.js

# === 入口函数特征 ===
grep -nE ',\s*[a-zA-Z]{1,3}\s*=\s*\[' main.js | head -5                  # hP 数组候选
grep -nE 'F@bt|"F@bt;\\"m:x3' main.js                                    # hM 字母表
grep -nE 'void\s+0\s*===.*\?.*=' main.js | head -5                       # hQ 缓存
grep -nE '"payload="|"&payload="' main.js                                # mh 主入口
grep -nE '"&pc="|"&cs="|"&sid="' main.js                                 # POST 参数构造
grep -nE 'split\("\|"\)' main.js -A 5 | grep -E 'apply|call'              # OB dispatcher

# === Bundle (captcha.js) ===
grep -nE 'WebAssembly\.instantiate' captcha.js                            # WASM 加载
grep -nE 'crypto\.subtle\.digest\("SHA-256"' captcha.js                    # PoW
grep -nE 'difficulty|0xFFFF' captcha.js -i                                # PoW 难度
```

---

## 附录 B：全部魔法常量索引

| 常量 | 类别 | 用途 |
|---|---|---|
| `1732584193` | RFC | MD5 init A |
| `-271733879` | RFC | MD5 init B |
| `-1732584194` | RFC | MD5 init C |
| `271733878` | RFC | MD5 init D |
| `-680876936` | RFC | MD5 round 1 第 1 常量（验证用） |
| `909522486` | RFC | HMAC ipad `0x36363636` |
| `1549556828` | RFC | HMAC opad `0x5C5C5C5C` |
| `122192928e5` | RFC | UUID v1 Gregorian 偏移 |
| `12219292800000` | RFC | 同上（展开） |
| `268435455` | RFC | `0x0FFFFFFF` UUID v1 timeLow mask |
| `4294967296` | RFC | `2^32` UUID v1 wrap |
| `2147483647` | PX | `INT32_MAX`，ml() 取模 |
| `917760` | Unicode | `0xE0100`，Plane 14 Tag 起点 |
| `2863` | PX | hash 字段因子 |
| `4210` | PX | Myanmar XOR key |
| `1604064986` | PX | fallback timestamp（2020-10-30） |
| `0xFFFF` (65535) | PX | PoW 难度 16 mask |
| `50` | PX | payload 主 XOR key |
| `10` | PX | padding XOR key |
| `120` | PX | OB 响应 XOR key（iFood，从 ml(TAG) 推出来的实例） |

---

## 附录 C：全部协议字符串索引

| 字符串 | 用途 |
|---|---|
| `~~~~` | OB 段分隔符（4 个波浪号，不是 3 个） |
| `\|` | handler + args 分隔符 |
| `/api/v2/collector` | Collector 路径 |
| `/b/s` | Collector 备用路径 |
| `/assets/js/bundle` | Bundle 路径 |
| `tzm.px-cloud.net` | /ns 测速主机 |
| `client.px-cloud.net` | SDK CDN |
| `collector-<appid>.px-cloud.net` | Collector 主机 |
| `bake` (`YmFrZQ==`) | set_cookie handler 标志 |
| `cu` | jf 控制 flag（cookie update） |
| `cc` | jf 延迟执行标志 |
| `_px3` / `_px2` | cookie 名 |
| `_pxhd` | history cookie |
| `_pxvid` | visitor id cookie |
| `x-www-form-urlencoded` | POST Content-Type |

---

## 附录 D：跨版本稳定性等级矩阵

| 元素 | 跨小版本（季度内） | 跨大版本（年度） | 跨多年 |
|---|---|---|---|
| RFC 标准常量 | ✓ | ✓ | ✓ |
| 协议分隔符 `~~~~` `\|` | ✓ | ✓ | ✓ |
| 浏览器 API 名 | ✓ | ✓ | ✓ |
| Plane 14 起点 0xE0100 | ✓ | ✓ | ✓ |
| INT32_MAX | ✓ | ✓ | ✓ |
| 算法魔法常量（如 2863） | ✓ | 大概率 ✓ | 可能变 |
| 协议端点 `/api/v2/collector` | ✓ | 大概率 ✓ | 可能变 |
| Fallback timestamp `1604064986` | ✓ | ✓ | 可能更新 |
| EV2 字段 b64 key | ✓ | 大概率变 | 几乎肯定变 |
| Handler wire 字节（如 `0lll0l`） | 大概率 ✓ | 可能变 | 几乎肯定变 |
| Handler 形状（参数模式） | ✓ | ✓ | ✓（PX 协议设计稳定） |
| hQ 字典内容 | 经常变 | 几乎肯定变 | — |
| 变量名 / 函数名 | 经常变 | 几乎肯定变 | — |
| 行号 | 每次变 | 每次变 | 每次变 |

**关键洞察**：行号每次变，但**算法常量永不变**。把方法论建立在算法上，
就有跨年通用的可靠性。

---

## 附录 E：新 SDK 30 分钟定位 checklist

打勾过完这 13 步，你就拿到了一个新 SDK 的**完整逆向地图**：

```
□ 1. 下 main.js (~250 KB)
□ 2. 探测：grep MD5 init / HMAC pad / UUID 偏移 / INT32_MAX 各应 ≥ 1
□ 3. 抓 6 批 cold-visit 流量（含 SDK SHA 一致）
□ 4. 解码 EV1 + EV2 + state（用 ml(TAG)%128 当 XOR key）
□ 5. 提取常量：APP_ID, TAG, FT, BI（POST body 里直接读）
□ 6. 浏览器 Console dump hQ 字典 → hQ_map.json
□ 7. 跑 lookup_keys.js → 每个字段 via hQ / plain / not_found
□ 8. 对 not_found 字段，用手段 C/D/E 找
□ 9. 跑 diff_samples.js → STATIC/DYNAMIC/CONDITIONAL 分类
□ 10. 跑 find_state_keys.js → state.* 在 EV2 的 b64 key 映射
□ 11. 写生成器：模板 + DYNAMIC 覆盖 + state 注入 + anti-tamper
□ 12. 10 次连发（间隔 ≥10s）做端到端验证
□ 13. 10/10 通过 → ship；< 10/10 → 按第 12 节决策树查
```

完整时间：

- 算法层（如果你已经用过这套方法论）：**30 分钟定位**
- 字段层（STATIC/DYNAMIC 标注）：**1-2 小时**
- 端到端生成器实现：**1-3 小时**
- 10/10 调试：**0.5-2 小时**

**总计：3-8 小时**，跟语言、抓包工具、调试经验有关。

---

## 写在最后

这套方法论的核心是**用 RFC 标准、协议字符串、浏览器原生 API 这三类
跨版本稳定的东西**来定位 PX 的所有混淆代码。

- ❌ 不要看到一段陌生的 SDK 就从第 1 行开始读
- ❌ 不要试图理解所有变量名
- ❌ 不要记行号
- ✅ 优先 grep 你已知的稳定特征
- ✅ 用形状匹配代替名字匹配
- ✅ 用值匹配代替算法推导（特别是 state.* → EV2 b64 key）
- ✅ 用模板抄 STATIC，只算 DYNAMIC

**3 年观察下来，PX 频繁旋转混淆，但从未改过算法。**只要你的方法论
建立在算法上，每次新 SDK 不会让你从头开始 —— 你只需要 30 分钟
重新定位关键位置，剩下的代码都能复用。

---

*文档结束。配套源工件：本仓库 `doc/` 下其它技术文档；解码原语实现见
`packages/px-common/src/`。*
