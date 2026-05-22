# Stage 6: Implement — Writing the Generator (Template Approach)

> **Time budget**: 1 h fluent / 4 h first-time
> **Deliverables**: `<site>_px3.js` — end-to-end cookie generator
> *Merges*: C/§5 (combat) + B/06_stage6_implement + A/§11 (template approach + algorithm layer)

---

## Chapter Positioning

By this chapter you should have:
- 9 algorithm modules (`../../../revers/`)
- Pinned SDK + 6 batch samples + decoded JSON
- `field_classes_ev2.json` (170/32/25 classification)
- `state_key_map.json` (7-field mapping)
- `<site>_ev2_template.json` (cold-visit template)

**This chapter glues them together and writes a generator.**

---

## 6.1 Core Strategy: **Template Approach**

> **STATIC fields are copied from the template; DYNAMIC fields are algorithmically generated.**

```javascript
// generator pseudocode
async function generatePx3(site) {
    // 1. Load template
    const ev2 = deepClone(loadTemplate(`${site}_ev2_template.json`));

    // 2. Generate dynamic context
    const uuid = uuidV1();
    const initTs = Date.now();
    const ua = USER_AGENT;

    // 3. Collector#1 — EV1 + state injection
    const ev1 = buildEv1(uuid, initTs, ua);
    const response1 = await postCollector(payload(ev1), pc(ev1), sid(uuid), 1);
    const state = parseOBState(response1.body);
    // state = { no, appId, to, qa, vid, pxsid, jf }

    // 4. Override DYNAMIC fields in ev2 template
    overrideDynamicFields(ev2, {
        state,
        uuid,
        initTs,
        ua,
        keyMap: loadStateKeyMap(site)
    });

    // 5. Anti-tamper
    applyAntiTamper(ev2, state);

    // 6. Collector#2 → _px3
    const response2 = await postCollector(payload(ev2), pc(ev2), sid(uuid), 2);
    const _px3 = parseOBCookie(response2.body, '_px3');

    return _px3;
}
```

See [`../../../stample/ifood/px_cookie/ifood_px3.js`](../../../stample/ifood/px_cookie/ifood_px3.js) for the full implementation.

---

## 6.2 DYNAMIC Field Overrides (By Subcategory)

### 6.2.1 Timestamp Fields (4)

```javascript
function overrideTimestamps(ev2, initTs) {
    const sendTs = initTs + randInt(200, 4500);   // sent 200ms-4.5s later
    const perfNow = sendTs - initTs;

    ev2.d[KEY_INIT_TIME] = initTs.toString();
    ev2.d[KEY_SEND_TIME] = sendTs.toString();
    ev2.d[KEY_PERF_NOW]  = perfNow.toString();
    ev2.d[KEY_DATE_STR]  = new Date(initTs).toString();
}
```

`KEY_INIT_TIME` etc. are determined by Stage 4 (grep) + Stage 5 (value match).

### 6.2.2 UUID + HMAC (4)

```javascript
const uuid = uuidV1();   // session UUID, fixed for whole session
const hmacUuid = hmacMd5(ua, uuid);
const hmacVid = hmacMd5(ua, state.vid);
const hmacPxsid = hmacMd5(ua, state.pxsid);

ev2.d[KEY_UUID]       = uuid;
ev2.d[KEY_HMAC_UUID]  = hmacUuid;
ev2.d[KEY_HMAC_VID]   = hmacVid;
ev2.d[KEY_HMAC_PXSID] = hmacPxsid;
```

### 6.2.3 state.* Injection (7) ⭐ Stage 5's Key Deliverable

```javascript
const keyMap = loadStateKeyMap(site);

ev2.d[keyMap.no]    = parseInt(state.no);     // ⚠️ Must parseInt! See gotcha #14
ev2.d[keyMap.appId] = state.appId;
ev2.d[keyMap.to]    = state.to;
ev2.d[keyMap.qa]    = state.qa;
ev2.d[keyMap.vid]   = state.vid;
ev2.d[keyMap.pxsid] = state.pxsid;
ev2.d[keyMap.jf]    = state.jf;
```

⚠️ **`state.no` must be `parseInt()`'d!** The server returns a number; after OB decoding it becomes a string; writing into EV2 requires converting back to number or PC computes wrong. This gotcha cost 3 hours (see [`../../../bug_report/1_collector_path.md`](../../../bug_report/1_collector_path.md) #14).

### 6.2.4 Anti-tamper (2)

```javascript
// Formula: te(seed, n)
const noModN = parseInt(state.no) % 10;
const keyOffset = noModN + 2;
const valueOffset = noModN + 1;

const atKey = te(state.to, keyOffset);
const atValue = te(state.to, valueOffset);

// Inject — atKey itself is the EV2 field name
ev2.d[atKey] = atValue;
```

See [`../../../revers/antitamper.js`](../../../revers/antitamper.js).

### 6.2.5 Memory Fields (3)

```javascript
ev2.d[KEY_USED_JS_HEAP]   = randInt(30_000_000, 80_000_000);
ev2.d[KEY_TOTAL_JS_HEAP]  = randInt(80_000_000, 150_000_000);
ev2.d[KEY_JS_HEAP_LIMIT]  = 4294967296;   // Fixed value (2^32), Chrome universal
```

See [`../../../revers/memory.js`](../../../revers/memory.js).

### 6.2.6 Counters (5)

```javascript
ev2.d[KEY_SEQ]          = randInt(2, 8);
ev2.d[KEY_PERF_MARK]    = randInt(4000, 9000).toString();
ev2.d[KEY_COUNTER_1]    = randInt(1, 4);
ev2.d[KEY_COUNTER_2]    = randInt(0, 3);
// ...
```

### 6.2.7 /ns Fields (2)

