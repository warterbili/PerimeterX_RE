# Stage 4: Field Semantic Location — 7 Techniques (grep Handbook) ⭐

> **Time budget**: 1 h fluent / **4 h** first-time (this is the longest chapter in Stages 4-7)
> **Deliverables**: every DYNAMIC field located to the SDK source line that assigns it
> *Merges*: C/§3 (7 techniques) + A/§3-9 (full grep patterns) + B/04_stage4_locate

---

## Chapter Goal

Know where every DYNAMIC field **comes from**: which browser API / algorithm / state.\* source.
Once this chapter is done, Stage 6 coding becomes **purely mechanical**.

## Core Principle

> **Don't search for keys; search for the source of values.**

The base64 keys in the PX SDK are **not in cleartext** in `main.min.js`. They're indirectly referenced via an array lookup function. Direct grep for `RTEwewNQMUg=` often fails (because the SDK internally uses `hQ(521)` form). **The right approach is reversed — knowing the value, find where it comes from**.

---

## 4.1 Technique 1: Break the Lookup Function `hQ` (Highest ROI, Covers 80%)

### 4.1.1 Locate the Lookup Function

Search in `main.min.js` (beautified):

```javascript
function hQ(t) {
    return void 0 === hO[t] ? hO[t] = hM(hP[t]) : hO[t]
}
```

Or similar patterns: `function XX(t) { return ARR[t - OFFSET] }`.

`hQ` is the lookup function, `hP` is the encoded string array, `hM` is the decoder.

Across versions `hQ` / `hP` / `hM` names change, so **search by pattern**:

```bash
# hQ pattern (return cache OR populate)
grep -nE 'return void 0 === [a-zA-Z]+\[t\] \?' main.min.js

# Or search for the cache pattern
grep -nE 'function [a-zA-Z]+\(t\)\s*\{\s*return [a-zA-Z]+\[t\] = [a-zA-Z]+\([a-zA-Z]+\[t\]' main.min.js
```

### 4.1.2 Extract the hP Array

`hP` is a huge string array (typically ~1152 entries). Extract via text slicing (with bracket matching):

```javascript
const start = sdk.indexOf(', hP = [');   // or `var hP = `
let i = sdk.indexOf('[', start), depth = 1, inStr = false, strCh = '';
i++;
const arrStart = i - 1;
while (i < sdk.length && depth > 0) {
    const c = sdk[i];
    if (inStr) {
        if (c === '\\' && i+1 < sdk.length) { i += 2; continue; }
        if (c === strCh) inStr = false;
        i++; continue;
    }
    if (c === '"' || c === "'") { inStr = true; strCh = c; i++; continue; }
    if (c === '[') depth++;
    else if (c === ']') depth--;
    i++;
}
const arrayLiteral = sdk.slice(arrStart, i);
const hP = eval(arrayLiteral);   // hP is now an array
console.log('hP length:', hP.length);   // expected ~1152
```

Production script: [`../../../skill/AI_re/scripts/extract_hQ.js`](../../../skill/AI_re/scripts/extract_hQ.js).

### 4.1.3 Extract the hM Decoder

PX uses a custom base91-like encoding:

```javascript
function hM(t) {
    var n = "" + (t || ""), e = n.length, r = [], h = 0, i = 0, o = -1, c = 0;
    for (; c < e; c++) {
        var a = 'F@bt;"m:x3&#LiZ[)TE/}%QD1Iu.6f0R]78|4{zvWC>`$Se(rJ=*c^2_?qOpB,d<AVy~YwoP!+9g5nXhUsNGjaMKHlk'.indexOf(n[c]);
        if (a !== -1) {
            if (o < 0) o = a;
            else {
                h |= (o += 91 * a) << i;
                i += (8191 & o) > 88 ? 13 : 14;
                do { r.push(255 & h); h >>= 8; i -= 8; } while (i > 7);
                o = -1;
            }
        }
    }
    if (o > -1) r.push(255 & (h | (o << i)));
    return Buffer.from(r).toString('utf-8');
}
```

⭐ **Key signature**: the alphabet starts with `'F@bt'`. `grep 'F@bt' main.min.js` always hits.

### 4.1.4 Export the Complete hQ Mapping

```javascript
const map = {};
for (let n = 0; n < hP.length; n++) map[n] = hM(hP[n]);
fs.writeFileSync('hQ_map.json', JSON.stringify(map, null, 2));
```

Result: 1152+ `index → string` mappings, covering all base64 keys, API names, URLs, etc.

### 4.1.5 Reverse Lookup: b64 key → SDK Location

```bash
# Assume hQ_map.json exists → reverse-look the index for RTEwewNQMUg=
jq 'to_entries | map(select(.value == "RTEwewNQMUg=")) | .[].key' hQ_map.json
# "212"

