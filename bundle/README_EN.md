# Bundle Path — Complete Deconstruction of the PerimeterX Press Challenge

> **Author's note**: this is the **deepest and earliest** piece of the project. Bundle (the PX press challenge) was the first PX path I cracked; later I discovered Collector silent mode covers 99% of business needs, and Bundle was retired to maintenance archive.
>
> **Kept as a complete knowledge archive**: it's the other half of the project's "full PX picture", and **anyone who wants to deeply study PX anti-bot should read this part**. Collector gets you the cookie; Bundle lets you **understand every card PX holds**.
>
> **Verification**: iFood Bundle 2026-02 production **10/10 pass rate**. The current docs are based on real captures + real artifacts.

---

## 5 Minutes to Decide Whether to Continue

### You should read this part if…

✅ You've already finished the Collector path ([`../stample/ifood/px_cookie/`](../stample/ifood/px_cookie/)) and want to know what "the other half of PX" looks like
✅ You want to fully understand PX's **5 unique algorithms** (PoW / WASM / Bézier trajectory / Myanmar DOM / V8 error stack)
✅ You want to learn "WebAssembly's real-world use in anti-bot"
✅ You're doing **academic research** or **a security audit** and need full-stack PX knowledge
✅ Your target site has strict PX scoring — **the Collector path isn't enough** — and you need Bundle fallback

### You can skip this part if…

❌ You just want `_px3` to call business APIs and the Collector path already works
❌ Your business volume is small (< a few dozen / day) and Playwright + real press is sufficient
❌ You don't need to "understand" PX, just "use" it

---

## Learning Path: 4 Depths

Pick by how much time you want to invest:

| Depth | Time | You'll master | How to proceed |
|---|---|---|---|
| **L1 — Quick overview** | **15 minutes** | What Bundle is + difference vs Collector + the 5 unique algorithms | Read this README + [`doc/Bundle_完整技术文档.md`](doc/Bundle_完整技术文档.md) §1 |
| **L2 — Run the userscript** | **30 minutes** | Run the artifact in a browser → obtain `_px3` | Install [`script/userscripts/px_bundle3_auto.user.js`](script/userscripts/px_bundle3_auto.user.js) |
| **L3 — Full comprehension** | **8-16 hours** | Read the main doc + userscript + real captures; can review someone else's Bundle code | Read [`doc/Bundle_完整技术文档.md`](doc/Bundle_完整技术文档.md) 4,996 lines + browse [`stample/`](stample/) captures |
| **L4 — Rebuild from scratch** | **40-66 hours** | Write a Bundle generator from zero; support porting to new sites | Walk through [`../main/ZH/PX_Bundle_逆向方法论.md`](../main/ZH/PX_Bundle_逆向方法论.md) 8 stages |

⚠️ **Both L3 and L4 require Collector first**. Bundle shares 70% algorithms with Collector; doing Bundle without the Collector foundation typically **adds 3 weeks in practice**.

---

## Decision Tree: "I Want To…"

Pick next steps by goal:

### "I want `_px3` within 30 minutes"

→ Install [`script/userscripts/px_bundle3_auto.user.js`](script/userscripts/px_bundle3_auto.user.js) (2,131-line production artifact, 10/10 pass rate)
→ Visit iFood / Grubhub → let PX naturally trigger the challenge → the script obtains the cookie automatically

⚠️ Running this **does not require understanding Bundle internals** — knowing how to install a Tampermonkey script is enough.

### "I want to understand how Bundle works"

