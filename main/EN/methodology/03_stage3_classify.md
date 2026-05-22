# Stage 3: Field Three-Class Classification

> **Time budget**: 30 min fluent / 2 h first-time
> **Deliverables**: every EV field labelled STATIC / DYNAMIC / CONDITIONAL, plus a classification JSON file
> *Merges*: C/§4 (combat) + B/03_stage3_classify (structure) + A/§10 (classification rules)

---

## Goal

Classify the ~220 fields into 3 categories so that **Stage 6 knows "which fields are template-copy / which fields are algorithm-generated"**:

| Category | Proportion | Handling |
|---|---|---|
| **STATIC** | ~75% (170/228) | Same value across 6 batches → copy template |
| **DYNAMIC** | ~15% (32/228) | Different per batch → algorithm-generated |
| **CONDITIONAL** | ~10% (25/228) | Missing in some batches → warm-visit fields, ignorable for cold-visit |

**This step saves 80% of the time you'd spend writing code in Stage 6.**

---

## 3.1 Cross-Batch Diff Script

```bash
cd ../../../stample/ifood/script/
python diff_samples.py 2   # look at EV2 (main)
# Output:
#   STATIC      :  171 fields
#   DYNAMIC     :   32 fields
#   CONDITIONAL :   25 fields
#   Total       :  228 fields
# Written to: ../field_classes_ev2.json
```

Also run on EV1:

```bash
python diff_samples.py 1   # EV1
# STATIC      :  10
# DYNAMIC     :    4
# CONDITIONAL :    0
```

The detailed diff logic (pseudocode):

```python
samples = [batch1.ev2.d, batch2.ev2.d, ..., batch6.ev2.d]
all_keys = set().union(*[s.keys() for s in samples])

for k in all_keys:
    present_in = [i for i, s in enumerate(samples) if k in s]
    if len(present_in) < len(samples):
        result['conditional'][k] = {present_in, sample_value}
        continue
    values = [json.dumps(s[k]) for s in samples]
    if len(set(values)) == 1:
        result['static'][k] = samples[0][k]
    else:
        result['dynamic'][k] = {samples: [...]}
```

---

## 3.2 STATIC Fields (Copy Directly)

About 75% of fields share the same value across 6 batches. These include:

| Category | Examples |
|---|---|
| Browser identifiers | UA, navigator.platform, language |
| Screen / display | screen.width/height, colorDepth |
| Hardware features | hardwareConcurrency, deviceMemory |
| Network info | connection.effectiveType |
| API support detection | 56 boolean fields ("does window.fetch exist?" etc.) |
| Bot detection | navigator.webdriver, etc. — 42 booleans |
| Hash fields | Canvas/WebGL/Audio fingerprint hashes (constant within the same GPU + same browser) |

**Handling STATIC fields**: use batch 6 (the cleanest cold visit) as a **template JSON**, then deep-clone it as the EV2 baseline.

```bash
# Extract template (using batch 6)
cp samples/6/decoded_payload_2.json px_cookie/<site>_ev2_template.json
```

Detailed field mapping: see the algorithm-module code in [`../../../revers/`](../../../revers/) + [`../../../bundle/doc/Bundle_完整技术文档.md`](../../../bundle/doc/Bundle_完整技术文档.md) §10 (full 229-field classification).

---

## 3.3 DYNAMIC Fields (Require Algorithmic Generation)

About 15% of fields have different values per batch. **These are what Stage 6 must write code to generate**.

The measured 32 DYNAMIC fields roughly classify as:

| Subcategory | Count | Examples | Generation |
|---|---|---|---|
| **Timestamps** | 4 | initTime / sendTime / perfNow / dateString | `Date.now()` + increments |
| **UUID** | 1 | session uuid | `uuidV1()` |
| **HMAC** | 3 | HMAC(uuid, UA), HMAC(vid, UA), HMAC(pxsid, UA) | `crypto.createHmac('md5', UA).update(...)` |
| **state.\* injection** | 4 | state.no, state.appId, state.to, state.qa | **Extract from OB#1** ⭐ Stage 5's job |
| **anti-tamper** | 2 | key + value (both change per call) | `te(state.to, state.no % 10 ± 1)` |
| **Memory** | 3 | usedJSHeapSize / totalJSHeapSize / jsHeapSizeLimit | Random range 30 M – 100 M |
| **Counters** | ~5 | seq, perfMark, various internal counters | Increment / random 4-5 digit |
| **/ns results** | 2 | sm + duration | `fetchNs(uuid)` async fetch |
| **Error stack** | 1 | TypeError stack | Fixed template from a browser capture |
| **timing chain** | 1 | `"109\|66\|66\|70\|80"` | String-concatenated timestamp deltas |
| **performance.memory numbers** | 3 | 4294967296 etc. | Effectively hardcoded |
| **Others** | ~3 | Rare state fields | Session-strongly-coupled |

