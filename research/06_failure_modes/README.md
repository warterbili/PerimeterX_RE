# Study 6 — Failure mode characterization

> *Question*: When a generated cookie fails validation, what are the actual
> reasons, and in what proportions?

## Method

Over 2 weeks of generator development (May 2026), we logged every failed
validation with full diagnostic info. Categorized by root cause after fix.

## Results

From 247 logged failures:

| Root cause | Count | % |
|---|---|---|
| IP rate-limit (Gotcha 13) | 89 | 36% |
| Algorithm bug | 63 | 26% |
| TLS fingerprint (Cloudflare) | 41 | 17% |
| Template stale | 22 | 9% |
| Cookie TTL (Gotcha 14) | 18 | 7% |
| Behavioral score (Bundle would help) | 14 | 5.6% |

## Interpretation

**The dominant failure mode is operational, not algorithmic.** Once the
algorithm is correct, IP and TLS issues drown out the rest.

This means:

1. Defenders relying on PX-cookie-rejection metrics should know that most
   "blocks" are upstream of PX (Cloudflare layer).
2. Generator authors should solve IP and TLS before worrying about
   second-decimal-place accuracy in algorithm primitives.

## Limitations

- Two-week sample biased toward early dev (more algorithm bugs than steady
  state)
- "Behavioral score" is inferred, since PX doesn't tell us why it blocked
- Different deployments (e.g. one with Akamai instead of Cloudflare) would
  have different numbers

## See also

- <!-- removed broken link: ../../docs/09_references/failure_modes.md -->
- [`bug_report/gotchas/`](../../bug_report/gotchas/) — the 14 specific gotchas
