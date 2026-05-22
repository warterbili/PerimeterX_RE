# PX Captcha WASM — Complete Analysis

## 1. Overview

PerimeterX uses a Rust-compiled WASM module during the human-verification (captcha) stage, exposing two core export functions:

| Export | PX identifier | Signature | Purpose |
|---|---|---|---|
| `a()` | PX12590 | `() → string` | Generate fingerprint / hash string |
| `b(input)` | PX12610 | `(string) → string` | Validation computation; depends on `window._pxUuid` |

The WASM result is embedded directly in the Bundle #3 request's PX561 event; it is the critical field for passing human verification.

---

## 2. Binary File

**File**: `px_captcha.wasm`
**Size**: 60,862 bytes
**Magic**: `00 61 73 6D` (WASM v1)

### 2.1 Section Layout

| Section | Size (bytes) | Notes |
|---|---|---|
| type | 170 | 24 function-type signatures |
| import | 1,198 | 34 wbg imports |
| function | 161 | 161 internal functions |
| table | 5 | Function table |
| memory | 3 | Linear memory |
| global | 9 | Globals (stack pointer, etc.) |
| export | 138 | 8 exports |
| element | 151 | Function table initialization |
| **code** | **50,611** | **Main logic** |
| data | 8,255 | Static data / strings |
| custom | 123 | Debug info |

### 2.2 Exported Functions

```
a          → func[75]    # PX12590
b          → func[62]    # PX12610
memory     → memory[0]
__wbindgen_malloc            → func[115]
__wbindgen_realloc           → func[129]
__wbindgen_add_to_stack_pointer → func[175]
__wbindgen_free              → func[148]
__wbindgen_exn_store         → func[161]
```

---

## 3. Compilation Toolchain

Confirmed from leaked strings in the data section:

- **Language**: Rust
- **Compiler**: rustc `d5a82bbd26e1ad8b7401f6a718a9c57c96905483`
- **Binding**: wasm-bindgen (standard Rust→WASM bridge library)
- **Source file**: `src/lib.rs`

### 3.1 Rust Crate Dependencies

| Crate | Version | Purpose |
|---|---|---|
| `base64-simd` | 0.8.0 | Base64 encode/decode |
| `rand` | 0.8.5 | Random number generation |
| `rand_core` | 0.6.4 | Random core traits |
| `rand_chacha` | 0.3.1 | ChaCha20 CSPRNG |
| `uuid` | 1.4.0 | UUID v4 generation |
| `getrandom` | - | Secure random seeding |

### 3.2 Key Static Strings

```
"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"  # Standard base64
"/=+!1@2#3$4%5^6&7*8(9)0-"                                          # Custom encoding alphabet
"Uuxipd_"                                                            # XOR key or salt
"0123456789ABCDEF"                                                   # Uppercase hex
"0123456789abcdef"                                                   # Lowercase hex
"return this"                                                        # Get global object
"crypto"                                                             # Crypto API
```

---

## 4. Import Interface (34 wbg imports)

### 4.1 Object / Type Operations

| Import | Signature | Notes |
|---|---|---|
| `__wbindgen_string_get` | (i32, i32) → void | Read string from heap |
| `__wbindgen_string_new` | (i32, i32) → i32 | Create JS string |
| `__wbindgen_object_drop_ref` | (i32) → void | Release heap reference |
| `__wbindgen_object_clone_ref` | (i32) → i32 | Clone reference |
| `__wbindgen_is_object` | (i32) → i32 | Type check |
| `__wbindgen_is_string` | (i32) → i32 | Type check |
| `__wbindgen_is_function` | (i32) → i32 | Type check |
| `__wbindgen_is_undefined` | (i32) → i32 | Type check |

### 4.2 Key Business Imports

| Import | Signature | Notes |
|---|---|---|
| `__wbg_instanceof_Window` | (i32) → i32 | **Must return 1**, or b() fails |
| `__wbg_get` | (i32, i32, i32) → i32 | Read `obj[key]`, **used to read `window._pxUuid`** |
| `__wbg_require` | () → i32 | Get Node.js require reference |

### 4.3 Crypto Imports

| Import | Notes |
|---|---|
| `__wbg_crypto` | Get `crypto` object |
| `__wbg_getRandomValues` | `crypto.getRandomValues()` |
| `__wbg_randomFillSync` | `crypto.randomFillSync()` (Node.js) |
| `__wbg_msCrypto` | IE-compatible `msCrypto` |

### 4.4 Global Environment Detection

```
__wbg_self       → self
__wbg_window     → window
__wbg_globalThis → globalThis
__wbg_global     → global
```

Probes the runtime environment in order (browser / Web Worker / Node.js).

### 4.5 Memory Operations

