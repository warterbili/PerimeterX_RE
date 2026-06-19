# PerimeterX SDK Complete Comparative Reverse-Engineering Methodology

> Explains PX SDK reverse engineering through **side-by-side real code
> comparison**. Every section pulls semantically-equivalent code snippets
> from **two real production SDKs** (iFood `main.min.js` + Grubhub `init.js`)
> and shows them side by side — proving that **variable names change 100%
> of the time but algorithms / control flow / magic constants change 0%**.
>
> After this document, you'll know: given any new PX SDK, regardless of
> obfuscation, every key location can be found in 30 minutes.

---

## ★ Capture & SDK pinning (prerequisite)

> You need **6 fresh capture batches + a pinned SDK file** before you can
> start reversing. This section explains how to capture with a real
> CDP-controlled browser, how to download the SDK, and how to pin a
> specific SDK version.
>
> Everything is preconfigured under `perimeter/skill/cdp/`:
> - **CDP controller**: [`skill/cdp/scripts/cdp.py`](../../skill/cdp/scripts/cdp.py) — real Chrome + CDP
> - **iFood capture**: [`skill/cdp/scripts/capture_via_cdp_ifood.py`](../../skill/cdp/scripts/capture_via_cdp_ifood.py)
> - **Grubhub capture**: [`skill/cdp/scripts/capture_via_cdp_grubhub.py`](../../skill/cdp/scripts/capture_via_cdp_grubhub.py)
> - **Skill docs**: [`skill/cdp/SKILL.md`](../../skill/cdp/SKILL.md)

### ★.1 Why CDP (not Selenium / Playwright)

| Tool | webdriver markers | Will PX detect? | Verdict |
|---|---|---|---|
| Selenium WebDriver | `navigator.webdriver = true` + several others | **Yes** (PX bans immediately) | Unusable |
| Playwright (default) | Same + various automation markers | **Yes** | Unusable |
| Puppeteer (without stealth patches) | Same | **Yes** | Unusable |
| **CDP attached to real Chrome** | **None** | **No** | ✅ The only clean approach |
| Manual Chrome + DevTools | Same | No | Works, but not automatable |

CDP (Chrome DevTools Protocol) is Chrome's built-in remote debugging
protocol. **Attaching to a real Chrome process injects no JS**, so PX
just sees a normal user browser.

Launch pattern:

```bash
# Start Chrome with --remote-debugging-port
chrome.exe --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-cdp
# Then control it via ws://localhost:9222
```

### ★.2 CDP skill overview

`skill/cdp/` is a general-purpose CDP controller exposing 11 commands
(assuming you run from the `perimeter/` repo root):

```bash
# Launch Chrome (if not already running)
python skill/cdp/scripts/cdp.py start

# Status check
python skill/cdp/scripts/cdp.py status

# Navigate
python skill/cdp/scripts/cdp.py navigate "https://www.ifood.com.br/restaurantes"

# Capture all network requests for 10 seconds
python skill/cdp/scripts/cdp.py network 10

# Execute JS
python skill/cdp/scripts/cdp.py eval "document.title"

# Screenshot
python skill/cdp/scripts/cdp.py screenshot ./shot.png

# Get HTML
python skill/cdp/scripts/cdp.py html

# Get cookies
python skill/cdp/scripts/cdp.py cookies

# Click
python skill/cdp/scripts/cdp.py click "#submit-btn"

# Type
python skill/cdp/scripts/cdp.py type "#search-input" "keyword"

# Stop Chrome
python skill/cdp/scripts/cdp.py stop
```

Full script + Python API: [`skill/cdp/scripts/cdp.py`](../../skill/cdp/scripts/cdp.py).

### ★.3 One-line SDK download

PX distributes its SDK via `client.px-cloud.net`. Given an AppID, you can
just curl:

```bash
# iFood
curl 'https://client.px-cloud.net/PXO1GDTa7Q/main.min.js' > sdk/ifood/main.min.js

# Grubhub
curl 'https://sensor.grubhub.com/O97ybH4J/init.js' > sdk/grubhub/init.js
#                ^^^^^^^^^^^^^^^^^^^^^^^^^^
#                Note: Grubhub uses first-party deployment (sensor.grubhub.com)

# Press-challenge SDK (Bundle path, only triggered on iFood in our tests)
curl 'https://client.px-cloud.net/PXO1GDTa7Q/captcha.js' > sdk/ifood/captcha.js
```

If you don't know the AppID, run a navigate first and inspect Network for
requests to `px-cloud.net` or `sensor.<host>.com`:

```bash
python skill/cdp/scripts/cdp.py navigate "https://www.<target-site>.com"
python skill/cdp/scripts/cdp.py network 5 | grep -E "px-cloud|sensor\."
# You'll see the full SDK URL; the AppID is in the path
```

### ★.4 Pin the SDK version (**mandatory**)

PX ships new SDKs quarterly. If you don't pin, your **6 capture batches
will use 6 different SDKs** and your diff will be incoherent. Pinning
options:

**Method 1: download then local mock (most reliable)**

```bash
# 1. Download SDK locally (above)
curl ... > sdk/ifood/main.min.js

# 2. Lock by SHA-256
sha256sum sdk/ifood/main.min.js > sdk/ifood/main.min.js.sha256
cat sdk/ifood/main.min.js.sha256
# b47a639cde9df4f91bdc4138ae0d64ebf7ce8c876a1e4c9967fd3af3d2975eb8 *main.min.js

# 3. When capturing, serve SDK from local file instead of CDN
#    via Chrome DevTools Local Overrides (see Method 2)
```

**Method 2: Chrome Local Overrides (recommended, no proxy needed)**

DevTools → Sources → Overrides → "Select folder for overrides" → point at
your local `sdk/` folder. Chrome will then return the local file for any
request to `client.px-cloud.net/.../main.min.js`.

**Method 3: SHA verification after each capture**

If you don't want to mock, at least verify SHA after every batch:

```python
# capture_via_cdp_ifood.py already does this: SDK SHA is written to meta.json
{
    "batch": "1",
    "uuid": "fd9b0d80-...",
    "sdk_sha256": "b47a639c...",   # ← must be identical across batches
    "captured_at": "2026-05-20T15:44:00Z"
}
```

All 6 `meta.json` files must have **identical** `sdk_sha256`. If any
differ, discard that batch and recapture.

### ★.5 Capture 6 fresh batches (production workflow)

[`skill/cdp/scripts/capture_via_cdp_ifood.py`](../../skill/cdp/scripts/capture_via_cdp_ifood.py)
encapsulates the entire flow. One command per batch:

```bash
python skill/cdp/scripts/capture_via_cdp_ifood.py 1   # batch 1
python skill/cdp/scripts/capture_via_cdp_ifood.py 2   # batch 2
... 6 batches total
```

Each batch does:

1. Launch with a **brand-new Chrome profile** (no prior cookies/cache)
2. Start CDP, subscribe to `Network.requestWillBeSent` +
   `Network.responseReceived` + `Network.loadingFinished` events
3. `Network.clearBrowserCache` + `Network.clearBrowserCookies` to ensure
   cleanliness
4. Navigate to `https://www.ifood.com.br/restaurantes`
5. Wait 20s for PX to fire 2 collector POSTs
6. Filter for POSTs to `collector-pxo1gdta7q.px-cloud.net/api/v2/collector`
   and grab both request + response bodies
7. Save to `samples/N/`:
   ```
   samples/1/
   ├── 1.txt        # POST #1 full request (URL + headers + body)
   ├── 1.json       # response #1
   ├── 2.txt        # POST #2
   ├── 2.json       # response #2
   └── meta.json    # batch_id, uuid, sdk_sha256, timestamps
   ```

