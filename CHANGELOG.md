# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow the project's own iteration cycle (not semver).

## [Unreleased]

### Added (2026-05-23 — Demo fixes + live-validation #2 + full-chain + screenshots + repo hardening)

- `stample/live_validation/journal/2026-05-23.md` — re-run journal documenting
  the iFood + Grubhub full-chain re-validation, the 5-cause Grubhub debugging,
  and the resulting demo fixes.
- `stample/grub/px_cookie/business_api_demo_full_chain.py` — **new Python full-
  chain demo** (Stages 1-11): generates `_px2`, passes all 3 PX gates (`/auth`,
  `/auth/login`, `oauth2/<ud_id>/access`), runs 4-step SSO to obtain
  `__Host-instacart_sid`, then verifies the sid against `grocery.grubhub.com`.
  Per-gate PxAudit report; treats 463 as PX-pass; skips SSO when business-layer
  blocks login. End-to-end ~11s on a device-trusted account.
- `stample/screenshots/` — first round of **live HTTP 200 proof screenshots**
  (English) for iFood and Grubhub full chain, with all credentials/tokens
  masked. Includes rendering HTML sources + a README describing the regen flow
  via cdp-browser.
- `stample/live_validation/run_validation.sh` — entry point for
  `npm run validate`: chains Layer 1 (smoke tests) + Layer 2 (decode round-trip)
  with optional `--live` Layer 3 (business API demos).

### Fixed (2026-05-23 — Tooling + decoder + cross-platform)

