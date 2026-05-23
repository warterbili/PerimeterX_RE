# Gotcha 6 — OB handler matched by name, not shape

## Symptom

Decoder works perfectly on iFood. Port to Grubhub — every OB segment fails
because handler names differ. Spend an hour renaming. Port to *another* PX
build — break again.

## Root cause

In the SDK, OB (obfuscated bytecode) segments are dispatched via a name table.
The names are themselves obfuscated and **rotate per build**. There are 27
distinct *shapes* (a shape = number-of-arguments + arg-types pattern), and the
handler at index N for shape S is what does work S.

Our first decoder matched by name (`if (segName === 'oOlIIl') doX()`), which
broke on every new build. Correct: match by **arg shape**, which is invariant
across all PX builds we've examined.

The 27 shapes are listed in [`docs/02_algorithms/04_ob.md`](../../revers/ob.js).
They are universal — same shape numbers across iFood (2026-05-20), Grubhub
(2026-05-20), and historical builds going back two years.

## Why it was hard to find

- A naive name-based decoder works for the SDK you used to write it.
- The fact that this is an industry-wide PX invariant takes seeing several
  builds.
- Documentation online (when it exists) tends to be name-based because
  authors only worked one platform.

## Fix

`revers/ob.js` is shape-matched:

```js
const SHAPE_HANDLERS = {
    // 5 args, 5th arg starts with '_px' prefix
    'set_cookie':   { args: 5, predicate: (a) => a[4]?.startsWith('_px') },
    // 1 arg, exactly 13 digits
    'timestamp':    { args: 1, predicate: (a) => /^\d{13}$/.test(a[0]) },
    // 1 arg, 64-hex
    'challenge':    { args: 1, predicate: (a) => /^[0-9a-f]{64}$/.test(a[0]) },
    // 1 short string from a known vocabulary
    'control_flag': { args: 1, predicate: (a) => ['cu','fc','o','b'].includes(a[0]) },
    // ... 23 more
};

function dispatchOB(segName, segArgs) {
    for (const [handler, rule] of Object.entries(SHAPE_HANDLERS)) {
        if (segArgs.length === rule.args && rule.predicate(segArgs)) {
            return handlers[handler](segArgs);
        }
    }
    throw new Error(`OB shape not matched: ${segName} ${JSON.stringify(segArgs)}`);
}
```

This is the **single most important architectural decision** in the entire
project. Match by shape, not name. Document it loudly.

## Regression test

`tests/regression/06_ob_shape_cross_sdk.test.js`:

```js
// Same shape table must work on ALL captured SDKs
['ifood/2026-05-20', 'grubhub/2026-05-20', 'ifood/2025-12-01'].forEach(sdk => {
    const captures = loadCaptures(sdk);
    captures.forEach(c => {
        // None should throw
        assert.doesNotThrow(() => decodeOB(c.ob_segments));
    });
});
```

## Provenance

- SDK location: OB dispatcher, lines ~12500–13800 (large jump table)
- First seen: 2026-05-19 (Grubhub port, the entire afternoon)

## Related

- [`docs/02_algorithms/04_ob.md`](../../revers/ob.js)
- [`docs/01_architecture/diagrams/ob_decode.md`](../../main/EN/PX_SDK_Reverse_Engineering.md)
- [`docs/05_obfuscation/05_cross_version_locating.md`](../../skill/AI_re/references/locate-by-pattern.md)

## Next

→ [Gotcha 7 — UUID v1 wall clock](07_uuid_v1_clock.md)