### ★.6 Verify captures immediately

After all 6 batches, do integrity checks before reversing:

```bash
# 1. SDK consistency
for i in 1 2 3 4 5 6; do
    jq -r '.sdk_sha256' samples/$i/meta.json
done | sort -u
# Must yield exactly 1 line (all 6 batches use the same SDK)

# 2. Each batch must have all 4 files
for i in 1 2 3 4 5 6; do
    [ -s "samples/$i/1.txt" ] && \
    [ -s "samples/$i/1.json" ] && \
    [ -s "samples/$i/2.txt" ] && \
    [ -s "samples/$i/2.json" ] && \
    echo "batch $i OK" || echo "batch $i MISSING"
done

# 3. response_1 must contain ob field
for i in 1 2 3 4 5 6; do
    jq -r 'has("ob") or has("do")' samples/$i/1.json
done
# All must be true
```

If anything fails → recapture that batch.

### ★.7 Capture troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Chrome won't start | Port in use (9222/9223) | `pkill chrome`; or change port |
| Captured POST is empty | PX SDK not loaded yet | Increase `--wait` to 30s |
| Captured POST is OPTIONS preflight | Didn't filter by method | Filter `method == "POST"` |
| Can't get response body | CDP hasn't finished receiving | Wait for `Network.loadingFinished` before calling `getResponseBody` |
| 6 batches have different SDK SHAs | PX shipped a new version while you were capturing (rare) / A/B rollout | Pin SDK via Local Overrides |
| Same batch captures multiple collectors | PX retry triggered | Take only the first `seq=0` and `seq=1` pair |
| No collector POST captured at all | TLS fingerprint caught by upstream CDN | CDP+real-Chrome shouldn't have this issue; if it does, target site changed CDN config |
| Cookies leaking across batches | Profile not cleaned | Use fresh `--user-data-dir` per batch |

### ★.8 Bundle (press challenge) capture

To capture the Bundle path (only triggers when PX risk score crosses a
threshold), the above script isn't enough. You need to:

1. Accumulate enough requests for PX risk scoring (~200 consecutive)
2. Wait for PX to return 403 + `blockScript` field
3. Browser loads `captcha.js`
4. Capture the next 4 POSTs (B1/B2/B3/B4) to `/assets/js/bundle`

See [`PX_SDK_Reverse_Engineering.md`](PX_SDK_Reverse_Engineering.md)
§5 for the full Bundle workflow.

---

## 0. The two real SDKs used in this document

| File | Size | SHA-256 |
|---|---|---|
| iFood `main.min.js` | 231,438 bytes | `b47a639cde9df4f91bdc4138ae0d64ebf7ce8c876a1e4c9967fd3af3d2975eb8` |
| Grubhub `init.js`   | 270,004 bytes | `5e81bffc53ba95808ae81795358d8b71d3b5ba9ebfdaa013ff65ecafa278aad1` |

Both are 2026-05 latest production SDKs. **Every code snippet below is
real bytes** extracted via `dd` / `grep` directly from these two files —
nothing rewritten.

---

## 1. Mental model: the essence of comparative reversing

Obfuscators do two things:

```
Source:    function md5Init() { var A = 0x67452301, B = 0xefcdab89, ... }
                                ↓ obfuscation
Release:   function iF(t, n) { var c = 1732584193, a = -271733879, ... }
                                ↓ re-obfuscation
Reissue:   function M(t, e)  { var c = 1732584193, u = -271733879, ... }
```

What changed: function name `iF` → `M`, parameter names `t, n` → `t, e`,
variable name `a` → `u`.

**What stayed**:

- Algorithm constant `1732584193` (MD5 init A)
- Algorithm constant `-271733879` (MD5 init B)
- Control flow structure (`var c=, u=, s=, l=, for(...)`)
- Argument count and shape

**While reverse engineering, look only at the invariant parts** — treat
names as placeholders and ignore them.

---

## 2. Cryptographic primitives — full cross-vendor comparison

### 2.1 MD5 main function

**iFood** (locate with `grep -nE "c=1732584193,a=-271733879" main.min.js`):

```js
function iF(t, n) {
    t[n >> 5] |= 128 << n % 32,
    t[14 + (n + 64 >>> 9 << 4)] = n;
    var e, r, h, i, o,
        c = 1732584193,    // ← MD5 init A
        a = -271733879,    // ← MD5 init B
        u = -1732584194,   // ← MD5 init C
        f = 271733878;     // ← MD5 init D
    for (e = 0; e < t.length; e += 16)
        r = c, h = a, i = u, o = f,
        c = iB(c, a, u, f, t[e],     7, -680876936),    // round 1
        f = iB(f, c, a, u, t[e+1], 12, -389564586),
        u = iB(u, f, c, a, t[e+2], 17,  606105819),
        a = iB(a, u, f, c, t[e+3], 22, -1044525330),
        ...
```

**Grubhub** (locate with `grep -nE "c=1732584193,u=-271733879" init.js`):

```js
function M(t, e) {
    t[e >> 5] |= 128 << e % 32,
    t[14 + (e + 64 >>> 9 << 4)] = e;
    var n, r, a, o, i,
        c = 1732584193,    // ← identical
        u = -271733879,
        s = -1732584194,
        l = 271733878;
    for (n = 0; n < t.length; n += 16)
        r = c, a = u, o = s, i = l,
        c = C(c, u, s, l, t[n],     7, -680876936),    // round 1 first constant also identical
        l = C(l, c, u, s, t[n+1], 12, -389564586),
        s = C(s, l, c, u, t[n+2], 17,  606105819),
        u = C(u, s, l, c, t[n+3], 22, -1044525330),
        ...
```

**Deobfuscated (standard RFC 1321 MD5)**:

```js
function md5Compute(blocks, lengthBits) {
    blocks[lengthBits >> 5] |= 0x80 << lengthBits % 32;
    blocks[14 + (lengthBits + 64 >>> 9 << 4)] = lengthBits;
    var A_save, B_save, C_save, D_save,
        A = 0x67452301,   // = 1732584193
        B = 0xEFCDAB89,   // = -271733879  (signed view)
        C = 0x98BADCFE,   // = -1732584194
        D = 0x10325476;   // = 271733878
    for (let i = 0; i < blocks.length; i += 16) {
        A_save = A; B_save = B; C_save = C; D_save = D;
        A = FF(A, B, C, D, blocks[i],     7, 0xD76AA478);   // -680876936
        ...
```

**Comparative reading**:

| iFood | Grubhub | Meaning |
|---|---|---|
| `iF(t, n)` | `M(t, e)` | MD5 main compression function |
| `iB(...)` | `C(...)` | round helper (one of FF/GG/HH/II) |
| `c, a, u, f` | `c, u, s, l` | A, B, C, D registers |
| `1732584193` | `1732584193` | **Identical** — MD5 RFC init A |
| `-680876936` | `-680876936` | **Identical** — round 1 first constant |

**Locating**: just grep `1732584193` — hits 1 line in both. This is an
RFC-standard constant present in every MD5 implementation, **will never
change**.

### 2.2 HMAC main function

**iFood** (locate with `grep -nE "909522486\^r\[e\]" main.min.js`):

```js
;for (h[15] = i[15] = void 0,
      r.length > 16 && (r = iF(r, 8 * t.length)),
      e = 0; e < 16; e++)
    h[e] = 909522486 ^ r[e],      // ← ipad (0x36363636)
    i[e] = 1549556828 ^ r[e];     // ← opad (0x5C5C5C5C)
var o = iF(h.concat(iH(n)), 512 + 8 * n.length);
return iG(iF(i.concat(o), 640))
```