# Now grep hQ(212) context
grep -n 'hQ(212)' main.min.js
# Or grep hQ\([^)]*212[^)]*\) to handle variable indices
```

Production script: [`../../../skill/AI_re/scripts/lookup_keys.js`](../../../skill/AI_re/scripts/lookup_keys.js).

---

## 4.2 Technique 2: Search `["base64key="]` Cleartext (Covers 40-60%)

Not all keys go through `hQ`. Both styles coexist in the SDK:

```javascript
// Style A — cleartext (grep finds it)
e["fyNFZTlCSFM="] = N(Pa(), t);
ty["N2sNLXEGAx4="] = ti();

// Style B — array lookup (grep won't find; need Technique 1)
t[S(521)] = eo;
```

### 4.2.1 Search Tips

```bash
# Add quotes + equals sign for precision (avoid + / mismatches inside base64)
grep -n '"cgIHSDRhAX8="' main.min.js
grep -n '\["cgIHSDRhAX8="\]' main.min.js
```

### 4.2.2 Batch Reverse-Lookup of All DYNAMIC

```bash
# Use probe_dynamic.js to look up all DYNAMIC fields at once
node ../../../skill/AI_re/scripts/probe_dynamic.js \
    field_classes_ev2.json \
    hQ_map.json \
    ../../source/main.min.js
```

Outputs the SDK context for each DYNAMIC field, e.g.:

```
RTEwewNQMUg= (plain): "RTEwewNQMUg="] % 10 + 1) ...        → state.no
M2MGKXUOBB8= (plain): "M2MGKXUOBB8="] = iR(oB(), n)) ...   → HMAC(uuid, UA)
M2EHKXUOBB4= (hQ):    hQ(521) ... NSEAa3NAC18= ... = Xa() → uuid
```

---

## 4.3 Technique 3: Search Browser API Names (Covers Environment-Collection Fields)

Obfuscators can't rename browser API names (renaming them would break native call dispatch). So **every navigator/screen/window/document property is greppable**.

### 4.3.1 Common API grep Patterns

```bash
# Decoded value is "Win32" → grep navigator.platform
grep -n 'navigator.platform' main.min.js
# → hits: e["dEABCjEhBjA="] = hU && hU.platform

# Value is 1920 → grep screen.width
grep -n 'screen.width\|screen\[' main.min.js
# → e["KV0dX284Gm4="] = screen.width

# UA
grep -n 'navigator.userAgent' main.min.js

# Browser features
grep -n 'navigator.cookieEnabled\|navigator.onLine\|navigator.language' main.min.js

# Screen
grep -n 'window.innerWidth\|window.outerWidth\|screen.colorDepth' main.min.js

