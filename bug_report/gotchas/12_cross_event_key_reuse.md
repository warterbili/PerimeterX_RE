# Gotcha 12 — Cross-event b64 key reuse assumption

## Symptom

You've correctly mapped `state.no` to its EV1 b64 key (e.g. `Tl8mTl4mWh8=`).
You use the same b64 key for EV2 and the EV2 fails.

## Root cause

EV1 and EV2 use **different b64 key spaces**. The same semantic field has
different b64 keys in EV1 vs EV2:

| Semantic | EV1 b64 key | EV2 b64 key |
|---|---|---|
| `initTime` | `Tl8mTl4mWh8=` | `VQEgCxNnKjw=` |
| `state.no` | n/a (not in EV1) | `RTEwewNQMUg=` |
| `uuid` | (yes) `LTtdLgB+L0M=` | (also yes) `NSEAa3NAC18=` |

`uuid` appears in both events, but the b64 key differs because the slot index
in each event's field array differs.

## Why it was hard to find

- The semantic is the same.
- The value is the same.
- The fact that "same semantic, different b64 key per event" feels wrong.

## Fix

Don't share field maps between EV1 and EV2. Two separate JSONs:

- `stample/<site>/ev1_field_map.json`
- `stample/<site>/ev2_field_map.json`

Generators reference each independently:

```js
// In ifood_px3.js
const EV1 = require('platforms/ifood/ev1_template.json');
const EV1_KEYS = require('platforms/ifood/ev1_field_map.json');
const EV2 = require('platforms/ifood/ev2_template.json');
const EV2_KEYS = require('platforms/ifood/ev2_field_map.json');

EV1[EV1_KEYS.initTime] = nowMs();   // EV1 key
EV2[EV2_KEYS.initTime] = nowMs();   // DIFFERENT EV2 key
```

## Regression test

`tests/regression/12_ev1_ev2_keys.test.js`:

```js
const ev1Map = require(`platforms/${PLATFORM}/ev1_field_map.json`);
const ev2Map = require(`platforms/${PLATFORM}/ev2_field_map.json`);

// Verify they are indeed different objects (catch accidental copy-paste)
assert.notDeepStrictEqual(ev1Map, ev2Map);

// Sample 5 fields present in both — verify keys differ for each
['initTime', 'uuid', 'userAgent', 'language'].forEach(field => {
    if (ev1Map[field] && ev2Map[field]) {
        assert.notStrictEqual(ev1Map[field], ev2Map[field],
                              `${field} should have different keys in EV1 vs EV2`);
    }
});
```

## Provenance

- SDK location: separate EV1 builder (`ea`) and EV2 builder (`eb`) functions
- First seen: 2026-05-20 03:00

## Related

- [`docs/03_protocol/03_ev1.md`](../../main/EN/PX_SDK_Reverse_Engineering.md)
- [`docs/03_protocol/04_ev2.md`](../../main/EN/PX_SDK_Reverse_Engineering.md)

## Next

→ [Gotcha 13 — IP rate limit misread](13_ip_rate_limit.md)
