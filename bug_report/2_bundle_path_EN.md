# Press-Challenge Bundle Path — Gotcha Collection

The press path serves <1% of traffic (triggered on high risk score). The SDK file is the standalone `captcha.js`, not `main.min.js`. Involves PoW (iterative SHA-256) + WASM + mouse trajectory synthesis.

⚠️ **For 99% of scenarios, writing a silent generator is sufficient**. This page is for the minority who need the press path.

For Silent Collector path gotchas see [`1_collector_path.md`](1_collector_path.md).

---

## A. WASM Loading and Initialization

### #B1 ⭐⭐⭐ WASM `b()` Needs `globalThis._pxUuid`

**Symptom**: WASM `a()` returns hex successfully, but `b(input)` returns an empty string or panics.

**Root cause**: WASM's internal `b()` calls `__wbg_get(window, "_pxUuid")`; if `globalThis._pxUuid` is undefined, the function takes the error path and returns empty.

**Fix**:
```javascript
globalThis._pxUuid = uuid;   // Use the state.pxsid from Bundle#1
// Then call wasmB(input)
```

All 4 bundle events use **the same uuid throughout** (see #B12).

**Source**: Desktop/新建文件夹 (4)/docs/_gotchas_bundle.md:7-24

---

### #B2 ⭐⭐⭐ WASM `instanceof_Window` Must Return 1 in Node

**Symptom**: WASM loads successfully, but any call immediately panics or returns empty.

**Root cause**: WASM uses `__wbg_instanceof_Window` to detect "am I in a browser". Node defaults to returning 0 → wrong path.

**Fix**: mock the import:
```javascript
const imports = {
    wbg: {
        __wbg_instanceof_Window: () => 1,   // Pretend we're in a browser
        // ... other imports
    }
};
WebAssembly.instantiate(wasmBytes, imports);
```

**Source**: Desktop/新建文件夹 (4)/docs/_gotchas_bundle.md:26-44

---

### #B3 ⭐⭐ WASM Internal Constants Vary per Version/Customer (ChaCha20 seed, HMAC key, alphabet)

**Symptom**: after an SDK upgrade or switching to another site, WASM `b()` output no longer matches real captures.

**Root cause**: "magic constants" embedded in the WASM binary (ChaCha20 seed, HMAC key, custom base91 alphabet) differ per customer/version.

**Fix**: use `wasm-tools` to extract the WASM data section; diff magic strings between old and new versions. If they changed, re-analyze WASM.

**Source**: Desktop/新建文件夹 (4)/docs/_gotchas_bundle.md:241-254

---

### #B4 ⭐ WASM `b()` Output Uses a Custom Alphabet, **Not** base64

**Symptom**: treating b()'s output as base64 → decoded field content is corrupted.

**Root cause**: WASM outputs using the custom alphabet `/=+!1@2#3$4%5^6&7*8(9)0-`; looks like base64 but **isn't**.

**Fix**: feed b()'s output **as-is** into Bundle#3 PX561 field `MD1DNnVfRgQ=`; **do not** base64-decode it.

**Source**: Desktop/新建文件夹 (4)/docs/_gotchas_bundle.md:183-197

---

## B. PoW (Proof of Work)

### #B5 ⭐⭐⭐ PoW SHA-256 Must Use Synchronous API, Not `crypto.subtle`

**Symptom**: PoW solving times out (>600s) or results don't match WASM output.

**Root cause**: Node's `crypto.subtle.digest()` returns a Promise; awaiting it in each loop iteration turns a 60ms PoW into 600s+. WASM uses synchronous SHA-256.

**Fix**:
```javascript
// ❌ Wrong
const hash = await crypto.subtle.digest('SHA-256', buf);

// ✅ Right
const hash = crypto.createHash('sha256').update(s).digest('hex');
```

**Source**: Desktop/新建文件夹 (4)/docs/_gotchas_bundle.md:48-72

---

### #B6 ⭐⭐ Handler Param Remap: Bs()'s Parameter Positions Are Deliberately Reordered

**Symptom**: PoW solver computes wrong hashes.

**Root cause**: the handler receives `(t,e,n,r,a)` but calls `Bs(n,e,r,a==="true")`. Parameter 1 is unused; parameter 5 becomes a boolean — deliberate obfuscation.

**Fix**: trace to the actual call site (not the handler entry) to see Bs's real arguments. The I0I0I0 handler is the real entry; the actual signature is `Bs(targetHash, suffix, "16", false)`.

**Source**: `BUNDLE_COMPLETE_ANALYSIS.md:1919-1921, 1934-1936`

---

## C. Bundle Event Structure

### #B7 ⭐⭐ Bundle's AppID Differs From the Init AppID

**Symptom**: Bundle#1 OB decode or state extraction fails.

**Root cause**: Bundle endpoints use **another appId**. iFood:
- Init AppID = `PXO1GDTa7Q`
- Bundle AppID = `PXd6f03jmq8h6c7382req0`

This differs from the init vs collector AppID in [`1_collector_path.md` gotcha #16](1_collector_path.md#16) — Bundle is **the third AppID**.

**Fix**: extract the Bundle AppID from a real captured Bundle POST and hardcode separately.

**Source**: Desktop/新建文件夹 (4)/docs/_gotchas_bundle.md:128-136; `ifood-web/collector无感纯算还原/纯算还原.md:38-50`

---

### #B8 ⭐⭐⭐ Bundle#3 Event Array Is **Order-Sensitive**

**Symptom**: each event individually looks correct; end-to-end rejected.

**Root cause**: PC HMAC verification is over `serialize([event1, event2, ...])`. Wrong order → different byte stream → pc mismatch.

**Fix**: strict order:
```
[px10498 press,
 px561 captcha+WASM,
 px10496 mouse interaction,
 px535 mouse trajectory,
 px11116 DOM+errors]
```

**Source**: Desktop/新建文件夹 (4)/docs/_gotchas_bundle.md:76-93

---

### #B9 ⭐⭐ All 4 Bundle Events Use the Same UUID

**Symptom**: Bundle#2/#3 rejected; state.vid doesn't match the `_pxvid` cookie.

**Root cause**: PX validates that the entire challenge session uses the same uuid:
```
uuid_bundle#1 = uuid_bundle#2 = uuid_bundle#3 = uuid_bundle#4
```
`state.pxsid` / `state.vid` are also session-invariant.

**Fix**: generate 1 uuid and use it across all 4 bundles.

**Source**: Desktop/新建文件夹 (4)/docs/_gotchas_bundle.md:201-212

---

### #B10 ⭐⭐ Bundle#4 — Two Contradictory "When to Send" Guidelines; Depends on Scenario

**Symptom**: two internal references give **completely opposite** advice:
- A says: "Bundle#4 is the error path; on success do not send"
- B says: "Bundle#4 is telemetry; a real browser **always** sends it; not sending is itself a fingerprint"

**Root cause**: both are right, **depending on scale and time window**:
- **One-off / small batch** (< a few dozen per day): A is right — success path doesn't send Bundle#4; sending it signals an earlier bug
- **Long-term large batch** (thousands of sessions / multi-account): B is right — if every session lacks Bundle#4, your statistical distribution deviates from real users → PX's long-term behavioral analysis catches it

**Fix**:
- Short-term / experiment: don't send Bundle#4 on success
- Production / large batch: construct a minimal Bundle#4 telemetry (with `result=success`, duration, attempt count) following Bundle#3; keep your traffic distribution aligned with real browsers

**Source**: Desktop/新建文件夹 (4)/docs/_gotchas_bundle.md:216-227; `perimeterX_Re/docs/04_bundle/05_bundle4_fallback.md`

---

## D. Mouse + Press Behavior Synthesis

### #B11 ⭐⭐⭐ Press Duration Must Be Between 1-3 Seconds

**Symptom**: all Bundle#3 fields and order correct, still 422/403 rejection.

**Root cause**: PX validates press duration:
- `< 500ms` → "too fast, bot"
- `> 5000ms` → "too slow, sleep detection"

**Fix**:
```javascript
const pressDuration = 1000 + Math.random() * 2000;   // 1000-3000ms
```

**Source**: Desktop/新建文件夹 (4)/docs/_gotchas_bundle.md:97-110

---

### #B12 ⭐⭐ Mouse Coordinates Must Be Floats, Not Integers

**Symptom**: mouse trajectory / press is identified as bot.

**Root cause**: real browser `pointerdown.clientX` is **sub-pixel floating point** (320.5, 247.3); bots typically produce integers.

**Fix**: keep 1 decimal place:
```javascript
x = Math.round(bezierX(t) * 10) / 10;
```

**Source**: Desktop/新建文件夹 (4)/docs/_gotchas_bundle.md:114-125

---

### #B13a ⭐⭐ The Explicit `pressDuration` Field Must **Equal** `pointerup.ts - pointerdown.ts`

**Symptom**: all fields filled, duration within 1-3s (satisfying #B11), still rejected.

**Root cause**: PX validates not only the `pressDuration` field value, but **cross-references** it against the event timestamp delta:
- Explicit field `QlNxGAc0fSg= = [1500]`
- Actual events `pointerdown.ts=37468, pointerup.ts=38936` → delta 1468ms
- Delta 32ms > 100ms tolerance → judged "synthetic event"

**Fix**: always **derive** duration from events; never hardcode independently:
```javascript
const pressDuration = ctx.pointerUp.ts - ctx.pointerDown.ts;
ev3['QlNxGAc0fSg='] = [pressDuration];   // ✅ consistent
```

**General rule**: for any "event + metadata describing the event" pair, the metadata must be **derived**, not guessed.

**Source**: `perimeterX_Re/docs/07_gotchas/18_press_duration_mismatch.md`

---

### #B13 ⭐⭐ Mouse Trajectory Timestamps Must Match Press Duration

**Symptom**: press is 1.5s, but mouse trajectory duration is 5s → rejected.

**Root cause**: PX validates timing:
- `mouseEndTs ≈ pressDownTs ± 100ms`
- `mouseStartTs = mouseEndTs - pressDuration`

Misalignment = bot.

**Fix**:
```javascript
const mouseEndTs = pressDownTs - randInt(50, 150);
const mouseStartTs = mouseEndTs - pressDuration;
// 544 trajectory points evenly distributed across [mouseStartTs, mouseEndTs]
```

**Source**: Desktop/新建文件夹 (4)/docs/_gotchas_bundle.md:140-153

---

## E. DOM + Error Collection

### #B14 ⭐ DOM Encoding Uses Myanmar Characters (Not base64)

**Symptom**: PX11116 field value doesn't match real samples.

**Root cause**: PX uses the Myanmar Unicode block (U+1000-U+109F) to encode DOM structure; not random base64.

**Fix**: use the ready-made `myanmar_encode.js` from the iFood project, passing in the real DOM node list.

**Source**: Desktop/新建文件夹 (4)/docs/_gotchas_bundle.md:158-169

---

### #B15 ⭐ Error Stack Must Have 4 Groups (Not 1)

**Symptom**: PX11116 contains an error stack but still rejected.

**Root cause**: the real SDK deliberately throws 4 errors at different positions / types, collecting 4 stacks. 1 stack = bot taking a shortcut.

**Fix**: use iFood's `error_stack.js`, which returns a 4-element array.

**Source**: Desktop/新建文件夹 (4)/docs/_gotchas_bundle.md:173-179

---

## F. Resource Caching / Paths

### #B16 ⭐ `captcha.js` Cannot Be Cached and Reused Across Sessions

**Symptom**: saving the captured captcha.js and feeding it to a second session → failure.

**Root cause**: the captcha.js URL contains a uuid parameter; each new session requires a new URL. The uuid-bound state embedded in the file expires.

**Fix**: download captcha.js fresh for each new challenge session.

**Source**: Desktop/新建文件夹 (4)/docs/_gotchas_bundle.md:231-237

---

### #B17 ⭐ `captcha.js` Filename Is Unstable; Cannot Hardcode Breakpoints

**Symptom**: trying to set a breakpoint on captcha.js in DevTools — every reload changes the name.

**Root cause**: captcha.js is dynamically generated per request; the filename carries a random suffix (e.g., `captcha_7f2a3b1c.js`).

**Fix**:
- Set the breakpoint on `main.js` (this is stable)
- Or use CDP/DevTools Network interception
- Or hook `window._O1GDTa7Qhandler` after load completes

**Source**: `BUNDLE_COMPLETE_ANALYSIS.md:1923-1928`

---

## G. Production Deployment Traps (PoW Cache + Trajectory Pool)

### #B18 ⭐⭐ PoW Answer Cache Keyed by `(suffix, target)` Leaks Across Sessions

**Symptom**: enabling a PoW cache optimization in production; running multi-account scenarios a few times, some accounts hit 100% failure — the same `(suffix, target)` pair appears across sessions, the cache returns a previous answer, **but PX validates the answer per session UUID**.

**Root cause**: PoW `(suffix, target)` can occasionally repeat across sessions; keying solely on them is equivalent to giving the current session another session's answer → PX detects that the answer doesn't match the session UUID binding.

**Fix**:
- Cache key includes the session UUID: `cache[sessionUuid + suffix + target] = answer`
- Clear the cache on session end
- For single-IP / small batch (< 1000 sessions/day): PoW takes only 9ms (unoptimized implementation); **don't cache at all** for safety

**Source**: `perimeterX_Re/docs/04_bundle/06_pow.md:124`

---

### #B19 ⭐⭐ Trajectory Pool Too Small; 50+ Sessions Get Caught by Long-Term Behavioral Analysis

**Symptom**: pure-algo generator was 7-10/10 in testing; production runs of 50+ sessions show regular failures — each individual request looks correct.

**Root cause**: a common approach captures 5-10 real mouse trajectories and rotates them in the generator (pool rotation). **Each one looks "real" individually**, but PX's backend has long-term behavioral clustering per IP / account; 50 sessions using 5 trajectories means each trajectory is **reused 10 times**, statistically deviating from real humans.

**Fix**:
- Short-term: expand the pool to 50-100 real trajectories
- Mid-term: add synthetic Bezier trajectories + pool mixing; per session add UUID-based jitter (small random offsets over the trajectory base)
- Long-term: each target account gets its own dedicated trajectory pool (no cross-account sharing)

**Source**: `perimeterX_Re/docs/04_bundle/12_pure_algo_e2e_gap.md` (Gap 1, Gap 5)

---

*Environment / infrastructure 8 gotchas: see [`3_environment.md`](3_environment.md)*
