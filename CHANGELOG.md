# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow the project's own iteration cycle (not semver).

## [Unreleased]

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
