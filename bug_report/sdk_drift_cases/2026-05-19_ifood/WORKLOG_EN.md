# iFood pxcookie Pure-Algo Generator Update — Work Log

- **Task start**: 2026-05-19
- **Workstation**: Windows 11, user lsd
- **Project path**: `C:\Users\lsd\projects\sourcing-cracked\ifood-web\collector无感纯算还原\`
- **Goal**: verify whether the old pxcookie generator still works; if broken, update SDK constants/fields
- **Side task**: delete local commit `b52c30945ff80831b2b6f3043f2fcfe3a1120f2a` (project must stay in sync with GitHub)

## Recording Rules (Hard Order)

1. Every step (command, modification, decision) must be written here immediately
2. Force a heartbeat record at least once per minute to avoid gaps
3. Failures / successes / intermediate results all logged, not just conclusions

---

## Step 0 — Environment Reconnaissance (Done)

### 0.1 Project Structure

```
ifood-web/collector无感纯算还原/
├── auto/px_cookie.js          # End-to-end entry
├── reverse/                   # 9 algorithm modules (payload/pc/ob/sid/uuid/hash/memory/antitamper/ns)
├── script/                    # decode_payload.js / decode_ob.js
├── #1/, #2/                   # Historical capture samples
└── 纯算还原.md                # 1,804-line complete reverse doc
```

### 0.2 Current SDK Constants (Hardcoded at the Top of px_cookie.js)

| Constant | Current value |
|---|---|
| AppID | `PXO1GDTa7Q` |
| TAG/GT | `DhI0E0h7J2cKHw==` |
| FT | `388` |
| Collector URL | `https://collector-pxo1gdta7q.px-cloud.net/api/v2/collector` |
| /ns URL | `https://tzm.px-cloud.net/ns?c={uuid}` |
| Default UA | `Mozilla/5.0 ... Chrome/145.0.0.0 ... Edg/145.0.0.0` |

### 0.3 PX Verification Semantics (from 纯算还原.md)

- collector#2 returns `{"do":null}` → **server accepts the fingerprint (success)**
- collector#2 returns `{"do":[]}` → judged as bot (fail)
- Final `_px3` source has two locations:
  - The `set_cookie` handler in ob#1 (`args[0]=_px3, args[2]=value`)
  - The `bake|_px3|...` string in ob#2

---

## Step 1 — Delete Local Unpushed Commit b52c309 (Done)

### 1.1 Situation Confirmation

- Commit author: Shudong Lu (me, 2026-05-18 17:49)
- Content: `grubhub-web/grubhub-auth/core/python/login.py` — modified login flow (attempt /auth/login before mail.tm JWT pre-check)
- Status: local main is `ahead 1` of origin/main, **not pushed to GitHub**

### 1.2 Execution

```bash
git reset --hard origin/main
# HEAD is now at ae9659b docs: mark TripAdvisor complete
```

After `git status -sb` → `## main...origin/main` (in sync with remote) ✓

Non-destructive; no force-push involved.

---

## Step 2 — Run Old pxcookie Test (In Progress)

### 2.1 First Run

Command:

```bash
cd "C:/Users/lsd/projects/sourcing-cracked/ifood-web/collector无感纯算还原/auto"
node px_cookie.js
```

Output:

```
_px3: NONE
_pxvid: 2f585873-52e7-11f1-a346-d4886dca4670
status: 200
response: {"do":null,"ob":"YjxiPGJiLzAm"}
```

### 2.2 Interpretation

- `status: 200` + `{"do":null}` = **collector#2 server accepted the fingerprint (core algorithm still works)**
- `_pxvid` generated correctly → ob#1 decoding vid succeeded
- `_px3: NONE` → ob#1 didn't extract a `set_cookie` segment; ob#2's `do` is null so no bake string either

### 2.3 To Investigate

- Did older sample ob#1 originally return `_px3`? Or did PX, after upgrade, change to only delivering via ob#2's `bake|_px3|`?
- If the server now delivers `_px3` only by another route, we need to adjust extraction logic

Next step: dump ob#1's raw decoded content to see what every segment contains.

---

## Step 3 — Configure PostToolUse hook for Forced Reminders + Persist Global Memory

### 3.1 Motivation

User gave a hard order: "log every step + force heartbeat every minute". Relying on Claude's diligence alone isn't enough; needs a hook to inject system reminders after every tool call.

### 3.2 Operation

