# Node Bridge 补环境方法论

> 本文档面向 **AI agent 自动构建 node_bridge**。沉淀的核心问题：
> **怎么知道要补什么？怎么补合理？跑不通怎么排查？什么时候放弃升级到 sdenv？**

> 🔝 **后手项目**：[**sdenv** — https://github.com/pysunday/sdenv](https://github.com/pysunday/sdenv)
> · 718⭐ · jsdom fork 改 C++ · 配套纯算 [rs-reverse](https://github.com/pysunday/rs-reverse)
> · 详细借鉴见本文档 §5，升级决策见 §7

---

## 0. 三技能合成图 ⭐

Node bridge **不是从零长出来的**，是 3 个上游 skill + jsdom + 11 env 模块 + Python TLS 层的**有机合成**：

```
   ┌─────────────────────────────┐    ┌──────────────────────────────┐
   │   cdp-browser skill         │    │   jni-env-patching skill     │
   │   (上游 — 真值采集)          │    │   (方法论 — 4 步法)           │
   │                             │    │                              │
   │   - 启真 Chrome             │    │   ① 识别 crash 报错           │
   │   - eval 任意 JS dump 真值   │    │   ② 看真环境 (Java/Chrome)    │
   │   - 抓 navigator/screen     │    │   ③ 给合理值                  │
   │   - 抓 canvas/audio hash    │    │   ④ 不确定时 hook 真机/真 Chrome │
   │   - 抓 collector POST 真包  │    │                              │
   └──────────┬──────────────────┘    └──────────┬───────────────────┘
              │                                   │
              │   (类比关系)                       │
              │   JNI 补 Android Java 层  ≡   env/ 补 Browser DOM 层
              │                                   │
              ▼                                   ▼
   ┌────────────────────────────────────────────────────────────────┐
   │            node_bridge/<site>/                                  │
   │                                                                  │
   │   ┌────────────────────────────────────────────────────────┐   │
   │   │ Layer 1: env/*.js (11 个补环境模块)                     │   │
   │   │  ← cdp-browser dump 的 hardcode 真值                    │   │
   │   │  ← jni-env-patching 4 步法迭代出来的 mock 集合          │   │
   │   │  ← 每个模块对应一类 fingerprint API                     │   │
   │   │     (navigator/canvas/audio/fonts/events/...)           │   │
   │   └────────────────────────────────────────────────────────┘   │
   │                                                                  │
   │   ┌────────────────────────────────────────────────────────┐   │
   │   │ Layer 2: px_node_bridge.js                              │   │
   │   │  ← JSDOM (jsdom@22 npm 包) 提供 window/document         │   │
   │   │  ← 重写 window.XMLHttpRequest / window.fetch            │   │
   │   │     → 拦截但不发，输出 JSON 给 Python                   │   │
   │   │  ← 处理 PX bake|cookie 指令 (do[] 数组)                 │   │
   │   └────────────────────────────────────────────────────────┘   │
   │                                                                  │
   │   ┌────────────────────────────────────────────────────────┐   │
   │   │ Layer 3: px_cookie_generator.py                         │◀──┐
   │   │  ← Python 主进程，spawn Node bridge                     │   │
   │   │  ← curl_cffi(impersonate='chrome131') 真发请求          │   │
   │   │  ← stdio IPC: 收 Node 输出 / 写 Node 输入                │   │
   │   │  ← 解析最终 _px3 cookie                                  │   │
   │   └────────────────────────────────────────────────────────┘   │
   └────────────────────────────────────────────────────────────────┘
                                                                       │
                                  ┌────────────────────────────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────────────┐
                  │   curl_cffi_integrate skill (网络层)   │
                  │                                        │
                  │   - chrome131 TLS 完整模拟             │
                  │   - HTTP/2 SETTINGS 帧 / WINDOW_UPDATE │
                  │   - JA3 / JA4 指纹自动匹配             │
                  │   - 自动复用 Chrome 的 cipher 顺序     │
                  └───────────────────────────────────────┘
```

## 0.x 三技能贡献映射

| 关注点 | 提供 skill | 在 bridge 里的角色 | 落地文件 |
|---|---|---|---|
| 怎么知道真 Chrome 的值 | **cdp-browser** | 一次性 dump 真 Chrome JS 值 | `env/*.js` 里 hardcoded 数据的**来源** |
| 怎么决定补什么 + 怎么改 | **jni-env-patching** | 迭代方法论（4 步法） | `env/*.js` 怎么从空白长成 11 个文件 |
| 怎么让 PX 不识破 TLS | **curl_cffi_integrate** | 网络层 TLS 模拟 | `px_cookie_generator.py` 用 chrome131 |
| 怎么搭建假浏览器世界 | **本 skill + jsdom** | DOM 容器 + 11 env + IPC 拦截 | `px_node_bridge.js + env/*.js` |
| 怎么 dump fingerprint hashes | **cdp-browser** | 抓 canvas/audio/font 真 hash | `env/canvas.js` + `env/audio.js` |

---

## 1. 核心原则（借自 jni-env-patching）

**"先看真环境再给合理值。禁止盲目补环境。"**

类比关系：

| 维度 | JNI 补环境（Android）| **Browser 补环境（本 skill）** |
|---|---|---|
| 平台 | unidbg + Android SO | Node + jsdom |
| 缺失 | JNI 回 Java 层 callback | Browser API (navigator/canvas/audio) |
| 报错形式 | `UnsupportedOperationException` | `TypeError: ... is not a function` |
| 解决方式 | `AbstractJni` override callback | `env/*.js` override window 属性 |
| 看真环境 | JADX / apktool smali 读 Java 层 | DevTools / **cdp-browser** 读真 Chrome |
| 不确定时 | Frida hook 真机 | **cdp-browser** dump 真 Chrome |

**禁止做的事**：
- 给 random 值（如 `screen.width = 1234`）→ 跟真 Chrome 一致才有意义
- 抄网上别的项目的 mock 值 → 那些可能针对别的厂商，PX 不认
- 试图 mock 全部 browser API → 不可能（DOM 有 1000+ API）

---

## 2. 4 个发现手段（怎么找出要补什么）⭐⭐

### 手段 1：静态 grep（粗筛 SDK）

```bash
# beautify SDK
npx js-beautify perimeterx/<sdk>.js > /tmp/sdk_pretty.js
wc -l /tmp/sdk_pretty.js   # 通常 10000+ 行

# grep 已知 fingerprint API 调用
grep -n "navigator\.userAgent" /tmp/sdk_pretty.js
grep -n "Object\.keys(window)" /tmp/sdk_pretty.js
grep -n "canvas\.toDataURL\|getContext('2d')" /tmp/sdk_pretty.js
grep -n "new AudioContext\|new OfflineAudioContext" /tmp/sdk_pretty.js
grep -n "navigator\.plugins\|navigator\.mimeTypes" /tmp/sdk_pretty.js
grep -n "screen\.width\|screen\.colorDepth" /tmp/sdk_pretty.js
grep -n "performance\.memory\|performance\.now" /tmp/sdk_pretty.js
grep -n "WebGLRenderingContext\|getSupportedExtensions" /tmp/sdk_pretty.js
```

每个 grep 命中找到 wrapper 函数名（minified 是 `xS()`、`hQ()` 这种 2-3 字符）。

**产出**：怀疑的 wrapper 函数清单（10-20 个）。

### 手段 2：动态断点（真 Chrome + DevTools）

```bash
# 用 cdp-browser skill 启真 Chrome
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py start
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py navigate "https://<target_site>"

# DevTools Console:
debug(xS)      // 给 SDK 的 xS 函数下断点
debug(mh)      // 给 SDK 的 mh 函数下断点

# 重新加载页面 → SDK 跑到这些函数时断下
# 看 call stack / arguments / 内部逻辑
```

**产出**：每个 wrapper 干啥的清晰理解（指纹采集 / hash / 序列化）。

### 手段 3：差异比对 ⭐（最高效）

**核心思路**：同时跑 SDK 在两个环境，diff EV2 POST body：

```python
# A. 真 Chrome 抓 collector POST body
import subprocess
real_post = subprocess.check_output(['python', cdp_script, 'network', '15'])
# 提取 collector POST 的 payload field

# B. JSDOM (无 env mock 时) 抓 POST body
node_post = run_bridge_no_mocks()  # 我们的 bridge 输出

# 解码 + diff EV2 字段
diff_ev2(real_post, node_post)
# 输出形如:
#   field_001: 'Win32' vs 'MacIntel'         → navigator.platform mismatch
#   field_034: '5da3b8...' vs '00000000...'   → canvas hash mismatch
#   field_087: hash_A vs hash_B               → Object.keys(window) mismatch
```

**产出**：精确知道哪些字段错 → 直接对应补哪个 API。这是**最经济**的手段，每次迭代都用。

### 手段 4：Proxy 监听（神级 trick）

把 navigator/document/window 包成 Proxy，**记录 SDK 实际读了哪些属性**：

```javascript
// 在 env/builder.js 加 (调试期间)
window.navigator = new Proxy(window.navigator, {
    get(target, prop) {
        console.log(`[PX-READ] navigator.${String(prop)}`);
        return target[prop];
    }
});
window.screen = new Proxy(window.screen, {
    get(target, prop) {
        console.log(`[PX-READ] screen.${String(prop)}`);
        return target[prop];
    }
});

// 跑 SDK → 控制台看 PX 实际读了哪些属性
//   [PX-READ] navigator.userAgent
//   [PX-READ] navigator.userAgentData      ← 这个 jsdom 没有
//   [PX-READ] navigator.connection         ← 这个 jsdom 没有
//   [PX-READ] navigator.hardwareConcurrency
//   ... (50+ properties)
//   [PX-READ] screen.width
//   [PX-READ] screen.colorDepth
```

**产出**：必须 mock 的 API 完整清单。

**注意**：Proxy 不能装在已经 freeze 的对象上（jsdom 有些 prototype 是 frozen）。失败时 fallback 到 `Object.defineProperty` 加 getter。

---

## 3. cdp-browser skill 详细 dump 模板（直接 paste 用）

dump 真 Chrome 的标准命令集，输出**直接 paste 进 env/*.js**：

### 3.1 navigator 完整 dump

```bash
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py navigate "https://www.<site>.com"

python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py eval "
  JSON.stringify({
    userAgent: navigator.userAgent,
    appVersion: navigator.appVersion,
    platform: navigator.platform,
    vendor: navigator.vendor,
    vendorSub: navigator.vendorSub,
    productSub: navigator.productSub,
    language: navigator.language,
    languages: [...navigator.languages],
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigator.deviceMemory,
    maxTouchPoints: navigator.maxTouchPoints,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    doNotTrack: navigator.doNotTrack,
    webdriver: navigator.webdriver,
    pdfViewerEnabled: navigator.pdfViewerEnabled,
    plugins: [...navigator.plugins].map(p => ({
      name: p.name, filename: p.filename, description: p.description,
      mimeTypes: [...p].map(m => ({ type: m.type, suffixes: m.suffixes, description: m.description }))
    })),
    userAgentData: navigator.userAgentData ? {
      platform: navigator.userAgentData.platform,
      mobile: navigator.userAgentData.mobile,
      brands: navigator.userAgentData.brands
    } : null,
    connection: navigator.connection ? {
      effectiveType: navigator.connection.effectiveType,
      downlink: navigator.connection.downlink,
      rtt: navigator.connection.rtt,
      saveData: navigator.connection.saveData
    } : null,
  })
"
```

### 3.2 screen / window / visualViewport

```bash
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py eval "
  JSON.stringify({
    screen: {
      width: screen.width, height: screen.height,
      availWidth: screen.availWidth, availHeight: screen.availHeight,
      colorDepth: screen.colorDepth, pixelDepth: screen.pixelDepth,
      orientation: screen.orientation ? { type: screen.orientation.type } : null
    },
    window: {
      innerWidth: innerWidth, innerHeight: innerHeight,
      outerWidth: outerWidth, outerHeight: outerHeight,
      devicePixelRatio: devicePixelRatio
    },
    visualViewport: visualViewport ? {
      width: visualViewport.width, height: visualViewport.height,
      offsetLeft: visualViewport.offsetLeft, offsetTop: visualViewport.offsetTop,
      pageLeft: visualViewport.pageLeft, pageTop: visualViewport.pageTop,
      scale: visualViewport.scale
    } : null
  })
"
```

### 3.3 window 的 enumerable keys（关键 — PX 用 Object.keys(window) 算 hash）

```bash
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py eval "
  Object.keys(window).filter(k => !k.startsWith('_')).sort()
"
# 输出 ~250 个 keys 数组
# diff 跟 jsdom Object.keys(window) → 差异就是 px_intercept.js 要补的
```

### 3.4 Canvas fingerprint hash 校准（用于 env/canvas.js）

```bash
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py eval "
  const c = document.createElement('canvas');
  c.width = 200; c.height = 50;
  const ctx = c.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = \"14px 'Arial'\";
  ctx.fillStyle = '#f60';
  ctx.fillRect(125, 1, 62, 20);
  ctx.fillStyle = '#069';
  ctx.fillText('BrowserLeaks,com <canvas> 1.0', 2, 15);
  c.toDataURL().slice(-50)
"
# 真 Chrome 输出: '...some-base64-tail-50-chars'
# 我们的 bridge 用 @napi-rs/canvas 跑同样代码 → 输出应该一致
# 不一致 → @napi-rs/canvas 版本/字体配置不对
```

### 3.5 collector POST body 抓取（用于差异比对）

```bash
# 启 Chrome + network capture + 触发 PX SDK 跑
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py navigate "https://www.<site>.com"
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py network 30 > /tmp/real_chrome_traffic.json

# 提取 collector POST request bodies
jq '.[] | select(.request.url | contains("collector"))' /tmp/real_chrome_traffic.json
```

---

## 4. jni-env-patching 4 步法在本 skill 的具体应用

| jni-env-patching 步骤 | Node bridge 等价做法 | 落地 |
|---|---|---|
| ① 识别 crash 报错 | 看 `[NODE]` stderr 的 TypeError | `TypeError: Cannot read property 'X' of undefined` → 缺 X |
| ② 在 Java 层看语义 | 用 **cdp-browser** dump 真 Chrome 对应属性 | `cdp eval "JSON.stringify(navigator.X)"` |
| ③ 给随机且合理的值 | hardcode dump 出来的真 Chrome 值进 `env/<file>.js` | 不要随机 — 跟真 Chrome 完全一致 |
| ④ 不确定时 hook 真机 | DevTools 在 SDK wrapper 函数上断点，看真值 | `debug(xS)` + breakpoint |

完全同构 —— 平台和宿主不同但方法论 1:1 对应。

---

## 5. 从 sdenv 借鉴的 4 个点 ⭐

sdenv (https://github.com/pysunday/sdenv, 718⭐) 是公开补环境框架 ceiling。值得借鉴：

### 5.1 ⭐ C++ 层修 jsdom 根问题

sdenv 维护 `sdenv-jsdom` (jsdom 的 fork)，改 C++ 源码修一些 **JS 层永远绕不过的检测**：

```javascript
// HTML5 规范规定 document.all 必须是 truthy 但 typeof === 'undefined'
typeof document.all === 'undefined' && document.all   // 真 browser: true

// 真 Chrome: typeof = 'undefined', value = HTMLAllCollection (truthy)
// 标准 jsdom: typeof = 'object', value = HTMLAllCollection   ← 一查就死
// sdenv-jsdom: 改 C++ binding 让 typeof 返 'undefined' 同时保 truthy
```

**我们 node_bridge 没做这个** — JS 层 mock 不可能 override `typeof` 行为（这是 V8/C++ 层规定的）。

**何时升级 sdenv**：碰到 `typeof document.all`、`Function.prototype.toString` 的 V8-level 检测时（见 §7）。

### 5.2 Plugin 化 env（不是单 site 写死）

sdenv 的目录结构：

```
sdenv/
├── sdenv-jsdom         ← 通用底层 fork
└── sdenv-extend/
    ├── plugins/
    │   ├── ruishu/     ← 瑞数特化 patches
    │   ├── akamai/     ← Akamai 特化
    │   └── generic/    ← 通用 (UA / screen / canvas)
```

每个 site 一个 plugin，generic 部分共享。我们对比：

```
node_bridge/ifood/px-node-env/env/     ← iFood + PX 混合，没拆开
```

**借鉴**：重构成 plugin 形式（在新站点适配时考虑）：
```
node_bridge/
├── env-core/         ← Chrome generic
├── plugins/
│   ├── px/           ← PX-specific
│   ├── akamai/       ← Akamai-specific
│   └── ifood/        ← iFood-specific
```

### 5.3 Proxy-wrapped window for dev logging

sdenv 工程化了"手段 4"（Proxy 监听）：

```javascript
// sdenv 用法
const env = createSdenv({
    window: {
        proxy: {
            logger: 'all',          // 记录所有读写
            errorOnUnknown: false   // 读未定义属性不抛错
        }
    }
});
// → 跑 SDK → 控制台流式输出所有 window/document 访问
```

**借鉴**：在我们 env/builder.js 加可选 `DEBUG_PROXY=1` 开关，开启所有 navigator/window/document Proxy 监听。

### 5.4 双轨架构（bridge + 纯算）

sdenv 配套 [rs-reverse](https://github.com/pysunday/rs-reverse)（瑞数纯算）—— **双仓**。
我们项目 = **单仓内**的 `node_bridge/` + `revers/`。

无所谓优劣，**架构同构**。

---

## 6. happy-dom / linkedom 为什么 PX 跑不通（避坑）

很多人会问 "用 happy-dom 不比 jsdom 快吗？"。**对 PX 反爬场景**它们都跑不通：

| 替代品 | 速度 | 不能用的原因 |
|---|---|---|
| **happy-dom** | 比 jsdom 快 2-3x | 缺 `MutationObserver` / `IntersectionObserver` / `PerformanceObserver` / `requestIdleCallback` 等 PX SDK 必用 API。**PX 第一行 init code 就崩**。 |
| **linkedom** | 极快（无 JS engine） | **不能跑 JS** —— 只 parse HTML。PX SDK 是 10000 行 JS，linkedom 直接读不进去。 |
| **deno_dom** | Rust 实现 | Deno 生态独立，curl_cffi / node 包都不能用。Python 协调器接不上。 |

**结论**：jsdom 是当前唯一可行的 base。要更狠的去 sdenv（jsdom fork）。再狠的去真 Chrome（puppeteer/playwright stealth）。

---

## 7. 何时升级到 sdenv ⭐

**升级决策树**：

```
跑通了？─→ 不动它（继续用我们 bridge）
   │
   ▼ 没跑通
   │
看 stderr / SDK 报错 / response body 特征：
   │
   ├── HTML px-captcha + 评分极低 → 加更多 env mock，参考 §2.3 差异比对
   │
   ├── HTML "challenge-platform / Cloudflare" → 加 BR/US 住宅代理 + UA 跟 IP 地区一致
   │
   ├── SDK 调用 `typeof document.all` 返 'object' → ⭐ 升级 sdenv
   │
   ├── SDK 调用 `Function.prototype.toString` 检测 native 代码标记 → ⭐ 升级 sdenv
   │
   ├── SDK 用 `new Proxy(window, ...)` 在 V8 引擎层检测 → ⭐ 升级 sdenv
   │
   ├── SDK 检查 `Error().stack` 调用栈含 'jsdom' → ⭐ 升级 sdenv 或改栈名
   │
   └── 评分够但 cookie 老被服务端拒 → 网络层 / TLS / IP 评分问题（curl_cffi chrome131 校准）
```

### sdenv 集成快速指南

```bash
# 1. 装 sdenv
npm install sdenv-jsdom sdenv-extend

# 2. 替换 px_node_bridge.js 顶部
# 原:
const { JSDOM } = require('jsdom');
# 改成:
const { JSDOM } = require('sdenv-jsdom');   // jsdom fork 接口兼容

# 3. 关键 stub 由 sdenv-extend 提供:
const { applyPxPatches } = require('sdenv-extend');
applyPxPatches(window);   // 这里抽象掉 px_intercept.js 的活
```

**注意**：sdenv-extend 自带的 patches 主要针对**瑞数 VMP**，PX-specific 的还是要自己写 plugin。但底层 jsdom fork 已经帮你解决 spec-quirk 类问题。

### 何时不升级

| 场景 | 不升级，继续用我们 bridge |
|---|---|
| 跑通了 + 评分够 | 不要画蛇添足 |
| iFood / Grubhub PX 中等难度 | 我们 bridge 已经足够 |
| 不愿引入新 jsdom fork 依赖 | 维护两套 jsdom 增加复杂度 |

---

## 8. 踩坑速查（来自实战）

| 现象 | 原因 | 修复 |
|---|---|---|
| `npm install canvas` 失败（MSBuild error） | Windows 缺 MSBuild | `npm install canvas@3` (有 Windows prebuild) |
| SDK 卡在 `/ns` 不发后续 POST | Node 默认 TLS != Chrome，PX 识别 abort | 必须 Python curl_cffi chrome131，**不能**直接跑 generate_px.js standalone |
| Bridge 30s timeout 不够拿 _px3 | SDK 链路 4 个 collector POST，慢链路超时 | `px_node_bridge.js` setTimeout 改大到 60s |
| Python 报 `[Errno 22] Invalid argument` | Node bridge 已 exit，Python 还在 write stdin | px_cookie_generator.py 已加 BrokenPipeError 容错 |
| 单次 curl 请求超时（15s） | 代理慢链路 + 默认 timeout 太短 | `timeout=30` |
| 首页访问 403 | 没用对应地区代理（BR for iFood, US for Grubhub） | 设 HTTPS_PROXY 为正确地区住宅 |
| Proxy 监听报"Cannot redefine property" | jsdom 把某些属性 freeze | fallback 到 `Object.defineProperty` 加 getter |
| canvas hash 跟真 Chrome 对不上 | `@napi-rs/canvas` 字体配置缺 | 加载 dejavu / liberation 字体集 |
| `Object.keys(window)` hash 错 | 缺 visualViewport / cookieStore / scheduler 等 prop | 全部补到 `env/px_intercept.js` |

---

## 9. 工作量预估（参考）

| 场景 | 工作量 | 工种 |
|---|---|---|
| 跑通 ifood/ 模板（验证环境） | 30 min | DevOps |
| **现有 ifood 改 SDK 版本（同 SDK 升级）** | 10 min | 改路径 + 替换文件 |
| **复制 ifood 模板到新站点（同 PX 厂）** | 4-8 h | 改 5 个常量 + 校准 1-2 个 env 文件 |
| **适配到新反爬厂（如瑞数）** | 1-3 天 + 考虑升级 sdenv | 写新 plugin |
| **首次为新反爬厂逆向 + 写 bridge** | 1-2 周 | 高 — 类似 sdenv 作者最初的工作量 |

---

## 10. 写好的 env/ 长什么样（参考 ifood/）

每个 env/*.js 文件应该：

1. **顶部注释**写"补什么 + 为啥要补"
2. **导出一个安装函数**（`installXxx(window)`），由 builder.js 调用
3. **打印 `[XX] installed`** 让 stderr 能看到加载顺序
4. **值用真 Chrome dump 来的 hardcode**，不要随机
5. **支持 `DEBUG=1` env var** 开启 Proxy 监听（5.3 借自 sdenv）

参考：`node_bridge/ifood/px-node-env/env/navigator.js` 是最标准的实现。

---

*方法论 v1.0 · 2026-05-22 · iFood _px3 实战跑通验证*