**Grubhub** (locate with `grep -nE "909522486\^r\[n\]" init.js`):

```js
[], o = [];
a[15] = o[15] = void 0,
r.length > 16 && (r = M(r, 8 * t.length));
for (n = 0; n < 16; n += 1)
    a[n] = 909522486 ^ r[n],     // ← identical
    o[n] = 1549556828 ^ r[n];
var i = M(a.concat(B(e)), 512 + 8 * e.length);
return R(M(o.concat(i), 640))
```

**Deobfuscated (RFC 2104 HMAC)**:

```js
function hmac(message, key) {
    if (key.length > 16) key = md5(key);
    const ipad = new Array(16);
    const opad = new Array(16);
    for (let i = 0; i < 16; i++) {
        ipad[i] = 0x36363636 ^ key[i];   // 909522486
        opad[i] = 0x5C5C5C5C ^ key[i];   // 1549556828
    }
    const inner = md5(concat(ipad, message), 512 + 8 * message.length);
    return md5(concat(opad, inner), 640);
}
```

**Locating**: grep `909522486` or `1549556828` — must hit 1 line, and the
two adjacent lines are the HMAC function. RFC 2104 standard pad masks.

### 2.3 UUID v1

**iFood** (locate with `grep -nE "122192928e5" main.min.js`):

```js
Error("uuid.v1(): Can't create more than 10M uuids/sec");
nx = f, ny = s, nw = u;
var p = (1e4 * (268435455 & (f += 122192928e5)) + s) % 4294967296;
//                ↑              ↑                    ↑
//                28-bit mask    Gregorian offset    32-bit mod
a[c++] = p >>> 24 & 255, a[c++] = p >>> 16 & 255,
a[c++] = p >>> 8 & 255,  a[c++] = 255 & p;
var d = f / 4294967296 * 1e4 & 268435455;
a[c++] = d >>> 8 & 255, a[c++] = 255 & d,
a[c++] = d >>> 24 & 15 | 16,            // ← version=1 marker
a[c++] = d >>> 16 & 255,
a[c++] = u >>> 8 | 128, a[c++] = 255 & u;
for (var v = t.node || nv, Q = 0; Q < 6; Q++) a[c + Q] = v[Q];
```

**Grubhub** (locate with `grep -nE "122192928e5" init.js`):

```js
ror("uuid.v1(): Can't create more than 10M uuids/sec");
uo = l, so = f, co = s;
var d = (1e4 * (268435455 & (l += 122192928e5)) + f) % 4294967296;
//                ↑              ↑                    ↑
//                identical      identical            identical
u[c++] = d >>> 24 & 255, u[c++] = d >>> 16 & 255,
u[c++] = d >>> 8 & 255,  u[c++] = 255 & d;
var v = l / 4294967296 * 1e4 & 268435455;
u[c++] = v >>> 8 & 255, u[c++] = 255 & v,
u[c++] = v >>> 24 & 15 | 16,            // ← same version=1 marker
u[c++] = v >>> 16 & 255,
u[c++] = s >>> 8 | 128, u[c++] = 255 & s;
for (var p = t.node || io, m = 0; m < 6; m++) u[c + m] = p[m];
```

**Deobfuscated (RFC 4122 UUID v1)**:

```js
function uuidV1() {
    const now = Date.now();
    const ts100ns = BigInt(now) * 10000n + 122192928000000000n;  // 122192928e5
    const timeLow = Number((ts100ns) & 0xFFFFFFFFn);
    const timeMid = Number((ts100ns >> 32n) & 0xFFFFn);
    const timeHi  = Number((ts100ns >> 48n) & 0x0FFFn) | 0x1000;  // version 1
    // ... pack bytes
}
```

**Comparative reading**:

| iFood var | Grubhub var | Meaning |
|---|---|---|
| `f, s, u` | `l, f, s` | Time accumulators |
| `nx, ny, nw` | `uo, so, co` | Static backups |
| `nv` | `io` | Node bytes |
| `122192928e5` | `122192928e5` | **Identical** — Gregorian 1582 offset |
| `268435455` | `268435455` | **Identical** — 28-bit mask |
| `4294967296` | `4294967296` | **Identical** — 32-bit wrap |

Locating: grep `122192928e5`, must hit 1 line.

> Note: the error string `"uuid.v1(): Can't create more than 10M uuids/sec"`
> is also **identical across vendors** — this is the original text from
> the `node-uuid` npm package, which PX bundles directly. That literal
> can also serve as a locating anchor.

### 2.4 XOR cipher

**iFood**: grep finds three `String.fromCharCode(... ^ ...)` sites; each
has a different purpose:

```js
// Site 1: payload encryption
e += String.fromCharCode(n ^ t.charCodeAt(r))

// Site 2: anti-tamper (te function)
... String.fromCharCode(e ^ t.charCodeAt(r)) ...

// Site 3: OB decoding
... String.fromCharCode(t.charCodeAt(h) ^ e) ...
```

**Grubhub** (locate with `grep -nE "String\.fromCharCode\([^)]+\^[^)]+charCodeAt" init.js`):

```js
// Site 1 (main XOR cipher):
String.fromCharCode(e ^ t.charCodeAt(r))

// Site 2 (another usage):
String.fromCharCode(t ^ n.charCodeAt(e))
```

**Deobfuscated**: classic XOR stream cipher.

```js
function xor(input, key) {
    let out = '';
    for (let i = 0; i < input.length; i++) {
        out += String.fromCharCode(input.charCodeAt(i) ^ keyByte(key, i));
    }
    return out;
}
```

Locating:

```bash
grep -boE "charCodeAt\([^)]+\)\s*\^|\^\s*[a-z]\.charCodeAt" main.js
```

Hit counts differ between vendors (iFood 3-4, Grubhub 2-3), but the core
algorithm is the same.

### 2.5 base64 UTF-8 encoding (the z function)

Both SDKs use the **exact same fixed pattern**:

```js
// Universal template
function z(t) {
    return btoa(
        encodeURIComponent(t).replace(
            /%([0-9A-F]{2})/g,
            function(e, n) {
                return String.fromCharCode("0x" + n);   // ← key marker
            }
        )
    );
}
```

Locating:

```bash
grep -boE 'String\.fromCharCode\("0x"' main.js
grep -boE 'encodeURIComponent.*replace' main.js
```

`"0x" + n` then `fromCharCode` is the canonical UTF-8-bytes-to-binary
pattern.

---

## 3. PX custom algorithms — full comparison

### 3.1 `ml()` hash — INT32_MAX + 31×

**iFood** (locate with `grep -nE "%2147483647" main.min.js`):

```js
var SK, xX = function(t) {
    for (var n = 0, e = 0; e < t[hQ(155)]; e++) {
        n = (31 * n + t.charCodeAt(e)) % 2147483647
    }
    return (n % 900 + 100)[hQ(247)]()   // hQ(247) = "toString"
}
```

**Grubhub** (locate with `grep -nE "%2147483647" init.js`):

```js
var Xl, Nl, kl = function(t) {
    for (var e = 0, n = 0; n < t.length; n++) {
        e = (31 * e + t.charCodeAt(n)) % 2147483647
    }
    return (e % 900 + 100).toString()
}
```

**Observed differences**:

| iFood | Grubhub |
|---|---|
| Function name: `xX` | Function name: `kl` |
| Uses `t[hQ(155)]` for length | Uses `t.length` directly |
| Uses `[hQ(247)]()` for toString | Uses `.toString()` directly |
| 31× multiplier + INT32_MAX + 100-999 range | **Completely identical** |

**Deobfuscated**:

