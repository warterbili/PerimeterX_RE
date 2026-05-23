# 🎯 Grubhub — Research Purpose and Real-World Use Case

> This folder is **not** an academic demo. It is the pure-algorithm PX module of a **real production account system** that generates _px2 daily → automatically registers/logs in Grubhub accounts → exchanges for the sid used by downstream Instacart scrapers.

---

## 1. Purpose Overview (One Sentence)

**Use the `_px2` cookie to pass PerimeterX gating; call the `api-gtm.grubhub.com/auth` family of endpoints to complete account registration/login/refresh; finally exchange via OAuth2 SSO for `__Host-instacart_sid` for the downstream Instacart grocery scraper.**

> ⭐ **Key insight**: Grubhub PX **gates the account system (grubhub.com)**, not the real data interfaces.
> The actual data scraper at `grocery.grubhub.com` (Instacart white-label) **doesn't use PX** — it goes straight via `__Host-instacart_sid` to GraphQL.

---

## 2. PX Cookie's Place in the Business Chain

```
           Bright Data Web Unlocker (bypasses PX during registration)
                      │
                      ▼
        ┌─────────────────────────────────┐
        │ grubhub_px2.js                  │  ← this directory
        │ (~350ms each)                   │
        └────────┬────────────────────────┘
                 │ _px2 + _pxhd
                 ▼
   ┌────────────────────────────────────────┐
   │ POST api-gtm.grubhub.com/auth          │
   │   (anonymous token)                    │  ← PX gates
   │ POST api-gtm.grubhub.com/auth/login    │  ← PX gates
   │ POST api-gtm.grubhub.com/auth/         │  ← PX gates
   │      confirmation_code   (OTP)         │
   │ PUT  api-gtm.grubhub.com/oauth2/...    │  ← PX gates
   └────────┬───────────────────────────────┘
            │ access_token + refresh_token
            │
            │ 4-step OAuth2 SSO
            ▼
   ┌────────────────────────────────────────┐
   │ grocery.grubhub.com/rest/sso/auth/...  │  ← no PX!
   │ → Set-Cookie: __Host-instacart_sid     │
   └────────┬───────────────────────────────┘
            │
            ▼
   ┌────────────────────────────────────────┐
   │ grocery.grubhub.com/graphql            │  ← no PX!
   │ (Instacart grocery data)               │
   └────────────────────────────────────────┘
            │
            ▼
       2,006 stores × products ≈ 1.4 GB
```

| Cookie | Source | Purpose |
|---|---|---|
| `_px2` | OB#2 set_cookie segment from generator | PX primary auth |
| `_pxhd` | OB#1 set_cookie segment from generator | PX high-entropy device |
| `_pxvid` | generator `state.vid` | PX visitor ID |

Business API endpoints (all on `api-gtm.grubhub.com`):

| Endpoint | Purpose | Uses PX? |
|---|---|---|
| `POST /auth` (scope=anonymous) | Anonymous token | ✅ |
| `POST /auth/login` | Email-password login | ✅ |
| `POST /auth/confirmation_code` | Send OTP | ✅ |
| `PUT  /auth/confirmation_code` | Verify OTP | ✅ |
| `PUT  /oauth2/{ud_id}/access` | OAuth2 exchange code | ✅ |
| `GET grocery.grubhub.com/rest/sso/auth/awe/callback` | Exchange for instacart_sid | ❌ |
| `POST grocery.grubhub.com/graphql` | Instacart data | ❌ |

---

## 3. End-to-end Example (30-second Walkthrough)

### Setup

```bash
cd <repo-root>/stample/grub/px_cookie
npm install https-proxy-agent     # one-time, proxy support
node smoke_test.js                # self-test 17/17 ✓ confirms environment ready
```

### Run the Demo

```bash
node business_api_demo.js
```

⭐ **As of 2026-05-23, the demo ships with a default US residential proxy + a default device-trusted test account** — `node business_api_demo.js` runs the full 3-stage chain to HTTP 200 out of the box.
Override with env vars for production use:

```bash
# PowerShell
$env:HTTPS_PROXY     = 'http://<user>:<pwd>@<host>:<port>'   # US residential
$env:GRUBHUB_EMAIL   = 'your@email.com'
$env:GRUBHUB_PASSWORD= 'yourpassword'
# bash
export HTTPS_PROXY='http://<user>:<pwd>@<host>:<port>'
export GRUBHUB_EMAIL='your@email.com'
export GRUBHUB_PASSWORD='yourpassword'

node business_api_demo.js
```

