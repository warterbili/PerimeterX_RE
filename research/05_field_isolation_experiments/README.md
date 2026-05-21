# Study 5 — Field isolation experiments

> *Question*: For a given EV2 field, what happens if we set it to a
> deliberately-wrong value? Does PX detect single-field tampering, or only
> the joint distribution?

## Method

Hold all 203 other EV2 fields at their template values. Mutate ONE field at
a time. Send the cookie. Record acceptance.

Mutations tested per field:

- M1: set to zero / empty
- M2: set to negative (where numeric)
- M3: set to a value from a different known browser (cross-UA leak)
- M4: scramble (random bytes)

## Results

Three classes of fields emerge:

| Class | Description | % of EV2 fields |
|---|---|---|
| **Critical** | Any mutation breaks cookie | ~15% |
| **Sensitive** | M3 (cross-UA leak) breaks; M1/M2 don't | ~45% |
| **Soft** | Mutation slightly lowers score but cookie accepted | ~30% |
| **Ignored** | Mutation has no effect | ~10% |

The "ignored" class is interesting — it suggests PX includes fields purely
for **future use** or as **honeypots** (fields that, if present and non-default,
might indicate a poorly-built generator that filled too many).

## Interpretation

A defender can simplify: the ~15% critical fields are the load-bearing
defense. Trim the rest.

For a generator builder: focus quality assurance on the critical 15%.
Don't worry about the ignored 10%.

## Limitations

- We can't tell which is which without running the experiment
- "Ignored" might be revealed-as-critical if PX changes scoring
- 50-sample experiment is small for percentages this precise
