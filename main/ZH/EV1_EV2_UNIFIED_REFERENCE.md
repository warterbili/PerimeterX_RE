# EV1 / EV2 字段统一参考

> **目标**：把"为什么我的纯算还原一直 403"的所有字段细节落地成可对照模板。
> **覆盖平台**：iFood (`PXO1GDTa7Q`) + Grubhub (`PXO97ybH4J`)，方法论通用。
> **更新数据来源**：iFood SDK 2026-05-19 / Grubhub SDK 2026-05-19 (init.js sha256 `1013078d...`)，15+ 批样本。

---

## 心智模型（强烈建议先读）

PerimeterX 的 collector 端点接收**事件数组**：
```
collector#1 POST body = payload (encrypted serialize([ev1]))
collector#2 POST body = payload (encrypted serialize([ev2]))
```

`ev1` 和 `ev2` 都是 **JavaScript 对象**，结构：
```javascript
{
    "t": "<base64 of event type label>",
    "d": {
        "<base64 key #1>": <value>,
        "<base64 key #2>": <value>,
        ...
    }
}
```

### 关键事实（90% 的人都搞错过）

| 事实 | 含义 |
|---|---|
| **b64 key 不是字段名** | 它们是 PX SDK 用 `hQ(N)` 函数查的字典 index，每次 SDK 升级**所有 key 重新生成** |
| **字段位置稳定** | 同一个语义（如 "URL"、"uuid"、"initTime"）在 EV1/EV2 中**位置**通常不变 |
| **STATIC vs DYNAMIC 因平台异** | 一个平台的 STATIC（如 mouse track）可能是另一个的 DYNAMIC（如 Grubhub 不收集） |
| **anti-tamper 字段动态生成 key** | key 和 value **都是** `te(state.to, state.no%10+1or2)` 的输出，每次都不同；模板里的位置必须保留 |
| **state.* 字段值在 ev2 里是 number/string 混合** | 从 ob#1 解出来全是字符串，**用到 ev2 时 timestamp/o111val 等数字字段必须 parseInt** ⭐⭐⭐ |
| **冷访问 vs 暖访问字段数不同** | 冷访问基线 = 204-205 字段（足够拿 _px3/_px2），暖访问会注入 25+ 字段 |

---

## EV1 字段表

> 12-14 字段，结构稳定。所有平台都有这些语义槽位。

| # | 语义 | 类型 | iFood key | Grubhub key | 来源 / 算法 | STATIC/DYNAMIC |
|---|---|---|---|---|---|---|
| 0 | **URL** (referrer) | string | `cgIHSDRhAX8=` | `ZHASeiITF00=` | `location.href` of host page (e.g. `"https://www.grubhub.com/login"`) | STATIC* |
| 1 | type counter | number | `XQkoAxhuKjY=` | `PAhKQnlvS3c=` | 固定 `0` (cold) | STATIC |
| 2 | **navigator.platform** | string | `dEABCjEhBjA=` | `KDRePm1VWgQ=` | `navigator.platform`（如 `"Win32"`、`"MacIntel"`）必须匹配 UA | STATIC |
| 3 | counter | number | `egoPQDxmDXA=` | `fWlLIzsFShM=` | 固定 `0` | STATIC |
| 4 | perf metric / random int | number | `PSkIY3tJDFE=` | `FCAiKlJAJRg=` | iFood: `Math.floor(300+rand*1600)`; Grubhub: 观测 4400-5800（更高范围） | **DYNAMIC** |
| 5 | timezone offset | number | `Tl57FAs5fS4=` | `YGwWZiULE1w=` | `3600` (固定，跨时区不变？) | STATIC |
| 6 | **initTime** | number | `VQEgCxNnKjw=` | `aRVfHy9zVig=` | `Date.now()` ⭐ **必须 number 不能 string** | **DYNAMIC** |
| 7 | **sendTime** | number | `bHgZcikfE0A=` | `GCQuLl1DJxw=` | `initTime + Math.floor(5+rand*10)` ⭐ number | **DYNAMIC** |
| 8 | **uuid** (session) | string | `NSEAa3NAC18=` | `LDhaMmpZUgY=` | `uuidV1()`（**整个 px2 流程都用同一个**） | **DYNAMIC** |
| 9 | /ns sm response | string\|null | `BzdyfUJXdks=` | `VGBiahEAZVw=` | `await fetch('https://tzm.px-cloud.net/ns?c=<uuid>')` 的 body；EV1 时通常还没拿到 → `null` | STATIC* |
| 10 | /ns duration | number | `DFg5Ekk4PSU=` | `DFQ2Ekk4PSU=` | 与 (9) 同一次 fetch 的耗时，EV1 时通常 `0` | STATIC |
| 11 | flag | boolean | `bHgZcioeHEk=` | `QS03ZwdLMVw=` | 固定 `false` | STATIC |
| 12 | **pxhd**（暖访问独有） | string | `R3cyPQIVMAw=` | (Grubhub 无此字段) | 上次 server 给的 pxhd；冷访问留 `""` | CONDITIONAL |
| 13 | **PX12738 计数器**（iFood 独有） | object | `cyNGaTZBQVs=` | (Grubhub 无) | `{PX12738: rand(0,5), PX12739:0, PX12740:0, PX12741:-1}` | DYNAMIC |

