# SDK Version Drift — Gotcha Collection

PX pushes a new SDK every week / month. **The algorithm layer hasn't moved in 3 years, but the surface layer rotates every time.** This page covers what cannot be hardcoded across versions and what must be re-extracted on every upgrade.

Unlike one-off debugging gotchas, this category is **structural** — you must follow these rules when writing code, or your entire generator will need a rewrite on the next SDK upgrade.

---

### #D1 ⭐⭐⭐ Handler Names + Line Numbers + Variable Names Rotate Across Versions

**Symptom**: a doc says "the `Zf` function is on line 4384"; the new SDK has neither `Zf` nor anything resembling that code at line 4384.

**Root cause**: PX's obfuscator runs anew on every SDK release:
- Variable names (`Zf`, `yI`, `_O1GDTa7Qhandler`, etc.) — almost always change
- Function body order (line numbers) — always change
- Handler key strings (`I0I0I0`, `oIIoII`, etc.) — always change

**Fix**: **don't locate by name**, locate by **shape**:
- Functions: grep by parameter count + types + return type (see [`skill/AI_re/references/locate-by-pattern.md`](../skill/AI_re/references/locate-by-pattern.md))
- Algorithms: locate by **magic constants** (MD5 init `1732584193`, HMAC ipad `909522486`, UUID v1 `122192928e5`, INT32_MAX `2147483647`) — **these haven't moved in 3 years**
- OB handlers: match by args shape (see [`skill/AI_re/references/handler-table.md`](../skill/AI_re/references/handler-table.md)), not by handler name

**Source**: archived upstream notes (not shipped); confirmed across multiple archives

---

### #D2 ⭐⭐⭐ OB Wire Charset Rotates per Version / Customer

**Symptom**: when manually locating an OB handler by `l0l0ll`, grep finds nothing; the new SDK uses `oIIoII`.

**Root cause**: PX uses different wire-encoding charsets across versions / customers:
- Older iFood: `o` / `1` (lowercase o + digit 1)
- Newer iFood: `0` / `l` (digit 0 + lowercase L)
- Current Grubhub: `I` / `o` (uppercase I + lowercase o)

**Fix**: dynamically determine the charset from real OB decode output; never hardcode. Handler shape matching uses args type/count and is **charset-independent**.

**Source**: archived upstream notes (not shipped)

---

### #D3 ⭐⭐⭐ EV1/EV2 b64 Key Dictionary Fully Reshuffled on Every Upgrade

**Symptom**: hardcoded b64 key → field value mappings don't line up with the new SDK's real payload.

**Root cause**: 229 b64 keys are dynamically generated in the SDK via "base array + rotation + offset lookup". PX regenerates the array / offset on every build; the entire table changes.

**Fix**:
- On every SDK upgrade run `skill/AI_re/scripts/extract_hQ.js` against the new SDK to extract the dictionary
- Or capture 6 fresh batches and run `find_state_keys.py` for cross-batch value matching
- **Never hardcode b64 key → field-semantic mappings as constants in the generator**

**Fix — even more robust approach**: use the "template method" in the generator — keep a real-capture EV2 as template, and only override a few DYNAMIC fields. The template's b64 keys match the current SDK = auto-follows versions.

**Source**: `ifood-web/collector无感纯算还原/纯算还原.md:454-455`

---

### #D4 ⭐⭐ Algorithm-Layer Magic Constants Haven't Changed in 3 Years — Safe to Hardcode

**Inverse gotcha**: this isn't a "you'll hit this" gotcha; it's a counter-example for **over-defensiveness**.

**Symptom**: out of fear of SDK upgrades, you parameterize every constant; code becomes messy, performance drops, bugs multiply.

**Root cause**: the constants in PX's algorithm layer (payload / PC / OB codec / UUID / Memory) are **the algorithm's own constants**, not chosen by PX:
- MD5 init `1732584193`, `-271733879`, `-1732584194`, `271733878`
- HMAC ipad `909522486` (0x36363636) / opad `1549556828` (0x5C5C5C5C)
- UUID v1 Gregorian epoch `122192928e5`
- INT32_MAX `2147483647`
- base91 alphabet `F@bt...` (newer SDK)

**Fix**: hardcode algorithm constants directly. Over 3 years of observation PX has never changed them — because changing them means it's no longer MD5/HMAC/UUID v1.

**What you should keep dynamic**: protocol constants (TAG / AppID / FT / Cookie name) + b64 key dictionary + field semantics.

**Source**: [`skill/AI_re/references/algorithm-chain.md`](../skill/AI_re/references/algorithm-chain.md); multiple archives

---

### #D5 ⭐⭐ Cross-Platform Porting Cannot Assume Field Semantics Are Invariant

**Symptom**: the iFood generator copied directly to Grubhub — logic all correct, but no `_px2`.

