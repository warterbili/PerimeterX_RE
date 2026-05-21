# 无感 Collector 路径 — 踩坑全集

走 99% 流量的无感模式（`main.min.js` / `init.js`，2 个 collector POST 拿 `_px3`/`_px2`）。
按"协议/编码/算法/state 注入/模板/PC 校验"分组。

按压 Bundle 路径的坑在 [`2_bundle_path.md`](2_bundle_path.md)。

---

## A. 协议 / 编码 / wire format

### #1 ⭐⭐⭐ 解 POST body 时把 base64 的 `+` 替换成空格

**症状**：解码自己抓的 collector POST body（用 cdp-browser / DevTools "Copy as cURL"），EV1 解出来是部分 JSON 然后突然乱码。

**根因**：PX 发的 collector POST body 里，**base64 的 `+` 字符是字面保留的**（不是 `%2B`）。如果用 form-urlencoded 标准的 `+ → space` 替换处理它，base64 就坏了。

**修复**：
```javascript
// ❌ 错（base64 的 + 被吃成空格）
const payload = decodeURIComponent(raw.replace(/\+/g, '%20'));

// ✅ 对（保留字面 +）
const payload = decodeURIComponent(raw);
```

Python 端等价错误：`urllib.parse.unquote_plus(raw)` 错；应该 `urllib.parse.unquote(raw)`。

**来源**：`skill/AI_re/references/gotchas.md` Bug #14

---

### #2 ⭐⭐ UTF-8 vs Latin-1 base64

**症状**：payload 长度差 30+ 字符，PC 不匹配，`{"do":[]}` 拒绝。

**根因**：`Date.toString()` 在中文 locale 含"中国标准时间"。XOR(50) 后某些字符 ≥0x80。UTF-8 1 字符编码为 3 字节，Latin-1 为 1 字节。SDK 用 `encodeURIComponent()` (UTF-8) → `btoa()`。

**修复**：
```javascript
Buffer.from(t, 'utf-8').toString('base64')   // ✅
// 不要 'binary' / 'latin1'
```

**来源**：`skill/AI_re/references/gotchas.md` Bug #2；`ifood-web/collector无感纯算还原/纯算还原.md:254, 832-870`

---

### #3 ⭐⭐ OB 响应解码用 binary 不能 UTF-8

**症状**：ob decoded 出来完全是乱码。

**根因**：OB 响应是**服务器生成**的，**没有**经过 SDK 的 `z()` UTF-8 编码函数。所以是原始二进制流。

**修复**：
```javascript
Buffer.from(ob, 'base64').toString('binary')   // ✅
// .toString('utf-8') ❌ 会把 ≥0x80 字节坏掉
```

**来源**：`ifood-web/collector无感纯算还原/纯算还原.md:313, 870`

---

### #4 ⭐⭐ OB 分隔符是**四**个波浪号 `~~~~`，不是三个

**症状**：OB 响应 split 失败，handler 匹配崩，segments 拿到 0 个。

**根因**：分隔符是 `~~~~`（XOR 之前是 4 个 0x06 字节），不是 `~~~`。

**修复**：`.split("~~~~")`，4 个。

**来源**：`ifood-web/collector无感纯算还原/纯算还原.md:640`；`bundle#1.md:8`；`BUNDLE_COMPLETE_ANALYSIS.md:1983`

---

### #5 ⭐⭐ Handler key 在段首，要 `shift()` 不是 `pop()`

**症状**：handler 匹配返回错误结果，args 字段对不上。

**根因**：每段格式是 `handlerKey|arg1|arg2|...`，key 在最前面。

**修复**：`const handlerKey = fields.shift(); const args = fields;` — 丢掉首个字段（handler 名不能跨版本用，扔掉），剩下是 args。

**来源**：`ifood-web/collector无感纯算还原/纯算还原.md:639`；`BUNDLE_COMPLETE_ANALYSIS.md:1912-1913`

---

### #6 ⭐ URLSearchParams 会把 base64 的 `+` 当空格

