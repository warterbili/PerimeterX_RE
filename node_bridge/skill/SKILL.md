---
name: node-bridge-build
description: 用 jsdom + 11 个 env 补环境模块 + Python curl_cffi 协调器，给反爬 SDK（如 PerimeterX / Akamai / 类似厂商）做"补环境"路线的 fallback bridge，不依赖真浏览器。触发场景：(1) 纯算 generator 因 SDK 升级暂时跑不通，需要 Plan B 救火；(2) 新站点 spike — 30 分钟跑通后再决定是否值得做纯算；(3) 高门槛 endpoint（如 iFood feed）纯算评分不够时；(4) 把现有 ifood/ 模板适配到新站点（Grubhub / Walmart / Doordash 等）。触发词：node bridge 补环境 / jsdom 假浏览器 / PX SDK fallback / SDK 升级应急 / 给 <site> 做 bridge / 补环境模板适配。
---

# Skill: 构建 Node Bridge 补环境

> 🔝 **后手 / 升级路径**：[**sdenv** — https://github.com/pysunday/sdenv](https://github.com/pysunday/sdenv)（718⭐, jsdom fork + plugin, 公开补环境 ceiling）
> 何时切到 sdenv：见 [`methodology.md §7`](methodology.md#7-何时升级到-sdenv)。

## 用户触发语句

- "给 \<site\> 做一个 node bridge fallback"
- "纯算 \<site\> 跑不通了，搞个 jsdom 补环境"
- "把 ifood 的 bridge 适配到 \<new_site\>"
- "Plan B 接 \<site\>"
- "PX SDK 升级了，纯算先废，给我搭个临时 bridge"

---

## 你（AI）要交付什么

```
node_bridge/<site>/
├── perimeterx/
│   └── <sdk_file>.js              ← 锁定的目标 SDK
├── px-node-env/
│   ├── env/                       ← 11 个 JSDOM 补环境模块（site 特化）
│   └── ...
├── px_node_bridge.js              ← IPC bridge (从 ifood 模板改 SDK path)
├── px_cookie_generator.py         ← Python 协调器 (curl_cffi chrome131)
├── package.json
└── README.md                      ← 本 site 实际跑通命令 + journal
```

**外加**：跑通的实测输出（拿到目标 cookie + 业务 API 200 + 完整 journal 入 stample/live_validation/journal/）。

---

## 前置 skill 依赖（必读）⭐

本 skill **不是 self-contained**。Node bridge = **3 个上游 skill 的有机合成**。先读这 3 个：

| Skill | 在本流程的角色 | 仓库相对路径 |
|---|---|---|
| **`cdp-browser`** | 上游 — 从真 Chrome dump 指纹值 | `~/projects/Sourcing-AI-Skills/cdp-browser/` |
| **`jni-env-patching`** | 方法论 — "先看真环境再给合理值" 4 步法 | `~/projects/Sourcing-AI-Skills/jni-env-patching/` |
| **`curl_cffi_integrate_scrapy_performance`** | 网络层 — chrome131 TLS 模拟 | `~/projects/Sourcing-AI-Skills/curl_cffi_integrate_scrapy_performance/` |

**完整合成关系图**见 [`methodology.md §0`](methodology.md#0-三技能合成图)。

---

## 操作流程总览

| 阶段 | 内容 | 工作量 | 详见 |
|---|---|---|---|
| **Analyze** | 调研目标站点 / 锁 SDK / 分析 PX endpoints | 30 min - 1 h | `methodology.md §1-3` |
| **Implement** | 复制 ifood 模板 → 改路径常量 → dump 真 Chrome 指纹 → 写 env/ | 4 - 8 h | `new_site_guide.md` 9 步 |
| **Validate** | 跑通 → 真业务 API 调用 → 写 journal | 30 min - 1 h | `new_site_guide.md` 步骤 9 + `stample/live_validation/` |

---

## 已有参考资料

| 资源 | 路径 | 用途 |
|---|---|---|
| iFood 跑通的完整 bridge | `node_bridge/ifood/` | **直接复制当模板** |
| iFood 跑通日志 + 完整 request/response | `stample/live_validation/journal/2026-05-21.md` | 看真实输出长什么样 |
| 方法论 | `node_bridge/skill/methodology.md` | 必读 |
| 实操教程 | `node_bridge/skill/new_site_guide.md` | 9 步实操 |
| sdenv（升级后手） | https://github.com/pysunday/sdenv | 当本 bridge 不够时升级用 |

---

## 三层 fallback 决策（本 skill 在哪一层）

```
Layer 1: 纯算 (revers/ + stample/<site>/px_cookie/) — 主推
   ↓ 跑不通时
Layer 2: 我们 node_bridge (本 skill 教的)  ← 你在这一层
   ↓ 还跑不通时（碰到 typeof document.all / V8-level Proxy 检测）
Layer 3: sdenv (jsdom fork + plugin) — 后手
```

详见 [`methodology.md §"何时升级到 sdenv"`](methodology.md#7-何时升级到-sdenv)。

---

## 别做的事

- ❌ **不要直接用 `generate_px.js`** —— 它是 sourcing-cracked 留下的 standalone 调试版，Node 默认 TLS 会被 PX 识破。**必须**走 Python 协调器（`px_cookie_generator.py`）。
- ❌ **不要在 demo 代码里 hardcode 凭据** —— 代理 user/pass / 账号密码全走 env var（参考 `stample/grub/px_cookie/business_api_demo.js`）。
- ❌ **不要把 `node_modules/` 加进 git** —— 用 `npm install` (package.json 已记录)。
- ❌ **不要试图 mock 全部 browser API** —— 不可能也没必要。按 jni-env-patching 4 步法**只补 SDK 实际查的**。

---

## 快速 sanity check（开干前 30 秒）

```bash
# 1. 确认目标 site 有锁定 SDK
ls stample/<site>/source/

# 2. 确认 ifood 模板能跑（前置）
cd node_bridge/ifood
ls perimeterx/main.min.js
python -c "import curl_cffi; print('OK')"

# 3. 确认 cdp-browser skill 可用
which python && python -c "import websockets; print('OK')"

# 都 OK → 开干 new_site_guide.md
```

---

*Skill 时间 2026-05-22 · iFood _px3 已跑通*
