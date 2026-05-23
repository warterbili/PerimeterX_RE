# Grubhub — Locked SDK Snapshot

| Property | Value |
|---|---|
| File | [`init.js`](init.js) |
| **SHA-256** | `4accf1a5f251a924856784815e9e1032b37f37d6756138c3c7550621960e5301` (LF-normalized) |
| Size | 270,004 bytes |
| Source URL | `https://sensor.grubhub.com/O97ybH4J/init.js` |
| Captured | 2026-05-20 via cdp-browser |
| Validation | 6 fresh batches + 5× live-generator runs, **10/10 pass** |

> ⚠️ Grubhub 的 PX SDK 文件名是 `init.js`，不是 iFood 的 `main.min.js`。
> 同样是无感 Collector 路径的 SDK（不是 `captcha.js`/Bundle 路径）。

## Constants in this SDK (⭐ corrected from earlier docs)

| Constant | Value | Earlier (wrong) docs |
|---|---|---|
| AppID | **`PXO97ybH4J`** | ~~`PXdRotaCw0`~~ |
| TAG | **`FmYgK1gdJEAP`** | (same) |
| FT | **`359`** | ~~`330`~~ |
| Cookie | `_px2`（TTL 500s） | (same) |
| Collector URL | `https://sensor.grubhub.com/O97ybH4J/xhr/api/v2/collector` | ~~`/collector-...px-cloud.net/...`~~ |
| EV1 event type | `YjIUOCdXHA8=` | (not documented before) |
| EV2 event type | `ViZgLBBGaB4=` | (not documented before) |
| OB XOR key | `91`（实测） | — |

> **为什么旧文档错**：早期分析用的是 Grubhub 一个不同的 PX 项目
> （`PXdRotaCw0`），现在线上跑的是 `PXO97ybH4J`。本表的值是从这 6 批
> **真实 POST body** 直接提取的，不是凭旧文档记忆。

## Wire-character convention (this SDK)

Grubhub 用**老版**的 wire 字符 `o` 和 `I`（小写 o + 大写 I）：

```
seg handler 例子（从真抓 OB 看到）：
  IIoIIo    →  pxsid (1 UUID arg) → state.pxsid
  oIIoIIIo  →  timestamp (1 13-digit ms arg) → state.no
  IoIIIo    →  control_flag (1 short arg, "cu")
  IoooII    →  set_cookie (5 args, _px2 prefix) → _px2 issuance
  IIoIoI    →  large-int (1 ~19-digit arg) → state.to
```

对比 iFood 用**新版**的 `0` 和 `l`（数字零 + 小写 L）。**OB handler 名跨版本不能用**，
按 args 的 shape 匹配 —— 见
[`../../../skill/AI_re/references/handler-table.md`](../../../skill/AI_re/references/handler-table.md)。

## EV2 platform-specific field keys（移植到其它站点关键）

同一语义在不同站点的 EV2 b64 key 不一样：

| Semantic | iFood key | **Grubhub key** |
|---|---|---|
| `state.no` 注入到 EV2 | `RTEwewNQMUg=` | **`UT0ndxdcJUQ=`** |
| `state.to` 注入到 EV2 | `FCAhKlJCIxk=` | **`UBxmVhZ+Z2U=`** |
| `state.appId` 注入到 EV2 | `Xi5rJBtKaB4=` | **`CXV/P0wRfwU=`** |

值匹配方法：见 [`../script/find_state_keys.py`](../script/find_state_keys.py)。

## How to verify locally

```bash
sha256sum stample/grub/source/init.js
# expected: 4accf1a5f251a924856784815e9e1032b37f37d6756138c3c7550621960e5301
```

If your hash differs, PX has rolled a new SDK since this snapshot.
Re-download via the CDP skill:

```bash
python skill/cdp/scripts/capture_via_cdp_grubhub.py
# 或者直接：
python skill/cdp/scripts/cdp.py navigate "https://www.grubhub.com/"
# 然后在 Network 找 sensor.grubhub.com/O97ybH4J/init.js
```

## 这个 SDK 的内部魔法常量（用于跨版本定位）

```bash
cd stample/grub/source

# 验证算法层存在
grep -c "1732584193" init.js     # MD5 init A — 应 1
grep -c "909522486"  init.js     # HMAC ipad — 应 1
grep -c "122192928e5" init.js    # UUID v1 Gregorian epoch — 应 ≥ 1
grep -c "2147483647" init.js     # ml() INT32_MAX — 应 ≥ 1
grep -c "FmYgK1gdJEAP" init.js   # TAG 自身 — 应 ≥ 1
grep -c "PXO97ybH4J" init.js     # AppID 自身 — 应 ≥ 1
```

实测（locked 这版）：

| 常量 | 命中次数 |
|---|---|
| `1732584193` (MD5 init) | 1 |
| `909522486` (HMAC ipad) | 1 |
| `122192928e5` (UUID v1) | 2 |
| `2147483647` (INT32_MAX) | 1 |
| `FmYgK1gdJEAP` (TAG) | 2 |
| `PXO97ybH4J` (AppID) | 4 |
| `F@bt` (base91 字母表) | **0**（⚠️ 老版可能用别的编码，跟 iFood 不一样） |

跨版本 grep 模式见
[`../../../skill/AI_re/references/locate-by-pattern.md`](../../../skill/AI_re/references/locate-by-pattern.md)。

## 跟本项目其它部分的关系

| 配套资源 | 路径 |
|---|---|
| **同版本的 6 批抓包** | [`../sample/`](../sample/) |
| **同版本的生成器** | [`../px_cookie/grubhub_px2.js`](../px_cookie/grubhub_px2.js) (10/10 验证) |
| **Grubhub 专用分析脚本** | [`../script/`](../script/) |
| **通用 reverse 模块** | [`../../../revers/`](../../../revers/) |
| **跨版本定位手册** | [`../../../main/ZH/PX_逆向方法论_通用版.md`](../../../main/ZH/PX_逆向方法论_通用版.md) |
| **iFood vs Grubhub 对照** | [`../../../main/ZH/PX_完整SDK对照逆向方法论.md`](../../../main/ZH/PX_完整SDK对照逆向方法论.md) §8 |