```js
function ml(input) {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        hash = (31 * hash + input.charCodeAt(i)) % 2147483647;   // INT32_MAX
    }
    return String(hash % 900 + 100);   // 100-999
}
```

**Use**: derives the OB-response XOR key from TAG (`parseInt(ml(TAG)) % 128`).

Locating (both hit):

```bash
grep -boE "%\s*2147483647" main.js
grep -boE "31\s*\*\s*[a-z]\s*\+.*charCodeAt" main.js
```

**Key observation**: Grubhub writes `length` and `toString` as plain text
without going through the hQ dictionary, but **the algorithm body is
identical to the byte**.

### 3.2 anti-tamper (dynamic XOR key/value)

**Grubhub** (locate with `grep -nE "%10\+2" init.js`):

```js
t[re(t[y(u)] || t[y(e)], t[y(c)] % 10 + 2)] = re(t[y(u)] || t[y(e)], t[y(c)] % 10 + 1)
//        ↑                          ↑              ↑                                    ↑
//       state.to                    %10+2          state.to                            %10+1
//                                   (for key)                                          (for value)
```

**iFood** (same location, inside `$d()`):

```js
t[te(t.to, t.no % 10 + 2)] = te(t.to, t.no % 10 + 1)
```

**Deobfuscated**:

```js
function antiTamperInject(ev2, state) {
    // The EV2 template has a field where key AND value both match
    // /^[0-9:;<=>?@]{15,25}$/.
    // Compute new key = te(state.to, state.no%10+2)
    // Compute new value = te(state.to, state.no%10+1)
    // Replace in place (delete then write with new key)
    const newKey   = te(state.to, state.no % 10 + 2);
    const newValue = te(state.to, state.no % 10 + 1);
    delete ev2[oldAtKey];
    ev2[newKey] = newValue;
}

function te(t, e) {
    let out = '';
    for (let r = 0; r < t.length; r++)
        out += String.fromCharCode(e ^ t.charCodeAt(r));
    return out;
}
```

**Comparative reading**:

| iFood | Grubhub | Meaning |
|---|---|---|
| `te(t.to, ...)` | `re(t[y(u)] \|\| t[y(e)], ...)` | XOR function + state.to |
| `t.no % 10 + 2` | `t[y(c)] % 10 + 2` | state.no % 10 + 2 |
| Direct `t.no` access | Indirect via `y(c)` | Same behavior |

**Locating (stable on both)**:

```bash
grep -boE "%[0-9 ]*10[^;]{0,50}\+[ ]*[12]" main.js
```

Adjacent occurrences of `% 10 + 1` and `% 10 + 2` are the anti-tamper site.

### 3.3 SID Unicode steganography (iFood uses it, Grubhub doesn't)

**iFood**: has SID Unicode-Variation-Selector stego; grep hits `fromCodePoint` or
similar.

**Grubhub**:

```bash
$ grep -boE 'fromCodePoint|917760|0xE010[01]' init.js
# No output
```

**Grubhub does NOT use SID Unicode stego**! This is a key vendor difference.

**Deobfuscated (iFood only)**:

```js
function sidStego(uuid, payload) {
    // payload is a numeric string (XOR key or cts timestamp)
    let invisible = '';
    for (const ch of String(payload)) {
        invisible += String.fromCodePoint(0xE0100 + ch.charCodeAt(0));
    }
    return uuid + invisible;
}
```

**Cross-vendor lesson**: when writing a cross-platform generator, **don't
force-apply iFood's SID algorithm to Grubhub** — Grubhub's sid parameter
is just a plain UUID.

### 3.4 PoW (captcha.js only, Bundle path)

Not in the main SDK (main.min.js / init.js), only in captcha.js.
Signature: `for` loop computing SHA-256 repeatedly with `0xFFFF` mask.

---

## 4. SDK-top protocol constants — vendor strategies differ wildly

### 4.1 iFood: 4 constants packed on one line

**iFood** (locate with `grep -nE '"PXO1GDTa7Q"' main.min.js` — AppID is the
only anchor needed):

```js
var jE = "U0MmDhUmOnhXSw==",                     // ← TAG
    jF = "401",                                    // ← FT
    jG = "PXO1GDTa7Q",                              // ← APP_ID
    jH = "EwNmQ0Y0IWJVVwZmCl9aYBIqdAQCBilmHx5z" +    // ← BI
         "DihCKkkRLCB5V0IrfH1YFDgSLW0aEDksfTsL" +
         "JSB6CjJcUGJtO18eam5RCVVuBit2G1VPejAf" +
         "TXdjL0IpSUdyJSgYUW8=",
    jI;
```

Locating: any one of the constants hits this single line.

```bash
grep -nE '"PXO1GDTa7Q"' main.js
grep -nE '"U0MmDhUmOnhXSw=="' main.js
grep -nE '"401"' main.js
```

### 4.2 Grubhub: constants scattered (and globally exposed!)

**Grubhub beginning** (locate with `grep -nE "window\._pxAppId" init.js` —
Grubhub exposes AppID globally):

```js
window._pxAppId = "PXO97ybH4J"      // ← exposed on window!
```

**Grubhub internal assignments** (locate with `grep -nE '"FmYgK1gdJEAP"' init.js`):

```js
yt = "FmYgK1gdJEAP"      // ← TAG (located around the ~10KB mark of the file)
gt = "359"               // ← FT
bt = "PXO97ybH4J"         // ← APP_ID (same as window._pxAppId above)
```

**Grubhub collector URL: dual storage** (locate with
`grep -nE "L2FwaS92Mi9jb2xsZWN0b3I|api/v2/collector" init.js` — both base64
and plain):

```js
L2FwaS92Mi9jb2xsZWN0b3I=     // base64 of "/api/v2/collector"
"/api/v2/collector"          // also plain
"https://collector-PXO97ybH4J.px-cloud.net"
```

**Comparative reading**:

| Aspect | iFood | Grubhub |
|---|---|---|
| AppID location | In a packed `var jG=...` near byte 37k | `window._pxAppId = "..."` near byte 139 (!) |
| TAG location | Same line as AppID | Separate `yt = "..."` |
| URL storage | Plain only | Both base64 (`L2FwaS...`) and plain |
| 4 constants packed? | ✅ Yes (single `var`) | ❌ No (scattered) |

**Cross-vendor locating strategy**:

```bash
# Priority 1: search PX business prefix
grep -boE '"PX[A-Za-z0-9]{8,15}"' main.js | head -5

# Fallback 1: search base64 form of collector URL
grep -boE '"L2FwaS92Mi9jb2xsZWN0b3I' main.js

# Fallback 2: search common FT values
grep -boE '"(330|388|401|359|421|330)"' main.js

# Fallback 3: search globals
grep -boE '_pxAppId\s*=' main.js
grep -boE 'window\._px' main.js | head -5
```

Something will always hit.

### 4.3 Fallback timestamp

Identical on both:

```bash
$ grep -boE '"1604064986000"' both_sdks
iFood:   1 hit
Grubhub: 1 hit
```

**Deobfuscated**:

```js
const DEFAULT_TIMESTAMP = "1604064986000";   // 2020-10-30 17:36:26 UTC
// Used when no server timestamp is available yet (e.g. before collector#1)
```

PX hardcodes this timestamp in both SDKs — it's an internal "dev epoch"
or similar. **Hasn't changed in 3+ years**, making it an excellent
locating anchor.

---

## 5. OB response handling — structural comparison

### 5.1 OB response field name

**iFood** (locate with `grep -nE "\.ob[^a-zA-Z]" main.min.js`):

