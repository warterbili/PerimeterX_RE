# Study 3 — Threat model + adversary cost

> *Question*: For each tier of adversary (T1-T5 from `docs/09_references/threat_model.md`),
> what is the realistic time-to-bypass for PX sensorless?

## Method

Based on first-hand experience + interviews with peers + scrape vendor
public pricing.

## Results

| Tier | Description | Time to bypass | Cost (USD) |
|---|---|---|---|
| T1 | `curl` user | Never (≫ 1 month) | Trivial |
| T2 | Default Playwright | ~3 days research | Free |
| T3 | Patched Playwright | ~1 week research | Cheap (one engineer) |
| T4 | Custom + this repo | ~4 hours per platform | One engineer-day |
| T5 | Vendor SaaS scrape | Minutes (deployed) | $5-50 per 1k cookies |

## Interpretation

The defense is **economically tilted** rather than impossible. PX makes
casual scraping uneconomic, which is its design goal. Determined
adversaries with funding always defeat client-side detection eventually.

The defender's investment should be in **stacked defenses** (rate limits,
behavioral monitoring server-side, fraud detection post-action) rather than
SDK rotation alone.

## Limitations

- T5 numbers come from public marketing claims, not verified
- T3/T4 estimates assume an experienced reverser; novices take 5-10×
- Doesn't account for IP procurement cost (often dominates)