**症状**：抓包工具用 URLSearchParams 解析 POST body，base64 的 `+` 变成空格，解码失败。

**根因**：URLSearchParams 实现严格 form-urlencoded 规范（`+ → space`）。

**修复**：自己解析 raw POST body，按 `&` 切分，每个 `key=value` 用 `decodeURIComponent`（不是 `decodeURIComponent` + `+ → space`）。

**来源**：`bundle#1.md:163`；`bundle#2.md:569`；跟 #1 同一类问题不同表现

---

## B. 算法层（payload / PC / OB）

### #7 ⭐⭐⭐ De-interleave 必须从后往前走

**症状**：去交织后的 payload 错乱，splice 删错位置。

**根因**：`splice(offset, 1)` 删掉一个字符后，后面所有字符的索引都左移。从前往后删，第 2 个 offset 就指错位置了。

**修复**：
```javascript
for (let i = offsets.length - 1; i >= 0; i--) {
    arr.splice(offsets[i] - 1, 1);   // ⭐ 减 1（offsets 是 1-indexed）
}
```

**来源**：`ifood-web/collector无感纯算还原/纯算还原.md:632-634`

---

### #8 ⭐⭐⭐ De-interleave offset 是 1-indexed，splice 要减 1

**症状**：去交织漏字符或多删一个，base64 解码失败。

**根因**：PX SDK 的 offset 数组是 1-indexed（PX 用 1 开始计数）；JS 的 `splice` 是 0-indexed。

**修复**：`splice(offsets[i] - 1, 1)`，不是 `splice(offsets[i], 1)`。跟 #7 配合用。

**来源**：`ifood-web/collector无感纯算还原/纯算还原.md:632-634`

---

### #9 ⭐⭐⭐ PC 用的是 PX 自定义 JSON serialize，不是 `JSON.stringify`

**症状**：PC HMAC-MD5 算法正确实现，但服务器返回 "invalid pc"。

**根因**：SDK 的 `it()` 序列化跟 `JSON.stringify` 不同：
- `undefined` → 字面字符串 `"undefined"`（不是 `null`）
- `NaN` / `Infinity` → `"null"`（不是 `NaN`）
- 不删除空 property（保留 key）
- Date 对象格式跟标准不同（非零填充）

**修复**：自己实现 PX serialize 函数，逐字段处理 undefined / NaN / Date / 嵌套对象。见 [`revers/pc.js`](../revers/pc.js)。

**来源**：`ifood-web/collector无感纯算还原/纯算还原.md:256-276`

---

### #10 ⭐⭐ OB XOR key 是动态的（不是常量 100 或 120）

**症状**：写死 `xorKey=120` 解 OB，新 SDK 出来乱码。

**根因**：`xorKey = ml(gt) % 128`，其中 `gt` 是 SDK 里的常量字符串，每次 PX 推新 SDK `gt` 都会变。iFood 当前是 100，Grubhub 是 91，旧 SDK 是 120。

**修复**：从当前 SDK 提取 `gt`，每次会话动态算 `xorKey = ml(gt) % 128`。或者直接用 TAG（很多版本 `gt === TAG`）：见 [`revers/ob.js`](../revers/ob.js)。

**来源**：`BUNDLE_COMPLETE_ANALYSIS.md:1979-1982`；`ifood-web/collector无感纯算还原/纯算还原.md:1284`

---

### #11 ⭐⭐ djb2 hash 前要 `parseInt(state.no)`

**症状**：fingerprint hash 字段值变成 `NaN`，collector 拒绝。

**根因**：`state.no` 是字符串 `"1779263..."`；`Math.floor(string / 1000)` = `NaN`。

**修复**：`Math.floor(parseInt(serverNo) / 1000)` 或 `Math.floor(Number(serverNo) / 1000)`。

**来源**：`ifood-web/collector无感纯算还原/纯算还原.md:337, 1373, 1725`

---

### #12 ⭐⭐ Collector#1 用默认时间戳做交织 key

**症状**：Collector#1 payload 解码后内容是乱的，serverNo 还没存在。

