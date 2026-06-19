# Walmart — PX SDK Snapshot (2026-06-19, re-run w/ updated skill)

> ⚠️ **Multi-vendor site.** Walmart runs **Akamai Bot Manager (primary)** +
> **PerimeterX (secondary)**. This workspace reverses ONLY the PX layer.
> A `_px3` cookie alone does NOT pass Walmart business APIs — Akamai
> (`_abck`/`bm_sv` sensor) is the dominant gate and is out of this skill's scope.

| Property | Value |
|---|---|
| SDK file | `main.min.js` (raw, current) + `init.js` (beautified reference) |
| SDK URL | https://www.walmart.com/px/PXu6b0qd2S/init.js (first-party) |
| Bootstrap URL | https://client.px-cloud.net/PXu6b0qd2S/main.min.js |
| SDK SHA | `94d67d51…` (332 165 B) — rotates per delivery (prior `3b252022…`) |
| Captured | 2026-06-19 via cdp-browser (6 fresh batches, all 2×200) |

## Constants (cluster `g[uvwxy]=`; tag/ft/bi rotate → fetched at runtime)
| Constant | Value |
|---|---|
| AppID | `PXu6b0qd2S` (stable) |
| TAG | `eW5CaD8AUB99Zg==` |
| FT | `396` |
| BI | `Rl19VhNhNHcAAhNzXwpPdUd/YRFXUzxySkpqG30b…` (= SDK `gy`) |
| Cookie | `_px3` (ttl 330, hex format) |
| Collector | `https://collector-pxu6b0qd2s.px-cloud.net/api/v2/collector` (third-party) |
| OB XOR key | `41` = `ml("eW5CaD8AUB99Zg==") % 128` (live tag) |
| EV1 event type | `eW5CLzwARxg=` |
| EV2 event type | `bRJWEyt5UyE=` |

## Deployment tier: **LENIENT**
- 2 collector POSTs (seq=0, seq=1), no EV3 beacon
- Third-party collector (`*.px-cloud.net`)
- **No PX12xxx counter dict** (totalwine has one; Walmart does not)
- 5-point PX fingerprint: 4/5 (F@bt split as usual)

## Verified field mappings (6/6 fresh batches)
| Field | Key |
|---|---|
| state.no (parseInt) | `HwRkBVluazY=` |
| state.to | `UBdrVhZ+Z2U=` |
| state.eo | `EFcrFlU9JSQ=` |
| state.appId | `LDNXMmlcWgg=` |
| HMAC-MD5(uuid, UA) | `OkFBAHwnTTY=` |
| HMAC-MD5(vid, UA) | `GmEhYFwIKVQ=` |
| HMAC-MD5(pxsid, UA) | `MklJCHQkQjs=` |
| MD5(vid) | `CzBwcU5bfEI=` |

## Anti-tamper (EV2)
One AT slot. key = `te(val, 1)` (uniform XOR-1). `val` is a per-session 20-char
string in charset `[0x30-0x3f]` with **no derivable relation to wire-state**
(unlike totalwine's `te(state.to, no%10+1)`). Generator randomizes val in-charset
and relocates it in-place (Gotcha #3). Lenient server accepts (validated 10/10).

## Cross-event invariants (NEW — `cross_event_consistency.py`, 6/6)
The updated skill re-derived EV1↔EV2 coupling; the generator now ties all session
timing to a single page-load epoch `t0`:

| Key | Rule | Generator |
|---|---|---|
| `ajERMCxcFQc=` | CONSTANT (page-load epoch) | `t0` in both events |
| `HUJmQ1soY3c=` | CONSTANT (uuid) | same uuid both events |
| `Ahk5WERyM2o=` | MONOTONIC (EV2 ≥ EV1) | `e1perf → e1perf+500..900` |
| `U0goSRYkLHs=` | MONOTONIC | `e1now → t0+1900..2300` |
| `SlFxEA86eyc=` | MONOTONIC (float) | `0 → 620+rand*45` |
| `AEc7BkUsMTA=` | VARY (std-base64, len 500-512) | `randomBytes(375..384)→b64` |

`diff_ev_field_by_field.py`: **0 STATIC mismatch, 0 TYPE mismatch** (187/207 identical;
only the per-session AT slot + the 20 documented DYNAMIC fields differ, as expected).

## Validation (2026-06-19)
- `node px_cookie/smoke_test.js` → **15/15** static checks pass.
- `node px_cookie/walmart_px3.js` → collector#1/#2 both 200, `_px3` issued.
- `verify_batch.js` on 6 batches → **6/6 round-trip clean**.
- 10× loop → **_px3 issued 10/10**, all unique (Layer 3, PX layer).
- ⛔ Layer 3.5 (business API 200) intentionally NOT attempted — gated by Akamai.

## PX vs Akamai param/cookie split (for reference)
- **PerimeterX**: collector POST params `payload, appId, tag, uuid, ft, seq, en,
  bi, cs, pc, sid, vid, pxhd, cts, rsc`; cookies `_px3, pxcts, _pxhd, _pxvid,
  _pxde`; hosts `collector-*.px-cloud.net`, `tzm.px-cloud.net/ns`, `/px/*/init.js`.
- **Akamai**: `/akam/13/*` (bmak script), POST `sensor_data`; cookies `_abck,
  bm_sv, ak_bmsc, akavpau_*, TS*`.
- Empirically: the gated JSON API (`/orchestra/.../graphql`) returns **418
  Access Denied** with or without valid PX cookies → the gate is Akamai's
  `_abck`, not PX. Walmart's PX is a passive, non-enforcing scoring layer
  (page-level injection of a garbage `_px3` still yields `do:null`, no captcha).
- The achievable PX proof here is the **collector-level differential**: a
  correct payload returns a full OB state chain + issues a cookie, whereas a
  garbage payload returns an empty `{"do":[]}` — i.e. PX genuinely decodes and
  accepts our synthetic sensor data.
