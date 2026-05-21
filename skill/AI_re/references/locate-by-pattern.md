# 在任意 SDK 版本中重新定位每个算法 / 函数 / 字段

> ⚠️ **行号不可信** — PX 每次推新版 SDK，行号都会全部错位。
> 本文档**只列 grep 模式 / 特征常量 / 函数特征**，这些跨版本稳定。
>
> 配合本文档的 grep 输出 + `references/algorithm-chain.md` 的公式，
> 你可以在任意新版 SDK 上 30 分钟内重新定位全部关键代码。

---

## 0. 基础原则

**搜索目标排序（按抗混淆能力）**：

| 优先级 | 类型 | 为什么稳定 | 示例 |
|---|---|---|---|
| ⭐⭐⭐ | **算法魔法常量** | 必须保持原值才能算出正确结果 | `1732584193` (MD5 init), `122192928e5` (UUID v1) |
| ⭐⭐⭐ | **协议字符串** | 服务端要求的协议 | `"~~~~"`, `"/api/v2/collector"`, `"x-www-form-urlencoded"` |
| ⭐⭐⭐ | **浏览器 API 名** | 调用 API 必须用真名 | `navigator.platform`, `performance.now` |
| ⭐⭐ | **Base64 串** | 短期内不会全部重洗 | `"U0MmDhUmOnhXSw=="` (TAG) |
| ⭐ | **代码结构特征** | 混淆器一般不改控制流 | `split("\|").shift()` |
| ✗ | 变量/函数名 | 每次混淆全变 | `hQ`, `jt`, `Dd` 不可靠 |
| ✗ | 行号 | 每次发布都错位 | "Line 775" 不可靠 |

---

## 1. 加密原语定位

### 1.1 MD5 — 搜 init 常量

```bash
grep -nE "1732584193" main.js
# 命中行格式: var ... = 1732584193, ... = -271733879, ... = -1732584194, ... = 271733878
```

**为什么稳定**: 这 4 个数是 MD5 的 RFC 1321 标准 init 值（A/B/C/D），任何 MD5 实现都有。

### 1.2 HMAC — 搜 ipad/opad

```bash
grep -nE "909522486" main.js     # ipad: 0x36363636
grep -nE "1549556828" main.js    # opad: 0x5C5C5C5C
```

**为什么稳定**: HMAC RFC 2104 标准 pad mask。

### 1.3 XOR cipher — 搜 charCodeAt + ^

```bash
grep -nE "charCodeAt\([^)]+\)\s*\^|\^\s*[a-z]\.charCodeAt" main.js
```

会命中多处。看上下文：
- `^ 50` → payload XOR key
- `^ 10` → padding key XOR
- `^ <动态>` → anti-tamper te()

### 1.4 base64 UTF-8 编码 — 搜 "0x" + n 模式

```bash
grep -nE 'String\.fromCharCode\("0x"\s*\+' main.js
# 或者搜模式: encodeURIComponent + replace(%XX → fromCharCode)
grep -nE 'encodeURIComponent.*replace.*%' main.js
```

**为什么稳定**: PX 的 `z()` 函数永远用 `btoa(encodeURIComponent(t).replace(/%([0-9A-F]{2})/g, ...))` 这一固定模式来做 UTF-8 base64。

### 1.5 UUID v1 — 搜 Gregorian 偏移

```bash
grep -nE "122192928e5|12219292800000" main.js
```

**为什么稳定**: `(1970 - 1582) × 365.25 × 24 × 3600 × 1000` 是 RFC 4122 UUID v1 时间偏移，任何 v1 实现都有。

---

## 2. PX 自定义算法定位

### 2.1 ml() hash — djb2 with INT32_MAX

```bash
grep -nE "31\s*\*\s*[a-z]\s*\+.*charCodeAt" main.js
grep -nE "%\s*2147483647" main.js
```

特征：`(31 * acc + charCodeAt(i)) % 2147483647`。`2147483647` = `INT32_MAX`，是 ml 函数标志。

### 2.2 ob 分段处理器 — 搜 split("|") 模式

```bash
grep -nE 'split\("\|"\)' main.js
# 通常紧跟 .shift() 或 [0] 取 handler 字节
grep -nE 'split\(.~~~~.\)' main.js   # ob 分段分隔符
```

**为什么稳定**: `~~~~` (4 个波浪号) 和 `|` 是 PX 协议格式，写死在服务端，客户端必须用同一个。

