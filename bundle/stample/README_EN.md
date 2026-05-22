# Bundle Path Sample Directory

⚠️ **Differs from the Collector path's `stample/{ifood,grub}/sample/`**.

The Collector path saved **flat-file raw POST/response captures** (`request_*.txt` + `response_*.json` + `decoded_*.json`; 11 files per batch).

**The Bundle path did NOT preserve this kind of flat-file raw capture** — historical reverse-engineering work was done via browser hooks + Tampermonkey runs, and POST body / OB responses were never persisted to disk.

But Bundle has its own "real data + equivalents":

| Type | Path | Count | Value |
|---|---|---|---|
| ✅ Real mouse trajectories | [`mouse_tracks/`](mouse_tracks/) | 5 | ~544-point trajectories captured from real human presses |
| ✅ EV payload templates | [`ev_templates/`](ev_templates/) | 5 | 4 Bundle EV templates + 1 cross-platform generic |
| ✅ Behavioral synthesis tools | [`helpers/`](helpers/) | 6 | Error stacks / Myanmar / WASM extract+run / userscript build |
| ✅ WASM binary | [`wasm/`](wasm/) | 60,862 bytes | Real px_captcha.wasm + analysis doc |
| ❌ Raw POST body | — | 0 | Not saved (historical) |
| ❌ Raw OB response | — | 0 | Same |

If you want to capture raw Bundle traffic and produce flat-file samples (same as ifood/sample/N/), see [§4](#4-how-to-add-real-raw-captures-in-the-future) for capture-script planning.

---

## 1. Directory Structure

```
bundle/stample/
├── README.md              This file
│
├── mouse_tracks/          ⭐ 5 real captured mouse trajectories
│   ├── track_001.json    one press trajectory (~544 points + timestamps)
│   ├── track_002.json    same
│   ├── track_003.json
│   ├── track_004.json
│   ├── track_005.json
│   ├── mouse_trajectory.js  Bezier curve generator
│   ├── generate_tracks.js    Synthesized trajectory tool
│   └── gen_mouse_pool.js     Trajectory pool builder
│
├── ev_templates/          ⭐ Bundle EV payload templates (5)
│   ├── bundle#1.js       Bundle#1 EV 16-field template
│   ├── bundle#2.js       Bundle#2 EV 228-field template (with real fingerprint hashes)
│   ├── bundle#3.js       Bundle#3 EV 5-event template
│   ├── bundle#4.js       Bundle#4 telemetry template
│   └── bundle3_generic.js  Cross-platform version (all constants parameterized)
│
├── helpers/               ⭐ Behavioral synthesis + WASM tools
│   ├── error_stack.js     4-group V8 error stack template generation
│   ├── myanmar_encode.js  DOM tag → Myanmar Unicode encoding
│   ├── extract_wasm.js    Extract WASM from captcha.js
│   ├── run_wasm.js        Run WASM in Node.js (with _pxUuid mock)
│   ├── gen_bundle3.js     Bundle#3 full generator
│   └── build_userscript.js  Build Tampermonkey script from all helpers
│
└── wasm/                  ⭐ WASM binary + analysis
    ├── px_captcha.wasm   60,862-byte real WASM
    ├── extract_wasm.js   Extract script (same as helpers/)
    ├── run_wasm.js       Run script (same)
    └── WASM_ANALYSIS.md  WASM decompilation analysis doc
```

## 2. Sub-Directory Details

### 2.1 `mouse_tracks/` — 5 Real Mouse Trajectories

Each `track_NNN.json` is **the complete mouse trajectory captured from a real human pressing the captcha challenge**. Format:

```json
{
  "mouseTrackFull": [
    "532,843,18189",   // x,y,timestamp (ms)
    "431,637,18190",
    ...
    // Usually 540-600 points
  ],
  "mouseTrackFiltered": [
    "532,843,18189",
    "362,514,18195",
    // ~half sampling (every other point)
  ],
  "mouseInteractions": [
    {
      "type": "mouseover",
      "ts":   18200,
      "x":    370,
      "y":    520,
      "target": "DIV"
    },
    // 30+ items
  ],
  "pointerdown": { "offsetX": 309.5, "offsetY": 17.44, "clientX": 602.5, "clientY": 364, "ts": 37468 },
  "pointerup":   { "offsetX": 309.5, "offsetY": 17.44, "clientX": 602.5, "clientY": 364, "ts": 38936 }
}
```

**Usage**: generator picks a random trajectory from the 5-pool → align start/end to current press coordinates → redistribute timestamps → add ±1px ±5ms jitter → inject into Bundle#3 PX561 field.

⚠️ **5-pool is too small**; running 50+ sessions gets clustered by PX's long-term behavioral analysis (gotcha #B19). Production recommendation: expand to 50-100.

Tools:
- `mouse_trajectory.js` — cubic Bezier 544-point synthesizer
- `generate_tracks.js` — batch-synthesize new trajectories
- `gen_mouse_pool.js` — mix multiple real captures + synthesized into a trajectory pool

### 2.2 `ev_templates/` — Bundle EV Payload Templates

These **are not raw captures**; they're **EV data structures organized post-reverse-engineering** — similar to Collector path's `decoded_payload_*.json` but in JS code form (with field-meaning comments + dynamic compute logic).

| File | Lines | EV fields | Contents |
|---|---|---|---|
| `bundle#1.js` | 27 | 16 | `buildBundle1Event(uuid)` — initial fingerprint |
| `bundle#2.js` | 254 | 228 | `buildBundle2Event(opts)` — full fingerprint + state.* + PoW + WASM |
| `bundle#3.js` | 631 | 5 events (78+20+95+27+24=244 fields) | `buildBundle3Events(opts)` — press challenge |
| `bundle#4.js` | 159 | telemetry | `buildBundle4Event(...)` — error reporting |
| `bundle3_generic.js` | 575 | Same as #3 | Cross-platform (all constants parameterized) |

Every file has detailed top comments; e.g., `bundle#2.js` fields are tagged with type + source + whether they need per-call generation:

```js
"JxwXHWF2Ey4=": opts.serverTs,       // #1  ob server timestamp
"GC8oLl1DLxs=": 1,                   // #2  blockScript flag (hardcoded)
"DXJ9M0sVcgU=": "TypeError: ...",   // #4  error stack (must align with SDK version)
"eyBLYT1GTFc=": "4f19f01bd85bb...",  // #10 composite fingerprint MD5 (hardcoded per browser profile)
"EwhjCVZnZTM=": opts.obAppId,        // #11 ob appId (changes per session)
// ...
```

**Uses**:
1. Use these as the generator's starting point (don't write from scratch)
2. Learn the semantic of EV fields
3. For cross-platform porting, change b64 keys + constant hashes

