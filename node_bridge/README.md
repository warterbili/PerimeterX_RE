# 🌉 Node Bridge — Plan B 补环境方案

> 项目的**纯算路线**（`stample/{ifood,grub}/px_cookie/`）是主推方案。本目录是**备份/补环境路线**：
> JSDOM 启动浏览器世界 → 加载真实 PX SDK → SDK 自己跑 → 通过 Python `curl_cffi` 转发请求 → 拿 `_px3`。

> 🔝 **后手升级路径**：当本 bridge 跑不通（如碰到 `typeof document.all` 这种 V8-level 检测），切到
> [**sdenv** (github.com/pysunday/sdenv)](https://github.com/pysunday/sdenv) — 718⭐ 的公开补环境 ceiling，
> jsdom fork 改 C++ 层。详见 §10/§11 + `skill/methodology.md §7`。

> ✅ **实测更正（2026-06-13）：node_bridge 能过 academy 严档+。** 早先写的"过不了、只配做 oracle"是**错的**——
> 当时出口 IP 被烧了，错怪到 JSDOM 指纹头上。换干净住宅 IP 后，node_bridge 跑真 SDK（chrome142 TLS 转发）
> **直接拿到 academy 1.2MB 真商品页**。JSDOM 指纹不是信任天花板；真正决定通过率的是 **出口 IP 信誉 + counter 合法 + Chrome TLS 传输**
> （见 [`skill/AI_re/references/gotchas.md`](../skill/AI_re/references/gotchas.md) Bug #22/#23）。
> 所以 node_bridge 有**两个**用途：(1) **逆向 oracle**——看真 SDK 怎么算某字段；(2) **零维护生产兜底**——
> 它跑真 SDK，SDK 一轮换就自动适配，干净 IP 上直接出过网关的 cookie（对比纯算：SDK 升级要重抓重建模板）。
> 纯算（`stample/academy/`）和 node_bridge 是**互补**的两条产线，不是谁取代谁。

---

## 0. TL;DR — 30 秒看懂

```
                Python (curl_cffi chrome131 TLS)              Node (JSDOM)
                ─────────────────────────────────             ─────────────────
                                                                                
       1. 访问 ifood 首页                                                      
          → 拿 Akamai bm_ss/bm_s/bm_so                                          
                                                                                
       2. spawn ──────────────────────────────────────→  px_node_bridge.js     
                                                          ├ build JSDOM 浏览器环境
                                                          ├ install 11 个 env 模块   
                                                          ├ override XHR + fetch    
                                                          ├ 加载 PX SDK (main.min.js)
                                                          └ SDK 开始跑…              
                                                                                
       3. stdout ← {type:"request", url:"...collector"}   SDK 发请求 (拦截到 ProxyXHR)
                                                                                
       4. curl_cffi 转发 (chrome131 TLS) ──────────→  真实 PX collector       
                                                                                
       5. stdin → {status:200, body:"..."}     ─────→   ProxyXHR resolve()      
                                                          SDK 收到 response          
                                                          处理 → document.cookie 写 _px3
                                                                                
       6. stdout ← {type:"result", px3:"...", pxvid:"..."}                      
                                                                                
       7. Python 提取 _px3 + _pxvid，端到端完成 ✓                              
```

**核心 insight**：Node 默认 TLS 指纹 PX 一眼识别。**必须 Python 用 chrome131 模拟 TLS** 才能让 SDK 跑通完整 collector 链路。

---

## 1. 跟纯算的对比 + 用法决策树

| 维度 | 纯算 (主推) | Node Bridge (Plan B) |
|---|---|---|
| 速度 | 350ms / cookie | 30-60s / cookie |
| 内存 | < 50 MB | 200+ MB (JSDOM 重) |
| 网络 | 直接 https | 必经 Python curl_cffi 转发 |
| SDK 升级影响 | 重写 generator (1-2 天) | **直接跑新 SDK** (0 修改) |
| 新站点接入 | 全套逆向 (15 h) | 改 1 个 URL + 装 SDK (30 min) |
| 维护成本 | 高 | 低 |
| 评分稳定性 | 看算法对不对 | **永远满分**（真 SDK） |

**何时用 Plan B**：
- SDK 大改导致纯算暂时跑不通 → 不用慌，bridge 接着跑
- 接新站点先 spike → 30 分钟看能不能拿 cookie，再决定是否值得纯算
- Bundle 评分高门槛端点 → 真 SDK 评分高过纯算

**何时不用**：
- 高吞吐生产（> 几千 cookie / 小时）→ bridge 太慢

---

## 2. 原理：JSDOM 怎么"补"出一个浏览器

PX SDK 假设它在真浏览器里运行 —— 用到 `window.navigator.userAgent`、`HTMLCanvasElement`、`AudioContext`、`performance.memory`、`screen.width` 等几十个浏览器 API。

Node.js 没有这些 API。**JSDOM 提供基础 DOM + Window**（约 80% 的标准 API），但还缺指纹相关的（canvas 实际渲染、audio 处理、navigator.userAgentData 等）。

**`ifood/px-node-env/env/` 11 个文件分类补齐**：

| 文件 | 行数 | 补的是什么 | 为啥要补 |
|---|---|---|---|
| `builder.js` | ~400 | 主入口 — 创建 JSDOM + 装载其它 10 个 module | 必须先有 window + document |
| `navigator.js` | ~80 | `navigator.userAgentData`, `platform`, `vendor`, `language(s)` | SDK 用这些做 client hints + UA 校验 |
| `browser_apis.js` | ~150 | `IntersectionObserver`, `ResizeObserver`, `MutationObserver`, `PerformanceObserver` | SDK 监听 DOM 变化 |
| `canvas.js` | ~120 | HTMLCanvasElement context + WebGL stub (用 `canvas` npm 包) | Canvas/WebGL fingerprint hash |
| `audio.js` | ~80 | `AudioContext`, `OfflineAudioContext` + 确定性 sine wave | AudioContext fingerprint |
| `fonts.js` | ~50 | `document.fonts` API + canvas measureText | Font enumeration fingerprint |
| `events.js` | ~200 | `MouseEvent`/`KeyboardEvent`/`TouchEvent` + 模拟 mousemove/click/scroll | SDK 检测用户交互（怀疑 headless 的关键指标）|
| `network.js` | ~50 | `navigator.connection` (`effectiveType`, `rtt`, `downlink`) | Connection API fingerprint |
| `tls_fingerprint.js` | ~30 | navigator.languages, RTC stub | 反 headless 检测 |
| `stealth.js` | ~80 | `navigator.webdriver=false`, hide `__nightmare`, override `chrome` object | 反 headless 检测 |
| `px_intercept.js` | ~60 | `_pxAppId`, `_pxUuid`, `_pxVid` window globals + window.PX hooks | PX SDK 检查 self-init 状态 |

**注**：`canvas` npm 包是 jsdom 的 peer dependency，**必须装上才能让 canvas/WebGL fingerprint hash 正确算**（否则 SDK 检测到异常 abort）。

---

## 3. 劫持机制：怎么把 SDK 的请求转给 Python

JSDOM 默认会真的发 HTTP 请求（用 Node 内置 `http`/`https`）—— **Node 的 TLS 指纹不是 Chrome**，PX 一眼识别出来卡 `/ns` 不让进下一步。

解决：**`px_node_bridge.js` 第 22-203 行**完全 override `window.XMLHttpRequest` 和 `window.fetch`，让它们**不发请求**，只把 request JSON 打到 stdout 让 Python 转发：

### 3.1 XHR 拦截 (line 54-165)

```javascript
class ProxyXHR {
    async send(data) {
        const id = ++requestId;
        // 不发请求！只把元信息写到 stdout
        process.stdout.write(JSON.stringify({
            type: 'request', id, method: this._method, url, headers, body: data
        }) + '\n');

        // 等 Python 从 stdin 写回 response
        const resp = await waitForResponse(id);

        this.status = resp.status;
        this.responseText = resp.body;
        // 注回 SDK
        if (this.onload) this.onload({type:'load', target:this});
    }
}
window.XMLHttpRequest = ProxyXHR;  // ★ 全局替换
```

### 3.2 fetch 拦截 (line 170-200)

类似 XHR，把 `fetch()` 重写成 stdout-JSON-out + stdin-JSON-in。

### 3.3 PX bake 指令处理 ⭐ (line 127-139)

PX collector response 里有 `do` 数组，包含 `bake|cookie_name|cookie_value` 指令：

```json
{
  "do": [
    "bake|_px3|abc...xyz=",
    "bake|_pxvid|c8357..."
  ]
}
```

bridge 解析这个数组，**手动**执行 `document.cookie = name=value`。这是 PX SDK 给浏览器 issue cookie 的方式，必须在 bridge 里识别并执行 —— 否则 SDK 走完整链路但 cookie 永远不出现在 document.cookie。

---

## 4. 怎么固定 SDK

`px_node_bridge.js` line 215 决定加载哪个 SDK 文件：

```javascript
const pxSdkPath = path.join(__dirname, 'perimeterx/main.min.js');
```

要升级 SDK：

```bash
# 1. 从浏览器抓最新版（DevTools Local Override 或 mitmproxy）
# 2. 覆盖 SDK 文件
cp /path/to/new/main.min.js ifood/perimeterx/main.min.js
# 3. SHA 记录到 stample/ifood/source/SDK_INFO.md
sha256sum ifood/perimeterx/main.min.js
```

**SDK 跨版本 0 兼容性问题** —— bridge 不知道 SDK 内容，只负责跑它。新 SDK 直接替换即可。

> 💡 **当前固定的 SDK**：`ifood/perimeterx/main.min.js` 跟 `stample/ifood/source/main.min.js` 同源
> SHA256: `b47a639cde9df4f91bdc4138ae0d64ebf7ce8c876a1e4c9967fd3af3d2975eb8`

---

## 5. 怎么补环境（迁新站点）

如果要给 Grubhub / Walmart 等新站点做 bridge：

```bash
# 1. mkdir 新站点
mkdir -p node_bridge/<site>/{perimeterx,px-node-env/env}

# 2. 复用 11 个 env 文件（80%+ 通用）
cp ifood/px-node-env/env/*.js <site>/px-node-env/env/

# 3. 复用 px_node_bridge.js + px_cookie_generator.py，改：
#    - SDK path  (line 215)
#    - IFOOD_BASE / APP_ID / COLLECTOR_BASE 常量
#    - targetUrl (传给 buildEnvironment)

# 4. 锁定新站点 SDK
cp stample/<site>/source/<sdk_file>.js <site>/perimeterx/

# 5. 跑试
cd <site> && python px_cookie_generator.py
```

**通常只有 2-3 个 env 文件需要微调**（比如 navigator.platform 改成 Linux）。

---

## 6. 完整跑通命令（iFood 已验证）

### 6.1 准备

```bash
# 装 Node deps
cd node_bridge/ifood
npm install --ignore-scripts        # canvas native build 需要 MSBuild, 跳过 install scripts
npm install canvas@3                # canvas@3 有 Windows prebuild, 自动下载

# 装 Python deps
pip install curl_cffi
```

### 6.2 设代理（必需 BR 巴西住宅）

```bash
export HTTPS_PROXY='http://<user>:<pwd>@<host>:<port>'
```

### 6.3 跑

```bash
python px_cookie_generator.py
```

### 6.4 实测输出（2026-05-21 跑通）

```
[PX] Starting PX cookie generation via Node bridge...
[PX] Visiting ifood homepage...
[PX] Homepage: 200, cookies: ['bm_ss', 'bm_s', 'bm_so']     ← Akamai BMP 接受
  [NODE] [BRIDGE] Starting PX Node Bridge...
  [NODE] [BROWSER_APIS] Missing browser APIs installed
  [NODE] [STEALTH] Stealth patches installed
  [NODE] [FONTS] Font detection support installed
  [NODE] [AUDIO] AudioContext mock installed
  [NODE] [EVENTS] Event simulation installed
  [NODE] [PX_INTERCEPT] Missing browser properties installed
  [NODE] [ENV] Environment built successfully
  [NODE] [BRIDGE] Proxy network layer installed
  [NODE] [BRIDGE] Loading PX SDK (231438 bytes)...
[PX] Proxying request 1: GET https://tzm.px-cloud.net/ns?c=a3003297-5538-11f1-...
[PX] Response 1: 200 (168 bytes)                            ← /ns warmup
[PX] Proxying request 2: POST https://collector-PXO1GDTa7Q.px-cloud.net/api/v2/collector
[PX] Response 2: 200 (1788 bytes)                           ← EV1 (anonymous events)
[PX] Proxying request 3: POST https://collector-PXO1GDTa7Q.px-cloud.net/api/v2/collector
[PX] Response 3: 200 (372 bytes)                            ← EV2 (full fingerprint)
[PX] Proxying request 4: POST https://collector-PXO1GDTa7Q.px-cloud.net/api/v2/collector
[PX] Response 4: 200 (372 bytes)                            ← EV3 state echo
  [NODE] [BRIDGE] Done. Cookies: _pxvid=a3003297-...; _px3=2772e4cf9eab...
[PX] Got result: px3=yes
[PX] Success! _px3 length: 631

============================================================
✅ _px3 SUCCESS! len=631
   first 80: 2772e4cf9eab2076fdf4cc18ae7e9aae8e55044fc70a6c0a3ad51a9e23c633b8:Aaj/Wrwg8q705U/
   _pxvid: a3003297-5538-11f1-ae93-487d42ff6c51
============================================================
```

总耗时 ~50 秒（其中 30 秒是 bridge 等 SDK 处理完，10 秒 curl 网络 RTT）。

---

## 7. 调试踩坑

| 现象 | 原因 | 修复 |
|---|---|---|
| SDK 卡在 `/ns` 不发后续 POST | Node 默认 TLS != Chrome，PX 识别出来 abort | **必须**用 Python curl_cffi chrome131；不要直接跑 Node bridge |
| `Errno 22 Invalid argument` (Python) | Node bridge 已 exit，Python 还在 write stdin | px_cookie_generator.py 已加 BrokenPipeError 容错 |
| Node bridge 30s 内没拿到 _px3 | SDK 链路要 4 个 collector POST，慢链路超过 30s | 调大 `px_node_bridge.js` line 228 的 setTimeout |
| `Failed to perform, curl: (28) Connection timed out` | 单个 curl_cffi 请求超时 | 调大 px_cookie_generator.py 的 `timeout=30` |
| canvas native build fail (Windows) | 缺 MSBuild | `npm install canvas@3` （有 Windows prebuild）|
| iFood 首页 403 | 没用 BR 巴西代理，被 Cloudflare 拦 | 设 HTTPS_PROXY 为巴西住宅 |

---

## 8. 文件清单

```
node_bridge/
├── README.md                                ← 本文件
└── ifood/                                   ← 跑通示例
    ├── package.json                         ← jsdom + canvas
    ├── perimeterx/
    │   └── main.min.js                      ← PX SDK (231KB, 锁定版)
    ├── px_node_bridge.js                    ← Node bridge (IPC + JSDOM + 拦截)
    ├── px_cookie_generator.py               ← Python 协调器 (curl_cffi chrome131)
    └── px-node-env/
        └── env/                             ← 11 个 JSDOM augmentation
            ├── audio.js
            ├── browser_apis.js
            ├── builder.js                   ← 主构建器
            ├── canvas.js
            ├── events.js
            ├── fonts.js
            ├── navigator.js
            ├── network.js
            ├── px_intercept.js
            ├── stealth.js
            └── tls_fingerprint.js
```

**Grubhub 适配同样模板**：复制 `ifood/` → `grub/`，改 SDK 路径 + URL 常量 + targetUrl。Grubhub SDK 已经在 `stample/grub/source/init.js` 锁定（SHA `49c64f02bd71...`）。

---

## 9. 何时切换回纯算

跑 Plan B 拿到 _px3 之后，**强烈建议**切回纯算：

1. 速度快 100 倍（350ms vs 50s）
2. 内存少 4 倍（< 50MB vs 200+MB）
3. Bundle SDK 升级响应快（不依赖 jsdom 兼容性）

Plan B 的核心价值是 **PX SDK 升级紧急期间的 fallback** —— 让生产不停机，给纯算修复留时间。

---

## 10. 三层 Fallback 架构（项目反爬全策略）

```
┌─────────────────────────────────────────────────────────────┐
│   纯算 (revers/ + stample/<site>/px_cookie/)                 │
│   - 350ms / cookie · 高吞吐生产首选                          │
│   - 维护成本高，SDK 大改要重写 generator                     │
└──────────────┬──────────────────────────────────────────────┘
               │ 纯算暂时跑不通时
               ▼
┌─────────────────────────────────────────────────────────────┐
│   我们 node_bridge (jsdom 基础 + 11 env + Python TLS)        │  ← 本目录
│   - ~50s / cookie · iFood PX 实战跑通                        │
│   - jsdom JS 层 patch 够用                                   │
│   - 维护成本低（直接换 SDK）                                 │
└──────────────┬──────────────────────────────────────────────┘
               │ 我们 bridge 也跑不通（typeof document.all 这种 spec quirk）
               ▼
┌─────────────────────────────────────────────────────────────┐
│   sdenv (https://github.com/pysunday/sdenv)  ← 后手          │
│   - 718⭐ · 公开补环境 ceiling                                │
│   - jsdom fork 改 C++ 层（解 JS 层永远绕不过的检测）         │
│   - plugin 系统易扩展                                        │
│   - 实战目标：瑞数 VMP（比 PX 更狠）                          │
│   - 何时升级：见 skill/methodology.md §"何时升级到 sdenv"    │
└─────────────────────────────────────────────────────────────┘
```

**3 层选哪个的决策**：

| 场景 | 选 |
|---|---|
| 已逆向、生产稳定 | 纯算 |
| 纯算紧急修复期 / 新站点 spike | 我们 bridge |
| 碰到 typeof / Proxy detect / V8-level 检测 | sdenv |
| 高门槛 endpoint（如 iFood feed）评分不够 | 看情况升 sdenv 或走真浏览器 |

---

## 11. 补环境生态对比（决策参考）

### 依赖真浏览器路线（重但保真，~1-3s / cookie）

| 框架 | 强项 | 弱点 |
|---|---|---|
| **puppeteer-extra-plugin-stealth** (7000⭐) | 30+ patches / 国际化最成熟 / Chrome 完整 | 重 200+MB / 启动慢 |
| **undetected-chromedriver** (Python) | webdriver 标志清除最干净 | Selenium 依赖 |
| **nodriver** (Python, 2025 新) | 零 webdriver 标志 / undetected-cd 作者新作 | Python 生态偏小 |
| **playwright-stealth** | 比 puppeteer-extra 轻 | playwright 生态 |
| **fakebrowser** (JS) | 大量 fingerprint pool（指纹池） | 维护偏少 |
| **browserless** (SaaS) | 托管化省运维 | 商用付费 |

### 不依赖真浏览器路线（轻但要补，~50s / cookie）⭐ 本项目走这条

| 框架 | 强项 | 弱点 / 适用 |
|---|---|---|
| **sdenv** (718⭐) ⭐⭐⭐ | **jsdom fork + 改 C++** / plugin 系统 / 瑞数 VMP 实战 | 最强后手 / 主针对中国反爬 |
| **jsdom** (基础库) | 业界事实标准 / W3C 兼容 | **裸跑不防检测**（要自己 patch 30+ 处） |
| **happy-dom** | 比 jsdom 快 2-3 倍 / 内存少 | **API 不完整**：PX/Akamai SDK 跑不通（缺 MutationObserver / IntersectionObserver 等关键 API） |
| **linkedom** | 极快 / 极小（无 JS engine） | **不能跑 JS SDK**，仅 DOM parse（适合静态 HTML 解析，不是反爬） |
| **deno_dom** | Rust 实现 / 安全沙箱 | Deno 生态小 / PX SDK 适配差 |
| **JsRPC** (Frida-based) | 真浏览器开后门 Python 调 JS 函数 | 要常驻浏览器（本质混合方案，不算纯补环境） |
| **AST 还原** (Babel + 工具链) | 改 SDK 代码让它在 bare V8 跑（不需要 DOM） | SDK 每次升级要重做 AST 还原 |

### 本项目在生态中的位置

老实说：
- 比 puppeteer-extra-plugin-stealth 弱（人家 30+ patches + 工业级维护）
- 比 sdenv 弱（人家 C++ 级 fork + plugin 系统）
- **但 PX 专精度高**（3 年 iFood/Grubhub 实战 + 详细 journal）

**定位**：够用的 Plan B 内部工具。不争开源天花板。**真要更狠的场景上 sdenv** ⭐。

---

## 12. AI Skill — 让 AI 给新站点构建 bridge

`skill/` 目录是给 Claude Code / Cursor 用的 AI skill，让 AI 拿着方法论自动给新站点做 bridge：

| 文件 | 用途 |
|---|---|
| [`skill/SKILL.md`](skill/SKILL.md) | AI 调用入口（frontmatter + 触发场景 + 步骤索引） |
| [`skill/methodology.md`](skill/methodology.md) | 方法论（4 发现手段 + 三技能合成 + sdenv 借鉴 + 升级决策） |
| [`skill/new_site_guide.md`](skill/new_site_guide.md) | 新站点适配 9 步实操教程 |

用户触发：`@node_bridge/skill/SKILL.md  给 walmart 做一个 bridge`

---

*文档时间 2026-05-22 · 实测 iFood _px3 端到端跑通*
