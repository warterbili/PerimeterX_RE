# SDK Drift Cases — 真实升级实战记录

> 跟 [`4_sdk_drift.md`](../4_sdk_drift.md)（理论）+ [`../main/ZH/methodology/09_sdk_upgrade.md`](../../main/ZH/methodology/09_sdk_upgrade.md)（playbook）配套的**实战 diff 案例**。

---

## 案例索引

| 日期 | 站点 | 类型 | 响应时间 | 链接 |
|---|---|---|---|---|
| 2026-05-19 | iFood | 中版本（b64 字典刷新 + TAG/FT 换 + 字段增删） | ~2 h | [`2026-05-19_ifood/`](2026-05-19_ifood/) |

---

## 案例文件夹结构（约定）

每个案例放一个独立子目录，命名 `YYYY-MM-DD_<site>/`：

```
2026-05-19_ifood/
├── README.md                ← 案例摘要 + 关键 diff
├── WORKLOG.md               ← 工作日志（时间线 / 调试 / 踩坑）
├── hQ_map.json              ← 新 SDK 提取的字典
├── key_mapping.json         ← 旧 b64 key → 新 b64 key 映射
├── all_fields_map.json      ← 字段语义全表
├── diff_result.json         ← EV1/EV2 字段级 diff
├── ev1_template.json        ← 新版模板
└── ev2_template.json        ← 新版模板
```

---

## 复用方法

新升级响应时 lift-and-shift：

```bash
cp -r bug_report/sdk_drift_cases/2026-05-19_ifood bug_report/sdk_drift_cases/<DATE>_<site>
# 重抓 → 重解码 → 重做 diff → 写 WORKLOG
```

详见 [`../../main/ZH/methodology/09_sdk_upgrade.md`](../../main/ZH/methodology/09_sdk_upgrade.md) 7 步流程。