### 2.3 `helpers/` — Behavioral Synthesis + WASM Tools

Bundle-path-specific 5-piece set implementations:

| File | Lines | Functionality |
|---|---|---|
| `error_stack.js` | 61 | 4-group V8 error stack template generation |
| `myanmar_encode.js` | 86 | DOM tag count → JSON → XOR(4210) → base64 → Myanmar characters |
| `extract_wasm.js` | 213 | Extract WASM from captcha.js via 10 decode paths |
| `run_wasm.js` | 251 | Run WASM in Node.js (with `_pxUuid` mock + `instanceof_Window` mock) |
| `gen_bundle3.js` | 166 | Bundle#3 full generation entry (chains all helpers) |
| `build_userscript.js` | 1,107 | Package all helpers into a Tampermonkey userscript |

Detailed usage + code comments in each file's top.

### 2.4 `wasm/` — WASM Binary + Decompilation

| File | Size | Contents |
|---|---|---|
| `px_captcha.wasm` | **60,862 bytes** | Real PX WASM module (iFood `PXO1GDTa7Q` current version) |
| `extract_wasm.js` | 7,714 | Extract script (same as helpers/) |
| `run_wasm.js` | 10,728 | Run script (same as helpers/) |
| `WASM_ANALYSIS.md` | 384 lines | WASM decompilation analysis (imports / exports / ChaCha20 seed extraction) |

**WASM SHA-256**:

```bash
sha256sum bundle/stample/wasm/px_captcha.wasm
# → 900a9b07c1de9cf37175a48470f77445dcb8515841d51469c0b24c207c8b090d
```