→ Read [`doc/Bundle_完整技术文档.md`](doc/Bundle_完整技术文档.md) **§1-§2** (30 min, covers overview + protocol layer)
→ For more depth, continue with **§3-§7** (Bundle#1/#2/#3 + PoW + WASM)
→ For real-world field details jump to **§10** (full 229-field classification)

### "I want to see real captured data"

→ [`stample/sample/`](stample/sample/) — 4 raw Bundle POSTs + 4 OB responses
→ [`stample/decoded/`](stample/decoded/) — 8 decoded JSON (EV payload + state)
→ [`stample/mouse_tracks/`](stample/mouse_tracks/) — **50 real human-press mouse trajectories** (540+ points each)

### "I want the real captcha.js file"

→ [`source/captcha.js`](source/captcha.js) (821 KB real SDK)
→ [`source/px_captcha.wasm`](source/px_captcha.wasm) (60,862-byte WASM binary)
→ [`source/SDK_INFO.md`](source/SDK_INFO.md) for SHA + extraction method + constants

### "I want to learn Bundle reversing from zero"

→ Do Collector first (see [`../main/ZH/PX_逆向方法论_通用版.md`](../main/ZH/PX_逆向方法论_通用版.md))
→ Then read [`../main/ZH/PX_Bundle_逆向方法论.md`](../main/ZH/PX_Bundle_逆向方法论.md) (**973 lines dedicated to Bundle**, 8 stages)

### "I want to see what PX rejecting Bundle looks like"

→ [`../bug_report/2_bundle_path.md`](../bug_report/2_bundle_path.md) — 20 Bundle-path combat gotchas
→ Main doc [`doc/Bundle_完整技术文档.md`](doc/Bundle_完整技术文档.md) **§15** — failure diagnosis decision tree

### "I want to review or fix the userscript"

→ Read [`script/userscripts/README.md`](script/userscripts/README.md) — internal architecture of the 2,131-line script
→ Main doc **§13** — userscript workflow details (intercept B1/B2 + synthesize B3)

### "I want to port Bundle to a new site"

→ Main doc **§14** — cross-platform porting 7-step method
→ Methodology [`../main/ZH/PX_Bundle_逆向方法论.md`](../main/ZH/PX_Bundle_逆向方法论.md) **§15** — Bundle-specific 12-step porting

### "PX pushed a new SDK; my generator stopped working"

→ Main doc **§16** — SDK drift response
→ Methodology [`../main/ZH/PX_Bundle_逆向方法论.md`](../main/ZH/PX_Bundle_逆向方法论.md) **§16** — Bundle SDK upgrade response

### "I want to do academic research / security audit"

→ Main doc **§18** — external resources + Pr0t0ns v8.9.6 full comparison (other independent reverse-engineering works in the industry)
→ [`../bug_report/`](../bug_report/) — full 68-gotcha collection (the project's most unique asset)
→ Main doc **§20** — Mobile SDK comparison (PX Web vs Android/iOS)

### "I want to use AI (Claude / Cursor) for Bundle reversing"

→ [`../skill/AI_re/`](../skill/AI_re/) — AI agent skill (playbooks + tools)
→ But **honestly**: AI alone has a 20-40% Bundle success rate. Recommend human + AI collaboration (see main doc §13.6)

---

## Current Status

| Dimension | Status |
|---|---|
| Overall | **Archived** (not actively maintained after 2026-05, but full knowledge preserved) |
| Main doc | ✅ `doc/Bundle_完整技术文档.md` (4,996 lines) |
| Bundle methodology | ✅ `../main/ZH/PX_Bundle_逆向方法论.md` (973 lines) |
| Userscript | ✅ `script/userscripts/px_bundle3_auto.user.js` (2,131-line production, 10/10) |
| Source code (captcha.js + WASM) | ✅ `source/` (8 files) |
| Real captures | ✅ `stample/sample/` 8 files + `stample/decoded/` 8 files |
| Mouse trajectory pool | ✅ `stample/mouse_tracks/` 50 real trajectories + tools |
| Bundle EV templates + helpers | ✅ `stample/ev_templates/` 5 + `stample/helpers/` 6 |
| No longer updated | Node-side generator (user.js is self-contained)<br>Validation scripts (script/ no longer extending CLIs)<br>Multi-version captcha.js tracking |

---

## Directory Structure

```
bundle/                          95 files, 2.3 MB
├── README.md                    this file
│
├── doc/
│   └── Bundle_完整技术文档.md    ⭐ Main doc 4,996 lines
│
├── source/                       SDK true source (8 files)
│   ├── captcha.js                Bundle main SDK 821 KB
│   ├── px_captcha.wasm           WASM binary 60,862 bytes
│   ├── main_legacy_with_captcha.js   Legacy PX SDK (captcha bundled)
│   ├── captcha_html_request.txt  captcha load capture metadata
│   ├── captcha_js_request.txt
│   ├── captcha_response.txt
│   ├── SDK_INFO.md               Constants + SHA + extraction method
│   └── WASM_ANALYSIS.md          WASM decompilation analysis
│
├── stample/                      real data
│   ├── sample/                   8 files (4 Bundle POSTs + 4 OB responses)
│   ├── decoded/                  8 files (4 EV JSON + 4 state JSON)
│   ├── ev_templates/             5 files (bundle#1-4 EV builders + generic)
│   ├── helpers/                  6 files (error_stack / myanmar / extract_wasm / run_wasm / gen_bundle3 / build_userscript)
│   └── mouse_tracks/             54 files
│       ├── track_001-050.json    50 real captured mouse trajectories
│       ├── mouse_pool.json       merged trajectory pool
│       └── 3 tool .js (generate / mouse_trajectory / gen_mouse_pool)
│
└── script/
    ├── README.md
    └── userscripts/
        ├── README.md
        └── px_bundle3_auto.user.js   ⭐⭐⭐ production 10/10 userscript (2,131 lines)
```

---

## History + Versions

| Time | Event |
|---|---|
| 2026-Q1 | First complete Bundle reversal (iFood, 4 weeks of work) |
| 2026-02 | px_bundle3_auto.user.js 10/10 pass tests |
| 2026-03 | Committed to sourcing-cracked git repo (commit `f256b7e`) |
| 2026-04 | `007623b` cleanup commit expected build_userscript to regenerate but the builder has a bug; the artifact survives only in git history |
| 2026-05 | Collector path fully working; Bundle effectively archived |
| 2026-05-21 | Materials reorganized into `perimeter/bundle/`; wrote main doc + methodology + learning guide (this revision) |

---

## Relationship to Other Parts of the Project

| Resource | Path | When to go there |
|---|---|---|
| **Collector main path** (actively maintained) | [`../stample/ifood/`](../stample/ifood/) / [`../stample/grub/`](../stample/grub/) | Your actual production use |
| Algorithm modules (9 of which Bundle reuses 7) | [`../revers/`](../revers/) | Inspect specific algorithms |
| Collector full docs | [`../main/ZH/`](../main/ZH/) | Learn Collector |
| Bundle methodology | [`../main/ZH/PX_Bundle_逆向方法论.md`](../main/ZH/PX_Bundle_逆向方法论.md) | Learn how to do Bundle from scratch |
| Full gotcha collection (68 entries, of which 20 are Bundle) | [`../bug_report/`](../bug_report/) | Troubleshooting |
| AI agent skill | [`../skill/AI_re/`](../skill/AI_re/) | AI-assisted reversing |
| CDP capture skill | [`../skill/cdp/`](../skill/cdp/) | Real traffic capture |

---

## Author's Note / Message to the Reader

When I worked on Bundle, the first 3 weeks stalled entirely on the WASM stage — how to mock the Node simulation environment, that `globalThis._pxUuid` must be set before instantiation, that `__wbg_instanceof_Window` must return 1 — each was hours of debug.

Later, working on Collector, I found the "algorithm layer is unchanged over 3 years" insight — building the methodology on standard constants (MD5/HMAC/UUID) instead of PX's obfuscated function names. With this understanding, **redoing Collector took only 1 week**.

Bundle is archived not because it's unimportant, but because **Collector already covers 99% of business needs**, and Bundle's maintenance cost (chasing captcha.js upgrades every 2-3 weeks) isn't worth it.

**But Bundle remains the soul of the project** — it showcases **every unique algorithm** in PX's anti-bot system. Someone who only knows Collector doesn't fully know PX. If you want to do anti-bot research / write articles / teach, the content here is far more value-dense than Collector (because far fewer people in the industry have written about Bundle).

**Happy reversing.** If you run [`px_bundle3_auto.user.js`](script/userscripts/px_bundle3_auto.user.js) and obtain `_px3`, in that moment you'll understand why this project is called "perimeter" — you've passed through every outer line of PX defense.

---

*Doc verified 2026-05-21. All contents here came from production 10/10 verification (except for the ⚠️-marked build_userscript.js builder, which doesn't currently run).*
