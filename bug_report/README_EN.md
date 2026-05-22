# PX Reverse Engineering Gotcha Compendium

50+ PerimeterX SDK reverse-engineering gotchas that genuinely cost debug
time, distilled from 2 production projects (iFood + Grubhub web scrapers),
5 Desktop iteration archives, and the 14-entry baseline already in the
existing skill — merged and deduplicated.

## Directory

| File | Contents | Gotcha count |
|---|---|---|
| [`1_collector_path.md`](1_collector_path.md) | **Silent Collector path** (99% of traffic) — protocol / encoding / algorithm / state injection / template / cookie lifecycle | 33 |
| [`2_bundle_path.md`](2_bundle_path.md) | **Press-challenge Bundle path** (captcha.js + PoW + WASM + behavioral synthesis + production deployment traps) | 20 |
| [`3_environment.md`](3_environment.md) | Environment / infrastructure (IP throttling, TLS, UA blocklists, Python sid encoding, IPv6) | 8 |
| [`4_sdk_drift.md`](4_sdk_drift.md) | SDK version drift (handler names / charsets / line numbers / captcha.js independent versioning / Chrome version binding) | 7 |
| [`gotchas/`](gotchas/) ⭐ | **Fine-grained version** — 19 named bugs, one file per gotcha with fix code + regression test | 19 |
| [`sdk_drift_cases/`](sdk_drift_cases/) ⭐ | **Real upgrade-diff case studies** — 2026-05-19 iFood mid-version upgrade complete diff data | 1 (growing) |

**Total: 68 independent gotchas** (deduplicated from 9 sources) + **19 fine-grained entries** + **1 upgrade case study**.

## How to Read

- ⭐⭐⭐ = "must-step-on" gotchas that cost ≥ 1 hour of real debug time
- ⭐⭐ = took at least 30 minutes of debug to discover
- ⭐ = avoidable by reading docs, but easy to miss

Each gotcha includes:
- **Symptom**: how things look when it goes wrong
- **Root cause**: why PX is built this way (essential design, not surface fix)
- **Fix**: code or operational action
- **Source**: original record location (line number / paragraph)

## How to Use These Gotchas

**When writing a new generator**:

1. Read through `1_collector_path.md` — 99% of generator failures come from here
2. After capturing samples, run `stample/<site>/script/find_state_keys.py` — resolves gotchas #11/#12 (state.* injection position + EV2 b64 key reuse)
3. After writing the generator, run `stample/<site>/script/compare_my_ev2.py` — field-level diff helps you locate the remaining gotchas
4. If you can't obtain a cookie, follow the decision tree in [`skill/AI_re/playbooks/validate-generator.md`](../skill/AI_re/playbooks/validate-generator.md)

**After an SDK upgrade**:

1. Read `4_sdk_drift.md` — what **must not** be hardcoded across versions
2. Run `verify_all.sh` — can the decoder still decode samples from the new SDK
3. Run `diff_samples.py` — did the three-class classification shift

**Before production deployment**:

1. Read `3_environment.md` — don't run 100 calls on the test-environment IP/TLS and ship straight to prod
2. Don't set UA to `Scrapy/` (gotcha #env-2)
3. Give each account a dedicated residential IP (gotcha #env-1 IP throttling)

## Data Sources

| Source | Path | Gotchas extracted |
|---|---|---|
| **iFood production project** | (author's private sourcing project, ifood-web) | 25 |
| **Grubhub production project** | (author's private sourcing project, grubhub-web) | (largely overlaps with iFood) |
| **Desktop iteration archives (5)** | (author's local working archives) | 30 |
| **AI_re baseline gotchas.md** | `skill/AI_re/references/gotchas.md` | 14 (mostly already in the above archives) |
| **perimeter_X legacy project** | (author's local legacy project) | heavily overlaps with Desktop |
| **perimeterX_Re refactor project** | (author's local fork-era project) ⭐ | **+7 new discoveries** (Cookie TTL, Bundle#4 contradiction, PoW cache trap, trajectory pool too small, captcha.js separate versioning, Chrome version binding) |

**After dedup: 68 independent gotchas**. Where both sides mentioned a gotcha, the more thorough version was retained + double-cited.

## Relationship to Other Parts of the Project

| File | Role | Relationship |
|---|---|---|
| `bug_report/1-4.md` (the 4 files in this directory) | **Aggregate view** of 68 gotchas for quick reading | For people writing code |
| [`gotchas/`](gotchas/) ⭐ | **Fine-grained version**, 19 independent .md files with fixes + tests | Use for deep-dive on a specific gotcha |
| [`sdk_drift_cases/`](sdk_drift_cases/) ⭐ | Upgrade-combat diff data | Pairs with the theory in [`4_sdk_drift.md`](4_sdk_drift.md) + the [`methodology/09_sdk_upgrade.md`](../main/ZH/methodology/09_sdk_upgrade.md) playbook |
| [`skill/AI_re/references/gotchas.md`](../skill/AI_re/references/gotchas.md) | Curated 19 entries (for AI use) | Quick reference for AI agents writing generators |
| [`main/ZH/PX_SDK_逆向技术文档.md`](../main/ZH/PX_SDK_逆向技术文档.md) | Full theory | Explains **why**; this directory explains **what was hit** |
| [`stample/*/script/compare_my_ev2.py`](../stample/) | Field-level diff tool | Helps you pinpoint exactly which gotcha you've hit |

---

*Generated 2026-05-21. Gotcha count increases, never decreases — PX changes SDK but doesn't remove gotchas; it only adds new ones.*
