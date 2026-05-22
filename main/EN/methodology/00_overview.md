# 0. Overview: 7 Stages From 0 to `_px3`

> **Chapter purpose**: read this before starting any PX reverse engineering work. **5 minutes** of overall map.
>
> *This chapter merges*: B/00_overview (structure) + C/§0 (time budget) + A/§0 (stable / unstable layers)

---

## 0.1 7 Stages, One Diagram

```
Stage 1 — Capture           Lock SDK + capture 6+ batches    ──┐
   ↓                                                          │ "Know what I'm facing"
Stage 2 — Decode            Decode payload + OB → JSON        │
   ↓                                                          │
Stage 3 — Classify          STATIC/DYNAMIC/CONDITIONAL ────┐  │
   ↓                                                       │  │
                                                           │  ▼
Stage 4 — Locate            Locate field semantics in     ⭐   │
   ↓                        SDK source                    │
Stage 5 — Value-match       state.* → EV2 b64 key      ⭐⭐⭐  │ "Know what each field is"
   ↓                                                       │
                                                           ▼
Stage 6 — Implement         Write generator (template +      ──┐
   ↓                        DYNAMIC overlay)                  │ "Make it work"
Stage 7 — Validate          10/10 + business API ✓             │
                                                                ▼
                                                        ┌──────────────┐
                                                        │ _px3 ✓       │
                                                        └──────────────┘
```

---

## 0.2 Time Budget (By Skill Level)

| Stage | Task | Fluent | First time |
|---|---|---|---|
| 1 | Capture 6+ batches | 30 min | 1 h |
| 2 | Decode + algorithm validation | 15 min | 1 h |
| 3 | Three-class classification | 30 min | 2 h |
| 4 | Locate field semantics ⭐ | 1 h | **4 h** |
| 5 | **Value-match** ⭐⭐⭐ | 15 min | 30 min |
| 6 | Implement | 1 h | 4 h |
| 7 | Validate | 30 min | 2 h |
| | **Total** | **~4 h** | **~15 h** |

**The single most important sentence**: **Stage 5 is a 15-minute script that saves several hours of blind guessing in Stages 4 and 6**. Many production reverse engineers skip Stage 5 and waste hours; **we wrote it down so you don't**.

---

## 0.3 Real Time Distribution (2026-05 Combat Retrospective)

Running iFood + Grubhub dual sites, 6 batches × 2 captures, 12 end-to-end tests — measured distribution:

```
20% — Capture + decode + sample comparison                 Stage 1+2
25% — SDK source reversing + field semantic location       Stage 4
15% — Algorithm-layer porting                              Stage 2
30% — Field table alignment + type checking (most gotchas) Stage 5+6 ⭐⭐⭐
10% — End-to-end integration + stability validation        Stage 7
```