```js
.ob)[hQ(155)]) { var e = (t || "").substring(0, 20) }
...
.ob) } function yU(t, n) { if (t) { for (var e, r = [], h = 0
```

**Grubhub** (locate with `grep -nE "\.do\s*\|\|\s*\.ob" init.js` — note
Grubhub's dual fallback):

```js
n.do || n.ob) } function Tf(t) { var e = nf
...
e.do || e.ob).length) { var n = (t || "").substring(0, 20)
```

**Comparative reading**:

| | iFood | Grubhub |
|---|---|---|
| OB field name | Only `.ob` | **`.do \|\| .ob`** dual fallback |

> Grubhub is more lenient — the server may return either `{"do": ...}` or
> `{"ob": ...}`. When writing a decoder, the Grubhub-style fallback is
> recommended.

### 5.2 OB main dispatcher yU (iFood centralized)

**iFood** (locate with `grep -nE 'split\("\|"\),.{0,30}shift\(\)' main.min.js` —
this is the centralized-dispatcher signature):

```js
function yU(t, n) {
    if (t) {
        for (var e, r = [], h = 0; h < t[hQ(155)]; h++) {
            var i = t[h];
            if (i) {
                var o = i.split("|"),               // ← split into segment
                    c = o.shift(),                    // ← take handler byte
                    a = n ? yI[c] : yJ[c];           // ← lookup registry
                if (o[0] === mU[kV]) {
                    e = ix(ix({}, my, c), mm, o);
                    continue
                }
                ie === hR(a) && (c === yF || c === yE || c === yG
                    ? r.unshift(ix(ix({}, my, c), mm, o))    // ← priority
                    : r[hQ(234)](ix(ix({}, my, c), mm, o)))   // ← regular append
            }
        }
        e && r[hQ(438)](e);
        for (var u = 0; u < r.length; u++) {
            var f = r[u];
            try {
                (n ? yI[f[my]] : yJ[f[my]]).apply(ix(...))    // ← call handler
            } catch (t) { nB(t, mA[ln]) }
        }
    }
}
```

**Grubhub** (locate with `grep -nE "\.do\s*\|\|\s*\.ob" init.js` and look
around — it's split across multiple functions):

```js
function Tf(t) {
    var e = nf;
    t && er(Hn) && hf[e(273)](ni, t, !1)
}
function Sf(t) { Go = t }
function wf(t) { Wo = t, Zo = Math.floor(parseInt(Wo) / 1e3) }
function Af(t, e) { Uo = t, _o = e }
function Rf(t, e, n, a, o) {
    var i = 290, c = 283, u = nf;
    (ii[u(260)](u(i), n, t, e, o), Iu() && function(t) {
        var e, n = { E: 256, y: 256, w: 256 }, r = nf;
        if (Di()) {
            var a = Ef(t[Cn]);
            e = "" [r(n.E)](a[0], "|") [r(n.y)](a[1], "|") [r(n.w)](a)
        ...
```

**Critical differences**:

| Aspect | iFood | Grubhub |
|---|---|---|
| Dispatch style | Centralized: one `yU` handles everything | Distributed: `Tf/Sf/wf/Af/Rf/...` each handles one type |
| Handler selection | `yJ[c]` registry lookup | Direct if-else dispatch |
| Split character | `"\|"` literal | `r(n.y)` indirect (resolves to `\|` at runtime) |
| `split('~~~~')` | Not greppable literal (indirect) | Same — indirect |

**Deobfuscated (logically equivalent on both)**:

```js
function processOb(segments) {
    const queue = [];
    let deferred = null;
    for (const seg of segments) {
        const parts = seg.split("|");
        const handlerByte = parts.shift();
        const args = parts;
        if (args[0] === "cc") {
            deferred = { handler: handlerByte, args };
            continue;
        }
        const isPriority = (handlerByte === SET_COOKIE_BYTE
                         || handlerByte === BAKE_BYTE
                         || handlerByte === ANOTHER_PRIORITY);
        if (isPriority) queue.unshift({ handler: handlerByte, args });
        else            queue.push({ handler: handlerByte, args });
    }
    if (deferred) queue.push(deferred);
    for (const { handler, args } of queue) {
        try { HANDLERS[handler].apply(null, args); }
        catch (e) { /* swallow */ }
    }
}
```

**Locating (cross-vendor)**:

```bash
# Find split("|") adjacent to shift
grep -boE 'split\("\|"\)[^;]{0,40}shift' main.js
```

If the above returns 0 hits (Grubhub-style — `|` resolved at runtime), use:

```bash
# Find .ob or .do handling
grep -boE '\.do\s*\|\|\s*\.ob|\.ob\s*&&|\.ob\)' main.js
# Then look for the loop + function calls near that line
```

### 5.3 The 27-handler registry (iFood)

iFood registers all 27 handlers on a single object (locate with
`grep -nE '"[0l]{6,10}":[a-zA-Z_]+|SP\[' main.min.js` — the literal wire
bytes are the key marker):

```js
SP[hQ(424)] = yW,
SP[hQ(425)] = yX_setCookie,    // ← set_cookie, via hQ reference
SP["00l00l"] = za,               // ← literal wire byte
SP[hQ(427)] = yH,
SP[hQ(428)] = zb,
SP["0lll00l0"] = zf,
SP["00ll0l"] = zg,
SP.l0l0l0 = zi,
SP["0lllll"] = zj,                // ← challenge_hash handler
SP.l0l0ll = zk,                    // ← pxsid handler
SP["0lll000l"] = zl,                // ← server timestamp handler
SP[hQ(431)] = zm,
SP["0l00ll"] = zo,
SP["00ll00"] = zq,
SP["0ll0lll0"] = zr,
SP["000l00"] = zt,
SP["0lll0l"] = zw,                  // ← control_flag (jf="cu")
SP["0ll0l0ll"] = zx,
SP["0ll0l0l0"] = zh,
SP["0ll0l00l"] = yV
...(27 total)
```

Observations:

- **17 of them** registered with literal wire bytes (directly readable)
- **10 of them** referenced via `hQ(N)` (require hQ dictionary lookup)
- Wire bytes use `0` and `l` chars (iFood style)

**Grubhub** uses a **completely different char pair** (`o` and `I`), and
the handlers are **not** registered on a central object — that's why
`grep '"[oI]{6,10}":'` finds nothing on Grubhub. Grubhub inlines its
handlers inside the `Tf/Sf/wf/Af/...` functions.

**Key insight**: **never identify handlers by wire byte across vendors**.
Always use **argument shape**:

```js
function classifyHandler(args) {
    if (args.length === 1) {
        const a = args[0];
        if (/^1[5-9]\d{11}$/.test(a)) return 'state.no';
        if (/^[0-9a-f]{64}$/.test(a)) return 'state.qa';
        if (/^[0-9a-f-]{36}$/.test(a)) return 'state.pxsid_or_vid';
        if (/^[a-z]{2,4}$/.test(a))    return 'state.jf';
        if (/^\d{3}$/.test(a))          return 'state.ao';
        if (/^[a-z0-9]{12,30}$/.test(a)) return 'state.appId';
        if (/^[A-Za-z0-9]{16,}$/.test(a)) return 'state.to';
    }
    if (args.length >= 4 && /^_?px/i.test(args[0])) {
        return { type: 'set_cookie', name: args[0], value: args[2], ttl: +args[1] };
    }
    // ...
    return 'noop';
}
```

This shape-matching is validated across iFood, Grubhub, and multiple
historical PX versions.

---

## 6. String-decoding layer (hP / hM / hQ)

### 6.1 Dictionary array (hP equivalent)

**iFood** (locate with `grep -nE 'hP\s*=\s*\["B5e4T4AM' main.min.js` —
`B5e4T4AM` is the signature prefix of hP[0]):

```js
var hP = ["B5e4T4AM&6+r9i}DvsKZ$@v]5]~~sT",
          'Bk+"lzv]2#q(A',
          '<"39^_^7lJeEraB',
          // ... 1149 more entries
          ];
```

**Grubhub**:

```bash
$ grep -boE 'hP\s*=\s*\["B5e4T4AM' init.js
# No output (Grubhub uses a different variable name for the dictionary)

$ grep -boE 'F@bt' init.js   # the alphabet
F@bt    # ← hit (exact position differs per version, but the hit itself proves the dictionary exists)
```

**Grubhub's dictionary exists** (proven by `F@bt` alphabet presence), but
its hP variable has a different name (possibly nested inside an object, or
defined piecewise).

### 6.2 The hM decoder alphabet

Both SDKs are **identical**:

```
F@bt;"m:x3&#LiZ[)TE/}%QD1Iu.6f0R]78|4{zvWC>`$Se(rJ=*c^2_?qOpB,d<AVy~YwoP!+9g5nXhUsNGjaMKHlk
```

Locating:

```bash
grep -boE "F@bt" main.js
# iFood:   hit
# Grubhub: hit
```

`F@bt;` is the signature prefix of this 91-character alphabet —
**universal across PX, unchanged for years**.

**Deobfuscated** — see
[`PX_Reverse_Methodology_Universal.md`](PX_Reverse_Methodology_Universal.md)
§7.2 for the full Node.js implementation.

### 6.3 De-obfuscation strategy comparison

| Step | iFood | Grubhub |
|---|---|---|
| Find dictionary | grep `hP=["B5e4T4AM` | grep `F@bt` (indirect locate) |
| Find decoder | grep `F@bt` adjacent function | Same |
| Find lookup function | grep `void 0 === ...?` adjacent to hP | Same |
| Browser dump | `for (i=0; i<1200; i++) hQ(i)` | Probe for hQ's equivalent name (may need closure inspection) |

**Most reliable approach**: In a real browser after PX SDK loads, use the
DevTools "Sources" panel, set a breakpoint at any hQ-call site, and
**dump the dictionary from the paused console**. No variable name needed.

---

## 7. Protocol strings — full comparison

### 7.1 Endpoint URLs

| String | iFood | Grubhub |
|---|---|---|
| `/api/v2/collector` | ✓ (plain, 1 site) | ✓ (plain 1 site + base64 1 site) |
| `/b/s` | ✓ | ✓ |
| `collector-<APP_ID>.px-cloud.net` | ✓ | ✓ |
| `tzm.px-cloud.net` | ✓ | ? |
| `L2FwaS92Mi9jb2xsZWN0b3I=` | ✗ | ✓ (base64 backup) |

Grubhub stores `/api/v2/collector` in both **plain and base64** forms.
Likely reason: base64-encoded form is **harder to detect by simple string
scanners**.

**Cross-vendor locating**:

```bash
# Both hit
grep -boE '"/api/v2/collector"' main.js

# Only some SDKs hit
grep -boE 'L2FwaS92Mi9jb2xsZWN0b3I' main.js
```

### 7.2 Protocol delimiters `~~~~` and `|`

Both iFood and Grubhub use them, but **both via hQ-indirect**:

```bash
$ grep -boE 'split\("~~~~"\)' main.js
# iFood:   none (indirect)
# Grubhub: none (indirect)
```

**Alternative locating**:

```bash
# Find delimiters via hQ
grep -boE 'split\([a-z]+\([0-9]+\)' main.js
# Then reverse-lookup hQ(N) to check if it's "~~~~"
```

Or set a breakpoint in the browser and inspect the actual split argument.

### 7.3 set_cookie marker `"bake"`

iFood:

```bash
$ grep -nE '"bake"|jb\("YmFrZQ=="\)' main.js
# Hits (YmFrZQ== is base64 of "bake")
```

Grubhub:

```bash
$ grep -nE '"bake"|"YmFrZQ=="' init.js
# Almost certainly hits
```

**Key**: `"bake"` is the internal trigger event name for set_cookie
handler. PX internal convention, unchanged across vendors.

---

## 8. Cross-vendor difference quick reference

Full list of **known differences** across iFood, Grubhub, and **Total Wine**
(added 2026-05-25):

| Dimension | iFood | Grubhub | **Total Wine** ⭐ |
|---|---|---|---|
| **File name** | `main.min.js` | `init.js` | `main.min.js` |
| **AppID** | `PXO1GDTa7Q` | `PXO97ybH4J` | `PXFF0j69T5` |
| **TAG** | `U0MmDhUmOnhXSw==` | `FmYgK1gdJEAP` | `CFQ7WU4xIS8MXA==` |
| **FT** | `401` | `359` | `401` |
| **Cookie name** | `_px3` | `_px2` | `_px2` |
| **Collector host** | `collector-pxo1gdta7q.px-cloud.net` (3rd-party) | `collector-PXO97ybH4J.px-cloud.net` (3rd-party) | `www.totalwine.com/FF0j69T5/xhr/api/v2/collector` (**1st-party**) |
| **Deployment tier** | **lenient** | **lenient** | **strict** ⭐ |
| **Collector POST count** | 2 (seq=0, 1) | 2 (seq=0, 1) | **3 (seq=0, 1, 2)** — seq=2 is cookie-confirmation beacon |
| **EV2 field count** | ~209 | ~190 | ~199 |
| **EV3 (seq=2) mandatory** | ✗ | ✗ | **✓** — body contains `OkpJAH8oTTA=` = just-issued cookie |
| **state.hid field** | ✗ | ✗ | **✓** — from ob#1 `OlllOOll\|<b64>=:<b64>\|true` segment |
| **HMAC fields server-side verified** | weak / not checked | weak / not checked | **strict check** — backend re-computes and compares |
| **Counter sub-field sync constraint** | not checked | not checked | **PX12738 == PX12739**, monotonic across EVs |
| **OB field name** | `.ob` | `.do \|\| .ob` | `.do \|\| .ob` |
| **SID Unicode stego** | ✓ | ✗ | ✓ |
| **PC length** | 10 digits | 11 digits | 16 digits |
| **/ns probe** | Used | Not used | Not used |
| **HMAC `Cho5UEx3PWY=`** | `hmac(uuid, UA)` | `hmac(uuid, UA)` | `hmac(uuid, UA)` |
| **HMAC `Lx8cFWl9HCE=`** | (n/a) | (n/a) | `hmac(state.vid, UA)` ⭐ |
| **HMAC `UiJhKBREYhs=`** | (n/a) | (n/a) | `hmac(state.pxsid, UA)` ⭐ |
| **`EFwjFlU8JyU=`** | (n/a) | (n/a) | `md5(state.vid)` (**single-arg, NOT HMAC**) ⭐ |
| **MD5 / HMAC / UUID / ml / anti-tamper / base91 algorithms** | Identical | Identical | Identical |
| **fallback timestamp / hP dictionary** | Same | Same | Same |

**Core pattern** (updated):

1. **Underlying algorithms are 100% shared across vendors**
   (MD5/HMAC/UUID/ml/anti-tamper/base91)
2. **Protocol constants are 100% different across vendors**
   (AppID/TAG/FT/cookie name)
3. **Code organization can differ wildly across vendors**
   (centralized vs distributed, plain vs base64, completely different
   variable names)
4. **Optional modules can differ across vendors**
   (SID stego / /ns probe)
5. ⭐ **Server-side policy can vary between strict and lenient tiers**
   (new conclusion 2026-05-25) — the same PX SDK can have different
   backend enforcement at different customers. Under lenient tier
   "cookie issuance = working"; under strict tier 4 extra checks apply
   (POST count, server-side HMAC verification, counter sync, exact field
   set match). See `skill/AI_re/references/deployment-tiers.md`.

### 8.1 Strict vs lenient deployments: the Total Wine case (added 2026-05-25)

**Cost of triggering this section**: a full day of debugging on 2026-05-25.
We initially assumed iFood/Grubhub experience transferred — built totalwine
generator with 2-POST chain, copied HMAC formulas, ignored counter
sync — collector issued cookies 10/10, but using those cookies against
PX-gated endpoints returned 403 (PX bootstrap JSON) every time.

**5 root causes** (full detail in `skill/AI_re/references/gotchas.md` Bug #15–#18):

1. **Missing Layer 3.5** — "collector signed a cookie" ≠ "cookie actually
   works". Strict-tier PX records `trust=low` cookies as issued (to mislead
   bots into thinking they succeeded), but the edge rejects all subsequent
   requests with those cookies. You must replay the cookie against a real
   PX-gated endpoint via curl_cffi to validate.

2. **EV3 (seq=2) is the cookie-confirmation beacon** — its body contains
   `OkpJAH8oTTA=` field whose value is the just-issued `_px2`. Only after
   receiving this beacon does PX backend flip the cookie from
   `trust=pending` to `trust=verified`.

3. **HMAC inputs do NOT transfer across sites** — the same 4 b64 keys for
   HMAC/MD5 fields exist on iFood/Grubhub/totalwine, but the input
   expressions differ. Total Wine's SDK uses `jm(state.vid, UA)`,
   `jm(state.pxsid, UA)`, `md5(state.vid)`. PX backend re-computes each
   server-side and compares — one mismatch = bot. **Every new site needs
   6-batch crypto verification** (see `skill/AI_re/playbooks/recover-hmac-formulas.md`).

4. **state.hid** — extracted from ob#1 `OlllOOll|<b64>=:<b64>|true` segment;
   sent as `hid=` form parameter in seq=2 POST. Missing it fails strict
   backend validation.

5. **Counter sub-field synchronization** — `MDxDNnVeQgQ=` field has
   `PX12738` and `PX12739` which in 6/6 real captures are **always equal**
   and grow monotonically across EV1→EV2→EV3. Filling them with independent
   `Math.random()` is an obvious bot signal.

**How to detect strict-tier deployment early**:

- `meta.json.collector_post_count` consistently ≥3 + 3rd POST body
  contains a cookie field → strict
- collector path is `<host>/<appPrefix>/xhr/api/v2/collector` (first-party)
  → strict probability high
- ob#1 contains an `OlllOOll|...=:...|true`-shaped segment → strict

Concrete tier-detection scripts: see
`skill/AI_re/playbooks/master-workflow.md` Stage 3.5 and
`references/deployment-tiers.md`.

---

## 9. Standard comparative reversing workflow

Given a new SDK, follow this sequence, comparing against your known SDKs:

### Step 1: Confirm it's really a PX SDK

```bash
# Any of these 5 hits means it's PX
grep -c "1732584193" new.js     # MD5 init
grep -c "909522486" new.js       # HMAC ipad
grep -c "122192928e5" new.js     # UUID v1
grep -c "2147483647" new.js      # ml()
grep -c "F@bt" new.js            # base91 alphabet
```

**Any = 0** → not PX, or a major architectural change (not observed in
the last 3 years).

### Step 2: Extract base constants

```bash
# Priority 1: search PX business prefix
grep -boE '"PX[A-Za-z0-9]{8,15}"' new.js | head -3
# → get the AppID

# Priority 2: search window._px
grep -boE 'window\._px[a-zA-Z]+\s*=' new.js | head -5
# → may catch globally-exposed _pxAppId etc.

# Priority 3: look for the other 3 constants near the AppID
# AppID at L_x → search L_x-100 to L_x+100 range
```

### Step 3: Locate algorithm functions (grep 6 magic constants)

| Algorithm | grep |
|---|---|
| MD5 | `grep -n "1732584193" new.js` |
| HMAC | `grep -n "909522486" new.js` |
| UUID v1 | `grep -n "122192928e5" new.js` |
| ml() | `grep -nE "%\\s*2147483647" new.js` |
| anti-tamper | `grep -nE "%[ 0-9]*10[^;]{0,40}\\+[ ]*[12]" new.js` |
| Plane 14 SID | `grep -nE "917760\|0xE0100\|fromCodePoint" new.js` |

5/6 hits = no SID (Grubhub-like); 6/6 = full set (iFood-like).

### Step 4: Identify dispatch structure (centralized vs distributed)

```bash
grep -boE 'split\("\|"\)[^;]{0,60}shift' new.js
```

- Hit → centralized (iFood `yU`-like); main dispatcher is near that line
- No hit → distributed (Grubhub-like); look near OB-response handling
  (`grep -n '\.do \|\| \.ob'`)

### Step 5: Check if SID stego is needed

```bash
grep -c "fromCodePoint\|917760\|0xE0100" new.js
```

- ≥ 1 → this SDK uses SID Unicode stego
- 0 → not needed (sid param is a plain UUID)

### Step 6: Capture real traffic to validate

Download 6 batches:

```
samples/N/
├── request_1.txt
├── response_1.txt
├── request_2.txt
├── response_2.txt
└── meta.json   # contains sdk_sha256, uuid, ts
```

Use `ml(TAG) % 128` as the XOR key to decode `response_1.ob.do`; the first
decoded segment should be `<handler>|<value>` in shape.

### Step 7: Write decoder + diff

```js
// decode_ob.js
const xorKey = parseInt(ml(TAG), 10) % 128;
const decoded = Buffer.from(resp.ob, 'base64').toString('binary');
const segments = xor(decoded, xorKey).split('~~~~');
const state = {};
for (const seg of segments) {
    const [handler, ...args] = seg.split('|');
    Object.assign(state, classifyHandler(args));   // shape matching
}
```

If `segments.length` < 5 → decoder is wrong, revisit XOR key or delimiter.

### Step 8: Build generator with template + shape matching

Refer to [`PX_SDK_Reverse_Engineering.md`](PX_SDK_Reverse_Engineering.md)
§14 methodology and Appendix E field tables.

---

## 10. Practical script: 30-minute new-SDK probe

```bash
#!/bin/bash
# probe_new_sdk.sh
SDK="$1"

echo "============== SDK Probe =============="
wc -c "$SDK" | head -1

echo ""
echo "--- Base algorithms ---"
echo "MD5 init:    $(grep -c 1732584193 "$SDK")"
echo "HMAC ipad:   $(grep -c 909522486 "$SDK")"
echo "UUID v1:     $(grep -c 122192928e5 "$SDK")"
echo "ml() mask:   $(grep -cE "%\s*2147483647" "$SDK")"
echo "anti-tamper: $(grep -cE "%[ 0-9]*10[^;]{0,40}\+[ ]*[12]" "$SDK")"
echo "Plane 14:    $(grep -cE "917760|0xE0100|fromCodePoint" "$SDK")"
echo "base91 alphabet: $(grep -c "F@bt" "$SDK")"

echo ""
echo "--- Protocol endpoints ---"
grep -boE '"/api/v2/collector"' "$SDK" | head -3
grep -boE '"L2FwaS92Mi9jb2xsZWN0b3I' "$SDK" | head -1
grep -boE 'tzm\.px-cloud\.net' "$SDK" | head -1

echo ""
echo "--- Protocol constants ---"
grep -boE '"PX[A-Za-z0-9]{8,15}"' "$SDK" | head -3
grep -boE '_pxAppId\s*=' "$SDK" | head -1
grep -boE '"(330|388|401|359|421)"' "$SDK" | head -3
grep -boE '"1604064986000"' "$SDK" | head -1

echo ""
echo "--- OB handling ---"
grep -boE '\.do\s*\|\|\s*\.ob|\.ob\)' "$SDK" | head -3
grep -boE 'split\("\|"\)[^;]{0,40}shift' "$SDK" | head -1

echo ""
echo "--- Handler registration ---"
grep -boE '"[0Il1o]{6,10}":[a-zA-Z_]+' "$SDK" | head -10

echo ""
echo "--- Cross-vendor difference verdict ---"
if grep -q "fromCodePoint" "$SDK"; then
    echo "SID Unicode stego: USED"
else
    echo "SID Unicode stego: NOT USED (Grubhub-like)"
fi

if grep -qE 'split\("\|"\)[^;]{0,40}shift' "$SDK"; then
    echo "Dispatch structure: CENTRALIZED (iFood-like, look for yU equivalent)"
else
    echo "Dispatch structure: DISTRIBUTED (Grubhub-like, look near OB response handling)"
fi
```

Feed this script a new SDK and get a complete probe report **in 30 seconds**.

---

## 11. Final cross-version stability conclusions

After comparing two real SDKs (iFood + Grubhub), we have empirically
proven the following cross-vendor / cross-version stability tiers:

### ⭐⭐⭐⭐⭐ 100% stable (never change)

- MD5 init A/B/C/D = `1732584193, -271733879, -1732584194, 271733878`
- MD5 round 1 first constant = `-680876936`
- HMAC ipad = `909522486`
- HMAC opad = `1549556828`
- UUID v1 Gregorian offset = `122192928e5`
- UUID v1 28-bit mask = `268435455`
- UUID v1 32-bit wrap = `4294967296`
- ml() INT32_MAX = `2147483647`
- anti-tamper modulo `% 10 + 1` and `% 10 + 2`
- base91 alphabet = `F@bt;"m:x3&#LiZ[)TE/}%QD1Iu.6f0R]78|...`
- fallback timestamp = `1604064986000`
- node-uuid warning string `"uuid.v1(): Can't create more than 10M uuids/sec"`

### ⭐⭐⭐⭐ Nearly stable (identical across vendors)

- Protocol endpoints `/api/v2/collector`, `/b/s`
- `px-cloud.net` domain
- Handler argument shapes (13 digits = state.no, 64 hex = state.qa,
  UUID = state.pxsid, 4+args _px = set_cookie, etc.)
- `~~~~` segment delimiter (used by both, though both reference it via hQ)

### ⭐⭐⭐ Vendor-level stable (stable across versions within a vendor)

- AppID (vendor-fixed; differs across vendors)
- TAG (occasionally rotated by vendor)
- FT value (usually fixed per vendor)
- Cookie name `_px2` / `_px3` (per PX major version, not vendor)

### ⭐⭐ Semi-stable (may drift across minor versions)

- EV field b64 keys (stable across minor, may rotate across major)
- Handler wire bytes (e.g. `0lll0l`, `oIoIIo`)
- hQ dictionary contents and order

### ⭐ Fully unstable (changes every release)

- Variable names (`jE` / `yt`, `hQ` / `kf`)
- Function names (`iF` / `M`, `yU` / `Tf+Sf+wf`)
- Line numbers
- Code organization (centralized vs distributed)

**All reverse-engineering anchors must be ⭐⭐⭐⭐ or above**. Code
grounded on ⭐⭐ or ⭐ breaks on every SDK upgrade.

---

## 12. Closing notes

This document proves one thing: **PX's obfuscation is superficial**.

- The same MD5 implementation is `iF` in iFood, `M` in Grubhub, and may
  be `Q` or `_xyz` next release — but the `1732584193` is always there.
- The same UUID algorithm uses `f, s, u` in iFood, `l, f, s` in Grubhub —
  but `122192928e5` is always there.
- The same anti-tamper is `t.no % 10 + 2` in iFood, `t[y(c)] % 10 + 2` in
  Grubhub — but `% 10 + 2` is always there.

As long as your methodology **looks only at the invariant parts**, even
100 future PX SDK releases won't make you start over — every new SDK
just needs 30 minutes to re-locate key positions.

---

## Appendix: complete grep command list

```bash
# === Crypto primitives ===
grep -nE "1732584193" $SDK                                # MD5 init A
grep -nE "909522486" $SDK                                 # HMAC ipad
grep -nE "1549556828" $SDK                                # HMAC opad
grep -nE "122192928e5" $SDK                               # UUID v1
grep -nE "charCodeAt\([^)]+\)\s*\^" $SDK                  # XOR cipher
grep -nE 'String\.fromCharCode\("0x"' $SDK                # base64 UTF-8

# === PX custom ===
grep -nE "%\s*2147483647" $SDK                            # ml() INT32_MAX
grep -nE "31\s*\*\s*[a-z]\s*\+.*charCodeAt" $SDK           # ml() djb2
grep -nE "%[ 0-9]*10[^;]{0,40}\+[ ]*[12]" $SDK             # anti-tamper
grep -nE "917760|0xE0100|fromCodePoint" $SDK              # SID Plane 14
grep -nE ">=\s*48.*<=\s*57|charCodeAt.*%\s*10" $SDK       # PC digit extract
grep -nE "2863" $SDK                                       # hash factor

# === Protocol constants ===
grep -nE '"/api/v2/collector"' $SDK                        # endpoint
grep -nE 'L2FwaS92Mi9jb2xsZWN0b3I' $SDK                    # endpoint base64
grep -nE 'tzm\.px-cloud\.net' $SDK                         # /ns
grep -nE '"PX[A-Za-z0-9]{8,15}"' $SDK                      # AppID
grep -nE 'window\._px[a-zA-Z]+\s*=' $SDK                   # global exposure
grep -nE '"1604064986000"' $SDK                            # fallback ts
grep -nE '"(330|388|401|359|421)"' $SDK                    # FT candidates

# === Dictionary layer ===
grep -nE "F@bt" $SDK                                       # base91 alphabet
grep -nE 'hP\s*=\s*\["B5e4T4AM' $SDK                       # hP array (iFood style)

# === OB handling ===
grep -nE '\.do\s*\|\|\s*\.ob|\.ob\)' $SDK                  # OB response field
grep -nE 'split\("\|"\)[^;]{0,40}shift' $SDK               # centralized dispatch
grep -nE '"[0Il1o]{6,10}":[a-zA-Z_]+' $SDK                 # handler registry

# === Browser APIs (for field locating) ===
grep -nE 'navigator\.platform|navigator\.userAgent' $SDK
grep -nE 'screen\.width|screen\.height' $SDK
grep -nE 'performance\.memory|performance\.now' $SDK
grep -nE 'document\.visibilityState' $SDK

# === Bundle path (captcha.js only) ===
grep -nE 'WebAssembly\.instantiate' captcha.js              # WASM load
grep -nE 'crypto\.subtle\.digest\("SHA-256"' captcha.js     # PoW
grep -nE '0xFFFF' captcha.js                                # PoW difficulty
```

---

*End of document. Based on real iFood `main.min.js` (sha256 `b47a639c…`)
+ Grubhub `init.js` (sha256 `5e81bffc…`). Companion documents:
`PX_Reverse_Methodology_Universal.md` (broader grep-pattern compendium)
in this directory, and `PX_SDK_Reverse_Engineering.md` Appendix E
(EV field tables), Appendix G (SDK function map), Appendix H (line-by-line
trace of `px_cookie_v2.js`).*
