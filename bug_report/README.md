# PX 逆向工程踩坑全集

50+ 条 PerimeterX SDK 逆向真实付出过 debug 时间的坑，从 2 个生产项目
（iFood + Grubhub web scraper）+ 5 个 Desktop 阶段性档案 + skill 现有的
14 条基线合并去重得来。

## 目录

| 文件 | 内容 | 坑数 |
|---|---|---|
| [`1_collector_path.md`](1_collector_path.md) | **无感 Collector 路径**（99% 流量走的） — 协议/编码/算法/state 注入/模板/Cookie 生命周期 | 33 |
| [`2_bundle_path.md`](2_bundle_path.md) | **按压 Bundle 路径**（captcha.js + PoW + WASM + 行为合成 + 生产部署陷阱） | 20 |
| [`3_environment.md`](3_environment.md) | 环境/基础设施（IP 节流、TLS、UA 黑名单、Python sid 编码、IPv6） | 8 |
| [`4_sdk_drift.md`](4_sdk_drift.md) | SDK 版本漂移（handler 名 / 字符集 / 行号 / captcha.js 独立跟版 / Chrome 版本绑定） | 7 |
| [`gotchas/`](gotchas/) ⭐ | **细颗粒度版** — 19 个命名 bug，每条单文件含修复代码 + 防回归测试 | 19 |
| [`sdk_drift_cases/`](sdk_drift_cases/) ⭐ | **真实升级 diff 案例** — 2026-05-19 iFood 中版本升级完整 diff 数据 | 1（持续累计） |

**总计：68 条独立坑**（合并去重自 9 个数据来源） + **19 条细颗粒度版** + **1 个升级案例**。

## 怎么读

- ⭐⭐⭐ = 真实付出过 ≥1 小时 debug 时间的"必踩"坑
- ⭐⭐ = 至少 30 分钟 debug 才发现
- ⭐ = 看过文档就能避开，但容易漏

每条坑都有：
- **症状**：错的时候表现是什么样
- **根因**：为什么 PX 是这样的（不是表面修复，而是设计本质）
- **修复**：代码或操作
- **来源**：原始记录位置（行号/段落）

## 怎么用这些坑

**写新 generator 时**：

1. 通读 `1_collector_path.md` —— 99% 的 generator 失败原因在这
2. 拿到 sample 后跑 `stample/<site>/script/find_state_keys.py` —— 解决坑 #11/#12（state.* 注入位置 + EV2 b64 key 重用）
3. 写好生成器跑 `stample/<site>/script/compare_my_ev2.py` —— 字段级 diff 帮你定位剩下的坑
4. 拿不到 cookie 时按 [`skill/AI_re/playbooks/validate-generator.md`](../skill/AI_re/playbooks/validate-generator.md) 决策树排查

**SDK 升级后**：

1. 看 `4_sdk_drift.md` —— 哪些东西**不能**跨版本硬编码
2. 跑 `verify_all.sh` —— 解码器还能不能解新 SDK 抓的 sample
3. 跑 `diff_samples.py` —— 字段三分类有没有变

**生产部署前**：

1. 看 `3_environment.md` —— 别在测试环境的 IP/TLS 上跑 100 次就直接上线
2. UA 别填 `Scrapy/`（坑 #env-2）
3. 给每个账号配独立住宅 IP（坑 #env-1 IP 节流）

## 数据来源

| 来源 | 路径 | 提取的坑数 |
|---|---|---|
| **iFood 生产项目** | `projects/sourcing-cracked/ifood-web/` | 25 |
| **Grubhub 生产项目** | `projects/sourcing-cracked/grubhub-web/` | (跟 ifood 多重合) |
| **Desktop 阶段性档案 (5 个)** | `Desktop/新建文件夹*` + `ifood-pxcookie-update-2026-05-19` | 30 |
| **AI_re 基线 gotchas.md** | `skill/AI_re/references/gotchas.md` | 14（多数已在上述档案里） |
| **perimeter_X 老项目** | `lsd_projects/perimeter_X/` | 跟 Desktop 大量重合 |
| **perimeterX_Re 重构项目** | `lsd_projects/perimeterX_Re/` ⭐ | **+7 条新发现**（Cookie TTL、Bundle#4 矛盾、PoW 缓存陷阱、轨迹池过小、captcha.js 跟版、Chrome 版本绑定） |

**去重后：68 条独立坑**。两边都提到的坑保留更详尽的版本 + 双引用。

## 跟其它项目部分的关系

| 文件 | 角色 | 关系 |
|---|---|---|
| `bug_report/1-4.md`（本目录 4 文件） | **聚合视图** 68 条坑速读 | 给写代码的人用 |
| [`gotchas/`](gotchas/) ⭐ | **细颗粒度版** 19 条独立 .md 含修复 + 测试 | 复现某条 deep-dive 用 |
| [`sdk_drift_cases/`](sdk_drift_cases/) ⭐ | 升级实战 diff 数据 | 跟 [`4_sdk_drift.md`](4_sdk_drift.md) 理论 + [`methodology/09_sdk_upgrade.md`](../main/ZH/methodology/09_sdk_upgrade.md) playbook 配套 |
| [`skill/AI_re/references/gotchas.md`](../skill/AI_re/references/gotchas.md) | 精选 19 条（AI 用） | 给 AI agent 写 generator 时快速参考 |
| [`main/ZH/PX_SDK_逆向技术文档.md`](../main/ZH/PX_SDK_逆向技术文档.md) | 完整原理 | 解释**为什么**，本目录解释**踩过哪些** |
| [`stample/*/script/compare_my_ev2.py`](../stample/) | 字段级 diff 工具 | 帮你定位坑到底是哪条 |

---

*生成时间 2026-05-21。坑数会增加，不会减少 —— PX 改 SDK 不删坑，只换新坑。*
