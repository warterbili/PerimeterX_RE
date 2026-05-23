# PX 逆向踩坑清单（14 条，2026-05-20 实测追加 Bug #14）

> 配套阅读 <!-- removed broken link: ../../../docs/zh/_ev1_ev2_unified_reference.md -->
> 配套阅读 <!-- removed broken link: ../../../docs/zh/18_methodology.md -->
>
> ⭐ 标记的是**真实付出过 debug 时间**的坑，不是"可能出错"的列表。

## ⭐⭐⭐ Bug #14（新发现 2026-05-20）: 解 POST body 时把 base64 的 `+` 替换成空格

**症状**: 解码自己抓的 collector POST body（用 cdp-browser / DevTools "Copy as cURL"），EV1 解出来是部分 JSON 然后突然乱码。

**根因**: PX 发的 collector POST body 里, **base64 的 `+` 字符是字面保留的**（不是 `%2B`）。如果你用 form-urlencoded 标准的 `+ → space` 替换处理它, base64 就坏了。

```javascript
// ❌ 错（base64 的 + 被吃成空格, b64 decode 后字节流错位）
const payload = decodeURIComponent(raw.replace(/\+/g, '%20'));

// ✅ 对（保留字面 +）
const payload = decodeURIComponent(raw);
```

Python 端等价错误：`urllib.parse.unquote_plus(raw)` (做了 `+ → space`); 应该 `urllib.parse.unquote(raw)`。

**通用规则**: 解 PX collector POST 用**纯 URI decode**, 不做 form-style 处理。

---

## ⭐⭐⭐ Bug #1: state.no 类型错误 (最致命)

**症状**: 服务器 `do:null` (接受 PC) 但 ob 仅 2 段, 永远不下发 _px3

**根因**:
- ob decoder 解出 `state.no` 是 string `"1779131754075"`
- SDK 期望 number `1779131754075`
- 我们的 serialize 给 string 加引号 → payload 比 SDK 多 2 个字节
- 服务器 PC 校验通过 (因为我们也是同样 serialize), 但**对实际事件值的语义校验**看出 timestamp 字段是字符串 = bot

**修复**:
```javascript
d['RTEwewNQMUg='] = parseInt(ctx.state.no);  // ⭐ 一定要 parseInt
```

**通用规则**: **从 ob decoder 出来的所有数字字符串，引用到 ev2 字段时都先 parseInt**。

## ⭐⭐ Bug #2: UTF-8 vs Latin-1 base64

**症状**: payload 长度差 30+ 字符, PC 不匹配, `{"do":[]}` 拒绝

**根因**: `Date.toString()` 在中文 locale 含 "中国标准时间"。XOR(50) 后某些字符 ≥0x80。UTF-8 1 字符编码为 3 字节，Latin-1 为 1 字节。

**修复**:
```javascript
function b64encode(t) { return Buffer.from(t, 'utf-8').toString('base64'); }
//                                              ^^^^^^^ 必须 UTF-8
```

## ⭐⭐ Bug #3: anti-tamper 字段位置破坏

**症状**: 所有字段值都对，但服务器仍然不下发 _px3

**根因**: `delete d[old_key]; d[new_key] = val` 在 JS 中会把 new_key 追加到对象末尾，**改变字段顺序**。

**修复** (重建字典保持顺序):
```javascript
var newD = {};
for (var k of Object.keys(d)) {
    if (isAntiTamperKey(k, d[k])) {
        newD[new_at_key] = new_at_val;  // 占据原位置
    } else {
        newD[k] = d[k];
    }
}
return newD;
```

## ⭐ Bug #4: anti-tamper 正则范围漏

**症状**: 模板里的 anti-tamper key 没被识别为 anti-tamper

**根因**: anti-tamper key 字符是 state.to (0-9) ⊕ (1-12)，结果范围是 0x30-0x3F = `"0123456789:;<=>?"`。正则只覆盖 `[0-9<=>?@]` 漏了 `:` 和 `;`。

**修复**:
```javascript
const ANTI_TAMPER_RE = /^[0-9:;<=>?@]{15,25}$/;
```

## ⭐ Bug #5: state.appId 用模板写死

**症状**: 接受 PC 但不下发 _px3

**根因**: 每次 ob#1 给的 appId 不同（如 `d85mksfkqf1c73d7p7tg` vs `d85maqv7fdnc73boge5g`）。如果用模板捕获时的固定值，与当前 session 不一致。

