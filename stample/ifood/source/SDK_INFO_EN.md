# iFood — Locked SDK Snapshot

| Property | Value |
|---|---|
| File | [`main.min.js`](main.min.js) |
| **SHA-256** | `b47a639cde9df4f91bdc4138ae0d64ebf7ce8c876a1e4c9967fd3af3d2975eb8` |
| Size | 231,438 bytes |
| Source URL | `https://client.px-cloud.net/PXO1GDTa7Q/main.min.js` |
| Captured | 2026-05-20 via cdp-browser |
| Validation | 6 fresh batches + 5× live-generator runs, **10/10 pass** |

## Constants in This SDK

| Constant | Value | Where it appears |
|---|---|---|
| AppID | `PXO1GDTa7Q` | URL path, `appId=` POST param |
| TAG | `U0MmDhUmOnhXSw==` | `tag=` POST param |
| FT | `401` | `ft=` POST param |
| Cookie | `_px3` | OB#2 set_cookie segment |
| Collector | `https://collector-pxo1gdta7q.px-cloud.net/api/v2/collector` | request URL |
| `/ns` probe | `https://tzm.px-cloud.net/ns?c={uuid}` | hardcoded in SDK |
| OB XOR key | `100` | derived: `ml("U0MmDhUmOnhXSw==") % 128` |
| EV1 event type | `R3cyPQISOQo=` | first field of EV1 array element |
| EV2 event type | `EFwlFlY8LiQ=` | first field of EV2 array element |

## Wire-Character Convention (This SDK)

OB segments use the **new** wire characters `0` and `l` (digit-zero, lowercase-L):

```
seg handler examples:
  l0l0ll   →  pxsid (1 UUID arg)
  0lll000l →  timestamp (1 13-digit ms arg) → state.no
  0lllll   →  challenge_hash (1 64-hex arg) → state.qa
  000lll   →  set_cookie (4+ args, _px* prefix) → _px3 issuance
```

Compare with older PX SDK versions which used `o` / `1`.

## How to Verify Locally

```bash
sha256sum stample/ifood/source/main.min.js
# expected: b47a639cde9df4f91bdc4138ae0d64ebf7ce8c876a1e4c9967fd3af3d2975eb8
```

If your hash differs, PX has rolled a new SDK since this snapshot.
Re-download via the CDP skill:

```bash
node skill/cdp/scripts/cdp.py navigate "https://www.ifood.com.br/restaurantes"
# Then check Network for the request to client.px-cloud.net; download new main.min.js
# Or use skill/cdp/scripts/fetch_sdk.py
```

## Relationship to Other Parts of the Project

| Companion resource | Path |
|---|---|
| **6 capture batches of the same version** | [`../sample/`](../sample/) (every meta.json's sdk_sha256 matches this SHA) |
| **Generator of the same version** | [`../px_cookie/ifood_px3.js`](../px_cookie/ifood_px3.js) (10/10 verified) |
|                  | [`../px_cookie/px_cookie_v2.js`](../px_cookie/px_cookie_v2.js) (self-contained) |
| **iFood-specific analysis scripts** | [`../script/`](../script/) (decode/diff/verify) |
| **Universal reverse modules** | [`../../../revers/`](../../../revers/) |
| **Cross-version location handbook** | [`../../../main/ZH/PX_逆向方法论_通用版.md`](../../../main/ZH/PX_逆向方法论_通用版.md) |

## Internal Magic Constants in This SDK (for Cross-Version Location)

```bash
cd stample/ifood/source

# Verify algorithm layer present
grep -c "1732584193" main.min.js     # MD5 init A — should be 1
grep -c "909522486" main.js           # HMAC ipad — should be 1
grep -c "122192928e5" main.min.js     # UUID v1 — should be 1
grep -c "2147483647" main.min.js     # ml() INT32_MAX — should be ≥ 1
grep -c "F@bt" main.min.js            # base91 alphabet — should be 1
grep -c "U0MmDhUmOnhXSw==" main.min.js   # TAG itself — should be ≥ 1

# Cross-version grep patterns: see ../../../skill/AI_re/references/locate-by-pattern.md
```
