# Grubhub — Locked SDK Snapshot

| Property | Value |
|---|---|
| File | [`init.js`](init.js) |
| **SHA-256** | `4accf1a5f251a924856784815e9e1032b37f37d6756138c3c7550621960e5301` |
| Size | 270,004 bytes |
| Source URL | `https://sensor.grubhub.com/O97ybH4J/init.js` |
| Captured | 2026-05-20 via cdp-browser |
| Validation | 6 fresh batches + 5× live-generator runs, **10/10 pass** |

> ⚠️ Grubhub's PX SDK file is named `init.js`, not iFood's `main.min.js`.
> Still the silent Collector path SDK (not `captcha.js`/Bundle path).

## Constants in This SDK (⭐ Corrected From Earlier Docs)

| Constant | Value | Earlier (wrong) docs |
|---|---|---|
| AppID | **`PXO97ybH4J`** | ~~`PXdRotaCw0`~~ |
| TAG | **`FmYgK1gdJEAP`** | (same) |
| FT | **`359`** | ~~`330`~~ |
| Cookie | `_px2` (TTL 500s) | (same) |
| Collector URL | `https://sensor.grubhub.com/O97ybH4J/xhr/api/v2/collector` | ~~`/collector-...px-cloud.net/...`~~ |
| EV1 event type | `YjIUOCdXHA8=` | (not documented before) |
| EV2 event type | `ViZgLBBGaB4=` | (not documented before) |
| OB XOR key | `91` (measured) | — |

> **Why older docs were wrong**: earlier analysis used a different Grubhub PX project
> (`PXdRotaCw0`); production now runs `PXO97ybH4J`. The values in this table are extracted directly
> from these 6 batches' **real POST body**, not from old-doc memory.

## Wire-Character Convention (This SDK)

Grubhub uses the **legacy** wire characters `o` and `I` (lowercase o + uppercase I):

```
Seg handler examples (from real OB):
  IIoIIo    →  pxsid (1 UUID arg) → state.pxsid
  oIIoIIIo  →  timestamp (1 13-digit ms arg) → state.no
  IoIIIo    →  control_flag (1 short arg, "cu")
  IoooII    →  set_cookie (5 args, _px2 prefix) → _px2 issuance
  IIoIoI    →  large-int (1 ~19-digit arg) → state.to
```

Compare with iFood's **new** `0` and `l` (digit zero + lowercase L). **OB handler names cannot be used across versions** — match by args shape — see
[`../../../skill/AI_re/references/handler-table.md`](../../../skill/AI_re/references/handler-table.md).

## EV2 Platform-Specific Field Keys (Critical for Porting to Other Sites)

The same semantic uses different EV2 b64 keys per site:

| Semantic | iFood key | **Grubhub key** |
|---|---|---|
| `state.no` injected into EV2 | `RTEwewNQMUg=` | **`UT0ndxdcJUQ=`** |
| `state.to` injected into EV2 | `FCAhKlJCIxk=` | **`UBxmVhZ+Z2U=`** |
| `state.appId` injected into EV2 | `Xi5rJBtKaB4=` | **`CXV/P0wRfwU=`** |

Value-matching method: see [`../script/find_state_keys.py`](../script/find_state_keys.py).

## How to Verify Locally

```bash
sha256sum stample/grub/source/init.js
# expected: 4accf1a5f251a924856784815e9e1032b37f37d6756138c3c7550621960e5301
```

If your hash differs, PX has rolled a new SDK since this snapshot.
Re-download via the CDP skill:

```bash
python skill/cdp/scripts/capture_via_cdp_grubhub.py
# Or directly:
python skill/cdp/scripts/cdp.py navigate "https://www.grubhub.com/"
# Then find sensor.grubhub.com/O97ybH4J/init.js in Network
```

## Internal Magic Constants in This SDK (for Cross-Version Location)

```bash
cd stample/grub/source

# Verify algorithm layer present
grep -c "1732584193" init.js     # MD5 init A — should be 1
grep -c "909522486"  init.js     # HMAC ipad — should be 1
grep -c "122192928e5" init.js    # UUID v1 Gregorian epoch — should be ≥ 1
grep -c "2147483647" init.js     # ml() INT32_MAX — should be ≥ 1
grep -c "FmYgK1gdJEAP" init.js   # TAG itself — should be ≥ 1
grep -c "PXO97ybH4J" init.js     # AppID itself — should be ≥ 1
```

Measured (this locked version):

| Constant | Hit count |
|---|---|
| `1732584193` (MD5 init) | 1 |
| `909522486` (HMAC ipad) | 1 |
| `122192928e5` (UUID v1) | 2 |
| `2147483647` (INT32_MAX) | 1 |
| `FmYgK1gdJEAP` (TAG) | 2 |
| `PXO97ybH4J` (AppID) | 4 |
| `F@bt` (base91 alphabet) | **0** (⚠️ older version may use different encoding; differs from iFood) |

Cross-version grep patterns: see
[`../../../skill/AI_re/references/locate-by-pattern.md`](../../../skill/AI_re/references/locate-by-pattern.md).

## Relationship to Other Parts of the Project

| Companion resource | Path |
|---|---|
| **6 capture batches of the same version** | [`../sample/`](../sample/) |
| **Generator of the same version** | [`../px_cookie/grubhub_px2.js`](../px_cookie/grubhub_px2.js) (10/10 verified) |
| **Grubhub-specific analysis scripts** | [`../script/`](../script/) |
| **Universal reverse modules** | [`../../../revers/`](../../../revers/) |
| **Cross-version location handbook** | [`../../../main/ZH/PX_逆向方法论_通用版.md`](../../../main/ZH/PX_逆向方法论_通用版.md) |
| **iFood vs Grubhub comparison** | [`../../../main/ZH/PX_完整SDK对照逆向方法论.md`](../../../main/ZH/PX_完整SDK对照逆向方法论.md) §8 |
