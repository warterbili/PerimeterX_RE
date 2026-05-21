# iFood PX Capture Samples

6 batches of real PerimeterX collector POST + response + decoded results
captured from ifood.com.br.

---

## 1. Directory layout at a glance

```
sample/
├── README.md              Chinese version
├── README_EN.md           This file
├── 1/                     Batch 1 (11 files)
├── 2/                     Batch 2
├── 3/                     Batch 3
├── 4/                     Batch 4
├── 5/                     Batch 5
└── 6/                     Batch 6
```

**`1/` through `6/` are 6 independent capture batches** — 6 fresh sessions,
each using a brand-new Chrome profile (no cookies, no cache, new UUID),
opening iFood, waiting 20s, and recording every collector POST PX SDK
fires.

**Why 6 batches**: 3 isn't enough to reliably distinguish STATIC (same
every time) from DYNAMIC (changes every time) fields. 6 lets the
"template method" generator reliably extract which fields are fixed and
which need algorithmic generation. See [`main/EN/PX_Reverse_Methodology_Universal.md`](../../../main/EN/PX_Reverse_Methodology_Universal.md)
§10.

---

## 2. The 11 files inside each batch — detailed

Open any batch directory (e.g. `1/`); it contains 11 files in 3 categories:

### 2.1 Raw captures (6 files, byte streams from the browser)

```
request_1.txt       POST #1 full request (URL + headers + body)
request_2.txt       POST #2 full request
request_3.txt       POST #3 full request
response_1.json     Response #1 (JSON from PX collector)
response_2.json     Response #2
response_3.json     Response #3
```

#### ⭐ Why 3 requests (not 2)?

**PX SDK fires 3 collector POSTs in one session after loading.** The URL
is the same for all three (`collector-pxo1gdta7q.px-cloud.net/api/v2/collector`);
the difference is in the POST body's `seq=` and `rsc=` params:

| File | seq / rsc | Body size | Stage | Content |
|---|---|---|---|---|
| `request_1.txt` | `seq=0` / `rsc=1` | ~2.5 KB | **EV1 — initial registration** | 14 lightweight identity fields; the goal is to receive `state.no` / `state.to` / `state.qa` etc. in the response |
| `request_2.txt` | `seq=1` / `rsc=2` | ~18 KB | **EV2 — full fingerprint** | 204-field full browser fingerprint + injected state.\* from previous step; the goal is to receive the `_px3` cookie |
| `request_3.txt` | `seq=2` / `rsc=3` | ~30-50 KB | **EV3 — behavioral tracking** | While the user lingers on the page, continuously collected mouse trajectories, performance entries, visibility changes, etc. |

**The reverse-engineering core is the first 2**:

- POST #1 → response #1 → extract `state.*`
- Inject state.* into POST #2 → response #2 → extract `_px3` cookie

POST #3 is **post-cookie behavioral telemetry**; not needed for getting
the cookie but captured here for reference.

> Batch 5's `request_3.txt` is only ~2.8 KB (vs 30-50 KB in other batches)
> because nothing happened on the page during those 20 seconds — so EV3
> collected little behavioral data. Not a missing file.

### 2.2 Decoded results (4 files — the raw captures run through the decoder)

```
decoded_payload_1.json      request_1's payload decoded → EV1 JSON (14 fields)
decoded_payload_2.json      request_2's payload decoded → EV2 JSON (~204 fields)
decoded_response_1.json     response_1.ob decoded → all state.* values
decoded_response_2.json     response_2.ob decoded → contains the _px3 cookie segment
```

**No `decoded_payload_3` / `decoded_response_3`** — because POST #3 has
nothing to do with getting the cookie, we didn't decode it. If you want
to, run `skill/AI_re/scripts/decode_payload.js` on it.

### 2.3 Batch metadata (1 file)

```
meta.json                   batch ID + UUID + constants + timestamps + response statuses
```

Example (batch 1):

```json
{
  "batch_id": 1,
  "site": "https://www.ifood.com.br/restaurantes",
  "uuid": "c83577f0-5420-11f1-9150-e1cff29e25cc",
  "tag": "U0MmDhUmOnhXSw==",
  "ft": "401",
  "app_id": "PXO1GDTa7Q",
  "captured_at": "2026-05-20T07:52:08Z",
  "collector_post_count": 3,
  "status_post_1": 200,
  "status_post_2": 200
}
```

Field meanings:

