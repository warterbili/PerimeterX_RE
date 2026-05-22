# Contributing to `perimeter` (PerimeterX SDK Reverse Engineering)

Thanks for your interest. This project is a **research-grade reverse-engineering
study** of the PerimeterX (HUMAN Security) anti-bot SDK. Contributions are
welcome for: new-site ports, SDK-drift reports, gotcha additions, methodology
clarifications, and English translations of remaining long-form docs.

> Before contributing, please read the [LICENSE](LICENSE) (dual-track:
> AGPL-3.0 for code, CC BY-NC-SA 4.0 for documentation) and the disclaimer
> in [README §16](README.md#16-license-ethics--responsible-disclosure).

## What this project accepts

### ✅ Welcome contributions

- **New-site ports** — generators for additional PX-protected sites
  (DoorDash / Zillow / Crunchyroll / etc.) following the
  [`stample/grub/`](stample/grub/) mirror structure
- **SDK-drift reports** — when PX rotates `b64` dictionary / `TAG` / `FT` /
  function names, file under [`bug_report/sdk_drift_cases/<date>_<site>/`](bug_report/sdk_drift_cases/)
- **New gotchas** — production-debugged failure modes (each ≥1h real debug),
  format follows the existing [`bug_report/gotchas/`](bug_report/gotchas/) shape
- **Methodology updates** — clarifications to the 10-chapter [`main/EN/methodology/`](main/EN/methodology/)
- **English translations** — outstanding ZH-only files (see [README §15](README.md#15-bilingual-status--roadmap))
- **Tooling improvements** — better CLI scripts in [`skill/AI_re/scripts/`](skill/AI_re/scripts/)

### ❌ Not accepted

- **Operational anti-bot tooling** — proxy pools, IP rotation, scheduler,
  CAPTCHA OCR, third-party solving integrations
- **Targeted automation against specific merchants** — bulk-ordering,
  inventory-hoarding, coupon abuse scripts
- **Unverified algorithm claims** — every algorithm in [`revers/`](revers/)
  has byte-exact cross-batch validation; PRs must follow the same standard
- **Closed binary blobs** — keep WASM analysis textual; do not commit large
  binary captures

## Workflow

1. **Open an issue first** for non-trivial work so we can align on scope
2. **Branch from `main`** with a descriptive name:
   `feat/doordash-port`, `fix/gotcha-20-jf-offset`, `docs/translate-bundle-doc`, etc.
3. **Verify before PR**:
   - For generators: smoke test passes + 10/10 protocol-level
   - For methodology / docs: read once end-to-end
   - For gotchas: include reproducible failing payload + working fix
4. **Open PR** — fill in the PR template
5. **CC BY-NC-SA / AGPL** — by submitting, you agree your contribution is
   released under the same dual-track license

## New-site port checklist

When porting to a new PX site, your PR should include:

- [ ] `stample/<site>/source/` — locked SDK (sha256 verified)
- [ ] `stample/<site>/sample/` — at least 6 capture batches
- [ ] `stample/<site>/px_cookie/` — generator + smoke test
- [ ] `stample/<site>/RESEARCH_PURPOSE.md` — research justification
- [ ] Smoke test passes (typically 17/17 or 21/21)
- [ ] Protocol-level 10/10 verification log
- [ ] (Ideal) End-to-end business API HTTP 200 with redacted response

## SDK-drift report checklist

When PX upgrades and breaks an existing site:

- [ ] `bug_report/sdk_drift_cases/<YYYY-MM-DD>_<site>/README.md` — what changed
- [ ] `bug_report/sdk_drift_cases/<YYYY-MM-DD>_<site>/WORKLOG.md` — recovery steps
- [ ] Updated `stample/<site>/source/SDK_INFO.md` with new sha256
- [ ] Updated smoke test if constants moved

## Commit style

- Use present-tense imperative: `Add doordash generator`, not `Added` or `Adds`
- Reference issues with `#NNN`
- For new-site ports: `Add <site> generator + N capture batches`
- For drift: `Fix <site> after SDK <old>→<new> drift`
- For gotchas: `Add gotcha #NN: <one-line summary>`

## Style

- **Markdown**: GFM, 80–120 char soft wrap; one blank line between paragraphs
- **Code**: Node.js 18+ for `revers/`, `stample/`, `bundle/script/`; Python 3.10+ for analysis scripts
- **No emojis in commit messages**; emojis in docs are sparing and intentional
- **Bilingual files**: if you add a ZH file, you do NOT need to add the EN twin,
  but if you touch an existing pair both should stay in sync

## Questions

Open a GitHub issue with the `question` label, or ping in a draft PR.
