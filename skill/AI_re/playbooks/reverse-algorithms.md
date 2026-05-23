# Playbook: 从混淆 SDK 里逆出加密 / 编码算法

> 给一份新的 PX SDK 文件，**怎么找出**它里面用了哪些算法（MD5？HMAC？XOR？ml？...）
> 以及**怎么验证**逆出来的算法是对的？
>
> 这是 `references/locate-by-pattern.md`（grep 模式速查）和 `references/algorithm-chain.md`
> （算法公式）之间的**操作层方法论**。
>
> 预计时间：**1-3 小时**（如果用过这套方法）/ 半天（第一次）

---

## 核心心智模型

混淆器**改不了**算法 — 改了就坏。它只能改：

```
源码：  function md5Init()  { var A = 0x67452301, B = 0xefcdab89, ... }
                            ↓ 混淆器
发布：  function iF(t, n)   { var c = 1732584193, a = -271733879, ... }
                            ↓ 重新混淆
重发：  function M(t, e)    { var c = 1732584193, u = -271733879, ... }
```

变了：函数名、参数名、变量名、行号。

**没变**：

- 算法常量值（`1732584193`、`-271733879`、…）
- 控制流结构（`var = ..., for (...) {...}`）
- 参数个数
- 输入/输出 shape

**结论**：所有逆向工作都建立在"不变的东西"上。

---

## 算法定位三层方法

按精度从高到低：

```
精度高 ⭐⭐⭐⭐⭐  RFC 标准魔法常量          MD5 / HMAC / UUID v1
精度中 ⭐⭐⭐⭐    PX 自选魔数              ml() INT32_MAX、anti-tamper %10+1/+2
精度低 ⭐⭐⭐     算法控制流模式            XOR (charCodeAt^k) / OB split("|")
```

每种 SDK 至少能用 grep 命中其中一两个，然后顺藤摸瓜定位上下文。

---

## 算法 1：MD5（标准 RFC 1321）

### 怎么发现"这是 MD5"

```bash
# 4 个 init 常量任一命中 = 100% 是 MD5
grep -n "1732584193" sdk.js    # = 0x67452301 = init A
grep -n "271733878"  sdk.js    # = 0x10325476 = init D
grep -n "-680876936" sdk.js    # = first round 1 constant
```

**为什么是 MD5**：这 4 个数是 RFC 1321 标准 init values，任何 MD5 实现都有。
即便 PX 改函数名 / 变量名，这 4 个数也改不了 — 改了 MD5 输出就错。

### 怎么验证"我逆对了"

```bash
# 实测：拿 SDK 里的 MD5 算 md5("test")，应等于 098f6bcd4621d373cade4e832627b4f6
node -e "
const crypto = require('crypto');
console.log(crypto.createHash('md5').update('test').digest('hex'));
// 期望: 098f6bcd4621d373cade4e832627b4f6
"
```

如果输出一致 → 你定位的就是标准 MD5，可以直接用 Node 内置 `crypto.createHash('md5')`
替换 SDK 里的混淆实现。

### iFood / Grubhub 实测（证明跨版本）

```js
// iFood 里（变量名: c, a, u, f）
function iF(t,n) {
    var c = 1732584193, a = -271733879, u = -1732584194, f = 271733878;
    // ... round 1 calls iB(c, a, u, f, ..., 7, -680876936)
}

// Grubhub 里（变量名: c, u, s, l）
function M(t,e) {
    var c = 1732584193, u = -271733879, s = -1732584194, l = 271733878;
    // ... round 1 calls C(c, u, s, l, ..., 7, -680876936)
}
```

变量名 a/u/f → u/s/l 换了，**4 个常量字节一样**。

---

## 算法 2：HMAC（标准 RFC 2104）

### 怎么发现"这是 HMAC"

```bash
grep -n "909522486"  sdk.js    # ipad = 0x36363636
grep -n "1549556828" sdk.js    # opad = 0x5C5C5C5C
```

**为什么**：HMAC 的 ipad 和 opad 是 RFC 2104 标准 — 任何 HMAC-MD5 / HMAC-SHA1
实现都有这两个数。

### 上下文结构

```js
// 命中的两个常量必然在相邻两行 + XOR 操作
h[e] = 909522486 ^ r[e],
i[e] = 1549556828 ^ r[e];
```

### 怎么验证

```bash
node -e "
const hmac = require('crypto').createHmac('md5', 'salt').update('msg').digest('hex');
console.log(hmac);
// 期望和 SDK 里同 salt + msg 输出一致
"
```

---

## 算法 3：UUID v1（标准 RFC 4122）

### 怎么发现

```bash
grep -n "122192928e5\|12219292800000" sdk.js
```

