---
name: Bug report
about: Something doesn't work — generator failing, smoke test red, etc.
title: "[bug] "
labels: bug
---

> **Before filing:** check [`bug_report/`](../../bug_report/) first — your symptom
> may already be one of the 68 documented gotchas. Especially see
> [Top 5 critical pitfalls](../../README.md#71-top-5-critical-pitfalls-read-before-you-code).

## Site

- [ ] iFood
- [ ] Grubhub
- [ ] iFood Bundle (press challenge)
- [ ] Other PX site (specify): `__________`

## What happened

<!-- One-paragraph description of the symptom. -->

## Expected

<!-- What you expected to see (e.g. "_px3=eyJ..." with ttl=330). -->

## Actual

<!-- What you got. Paste error message / non-200 response. -->

```
<paste error / response here>
```

## Reproduction

<!-- Minimal command sequence. -->

```bash
cd stample/<site>/px_cookie
node <generator>.js
```

## Environment

- Node version: `node -v`
- OS:
- Proxy (if any) — country + type (residential/datacenter):
- Date of SDK capture vs. date of failure: (drift may be the cause)
- `stample/<site>/source/SDK_INFO.md` sha256 vs current SDK on the live site:

## Diagnostic checklist

- [ ] Smoke test passes: `node smoke_test.js`
- [ ] Decoded a fresh capture and diffed against my generator output
- [ ] Confirmed the live SDK hash matches `stample/<site>/source/SDK_INFO.md`
- [ ] Read the relevant `bug_report/N_*.md` file for this path
- [ ] Checked [`bug_report/gotchas/`](../../bug_report/gotchas/) for matching symptom

## Logs / payloads (redact PII)

<details>
<summary>Generator output</summary>

```
<paste>
```

</details>

<details>
<summary>Decoded server response (state.* fields)</summary>

```
<paste>
```

</details>
