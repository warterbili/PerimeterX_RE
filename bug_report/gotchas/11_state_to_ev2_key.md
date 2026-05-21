# Gotcha 11 — state.* → EV2 b64 key has no derivation rule

## Symptom

You've built a working iFood generator. You port to Grubhub. You assume that
`state.no`'s EV2 field b64 key is the same b64 key for `"no"` in the hQ
dictionary. It isn't. Your generator produces EV2s that have `state.no`'s value
in the WRONG SLOT — the server interprets your `state.no` as `state.qa`, or
vice versa.

## Root cause

There's no algorithmic mapping from a state variable name (`state.no`) to its
EV2 b64 key. The SDK has the state field names internally, but they're inserted
into the EV2 by **direct lookup against a build-time table**, not by computing
hash(`"no"`).

Concretely:

| state | iFood EV2 b64 key | Grubhub EV2 b64 key |
|---|---|---|
| `state.no`  | `RTEwewNQMUg=` | `UT0ndxdcJUQ=` |
| `state.to`  | `FCAhKlJCIxk=` | `UBxmVhZ+Z2U=` |
| `state.appId` | `Xi5rJBtKaB4=` | `CXV/P0wRfwU=` |
| `state.pxsid` | (varies) | (varies) |
| `state.cts` | (varies) | (varies) |

These b64 keys are **not** decryptions of `"no"`, `"to"`, etc. via the hQ
dictionary. They are platform-specific binding choices.

This was the longest single bug of the project — 3+ hours of "but my hQ
mapping says `RTEwewNQMUg=` is `timestamp`, why does Grubhub use it for
`state.appId`?"

## Why it was hard to find

- There's no pattern. You can't `derive` the binding.
- The b64 keys look like they should be hashes, but they aren't.
- Cross-platform consistency fails silently — server accepts the EV2 as
  "syntactically valid" until business logic catches the wrong slot value.

## Fix

We discovered the rule empirically: **value-match in real captures**. From the
six-batch captures, find which b64 key holds the value that the OB segment
gave us for `state.no` (a 13-digit timestamp). That key is the binding.

`skill/AI_re/scripts/find_state_keys_in_ev2.py` does this automatically:

```python
# For each batch:
#   1. Decode OB segments from response_1 → state.no, state.to, etc.
#   2. Decode EV2 payload → 204 b64-keyed fields
#   3. For each state var, find b64 key whose value matches the OB-derived state value
#   4. Confirm the b64 key matches across all 6 batches
# Output: { "state.no": "<b64 key>", "state.to": "<b64 key>", ... }
```

Store the result in `stample/<site>/state_key_map.json`:

```json
{
    "state.no": "RTEwewNQMUg=",
    "state.to": "FCAhKlJCIxk=",
    "state.appId": "Xi5rJBtKaB4=",
    ...
}
```

## Regression test

`tests/regression/11_state_keys.test.js`:

```js
const stateKeys = require(`platforms/${PLATFORM}/state_key_map.json`);
const samples = loadSamples(PLATFORM);
samples.forEach(s => {
    const obState = decodeOB(s.response_1).state;
    const ev2 = decodePayload(s.request_2);
    Object.entries(stateKeys).forEach(([stateVar, b64Key]) => {
        assert.strictEqual(ev2[b64Key], obState[stateVar.replace('state.', '')],
                          `${stateVar} key mismatch in sample ${s.id}`);
    });
});
```

## Provenance

- SDK location: EV2 builder, lines ~4128–4280. The state field copies are
  spread across many small assignments rather than a table — there is no
  central registry to find.
- First seen: 2026-05-19 ~19:00 — 22:00 (full evening lost)

## Related

- [`main/ZH/methodology/05_stage5_value_match.md`](../06_methodology/05_stage5_value_match.md)
  (this is THE problem that motivated Stage 5)
- [`docs/03_protocol/05_state.md`](../03_protocol/05_state.md)

## Next

→ [Gotcha 12 — Cross-event b64 key reuse](12_cross_event_key_reuse.md)