> ⚠️ **Critical warning**: 30% of time goes to "field alignment + type checking" — well beyond what most newcomers expect. The single pitfall "`state.no` must be `parseInt()`'d to a number" cost 3 hours (see [`../../../bug_report/1_collector_path.md`](../../../bug_report/1_collector_path.md) #14). **Reading the gotcha list first saves half the time**.

---

## 0.4 Prerequisites

- **Runtime**: `Node ≥ 18`, `Python ≥ 3.10` (optional, for cross-batch analysis scripts)
- **Decode toolchain**: this project's [`../../../revers/`](../../../revers/) 9 algorithm modules are ready to use
- **Browser**: Chromium-family (Chrome / Edge) + DevTools
- **IP**: non-datacenter IP (PX heavily rejects datacenter IPs; residential proxy / VPN required)
- **Optional but strongly recommended**: `mitmproxy` or Charles for traffic auditing

---

## 0.5 What's Stable / What's Not (Must Memorize)

PX rotates obfuscation frequently. **Knowing what's stable** directly determines how durable your reverse engineering methodology will be.

### 0.5.1 Stable Layer (Unchanged for 3 Years)

PX **hasn't changed its core algorithms**. You can hardcode these constants:

| Algorithm | Magic constant | Cross-version? |
|---|---|---|
| MD5 init A | `1732584193` (`0x67452301`) | ✅ |
| MD5 init B | `-271733879` (`0xEFCDAB89`, signed) | ✅ |
| MD5 init C | `-1732584194` (`0x98BADCFE`, signed) | ✅ |
| MD5 init D | `271733878` (`0x10325476`) | ✅ |
| HMAC ipad | `909522486` (`0x36363636`) | ✅ |
| HMAC opad | `1549556828` (`0x5C5C5C5C`) | ✅ |
| UUID v1 Gregorian epoch | `122192928e5` | ✅ |
| INT32_MAX (`ml()` hash) | `2147483647` | ✅ |
| base91 alphabet (payload) | `F@bt...` long-string prefix | ✅ |
| XOR(50) — payload encryption | `50` | ✅ |
| XOR(10) — paddingKey encryption | `10` | ✅ |
| Default fallback ts | `1604064986000` | ✅ |

**This means**: grepping these constants to locate algorithms is a **permanently effective technique** — it won't break when PX upgrades.

### 0.5.2 Semi-Stable Layer (Changes Every 6–12 Months)

| Item | Frequency | Example |
|---|---|---|
| OB XOR key | Each new TAG | `ml(TAG) % 128` (dynamic) |
| OB wire characters | Major versions | `0/l` ↔ `o/I` ↔ `1/o` |
| EV1/EV2 field count | Yearly tweaks | 14 → 16, 204 → 228 |
| ChaCha20 seed (Bundle WASM) | Each build | 32 bytes embedded in .data segment |

### 0.5.3 Unstable Layer (Changes Monthly to Weekly)

| Item | Frequency | Mitigation |
|---|---|---|
| Function names (obfuscation) | Every build | **Don't grep by name** — grep by args shape / magic constants |
| Line numbers | Every build | Don't hardcode line numbers |
| **b64 key dictionary** (229 entries) | Every build | Regenerate via `extract_hQ.js` on every upgrade |
| state.* → EV2 b64 key mapping | Each site | **Use the value-matching script** (Stage 5) — don't guess by type |
| Protocol constants (TAG / FT / Cookie name) | Each site + occasional upgrade | Extract directly from real captured POST body; don't rely on doc memory |

**Core insight**: **build your methodology on the stable layer; avoid the unstable layer**. This is why this methodology has not needed a rewrite in 3 years.

---

## 0.6 When You Should **NOT** Reverse-Engineer Purely

Three scenarios to consider abandonment:

### 0.6.1 Low Business Volume

If you do < a few hundred requests per day, **using Playwright + residential proxy through a real browser** has 10× better cost-effectiveness than a pure-algo generator.
- No need to maintain algorithm cross-version compat
- No need to respond to monthly SDK upgrades
- Naturally strongest anti-detection

A pure-algo generator's cost is "maintenance cost"; low volume doesn't recoup the investment.

### 0.6.2 You Have a Lighter "Back Door"

If your target site has:
- Internal API endpoints (not behind PX)
- A way to bypass server-side registration
- An option to subscribe to PX SDK as "an insider"

**Use those first; don't reverse-engineer**. Reversing should be "the option of last resort".

### 0.6.3 Your Target Isn't PX

PX knowledge **only applies to PX-client sites**. If your target is Cloudflare Turnstile / Akamai / DataDome / Imperva — **this methodology does not generalize**; those WAFs have completely different mechanisms.

---

## 0.7 When You **Should** Reverse-Engineer Purely

Three best-fit scenarios:

| Scenario | Why pure-algo fits |
|---|---|
| High-throughput data collection | Real browsers are 5× slower; can't scale |
| Multi-IP / TLS-fingerprint isolation | Pure-algo gives flexible control over TLS fingerprint |
| Auditing your own deployment | You learn exactly what PX does on your site |
| Academic research / security audit | Depth-of-knowledge requirement |

---

## 0.8 When to Give Up (Script Won't Pass)

Two situations suggest abandoning the current path:

### 0.8.1 Major SDK Rewrite

PX algorithms haven't changed in 3 years in practice, but **theoretically it could happen**. If:
- Magic constants are no longer greppable in the algorithm layer
- The payload encryption chain structure has changed
- OB decoding becomes incomprehensible

**Temporary mitigation**: bridge via a real browser (Playwright) for PX session, while you re-reverse the pure-algo portion.

### 0.8.2 Score Below Threshold

If your generator **byte-matches the real capture but still can't obtain a cookie**, possibilities:
- PX added a new field (your template lacks it)
- Your IP score is below the PX threshold (Layer 1 isn't enough)
- Your TLS fingerprint is being identified

See [`07_stage7_validate.md`](07_stage7_validate.md) §troubleshooting decision tree.

---

## 0.9 This Methodology's Deliverables

After running Stages 1-7 you should have:

- `stample/<site>/source/main.min.js` — pinned SDK file (with SHA256)
- `stample/<site>/source/SDK_INFO.md` — site constants (AppID, TAG, FT, Cookie name, Collector URL)
- `stample/<site>/sample/{1..6}/` — 6+ aligned capture batches
- `stample/<site>/px_cookie/<site>_ev1_template.json` — cold-visit EV1 baseline
- `stample/<site>/px_cookie/<site>_ev2_template.json` — cold-visit EV2 baseline (200+ fields)
- `stample/<site>/px_cookie/state_key_map.json` — state.* → EV2 b64 key mapping
- `stample/<site>/px_cookie/<site>_px3.js` — end-to-end generator
- 10/10 validated ✓

**This is the gold standard**. Less than this = "reversing in progress", not "reverse complete".

---

## 0.10 Next Chapter

→ [Stage 1: Capture Preparation](01_stage1_capture.md)
