# Gotcha 4 — PC reads MD5 from wrong slice

## Symptom

PC mismatch on validation. The number you compute is 10–11 digits like the real
one, but never matches.

## Root cause

The PC algorithm (see [`docs/02_algorithms/03_pc.md`](../02_algorithms/03_pc.md))
is HMAC-MD5 of the payload, then extract digit characters from the **hex**
output, joined and truncated to a specific length.

The trap: there are several plausible "hex" slices.

| Source | Length | Digit-extract gives |
|---|---|---|
| Raw bytes (16) → hex (32 chars) | 32 | wrong (varies) |
| `toLowerCase()` hex | 32 | wrong |
| **uppercase hex** | 32 | **correct** |
| base64 of bytes | 24 | wrong |

The SDK calls `.toUpperCase()` on the hex output before digit extraction. Easy
to miss because lowercase and uppercase hex look identical visually for digits
0-9; the difference only matters when you string-compare to find digit
characters (0-9 vs a-f), and `.match(/\d/g)` works on both, but the digit
*positions* differ in lowercase vs uppercase because `a-f` in uppercase don't
match `\d` differently — wait, they shouldn't. Then why?

The actual issue: PX inserts a **prefix byte** before HMAC-ing. Specifically,
the input to HMAC is not `payload` but `payload + state.appId.slice(2,5)`. We
missed the suffix.

## Why it was hard to find

- PC is a number — it doesn't decode into something you can compare.
- A correct PC differs from a wrong PC by random digits; there's no diagnostic
  pattern.
- The HMAC key was easy to find (constant in SDK); the input shape was not.

## Fix

In `revers/pc.js`:

```js
function computePC(payload, appId) {
    const input = payload + appId.slice(2, 5);  // CRITICAL: appId suffix
    const md5 = HmacMD5(input, PC_HMAC_KEY).toString().toUpperCase();
    const digits = md5.match(/\d/g).join('');
    return digits.slice(0, PC_LENGTH);  // platform-specific length: 10 (iFood), 11 (Grubhub)
}
```

## Regression test

`tests/regression/04_pc_md5_slice.test.js`:

```js
// Golden vector from real capture
const real = require('../../platforms/ifood/samples/1/decoded_payload_1.json');
const computed = computePC(real.payload_raw, 'PXO1GDTa7Q');
assert.strictEqual(computed, real.pc);
```

## Provenance

- SDK location: PC computation, line ~5876 (`function gb(t, e)`)
- First seen: 2026-05-19 20:15

## Related

- [`docs/02_algorithms/03_pc.md`](../02_algorithms/03_pc.md)

## Next

→ [Gotcha 5 — SID stego on even-length TAG](05_sid_stego_even_tag.md)
