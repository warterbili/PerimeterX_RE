# 🎯 Total Wine — Research Purpose & Live Case Study

> This directory is **not** an academic demo. It's the end-to-end reverse-engineering case study of a **PX strict-tier deployment**, proving that the same PX SDK enforces different server-side checks at different customers.
>
> Compared to [iFood](../ifood/RESEARCH_PURPOSE_EN.md) / [Grubhub](../grub/RESEARCH_PURPOSE_EN.md): the underlying algorithms are 100% shared, but the server-side policies are **completely different tiers** — iFood/Grub accept a cookie at issuance, Total Wine adds 4 extra server-side checks after issuance. The value of this case is filling the "strict tier" gap in the methodology.

---

## 1. Purpose at a glance

**Use `_px2` cookie to pass PerimeterX (strict tier) at totalwine.com, fetch real search-results HTML and PDPs from curl_cffi / Python directly.**

---

## 2. Where PX cookie sits in the business flow

```
            Browser / Scraper
                │
                ▼
        ┌─────────────────┐
        │ totalwine_px2.js│  ← This directory
        │  (3-POST chain) │
        │  ⭐ seq=2 required│
        └────────┬────────┘
                 │ _px2 + _pxvid
                 ▼
   ┌─────────────────────────────────────────┐
   │ GET totalwine.com/search/all?text=wine  │
   │                                          │
   │ ← PX strict tier:                        │
   │   No cookie = 5,745 B px-captcha challenge│
   │   trust-low cookie = 427 B PX-block JSON │
   │   trust-verified cookie = 1.3 MB real HTML│
   └────────┬────────────────────────────────┘
            │
            ▼
        search results HTML
        (products / prices / inventory by store)
```

| Cookie | Source | Role |
|---|---|---|
| `_px2` | generator OB#2 set_cookie segment + seq=2 beacon confirmation | PX primary auth (trust=verified) |
| `_pxvid` | generator `state.vid` | PX visitor ID (persistent session) |

Business API endpoints (verified accessible):

| Endpoint | Purpose |
|---|---|
| `GET /search/all?text=<query>` | Search results page (HTML) |
| `GET /spirits/.../p/<sku>` | Product detail page (HTML) |
| `GET /site/resourceapi/global/header` | Site nav JSON (actually not gated) |

---

## 3. Strict vs lenient: 5 traps we fell into

Applying the iFood/Grub playbook to Total Wine, we hit 5 deep traps. Each requires its own methodology supplement:

| # | Trap | iFood/Grub | Total Wine |
|---|---|---|---|
| 1 | **Layer 3.5 validation** | "Collector signs cookie" = OK | ❌ Must replay cookie against a PX-gated endpoint and retrieve real HTML |
| 2 | **EV3 (seq=2) role** | This POST doesn't exist | ⭐ Mandatory cookie-confirmation beacon, body contains `OkpJAH8oTTA=` = just-issued cookie |
| 3 | **HMAC field inputs** | `hmac(uuid+':a/:b/:c', UA)` (guesswork) | ❌ Completely different: `hmac(state.vid, UA)` / `hmac(state.pxsid, UA)` / **`md5(state.vid)`** |
| 4 | **state.hid field** | No such field | ⭐ Extracted from `OlllOOll\|<b64>=:<b64>\|true` segment, required in seq=2 form param |
| 5 | **Counter synchronization** | `PX12738` and `PX12739` independent random | ❌ Always equal and monotonic across EV1→EV2→EV3 |

Detail: [`skill/AI_re/references/gotchas.md`](../../skill/AI_re/references/gotchas.md) Bug #15-#18.

---

## 4. 30-second end-to-end demo

```bash
# 1. Set proxy (must be US residential IP)
$env:HTTPS_PROXY = 'http://<user>-session-<random>:<pwd>@<host>:<port>'

# 2. Run generator (3-POST chain, auto-fires seq=2 beacon)
node stample/totalwine/px_cookie/totalwine_px2.js

# 3. 10/10 end-to-end stability test
python stample/totalwine/script/smoke_10x_e2e.py
# Expected: 10/10 PASS, each iteration retrieves ~1.3 MB real SRP HTML
```

---

## 5. File structure

```
stample/totalwine/
├── RESEARCH_PURPOSE.md       ← Chinese version
├── RESEARCH_PURPOSE_EN.md    ← This file
│
├── source/                    ← Locked SDK
│   ├── main.min.js              (326 KB, SHA-256: 9335db02… LF-normalized)
│   └── SDK_INFO.md              (constants + verification)
│
├── sample/                    ← 6 batches of cold-visit ground truth
│   ├── 1..6/
│   │   ├── request_{1,2,3}.txt
│   │   ├── response_{1,2,3}.json
│   │   ├── decoded_payload_{1,2,3}.json
│   │   ├── decoded_response_{1,2,3}.json
│   │   └── meta.json
│   └── README.md
│
├── px_cookie/                 ← Generators
│   ├── totalwine_px2.js          ⭐ Main entry
│   ├── totalwine_ev{1,2,3}_template.json
│   ├── totalwine_ev{1,2,3}_field_map.json
│   ├── state_key_map.json
│   ├── smoke_test.js
│   ├── business_api_demo.js      ⭐ End-to-end demo
│   └── README.md
│
└── script/                    ← Analysis tools
    ├── capture_via_cdp_totalwine.py    (Re-capture 6 batches)
    ├── decode_all.js                    (request/response → JSON)
    ├── build_templates.js              (6 batches → STATIC/DYNAMIC classification + templates)
    ├── find_state_keys.js              (state.* → EV2 b64 key cross-batch matching)
    ├── diff_ev2_ours_vs_real.py        ⭐ Strict-tier diagnostic primary tool
    ├── find_hmac_inputs.py             ⭐ HMAC formula recovery
    └── smoke_10x_e2e.py                ⭐ Layer 3.5 validation
```

---

## 6. Relationship to other parts of the project

| Resource | Path |
|---|---|
| Generic algorithm modules (XOR/HMAC/ml/anti-tamper) | [`../../revers/`](../../revers/) |
| PX SDK reverse-engineering methodology (EN) | [`../../main/EN/PX_SDK_Reverse_Engineering.md`](../../main/EN/PX_SDK_Reverse_Engineering.md) |
| Cross-vendor comparison (iFood / Grub / **Total Wine**) | [`../../main/EN/PX_Complete_SDK_Comparative_Methodology.md`](../../main/EN/PX_Complete_SDK_Comparative_Methodology.md) §8 |
| Strict vs lenient tier reference | [`../../skill/AI_re/references/deployment-tiers.md`](../../skill/AI_re/references/deployment-tiers.md) |
| 18 production gotchas list | [`../../skill/AI_re/references/gotchas.md`](../../skill/AI_re/references/gotchas.md) (includes Bug #15-#18 strict-tier traps) |
| HMAC formula recovery SOP | [`../../skill/AI_re/playbooks/recover-hmac-formulas.md`](../../skill/AI_re/playbooks/recover-hmac-formulas.md) |

---

## 7. Ethics statement

This project is for **security research / protection mechanism learning** only. Same rules as [iFood RESEARCH_PURPOSE](../ifood/RESEARCH_PURPOSE_EN.md) §Ethics.

When scraping totalwine.com:
- Use only for understanding PX protection mechanism learning
- Don't bypass `robots.txt`
- Don't impact production services
- Don't redistribute scraped data
