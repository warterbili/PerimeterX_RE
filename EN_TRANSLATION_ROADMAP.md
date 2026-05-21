# 📋 English Translation Roadmap (TODO)

> Plan created 2026-05-22 evening, **execute tomorrow / future sessions**.
> 当前项目 ~7 MB / 401 文件 / 中文为主。这份 roadmap 是补齐英文 + 重做顶层 README 的全套清单。

---

## ⚠️ 翻译原则（用户补充）

1. **方向**：**中 → 英单向** —— 所有中文文档都要有英文版
2. **不做反向**：现有英文文档（`research/`、`gotchas/`、`skill/AI_re/skills/` 等）**保留英文，不补中文**
3. **顺便优化**：翻译时**审查内容质量**，可顺手 polish / 删冗余 / 统一术语
4. **顶层 README 重做**：跟英文化一起做（不是简单翻译）

---

## 0. 当前状态盘点

### 已有英文（**不补中文，原样保留**）

| 文档 | 路径 | 备注 |
|---|---|---|
| 3 份核心 EN 方法论 | `main/EN/PX_*.md` | 早期已写 |
| 19 条 gotcha 细粒度 | `bug_report/gotchas/*.md` | fork 自 perimeterX_Re，**单向英文保留** |
| 6 份研究档案 | `research/01..06_*/` | fork 自 perimeterX_Re，**单向英文保留** |
| 4 份 AI Skill manifests | `skill/AI_re/skills/*/README.md` | fork 自 perimeterX_Re，**单向英文保留** |
| 1 份 sample EN | `stample/ifood/sample/README_EN.md` 等 | **单向英文保留** |

### 缺英文（要做）

