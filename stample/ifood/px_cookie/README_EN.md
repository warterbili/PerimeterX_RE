# iFood `_px3` Cookie Generator

Two iFood `_px3` cookie pure-algorithm generators. **Same SDK, two code styles**.

> 🎯 **For this directory's research purpose + end-to-end real example** → [`../RESEARCH_PURPOSE.md`](../RESEARCH_PURPOSE.md)
> 🚀 **30-second end-to-end demo**: `node business_api_demo.js` (_px3 → GraphQL → real merchant data)

## Directory

```
px_cookie/
├── README.md
├── smoke_test.js                ← One-click self-test script (require + constants + templates)
├── business_api_demo.js         ⭐ End-to-end real API demo (_px3 → GraphQL → merchant data)
│
├── ifood_px3.js                 (modular version)
│   ├── ifood_ev1_template.json
│   └── ifood_ev2_template.json
│
└── px_cookie_v2.js              (self-contained version)
    ├── ev1_template.json
    └── ev2_template.json
```

## Comparison of Two Versions

| Dimension | `ifood_px3.js` | `px_cookie_v2.js` |
|---|---|---|
| Style | **Modular** | **Single-file** |
| File size | 10 KB | 19 KB |
| Lines | 267 | 281 |
| Dependencies | 7 `../../../revers/*.js` modules | **Zero external dependencies** (Node built-ins only) |
| Template | `ifood_ev{1,2}_template.json` | `ev{1,2}_template.json` |
| EV2 field count | 203 (slim) | 204 (full cold visit) |
| Use case | Project integration; reuse reverse modules | Drop the single file anywhere |
| CLI entry | `node ifood_px3.js` | None; use `require()` |
| Source | `perimeter_X/src/generators/` | `Desktop/ifood-pxcookie-update-2026-05-19/` |

## Both Use the Same SDK

All protocol constants in the two generators are **identical** (verified by smoke test):

```
APP_ID = "PXO1GDTa7Q"
TAG    = "U0MmDhUmOnhXSw=="
FT     = 401
Cookie = _px3
SDK SHA = b47a639cde9df4f91bdc4138ae0d64ebf7ce8c876a1e4c9967fd3af3d2975eb8
```

They're not different SDK versions — they're **two generator implementations of the same SDK**.

## Usage

### Method 1: Run Smoke Test First

```bash
cd stample/ifood/px_cookie
node smoke_test.js
# 13/13 ✓ means good to go
```

### Method 2: Modular Version (Recommended for In-Project Use)

```javascript
const generatePx3 = require('./ifood_px3');

(async () => {
    const r = await generatePx3();
    console.log(r.cookie_name + '=' + r.cookie_value);
    // Output: _px3=eyJ1IjoiYWJjLi4uIn0=
})();
```

Or CLI directly:

```bash
node ifood_px3.js
```

Output:

```json
{
  "cookie_name": "_px3",
  "cookie_value": "eyJ1...",
  "ttl": 330,
  "uuid": "...",
  "state": { "no": "...", "to": "...", ... },
  "ev1_fields": 14,
  "ev2_fields": 204
}
```

### Method 3: Self-Contained Version (Single-File Deploy)

```javascript
const px = require('./px_cookie_v2');
(async () => {
    const r = await px({ userAgent: 'Mozilla/5.0 ...' });
    console.log(r);
})();
```

You can directly copy `px_cookie_v2.js` + `ev{1,2}_template.json` (these 3 files) anywhere and run independently.

## Which One to Use?

| Scenario | Recommended |
|---|---|
| Working alongside other modules in this project | `ifood_px3.js` (reuses AI_re/reverse) |
| Need a single file for Lambda / Vercel / Cloudflare Worker | `px_cookie_v2.js` |
| Writing tests / mocking algorithms | `ifood_px3.js` (easy to stub modules) |
| Want to read the full algorithm without jumping around | `px_cookie_v2.js` (XOR/PC/MD5 all inline) |

## Verify SDK Still Compatible

When PX pushes a new SDK, first run smoke test:

```bash
node smoke_test.js
# Then production:
node ifood_px3.js     # check cookie_name == "_px3"
```

If production fails:

1. Check whether SDK SHA is still `b47a639c…` — see [`../../../main/ZH/PX_SDK_逆向技术文档.md`](../../../main/ZH/PX_SDK_逆向技术文档.md) §SDK drift response
2. Run [`../script/verify_all.sh`](../script/verify_all.sh) — see whether the decoder can still decode 6 batches of samples
3. Run [`../script/diff_samples.py`](../script/diff_samples.py) — see whether the new SDK's fields changed

## Companion Resources

| What you want | Where |
|---|---|
| Algorithm principles | [`../../../main/ZH/PX_SDK_逆向技术文档.md`](../../../main/ZH/PX_SDK_逆向技术文档.md) |
| 6 batches of samples used | [`../sample/`](../sample/) |
| diff debug tools | [`../script/`](../script/) |
| Universal reverse modules | [`../../../revers/`](../../../revers/) |

---

*Source: `perimeter_X/src/generators/ifood_px3.js` + `Desktop/ifood-pxcookie-update-2026-05-19/px_cookie_v2.js`.
Both correspond to the same iFood SDK (sha256 `b47a639c…`); smoke test 13/13 passes.*