**根因**：Collector#1 发出去时 ob#1 还没回来，所以 `state.no` 是 undefined。SDK 用硬编码 fallback `"1604064986000"`（2020-10-30T17:16:26Z，PX 脚本固定的"魔法时间"）做交织。

**修复**：
```javascript
const interleaveKey = state.no || "1604064986000";
```

**注意**：这个 fallback 跨多个 PX 客户都是一样的值。

**来源**：`ifood-web/collector无感纯算还原/纯算还原.md:88-89`

---

### #13 ⭐⭐ Collector#2 必须用真 serverNo，不能继续用 fallback

**症状**：Collector#1 拿到 ob#1 后，Collector#2 继续用 `"1604064986000"` 交织 → PC 校验失败。

**根因**：Collector#2 SDK 已经从 ob#1 拿到了 `state.no`，必须用真实 serverNo 做交织 key。

**修复**：拿到 ob#1 后 extract `state.no`，所有后续 POST 用这个值做 payload 交织。

**来源**：`bundle#2.md:573`

---

## C. State 注入 / EV2 b64 key 映射

### #14 ⭐⭐⭐ `state.no` 类型错误（最致命的坑，~90% 新手中招）

**症状**：服务器 `do:null`（接受 PC）但 ob 仅 2 段，永远不下发 `_px3`/`_px2`。

**根因**：
- ob decoder 解出 `state.no` 是 string `"1779131754075"`
- SDK 期望 number `1779131754075`
- 我们的 serialize 给 string 加引号 → payload 比 SDK 多 2 字节
- 服务器 PC 校验通过（因为我们也是同样 serialize），但**对实际事件值的语义校验**发现 timestamp 字段是字符串 = bot

**修复**：
```javascript
// iFood:
d['RTEwewNQMUg='] = parseInt(ctx.state.no);

// Grubhub:
d['UT0ndxdcJUQ='] = parseInt(ctx.state.no);
```

**通用规则**：**从 ob decoder 出来的所有数字字符串，引用到 EV2 字段时都先 parseInt**。

**来源**：`skill/AI_re/references/gotchas.md` Bug #1；多处档案重复确认

---

### #15 ⭐⭐⭐ `state.appId` 必须每次会话从 ob#1 提取，不能模板硬编码

**症状**：服务器接受 PC 但没有 _px3 下发。

**根因**：每个 ob#1 给的 `appId` 不一样（如 `d85mksfkqf1c73d7p7tg` vs `d85maqv7fdnc73boge5g`）—— 这是**会话级**的临时 appId，不是站点固定的 init appId。

**修复**：
```javascript
// iFood：
d['Xi5rJBtKaB4='] = state.appId;
// Grubhub：
d['CXV/P0wRfwU='] = state.appId;
```

**注意**：跟 #16 init AppID 是两回事。

**来源**：Desktop/新建文件夹/px-reverse-skill/references/gotchas.md:65-76

---

### #16 ⭐⭐ Init AppID ≠ Collector AppID（两个不同的 AppID）

**症状**：Bundle 请求一直 400，collector 响应能解但 appId 字段对不上。

**根因**：iFood init `appId` = `PXO1GDTa7Q`（POST body 的 `appId=` 用这个），但 ob 响应里的 `state.appId` = 临时 `d85mksfkqf1c73d7p7tg`（注入到 EV2 d 字段用这个）。两者并存、不能混。

**修复**：分开存：
- POST body 的 `appId=` 参数 → 用 init AppID
- EV2 d 字段里的 appId 槽位 → 用 ob#1 的 state.appId

**来源**：`ifood-web/collector无感纯算还原/纯算还原.md:6-11, 38-50`

---

### #17 ⭐⭐⭐ Anti-tamper 删-加破坏字段位置

**症状**：所有字段值都对，但服务器仍然不下发 cookie。

**根因**：
```javascript
delete d[oldKey];     // 删除
d[newKey] = newVal;   // newKey 被追加到对象末尾
```
JS 对象的迭代顺序按"插入顺序"。这样改后 newKey 在末尾，原 anti-tamper 位置变了，serialize 出的字节流跟 SDK 的不一样。

