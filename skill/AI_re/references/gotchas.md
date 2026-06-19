# PX 逆向踩坑清单（23 条；#1-14 基础 + #15-18 严档 totalwine + #19-23 严档+ academy）

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

**根因**: sid 含 Unicode Variation Selectors (U+E0100+)，bash 终端 / 某些 HTTP 客户端会丢失这些不可见字符。

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

## ⭐⭐⭐ Bug #14b → #15: Cookie 被签发 ≠ PX 边缘信任它（新发现 — totalwine 2026-05-25）

> ⚠️ 这条改了**整个 skill 的 success criteria**——参考 [`../playbooks/validate-generator.md`](../playbooks/validate-generator.md) Layer 3.5 一并阅读。

**症状**: collector chain 全 200，10/10 拿到 `_px2`，注入真浏览器 navigate 也能渲染页面。但**用 curl_cffi (chrome124 TLS, US 住宅代理) 拿同一个 cookie 直接 GET PX-gated endpoint 一律 403** —— body 是 PX bootstrap JSON (`{"appId":...,"jsClientSrc":...}`) 或 px-captcha challenge HTML。空 cookie 跟我们的 cookie 在这个端点上**返回完全一样的 403 body**，仿佛 PX 没看到我们的 cookie。

**根因**: PX 有**两层校验**:

```
Layer 1 — SDK 客户端校验（cookie 签名 h、结构、TTL）
  → 我们的 cookie 通过这层。所以注入浏览器后 SDK 不复发 collector。

Layer 2 — PX 后端 trust score 校验
  → collector chain 时 PX 后端对 EV1/EV2/EV3 字段做语义分析打分。
  → 分数低 → cookie 仍然签发（这是"宽松信号"，让 bot 以为没事），
    但 backend session record 标 trust=low → 边缘对该 cookie 的所有
    后续请求都按"未授权"处理 → 403 PX block。
```

**关键证据（apples-to-apples control）**:
- 浏览器自己拿到的 `_px2` + 任意 BrightData US 代理 IP + curl_cffi → ✅ 200
- 我们生成的 `_px2` + 同样代理 IP + 同样 curl_cffi → 🚫 403 PX-block
- ⇒ transport 没问题，**问题在 cookie 内容**。但不是密码学层面错，是 trust score 低。

**修复（诊断路径）**:

1. **第一步**: 跑 `compare_ev2_field_by_field`（[skill 自带](../scripts/compare_ev2_field_by_field.py)）—— 我们 EV2 vs 真抓 EV2 字段集 + 类型 + STATIC 值。99% 的根因在此暴露。
2. **第二步**: 跑 [`recover-hmac-formulas.md`](../playbooks/recover-hmac-formulas.md) 验证每个 HMAC/MD5 字段 input 对不对。
3. **第三步**: 检查 [`deployment-tiers.md`](deployment-tiers.md) 看这个站点是不是严档部署 → 是的话还要做 Gotcha #16/#17 的检查。

**不要做**:
- ❌ 怀疑 TLS 指纹（chrome124 impersonation 足够）
- ❌ 怀疑 IP 被打标记（换代理也没用——证明: 浏览器 cookie 跨任何代理 IP 都 200）
- ❌ 重写 collector POST 时序

**通用规则**: **拿到 cookie 不算赢。Validation Layer 3.5 (= cookie 真打 PX-gated 端点拿真内容) 才算赢**。iFood/Grub 的 `business_api_demo.js` 是范本，任何新站点 README 必须有等价物。

## ⭐⭐⭐ Bug #16: Seq=2 不是 "cleanup ping"——严档部署里它是必发 beacon（新发现 — totalwine 2026-05-25）

**症状**: collector chain 走 2 POST（seq=0, seq=1）拿到 cookie 就停。Generator 测试 10/10 全过。但拿这个 cookie 走 Gotcha #15 描述的真端点测试时被拒。

**根因**: 严档部署里 SDK 会发**第 3 个 collector POST (seq=2, en=NTA)**。这个 POST body 含 `OkpJAH8oTTA=` 字段，值是**刚拿到的 `_px2` cookie 字符串**。

```
seq=0 (EV1)  → PX 给 state (no/to/qa/vid/pxsid/cts/appId/hid…)
seq=1 (EV2)  → PX 签发 _px2 cookie（已下发但 trust=pending）
seq=2 (EV3)  → 客户端把 _px2 回传给 PX → PX 标 trust=verified
```

