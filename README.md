<div align="center">

```
██╗     ███████╗██████╗ ██╗    ██╗ █████╗ ████████╗███████╗██████╗ ██████╗ ██╗██╗     ██╗
██║     ██╔════╝██╔══██╗██║    ██║██╔══██╗╚══██╔══╝██╔════╝██╔══██╗██╔══██╗██║██║     ██║
██║     ███████╗██║  ██║██║ █╗ ██║███████║   ██║   █████╗  ██████╔╝██████╔╝██║██║     ██║
██║     ╚════██║██║  ██║██║███╗██║██╔══██║   ██║   ██╔══╝  ██╔══██╗██╔══██╗██║██║     ██║
███████╗███████║██████╔╝╚███╔███╔╝██║  ██║   ██║   ███████╗██║  ██║██████╔╝██║███████╗██║
╚══════╝╚══════╝╚═════╝  ╚══╝╚══╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚══════╝╚═╝
```

# PerimeterX (HUMAN Security) SDK · Complete Reverse Engineering · **v2.0**

### The Most Complete Public Reverse Engineering Study of PerimeterX

**Byte-exact SDK Internal Logic Dissection · Pure-algorithm Reconstruction of `_px3` / `_px2` · Zero-Browser Dependency · Dual-site 10/10 Production-Grade Verification**

**🇬🇧 English · 🇨🇳 [简体中文](README.zh.md)**

<br />

**Authors**: `warterbili`  ·  **Last Updated**: 2026-05-23  ·  **Status**: Actively Maintained  ·  **License**: Dual-track (AGPL-3.0 + CC BY-NC-SA 4.0)
<br />
**Last Verified Run**: 2026-05-21 (BR-residential proxy, HTTP 200 from production APIs)

<br />

