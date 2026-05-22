# PerimeterX Universal Reverse Engineering Methodology — 7-Stage Combat Manual

> **Target audience**: engineers / AI agents reversing the PX SDK from scratch
> **Expected deliverable**: pure-algorithm `_px3` cookie generator with 10/10 end-to-end pass rate
> **Estimated effort**: 4–8 hours when fluent; 16–24 hours from zero
> **Prerequisites**: JS fundamentals, Node.js environment, Chrome DevTools, HTTP capture

---

## What This Is

The **complete reverse engineering methodology** for PerimeterX (HUMAN Security) SDK, broken into 7 sequential stages. Each stage has its own chapter and includes **time budget + required tools + step-by-step procedure + critical pitfalls + validation criteria**.

This methodology **only covers the silent Collector path** (99% of business scenarios). For the press-challenge Bundle path see the standalone methodology [`../PX_Bundle_逆向方法论.md`](../PX_Bundle_逆向方法论.md) (973 lines, Chinese only for now).

---

## Time Investment Distribution (Combat Experience)

Real distribution across 2 sites (iFood + Grubhub), 6 batches × 2 captures each, and 12 end-to-end tests:

```
20% — Capture + decode + sample comparison (need 6+ batches)   Stage 1+2
25% — SDK source reversing + field semantic location           Stage 4   ⭐
15% — Algorithm porting (payload/PC/OB/SID/anti-tamper)        Stage 2
30% — Field table alignment + type matching (most gotcha-prone) Stage 5+6 ⭐⭐⭐
10% — End-to-end integration + multi-run stability validation  Stage 7
```

> ⚠️ **Gotcha warning**: stages 5+6 (field alignment + `state.*` injection) are most likely to stall progress. During the 2026-05 effort, 90% of debug time was spent on a single **type bug** (`state.no` should be a number, not a string). **That single gotcha cost 3 hours**.

---

## 7-Stage Map

```
Stage 1 — Capture            Lock the SDK + capture 6+ batches
   ↓
Stage 2 — Decode             Decode payload + OB response
   ↓
Stage 3 — Classify           STATIC / DYNAMIC / CONDITIONAL three-class taxonomy
   ↓
Stage 4 — Locate             Find every field's semantic in SDK source     ⭐
   ↓
Stage 5 — Value-match        state.* → EV2 b64 key value matching          ⭐⭐⭐
   ↓
Stage 6 — Implement          Write the generator
   ↓
Stage 7 — Validate           10× stability test
```

**Critical stages**:

- **Stage 4** consumes the most time (4–8 h) — locating fields in SDK source requires 7 techniques in combination
- **Stage 5** has the single highest ROI (15-min script saves 3 hours of blind guessing) — the core of both cross-platform porting and new SDK upgrades

---

## Chapter Map

| Ch | Title | Time (fluent) | Time (first time) |
|---|---|---|---|
| [00](00_overview.md) | Overview + time budget + when to (not) use pure-algo reversing | 10 min | 10 min |
| [01](01_stage1_capture.md) | Stage 1: Capture prep — lock SDK + 6+ batch samples | 30 min | 1 h |
| [02](02_stage2_decode.md) | Stage 2: Decode — reverse payload + OB + algorithm validation | 15 min | 1 h |
| [03](03_stage3_classify.md) | Stage 3: Field 3-class taxonomy — STATIC/DYNAMIC/CONDITIONAL | 30 min | 2 h |
| [04](04_stage4_locate.md) ⭐ | Stage 4: Field semantic location — 7 techniques (grep handbook) | 1 h | **4 h** |
| [05](05_stage5_value_match.md) ⭐⭐⭐ | Stage 5: Value-match — state.\* → EV2 b64 key | **15 min** | 30 min |
| [06](06_stage6_implement.md) | Stage 6: Implement — template approach + DYNAMIC overlay | 1 h | 4 h |
| [07](07_stage7_validate.md) | Stage 7: Validate — 10/10 test + troubleshooting | 30 min | 2 h |
| [08](08_cross_platform.md) | Cross-platform porting — iFood → Grubhub → new site | — | 1 day/site |
| [09](09_sdk_upgrade.md) | SDK upgrade response — 30 min or 4 h? It depends | — | 0.5–4 h |
| | **Total (fluent)** | **~4 h** | **~15 h** |

