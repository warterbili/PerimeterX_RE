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
cd C:/Users/lsd/lsd_projects/perimeter/stample/ifood/px_cookie
node smoke_test.js     # self-test 21/21 ✓ confirms environment ready
```

### Run the Demo

⚠️ **A Brazilian residential proxy is mandatory** (Cloudflare blocks datacenter IPs + non-BR IPs). This project uses Bright Data:

```bash
export HTTPS_PROXY='http://<BRD_USER>:<BRD_PASS>@<BRD_HOST>:<BRD_PORT>'
node business_api_demo.js
# Or specify a merchant ID
node business_api_demo.js ccd2ff85-a898-4da3-bd72-428a66443a2f
```

Run `npm i https-proxy-agent` once to install proxy support.

### ✅ Real Output (Verified 2026-05-21)

```
[proxy] using http://<BRD_USER>:***@<BRD_HOST>:<BRD_PORT>
━━━ Step 1: Generate _px3 ━━━
✅ _px3=08f5a8a978f48f083cb97786a6dcf91fb6cfa043…  ttl=330  (4413ms)
   uuid=9378de50-552c-11f1-98bd-439e4f40c26a  vid=94574d6d-552c-11f1-82de-96bc3ff29a63

━━━ Step 2: Use _px3 to query GraphQL for the merchant ━━━
   merchant_id: ccd2ff85-a898-4da3-bd72-428a66443a2f
   cookies: _px3, _pxvid, _pxcts

GraphQL response: HTTP 200  (2057ms)
✅ Business API works — _px3 score sufficient

{
  "data": {
    "merchant": {
      "available": false,
      "name": "Sorveteria Coelhinho - Shopping Vitória",
      "userRating": 5
    }
  }
}
```

### Key Findings (Measured Gotchas)

| Phenomenon | Cause | Fix |
|---|---|---|
| No proxy → 403 HTML | Cloudflare blocks non-BR IP | BR residential proxy |
| `/v2/cardstack/search/home` returns px-captcha | Feed endpoint has higher PX score threshold than GraphQL | Use `/v1/merchant-info/graphql` to validate _px3 |
| Missing `?latitude=&longitude=&channel=IFOOD` → 400 "Merchant not found" | iFood backend indexes by region | URL must include these 3 params |
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
         │ ifood_full_scraper.py            │ ← sourcing-cracked/ifood-web/
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

| Path | Contents |
|---|---|
| `C:\Users\lsd\projects\sourcing-cracked\ifood-web\` | iFood complete production scraper |
| ├── `px_cookie_generator.py` | Python generator (wraps the Node.js subprocess) |
| ├── `ifood_full_scraper.py` | Main scraper (merchants + catalog + products) |
| └── `benchmark_workers.py` | Concurrency benchmark (measured throughput / 429 rate) |

---

## ⚠️ Legal & Ethical Boundaries

- This research is for **auditing your own anti-bot deployments on iFood**, **academic research**, **security audit**
- Do not use for **large-scale scraping that violates iFood's terms of service** or for commercial resale
- For high-frequency scraping, use residential proxies + intervals; don't generate anomalous traffic to iFood
- iFood's publicly visible merchant data falls under "publicly accessible" categories, but **is still subject to robots.txt and ToS**

---

*Verified 2026-05-21. Production-measured 10/10 pass.*
