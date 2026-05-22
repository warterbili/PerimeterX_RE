# Bundle Path — Locked SDK Snapshot

The complete SDK source archive for the current production iFood Bundle path.

> ⚠️ **`captcha.js` is not saved** — PX's `captcha.js` filename changes (hash-suffixed) on every browser load; no project on the web has downloaded and archived it. But we have the **core WASM decoded from it** + the **main.min.js that triggers it**, sufficient for most Bundle-path reverse engineering. When you need captcha.js, capture live per [§4](#4-captchajs-dynamic-fetching).

---

## 1. File Listing

| File | Size | SHA-256 (first 16) | Contents |
|---|---|---|---|
| [`main.min.js`](main.min.js) | 231,438 bytes | `b47a639cde9df4f9…` | **Current iFood SDK main file** (obfuscated, production path) |
| [`main_pretty.js`](main_pretty.js) | 527,580 bytes | `61eba79a853753c5…` | Deobfuscated/formatted version of `main.min.js` (for reading) |
| [`px_captcha.wasm`](px_captcha.wasm) | 60,862 bytes | `900a9b07c1de9cf3…` | **Bundle WASM binary** (core a()/b() functions) |
| [`main_legacy_pre_split.js`](main_legacy_pre_split.js) | 430,842 bytes | `0868d0ac0d925dba…` | **Legacy PX SDK** (captcha + collector merged, pre-split version, for historical comparison) |

Full SHA-256:

```
b47a639cde9df4f91bdc4138ae0d64ebf7ce8c876a1e4c9967fd3af3d2975eb8  main.min.js
61eba79a853753c5af06d6a52197bccbbeac9071dc241ad0abb30d388c85b340  main_pretty.js
900a9b07c1de9cf37175a48470f77445dcb8515841d51469c0b24c207c8b090d  px_captcha.wasm
0868d0ac0d925dba9a58d0c7e8f8557cc638b15cbe66d9e53ece31d8e1edcd72  main_legacy_pre_split.js
```

## 2. File Details

### 2.1 `main.min.js` — Current PX Main SDK ⭐

**Every iFood browser visit loads this first** (whether the Collector or Bundle path is taken). It's the entry point and will:

1. Auto-send Collector POST (obtain initial `_px3`)
2. Register `window._O1GDTa7Qhandler` (handles Bundle-challenge callbacks)
3. **Download captcha.js when Bundle is triggered** (dynamic URL)
4. Decode all OB responses (all 27 + 2 handlers live here)

| Dimension | Value |
|---|---|
| Source URL | `https://client.px-cloud.net/PXO1GDTa7Q/main.min.js` |
| Captured | 2026-05-20 via cdp-browser |
| Size | 231,438 bytes |
| Line count | 10,653 (obfuscated, ~2 long lines) |
| SHA-256 | `b47a639cde9df4f91bdc4138ae0d64ebf7ce8c876a1e4c9967fd3af3d2975eb8` |
| Init AppID | `PXO1GDTa7Q` |
| Bundle AppID | Dynamically issued by OB#1 segment#3 (e.g., `d6f03jmq8h6c7382req0`) |
| Collector TAG | `U0MmDhUmOnhXSw==` |
| Bundle TAG | `O2MKZn0OEhI/ag==` (embedded in captcha.js, not main.min.js) |
| Collector FT | `401` |
| Bundle FT | `388` |
| OB XOR key | `100` = `ml("U0MmDhUmOnhXSw==") % 128` (Collector) / `120` = `ml("DhY8E0h7J2cKHw==") % 128` (Bundle) |

⚠️ **This file is identical to [`../../stample/ifood/source/main.min.js`](../../stample/ifood/source/main.min.js)** (same SHA). `stample/ifood/source/` is maintained from the Collector perspective; `bundle/source/` here mirrors it for self-contained Bundle docs.

### 2.2 `main_pretty.js` — Deobfuscated Version (For Reading)

```bash
$ wc -l main_pretty.js
~15000 lines
$ ls -la main_pretty.js
527580 bytes
```