### ✅ Real Output (Verified 2026-05-23 — full 3-stage chain, all 200)

```
[proxy] using http://<user>:<pwd>@zproxy.lum-superproxy.io:22225
━━━ Stage 1: Generate _px2 ━━━
✅ _px2=eyJ1IjoiZDI0MWU4ZTAtNTY2MC0xMWYxLTk2ZTIt…  ttl=500  (3808ms)
   uuid=d241e8e0-5660-11f1-96e2-3b6ca74ffdb1  vid=d32cf7af-5660-...

━━━ Stage 2: /auth (anonymous scope) ━━━
   endpoint: https://api-gtm.grubhub.com/auth
   HTTP 200  (3752ms)
✅ PX gate #1 passed — anon_token=9cd431b4-9ae9-4f…  expire_in=60min

━━━ Stage 3: /auth/login (real account) ━━━
   email: ****@***.***
   HTTP 200  (3295ms)
✅ PX gate #2 passed — login successful
   user access_token: 35ae5c54-****-****-****-************…
   refresh_token:     54c8caee-****-****-****-************…
   ud_id:             8f04f320-****-****-****-************

━━━ Total time: 10855ms  (gen 3808 + anon 3752 + login 3295) ━━━
```

### Full Logic: What the Demo Does + Why It Used to Fail + Why It Now Works

> Raw measured data: [`../live_validation/journal/2026-05-23.md`](../live_validation/journal/2026-05-23.md) §Part 2

#### Full chain (demo runs 3 stages, verifying PX gates #1 + #2)

```
[1] grubhub_px2.js  →  _px2 + _pxvid                          ← generator (this dir)
       (~3.8s, pure algorithm)
            │
            ▼
[2] POST api-gtm.grubhub.com/auth (scope=anonymous)            ← PX gate #1
       headers: cookie=_px2; _pxvid;  Chrome 120 UA
       body:    { brand, client_id, device_id: <random UUID>, scope: "anonymous" }
       → HTTP 200 + anonymous_token (UUID)
            │
            ▼
[3] POST api-gtm.grubhub.com/auth/login                        ← PX gate #2
       headers: cookie=_px2; _pxvid;  Authorization: Bearer <anon_token>
       body:    { brand, client_id, device_id: "-981990071", email, password }
       → HTTP 200 + user access_token + refresh_token + ud_id   ✅ demo ends
       → HTTP 463 = PX passed + business layer demands OTP (device_id unfamiliar)
       → HTTP 403 = PX score insufficient, blocked at the PX layer
            │
            │  Downstream production project (not in this demo):
            ▼
[4-7] 4-step SSO (init → authorize → /oauth2/<ud_id>/access → callback)
       → Set-Cookie: __Host-instacart_sid
            │
            ▼
[8] POST grocery.grubhub.com/graphql  (no PX! direct)
       → Instacart grocery data
```

#### Where it used to fail (2026-05-21)

**Punchline first**: the PX SDK portion ([1] [2]) **has always been green** — Stage 2 `/auth` was already 200 in the 2026-05-21 journal. The failure point was **Stage 3 `/auth/login`, stuck at HTTP 463**. The old demo called 463 "PX-pass" and returned — but no user access_token meant no SSO, **so end-to-end never completed**.

Why did Stage 3 keep returning 463? Four stacked causes:

| # | Cause | Detail |
|---|---|---|
| 1 | **`device_id` was a fresh UUID every run** | Old code used `crypto.randomUUID()` for `/auth/login`'s device_id. Grubhub's business layer saw "this email + unknown device" → forced OTP → 463 |
| 2 | **`device_id` was an integer even when fixed** | Business-layer trust records are stored as **strings**. Even with a "trusted" account, integer `-981990071` doesn't match string `"-981990071"` → still treated as a new device |
| 3 | **UA Chrome 148 didn't match TLS fingerprint** | Demo set UA `Chrome 148.0.0.0`, but the curl_cffi/proxy layer impersonated `chrome120`. PX cross-checks UA header vs TLS ClientHello → mismatch → score drop (not enough to fail Stage 2/3, but it added risk weight at the business layer) |
| 4 | **No curated account pool** | The old demo asked the user to provide `GRUBHUB_EMAIL`/`PASSWORD`; random accounts have no device trust → business layer always demands OTP |

