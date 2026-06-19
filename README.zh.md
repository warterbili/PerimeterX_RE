<div align="center">

# PerimeterX / HUMAN Security — SDK 逆向工程

**纯算法复现 PerimeterX 的 `_px3` / `_px2` cookie 链路 —— 不开浏览器、不用自动化框架。**

[![version](https://img.shields.io/badge/version-2.0-blue?style=flat-square)](#)
[![iFood](https://img.shields.io/badge/iFood-10%2F10-success?style=flat-square)](stample/ifood/)
[![Grubhub](https://img.shields.io/badge/Grubhub-10%2F10-success?style=flat-square)](stample/grub/)
[![Total Wine](https://img.shields.io/badge/Total%20Wine-10%2F10%20严档-success?style=flat-square)](stample/totalwine/)
[![Academy](https://img.shields.io/badge/Academy-10%2F10%20严档%2B-success?style=flat-square)](stample/academy/)
[![Walmart](https://img.shields.io/badge/Walmart-10%2F10%20PX层-yellow?style=flat-square)](stample/walmart/)
[![License](https://img.shields.io/badge/license-AGPL--3.0%20%2B%20CC%20BY--NC--SA-orange?style=flat-square)](#license)

[English](README.md) · [快速开始](#快速开始) · [原理](#原理) · [文档](#文档) · [AI Skill](skill/AI_re/) · [License](#license)

</div>

> 给定目标 URL + AppID，本项目用纯算（Node.js）重建 PerimeterX 的 collector POST 链路，产出有效 `_pxN` cookie。
> 所有常量、字段位置、字段类型都来自**实测抓包**，不靠记忆或旧文档。仅供研究 / 教育用途。

> ⚠️ **仅作研究、教育、个人安全审计用途。** 不是爬虫工具 —— 不含代理池、调度器、IP rotation、打码集成。
> 使用前请读[免责声明](#伦理与免责声明)。

## 功能

- **复现无感 collector 流程** —— EV1/EV2/EV3 传感器 payload → collector POST 链 → `_pxN`，无需 headless 浏览器。
- **9 个可复用加密/编码原语**（[`revers/`](revers/)）—— payload XOR/base64/交织、PC (HMAC-MD5)、OB 解码、SID 隐写、UUID v1、djb2、memory、anti-tamper、`/ns`。
- **模板方法论** —— 抓 6 批真实样本，锁死 STATIC 字段，从 SDK 逆出 DYNAMIC 字段。~90% 代码跨站复用，只有常量 + 少数 b64 键不同。
- **三档部署** —— 同一 SDK 在不同客户处校验强度不同；项目记录了 宽档 → 严档 → 严档+ 以及每档多出的服务端校验。

## 已验证站点

| 站点 | 档位 | Cookie | 链路 | 实测 |
|---|---|---|---|---|
| [ifood.com.br](stample/ifood/) | 宽档 | `_px3` (ttl 330) | 2-POST | **10/10** |
| [grubhub.com](stample/grub/) | 宽档 | `_px2` (ttl 500) | 2-POST | **10/10** |
| [walmart.com](stample/walmart/) | 宽档 | `_px3` (ttl 330) | 2-POST | **10/10** ² |
| [totalwine.com](stample/totalwine/) | **严档** | `_px2` (ttl 330) | 3-POST + EV3 | **10/10** |
| [academy.com](stample/academy/) | **严档+** | `_px3` (ttl 330) | 3-POST + TLS/IP 绑定信任 | **10/10** ¹ |

所有常量都直接来自真实 POST body 抓包（每个公开站点 6 批可审计）。
¹ academy 是严档+ 案例（trust 还绑定到 mint 的 TLS 指纹、`/ns` token、真 Chrome 模板、出口 IP 信誉），
其生成器包**保持私有**。档位方法论记录在 [AI skill](skill/AI_re/references/deployment-tiers.md) 中。
² walmart 是**仅 PX 层**案例 —— 站点主防护是 **Akamai Bot Manager**，PerimeterX 只是次级层。`_px3` 能被 PX
collector 接受（10/10），但**不能**过 Walmart 业务 API（Akamai `_abck`/`bm_sv` 超出本 skill 范围）。
收录为干净的宽档 + 跨事件一致性参考。

## 快速开始

```bash
git clone https://github.com/warterbili/PerimeterX_RE.git
cd PerimeterX_RE && npm install

# iFood — 产生 _px3（宽档，开箱即跑）
node stample/ifood/px_cookie/ifood_px3.js
# → ✅ _px3=eyJ1IjoiYWJj…  ttl=330   ev1=14  ev2=204

# Grubhub — 产生 _px2
node stample/grub/px_cookie/grubhub_px2.js

# Walmart — 产生 _px3（宽档；仅 PX 层，需 US 出口 IP）
node stample/walmart/px_cookie/walmart_px3.js
# → ✅ _px3=a2426f96…  ttl=330  ev1=12 ev2=207
# ⚠️ 仅 PX 层：Walmart 业务 API 由 Akamai 把守（超范围）。
# PX 成功差分证明：node stample/walmart/script/px_success_proof.js

# Total Wine — 产生 _px2（严档，3-POST；需 US 住宅代理）
HTTPS_PROXY=http://user:pass@host:port node stample/totalwine/px_cookie/totalwine_px2.js
# → _px2=…  ttl=330  ev1=13 ev2=199 ev3=11  seq2=200

# 端到端业务调用（需代理）—— cookie → 真实受保护 HTML
node stample/totalwine/px_cookie/business_api_demo.js
```

每个 `stample/<site>/px_cookie/` 都有 `smoke_test.js`（离线自检）和 `business_api_demo.js`（端到端）。
按压挑战路径是油猴脚本 —— 见 [`bundle/`](bundle/)。

## 原理

PerimeterX 有两条防线。**99% 流量**走**无感 collector**：SDK 序列化传感器事件（EV1/EV2/EV3）、加密
（XOR → base64 → 交织）、签 PC（HMAC-MD5 取数字）、POST 到 collector、拿回 OB 编码的 `_pxN`。
**<1% 按压挑战**路径加了 PoW + WASM bundle，单独在 [`bundle/`](bundle/) 处理。

生成器 = 真实抓包模板，只覆盖**写活（dynamic）字段**：服务端 state（要 `parseInt`）、HMAC/MD5 字段
（输入每站从 SDK 逆向）、计数器、时间戳、`/ns` token、anti-tamper 槽。严档多了必发的 EV3 cookie 确认
beacon、counter 同步、`hid`；严档+ 还把 trust 绑定到 **mint 传输**（真 Chrome TLS）+ 出口 IP 信誉。
完整方法论：[`main/`](main/) 和 [AI skill](skill/AI_re/)。

## 项目结构

```
revers/        9 个算法模块（可 require()）              skill/      AI 逆向 skill
stample/       各站生成器 + 6 批抓包                       ├─ AI_re/  PX 核心 skill（playbook + 工具）
  ├─ ifood/    宽档 · _px3                                 └─ cdp/    真 Chrome CDP 抓包 skill
  ├─ grub/     宽档 · _px2                               main/       技术文档（中 + 英）
  ├─ walmart/  宽档 · _px3 · 仅 PX 层（Akamai 把守）     bug_report/ 踩坑 / 失败模式记录
  ├─ totalwine/ 严档 · _px2 · 3-POST                     research/   字段熵 + SDK 漂移研究
  └─ academy/  严档+ · _px3 · TLS/IP 绑定信任
bundle/        按压挑战路径（PoW + WASM 油猴）
node_bridge/   JSDOM "Plan B" oracle（跑真 SDK）
```

## 文档

| 文档 | 内容 |
|---|---|
| [`main/ZH`](main/ZH/) · [`main/EN`](main/EN/) | 完整技术参考 —— 算法、协议、EV 字段表、跨版本 grep 方法论 |
| [`skill/AI_re/`](skill/AI_re/) | 逆向 skill：7 篇 reference、11 个 playbook、17 个 CLI 工具、23 条 gotcha |
| [`skill/AI_re/references/validated-sites.md`](skill/AI_re/references/validated-sites.md) | 各站常量 + b64 键映射 + 档位清单（逆向新站点必读） |
| [`skill/AI_re/references/deployment-tiers.md`](skill/AI_re/references/deployment-tiers.md) | 宽档 / 严档 / 严档+ 对照 |
| [`bug_report/`](bug_report/) | 已记录的失败模式 / 踩坑 |

## 局限

- 绑定到各站**锁定的 SDK 版本**；PX 升级 SDK 后需重抓、重逆（skill 有升级 playbook）。
- 严档+ 站点需要**真 Chrome 抓的模板 + Chrome-TLS 传输 + 每 cookie 一个干净住宅 IP** —— 用 node TLS 或被污染 IP 铸的 cookie 哪怕字节全对也会被挑战。
- 按压挑战（PoW/WASM）路径是浏览器油猴脚本，非纯算。

## License

双轨制（完整文本见 [`LICENSE`](LICENSE)）：

| 资产 | 范围 | License |
|---|---|---|
| **代码** | `revers/` · `stample/*/px_cookie/` · `bundle/script/` · `node_bridge/` · `skill/*/scripts/` | **AGPL-3.0** —— 商业/SaaS 使用须完整开源回馈 |
| **文档** | `main/` · `bug_report/` · `research/` · 所有 `README` / `SKILL.md` | **CC BY-NC-SA 4.0** —— 禁商用 + 署名 + 衍生同等开源 |

## 伦理与免责声明

仅作研究 / 教育 / 个人安全审计用途；所有抓包样本均通过研究者自有账号合法采集。**严禁**用于未授权爬取、
信用卡/优惠券/礼品卡滥用（carding、coupon fraud）、黄牛刷单、凭据撞库、拒绝服务攻击，或任何违反目标站点
ToS 或当地法律（如美国 CFAA / 欧盟 GDPR / 中国《网络安全法》《数据安全法》《个人信息保护法》）的行为。
作者（`warterbili`）仅作为学术研究成果发布，**不对**由此导致的账号封禁、IP 黑名单、法律诉讼、商业损失等
**承担任何责任**；法律合规由使用者自行承担。二次分发须保留 [`LICENSE`](LICENSE) 中的完整免责声明。
iFood / Grubhub / Total Wine 仅作为协议层逆向研究的**技术对象**，项目不鼓励、不指导任何针对它们的恶意行为。

**责任披露** —— 所有发现均通过协议层和算法层逆向工程得到：不依赖任何内部源码、私有 API、未授权访问；
不利用任何后端漏洞；不规避任何 TLS/证书/签名机制；不窃取任何第三方密钥或数据。严格符合反向工程合理使用
及多国安全研究例外（如美国 DMCA §1201(j)）。合规联系：通过 GitHub Issues 联系 `warterbili` ——
作者保留在收到正式合规请求后 90 天内调整披露范围的权利。

## Citation

```bibtex
@misc{perimeter_v2_2026,
  author       = {warterbili},
  title        = {{PerimeterX (HUMAN Security) SDK Reverse Engineering}},
  year         = {2026}, version = {2.0},
  howpublished = {GitHub Repository},
  url          = {https://github.com/warterbili/PerimeterX_RE}
}
```

<div align="center"><sub>v2.0 · 研究成果 · <a href="#perimeterx--human-security--sdk-逆向工程">回到顶部</a></sub></div>
