# Environment / Infrastructure — Gotcha Collection

Algorithm-agnostic issues that can cause a 100% correct generator to still get rejected — the "environment layer".
**Rule out these before suspecting algorithm bugs.**

---

### #E1 ⭐⭐⭐ PX Server IP Throttling: Consecutive Calls Trigger "Fake Failures"

**Symptom**: the first 3 runs return 200 + `_px2`/`_px3`; after running 5-10 times fast, random 403s appear; restarting the script → a few more succeed; changing the algorithm doesn't help.

**Root cause**: PX backend throttles **per-IP collector POST frequency**. If your script runs collector#1+#2 at 1.5-2s intervals, 10 consecutive calls trigger IP throttling (**not an algorithm bug**).

**How to determine throttling vs algorithm bug**:
- Switch IP (hotspot / proxy) and retry immediately → instant success = throttling
- Wait 30s and retry → success = throttling
- The byte-for-byte algorithm output is identical to a successful run = throttling

**Fix (dev phase)**: when testing stability, **interval ≥ 15-30s between runs**.

**Fix (production)**:
- Dedicate a residential IP per account (recommended: BrightData residential)
- Bootstrap 60 accounts in batches of 10; 60s between batches
- Per-IP per-account ≤ a few dozen collector calls per day

**Source**: archived upstream notes (not shipped); archived upstream notes (not shipped)

---

### #E2 ⭐⭐⭐ User-Agent Must Not Contain `Scrapy/`

**Symptom**: all requests 403 "Forbidden"; the server returns no error details; any other UA works immediately.

**Root cause**: iFood has a UA blocklist at the WAF layer; the literal string `Scrapy/` is rejected. Measured: `Scrapy/2.12.0 (+https://scrapy.org)` rejected 30/30.

**Fix**: use Chrome / Firefox / Safari / `python-requests` / custom — anything is fine; **avoid** any string containing `Scrapy/`.

**Note**: when picking a custom UA, also avoid obvious keywords like `bot` / `crawler` / `spider`.

**Source**: `ifood-web/pentest_api/doc/02_ifood_risk_control_analysis.md:146-149`

---

### #E3 ⭐⭐⭐ TLS Fingerprinting Is Done **Per-Domain** (Not Site-Wide)

**Symptom**: `marketplace.ifood.com.br` works with Python `requests`, but the same request to `cw-marketplace.ifood.com.br` returns 403; same IP, same headers.

**Root cause**: iFood subdomains go through different CDNs:
- `marketplace.*` → Akamai (**does not** check TLS fingerprint)
- `cw-marketplace.*` → Cloudflare WAF (**strictly** checks TLS)

Python `requests`' TLS fingerprint (curl/OpenSSL style) ≠ Chrome's. Cloudflare detects it and rejects.

**Fix**: for Cloudflare-protected subdomains, use `curl_cffi` (Chrome TLS impersonation). Plain Akamai subdomains work fine with `requests`.

```python
# ❌ Doesn't work against cw-marketplace
import requests
requests.get("https://cw-marketplace.ifood.com.br/...")

# ✅ Use curl_cffi
from curl_cffi import requests
requests.get("https://cw-marketplace.ifood.com.br/...", impersonate="chrome120")
```

**Source**: `ifood-web/pentest_api/doc/02_ifood_risk_control_analysis.md:170-175, 5.2-5.5`

---

### #E4 ⭐⭐ Bash Parses `$a`: shells eat `$a` inside `node -e` as empty string

**Symptom**: running `node -e "..."` from bash to test crypto algorithms produces garbled key output; the same code in a file works.

**Root cause**: bash performs variable expansion on `"..."` double-quoted strings before executing. `$a` not defined → replaced with empty. So `var $a = ...` or any literal `$a` in code (e.g., some obfuscated code) gets eaten.

**Fix**:
- Write to a file and run: `node script.js` instead of `node -e "..."`
- If you must inline: use single quotes `'...'` (bash doesn't expand), or escape `\$a`
- PowerShell doesn't have this issue (use `$null` etc.), but has its own special-character problems

**Source**: `ifood-web/collector无感纯算还原/纯算还原.md:639, 1931`

---

### #E5 ⭐⭐ Python `requests` Drops Unicode Variation Selectors Inside sid

**Symptom**: Python correctly implements the sid algorithm, but the server rejects what's sent; the same code in Node passes.

**Root cause**: sid contains Plane 14 Unicode Variation Selectors (U+E0100+), invisible to the eye. Python `requests` URL-encodes by default; some versions drop / convert them to `?`.

**Fix**:
```python
from urllib.parse import quote_plus
sid_encoded = quote_plus(sid, safe='')

# Verify byte count is correct
assert len(sid.encode('utf-8')) == expected_byte_count
```

**Don't use**: Chrome "Copy as cURL" (also drops Unicode Tag).

**Source**: archived upstream notes (not shipped)

---

### #E6 ⭐ Cookie Reuse: 6 Batches Require **Fully Switching** Chrome Profiles

**Symptom**: cross-batch field classification has "phantom STATIC" — fields that should be DYNAMIC happen to have identical values across two batches.

**Root cause**: cdp-browser reusing the same profile → `_pxvid` / localStorage / IndexedDB residue causes PX to treat all 6 runs as "same user warm visits"; some fields degrade from DYNAMIC to STATIC.

**Fix**:
- Use a temporary profile directory; after each batch `rm -rf` the entire profile directory
- Or use incognito mode
- Or verify: each batch has a different UUID + `_pxvid` is non-continuous

**Source**: archived upstream notes (not shipped)

---

### #E7 ⭐ webdriver / Playwright / Selenium Leave navigator Markers

**Symptom**: algorithm correct, IP/UA/TLS fine, but the collector always returns a cookie yet using that cookie against the API still 403s.

**Root cause**: Selenium / Playwright / Chromium-headless default to `navigator.webdriver = true` etc. markers; the PX SDK detects this in-browser and writes "I am automated" into EV2 hidden fields; the server sees it and judges bot.

**Fix**:
- Use CDP to directly control real Chrome (no webdriver injection) — see [`skill/cdp/`](../skill/cdp/)
- Or use anti-detection plugins like `playwright-stealth` / `undetected-chromedriver`
- Or use the pure-algo generator (this project's primary path; no browser opened)

**Source**: `skill/cdp/SKILL.md`; multiple combat records

---

### #E8 ⭐ Node `https.request` Defaults to IPv6, Slow or Times Out

**Symptom**: the generator occasionally times out in production; local dev has no problems.

**Root cause**: Node 18+ `https.request` defaults to `family: 0` (auto), which may pick IPv6. PX collectors in some regions have slow / non-routable IPv6 paths.

**Fix**:
```javascript
const req = https.request({
    ...,
    family: 4,   // Force IPv4
});
```

**Source**: iFood production troubleshooting record

---

*The 5 SDK version drift gotchas are in [`4_sdk_drift.md`](4_sdk_drift.md)*