The old demo returned 463 and stopped, with a comment saying "463 counts as PX-pass" — **but no user token = nothing downstream can run**.

#### Why Stage 3 now returns 200 (2026-05-23)

Three changes let the business layer pass us through:

| # | Change | Code location | Why it works |
|---|---|---|---|
| 1 | **`device_id` is a fixed string `"-981990071"`** | `business_api_demo.js:205` | Business-layer trust records are stored as strings, and this number is **one-to-one bound to a specific account** (switching accounts requires switching device_id). Off by one digit → 463 |
| 2 | **UA changed to Chrome 120 to match TLS** | `business_api_demo.js:102` | UA / TLS fingerprint consistent → PX score steady, business layer's trust signal improves |
| 3 | **Default account is a maintained device-trusted account** | `DEFAULT_EMAIL` (line 68) | a device-trusted account is one that previously completed full OTP registration, so the business layer whitelisted its device_id → direct 200 |

#### Two more changes live in the downstream production project (not in this demo)

Listed for completeness — **this demo doesn't need them**:

| # | Change | What it does |
|---|---|---|
| A | **Entry path: try `/auth/refresh` first, fallback to `/auth/login` on failure** | `/auth/refresh` is a low-bar PX endpoint + doesn't check device_id; accounts with a live refresh_token skip `/login` entirely |
| B | **SSO step 3 (`PUT /oauth2/<ud_id>/access`) uses bare `_GH_HEADERS + Bearer`**, no `perimeter-x` HMAC header | That endpoint is also PX-gated, but adding the HMAC header actually causes 403 (its HMAC formula differs from other endpoints). Let the PX cookie travel via the jar; don't add a signed header |

A and B serve `__Host-instacart_sid` extraction for grocery.grubhub.com data — orthogonal to validating the PX SDK here.

### Key Findings (Measured Gotchas)

| Phenomenon | Cause | Fix |
|---|---|---|
| Stage 2 HTTP 403 | _px2 score too low / datacenter IP / TLS fingerprint mismatch | Use a US residential proxy; align UA with TLS chrome120 |
| Stage 3 HTTP 463 (OTP needed) | Business layer doesn't recognize the account's device_id | Switch to a device-trusted account or run the mail.tm OTP flow |
| Stage 3 HTTP 403 | PX gate #2 didn't pass | Usually `_px2` cookie missing or expired in the jar |
| Stage 3 HTTP 401 "Invalid client_id" | Demo has an expired client_id hardcoded | Use `beta_UmWlpstzQSFmocLy3h1UieYcVST` |
| /auth returns UUID, not JWT | The anonymous scope returns a simple token | Working as intended — Stage 3's user access_token is the long-lived credential |
| Works without a proxy (local IP) | Grubhub US accepts global IPs, but PX score drops | Use a US residential proxy as insurance (the demo ships one by default) |

### Full Chain (extracting `__Host-instacart_sid`)

This JS demo stops at Stage 3 (user access_token + refresh_token + ud_id). To continue and obtain the downstream grocery.grubhub.com cookie `__Host-instacart_sid` you need to run 4 more SSO steps — handled by the downstream production project (see journal §2.2 [7]-[10]). **This repo's job ends at Stage 3 — proving the PX SDK's _px2 is accepted at both gated endpoints by the live service.**

---

## 4. Validation Scripts

| Script | Purpose |
|---|---|
| `px_cookie/smoke_test.js` | 17/17 self-test (validates generator algorithm correctness) |
| `px_cookie/business_api_demo.js` ⭐ | **End-to-end real API call** — true proof that _px2 works |
| `script/verify_all.sh` | 6-batch decode-loop closure (validates decoder against current SDK) |
| `script/diff_samples.py` | Three-class field classification (STATIC/DYNAMIC/CONDITIONAL) |
| `script/find_state_keys.py` | state.* → EV2 b64 key mapping (Grubhub's mapping is completely different from iFood's!) |

---

## 5. Production Pipeline Diagram (Full 8 Steps)

