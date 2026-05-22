# SDK Drift Cases — Real Upgrade Combat Records

> The **combat-diff case studies** that pair with [`4_sdk_drift.md`](../4_sdk_drift.md) (theory) + [`../main/ZH/methodology/09_sdk_upgrade.md`](../../main/ZH/methodology/09_sdk_upgrade.md) (playbook).

---

## Case Index

| Date | Site | Type | Response time | Link |
|---|---|---|---|---|
| 2026-05-19 | iFood | Medium-version (b64 dict refresh + TAG/FT swap + field add/remove) | ~2 h | [`2026-05-19_ifood/`](2026-05-19_ifood/) |

---

## Case Folder Structure (Convention)

Each case lives in an independent subdirectory named `YYYY-MM-DD_<site>/`:

```
2026-05-19_ifood/
├── README.md                ← Case summary + key diff
├── WORKLOG.md               ← Work log (timeline / debug / gotchas)
├── hQ_map.json              ← Dictionary extracted from the new SDK
├── key_mapping.json         ← Old b64 key → new b64 key mapping
├── all_fields_map.json      ← Full field-semantic table
├── diff_result.json         ← EV1/EV2 field-level diff
├── ev1_template.json        ← New-version template
└── ev2_template.json        ← New-version template
```

---

## Reuse Method

For the next upgrade response, lift-and-shift:

```bash
cp -r bug_report/sdk_drift_cases/2026-05-19_ifood bug_report/sdk_drift_cases/<DATE>_<site>
# Recapture → re-decode → re-diff → write WORKLOG
```

See [`../../main/ZH/methodology/09_sdk_upgrade.md`](../../main/ZH/methodology/09_sdk_upgrade.md) 7-step workflow for details.
