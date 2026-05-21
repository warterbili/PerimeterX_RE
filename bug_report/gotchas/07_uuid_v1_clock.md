# Gotcha 7 — UUID v1 wall clock vs monotonic

## Symptom

UUID v1 generated locally has the right format (`xxxxxxxx-xxxx-1xxx-yxxx-xxxxxxxxxxxx`),
but the time-field portion doesn't match what the SDK produces, even when run
at the same instant.

## Root cause

UUID v1 encodes a 100-nanosecond Gregorian-epoch (1582-10-15) timestamp into the
first 60 bits. Most UUID v1 libraries (including `uuid` npm) compute this from
`Date.now() * 10000 + 122192928000000000`, which gives wall-clock time.

The PX SDK uses `performance.now()` aligned to `performance.timeOrigin`, which
is *also* wall-clock-aligned but rounded to the nearest millisecond. In the rare
case a UUID is generated in the same ms as a previous one, the SDK uses
**clock-seq increment** rather than the standard random clock-seq.

The other tricky thing: the SDK initializes the **node** field (last 48 bits)
not from `crypto.randomBytes(6)` but from a **deterministic hash of UA + a
random seed**, persistent across UUIDs in the same session.

## Why it was hard to find

- UUID v1 looks valid even when it's not "shaped" right.
- Server accepts ANY valid UUID v1 in most positions; the breakage is subtle —
  only one specific field uses UUID v1 in a way that the *node* portion
  matters for cross-validation.

## Fix

In `revers/uuid.js`:

```js
function generateUuidV1Px(uaHash, sessionSeed) {
    const now = Date.now();
    const ts = BigInt(now) * 10000n + 122192928000000000n;
    const timeLow = Number(ts & 0xFFFFFFFFn);
    const timeMid = Number((ts >> 32n) & 0xFFFFn);
    const timeHi  = Number((ts >> 48n) & 0x0FFFn) | 0x1000;  // v1 marker
    const clockSeq = (sessionSeed & 0x3FFF) | 0x8000;  // variant
    // Node = djb2(UA) XOR sessionSeed, NOT random
    const node = djb2Bytes(uaHash, sessionSeed);  // 6 bytes
    return formatUuid([timeLow, timeMid, timeHi, clockSeq, node]);
}
```

## Regression test

`tests/regression/07_uuid_v1_node.test.js`:

```js
const ua1 = 'Mozilla/5.0 (X11; Linux)';
const uuid1 = generateUuidV1Px(djb2(ua1), 42);
const uuid2 = generateUuidV1Px(djb2(ua1), 42);
// Same UA + same seed → identical node portion
assert.strictEqual(uuid1.split('-')[4], uuid2.split('-')[4]);
```

## Provenance

- SDK location: UUID v1 generator, line ~2890 (`function we()`)
- First seen: 2026-05-19 23:30

## Related

- [`docs/02_algorithms/07_uuid.md`](../02_algorithms/07_uuid.md)

## Next

→ [Gotcha 8 — hQ dictionary off-by-one](08_hq_index_off_by_one.md)
