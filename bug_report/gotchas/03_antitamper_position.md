# Gotcha 3 — Anti-tamper insertion position

## Symptom

PC validates, payload decodes, all 204 fields are right — but the server says
"invalid". Comparing your EV2 to a real one shows two fields swapped: the
anti-tamper signature is at index N+1 where it should be at index N.

## Root cause

The anti-tamper signature is inserted at a **fixed** EV2 slot determined by the
SDK at build time. It's not the last field, it's not the first, it's slot 137
out of 204 (in the 2026-05-20 iFood build). The slot index is a build-time
constant — different SDK builds use different positions.

The reason we got this wrong: the slot looks like "near the end" when you
scan, so we put it at the end. The server validates not just the value but the
**position**.

## Why it was hard to find

- All fields validate individually.
- Position-aware testing requires comparing against a reference EV2 byte-for-byte.
- Off-by-one in position shifts every subsequent field too, but they all still
  decode to valid values, so no single field looks wrong.

## Fix

Anti-tamper position is a per-platform constant. Store it in
`stample/<site>/constants.json`:

```json
{
    ...
    "antitamper_ev2_slot": 137
}
```

Find it by:

1. Decode a real EV2.
2. For each field index, run anti-tamper over the rest of the EV2 and compare
   to the value at that index.
3. The single matching slot is the anti-tamper position.

`skill/AI_re/scripts/find_antitamper_slot.py` automates this.

## Regression test

`tests/regression/03_antitamper_slot.test.js`:

```js
const ev2 = generateEv2(state, template);
const slot = constants.antitamper_ev2_slot;
const expected = computeAntiTamper(state.to, state.no, ev2.slice(0, slot).concat(ev2.slice(slot + 1)));
assert.strictEqual(ev2[slot], expected);
```

## Provenance

- SDK location: EV2 builder function, line ~4128 (`function eb(t, e)`)
- First seen: 2026-05-19 18:10

## Related

- [`docs/02_algorithms/06_antitamper.md`](../../revers/antitamper.js)
- [`docs/03_protocol/04_ev2.md`](../../main/EN/PX_SDK_Reverse_Engineering.md)

## Next

→ [Gotcha 4 — PC MD5 slice](04_pc_md5_slice.md)