```
[1] grubhub_px2.js → _px2 + _pxhd                                 ← this directory

[2] POST api-gtm.grubhub.com/auth (scope=anonymous)              ← /auth
       → anonymous_token  ✅ Bearer

[3] POST api-gtm.grubhub.com/auth/login                          ← /auth/login
       (email + password)
       → 200: access_token + refresh_token  or  463: OTP required

[4] if 463:
       POST api-gtm.grubhub.com/auth/confirmation_code          ← /OTP send
       → mail.tm polls mailbox
       PUT api-gtm.grubhub.com/auth/confirmation_code
       → access_token + refresh_token

[5] GET grocery.grubhub.com/rest/sso/auth/awe/init               ← OAuth2 Step 1
       → 302 redirect to authorize URL

[6] GET api-gtm.grubhub.com/oauth2/authorize?...                 ← OAuth2 Step 2
       → 302 redirect to grubhub login

[7] PUT api-gtm.grubhub.com/oauth2/{ud_id}/access                ← OAuth2 Step 3
       Authorization: Bearer <access_token>
       → { status: "GRANTED", redirect_uri: "...?code=xxx" }

[8] GET grocery.grubhub.com/rest/sso/auth/awe/callback?code=xxx  ← OAuth2 Step 4
       → Set-Cookie: __Host-instacart_sid=v2.xxx  ✅

[9] Downstream: crawler_full.py uses __Host-instacart_sid to call
       POST grocery.grubhub.com/graphql  (no PX!)
       → grocery data
```

**Measured**:
- Per-account registration (with OTP): ~30 seconds
- Refresh token refresh: ~3 seconds (direct, no proxy needed)
- access_token lifetime: 60 minutes
- refresh_token lifetime: 30 days

---

## 6. Related Documents

### Inside the Project

| Document | Purpose |
|---|---|
| [`px_cookie/README.md`](px_cookie/README.md) | Detailed technical description of this directory |
| [`px_cookie/grubhub_px2.js`](px_cookie/grubhub_px2.js) | _px2 generator entry |
| [`px_cookie/business_api_demo.js`](px_cookie/business_api_demo.js) ⭐ | End-to-end demo for this research purpose |
| [`source/SDK_INFO.md`](source/SDK_INFO.md) | Locked SDK version + SHA256 + constants |
| [`../../main/ZH/PX_完整SDK对照逆向方法论.md`](../../main/ZH/PX_完整SDK对照逆向方法论.md) | iFood vs Grubhub field comparison (1,441 lines) |
| [`../../bug_report/1_collector_path.md`](../../bug_report/1_collector_path.md) | Collector-path 33 gotchas |
| [`../../revers/`](../../revers/) | 9 algorithm modules (shared with iFood) |

### Production Project (External)

| Module | Purpose |
|---|---|
| Grubhub auth pipeline (registration / login / token-refresh runners) | Completes the 9-step chain to obtain `__Host-instacart_sid` |
| Python `_px2` generator | Wraps the Node.js subprocess for production use |
| Downstream Instacart scraper | **No PX** — consumes upstream account tokens |

---

## ⚠️ iFood vs Grubhub Key Comparison

| Dimension | iFood | Grubhub |
|---|---|---|
| **What PX gates** | Data API (GraphQL) | Account system (auth + SSO) |
| **PX cookie** | _px3 + _pxvid + _pxcts | _px2 + _pxhd + _pxvid |
| **TLD** | ifood.com.br | grubhub.com (api-gtm.grubhub.com) |
| **Business API** | One-step direct call | **Multi-step chain**: anon → login → OTP → SSO |
| **Subsequent data scraping uses PX?** | ✅ Every request goes through PX | ❌ instacart_sid domain doesn't use PX |
| **Production strategy** | Continuously generate _px3 (~300 calls per cookie) | Register once → token rolling refresh |

⭐ **This is why Grubhub doesn't need "high-frequency _px2 generation"**: after obtaining instacart_sid, all downstream calls go through grocery.grubhub.com; PX is completely out of the loop. Grubhub's _px2 is an **entry ticket for the account system**, not a data-collection token.

---

## ⚠️ Legal & Ethical Boundaries

- This research is for **auditing your own anti-bot deployments on Grubhub** and **account-system security audits**
- **Do not use for mass fake-account registration or OTP-bypass fraud**
- mail.tm is for **research-purpose temporary mailboxes only**; do not use for KYC bypass
- Registered accounts should be **for research purposes only**; do not impersonate identities

---

*Verified 2026-05-23. This JS demo runs the full 3-stage chain to HTTP 200 (device-trusted account, ~10.9s end-to-end).
Full end-to-end journal: [`../live_validation/journal/2026-05-23.md`](../live_validation/journal/2026-05-23.md)*
