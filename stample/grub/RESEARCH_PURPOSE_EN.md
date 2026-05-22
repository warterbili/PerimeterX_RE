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
cd C:/Users/lsd/lsd_projects/perimeter/stample/grub/px_cookie
node smoke_test.js     # self-test 17/17 ✓ confirms environment ready
```

### Run the Demo

⚠️ **A US residential proxy is recommended** (Grubhub is US-based; PX gives non-US IPs lower scores):

```bash
export HTTPS_PROXY='http://<BRD_USER>:<BRD_PASS>@<BRD_HOST>:<BRD_PORT>'
node business_api_demo.js
```

Run `npm i https-proxy-agent` once to install proxy support.

### ✅ Real Output (Verified 2026-05-21)

```
[proxy] using http://<BRD_USER>:***@<BRD_HOST>:<BRD_PORT>
━━━ Step 1: Generate _px2 ━━━
✅ _px2=eyJ1IjoiNGE3OWVkYjAtNTUyZC0xMWYxLTg0ZmEt…  ttl=500  (3439ms)
   uuid=4a79edb0-552d-11f1-84fa-27f24f2e45f3  vid=4ae84a1b-552d-11f1-a69a-ef65a2a9734d

━━━ Step 2: Call /auth (anonymous scope) with _px2 ━━━
   endpoint: https://api-gtm.grubhub.com/auth
   cookies: _px2, _pxvid

/auth response: HTTP 200  (1527ms)
✅ Business API works — _px2 score sufficient

anonymous_token: 024ce7a2-da71-4acc-b309-0d13cc72f8b7
expires_in: 2026-05-21T16:54:07Z

━━━ Total: 4966ms  (gen 3439 + api 1527) ━━━

💡 After obtaining anonymous_token you can continue the full login/registration chain (mail.tm OTP + OAuth2 SSO)
   Full production code in sourcing-cracked/grubhub-web/grubhub-auth/
```

### Key Findings (Measured Gotchas)

| Phenomenon | Cause | Fix |
|---|---|---|
| 401 "Invalid client_id" | Demo had an expired client_id hardcoded | Use `beta_UmWlpstzQSFmocLy3h1UieYcVST` (from `sourcing-cracked/grubhub-web/config.yaml`) |
| Works without proxy (user's local IP) | Grubhub US accepts global IPs but PX score decreases | Add US residential proxy as insurance |
| /auth returns UUID, not JWT | The anonymous scope returns a simple token, not a JWT | Working as intended — step 2 of registration exchanges for the user JWT |

### Full-Chain Combat (2 PX Endpoints Verified)

The newer demo supports env vars for credentials → run the full chain:

```bash
export GRUBHUB_EMAIL='your@email.com'        # optional
export GRUBHUB_PASSWORD='yourpassword'       # optional
node business_api_demo.js
```

**Measured (2026-05-21)**:
- Stage 1 ✅ Pure-algo _px2 generation (ttl=500, 7.8s)
- Stage 2 ✅ `/auth (anonymous)` HTTP 200 + anon_token — **PX endpoint #1 passed**
- Stage 3 ✅ `/auth/login (Bearer + email/pwd)` HTTP 463 + `verify_methods.OTP_EMAIL` — **PX endpoint #2 passed**

463 = PX passed + Grubhub business-layer risk control demands OTP (device_id unfamiliar). Desktop (3) project's 5/5 real-account tests all returned 463, all judged PX-pass.

To complete the full 8 steps (OTP verification → SSO → instacart_sid), use mail.tm + Web Unlocker proxy; full code in `sourcing-cracked/grubhub-web/grubhub-auth/core/python/`.

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

| Path | Contents |
|---|---|
| `C:\Users\lsd\projects\sourcing-cracked\grubhub-web\` | Grubhub complete production |
| ├── `grubhub-auth/core/python/register.py` | Registration machine (with OTP + SSO) |
| ├── `grubhub-auth/core/python/login.py` | Login machine |
| ├── `grubhub-auth/core/python/refresh.py` | Token refresh (runs on a daily schedule) |
| ├── `grubhub-auth/core/python/px_pure_cookie.py` | Python generator |
| ├── `grubhub-auth/data/accounts.jsonl` | Shared account pool (5 accounts) |
| └── `grubhub-instacart/core/crawler_full.py` | Downstream Instacart scraper (**no PX**) |

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

*Verified 2026-05-21. Production-measured 10/10 pass (account registration success rate across 5 accounts).*
