# Stage 2: Decode and Algorithm-Layer Validation

> **Time budget**: 15 min fluent / 1 h first-time
> **Deliverables**: all 6 raw capture batches decoded to JSON; the 9 algorithm modules verified working
> *Merges*: C/§2 (combat) + B/02_stage2_decode (structure) + A/§3-4 (algorithm validation)

---

## Goal

Turn raw byte streams into JSON:

```
samples/1/request_1.txt  (raw POST body)
        ↓ decode_payload.js
samples/1/decoded_payload_1.json  (EV1 JSON, 14 fields)
```

After this step **you can decode any PX capture via script**, matching the PX server's parsing capability.

---

## 2.1 The 9 Algorithm Modules (Required)

The PX algorithm layer is identical across all sites. This project's [`../../../revers/`](../../../revers/) already implements them:

```
revers/
├── payload.js       XOR(50) + base64 + interleave → POST `payload=`
├── pc.js            HMAC-MD5 + digit extraction (16 chars) → POST `pc=`
├── ob.js            OB decode + 27 handler dispatch
├── sid.js           Plane-14 Unicode Variation-Selector steganography → POST `sid=`
├── uuid.js          UUID v1 (PX-compatible clockseq)
├── hash.js          djb2 variant
├── memory.js        performance.memory synthesis
├── antitamper.js    Dynamic XOR key/value
└── ns.js            /ns endpoint sync
```

**99% of the time you reuse this project's modules directly**, no rewrite. New-site reversing just verifies whether they work for the new site.

---

## 2.2 PX Custom serialize (Fatal Pitfall)

⚠️ **You must implement PX's custom serialize; you cannot use `JSON.stringify()`**. Differences:

```javascript
// PX serialize vs JSON.stringify differences:
undefined           → '"undefined"'             // Quoted! JSON.stringify drops it
NaN                 → 'null'
Infinity            → 'null'
RegExp              → 'null'
Date                → '"YYYY-M-DTHH:MM:SS.mmm"' // No zero-padding
property=undefined  → outputs '"undefined"' instead of skipping the key
```

This project's [`../../../revers/payload.js`](../../../revers/payload.js) `serialize()` already implements this.

**Why PX does this**: deliberately different from `JSON.stringify` to prevent you from copying the `JSON.stringify`-produced byte stream directly. A single character off and PC computes wrong.

---

## 2.3 Decode a Single Batch

```bash
cd ../../../stample/ifood/script/

# Decode the 4 files in batch 1 (request_1/2.txt + response_1/2.json)
./decode_one.sh 1

# Expected new outputs in samples/1/:
#   decoded_payload_1.json   ← EV1 (14 fields)
#   decoded_payload_2.json   ← EV2 (~204 fields)
#   decoded_response_1.json  ← all state.* extracted
#   decoded_response_2.json  ← _px3 cookie extracted
```

`decode_one.sh` internally calls:

```bash
node ../../../skill/AI_re/scripts/decode_payload.js samples/1/request_1.txt > samples/1/decoded_payload_1.json
node ../../../skill/AI_re/scripts/decode_response.js samples/1/response_1.json <TAG> > samples/1/decoded_response_1.json
```

---

## 2.4 Decode All 6 Batches

```bash
./decode_all.sh
# → samples/{1..6}/decoded_*.json
```

Afterwards each batch has 4 `decoded_*.json` files.

---

## 2.5 Algorithm-Layer Correctness Validation

To verify whether the decoded JSON "looks right", use 4 sanity checks:

### 2.5.1 EV1 Field Count

```bash
jq '.[0].d | keys | length' samples/1/decoded_payload_1.json
# Expected: 14 (iFood) or 12 (Grubhub)
```

If you see garbage or 0 → decoding failed; check the §2.6 troubleshooting tree.

### 2.5.2 EV2 Field Count

```bash
jq '.[0].d | keys | length' samples/1/decoded_payload_2.json
# Expected: 204 (iFood) or 200+ (Grubhub)
```

### 2.5.3 state Extraction Complete

```bash
jq '.state | keys' samples/1/decoded_response_1.json
# Expected: ["appId", "cts", "jf", "no", "pxsid", "qa", "to", "vid"]
```

If state.appId / state.no are missing → OB decoding failed; check §2.6.

### 2.5.4 _px3 Cookie Extraction

```bash
jq '.segments[] | select(.args[0] == "_px3")' samples/1/decoded_response_2.json
# Expected: { handler: "...", args: ["_px3", 330, "<long base64>", ...] }
```

---

## 2.6 Decoding Failure Tree

```
decode_payload fails / outputs garbage
   ├── Wrong XOR key (used 100 but actual is 91)
   │   └── Recompute: parseInt(ml(<TAG>)) % 128
   ├── UTF-8 vs Latin-1
   │   └── base64 encoding must be UTF-8, never 'latin1' / 'binary'
   ├── Interleave index off
   │   └── `splice(offsets[i] - 1, 1)` must subtract 1, and iterate back-to-front
   └── PX custom serialize not used
       └── Must use revers/payload.js's serialize(); never JSON.stringify

decode_response fails
   ├── OB binary vs UTF-8
   │   └── Buffer.from(ob, 'base64').toString('binary'), never 'utf-8'
   ├── Separator is "~~~~" not "~~~"
   │   └── Four tildes
   └── Handler key not .shift()'d
       └── First field of each segment is the handler key; .shift() to remove
```

Each entry detailed in [`../../../bug_report/1_collector_path.md`](../../../bug_report/1_collector_path.md).

---

## 2.6 Cross-Version Algorithm Validation (grep Magic Constants)

When you get a new SDK, **first grep the algorithm-layer magic constants** to confirm the algorithm hasn't changed:

```bash
grep -c "1732584193" main.min.js     # MD5 init A — expected 1
grep -c "909522486"  main.min.js     # HMAC ipad — expected 1
grep -c "122192928e5" main.min.js    # UUID v1 Gregorian — expected ≥ 1
grep -c "2147483647" main.min.js     # ml() INT32_MAX — expected ≥ 1
```

Measured (current iFood version):

| Constant | Hit count |
|---|---|
| `1732584193` (MD5 init) | 1 |
| `909522486` (HMAC ipad) | 1 |
| `122192928e5` (UUID v1) | 2 |
| `2147483647` (INT32_MAX) | 1 |
| `F@bt` (base91 alphabet) | 1 (older Grubhub may show 0) |

⭐ **If any grep returns 0** → the algorithm layer has changed; the "3-year algorithm stability" assumption breaks, and you'll need to redo algorithm analysis from SDK static analysis. **This hasn't happened in 3 years**, but it could.

Full grep patterns: see [`04_stage4_locate.md`](04_stage4_locate.md) §"Algorithm-layer location".

---

## 2.7 Stage 2 Completion Criteria ✓

| Item | Verification |
|---|---|
| ✅ All 6 batches decoded | `./decode_all.sh` runs; each batch has 4 decoded_*.json |
| ✅ EV1/EV2 field counts match expectations | 14 / 204 (iFood) |
| ✅ state.* complete | appId/no/qa/to/vid/pxsid/cts/jf all present |
| ✅ _px3 cookie extractable | jq query returns ["_px3", 330, ...] |
| ✅ Algorithm-layer magic constants present | All 4 core constants grep-hit |

---

## 2.8 Proceed to Stage 3

Stage 2 complete → you can turn raw byte streams into JSON and the algorithm layer is usable → proceed to [Stage 3: Field Three-class Classification](03_stage3_classify.md).
