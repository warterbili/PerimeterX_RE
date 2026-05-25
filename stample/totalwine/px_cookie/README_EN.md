# Total Wine `_px2` Cookie Generator

Pure-math `_px2` cookie generator for Total Wine. ⭐ **PX strict-tier deployment case study** — the same SDK has different server-side enforcement at different customers, see [`skill/AI_re/references/deployment-tiers.md`](../../../skill/AI_re/references/deployment-tiers.md).

> 🎯 **Research purpose + live case study** → [`../RESEARCH_PURPOSE_EN.md`](../RESEARCH_PURPOSE_EN.md)
> 🚀 **30-second end-to-end demo**: `node business_api_demo.js` (_px2 → SRP HTML 1.3 MB)

## Directory

```
px_cookie/
├── README.md / README_EN.md
├── smoke_test.js                ⭐ Self-test (require + constants + templates + 6 strict-tier-only checks)
├── business_api_demo.js         ⭐ End-to-end demo (_px2 → totalwine.com/search real HTML)
├── totalwine_px2.js             ⭐ Main generator
├── totalwine_ev1_template.json  (EV1, 13 fields)
├── totalwine_ev2_template.json  (EV2, 199 fields)
├── totalwine_ev3_template.json  (EV3, 11 fields) ⭐ Strict-tier-only
├── totalwine_ev1_field_map.json (Field classification: STATIC/DYNAMIC/PARTIAL/CONDITIONAL)
├── totalwine_ev2_field_map.json
├── totalwine_ev3_field_map.json
└── state_key_map.json           (state.* → EV2 b64 key cross-batch matching)
```

## Differences vs iFood/Grub (strict vs lenient tier)

