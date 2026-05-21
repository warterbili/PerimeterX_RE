# `research/` — Original studies

> Beyond reverse engineering, this repo also contains **research artifacts** —
> studies that use the reverse-engineered understanding to answer questions
> that aren't answerable from product docs.

## Studies

| # | Study | Status |
|---|---|---|
| 1 | [Field entropy analysis](01_field_entropy/README.md) | Stable |
| 2 | [SDK drift longitudinal study](02_sdk_drift_longitudinal/README.md) | Ongoing |
| 3 | [Threat model + adversary cost](03_threat_model/README.md) | Stable |
| 4 | [Cross-vendor comparison (PX vs DataDome vs Akamai)](04_cross_vendor_comparison/README.md) | Stable |
| 5 | [Field isolation experiments](05_field_isolation_experiments/README.md) | Stable |
| 6 | [Failure mode characterization](06_failure_modes/README.md) | Stable |

## Why include research

A reverse-engineering writeup answers "how does it work?" Research goes
further: "what does it imply?", "where are the weak points?", "how is it
changing over time?". The hope is that PX (or its customers, or competitors)
can use these studies to improve defenses.

## How to add a new study

1. Pick a question that requires reverse-engineering plus measurement.
2. Create `research/NN_topic/` with a README describing question + method
   + result.
3. Include raw data (CSV/JSON) so others can re-analyze.
4. Make the result reproducible: a script that, given the data, regenerates
   the conclusions.

## Methodology

Each study follows the same shape:

- **Question**: what we're trying to learn
- **Hypothesis**: what we predict, with reasoning
- **Method**: how we measured it
- **Data**: where the raw data is committed
- **Results**: table + chart
- **Interpretation**: what it means, what it doesn't
- **Limitations**: what we can't conclude

This format keeps research honest: a hypothesis you committed to before
seeing data is harder to retrofit.
