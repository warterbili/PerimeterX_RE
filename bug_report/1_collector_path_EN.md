# Silent Collector Path — Gotcha Collection

Silent mode covers 99% of traffic (`main.min.js` / `init.js`, 2 collector POSTs to obtain `_px3`/`_px2`).
Grouped by "protocol / encoding / algorithm / state injection / template / PC validation".

For press-challenge Bundle path gotchas see [`2_bundle_path.md`](2_bundle_path.md).

---

## A. Protocol / Encoding / Wire Format

### #1 ⭐⭐⭐ Replacing base64 `+` with Space While Decoding POST Body

**Symptom**: decoding your captured collector POST body (via cdp-browser / DevTools "Copy as cURL"); EV1 decodes as partial JSON then suddenly garbage.

**Root cause**: in PX's collector POST body, **the base64 `+` character is preserved literally** (not `%2B`). If you apply the form-urlencoded standard's `+ → space` transform, base64 breaks.

**Fix**:
```javascript
// ❌ Wrong (base64's + gets eaten as space)
const payload = decodeURIComponent(raw.replace(/\+/g, '%20'));

// ✅ Right (preserve literal +)
const payload = decodeURIComponent(raw);
```

Python equivalent: `urllib.parse.unquote_plus(raw)` is wrong; use `urllib.parse.unquote(raw)`.

**Source**: `skill/AI_re/references/gotchas.md` Bug #14

---

### #2 ⭐⭐ UTF-8 vs Latin-1 base64

**Symptom**: payload length differs by 30+ characters; PC mismatch; `{"do":[]}` rejection.

**Root cause**: `Date.toString()` in the Chinese locale contains "中国标准时间". After XOR(50), some characters ≥0x80. UTF-8 encodes such a character as 3 bytes; Latin-1 as 1 byte. The SDK does `encodeURIComponent()` (UTF-8) → `btoa()`.

**Fix**:
```javascript
Buffer.from(t, 'utf-8').toString('base64')   // ✅
// Don't use 'binary' / 'latin1'
```

**Source**: `skill/AI_re/references/gotchas.md` Bug #2; `ifood-web/collector无感纯算还原/纯算还原.md:254, 832-870`

---

### #3 ⭐⭐ OB Response Decoded as binary, Not UTF-8

**Symptom**: decoded ob is entirely garbage.

**Root cause**: the OB response is **server-generated**; it does **not** go through the SDK's `z()` UTF-8 encoding. It's a raw binary byte stream.

**Fix**:
```javascript
Buffer.from(ob, 'base64').toString('binary')   // ✅
// .toString('utf-8') ❌ corrupts ≥0x80 bytes
```

**Source**: `ifood-web/collector无感纯算还原/纯算还原.md:313, 870`

---

### #4 ⭐⭐ OB Separator Is **Four** Tildes `~~~~`, Not Three

**Symptom**: OB response split fails; handler matching collapses; 0 segments.

**Root cause**: the separator is `~~~~` (4 bytes of 0x06 before XOR), not `~~~`.

**Fix**: `.split("~~~~")`, four tildes.

**Source**: `ifood-web/collector无感纯算还原/纯算还原.md:640`; `bundle#1.md:8`; `BUNDLE_COMPLETE_ANALYSIS.md:1983`

---

### #5 ⭐⭐ Handler Key Is At the Start of Each Segment; Use `shift()` Not `pop()`

**Symptom**: handler matching returns wrong results; args don't line up.

**Root cause**: each segment is formatted `handlerKey|arg1|arg2|...`; the key is at the front.

