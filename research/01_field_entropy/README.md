# Study 1 — Field entropy analysis

> *Question*: Across the 204 EV2 fields, which carry the most discriminative
> signal? If a defender could pick 10 fields to weight heavily, which 10?

## Hypothesis

The defender's information content per field varies enormously. We predict
that the **top 10 fields carry > 80%** of the total Shannon entropy across
human and bot populations.

## Method

For each EV2 field:

1. From real captures across 50 sessions on different browsers, compute
   the field's empirical distribution over humans.
2. From an attacker-template scenario (single template reused), compute
   the field's distribution over bots.
3. Shannon entropy per field = H(human) - H(bot) approximation.

Note: this study uses a synthetic-bot dataset, since we don't have
ground-truth bot captures. The "bot" distribution is the template baseline.

## Data

- `data/human_population.json` — 50 real captures (anonymized)
- `data/bot_template.json` — 1 template (the iFood `ev2_template.json`)
- `data/entropy_per_field.csv` — output

## Results

(Table to be generated from `analyze.py`; placeholder structure)

| Rank | Field semantic | Entropy bits | Cumulative % |
|---|---|---|---|
| 1 | `navigator.plugins[*].name` (set hash) | 7.2 | 14% |
| 2 | `screen.availWidth + screen.availHeight` | 6.8 | 27% |
| 3 | WebGL renderer string | 6.5 | 39% |
| ... | ... | ... | ... |

(Real numbers depend on the captured population; the script regenerates from data.)

## Interpretation

If our hypothesis holds, defenders should:

- Weight the top 10 fields ~10× the rest
- Treat the bottom 100 fields (low-entropy: language code, timezone) as
  near-zero in the scoring function
- Specifically detect "template reuse" by looking at the *joint* distribution
  of top fields rather than each in isolation

## Limitations

- Synthetic bot dataset, not real
- 50-human sample is small
- No active adversary in dataset (real attackers vary at least the top
  fields to avoid signature)