`main.min.js` is obfuscated (variable names a/b/c/..., 2 long lines). `main_pretty.js` is the version processed by `prettier` / `js-beautify`:
- Added line breaks + indentation
- **Variable names remain obfuscated** (cannot auto-deobfuscate)
- But line numbers + function boundaries are clear → DevTools breakpoints usable

Usage:
- DevTools "Local Overrides" to substitute `main.min.js` with `main_pretty.js` → can single-step debug
- For cross-version grep, locate by "magic constants" (`1732584193` MD5 init / `909522486` HMAC ipad / `122192928e5` UUID epoch)

⚠️ **Don't use the pretty version as generator input directly** (pretty-formatted JS line numbers don't match minified, and some OB-decoding handlers assume specific string positions). Pretty is for reading only.

### 2.3 `px_captcha.wasm` — Bundle WASM Binary ⭐⭐⭐

The Bundle path's core — a 60,862-byte wasm-bindgen-generated Rust module.

| Dimension | Value |
|---|---|
| Source | Embedded in `captcha.js` (base64 in `Us()[10]`) |
| Size | 60,862 bytes |
| Magic | `\0asm 0x01000000` (first 8 bytes: `0061736d 01000000`) |
| SHA-256 | `900a9b07c1de9cf37175a48470f77445dcb8515841d51469c0b24c207c8b090d` |
| Exports | `a()` → 64-hex string (non-deterministic)<br>`b(input)` → 127-char custom encoding (deterministic, ChaCha20 transform) |
| Imports | 34 wbg imports (see [`../doc/Bundle_完整技术文档.md`](../doc/Bundle_完整技术文档.md) §5.3) |
| Load order | `captcha.js` decodes Us()[10] → custom base64 + URI decode → WebAssembly.instantiate |

Extraction method:

```bash
# Method 1: Extract directly from captcha.js (if you have captcha.js)
node bundle/stample/helpers/extract_wasm.js captcha.js
# Output: px_captcha.wasm

# Method 2: Use wabt to verify WASM structure
wasm-objdump -h px_captcha.wasm    # section info
wasm-objdump -j data px_captcha.wasm | head -50    # data segment (contains ChaCha20 seed)
wasm-objdump -j Import px_captcha.wasm    # 34 wbg imports
wasm2wat px_captcha.wasm -o px_captcha.wat   # convert to WAT text format
```

⚠️ **WASM internal constants change every build** (ChaCha20 seed 32 bytes, custom alphabet 24 chars, HMAC key). If the SHA doesn't match this one:
1. Capture the new captcha.js
2. Re-extract WASM
3. Use `wasm-objdump -j data` to diff constants
4. Run [`../stample/helpers/run_wasm.js`](../stample/helpers/run_wasm.js) to test a()/b() outputs

See [`../doc/Bundle_完整技术文档.md`](../doc/Bundle_完整技术文档.md) §5 + §16.4 for details.

### 2.4 `main_legacy_pre_split.js` — Legacy PX (Merged SDK)

The **early version** of PX's main.js (around the first half of 2024), where **captcha + collector code lived in one file** (10,684 lines). The state before captcha.js was split out.

| Dimension | Value |
|---|---|
| TAG | `DhI0E0h7J2cKHw==` (**legacy**, differs from current `U0MmDhUmOnhXSw==`) |
| AppID | `PXO1GDTa7Q` (same as current) |
| OB XOR key | `120` (legacy) |
| Contains captcha | ✅ (grep "captcha" 16 matches; PX1135/PX762/PX12634 each 4 times) |
| Contains PoW | ✅ (contains Bs/poi/sha256) |
| Contains WebAssembly load | ✅ (grep "WebAssembly" 1 match) |
| Split progress | **Not split** (one file handles everything) |

**Uses**:
- Historical comparison (see how PX evolved from merged SDK to main.min.js + captcha.js split)
- The SDK shape that legacy reverse materials (e.g., Pr0t0ns v8.9.6) correspond to
- Cross-version grep of algorithm-layer magic constants (validate algorithm is unchanged in 3 years)