- `skill/AI_re/scripts/{verify_batch,decode_payload,decode_response}.js` —
  require path typo `../reverse/` (didn't exist) → `../../../revers/`.
  Was breaking both `stample/{ifood,grub}/script/verify_all.sh` (0/6).
- `skill/AI_re/scripts/verify_batch.js` — TAG was hardcoded to iFood's
  `U0MmDhUmOnhXSw==`, causing Grub samples to decode with the wrong XOR seed
  (segment-count mismatch, 0/6). Now reads `tag` from each batch's `meta.json`
  (env `PX_TAG` overrides; iFood default as fallback).
- `stample/{ifood,grub}/source/SDK_INFO.md` SDK SHA was inconsistent across
  platforms (CRLF on Windows vs LF on Linux/Mac). Both files now declare
  **LF-normalized SHA**; smoke tests strip `\r\n` before hashing for
  cross-platform stability. iFood: `e042d5de…`. Grub: `4accf1a5…`.
  Resolves the false "SDK drift" warning that put Grub smoke test at 16/17.
- `skill/cdp/scripts/cdp.py` — `CHROME_BIN` was hardcoded to the macOS path,
  breaking `python cdp.py start` on Windows and Linux. Now auto-detects by
  `sys.platform` (Mac / Windows / Linux candidate list); `CHROME_BIN` /
  `CHROME_PROFILE` env overrides honored. `CHROME_PROFILE` defaults to
  `tempfile.gettempdir()/chrome-cdp-profile` (no more hardcoded `/tmp/...`).
- ~60 broken Markdown links across `bug_report/gotchas/`, `main/{EN,ZH}/`
  `methodology/`, and `skill/AI_re/playbooks/` — links to a hypothetical
  `docs/02_algorithms/`, `docs/03_protocol/`, etc. tree that never landed.
  Redirected to actual targets (`revers/<module>.js`,
  `main/EN/PX_SDK_Reverse_Engineering.md`,
  `main/EN/methodology/0N_*.md`, `skill/AI_re/references/`); a handful with no
  good target removed.

### Security (2026-05-23 — Credential & PII scrub)

- Removed hardcoded BrightData proxy credentials, Grubhub account email +
  password, and session-token leftovers from `stample/{ifood,grub}/px_cookie/
  business_api_demo*.{js,py}`, `stample/live_validation/journal/2026-05-23.md`,
  and `stample/grub/RESEARCH_PURPOSE{,_EN}.md`. Replaced with `<YOUR_*>`
  placeholders and added startup guards that exit when placeholders are still
  present. Account/proxy/token references throughout the docs now use generic
  "account-A/B/C", "device-trusted account", `****@***.***`, or 8-char UUID
  prefix + `****` patterns.
- Removed real-name reference from `bug_report/sdk_drift_cases/
  2026-05-19_ifood/WORKLOG{,_EN}.md` — `Shudong Lu` → `warterbili`.

### Changed (2026-05-23)

- `stample/ifood/px_cookie/business_api_demo.js`:
  - **Bug fix**: `path: u.pathname` dropped the `?channel=IFOOD` query string,
    causing the iFood backend to return `400 Merchant not found` regardless of
    a valid PX cookie. Fixed to `path: u.pathname + u.search`.
  - Added 4 production-required headers: `platform`, `app_version`, `Country`,
    `browser`.
  - `DEFAULT_MERCHANT_ID` updated from the now-defunct
    `ccd2ff85-a898-4da3-bd72-428a66443a2f` (2026-05-21 capture, since dead) to
    `5770dab7-943e-4046-9b71-1f9d39aec822` (Bar e Lanches Estadão, verified live
    2026-05-23).
- `stample/grub/px_cookie/business_api_demo.js`:
  - User-Agent rewritten to **Chrome 120** to match `curl_cffi
    impersonate='chrome120'` TLS fingerprint. A mismatched UA (Chrome 148) was
    being scored as a bot by PX.
  - `x-gh-features` Chrome version sub-token aligned to `3=Chrome 120.0.0.0;`.

### Added

- Top-level `LICENSE` file (dual-track: AGPL-3.0 for code + CC BY-NC-SA 4.0 for docs)
- `CONTRIBUTING.md` with new-site / SDK-drift / gotcha checklists
- `CHANGELOG.md` (this file)
- `.github/ISSUE_TEMPLATE/` — bug, sdk-drift, new-site templates
- `.github/PULL_REQUEST_TEMPLATE.md`
- Full English translations:
  - Top-level `README_EN.md`
  - 4 main gotcha files + sdk_drift_cases (`bug_report/*_EN.md`)
  - Bundle README, source SDK_INFO, WASM_ANALYSIS, script READMEs, stample
  - `main/EN/` — 4 core technical docs + 10-chapter methodology + appendix + EV1/EV2 reference
  - `bundle/doc/Bundle_Complete_Technical_Doc.md` (4,996-line Bundle main doc EN)
  - `node_bridge/` — README + skill (SKILL, methodology, new_site_guide)
  - `revers/README_EN.md`
  - `stample/` dual-site mirror in EN (RESEARCH_PURPOSE, px_cookie, script, source)
  - `stample/live_validation/` README + journal

### Changed

- README license badge: "Research Only" → "Dual-track (AGPL-3.0 + CC BY-NC-SA 4.0)" with link to LICENSE
- §15 Bilingual Status table: flipped most rows from "in translation" → "✅ <EN link>"
- §16.1 License section: opens with link to root `LICENSE`
- BibTeX citation URL: `<owner>/perimeter` placeholder → `warterbili/PerimeterX_RE`
- `README_EN.md` internal links: relative paths now point to `_EN.md` / `main/EN/` files where they exist
- `LICENSE`: references to non-existent `LICENSE-CODE` / `LICENSE-DOCS` replaced with canonical FSF / CC URLs

### Removed

- `EN_TRANSLATION_ROADMAP.md` — superseded by the actual translations landing

## [2.0] — 2026-05-21

Paper-grade complete public release.

### Highlights

- **iFood `_px3` + Grubhub `_px2`** dual-site generators, **10/10** protocol-level
- **iFood Bundle (press challenge)** completely reverse-engineered, **10/10**
  via 2,131-line userscript (WASM PoW + Bézier mouse + Myanmar / Plane-14 stego)
- **9 pure-algorithm primitives** in [`revers/`](revers/) with byte-exact validation
  across 6 capture batches per site
- **End-to-end business API verified 2026-05-21**:
  - iFood — HTTP 200 from `cw-marketplace.ifood.com.br/v1/merchant-info/graphql` via BR-residential proxy
  - Grubhub — HTTP 200 anon_token from `/auth`
- **Plan B `node_bridge/`** — jsdom env-patching fallback for when pure-algo path is broken by SDK redesign
- **68 production gotchas** (≥1h debug each) across 4 files + 19 fine-grained gotchas in `bug_report/gotchas/`
- **6 English research dossiers** under `research/` (threat model, longitudinal SDK drift, cross-vendor, field entropy, isolation experiments, failure modes)
- **AI Skill package** — `skill/AI_re/` (9 playbooks + 5 references + 14 CLI tools + 4 intent manifests) + `skill/cdp/` (real-Chrome CDP capture, no webdriver fingerprint)
- **3-year longitudinal SDK drift study** (2024–2026)
- 20,000+ lines of structured technical documentation

### Project lineage

```
2024  perimeter_X     ──→  Initial PX exploration (PoC stage)
2025  perimeterX_Re   ──→  Methodology solidification (fork era)
2026  perimeter v2.0  ──→  Paper-level complete public release (this project)
```