**为什么**：`12219292800000` = `(1970 - 1582) × 365.25 × 86400 × 1000`。
RFC 4122 UUID v1 用 1582-10-15 作为 epoch，转换到 Unix epoch 需要这个偏移。
任何 v1 实现都有。

### 上下文（iFood / Grubhub 实测）

```js
// iFood
var p = (1e4 * (268435455 & (f += 122192928e5)) + s) % 4294967296;

// Grubhub（同结构，不同变量名）
var d = (1e4 * (268435455 & (l += 122192928e5)) + f) % 4294967296;
```

附带常量：

- `268435455` = `0x0FFFFFFF` (UUID v1 timeLow 28-bit mask)
- `4294967296` = `2^32` (32-bit wrap)

### 验证

```bash
node -e "
const { v1 } = require('uuid');
console.log(v1());
// 期望 8-4-4-4-12 格式，第二段第 1 位是 '1' (version 1)
"
```

---

## 算法 4：XOR cipher（无 RFC，但有控制流特征）

### 怎么发现

```bash
grep -nE "charCodeAt\([^)]+\)\s*\^|\^\s*[a-z]\.charCodeAt" sdk.js
```

会命中**多处**：

```js
// 处 1: payload 加密
e += String.fromCharCode(n ^ t.charCodeAt(r))

// 处 2: anti-tamper te()
String.fromCharCode(e ^ t.charCodeAt(r))

// 处 3: OB 解码
String.fromCharCode(t.charCodeAt(h) ^ e)
```

### 怎么区分这几处用途

看 XOR 的 right-side 是常量还是变量：

| right-side | 用途 |
|---|---|
| `^ 50` 或 `^ "2"` (ASCII 50) | payload 主 XOR key |
| `^ 10` | padding XOR key |
| `^ <动态变量>` | anti-tamper 的 te() |
| `^ 120` 或 `% 128` 附近 | OB 响应 XOR key |

iFood 用 `50` 当 payload XOR key — 跑下面验证：

```bash
# 假设你抓了真 payload，跟用 XOR(50) 逆向是否能解出有效 JSON
echo "<base64-payload-from-real-capture>" | base64 -d | node -e "
let s = '', t = require('fs').readFileSync(0, 'utf-8');
for (let i = 0; i < t.length; i++)
    s += String.fromCharCode(t.charCodeAt(i) ^ '5'.charCodeAt(0));
console.log(s.slice(0, 100));
"
# 如果开头看到 [{"t": → XOR key 50 确认
```

---

## 算法 5：base91（PX 自定义编码）

### 怎么发现

```bash
grep -c "F@bt" sdk.js
# 应 = 1（命中 base91 字母表起点）
```

完整字母表：

```
F@bt;"m:x3&#LiZ[)TE/}%QD1Iu.6f0R]78|4{zvWC>`$Se(rJ=*c^2_?qOpB,d<AVy~YwoP!+9g5nXhUsNGjaMKHlk
```

**为什么是 base91 标志**：91 个字符（不是 64），自定义打乱顺序。PX 把它写死在
hM 解码器里。3 年没变过。

### 怎么逆出 hM 解码器

直接从 SDK 拷源码（hM 函数 + 字母表常量），不用重写。AI_re 里已有 Node 版：
[`../../../revers/payload.js`](../../../revers/payload.js)。

或者从 SDK 自己读：

```bash
grep -A 20 'F@bt' sdk.js | head -25
# 会显示完整 hM 函数体（base91 解码逻辑）
```

### 验证 hM 解码器

```js
// 拿 hP[0] 字典里的字符串试解码
const { hM } = require('./reverse/payload');
const hP_0 = "B5e4T4AM&6+r9i}DvsKZ$@v]5]~~sT";  // 从 SDK 复制
console.log(hM(hP_0));
// 应解出有意义字符串（比如 navigator API 名 / b64 key 之类）
```

---

## 算法 6：ml() 哈希（PX 自定义，djb2 变种）

### 怎么发现

```bash
grep -nE "31\s*\*\s*[a-z]\s*\+.*charCodeAt" sdk.js
grep -nE "%\s*2147483647" sdk.js
```

两个 grep 命中同一行：

```js
// iFood
n = (31 * n + t.charCodeAt(e)) % 2147483647

// Grubhub
e = (31 * e + t.charCodeAt(n)) % 2147483647
```

### 为什么"31 *"

djb2 哈希的核心是 `hash * 33 + char`，可以写成 `hash << 5 + hash + char`
或简化为 `31 * hash + char`（差 2，但本质一样）。这是 djb2 的代码签名。

`2147483647` = `INT32_MAX` = `0x7FFFFFFF` — 取 32-bit 整数取模。

### 完整 ml() 复现

```js
function ml(input) {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        hash = (31 * hash + input.charCodeAt(i)) % 2147483647;
    }
    return String(hash % 900 + 100);   // 100-999 字符串
}
```

### 用途

`parseInt(ml(TAG)) % 128` = OB 响应的 XOR key。

### 验证

```js
// 拿 SDK 的 TAG 算 ml
console.log(ml('U0MmDhUmOnhXSw=='));   // 应输出 100-999 之间的数字字符串