| Aspect | iFood (`_px3`) | Grub (`_px2`) | **Total Wine (`_px2`)** ⭐ |
|---|---|---|---|
| Deployment tier | lenient | lenient | **strict** |
| Collector POST count | 2 | 2 | **3** (seq=0/1/**2**) |
| EV3 (seq=2) | ✗ | ✗ | **✓ mandatory** (cookie-confirmation beacon) |
| `state.hid` field | ✗ | ✗ | **✓** |
| HMAC server-side verification | weak | weak | **strict** |
| Counter synchronization | not checked | not checked | **`PX12738==PX12739` enforced** |
| Layer 3 (cookie issuance) | passing = done | passing = done | **passing ≠ done** (must run Layer 3.5) |

## Constants

| Field | Value | Source |
|---|---|---|
| AppID | `PXFF0j69T5` | live capture POST body |
| TAG (gt) | `CFQ7WU4xIS8MXA==` | live capture POST body |
| FT | `401` | live capture POST body |
| Cookie | `_px2` | decoded ob#2 first segment |
| TTL | `330` | decoded ob#2 |
| Collector | `https://www.totalwine.com/FF0j69T5/xhr/api/v2/collector` | first-party PX deployment |
| Bootstrap SDK | `https://client.px-cloud.net/PXFF0j69T5/main.min.js` | sha256 `9335db02…` (LF-normalized) |

## 4 HMAC/MD5 field formulas (strict-tier must measure)

⚠️ These 4 formulas **cannot be copied from iFood/Grub**. Total Wine empirical results:

```
Cho5UEx3PWY=  = HMAC-MD5(uuid, UA)              ✓ accidentally same as iFood
Lx8cFWl9HCE=  = HMAC-MD5(state.vid, UA)         ⭐ NOT uuid+':a'
UiJhKBREYhs=  = HMAC-MD5(state.pxsid, UA)       ⭐ NOT uuid+':b'
EFwjFlU8JyU=  = MD5(state.vid)                   ⭐ single-arg, NOT HMAC
```

Formula recovery SOP: [`skill/AI_re/playbooks/recover-hmac-formulas.md`](../../../skill/AI_re/playbooks/recover-hmac-formulas.md)
Empirical script: [`../script/find_hmac_inputs.py`](../script/find_hmac_inputs.py)

## state.* → EV2 b64 key mapping

| state field | EV2 key | Injection rule |
|---|---|---|
| `state.no` | `YQ1SBydsVTQ=` | `parseInt(state.no)` ⚠️ Gotcha #1 |
| `state.to` | `fEgPAjoqCzE=` | string |
| `state.appId` | `Bzd0fUJTcUc=` | string |
| `state.vid` | (used in `Lx8c`/`EFwj`) | not in EV2.d, but feeds HMAC/MD5 input |
| `state.pxsid` | (used in `UiJh`) | same as above |
| `state.hid` | (form param `hid=` of seq=2 POST) | ⭐ strict-tier-only |
| `state.qa`, `state.cts`, `state.vid` | go to POST form params (`cs=`, `cts=`, `vid=`) | not in EV2 payload |

## Usage

### Way 1: Self-test first

```bash
cd stample/totalwine/px_cookie
node smoke_test.js
# All 22 checks should pass (incl. 6 strict-tier-only checks)
```

### Way 2: Generate cookie directly (CLI)

```bash
# Requires US residential proxy (non-US IP gets captcha immediately)
$env:HTTPS_PROXY = 'http://<user>-session-<id>:<pwd>@<host>:<port>'
node totalwine_px2.js
```

### Way 3: As a module via require

```javascript
const generatePx2 = require('./totalwine_px2');

(async () => {
    const r = await generatePx2();
    console.log(r.cookie_name + '=' + r.cookie_value);
    // Output: _px2=eyJ1IjoiYWJjLi4u
    console.log(`seq=2 beacon: ${r.collector3_status}`);   // must be 200
})();
```

### Way 4: End-to-end demo (Layer 3.5 validation)

```bash
$env:HTTPS_PROXY = 'http://...'
node business_api_demo.js              # default query "wine"
node business_api_demo.js "bourbon"    # query something else
```

### Way 5: 10/10 stability test

```bash
python ../script/smoke_10x_e2e.py
# Expected 10/10 PASS, each iteration ~1.3 MB real HTML
```

## Debug mode: dump EV1/EV2/EV3 to JSON

```bash
DUMP_EV_DIR=../sample/_our_ev node totalwine_px2.js
ls ../sample/_our_ev/
# our_ev1.json, our_ev2.json, our_ev3.json, our_state.json, our_ob1_segments.json
```

Then diff against real batches:

```bash
python ../script/diff_ev2_ours_vs_real.py
```

The diagnostic report covers: field-set diff, type mismatches, STATIC value drift, anti-tamper position, and dict sub-field synchronization (counter sync).

## Strict-tier debug checklist (5 traps)

By hit frequency:

1. **EV2 template baked from polluted batch** → re-bake with `build_templates.js`
2. **HMAC inputs wrong** → run `find_hmac_inputs.py` + 6-batch crypto verification
3. **EV3 (seq=2) skipped** → check generator collector#3 implementation
4. **state.hid not extracted** → `extractState` must handle `OlllOOll|...|true` segment
5. **counter sub-fields independent random** → `PX12738` and `PX12739` must sync

Detail: [`skill/AI_re/references/gotchas.md`](../../../skill/AI_re/references/gotchas.md) Bug #15-#18.

## Validation criteria

| Layer | Pass criterion |
|---|---|
| 1 | `node smoke_test.js` all pass (no network)|
| 2 | 6-batch decode roundtrip (`script/decode_all.js`) |
| 3 | `node totalwine_px2.js` 10 runs → 10 distinct `_px2` |
| **Pre-3.5** ⭐ | **`diff_ev2_ours_vs_real.py` all 6 sections ✅** (mandatory — 2026-05-25 closure) |
| **3.5** ⭐ | `python script/smoke_10x_e2e.py` **10/10** real HTML retrieved |
| Business | `node business_api_demo.js` → 1.3 MB SRP HTML |