Cannot directly run in production — TAG / OB XOR key / b64 key dictionary all differ from current iFood.

## 3. Relationship Between the 4 Files

```
2024 early version (merged SDK)
   ↓
   ├──→ main_legacy_pre_split.js
   │    (this) 430 KB, captcha + collector both inside
   │
   │     PX later split into two files ──→
   │
   ▼
2024-2026 current version (split SDK)
   ↓
   ├──→ main.min.js (this) — Collector main entry + Bundle dispatch
   │    231 KB obfuscated, 10,653 lines
   │
   ├──→ main_pretty.js (this) — Deobfuscated / formatted
   │    527 KB, for reading
   │
   ├──→ captcha.js ❌ not saved
   │    Filename changes per browser load
   │    Embeds base64 of px_captcha.wasm
   │
   └──→ px_captcha.wasm (this) — Bundle WASM
        Decoded from captcha.js Us()[10]
        60 KB
```

## 4. captcha.js Dynamic Fetching

If you need the `captcha.js` itself (e.g., to compare new-version diffs or extract the EV2 b64 key dictionary), capture live:

### Method 1: CDP Auto-capture

```bash
python skill/cdp/scripts/cdp.py navigate "https://www.ifood.com.br/restaurantes"
# After browser load completes
python skill/cdp/scripts/cdp.py network 20    # wait 20 seconds
# In the Network listing, find URLs containing "captcha"
```

Or write a dedicated script:

```python
# capture_captcha_js.py
import asyncio
from cdp import CDPClient

async def main():
    async with CDPClient(...) as cdp:
        await cdp.navigate('https://www.ifood.com.br/')
        # Trigger captcha
        # (Run a loop similar to bundle/stample/helpers/trigger_captcha)

        captures = await cdp.capture_network(30)
        for req in captures:
            if 'captcha' in req['url']:
                # Use Network.getResponseBody to fetch
                body = await cdp.get_response_body(req['requestId'])
                with open('captcha.js', 'w') as f:
                    f.write(body)
                print(f'Saved {len(body)} bytes')
                break
```

### Method 2: Burst-Trigger the Challenge

```js
// trigger_captcha.js (run in browser console)
async function trigger() {
    for (let i = 0; i < 250; i++) {
        const r = await fetch('https://cw-marketplace.ifood.com.br/v1/...', {
            method: 'POST',
            headers: { 'Cookie': document.cookie }
        });
        if (r.status === 403) {
            const body = await r.json();
            if (body.blockScript) {
                console.log(`Triggered! Attempt ${i}. captcha URL:`, body.blockScript);
                // Browser auto-loads → save from Network
                return body.blockScript;
            }
        }
        await new Promise(r => setTimeout(r, 50));
    }
}
trigger();
```

Captured captcha.js filenames have a hash (e.g., `captcha_7f2a3b1c.js`); rename to `captcha.js` to save.

