# Gotcha 2 — UTF-8 vs Latin-1 in payload XOR

## Symptom

Payload decodes for most fields but a handful (especially user-agent strings,
locale strings containing non-ASCII) come out with the wrong character at
the position of the first non-ASCII byte. Field "navigator.userAgent" might
decode `Mozilla/5.0 (X11â¦`, classic mojibake.

## Root cause

The payload XOR is **byte-level**, not character-level. JavaScript strings are
UTF-16; when you `xor(str, key)`, you must first lower the string to a fixed
byte representation. The PX SDK uses Latin-1 (single-byte-per-char) for input,
because the JS `String.fromCharCode` mapping naturally yields Latin-1 codes 0-255.

If your Node generator uses `Buffer.from(str, 'utf8')` for the same operation,
multi-byte UTF-8 sequences create extra bytes, shifting all downstream XOR by 1
or 2 positions for every non-ASCII char.

In the SDK:

```js
// SDK does, roughly:
for (var i = 0; i < input.length; i++) {
    out += String.fromCharCode(input.charCodeAt(i) ^ key[i % key.length]);
}
```

Note: `input.charCodeAt(i)` for non-BMP chars returns surrogate halves, which
the SDK doesn't care about because it operates on string indices, not bytes.

## Why it was hard to find

- ASCII-only test payloads pass; non-ASCII fields appear only in some user agents.
- The mojibake looks like an encoding misdetection by the *terminal*, not a
  real algorithm bug, so it's easy to dismiss.
- Server accepts the payload (PC validates a hash, not the actual fields)
  but downstream challenge fails.

## Fix

In `revers/payload.js`, the XOR loop:

```js
function xorEncrypt(plaintext, key) {
    // Treat plaintext as a sequence of Unicode code points (0..0xFFFF) and XOR
    // with key as Latin-1 bytes. This matches the SDK exactly.
    let out = '';
    for (let i = 0; i < plaintext.length; i++) {
        const c = plaintext.charCodeAt(i);
        const k = key.charCodeAt(i % key.length);
        out += String.fromCharCode(c ^ k);
    }
    return out;
}
```

DO NOT:

```js
// WRONG — converts to UTF-8 bytes
const bufIn = Buffer.from(plaintext, 'utf8');
const bufOut = Buffer.alloc(bufIn.length);
for (let i = 0; i < bufIn.length; i++) bufOut[i] = bufIn[i] ^ key.charCodeAt(i % key.length);
```

## Regression test

`tests/regression/02_utf8_xor.test.js`:

```js
const plain = 'Mozilla/5.0 (X11; Linux 中文) AppleWebKit';
const encrypted = xorEncrypt(plain, 'key50');
const decrypted = xorEncrypt(encrypted, 'key50');
assert.strictEqual(decrypted, plain);  // round-trip preserves 中文
```

## Provenance

- SDK location: payload encryption loop, line ~3210 (`function xa(t, e)`)
- First seen: 2026-05-19 16:45

## Related

- [`docs/02_algorithms/02_payload.md`](../02_algorithms/02_payload.md)

## Next

→ [Gotcha 3 — Anti-tamper position](03_antitamper_position.md)
