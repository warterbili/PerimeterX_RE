# Grubhub `_px2` Cookie Generator

Pure-algorithm generator for the Grubhub `_px2` cookie (no PX SDK execution, no browser).

> 🎯 **For this directory's research purpose + end-to-end real example** → [`../RESEARCH_PURPOSE.md`](../RESEARCH_PURPOSE.md)
> 🚀 **30-second end-to-end demo**: `node business_api_demo.js` (_px2 → /auth → anonymous token)
> ⭐ Key insight: Grubhub PX gates the **account system**, not data interfaces (Instacart data goes through `__Host-instacart_sid`, no PX)

## Directory

```
px_cookie/
├── README.md
├── smoke_test.js                ← One-click self-test (require + constants + templates)
├── business_api_demo.js         ⭐ End-to-end real API demo (_px2 → /auth → anonymous token)
├── grubhub_px2.js               ← Generator main body
├── grubhub_ev1_template.json    ← EV1 template (12 fields, built from 6 capture batches)
└── grubhub_ev2_template.json    ← EV2 template (204 fields)
```

## Constants

Fully synced with `../source/SDK_INFO.md` (`smoke_test.js` enforces this):

```
APP_ID  = "PXO97ybH4J"
TAG     = "FmYgK1gdJEAP"
FT      = 359
Cookie  = _px2  (TTL 500)
Collector = https://sensor.grubhub.com/O97ybH4J/xhr/api/v2/collector
SDK SHA = 5e81bffc53ba95808ae81795358d8b71d3b5ba9ebfdaa013ff65ecafa278aad1
```

> ⚠️ Older docs wrote AppID `PXdRotaCw0` / FT `330` — both wrong.
> See [`../source/SDK_INFO.md`](../source/SDK_INFO.md).

## Usage

### Method 1: Run Smoke Test First

```bash
cd stample/grub/px_cookie
node smoke_test.js
# 17/17 ✓ means good to go
```

### Method 2: `require` in Project

```javascript
const generatePx2 = require('./grubhub_px2');

(async () => {
    const r = await generatePx2();
    console.log(r.cookie_name + '=' + r.cookie_value);
    // Output: _px2=eyJ1IjoiYWJjLi4uIn0=
})();
```

### Method 3: CLI

```bash
node grubhub_px2.js
```

Output:

```json
{
  "cookie_name": "_px2",
  "cookie_value": "eyJ1...",
  "ttl": 500,
  "uuid": "...",
  "state": { "no": "...", "to": "...", "appId": "...", ... },
  "ev1_fields": 12,
  "ev2_fields": 204
}
```

## Template Approach — Core Idea

Most EV1/EV2 fields are identical across batches (STATIC). Hand-writing 200 fields = one mistake → 403. So:

1. Take a base template from 6 real captures' `decoded_payload_*.json`
2. Only override ~20 DYNAMIC fields (timestamps, UUIDs, HMACs, memory numbers, etc.)
3. **state.\* injection positions in EV2 are completely different from iFood** — Grubhub uses:
   - `state.no` → `UT0ndxdcJUQ=` (iFood: `RTEwewNQMUg=`)
   - `state.to` → `UBxmVhZ+Z2U=` (iFood: `FCAhKlJCIxk=`)
   - `state.appId` → `CXV/P0wRfwU=` (iFood: `Xi5rJBtKaB4=`)

```javascript
tpl['UT0ndxdcJUQ=']  = parseInt(state.no);   // ⭐ Must parseInt!
tpl['UBxmVhZ+Z2U=']  = state.to;
tpl['CXV/P0wRfwU=']  = state.appId;
```

4. Relocate anti-tamper key/value (preserve original position in template!)

Detailed methodology: see [`../../../skill/AI_re/playbooks/build-generator.md`](../../../skill/AI_re/playbooks/build-generator.md).

## Verify SDK Still Compatible

When PX pushes a new SDK, first run smoke test:

```bash
node smoke_test.js
# Then production:
node grubhub_px2.js     # check cookie_name == "_px2"
```

If production fails, follow the [`../script/`](../script/) decision tree:

1. Check whether SDK SHA is still `5e81bffc…` — see [`../../../main/ZH/PX_SDK_逆向技术文档.md`](../../../main/ZH/PX_SDK_逆向技术文档.md) §SDK drift response
2. Run [`../script/verify_all.sh`](../script/verify_all.sh) — see whether the decoder can still decode 6 batches
3. Run [`../script/diff_samples.py`](../script/diff_samples.py) — see whether new SDK fields shifted
4. Run [`../script/find_state_keys.py`](../script/find_state_keys.py) — see whether state.* → EV2 key mapping changed

## Differences From the iFood Generator

| Dimension | iFood | Grubhub |
|---|---|---|
| Entry | `ifood_px3.js` | `grubhub_px2.js` |
| Template | `ifood_ev{1,2}_template.json` | `grubhub_ev{1,2}_template.json` |
| Template field count | 14 / 204 | 12 / 204 |
| Cookie obtained | `_px3` (TTL 330) | `_px2` (TTL 500) |
| POST count per session | 3 (uses EV3) | 2 |
| state injection positions | iFood-specific keys | Grubhub-specific keys (see above) |
| Smoke test count | 13 | 17 |

> The algorithm layer (payload/PC/OB/SID/UUID/Memory) **is fully shared** via the `revers/` modules. Only "which field goes to which key" and protocol constants are platform-specific.

## Companion Resources

| What you want | Where |
|---|---|
| Algorithm principles | [`../../../main/ZH/PX_SDK_逆向技术文档.md`](../../../main/ZH/PX_SDK_逆向技术文档.md) |
| 6 batches of samples used | [`../sample/`](../sample/) |
| diff debug tools | [`../script/`](../script/) |
| Universal reverse modules | [`../../../revers/`](../../../revers/) |
| iFood equivalent generator | [`../../ifood/px_cookie/`](../../ifood/px_cookie/) |

---

*Source: the legacy `perimeter_X` project's `grubhub_px2.js` + `templates/grubhub_ev*_template.json`.
Corresponds to Grubhub SDK sha256 `5e81bffc…`; 6-batch decode loop + 5× live-generator runs, 10/10 pass.*
