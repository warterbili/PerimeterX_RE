# Gotcha 17 — Pointer event coords must be floats

## Symptom

Bundle #3 PX561 has all 95 fields correct. WASM outputs check out. Press
duration matches. Trajectory is Bézier. Server still rejects.

Examine your `pointerdown.offsetX`: it's `309`. The captured real value is
`309.5`.

## Root cause

DOM `PointerEvent.offsetX/Y` in real browsers are *frequently fractional*
because they come from sub-pixel layout calculations. A synthesized
`pointerdown` with integer coordinates is suspicious — synthetic events
generated via `dispatchEvent` or naive simulation produce integers by
default.

PX checks:

```python
if pointerdown.offsetX == int(pointerdown.offsetX):
    BLOCK("Integer pointer coords")
```

Not in all cases — but in the captcha-iframe context, sub-pixel
fractional coords are the default and integer coords are the exception.

## Why it was hard to find

- All other 94 fields look perfectly right
- The integer coord is "syntactically valid" — no error
- The check is one of many; the failure is silent
- Real browsers sometimes produce integers too — so it's not 100%
  diagnostic; just risky

## Fix

Use floats. Always.

`bundle/stample/mouse_tracks/mouse_trajectory.js`:

```js
function synthesizePointerEvent(buttonRect, opts) {
    return {
        offsetX: buttonRect.x + Math.random() * buttonRect.width  + 0.5,   // 309.5 etc.
        offsetY: buttonRect.y + Math.random() * buttonRect.height + 0.44,
        clientX: viewportRect.x + offsetX,
        clientY: viewportRect.y + offsetY,
        ts:      performance.now() + Math.random() * 0.5,
    };
}
```

Real captures from the pool already have float values; if you use the
captured pool you're safe by default.

## Regression test

```js
const ev = synthesizePointerEvent(buttonRect);
assert.notStrictEqual(ev.offsetX, Math.floor(ev.offsetX), 'offsetX must be fractional');
assert.notStrictEqual(ev.offsetY, Math.floor(ev.offsetY), 'offsetY must be fractional');
```

## Provenance

- Reverse-engineered from real captures: all 5 captured tracks have float
  pointer coords (`309.5`, `17.44`, `602.5`, `364.0`)
- The `364.0` is an exception — server tolerates one integer coord but
  not all four

## Related

- [`docs/04_bundle/04_bundle3_press.md`](../../main/EN/PX_Bundle_Reverse_Methodology.md)

## Next

→ [Gotcha 18 — Press duration field must equal timing diff](18_press_duration_mismatch.md)
