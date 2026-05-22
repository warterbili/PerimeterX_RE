# Stage 9: SDK Upgrade Response (Emergency Workflow)

> **Time budget**: routine 30 min – 2 h, worst case 1-2 days
> **Deliverables**: restore generator pass rate to 100%
> *Merges*: C/§7 (upgrade playbook) + B/09_sdk_upgrade

---

## 9.1 Trigger Scenarios

The generator has been running fine in production, **then suddenly pass rate drops one day** → PX has upgraded.

Upgrades come at 3 severity levels with different responses:

| Level | Frequency | Symptom | Response time |
|---|---|---|---|
| **Minor (bug fix)** | Weekly | Pass rate 100% → 98% | Usually self-heals; observe 24h |
| **Medium (added fields / b64 dictionary swap)** | Monthly | Pass rate → 70-90% | Redo Stages 3/4/5 (**~2 h**) |
| **Major (algorithm / protocol change)** | Every 6-12 months | Pass rate → 0% | Redo Stages 4/2; may take 1-2 days |

---

## 9.2 Emergency Response Playbook

### 9.2.1 Step 1: Diagnose (5 minutes)

```bash
# 1. Capture 1 fresh batch
chrome-incognito → ifood → F12 → save curl
node ../../../skill/AI_re/scripts/decode_payload.js new_request_2.txt > new_decoded.json

# 2. Compare field count against the old template
jq '.[0].d | keys | length' new_decoded.json    # new
jq '.[0].d | keys | length' samples/6/decoded_payload_2.json  # old

# 3. Check whether the SDK SHA256 changed
sha256sum source/main.min.js      # old
curl -s https://client.px-cloud.net/PXO1GDTa7Q/main.min.js | sha256sum  # new
```

### 9.2.2 Step 2: Triage (Based on Diff)

```
Did the SDK SHA change?
├── No → probably not an SDK upgrade; could be IP score / network layer → check ../../../bug_report/3_environment.md
│
└── Yes → SDK upgraded
    │
    Did EV2 field count change?
    ├── No (still 228) → medium version (b64 dictionary swap only)
    │   → jump to 9.3
    │
    └── Yes (now 230 / 240 / 220) → medium-to-major (fields added)
        │
        Are algorithm-layer magic constants still present?
        ├── Yes (1732584193, 909522486, ...) → medium
        │   → jump to 9.3
        │
        └── No → major; algorithm changed → jump to 9.4
```

---

## 9.3 Medium-Version Response (~2 h Workflow)

Most common. The SDK b64 key dictionary refreshes but the algorithm doesn't change. **Routine event every 6-12 months**.

```
[1] Recapture 6 batches (Stage 1, 30 min)
    ⚠️ Must recapture! Old samples' b64 keys won't match the new dictionary
    cd ../../../stample/ifood/sample/
    rm -rf {1..6}
    # Recapture 6 cold-visit batches

[2] Re-decode (Stage 2, 15 min)
    cd ../script
    ./decode_all.sh

[3] Re-extract hQ mapping (Stage 4, 5 min)
    node ../../../skill/AI_re/scripts/extract_hQ.js ../source/main.min.js \
        > ../px_cookie/hQ_map.json

[4] Re-classify (Stage 3, 10 min)
    python diff_samples.py 2

[5] Re-run value-match (Stage 5, 15 min)
    python find_state_keys.py
    # Expected: new state_key_map.json; mapped b64 keys should all have changed

[6] Re-extract template (Stage 6 partial, 5 min)
    cp samples/6/decoded_payload_2.json ../px_cookie/ifood_ev2_template.json

[7] Run generator (Stage 7, 30 min)
    node ifood_px3.js
    ./smoke_test.sh 10
    # Expected: 10/10
```

**Whole process ~2 hours**.

---

## 9.4 Major-Version Response (Worst Case 1-2 Days)

PX changed the algorithm (theoretically hasn't happened, but possible). Response:

```
[1] grep algorithm-layer magic constants (Stage 2 §2.6)
    grep -c "1732584193" main.min.js   # MD5?
    grep -c "909522486"  main.min.js   # HMAC?
    grep -c "122192928e5" main.min.js  # UUID v1?
    grep -c "F@bt" main.min.js         # base91?
    grep -c "~~~~" main.min.js         # OB separator?

[2] See which is missing → re-reverse that one
    Missing MD5 → possibly switched to SHA-256 / SHA-512 → re-read PC implementation
    Missing HMAC ipad → possibly new HMAC impl → re-read
    Missing UUID v1 → possibly switched to v4 → change uuidV1() to uuidV4()
    Missing base91 → possibly switched to base85 / base92 → rewrite hM()

[3] If the wire protocol changed ("~~~~" gone → "###" or something else)
    → re-read ../../../revers/ob.js to find new separator

[4] If a new algorithm layer (an unknown algorithm)
    → walk through complete Stages 1-7 from scratch
    → estimate 1-2 days
```

---

## 9.5 Emergency Standby (Recommended)

To shorten response time:

1. **Scriptify capture**: CDP automation captures 6 batches in < 10 minutes
2. **Decoder toolkit ready**: become proficient with the 14 CLIs in [`../../../skill/AI_re/scripts/`](../../../skill/AI_re/scripts/)
3. **Weekly cold-start test**: every Monday run `smoke_test.sh ifood 5` to catch issues early
4. **Retain N-1 version SDK**: keep last successful SDK as a copy for diff
5. **Monitoring alerts**: pass rate < 95% → Slack/email alert

---

## 9.6 Historical Upgrade Log (PX Project Measured)

| Date | Upgrade type | Fix time | Notes |
|---|---|---|---|
| 2026-05-18 | iFood SDK medium (b64 dict refresh) | 2 h | See [`../../../bug_report/4_sdk_drift.md`](../../../bug_report/4_sdk_drift.md) #1 |
| 2026-04-03 | Grubhub SDK minor | 0 (self-heal) | Pass rate fluctuation |
| ... | ... | ... | ... |

---

## 9.7 When to Stop Maintaining

Three signals suggesting you give up the pure-algo path and switch to a real browser (Playwright + residential proxy):

1. **3 consecutive upgrade responses each took > 1 day** → maintenance cost >> benefit
2. **PX introduces a Bundle / visual challenge path** → see [`../../../bundle/`](../../../bundle/); pure-algo cost is 5×
3. **Business volume drops to a few hundred per day** → real browser suffices

See [`00_overview.md`](00_overview.md) §0.6 (when not to do pure-algo).

---

## 9.8 Stage 9 Completion Criteria ✓

The "complete" standard for an upgrade response matches Stage 7:

| Item | Verification |
|---|---|
| ✅ generator 10/10 | 100% |
| ✅ Business API 200 | No 403 |
| ✅ Stable across UAs / IPs | 50/50 / 30/30 |

---

## 9.9 Proceed to Appendices

The 10 main chapters are complete. Three appendices follow:

→ [Appendix A: 14 CLI Tool Quick Reference](appendix/A_tools.md)
→ [Appendix B: Key Algorithm Pseudocode](appendix/B_algorithms.md)
→ [Appendix C: 10 Must-Avoid Pitfalls](appendix/C_avoid_traps.md)