⚠️ WASM **updates every 2-3 weeks** (gotcha #D6). If your SHA differs, captcha.js has been upgraded; you need to:
1. Capture new captcha.js
2. Extract new WASM with `extract_wasm.js`
3. Diff the data section to see whether ChaCha20 seed and other constants changed
4. Re-run `run_wasm.js` to check b() output

See `bundle/doc/Bundle_完整技术文档.md` §16 (SDK drift response) for details.

## 3. Mapping to Collector Path (`stample/{ifood,grub}/sample/`)

| Collector concept | Bundle equivalent | Notes |
|---|---|---|
| `sample/N/request_1.txt` (raw POST body) | ❌ none | Historical; not saved |
| `sample/N/response_1.json` (raw OB) | ❌ none | Same |
| `sample/N/decoded_payload_1.json` | ✅ `ev_templates/bundle#1.js` | EV structure equivalent (JS form with comments) |
| `sample/N/decoded_payload_2.json` | ✅ `ev_templates/bundle#2.js` | 228 fields |
| `sample/N/decoded_response_1.json` (state.*) | ⚠️ partial | state-extraction logic in `bundle/doc/Bundle_完整技术文档.md` §3.5 |
| `sample/N/meta.json` | ⚠️ partial | Constants in `bundle/doc/Bundle_完整技术文档.md` Appendix A |
| `px_cookie/ifood_px3.js` (generator) | ✅ `helpers/gen_bundle3.js` | Bundle main entry |
| `script/decode_*.sh` | ⚠️ pending | Future: add Bundle-specific decode shell scripts |
| `script/verify_all.sh` | ❌ none | Because no raw samples to verify |
| `source/main.min.js` + `SDK_INFO.md` | ⚠️ Bundle uses `captcha.js` | See [`../source/`](../source/) (pending) |

## 4. How to Add Real Raw Captures in the Future

If you ever want Bundle to also have `stample/{ifood,grub}/sample/N/`-style raw flat-file structure, **you must recapture**. Flow:

### 4.1 Write a Bundle Capture Script

`skill/cdp/scripts/capture_via_cdp_ifood_bundle.py` (pending), logic:

```python
1. Launch Chrome via CDP
2. Run trigger_captcha.js to trigger 403 + blockScript
3. After captcha.js loads, intercept via Network domain:
   - POST /assets/js/bundle?seq=0&rsc=1 → save bundle1_request.txt
   - Response → save bundle1_response.json
   - Same for seq=1/2/3 → bundle2/3/4
4. User completes the press challenge inside the iframe
5. Output per batch:
   bundle_samples/N/
     bundle1_request.txt
     bundle1_response.json
     bundle2_request.txt
     bundle2_response.json
     bundle3_request.txt
     bundle3_response.json
     bundle4_request.txt    (optional, depends on whether sent)
     meta.json
```

### 4.2 Write Decode-Loop

`bundle/script/decode_bundle.sh` (pending):

```bash
# Decode all of bundle/stample/sample/N/ using revers/ modules
node ../../skill/AI_re/scripts/decode_payload.js bundle_samples/$N/bundle1_request.txt \
    > bundle_samples/$N/decoded_payload_1.json
# Same for #2 #3
node ../../skill/AI_re/scripts/decode_response.js TAG bundle_samples/$N/bundle1_response.json \
    > bundle_samples/$N/decoded_response_1.json
# Same for #2 #3
```

### 4.3 Cross-Batch Diff

After capturing 6+ batches:
```bash
node ../../skill/AI_re/scripts/diff_samples.js bundle_samples/{1..6}/decoded_payload_2.json
# → three-class field classification: STATIC ~160, DYNAMIC ~50, CONDITIONAL ~18
```

## 5. Companion Resources

| What I want | Where |
|---|---|
| Bundle full technical doc | [`../doc/Bundle_完整技术文档.md`](../doc/Bundle_完整技术文档.md) (5,038 lines) |
| Bundle gotchas (20 specific) | [`../../bug_report/2_bundle_path.md`](../../bug_report/2_bundle_path.md) |
| Algorithm-layer modules | [`../../revers/`](../../revers/) (Bundle reuses 7; pending pow.js + wasm.js) |
| AI agent reverse skill | [`../../skill/AI_re/`](../../skill/AI_re/) |
| Capture skill | [`../../skill/cdp/`](../../skill/cdp/) |
| Collector path comparison | [`../../stample/ifood/`](../../stample/ifood/) / [`../../stample/grub/`](../../stample/grub/) |

---

## 6. Integrity Check

```bash
# 1. 5 mouse trajectories exist
ls -la bundle/stample/mouse_tracks/track_*.json
# Expected: 5 files, ~10 KB each

# 2. EV templates exist
ls -la bundle/stample/ev_templates/bundle*.js
# Expected: 5 files (bundle#1-4 + bundle3_generic)

# 3. WASM SHA still current version
sha256sum bundle/stample/wasm/px_captcha.wasm
# Expected: 900a9b07c1de9cf37175a48470f77445dcb8515841d51469c0b24c207c8b090d

# 4. WASM magic header correct
xxd bundle/stample/wasm/px_captcha.wasm | head -1
# Expected start: 0061 736d 0100 0000 (= \0asm 01 00 00 00)
```

---

*Established 2026-05-21. This directory aggregates all "non-raw-capture" assets of the Bundle path. Future raw captures, when collected, will populate the `sample/` subdirectory (see [§4](#4-how-to-add-real-raw-captures-in-the-future)).*
