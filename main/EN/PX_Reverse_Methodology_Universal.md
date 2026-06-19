# PerimeterX SDK Universal Reverse Engineering Methodology

> Goal: given **any version** of a PX SDK (main.min.js / init.js / captcha.js),
> locate every key algorithm, handler, decoder function, and protocol constant
> in 30 minutes.
>
> Core principle: **never depend on anything that changes**.
> - ❌ No line numbers (shift on every release)
> - ❌ No variable names (obfuscator renames them all)
> - ❌ No function names (same)
> - ✅ Use RFC standard magic constants
> - ✅ Use protocol string literals
> - ✅ Use native browser API names
> - ✅ Use algorithm control-flow patterns
> - ✅ Use argument shapes (not handler names)

---

## Table of Contents

- [0. Core principle: what's stable, what isn't](#0-core-principle-whats-stable-what-isnt)
- [1. Preparation](#1-preparation)
- [2. The cross-version invariants](#2-the-cross-version-invariants)
- [3. Locating cryptographic primitives (6)](#3-locating-cryptographic-primitives-6)
- [4. Locating PX custom algorithms (8)](#4-locating-px-custom-algorithms-8)
- [5. Locating protocol constants](#5-locating-protocol-constants)
- [6. Locating entry & dispatch functions](#6-locating-entry--dispatch-functions)
- [7. hP/hM/hQ dictionary extraction & reverse lookup](#7-hphmhq-dictionary-extraction--reverse-lookup)
- [8. The 5 EV field locating techniques](#8-the-5-ev-field-locating-techniques)
- [9. Universal handler shape-matching table](#9-universal-handler-shape-matching-table)
- [10. Three-way field classification method](#10-three-way-field-classification-method)
- [11. Standard end-to-end flow (new SDK in 30 minutes)](#11-standard-end-to-end-flow-new-sdk-in-30-minutes)
- [12. Troubleshooting decision tree](#12-troubleshooting-decision-tree)
- [13. Tool script reference](#13-tool-script-reference)
- [Appendix A: Complete grep pattern index](#appendix-a-complete-grep-pattern-index)
- [Appendix B: Complete magic constant index](#appendix-b-complete-magic-constant-index)
- [Appendix C: Complete protocol string index](#appendix-c-complete-protocol-string-index)
- [Appendix D: Cross-version stability matrix](#appendix-d-cross-version-stability-matrix)
- [Appendix E: 30-minute new-SDK locating checklist](#appendix-e-30-minute-new-sdk-locating-checklist)

---

## 0. Core principle: what's stable, what isn't

PX ships a new `main.min.js` every ~3 months and `captcha.js` updates
every 2-3 weeks. Each update **invalidates** all of:

| What breaks | Frequency |
|---|---|
| All variable names (e.g. `jE`, `hQ`, `Dd`) | Every release |
| All function names (e.g. `mh`, `Jf`, `ml`) | Every release |
| All line numbers | Every release |
| hQ dictionary entry order | Often |
| Handler wire bytes (e.g. `0lll000l`) | Occasionally |
| EV field b64 keys | Across major versions |

But the following **never change** (or change once in years):

| What's stable | Why |
|---|---|
| RFC standard algorithm constants | Change them and the algorithm breaks |
| Protocol strings `~~~~` / `\|` | Server-side hardcoded; client must match |
| Native browser API names | Change them and you can't call them |
| Algorithmic control-flow patterns | Algorithm itself doesn't change |
| Handler argument shapes | Change them and the protocol breaks |

**Conclusion: ground every locating step on stable elements** — and your
methodology survives across versions.

---

## 1. Preparation

### 1.1 Download the SDK

The main PX SDK lives at `https://client.px-cloud.net/<APP_ID>/main.min.js`:

```bash
# Open DevTools → Network in the browser, find a request to client.px-cloud.net, copy the URL
curl 'https://client.px-cloud.net/<APP_ID>/main.min.js' > main.js
wc -c main.js   # typically 230-280 KB
```

The press-challenge SDK lives at `https://client.px-cloud.net/<APP_ID>/captcha.js`:

```bash
curl 'https://client.px-cloud.net/<APP_ID>/captcha.js' > captcha.js
wc -c captcha.js   # typically 220-260 KB
```

### 1.2 Capture real traffic

Use CDP (Chrome DevTools Protocol) attached to real Chrome — **NOT
Selenium/Playwright** (they leak webdriver markers).

Capture 6+ batches of cold-visit traffic; each batch contains:

```
request_1.txt    # POST #1 full curl
response_1.txt   # response body
request_2.txt    # POST #2 full curl
response_2.txt   # response body
meta.json        # uuid, ts, SDK SHA-256
```

Why 6 batches: 3 isn't enough to reliably classify STATIC vs DYNAMIC; 6
makes the mode-value template work.

### 1.3 Base tooling

Any Node.js environment + a couple of standard packages:

```bash
npm install crypto-js   # for MD5/HMAC
# Node built-in `crypto` / `Buffer` cover everything else
```

---

## 2. The cross-version invariants

Ranked by obfuscation resistance:

| Priority | Type | Example | Why stable |
|---|---|---|---|
| ⭐⭐⭐⭐⭐ | RFC standard constants | MD5 init `1732584193`, HMAC pad `909522486`, UUID Gregorian `122192928e5` | RFC-mandated; change them and the algorithm fails |
| ⭐⭐⭐⭐⭐ | Protocol delimiters | `~~~~`, `\|` | Hardcoded server-side |
| ⭐⭐⭐⭐ | Browser API names | `navigator.platform`, `performance.now` | Can't rename native methods |
| ⭐⭐⭐⭐ | Algorithm control flow | `split("\|").shift()`, `charCodeAt^k`, `31*acc+charCodeAt` | The algorithm itself doesn't change |
| ⭐⭐⭐⭐ | Algorithm magic constants | `2147483647` (INT32_MAX), `0xE0100` (Plane 14 start), `2863` (hash factor) | PX-specific, but identical across versions |
| ⭐⭐⭐ | Protocol endpoint URLs | `tzm.px-cloud.net/ns`, `/api/v2/collector` | Endpoints can't change arbitrarily |
| ⭐⭐ | EV b64 keys | `RTEwewNQMUg=`, `NSEAa3NAC18=` | Stable across minor versions; may rotate across major |
| ⭐⭐ | Handler shape | "1 arg + 13 digits = state.no" | Protocol shape is stable; wire bytes vary |
| ⭐ | Function-name prefixes | `h*` globals, `q*` getters | Group structure stable; specific names not |
| ✗ | Variable / function names | `hQ`, `mh`, `jt` | Fully rotated each obfuscation |
| ✗ | Line numbers | "L596" | Shift on every release |

---

## 3. Locating cryptographic primitives (6)

PX uses 6 crypto/hash primitives. Every one can be grepped directly via
an RFC standard constant.

### 3.1 MD5 — grep the init constant

```bash
grep -nE "1732584193" main.js
```

Hits one line of the form:

```js
var ... = 1732584193, ... = -271733879, ... = -1732584194, ... = 271733878;
//         ↑           ↑                ↑                  ↑
//         A           B                C                  D
```

**Why stable**: these 4 numbers are the MD5 RFC 1321 A/B/C/D init values.
Every MD5 implementation has them. Even if PX hand-wrote their own
obfuscated MD5, these 4 numbers can't change.

The 64 round constants are also visible (`-680876936` is the first one)
but you don't need to grep them all.

### 3.2 HMAC — grep the ipad / opad

```bash
grep -nE "909522486" main.js     # ipad (0x36363636)
grep -nE "1549556828" main.js    # opad (0x5C5C5C5C)
```

Hits 2 adjacent lines:

```js
h[e] = 909522486 ^ r[e],
i[e] = 1549556828 ^ r[e];
```

**Why stable**: HMAC RFC 2104 standard pad masks.

### 3.3 XOR cipher — grep `charCodeAt ^`

```bash
grep -nE "charCodeAt\([^)]+\)\s*\^" main.js
grep -nE "\^\s*[a-z]\.charCodeAt" main.js
```

Multiple hits; differentiate by context:

| Context | Usage |
|---|---|
| `^ 50` or `^ "2"` (ASCII 50 = `"2"`) | Main payload XOR key |
| `^ 10` | Padding XOR key |
| `^ <dynamic variable>` | anti-tamper te() |
| `^ 120` or `% 128` | OB response XOR key |

### 3.4 base64 UTF-8 encoder — grep `fromCharCode + "0x"`

```bash
grep -nE 'String\.fromCharCode\("0x"' main.js
grep -nE 'encodeURIComponent.*\.replace' main.js
```

PX's base64-UTF8 function always uses this exact pattern:

```js
function z(t) {
    return btoa(encodeURIComponent(t).replace(/%([0-9A-F]{2})/g, function(e, n) {
        return String.fromCharCode("0x" + n);   // ← this line
    }));
}
```

**Why stable**: UTF-8 byte stream → btoa requires converting multi-byte
chars to single-byte first, and PX uses exactly this pattern.

### 3.5 UUID v1 — grep the Gregorian offset

```bash
grep -nE "122192928e5|12219292800000" main.js
```

Hits one line:

```js
var p = (1e4 * (268435455 & (f += 122192928e5)) + s) % 4294967296;
//                              ↑↑↑↑↑↑↑↑↑↑↑↑
```

**Why stable**: `(1970 - 1582) × 365.25 × 86400 × 1000 = 12219292800000`,
the RFC 4122 UUID v1 standard offset.

Two related masks visible nearby:
- `268435455` = `0x0FFFFFFF` (28-bit timeLow mask)
- `4294967296` = `2^32` (32-bit wrap)

### 3.6 djb2 hash variant — grep `(e << 5) - e`

```bash
grep -nE "<<\s*5\)\s*-\s*[a-z]" main.js
```

Hits the standard djb2 form (`hash * 33 = (hash << 5) + hash` variant).
PX uses it for hash fields (e.g. some field mixing functions).

---

## 4. Locating PX custom algorithms (8)

On top of standard algorithms, PX uses 8 custom ones, each with a unique
constant or control-flow fingerprint.

### 4.1 `ml()` hash — INT32_MAX + 31×

```bash
grep -nE "31\s*\*\s*[a-z]\s*\+.*charCodeAt" main.js
grep -nE "%\s*2147483647" main.js
```

Both searches hit the same line:

```js
n = (31 * n + t.charCodeAt(e)) % 2147483647
```

**Signature**: `31 * acc + charCodeAt(i)` is a djb2 variant; `% 2147483647`
is INT32_MAX. The marker of the `ml()` function.

**Use**: derives the OB-response XOR key from TAG (`parseInt(ml(TAG)) % 128`).

### 4.2 OB segment processing — grep `split("|")` and `split("~~~~")`

```bash
grep -nE 'split\("\|"\)' main.js
grep -nE 'split\(.~~~~.\)' main.js
```

Both hit adjacent code blocks. OB processing is always:

```js
ob_decoded.split("~~~~")              // segments
  → each_segment.split("|")           // handler + args
    → args.shift()                     // take handler wire byte
      → registry[handler].apply(args)   // dispatch
```

**Why stable**: `~~~~` and `|` are part of the PX wire protocol, hardcoded
server-side; the client has to match.

### 4.3 set_cookie handler — grep `"bake"` or `"_px3"`

```bash
grep -nE '"bake"|jb\("YmFrZQ=="\)|atob\("YmFrZQ=="\)' main.js
grep -nE '"_px3"|"_px2"' main.js
```

`YmFrZQ==` is `"bake"` in base64. PX uses this token internally to
identify the cookie handler.

The set_cookie handler's position is stable within the 27-handler table
(use the shape-match below to find it).

### 4.4 PC computation — grep HMAC + digit extraction

```bash
grep -nE ">=\s*48.*<=\s*57|charCodeAt.*%\s*10" main.js
```

The PC formula:
1. HMAC-MD5 → 32 hex chars
2. Extract ASCII 48-57 (`'0'`-`'9'`) chars
3. For others (a-f), ASCII code mod 10
4. Concatenate, take even indices (every other char)

Steps 2-3 use `>= 48 && <= 57` or `% 10` patterns. Grep either and you
land on the PC function.

### 4.5 SID Unicode steganography — grep Plane 14 Tag

```bash
grep -nE "917760|0xE0100|fromCodePoint" main.js
```

`0xE0100` (= 917760) is the start of the Unicode Plane 14 Variation Selectors
range. SID stego adds this offset to ASCII digits to produce invisible
characters.

**Why stable**: the Unicode Tag region is IETF-defined; PX can't change it.

### 4.6 anti-tamper — grep `% 10 + 1` / `% 10 + 2`

```bash
grep -nE "%\s*10\s*\+\s*[12]" main.js
```

anti-tamper uses `state.no % 10 + 1` and `state.no % 10 + 2` to derive
two different XOR strengths — one for the key, one for the value:

```js
t[te(t.to, t.no % 10 + 2)] = te(t.to, t.no % 10 + 1);
//         ↑↑↑↑↑↑↑↑↑↑↑↑              ↑↑↑↑↑↑↑↑↑↑↑↑
//         XOR for key             XOR for value
```

**Why stable**: `% 10 + 1` and `% 10 + 2` are hardcoded magic; can't
change without breaking the algorithm.

### 4.7 hash field — grep `2863` + `charCodeAt(9)`

```bash
grep -nE "2863" main.js
grep -nE "charCodeAt\(9\)" main.js
```

PX has a mixing function using `vid.charCodeAt(9) * 2863 + ...`. `2863`
is PX's chosen prime factor; doesn't change across versions.

### 4.8 PoW SHA-256 solver — grep difficulty + sha256 + brute-force loop

```bash
grep -nE "difficulty|sha-?256|crypto\.subtle\.digest" main.js
grep -nE "0x\w*ffff\b" main.js   # 16-bit mask
```

PoW signature: a `for` loop computing SHA-256 repeatedly, with bitwise
ops like `& 0xFFFF` or `>> 16`. At difficulty=16, `0xFFFF` often
pinpoints the loop.

---

## 5. Locating protocol constants

### 5.1 Collector / Bundle endpoints

```bash
grep -nE "/api/v2/collector|/b/s" main.js
grep -nE "px-cloud\.net" main.js
grep -nE "/assets/js/bundle" main.js   # bundle endpoint
```

The hostname is always `collector-{appId-lowercase}.px-cloud.net`.

### 5.2 `/ns` probe endpoint

```bash
grep -nE "tzm\.px-cloud\.net|/ns\?" main.js
```

### 5.3 TAG / APP_ID / BI / FT constants (4-in-1)

PX bundles 4 constants on one line:

```js
var ?? = "U0MmDhUmOnhXSw==",   // TAG
    ?? = "401",                  // FT
    ?? = "PXO1GDTa7Q",            // APP_ID
    ?? = "EwNm…",                 // BI
    ??;
```

To locate: grep any one constant — the rest will appear together.

```bash
# Method 1: known APP_ID (most reliable)
grep -nE '"PX[A-Za-z0-9]{8,}"' main.js | head -5
# Method 2: long base64 constants
grep -nE 'var\s+\w+\s*=\s*"[A-Za-z0-9+/=]{12,}=="' main.js | head -5
# Method 3: common FT values (330/388/401 etc.)
grep -nE '"(330|388|401|359|421)"' main.js
```

### 5.4 Default fallback timestamp

```bash
grep -nE "1604064986" main.js
```

PX's hardcoded fallback timestamp (2020-10-30 UTC). Used when no server
timestamp is yet available.

### 5.5 The OB XOR key seed (gt)

OB XOR key = `parseInt(ml(gt), 10) % 128`, where `gt` is another base64
constant (not TAG).

```bash
# Search for base64 literals near ml()
grep -nE "ml\(\s*\"[A-Za-z0-9+/=]{8,}=" main.js
```

Or verify by brute-decoding captures:

```js
// Try candidate base64 constants
const candidates = [...];
for (const gt of candidates) {
    const key = parseInt(ml(gt), 10) % 128;
    const dec = xor(atob(resp.ob), key);
    if (dec.includes('~~~~')) console.log('FOUND:', gt);
}
```

---

## 6. Locating entry & dispatch functions

### 6.1 hQ lookup function (string decoder)

Signature:
- One function + one (longest) string array literal + one cache object
- The function body contains `void 0 === ?[t] ? ?[t] = ?(?[t]) : ?[t]`

```bash
# 1. Find the longest array literal (typically hP)
grep -nE ',\s*[a-zA-Z]{1,3}\s*=\s*\[' main.js | head -10
# 2. Find the hM decoder (base91 alphabet is the key marker)
grep -nE 'F@bt|"F@bt;\\"m:x3' main.js
# 3. Find the hQ cache pattern
grep -nE 'void\s+0\s*===.*\?.*=' main.js | head -5
```

### 6.2 OB main dispatcher

Signature: loop → `split('~~~~')` → `split('|')` → `.shift()` → lookup → `apply`.

```bash
# split('|') near apply / call
grep -nE 'split\("\|"\)' main.js -A 5 | grep -E 'apply|call' | head -5
```

### 6.3 The 27-handler registry

Signature: consecutive assignments to an object's keys, where keys are
literal wire bytes (combinations of `I` / `0` / `o` / `l`) or hQ(N)
references.

```bash
# Literal wire bytes + handler function references
grep -nE '\["?(I|0|o|l|1){6,}"?\]\s*=' main.js | head -20
grep -nE 'SP\["?[Il0o1]{6,}"?\]\s*=' main.js | head -20
```

### 6.4 Event constructor main entry (`mh` / equivalent)

Signature: assembles POST params `payload=`, `appId=`, `tag=`, `pc=`,
`sid=` etc.

```bash
grep -nE '"payload="|"&payload="' main.js
grep -nE '"&pc="|"&cs="|"&sid="|"&uuid="' main.js
grep -nE '"appId="' main.js
```

### 6.5 Fingerprint collection main entry (`Dd` / equivalent)

Signature: a series of short-named function calls (`ev(t); nv(t); av(t); …`),
each collecting one group of fields.

```bash
grep -nE '\b[a-z]{1,3}\(t\);\s*[a-z]{1,3}\(t\);\s*[a-z]{1,3}\(t\)' main.js | head -5
```

### 6.6 PoW solver function (captcha.js only)

```bash
grep -nE 'for\s*\([^)]*<<\s*1[56]' captcha.js   # difficulty-16 loop
grep -nE 'crypto\.subtle\.digest\("SHA-256"' captcha.js
grep -nE 'sha-?256' captcha.js -i
```

### 6.7 WASM loader (captcha.js only)

```bash
grep -nE 'WebAssembly\.instantiate|new WebAssembly\.Module' captcha.js
grep -nE 'Us\(\)\[10\]|\\x00asm' captcha.js   # WASM magic bytes
```

---

## 7. hP/hM/hQ dictionary extraction & reverse lookup

### 7.1 The three-piece structure

```
hP[1152 entries]   ← base91-packed string array
   ↓ hM(s)
bytes              ← decoded byte stream
   ↓ hY(bytes)
UTF-8 string       ← actual semantic value
   ↓ hQ(N) cached in hO[]
```

### 7.2 The hM base91 decoder (Node.js implementation)

The 91-character alphabet (PX-scrambled, identical across versions):

```
F@bt;"m:x3&#LiZ[)TE/}%QD1Iu.6f0R]78|4{zvWC>`$Se(rJ=*c^2_?qOpB,d<AVy~YwoP!+9g5nXhUsNGjaMKHlk
```

Complete implementation:

```js
// hM.js
const ALPHABET = 'F@bt;"m:x3&#LiZ[)TE/}%QD1Iu.6f0R]78|4{zvWC>`$Se(rJ=*c^2_?qOpB,d<AVy~YwoP!+9g5nXhUsNGjaMKHlk';

function hM(input) {
    const s = String(input || '');
    const out = [];
    let buf = 0, bits = 0, val = -1;
    for (let i = 0; i < s.length; i++) {
        const idx = ALPHABET.indexOf(s[i]);
        if (idx === -1) continue;
        if (val < 0) val = idx;
        else {
            val += idx * 91;
            buf |= val << bits;
            bits += ((val & 8191) > 88) ? 13 : 14;
            do {
                out.push(buf & 0xFF);
                buf >>= 8;
                bits -= 8;
            } while (bits > 7);
            val = -1;
        }
    }
    if (val > -1) out.push((buf | (val << bits)) & 0xFF);
    return Buffer.from(out).toString('utf-8');
}
```

### 7.3 The dictionary-rotation IIFE

At boot the SDK runs an IIFE that repeatedly `push(shift())` on hP until
a numeric checksum passes. **As a result the source-order of hP ≠ the
runtime order.**

Easiest workaround: **dump from the browser** (step 7.4); don't try to
replicate the checksum in Node.

### 7.4 Browser-console export (most reliable)

On any PX-protected page, open DevTools Console:

```js
// 1. Check whether hQ is on the global
typeof hQ;   // → "function" ✓

// 2. Bulk dump
var map = {};
for (var i = 0; i < 1200; i++) {
    try { map[i] = hQ(i); } catch (e) {}
}
console.log('Decoded', Object.keys(map).length, 'entries');
copy(JSON.stringify(map, null, 2));   // → clipboard
```

Paste into `hQ_map.json` — you get 1152 index → string mappings.

> If `hQ` isn't on the global (closed-over): break at any `hQ(...)` call
> in the Sources panel, dump from the paused frame.

### 7.5 Node.js extraction (no browser)

```js
// extract_hQ.js
const fs = require('fs');
const { hM } = require('./hM');

const sdk = fs.readFileSync('main.js', 'utf-8');

// 1. Extract the hP literal
const start = sdk.indexOf(', hP = [');
let arrStart = sdk.indexOf('[', start);
let i = arrStart + 1, depth = 1;
while (i < sdk.length && depth > 0) {
    const c = sdk[i];
    if (c === '"' || c === "'") {
        const q = c;
        i++;
        while (i < sdk.length && sdk[i] !== q) {
            if (sdk[i] === '\\') i++;
            i++;
        }
    } else if (c === '[') depth++;
    else if (c === ']') depth--;
    i++;
}
const hP = eval(sdk.slice(arrStart, i));

// 2. Apply the rotation: use the browser-dumped order, or run the SDK in Node
//    (recommended: export rotated_hP.json once from browser, then load)

// 3. Bulk-decode
const map = {};
for (let n = 0; n < hP.length; n++) {
    try { map[n] = hM(hP[n]); } catch (e) {}
}
fs.writeFileSync('hQ_map.json', JSON.stringify(map, null, 2));
```

### 7.6 Reverse lookup b64 key → SDK callsite

```js
// reverse_lookup.js
const map = require('./hQ_map.json');
const sdk = require('fs').readFileSync('main.js', 'utf-8');

// Build the reverse map
const rev = {};
for (const [n, v] of Object.entries(map)) {
    if (!(v in rev)) rev[v] = +n;
}

function locate(b64Key) {
    // 1. Referenced via hQ(N)?
    if (b64Key in rev) {
        const N = rev[b64Key];
        const re = new RegExp(`hQ\\(\\s*${N}\\s*\\)`, 'g');
        const m = re.exec(sdk);
        return m ? { via: 'hQ', N, idx: m.index } : null;
    }
    // 2. Plain literal?
    const idx = sdk.indexOf(`"${b64Key}"`);
    return idx >= 0 ? { via: 'plain', idx } : null;
}
```

---

## 8. The 5 EV field locating techniques

Ranked by coverage:

### Technique A: hQ dictionary reverse lookup (~50% coverage)

See §7.6. Any field referenced via `hQ(N)` is locatable.

### Technique B: grep plain `["KEY="]` (~40% coverage)

```bash
grep -nE '"RTEwewNQMUg="' main.js
# Adding quotes + the trailing = is more precise than the raw key
# (avoids false matches with + / inside other base64)
```

About 40% of fields are written as plain b64 literals in the source.

### Technique C: grep the value's source browser API (covers environment fields)

| Field value | Search for |
|---|---|
| `"Win32"`, `"MacIntel"` | `navigator.platform` |
| `1920`, `1080`, `2560` | `screen.width`, `screen.height` |
| Large ints 1e7-1e9 | `performance.memory`, `usedJSHeapSize`, `totalJSHeapSize` |
| `"visible"` | `document.visibilityState` |
| `"webkit"`, `"Mozilla"` | `navigator.userAgent`, `navigator.vendor` |
| `"en-US"`, `"zh-CN"` | `navigator.language`, `navigator.languages` |
| `"https:"` | `location.protocol` |
| Timezone numbers (-480 etc.) | `Date.getTimezoneOffset` |

Obfuscators **can't rename native browser APIs** — they wouldn't work.

### Technique D: grep algorithm magic constants (covers PC / HMAC / hash fields)

| Field semantic | Magic constant |
|---|---|
| HMAC(uuid, UA) | Same code block as HMAC ipad/opad (`909522486`) |
| Date.toString() | `new Date()` or `Date.prototype.toString` |
| anti-tamper | `% 10 + 2` and `% 10 + 1` |
| hash field | `2863` and `charCodeAt(9)` |
| SID stego | `0xE0100` / `917760` |
| UUID v1 | `122192928e5` |

### Technique E: cross-sample diff (fallback, covers the rest)

For each field across 6 batches:

| Pattern | Inference |
|---|---|
| Identical across all 6 | STATIC; copy from template |
| Different across 6, all 13-digit | timestamp |
| Different across 6, UUID format | uuid-class |
| Different across 6, 32 hex | HMAC-MD5 |
| Different across 6, 64 hex | SHA-256 / `state.qa` |
| Different across 6, long b64 | `/ns sm` |
| Different across 6, large int 1e7-1e9 | memory bytes |
| Different across 6, float < 10000 | `performance.now()` |
| Different across 6, object | nested substructure (e.g. `navigator.connection`) |
| Present only in some batches | CONDITIONAL (warm-visit field) |

---

## 9. Universal handler shape-matching table

⚠️ **Never use the handler wire byte to identify** (e.g. `0lll0l`,
`o111oo` — these rotate every SDK upgrade). **Use the argument shape**.

| Handler semantic | Shape signature | Writes to state |
|---|---|---|
| server timestamp | 1 arg, `/^1[5-9]\d{11}$/` (13-digit ms) | `state.no` |
| second-tick ts | 1 arg, `/^1[5-9]\d{8,9}$/` (10-digit seconds) | `state.ro` |
| challenge_hash | 1 arg, `/^[0-9a-f]{64}$/` (SHA-256) | `state.qa` |
| vid | 3 args, UUID + number + flag | `state.vid` |
| cts | 2 args, UUID + flag | `state.cts` |
| pxsid | 1 arg, UUID format | `state.pxsid` |
| session_id (to) | 1-2 args, `/^[A-Za-z0-9]{16,}$/` | `state.to` |
| status code | 1 arg, `/^\d{3}$/` | `state.ao` |
| **set_cookie** | **4+ args, first matches `/^_?px/i`** | **`state.px3 = {name, value, ttl}`** |
| app_id (bundle) | 1 arg, `/^[a-z0-9]{12,30}$/` | `state.appId` |
| control_flag | 1 arg, `/^[a-z]{2,4}$/` (e.g. `"cu"`, `"fc"`, `"o"`, `"b"`) | `state.jf` |
| o111val | 1 arg, `/^\d{4,5}$/` | `state.o111val` |
| feature_flags | 1 arg, `/^[a-z]+:\d.*,/` (e.g. `"ccc:0,ic:0,nf:0,ai:0"`) | `state.cc` |
| cookie_config | 4-5 args, [name, value, ttl, opts...] | `state.cookieConfig` |
| localStorage write | 2 args, key + value | (side effect) |
| navigation | 1 arg, URL or path | (side effect) |
| trigger_event | 1 arg, event name | (side effect) |
| noop | 0-1 args, doesn't match above | (skip) |

Implementation:

```js
function decodeHandler(handlerByte, args) {
    if (args.length === 1) {
        const a = args[0];
        if (/^1[5-9]\d{11}$/.test(a)) return { type: 'state.no', value: a };
        if (/^[0-9a-f]{64}$/.test(a)) return { type: 'state.qa', value: a };
        if (/^[0-9a-f-]{36}$/.test(a)) return { type: 'state.pxsid_or_vid', value: a };
        if (/^[a-z]{2,4}$/.test(a)) return { type: 'state.jf', value: a };
        if (/^\d{3}$/.test(a)) return { type: 'state.ao', value: a };
        if (/^[a-z0-9]{12,30}$/.test(a)) return { type: 'state.appId', value: a };
        if (/^[A-Za-z0-9]{16,}$/.test(a)) return { type: 'state.to', value: a };
    }
    if (args.length >= 4 && /^_?px/i.test(args[0])) {
        return { type: 'set_cookie', name: args[0], value: args[2], ttl: +args[1] };
    }
    if (args.length === 2 && /^[a-z]+:\d/.test(args[0])) {
        return { type: 'feature_flags', value: args[0] };
    }
    return { type: 'noop', args };
}
```

This shape-matching table is **validated across iFood / Grubhub / many
PX versions over time**.

---

## 10. Three-way field classification method

### 10.1 STATIC / DYNAMIC / CONDITIONAL definitions

| Class | Pattern | Handling |
|---|---|---|
| **STATIC** | Identical across multiple batches on the same browser+device | Copy true value from template, never modify |
| **DYNAMIC** | Varies between batches, possibly with a pattern | Generate algorithmically (timestamps, UUIDs, HMACs, etc.) |
| **CONDITIONAL** | Missing from some batches | Warm-visit-only; omit from cold-visit |

### 10.2 Auto-diff script

```js
// diff_samples.js
const fs = require('fs');
const batches = process.argv.slice(2);   // batch1.json batch2.json ...

const allKeys = new Set();
const valuesByKey = {};

for (const f of batches) {
    const ev = JSON.parse(fs.readFileSync(f));
    for (const k of Object.keys(ev.d)) {
        allKeys.add(k);
        if (!valuesByKey[k]) valuesByKey[k] = [];
        valuesByKey[k].push(JSON.stringify(ev.d[k]));
    }
}

const result = { static: [], dynamic: [], conditional: [] };
for (const k of allKeys) {
    const values = valuesByKey[k];
    if (values.length < batches.length) {
        result.conditional.push(k);
    } else if (new Set(values).size === 1) {
        result.static.push(k);
    } else {
        result.dynamic.push(k);
    }
}

fs.writeFileSync('field_classes.json', JSON.stringify(result, null, 2));
```

### 10.3 DYNAMIC field subclassification

For each DYNAMIC field, look at its values across 6 batches:

| Value pattern | Subclass | Generation algorithm |
|---|---|---|
| `/^1[5-9]\d{11}$/` | timestamp ms | `Date.now()` |
| `/^[0-9a-f-]{36}$/` | UUID | `uuidV1()` or `state.<var>` |
| `/^[0-9a-f]{32}$/` | HMAC-MD5 | `hmacMD5(input, key)` |
| `/^[0-9a-f]{64}$/` | SHA-256 / `state.qa` | Copy from OB#1 |
| `/^[A-Za-z0-9+/=]{40,}$/` | `/ns sm` | `await fetch('/ns?c=...')` |
| Float 0-10000 | `performance.now()` | `sendTime - initTime` |
| Int 1e7-1e9 | memory bytes | `random(40_000_000, 140_000_000)` |
| Int 100-9999 | perf metric / counter | `random(...)` |
| `"Tue May 19 …"` | `Date.toString()` | `new Date().toString()` |
| object | nested substructure | inspect substructure fields |

---

## 11. Standard end-to-end flow (new SDK in 30 minutes)

### Stage 1: Download + probe (5 minutes)

```bash
# 1. Download SDK
curl 'https://client.px-cloud.net/<APP_ID>/main.min.js' > main.js
wc -c main.js   # expect 200-300 KB

# 2. Probe presence of major algorithms
grep -c "1732584193" main.js     # MD5: should be 1
grep -c "909522486" main.js       # HMAC: should be 1
grep -c "122192928e5" main.js     # UUID v1: should be 1
grep -c "2147483647" main.js      # ml(): should be ≥ 1
grep -c "917760\|0xE0100" main.js # SID stego: should be ≥ 1 (if used)
grep -c "~~~~" main.js            # OB delimiter: should be ≥ 1
```

If any of these = 0, the SDK has had a major change — re-evaluate the
methodology.

### Stage 2: Capture 6 batches (10-15 minutes)

CDP attached to real Chrome, per batch:

```
samples/N/
├── request_1.txt        # POST #1 full curl
├── response_1.txt       # response
├── request_2.txt        # POST #2 full curl
├── response_2.txt       # response
└── meta.json            # uuid, ts, SDK SHA-256
```

All 6 batches must use the same SDK SHA-256 (recorded in meta.json).

### Stage 3: Decode + extract constants (5 minutes)

```js
// Decode POST #1 payload → get EV1
const ev1 = decodePayload(captureFile1.payload);

// Pull constants
const APP_ID = captureFile1.body.appId;      // POST param
const TAG = captureFile1.body.tag;
const FT = captureFile1.body.ft;
const BI = captureFile1.body.bi || null;

// Decode response_1 → get state.*
const state = decodeOb(captureFile1.response_1, TAG);
console.log(state);
// { no: '...', to: '...', qa: '...', pxsid: '...', vid: '...', appId: '...' }
```

### Stage 4: Extract hQ dictionary (5 minutes)

Run the browser-console dump (§7.4) → produces `hQ_map.json`.

### Stage 5: Field locating (10-30 minutes)

```js
// For each captured EV2 field, find its SDK origin
for (const [b64Key, value] of Object.entries(ev2.d)) {
    const located = locate(b64Key);   // §7.6
    console.log(b64Key, '→', located);
}
// → most resolve to hQ(N) or plain
// → the rest go through techniques C/D/E
```

### Stage 6: Classification (10 minutes)

Run §10.2's `diff_samples.js` → produces `field_classes.json`.

### Stage 7: Lock state.* injection slots (30 minutes — the critical step)

`state.*`'s b64 keys in EV2 **can't be derived algorithmically** — they
must be **value-matched**:

```js
// find_state_keys.js
for (const stateVar of ['no', 'to', 'qa', 'vid', 'pxsid', 'appId', 'cts', 'o111val']) {
    const matches = [];
    for (const batch of batches) {
        const candidates = [];
        for (const [k, v] of Object.entries(batch.ev2.d)) {
            if (String(v) === String(batch.state[stateVar])) candidates.push(k);
        }
        matches.push(new Set(candidates));
    }
    // Intersection across 6 batches = the unique b64 key
    const final = [...matches[0]].filter(k => matches.every(s => s.has(k)));
    console.log(`state.${stateVar} →`, final[0]);
}
```

### Stage 8: Write the generator (1-3 hours)

```js
// Template + DYNAMIC overrides + state injection + anti-tamper
function generateCookie(ua) {
    const uuid = uuidV1();
    const initTime = Date.now();
    const nsResult = await fetchNs(uuid);

    // POST #1
    const ev1 = buildEv1({ uuid, initTime, sendTime: Date.now(), nsResult });
    const resp1 = await postCollector(ev1, /* ... */);

    // Decode OB#1 → state
    const state = decodeOb(resp1, TAG);

    // POST #2
    const ev2 = buildEv2({ uuid, state, ua, initTime, sendTime, nsResult });
    const resp2 = await postCollector(ev2, /* ... */);

    // Decode OB#2 → _px3
    return decodeOb(resp2, TAG).px3;
}
```

### Stage 9: 10/10 validation

Run 10 times with ≥ 10s spacing; all 10 must be accepted by the business
API. Failures → use §12 decision tree.

---

## 12. Troubleshooting decision tree

### 12.1 Top-level symptom triage

```
Collector returns 200 but no _px3 cookie?
  ├─ Body is {"do":[]} → PC wrong (§4.4)
  ├─ Body is {"do":[...]} but no set_cookie segment → EV2 wrong (see §12.2)
  └─ Body contains set_cookie but you can't parse it → OB decode wrong (§4.2)

Collector outright rejects (403 / 4xx)?
  ├─ Wrong Origin/Referer headers → fix headers
  ├─ payload= URL-encoding wrong → check encodeURIComponent
  ├─ TLS fingerprint caught by Cloudflare → use curl_cffi or real browser
  └─ IP rate-limited → space requests ≥ 10s apart

Business API rejects but collector passed?
  ├─ Cookie written incorrectly → check _px3 full string
  ├─ EV2 has missing or extra fields → cross-platform pitfall (Grubhub EV2 shouldn't carry /ns dur)
  └─ Bundle path triggered → see Bundle chapter

Intermittent failure (4-5 out of 10 pass)?
  └─ IP rate-limiting (most common) → space ≥ 15s
```

### 12.2 EV2 subdiagnosis

```
Decode your generated payload, diff against the template EV2:
  ├─ Field count differs → extra/missing fields
  │   ├─ Extra → check whether you stuffed an EV1 field into EV2
  │   └─ Missing → check that STATIC fields were copied fully
  │
  ├─ Same count but anti-tamper position wrong → did you replace in-place?
  │   └─ Find the field matching /^[0-9:;<=>?@]{15,25}$/ and change key + value IN PLACE
  │
  ├─ state.no is a string, not a number → parseInt (§4.6, Gotcha 1)
  ├─ HMAC doesn't match template → UA must equal the HTTP header exactly
  ├─ Date.toString() is English, not "中国标准时间" → wrong strftime locale
  └─ /ns sm field is null → /ns request didn't fire or failed
```

### 12.3 OB-decode subdiagnosis

```
Everything decodes as gibberish?
  ├─ Wrong XOR key → §5.5 to find ml's input (gt)
  ├─ atob used utf-8 instead of binary/latin-1 → switch to binary
  ├─ split used 3 tildes instead of 4 → use "~~~~" (4 tildes)
  └─ split used wrong delimiter → must be "|"

Partial decode (some segments right, some gibberish)?
  └─ XOR key isn't consistent across segments → check ml(TAG)
```

### 12.4 Debug command cheat sheet

```bash
# Decode my own payload
node decode_payload.js my_request.txt > my_ev2.json
diff template_ev2.json my_ev2.json

# Decode the collector response
node decode_response.js resp.json TAG > state.json

# Type check (state.no must be number when written to EV2)
jq '.state.no | type' state.json   # "string" — but parseInt when writing to EV2
```

---

## 13. Tool script reference

A new SDK requires this toolkit (each script ≤ 200 lines):

| Script | Purpose | Input | Output |
|---|---|---|---|
| `extract_hQ.js` | Extract hQ dictionary | `main.js` | `hQ_map.json` |
| `decode_payload.js` | Decode POST payload | request_*.txt | EV JSON |
| `decode_response.js` | Decode OB response | response_*.txt + TAG | state + segments |
| `diff_samples.js` | STATIC/DYNAMIC/CONDITIONAL classifier | N batch EV JSONs | field_classes.json |
| `lookup_keys.js` | Field → SDK location | b64 key + hQ_map + main.js | via/idx info |
| `find_state_keys.js` | state.* → EV2 b64 key | 6 batch states + 6 batch EV2s | state_key_map.json |
| `probe_dynamic.js` | DYNAMIC field subclassifier | DYNAMIC keys + 6 batches' values | semantic.json |

These take an evening to implement and are reusable across SDK versions.

---

## Appendix A: Complete grep pattern index

```bash
# === Crypto primitives ===
grep -nE "1732584193" main.js                                          # MD5 init A
grep -nE "909522486" main.js                                            # HMAC ipad
grep -nE "1549556828" main.js                                           # HMAC opad
grep -nE "122192928e5|12219292800000" main.js                            # UUID v1
grep -nE "charCodeAt\([^)]+\)\s*\^" main.js                              # XOR cipher
grep -nE 'String\.fromCharCode\("0x"' main.js                            # base64 UTF-8

# === PX custom algorithms ===
grep -nE "%\s*2147483647" main.js                                        # ml() INT32_MAX
grep -nE "31\s*\*\s*[a-z]\s*\+.*charCodeAt" main.js                       # ml() djb2
grep -nE 'split\("\|"\)' main.js                                          # OB segment
grep -nE 'split\(.~~~~.\)' main.js                                        # OB delimiter
grep -nE ">=\s*48.*<=\s*57|charCodeAt.*%\s*10" main.js                    # PC digit extract
grep -nE "917760|0xE0100|fromCodePoint" main.js                          # SID Plane 14
grep -nE "%\s*10\s*\+\s*[12]" main.js                                    # anti-tamper
grep -nE "2863" main.js                                                  # hash factor
grep -nE '"bake"|jb\("YmFrZQ=="\)' main.js                                # set_cookie marker

# === Protocol constants ===
grep -nE "/api/v2/collector|/b/s" main.js                                # collector
grep -nE "tzm\.px-cloud\.net|/ns\?" main.js                              # /ns
grep -nE "/assets/js/bundle" main.js                                     # bundle
grep -nE "px-cloud\.net" main.js                                         # main domain
grep -nE "1604064986" main.js                                            # fallback ts

# === Browser API names (for field locating) ===
grep -nE 'navigator\.platform' main.js
grep -nE 'navigator\.userAgent' main.js
grep -nE 'navigator\.language' main.js
grep -nE 'navigator\.connection' main.js
grep -nE 'screen\.width|screen\[' main.js
grep -nE 'screen\.height' main.js
grep -nE 'performance\.now' main.js
grep -nE 'performance\.memory' main.js
grep -nE 'document\.visibilityState' main.js
grep -nE 'location\.protocol' main.js
grep -nE 'location\.href' main.js
grep -nE 'Date\.prototype\.toString|new Date\(\)\.toString' main.js
grep -nE 'getTimezoneOffset' main.js

# === Entry function signatures ===
grep -nE ',\s*[a-zA-Z]{1,3}\s*=\s*\[' main.js | head -5                  # hP array candidates
grep -nE 'F@bt|"F@bt;\\"m:x3' main.js                                    # hM alphabet
grep -nE 'void\s+0\s*===.*\?.*=' main.js | head -5                       # hQ cache
grep -nE '"payload="|"&payload="' main.js                                # mh main entry
grep -nE '"&pc="|"&cs="|"&sid="' main.js                                 # POST param assembly
grep -nE 'split\("\|"\)' main.js -A 5 | grep -E 'apply|call'              # OB dispatcher

# === Bundle (captcha.js) ===
grep -nE 'WebAssembly\.instantiate' captcha.js                            # WASM load
grep -nE 'crypto\.subtle\.digest\("SHA-256"' captcha.js                    # PoW
grep -nE 'difficulty|0xFFFF' captcha.js -i                                # PoW difficulty
```

---

## Appendix B: Complete magic constant index

| Constant | Category | Use |
|---|---|---|
| `1732584193` | RFC | MD5 init A |
| `-271733879` | RFC | MD5 init B |
| `-1732584194` | RFC | MD5 init C |
| `271733878` | RFC | MD5 init D |
| `-680876936` | RFC | MD5 round 1, 1st constant (verification) |
| `909522486` | RFC | HMAC ipad `0x36363636` |
| `1549556828` | RFC | HMAC opad `0x5C5C5C5C` |
| `122192928e5` | RFC | UUID v1 Gregorian offset |
| `12219292800000` | RFC | Same as above (expanded) |
| `268435455` | RFC | `0x0FFFFFFF` UUID v1 timeLow mask |
| `4294967296` | RFC | `2^32` UUID v1 wrap |
| `2147483647` | PX | `INT32_MAX`, ml() modulus |
| `917760` | Unicode | `0xE0100`, Plane 14 Tag start |
| `2863` | PX | Hash-field prime factor |
| `4210` | PX | Myanmar XOR key |
| `1604064986` | PX | Fallback timestamp (2020-10-30) |
| `0xFFFF` (65535) | PX | PoW difficulty-16 mask |
| `50` | PX | Main payload XOR key |
| `10` | PX | Padding XOR key |
| `120` | PX | OB response XOR key (iFood instance, derived from ml(TAG)) |

---

## Appendix C: Complete protocol string index

| String | Use |
|---|---|
| `~~~~` | OB segment delimiter (4 tildes, NOT 3) |
| `\|` | handler + args separator |
| `/api/v2/collector` | Collector path |
| `/b/s` | Collector fallback path |
| `/assets/js/bundle` | Bundle path |
| `tzm.px-cloud.net` | /ns probe host |
| `client.px-cloud.net` | SDK CDN |
| `collector-<appid>.px-cloud.net` | Collector host |
| `bake` (`YmFrZQ==`) | set_cookie handler marker |
| `cu` | jf control flag (cookie update) |
| `cc` | jf deferred-execution marker |
| `_px3` / `_px2` | Cookie name |
| `_pxhd` | History cookie |
| `_pxvid` | Visitor ID cookie |
| `x-www-form-urlencoded` | POST Content-Type |

---

## Appendix D: Cross-version stability matrix

| Element | Across minor versions (quarterly) | Across major versions (yearly) | Across multi-year |
|---|---|---|---|
| RFC standard constants | ✓ | ✓ | ✓ |
| Protocol delimiters `~~~~` `\|` | ✓ | ✓ | ✓ |
| Browser API names | ✓ | ✓ | ✓ |
| Plane 14 start 0xE0100 | ✓ | ✓ | ✓ |
| INT32_MAX | ✓ | ✓ | ✓ |
| Algorithm magic constants (e.g. 2863) | ✓ | Probably ✓ | May change |
| Protocol endpoints `/api/v2/collector` | ✓ | Probably ✓ | May change |
| Fallback timestamp `1604064986` | ✓ | ✓ | May update |
| EV2 field b64 keys | ✓ | Probably change | Almost certainly change |
| Handler wire bytes (e.g. `0lll0l`) | Probably ✓ | May change | Almost certainly change |
| Handler shape (argument pattern) | ✓ | ✓ | ✓ (PX protocol design is stable) |
| hQ dictionary contents | Often change | Almost certainly change | — |
| Variable / function names | Often change | Almost certainly change | — |
| Line numbers | Change each release | Change | Change |

**Key insight**: line numbers shift every time, but **algorithm constants
never change**. Ground your methodology on the algorithms — it gives you
multi-year reliability.

---

## Appendix E: 30-minute new-SDK locating checklist

Tick through these 13 steps and you have a **complete reverse-engineering
map** for a new SDK:

```
□ 1. Download main.js (~250 KB)
□ 2. Probe: grep MD5 init / HMAC pad / UUID offset / INT32_MAX must each ≥ 1
□ 3. Capture 6 cold-visit batches (consistent SDK SHA across batches)
□ 4. Decode EV1 + EV2 + state (use ml(TAG)%128 as XOR key)
□ 5. Extract constants: APP_ID, TAG, FT, BI (read directly from POST body)
□ 6. Browser-console dump hQ dictionary → hQ_map.json
□ 7. Run lookup_keys.js → each field is via hQ / plain / not_found
□ 8. For not_found fields, use techniques C/D/E
□ 9. Run diff_samples.js → STATIC/DYNAMIC/CONDITIONAL classification
□ 10. Run find_state_keys.js → state.* → EV2 b64-key mapping
□ 11. Write generator: template + DYNAMIC overrides + state injection + anti-tamper
□ 12. 10-run integration test (≥ 10s spacing) end-to-end
□ 13. 10/10 pass → ship; < 10/10 → diagnose via §12 decision tree
```

Total time:

- Algorithm layer (if you've used this methodology before): **30-min locate**
- Field layer (STATIC/DYNAMIC labeling): **1-2 hours**
- End-to-end generator: **1-3 hours**
- 10/10 debugging: **0.5-2 hours**

**Total: 3-8 hours**, depending on language, capture tooling, and debug
experience.

---

## Closing notes

The core of this methodology: **locate all of PX's obfuscated code using
three categories of cross-version-stable anchors** — RFC standards,
protocol strings, and native browser APIs.

- ❌ Don't read an unfamiliar SDK line-by-line from the top
- ❌ Don't try to understand every variable name
- ❌ Don't memorize line numbers
- ✅ Grep known stable signatures first
- ✅ Match by shape, not name
- ✅ Match by value, not derivation (especially for state.* → EV2 b64 key)
- ✅ Copy STATIC from template; compute only DYNAMIC

**Over 3 years of observation, PX rotates obfuscation constantly but has
never changed an algorithm.** Build your methodology on the algorithms,
and every new SDK takes 30 minutes to re-locate — the rest of the code
is reusable.

---

*End of document. Companion artifacts: other technical documents in this
repo's `doc/` (or `EN/` and `ZH/`); decoder primitive implementations
in `packages/px-common/src/`.*