**事件类型 `t:`**：iFood = `R3cyPQISOQo=`，Grubhub = `YjIUOCdXHA8=`，**每次 SDK 升级会变**。

### EV1 完整代码模板（Python）

```python
def build_ev1(uuid_str: str, init_time: int, send_time: int, ns_result: dict) -> dict:
    return {
        "t": EV1_EVENT_TYPE,  # 平台相关
        "d": {
            EV1_KEYS["url"]:           "https://www.<host>.com/<path>",
            EV1_KEYS["type_counter"]:  0,
            EV1_KEYS["platform"]:      "Win32",         # 必须匹配 UA
            EV1_KEYS["counter"]:       0,
            EV1_KEYS["perf"]:          random.randint(*PERF_RANGE),   # platform-specific range
            EV1_KEYS["tz_offset"]:     3600,
            EV1_KEYS["init_time"]:     init_time,       # int, NOT string!
            EV1_KEYS["send_time"]:     send_time,       # int, NOT string!
            EV1_KEYS["uuid"]:          uuid_str,
            EV1_KEYS["ns_sm"]:         ns_result.get("sm"),       # None on first call
            EV1_KEYS["ns_dur"]:        ns_result.get("duration", 0),
            EV1_KEYS["flag"]:          False,
        }
    }
```

---

## EV2 关键 DYNAMIC 字段表（必须算法生成）

> EV2 总字段 200+，70-86% 是 STATIC（直接用模板），15-25% 是 DYNAMIC（必须按下面表格生成），3-15% 是 CONDITIONAL。
>
> **下表只列 DYNAMIC**——这是 90% 失败案例的来源。

### A. 时间/会话类（5 个，全部数字）

| 语义 | 类型 | iFood key | Grubhub key | 算法 |
|---|---|---|---|---|
| **server timestamp** | **int** | `RTEwewNQMUg=` | `UT0ndxdcJUQ=` | `int(state.no)` ⭐⭐⭐ **必须 parseInt**，gotcha #1 |
| **initTime** | int | `VQEgCxNnKjw=` | `aRVfHy9zVig=` | `Date.now()` |
| **sendTime** | int | `bHgZcikfE0A=` | `GCQuLl1DJxw=` | `initTime + random(1000, 1500)` |
| **mid_time** | int | `W0suQR0tL3E=` | `EX1nN1cbZQc=` | `initTime + random(200, 2000)`（在 init 和 send 之间） |
| **uuid** | string | `NSEAa3NAC18=` | `LDhaMmpZUgY=` | 与 EV1 同一个 uuid |

### B. 浏览器运行时（4 个）

| 语义 | 类型 | iFood key | Grubhub key | 算法 |
|---|---|---|---|---|
| **Date.toString()** | string | `Czt+cU1WeEM=` | `UiJkKBRPYRo=` | `time.strftime('%a %b %d %Y %H:%M:%S GMT+0800 (中国标准时间)', time.localtime())` ⭐ 中文标准时间字面值 |
| **performance.now()** | float | `PSkIY3tJDFE=` | `ICxWJmVMURE=` | `round(sendTime - initTime, 1)` |
| **memory.used** | int | `NABBSnJgQXE=` | `W0stQR0mL3A=` | `random.randint(40_000_000, 140_000_000)` |
| **memory.total** | int | `EX1kN1cQZQY=` | `FUFjS1MhYHA=` | `memory.used * random.uniform(1.1, 1.5)` |