跳过 seq=2 → cookie 永远停在 `trust=pending` → 边缘看到此 cookie 时不放行（行为同未授权）。

**怎么识别这个 trap**:
- 抓包看 `meta.json` 里 `collector_post_count` —— 如果 ≥ 3 且看到 `request_3.txt` 存在
- 解码 `request_3.txt` body 的 payload，看是否含 `OkpJAH8oTTA=`（值是 base64 cookie）
- 如果是 → 必须实现 EV3 + seq=2 POST

**修复**:
```js
// 拿到 cookie 后追加：
const ev3 = buildEv3({ uuid, sendTime, cookieValue });   // cookieValue = 刚拿到的 _px2
const payload3 = generatePayload(ev3, state.no, uuid);
const pc3 = generatePC(ev3, uuid, TAG, FT);
const body3 = formEncode({
    payload: payload3, appId, tag, uuid, ft, seq: 2, en: 'NTA', bi,
    cs: state.qa, pc: pc3, sid, vid: state.vid, cts: state.cts,
    hid: state.hid, rsc: 3,
});
await post(COLLECTOR_URL + '?seq=2&rsc=3', body3, ua);
```

**通用规则**: **抓包 collector POST 数量 = 必发数量**。不要假设第 3 个之后的都是 "beacon noise"，先解码看看里面是不是 cookie 回传。

## ⭐⭐ Bug #17: Counter 子字段同步约束（新发现 — totalwine 2026-05-25）

**症状**: EV2/EV3 所有 b64 key 都对，字段类型、个数全一致，但 PX 仍然把 session 评低分。

**根因**: 严档部署对**字典型字段的子字段间相关性**做校验。totalwine 案例:

```js
'MDxDNnVeQgQ=': {
    PX12738: <num>,
    PX12739: <num>,
    PX12740: 0,
    PX12741: -1,
}
```

跨 6 个真实 batch：
- **PX12738 永远等于 PX12739**（或两者同为 0）
- 跨 EV1 → EV2 → EV3 **单调递增**（EV1 通常是 1, EV2 是 1000–3000, EV3 是 2000–9000）

我们 generator 之前给两个独立 `Math.random()`（如 EV2 给 520 / 2072）→ 真实数据里**6/6 batch 都是相等**的 → PX 后端跨 event 看「同一计数器两路上报不一致」→ 判 bot。

**修复**:
```js
const n2 = 1000 + Math.floor(Math.random() * 2500);
ctx._counter2 = n2;
tpl['MDxDNnVeQgQ='] = { PX12738: n2, PX12739: n2, PX12740: 0, PX12741: -1 };

// EV3:
const n3 = (ctx._prevCounter || 1500) + 1500 + Math.floor(Math.random() * 5000);
tpl['MDxDNnVeQgQ='] = { PX12738: n3, PX12739: n3, PX12740: 0, PX12741: -1 };
```

**通用规则**: **对任何字典型 DYNAMIC 字段**，diff 工具不仅要看字段在不在、值是不是 STATIC，还要看**子字段之间是否有相关性约束**（相等、相加为 0、单调递增等）。这条对**所有部署**都适用——iFood/Grub 没踩到只是凑巧 random 值没触发它们的阈值。

## ⭐⭐ Bug #18: HMAC 字段 input 必须**实测**，不能跨站点抄（新发现 — totalwine 2026-05-25）

**症状**: 复用 iFood 或 Grubhub 的 HMAC 公式（如 `hmac(uuid, UA)`、`hmac(uuid+':a', UA)`、`hmac(uuid+':b', UA)`），在新站点跑出来的 HMAC 字段值**结构对**（32 字符 hex）、**类型对**（string）、**长度对**，PC 校验也过，但 cookie 后续仍然被拒。

**根因**: 4 个 HMAC/MD5 字段（如 `Cho5UEx3PWY=`, `Lx8cFWl9HCE=`, `UiJhKBREYhs=`, `EFwjFlU8JyU=`）的 **b64 key 在不同站点的 SDK 里完全一样**（同混淆字典），但 **input 不一样**：