### 2.3 set_cookie handler — 搜 "_px3" 或 "bake"

```bash
grep -nE '"bake"|jb\("YmFrZQ=="\)|atob\("YmFrZQ=="\)' main.js
# YmFrZQ== 是 "bake" 的 base64
grep -nE '"_px3"' main.js
```

set_cookie handler 一般紧跟 `bake` 标志。

### 2.4 PC 计算 — 搜 HMAC + 数字提取

```bash
# PC 公式: digits = chars in '0'-'9' (ASCII 48-57), letters → a%10
grep -nE ">=\s*48.*<=\s*57|charCodeAt.*%\s*10" main.js
# 找紧跟 HMAC-MD5 hex 的代码块
```

### 2.5 SID Unicode 隐写 — 搜 Plane 14 Tag Char

```bash
grep -nE "917760|0xE0100|fromCodePoint" main.js
```

**为什么稳定**: `0xE0100` (= 917760) 是 Unicode Plane 14 Tag Characters 起点。

### 2.6 anti-tamper — 搜 % 10 + 1 / % 10 + 2

```bash
grep -nE "%\s*10\s*\+\s*[12]" main.js
```

特征：用 `state.no % 10 + 1` 和 `+ 2` 生成动态 XOR 强度。

### 2.7 djb2 hash 变体 (Kt)

```bash
grep -nE "<<\s*5\)\s*-\s*[a-z]" main.js
# 特征: (e << 5) - e + ...
```

### 2.8 hash 字段算法 — 搜 2863

```bash
grep -nE "2863" main.js
grep -nE "charCodeAt\(9\)" main.js
# vid.charCodeAt(9) * 2863 等模式
```

---

## 3. 协议常量定位

### 3.1 collector 端点

```bash
grep -nE "/api/v2/collector|/b/s" main.js
grep -nE "px-cloud\.net" main.js
```

主机名总是 `collector-{appId小写}.px-cloud.net`。

### 3.2 /ns 测速端点

```bash
grep -nE "tzm\.px-cloud\.net|/ns\?" main.js
```

### 3.3 TAG / APP_ID / BI 常量

```bash
# 一般 4 个常量打包在一行（var jE = TAG, jF = FT, jG = APP_ID, jH = BI）
# 任意搜其中一个就能定位整组
grep -nE 'var\s+\w+\s*=\s*"[A-Za-z0-9+/=]{12,}=="' main.js | head -5
# 然后用本站点已知的 APP_ID 验证
grep -nE '"PXO1GDTa7Q"' main.js  # 把这里换成目标站点的 appId
```

### 3.4 默认时间戳 fallback

```bash
grep -nE "1604064986" main.js
# 这是 PX 写死的 fallback timestamp (2020-10-30)
```

---

## 4. 入口/调度函数定位（最难，靠形状）

### 4.1 hQ 查表函数 (字符串解码器)

```bash
# 找 hP 数组 (一般是文件中最长的数组字面量)
grep -nE ',\s*[a-zA-Z]{1,3}\s*=\s*\[' main.js | head -20
# hM 解码器特征 (base91 字符集)
grep -nE 'F@bt' main.js
# hQ 函数特征 (查表 + cache)
grep -nE 'void\s+0\s*===.*\?.*=' main.js | head -10
```

### 4.2 ob 分发主函数 (yU / 等价物)

模式：循环 → split('~~~~') → split('|') → shift handler → 查表注册 → apply。

```bash
grep -nE 'split\("\|"\)' main.js -A 5 | grep -E 'apply|call' | head -5
```

### 4.3 事件构造主入口 (mh / 等价物)

特征：构造 `payload=` `appId=` `tag=` `uuid=` `ft=` 等参数。

```bash
grep -nE '"payload="|"appId="' main.js
grep -nE '"&pc="|"&cs="|"&sid="' main.js
```

### 4.4 指纹采集主入口 (Dd / 等价物)

特征：连续调用 ev(t), nv(t), av(t), ov(t), iv(t), cv(t), $d(t), tv(t) 等子函数。

```bash
# 找连续短名函数调用块
grep -nE '\b[a-z]{1,3}\(t\);\s*[a-z]{1,3}\(t\);\s*[a-z]{1,3}\(t\)' main.js | head -5
```

---

## 5. ev1/ev2 字段定位 — 5 种手段

### 手段 A：解 hQ 字典反查（覆盖 50%）