```javascript
const ns = await fetchNs(uuid);   // async fetch /ns response
ev2.d[KEY_NS_SM]       = ns.sm;       // null is OK (gotcha #25)
ev2.d[KEY_NS_DURATION] = ns.duration; // 0 is OK
```

### 6.2.8 Error Stack (1)

```javascript
ev2.d[KEY_ERROR_STACK] = TYPEERROR_STACK_TEMPLATE;
// Fixed string extracted from captures; see constant in ../../../revers/payload.js
```

### 6.2.9 timing chain (1)

```javascript
ev2.d[KEY_TIMING_CHAIN] = [109, 66, 66, 70, 80, randInt(60, 90)].join('|');
```

### 6.2.10 ENTROPY (Canvas / WebGL / Audio fingerprint hashes, ~5)

```javascript
// Treat as STATIC — use fixed values captured from a real browser
// Do not try to recompute in Node! It gets detected (see bundle/doc/Bundle_完整技术文档.md §10.8)
ev2.d[KEY_CANVAS_HASH] = CANVAS_HASH_FROM_TEMPLATE;
ev2.d[KEY_WEBGL_HASH]  = WEBGL_HASH_FROM_TEMPLATE;
ev2.d[KEY_AUDIO_HASH]  = AUDIO_HASH_FROM_TEMPLATE;
```

---

## 6.3 Serialization and Send

### 6.3.1 PX Custom serialize

```javascript
const { serialize, encryptPayload } = require('../../../revers/payload.js');

const ev2Json = serialize(ev2);   // ⚠️ Not JSON.stringify
const ev2Encrypted = encryptPayload(ev2Json, TAG);
```

### 6.3.2 PC (HMAC-MD5 Integrity Check)

```javascript
const { computePC } = require('../../../revers/pc.js');
const pc = computePC(ev2Encrypted, TAG);
```

### 6.3.3 SID (Unicode Tag Steganography)

```javascript
const { encodeSid } = require('../../../revers/sid.js');
const sid = encodeSid(uuid);
```

### 6.3.4 POST

```javascript
const body = `payload=${encodeURIComponent(ev2Encrypted)}&pc=${pc}&sid=${sid}&ft=${FT}`;
const response = await fetch(`https://${COLLECTOR_HOST}/api/v2/collector?app=${APP_ID}&tag=${TAG}&...`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
});
```

See `postCollector()` in [`../../../stample/ifood/px_cookie/ifood_px3.js`](../../../stample/ifood/px_cookie/ifood_px3.js).

---

## 6.4 _px3 Cookie Extraction

```javascript
const { decodeOB, extractCookie } = require('../../../revers/ob.js');

const ob = await response.text();
const segments = decodeOB(ob, TAG);
const _px3 = extractCookie(segments, '_px3');
// Shape: { value, expires, domain, path, ... }
```

See [`../../../revers/ob.js`](../../../revers/ob.js).

---

## 6.5 The "Comparison Validation" Mode (Defense Against Typos)

After writing the generator, before running Stage 7, **do a comparison validation pass first**:

```javascript
// Generator produces EV2
const evMy = generateEv2(uuid='c83577f0-...', initTs=1771962830422, ...);

// Diff against a real captured EV2
const evReal = loadDecoded('samples/1/decoded_payload_2.json');

const diff = diffJson(evMy, evReal);
console.log(diff);   // Expected: only DYNAMIC fields differ; STATIC fully match
```

If STATIC fields differ → your template was loaded incorrectly.
If DYNAMIC fields are **missing** in your generator (key exists in evReal but not in evMy) → Stage 4 / 5 missed some fields.
If types mismatch (number vs string) → this is PX's most common silent bug.

---

## 6.6 Anti-tamper Full Call Order

```
1. parseInt(state.no) % 10 → noModN
2. atKey = te(state.to, noModN + 2)
3. atValue = te(state.to, noModN + 1)
4. ev2.d[atKey] = atValue
5. serialize(ev2) → ev2Json
6. encryptPayload(ev2Json, TAG) → payload=
7. computePC(ev2Encrypted, TAG) → pc=
8. POST collector#2
```

**Any single step out of order → PC computes wrong → server rejects.**

---

## 6.7 Template Update Strategy

`<site>_ev2_template.json` is not permanent:

| SDK change | Does template need rework? |
|---|---|
| Minor version (weekly patches) | Usually no |
| Major version (monthly) | Yes — recapture 1 batch, verify field count matches; if new fields appear, patch into template |
| Major version + b64 key dictionary changed | **Full rework** (Stages 1 → 5 → 6) |

Template freshness: **run Stage 7 monthly; if `_px3` still validates, don't update**.

---

## 6.8 Cross-Platform Porting (Brief Mention; Details in [`08_cross_platform.md`](08_cross_platform.md))

- Node ✓ — this project's primary target
- Python — translate `revers/*.js` to Python (MD5/HMAC/UUID/base64 all have standard libraries; ~1-2 days)
- Go — similar; ~1-2 days
- C# / Java — similar

**Key**: keep the 9 algorithm modules cross-language consistent.

---

## 6.9 Stage 6 Completion Criteria ✓

| Item | Verification |
|---|---|
| ✅ `<site>_px3.js` written | Can invoke generatePx3() |
| ✅ Comparison validation passes | Generator EV2 vs real EV2, STATIC fully equal |
| ✅ DYNAMIC fields complete | Generator EV2 contains all 32 DYNAMIC keys |
| ✅ Types correct | parseInt applied where needed; state.* all properly typed |
| ✅ Anti-tamper key computed correctly | atKey is consistent across 6 batch comparison |

---

## 6.10 Proceed to Stage 7

Stage 6 complete → your generator runs but hasn't been verified against the live network → proceed to [Stage 7: Validate](07_stage7_validate.md).