| 字段 | iFood/Grub（旧文档猜测）| **totalwine 实测** |
|---|---|---|
| `Cho5UEx3PWY=` | `hmac(uuid, UA)` | `hmac(uuid, UA)` ✓ 恰好相同 |
| `Lx8cFWl9HCE=` | `hmac(uuid+':a', UA)` ❌ | `hmac(state.vid, UA)` |
| `UiJhKBREYhs=` | `hmac(uuid+':b', UA)` ❌ | `hmac(state.pxsid, UA)` |
| `EFwjFlU8JyU=` | `hmac(uuid+':c', UA)` ❌ | **`md5(state.vid)` (单 arg, 不是 HMAC!)** |

PX 后端对每个站点用 SDK 里**真实的**input 算一遍，跟客户端上报对比。错一个 HMAC → bot 评分。

**修复（SOP）**: 见 [`../playbooks/recover-hmac-formulas.md`](../playbooks/recover-hmac-formulas.md)。简版：

1. grep SDK 找 b64 key 出现位置 → 找 `i["..."] = jm(X(), Y())` 模式
2. 找 X(), Y() 函数定义（`jm` = HMAC-MD5；单 arg 时 = MD5）
3. 候选 input 枚举：uuid / state.vid / state.pxsid / state.cts / state.qa / sessionStorage[?]
4. 跨 6 batch crypto 验证：哪个 input 公式让 6/6 batch 都命中 → 公式确定
5. 不要找到一个就停——4 个 HMAC 字段都要单独验证

**通用规则**: **任何 HMAC/MD5 字段，新站点都要重新 6 批 crypto 验证。不能从 iFood / Grub 抄假设。** 这一条对**所有未来站点**都适用——并不是 totalwine 特有。

---

## ⭐⭐⭐ Bug #19: 单张快照 diff 看不到「跨事件一致性」——严档低 trust 的隐藏根因（新发现 — academy 2026-06-12）

**症状**: generator 通过了所有现有 diff（`diff_ev_ours_vs_real` / `compare_ev2_field_by_field` /
`diff_samples`：字段集 ✅、类型 ✅、STATIC 值 ✅、形状 ✅、counter 单事件不变量 ✅），
collector 链全 200、cookie 正常签发，但拿去打 PX-gated 端点**一直低 trust 被拒**。
反复查单个 EV2 字段，每个都"看着对"，就是找不到错。

**根因**: 现有 diff 工具**结构上只比较单张事件快照**。但严档后端会校验只存在于
**EV1→EV2→EV3 序列之间**的关系，这类约束在任何单张快照里都不可见：

```
CONSTANT  字段：必须在一个 session 的每个事件里值完全相同
          （页面加载时间戳、uuid、navigator.platform、location.href）
MONOTONIC 字段：必须跨事件严格递增
          （performance.now 计时器、事件计数器、当前时间戳）
DICT/counter 子字段跨事件不变量
          （PX12738==PX12739、某子计数恒 0 或镜像另一个、且随时间单调增长）
```

**真实踩坑**: academy 的 generator 把 `ZRBUGyN3Wiw=`（页面加载时间戳）在 EV1/EV2/EV3
各给了一个**不同**的值——单张 EV2 看完全正常（就是个合理时间戳），但它本该在三个事件里
**恒定**。后端一比 EV1≠EV2 立刻判 bot。同理 `T34+NQkfPgc=`（perf 计时器）我用随机值蒙到
了同量级（骗过形状 diff），但它没有跨事件单调、也没和 counter 联动 → 低 trust。

**关键认识**: 这些规则**真实 CDP 抓包里本来就有**——每个含 seq=0/1/2 的 capture 就是
一个 session 的 EV1/EV2/EV3。不需要 node_bridge，**对真实包做跨事件分析就能提取规则**。
之前漏掉，是因为没有一个工具去做"跨事件"这一维度的比对。

**修复（必做步骤，加进 diff 流程）**:

```bash
# 1. 先对真实抓包提取规则（哪些字段 CONSTANT / 哪些 MONOTONIC^）
node scripts/decode_payload.js samples/1/request_1.txt > samples/1/decoded_payload_1.json  # ×3 events ×N batch
python scripts/cross_event_consistency.py samples            # 真实包 → 规则表

# 2. 让 generator dump 自己的 EV1/EV2/EV3，跑同一工具
python scripts/cross_event_consistency.py samples/_our_ev    # 我们的输出

# 3. 逐行对：每个标了 "<-- generator MUST preserve" 的 CONSTANT / MONOTONIC^
#    字段，generator 的判定必须和真实包一致。不一致 = 跨事件 bug = 低 trust。
```