**修复**:
```javascript
d['Xi5rJBtKaB4='] = state.appId;  // 来自 ob#1
```

**通用规则**: **所有以 state.* 命名的字段，都必须从当前 ob 解出来，不能用模板**。

## ⭐ Bug #6: SID 用错 UUID

**症状**: sid 参数与 SDK 不一致

**根因**: 用了 session uuid，但 SDK 用的是 `state.pxsid` (从 ob#1 拿)。

**修复**:
```javascript
sid = state.pxsid + hh(String(state.no));
```

## ⭐ Bug #7: OB 解码用 utf-8

**症状**: ob 解码出来全是乱码

**根因**: SDK 生成的 ob 字段是服务端用 binary 编码的，**不经过** SDK 的 z() 函数 (UTF-8)。

**修复**:
```javascript
var decoded = Buffer.from(ob, 'base64').toString('binary');  // 必须 binary
// 错: .toString('utf-8')
```

## ⭐ Bug #8: 把 sid 当 Python 字符串传

**症状**: Python 用 requests 发请求, server 拒绝

**根因**: sid 含 Unicode Tag Characters (U+E0100+)，bash 终端 / 某些 HTTP 客户端会丢失这些不可见字符。

**修复**:
- 检查 `len(sid.encode('utf-8'))` 是不是预期的 字节数
- Python requests: 用 `urllib.parse.quote_plus` 转义后塞进 URL 参数
- 不要用 Chrome "Copy as cURL"，会丢字符

## ⭐ Bug #9: UA 不一致

**症状**: HMAC 字段计算正确但服务器拒绝

**根因**: HMAC(uuid, UA) 的 UA 和 HTTP `User-Agent` header 必须**字符串完全相同**。

**修复**:
```javascript
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...';

// HMAC 用这个 UA
d['M2MGKXUOBB8='] = hmacMD5(uuid, DEFAULT_UA);

// HTTP header 也用同一个
headers['User-Agent'] = DEFAULT_UA;
```

## ⭐ Bug #10: 字段类型其他错误

类似 Bug #1，**还有几个字段也容易类型错**:

| 字段 | 类型 | 来源 |
|---|---|---|
| `RTEwewNQMUg=` (server ts) | **number** | parseInt(state.no) |
| `VQEgCxNnKjw=` (initTime) | number | Date.now() |
| `bHgZcikfE0A=` (sendTime) | number | Date.now() |
| `W0suQR0tL3E=` (pre-init) | number | initTime - 200ms |
| `NABBSnJgQXE=` (mem.used) | number | random |
| `EX1kN1cQZQY=` (mem.total) | number | random |
| `PSkIY3tJDFE=` (perf.now) | number | sendTime - initTime |
| `DFg5Ekk4PSU=` (/ns duration) | number | 0 或 milliseconds |
| `FCAhKlJCIxk=` (state.to) | **string** | state.to (本来就是 string) |
| `Xi5rJBtKaB4=` (state.appId) | **string** | state.appId |
| `NSEAa3NAC18=` (uuid) | **string** | uuid |
| `Czt+cU1WeEM=` (Date.toString) | **string** | new Date().toString() |
| HMAC 字段 | **string** | hex 32 字符 |

**通用规则**: 用模板的 typeof 做权威类型。

## ⭐⭐⭐ Bug #11: state.* → ev2 b64 key 的位置匹配做错 (新发现 — Grubhub 2026-05-19)

**症状**: collector#1/#2 全 200，state 全提取，但 /auth/login (或保护端点) 仍然 403

**根因**: ev2 中有 4-5 个字段值**直接来自 ob#1 的 state.***（如 state.no、state.to、state.appId、state.o111val）。这些 b64 key 在不同平台不一样：
- iFood `state.no` 在 `RTEwewNQMUg=`
- Grubhub `state.no` 在 `UT0ndxdcJUQ=`（**看起来像 timestamp 但实际是 state.no**！）

如果按值类型猜（"13 位毫秒 ts → 肯定是 pre-init timestamp"），就会把 state.no 字段**漏成自造时间戳**。结果：PX 对该字段做语义校验时发现 server-side state.no ≠ client value → 判 bot。

**修复**: 不要靠类型猜，**靠值匹配**。脚本：
```python
# 对每个 state.* 值，在每批 ev2 找匹配 b64 key
for sname, sval in state.items():
    for k, v in ev2['d'].items():
        if v == sval or (isinstance(sval, str) and sval.isdigit() and v == int(sval)):
            mapping[sname][k] += 1
# 跨 6+ 批一致命中的 key → 确定语义
```

**通用规则**: **state.* (从 ob#1 解出) 在 ev2 的位置必须按"6+ 批值匹配"找，禁止按类型/值范围猜**。

## ⭐⭐ Bug #12: 跨 event 类型复用 b64 key (新发现 — Grubhub 2026-05-19)

**症状**: 字段全对、类型全对、PC 校验通过，但 PX 给的 _px2 在保护端点仍被拒绝。**字段数比浏览器多 1 个**。

**根因**: 不同 event 类型对**同一语义**用不同的 b64 key。例如：
- Grubhub `/ns duration` 在 **EV1** 是 `DFQ2Ekk4PSU=`
- Grubhub `/ns duration` 在 **EV2** **根本不存在**（不发这字段）
- iFood `/ns duration` 在 **EV2** 是 `DFg5Ekk4PSU=`（**对应 EV1 也是这个 key**）

我把 iFood 的逻辑搬到 Grubhub 时给 EV2 多塞了 `DFQ2Ekk4PSU=`——PX 一对比就看出"这个 ev 类型不应该有这个字段"。

**修复**:
```python
# build_ev2 不能照搬 build_ev1 的 /ns 字段，必须查模板里到底有没有
# 用 set(ev2_template.keys()) 做唯一权威字段集合
# DYNAMIC 字段只 override 模板里**已存在**的 key，不 add 新 key
```

**通用规则**: **build_evX 只能 override 模板里已有的 key，禁止新增 key**。一个 deep-clone + override 模式比白手造字典安全得多。

## ⭐ Bug #13: PX 服务端 IP 速率限制 (新发现 — Grubhub 2026-05-19)

**症状**: 同一个生成器，前 3 次跑 status=200 + 拿到 _px2/_px3，但连续跑 5-10 次后开始随机 403。重启脚本后又能成功几次再 403。

**根因**: PX 后端对单 IP 在短时间内的 collector POST 数有阈值。我们脚本 1.5-2 秒一次 collector#1+#2，10 次连发后被 IP-throttle。**不是算法问题，是行为模式问题**。

**修复**:
- 测试稳定性时**每次跑间隔 ≥10 秒**，最好 15-30s
- 生产场景下，每个账号刷新走不同代理 IP（已有 `BRIGHTDATA_RESIDENTIAL_US` 轮换池则用上）
- 一次 bootstrap 60 账号 → **分批 + 间隔**，例如 10 账号一批，批间隔 60s
- 怀疑 throttle 时验证：换 IP（开热点 / 切代理）后重试，若立刻成功就是 throttle

**通用规则**: **稳定性测试 ≠ 连发**。10/10 是逻辑正确性指标，需要给每次跑加间隔避免触发 throttle，否则你测的是"throttle 阈值"不是"算法稳定性"。

---

## 📌 实测后纠正的「之前文档错」清单

历史文档中以下值是**错的**, 已在 2026-05-20 实测后修正：

| 项 | 之前错的 | **实测正确** | 影响 |
|---|---|---|---|
| Grubhub AppID | ~~`PXdRotaCw0`~~ | **`PXO97ybH4J`** | collector POST 401 |
| Grubhub FT | ~~`330`~~ | **`359`** | PC 校验失败 |
| Grubhub Collector URL | ~~`collector-...px-cloud.net/...`~~ | **`sensor.grubhub.com/O97ybH4J/xhr/api/v2/collector`** | 网络层失败 |
| Grubhub SDK 文件名 | ~~`main.min.js`~~ | **`init.js`**（在 sensor.grubhub.com） | 抓不到 SDK |
| Grubhub EV1 event type | (未记录) | `YjIUOCdXHA8=` | 模板字段名错 |
| Grubhub EV2 event type | (未记录) | `ViZgLBBGaB4=` | 同 |
| Grubhub EV2 `state.no` key | (未记录, 易猜成 `RTEwewNQMUg=`) | **`UT0ndxdcJUQ=`** | bot 评分降级 |

> **教训**: **任何"常量"都要从最近一次抓包 POST body 里直接验证**, 不要从旧博客/笔记里抄。本 skill 的 `src/scripts/capture/capture_via_cdp.py` 跑一次, 然后看每批 `meta.json` 即可获得最新真实常量。