1. Build a project-level `.claude` directory: `C:/Users/lsd/projects/sourcing-cracked/ifood-web/.claude/`
2. Write `settings.local.json`: PostToolUse hook, matcher=`Bash|Edit|Write|Read|MultiEdit|NotebookEdit|Grep|Glob`, command outputs JSON via stdout `{"hookSpecificOutput":{...,"additionalContext":"Hard-order recording reminder:..."},"suppressOutput":true}`
3. Pipe-test command: `echo '{...}' | bash -c "..."` → JSON output OK ✓
4. Schema validate (use node in lieu of jq, no jq locally): matcher + command both readable ✓

### 3.3 Global Memory Sync

Wrote two memory entries to `C:\Users\lsd\.claude\projects\C--Users-lsd-projects-sourcing-cracked\memory\`:

- `feedback_worklog_required.md` — WORKLOG hard-order rules
- `feedback_lookup_order.md` — Reverse-lookup priority (treasure → CDP → SDK source; no guessing)

And established a `MEMORY.md` index.

### 3.4 Hook Verification Result

After one Bash command was triggered, **no** "hard-order recording reminder" injection arrived — meaning the settings watcher didn't track the newly created `.claude/`; user must run `/hooks` in Claude Code or restart to activate. **Hook is written but doesn't take effect this session**; rely on memory + manual diligent recording.

---

## Step 4 — User Methodology: 4-Step Full-Chain Decode Comparison (In Progress)

User clarified the methodology:
1. Intercept #1 request → decode payload + pc (ev1)
2. Decode #1 response → check whether handler function table changed; byte table
3. Intercept #2 request → decode payload + pc (ev2)
4. Decode #2 response → inspect

### 4.1 First-Step Yield: ob#1 Decoding Complete

The debug script `px_cookie_debug.js` ran once; ob#1 server response:

```json
{"do":null,"ob":"PDxiPGI8L2ZkZmthZ2difmZhNmt+...(long string)"}
```

XOR key=83 (=`ml(GT)%128`); after splitting, **11 segments** (old treasure resp1 had only 9):

| # | Handler tag | args | Interpretation | Old treasure |
|---|---|---|---|---|
| 0 | `oo1o1o` | `[UUID]` | pxsid | only in resp3 |
| 1 | `1o1o11` | `[cu]` | control_flag jf | ✓ resp1 |
| 2 | `ooo11o` | `[17853193978960284755]` | session_id (to) | ✓ resp1 |
| 3 | `o111oo1o` | `[1779129327660]` | timestamp (no) | ✓ resp1 |
| 4 | `o111o1` | `[d85lnrr7lo8c7398j5og]` | app_id | ✓ resp1 |
| 5 | `o111ooo1` | `[6425]` | unknown 4-5 digit | ✓ resp1 |
| 6 | `o11o11o1` | `[UUID, true]` | cts | only in resp3 |
| 7 | `1o1111` | `[64hex]` | challenge_hash (qa) | ✓ resp1 |
| **8** | **`oooo11`** | **`[UUID, 31536000, true]`** | **NEW: vid handler** | **resp3 (different format?)** |
| 9 | `o1111o` | `[cc, 60, base64(SameSite=Lax;)]` | cookie_config | ✓ resp1 |
| 10 | `o111oo` | `[ai:0,uiii:0]` | feature_flags | ✓ resp1 |

### 4.2 🔴 Key Changes (vs Old Treasure)

1. **The `set_cookie` segment (handler `o11111`) is GONE!** — Old SDK delivered `_px3` via a 4-arg `[_px3, ttl, value, secure...]` in ob#1 resp1; the new SDK has no such segment
2. **Multi-round response merged into one** — Old SDK had collector#1 send 3 times (resp1/2/3) for different segments; the new SDK has one response containing 11 segments (pxsid/cts/vid all present)
3. **Added vid handler `oooo11`** — 3-arg format (UUID + 31536000 + true); iFood's decodeOb already recognizes it (pattern: `args.length===3 && UUID_RE + number`), so `_pxvid` works normally
4. iFood's decodeOb **doesn't yet recognize** `cookie_config (o1111o)` and `feature_flags (o111oo)`, but those don't affect collector#2

### 4.3 Core Question to Answer

Since ob#1 no longer delivers `_px3`, where does the new SDK's `_px3` come from? Candidates:

- (a) `bake|_px3|...` in collector#2 response's `do` array (current code already tries, but `do:null` means not this time)
- (b) collector#2 response's `ob` field (current response has `"ob":"YjxiPGJiLzAm"`, 12 chars, not decoded — must decode!)
- (c) A standalone cookie endpoint (e.g., `https://www.ifood.com.br/_px/...`)
- (d) The client assembles it from vid + other tokens
- (e) Actually iFood now only needs `_pxvid` + session, no longer needs `_px3` cookie