**Root cause**: even with the same SDK family, sites differ:
- state.* → EV2 b64 key is completely different ([1_collector_path.md gotcha #19](1_collector_path.md#19))
- Same semantic uses different keys in EV1 vs EV2 ([1_collector_path.md gotcha #20](1_collector_path.md#20))
- Field set sizes differ (iFood EV1=14, Grubhub EV1=12; EV2 also differs)
- Protocol POST counts differ (iFood 3 collector POSTs, Grubhub 2)
- OB wire charset differs (see #D2)
- TAG / AppID / FT differ (protocol constants)
- Cookie name + TTL differ (iFood `_px3` ttl 330, Grubhub `_px2` ttl 500)

**Fix**: run the full workflow per site:
1. CDP capture 6 batches
2. Run `verify_all.sh` to confirm decode-loop closure
3. Run `find_state_keys.py` to find state.* injection positions
4. Run `diff_samples.py` for three-class classification
5. Copy generator, change 5 constants + state.* keys

**Use the Stage 0-8 workflow in [`skill/AI_re/playbooks/master-workflow.md`](../skill/AI_re/playbooks/master-workflow.md); don't skip a stage.**

**Source**: all of archived upstream notes (not shipped); `stample/grub/` combat record

---

### #D6 ⭐⭐ `captcha.js` Upgrades Far More Frequently Than `main.min.js`; Bundle Templates Need Independent Versioning

**Symptom**: Bundle generator was 10/10 last week, half-failing this week; `main.min.js` unchanged (same SHA), but captcha.js changed.

**Root cause**: PX's upgrade cadence for `main.min.js` (silent collector) and `captcha.js` (press-challenge bundle) is **completely different**:
- `main.min.js` — minor changes 1-2 times per month
- `captcha.js` — **every 2-3 weeks**, including iframe HTML template tweaks (adds / removes an `<img>` tracking pixel, etc.)

Bundle#3's "Myanmar DOM encoding" (gotcha #B14) encodes the captcha iframe's DOM node count / tag type into Unicode. captcha.js changing an `<img>` → count changes → template is broken.

**Fix**:
- Track Bundle generator versions by **captcha.js SHA**, not main.min.js
- Maintain a separate "captcha.js SDK_INFO" + templates, independent of the main SDK_INFO
- Fetch captcha.js once before each Bundle run and check its SHA

**General rule**: **two paths, two SDK version management tracks**; don't mix them.

**Source**: `perimeterX_Re/docs/07_gotchas/19_myanmar_template_drift.md`

---

### #D7 ⭐⭐ Error Stack Template Drifts by **Chrome Major Version** (Not Just PX SDK)

**Symptom**: pure-algo Bundle template is 10/10 on Chrome 145, fully fails on Chrome 140 — same PX SDK version.

**Root cause**: line numbers in error stacks (the 4 errors in gotcha #B15) come from V8. Different V8 versions use different function-inlining strategies → the same code yields different stack-frame counts / line-number positions. PX's captcha.js encodes the "expected stack shape" against the then-mainstream Chrome version; it's bound to a Chrome major.

**Fix**:
- Maintain multiple error_stack templates by Chrome major (145 / 140 / 138 ...)
- The generator selects a template based on the `Chrome/<major>.0.0.0` in the outgoing UA
- Whichever Chrome major your UA pretends to be, use the matching template

**General rule**: whatever Chrome major your impersonated UA is, every "Chrome behavior template" (error stack, JS engine error messages, performance.memory ranges) must match that major version.

**Source**: `perimeterX_Re/docs/04_bundle/10_error_stacks.md` + `12_pure_algo_e2e_gap.md`

---

## Upgrade Workflow Overview (Responding to Every SDK Push)

```
PX pushes new SDK
   ↓
1. Re-capture SDK → check whether SHA matches the current SDK_INFO [skill/AI_re/playbooks/identify-sdk-version.md]
   ↓ changed
2. Run verify_all.sh → can the 9 reverse modules still decode new-SDK samples
   ↓ failed
3. Diagnose: algorithm layer or surface layer
   - Surface layer (b64 key / handler charset / line numbers) → re-extract templates + dictionary, don't touch reverse modules
   - Algorithm layer (XOR seed / 4 tildes / base91 alphabet) → very rare, but when it happens, re-reverse per reverse-algorithms.md
   ↓
4. Run diff_samples.py for new field set → which DYNAMIC fields shifted
   ↓
5. Use find_state_keys.py to recalibrate state.* → EV2 b64 key
   ↓
6. Update generator's state injection key + SDK_INFO.md's SHA
   ↓
7. smoke_test.js → 17/17 pass → 10/10 in real combat
```

Detailed steps: see [`skill/AI_re/playbooks/master-workflow.md`](../skill/AI_re/playbooks/master-workflow.md).

---

*This is the final page of the gotcha collection.*

**Back to [`README.md`](README.md) for the full directory.**
