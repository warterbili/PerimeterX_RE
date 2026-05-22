# Appendix C: 10 Must-Avoid Pitfalls

> The 10 **most lethal** traps distilled from 3 years of PX reversing. **Required reading before you start**.
> *Source*: C/Appendix C + bug_report/ summary

The full 68-gotcha set is in [`../../../../bug_report/`](../../../../bug_report/). This appendix curates the 10 most globally devastating.

---

## Pitfall 1: Cookies Not Cleared Between Captures

**Symptom**: after running three-class classification on 6 batches, STATIC is 90%+ and DYNAMIC only 5%.

**Cause**: regular Chrome retains the `_pxvid` cookie; PX classifies you as warm visit; certain fields (e.g. `pxhd`) get warm-visit values that mix into your "template". Your template is **polluted**.

**Fix**: every batch must use a **new incognito window**. Verify: `meta.json.warm_visit: false`.

See Stage 1 §1.3.

---

## Pitfall 2: JSON.stringify Substituted for PX Custom serialize

**Symptom**: the generator's payload differs from real captures by 1-3 characters; PC computes wrong; collector returns 403.

**Cause**: PX's custom `serialize()` differs from `JSON.stringify` in 5 places:
- `undefined` → `'"undefined"'` (PX) vs dropped (JS)
- `NaN` → `"null"` vs `null`
- `Date` formatting differs
- ...

**Fix**: you must use [`../../../../revers/payload.js`](../../../../revers/payload.js)'s `serialize()`. **Do not use any standard library**.

See Stage 2 §2.2 + gotcha [`../../../../bug_report/1_collector_path.md`](../../../../bug_report/1_collector_path.md) #5.

---

## Pitfall 3: state.no Not parseInt'd to a Number

**Symptom**: generator field alignment looks perfect, but collector#2 returns status=200 + empty _px3 (low-score cookie).