在 generator 里落实：
- CONSTANT 字段（页面加载时间戳等）：**一次算好，三个事件复用同一个值**（不要每事件重算）。
- MONOTONIC 字段（perf/counter/now-ts）：用**一个虚拟时钟** `perf = sendTime - initTime`
  派生，保证 EV1<EV2<EV3，且 counter 与 perf 联动。

**通用规则**: **「字段集+类型+静态值+形状」全 match ≠ 正确。严档站点必须额外跑
`cross_event_consistency.py`，让每个 CONSTANT / MONOTONIC 字段的跨事件行为也 match 真实包。**
这一维度对所有严档 PX 站点通用。

---

## ⭐⭐⭐ Bug #20: Counter 子字段「合法模式空间」——`(0,N)` 是非法组合（academy 2026-06-13，#17 的精确版）

**症状**: counter 字段（academy `AEwwBkUuMjQ=`）字段集/类型/单调性全对，cookie 签发，
但 PX-gated 端点**稳定卡在 ~40% 通过率**抖动。改它 → 直接 10/10。这是 academy 卡住的**真因**。

**根因**: counter dict `{PX12738:N, PX12739:x, PX12740:y, PX12741:-1}` 的两个子字段
`PX12739/PX12740` **只能是 0 或 ==PX12738，永不独立**。跨 6 批真抓 cross-tab 后，真浏览器
**只产生三种模式**：`(0,0)`、`(N,N)`、`(N,0)`。**`(PX12739=0, PX12740=N)` 真实从不出现** →
严档秒判 bot。之前 #17 只记了 `PX12738==PX12739`，**漏了 PX12740 维度**，于是 academy 错给了 `(0,N)`。

```javascript
// ❌ 错（真实数据里不存在的非法组合）
counter = n => ({ PX12738: n, PX12739: 0, PX12740: n, PX12741: -1 });
// ✅ 对（按抓到的 batch 用对应真实模式；academy 实测 batch1,2=(0,0) batch3=(N,N) batch4-6=(N,0)）
const CTR_PAT = { 1:[0,0], 2:[0,0], 3:[1,1], 4:[1,0], 5:[1,0], 6:[1,0] }[pick] || [1,0];
counter = n => ({ PX12738:n, PX12739: CTR_PAT[0]?n:0, PX12740: CTR_PAT[1]?n:0, PX12741:-1 });
```

**通用规则**: counter 类 dict 字段，**跨 6 批 cross-tabulate 每个子计数器**，列出所有出现过的
`(子字段...)` 组合 = 合法模式空间；生成器只能产出其中之一。别只验"两个相等"，要验"组合合法"。

## ⭐⭐⭐ Bug #21: `/ns` token 是 **TLS 指纹化**的——node 取的会暴露身份（academy 2026-06-13）

**症状**: EV2/EV3 的 `/ns` token 字段（academy `MV0BV3Q9AGE=`，即 `sm`）比真抓**短**
（432 vs 真实 504-512），逐字段 diff 一眼看出长度不符；cookie 低信任。

**根因**: `/ns?c=<uuid>` 端点把**客户端 TLS 指纹**编进返回的 token。node `https` 的 JA3 → 432 字节，
真 Chrome（curl_cffi `chrome142`/`chrome131`）→ 504-512。用 node 取 /ns 等于在 token 里盖了
"声称 Chrome 实为 node" 的章 → 后端降信任。

```javascript
// ❌ 错：node https 取 /ns（token 带 node 的 TLS 指纹）
const ns = await fetchNs(uuid, NS_HOST);          // sm.length == 432
// ✅ 对：/ns 和 collector POST 走同一个 Chrome-impersonate session（curl_cffi chrome142）
//    → sm.length == 504-512，与真抓一致
```

**通用规则**: 严档站点，**`/ns` 必须和 collector 走同一个真 Chrome TLS 传输**。验证法：
直接对 `https://<ns-host>/ns?c=<uuid>` 用 node vs curl_cffi chrome 各取一次，比 `sm` 长度。

## ⭐⭐ Bug #22: 纯算静态模板用**真 Chrome CDP 抓**最稳——但 JSDOM **不是**信任天花板（academy 2026-06-13；2026-06-13 更正）

