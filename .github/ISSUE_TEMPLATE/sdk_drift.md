---
name: SDK drift report
about: PerimeterX rotated something — generator was working, now isn't
title: "[drift] <site> SDK changed <YYYY-MM-DD>"
labels: sdk-drift
---

> **Why this template:** PX rotates `b64` dictionary / `TAG` / `FT` / function
> names every 1–4 weeks. These are tracked separately from regular bugs because
> the **fix pattern is well-known** (see [methodology/09_sdk_upgrade.md](../../main/EN/methodology/09_sdk_upgrade.md))
> — what we need is the diff between old and new SDK so the playbook applies.

## Site

- [ ] iFood
- [ ] Grubhub
- [ ] iFood Bundle
- [ ] Other: `__________`

## Detection

- Last working date / generator commit:
- First failure date:
- Failure symptom (one line):

## SDK fingerprint

| | Old | New |
|---|---|---|
| SDK URL | | |
| SHA256 | | |
| Captured `main.min.js` size | | |
| Likely change category | | <!-- function-name / b64 dict / TAG/FT / wire chars / new layer --> |

## Initial diff (if known)

<!-- Where did the rotation hit? Common locations: -->

- [ ] `b64` dictionary changed (gotcha #02)
- [ ] `TAG` / `FT` constant rotated
- [ ] Wire character set changed (gotcha #09)
- [ ] OB handler order / names changed (gotcha #06)
- [ ] `state.to` → EV2 key mapping changed (gotcha #11)
- [ ] Anti-tamper key offset changed
- [ ] New encryption layer introduced (Plan B territory)
- [ ] Other:

## Reproduction artifacts

- [ ] Fresh capture batch attached at `stample/<site>/sample/<N>/`
- [ ] Old vs new `main.min.js` both archived

## Recovery effort (if attempted)

<!-- If you've already started fixing — what worked, what didn't. -->

## References

- Methodology: [`main/EN/methodology/09_sdk_upgrade.md`](../../main/EN/methodology/09_sdk_upgrade.md)
- Reference case: [`bug_report/sdk_drift_cases/2026-05-19_ifood/`](../../bug_report/sdk_drift_cases/2026-05-19_ifood/)
