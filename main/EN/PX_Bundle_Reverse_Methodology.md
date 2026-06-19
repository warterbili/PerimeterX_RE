# PerimeterX **Bundle Path** Reverse Engineering Methodology

> **Companion document**: [`PX_逆向方法论_通用版.md`](../ZH/PX_逆向方法论_通用版.md) (Collector methodology, 1,233 lines)
>
> **Scope of this document**: standing on the foundation of Collector-path expertise, **the additional methodology specific to the Bundle path**.
>
> **Goal**: enable "someone fluent in Collector" to obtain `_px3` via Bundle reverse engineering within **5 days**.
>
> **Validation**: based on iFood Bundle 2026-02 production-grade 10/10 workflow.
>
> **Companion userscript artifact**: [`../../bundle/script/userscripts/px_bundle3_auto.user.js`](../../bundle/script/userscripts/px_bundle3_auto.user.js) (2,131 lines, verified)

---

## Table of Contents

- [§0 Preamble: Read the Collector Methodology First](#0-preamble-read-the-collector-methodology-first)
- [§1 Bundle Path vs Collector Path — Decision Table](#1-bundle-path-vs-collector-path--decision-table)
- [§2 Bundle Reverse Engineering: 8-Stage Overview](#2-bundle-reverse-engineering-8-stage-overview)
- [§3 Stage B1 — Lock captcha.js + WASM](#3-stage-b1--lock-captchajs--wasm)
- [§4 Stage B2 — Decode OB#1 / OB#2 (Reuse Collector Decoder)](#4-stage-b2--decode-ob1--ob2-reuse-collector-decoder)
- [§5 Stage B3 — Solve PoW (Bundle-Specific)](#5-stage-b3--solve-pow-bundle-specific)
- [§6 Stage B4 — Run WASM (Bundle-Specific)](#6-stage-b4--run-wasm-bundle-specific)
- [§7 Stage B5 — Assemble Bundle#3 Six Events (Bundle-Specific)](#7-stage-b5--assemble-bundle3-six-events-bundle-specific)
- [§8 Stage B6 — iframe XHR Hook to Intercept B1/B2 (Key to "Pure-algo Press Challenge")](#8-stage-b6--iframe-xhr-hook-to-intercept-b1b2)
- [§9 Stage B7 — Validate in a Real Browser](#9-stage-b7--validate-in-a-real-browser)
- [§10 Stage B8 — Package as a Tampermonkey Userscript](#10-stage-b8--package-as-a-tampermonkey-userscript)
- [§11 Differences from the Collector Methodology (10-Point Comparison)](#11-differences-from-the-collector-methodology)
- [§12 6 Bundle-Specific Gotchas](#12-6-bundle-specific-gotchas)
- [§13 Time Budget](#13-time-budget)
- [§14 Failure Diagnosis Decision Tree](#14-failure-diagnosis-decision-tree)
- [§15 Cross-Platform Bundle Porting](#15-cross-platform-bundle-porting)
- [§16 SDK Upgrade Response](#16-sdk-upgrade-response)
- [§17 When to Give Up the Bundle Path](#17-when-to-give-up-the-bundle-path)

---

# §0 Preamble: Read the Collector Methodology First

⚠️ **Don't start here directly**. The Bundle path **shares 70% of algorithms with Collector** (payload XOR/b64/interleave, PC HMAC-MD5, OB decode, SID steganography, UUID v1, HMAC algorithms, anti-tamper); without mastering Collector you cannot understand Bundle.

**Recommended learning path**:

```
Week 1: Read PX_SDK_逆向技术文档.md (2,597 lines)
Week 1: Read PX_逆向方法论_通用版.md (1,233 lines, 7 stages)
Week 1: Get stample/ifood/px_cookie/ifood_px3.js working → obtain _px3 ✓
   ↓ Now that you know Collector, you can start Bundle ↓
Week 2: Read this doc §1-§11 (understand differences between Bundle and Collector)
Week 3: Get bundle/script/userscripts/px_bundle3_auto.user.js running (browser obtains _px3)
Week 4: Write your own Bundle generator reproducing the artifact (reference §3-§10)
Week 5: Cross-platform Bundle porting to a new site (reference §15)
```

If you skip Collector and go straight to Bundle: in practice **add at least 3 weeks**, and step on 15 gotchas avoidable (already encountered in Collector).

---

# §1 Bundle Path vs Collector Path — Decision Table

## 1.1 When You Must Do Bundle

✅ **Required**:
- Business APIs are scored as bot by PX → 403 + `blockScript: ".../captcha.js"`
- A single IP/account is flagged by PX to require "press challenge" before issuing a cookie
- Building an "account registration" flow (PX is especially strict on registration paths)

❌ **Not needed**:
- Regular data collection (99% of scenarios are sufficient with the Collector path)
- You can use a real browser (Playwright) + residential proxy IP (real press path)
- One-off tasks, low frequency (< a few dozen / day)

**Practical experience**: iFood 2026 data collection — **99% traffic on Collector** + 1% triggering Bundle **fallback to Userscript**. The Bundle pure-algo solution was built but rarely used in practice.

## 1.2 Bundle vs Collector — Algorithm Differences (70% Shared)

| Algorithm | Collector | Bundle |
|---|---|---|
| payload encryption chain | XOR(50) → b64 → 20-char interleave | **Same** (interleave key uses UUID instead of AppID) |
| PC HMAC-MD5 + digit extraction | ✓ | **Same** (different FT: 401 → 388) |
| OB decode (XOR + `~~~~` split + handler dispatch) | 27 handlers | **27 + 2 PoW handlers** |
| SID + Unicode Variation Selector steganography | ✓ | **Same** (Bundle#2+ steganographs cts timestamp) |
| UUID v1 with PX-compatible clockseq | ✓ | **Same** |
| `/ns` probe | ✓ | **Same** |
| **Proof of Work** (SHA-256 16-bit brute force) | ✗ | **New** ⭐ |
| **WebAssembly fingerprint** (a()/b() ChaCha20) | ✗ | **New** ⭐⭐ |
| **Bézier mouse trajectory** (544 points) | ✗ | **New** ⭐ |
| **Myanmar DOM encoding** (XOR 4210 → Myanmar script) | ✗ | **New** ⭐ |
| **Error stack template** (4 V8 stacks) | ✗ | **New** ⭐ |

**Bundle has 5 algorithms unique to it beyond Collector**, but each is **10× more complex** than any single Collector algorithm.

## 1.3 Data-Flow Differences

```
Collector:                           Bundle:
─────────                            ─────
Browser loads main.min.js            Browser loads main.min.js + captcha.js + px_captcha.wasm
   ↓                                    ↓
POST collector#1                       POST bundle#1 (16 fields)
   ↓                                    ↓
OB#1 → state.{no,qa,...}              OB#1 → state + PoW params (suffix/target/difficulty)
   ↓                                    ↓
                                       Local PoW (~9-60ms synchronous SHA-256)
                                       Local WASM a() + b(powAnswer)
                                       ↓
POST collector#2 (204 fields)          POST bundle#2 (228 fields + PoW answer + WASM output)
   ↓                                    ↓
OB#2 → _px3 (jf=success)              OB#2 → first _px3 (jf=cu, pending confirmation)
   ↓                                    ↓
Done ✓                                 User press / our constructed Bundle#3 (6 events)
                                       ↓
                                       POST bundle#3 (5,070 fields total)
                                       ↓
                                       OB#3 → valid _px3 (jf=success)
                                       ↓
                                       (optional) POST bundle#4 telemetry
                                       ↓
                                       Done ✓✓
```

Bundle has **2 more POSTs + 5 new algorithms** vs Collector.

---

# §2 Bundle Reverse Engineering: 8-Stage Overview

Analogous to Collector's 7 stages, Bundle has **8 stages** (one extra for PoW+WASM):

```
Stage B1 — Capture        Lock captcha.js + extract WASM    ──┐
   ↓                                                          │
Stage B2 — Decode         Decode OB#1 / OB#2 (reuse Collector)│ Reuse Collector method
   ↓                                                          │ (already known)
Stage B3 — PoW            Solve PoW (Bundle-specific)        ──┤
   ↓                                                          │
Stage B4 — WASM           Run WASM a()/b() in Node simulation──┤ Bundle-specific
   ↓                                                          │
Stage B5 — Events         Assemble Bundle#3 6 events / 244+ fields ──┘
   ↓
Stage B6 — Hook           iframe XHR Hook to intercept B1/B2
   ↓                       (key to "pure-algo press challenge")
   ↓
Stage B7 — Validate       Real-browser test 10× ✓
   ↓
Stage B8 — Package        Bundle as Tampermonkey userscript
```

## Time Budget

| Stage | Task | Fluent | First time |
|---|---|---|---|
| B1 | Lock captcha.js + WASM | 30 min | 2 h |
| B2 | Decode OB#1/#2 (reused) | 15 min | 1 h |
| B3 | PoW reconstruction | 1 h | 4 h |
| B4 | **Run WASM in Node** ⭐⭐ | **3 h** | **8-16 h** |
| B5 | Assemble Bundle#3 6 events | 2 h | 6 h |
| B6 | iframe Hook | 1 h | 3 h |
| B7 | Validate 10/10 | 1 h | 4 h |
| B8 | Build userscript | 30 min | 2 h |
| | **Total** | **~9 h** | **~40 h** |

Compared to Collector:

| Path | Fluent | First time |
|---|---|---|
| Collector | 4 h | 15 h |
| **Bundle** | **9 h** | **40 h** |

**Bundle is ~2.5× the workload of Collector**. Most time goes into Stage B4 (running WASM in Node); that single item is 8-16 hours.

## The Single Most Critical Stage

Different from Collector's "Stage 5 Value-match" —

**The Bundle path's critical stage is B4 (Running WASM in Node)**. Reasons:
- Other stages (B1/B2/B3/B5/B7) resemble Collector and can use existing methods
- **B4 has no existing method to borrow** — wasm-bindgen bridge + 34 wbg imports + ChaCha20 seed extraction; every step must be tuned from scratch
- If this stage doesn't pass, the entire Bundle path won't work

---

# §3 Stage B1 — Lock captcha.js + WASM

## 3.1 Trigger the Challenge to Obtain the captcha.js URL

```js
// Run in browser console (or refer to bundle/script/userscripts/px_bundle3_auto.user.js)
async function triggerCaptcha() {
    for (let i = 0; i < 250; i++) {
        const resp = await fetch('https://cw-marketplace.ifood.com.br/v1/cardstack/search/home', {
            method: 'POST',
            credentials: 'include',
            body: JSON.stringify({...})
        });
        if (resp.status === 403) {
            const body = await resp.json();
            if (body.blockScript) {
                console.log('captcha URL:', body.blockScript);
                return body;
            }
        }
        await new Promise(r => setTimeout(r, 100));
    }
}
```

Sample output:
```
captcha URL: https://client.px-cloud.net/PXO1GDTa7Q/captcha_7f2a3b1c.js?v=...
```

⚠️ **The filename has a hash suffix, which changes per session**. You must **save the raw response body** in the Network panel as the SDK pin point.

## 3.2 Extract WASM

`captcha.js` embeds WASM (base64 in `Us()[10]`). Extraction script:

```js
// bundle/stample/helpers/extract_wasm.js (already exists)
const captchaJs = fs.readFileSync('captcha.js', 'utf8');
const m = captchaJs.match(/"(AGFzbQ[A-Za-z0-9+/=]{50000,})"/);
const wasmBytes = Buffer.from(m[1], 'base64');
fs.writeFileSync('px_captcha.wasm', wasmBytes);
```

Expected: 60,862 bytes + magic `\0asm 01 00 00 00`.

If extraction fails (base64 charset changed), try 10 decode paths (see `bundle/source/SDK_INFO.md` §2).

## 3.3 SDK_INFO.md Locking

Record SHA + size + capture time in `bundle/source/SDK_INFO.md`:

```markdown
| File | SHA-256 | Size | Captured |
|---|---|---|---|
| captcha.js | `acdf2dcfa042...` | 821,113 bytes | 2026-05-21 |
| px_captcha.wasm | `900a9b07c1de...` | 60,862 bytes | 2026-05-21 |
```

Same structure as Collector's `stample/ifood/source/SDK_INFO.md`.

---

# §4 Stage B2 — Decode OB#1 / OB#2 (Reuse Collector Decoder)

## 4.1 OB Decoding Reuses Collector

```js
// Same code as Collector
const xorKey = parseInt(ml(tag), 10) % 128;
const raw = Buffer.from(obBase64, 'base64').toString('binary');   // ⚠️ binary, not utf-8
const decoded = xorString(raw, xorKey);
const segments = decoded.split('~~~~');                            // 4 tildes
```

Directly reuse [`../../revers/ob.js`](../../revers/ob.js)'s `decodeOb()`.

## 4.2 Bundle Has 2 More PoW Handlers

OB#1 has 2 more segments than Collector:

```
Segment 7: I0I0I0|1|<60-char suffix>|<64-char target>|16|false
   → PoW dispatch (main path)
Segment 8: 0II0I0|1|<uuid>|<port>|<challengeData>|1|
   → PoW backup path (via qu/os)
```

Compared to Collector, **2 more handler shapes to identify**. See [`bundle/doc/Bundle_完整技术文档.md`](../../bundle/doc/Bundle_完整技术文档.md) §3.5.

## 4.3 Extracted state (Includes PoW Parameters)

```js
// Collector state
{ no, qa, to, vid, pxsid, appId, cts, jf }

// Bundle state (adds PoW + Bundle AppID)
{
    no, qa, to, vid, pxsid, cts, jf,
    appId,                                       // ⚠️ Bundle AppID and Collector AppID are 2 different values
    pow: { suffix, target, difficulty }          // new
}
```

⚠️ **Bundle AppID** differs from Collector AppID (iFood: `PXd6f03jmq8h6c7382req0` vs `PXO1GDTa7Q`). See `bundle/doc/Bundle_完整技术文档.md` §1.5.

---

# §5 Stage B3 — Solve PoW

## 5.1 PoW Formula

```
sha256(suffix + counter.toString(16).padStart(4, '0'))'s first 4 hex chars == target.slice(0, 4)
```

Solve: enumerate counter from 0 to 65,536 (2^16) until the hash's first 4 hex chars match.

## 5.2 Critical Pitfall: Must Use Synchronous SHA-256

⚠️ **One of the most lethal pitfalls in the Bundle path**:

```js
// ❌ Wrong (Node async)
const hashBuf = await crypto.subtle.digest('SHA-256', buf);
// → each await switches the event loop +10ms → 65,536 iterations = 600s+ → PX session times out long before

// ✅ Right (Node sync)
const hash = crypto.createHash('sha256').update(s).digest('hex');
// → 9-60ms
```

See [`bug_report/2_bundle_path.md`](../../bug_report/2_bundle_path.md) #B5.

## 5.3 Node Implementation

```js
function solvePow(targetHash, suffix, difficulty = 16) {
    const m = Math.ceil(difficulty / 4);
    const padding = '0'.repeat(m);
    const mask = (1 << (4 * m)) - 1;
    const lastHexDigit = parseInt('0x' + suffix.charAt(suffix.length - 1), 16);
    const prefix = suffix.slice(0, -1);
    const maxCounter = 1 << difficulty;

    for (let r = 0; r < maxCounter; r++) {
        const lowPart = (padding + (r & mask).toString(16)).slice(-m);
        const candidate = prefix + (lastHexDigit + (r >> (m << 2))).toString(16) + lowPart;
        if (crypto.createHash('sha256').update(candidate).digest('hex') === targetHash) {
            return { answer: candidate, counter: r };
        }
    }
    throw new Error('PoW no solution');
}
```

## 5.4 Browser Implementation (Web Worker)

PX uses Web Workers in-browser to run PoW (to avoid blocking the main thread). If you want to mimic PX:

```js
// inside the Web Worker
function ws(suffix, target, difficulty, startTime) {
    const m = Math.ceil(difficulty / 4);
    // ... same as Node but synchronous sha256 must be inlined inside the Worker (no require in Workers)
    for (let counter = 0; counter < (1 << difficulty); counter++) {
        const candidate = ...;
        if (sha256(candidate) === target) {
            postMessage({ answer: candidate, elapsed: Date.now() - startTime });
            return;
        }
    }
}
```

## 5.5 Validation (Using Real OB#1 Data)

```
suffix     = "ab317b680dfb5a3dc7c52a4fefedce5adb20cedd066ce5408ce6887aee9c"
targetHash = "7bb57f904e7b938c8442e522a97d754d23a35964a1030857244c7d2c803a1169"
difficulty = 16

Expected:
  answer  = "ab317b680dfb5a3dc7c52a4fefedce5adb20cedd066ce5408ce6887aee9c24da"
  counter = 9434 (0x24da)
  time    = 9-60ms
```

---

# §6 Stage B4 — Run WASM ⭐⭐⭐

**This is the hardest stage in the Bundle path**. Budget 8-16 hours (first time).

## 6.1 WASM Overview

PX uses a wasm-bindgen-generated Rust module, 60,862 bytes, exporting 2 functions:

```
a()              → 64-hex string (different each time, contains globalThis._pxUuid + random source)
b(input: str)    → 127-char custom encoding (deterministic, ChaCha20 transform)
```

## 6.2 Critical Pitfalls

⚠️ 3 must-step-on traps:

### Trap #B1: `globalThis._pxUuid` must be set BEFORE instantiate

```js
// ❌ Wrong
const { instance } = await WebAssembly.instantiate(wasmBytes, imports);
globalThis._pxUuid = uuid;
const a = instance.exports.a();
// → a() returns empty string

// ✅ Right
globalThis._pxUuid = uuid;
const { instance } = await WebAssembly.instantiate(wasmBytes, imports);
const a = instance.exports.a();
```

### Trap #B2: `instanceof_Window` must return 1

Node lacks the Window class by default; WASM uses `__wbg_instanceof_Window` to decide and gets 0 → wrong path → returns empty.

```js
imports.wbg = {
    ...
    __wbg_instanceof_Window: () => 1,   // ⭐ must return 1
    __wbg_instanceof_Document: () => 1,
    __wbg_instanceof_HTMLElement: () => 1,
};
```

### Trap #B4: b() output is **NOT base64**

```
b() alphabet: /=+!1@2#3$4%5^6&7*8(9)0-
```

Differs from standard base64. **Fill the literal string as-is into Bundle#3's field**; don't base64-decode.

## 6.3 34 wbg Imports (8 Critical Ones)

Full 34 in `bundle/doc/Bundle_完整技术文档.md` §5.3. Minimum required for Node mock:

```js
const imports = {
    wbg: {
        // 1. Environment detection (must return 1)
        __wbg_instanceof_Window: () => 1,
        __wbg_instanceof_Document: () => 1,
        __wbg_instanceof_HTMLElement: () => 1,

        // 2. Global objects
        __wbg_window: () => mockWindow,
        __wbg_document: () => mockDocument,
        __wbg_navigator: () => mockNavigator,
        __wbg_screen: () => mockScreen,
        __wbg_self: () => globalThis,
        __wbg_globalThis: () => globalThis,

        // 3. Reflect properties
        __wbg_get: (target, key) => Reflect.get(target, key),
        __wbg_set: (target, key, value) => { Reflect.set(target, key, value); return true; },

        // 4. Random (must be truly random; otherwise a() output is repeatable → fingerprint anomaly)
        __wbg_getRandomValues: (cryptoObj, buf) => {
            require('crypto').randomFillSync(buf);
            return buf;
        },
        __wbg_randomFillSync: (cryptoObj, buf) => {
            require('crypto').randomFillSync(buf);
        },

        // 5. Time
        __wbg_now: () => Date.now(),
        __wbg_performance: () => ({ now: () => performance.now() }),

        // 6-8. Console / memory / string bridge (wasm-bindgen standard)
        __wbg_log: () => {}, __wbg_warn: () => {}, __wbg_error: () => {},
        __wbindgen_throw: (ptr, len) => { throw new Error('wasm throw'); },
        __wbindgen_memory: () => instance.exports.memory,
    },
};
```

## 6.4 wasm-bindgen Bridge Code

WASM passes strings to/from JS via the wasm-bindgen bridge. Full bridge in `bundle/doc/Bundle_完整技术文档.md` §5.5. Short version:

```js
function passStringToWasm(s) {
    const buf = textEncoder.encode(s);
    const ptr = wasm.__wbindgen_malloc(buf.length);
    new Uint8Array(wasm.memory.buffer).set(buf, ptr);
    WASM_VECTOR_LEN = buf.length;
    return ptr;
}

function getStringFromWasm(ptr, len) {
    return textDecoder.decode(new Uint8Array(wasm.memory.buffer).subarray(ptr, ptr + len));
}

function wasmA() {
    const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
    try {
        wasm.a(retptr);
        const r0 = new Int32Array(wasm.memory.buffer)[retptr / 4];
        const r1 = new Int32Array(wasm.memory.buffer)[retptr / 4 + 1];
        const s = getStringFromWasm(r0, r1);
        wasm.__wbindgen_free(r0, r1);
        return s;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}
```

## 6.5 Validate a() / b() Output

```js
// Compare against the real captured Bundle#2 payload
const aResult = wasmA();
const bResult = wasmB(powCounter);

console.log('a:', aResult);    // Expected 64 hex chars
console.log('b:', bResult);    // Expected 127 custom-encoded chars
console.log('a re-call:', wasmA() === aResult ? 'wrong' : 'right');  // a() non-deterministic
console.log('b re-call:', wasmB(powCounter) === bResult ? 'right' : 'wrong');  // b() deterministic
```

Compare against the real captured `bundle/stample/decoded/bundle2_event.json`'s `Slt5EA85fiI=` (a output) + `MD1DNnVfRgQ=` (b output) — must be **character-identical**.

## 6.6 Cross-Version: ChaCha20 Seed Extraction

Each PX build's WASM internal ChaCha20 seed changes (32 bytes embedded in the `.data` segment). Extract:

```bash
wasm-objdump -j data px_captcha.wasm | head -30
# Look at segment[0]; those 32 bytes are the suspected seed
```

Cross-version b() output mismatch = seed changed. **This is the hardest SDK upgrade scenario to fix** (requires redoing WASM static analysis).

---

# §7 Stage B5 — Assemble Bundle#3 Six Events

## 7.1 Event Structure (Order-Sensitive!)

The Bundle#3 EV array is **strictly 6 events**:

```js
[
    Event #0  (78 fields) — Browser fingerprint (WebGL/Canvas/UA)           seq=2
    Event Metrics ⭐ (18 fields) — PX internal metrics report                seq=3
    Event #1  (20 fields) — mouseout single interaction                     seq=4
    Event #2  (95 fields) — PX561 core (press + WASM + mouse trajectory)    seq=6
    Event #3  (27 fields) — Captcha onSolvedCallback                        seq=7
    Event #4  (24 fields) — PX11994 interaction summary                     seq=8
]
```

PC HMAC verification is over `serialize([ev0, evMetrics, ev1, ev2, ev3, ev4])`. **Reorder = reject**.

> ⚠️ **Critical correction**: early docs wrote 5 events (missing Metrics). **Must be 6 events; one missing = reject**.

## 7.2 PX561 95-Field Tier Classification

PX561 is the most complex Bundle#3 event. Tiered by "forgery difficulty":

| Tier | Count | Contents | Difficulty |
|---|---|---|---|
| T1 Hardcoded | ~50 | 21 booleans + 10 screen constants + 7 string constants + 12 common tails | Zero |
| T2 Simple live | ~25 | Incremental counters + perf.now + timestamps | Low |
| T3 Session-dependent | ~15 | UUID / _px3 token / state.* | Medium (from prior requests) |
| T4 Mouse trajectory ⚠️ | 5 | 544 points full + 150-point filter + diff + 25-point subset + 32 interactions | **High** |
| T5 WASM computation | 3 | a() / b(pow) / sensor encryption | **Solved** (§6) |

See `bundle/doc/Bundle_完整技术文档.md` §7.4.

## 7.3 Mouse Trajectory (Tier 4 Difficulty)

```js
function generateMouseTrajectory(startX, startY, endX, endY, durationMs) {
    // 4-control-point Bezier (no straight lines, no constant speed)
    const ctrl1 = randomCtrl(startX, startY, endX, endY, 0.3);
    const ctrl2 = randomCtrl(startX, startY, endX, endY, 0.7);

    const points = [];
    for (let i = 0; i < 544; i++) {
        const t = i / 543;
        const x = cubicBezier(startX, ctrl1.x, ctrl2.x, endX, t);
        const y = cubicBezier(startY, ctrl1.y, ctrl2.y, endY, t);

        // ⚠️ Float coordinates, 1 decimal place (gotcha #B12)
        points.push({
            x: Math.round(x * 10) / 10,
            y: Math.round(y * 10) / 10,
            ts: Math.round(startTs + durationMs * t)
        });
    }
    return points;
}
```

**Key constraints**:
- 544 points (PX expected value, ±10% tolerance)
- Float coordinates (integers = bot)
- Timestamp distribution aligned with press duration (gotcha #B13)
- Start/end aligned with pointerdown/up
- Mouse interactions ts must ≈ pointerdown.ts ± 200ms

## 7.4 Myanmar DOM Encoding

```js
function myanmarEncode(domNodes) {
    // 1. Count DOM tags
    const counts = {};
    for (const node of domNodes) counts[node.tagName.toLowerCase()] = (counts[...] || 0) + 1;

    // 2. JSON serialize (alphabetically sorted)
    const json = Object.entries(counts).sort().map(([t,c]) => `${t}:${c}`).join(',');

    // 3. XOR 4210
    let xored = '';
    for (let i = 0; i < json.length; i++) xored += String.fromCharCode(json.charCodeAt(i) ^ 4210);

    // 4. base64 + Unicode Myanmar mapping (U+1000-U+109F)
    const b64 = btoa(xored);
    let myanmar = '';
    for (const ch of b64) myanmar += String.fromCharCode(0x1000 + base64Index(ch));
    return myanmar;
}
```

⚠️ DOM tag counts **must match the captcha iframe's actual rendering**. captcha.js adding/removing one `<img>` tracking pixel → the entire encoding breaks.

## 7.5 4 Error Stacks

```js
const errors = [
    (() => { try { return (null)[0]; } catch (e) { return e.stack; } })(),       // TypeError
    (() => { try { return undefinedVar; } catch (e) { return e.stack; } })(),     // ReferenceError
    (() => { try { return new Array(-1); } catch (e) { return e.stack; } })(),    // RangeError
    (() => { try { return JSON.parse('not json'); } catch (e) { return e.stack; } })(),  // SyntaxError
];
ev3['error_stacks_key'] = errors;   // 4-element array
```

⚠️ Node-generated stack format differs from browser V8's → **must use browser-captured stack templates**, maintained per Chrome major (140/145/148) (see `bug_report/4_sdk_drift.md` #D7).

---

# §8 Stage B6 — iframe XHR Hook to Intercept B1/B2

## 8.1 Critical Insight: captcha Sends Requests Inside an iframe

⚠️ **The #1 trap for newcomers**: PX captcha **doesn't send Bundle#1/#2 in the main page**; it sends them **inside the captcha iframe**.

If you only hook the main page's fetch / XHR → **you can't intercept B1/B2** → "my hook didn't trigger; PX is broken?" — no, PX isn't broken; you hooked the wrong place.

## 8.2 Solution: iframe XHR Hook

```js
function hookIframeXHR(iframe) {
    let iframeWin;
    try { iframeWin = iframe.contentWindow; } catch(e) { return; }
    if (!iframeWin || !iframeWin.XMLHttpRequest) return;
    if (iframe._pxHooked) return;
    iframe._pxHooked = true;

    const origOpen = iframeWin.XMLHttpRequest.prototype.open;
    const origSend = iframeWin.XMLHttpRequest.prototype.send;

    iframeWin.XMLHttpRequest.prototype.open = function(method, url) {
        this._pxUrl = url;
        this._pxMethod = method;
        return origOpen.apply(this, arguments);
    };

    iframeWin.XMLHttpRequest.prototype.send = function(body) {
        const urlStr = this._pxUrl || '';
        if (/\/assets\/js\/bundle/.test(urlStr)) {
            this.addEventListener('load', () => {
                // Grab the response → trigger our onBundle1Response / onBundle2Response
                onBundleResponse(urlStr, body, this.responseText);
            });
        }
        return origSend.apply(this, arguments);
    };
}
```

## 8.3 Synchronous Detection of iframe Insertion

`MutationObserver` detects iframes asynchronously, sometimes later than captcha's first XHR → misses B#1.

```js
// Synchronously hook appendChild; install XHR hook immediately
const origAppendChild = Document.prototype.appendChild;
Document.prototype.appendChild = function(node) {
    const result = origAppendChild.call(this, node);
    if (node.tagName === 'IFRAME' && (node.src || '').includes('captcha')) {
        // Hook immediately
        hookIframeXHR(node);
        // Also add a load listener as backup
        node.addEventListener('load', () => hookIframeXHR(node));
    }
    return result;
};
```

This is Part 3.5 of [`bundle/script/userscripts/px_bundle3_auto.user.js`](../../bundle/script/userscripts/px_bundle3_auto.user.js) (line 1617+).

---

# §9 Stage B7 — Validate in a Real Browser

## 9.1 Install Userscript to Test the Full Flow

```
1. Install px_bundle3_auto.user.js via Tampermonkey
2. Open https://www.ifood.com.br/
3. F12 → look at [PX-AUTO] logs
4. Trigger challenge:
   - Browse or rapidly hit business APIs to push PX score to Bundle
5. Watch the script automatically:
   - Intercept Bundle#1 → decode OB#1 → extract state + PoW params
   - Solve PoW (~9-60ms)
   - Run WASM a() + b()
   - Intercept Bundle#2 → obtain first _px3
   - Construct Bundle#3 → fetch POST
   - Intercept Bundle#3 → extract valid _px3
6. F12 console:
   > __pxAutoState        check main-page interception state
   > __pxCaptchaState     check captcha iframe state
   > __pxBuildB3()        manually debug trigger
   > __pxReset()          clear state and retry
```

## 9.2 Validation Matrix

| Test | Expected |
|---|---|
| Full flow 1× | ✓ Obtain `_px3` (jf=success) |
| Repeat 5× (30s intervals) | 5/5 pass |
| Use obtained _px3 against business API | 200 OK |
| Clear cookies, retry | Still 5/5 |
| Across 5 accounts | 5/5 |
| **10/10 stable** | **all pass** |

## 9.3 Failure Diagnosis (Decision Tree in §14)

If 1 in 10 fails:
- jf=blocked → IP score too low (switch IP)
- jf=cu → Bundle#3 fields not right (see §14 subflow)
- _px3 rejected by business API → cookie obtained but flawed (inspect stack)

---

# §10 Stage B8 — Package as a Tampermonkey Userscript

## 10.1 Option A: Manually Maintain user.js

Use the 2,131-line artifact `bundle/script/userscripts/px_bundle3_auto.user.js` directly. Modify the const block's TAG / AppID / FT etc. → adapt to new versions/sites.

## 10.2 Option B: Use the Builder (Pending Fix)

`bundle/stample/helpers/build_userscript.js` is designed to assemble user.js from WASM base64 + 5 trajectories + generator code automatically.

⚠️ **Currently line 319's template-string escape nesting is broken**. Fix:
1. Move the nested ESCAPE_RE_PL regex to external string concat
2. Don't embed `` ` `` characters inside template literals
3. Once fixed, `node build_userscript.js` outputs px_bundle3_auto.user.js

> **Future work**: auto-builder fix. The blocker is template-literal escaping
> (line 319 in the legacy `build_userscript.js`). For now the userscript is
> maintained by hand-editing the 2,131-line artifact in
> [`bundle/script/userscripts/px_bundle3_auto.user.js`](../../bundle/script/userscripts/px_bundle3_auto.user.js).
> If you fix the builder, please open a PR.

## 10.3 Tampermonkey Metadata

```js
// ==UserScript==
// @name         PX Bundle3 Auto
// @namespace    px-reverse
// @version      <bumpversion>
// @description  Automatically intercept B1/B2, construct B3, and send
// @match        https://www.ifood.com.br/*
// @run-at       document-start    ← ⭐ critical; must be document-start to hook early
// @grant        none              ← no GM_ permissions, maximum compatibility
// ==/UserScript==
```

---

# §11 Differences from the Collector Methodology

Point-by-point comparison: 7-stage Collector vs 8-stage Bundle:

| Dimension | Collector | Bundle | Notes |
|---|---|---|---|
| Number of stages | 7 | 8 | Bundle has 1 extra PoW+WASM stage |
| Critical stage | Stage 5 Value-match | **Stage B4 WASM Node simulation** | Bundle's hard part is WASM, not value-match |
| SDK file | main.min.js (231 KB) | captcha.js (821 KB) + px_captcha.wasm (60 KB) | Bundle files 4× bigger |
| Time budget (fluent) | 4 h | **9 h** | Bundle 2.25× |
| Time budget (first time) | 15 h | **40 h** | Bundle 2.7× |
| Algorithm sharing | 100% (baseline) | 70% | Shared: payload/PC/OB/SID/UUID/HMAC/Anti-tamper |
| New algorithms | 0 | 5 (PoW/WASM/Bezier/Myanmar/error stack) | Bundle adds 5 |
| Total field count | EV1(14) + EV2(204) ≈ 220 | Bundle#1(16) + #2(228) + #3(262) ≈ 500 | Bundle 2.3× |
| POST count | 2 | 4 | Bundle 2× |
| Hook complexity | Main page fetch only | **iframe XHR + appendChild MutationObserver** | Bundle has 1 more layer |
| Artifact size | ifood_px3.js ~270 lines | px_bundle3_auto.user.js **2,131 lines** | Bundle 8× |
| Timing constraints | ~5-second session | **10-15 seconds + multiple internal time checks** | Bundle much stricter |

**Summary**: Bundle is the "plus version" of Collector. If you've done Collector, Bundle is **a known pattern + 5 new gotchas + a lot of fields**.

---

# §12 6 Bundle-Specific Gotchas

The full 20 are in [`bug_report/2_bundle_path.md`](../../bug_report/2_bundle_path.md). **The 6 worst Bundle-specific ones**:

| # | Severity | Title | One-liner |
|---|---|---|---|
| B1 | ⭐⭐⭐ | `_pxUuid` before WASM init | `globalThis._pxUuid = uuid` must be set before instantiate |
| B2 | ⭐⭐⭐ | `instanceof_Window` must return 1 | Node mock mandatory |
| B5 | ⭐⭐⭐ | PoW must be synchronous SHA-256 | Async 600s+ guaranteed timeout |
| B8 | ⭐⭐⭐ | Bundle#3 6-event order-sensitive | Wrong order = PC mismatch |
| B11 | ⭐⭐⭐ | Press duration 1-3s | < 0.5s or > 5s both rejected |
| **B(new)** | ⭐⭐⭐ | iframe XHR Hook | Hooking only main page fetch misses B1/B2 |

The last two don't exist in Collector at all.

---

# §13 Time Budget

## First-time Bundle (Learning From Zero)

```
Week 1: Learn Collector path prerequisites    15 h
Week 2: Read this + Bundle full technical doc 10 h
Week 3: Reproduce Bundle#1/#2 (Stage B1-B3)   10 h
Week 4: Crack WASM (Stage B4) ⭐⭐⭐           16 h
Week 5: Assemble Bundle#3 + iframe Hook       10 h
Week 6: Validate 10/10 + package userscript    5 h
─────────────────────────────────────────────
                                 Total ≈ 66 h
```

## Second-time Bundle (Porting to a New Site, with iFood Bundle Experience)

```
Day 1: Capture captcha.js + WASM + extract constants    2 h
Day 2: Adapt OB decoding + cross-version charset         3 h
Day 3: Cross-version WASM ChaCha20 seed                  4 h
Day 4: Mouse trajectory pool + DOM encoding template    3 h
Day 5: Validate                                          4 h
─────────────────────────────────────────────
                                 Total ≈ 16 h
```

Compared to Collector cross-platform porting:

| Path | First time | Cross-platform porting (with experience) |
|---|---|---|
| Collector | 15 h | 1 day/site |
| **Bundle** | **66 h** | **2 days/site** |

---

# §14 Failure Diagnosis Decision Tree

```
Can't obtain _px3 → check jf
   │
   ├── jf missing (didn't get OB#2 / OB#3)
   │   └── PC wrong / payload encryption wrong → §6 Stage 5 Value-match
   │
   ├── jf=blocked
   │   └── IP score too low → switch residential IP / wait 30 minutes
   │
   ├── jf=cu but no follow-up _px3
   │   ├── Bundle#3 entire PC wrong       → Stage B5 field error (see compare_my_bundle3)
   │   ├── Bundle#3 200 but jf=cu         → Timing/press duration/mouse trajectory wrong (see §7)
   │   └── Bundle#3 200 jf=success but business API rejects → timing window expired (re-capture)
   │
   ├── jf=success but business API still rejects
   │   ├── TLS fingerprint wrong (curl_cffi solves)
   │   ├── UA inconsistent with HMAC (gotcha #23)
   │   └── Subdomain has different WAF policies (e.g., strict WAF on cw-marketplace)
   │
   └── No response at all (timeout)
       ├── PoW used crypto.subtle async → switch to sync (§5.2)
       ├── /assets/js/bundle URL wrong (used /api/v2/collector instead)
       └── ft wrong (used 401 → should be 388)
```

---

# §15 Cross-Platform Bundle Porting

Like Collector's 7-step method (see general methodology §6.8), Bundle is **7 steps + 5 specific steps**:

## 7 Shared Steps (Same as Collector)

1. Capture the new site's captcha.js + WASM
2. Extract Bundle AppID (OB#1 segment#3)
3. Extract new FT (look at POST body's `ft=`)
4. Adapt OB handler shapes
5. Adapt wire charset (`0/l` vs `o/I`)
6. Rebuild EV2 field template (6-batch cross-batch diff)
7. End-to-end test

## 5 Bundle-Specific Steps

8. **WASM constant extraction** (ChaCha20 seed / HMAC key / custom alphabet)
9. **error_stack template** (collect per Chrome version)
10. **Myanmar DOM encoding template** (collect per new captcha iframe rendering)
11. **Mouse trajectory pool** (if the new site's captcha button position/size differs, recapture)
12. **iframe Hook adaptation** (different sites have different captcha iframe URL patterns)

See `bundle/doc/Bundle_完整技术文档.md` §14.

---

# §16 SDK Upgrade Response

Like Collector upgrade response (general methodology §6.9), **Bundle requires additional checks**:

| Check | Frequency |
|---|---|
| Collector main.min.js SHA | 1-2× per month |
| **Bundle captcha.js SHA** | **Every 2-3 weeks** (3× the Collector frequency) |
| **Bundle WASM SHA + ChaCha20 seed** | Same as captcha.js (bundled upgrade) |
| **error_stack templates** (per Chrome version) | On Chrome major-version upgrade |
| **Myanmar DOM templates** (per captcha iframe HTML) | On captcha.js upgrade |

**Key insight**: **Bundle upgrade frequency is 2-3× that of Collector**. The long-term maintenance cost of a Bundle generator is far higher than Collector.

---

# §17 When to Give Up the Bundle Path

3 scenarios for abandoning Bundle pure-algo:

## 17.1 Business 90% Traffic Doesn't Trigger Bundle

If only 1% of traffic needs Bundle, **using a Userscript fallback is 10× more cost-effective than a pure-algo generator**:
- Reuse cookies for 5 minutes after obtaining → 1 Userscript session can serve a window of users
- No need to maintain 2,131 lines of artifact
- No need to handle captcha.js upgrading every 2-3 weeks

iFood 2026's actual deployment chose this path.

## 17.2 PX Major Rewrite of WASM

If PX switches the WASM module from wasm-bindgen to a different toolchain (e.g., emscripten), or from ChaCha20 to a different stream cipher — **expect 16+ hours of re-analysis**.

Consider:
- Can the business survive using the Userscript fallback?
- How likely is WASM replacement? (Measured: PX hasn't changed toolchain in 3 years)
- 16h maintenance vs the loss from not doing Bundle?

## 17.3 Your Target Isn't PX Anti-bot

The Bundle path **only applies to PX-customer sites**. If your next target uses Cloudflare Turnstile / Akamai / DataDome / Imperva — Bundle knowledge **doesn't generalize**.

Those WAFs' "press challenge" mechanisms each differ; start from zero.

---

# §18 Reference Resources

| Resource | Path |
|---|---|
| Bundle full technical doc (4,996 lines) | [`../../bundle/doc/Bundle_完整技术文档.md`](../../bundle/doc/Bundle_完整技术文档.md) |
| Collector methodology (prerequisite, 1,233 lines) | [`../ZH/PX_逆向方法论_通用版.md`](../ZH/PX_逆向方法论_通用版.md) |
| PX SDK complete technical doc (prerequisite) | [`../ZH/PX_SDK_逆向技术文档.md`](../ZH/PX_SDK_逆向技术文档.md) |
| iFood/Grubhub SDK comparison (prerequisite) | [`../ZH/PX_完整SDK对照逆向方法论.md`](../ZH/PX_完整SDK对照逆向方法论.md) |
| Bundle path 20 gotchas | [`../../bug_report/2_bundle_path.md`](../../bug_report/2_bundle_path.md) |
| Bundle production userscript | [`../../bundle/script/userscripts/px_bundle3_auto.user.js`](../../bundle/script/userscripts/px_bundle3_auto.user.js) |
| Bundle SDK source materials | [`../../bundle/source/`](../../bundle/source/) |
| Bundle real captures | [`../../bundle/stample/`](../../bundle/stample/) |
| WASM toolchain (wabt) | https://github.com/WebAssembly/wabt |
| wasm-bindgen (PX uses this) | https://rustwasm.github.io/wasm-bindgen/ |

---

*Verified 2026-05-21. This document is based on iFood Bundle 2026-02 production 10/10 + Pr0t0ns v8.9.6 comparison. Next major revision: when PX pushes a Bundle major version (typically 6 months – 1 year).*
