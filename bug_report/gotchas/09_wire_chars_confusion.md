# Gotcha 9 — Wire chars `0/l` vs `O/I` vs `o/1`

## Symptom

Decoder fails on OB segments with `Unexpected character` errors, or returns
plausible but slightly-off results when running across builds.

## Root cause

PX OB segments are encoded with a **two-character alphabet** that represents
bits 0/1. The two characters look identical in many fonts but are actually
different unicode codepoints:

| SDK era | Char-0 | Char-1 |
|---|---|---|
| Old (2021-2023) | `o` (U+006F) | `1` (U+0031) |
| Mid (2024) | `O` (U+004F) | `I` (U+0049) |
| **Current (2025-2026 iFood)** | `0` (U+0030) | `l` (U+006C) |
| **Current (2025-2026 Grubhub)** | `o` (U+006F) | `I` (U+0049) |

The choice is intentional obfuscation — uses visually-similar codepoints to
confuse a human reading the source.

If your decoder hard-codes one pair, it breaks on builds using another pair.

## Why it was hard to find

- Visual inspection fails. `0` (digit zero) vs `O` (capital O) vs `o` (lowercase o)
  all look identical depending on font.
- Error messages often quote the offending character but a terminal renders
  them indistinguishably.
- Copy-paste from PDFs or screenshots tends to lose the distinction.

## Fix

In `skill/AI_re/scripts/ob.js`, detect the wire-char pair from the SDK at
extraction time:

```js
function detectWireChars(sdkSrc) {
    // The dispatch table reveals the pair — look for the `_px*` cookie segment
    // and the chars it uses.
    const m = sdkSrc.match(/['"]([oOI01l]{4,12})['"]\s*:\s*function/);
    if (!m) throw new Error('Cannot detect wire chars');
    const sample = m[1];
    const chars = [...new Set(sample)].sort();
    return { zero: chars[0], one: chars[1] };
}
```

Then in the decoder:

```js
function decodeOBSegment(seg, wireChars) {
    let bits = '';
    for (const c of seg) {
        bits += (c === wireChars.zero) ? '0' : '1';
    }
    return parseBits(bits);
}
```

In `stample/<site>/constants.json`, also store the pair as a doc-cross-reference:

```json
{
    "wire_chars": {"zero": "0", "one": "l"}
}
```

## Regression test

`tests/regression/09_wire_chars_detect.test.js`:

```js
const ifoodSrc = fs.readFileSync('stample/ifood/source/main.min.js', 'utf-8');
assert.deepStrictEqual(detectWireChars(ifoodSrc), { zero: '0', one: 'l' });

const grubhubSrc = fs.readFileSync('stample/grub/source/init.js', 'utf-8');
assert.deepStrictEqual(detectWireChars(grubhubSrc), { zero: 'o', one: 'I' });
```

## Provenance

- SDK location: handler dispatch table, lines ~12500–13800
- First seen: 2026-05-19 (during Grubhub port — first sight of `o/I` pair)

## Related

- [`docs/02_algorithms/04_ob.md`](../02_algorithms/04_ob.md)
- [`docs/05_obfuscation/05_cross_version_locating.md`](../05_obfuscation/05_cross_version_locating.md)

## Next

→ [Gotcha 10 — Interleave odd length](10_interleave_odd_length.md)