**修复**：保留位置重建字典
```javascript
const out = {};
for (const k of Object.keys(d)) {
    if (k === oldKey) out[newKey] = newVal;
    else out[k] = d[k];
}
```

**来源**：`skill/AI_re/references/gotchas.md` Bug #3；多处重复

---

### #18 ⭐⭐ Anti-tamper 识别 regex 漏字符（缺 `:` 和 `;`）

**症状**：模板里的 anti-tamper key 被识别不出来，被跳过没替换。

**根因**：Anti-tamper key/value 是 `state.to`（字符串）⊕ `(state.no % 10 ± 1)`。state.to 是数字 `"0123456789"`，XOR 1-12 得到 ASCII 0x30-0x3F = `"0123456789:;<=>?"`。

**修复**：regex 用 `/^[0-9:;<=>?@]{15,25}$/`（不要漏 `:` 和 `;`）。

**来源**：Desktop/新建文件夹/px-reverse-skill/references/gotchas.md:54-63

---

### #19 ⭐⭐⭐ `state.*` → EV2 b64 key 映射**每个站点完全不同**

**症状**：Collector 都返 200、state 提取正确，但拿不到 cookie 或后续 API 仍 403。

**根因**：EV2 有 4-5 个字段直接来自 `state.*`，但每个站点用**不同的 b64 key**。值是 13 位数字 ≠ 它就是 timestamp —— 看起来像 timestamp 实际可能是 session token。**按类型猜会猜错。**

**对照表**：

| 语义 | iFood key | Grubhub key |
|---|---|---|
| `state.no` | `RTEwewNQMUg=` | `UT0ndxdcJUQ=` |
| `state.to` | `FCAhKlJCIxk=` | `UBxmVhZ+Z2U=` |
| `state.appId` | `Xi5rJBtKaB4=` | `CXV/P0wRfwU=` |

**修复**：用跨批值匹配（不是类型猜）—— 见 [`stample/*/script/find_state_keys.py`](../stample/) 和 [`skill/AI_re/scripts/find_state_keys_in_ev2.py`](../skill/AI_re/scripts/find_state_keys_in_ev2.py)。

**来源**：Desktop/新建文件夹 (3)/docs/_gotchas_grubhub.md:25-41

---

### #20 ⭐⭐ EV1 和 EV2 不能共用同一 b64 key（即使同语义）

**症状**：所有字段类型/值都对、PC 验证过，但 cookie 在保护端点（如 /auth）仍被拒。字段数比浏览器多 1。

**根因**：**同语义在 EV1 vs EV2 用不同 b64 key**。Grubhub 的 `/ns duration`：
- EV1 中 = `DFQ2Ekk4PSU=`
- EV2 中 = 没有！

把 iFood 的"EV1/EV2 都有 duration"逻辑直接搬到 Grubhub → EV2 多出一个不该有的 key → mismatch。

**修复**：**EV2 字段集只能是模板里有的**，绝对不增不减。assert：
```javascript
assert(JSON.stringify(Object.keys(myEv2).sort()) === JSON.stringify(Object.keys(template).sort()));
```

**来源**：Desktop/新建文件夹 (3)/docs/_gotchas_grubhub.md:45-66

---

### #21 ⭐⭐ sid 用 `state.pxsid` 不是 session uuid

**症状**：sid 参数跟 SDK 的不一致，服务器拒绝。

**根因**：SDK 用 ob#1 返回的 `state.pxsid`（站点级 session ID）做 sid，不是 HTTP session 的 uuid。

**修复**：
```javascript
sid = generateSid(state.pxsid, String(state.no));   // 不是用 uuid
```

**来源**：Desktop/新建文件夹/px-reverse-skill/references/gotchas.md:78-87

---

### #22 ⭐⭐ sid 在不同请求阶段格式不同

**症状**：sid 在 Bundle#2 被拒，藏的 timestamp 验证失败。

