# Appendix A: 14 CLI Tool Quick Reference

> All CLI tools under [`../../../../skill/AI_re/scripts/`](../../../../skill/AI_re/scripts/) in this project. Grouped by Stage.
> *Source*: C/Appendix A (originally a tool handbook)

---

## Stage 1 (Capture Phase)

### A.1 `capture_via_cdp_ifood.py` — Auto-capture N batches

```bash
python capture_via_cdp_ifood.py --batches 6 --site ifood --out ../../../stample/ifood/sample/
```

- Launches Chrome (no webdriver traces)
- New incognito window per batch → visit target site → wait 10 s, capture collector POST
- Auto-saves `request_N.txt` / `response_N.json` / `meta.json`

### A.2 `verify_batch.js` — Single-batch integrity check

```bash
node verify_batch.js samples/1/
# Expected: ✓ request_1.txt (4521 bytes)
#           ✓ response_1.json (1843 bytes)
#           ✓ request_2.txt (62718 bytes)
#           ✓ response_2.json (4319 bytes)
#           ✓ meta.json (UUID + ts present)
```

### A.3 `verify_all.sh` — Check all 6 batches

```bash
./verify_all.sh
# Output: 6/6 pass ✓
```

---

## Stage 2 (Decode Phase)

### A.4 `decode_payload.js` — Restore `payload=` to JSON

```bash
node decode_payload.js samples/1/request_1.txt > samples/1/decoded_payload_1.json
```

Arguments:
- `--tag <TAG>` explicitly supply TAG (default: extracted from URL)
- `--xor-key <N>` explicitly supply XOR key (default: `parseInt(ml(TAG)) % 128`)

### A.5 `decode_response.js` — Restore OB response

```bash
node decode_response.js samples/1/response_1.json > samples/1/decoded_response_1.json
```

Output contains:
- 7 `state.*` fields
- `_px3 cookie segment` (if present)
- All 27 handler segments

### A.6 `decode_one.sh` — Decode all 4 files of one batch

```bash
./decode_one.sh 1
# Equivalent to 4 decode_* invocations
```

### A.7 `decode_all.sh` — Decode all 6 batches

```bash
./decode_all.sh
# Decodes samples/{1..6}/*.txt → samples/{1..6}/decoded_*.json
```

---

## Stage 3 (Classification Phase)

### A.8 `diff_samples.py` — Cross-batch three-class classification

```bash
python diff_samples.py 2     # EV2
python diff_samples.py 1     # EV1
# Output: STATIC/DYNAMIC/CONDITIONAL ratio + field_classes_ev{N}.json
```

Arguments:
- `--samples-dir <path>` samples directory (default ../sample/)
- `--out <path>` output JSON path

---

## Stage 4 (Semantic Location Phase)

### A.9 `extract_hQ.js` — Extract lookup-function mapping

```bash
node extract_hQ.js ../source/main.min.js > ../px_cookie/hQ_map.json
# Output: 1000+ index → string mappings
```

### A.10 `lookup_keys.js` — Reverse-lookup b64 key → SDK context

```bash
node lookup_keys.js RTEwewNQMUg= ../source/main.min.js ../px_cookie/hQ_map.json
# Output: Found hQ(212) = "RTEwewNQMUg=" → context at SDK line 35621
```

### A.11 `probe_dynamic.js` — Batch-probe all DYNAMIC fields

```bash
node probe_dynamic.js \
    ../field_classes_ev2.json \
    ../px_cookie/hQ_map.json \
    ../source/main.min.js > dynamic_locations.txt
# Output: SDK assignment context for each DYNAMIC field
```

---

## Stage 5 (Value-Matching Phase)

### A.12 `find_state_keys.py` — state.* → EV2 b64 key mapping

```bash
python find_state_keys.py
# Output: state_key_map.json with 7-field mapping
```

---

## Stage 6/7 (Implement + Validate Phase)

### A.13 `<site>_px3.js` — End-to-end generator

```bash
node ../px_cookie/ifood_px3.js
# Output: _px3=<long base64> ✓
```

Arguments (env vars):
- `USER_AGENT` — custom UA
- `HTTP_PROXY` — proxy
- `DEBUG=1` — enable debug logs

### A.14 `smoke_test.js` — Generator ↔ SDK constant-sync check

```bash
node smoke_test.js
# Validates each generator's constants (AppID/TAG/FT) match source/SDK_INFO.md; prints N/N ✓
```

Per-site (`stample/<site>/px_cookie/smoke_test.js`). Run after an SDK bump to confirm the
generator, SDK_INFO.md, and captured SDK all agree. For end-to-end stability, loop the generator.

---

## Cross-Stage Tools

### `bug_log.py` — Query the gotcha database

```bash
python bug_log.py "PC mismatch"
# Output: relevant entries from bug_report/1_collector_path.md (#5, #14, #22)
```

### `golden_test.js` — Algorithm-layer test suite

```bash
node golden_test.js
# Runs 100 test vectors; output: 100/100 ✓
```

---

## Tool Dependency Graph

```
verify_all
├── verify_batch (per batch)
    └── Check file presence + meta.json

decode_all
├── decode_one (per batch)
    ├── decode_payload (request_1/2)
    └── decode_response (response_1/2)

diff_samples
└── Input: samples/{1..6}/decoded_*.json
└── Output: field_classes_ev{1,2}.json

extract_hQ
└── Input: source/main.min.js
└── Output: hQ_map.json

probe_dynamic
├── Input: field_classes_ev2.json
├── Input: hQ_map.json
└── Input: source/main.min.js

find_state_keys
├── Input: samples/{1..6}/decoded_*.json
├── Input: state_key_map_lookup.json (optional)
└── Output: state_key_map.json

<site>_px3.js
├── Input: ev2_template.json
├── Input: state_key_map.json
├── Input: 9 revers/ modules
└── Output: _px3 cookie
```

---

## Tool Source Locations

Implementations of each tool: [`../../../../skill/AI_re/scripts/`](../../../../skill/AI_re/scripts/).

Next section: [Appendix B: Key Algorithm Pseudocode](B_algorithms.md).