```bash
node scripts/extract_hQ.js main.js hQ_map.json
# 生成的 hQ_map.json 含 1000+ 条 N→字符串映射
# 找你的 base64 key 对应的 N，再 grep hQ(N)
grep -nE "hQ\(\s*N\s*\)" main.js   # N 是反查得到的数字
```

### 手段 B：搜明文 ["KEY="]（覆盖 40%）

```bash
grep -nE '"RTEwewNQMUg="' main.js   # 直接用字段 base64
```

### 手段 C：搜值来源 API（覆盖环境字段）

```bash
# 解码后值是 "Win32" → 搜 navigator.platform
grep -nE 'navigator\.platform' main.js
# 值是 1920 → 搜 screen.width
grep -nE 'screen\.width|screen\[' main.js
# 值是 memory 数字 → 搜 performance.memory
grep -nE 'performance\.memory' main.js
```

混淆器**不能**改浏览器 API 名（改了就不能调用了），所以这些都能搜到。

### 手段 D：搜算法魔法常量（覆盖 PC/HMAC/hash 字段）

| 字段语义 | 魔法常量 / 模式 |
|---|---|
| HMAC(uuid, UA) | `iR(oB(), ...)` 或类似（紧跟 UA 变量） |
| performance.now | `performance.now` 或 `qQ()` 类似命名 |
| Date.toString | `new Date().toString()` 或 `Date.prototype.toString` |
| anti-tamper | `% 10 + 2` 和 `% 10 + 1` |
| hash 字段 | `2863` 和 `charCodeAt(9)` |
| sid 隐写 | `0xE0100` / `917760` |

### 手段 E：跨样本 diff 反推（兜底）

6+ 批样本对每个字段做 diff：
- 同值 → STATIC，直接抄
- 变值 → DYNAMIC，分析变化模式（时间戳？随机？HMAC？）
- 部分批次有 → CONDITIONAL，session-state 相关

```bash
node scripts/diff_samples.js event_json batch1 batch2 ... --out diff.json
node scripts/probe_dynamic.js diff.json hQ_map.json main.js
```

---

## 6. Handler 跨版本对照（按形状匹配）

⚠️ wire 字节（如 `o111oo1o` / `0lll000l`）每次 SDK 升级都可能变 — **不要用 handler 名识别**，用参数形状。

| handler 语义 | 形状特征 | state 字段 |
|---|---|---|
| server timestamp | 1 arg, `/^1[5-9]\d{11}$/` (13 位毫秒) | `state.no` |
| challenge_hash | 1 arg, `/^[0-9a-f]{64}$/` (SHA-256) | `state.qa` |
| vid | 3 args, UUID + 数字 + flag | `state.vid` |
| cts | 2 args, UUID + flag | `state.cts` |
| pxsid | 1 arg, UUID | `state.pxsid` |
| session_id (to) | 1-2 args, `/^\d{16,}$/` | `state.to` |
| status code | 1 arg, `/^\d{3}$/` | `state.ao` |
| **set_cookie** | **4+ args, `/^_?px/i` 开头** | **`state.px3 = {name, value, ttl}`** |
| app_id | 1 arg, `/^[a-z0-9]{12,30}$/` | `state.appId` |
| control_flag | 1 arg, `/^[a-z]{2,4}$/` | `state.jf` |
| o111val | 1 arg, `/^\d{4,5}$/` | `state.o111val` |

详见 `handler-table.md`。

---

## 7. 标准定位流程（新 SDK 上手）

```
1. 下 main.js (~500 KB)
   curl https://client.px-cloud.net/<APPID>/main.min.js > main.js

2. 跑 extract_hQ.js
   node scripts/extract_hQ.js main.js hQ_map.json
   → 1000+ 条字典

3. 跑 lookup_keys.js
   node scripts/lookup_keys.js hQ_map.json main.js <batch1.ev2>.json
   → 每个字段 via hQ / plain / not_found

4. 对 not_found 字段，挨个用本文档手段 C/D 找

5. 跑 diff_samples + probe_dynamic
   → 33 DYNAMIC 字段定位

6. 抓 ev1/ev2 模板（cold visit 一次性抓）

7. 写 px_cookie.js: 算法层照 algorithm-chain.md，字段用模板 + DYNAMIC 覆盖

8. 测 10 次。如果 _px3 取不到，按 gotchas.md 顺序排查
```

**整个流程不依赖任何行号，只依赖 grep 模式 + 形状匹配 + 值对比 — 跨版本稳定。**
