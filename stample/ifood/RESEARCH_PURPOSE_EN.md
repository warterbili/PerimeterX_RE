# 🎯 iFood — Research Purpose and Real-World Use Case

> This folder is **not** an academic demo. It is the pure-algorithm PX module of a **real production scraper** that generates _px3 daily → directly calls iFood GraphQL → harvests 2,000+ merchant records.

---

## 1. Purpose Overview (One Sentence)

**Use the `_px3` cookie to pass PerimeterX gating and directly call iFood's `cw-marketplace.ifood.com.br` GraphQL to fetch merchant + menu + product data.**

---

## 2. PX Cookie's Place in the Business Chain

```
            browser / scraper
                │
                ▼
        ┌─────────────────┐
        │ ifood_px3.js    │  ← this directory
        │ (~350ms each)   │
        └────────┬────────┘
                 │ _px3 + _pxvid + _pxcts
                 ▼
   ┌─────────────────────────────────────────┐
   │ POST cw-marketplace.ifood.com.br/       │
   │      v1/merchant-info/graphql           │
   │                                          │
   │ ← PX gates; no _px3 = 403               │
   └────────┬────────────────────────────────┘
            │
            ▼
        merchant data:
        { name, userRating, available, address, menu, products }
```

| Cookie | Source | Purpose |
|---|---|---|
| `_px3` | OB#2 set_cookie segment from generator | PX primary auth |
| `_pxvid` | generator `state.vid` | PX visitor ID (persistent session) |
| `_pxcts` | generator `state.cts` | PX client timestamp |

Business API endpoints:

| Endpoint | Purpose |
|---|---|
| `POST .../v1/merchant-info/graphql` | Merchant details (name / rating / open status) |
| `POST .../v2/cardstack/search/home` | Home feed (by geographic location) |
| `GET .../v1/merchants/restaurant/{id}/catalog` | Menu + products |

---

## 3. End-to-end Example (30-second Walkthrough)

### Setup

```bash
cd <repo-root>/stample/ifood/px_cookie
npm install https-proxy-agent     # one-time, proxy support
node smoke_test.js                # self-test 21/21 ✓ confirms environment ready
```

### Run the Demo

⚠️ **A Brazilian residential proxy is mandatory** (Cloudflare blocks datacenter IPs + non-BR IPs). This project uses Bright Data:

```bash
# PowerShell
$env:HTTPS_PROXY = 'http://<BRD_USER>:<BRD_PASS>@zproxy.lum-superproxy.io:22225'
# bash
export HTTPS_PROXY='http://<BRD_USER>:<BRD_PASS>@<BRD_HOST>:<BRD_PORT>'

node business_api_demo.js
# Or specify a merchant ID
node business_api_demo.js 5770dab7-943e-4046-9b71-1f9d39aec822
```

Default `merchant_id = 5770dab7-…` (Bar e Lanches Estadão, São Paulo Centro) — verified live 2026-05-23.
If that ID dies, pull a fresh one from the home feed:
`POST /v2/cardstack/search/home?latitude=-23.5505&longitude=-46.6333&channel=IFOOD&alias=HOME_MULTICATEGORY_V10`
then read `MERCHANT_LIST_V2.contents[].id`.

### ✅ Real Output (Verified 2026-05-23)

```
[proxy] using http://<BRD_USER>:***@zproxy.lum-superproxy.io:22225
━━━ Step 1: Generate _px3 ━━━
✅ _px3=bd8a1bd1b7a5292d…  ttl=330  (5103ms)
   uuid=...  vid=ee2defd8-5626-...

━━━ Step 2: Use _px3 to query GraphQL for the merchant ━━━
   merchant_id: 5770dab7-943e-4046-9b71-1f9d39aec822
   cookies: _px3, _pxvid, _pxcts

GraphQL response: HTTP 200  (1897ms)
✅ Business API works — _px3 score sufficient

{
  "data": {
    "merchant": {
      "available": true,
      "name": "Bar e Lanches Estadão",
      "userRating": 4.9
    }
  }
}

━━━ Total: 7000ms  (gen 5103 + api 1897) ━━━
```

### 2026-05-23 Demo Fix Log (Why the old demo returned 400)

The previous demo returned 400 "Merchant not found". Three bugs were stacked — **fixing any one alone still fails; all three must be fixed**:

| # | Location | Original | Effect | Fix |
|---|---|---|---|---|
| 1 | `business_api_demo.js:87` | `path: u.pathname` | The `?latitude&longitude&channel=IFOOD` query string was dropped, so the backend couldn't resolve the region index → 400 not_found | `path: u.pathname + u.search` |
| 2 | Missing production headers | No `platform / app_version / Country / browser` | Some endpoints flagged as non-browser by WAF | Send all four headers |
| 3 | `DEFAULT_MERCHANT_ID = ccd2ff85-…` | Verified 2026-05-21, but the store was de-listed 2 days later → 400 not_found | Switched to `5770dab7-…` (Bar e Lanches Estadão) |

All three are baked into `business_api_demo.js` — runs out of the box.

### Key Findings (Measured Gotchas)

