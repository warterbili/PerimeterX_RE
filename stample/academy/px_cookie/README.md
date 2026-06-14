# Academy Sports `_px3` Cookie 生成器

Academy Sports + Outdoors（academy.com）的 `_px3` cookie 纯算生成器。
⭐ **PX 严档部署案例 #2**，并且是**第一个要求 Chrome-TLS 传输 + 持久 session 才能过**的站点 —— 比 Total Wine 又深一档。

> 🎯 研究目的 + 实战链路 → [`../RESEARCH_PURPOSE.md`](../RESEARCH_PURPOSE.md)
> 🚀 端到端验证：`python e2e.py 10`（每次一个新住宅 IP，实测 **10/10**）

## 目录

```
px_cookie/
├── README.md
├── e2e.py                       ⭐ 端到端验证（mint → /c/sports-outdoors 网关，10/10）
├── session_server.py            ⭐ chrome142 持久 session 边车（/ns + collector + edge 一条 TLS）
├── smoke_test.js                ⭐ 一键静态自检（require + 常量 + 模板 + 严档独有项）
├── academy_px3.js               ⭐ 主生成器
├── academy_ev1_template.json    (EV1, 13 字段)
├── academy_ev2_template.json    (EV2, 203 字段)  ← 真 Chrome CDP 抓取，非 JSDOM
├── academy_ev3_template.json    (EV3, 11 字段)   ⭐ 严档独有
├── academy_ev{1,2,3}_template_{1..6}.json  ⭐ 6 个真浏览器指纹，按 mint 轮换
├── academy_ev{1,2,3}_field_map.json        (STATIC/DYNAMIC/PARTIAL 分类)
├── state_key_map.json
└── dynamic_role_map.json        (每个写活字段的 SDK 来源)
```

## 跟 iFood / Grub / Total Wine 的差异（严档再 +1 档）

| 项 | iFood `_px3` | Grub `_px2` | Total Wine `_px2` | **Academy `_px3`** ⭐ |
|---|---|---|---|---|
| 部署严格度 | 宽档 | 宽档 | 严档 | **严档+** |
| Collector POST 数 | 2 | 2 | 3 | **3** (seq=0/1/2) |
| EV3 必发 | ✗ | ✗ | ✓ | **✓** |
| `state.hid` | ✗ | ✗ | ✓ | **✓** |
| Counter 同步 | 不查 | 无字段 | 查 `PX12738==PX12739` | **查全模式** `(0,0)/(N,N)/(N,0)`，`(0,N)` 非法 ⭐ |
| **/ns token TLS 指纹** | 不敏感 | 不敏感 | 不敏感 | **敏感**：node→432，Chrome→504 ⭐ |
| **传输** | node TLS 即可 | node TLS 即可 | node TLS 即可 | **必须 Chrome TLS（curl_cffi chrome142）** ⭐ |
| **模板来源** | 任意真抓 | 任意真抓 | 任意真抓 | **必须真 Chrome（JSDOM 信任分不够）** ⭐ |
| Layer 3.5 | 可选 | 可选 | 必跑 | **必跑，且对 mint 的 IP 信誉敏感** |

## 常量

| 字段 | 值 | 来源 |
|---|---|---|
| AppID | `PXqqxM841a` | live capture POST body |
| TAG (gt) | `dgYGCzBjH3pyBg==` | live capture POST body |
| FT | `405` | live capture POST body |
| Cookie | `_px3` (TTL 330) | decoded ob#2 |
| Collector | `https://collector-pxqqxm841a.px-cloud.net/api/v2/collector` | 第三方 collector |
| `/ns` sync | `https://ift.px-cloud.net/ns?c=<uuid>` | EV2/EV3 的 `MV0BV3Q9AGE=` |
| SDK | `https://www.academy.com/qqxM841a/init.js` | sha256 `50debea8…`（LF-norm，344410B） |

## ⭐ 严档+ 四大独有点（不能从 iFood/Grub/TotalWine 抄）

### 1. Counter `AEwwBkUuMjQ=` 的完整合法模式（比 TotalWine 文档更全）

```
{ PX12738: N(单调事件计数), PX12739: x, PX12740: y, PX12741: -1 }
```
`PX12739/PX12740` 只能是 0 或 ==PX12738，**永不独立**。真浏览器只产生三种：
`(0,0)` `(N,N)` `(N,0)`。**`(PX12739=0, PX12740=N)` 真实从不出现 → 严档秒判 bot。**
生成器按轮换到的 batch 用对应真实模式（`CTR_PAT`）。
> TotalWine 文档只记了 `PX12738==PX12739`，漏了 PX12740 维度 —— 本案例补全。

### 2. `/ns` token 是 TLS 指纹化的

`GET /ns?c=<uuid>` 返回的 `sm`（EV2/EV3 字段 `MV0BV3Q9AGE=`）长度随**客户端 TLS** 变：
node https → **432**，真 Chrome（curl_cffi chrome142）→ **504-512**。
node 取的 token 等于告诉后端"声称 Chrome 实为 node" → 降信任。
**必须用与 collector 同一个 Chrome session 取 /ns**（本包用 `session_server.py` 边车统一）。

### 3. 模板必须是真 Chrome CDP 抓的（不能用 JSDOM/node_bridge）

JSDOM 跑真 SDK 也只能采到 headless 化的传感器值（canvas/WebGL/字体）→ 低信任，
它的 631 字节 cookie 在网关页一样被挑战。真 Chrome 抓的 203 字段模板带真指纹 → 高信任。
6 个真模板按 mint 轮换，避免"同指纹铸大量 cookie"被关联。

### 4. perf / 时间戳两套时钟

`AzNzeUVTcks=` = `Math.round(performance.now())` = **距导航起点**的 ms（PX 加载晚，
真实 EV1 是 4500-16000ms），EV2 = EV1 + /ns耗时(~650)。
而 `InJSeGcVXUo= - KDRYPm5SVwk=`（Date 时间戳差）是**另一套时钟**（EV1 ~10ms，EV2 ~1400ms）。
两者不能混。`ZjYWPCNWFws=`(/ns duration) 是 **float**（644-706），不是 int。

## 怎么跑

```bash
# 端到端验证（每次一个新 US 住宅 IP；需 SCRAPEOPS_KEY 或用内置 demo key）
python e2e.py 10

# 本地 IP（注意：重复 mint 会拖垮该 IP 的 collector 信誉，见下）
python e2e.py 5 --local

# 静态自检（不联网）
node smoke_test.js
```

## ⚠️ 实测结果 + IP 信誉注意

**新住宅 IP（每次换）：10/10 PASS**（对标 TotalWine）。

但 **academy 严档对 mint 的 IP 信誉极敏感**：从同一出口 IP 反复 mint 几十次，会把该 IP（甚至整个代理池）的 collector 信任打低，新 mint 被降分 → 网关拒。实测本地 IP 在重测后降到 ~1/5、ScrapeOps 池被打了 25+ 次后也降到 ~0。
- cookie 算法/指纹**没问题**（同一份代码新 IP 10/10）
- 生产用法：**每个 cookie 走一个新住宅 IP，不要单 IP 高频 mint**
- "浏览器能开首页" ≠ "该 IP 上自动化 mint 被信任"（首页没被严格门控）

详见 skill 记忆 `px-strict-tier-gotchas` 与 [`deployment-tiers.md`](../../../skill/AI_re/references/deployment-tiers.md)。
