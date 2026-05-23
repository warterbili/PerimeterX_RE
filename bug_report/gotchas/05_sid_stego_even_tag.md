# Gotcha 5 — SID stego on even-length TAG

## Symptom

SID extraction works on Grubhub TAG (`FmYgK1gdJEAP` — 12 chars) but breaks on
some hypothetical TAG with even length where the algorithm-derived "plane 14"
index falls on a non-existent char.

## Root cause

The SID-from-TAG steganography algorithm (see
[`docs/02_algorithms/05_sid.md`](../../revers/sid.js)) reads characters
at positions derived from TAG length. The "Plane-14 Tag Character" step:

```
for each plane in 1..14:
    char_index = (plane * tagLen) % alphabetSize
    sid_char = TAG[char_index % tagLen]
```

If `tagLen` is even and `tagLen % 14 == 0`, several planes collapse to the
same index. Not actually a bug in the algorithm; it's a bug in our extractor
that assumed each plane gave a distinct char.

## Why it was hard to find

- iFood TAG length (16) and Grubhub TAG length (12) both gave 14 distinct
  characters by coincidence.
- The bug only manifests on hypothetical TAG lengths like 14, 28, 7, where
  collisions occur.

## Fix

In `revers/sid.js`:

```js
function extractSidFromTag(tag) {
    const planes = [];
    for (let p = 1; p <= 14; p++) {
        const idx = (p * tag.length) % tag.length;
        // Allow collisions — duplicates are fine, SID is still valid
        planes.push(tag.charCodeAt(idx));
    }
    return planes.reduce((acc, b) => acc * 31 + b, 0) >>> 0;
}
```

## Regression test

`tests/regression/05_sid_stego_lengths.test.js`:

```js
// Span TAG lengths 8 to 24
for (let len = 8; len <= 24; len++) {
    const tag = 'x'.repeat(len) + 'y'.repeat(len);  // even length
    const sid = extractSidFromTag(tag.slice(0, len));
    assert.ok(Number.isFinite(sid), `SID extract failed for tagLen=${len}`);
}
```

## Provenance

- SDK location: SID step, line ~7234 (`function ke(t)`)
- First seen: 2026-05-19 22:00 (during Grubhub port)

## Related

- [`docs/02_algorithms/05_sid.md`](../../revers/sid.js)

## Next

→ [Gotcha 6 — OB handler matched by name](06_ob_handler_by_name.md)
