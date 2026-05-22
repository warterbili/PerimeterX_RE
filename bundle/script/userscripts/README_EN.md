# Bundle Userscript

> ⚠️ Only 1 retained — `px_bundle3_auto.user.js`, 2,131 lines / 237 KB, **production 10/10 verified artifact**.
>
> Previously I (AI) wrote 5 fabricated placeholder scripts; those have been cleaned up. **Only the real thing remains here**.

## `px_bundle3_auto.user.js` — Complete Pure-Algo Press Challenge

**Core idea**: "pure-algo press challenge" ≠ "simulate button click". Let the PX SDK send Bundle#1/#2 itself → we hook to intercept responses → **compute Bundle#3 ourselves and directly fetch() POST**. The press button is never touched.

### Embedded Fully Self-contained Components

```
Part 1: Pure JS SHA256 (synchronous PoW solver)             line 23-79
Part 2: Embedded full reverse modules                       line 82-695
   ─ ob.js (decodeOb, executeSegments, writePx3Cookie, processOb)
   ─ payload.js (serialize, b64, interleave, generatePayload)
   ─ pc.js (MD5, HMAC-MD5, generatePC)
   ─ sid.js (hh, generateSid)
   ─ uuid / solvePow / ml / xorStr

Bundle #3 Generic Events Builder                           line 696-1264
   ─ Event #0 browser fingerprint (78 fields)
   ─ Event Metrics ⭐ (18 fields)
   ─ Event #1 mouse interaction (20 fields)
   ─ Event #2 PX561 core (95 fields)
   ─ Event #3 Captcha completion callback (27 fields)
   ─ Event #4 PX11994 interaction summary (24 fields)
   ─ buildBundle3Events() / buildOpts()

Part 3: fetch/XHR Hook intercepting B1/B2                   line 1266-1615

Part 3.5: iframe Hook + appendChild MutationObserver       line 1617-2090
   ─ hookIframeXHR(iframe)  ← captcha is inside an iframe; must hook
   ─ Hook appendChild — synchronously detect iframe insertion

Console API                                                 line 2091-2131
   ─ __pxAutoState
   ─ __pxCaptchaState
   ─ __pxBuildB3()
   ─ __pxReset()
```

### Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) in your browser
2. In Tampermonkey Dashboard → New Script → paste `px_bundle3_auto.user.js` contents → save

### Usage

```
1. Install the script (as above)
2. Visit https://www.ifood.com.br/
3. Browse or actively cause the PX backend to scale you up to the Bundle challenge (run business APIs ~200 times → get blockScript)
4. The script automatically:
   - Intercepts Bundle#1 → decodes OB#1 → extracts state.* + PoW params
   - Solves PoW (~9-60ms synchronous SHA-256 brute force)
   - Runs WASM a() / b(powAnswer)
   - Intercepts Bundle#2 → decodes OB#2 → obtains first _px3 (jf=cu)
   - Constructs Bundle#3 itself (6 events) → fetch POSTs directly
   - Intercepts Bundle#3 response → extracts valid _px3 → writes to document.cookie
5. Watch [PX-AUTO] logs in F12 console

Console commands:
  > __pxAutoState           view main-page interception state
  > __pxCaptchaState        view captcha iframe state
  > __pxBuildB3()           manually trigger B3 build (debug)
  > __pxReset()             reset all state
```

## Origin + History

| Time | Event |
|---|---|
| 2026-03-01 | `sourcing-cracked` first commit (`f256b7e`); 2,131-line user.js |
| 2026-04-02 | `007623b` cleanup commit **deleted this user.js outright** (and added build_userscript.js builder + crypto_hook.user.js) |
| 2026-04-02 → 2026-05-21 | The artifact existed only in git history + GitHub `warterbili/px3cookie` mirror. build_userscript.js had a line-319 escape syntax error and couldn't run |
| 2026-05-21 | Extracted from git f256b7e and restored to this directory. SHA `a432e016422233cc1b61790b4dc99991da9579244ec40092ccbdddb52ecdd744` |

SHA is **byte-for-byte identical** to git f256b7e original.

## Relationship to build_userscript.js

`../../stample/helpers/build_userscript.js` is theoretically the "builder" that reconstructs this user.js from WASM base64 + 5 trajectories + generator code. But:

- ⚠️ **line 319 template-string nested-escape error; doesn't run**
- ⚠️ Bundle is archived; **no plan to fix** this builder

If PX pushes a new SDK and you need to regenerate user.js:
- Option A: manually patch this 2,131-line artifact (laborious but workable)
- Option B: first fix build_userscript.js line 319 (requires understanding template-string nested escaping)

In practice, the builder code stample/helpers/build_userscript.js has now also been deleted (cleaned up during archiving; only user.js itself remains).

## Companions

| What you want | Where |
|---|---|
| Bundle full technical doc | [`../../doc/Bundle_完整技术文档.md`](../../doc/Bundle_完整技术文档.md) |
| WASM binary | [`../../source/px_captcha.wasm`](../../source/px_captcha.wasm) |
| Bundle path gotchas (20) | [`../../../bug_report/2_bundle_path.md`](../../../bug_report/2_bundle_path.md) |

---

*This is the sole retained production script of the Bundle path. Other fabricated placeholders were cleaned.*
