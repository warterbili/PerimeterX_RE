# Stage 5: Value-match — state.* → EV2 b64 key ⭐⭐⭐

> **Time budget**: 15 min fluent / 30 min first-time
> **Deliverables**: `state_key_map.json` — maps the 4 state.* fields to specific b64 keys in EV2
> *Merges*: C/§3.5 (value-match combat) + A/§9 (deep analysis) + B/05_stage5_value_match

---

## Chapter Positioning

**This is the chapter most likely to be skipped in the entire methodology. It is also the most pitfall-laden.**

If you skip Stage 5 and go directly to Stage 6 (writing the generator), you'll blindly guess which b64 key `state.no` belongs to, **and 99.9% of the time you'll guess wrong**. Then the generator won't work, and you'll come back to debug — **wasted time >>> 15 minutes**.

---

## 5.1 Problem Statement

The PX collector#1 response contains a `state` object:

```json
{
  "state": {
    "appId": "PXO1GDTa7Q",
    "no": 1771962850771,
    "qa": "a1b2c3...64hex",
    "to": "16:9;3<>;7=",
    "vid": "c83577f0-...-uuid",
    "pxsid": "82de01a0-...-uuid",
    "cts": "82de01a0-...-uuid",
    "jf": "cu"
  }
}
```

Of these 8 fields, **at least 4 must be injected into the collector#2 EV2 payload**. But **EV2 uses b64-encoded keys**, e.g.:

```json
{
  "d": {
    "RTEwewNQMUg=": "1771962850771",   ← is this state.no? Which state?
    "M2EHKXUOBB4=": "PXO1GDTa7Q",      ← is this state.appId?
    "fyNFZTlCSFM=": "16:9;3<>;7=",     ← is this state.to?
    "Azs1JTQEEXM=": "c83577f0-...",    ← state.vid? state.cts? state.pxsid?
    ...
  }
}
```

**How do you know the mapping from b64 key to state field?**

`RTEwewNQMUg=` is a b64-encoded internal obfuscated key (not the original text); you cannot tell its semantics from its name. The `hQ_map.json` from Stage 4 only tells you "the key's string is `RTEwewNQMUg=`", **it does not tell you which state.\* field this corresponds to**.

---

## 5.2 Solution: **Value Matching**

The core idea: across 6 batches, **`state.no` differs per batch** (13-digit timestamp), and **only a few keys in EV2 hold 13-digit string values**. If **a particular b64 key's values across 6 batches match `state.no` one-to-one**, that's the key.

Pseudocode:

```python
for state_field in ['no', 'appId', 'to', 'qa', 'vid', 'pxsid', 'cts', 'jf']:
    state_values = [batch_i.state[state_field] for i in 1..6]

    candidates = []
    for b64_key in ev2_d.keys():
        ev2_values = [batch_i.ev2.d[b64_key] for i in 1..6]
        if str(ev2_values) == str(state_values):
            candidates.append(b64_key)

    print(state_field, '→', candidates)
```

---

## 5.3 Combat Script

```bash
cd ../../../stample/ifood/script/
python find_state_keys.py
```

Expected output:

```
state.no    → ["RTEwewNQMUg="]           ✓ 1 unique hit
state.appId → ["M2EHKXUOBB4="]           ✓
state.to    → ["fyNFZTlCSFM="]           ✓
state.qa    → ["Y3kSITcXEy0="]           ✓
state.vid   → ["Azs1JTQEEXM=", "..."]    ⚠ multiple candidates
state.pxsid → ["I3oRZX4yBR8="]           ✓
state.cts   → []                          ✗ 0 candidates → cts not injected into EV2
state.jf    → ["L19sZmwOR3M="]           ✓
```

### Output Format (state_key_map.json)

```json
{
  "PXO1GDTa7Q": {
    "no":    "RTEwewNQMUg=",
    "appId": "M2EHKXUOBB4=",
    "to":    "fyNFZTlCSFM=",
    "qa":    "Y3kSITcXEy0=",
    "vid":   "Azs1JTQEEXM=",
    "pxsid": "I3oRZX4yBR8=",
    "jf":    "L19sZmwOR3M="
  }
}
```

This file is **the core input** to Stage 6.

---

## 5.4 Handling Multiple / Zero Candidates

### 5.4.1 Multiple Candidates (Most Common)

A state value matches multiple b64 keys because:

- The field is a UUID and several EV2 fields use the same UUID (vid is filled into cookie name + session id, etc.)
- 6 samples aren't enough; a few fields coincidentally co-vary

**Fix**:

```python
# Increase samples from 6 → 9 or 12
# Or add "type priors":
#   state.no    → must be 13-digit number type
#   state.to    → must be ":;<=>?@" charset, length 15-25
#   state.vid   → must be UUID v1 format
#   state.appId → must be 12-30 char alphanumeric
#   state.qa    → must be 64 hex chars
```