**Fix**: `const handlerKey = fields.shift(); const args = fields;` — drop the first field (handler names aren't reusable across versions; discard); the rest are args.

**Source**: `ifood-web/collector无感纯算还原/纯算还原.md:639`; `BUNDLE_COMPLETE_ANALYSIS.md:1912-1913`

---

### #6 ⭐ URLSearchParams Treats base64 `+` as Space

**Symptom**: a capture tool uses URLSearchParams to parse the POST body, the base64 `+` becomes space, decoding fails.

**Root cause**: URLSearchParams strictly implements form-urlencoded spec (`+ → space`).

**Fix**: parse the raw POST body yourself; split on `&`, then `decodeURIComponent` each `key=value` (not `decodeURIComponent` + `+ → space`).

**Source**: `bundle#1.md:163`; `bundle#2.md:569`; same family of issues as #1, different surface

---

## B. Algorithm Layer (payload / PC / OB)

### #7 ⭐⭐⭐ De-interleave Must Iterate Back-to-Front

**Symptom**: after de-interleaving the payload is scrambled; splice deletes wrong positions.

**Root cause**: after `splice(offset, 1)` removes a character, all subsequent characters' indices shift left. Iterating front-to-back means the 2nd offset now points to the wrong position.

**Fix**:
```javascript
for (let i = offsets.length - 1; i >= 0; i--) {
    arr.splice(offsets[i] - 1, 1);   // ⭐ subtract 1 (offsets are 1-indexed)
}
```

**Source**: `ifood-web/collector无感纯算还原/纯算还原.md:632-634`

---

### #8 ⭐⭐⭐ De-interleave Offsets Are 1-Indexed; splice Must Subtract 1

**Symptom**: de-interleave misses or extra-removes a character; base64 decode fails.

**Root cause**: PX SDK's offset array is 1-indexed (PX counts from 1); JS `splice` is 0-indexed.

**Fix**: `splice(offsets[i] - 1, 1)`, not `splice(offsets[i], 1)`. Pairs with #7.

**Source**: `ifood-web/collector无感纯算还原/纯算还原.md:632-634`

---

### #9 ⭐⭐⭐ PC Uses PX Custom JSON Serialize, Not `JSON.stringify`

**Symptom**: PC HMAC-MD5 correctly implemented, server returns "invalid pc".

**Root cause**: the SDK's `it()` serialization differs from `JSON.stringify`:
- `undefined` → literal string `"undefined"` (not `null`)
- `NaN` / `Infinity` → `"null"` (not `NaN`)
- Doesn't drop empty properties (keys retained)
- Date object format differs from standard (no zero-padding)

**Fix**: implement PX serialize yourself, handling undefined / NaN / Date / nested objects per-field. See [`revers/pc.js`](../revers/pc.js).

**Source**: `ifood-web/collector无感纯算还原/纯算还原.md:256-276`

---

### #10 ⭐⭐ OB XOR Key Is Dynamic (Not Constant 100 or 120)

**Symptom**: hardcoded `xorKey=120` decodes OB; new SDK appears, garbage output.

**Root cause**: `xorKey = ml(gt) % 128`, where `gt` is a constant string in the SDK and changes on every PX push. iFood currently 100, Grubhub 91, older SDK 120.

**Fix**: extract `gt` from the current SDK; dynamically compute `xorKey = ml(gt) % 128` per session. Or use TAG directly (in many versions `gt === TAG`): see [`revers/ob.js`](../revers/ob.js).

**Source**: `BUNDLE_COMPLETE_ANALYSIS.md:1979-1982`; `ifood-web/collector无感纯算还原/纯算还原.md:1284`

---

### #11 ⭐⭐ djb2 Hash Requires `parseInt(state.no)` First

**Symptom**: fingerprint hash field value becomes `NaN`; collector rejects.

**Root cause**: `state.no` is the string `"1779263..."`; `Math.floor(string / 1000)` = `NaN`.

**Fix**: `Math.floor(parseInt(serverNo) / 1000)` or `Math.floor(Number(serverNo) / 1000)`.

**Source**: `ifood-web/collector无感纯算还原/纯算还原.md:337, 1373, 1725`

---

### #12 ⭐⭐ Collector#1 Uses a Default Timestamp as Interleave Key

**Symptom**: Collector#1 payload decoded content is garbled; serverNo doesn't exist yet.

**Root cause**: when Collector#1 fires, ob#1 hasn't returned, so `state.no` is undefined. The SDK uses the hardcoded fallback `"1604064986000"` (2020-10-30T17:16:26Z, PX's fixed "magic time") for interleave.

**Fix**:
```javascript
const interleaveKey = state.no || "1604064986000";
```

**Note**: this fallback is identical across all PX customers.

**Source**: `ifood-web/collector无感纯算还原/纯算还原.md:88-89`

---

### #13 ⭐⭐ Collector#2 Must Use Real serverNo; Don't Keep Using Fallback

**Symptom**: after Collector#1 obtains ob#1, Collector#2 still uses `"1604064986000"` for interleave → PC validation fails.

**Root cause**: by Collector#2 the SDK has obtained `state.no` from ob#1; you must use the real serverNo as the interleave key.

**Fix**: after obtaining ob#1, extract `state.no`; all subsequent POSTs use this value for payload interleave.

**Source**: `bundle#2.md:573`

---

## C. State Injection / EV2 b64 Key Mapping

### #14 ⭐⭐⭐ `state.no` Type Error (The Most Lethal Gotcha; ~90% of Newcomers Hit This)

**Symptom**: server `do:null` (PC accepted) but ob contains only 2 segments; `_px3`/`_px2` never issued.

**Root cause**:
- ob decoder extracts `state.no` as string `"1779131754075"`
- SDK expects number `1779131754075`
- Our serialize quotes the string → payload is 2 bytes longer than the SDK's
- Server passes PC validation (we serialize the same way), but **its semantic check** on actual event values catches that the timestamp field is a string = bot

**Fix**:
```javascript
// iFood:
d['RTEwewNQMUg='] = parseInt(ctx.state.no);

// Grubhub:
d['UT0ndxdcJUQ='] = parseInt(ctx.state.no);
```

**General rule**: **any numeric string from the ob decoder must be parseInt'd when referenced into an EV2 field**.

**Source**: `skill/AI_re/references/gotchas.md` Bug #1; confirmed in many archives

---

### #15 ⭐⭐⭐ `state.appId` Must Be Extracted From ob#1 Each Session; Don't Hardcode in Template

**Symptom**: server accepts PC but no _px3 is issued.

**Root cause**: each ob#1's `appId` is different (e.g., `d85mksfkqf1c73d7p7tg` vs `d85maqv7fdnc73boge5g`) — this is a **session-level** temporary appId, not the site's fixed init appId.

**Fix**:
```javascript
// iFood:
d['Xi5rJBtKaB4='] = state.appId;
// Grubhub:
d['CXV/P0wRfwU='] = state.appId;
```

**Note**: different from #16's init AppID.

**Source**: Desktop/新建文件夹/px-reverse-skill/references/gotchas.md:65-76

---

### #16 ⭐⭐ Init AppID ≠ Collector AppID (Two Different AppIDs)

**Symptom**: Bundle requests get 400; collector responses decode but appId fields don't match.

**Root cause**: iFood's init `appId` = `PXO1GDTa7Q` (used in the POST body `appId=` parameter), but the ob response's `state.appId` = temporary `d85mksfkqf1c73d7p7tg` (used in the EV2 d-field injection). Both coexist; don't mix.

**Fix**: store separately:
- POST body `appId=` parameter → use init AppID
- EV2 d-field appId slot → use ob#1's state.appId

**Source**: `ifood-web/collector无感纯算还原/纯算还原.md:6-11, 38-50`

---

### #17 ⭐⭐⭐ Anti-tamper Delete+Add Breaks Field Position

**Symptom**: all field values correct, but server still doesn't issue cookies.

**Root cause**:
```javascript
delete d[oldKey];     // delete
d[newKey] = newVal;   // newKey gets appended to the end of the object
```
JS object iteration order is insertion order. After this, newKey lands at the tail; the original anti-tamper position has moved; the serialized byte stream differs from the SDK's.

**Fix**: rebuild the dictionary preserving position
```javascript
const out = {};
for (const k of Object.keys(d)) {
    if (k === oldKey) out[newKey] = newVal;
    else out[k] = d[k];
}
```

**Source**: `skill/AI_re/references/gotchas.md` Bug #3; multiple duplicates

---

### #18 ⭐⭐ Anti-tamper Recognition Regex Misses Characters (Missing `:` and `;`)

**Symptom**: the anti-tamper key in the template isn't recognized; it gets skipped instead of replaced.

**Root cause**: anti-tamper key/value is `state.to` (string) XOR `(state.no % 10 ± 1)`. state.to is the digit string `"0123456789"`; XOR 1-12 yields ASCII 0x30-0x3F = `"0123456789:;<=>?"`.

**Fix**: regex `/^[0-9:;<=>?@]{15,25}$/` (don't omit `:` and `;`).

**Source**: Desktop/新建文件夹/px-reverse-skill/references/gotchas.md:54-63

---

### #19 ⭐⭐⭐ `state.*` → EV2 b64 Key Mapping Is **Completely Different Per Site**

**Symptom**: collector returns 200, state extraction correct, but no cookie obtained or downstream API still 403.

**Root cause**: EV2 has 4-5 fields sourced directly from `state.*`, but each site uses **different b64 keys**. A 13-digit value ≠ timestamp — looks like timestamp, may actually be a session token. **Type-based guessing fails.**

**Lookup table**:

| Semantic | iFood key | Grubhub key |
|---|---|---|
| `state.no` | `RTEwewNQMUg=` | `UT0ndxdcJUQ=` |
| `state.to` | `FCAhKlJCIxk=` | `UBxmVhZ+Z2U=` |
| `state.appId` | `Xi5rJBtKaB4=` | `CXV/P0wRfwU=` |

**Fix**: use cross-batch value matching (not type guessing) — see [`stample/*/script/find_state_keys.py`](../stample/) and [`skill/AI_re/scripts/find_state_keys_in_ev2.py`](../skill/AI_re/scripts/find_state_keys_in_ev2.py).

**Source**: Desktop/新建文件夹 (3)/docs/_gotchas_grubhub.md:25-41

---

### #20 ⭐⭐ EV1 and EV2 Cannot Share the Same b64 Key (Even for Same Semantic)

**Symptom**: all field types/values correct, PC validation passes, but cookie still rejected on protected endpoints (e.g., /auth). Field count is 1 more than the browser.

**Root cause**: **the same semantic uses different b64 keys in EV1 vs EV2**. Grubhub's `/ns duration`:
- In EV1 = `DFQ2Ekk4PSU=`
- In EV2 = absent!

Copying iFood's "EV1/EV2 both have duration" logic to Grubhub → EV2 has an extra key it shouldn't → mismatch.

**Fix**: **EV2 field set can only be what the template has**, never more, never less. Assert:
```javascript
assert(JSON.stringify(Object.keys(myEv2).sort()) === JSON.stringify(Object.keys(template).sort()));
```

**Source**: Desktop/新建文件夹 (3)/docs/_gotchas_grubhub.md:45-66

---

### #21 ⭐⭐ sid Uses `state.pxsid`, Not the Session uuid

**Symptom**: sid parameter doesn't match the SDK's; server rejects.

**Root cause**: the SDK uses ob#1's `state.pxsid` (site-level session ID) for sid, not the HTTP session's uuid.

**Fix**:
```javascript
sid = generateSid(state.pxsid, String(state.no));   // NOT uuid
```

**Source**: Desktop/新建文件夹/px-reverse-skill/references/gotchas.md:78-87

---

### #22 ⭐⭐ sid Format Differs Per Request Phase

**Symptom**: sid rejected at Bundle#2; embedded timestamp validation fails.

**Root cause**:
- **Collector#1**: `sid = uuid` (raw UUID)
- **Bundle#1**: `sid = uuid` (same)
- **Bundle#2+**: `sid = uuid + hh(serverNo)` (appended Unicode Tag Char steganographed timestamp)

**Fix**: choose sid format per POST phase; only add Unicode steganography in Bundle#2+.

**Source**: `bundle#1.md:263-271`

---

### #23 ⭐⭐ The UA in HMAC Fields Must Be Byte-Identical to the HTTP Header's UA

**Symptom**: HMAC field computed correctly but server rejects.

**Root cause**: HMAC(uuid, UA)'s UA must be byte-for-byte equal to the HTTP `User-Agent:` header.

**Fix**: define a single `DEFAULT_UA` constant at the top of the generator; use this one variable for both HMAC computation and the HTTP request.

**Source**: Desktop/新建文件夹/px-reverse-skill/references/gotchas.md:112-127

---

### #24 ⭐⭐ Field Type Issues Aren't Limited to state.no — Multiple Fields Have Number vs String Requirements

**Symptom**: varies widely; usually 403 + values look correct.

**Root cause**: each field's `typeof` in the template is the authority and cannot be changed:
- `initTime` / `sendTime` / `performance.now()` → must be number
- `uuid` / `appId` / `FCAhKlJCIxk` → must be string
- `state.no` injected into EV2 → number (gotcha #14)
- Timestamps (`Date.now()`) → number

**Fix**: treat the template's `typeof` as ground truth; don't carelessly `String()` / `parseInt`.

**Source**: Desktop/新建文件夹/px-reverse-skill/references/gotchas.md:129-149

---

## D. /ns + Timing

### #25 ⭐⭐ `/ns` Is Async; At Collector#1 Time /ns Hasn't Returned → sm/duration Are null/0

**Symptom**: in the Collector#1 payload some fields are null/0; "fingerprint mismatch".

**Root cause**: `/ns?c={uuid}` is an async request. Collector#1 typically fires ~200ms after browser load; `/ns` very often hasn't returned. The SDK in this situation sends sm field `null`, duration `0`.

**Fix**:
- Collector#1: sm = null, duration = 0 → **normal**; just replicate
- Collector#2 / Bundle: use the actual returned /ns values

**Source**: `ifood-web/collector无感纯算还原/纯算还原.md:73-78`

---

### #26 ⭐⭐ Error Stack Line Numbers Must Match the SDK Version

**Symptom**: Collector#2 rejected; error stack hash computes wrong.

**Root cause**: the SDK deliberately triggers `TypeError: Cannot read properties of null (reading '0')` and uses the stack trace as a fingerprint field. The line numbers in the stack (e.g., `_r @ main.min.js:1208:21`) must match the target SDK's obfuscated line numbers.

**Fix**: capture a real stack from the browser running the target SDK; don't fabricate or use old-version line numbers.

**Source**: `ifood-web/collector无感纯算还原/纯算还原.md:133, 1666-1700`

---

### #27 ⭐ `cts` Field Type Varies Per POST Phase

**Symptom**: Bundle#2 validation fails; cts type wrong.

**Root cause**:
- Collector / Bundle#1: `cts = UUID string`
- Bundle#2: `cts = millisecond timestamp` (number-as-string)

**Fix**: switch by phase:
```javascript
cts = (phase === 'collector' || phase === 'bundle1') ? state.cts : Date.now().toString();
```

**Source**: `bundle#1.md:282-289`

---

## E. EV Template + Validation Protection

### #28 ⭐⭐ EV1/EV2 b64 Keys Fully Reshuffle Across SDK Versions

**Symptom**: hardcoded b64 keys don't match the new SDK's real payload; decoded fields are wrong.

**Root cause**: 229 b64 keys are dynamically generated in the SDK via "array + rotation + offset lookup"; PX rotates this on every push.

**Fix**: **never hardcode key mappings**. On every SDK upgrade, run `extract_hQ.js` against the new SDK to extract the dictionary, or run `find_state_keys.py` for cross-batch value matching.

**Source**: `ifood-web/collector无感纯算还原/纯算还原.md:454-455`; detailed in [`4_sdk_drift.md`](4_sdk_drift.md)

---

### #29 ⭐ Handler Call Chain Has Deliberately Reordered Parameters (Don't Trust the Order)

**Symptom**: PoW solver computes wrong hashes; challenge never solves.

**Root cause**: the handler receives `(t,e,n,r,a)` but internally calls `Bs(n,e,r,a==="true")` — parameter 1 becomes parameter 3; `a` is string-to-boolean-converted. **Deliberate obfuscation.**

**Fix**: use a debugger to trace to the real call site; map by actual signature, not by parameter order.

**Source**: `BUNDLE_COMPLETE_ANALYSIS.md:1919-1921, 1934-1936`

---

### #30 ⭐ Python sid Contains Unicode Tag Chars; `requests` Default Encoding Truncates Them

**Symptom**: Python correctly implements the sid algorithm, but the server still rejects what's sent; equivalent Node code passes.

**Root cause**: sid contains Plane 14 Unicode Tag Chars (U+E0100+), "invisible". Python's `requests` URL-encodes by default; some versions drop them or convert to `?`. Chrome's "Copy as cURL" also drops them.

**Fix**:
- Use `urllib.parse.quote_plus(sid, safe='')` for explicit encoding
- Verify `len(sid.encode('utf-8'))` matches the expected byte count
- **Don't use Chrome "Copy as cURL"** to capture sid

**Source**: Desktop/新建文件夹/px-reverse-skill/references/gotchas.md:101-111

---

### #31 ⭐ `state.appId` Is Not the Init AppID (Reconfirmed)

(Pairs with #16's "two AppIDs coexist": init AppID in POST parameter; state.appId in EV2 d-field)

---

## F. Endpoints / Protocol Paths

### #32 ⭐ iFood `/v2/cardstack` Goes Through Strict WAF; `/v1` Doesn't

**Symptom**: `/v2/cardstack/search/home` constantly 403s (Cloudflare rejection); the same body to `/v1` passes.

**Root cause**: iFood configured strict WAF on `/v2`, but `/v2` is actually deprecated; the active version is `/v1`.

**Fix**: use `/v1/cardstack/search/home` for business APIs; never `/v2`.

**Source**: `ifood-web/pentest_api/doc/02_ifood_risk_control_analysis.md:283-286`

---

## G. Cookie Lifecycle

### #33 ⭐⭐ `_px3` / `_px2` Cookie TTL Expires Mid-Job; Business API Silently Fails

**Symptom**: long-running (≥10 min) tasks: the first dozens of business API calls work, then suddenly all fail — **no errors**, just empty data / redirect to challenge page. Code unchanged, IP unchanged.

**Root cause**: `_px3` / `_px2` has a TTL (iFood default 330s, Grubhub default 500s, **specified in the OB#2 `set_cookie` segment**). After expiry the business API still uses the old cookie; PX backend detects → restarts the challenge flow. But your generator doesn't know, and keeps firing.

**Fix**:
1. Extract TTL from OB#2 set_cookie segment; record `cookie.expiresAt = Date.now() + ttl * 1000`
2. Before each business API call check: `if (Date.now() > cookie.expiresAt - 30_000) await refreshCookie()` (refresh 30s early)
3. In long-running tasks, proactively re-run the collector flow at least every 5 minutes

**General rule**: a cookie is a session ticket, not a permanent identity. **Any long-running task must have refresh logic**.

**Source**: `perimeterX_Re/docs/07_gotchas/14_cookie_ttl.md`

---

*Press-challenge Bundle path gotchas: see [`2_bundle_path.md`](2_bundle_path.md)*
