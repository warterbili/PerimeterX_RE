# Gotcha 1 — `state.no` must stay a string

## Symptom

Anti-tamper signature mismatch. Server rejects `_px3` with no obvious reason.
Decoded EV2 shows everything right except one field that is `00000` (5 zeros) where
the real SDK has `0xAB12C` or similar.

## Root cause

`state.no` is the **stringified base-36 timestamp**. The SDK uses it as a string
throughout, including:

- Inserting it into EV2 as `state.no`'s b64-key field
- Feeding it to the anti-tamper function (`te(state.to, no)` — see
  [`docs/02_algorithms/06_antitamper.md`](../../revers/antitamper.js))

The anti-tamper function ends with `% 10` over `no`'s ASCII codes. If you
`parseInt(no)` somewhere upstream, you lose the leading characters (`'a',
'b', ...` become `NaN`), and the entire shift collapses to `0`.

We hit this because Node's auto-coercion in `state[k] = no` would, in some
contexts, prefer Number over String if `no` looked numeric. Edge cases:

- `no = "12345"` → JS sometimes coerces to number, anti-tamper mis-fires
- `no = "abc12"` → safe (NaN under coercion)

## Why it was hard to find

- The error only fires when `no` happens to be a pure-digit base-36 string,
  which is ~10% of timestamps.
- Bench tests use synthetic `no` like `"abcdef"` which never triggers it.
- The anti-tamper output is one of 204 fields; a single field being wrong is
  invisible until the server rejects.

## Fix

In `stample/<site>/px_cookie/state.js`:

```js
function getStateNo() {
    // Force string — Date.now().toString(36) returns string, but be explicit:
    return String(Date.now().toString(36));
}
```

Throughout the generator, `state.no` is `String`-typed in JSDoc, and all
operations on it are string operations (`.charCodeAt(i)`, `.slice`, …).

## Regression test

`tests/regression/01_state_no_string.test.js`:

```js
const no = getStateNo();
assert.strictEqual(typeof no, 'string', "state.no must be a string");
// And the all-digit case:
const sig = computeAntiTamper("3", "99999");  // numeric-looking no
assert.notStrictEqual(sig, computeAntiTamper("3", 99999));  // Number version differs
```

## Provenance

- SDK location: line ~9847 of beautified `main_pretty.js` — function `te(t, e)`
- First seen: 2026-05-19 14:23 (worklog entry "anti-tamper computing 0...0")

## Related

- [`docs/02_algorithms/06_antitamper.md`](../../revers/antitamper.js)
- [`docs/02_algorithms/03_pc.md`](../../revers/pc.js) (PC has a similar
  no-as-string requirement)

## Next

→ [Gotcha 2 — UTF-8 vs Latin-1 byte alignment](02_utf8_latin1_xor.md)