**⚠️ 先放更正**: 这条最早写成"JSDOM/node_bridge 过不了、只配做 oracle"——**是错的**，
被烧过的出口 IP 误导了（真正原因见 Bug #23）。**node_bridge 跑真 SDK（JSDOM live）在干净住宅 IP 上
实测能过 academy 严档+，拿到 1.2MB 真商品页**。JSDOM 指纹**不是**硬信任天花板。

**仍然成立的部分**: 写**纯算**时，静态 EV 模板**优先用真 Chrome CDP 抓**（`decoded_payload_2.json`，
academy 真抓 **203 字段**，比 JSDOM dump 的 177 更全、传感器值更真）——这是**稳妥默认**，
*不是*因为 JSDOM 静态模板必然被拒（同一干净 IP 上 JSDOM-静态模板 vs 真 Chrome 模板没做过 A/B，
不能断言）。按 mint **轮换多个真指纹**、避免"同一指纹铸大量 cookie"被关联降分，仍是好习惯。

**真正决定 academy 通过率的是 Bug #23**（counter 合法 + chrome142 TLS 传输 + 干净 mint IP），
**不是** JSDOM-vs-真Chrome 模板之争。当年"换了模板就过"很可能是同时换到了干净 IP 的混淆结果。

**通用规则（更正）**: node_bridge 有**两个**正当用途——(1) **逆向 oracle**（看真 SDK 怎么算某字段）；
(2) **零维护的生产兜底**——它跑真 SDK，SDK 轮换时自动适配，干净 IP 上能直接产出过网关的 cookie。
纯算（重抓+重建模板才能跟 SDK 升级）和 node_bridge（自动适配）是**互补**两条产线。

## ⭐⭐⭐ Bug #23: 严档+ 的信任分绑定到「传输 TLS + IP mint 信誉」（academy 2026-06-13）

**症状**: EV 逐字段全对（diff 通过）、counter 合法、/ns 504，**单看 cookie 内容无可挑剔**，
但通过率仍抖（同一份代码：新住宅 IP 10/10，本地 IP 重测后 1/5，代理池打多了也掉到 0）。

**根因**: academy 把 trust 还绑定到 **mint 时的传输真实性 + 出口 IP 信誉**：
1. **传输**: 必须 curl_cffi `chrome142` 持久 session（/ns+collector+edge 一条 TLS）；node TLS mint → 低信任。
2. **IP mint 信誉**: 单出口 IP 高频 mint，会被 PX 按 IP（甚至整个代理池）滚动降信任。

**定位法（4-way 矩阵）**: 真浏览器/curl × 真cookie/我们cookie 四组打网关——
- 真 cookie 两路都过 + 我们 cookie 两路都拒 → cookie 内容问题（继续 diff）
- 我们 cookie **真浏览器过、curl 拒** → cookie 是 borderline 信任（像 academy 修 counter 前）
- 真 cookie 也开始 curl 拒 → **IP/代理池被你测污染了**，换 IP 再测，别误判成算法回归

**通用规则**: 严档+ 站点，**Layer 3.5 必须在干净住宅 IP 上测**，每 cookie 一个新 IP；
"浏览器能开首页"≠"该 IP 上自动化 mint 被信任"（首页通常没被严格门控）。
通过率低且抖**先怀疑 IP/传输**，用 4-way 矩阵证伪后再回去查字段。

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
| totalwine "Validated 10/10" (2026-05-21) | ~~只验 cookie 签发~~ | **必须真打 PX-gated 端点**——见 Bug #15 | 严档部署下 cookie 签发≠可用 |
| totalwine seq=2 (2026-05-21 README) | ~~"cleanup ping, skip it"~~ | **mandatory beacon, 含 cookie 回传**——见 Bug #16 | 不发就永远低 trust |
| totalwine HMAC inputs (2026-05-21) | ~~`uuid+':a'/':b'/':c'` 抄 iFood~~ | **`state.vid` / `state.pxsid` / `md5(state.vid)`**——见 Bug #18 | bot 评分 |

> **教训**: **任何"常量"都要从最近一次抓包 POST body 里直接验证**, 不要从旧博客/笔记里抄。本 skill 的 `src/scripts/capture/capture_via_cdp.py` 跑一次, 然后看每批 `meta.json` 即可获得最新真实常量。