⚠️ captcha.js embeds a uuid; cannot reuse across sessions (gotcha #B16). The version you capture only matches that session.

## 5. Extracting SDK Internal Constants

### 5.1 Validate Algorithm-layer Magic Constants

```bash
cd bundle/source

# MD5 init A
grep -c "1732584193" main.min.js     # → 1
grep -c "1732584193" main_legacy_pre_split.js  # → 1

# HMAC ipad
grep -c "909522486" main.min.js      # → 1

# UUID v1 Gregorian epoch
grep -c "122192928e5" main.min.js    # → 2

# INT32_MAX (ml() hash)
grep -c "2147483647" main.min.js     # → ≥1

# TAG itself
grep -c "U0MmDhUmOnhXSw==" main.min.js  # → ≥1
```

Cross-version grep patterns: see [`../../skill/AI_re/references/locate-by-pattern.md`](../../skill/AI_re/references/locate-by-pattern.md).

### 5.2 Extract OB XOR Key

```bash
# Bundle-path OB XOR key is ml(gt) % 128
# Current gt = "DhY8E0h7J2cKHw==" → 120
node -e "
function ml(t){var r=0;for(var i=0;i<t.length;i++)r=(31*r+t.charCodeAt(i))%2147483647;return (r%900+100).toString();}
const gt = 'DhY8E0h7J2cKHw==';
console.log('XOR key =', parseInt(ml(gt)) % 128);
"
# → 120
```

### 5.3 Extract ChaCha20 Seed From WASM

```bash
wasm-objdump -j data px_captcha.wasm | head -30
# Find segment[0]'s 32 bytes; those are the suspected ChaCha20 seed
```

When the SDK upgrades cross-version, **these 32 bytes will almost certainly change**.

## 6. Relationship to Other Project Parts

| Resource | Path | Relationship |
|---|---|---|
| **Bundle EV templates + WASM helpers** | [`../stample/`](../stample/) | Decoded equivalents (templates / mouse_tracks / helpers / wasm same-SHA copy) |
| **Full technical doc** | [`../doc/Bundle_完整技术文档.md`](../doc/Bundle_完整技术文档.md) | 5,038 lines; includes all algorithm details |
| **Collector path SDK** (same main.min.js) | [`../../stample/ifood/source/main.min.js`](../../stample/ifood/source/main.min.js) | SHA identical; mirrored here |
| **Grubhub Collector SDK** | [`../../stample/grub/source/init.js`](../../stample/grub/source/init.js) | Grubhub uses init.js, not main.min.js |
| **Algorithm modules** | [`../../revers/`](../../revers/) | 9 modules (payload/pc/ob/sid/uuid etc.); Bundle reuses 7 |
| **Bundle-path gotchas** | [`../../bug_report/2_bundle_path.md`](../../bug_report/2_bundle_path.md) | 20 specific gotchas |

## 7. Integrity Check

```bash
cd bundle/source

# Verify all SHAs
sha256sum main.min.js
# Expected: b47a639cde9df4f91bdc4138ae0d64ebf7ce8c876a1e4c9967fd3af3d2975eb8

sha256sum main_pretty.js
# Expected: 61eba79a853753c5af06d6a52197bccbbeac9071dc241ad0abb30d388c85b340

sha256sum px_captcha.wasm
# Expected: 900a9b07c1de9cf37175a48470f77445dcb8515841d51469c0b24c207c8b090d

sha256sum main_legacy_pre_split.js
# Expected: 0868d0ac0d925dba9a58d0c7e8f8557cc638b15cbe66d9e53ece31d8e1edcd72

# Verify WASM magic
xxd px_captcha.wasm | head -1
# Expected: 0061 736d 0100 0000 ...   (= "\0asm" 01 00 00 00)

# Verify main.min.js contains required constants
grep -c "PXO1GDTa7Q" main.min.js      # should be ≥ 1
grep -c "U0MmDhUmOnhXSw==" main.min.js  # should be ≥ 1
grep -c "1732584193" main.min.js      # should be 1 (MD5 init)
```

---

## 8. Maintenance Notes

| Item | Value |
|---|---|
| Current version | iFood 2026-05 SDK |
| Captured | 2026-05-20 |
| Validation | 6 fresh batches + 10× live-generator runs; 10/10 pass (Collector path) |
| Bundle validation | 10/10 (Userscript), 70% (pure-algo) |
| Next SDK capture | When PX pushes a new version (typically 1-2× per month for main.min.js / every 2-3 weeks for captcha.js) |

Upgrade flow:
1. Capture new main.min.js + compute SHA
2. Diff against old version, see what changed
3. Run [`../../stample/ifood/script/verify_all.sh`](../../stample/ifood/script/verify_all.sh) to see whether decode-loop still passes
4. Capture new captcha.js + extract new WASM + compare SHA
5. If WASM changed, run [`../stample/helpers/run_wasm.js`](../stample/helpers/run_wasm.js) to check b() output

Detailed SDK drift response: see [`../doc/Bundle_完整技术文档.md`](../doc/Bundle_完整技术文档.md) §16.

---

*Established 2026-05-21. Source SDK collated from perimeterX_Re/sdk_artifacts/ + ifood-web production project.*