### C. /ns 响应（2 个）

| 语义 | 类型 | iFood key | Grubhub key | 算法 |
|---|---|---|---|---|
| /ns sm | string\|null | `BzdyfUJXdks=` | `VGBiahEAZVw=` | `(await fetch('https://tzm.px-cloud.net/ns?c=<uuid>')).body`（EV2 时已拿到） |
| /ns duration | int | `DFg5Ekk4PSU=` | (EV2 不带，**Grubhub 例外**) | fetch /ns 耗时 ms |

> ⚠️ **Grubhub 在 EV2 不发 /ns duration 字段**（EV1 才有 `DFQ2Ekk4PSU=`）。iFood 在 EV2 也有 `DFg5Ekk4PSU=`。**如果你照搬 iFood 在 Grubhub EV2 加这字段会多出一个 key 导致 PX 拒绝**（我们踩过这个坑）。

### D. HMAC-MD5 (3-5 个)

| 语义 | iFood key | Grubhub 候选 key | 算法 |
|---|---|---|---|
| HMAC(uuid, UA) | `M2MGKXUOBB8=` | `cHwGdjYRB0A=` | `hmacMD5(uuid, ua)` |
| HMAC(state.vid, UA) | `FmYjbFAEJVg=` | `LDhaMmpeXAE=` | `hmacMD5(state.vid, ua)` |
| HMAC(state.pxsid, UA) | `BzdyfUFRd04=` | `N2cBLXEFBBk=` | `hmacMD5(state.pxsid, ua)` |
| HMAC 常量1 | - | `Pk5IBHsoTzQ=` | Grubhub 多出，15 批全一致 → **静态值**，从模板取 |
| HMAC 杂项 | `KxseEW57HCI=` | `KxsdEW57HCI=` | 算法未定（怀疑 HMAC(Date.toString, UA) 之类）→ 暂用模板 |

⭐ **UA 必须等于 HTTP `User-Agent` header**（gotcha #9）。改 UA 字符串要两处同步。

### E. state.* 引用（从 ob#1 拿，写进 ev2）

| 语义 | 类型 | iFood key | Grubhub key | 必做 |
|---|---|---|---|---|
| **state.no** (server ts) | **int** | `RTEwewNQMUg=` | `UT0ndxdcJUQ=` | `int(state.no)` — 见 A 区，⭐⭐⭐ 最致命 |
| **state.to** (session token) | string | `FCAhKlJCIxk=` | `UBxmVhZ+Z2U=` | 直接传字符串 |
| **state.appId** | string | `Xi5rJBtKaB4=` | `CXV/P0wRfwU=` | 直接传字符串 |
| **state.o111val** | int | (不一定有) | `T385NQoePQM=` | `int(state.o111val)` |

> ⚠️ Grubhub 项目我**最初把 `UT0ndxdcJUQ=` 错标成 "pre_init_time"**，用 `init_time - random(100,300)` 填——**永远 403**。改成 `int(state.no)` 后立刻通过率上升到 5/10。

### F. anti-tamper 对（key + value，1 对）

| 类型 | iFood | Grubhub | 算法 |
|---|---|---|---|
| key 字符范围 `[0-9:;<=>?@]{15-25}` | 是 | 是 | `te(state.to, state.no%10 + 2)` |
| value 字符范围 `[0-9:;<=>?@]{15-25}` | 是 | 是 | `te(state.to, state.no%10 + 1)` |

**注入方式**：在 ev2 模板里找到匹配 `^[0-9:;<=>?@]{15,25}$` 的字段（key + value 都符合），**原位置**替换。
**禁止**：删除旧 key、append 新 key——会破坏字段顺序（gotcha #3）。

### G. 平台特异字段

