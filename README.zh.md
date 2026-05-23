<div align="center">

```
██╗     ███████╗██████╗ ██╗    ██╗ █████╗ ████████╗███████╗██████╗ ██████╗ ██╗██╗     ██╗
██║     ██╔════╝██╔══██╗██║    ██║██╔══██╗╚══██╔══╝██╔════╝██╔══██╗██╔══██╗██║██║     ██║
██║     ███████╗██║  ██║██║ █╗ ██║███████║   ██║   █████╗  ██████╔╝██████╔╝██║██║     ██║
██║     ╚════██║██║  ██║██║███╗██║██╔══██║   ██║   ██╔══╝  ██╔══██╗██╔══██╗██║██║     ██║
███████╗███████║██████╔╝╚███╔███╔╝██║  ██║   ██║   ███████╗██║  ██║██████╔╝██║███████╗██║
╚══════╝╚══════╝╚═════╝  ╚══╝╚══╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚══════╝╚═╝
```

# PerimeterX (HUMAN Security) SDK · 完整逆向工程 · **v2.0**

### 迄今最完整的 PerimeterX 公开逆向研究

**字节级 SDK 内部逻辑剖析 · 纯算还原 `_px3` / `_px2` · 零浏览器依赖 · 双站 10/10 生产级验证**

**🇬🇧 [English](README.md) · 🇨🇳 简体中文**

<br />

**Authors**: `warterbili`  ·  **Last Updated**: 2026-05-23  ·  **Status**: Actively Maintained  ·  **License**: [Dual-track (AGPL-3.0 + CC BY-NC-SA 4.0)](LICENSE)
<br />
**Last Verified Run**: 2026-05-21 (BR-residential proxy, HTTP 200 from production APIs)

<br />

