# iFood — Locked SDK Snapshot

| Property | Value |
|---|---|
| File | [`main.min.js`](main.min.js) |
| **SHA-256** | `e042d5de834333985610691dbd6e435ca61a744e6a17271e4bbb4c21706a754e` (LF-normalized) |
| Size | 231,438 bytes |
| Source URL | `https://client.px-cloud.net/PXO1GDTa7Q/main.min.js` |
| Captured | 2026-05-20 via cdp-browser |
| Validation | 6 fresh batches + 5× live-generator runs, **10/10 pass** |

## Constants in this SDK

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

## Wire-character convention (this SDK)

OB segments use the **new** wire characters `0` and `l` (digit-zero, lowercase-L):

```
seg handler examples:
  l0l0ll   →  pxsid (1 UUID arg)
  0lll000l →  timestamp (1 13-digit ms arg) → state.no
  0lllll   →  challenge_hash (1 64-hex arg) → state.qa
  000lll   →  set_cookie (4+ args, _px* prefix) → _px3 issuance
```

Compare with older PX SDK versions which used `o` / `1`.

## How to verify locally

```bash
sha256sum stample/ifood/source/main.min.js
# expected: e042d5de834333985610691dbd6e435ca61a744e6a17271e4bbb4c21706a754e
```

If your hash differs, PX has rolled a new SDK since this snapshot.
Re-download via the CDP skill:

```bash
node skill/cdp/scripts/cdp.py navigate "https://www.ifood.com.br/restaurantes"
# 然后看 Network 里去 client.px-cloud.net 的请求，下载新 main.min.js
# 或用 skill/cdp/scripts/fetch_sdk.py
```

## 跟本项目其它部分的关系

| 配套资源 | 路径 |
|---|---|
| **同版本的 6 批抓包** | [`../sample/`](../sample/) (sdk_sha256 字段全是这个 SHA) |
| **同版本的生成器** | [`../px_cookie/ifood_px3.js`](../px_cookie/ifood_px3.js) (10/10 验证) |
|                  | [`../px_cookie/px_cookie_v2.js`](../px_cookie/px_cookie_v2.js) (self-contained) |
| **iFood 专用分析脚本** | [`../script/`](../script/) (decode/diff/verify) |
| **通用 reverse 模块** | [`../../../revers/`](../../../revers/) |
| **跨版本定位手册** | [`../../../main/ZH/PX_逆向方法论_通用版.md`](../../../main/ZH/PX_逆向方法论_通用版.md) |

## 这个 SDK 的内部魔法常量（可用于跨版本定位）

```bash
cd stample/ifood/source

# 验证算法层存在
grep -c "1732584193" main.min.js     # MD5 init A — 应 1
grep -c "909522486" main.js           # HMAC ipad — 应 1
grep -c "122192928e5" main.min.js     # UUID v1 — 应 1
grep -c "2147483647" main.min.js     # ml() INT32_MAX — 应 ≥ 1
grep -c "F@bt" main.min.js            # base91 字母表 — 应 1
grep -c "U0MmDhUmOnhXSw==" main.min.js   # TAG 自身 — 应 ≥ 1

# 跨版本 grep 模式见 ../../../skill/AI_re/references/locate-by-pattern.md
```
