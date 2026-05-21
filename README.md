<div align="center">

# 🛡️ PerimeterX SDK 完整逆向工程

### **无感 Collector + 按压 Bundle · 纯算法生成 `_px3` / `_px2`**
### **iFood 10/10 · Grubhub 10/10 · iFood Bundle 10/10 — 实战验证**

![iFood](https://img.shields.io/badge/iFood-10%2F10%20✓-success)
![Grubhub](https://img.shields.io/badge/Grubhub-10%2F10%20✓-success)
![Bundle](https://img.shields.io/badge/iFood%20Bundle-10%2F10%20✓-success)
![Algorithms](https://img.shields.io/badge/算法-9%20个核心-green)
![Docs](https://img.shields.io/badge/文档-20000%2B%20行-orange)
![Gotchas](https://img.shields.io/badge/踩坑-68%20条-red)
![Mouse Tracks](https://img.shields.io/badge/真实鼠标轨迹-50%20条-purple)

**[5 分钟拿到 `_px3`](#-5-分钟-quick-start) · [⭐ Live 实战](stample/live_validation/) · [Node Bridge Plan B](node_bridge/) · [iFood 业务用途](stample/ifood/RESEARCH_PURPOSE.md) · [Grubhub 业务用途](stample/grub/RESEARCH_PURPOSE.md) · [方法论 10 章](main/ZH/methodology/) · [踩坑](bug_report/) · [Bundle 路径](bundle/) · [AI Skill](skill/AI_re/)**

</div>

---

## 📖 这是什么

**完整、可运行、中英双轨的 PerimeterX (HUMAN Security) SDK 逆向工程项目**。
不只是写一份分析，而是**带方法论的完整工具包**：

- ✅ **9 个算法纯算实现** ([`revers/`](revers/)) — payload XOR/b64/交织 / PC HMAC-MD5 / OB 解码 / SID Unicode 隐写 / UUID v1 / Anti-tamper / Memory / Hash / `/ns` probe
- ✅ **2 个站点端到端 generator** — iFood `_px3` + Grubhub `_px2`，**10/10 实测通过**
- ✅ **Bundle 按压挑战完整逆向** ([`bundle/`](bundle/)) — WASM + PoW + 贝塞尔轨迹 + 缅甸文 DOM + 4 组错误栈 + 2131 行实战油猴脚本
- ✅ **20000+ 行结构化中文文档** — SDK 技术 / 算法 / 方法论 / 跨平台 / 踩坑 / Bundle 完整 / AI skill
- ✅ **68 条真实踩坑** ([`bug_report/`](bug_report/)) — 项目最独家资产，每条都付出过真实 debug 时间
- ✅ **AI agent skill** ([`skill/AI_re/`](skill/AI_re/)) — 让 Claude / Cursor 帮你做 PX 逆向

> 🎯 **为什么有这个项目**：网上 PX 资料要么太浅（"用 puppeteer 吧"），要么太碎（一个 bug fix 片段）。**本项目是完整地图** —— 每个算法、每个字段、每个踩坑、每条方法论，从 iFood + Grubhub 真实生产实战提炼。
>
> 🎯 **项目独家价值**：68 条踩坑 + 50 条真实鼠标轨迹 + 6 批跨站抓包 —— 这些**采集成本远高于写代码成本**。

---

## 🚀 5 分钟 Quick Start

```bash
# 1. clone 项目
git clone <项目地址> perimeter
cd perimeter

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
node grubhub_px2.js         # 实战拿 _px2

# 4. Bundle 路径（按压挑战）— 装油猴脚本
# 浏览器装 Tampermonkey → 加载 bundle/script/userscripts/px_bundle3_auto.user.js
# 访问 https://www.ifood.com.br/ → 触发挑战 → 自动拿 _px3
```

500 ms 内完成 PX 完整握手：2 个 collector POST，10 个加密算法，1 个 cookie。

---

## ✅ 实战验证

### 算法层 + 协议层验证（2026-05-20）

| 站点 | 验证项 | 测试结果 |
|---|---|---|
| **ifood.com.br** | AppID `PXO1GDTa7Q` · TAG `U0MmDhUmOnhXSw==` · FT `401` · cookie `_px3` (ttl 330) | **10/10 通过** |
| **grubhub.com** | AppID `PXO97ybH4J` · TAG `FmYgK1gdJEAP` · FT `359` · cookie `_px2` (ttl 500) | **10/10 通过** |
| **iFood Bundle 按压** | Bundle AppID `PXd6f03jmq8h6c7382req0` · FT `388` · 6 事件 + WASM + PoW | **10/10 通过** |

所有常量**直接从真实抓包 POST body 提取**（[`stample/{ifood,grub}/sample/`](stample/) 6 批可审计），不是文档记忆。

### ⭐ 端到端真实业务 API 验证（2026-05-21）

不只是字节正确，**真打代理 + 真调业务 API + 真返回 200**。详细 journal：[`stample/live_validation/journal/2026-05-21.md`](stample/live_validation/journal/2026-05-21.md)

| 站点 | 代理 | 业务 API | 真实响应 |
|---|---|---|---|
| **iFood** | BR 巴西住宅 (Bright Data) | `POST cw-marketplace.ifood.com.br/v1/merchant-info/graphql?lat&lng&channel=IFOOD` | ✅ HTTP 200 → `{ name: "Sorveteria Coelhinho - Shopping Vitória", userRating: 5, available: false }` |
| **Grubhub** | 本机直连 (US 代理可选) | `POST /auth (anonymous)` + `POST /auth/login (Bearer+real account)` | ✅ HTTP 200 anon_token + HTTP 463 verify_methods (PX **2 个端点都通过**，463 = 业务层要 OTP，桌面 (3) 项目 5/5 同判定) |

**复跑命令**（两站独立，凭据通过 env var 传不嵌入）：

```bash
cd <project-root> && npm install

# iFood (需 BR 住宅代理)
export HTTPS_PROXY='http://<user>:<pwd>@<host>:<port>'
node stample/ifood/px_cookie/business_api_demo.js

# Grubhub (代理可选；想跑 full chain 加账号 env var)
export GRUBHUB_EMAIL='your@email.com'
export GRUBHUB_PASSWORD='yourpassword'
node stample/grub/px_cookie/business_api_demo.js
```

### 本次实战发现的 4 个新踩坑（已入档）

1. **Cloudflare ≠ PX 拦截**：HTML "no-js" vs "px-captcha" 是两层完全不同的防御
2. **iFood GraphQL 必须带 `?latitude=&longitude=&channel=IFOOD`**：否则 400 "Merchant not found"（不是 PX 错）
3. **iFood 端点 PX 评分门槛分级**：`/v1/merchant-info/graphql` ✓ vs `/v2/cardstack/search/home` ✗（feed 需要 Bundle 级评分）
4. **Grubhub README vs config.yaml 的 client_id 不一致**：README 那个是过期的，以 config.yaml 为准

附加发现：iFood 服务侧叠了 **Akamai Bot Manager**（响应 `set-cookie: ak_bmsc=...`），但合法 PX cookie + BR IP 同时通过 Akamai + PX 双层防御。

---

## 🧭 按角色入口

不同人需要不同路径：

| 你是…… | 从这里开始 |
|---|---|
| **第一次访问**（"这是什么？"） | 当前 README 看完，然后看 [`main/ZH/PX_SDK_逆向技术文档.md`](main/ZH/PX_SDK_逆向技术文档.md) §1-2 |
| **工程师**（"我想拿 _px3"） | 直接跑 [`stample/ifood/px_cookie/ifood_px3.js`](stample/ifood/px_cookie/) → 5 分钟 |
| **学习者**（"教我反爬逆向"） | ⭐ [`main/ZH/methodology/`](main/ZH/methodology/) 10 章分文件版（A+B+C 合并，含 grep 工具书 + 14 工具 + 算法伪代码 + 10 避坑） |
| **逆向工程师**（"我要做新站点"） | ⭐ [`main/ZH/methodology/04_stage4_locate.md`](main/ZH/methodology/04_stage4_locate.md)（grep 工具书）+ [`main/ZH/methodology/05_stage5_value_match.md`](main/ZH/methodology/05_stage5_value_match.md)（value-match） + [`skill/AI_re/playbooks/master-workflow.md`](skill/AI_re/playbooks/master-workflow.md) |
| **要做 Bundle**（"想攻按压挑战"） | [`bundle/README.md`](bundle/README.md) → [`main/ZH/PX_Bundle_逆向方法论.md`](main/ZH/PX_Bundle_逆向方法论.md) |
| **拿不到 _px3 debug 中**（"为什么 403"） | [`bug_report/README.md`](bug_report/README.md) → 看 4 个分类哪个匹配，或 [`methodology/07_stage7_validate.md`](main/ZH/methodology/07_stage7_validate.md) §故障树 |
| **SDK 升级了急救**（"突然全 403"） | ⭐ [`main/ZH/methodology/09_sdk_upgrade.md`](main/ZH/methodology/09_sdk_upgrade.md)（应急 playbook，~2h 恢复） |
| **跨平台移植**（"要支持新站点"） | [`main/ZH/PX_完整SDK对照逆向方法论.md`](main/ZH/PX_完整SDK对照逆向方法论.md)（iFood vs Grubhub 对照）+ [`methodology/08_cross_platform.md`](main/ZH/methodology/08_cross_platform.md) |
| **要看老版方法论**（单文件） | [`main/ZH/PX_逆向方法论_通用版.md`](main/ZH/PX_逆向方法论_通用版.md)（1233 行原版） |
| **学术研究 / 教学** | [`main/ZH/`](main/ZH/) 4 份核心文档（共 7240+ 行） |
| **AI agent 主导逆向** | [`skill/AI_re/SKILL.md`](skill/AI_re/SKILL.md)（喂给 Claude Code / Cursor） |
| **贡献者**（"添加新站点"） | [`stample/grub/`](stample/grub/) 看 Grubhub 怎么做的（仿照 iFood） |

---

## 🧠 PX 怎么工作（60 秒速览）

PX 有**双链路**反爬：

```
                  浏览器加载页面
                       │
                       ▼
            ┌──────────────────┐
            │  main.min.js 注入 │
            └────────┬─────────┘
                     │
            ┌────────┴──────────────────────┐
            ▼                                ▼
   ┌────────────────┐                ┌──────────────────────┐
   │  无感 Collector │                │  按压 Bundle          │
   │                │                │                      │
   │  99% 流量       │                │  风险评分触发         │
   │  2 POST         │                │  4 POST              │
   │  ~300 ms        │                │  WASM + PoW + 按压   │
   │  无 UI          │                │  10-15 秒            │
   └────────┬───────┘                └──────────┬───────────┘
            │                                    │
            └─────────────┬──────────────────────┘
                          ▼
              ┌──────────────────┐
              │ _px3 / _px2 下发  │
              │ 业务 API 可访问   │
              └──────────────────┘
```

**两路共享** 9 个算法（XOR / b64 / 交织 / HMAC-MD5 / OB 解码 / SID 隐写 / UUID v1 / Anti-tamper / Memory）。
**Bundle 多 5 个独家** （PoW / WASM / 贝塞尔轨迹 / 缅甸文编码 / 错误栈）。

详细架构图见 [`main/ZH/PX_SDK_逆向技术文档.md`](main/ZH/PX_SDK_逆向技术文档.md) §2。

---

## 📁 项目结构

```
perimeter/
│
├── README.md                              ← 本文件
│
├── main/                                  ⭐ 核心技术文档（双语）
│   ├── ZH/                                中文（共 10800+ 行）
│   │   ├── methodology/                   ⭐ 新版 10 章分文件方法论（A+B+C 合并，3389 行）
│   │   │   ├── README.md                   总入口 + 学习路径
│   │   │   ├── 00_overview.md              7 阶段地图 + 时间预算
│   │   │   ├── 01..09_stage*.md            7 阶段详解 + 跨平台 + SDK 升级
│   │   │   └── appendix/                   14 工具 / 算法伪代码 / 10 避坑
│   │   ├── EV1_EV2_UNIFIED_REFERENCE.md   ⭐ 204+ 字段三分类 + iFood/Grubhub 跨平台对照
│   │   ├── PX_SDK_逆向技术文档.md           2597 行 — PX 完整技术
│   │   ├── PX_逆向方法论_通用版.md          1233 行 — 老版单文件方法论（参考）
│   │   ├── PX_完整SDK对照逆向方法论.md      1441 行 — iFood vs Grubhub 对照
│   │   └── PX_Bundle_逆向方法论.md           973 行 — Bundle 8 阶段方法论
│   └── EN/                                英文版（同上 3 份核心，新方法论 + Bundle 待补）
│
├── research/                              ⭐ 6 份结构化研究档案
│   ├── 01_field_entropy/                  字段动态性熵分析
│   ├── 02_sdk_drift_longitudinal/         SDK 升级时间线
│   ├── 03_threat_model/                   正式敌手模型
│   ├── 04_cross_vendor_comparison/        PX vs DataDome vs Akamai vs Cloudflare
│   ├── 05_field_isolation_experiments/    字段隔离实验数据
│   └── 06_failure_modes/                  故障模式分类
│
├── revers/                                ⭐ 9 个算法纯算实现（Node.js）
│   ├── payload.js                         EV → POST `payload=`（XOR+b64+交织）
│   ├── pc.js                              HMAC-MD5 + 数字提取 → 16 位 PC
│   ├── ob.js                              OB 解码 + handler 派发（27 个）
│   ├── sid.js                             SID + Unicode Tag 隐写
│   ├── uuid.js                            UUID v1 (PX 兼容 clockseq)
│   ├── hash.js                            djb2 变体
│   ├── memory.js                          performance.memory 合成
│   ├── antitamper.js                      动态 XOR key/value 注入
│   └── ns.js                              /ns 端点同步
│
├── skill/                                 ⭐ AI agent 用的 skill 包
│   ├── AI_re/                             PX 逆向 skill（playbook + scripts + references）
│   │   ├── skills/                        ⭐ 4 份 AI 调用入口 manifests（用户意图）
│   │   │   ├── px_capture/                 抓 N 批新样本
│   │   │   ├── px_decode/                  解码一批 batch
│   │   │   ├── px_port_to_new_platform/    跨站点移植 generator
│   │   │   └── px_sdk_drift_audit/         SDK 升级响应
│   │   ├── playbooks/                     9 份操作手册（"怎么做"）
│   │   ├── references/                    5 份知识层（"是什么"）
│   │   └── scripts/                       14 个 CLI 工具
│   └── cdp/                               真 Chrome CDP 抓包 skill
│
├── stample/                               ⭐ 站点实现层（双站镜像结构）
│   ├── ifood/
│   │   ├── px_cookie/                     ifood_px3.js + 模板 + smoke_test 21/21 ✓
│   │   ├── source/                        main.min.js (锁定 SHA b47a639c…)
│   │   ├── sample/                        6 批真实抓包 × 11 文件
│   │   └── script/                        8 个 iFood 专用脚本
│   └── grub/
│       ├── px_cookie/                     grubhub_px2.js + 模板 + smoke_test 17/17 ✓
│       ├── source/                        init.js (锁定 SHA 5e81bffc…)
│       ├── sample/                        6 批真实抓包 × 9 文件
│       └── script/                        8 个 Grubhub 专用脚本
│
├── bundle/                                ⭐ Bundle 按压路径（完整保留，归档）
│   ├── README.md                          引导观众的学习路径（4 级深度）
│   ├── doc/Bundle_完整技术文档.md          4996 行 — Bundle 完整解构
│   ├── source/                            captcha.js + WASM + SDK_INFO
│   ├── stample/                           样本（4 raw POST + 50 鼠标轨迹 + EV 模板）
│   └── script/userscripts/                ⭐ 2131 行实战油猴脚本（10/10）
│
└── bug_report/                            ⭐ 68 条真实踩坑（项目最独家资产）
    ├── 1_collector_path.md                Collector 路径 33 条
    ├── 2_bundle_path.md                   Bundle 路径 20 条
    ├── 3_environment.md                   环境/基础设施 8 条
    ├── 4_sdk_drift.md                     SDK 版本漂移 7 条
    ├── gotchas/                           ⭐ 19 条命名细颗粒度版（每条独立文件 + 修复 + 测试）
    └── sdk_drift_cases/                   ⭐ 真实升级 diff 实战
        └── 2026-05-19_ifood/               iFood 中版本升级（202→225 b64 字典 + TAG/FT 换）
```

---

## 🔐 核心算法亮点

### 1. payload 加密链（4 步）

```
events → PX 自定义 serialize → XOR(50) → Base64(UTF-8) → 20 字符交织 → payload
```

90% 实现栽这里的 3 个坑：
- PX `serialize` ≠ `JSON.stringify`（NaN / undefined / Date 编码不同）
- base64 必须 **UTF-8**，绝对不能 Latin-1（踩坑 #2）
- 20 字符交织 key 嵌入位置由 `uuid + state.no` 算

完整算法 → [`main/ZH/PX_SDK_逆向技术文档.md`](main/ZH/PX_SDK_逆向技术文档.md) §3.1

### 2. PC = HMAC-MD5 + 数字提取（16 位输出）

```js
const n = hmacMD5(serialize(events), uuid + ':' + TAG + ':' + FT);
// 32 hex chars → 数字保留 + 字母 ASCII % 10 → 拼接 → 间隔取 → 16 位 PC
```

### 3. Anti-tamper — 动态 XOR key/value（最容易踩坑）

```js
const key = te(state.to, parseInt(state.no) % 10 + 2);   // ⭐ key NAME 是动态的！
const val = te(state.to, parseInt(state.no) % 10 + 1);
events.d[key] = val;
// ⚠️ 必须保留模板里的原位置！不能 delete + add 否则迭代顺序变
```

详见踩坑 #17 → [`bug_report/1_collector_path.md`](bug_report/1_collector_path.md)。

### 4. SID — Unicode Tag Char 隐写

```js
sid = state.pxsid + hh(state.no);
// hh(t) 把每位数字编码成 U+E0100+ → Plane-14 不可见 Tag Char
```

故意设计**反 "Copy as cURL" 重放** —— 终端粘贴会丢 Tag Char。

---

## ⚠️ 68 条真实踩坑（必读）

**项目最独家资产**。每条都付出过真实 debug 时间，**不是教科书踩坑**。

按路径分 4 个文件：

| 文件 | 内容 | 数量 |
|---|---|---|
| [`bug_report/1_collector_path.md`](bug_report/1_collector_path.md) | 无感 Collector 路径 | 33 条 |
| [`bug_report/2_bundle_path.md`](bug_report/2_bundle_path.md) | 按压 Bundle 路径 | 20 条 |
| [`bug_report/3_environment.md`](bug_report/3_environment.md) | 环境/基础设施（IP/TLS/UA/Python sid） | 8 条 |
| [`bug_report/4_sdk_drift.md`](bug_report/4_sdk_drift.md) | SDK 版本漂移 | 7 条 |

**Top 5 致命**（按"⭐⭐⭐ 真实付出过 ≥1 小时 debug"标）：

1. ⭐⭐⭐ **`state.no` 必须 `parseInt`** —— 字符串导致 PC 通过但 `_px3` 不下发，~90% 新手中招
2. ⭐⭐⭐ **anti-tamper 字段位置破坏** —— `delete + add` 让 key 跑到末尾，迭代顺序变
3. ⭐⭐⭐ **`state.* → EV2 b64 key` 每站点完全不同** —— iFood 跟 Grubhub 用不同的 key 注入
4. ⭐⭐⭐ **base64 的 `+` 不能转空格** —— Python `urllib.parse.unquote_plus` 会吃 `+`
5. ⭐⭐⭐ **WASM PoW 必须用同步 SHA-256** —— `crypto.subtle` 异步爆 600s+

**写代码前先读这 5 条**。剩下 63 条遇到再查。

---

## 🛠️ CLI 工具速查

```bash
# 1. 解一个抓包
node skill/AI_re/scripts/decode_payload.js stample/ifood/sample/1/request_1.txt
# → EV1/EV2 JSON

# 2. 解 OB 响应
node skill/AI_re/scripts/decode_response.js stample/ifood/sample/1/response_1.json U0MmDhUmOnhXSw==
# → state.no/qa/vid/pxsid/cts/appId/jf/...

# 3. 跨批字段三分类（STATIC/DYNAMIC/CONDITIONAL）
node skill/AI_re/scripts/diff_samples.js stample/ifood/sample/{1..6}/decoded_payload_2.json

# 4. state.* → EV2 b64 key 跨批值匹配（⭐ 关键脚本）
python skill/AI_re/scripts/find_state_keys_in_ev2.py

# 5. 我生成 vs 真抓 字段级 diff
python stample/ifood/script/compare_my_ev2.py /tmp/my_ev2.json

# 6. HTTP 请求字节级 diff
python stample/ifood/script/diff_http.py /tmp/my_post.txt

# 7. 验证 6 批解码闭环
./stample/ifood/script/verify_all.sh
# 期望: 6/6 通过 — 解码器对当前 SDK 工作
```

完整 14 个工具 → [`skill/AI_re/scripts/`](skill/AI_re/scripts/)。

---

## 🤖 AI Skill（让 AI 替你逆向）

```
@skill/AI_re/SKILL.md
帮我对 example.com 做 PerimeterX 逆向，AppID = PXxxxxxxxx
```

[`skill/AI_re/`](skill/AI_re/) 包含：
- 9 份 playbook（操作手册）
- 5 份 reference（算法 / handler 表 / 字段分类 / locate 手册 / 踩坑）
- 14 个 CLI 工具

AI 能干的：
- 教学、答疑、看你代码找 bug、跨语言移植算法、写新站点配置
- ⚠️ **不能干**：单独从 0 完整逆向新站点（需要人抓样本 + 浏览器实测 + WASM 提取）

详见 [`bundle/README.md`](bundle/README.md) 末尾"我对 AI 逆向 Bundle 成功率"分析。

---

## 📊 项目体量

| 维度 | 数字 |
|---|---|
| **总文件** | 约 380 个 |
| **总文档行数** | 20000+ 行（中文为主，部分英文） |
| **总代码行数** | 5000+ 行（Node.js + Python + Shell） |
| **核心文档** | 4 份中文 + 3 份英文 = 7 份 ≈ 14000 行 |
| **Bundle 主文档** | 4996 行 |
| **踩坑数** | 68 条 |
| **真鼠标轨迹** | 50 条（Bundle 专用） |
| **抓包样本** | iFood 6 批 + Grubhub 6 批 + Bundle 4 个 POST |
| **算法实现** | 9 个核心模块 |
| **油猴脚本** | 1 个（2131 行 实战 10/10） |
| **AI playbook** | 9 份 |
| **AI reference** | 5 份 |
| **CLI 工具** | 14 个 |
| **生成器** | iFood + Grubhub 双站，各 10/10 通过 |

---

## 🎯 实战经验总结

**3 年观察下来，PX 频繁旋转混淆，但从未改过算法**。把方法论建立在算法上（grep MD5/HMAC/UUID 标准常量），每次新 SDK 不会让你从头开始 —— 你只需要 30 分钟重新定位关键位置，剩下代码都能复用。

**关键认知**：
- **算法层 3 年不变** —— 标准 MD5 / HMAC / UUID / ChaCha20 等
- **表面层每次升级换** —— 函数名、行号、b64 key 字典、wire 字符集
- **跨平台 90% 共享** —— 同一套算法 + 5 个站点特有常量
- **Collector 覆盖 99% 业务** —— Bundle 是 1% fallback
- **维护成本** —— Collector 每月 1-2 次升级，Bundle 每 2-3 周一次

---

## 🌐 双语状态

| 资源 | 中文 | 英文 |
|---|---|---|
| 顶层 README | ✅ 本文件 | ⏳ 待补（计划中） |
| 核心技术文档 | ✅ 3 份完整 | ✅ 3 份完整 |
| ⭐ 方法论 10 章（新） | ✅ 3389 行 | ⏳ 待补 |
| ⭐ 字段统一对照 EV1_EV2_UNIFIED_REFERENCE | ✅ 227 行 | ⏳ 待补 |
| ⭐ 研究档案 research/ | ✅ 7 份 | ⏳ 部分 |
| ⭐ AI Skill manifests (4 个) | ✅ + 路径已适配 | ✅（英文原版） |
| ⭐ Gotchas 细颗粒度 19 条 | ✅ 19 文件 | ✅（英文原版） |
| Bundle 方法论 | ✅ 973 行 | ⏳ 待补 |
| 站点 README × 13 份 | ✅ 全有 | ⏳ 仅 2 份（sample/README_EN.md） |
| 踩坑（68 条） | ✅ 全有 | ⏳ 待补 |
| Bundle 主文档 (4996 行) | ✅ | ⏳ 待补 |

**双语化路线图**：当前阶段聚焦中文完整。完成后**一次性**补齐所有英文版（计划 2026-06）。

---

## 📜 许可

待定（计划 MIT 或 CC BY-NC 4.0）。当前作研究 / 教育 / 个人安全审计用途。

## 🤝 贡献

待补 `CONTRIBUTING.md`。如果你 review 过这个项目想加新站点：

1. 参考 [`stample/grub/`](stample/grub/) 镜像结构
2. 跑通 7 阶段（[`main/ZH/PX_逆向方法论_通用版.md`](main/ZH/PX_逆向方法论_通用版.md)）
3. 把成果加进 `stample/<新站>/`

---

## 致敬

这个项目从 2024 年到 2026 年的 3 个迭代沉淀（`perimeter_X` → `perimeterX_Re` → `perimeter`）。每次重构都基于"前一版哪里搞砸了"的复盘。

如果你跑通 [`stample/ifood/px_cookie/ifood_px3.js`](stample/ifood/px_cookie/ifood_px3.js) 拿到 `_px3`，或者装 [`bundle/script/userscripts/px_bundle3_auto.user.js`](bundle/script/userscripts/px_bundle3_auto.user.js) 过了按压挑战 —— 那一刻你就**穿过了 PX 设的全部外围防线**。这就是"perimeter"的来源。

**逆向愉快**。

---

*校验时间 2026-05-21 · 项目名 `perimeter` · 实战 iFood + Grubhub 双站 10/10 · Bundle 路径完整保留*
