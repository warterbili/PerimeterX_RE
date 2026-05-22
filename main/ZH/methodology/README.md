# PerimeterX 通用逆向方法论 — 7 阶段实战手册

> **目标读者**：要从零开始逆向 PX SDK 的工程师 / AI agent
> **预期产出**：纯算 `_px3` cookie 生成器，端到端 10/10 通过率
> **预计工时**：熟练 4-8 小时，从零 16-24 小时
> **前置要求**：JS 基础、Node.js 环境、Chrome DevTools、HTTP 抓包

---

## 这是什么

PerimeterX (HUMAN Security) SDK 反爬系统的**完整逆向工程方法论**，分 7 个连贯阶段。每个阶段独立一章，含**时间预算 + 必备工具 + 操作步骤 + 关键陷阱 + 验证标准**。

本方法论**只覆盖无感 Collector 路径**（99% 业务场景）。按压 Bundle 路径见独立方法论 [`../PX_Bundle_逆向方法论.md`](../PX_Bundle_逆向方法论.md)（973 行）。

---

## 时间投入分布（实战经验）

跑了 2 个站（iFood + Grubhub）、6 批 × 2 抓包、12 次端到端测试的真实分布：

```
20% — 抓包 + 解码 + 对比样本（必须 6+ 批）       Stage 1+2
25% — SDK 源码逆向 + 字段语义定位                Stage 4   ⭐
15% — 算法层移植 (payload/PC/OB/SID/anti-tamper) Stage 2
30% — 字段表对齐 + 类型校对（最容易踩坑！）       Stage 5+6 ⭐⭐⭐
10% — 端到端联调 + 多次稳定性验证                Stage 7
```

> ⚠️ **踩坑警示**：第 5+6 阶段（字段对齐 + state.* 注入）最容易卡死。2026-05 这次的 90% debug 时间都在找一个**类型 bug**（state.no 应该是 number 不是 string）。**单这一条坑就值 3 小时**。

---

## 7 阶段地图

```
Stage 1 — Capture            锁 SDK + 抓 6+ 批
   ↓
Stage 2 — Decode             解码 payload + OB 响应
   ↓
Stage 3 — Classify           STATIC / DYNAMIC / CONDITIONAL 三分类
   ↓
Stage 4 — Locate             SDK 源码里找每个字段的语义     ⭐
   ↓
Stage 5 — Value-match        state.* → EV2 b64 key 值匹配  ⭐⭐⭐
   ↓
Stage 6 — Implement          写 generator
   ↓
Stage 7 — Validate           10 × 稳定性测试
```

**关键阶段**：

- **Stage 4** 时间最长（4-8h）—— SDK 源码定位字段需要 7 大手段配合
- **Stage 5** 是单一最高 ROI（15 min 脚本，省 3 小时盲猜）—— 跨平台移植和新 SDK 升级的核心

---

## 章节地图

| 章 | 标题 | 时长（熟练）| 时长（第一次）|
|---|---|---|---|
| [00](00_overview.md) | 总览 + 时间预算 + 何时该 / 不该用纯算逆向 | 10 min | 10 min |
| [01](01_stage1_capture.md) | Stage 1: 抓包准备 — 锁 SDK + 6+ 批样本 | 30 min | 1 h |
| [02](02_stage2_decode.md) | Stage 2: 解码 — 反解 payload + OB + 算法验证 | 15 min | 1 h |
| [03](03_stage3_classify.md) | Stage 3: 字段三分类 — STATIC/DYNAMIC/CONDITIONAL | 30 min | 2 h |
| [04](04_stage4_locate.md) ⭐ | Stage 4: 字段语义定位 — 7 大手段（grep 工具书） | 1 h | **4 h** |
| [05](05_stage5_value_match.md) ⭐⭐⭐ | Stage 5: Value-match — state.\* → EV2 b64 key | **15 min** | 30 min |
| [06](06_stage6_implement.md) | Stage 6: Implement — 模板法 + DYNAMIC 覆盖 | 1 h | 4 h |
| [07](07_stage7_validate.md) | Stage 7: Validate — 10/10 测试 + 故障排查 | 30 min | 2 h |
| [08](08_cross_platform.md) | 跨平台移植 — iFood → Grubhub → 新站点 | — | 1 天/站 |
| [09](09_sdk_upgrade.md) | SDK 升级响应 — 30 min 还是 4 h？分场景 | — | 0.5-4 h |
| | **总计（熟练）** | **~4 h** | **~15 h** |

