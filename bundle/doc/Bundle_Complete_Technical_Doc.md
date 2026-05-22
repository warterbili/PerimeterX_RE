# PerimeterX Bundle Path — Complete Technical Documentation

> **Goal**: completely reproduce, with pure algorithms, the PX SDK press-challenge link (Bundle / captcha.js / PoW / WASM) from packet capture to a usable `_px3` cookie.
>
> **Input**: a PX-customer site's target URL (e.g. iFood) + bundle AppID.
> **Output**: a script that stably runs Bundle#1 → #2 → #3 in a Node.js process and obtains `_px3`.
>
> **Status**: iFood validated 10/10; pure-algo end-to-end implementation is ~70% complete; the remaining 30% is behavioral synthesis quality (mouse trajectory pool / cross-Chrome-version error stacks / WASM constant updates).
>
> **Verified**: 2026-05-21
>
> **Companion materials**: this document is the digested merge of 31 source documents (12,000+ lines). The originals have been deleted after merging (see `bundle/README.md` "Archive Notes" for the detailed mapping).
>
> **Companion userscript**: [`../script/userscripts/px_bundle3_auto.user.js`](../script/userscripts/px_bundle3_auto.user.js) (2,131 lines) — the actual "pure-algo press challenge" artifact, 10/10 production verified.

---

## Table of Contents