// 用这个数字 % 128 当 OB XOR key 解响应
const xorKey = parseInt(ml('U0MmDhUmOnhXSw=='), 10) % 128;
console.log('OB XOR key:', xorKey);
// iFood 应为 100
```

---

## 算法 7：PC（HMAC-MD5 + 数字提取）

### 怎么发现

```bash
grep -nE ">=\s*48.*<=\s*57|charCodeAt.*%\s*10" sdk.js
```

命中"数字字符的 ASCII 范围检查"（48-57 是 '0'-'9'）+"mod 10"。

### 算法结构

```js
function pc(payload, salt) {
    // 1. HMAC-MD5
    const hmacHex = hmacMD5(payload, salt);  // 32 hex chars

    // 2. 字符分类
    let digits = '', letters = '';
    for (const c of hmacHex) {
        const code = c.charCodeAt(0);
        if (code >= 48 && code <= 57) {       // '0'-'9'
            digits += c;
        } else {
            letters += (code % 10);            // a-f → ASCII % 10
        }
    }

    // 3. 按偶数下标取
    let pc = '';
    for (let i = 0; i < (digits + letters).length; i += 2) {
        pc += (digits + letters)[i];
    }
    return pc;
}
```

### Salt 怎么找

PC 的 salt 是 `"uuid:tag:ft"` 拼接 — 这要看 SDK 怎么组装 salt 字符串。
grep `':'` 拼接代码附近：

```bash
grep -nE 'uuid.*tag.*ft|join\(.:.\)' sdk.js | head -5
```

### 验证

```js
// 给一个真抓的 payload 和已知 salt，算 PC，应等于 POST 里的 pc= 参数
const realPayload = "...";   // 从抓包提取
const expectedPC = "1234567890";  // POST 里看到的
console.log(pc(realPayload, `${uuid}:${TAG}:${FT}`) === expectedPC);
// true → PC 算法和 salt 都对
```

---

## 算法 8：Anti-tamper（PX 自定义）

### 怎么发现

```bash
grep -nE "%\s*10\s*\+\s*[12]" sdk.js
```

命中 `state.no % 10 + 2` 和 `% 10 + 1` —— 这是 anti-tamper 的标志。

### 算法

```js
// 在 EV2 模板里找 key 和 value 都匹配 /^[0-9:;<=>?@]{15,25}$/ 的字段
// 用 te(state.to, state.no % 10 + 2) 算新 key
// 用 te(state.to, state.no % 10 + 1) 算新 value
// 原位置替换（key 也要换）

function injectAntiTamper(ev2, state) {
    const re = /^[0-9:;<=>?@]{15,25}$/;
    const newKey   = te(state.to, state.no % 10 + 2);
    const newValue = te(state.to, state.no % 10 + 1);
    const out = {};
    for (const [k, v] of Object.entries(ev2)) {
        if (re.test(k) && re.test(v)) {
            out[newKey] = newValue;   // 原位置换 key + value
        } else {
            out[k] = v;
        }
    }
    return out;
}
```

### 验证

```js
// 比对真抓 EV2 和你算的 anti-tamper 对
// 用 state.no, state.to 从同一批 OB#1 解出来的，算 te(...)
const computed = te(state.to, state.no % 10 + 2);
const realKey  = Object.keys(realEv2).find(k => /^[0-9:;<=>?@]{15,25}$/.test(k));
console.log(computed === realKey);  // true → 算对了
```

---

## 算法 9：SID Unicode 隐写（部分 SDK 才有）

### 怎么发现

```bash
grep -nE "917760|0xE0100|fromCodePoint" sdk.js
```

**有命中** → 这 SDK 用 SID 隐写（iFood 用）
**无命中** → 不用（Grubhub 不用）

### 算法

```js
// SID = uuid + 不可见字符（每个数字字符 → U+E0100 + 数字 的 Unicode Tag）
function sidStego(uuid, payload) {
    let invisible = '';
    for (const ch of String(payload)) {
        invisible += String.fromCodePoint(0xE0100 + ch.charCodeAt(0));
    }
    return uuid + invisible;
}
```

### 验证

```js
// 解码真抓 sid 参数，看尾巴部分是不是 0xE0100+ 的 Unicode Tag
const realSid = "abc-123-...<不可见字符串>";
const tail = realSid.slice(36);  // UUID 后面
for (const cp of tail) {
    const code = cp.codePointAt(0);
    console.log(code, String.fromCharCode(code - 0xE0100));
    // 输出: 0xE0131 -> "1", 0xE0137 -> "7" ...
    // 拼起来应该等于某个数字（XOR key "50" 或 cts 时间戳）
}
```

---

## 跨版本稳定性总结

| 算法 | 跨版本稳定特征 | 怎么验证 | 难度 |
|---|---|---|---|
| MD5 | 4 个 RFC init 常量 | `md5("test") == 098f6bcd...` | ⭐ |
| HMAC | ipad/opad 两个 RFC 常量 | 同 Node `crypto.createHmac()` | ⭐ |
| UUID v1 | Gregorian 偏移 `122192928e5` | 跟 npm `uuid` v1 输出一致 | ⭐⭐ |
| XOR | `charCodeAt ^ K` 控制流 | 真 payload 解出 JSON | ⭐⭐⭐ |
| base91 | 字母表起点 `F@bt` | hM 解出 hP 字典字符串有意义 | ⭐⭐ |
| ml() | `31 * + charCodeAt + % 2147483647` | OB 响应能解出 segments | ⭐⭐⭐ |
| PC | `>= 48 .. <= 57` + `% 10` + 偶数取 | 算的 PC == POST 里的 pc | ⭐⭐⭐⭐ |
| anti-tamper | `% 10 + 1/+2` | 跟真 EV2 里 anti-tamper 字段对得上 | ⭐⭐⭐⭐ |
| SID 隐写 | `0xE0100` | 解真 sid 尾巴出有意义数字 | ⭐⭐ |

---

## 标准逆向流程（新 SDK 30 分钟）

```bash
SDK="path/to/new_main.min.js"