[![Version](https://img.shields.io/badge/version-2.0-blue?style=for-the-badge)](#)
[![iFood](https://img.shields.io/badge/iFood-10%2F10%20✓-success?style=for-the-badge)](stample/ifood/)
[![Grubhub](https://img.shields.io/badge/Grubhub-10%2F10%20✓-success?style=for-the-badge)](stample/grub/)
[![Bundle](https://img.shields.io/badge/iFood%20Bundle-10%2F10%20✓-success?style=for-the-badge)](bundle/)

![Algorithms](https://img.shields.io/badge/纯算原语-9%20个核心-green?style=flat-square&logo=hackthebox)
![Bundle Primitives](https://img.shields.io/badge/Bundle%20独家-5%20个-darkgreen?style=flat-square)
![Docs](https://img.shields.io/badge/技术文档-20K%2B%20行-orange?style=flat-square&logo=readthedocs)
![Methodology](https://img.shields.io/badge/方法论-10%20章%2F3389%20行-blue?style=flat-square)
![Gotchas](https://img.shields.io/badge/真实踩坑-68%20条-red?style=flat-square&logo=bugatti)
![Fine Gotchas](https://img.shields.io/badge/细粒度踩坑-19%20条-red?style=flat-square)
![Mouse Tracks](https://img.shields.io/badge/真实鼠标轨迹-50%20条-purple?style=flat-square)
![Samples](https://img.shields.io/badge/抓包样本-6%20批%C3%972%20站-yellow?style=flat-square)
![Bundle Doc](https://img.shields.io/badge/Bundle%20主文档-4996%20行-magenta?style=flat-square)
![Userscript](https://img.shields.io/badge/油猴脚本-2131%20行-lightgrey?style=flat-square)
![AI Skill](https://img.shields.io/badge/AI%20Skill-9%20playbook%20%2B%2014%20CLI-brightgreen?style=flat-square&logo=anthropic)
![Last Run](https://img.shields.io/badge/last%20verified%20run-2026--05--21-brightgreen?style=flat-square&logo=githubactions&logoColor=white)
![Longitudinal](https://img.shields.io/badge/纵向追踪-3%20年-blueviolet?style=flat-square)

</div>

<table align="center">
<tr>
<td align="center" width="110"><h2>9</h2><sub><b>核心算法</b><br/>(共享)</sub></td>
<td align="center" width="110"><h2>+5</h2><sub><b>Bundle 独家</b><br/>原语</sub></td>
<td align="center" width="110"><h2>10/10</h2><sub><b>iFood ✓</b></sub></td>
<td align="center" width="110"><h2>10/10</h2><sub><b>Grubhub ✓</b></sub></td>
<td align="center" width="110"><h2>10/10</h2><sub><b>Bundle ✓</b></sub></td>
<td align="center" width="110"><h2>500ms</h2><sub><b>端到端</b></sub></td>
</tr>
<tr>
<td align="center"><h2>68</h2><sub><b>生产踩坑</b><br/>(≥1h debug 实付出)</sub></td>
<td align="center"><h2>20K+</h2><sub><b>文档行数</b></sub></td>
<td align="center"><h2>14</h2><sub><b>CLI 工具</b></sub></td>
<td align="center"><h2>9</h2><sub><b>AI playbook</b></sub></td>
<td align="center"><h2>4</h2><sub><b>AI 意图<br/>manifest</b></sub></td>
<td align="center"><h2>3 年</h2><sub><b>纵向 SDK<br/>漂移追踪</b></sub></td>
</tr>
</table>

```console
╭──────────────────────────────────────────────────────────────╮
│ $ node stample/ifood/px_cookie/ifood_px3.js                  │
│                                                              │
│   ✅ _px3=eyJ1IjoiYWJj...     ttl=330                        │
│   ✅ uuid: c83577f0-5420-11f1-...                            │
│   ✅ ev1=14 fields  ·  ev2=204 fields  ·  smoke_test=21/21   │
│   ⚡ 500 ms  end-to-end                                      │
│                                                              │
│ $ node stample/ifood/px_cookie/business_api_demo.js          │
│                                                              │
│   ✅ HTTP 200   /v1/merchant-info/graphql                    │
│      { name: "Sorveteria Coelhinho", userRating: 5, ... }    │
│      proxy = BR-residential  ·  last run = 2026-05-21        │
╰──────────────────────────────────────────────────────────────╯
```

```
                  ┌──────────────────────────────────────┐
                  │   ⚡ PX 反爬完整握手 · 500 ms 出 cookie  │
                  └──────────────────┬───────────────────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            ▼                        ▼                        ▼
   ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
   │  Layer 1  纯算  │     │ Layer 2  Plan B │     │ Layer 3  Bundle │
   │    99% 流量     │     │   补环境后手    │     │   1% 风险触发   │
   │    ~500 ms      │     │    ~2-3 s       │     │   ~10-15 s      │
   └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
            └────────────────────────┼────────────────────────┘
                                     ▼
                          ┌────────────────────┐
                          │   _px3 / _px2      │
                          │  ⇒ 业务 API 200 ✓  │
                          └────────────────────┘
```

<div align="center">

### [Quick Start](#9-reproduction--quick-start) · [Live 实战](stample/live_validation/) · [Plan B](node_bridge/) · [方法论](main/ZH/methodology/) · [踩坑](bug_report/) · [Bundle](bundle/) · [AI Skill](skill/AI_re/) · [Cite](#17-citation)

</div>

---

## Table of Contents

<table>
<tr>
<td>

**Part I — Foundations**
- [Abstract](#abstract)
- [1. Introduction](#1-introduction)
- [2. Threat Model](#2-threat-model)
- [3. PerimeterX SDK Architecture](#3-perimeterx-sdk-architecture)
- [4. Methodology](#4-methodology)

**Part II — Implementation**
- [5. Implementation Deep-dive](#5-implementation-deep-dive)
- [6. Evaluation](#6-evaluation)
- [7. Empirical Findings (踩坑录)](#7-empirical-findings-踩坑录)

**Part III — Repository**
- [8. Project Structure](#8-project-structure)
- [9. Reproduction · Quick Start](#9-reproduction--quick-start)
- [10. Tooling](#10-tooling)

</td>
<td>

**Part IV — AI & Usage**
- [11. AI Skill Integration](#11-ai-skill-integration)
- [12. By Role · Reading Guide](#12-by-role--reading-guide)

**Part V — Discussion**
- [13. Maintenance Cost & Limitations](#13-maintenance-cost--limitations)
- [14. Related Work](#14-related-work)
- [15. Bilingual Status & Roadmap](#15-bilingual-status--roadmap)

**Part VI — Meta**
- [16. License, Ethics & Responsible Disclosure](#16-license-ethics--responsible-disclosure)
- [17. Citation](#17-citation)
- [18. Acknowledgments](#18-acknowledgments)

</td>
</tr>
</table>

| # | 章节 | 内容概要 |
|---|---|---|
| [1](#1-introduction) | **Introduction** | 背景 · Motivation · 三大贡献 · 仓库一览 |
| [2](#2-threat-model) | **Threat Model** | 防御方能力 · 攻击者目标 · 假设与边界 |
| [3](#3-perimeterx-sdk-architecture) | **PerimeterX SDK Architecture** | 双链路总图 · Collector vs Bundle · 字段三分类 · 9+5 算法清单 |
| [4](#4-methodology) | **Methodology** | 7 阶段逆向方法论 · 时间预算 · 跨平台移植 · SDK 升级急救 |
| [5](#5-implementation-deep-dive) | **Implementation Deep-dive** | 9 算法详解 · 双站 generator · Bundle 完整链 · Plan B Bridge |
| [6](#6-evaluation) | **Evaluation** | 协议级 10/10 · 端到端业务 API · Cross-vendor 对比 |
| [7](#7-empirical-findings-踩坑录) | **Empirical Findings** | Top 5 致命踩坑 · 68 条分类 · 19 细颗粒度 · 纵向漂移 |
| [8](#8-project-structure) | **Project Structure** | 完整目录树（含每模块用途 / 行数 / 链接） |
| [9](#9-reproduction--quick-start) | **Reproduction · Quick Start** | 5 分钟跑通 · 业务 API · Bundle 油猴 |
| [10](#10-tooling) | **Tooling** | 14 个 CLI 工具速查 |
| [11](#11-ai-skill-integration) | **AI Skill Integration** | ⭐ **CDP + AI_re 双 skill 闭环 · AI 端到端 0→1 独立逆向** |
| [12](#12-by-role--reading-guide) | **By Role · Reading Guide** | 11 类读者各自入口 |
| [13](#13-maintenance-cost--limitations) | **Maintenance Cost & Limitations** | 升级周期 · 局限 · 未来工作 |
| [14](#14-related-work) | **Related Work** | 公开 PX 研究 · Cross-vendor |
| [15](#15-bilingual-status--roadmap) | **Bilingual Status & Roadmap** | 中英对照矩阵 |
| [16](#16-license-ethics--responsible-disclosure) | **License, Ethics & Disclosure** | 研究伦理 · 责任披露 |
| [17](#17-citation) | **Citation** | BibTeX |
| [18](#18-acknowledgments) | **Acknowledgments** | 致敬 · 项目演进 |

---

## Abstract

本项目是 **PerimeterX (HUMAN Security) 反爬 SDK 的完整逆向工程研究**，覆盖从协议层字节到 SDK 内部业务逻辑的全栈剖析。我们提交三项核心贡献：(i) **9 个核心加密原语的纯算还原实现**，包含 payload 多步加密链、HMAC-MD5 派生 PC、Unicode Tag Char 隐写 SID、动态 Anti-tamper 等；(ii) **两个站点的端到端 cookie 生成器** —— iFood `_px3` 与 Grubhub `_px2`，**双站 10/10 协议级 + 端到端业务 API 生产级通过**；(iii) **Bundle 按压挑战的完整开源解法**，含 WASM 同步 PoW、贝塞尔鼠标轨迹合成、缅甸文 DOM 隐写、4 组错误栈对齐，共 2131 行实战油猴脚本。实证发现包括 **68 条经生产环境验证的失效模式**、覆盖 2024–2026 三次 SDK 大版本迭代的纵向漂移研究、以及对 DataDome / Akamai / Cloudflare 的横向对比分析。本项目同时提供 **三层 Fallback 容灾架构**（纯算 → Plan B 补环境 → Bundle 按压）与 **业界首个支持 AI 端到端独立 0→1 逆向的双 Skill 闭环**（[`skill/cdp/`](skill/cdp/) 真 Chrome 自动抓样本 + [`skill/AI_re/`](skill/AI_re/) 9 playbook + 5 reference + 14 CLI + 4 意图 manifest），让 Claude / Cursor 可独立完成抓样本 → 解码 → 定位 → 生成 → 验证全流程，构成迄今为止 PerimeterX 反爬研究领域最完整的公开参考实现。

---

## 1. Introduction

### 1.1 Background — What is PerimeterX

**PerimeterX**（2022 年被 HUMAN Security 收购，仍以 PerimeterX 品牌广泛部署）是商业反爬 / 反 bot 防御产品的事实标准之一，被 iFood、Grubhub、DoorDash、Zillow、Crunchyroll、Major League Baseball 等大型站点采用。它通过在客户端注入混淆后的 JavaScript 收集器（`main.min.js`），采集 200+ 维设备 / 行为 / 环境指纹，并通过两条并行链路下发 `_px3`（v3）/ `_px2`（v2）签名 cookie：

- **无感 Collector 链路** —— 99% 业务流量走这条，纯后台 2 个 POST 请求，无 UI 干扰，约 300 ms 完成；
- **按压 Bundle 链路** —— 风险评分触发，弹出可见挑战（按压、点击、滑动）+ 浏览器侧 WASM PoW + 鼠标轨迹采集，约 10–15 秒。

PX 的核心混淆策略是 **每周到每月一次的字节级旋转**：函数名、行号、b64 字典、wire 字符集都会变 —— 但**底层算法（HMAC-MD5 / UUID v1 / Anti-tamper / 隐写）三年未改**。这正是本项目得以构建可持续维护体系的根基。

### 1.2 Motivation

公开领域关于 PerimeterX 的资料长期处于**两极分布**：

- **太浅**：99% 的博客 / Stack Overflow 答案止步于"用 puppeteer / undetected-chromedriver / selenium-stealth 吧" —— 这些方案在 PX 中等风控以上即崩溃；
- **太碎**：少量深入分析只覆盖**单一 bug fix** 或**一两个算法片段**，缺乏端到端可复现实现、缺乏跨站对比、缺乏失效模式系统化。

业界缺一份**完整地图** —— 从字节到算法到协议到业务 API 全栈贯通，可直接生产部署、可教学传授、可学术引用。本项目即为此而生。

### 1.3 Contributions

本工作的核心贡献可归纳为以下五点：

1. **算法级完整公开** —— 9 个 PX 核心加密原语的纯算法 Node.js 实现（[`revers/`](revers/)），每个算法均经字节级跨批验证；
2. **站点级生产实现** —— iFood `_px3` + Grubhub `_px2` 双站端到端 generator，协议层 10/10 通过 + 端到端业务 API 真实 HTTP 200 验证（2026-05-21 BR-residential proxy）；
3. **Bundle 完整解法** —— 业界首个完整开源的 PX 按压挑战 (Captcha) 解决方案，含 WASM 同步 PoW、贝塞尔鼠标轨迹、Plane-14 Tag Char 隐写、缅甸文 DOM 编码，2131 行油猴脚本实测 10/10；
4. **失效模式系统化** —— 68 条生产环境真实 debug 踩坑（每条 ≥1h 真实付出），19 条细颗粒度 gotchas，覆盖 collector / bundle / 环境 / SDK 漂移四大类；
5. **AI Skill 包** —— 可直接挂载到 Claude Code / Cursor 的 PX 逆向 skill，含 9 playbook + 5 reference + 14 CLI + 4 用户意图 manifests，将本项目方法论转化为 AI agent 可直接调用的能力。

### 1.4 What's in this Repository

| 维度 | 数字 |
|---|---|
| **总文件数** | ~380 |
| **总文档行数** | 20000+（中文为主，部分英文双轨） |
| **核心算法实现** | 9 个 Node.js 模块（`revers/`） |
| **生成器** | iFood + Grubhub 双站，各 10/10 |
| **Bundle 主文档** | 4996 行 |
| **Bundle 实战油猴脚本** | 2131 行（10/10 通过） |
| **方法论新版** | 10 章 / 3389 行（含 14 工具 / 算法伪代码 / 10 避坑） |
| **真实抓包样本** | iFood 6 批 + Grubhub 6 批 + Bundle 4 POST |
| **真实鼠标轨迹** | 50 条（Bundle 专用） |
| **踩坑总数** | 68 条（4 主文件）+ 19 条细颗粒度 |
| **研究档案** | 6 份英文 research/（threat model / longitudinal / cross-vendor / failure modes / field entropy / isolation） |
| **AI Skill 资产** | 9 playbook + 5 reference + 14 CLI + 4 manifest |
| **纵向追踪跨度** | 3 年（2024–2026），3 次 SDK 大版本迭代 |

---

## 2. Threat Model

完整正式威胁模型详见 [`research/03_threat_model/`](research/03_threat_model/)。本节给出 README 内自洽摘要。

### 2.1 Defender Capabilities

PerimeterX 防御能力可分为四层：

| 层 | 能力 | 项目应对位置 |
|---|---|---|
| **Network / Edge** | TLS 指纹（JA3/JA4）· HTTP/2 帧序列 · IP 黑名单 · ASN 分级（住宅 vs 数据中心） | [`bug_report/3_environment.md`](bug_report/3_environment.md) |
| **Browser Fingerprint** | UA + Sec-CH-UA · Canvas / WebGL / AudioContext · 字体列表 · 时区一致性 | [`main/ZH/EV1_EV2_UNIFIED_REFERENCE.md`](main/ZH/EV1_EV2_UNIFIED_REFERENCE.md) |
| **Behavioral** | 鼠标轨迹 / 按键时序 / 滚动节律 / 触摸压力 · 焦点切换序列 | [`bundle/stample/mouse_tracks/`](bundle/stample/) 50 条样本 |
| **Cryptographic** | 动态 Anti-tamper key / 时间戳 nonce · HMAC-MD5 签名 · Unicode 隐写 · WASM PoW | [`revers/`](revers/) 9 算法 |

### 2.2 Attacker Goals & Assumptions

本项目假设的攻击者（即"逆向方"）：

- **目标**：稳定获取合法 `_px3` / `_px2` cookie，用于自动化访问业务 API（学术研究、价格监控、合规自动化、安全审计）；
- **能力**：拥有抓包工具（Charles / Fiddler / CDP）、住宅代理、目标站点测试账号、Node.js 运行环境；
- **不假设**：不假设拥有 PX 内部源码、不假设可入侵 PX 后端、不假设可旁路 TLS。

### 2.3 Out-of-scope

本项目**明确不覆盖**：分布式爬取调度、代理池管理、CAPTCHA OCR / 第三方打码、UA 池伪造、对 PX 后端的拒绝服务攻击。这些属于工程化运维范畴，与协议层 / 算法层逆向研究正交。

---

## 3. PerimeterX SDK Architecture

### 3.1 Dual-path Defense Overview

```
                      ┌──────────────────┐
                      │   main.min.js    │
                      │  (PX Collector)  │
                      └─────────┬────────┘
                                │
                     ┌──────────┴──────────┐
                     ▼                     ▼
        ┌──────────────────────┐  ┌──────────────────────┐
        │  无感 Collector 链路 │  │   按压 Bundle 链路   │
        │  ─────────────────   │  │  ──────────────────  │
        │  · 99% 流量          │  │  · 1% 风险评分触发    │
        │  · 2 POST            │  │  · 4 POST            │
        │  · ~300 ms           │  │  · WASM + PoW + 按压 │
        │  · 无 UI             │  │  · 10-15 秒          │
        │  · 9 共享算法        │  │  · 9 共享 + 5 独家   │
        └──────────┬───────────┘  └──────────┬───────────┘
                   │                         │
                   └─────────────┬───────────┘
                                 ▼
                       ┌──────────────────┐
                       │  _px3 / _px2     │
                       │  签名 cookie     │
                       │  ⇒ 业务 API 通行 │
                       └──────────────────┘
```

### 3.2 Collector 链路（无感）

Collector 路径是 PX 的默认无感链路，覆盖 99% 业务流量：

1. **页面加载** → `main.min.js` 注入，初始化 `_px3.appId / state / pxsid / pxhd`；
2. **采集 200+ 字段** → 设备指纹、浏览器环境、行为节律，组成 EV1（基础）/ EV2（扩展）；
3. **第一个 POST `/api/v2/collector`** → 携带 `payload=<加密 EV>` + `pc=<HMAC-MD5 签名>` + `sid=<隐写>`；
4. **服务器响应 OB** → 含 `state.no/qa/vid/pxsid/cts/appId/jf/...` 加密字段；
5. **第二个 POST `/api/v2/collector`** → 携带 EV2，注入服务器下发的 state；
6. **服务器下发 `_px3` cookie** → ttl 通常 330 秒（iFood）/ 500 秒（Grubhub）。

详见 [`main/ZH/PX_SDK_逆向技术文档.md`](main/ZH/PX_SDK_逆向技术文档.md) §2-3。

### 3.3 Bundle 链路（按压挑战）

Bundle 路径在风险评分超阈值时触发：

1. **触发条件** → 服务器返回 `px-captcha` HTML 或 collector 拒发 `_px3`；
2. **加载 `captcha.js`** → Bundle 专用 SDK，AppID 不同（iFood = `PXd6f03jmq8h6c7382req0`），含 WASM 模块；
3. **6 个事件** → init / mouse_move / touch / pow_start / pow_done / press_complete；
4. **WASM 同步 PoW** → SHA-256 暴力穷举，CPU 工作 ~5-10 秒（**必须同步 SHA-256，异步 crypto.subtle 爆 600s+**，见 gotcha #5）；
5. **贝塞尔鼠标轨迹** → 从 50 条真实样本合成 → POST 到 `/api/v1/collector`；
6. **缅甸文 DOM 隐写** → Plane-14 Tag Char + 缅甸字符注入 DOM，反 Copy as cURL；
7. **下发 `_px3`** → 含 Bundle 通过标记。

详见 [`main/ZH/PX_Bundle_逆向方法论.md`](main/ZH/PX_Bundle_逆向方法论.md) + [`bundle/doc/Bundle_完整技术文档.md`](bundle/doc/Bundle_完整技术文档.md)（4996 行）。

### 3.4 Field Taxonomy（EV1 / EV2 / State 三分类）

PX 字段总数 200+，本项目首次提出 **三分类法**：

| 分类 | 比例 | 特征 | 处理策略 |
|---|---|---|---|
| **STATIC** | ~40% | 跨批不变（如 `appId / TAG / FT / 操作系统 / 屏幕分辨率`） | 模板硬编码 |
| **DYNAMIC** | ~50% | 每次重新计算（`uuid / 时间戳 / mouse_no / focus_no`） | 算法生成 |
| **CONDITIONAL** | ~10% | 取决于服务器下发 state（`state.no / qa / vid / pxsid`） | OB 解码后回填 |

详细字段表见 [`main/ZH/EV1_EV2_UNIFIED_REFERENCE.md`](main/ZH/EV1_EV2_UNIFIED_REFERENCE.md)（204+ 字段三分类 + 跨平台对照）。

### 3.5 9 Core Algorithms（双链路共享）

| # | 算法 | 输入 → 输出 | 实现文件 | 文档章节 |
|---|---|---|---|---|
| 1 | **payload 加密链** | EV JSON → `PX serialize` → `XOR(50)` → `Base64(UTF-8)` → `20 字符交织` → POST `payload=` | [`revers/payload.js`](revers/) | 技术文档 §3.1 |
| 2 | **PC 签名** | `HMAC-MD5(serialize(events), uuid:TAG:FT)` → 32 hex → 数字保留 + 字母 ASCII%10 → 间隔取 → 16 位 | [`revers/pc.js`](revers/) | 技术文档 §3.2 |
| 3 | **OB 解码** | 服务器响应字符串 → 27 个 handler 派发 → `state.*` 字段 | [`revers/ob.js`](revers/) | 技术文档 §3.3 |
| 4 | **SID Unicode 隐写** | `state.pxsid + hh(state.no)` → `hh()` 编为 `U+E0100+` Plane-14 不可见 Tag Char | [`revers/sid.js`](revers/) | 技术文档 §3.4 |
| 5 | **UUID v1** | PX 兼容 clockseq（非标准 RFC 4122 行为） | [`revers/uuid.js`](revers/) | 技术文档 §3.5 |
| 6 | **Anti-tamper** | `key = te(state.to, parseInt(state.no)%10 + 2)` —— **key 名是动态的** | [`revers/antitamper.js`](revers/) | 技术文档 §3.6 |
| 7 | **Hash (djb2 变体)** | 字符串 → 32 位 hash → 字段填充 | [`revers/hash.js`](revers/) | 技术文档 §3.7 |
| 8 | **Memory** | `performance.memory` 合成（heap 三元组） | [`revers/memory.js`](revers/) | 技术文档 §3.8 |
| 9 | **/ns probe** | `/ns` 端点同步（DNS-like 健康检查） | [`revers/ns.js`](revers/) | 技术文档 §3.9 |

### 3.6 Bundle 独家 +5 原语

| # | 原语 | 用途 |
|---|---|---|
| B1 | **WASM PoW** | SHA-256 暴力穷举挑战，必须同步实现 |
| B2 | **贝塞尔鼠标轨迹** | 从 50 真实样本合成，含 catmull-rom 插值 |
| B3 | **缅甸文 DOM 编码** | 缅甸字符 + Unicode tag 注入 DOM，反 Copy as cURL |
| B4 | **4 组错误栈对齐** | 故意触发 4 种 JS 异常，stack trace 是指纹 |
| B5 | **按压时长 / 压力曲线** | touch 事件的 force / radiusX / radiusY 合成 |

详见 [`bundle/doc/Bundle_完整技术文档.md`](bundle/doc/Bundle_完整技术文档.md) §6-12。

---

## 4. Methodology

完整方法论文档：[`main/ZH/methodology/`](main/ZH/methodology/)（10 章 / 3389 行，包含 14 工具 / 算法伪代码 / 10 避坑附录）。

### 4.1 7-Stage Reverse Workflow

| 阶段 | 目标 | 时间预算 | 文档 |
|---|---|---|---|
| **Stage 1 · Capture** | 抓 N 批样本（≥ 6 批），不同账号 / 时间 / IP | 30 min | [01_stage1_capture.md](main/ZH/methodology/01_stage1_capture.md) |
| **Stage 2 · Decode** | 解 payload XOR/b64/交织 + 解 OB 响应 | 1 h | [02_stage2_decode.md](main/ZH/methodology/02_stage2_decode.md) |
| **Stage 3 · Classify** | 字段三分类（STATIC/DYNAMIC/CONDITIONAL） | 1 h | [03_stage3_classify.md](main/ZH/methodology/03_stage3_classify.md) |
| **Stage 4 · Locate** | grep 算法在 main.min.js 中的位置（grep 工具书） | 2 h | [04_stage4_locate.md](main/ZH/methodology/04_stage4_locate.md) |
| **Stage 5 · Value Match** | `state.* → EV2 b64 key` 跨批值匹配 | 1-2 h | [05_stage5_value_match.md](main/ZH/methodology/05_stage5_value_match.md) |
| **Stage 6 · Implement** | 写 generator + 字节级 diff | 4-8 h | [06_stage6_implement.md](main/ZH/methodology/06_stage6_implement.md) |
| **Stage 7 · Validate** | 协议级 10/10 + 端到端业务 API | 2 h | [07_stage7_validate.md](main/ZH/methodology/07_stage7_validate.md) |

### 4.2 跨平台移植 (Cross-platform Port)

新站点移植预算：8-12 h 完成度，**90% 算法复用**，只需替换 5 个站点特有常量（AppID / TAG / FT / endpoint / state→EV2 key 映射）。详见 [08_cross_platform.md](main/ZH/methodology/08_cross_platform.md) + [`main/ZH/PX_完整SDK对照逆向方法论.md`](main/ZH/PX_完整SDK对照逆向方法论.md)（iFood vs Grubhub 1441 行对照）。

### 4.3 SDK 升级急救 (Emergency Playbook)

PX collector 每月 1-2 次升级，bundle 每 2-3 周。本项目提供 ~2 小时恢复 playbook：[09_sdk_upgrade.md](main/ZH/methodology/09_sdk_upgrade.md)。真实升级 diff 案例：[`bug_report/sdk_drift_cases/2026-05-19_ifood/`](bug_report/sdk_drift_cases/)（iFood 中版本 202→225 b64 字典 + TAG/FT 换）。

---

## 5. Implementation Deep-dive

### 5.1 Algorithm Layer — [`revers/`](revers/)

9 个核心算法的纯算 Node.js 实现，无浏览器依赖。每个算法均经字节级跨批验证（6 批 iFood + 6 批 Grubhub），单元测试覆盖率 ~100%。

**核心算法示例（4 个最易踩坑）**：

```js
// 1. payload 加密链 (revers/payload.js)
events → PX_serialize(events)              // ⚠️ ≠ JSON.stringify
       → XOR(_, 50)                         //    单字节 XOR
       → Base64(_, 'utf8')                  // ⚠️ 必须 UTF-8，禁 Latin-1
       → interleave(_, key_pos)              //    20 字符交织
                                            //    key_pos = f(uuid, state.no)

// 2. PC HMAC-MD5 (revers/pc.js)
const md5_hex = hmacMD5(
  PX_serialize(events),
  `${uuid}:${TAG}:${FT}`                    // 注意冒号
);                                          // → 32 hex chars
const digits  = md5_hex.replace(/[a-f]/g, c => c.charCodeAt(0) % 10);
const pc16    = digits.split('').filter((_, i) => i % 2).join('');  // 16 位

// 3. Anti-tamper 动态 key 注入 (revers/antitamper.js)
const idx = parseInt(state.no) % 10;        // ⚠️ 必须 parseInt（gotcha #1）
const key = te(state.to, idx + 2);          // ⚠️ key NAME 是动态的
const val = te(state.to, idx + 1);
events.d[key] = val;                        // ⚠️ 保留原位置（gotcha #17）

// 4. SID Unicode Tag Char 隐写 (revers/sid.js)
const sid = state.pxsid + hh(state.no);     // hh() 把每位数字编为
                                            // U+E0100+ Plane-14 不可见 Tag Char
                                            // 反 "Copy as cURL" 重放
```

完整算法分析见 [`main/ZH/PX_SDK_逆向技术文档.md`](main/ZH/PX_SDK_逆向技术文档.md) §3（2597 行 PX 完整技术）。

### 5.2 Site Generators — [`stample/`](stample/)

双站镜像结构，每个站点目录含 `px_cookie/` (generator) + `source/` (SDK 锁定) + `sample/` (6 批抓包) + `script/` (8 个站点专用工具)。

| 站点 | AppID | TAG | FT | Cookie | TTL | SDK Hash |
|---|---|---|---|---|---|---|
| **iFood** | `PXO1GDTa7Q` | `U0MmDhUmOnhXSw==` | `401` | `_px3` | 330 s | `b47a639c…` |
| **Grubhub** | `PXO97ybH4J` | `FmYgK1gdJEAP` | `359` | `_px2` | 500 s | `5e81bffc…` |

所有常量**直接从真实抓包 POST body 提取**（[`stample/{ifood,grub}/sample/`](stample/) 6 批可审计），不是文档记忆。Smoke test 各 21/21（iFood）/ 17/17（Grubhub）全通过。

### 5.3 Bundle Path — [`bundle/`](bundle/)

业界首个完整开源的 PX 按压挑战解法：

```
bundle/
├── README.md                          4 级深度学习路径
├── doc/Bundle_完整技术文档.md          ⭐ 4996 行 — Bundle 完整解构
├── source/                            captcha.js + WASM + SDK_INFO
│   ├── WASM_ANALYSIS.md               WASM 模块逆向分析
│   └── SDK_INFO.md                    Bundle SDK 元数据
├── stample/                           4 raw POST + 50 鼠标轨迹 + EV 模板
│   └── mouse_tracks/                  50 条真实人类鼠标轨迹（采集成本最高）
└── script/userscripts/
    └── px_bundle3_auto.user.js        ⭐ 2131 行油猴脚本（10/10 实战通过）
```

**Bundle 独家技术亮点**：

- **WASM 同步 PoW** — SHA-256 暴力穷举，CPU 工作 5-10 s（必须同步，异步 600s+ TIMEOUT）
- **贝塞尔轨迹合成** — catmull-rom 插值，从 50 真实样本统计采样
- **缅甸文 + Plane-14 Tag Char DOM 隐写** — 反 Copy as cURL 重放
- **4 组错误栈对齐** — 故意触发 JS 异常，stack trace 是指纹

详见 [`main/ZH/PX_Bundle_逆向方法论.md`](main/ZH/PX_Bundle_逆向方法论.md)（973 行，8 阶段方法论）。

### 5.4 Plan B — [`node_bridge/`](node_bridge/)

**纯算失效时的二级路径** —— 当 PX 推出新加密层（罕见但发生过）导致纯算暂时失效时，启用"补环境 + jsdom"方案：

```
node_bridge/
├── README.md                          ~400 行入门 + 设计哲学
├── ifood/                             iFood Bridge 实现
├── grub/                              Grubhub Bridge 实现
└── skill/
    ├── SKILL.md                       AI Skill 入口（115 行）
    ├── methodology.md                 Bridge 方法论（520 行）
    └── new_site_guide.md              新站点接入指南（411 行）
```

| 维度 | Layer 1（纯算） | Layer 2（Plan B） |
|---|---|---|
| 浏览器依赖 | 0 | 0（仅 jsdom） |
| 启动开销 | ~50 ms | ~1-2 s（jsdom init） |
| 单次速度 | ~500 ms | ~2-3 s |
| 新加密层应对 | 需算法侧重写 | jsdom 自动求值，**无需重写** |
| 维护成本 | 每月 1-2 次小升级 | 几乎零（PX 改算法不影响） |
| 适用场景 | 99% 默认生产 | 应急 / 长尾站点 / 快速接新站 |

Plan B 是项目的**容灾保险**，确保在 PX 重大重构期间业务零中断。

---

## 6. Evaluation

### 6.1 Protocol-level Validation（2026-05-20）

| 站点 | 验证项 | 测试结果 |
|---|---|---|
| **ifood.com.br** | AppID `PXO1GDTa7Q` · TAG `U0MmDhUmOnhXSw==` · FT `401` · cookie `_px3` (ttl 330) | **10/10 通过** |
| **grubhub.com** | AppID `PXO97ybH4J` · TAG `FmYgK1gdJEAP` · FT `359` · cookie `_px2` (ttl 500) | **10/10 通过** |
| **iFood Bundle 按压** | Bundle AppID `PXd6f03jmq8h6c7382req0` · FT `388` · 6 事件 + WASM + PoW | **10/10 通过** |

所有常量**直接从真实抓包 POST body 提取**（[`stample/{ifood,grub}/sample/`](stample/) 6 批可审计），不依赖文档记忆。

### 6.2 End-to-end Business API（2026-05-21）

不只是字节正确，**真打代理 + 真调业务 API + 真返回 200**。详细 journal：[`stample/live_validation/journal/2026-05-21.md`](stample/live_validation/journal/2026-05-21.md)

| 站点 | 代理 | 业务 API | 真实响应 |
|---|---|---|---|
| **iFood** | BR 巴西住宅 (Bright Data) | `POST cw-marketplace.ifood.com.br/v1/merchant-info/graphql?lat&lng&channel=IFOOD` | ✅ HTTP 200 → `{ name: "Sorveteria Coelhinho - Shopping Vitória", userRating: 5, available: false }` |
| **Grubhub** | 本机直连（US 代理可选） | `POST /auth (anonymous) + /auth/login (Bearer+real account)` | ✅ HTTP 200 anon_token + HTTP 463 verify_methods（业务层 OTP，桌面 5/5 同判定） |

**附加发现**：iFood 服务侧叠了 **Akamai Bot Manager**（响应 `set-cookie: ak_bmsc=...`），但合法 PX cookie + BR IP 同时通过 Akamai + PX 双层防御。

### 6.3 Cross-vendor Comparison

横向对比详见 [`research/04_cross_vendor_comparison/`](research/04_cross_vendor_comparison/)。简要矩阵：

| 维度 | PerimeterX | DataDome | Akamai BMP | Cloudflare |
|---|---|---|---|---|
| 客户端混淆强度 | ★★★★☆ | ★★★★★ | ★★★☆☆ | ★★★☆☆ |
| WASM PoW | ✅ Bundle | ✅ | ❌ | ⚠️ 可选 |
| 行为分析 | ★★★★☆ | ★★★☆☆ | ★★★★☆ | ★★☆☆☆ |
| 公开逆向资料 | **本项目最完整** | 中 | 少 | 多 |

---

## 7. Empirical Findings (踩坑录)

**项目最独家资产**。68 条经生产环境验证的失效模式 + 19 条细颗粒度 gotchas，每条均付出过真实 debug 时间（最少 1 小时）。

### 7.1 Top 5 Critical Pitfalls（写代码前先读）

1. ⭐⭐⭐ **`state.no` 必须 `parseInt`** — 字符串导致 PC 通过但 `_px3` 不下发，~90% 新手中招（[gotcha #01](bug_report/gotchas/01_state_no_parseint.md)）
2. ⭐⭐⭐ **anti-tamper 字段位置破坏** — `delete + add` 让 key 跑到末尾，迭代顺序变，签名 mismatch（[gotcha #06](bug_report/gotchas/06_ob_handler_by_name.md)）
3. ⭐⭐⭐ **`state.* → EV2 b64 key` 每站点完全不同** — iFood vs Grubhub 用不同 key 注入（[gotcha #11](bug_report/gotchas/11_state_to_ev2_key.md)）
4. ⭐⭐⭐ **base64 的 `+` 不能转空格** — Python `urllib.parse.unquote_plus` 会吃 `+`（[gotcha #02](bug_report/gotchas/02_utf8_latin1_xor.md)）
5. ⭐⭐⭐ **WASM PoW 必须用同步 SHA-256** — `crypto.subtle` 异步爆 600s+（[gotcha #16](bug_report/gotchas/16_pxuuid_wasm_init.md)）

### 7.2 68 Documented Failure Modes（4 大分类）

| 文件 | 路径 | 数量 | 代表踩坑 |
|---|---|---|---|
| [`1_collector_path.md`](bug_report/1_collector_path.md) | 无感 Collector 路径 | **33 条** | parseInt / anti-tamper / b64 / state mapping |
| [`2_bundle_path.md`](bug_report/2_bundle_path.md) | 按压 Bundle 路径 | **20 条** | WASM PoW / 缅甸文 / 错误栈 / 鼠标轨迹 |
| [`3_environment.md`](bug_report/3_environment.md) | 环境 / 基础设施 | **8 条** | IP / TLS / UA / Python sid 编码 |
| [`4_sdk_drift.md`](bug_report/4_sdk_drift.md) | SDK 版本漂移 | **7 条** | b64 字典 / TAG/FT 换 / 函数名变 |

### 7.3 19 Fine-grained Gotchas — [`bug_report/gotchas/`](bug_report/gotchas/)

每条独立文件 + 完整修复代码 + 单元测试：
state_no_parseint · utf8_latin1_xor · antitamper_position · pc_md5_slice · sid_stego_even_tag · ob_handler_by_name · uuid_v1_clock · hq_index_off_by_one · wire_chars_confusion · interleave_odd_length · state_to_ev2_key · cross_event_key_reuse · ip_rate_limit · cookie_ttl · jf_offset_minus_one · pxuuid_wasm_init · pointer_float_coords · press_duration_mismatch · myanmar_template_drift

### 7.4 SDK Drift Longitudinal Study — [`research/02_sdk_drift_longitudinal/`](research/02_sdk_drift_longitudinal/)

跨 2024–2026 的 3 年纵向追踪 + iFood 中版本升级实战 diff（[`sdk_drift_cases/2026-05-19_ifood/`](bug_report/sdk_drift_cases/)）。关键发现：

- **算法层 3 年不变** —— 标准 MD5 / HMAC / UUID / SHA-256 等
- **表面层每次升级换** —— 函数名、行号、b64 key 字典、wire 字符集
- **平均升级恢复时间** —— 1-3 小时（按 [09_sdk_upgrade.md](main/ZH/methodology/09_sdk_upgrade.md) playbook）

### 7.5 Field Entropy Analysis — [`research/01_field_entropy/`](research/01_field_entropy/)

204+ EV1/EV2 字段的动态性熵分析，量化每个字段在跨批样本中的稳定性，为字段三分类提供数据支撑。

---

## 8. Project Structure

```
perimeter/                              v2.0 · 2026-05-23
│
├── README.md / README.zh.md            ← 本文件（双语 · 论文级导论；英文为 GitHub 首页，中文companion 即 README.zh.md）
├── LICENSE                              ⭐ 双轨 License（AGPL-3.0 代码 + CC BY-NC-SA 4.0 文档）
│
├── main/                               ⭐ 核心技术文档（双语轨道）
│   ├── ZH/                             中文（10800+ 行）
│   │   ├── methodology/                ⭐ 10 章分文件方法论（3389 行，A+B+C 合并）
│   │   │   ├── README.md                总入口 + 学习路径（130 行）
│   │   │   ├── 00_overview.md           7 阶段地图 + 时间预算（210 行）
│   │   │   ├── 01..09_stage*.md         9 章详解（capture / decode / classify / locate /
│   │   │   │                              value_match / implement / validate /
│   │   │   │                              cross_platform / sdk_upgrade）
│   │   │   └── appendix/                14 工具 / 算法伪代码 / 10 避坑（A+B+C）
│   │   ├── EV1_EV2_UNIFIED_REFERENCE   ⭐ 204+ 字段三分类 + 跨平台对照（227 行）
│   │   ├── PX_SDK_逆向技术文档.md       2597 行 — PX 完整技术（最全单文件）
│   │   ├── PX_逆向方法论_通用版.md       1233 行 — 老版单文件（参考）
│   │   ├── PX_完整SDK对照逆向方法论     1441 行 — iFood vs Grubhub 跨平台对照
│   │   └── PX_Bundle_逆向方法论.md       973 行 — Bundle 8 阶段方法论
│   └── EN/                             英文版（3 份核心完整，其余翻译中）
│
├── research/                           ⭐ 6 份英文研究档案（学术骨架）
│   ├── 01_field_entropy/                字段动态性熵分析
│   ├── 02_sdk_drift_longitudinal/       3 年 SDK 升级时间线
│   ├── 03_threat_model/                 ⭐ 正式威胁模型
│   ├── 04_cross_vendor_comparison/      PX vs DataDome vs Akamai vs Cloudflare
│   ├── 05_field_isolation_experiments/  字段隔离实验数据
│   └── 06_failure_modes/                故障模式分类
│
├── revers/                             ⭐ 9 个算法纯算实现（Node.js）
│   ├── payload.js                       EV → POST `payload=`（XOR+b64+交织）
│   ├── pc.js                            HMAC-MD5 + 数字提取 → 16 位 PC
│   ├── ob.js                            OB 解码 + handler 派发（27 个）
│   ├── sid.js                           SID + Unicode Tag Char 隐写
│   ├── uuid.js                          UUID v1 (PX 兼容 clockseq)
│   ├── hash.js                          djb2 变体
│   ├── memory.js                        performance.memory 合成
│   ├── antitamper.js                    动态 XOR key/value 注入
│   └── ns.js                            /ns 端点同步
│
├── node_bridge/                        ⭐ Plan B — 纯算失效时的容灾后手（jsdom 补环境）
│   ├── README.md                        ~400 行入门 + 设计哲学
│   ├── ifood/  grub/                    两站点 bridge 实现
│   └── skill/                           AI Skill 包
│       ├── SKILL.md                     115 行 — AI 入口
│       ├── methodology.md               520 行 — Bridge 方法论
│       └── new_site_guide.md            411 行 — 新站点接入指南
│
├── skill/                              ⭐ AI agent skill 包（让 AI 替你逆向）
│   ├── AI_re/                           PX 逆向 skill
│   │   ├── README.md                     总入口
│   │   ├── SKILL.md                      ⭐ AI 调用入口（Claude / Cursor 喂这个）
│   │   ├── skills/                       ⭐ 4 份用户意图入口 manifests
│   │   │   ├── px_capture/                抓 N 批新样本
│   │   │   ├── px_decode/                 解码一批 batch
│   │   │   ├── px_port_to_new_platform/   跨站点移植 generator
│   │   │   └── px_sdk_drift_audit/        SDK 升级响应
│   │   ├── playbooks/                    ⭐ 9 份操作手册（"怎么做"）
│   │   │   ├── master-workflow.md         主流程入口
│   │   │   ├── identify-sdk-version.md    SDK 版本识别
│   │   │   ├── extract-constants.md       常量提取
│   │   │   ├── locate-functions.md        函数定位
│   │   │   ├── locate-all-constants.md    全量常量定位
│   │   │   ├── locate-field-sources.md    字段源定位
│   │   │   ├── reverse-algorithms.md      算法逆向
│   │   │   ├── build-generator.md         构建生成器
│   │   │   └── validate-generator.md      验证生成器
│   │   ├── references/                   ⭐ 5 份知识层（"是什么"）
│   │   │   ├── algorithm-chain.md         算法链总图
│   │   │   ├── field-categories.md        字段三分类
│   │   │   ├── handler-table.md           27 OB handlers
│   │   │   ├── locate-by-pattern.md       grep 工具书
│   │   │   └── gotchas.md                 踩坑速查
│   │   └── scripts/                      ⭐ 14 个 CLI 工具
│   └── cdp/                             真 Chrome CDP 抓包 skill（无 webdriver 特征）
│
├── stample/                            ⭐ 站点实现层（双站镜像）
│   ├── ifood/
│   │   ├── px_cookie/                    ifood_px3.js + 模板 + smoke_test 21/21 ✓
│   │   ├── source/                       main.min.js (锁定 SHA b47a639c…)
│   │   ├── sample/                       6 批真实抓包 × 11 文件
│   │   ├── px_cookie/business_api_demo.js  端到端业务 API demo
│   │   ├── script/                       8 个 iFood 专用脚本
│   │   └── RESEARCH_PURPOSE.md           研究用途声明
│   ├── grub/                            （结构同 iFood）
│   └── live_validation/                ⭐ 端到端业务 API 实战 journal
│       └── journal/2026-05-21.md         BR 住宅代理 + iFood/Grubhub 双站 HTTP 200
│
├── bundle/                             ⭐ Bundle 按压挑战完整解法
│   ├── README.md                        4 级深度学习路径
│   ├── doc/Bundle_完整技术文档.md        ⭐ 4996 行 — Bundle 完整解构
│   ├── source/                          captcha.js + WASM + SDK_INFO
│   │   ├── WASM_ANALYSIS.md             WASM 模块逆向
│   │   └── SDK_INFO.md                  Bundle SDK 元数据
│   ├── stample/                         样本（4 raw POST + 50 鼠标轨迹）
│   │   ├── mouse_tracks/                ⭐ 50 条真实人类鼠标轨迹（采集成本最高）
│   │   └── README.md
│   ├── doc/Bundle_完整技术文档.md       4996 行
│   └── script/userscripts/
│       └── px_bundle3_auto.user.js      ⭐ 2131 行油猴脚本（10/10）
│
└── bug_report/                         ⭐ 68 条真实生产踩坑（最独家资产）
    ├── README.md                        4 文件分类入口
    ├── 1_collector_path.md              Collector 路径 33 条
    ├── 2_bundle_path.md                 Bundle 路径 20 条
    ├── 3_environment.md                 环境 / 基础设施 8 条
    ├── 4_sdk_drift.md                   SDK 版本漂移 7 条
    ├── gotchas/                         ⭐ 19 条细颗粒度（每条独立文件 + 修复 + 测试）
    └── sdk_drift_cases/                 ⭐ 真实升级 diff 实战
        └── 2026-05-19_ifood/             iFood 中版本（202→225 b64 字典 + TAG/FT 换）
```

---

## 9. Reproduction · Quick Start

### 9.1 5-minute Quick Start

```bash
# 1. clone + install
git clone <项目地址> perimeter
cd perimeter && npm install

# 2. iFood — 产生 _px3
cd stample/ifood/px_cookie
node smoke_test.js          # 自检 21/21 ✓
node ifood_px3.js           # 实战拿 _px3
# 期望输出:
# ✅ _px3=eyJ1IjoiYWJj...  ttl=330
# uuid: c83577f0-5420-11f1-...
# ev1_fields: 14, ev2_fields: 204

# 3. Grubhub — 产生 _px2
cd ../../../stample/grub/px_cookie
node smoke_test.js          # 自检 17/17 ✓
node grubhub_px2.js

# 4. Bundle 路径（按压挑战）— 装油猴脚本
# 浏览器装 Tampermonkey → 加载 bundle/script/userscripts/px_bundle3_auto.user.js
# 访问 https://www.ifood.com.br/ → 触发挑战 → 自动拿 _px3
```

500 ms 内完成 PX 完整握手：2 个 collector POST，10 个加密算法，1 个 cookie。

### 9.2 End-to-end Business API（需代理）

```bash
# iFood (需 BR 住宅代理)
export HTTPS_PROXY='http://<user>:<pwd>@<host>:<port>'
node stample/ifood/px_cookie/business_api_demo.js
# → HTTP 200 { name: "Sorveteria Coelhinho", userRating: 5, ... }

# Grubhub (代理可选；想跑 full chain 加账号 env var)
export GRUBHUB_EMAIL='your@email.com'
export GRUBHUB_PASSWORD='yourpassword'
node stample/grub/px_cookie/business_api_demo.js
# → HTTP 200 anon_token + HTTP 463 verify_methods
```

### 9.3 Bundle Userscript（按压挑战自动化）

```
1. 浏览器装 Tampermonkey 扩展
2. 加载 bundle/script/userscripts/px_bundle3_auto.user.js (2131 行)
3. 访问 https://www.ifood.com.br/ 或 https://www.grubhub.com/
4. 触发风控挑战 → 脚本自动求解 WASM PoW + 合成贝塞尔轨迹 + 提交按压
5. 服务器下发 _px3 → 业务 API 通行
```

---

## 10. Tooling

14 个 CLI 工具（[`skill/AI_re/scripts/`](skill/AI_re/scripts/)）+ 各站点专用脚本：

```bash
# 1. 解一个抓包 payload
node skill/AI_re/scripts/decode_payload.js stample/ifood/sample/1/request_1.txt
# → EV1/EV2 JSON 输出

# 2. 解 OB 响应（27 handlers 派发）
node skill/AI_re/scripts/decode_response.js \
     stample/ifood/sample/1/response_1.json \
     U0MmDhUmOnhXSw==
# → state.no/qa/vid/pxsid/cts/appId/jf/...

# 3. 跨批字段三分类（STATIC/DYNAMIC/CONDITIONAL）
node skill/AI_re/scripts/diff_samples.js \
     stample/ifood/sample/{1..6}/decoded_payload_2.json
# → 字段稳定性矩阵

# 4. state.* → EV2 b64 key 跨批值匹配（⭐ 关键脚本）
python skill/AI_re/scripts/find_state_keys_in_ev2.py
# → 跨平台映射表

# 5. 我生成 vs 真抓 — 字段级 diff
python stample/ifood/script/compare_my_ev2.py /tmp/my_ev2.json

# 6. HTTP 请求字节级 diff
python stample/ifood/script/diff_http.py /tmp/my_post.txt

# 7. 验证 6 批解码闭环
./stample/ifood/script/verify_all.sh
# → 期望: 6/6 通过 — 解码器对当前 SDK 工作
```

完整 14 工具列表见 [`skill/AI_re/scripts/README.md`](skill/AI_re/scripts/) 与 [`main/ZH/methodology/appendix/A_tools.md`](main/ZH/methodology/appendix/A_tools.md)。

---

## 11. AI Skill Integration

> **⭐ 业界首个支持 AI 端到端 0→1 独立逆向 PerimeterX 站点的双 Skill 闭环**

本项目将完整方法论封装为 **两个互补的 AI Skill**，组合使用即可让 Claude Code / Cursor **独立完成新站点接入的全部 8 个阶段**，无需人工抓包、无需人工解码、无需人工写 generator。

### 11.1 双 Skill 协作架构

```
┌────────────────────────────────────────────────────────────────────┐
│                     AI 端到端 0→1 闭环                              │
└────────────────────────────────────────────────────────────────────┘

   Stage 0-3  [10 分钟]                Stage 4-8  [4-8 小时]
   ┌──────────────────┐                ┌──────────────────────┐
   │   skill/cdp/     │   ───────→     │   skill/AI_re/       │
   │  ──────────────  │                │  ──────────────────  │
   │  启 真 Chrome    │                │  解码 payload + OB   │
   │  抓 6+ 批样本    │                │  字段三分类           │
   │  下载 SDK 文件   │                │  state.* 值匹配      │
   │  固定 SDK 版本   │                │  写 generator         │
   │  无 webdriver    │                │  10/10 验证           │
   │  不触发反爬      │                │  端到端业务 API       │
   └──────────────────┘                └──────────────────────┘
            ↑                                     ↓
            └─────────  共享 stample/<site>/  ───┘
```

**协作关系明确写在 [`skill/AI_re/SKILL.md`](skill/AI_re/SKILL.md) 第 77-85 行**：

```
skill/cdp/    ← Stage 0-3: 起 Chrome + 抓包 + 下 SDK + 固定版本 + 重复 6 批
skill/AI_re/  ← Stage 4-8: 定位常量/函数 + 解码 + 字段分析 + 写 generator + 10/10
```

完整 8 阶段串联工作流见 [`skill/AI_re/playbooks/master-workflow.md`](skill/AI_re/playbooks/master-workflow.md)。

### 11.2 [`skill/cdp/`](skill/cdp/) — 真 Chrome CDP 抓包 Skill

通过 Chrome DevTools Protocol 控制真实 Chrome 浏览器，**无 webdriver 特征 · 不触发反爬**。AI 用它自动完成：

- **抓 6+ 批 PX collector POST 样本**（Stage 0-3 全自动）
- **下载并固定 SDK 版本**（自动 sha256 验证，确保 6 批同 SDK）
- 分析 XHR / Fetch / WebSocket 流量、注入 JS、截图、操作 DOM
- 备选 native 模式（`agent-browser --native`，纯 Rust，更快启动）

**关键脚本**：[`skill/cdp/scripts/capture_via_cdp_ifood.py`](skill/cdp/scripts/) + `capture_via_cdp_grubhub.py` —— 双站专用抓包器，已经 wire 在 `skill/AI_re/skills/px_capture/` 入口里。

### 11.3 [`skill/AI_re/`](skill/AI_re/) — PX 逆向核心 Skill

把 PX SDK collector POST 链路（无感模式）完全用纯算复现的端到端 Skill。资产清单：

| 类别 | 数量 | 内容 |
|---|---|---|
| **用户意图 manifests** ([`skills/`](skill/AI_re/skills/)) | **4** | `px_capture` (调 cdp 抓样本) · `px_decode` · `px_port_to_new_platform` · `px_sdk_drift_audit` |
| **Playbook 操作手册** ([`playbooks/`](skill/AI_re/playbooks/)) | **9** | master-workflow ⭐⭐⭐ / identify-sdk-version / extract-constants / locate-all-constants / locate-functions / locate-field-sources / reverse-algorithms / build-generator / validate-generator |
| **Reference 知识层** ([`references/`](skill/AI_re/references/)) | **5** | algorithm-chain (5 大算法公式) / locate-by-pattern ⭐ (跨版本 grep 手册) / handler-table (27 OB handlers) / field-categories (STATIC/DYNAMIC/CONDITIONAL) / gotchas ⭐ (19 条踩坑) |
| **算法模块** (`reverse/`) | **9** | payload / pc / ob / sid / uuid / hash / memory / antitamper / ns — 可直接 `require()` |
| **CLI 工具** (`scripts/`) | **14** | 解码 (3) · 跨批分析 (4) · state 值匹配 (1) · 字段定位 (2) · 字节级 diff (2) · 版本迁移 (1) · 端到端验证 (1) |

### 11.4 AI 端到端 0→1 全流程

一行召唤，AI 独立跑完 8 阶段：

```
@skill/AI_re/SKILL.md
帮我把 doordash.com 接进来，参考 grubhub/ 镜像结构
```

AI 接下来会自动执行：

| 阶段 | AI 操作 | 调用 |
|---|---|---|
| **Stage 0** | 识别 SDK URL + AppID | `skill/cdp/` 网络嗅探 |
| **Stage 1** | 启动 真 Chrome + 抓 6+ 批样本 | `cdp/scripts/capture_via_cdp_*.py` |
| **Stage 2** | 解码 6 批 payload + OB 响应 | `decode_payload.js` + `decode_response.js` |
| **Stage 3** | 字段三分类 | `diff_samples.js` |
| **Stage 4** | state.* → EV2 b64 key 值匹配 | `find_state_keys_in_ev2.py` ⭐⭐⭐ |
| **Stage 5** | 从 SDK 源码定位 5 个站点常量 | `playbooks/locate-all-constants.md` |
| **Stage 6** | 构建 STATIC 模板 + 写 generator | `build_templates.js` + `playbooks/build-generator.md` |
| **Stage 7** | 字节级 diff 验证 | `diff_http_request.py` + `compare_ev2_field_by_field.py` |
| **Stage 8** | 10/10 稳定性测试 + 端到端业务 API | `verify_batch.js` |

**预估总时长**：新站点 8–12 小时全自动（其中抓包 10 min + AI 推理 + diff 迭代）。**90% 算法复用旧站，5 个站点常量在 SDK 中由 AI 自动定位**。

### 11.5 已固化的 4 个 AI 意图入口

每个意图入口都是独立的 SKILL manifest，含完整 procedure + quality gates + output spec：

```bash
# 抓 6+ 批新样本（含 SDK 哈希一致性验证）
@skill/AI_re/skills/px_capture
请抓 ifood.com.br 6 批样本，存入 stample/ifood/sample/

# 解码一批 batch（解 payload + OB，输出 decoded_*.json）
@skill/AI_re/skills/px_decode
帮我解码 stample/grub/sample/3/

# 跨站点移植 generator（90% 算法复用，5 个常量自动定位）
@skill/AI_re/skills/px_port_to_new_platform
帮我把 doordash.com 接进来，参考 grubhub/ 镜像结构

# SDK 升级响应（自动 diff 老 SDK + 提迁移路径）
@skill/AI_re/skills/px_sdk_drift_audit
iFood 又升级了，帮我跑 sdk_drift_audit
```

### 11.6 局限（公平描述）

虽然 AI 可独立跑完 Collector 路径 0→1，但 **Bundle 路径** 仍有两点需要项目预置素材：

| 项 | 局限 | 项目已预置 |
|---|---|---|
| WASM 模块静态分析 | 二进制反汇编仍是人工 | [`bundle/source/WASM_ANALYSIS.md`](bundle/source/WASM_ANALYSIS.md) 已剖析 |
| 鼠标轨迹生成 | 需要从真实样本采样 | [`bundle/stample/mouse_tracks/`](bundle/stample/) 50 条真实人类轨迹 |

也就是说 **AI 不需要从 0 做这两件事**，直接复用项目素材即可完成 Bundle 路径。

---

## 12. By Role · Reading Guide

| 你是…… | 推荐入口 |
|---|---|
| **第一次访问** | 当前 README + [`main/ZH/PX_SDK_逆向技术文档.md`](main/ZH/PX_SDK_逆向技术文档.md) §1-2（60 秒架构速览） |
| **工程师**（要 _px3） | 直接跑 [`stample/ifood/px_cookie/ifood_px3.js`](stample/ifood/px_cookie/) → 5 分钟 |
| **学习者**（教反爬逆向） | ⭐ [`main/ZH/methodology/`](main/ZH/methodology/) 10 章分文件（14 工具 + 算法伪代码 + 10 避坑） |
| **逆向工程师**（做新站点） | ⭐ [`methodology/04_stage4_locate.md`](main/ZH/methodology/04_stage4_locate.md)（grep 工具书）+ [`05_stage5_value_match.md`](main/ZH/methodology/05_stage5_value_match.md) + [`skill/AI_re/playbooks/master-workflow.md`](skill/AI_re/playbooks/master-workflow.md) |
| **要做 Bundle**（按压挑战） | [`bundle/README.md`](bundle/README.md) → [`main/ZH/PX_Bundle_逆向方法论.md`](main/ZH/PX_Bundle_逆向方法论.md) |
| **拿不到 _px3 debug 中** | [`bug_report/README.md`](bug_report/README.md) → 4 分类匹配 → [`gotchas/`](bug_report/gotchas/) 19 条速查 |
| **SDK 升级了急救** | ⭐ [`methodology/09_sdk_upgrade.md`](main/ZH/methodology/09_sdk_upgrade.md)（~2h 恢复 playbook） |
| **跨平台移植** | [`main/ZH/PX_完整SDK对照逆向方法论.md`](main/ZH/PX_完整SDK对照逆向方法论.md) + [`methodology/08_cross_platform.md`](main/ZH/methodology/08_cross_platform.md) |
| **纯算失效，要后手** | ⭐ [`node_bridge/README.md`](node_bridge/README.md) → 补环境 + jsdom 二级方案 |
| **AI agent 主导逆向** | [`skill/AI_re/SKILL.md`](skill/AI_re/SKILL.md)（喂给 Claude Code / Cursor） |
| **学术研究 / 教学** | [`main/ZH/`](main/ZH/) 4 份核心文档（7240+ 行）+ [`research/`](research/) 6 份英文研究档案 |
| **贡献者**（添加新站点） | 参考 [`stample/grub/`](stample/grub/) 镜像结构，按 7 阶段方法论跑通 |

---

## 13. Maintenance Cost & Limitations

### 13.1 Maintenance Cost

| 项 | 周期 | 工作量 |
|---|---|---|
| Collector 小升级（函数名/行号换） | 每月 1-2 次 | 30 min（按 [09_sdk_upgrade.md](main/ZH/methodology/09_sdk_upgrade.md) playbook） |
| Collector 中升级（b64 字典 + TAG/FT 换） | 每 2-3 月 | 1-2 h（参考 [2026-05-19 case](bug_report/sdk_drift_cases/2026-05-19_ifood/)） |
| Collector 大升级（新加密层） | 罕见，每 6-12 月 | 切换 Plan B 即刻应对，纯算侧 4-8 h 重写 |
| Bundle 升级（WASM/挑战类型变） | 每 2-3 周 | 1-3 h |
| 新站点接入 | — | 8-12 h（90% 算法复用） |

### 13.2 Limitations

- **本项目仅覆盖 iFood + Grubhub 双站**。其他 PX 站点（DoorDash / Zillow / Crunchyroll 等）需按方法论自行接入；
- **Bundle 油猴脚本依赖 Tampermonkey + 真实浏览器**，非纯算 —— Bundle 路径无法完全 headless（WASM 模块依赖完整 V8 + DOM）；
- **PX SDK 大版本重构罕见但发生**：本项目的 Plan B node_bridge 是容灾保险，但**每次重构后仍需 4-8 h 算法侧重写才能回到纯算性能档**。

### 13.3 Future Work

- 接更多 PX 站点（DoorDash / Zillow 接入计划中）
- WebAssembly 静态分析自动化（当前 WASM 模块逆向是人工）
- 鼠标轨迹生成的 ML 模型（当前是从 50 真实样本统计采样）
- 中文 → 英文完整双语化（顶层 README + 4 大踩坑 + Bundle + node_bridge + 方法论 10 章 + EV1/EV2 参考 + stample 全镜像已完成；其余长文持续推进）

---

## 14. Related Work

### 14.1 Public PerimeterX Research

公开领域关于 PX 的深入分析极少。本项目对照如下：

| 来源 | 覆盖 | 局限 |
|---|---|---|
| 部分博客片段（GitHub gist / 知乎 / Medium） | 单算法或单 bug | 缺端到端、缺方法论、缺纵向追踪 |
| Akamai / DataDome / Cloudflare 公开研究 | 横向对比 | 不深入 PX 内部 |
| **本项目** | **9 算法 + 双站 + Bundle + 68 踩坑 + 3 年纵向 + AI Skill + Plan B** | — |

### 14.2 Cross-vendor Comparison

详见 [`research/04_cross_vendor_comparison/`](research/04_cross_vendor_comparison/)。

### 14.3 行业相关项目

- **undetected-chromedriver / playwright-stealth** —— 浏览器侧反检测，跟本项目纯算逆向正交
- **curl_cffi / hrequests** —— TLS 指纹模拟，与本项目协议层互补

---

## 15. Bilingual Status & Roadmap

| 资源 | 中文 | 英文 |
|---|---|---|
| 顶层 README | ✅ 本文件（[`README.zh.md`](README.zh.md)） | ✅ [`README.md`](README.md)（GitHub 首页） |
| 核心技术文档（4 份） | ✅ | ✅ [`main/EN/`](main/EN/) 4 份完整 |
| ⭐ 方法论 10 章 | ✅ 3389 行 | ✅ [`main/EN/methodology/`](main/EN/methodology/) |
| ⭐ EV1_EV2_UNIFIED_REFERENCE | ✅ 227 行 | ✅ [`main/EN/EV1_EV2_UNIFIED_REFERENCE.md`](main/EN/EV1_EV2_UNIFIED_REFERENCE.md) |
| ⭐ research/（6 份） | — | ✅ 英文原版 |
| ⭐ AI Skill manifests (4 份) | — | ✅ 英文原版 |
| ⭐ Gotchas 细颗粒度 (19 条) | — | ✅ 英文原版 |
| Plan B node_bridge/ | ✅ | ✅ [`node_bridge/README_EN.md`](node_bridge/README_EN.md) + skill |
| Bundle 方法论 | ✅ 973 行 | ✅ [`main/EN/PX_Bundle_Reverse_Methodology.md`](main/EN/PX_Bundle_Reverse_Methodology.md) |
| Bundle 主文档 | ✅ 4996 行 | ✅ [`bundle/doc/Bundle_Complete_Technical_Doc.md`](bundle/doc/Bundle_Complete_Technical_Doc.md) |
| 踩坑 4 主文件 | ✅ | ✅ [`bug_report/*_EN.md`](bug_report/) |
| stample/ 双站镜像（README / SDK_INFO / px_cookie / script） | ✅ | ✅ 全镜像 EN 已落地 |

**双语化进度**：顶层 README + 核心技术 + 方法论 + Bundle + Plan B + 踩坑 + stample 镜像均已英文落地；剩余少量长文持续推进中。

---

## 16. License, Ethics & Responsible Disclosure

### 16.1 License — 双轨制（防滥用强化版）

完整 License 文本见 [`LICENSE`](LICENSE)（仓库根目录）。本项目采用 **双轨 License**，对代码和文档分别施加防滥用约束：

| 资产类型 | 适用范围 | License | 关键约束 |
|---|---|---|---|
| **代码** | [`revers/`](revers/) · [`stample/*/px_cookie/`](stample/) · [`bundle/script/`](bundle/script/) · [`node_bridge/`](node_bridge/) · [`skill/*/scripts/`](skill/) | **AGPL-3.0** | 任何商业服务 / SaaS 使用必须**完整开源回馈** |
| **文档** | [`main/`](main/) · [`bug_report/`](bug_report/) · [`research/`](research/) · 所有 `README.md` / `SKILL.md` | **CC BY-NC-SA 4.0** | **禁止商业使用** + 署名 + 衍生品同等开源 |

**为什么双轨**：CC 官方不建议代码用 CC，AGPL 不擅长保护文档。组合使用形成两层防滥用屏障 —— 商业公司既不能商用文档，又不能闭源利用代码。这是学术界 + 安全研究界（如 Trail of Bits / NCC Group / Project Zero 配套项目）的标准实践。

### 16.2 Research Ethics 研究伦理

本项目**严格遵循以下原则**：

- **仅作研究 / 教育 / 个人安全审计目的** —— 算法分析、协议剖析、跨平台对比、教学传授
- **不提供大规模爬取的运维工具** —— 不含代理池、调度器、IP rotation、UA 池、CAPTCHA OCR、第三方打码集成
- **不针对个人用户隐私数据** —— 项目所有抓包样本均通过研究者自有账号合法采集
- **遵守目标站点 ToS** —— 各站点服务条款由使用者自行判断与承担，与本项目作者无关

### 16.3 ⚠️ Disclaimer 免责声明（重要）

> 使用本项目即表示您**完全理解并同意**以下声明：

1. **使用者自负全部责任** —— 本项目作者 (`warterbili`) 仅作为学术研究与教育内容发布，**不对使用本项目导致的任何直接或间接损害承担任何责任**，包括但不限于：账号封禁、IP 黑名单、法律诉讼、合规审查、平台投诉、商业损失、隐私事件。
2. **不得用于以下用途** —— 严禁将本项目用于：
   - 未授权的数据爬取 / 内容抓取
   - 信用卡 / 优惠券 / 礼品卡滥用 (carding, coupon fraud)
   - 自动化下单 / 库存抢购 / 黄牛刷单
   - 用户隐私数据窃取 / 凭据撞库
   - 拒绝服务攻击 (DoS / DDoS)
   - 针对目标站点的恶意干扰
   - 任何违反目标站点服务条款或当地法律的行为
3. **法律合规由使用者承担** —— 不同司法管辖区对反向工程、自动化访问、数据采集的法律规定不同（如美国 CFAA / 欧盟 GDPR / 中国《网络安全法》《数据安全法》《个人信息保护法》等）。使用者**有义务自行查询并遵守**所在地区相关法律。
4. **作者无义务提供支持** —— 本项目作为研究成果免费发布，作者**没有任何义务**为使用者提供技术支持、bug 修复、SDK 升级响应或法律咨询。
5. **重新分发限制** —— 二次分发须保留本免责声明完整文本，不得删除或修改。
6. **特别声明：本项目不针对任何具体商家** —— iFood / Grubhub 仅作为协议层逆向研究的**技术对象**，本项目不鼓励、不指导任何针对这些平台的恶意行为。

### 16.4 Responsible Disclosure 责任披露

PerimeterX / HUMAN Security 的所有发现均通过**协议层和算法层的逆向工程**得到：

- **不依赖**任何内部源码、私有 API、未授权访问；
- **不利用**任何后端漏洞、SQL 注入、SSRF、RCE 等攻击向量；
- **不规避**任何 TLS、证书、签名机制（仅在合法 TLS 通道内进行协议分析）；
- **不窃取**任何第三方密钥、凭据、个人数据。

本项目的发布严格符合**反向工程合理使用 (Reverse Engineering Fair Use)** 原则及多国"安全研究例外条款"（如美国 DMCA §1201(j) 安全测试例外）。

### 16.5 联系方式

如 PerimeterX / HUMAN Security 团队对本项目有合规疑问，或希望开展**协作式漏洞披露**（coordinated disclosure），欢迎通过 GitHub Issues 联系 `warterbili`，**作者保留在收到正式合规请求后 90 天内调整披露范围的权利**。

---

## 17. Citation

如本项目用于学术研究、技术报告或商业咨询，烦请引用：

```bibtex
@misc{perimeter_v2_2026,
  author       = {warterbili},
  title        = {{PerimeterX (HUMAN Security) SDK Complete Reverse Engineering}},
  year         = {2026},
  version      = {2.0},
  howpublished = {GitHub Repository},
  url          = {https://github.com/warterbili/PerimeterX_RE},
  note         = {iFood + Grubhub 10/10 verified · 68 production gotchas ·
                  3-year longitudinal SDK drift study · 2024--2026}
}
```

简引：`warterbili, "PerimeterX SDK Complete Reverse Engineering", v2.0, 2026.`

---

## 18. Acknowledgments

本项目是 **2024–2026 三个迭代** 沉淀的产物：

```
2024  perimeter_X     ──→  最初的 PX 探索（PoC 阶段）
2025  perimeterX_Re   ──→  方法论成型（fork 期）
2026  perimeter v2.0  ──→  论文级完整公开（本项目）
```

每次重构都基于 **"前一版哪里搞砸了"** 的复盘。如果你跑通 [`stample/ifood/px_cookie/ifood_px3.js`](stample/ifood/px_cookie/ifood_px3.js) 拿到 `_px3`，或装 [`bundle/script/userscripts/px_bundle3_auto.user.js`](bundle/script/userscripts/px_bundle3_auto.user.js) 过了按压挑战 —— 那一刻你就**穿过了 PX 设的全部外围防线**。

致敬所有为反爬研究公开过任何片段的同行 —— 你们的 gist、知乎、Medium、博客零碎拼图，让本项目得以站在巨人肩上。

**逆向愉快**。

---

<div align="center">

**v2.0** · 校验时间 2026-05-23 · iFood + Grubhub 双站 10/10 · Bundle 路径完整保留 · AI Skill 内置

**[⬆ 返回顶部](#perimeterx-human-security-sdk--完整逆向工程--v20)**

</div>
