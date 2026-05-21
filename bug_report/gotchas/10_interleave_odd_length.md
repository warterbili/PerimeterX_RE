# Gotcha 10 — Interleave drops final byte on odd length

## Symptom

Payload decodes correctly for inputs of even length. Inputs of odd length lose
their final byte: the recovered plaintext is one character short, and that
character is silently dropped.

## Root cause

The payload encryption pipeline applies XOR → Base64 → **Interleave**. The
interleave step swaps pairs of bytes: `[a, b, c, d, e, f]` → `[b, a, d, c, f, e]`.

If the input length is odd (e.g. 7 bytes), there's an unpaired byte at the end.
The SDK implementation handles this by **appending the unpaired byte as-is**,
not dropping it:

```js
// SDK
function interleave(s) {
    let out = '';
    for (let i = 0; i + 1 < s.length; i += 2) {
        out += s[i+1] + s[i];
    }
    if (s.length % 2 === 1) {
        out += s[s.length - 1];  // ← keep last byte
    }
    return out;
}
```

A naive implementation:

```js
// BUG — drops final byte
for (let i = 0; i + 1 < s.length; i += 2) {  out += s[i+1] + s[i];  }
return out;
```

silently truncates the last byte. Base64-encoded data is multiple-of-4 chars,
which is always even, so the bug **only triggers** when working with raw
(pre-base64) XOR output, which happens on the inverse decode path.

## Why it was hard to find

- The dropped byte is silently lost — no error.
- Only triggers on inverse (decode) operations, not forward encryption.
- Tests built around base64-padded inputs (even length) all pass.

## Fix

In `revers/payload.js`:

```js
function interleave(s) {
    let out = '';
    let i = 0;
    for (; i + 1 < s.length; i += 2) out += s[i+1] + s[i];
    if (i < s.length) out += s[i];  // preserve last byte for odd length
    return out;
}

function deinterleave(s) {
    let out = '';
    let i = 0;
    for (; i + 1 < s.length; i += 2) out += s[i+1] + s[i];
    if (i < s.length) out += s[i];
    return out;
}
```

(`interleave` and `deinterleave` are self-inverse since pair swaps are involutions
and odd byte is kept in place.)

## Regression test

`tests/regression/10_interleave_odd.test.js`:

```js
// Round-trip for all lengths 0..15
for (let len = 0; len <= 15; len++) {
    const s = 'abcdefghijklmno'.slice(0, len);
    assert.strictEqual(deinterleave(interleave(s)), s,
                       `Round-trip failed at len=${len}`);
}
```

## Provenance

- SDK location: interleave function, line ~3404 (`function vc(t)`)
- First seen: 2026-05-20 02:10 (late-night debug)

## Related

- [`docs/02_algorithms/02_payload.md`](../02_algorithms/02_payload.md)

## Next

→ [Gotcha 11 — state→EV2 b64 key not derivable](11_state_to_ev2_key.md)
