# Live Validation — End-to-end Production API Verification

> An auditable evidence library answering "do pure-algo cookies actually work against real business APIs?".
> Not smoke_test (which only verifies byte alignment) — this is **real proxy + real business API calls + real returned data**.

---

## What This Directory Is For

The project has **3 layers** of validation, each complementing the others:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 1: Algorithm-layer smoke_test                                 │
│   stample/{ifood,grub}/px_cookie/smoke_test.js  (21/21 + 17/17)     │
│   Validates: byte-level algorithm correctness (require OK + constants + template loads OK)│
│   Output: pass/fail                                                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 2: Decode-loop closure                                        │
│   stample/{ifood,grub}/script/verify_all.sh  (6/6 + 6/6)            │
│   Validates: 6 real-capture batches can be restored by the decoder  │
│   Output: pass/fail                                                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ⭐ Layer 3: End-to-end business API validation (this directory)     │
│   stample/{ifood,grub}/px_cookie/business_api_demo.js               │
│   Validates: pure-algo cookies actually pass PX scoring + business APIs return real data │
│   Output: timestamped journal + full real HTTP request/response     │
└─────────────────────────────────────────────────────────────────────┘
```

**Why Layer 3 exists**: Layers 1+2 are "we validate ourselves against ourselves". Layer 3 proves **the PX server genuinely accepts our cookies**. This is the final standard of "project complete".

---

## Directory Structure

```
stample/live_validation/
├── README.md            ← This file (validation system + how to read journals + how to write new ones)
└── journal/
    ├── 2026-05-21.md    ← First dual-site end-to-end validation
    └── 2026-05-23.md    ← Dual-site re-run + demo fixes + Grub full chain (SSO → instacart_sid)
```

The journal is a **timeline archive**, **append-only** (after SDK upgrades / re-validation, add a new file; don't modify old ones).

---

## Verified Records

| Date | Sites | Result | Details |
|---|---|---|---|
| 2026-05-21 | iFood + Grubhub | ✅ Dual-site pass | [journal/2026-05-21.md](journal/2026-05-21.md) |
| 2026-05-23 | iFood + Grubhub | ✅ Dual-site full chain (demo bug fixes + Grub `__Host-instacart_sid` obtained) | [journal/2026-05-23.md](journal/2026-05-23.md) |

---

## What a Journal Is + How to Read It

Each journal is auditable evidence of one **complete end-to-end real test**. Structure:

```
Part 0: Dual-site verification conclusion (at-a-glance table)

Part 1: <Site A>
  1.1 API overview      ← what business APIs this site has, which use PX
  1.2 Risk architecture ← how many layers stack server-side (PX + Cloudflare + Akamai?)
  1.3 IP requirements   ← datacenter / domestic residential / which country IP can pass
  1.4 Production code   ← references stample/<site>/px_cookie/business_api_demo.js
  1.5 Actual request + response ← full raw HTTP (not truncated)
  1.6 PX research insights ← PX behavior discovered this run (NOT debug history)

Part 2: <Site B>
  ... same as above

Reproduce commands
```

**Only PX research insights are recorded** (e.g., endpoint score thresholds / Akamai stacking / HTTP 463 verdict); **NOT debug history** (e.g., "where the AI grep'd to find a URL parameter" — those are reproducible by capture).

---

## How to Write a New Journal

After SDK upgrades / re-running 6 capture batches / wanting to verify a newly discovered endpoint, add a new journal:

```bash
# 1. Copy the old journal as a template
cp journal/2026-05-21.md journal/$(date +%Y-%m-%d).md

# 2. Run the demos to obtain real outputs
node stample/ifood/px_cookie/business_api_demo.js          # iFood
node stample/grub/px_cookie/business_api_demo.js           # Grubhub

# 3. Paste the actual request/response into the journal's corresponding sections
# 4. Add this run's new findings to "PX research insights"
```

Leave a timestamp + author at the end of each new journal.

---

## Reproduce Commands

Detailed args are at the bottom of each journal. Short version:

```bash
cd <project-root>
npm install

# iFood
export HTTPS_PROXY='http://<user>:<pwd>@<host>:<port>'   # BR Brazilian residential
node stample/ifood/px_cookie/business_api_demo.js

# Grubhub
export GRUBHUB_EMAIL='your@email.com'                    # optional (needed for full chain)
export GRUBHUB_PASSWORD='yourpassword'                   # optional
node stample/grub/px_cookie/business_api_demo.js
```

⚠️ **Credentials**: everything in this directory **never embeds any credentials** (proxy user/pass / email password / Bright Data customer ID).
All passed via environment variables. New journals must also follow this rule — if business responses contain real emails/usernames, those must be masked too.
