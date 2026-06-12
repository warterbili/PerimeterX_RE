# 已验证站点目录（Validated Sites Catalog）

> 4 个跑通的真实站点的**全部具体常量 + 每站不同的 b64 键映射 + 部署档位**。
> 用途：逆向**新站点**时当查找表 —— 看清"哪些是通用算法、哪些每站都不一样"。
>
> ⭐ **最致命的可移植性 bug**：EV2 里 `state.*`/HMAC/counter 的 **base64 键名每站都不同**。
> 从一个站抄模板到另一个站 = 键名错 = bot 降级。**每站必须用 `find_state_keys_in_ev2.py` 重新定位。**

## 四站总览（3 档）

| 站点 | 档位 | Cookie | POST 链 | EV3 | /ns | hid | counter 校验 | 传输要求 |
|---|---|---|---|---|---|---|---|---|
| **iFood** | 宽档 | `_px3` (TTL 330) | 2 (seq 0/1) | ✗ | ✓ 取 | ✗ | 不查 | node TLS 即可 |
| **Grubhub** | 宽档 | `_px2` (TTL 500) | 2 (seq 0/1) | ✗ | ✗ 不取 | ✗ | 无字段 | node TLS 即可 |
| **Total Wine** | 严档 | `_px2` (TTL 330) | 3 (seq 0/1/2) | ✓ 必发 | 弱 | ✓ | `PX12738==PX12739` | node TLS 即可 |
| **Academy** | 严档+ | `_px3` (TTL 330) | 3 (seq 0/1/2) | ✓ 必发 | ✓ **TLS 敏感** | ✗ | **全模式** (见 Bug #20) | **必须 Chrome TLS 持久 session** |

## 常量（全部从最近一次抓包 POST body 实测，勿从旧笔记抄）

| | iFood | Grubhub | Total Wine | **Academy** |
|---|---|---|---|---|
| **AppID** | `PXO1GDTa7Q` | `PXO97ybH4J` ⭐(非 `PXdRotaCw0`) | `PXFF0j69T5` | `PXqqxM841a` |
| **TAG (gt)** | `U0MmDhUmOnhXSw==` | `FmYgK1gdJEAP` | `CFQ7WU4xIS8MXA==` | `dgYGCzBjH3pyBg==` |
| **FT** | `401` | `359` ⭐(非 `330`) | `401` | `405` |
| **OB XOR key** `ml(TAG)%128` | `100` | `91` | — | — |
| **Collector** | `collector-pxo1gdta7q.px-cloud.net/api/v2/collector`(三方) | `sensor.grubhub.com/O97ybH4J/xhr/api/v2/collector`(一方) | `www.totalwine.com/FF0j69T5/xhr/api/v2/collector`(一方) | `collector-pxqqxm841a.px-cloud.net/api/v2/collector`(三方) |
| **/ns host** | `tzm.px-cloud.net` | —(不取) | 弱 | `ift.px-cloud.net` |
| **SDK 文件** | `main.min.js` | `init.js` ⭐ | `main.min.js` (sha `9335db02`) | `init.js` (sha `50debea8`, 344410B) |
| **EV1 event-type `t`** | — | `YjIUOCdXHA8=` | `P28MJXoKARI=` | — |
| **EV2 event-type `t`** | — | `ViZgLBBGaB4=` | `JVEWW2MxG2k=` | — |

## EV2 `state.*` 注入键（**每站不同 —— #1 移植 bug**）

| 语义 | iFood | Grubhub | Total Wine | 注入规则 |
|---|---|---|---|---|
| `state.no`（时间戳）| `RTEwewNQMUg=` | `UT0ndxdcJUQ=` ⭐ | `YQ1SBydsVTQ=` | **`parseInt`**（Bug #1，绝不能 string）|
| `state.to`（大整数）| `FCAhKlJCIxk=` | `UBxmVhZ+Z2U=` | `fEgPAjoqCzE=` | string 原样 |
| `state.appId` | `Xi5rJBtKaB4=` | `CXV/P0wRfwU=` | `Bzd0fUJTcUc=` | string 原样 |

（Academy 的 state 键见 `stample/academy/px_cookie/state_key_map.json`：`state.no→RBB0WgJxcGk=`、
`state.to→ViZmLBBEYR8=`、`state.appId→a1tbUS4/XWs=`、`state.echo→Slp6EA87eCY=`。）

## HMAC / MD5 字段（**输入每站实测，不能抄**，Bug #18）

| 站点 | UUID-HMAC | VID-HMAC | PXSID-HMAC | MD5 |
|---|---|---|---|---|
| **iFood** | `M2MGKXUOBB8=`=HMAC(uuid,UA) | `FmYjbFAEJVg=`=HMAC(vid,UA)条件 | `BzdyfUFRd04=`=HMAC(pxsid,UA)条件 | — |
| **Grubhub** | `Pk5IBHsoTzQ=`=HMAC(uuid,UA) | — | — | 另有 `cHwGdjYRB0A=`=HMAC(uuid+secondary,UA) |
| **Total Wine** | `Cho5UEx3PWY=`=HMAC(uuid,UA) | `Lx8cFWl9HCE=`=HMAC(**state.vid**,UA) ⭐ | `UiJhKBREYhs=`=HMAC(**state.pxsid**,UA) ⭐ | `EFwjFlU8JyU=`=**MD5(state.vid)** 单参 ⭐ |
| **Academy** | `NABESnJtQ3w=`=HMAC(uuid,UA) | `cgICSDRgAXw=`=HMAC(vid,UA) | `Xi5uJBhIbhc=`=HMAC(pxsid,UA) | `QAxwRgVsd3U=`=MD5(vid) |

> ⚠️ Total Wine 的 VID/PXSID-HMAC 用 `state.vid`/`state.pxsid` 不是 `uuid+':a'/':b'`——
> 从 iFood 抄就 trust=low。**每站用 `find_hmac_field_sources.py` 跨 6 批实测。**

## Counter dict（每站键名 + 合法模式）

| 站点 | b64 键 | 模式 `(PX12739,PX12740)` | 校验? |
|---|---|---|---|
| iFood | `cyNGaTZBQVs=` | `(0,0)` | 不查 |
| Grubhub | （无 counter 字段）| — | — |
| Total Wine | `MDxDNnVeQgQ=` | `(N,0)` 且 `PX12738==PX12739` | 查 |
| **Academy** | `AEwwBkUuMjQ=` | `(0,0)/(N,N)/(N,0)`，**`(0,N)` 非法** | **查全模式**（Bug #20）|

结构恒为 `{PX12738:N(单调), PX12739:x, PX12740:y, PX12741:-1}`，`x/y` ∈ {0, N}，永不独立。

## Wire char 编码（OB handler 形状识别，**每 SDK 版本不同**）

| 站点 | 风格 | 字符 | 例（state.no 段）|
|---|---|---|---|
| iFood | 新 | `0`(零) + `l`(小写L) | `0lll000l\|<15-16位>` |
| Grubhub | 旧 | `o`(小写) + `I`(大写i) | `oIIoIIIo\|<13位>` |
| Total Wine | — | `OlllOOll`(hid 段) | `OlllOOll\|<b64>=:<b64>\|true` |

**别硬编码 handler 行号**，按**参数个数 + 形状**正则匹配 OB 段（见 `handler-table.md`）。

## 冷/热 + /ns + Cookie 策略（每站不同）

| 维度 | iFood | Grubhub | Total Wine | Academy |
|---|---|---|---|---|
| EV1 字段数 | 14（含 /ns 槽）| 12（无 /ns）| 13 | 13 |
| EV2 字段数 | ~204 | ~200 | ~220 | **203**（真 Chrome；JSDOM 给 177）|
| EV3 字段数 | — | — | 11 | 11 |
| 冷访问 `pxhd` | `""` 空串（热也空）| — | — | — |
| /ns 冷值 | sm=`null` dur=`0`（EV1）| 不取 | — | sm=`null` dur=`0`（EV1）|
| EV3 cookie 回传字段 | — | — | `OkpJAH8oTTA=`=`_px2` 值 | `MkJCCHcgRTk=`=`_px3` 值 |
| 业务层守的东西 | Data/GraphQL API | 账号 auth | SRP/PDP HTML | 商品页 HTML |
| 代理地理 | `country-br` 住宅 | US | US | **US 住宅，每 cookie 换 IP** |

## 逆向新站点前必查清单

1. **Collector 域名**（一方 vs 三方）——抓真流量，别假设 `px-cloud.net`。
2. **EV2 `state.*` / HMAC / counter 的 b64 键** —— 每站不同，`find_state_keys_in_ev2.py` 重定位。
3. **Wire char 风格**（`0/l` vs `o/I`）—— 决定 OB 段正则。
4. **Cookie 名 + TTL** —— 从 OB#2 set_cookie 段读，别假设 `_px3`。
5. **档位**（Stage 1.5）——`collector_post_count` 2 vs 3；3 → 严档，去找 EV3/hid/counter/HMAC 实测。
6. **严档+ 信号**（academy 类）——/ns token 是否 TLS 敏感、模板是否必须真 Chrome、是否 IP-mint 敏感（Bug #20-#23）。
7. **业务层 vs PX 层**分开验 —— 如 Grubhub 的 463 OTP 是账号逻辑不是 PX；device_id 要固定 string。

详见各站 `stample/<site>/px_cookie/README.md` 与 [`deployment-tiers.md`](deployment-tiers.md) / [`gotchas.md`](gotchas.md)。
