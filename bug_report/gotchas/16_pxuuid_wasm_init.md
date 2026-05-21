# Gotcha 16 — `_pxUuid` must be set before WASM init

## Symptom

WASM loads in Node.js. `a()` returns a valid 64-hex string. `b(answer)`
returns 127 chars from the custom alphabet. But the server rejects
Bundle #2 / #3 with no specific reason — only "challenge failed."

## Root cause

WASM `b()` reads `window._pxUuid` via its `__wbg_get` import bridge during
**state initialization**. If `_pxUuid` is `undefined` at instantiation
time, `b()` uses a zero UUID, producing plausible-looking but useless
output.

In a browser, PX itself sets `window._pxUuid` early in captcha.js init. In
Node, you have to do it manually:

```js
globalThis._pxUuid = sessionUuid;  // BEFORE initWasm
const wasm = await initWasm({ ... });
```

## Why it was hard to find

- `b()` doesn't throw — it returns valid-shape garbage
- Round-trip through your own validator passes (no check exists)
- Only PX server can tell something is wrong
- No log, no warning, no exception path

## Fix

`bundle/stample/helpers/run_wasm.js` documents the requirement loudly. If
you call `initWasm` without setting `_pxUuid`, the wrapper now throws:

```js
async function initWasm({ uuid, wasmPath }) {
    if (!uuid) throw new Error('initWasm: uuid is required');
    globalThis._pxUuid = uuid;
    globalThis.window = globalThis;
    // ... rest of init
}
```

Force the bug to surface at call time, not at server-rejection time.

## Regression test

```js
const wasm1 = await initWasm({ uuid: 'aaaa-bbbb-cccc-dddd', wasmPath: '...' });
const b1 = wasm1.b('ab31...c24da');
const wasm2 = await initWasm({ uuid: 'aaaa-bbbb-cccc-dddd', wasmPath: '...' });
const b2 = wasm2.b('ab31...c24da');
assert.strictEqual(b1, b2, 'b() must be deterministic given same UUID + input');
```

If `_pxUuid` isn't being passed through correctly, the second call's UUID
will differ and outputs won't match.

## Provenance

- SDK location: WASM `__wbg_get` import handler ~line 2890 of beautified
  captcha.js
- First seen: 2026-05-19 during Node-side WASM port

## Related

- [`docs/04_bundle/07_wasm.md`](../04_bundle/07_wasm.md)

## Next

→ [Gotcha 17 — Pointer coords must be floats](17_pointer_float_coords.md)