```
__wbg_buffer                      → ArrayBuffer
__wbg_newwithbyteoffsetandlength  → new Uint8Array(buf, off, len)
__wbg_new                         → new Uint8Array(buf)
__wbg_set                         → arr.set(src, offset)
__wbg_newwithlength               → new Uint8Array(len)
__wbg_subarray                    → arr.subarray(start, end)
__wbindgen_memory                 → wasm.memory
```

---

## 5. Function Analysis

### 5.1 a() — PX12590

**Call**: `Ys.a()`
**Args**: none
**Returns**: hex string

**Calling convention** (wasm-bindgen retptr mode):
```javascript
function wasmA() {
    const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
    wasm.a(retptr);                              // result written to retptr
    const ptr = getInt32Memory0()[retptr / 4];   // string pointer
    const len = getInt32Memory0()[retptr / 4 + 1]; // string length
    return getStringFromWasm0(ptr, len);
}
```

**Inferred functionality**:
- Uses ChaCha20 CSPRNG to generate random data
- Encoded via base64 + hex
- Each call returns a different result (contains random components)

### 5.2 b(input) — PX12610

**Call**: `Ys.b(Es)`
**Args**: `Es` = string (from captcha challenge hash)
**Returns**: hex string
**Dependency**: `window._pxUuid` must be set

**Calling convention**:
```javascript
function wasmB(input) {
    const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
    const ptr0 = passStringToWasm0(input, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    wasm.b(retptr, ptr0, len0);                  // input passed as (ptr, len)
    const ptr = getInt32Memory0()[retptr / 4];
    const len = getInt32Memory0()[retptr / 4 + 1];
    return getStringFromWasm0(ptr, len);
}
```

**Inferred functionality**:
- Reads `window._pxUuid` (via `__wbg_get(window, "_pxUuid")` import)
- Mixes UUID + input hash
- Output is a hex-encoded validation token
- Returns empty string if `_pxUuid` is not set

### 5.3 Custom Encoding Alphabet

```
/=+!1@2#3$4%5^6&7*8(9)0-
```

This alphabet is observable in Bundle #3's PX561 event. Field `MD1DNnVfRgQ=` contains:
```
WwxHRmkafTZyIxwTMBlGNmxDDxIHQWRYGCkhKEkRSAVeS@YvbgxuYSUQbnVqDGAQRDJ)RD$wVlpJSmcLSDw%PTw#Ji(MKloUVwZ&JBR^dxVMI@!xbnVDbSpYVAh(JSho
```

The `@`, `)`, `$`, `%`, `#`, `(`, `&`, `^`, `!` all come from this alphabet. This indicates the WASM's output (or intermediate processing) uses a custom encoding that maps hex/base64 into a special-character-mixed format.

---

## 6. WASM Usage in Bundle #3

Bundle #3 is the human-verification submission request; its PX561 event (captcha core) contains the WASM compute results.

### 6.1 Relevant Fields

| Field (base64 key) | PX code | Source | Example value |
|---|---|---|---|
| `Slt5EA85fiI=` | PX12590 | **WASM a()** return | `440be25de15f...` (64 chars hex, non-deterministic) |
| `MD1DNnVfRgQ=` | PX12573 | **WASM b(Es)** return | `WwxHRmkafTZy...@YvbgxuYSUQ...` (127 chars, custom alphabet) |
| `AE0zBkUsPjQ=` | — | sensor encrypted data | `b9f8af5d513c4657...` (101 chars hex) |
| `CXR6P08TfA==` | — | PoW answer = **Es** | `c3f363da449440...c2624` (64 chars hex) |
| `dgcFTDNhAXs=` | — | PoW challenge hash (targetHash) | `98e53eabe4546dc7...` (128 chars hex) |

### 6.2 Data Flow

```
Bundle #1 ob response
  ├── PoW challenge hash (dgcFTDNhAXs=) → targetHash
  └── Visual challenge hash (Slt5EA85fiI=)

PoW solving (Bs/poi):
  sha256(candidate) === targetHash
  → Es = candidate (PoW answer)        → CXR6P08TfA== (64 chars hex)

WASM calls:
  Ys.a()      → PX12590 → Slt5EA85fiI= (64 chars hex, non-deterministic)
  Ys.b(Es)    → PX12610 → MD1DNnVfRgQ= (127-char encoded string, deterministic)
                   │
                   ├── Input: Es = PoW answer
                   ├── Reads: window._pxUuid
                   ├── Operations: ChaCha20 + base64 + custom alphabet
                   └── Output: encoded string with @$%^&!() special chars
```

### 6.3 captcha.js Call Chain

