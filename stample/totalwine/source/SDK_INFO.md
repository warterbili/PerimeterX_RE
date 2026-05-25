# Total Wine — Locked SDK Snapshot

| Property | Value |
|---|---|
| File | [`main.min.js`](main.min.js) |
| **SHA-256** | `9335db02cbf6eb43263030d1994d2626c2cfd9d401be03cac0803b156bcd530d` (LF-normalized) |
| SHA-256 (raw bytes) | `847732ea8e712299c9093acfdc3f3873fced9c0d87aa70c6892d6e61dff1812e` |
| Size | 326,166 bytes |
| Source URL | `https://client.px-cloud.net/PXFF0j69T5/main.min.js` |
| Captured | 2026-05-25 via cdp-browser |
| Validation | 6 fresh batches + 10/10 end-to-end (Layer 3.5 — see `../px_cookie/README.md`) |

## Constants in this SDK

| Constant | Value | Where it appears |
|---|---|---|
| AppID | `PXFF0j69T5` | URL path, `appId=` POST param |
| TAG | `CFQ7WU4xIS8MXA==` | `tag=` POST param |
| FT | `401` | `ft=` POST param |
| Cookie | `_px2` | OB#2 set_cookie segment |
| Collector | `https://www.totalwine.com/FF0j69T5/xhr/api/v2/collector` (first-party) | request URL |
| Bootstrap SDK | `https://client.px-cloud.net/PXFF0j69T5/main.min.js` | hardcoded |
| OB XOR key | `100` | derived: `ml("CFQ7WU4xIS8MXA==") % 128` |
| EV1 event type | `P28MJXoKARI=` | first field of EV1 array element |
| EV2 event type | `JVEWW2MxG2k=` | first field of EV2 array element |
| EV3 event type | `XGhvYhoEblE=` | first field of EV3 array element (⭐ Total Wine 独有的 cookie-confirmation beacon) |

## Deployment tier: **STRICT**

Unlike iFood and Grubhub (lenient tier), Total Wine enforces extra
server-side checks. See [`skill/AI_re/references/deployment-tiers.md`](../../../skill/AI_re/references/deployment-tiers.md)
for the comparison.

Strict-tier features observed in this deployment:

- **3 collector POSTs** (seq=0, 1, 2) — seq=2 is mandatory cookie-confirmation beacon
- **First-party collector path** (`/FF0j69T5/xhr/api/v2/collector` on the main domain)
- **`state.hid`** in ob#1 — extracted from `OlllOOll|<b64>=:<b64>|true` segment
- **Server-side HMAC verification** of 4 fields:
  - `Cho5UEx3PWY=` = `HMAC-MD5(uuid, UA)`
  - `Lx8cFWl9HCE=` = `HMAC-MD5(state.vid, UA)`
  - `UiJhKBREYhs=` = `HMAC-MD5(state.pxsid, UA)`
  - `EFwjFlU8JyU=` = `MD5(state.vid)` (single-arg, **NOT HMAC**)
- **Counter sub-field synchronization**: `MDxDNnVeQgQ=` has `PX12738 == PX12739`, monotonic across EV1→EV2→EV3
- **EV3 (seq=2) body** contains field `OkpJAH8oTTA=` = the `_px2` cookie just received

## Wire-character convention (this SDK)

OB segments use the modern `O`/`l` (capital-O, lowercase-L) wire characters:

```
seg handler examples:
  OOllOO     →  state.pxsid (1 UUID arg)
  llllOO     →  state.jf (1 short-string arg)
  OOlOlO     →  state.to (1 20-digit num arg)
  OlllllOO   →  state.no (1 13-digit ms arg)
  lOOlll     →  state.appId (1 lowercase-alphanum arg)
  OllllOll   →  /ns sm value (1 small-int arg)
  OlllOlll   →  state.cts (uuid|true)
  lllllO     →  state.qa (1 64-hex sha256)
  lOlOOO     →  state.vid (uuid|31536000|true)
  OOOllO     →  set_cookie (name|ttl|value)
  OlllOOll   →  state.hid (<b64>=:<b64>|true)
```

## How to verify locally

```bash
sha256sum stample/totalwine/source/main.min.js
# Raw bytes: 847732ea8e712299c9093acfdc3f3873fced9c0d87aa70c6892d6e61dff1812e
# LF-norm:   9335db02cbf6eb43263030d1994d2626c2cfd9d401be03cac0803b156bcd530d
```

If your hash differs, PX has rolled a new SDK since this snapshot.
Re-capture via the CDP skill:

```bash
python stample/totalwine/script/capture_via_cdp_totalwine.py 6
```

## 跟本项目其它部分的关系

| 配套资源 | 路径 |
|---|---|
| 同版本的 6 批抓包 | [`../sample/`](../sample/) (sdk_sha256 全是 raw `847732ea...`) |
| 同版本的生成器 | [`../px_cookie/totalwine_px2.js`](../px_cookie/totalwine_px2.js) |
| 字段三分类 + state→key 映射 | [`../px_cookie/totalwine_ev{1,2,3}_field_map.json`](../px_cookie/) |
| 通用 reverse 模块 | [`../../../revers/`](../../../revers/) |
| 部署严格度对照 | [`../../../skill/AI_re/references/deployment-tiers.md`](../../../skill/AI_re/references/deployment-tiers.md) |
| HMAC 公式还原 SOP | [`../../../skill/AI_re/playbooks/recover-hmac-formulas.md`](../../../skill/AI_re/playbooks/recover-hmac-formulas.md) |

## 这个 SDK 的内部魔法常量（可用于跨版本定位）

```bash
cd stample/totalwine/source

grep -c "1732584193" main.min.js         # MD5 init A — 应 ≥ 1
grep -c "909522486" main.min.js          # HMAC ipad — 应 ≥ 1
grep -c "122192928e5" main.min.js        # UUID v1 — 应 ≥ 1
grep -c "2147483647" main.min.js         # ml() INT32_MAX — 应 ≥ 1
grep -c "F@bt" main.min.js               # base91 字母表 — 应 1
grep -c "CFQ7WU4xIS8MXA==" main.min.js   # TAG 自身 — 应 ≥ 1
```

跨版本定位手册：[`../../../skill/AI_re/references/locate-by-pattern.md`](../../../skill/AI_re/references/locate-by-pattern.md)。