# WebGL/Canvas/Audio (rarely obfuscated)
grep -n 'WebGLRenderingContext\|HTMLCanvasElement\|AudioContext\|OfflineAudioContext' main.min.js
```

### 4.3.2 Scan All navigator/screen/window Properties in One Pass

```bash
grep -oE '(navigator|screen|window|document|location|history|performance)\.[a-zA-Z]+' main.min.js | sort -u
```

May output 50+ varieties. Map each to a DYNAMIC field.

---

## 4.4 Technique 4: Search Magic Numbers (Covers Algorithm Fields)

Each algorithm has its "signature number". Use it to locate:

### 4.4.1 Algorithm-Layer Magic Constant Quick Reference

| Constant | Algorithm | Purpose |
|---|---|---|
| `1732584193` | MD5 init A | MD5 implementation |
| `909522486` | HMAC ipad (0x36363636) | HMAC |
| `1549556828` | HMAC opad (0x5C5C5C5C) | HMAC |
| `122192928e5` or `12219292800000` | UUID v1 | RFC 4122 Gregorian → Unix |
| `2147483647` | INT32_MAX | `ml()` hash function |
| `4294967296` | `2^32` | memory.jsHeapSizeLimit (4 GB) |
| `268435455` | `0x0FFFFFFF` | UUID v1 timeLow mask |
| `0xE0100` or `917760` | Plane 14 base | sid Unicode Tag steganography |
| `4210` or `0x1072` | XOR mask | Bundle Myanmar DOM encoding |
| `2863` | hash factor | Field mixing function |

### 4.4.2 PX-Custom Constants

```bash
grep -nE "1732584193" main.min.js              # MD5 init
grep -nE "909522486|0x36363636" main.min.js    # HMAC ipad
grep -nE "122192928e5" main.min.js             # UUID v1
grep -nE "2147483647" main.min.js              # ml()
grep -nE "4294967296" main.min.js              # 2^32
grep -nE "0xE0100|917760" main.min.js          # sid steganography
grep -nE "F@bt" main.min.js                    # base91 alphabet
```

### 4.4.3 Algorithm Control-Flow Patterns

```bash
# djb2 hash variant
grep -nE "<<\s*5\)\s*-\s*[a-z]" main.min.js   # (hash << 5) - hash

# ml() function
grep -nE "31\s*\*\s*[a-z]\s*\+.*charCodeAt" main.min.js
# Hits: n = (31 * n + t.charCodeAt(e)) % 2147483647

# Anti-tamper dynamic key computation
grep -nE "% 10 \+ 2\|% 10 \+ 1" main.min.js
# Hits te() computing anti-tamper

# OB segment splitting
grep -nE 'split\("\|"\)\|split\("~~~~"\)' main.min.js
```

---

## 4.5 Technique 5: Static Analysis from the Entry Function (Understanding Groupings)

The SDK's fingerprint-collection main entry (typically named `Dd` / `mh` / `Gl` / `lp`) calls multiple sub-functions, each filling a group of fields:

```javascript
function Dd(t) {
    ev(t);    // Safety detection (~15 fields)
    nv(t);    // Special values
    av(t);    // Timestamps
    ov(t);    // Screen/display (~10 fields)
    iv(t);    // Language/timezone
    cv(t);    // Hardware
    $d(t);    // anti-tamper
    tv(t);    // Single-value fields
}
```

### 4.5.1 Locate the Main Entry

```bash
# Find the largest "collector" function (calls multiple v* functions)
grep -nE '^function [a-zA-Z]{2}\(.\) \{' main.min.js | head -20

