# Gotcha 8 — hQ dictionary index off-by-one

## Symptom

You extract the hQ dictionary, look up a key the SDK uses (e.g.
`RTEwewNQMUg=`), and get the wrong semantic string. Or worse — you get a
neighbour: querying `RTEwewNQMUg=` returns `"timestamp"` when the SDK
internally treats it as `"state.no"`.

## Root cause

The hQ array in the SDK is **rotated** at module load by an amount determined
from `hM` (a magic constant). The rotation is `unshift(pop())` or its inverse,
applied N times where N is in the IIFE body.

If your `extract_hQ.js` reads the array literal directly without applying the
rotation, every index is shifted by N.

Different SDK builds have different N. iFood (2026-05-20): N = 47. Grubhub
(2026-05-20): N = 91. The N value is in the IIFE near the top of the file:

```js
(function(t, e) {
    for (var n = e; --n;) t.push(t.shift());  // rotate `n` times
})(globalHQArray, 0x2F);  // 0x2F = 47
```

## Why it was hard to find

- A wrong dictionary gives "plausible" but wrong semantics — looks like a
  documentation error, not a code bug.
- The fix is easy *if* you know to look for it; the search itself takes hours.

## Fix

In `skill/AI_re/scripts/extract_hQ.js`:

```js
function extractHQ(sdkSource) {
    const rawArray = parseArrayLiteral(sdkSource);  // raw [a, b, c, ...]
    const rotationN = parseRotationCount(sdkSource);  // IIFE last arg
    const arr = rawArray.slice();
    for (let i = 0; i < rotationN; i++) arr.push(arr.shift());
    return arr;  // now correctly indexed
}

function parseRotationCount(src) {
    // Match: })(<name>, 0x[0-9a-f]+);   or  })(<name>, <decimal>);
    const m = src.match(/}\)\(\w+,\s*(0x[0-9a-f]+|\d+)\)/i);
    if (!m) throw new Error('Cannot locate hQ rotation count');
    return parseInt(m[1], m[1].startsWith('0x') ? 16 : 10);
}
```

## Regression test

`tests/regression/08_hq_rotation.test.js`:

```js
const hQ = extractHQ(fs.readFileSync('stample/ifood/source/main.min.js', 'utf-8'));
// Lookup a known key — golden expected value
assert.strictEqual(decodeKey('RTEwewNQMUg=', hQ), 'state.no');
```

## Provenance

- SDK location: IIFE at start of main file, line ~12 (`!function(e, t)`)
- First seen: 2026-05-19 13:00

## Related

- [`docs/05_obfuscation/03_array_rotation.md`](../../skill/AI_re/references/locate-by-pattern.md)
- [`docs/05_obfuscation/05_cross_version_locating.md`](../../skill/AI_re/references/locate-by-pattern.md)

## Next

→ [Gotcha 9 — Wire chars confusion](09_wire_chars_confusion.md)
