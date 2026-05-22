# Appendix B: Key Algorithm Pseudocode

> Core logic of PX's 9 algorithm modules, in pseudocode form + cross-language porting reference.
> *Source*: C/Appendix B

---

## B.1 payload — XOR + base64 + interleave

### B.1.1 Encryption Chain

```
input: JSON string obj
output: base64 string "payload="

1. xor_key = parseInt(ml(TAG)) % 128
2. xored = obj.split('').map(c => String.fromCharCode(c.charCodeAt(0) ^ xor_key)).join('')
3. b64 = base64(utf8(xored))
4. offsets = compute_interleave_offsets(b64.length)  // see B.1.2
5. for each o in offsets reverse:
       insert_random_char(b64, o)
6. return b64
```

### B.1.2 Interleave Offsets Computation

```javascript
function compute_interleave_offsets(len) {
    // Measured ~4 offsets; each = (fixed seed array + length) % len
    const seeds = [0x73, 0x21, 0xa3, 0x47];   // placeholder; real values in ../../../../revers/payload.js
    return seeds.map(s => (s + len) % len);
}
```

### B.1.3 PX Custom serialize

```python
def px_serialize(obj):
    if obj is None:           return "null"
    if isinstance(obj, bool): return "true" if obj else "false"
    if obj is undefined_sentinel: return '"undefined"'
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj): return "null"
        return str(obj)
    if isinstance(obj, int):  return str(obj)
    if isinstance(obj, str):  return json.dumps(obj)   # default JSON string encoding
    if isinstance(obj, list):
        return '[' + ','.join(px_serialize(x) for x in obj) + ']'
    if isinstance(obj, dict):
        return '{' + ','.join(f'"{k}":{px_serialize(v)}' for k, v in obj.items()) + '}'
    if isinstance(obj, datetime):
        return f'"{obj.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3]}"'   # PX does NOT zero-pad; avoid strftime carelessness
    return "null"
```

⚠️ **Key difference**: JavaScript `JSON.stringify({a: undefined})` outputs `'{}'`, while PX outputs `'{"a":"undefined"}'`.

---

## B.2 pc — HMAC-MD5 + Digit Extraction

```python
def compute_pc(payload, tag):
    h_hex = hmac.new(tag.encode('utf-8'), payload.encode('utf-8'), hashlib.md5).hexdigest()
    # h_hex = "a1b2c3d4e5f67890..."
    digits = ''.join(c for c in h_hex if c.isdigit())
    # digits = "12345678..." (10-20 digits)
    pc = digits[:16].ljust(16, '0')
    return pc   # 16-digit string
```

Stable across versions.

---

## B.3 ob — 27-Handler Dispatch

### B.3.1 Main Decode Flow

```python
def decode_ob(ob_str, tag):
    xor_key = int(ml(tag)) % 128
    binary = base64.b64decode(ob_str).decode('latin-1')   # ⚠️ NOT utf-8
    xored = ''.join(chr(ord(c) ^ xor_key) for c in binary)
    segments = xored.split('~~~~')                          # ⚠️ 4 tildes, not 3
    return [parse_segment(seg) for seg in segments]

def parse_segment(seg):
    parts = seg.split('|')
    handler_key = parts.pop(0)
    return {
        'handler': handler_key,
        'args': parts
    }
```

### B.3.2 Handler Shape Recognition

You cannot recognize by handler_key name (rotates with every obfuscation pass); recognize by args shape:

```python
def classify_handler(seg):
    args = seg['args']
    n = len(args)

    if n == 1:
        v = args[0]
        if re.match(r'^[a-f0-9-]{36}$', v): return 'uuid'           # state.pxsid/vid/cts
        if re.match(r'^\d{13}$', v):        return 'timestamp_ms'   # state.no
        if re.match(r'^[0-9:;<=>?@]{15,25}$', v): return 'antiTamper' # state.to
        if re.match(r'^[a-f0-9]{64}$', v):  return 'qa'             # state.qa
        if re.match(r'^[a-z0-9]{12,30}$', v): return 'appId'        # state.appId
        if re.match(r'^[a-z]{2,4}$', v):    return 'jf'             # state.jf (cu/success/blocked)
    elif n >= 4 and args[0].startswith('_px'):
        return 'set_cookie'                                          # _px3/_pxvid/_pxhd
    elif n == 5:
        # Visual challenge config (Bundle use)
        if re.match(r'^[a-f0-9]{64}$', args[4]):
            return 'visual_challenge'
    # ... etc

    return 'unknown'
```

Full 27-handler table: [`../../../../skill/AI_re/references/handler-table.md`](../../../../skill/AI_re/references/handler-table.md).

---

## B.4 sid — Plane 14 Unicode Tag Steganography

```python
def encode_sid(uuid):
    # UUID v1 = "c83577f0-5420-11f1-9150-e1cff29e25cc"
    bytes_hex = uuid.replace('-', '')
    # 32 hex chars → 16 bytes
    sid_chars = []
    for byte in bytes_hex:
        codepoint = 0xE0000 + int(byte, 16)   # Plane 14 (U+E0000 ~ U+E007F)
        sid_chars.append(chr(codepoint))
    return ''.join(sid_chars)
```

