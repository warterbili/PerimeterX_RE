# Stage 8 (Optional): Cross-Platform Porting

> **Time budget**: ~1-2 days per target language
> **Deliverables**: port the 9 algorithm modules (`revers/`) from Node to the target language
> *Merges*: B/08_cross_platform + C/§8 (brief mention)

---

## 8.1 Should You Port?

The Node ecosystem already covers most scenarios (high-throughput fetch, CDP, worker_threads multicore). **Reasons to port**:

| Scenario | Recommendation |
|---|---|
| Existing Go microservice architecture | Port to Go to avoid Node maintenance burden |
| Integration with Python data-science stack | Port to Python |
| Embedded in iOS/Android clients | Port to Swift/Kotlin |
| High throughput + memory-sensitive | Port to Rust/Go |
| One-off script, low throughput | **Don't port**, stay on Node |

---

## 8.2 Porting Matrix: 9 Modules Across Languages

| Module | Node | Python | Go | C# | Rust |
|---|---|---|---|---|---|
| payload (XOR+b64+interleave) | baseline | ⭐ 1h | ⭐⭐ 2h | ⭐ 1h | ⭐⭐ 2h |
| pc (HMAC-MD5+digit) | baseline | ⭐ 1h | ⭐ 1h | ⭐ 1h | ⭐ 1h |
| ob (decode + 27 handlers) | baseline | ⭐⭐ 3h | ⭐⭐ 3h | ⭐⭐ 3h | ⭐⭐⭐ 4h |
| sid (Unicode Tag steg) | baseline | ⭐ 1h | ⭐⭐ 2h | ⭐⭐ 2h | ⭐⭐ 2h |
| uuid v1 (PX-compatible) | baseline | ⭐ 30 min | ⭐ 30 min | ⭐ 30 min | ⭐ 30 min |
| hash (djb2 + ml) | baseline | ⭐ 30 min | ⭐ 30 min | ⭐ 30 min | ⭐ 30 min |
| memory (synth) | baseline | ⭐ 30 min | ⭐ 30 min | ⭐ 30 min | ⭐ 30 min |
| antitamper (XOR key/value) | baseline | ⭐ 30 min | ⭐ 30 min | ⭐ 30 min | ⭐ 30 min |
| ns (probe) | baseline | ⭐ 1h | ⭐ 1h | ⭐ 1h | ⭐ 1h |
| **Total** | — | **~10 h** | **~12 h** | **~10 h** | **~14 h** |

Note: ⭐ = easy / ⭐⭐ = medium / ⭐⭐⭐ = hard

---

## 8.3 Critical Porting Pitfalls

### 8.3.1 base64 Encoding Byte Order

**Node `Buffer.from(str, 'utf-8').toString('base64')`** and **Python `base64.b64encode(s.encode('utf-8'))`** produce identical output. But:

- **Java `Base64.getEncoder().encode(s.getBytes("UTF-8"))`** is also identical
- ⚠️ **Go `base64.StdEncoding.EncodeToString([]byte(s))`** default is OK, but watch out for accidentally using the URL-safe variant

### 8.3.2 Integer Overflow

PX uses 32-bit signed integers:

```javascript
// Node — automatic 32-bit wraparound on bitwise ops
(1 << 31) === -2147483648   // true (JS treats bitwise as 32-bit signed)
```

```python
# Python — arbitrary precision, manual masking required
((1 << 31) & 0xFFFFFFFF) == 2147483648   # NOT -2147483648
# Need this:
def to_int32(n):
    n &= 0xFFFFFFFF
    if n >= 0x80000000: n -= 0x100000000
    return n
```

```go
// Go — must specify type explicitly
var n int32 = int32(1 << 31)   // compile error: out of range
var n int32 = -2147483648      // OK
```

**Mandatory check when porting to Python/Go**: bit operations inside MD5 / HMAC / ml() / djb2.

### 8.3.3 String charCodeAt vs ord vs []byte[i]

```javascript
// Node
"abc".charCodeAt(0)  // 97
```

```python
# Python
ord("abc"[0])  # 97
# But — Chinese characters:
ord("中")  # 20013, not a utf-8 byte
# JavaScript also uses UTF-16 code units, so Chinese behavior is similar
```

```go
// Go — strings are bytes not runes
"abc"[0]  // 97 (byte)
// But Chinese:
"中"[0]   // 228 (E4 — first UTF-8 byte)
// To get codepoint:
[]rune("中")[0]  // 20013
```