[Part 1: Overview](#part-1-overview) — Bundle trigger conditions, relationship with Collector, 4-request pipeline, two AppIDs, FT, Mobile SDK comparison

[Part 2: Protocol Layer Fundamentals](#part-2-protocol-layer-fundamentals) — endpoints, request structure, OB decoding, 27 Ql handlers, ih dispatcher, cookie/storage, event callbacks, reporting system

[Part 3: Bundle#1 Complete Reverse](#part-3-bundle1-complete-reverse) — trigger, 16 fields, `mh()` main constructor, OB#1 13 segments, Bundle vs Collector field mapping

[Part 4: Proof of Work Complete Reconstruction](#part-4-proof-of-work-complete-reconstruction) — algorithm, performance, two paths (I0I0I0 / 0II0I0), full Bs source, `poi()`, Web Worker path, validation examples

[Part 5: WebAssembly Integration](#part-5-webassembly-integration) — extraction (10 paths), a()/b() exports, 34 wbg imports, Node mock, ChaCha20, custom encoding

[Part 6: Bundle#2 Complete Reverse](#part-6-bundle2-complete-reverse) — 228-field three-class taxonomy, PoW + WASM injection, sid steganography (incl. cts numeric steganography), anti-tamper, OB#2

[Part 7: Bundle#3 Press Challenge](#part-7-bundle3-press-challenge) — **6 events** in strict order (including Metrics), PX561 95 fields (Tier 1-5), Bezier trajectory, Myanmar DOM, 4 error stacks

[Part 8: Bundle#4 Fallback / Telemetry](#part-8-bundle4-fallback--telemetry) — dual identity, when to send

[Part 9: State Machine + state.* Cross-Request Propagation](#part-9-state-machine--state-cross-request-propagation) — 15 global variables, UUID constant throughout

[Part 10: Complete 229-Field Classification](#part-10-complete-229-field-classification) — detailed walkthrough of 17 categories + type distribution + key findings

[Part 11: Encryption Chain — Source-Level Detail](#part-11-encryption-chain--source-level-detail) — Jf() interleave, jt() PC, it() JSON, ee() XOR, hh() sid steganography, cs server-issued, full parameter-source table

[Part 12: 5 Gaps in End-to-End Pure-Algo](#part-12-5-gaps-in-end-to-end-pure-algo)

[Part 13: Userscript Production Solution](#part-13-userscript-production-solution) — **`px_bundle3_auto.user.js`** 2,131-line artifact (intercept B1/B2 + construct B3 + iframe Hook; pure-algo press-challenge)

[Part 14: Cross-Platform Porting 7-Step Method](#part-14-cross-platform-porting-7-step-method)

[Part 15: Complete Gotcha Index](#part-15-complete-gotcha-index)

[Part 16: SDK Drift Response](#part-16-sdk-drift-response)

[Part 17: iFood Business + Anti-bot Layer](#part-17-ifood-business--anti-bot-layer) — business APIs, hook stacks, collect request chain, ah function, cw-marketplace TLS

[Part 18: External Resources + Pr0t0ns v8.9.6 Comparison](#part-18-external-resources--pr0t0ns-v896-comparison)

[Part 19: Project Work Log](#part-19-project-work-log) — file index, breakthroughs, ROI

[Part 20: Mobile SDK Comparison](#part-20-mobile-sdk-comparison)

[Appendix A — Constant Quick Reference](#appendix-a--constant-quick-reference) / [Appendix B — Debug Command Reference](#appendix-b--debug-command-reference) / [Appendix C — Relationship to Other Project Parts](#appendix-c--relationship-to-other-project-parts)

---

# Part 1: Overview

## 1.1 What Bundle Is to PX

PerimeterX, when deployed on customer sites, has a **dual-path** anti-bot design:

```
                       Browser load
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
       Silent Collector            Press Bundle
       (sensorless)              (sensored / press challenge)
                                       │
       main.min.js                 captcha.js
       (~230 KB)                   (~480 KB + WASM ~60 KB)
              │                         │
              ▼                         ▼
       2-3 POSTs                   4 POSTs
       Obtain _px3                 + Real press interaction
       (TTL 330s)                  Obtain _px3 (TTL 330s)
```

**Bundle is Collector's fallback**: when a Collector cookie is judged risky by a business API, the API returns 403 + a `blockScript` field indicating `captcha.js` to load; the browser enters the press challenge.

**Traffic distribution**: measured roughly 99% of traffic uses Collector; 1% triggers Bundle.

## 1.2 When Bundle Triggers

PX's backend risk-scoring model triggers (measured):

| Trigger condition | Threshold |
|---|---|
| Same IP + UA short-window request count | **~200 requests** then random trigger |
| Same-cookie business API call count | Probability rises after ~100 |
| Business API consumed in list-traversal order (scraper behavior) | Unclear; can trigger after a few |
| Same-account access pattern deviates from human | Fuzzy judgment |
| IP falls in a PX-known datacenter range | **Instant trigger** |

After triggering, the server responds:

```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "blockScript": "https://client.px-cloud.net/PXO1GDTa7Q/captcha.js?v=...",
  "appId": "PXO1GDTa7Q",
  "uuid": "<session uuid>",
  "vid": "<visitor id>",
  "blockUuid": "<challenge uuid>"
}
```

The browser then loads the challenge script via `<script src="...captcha.js">`.

**Trigger reproduction tool** (`trigger_captcha.js`):

```js
// Infinite POST loop to iFood API at 100ms intervals to trigger the challenge
async function triggerCaptcha() {
    let count = 0;
    while (true) {
        const resp = await fetch('https://cw-marketplace.ifood.com.br/v1/...', {
            method: 'POST',
            headers: { 'Cookie': '_px3=...' },
        });
        count++;
        if (resp.status === 403) {
            const body = await resp.json();
            if (body.blockScript) {
                console.log(`Challenge triggered after ${count} requests!`);
                console.log(`captcha.js: ${body.blockScript}`);
                return body;
            }
        }
        await sleep(100);
    }
}
```

## 1.3 Bundle's Relationship to Collector (Silent)

**Fully shared algorithm layer** (~70% code reuse):

| Algorithm | Collector | Bundle |
|---|---|---|
| payload encryption chain (serialize → XOR(50) → base64 → interleave) | ✅ | ✅ (interleave key uses UUID instead of AppID) |
| PC HMAC-MD5 + 16-digit digit extraction | ✅ | ✅ (different FT) |
| OB response decode (XOR + 4-tilde split + handler dispatch) | ✅ | ✅ + 2 additional PoW handlers |
| SID + Unicode Tag Char steganography | ✅ | ✅ (includes cts numeric steganography) |
| UUID v1 with deterministic node | ✅ | ✅ |
| `/ns` probe | ✅ | ✅ |

**Bundle-only 5 additions** (~30% new):

| Algorithm | Used in | Complexity |
|---|---|---|
| **Proof of Work** (SHA-256 16-bit brute force) | Bundle#2 | Low |
| **WebAssembly fingerprint** (a/b two exports) | Bundle#2 + Bundle#3 | High (requires WASM + ChaCha20) |
| **Bezier mouse trajectory** | Bundle#3 PX535 | Medium |
| **Myanmar DOM encoding** | Bundle#3 PX11116 | Low |
| **Error stack template** (4 entries) | Bundle#3 PX11116 | Medium (binds to Chrome version) |

**Core insight**: getting Collector working teaches you 70% of Bundle. The remaining 30% concentrates in Bundle#3 press challenge.

## 1.4 4-Request Pipeline

Full timeline:

```
Browser                Bundle Collector              captcha.wasm
   │                          │                           │
   │  ───── Bundle#1 ─────►   │                           │
   │   16 fields, initial     │                           │
   │   fingerprint            │                           │
   │   ◄────── OB#1 ──────    │                           │
   │  13 segments: bundle     │                           │
   │  AppID, PoW params       │                           │
   │  (suffix/target), qa     │                           │
   │  (challenge hash),       │                           │
   │  visual config           │                           │
   │                          │                           │
   │  ── solvePow(s,t,16) ──  │                           │
   │   ~9-60ms brute-force    │                           │
   │  ──────── a() ──────►    │                           │
   │   ◄── 64 hex random ────                             │
   │  ─── b(powAnswer) ─►     │                           │
   │   ◄── 127 chars ─────── │                           │
   │                          │                           │
   │  ───── Bundle#2 ─────►   │                           │
   │   228 fields full        │                           │
   │   fingerprint + PoW      │                           │
   │   ◄────── OB#2 ──────    │                           │
   │   First _px3 (jf=cu)     │                           │
   │                          │                           │
   │  ── User press 1-3s ──   │                           │
   │  + Mouse 544-point       │                           │
   │  Bezier                  │                           │
   │  + 4 error-stack synth   │                           │
   │  + Myanmar DOM encoding  │                           │
   │                          │                           │
   │  ───── Bundle#3 ─────►   │                           │
   │   6-event sequence       │                           │
   │   (WebGL, Metrics,       │                           │
   │   mouseout, PX561,       │                           │
   │   onSolved, PX11994)     │                           │
   │   ◄────── OB#3 ──────    │                           │
   │   Validation pass →      │                           │
   │   valid _px3             │                           │
   │   (jf=success)           │                           │
   │                          │                           │
   │  ───── Bundle#4 ─────►   │                           │
   │   Telemetry (optional)   │                           │
```

All four POSTs hit the **same endpoint** `https://collector-pxo1gdta7q.px-cloud.net/assets/js/bundle`; they differ by `seq=0/1/2/3` and `rsc=N` (note: Bundle#2 in practice has `seq=3`; sessions often carry extra internal counters).

## 1.5 Coexistence of Two AppIDs

⚠️ **Two AppIDs coexist throughout the challenge session**:

| AppID | Value (iFood example) | Used in | Source |
|---|---|---|---|
| **Init AppID** | `PXO1GDTa7Q` | URL (`/PXO1GDTa7Q/captcha.js`, `collector-pxo1gdta7q.px-cloud.net`); Bundle POST body `appId=` parameter | Statically embedded in the captcha.js header |
| **Bundle AppID** (session-scoped) | `PXd6f03jmq8h6c7382req0` or `d6f03jmq8h6c7382req0` | EV2 payload d-field's appId slot (**not** the POST parameter); stored in global `$a` | Dynamically issued via OB#1 segment #3 (`II00II` handler) |

Init AppID is site-fixed; Bundle AppID differs per challenge session.

Extraction logic (auto-set into global `$a` after OB#1 processing):

```js
function extractBundleAppId(obSegments) {
    for (const seg of obSegments) {
        const args = seg.split('|').slice(1);
        if (args.length === 1 && /^[a-z0-9]{12,30}$/.test(args[0])) {
            return args[0];   // length 12-30 all-lowercase alnum = bundle AppID
        }
    }
    throw new Error('bundle appId not found in OB#1');
}
```

> ⚠️ Older versions had someone fill init AppID into the EV2 d-field → PC computed but Bundle#2 rejected. Use the two AppIDs separately.

## 1.6 FT Values per Path

`ft` participates in the PC HMAC salt (`"uuid:tag:ft"`); a wrong value invalidates everything.

| Path | FT | iFood example | Pr0t0ns v8.9.6 |
|---|---|---|---|
| **Silent Collector** | `401` (current) | `401` | `330` (legacy) |
| **Press Bundle** | **`388`** | `388` | `388` |

**Direct consequence**: a cookie obtained via Collector cannot be reused on the Bundle path → rejection. The same payload + uuid + tag produces different PC under different FT.

Cross-platform FTs also vary. Grubhub's Collector FT is `359`.

## 1.7 Overall Timing Constraints

PX strictly validates timing:

| Phase | Expected duration | PX tolerance |
|---|---|---|
| Bundle#1 → OB#1 RTT | 100-500ms | Network-related, lenient |
| PoW solving | 9-60ms (sync) | < 1s (async 600s+ guaranteed timeout) |
| WASM a/b calls | < 100ms total | < 1s |
| Bundle#2 → OB#2 RTT | 100-500ms | Same |
| User press duration | 1-3s | **0.5-5s**; outside the window judged bot |
| Mouse trajectory duration | = press duration ± 100ms | Strict match |
| Bundle#3 → OB#3 RTT | 100-500ms | Same |
| **Total duration** | **10-15s** | **< 30s** (session timeout) |

**Traps**:
1. PoW `crypto.subtle.digest` async implementation 60ms → 600s (gotcha #B5)
2. Deliberate setTimeout delay → 30s timeout (session invalid)
3. Press < 0.5s or > 5s rejected outright (gotcha #B11)
4. Mouse trajectory time window misaligned (gotcha #B13)

## 1.8 Historical Version Changes (v8.9.6 vs v8.10+)

PX has two major versions in 2024-2026:

| Dimension | v8.9.6 (Pr0t0ns era) | v8.10+ (current iFood) |
|---|---|---|
| OB wire characters | `1` / `o` | `0` / `l` (iFood) / `I` / `o` (Grubhub) |
| Field keys | Plaintext `"PX12095"` etc. | base64-encoded (changes per script load) |
| tag field | Plaintext `"v8.9.6"` | base64 `"O2MKZn0OEhI/ag=="` |
| `bi` parameter | None | base64 ~100-byte hardcoded |
| OB XOR key | `gt="DhY8E0h7J2cKHw=="` → key=120 | `gt="P2cLYnkKFhY7bg=="` → key=86 |
| Bundle field count | 12 (Bundle#1) | 16 (Bundle#1) |

Cross-version comparison: see [Part 18](#part-18-external-resources--pr0t0ns-v896-comparison).

## 1.9 Bundle's Differences from Mobile SDK (PX Full Family)

PX has Web SDK + Mobile SDK (Android/iOS); their **algorithm layers are completely different**:

| Dimension | Web SDK | Mobile SDK |
|---|---|---|
| AppID | `PXO1GDTa7Q` | `PXO97ybH4J` (Grubhub mobile), etc. |
| Endpoint | `/api/v2/collector` or `/assets/js/bundle` | `/api/v1/collector/mobile` |
| Payload type | PX12095/PX11590/PX11547 | PX315/PX329 |
| Encryption | XOR(50) + base64 + interleave | base64 (no XOR, no interleave) |
| PoW | SHA-256 brute-force search | Math switch-case (see §20) |
| WASM | Embedded in captcha.js | No WASM |
| TLS | Chrome TLS | okhttp3 TLS |

This document covers **only Web SDK**. Mobile SDK brief comparison: see [Part 20](#part-20-mobile-sdk-comparison).

---

# Part 2: Protocol Layer Fundamentals

## 2.1 Endpoint List

iFood example:

| Endpoint | URL | Contents |
|---|---|---|
| **captcha.js** | `https://client.px-cloud.net/PXO1GDTa7Q/captcha.js?v=…` | ~480 KB, contains WASM base64 |
| **WASM** | embedded inside `captcha.js` (base64 in `Us()[10]`) | `px_captcha.wasm`, ~60,862 bytes |
| **Bundle Collector** | `https://collector-pxo1gdta7q.px-cloud.net/assets/js/bundle` | All 4 POSTs hit this |
| **Sensorless Collector** | `https://collector-pxo1gdta7q.px-cloud.net/api/v2/collector` | Used by the silent path; reference |
| **`/ns` probe** | `https://tzm.px-cloud.net/ns?c={appId}` | Shared with the silent path |
| **client main.min.js** | `https://client.px-cloud.net/PXO1GDTa7Q/main.min.js` | About 10,653 lines of obfuscated code |

Cross-platform, the Bundle Collector hostname follows the Collector pattern (`collector-{appid lower}.px-cloud.net`), but the **path differs**: `/assets/js/bundle` vs `/api/v2/collector`.

## 2.2 Generic Request Structure + Full Parameter Source Table

Each Bundle POST is formatted:

```http
POST /assets/js/bundle?seq=N&rsc=M HTTP/1.1
Host: collector-pxo1gdta7q.px-cloud.net
Content-Type: application/x-www-form-urlencoded
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36
Origin: https://www.ifood.com.br
Referer: https://www.ifood.com.br/
sec-ch-ua: "Not:A-Brand";v="99", "Microsoft Edge";v="145", "Chromium";v="145"
sec-ch-ua-mobile: ?0
sec-ch-ua-platform: "Windows"
sec-fetch-dest: empty
sec-fetch-mode: cors
sec-fetch-site: cross-site

payload=<base64>&appId=PXO1GDTa7Q&tag=<tag>&uuid=<uuid>&ft=388&seq=N&en=NTA&bi=<bi>&pc=<16digit>&...&rsc=M
```

⚠️ **POST parameter order is sensitive** (some PX subsystems hash by literal order). Bundle measured order:

```
seq=0 / rsc=1:  payload, appId, tag, uuid, ft, seq, en, bi, pc, sid, vid, cts, rsc
seq=1 / rsc=2:  payload, appId, tag, uuid, ft, seq, en, bi, cs, pc, sid, vid, cts, ci, rsc
seq=2 / rsc=3:  same as above
seq=3 / rsc=4:  payload, ..., errorPayload, rsc
```

**Full parameter source table**:

| Parameter | Meaning | Source | main.js variable |
|---|---|---|---|
| `payload` | Encrypted EV array (XOR/b64/Jf interleave) | `Jf(events, config)` client | `v` |
| `appId` | Init AppID | Config | `e[yn]` |
| `tag` | PX TAG (base64) | Script-hardcoded | `e[bn]` = `"O2MKZn0OEhI/ag=="` |
| `uuid` | Session UUID v1 (constant throughout) | `Xa()` client | session-scope |
| `ft` | Bundle = 388 | Config | `e[In]` = `388` |
| `seq` | 0/1/2/3 | Client counter | `ph++` |
| `en` | `NTA` constant (base64 of "50", i.e., XOR key declaration) | Constant | — |
| `bi` | bundle info constant (~100-byte base64) | Script-hardcoded | `It` = `"GwNqS048KWpd..."` |
| `cs` | challenge hash (state.qa) | **Server OB#1 III000 handler issued** | `Ho()` = `qa` |
| `pc` | 16-digit checksum | HMAC-MD5 client | `jt(it(events), "uuid:tag:ft")` |
| `sid` | UUID + Unicode Tag steganography (cts digits) | Client | `uuid + hh(ni())` |
| `vid` | visitor ID | Client / cookie | `Tt()` |
| `ci` | challenge ID | Server-issued | `as()` |
| `cts` | client timestamp (first request UUID, subsequent ms timestamp) | Client | `Ua` |
| `rsc` | request sub-counter (1/2/3/4) | Client-incremented | `++Cm` |
| `errorPayload` | Error report | Bundle#4 only | — |
| `/ns token` | GET `/ns?c={appId}` return value | Network fingerprint | `Sm` → payload field |

> 💡 `cs` is NOT client-computed (many newcomers assume so). It's stored to global `qa` by the OB#1 `III000` handler from the server-issued challenge hash; the client just replays. See [§11.7](#117-cs-is-server-issued-not-client-computed).

## 2.3 Full OB Response Decoding Flow

OB decoding reuses Collector's, but Bundle adds 2 handlers. Full flow:

```
JSON response
  │
  ├── Check .do field (priority)
  ├── Check .ob field
  │
  ▼ Step 1: Base64 decode
atob(obValue)
  │
  ▼ Step 2: XOR decode
ee(decoded, key=xorKey)
  │
  ▼ Step 3: Split
xored.split("~~~~")        // 4 tildes!
  │
  ▼ Step 4: Parse each segment
segment.split("|")
  → fields[0] = handler key (shift, discard)
  → fields[1..] = argument list
  │
  ▼ Step 5: Dispatch to ih()
ih(segments, isDo=false)
  → Identify handler by shape
  → Execute handler, set global state
```

### 2.3.1 XOR Key Is Dynamically Computed, Not a Constant

```js
// ml(): hash function → 3-digit numeric string
function ml(t) {
    for (var e = 0, n = 0; n < t.length; n++) {
        e = (31 * e + t.charCodeAt(n)) % 2147483647;
    }
    return (e % 900 + 100).toString();
}

// Et() returns the gt constant (varies per script version)
function Et() {
    return "DhY8E0h7J2cKHw==";   // legacy → key=120
    // or "P2cLYnkKFhY7bg==" → key=86
    // or "U0MmDhUmOnhXSw==" → iFood current key=100
    // or "FmYgK1gdJEAP" → Grubhub key=91
}

// XOR key computation
var xorKey = parseInt(ml(Et()), 10) % 128;
```

⚠️ Hardcoding `xorKey=120` breaks after SDK upgrade. In production, **recompute on every decode**.

### 2.3.2 Separator Is Four Tildes (Not Three)

```
"~~~~" = 0x7E 0x7E 0x7E 0x7E
Pre-XOR(120) raw bytes: 0x06 0x06 0x06 0x06
```

Code:
```js
const segments = decoded.split("~~~~");   // ⭐ must be 4 tildes
```

### 2.3.3 Handler Key Is at the Front of Each Segment (shift, Not pop)

```js
// Each segment format: "handlerKey|arg1|arg2|..."
for (const seg of segments) {
    const fields = seg.split("|");
    const handlerKey = fields.shift();   // ⭐ shift the first field
    const args = fields;                  // remaining are args
    // ...
}
```

### 2.3.4 Full decodeOb Pseudocode

```js
function decodeOb(responseJson, tag) {
    const xorKey = parseInt(ml(tag), 10) % 128;
    const data = JSON.parse(responseJson);
    const obBase64 = data.do || data.ob;
    if (!obBase64) return { segments: [], state: {} };

    const raw = Buffer.from(obBase64, 'base64').toString('binary');   // ⚠️ binary, not utf-8
    const decoded = xorString(raw, xorKey);
    const segments = decoded.split('~~~~');

    return { xorKey, segments };
}
```

## 2.4 27 Ql Handler Registry

OB segments dispatch through `ih()` to the `Ql` registry (`main.js:3933-4239`). The Bundle path uses **27 handlers, plus 2 PoW handlers, totaling 29**. Full table:

### 2.4.1 State Setting (6 entries)

| Handler key | Called function | Args shape | Effect |
|---|---|---|---|
| `I0I000` | `jf = t` | (flag) | `jf = "cu"` (cu=continue press, success=complete) |
| `0IIII0` | `fh(t, e)` | (sessionId, extra) | `to = t, eo = e` |
| `0III0I0I` | `ch(t)` | (timestamp_ms) | `no = t, ro = Math.floor(t/1000)` |
| `II00II` | — | (appId) | `$a = t` (**bundle AppID**) |
| `0III0I00` | `ah(t)` | (statusCode) | `ao = t` (e.g., `"401"`) |
| `III000` | — | (hash) | `qa = t` (**challenge hash, 64 hex**) |

### 2.4.2 PoW / Challenge (3 entries)

| Handler key | Called function | Args shape | Effect |
|---|---|---|---|
| `I0I0I0` | `PX1135 = Bs` | (enabled, suffix, targetHash, difficulty, isTrusted) | **Directly calls Bs to solve PoW** (main path) |
| `0II0I0` | `qu → os → Bs` | (enabled, uuid, port, challengeData, extra, tag) | **Invoke PoW via qu()** (backup path) |
| `0II0III0` | — | (startW, startH, wJump, hJump, hash) | **Visual challenge params PX12634** (puzzle) |

### 2.4.3 Cookie / Storage (7 entries)

| Handler key | Called function | Args shape | Effect |
|---|---|---|---|
| `IIIIII` | `Xr(true, {...})` | (featureName, ttl, args) | Store cookie config to `Mr[ff]` |
| `III0II` | **`oh()`** | (name, ttl, value, secure, maxAge) | ⭐ **Write _px3 cookie** |
| `II0III` | — | (configStr) | Parse `"key:val,key:val"` config |
| `I0III0` | `rh()` | (value) | localStorage write |
| `0III0II0` | `hr + Ao` | (key, ttl, value, param, extra) | Store TTL + trigger `"si"` event |
| `0II0II0I` | — | (value) | localStorage write (#2) |
| `I000II` | `sr(go)` | (cookieName) | **Delete specified cookie** |

### 2.4.4 DOM / Navigation (4 entries)

| Handler key | Called function | Args shape | Effect |
|---|---|---|---|
| `IIII00` | — | (id, tagName, name, className) | Create hidden DOM honeypot |
| `00I0I0` | — | (url, ttl, param) | Redirect / navigate |
| `000II0` | — | (flag) | Add timestamp to URL or reload |
| `0II0IIII` | — | (scriptUrl) | Dynamically load `<script>` |

### 2.4.5 Events / Control (5 entries)

| Handler key | Called function | Args shape | Effect |
|---|---|---|---|
| `I0I00I` | `Ao.trigger` | (event, ...args) | Trigger event callback ("sc"/"si") |
| `00II00` | `Rf("report")` | (type, data, code) | Report log |
| `0III00I0` | `PX764` | (data) | `$u` call |
| `IIIII0` | — | — | PX control (`th=true`) |
| `I000I0` | `Gf()` | — | Reset |

### 2.4.6 No-op (2 entries)

| Handler key | Call |
|---|---|
| `0I0II0` | noop |
| `0II00I` | noop |

### 2.4.7 Handler Key Naming Rules

- Made of `I` and `0` (**iFood current**; older versions used `1` and `o`)
- Length: **6 or 8 characters**
- 6-char: `I0I000`, `0IIII0`, `III0II`, `IIIIII`, `II00II`, `II0III`, `III000`, `I0III0`, `IIII00`, `00I0I0`, `I0I00I`, `00II00`, `000II0`, `0I0II0`, `0II00I`, `I000I0`, `I000II`, `IIIII0`, `I0I0I0`, `0II0I0`
- 8-char: `0III0I0I`, `0III0I00`, `0II0III0`, `0III0II0`, `0III00I0`, `0III0000`, `0II0IIII`, `0II0II0I`

⚠️ **Handler key characters change across versions** (Grubhub uses `I/o`, old iFood uses `1/o`). Identify **by args shape**, not by key string.

## 2.5 ih Segment Processor + "cc" Deferred Mechanism

ih (`main.js:4310-4339`) is the OB segment dispatcher:

```js
function ih(segments, isDo) {
    // isDo=false → Ql registry (ob response)
    // isDo=true  → jl registry (do response)
    var registry = isDo ? jl : Ql;
    var deferred = null;
    var queue = [];

    for (var i = 0; i < segments.length; i++) {
        var fields = segments[i].split("|");
        var handlerKey = fields.shift();   // first field
        var handler = registry[handlerKey];

        // ⭐ "cc" deferred marker
        if (fields[0] === "cc") {
            deferred = {key: handlerKey, args: fields};
            continue;
        }

        if (typeof handler === "function") {
            queue.push({key: handlerKey, args: fields});
        }
    }

    if (deferred) queue.unshift(deferred);   // cc segment moves to queue head

    for (var j = 0; j < queue.length; j++) {
        registry[queue[j].key].apply(ctx, queue[j].args);
    }
}
```

### 2.5.1 The "cc" Mechanism

```
Source: Rr[Te] = J("Y2M=") → atob("Y2M=") → "cc"

Effect: when the segment's first argument is "cc":
  1. The segment is removed from the normal queue
  2. Stored as deferred
  3. Pre-execution unshifted to queue head → executed first

Practical effect: I0I000 segments (jf="cu") are marked "cc", so they execute before all other segments
```

### 2.5.2 Execution Order Example (Bundle#1)

```
Original OB segment order: [seg0(cc), seg1, seg2, ..., seg9(cc), seg10, seg11, seg12]

After ih() processing:
  - Only the last "cc" segment is deferred (earlier ones overwritten)
  - seg0 cc(I0I000) and seg9 cc(IIIIII) are both cc → seg9 overwrites seg0
  - Final: [seg9(unshifted to head), seg1, seg2, ..., seg8, seg10, seg11, seg12]
```

### 2.5.3 do vs ob

- `.do` → `jl` registry (do segments; PX internal error/control flow)
- `.ob` → `Ql` registry (normal OB segments)

Bundle's main path uses `.ob` only. `.do` occasionally appears in Bundle#4 fallback.

## 2.6 Full Global State Variable Table

After OB handlers execute, they set many global variables that form the "session state". Full table:

### 2.6.1 Handler-Set Variables (main.js globals)

| Variable | Setting handler | Type | Example value | Purpose |
|---|---|---|---|---|
| `jf` | `I0I000` | string | `"cu"` / `"success"` | Control flag |
| `to` | `0IIII0` | string | `"41916095560041989364"` | Session / Tracking ID (19-20 digit number) |
| `eo` | `0IIII0` | string | — | `fh` second arg |
| `no` | `0III0I0I` | string | `"1771962830422"` | **Server timestamp (ms)** — Jf interleave key |
| `ro` | `0III0I0I` | number | `1771962830` | Timestamp (seconds) |
| `ao` | `0III0I00` | string | `"401"` | HTTP status code |
| `qa` | `III000` | string | `"4481f3...03bc"` | **Challenge hash (SHA-256)** — used as `cs=` |
| `$a` | `II00II` | string | `"d6f03jmq8h6c7382req0"` | **Bundle AppID** |
| `Lu` | `0II0I0` | string | `"8a213f60-..."` | PoW UUID |
| `Mr` | `IIIIII / II0III` | object | `{cc:"...", rf:"1"}` | Cookie config storage |

### 2.6.2 Collector-Set Variables

| Variable | Source | Type | Purpose |
|---|---|---|---|
| `bt` | VID cookie | string | Visitor ID |
| `mt` | Timestamp | string | Timestamp string |

### 2.6.3 PoW Internal Variables

| Variable | Location | Type | Purpose |
|---|---|---|---|
| `Es` | captcha.js | string | PoW answer (candidate) |
| `Js` | captcha.js | number | PoW elapsed (ms) |

### 2.6.4 Where State Is Obtained and Where It's Injected (One Diagram)

```
Bundle#1 ──► (payload uses default no = 1604064986000)
              │
              ▼
         OB#1 extracts:
         ─ state.no          ──►┐
         ─ state.appId       ──►│
         ─ state.qa          ──►│
         ─ state.to          ──►│
         ─ state.pxsid       ──►│ Bundle#2 (inject)
         ─ state.vid         ──►│
         ─ state.cts (UUID)  ──►│
         ─ pow.suffix        ──►│
         ─ pow.target        ──►┘
                  │
                  ▼ Local PoW + WASM
                  ▼
Bundle#2 ──► (payload interleaved by state.no, inject all state, PoW, WASM)
              │
              ▼
         OB#2 extract/update:
         ─ _px3 (first version)
         ─ state.cts (upgraded to ms)
         ─ jf=cu or success
                  │
                  ▼ User press (or synthesized)
                  ▼
Bundle#3 ──► (inject all state, PoW, WASM, mouse, error stacks, DOM)
              │
              ▼
         OB#3 extracts:
         ─ _px3 (valid version)
         ─ jf=success
                  │
                  ▼
Bundle#4 ──► (telemetry, optional)
```

⚠️ **The entire session uses the same UUID v1** (Bundle#1-#4 + WASM's `globalThis._pxUuid`). Once inconsistent, the PX backend's `state.pxsid` ↔ uuid relationship breaks → rejection.

## 2.7 Cookie / Storage Mechanism

PX writes not just `_px3` but also a bunch of config cookies and localStorage entries. Full functions:

### 2.7.1 `hr()`: Cookie Write (`main.js:1012-1034`)

```js
function hr(cookieName, ttl, value, domain) {
    // ttl: number (seconds) or date string
    var maxAge = String(ttl);
    var expires = new Date(Date.now() + 1000 * ttl).toUTCString();

    var cookie = cookieName + "=" + value
        + "; max-age=" + maxAge
        + "; expires=" + expires
        + "; path=/";

    if (domain === true || domain === "true") {
        cookie += "; domain=." + er();   // er() returns top-level domain ("ifood.com.br")
    }

    cookie += "; " + lr();   // lr() returns SameSite etc. config ("SameSite=Lax")

    document.cookie = cookie;
}
```

### 2.7.2 `sr()`: Cookie Delete (`main.js:1002-1005`)

```js
function sr(cookieName) {
    hr(cookieName, -90000, '', true);    // delete with domain
    hr(cookieName, -90000, '', false);   // delete without domain
}
```

### 2.7.3 `Xr()`: Cookie Config Storage (`main.js:1171-1187`)

```js
function Xr(isFlag, config) {
    // config = {ff: featureName, ttl: seconds, args: value}
    Mr[config.ff] = isFlag ? config.args : '1';

    if (config.ttl > 0) {
        // Store into localStorage key="px-ff"
        // Sr("px-ff", { [config.ff]: { ttl: Date.now() + ttlMs, val: value } })
    }
}
```

`Mr` is a global dict storing PX feature flags: `{cc: "U2FtZVNpdGU9TGF4Ow==", rf: "1", fp: "1", ccc: "0", ic: "0", nf: "0", ai: "0"}`.

### 2.7.4 `oh()`: Set _px3 Cookie (`main.js:4276-4309`)

```js
function oh(cookieName, ttl, cookieValue, secure, maxAge) {
    // 1. Trigger "sc" event
    Ao.trigger("sc", cookieValue, cookieName, ttl, maxAge);

    // 2. Write the cookie
    hr(cookieName, ttl, cookieValue, secure === "true");

    // 3. Also store into localStorage
    //    key: "x-px-cookies"
    //    value: JSON.stringify({_px3: cookieValue})
}
```

### 2.7.5 localStorage Interaction

```
Write points:
  ─ I0III0 handler  → zl.setItem(Io, value)     // Io = some key
  ─ 0II0II0I handler → zl.setItem(So, value)    // So = some key
  ─ oh()             → localStorage["x-px-cookies"] = {_px3: value}

Read points:
  ─ Cookie hook (cookie_hook.js) uses Tampermonkey to intercept document.cookie setter
  ─ When cookie name === "_px3", break and print the stack
```

### 2.7.6 _px3 Cookie Full Structure

```
Format: hash:base64data:ttl:signature

Example:
  "2d8e5e:aGVsbG8=:330:c2lnbg=="
   └hash └data       └ttl └sig

Actual from OB#2 decode:
  "2f7b7d4363ccd1fe727a848bd37b9685cab01f55f7030661c29873dc6f064996:1bj7B/n4Yx3U..."
   └─── 64 hex (SHA-256) ─────────────────────────────────────── └ base64 data
```

⚠️ The cookie has a TTL (`_px3` = 330s). Long-running tasks must actively refresh (gotcha #33).

## 2.8 Event Callback System Ao + Reporting System Rf

### 2.8.1 Ao Definition (`main.js:891-928`)

```js
const Ao = {
    channels: {},

    on(event, fn, ctx)  { this.subscribe(event, fn, ctx, false); },
    one(event, fn, ctx) { this.subscribe(event, fn, ctx, true); },
    off(event, fn)      { /* remove listener */ },

    subscribe(event, fn, ctx, once) {
        this.channels[event] = this.channels[event] || [];
        this.channels[event].push({fn, ctx, once});
    },

    trigger(event, ...args) {
        var handlers = this.channels[event];
        if (!handlers) return;
        var remaining = [];
        while (handlers.length > 0) {
            var h = handlers.shift();
            h.fn.apply(h.ctx, args);
            if (!h.once) remaining.push(h);
        }
        this.channels[event] = remaining;
    }
};
```

### 2.8.2 Event List

| Event name | Trigger | Args | Purpose |
|---|---|---|---|
| `"sc"` | `oh()` / `III0II` handler | (cookieValue, name, ttl, maxAge) | Cookie set complete |
| `"si"` | `0III0II0` handler | (value, key, ttl, extra) | Storage complete |
| Custom | `I0I00I` handler | (event, ...args) | Dynamically triggered |

### 2.8.3 Reporting System Rf

```js
let If = 0;       // incrementing sequence number
const Sf = [];    // send queue
const Tf = [];    // pending send queue

function Rf(type, data) {
    data["ZHgWeiIcE0o="] = If++;             // sequence number (base64 key)
    data["GU1rT18laH0="] = Date.now();       // timestamp
    // Judge whether wf(type, data) can be sent immediately
    // Yes → Sf, otherwise → Tf
    Sf.push({t: type, d: data, ts: Date.now()});
}
```

`Rf("report", ...)` is triggered by the `00II00` handler to report client state (errors, performance, behavior) to the PX backend.

---

# Part 3: Bundle#1 Complete Reverse

## 3.1 Trigger and Request Construction

Bundle#1 is the first POST sent after `captcha.js` finishes loading. Script entry:

```
captcha.js finishes loading
  → Execute self-invoking IIFE
  → Create window._O1GDTa7Qhandler global object
  → Call mh() main constructor
  → mh() generates 16-field initial fingerprint
  → Call collect() to send Bundle#1
```

Full HTTP request:

```http
POST /assets/js/bundle?seq=0&rsc=1 HTTP/1.1
Host: collector-pxo1gdta7q.px-cloud.net
Content-Type: application/x-www-form-urlencoded
Origin: https://www.ifood.com.br
Referer: https://www.ifood.com.br/
sec-ch-ua: "Not:A-Brand";v="99", "Microsoft Edge";v="145", "Chromium";v="145"
sec-ch-ua-mobile: ?0
sec-ch-ua-platform: "Windows"
sec-fetch-dest: empty
sec-fetch-mode: cors
sec-fetch-site: cross-site
user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...

payload=<base64+Jf interleave>&appId=PXO1GDTa7Q&tag=O2MKZn0OEhI/ag==&uuid=eb30dfdf-11c5-11f1-9781-bac43f3b40b0&ft=388&seq=0&en=NTA&bi=GwNqS048KWpd...&pc=9751268234020178&sid=51338389-11b8-11f1-bb6d-13e608bfecce&vid=51337cf3-11b8-...&cts=513385fa-11b8-...&rsc=1
```

⚠️ `cts` is in UUID format at Bundle#1; from Bundle#2 onward it becomes an ms timestamp (gotcha #27).

Bundle#1's payload uses the **default serverNo `1604064986000`** as the interleave key (OB#1 hasn't returned yet).

## 3.2 Bundle#1 vs Collector#1 Parameter Comparison

iFood measured:

| Parameter | Collector | Bundle | Difference |
|---|---|---|---|
| URL | `/api/v2/collector` | `/assets/js/bundle` | Different endpoints |
| `ft` | `401` | `388` | Different |
| `tag` | base64 (v8.10+) or `"v8.9.6"` (v8.9.6) | `"O2MKZn0OEhI/ag=="` (base64) | Different |
| `bi` | None | base64 ~95 bytes | Bundle-specific |
| `payload` | XOR(50) + base64 + 20-char interleave | XOR(50) + base64 + **Jf() interleave** | Bundle interleave key uses UUID |
| `sid` | Plain UUID | UUID + **steganographed cts digits** | Bundle appends Unicode Tag |
| Field count | 12 (Collector #1) | 16 (Bundle #1) | Bundle 4 more |

> Collector's PX12095 payload's 12 fields are exactly Bundle Payload's first 12; Bundle adds 4: `PX key reference` + `_pxhd cookie type` + `boolean flag` + `_pxhd cookie value (~665 bytes)`.

## 3.3 Payload 16-Field Detail

Bundle#1's EV array has only 16 fields (lightweight initial fingerprint). The `t` field is the payload type identifier (base64-encoded, similar to Collector's `"PX12095"`):

```json
[{
  "t": "GU1oT1wgZ3g=",
  "d": {
    "WQ0oDx9mKjg=": "https://www.ifood.com.br/restaurantes",
    "Fm4nbFMBIVk=": 1,
    "EFQhFlU9Iiw=": "Win32",
    "KDxZPm5YXw4=": 0,
    "MVUAV3c9AGU=": 3182,
    "Y1tSWSY0UGM=": 3600,
    "InpTeGQUXU8=": 1771967721486,
    "eW1ILzwCRh0=": 1771967721493,
    "FUlkS1Mga38=": "eb30dfdf-11c5-11f1-9781-bac43f3b40b0",
    "R382PQIXNgs=": null,
    "MkpDCHciQz8=": 0,
    "OS0Ib39DCVQ=": false,
    "fEANAjkuCzc=": "PX11745",
    "TTE8cwtaPEk=": "pxhc",
    "EFQhFlU6Iyw=": false,
    "LVEcU2g7GmI=": "a088cf8a...cookie_value...:1000:signature"
  }
}]
```

### 3.3.1 Field Mapping (Bundle vs Collector PX12095)

| # | Bundle key (base64) | Example value | Corresponding Collector PX key | Meaning |
|---|---|---|---|---|
| 0 | `WQ0oDx9mKjg=` | `"https://www.ifood.com.br/..."` | PX11645 | Current page URL |
| 1 | `Fm4nbFMBIVk=` | `1` | PX12207 | Flag |
| 2 | `EFQhFlU9Iiw=` | `"Win32"` | PX12458 | `navigator.platform` |
| 3 | `KDxZPm5YXw4=` | `0` | PX11902 | Request counter |
| 4 | `MVUAV3c9AGU=` | `3182` | PX11560 | Random value (2809-3809) |
| 5 | `Y1tSWSY0UGM=` | `3600` | PX12248 | Fixed value (TTL 1h?) |
| 6 | `InpTeGQUXU8=` | `1771967721486` | PX11385 | Start timestamp (ms) |
| 7 | `eW1ILzwCRh0=` | `1771967721493` | PX12280 | End timestamp (ms, +7) |
| 8 | `FUlkS1Mga38=` | `"eb30dfdf-..."` | PX11496 | Session UUID |
| 9 | `R382PQIXNgs=` | `null` | PX12564 | Null value |
| 10 | `MkpDCHciQz8=` | `0` | PX12565 | Counter (Collector has -1) |
| 11 | `OS0Ib39DCVQ=` | `false` | PX11379 | Boolean flag |
| **12** | `fEANAjkuCzc=` | `"PX11745"` | **None** | ⭐ **PX key reference** |
| **13** | `TTE8cwtaPEk=` | `"pxhc"` | **None** | ⭐ **_pxhd cookie type** |
| **14** | `EFQhFlU6Iyw=` | `false` | **None** | ⭐ **Boolean flag** |
| **15** | `LVEcU2g7GmI=` | `"a088cf8a...:...:1000:..."` | **None** | ⭐ **_pxhd cookie value (665 bytes)** |

### 3.3.2 Key Findings

- First 12 fields **completely identical** to Collector PX12095
- Bundle extra 4 fields: PX key reference, pxhd type, flag, `_pxhd` cookie value
- All JSON keys are base64-encoded (regenerate every PX script load)
- `"t"` field is payload type identifier (base64, similar to Collector's `"PX12095"`)

## 3.4 `mh()` Main Constructor (main.js:4384)

The Bundle POST parameters are assembled by `mh(events, config)`. Full logic:

```js
function mh(events, config) {
    // 1. Inject runtime data for each event
    for (event of events) {
        event.d["MDRCNnZaQA0="] = kt;           // blockScript flag
        event.d["NSkHa3BHAl4="] = es();         // risk level (if present)
        event.d["U0shSRYgJX4="] = Xl();         // isAsync
        event.d["FCgmKlFDIRg="] = Bl();         // getRiskRules
        event.d["HwdtBVlsbj8="] = Ca();         // module type
        event.d["bRFfEyh/Xik="] = jo();         // isFirstParty
        event.d["HmYsZFsMKVU="] = cr("_px3");   // current _px3 cookie value
    }

    // 2. Compute cs and pc
    l = Ho();                                    // cs = qa (server OB-issued)
    h = jt(it(events), [uuid, tag, ft].join(":"));   // pc = HMAC-MD5(salt, JSON)

    // 3. Construct encrypted payload
    v = Jf(events, {vid, tag, appID, cu:uuid, cs:l, pc:h});

    // 4. Assemble POST param array
    p = [payload=v, appId, tag, uuid, ft, seq++, en="NTA", bi];
    if (cs) p.push("cs=" + l);
    if (pc) p.push("pc=" + h);
    p.push("sid=" + uuid + hh(ni()));            // sid + steganography
    p.push("vid=" + vid, "ci=" + ci, "pxhd=" + pxhd, "cts=" + cts, ...);
    p.push("rsc=" + (++Cm));

    return p;
}
```

### 3.4.1 How cs Is Computed → Server-issued

```
OB#1 response → atob → XOR(120) → split("~~~~")
   → segment[5] = III000 handler
      → qa = challenge_hash  (64 hex chars, SHA-256)

When mh() is called:
   l = Ho() → return qa
   p.push("cs=" + l)
```

⚠️ **cs is NOT client-computed**. If you see `cs=64hex`, don't try SHA-256 on your own — you can't.

### 3.4.2 pc Algorithm (HMAC-MD5 Variant, main.js:596)

```js
// jt(data, salt) — line 596
function jt(t, e) {
    n = R(t, e);   // = hex(HMAC-MD5(salt=e, data=t)), 32 hex chars

    // Per-character processing:
    //   digit (0-9, ascii 48-57) → retain into digits
    //   letter (a-f) → charCode % 10 appended to nums
    //     (a→7, b→8, c→9, d→0, e→1, f→2)
    // Concatenate: result = digits + nums
    // Stride pick: result[0] + result[2] + result[4] + ...
    return processed;   // ~16 chars
}

// Invocation: jt(it(events), "uuid:tag:ft")
// Bundle actual salt = "eb30dfdf-11c5-11f1-...:O2MKZn0OEhI/ag==:388"
```

⚠️ `it()` is PX custom JSON serialize, **not** `JSON.stringify` (gotcha #9). See [§11.4](#114-custom-json-serialize-it).

### 3.4.3 sid Steganography (main.js:4366)

```js
// hh(t): encode string as Unicode Tag Characters
function hh(t) {
    return t.split("").reduce((acc, ch) => {
        var hex = ch.codePointAt(0).toString(16).padStart(2, "0");
        return acc + unescape("%uDB40%uDC" + hex);   // U+E0000 series
    }, "");
}

// ni() returns no (the serverNo timestamp from OB#1)
// sid = uuid + hh(no)
//
// Empirically observed sid contains cts numeric encoding:
//   U+E0131='1', U+E0132='2', ..., U+E0139='9', U+E0130='0'
//
// Full example:
//   sid = "51338389-11b8-11f1-bb6d-13e608bfecce"
//       + U+E0131 U+E0137 U+E0137 U+E0131 U+E0139 U+E0136 U+E0137 U+E0137 U+E0132 U+E0138 U+E0134 U+E0133 U+E0134
//
//   Decoded: "1771967728434" — exactly the cts timestamp!
```

⚠️ Python `requests` drops Unicode Tag Chars by default. Use `urllib.parse.quote_plus(sid, safe='')` to explicitly encode (gotcha #E5).

## 3.5 OB#1 Response Decoding (13-Segment Full Parsing)

iFood measured Bundle#1 → OB#1 typically contains 13 segments. Full parse (using real captured data):

```
Raw response: {"do":null,"ob":"MUgxSEhIBBsNBgYGBkgxMTExSARMSUFJTkhBTU1O..."}
Decode: base64 → XOR(xorKey) → split("~~~~") → 13 segments
```

### 3.5.1 Segment 0: `I0I000|cc|cu`

```
→ handler: I0I000 (jf setter)
→ "cc" deferred marker → unshift to queue head for execution
→ jf = "cu"   (cu = continue press, awaiting captcha completion)
```

### 3.5.2 Segment 1: `0IIII0|41916095560041989364`

```
→ handler: 0IIII0 (fh function)
→ to = "41916095560041989364"
```

### 3.5.3 Segment 2: `0III0I0I|1771962830422`

```
→ handler: 0III0I0I (ch function)
→ no = "1771962830422"   (millisecond timestamp)
→ ro = 1771962830        (seconds, floor(no/1000))
```

### 3.5.4 Segment 3: `II00II|d6f03jmq8h6c7382req0`

```
→ handler: II00II
→ $a = "d6f03jmq8h6c7382req0"   (Bundle AppID)
```

### 3.5.5 Segment 4: `0III0I00|401`

```
→ handler: 0III0I00 (ah function)
→ ao = "401"   (status code string)
```

### 3.5.6 Segment 5: `III000|4481f3f71e53718b3e58d5ac1bc5cedf49ea4e0e4a8db4a2dfa2c81ea0d203bc`

```
→ handler: III000
→ qa = 64-char SHA-256   (this is the source of cs!)
```

### 3.5.7 Segment 6: `0II0III0|27|57|1|4|440be290d8e710ca5c9024316a6f6c25bb6fef14a42ec2eca1efdd04c53c2490`

```
→ handler: 0II0III0 (visual challenge params PX12634)
→ startWidth = 27
→ startHeight = 57
→ wJump = 1
→ hJump = 4
→ hash = SHA-256
```

### 3.5.8 Segment 7: `I0I0I0|1|ab317b680dfb5a3dc7c52a4fefedce5adb20cedd066ce5408ce6887aee9c|7bb57f904e7b938c8442e522a97d754d23a35964a1030857244c7d2c803a1169|16|false`

```
→ handler: I0I0I0 (main PoW path)
→ enabled = "1"
→ suffix = 60-char hex   (PoW prefix)
→ targetHash = 64-char SHA-256   (PoW target)
→ difficulty = "16"
→ isTrusted = "false"

⚠️ Parameter remap: handler(t,e,n,r,a) → Bs(n,e,r,a==="true")
   Actual call: Bs(targetHash, suffix, "16", false)
```

### 3.5.9 Segment 8: `0II0I0|1|8a213f60-11ba-11f1-a1d1-b7af17455ae4|8588|7bb57f904e7b938c8442e522a97d754d23a35964a1030857244c7d2c803a1169_?::<|1|`

```
→ handler: 0II0I0 (backup PoW path via qu)
→ uuid = "8a213f60-..."
→ port = "8588"
→ challengeData = "hash_encodedSuffix"
   ↓ encodedSuffix "?::<" XOR(10) = "5002"
→ Lu = uuid
```

> The main path (segment 7) is sufficient; segment 8 is backup. We use only segment 7 for PoW; segment 8 is ignored.

### 3.5.10 Segment 9: `IIIIII|cc|60|U2FtZVNpdGU9TGF4Ow==`

```
→ handler: IIIIII (Xr config)
→ ff = "cc"
→ ttl = 60
→ args = "U2FtZVNpdGU9TGF4Ow=="   (= base64 of "SameSite=Lax;")
→ "cc" marker → deferred execution
```

### 3.5.11 Segment 10: `IIIIII|rf|60|1`

```
→ ff = "rf"
→ ttl = 60
→ args = "1"
```

### 3.5.12 Segment 11: `IIIIII|fp|60|1`

```
→ ff = "fp"
→ ttl = 60
→ args = "1"
```

### 3.5.13 Segment 12: `II0III|ccc:0,ic:0,nf:0,ai:0`

```
→ handler: II0III (config parse)
→ ccc=0, ic=0, nf=0, ai=0
```

### 3.5.14 Global State After OB#1 Execution

```js
jf  = "cu"
to  = "41916095560041989364"
no  = "1771962830422"
ro  = 1771962830
ao  = "401"
qa  = "4481f3f71e53718b3e58d5ac1bc5cedf49ea4e0e4a8db4a2dfa2c81ea0d203bc"
$a  = "d6f03jmq8h6c7382req0"
Lu  = "8a213f60-11ba-11f1-a1d1-b7af17455ae4"
Mr  = {
    cc:  "U2FtZVNpdGU9TGF4Ow==",
    rf:  "1",
    fp:  "1",
    ccc: "0",
    ic:  "0",
    nf:  "0",
    ai:  "0"
}
PoW = {
    suffix:     "ab317b680dfb5a3dc7c52a4fefedce5adb20cedd066ce5408ce6887aee9c",
    target:     "7bb57f904e7b938c8442e522a97d754d23a35964a1030857244c7d2c803a1169",
    difficulty: 16,
    isTrusted:  false
}
visualChallenge = {
    startW: 27,
    startH: 57,
    wJump:  1,
    hJump:  4,
    hash:   "440be290d8e710ca5c9024316a6f6c25bb6fef14a42ec2eca1efdd04c53c2490"
}
```

---

# Part 4: Proof of Work Complete Reconstruction

## 4.1 PoW Formula

PoW verification:

```
sha256(prefix + (lastHexDigit + (counter >> 16)).toString(16) + (counter & 0xFFFF).toString(16).padStart(4,'0'))
  's first N hex chars equal targetHash's first N hex chars
```

Parameters:
- `suffix`: 60-char hex from OB#1
- `target`: 64-char SHA-256
- `difficulty`: bit count (default 16, corresponds to 4 hex chars)

Simplified (when difficulty=16, `counter >> 16 = 0`):

```
candidate = suffix + counter.toString(16).padStart(4, '0')
            ↓
sha256(candidate) === targetHash
```

Solving is brute-force enumeration `counter = 0..65535`.

## 4.2 Performance Analysis

| difficulty (bits) | Expected tries | Single-core SHA-256 speed | Expected duration |
|---|---|---|---|
| 8 bits | ~256 | ~3000 ns | ~1ms |
| 12 bits | ~4096 | ~3000 ns | ~12ms |
| **16 bits (measured)** | ~65536 | ~3000 ns | **~9-200ms** |
| 20 bits | ~1M | ~3000 ns | ~3s |

PX uses 16 bits = ~65536 iterations. Node `crypto.createHash` is ~200-500ns/call, measured **9-60ms**.

> That is, PoW is not really a "compute-power gate"; its main function is to **force the client to do one synchronous CPU work pass**, filtering out CPU-less botnets.

## 4.3 Critical Difference: Sync vs Async Implementation

⚠️ **One of the most lethal performance pitfalls in the Bundle path**:

```js
// ❌ Wrong (Node's Web Crypto API)
async function solvePow_BAD(suffix, target, diff) {
    let counter = 0;
    while (true) {
        const buf = new TextEncoder().encode(suffix + counter.toString(16));
        const hashBuf = await crypto.subtle.digest('SHA-256', buf);   // ⭐ each await
        const hex = bufToHex(hashBuf);
        if (hex.startsWith(target.slice(0, diff/4))) return counter.toString(16);
        counter++;
    }
}
// Measured: each await switches event loop +~10ms overhead
// 65536 iterations = 655s = 11 minutes → PX session times out long before
```

```js
// ✅ Right (Node sync crypto)
function solvePow_GOOD(suffix, target, diff) {
    const targetPrefix = target.slice(0, diff / 4);
    let counter = 0;
    while (true) {
        const hex = crypto.createHash('sha256').update(suffix + counter.toString(16)).digest('hex');
        if (hex.startsWith(targetPrefix)) return counter.toString(16);
        counter++;
    }
}
// Measured: 9-60ms
```

If you must use the browser's `crypto.subtle` (e.g., userscript scenario), batch:

```js
// Browser-optimized version: schedule 1000 per batch
async function solvePow_browser_batch(suffix, target, diff) {
    const targetPrefix = target.slice(0, diff / 4);
    let counter = 0;
    while (true) {
        const promises = [];
        for (let i = 0; i < 1000; i++) {
            const buf = new TextEncoder().encode(suffix + (counter + i).toString(16));
            promises.push(crypto.subtle.digest('SHA-256', buf));
        }
        const hashes = await Promise.all(promises);
        for (let i = 0; i < hashes.length; i++) {
            const hex = bufToHex(hashes[i]);
            if (hex.startsWith(targetPrefix)) return (counter + i).toString(16);
        }
        counter += 1000;
    }
}
// Browser measured: ~200-500ms
```

## 4.4 Two PoW Paths Comparison (I0I0I0 vs 0II0I0)

OB#1 simultaneously issues two PoW handlers:

| Dimension | `I0I0I0` (seg 7) | `0II0I0` (seg 8) |
|---|---|---|
| Handler key | `I0I0I0` | `0II0I0` |
| Invocation | Directly call `PX1135 = Bs` | `qu() → os() → PX762 = Bs` |
| Parameter source | Directly passed via segment fields | challengeData XOR(10) decoded |
| Callback setup | None | `PX763=ds, PX1078=rs, PX1200=ts, PX1145=zu` |
| Main path? | ✓ **Main path** | Backup/supplement |

**When writing a generator, use only the `I0I0I0` main path** — simple and reliable. `0II0I0` is PX's double-insurance (against captcha.js not having fully loaded).

## 4.5 Full Bs Function (captcha.js:7411)

```js
function Bs(r, n, t) {
    // r = targetHash (64-char SHA-256)
    // n = suffix (60-char hex)
    // t = difficulty (string, +"16" → 16)
    // arguments[3] = isTrusted (boolean, optional)

    var m = Math.ceil(+t / 4);              // hex digits = 4
    var o = "0".repeat(m);                  // "0000"
    var D = (1 << 4 * m) - 1;               // mask = 65535
    var i = parseInt("0x" + n.charAt(n.length - 1), 16);  // suffix last hex char
    var c = n.slice(0, -1);                 // suffix minus last char
    var z = 1 << +t;                        // maxCounter = 65536

    // Web Worker path (browser)
    if (typeof Worker !== 'undefined' && !arguments[3]) {
        var worker = Ks();   // Create Blob URL Worker
        // Worker runs ws(0, z, D, o, m, i, c, r, startTime)
        // After finding, calls Ts(answer, elapsed) to store
        // Then calls PX763(ds) callback
    }
    // setTimeout path (degradation)
    else {
        for (var counter = 0; counter < z; counter++) {
            var result = poi(counter, D, o, m, i, c, 0, r);
            if (result) {
                Ts(result, Date.now() - startTime);
                // PX763 callback
                return;
            }
        }
    }
}
```

## 4.6 `poi()` Function (captcha.js:7165-7170)

```js
function poi(r, n, u, t, v, e, f, s) {
    // r = counter          n = mask (65535)
    // u = padding ("0000") t = hex digits (4)
    // v = lastHexDigit     e = prefix
    // f = unused (0)       s = targetHash

    var m = (u + (r & n).toString(16)).slice(-t);
    //     = ("0000" + (counter & 65535).toString(16)).slice(-4)
    //     = lower 4 hex digits of counter

    var o = e + (v + (r >> (t << 2))).toString(16) + m;
    //     = prefix + (lastHex + (counter >> 16)).toString(16) + lowPart
    //     when difficulty=16 counter >> 16 = 0, so = prefix + lastHex + lowPart
    //     i.e., suffix + counter's 4-hex

    if (sha256(o) === s) return o;   // found → return
}
```

## 4.7 Simplified Understanding (difficulty=16)

```
For difficulty=16, counter < 65536:
  counter >> 16 = 0 (always 0)
  candidate = prefix + lastHexDigit.toString(16) + hex(counter, 4 digits)
            = suffix + hex(counter).padStart(4, '0')

Essentially:
  for counter in 0..65535:
    if sha256(suffix + counter_hex_4digits) === targetHash:
      return suffix + counter_hex_4digits
```

## 4.8 Node.js Production Implementation

```js
const crypto = require('crypto');

function sha256(data) {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Solve PX Proof of Work.
 *
 * @param {string} targetHash - 64 hex chars
 * @param {string} suffix - hex string from OB#1
 * @param {number|string} difficulty - default 16
 * @returns {{answer, counter, elapsed}}
 */
function solvePow(targetHash, suffix, difficulty = 16) {
    difficulty = +difficulty || 16;
    const m = Math.ceil(difficulty / 4);
    const padding = '0'.repeat(m);
    const mask = (1 << (4 * m)) - 1;
    const lastHexDigit = parseInt('0x' + suffix.charAt(suffix.length - 1), 16);
    const prefix = suffix.slice(0, -1);
    const maxCounter = 1 << difficulty;
    const start = Date.now();

    for (let r = 0; r < maxCounter; r++) {
        const lowPart = (padding + (r & mask).toString(16)).slice(-m);
        const candidate = prefix + (lastHexDigit + (r >> (m << 2))).toString(16) + lowPart;
        if (sha256(candidate) === targetHash) {
            return { answer: candidate, counter: r, elapsed: Date.now() - start };
        }
    }
    return null;
}

module.exports = solvePow;
```

## 4.9 Validation Example (Real Captured Data)

```
Input:
  suffix     = "ab317b680dfb5a3dc7c52a4fefedce5adb20cedd066ce5408ce6887aee9c"
  targetHash = "7bb57f904e7b938c8442e522a97d754d23a35964a1030857244c7d2c803a1169"
  difficulty = 16

Output:
  answer  = "ab317b680dfb5a3dc7c52a4fefedce5adb20cedd066ce5408ce6887aee9c24da"
  counter = 9434   (0x24da)
  elapsed = 9ms

Verify: sha256(answer) === targetHash ✓
```

## 4.10 Web Worker Path (Browser)

```js
// Ks(): create Blob URL Web Worker
function Ks() {
    var code = [sha256_source, poi_source, ws_source].join('\n');
    var blob = new Blob([code], {type: 'application/javascript'});
    return new Worker(URL.createObjectURL(blob));
}

// ws(): Worker loop
function ws(start, end, mask, padding, m, lastHex, prefix, targetHash, startTime) {
    for (var i = start; i < end; i++) {
        var result = poi(i, mask, padding, m, lastHex, prefix, 0, targetHash);
        if (result) {
            postMessage({answer: result, elapsed: Date.now() - startTime});
            return;
        }
    }
}
```

Web Worker computes **off the browser's main thread**, not blocking UI. `Bs` listens for Worker messages → receives the answer → `Ts(answer, elapsed)` stores → `PX763(ds)` callback.

## 4.11 Injection Position of the PoW Answer

The PoW counter (answer) is injected into Bundle#2:

```js
// Field in the Bundle#2 EV array
{
    // ... 220+ regular fields
    'AbCdEfGhIjK=': counter,        // PoW answer hex (cross-version b64 key changes)
    'XyZwUvTsR=':  pow.suffix,      // suffix echo
    'Slt5EA85fiI=': wasmA,          // WASM a() output (= PX12590)
    'MD1DNnVfRgQ=': wasmB,          // WASM b() output (= PX12610/PX12573)
    // ...
}
```

⚠️ Specific b64 keys change across versions. On each upgrade run `find_state_keys.py` or similar to do cross-batch value matching.

## 4.12 PoW Cache Trap (Production Deployment)

⚠️ **Production trap**: caching PoW answers:

```js
// ❌ Wrong (leaks across sessions)
const powCache = new Map();
function cachedSolvePow(suffix, target) {
    const key = suffix + ':' + target;
    if (powCache.has(key)) return powCache.get(key);
    const ans = solvePow(suffix, target);
    powCache.set(key, ans);
    return ans;
}
```

Problem: PX backend has a finite challenge pool; `(suffix, target)` **can repeat across sessions**. But PX backend **validates the answer per session UUID**:
1. Session A: cache stores answer X
2. Session B: (suffix, target) repeats, cache returns X
3. PX sees hash(uuid_B + X) doesn't match → rejection

**Fix**:

```js
// ✅ Bin by session
function cachedSolvePow(suffix, target, sessionUuid) {
    const key = sessionUuid + ':' + suffix + ':' + target;
    if (powCache.has(key)) return powCache.get(key);
    const ans = solvePow(suffix, target);
    powCache.set(key, ans);
    return ans;
}

function endSession(sessionUuid) {
    for (const k of powCache.keys()) {
        if (k.startsWith(sessionUuid + ':')) powCache.delete(k);
    }
}
```

**Simplest**: < 1000 sessions/day → don't cache at all (PoW takes only 9ms).

## 4.13 captcha.js Key PoW Function Index

| Function | Line | Functionality | Call relationship |
|---|---|---|---|
| `sha256()` | ~7000-7164 | Pure JS SHA-256 implementation | Used inside `poi()` |
| `poi()` | 7165-7170 | Single PoW attempt | Called by `Bs`/`ws` |
| `ws()` | 7171-7175 | Web Worker loop | Runs inside Worker |
| `Ks()` | 7176-7219 | Create Web Worker | Called by `Bs` |
| `Ts()` | 7406-7410 | Store PoW result | `Es=answer, Js=elapsed` |
| **`Bs()`** | **7411-7524** | **Complete PoW solver** | `PX1135/PX762` entry |

⚠️ **`PX1135 === PX762 === Bs`**: same function; PX registered two names. Verify:

```js
const h = window._O1GDTa7Qhandler;
Object.keys(h);                    // → ["PX762", "PX12634", "PX1135"]
h.PX1135 === h.PX762;             // → true
h.PX1135.toString();              // → "function Bs(r,n,t){..."
```

---

# Part 5: WebAssembly Integration

## 5.1 WASM Source and Extraction

PX's WASM is called `px_captcha.wasm`, about 60,862 bytes, **embedded in the [10]-th element of the return array of `Us()` in `captcha.js`**:

```js
// captcha.js (simplified)
function Us() {
    return [
        "...",   // [0-9] other entries (base64 strings, config, etc.)
        "AGFzbQEAAAABZRJgAn9/AGADf39/AGAFf39/f38..."   // [10] = WASM base64
    ];
}
```

WASM standard magic bytes: `\0asm 0x01 0x00 0x00 0x00` = `0x00 0x61 0x73 0x6D 0x01 0x00 0x00 0x00`.

### 5.1.1 Extraction Script (Simple Version)

```js
const fs = require('fs');
const captchaJs = fs.readFileSync('captcha.js', 'utf8');

// Find Us()[10] or similar large base64 string (containing "AGFzbQ" prefix = \0asm magic)
const m = captchaJs.match(/"(AGFzbQ[A-Za-z0-9+/=]{50000,})"/);
if (!m) throw new Error('WASM base64 not found');

const wasmBytes = Buffer.from(m[1], 'base64');
fs.writeFileSync('px_captcha.wasm', wasmBytes);
console.log(`WASM: ${wasmBytes.length} bytes, magic ${wasmBytes.slice(0, 4).toString('hex')}`);
// Expected: WASM: ~60862 bytes, magic 0061736d
```

### 5.1.2 10 Decode Paths (If base64 Insufficient)

The WASM string inside captcha.js is sometimes not standard base64; try the following decode paths:

| # | Path | Decode method |
|---|---|---|
| 1 | `ksXWzSIG` | Custom base64 (lowercase-first alphabet) + URI decode |
| 2 | `ksXWzSIG` → `atob` | Custom base64 → standard atob |
| 3 | `ksXWzSIG` → `u()` | Custom base64 → XOR("zSLyhtf") |
| 4 | Standard `atob` | Standard base64 |
| 5 | `u()` | atob + XOR |
| 6 | `u()` → `atob` | XOR → atob |
| 7 | `ksXWzSIG` → `u()` → `atob` | Three-step chain |
| 8 | Standard b64 alphabet + URI decode | Add URI step |
| 9 | Custom b64 (no URI step) | Custom alphabet |
| 10 | Standard `atob` (no URI step) | Direct atob |

Success criterion: **first 4 bytes = `\0asm` magic** (`00 61 73 6d`).

### 5.1.3 Custom base64 Alphabet

```
Standard: ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=
PX:       abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=
          ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
          Lowercase letters first (standard has uppercase first)
```

Conversion: swap upper/lower case in every character; then use standard atob.

## 5.2 Two Exported Functions a() and b()

The WASM module exports **two core functions**:

| Function | Signature | Return value | Purpose |
|---|---|---|---|
| **`a()`** | `() -> string` | 64-hex string | "fingerprint init" — **different on each call** (uses `globalThis._pxUuid` + internal randomness) |
| **`b(input)`** | `(string) -> string` | 127-char custom-encoded string | "fingerprint transform" — **same input returns same output** (deterministic ChaCha20) |

Invocation pattern:

```js
// 1. Call a() first for initial fingerprint
const aResult = wasmExports.a();
console.log(aResult);
// Output: "abc123def456...0987" (64 hex)
// Inject into Bundle#3 PX561 field Slt5EA85fiI= (PX12590)

// 2. Use PoW answer as b()'s input
const bResult = wasmExports.b(powAnswer);
console.log(bResult);
// Output: "$5G@h!9*X3#k...0-1" (127 chars custom alphabet)
// Inject into Bundle#3 PX561 field MD1DNnVfRgQ= (PX12610/PX12573)
```

### 5.2.1 a() Internal Logic (Inferred)

```
a():
    timestamp = current_ms()
    uuid = window._pxUuid     ← must exist
    random = crypto.getRandomValues(32 bytes)
    seed = SHA256(uuid + timestamp + random)
    return seed.toHex()       ← 64 hex chars
```

Each call returns different (contains true randomness), but the server validates hash(uuid + a_output) consistency against other fields.

### 5.2.2 b() Internal Logic (Inferred)

```
b(input):
    seed = constant_from_wasm_data_section()   ← 32 bytes, version-specific
    nonce = input_first_12_bytes
    keystream = ChaCha20(seed, nonce, counter=0)
    out_bytes = input XOR keystream
    out_string = encode_custom_alphabet(out_bytes)   ← not base64!
    return out_string
```

Same input returns same output (deterministic).

## 5.3 34 wbg Imports

PX's WASM is wasm-bindgen-generated Rust; imports are under the `wbg` namespace. Full 34 (with hash suffixes that change per build):

### 5.3.1 String Operations

| Import | Meaning |
|---|---|
| `__wbindgen_string_new(ptr, len)` | UTF-8 → JS string |
| `__wbindgen_string_get(retptr, idx)` | JS string → WASM memory |

### 5.3.2 Object Operations

| Import | Meaning |
|---|---|
| `__wbg_get_e6ae480a4b8df368(objIdx, keyPtr, keyLen)` | `obj[key]` |
| `__wbindgen_object_drop_ref(idx)` | Release reference |
| `__wbg_set_17499e8aa4003ebd(arrIdx, srcIdx, offset)` | Array assignment |

### 5.3.3 Environment Detection

| Import | Meaning | Node mock required |
|---|---|---|
| **`__wbg_instanceof_Window_e266f02eee43b570(idx)`** | Judge Window | **Return 1** (gotcha #B2) |
| `__wbg_crypto_c48a774b022d20ac(idx)` | crypto object | Return mockCrypto |
| `__wbg_require_8f08ceecec0f4fee()` | Node.js require | Return noop |

### 5.3.4 Random Numbers

| Import | Meaning |
|---|---|
| `__wbg_getRandomValues_37fa2ca9e4e07fab(cryptoIdx, arrIdx)` | crypto.getRandomValues |
| `__wbg_randomFillSync_dc1e9a60c158336d(cryptoIdx, arrIdx)` | crypto.randomFillSync |

### 5.3.5 Function Calls

| Import | Meaning |
|---|---|
| `__wbg_newnoargs_2b8b6bd7753c76ba(ptr, len)` | `new Function(code)` |
| `__wbg_call_95d1ea488d03e4e8(fnIdx, thisIdx)` | `fn.call(this)` |
| `__wbg_call_9495de66fdbe016b(fnIdx, thisIdx, arg)` | `fn.call(this, arg)` |

### 5.3.6 Global Objects

| Import | Meaning |
|---|---|
| `__wbg_self_e7c1f827057f6584()` | `self` |
| `__wbg_window_a09ec664e14b1b81()` | `window` |
| `__wbg_globalThis_87cbb8506fecf3a9()` | `globalThis` |

### 5.3.7 TypedArray

| Import | Meaning |
|---|---|
| `__wbg_buffer_cf65c07de34b9a08(idx)` | `ArrayBuffer` |
| `__wbg_newwithbyteoffsetandlength_9fb2f11355ecadf5(bufIdx, offset, len)` | `new Uint8Array(buf, offset, len)` |
| `__wbg_new_537b7341ce90bb31(bufIdx)` | `new Uint8Array(buf)` |
| `__wbg_set_17499e8aa4003ebd(arrIdx, srcIdx, offset)` | `Uint8Array.set` |

### 5.3.8 Time + Console

| Import | Meaning |
|---|---|
| `__wbg_now_e0d8ec93dd25766a` | `Date.now()` |
| `__wbg_performance_3298b1cc5dffe537()` | `performance` |
| `__wbg_log` / `__wbg_warn` / `__wbg_error` | Console output (noop) |

### 5.3.9 Memory

| Import | Meaning |
|---|---|
| `__wbindgen_memory()` | WASM memory |
| `__wbindgen_throw(ptr, len)` | Throw error |
| `__wbindgen_externref_xform__` | Reference transform |

### 5.3.10 Full Imports Reference

The specific hash suffix of each import **changes per build**. Extract method:

```bash
# Use wabt tool
wabt-objdump -j Import px_captcha.wasm

# Output (excerpt):
# - func[0] sig=2 <wbg.__wbg_get_e6ae480a4b8df368>
# - func[1] sig=0 <wbg.__wbg_instanceof_Window_e266f02eee43b570>
# - func[2] sig=1 <wbg.__wbg_crypto_c48a774b022d20ac>
# ... etc
```

Cross-version, hashes change → import names change → mock dictionary keys must update.

## 5.4 Minimal Mock to Run WASM in Node.js

Below is the minimal imports (8 critical ones) to run the PX WASM in Node:

```js
const fs = require('fs');

async function loadPxWasm(wasmPath, uuid) {
    // ⭐⭐⭐ Step 1: Set _pxUuid BEFORE instantiate (gotcha #B1)
    globalThis._pxUuid = uuid;

    // Step 2: Mock browser environment
    const mockWindow = { _pxUuid: uuid };
    const mockDocument = {
        cookie: '',
        title: 'iFood',
        URL: 'https://www.ifood.com.br/'
    };
    const mockNavigator = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        language: 'pt-BR',
        languages: ['pt-BR', 'pt', 'en'],
        platform: 'Win32',
        cookieEnabled: true,
        hardwareConcurrency: 8,
        deviceMemory: 8,
    };
    const mockScreen = {
        width: 1920, height: 1080,
        availWidth: 1920, availHeight: 1040,
        colorDepth: 24, pixelDepth: 24,
    };

    // Step 3: Key imports
    const imports = {
        wbg: {
            // Type judgment — must return 1 (gotcha #B2)
            __wbg_instanceof_Window: () => 1,
            __wbg_instanceof_Document: () => 1,
            __wbg_instanceof_HTMLElement: () => 1,

            // Global object returns
            __wbg_window: () => mockWindow,
            __wbg_document: () => mockDocument,
            __wbg_navigator: () => mockNavigator,
            __wbg_screen: () => mockScreen,
            __wbg_self: () => globalThis,
            __wbg_globalThis: () => globalThis,

            // Property read/write (Reflect universal)
            __wbg_get: (target, key) => Reflect.get(target, key),
            __wbg_set: (target, key, value) => { Reflect.set(target, key, value); return true; },

            // Time
            __wbg_now: () => Date.now(),
            __wbg_performance: () => ({ now: () => performance.now() }),

            // Random
            __wbg_random: () => Math.random(),
            __wbg_getRandomValues: (cryptoObj, buf) => {
                require('crypto').randomFillSync(buf);
                return buf;
            },
            __wbg_randomFillSync: (cryptoObj, buf) => {
                require('crypto').randomFillSync(buf);
            },

            // Console no-op
            __wbg_log: () => {}, __wbg_warn: () => {}, __wbg_error: () => {},
        },
        __wbindgen_placeholder__: {
            __wbindgen_string_new: (ptr, len) => { /* wasm-bindgen built-in bridge */ },
            __wbindgen_string_get: (ret, idx) => { /* same */ },
            __wbindgen_throw: (ptr, len) => { throw new Error('wasm throw'); },
            __wbindgen_object_drop_ref: (idx) => {},
            __wbindgen_object_clone_ref: (idx) => idx,
            __wbindgen_memory: () => instance.exports.memory,
            // ... other __wbindgen_* required entries
        }
    };

    const wasmBytes = fs.readFileSync(wasmPath);
    const { instance } = await WebAssembly.instantiate(wasmBytes, imports);
    return instance.exports;
}

// Usage
(async () => {
    const exports = await loadPxWasm('px_captcha.wasm', uuid);
    const a = exports.a();
    const b = exports.b(powAnswer);
    console.log({ a, b });
})();
```

## 5.5 Full wasm-bindgen Bridge Implementation

Since wasm-bindgen has a standard string-passing protocol, the full bridge is more than the mock above:

```js
let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
let cachedTextEncoder = new TextEncoder('utf-8');
let cachedUint8Memory = null;
let cachedInt32Memory = null;
let wasmExports = null;

function getUint8Memory() {
    if (cachedUint8Memory === null || cachedUint8Memory.buffer !== wasmExports.memory.buffer) {
        cachedUint8Memory = new Uint8Array(wasmExports.memory.buffer);
    }
    return cachedUint8Memory;
}

function getInt32Memory() {
    if (cachedInt32Memory === null || cachedInt32Memory.buffer !== wasmExports.memory.buffer) {
        cachedInt32Memory = new Int32Array(wasmExports.memory.buffer);
    }
    return cachedInt32Memory;
}

function passStringToWasm(s) {
    const buf = cachedTextEncoder.encode(s);
    const ptr = wasmExports.__wbindgen_malloc(buf.length);
    getUint8Memory().set(buf, ptr);
    WASM_VECTOR_LEN = buf.length;
    return ptr;
}

function getStringFromWasm(ptr, len) {
    return cachedTextDecoder.decode(getUint8Memory().subarray(ptr, ptr + len));
}

// a() invocation
function wasmA() {
    const retptr = wasmExports.__wbindgen_add_to_stack_pointer(-16);
    try {
        wasmExports.a(retptr);
        const r0 = getInt32Memory()[retptr / 4 + 0];
        const r1 = getInt32Memory()[retptr / 4 + 1];
        const s = getStringFromWasm(r0, r1);
        wasmExports.__wbindgen_free(r0, r1);
        return s;
    } finally {
        wasmExports.__wbindgen_add_to_stack_pointer(16);
    }
}

// b(input) invocation
function wasmB(input) {
    const retptr = wasmExports.__wbindgen_add_to_stack_pointer(-16);
    try {
        const ptr0 = passStringToWasm(input);
        const len0 = WASM_VECTOR_LEN;
        wasmExports.b(retptr, ptr0, len0);
        const r0 = getInt32Memory()[retptr / 4 + 0];
        const r1 = getInt32Memory()[retptr / 4 + 1];
        const s = getStringFromWasm(r0, r1);
        wasmExports.__wbindgen_free(r0, r1);
        return s;
    } finally {
        wasmExports.__wbindgen_add_to_stack_pointer(16);
    }
}
```

The complete `run_wasm.js` template is in §5 (raw materials merged into this document).

## 5.6 Internal ChaCha20 Implementation

The core algorithm of `b(input)` is the **ChaCha20 stream cipher** (variant):

```
b(input):
    seed = constant_from_wasm_data_section()    // 32 bytes, version-specific
    nonce = input_first_12_bytes
    keystream = ChaCha20(seed, nonce, counter=0)
    out_bytes = input XOR keystream
    out_string = encode_custom_alphabet(out_bytes)   // not base64!
    return out_string
```

**ChaCha20 seed** is embedded in the WASM `.data` segment; PX regenerates per build. Extract method:

```bash
# Using wabt
wabt-objdump -j data px_captcha.wasm | head -20

# Output (excerpt):
# - segment[0] memory=0 size=32 offset=0 align=0
#   - init i32=1024
#   - data: 6A 09 E6 67 BB 67 AE 85 3C 6E F3 72 A5 4F F5 3A 51 0E 52 7F 9B 05 68 8C 1F 83 D9 AB 5B E0 CD 19
# ↑ These 32 bytes are the suspected ChaCha20 seed
```

Cross-version, the seed must change — **if your b() output doesn't match real captures, suspect the seed first**.

## 5.7 b()'s Custom Encoding (Not base64)

⚠️ The 127-char string returned by `b()` **looks like base64 but isn't**. Alphabet:

```
/=+!1@2#3$4%5^6&7*8(9)0-
```

Differences from standard base64:
- No letters (standard base64 64 chars = 26 uppercase + 26 lowercase + 10 digits + 2 symbols)
- Uses `!@#$%^&*()-` which are shell special characters

**Critical trap**: treating b()'s output as base64 → decoded garbage or exceptions. **Fill the literal string as-is** into Bundle#3's PX561 event `MD1DNnVfRgQ=` field:

```js
ev3['MD1DNnVfRgQ='] = wasmExports.b(powAnswer);   // raw, no decode
```

## 5.8 WASM's Dependency on _pxUuid

⚠️ **WASM `b()` strongly depends on `globalThis._pxUuid`** (gotcha #B1):

```js
// b() internal (inferred)
function b(input) {
    const pxUuid = window._pxUuid;  // ← read via __wbg_get(window, "_pxUuid")
    if (!pxUuid) {
        return "";   // No uuid → return empty
    }
    // ... ChaCha20 transformation
}
```

**Fix**: set BEFORE `WebAssembly.instantiate`:

```js
globalThis._pxUuid = uuid;
const { instance } = await WebAssembly.instantiate(wasmBytes, imports);
```

If set after instantiate, since WASM instantiation does some initialization (possibly reading _pxUuid into a cache), it may still fail. **The safe approach is to set before instantiate**.

## 5.9 instanceof_Window Must Return 1

⚠️ **The second WASM mandatory mock** (gotcha #B2):

```js
// Somewhere inside WASM:
if (!__wbg_instanceof_Window(window_obj)) {
    return error;   // wrong path
}
```

In Node's default environment, WASM doesn't see a "Window" class; `instanceof` returns 0 → wrong path → a()/b() return empty or panic.

**Fix**: mock returning 1:

```js
imports.wbg.__wbg_instanceof_Window_<hash> = () => 1;
```

Similarly `__wbg_instanceof_Document` and `__wbg_instanceof_HTMLElement` also return 1.

## 5.10 WASM Constants Vary per Version/Customer (Important)

⚠️ All "magic constants" embedded in WASM change per build:

| Constant | Size | Cross-version change |
|---|---|---|
| ChaCha20 seed | 32 bytes | Changes every build |
| HMAC keys | 16-32 bytes | Occasionally |
| Custom encoding alphabet | 24 chars | Half-yearly |
| Validation constants | 32 bytes | Occasionally |

Detection SOP:

```bash
# 1. Capture new captcha.js
curl -o captcha_new.js https://client.px-cloud.net/PXO1GDTa7Q/captcha.js

# 2. Extract WASM
node extract_wasm.js captcha_new.js

# 3. Compare SHA with old
sha256sum px_captcha.wasm
# Compare against stample/bundle/source/SDK_INFO.md

# 4. Changed? Dump data segments and compare
wasm-objdump -j data px_captcha.wasm > new_data.txt
diff old_data.txt new_data.txt

# 5. Test b() output
node test_wasm_b.js   # compare against real-capture sample
```

See [§16 SDK Drift Response](#part-16-sdk-drift-response) and gotcha #B3.

---

# Part 6: Bundle#2 Complete Reverse

## 6.1 Request Construction

Bundle#2 is the core POST of the press challenge. It carries:

```
seq=1 (but iFood measured seq=3, because the internal ph counter is already 1 at init)
rsc=2

payload = encrypted EV array (228 fields)
PC = generatePC(events, uuid, TAG, 388)
cs = state.qa (from OB#1)
ci = challenge ID (generated at captcha.js registration)
sid = state.pxsid + hh(state.no) + hh(cts)   ⭐ contains Unicode Tag steganography
vid = state.vid
cts = ms timestamp (**type changed**!)
```

Full form-encoded body:

```
payload=<base64+Jf>&appId=PXO1GDTa7Q&tag=<tag>&uuid=<uuid>&ft=388&seq=3&en=NTA&bi=<bi>&cs=<64hex>&pc=<16digit>&sid=<pxsid+hh>&vid=<vid>&ci=<ci_uuid>&cts=1771967728434&rsc=2
```

## 6.2 Bundle#2 vs Bundle#1 Parameter Differences

| Parameter | Bundle#1 | Bundle#2 | Notes |
|---|---|---|---|
| `payload` | 16 fields, ~1 KB | **228+ fields, ~7.5 KB** | Full browser fingerprint |
| `seq` | 0 | **3** (measured, iFood) | `ph` incremented |
| `rsc` | 1 | **2** | Incremented |
| `cts` | UUID format | **ms timestamp** | Switched after OB#2 (not OB#1) |
| `cs` | None | **64 hex** | Challenge hash from OB#1 `qa` |
| `ci` | None | **UUID** | Challenge instance ID |
| `sid` | Plain UUID | UUID + **steganographed digits (each digit of cts)** | Unicode Tag Chars |

## 6.3 Payload 228-Field Three-Class Classification

Bundle#2 in one session sends ~228 fields (±5 variation across sessions). Three-class taxonomy:

| Class | Count | Meaning | Handling |
|---|---|---|---|
| **STATIC** | ~160 (70%) | Same value across 6 capture batches (browser fingerprint constants) | Copy template directly |
| **DYNAMIC** | ~50 (22%) | Changes per call (timestamps, UUID, HMAC, counters) | Algorithmic generation |
| **CONDITIONAL** | ~18 (8%) | Present in some batches (warm-visit fields) | Optional |

Full 228-field classification in 17 categories: see [Part 10](#part-10-complete-229-field-classification).

Generation strategy: **Template Approach** — use a real-capture Bundle#2 as template, only override DYNAMIC fields:

```js
function buildBundle2(ctx) {
    const ev = JSON.parse(JSON.stringify(TEMPLATE));
    const d = ev[0].d;

    // ~20 DYNAMIC fields
    d[K.uuid]          = ctx.uuid;
    d[K.initTime]      = ctx.initTime;
    d[K.sendTime]      = Date.now();
    d[K.dateString]    = new Date().toString();
    d[K.perfNow]       = performance.now();
    d[K.uaHmac]        = hmacMD5(ctx.uuid, ctx.ua);
    d[K.memUsed]       = randIntInRange(30_000_000, 80_000_000);
    d[K.memTotal]      = randIntInRange(35_000_000, 95_000_000);
    d[K.bundleAppId]   = ctx.state.appId;       // ⭐ Bundle AppID injected
    d[K.serverNo]      = parseInt(ctx.state.no); // ⭐ must parseInt
    d[K.serverTo]      = ctx.state.to;
    d[K.powCounter]    = ctx.powAnswer;          // ⭐ PoW injected
    d[K.wasmA]         = ctx.wasmA;              // ⭐ WASM a injected
    d[K.wasmB]         = ctx.wasmB;              // ⭐ WASM b injected
    // ...

    ev[0].d = relocateAntiTamper(d, ctx.state);
    return ev;
}
```

## 6.4 Key Fields (state.*, WASM, PoW Injection Points)

The following 14 fields are where Bundle#2 most differs from Collector:

| Field (meaning) | Source | Type |
|---|---|---|
| **PoW counter** | `pow.counter.toString(16)` | string |
| **PoW suffix echo** | `state.pow.suffix` | string |
| **WASM a output (PX12590)** | `wasm.a()` | string (64 hex) |
| **WASM b output (PX12610)** | `wasm.b(counter)` | string (127 chars) |
| **state.no (serverNo)** | **`parseInt(state.no)`** ⭐ | number |
| **state.appId (Bundle AppID)** | `state.appId` | string |
| **state.to** | `state.to` | string |
| **state.qa** | `state.qa` | string |
| **state.pxsid** | `state.pxsid` | string |
| **state.cts** | `state.cts` | string |
| **uuid (restated)** | `ctx.uuid` | string |
| **initTime / sendTime** | `Date.now()` | number |
| **anti-tamper key/val** | `te(state.to, state.no%10±1)` | string |
| **uaHmac** | `hmacMD5(uuid, ua)` | string (32 hex) |

⚠️ The b64 keys for these 14 fields must change across versions; **never hardcode**. On each upgrade run `find_state_keys.py` for cross-6-batch value matching.

## 6.5 Full sid Steganography Confirmation (Including cts Digits)

Bundle#2's sid is more complex than Bundle#1's:

```
Bundle#1 sid: <uuid>
              Plain UUID

Bundle#2 sid: <uuid> + <Unicode Tag Chars encoding each digit of cts timestamp>
              UUID + steganography

Example:
  uuid = "51338389-11b8-11f1-bb6d-13e608bfecce"
  cts  = "1771967728434"
  sid  = "51338389-11b8-11f1-bb6d-13e608bfecce" + Tag('1') + Tag('7') + Tag('7') + Tag('1') + Tag('9') + Tag('6') + Tag('7') + Tag('7') + Tag('2') + Tag('8') + Tag('4') + Tag('3') + Tag('4')

Unicode Tag Char mapping:
  Tag('0') = U+E0130
  Tag('1') = U+E0131
  Tag('2') = U+E0132
  ...
  Tag('9') = U+E0139
```

Construction code:

```js
function buildSidBundle2(uuid, cts) {
    let sid = uuid;
    for (const digit of cts) {
        const codePoint = 0xE0130 + parseInt(digit);   // U+E0130 + digit
        sid += String.fromCodePoint(codePoint);
    }
    return sid;
}
```

⚠️ Python `requests` cannot use `unquote_plus` on sid; it drops Unicode Tags. Use `urllib.parse.quote_plus(sid, safe='')`.

## 6.6 Full Anti-Tamper Field Handling

```js
const AT_RE = /^[0-9:;<=>?@]{15,25}$/;

function te(input, key) {
    let out = '';
    for (let i = 0; i < input.length; i++) {
        out += String.fromCharCode(input.charCodeAt(i) ^ key);
    }
    return out;
}

function relocateAntiTamper(d, state) {
    const k1 = parseInt(state.no) % 10 + 1;   // ⭐ state.no must parseInt
    const k2 = parseInt(state.no) % 10 + 2;
    const atKey = te(state.to, k2);
    const atVal = te(state.to, k1);

    // ⭐ Preserve position! Don't delete + add (gotcha #17)
    const out = {};
    for (const k of Object.keys(d)) {
        if (AT_RE.test(k) && AT_RE.test(String(d[k]))) {
            out[atKey] = atVal;
        } else {
            out[k] = d[k];
        }
    }
    return out;
}
```

⚠️ `state.to` is a numeric string (e.g. `"13468925768457352646"`, 19-20 digits). Each character is ASCII `'0'-'9'` (0x30-0x39). After XOR 1-12 the result falls in 0x30-0x3F = `"0123456789:;<=>?"`. So the AT regex must include `:` and `;` (gotcha #18).

## 6.7 OB#2 Response: First _px3

After Bundle#2 succeeds, OB#2 typically contains **only 2 segments**:

```
Segment 0: III0II|_px3|330|<value>|true|300
  → handler: oh() — set _px3 cookie
  → name = "_px3"
  → ttl = 330 seconds
  → value = encrypted cookie value (very long)
  → secure = "true"
  → maxAge = 300

Segment 1: I0I000|cu
  → handler: jf setter
  → jf = "cu"  (still need press!)
```

### 6.7.1 jf=cu vs jf=success

| jf value | Meaning | Next step |
|---|---|---|
| **`cu`** | Temporarily valid but requires press confirmation | Must send Bundle#3 |
| `success` | Fully valid | Can directly use _px3 for business APIs |

In practice, once you've taken the Bundle path, almost always `cu` (PX won't skip the press step).

### 6.7.2 state.cts Type Change

Bundle#1's `cts = UUID string`; OB#2's `oh()` handler triggers `Ao.trigger("sc", ...)`, which updates cts to ms timestamp:

```
Bundle#1 POST: cts=513385fa-11b8-11f1-...   (UUID)
OB#2 → oh() → internal cts updates = Date.now() = 1771967728434
Bundle#3 POST: cts=1771967728434           (ms timestamp)
```

⚠️ This is the `cts` type change (gotcha #27).

## 6.8 Extract _px3 Cookie

```js
function extract_px3(obSegments) {
    for (const seg of obSegments) {
        const args = seg.split('|').slice(1);   // drop handler key
        if (args.length >= 4 && /^_?px[23]$/.test(args[0])) {
            return {
                name:  args[0],            // "_px3"
                ttl:   parseInt(args[1]),  // 330
                value: args[2],            // encrypted cookie value
                secure: args[3] === "true",
                maxAge: parseInt(args[4]),  // 300
            };
        }
    }
    return null;
}
```

---

# Part 7: Bundle#3 Press Challenge

## 7.1 Trigger: jf=cu Signal

In OB#2, if there's a segment `<flag>|cu`, it means the challenge isn't complete; you need:
1. Browser renders the press button in the captcha iframe
2. User presses for 1-3 seconds
3. Collect mouse trajectory + error stacks + DOM encoding + WASM output
4. Send Bundle#3

If OB#2 is `<flag>|success` → no press needed; use `_px3` directly.

## 7.2 Strict Order of 6 Events

⚠️ **Bundle#3's EV array is actually 6 events** (earlier docs mistakenly wrote 5; the original `px_bundle3_auto.user.js` restored from git f256b7e on 2026-05-21 contains 6 builders). PC HMAC verification is over `serialize([ev0, evMetrics, ev1, ev2, ev3, ev4])`; **any reorder = different PC = reject**.

The strict order measured for iFood (from [`../script/userscripts/px_bundle3_auto.user.js`](../script/userscripts/px_bundle3_auto.user.js) `buildBundle3Events()` line 1145):

| # | Event type `t` | Field count | Meaning | seq |
|---|---|---|---|---|
| 0 | `N2sCLXEHBBg=` (WebGL/browser fingerprint) / or `egIAQDxqCXU=` (varies by version) | **78** | Browser fingerprint (WebGL/Canvas/UA) | 2 |
| 1 | **`eEgNDj0nBzw=` (Metrics)** ⭐ **new** | **18** | **PX internal metrics report** (timing chain + encrypted metrics blob) | 3 |
| 2 | `FCwhKlFEIRs=` (mouseout) / or `DhY0VEt6O2U=` | **20** | Single mouseout interaction event | 4 |
| 3 | **`PX561`** (core) | **95** | ⭐ **Core: press validation + WASM result + mouse trajectory** | 6 |
| 4 | `bHAWcioaE0I=` (onSolved) | **27** | captcha completion callback (onSolvedCallback) | 7 |
| 5 | `XQUoAxhoKzg=` (PX11994) | **24** | Interaction summary (differential trajectory + DOM stats) | 8 |

Total fields: 78+18+20+95+27+24 = **262** (not 244 as earlier docs wrote).

> ⚠️ **Critical correction**: early docs wrote 5 events only, missing Event Metrics (PX internal metrics report containing the encrypted `mtr` blob: `{"v":1.008,"html":654,"js":274,"enc":2,"exec":628}`). **This event must be sent**; not sending it leads PX backend to flag distribution anomalies. The original `buildBundle3Events(opts)` has `opts.skipMetrics` to skip it, but that's a temporary toggle when the metrics blob `en` encryption is unreversed; **the production path must include Metrics**.

> Some older PX versions named it `[PX10498, PX561, PX10496, PX535, PX11116]` (5 events) — those are earlier versions. The current iFood measured 6 events (including Metrics).

### 7.2.1 Event Metrics Detail (18 Fields)

PX internal timing chain report. The first 6 fields are key timing + encrypted metrics:

| # | Key | Value | Meaning |
|---|---|---|---|
| 1 | `DXV4M0gbewg=` | 3623 | timing T1 (html parse complete) |
| 2 | `X0MqRRotKnc=` | 4659 | timing T2 (js load complete) |
| 3 | `PARJQnlqSXE=` | 4668 | timing T3 (encryption start) |
| 4 | `SBh9Xg12fW4=` | 5283 | timing T4 (execution complete) = performance.now() |
| 5 | `Ew9mCVZgbDo=` | `{"en":"","mtr":{...}}` | **encrypted metrics blob** (en encryption unreversed) |
| 6 | `EFAlFlY9JCU=` | `1771991238575` | Page load timestamp |

Remaining 12 fields are common tail shared with other events (see §7.3).

**`mtr` blob structure**:
```json
{
  "v":     1.008,    // PX SDK version number
  "html":  654,      // HTML parse duration ms
  "js":    274,      // JS load duration ms
  "enc":   2,        // encryption duration ms
  "exec":  628       // total execution duration ms
}
```

**`en` field** (outer encryption): measured `""` (empty) passes; PX currently doesn't strictly validate. For strict-production scenarios where you need to reverse AES-GCM wrapping, temporarily install a crypto.subtle hook script to capture the key (legacy `crypto_hook.user.js` is deprecated; now check the embedded encryption code in `px_bundle3_auto.user.js` Part 2).

## 7.3 Common Tail Fields (12, Shared by All 6 Events)

Each event's tail carries 12 identical fields:

| Key | Value | Source | Class |
|---|---|---|---|
| `LVEXU2s1GmM=` | 2→4→6→7→8 | Global event sequence, incrementing | DYNAMIC |
| `MkpICHQiQzo=` | 5076→35646→43632 | `performance.now()` | DYNAMIC |
| `ZRlfGyNzUyA=` | `true` | PX init complete flag | STATIC |
| `Bh48XENxOW4=` | `1771991268575` | Server timestamp (/ns response) | SESSION |
| `PSEHY3tIA1c=` | UUID | `_pxUuid`, OB `ooIIoo` handler generated | SESSION |
| `UBRqVhV8YWA=` | `bPb2hiak...` (176 chars) | `_px3` cookie encrypted token | SESSION |
| `dg4MTDNmB3s=` | `1003.200...` | `performance.timeOrigin` precision value | SESSION |
| `SlJwEAw8eis=` | `false` | Detection flag | STATIC |
| `LnZUdGsYWUE=` | `"PX11745"` | Common event marker (hardcoded) | STATIC |
| `bRFXEyt6XCk=` | `"pxhc"` | PX Human Challenge identifier | STATIC |
| `W0MhQR4tKHs=` | `false` | Detection flag | STATIC |
| `ST0zfwxXPk4=` | `c61dbd8a...` (695 chars) | `_px3` full cookie value (hash:token:1000:encrypted) | SESSION |

## 7.4 PX561 (Core 95 Fields) — Tier 1-5 Classification

PX561 is the most complex Bundle#3 field, tiered by "forgery difficulty" into 5 Tiers:

### 7.4.1 Tier 1 — Hardcoded (~50 fields)

Directly hardcoded; invariant within the same browser profile.

**21 boolean flags**:

| Key | Value | Inferred source |
|---|---|---|
| `ZRlfGyNzUyA=` | `true` | PX init flag |
| `T3c1NQkTOwQ=` | `true` | captcha visibility |
| `UTUrdxRZJEM=` | `true` | challenge type flag |
| `NSkPa3BBAFk=` | `true` | press detection enabled |
| `UiNhKBRAZh8=` | `true` | interaction validation pass |
| `Hm8tZFsOK1c=` | `true` | environment detection pass |
| `R3Y0PQIXMgc=` | `true` | feature support flag |
| `cgMBSDdiBnI=` | `true` | feature support flag |
| `cyJAaTZDQF8=` | `true` | validation complete flag |
| `VidlLBBAZB8=` | `false` | bot detection (not bot) |
| `eEULDj4oDjU=` | `false` | automation tool detection |
| `NAFHSnJiQng=` | `false` | devtools detection |
| `GwpoAV5qbDQ=` | `false` | emulator detection |
| `DXh+M0gYcwg=` | `false` | headless detection |
| `OSQKb3xFDl0=` | `false` | selenium detection |
| `YG0TZiUMFVY=` | `false` | puppeteer detection |
| `cH0DdjUcBU0=` | `false` | phantom detection |
| `AWxyJ0QOdBE=` | `false` | proxy detection |
| `FwZkDVJnZDg=` | `false` | Detection flag |
| `SlJwEAw8eis=` | `false` | Detection flag |
| `W0MhQR4tKHs=` | `false` | Detection flag |

**10 screen/layout constants**:

| Key | Value | Source |
|---|---|---|
| `PAlPQnplT3M=` | `1920` | `screen.width` |
| `cRxCFzd/TiQ=` | `1080` | `screen.height` |
| `V0YkTRImIX4=` | `948` | captcha iframe `clientWidth` |
| `RTA2ewNQO00=` | `631` | captcha iframe `clientHeight` |
| `dEEHCjIhAT8=` | `505` | button `offsetTop` (Y position) |
| `XGlvYhoFaVQ=` | `530` | button `clientY` region |
| `KntZcG8aXkU=` | `8` | `devicePixelRatio` related or DOM depth |
| `FUBmS1MhZ3w=` | `4294967296` | `2^32`, `performance.memory.jsHeapSizeLimit` |
| `RBF3WgFzcWA=` | `4` | `navigator.hardwareConcurrency` |
| `aHUbfi0XHUs=` | `1` | Constant |

**7 string constants**:

| Key | Value | Source |
|---|---|---|
| `TlZ0FAg/fCI=` | `"visible"` | `document.visibilityState` |
| `RTA2ewNcOks=` | `"pointerdown"` | Event type string |
| `JVAWW2M8G28=` | `"pointerup"` | Event type string |
| `VGFnahINZFw=` | `"zh-CN"` | `navigator.language` (use whatever you're impersonating) |
| `LnZUdGsYWUE=` | `"PX11745"` | Common event marker |
| `bRFXEyt6XCk=` | `"pxhc"` | PX Human Challenge identifier |
| `Dh89VEt6P2Y=` | `[""]` | Keyboard input record (empty = no input) |

### 7.4.2 Tier 2 — Simple Live (~25 fields)

Requires runtime data but easy to forge (incrementing counters, `performance.now()`, error stack template substituting UUID).

| Key | Value | Notes |
|---|---|---|
| `YjoYOCReHAs=` | `1` | Click count |
| `BXl/O0MccQ4=` | `0` | Failure count |
| `KDxSPm5XXA4=` | `0` | Retry count |
| `eyNBYT1KTFo=` | `0` | Timeout count |
| `MD1DNnVbQQE=` | `1` | captcha attempt count |
| `JxYUHWFxFi8=` | `241` | offsetX within button |
| `LVEXU2s1GmM=` | `6` | Global event sequence |
| `aR1THy92VyQ=` | `40522` | `performance.now()` offset |
| `MkpICHQhQD0=` | `4` | Event internal sequence |
| `MkpICHQiQzo=` | `43632` | Current `performance.now()` |
| `IxIQGWVzFiI=` | `83672695` | Cumulative counter (large number) |
| `RBF3WgJ9cGs=` | `146665135` | Cumulative counter |
| `V0YkTREhJXg=` | `5592` | Time delta (captcha display to interaction) |
| `InNReGQUV0s=` | `38954` | `performance.now()` after pointerup |
| `Slt5EA86fSY=` | `38957` | WASM execution complete time |
| `JxYUHWFxEw==` | `12217.200...` | High-precision `performance.now()` |
| `QlNxGAc0fSg=` | `[5515, 1466]` | Time intervals: [pre-press wait, press duration] |
| `Czp4cU5Ye0Y=` | `[1771991261025, 1771991267105]` | Absolute timestamp array |
| `IxIQGWZwEy0=` | `[1771991266541]` | WASM call moment |
| `CXR6P0wWfQw=` | `814` | Time delta / coordinate value |
| `AhMxWEdxNmg=` | `1658` | Time delta (press → WASM complete) |

### 7.4.3 Tier 3 — Session-Dependent (~15 fields)

Must be obtained from prior request chain (UUID, _px3 token, server timestamp, etc.):

| Key | Value | Source | Notes |
|---|---|---|---|
| `PSEHY3tIA1c=` | `a4cb3e50-...` | `_pxUuid` | OB `ooIIoo` handler assigned |
| `UBRqVhV8YWA=` | `bPb2hiak...` | `_px3` token | OB `IIIooo` handler issued |
| `ST0zfwxXPk4=` | `c61dbd8a...` | `_px3` full value | hash:token:1000:encrypted |
| `Bh48XENxOW4=` | `1771991268575` | `/ns` response timestamp | `Am()` fetched |
| `QlNxGAcxci4=` | `1771991229618` | Page load timestamp | Set at captcha page load |
| `Vi5sLBNGYR8=` | `f1085bff...` (32 chars) | MD5 fingerprint hash | Invariant within browser profile |
| `dgcFTDNhAXs=` | `ef643ce8...` (128 chars) | SHA-512 composite fingerprint | Invariant within browser profile |
| `dg4MTDNmB3s=` | `1003.200...` | `performance.timeOrigin` precision | Invariant within session |
| `ZjcVPCNXGQc=` | `"v2.7.7"` | PX captcha SDK version | Follows script version |
| `Q3IwOQYQMwg=` | `"hgb"` | Challenge type (hold-gesture-button) | Server-decided |
| `M2IAKXYEBBM=` | `51` | Button width offset | Page layout |
| `eypIYT1IT1I=` | `52` | Button height | Page layout |
| `WitpIB9IbxE=` | `2508` | Timeout / time delta | Fixed within session |
| `NkdFDHMlQzs=` | `97` | Challenge difficulty parameter | Server-decided |

### 7.4.4 Tier 4 — Mouse Trajectory (5 Fields, High Forgery Difficulty)

| Key | Value | Notes |
|---|---|---|
| `PAlPQnlqS3k=` | **544 points** `"x,y,timestamp"` | Full trajectory |
| `EmMhaFQBLFI=` | **150 points** `"x,y,timestamp"` | Filtered trajectory (about half sampling) |
| `OkJAAHwsRDE=` | `"0,0,32537\|-3,1,32538\|..."` | **Differential mouse trajectory** (dx,dy,timestamp) |
| `YQVbByduXz0=` | 25-point sample | Trajectory subset |
| `QlNxGAQ+dyw=` | 32 interaction events | mouseover/out/click/pointerup timing |

**Trajectory analysis example**:

```
Start: (680, 669) t=33487  ← upper-right of page
Path: (403, 889) t=33620   ← move left-down toward button region
Hold: (352, 525) t=33853→36850  ← stay on button for ~3 seconds (long press)
After release: (384, 511) t=39610  ← slight movement after release
```

**Sampling rules**:
- Full trajectory: sample every 1-3ms
- Filtered trajectory: sample every 2ms (every other point)
- Must show Bezier curve characteristics (acceleration → deceleration → stop)
- Server has a trajectory analysis model detecting line/uniform-speed/jump anomalies

### 7.4.5 Tier 5 — WASM Computation (3 Fields)

**Fully reproduced in Node.js**:

| Field | PX code | Notes |
|---|---|---|
| `Slt5EA85fiI=` | **PX12590** | `Ys.a()` output, 64-char hex, non-deterministic (random + UUID) |
| `MD1DNnVfRgQ=` | **PX12573/PX12610** | `Ys.b(Es)` output, 127-char encoded string, deterministic (Es+UUID→fixed result) |
| `AE0zBkUsPjQ=` | — | sensor encryption data (114 hex chars) |

Reproduction:

```js
const { initWasm } = require('./run_wasm');
const { a, b } = await initWasm(uuid);   // pass in _pxUuid
const px12590 = a();                       // → Slt5EA85fiI=
const px12610 = b(Es);                     // → MD1DNnVfRgQ= (Es = PoW preimage)
```

**Key dependencies**:
- `globalThis._pxUuid` — `b()` must read (gotcha #B1)
- `Es` = PoW preimage — the reverse lookup result of `sha256(candidate) === targetHash`
- PoW algorithm `poi()` fully reversed; search space ~640K iterations; seconds-level completion

### 7.4.6 Error Stack (Live, Chrome-Version-Bound)

| Key | Value | Source |
|---|---|---|
| `EmooaFQOLV4=` | `"TypeError: Cannot read properties of null (reading '0') at _r (...main.min.js:2:21514) at fs (...) at os (...) at ...captcha.js...:2:582448 at Ws (...captcha.js...:2:334970) at Object.A [as onSolvedCallback] ..."` | `try/catch` capture |

Full stack ~1256 chars. **Contains uuid and vid in the captcha.js URL; different per session**. Live: just substitute uuid/vid in the URL.

⚠️ Line numbers are bound to Chrome major version (gotcha #D7). See [§16 SDK Drift](#part-16-sdk-drift-response).

### 7.4.7 DOM Probing (Live)

| Key | Value | Source |
|---|---|---|
| `MkNBCHQuRTw=` | `["nodeType","ELEMENT_NODE","matches",...]` (18 items) | Shadow DOM property traversal |

**Full value**:

```json
["nodeType","ELEMENT_NODE","matches","closest","innerHTML","outerHTML",
 "insertAdjacentElement","insertAdjacentHTML","insertAdjacentText",
 "setHTMLUnsafe","getHTML","after","animate","append","before",
 "getAnimations","prepend","replaceChildren"]
```

This is property probing of the captcha button's Shadow DOM element, used to detect DOM tampering. **Fixed for the same browser version; can hardcode**.

### 7.4.8 Pointer Events (Live)

#### pointerdown

| Key | Value | Source |
|---|---|---|
| `TTg+cwtVPkQ=` | `309.5` | pointerdown `offsetX` |
| `RBF3WgF0dGw=` | `17.44` | pointerdown `offsetY` |
| `Ln9ddGgYWEU=` | `602.5` | pointerdown `clientX` |
| `WitpIBxJaRA=` | `364` | pointerdown `clientY` |
| `eWRKLz8HSR8=` | `37468` | pointerdown `performance.now()` |

#### pointerup

| Key | Value | Source |
|---|---|---|
| `Lx4cFWp6GiM=` | `309.5` | pointerup `offsetX` |
| `WitpIBxIaBs=` | `17.44` | pointerup `offsetY` |
| `Dz58dUlefEI=` | `602.5` | pointerup `clientX` |
| `YQxSByduVTY=` | `364` | pointerup `clientY` |
| `HCkvIllJKhc=` | `38936` | pointerup `performance.now()` |

**Press duration = 38936 - 37468 = 1468ms (~1.5-second long press)**.

⚠️ `offsetX/Y` accurate to decimal (309.5, 17.44) indicates a real browser event, **not integer coordinates** (gotcha #B12).

## 7.5 PX561 Field Totals

```
21 booleans + 10 screen constants + 7 string constants + 12 common tail fixed +
14 Session fields + 5 mouse trajectory + 3 WASM + error stack + DOM probe +
~20 timestamps/counters + 10 pointer events = ~95 fields
```

## 7.6 Event #1 mouseout (20 Fields)

```js
{
    HUFnQ1gtank=: 629,            // clientX
    HCAmIllJKhQ=: 164,            // clientY
    Rl58HAMwcS0=: "mouseout",    // event type
    KnJQcGwZWEA=: "DIV",          // target element tagName
    aR1THy92VyQ=: 32536,          // performance.now()
    EmooaFQOLV0=: "true",         // event bubbling
    aR1THyx0WCw=: true,           // isTrusted
    // ... + 12 common tail fields (see §7.3)
}
```

**Mouse coordinates and time are live; the rest hardcoded**.

## 7.7 Event #3 Captcha Completion Callback (27 Fields)

```js
{
    egsJQD9vCHU=: "pxCaptcha",                       // captcha type identifier (hardcoded)
    Tl99FAg/cCY=: "www.ifood.com.br",                // target domain (hardcoded)
    BXB2O0ARegw=: "https://cw-marketplace.ifood.com.br/...",  // blocked API URL (hardcoded)
    X04sRRovIXE=: true,                              // validation pass flag (hardcoded)
    fy5MZTpKTF4=: false,                             // mobile flag (hardcoded)
    aHUbfi0XHkQ=: false,                             // offline flag (hardcoded)
    HUFnRV8p=:    "a91ae960-...",                    // captcha instance ID (= POST's ci, session-scoped)
    ZjcVPCNXGQc=: "v2.7.7",                          // SDK version (live)
    WitpIB9IbxE=: 2508,                              // timeout value (live)
    Fw9tDVJiaTY=: "<Myanmar encoding>",              // WASM data (same as PX561)
    aR1THy92VyQ=: 40522,                             // performance.now()
    T3c1NQkTOwQ=: true,                              // visibility (hardcoded)
    TlZ0FAg/fCI=: "visible",                         // visibilityState (hardcoded)
    EmooaFQOLV4=: "<error stack>",                    // contains uuid/vid (live)
    // ... + 12 common tail fields
}
```

## 7.8 Event #4 PX11994 Interaction Summary (24 Fields)

```js
{
    R389PQITNw8=: "PX11994",                              // event code (hardcoded)
    SlJwEAw2fiY=: "https://www.ifood.com.br/restaurantes", // current page URL (hardcoded)
    PABGQnlsTXA=: {"DIV":1,"#px-captcha":2},               // DOM interaction counts (live)
    QAR6RgZhcHE=: "<UUID>",                                 // = _pxUuid (live)
    cgoISDRvAX4=: 0,                                        // counter (live)
    PkZEBHsvTzM=: true,                                     // flag (hardcoded)
    OkJAAHwsRDE=: "0,0,32537|-3,1,32538|...",              // ⭐ differential mouse trajectory (dx,dy,ts)
    YQVbByRuVDQ=: "",                                       // keyboard input (empty, hardcoded)
    EXVrN1QcYQU=: 1771991228053,                            // absolute timestamp (live)
    YQVbByduXz0=: [25-point array],                         // trajectory subset (live)
    a1NRUS04W2o=: "631x0",                                  // viewport position (hardcoded)
    QSU7ZwRIMlU=: [16 item object array],                   // detailed interaction record (coords, DOM)
    // ... + 12 common tail fields
}
```

### 7.8.1 Differential Mouse Trajectory Format

```
0,0,32537    ← starting point
-3,1,32538   ← left 3px, down 1px
-5,3,32538   ← left 5px, down 3px
...

Differential = current coord - previous coord
```

This is the same data as PX535's "full trajectory" in §7.4.4, represented differently.

## 7.9 Timing Constraints (PX Strict Validation)

Bundle#3 timestamps must align:

```
pointerDown.ts          ────► A                       (37468)
pointerUp.ts            ────► A + duration (1-3s)      (38936)
mouse trajectory points ────► [mouseStartTs, mouseEndTs]
mouseEndTs              ≈ pointerDown.ts ± 100ms      (37380)
mouseStartTs            = mouseEndTs - duration       (35912)
mouse interactions ts   monotonically increasing, covering the entire session
error stack ts          performance.now() at error capture
```

PX validates at least:
1. `duration_field === pointerUp.ts - pointerDown.ts ± 100ms` (gotcha #B13a)
2. `mouseEndTs ≈ pointerDown.ts ± 200ms`
3. Mouse trajectory point count vs duration ratio reasonable (544 points / 1500ms ≈ 2.7 pt/ms)
4. All event init/sendTime within ±5-second window

## 7.10 OB#3 Response: Valid _px3

After Bundle#3 passes, OB#3 contains the **valid** `_px3`:

```
Segment 0: <flag>|success                              ← jf=success ⭐
Segment 1: <set_cookie>|_px3|330|<value>|...           ← valid _px3
Segment 2: ...
```

`jf` changing from `cu` to `success` = this `_px3` **is usable for business APIs**.

---

# Part 8: Bundle#4 Fallback / Telemetry

Bundle#4 is the "last step" of the Bundle flow; it has two aspects.

## 8.1 Dual Identity

### 8.1.1 Error Path (Fallback)

If any step in Bundle#1/#2/#3 fails (WASM load failure, PoW timeout, user press timeout), the SDK calls `errorReport()` in the browser to send Bundle#4 reporting to PX:

```json
{
    "result": "failed",
    "error": "wasm_load_timeout",
    "stage": "bundle2",
    "duration": 8500,
    "attempt": 1
}
```

### 8.1.2 Telemetry Path (Success)

If Bundle#3 succeeds, **the real browser also sends** a Bundle#4 as "I succeeded" telemetry:

```json
{
    "result": "success",
    "stage": "bundle3_done",
    "duration": 12300,
    "attempt": 1
}
```

Used by PX backend for "success-rate statistics".

## 8.2 When to Send: Two Views + Scenario Judgment

The industry has two views (both correct in practice, scenario-dependent):

| Scenario | Send Bundle#4? | Rationale |
|---|---|---|
| **Test phase / small scale** (< few hundred per day) | Don't | Skipping causes no problems; focus on the Bundle#1-3 flow |
| **Production long-run / large scale** (thousands per day) | **Must** | Skipping itself is a fingerprint — all your sessions lack Bundle#4, deviating from real users' distribution |

The choice depends on your IP pool size + concurrency. **Conservative: send it** (gotcha #B10).

## 8.3 Minimal Bundle#4 Construction

```js
async function sendBundle4(uuid, state, ctx) {
    const event = {
        t: 'PX_TELEMETRY',
        d: {
            'result_key':   ctx.success ? 'success' : 'failed',
            'duration_key': Date.now() - ctx.startTime,
            'attempt_key':  ctx.attempt || 1,
            'uuid_key':     uuid,
        }
    };
    const payload = generatePayload([event], state.no, uuid);
    const pc = generatePC([event], uuid, TAG, 388);

    return fetch('.../assets/js/bundle?seq=3&rsc=4', {
        method: 'POST',
        body: formEncode({
            payload, appId: INIT_APP_ID, tag: TAG, uuid, ft: 388,
            seq: 3, en: 'NTA', bi: BI, cs: state.qa, pc,
            sid: ctx.sid, vid: state.vid, cts: state.cts,
            errorPayload: '',   // empty for success path
            rsc: 4,
        }),
    });
}
```

## 8.4 Bundle#4 and the `do` Field

Bundle#4 occasionally triggers the `do` field (not `ob`). `do` dispatches via the `jl` registry (not `Ql`); typically the PX internal error flow:

```js
// ih(segments, isDo=true)
// → uses jl registry
// → jl is a subset of Ql + internal error handlers
```

The main path doesn't trigger `do`.

---

# Part 9: State Machine + state.* Cross-Request Propagation

## 9.1 Global State Field Overview

The 15 state variables involved across the entire Bundle flow:

| state.X | Type | Meaning | Obtained when | Injected where |
|---|---|---|---|---|
| `no` | string ms | Server timestamp | OB#1 | payload interleave key (B#2/#3/#4), EV2 d-field (**after parseInt**) |
| `appId` | string | Bundle AppID | OB#1 seg#3 | EV2 d-field (**not** the POST parameter) |
| `qa` | string 64 hex | challenge hash | OB#1 | POST parameter `cs=` |
| `to` | string num | XOR base | OB#1 | anti-tamper field computation |
| `pxsid` | UUID | session id | OB#1 | sid parameter (`pxsid + hh(no) + hh(cts)`) |
| `vid` | UUID | visitor id | OB#1 | POST parameter `vid=` |
| `cts` | UUID then ms | cookie ts | OB#1 (UUID), OB#2 (ms) | POST parameter `cts=` (**type changes**) |
| `jf` | string | flow status | OB#2/#3 | Read-only, decides whether to send #3 next or use cookie directly |
| `eo` | string | fh second arg | OB#1 (0IIII0) | Internal state |
| `ao` | string | HTTP status code | OB#1 (0III0I00) | Internal state |
| `ro` | number | Timestamp (seconds) | OB#1 (0III0I0I) | Internal state |
| `Lu` | UUID | PoW UUID | OB#1 (0II0I0) | PoW backup path |
| `Mr` | object | cookie config | OB#1 (IIIIII/II0III) | Internal dict |
| `pow.{suffix,target,difficulty}` | mixed | PoW triple | OB#1 (I0I0I0) | Local solving |
| `wasm.{a,b}` | string | WASM output | Local computation | EV2/EV3 d-field |

## 9.2 State Diagram (Where State Is Obtained / Injected)

```
Bundle#1 POST
  │ payload: 16 fields + default_no=1604064986000 interleave
  │ cs: none, sid: plain UUID
  ▼
OB#1 (13 segments) extracts:
  ─ jf = "cu"            (seg 0, I0I000)
  ─ to = "<long num>"    (seg 1, 0IIII0)
  ─ no = "<13-digit ms>" (seg 2, 0III0I0I) ⭐
  ─ ro = no/1000
  ─ $a = "<bundle appId>" (seg 3, II00II) ⭐
  ─ ao = "401"            (seg 4, 0III0I00)
  ─ qa = "<64 hex>"       (seg 5, III000) ⭐
  ─ visual = {...}        (seg 6, 0II0III0)
  ─ PoW = {suffix, target, diff=16, isTrusted=false} (seg 7, I0I0I0) ⭐
  ─ Lu = "<UUID>"         (seg 8, 0II0I0)
  ─ Mr = {cc, rf, fp, ...} (seg 9-12, IIIIII/II0III)
                    │
                    ▼ Local compute
                    ▼ PoW: ans = solvePow(suffix, target, 16) → ~9-60ms
                    ▼ WASM: a = wasmA(); b = wasmB(ans);
                    ▼
Bundle#2 POST
  │ payload: 228 fields + state.no interleave + inject:
  │   - state.appId       → EV2 d-field (Bundle AppID)
  │   - parseInt(state.no) → EV2 d-field (serverNo)
  │   - state.to          → EV2 d-field
  │   - PoW counter       → EV2 d-field
  │   - WASM a            → EV2 d-field (PX12590)
  │   - WASM b            → EV2 d-field (PX12610)
  │   - anti-tamper k/v   → replace original anti-tamper position (no delete+add)
  │ cs: state.qa
  │ ci: <challenge UUID>
  │ sid: uuid + hh(state.no) + hh(cts)   ← Unicode Tag steganography
  │ cts: state.cts (UUID)
  ▼
OB#2 (2 segments) updates:
  ─ _px3 (first version, jf=cu)    (seg 0, III0II)
  ─ jf = "cu"                       (seg 1, I0I000)
  ─ state.cts upgraded to ms timestamp
                    │
                    ▼ User press 1-3s (or synthesized)
                    ▼ Mouse 544-point Bezier
                    ▼ 4 error stack synthesis
                    ▼ Myanmar DOM encoding
                    ▼
Bundle#3 POST
  │ payload: 5-event EV array
  │   ev[0] = 78-field browser fingerprint (re-stated)
  │   ev[1] = 20-field mouseout
  │   ev[2] = 95-field PX561 ⭐ (contains WASM recompute, PoW restate, press coords, trajectory)
  │   ev[3] = 27-field onSolvedCallback
  │   ev[4] = 24-field PX11994 (differential trajectory)
  │ cs: state.qa
  │ cts: ms timestamp (new cts from OB#2)
  ▼
OB#3 extracts:
  ─ jf = "success"       ⭐ success!
  ─ _px3 (valid version)
                    │
                    ▼
Bundle#4 (optional) telemetry
```

## 9.3 UUID Constant Throughout (Critical Constraint)

⚠️ **All 4 POSTs of the Bundle flow share one UUID v1**:
- The uuid parameter in POST URL
- The uuid field inside payload (multiple occurrences)
- The uuid in HMAC salt (`"uuid:tag:ft"`)
- WASM `globalThis._pxUuid` (gotcha #B1)
- The base UUID in sid

If Bundle#2's uuid differs from Bundle#1's → PX sees the state.pxsid ↔ uuid relationship break → reject (gotcha #B9).

**iFood example**: all 4 POSTs use `c83577f0-5420-11f1-9150-e1cff29e25cc` (example).

## 9.4 Skeleton Code for state Extraction

```js
/**
 * Extract complete Bundle-path state from OB segments.
 * Does not rely on handler key strings (vary across versions); matches by args shape.
 */
function extractBundleState(obSegments) {
    const state = { pow: {}, visual: {}, Mr: {} };

    for (const seg of obSegments) {
        const args = seg.split('|').slice(1);   // drop handler key

        // 1-argument segments
        if (args.length === 1) {
            const v = args[0];

            // jf status flag
            if (/^(cu|success|blocked)$/.test(v)) {
                state.jf = v;
            }
            // 13-digit ms timestamp → state.no
            else if (/^1[5-9]\d{11}$/.test(v)) {
                state.no = v;
            }
            // 16-22 digit number → state.to
            else if (/^\d{16,22}$/.test(v)) {
                state.to = v;
            }
            // 12-30 all-lowercase alnum → bundle AppID
            else if (/^[a-z0-9]{12,30}$/.test(v) && !state.appId) {
                state.appId = v;
            }
            // 64 hex → challenge hash (qa)
            else if (/^[0-9a-f]{64}$/.test(v)) {
                if (!state.qa) state.qa = v;
            }
            // 4-20 hex → PoW suffix
            else if (/^[0-9a-f]{4,30}$/.test(v) && !state.pow.suffix) {
                state.pow.suffix = v;
            }
            // UUID
            else if (/^[a-f0-9-]{36}$/.test(v)) {
                if (!state.pxsid) state.pxsid = v;
                else if (!state.vid) state.vid = v;
                else if (!state.cts) state.cts = v;
            }
            // short letter string
            else if (/^[a-z]{2,5}$/.test(v)) {
                if (!state.eo) state.eo = v;
            }
        }
        // Multi-arg segments: PoW dispatch / visual challenge / cookie config
        else if (args.length >= 3) {
            // I0I0I0 PoW main: (enabled, suffix, target, diff, isTrusted)
            if (/^[01]$/.test(args[0]) && /^[0-9a-f]{4,30}$/.test(args[1]) &&
                /^[0-9a-f]{64}$/.test(args[2])) {
                state.pow.suffix = args[1];
                state.pow.target = args[2];
                state.pow.difficulty = parseInt(args[3]) || 16;
                state.pow.isTrusted = args[4] === 'true';
            }
            // 0II0III0 visual challenge
            else if (args.length === 5 && /^\d+$/.test(args[0]) && /^\d+$/.test(args[1]) &&
                     /^[0-9a-f]{64}$/.test(args[4])) {
                state.visual = {
                    startW: parseInt(args[0]),
                    startH: parseInt(args[1]),
                    wJump:  parseInt(args[2]),
                    hJump:  parseInt(args[3]),
                    hash:   args[4],
                };
            }
            // IIIIII cookie config: (featureName, ttl, value)
            else if (args.length === 3 && /^\d+$/.test(args[1])) {
                state.Mr[args[0]] = args[2];
            }
        }
        // II0III config string
        else if (args.length === 1 && /^[a-z]+:[0-9]+(,[a-z]+:[0-9]+)*$/.test(args[0])) {
            for (const pair of args[0].split(',')) {
                const [k, v] = pair.split(':');
                state.Mr[k] = v;
            }
        }
    }

    return state;
}
```

> Full version: see [`../../revers/ob.js`](../../revers/ob.js) (the Bundle extension `extractBundleState` function is pending).

---

# Part 10: Complete 229-Field Classification

Bundle Payload has ~229 fields total; event type `"t": "aHwcfi4UFkw="`. All keys are base64-encoded (regenerate per PX script load). Below is a complete enumeration in 17 categories.

**Field type distribution**:

| Value type | Count | Percentage |
|---|---|---|
| `boolean` | 107 | 46.7% |
| `string` | 72 | 31.4% |
| `number` | 40 | 17.5% |
| `object` (array/map/null) | 10 | 4.4% |
| **Total** | **229** | **100%** |

**Category distribution**:

| Category | Field count |
|---|---|
| Base environment | 7 |
| Browser identifiers | 14 |
| Screen and display | 18 |
| Language and timezone | 5 |
| Hardware detection | 8 |
| Network info | 6 |
| Plugin info | 4 |
| Canvas/WebGL/audio fingerprint | 12 |
| API and feature detection | 56 |
| Cookie and storage | 6 |
| **Security detection (Bot/Automation)** | **42** |
| PX internal state | 33 |
| Other hashes | 16 |
| Error capture | 2 |
| UA Client Hints | 6 |
| Misc | 9 |

> ⚠️ Note: the above b64 keys are the current iFood SDK version's. **After new SDK upgrades the keys all change**, but the **semantics remain**. On new versions, use `find_state_keys.py` to value-match across 6 batches and re-correlate.

(For the detailed 17-category field table, see [Part 10 in the original Chinese document](Bundle_完整技术文档.md); the full bilingual table is preserved verbatim there with identical b64 keys and value examples. Categories §10.1-§10.17 cover: 7 base environment fields · 14 browser identifiers · 18 screen/display · 5 language/timezone · 8 hardware · 6 network · 4 plugin · 12 Canvas/WebGL/audio fingerprint with 16-hash source-line index · 56 API/feature-detection booleans · 6 cookie/storage · 42 security/bot-detection booleans · 33 PX internal state · 16 other hashes · 2 error capture · 6 UA Client Hints · 9 misc — full forgery strategy by change-frequency tier in §10.17.)

---

# Part 11: Encryption Chain — Source-Level Detail

Bundle shares 70% of the algorithm layer with Collector, but has several source-level differences. Below restored in the same order they appear in PX's main.js.

## 11.1 Encryption Flow Comparison

```
                  Collector                            Bundle
Encryption:  JSON → XOR(50) → URL encode          JSON → XOR(50) → base64
             → base64 → 20-char interleave         → Jf() 20-char interleave
Interleave key: ee(Q(ni()), 10) (initial no)       ee(Q(ni()), 10) (server timestamp)
Offset key:  UUID → base64 → XOR(10)              UUID → base64 → XOR(10)
De-interleave: splice(offsets[i]-1, 1) back-to-front   splice(offsets[i]-1, 1) back-to-front
```

Differences are only in two places:
1. Collector adds a URL encode step (between XOR(50) and base64)
2. Bundle does no URL encode (direct base64)

## 11.2 Jf() Bundle Interleave Algorithm — Full Source (main.js:3128)

```js
function Jf(events, config) {
    // Step 1: get interleave key string (o, 20 chars)
    // ni() = server timestamp (state.no); first request uses default "1604064986000"
    var o = ee(Q(ni()), 10);   // base64(no) → XOR(10) → key string

    // Step 2: serialize + encrypt
    var jsonStr = it(events);    // custom JSON serialize (line 299)
    var xored = ee(jsonStr, 50); // XOR each char ^ 50
    var a = Q(xored);             // base64 encode

    // Step 3: compute insertion positions (key = UUID, NOT appId!)
    // jf = "cu" (line 3126), config.cu = Xa() = UUID (line 4417)
    var h = ee(Q(config[jf]), 10);   // UUID → base64 → XOR(10) → hash string

    // First pass: find max product
    var maxProduct = -1;
    for (var i = 0; i < o.length; i++) {
        var row = Math.floor(i / h.length) + 1;
        var col = i >= h.length ? i % h.length : i;
        var product = h.charCodeAt(col) * h.charCodeAt(row);
        if (product > maxProduct) maxProduct = product;
    }

    // Second pass: compute offsets
    var indices = [];
    for (var i = 0; i < o.length; i++) {
        var row = Math.floor(i / h.length) + 1;
        var col = i % h.length;
        var product = h.charCodeAt(col) * h.charCodeAt(row);
        // Qf() linearly scales to [0, payloadLen-1]
        if (product >= a.length) {
            product = Qf(product, 0, maxProduct, 0, a.length - 1);
            // Qf = Math.floor((t-e)/(n-e)*(a-r)+r)
        }
        // dedup: collision → +1
        while (indices.includes(product)) product += 1;
        indices.push(product);
    }
    indices.sort();

    // Step 4: interleave (encoding direction)
    var result = "";
    var pos = 0;
    for (var u = 0; u < o.length; u++) {
        result += a.substring(pos, indices[u] - u - 1) + o[u];
        pos = indices[u] - u - 1;
    }
    result += a.substring(pos);
    // Result: o[u] is inserted at position indices[u] - 1 of result

    return result;
}
```

⚠️ **The offset key is `config[jf]` = `config.cu` = UUID, NOT appId!** This is the most subtle difference between Bundle and Collector.

## 11.3 De-interleave (Decryption)

```js
/**
 * Reverse-decrypt Bundle payload
 *
 * 1. Compute offsets with the same algorithm (key=UUID, payloadLen=post-interleave total length)
 * 2. From the back, delete the char at offsets[i]-1 (splice)
 * 3. base64 decode → XOR(50) → JSON
 */
function decryptBundlePayload(payload, uuid, serverNo) {
    // Compute offsets
    const o_length = 20;   // 13-digit timestamp base64 = 20 chars
    const offsets = computeOffsets(o_length, payload.length, uuid);

    // De-interleave
    const chars = payload.split('');
    for (let i = offsets.length - 1; i >= 0; i--) {
        chars.splice(offsets[i] - 1, 1);   // ⭐ critical: offset - 1
    }
    const cleanPayload = chars.join('');

    // base64 → XOR(50) → JSON
    const xored = Buffer.from(cleanPayload, 'base64').toString('binary');
    let jsonStr = '';
    for (let i = 0; i < xored.length; i++) {
        jsonStr += String.fromCharCode(xored.charCodeAt(i) ^ 50);
    }
    return JSON.parse(jsonStr);
}
```

⚠️ **Critical**: `splice(offsets[i] - 1, 1)` — offsets are 1-indexed, splice is 0-indexed; must subtract 1 (gotcha #8).

## 11.4 Custom JSON Serialize `it()` (main.js:299-329)

PX doesn't use `JSON.stringify()`; it has its own serialize. Differences:
- `undefined` → literal string `"undefined"` (not omitted)
- `NaN` / `Infinity` → `"null"`
- Date object formatting differs
- Number precision differences

```js
function it(value, indent, ...) {
    // Simplified pseudocode
    if (value === undefined) return '"undefined"';
    if (value !== value) return '"null"';            // NaN
    if (value === Infinity || value === -Infinity) return '"null"';
    if (value === null) return 'null';
    if (typeof value === 'boolean') return String(value);
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return '"' + escapeString(value) + '"';
    if (Array.isArray(value)) {
        return '[' + value.map(it).join(',') + ']';
    }
    if (typeof value === 'object') {
        const pairs = [];
        for (const key of Object.keys(value)) {
            pairs.push('"' + key + '":' + it(value[key]));
        }
        return '{' + pairs.join(',') + '}';
    }
    return 'null';
}
```

⚠️ Object key iteration order must match the original object (don't reorder); otherwise the serialized byte stream differs from the SDK's and PC computes wrong.

## 11.5 XOR Encode/Decode `ee()` (main.js:666-670)

```js
function ee(t, e) {
    var n = '';
    for (var i = 0; i < t.length; i++) {
        n += String.fromCharCode(t.charCodeAt(i) ^ e);
    }
    return n;
}
```

Simple per-character XOR. `e` is a single-byte key (e.g., 50, 10, 120).

## 11.6 `Q()` base64 Encode

```js
function Q(t) {
    return btoa(encodeURIComponent(t).replace(/%([0-9A-F]{2})/g, function(_, hex) {
        return String.fromCharCode(parseInt(hex, 16));
    }));
    // = btoa(unescape(encodeURIComponent(t)))
    // = UTF-8 base64
}
```

⚠️ **UTF-8 base64**, cannot use Latin-1 (gotcha #2).

## 11.7 `jt()` PC Validation Complete Algorithm (main.js:596-609)

```js
// jt(data, salt) — line 596
function jt(t, e) {
    var n = R(t, e);   // = hex(HMAC-MD5(salt=e, data=t)), 32 hex chars

    // Per-character processing:
    var digits = '';
    var nums = '';
    for (var i = 0; i < n.length; i++) {
        var ch = n.charCodeAt(i);
        if (ch >= 48 && ch <= 57) {       // digit 0-9
            digits += n[i];
        } else if (ch >= 97 && ch <= 102) { // letter a-f
            nums += (ch % 10).toString();
            // a (97) → 7
            // b (98) → 8
            // c (99) → 9
            // d (100) → 0
            // e (101) → 1
            // f (102) → 2
        }
    }

    // Concatenate: result = digits + nums
    var result = digits + nums;

    // Stride pick: result[0], result[2], result[4], ...
    var pc = '';
    for (var i = 0; i < result.length; i += 2) {
        pc += result[i];
    }

    return pc;   // ~16-digit string
}

// Invocation:
// pc = jt(it(events), [uuid, tag, ft].join(":"));
// salt = "eb30dfdf-11c5-11f1-...:O2MKZn0OEhI/ag==:388"
```

### 11.7.1 R() HMAC-MD5 (main.js:75-84)

```js
function R(t, e) {
    if (e === undefined) {
        return U(V(t));     // no salt: hex(MD5(t))
    }
    return U(F(e, t));      // with salt: hex(HMAC-MD5(salt=e, data=t))
}
```

The magic numbers `1732584193, -271733879, -1732584194, 271733878` in `M()` confirm standard MD5 init A/B/C/D. HMAC ipad/opad = `909522486 / 1549556828`.

## 11.8 `hh()` sid Steganography Encoding (main.js:4366-4373)

```js
function hh(t) {
    return t.split("").reduce(function(acc, ch) {
        var hex = ch.codePointAt(0).toString(16).padStart(2, "0");
        return acc + unescape("%uDB40%uDC" + hex);   // U+E0000 series
    }, "");
}
```

Converts a string to Unicode Tag Characters (U+E0100+ invisible characters).

```
"50" → U+E0035 U+E0030 → two invisible Unicode chars
```

Empirically, the Unicode Tag Chars appended after the sid UUID encode **each digit of the cts timestamp**, not ni():

```
U+E0131='1'
U+E0132='2'
...
U+E0139='9'
U+E0130='0'

sid = uuid + cts.split('').map(d => `U+E013${d}`).join('')
```

## 11.9 cs Is Server-issued (Not Client-computed)

⚠️ **Newcomers' trap**: thinking `cs=64hex` is client-side SHA-256 computed and trying to implement it. **It's not**:

```
OB#1 response → atob → XOR(120) → split("~~~~")
   → segment[5] → III000 handler → qa = challenge_hash

When mh() constructs:
   l = Ho() → return qa
   p.push("cs=" + l)
```

`cs` is the 64-char SHA-256 string provided by OB#1's `III000` handler, returned verbatim.

## 11.10 `/ns` Endpoint (NOT cs Source!)

```
GET https://tzm.px-cloud.net/ns?c=PXO1GDTa7Q
  → Returns: "2qWXVXCIYzzIizvyGFRN..." (token string)
  → Stored: Sm = responseText
```

The `/ns` return value goes into a **payload event field** (`k.d[M(d)] = Sm`), **not** the cs parameter.

## 11.11 Full Parameter Source Table (Restated)

| Parameter | Source | Type | main.js variable |
|---|---|---|---|
| `payload` | `Jf(events, config)` | client | `v` |
| `appId` | config | fixed | `e[yn]` |
| `tag` | script-hardcoded | fixed | `e[bn]` = `"O2MKZn0OEhI/ag=="` |
| `uuid` | `Xa()` | client | session |
| `ft` | config | fixed | `e[In]` = `388` |
| `seq` | `ph++` | counter | incrementing |
| `en` | fixed `"NTA"` | base64("50") | XOR key declaration |
| `bi` | script-hardcoded | fixed | `It` = `"GwNqS048KWpd..."` |
| `cs` | **Server OB response** | III000 handler | `Ho()` = `qa` |
| `pc` | HMAC-MD5 | client | `jt(it(t), salt)` |
| `sid` | UUID + steganography | client | `uuid + hh(cts)` |
| `vid` | visitor ID | client | `Tt()` |
| `ci` | challenge ID | server-issued | `as()` |
| `cts` | timestamp | client | `Ua` |
| `rsc` | response counter | client | `++Cm` |
| `/ns token` | GET `/ns?c=appId` | network fingerprint | `Sm` → payload field |

## 11.12 Internal Fingerprint PC Values (PX11804/PX11746/PX11371)

EV2 payload internally has 3 more HMAC fields (not the POST's pc parameter):

```
PX11804 = HMAC-MD5(user_agent, uuid)     → 32 hex
PX11746 = HMAC-MD5(user_agent, vid)      → 32 hex
PX11371 = HMAC-MD5(user_agent, sid)      → 32 hex
```

These 3 are **not extracted** (no "digit extraction + stride"); retained as hex strings.

⚠️ HMAC computation's `user_agent` must be **byte-identical** to the HTTP User-Agent header (gotcha #23); otherwise validation fails.

---

# Part 12: 5 Gaps in End-to-End Pure-Algo

In practice, the pure-algo Bundle generator is ~70% complete. The remaining **30%** consists of 5 gaps:

## 12.1 Gap 1: Mouse Bezier Trajectory Synthesis Quality

**Status**: Synthesized 544-point trajectories pass 7-9/10 for single sessions; after 50+ sessions, regular failures start appearing.

**Root cause**: the synthesized trajectory's "velocity curve" (distribution of point-to-point spacings) differs from real humans. Real human press:
- Startup acceleration (high accel)
- Mid-phase steady (uniform ~5px/ms)
- End deceleration (decelerate near target)

Synthesized trajectories are too uniform; PX's long-term behavioral analysis catches it.

**Fix directions**:
- Short-term: seed with 5-10 real captured trajectories; add jitter (±5ms ±1px) per copy
- Mid-term: expand to 50-100 seeds; distribute per account (gotcha #B19)
- Long-term: fit real human velocity curves (Bezier velocity curve + deceleration segment), fully synthesized

## 12.2 Gap 2: Error Stack Across Chrome Versions

**Status**: current 4-group error stack templates are valid for Chrome 145; switching to Chrome 140 or 150 fails half the time.

**Root cause**: V8's function-inlining strategy differs across versions; stack frame count and line-number positions both change. The "expected stack shape" encoded in captcha.js binds to the contemporary mainstream Chrome version.

**Fix direction**: maintain multiple stack templates and select by Chrome major in the outgoing UA (gotcha #D7).

## 12.3 Gap 3: WASM Constant Update Detection

**Status**: WASM constants (ChaCha20 seed, custom alphabet, HMAC key) differ per PX build.

**Root cause**: PX randomly generates constants during build. Each captcha.js upgrade (2-3 weeks) brings new WASM constants.

**Fix direction**:
- Write an automated script: each time a new captcha.js is captured, extract the WASM data section and diff constants
- If constants changed, trigger alert + auto-run WASM re-analysis

## 12.4 Gap 4: Trajectory Pool Expansion

**Status**: current 5 seed trajectories; ~50+ sessions are clustered.

**Fix direction**: expand to 50-100 seeds. Allocate trajectory per account-hash (same account always uses same seed + jitter); rotate across accounts.

## 12.5 Gap 5: Bundle#4 Behavioral Completeness

**Status**: success path doesn't send Bundle#4. Statistically deviates from real users.

**Fix direction**: depends on session scale. < a few hundred/day: don't send. > thousands/day: must send (gotcha #B10, §8.2).

---

# Part 13: Userscript Production Solution

The sole retained production artifact for the Bundle path: **[`../script/userscripts/px_bundle3_auto.user.js`](../script/userscripts/px_bundle3_auto.user.js)** — 2,131 lines / 237 KB / production 10/10 verified.

⚠️ **Critical correction**: "pure-algo press challenge" **is NOT simulating button clicks**. This script's approach is: let the PX SDK send Bundle#1/#2 itself → we hook fetch/XHR/iframe-XHR to intercept responses → **compute PoW + WASM + 6 events ourselves, then directly fetch() POST Bundle#3 out**. **The captcha button is never touched**.

## 13.1 Design Approach

Compared to other solutions:

| Solution | Approach | Pros | Cons |
|---|---|---|---|
| **A) Simulate button** (pointerdown/up + mouse trajectory synthesis) | dispatchEvent to the real button; let PX SDK complete B3 itself | No algorithm restoration | Hard to get right (mouse interactions / iframe Sandbox / shadow DOM) |
| **B) Userscript hook + pure-algo B3** (this solution ⭐) | Intercept B1/B2 → compute B3 → POST directly | Doesn't touch the button; every PX check is in the algorithm layer | Must restore the full algorithm set |
| **C) Fully pure-algo Node-side** | Node process simulation + WASM + compute B1/B2/B3 | Scales concurrently | Need to fake TLS / IP / UA / behavioral fingerprint — enormous work |

iFood production chose **B**, because:
- B1/B2 are sent by PX itself = real TLS / real UA / real cookies → highest pass rate
- We only compute B3 (the most complex one) = leverage the PX SDK's pre-warmed session context
- No button clicking = skip captcha's complex mouse / shadow DOM detection

## 13.2 Embedded Components (2,131-Line Structure)

Fully self-contained, **no dependency on external JS / WASM / data pool**:

```
Part 1: Pure JS SHA256 (synchronous PoW solver)            line 23-79
Part 2: Embedded full reverse modules                       line 82-695
   ─ ob.js (decodeOb, executeSegments, writePx3Cookie, processOb)
   ─ payload.js (serialize, b64, interleave, generatePayload)
   ─ pc.js (MD5, HMAC-MD5, generatePC)
   ─ sid.js (hh, generateSid)
   ─ uuid / solvePow / ml / xorStr

Bundle #3 Generic Events Builder                           line 696-1264
   ─ Event #0 browser fingerprint (78 fields) buildEvent0(opts)
   ─ Event Metrics ⭐ (18 fields) buildEventMetrics(opts)
   ─ Event #1 mouse interaction (20 fields) buildEvent1(opts)
   ─ Event #2 PX561 core (95 fields) buildEvent2(opts)
   ─ Event #3 Captcha completion callback (27 fields) buildEvent3(opts)
   ─ Event #4 PX11994 interaction summary (24 fields) buildEvent4(opts)
   ─ buildBundle3Events(opts) main assembler
   ─ buildOpts(p) 8 required + auto-compute rest

Part 3: XHR/fetch Hook intercepting B1/B2                   line 1266-1615
   ─ Match /assets/js/bundle or collector-*.px-cloud.net
   ─ Auto-decide seq=0/1, branch to onB1Response / onB2Response
   ─ Trigger buildAndSendB3() chain

Part 3.5: iframe Hook + appendChild MutationObserver       line 1617-2090
   ─ hookIframeXHR(iframe)  ← captcha is in an iframe; critical
   ─ Hook Document.appendChild — synchronously detect iframe insertion

Console API                                                 line 2091-2131
   ─ window.__pxAutoState        main page interception state
   ─ window.__pxCaptchaState     captcha iframe state
   ─ window.__pxBuildB3()        manually trigger B3 build (debug)
   ─ window.__pxReset()          reset all state
```

## 13.3 Installation

```
1. Install Tampermonkey (or Greasemonkey / Violentmonkey) in browser
2. Dashboard → Create new script → paste px_bundle3_auto.user.js → Save
3. Visit https://www.ifood.com.br/ → script loads automatically
```

## 13.4 Workflow (Production)

```
Browser loads ifood.com.br
   ↓
[PX-AUTO] script injected; install fetch/XHR hooks; listen for iframe insertion
   ↓
PX main.min.js auto-runs → high risk score → business API returns 403 + blockScript
   ↓
Browser loads captcha.js → creates captcha iframe
   ↓
Our script: detect iframe → install XHR hook inside iframe
   ↓
captcha.js sends Bundle#1 inside iframe → our hook intercepts the response
   ↓
   Decode OB#1 → extract state.no / state.appId / state.qa / state.to / pow.{suffix,target,difficulty}
   ↓
   Local PoW (~9-60ms synchronous SHA-256 brute force)
   ↓
   Local WASM a() + b(powAnswer) (embedded base64 decoding; init once)
   ↓
captcha.js auto-sends Bundle#2 → our hook intercepts the response
   ↓
   Decode OB#2 → first _px3 (jf=cu) + new state.cts
   ↓
[Key step] Don't wait for user button press; construct Bundle#3 immediately:
   ↓
   buildBundle3Events(opts) → 6-event array
   ↓
   generatePayload(events, serverTs, uuid) → Jf interleave
   ↓
   generatePC(events, uuid, tag, ft=388) → 16-char checksum
   ↓
   generateSid(pxsid, serverNo) + Unicode Tag steganography
   ↓
   fetch('.../assets/js/bundle?seq=2&rsc=3', { body: ... })
   ↓
Intercept Bundle#3 response → extract valid _px3 (jf=success) → write document.cookie
   ↓
F12 console shows [PX-AUTO] success; business API re-requests → 200
```

## 13.5 Critical Dependency: iframe XHR Hook

⚠️ **The #1 trap for newcomers**: PX's captcha doesn't send requests on the main page; **it sends inside an iframe**. Hooking only the main-page fetch/XHR misses B1/B2.

Code (line 1617+):

```js
function hookIframeXHR(iframe) {
    var iframeWin;
    try { iframeWin = iframe.contentWindow; } catch(e) { return; }
    if (!iframeWin || !iframeWin.XMLHttpRequest) return;
    if (iframe._pxHooked) return;
    iframe._pxHooked = true;

    var origOpen = iframeWin.XMLHttpRequest.prototype.open;
    var origSend = iframeWin.XMLHttpRequest.prototype.send;
    iframeWin.XMLHttpRequest.prototype.open = function(method, url) {
        this._pxUrl = url;
        this._pxMethod = method;
        return origOpen.apply(this, arguments);
    };
    iframeWin.XMLHttpRequest.prototype.send = function(body) {
        // ... intercept + parse response + trigger onB1Response / onB2Response
    };
}

// Synchronously detect iframe insertion (MutationObserver has race conditions)
var origAppendChild = Document.prototype.appendChild;
Document.prototype.appendChild = function(node) {
    var result = origAppendChild.call(this, node);
    if (node.tagName === 'IFRAME' && node.src.includes('captcha')) {
        node.addEventListener('load', function() { hookIframeXHR(node); });
        // Try immediately too — some captcha iframes load before onload fires
        hookIframeXHR(node);
    }
    return result;
};
```

## 13.6 Comparison with Other Solutions

| Dimension | px_bundle3_auto.user.js (this) | Fully pure-algo Node | Simulate button click |
|---|---|---|---|
| Deployment complexity | Medium (install userscript) | High (full algorithm + fake TLS) | Medium (need captcha DOM understanding) |
| Concurrency | Low (one session per tab) | **High** (Node process) | Low |
| Anti-detection | Extremely strong (real browser, real TLS, real cookies) | Weak (must fake TLS / IP / UA) | Medium (button detection hard to get right) |
| Cross-version maintenance | Medium (must update builders on captcha.js changes) | High (re-reverse on every upgrade) | Low |
| Workload | **2,131-line user.js** (already done) | ~5,000-line Node module + WASM | Depends on captcha complexity |
| Measured pass rate | **10/10** | 70% (5 gaps unsolved) | Partial scenarios |
| Use case | **Production primary** (account registration + 5-min cookie reuse) | Large-scale data collection (needs IP pool + TLS pool) | Demo / learning |

**Practical experience**: iFood used this solution for account registration (Path B) in 2026-02; collector silent path (similar to C) for data collection. **Both paths mixed**: use userscript to get _px3 cookie, then Node process reuses it for business APIs for 5 minutes; after expiry fall back to userscript to get a fresh cookie.

## 13.7 History + Provenance

| Time | Event |
|---|---|
| 2026-03-01 | git commit `f256b7e`; initial 2,131-line user.js committed |
| 2026-04-02 | git commit `007623b` cleanup deleted it directly, hoping to regenerate via `build_userscript.js`, but the builder has an escape bug on line 319 |
| 2026-04-02 → 2026-05-21 | The artifact existed only in git history and the `warterbili/px3cookie` GitHub mirror |
| 2026-05-21 | Restored from git f256b7e to this project's `bundle/script/userscripts/`; SHA `a432e016422233cc1b61790b4dc99991da9579244ec40092ccbdddb52ecdd744` — **byte-for-byte** identical to the original |

Detailed userscript install + console API + operation flow: see [`../script/userscripts/README.md`](../script/userscripts/README.md).

---

# Part 14: Cross-Platform Porting 7-Step Method

A standardized flow for porting the Bundle implementation from one PX site to another.

## 14.1 Shared / Platform-specific Matrix

| Dimension | Cross-site shared | Platform-specific |
|---|---|---|
| payload encryption chain | ✅ identical | — |
| PC HMAC-MD5 algorithm | ✅ | — |
| OB decoding (XOR + split + handler) | ✅ | — |
| SID Unicode steganography | ✅ | — |
| UUID v1 | ✅ | — |
| PoW algorithm (SHA-256 + 16-bit) | ✅ | — |
| WASM binary framework | ✅ | — |
| Mouse Bezier / Myanmar encoding / 4-group errstack | ✅ | — |
| TAG / AppID / FT constants | — | ✅ |
| Bundle AppID (OB#1 extracted) | — | ✅ (per-session change) |
| OB wire characters (0/l vs o/I) | — | ✅ |
| WASM internal constants (ChaCha20 seed) | — | ✅ |
| EV2/EV3 b64 key dictionary (229 entries) | — | ✅ (regenerate per PX build) |
| state.* → EV2 injection positions | — | ✅ |
| captcha iframe DOM structure | — | ✅ (Myanmar encoding template) |
| Field count (Bundle#1 16, #2 228, #3 95) | Roughly consistent | ±5 |

## 14.2 7-Step Method (In Order)

### Step 1: Capture captcha.js + WASM (10 min)

```bash
# Capture via real Chrome with CDP
python skill/cdp/scripts/cdp.py navigate "https://www.target-site.com/"
# In Network panel, find the captcha.js download

# Extract WASM
node extract_wasm.js captcha.js
```

Record:
- captcha.js URL pattern
- WASM SHA-256
- WASM size

### Step 2: Extract New Bundle AppID (30 min)

Capture 3-5 Bundle#1 → OB#1 responses; compare segment #3:

```bash
node decode_response.js TAG bundle1_response.json
# Find the 12-20 char all-lowercase alnum segment = Bundle AppID
```

### Step 3: Extract New FT (15 min)

```bash
grep -o "ft=[0-9]*" bundle1_request.txt
# Expected: ft=388 or ft=XXX
```

### Step 4: Extract WASM Constants (1-2 hours)

```bash
wabt-objdump -j data px_captcha.wasm > wasm_data_dump.txt
diff old_wasm_data_dump.txt wasm_data_dump.txt
# Find 32-byte ChaCha20 seed + custom alphabet + HMAC key
```

### Step 5: Adapt OB Handler Shape (30 min)

```bash
node decode_response.js NEW_TAG bundle1_response.json | jq '.segments | length'
# Expected 13 ± 2
```

### Step 6: Rebuild Bundle Field Template (2-4 hours)

```bash
# Capture 6 batches
for i in 1 2 3 4 5 6; do
    python capture_bundle_via_cdp.py --site target-site --out bundle_samples/$i/
    sleep 60   # IP throttling
done

# Decode
for i in 1 2 3 4 5 6; do
    node decode_payload.js bundle_samples/$i/bundle2_request.txt \
        > bundle_samples/$i/decoded_bundle2.json
done

# Three-class field classification
node diff_samples.js bundle_samples/{1..6}/decoded_bundle2.json > field_classes.json

# state.* → EV2 b64 key mapping
python find_state_keys.py bundle_samples/ > state_key_map.json
```

### Step 7: End-to-end Test (30 min)

```bash
node generators/new_platform_bundle.js
# Expected: 5 runs all obtain _px3 + business API 200

for i in {1..10}; do
    sleep 30
    node generators/new_platform_bundle.js
done
# Expected 10/10
```

## 14.3 Common Cross-Platform Traps

| Trap | How to detect |
|---|---|
| Bundle AppID extracted wrong (used init AppID) | OB#1 segment #3 is 12-20 all-lowercase |
| FT wrong (used Collector's 401) | Bundle#2 immediate 400 |
| state.* → EV2 key used iFood's | Bundle#2 returns 200 but OB#2 has no _px3 |
| WASM constants not updated | b() output doesn't match real captures |
| Myanmar encoding template not updated | Bundle#3 returns 422 |
| Error stack uses iFood's captcha.js line numbers | Bundle#3 returns 403 |

---

# Part 15: Complete Gotcha Index

Full 20-entry Bundle-specific gotcha list with detailed symptoms/root causes/fixes is in [`../../bug_report/2_bundle_path.md`](../../bug_report/2_bundle_path.md). This section is a summary + severity index.

| # | Severity | Title | One-liner |
|---|---|---|---|
| B1 | ⭐⭐⭐ | `_pxUuid` before WASM init | `globalThis._pxUuid = uuid` must precede WASM instantiate |
| B2 | ⭐⭐⭐ | `instanceof_Window` must return 1 | Node mock mandatory |
| B3 | ⭐⭐ | WASM internal constants vary per version | ChaCha20 seed / alphabet / HMAC key differ per version |
| B4 | ⭐ | WASM b() output isn't base64 | Custom alphabet `/=+!1@2#3$4%5^6&7*8(9)0-` raw fill |
| B5 | ⭐⭐⭐ | PoW must be synchronous SHA-256 | `crypto.createHash`, not `crypto.subtle.digest` |
| B6 | ⭐⭐ | Handler params deliberately reordered | `Bs(t,e,n,r,a)` internal call order ≠ param order |
| B7 | ⭐⭐ | Bundle AppID ≠ Init AppID | Bundle uses OB#1-issued |
| B8 | ⭐⭐⭐ | Bundle#3 event order sensitive | 5 events can't reorder |
| B9 | ⭐⭐ | All 4 bundles use the same UUID | Can't switch |
| B10 | ⭐⭐ | "Send Bundle#4?" depends on scale | Don't for small; must for large |
| B11 | ⭐⭐⭐ | Press duration must be 1-3s | `< 0.5s` or `> 5s` rejected |
| B12 | ⭐⭐ | Mouse coordinates must be floats | `clientX = 320.5`, not `320` |
| B13 | ⭐⭐ | Mouse trajectory ts overlaps press | `mouseEndTs ≈ pointerDown.ts ± 200ms` |
| B13a | ⭐⭐ | Explicit `pressDuration` = `ts diff` | Must equal the event timestamp delta |
| B14 | ⭐ | Myanmar DOM encoding | DOM tag → JSON → XOR(4210) → b64 → U+1000-U+109F |
| B15 | ⭐ | Error stack must have 4 groups | Single group = bot |
| B16 | ⭐ | `captcha.js` can't cache across sessions | Re-download per new session |
| B17 | ⭐ | `captcha.js` filename unstable | Hash suffix changes |
| B18 | ⭐⭐ | PoW cache leaks across sessions | Cache key must include session UUID |
| B19 | ⭐⭐ | Trajectory pool too small; clustered | 5 → 50-100 |

---

# Part 16: SDK Drift Response

PX's "dual paths" introduce a special maintenance headache: **Collector and Bundle have different upgrade cadences**.

## 16.1 Upgrade Frequency Comparison

| File | Upgrade frequency | Impact |
|---|---|---|
| `main.min.js` (Collector SDK) | 1-2× per month | Silent path requires re-calibrating b64 keys |
| `captcha.js` (Bundle SDK) | **Every 2-3 weeks** | Bundle full stack + WASM must be re-extracted |
| `px_captcha.wasm` | Same cadence as captcha.js | ChaCha20 seed / alphabet both change |

⚠️ Bundle upgrades at 2-3× the Collector cadence. If your generator supports both paths, you need **two separate SDK_INFOs**.

## 16.2 Maintain Two SDK_INFOs

```
stample/
├── ifood/
│   ├── source/
│   │   ├── main.min.js
│   │   └── SDK_INFO.md       ← Collector SDK info
│   └── ...
└── bundle/
    ├── source/
    │   ├── captcha.js
    │   ├── px_captcha.wasm
    │   └── SDK_INFO.md       ← Bundle SDK info ⭐ separate
    └── ...
```

`bundle/source/SDK_INFO.md` should contain:
- captcha.js SHA-256 + size
- WASM SHA-256 + size
- WASM ChaCha20 seed (hex)
- WASM custom alphabet
- Bundle AppID extraction position
- captcha iframe DOM node tag counts (Myanmar template)
- Chrome major version at the time (corresponds to error stack template)

## 16.3 Chrome-Version-Bound Error Stack Templates

⚠️ Error stack line numbers come from V8; V8's different function-inlining strategies → frame count and line-number positions change. captcha.js's PX validation logic uses **"expected stack shape" designed for the contemporary mainstream Chrome major**.

```
error_stack_templates/
├── chrome_140.json
├── chrome_142.json
├── chrome_145.json       ⭐ current mainstream
├── chrome_148.json       ⭐ current mainstream
└── chrome_150.json
```

In the generator:

```js
function pickErrorStackTemplate(ua) {
    const match = ua.match(/Chrome\/(\d+)/);
    if (!match) throw new Error('UA must contain Chrome version');
    const major = parseInt(match[1]);
    const available = [140, 142, 145, 148, 150];
    const closest = available.reduce((a, b) =>
        Math.abs(b - major) < Math.abs(a - major) ? b : a
    );
    return require(`./error_stack_templates/chrome_${closest}.json`);
}
```

**Rule**: whatever Chrome major your impersonated UA is, every "Chrome behavior template" (error stack / V8 error message format / performance.memory ranges) must match that version.

## 16.4 WASM Constant Update Detection SOP

```
1. Capture new captcha.js
   ↓
2. SHA differs from old? Changed?
   ↓ Yes
3. Extract new WASM (Us()[10] position may change)
   ↓
4. WASM SHA differs from old? Changed?
   ↓ Yes
5. Extract .data segment with wabt; diff against old
   - ChaCha20 seed (32 bytes) changed?
   - Custom alphabet (24 chars) changed?
   - HMAC key changed?
   ↓
6. Run end-to-end test, check b() output
   ↓ Wrong
7. Re-analyze WASM (high cost, 1-2 days)
```

**Practical experience**: how often do constants change?
- ChaCha20 seed: often (per build)
- Custom alphabet: occasionally (half-yearly)
- HMAC key: rarely

## 16.5 Cookie TTL Mid-job Expiry Handling

⚠️ `_px3` / `_px2` has a TTL (330s / 500s); long-running tasks must actively refresh (gotcha #33).

```js
class CookieManager {
    constructor() {
        this.cookies = new Map();   // sessionId → { value, expiresAt }
    }

    set(sessionId, cookie, ttl) {
        this.cookies.set(sessionId, {
            value: cookie.value,
            expiresAt: Date.now() + ttl * 1000,
        });
    }

    get(sessionId) {
        const c = this.cookies.get(sessionId);
        if (!c) return null;
        if (Date.now() > c.expiresAt - 30_000) {  // refresh 30s early
            return null;   // trigger refresh
        }
        return c.value;
    }
}
```

---

# Part 17: iFood Business + Anti-bot Layer

Bundle is part of PX's anti-bot stack, but running it in iFood's business requires also understanding the business protocol + the anti-bot hook entries.

## 17.1 iFood Business API Analysis

**Main API**: `https://cw-marketplace.ifood.com.br/v2/bm/home` (see §17.5 for actual v1/v2 distribution)

**Request mode**: `cors`
**Referrer**: `https://www.ifood.com.br/`
**ReferrerPolicy**: `strict-origin-when-cross-origin`
**Credentials**: `omit`

### 17.1.1 Key Headers

| Header | Example value |
|---|---|
| `Content-Type` | `application/json` |
| `User-Agent` | Chrome 145.0.0.0 Edge |
| `X-Px-Authorization` | `1` or custom token |
| `Cookie` | `_px3=...; _pxvid=...; ...` |

### 17.1.2 Body Parameters

POST body contains search conditions, address, coupons, restrictions etc. — business fields unrelated to PX anti-bot, but `Cookie: _px3=` is mandatory; without it, 403.

## 17.2 _px3 Generation Behavior Chain

Full generation flow:

```
1. Browser loads ifood.com.br
   ↓
2. PX main.min.js auto-injects
   ↓ POST to collector
3. Collector#1 → _px3 (TTL 330)
   ↓
4. Business API called with _px3
   ↓
5. After ≈200 calls → 403 + blockScript
   ↓
6. captcha.js loads → Bundle flow
   ↓
7. Bundle#3 passes → new _px3 (TTL 330)
   ↓
8. Business API uses new _px3
```

## 17.3 PerimeterX Entry Points (Hook Stack Analysis)

### 17.3.1 How to Locate the PX Entry

```js
// Browser console
Object.keys(window).filter(k => k.includes('handler'));
// → ["_O1GDTa7Qhandler"]   ← PX registered into window

const h = window._O1GDTa7Qhandler;
Object.keys(h);
// → ["PX762", "PX12634", "PX1135"]   ← PoW entry + visual challenge

h.PX1135 === h.PX762;   // → true   ← same function registered twice
h.PX1135.toString();    // → "function Bs(r,n,t){..."   ← inspect source
```

### 17.3.2 Collect Request Chain Analysis

```
User calls business API
  ↓
PX checks whether _px3 is still valid (TTL + jf=success)
  ├── Valid → pass through, business normal
  └── Invalid → trigger collect flow
       ↓
       PX collect runs async via setTimeout (doesn't block business)
       ↓
       1. Collect browser fingerprint (mh main constructor)
       ↓
       2. Async send collector POST
       ↓
       3. Receive response, store new cookie
```

### 17.3.3 ah Function (First Parameter Generation)

PX's `ah(t)` handler sets `ao = t` (HTTP status code):

```js
function ah(t) {
    ao = t;   // global variable ao
}
```

If OB#1 segment 4 is `0III0I00|401` → `ao = "401"`. The generator's mh() uses this value (as a payload internal field).

## 17.4 The Third Collect Reproduction

iFood's Collector path sends 3 POSTs (not 2). The Bundle path sends only 4. Differences:

| Collector path | Bundle path |
|---|---|
| POST#1 (light fingerprint) | Bundle#1 (light fingerprint) |
| POST#2 (heavy fingerprint + cs) | Bundle#2 (heavy fingerprint + PoW + WASM) |
| POST#3 (behavioral tracking EV3) | Bundle#3 (press + mouse) |
| — | Bundle#4 (telemetry) |

The third collect POST is the EV3 event (behavioral tracking — mouse moves, scroll, visibility changes, performance entries). **Although Bundle triggers after ≥200 calls, EV3 still needs to send**.

## 17.5 cw-marketplace vs marketplace TLS Distinction (Critical)

⚠️ iFood's **different subdomains use different CDNs**:

| Subdomain | CDN | TLS check | Reject without _px3? |
|---|---|---|---|
| `marketplace.ifood.com.br` | Akamai | Lenient (doesn't check TLS fingerprint) | Yes |
| **`cw-marketplace.ifood.com.br`** | **Cloudflare WAF** | **Strict** | Yes + TLS consistency |
| `static.ifood.com.br` | Akamai CDN | Static resources; not checked | No |

**Python `requests` TLS fingerprint (curl/OpenSSL) ≠ Chrome's** → Cloudflare detects and rejects regardless of cookie correctness.

**Fix**:

```python
# ❌ Doesn't work for cw-marketplace
import requests
requests.get("https://cw-marketplace.ifood.com.br/...")

# ✅ Use curl_cffi to fake Chrome TLS
from curl_cffi import requests
requests.get("https://cw-marketplace.ifood.com.br/...", impersonate="chrome120")
```

See bug_report `3_environment.md` gotcha #E3.

## 17.6 /v1 vs /v2 API Difference

| Endpoint | Status | Behavior |
|---|---|---|
| `/v1/cardstack/search/home` | ✅ Active | Lenient routing |
| `/v2/cardstack/search/home` | ❌ Deprecated | Cloudflare WAF strict policy → 403 |

⚠️ Gotcha #32. Business API uses `/v1`, not `/v2`.

---

# Part 18: External Resources + Pr0t0ns v8.9.6 Comparison

## 18.1 GitHub Open-Source Projects

| Project | Contents | Value |
|---|---|---|
| `Pr0t0ns/perimeterx-v8.9.6` | Complete PX v8.9.6 reverse-engineering doc (see §18.4) | Cross-version comparison |
| `kasada-bypass` | Reverse of Kasada WAF, similar to PX | Algorithm ideas transferable |
| `px-bypass-research` | Multi-site PX capture samples | Test data sources |

## 18.2 Technical Blog Topics

| Blog topic | One-liner |
|---|---|
| "Crack PX silent mode" | Most cover Collector; few cover Bundle |
| "WASM reverse engineering general method" | Toolchain (wabt / wasm-objdump / wasm2c) |
| "ChaCha20 algorithm implementation" | Used internally by PX WASM |
| "Bezier mouse trajectory synthesis" | Statistical differences between real human and bot trajectories |

## 18.3 WASM Reverse Tools

| Tool | Purpose |
|---|---|
| `wabt` (`wasm2wat`, `wasm-objdump`) | WASM ↔ WAT text conversion + dump |
| `wasm2c` | WASM decompilation to C |
| `wasm-decompile` (binaryen) | Decompile to pseudo-JS |
| `wasm-bindgen-cli` | Generate wasm-bindgen bridge code |
| `chrome-devtools` | Step-through WASM in browser |
| `wasmtime` | CLI to run WASM tests |

## 18.4 Pr0t0ns v8.9.6 Comparison

**Pr0t0ns** is another independent PX reverse-engineering project (targeting v8.9.6 on arcteryx.com), which can be cross-version-compared with our v8.10+ iFood implementation. Full docs in (original materials merged into this document).

### 18.4.1 v8.9.6 vs v8.10+ Key Differences

| Dimension | v8.9.6 (Pr0t0ns) | v8.10+ (iFood current) |
|---|---|---|
| **OB wire characters** | `1` / `o` | `0` / `l` (iFood) / `I` / `o` (Grubhub) |
| **Field keys** | Plaintext `"PX12095"` | base64-encoded |
| **tag** | Plaintext `"v8.9.6"` | base64 `"O2MKZn0OEhI/ag=="` |
| **bi parameter** | None | base64 ~95 bytes |
| **OB XOR key** | `gt="DhY8E0h7J2cKHw=="` → 120 | Different gt → 86/100/91 |
| **Bundle field count** | 12 | 16 |
| **FT (Collector)** | 330 | 401 |

### 18.4.2 v8.9.6 Collector Complete Flow (Reference)

```
POST https://collector-{appid}.px-cloud.net/api/v2/collector

Parameters:
  payload  = encrypt(fingerprint_1)     ← XOR(50) + URL encode + base64 + interleave(20 chars)
  appId    = PXO1GDTa7Q
  tag      = v8.9.6                     ← SDK version (plaintext)
  uuid     = UUID v4
  ft       = 330                        ← Collector
  seq      = 0
  en       = NTA
  pc       = HMAC-MD5 checksum          ← key = "{uuid}:v8.9.6:{ft}"
  sid      = session ID
  vid      = visitor ID
  cts      = client timestamp token
  rsc      = 1
```

**Fingerprint #1 structure (PX12095)**:

```json
[{
    "t": "PX12095",
    "d": {
        "PX11645": "https://www.ifood.com.br",
        "PX12458": "Win32",
        "PX11902": 0,
        "PX11560": 3000,
        "PX12248": 3600,
        "PX11385": 1713737306091,
        "PX12280": 1713737306096,
        "PX11496": "uuid"
    }
}]
```

### 18.4.3 v8.9.6 PC Algorithm (Identical to Current)

```python
def generate_pc(key, fingerprint):
    """
    key = "{uuid}:v8.9.6:{ft}"
    Output: digit string (HMAC-MD5 → extract digits → stride pick)
    """
    ipad = [0x36363636 ^ k for k in word_array(key)]
    opad = [0x5C5C5C5C ^ k for k in word_array(key)]
    inner = MD5(ipad + word_array(fingerprint))
    hmac  = MD5(opad + inner)

    digits = extract_digits(hex(hmac))
    return digits[::2]
```

Identical to v8.10+ — **the algorithm layer hasn't changed in 3 years**.

### 18.4.4 v8.9.6 Field Names vs v8.10+

| Semantic | v8.9.6 (plaintext) | v8.10+ (base64) |
|---|---|---|
| URL | `PX11645` | `WQ0oDx9mKjg=` |
| platform | `PX12458` | `EFQhFlU9Iiw=` |
| Counter | `PX11902` | `KDxZPm5YXw4=` |
| Random | `PX11560` | `MVUAV3c9AGU=` |
| Fixed 3600 | `PX12248` | `Y1tSWSY0UGM=` |
| Start timestamp | `PX11385` | `InpTeGQUXU8=` |
| End timestamp | `PX12280` | `eW1ILzwCRh0=` |
| UUID | `PX11496` | `FUlkS1Mga38=` |

**How to use the comparison**: when something is unclear in our current v8.10+ doc, check the v8.9.6 version — the algorithm layer changes rarely; seeing the v8.9.6 implementation cross-validates.

## 18.5 Industry Bundle Progress

```
2023 — Bundle path first mentioned publicly (Pr0t0ns forum)
2024 Q1 — WASM added to captcha.js
2024 Q3 — Mouse Bezier constraints tightened
2025 Q1 — Myanmar DOM encoding appears
2025 Q3 — Error stack 4 groups becomes mandatory
2026 Q1 — iFood Bundle completely reversed (this project)
```

---

# Part 19: Project Work Log

## 19.1 Complete Project File Index (Source Project)

```
ifood_PerimeterX-WAF_jsReverse/
│
├── main.js                      # PX bundle main script (10,653 lines, obfuscated)
│                                  Key positions: Ql(3933), ih(4310), oh(4276),
│                                  hr(1012), qu(2537), os(2589), ss(2610)
│
├── captcha.js                   # PX captcha module (10,492 lines, obfuscated; filename rotates!)
│                                  Key positions: sha256(~7000), poi(7165), ws(7171),
│                                  Ks(7176), Bs(7411), registration(10348)
│
├── px_captcha.wasm              # Extracted WASM binary (~60 KB)
│                                  Exports: a() → PX12590, b(input) → PX12610
│
├── documents.md                 # Comprehensive technical reference doc (~1,800 lines)
│
├── BUNDLE_COMPLETE_ANALYSIS.md  # Complete knowledge graph (2,036 lines)
│
├── CLAUDE.md                    # Claude project config
│
├── js_reverse/
│   ├── ob_handlers.js           # ★ Full restoration: decoder + 27 handlers + PoW solver
│   │                              Exports: decodeOb, processOb, Ql, ih, solvePow, poi
│   ├── cookie_hook.js           # Tampermonkey script: hook _px3 cookie writes
│   ├── 第三个接口复用.js          # Collector #3 request analysis
│   └── 多维度对比collect请求链.js  # Multi-collect request comparison
│
├── utils/
│   ├── decode_ob.js             # ob response decoder module
│   ├── decode_ob_bundle1.js     # Bundle #1 decoding test
│   ├── decode_ob_bundle2.js     # Bundle #2 decoding test
│   ├── test_handlers.js         # Handler integration tests
│   ├── decode_bundle2_request.js # Bundle #2 request full decode
│   ├── parse_bundle2_full.js    # Bundle #2 payload full parse
│   ├── bundle2_raw.txt          # Bundle #2 raw POST body
│   ├── bundle2_decoded.json     # Bundle #2 decoded result JSON
│   ├── extract_wasm.js          # WASM extractor (10 decode paths)
│   ├── run_wasm.js              # WASM runner (initWasm → {a, b})
│   ├── run_wasm_debug.js        # WASM debug version (trace all wbg calls)
│   └── trigger_captcha.js       # Infinite-loop request to trigger captcha
│
└── test/
    └── ifood_intercept.js       # CDP intercept replacing main.min.js
```

## 19.2 7 Breakthrough Moments

Key discoveries during the reverse engineering process:

| # | Moment | Breakthrough |
|---|---|---|
| 1 | 2025-12 | Confirmed Bundle path uses `/assets/js/bundle`, not `/api/v2/collector` |
| 2 | 2026-01 | Solved OB uses 4 tildes (not 3) as separator |
| 3 | 2026-01 | Confirmed `cs` is server-issued via OB#1 III000 handler, not client-computed |
| 4 | 2026-01 | `state.no` must parseInt (countless people debug here for a week) |
| 5 | 2026-02 | PoW must use `crypto.createHash` sync API (async 600s+) |
| 6 | 2026-02 | WASM `__wbg_instanceof_Window` must return 1; `globalThis._pxUuid` must be set before instantiate |
| 7 | 2026-02 | Bundle#3 5-event order sensitive + PX561 95-field Tier 1-5 fully cracked |

## 19.3 ROI Assessment

| Path | One-time reverse cost | Cross-platform porting cost | Long-term maintenance |
|---|---|---|---|
| Silent Collector | 1 week | 1 day/site | 1/month |
| Press Bundle | **3-4 weeks** (WASM + mouse + DOM) | 1 week/site | 1 / 2-3 weeks |
| Userscript (alternative) | 1 day | 1 day/site | Auto-adapts to SDK |

**Conclusion**:
- Single site: Userscript best ROI
- Multi-site + high concurrency: pure-algo Bundle necessary
- Medium scale (5-20 sites): hybrid (cookie via Userscript, large-scale data via Collector + Bundle fallback via Userscript)

## 19.4 Pending Items

### Done ✓

- [x] Bundle #1 Request: URL, Headers, POST params, Payload full structure
- [x] Bundle #2 Request: POST param differences, Payload decryption (80+ browser fingerprint fields)
- [x] cs source confirmed: server OB response III000 handler
- [x] pc algorithm confirmed: HMAC-MD5(salt="uuid:tag:ft", data=JSON(events)) → extract + stride
- [x] sid steganography confirmed: Unicode Tag Characters (U+E0130 series) encode cts timestamp
- [x] Jf() interleave: payload = base64(XOR(JSON,50)) + UUID-driven char interleave (offsets[i]-1)
- [x] bi / tag source: both script-hardcoded
- [x] /ns endpoint: return value goes into payload field (Sm), not cs param
- [x] Bundle URL & Headers: `/assets/js/bundle`, `application/x-www-form-urlencoded`
- [x] Fingerprint field mapping: Bundle #1 first 12 = Collector PX12095; Bundle #2 = 80+ browser fingerprint
- [x] Jf() interleave reverse: de-interleave implemented
- [x] **Bundle #3 5 events + PX561 95 fields Tier 1-5 fully cracked**
- [x] **WASM a()/b() fully reproduced in Node.js**

### Pending

- [ ] **Trajectory pool expansion**: 5 → 50-100 trajectories
- [ ] **Multi-Chrome-version error stack template library**
- [ ] **Automated WASM constant update detection**
- [ ] **Cross-platform port to Grubhub Bundle** (if triggered)
- [ ] **Visual challenge PX12634 complete logic** (puzzle and other types)
- [ ] **ss() callback logic**: how PoW result encodes into Bundle #2

---

# Part 20: Mobile SDK Comparison

PX isn't only Web; it also has Android/iOS Mobile SDK. **The algorithm layer is completely different**; here's a brief comparison.

## 20.1 vs Web SDK

| Dimension | Web SDK | Mobile SDK |
|---|---|---|
| **AppID** | `PXO1GDTa7Q` | `PXO97ybH4J` (Grubhub mobile) |
| **Endpoint** | `/api/v2/collector` or `/assets/js/bundle` | `/api/v1/collector/mobile` |
| **Payload type** | PX12095/PX11590/PX11547 | PX315/PX329 |
| **Encryption** | XOR(50) + base64 + interleave | base64 (**no XOR**, **no interleave**) |
| **PoW** | SHA-256 brute force | math switch-case |
| **WASM** | Embedded in captcha.js | **No WASM** |
| **TLS** | Chrome TLS | okhttp3 TLS |

## 20.2 Mobile PoW Algorithm

Completely different from Web's SHA-256 brute force; Mobile uses **math switch-case**:

```java
// Input format: appc|2|timestamp|hash|n1|n2|n3|n4|n5|n6
// Algorithm: pow(pow(n3, n4, n1, n6), n5, n2, n6)

int pow(int i12, int i13, int i14, int i15) {
    int op = (i15 % 10 != 0) ? i14 % (i15 % 10) : i14 % 10;
    switch (op) {
        case 0: return i13 + i12*i12;
        case 1: return i12 + i13*i13;
        case 2: return i13 * i12*i12;
        case 3: return i13 ^ i12;
        case 4: return i12 - i13*i13;
        case 5: int t = i12+783; return t*t + i13*i13;
        case 6: return i13 + (i12^i13);
        case 7: return i12*i12 - i13*i13;
        case 8: return i13 * i12;
        case 9: return (i13*i12) - i12;
    }
}

// PX257 = ByteBuffer.wrap(modelBytes).getInt() ^ powResult
```

The Mobile path **has no WASM, no press challenge, no mouse trajectory**. Overall complexity is lower than the Web Bundle path.

## 20.3 When to Care About Mobile SDK

- When reverse-engineering iFood/Grubhub Android apps
- When reverse-engineering iOS apps (similar okhttp behavior synthesis)
- Out of scope here (this document only covers Web)

---

# Appendix A — Constant Quick Reference

## A.1 iFood Bundle Complete Constants

```
Init AppID:        PXO1GDTa7Q
Bundle AppID:      PXd6f03jmq8h6c7382req0 (per-session decoded from OB#1; example session value)
TAG:               U0MmDhUmOnhXSw==  (Collector) / "O2MKZn0OEhI/ag==" (Bundle)
FT (Collector):    401
FT (Bundle):       388
Cookie:            _px3 (TTL 330s)
Collector URL:     https://collector-pxo1gdta7q.px-cloud.net/api/v2/collector
Bundle URL:        https://collector-pxo1gdta7q.px-cloud.net/assets/js/bundle
captcha.js URL:    https://client.px-cloud.net/PXO1GDTa7Q/captcha.js
main.min.js URL:   https://client.px-cloud.net/PXO1GDTa7Q/main.min.js
WASM location:     captcha.js Us()[10] base64
WASM size:         ~60862 bytes
WASM magic:        0061736d 01000000

OB XOR key:        ml(TAG) % 128 = 100 (iFood) / 91 (Grubhub) / 120 (v8.9.6 legacy)
OB delim:          ~~~~ (4 tildes)
OB handler count:  27 (Collector) / 29 (Bundle, +2 PoW dispatch)
OB wire chars:     0 + l (iFood new) / o + I (Grubhub legacy) / 1 + o (v8.9.6)

PoW difficulty:    16 bits (= 4 hex chars match)
PoW iterations:    ~65536 average
PoW time:          9-60ms (sync Node) / 600s+ (async)
PoW maxCounter:    1 << 16 = 65536

WASM custom alphabet: /=+!1@2#3$4%5^6&7*8(9)0-
Myanmar base:      U+1000 (4096)
Myanmar XOR key:   4210

Bundle#1 field count:   16
Bundle#2 field count:   228
Bundle#3 field count:   5 events: PX10498/PX561/PX10496/PX535/PX11116
                                  or [browserFp, mouseout, PX561, onSolved, PX11994]
  PX561 field count:    95
  PX561 Tier breakdown: T1 hardcoded 50 + T2 simple live 25 + T3 Session 15 + T4 trajectory 5 + T5 WASM 3 = 98
Mouse trajectory points: 544 (full) / 150 (filtered) / 25 (subset)
Press duration:    1000-3000ms
Mouse coord precision: 1 decimal place (offsetX/Y float)
Error stack groups: 4
Error stack matching: Chrome major bound (140/142/145/148/150)

PX default fallback ts: 1604064986000 (2020-10-30T17:16:26Z)
```

## A.2 Algorithm Magic Constants (Identical Across Versions/Sites)

```
MD5 init A:        1732584193  (0x67452301)
MD5 init B:        -271733879  (0xEFCDAB89, signed)
MD5 init C:        -1732584194 (0x98BADCFE, signed)
MD5 init D:        271733878   (0x10325476)
HMAC ipad:         909522486   (0x36363636)
HMAC opad:         1549556828  (0x5C5C5C5C)
UUID v1 epoch:     122192928e5 (Gregorian → Unix conversion constant)
INT32_MAX:         2147483647  (ml() hash function)
base91 alphabet:   F@bt...     (newer PX SDK; older versions may differ)
XOR(50) for payload: 50         (constant, cross-version)
XOR(10) for interleave key: 10  (constant)
XOR(120) for OB:   dynamic (ml(gt) % 128)
```

## A.3 Major main.js Function Locations

| Function | Line | Functionality |
|---|---|---|
| `Ql` | 3933-4239 | Handler registry (27 entries) |
| `ih()` | 4310-4339 | OB segment processor (dispatch) |
| `mh()` | 4384-4444 | POST parameter constructor |
| `Jf()` | 3128-3171 | payload encryption + interleave |
| `jt()` | 596-609 | PC computation (HMAC-MD5 variant) |
| `hh()` | 4366-4373 | sid steganography |
| `Ho()` | 1415-1417 | cs accessor (return qa) |
| `it()` | 299-329 | Custom JSON serialize |
| `ee()` | 666-670 | XOR encode/decode |
| `R()` | 75-84 | MD5/HMAC-MD5 |
| `Am()` | 8376-8406 | /ns endpoint request |
| `oh()` | 4276-4309 | Set _px3 cookie |
| `fh()` | 4361 | Set to/eo |
| `ch()` | 4344 | Set no/ro |
| `ah()` | 4273 | Set ao |
| `hr()` | 1012-1034 | Cookie write |
| `sr()` | 1002-1005 | Cookie delete |
| `Xr()` | 1171-1187 | Cookie config storage |
| `qu()` | 2537-2542 | PoW challenge entry (backup) |
| `os()` | 2589-2597 | PoW worker startup |
| `ss()` | 2610-2612 | PoW result callback |
| `ds()` | 2659-2664 | PX763 callback |
| `zu()` | 2516-2521 | PX1145 notification |
| `ls()` | 2617-2620 | Get captcha module |
| `bu()` | 2462-2464 | captcha loaded? |
| `Rr` | 1138-1165 | Constant table ("cc") |

## A.4 captcha.js Function Locations

| Function | Line | Functionality |
|---|---|---|
| `sha256()` | ~7000-7164 | Pure JS SHA-256 |
| `poi()` | 7165-7170 | PoW single attempt |
| `ws()` | 7171-7175 | Web Worker loop |
| `Ks()` | 7176-7219 | Create Web Worker |
| `Ts()` | 7406-7410 | Store PoW result |
| `Bs()` | **7411-7524** | **Complete PoW solver** |
| Handler registration | 10348 | `window._O1GDTa7Qhandler = {PX762, PX1135, PX12634}` |

---

# Appendix B — Debug Command Reference

## B.1 Decode Commands

```bash
# Decode Bundle#1 payload
node skill/AI_re/scripts/decode_payload.js bundle1_request.txt

# Decode Bundle OB response
node skill/AI_re/scripts/decode_response.js U0MmDhUmOnhXSw== bundle1_response.json

# Extract WASM
node bundle/script/extract_wasm.js captcha.js

# Run WASM
node bundle/script/run_wasm.js px_captcha.wasm <pow_answer>

# Run PoW
node -e "console.log(require('./revers/pow.js').solvePoW('7e3b', 'a3f5d7e9b1c2...', 16))"
```

## B.2 SHA Verification

```bash
# Is captcha.js still the current version?
sha256sum stample/bundle/source/captcha.js

# Is WASM still the current version?
sha256sum stample/bundle/source/px_captcha.wasm

# Extract WASM data section (check whether ChaCha20 seed changed)
wasm-objdump -j data px_captcha.wasm | head -50
```

## B.3 Capture

```bash
# CDP-capture full Bundle flow
python skill/cdp/scripts/capture_via_cdp_ifood_bundle.py \
    --target https://www.ifood.com.br/ \
    --burst-trigger \
    --out bundle_samples/N/
# To trigger the challenge, burst first (200+ rapid requests to push risk score over threshold)
```

## B.4 Compare With Production

```bash
# My Bundle#2 vs real captures
python stample/bundle/script/compare_bundle2.py /tmp/my_bundle2.json bundle_samples/1/bundle2_request.txt

# Field-level diff
python stample/bundle/script/diff_http.py /tmp/my_bundle2_request.txt bundle_samples/1/bundle2_request.txt
```

## B.5 Quick Browser Console Validation

```js
// 1. Find PX handler
Object.keys(window).filter(k => k.includes('handler'));
// → ["_O1GDTa7Qhandler"]

// 2. View registered functions
const h = window._O1GDTa7Qhandler;
Object.keys(h);   // → ["PX762", "PX12634", "PX1135"]

// 3. View Bs source
h.PX1135.toString();

// 4. Capture _px3 cookie writes
const orig = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
Object.defineProperty(document, 'cookie', {
    get: () => orig.get.call(document),
    set(v) {
        if (v.startsWith('_px3=')) console.log('_px3:', v);
        orig.set.call(document, v);
    }
});

// 5. Run WASM and observe output
window._pxUuid = 'test-uuid';
// Then let PX SDK load naturally → check console
```

---

# Appendix C — Relationship to Other Project Parts

```
perimeter/
│
├── main/                  Complete docs (silent path mainly; Bundle briefly in §3)
│   └── ZH/PX_SDK_逆向技术文档.md
│
├── revers/                ⭐ 9 algorithm modules (payload/pc/ob/sid/uuid/hash/memory/antitamper/ns)
│   │                        Bundle reuses 7
│   │                        Bundle missing: pow.js, wasm.js (pending)
│
├── skill/
│   ├── AI_re/              AI agent reverse skill (mentions Bundle)
│   └── cdp/                Capture skill (Bundle also uses)
│
├── stample/
│   ├── ifood/              iFood silent path generator + source + script + sample
│   └── grub/               Same for Grubhub
│
├── bundle/                ⭐ Bundle path (this document's home; archived)
│   ├── README.md          Archive notes
│   ├── doc/
│   │   └── Bundle_完整技术文档.md      ⭐ This document (5,070 lines)
│   ├── source/                          captcha.js + px_captcha.wasm + SDK_INFO.md + WASM_ANALYSIS.md
│   ├── stample/
│   │   ├── sample/                      8 raw captures (4 Bundle POST + 4 OB responses)
│   │   ├── decoded/                     8 decode outputs (4 EV JSON + 4 state JSON)
│   │   └── mouse_tracks/                51 files (50 real mouse trajectories + mouse_pool.json)
│   └── script/userscripts/
│       └── px_bundle3_auto.user.js     ⭐⭐⭐ Production 10/10 userscript (2,131 lines)
│
└── bug_report/             Complete 68-gotcha collection
    └── 2_bundle_path.md    Bundle-specific 20 entries
```

**Companion relationships**:

| What I want to do | Where to go |
|---|---|
| See Bundle overall | This doc §1-2 |
| Write Bundle generator | This doc §3-9 (read Bundle#1→#2→#3 in order) + revers/ modules |
| See meaning of each of 229 fields | This doc §10 (17-category enumeration) |
| Source-level encryption chain | This doc §11 (Jf/jt/it/ee/hh full restoration) |
| Run tests | Pending bundle/script/ + bundle/stample/ |
| Troubleshoot cookie failure | This doc §15 + `bug_report/2_bundle_path.md` |
| Cross-platform porting | This doc §14 |
| SDK upgraded | This doc §16 + skill/AI_re/playbooks/identify-sdk-version.md |
| Industry PX v8.9.6 materials | This doc §18 (Pr0t0ns full comparison merged in) |
| Mobile SDK | This doc §20 |

---

## Document Version + Maintenance Notes

| Item | Value |
|---|---|
| Version | v2.0 (detailed) |
| Authored | 2026-05-21 |
| Line count | ~5500+ |
| Verified SDK version | iFood `b47a639c…` (Collector) + matching captcha.js (Bundle) |
| Verified status | 10/10 production-pass (incl. Userscript + partial pure-algo) |
| Next major revision | When PX pushes an SDK major version (typically 3-6 months) |

**Source materials**: this document is the digested merge of 31 source documents (12,000+ lines). The originals were deleted after merge (per the "redundant with silent path → trimmed" principle). Original file sources:
- Main EN 13 (perimeterX_Re/docs/04_bundle)
- Field tables + gotchas 4 (perimeter_X/docs/zh)
- Chinese pedagogical 4 (Desktop 新建文件夹 (4)/docs)
- Deep-Dive 7 (perimeter_X/docs/references)
- Industry perspective 3 (ifood-web production project)

To trace which segment came from which original document, the git history (`sourcing-cracked` repo before commit `007623b`) or the `warterbili/px3cookie` GitHub repo still retains the full originals.

This document is the **digested merge** of those 31, reorganized along "understand first, then do" lines. For specific detail citations, look directly at the corresponding chapter in (original materials merged into this document); this doc is responsible for stringing them together into a coherent narrative.

---

*Fin.*
