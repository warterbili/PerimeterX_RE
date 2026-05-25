# Total Wine PX Capture Samples

6 batches of real PerimeterX collector POSTs + responses + decoded results captured from totalwine.com. ⭐ **Strict-tier deployment** — all 3 seq POSTs (seq=0/1/2) including the `OkpJAH8oTTA=` cookie-confirmation beacon.

---

## 1. Directory structure

```
sample/
├── README.md              Chinese version
├── README_EN.md           This file
├── 1/                     Batch 1
├── 2/                     Batch 2
├── 3/                     Batch 3
├── 4/                     Batch 4
├── 5/                     Batch 5
└── 6/                     Batch 6
```

**6 batches are 6 independent cold-visit sessions** — each one with a new Chrome profile (no cookies, no cache), opening totalwine.com, waiting ~20 s, capturing **all 3 collector POSTs** + responses + OB segments.

Different from iFood/Grub's 2-POST chain: Total Wine **always has 3 POSTs per session** (seq=0/1/2). The 3rd POST (seq=2) is the cookie-confirmation beacon.

---

## 2. Files per batch

```
1/
├── meta.json                    Batch metadata (UUID/proxy/timing/SDK SHA)
├── request_1.txt                seq=0 POST (HTTP headers + form body)
├── request_2.txt                seq=1 POST (the one that received _px2)
├── request_3.txt                seq=2 POST ⭐ cookie-confirmation beacon
├── response_1.json              seq=0 response (state source)
├── response_2.json              seq=1 response (contains set_cookie _px2 segment)
├── response_3.json              seq=2 response
├── decoded_payload_1.json       request_1 decoded → EV1 (~13 fields)
├── decoded_payload_2.json       request_2 decoded → EV2 (~199 fields)
├── decoded_payload_3.json       request_3 decoded → EV3 (~11 fields)
├── decoded_response_1.json      response_1 OB decoded → state segments
├── decoded_response_2.json      response_2 OB decoded → segments
└── decoded_response_3.json      response_3 OB decoded → segments
```

All decoded JSON files are produced one-shot via [`../script/decode_all.js`](../script/decode_all.js).

---

## 3. Key file usage quick reference

| File | Use |
|---|---|
| `decoded_payload_1.json` | EV1 template + DYNAMIC field set (13 fields, 4 DYNAMIC) |
| `decoded_payload_2.json` | EV2 template + state.* injection positions (199 fields, 18 DYNAMIC) |
| `decoded_payload_3.json` | EV3 template + cookie-confirmation beacon fields (11 fields) |
| `decoded_response_1.json` | state.{no,qa,pxsid,to,appId,jf,cts,vid,hid} extraction |
| `decoded_response_2.json` | Contains `OOOllO|_px2|330|<cookie>` segment — _px2 source |
| `meta.json` | sdk_sha256, collector_post_count, captured_at |

---

## 4. Cross-batch STATIC/DYNAMIC classification

Running [`../script/build_templates.js`](../script/build_templates.js) intersects the 6 batches:

```
EV1: 13 keys (8 STATIC, 4 DYNAMIC, 1 PARTIAL)
EV2: 204 keys (167 STATIC, 18 DYNAMIC, 13 PARTIAL, 6 CONDITIONAL)
EV3: 11 keys (2 STATIC, 7 DYNAMIC, 2 PARTIAL)
```

Outputs: `../px_cookie/totalwine_ev{1,2,3}_template.json` + `..._field_map.json`

---

## 5. state.* cross-batch matching (Gotcha #11)

```
state.no    → YQ1SBydsVTQ=     (inject after parseInt — Gotcha #1)
state.to    → fEgPAjoqCzE=
state.appId → Bzd0fUJTcUc=
state.vid   → NOT in EV2.d; used as HMAC(state.vid, UA) input = Lx8cFWl9HCE=
state.pxsid → NOT in EV2.d; used as HMAC(state.pxsid, UA) input = UiJhKBREYhs=
state.hid   → NOT in EV2.d; goes into seq=2 POST form param hid=
```

Empirical script: [`../script/find_state_keys.js`](../script/find_state_keys.js)

---

## 6. Re-capture

If the SDK SHA no longer matches `../source/SDK_INFO.md` (PX rolled a new SDK):

```bash
python ../script/capture_via_cdp_totalwine.py 6
```

After re-capturing 6 batches, run `node ../script/build_templates.js` to rebuild templates.