---

## Appendices

| Appendix | Contents |
|---|---|
| [A](appendix/A_tools.md) | Tool / CLI script inventory (14 CLIs) |
| [B](appendix/B_algorithms.md) | Key algorithm pseudocode (end-to-end + build_ev2) |
| [C](appendix/C_avoid_traps.md) | Don't-repeat-history checklist (10 most lethal gotchas) |

---

## Relationship to the Three "Predecessor" Documents

This methodology is the **merged and curated version** of 3 predecessor methodology documents in the project:

| Predecessor | Role |
|---|---|
| `../PX_逆向方法论_通用版.md` (1,233-line grep handbook) | **Retained** as §4 Stage 4's "grep pattern reference"; referenced from this directory |
| `perimeterX_Re/docs/06_methodology/` (10 English procedure docs) | **Structural source** — the 10-chapter layout of this directory follows its structure |
| `perimeter_X/docs/zh/18_methodology.md` (610-line combat-cadence document) | **Content backbone** — the 7-stage narrative + appendices A/B/C are fully reused |

Each predecessor is valuable on its own; this directory is the **best-practice merge**.

---

## Learning Paths

| If you are… | How to read |
|---|---|
| **New to PX reversing** | Read in order 00 → 01 → 02 → 03 → 04 → 05 → 06 → 07, do the exercises |
| **Reversing a new site** | Quick scan 00 for the budget, then **focus on 04 + 05 + 08** |
| **PX pushed a new SDK and the generator broke** | Go straight to [`09_sdk_upgrade.md`](09_sdk_upgrade.md) |
| **Can't obtain `_px3`, need to debug** | See [`07_stage7_validate.md`](07_stage7_validate.md) §troubleshooting decision tree + [`../../../bug_report/`](../../../bug_report/) |
| **Onboarding N PX sites in bulk** | Read [`08_cross_platform.md`](08_cross_platform.md) + [`../PX_完整SDK对照逆向方法论.md`](../PX_完整SDK对照逆向方法论.md) |
| **Quick grep-pattern lookup** | Go directly to `../PX_逆向方法论_通用版.md` (grep handbook quick reference) |
| **Working on Bundle press-challenge** | Jump to [`../PX_Bundle_逆向方法论.md`](../PX_Bundle_逆向方法论.md) (973-line 8-stage methodology) |

---

## Relation to Other Parts of the Project

| Looking for | Go to |
|---|---|
| Algorithm modules (9 of them) | [`../../../revers/`](../../../revers/) |
| iFood ready-made generator | [`../../../stample/ifood/px_cookie/`](../../../stample/ifood/px_cookie/) |
| Grubhub ready-made generator | [`../../../stample/grub/px_cookie/`](../../../stample/grub/px_cookie/) |
| Full 68-gotcha record | [`../../../bug_report/`](../../../bug_report/) |
| Bundle path complete | [`../../../bundle/`](../../../bundle/) |
| AI agent skill (with playbooks) | [`../../../skill/AI_re/`](../../../skill/AI_re/) |
| CDP capture skill | [`../../../skill/cdp/`](../../../skill/cdp/) |

---

*Verified 2026-05-21. This methodology integrates 3 predecessors (A: 1,233-line grep handbook + B: 10 English procedure docs + C: 610-line combat-cadence narrative). Applicable scope: PX SDK silent Collector path. For the Bundle path see the standalone methodology [`../PX_Bundle_逆向方法论.md`](../PX_Bundle_逆向方法论.md).*
