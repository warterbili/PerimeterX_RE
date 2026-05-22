# Stage 1: Capture Preparation

> **Time budget**: 30 min fluent / 1 h first-time
> **Deliverables**: pinned SDK + 9-10 batches of cold-visit captures
> *Merges*: C/§1 (combat workflow) + A/§1 (tooling notes) + B/01_stage1_capture (structure)

---

## Goal

You need inputs that **definitely won't change**:

- A **pinned** SDK (`main.min.js`) with its SHA256 recorded
- **9–10 capture batches** (each: two collector POSTs + two responses), all from the same SDK version

Why pinning the SDK is mandatory: each browser page-load may receive a new PX version, and **all base64 keys can change**. If your 6 capture batches come from 3 SDK versions, the three-class field classification you derive is garbage.

---

## 1.1 Lock the SDK Version (Mandatory)

The main PX SDK URL: `https://client.px-cloud.net/<APP_ID>/main.min.js`

Examples:
- iFood: `https://client.px-cloud.net/PXO1GDTa7Q/main.min.js`
- Grubhub: `https://sensor.grubhub.com/O97ybH4J/init.js` (note Grubhub's file is named `init.js`)

### Method A: Chrome DevTools Local Overrides (Recommended, Simplest)

```
1. F12 → Sources tab
2. Left panel → Overrides → "Select folder for overrides" → choose an empty directory
3. Visit the target URL (e.g., https://client.px-cloud.net/PXO1GDTa7Q/main.min.js)
4. Right-click the file → "Save for overrides"
5. From now on, all requests for this file are overridden by the local copy
```

Pros: UI-based, no scripting.
Cons: only overrides in this single Chrome profile; can't batch-automate.

### Method B: mitmproxy / Charles Rewriting

```python
# mitmproxy addon: lock_sdk.py
def response(flow):
    if 'px-cloud.net/PXO1GDTa7Q/main.min.js' in flow.request.url:
        with open('main_locked.js', 'rb') as f:
            flow.response.content = f.read()
```

Pros: cross-process, cross-profile, can automate in batch.
Cons: requires installing mitmproxy and configuring a certificate.

### Method C: CDP `Fetch.fulfillRequest` (Automated Testing Use)

See the implementation in this project's [`../../../skill/cdp/scripts/`](../../../skill/cdp/scripts/). Most flexible but more code.

### 1.1.x Record the SHA256 (Mandatory)

```bash
sha256sum main.min.js
# b47a639cde9df4f91bdc4138ae0d64ebf7ce8c876a1e4c9967fd3af3d2975eb8

# Save to SDK_INFO.md
echo "# iFood SDK Lock" > SDK_INFO.md
echo "" >> SDK_INFO.md
echo "| SHA256 | $(sha256sum main.min.js | cut -d' ' -f1) |" >> SDK_INFO.md
echo "| Size | $(stat -c%s main.min.js) bytes |" >> SDK_INFO.md
echo "| Captured | $(date -u +%Y-%m-%d) |" >> SDK_INFO.md
```

See [`../../../stample/ifood/source/SDK_INFO.md`](../../../stample/ifood/source/SDK_INFO.md) for the reference format.

---

## 1.2 Prepare Base Tools

| Tool | Purpose | Install |
|---|---|---|
| `node` ≥ 18 | Run reverse modules + decode utilities | nodejs.org |
| Chrome / Edge (with DevTools) | Capture real traffic | Browser |
| Python 3 + `websockets` | cdp-browser skill | `pip install websockets` |
| A clean script editor | Code writing | VS Code etc. |
| `mitmproxy` (optional) | Traffic auditing + SDK locking | `pip install mitmproxy` |
| `jq` (optional) | JSON processing | OS package |

Tools shipped with this project:

```bash
# 9 algorithm modules
ls ../../../revers/
# antitamper.js  hash.js  memory.js  ns.js  ob.js  payload.js  pc.js  sid.js  uuid.js

# 14 CLI scripts
ls ../../../skill/AI_re/scripts/
```

---

## 1.3 Capture 9-10 Samples

### Why 9-10

- **1-2 times** → cannot distinguish STATIC vs DYNAMIC (many fields coincidentally have the same value)
- **3-5 times** → can distinguish STATIC vs DYNAMIC, but easy to miss CONDITIONAL fields
- **6+ times** ⭐ → stably distinguishes 4 classes: STATIC / DYNAMIC / CONDITIONAL / ENTROPY
- **9-10 times** → can identify rare branches (e.g., a field that only appears with 1/8 probability)

**Capture 6 minimum, 9 recommended.**

### Capture Steps (Per Round)

```
0. Open a Chrome Incognito window ⭐⭐⭐ (reopen each time, cookies fully cleared)
1. F12 → Network → tick "Preserve log" → Filter "/api/v2/collector"
2. Visit https://www.ifood.com.br/restaurantes (or your target)
3. Wait 5-10 seconds
4. Observe 2-3 collector POST requests (rsc=1, rsc=2, [rsc=3])
5. Each request: right-click → Copy → Copy as cURL (bash) → save as request_N.txt
6. Each response: copy Response body → save as response_N.json
7. Record meta: UUID, timestamp, SDK SHA256
```

> ⚠️ **Incognito is mandatory**: regular Chrome retains the `_pxvid` cookie → PX classifies as warm visit → some fields (e.g., `pxhd`) get values that differ from cold visit → your "STATIC template" gets polluted. **This is the most commonly overlooked step.**

### Recommended Directory Structure

Mirror this project's [`../../../stample/ifood/sample/`](../../../stample/ifood/sample/):

```
stample/<site>/sample/
├── 1/
│   ├── request_1.txt           collector#1 curl
│   ├── response_1.json         collector#1 response
│   ├── request_2.txt           collector#2 curl
│   ├── response_2.json         collector#2 response
│   ├── request_3.txt           collector#3 curl (optional, EV3 behavior tracking)
│   ├── response_3.json
│   ├── meta.json               { uuid, ts, sdk_sha256, ... }
│   └── decoded_*.json          ← Stage 2 decoded outputs land here
├── 2/
│   ...
└── 6/
```

`meta.json` format: see [`../../../stample/ifood/sample/1/meta.json`](../../../stample/ifood/sample/1/meta.json):

```json
{
  "site": "ifood.com.br",
  "uuid": "c83577f0-5420-11f1-9150-e1cff29e25cc",
  "captured_at": "2026-05-20T14:32:18Z",
  "sdk_sha256": "b47a639c...",
  "warm_visit": false,
  "collector_count": 3
}
```

### Automated Capture (Recommended)

Manually capturing 6 batches is tedious. This project has CDP automation scripts:

```bash
# Use cdp-browser skill to auto-capture N batches
cd ../../../skill/cdp/scripts/
python capture_via_cdp_ifood.py --batches 6 --out ../../../stample/ifood/sample/
```

See [`../../../skill/cdp/SKILL.md`](../../../skill/cdp/SKILL.md).

---

## 1.4 Validate Capture Completeness

After capture, use `verify_all.sh` to check that all files are present in each batch:

```bash
cd ../../../stample/ifood/script/
./verify_all.sh
# Expected: 6/6 pass
```

If any batch has missing files, re-capture.

---

## 1.5 Stage 1 Completion Criteria ✓

| Item | Verification |
|---|---|
| ✅ SDK locked | `sha256sum main.min.js` outputs fixed value |
| ✅ SDK_INFO.md recorded | Contains SHA + Size + Captured |
| ✅ 6+ capture batches | Each contains complete request/response/meta |
| ✅ All batches share the same SDK | `sdk_sha256` in every meta.json is identical |
| ✅ All cold visits | meta.json `warm_visit: false`; new incognito window each batch |
| ✅ All responses are status=200 | Responses extracted from curl are all successful |

---

## 1.6 Common Pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| Six-batch three-class classification shows abnormally high STATIC (90%+) | Captures didn't clear cookies; all warm visits | Re-capture in incognito |
| Some batches' collector#2 don't return cookies | IP score dropped / capture frequency too high | Switch IP / add interval (≥ 30s/batch) |
| SDK SHA inconsistent across batches | PX upgraded the SDK mid-capture | Use Local Overrides to lock |
| `meta.json` missing UUID | Old capture script version | Upgrade capture script, grep `uuid=` from POST body |

---

## 1.7 Proceed to Stage 2

Stage 1 complete → you have pinned SDK + 6+ batch samples → proceed to [Stage 2: Decode](02_stage2_decode.md).
