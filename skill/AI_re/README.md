# AI_re — PX SDK 逆向 AI Skill

> 给 AI agent（Claude Code 等）用的 PerimeterX SDK 逆向能力包。
> 包含算法模块、CLI 工具、参考资料、踩坑清单。

## 目录结构

```
skill/AI_re/
├── SKILL.md                  ← AI agent 触发器 + 速览（先读这个）
├── README.md                  ← 本文件
├── references/                ← 知识层（5 个 .md — "这是什么"）
│   ├── algorithm-chain.md     5 大核心算法的完整公式
│   ├── locate-by-pattern.md   ⭐ 跨版本 grep 定位手册
│   ├── handler-table.md       27 个 OB handler 形状匹配表
│   ├── field-categories.md    EV2 字段 STATIC/DYNAMIC/CONDITIONAL 分类
│   └── gotchas.md             ⭐ 19 条真实踩坑清单
├── playbooks/                 ← 操作层（9 个 .md — "怎么做"）
│   ├── master-workflow.md       ⭐⭐⭐ 端到端总览：cdp 抓包 → 10/10 测试 (Stage 0-8)
│   ├── extract-constants.md            从抓包提常量（运行时）
│   ├── locate-all-constants.md   ⭐    从 SDK 源码统一定位 5 常量（方法学）
│   ├── identify-sdk-version.md         识别 SDK 版本 / 漂移检测
│   ├── reverse-algorithms.md     ⭐⭐  从混淆代码逆出 9 个算法（方法学）
│   ├── locate-functions.md       ⭐⭐  定位 9 类关键功能函数 ⚠️ 区分无感 vs Bundle
│   ├── locate-field-sources.md   ⭐⭐  定位 EV 每个字段的值来源（5 种方法）
│   ├── build-generator.md              从 6 批样本到 generator（8 步）
│   └── validate-generator.md           验证 + 失败诊断决策树
└── scripts/                   ← CLI 工具（14 个：8 个 .js + 6 个 .py）

⚠️ 算法模块 (`reverse/` 9 个 .js) 不在这里了 —— 2026-05-21 清理时把它当成跟
[`../../revers/`](../../revers/) byte-for-byte 重复的副本删了。现在 9 个算法在顶层 [`../../revers/`](../../revers/)：
payload / pc / ob / sid / uuid / hash / memory / antitamper / ns。

    │
    │── 解码器 ──
    ├── decode_payload.js      curl → EV JSON
    ├── decode_response.js     response → state + segments
    ├── extract_hQ.js          SDK → hQ 字典
    │
    │── 跨批次分析 ──
    ├── diff_samples.js        N 批 → STATIC/DYNAMIC/CONDITIONAL (JS 版)
    ├── diff_samples.py        同上 (Python 版)
    ├── build_templates.js     ⭐ 自动生成 STATIC 字段模板
    ├── identify_dynamic_semantics.py   DYNAMIC 字段语义分类
    │
    │── state.* 注入位置匹配 ──
    ├── find_state_keys_in_ev2.py        ⭐⭐⭐ Stage 5 关键脚本
    │
    │── 字段定位 ──
    ├── lookup_keys.js         b64 key → SDK 位置
    ├── probe_dynamic.js       DYNAMIC 字段定位
    │
    │── 我生成 vs 真抓的对比 (debug 用) ──
    ├── diff_http_request.py    ⭐ HTTP 请求字节级 diff
    ├── compare_ev2_field_by_field.py   EV2 逐字段对比
    │
    │── 跨版本迁移 ──
    ├── map_keys.js            旧 SDK key → 新 SDK key 映射
    │
    │── 端到端验证 ──
    └── verify_batch.js         ⭐⭐ 解码闭环回归测试
```

## 怎么用

### 给 AI agent 用

把整个 `AI_re/` 目录放到 Claude Code 的 `~/.claude/skills/` 下（或项目级
`.claude/skills/`），Claude Code 看到 `SKILL.md` 的触发关键词时自动加载。

### 给人类用

```bash
# 解一个抓包
node skill/AI_re/scripts/decode_payload.js samples/1/request_1.txt > ev1.json

# 解 OB 响应
node skill/AI_re/scripts/decode_response.js samples/1/response_1.json TAG > state.json

# 三分类
node skill/AI_re/scripts/diff_samples.js samples/{1..6}/decoded_payload_2.json

# 写 generator 时复用算法
const { generatePayload } = require('./revers/payload');
const { generatePC } = require('./revers/pc');
```

## 配套资源

| 想看什么 | 去哪 |
|---|---|
| 完整技术文档 | [`../../main/ZH/`](../../main/ZH/) (中) / [`../../main/EN/`](../../main/EN/) (英) |
| 抓包工具 | [`../cdp/`](../cdp/) |
| 真实 SDK 样本 | `../../stample/ifood/` / `../../stample/grub/` |

## 状态

| 维度 | 状态 |
|---|---|
| 算法模块 | ✅ 9 个全部实测通过 |
| iFood 生成器 | ✅ 10/10 |
| Grubhub 生成器 | ✅ 10/10 |
| 跨版本定位手册 | ✅ 验证过 2 个 SDK 版本 |
| Gotchas | ✅ 19 条（含 Bundle 5 条） |
| 文档对齐 | ✅ ZH/EN 双语完整对照 |
| 最后校验 | 2026-05-21 |

## 致用户的话

这个 skill **不是博客摘要** —— 它从一次真实的 2 网站 × 12 批样本 ×
5×2 次稳定性测试**全闭环**实战中提炼。所有常量、字段位置、字段类型
都来自实测抓包，不靠记忆或旧文档。

**3 年观察下来，PX 频繁旋转混淆，但从未改过算法。** 把方法论建立在
算法上（grep RFC 标准常量、协议字符串、浏览器 API 名），每次新 SDK
不会让你从头开始 —— 你只需要 30 分钟重新定位关键位置，剩下的代码
都能复用。

详细方法论见 [`../../main/ZH/PX_逆向方法论_通用版.md`](../../main/ZH/PX_逆向方法论_通用版.md)。