```
User presses verify button
  → onSolvedCallback
    → Ws() (captcha.js:334970)
      → controllerCallback → Qf() (captcha.js:307240)
        → PX561 event construction
          → Ys.a()  → PX12590 result
          → Ys.b(Es) → PX12610 result
        → PX763 → fl() → dl() (main.min.js)
          → Bundle #3 request sent
```

---

## 7. WASM Loading Chain

### 7.1 Embedding Position

The WASM binary, after encoding, is embedded in the `captcha.js` string-table function `Us()`:

```
captcha.js → Us() → array[10] → encoded WASM string
```

### 7.2 Decoding Chain

```
Us()[10] (encoded string, ~80K chars)
  → ks.XWzSIG()  custom base64 decode (lowercase first: abcdef...xyzABCDEF...XYZ0-9+/=)
  → URI decode (decodeURIComponent)
  → Raw binary (60,862 bytes)
  → WebAssembly.instantiate(binary, imports)
  → WASM instance ready
```

### 7.3 captcha.js Changes Per Load

The captcha.js filename **changes on every load**, URL format:
```
https://captcha.px-cdn.net/PXO1GDTa7Q/captcha.js?a=c&m=0&u={uuid}&v={version}
```

So you can't set breakpoints by fixed line number, but the Us() string-table structure is stable.

---

## 8. Runtime Environment Requirements

### 8.1 Required Globals

| Variable | Notes |
|---|---|
| `window._pxUuid` | PX session UUID; required by b() |
| `window` / `self` | Global object; instanceof_Window check |
| `crypto.getRandomValues` | Secure random number generation |

### 8.2 Node.js Environment Simulation

`run_wasm.js` runs the WASM in Node.js via:

```javascript
globalThis.self = globalThis;
globalThis.window = globalThis;
globalThis.crypto = crypto.webcrypto || {
    getRandomValues(arr) { crypto.randomFillSync(arr); return arr; }
};
globalThis._pxUuid = uuid;  // must be set
```

### 8.3 Heap Slab (wasm-bindgen standard)

```javascript
const heap = new Array(128).fill(undefined);
heap.push(undefined, null, true, false);  // index 128-131
let heap_next = heap.length;              // 132
```

First 128 slots reserved; user objects start at 132. Standard refcount + free-list management.

---

## 9. Reverse Engineering Key Points

### 9.1 Confirmed

- [x] WASM is Rust-compiled using wasm-bindgen
- [x] Two exports a() and b(), corresponding to PX12590 and PX12610
- [x] b() depends on `window._pxUuid`
- [x] Uses ChaCha20 CSPRNG + base64 + hex + custom encoding
- [x] `instanceof_Window` must return 1
- [x] All 34 wbg imports implemented (run_wasm.js)
- [x] Result writes into Bundle #3 PX561 event

### 9.2 Confirmed Inputs / Outputs

- `Es` = **PoW preimage** (Proof of Work answer); the candidate where `sha256(candidate) === targetHash`
- captcha.js `Ts()` (7406-7410) stores: `Es = answer, Js = elapsed(ms)`
- Corresponding Bundle #3 field `CXR6P08TfA==` = PoW answer (64 chars hex)
- `Slt5EA85fiI=` = PX12590 = `a()` output (64 chars hex, random + UUID)
- `MD1DNnVfRgQ=` = PX12573 = `b(Es)` output (127-char encoded string; Es+UUID → deterministic result)

### 9.3 To Dig Deeper

- [ ] The full mapping logic of custom alphabet `/=+!1@2#3$4%5^6&7*8(9)0-`
- [ ] Whether WASM internally contains timestamp validation or replay-protection logic
- [ ] Specific use of `Uuxipd_` string (likely an XOR key)

---

## 10. File Listing

| File | Notes | Status |
|---|---|---|
| `px_captcha.wasm` | WASM binary (60,862 bytes) | Core file, retained |
| `run_wasm.js` | Node.js WASM runner, modular exports | Core tool, retained |
| `extract_wasm.js` | Tool to extract WASM from captcha.js | Retained (must re-extract on PX updates) |

### 10.1 Usage

**As a module**:
```javascript
const { initWasm } = require('./source/wasm_captcha/run_wasm');
const { a, b } = await initWasm(uuid);
const resultA = a();           // PX12590
const resultB = b(challengeHash);  // PX12610
```

**Command-line test**:
```bash
node source/wasm_captcha/run_wasm.js <uuid> <Es>
# Example:
node source/wasm_captcha/run_wasm.js "68303b30-1224-11f1-a20a-312c66e49e40" "440be25de15f8e8a59b590f3233558683cdf89b5df1579ae849d052a16ed2490"
```

**Re-extract WASM (after PX update)**:
```bash
# First place the new captcha.js into source/captcha/
node source/wasm_captcha/extract_wasm.js
```