# Find the function just above the collector POST call
grep -nB 30 '/api/v2/collector' main.min.js | grep -E 'function [a-zA-Z]+\('
```

### 4.5.2 Read Sub-Functions for Inference

Read each sub-function (e.g., `ev(t)`) and use the exported hQ mapping to translate `hQ(499)`, `hQ(829)`, etc. into actual keys:

```javascript
function ev(t) {
    t.d[hQ(499)] = !!navigator.webdriver;       // hQ(499) = "Azt3eUVVd0w="
    t.d[hQ(521)] = navigator.platform;           // hQ(521) = "U0snSRYiIXM="
    t.d[hQ(842)] = navigator.language;           // hQ(842) = "aR1dHy91Vi4="
    // ...
}
```

→ The whole browser-identifier field group — 14 fields — is located at once.

---

## 4.6 Technique 6: Call-Stack Tracing (Covers HMAC and Other Chained Fields)

In Chrome DevTools:

```
1. Sources → find main.min.js → right-click Pretty Print
2. Search "btoa" or "fetch"; set a breakpoint on the line that calls the collector
3. Trigger PX → breakpoint hits
4. Walk up the Call Stack to find the event-building function (typically mh / build_ev2)
5. Set a breakpoint inside the event-builder
6. Re-trigger and inspect each field's assignment
```

### 4.6.1 Combat Example

Want to know how `M2MGKXUOBB8=` is computed:

```
1. Breakpoint before the collector POST call
2. Trigger; inspect events[0].d['M2MGKXUOBB8=']
3. Above the breakpoint find the most recent `e.d["M2MGKXUOBB8="] = ...` assignment
4. Step into RHS function → reveals it's HMAC-MD5(uuid, UA)
```

---

## 4.7 Technique 7: Pattern-Recognition Reverse Inference (Last Resort)

For fields the first 6 techniques can't find, infer from **value patterns** across 6+ batches:

```
8 samples: 3885, 4754, 4325, 3199, 5102, 4880, 3503, 4211
Observation: range 3000-5000; always approximately sendTs - initTime
Inference: this is performance.now(); equals sendTs - initTime
Verify: grep 'performance.now()' in SDK → hits ci() L1571 ✓
```

Or:

```
6 samples: false, false, false, false, false, false
Inference: this is a boolean STATIC field
Look at nearby fields → check if it's part of the bot-detection group (webdriver, etc.)
```

---

## 4.8 Cross-Version Invariant Quick Reference (grep Priority)

Sorted by resistance to obfuscation; more stable at top:

| Priority | Type | grep example | Why stable |
|---|---|---|---|
| ⭐⭐⭐⭐⭐ | RFC standard constants | `grep "1732584193"` | RFC-mandated; changing breaks the algorithm |
| ⭐⭐⭐⭐⭐ | Protocol delimiters | `grep '"~~~~"'`, `grep "split"` | Hard-coded server-side |
| ⭐⭐⭐⭐ | Browser API names | `grep "navigator.platform"` | Renaming breaks native dispatch |
| ⭐⭐⭐⭐ | Algorithm control-flow patterns | `grep "<< 5\) -"`, `grep "31\s\*\s.\s\*\+"` | Algorithm itself invariant |
| ⭐⭐⭐⭐ | Algorithm magic constants | `grep "2147483647"`, `grep "0xE0100"` | Algorithm-specific constants |
| ⭐⭐⭐ | Protocol endpoint URLs | `grep "tzm.px-cloud.net"` | Endpoint can't change freely |
| ⭐⭐ | EV b64 keys | `grep '"RTEwewNQMUg="'` | Stable across minor versions; changes on major versions |
| ⭐⭐ | Handler shapes | "1 arg + 13 digits = state.no" | Protocol shape stable; wire bytes change |
| ⭐ | Function name prefixes | `grep "function h"` | Prefix grouping stable |
| ✗ | Variable / function names | `hQ`, `mh`, `jt` | Fully reshuffled per obfuscation pass |
| ✗ | Line numbers | "L596" | Misaligned each release |

**Recommendation**: **always prefer the techniques higher in the list** (grep patterns); avoid specific names. This way your methodology won't need rewriting for 3 years.

---

## 4.9 27 OB Handler Shapes — Universal Table

OB segment handlers cannot be recognized by name (key characters `0/l` ↔ `o/I` ↔ `1/o` change across versions); recognize by args shape:

| Handler shape | Args count + types | Semantic |
|---|---|---|
| 1 arg + UUID (36 chars) | 1 string | state.pxsid / vid / cts |
| 1 arg + 13-digit ms timestamp | 1 string | state.no (serverNo) |
| 1 arg + 16-22 digit number | 1 string | state.to (anti-tamper seed) |
| 1 arg + 64 hex chars | 1 string | state.qa (challenge hash) |
| 1 arg + 12-30 lower alnum | 1 string | state.appId |
| 1 arg + 2-4 lower letters | 1 string | state.jf (cu / success / blocked) |
| 4+ args + 1st is `_px*` | 4+ mixed | set_cookie segment ⭐ |
| 3 args + features config | 3 mixed | Mr internal storage |
| 1 arg + base64 | 1 string | Internal state |
| 5 args + visual config (int+int+int+int+64hex) | 5 mixed | Visual challenge (Bundle use) |
| ... | ... | ... |

Full 27-handler shape table: [`../../../skill/AI_re/references/handler-table.md`](../../../skill/AI_re/references/handler-table.md).

---

## 4.10 Complete grep Quick Reference (by Algorithm Layer)

⭐ **This section is the most valuable quick reference in the project**. With a new SDK in hand, grep through this and locate everything in 30 minutes.

### 4.10.1 MD5 — grep init constant

```bash
grep -nE "1732584193" main.min.js
# Hits 1 line: var ... = 1732584193, ... = -271733879, ... = -1732584194, ... = 271733878;
#                       ↑              ↑                ↑                  ↑
#                       A              B                C                  D
```

### 4.10.2 HMAC — grep ipad / opad

```bash
grep -nE "909522486" main.min.js     # ipad
grep -nE "1549556828" main.min.js    # opad
# Hits 2 adjacent lines: h[e] = 909522486 ^ r[e], i[e] = 1549556828 ^ r[e];
```

### 4.10.3 XOR cipher — grep charCodeAt ^

```bash
grep -nE "charCodeAt\([^)]+\)\s*\^" main.min.js
grep -nE "\^\s*[a-z]\.charCodeAt" main.min.js
```

| Context | Purpose |
|---|---|
| `^ 50` or `^ "2"` (ASCII 50) | payload main XOR |
| `^ 10` | padding XOR |
| `^ <dynamic var>` | anti-tamper te() |
| `^ 120` or `% 128` | ob response XOR key |

### 4.10.4 base64 UTF-8 — grep fromCharCode + "0x"

```bash
grep -nE 'String\.fromCharCode\("0x"' main.min.js
grep -nE 'encodeURIComponent.*\.replace' main.min.js
```

Hits PX's base64 UTF-8 function `z()`:

```js
function z(t) {
    return btoa(encodeURIComponent(t).replace(/%([0-9A-F]{2})/g, function(e, n) {
        return String.fromCharCode("0x" + n);   // ← signature line
    }));
}
```

### 4.10.5 UUID v1 — grep Gregorian offset

```bash
grep -nE "122192928e5|12219292800000" main.min.js
# Hits: var p = (1e4 * (268435455 & (f += 122192928e5)) + s) % 4294967296;
```

### 4.10.6 djb2 hash — grep `<< 5 -`

```bash
grep -nE "<<\s*5\)\s*-\s*[a-z]" main.min.js
# Hits djb2 standard form (hash * 33 = (hash << 5) + hash variant)
```

### 4.10.7 ml() — grep 31 * acc or INT32_MAX

```bash
grep -nE "31\s*\*\s*[a-z]\s*\+.*charCodeAt" main.min.js
grep -nE "%\s*2147483647" main.min.js
# Hits: n = (31 * n + t.charCodeAt(e)) % 2147483647
```

### 4.10.8 OB decode — grep split patterns

```bash
grep -nE 'split\("\|"\)' main.min.js                   # intra-segment split
grep -nE 'split\("~~~~"\)\|split\(.~{3,4}.\)' main.min.js  # inter-segment split
```

### 4.10.9 SID Unicode steganography — grep Plane 14

```bash
grep -nE "0xE0100|917760|U\+E01" main.min.js
grep -nE 'codePointAt\(0\)\.toString\(16\)' main.min.js
```

### 4.10.10 Anti-tamper — grep % 10 ± coefficient

```bash
grep -nE "% 10 \+ 2\|% 10 \+ 1" main.min.js
grep -nE "\.charCodeAt\([^)]+\) \^ \(.+ % 10" main.min.js
```

---

## 4.11 Stage 4 Completion Criteria ✓

| Item | Verification |
|---|---|
| ✅ hQ_map.json generated | 1000+ entries |
| ✅ Algorithm layer fully located (grep all hit) | All 6 core constants found |
| ✅ DYNAMIC fields fully located | Each of 32 DYNAMIC fields annotated with SDK source |
| ✅ Anti-tamper rule confirmed | regex `/^[0-9:;<=>?@]{15,25}$/` |
| ✅ 27 OB handler shapes | Cross-referenced with [handler-table.md](../../../skill/AI_re/references/handler-table.md) |

---

## 4.12 Proceed to Stage 5

Stage 4 complete → you know where every DYNAMIC field comes from, but 4 **special fields are state.\* injected into specific EV2 b64 keys** that require "value matching" to locate → proceed to [Stage 5: Value-match ⭐⭐⭐](05_stage5_value_match.md).