**根因**：
- **Collector#1**：`sid = uuid`（纯 UUID）
- **Bundle#1**：`sid = uuid`（同上）
- **Bundle#2+**：`sid = uuid + hh(serverNo)`（追加 Unicode Tag Char 隐写的 timestamp）

**修复**：按 POST 阶段决定 sid 格式；只在 Bundle#2+ 加 Unicode 隐写。

**来源**：`bundle#1.md:263-271`

---

### #23 ⭐⭐ HMAC 字段的 UA 必须跟 HTTP header 的 UA 一模一样

**症状**：HMAC 字段算对了但服务器拒绝。

**根因**：HMAC(uuid, UA) 的 UA 必须 byte-for-byte 等于 HTTP `User-Agent:` 头的 UA。

**修复**：在 generator 顶部定义单一 `DEFAULT_UA` 常量，HMAC 算和 HTTP 请求都用这一个变量。

**来源**：Desktop/新建文件夹/px-reverse-skill/references/gotchas.md:112-127

---

### #24 ⭐⭐ 字段类型不只是 state.no — 多个字段都有 number vs string 要求

**症状**：变化大，通常是 403 + 看起来值都对。

**根因**：模板里每个字段的 `typeof` 是 authority，不能改：
- `initTime` / `sendTime` / `performance.now()` → 必须 number
- `uuid` / `appId` / `FCAhKlJCIxk` → 必须 string
- `state.no` 注入到 EV2 → number（坑 #14）
- 时间戳类（`Date.now()`）→ number

**修复**：拿模板里的 typeof 当 ground truth，不要随便 `String()` / `parseInt`。

**来源**：Desktop/新建文件夹/px-reverse-skill/references/gotchas.md:129-149

---

## D. /ns + 时序

### #25 ⭐⭐ `/ns` 是异步的，Collector#1 时 /ns 还没回 → sm/duration 是 null/0

**症状**：Collector#1 payload 里某两个字段是 null/0，"fingerprint mismatch"。

**根因**：`/ns?c={uuid}` 是异步请求。Collector#1 通常在浏览器加载后 ~200ms 就发，/ns 大概率还没回。SDK 在这种情况下把 sm 字段发 `null`、duration 发 `0`。

**修复**：
- Collector#1：sm = null、duration = 0 → **正常**，照搬
- Collector#2 / Bundle：用 /ns 真实返回值

**来源**：`ifood-web/collector无感纯算还原/纯算还原.md:73-78`

---

### #26 ⭐⭐ Error stack 行号要跟 SDK 版本匹配

**症状**：Collector#2 被拒，error stack hash 算不对。

**根因**：SDK 故意触发 `TypeError: Cannot read properties of null (reading '0')`，把 stack trace 当 fingerprint 字段。stack 里的行号（如 `_r @ main.min.js:1208:21`）必须跟目标 SDK 的混淆代码行号一致。

**修复**：从浏览器跑目标 SDK 真实抓出 stack；不要拼凑、不要用旧版的行号。

**来源**：`ifood-web/collector无感纯算还原/纯算还原.md:133, 1666-1700`

---

### #27 ⭐ `cts` 字段类型在不同 POST 阶段变化

**症状**：Bundle#2 验证失败，cts 类型不对。

**根因**：
- Collector / Bundle#1：`cts = UUID 字符串`
- Bundle#2：`cts = 毫秒 timestamp` (number-as-string)

**修复**：按阶段切换：
```javascript
cts = (phase === 'collector' || phase === 'bundle1') ? state.cts : Date.now().toString();
```

**来源**：`bundle#1.md:282-289`

---

## E. EV 模板 + 校验保护

### #28 ⭐⭐ EV1/EV2 b64 key 跨 SDK 版本会全部重排

**症状**：硬编码的 b64 key 跟新 SDK 的真 payload 对不上，解出来字段是错的。

**根因**：229 个 b64 key 是 SDK 里通过"数组 + 旋转 + offset 查表"动态生成的，PX 每次推 SDK 都换。