PX's XOR and charCodeAt operations are **based on UTF-16 code units** (not UTF-8 bytes). Go ports must explicitly convert to `[]rune` or Chinese / emoji compute wrong.

### 8.3.4 Time APIs

```javascript
Date.now()                        // 13-digit ms
performance.now()                 // High-precision ms (floating point)
new Date().toString()             // "Tue Nov 25 2026 14:32:18 GMT+0800 (..."
```

```python
import time
int(time.time() * 1000)           # 13-digit ms
time.perf_counter() * 1000        # High-precision ms
```

Note: `new Date().toString()` outputs an **identical** format in Node and browsers, but Python has no built-in equivalent — you must hand-format.

### 8.3.5 PX Custom serialize

PX's `serialize()` must be **byte-replicated** in the target language. The biggest pitfall:

```javascript
// JavaScript
{a: undefined}  → '{"a":"undefined"}'   // PX doesn't drop the key; undefined gets quoted
NaN             → "null"
new RegExp()    → "null"
```

```python
# Python must mimic this
def px_serialize(obj):
    if obj is None: return "null"
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)): return "null"
    # ... etc
```

**This is the easiest place to introduce silent bugs during porting**. Recommended: run identical inputs through both languages and byte-compare.

---

## 8.4 Porting Test Strategy

```
1. Node version is the "gold standard" — Stages 1-7 ✓
2. Prepare 10 (input, expected_output) test vector pairs
3. Implement in target language, feed identical inputs
4. assert byte-equal outputs
5. Run 100-iteration fuzz testing with random inputs (pre-generate 100 UUIDs/states; compute on both sides)
```

Concrete approach: pre-generate fixed UUID/state inputs, then assert byte-equal outputs against the Node reference modules in [`revers/`](../../../revers/).

---

## 8.5 Simple Porting Template (Python)

To get you running in 1 hour:

```python
# requirements.txt
# pycryptodome  # MD5/HMAC
# requests      # HTTP

import hashlib
import hmac
import base64
import json
import time
import random
import uuid

# === payload.py ===
PX_XOR_KEY = 50

def px_serialize(obj):
    # Mimic JavaScript JSON.stringify + PX custom
    # ... abbreviated; replicate logic from Node revers/payload.js
    pass

def encrypt_payload(json_str, tag):
    xor_key = int(ml(tag)) % 128
    xored = ''.join(chr(ord(c) ^ xor_key) for c in json_str)
    b64 = base64.b64encode(xored.encode('utf-8')).decode('ascii')
    # Apply interleave
    # ...
    return b64

def ml(tag):
    n = 0
    for c in tag:
        n = (31 * n + ord(c)) % 2147483647
    return str(n)

# === pc.py ===
def compute_pc(payload, tag):
    h = hmac.new(tag.encode('utf-8'), payload.encode('utf-8'), hashlib.md5).hexdigest()
    digits = ''.join(c for c in h if c.isdigit())
    return digits[:16].ljust(16, '0')

# === uuid.py ===
def uuid_v1():
    return str(uuid.uuid1())   # Python stdlib v1 is mostly compatible
    # but clockseq behavior isn't fully identical; PX uses its own random
```

> **Future work**: a complete Python port of the 9 reverse modules (under
> `skill/AI_re/scripts/py_port/`). The cross-language quirks above are
> documented; a faithful port should also include a smoke harness comparing
> Python output to the Node reference. PRs welcome.

---

## 8.6 Cross-Language CI Strategy

```yaml
# .github/workflows/cross-port.yml
- name: Node baseline
  run: node revers/test/golden.js > out_node.json
- name: Python port
  run: python revers_py/test/golden.py > out_py.json
- name: Diff
  run: diff out_node.json out_py.json
```

One CI run tells you whether any language deviates from the Node baseline.

---

## 8.7 Real Python Port Example (iFood)

(Abbreviated — only as scaffolding; expand when actually porting)

---

## 8.8 Stage 8 Completion Criteria ✓

| Item | Verification |
|---|---|
| ✅ Target language can run the generator | _px3 obtained |
| ✅ Byte-equal to Node baseline | 100 test vectors all pass |
| ✅ Business API accessible | 200 |
| ✅ Stable across IPs / UAs | Performance comparable to Node |

---

## 8.9 Proceed to Stage 9

→ [Stage 9: SDK Upgrade Response](09_sdk_upgrade.md)
