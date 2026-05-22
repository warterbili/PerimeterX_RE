# Stage 7: Validate — 10/10 + Troubleshooting

> **Time budget**: 30 min fluent / 2 h first-time
> **Deliverables**: generator running 10/10 end-to-end + business API accessible
> *Merges*: C/§6 (combat) + B/07_stage7_validate + A/§12 (troubleshooting tree)

---

## Chapter Goal

Pass the generator through 3 gates:

```
Gate 1: generator runs and obtains _px3 cookie  (algorithm-level OK)
   ↓
Gate 2: _px3 accesses business API (no 403 / captcha)
   ↓
Gate 3: 10/10 stable + cross multi-IP / multi-UA
```

---

## 7.1 Gate 1: End-to-end Generator

```bash
cd ../../../stample/ifood/px_cookie/
node ifood_px3.js
# Expected output:
# [collector#1] POST OK, state.no=1771962850771, state.vid=c8357...
# [collector#2] POST OK, _px3=<long base64>...
# ✓ _px3 generated in 1.2s
```

Run 10 times:

```bash
for i in {1..10}; do
    node ifood_px3.js | grep -E "✓|✗"
done
# Expected: 10/10 ✓
```

If not 10/10 → proceed to §7.4 troubleshooting tree.

---

## 7.2 Gate 2: Business API

The `_px3` obtained from the generator must not get 403 on the target business API:

```javascript
const _px3 = await generatePx3('ifood');

const res = await fetch('https://www.ifood.com.br/api/restaurants/...', {
    headers: {
        'Cookie': `_px3=${_px3}; _pxvid=${vid}; ...`,
        'User-Agent': USER_AGENT
    }
});

console.log(res.status);   // Expected: 200 (or 200 + JSON data)
```

See [`../../../stample/ifood/px_cookie/smoke_test.sh`](../../../stample/ifood/px_cookie/smoke_test.sh).

---

## 7.3 Gate 3: 10/10 + Stability Matrix

```
Single IP, single UA      → 10/10
Single IP, multi UA (5)   → 50/50
Multi IP (5), single UA   → 50/50
Multi IP (5), multi UA (5) → 250/250
```

If any combination's pass rate < 100% → your generator has "doesn't work for certain UAs/IPs" bugs.

### 7.3.1 Stability smoke-test Script

```bash
# Single IP, 10 runs
./smoke_test.sh ifood 10

# Across 5 UAs × 10 runs each
for ua in chrome120 chrome121 firefox119 edge120 chrome_mac; do
    USER_AGENT=$(ua_lookup $ua) ./smoke_test.sh ifood 10
done
```

See [`../../../skill/AI_re/scripts/smoke_test.sh`](../../../skill/AI_re/scripts/smoke_test.sh).

---

## 7.4 Troubleshooting Decision Tree

```
Generator fails
├── HTTP 403 / Cloudflare blocked
│   ├── IP score too low → switch to residential proxy
│   ├── TLS fingerprint detected → switch axios → fetch (Node 18+) or use curl_cffi
│   └── Rate too high → add interval (per IP ≥ 30s/call)
│
├── HTTP 200 but _px3 empty
│   ├── EV1 partial error (collector#1 didn't return state) → check EV1 fields; state.* should all be present
│   └── OB decode error → check ../../../revers/ob.js
│
├── HTTP 200 + _px3 obtained, but business API 403
│   ├── _px3 is a "low-score" cookie → PX issued a cookie but flagged you
│   │   Fix:
│   │     - Check anti-tamper key/value algorithm
│   │     - Check PC algorithm (HMAC-MD5 + digit extraction)
│   │     - Check SID Unicode Tag encoding
│   ├── _px3 expired too fast → your locked SDK is too old
│   └── Missing other cookies (_pxvid etc.)
│
├── First 1-3 runs OK then 403s
│   ├── PX detected bot signature (too-regular request pattern)
│   │   Fix: add randInt(500, 3000) jitter between requests
│   ├── Same UUID reused → must use new UUID each call
│   └── Same IP rate too high
│
├── "PC mismatch" error
│   ├── XOR key wrong → parseInt(ml(TAG)) % 128
│   ├── Not using PX custom serialize() → must use ../../../revers/payload.js
│   └── Field order wrong → use deepClone to preserve template order
│
└── Algorithm-layer errors (base64 / MD5 / HMAC)
    ├── Algorithm implementation has bugs → run test/test_revers.js
    └── Node version too old (< 18) → upgrade
```

---

## 7.5 PC Mismatch Debugging

PC computing wrong is **the most common** failure mode. Debugging approach:

```javascript
// Output PC intermediates in the generator
const ev2Json = serialize(ev2);
console.log('ev2Json length:', ev2Json.length);
console.log('ev2Json first 200:', ev2Json.substring(0, 200));

const pc = computePC(ev2Json, TAG);
console.log('pc:', pc);

// Compare PC with a real captured batch
const realPc = extractPc('samples/1/request_2.txt');
console.log('real pc:', realPc);
console.log('match:', pc === realPc);
```

If they don't match:

1. Check whether ev2Json byte-matches the real capture (use a diff tool)
2. Check whether TAG was extracted from the correct SDK version
3. Check whether serialize() is the PX version or `JSON.stringify`

See [`../../../bug_report/1_collector_path.md`](../../../bug_report/1_collector_path.md) §"PC mismatch".

---

## 7.6 IP Score / TLS Fingerprint Issues (Independent of Pure-algo)

⚠️ **The following are NOT the pure-algo generator's responsibility, but they make you think the generator is broken**:

| Symptom | True cause |
|---|---|
| Single IP gets 403 after 5 runs | IP score blacklisted |
| Datacenter IP gets 403 immediately | PX blacklists datacenter ASN |
| Node fetch pass rate 80%, curl 100% | TLS fingerprint difference (Node fetch uses Node's own ALPN) |
| Same algorithm, different browser UA, different pass rate | UA-IP consistency issue (Brazilian IP + American UA loses score) |

**Pure-algo's responsibility is only generator input/output parity**. These are network-layer issues; see [`../../../bug_report/3_environment.md`](../../../bug_report/3_environment.md).

---

## 7.7 Gate 3 Completion Criteria ✓

| Item | Verification |
|---|---|
| ✅ 10/10 single IP, single UA | 100% |
| ✅ Business API 200 | No 403 / captcha |
| ✅ Stable across 5 UAs | 50/50 |
| ✅ Stable across 3 IPs | 30/30 (residential proxy) |
| ✅ Total time < 3s / call | generator + collector network |
| ✅ Error rate < 1% (random errors) | Acceptable network jitter |

---

## 7.8 Continuous Monitoring (Production-grade)

After the generator goes live, **monitor continuously**:

```bash
# Run smoke test hourly
0 * * * * /path/to/smoke_test.sh ifood 5 >> /var/log/px_smoke.log 2>&1
```

If the pass rate suddenly drops one day → PX has upgraded; emergency-trigger [`09_sdk_upgrade.md`](09_sdk_upgrade.md).

---

## 7.9 Proceed to Stage 8/9

Stage 7 complete = **the core of pure-algo PX reversing is done**.

Two optional further chapters:

→ [Stage 8: Cross-platform Porting](08_cross_platform.md) (if you need Python/Go/C# versions)
→ [Stage 9: SDK Upgrade Response](09_sdk_upgrade.md) (what to do after PX upgrades)