Next: first decode (b): also decode the `ob` field of collector#2 response to see what's inside. Simultaneously intercept ev1/ev2 for comparison.

---

## Step 5 — 10-Sample Batch Validation (Done)

### 5.1 Tooling

- Modified `px_cookie_debug.js`: each run saves `samples/<N>/dump.json` (contains ev1/payload1/pc1/r1/ob1/state/ev2/payload2/pc2/sid/r2/ob2)
- Command: `for i in 1..10; node px_cookie_debug.js $i; sleep 1; done`

### 5.2 Result (10/10 all status=200)

| sample | ob1 segments | ob2 segments | r2.body | px3 |
|---|---|---|---|---|
| 1-10 | 11 | 1 | `{"do":null,"ob":"YjxiPGJiLzAm"}` | NONE |

All samples consistent:
- ob#1 = 11 segments (pxsid + jf + to + no + appId + o111val + cts + qa + vid + cookie_config + feature_flags)
- ob#2 = **always constant** `YjxiPGJiLzAm` = `1o1o11|cu` (a single control_flag handler with value "cu")
- `{"do":null}` = server accepts
- **`_px3` never delivered**

### 5.3 Deduction

`_px3` must come via other channels:
- (i) HTTP **`Set-Cookie` response header** (our debug `post()` didn't log headers; blind spot!)
- (ii) collector#3 / collector#4 etc. extra endpoints (old SDK didn't have; new SDK might add)
- (iii) Real browser SDK assembles it

### 5.4 ob#2 Decoded Constant

```
"YjxiPGJiLzAm"
  → b64 decode (9 bytes) → 62 3c 62 3c 62 62 2f 30 26 (hex)
  → XOR(83) → "1o1o11|cu"
  → 1 segment, handler=1o1o11 (control_flag), args=["cu"]
```

Meaning: the server uses control_flag to keep the client's `jf` state at "cu". No cookie delivered.

---

## Step 6 — Check Set-Cookie Headers + cdp Capture Real SDK (In Progress)

Action plan:
1. ✓ Add response headers to debug `post()` — **collector#1/#2 both have no Set-Cookie**
2. Side trip: descended into reading SDK source (main_pretty.js 9,459 lines) — user called stop "you've drifted"
3. User chose → **cdp captures real browser traffic**: open ifood.com.br, see whether `_px3` actually exists in the browser after real SDK loads, what value, which request set it

### 6.1 Confirmed Facts

- Current pxcookie pure-algo ≥9 captures stable status=200, `{"do":null}` server accepts fingerprint
- ob#1 has 11 segments total, **`set_cookie (o11111)` segment disappeared**
- ob#2 is always the constant ACK `1o1o11|cu` (control_flag)
- Both collector responses **have no Set-Cookie header**
- So `_px3` doesn't come from ob segments, doesn't come from HTTP header → **must come from another endpoint or client-side logic**

### 6.2 SDK Source Notes (Read So Far)

- `main_pretty.js` line 872 `ur(t)` — read cookie by name
- `main_pretty.js` line 878 `lr(t, e, n, r)` — write cookie by name (params: name, ttl, value, isSecure)
- line 4097 `var c = ur("_px3")` — SDK reads _px3 into field `bjIcNCtcGQU=` (note: old px_cookie.js used `BX1/O0ATcgo=`; **field name changed**)
- New handler-function name format: `lllOll`, `OOlOlO`, `lOlllO`, etc. (lowercase l / uppercase O, mimicking 0/1)
- Old wire format is still `1`/`o`, so decoded segment-header names look like `1o1o11`

Next: cdp.

---

## Step 7 — User Provides Real curl + Response (Key Breakthrough)

### 7.1 Data Source

User copied real collector#1 and collector#2 from the browser:
- `C:\Users\lsd\Desktop\1.txt` + `1响应.txt` (collector#1 + ob#1)
- `C:\Users\lsd\Desktop\2.txt` + `2响应.txt` (collector#2 + ob#2)

### 7.2 Decode With Existing Scripts

`collector无感纯算还原/script/decode_payload.js` + `decode_ob.js` work as-is.

#### 7.2.1 #1 Payload Decode (seq=0, 14 fields, event type `R3cyPQISOQo=`)

File: `event_json/user_curl1.json`

Field comparison (old → new base64 key):
- URL: `U08pSRUgIH4=` → `cgIHSDRhAX8=`
- platform "Win32": `JDxeOmFRVgA=` → `dEABCjEhBjA=`
- counter 0: `cHAKdjYQB0Y=` → `egoPQDxmDXA=`
- initTime: `FCwuKlJGKx0=` → `VQEgCxNnKjw=`
- sendTime: `BFw+GkE3Oyg=` → `bHgZcikfE0A=`
- uuid: `eEgCDj4lBjo=` → `NSEAa3NAC18=`
- /ns sm: `Ah44WEdyM24=` → `BzdyfUJXdks=`
- /ns dur: `DFQ2Ekk4PSU=` → `DFg5Ekk4PSU=`
- etc.

New fields (old didn't have):
- `R3cyPQIVMAw=` → pxhd (contains vid): "`194693e2bce104232d97ad4d8df7c2224f1d23da747ff6f71c338a9806f731c7:ppC4...`"
- `cyNGaTZBQVs=` → PX12738~12741 series counter: `{"PX12738":12, ...}`

#### 7.2.2 #1 ob Response Decode (XOR key=100, 11 segments)

File: `responce_result/user_curl1_ob.json`

```
[cookie_config] l00lll → {name:"cc", ttl:60, value:base64(SameSite=Lax;)}
[control_flag]  0lll0l → (jf=cu)
[session_id]    l0l0ll → state.to
[timestamp]     0lll000l → state.no = 1779130115184
[app_id]        000ll0
[unknown]       0lll0000
[cts]           0ll0ll00 → state.cts
[challenge_hash] 0lllll  → state.qa = 0cf210f9a296cb58e73b...
[cookie_config] l00lll → {name:"rf", ttl:60, value:"1"} ← new
[feature_flags] l00ll0 → {ai:0, uiii:0}
[unknown]       0ll0l000
```

#### 7.2.3 #2 Payload Decode (seq=1, **225 fields**, event type `EFwlFlY8LiQ=`)

File: `event_json/user_curl2.json` (19,772 bytes, 225 fields)

#### 7.2.4 #2 ob Response Decode 🔴 Critical

File: `responce_result/user_curl2_ob.json`

```
[set_cookie]   000lll → {name:"_px3", ttl:?, value:"f6925223a427e1d7c9ca10dedf4267a2a9a8..."}
[control_flag] 0lll0l → (jf=cu)
[unknown]      0ll0l000 × 3
```

**`_px3` is delivered in the collector#2 response, NOT collector#1!** This completely differs from the old treasure ob_analysis.md. Old version (iFood): set_cookie in resp1. New version: set_cookie in collector#2 response.

### 7.3 SDK Version Changes (Summary)

| Item | Old (current px_cookie.js) | New SDK (user curl) |
|---|---|---|
| tag | `DhI0E0h7J2cKHw==` | **`U0MmDhUmOnhXSw==`** |
| ft | 388 | **401** |
| ob XOR key | 83 | **100** |
| seq #2 | 2 | **1** |
| ev1 field count | 12 | **14** |
| ev2 field count | 203 | **225** |
| ev1 event type | `EFAqFlU5LiE=` | **`R3cyPQISOQo=`** |
| ev2 event type | `XQUnAxtpIzE=` | **`EFwlFlY8LiQ=`** |
| Handler encoding | `o`/`1` (eg `o11111`) | `0`/`l` (eg `000lll`) |
| _px3 delivery position | ob#1 `set_cookie` segment | **ob#2 `set_cookie` segment** |
| URL field key | `U08pSRUgIH4=` | `cgIHSDRhAX8=` |

Handler decoding logic (`reverse/ob.js`) matches by argument shape; remains valid across versions.

### 7.4 Note: User curl Contains Existing Session

User's curl#1 already contains `vid`, `sid`, `cts`, `pxhd`, `hid` — browser already has session cookies. A first-visit curl#1 shouldn't have these. But the SDK will include cookies it sees. So when pure-algo reproducing:
- First visit (no cookies): seq=0 doesn't include vid/sid/cts/pxhd/hid → run the full flow to obtain _px3
- Subsequent (with cookies): include the existing ones; still go through #1 → #2

### 7.5 Next Up

1. ✓ Decode both curls, build old↔new field mapping
2. → patch `px_cookie.js`: update three scalars tag/ft/seq
3. → rewrite ev1 / ev2 fields (user curl#1 #2 are reference samples)
4. → run pure-algo once, see whether `_px3` arrives
5. → 20-run stability test

---

## Step 8 — 4-Batch Sample Three-Class Classification

### 8.1 Sample Summary

| Batch | Source | uuid | ev1 fields | ev2 fields | ob#1 segs | ob#2 segs | _px3 |
|---|---|---|---|---|---|---|---|
| batch1 | user 1.txt | 2bd832d0-... | 14 | 225 | 11 | 5 | f692... |
| batch2 | re/#1.txt | 6b0623c0-... | 14 | 225 | 11 | 5 | 28cb... |
| batch3 | re/若/#1.txt | dd1e3560-... | 15 | 204 | 10 | 4 | ffca... |
| batch4 | re/值/#1.txt | (new uuid) | 14 | 204 | 10 | 4 | 0189... |

batch1/2 = "warm visit" (existing session), batch3/4 = "cold visit".

### 8.2 EV2 4-Way Diff Classification

```
228 unique fields (4-batch union)
├── COMMON (in all 4 batches): 203
│   ├── STATIC (same value across 4): 171  ← copy values directly
│   └── DYNAMIC (different values):  32  ← algorithmically generated
└── CONDITIONAL (present in some batches): 25  ← warm-visit only (session injection)
```

### 8.3 Old → New base64 Key Mapping (Value-Matching Method)

Run `map_keys.js` using old px_cookie.js's ev2 hardcoded values; find matching values in batch1 ev2:

```
Parse old ev2: 202 keys
Mapping found:
  - Unique mapping (old key → new key): 31
  - Ambiguity (one value, multiple candidates): 12
  - Old key has no new mapping: 29
  - New key has no old mapping: 178 (mostly true/false generic values)
```

Partial confirmed mappings (semantic known):

| Old key | New key | Value | Meaning |
|---|---|---|---|
| `JDxeOmFRVgA=` | `dEABCjEhBjA=` | `"Win32"` | navigator.platform |
| `b1NVVSo/XWQ=` | `UT0kdxRdI0Y=` | `"Asia/Shanghai"` | timezone |
| `KVkTX2w1GGo=` | `MkJHCHciQz0=` | `"w3c"` | screen orientation |
| `KnZQcG8aWkQ=` | `fg4LRDtuDnA=` | `"screen"` | screen |
| `b1NVVSkzWG8=` | `JnZTfGAaUUY=` | `"20030107"` | navigator.product |
| `aHgSfi4ZHU0=` | `NkZDDHArQz8=` | `"Netscape"` | navigator.appName |
| `SBhyXg51eGU=` | `X08qRRkuL34=` | `"Mozilla"` | navigator.vendor |
| `VGxuahEAYlk=` | `R3cyPQIXMQ4=` | `"Windows"` | UA platform |
| `FU1vS1Mna3k=` | `OARNTn5iRnw=` | `-480` | timezone offset |
| `eEgCDj4lBjo=` | `NSEAa3NAC18=` | uuid | session UUID |
| `Yj4YOCdSFw0=` | `MV0EV3Q9BGI=` | `"3207084bd1..."` | DOM Myanmar hash |
| `JxsdHWJxEy8=` | `PSkIY3hPCVE=` | `"109|66|66|70|80"` | timing chain |
| `DzN1dUlScEY=` | `YjIXOCRfHQs=` | `["loadTimes","csi","app"]` | chrome.* APIs |

Full mapping in `key_mapping.json`.

### 8.4 EV1 14-Field Comparison

| Old key | New key | Meaning | DYN/STATIC |
|---|---|---|---|
| `U08pSRUgIH4=` | `cgIHSDRhAX8=` | URL | STATIC |
| `ZR1fGyB2Ui4=` | `XQkoAxhuKjY=` | type=0 | STATIC |
| `JDxeOmFRVgA=` | `dEABCjEhBjA=` | "Win32" | STATIC |
| `cHAKdjYQB0Y=` | `egoPQDxmDXA=` | counter=0 | STATIC |
| `Rlp8HAA2dy4=` | `PSkIY3tJDFE=` | perfNow | DYNAMIC |
| `JxsdHWJwFCc=` | `Tl57FAs5fS4=` | tz=3600 | STATIC |
| `FCwuKlJGKx0=` | `VQEgCxNnKjw=` | initTime | DYNAMIC |
| `BFw+GkE3Oyg=` | `bHgZcikfE0A=` | sendTime | DYNAMIC |
| `eEgCDj4lBjo=` | `NSEAa3NAC18=` | uuid | DYNAMIC |
| `Ah44WEdyM24=` | `BzdyfUJXdks=` | /ns sm | STATIC (null) |
| `DFQ2Ekk4PSU=` | `DFg5Ekk4PSU=` | /ns dur | STATIC (0) |
| `QSE7ZwdLMVw=` | `bHgZcioeHEk=` | flag=false | STATIC |
| (none) | `R3cyPQIVMAw=` | **pxhd** (new) | CONDITIONAL |
| (none) | `cyNGaTZBQVs=` | **PX12738-12741** (new) | DYNAMIC |

### 8.5 Next Steps

(a) **Capture 3-5 more cold-visit batches** (clear cookies and re-enter) to stabilize STATIC classification
(b) Or patch px_cookie_v2.js directly with the existing 4-batch STATIC and run end-to-end

---

## Step 9 — Done: px_cookie_v2.js End-to-End Working

### 9.1 The Decisive Bug

After repeated testing + cdp browser replacement to rule out IP / TLS / header interference, finally located:

**`RTEwewNQMUg=` field type mismatch!**

- Our ob decoder decoded the server timestamp as a **string** `"1779132990495"`
- But the SDK expects this field to be a **number** `1779132990495`
- Our `serialize()` quotes strings and doesn't quote numbers → **the generated payload bytes have 2 extra quote characters at that field position**
- Although the server's PC HMAC validation passes when computing our PC (we serialize the same way), the server's semantic validation of actual event values → sees a string timestamp and flags it as "forged"; **though it doesn't reject (do:null), it doesn't deliver _px3**

Fix in one line: `d['RTEwewNQMUg='] = parseInt(ctx.state.no);`

### 9.2 End-to-end Verification

10 consecutive runs:

```
run 1: px3=f75c9edc018a92edd2ff636291bd9c.. segs=3 status=200
run 2: px3=e6428c0cda6c546b37971415bf8d15.. segs=3 status=200
run 3: px3=55a4ae8cf985e0e78c9ef7d75d2d9f.. segs=3 status=200
run 4: px3=13160e5f0955120f3f79e21433e961.. segs=3 status=200
run 5: px3=95c55a88645533a3b2e27dc122eb6d.. segs=3 status=200
run 6: px3=15af8f82a4e6b253c4ad8ed9a6008b.. segs=3 status=200
run 7: px3=840afc2d79194e1f19785d0a23c910.. segs=3 status=200
run 8: px3=1333c095beff227f6412cbbbd7e161.. segs=3 status=200
run 9: px3=da918797cd92fe23f0390e8f23776b.. segs=3 status=200
run 10: px3=cdfd99b581a925aa8e2da0694fa6ee.. segs=3 status=200
```

**10/10 success rate; each run produces an independent _px3. ✅**

### 9.3 Final Files

- `px_cookie_v2.js` — end-to-end generator (depends on ev1_template.json + ev2_template.json)
- `ev1_template.json` — batch6 ev1 template (14 fields)
- `ev2_template.json` — batch6 ev2 template (204 fields)

### 9.4 Key Changes vs Old px_cookie.js

| Item | Old | New |
|---|---|---|
| `TAG` | `DhI0E0h7J2cKHw==` | `U0MmDhUmOnhXSw==` |
| `FT` | 388 | 401 |
| `seq` #2 | 2 | 1 |
| `ev1` fields | 12 | 14 (added pxhd placeholder + PX12738 counter) |
| `ev2` fields | 203 | 204 (cold visit) |
| ev1 event type | `EFAqFlU5LiE=` | `R3cyPQISOQo=` |
| ev2 event type | `XQUnAxtpIzE=` | `EFwlFlY8LiQ=` |
| Handler encoding wire | `o`/`1` | `0`/`l` |
| _px3 source | r2.body `do` array's `bake\|_px3\|...` | r2.body `ob` field set_cookie handler |
| state.no field value type | string | **must parseInt to number** |