**修复**：**不要硬编码 key 映射**。每次 SDK 升级用 `extract_hQ.js` 从新 SDK 提取字典，或跑 `find_state_keys.py` 做跨批值匹配。

**来源**：`ifood-web/collector无感纯算还原/纯算还原.md:454-455`；详见 [`4_sdk_drift.md`](4_sdk_drift.md)

---

### #29 ⭐ Handler call chain 里参数被故意打乱（不要按顺序信）

**症状**：PoW solver 算出错的 hash，挑战永远解不出。

**根因**：handler 接收 `(t,e,n,r,a)` 但内部转调 `Bs(n,e,r,a==="true")` —— 第 1 个变第 3 个、`a` 被字符串化布尔判断。**故意混淆**。

**修复**：debugger 跟到真正调用点，按实际签名映射，不要按形参顺序信。

**来源**：`BUNDLE_COMPLETE_ANALYSIS.md:1919-1921, 1934-1936`

---

### #30 ⭐ Python 端 sid 含 Unicode Tag Chars，被 `requests` 默认编码截断

**症状**：Python 实现 sid 算法正确，但发出去服务器还是拒；用 Node 等价代码就过。

**根因**：sid 含 Plane 14 Unicode Tag Chars（U+E0100+），是"不可见"字符。Python 的 `requests` 默认按 URL 标准编码，有些版本会丢失或转 `?`。Chrome 的 "Copy as cURL" 也会丢。

**修复**：
- 用 `urllib.parse.quote_plus(sid, safe='')` 显式编码
- 验证 `len(sid.encode('utf-8'))` 跟期望字节数一致
- **不要用 Chrome "Copy as cURL"** 抓 sid

**来源**：Desktop/新建文件夹/px-reverse-skill/references/gotchas.md:101-111

---

### #31 ⭐ `state.appId` 跟 init AppID 不是一回事（再次确认）

(跟 #16 的"两个 AppID 并存"配合用：init AppID 在 POST 参数；state.appId 在 EV2 d 字段)

---

## F. 端点 / 协议路径

### #32 ⭐ iFood `/v2/cardstack` 走严格 WAF，`/v1` 不走

**症状**：`/v2/cardstack/search/home` 一直 403（Cloudflare 拒），同样的请求体改成 `/v1` 就过。

**根因**：iFood 给 `/v2` 路由配了严格 WAF，但 `/v2` 实际已经废弃；活跃的是 `/v1`。

**修复**：业务 API 用 `/v1/cardstack/search/home`，永远不用 `/v2`。

**来源**：`ifood-web/pentest_api/doc/02_ifood_risk_control_analysis.md:283-286`

---

## G. Cookie 生命周期

### #33 ⭐⭐ `_px3` / `_px2` Cookie TTL 中途过期，业务 API 静默失败

**症状**：长跑（≥10 分钟）任务：前面几十次业务 API 请求都正常，突然开始全失败 —— **不报错，只是数据空 / 重定向到挑战页**。代码没变、IP 没变。

**根因**：`_px3` / `_px2` 有 TTL（iFood 默认 330s、Grubhub 默认 500s，**写在 OB#2 的 `set_cookie` segment 里**）。过期后业务 API 还在用旧 cookie，PX 后端识别出 → 重新走挑战流程。但你的 generator 不知道，照旧发请求。

**修复**：
1. 从 OB#2 set_cookie 段提 TTL，记 `cookie.expiresAt = Date.now() + ttl * 1000`
2. 每次业务 API 前查：`if (Date.now() > cookie.expiresAt - 30_000) await refreshCookie()`（提前 30s 刷）
3. 长跑任务里至少每 5 分钟主动重新跑一次 collector 流程

**通用规则**：cookie 是会话票据，不是永久身份。**任何长跑任务都要有 refresh 逻辑**。

**来源**：`perimeterX_Re/docs/07_gotchas/14_cookie_ttl.md`

---

*跟按压 Bundle 路径的坑见 [`2_bundle_path.md`](2_bundle_path.md)*