---

## 附录

| 附录 | 内容 |
|---|---|
| [A](appendix/A_tools.md) | 工具脚本清单（14 个 CLI） |
| [B](appendix/B_algorithms.md) | 关键算法伪代码（端到端 + build_ev2） |
| [C](appendix/C_avoid_traps.md) | 避免重蹈覆辙清单（10 条最致命踩坑） |

---

## 三份"前身"的关系

本方法论是项目里 3 份方法论的**合并整理版**：

| 前身 | 角色 |
|---|---|
| `../PX_逆向方法论_通用版.md`（1233 行 grep 工具书） | **保留** 作 §4 Stage 4 的"grep 模式速查"，本目录引用 |
| legacy `perimeterX_Re` 项目的 06_methodology（10 份英文流程） | **结构来源** —— 本目录 10 章布局参考其结构 |
| legacy `perimeter_X` 项目的 `18_methodology.md`（610 行实战节奏） | **内容主干** —— 7 阶段叙事 + 附录 A/B/C 全用 |

三份独立读各有优势；本目录是**最佳实践合并版**。

---

## 学习路径

| 你是…… | 怎么读 |
|---|---|
| **第一次接触 PX 逆向** | 顺序读 00 → 01 → 02 → 03 → 04 → 05 → 06 → 07，跟着做练习 |
| **要逆向一个新站点** | 先快扫 00 看预算，然后**重点读 04 + 05 + 08** |
| **PX 推了新 SDK，generator 跑不通了** | 直接看 [`09_sdk_upgrade.md`](09_sdk_upgrade.md) |
| **拿不到 `_px3`，要 debug** | 看 [`07_stage7_validate.md`](07_stage7_validate.md) §故障排查决策树 + [`../../../bug_report/`](../../../bug_report/) |
| **要批量做 N 个 PX 站点** | 读 [`08_cross_platform.md`](08_cross_platform.md) + [`../PX_完整SDK对照逆向方法论.md`](../PX_完整SDK对照逆向方法论.md) |
| **想速查 grep 模式** | 直接 `../PX_逆向方法论_通用版.md`（grep 工具书速查） |
| **要做 Bundle 按压挑战** | 跳到 [`../PX_Bundle_逆向方法论.md`](../PX_Bundle_逆向方法论.md)（973 行 8 阶段） |

---

## 跟项目其它部分关系

| 想看什么 | 去哪 |
|---|---|
| 算法模块（9 个） | [`../../../revers/`](../../../revers/) |
| iFood 现成 generator | [`../../../stample/ifood/px_cookie/`](../../../stample/ifood/px_cookie/) |
| Grubhub 现成 generator | [`../../../stample/grub/px_cookie/`](../../../stample/grub/px_cookie/) |
| 68 条踩坑全集 | [`../../../bug_report/`](../../../bug_report/) |
| Bundle 路径完整 | [`../../../bundle/`](../../../bundle/) |
| AI agent skill（含 playbook） | [`../../../skill/AI_re/`](../../../skill/AI_re/) |
| CDP 抓包 skill | [`../../../skill/cdp/`](../../../skill/cdp/) |

---

*校验时间 2026-05-21。本方法论整合自 3 份前身（A 1233 行 grep 工具书 + B 10 份英文流程 + C 610 行实战节奏），适用范围 PX SDK 无感 Collector 路径。Bundle 路径独立方法论见 [`../PX_Bundle_逆向方法论.md`](../PX_Bundle_逆向方法论.md)。*
