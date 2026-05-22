# 2026-05-19 iFood SDK Medium-Version Upgrade — Combat Diff Case

> This is a complete diff record of a **real SDK upgrade**. Pair with [`bug_report/4_sdk_drift.md`](../../4_sdk_drift.md) (theory) + [`main/ZH/methodology/09_sdk_upgrade.md`](../../../main/ZH/methodology/09_sdk_upgrade.md) (playbook).

---

## Upgrade Type

**Medium-version** (medium response difficulty):
- ✅ Algorithm-layer magic constants all still present (MD5/HMAC/UUID/base91 all unchanged)
- ❌ **Full b64 key dictionary refresh** → old template invalidated
- ❌ TAG/FT protocol constants changed
- ❌ XOR key dynamic-compute formula updated
- ⬆️ EV1 field count 12 → 14 (added `pxhd` + `PX12738` counter)
- ⬆️ EV2 field count 203 → 204

**Response time**: ~2 h (following the methodology/09 workflow)

---

## Protocol Constants Diff

| Item | Old version | New version |
|---|---|---|
| TAG | `DhI0E0h7J2cKHw==` | `U0MmDhUmOnhXSw==` |
| FT | `388` | `401` |
| XOR key (OB) | 83 | 100 |
| EV1 fields | 12 | 14 |
| EV2 fields | 203 | 204 |
| b64 dictionary | 202 entries | 225 entries |

---

## File Listing

| File | Purpose |
|---|---|
| `WORKLOG.md` | Upgrade-response work log (timeline / debug / gotchas) |
| `hQ_map.json` | hQ dictionary extracted from the new SDK (1,000+ entries) |
| `key_mapping.json` | **Core diff** — old b64 key → new b64 key mapping (202→225) |
| `all_fields_map.json` | All EV1/EV2 field semantic annotations + types + SDK line numbers |
| `field_map.json` | Field-level abridged mapping |
| `lookup_result.json` | b64 key reverse-lookup → SDK context results |
| `diff_result.json` | Old vs new EV1/EV2 field three-class taxonomy (added/removed/unchanged) |
| `diff3_result.json` | EV3 (collector#3 behavioral tracking) field diff |
| `ev1_template.json` | New-version EV1 14-field template |
| `ev2_template.json` | New-version EV2 204-field template |

---

## key_mapping.json Key Statistics

| Category | Count | Notes |
|---|---|---|
| Old b64 keys mapped to new (semantic preserved) | 31 | Bidirectional value-matching hit |
| Multi-candidate (ambiguity) | 12 | Need type-priors to disambiguate |
| Old-only (deprecated in new) | 29 | Field deleted / replaced |
| New-only (newly added) | 178 | Includes the entire refreshed portion of the b64 dictionary |

---

## Reuse for Future SDK Upgrades / Cross-site Porting

For the next upgrade, **strictly follow** the 7 steps in [`main/ZH/methodology/09_sdk_upgrade.md`](../../../main/ZH/methodology/09_sdk_upgrade.md); mainly lift-and-shift this directory's tooling chain:

```bash
# 1. Copy a template directory
cp -r bug_report/sdk_drift_cases/2026-05-19_ifood bug_report/sdk_drift_cases/<NEW_DATE>_<site>

# 2. Recapture 6 batches → re-decode → re-extract hQ → redo key_mapping
# 3. Write the new diff into WORKLOG.md

# 4. After completion, build a mapping table; next upgrade can compare
```

---

## Related Documents

- Theory: [`bug_report/4_sdk_drift.md`](../../4_sdk_drift.md)
- Playbook: [`main/ZH/methodology/09_sdk_upgrade.md`](../../../main/ZH/methodology/09_sdk_upgrade.md)
- AI skill: [`skill/AI_re/skills/px_sdk_drift_audit/README.md`](../../../skill/AI_re/skills/px_sdk_drift_audit/README.md)
- Field reference: [`main/ZH/EV1_EV2_UNIFIED_REFERENCE.md`](../../../main/ZH/EV1_EV2_UNIFIED_REFERENCE.md)