[![Version](https://img.shields.io/badge/version-2.0-blue?style=for-the-badge)](#)
[![iFood](https://img.shields.io/badge/iFood-10%2F10%20✓-success?style=for-the-badge)](stample/ifood/)
[![Grubhub](https://img.shields.io/badge/Grubhub-10%2F10%20✓-success?style=for-the-badge)](stample/grub/)
[![Total Wine](https://img.shields.io/badge/Total%20Wine-10%2F10%20✓%20strict--tier-success?style=for-the-badge)](stample/totalwine/)
[![Bundle](https://img.shields.io/badge/iFood%20Bundle-10%2F10%20✓-success?style=for-the-badge)](bundle/)

![Algorithms](https://img.shields.io/badge/Pure--algo%20Primitives-9%20core-green?style=flat-square&logo=hackthebox)
![Bundle Primitives](https://img.shields.io/badge/Bundle--only-5%20primitives-darkgreen?style=flat-square)
![Docs](https://img.shields.io/badge/Technical%20Docs-20K%2B%20lines-orange?style=flat-square&logo=readthedocs)
![Methodology](https://img.shields.io/badge/Methodology-10%20ch%20%2F%203389%20lines-blue?style=flat-square)
![Gotchas](https://img.shields.io/badge/Production%20Gotchas-68-red?style=flat-square&logo=bugatti)
![Fine Gotchas](https://img.shields.io/badge/Fine--grained-19%20gotchas-red?style=flat-square)
![Mouse Tracks](https://img.shields.io/badge/Real%20Mouse%20Tracks-50-purple?style=flat-square)
![Samples](https://img.shields.io/badge/Capture%20Batches-6%C3%972%20sites-yellow?style=flat-square)
![Bundle Doc](https://img.shields.io/badge/Bundle%20Main%20Doc-4996%20lines-magenta?style=flat-square)
![Userscript](https://img.shields.io/badge/Userscript-2131%20lines-lightgrey?style=flat-square)
![AI Skill](https://img.shields.io/badge/AI%20Skill-9%20playbooks%20%2B%2014%20CLI-brightgreen?style=flat-square&logo=anthropic)
![Last Run](https://img.shields.io/badge/last%20verified%20run-2026--05--21-brightgreen?style=flat-square&logo=githubactions&logoColor=white)
![Longitudinal](https://img.shields.io/badge/Longitudinal-3%20years-blueviolet?style=flat-square)

</div>

<table align="center">
<tr>
<td align="center" width="110"><h2>9</h2><sub><b>Core Algos</b><br/>(shared)</sub></td>
<td align="center" width="110"><h2>+5</h2><sub><b>Bundle-only</b><br/>Primitives</sub></td>
<td align="center" width="110"><h2>10/10</h2><sub><b>iFood ✓</b></sub></td>
<td align="center" width="110"><h2>10/10</h2><sub><b>Grubhub ✓</b></sub></td>
<td align="center" width="110"><h2>10/10</h2><sub><b>Total Wine ✓</b><br/>(strict-tier)</sub></td>
<td align="center" width="110"><h2>10/10</h2><sub><b>Bundle ✓</b></sub></td>
<td align="center" width="110"><h2>500ms</h2><sub><b>End-to-end</b></sub></td>
</tr>
<tr>
<td align="center"><h2>68</h2><sub><b>Production<br/>Gotchas</b> (≥1h debug each)</sub></td>
<td align="center"><h2>20K+</h2><sub><b>Doc Lines</b></sub></td>
<td align="center"><h2>14</h2><sub><b>CLI Tools</b></sub></td>
<td align="center"><h2>9</h2><sub><b>AI Playbooks</b></sub></td>
<td align="center"><h2>4</h2><sub><b>AI Intent<br/>Manifests</b></sub></td>
<td align="center"><h2>3 yrs</h2><sub><b>Longitudinal<br/>SDK Drift</b></sub></td>
</tr>
</table>

```console
╭──────────────────────────────────────────────────────────────╮
│ $ node stample/ifood/px_cookie/ifood_px3.js                  │
│                                                              │
│   ✅ _px3=eyJ1IjoiYWJj...     ttl=330                        │
│   ✅ uuid: c83577f0-5420-11f1-...                            │
│   ✅ ev1=14 fields  ·  ev2=204 fields  ·  smoke_test=21/21   │
│   ⚡ 500 ms  end-to-end                                      │
│                                                              │
│ $ node stample/ifood/px_cookie/business_api_demo.js          │
│                                                              │
│   ✅ HTTP 200   /v1/merchant-info/graphql                    │
│      { name: "Sorveteria Coelhinho", userRating: 5, ... }    │
│      proxy = BR-residential  ·  last run = 2026-05-21        │
╰──────────────────────────────────────────────────────────────╯
```

```
                  ┌──────────────────────────────────────┐
                  │  ⚡ PX Anti-bot Handshake · 500 ms     │
                  └──────────────────┬───────────────────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            ▼                        ▼                        ▼
   ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
   │ Layer 1 Pure-algo│     │ Layer 2 Plan B  │     │ Layer 3 Bundle  │
   │   99% traffic    │     │  Env-patching   │     │ 1% risk-trigger │
   │    ~500 ms       │     │    ~2-3 s       │     │   ~10-15 s      │
   └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
            └────────────────────────┼────────────────────────┘
                                     ▼
                          ┌────────────────────┐
                          │   _px3 / _px2      │
                          │  ⇒ Business API ✓  │
                          └────────────────────┘
```

<div align="center">

### [Quick Start](#9-reproduction--quick-start) · [Live Validation](stample/live_validation/) · [Plan B](node_bridge/) · [Methodology](main/EN/methodology/) · [Gotchas](bug_report/) · [Bundle](bundle/) · [AI Skill](skill/AI_re/) · [Cite](#17-citation)

</div>

---

## Table of Contents

<table>
<tr>
<td>

**Part I — Foundations**
- [Abstract](#abstract)
- [1. Introduction](#1-introduction)
- [2. Threat Model](#2-threat-model)
- [3. PerimeterX SDK Architecture](#3-perimeterx-sdk-architecture)
- [4. Methodology](#4-methodology)

**Part II — Implementation**
- [5. Implementation Deep-dive](#5-implementation-deep-dive)
- [6. Evaluation](#6-evaluation)
- [7. Empirical Findings](#7-empirical-findings-gotcha-record)

**Part III — Repository**
- [8. Project Structure](#8-project-structure)
- [9. Reproduction · Quick Start](#9-reproduction--quick-start)
- [10. Tooling](#10-tooling)

</td>
<td>

**Part IV — AI & Usage**
- [11. AI Skill Integration](#11-ai-skill-integration)
- [12. By Role · Reading Guide](#12-by-role--reading-guide)

**Part V — Discussion**
- [13. Maintenance Cost & Limitations](#13-maintenance-cost--limitations)
- [14. Related Work](#14-related-work)
- [15. Bilingual Status & Roadmap](#15-bilingual-status--roadmap)

**Part VI — Meta**
- [16. License, Ethics & Responsible Disclosure](#16-license-ethics--responsible-disclosure)
- [17. Citation](#17-citation)
- [18. Acknowledgments](#18-acknowledgments)

</td>
</tr>
</table>

| # | Chapter | Summary |
|---|---|---|
| [1](#1-introduction) | **Introduction** | Background · Motivation · Three contributions · Repository overview |
| [2](#2-threat-model) | **Threat Model** | Defender capabilities · Attacker goals · Assumptions & boundaries |
| [3](#3-perimeterx-sdk-architecture) | **PerimeterX SDK Architecture** | Dual-path overview · Collector vs Bundle · Field taxonomy · 9+5 algorithms |
| [4](#4-methodology) | **Methodology** | 7-stage reverse workflow · Time budget · Cross-platform porting · SDK upgrade triage |
| [5](#5-implementation-deep-dive) | **Implementation Deep-dive** | 9 algorithm internals · Dual-site generators · Full Bundle chain · Plan B Bridge |
| [6](#6-evaluation) | **Evaluation** | Protocol-level 10/10 · End-to-end business API · Cross-vendor comparison |
| [7](#7-empirical-findings-gotcha-record) | **Empirical Findings** | Top 5 critical pitfalls · 68-entry classification · 19 fine-grained gotchas · Longitudinal drift |
| [8](#8-project-structure) | **Project Structure** | Complete directory tree (with module purpose / line counts / links) |
| [9](#9-reproduction--quick-start) | **Reproduction · Quick Start** | 5-min walkthrough · Business API · Bundle userscript |
| [10](#10-tooling) | **Tooling** | 14-tool CLI reference |
| [11](#11-ai-skill-integration) | **AI Skill Integration** | ⭐ **CDP + AI_re dual-skill loop · AI end-to-end 0→1 autonomous reversing** |
| [12](#12-by-role--reading-guide) | **By Role · Reading Guide** | Entry points for 11 reader profiles |
| [13](#13-maintenance-cost--limitations) | **Maintenance Cost & Limitations** | Upgrade cadence · Limitations · Future work |
| [14](#14-related-work) | **Related Work** | Public PX research · Cross-vendor |
| [15](#15-bilingual-status--roadmap) | **Bilingual Status & Roadmap** | Chinese-English coverage matrix |
| [16](#16-license-ethics--responsible-disclosure) | **License, Ethics & Disclosure** | Research ethics · Responsible disclosure |
| [17](#17-citation) | **Citation** | BibTeX |
| [18](#18-acknowledgments) | **Acknowledgments** | Credits · Project evolution |

---

## Abstract

This project presents a **complete reverse engineering study of the PerimeterX (HUMAN Security) anti-bot SDK**, covering the full stack from protocol-level bytes to internal SDK business logic. We make three primary contributions: (i) **pure-algorithm reconstructions of 9 core cryptographic primitives**, including the multi-step payload encryption chain, HMAC-MD5-derived PC, Unicode Tag Char SID steganography, dynamic Anti-tamper key injection, and others; (ii) **two end-to-end cookie generators** — iFood `_px3` and Grubhub `_px2`, both achieving **10/10 protocol-level AND end-to-end business API verification under production conditions**; (iii) **the first complete open-source solution to the Bundle press-challenge path**, with synchronous WASM proof-of-work, Bézier mouse trajectory synthesis, Myanmar-script DOM steganography, and 4-group error-stack alignment, totaling 2,131 lines of production-grade userscript. Empirical findings include **68 production-verified failure modes**, a longitudinal study covering 3 major SDK iterations across 2024–2026, and a comparative analysis against DataDome, Akamai, and Cloudflare. The project further provides a **three-layer fallback resilience architecture** (pure-algo → Plan B environment patching → Bundle press-challenge) and an **industry-first dual-skill loop enabling AI agents to perform end-to-end 0→1 autonomous reverse engineering of new sites** ([`skill/cdp/`](skill/cdp/) auto-drives real Chrome for sample capture, while [`skill/AI_re/`](skill/AI_re/) provides 9 playbooks + 5 references + 14 CLI tools + 4 intent manifests). Together these constitute the most complete public reference implementation of PerimeterX anti-bot research to date.

---

## 1. Introduction

### 1.1 Background — What is PerimeterX

**PerimeterX** (acquired by HUMAN Security in 2022 but still widely deployed under the PerimeterX brand) is a de-facto standard commercial anti-bot / anti-scraping product adopted by major sites including iFood, Grubhub, DoorDash, Zillow, Crunchyroll, and Major League Baseball. It injects an obfuscated JavaScript collector (`main.min.js`) into client pages, gathering 200+ device / behavioral / environment fingerprint dimensions, and issues `_px3` (v3) / `_px2` (v2) signed cookies through two parallel paths:

- **Silent Collector Path** — covers 99% of business traffic, runs as 2 background POST requests with no UI, completes in ~300 ms;
- **Press-challenge Bundle Path** — triggered when the risk score exceeds threshold, presents visible challenges (press, click, slide) plus browser-side WASM PoW and mouse trajectory collection, takes ~10–15 seconds.

PX's core obfuscation strategy is **byte-level rotation on a weekly-to-monthly cadence**: function names, line numbers, base64 dictionaries, and wire character sets all change — but **the underlying algorithms (HMAC-MD5 / UUID v1 / Anti-tamper / steganography) have not changed in 3 years**. This is precisely the foundation that allows this project to build a sustainable maintenance regime.

### 1.2 Motivation

Publicly available material on PerimeterX has long been **bimodally distributed**:

- **Too shallow**: 99% of blog posts and Stack Overflow answers stop at "just use puppeteer / undetected-chromedriver / selenium-stealth" — these approaches collapse against medium-strength PX risk control;
- **Too fragmented**: the few deep dives only cover **single bug fixes** or **isolated algorithm snippets**, lacking end-to-end reproducible implementations, cross-site comparisons, or systematic failure analysis.

The community is missing a **complete map** — full-stack coverage from bytes to algorithms to protocols to business APIs, deployable in production, teachable to others, and citable in academic work. This project exists to fill that gap.

### 1.3 Contributions

The core contributions of this work can be summarized as follows:

1. **Algorithm-level open release** — Pure-algorithm Node.js implementations of 9 PX core cryptographic primitives ([`revers/`](revers/)), each byte-exact-verified across capture batches;
2. **Site-level production implementations** — End-to-end generators for iFood `_px3` + Grubhub `_px2`, with 10/10 protocol-level pass rates + real HTTP 200 verification against production business APIs (2026-05-21, BR-residential proxy);
3. **Complete Bundle solution** — First fully open-source solution to the PX press-challenge (Captcha), with synchronous WASM PoW, Bézier mouse trajectories, Plane-14 Tag Char steganography, and Myanmar-script DOM encoding, 2,131 lines of production-grade userscript verified 10/10;
4. **Systematic failure mode catalog** — 68 production-environment debugging gotchas (each representing ≥1 hour of actual debug time), 19 fine-grained gotcha entries, covering collector / bundle / environment / SDK drift dimensions;
5. **AI Skill package** — Drop-in PX reverse-engineering skill for Claude Code / Cursor, containing 9 playbooks + 5 references + 14 CLI tools + 4 user-intent manifests, converting this project's methodology into AI-agent-callable capabilities.

### 1.4 What's in this Repository

| Dimension | Number |
|---|---|
| **Total files** | ~380 |
| **Total documentation lines** | 20,000+ (primarily Chinese, partial English bilingual) |
| **Core algorithm implementations** | 9 Node.js modules (`revers/`) |
| **Generators** | iFood + Grubhub, both 10/10 |
| **Bundle main document** | 4,996 lines |
| **Bundle production userscript** | 2,131 lines (10/10 verified) |
| **New methodology** | 10 chapters / 3,389 lines (incl. 14 tools / algorithm pseudocode / 10 pitfalls) |
| **Real capture batches** | iFood 6 batches + Grubhub 6 batches + Bundle 4 POSTs |
| **Real mouse tracks** | 50 (Bundle-specific) |
| **Total gotchas** | 68 (4 main files) + 19 fine-grained |
| **Research dossiers** | 6 English `research/` (threat model / longitudinal / cross-vendor / failure modes / field entropy / isolation) |
| **AI Skill assets** | 9 playbooks + 5 references + 14 CLI + 4 manifests |
| **Longitudinal coverage** | 3 years (2024–2026), spanning 3 major SDK iterations |

---

## 2. Threat Model

The full formal threat model is documented in [`research/03_threat_model/`](research/03_threat_model/). This section provides a self-contained summary.

### 2.1 Defender Capabilities

PerimeterX defenses can be decomposed into four layers:

| Layer | Capability | Project Coverage |
|---|---|---|
| **Network / Edge** | TLS fingerprint (JA3/JA4) · HTTP/2 frame sequence · IP blocklists · ASN tiering (residential vs datacenter) | [`bug_report/3_environment.md`](bug_report/3_environment_EN.md) |
| **Browser Fingerprint** | UA + Sec-CH-UA · Canvas / WebGL / AudioContext · Font list · Timezone consistency | [`main/EN/EV1_EV2_UNIFIED_REFERENCE.md`](main/EN/EV1_EV2_UNIFIED_REFERENCE.md) |
| **Behavioral** | Mouse trajectories · Keystroke timing · Scroll cadence · Touch pressure · Focus transition sequences | [`bundle/stample/mouse_tracks/`](bundle/stample/) — 50 real samples |
| **Cryptographic** | Dynamic Anti-tamper keys · Timestamp nonces · HMAC-MD5 signatures · Unicode steganography · WASM PoW | [`revers/`](revers/) — 9 algorithms |

### 2.2 Attacker Goals & Assumptions

The attacker (i.e., the reverser) modeled in this project:

- **Goal**: Stably obtain legitimate `_px3` / `_px2` cookies for automated access to business APIs (academic research, price monitoring, compliance automation, security auditing);
- **Capability**: Access to capture tools (Charles / Fiddler / CDP), residential proxy, test accounts at the target site, Node.js runtime;
- **Not assumed**: No internal PX source code access, no ability to breach PX's backend, no TLS bypass capability.

### 2.3 Out-of-scope

The following are **explicitly out of scope**: distributed crawler scheduling, proxy pool management, CAPTCHA OCR / third-party solving, UA pool spoofing, denial-of-service attacks against PX's backend. These belong to operational engineering domains orthogonal to protocol-level and algorithm-level reverse engineering research.

---

## 3. PerimeterX SDK Architecture

### 3.1 Dual-path Defense Overview

```
                      ┌──────────────────┐
                      │   main.min.js    │
                      │  (PX Collector)  │
                      └─────────┬────────┘
                                │
                     ┌──────────┴──────────┐
                     ▼                     ▼
        ┌──────────────────────┐  ┌──────────────────────┐
        │  Silent Collector    │  │  Press-challenge     │
        │  Path                │  │  Bundle Path         │
        │  ─────────────────   │  │  ──────────────────  │
        │  · 99% of traffic    │  │  · 1% risk-triggered │
        │  · 2 POST            │  │  · 4 POST            │
        │  · ~300 ms           │  │  · WASM + PoW + press│
        │  · No UI             │  │  · 10-15 seconds     │
        │  · 9 shared algos    │  │  · 9 shared + 5 own  │
        └──────────┬───────────┘  └──────────┬───────────┘
                   │                         │
                   └─────────────┬───────────┘
                                 ▼
                       ┌──────────────────┐
                       │  _px3 / _px2     │
                       │  Signed cookie   │
                       │  ⇒ Business API  │
                       └──────────────────┘
```

### 3.2 Collector Path (Silent)

The Collector path is PX's default silent path, covering 99% of business traffic:

1. **Page load** → `main.min.js` injection, initializes `_px3.appId / state / pxsid / pxhd`;
2. **Collects 200+ fields** → device fingerprint, browser environment, behavioral cadence, forming EV1 (base) / EV2 (extended);
3. **First POST `/api/v2/collector`** → carries `payload=<encrypted EV>` + `pc=<HMAC-MD5 signature>` + `sid=<steganography>`;
4. **Server responds with OB** → contains `state.no/qa/vid/pxsid/cts/appId/jf/...` encrypted fields;
5. **Second POST `/api/v2/collector`** → carries EV2 with server-issued state injected;
6. **Server issues `_px3` cookie** → TTL typically 330 s (iFood) / 500 s (Grubhub).

Full details in [`main/EN/PX_SDK_Reverse_Engineering.md`](main/EN/PX_SDK_Reverse_Engineering.md) §2-3 (and its EN twin).

### 3.3 Bundle Path (Press-challenge)

The Bundle path triggers when the risk score exceeds threshold:

1. **Trigger condition** → server returns `px-captcha` HTML or collector refuses to issue `_px3`;
2. **Loads `captcha.js`** → Bundle-specific SDK with different AppID (iFood = `PXd6f03jmq8h6c7382req0`), includes WASM module;
3. **6 events** → init / mouse_move / touch / pow_start / pow_done / press_complete;
4. **Synchronous WASM PoW** → SHA-256 brute-force, CPU work ~5-10 s (**must be synchronous SHA-256; async `crypto.subtle` times out at 600s+**, see gotcha #5);
5. **Bézier mouse trajectory** → synthesized from 50 real samples → POST to `/api/v1/collector`;
6. **Myanmar-script DOM steganography** → Plane-14 Tag Char + Myanmar characters injected into DOM, defeating Copy-as-cURL replay;
7. **Issues `_px3`** → with Bundle pass marker.

Full details in [`main/EN/PX_Bundle_Reverse_Methodology.md`](main/EN/PX_Bundle_Reverse_Methodology.md) + [`bundle/doc/Bundle_Complete_Technical_Doc.md`](bundle/doc/Bundle_Complete_Technical_Doc.md) (4,996 lines).

### 3.4 Field Taxonomy (EV1 / EV2 / State Three-class Classification)

PX has 200+ total fields. This project introduces a **three-class taxonomy** for the first time:

| Class | Proportion | Characteristics | Handling Strategy |
|---|---|---|---|
| **STATIC** | ~40% | Invariant across batches (e.g., `appId / TAG / FT / OS / screen resolution`) | Hard-coded template |
| **DYNAMIC** | ~50% | Recomputed every run (`uuid / timestamps / mouse_no / focus_no`) | Algorithmic generation |
| **CONDITIONAL** | ~10% | Depends on server-issued state (`state.no / qa / vid / pxsid`) | Filled in after OB decode |

Complete field table: [`main/EN/EV1_EV2_UNIFIED_REFERENCE.md`](main/EN/EV1_EV2_UNIFIED_REFERENCE.md) (204+ fields with three-class classification + cross-platform mapping).

### 3.5 9 Core Algorithms (Shared Between Both Paths)

| # | Algorithm | Input → Output | Implementation | Doc Section |
|---|---|---|---|---|
| 1 | **payload encryption chain** | EV JSON → `PX serialize` → `XOR(50)` → `Base64(UTF-8)` → `20-char interleave` → POST `payload=` | [`revers/payload.js`](revers/) | Tech doc §3.1 |
| 2 | **PC signature** | `HMAC-MD5(serialize(events), uuid:TAG:FT)` → 32 hex → digit retention + letter ASCII%10 → stride pick → 16 chars | [`revers/pc.js`](revers/) | Tech doc §3.2 |
| 3 | **OB decode** | Server response string → 27-handler dispatch → `state.*` fields | [`revers/ob.js`](revers/) | Tech doc §3.3 |
| 4 | **SID Unicode steganography** | `state.pxsid + hh(state.no)` → `hh()` encodes as `U+E0100+` Plane-14 invisible Tag Char | [`revers/sid.js`](revers/) | Tech doc §3.4 |
| 5 | **UUID v1** | PX-compatible clockseq (non-standard RFC 4122 behavior) | [`revers/uuid.js`](revers/) | Tech doc §3.5 |
| 6 | **Anti-tamper** | `key = te(state.to, parseInt(state.no)%10 + 2)` — **key name is dynamic** | [`revers/antitamper.js`](revers/) | Tech doc §3.6 |
| 7 | **Hash (djb2 variant)** | String → 32-bit hash → field fill | [`revers/hash.js`](revers/) | Tech doc §3.7 |
| 8 | **Memory** | `performance.memory` synthesis (heap triplet) | [`revers/memory.js`](revers/) | Tech doc §3.8 |
| 9 | **/ns probe** | `/ns` endpoint sync (DNS-like health check) | [`revers/ns.js`](revers/) | Tech doc §3.9 |

### 3.6 Bundle-only +5 Primitives

| # | Primitive | Purpose |
|---|---|---|
| B1 | **WASM PoW** | SHA-256 brute-force challenge, must be synchronous |
| B2 | **Bézier mouse trajectory** | Synthesized from 50 real samples, with catmull-rom interpolation |
| B3 | **Myanmar-script DOM encoding** | Myanmar characters + Unicode tag injected into DOM, defeats Copy-as-cURL |
| B4 | **4-group error-stack alignment** | Deliberately triggers 4 JS exception types; stack trace is a fingerprint |
| B5 | **Press duration / pressure curve** | Synthesis of touch event `force / radiusX / radiusY` |

Full details in [`bundle/doc/Bundle_Complete_Technical_Doc.md`](bundle/doc/Bundle_Complete_Technical_Doc.md) §6-12.

---

## 4. Methodology

Full methodology documentation: [`main/EN/methodology/`](main/EN/methodology/) (10 chapters / 3,389 lines, including 14 tools / algorithm pseudocode / 10 pitfall appendices).

### 4.1 7-Stage Reverse Workflow

| Stage | Goal | Time Budget | Doc |
|---|---|---|---|
| **Stage 1 · Capture** | Capture N batches (≥6), varying across accounts / time / IP | 30 min | [01_stage1_capture.md](main/EN/methodology/01_stage1_capture.md) |
| **Stage 2 · Decode** | Decode payload XOR/b64/interleave + decode OB response | 1 h | [02_stage2_decode.md](main/EN/methodology/02_stage2_decode.md) |
| **Stage 3 · Classify** | Field three-class classification (STATIC/DYNAMIC/CONDITIONAL) | 1 h | [03_stage3_classify.md](main/EN/methodology/03_stage3_classify.md) |
| **Stage 4 · Locate** | grep for algorithm locations in main.min.js (grep handbook) | 2 h | [04_stage4_locate.md](main/EN/methodology/04_stage4_locate.md) |
| **Stage 5 · Value Match** | `state.* → EV2 b64 key` cross-batch value matching | 1-2 h | [05_stage5_value_match.md](main/EN/methodology/05_stage5_value_match.md) |
| **Stage 6 · Implement** | Write generator + byte-exact diff | 4-8 h | [06_stage6_implement.md](main/EN/methodology/06_stage6_implement.md) |
| **Stage 7 · Validate** | Protocol-level 10/10 + end-to-end business API | 2 h | [07_stage7_validate.md](main/EN/methodology/07_stage7_validate.md) |

### 4.2 Cross-platform Porting

Budget for new-site integration: 8–12 h total, with **90% algorithm reuse**; only 5 site-specific constants need replacement (AppID / TAG / FT / endpoint / state→EV2 key mapping). Details in [08_cross_platform.md](main/EN/methodology/08_cross_platform.md) + [`main/EN/PX_Complete_SDK_Comparative_Methodology.md`](main/EN/PX_Complete_SDK_Comparative_Methodology.md) (1,441-line iFood-vs-Grubhub comparison).

### 4.3 SDK Upgrade Emergency Playbook

PX collector upgrades every 1-2 months; bundle every 2-3 weeks. This project provides a ~2-hour recovery playbook: [09_sdk_upgrade.md](main/EN/methodology/09_sdk_upgrade.md). A real upgrade-diff case study: [`bug_report/sdk_drift_cases/2026-05-19_ifood/`](bug_report/sdk_drift_cases/) (iFood mid-version 202→225 b64 dictionary + TAG/FT swap).

---

## 5. Implementation Deep-dive

### 5.1 Algorithm Layer — [`revers/`](revers/)

Pure-algorithm Node.js implementations of 9 core algorithms, with zero browser dependency. Each algorithm is byte-exact-verified across all capture batches (6 iFood + 6 Grubhub), with ~100% unit test coverage.

**Core algorithm samples (4 most pitfall-prone)**:

```js
// 1. payload encryption chain (revers/payload.js)
events → PX_serialize(events)              // ⚠️ ≠ JSON.stringify
       → XOR(_, 50)                         //    single-byte XOR
       → Base64(_, 'utf8')                  // ⚠️ must be UTF-8, never Latin-1
       → interleave(_, key_pos)              //    20-char interleave
                                            //    key_pos = f(uuid, state.no)

// 2. PC HMAC-MD5 (revers/pc.js)
const md5_hex = hmacMD5(
  PX_serialize(events),
  `${uuid}:${TAG}:${FT}`                    // note colon separators
);                                          // → 32 hex chars
const digits  = md5_hex.replace(/[a-f]/g, c => c.charCodeAt(0) % 10);
const pc16    = digits.split('').filter((_, i) => i % 2).join('');  // 16 chars

// 3. Anti-tamper dynamic key injection (revers/antitamper.js)
const idx = parseInt(state.no) % 10;        // ⚠️ must parseInt (gotcha #1)
const key = te(state.to, idx + 2);          // ⚠️ key NAME is dynamic
const val = te(state.to, idx + 1);
events.d[key] = val;                        // ⚠️ preserve original position (gotcha #17)

// 4. SID Unicode Tag Char steganography (revers/sid.js)
const sid = state.pxsid + hh(state.no);     // hh() encodes each digit as
                                            // U+E0100+ Plane-14 invisible Tag Char
                                            // defeats "Copy as cURL" replay
```

Complete algorithm analysis: [`main/EN/PX_SDK_Reverse_Engineering.md`](main/EN/PX_SDK_Reverse_Engineering.md) §3 (2,597 lines of full PX technical reference, EN twin available).

### 5.2 Site Generators — [`stample/`](stample/)

Triple-site mirrored structure (added totalwine 2026-05-25); each site directory contains `px_cookie/` (generator) + `source/` (SDK lock) + `sample/` (6 capture batches) + `script/` (8+ site-specific tools).

| Site | AppID | TAG | FT | Cookie | TTL | Tier | SDK Hash |
|---|---|---|---|---|---|---|---|
| **iFood** | `PXO1GDTa7Q` | `U0MmDhUmOnhXSw==` | `401` | `_px3` | 330 s | lenient | `b47a639c…` |
| **Grubhub** | `PXO97ybH4J` | `FmYgK1gdJEAP` | `359` | `_px2` | 500 s | lenient | `5e81bffc…` |
| **Total Wine** ⭐ | `PXFF0j69T5` | `CFQ7WU4xIS8MXA==` | `401` | `_px2` | 330 s | **strict** | `9335db02…` |

All constants are **extracted directly from real POST body captures** ([`stample/{ifood,grub,totalwine}/sample/`](stample/) — 6 auditable batches per site), not from documentation memory. Smoke tests pass at 21/21 (iFood) / 17/17 (Grubhub) / 22/22 (Total Wine — includes 6 strict-tier-only checks).

**Strict-tier vs lenient-tier** (new 2026-05-25): Total Wine demonstrates that the same PX SDK has different server-side enforcement at different customers. Strict tier adds: 3-POST chain (seq=2 cookie-confirmation beacon), server-side HMAC verification, counter sub-field synchronization, and `state.hid` extraction. See [`skill/AI_re/references/deployment-tiers.md`](skill/AI_re/references/deployment-tiers.md) for the full comparison and [`skill/AI_re/references/gotchas.md`](skill/AI_re/references/gotchas.md) Bug #15-#18 for the 4 strict-tier traps.

### 5.3 Bundle Path — [`bundle/`](bundle/)

Industry-first complete open-source solution to the PX press-challenge:

```
bundle/
├── README.md                          4-level depth learning path
├── doc/Bundle_完整技术文档.md          ⭐ 4,996 lines — Bundle full deconstruction
├── source/                            captcha.js + WASM + SDK_INFO
│   ├── WASM_ANALYSIS.md               WASM module reverse analysis
│   └── SDK_INFO.md                    Bundle SDK metadata
├── stample/                           4 raw POSTs + 50 mouse tracks + EV templates
│   └── mouse_tracks/                  50 real human mouse tracks (highest collection cost)
└── script/userscripts/
    └── px_bundle3_auto.user.js        ⭐ 2,131-line userscript (10/10 production-verified)
```

**Bundle exclusive technical highlights**:

- **Synchronous WASM PoW** — SHA-256 brute-force, CPU work 5–10 s (must be synchronous; async takes 600s+ and TIMEOUTs)
- **Bézier trajectory synthesis** — catmull-rom interpolation with statistical sampling from 50 real samples
- **Myanmar + Plane-14 Tag Char DOM steganography** — defeats Copy-as-cURL replay
- **4-group error-stack alignment** — deliberately triggers JS exceptions; stack traces are fingerprints

Details in [`main/EN/PX_Bundle_Reverse_Methodology.md`](main/EN/PX_Bundle_Reverse_Methodology.md) (973-line, 8-stage methodology).

### 5.4 Plan B — [`node_bridge/`](node_bridge/)

**The secondary path for pure-algo failure scenarios** — when PX deploys a new encryption layer (rare but has happened) that temporarily disables the pure-algo approach, the "environment patching + jsdom" approach activates:

```
node_bridge/
├── README.md                          ~400-line introduction + design philosophy
├── ifood/                             iFood Bridge implementation
├── grub/                              Grubhub Bridge implementation
└── skill/
    ├── SKILL.md                       AI Skill entry point (115 lines)
    ├── methodology.md                 Bridge methodology (520 lines)
    └── new_site_guide.md              New site onboarding guide (411 lines)
```

| Dimension | Layer 1 (Pure-algo) | Layer 2 (Plan B) |
|---|---|---|
| Browser dependency | 0 | 0 (jsdom only) |
| Startup overhead | ~50 ms | ~1-2 s (jsdom init) |
| Per-call speed | ~500 ms | ~2-3 s |
| New encryption layer response | Algorithm-side rewrite required | jsdom auto-evaluates, **no rewrite needed** |
| Maintenance cost | 1-2 small upgrades per month | Nearly zero (PX algorithm changes have no impact) |
| Use case | 99% default production | Emergency / long-tail sites / fast new-site onboarding |

Plan B is the project's **disaster-recovery insurance**, ensuring business continuity during major PX refactors.

---

## 6. Evaluation

### 6.1 Protocol-level Validation (2026-05-20)

| Site | Verification | Result |
|---|---|---|
| **ifood.com.br** | AppID `PXO1GDTa7Q` · TAG `U0MmDhUmOnhXSw==` · FT `401` · cookie `_px3` (ttl 330) · 2-POST chain · lenient tier | **10/10 pass** |
| **grubhub.com** | AppID `PXO97ybH4J` · TAG `FmYgK1gdJEAP` · FT `359` · cookie `_px2` (ttl 500) · 2-POST chain · lenient tier | **10/10 pass** |
| **totalwine.com** ⭐ | AppID `PXFF0j69T5` · TAG `CFQ7WU4xIS8MXA==` · FT `401` · cookie `_px2` (ttl 330) · **3-POST chain** · **strict tier** | **10/10 pass** (2026-05-25) |
| **iFood Bundle press** | Bundle AppID `PXd6f03jmq8h6c7382req0` · FT `388` · 6 events + WASM + PoW | **10/10 pass** |

All constants are **extracted directly from real POST body captures** ([`stample/{ifood,grub,totalwine}/sample/`](stample/) — 6 auditable batches per site), not relying on documentation memory.

### 6.2 End-to-end Business API (2026-05-21 / 2026-05-25 for totalwine)

Beyond byte correctness, this means **real proxy + real business API calls + real HTTP 200 responses**. Full journal: [`stample/live_validation/journal/2026-05-21.md`](stample/live_validation/journal/2026-05-21_EN.md)

| Site | Proxy | Business API | Real Response |
|---|---|---|---|
| **iFood** | BR residential (Bright Data) | `POST cw-marketplace.ifood.com.br/v1/merchant-info/graphql?lat&lng&channel=IFOOD` | ✅ HTTP 200 → `{ name: "Sorveteria Coelhinho - Shopping Vitória", userRating: 5, available: false }` |
| **Grubhub** | Local direct (US proxy optional) | `POST /auth (anonymous) + /auth/login (Bearer + real account)` | ✅ HTTP 200 anon_token + HTTP 463 verify_methods (business-layer OTP; desktop 5/5 same verdict) |
| **Total Wine** ⭐ | US residential (Bright Data) | `GET totalwine.com/search/all?text=wine` (PX-gated SRP HTML) | ✅ HTTP 200 → 1.3 MB real SRP HTML × 10/10 independent sessions on different exit IPs (strict-tier Layer 3.5 validation) |

**Additional finding**: iFood's server stack also runs **Akamai Bot Manager** (response `set-cookie: ak_bmsc=...`); legitimate PX cookie + BR IP simultaneously passes both Akamai and PX layers.

### 6.3 Cross-vendor Comparison

Full horizontal comparison: [`research/04_cross_vendor_comparison/`](research/04_cross_vendor_comparison/). Summary matrix:

| Dimension | PerimeterX | DataDome | Akamai BMP | Cloudflare |
|---|---|---|---|---|
| Client-side obfuscation strength | ★★★★☆ | ★★★★★ | ★★★☆☆ | ★★★☆☆ |
| WASM PoW | ✅ Bundle | ✅ | ❌ | ⚠️ optional |
| Behavioral analysis | ★★★★☆ | ★★★☆☆ | ★★★★☆ | ★★☆☆☆ |
| Public reverse material | **This project = most complete** | medium | low | high |

---

## 7. Empirical Findings (Gotcha Record)

**The project's most unique asset**. 68 production-environment-verified failure modes + 19 fine-grained gotcha entries, each representing actual debug time (at least 1 hour).

### 7.1 Top 5 Critical Pitfalls (Read Before You Code)

1. ⭐⭐⭐ **`state.no` must be `parseInt`** — string causes PC to pass but `_px3` not issued; ~90% of newcomers hit this ([gotcha #01](bug_report/gotchas/01_state_no_parseint.md))
2. ⭐⭐⭐ **Anti-tamper field position destruction** — `delete + add` moves the key to the end, changing iteration order → signature mismatch ([gotcha #06](bug_report/gotchas/06_ob_handler_by_name.md))
3. ⭐⭐⭐ **`state.* → EV2 b64 key` is completely different per site** — iFood vs Grubhub use different injection keys ([gotcha #11](bug_report/gotchas/11_state_to_ev2_key.md))
4. ⭐⭐⭐ **base64's `+` must NOT be replaced with space** — Python `urllib.parse.unquote_plus` will eat the `+` ([gotcha #02](bug_report/gotchas/02_utf8_latin1_xor.md))
5. ⭐⭐⭐ **WASM PoW must use synchronous SHA-256** — `crypto.subtle` async approach times out at 600s+ ([gotcha #16](bug_report/gotchas/16_pxuuid_wasm_init.md))

### 7.2 68 Documented Failure Modes (4 Major Categories)

| File | Path | Count | Representative Pitfalls |
|---|---|---|---|
| [`1_collector_path.md`](bug_report/1_collector_path_EN.md) | Silent Collector path | **33** | parseInt / anti-tamper / b64 / state mapping |
| [`2_bundle_path.md`](bug_report/2_bundle_path_EN.md) | Press-challenge Bundle path | **20** | WASM PoW / Myanmar script / error stack / mouse trajectory |
| [`3_environment.md`](bug_report/3_environment_EN.md) | Environment / infrastructure | **8** | IP / TLS / UA / Python sid encoding |
| [`4_sdk_drift.md`](bug_report/4_sdk_drift_EN.md) | SDK version drift | **7** | b64 dictionary / TAG/FT swap / function name change |

### 7.3 19 Fine-grained Gotchas — [`bug_report/gotchas/`](bug_report/gotchas/)

Each in its own file with complete fix code + unit tests:
state_no_parseint · utf8_latin1_xor · antitamper_position · pc_md5_slice · sid_stego_even_tag · ob_handler_by_name · uuid_v1_clock · hq_index_off_by_one · wire_chars_confusion · interleave_odd_length · state_to_ev2_key · cross_event_key_reuse · ip_rate_limit · cookie_ttl · jf_offset_minus_one · pxuuid_wasm_init · pointer_float_coords · press_duration_mismatch · myanmar_template_drift

### 7.4 SDK Drift Longitudinal Study — [`research/02_sdk_drift_longitudinal/`](research/02_sdk_drift_longitudinal/)

3-year longitudinal tracking across 2024–2026, plus a real iFood mid-version upgrade diff case study ([`sdk_drift_cases/2026-05-19_ifood/`](bug_report/sdk_drift_cases/)). Key findings:

- **Algorithm layer unchanged for 3 years** — standard MD5 / HMAC / UUID / SHA-256 etc.
- **Surface layer rotates every upgrade** — function names, line numbers, b64 key dictionary, wire character set
- **Average upgrade recovery time** — 1–3 hours (following the [09_sdk_upgrade.md](main/EN/methodology/09_sdk_upgrade.md) playbook)

### 7.5 Field Entropy Analysis — [`research/01_field_entropy/`](research/01_field_entropy/)

Entropy analysis of dynamism for 204+ EV1/EV2 fields, quantifying per-field stability across batches, providing data-driven support for the three-class field taxonomy.

---

## 8. Project Structure

```
perimeter/                              v2.0 · 2026-05-23
│
├── README.md / README.zh.md            ← This file (bilingual · paper-level overview; EN = root README, ZH companion in README.zh.md)
├── LICENSE                              ⭐ Dual-track License (AGPL-3.0 code + CC BY-NC-SA 4.0 docs)
│
├── main/                               ⭐ Core technical docs (bilingual track)
│   ├── ZH/                             Chinese (10,800+ lines)
│   │   ├── methodology/                ⭐ 10-chapter methodology (3,389 lines)
│   │   │   ├── README.md                Entry + learning paths (130 lines)
│   │   │   ├── 00_overview.md           7-stage map + time budget (210 lines)
│   │   │   ├── 01..09_stage*.md         9 detailed chapters
│   │   │   └── appendix/                14 tools / algorithm pseudocode / 10 pitfalls
│   │   ├── EV1_EV2_UNIFIED_REFERENCE   ⭐ 204+ fields + cross-platform mapping (227 lines)
│   │   ├── PX_SDK_逆向技术文档.md       2,597 lines — full PX technical reference
│   │   ├── PX_逆向方法论_通用版.md       1,233 lines — legacy single-file methodology
│   │   ├── PX_完整SDK对照逆向方法论     1,441 lines — iFood vs Grubhub comparison
│   │   └── PX_Bundle_逆向方法论.md       973 lines — Bundle 8-stage methodology
│   └── EN/                             English mirror — 4 core docs + full 10-chapter methodology + appendix
│
├── research/                           ⭐ 6 English research dossiers (academic skeleton)
│   ├── 01_field_entropy/                Field dynamism entropy analysis
│   ├── 02_sdk_drift_longitudinal/       3-year SDK upgrade timeline
│   ├── 03_threat_model/                 ⭐ Formal threat model
│   ├── 04_cross_vendor_comparison/      PX vs DataDome vs Akamai vs Cloudflare
│   ├── 05_field_isolation_experiments/  Field isolation experiments
│   └── 06_failure_modes/                Failure mode taxonomy
│
├── revers/                             ⭐ 9 pure-algorithm Node.js implementations
│   ├── payload.js                       EV → POST `payload=` (XOR+b64+interleave)
│   ├── pc.js                            HMAC-MD5 + digit extraction → 16-char PC
│   ├── ob.js                            OB decode + handler dispatch (27 handlers)
│   ├── sid.js                           SID + Unicode Tag Char steganography
│   ├── uuid.js                          UUID v1 (PX-compatible clockseq)
│   ├── hash.js                          djb2 variant
│   ├── memory.js                        performance.memory synthesis
│   ├── antitamper.js                    Dynamic XOR key/value injection
│   └── ns.js                            /ns endpoint sync
│
├── node_bridge/                        ⭐ Plan B — fallback for pure-algo failure (jsdom env)
│   ├── README.md                        ~400 lines intro + design philosophy
│   ├── ifood/  grub/                    Dual-site bridge implementations
│   └── skill/                           AI Skill package
│       ├── SKILL.md                     115 lines — AI entry
│       ├── methodology.md               520 lines — Bridge methodology
│       └── new_site_guide.md            411 lines — new-site onboarding guide
│
├── skill/                              ⭐ AI agent skill packages (let AI reverse for you)
│   ├── AI_re/                           PX reverse-engineering skill
│   │   ├── README.md                     Entry
│   │   ├── SKILL.md                      ⭐ AI invocation entry (feed Claude / Cursor this)
│   │   ├── skills/                       ⭐ 4 user-intent manifests
│   │   │   ├── px_capture/                Capture N new sample batches
│   │   │   ├── px_decode/                 Decode a batch
│   │   │   ├── px_port_to_new_platform/   Cross-site generator porting
│   │   │   └── px_sdk_drift_audit/        SDK upgrade response
│   │   ├── playbooks/                    ⭐ 9 operation playbooks ("how to do")
│   │   ├── references/                   ⭐ 5 knowledge layer references ("what is")
│   │   └── scripts/                      ⭐ 14 CLI tools
│   └── cdp/                             Real Chrome CDP capture skill (no webdriver signatures)
│
├── stample/                            ⭐ Site implementation layer (triple-site mirror)
│   ├── ifood/
│   │   ├── px_cookie/                    ifood_px3.js + templates + smoke_test 21/21 ✓
│   │   ├── source/                       main.min.js (locked at SHA b47a639c…)
│   │   ├── sample/                       6 real capture batches × 11 files
│   │   ├── px_cookie/business_api_demo.js  End-to-end business API demo
│   │   ├── script/                       8 iFood-specific scripts
│   │   └── RESEARCH_PURPOSE.md           Research purpose statement
│   ├── grub/                            (Same structure as iFood)
│   ├── totalwine/                       ⭐ NEW 2026-05-25 (strict-tier deployment)
│   │   ├── px_cookie/                    totalwine_px2.js + EV1/EV2/EV3 templates + smoke 22/22 ✓
│   │   ├── source/                       main.min.js (locked at SHA 9335db02…)
│   │   ├── sample/                       6 real capture batches × 13 files (含 EV3 解码)
│   │   ├── script/                       8 scripts (3 are strict-tier-only: diff_ev2, find_hmac, smoke_10x_e2e)
│   │   └── RESEARCH_PURPOSE.md           Strict vs lenient tier — 5 root causes documented
│   └── live_validation/                ⭐ End-to-end business API validation journal
│       └── journal/2026-05-21.md         BR residential proxy + dual-site HTTP 200
│
├── bundle/                             ⭐ Complete Bundle press-challenge solution
│   ├── README.md                        4-level depth learning path
│   ├── doc/Bundle_完整技术文档.md        ⭐ 4,996 lines — Bundle full deconstruction
│   ├── source/                          captcha.js + WASM + SDK_INFO
│   ├── stample/                         Samples (4 raw POSTs + 50 mouse tracks)
│   │   ├── mouse_tracks/                ⭐ 50 real human mouse tracks (highest collection cost)
│   │   └── README.md
│   └── script/userscripts/
│       └── px_bundle3_auto.user.js      ⭐ 2,131-line userscript (10/10)
│
└── bug_report/                         ⭐ 68 production gotchas (most unique asset)
    ├── README.md                        4-file classification entry
    ├── 1_collector_path.md              Collector path 33 entries
    ├── 2_bundle_path.md                 Bundle path 20 entries
    ├── 3_environment.md                 Environment / infrastructure 8 entries
    ├── 4_sdk_drift.md                   SDK version drift 7 entries
    ├── gotchas/                         ⭐ 19 fine-grained entries (each: file + fix + test)
    └── sdk_drift_cases/                 ⭐ Real upgrade-diff case studies
        └── 2026-05-19_ifood/             iFood mid-version (202→225 b64 dict + TAG/FT swap)
```

---

## 9. Reproduction · Quick Start

### 9.1 5-minute Quick Start

```bash
# 1. clone + install
git clone <repo-url> perimeter
cd perimeter && npm install

# 2. iFood — generate _px3
cd stample/ifood/px_cookie
node smoke_test.js          # self-test 21/21 ✓
node ifood_px3.js           # real _px3
# Expected output:
# ✅ _px3=eyJ1IjoiYWJj...  ttl=330
# uuid: c83577f0-5420-11f1-...
# ev1_fields: 14, ev2_fields: 204

# 3. Grubhub — generate _px2
cd ../../../stample/grub/px_cookie
node smoke_test.js          # self-test 17/17 ✓
node grubhub_px2.js

# 4. Total Wine — generate _px2 (strict-tier, 3-POST chain)
cd ../../../stample/totalwine/px_cookie
node smoke_test.js          # self-test 22/22 ✓ (includes 6 strict-tier-only checks)
# Generator requires US residential proxy:
$env:HTTPS_PROXY = 'http://<user>-session-<id>:<pwd>@<host>:<port>'
node totalwine_px2.js
# Expected: _px2=… ttl=330, ev1=13, ev2=199, ev3=11, seq2_status=200

# 5. Bundle path (press-challenge) — install userscript
# Install Tampermonkey in browser → load bundle/script/userscripts/px_bundle3_auto.user.js
# Visit https://www.ifood.com.br/ → trigger challenge → automatic _px3
```

500 ms to complete the full PX handshake (lenient-tier, 2 POSTs); ~6 s for strict-tier 3-POST chain. 10 cryptographic algorithms shared across all 3 sites — only protocol assembly differs.

### 9.2 End-to-end Business API (Proxy Required)

```bash
# iFood (requires BR residential proxy)
export HTTPS_PROXY='http://<user>:<pwd>@<host>:<port>'
node stample/ifood/px_cookie/business_api_demo.js
# → HTTP 200 { name: "Sorveteria Coelhinho", userRating: 5, ... }

# Grubhub (proxy optional; for full chain add credentials via env vars)
export GRUBHUB_EMAIL='your@email.com'
export GRUBHUB_PASSWORD='yourpassword'
node stample/grub/px_cookie/business_api_demo.js
# → HTTP 200 anon_token + HTTP 463 verify_methods

# Total Wine ⭐ (strict-tier — REQUIRES US residential proxy)
export HTTPS_PROXY='http://<user>-session-<id>:<pwd>@<host>:<port>'
node stample/totalwine/px_cookie/business_api_demo.js
# → HTTP 200 + ~1.3 MB real SRP HTML
# For 10/10 stability test (different exit IP each iteration):
python stample/totalwine/script/smoke_10x_e2e.py
```

### 9.3 Bundle Userscript (Press-challenge Automation)

```
1. Install Tampermonkey extension
2. Load bundle/script/userscripts/px_bundle3_auto.user.js (2,131 lines)
3. Visit https://www.ifood.com.br/ or https://www.grubhub.com/
4. Trigger risk challenge → script auto-solves WASM PoW + synthesizes Bézier trajectory + submits press
5. Server issues _px3 → business API accessible
```

---

## 10. Tooling

14 CLI tools ([`skill/AI_re/scripts/`](skill/AI_re/scripts/)) + site-specific scripts:

```bash
# 1. Decode a single capture payload
node skill/AI_re/scripts/decode_payload.js stample/ifood/sample/1/request_1.txt
# → EV1/EV2 JSON output

# 2. Decode OB response (27-handler dispatch)
node skill/AI_re/scripts/decode_response.js \
     stample/ifood/sample/1/response_1.json \
     U0MmDhUmOnhXSw==
# → state.no/qa/vid/pxsid/cts/appId/jf/...

# 3. Cross-batch field three-class classification (STATIC/DYNAMIC/CONDITIONAL)
node skill/AI_re/scripts/diff_samples.js \
     stample/ifood/sample/{1..6}/decoded_payload_2.json
# → field stability matrix

# 4. state.* → EV2 b64 key cross-batch value matching (⭐ key script)
python skill/AI_re/scripts/find_state_keys_in_ev2.py
# → cross-platform mapping table

# 5. My generated vs real captured — field-level diff
python stample/ifood/script/compare_my_ev2.py /tmp/my_ev2.json

# 6. HTTP request byte-level diff
python stample/ifood/script/diff_http.py /tmp/my_post.txt

# 7. Verify decode-loop closure across all batches
./stample/ifood/script/verify_all.sh
# → Expected: 6/6 pass — decoder works against current SDK
```

Full 14-tool listing: [`skill/AI_re/scripts/README.md`](skill/AI_re/scripts/) and [`main/EN/methodology/appendix/A_tools.md`](main/EN/methodology/appendix/A_tools.md).

---

## 11. AI Skill Integration

> **⭐ Industry-first dual-skill loop enabling AI agents to perform end-to-end 0→1 autonomous reverse engineering of PerimeterX sites.**

This project encapsulates the complete methodology into **two complementary AI Skills**. Used together, they enable Claude Code / Cursor to **independently complete all 8 stages of new-site onboarding** — no manual capture, no manual decoding, no manual generator writing required.

### 11.1 Dual-Skill Cooperative Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                    AI End-to-end 0→1 Loop                          │
└────────────────────────────────────────────────────────────────────┘

   Stage 0-3  [10 min]                  Stage 4-8  [4-8 hours]
   ┌──────────────────┐                 ┌──────────────────────┐
   │   skill/cdp/     │   ───────→      │   skill/AI_re/       │
   │  ──────────────  │                 │  ──────────────────  │
   │  Launch Chrome   │                 │  Decode payload + OB │
   │  Capture 6+ batch│                 │  Field 3-class       │
   │  Download SDK    │                 │  state.* value match │
   │  Pin SDK version │                 │  Write generator     │
   │  No webdriver    │                 │  10/10 validation    │
   │  No bot trigger  │                 │  E2E business API    │
   └──────────────────┘                 └──────────────────────┘
            ↑                                      ↓
            └─────────  shared stample/<site>/  ───┘
```

**The cooperative relationship is explicitly documented in [`skill/AI_re/SKILL.md`](skill/AI_re/SKILL.md) lines 77-85**:

```
skill/cdp/    ← Stage 0-3: Launch Chrome + capture + download SDK + pin version + 6 batches
skill/AI_re/  ← Stage 4-8: Locate constants/functions + decode + field analysis + generator + 10/10
```

Complete 8-stage end-to-end workflow: [`skill/AI_re/playbooks/master-workflow.md`](skill/AI_re/playbooks/master-workflow.md).

### 11.2 [`skill/cdp/`](skill/cdp/) — Real Chrome CDP Capture Skill

Controls real Chrome via Chrome DevTools Protocol; **no webdriver signatures, does not trigger anti-bot**. The AI uses this to autonomously:

- **Capture 6+ batches of PX collector POST samples** (Stage 0-3 fully automated)
- **Download and pin SDK version** (automatic sha256 verification ensures all 6 batches share the same SDK)
- Analyze XHR / Fetch / WebSocket traffic, inject JS, screenshot, manipulate DOM
- Alternative native mode (`agent-browser --native`, pure-Rust, faster startup)

**Key scripts**: [`skill/cdp/scripts/capture_via_cdp_ifood.py`](skill/cdp/scripts/) + `capture_via_cdp_grubhub.py` — dual-site dedicated capturers, already wired into the `skill/AI_re/skills/px_capture/` entry.

### 11.3 [`skill/AI_re/`](skill/AI_re/) — PX Reverse Core Skill

End-to-end skill that completely reconstructs the PX SDK collector POST chain (silent mode) using pure algorithms. Asset inventory:

| Category | Count | Contents |
|---|---|---|
| **User intent manifests** ([`skills/`](skill/AI_re/skills/)) | **4** | `px_capture` (invokes cdp) · `px_decode` · `px_port_to_new_platform` · `px_sdk_drift_audit` |
| **Playbook operation manuals** ([`playbooks/`](skill/AI_re/playbooks/)) | **9** | master-workflow ⭐⭐⭐ / identify-sdk-version / extract-constants / locate-all-constants / locate-functions / locate-field-sources / reverse-algorithms / build-generator / validate-generator |
| **Reference knowledge layer** ([`references/`](skill/AI_re/references/)) | **5** | algorithm-chain (5 major algorithm formulas) / locate-by-pattern ⭐ (cross-version grep handbook) / handler-table (27 OB handlers) / field-categories (STATIC/DYNAMIC/CONDITIONAL) / gotchas ⭐ (19 entries) |
| **Algorithm modules** (`reverse/`) | **9** | payload / pc / ob / sid / uuid / hash / memory / antitamper / ns — directly `require()`-able |
| **CLI tools** (`scripts/`) | **14** | Decode (3) · Cross-batch analysis (4) · state value match (1) · Field location (2) · Byte-level diff (2) · Version migration (1) · End-to-end validation (1) |

### 11.4 AI End-to-end 0→1 Full Workflow

A single command invokes the AI to autonomously run all 8 stages:

```
@skill/AI_re/SKILL.md
Please port doordash.com — mirror the grubhub/ structure
```

The AI will then automatically execute:

| Stage | AI Action | Invokes |
|---|---|---|
| **Stage 0** | Identify SDK URL + AppID | `skill/cdp/` network sniffing |
| **Stage 1** | Launch real Chrome + capture 6+ batches | `cdp/scripts/capture_via_cdp_*.py` |
| **Stage 2** | Decode 6 batches of payload + OB | `decode_payload.js` + `decode_response.js` |
| **Stage 3** | Field three-class classification | `diff_samples.js` |
| **Stage 4** | state.* → EV2 b64 key value matching | `find_state_keys_in_ev2.py` ⭐⭐⭐ |
| **Stage 5** | Locate 5 site constants from SDK source | `playbooks/locate-all-constants.md` |
| **Stage 6** | Build STATIC templates + write generator | `build_templates.js` + `playbooks/build-generator.md` |
| **Stage 7** | Byte-level diff validation | `diff_http_request.py` + `compare_ev2_field_by_field.py` |
| **Stage 8** | 10/10 stability test + end-to-end business API | `verify_batch.js` |

**Estimated total time**: 8–12 hours fully autonomous for a new site (including 10 min capture + AI inference + diff iteration). **90% algorithm reuse from existing sites; 5 site-specific constants auto-located in SDK by AI**.

### 11.5 Four Pre-built AI Intent Entries

Each intent entry is an independent SKILL manifest, with complete procedure + quality gates + output spec:

```bash
# Capture 6+ new batches (with SDK hash consistency check)
@skill/AI_re/skills/px_capture
Please capture 6 batches of ifood.com.br, save to stample/ifood/sample/

# Decode a batch (decode payload + OB, output decoded_*.json)
@skill/AI_re/skills/px_decode
Please decode stample/grub/sample/3/

# Cross-site generator port (90% algorithm reuse, 5 constants auto-located)
@skill/AI_re/skills/px_port_to_new_platform
Please port doordash.com, mirror grubhub/ structure

# SDK upgrade response (auto-diff old SDK + propose migration path)
@skill/AI_re/skills/px_sdk_drift_audit
iFood upgraded again, please run sdk_drift_audit
```

### 11.6 Limitations (Fair Disclosure)

While the AI can autonomously run the Collector path 0→1, the **Bundle path** still requires two pre-stocked assets:

| Item | Limitation | Pre-stocked Material |
|---|---|---|
| WASM module static analysis | Binary disassembly remains manual | [`bundle/source/WASM_ANALYSIS.md`](bundle/source/WASM_ANALYSIS_EN.md) already dissected |
| Mouse trajectory generation | Requires sampling from real samples | [`bundle/stample/mouse_tracks/`](bundle/stample/) — 50 real human tracks |

That is, **the AI does not need to do these from scratch** — it can directly reuse project assets to complete the Bundle path.

---

## 12. By Role · Reading Guide

| If you are… | Recommended entry |
|---|---|
| **First-time visitor** | This README + [`main/EN/PX_SDK_Reverse_Engineering.md`](main/EN/PX_SDK_Reverse_Engineering.md) §1-2 (60-second architecture overview) |
| **Engineer** (need `_px3`) | Just run [`stample/ifood/px_cookie/ifood_px3.js`](stample/ifood/px_cookie/) → 5 minutes |
| **Learner** (teach me anti-bot reverse) | ⭐ [`main/EN/methodology/`](main/EN/methodology/) 10-chapter (14 tools + algorithm pseudocode + 10 pitfalls) |
| **Reverse engineer** (new site) | ⭐ [`methodology/04_stage4_locate.md`](main/EN/methodology/04_stage4_locate.md) (grep handbook) + [`05_stage5_value_match.md`](main/EN/methodology/05_stage5_value_match.md) + [`skill/AI_re/playbooks/master-workflow.md`](skill/AI_re/playbooks/master-workflow.md) |
| **Want to do Bundle** (press-challenge) | [`bundle/README.md`](bundle/README_EN.md) → [`main/EN/PX_Bundle_Reverse_Methodology.md`](main/EN/PX_Bundle_Reverse_Methodology.md) |
| **Can't get _px3, debugging** | [`bug_report/README.md`](bug_report/README_EN.md) → match against 4 categories → [`gotchas/`](bug_report/gotchas/) 19 entries |
| **SDK upgraded, emergency** | ⭐ [`methodology/09_sdk_upgrade.md`](main/EN/methodology/09_sdk_upgrade.md) (~2h recovery playbook) |
| **Cross-platform porting** | [`main/EN/PX_Complete_SDK_Comparative_Methodology.md`](main/EN/PX_Complete_SDK_Comparative_Methodology.md) + [`methodology/08_cross_platform.md`](main/EN/methodology/08_cross_platform.md) |
| **Pure-algo failed, need fallback** | ⭐ [`node_bridge/README.md`](node_bridge/README_EN.md) → env patching + jsdom secondary path |
| **AI-driven reversing** | [`skill/AI_re/SKILL.md`](skill/AI_re/SKILL.md) (feed to Claude Code / Cursor) |
| **Academic research / teaching** | [`main/EN/`](main/EN/) 4 core docs + [`research/`](research/) 6 English research dossiers |
| **Contributor** (add new site) | Mirror the [`stample/grub/`](stample/grub/) structure, walk through 7-stage methodology |

---

## 13. Maintenance Cost & Limitations

### 13.1 Maintenance Cost

| Item | Cadence | Effort |
|---|---|---|
| Collector minor upgrade (function name / line number swap) | 1-2× / month | 30 min (following [09_sdk_upgrade.md](main/EN/methodology/09_sdk_upgrade.md) playbook) |
| Collector medium upgrade (b64 dict + TAG/FT swap) | Every 2-3 months | 1-2 h (see [2026-05-19 case](bug_report/sdk_drift_cases/2026-05-19_ifood/)) |
| Collector major upgrade (new encryption layer) | Rare, every 6-12 months | Plan B can mitigate immediately; pure-algo side requires 4-8 h rewrite |
| Bundle upgrade (WASM / challenge type change) | Every 2-3 weeks | 1-3 h |
| New site onboarding | — | 8-12 h (90% algorithm reuse) |

### 13.2 Limitations

- **This project covers only iFood + Grubhub**. Other PX sites (DoorDash / Zillow / Crunchyroll etc.) require onboarding via the methodology;
- **Bundle userscript depends on Tampermonkey + real browser** — non-pure-algo; the Bundle path cannot be fully headless (WASM modules require full V8 + DOM);
- **PX SDK major refactors are rare but happen**: Plan B node_bridge is the disaster-recovery insurance, but **each refactor still requires 4-8 h of pure-algo-side rewrite** to return to pure-algo performance tier.

### 13.3 Future Work

- Onboard more PX sites (DoorDash / Zillow in plan)
- Automate WebAssembly static analysis (currently manual)
- ML model for mouse trajectory synthesis (currently statistical sampling from 50 real samples)
- Complete Chinese → English bilingualization (top-level README + 4 gotcha files + Bundle + node_bridge + 10-chapter methodology + EV1/EV2 reference + full stample mirror landed; remaining long-form docs ongoing)

---

## 14. Related Work

### 14.1 Public PerimeterX Research

Public-domain in-depth analyses of PX are extremely scarce. This project's positioning:

| Source | Coverage | Limitations |
|---|---|---|
| Scattered blog posts (GitHub gists / Zhihu / Medium) | Single algorithm or single bug | Lacks end-to-end, methodology, longitudinal tracking |
| Akamai / DataDome / Cloudflare public research | Horizontal comparison | Doesn't dive into PX internals |
| **This project** | **9 algorithms + dual-site + Bundle + 68 gotchas + 3-year longitudinal + AI Skill + Plan B** | — |

### 14.2 Cross-vendor Comparison

Details in [`research/04_cross_vendor_comparison/`](research/04_cross_vendor_comparison/).

### 14.3 Adjacent Projects

- **undetected-chromedriver / playwright-stealth** — Browser-side anti-detection; orthogonal to this project's pure-algo reversing
- **curl_cffi / hrequests** — TLS fingerprint simulation; complementary to this project's protocol-layer work

---

## 15. Bilingual Status & Roadmap

| Resource | Chinese | English |
|---|---|---|
| Top-level README | ✅ ([README.zh.md](README.zh.md)) | ✅ (this file — repo root) |
| Core technical docs (4) | ✅ | ✅ [`main/EN/`](main/EN/) all 4 complete |
| ⭐ Methodology 10 chapters | ✅ 3,389 lines | ✅ [`main/EN/methodology/`](main/EN/methodology/) |
| ⭐ EV1_EV2_UNIFIED_REFERENCE | ✅ 227 lines | ✅ [`main/EN/EV1_EV2_UNIFIED_REFERENCE.md`](main/EN/EV1_EV2_UNIFIED_REFERENCE.md) |
| ⭐ research/ (6 dossiers) | — | ✅ English original |
| ⭐ AI Skill manifests (4) | — | ✅ English original |
| ⭐ Fine-grained gotchas (19) | — | ✅ English original |
| Plan B node_bridge/ | ✅ | ✅ [`node_bridge/README_EN.md`](node_bridge/README_EN.md) + skill |
| Bundle methodology | ✅ 973 lines | ✅ [`main/EN/PX_Bundle_Reverse_Methodology.md`](main/EN/PX_Bundle_Reverse_Methodology.md) |
| Bundle main doc | ✅ 4,996 lines | ✅ [`bundle/doc/Bundle_Complete_Technical_Doc.md`](bundle/doc/Bundle_Complete_Technical_Doc.md) |
| 4 main gotcha files | ✅ | ✅ [`bug_report/*_EN.md`](bug_report/) |
| stample/ dual-site mirror (README / SDK_INFO / px_cookie / script) | ✅ | ✅ Full EN mirror landed |

**Bilingual progress**: top-level README + core technical docs + 10-chapter methodology + Bundle + Plan B + gotchas + stample mirror are all in English; a few remaining long-form docs continue.

---

## 16. License, Ethics & Responsible Disclosure

### 16.1 License — Dual-track (Anti-abuse Hardened)

Full License text is in [`LICENSE`](LICENSE) at the repository root. This project uses a **dual-track License**, applying separate anti-abuse constraints to code and documentation:

| Asset Type | Scope | License | Key Constraint |
|---|---|---|---|
| **Code** | [`revers/`](revers/) · [`stample/*/px_cookie/`](stample/) · [`bundle/script/`](bundle/script/) · [`node_bridge/`](node_bridge/) · [`skill/*/scripts/`](skill/) | **AGPL-3.0** | Any commercial service / SaaS use must **fully open-source contribute back** |
| **Documentation** | [`main/`](main/) · [`bug_report/`](bug_report/) · [`research/`](research/) · all `README.md` / `SKILL.md` | **CC BY-NC-SA 4.0** | **NonCommercial** + Attribution + ShareAlike (derivatives equally open) |

**Why dual-track**: CC officially recommends against using CC for code; AGPL doesn't excel at protecting documentation. Combining them creates a two-layer anti-abuse shield — commercial companies can neither commercially use the docs nor closed-source-leverage the code. This is the standard practice in academic + security research circles (e.g., Trail of Bits / NCC Group / Project Zero companion projects).

### 16.2 Research Ethics

This project **strictly adheres to the following principles**:

- **Research / Education / Personal Security Audit purposes only** — algorithm analysis, protocol dissection, cross-platform comparison, teaching
- **Does not provide large-scale scraping operational tooling** — no proxy pools, schedulers, IP rotation, UA pools, CAPTCHA OCR, third-party solving integration
- **Does not target individual user privacy data** — all capture samples were legitimately collected through the researcher's own accounts
- **Compliance with target site ToS** — Each site's terms of service are judged and borne by the user, independent of the project author

### 16.3 ⚠️ Disclaimer (Important)

> Using this project signifies that you **fully understand and agree** to the following:

1. **User assumes all responsibility** — The project author (`warterbili`) releases this work strictly as academic research and educational content, and **assumes no responsibility for any direct or indirect damage** arising from use of this project, including but not limited to: account bans, IP blocklisting, legal litigation, compliance review, platform complaints, business loss, privacy incidents.
2. **Prohibited uses** — This project **must not** be used for:
   - Unauthorized data scraping / content harvesting
   - Credit card / coupon / gift card abuse (carding, coupon fraud)
   - Automated ordering / inventory hoarding / scalping
   - User credential theft / credential stuffing
   - Denial-of-service attacks (DoS / DDoS)
   - Malicious interference with target sites
   - Any conduct violating target site ToS or local law
3. **Legal compliance is the user's responsibility** — Different jurisdictions have different laws regarding reverse engineering, automated access, and data collection (e.g., US CFAA / EU GDPR / China's Cybersecurity Law / Data Security Law / Personal Information Protection Law). Users are **obligated to research and comply** with the laws of their jurisdiction.
4. **Author has no obligation to provide support** — This project is released free of charge as a research artifact; the author has **no obligation** to provide technical support, bug fixes, SDK upgrade responses, or legal counsel.
5. **Redistribution restrictions** — Redistributions must preserve this entire disclaimer text; modification or deletion is not permitted.
6. **Specific clarification: this project does not target specific merchants** — iFood / Grubhub serve solely as **technical objects of protocol-level reverse engineering research**; this project does not encourage, instruct, or condone any malicious action against these platforms.

### 16.4 Responsible Disclosure

All findings regarding PerimeterX / HUMAN Security were obtained through **protocol-layer and algorithm-layer reverse engineering**:

- **No reliance** on any internal source code, private APIs, or unauthorized access;
- **No exploitation** of backend vulnerabilities, SQL injection, SSRF, RCE, or other attack vectors;
- **No bypass** of any TLS, certificate, or signature mechanisms (protocol analysis is conducted strictly within legitimate TLS channels);
- **No theft** of any third-party keys, credentials, or personal data.

This project's release strictly conforms to **Reverse Engineering Fair Use** principles and multi-jurisdiction "security research exceptions" (e.g., US DMCA §1201(j) security testing exception).

### 16.5 Contact

For compliance inquiries from the PerimeterX / HUMAN Security team, or to initiate **coordinated disclosure**, please reach `warterbili` via GitHub Issues. **The author reserves the right to adjust the disclosure scope within 90 days of receiving a formal compliance request**.

**For reverse-engineering questions, security-testing collaboration, or new-platform research inquiries**: open a GitHub Issue, or reach the author directly via the email listed on the [GitHub profile](https://github.com/warterbili). Discussions about porting this methodology to other PX-protected sites, joint research, or paid pen-test engagements are welcome.

---

## 17. Citation

If this project is used in academic research, technical reports, or commercial consulting, please cite as:

```bibtex
@misc{perimeter_v2_2026,
  author       = {warterbili},
  title        = {{PerimeterX (HUMAN Security) SDK Complete Reverse Engineering}},
  year         = {2026},
  version      = {2.0},
  howpublished = {GitHub Repository},
  url          = {https://github.com/warterbili/PerimeterX_RE},
  note         = {iFood + Grubhub 10/10 verified · 68 production gotchas ·
                  3-year longitudinal SDK drift study · 2024--2026}
}
```

Short citation: `warterbili, "PerimeterX SDK Complete Reverse Engineering", v2.0, 2026.`

---

## 18. Acknowledgments

This project is the product of **three iterations across 2024–2026**:

```
2024  perimeter_X     ──→  Initial PX exploration (PoC stage)
2025  perimeterX_Re   ──→  Methodology solidification (fork era)
2026  perimeter v2.0  ──→  Paper-level complete public release (this project)
```

Each refactor was based on **post-mortem of what went wrong in the previous iteration**. If you run [`stample/ifood/px_cookie/ifood_px3.js`](stample/ifood/px_cookie/ifood_px3.js) and obtain `_px3`, or install [`bundle/script/userscripts/px_bundle3_auto.user.js`](bundle/script/userscripts/px_bundle3_auto.user.js) and pass the press-challenge — at that moment you have **passed through every outer line of PX defense**.

Salute to all peers who have publicly shared even fragments of anti-bot research — your gists, Zhihu posts, Medium articles, and scattered blog puzzle pieces enabled this project to stand on the shoulders of giants.

**Happy reversing.**

---

<div align="center">

**v2.0** · Verified 2026-05-23 · iFood + Grubhub dual-site 10/10 · Bundle path fully preserved · AI Skill included

**[⬆ Back to top](#perimeterx-human-security-sdk--complete-reverse-engineering--v20)**

</div>
