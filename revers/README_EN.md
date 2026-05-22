# `revers/` — PX SDK 9 Algorithm Pure-Algo Reconstruction (Node.js)

Pure JavaScript implementations of the 9 cryptographic / encoding / serialization algorithms used by PerimeterX SDK's silent Collector path. **Doesn't run the SDK, doesn't open a browser, doesn't use a V8 sandbox** — `require()` is all you need to generate / decode PX protocol data in any Node process.

## Status

| Dimension | Status |
|---|---|
| Source | Statically deobfuscated from real iFood + Grubhub SDKs + cross-referenced with 6 batches × 2 sites of captures |
| Validation | Decode round-trip passes for all 12 batches against iFood `main.min.js` (sha `b47a639c…`) + Grubhub `init.js` (sha `5e81bffc…`) |
| Combat | iFood 10/10 + Grubhub 10/10 end-to-end generators use these 9 modules to obtain `_px3` / `_px2` |
| Cross-version | Algorithm layer hasn't moved in 3 years; these 9 modules directly reuse on every PX SDK push |

**Canonical top-level location** — `skill/AI_re/reverse/` used to be another copy (byte-for-byte identical); deleted during the 2026-05-21 duplication cleanup. All generators now `require('../../../revers/...')` pointing to this directory.

---

## 9 Modules at a Glance

| File | Default export / named exports | One-liner |
|---|---|---|
| `payload.js` | `generatePayload(events, serverTs, uuid)` | EV array → POST `payload=` string (serialize → XOR(50) → b64 → interleave) |
| `pc.js` | `generatePC(events, uuid, tag, ft)` | events + uuid + tag + ft → 16-digit pure-numeric checksum |
| `ob.js` | `processOb(json, gt)` + named `decodeOb` / `solvePow` / `ml` / `buildSid` | Collector response `.ob` segment decoding + handler dispatch |
| `sid.js` | `generateSid(pxsid, serverTs)` | Plane-14 Unicode Tag Chars steganography → POST `sid=` |
| `uuid.js` | Named `uuidV1` / `getUUID` / `resetUUID` / `setUUID` / `formatUUID` / `getRandomBytes` | RFC 4122 v1 (with PX-compatible clockseq) |
| `hash.js` | Named `generateHash` / `Kt` | djb2 variant |
| `memory.js` | Named `generateMemory` / `JS_HEAP_SIZE_LIMIT` | `performance.memory` triple synthesis |
| `antitamper.js` | Named `generateAntiTamper` / `te` | Dynamic XOR key/value injection position |
| `ns.js` | `fetchNs(uuid, appId)` | GET `tzm.px-cloud.net/ns?c=<uuid>` sync |

⚠️ `ob.js`'s exports are a bit "wild": `module.exports = processOb` **simultaneously** attaches `.decodeOb` / `.solvePow` / `.ml` / `.buildSid` / `.getParams` on the function object. So both of the following work:

```js
const processOb = require('./ob');          // default
const { decodeOb, ml } = require('./ob');   // named — generators use this
```

---

## Minimal Demo (Decode an iFood Capture in 10 Lines)

```javascript
const fs = require('fs');
const { decodeOb } = require('./revers/ob');

const TAG = 'U0MmDhUmOnhXSw==';   // iFood fixed TAG (Grubhub uses 'FmYgK1gdJEAP')
const resp = fs.readFileSync('stample/ifood/sample/1/response_1.json', 'utf8');

const { segments, results, state } = decodeOb(resp, TAG);
console.log('segments:', segments.length);          // 10
console.log('state.no:', state.no);                 // "1779263..."
console.log('state.qa:', state.qa);                 // 64 hex
```

---

## End-to-end Generators (Production-verified)

| Site | Entry | Reverse modules used |
|---|---|---|
| iFood | [`stample/ifood/px_cookie/ifood_px3.js`](../stample/ifood/px_cookie/ifood_px3.js) | payload / pc / ob / sid / uuid / memory / ns |
| Grubhub | [`stample/grub/px_cookie/grubhub_px2.js`](../stample/grub/px_cookie/grubhub_px2.js) | payload / pc / ob / sid / uuid / memory |

The generators' `require` currently points here:

```javascript
const generatePayload = require('../../../revers/payload');   // from stample/*/px_cookie/
```

---

## Relationship to Other Parts of the Project

| Companion | Path |
|---|---|
| Algorithm principles + formulas | [`main/ZH/PX_SDK_逆向技术文档.md`](../main/ZH/PX_SDK_逆向技术文档.md) §Algorithm Layer |
| Algorithm chain one-pager | [`skill/AI_re/references/algorithm-chain.md`](../skill/AI_re/references/algorithm-chain.md) |
| 27 OB handler shape-matching table | [`skill/AI_re/references/handler-table.md`](../skill/AI_re/references/handler-table.md) |
| Module consumers (generators) | [`stample/ifood/px_cookie/`](../stample/ifood/px_cookie/) + [`stample/grub/px_cookie/`](../stample/grub/px_cookie/) |
| Module validation (decode loop) | [`stample/{ifood,grub}/script/verify_all.sh`](../stample/) |
| AI agent also uses this | [`../skill/AI_re/`](../skill/AI_re/) (references revers/; no separate copy) |

---

## What's NOT Here

| Not here | Where it is |
|---|---|
| Bundle path (captcha.js) PoW / WASM | **Not in this directory**. `ob.js` has `solvePow` but only as a skeleton; the full press path is in [`main/ZH/PX_SDK_逆向技术文档.md`](../main/ZH/PX_SDK_逆向技术文档.md) §Bundle |
| CLI tools (decoders, diff, replay) | [`skill/AI_re/scripts/`](../skill/AI_re/scripts/) + [`stample/{ifood,grub}/script/`](../stample/) |
| Real capture samples | [`stample/ifood/sample/`](../stample/ifood/sample/) + [`stample/grub/sample/`](../stample/grub/sample/) |
| SDK source code | [`stample/ifood/source/`](../stample/ifood/source/) + [`stample/grub/source/`](../stample/grub/source/) |

---

## How to Verify These 9 Modules Are Still Compatible With the Current SDK

```bash
# iFood 6-batch decode round-trip
cd stample/ifood/script && ./verify_all.sh

# Grubhub 6 batches
cd stample/grub/script && ./verify_all.sh
```

All 12 batches passing = the 9 modules work. Any batch failing — diagnose via [`skill/AI_re/playbooks/validate-generator.md`](../skill/AI_re/playbooks/validate-generator.md) decision tree.

---

*9 modules, 12-batch round-trip validation passed; verified 2026-05-21.
When PX pushes a new SDK, you don't necessarily rewrite — first check whether the algorithm-layer magic constants (MD5 init / HMAC ipad / UUID v1 / INT32_MAX) are still present in the new SDK: in 3 years they have never changed.*
