# Gotcha 18 — Press duration field must equal timing diff

## Symptom

Bundle #3 rejected. Press duration field reports `[1500]` (a clean
round number); timestamps say `pointerdown.ts = 37468`,
`pointerup.ts = 38936`, difference `1468`. Server sees the discrepancy.

## Root cause

PX cross-checks two pieces of evidence about how long the user held the
button:

1. The explicit duration field `QlNxGAc0fSg=` (an array `[1468]`)
2. The implicit difference `pointerup.ts - pointerdown.ts`

These must match (within ~100 ms — to allow for sub-frame jitter). If
they don't, PX infers synthetic generation: a real interaction would
naturally produce the same number in both places.

```python
implicit = pointerup.ts - pointerdown.ts
explicit = press_duration_field[0]
if abs(implicit - explicit) > 100:
    BLOCK("Duration mismatch")
```

## Why it was hard to find

- Easy to write `[1500]` (a "reasonable hold duration") as a constant
- Forgetting to derive it from the actual pointer-event timestamps
- The check is a sanity test, not a hard fail — sometimes it works, then
  someday it doesn't
- Logs don't tell you which check failed

## Fix

Always derive press duration from the timestamps:

```js
function buildPX561(ctx) {
    return {
        // ...
        TTg+cwtVPkQ_: ctx.pointerDown.offsetX,   // 309.5
        eWRKLz8HSR8_: ctx.pointerDown.ts,        // 37468
        // ...
        Lx4cFWp6GiM_: ctx.pointerUp.offsetX,
        HCkvIllJKhc_: ctx.pointerUp.ts,          // 38936
        // ...
        'QlNxGAc0fSg=': [ctx.pointerUp.ts - ctx.pointerDown.ts],  // [1468] — DERIVED
        // ...
    };
}
```

Never hardcode the duration field.

## Regression test

```js
const b3 = buildPX561(ctx);
const implicit = b3['HCkvIllJKhc='] - b3['eWRKLz8HSR8='];
const explicit = b3['QlNxGAc0fSg='][0];
assert.strictEqual(explicit, implicit, 'Duration field must match timestamp difference');
```

## Provenance

- Real captures: all 5 pool tracks have `explicit == implicit` exactly
- First diagnosed via process of elimination on a B3 that had all 94
  other fields correct

## Related

- [`docs/04_bundle/04_bundle3_press.md`](../../main/EN/PX_Bundle_Reverse_Methodology.md) §"Tier 9 — timing arrays"

## Next

→ [Gotcha 19 — Myanmar DOM template must match captcha iframe](19_myanmar_template_drift.md)