| 字段 | 仅 iFood | 仅 Grubhub | 通用 |
|---|---|---|---|
| `cyNGaTZBQVs=` (PX12738 counter) | ✓ | - | EV1 |
| `R3cyPQIVMAw=` (pxhd 占位) | ✓ | - | EV1（Grubhub 暖访问可能有） |
| `LVkbU2s6EmI=` (pixel ratio / 10) | - | ✓ | EV2 |
| `cyNFaTZDQ1I=` (navigator.connection 对象) | - | ✓ | EV2 |
| `WGRubh4IZ1g=` (TypeError 堆栈) | - | ✓ | EV2 |

---

## STATIC 字段处理

**核心原则**：**用模板批次的真实值**——别自己造、别 JSON.stringify 默认值。

工程方法：
1. 选一个 cold-visit batch（最干净，浏览器无 prior session）作为模板 → `ev2_template.json`
2. `build_ev2()` 里 `deepClone(template)`，然后**只覆盖 DYNAMIC 字段**
3. STATIC 字段值不动

为啥不动？因为这些字段是浏览器/设备硬件指纹（screen.width、navigator.languages、各种 API 存在性 boolean、Canvas/Audio/WebGL hash 等），**同浏览器同设备每次都是一样的值**。模板批次的值就是 PX 期望看到的"正常浏览器"指纹。

---

## CONDITIONAL 字段

CONDITIONAL 字段 = 暖访问（带 prior session cookies）才出现。冷访问场景下 **直接不发**（不出现在 `d:{}` 里）。

iFood 在暖访问出现的字段（25 个）：历史 _px3 token、pxhd 上次值、challenge state cache。
Grubhub 暖访问出现的字段（36 个）：含 DOM 快照（`RlZwHAM3cSY=` 里有 `[{"tagName": "INPUT", "id": "email", ...}]`）、各种 prior session 字段。

**冷访问基线足够拿 _px2/_px3**——加 CONDITIONAL 字段不仅没必要，可能反而扣分。

---

## 决定性 bug 速查表（gotchas 索引）

跟这份文档配套使用 `references/gotchas.md`。下面是按"症状→章节"的快速指引：

| 症状 | 看 |
|---|---|
| collector 返 200 但 `do:[]` 或 `do:null` 永远没 _px3 | gotcha #1 (state.no 类型) + 本文 A 区 |
| `{"do":[]}` 直接拒绝 | gotcha #2 (Base64 UTF-8) |
| 字段都对但服务器不下发 | gotcha #3 (anti-tamper 位置) + 本文 F 区 |
| 模板里 anti-tamper key 没识别 | gotcha #4 (正则范围) |
| 接受 PC 但不下发 | gotcha #5 (state.appId 必须用 ob#1) + 本文 E 区 |
| sid 与 SDK 不一致 | gotcha #6 (state.pxsid not session uuid) |
| ob 解码全乱码 | gotcha #7 (binary not UTF-8) |
| Python requests sid 字符丢 | gotcha #8 (Tag Char Unicode) |
| HMAC 字段算对了仍拒 | gotcha #9 (UA 一致性) |
| **/auth/login HTTP 403 但 collector 全 200** ⭐ | **本文 E 区 + 多余字段 (`DFQ2Ekk4PSU=` Grubhub EV2 不该有)** |
| 5/10 通过率 (PX 间歇 403) | **IP 速率限制** — 间隔 ≥10s 重试，避免连续 burst |

---

## 工作流速查

完整 step-by-step 见 `WALKTHROUGH.md`。最小路径：

```
1. 抓 6+ 批样本（同 SDK 版本，CDN 稳定就够；A/B 灰度时需 Local Overrides）
2. decode_payload.js × 18 → event_json/{batch}-{1,2,3}.json
3. diff 6+ 批 ev2 → STATIC/DYNAMIC/CONDITIONAL 分类
4. 解 ob#1 → 拿 state.* → 在 ev2 里找 state.* 出现的 b64 key（值匹配）
5. 写 build_ev1 + build_ev2，DYNAMIC 用算法、STATIC 用模板
6. 端到端 10 次跑，期望 10/10 拿 _px3 (iFood) 或 _px2 (Grubhub)
```

**容易卡的地方**：第 4 步——state.* → ev2 key 的位置匹配。
**工具**：本项目 `scripts/find_state_keys_in_ev2.py`（Python），对每个 state.* 值在 ev2 找 6/6 批一致命中的 b64 key。
