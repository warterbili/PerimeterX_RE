# Node Bridge Environment-Patching Methodology

> This document targets **AI agents that automatically build node_bridges**. The core questions it addresses:
> **How do we know what to patch? How do we patch reasonably? How do we debug when it doesn't work? When do we give up and escalate to sdenv?**

> 🔝 **Escalation project**: [**sdenv** — https://github.com/pysunday/sdenv](https://github.com/pysunday/sdenv)
> · 718⭐ · jsdom fork at the C++ layer · companion pure-algo project [rs-reverse](https://github.com/pysunday/rs-reverse)
> · Detailed reference in §5, escalation decisions in §7

---

## 0. Three-Skill Synthesis Diagram ⭐

The Node bridge **didn't grow out of nothing**. It is an **organic synthesis** of 3 upstream skills + jsdom + 11 env modules + a Python TLS layer:

```
   ┌─────────────────────────────┐    ┌──────────────────────────────┐
   │   cdp-browser skill         │    │   jni-env-patching skill     │
   │   (upstream — real values)  │    │   (methodology — 4-step)     │
   │                             │    │                              │
   │   - launch real Chrome      │    │   ① identify crash error     │
   │   - eval any JS, dump real  │    │   ② inspect real env (Java/  │
   │   - capture navigator/screen│    │      Chrome)                 │
   │   - capture canvas/audio    │    │   ③ assign reasonable values │
   │   - capture real collector  │    │   ④ when unsure hook real    │
   │     POST traffic            │    │      device / real Chrome    │
   └──────────┬──────────────────┘    └──────────┬───────────────────┘
              │                                   │
              │   (analogy)                       │
              │   JNI patches Android Java layer  ≡  env/ patches Browser DOM layer
              │                                   │
              ▼                                   ▼
   ┌────────────────────────────────────────────────────────────────┐
   │            node_bridge/<site>/                                  │
   │                                                                  │
   │   ┌────────────────────────────────────────────────────────┐   │
   │   │ Layer 1: env/*.js (11 env-patching modules)             │   │
   │   │  ← cdp-browser dump → hardcoded real values             │   │
   │   │  ← jni-env-patching 4-step iterated mock set            │   │
   │   │  ← each module covers a class of fingerprint APIs       │   │
   │   │     (navigator/canvas/audio/fonts/events/...)           │   │
   │   └────────────────────────────────────────────────────────┘   │
   │                                                                  │
   │   ┌────────────────────────────────────────────────────────┐   │
   │   │ Layer 2: px_node_bridge.js                              │   │
   │   │  ← JSDOM (jsdom@22 npm package) provides window/document│   │
   │   │  ← override window.XMLHttpRequest / window.fetch        │   │
   │   │     → intercept but don't send; emit JSON to Python     │   │
   │   │  ← handle PX bake|cookie instructions (do[] array)      │   │
   │   └────────────────────────────────────────────────────────┘   │
   │                                                                  │
   │   ┌────────────────────────────────────────────────────────┐   │
   │   │ Layer 3: px_cookie_generator.py                         │◀──┐
   │   │  ← Python main process, spawns Node bridge              │   │
   │   │  ← curl_cffi(impersonate='chrome131') actually sends    │   │
   │   │  ← stdio IPC: read Node output / write Node input       │   │
   │   │  ← parse final _px3 cookie                              │   │
   │   └────────────────────────────────────────────────────────┘   │
   └────────────────────────────────────────────────────────────────┘
                                                                       │
                                  ┌────────────────────────────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────────────┐
                  │   curl_cffi_integrate skill (network) │
                  │                                        │
                  │   - chrome131 TLS full emulation       │
                  │   - HTTP/2 SETTINGS / WINDOW_UPDATE    │
                  │   - JA3 / JA4 fingerprint auto-match   │
                  │   - reuse Chrome's cipher ordering     │
                  └───────────────────────────────────────┘
```

## 0.x Three-Skill Contribution Mapping

| Concern | Source skill | Role in the bridge | Concrete file |
|---|---|---|---|
| How to know real Chrome values | **cdp-browser** | One-shot dump of real Chrome JS values | The **source** of hardcoded data in `env/*.js` |
| How to decide what to patch + how to change it | **jni-env-patching** | Iterative methodology (4-step method) | How `env/*.js` grew from blank to 11 files |
| How to keep PX from spotting TLS | **curl_cffi_integrate** | Network-layer TLS emulation | `px_cookie_generator.py` uses chrome131 |
| How to build a fake browser world | **This skill + jsdom** | DOM container + 11 env + IPC interception | `px_node_bridge.js + env/*.js` |
| How to dump fingerprint hashes | **cdp-browser** | Capture real canvas / audio / font hashes | `env/canvas.js` + `env/audio.js` |

---

## 1. Core Principle (Inherited from jni-env-patching)

**"Inspect the real environment first, then assign reasonable values. No blind patching."**

The analogy:

| Dimension | JNI env-patching (Android) | **Browser env-patching (this skill)** |
|---|---|---|
| Platform | unidbg + Android SO | Node + jsdom |
| Missing piece | JNI callback back to Java layer | Browser API (navigator/canvas/audio) |
| Error form | `UnsupportedOperationException` | `TypeError: ... is not a function` |
| Solution | `AbstractJni` override callback | `env/*.js` override window properties |
| Inspect the real env | JADX / apktool smali to read Java layer | DevTools / **cdp-browser** to read real Chrome |
| When unsure | Frida hook a real device | **cdp-browser** dumps real Chrome |

**Things you must NOT do**:
- Hand out random values (e.g., `screen.width = 1234`) → only values that match real Chrome are meaningful
- Copy mock values from random projects online → those may target different vendors; PX won't accept them
- Try to mock every browser API → impossible (the DOM has 1000+ APIs)

---

## 2. Four Discovery Techniques (How to Find What to Patch) ⭐⭐

### Technique 1: Static grep (coarse SDK filtering)

```bash
# beautify the SDK
npx js-beautify perimeterx/<sdk>.js > /tmp/sdk_pretty.js
wc -l /tmp/sdk_pretty.js   # typically 10,000+ lines

# grep known fingerprint API calls
grep -n "navigator\.userAgent" /tmp/sdk_pretty.js
grep -n "Object\.keys(window)" /tmp/sdk_pretty.js
grep -n "canvas\.toDataURL\|getContext('2d')" /tmp/sdk_pretty.js
grep -n "new AudioContext\|new OfflineAudioContext" /tmp/sdk_pretty.js
grep -n "navigator\.plugins\|navigator\.mimeTypes" /tmp/sdk_pretty.js
grep -n "screen\.width\|screen\.colorDepth" /tmp/sdk_pretty.js
grep -n "performance\.memory\|performance\.now" /tmp/sdk_pretty.js
grep -n "WebGLRenderingContext\|getSupportedExtensions" /tmp/sdk_pretty.js
```

Each grep hit reveals a wrapper function name (minified — they look like `xS()`, `hQ()`, 2-3 characters).

**Output**: a list of suspect wrapper functions (10–20).

### Technique 2: Dynamic breakpoints (real Chrome + DevTools)

```bash
# Start real Chrome with the cdp-browser skill
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py start
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py navigate "https://<target_site>"

# In DevTools Console:
debug(xS)      // breakpoint on SDK's xS function
debug(mh)      // breakpoint on SDK's mh function

# Reload the page → the SDK breaks when it hits these functions
# Inspect call stack / arguments / internal logic
```

**Output**: a clear understanding of what each wrapper does (fingerprint collection / hash / serialization).

### Technique 3: Differential comparison ⭐ (the most efficient)

**Core idea**: run the same SDK in two environments and diff the EV2 POST body:

```python
# A. Real Chrome — capture collector POST body
import subprocess
real_post = subprocess.check_output(['python', cdp_script, 'network', '15'])
# Extract collector POST payload field

# B. JSDOM (no env mocks) — capture POST body
node_post = run_bridge_no_mocks()  # output from our bridge

# Decode + diff EV2 fields
diff_ev2(real_post, node_post)
# Output is something like:
#   field_001: 'Win32' vs 'MacIntel'         → navigator.platform mismatch
#   field_034: '5da3b8...' vs '00000000...'   → canvas hash mismatch
#   field_087: hash_A vs hash_B               → Object.keys(window) mismatch
```

**Output**: precise knowledge of which fields are wrong → direct mapping to which API to patch. This is **the most economical** technique; use it every iteration.

### Technique 4: Proxy monitoring (god-tier trick)

Wrap navigator/document/window in a Proxy and **log which properties the SDK actually reads**:

```javascript
// add to env/builder.js (during debugging)
window.navigator = new Proxy(window.navigator, {
    get(target, prop) {
        console.log(`[PX-READ] navigator.${String(prop)}`);
        return target[prop];
    }
});
window.screen = new Proxy(window.screen, {
    get(target, prop) {
        console.log(`[PX-READ] screen.${String(prop)}`);
        return target[prop];
    }
});

// Run the SDK → console shows every property PX actually reads
//   [PX-READ] navigator.userAgent
//   [PX-READ] navigator.userAgentData      ← jsdom lacks this
//   [PX-READ] navigator.connection         ← jsdom lacks this
//   [PX-READ] navigator.hardwareConcurrency
//   ... (50+ properties)
//   [PX-READ] screen.width
//   [PX-READ] screen.colorDepth
```

**Output**: a complete list of APIs that must be mocked.

**Caveat**: Proxy cannot be applied to a frozen object (some jsdom prototypes are frozen). On failure, fall back to `Object.defineProperty` with a getter.

---

## 3. cdp-browser Skill Detailed Dump Templates (Direct Paste)

Standard command set for dumping real Chrome; outputs **paste directly into `env/*.js`**:

### 3.1 Complete navigator dump

```bash
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py navigate "https://www.<site>.com"

python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py eval "
  JSON.stringify({
    userAgent: navigator.userAgent,
    appVersion: navigator.appVersion,
    platform: navigator.platform,
    vendor: navigator.vendor,
    vendorSub: navigator.vendorSub,
    productSub: navigator.productSub,
    language: navigator.language,
    languages: [...navigator.languages],
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigator.deviceMemory,
    maxTouchPoints: navigator.maxTouchPoints,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    doNotTrack: navigator.doNotTrack,
    webdriver: navigator.webdriver,
    pdfViewerEnabled: navigator.pdfViewerEnabled,
    plugins: [...navigator.plugins].map(p => ({
      name: p.name, filename: p.filename, description: p.description,
      mimeTypes: [...p].map(m => ({ type: m.type, suffixes: m.suffixes, description: m.description }))
    })),
    userAgentData: navigator.userAgentData ? {
      platform: navigator.userAgentData.platform,
      mobile: navigator.userAgentData.mobile,
      brands: navigator.userAgentData.brands
    } : null,
    connection: navigator.connection ? {
      effectiveType: navigator.connection.effectiveType,
      downlink: navigator.connection.downlink,
      rtt: navigator.connection.rtt,
      saveData: navigator.connection.saveData
    } : null,
  })
"
```

### 3.2 screen / window / visualViewport

```bash
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py eval "
  JSON.stringify({
    screen: {
      width: screen.width, height: screen.height,
      availWidth: screen.availWidth, availHeight: screen.availHeight,
      colorDepth: screen.colorDepth, pixelDepth: screen.pixelDepth,
      orientation: screen.orientation ? { type: screen.orientation.type } : null
    },
    window: {
      innerWidth: innerWidth, innerHeight: innerHeight,
      outerWidth: outerWidth, outerHeight: outerHeight,
      devicePixelRatio: devicePixelRatio
    },
    visualViewport: visualViewport ? {
      width: visualViewport.width, height: visualViewport.height,
      offsetLeft: visualViewport.offsetLeft, offsetTop: visualViewport.offsetTop,
      pageLeft: visualViewport.pageLeft, pageTop: visualViewport.pageTop,
      scale: visualViewport.scale
    } : null
  })
"
```

### 3.3 window's enumerable keys (critical — PX hashes Object.keys(window))

```bash
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py eval "
  Object.keys(window).filter(k => !k.startsWith('_')).sort()
"
# Output: array of ~250 keys
# Diff against jsdom Object.keys(window) → the difference is what px_intercept.js must patch
```

### 3.4 Canvas fingerprint hash calibration (for env/canvas.js)

```bash
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py eval "
  const c = document.createElement('canvas');
  c.width = 200; c.height = 50;
  const ctx = c.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = \"14px 'Arial'\";
  ctx.fillStyle = '#f60';
  ctx.fillRect(125, 1, 62, 20);
  ctx.fillStyle = '#069';
  ctx.fillText('BrowserLeaks,com <canvas> 1.0', 2, 15);
  c.toDataURL().slice(-50)
"
# Real Chrome output: '...some-base64-tail-50-chars'
# Our bridge uses @napi-rs/canvas to run the same code → output should match
# Mismatch → @napi-rs/canvas version / font config is wrong
```

### 3.5 collector POST body capture (for differential comparison)

```bash
# Launch Chrome + network capture + trigger PX SDK
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py navigate "https://www.<site>.com"
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py network 30 > /tmp/real_chrome_traffic.json

# Extract collector POST request bodies
jq '.[] | select(.request.url | contains("collector"))' /tmp/real_chrome_traffic.json
```

---

## 4. Mapping jni-env-patching's 4-Step Method to This Skill

| jni-env-patching step | Node bridge equivalent | Concrete action |
|---|---|---|
| ① Identify crash error | Inspect `[NODE]` stderr TypeError | `TypeError: Cannot read property 'X' of undefined` → X is missing |
| ② Inspect Java-layer semantics | Use **cdp-browser** to dump the real Chrome equivalent | `cdp eval "JSON.stringify(navigator.X)"` |
| ③ Assign random-but-reasonable value | Hardcode dumped real Chrome values into `env/<file>.js` | Don't randomize — match real Chrome exactly |
| ④ When unsure, hook the real device | Set DevTools breakpoint on the SDK wrapper, read the real value | `debug(xS)` + breakpoint |

Perfectly isomorphic — the platform and host differ but the methodology maps 1:1.

---

## 5. Four Ideas Borrowed From sdenv ⭐

sdenv (https://github.com/pysunday/sdenv, 718⭐) is the public env-patching framework's ceiling. Things worth borrowing:

### 5.1 ⭐ C++ Layer Fixes jsdom's Root Issues

sdenv maintains `sdenv-jsdom` (a fork of jsdom) and patches C++ source for **detections the JS layer can never bypass**:

```javascript
// HTML5 spec requires document.all to be truthy but typeof === 'undefined'
typeof document.all === 'undefined' && document.all   // real browser: true

// Real Chrome: typeof = 'undefined', value = HTMLAllCollection (truthy)
// Stock jsdom: typeof = 'object',   value = HTMLAllCollection   ← detection wins
// sdenv-jsdom: modifies C++ binding so typeof returns 'undefined' while keeping truthy
```

**Our node_bridge does not do this** — JS-layer mocks cannot override `typeof` behavior (it's defined at the V8/C++ layer).

**When to escalate to sdenv**: when you encounter V8-level detections such as `typeof document.all` or `Function.prototype.toString` (see §7).

### 5.2 Pluginized env (Not Site-Hard-Coded)

sdenv's directory structure:

```
sdenv/
├── sdenv-jsdom         ← universal base fork
└── sdenv-extend/
    ├── plugins/
    │   ├── ruishu/     ← Ruishu-specific patches
    │   ├── akamai/     ← Akamai-specific
    │   └── generic/    ← shared (UA / screen / canvas)
```

Each site gets a plugin; the generic part is shared. By comparison:

```
node_bridge/ifood/px-node-env/env/     ← iFood + PX mixed, not split
```

**Reference**: refactor into plugin form (consider this when onboarding new sites):
```
node_bridge/
├── env-core/         ← Chrome generic
├── plugins/
│   ├── px/           ← PX-specific
│   ├── akamai/       ← Akamai-specific
│   └── ifood/        ← iFood-specific
```

### 5.3 Proxy-Wrapped Window for Dev Logging

sdenv productized "Technique 4" (Proxy monitoring):

```javascript
// sdenv usage
const env = createSdenv({
    window: {
        proxy: {
            logger: 'all',          // log all reads/writes
            errorOnUnknown: false   // reading undefined properties does not throw
        }
    }
});
// → run SDK → console streams every window/document access
```

**Reference**: add an optional `DEBUG_PROXY=1` switch in our `env/builder.js` to enable navigator/window/document Proxy monitoring.

### 5.4 Dual-Track Architecture (Bridge + Pure-algo)

sdenv has a companion project [rs-reverse](https://github.com/pysunday/rs-reverse) (Ruishu pure-algo) — **two repos**.
Our project = **single repo** with `node_bridge/` + `revers/`.

Neither is strictly better; **the architectures are isomorphic**.

---

## 6. Why happy-dom / linkedom Don't Work for PX (Avoid This Pit)

People often ask: "Isn't happy-dom faster than jsdom?". **For the PX anti-bot scenario** none of these work:

| Alternative | Speed | Why it doesn't work |
|---|---|---|
| **happy-dom** | 2-3× faster than jsdom | Missing `MutationObserver` / `IntersectionObserver` / `PerformanceObserver` / `requestIdleCallback` and other APIs the PX SDK requires. **The PX SDK crashes on its first init line**. |
| **linkedom** | Extremely fast (no JS engine) | **Cannot run JS** — only parses HTML. The PX SDK is 10,000 lines of JS; linkedom cannot read it. |
| **deno_dom** | Rust implementation | Deno ecosystem is independent; curl_cffi / Node packages don't work. The Python orchestrator can't plug in. |

**Conclusion**: jsdom is the only viable base today. For tougher scenarios go to sdenv (jsdom fork). For even tougher, go to a real Chrome (puppeteer/playwright stealth).

---

## 7. When to Escalate to sdenv ⭐

**Escalation decision tree**:

```
Does it work? ─→ Don't touch (keep using our bridge)
   │
   ▼ Doesn't work
   │
Inspect stderr / SDK errors / response body signature:
   │
   ├── HTML px-captcha + extremely low score → add more env mocks; see §2.3 diff
   │
   ├── HTML "challenge-platform / Cloudflare" → BR/US residential proxy + UA matching IP region
   │
   ├── SDK calls `typeof document.all` returns 'object' → ⭐ escalate to sdenv
   │
   ├── SDK calls `Function.prototype.toString` to detect native-code marker → ⭐ escalate to sdenv
   │
   ├── SDK uses `new Proxy(window, ...)` to detect at the V8 engine layer → ⭐ escalate to sdenv
   │
   ├── SDK checks `Error().stack` for 'jsdom' in the call stack → ⭐ escalate to sdenv or rename stack
   │
   └── Score is high but cookies still get rejected by server → network / TLS / IP scoring issue (calibrate curl_cffi chrome131)
```

### Quick sdenv Integration Guide

```bash
# 1. install sdenv
npm install sdenv-jsdom sdenv-extend

# 2. replace the top of px_node_bridge.js
# Before:
const { JSDOM } = require('jsdom');
# After:
const { JSDOM } = require('sdenv-jsdom');   // interface-compatible jsdom fork

# 3. Key stubs are provided by sdenv-extend:
const { applyPxPatches } = require('sdenv-extend');
applyPxPatches(window);   // abstracts away what px_intercept.js does
```

**Note**: sdenv-extend's bundled patches primarily target **Ruishu VMP**; PX-specific patches still need to be written as plugins. But the underlying jsdom fork already solves spec-quirk-class issues for you.

### When NOT to Escalate

| Scenario | Don't escalate — keep using our bridge |
|---|---|
| Working + score is high enough | Don't fix what isn't broken |
| iFood / Grubhub PX medium difficulty | Our bridge is sufficient |
| Unwilling to introduce a new jsdom-fork dependency | Maintaining two jsdoms adds complexity |

---

## 8. Gotcha Quick Reference (From Field Combat)

| Symptom | Cause | Fix |
|---|---|---|
| `npm install canvas` fails (MSBuild error) | Missing MSBuild on Windows | `npm install canvas@3` (has Windows prebuilds) |
| SDK stuck at `/ns`, no follow-up POSTs | Node default TLS ≠ Chrome; PX detects and aborts | Must use Python curl_cffi chrome131; **cannot** run `generate_px.js` standalone |
| Bridge 30 s timeout insufficient for `_px3` | SDK chain has 4 collector POSTs; slow link exceeds timeout | Increase `px_node_bridge.js` setTimeout to 60 s |
| Python reports `[Errno 22] Invalid argument` | Node bridge already exited but Python still writing stdin | `px_cookie_generator.py` already handles BrokenPipeError |
| Single curl request timeout (15 s) | Slow proxy + default timeout too short | `timeout=30` |
| Homepage access 403 | Wrong region proxy (BR for iFood, US for Grubhub) | Set HTTPS_PROXY to the correct region's residential |
| Proxy monitoring reports "Cannot redefine property" | jsdom freezes certain properties | Fallback to `Object.defineProperty` with a getter |
| Canvas hash doesn't match real Chrome | `@napi-rs/canvas` font config missing | Load dejavu / liberation font set |
| `Object.keys(window)` hash wrong | Missing visualViewport / cookieStore / scheduler etc. | Add all to `env/px_intercept.js` |

---

## 9. Effort Estimates (Reference)

| Scenario | Effort | Role |
|---|---|---|
| Get ifood/ template running (environment validation) | 30 min | DevOps |
| **Existing ifood, change SDK version (same-SDK upgrade)** | 10 min | Change path + replace file |
| **Copy ifood template to a new site (same PX vendor)** | 4–8 h | Change 5 constants + calibrate 1–2 env files |
| **Adapt to a new anti-bot vendor (e.g., Ruishu)** | 1–3 days + consider escalating to sdenv | Write a new plugin |
| **First-time reverse-engineering of a new vendor + writing a bridge** | 1–2 weeks | High — comparable to sdenv author's original effort |

---

## 10. What Good env/ Files Look Like (See ifood/)

Each `env/*.js` file should:

1. **Top comment** describing "what is being patched + why"
2. **Export an install function** (`installXxx(window)`) called by `builder.js`
3. **Print `[XX] installed`** so stderr shows load order
4. **Hardcoded values from real Chrome dumps**, never random
5. **Support `DEBUG=1` env var** to enable Proxy monitoring (5.3 borrowed from sdenv)

Reference: `node_bridge/ifood/px-node-env/env/navigator.js` is the canonical implementation.

---

*Methodology v1.0 · 2026-05-22 · Verified end-to-end against iFood `_px3`*