| 类别 | 数量 | 优先级 |
|---|---|---|
| **顶层 README** | 1 (459 行) | **P0** — 第一印象 |
| **main/ZH/ 未译** | 14 文档（methodology 10+3+1, EV1_EV2_UNIFIED, Bundle 方法论） | **P0** — 核心方法论 |
| **bug_report/ 4 主文件 + sdk_drift_cases** | 6 | P1 |
| **node_bridge/ + skill/** | 4 (README + SKILL + methodology + new_site_guide) | **P0** — Plan B 全套 |
| **bundle/** | 7 (含 5070 行 Bundle 完整文档) | P1 |
| **stample/{ifood,grub}/RESEARCH_PURPOSE** | 2 | P2 |
| **stample/live_validation/** | 2 (README + journal) | P2 |

---

## 1. 工作量预估

| 文档类型 | 单份耗时 (经验) | 数量 | 小计 |
|---|---|---|---|
| 短文档 (50-150 行 README/SKILL) | 15-20 min | 8 | ~2 h |
| 中文档 (200-500 行) | 30-50 min | 14 | ~9 h |
| 长文档 (500-1500 行 methodology) | 1-2 h | 5 | ~7 h |
| 超长 (Bundle 完整 5070 行) | 4-6 h | 1 | ~5 h |
| **总计** | — | **28 份** | **~23 h** |

**实际**：大部分能 AI 辅助翻译，人审 80% 时间。所以**实际 8-12 h 工作量**，分 2-3 天做完。

---

## 2. 推荐执行顺序（按依赖 + 价值）

### Day 1（~4 h）— P0 顶层 + Plan B

**1.1 顶层 README 双语化** (1 h)
- 重写 `README.md` 优化（当前 459 行偏长 + 信息重复）
  - 精简到 ~350 行
  - 加 "[English](README_EN.md) · [中文](README.md)" 切换
  - 5 分钟 Quick Start 更突出
- 写 `README_EN.md` 完整对译

**1.2 Plan B (node_bridge) 全套翻译** (2 h)
- `node_bridge/README.md` → `README_EN.md` (400 行)
- `node_bridge/skill/SKILL.md` → `SKILL_EN.md` (115 行) — frontmatter 翻译要保留 description (英文 trigger 词)
- `node_bridge/skill/methodology.md` → `methodology_EN.md` (520 行)
- `node_bridge/skill/new_site_guide.md` → `new_site_guide_EN.md` (411 行)

**1.3 顶层 README 视觉优化** (1 h)
- 加 GitHub badges (Build/License/Stars/Contributors)
- 重新整理章节结构（按"工程师 vs 学习者 vs 学术"角色分块）
- 加目录 TOC（mkdocs/github auto TOC）

### Day 2（~4 h）— P0 main/ZH 方法论 + bug_report

**2.1 main/EN/methodology/** 全套 (~3 h)
- `00_overview.md` (210 行)
- `01..09_stage*.md` (9 章 × ~200 行)
- `appendix/A_tools.md` (~250 行)
- `appendix/B_algorithms.md` (~330 行)
- `appendix/C_avoid_traps.md` (~220 行)
- `README.md` (130 行)

输出到 `main/EN/methodology/`。

**2.2 EV1_EV2_UNIFIED_REFERENCE_EN.md** (30 min, 227 行)

**2.3 bug_report 4 主文件英文版** (1 h)
- `1_collector_path_EN.md`
- `2_bundle_path_EN.md`
- `3_environment_EN.md`
- `4_sdk_drift_EN.md`
- `README_EN.md`

### Day 3（~3-4 h）— P1/P2 Bundle + 剩余

**3.1 Bundle 主文档英文版** (3-4 h)
- `bundle/doc/Bundle_完整技术文档.md` → `Bundle_Complete_Technical_Doc_EN.md` (5070 行)
- `bundle/README.md` → `README_EN.md` (206 行)
- `main/ZH/PX_Bundle_逆向方法论.md` → `main/EN/PX_Bundle_Reverse_Methodology_EN.md` (973 行)

**3.2 stample/{ifood,grub}/RESEARCH_PURPOSE_EN.md** (30 min × 2)

**3.3 stample/live_validation/ 英文** (30 min)
- `README_EN.md`
- `journal/2026-05-21_EN.md` (新增英文 journal — journal 内容直译，证据 JSON 不变)

---

## 3. 顶层 README 重写设计稿

### 当前问题
- 459 行偏长
- 章节重复（"实战验证" + "5 分钟 Quick Start" + "按角色入口" 有信息重叠）
- 没 badges
- 中英切换提示弱

### 重写后结构 (~350 行)

```markdown
<div align="center">

# 🛡️ PerimeterX SDK Complete Reverse Engineering

**[English](README_EN.md) · 简体中文**

![License](badge) ![iFood](badge) ![Grubhub](badge) ![Stars](badge)

[5 分钟 Quick Start](#quick-start) · [⭐ Live 实战](stample/live_validation/) ·
[方法论](main/ZH/methodology/) · [踩坑](bug_report/) · [Plan B](node_bridge/)

</div>

## 这是什么 (one-paragraph pitch)
## ✅ 实战验证 (table)
## 🚀 5 分钟 Quick Start (code)
## 🧭 按角色 (table — 7 种角色)
## 📁 项目结构 (tree)
## 🛡️ 三层 Fallback 架构
## 🛠️ AI Skill
## 🌐 双语状态 (table)
## 📜 License
```

精简掉：
- ~~"68 条真实踩坑（必读）"~~（指向 bug_report/ 即可，不在 README 展开）
- ~~"4 个新踩坑"~~（指向 live_validation/journal/）
- ~~"PX 怎么工作（60 秒速览）"~~（移到 main/ZH/PX_SDK_逆向技术文档.md 入口）
- ~~"项目体量" 大表~~（数字放 badges）

### README_EN.md 完整对译

跟新版中文 README 一一对应 — 不要直接 Google 翻译，要润色专业反爬术语：
- 反爬 → anti-bot
- 纯算 → pure-algorithm / algorithmic
- 补环境 → environment supplementation / browser env patching
- 后手 → fallback escalation path
- 踩坑 → gotcha / pitfall
- 字段三分类 → field classification (STATIC/DYNAMIC/CONDITIONAL)
- 抓包 → traffic capture
- 锁定 SDK → SDK locking / version pinning

---

## 4. 翻译质量约定

### 命名规范
- 中文文档 `XXX.md` → 英文版统一加 `_EN.md` 后缀（如 `README_EN.md`）
- methodology 子目录用 `main/EN/methodology/` 镜像中文结构
- 链接内部相互引用同步更新（中文 → 中文，英文 → 英文）

### 不翻译的内容
- 代码 / 命令行（保持英文）
- 接口端点 URL（已英文）
- 商家名 / 真实 IP / 凭据占位符
- 业务响应 JSON（保持原样）
- 文件路径

### 必须翻译
- 所有正文 + 表格 header
- 代码注释（如果是用户读得懂的设计说明）
- 错误信息描述

### 风格
- 技术文档语气（清晰、简洁，不用花哨修辞）
- 主动语态 (`We capture the SDK` 而非 `The SDK is captured`)
- 用专业反爬社区术语（不是 academic 论文风）

---

## 5. 执行 checklist（明天 / 后续 session 用）

### Phase 1: 顶层 + Plan B（Day 1）
- [ ] 1.1 重写顶层 `README.md`（精简 + 重组）
- [ ] 1.2 写 `README_EN.md`
- [ ] 1.3 加 GitHub badges
- [ ] 1.4 翻译 `node_bridge/README.md` → `README_EN.md`
- [ ] 1.5 翻译 `node_bridge/skill/SKILL.md` → `SKILL_EN.md`
- [ ] 1.6 翻译 `node_bridge/skill/methodology.md` → `methodology_EN.md`
- [ ] 1.7 翻译 `node_bridge/skill/new_site_guide.md` → `new_site_guide_EN.md`

### Phase 2: main/EN/ + bug_report（Day 2）
- [ ] 2.1 创建 `main/EN/methodology/` 目录
- [ ] 2.2 翻译 `00_overview.md`
- [ ] 2.3 翻译 `01..09_stage*.md`（9 章）
- [ ] 2.4 翻译 `appendix/A/B/C`（3 附录）
- [ ] 2.5 翻译 methodology 的 `README.md`
- [ ] 2.6 翻译 `EV1_EV2_UNIFIED_REFERENCE.md`
- [ ] 2.7 翻译 `bug_report/1..4_*.md`（4 主文件）
- [ ] 2.8 翻译 `bug_report/README.md`

### Phase 3: Bundle + 剩余（Day 3）
- [ ] 3.1 翻译 `bundle/doc/Bundle_完整技术文档.md`（最长）
- [ ] 3.2 翻译 `bundle/README.md`
- [ ] 3.3 翻译 `main/ZH/PX_Bundle_逆向方法论.md`
- [ ] 3.4 翻译 `stample/ifood/RESEARCH_PURPOSE.md`
- [ ] 3.5 翻译 `stample/grub/RESEARCH_PURPOSE.md`
- [ ] 3.6 翻译 `stample/live_validation/README.md`
- [ ] 3.7 翻译 `stample/live_validation/journal/2026-05-21.md`

### Phase 4: 收尾（Day 3 末）
- [ ] 4.1 全局检查链接（中→中、英→英）
- [ ] 4.2 顶层 `README.md` + `README_EN.md` 互相 link
- [ ] 4.3 commit + push 一次性
- [ ] 4.4 README 加 GitHub topics（perimeterx, reverse-engineering, browser-fingerprint, anti-bot, jsdom, etc.）

---

## 6. 工作流建议（明天用）

### 翻译 + 优化双轨流程
每个文档**翻译时顺便做内容优化**（不是只 1:1 翻）：

1. **Read 中文原文**
2. **优化中文版** (顺手做)：
   - 删冗余段落（信息重复）
   - 统一术语（防止"纯算" / "纯算法" / "算法层" 混用）
   - 修过期引用（指向已删/已改的文件）
   - 修过期 timestamp / 链接
3. **写英文版** (`*_EN.md`)：
   - 用 Claude/AI 辅助生成
   - 保留 markdown 结构 + 代码块 + JSON 原样
   - 专业术语统一（见 §3 末尾术语表）
4. **链接同步**：中文里链接保持中文目标，英文里链接改成英文目标

### 效率技巧
- **不要逐字翻译** — 技术文档允许在保留信息的前提下重组句式
- **专业术语统一表** — 第一次确定术语，全项目统一（建议先创 `TERMS.md`）
- **中文优化 + 英文译**：同时进行避免双工作量
- **不做反向翻译** — `research/`、`gotchas/` 等保留英文，不补中文

---

## 6.x 内容优化目标（每个文档审查时顺手做）

### 顶层 README
- ⚠️ 当前 459 行偏长 → 精简到 ~350 行
- 章节结构按"角色 navigation"重组
- 加 GitHub badges + topics + TOC

### 单文档内容优化
- 删冗余（如 4 个 trap 章节里 #2 / #4 是"AI 查找过程"不是真踩坑）
- 统一术语（PX = PerimeterX 全项目统一）
- 修过期引用（删 `_e2e_test_tmp.js` 已不存在的文件引用）
- timestamp 标准化（UTC+8 / 文档时间格式）

### 双语状态表更新
- 顶层 README 现有的"双语状态"表（line ~360）
- 每完成一份英文翻译 → 更新对应 ✅
- 完成所有任务后 → 表格全 ✅

---

## 7. 完成后的项目状态

预期：

```
perimeter/
├── README.md               精简 350 行（中文）
├── README_EN.md            英文版
├── main/
│   ├── ZH/                 现状 19 文档
│   └── EN/                 19 文档（1:1 对应 ZH）
├── bug_report/
│   ├── 1..4_*.md           中文
│   ├── 1..4_*_EN.md        英文
│   ├── gotchas/            已英文
│   └── sdk_drift_cases/    中文 + _EN
├── node_bridge/
│   ├── README.md + _EN.md
│   └── skill/
│       ├── SKILL.md + _EN.md
│       ├── methodology.md + _EN.md
│       └── new_site_guide.md + _EN.md
├── bundle/
│   ├── README.md + _EN.md
│   └── doc/.md + _EN.md
└── stample/
    ├── ifood/RESEARCH_PURPOSE.md + _EN.md
    ├── grub/RESEARCH_PURPOSE.md + _EN.md
    └── live_validation/
        ├── README.md + _EN.md
        └── journal/2026-05-21.md + _EN.md
```

每个文档 → 双语对照 → 国际化项目 ✓

---

## 8. 风险 / 注意

- ⚠️ Bundle 完整技术文档 (5070 行) 是最大单文件，**单次翻译可能超 context**。需要分段译：
  - Part 1: §1-§5 (~1500 行)
  - Part 2: §6-§10 (~1500 行)
  - Part 3: §11-§20 + 附录 (~2000 行)
- ⚠️ 翻译时**保持代码 / JSON / URL 原样**（不要把 `var _px3 = "abc"` 翻译成中文）
- ⚠️ 检查 markdown 表格对齐（中文宽字符跟英文窄字符表格对齐不同）
- ⚠️ 不要忘记 frontmatter（SKILL.md 等有 yaml header）

---

## 9. 完成标准

| 项 | 标准 |
|---|---|
| 双语覆盖率 | ≥ 95%（除 sample/ raw data 不译） |
| 顶层 README | 中英都精简到 350 行内 |
| GitHub badges | ≥ 4 个（License/Stars/Validation/Star/Build） |
| README topics | 设置 6+ GitHub topics 让搜索能找到 |
| 链接完整性 | 所有内部链接 → 同语言文档（不跨语言跳） |
| commit | 一次性 push（避免半双语状态混乱） |

---

*Roadmap 时间 2026-05-22 evening · 待 tomorrow 执行*
