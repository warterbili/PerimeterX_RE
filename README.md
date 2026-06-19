<div align="center">

# PerimeterX / HUMAN Security — SDK Reverse Engineering

**Pure-algorithm reconstruction of PerimeterX's `_px3` / `_px2` cookie chain — no browser, no automation framework.**

[![version](https://img.shields.io/badge/version-2.0-blue?style=flat-square)](#)
[![iFood](https://img.shields.io/badge/iFood-10%2F10-success?style=flat-square)](stample/ifood/)
[![Grubhub](https://img.shields.io/badge/Grubhub-10%2F10-success?style=flat-square)](stample/grub/)
[![Total Wine](https://img.shields.io/badge/Total%20Wine-10%2F10%20strict-success?style=flat-square)](stample/totalwine/)
[![Academy](https://img.shields.io/badge/Academy-10%2F10%20strict%2B-success?style=flat-square)](stample/academy/)
[![Walmart](https://img.shields.io/badge/Walmart-10%2F10%20PX--layer-yellow?style=flat-square)](stample/walmart/)
[![License](https://img.shields.io/badge/license-AGPL--3.0%20%2B%20CC%20BY--NC--SA-orange?style=flat-square)](#license)

[中文](README.zh.md) · [Quick Start](#quick-start) · [How it works](#how-it-works) · [Docs](#documentation) · [AI Skill](skill/AI_re/) · [License](#license)

</div>

> Given a target URL + AppID, this project rebuilds the PerimeterX collector POST chain entirely in
> pure math (Node.js) and emits a valid `_pxN` cookie. Every constant, field position, and field type
> is extracted from **live captures**, never from memory or stale docs. Research / education only.

> ⚠️ **Research, education, and personal security-audit use only.** Not a scraping tool — ships no proxy
> pools, schedulers, IP rotation, or solving integrations. See [Disclaimer](#ethics--disclaimer) before use.

## What it does

- **Reconstructs the silent collector flow** — EV1/EV2/EV3 sensor payloads → collector POST chain → `_pxN`, no headless browser.
- **9 reusable crypto/encoding primitives** ([`revers/`](revers/)) — payload XOR/base64/interleave, PC (HMAC-MD5), OB decode, SID stego, UUID v1, djb2, memory, anti-tamper, `/ns`.
- **Template methodology** — capture 6 real batches, lock STATIC fields, reverse DYNAMIC fields from the SDK. ~90% of code ports across sites; only constants + a handful of b64 keys differ.
- **Three deployment tiers** — the same SDK is configured differently per customer; the project documents lenient → strict → strict+ and what each extra server-side check requires.

## Validated sites

| Site | Tier | Cookie | Chain | Result |
|---|---|---|---|---|
| [ifood.com.br](stample/ifood/) | lenient | `_px3` (ttl 330) | 2-POST | **10/10** |
| [grubhub.com](stample/grub/) | lenient | `_px2` (ttl 500) | 2-POST | **10/10** |
| [walmart.com](stample/walmart/) | lenient | `_px3` (ttl 330) | 2-POST | **10/10** ² |
| [totalwine.com](stample/totalwine/) | **strict** | `_px2` (ttl 330) | 3-POST + EV3 | **10/10** |
| [academy.com](stample/academy/) | **strict+** | `_px3` (ttl 330) | 3-POST + TLS/IP-bound trust | **10/10** ¹ |

All constants come straight from real POST-body captures (6 auditable batches per public site).
¹ academy is a strict+ case (trust bound to the mint's TLS fingerprint, `/ns` token, real-Chrome template,
and exit-IP reputation); its generator package is kept private. The tier methodology is documented in the
[AI skill](skill/AI_re/references/deployment-tiers.md).
² walmart is **PX-layer only** — the site's primary gate is **Akamai Bot Manager**, with PerimeterX as a
secondary layer. The `_px3` is accepted by the PX collector (10/10) but does **not** pass Walmart business
APIs (Akamai `_abck`/`bm_sv` is out of this skill's scope). Included as a clean lenient + cross-event-consistency
reference.

## Quick start

```bash
git clone https://github.com/warterbili/PerimeterX_RE.git
cd PerimeterX_RE && npm install

# iFood — generate _px3 (lenient tier, runs as-is)
node stample/ifood/px_cookie/ifood_px3.js
# → ✅ _px3=eyJ1IjoiYWJj…  ttl=330   ev1=14  ev2=204

# Grubhub — generate _px2
node stample/grub/px_cookie/grubhub_px2.js

# Walmart — generate _px3 (lenient; PX-layer only, needs a US egress IP)
node stample/walmart/px_cookie/walmart_px3.js
# → ✅ _px3=a2426f96…  ttl=330  ev1=12 ev2=207
# ⚠️ PX-layer only: Walmart's business APIs are gated by Akamai (out of scope).
# PX-success differential proof: node stample/walmart/script/px_success_proof.js

# Total Wine — generate _px2 (strict tier, 3-POST; needs a US residential proxy)
HTTPS_PROXY=http://user:pass@host:port node stample/totalwine/px_cookie/totalwine_px2.js
# → _px2=…  ttl=330  ev1=13 ev2=199 ev3=11  seq2=200

# End-to-end business call (proxy required) — cookie → real gated HTML
node stample/totalwine/px_cookie/business_api_demo.js
```

Each `stample/<site>/px_cookie/` has a `smoke_test.js` (offline self-check) and `business_api_demo.js`
(end-to-end). The press-challenge path is a userscript — see [`bundle/`](bundle/).

## How it works

PerimeterX runs two defenses. **99% of traffic** is the **silent collector**: the SDK serializes sensor
events (EV1/EV2/EV3), encrypts them (XOR → base64 → interleave), signs a PC (HMAC-MD5 digit extraction),
POSTs to the collector, and gets back an OB-encoded `_pxN`. The **<1% press-challenge** path adds a PoW +
WASM bundle — handled separately in [`bundle/`](bundle/).

A generator is a real capture template with only the **dynamic** fields overwritten: server state
(`parseInt`'d), HMAC/MD5 fields (inputs reversed per-site from the SDK), counters, timestamps, the `/ns`
token, and the anti-tamper slot. Strict tiers add a mandatory EV3 cookie-confirmation beacon, counter
sync, and `hid`; strict+ additionally binds trust to the **mint transport** (real Chrome TLS) and exit-IP
reputation. Full methodology: [`main/`](main/) and the [AI skill](skill/AI_re/).

## Project structure

```
revers/        9 algorithm modules (require()-able)         skill/      AI reverse-engineering skill
stample/       per-site generators + 6 capture batches        ├─ AI_re/  PX core skill (playbooks + tools)
  ├─ ifood/    lenient · _px3                                  └─ cdp/    real-Chrome CDP capture skill
  ├─ grub/     lenient · _px2                                main/       technical docs (ZH + EN)
  ├─ walmart/  lenient · _px3 · PX-layer only (Akamai-gated) bug_report/ gotchas / failure-mode records
  ├─ totalwine/ strict · _px2 · 3-POST                       research/   field-entropy + SDK-drift studies
  └─ academy/  strict+ · _px3 · TLS/IP-bound trust
bundle/        press-challenge path (PoW + WASM userscript)
node_bridge/   JSDOM "Plan B" oracle (run the real SDK)
```

## Documentation

| Doc | What |
|---|---|
| [`main/ZH`](main/ZH/) · [`main/EN`](main/EN/) | Full technical reference — algorithms, protocol, EV field tables, cross-version grep methodology |
| [`skill/AI_re/`](skill/AI_re/) | The reverse-engineering skill: 7 references, 11 playbooks, 17 CLI tools, 23 gotchas |
| [`skill/AI_re/references/validated-sites.md`](skill/AI_re/references/validated-sites.md) | Per-site constants + b64-key maps + tier checklist (read before a new site) |
| [`skill/AI_re/references/deployment-tiers.md`](skill/AI_re/references/deployment-tiers.md) | Lenient / strict / strict+ comparison |
| [`bug_report/`](bug_report/) | Documented failure modes / pitfalls |

## Limitations

- Tied to a **locked SDK version** per site; when PX ships a new SDK, re-capture and re-derive (the skill has an upgrade playbook).
- Strict+ sites need a **real-Chrome-derived template + Chrome-TLS transport + a clean residential exit IP per cookie** — a byte-correct cookie minted over node TLS or a degraded IP is still challenged.
- The press-challenge (PoW/WASM) path is a browser userscript, not pure-math.

## License

Dual-track (full text in [`LICENSE`](LICENSE)):

| Asset | Scope | License |
|---|---|---|
| **Code** | `revers/` · `stample/*/px_cookie/` · `bundle/script/` · `node_bridge/` · `skill/*/scripts/` | **AGPL-3.0** — commercial/SaaS use must open-source back |
| **Docs** | `main/` · `bug_report/` · `research/` · all `README` / `SKILL.md` | **CC BY-NC-SA 4.0** — non-commercial + attribution + share-alike |

## Ethics & Disclaimer

Research / education / personal-audit only; all capture samples were collected via the researcher's own
accounts. **Must not** be used for unauthorized scraping, carding / coupon fraud, scalping, credential
stuffing, DoS, or anything violating a target's ToS or local law (US CFAA / EU GDPR / China CSL & PIPL, etc.).
The author releases this as an academic artifact and **assumes no liability** for any resulting account ban,
IP blocklisting, litigation, or loss; legal compliance is the user's responsibility. Redistributions must
keep the full disclaimer in [`LICENSE`](LICENSE). iFood / Grubhub / Total Wine are protocol-research objects
only — the project neither encourages nor instructs any malicious action against them.

**Responsible disclosure** — all findings come from protocol- and algorithm-layer reverse engineering: no
internal source, private APIs, or unauthorized access; no backend-vuln exploitation; no TLS/cert/signature
bypass; no theft of third-party keys or data. Conforms to reverse-engineering fair use and security-research
exceptions (e.g. US DMCA §1201(j)). Compliance contact: `warterbili` via GitHub Issues — the author reserves
the right to adjust disclosure scope within 90 days of a formal request.

## Citation

```bibtex
@misc{perimeter_v2_2026,
  author       = {warterbili},
  title        = {{PerimeterX (HUMAN Security) SDK Reverse Engineering}},
  year         = {2026}, version = {2.0},
  howpublished = {GitHub Repository},
  url          = {https://github.com/warterbili/PerimeterX_RE}
}
```

<div align="center"><sub>v2.0 · research artifact · <a href="#perimeterx--human-security--sdk-reverse-engineering">back to top</a></sub></div>