| Field | Meaning |
|---|---|
| `batch_id` | Batch number (1-6) |
| `site` | The captured page URL |
| `uuid` | UUID v1 for this session (independent per batch) |
| `tag` | PX TAG constant (used in PC computation) |
| `ft` | PX FT constant |
| `app_id` | PX customer identifier |
| `captured_at` | Capture timestamp (UTC ISO) |
| `collector_post_count` | Number of collector POSTs captured (this script always captures 3) |
| `status_post_1` / `status_post_2` | HTTP status of the first two POSTs (200 = OK) |
| `sdk_sha256` (batches 4-6 only) | SHA-256 of the SDK file (batches 1-3 didn't record this — older capture script) |

---

## 3. Common metadata (identical across all 6 batches)

| Property | Value |
|---|---|
| Capture target | `https://www.ifood.com.br/restaurantes` |
| App ID | `PXO1GDTa7Q` |
| TAG | `U0MmDhUmOnhXSw==` |
| FT | `401` |
| Cookie | `_px3` |
| SDK SHA-256 | `b47a639cde9df4f91bdc4138ae0d64ebf7ce8c876a1e4c9967fd3af3d2975eb8` |
| Capture period | 2026-05-20 07:52:08Z – 08:00:41Z UTC (9 minutes) |
| Capture tool | [`skill/cdp/scripts/capture_via_cdp_ifood.py`](../../../skill/cdp/scripts/capture_via_cdp_ifood.py) |
| Capture method | CDP attached to real Chrome — no webdriver markers |

## 4. The 6 batches at a glance

| Batch | UUID | Capture time (UTC) | sdk_sha256 field |
|---|---|---|---|
| 1 | `c83577f0-5420-11f1-9150-e1cff29e25cc` | 07:52:08 | — |
| 2 | `d71c9fa0-5420-11f1-b025-9117175cbd66` | 07:52:33 | — |
| 3 | `e5e801f0-5420-11f1-b77b-a38d8b11732d` | 07:52:58 | — |
| 4 | `dccaacc0-5421-11f1-bba4-69ba559d3bad` | 07:59:51 | ✓ `b47a639c…` |
| 5 | `eb306f70-5421-11f1-b21d-afdecf3ed7d5` | 08:00:16 | ✓ `b47a639c…` |
| 6 | `fa165ea0-5421-11f1-85cb-e97d388bd2ae` | 08:00:41 | ✓ `b47a639c…` |

> Batches 1-3's `meta.json` **lack** the `sdk_sha256` field (the capture
> script added it only at batch 4), but **the actual SDK is the same as
> batches 4-6** — PX doesn't ship a new version in 9 minutes.

---

## 5. How to use

### Inspect an EV1 (lightweight fingerprint)

```bash
jq '.[0].d | keys | length' sample/1/decoded_payload_1.json
# → 14 fields

jq '.[0].d' sample/1/decoded_payload_1.json | head -20
# Inspect specific fields
```

### Inspect an EV2 (full fingerprint)

```bash
jq '.[0].d | keys | length' sample/1/decoded_payload_2.json
# → ~204 fields
```

### Inspect state.* (session state from OB decode)

```bash
jq '.state' sample/1/decoded_response_1.json
# → { no: "1779...", to: "...", qa: "64hex...", vid: "uuid", pxsid: "uuid", appId: "...", cts: "...", jf: "cu" }
```

### Inspect the set_cookie segment (the _px3 you got)

```bash
jq '.segments[] | select(.args[0]=="_px3")' sample/1/decoded_response_2.json
# → { handler: "...", args: ["_px3", ttl, value, ...] }
```

### Diff across 6 batches (three-way field classification)

```bash
node ../../../skill/AI_re/scripts/diff_samples.js \
    sample/1/decoded_payload_2.json \
    sample/2/decoded_payload_2.json \
    sample/3/decoded_payload_2.json \
    sample/4/decoded_payload_2.json \
    sample/5/decoded_payload_2.json \
    sample/6/decoded_payload_2.json \
    > field_classes.json
# Output: { static: [...], dynamic: [...], conditional: [...] }
```

### Re-decode (validate the decoder works on the current SDK)

```bash
node ../../../skill/AI_re/scripts/decode_payload.js sample/1/request_1.txt
node ../../../skill/AI_re/scripts/decode_response.js sample/1/response_1.json U0MmDhUmOnhXSw==
```

---

## 6. Integrity checks

```bash
# 1. All 6 batches must have 11 files each
for i in 1 2 3 4 5 6; do
    n=$(ls sample/$i/ 2>/dev/null | wc -l)
    [ "$n" -eq 11 ] && echo "batch $i: OK" || echo "batch $i: $n files (BAD)"
done

# 2. All responses must be status=200
for i in 1 2 3 4 5 6; do
    jq -r '"batch \(.batch_id): post1=\(.status_post_1) post2=\(.status_post_2)"' sample/$i/meta.json
done
```

Expected output: all `batch X: OK` + `post1=200 post2=200`.

---

## 7. Companion resources

| Want to look at | Where |
|---|---|
| EV1/EV2 field semantics | [`main/EN/PX_SDK_Reverse_Engineering.md`](../../../main/EN/PX_SDK_Reverse_Engineering.md) Appendix E |
| Decoding principles + algorithms | [`main/EN/PX_Complete_SDK_Comparative_Methodology.md`](../../../main/EN/PX_Complete_SDK_Comparative_Methodology.md) |
| How to write a decoder | [`skill/AI_re/scripts/`](../../../skill/AI_re/scripts/) |
| How to capture your own 6 batches | [`skill/cdp/scripts/capture_via_cdp_ifood.py`](../../../skill/cdp/scripts/capture_via_cdp_ifood.py) |
| Cross-vendor comparison | [`main/EN/PX_Complete_SDK_Comparative_Methodology.md`](../../../main/EN/PX_Complete_SDK_Comparative_Methodology.md) §8 |

---

*Source: original `perimeter_X/samples/ifood/`, verified 2026-05-21.
All 6 batches' responses are status=200, and the decoder
[`skill/AI_re/scripts/decode_payload.js`](../../../skill/AI_re/scripts/decode_payload.js)
re-decoding pass has been validated. Chinese version: [`README.md`](README.md).*