**Cause**: OB decoding returns `state.no` as the string `"1771962850771"`; when writing into EV2 you must **`parseInt()` to a number**, otherwise PC computes wrong (serializing a string vs a number differs in bytes — numbers aren't quoted).

**Fix**:

```javascript
ev2.d[keyMap.no] = parseInt(state.no);   // ✓
ev2.d[keyMap.no] = state.no;             // ✗ wrong
```

**This pitfall typically wastes 3 hours**. See [`../../../../bug_report/1_collector_path.md`](../../../../bug_report/1_collector_path.md) #14.

---

## Pitfall 4: OB Decoded as UTF-8 Instead of Latin-1 / binary

**Symptom**: OB response decode produces garbled output; state cannot be extracted.

**Cause**:

```javascript
Buffer.from(ob, 'base64').toString('utf-8')      // ✗ wrong
Buffer.from(ob, 'base64').toString('latin1')     // ✓ correct
Buffer.from(ob, 'base64').toString('binary')     // ✓ synonym
```

OB is a binary XOR'd byte stream containing 0x00-0x1F and other non-UTF-8 bytes; the `utf-8` decoder replaces them with U+FFFD.

**Fix**: use `latin1` or `binary`. See Stage 2 §2.6.

---

## Pitfall 5: OB Separator is "~~~~" Not "~~~"

**Symptom**: after segment splitting the count is wrong (off by one or more), handler dispatch is misaligned across the board.

**Cause**: PX uses **four tildes** as the separator, not three.

**Fix**: `split("~~~~")`, not `split("~~~")`. See Stage 2 §2.6.

---

## Pitfall 6: Must Use a Fresh UUID Each Call

**Symptom**: generator gets _px3 on the first call; from the second call onward returns 403 / low-score cookies.

**Cause**: UUID is the session identifier; **reusing the same UUID multiple times is flagged by PX as "duplicate session" and immediately rejected**.

**Fix**: call `uuidV1()` inside each `generatePx3()` invocation.

```javascript
// Wrong
const SESSION_UUID = uuidV1();
async function generatePx3() { return ... SESSION_UUID ... }

// Right
async function generatePx3() {
    const uuid = uuidV1();
    return ... uuid ...
}
```

---

## Pitfall 7: btoa Uses Node Buffer Instead of atob/btoa Polyfill

**Symptom**: base64 output matches the Node baseline but doesn't match real browser captures.

**Cause**: Node 18+ has global `atob()` / `btoa()`, but they **only accept Latin-1 strings**. In the browser, the PX SDK does:

```javascript
btoa(encodeURIComponent(s).replace(/%([0-9A-F]{2})/g, (m, h) =>
    String.fromCharCode("0x" + h)))   // UTF-8 → Latin-1 → btoa
```

Node should use `Buffer.from(s, 'utf-8').toString('base64')` to directly encode UTF-8 → base64, matching the browser. **Don't use Node's global btoa**.

See Stage 4 §4.10.4.

---

## Pitfall 8: Using an Expired / Wrong-Version SDK

**Symptom**: captures look fine but generator pass rate is consistently < 50%.

**Cause**: when you downloaded the SDK, PX returned an old version (CDN edge cache), but the capturing browser automatically got the new version. SDK SHA doesn't match the captures.

**Fix**:
1. Must use **DevTools Local Overrides** to pin (Stage 1 §1.1)
2. SDK SHA256 must match `meta.json.sdk_sha256`
3. **Don't directly download SDK from CDN as gold standard** — use the version the browser actually fetched

---

## Pitfall 9: Cross-Sample b64 Key Dictionary Mismatch

**Symptom**: 6 batches; `field_classes_ev2.json` shows **every field as DYNAMIC** (including UA, screen.width, etc., which should be STATIC).

**Cause**: the SDK version differs across batches; the **b64 key dictionary refreshed**, so `Win32` is `KEY_A` in batch 1 but `KEY_B` in batch 2; diff tooling compares by key, concluding "all DYNAMIC".

**Fix**:
1. Stage 1 §1.1 SDK locking must be strict
2. Verify `meta.json.sdk_sha256` is identical across 6 batches
3. If not → recapture

---

## Pitfall 10: Treating /ns sm/duration null/0 as a Bug

**Symptom**: the generator's captured ev2 has `ns_sm: null, ns_duration: 0`; comparing against 6 real captures, the real captures **also** have null/0.

**Misjudgment**: you assume the generator is broken and spend time debugging the `fetchNs()` function.

**Truth**: `/ns` is an async probe; **when collector#2 fires, `/ns` hasn't returned yet**, so the sm/duration fields are null/0. **This is normal**.

**Fix**: don't debug it; add a comment `// /ns is async, null is OK` and move on.

See [`../../../../bug_report/1_collector_path.md`](../../../../bug_report/1_collector_path.md) #25.

---

## Summary: Root-Cause Analysis of the 10 Pitfalls

| Pitfall # | Root cause | Frequency |
|---|---|---|
| 1 | Insufficient capture hygiene awareness | High |
| 2 | Substituting a generic tool for PX custom | High |
| 3 | Weak type system (JS string vs number) | High |
| 4 | Insufficient character-encoding awareness (UTF-8 vs Latin-1) | Medium |
| 5 | Mis-memorized protocol constants | Medium |
| 6 | Didn't reproduce real browser's "new session each time" | Medium |
| 7 | Browser vs Node API subtle differences | High |
| 8 | Lax SDK version management | Medium |
| 9 | SDK locking failure → field classification chaos | Medium |
| 10 | Inadequate understanding of async behavior | Low (but commonly misjudged) |

**Conversely**: build **rigorous capture hygiene + type-checking awareness + a protocol constants quick reference + strict SDK locking**, and these 10 pitfalls can be avoided 8+ times out of 10.

---

## Advanced Gotchas → Full 68 Entries

[`../../../../bug_report/`](../../../../bug_report/):
- `1_collector_path.md` — 33 Collector path gotchas
- `2_bundle_path.md` — 20 Bundle path gotchas
- `3_environment.md` — 8 network/IP/TLS gotchas
- `4_sdk_drift.md` — 7 SDK upgrade gotchas

---

## Methodology Complete

→ Back to [Overview](../00_overview.md) or [README](../README.md)
