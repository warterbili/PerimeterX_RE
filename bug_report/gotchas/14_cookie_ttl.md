# Gotcha 14 — Cookie TTL silently expires mid-test

## Symptom

You generate a cookie at the start of a long test run. The first dozens of
business API calls succeed. After ~10 minutes, calls start failing.

## Root cause

`_px3` cookies have a TTL. The TTL is encoded in the cookie itself, set by the
OB#2 `set_cookie` segment. Defaults observed:

| Platform | TTL |
|---|---|
| iFood | 600 seconds (10 minutes) |
| Grubhub | 600 seconds |

After TTL expiry, the business API treats the cookie as missing and re-issues
the PX challenge (which our generator-side code may not be wired to handle).

## Why it was hard to find

- The behaviour mimics IP rate-limiting (sudden batch of failures).
- TTL exhaustion correlates with *time elapsed*, not *requests fired*, so
  spacing tests don't help.

## Fix

Three changes:

1. **Parse and respect the TTL.** Decode the OB#2 `set_cookie` segment to learn
   the cookie's lifetime. Store it on the cookie object.

```js
const cookie = generatePxCookie(...);
cookie.expiresAt = Date.now() + (cookie.ttlSeconds * 1000);
```

2. **Auto-refresh in long-running tests.** Before each business API call,
   check `Date.now() < cookie.expiresAt - 30000`. If not, regenerate.

3. **Document in usage docs.** Every consumer of the generator should know
   the cookie has a short lifetime.

## Regression test

`tests/regression/14_cookie_ttl.test.js`:

```js
const cookie = await generatePxCookie('ifood');
assert.ok(cookie.ttlSeconds >= 60 && cookie.ttlSeconds <= 86400,
          `TTL out of expected range: ${cookie.ttlSeconds}`);
assert.ok(cookie.expiresAt > Date.now(), 'expiresAt must be future');
```

## Provenance

- SDK location: OB#2 `set_cookie` handler call site
- First seen: 2026-05-19, while running an overnight validation set

## Related

- [`docs/03_protocol/06_cookies.md`](../../main/EN/PX_SDK_Reverse_Engineering.md)
- [`main/ZH/methodology/07_stage7_validate.md`](../../main/EN/methodology/07_stage7_validate.md)

## Phase 2 gotchas continue

→ [Gotcha 15 — Jf interleaving offset minus one (Bundle)](15_jf_offset_minus_one.md)