### B.4.1 Decode

```python
def decode_sid(s):
    out = []
    for ch in s:
        cp = ord(ch)
        if 0xE0000 <= cp <= 0xE007F:
            out.append(hex(cp - 0xE0000)[2:])
    return '-'.join([''.join(out[:8]), ''.join(out[8:12]), ...])   # reassemble UUID format
```

---

## B.5 uuid v1 (PX-Compatible)

```python
def uuid_v1():
    # PX algorithm:
    # 1. ms = Date.now()
    # 2. nano_offset = randint(0, 9999)
    # 3. gregorian = ms * 10000 + nano_offset + 122192928e5
    # 4. timeLow = gregorian & 0x0FFFFFFF
    # 5. timeMid = (gregorian >> 28) & 0xFFFF
    # 6. timeHi = ((gregorian >> 44) & 0x0FFF) | 0x1000   # v1 magic
    # 7. clockseq = random 14-bit + variant bits (PX does not use system clock)
    # 8. node = random 48-bit (PX does not use MAC)
    ms = int(time.time() * 1000)
    nano = random.randint(0, 9999)
    gregorian = ms * 10000 + nano + 122192928_00_000
    timeLow = gregorian & 0x0FFFFFFF
    timeMid = (gregorian >> 28) & 0xFFFF
    timeHi  = ((gregorian >> 44) & 0x0FFF) | 0x1000
    clockseq = random.randint(0, 0x3FFF) | 0x8000
    node = random.randint(0, 0xFFFFFFFFFFFF)
    return f"{timeLow:08x}-{timeMid:04x}-{timeHi:04x}-{clockseq:04x}-{node:012x}"
```

⚠️ Python's stdlib `uuid.uuid1()` uses the real MAC + system clock, **leaking machine info**. PX uses random clockseq + random node — implement it yourself.

---

## B.6 hash — djb2 + ml

### B.6.1 ml() — String to 32-bit Signed

```python
def ml(s):
    n = 0
    for c in s:
        n = (31 * n + ord(c)) % 2147483647    # INT32_MAX
    return str(n)
```

### B.6.2 djb2 Variant

```python
def djb2_variant(s):
    h = 5381
    for c in s:
        h = (h * 33) ^ ord(c)
        h = h & 0xFFFFFFFF
    return h
# Alternative form: (h << 5) - h + ord(c)
```

---

## B.7 memory — performance.memory Synthesis

```python
def synth_memory():
    return {
        'usedJSHeapSize':  random.randint(30_000_000, 80_000_000),
        'totalJSHeapSize': random.randint(80_000_000, 150_000_000),
        'jsHeapSizeLimit': 4294967296,   # 2^32, universal for Chrome
    }
```

Ensure used < total < limit.

---

## B.8 antitamper — XOR key/value

```python
def te(seed, n):
    """seed is state.to, n is state.no % 10 + offset"""
    out = []
    for i, c in enumerate(seed):
        code = ord(c) ^ ((n + i * SOME_FACTOR) & 0xFF)
        out.append(chr(code))
    raw = ''.join(out)
    return base64.b64encode(raw.encode('utf-8')).decode('ascii').replace('=', '')

def apply_anti_tamper(ev2, state):
    no_mod = int(state['no']) % 10
    key   = te(state['to'], no_mod + 2)
    value = te(state['to'], no_mod + 1)
    ev2['d'][key] = value
```

⚠️ `SOME_FACTOR` and offsets (+1/+2) can shift across minor versions — on each upgrade, check the latest implementation at [`../../../../revers/antitamper.js`](../../../../revers/antitamper.js).

---

## B.9 ns — /ns Endpoint

```python
async def fetch_ns(uuid, host=COLLECTOR_HOST):
    url = f"https://{host}/api/v1/ns?uuid={uuid}&..."
    response = await http.get(url, timeout=2)
    if response.status_code == 200:
        data = response.json()
        return {'sm': data.get('sm'), 'duration': data.get('duration')}
    return {'sm': None, 'duration': 0}
```

⚠️ The response may legitimately be `{sm: null, duration: 0}` — **this is normal** (gotcha #25).

---

## B.10 Overall Call Graph

```
Collector#1 (EV1):
    payload = encrypt(serialize(ev1), TAG)
    pc = hmac_md5(payload, TAG) → digit_extract
    sid = encode_sid(uuid)
    POST /api/v2/collector?...
    → response: { state: {...}, ...}

Collector#2 (EV2):
    state = parse_ob(response1.body).state
    ev2 = deepClone(template)
    ev2[keymap.no]    = parseInt(state.no)
    ev2[keymap.appId] = state.appId
    ...
    apply_anti_tamper(ev2, state)
    apply_dynamic_overrides(ev2, uuid, ts, ua)
    payload = encrypt(serialize(ev2), TAG)
    pc = hmac_md5(payload, TAG)
    sid = encode_sid(uuid)
    POST /api/v2/collector?...
    → response: contains _px3 in OB segment
```

---

Next section: [Appendix C: 10 Must-Avoid Pitfalls](C_avoid_traps.md).
