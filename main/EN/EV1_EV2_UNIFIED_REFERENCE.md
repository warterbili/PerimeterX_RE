# EV1 / EV2 Unified Field Reference

> **Goal**: turn every "why does my pure-algo reconstruction keep returning 403" field detail into a comparable template.
> **Platforms covered**: iFood (`PXO1GDTa7Q`) + Grubhub (`PXO97ybH4J`); methodology is universal.
> **Update data sources**: iFood SDK 2026-05-19 / Grubhub SDK 2026-05-19 (init.js sha256 `1013078d...`), 15+ batch samples.

---

## Mental Model (Strongly Recommend Reading First)

The PerimeterX collector endpoints receive **event arrays**:
```
collector#1 POST body = payload (encrypted serialize([ev1]))
collector#2 POST body = payload (encrypted serialize([ev2]))
```

Both `ev1` and `ev2` are **JavaScript objects** with the structure:
```javascript
{
    "t": "<base64 of event type label>",
    "d": {
        "<base64 key #1>": <value>,
        "<base64 key #2>": <value>,
        ...
    }
}
```

### Key Facts (90% of People Get These Wrong)

| Fact | Meaning |
|---|---|
| **b64 keys are not field names** | They are dictionary indices the PX SDK looks up via `hQ(N)`; **all keys regenerate** on every SDK upgrade |
| **Field positions are stable** | The same semantic (e.g. "URL", "uuid", "initTime") usually keeps its **position** in EV1/EV2 |
| **STATIC vs DYNAMIC differs across platforms** | One platform's STATIC (e.g. mouse track) can be another's DYNAMIC (e.g. Grubhub doesn't collect it) |
| **Anti-tamper fields dynamically generate keys** | Both key and value **are** outputs of `te(state.to, state.no%10+1or2)`, different every time; the template position must be preserved |
| **state.* values in ev2 mix number/string** | OB#1 returns them all as strings; **when writing to ev2, timestamps / o111val etc. must be parseInt** ⭐⭐⭐ |
| **Cold-visit vs warm-visit field count differs** | Cold-visit baseline = 204-205 fields (enough to obtain _px3/_px2); warm visits inject 25+ fields |

---

## EV1 Field Table

> 12-14 fields, structurally stable. All platforms have these semantic slots.

| # | Semantic | Type | iFood key | Grubhub key | Source / Algorithm | STATIC/DYNAMIC |
|---|---|---|---|---|---|---|
| 0 | **URL** (referrer) | string | `cgIHSDRhAX8=` | `ZHASeiITF00=` | `location.href` of host page (e.g. `"https://www.grubhub.com/login"`) | STATIC* |
| 1 | type counter | number | `XQkoAxhuKjY=` | `PAhKQnlvS3c=` | fixed `0` (cold) | STATIC |
| 2 | **navigator.platform** | string | `dEABCjEhBjA=` | `KDRePm1VWgQ=` | `navigator.platform` (e.g. `"Win32"`, `"MacIntel"`); must match UA | STATIC |
| 3 | counter | number | `egoPQDxmDXA=` | `fWlLIzsFShM=` | fixed `0` | STATIC |
| 4 | perf metric / random int | number | `PSkIY3tJDFE=` | `FCAiKlJAJRg=` | iFood: `Math.floor(300+rand*1600)`; Grubhub: observed 4400-5800 (higher range) | **DYNAMIC** |
| 5 | timezone offset | number | `Tl57FAs5fS4=` | `YGwWZiULE1w=` | `3600` (fixed; invariant across timezones?) | STATIC |
| 6 | **initTime** | number | `VQEgCxNnKjw=` | `aRVfHy9zVig=` | `Date.now()` ⭐ **must be number, not string** | **DYNAMIC** |
| 7 | **sendTime** | number | `bHgZcikfE0A=` | `GCQuLl1DJxw=` | `initTime + Math.floor(5+rand*10)` ⭐ number | **DYNAMIC** |
| 8 | **uuid** (session) | string | `NSEAa3NAC18=` | `LDhaMmpZUgY=` | `uuidV1()` (**the whole px2 flow uses the same one**) | **DYNAMIC** |
| 9 | /ns sm response | string\|null | `BzdyfUJXdks=` | `VGBiahEAZVw=` | body of `await fetch('https://tzm.px-cloud.net/ns?c=<uuid>')`; usually not yet returned at EV1 → `null` | STATIC* |
| 10 | /ns duration | number | `DFg5Ekk4PSU=` | `DFQ2Ekk4PSU=` | duration of (9)'s fetch; usually `0` at EV1 | STATIC |
| 11 | flag | boolean | `bHgZcioeHEk=` | `QS03ZwdLMVw=` | fixed `false` | STATIC |
| 12 | **pxhd** (warm-visit only) | string | `R3cyPQIVMAw=` | (Grubhub does not have this) | last server-issued pxhd; cold visit leaves `""` | CONDITIONAL |
| 13 | **PX12738 counter** (iFood only) | object | `cyNGaTZBQVs=` | (Grubhub does not have) | `{PX12738: rand(0,5), PX12739:0, PX12740:0, PX12741:-1}` | DYNAMIC |

**Event type `t:`**: iFood = `R3cyPQISOQo=`, Grubhub = `YjIUOCdXHA8=`; **changes on every SDK upgrade**.

### Complete EV1 Code Template (Python)

```python
def build_ev1(uuid_str: str, init_time: int, send_time: int, ns_result: dict) -> dict:
    return {
        "t": EV1_EVENT_TYPE,  # platform-specific
        "d": {
            EV1_KEYS["url"]:           "https://www.<host>.com/<path>",
            EV1_KEYS["type_counter"]:  0,
            EV1_KEYS["platform"]:      "Win32",         # must match UA
            EV1_KEYS["counter"]:       0,
            EV1_KEYS["perf"]:          random.randint(*PERF_RANGE),   # platform-specific range
            EV1_KEYS["tz_offset"]:     3600,
            EV1_KEYS["init_time"]:     init_time,       # int, NOT string!
            EV1_KEYS["send_time"]:     send_time,       # int, NOT string!
            EV1_KEYS["uuid"]:          uuid_str,
            EV1_KEYS["ns_sm"]:         ns_result.get("sm"),       # None on first call
            EV1_KEYS["ns_dur"]:        ns_result.get("duration", 0),
            EV1_KEYS["flag"]:          False,
        }
    }
```

---

## EV2 Key DYNAMIC Field Table (Must Be Algorithmically Generated)

> EV2 total fields 200+; 70-86% are STATIC (use template directly), 15-25% are DYNAMIC (must be generated per the table below), 3-15% are CONDITIONAL.
>
> **The table below lists only DYNAMIC** — this is the source of 90% of failure cases.

### A. Time / Session (5 fields, all numbers)

| Semantic | Type | iFood key | Grubhub key | Algorithm |
|---|---|---|---|---|
| **server timestamp** | **int** | `RTEwewNQMUg=` | `UT0ndxdcJUQ=` | `int(state.no)` ⭐⭐⭐ **must parseInt**, gotcha #1 |
| **initTime** | int | `VQEgCxNnKjw=` | `aRVfHy9zVig=` | `Date.now()` |
| **sendTime** | int | `bHgZcikfE0A=` | `GCQuLl1DJxw=` | `initTime + random(1000, 1500)` |
| **mid_time** | int | `W0suQR0tL3E=` | `EX1nN1cbZQc=` | `initTime + random(200, 2000)` (between init and send) |
| **uuid** | string | `NSEAa3NAC18=` | `LDhaMmpZUgY=` | Same uuid as in EV1 |

### B. Browser Runtime (4 fields)

| Semantic | Type | iFood key | Grubhub key | Algorithm |
|---|---|---|---|---|
| **Date.toString()** | string | `Czt+cU1WeEM=` | `UiJkKBRPYRo=` | `time.strftime('%a %b %d %Y %H:%M:%S GMT+0800 (中国标准时间)', time.localtime())` ⭐ Chinese standard time string literal |
| **performance.now()** | float | `PSkIY3tJDFE=` | `ICxWJmVMURE=` | `round(sendTime - initTime, 1)` |
| **memory.used** | int | `NABBSnJgQXE=` | `W0stQR0mL3A=` | `random.randint(40_000_000, 140_000_000)` |
| **memory.total** | int | `EX1kN1cQZQY=` | `FUFjS1MhYHA=` | `memory.used * random.uniform(1.1, 1.5)` |

### C. /ns Response (2 fields)

| Semantic | Type | iFood key | Grubhub key | Algorithm |
|---|---|---|---|---|
| /ns sm | string\|null | `BzdyfUJXdks=` | `VGBiahEAZVw=` | `(await fetch('https://tzm.px-cloud.net/ns?c=<uuid>')).body` (already returned by EV2) |
| /ns duration | int | `DFg5Ekk4PSU=` | (EV2 does not include; **Grubhub exception**) | fetch /ns duration in ms |

> ⚠️ **Grubhub does NOT emit the /ns duration field in EV2** (only EV1 has `DFQ2Ekk4PSU=`). iFood EV2 also has `DFg5Ekk4PSU=`. **If you copy iFood and add this field in Grubhub EV2 you create an extra key, causing PX to reject** (we hit this gotcha).

### D. HMAC-MD5 (3-5 fields)

| Semantic | iFood key | Grubhub candidate key | Algorithm |
|---|---|---|---|
| HMAC(uuid, UA) | `M2MGKXUOBB8=` | `cHwGdjYRB0A=` | `hmacMD5(uuid, ua)` |
| HMAC(state.vid, UA) | `FmYjbFAEJVg=` | `LDhaMmpeXAE=` | `hmacMD5(state.vid, ua)` |
| HMAC(state.pxsid, UA) | `BzdyfUFRd04=` | `N2cBLXEFBBk=` | `hmacMD5(state.pxsid, ua)` |
| HMAC constant 1 | - | `Pk5IBHsoTzQ=` | Grubhub extra; consistent across 15 batches → **static value**, take from template |
| HMAC miscellaneous | `KxseEW57HCI=` | `KxsdEW57HCI=` | Algorithm undetermined (suspect HMAC(Date.toString, UA) or similar) → use template for now |

⭐ **UA must equal the HTTP `User-Agent` header** (gotcha #9). Changing the UA string requires changing both places in sync.

### E. state.* References (Obtained From OB#1, Written Into EV2)

| Semantic | Type | iFood key | Grubhub key | Required action |
|---|---|---|---|---|
| **state.no** (server ts) | **int** | `RTEwewNQMUg=` | `UT0ndxdcJUQ=` | `int(state.no)` — see Section A, ⭐⭐⭐ most lethal |
| **state.to** (session token) | string | `FCAhKlJCIxk=` | `UBxmVhZ+Z2U=` | Pass as string |
| **state.appId** | string | `Xi5rJBtKaB4=` | `CXV/P0wRfwU=` | Pass as string |
| **state.o111val** | int | (not always present) | `T385NQoePQM=` | `int(state.o111val)` |

> ⚠️ For the Grubhub project I **initially mislabeled `UT0ndxdcJUQ=` as "pre_init_time"** and filled it with `init_time - random(100,300)` — **always 403**. After switching to `int(state.no)` the pass rate immediately rose to 5/10.

### F. Anti-tamper Pair (Key + Value, 1 Pair)

| Type | iFood | Grubhub | Algorithm |
|---|---|---|---|
| Key, charset `[0-9:;<=>?@]{15-25}` | yes | yes | `te(state.to, state.no%10 + 2)` |
| Value, charset `[0-9:;<=>?@]{15-25}` | yes | yes | `te(state.to, state.no%10 + 1)` |

**Injection method**: in the ev2 template find the field matching `^[0-9:;<=>?@]{15,25}$` (both key + value match), and **replace in place**.
**Forbidden**: deleting the old key + appending a new one — this breaks field order (gotcha #3).

### G. Platform-Specific Fields

| Field | iFood only | Grubhub only | Common |
|---|---|---|---|
| `cyNGaTZBQVs=` (PX12738 counter) | ✓ | - | EV1 |
| `R3cyPQIVMAw=` (pxhd placeholder) | ✓ | - | EV1 (Grubhub warm visit may have) |
| `LVkbU2s6EmI=` (pixel ratio / 10) | - | ✓ | EV2 |
| `cyNFaTZDQ1I=` (navigator.connection object) | - | ✓ | EV2 |
| `WGRubh4IZ1g=` (TypeError stack) | - | ✓ | EV2 |

---

## STATIC Field Handling

**Core principle**: **use the template batch's real value** — don't fabricate, don't `JSON.stringify` defaults.

Engineering method:
1. Pick a cold-visit batch (cleanest, browser had no prior session) as the template → `ev2_template.json`
2. In `build_ev2()` `deepClone(template)`, then **only override DYNAMIC fields**
3. STATIC field values remain untouched

Why don't they move? Because these fields are browser/device hardware fingerprints (screen.width, navigator.languages, various API-presence booleans, Canvas/Audio/WebGL hashes, etc.) — **the same browser on the same device produces the same value every time**. The template batch's value is what PX expects from a "normal browser".

---

## CONDITIONAL Fields

CONDITIONAL fields = present only on warm visits (with prior session cookies). In cold-visit scenarios **simply don't emit them** (don't appear in `d:{}`).

iFood warm-visit fields (25): historical _px3 token, last pxhd value, challenge state cache.
Grubhub warm-visit fields (36): include DOM snapshots (`RlZwHAM3cSY=` contains `[{"tagName": "INPUT", "id": "email", ...}]`), various prior-session fields.

**The cold-visit baseline is sufficient to obtain _px2/_px3** — adding CONDITIONAL fields is unnecessary and may actually lower the score.

---

## Decisive Bug Quick Reference (Gotchas Index)

Use this with `references/gotchas.md`. Quick directory by "symptom → chapter":

| Symptom | See |
|---|---|
| Collector returns 200 but `do:[]` or `do:null`; _px3 never arrives | gotcha #1 (state.no type) + Section A above |
| `{"do":[]}` direct rejection | gotcha #2 (Base64 UTF-8) |
| All fields correct but server doesn't issue | gotcha #3 (anti-tamper position) + Section F above |
| Anti-tamper key in template not recognized | gotcha #4 (regex range) |
| Accepts PC but doesn't issue | gotcha #5 (state.appId must come from OB#1) + Section E above |
| sid inconsistent with SDK | gotcha #6 (state.pxsid not session uuid) |
| OB decode produces garbage | gotcha #7 (binary not UTF-8) |
| Python requests loses sid characters | gotcha #8 (Tag Char Unicode) |
| HMAC fields computed correctly but still rejected | gotcha #9 (UA consistency) |
| **/auth/login HTTP 403 but collector all 200** ⭐ | **Section E above + extra fields (`DFQ2Ekk4PSU=` shouldn't be in Grubhub EV2)** |
| 5/10 pass rate (PX intermittent 403) | **IP rate limit** — retry interval ≥ 10s; avoid burst sequences |

---

## Workflow Quick Reference

For the full step-by-step see `WALKTHROUGH.md`. Minimum path:

```
1. Capture 6+ batches (same SDK version; CDN stable is enough; A/B canaries require Local Overrides)
2. decode_payload.js × 18 → event_json/{batch}-{1,2,3}.json
3. Diff 6+ ev2 batches → STATIC/DYNAMIC/CONDITIONAL classification
4. Decode OB#1 → obtain state.* → find b64 keys where state.* appears in ev2 (value matching)
5. Write build_ev1 + build_ev2; DYNAMIC uses algorithms, STATIC uses template
6. End-to-end run 10 times; expect 10/10 obtaining _px3 (iFood) or _px2 (Grubhub)
```

**Sticking point**: step 4 — state.* → ev2 key position matching.
**Tool**: this project's `scripts/find_state_keys_in_ev2.py` (Python); for each state.* value, finds the b64 key in ev2 that matches 6/6 batches.
