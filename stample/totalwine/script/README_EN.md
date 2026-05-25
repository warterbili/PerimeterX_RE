# Total Wine PX Analysis Scripts

8 scripts covering the full pipeline: **capture → decode → template build → strict-tier diagnostics → e2e validation**.

⚠️ 3 more scripts than iFood/Grub (strict-tier-only diagnostic tools): `diff_ev2_ours_vs_real.py`, `find_hmac_inputs.py`, `smoke_10x_e2e.py`.

---

## Script overview (workflow order)

### Stage 1 — Capture

| Script | Usage |
|---|---|
| **`capture_via_cdp_totalwine.py`** | Automatic 6-batch cold-visit capture (CDP + real Chrome). Env vars `PROXY_HOST/PORT/USER/PASS` for residential proxy |

```bash
python capture_via_cdp_totalwine.py 6
# Output: ../sample/1..6/ — 11 files × 6 batches
```

### Stage 2 — Decode

| Script | Usage |
|---|---|
| **`decode_all.js`** | Decode all 6 batches' requests/responses to JSON |

```bash
node decode_all.js
# Output: ../sample/N/decoded_payload_{1,2,3}.json + decoded_response_{1,2,3}.json
```

### Stage 3 — Field classification + state.* mapping

| Script | Usage |
|---|---|
| **`build_templates.js`** | Cross 6-batch STATIC/DYNAMIC/PARTIAL/CONDITIONAL classification, outputs templates + field_map |
| **`find_state_keys.js`** | Cross 6-batch value-matching to find state.* → EV2 b64 key (Gotcha #11) |

```bash
node build_templates.js
# Output: ../px_cookie/totalwine_ev{1,2,3}_template.json + ..._field_map.json

node find_state_keys.js
# Output: ../px_cookie/state_key_map.json
```

### Stage 4 ⭐ — Strict-tier-only diagnostics (NEW vs iFood/Grub)

After writing a generator, if cookie issues OK but Layer 3.5 fails, use these 3:

| Script | Usage |
|---|---|
| **`diff_ev2_ours_vs_real.py`** | 6-section diagnostic: field-set / type / STATIC values / order / anti-tamper / counter sync |
| **`find_hmac_inputs.py`** | grep SDK to locate the real input function for 4 HMAC/MD5 fields |
| **`smoke_10x_e2e.py`** | Layer 3.5 — 10 independent sessions hitting PX-gated SRP, require 10/10 of 1.3 MB real HTML |

```bash
# 1. Let generator dump EV1/2/3 to JSON
DUMP_EV_DIR=../sample/_our_ev node ../px_cookie/totalwine_px2.js

# 2. Run diagnostic
python diff_ev2_ours_vs_real.py

# 3. If HMAC fields mismatch, locate SDK input
python find_hmac_inputs.py

# 4. Layer 3.5 end-to-end validation
$env:HTTPS_PROXY = 'http://<user>-session-<id>:<pwd>@<host>:<port>'
python smoke_10x_e2e.py
```

---

## Relationship to skill's generic tools

The 3 strict-tier-only scripts here are **generalized into the skill**:

| Site-specific (totalwine instance) | Skill generic (reusable for other strict-tier sites) |
|---|---|
| `diff_ev2_ours_vs_real.py` | [`skill/AI_re/scripts/diff_ev_ours_vs_real.py`](../../../skill/AI_re/scripts/diff_ev_ours_vs_real.py) |
| `find_hmac_inputs.py` | [`skill/AI_re/scripts/find_hmac_field_sources.py`](../../../skill/AI_re/scripts/find_hmac_field_sources.py) |
| `smoke_10x_e2e.py` (Total Wine site config baked in) | [`skill/AI_re/scripts/replay_apples_to_apples.py`](../../../skill/AI_re/scripts/replay_apples_to_apples.py) |

The skill versions are env-var-parameterized and **work for any strict-tier new site**. This directory is the concrete Total Wine instance.

---

## Full diagnostic flowchart

```
            Cookie issuance OK but Layer 3.5 fails
                          │
                          ▼
        ┌───────────────────────────────────┐
        │ 1. DUMP_EV_DIR=… node generator   │  → ../sample/_our_ev/
        └─────────────────┬─────────────────┘
                          ▼
        ┌───────────────────────────────────┐
        │ 2. diff_ev2_ours_vs_real.py       │
        │                                    │
        │   field-set ≠ 0?  → Gotcha #12     │
        │   type ≠ 0?       → Gotcha #1/#10  │
        │   STATIC ≠ 0?     → template bake  │
        │   counter ≠ sync? → Gotcha #17     │
        └─────────────────┬─────────────────┘
                          ▼ HMAC field values wrong
        ┌───────────────────────────────────┐
        │ 3. find_hmac_inputs.py            │
        │   → See jm(X, Y) X in SDK         │
        │   → 6-batch crypto verify candidates│
        │   → Update generator HMAC formula │
        └─────────────────┬─────────────────┘
                          ▼
        ┌───────────────────────────────────┐
        │ 4. smoke_10x_e2e.py               │
        │   → 10/10 retrieve 1.3 MB real HTML│
        └───────────────────────────────────┘
```

Complete methodology: [`skill/AI_re/playbooks/validate-generator.md`](../../../skill/AI_re/playbooks/validate-generator.md) Layer 3.5 section.
