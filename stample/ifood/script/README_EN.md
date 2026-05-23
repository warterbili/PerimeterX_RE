# iFood-Specific Scripts

A set of **iFood-preconfigured** scripts — paths hardcoded, TAG hardcoded, one-line commands produce results.

## Directory Structure

```
stample/ifood/
├── sample/          ← 6 batches of captured data (READMEs already there)
├── source/          ← iFood SDK lock (if any)
└── script/          ← This directory (7 tools + README)
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

## Standard Usage Flow

### 1. From Zero: Decode + Field Classification (5 minutes)

```bash
cd stample/ifood/script

# Step 1: decode all 6 batches
./decode_all.sh
# → each sample/{1..6}/ gets 4 decoded_*.json

# Step 2: run field three-class classification
python diff_samples.py 1          # EV1 (14 fields)
python diff_samples.py 2          # EV2 (~204 fields)
# → ../field_classes_ev1.json + ../field_classes_ev2.json

# Step 3: locate state.* injection positions (critical)
python find_state_keys.py
# → ../state_key_map.json
```

### 2. After Writing Generator: Verify It (10 minutes)

```bash
# Save your generator's output as my_post.txt + my_ev2.json, then:

# Compare against real POST
python diff_http.py /path/to/my_post2.txt
# → ❌🤖 user-agent I'm missing / ❌🌐 I have extra cs field / payload_len differs by 24 bytes

# Compare EV2 field-by-field
python compare_my_ev2.py /path/to/my_ev2.json
# → ⚠️ RTEwewNQMUg= value mismatch (mine='1779...' real=1779...)
#   ☝️ Typical string vs number — should parseInt

# Run full 6-batch decode regression to confirm I didn't break the decoder
./verify_all.sh
```

### 3. Debugging When `_px3` Doesn't Arrive

```bash
# Flow chart:
#
# collector returns 200 but do:null and _px3 never arrives
#         ↓
# python compare_my_ev2.py /tmp/my_ev2.json
#         ↓
# Look at which ⚠️ field is wrong → fix generator
#         ↓
# Re-generate → python diff_http.py /tmp/my_post2.txt
#         ↓
# All ✓ → should obtain cookie now
```

## iFood Constants (Hardcoded in Scripts; Listed Here for Reference)

| Constant | Value |
|---|---|
| AppID | `PXO1GDTa7Q` |
| TAG | `U0MmDhUmOnhXSw==` |
| FT | `401` |
| Cookie | `_px3` (ttl 330) |
| Collector | `collector-pxo1gdta7q.px-cloud.net/api/v2/collector` |
| SDK SHA | `e042d5de834333985610691dbd6e435ca61a744e6a17271e4bbb4c21706a754e` |

## Companion Resources

| What you want | Where |
|---|---|
| EV2 field semantics | [`../../../main/ZH/PX_SDK_逆向技术文档.md`](../../../main/ZH/PX_SDK_逆向技术文档.md) Appendix E |
| General methodology (how to use these scripts, why) | [`../../../main/ZH/PX_逆向方法论_通用版.md`](../../../main/ZH/PX_逆向方法论_通用版.md) |
| Generic scripts (TAG as parameter) | [`../../../skill/AI_re/scripts/`](../../../skill/AI_re/scripts/) |
| How to recapture 6 batches | [`../../../skill/cdp/scripts/capture_via_cdp_ifood.py`](../../../skill/cdp/scripts/capture_via_cdp_ifood.py) |
| 19 gotchas | [`../../../skill/AI_re/references/gotchas.md`](../../../skill/AI_re/references/gotchas.md) |

---

*These scripts are distilled from iFood 2026-05 production reverse engineering; all iFood paths/constants are hardcoded.
For the generic version (TAG as parameter), see `skill/AI_re/scripts/`.*
