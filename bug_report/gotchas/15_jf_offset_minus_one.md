# Gotcha 15 — Jf interleaving uses `offsets[u] - 1`

## Symptom

Bundle #1 or #2 payload decrypts to plausible-looking JSON but every ~10th
character is "off by one position." Server rejects with no diagnostic.

## Root cause

The Bundle path's `Jf` interleaving step (which replaces the sensorless
`interleave`) splices characters from a base64'd buffer at offsets derived
from the **UUID**, NOT the AppID. The off-by-one trap: the splice index is
`offsets[u] - 1`, not `offsets[u]`:

```js
// From captcha.js poi() payload construction
for (let u = offsets.length - 1; u >= 0; u--) {
    chars.splice(offsets[u] - 1, 1);   // CRITICAL: offset - 1
}
```

If you splice at `offsets[u]` directly, every removal shifts by one
position, scrambling the result subtly.

## Why it was hard to find

- The output still looks like base64 (chars are removed from valid
  positions; the result is just slightly different)
- Round-trip through your own decoder gives back the original JSON
- Only fails when sent to PX server, which uses the correct `- 1` rule
- No diagnostic in the failure response

## Fix

`bundle/stample/helpers/payload.js`:

```js
function jfInterleave(b64Str, uuid) {
    const offsets = calcUuidOffsets(uuid);
    const chars = b64Str.split('');
    for (let u = offsets.length - 1; u >= 0; u--) {
        chars.splice(offsets[u] - 1, 1);  // offsets[u] - 1, not offsets[u]
    }
    return chars.join('');
}
```

## Regression test

```js
const golden = require('tests/golden_vectors.json').jf_interleave;
const out = jfInterleave(golden.input, golden.uuid);
assert.strictEqual(out, golden.expected);
```

## Provenance

- SDK location: `captcha.js` ~line 3169 (`poi()` payload assembly)
- First seen: 2026-05-19 during bundle reverse

## Related

- [`docs/04_bundle/02_bundle1.md`](../04_bundle/02_bundle1.md)

## Next

→ [Gotcha 16 — `_pxUuid` not set before WASM init](16_pxuuid_wasm_init.md)
