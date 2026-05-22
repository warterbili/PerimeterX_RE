---
name: node-bridge-build
description: Use jsdom + 11 env-patching modules + Python curl_cffi orchestrator to build an "environment-patching" fallback bridge for anti-bot SDKs (such as PerimeterX / Akamai / similar vendors), without depending on a real browser. Triggers: (1) the pure-algo generator temporarily fails due to SDK upgrades and needs a Plan B; (2) new-site spike — get something running in 30 minutes before deciding whether pure-algo is worth it; (3) high-threshold endpoints (e.g. iFood feed) where pure-algo scores aren't enough; (4) adapting the existing ifood/ template to a new site (Grubhub / Walmart / DoorDash etc.). Trigger phrases: node bridge env-patching / jsdom fake browser / PX SDK fallback / SDK upgrade emergency / build a bridge for <site> / port env-patching template.
---

# Skill: Build a Node Bridge for Environment Patching

> 🔝 **Fallback / escalation path**: [**sdenv** — https://github.com/pysunday/sdenv](https://github.com/pysunday/sdenv) (718⭐, jsdom fork + plugin, the public env-patching ceiling)
> When to escalate to sdenv: see [`methodology.md §7`](methodology.md#7-when-to-escalate-to-sdenv).

## User Trigger Phrases

- "Build a node bridge fallback for \<site\>"
- "Pure-algo \<site\> broke, set up a jsdom env-patching bridge"
- "Port the ifood bridge to \<new_site\>"
- "Plan B for \<site\>"
- "PX SDK upgraded, pure-algo is dead for now, build a temporary bridge"

---

## What You (AI) Must Deliver

```
node_bridge/<site>/
├── perimeterx/
│   └── <sdk_file>.js              ← Pinned target SDK
├── px-node-env/
│   ├── env/                       ← 11 JSDOM env-patching modules (site-specialized)
│   └── ...
├── px_node_bridge.js              ← IPC bridge (start from ifood template, change SDK path)
├── px_cookie_generator.py         ← Python orchestrator (curl_cffi chrome131)
├── package.json
└── README.md                      ← Site-specific working commands + journal
```

**Plus**: working real output (target cookie obtained + business API HTTP 200 + complete journal logged in stample/live_validation/journal/).

---

## Required Upstream Skill Dependencies ⭐

This skill is **not self-contained**. The Node bridge = **organic synthesis of 3 upstream skills**. Read these 3 first:

| Skill | Role in this workflow | Repo relative path |
|---|---|---|
| **`cdp-browser`** | Upstream — dump fingerprint values from real Chrome | `~/projects/Sourcing-AI-Skills/cdp-browser/` |
| **`jni-env-patching`** | Methodology — "inspect real env before assigning reasonable values" 4-step method | `~/projects/Sourcing-AI-Skills/jni-env-patching/` |
| **`curl_cffi_integrate_scrapy_performance`** | Network layer — chrome131 TLS emulation | `~/projects/Sourcing-AI-Skills/curl_cffi_integrate_scrapy_performance/` |

**Full synthesis diagram** is in [`methodology.md §0`](methodology.md#0-three-skill-synthesis-diagram).

---

## Workflow Overview

| Stage | Content | Effort | Details |
|---|---|---|---|
| **Analyze** | Investigate target site / pin SDK / analyze PX endpoints | 30 min – 1 h | `methodology.md §1-3` |
| **Implement** | Copy ifood template → change path constants → dump real Chrome fingerprints → write env/ | 4 – 8 h | `new_site_guide.md` 9 steps |
| **Validate** | Pass smoke test → call real business API → write journal | 30 min – 1 h | `new_site_guide.md` step 9 + `stample/live_validation/` |

---

## Existing Reference Materials

| Resource | Path | Purpose |
|---|---|---|
| iFood working full bridge | `node_bridge/ifood/` | **Copy directly as a template** |
| iFood working log + complete request/response | `stample/live_validation/journal/2026-05-21.md` | See what real output looks like |
| Methodology | `node_bridge/skill/methodology.md` | Mandatory reading |
| Practical tutorial | `node_bridge/skill/new_site_guide.md` | 9-step practical guide |
| sdenv (escalation fallback) | https://github.com/pysunday/sdenv | Escalate when this bridge isn't enough |

---

## Three-layer Fallback Decision (Where This Skill Sits)

```
Layer 1: Pure-algo (revers/ + stample/<site>/px_cookie/) — primary recommendation
   ↓ When it fails
Layer 2: Our node_bridge (what this skill teaches)  ← You are here
   ↓ When this also fails (typeof document.all / V8-level Proxy detection)
Layer 3: sdenv (jsdom fork + plugin) — final fallback
```

See [`methodology.md §"When to Escalate to sdenv"`](methodology.md#7-when-to-escalate-to-sdenv).

---

## What NOT to Do

- ❌ **Don't use `generate_px.js` directly** — that's a standalone debug version left over from sourcing-cracked; Node's default TLS will be detected by PX. **Must** go through the Python orchestrator (`px_cookie_generator.py`).
- ❌ **Don't hardcode credentials in demo code** — proxy user/pass / account / password all go through env vars (reference: `stample/grub/px_cookie/business_api_demo.js`).
- ❌ **Don't add `node_modules/` to git** — use `npm install` (package.json already records dependencies).
- ❌ **Don't try to mock every browser API** — impossible and unnecessary. Follow the jni-env-patching 4-step method: **only patch what the SDK actually probes**.

---

## Quick Sanity Check (30 seconds before starting)

```bash
# 1. Confirm the target site has a pinned SDK
ls stample/<site>/source/

# 2. Confirm the ifood template runs (prerequisite)
cd node_bridge/ifood
ls perimeterx/main.min.js
python -c "import curl_cffi; print('OK')"

# 3. Confirm the cdp-browser skill is available
which python && python -c "import websockets; print('OK')"

# All OK → start working through new_site_guide.md
```

---

*Skill date 2026-05-22 · iFood `_px3` verified working*