# Step 1: 5 个魔法常量全验（确认是 PX SDK）
echo "MD5 init:    $(grep -c 1732584193 $SDK)"
echo "HMAC ipad:   $(grep -c 909522486 $SDK)"
echo "UUID v1:     $(grep -c 122192928e5 $SDK)"
echo "ml() mask:   $(grep -c 2147483647 $SDK)"
echo "base91:      $(grep -c F@bt $SDK)"
# 5/5 = 标准 PX

# Step 2: 直接复用 AI_re/reverse 的 9 个算法模块
# (因为这 5 个魔法常量在 = 同算法 = 直接用现成代码)
ls revers/
# antitamper.js  hash.js  memory.js  ns.js  ob.js
# payload.js     pc.js    sid.js     uuid.js

# Step 3: 实测验证（拿一批真抓包跑回放）
node skill/AI_re/scripts/decode_payload.js  /path/to/request_1.txt
node skill/AI_re/scripts/decode_response.js "<TAG>" /path/to/response_1.json
# 解出有意义 JSON / state → 9 个算法 100% 通用

# Step 4: 算 PC 跟真 POST 里的 pc= 对比
node skill/AI_re/scripts/verify_batch.js samples/<site>/1
# 如果 pc PASS → PC 函数 + salt 算法都通用
```

---

## 如果算法实测不通用怎么办？

**几乎不会发生**（3 年内未见过 PX 改算法），但如果真发生：

| 不通用 | 可能性 | 行动 |
|---|---|---|
| MD5 输出错 | 不可能（RFC 标准） | 你逆向错了，回去看 init 常量 |
| HMAC 输出错 | 不可能（RFC 标准） | 同上 |
| UUID 格式错 | 极低 | 看 Gregorian 偏移 + 28-bit mask |
| XOR key 不是 50 | 中（PX 偶尔换） | 试 10 / 100 / 200 等 |
| ml() 算的 OB XOR key 错 | 中 | 也许是 GT ≠ TAG，找 ml() 真实输入 |
| PC 输出错 | 中（salt 拼法变） | grep 拼接代码看 salt 格式 |
| anti-tamper 验证失败 | 高（PX 偶尔调） | 看是不是 +1/+2 变成 +2/+3 之类 |
| SID 错 | 低 | 看 base codePoint 是不是 0xE0100 |

**实测验证胜过推理**：拿真抓包跑回放，看哪步对哪步错。

---

## 配套资源

| 想看什么 | 去哪 |
|---|---|
| 算法完整公式 | [`../references/algorithm-chain.md`](../references/algorithm-chain.md) |
| 完整 grep 模式索引 | [`../references/locate-by-pattern.md`](../references/locate-by-pattern.md) |
| 9 个算法的可运行 Node 实现 | [`../../../revers/`](../../../revers/) |
| iFood vs Grubhub 算法对照 | [`../../../main/ZH/PX_完整SDK对照逆向方法论.md`](../../../main/ZH/PX_完整SDK对照逆向方法论.md) §2-3 |
| 19 条算法相关坑 | [`../references/gotchas.md`](../references/gotchas.md) |

---

*PX 3 年内从未改过算法常量。建议直接复用 `reverse/` 里的 9 个模块，
新 SDK 上手只需要更新常量（grep 出来）+ 模板（抓 6 批），算法层不动。*
