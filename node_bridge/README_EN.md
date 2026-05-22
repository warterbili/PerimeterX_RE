# 🌉 Node Bridge — Plan B Environment-Patching Approach

> The project's **pure-algorithm track** (`stample/{ifood,grub}/px_cookie/`) is the primary recommended approach. This directory holds the **fallback / environment-patching track**:
> JSDOM boots a browser world → loads the real PX SDK → the SDK runs itself → requests are forwarded via Python `curl_cffi` → returns `_px3`.

> 🔝 **Fallback escalation path**: when this bridge cannot pass (e.g., when it hits V8-level detection such as `typeof document.all`), escalate to
> [**sdenv** (github.com/pysunday/sdenv)](https://github.com/pysunday/sdenv) — the 718⭐ public env-patching ceiling,
> a jsdom fork patched at the C++ layer. See §10/§11 + `skill/methodology.md §7`.

---

## 0. TL;DR — 30-second Overview

```
                Python (curl_cffi chrome131 TLS)              Node (JSDOM)
                ─────────────────────────────────             ─────────────────
                                                                                
       1. Visit ifood homepage                                                 
          → obtain Akamai bm_ss/bm_s/bm_so                                     
                                                                                
       2. spawn ──────────────────────────────────────→  px_node_bridge.js     
                                                          ├ build JSDOM browser env
                                                          ├ install 11 env modules
                                                          ├ override XHR + fetch
                                                          ├ load PX SDK (main.min.js)
                                                          └ SDK begins running…
                                                                                
       3. stdout ← {type:"request", url:"...collector"}   SDK sends request (caught by ProxyXHR)
                                                                                
       4. curl_cffi forward (chrome131 TLS) ──────────→  real PX collector
                                                                                
       5. stdin → {status:200, body:"..."}     ─────→   ProxyXHR resolve()
                                                          SDK receives response
                                                          processes → document.cookie writes _px3
                                                                                
       6. stdout ← {type:"result", px3:"...", pxvid:"..."}
                                                                                
       7. Python extracts _px3 + _pxvid, end-to-end complete ✓
```

**Core insight**: Node's default TLS fingerprint is instantly recognized by PX. **Python's chrome131 TLS emulation is mandatory** for the SDK to complete the full collector chain.

---

## 1. Comparison with Pure-algo + Decision Tree

| Dimension | Pure-algo (primary) | Node Bridge (Plan B) |
|---|---|---|
| Speed | 350 ms / cookie | 30-60 s / cookie |
| Memory | < 50 MB | 200+ MB (JSDOM is heavy) |
| Network | Direct https | Must go through Python curl_cffi forwarding |
| SDK upgrade impact | Rewrite generator (1-2 days) | **Just run the new SDK** (0 modifications) |
| New-site onboarding | Full reverse (15 h) | Change 1 URL + drop in SDK (30 min) |
| Maintenance cost | High | Low |
| Score stability | Depends on algorithm correctness | **Always max score** (real SDK) |

**When to use Plan B**:
- SDK major rollout temporarily breaks pure-algo → no panic, the bridge keeps running
- Spike a new site → 30 minutes to see if cookies come out, then decide whether pure-algo is worth it
- High-threshold Bundle endpoints → real SDK scores higher than pure-algo

**When NOT to use**:
- High-throughput production (> thousands of cookies / hour) → the bridge is too slow

---

## 2. How JSDOM "Patches" Up a Browser

The PX SDK assumes it runs in a real browser — it touches dozens of browser APIs such as `window.navigator.userAgent`, `HTMLCanvasElement`, `AudioContext`, `performance.memory`, `screen.width`, etc.

Node.js lacks these APIs. **JSDOM provides a base DOM + Window** (~80% of standard APIs), but still misses fingerprint-related ones (actual canvas rendering, audio processing, navigator.userAgentData, etc.).

**`ifood/px-node-env/env/` patches them with 11 categorized files**:

| File | Lines | What it patches | Why patch it |
|---|---|---|---|
| `builder.js` | ~400 | Main entry — creates JSDOM + loads the other 10 modules | Must have window + document first |
| `navigator.js` | ~80 | `navigator.userAgentData`, `platform`, `vendor`, `language(s)` | SDK uses these for client hints + UA validation |
| `browser_apis.js` | ~150 | `IntersectionObserver`, `ResizeObserver`, `MutationObserver`, `PerformanceObserver` | SDK watches DOM mutations |
| `canvas.js` | ~120 | HTMLCanvasElement context + WebGL stub (via `canvas` npm package) | Canvas/WebGL fingerprint hash |
| `audio.js` | ~80 | `AudioContext`, `OfflineAudioContext` + deterministic sine wave | AudioContext fingerprint |
| `fonts.js` | ~50 | `document.fonts` API + canvas measureText | Font enumeration fingerprint |
| `events.js` | ~200 | `MouseEvent`/`KeyboardEvent`/`TouchEvent` + simulated mousemove/click/scroll | SDK detects user interaction (key headless-suspicion signal) |
| `network.js` | ~50 | `navigator.connection` (`effectiveType`, `rtt`, `downlink`) | Connection API fingerprint |
| `tls_fingerprint.js` | ~30 | navigator.languages, RTC stub | Anti-headless detection |
| `stealth.js` | ~80 | `navigator.webdriver=false`, hide `__nightmare`, override `chrome` object | Anti-headless detection |
| `px_intercept.js` | ~60 | `_pxAppId`, `_pxUuid`, `_pxVid` window globals + window.PX hooks | PX SDK checks self-init state |

**Note**: The `canvas` npm package is a peer dependency of jsdom; it **must be installed for canvas/WebGL fingerprint hashes to compute correctly** (otherwise the SDK detects an anomaly and aborts).

---

## 3. Hijacking Mechanism: How SDK Requests Get Routed to Python

JSDOM normally issues real HTTP requests (via Node's built-in `http`/`https`) — **Node's TLS fingerprint isn't Chrome**, and PX instantly identifies this and blocks at `/ns`.

Solution: **`px_node_bridge.js` lines 22-203** fully override `window.XMLHttpRequest` and `window.fetch` so they **don't actually issue requests** — they only print the request JSON to stdout for Python to forward:

### 3.1 XHR Interception (lines 54-165)

```javascript
class ProxyXHR {
    async send(data) {
        const id = ++requestId;
        // Don't send the request! Just write metadata to stdout
        process.stdout.write(JSON.stringify({
            type: 'request', id, method: this._method, url, headers, body: data
        }) + '\n');

        // Wait for Python to write the response back via stdin
        const resp = await waitForResponse(id);

        this.status = resp.status;
        this.responseText = resp.body;
        // Inject back into the SDK
        if (this.onload) this.onload({type:'load', target:this});
    }
}
window.XMLHttpRequest = ProxyXHR;  // ★ global replacement
```

### 3.2 fetch Interception (lines 170-200)

Similar to XHR — rewrites `fetch()` into stdout-JSON-out + stdin-JSON-in.

### 3.3 PX bake Instruction Handling ⭐ (lines 127-139)

The PX collector response contains a `do` array with `bake|cookie_name|cookie_value` instructions:

```json
{
  "do": [
    "bake|_px3|abc...xyz=",
    "bake|_pxvid|c8357..."
  ]
}
```

The bridge parses this array and **manually** executes `document.cookie = name=value`. This is the way the PX SDK issues cookies to the browser, and it must be recognized and executed inside the bridge — otherwise the SDK runs the full chain but cookies never appear in `document.cookie`.

---

## 4. How to Pin the SDK

`px_node_bridge.js` line 215 decides which SDK file to load:

```javascript
const pxSdkPath = path.join(__dirname, 'perimeterx/main.min.js');
```

To upgrade the SDK:

```bash
# 1. Capture the latest version from a browser (DevTools Local Override or mitmproxy)
# 2. Overwrite the SDK file
cp /path/to/new/main.min.js ifood/perimeterx/main.min.js
# 3. Record the SHA in stample/ifood/source/SDK_INFO.md
sha256sum ifood/perimeterx/main.min.js
```

**Zero cross-version compatibility issues** — the bridge knows nothing about SDK contents, it just runs the file. Replacing the new SDK is sufficient.

> 💡 **Currently pinned SDK**: `ifood/perimeterx/main.min.js` is the same source as `stample/ifood/source/main.min.js`
> SHA256: `b47a639cde9df4f91bdc4138ae0d64ebf7ce8c876a1e4c9967fd3af3d2975eb8`

---

## 5. How to Patch the Environment for a New Site

To build a bridge for a new site like Grubhub / Walmart:

```bash
# 1. mkdir for the new site
mkdir -p node_bridge/<site>/{perimeterx,px-node-env/env}

# 2. Reuse the 11 env files (80%+ generic)
cp ifood/px-node-env/env/*.js <site>/px-node-env/env/

# 3. Reuse px_node_bridge.js + px_cookie_generator.py; change:
#    - SDK path (line 215)
#    - IFOOD_BASE / APP_ID / COLLECTOR_BASE constants
#    - targetUrl (passed to buildEnvironment)

# 4. Pin the new site's SDK
cp stample/<site>/source/<sdk_file>.js <site>/perimeterx/

# 5. Trial run
cd <site> && python px_cookie_generator.py
```

**Typically only 2-3 env files need tweaking** (e.g., changing navigator.platform to Linux).

---

## 6. Full End-to-end Run (iFood Verified)

### 6.1 Setup

```bash
# Install Node deps
cd node_bridge/ifood
npm install --ignore-scripts        # canvas native build requires MSBuild, skip install scripts
npm install canvas@3                # canvas@3 has Windows prebuilds, auto-downloads

# Install Python deps
pip install curl_cffi
```

### 6.2 Set Proxy (BR Brazilian Residential Required)

```bash
export HTTPS_PROXY='http://<user>:<pwd>@<host>:<port>'
```

### 6.3 Run

```bash
python px_cookie_generator.py
```

### 6.4 Real Output (Verified 2026-05-21)

```
[PX] Starting PX cookie generation via Node bridge...
[PX] Visiting ifood homepage...
[PX] Homepage: 200, cookies: ['bm_ss', 'bm_s', 'bm_so']     ← Akamai BMP accepted
  [NODE] [BRIDGE] Starting PX Node Bridge...
  [NODE] [BROWSER_APIS] Missing browser APIs installed
  [NODE] [STEALTH] Stealth patches installed
  [NODE] [FONTS] Font detection support installed
  [NODE] [AUDIO] AudioContext mock installed
  [NODE] [EVENTS] Event simulation installed
  [NODE] [PX_INTERCEPT] Missing browser properties installed
  [NODE] [ENV] Environment built successfully
  [NODE] [BRIDGE] Proxy network layer installed
  [NODE] [BRIDGE] Loading PX SDK (231438 bytes)...
[PX] Proxying request 1: GET https://tzm.px-cloud.net/ns?c=a3003297-5538-11f1-...
[PX] Response 1: 200 (168 bytes)                            ← /ns warmup
[PX] Proxying request 2: POST https://collector-PXO1GDTa7Q.px-cloud.net/api/v2/collector
[PX] Response 2: 200 (1788 bytes)                           ← EV1 (anonymous events)
[PX] Proxying request 3: POST https://collector-PXO1GDTa7Q.px-cloud.net/api/v2/collector
[PX] Response 3: 200 (372 bytes)                            ← EV2 (full fingerprint)
[PX] Proxying request 4: POST https://collector-PXO1GDTa7Q.px-cloud.net/api/v2/collector
[PX] Response 4: 200 (372 bytes)                            ← EV3 state echo
  [NODE] [BRIDGE] Done. Cookies: _pxvid=a3003297-...; _px3=2772e4cf9eab...
[PX] Got result: px3=yes
[PX] Success! _px3 length: 631

============================================================
✅ _px3 SUCCESS! len=631
   first 80: 2772e4cf9eab2076fdf4cc18ae7e9aae8e55044fc70a6c0a3ad51a9e23c633b8:Aaj/Wrwg8q705U/
   _pxvid: a3003297-5538-11f1-ae93-487d42ff6c51
============================================================
```

Total time ~50 seconds (30 s for the bridge waiting on SDK processing + 10 s of curl network RTT).

---

## 7. Debugging Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| SDK stuck at `/ns`, no follow-up POSTs | Node's default TLS ≠ Chrome; PX recognizes and aborts | **Must** use Python curl_cffi chrome131; don't run the Node bridge directly |
| `Errno 22 Invalid argument` (Python) | Node bridge already exited but Python still writing to stdin | `px_cookie_generator.py` now includes BrokenPipeError handling |
| Node bridge doesn't get `_px3` within 30 s | SDK chain needs 4 collector POSTs; slow links exceed 30 s | Increase `px_node_bridge.js` line 228 setTimeout |
| `Failed to perform, curl: (28) Connection timed out` | Single curl_cffi request timeout | Increase `px_cookie_generator.py` `timeout=30` |
| canvas native build fail (Windows) | Missing MSBuild | `npm install canvas@3` (has Windows prebuilds) |
| iFood homepage 403 | Not using BR Brazilian proxy, blocked by Cloudflare | Set HTTPS_PROXY to a Brazilian residential proxy |

---

## 8. File Manifest

```
node_bridge/
├── README.md / README_EN.md                ← This file (bilingual)
└── ifood/                                  ← Working example
    ├── package.json                        ← jsdom + canvas
    ├── perimeterx/
    │   └── main.min.js                     ← PX SDK (231 KB, pinned version)
    ├── px_node_bridge.js                   ← Node bridge (IPC + JSDOM + interception)
    ├── px_cookie_generator.py              ← Python orchestrator (curl_cffi chrome131)
    └── px-node-env/
        └── env/                            ← 11 JSDOM augmentation modules
            ├── audio.js
            ├── browser_apis.js
            ├── builder.js                  ← Main builder
            ├── canvas.js
            ├── events.js
            ├── fonts.js
            ├── navigator.js
            ├── network.js
            ├── px_intercept.js
            ├── stealth.js
            └── tls_fingerprint.js
```

**Grubhub adaptation follows the same template**: copy `ifood/` → `grub/`, change the SDK path + URL constants + targetUrl. The Grubhub SDK is already pinned at `stample/grub/source/init.js` (SHA `49c64f02bd71...`).

---

## 9. When to Switch Back to Pure-algo

Once Plan B obtains an `_px3`, **strongly recommend** switching back to pure-algo:

1. 100× faster (350 ms vs 50 s)
2. 4× less memory (< 50 MB vs 200+ MB)
3. Faster Bundle SDK upgrade response (no jsdom compatibility dependency)

Plan B's core value is **a fallback for emergencies during PX SDK upgrades** — keeping production running while giving pure-algo time to recover.

---

## 10. Three-layer Fallback Architecture (Project's Full Anti-bot Strategy)

```
┌─────────────────────────────────────────────────────────────┐
│   Pure-algo (revers/ + stample/<site>/px_cookie/)            │
│   - 350 ms / cookie · primary high-throughput production     │
│   - High maintenance cost; SDK major rollouts require rewrite│
└──────────────┬──────────────────────────────────────────────┘
               │ When pure-algo temporarily fails
               ▼
┌─────────────────────────────────────────────────────────────┐
│   Our node_bridge (jsdom base + 11 env + Python TLS)         │  ← This directory
│   - ~50 s / cookie · production-verified against iFood PX    │
│   - jsdom JS-layer patches are sufficient                    │
│   - Low maintenance (just swap the SDK)                      │
└──────────────┬──────────────────────────────────────────────┘
               │ When our bridge also fails (spec quirks like typeof document.all)
               ▼
┌─────────────────────────────────────────────────────────────┐
│   sdenv (https://github.com/pysunday/sdenv)  ← Final fallback│
│   - 718⭐ · public env-patching ceiling                       │
│   - jsdom fork patched at C++ layer (defeats JS-layer-       │
│     impossible detections)                                   │
│   - Plugin system, easy to extend                            │
│   - Production target: Ruishu VMP (more brutal than PX)      │
│   - When to escalate: see skill/methodology.md "When to      │
│     escalate to sdenv"                                       │
└─────────────────────────────────────────────────────────────┘
```

**Decision matrix across the 3 layers**:

| Scenario | Choose |
|---|---|
| Already reversed, stable production | Pure-algo |
| Pure-algo emergency repair / new-site spike | Our bridge |
| Hits typeof / Proxy detect / V8-level detection | sdenv |
| High-threshold endpoint (e.g., iFood feed) score too low | Depending on case, escalate to sdenv or use a real browser |

---

## 11. Environment-Patching Ecosystem Comparison (Reference)

### Real-browser-dependent track (heavy but high-fidelity, ~1-3 s / cookie)

| Framework | Strengths | Weaknesses |
|---|---|---|
| **puppeteer-extra-plugin-stealth** (7,000⭐) | 30+ patches / most mature internationally / full Chrome | Heavy 200+ MB / slow startup |
| **undetected-chromedriver** (Python) | Cleanest webdriver-flag scrubbing | Selenium dependency |
| **nodriver** (Python, new 2025) | Zero webdriver flags / by the undetected-cd author | Smaller Python ecosystem |
| **playwright-stealth** | Lighter than puppeteer-extra | Playwright ecosystem |
| **fakebrowser** (JS) | Large fingerprint pool | Maintenance is light |
| **browserless** (SaaS) | Hosted, saves ops | Paid commercial |

### Browser-free track (light but requires patching, ~50 s / cookie) ⭐ this project's path

| Framework | Strengths | Weaknesses / Use case |
|---|---|---|
| **sdenv** (718⭐) ⭐⭐⭐ | **jsdom fork + C++ patches** / plugin system / Ruishu VMP combat-tested | Strongest fallback / primarily targets Chinese anti-bot |
| **jsdom** (base library) | De-facto industry standard / W3C-compliant | **Bare runtime offers no anti-detection** (need 30+ manual patches) |
| **happy-dom** | 2-3× faster than jsdom / less memory | **Incomplete API**: PX/Akamai SDKs cannot run (missing MutationObserver / IntersectionObserver and other key APIs) |
| **linkedom** | Extremely fast / extremely small (no JS engine) | **Cannot run JS SDKs**, only DOM parse (suitable for static HTML parsing, not anti-bot) |
| **deno_dom** | Rust impl / safe sandbox | Small Deno ecosystem / poor PX SDK fit |
| **JsRPC** (Frida-based) | Real browser with a backdoor, Python calls JS functions | Requires resident browser (essentially a hybrid approach, not pure env-patching) |
| **AST restoration** (Babel + toolchain) | Modify SDK code to run on bare V8 (no DOM needed) | Each SDK upgrade requires redoing AST restoration |

### This Project's Position in the Ecosystem

Frankly:
- Weaker than puppeteer-extra-plugin-stealth (they have 30+ patches + industrial-grade maintenance)
- Weaker than sdenv (they have C++-level forking + plugin system)
- **But specialized in PX** (3 years of iFood/Grubhub combat + detailed journal)

**Positioning**: An adequate Plan B internal tool. Not contending for the open-source ceiling. **For tougher scenarios, escalate to sdenv** ⭐.

---

## 12. AI Skill — Let AI Build a Bridge for a New Site

The `skill/` directory contains AI skills for Claude Code / Cursor, letting the AI carry the methodology and automatically build a bridge for a new site:

| File | Purpose |
|---|---|
| [`skill/SKILL.md`](skill/SKILL.md) | AI invocation entry (frontmatter + trigger scenarios + step index) |
| [`skill/methodology.md`](skill/methodology.md) | Methodology (4 discovery techniques + tri-skill synthesis + sdenv references + escalation decisions) |
| [`skill/new_site_guide.md`](skill/new_site_guide.md) | 9-step practical tutorial for new-site adaptation |

User trigger: `@node_bridge/skill/SKILL.md  build a bridge for walmart`

---

*Document date 2026-05-22 · Verified end-to-end iFood `_px3` capture*