Document A (PX_逆向方法论_通用版.md 1233-line version) §9 details **type priors** + **range priors**.

### 5.4.2 Zero Candidates

A state field has no match:

```
state.cts → []
```

Possible causes:

- **The field isn't injected into EV2** (e.g., `cts` is often only for internal tracking and doesn't go on the wire)
- **Wrapped by anti-tamper** (the value isn't directly copied; it goes through anti-tamper encoding first)
- **Wrapped by hash** (e.g., `HMAC(vid, UA)` instead of vid directly)

**Handling**:
- Try hex/UTF-8 conversion (some fields are base64'd once more)
- Check if it's an anti-tamper key (the te(state.to, state.no % 10) formula)
- In most cases it just "isn't injected" — can be ignored

---

## 5.5 Easily Missed Fields: Anti-tamper key+value

EV2 contains 2 fields where **both the value and the key change every time**:

```json
{
  "fyNFZTlCSFM=": "16:9;3<>;7=",       ← anti-tamper value (overrides state.to)
  "n5J4PSdfdU8=": "<encoded>",          ← anti-tamper "auxiliary" field (key is anti-tamper-formula generated)
}
```

The second key `n5J4PSdfdU8=` looks like b64 too, but is actually the output of **`te(state.to, state.no % 10 + offset)`**.

```javascript
// Formula (measured):
function te(seed, n) {
    return base64encode(
        seed.split('').map((c, i) =>
            String.fromCharCode(c.charCodeAt(0) ^ ((n + i * something) & 0xFF))
        ).join('')
    );
}
```

See [`../../../revers/antitamper.js`](../../../revers/antitamper.js) for the full implementation.

### 5.5.1 How to Verify Anti-tamper Key Computation

```bash
# Run 6 batches and observe anti-tamper key values across batches
jq '.[0].d | with_entries(select(.key | test("^[A-Za-z0-9+/]{12}="))) | keys' samples/{1..6}/decoded_payload_2.json
```

If two b64 keys **differ on every one of the 6 batches**, those are the anti-tamper key/value fields.

---

## 5.6 Handling Cross-Version Invalidation

On major PX upgrades (every 6-12 months) **all b64 keys change**; `state_key_map.json` becomes **invalid** and Stage 5 must be redone.

Fortunately Stage 5 is a mechanical step:

1. Recapture 6 batches (Stage 1)
2. Re-decode (Stage 2)
3. Re-classify (Stage 3) — note STATIC/DYNAMIC ratio should be similar
4. **Re-run find_state_keys.py** → new `state_key_map.json`

The entire process completes in under 30 minutes.

⭐ **This is why Stage 5 is a 15-minute script**: it's the shortest link in the upgrade-response chain.

---

## 5.7 Cross-Site Handling

⚠️ **`state_key_map.json` does NOT reuse across sites**.

iFood's `state.no` corresponds to `RTEwewNQMUg=`; Grubhub's `state.no` may correspond to a completely different b64 key (different SDK build → different b64 dictionary).

Each site requires **a separate Stage 5 run**.

---

## 5.8 Full 7-Field Mapping Example

iFood + Grubhub measured (for reference; changes per SDK upgrade):

| state field | iFood EV2 key | Grubhub EV2 key |
|---|---|---|
| `no` | `RTEwewNQMUg=` | `U0swdkVRcEM=` |
| `appId` | `M2EHKXUOBB4=` | `aR1dHy91Vi4=` |
| `to` | `fyNFZTlCSFM=` | `cFomU3ZbVjI=` |
| `qa` | `Y3kSITcXEy0=` | `bxlIElJaVgg=` |
| `vid` | `Azs1JTQEEXM=` | `b1MtCSQrChE=` |
| `pxsid` | `I3oRZX4yBR8=` | `EwhjCVZnZTM=` |
| `jf` | `L19sZmwOR3M=` | `c20vNgkEC1Y=` |

(Note: example keys illustrate cross-site differences only; your current captured SDK may differ entirely — **always trust your Stage 5 output**)

---

## 5.9 Stage 5 Completion Criteria ✓

| Item | Verification |
|---|---|
| ✅ state_key_map.json generated | File exists with 7+ field mappings |
| ✅ At least 7 fields have unique hits | no/appId/to/qa/vid/pxsid/jf |
| ✅ 0 zero-candidate fields | If any, check for anti-tamper wrapping |
| ✅ Multi-candidates converged | Use type priors to filter false candidates |

---

## 5.10 Proceed to Stage 6

Stage 5 complete → you know which b64 key in EV2 each state.* should be written to → **you can now write the generator** → proceed to [Stage 6: Implement](06_stage6_implement.md).
