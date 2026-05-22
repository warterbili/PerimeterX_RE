# Grubhub-Specific Scripts

A set of **Grubhub-preconfigured** scripts — paths hardcoded, TAG hardcoded, one-line commands produce results.

## Directory Structure

```
stample/grub/
├── sample/          ← 6 batches of captured data (READMEs already there)
├── source/          ← Grubhub SDK lock (init.js + SDK_INFO.md)
├── px_cookie/       ← _px2 cookie generator
└── script/          ← This directory (8 tools + README)
```

## Script Overview

| Script | Purpose | Usage example |
|---|---|---|
| **`decode_one.sh`** | Decode one batch (all 4 payload + response files) | `./decode_one.sh 1` |
| **`decode_all.sh`** | Decode all 6 batches (one line) | `./decode_all.sh` |
| **`diff_samples.py`** | 6-batch EV field three-class classification (STATIC/DYNAMIC/CONDITIONAL) | `python diff_samples.py 2` (EV2) |
| **`diff3.js`** | 6-batch four-class (includes "common" sub-class) | `node diff3.js` |
| **`find_state_keys.py`** | ⭐⭐⭐ state.\* → EV2 b64 key value matching (Stage 5) | `python find_state_keys.py` |
| **`compare_my_ev2.py`** | My generated EV2 vs sample/1 real EV2 field-by-field | `python compare_my_ev2.py /tmp/my_ev2.json` |
| **`diff_http.py`** | My generated POST vs sample/1 real POST byte-level diff | `python diff_http.py /tmp/my_post.txt` |
| **`verify_all.sh`** | Verify 6-batch decode-loop closure (regression test) | `./verify_all.sh` |

> ⚠️ Grubhub has only 2 collector POSTs per session (iFood has 3), so
> `decode_one.sh` only decodes `request_1/2.txt` + `response_1/2.json`; no `_3`.

## Standard Usage Flow

### 1. From Zero: Decode + Field Classification (5 minutes)

```bash
cd stample/grub/script

# Step 1: decode all 6 batches
./decode_all.sh
# → each sample/{1..6}/ gets 4 decoded_*.json

# Step 2: run field three-class classification
python diff_samples.py 1          # EV1 (12 fields)
python diff_samples.py 2          # EV2 (~205 fields)
# → ../field_classes_ev1.json + ../field_classes_ev2.json

# Step 3: locate state.* injection positions (critical)
python find_state_keys.py
# → ../state_key_map.json
# Expected (completely different from iFood):
#   state.no    → UT0ndxdcJUQ=   6/6 ✓
#   state.to    → UBxmVhZ+Z2U=   6/6 ✓
#   state.appId → CXV/P0wRfwU=   6/6 ✓
```

### 2. After Writing Generator: Verify It (10 minutes)

```bash
# Save your generator's output as my_post.txt + my_ev2.json, then:

# Compare against real POST
python diff_http.py /path/to/my_post2.txt
# → ❌🤖 user-agent I'm missing / ❌🌐 I have extra cs field / payload_len differs by 24 bytes

# Compare EV2 field-by-field
python compare_my_ev2.py /path/to/my_ev2.json
# → ⚠️ UT0ndxdcJUQ= value mismatch (mine='1779...' real=1779...)
#   ☝️ Typical string vs number — should parseInt

# Run full 6-batch decode regression
./verify_all.sh
```

### 3. Debugging When `_px2` Doesn't Arrive

```bash
# Flow chart:
#
# collector returns 200 but do:null and _px2 never arrives
#         ↓
# python compare_my_ev2.py /tmp/my_ev2.json
#         ↓
# Look at which ⚠️ field is wrong → fix generator
#         ↓
# Re-generate → python diff_http.py /tmp/my_post2.txt
#         ↓
# All ✓ → should obtain cookie now
```

## Grubhub Constants (Hardcoded in Scripts; Listed Here for Reference)

| Constant | Value |
|---|---|
| AppID | `PXO97ybH4J` |
| TAG | `FmYgK1gdJEAP` |
| FT | `359` |
| Cookie | `_px2` (ttl 500) |
| Collector | `sensor.grubhub.com/O97ybH4J/xhr/api/v2/collector` |
| SDK SHA | `5e81bffc53ba95808ae81795358d8b71d3b5ba9ebfdaa013ff65ecafa278aad1` |
| OB wire chars | `o` + `I` (legacy) |

⚠️ Older docs wrote AppID `PXdRotaCw0` / FT `330` — both wrong.
See [`../source/SDK_INFO.md`](../source/SDK_INFO.md).

## Companion Resources

| What you want | Where |
|---|---|
| EV2 field semantics | [`../../../main/ZH/PX_SDK_逆向技术文档.md`](../../../main/ZH/PX_SDK_逆向技术文档.md) Appendix E |
| General methodology (how to use these scripts, why) | [`../../../main/ZH/PX_逆向方法论_通用版.md`](../../../main/ZH/PX_逆向方法论_通用版.md) |
| iFood equivalent scripts | [`../../ifood/script/`](../../ifood/script/) |
| Generic scripts (TAG as parameter) | [`../../../skill/AI_re/scripts/`](../../../skill/AI_re/scripts/) |
| How to recapture 6 batches | [`../../../skill/cdp/scripts/capture_via_cdp_grubhub.py`](../../../skill/cdp/scripts/capture_via_cdp_grubhub.py) |
| 19 gotchas | [`../../../skill/AI_re/references/gotchas.md`](../../../skill/AI_re/references/gotchas.md) |

---

*These scripts are distilled from Grubhub 2026-05 production reverse engineering; all Grubhub paths/constants are hardcoded.
For the generic version (TAG as parameter), see `skill/AI_re/scripts/`.*