| Phenomenon | Cause | Fix |
|---|---|---|
| No proxy → 403 HTML | Cloudflare blocks non-BR IP | BR residential proxy |
| `/v2/cardstack/search/home` returns px-captcha | Feed endpoint has higher PX score threshold than GraphQL | Use `/v1/merchant-info/graphql` to validate _px3 |
| Missing `?latitude=&longitude=&channel=IFOOD` → 400 "Merchant not found" | iFood backend indexes by region; `u.pathname` drops the query string | URL must include these 3 params; use `u.pathname + u.search` in `https.request({ path })` |
| 400 "Merchant not found" (params present) | merchant_id has been de-listed / re-issued | Switch ID; production pulls fresh IDs from the home feed |
| Missing `platform / app_version / Country / browser` header → some endpoints WAF-blocked | iFood validates browser-header completeness | Send all four headers |
| iFood vs `cw-marketplace.ifood.com.br` comparison | `marketplace.*` (mobile API) **has no PX**; `cw-marketplace.*` (web) **has PX** | The demo uses `cw-` because our research target is to test PX |

---

## 4. Validation Scripts

| Script | Purpose |
|---|---|
| `px_cookie/smoke_test.js` | 21/21 self-test (validates generator algorithm correctness; doesn't call real PX) |
| `px_cookie/business_api_demo.js` ⭐ | **End-to-end real API call** — this is the true proof that "_px3 works" |
| `script/verify_all.sh` | 6-batch decode-loop closure (validates decoder against current SDK) |
| `script/diff_samples.py` | Three-class field classification (STATIC/DYNAMIC/CONDITIONAL) |
| `script/find_state_keys.py` | state.* → EV2 b64 key mapping |

**Key distinction**:
- `smoke_test.js` = "my computed bytes match real captures" — algorithm layer OK
- `business_api_demo.js` = "PX actually receives and issues _px3 + business API accepts that _px3" — **actually usable**

---

## 5. Production Pipeline Diagram

```
              Bright Data residential proxy (Brazil IP)
                      │
                      ▼
         ┌──────────────────────────────────┐
         │ ifood_full_scraper.py            │ ← External production crawler (not in this repo)
         │ (Python, curl_cffi chrome120 TLS)│
         └──────┬───────────────────────────┘
                │ rotate _px3 every ~300 requests
                │
                ├──> ifood_px3.js (this directory's generator)
                │    Produces { _px3, _pxvid, _pxcts }
                │
                ├──> POST .../v2/cardstack/search/home  (home feed)
                │    {lat: -23.5505, lng: -46.6333}  ← São Paulo
                │    ↓
                │    merchants list (40 per page, paginated)
                │
                ├──> POST .../v1/merchant-info/graphql  (10-15 concurrent workers)
                │    Pull details per merchant_id
                │    ↓
                │    { name, userRating, available, address }
                │
                └──> GET .../v1/merchants/restaurant/{id}/catalog
                     ↓
                     menu + products

         Output: data/merchants.jsonl (1.4 GB / 2,000+ merchants)
```

Measured throughput (from `benchmark_workers.py`):

| Workers | Delay | Throughput | 429 rate |
|---|---|---|---|
| 5 | 0.3s | ~16 req/s | < 1% |
| 10 | 0.2s | ~50 req/s | < 5% |
| 15 | 0.1s | ~150 req/s | ~15% |

⭐ **Key insight**: `_px3` has ttl = 330 seconds; one cookie can serve roughly 300 requests. In production, **regenerate every ~300 calls**.

---

## 6. Related Documents

### Inside the Project

| Document | Purpose |
|---|---|
| [`px_cookie/README.md`](px_cookie/README.md) | Detailed technical description of this directory |
| [`px_cookie/ifood_px3.js`](px_cookie/ifood_px3.js) | _px3 generator entry |
| [`px_cookie/business_api_demo.js`](px_cookie/business_api_demo.js) ⭐ | End-to-end demo for this research purpose |
| [`source/SDK_INFO.md`](source/SDK_INFO.md) | Locked SDK version + SHA256 + constants |
| [`../../main/ZH/methodology/`](../../main/ZH/methodology/) | 10-chapter methodology |
| [`../../bug_report/1_collector_path.md`](../../bug_report/1_collector_path.md) | Collector-path 33 gotchas |
| [`../../revers/`](../../revers/) | 9 algorithm modules (payload/pc/ob/sid/uuid/...) |

### Production Project (External)

| Module | Purpose |
|---|---|
| Python `_px3` generator | Wraps the Node.js subprocess for production use |
| iFood main scraper (merchant / catalog / product tiers) | Consumes pure-algo `_px3`, runs merchants + catalog + products |
| Concurrency benchmark | Measured throughput / 429 rate |

---

## ⚠️ Legal & Ethical Boundaries

- This research is for **auditing your own anti-bot deployments on iFood**, **academic research**, **security audit**
- Do not use for **large-scale scraping that violates iFood's terms of service** or for commercial resale
- For high-frequency scraping, use residential proxies + intervals; don't generate anomalous traffic to iFood
- iFood's publicly visible merchant data falls under "publicly accessible" categories, but **is still subject to robots.txt and ToS**

---

*Verified 2026-05-23. Production-measured 10/10 pass. Demo bugs fixed (path + production headers + merchant ID) — runs out of the box.
Full end-to-end journal: [`../live_validation/journal/2026-05-23.md`](../live_validation/journal/2026-05-23.md)*
