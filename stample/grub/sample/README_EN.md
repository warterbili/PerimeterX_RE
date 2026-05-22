# Grubhub PX Capture Samples

6 batches of real PerimeterX collector POST + response + decoded results
captured from grubhub.com.

---

## 1. Directory layout at a glance

```
sample/
├── README.md              Chinese version
├── README_EN.md           This file
├── 1/                     Batch 1 (9 files)
├── 2/                     Batch 2
├── 3/                     Batch 3
├── 4/                     Batch 4
├── 5/                     Batch 5
└── 6/                     Batch 6
```

**`1/` through `6/` are 6 independent capture batches** — 6 fresh
sessions, each with a brand-new Chrome profile (no cookies, no cache,
new UUID), opening grubhub.com, waiting 20s, and recording every
collector POST PX SDK fires.

**Why 6 batches**: 3 isn't enough to reliably distinguish STATIC (same
every time) from DYNAMIC (changes every time) fields. 6 lets the
"template method" generator reliably extract which fields are fixed and
which need algorithmic generation. See
[`main/EN/PX_Reverse_Methodology_Universal.md`](../../../main/EN/PX_Reverse_Methodology_Universal.md) §10.

---

## 2. The 9 files inside each batch — detailed

Open any batch directory (e.g. `1/`); it contains 9 files in 3 categories:

### 2.1 Raw captures (4 files, byte streams from the browser)

```
request_1.txt       POST #1 full request (URL + headers + body)
request_2.txt       POST #2 full request
response_1.json     Response #1 (JSON from PX collector)
response_2.json     Response #2
```

#### ⭐ Why 2 requests (iFood has 3)?

**Grubhub's PX SDK fires only 2 collector POSTs per session on the
homepage** (iFood's restaurants page fires 3 — the extra one is EV3
behavior tracking). Both Grubhub POSTs hit
`sensor.grubhub.com/O97ybH4J/xhr/api/v2/collector`, distinguished by
`seq=` and `rsc=` in the body:

| File | seq / rsc | body size | Phase | Contents |
|---|---|---|---|---|
| `request_1.txt` | `seq=0` / `rsc=1` | ~1.0 KB | **EV1 — initial registration** | 12-field lightweight identity; goal is for the PX server to hand back `state.no` / `state.to` / `state.qa` etc. in the response |
| `request_2.txt` | `seq=1` / `rsc=2` | ~9.4 KB | **EV2 — full fingerprint** | 205-field full browser fingerprint + injected `state.*` from the previous step; goal is to obtain the `_px2` cookie |

**Reverse flow**:

- POST #1 → response #1 yields `state.*`
- Inject `state.*` into POST #2 → response #2 returns the `_px2` cookie

> ⚠️ **Diff vs iFood**: iFood gets `_px3` (TTL 330s), Grubhub gets `_px2`
> (TTL 500s). The cookie name + TTL is site-level config, not an SDK
> version difference.

### 2.2 Decoded results (4 files, raw captures decoded with the algorithm chain)

```
decoded_payload_1.json      request_1 payload decoded → EV1 JSON (12 fields)
decoded_payload_2.json      request_2 payload decoded → EV2 JSON (~205 fields)
decoded_response_1.json     response_1.ob decoded → all of state.*
decoded_response_2.json     response_2.ob decoded → includes the _px2 cookie segment
```

### 2.3 Batch metadata (1 file)

```
meta.json                   batch ID + UUID + constants + timestamp + response status
```

Example (batch 1):

```json
{
  "batch_id": 1,
  "site": "https://www.grubhub.com/",
  "uuid": "3998c310-5422-11f1-931f-79511c482128",
  "tag": "FmYgK1gdJEAP",
  "ft": "359",
  "app_id": "PXO97ybH4J",
  "captured_at": "2026-05-20T08:02:24Z",
  "collector_post_count": 2,
  "status_post_1": 200,
  "status_post_2": 200
}
```

Field meanings:

| Field | Meaning |
|---|---|
| `batch_id` | Batch number (1-6) |
| `site` | Capture target page URL |
| `uuid` | UUID v1 for this session (regenerated per batch) |
| `tag` | PX constant TAG (used by PC verification) |
| `ft` | PX constant FT |
| `app_id` | PX customer ID (**`PXO97ybH4J`** — corrected from the obsolete `PXdRotaCw0` in older docs) |
| `captured_at` | Capture time (UTC ISO) |
| `collector_post_count` | Number of collector POSTs captured (Grubhub always 2) |
| `status_post_1` / `status_post_2` | HTTP status of the two POSTs (200 = success) |

> ⚠️ All 6 `meta.json` files **lack the** `sdk_sha256` **field** (the
> capture script of that vintage didn't record it), but the 6 batches
> are within the same 9-minute window and share one SDK. See the
> SHA-256 in the common-metadata table below.

---

## 3. Common metadata (identical across all 6 batches)

| Property | Value |
|---|---|
| Capture target | `https://www.grubhub.com/` |
| App ID | **`PXO97ybH4J`** |
| TAG | `FmYgK1gdJEAP` |
| FT | `359` |
| Cookie | `_px2` (TTL 500s) |
| Collector URL | `https://sensor.grubhub.com/O97ybH4J/xhr/api/v2/collector` |
| EV1 event type | `YjIUOCdXHA8=` |
| EV2 event type | `ViZgLBBGaB4=` |
| SDK SHA-256 | `5e81bffc53ba95808ae81795358d8b71d3b5ba9ebfdaa013ff65ecafa278aad1` |
| SDK size | ~263.7 KB |
| SDK source URL | `https://sensor.grubhub.com/O97ybH4J/init.js` (note: not `main.min.js`) |
| Capture window | 2026-05-20 08:02:24Z ~ 08:04:35Z UTC (2 minutes) |
| Capture tool | [`skill/cdp/scripts/capture_via_cdp_grubhub.py`](../../../skill/cdp/scripts/capture_via_cdp_grubhub.py) |
| Capture method | CDP attached to real Chrome, no webdriver markers |

> ⚠️ **Older docs wrote AppID as `PXdRotaCw0` / FT as `330`** — both
> wrong. `PXdRotaCw0` is an earlier, different Grubhub PX project; the
> live production app is `PXO97ybH4J`. The values here are extracted
> directly from these 6 real POST bodies.

## 4. 6 batch UUIDs + timestamps

| Batch | UUID | Captured (UTC) |
|---|---|---|
| 1 | `3998c310-5422-11f1-931f-79511c482128` | 08:02:24 |
| 2 | `49810710-5422-11f1-8549-2d1696bebe37` | 08:02:50 |
| 3 | `57294620-5422-11f1-9c97-a7b3d175e3e3` | 08:03:15 |
| 4 | `6a3fbfa0-5422-11f1-bf15-cd6c1ad15185` | 08:03:45 |
| 5 | `7a06c000-5422-11f1-b4df-f773790aef2d` | 08:04:10 |
| 6 | `87cb60b0-5422-11f1-8b96-816dc76da612` | 08:04:35 |

---

## 5. ⚠️ Grubhub vs iFood — key differences

Both sites run the same PX SDK family, but wire characters, field keys,
and cookies all differ. **Generator code must be maintained as two
separate codepaths.**

| Dimension | iFood | Grubhub |
|---|---|---|
| AppID | `PXO1GDTa7Q` | `PXO97ybH4J` |
| Cookie | `_px3` (TTL 330) | `_px2` (TTL 500) |
| Collector URL | `collector-pxo1gdta7q.px-cloud.net/api/v2/collector` | `sensor.grubhub.com/O97ybH4J/xhr/api/v2/collector` |
| SDK filename | `main.min.js` | `init.js` |
| POSTs per session | 3 (incl. EV3) | 2 |
| EV1 fields | 14 | 12 |
| EV2 fields | ~204 | ~205 |
| OB wire chars | `0` and `l` (newer) | `o` and `I` (legacy) |
| `state.no` key in EV2 | `RTEwewNQMUg=` | `UT0ndxdcJUQ=` |
| `state.to` key in EV2 | `FCAhKlJCIxk=` | `UBxmVhZ+Z2U=` |
| `state.no` type | `parseInt(state.no)` ⭐ | `parseInt(state.no)` ⭐ |

> Matching by OB handler name (`oIIoIIIo` etc.) is **not** version-safe —
> **match by argument shape**. See
> [`skill/AI_re/references/handler-table.md`](../../../skill/AI_re/references/handler-table.md).

---

## 6. How to use

### View an EV1 (lightweight fingerprint)

```bash
jq '.[0].d | keys | length' sample/1/decoded_payload_1.json
# → 12 fields

jq '.[0].d' sample/1/decoded_payload_1.json | head -20
```

### View an EV2 (full fingerprint)

```bash
jq '.[0].d | keys | length' sample/1/decoded_payload_2.json
# → ~205 fields
```

### View state.* (session state decoded from OB)

```bash
jq '.segments' sample/1/decoded_response_1.json
# → 12 segments: state.no / state.to / state.qa / state.vid / state.pxsid / state.appId / state.cts / state.jf
```

### View the set_cookie segment (the issued _px2)

```bash
jq '.segments[] | select(.args[0]=="_px2")' sample/1/decoded_response_2.json
# → { handler: "...", args: ["_px2", ttl, value, ...] }
```

### Cross-batch diff (field 3-way classification)

```bash
node ../../../skill/AI_re/scripts/diff_samples.js \
    sample/1/decoded_payload_2.json \
    sample/2/decoded_payload_2.json \
    sample/3/decoded_payload_2.json \
    sample/4/decoded_payload_2.json \
    sample/5/decoded_payload_2.json \
    sample/6/decoded_payload_2.json \
    > field_classes.json
```

### Re-decode (verify the decoder is still SDK-generic)

```bash
node ../../../skill/AI_re/scripts/decode_payload.js sample/1/request_1.txt
node ../../../skill/AI_re/scripts/decode_response.js sample/1/response_1.json FmYgK1gdJEAP
```

---

## 7. Integrity check

```bash
# 1. Every batch must have 9 files
for i in 1 2 3 4 5 6; do
    n=$(ls sample/$i/ 2>/dev/null | wc -l)
    [ "$n" -eq 9 ] && echo "batch $i: OK" || echo "batch $i: $n files (BAD)"
done

# 2. Every response must be status=200
for i in 1 2 3 4 5 6; do
    jq -r '"batch \(.batch_id): post1=\(.status_post_1) post2=\(.status_post_2)"' sample/$i/meta.json
done

# 3. Confirm 6 batches share one SDK via SHA-256
sha256sum ../source/init.js
# Expected: 5e81bffc53ba95808ae81795358d8b71d3b5ba9ebfdaa013ff65ecafa278aad1
```

Expected: 6 lines of `batch X: OK` + 6 lines of `post1=200 post2=200`.

---

## 8. Related resources

| Looking for | Where |
|---|---|
| EV1/EV2 field semantics | [`main/EN/PX_SDK_Reverse_Engineering.md`](../../../main/EN/PX_SDK_Reverse_Engineering.md) appendix E |
| Decoder principles + algorithms | [`main/EN/PX_Complete_SDK_Comparative_Methodology.md`](../../../main/EN/PX_Complete_SDK_Comparative_Methodology.md) |
| iFood vs Grubhub side-by-side | [`main/EN/PX_Complete_SDK_Comparative_Methodology.md`](../../../main/EN/PX_Complete_SDK_Comparative_Methodology.md) §8 |
| Writing a decoder | [`skill/AI_re/scripts/`](../../../skill/AI_re/scripts/) |
| Capturing your own 6 batches | [`skill/cdp/scripts/capture_via_cdp_grubhub.py`](../../../skill/cdp/scripts/capture_via_cdp_grubhub.py) |
| Grubhub SDK source + SDK_INFO | [`../source/`](../source/) |
| Grubhub generator | [`../script/`](../script/) |

---

*Capture source: the legacy `perimeter_X` project's Grubhub sample directory, validated
2026-05-21. All 6 batches respond with status=200 and have been
round-trip verified with
[`skill/AI_re/scripts/decode_payload.js`](../../../skill/AI_re/scripts/decode_payload.js).
Chinese version: [`README.md`](README.md).*
