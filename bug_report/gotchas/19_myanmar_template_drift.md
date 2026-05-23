# Gotcha 19 — Myanmar DOM template must match captcha iframe

## Symptom

Bundle #3 was working last week. This week it fails. No code change on
your side. The PX SDK SHA hasn't changed in `stample/ifood/source/`. The
WASM SHA hasn't changed either. PoW works, WASM `a()/b()` outputs look
fine. But Bundle #3 still rejects.

You check captcha.js (`stample/ifood/source/captcha.js`) and notice it's been
updated.

## Root cause

PX rotated the **captcha iframe HTML template** (which is shipped inside
`captcha.js`, not `main.min.js`). The Myanmar field encodes DOM tag counts
of the iframe; if PX added or removed an element, the counts shift, and
your hardcoded template no longer matches.

For example:

- Old template: `{html:1, head:1, meta:3, ..., iframe:2}`
- New template (added a tracking pixel): `{html:1, head:1, meta:3, ...,
  img:1, iframe:2}`

If you serialize the old template, decode-server sees DOM-tampering and
rejects.

## Why it was hard to find

- `captcha.js` updates more often than `main.min.js`; you might not be
  tracking it
- The Myanmar field is opaque base64 by the time you inspect it
- The failure looks like a generic "something is wrong"
- One element of difference is enough; just `img:1` added is enough

## Fix

Refresh the template on every captcha.js update:

```bash
# 1. Refresh captcha.js
node skill/cdp/scripts/src/fetch_sdk.py \
    --url https://client.px-cloud.net/PXO1GDTa7Q/captcha.js \
    --out stample/ifood/source/captcha.js

# 2. Extract the iframe template from the new captcha.js
node bundle/stample/helpers/extract_wasm.js \
    stample/ifood/source/captcha.js \
    > bundle/stample/ev_templates/bundle3_generic.js
```

Then `myanmar_encode.js` reads `iframe_template.json` at runtime instead
of using a hardcoded constant.

Alternatively, set up the SDK-drift workflow to auto-detect captcha.js
changes (similar to the main SDK drift detection in
<!-- removed broken link: ../../.github/workflows/sdk_drift_detection.yml -->).

## Regression test

```js
const tpl = require('bundle/stample/ev_templates/bundle3_generic.js');
const encoded = encodeMyanmar(tpl);
const decoded = decodeMyanmar(encoded);
assert.deepStrictEqual(decoded, tpl);
```

And a live integration test:

```js
const sdkCaptchaSha = sha256OfFile('stample/ifood/source/captcha.js');
const tplSha        = sha256OfFile('bundle/stample/ev_templates/bundle3_generic.js');
assert.ok(checkTemplateMatchesSdk(sdkCaptchaSha, tplSha),
          'iframe template out of sync with captcha.js');
```

## Provenance

- captcha.js gets updated ~every 2-3 weeks (faster than `main.min.js`)
- Real template observed 2026-05-20:
  `{html:1, head:1, meta:3, title:1, style:2, script:4, body:1, div:7, br:1, iframe:2}`

## Related

- [`docs/04_bundle/09_myanmar_encoding.md`](../../main/EN/PX_Bundle_Reverse_Methodology.md)

## End of Phase 2 gotchas

→ [Part 8: Platforms](../../main/EN/methodology/08_cross_platform.md)
