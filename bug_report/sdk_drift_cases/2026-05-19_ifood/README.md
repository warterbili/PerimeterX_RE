# 2026-05-19 iFood SDK 中版本升级 — 实战 diff 案例

> 这是一次**真实 SDK 升级**的完整 diff 记录。配合 [`bug_report/4_sdk_drift.md`](../../4_sdk_drift.md) 理论 + <!-- removed broken link: ../../../main/ZH/methodology/09_sdk_upgrade.md --> playbook 食用。

---

## 升级类型

**中版本**（中等响应难度）：
- ✅ 算法层魔法常量都还在（MD5/HMAC/UUID/base91 都没变）
- ❌ **b64 key 字典全刷新** → 旧模板作废
- ❌ TAG/FT 协议常量变化
- ❌ XOR key 动态计算公式更新
- ⬆️ EV1 字段数 12 → 14（新增 `pxhd` + `PX12738` 计数器）
- ⬆️ EV2 字段数 203 → 204

**响应时间**：~2 h（按 methodology/09 流程）

---

## 协议常量 diff

| 项 | 旧版 | 新版 |
|---|---|---|
| TAG | `DhI0E0h7J2cKHw==` | `U0MmDhUmOnhXSw==` |
| FT | `388` | `401` |
| XOR key (OB) | 83 | 100 |
| EV1 fields | 12 | 14 |
| EV2 fields | 203 | 204 |
| b64 字典 | 旧 202 个 | 新 225 个 |

---

## 文件清单

| 文件 | 用途 |
|---|---|
| `WORKLOG.md` | 升级响应工作日志（时间线 / 调试过程 / 踩坑） |
| `hQ_map.json` | 新 SDK 提取的 hQ 字典（1000+ 项） |
| `key_mapping.json` | **核心 diff** — 旧 b64 key → 新 b64 key 映射（202→225） |
| `all_fields_map.json` | 所有 EV1/EV2 字段语义标注 + 类型 + SDK 行号 |
| `field_map.json` | 字段级精简映射 |
| `lookup_result.json` | b64 key 反查 SDK 上下文结果 |
| `diff_result.json` | 旧 vs 新 EV1/EV2 字段三分类（新增/删除/不变） |
| `diff3_result.json` | EV3 (collector#3 行为追踪) 字段 diff |
| `ev1_template.json` | 新版 EV1 14 字段模板 |
| `ev2_template.json` | 新版 EV2 204 字段模板 |

---

## key_mapping.json 关键统计

| 类别 | 数量 | 说明 |
|---|---|---|
| 旧 b64 key 映射到新版（语义保持） | 31 | 双向值匹配命中 |
| 多候选（歧义） | 12 | 需类型先验排除 |
| 旧独有（新版废弃） | 29 | 字段被删 / 替代 |
| 新独有（新增字段） | 178 | 包括 b64 字典全部重新刷过的部分 |

---

## 后续 SDK 升级 / 跨站点 复用方法

下次升级**严格按照** <!-- removed broken link: ../../../main/ZH/methodology/09_sdk_upgrade.md --> 的 7 步走，主要 lift-and-shift 这个目录的工具链：

```bash
# 1. 拷一份模板目录
cp -r bug_report/sdk_drift_cases/2026-05-19_ifood bug_report/sdk_drift_cases/<NEW_DATE>_<site>

# 2. 重抓 6 批 → 重解码 → 重提 hQ → 重做 key_mapping
# 3. 把新的 diff 写到 WORKLOG.md

# 4. 完成后建立映射表，下次升级可对比
```

---

## 关联文档

- 理论：[`bug_report/4_sdk_drift.md`](../../4_sdk_drift.md)
- Playbook：<!-- removed broken link: ../../../main/ZH/methodology/09_sdk_upgrade.md -->
- AI skill：[`skill/AI_re/skills/px_sdk_drift_audit/README.md`](../../../skill/AI_re/skills/px_sdk_drift_audit/README.md)
- 字段对照：[`main/ZH/EV1_EV2_UNIFIED_REFERENCE.md`](../../../main/ZH/EV1_EV2_UNIFIED_REFERENCE.md)
