# Gotcha 13 — IP rate-limit masquerading as algorithm failure

## Symptom

Generator produces a `_px3` cookie. First 3 tries against the business API
work. The next 7 in a row fail. You assume the algorithm is non-deterministic
or you have an intermittent bug.

## Root cause

PX (and the upstream WAF on the business API) **rate-limit by IP**. If you fire
10 cookie validations in 30 seconds from the same IP, the first ~3 succeed and
the rest get rejected with the same "block" response as a malformed cookie.

This is not an algorithm failure. The algorithm is fine. The IP is hot.

## Why it was hard to find

- The error response is *identical* for malformed-cookie and IP-rate-limit
  rejections. Both return 403 with no useful body.
- Re-running 30 minutes later succeeds 10/10.
- Easy to misattribute as flakiness.

## Fix

Three changes:

1. **Spacing in test scripts.** `tests/integration/*.js` must space requests by
   at least 15 seconds to avoid triggering rate limits.

2. **Distinguish failure modes.** Add a diagnostic step before accepting "the
   algorithm is broken":

```js
// In tests/integration/diagnostic.js
async function classifyFailure() {
    // Sleep 5 minutes
    await sleep(5 * 60 * 1000);
    const result = await validateCookie(cookie);
    if (result.ok) return 'IP_RATE_LIMIT';  // recovers after wait
    return 'ALGORITHM_BUG';                  // still fails
}
```

3. **Document the symptom.** In every validation step's docs, note: "if first
   3 succeed and rest fail, suspect IP first."

## Regression test

`tests/regression/13_ip_spacing.test.js`:

```js
// Run 10 validations with 15s spacing — should be 10/10
const results = [];
for (let i = 0; i < 10; i++) {
    if (i > 0) await sleep(15000);
    results.push(await validateCookie(generateFresh()));
}
const passed = results.filter(r => r.ok).length;
assert.ok(passed >= 9, `Expected ≥9/10 passed, got ${passed}/10`);
```

(We allow 9/10 because incidental network jitter is OK.)

## Provenance

- First seen: 2026-05-19 ~22:00 — chased a phantom bug for ~30 min before
  realising

## Related

- [`main/ZH/methodology/07_stage7_validate.md`](../../main/EN/methodology/07_stage7_validate.md)
- [`docs/09_references/failure_modes.md`](../4_sdk_drift.md)

## Next

→ [Gotcha 14 — Cookie TTL expires mid-test](14_cookie_ttl.md)
