# New-Site Bridge Onboarding Tutorial (9-Step Walkthrough)

> Port the iFood template to a new site. **Each step explicitly cites which upstream skill is used**.
>
> Assume the new site is called `<site>`; the deliverable is `node_bridge/<site>/` running and producing the target cookie.

> 🔝 **When it doesn't work, escalate to sdenv**: [https://github.com/pysunday/sdenv](https://github.com/pysunday/sdenv)
> Decision criteria are in the "What if it doesn't work?" section at the end + [`methodology.md §7`](methodology.md#7-when-to-escalate-to-sdenv).

---

## Workflow Overview

```
[1] Capture + pin the SDK             ← cdp-browser
[2] Identify base constants            ← inspect SDK / capture real requests
[3] Copy the ifood template            ← bash
[4] Change SDK path + constants        ← Edit
[5] Dump real Chrome fingerprints      ← cdp-browser ⭐
[6] First run + collect crashes        ← jni-env-patching ① + ②
[7] Configure the TLS layer            ← curl_cffi_integrate
[8] Differential comparison + iterate  ← cdp-browser + jni-env-patching ③
[9] Validation + write journal         ← live_validation
```

Estimated total time: **4–8 hours** (same PX vendor, first time).

---

## Step 1: Capture + Pin the SDK

**Skill used**: `cdp-browser`

```bash
# Start Chrome + visit the target site
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py start
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py navigate "https://www.<site>.com"

# Capture SDK loads (PX SDK URLs typically contain client.px-cloud.net or sensor.<site>.com)
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py network 15 | \
    jq '.[] | select(.request.url | test("client\\.px-cloud|sensor\\.|main\\.min\\.js"))'

# Download and pin the SDK (via mitmproxy / curl / DevTools save-as)
curl -o stample/<site>/source/main.min.js https://client.px-cloud.net/<APP_ID>/main.min.js
sha256sum stample/<site>/source/main.min.js > stample/<site>/source/SDK_INFO.md
```

**Expected output**: `stample/<site>/source/main.min.js` (pinned SDK) + SHA256 record.

---

## Step 2: Identify Base Constants

Capture the real collector POST requests from the SDK-loading page, and extract the 4 constants:

| Constant | How to find | Example (iFood) |
|---|---|---|
| **AppID** | SDK URL path / collector URL host | `PXO1GDTa7Q` |
| **Collector URL** | DevTools Network → collector POST domain | `https://collector-pxo1gdta7q.px-cloud.net/api/v2/collector` |
| **Cookie name** | Response `set-cookie` / `do` array bake instructions | `_px3` (iFood) / `_px2` (Grubhub) |
| **Target domain** | Business API main domain | `cw-marketplace.ifood.com.br` |

```bash
# Use cdp-browser to capture collector POSTs and extract AppID
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py network 20 | \
    jq '.[] | select(.request.url | contains("collector")) | .request.url'
# → https://collector-PXOXXXXXX.px-cloud.net/api/v2/collector?app=PXOXXXXXX&tag=...
#                                                            ↑ AppID
```

**Expected output**: 4 constants recorded in `stample/<site>/source/SDK_INFO.md`.

---

## Step 3: Copy the ifood Template

```bash
cd <repo-root>
cp -r node_bridge/ifood node_bridge/<site>
cd node_bridge/<site>

# Drop in the pinned SDK
cp ../../stample/<site>/source/main.min.js perimeterx/

# Clean iFood remnants
rm -rf node_modules .checkpoint
```

**Expected output**: complete `node_bridge/<site>/` directory containing the iFood template code + the new site's SDK.

---

## Step 4: Change SDK Path + Constants

Change constants in **3 files** (use grep to locate them):

### 4.1 `px_node_bridge.js` — change SDK path (if file name differs)

```javascript
// Default is main.min.js — if the SDK file is named init.js / sensor.js etc., change this line
const pxSdkPath = path.join(__dirname, 'perimeterx/main.min.js');
```

### 4.2 `px_cookie_generator.py` — change 4 constants

```python
# Original iFood:
SITE_BASE      = "https://www.ifood.com.br"
COLLECTOR_BASE = "https://collector-pxo1gdta7q.px-cloud.net"
APP_ID         = "PXO1GDTa7Q"
COOKIE_NAME    = "_px3"

# Change to <site>:
SITE_BASE      = "https://www.<site>.com"
COLLECTOR_BASE = "https://collector-<appid_lowercase>.px-cloud.net"
APP_ID         = "<APP_ID>"
COOKIE_NAME    = "_px<2or3>"
```

### 4.3 `px-node-env/env/builder.js` — change targetUrl

```javascript
buildEnvironment({
    targetUrl: 'https://www.<site>.com',     // ← change this
    userAgent: '...'                          // typically unchanged (chrome131)
})
```

**Expected output**: all 4 constants now match the new site.

---

## Step 5: Dump Real Chrome Fingerprints (Critical Step) ⭐

**Skill used**: `cdp-browser`

Execute the 5 command groups from [`methodology.md §3 dump templates`](methodology.md#3-cdp-browser-skill-detailed-dump-templates-direct-paste); paste the output **directly** into the corresponding env files:

```bash
# 5.1 navigator → paste into env/navigator.js
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py navigate "https://www.<site>.com"
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py eval "
  JSON.stringify({...})   # use the full template from methodology.md §3.1
" > /tmp/<site>_navigator_dump.json

# 5.2 screen + window → paste into env/builder.js + env/px_intercept.js
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py eval "
  JSON.stringify({...})   # use methodology.md §3.2
" > /tmp/<site>_screen_dump.json

# 5.3 window enumerable keys → paste into env/px_intercept.js
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py eval "
  Object.keys(window).filter(k => !k.startsWith('_')).sort()
" > /tmp/<site>_window_keys.json

# 5.4 Canvas hash calibration (use methodology.md §3.4)
# → run the same JS in our bridge → diff hash → tune env/canvas.js
```

**Critical**: paste dumped real values **field-by-field** into the hardcoded sections of the relevant `env/*.js`.

**Expected output**:
- `env/navigator.js` contains the complete navigator properties from real Chrome
- `env/builder.js` contains real screen / window dimensions
- `env/px_intercept.js` covers the set-difference vs real Chrome `Object.keys(window)`

---

## Step 6: First Run + Collect Crashes

```bash
cd node_bridge/<site>
npm install --ignore-scripts
npm install canvas@3        # Windows must use @3 prebuilds

# Run the Python orchestrator (with proxy)
SESSION="$(date +%s)$RANDOM"
export HTTPS_PROXY="http://<user>:<pwd>@<host>:<port>"   # for <site>'s region
python px_cookie_generator.py 2>&1 | tee /tmp/<site>_first_run.log
```

**The first run typically crashes**. Inspect `[NODE]` stderr:

| Crash type | jni-env-patching step | Fix |
|---|---|---|
| `TypeError: Cannot read property X of undefined` | ① identify crash | X is missing → patch into the right env file |
| `TypeError: navigator.userAgentData.brands is not a function` | ① + ② | Missing userAgentData → patch env/navigator.js |
| `TypeError: window.AudioContext is not a constructor` | ① + ② | Missing AudioContext → patch env/audio.js |
| SDK doesn't crash but PX returns 403 / px-captcha | ③ assigned values aren't right | Jump to Step 8 differential comparison |

For each crash:
1. Identify which API errored
2. **Use cdp-browser to dump real Chrome values for that API** (jni-env-patching ② "inspect real env")
3. Paste into the relevant `env/*.js` (jni-env-patching ③ "assign reasonable values")
4. Re-run

Continue until stderr is TypeError-free.

**Expected output**: bridge runs without crashing + Node prints a `type=result` JSON. `_px3` may still be empty (continue to Steps 7–8).

---

## Step 7: Configure the TLS Layer

**Skill used**: `curl_cffi_integrate_scrapy_performance`

Check the session configuration in `px_cookie_generator.py`:

```python
# This line is mandatory
self.session = curl_requests.Session(impersonate="chrome131")
```

**Key checks**:
- ✅ impersonate is `chrome131` (matches env/navigator.js UA Chrome/131)
- ✅ Session is reused (don't create a new session per request — TLS handshake info changes)
- ✅ If the site forces HTTP/2, confirm curl_cffi ≥ 0.7 (earlier versions have weak H2 support)

```python
# Verify TLS fingerprint is correct
python -c "
from curl_cffi import requests
s = requests.Session(impersonate='chrome131')
r = s.get('https://tls.peet.ws/api/all')
import json
d = r.json()
print('JA3:', d['tls']['ja3_hash'])
print('JA4:', d['tls']['ja4'])
print('HTTP/2 settings:', d['http2']['sent_frames'])
"
# Expected: JA3 matches real Chrome 131
```

**Expected output**: TLS fingerprint fully emulates real Chrome 131.

---

## Step 8: Differential Comparison + Iteration ⭐

**Core step**: when the bridge runs without crashing but `_px3` scores low → use differential comparison to find **which fields are wrong**.

**Skills used**: `cdp-browser` + `jni-env-patching` ③④

### 8.1 Capture the real Chrome collector POST body

```bash
# Launch Chrome + clean session + 30 s capture
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py start
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py navigate "https://www.<site>.com"
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py network 30 > /tmp/<site>_real_chrome_traffic.json

# Extract collector POST body
jq '.[] | select(.request.url | contains("collector")) | .request.postData' \
   /tmp/<site>_real_chrome_traffic.json > /tmp/<site>_real_post.txt
```

### 8.2 Capture our bridge's collector POST body

Modify `px_cookie_generator.py`'s `_proxy_request` to dump request bodies to a file:

```python
def _proxy_request(self, msg):
    # Add these two lines (debugging)
    with open(f'/tmp/<site>_bridge_post_{msg["id"]}.txt', 'w') as f:
        f.write(msg.get('body') or '')
    # ... original code
```

Run the bridge to collect the dump.

### 8.3 Diff EV1 / EV2 fields

```bash
# Use revers/payload.js to decode (the project already provides this)
node skill/AI_re/scripts/decode_payload.js /tmp/<site>_real_post.txt > /tmp/<site>_real_decoded.json
node skill/AI_re/scripts/decode_payload.js /tmp/<site>_bridge_post.txt > /tmp/<site>_bridge_decoded.json

# diff
diff <(jq -S . /tmp/<site>_real_decoded.json) <(jq -S . /tmp/<site>_bridge_decoded.json)
```

**Output format**:

```diff
- "field_001": "Win32"
+ "field_001": "MacIntel"
     ↑ navigator.platform wrong → fix env/navigator.js
- "field_034": "5da3b8e2..."
+ "field_034": "00000000..."
     ↑ canvas hash wrong → check env/canvas.js + @napi-rs/canvas fonts
- "field_087": "<hash>"
+ "field_087": "<other_hash>"
     ↑ Object.keys(window) hash wrong → add missing props to env/px_intercept.js
```

### 8.4 Fix Field-by-Field

For each diff:
1. Use **cdp-browser** to query the real Chrome value for that API
2. Paste the real value into the relevant `env/*.js`
3. Re-run → re-diff
4. Diffs shrink until EV1/EV2 are byte-identical

**Expected output**: the bridge produces a non-empty `_px3` (e.g., `len > 500`).

---

## Step 9: Validation + Write Journal

### 9.1 End-to-end Business API Call

Use the template from `stample/live_validation/journal/2026-05-21.md`:

```bash
# 1. Obtain _px3 (already done in Step 8)
# 2. Use this _px3 to call the real <site> business API
python -c "
from px_cookie_generator import PXCookieGenerator
gen = PXCookieGenerator(verbose=True, proxy='$HTTPS_PROXY')
px3 = gen.generate()
# Call business API with _px3
import curl_cffi.requests as r
resp = r.get('https://<site>/v1/api/...', cookies={'_px<n>': px3}, ...)
print('Business API:', resp.status_code, resp.text[:200])
"
```

Expect HTTP 200 + real business data.

### 9.2 Write the Journal

Copy `stample/live_validation/journal/2026-05-21.md` and rename to `<YYYY-MM-DD>.md`:

```markdown
# YYYY-MM-DD <site> Node Bridge Combat Record

## Dual-site Verified Conclusion
- <site>: _px<n> via bridge + Business API HTTP 200 ✓

## Part 1 · <site>
### 1.1 API Overview (...)
### 1.2 Risk Architecture (...)
### 1.3 IP Requirements (...)
### 1.4 Production Code → node_bridge/<site>/
### 1.5 Real Request + Response (complete HTTP)
### 1.6 PX Research Insights (new findings this round)

## Gotchas Encountered
- ...
```

### 9.3 Write the Site's README

Add to `node_bridge/<site>/README.md`:

```markdown
# Node Bridge — <site>

## SDK Version
SHA: <sha256>
Pin date: YYYY-MM-DD

## Working Commands
\`\`\`bash
npm install
export HTTPS_PROXY='http://<user>:<pwd>@<host>:<port>'   # <region> residential
python px_cookie_generator.py
\`\`\`

## Expected Output
\`\`\`
✅ _px<n> SUCCESS! len=...
   first 80: ...
   _pxvid: ...
\`\`\`

## Differences From the ifood Template
- AppID: ...
- Collector: ...
- Cookie: ...
- env/navigator.js diffs: ...

## Journal
- First successful run: stample/live_validation/journal/YYYY-MM-DD.md
```

**Expected output**: `node_bridge/<site>/README.md` + journal entry complete.

---

## Completion Checklist

- [ ] Step 1: SDK pinned + SHA recorded
- [ ] Step 2: 4 constants identified
- [ ] Step 3: Template copy successful
- [ ] Step 4: 3 files' constants updated
- [ ] Step 5: 5 groups of real Chrome dumps pasted into env/
- [ ] Step 6: Bridge runs crash-free; produces type=result JSON
- [ ] Step 7: TLS uses chrome131
- [ ] Step 8: EV1/EV2 diff fields fully aligned
- [ ] Step 9: Business API HTTP 200 + journal complete

---

## What If It Doesn't Work?

Use the decision tree in [`methodology.md §7 When to Escalate to sdenv`](methodology.md#7-when-to-escalate-to-sdenv):

- **Errors mention V8-level detections like `typeof document.all`, `Function.prototype.toString`, `Error().stack`** → escalate to sdenv
- **Just missing APIs / wrong values** → keep iterating with the 4 techniques in §2

---

*Tutorial v1.0 · Authored from iFood combat experience · 2026-05-22*