**Key insight**: not all 32 DYNAMIC fields require "algorithmic generation" — 4 of them are state.\* derived from OB#1 (Stage 5), 3 are mechanical HMAC, 2 are anti-tamper with a deterministic formula. **The hard part is figuring out "which b64 key means what"**, which is Stage 4's job.

---

## 3.4 CONDITIONAL Fields (Missing in Some Batches)

About 10% of fields are **present in some batches and absent in others**. These include:

| Category | Pattern |
|---|---|
| `pxhd` cookie field | Present only on warm visit; empty on cold visit |
| Previous session state | Present only when a prior session left residue |
| Redirect-tracking fields | Present only when user comes from a specific referrer |
| performance entries | Differ depending on browser cache hits |
| /ns sm result | Present only when `/ns` completes successfully (mostly null at Collector#1 time) |

**Handling principle**: **In cold-visit scenarios these may be null / empty / missing**. Use a cold-visit batch (batch 6) as template; CONDITIONAL fields just don't appear.

See [`../../../bug_report/1_collector_path.md`](../../../bug_report/1_collector_path.md) #25 (`/ns` async sm/duration being null/0 is normal).

---

## 3.5 ENTROPY Subclass (Pseudo-DYNAMIC Inside DYNAMIC)

About 5-10 fields show different values across 6 batches, but **are deterministic given the same browser profile + same GPU**. They include:

- Canvas fingerprint hash (depends on GPU)
- WebGL fingerprint hash (depends on GPU + driver)
- AudioContext fingerprint hash
- Font fingerprint hash

**Handling**: treat as STATIC — hardcode the value from batch 6. **Do not try to recompute Canvas/WebGL hashes in Node** (very slow and easy to get wrong) — capture them from a real browser and hardcode.

See [`../../../bundle/doc/Bundle_完整技术文档.md`](../../../bundle/doc/Bundle_完整技术文档.md) §10.8 — hash generation source location + forgery strategy.

---

## 3.6 Three-Class Output Format

`diff_samples.py` produces `field_classes_ev2.json`:

```json
{
  "static": {
    "fyNFZTlCSFM=": false,
    "EwhjCVZnZTM=": "Win32",
    ...170 entries
  },
  "dynamic": {
    "RTEwewNQMUg=": {
      "samples": ["1771962830422", "1771962850771", ...]
    },
    "M2MGKXUOBB8=": {
      "samples": ["abc123...", "def456...", ...]
    },
    ...32 entries
  },
  "conditional": {
    "R3cyPQIVMAw=": {
      "present_in_batches": [3, 5],
      "sample_value": "<pxhd value>"
    },
    ...25 entries
  }
}
```

This file is the **input** to Stages 4–6.

---

## 3.7 Stage 3 Completion Criteria ✓

| Item | Verification |
|---|---|
| ✅ field_classes_ev2.json generated | File exists |
| ✅ STATIC ~ 75% | 170/228 ± 5 |
| ✅ DYNAMIC ~ 15% | 32/228 ± 5 |
| ✅ CONDITIONAL ~ 10% | 25/228 ± 5 |
| ✅ No "phantom STATIC" | No fields that "theoretically should be DYNAMIC but coincidentally match across 6 batches" (if so, batches aren't independent enough — go back to Stage 1 and recapture) |

---

## 3.8 Common Pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| STATIC at 90%+, DYNAMIC only 5% | Captures didn't clear cookies; all warm visits | Recapture 6 batches in incognito |
| `pxhd` present in all 6 batches | Same as above | Same as above |
| `/ns` sm field is null everywhere | All captures are cold-visit; /ns hasn't responded yet | **Normal**, not a bug (gotcha #25) |
| DYNAMIC field type inconsistency (sometimes string, sometimes number) | PX serialize bug or capture inconsistency | Check types; may be PX's anti-replay detection |

---

## 3.9 Proceed to Stage 4

Stage 3 complete → you know which fields are DYNAMIC → proceed to [Stage 4: Field Semantic Location](04_stage4_locate.md) to find where they are assigned in the SDK.
