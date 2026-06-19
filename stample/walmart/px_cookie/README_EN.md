# Walmart `_px3` Cookie Generator

Pure-math `_px3` cookie generator for Walmart. **PX lenient-tier deployment case.**

> ⚠️ **Multi-vendor site.** Walmart's primary defense is **Akamai Bot Manager**;
> PerimeterX is the **secondary** layer. This directory reverses **only the PX layer**,
> producing a `_px3` accepted by the PX collector (200 + cookie issued). A `_px3` alone
> does **not** pass Walmart business APIs — Akamai (`_abck`/`bm_sv` sensor) is the
> enforcing gate, out of this skill's scope, and this research does not bypass it.
>
> 🎯 Research purpose + why no end-to-end → [`../RESEARCH_PURPOSE_EN.md`](../RESEARCH_PURPOSE_EN.md) ·
> SDK snapshot / constants / field maps → [`../source/SDK_INFO_EN.md`](../source/SDK_INFO_EN.md)

## Layout

```
px_cookie/
├── README.md / README_EN.md
├── smoke_test.js                ⭐ one-shot self-check (require + constants + templates + cross-event, 15 checks)
├── walmart_px3.js               ⭐ main generator (2-POST, seq=0/1)
├── walmart_ev1_template.json    (EV1, 12 fields)
├── walmart_ev2_template.json    (EV2, 207 fields)
├── walmart_ev1_field_map.json   (field classes: STATIC/DYNAMIC/PARTIAL/CONDITIONAL)
├── walmart_ev2_field_map.json
└── state_key_map.json           (state.* → EV2 b64 key cross-batch match)
```

## Constants (tag/ft/bi fetched from the SDK at runtime; AppID stable)

| Field | Value | Source |
|---|---|---|
| AppID | `PXu6b0qd2S` | live capture POST body (stable) |
| TAG | `eW5CaD8AUB99Zg==` | SDK at runtime (rotates; fallback baked in) |
| FT | `396` | SDK at runtime (rotates) |
| Cookie | `_px3` (hex format, ttl 330) | decoded ob#2 |
| Collector | `https://collector-pxu6b0qd2s.px-cloud.net/api/v2/collector` | third-party |
| OB XOR key | `41` = `ml(TAG) % 128` | measured |
| EV1 / EV2 event type | `eW5CLzwARxg=` / `bRJWEyt5UyE=` | decoded payload `t` |

## Deployment tier: **LENIENT**

| Item | Walmart (`_px3`) |
|---|---|
| Collector POSTs | **2** (seq=0 / seq=1, no EV3 beacon) |
| Collector | third-party `*.px-cloud.net` |
| PX12xxx counter dict | **none** (only strict-tier totalwine has one) |
| Press-challenge bundle | 6/6 captures `bundle_post_count=0` (fully sensorless) |

## state.* → EV2 b64 key map (6/6 measured)

| state field | EV2 key | injection rule |
|---|---|---|
| `state.no` | `HwRkBVluazY=` | `parseInt(state.no)` ⚠️ Gotcha #1 |
| `state.to` | `UBdrVhZ+Z2U=` | string |
| `state.eo` | `EFcrFlU9JSQ=` | string |
| `state.appId` | `LDNXMmlcWgg=` | string |
| `state.vid` | `GmEhYFwIKVQ=`(HMAC) / `CzBwcU5bfEI=`(MD5) | feeds HMAC/MD5 input |
| `state.pxsid` | `MklJCHQkQjs=`(HMAC) | feeds HMAC input |
| `state.qa/cts/vid` | POST form params `cs=`/`cts=`/`vid=` | not in EV2 payload |

## HMAC/MD5 fields (6/6 measured — do not copy from other sites)

```
OkFBAHwnTTY=  = HMAC-MD5(uuid,        UA)
GmEhYFwIKVQ=  = HMAC-MD5(state.vid,   UA)
MklJCHQkQjs=  = HMAC-MD5(state.pxsid, UA)
CzBwcU5bfEI=  = MD5(state.vid)            ⭐ single arg, not HMAC
```

## Cross-event consistency (⭐ added with the updated skill — `cross_event_consistency.py`)

The generator ties all session timing to a single page-load epoch `t0`, so the EV1↔EV2
invariants hold:

- **CONSTANT** (EV1 == EV2): `ajERMCxcFQc=` (= t0), `HUJmQ1soY3c=` (uuid)
- **MONOTONIC** (EV2 ≥ EV1): `Ahk5WERyM2o=`, `U0goSRYkLHs=`, `SlFxEA86eyc=`
- **VARY**: `AEc7BkUsMTA=` (standard base64, length 500-512)

See [`../source/SDK_INFO_EN.md`](../source/SDK_INFO_EN.md) for the full cross-event table.

## Usage

```bash
cd stample/walmart/px_cookie

# 1) static self-check (no network, 15 checks)
node smoke_test.js

# 2) generate _px3 (direct to third-party collector; needs a US egress IP)
node walmart_px3.js
# → ✅ _px3=a2426f96…  ttl=330  ev1=12 ev2=207

# 3) as a module
node -e "require('./walmart_px3')().then(r=>console.log(r.cookie_name,'=',r.cookie_value.slice(0,40)))"
```

### Debug: dump EV1/EV2 and diff field-by-field vs a real capture

```bash
PX_DUMP="C:/path/to/dump" node walmart_px3.js          # writes mine_ev1.json / mine_ev2.json
python ../../../skill/AI_re/scripts/diff_ev_field_by_field.py \
    mine_ev2.json ../sample/1/decoded_payload_2.json override.txt
python ../../../skill/AI_re/scripts/cross_event_consistency.py ../sample
```

## Validation criteria

| Layer | Pass criterion | Status |
|---|---|---|
| 1 | `node smoke_test.js` all pass (offline) | **15/15** ✅ |
| 2 | 6 sample batches round-trip closure (`script/decode_all.js`) | ✅ |
| 3 | `node walmart_px3.js` 10× distinct `_px3` | **10/10** ✅ |
| 3.5 | business API 200 | ⛔ not attempted (Akamai is the gate, out of scope) |

PX-success differential (why "200" is not the success signal):
[`../script/px_success_proof.js`](../script/px_success_proof.js).
