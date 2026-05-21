# PerimeterX Bundle 路径完整技术文档

> **目标**：把 PX SDK 的按压挑战链路（Bundle / captcha.js / PoW / WASM）从抓包到生成可用的 `_px3` cookie 完全用纯算法复现。
>
> **输入**：iFood 或其它 PX 站点的目标 URL + bundle AppID。
> **产出**：在 Node.js 进程里稳定跑通 Bundle#1 → #2 → #3 拿到 `_px3` 的脚本。
>
> **状态**：iFood 验证 10/10；纯算端到端实现完成度约 70%，剩余 30% 是行为合成质量（鼠标轨迹池 / 错误栈跨 Chrome 版本 / WASM 常量更新）。
>
> **校验时间**：2026-05-21
>
> **配套素材**：本文档是 31 份原始文档（12000+ 行）的消化整合版。原始素材合并完后已删除（详细对照见 `bundle/README.md` "归档说明"）。
>
> **配套油猴脚本**：[`../script/userscripts/px_bundle3_auto.user.js`](../script/userscripts/px_bundle3_auto.user.js) (2131 行) —— 真正"纯算过按压"成品，10/10 实战通过。

---

## 目录

[第一部分：总览](#第一部分总览) — Bundle 触发条件、跟 Collector 的关系、4-request 流水线、两个 AppID、FT、Mobile SDK 对比

[第二部分：协议层基础](#第二部分协议层基础) — endpoints、请求结构、OB 解码、27 个 Ql handler、ih 派发器、cookie/storage、事件回调、上报系统

[第三部分：Bundle#1 完整逆向](#第三部分bundle1-完整逆向) — 触发、16 字段、`mh()` 主构造、OB#1 13 段、Bundle vs Collector 字段映射

[第四部分：Proof of Work 完整还原](#第四部分proof-of-work-完整还原) — 算法、性能、两条路径（I0I0I0 / 0II0I0）、Bs 完整源码、`poi()`、Web Worker 路径、验证实例

[第五部分：WebAssembly 集成](#第五部分webassembly-集成) — 提取（10 种路径）、a()/b() 导出、34 个 wbg imports、Node mock、ChaCha20、自定义编码

[第六部分：Bundle#2 完整逆向](#第六部分bundle2-完整逆向) — 228 字段三分类、PoW + WASM 注入、sid 隐写（含 cts 数字隐写）、anti-tamper、OB#2

[第七部分：Bundle#3 按压挑战](#第七部分bundle3-按压挑战) — **6 事件**严格顺序（含 Metrics）、PX561 95 字段（Tier 1-5）、贝塞尔轨迹、缅甸文 DOM、4 组错误栈

[第八部分：Bundle#4 fallback / telemetry](#第八部分bundle4-fallback--telemetry) — 双重身份、何时发

[第九部分：状态机 + state.\* 跨请求传递](#第九部分状态机--state-跨请求传递) — 15 个全局变量、UUID 全程不变

[第十部分：229 字段完整分类](#第十部分229-字段完整分类) — 17 类别逐个详解 + 类型分布 + 关键发现

[第十一部分：加密链 — 完整源码级](#第十一部分加密链--完整源码级) — Jf() 交织、jt() PC、it() JSON、ee() XOR、hh() sid 隐写、cs 服务器下发、完整参数来源表

[第十二部分：纯算端到端的 5 个 gap](#第十二部分纯算端到端的-5-个-gap)

[第十三部分：Userscript 实战方案](#第十三部分userscript-实战方案) — **`px_bundle3_auto.user.js`** 2131 行成品（拦截 B1/B2 + 自构 B3 + iframe Hook，纯算过按压）

[第十四部分：跨平台移植 7 步法](#第十四部分跨平台移植-7-步法)

[第十五部分：踩坑总集](#第十五部分踩坑总集)

[第十六部分：SDK 漂移应对](#第十六部分sdk-漂移应对)

[第十七部分：iFood 业务+反爬层](#第十七部分ifood-业务反爬层) — 业务接口、hook 堆栈、collect 请求链、ah 函数、cw-marketplace TLS

[第十八部分：外部资源 + Pr0t0ns v8.9.6 对照](#第十八部分外部资源--pr0t0ns-v896-对照)

[第十九部分：项目工作日志](#第十九部分项目工作日志) — 文件索引、突破时刻、ROI

[第二十部分：Mobile SDK 对比](#第二十部分mobile-sdk-对比)

[附录 A 常量速查卡](#附录-a常量速查卡) / [附录 B 调试命令](#附录-b调试命令速查) / [附录 C 跟项目其它部分的关系](#附录-c跟项目其它部分的关系)

---

# 第一部分：总览

## 1.1 Bundle 是 PX 的什么

PerimeterX 部署在客户站点有**双链路**反爬设计：

```
                       浏览器加载
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
       无感 Collector              按压 Bundle
       (sensorless)              (sensored / press challenge)
                                       │
       main.min.js                 captcha.js
       (~230 KB)                   (~480 KB + WASM ~60 KB)
              │                         │
              ▼                         ▼
       2-3 个 POST                 4 个 POST
       拿到 _px3                   + 真实按压交互
       (TTL 330s)                  拿到 _px3 (TTL 330s)
```

**Bundle 是 Collector 的 fallback**：当 Collector cookie 在业务 API 被识别为风险时，业务接口返回 403 + `blockScript` 字段指示加载 `captcha.js`，浏览器进入按压挑战。

**流量分布**：实测约 99% 流量走 Collector，1% 触发 Bundle。

## 1.2 什么时候触发 Bundle

PX 后端风险评分模型的触发条件（实测）：

| 触发条件 | 阈值 |
|---|---|
| 同 IP + UA 短窗口的请求次数 | **~200 次后**开始随机触发 |
| 同 cookie 的业务 API 调用次数 | ~100 次后概率上升 |
| 业务 API 拿到的数据顺序遍历列表（爬虫行为） | 不明确，几次就可能触发 |
| 同账号访问模式跟人类偏差大 | 模糊判断 |
| IP 落在 PX 已知数据中心段 | **立即触发** |

触发后服务端响应：

```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "blockScript": "https://client.px-cloud.net/PXO1GDTa7Q/captcha.js?v=...",
  "appId": "PXO1GDTa7Q",
  "uuid": "<session uuid>",
  "vid": "<visitor id>",
  "blockUuid": "<challenge uuid>"
}
```

浏览器通过 `<script src="...captcha.js">` 加载挑战脚本。

**触发复现工具** (`trigger_captcha.js`)：

```js
// 无限循环 POST iFood API，100ms 间隔触发挑战
async function triggerCaptcha() {
    let count = 0;
    while (true) {
        const resp = await fetch('https://cw-marketplace.ifood.com.br/v1/...', {
            method: 'POST',
            headers: { 'Cookie': '_px3=...' },
        });
        count++;
        if (resp.status === 403) {
            const body = await resp.json();
            if (body.blockScript) {
                console.log(`挑战触发！${count} 请求后`);
                console.log(`captcha.js: ${body.blockScript}`);
                return body;
            }
        }
        await sleep(100);
    }
}
```

## 1.3 Bundle 跟 Collector（无感）的关系

**完全共享的算法层**（约 70% 代码复用）：

| 算法 | Collector | Bundle |
|---|---|---|
| payload 加密链（serialize → XOR(50) → base64 → 交织） | ✅ | ✅（交织 key 用 UUID 不是 AppID） |
| PC HMAC-MD5 + 数字提取 16 位 | ✅ | ✅（FT 不同） |
| OB 响应解码（XOR + 4 个 `~` split + handler 派发） | ✅ | ✅ + 多 2 个 PoW handler |
| SID + Unicode Tag Char 隐写 | ✅ | ✅（含 cts 数字隐写） |
| UUID v1 with deterministic node | ✅ | ✅ |
| `/ns` probe | ✅ | ✅ |

**Bundle 独有的 5 件套**（约 30% 新增）：

| 算法 | 用在哪 | 复杂度 |
|---|---|---|
| **Proof of Work**（SHA-256 16-bit 暴力） | Bundle#2 | 低 |
| **WebAssembly fingerprint**（a/b 两个导出） | Bundle#2 + Bundle#3 | 高（要懂 WASM + ChaCha20） |
| **鼠标贝塞尔轨迹** | Bundle#3 PX535 | 中 |
| **Myanmar DOM 编码** | Bundle#3 PX11116 | 低 |
| **错误栈模板**（4 组） | Bundle#3 PX11116 | 中（绑 Chrome 版本） |

**核心 insight**：跑通 Collector 就懂了 Bundle 70%。剩 30% 集中在 Bundle#3 按压挑战。

## 1.4 4-request 流水线

完整时序：

```
浏览器                  Bundle Collector              captcha.wasm
   │                          │                           │
   │  ───── Bundle#1 ─────►   │                           │
   │   16 字段初始指纹         │                           │
   │   ◄────── OB#1 ──────    │                           │
   │  13 段：bundle AppID,    │                           │
   │  PoW 参数(suffix/target),│                           │
   │  qa(challenge hash),     │                           │
   │  visual config            │                           │
   │                          │                           │
   │  ── solvePow(s,t,16) ──  │                           │
   │   ~9-60ms 暴力搜索        │                           │
   │  ──────── a() ──────►    │                           │
   │   ◄── 64 hex 随机 ────── │                           │
   │  ─── b(powAnswer) ─►     │                           │
   │   ◄── 127 chars ─────── │                           │
   │                          │                           │
   │  ───── Bundle#2 ─────►   │                           │
   │   228 字段全指纹 + PoW    │                           │
   │   ◄────── OB#2 ──────    │                           │
   │   首版 _px3 (jf=cu)       │                           │
   │                          │                           │
   │  ── User press 1-3s ──   │                           │
   │  + 鼠标 544 点贝塞尔      │                           │
   │  + 4 组错误栈合成         │                           │
   │  + Myanmar DOM 编码      │                           │
   │                          │                           │
   │  ───── Bundle#3 ─────►   │                           │
   │   6 事件序列 (WebGL,      │                           │
   │   Metrics, mouseout,      │                           │
   │   PX561, onSolved,        │                           │
   │   PX11994)                │                           │
   │   ◄────── OB#3 ──────    │                           │
   │   验证通过 → 有效 _px3    │                           │
   │   (jf=success)             │                           │
   │                          │                           │
   │  ───── Bundle#4 ─────►   │                           │
   │   telemetry（可选）       │                           │
```

四个 POST 都打到**同一个端点** `https://collector-pxo1gdta7q.px-cloud.net/assets/js/bundle`，区别在 `seq=0/1/2/3` 和 `rsc=N`（注意 Bundle#2 实测 `seq=3`，因为某些会话内部有额外计数）。

## 1.5 两个 AppID 的并存关系

⚠️ **整个挑战会话期间有两个并存的 AppID**：

| AppID | 值（iFood 实例） | 用在哪 | 来源 |
|---|---|---|---|
| **Init AppID** | `PXO1GDTa7Q` | URL（`/PXO1GDTa7Q/captcha.js`、`collector-pxo1gdta7q.px-cloud.net`）；Bundle POST body 的 `appId=` 参数 | 静态嵌在 captcha.js 头部 |
| **Bundle AppID**（会话级） | `PXd6f03jmq8h6c7382req0` 或 `d6f03jmq8h6c7382req0` | EV2 payload d 字段的 appId 槽位（**不是** POST 参数那个）；存到全局变量 `$a` | OB#1 segment #3 (`II00II` handler) 动态下发 |

Init AppID 站点固定；Bundle AppID 每个挑战会话都不一样。

提取逻辑（OB#1 处理后会自动设到全局 `$a`）：

```js
function extractBundleAppId(obSegments) {
    for (const seg of obSegments) {
        const args = seg.split('|').slice(1);
        if (args.length === 1 && /^[a-z0-9]{12,30}$/.test(args[0])) {
            return args[0];   // 长 12-30 全小写字母数字 = bundle AppID
        }
    }
    throw new Error('bundle appId not found in OB#1');
}
```

> ⚠️ 旧版有人用 init AppID 填到 EV2 d 字段 → PC 算对了但 Bundle#2 拒。两个 AppID 分开用。

## 1.6 FT 在两条路径的取值

`ft` 参与 PC HMAC 的 salt（`"uuid:tag:ft"`），错就一切错。

| 路径 | FT | iFood 实例 | Pr0t0ns v8.9.6 |
|---|---|---|---|
| **无感 Collector** | `401`（当前） | `401` | `330`（旧） |
| **按压 Bundle** | **`388`** | `388` | `388` |

**直接后果**：拿 Collector 跑通的 cookie 在 Bundle 路径复用 → 拒。同样 payload + uuid + tag 在不同 FT 下 PC 不同。

跨平台时 FT 也会变。Grubhub 的 Collector FT 是 `359`。

## 1.7 整体时序约束

PX 严格校验时序：

| 阶段 | 期望时长 | PX 容忍 |
|---|---|---|
| Bundle#1 → OB#1 RTT | 100-500ms | 网络相关，宽容 |
| PoW 求解 | 9-60ms（同步） | < 1s（异步 600s+ 必爆） |
| WASM a/b 调用 | < 100ms 总和 | < 1s |
| Bundle#2 → OB#2 RTT | 100-500ms | 同 |
| 用户按压时长 | 1-3s | **0.5-5s**，超出认定机器人 |
| 鼠标轨迹时长 | = 按压时长 ±100ms | 严格匹配 |
| Bundle#3 → OB#3 RTT | 100-500ms | 同 |
| **总时长** | **10-15s** | **< 30s**（session timeout） |

**陷阱**：
1. PoW `crypto.subtle.digest` 异步实现 60ms → 600s（坑 #B5）
2. setTimeout 故意延迟 → 30s 超时（session 失效）
3. 按压 < 0.5s 或 > 5s 直接拒（坑 #B11）
4. 鼠标轨迹时间窗错位（坑 #B13）

## 1.8 历史版本变化（v8.9.6 vs v8.10+）

PX 在 2024-2026 有两个大版本：

| 维度 | v8.9.6（Pr0t0ns 时代） | v8.10+（当前 iFood） |
|---|---|---|
| OB wire 字符 | `1` / `o` | `0` / `l`（iFood）/`I` / `o`（Grubhub） |
| 字段 key | 明文 `"PX12095"` etc. | base64 编码（每次脚本加载变） |
| tag 字段 | 明文 `"v8.9.6"` | base64 `"O2MKZn0OEhI/ag=="` |
| `bi` 参数 | 无 | base64 ~100 字节硬编码 |
| OB XOR key | `gt="DhY8E0h7J2cKHw=="` → key=120 | `gt="P2cLYnkKFhY7bg=="` → key=86 |
| Bundle 字段数 | 12（Bundle#1）| 16（Bundle#1） |

跨版本对照见 [第十八部分](#第十八部分外部资源--pr0t0ns-v896-对照)。

## 1.9 Bundle 跟 Mobile SDK 的差异（PX 全家桶）

PX 有 Web SDK + Mobile SDK（Android/iOS）两套，**算法层完全不同**：

| 维度 | Web SDK | Mobile SDK |
|---|---|---|
| AppID | `PXO1GDTa7Q` | `PXO97ybH4J`（Grubhub mobile）等 |
| 端点 | `/api/v2/collector` 或 `/assets/js/bundle` | `/api/v1/collector/mobile` |
| Payload 类型 | PX12095/PX11590/PX11547 | PX315/PX329 |
| 加密 | XOR(50) + base64 + 交织 | base64（无 XOR、无交织） |
| PoW | SHA-256 暴力搜索 | 数学运算 switch-case（见 §20） |
| WASM | 嵌入在 captcha.js | 无 WASM |
| TLS | Chrome TLS | okhttp3 TLS |

本文档**只讲 Web SDK**。Mobile SDK 简要对比见 [第二十部分](#第二十部分mobile-sdk-对比)。

---

# 第二部分：协议层基础

## 2.1 Endpoint 清单

iFood 实例：

| 端点 | URL | 内容 |
|---|---|---|
| **captcha.js** | `https://client.px-cloud.net/PXO1GDTa7Q/captcha.js?v=…` | ~480 KB，含 WASM base64 |
| **WASM** | `captcha.js` 内嵌（base64 in `Us()[10]`） | `px_captcha.wasm`, ~60862 字节 |
| **Bundle Collector** | `https://collector-pxo1gdta7q.px-cloud.net/assets/js/bundle` | 4 个 POST 都打这里 |
| **Sensorless Collector** | `https://collector-pxo1gdta7q.px-cloud.net/api/v2/collector` | 无感路径用，参考 |
| **`/ns` probe** | `https://tzm.px-cloud.net/ns?c={appId}` | 跟无感共用 |
| **客户端 main.min.js** | `https://client.px-cloud.net/PXO1GDTa7Q/main.min.js` | 约 10653 行混淆代码 |

跨平台时 Bundle Collector hostname 跟 Collector 是一组（`collector-{appid lower}.px-cloud.net`），但**路径不同**：`/assets/js/bundle` vs `/api/v2/collector`。

## 2.2 通用请求结构 + 完整参数来源表

每个 Bundle POST 格式：

```http
POST /assets/js/bundle?seq=N&rsc=M HTTP/1.1
Host: collector-pxo1gdta7q.px-cloud.net
Content-Type: application/x-www-form-urlencoded
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36
Origin: https://www.ifood.com.br
Referer: https://www.ifood.com.br/
sec-ch-ua: "Not:A-Brand";v="99", "Microsoft Edge";v="145", "Chromium";v="145"
sec-ch-ua-mobile: ?0
sec-ch-ua-platform: "Windows"
sec-fetch-dest: empty
sec-fetch-mode: cors
sec-fetch-site: cross-site

payload=<base64>&appId=PXO1GDTa7Q&tag=<tag>&uuid=<uuid>&ft=388&seq=N&en=NTA&bi=<bi>&pc=<16digit>&...&rsc=M
```

⚠️ **POST 参数顺序敏感**（部分 PX 子系统按字面顺序做 hash）。Bundle 实测顺序：

```
seq=0 / rsc=1:  payload, appId, tag, uuid, ft, seq, en, bi, pc, sid, vid, cts, rsc
seq=1 / rsc=2:  payload, appId, tag, uuid, ft, seq, en, bi, cs, pc, sid, vid, cts, ci, rsc
seq=2 / rsc=3:  同上
seq=3 / rsc=4:  payload, ..., errorPayload, rsc
```

**完整参数来源表**：

| 参数 | 含义 | 来源 | main.js 变量 |
|---|---|---|---|
| `payload` | 加密 EV 数组（XOR/b64/Jf 交织） | `Jf(events, config)` 客户端 | `v` |
| `appId` | Init AppID | 配置 | `e[yn]` |
| `tag` | PX TAG（base64）| 脚本硬编码 | `e[bn]` = `"O2MKZn0OEhI/ag=="` |
| `uuid` | 会话 UUID v1（全程不变） | `Xa()` 客户端 | session 级 |
| `ft` | Bundle = 388 | 配置 | `e[In]` = `388` |
| `seq` | 0/1/2/3 | 客户端计数器 | `ph++` |
| `en` | `NTA` 固定（base64 of "50"，即 XOR key 声明）| 固定 | — |
| `bi` | bundle info 常量（~100 字节 base64）| 脚本硬编码 | `It` = `"GwNqS048KWpd..."` |
| `cs` | challenge hash（state.qa）| **服务器 OB#1 III000 handler 下发** | `Ho()` = `qa` |
| `pc` | 16 位数字 checksum | HMAC-MD5 客户端 | `jt(it(events), "uuid:tag:ft")` |
| `sid` | UUID + Unicode Tag 隐写（cts 数字）| 客户端 | `uuid + hh(ni())` |
| `vid` | visitor ID | 客户端 / cookie | `Tt()` |
| `ci` | challenge ID | 服务器下发 | `as()` |
| `cts` | client timestamp（首请求 UUID，后续 ms timestamp） | 客户端 | `Ua` |
| `rsc` | request sub-counter（1/2/3/4）| 客户端递增 | `++Cm` |
| `errorPayload` | 错误上报 | 仅 Bundle#4 | — |
| `/ns token` | GET `/ns?c={appId}` 返回值 | 网络指纹 | `Sm` → payload 字段 |

> 💡 `cs` 不是客户端算的（很多新手以为是），是 OB#1 的 `III000` handler 把服务器下发的 challenge hash 存到全局 `qa`，客户端只是回放。详见 [§11.7](#117-cs-是服务器下发不是客户端算)。

## 2.3 OB 响应解码完整流程

OB 解码跟 Collector 沿用同一套，但 Bundle 多 2 个 handler。完整流程：

```
JSON 响应
  │
  ├── 检查 .do 字段（优先）
  ├── 检查 .ob 字段
  │
  ▼ Step 1: Base64 decode
atob(obValue)
  │
  ▼ Step 2: XOR 解码
ee(decoded, key=xorKey)
  │
  ▼ Step 3: 分割
xored.split("~~~~")        // 4 个波浪号！
  │
  ▼ Step 4: 解析每段
segment.split("|")
  → fields[0] = handler key（shift 取出，丢弃）
  → fields[1..] = 参数列表
  │
  ▼ Step 5: 派发到 ih()
ih(segments, isDo=false)
  → 按形状识别 handler
  → 执行 handler，设置全局状态
```

### 2.3.1 XOR key 是动态算出来的，不是常量

```js
// ml(): 哈希函数 → 3 位数字字符串
function ml(t) {
    for (var e = 0, n = 0; n < t.length; n++) {
        e = (31 * e + t.charCodeAt(n)) % 2147483647;
    }
    return (e % 900 + 100).toString();
}

// Et() 返回 gt 常量（每脚本版本不同）
function Et() {
    return "DhY8E0h7J2cKHw==";   // 旧版 → key=120
    // 或 "P2cLYnkKFhY7bg==" → key=86
    // 或 "U0MmDhUmOnhXSw==" → iFood 当前 key=100
    // 或 "FmYgK1gdJEAP" → Grubhub key=91
}

// XOR key 计算
var xorKey = parseInt(ml(Et()), 10) % 128;
```

⚠️ 写死 `xorKey=120` 会在 SDK 升级后跪。生产中**每次解码都重新算**。

### 2.3.2 分隔符是 4 个波浪号（不是 3 个）

```
"~~~~" = 0x7E 0x7E 0x7E 0x7E
XOR(120) 前的原始字节: 0x06 0x06 0x06 0x06
```

代码：
```js
const segments = decoded.split("~~~~");   // ⭐ 必须 4 个 ~
```

### 2.3.3 Handler key 在段首（shift 不是 pop）

```js
// 每段格式: "handlerKey|arg1|arg2|..."
for (const seg of segments) {
    const fields = seg.split("|");
    const handlerKey = fields.shift();   // ⭐ shift 取首字段
    const args = fields;                  // 剩下是 args
    // ...
}
```

### 2.3.4 完整 decodeOb 伪代码

```js
function decodeOb(responseJson, tag) {
    const xorKey = parseInt(ml(tag), 10) % 128;
    const data = JSON.parse(responseJson);
    const obBase64 = data.do || data.ob;
    if (!obBase64) return { segments: [], state: {} };

    const raw = Buffer.from(obBase64, 'base64').toString('binary');   // ⚠️ binary 不是 utf-8
    const decoded = xorString(raw, xorKey);
    const segments = decoded.split('~~~~');

    return { xorKey, segments };
}
```

## 2.4 27 个 Ql Handler 注册表

OB segments 通过 `ih()` 派发到 `Ql` 注册表（`main.js:3933-4239`）。Bundle 路径**用 27 个 handler，再加 2 个 PoW handler，共 29 个**。完整表：

### 2.4.1 状态设置类（6 个）

| Handler key | 调用函数 | 参数 shape | 效果 |
|---|---|---|---|
| `I0I000` | `jf = t` | (flag) | `jf = "cu"`（cu=继续按压, success=完成） |
| `0IIII0` | `fh(t, e)` | (sessionId, extra) | `to = t, eo = e` |
| `0III0I0I` | `ch(t)` | (timestamp_ms) | `no = t, ro = Math.floor(t/1000)` |
| `II00II` | — | (appId) | `$a = t`（**bundle AppID**） |
| `0III0I00` | `ah(t)` | (statusCode) | `ao = t`（如 `"401"`） |
| `III000` | — | (hash) | `qa = t`（**challenge hash, 64 hex**） |

### 2.4.2 PoW / 挑战类（3 个）

| Handler key | 调用函数 | 参数 shape | 效果 |
|---|---|---|---|
| `I0I0I0` | `PX1135 = Bs` | (enabled, suffix, targetHash, difficulty, isTrusted) | **直接调用 Bs 求解 PoW**（主路径） |
| `0II0I0` | `qu → os → Bs` | (enabled, uuid, port, challengeData, extra, tag) | **via qu() 调用 PoW**（备用路径） |
| `0II0III0` | — | (startW, startH, wJump, hJump, hash) | **视觉挑战参数 PX12634**（拼图） |

### 2.4.3 Cookie / Storage 类（7 个）

| Handler key | 调用函数 | 参数 shape | 效果 |
|---|---|---|---|
| `IIIIII` | `Xr(true, {...})` | (featureName, ttl, args) | 存储 cookie 配置到 `Mr[ff]` |
| `III0II` | **`oh()`** | (name, ttl, value, secure, maxAge) | ⭐ **写入 _px3 cookie** |
| `II0III` | — | (configStr) | 解析 `"key:val,key:val"` 配置 |
| `I0III0` | `rh()` | (value) | localStorage 写入 |
| `0III0II0` | `hr + Ao` | (key, ttl, value, param, extra) | 存储 TTL + 触发 `"si"` 事件 |
| `0II0II0I` | — | (value) | localStorage 写入（#2） |
| `I000II` | `sr(go)` | (cookieName) | **删除指定 cookie** |

### 2.4.4 DOM / 导航类（4 个）

| Handler key | 调用函数 | 参数 shape | 效果 |
|---|---|---|---|
| `IIII00` | — | (id, tagName, name, className) | 创建隐藏 DOM 蜜罐 |
| `00I0I0` | — | (url, ttl, param) | 重定向 / 导航 |
| `000II0` | — | (flag) | URL 加时间戳或 reload |
| `0II0IIII` | — | (scriptUrl) | 动态加载 `<script>` |

### 2.4.5 事件 / 控制类（5 个）

| Handler key | 调用函数 | 参数 shape | 效果 |
|---|---|---|---|
| `I0I00I` | `Ao.trigger` | (event, ...args) | 触发事件回调（"sc"/"si"） |
| `00II00` | `Rf("report")` | (type, data, code) | 上报日志 |
| `0III00I0` | `PX764` | (data) | `$u` 调用 |
| `IIIII0` | — | — | PX 控制（`th=true`） |
| `I000I0` | `Gf()` | — | 重置 |

### 2.4.6 无操作（2 个）

| Handler key | 调用 |
|---|---|
| `0I0II0` | noop |
| `0II00I` | noop |

### 2.4.7 Handler key 命名规则

- 用 `I` 和 `0` 组成（**iFood 当前**；老版用 `1` 和 `o`）
- 长度：**6 字符或 8 字符**
- 6 字符：`I0I000`, `0IIII0`, `III0II`, `IIIIII`, `II00II`, `II0III`, `III000`, `I0III0`, `IIII00`, `00I0I0`, `I0I00I`, `00II00`, `000II0`, `0I0II0`, `0II00I`, `I000I0`, `I000II`, `IIIII0`, `I0I0I0`, `0II0I0`
- 8 字符：`0III0I0I`, `0III0I00`, `0II0III0`, `0III0II0`, `0III00I0`, `0III0000`, `0II0IIII`, `0II0II0I`

⚠️ **handler key 字符跨版本会变**（Grubhub 用 `I/o`，老 iFood 用 `1/o`）。识别**按 args shape**，不按 key 字符串。

## 2.5 ih 段处理器 + "cc" 延迟机制

ih（`main.js:4310-4339`）是 OB 段派发器：

```js
function ih(segments, isDo) {
    // isDo=false → Ql 注册表 (ob 响应)
    // isDo=true  → jl 注册表 (do 响应)
    var registry = isDo ? jl : Ql;
    var deferred = null;
    var queue = [];

    for (var i = 0; i < segments.length; i++) {
        var fields = segments[i].split("|");
        var handlerKey = fields.shift();   // 第一个字段
        var handler = registry[handlerKey];

        // ⭐ "cc" 延迟标记
        if (fields[0] === "cc") {
            deferred = {key: handlerKey, args: fields};
            continue;
        }

        if (typeof handler === "function") {
            queue.push({key: handlerKey, args: fields});
        }
    }

    if (deferred) queue.unshift(deferred);   // cc 段放到最前面

    for (var j = 0; j < queue.length; j++) {
        registry[queue[j].key].apply(ctx, queue[j].args);
    }
}
```

### 2.5.1 "cc" 机制详解

```
来源: Rr[Te] = J("Y2M=") → atob("Y2M=") → "cc"

作用: 当段的第一个参数是 "cc" 时:
  1. 该段从正常队列移除
  2. 存为 deferred
  3. 执行前 unshift 到队列头 → 最先执行

实际效果: I0I000 段 (jf="cu") 标记 "cc"，所以它在所有其他段之前执行
```

### 2.5.2 执行顺序示例（Bundle#1）

```
原始 OB 段顺序: [段0(cc), 段1, 段2, ..., 段9(cc), 段10, 段11, 段12]

ih() 处理后队列:
  - 只有最后一个 "cc" 段被 deferred（前面的被覆盖）
  - 段0 cc(I0I000) 跟段9 cc(IIIIII) 都是 cc → 段9 覆盖段0
  - 最终: [段9(unshift到头), 段1, 段2, ..., 段8, 段10, 段11, 段12]
```

### 2.5.3 do vs ob

- `.do` → `jl` 注册表（do segments，PX 内部错误/控制流）
- `.ob` → `Ql` 注册表（正常 OB segments）

Bundle 主路径只用 `.ob`。`.do` 在 Bundle#4 fallback 时偶尔出现。

## 2.6 全局状态变量完整表

OB handlers 执行后设置一堆全局变量，组成"会话状态"。完整表：

### 2.6.1 由 Handler 设置的变量（main.js 全局）

| 变量 | 设置者 handler | 类型 | 示例值 | 用途 |
|---|---|---|---|---|
| `jf` | `I0I000` | string | `"cu"` / `"success"` | 控制标志 |
| `to` | `0IIII0` | string | `"41916095560041989364"` | Session / Tracking ID（19-20 位数字） |
| `eo` | `0IIII0` | string | — | `fh` 第二参数 |
| `no` | `0III0I0I` | string | `"1771962830422"` | **服务器时间戳（ms）** — Jf 交织 key |
| `ro` | `0III0I0I` | number | `1771962830` | 时间戳（秒） |
| `ao` | `0III0I00` | string | `"401"` | HTTP 状态码 |
| `qa` | `III000` | string | `"4481f3...03bc"` | **Challenge hash (SHA-256)** — 用作 `cs=` |
| `$a` | `II00II` | string | `"d6f03jmq8h6c7382req0"` | **Bundle AppID** |
| `Lu` | `0II0I0` | string | `"8a213f60-..."` | PoW UUID |
| `Mr` | `IIIIII / II0III` | object | `{cc:"...", rf:"1"}` | Cookie 配置存储 |

### 2.6.2 由 Collector 设置的变量

| 变量 | 来源 | 类型 | 用途 |
|---|---|---|---|
| `bt` | VID cookie | string | Visitor ID |
| `mt` | 时间戳 | string | 时间戳字符串 |

### 2.6.3 PoW 内部变量

| 变量 | 位置 | 类型 | 用途 |
|---|---|---|---|
| `Es` | captcha.js | string | PoW 答案（candidate） |
| `Js` | captcha.js | number | PoW 耗时（ms） |

### 2.6.4 状态在哪个请求拿到、注入哪里（一图）

```
Bundle#1 ──► (payload 用默认 no = 1604064986000)
              │
              ▼
         OB#1 提取：
         ─ state.no          ──►┐
         ─ state.appId       ──►│
         ─ state.qa          ──►│
         ─ state.to          ──►│
         ─ state.pxsid       ──►│ Bundle#2 (注入)
         ─ state.vid         ──►│
         ─ state.cts (UUID)  ──►│
         ─ pow.suffix        ──►│
         ─ pow.target        ──►┘
                  │
                  ▼ 本地算 PoW + WASM
                  ▼
Bundle#2 ──► (payload 用 state.no 交织, 注入所有 state, PoW, WASM)
              │
              ▼
         OB#2 提取/更新：
         ─ _px3 (first版)
         ─ state.cts (升级为 ms)
         ─ jf=cu 或 success
                  │
                  ▼ 用户按压（或合成）
                  ▼
Bundle#3 ──► (注入所有 state, PoW, WASM, 鼠标, 错误栈, DOM)
              │
              ▼
         OB#3 提取：
         ─ _px3 (有效版)
         ─ jf=success
                  │
                  ▼
Bundle#4 ──► (telemetry，可选)
```

⚠️ **整个会话用同一个 UUID v1**（Bundle#1-#4 + WASM `globalThis._pxUuid`）。一旦不一致 PX 后端 state.pxsid 跟 uuid 关系断 → 拒。

## 2.7 Cookie / Storage 机制

PX 不只写 `_px3`，还动态写一堆配置 cookie 和 localStorage 项。完整函数：

### 2.7.1 `hr()`: Cookie 写入（`main.js:1012-1034`）

```js
function hr(cookieName, ttl, value, domain) {
    // ttl: 数字(秒) 或日期字符串
    var maxAge = String(ttl);
    var expires = new Date(Date.now() + 1000 * ttl).toUTCString();

    var cookie = cookieName + "=" + value
        + "; max-age=" + maxAge
        + "; expires=" + expires
        + "; path=/";

    if (domain === true || domain === "true") {
        cookie += "; domain=." + er();   // er() 返回顶级域名（"ifood.com.br"）
    }

    cookie += "; " + lr();   // lr() 返回 SameSite 等配置（"SameSite=Lax"）

    document.cookie = cookie;
}
```

### 2.7.2 `sr()`: Cookie 删除（`main.js:1002-1005`）

```js
function sr(cookieName) {
    hr(cookieName, -90000, '', true);    // 带 domain 删除
    hr(cookieName, -90000, '', false);   // 不带 domain 删除
}
```

### 2.7.3 `Xr()`: Cookie 配置存储（`main.js:1171-1187`）

```js
function Xr(isFlag, config) {
    // config = {ff: featureName, ttl: seconds, args: value}
    Mr[config.ff] = isFlag ? config.args : '1';

    if (config.ttl > 0) {
        // 存入 localStorage key="px-ff"
        // Sr("px-ff", { [config.ff]: { ttl: Date.now() + ttlMs, val: value } })
    }
}
```

`Mr` 是全局 dict，存 PX feature flags：`{cc: "U2FtZVNpdGU9TGF4Ow==", rf: "1", fp: "1", ccc: "0", ic: "0", nf: "0", ai: "0"}`。

### 2.7.4 `oh()`: 设置 _px3 cookie（`main.js:4276-4309`）

```js
function oh(cookieName, ttl, cookieValue, secure, maxAge) {
    // 1. 触发 "sc" 事件
    Ao.trigger("sc", cookieValue, cookieName, ttl, maxAge);

    // 2. 写入 cookie
    hr(cookieName, ttl, cookieValue, secure === "true");

    // 3. 同时存入 localStorage
    //    key: "x-px-cookies"
    //    value: JSON.stringify({_px3: cookieValue})
}
```

### 2.7.5 localStorage 交互

```
写入点:
  ─ I0III0 handler  → zl.setItem(Io, value)     // Io = 某个 key
  ─ 0II0II0I handler → zl.setItem(So, value)    // So = 某个 key
  ─ oh()             → localStorage["x-px-cookies"] = {_px3: value}

读取点:
  ─ Cookie hook (cookie_hook.js) 用 Tampermonkey 拦截 document.cookie setter
  ─ 当 cookie name === "_px3" 时断住并打印堆栈
```

### 2.7.6 _px3 Cookie 完整结构

```
格式: hash:base64data:ttl:signature

示例:
  "2d8e5e:aGVsbG8=:330:c2lnbg=="
   └hash └data       └ttl └sig

实际从 OB#2 解出的:
  "2f7b7d4363ccd1fe727a848bd37b9685cab01f55f7030661c29873dc6f064996:1bj7B/n4Yx3U..."
   └─── 64 hex (SHA-256) ─────────────────────────────────────── └ base64 data
```

⚠️ Cookie 有 TTL（`_px3` = 330s）。长跑任务必须主动 refresh（坑 #33）。

## 2.8 事件回调系统 Ao + 上报系统 Rf

### 2.8.1 Ao 定义（`main.js:891-928`）

```js
const Ao = {
    channels: {},

    on(event, fn, ctx)  { this.subscribe(event, fn, ctx, false); },
    one(event, fn, ctx) { this.subscribe(event, fn, ctx, true); },
    off(event, fn)      { /* 移除监听 */ },

    subscribe(event, fn, ctx, once) {
        this.channels[event] = this.channels[event] || [];
        this.channels[event].push({fn, ctx, once});
    },

    trigger(event, ...args) {
        var handlers = this.channels[event];
        if (!handlers) return;
        var remaining = [];
        while (handlers.length > 0) {
            var h = handlers.shift();
            h.fn.apply(h.ctx, args);
            if (!h.once) remaining.push(h);
        }
        this.channels[event] = remaining;
    }
};
```

### 2.8.2 事件列表

| 事件名 | 触发者 | 参数 | 用途 |
|---|---|---|---|
| `"sc"` | `oh()` / `III0II` handler | (cookieValue, name, ttl, maxAge) | Cookie 设置完成 |
| `"si"` | `0III0II0` handler | (value, key, ttl, extra) | 存储完成 |
| 自定义 | `I0I00I` handler | (event, ...args) | 动态触发 |

### 2.8.3 上报系统 Rf

```js
let If = 0;       // 递增序号
const Sf = [];    // 发送队列
const Tf = [];    // 待发送队列

function Rf(type, data) {
    data["ZHgWeiIcE0o="] = If++;             // 序号（base64 key）
    data["GU1rT18laH0="] = Date.now();       // 时间戳
    // 判断 wf(type, data) 是否可立即发送
    // 可以 → Sf, 否则 → Tf
    Sf.push({t: type, d: data, ts: Date.now()});
}
```

`Rf("report", ...)` 由 `00II00` handler 触发，用来给 PX 后端上报客户端状态（错误、performance、行为）。

---

# 第三部分：Bundle#1 完整逆向

## 3.1 触发与请求构造

Bundle#1 是 `captcha.js` 加载完成后发的第一个 POST。脚本入口：

```
captcha.js 加载完成
  → 执行 IIFE 自启动
  → 创建 window._O1GDTa7Qhandler 全局对象
  → 调用 mh() 主构造函数
  → mh() 生成 16 字段初始指纹
  → 调用 collect() 发 Bundle#1
```

完整 HTTP 请求：

```http
POST /assets/js/bundle?seq=0&rsc=1 HTTP/1.1
Host: collector-pxo1gdta7q.px-cloud.net
Content-Type: application/x-www-form-urlencoded
Origin: https://www.ifood.com.br
Referer: https://www.ifood.com.br/
sec-ch-ua: "Not:A-Brand";v="99", "Microsoft Edge";v="145", "Chromium";v="145"
sec-ch-ua-mobile: ?0
sec-ch-ua-platform: "Windows"
sec-fetch-dest: empty
sec-fetch-mode: cors
sec-fetch-site: cross-site
user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...

payload=<base64+Jf 交织>&appId=PXO1GDTa7Q&tag=O2MKZn0OEhI/ag==&uuid=eb30dfdf-11c5-11f1-9781-bac43f3b40b0&ft=388&seq=0&en=NTA&bi=GwNqS048KWpd...&pc=9751268234020178&sid=51338389-11b8-11f1-bb6d-13e608bfecce&vid=51337cf3-11b8-...&cts=513385fa-11b8-...&rsc=1
```

⚠️ `cts` 在 Bundle#1 是 UUID 格式；Bundle#2 起变成 ms timestamp（坑 #27）。

Bundle#1 的 payload 用**默认 serverNo `1604064986000`** 做交织 key（OB#1 还没回来）。

## 3.2 Bundle#1 vs Collector#1 参数对照

iFood 实测：

| 参数 | Collector | Bundle | 差异 |
|---|---|---|---|
| URL | `/api/v2/collector` | `/assets/js/bundle` | 不同端点 |
| `ft` | `401` | `388` | 不同 |
| `tag` | base64 (v8.10+) 或 `"v8.9.6"`（v8.9.6） | `"O2MKZn0OEhI/ag=="` (base64) | 不同 |
| `bi` | 无 | base64 ~95 bytes | Bundle 独有 |
| `payload` | XOR(50) + base64 + 20 字符交织 | XOR(50) + base64 + **Jf() 交织** | Bundle 交织 key 用 UUID |
| `sid` | 纯 UUID | UUID + **隐写 cts 数字** | Bundle 附加 Unicode Tag |
| 字段数 | 12（Collector #1） | 16（Bundle #1） | Bundle 多 4 个 |

> Collector 的 PX12095 payload 12 个字段都是 Bundle Payload 的前 12 个；Bundle 多 4 个：`PX key 引用` + `_pxhd cookie 类型` + `布尔标志` + `_pxhd cookie 值（~665 字节）`。

## 3.3 Payload 16 字段详解

Bundle#1 的 EV 数组只有 16 个字段（轻量初始指纹）。`t` 字段是 payload 类型标识（base64 编码，类似 Collector 的 `"PX12095"`）：

```json
[{
  "t": "GU1oT1wgZ3g=",
  "d": {
    "WQ0oDx9mKjg=": "https://www.ifood.com.br/restaurantes",
    "Fm4nbFMBIVk=": 1,
    "EFQhFlU9Iiw=": "Win32",
    "KDxZPm5YXw4=": 0,
    "MVUAV3c9AGU=": 3182,
    "Y1tSWSY0UGM=": 3600,
    "InpTeGQUXU8=": 1771967721486,
    "eW1ILzwCRh0=": 1771967721493,
    "FUlkS1Mga38=": "eb30dfdf-11c5-11f1-9781-bac43f3b40b0",
    "R382PQIXNgs=": null,
    "MkpDCHciQz8=": 0,
    "OS0Ib39DCVQ=": false,
    "fEANAjkuCzc=": "PX11745",
    "TTE8cwtaPEk=": "pxhc",
    "EFQhFlU6Iyw=": false,
    "LVEcU2g7GmI=": "a088cf8a...cookie_value...:1000:signature"
  }
}]
```

### 3.3.1 字段映射 (Bundle vs Collector PX12095)

| # | Bundle Key (base64) | 值示例 | 对应 Collector PX Key | 含义 |
|---|---|---|---|---|
| 0 | `WQ0oDx9mKjg=` | `"https://www.ifood.com.br/..."` | PX11645 | 当前页面 URL |
| 1 | `Fm4nbFMBIVk=` | `1` | PX12207 | 标志位 |
| 2 | `EFQhFlU9Iiw=` | `"Win32"` | PX12458 | `navigator.platform` |
| 3 | `KDxZPm5YXw4=` | `0` | PX11902 | 请求计数器 |
| 4 | `MVUAV3c9AGU=` | `3182` | PX11560 | 随机值 (2809-3809) |
| 5 | `Y1tSWSY0UGM=` | `3600` | PX12248 | 固定值（TTL 1h?） |
| 6 | `InpTeGQUXU8=` | `1771967721486` | PX11385 | 起始时间戳（ms） |
| 7 | `eW1ILzwCRh0=` | `1771967721493` | PX12280 | 结束时间戳（ms, +7） |
| 8 | `FUlkS1Mga38=` | `"eb30dfdf-..."` | PX11496 | 会话 UUID |
| 9 | `R382PQIXNgs=` | `null` | PX12564 | 空值 |
| 10 | `MkpDCHciQz8=` | `0` | PX12565 | 计数器（Collector 是 -1） |
| 11 | `OS0Ib39DCVQ=` | `false` | PX11379 | 布尔标志 |
| **12** | `fEANAjkuCzc=` | `"PX11745"` | **无** | ⭐ **PX key 引用** |
| **13** | `TTE8cwtaPEk=` | `"pxhc"` | **无** | ⭐ **_pxhd cookie 类型** |
| **14** | `EFQhFlU6Iyw=` | `false` | **无** | ⭐ **布尔标志** |
| **15** | `LVEcU2g7GmI=` | `"a088cf8a...:...:1000:..."` | **无** | ⭐ **_pxhd cookie 值（665 字节）** |

### 3.3.2 关键发现

- 前 12 字段跟 Collector PX12095 **完全一致**
- Bundle 额外 4 字段：PX key 引用、pxhd 类型、标志、`_pxhd` cookie 值
- JSON key 都是 base64 编码（每次 PX 脚本加载会变）
- `"t"` 字段是 payload 类型标识（base64，类似 Collector 的 `"PX12095"`）

## 3.4 `mh()` 主构造函数（main.js:4384）

Bundle POST 参数都是 `mh(events, config)` 组装出来的。完整逻辑：

```js
function mh(events, config) {
    // 1. 为每个事件注入运行时数据
    for (event of events) {
        event.d["MDRCNnZaQA0="] = kt;           // blockScript 标志
        event.d["NSkHa3BHAl4="] = es();         // risk level（如果有）
        event.d["U0shSRYgJX4="] = Xl();         // isAsync
        event.d["FCgmKlFDIRg="] = Bl();         // getRiskRules
        event.d["HwdtBVlsbj8="] = Ca();         // module type
        event.d["bRFfEyh/Xik="] = jo();         // isFirstParty
        event.d["HmYsZFsMKVU="] = cr("_px3");   // _px3 cookie 当前值
    }

    // 2. 计算 cs 和 pc
    l = Ho();                                    // cs = qa（OB 服务器下发）
    h = jt(it(events), [uuid, tag, ft].join(":"));   // pc = HMAC-MD5(salt, JSON)

    // 3. 构造加密 payload
    v = Jf(events, {vid, tag, appID, cu:uuid, cs:l, pc:h});

    // 4. 组装 POST 参数数组
    p = [payload=v, appId, tag, uuid, ft, seq++, en="NTA", bi];
    if (cs) p.push("cs=" + l);
    if (pc) p.push("pc=" + h);
    p.push("sid=" + uuid + hh(ni()));            // sid + 隐写
    p.push("vid=" + vid, "ci=" + ci, "pxhd=" + pxhd, "cts=" + cts, ...);
    p.push("rsc=" + (++Cm));

    return p;
}
```

### 3.4.1 cs 是怎么算的 → 服务器下发

```
OB#1 响应 → atob → XOR(120) → split("~~~~")
   → segment[5] = III000 handler
      → qa = challenge_hash  （64 hex chars，SHA-256）

mh() 调用时:
   l = Ho() → return qa
   p.push("cs=" + l)
```

⚠️ **cs 不是客户端算的**。看到 `cs=64hex` 不要试图 SHA-256 自己算 —— 算不出来的。

### 3.4.2 pc 算法（HMAC-MD5 变体，main.js:596）

```js
// jt(data, salt) — line 596
function jt(t, e) {
    n = R(t, e);   // = hex(HMAC-MD5(salt=e, data=t))，32 hex chars

    // 处理每个字符:
    //   digit (0-9, ascii 48-57) → 原样保留到 digits
    //   letter (a-f) → charCode % 10 追加到 nums
    //     (a→7, b→8, c→9, d→0, e→1, f→2)
    // 拼接: result = digits + nums
    // 间隔取: result[0] + result[2] + result[4] + ...
    return processed;   // ~16 位
}

// 调用: jt(it(events), "uuid:tag:ft")
// Bundle 实际 salt = "eb30dfdf-11c5-11f1-...:O2MKZn0OEhI/ag==:388"
```

⚠️ `it()` 是 PX 自定义 JSON serialize，**不是** `JSON.stringify`（坑 #9）。详见 [§11.4](#114-自定义-json-序列化-it)。

### 3.4.3 sid 隐写编码（main.js:4366）

```js
// hh(t): 将字符串编码为 Unicode Tag Characters
function hh(t) {
    return t.split("").reduce((acc, ch) => {
        var hex = ch.codePointAt(0).toString(16).padStart(2, "0");
        return acc + unescape("%uDB40%uDC" + hex);   // U+E0000 系列
    }, "");
}

// ni() 返回 no（OB#1 给的 serverNo 时间戳）
// sid = uuid + hh(no)
//
// 实际抓包观察 sid 后含 cts 数字编码:
//   U+E0131='1', U+E0132='2', ..., U+E0139='9', U+E0130='0'
//
// 完整例子:
//   sid = "51338389-11b8-11f1-bb6d-13e608bfecce"
//       + U+E0131 U+E0137 U+E0137 U+E0131 U+E0139 U+E0136 U+E0137 U+E0137 U+E0132 U+E0138 U+E0134 U+E0133 U+E0134
//
//   解码后是 "1771967728434" — 就是 cts 时间戳!
```

⚠️ Python `requests` 默认会丢 Unicode Tag Char。用 `urllib.parse.quote_plus(sid, safe='')` 显式编码（坑 #E5）。

## 3.5 OB#1 响应解码（13 段完整解析）

iFood 实测 Bundle#1 → OB#1 一般含 13 个 segments。完整解析（用实抓数据举例）：

```
原始响应: {"do":null,"ob":"MUgxSEhIBBsNBgYGBkgxMTExSARMSUFJTkhBTU1O..."}
解码: base64 → XOR(xorKey) → split("~~~~") → 13 段
```

### 3.5.1 段 0: `I0I000|cc|cu`

```
→ handler: I0I000 (jf 设置)
→ "cc" 延迟标记 → unshift 到队头执行
→ jf = "cu"   (cu = 继续按压, 待 captcha 完成)
```

### 3.5.2 段 1: `0IIII0|41916095560041989364`

```
→ handler: 0IIII0 (fh 函数)
→ to = "41916095560041989364"
```

### 3.5.3 段 2: `0III0I0I|1771962830422`

```
→ handler: 0III0I0I (ch 函数)
→ no = "1771962830422"   (毫秒时间戳)
→ ro = 1771962830        (秒，floor(no/1000))
```

### 3.5.4 段 3: `II00II|d6f03jmq8h6c7382req0`

```
→ handler: II00II
→ $a = "d6f03jmq8h6c7382req0"   (Bundle AppID)
```

### 3.5.5 段 4: `0III0I00|401`

```
→ handler: 0III0I00 (ah 函数)
→ ao = "401"   (状态码字符串)
```

### 3.5.6 段 5: `III000|4481f3f71e53718b3e58d5ac1bc5cedf49ea4e0e4a8db4a2dfa2c81ea0d203bc`

```
→ handler: III000
→ qa = 64 字符 SHA-256   (这就是 cs 的来源！)
```

### 3.5.7 段 6: `0II0III0|27|57|1|4|440be290d8e710ca5c9024316a6f6c25bb6fef14a42ec2eca1efdd04c53c2490`

```
→ handler: 0II0III0 (视觉挑战参数 PX12634)
→ startWidth = 27
→ startHeight = 57
→ wJump = 1
→ hJump = 4
→ hash = SHA-256
```

### 3.5.8 段 7: `I0I0I0|1|ab317b680dfb5a3dc7c52a4fefedce5adb20cedd066ce5408ce6887aee9c|7bb57f904e7b938c8442e522a97d754d23a35964a1030857244c7d2c803a1169|16|false`

```
→ handler: I0I0I0 (主 PoW 路径)
→ enabled = "1"
→ suffix = 60 字符 hex   (PoW 前缀)
→ targetHash = 64 字符 SHA-256   (PoW 目标)
→ difficulty = "16"
→ isTrusted = "false"

⚠️ 参数重排: handler(t,e,n,r,a) → Bs(n,e,r,a==="true")
   实际调用: Bs(targetHash, suffix, "16", false)
```

### 3.5.9 段 8: `0II0I0|1|8a213f60-11ba-11f1-a1d1-b7af17455ae4|8588|7bb57f904e7b938c8442e522a97d754d23a35964a1030857244c7d2c803a1169_?::<|1|`

```
→ handler: 0II0I0 (备用 PoW 路径 via qu)
→ uuid = "8a213f60-..."
→ port = "8588"
→ challengeData = "hash_encodedSuffix"
   ↓ encodedSuffix "?::<" XOR(10) = "5002"
→ Lu = uuid
```

> 主路径段 7 已经足够；段 8 是备用。我们只用段 7 算 PoW，段 8 忽略。

### 3.5.10 段 9: `IIIIII|cc|60|U2FtZVNpdGU9TGF4Ow==`

```
→ handler: IIIIII (Xr 配置)
→ ff = "cc"
→ ttl = 60
→ args = "U2FtZVNpdGU9TGF4Ow=="   (= "SameSite=Lax;" base64)
→ "cc" 标记 → 延迟执行
```

### 3.5.11 段 10: `IIIIII|rf|60|1`

```
→ ff = "rf"
→ ttl = 60
→ args = "1"
```

### 3.5.12 段 11: `IIIIII|fp|60|1`

```
→ ff = "fp"
→ ttl = 60
→ args = "1"
```

### 3.5.13 段 12: `II0III|ccc:0,ic:0,nf:0,ai:0`

```
→ handler: II0III (config 解析)
→ ccc=0, ic=0, nf=0, ai=0
```

### 3.5.14 OB#1 执行后全局状态

```js
jf  = "cu"
to  = "41916095560041989364"
no  = "1771962830422"
ro  = 1771962830
ao  = "401"
qa  = "4481f3f71e53718b3e58d5ac1bc5cedf49ea4e0e4a8db4a2dfa2c81ea0d203bc"
$a  = "d6f03jmq8h6c7382req0"
Lu  = "8a213f60-11ba-11f1-a1d1-b7af17455ae4"
Mr  = {
    cc:  "U2FtZVNpdGU9TGF4Ow==",
    rf:  "1",
    fp:  "1",
    ccc: "0",
    ic:  "0",
    nf:  "0",
    ai:  "0"
}
PoW = {
    suffix:     "ab317b680dfb5a3dc7c52a4fefedce5adb20cedd066ce5408ce6887aee9c",
    target:     "7bb57f904e7b938c8442e522a97d754d23a35964a1030857244c7d2c803a1169",
    difficulty: 16,
    isTrusted:  false
}
visualChallenge = {
    startW: 27,
    startH: 57,
    wJump:  1,
    hJump:  4,
    hash:   "440be290d8e710ca5c9024316a6f6c25bb6fef14a42ec2eca1efdd04c53c2490"
}
```

---

# 第四部分：Proof of Work 完整还原

## 4.1 PoW 公式

PoW 校验：

```
sha256(prefix + (lastHexDigit + (counter >> 16)).toString(16) + (counter & 0xFFFF).toString(16).padStart(4,'0'))
  的前 N 个 hex 字符 等于 targetHash 前 N 个 hex 字符
```

参数：
- `suffix`：OB#1 的 60 字符 hex
- `target`：64 字符 SHA-256
- `difficulty`：bit 数（默认 16，对应 4 hex chars）

简化（difficulty=16 时 `counter >> 16 = 0`）：

```
candidate = suffix + counter.toString(16).padStart(4, '0')
            ↓
sha256(candidate) === targetHash
```

求解就是暴力枚举 `counter = 0..65535`。

## 4.2 性能分析

| difficulty (bits) | 期望尝试数 | 单核 SHA-256 速度 | 期望时长 |
|---|---|---|---|
| 8 bits | ~256 | ~3000 ns | ~1ms |
| 12 bits | ~4096 | ~3000 ns | ~12ms |
| **16 bits（实测）** | ~65536 | ~3000 ns | **~9-200ms** |
| 20 bits | ~1M | ~3000 ns | ~3s |

PX 用 16 bits = ~65536 次。Node `crypto.createHash` 大约 200-500ns/次，实测 **9-60ms**。

> 也就是说 PoW 完全不是"算力门槛"，主要功能是**强制客户端做一次 CPU 同步工作**，过滤完全无 CPU 的 botnet。

## 4.3 同步 vs 异步实现的关键差异

⚠️ **Bundle 路径最致命的性能陷阱之一**：

```js
// ❌ 错（Node 的 Web Crypto API）
async function solvePow_BAD(suffix, target, diff) {
    let counter = 0;
    while (true) {
        const buf = new TextEncoder().encode(suffix + counter.toString(16));
        const hashBuf = await crypto.subtle.digest('SHA-256', buf);   // ⭐ 每次 await
        const hex = bufToHex(hashBuf);
        if (hex.startsWith(target.slice(0, diff/4))) return counter.toString(16);
        counter++;
    }
}
// 实测：每次 await 切 event loop 加 ~10ms overhead
// 65536 次 = 655s = 11 分钟 → PX session 早超时
```

```js
// ✅ 对（Node 同步 crypto）
function solvePow_GOOD(suffix, target, diff) {
    const targetPrefix = target.slice(0, diff / 4);
    let counter = 0;
    while (true) {
        const hex = crypto.createHash('sha256').update(suffix + counter.toString(16)).digest('hex');
        if (hex.startsWith(targetPrefix)) return counter.toString(16);
        counter++;
    }
}
// 实测：9-60ms
```

如果必须用浏览器 `crypto.subtle`（如 userscript 场景），批量化：

```js
// 浏览器优化版：每批 1000 个一起 schedule
async function solvePow_browser_batch(suffix, target, diff) {
    const targetPrefix = target.slice(0, diff / 4);
    let counter = 0;
    while (true) {
        const promises = [];
        for (let i = 0; i < 1000; i++) {
            const buf = new TextEncoder().encode(suffix + (counter + i).toString(16));
            promises.push(crypto.subtle.digest('SHA-256', buf));
        }
        const hashes = await Promise.all(promises);
        for (let i = 0; i < hashes.length; i++) {
            const hex = bufToHex(hashes[i]);
            if (hex.startsWith(targetPrefix)) return (counter + i).toString(16);
        }
        counter += 1000;
    }
}
// 浏览器实测：~200-500ms
```

## 4.4 两条 PoW 路径对比（I0I0I0 vs 0II0I0）

OB#1 同时下发两个 PoW handler：

| 维度 | `I0I0I0` (段7) | `0II0I0` (段8) |
|---|---|---|
| Handler key | `I0I0I0` | `0II0I0` |
| 调用方式 | 直接调用 `PX1135 = Bs` | `qu() → os() → PX762 = Bs` |
| 参数来源 | 段字段直接传入 | challengeData XOR(10) 解码 |
| 回调设置 | 无 | `PX763=ds, PX1078=rs, PX1200=ts, PX1145=zu` |
| 是否主路径 | ✓ **主路径** | 备用/补充 |

**写 generator 时只用 `I0I0I0` 主路径**，简单可靠。`0II0I0` 是 PX 的双保险（防止 captcha.js 还没加载完）。

## 4.5 完整 Bs 函数（captcha.js:7411）

```js
function Bs(r, n, t) {
    // r = targetHash (64字符 SHA-256)
    // n = suffix (60字符 hex)
    // t = difficulty (字符串, +"16" → 16)
    // arguments[3] = isTrusted (boolean, 可选)

    var m = Math.ceil(+t / 4);              // hex 位数 = 4
    var o = "0".repeat(m);                  // "0000"
    var D = (1 << 4 * m) - 1;               // mask = 65535
    var i = parseInt("0x" + n.charAt(n.length - 1), 16);  // suffix 最后 hex 字符
    var c = n.slice(0, -1);                 // suffix 去掉最后一字符
    var z = 1 << +t;                        // maxCounter = 65536

    // Web Worker 路径（浏览器）
    if (typeof Worker !== 'undefined' && !arguments[3]) {
        var worker = Ks();   // 创建 Blob URL Worker
        // Worker 内运行 ws(0, z, D, o, m, i, c, r, startTime)
        // 找到后调用 Ts(answer, elapsed) 存储结果
        // 然后调用 PX763(ds) 回调
    }
    // setTimeout 路径（降级）
    else {
        for (var counter = 0; counter < z; counter++) {
            var result = poi(counter, D, o, m, i, c, 0, r);
            if (result) {
                Ts(result, Date.now() - startTime);
                // PX763 回调
                return;
            }
        }
    }
}
```

## 4.6 `poi()` 函数（captcha.js:7165-7170）

```js
function poi(r, n, u, t, v, e, f, s) {
    // r = counter          n = mask (65535)
    // u = padding ("0000") t = hex digits (4)
    // v = lastHexDigit     e = prefix
    // f = 未使用 (0)       s = targetHash

    var m = (u + (r & n).toString(16)).slice(-t);
    //     = ("0000" + (counter & 65535).toString(16)).slice(-4)
    //     = 4 位 hex 的 counter 低位

    var o = e + (v + (r >> (t << 2))).toString(16) + m;
    //     = prefix + (lastHex + (counter >> 16)).toString(16) + lowPart
    //     difficulty=16 时 counter >> 16 = 0, 所以 = prefix + lastHex + lowPart
    //     即: suffix + counter的4位hex

    if (sha256(o) === s) return o;   // 找到答案返回
}
```

## 4.7 简化理解（difficulty=16）

```
对于 difficulty=16, counter < 65536:
  counter >> 16 = 0 (始终为0)
  candidate = prefix + lastHexDigit.toString(16) + hex(counter, 4位)
            = suffix + hex(counter).padStart(4, '0')

本质就是:
  for counter in 0..65535:
    if sha256(suffix + counter_hex_4位) === targetHash:
      return suffix + counter_hex_4位
```

## 4.8 Node.js 生产实现

```js
const crypto = require('crypto');

function sha256(data) {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Solve PX Proof of Work.
 *
 * @param {string} targetHash - 64 hex chars
 * @param {string} suffix - hex string from OB#1
 * @param {number|string} difficulty - default 16
 * @returns {{answer, counter, elapsed}}
 */
function solvePow(targetHash, suffix, difficulty = 16) {
    difficulty = +difficulty || 16;
    const m = Math.ceil(difficulty / 4);
    const padding = '0'.repeat(m);
    const mask = (1 << (4 * m)) - 1;
    const lastHexDigit = parseInt('0x' + suffix.charAt(suffix.length - 1), 16);
    const prefix = suffix.slice(0, -1);
    const maxCounter = 1 << difficulty;
    const start = Date.now();

    for (let r = 0; r < maxCounter; r++) {
        const lowPart = (padding + (r & mask).toString(16)).slice(-m);
        const candidate = prefix + (lastHexDigit + (r >> (m << 2))).toString(16) + lowPart;
        if (sha256(candidate) === targetHash) {
            return { answer: candidate, counter: r, elapsed: Date.now() - start };
        }
    }
    return null;
}

module.exports = solvePow;
```

## 4.9 验证实例（真抓数据）

```
输入:
  suffix     = "ab317b680dfb5a3dc7c52a4fefedce5adb20cedd066ce5408ce6887aee9c"
  targetHash = "7bb57f904e7b938c8442e522a97d754d23a35964a1030857244c7d2c803a1169"
  difficulty = 16

输出:
  answer  = "ab317b680dfb5a3dc7c52a4fefedce5adb20cedd066ce5408ce6887aee9c24da"
  counter = 9434   (0x24da)
  elapsed = 9ms

验证: sha256(answer) === targetHash ✓
```

## 4.10 Web Worker 路径（浏览器）

```js
// Ks(): 创建 Blob URL Web Worker
function Ks() {
    var code = [sha256源码, poi源码, ws源码].join('\n');
    var blob = new Blob([code], {type: 'application/javascript'});
    return new Worker(URL.createObjectURL(blob));
}

// ws(): Worker 内循环
function ws(start, end, mask, padding, m, lastHex, prefix, targetHash, startTime) {
    for (var i = start; i < end; i++) {
        var result = poi(i, mask, padding, m, lastHex, prefix, 0, targetHash);
        if (result) {
            postMessage({answer: result, elapsed: Date.now() - startTime});
            return;
        }
    }
}
```

Web Worker 在浏览器**主线程外**算，不阻塞 UI。`Bs` 监听 worker 的 message → 收到答案 → `Ts(answer, elapsed)` 存储 → `PX763(ds)` 回调。

## 4.11 PoW 答案的注入位置

PoW counter（答案）注入 Bundle#2：

```js
// Bundle#2 EV 数组里的字段
{
    // ... 220 多个常规字段
    'AbCdEfGhIjK=': counter,        // PoW answer hex（跨版本 b64 key 变）
    'XyZwUvTsR=':  pow.suffix,      // suffix 回显
    'Slt5EA85fiI=': wasmA,          // WASM a() 输出 (= PX12590)
    'MD1DNnVfRgQ=': wasmB,          // WASM b() 输出 (= PX12610/PX12573)
    // ...
}
```

⚠️ 具体 b64 key 跨版本会变。每次升级时跑 `find_state_keys.py` 之类的脚本做跨批值匹配定位。

## 4.12 PoW 缓存陷阱（生产部署）

⚠️ **生产陷阱**：缓存 PoW 答案：

```js
// ❌ 错（跨会话泄露）
const powCache = new Map();
function cachedSolvePow(suffix, target) {
    const key = suffix + ':' + target;
    if (powCache.has(key)) return powCache.get(key);
    const ans = solvePow(suffix, target);
    powCache.set(key, ans);
    return ans;
}
```

问题：PX 后端 challenge 池有限，`(suffix, target)` **会跨会话重复**。但 PX 后端**按 session UUID 校验答案**：
1. 会话 A：cache 拿到 answer X
2. 会话 B：(suffix, target) 重复，cache 返 X
3. PX 看 hash(uuid_B + X) 对不上 → 拒

**修复**：

```js
// ✅ 按会话分箱
function cachedSolvePow(suffix, target, sessionUuid) {
    const key = sessionUuid + ':' + suffix + ':' + target;
    if (powCache.has(key)) return powCache.get(key);
    const ans = solvePow(suffix, target);
    powCache.set(key, ans);
    return ans;
}

function endSession(sessionUuid) {
    for (const k of powCache.keys()) {
        if (k.startsWith(sessionUuid + ':')) powCache.delete(k);
    }
}
```

**最简单**：< 1000 会话/天 → 直接不缓存（PoW 才 9ms）。

## 4.13 captcha.js 关键 PoW 函数索引

| 函数 | 行号 | 功能 | 调用关系 |
|---|---|---|---|
| `sha256()` | ~7000-7164 | 纯 JS SHA-256 实现 | `poi()` 内使用 |
| `poi()` | 7165-7170 | PoW 单次尝试 | `Bs`/`ws` 调用 |
| `ws()` | 7171-7175 | Web Worker 循环 | Worker 内运行 |
| `Ks()` | 7176-7219 | 创建 Web Worker | `Bs` 调用 |
| `Ts()` | 7406-7410 | 存储 PoW 结果 | `Es=answer, Js=elapsed` |
| **`Bs()`** | **7411-7524** | **完整 PoW 求解器** | `PX1135/PX762` 入口 |

⚠️ **`PX1135 === PX762 === Bs`**：完全相同的函数，PX 注册了两个名字。验证：

```js
const h = window._O1GDTa7Qhandler;
Object.keys(h);                    // → ["PX762", "PX12634", "PX1135"]
h.PX1135 === h.PX762;             // → true
h.PX1135.toString();              // → "function Bs(r,n,t){..."
```

---

# 第五部分：WebAssembly 集成

## 5.1 WASM 来源与提取

PX 的 WASM 叫 `px_captcha.wasm`，约 60862 字节，**嵌入在 `captcha.js` 的 `Us()` 函数返回数组的第 [10] 个元素**：

```js
// captcha.js（简化）
function Us() {
    return [
        "...",   // [0-9] 其它项（base64 字符串、配置等）
        "AGFzbQEAAAABZRJgAn9/AGADf39/AGAFf39/f38..."   // [10] = WASM base64
    ];
}
```

WASM 标准 magic 字节：`\0asm 0x01 0x00 0x00 0x00` = `0x00 0x61 0x73 0x6D 0x01 0x00 0x00 0x00`。

### 5.1.1 提取脚本（简版）

```js
const fs = require('fs');
const captchaJs = fs.readFileSync('captcha.js', 'utf8');

// 找 Us()[10] 或类似的 base64 大字符串（含 "AGFzbQ" 起头 = \0asm magic）
const m = captchaJs.match(/"(AGFzbQ[A-Za-z0-9+/=]{50000,})"/);
if (!m) throw new Error('WASM base64 not found');

const wasmBytes = Buffer.from(m[1], 'base64');
fs.writeFileSync('px_captcha.wasm', wasmBytes);
console.log(`WASM: ${wasmBytes.length} bytes, magic ${wasmBytes.slice(0, 4).toString('hex')}`);
// 期望: WASM: ~60862 bytes, magic 0061736d
```

### 5.1.2 10 种解码路径（如果 base64 不够）

实测 captcha.js 里的 WASM 字符串有时不是标准 base64，需要尝试以下解码路径：

| # | 路径 | 解码方式 |
|---|---|---|
| 1 | `ksXWzSIG` | 自定义 base64（小写字母在前的字母表）+ URI decode |
| 2 | `ksXWzSIG` → `atob` | 自定义 base64 → 标准 atob |
| 3 | `ksXWzSIG` → `u()` | 自定义 base64 → XOR("zSLyhtf") |
| 4 | Standard `atob` | 标准 base64 |
| 5 | `u()` | atob + XOR |
| 6 | `u()` → `atob` | XOR → atob |
| 7 | `ksXWzSIG` → `u()` → `atob` | 三步链 |
| 8 | Standard b64 alphabet + URI decode | 加 URI 步骤 |
| 9 | Custom b64（无 URI 步骤） | 自定义字母表 |
| 10 | Standard `atob`（无 URI 步骤） | 直接 atob |

判断成功的标准：**头 4 字节 = `\0asm` magic**（`00 61 73 6d`）。

### 5.1.3 自定义 base64 字母表

```
标准: ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=
PX:   abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=
       ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
       小写字母放前面（标准是大写在前）
```

转换：把字符串里所有大小写字母对调，再用标准 atob。

## 5.2 两个导出函数 a() 和 b()

WASM 模块导出**两个核心函数**：

| 函数 | 签名 | 返回值 | 用途 |
|---|---|---|---|
| **`a()`** | `() -> string` | 64-hex 字符串 | "fingerprint init" — **每次调用返回不同值**（用 `globalThis._pxUuid` + 内部随机源） |
| **`b(input)`** | `(string) -> string` | 127-char 自定义编码字符串 | "fingerprint transform" — **给定相同输入返回相同输出**（确定性 ChaCha20） |

调用模式：

```js
// 1. 先调 a() 拿初始指纹
const aResult = wasmExports.a();
console.log(aResult);
// 输出: "abc123def456...0987" (64 hex)
// 注入到 Bundle#3 PX561 字段 Slt5EA85fiI= (PX12590)

// 2. 用 PoW answer 当 b() 输入
const bResult = wasmExports.b(powAnswer);
console.log(bResult);
// 输出: "$5G@h!9*X3#k...0-1" (127 chars 自定义字母表)
// 注入到 Bundle#3 PX561 字段 MD1DNnVfRgQ= (PX12610/PX12573)
```

### 5.2.1 a() 内部逻辑（推测）

```
a():
    timestamp = current_ms()
    uuid = window._pxUuid     ← 必须存在
    random = crypto.getRandomValues(32 bytes)
    seed = SHA256(uuid + timestamp + random)
    return seed.toHex()       ← 64 hex chars
```

每次调用结果不同（含真随机源），但服务端会校验 hash(uuid + a_output) 跟其它字段是否一致。

### 5.2.2 b() 内部逻辑（推测）

```
b(input):
    seed = constant_from_wasm_data_section()   ← 32 字节，每个版本不同
    nonce = input_first_12_bytes
    keystream = ChaCha20(seed, nonce, counter=0)
    out_bytes = input XOR keystream
    out_string = encode_custom_alphabet(out_bytes)   ← 不是 base64！
    return out_string
```

给定相同输入返回相同输出（确定性）。

## 5.3 34 个 wbg imports

PX 的 WASM 是 wasm-bindgen 生成的 Rust，imports 在 `wbg` namespace 下。完整 34 个（带 hash 后缀，每次 build 变）：

### 5.3.1 字符串操作

| Import | 含义 |
|---|---|
| `__wbindgen_string_new(ptr, len)` | UTF-8 → JS string |
| `__wbindgen_string_get(retptr, idx)` | JS string → WASM memory |

### 5.3.2 对象操作

| Import | 含义 |
|---|---|
| `__wbg_get_e6ae480a4b8df368(objIdx, keyPtr, keyLen)` | `obj[key]` |
| `__wbindgen_object_drop_ref(idx)` | 释放引用 |
| `__wbg_set_17499e8aa4003ebd(arrIdx, srcIdx, offset)` | 数组赋值 |

### 5.3.3 环境检测

| Import | 含义 | Node mock 必须 |
|---|---|---|
| **`__wbg_instanceof_Window_e266f02eee43b570(idx)`** | 判断 Window | **返回 1**（坑 #B2） |
| `__wbg_crypto_c48a774b022d20ac(idx)` | crypto 对象 | 返 mockCrypto |
| `__wbg_require_8f08ceecec0f4fee()` | Node.js require | 返 noop |

### 5.3.4 随机数

| Import | 含义 |
|---|---|
| `__wbg_getRandomValues_37fa2ca9e4e07fab(cryptoIdx, arrIdx)` | crypto.getRandomValues |
| `__wbg_randomFillSync_dc1e9a60c158336d(cryptoIdx, arrIdx)` | crypto.randomFillSync |

### 5.3.5 函数调用

| Import | 含义 |
|---|---|
| `__wbg_newnoargs_2b8b6bd7753c76ba(ptr, len)` | `new Function(code)` |
| `__wbg_call_95d1ea488d03e4e8(fnIdx, thisIdx)` | `fn.call(this)` |
| `__wbg_call_9495de66fdbe016b(fnIdx, thisIdx, arg)` | `fn.call(this, arg)` |

### 5.3.6 全局对象

| Import | 含义 |
|---|---|
| `__wbg_self_e7c1f827057f6584()` | `self` |
| `__wbg_window_a09ec664e14b1b81()` | `window` |
| `__wbg_globalThis_87cbb8506fecf3a9()` | `globalThis` |

### 5.3.7 TypedArray

| Import | 含义 |
|---|---|
| `__wbg_buffer_cf65c07de34b9a08(idx)` | `ArrayBuffer` |
| `__wbg_newwithbyteoffsetandlength_9fb2f11355ecadf5(bufIdx, offset, len)` | `new Uint8Array(buf, offset, len)` |
| `__wbg_new_537b7341ce90bb31(bufIdx)` | `new Uint8Array(buf)` |
| `__wbg_set_17499e8aa4003ebd(arrIdx, srcIdx, offset)` | `Uint8Array.set` |

### 5.3.8 时间 + 控制台

| Import | 含义 |
|---|---|
| `__wbg_now_e0d8ec93dd25766a` | `Date.now()` |
| `__wbg_performance_3298b1cc5dffe537()` | `performance` |
| `__wbg_log` / `__wbg_warn` / `__wbg_error` | 控制台输出（noop） |

### 5.3.9 内存

| Import | 含义 |
|---|---|
| `__wbindgen_memory()` | WASM 内存 |
| `__wbindgen_throw(ptr, len)` | 抛错误 |
| `__wbindgen_externref_xform__` | 引用变换 |

### 5.3.10 完整 imports 表参考

具体每个 import 的 hash 后缀**每次 build 不同**。提取方法：

```bash
# 用 wabt 工具
wabt-objdump -j Import px_captcha.wasm

# 输出（节选）:
# - func[0] sig=2 <wbg.__wbg_get_e6ae480a4b8df368>
# - func[1] sig=0 <wbg.__wbg_instanceof_Window_e266f02eee43b570>
# - func[2] sig=1 <wbg.__wbg_crypto_c48a774b022d20ac>
# ... 等
```

跨版本时 hash 变了 → import 名变 → mock 字典 key 也要更新。

## 5.4 Node.js 中运行 WASM 的最小 mock

下面是能让 PX WASM 在 Node 跑起来的最小 imports（关键 8 个）：

```js
const fs = require('fs');

async function loadPxWasm(wasmPath, uuid) {
    // ⭐⭐⭐ Step 1: 必须在 instantiate 之前设置 _pxUuid（坑 #B1）
    globalThis._pxUuid = uuid;

    // Step 2: 模拟浏览器环境
    const mockWindow = { _pxUuid: uuid };
    const mockDocument = {
        cookie: '',
        title: 'iFood',
        URL: 'https://www.ifood.com.br/'
    };
    const mockNavigator = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        language: 'pt-BR',
        languages: ['pt-BR', 'pt', 'en'],
        platform: 'Win32',
        cookieEnabled: true,
        hardwareConcurrency: 8,
        deviceMemory: 8,
    };
    const mockScreen = {
        width: 1920, height: 1080,
        availWidth: 1920, availHeight: 1040,
        colorDepth: 24, pixelDepth: 24,
    };

    // Step 3: 关键 imports
    const imports = {
        wbg: {
            // 类型判断 — 必须返回 1（坑 #B2）
            __wbg_instanceof_Window: () => 1,
            __wbg_instanceof_Document: () => 1,
            __wbg_instanceof_HTMLElement: () => 1,

            // 全局对象返回
            __wbg_window: () => mockWindow,
            __wbg_document: () => mockDocument,
            __wbg_navigator: () => mockNavigator,
            __wbg_screen: () => mockScreen,
            __wbg_self: () => globalThis,
            __wbg_globalThis: () => globalThis,

            // 属性读写（Reflect 通用）
            __wbg_get: (target, key) => Reflect.get(target, key),
            __wbg_set: (target, key, value) => { Reflect.set(target, key, value); return true; },

            // 时间
            __wbg_now: () => Date.now(),
            __wbg_performance: () => ({ now: () => performance.now() }),

            // 随机数
            __wbg_random: () => Math.random(),
            __wbg_getRandomValues: (cryptoObj, buf) => {
                require('crypto').randomFillSync(buf);
                return buf;
            },
            __wbg_randomFillSync: (cryptoObj, buf) => {
                require('crypto').randomFillSync(buf);
            },

            // 控制台 no-op
            __wbg_log: () => {}, __wbg_warn: () => {}, __wbg_error: () => {},
        },
        __wbindgen_placeholder__: {
            __wbindgen_string_new: (ptr, len) => { /* wasm-bindgen 自带桥 */ },
            __wbindgen_string_get: (ret, idx) => { /* 同上 */ },
            __wbindgen_throw: (ptr, len) => { throw new Error('wasm throw'); },
            __wbindgen_object_drop_ref: (idx) => {},
            __wbindgen_object_clone_ref: (idx) => idx,
            __wbindgen_memory: () => instance.exports.memory,
            // ... 其它 __wbindgen_* 必填项
        }
    };

    const wasmBytes = fs.readFileSync(wasmPath);
    const { instance } = await WebAssembly.instantiate(wasmBytes, imports);
    return instance.exports;
}

// 用法
(async () => {
    const exports = await loadPxWasm('px_captcha.wasm', uuid);
    const a = exports.a();
    const b = exports.b(powAnswer);
    console.log({ a, b });
})();
```

## 5.5 wasm-bindgen 完整桥实现

由于 wasm-bindgen 有一套标准的 string passing 协议，完整 bridge 比上面 mock 多很多：

```js
let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
let cachedTextEncoder = new TextEncoder('utf-8');
let cachedUint8Memory = null;
let cachedInt32Memory = null;
let wasmExports = null;

function getUint8Memory() {
    if (cachedUint8Memory === null || cachedUint8Memory.buffer !== wasmExports.memory.buffer) {
        cachedUint8Memory = new Uint8Array(wasmExports.memory.buffer);
    }
    return cachedUint8Memory;
}

function getInt32Memory() {
    if (cachedInt32Memory === null || cachedInt32Memory.buffer !== wasmExports.memory.buffer) {
        cachedInt32Memory = new Int32Array(wasmExports.memory.buffer);
    }
    return cachedInt32Memory;
}

function passStringToWasm(s) {
    const buf = cachedTextEncoder.encode(s);
    const ptr = wasmExports.__wbindgen_malloc(buf.length);
    getUint8Memory().set(buf, ptr);
    WASM_VECTOR_LEN = buf.length;
    return ptr;
}

function getStringFromWasm(ptr, len) {
    return cachedTextDecoder.decode(getUint8Memory().subarray(ptr, ptr + len));
}

// a() 调用
function wasmA() {
    const retptr = wasmExports.__wbindgen_add_to_stack_pointer(-16);
    try {
        wasmExports.a(retptr);
        const r0 = getInt32Memory()[retptr / 4 + 0];
        const r1 = getInt32Memory()[retptr / 4 + 1];
        const s = getStringFromWasm(r0, r1);
        wasmExports.__wbindgen_free(r0, r1);
        return s;
    } finally {
        wasmExports.__wbindgen_add_to_stack_pointer(16);
    }
}

// b(input) 调用
function wasmB(input) {
    const retptr = wasmExports.__wbindgen_add_to_stack_pointer(-16);
    try {
        const ptr0 = passStringToWasm(input);
        const len0 = WASM_VECTOR_LEN;
        wasmExports.b(retptr, ptr0, len0);
        const r0 = getInt32Memory()[retptr / 4 + 0];
        const r1 = getInt32Memory()[retptr / 4 + 1];
        const s = getStringFromWasm(r0, r1);
        wasmExports.__wbindgen_free(r0, r1);
        return s;
    } finally {
        wasmExports.__wbindgen_add_to_stack_pointer(16);
    }
}
```

完整的 `run_wasm.js` 模板见 （原素材已并入本文档） §5。

## 5.6 内部 ChaCha20 实现

`b(input)` 的核心算法是 **ChaCha20 stream cipher**（变体）：

```
b(input):
    seed = constant_from_wasm_data_section()    // 32 bytes，每版本不同
    nonce = input_first_12_bytes
    keystream = ChaCha20(seed, nonce, counter=0)
    out_bytes = input XOR keystream
    out_string = encode_custom_alphabet(out_bytes)   // 不是 base64！
    return out_string
```

**ChaCha20 seed** 嵌在 WASM `.data` 段，PX 每个 build 都重新生成。提取方法：

```bash
# 用 wabt 工具
wabt-objdump -j data px_captcha.wasm | head -20

# 输出（节选）:
# - segment[0] memory=0 size=32 offset=0 align=0
#   - init i32=1024
#   - data: 6A 09 E6 67 BB 67 AE 85 3C 6E F3 72 A5 4F F5 3A 51 0E 52 7F 9B 05 68 8C 1F 83 D9 AB 5B E0 CD 19
# ↑ 这 32 字节就是 ChaCha20 seed（疑似）
```

跨版本 seed 必变 —— **如果你的 b() 输出跟真抓的对不上，先怀疑 seed**。

## 5.7 b() 输出的自定义编码（不是 base64）

⚠️ `b()` 返回的 127 字符字符串**看起来像 base64 但不是**。字母表：

```
/=+!1@2#3$4%5^6&7*8(9)0-
```

跟标准 base64 字母表的差异：
- 没有大小写字母（标准 base64 64 字符 = 26 大写 + 26 小写 + 10 数字 + 2 符号）
- 用 `!@#$%^&*()-` 这种 shell 特殊字符

**关键陷阱**：把 b() 输出当 base64 解码 → 解出来全是乱码或异常。**直接当字面字符串原样填**到 Bundle#3 的 PX561 事件 `MD1DNnVfRgQ=` 字段：

```js
ev3['MD1DNnVfRgQ='] = wasmExports.b(powAnswer);   // 原样填，不解码
```

## 5.8 WASM 跟 _pxUuid 的依赖

⚠️ **WASM `b()` 强依赖 `globalThis._pxUuid`**（坑 #B1）：

```js
// b() 内部（推测）
function b(input) {
    const pxUuid = window._pxUuid;  // ← 通过 __wbg_get(window, "_pxUuid") 读取
    if (!pxUuid) {
        return "";   // 没 uuid 直接返空字符串
    }
    // ... ChaCha20 变换
}
```

**修复**：在 `WebAssembly.instantiate` **之前**设置：

```js
globalThis._pxUuid = uuid;
const { instance } = await WebAssembly.instantiate(wasmBytes, imports);
```

如果设置在 instantiate 之后调 a()/b()，由于 WASM 实例化时会做一些初始化（可能读 _pxUuid 缓存），可能仍然失败。**安全做法是设置在 instantiate 之前**。

## 5.9 instanceof_Window 必须返 1

⚠️ **第二个 WASM 必填 mock**（坑 #B2）：

```js
// WASM 内部某处:
if (!__wbg_instanceof_Window(window_obj)) {
    return error;   // 走错误路径
}
```

Node 默认环境下 WASM 看不到 "Window" class，`instanceof` 返 0 → 错误路径 → a()/b() 返空或 panic。

**修复**：mock 返 1：

```js
imports.wbg.__wbg_instanceof_Window_<hash> = () => 1;
```

类似地 `__wbg_instanceof_Document` 和 `__wbg_instanceof_HTMLElement` 也都返 1。

## 5.10 WASM 常量按版本/客户变（重要）

⚠️ WASM 内部嵌的所有"magic constants"每个 build 都不一样：

| 常量 | 大小 | 跨版本变化 |
|---|---|---|
| ChaCha20 seed | 32 bytes | 每 build 必变 |
| HMAC keys | 16-32 bytes | 偶尔变 |
| 自定义编码字母表 | 24 chars | 半年一次 |
| 校验常量 | 32 bytes | 偶尔变 |

更新检测 SOP：

```bash
# 1. 抓新 captcha.js
curl -o captcha_new.js https://client.px-cloud.net/PXO1GDTa7Q/captcha.js

# 2. 提 WASM
node extract_wasm.js captcha_new.js

# 3. SHA 跟旧版对比
sha256sum px_captcha.wasm
# 跟 stample/bundle/source/SDK_INFO.md 里的对比

# 4. 变了？dump data 段对比
wasm-objdump -j data px_captcha.wasm > new_data.txt
diff old_data.txt new_data.txt

# 5. 测 b() 输出
node test_wasm_b.js   # 跟真抓 sample 对比
```

详见 [§16 SDK 漂移应对](#第十六部分sdk-漂移应对) 和坑 #B3。

---

# 第六部分：Bundle#2 完整逆向

## 6.1 请求构造

Bundle#2 是按压挑战的核心 POST。携带：

```
seq=1 (但实测 iFood 实际是 seq=3，因为内部 ph 计数器在 init 时已经递增到 1)
rsc=2

payload = encrypted EV array (228 字段)
PC = generatePC(events, uuid, TAG, 388)
cs = state.qa (from OB#1)
ci = challenge ID（从 captcha.js 注册时生成）
sid = state.pxsid + hh(state.no) + hh(cts)   ⭐ 含 Unicode Tag 隐写
vid = state.vid
cts = ms timestamp（**类型从 UUID 变了**！）
```

完整 form-encoded body：

```
payload=<base64+Jf>&appId=PXO1GDTa7Q&tag=<tag>&uuid=<uuid>&ft=388&seq=3&en=NTA&bi=<bi>&cs=<64hex>&pc=<16digit>&sid=<pxsid+hh>&vid=<vid>&ci=<ci_uuid>&cts=1771967728434&rsc=2
```

## 6.2 Bundle#2 vs Bundle#1 参数差异

| 参数 | Bundle#1 | Bundle#2 | 说明 |
|---|---|---|---|
| `payload` | 16 字段，~1 KB | **228+ 字段，~7.5 KB** | 完整浏览器指纹 |
| `seq` | 0 | **3**（实测，iFood）| `ph` 递增 |
| `rsc` | 1 | **2** | 递增 |
| `cts` | UUID 格式 | **ms timestamp** | 从 OB#2 后转 ms（不是 OB#1） |
| `cs` | 无 | **64 hex** | 从 OB#1 `qa` 拿到的 challenge hash |
| `ci` | 无 | **UUID** | challenge instance ID |
| `sid` | 纯 UUID | UUID + **隐写数字（cts 时间戳的每位）** | Unicode Tag Chars |

## 6.3 Payload 228 字段三分类

实测 Bundle#2 一次会话发 ~228 字段（不同会话浮动 ±5）。三分类：

| 分类 | 数量 | 含义 | 怎么处理 |
|---|---|---|---|
| **STATIC** | ~160 (70%) | 6 批抓包同值的字段（浏览器指纹常量） | 直接抄模板 |
| **DYNAMIC** | ~50 (22%) | 每次变化（时间戳、UUID、HMAC、计数器） | 算法生成 |
| **CONDITIONAL** | ~18 (8%) | 部分批次出现（warm visit 字段） | 缺失也行 |

完整 228 字段按 17 个类别的分类见 [第十部分](#第十部分229-字段完整分类)（按 229 fields 文档整理）。

生成策略：**模板法** —— 用真抓 Bundle#2 当 template，只覆盖 DYNAMIC：

```js
function buildBundle2(ctx) {
    const ev = JSON.parse(JSON.stringify(TEMPLATE));
    const d = ev[0].d;

    // ~20 个 DYNAMIC 字段
    d[K.uuid]          = ctx.uuid;
    d[K.initTime]      = ctx.initTime;
    d[K.sendTime]      = Date.now();
    d[K.dateString]    = new Date().toString();
    d[K.perfNow]       = performance.now();
    d[K.uaHmac]        = hmacMD5(ctx.uuid, ctx.ua);
    d[K.memUsed]       = randIntInRange(30_000_000, 80_000_000);
    d[K.memTotal]      = randIntInRange(35_000_000, 95_000_000);
    d[K.bundleAppId]   = ctx.state.appId;       // ⭐ Bundle AppID 注入
    d[K.serverNo]      = parseInt(ctx.state.no); // ⭐ 必须 parseInt
    d[K.serverTo]      = ctx.state.to;
    d[K.powCounter]    = ctx.powAnswer;          // ⭐ PoW 注入
    d[K.wasmA]         = ctx.wasmA;              // ⭐ WASM a 注入
    d[K.wasmB]         = ctx.wasmB;              // ⭐ WASM b 注入
    // ...

    ev[0].d = relocateAntiTamper(d, ctx.state);
    return ev;
}
```

## 6.4 关键字段详解（state.\*、WASM、PoW 注入位）

下面 14 个字段是 Bundle#2 跟 Collector 最不同的地方：

| 字段（含义） | 来源 | 类型 |
|---|---|---|
| **PoW counter** | `pow.counter.toString(16)` | string |
| **PoW suffix 回显** | `state.pow.suffix` | string |
| **WASM a 输出 (PX12590)** | `wasm.a()` | string (64 hex) |
| **WASM b 输出 (PX12610)** | `wasm.b(counter)` | string (127 chars) |
| **state.no (serverNo)** | **`parseInt(state.no)`** ⭐ | number |
| **state.appId (Bundle AppID)** | `state.appId` | string |
| **state.to** | `state.to` | string |
| **state.qa** | `state.qa` | string |
| **state.pxsid** | `state.pxsid` | string |
| **state.cts** | `state.cts` | string |
| **uuid（重申）** | `ctx.uuid` | string |
| **initTime / sendTime** | `Date.now()` | number |
| **anti-tamper key/val** | `te(state.to, state.no%10±1)` | string |
| **uaHmac** | `hmacMD5(uuid, ua)` | string (32 hex) |

⚠️ 这 14 字段对应的 b64 key 跨版本必变，**绝对不能硬编码**。每次升级用 `find_state_keys.py` 跨 6 批值匹配定位。

## 6.5 sid 隐写完整确认（含 cts 数字）

Bundle#2 的 sid 比 Bundle#1 更复杂：

```
Bundle#1 sid: <uuid>
              纯 UUID

Bundle#2 sid: <uuid> + <Unicode Tag Chars 编码 cts 时间戳的每位>
              UUID + 隐写

例:
  uuid = "51338389-11b8-11f1-bb6d-13e608bfecce"
  cts  = "1771967728434"
  sid  = "51338389-11b8-11f1-bb6d-13e608bfecce" + Tag('1') + Tag('7') + Tag('7') + Tag('1') + Tag('9') + Tag('6') + Tag('7') + Tag('7') + Tag('2') + Tag('8') + Tag('4') + Tag('3') + Tag('4')

Unicode Tag Chars 映射:
  Tag('0') = U+E0130
  Tag('1') = U+E0131
  Tag('2') = U+E0132
  ...
  Tag('9') = U+E0139
```

构造代码：

```js
function buildSidBundle2(uuid, cts) {
    let sid = uuid;
    for (const digit of cts) {
        const codePoint = 0xE0130 + parseInt(digit);   // U+E0130 + digit
        sid += String.fromCodePoint(codePoint);
    }
    return sid;
}
```

⚠️ Python `requests` 不能用 `unquote_plus` 处理 sid，会丢 Unicode Tag。用 `urllib.parse.quote_plus(sid, safe='')`。

## 6.6 Anti-Tamper 字段完整处理

```js
const AT_RE = /^[0-9:;<=>?@]{15,25}$/;

function te(input, key) {
    let out = '';
    for (let i = 0; i < input.length; i++) {
        out += String.fromCharCode(input.charCodeAt(i) ^ key);
    }
    return out;
}

function relocateAntiTamper(d, state) {
    const k1 = parseInt(state.no) % 10 + 1;   // ⭐ state.no 必须 parseInt
    const k2 = parseInt(state.no) % 10 + 2;
    const atKey = te(state.to, k2);
    const atVal = te(state.to, k1);

    // ⭐ 保留位置！不能 delete + add（坑 #17）
    const out = {};
    for (const k of Object.keys(d)) {
        if (AT_RE.test(k) && AT_RE.test(String(d[k]))) {
            out[atKey] = atVal;
        } else {
            out[k] = d[k];
        }
    }
    return out;
}
```

⚠️ `state.to` 是数字字符串（如 `"13468925768457352646"`，19-20 位）。每位字符是 ASCII `'0'-'9'` (0x30-0x39)。XOR 1-12 后落在 0x30-0x3F 范围 = `"0123456789:;<=>?"`。所以 AT 正则要含 `:` 和 `;`（坑 #18）。

## 6.7 OB#2 响应：拿到首版 _px3

Bundle#2 成功后 OB#2 一般只有 **2 个 segments**：

```
段 0: III0II|_px3|330|<value>|true|300
  → handler: oh() — 设置 _px3 cookie
  → name = "_px3"
  → ttl = 330 秒
  → value = 加密的 cookie 值（很长）
  → secure = "true"
  → maxAge = 300

段 1: I0I000|cu
  → handler: jf 设置
  → jf = "cu"  （还需按压！）
```

### 6.7.1 jf=cu vs jf=success

| jf 值 | 含义 | 下一步 |
|---|---|---|
| **`cu`** | 暂时有效但需按压确认 | 必须发 Bundle#3 |
| `success` | 完全有效 | 可以直接用 _px3 调业务 API |

实测一旦走了 Bundle 路径基本都是 `cu`（PX 不会跳过按压步骤）。

### 6.7.2 state.cts 类型变化

Bundle#1 的 `cts = UUID 字符串`；OB#2 的 `oh()` handler 触发 `Ao.trigger("sc", ...)`，会更新 cts 为 ms timestamp：

```
Bundle#1 POST: cts=513385fa-11b8-11f1-...   (UUID)
OB#2 → oh() → 更新内部 cts = Date.now() = 1771967728434
Bundle#3 POST: cts=1771967728434           (ms timestamp)
```

⚠️ 这是 `cts` 类型变化（坑 #27）。

## 6.8 提取 _px3 cookie

```js
function extract_px3(obSegments) {
    for (const seg of obSegments) {
        const args = seg.split('|').slice(1);   // 丢 handler key
        if (args.length >= 4 && /^_?px[23]$/.test(args[0])) {
            return {
                name:  args[0],            // "_px3"
                ttl:   parseInt(args[1]),  // 330
                value: args[2],            // 加密 cookie value
                secure: args[3] === "true",
                maxAge: parseInt(args[4]),  // 300
            };
        }
    }
    return null;
}
```

---

# 第七部分：Bundle#3 按压挑战

## 7.1 触发：jf=cu 信号

OB#2 里如果有段 `<flag>|cu`，意味着挑战还没完成，需要：
1. 浏览器在 captcha iframe 里渲染按压按钮
2. 用户按住 1-3 秒
3. 收集鼠标轨迹 + 错误栈 + DOM 编码 + WASM 输出
4. 发 Bundle#3

如果 OB#2 是 `<flag>|success` → 不用按压，直接拿 `_px3` 用。

## 7.2 6 个事件的严格顺序

⚠️ **Bundle#3 的 EV 数组实际是 6 个事件**（之前文档误写 5 个，2026-05-21 从 git f256b7e 恢复的原版 `px_bundle3_auto.user.js` 含 6 个 builder）。PC HMAC 校验对 `serialize([ev0, evMetrics, ev1, ev2, ev3, ev4])` 计算，**任何换顺序 = PC 不同 = 拒**。

iFood 实测严格顺序（来自 [`../script/userscripts/px_bundle3_auto.user.js`](../script/userscripts/px_bundle3_auto.user.js) `buildBundle3Events()` line 1145）：

| # | 事件类型 `t` | 字段数 | 含义 | seq |
|---|---|---|---|---|
| 0 | `N2sCLXEHBBg=`（WebGL/浏览器指纹）/或 `egIAQDxqCXU=`（按版本变） | **78** | 浏览器指纹（WebGL/Canvas/UA） | 2 |
| 1 | **`eEgNDj0nBzw=`（Metrics）** ⭐ **新增** | **18** | **PX 内部指标上报**（timing chain + 加密 metrics blob） | 3 |
| 2 | `FCwhKlFEIRs=`（mouseout）/或 `DhY0VEt6O2U=` | **20** | 单次 mouseout 交互事件 | 4 |
| 3 | **`PX561`**（核心） | **95** | ⭐ **核心：按压验证 + WASM 结果 + 鼠标轨迹** | 6 |
| 4 | `bHAWcioaE0I=`（onSolved） | **27** | captcha 完成回调（onSolvedCallback） | 7 |
| 5 | `XQUoAxhoKzg=`（PX11994） | **24** | 交互总结（差分轨迹 + DOM 统计） | 8 |

总字段数：78+18+20+95+27+24 = **262**（不是之前文档写的 244）

> ⚠️ **关键修正**：早期文档只写 5 事件，漏了 Event Metrics（PX 内部指标上报，含加密的 `mtr` blob：`{"v":1.008,"html":654,"js":274,"enc":2,"exec":628}`）。**这个事件必须发**，不发会被 PX 后端识别异常分布。原版 `buildBundle3Events(opts)` 有 `opts.skipMetrics` 选项可以跳过，但只在 metrics blob `en` 加密未还原时临时关掉，**生产路径必须含 Metrics**。

> 也有 PX 旧版用 `[PX10498, PX561, PX10496, PX535, PX11116]` 5 事件命名，那是更早版本。当前 iFood 实测 6 事件（含 Metrics）。

### 7.2.1 Event Metrics 详解（18 字段）

PX 内部 timing chain 上报。前 6 字段是关键 timing + 加密 metrics：

| # | 键 | 值 | 含义 |
|---|---|---|---|
| 1 | `DXV4M0gbewg=` | 3623 | timing T1（html 解析完成） |
| 2 | `X0MqRRotKnc=` | 4659 | timing T2（js 加载完成） |
| 3 | `PARJQnlqSXE=` | 4668 | timing T3（加密开始） |
| 4 | `SBh9Xg12fW4=` | 5283 | timing T4（执行完成）= performance.now() |
| 5 | `Ew9mCVZgbDo=` | `{"en":"","mtr":{...}}` | **加密 metrics blob**（en 加密暂未还原） |
| 6 | `EFAlFlY9JCU=` | `1771991238575` | 页面加载时间戳 |

剩余 12 字段是跟其它事件共享的 common tail（见 §7.3）。

**`mtr` blob 结构**：
```json
{
  "v":     1.008,    // PX SDK 版本号
  "html":  654,      // HTML 解析耗时 ms
  "js":    274,      // JS 加载耗时 ms
  "enc":   2,        // 加密耗时 ms
  "exec":  628       // 总执行耗时 ms
}
```

**`en` 字段**（外层加密）：实测 `""`（空串）也能过，PX 当前不强校验它。生产严格场景如需还原 AES-GCM 包装，可临时装 crypto.subtle hook 脚本抓密钥（旧版 `crypto_hook.user.js` 已废弃；现在直接看 `px_bundle3_auto.user.js` 内嵌的加密代码 Part 2）。

## 7.3 公共尾部字段（所有 6 事件共享 12 个）

每个事件末尾都带相同 12 个字段：

| 键 | 值 | 来源 | 分类 |
|---|---|---|---|
| `LVEXU2s1GmM=` | 2→4→6→7→8 | 全局事件序号，递增 | DYNAMIC |
| `MkpICHQiQzo=` | 5076→35646→43632 | `performance.now()` | DYNAMIC |
| `ZRlfGyNzUyA=` | `true` | PX 初始化完成标志 | STATIC |
| `Bh48XENxOW4=` | `1771991268575` | 服务器时间戳（/ns 响应） | SESSION |
| `PSEHY3tIA1c=` | UUID | `_pxUuid`，OB `ooIIoo` handler 生成 | SESSION |
| `UBRqVhV8YWA=` | `bPb2hiak...` (176 字符) | `_px3` cookie 加密后 token | SESSION |
| `dg4MTDNmB3s=` | `1003.200...` | `performance.timeOrigin` 精度值 | SESSION |
| `SlJwEAw8eis=` | `false` | 检测标志 | STATIC |
| `LnZUdGsYWUE=` | `"PX11745"` | 公共事件标记（硬编码） | STATIC |
| `bRFXEyt6XCk=` | `"pxhc"` | PX Human Challenge 标识 | STATIC |
| `W0MhQR4tKHs=` | `false` | 检测标志 | STATIC |
| `ST0zfwxXPk4=` | `c61dbd8a...` (695 字符) | `_px3` 完整 cookie 值（hash:token:1000:encrypted） | SESSION |

## 7.4 PX561（核心 95 字段）— Tier 1-5 分级

PX561 是 Bundle#3 最复杂的字段，按"伪造难度"分 5 个 Tier：

### 7.4.1 Tier 1 — 写死（约 50 字段）

直接硬编码，同浏览器 profile 下不变。

**布尔标志 21 个**：

| 键 | 值 | 推测来源 |
|---|---|---|
| `ZRlfGyNzUyA=` | `true` | PX 初始化标志 |
| `T3c1NQkTOwQ=` | `true` | captcha 可见性 |
| `UTUrdxRZJEM=` | `true` | challenge 类型标志 |
| `NSkPa3BBAFk=` | `true` | 按压检测启用 |
| `UiNhKBRAZh8=` | `true` | 交互验证通过 |
| `Hm8tZFsOK1c=` | `true` | 环境检测通过 |
| `R3Y0PQIXMgc=` | `true` | 功能支持标志 |
| `cgMBSDdiBnI=` | `true` | 功能支持标志 |
| `cyJAaTZDQF8=` | `true` | 验证完成标志 |
| `VidlLBBAZB8=` | `false` | bot 检测结果（非 bot） |
| `eEULDj4oDjU=` | `false` | 自动化工具检测 |
| `NAFHSnJiQng=` | `false` | devtools 检测 |
| `GwpoAV5qbDQ=` | `false` | 模拟器检测 |
| `DXh+M0gYcwg=` | `false` | headless 检测 |
| `OSQKb3xFDl0=` | `false` | selenium 检测 |
| `YG0TZiUMFVY=` | `false` | puppeteer 检测 |
| `cH0DdjUcBU0=` | `false` | phantom 检测 |
| `AWxyJ0QOdBE=` | `false` | 代理检测 |
| `FwZkDVJnZDg=` | `false` | 检测标志 |
| `SlJwEAw8eis=` | `false` | 检测标志 |
| `W0MhQR4tKHs=` | `false` | 检测标志 |

**屏幕/布局常量 10 个**：

| 键 | 值 | 来源 |
|---|---|---|
| `PAlPQnplT3M=` | `1920` | `screen.width` |
| `cRxCFzd/TiQ=` | `1080` | `screen.height` |
| `V0YkTRImIX4=` | `948` | captcha iframe `clientWidth` |
| `RTA2ewNQO00=` | `631` | captcha iframe `clientHeight` |
| `dEEHCjIhAT8=` | `505` | 按钮 `offsetTop` (Y 位置) |
| `XGlvYhoFaVQ=` | `530` | 按钮 `clientY` 区域 |
| `KntZcG8aXkU=` | `8` | `devicePixelRatio` 相关或 DOM 层级 |
| `FUBmS1MhZ3w=` | `4294967296` | `2^32`，`performance.memory.jsHeapSizeLimit` |
| `RBF3WgFzcWA=` | `4` | `navigator.hardwareConcurrency` |
| `aHUbfi0XHUs=` | `1` | 常量 |

**字符串常量 7 个**：

| 键 | 值 | 来源 |
|---|---|---|
| `TlZ0FAg/fCI=` | `"visible"` | `document.visibilityState` |
| `RTA2ewNcOks=` | `"pointerdown"` | 事件类型字符串 |
| `JVAWW2M8G28=` | `"pointerup"` | 事件类型字符串 |
| `VGFnahINZFw=` | `"zh-CN"` | `navigator.language`（你伪装哪种就填哪种） |
| `LnZUdGsYWUE=` | `"PX11745"` | 公共事件标记 |
| `bRFXEyt6XCk=` | `"pxhc"` | PX Human Challenge 标识 |
| `Dh89VEt6P2Y=` | `[""]` | 键盘输入记录（空 = 无输入） |

### 7.4.2 Tier 2 — 简单写活（约 25 字段）

需要运行时数据但容易伪造（递增计数器、`performance.now()`、错误栈模板替换 UUID）。

| 键 | 值 | 说明 |
|---|---|---|
| `YjoYOCReHAs=` | `1` | 点击次数 |
| `BXl/O0MccQ4=` | `0` | 失败计数 |
| `KDxSPm5XXA4=` | `0` | 重试计数 |
| `eyNBYT1KTFo=` | `0` | 超时计数 |
| `MD1DNnVbQQE=` | `1` | captcha 尝试次数 |
| `JxYUHWFxFi8=` | `241` | 按钮内 offsetX |
| `LVEXU2s1GmM=` | `6` | 全局事件序号 |
| `aR1THy92VyQ=` | `40522` | `performance.now()` 偏移量 |
| `MkpICHQhQD0=` | `4` | 事件内部序号 |
| `MkpICHQiQzo=` | `43632` | 当前 `performance.now()` |
| `IxIQGWVzFiI=` | `83672695` | 累计计数器（大数值） |
| `RBF3WgJ9cGs=` | `146665135` | 累计计数器 |
| `V0YkTREhJXg=` | `5592` | 时间差（captcha 显示到交互） |
| `InNReGQUV0s=` | `38954` | pointerup 后的 `performance.now()` |
| `Slt5EA86fSY=` | `38957` | WASM 执行完成时间 |
| `JxYUHWFxEw==` | `12217.200...` | 高精度 `performance.now()` |
| `QlNxGAc0fSg=` | `[5515, 1466]` | 时间间隔：[按压前等待, 按压持续时长] |
| `Czp4cU5Ye0Y=` | `[1771991261025, 1771991267105]` | 绝对时间戳数组 |
| `IxIQGWZwEy0=` | `[1771991266541]` | WASM 调用时刻 |
| `CXR6P0wWfQw=` | `814` | 时间差/坐标值 |
| `AhMxWEdxNmg=` | `1658` | 时间差（从按压到 WASM 完成） |

### 7.4.3 Tier 3 — Session 依赖（约 15 字段）

需要从前序请求链获取（UUID、_px3 token、服务器时间戳等）：

| 键 | 值 | 来源 | 说明 |
|---|---|---|---|
| `PSEHY3tIA1c=` | `a4cb3e50-...` | `_pxUuid` | OB `ooIIoo` handler 赋值 |
| `UBRqVhV8YWA=` | `bPb2hiak...` | `_px3` token | OB `IIIooo` handler 下发 |
| `ST0zfwxXPk4=` | `c61dbd8a...` | `_px3` 完整值 | hash:token:1000:encrypted |
| `Bh48XENxOW4=` | `1771991268575` | `/ns` 响应时间戳 | `Am()` 请求获取 |
| `QlNxGAcxci4=` | `1771991229618` | 页面加载时间戳 | captcha 页面加载时确定 |
| `Vi5sLBNGYR8=` | `f1085bff...` (32 字符) | MD5 指纹哈希 | 同浏览器 profile 不变 |
| `dgcFTDNhAXs=` | `ef643ce8...` (128 字符) | SHA-512 综合指纹 | 同浏览器 profile 不变 |
| `dg4MTDNmB3s=` | `1003.200...` | `performance.timeOrigin` 精度 | 同 session 不变 |
| `ZjcVPCNXGQc=` | `"v2.7.7"` | PX captcha SDK 版本 | 跟随脚本版本 |
| `Q3IwOQYQMwg=` | `"hgb"` | 挑战类型 (hold-gesture-button) | 服务器决定 |
| `M2IAKXYEBBM=` | `51` | 按钮宽度偏移 | 页面布局 |
| `eypIYT1IT1I=` | `52` | 按钮高度 | 页面布局 |
| `WitpIB9IbxE=` | `2508` | 超时/时间差值 | session 内固定 |
| `NkdFDHMlQzs=` | `97` | 挑战难度参数 | 服务器决定 |

### 7.4.4 Tier 4 — 鼠标轨迹（5 字段，伪造难度高）

| 键 | 值 | 说明 |
|---|---|---|
| `PAlPQnlqS3k=` | **544 点** `"x,y,timestamp"` | 完整轨迹 |
| `EmMhaFQBLFI=` | **150 点** `"x,y,timestamp"` | 过滤轨迹（约半数采样） |
| `OkJAAHwsRDE=` | `"0,0,32537\|-3,1,32538\|..."` | **差分鼠标轨迹**（dx,dy,timestamp） |
| `YQVbByduXz0=` | 25 点采样 | 轨迹子集 |
| `QlNxGAQ+dyw=` | 32 项交互事件 | mouseover/out/click/pointerup 时序 |

**轨迹分析示例**：

```
起点: (680, 669) t=33487  ← 页面右上方
经过: (403, 889) t=33620  ← 向左下移动，到达按钮区域
停留: (352, 525) t=33853→36850  ← 在按钮上停留约 3 秒（长按）
松开后: (384, 511) t=39610  ← 松开后轻微移动
```

**采样规则**：
- 完整轨迹：每 1-3ms 采样一次
- 过滤轨迹：每 2ms 采样（隔一个取）
- 必须呈现贝塞尔曲线特征（加速→减速→停止）
- 服务端有轨迹分析模型，检测直线/匀速/跳变等异常

### 7.4.5 Tier 5 — WASM 计算（3 字段）

**已在 Node.js 中完全复现**：

| 字段 | PX 代号 | 说明 |
|---|---|---|
| `Slt5EA85fiI=` | **PX12590** | `Ys.a()` 输出，64 字符 hex，非确定性（含随机数+UUID） |
| `MD1DNnVfRgQ=` | **PX12573/PX12610** | `Ys.b(Es)` 输出，127 字符编码串，确定性（Es+UUID→固定结果） |
| `AE0zBkUsPjQ=` | — | sensor 加密数据 (114 字符 hex) |

复现方案：

```js
const { initWasm } = require('./run_wasm');
const { a, b } = await initWasm(uuid);   // 传入 _pxUuid
const px12590 = a();                       // → Slt5EA85fiI=
const px12610 = b(Es);                     // → MD1DNnVfRgQ= (Es = PoW 原像)
```

**关键依赖**：
- `globalThis._pxUuid` — `b()` 必须读取（坑 #B1）
- `Es` = PoW 原像 — `sha256(candidate) === targetHash` 的反向查找结果
- PoW 算法 `poi()` 已完全逆向，搜索空间约 64 万次，秒级完成

### 7.4.6 错误堆栈（写活，跟 Chrome 版本绑定）

| 键 | 值 | 来源 |
|---|---|---|
| `EmooaFQOLV4=` | `"TypeError: Cannot read properties of null (reading '0') at _r (...main.min.js:2:21514) at fs (...) at os (...) at ...captcha.js...:2:582448 at Ws (...captcha.js...:2:334970) at Object.A [as onSolvedCallback] ..."` | `try/catch` 捕获 |

完整 stack ~1256 字符。**包含 uuid 和 vid 在 captcha.js URL 中，每 session 不同**。写活：替换 URL 中的 uuid/vid 即可。

⚠️ 行号跟 Chrome 大版本绑定（坑 #D7）。详见 [§16 SDK 漂移](#第十六部分sdk-漂移应对)。

### 7.4.7 DOM 探测（写活）

| 键 | 值 | 来源 |
|---|---|---|
| `MkNBCHQuRTw=` | `["nodeType","ELEMENT_NODE","matches",...]` (18 项) | Shadow DOM 属性遍历结果 |

**完整值**：

```json
["nodeType","ELEMENT_NODE","matches","closest","innerHTML","outerHTML",
 "insertAdjacentElement","insertAdjacentHTML","insertAdjacentText",
 "setHTMLUnsafe","getHTML","after","animate","append","before",
 "getAnimations","prepend","replaceChildren"]
```

这是对 captcha 按钮所在 Shadow DOM 元素的属性探测，用于检测 DOM 是否被篡改。**同浏览器版本固定，可写死**。

### 7.4.8 Pointer 事件（写活）

#### pointerdown

| 键 | 值 | 来源 |
|---|---|---|
| `TTg+cwtVPkQ=` | `309.5` | pointerdown `offsetX` |
| `RBF3WgF0dGw=` | `17.44` | pointerdown `offsetY` |
| `Ln9ddGgYWEU=` | `602.5` | pointerdown `clientX` |
| `WitpIBxJaRA=` | `364` | pointerdown `clientY` |
| `eWRKLz8HSR8=` | `37468` | pointerdown `performance.now()` |

#### pointerup

| 键 | 值 | 来源 |
|---|---|---|
| `Lx4cFWp6GiM=` | `309.5` | pointerup `offsetX` |
| `WitpIBxIaBs=` | `17.44` | pointerup `offsetY` |
| `Dz58dUlefEI=` | `602.5` | pointerup `clientX` |
| `YQxSByduVTY=` | `364` | pointerup `clientY` |
| `HCkvIllJKhc=` | `38936` | pointerup `performance.now()` |

**按压时长 = 38936 - 37468 = 1468ms（约 1.5 秒长按）**。

⚠️ `offsetX/Y` 精确到小数点（309.5, 17.44），说明是真实浏览器事件，**不是整数坐标**（坑 #B12）。

## 7.5 PX561 字段总计

```
21 布尔 + 10 屏幕常量 + 7 字符串常量 + 12 公共尾部固定 +
14 Session 字段 + 5 鼠标轨迹 + 3 WASM + 错误栈 + DOM 探测 +
~20 时间戳/计数器 + 10 pointer 事件 = ~95 字段
```

## 7.6 事件 #1 mouseout（20 字段）

```js
{
    HUFnQ1gtank=: 629,            // clientX
    HCAmIllJKhQ=: 164,            // clientY
    Rl58HAMwcS0=: "mouseout",    // 事件类型
    KnJQcGwZWEA=: "DIV",          // 目标元素 tagName
    aR1THy92VyQ=: 32536,          // performance.now()
    EmooaFQOLV0=: "true",         // 事件冒泡
    aR1THyx0WCw=: true,           // isTrusted
    // ... + 12 个公共尾部字段（见 §7.3）
}
```

**鼠标坐标和时间写活，其余写死**。

## 7.7 事件 #3 captcha 完成回调（27 字段）

```js
{
    egsJQD9vCHU=: "pxCaptcha",                       // captcha 类型标识（写死）
    Tl99FAg/cCY=: "www.ifood.com.br",                // 目标域名（写死）
    BXB2O0ARegw=: "https://cw-marketplace.ifood.com.br/...",  // 被拦截的 API URL（写死）
    X04sRRovIXE=: true,                              // 验证通过标志（写死）
    fy5MZTpKTF4=: false,                             // 移动端标志（写死）
    aHUbfi0XHkQ=: false,                             // 离线标志（写死）
    HUFnRV8p=:    "a91ae960-...",                    // captcha instance ID (= POST 的 ci，session 级)
    ZjcVPCNXGQc=: "v2.7.7",                          // SDK 版本（写活）
    WitpIB9IbxE=: 2508,                              // 超时值（写活）
    Fw9tDVJiaTY=: "<Myanmar 编码>",                   // WASM 数据（同 PX561）
    aR1THy92VyQ=: 40522,                             // performance.now()
    T3c1NQkTOwQ=: true,                              // 可见性（写死）
    TlZ0FAg/fCI=: "visible",                         // visibilityState（写死）
    EmooaFQOLV4=: "<错误堆栈>",                       // 含 uuid/vid（写活）
    // ... + 12 公共尾部字段
}
```

## 7.8 事件 #4 PX11994 交互总结（24 字段）

```js
{
    R389PQITNw8=: "PX11994",                              // 事件码（写死）
    SlJwEAw2fiY=: "https://www.ifood.com.br/restaurantes", // 当前页面 URL（写死）
    PABGQnlsTXA=: {"DIV":1,"#px-captcha":2},               // DOM 交互计数（写活）
    QAR6RgZhcHE=: "<UUID>",                                 // = _pxUuid（写活）
    cgoISDRvAX4=: 0,                                        // 计数器（写活）
    PkZEBHsvTzM=: true,                                     // 标志（写死）
    OkJAAHwsRDE=: "0,0,32537|-3,1,32538|...",              // ⭐ 差分鼠标轨迹（dx,dy,ts）
    YQVbByRuVDQ=: "",                                       // 键盘输入（空，写死）
    EXVrN1QcYQU=: 1771991228053,                            // 绝对时间戳（写活）
    YQVbByduXz0=: [25 点数组],                              // 轨迹子集（写活）
    a1NRUS04W2o=: "631x0",                                  // 视口位置（写死）
    QSU7ZwRIMlU=: [16 项对象数组],                          // 详细交互记录（含坐标、DOM）
    // ... + 12 公共尾部字段
}
```

### 7.8.1 差分鼠标轨迹格式

```
0,0,32537    ← 起始点
-3,1,32538   ← 向左 3px 向下 1px
-5,3,32538   ← 向左 5px 向下 3px
...

差分 = 当前坐标 - 上一个坐标
```

跟 §7.4.4 PX535 的"完整轨迹"是同一个数据的两种表示。

## 7.9 时序约束（PX 严格校验）

Bundle#3 各时间戳必须吻合：

```
pointerDown.ts          ────► A                       (37468)
pointerUp.ts            ────► A + duration（1-3 秒）  (38936)
mouse trajectory points ────► [mouseStartTs, mouseEndTs]
mouseEndTs              ≈ pointerDown.ts ± 100ms      (37380)
mouseStartTs            = mouseEndTs - duration       (35912)
mouse interactions ts   单调递增，覆盖整个会话
error stack ts          捕获错误时的 performance.now()
```

PX 至少校验：
1. `duration_field === pointerUp.ts - pointerDown.ts ± 100ms`（坑 #B13a）
2. `mouseEndTs ≈ pointerDown.ts ± 200ms`
3. 鼠标轨迹点数 vs duration 比率合理（544 点 / 1500ms ≈ 2.7 pt/ms）
4. 所有事件 init/sendTime 在 ±5 秒窗口

## 7.10 OB#3 响应：拿到有效 _px3

Bundle#3 通过后 OB#3 包含**有效** `_px3`：

```
段 0: <flag>|success                              ← jf=success ⭐
段 1: <set_cookie>|_px3|330|<value>|...           ← 有效 _px3
段 2: ...
```

`jf` 从 `cu` 变 `success` = 这次的 `_px3` **可以用于业务 API**。

---

# 第八部分：Bundle#4 fallback / telemetry

Bundle#4 是 Bundle 流程的"最后一步"，性质有两面。

## 8.1 双重身份

### 8.1.1 错误路径（fallback）

如果 Bundle#1/#2/#3 中任何一步出错（WASM 加载失败、PoW 超时、用户超时未按压），SDK 在浏览器里调 `errorReport()`，发 Bundle#4 给 PX 上报：

```json
{
    "result": "failed",
    "error": "wasm_load_timeout",
    "stage": "bundle2",
    "duration": 8500,
    "attempt": 1
}
```

### 8.1.2 telemetry 路径（success）

如果 Bundle#3 成功，**真浏览器也会发**一个 Bundle#4 作为"我成功了"的 telemetry：

```json
{
    "result": "success",
    "stage": "bundle3_done",
    "duration": 12300,
    "attempt": 1
}
```

用来 PX 后端做"成功率统计"。

## 8.2 何时发：两种说法 + 场景判断

业内有两种说法（实测两边都对，看场景）：

| 场景 | 发不发 Bundle#4？ | 理由 |
|---|---|---|
| **测试期 / 小规模**（每天 < 几百次） | 不发 | 不发也不会出问题；只关注 Bundle#1-3 流程 |
| **生产长跑 / 大规模**（每天上千次） | **必发** | 不发本身是 fingerprint —— 你所有会话都没 Bundle#4，跟真用户分布偏离 |

具体取舍跟你的 IP 池规模 + 并发量相关。**保守做法是都发**（坑 #B10）。

## 8.3 最简 Bundle#4 构造

```js
async function sendBundle4(uuid, state, ctx) {
    const event = {
        t: 'PX_TELEMETRY',
        d: {
            'result_key':   ctx.success ? 'success' : 'failed',
            'duration_key': Date.now() - ctx.startTime,
            'attempt_key':  ctx.attempt || 1,
            'uuid_key':     uuid,
        }
    };
    const payload = generatePayload([event], state.no, uuid);
    const pc = generatePC([event], uuid, TAG, 388);

    return fetch('.../assets/js/bundle?seq=3&rsc=4', {
        method: 'POST',
        body: formEncode({
            payload, appId: INIT_APP_ID, tag: TAG, uuid, ft: 388,
            seq: 3, en: 'NTA', bi: BI, cs: state.qa, pc,
            sid: ctx.sid, vid: state.vid, cts: state.cts,
            errorPayload: '',   // 成功路径留空
            rsc: 4,
        }),
    });
}
```

## 8.4 Bundle#4 跟 `do` 字段

Bundle#4 偶尔触发 `do` 字段（不是 `ob`）。`do` 用 `jl` 注册表派发（不是 `Ql`），通常是 PX 内部错误流：

```js
// ih(segments, isDo=true)
// → 用 jl 注册表
// → jl 是 Ql 的子集 + 内部 error handlers
```

主路径不会触发 `do`。

---

# 第九部分：状态机 + state.\* 跨请求传递

## 9.1 全局 state 字段一览

整个 Bundle 流程涉及的 15 个状态变量：

| state.X | 类型 | 含义 | 何时拿到 | 注入哪里 |
|---|---|---|---|---|
| `no` | string ms | 服务器时间戳 | OB#1 | payload 交织 key (B#2/#3/#4)，EV2 d 字段（**parseInt 后**） |
| `appId` | string | Bundle AppID | OB#1 seg#3 | EV2 d 字段（**不是** POST 参数那个） |
| `qa` | string 64 hex | challenge hash | OB#1 | POST 参数 `cs=` |
| `to` | string num | XOR base | OB#1 | anti-tamper 字段计算 |
| `pxsid` | UUID | session id | OB#1 | sid 参数（`pxsid + hh(no) + hh(cts)`） |
| `vid` | UUID | visitor id | OB#1 | POST 参数 `vid=` |
| `cts` | UUID then ms | cookie ts | OB#1 (UUID), OB#2 (ms) | POST 参数 `cts=`（**类型变化**） |
| `jf` | string | flow status | OB#2/#3 | 只读，决定下一步发 #3 还是直接拿 cookie |
| `eo` | string | fh 第二参数 | OB#1 (0IIII0) | 内部状态 |
| `ao` | string | HTTP 状态码 | OB#1 (0III0I00) | 内部状态 |
| `ro` | number | 时间戳（秒） | OB#1 (0III0I0I) | 内部状态 |
| `Lu` | UUID | PoW UUID | OB#1 (0II0I0) | PoW 备用路径 |
| `Mr` | object | cookie 配置 | OB#1 (IIIIII/II0III) | 内部 dict |
| `pow.{suffix,target,difficulty}` | mixed | PoW 三件套 | OB#1 (I0I0I0) | 本地求解 |
| `wasm.{a,b}` | string | WASM 输出 | 本地算 | EV2/EV3 d 字段 |

## 9.2 状态在哪个请求拿到、注入哪里（详细图）

```
Bundle#1 POST
  │ payload: 16 字段 + default_no=1604064986000 交织
  │ cs: 无, sid: 纯 UUID
  ▼
OB#1 (13 段) 提取:
  ─ jf = "cu"            (段 0, I0I000)
  ─ to = "<long num>"    (段 1, 0IIII0)
  ─ no = "<13-digit ms>" (段 2, 0III0I0I) ⭐
  ─ ro = no/1000
  ─ $a = "<bundle appId>" (段 3, II00II) ⭐
  ─ ao = "401"            (段 4, 0III0I00)
  ─ qa = "<64 hex>"       (段 5, III000) ⭐
  ─ visual = {...}        (段 6, 0II0III0)
  ─ PoW = {suffix, target, diff=16, isTrusted=false} (段 7, I0I0I0) ⭐
  ─ Lu = "<UUID>"         (段 8, 0II0I0)
  ─ Mr = {cc, rf, fp, ...} (段 9-12, IIIIII/II0III)
                    │
                    ▼ 本地算
                    ▼ PoW: ans = solvePow(suffix, target, 16) → ~9-60ms
                    ▼ WASM: a = wasmA(); b = wasmB(ans);
                    ▼
Bundle#2 POST
  │ payload: 228 字段 + state.no 交织 + 注入:
  │   - state.appId       → EV2 d 字段 (Bundle AppID)
  │   - parseInt(state.no) → EV2 d 字段 (serverNo)
  │   - state.to          → EV2 d 字段
  │   - PoW counter       → EV2 d 字段
  │   - WASM a            → EV2 d 字段 (PX12590)
  │   - WASM b            → EV2 d 字段 (PX12610)
  │   - anti-tamper k/v   → 替换原 anti-tamper 位置（不能 delete+add）
  │ cs: state.qa
  │ ci: <challenge UUID>
  │ sid: uuid + hh(state.no) + hh(cts)   ← Unicode Tag 隐写
  │ cts: state.cts (UUID)
  ▼
OB#2 (2 段) 更新:
  ─ _px3 (首版，jf=cu)    (段 0, III0II)
  ─ jf = "cu"              (段 1, I0I000)
  ─ state.cts 升级为 ms timestamp
                    │
                    ▼ 用户按压 1-3s（或合成）
                    ▼ 鼠标 544 点贝塞尔
                    ▼ 4 组错误栈合成
                    ▼ Myanmar DOM 编码
                    ▼
Bundle#3 POST
  │ payload: 5 个事件 EV 数组
  │   ev[0] = 78 字段浏览器指纹（重申）
  │   ev[1] = 20 字段 mouseout
  │   ev[2] = 95 字段 PX561 ⭐ (含 WASM 重算、PoW 重申、按压坐标、轨迹)
  │   ev[3] = 27 字段 onSolvedCallback
  │   ev[4] = 24 字段 PX11994（差分轨迹）
  │ cs: state.qa
  │ cts: ms timestamp（从 OB#2 拿到的新 cts）
  ▼
OB#3 提取:
  ─ jf = "success"       ⭐ 成功！
  ─ _px3 (有效版)
                    │
                    ▼
Bundle#4 (可选) telemetry
```

## 9.3 UUID 全程不变（关键约束）

⚠️ Bundle 流程的**所有 4 个 POST 共用一个 UUID v1**：
- POST URL 里的 uuid 参数
- payload 内部的 uuid 字段（多处出现）
- HMAC salt 里的 uuid（`"uuid:tag:ft"`）
- WASM `globalThis._pxUuid`（坑 #B1）
- sid 里的 base UUID

如果 Bundle#2 的 uuid 跟 Bundle#1 的不一样 → PX 看 state.pxsid 跟 uuid 关系断了 → 拒（坑 #B9）。

**iFood 实例**：4 个 POST 全用 `c83577f0-5420-11f1-9150-e1cff29e25cc`（举例）。

## 9.4 提取 state 的完整代码骨架

```js
/**
 * 从 OB segments 提取 Bundle 路径完整 state。
 * 不依赖 handler key 字符串（跨版本变），按 args shape 匹配。
 */
function extractBundleState(obSegments) {
    const state = { pow: {}, visual: {}, Mr: {} };

    for (const seg of obSegments) {
        const args = seg.split('|').slice(1);   // 丢 handler key

        // 1 个参数的段
        if (args.length === 1) {
            const v = args[0];

            // jf 状态标志
            if (/^(cu|success|blocked)$/.test(v)) {
                state.jf = v;
            }
            // 13 位 ms timestamp → state.no
            else if (/^1[5-9]\d{11}$/.test(v)) {
                state.no = v;
            }
            // 16-22 位数字 → state.to
            else if (/^\d{16,22}$/.test(v)) {
                state.to = v;
            }
            // 12-30 全小写字母数字 → bundle AppID
            else if (/^[a-z0-9]{12,30}$/.test(v) && !state.appId) {
                state.appId = v;
            }
            // 64 hex → challenge hash (qa)
            else if (/^[0-9a-f]{64}$/.test(v)) {
                if (!state.qa) state.qa = v;
            }
            // 4-20 hex → PoW suffix
            else if (/^[0-9a-f]{4,30}$/.test(v) && !state.pow.suffix) {
                state.pow.suffix = v;
            }
            // UUID
            else if (/^[a-f0-9-]{36}$/.test(v)) {
                if (!state.pxsid) state.pxsid = v;
                else if (!state.vid) state.vid = v;
                else if (!state.cts) state.cts = v;
            }
            // 短英文字符串
            else if (/^[a-z]{2,5}$/.test(v)) {
                if (!state.eo) state.eo = v;
            }
        }
        // 多参数段：PoW dispatch / 视觉挑战 / cookie 配置
        else if (args.length >= 3) {
            // I0I0I0 PoW main: (enabled, suffix, target, diff, isTrusted)
            if (/^[01]$/.test(args[0]) && /^[0-9a-f]{4,30}$/.test(args[1]) &&
                /^[0-9a-f]{64}$/.test(args[2])) {
                state.pow.suffix = args[1];
                state.pow.target = args[2];
                state.pow.difficulty = parseInt(args[3]) || 16;
                state.pow.isTrusted = args[4] === 'true';
            }
            // 0II0III0 视觉挑战
            else if (args.length === 5 && /^\d+$/.test(args[0]) && /^\d+$/.test(args[1]) &&
                     /^[0-9a-f]{64}$/.test(args[4])) {
                state.visual = {
                    startW: parseInt(args[0]),
                    startH: parseInt(args[1]),
                    wJump:  parseInt(args[2]),
                    hJump:  parseInt(args[3]),
                    hash:   args[4],
                };
            }
            // IIIIII cookie 配置: (featureName, ttl, value)
            else if (args.length === 3 && /^\d+$/.test(args[1])) {
                state.Mr[args[0]] = args[2];
            }
        }
        // II0III config 字符串
        else if (args.length === 1 && /^[a-z]+:[0-9]+(,[a-z]+:[0-9]+)*$/.test(args[0])) {
            for (const pair of args[0].split(',')) {
                const [k, v] = pair.split(':');
                state.Mr[k] = v;
            }
        }
    }

    return state;
}
```

> 完整版见 [`../../revers/ob.js`](../../revers/ob.js)（Bundle 扩展待补的 `extractBundleState` 函数）。

---

# 第十部分：229 字段完整分类

Bundle Payload 共 ~229 字段，事件类型 `"t": "aHwcfi4UFkw="`。所有 key 都是 base64 编码（每次 PX 脚本加载会变）。下面按 17 个类别完整列出。

**字段类型分布**：

| 值类型 | 数量 | 占比 |
|---|---|---|
| `boolean` | 107 | 46.7% |
| `string` | 72 | 31.4% |
| `number` | 40 | 17.5% |
| `object` (array/map/null) | 10 | 4.4% |
| **总计** | **229** | **100%** |

**分类分布**：

| 分类 | 字段数 |
|---|---|
| 基础环境 | 7 |
| 浏览器标识 | 14 |
| 屏幕与显示 | 18 |
| 语言与时区 | 5 |
| 硬件检测 | 8 |
| 网络信息 | 6 |
| 插件信息 | 4 |
| Canvas/WebGL/音频指纹 | 12 |
| API 与功能检测 | 56 |
| Cookie 与存储 | 6 |
| **安全检测（Bot/Automation）** | **42** |
| PX 内部状态 | 33 |
| 其他哈希 | 16 |
| 错误捕获 | 2 |
| UA Client Hints | 6 |
| 杂项 | 9 |

> ⚠️ 注意：以上 b64 key 列是当前 iFood SDK 版本的。**新 SDK 升级后 key 会全部变**，但**对应的语义不变**。新版本时用 `find_state_keys.py` 跨 6 批值匹配重新对应。

## 10.1 基础环境（7 字段）

页面 URL、referrer、origin 等页面级信息。

| Base64 Key | 值（截断） | 浏览器 API |
|---|---|---|
| `LnZadGgdXUM=` | `"https://www.ifood.com.br/restaurantes"` | `location.href` |
| `YGQUZiUJFVc=` | `"https%3A%2F%2F..."` | `encodeURIComponent(location.href)` |
| `OAxMTn5kRns=` | `["https://www.ifood.com.br"]` | `document.referrer` 或 ancestor origins |
| `Bz9zfUJXdU4=` | `"https:"` | `location.protocol` |
| `N28DLXEBBBY=` | `"visible"` | `document.visibilityState` |
| `WQ0tDxxlKDo=` | `"w3c"` | Event model detection |
| `egIOQD9qCnQ=` | `"screen"` | PX mount point detection（`window.screen` 上挂载函数检测） |

## 10.2 浏览器标识（14 字段）

`navigator` 对象上的各种标识属性。

| Base64 Key | 值 | 浏览器 API |
|---|---|---|
| `CzN/cU1ZeUc=` | UA 字符串 | `navigator.userAgent` |
| `GmIuYF8NK1I=` | UA 字符串 | `navigator.userAgent` 的二次采集 |
| `QAR0RgVqdnA=` | `"5.0 (Windows NT 10.0; Win64; x64)..."` | `navigator.appVersion` |
| `U0snSRYiIXM=` | `"Win32"` | `navigator.platform` |
| `ZRlRGyN8UCg=` | `"Netscape"` | `navigator.appName` |
| `HUFpQ1sobXg=` | `"Mozilla"` | `navigator.appCodeName` |
| `AEQ0BkUpPzU=` | `"Gecko"` | `navigator.product` |
| `NAhASnJsQ3A=` | `"20030107"` | `navigator.productSub` |
| `QAR0RgVsf3w=` | `"webkit"` | `navigator.vendor` prefix |
| `b1dbVSo/WWE=` | `"webkit"` | CSS vendor prefix 检测结果 |
| `WiJuIB9KbBI=` | `""` | `navigator.vendorSub`（通常空） |
| `Z19TXSIyU2g=` | `true` | `navigator.cookieEnabled` |
| `XQEpAxtkKDg=` | `true` | `navigator.onLine` |
| `HwdrBVpvbTU=` | `"function share() { [native code] }"` | `navigator.share.toString()` |

## 10.3 屏幕与显示（18 字段）

屏幕分辨率、窗口大小、色深。

| Base64 Key | 值 | 浏览器 API |
|---|---|---|
| `KV0dX284Gm4=` | `1920` | `screen.width` |
| `LDBYMmpaUwE=` | `1080` | `screen.height` |
| `EFQkFlU4JSU=` | `1920` | `screen.availWidth` |
| `IUUVR2QpFH0=` | `1032` | `screen.availHeight` |
| `KV0dX2wxG20=` | `1920` | `window.outerWidth` |
| `MDRENnZfQgU=` | `1032` | `window.outerHeight` |
| `V08jTRIhKHg=` | `"1920X1080"` | 拼接分辨率 |
| `Fm4ibFMDIV0=` | `32` | `screen.colorDepth` |
| `ajIeMCxcFQI=` | `32` | `screen.pixelDepth` |
| `fEAIAjkrAzY=` | `0` | `window.screenX` |
| `fgYKRDttAXE=` | `0` | `window.screenY` |
| `a1NfUS06VWc=` | `420` | `window.innerWidth` |
| `XiZqJBtPaBc=` | `948` | `window.innerHeight` |
| `Y1tXWSYyUGg=` | `0` | `window.scrollX` |
| `DhY6VEt/PWE=` | `0` | `window.scrollY` |
| `LDBYMmpUUgE=` | `1` | `window.devicePixelRatio` |
| `Q3s3OQYWMQ8=` | `2` | `screen.orientation.type` |
| `dWlBKzABSx4=` | `2` | `visualViewport.scale` |

## 10.4 语言与时区（5 字段）

| Base64 Key | 值 | 浏览器 API |
|---|---|---|
| `aR1dHy91Vi4=` | `"zh-CN"` | `navigator.language` |
| `EwtnCVVgbDo=` | `["zh-CN","en","en-GB","en-US"]` | `navigator.languages` |
| `BFgwGkI2Oig=` | `-480` | `new Date().getTimezoneOffset()` |
| `b1dbVSo/XWQ=` | `"Asia/Shanghai"` | `Intl.DateTimeFormat().resolvedOptions().timeZone` |
| `CzN/cU1WeEM=` | `"Wed Feb 25 2026 10:06:47 GMT+0800..."` | `new Date().toString()` |

## 10.5 硬件检测（8 字段）

| Base64 Key | 值 | 浏览器 API |
|---|---|---|
| `ZHgQeiITEUk=` | `8` | `navigator.hardwareConcurrency` |
| `bRFZEyt6XyY=` | `4` | `navigator.deviceMemory` |
| `dEgACjIjCz0=` | `16` | WebGL `MAX_TEXTURE_SIZE` 或类似 |
| `SlJ+EAw6eCc=` | `4294967296` | `performance.memory.jsHeapSizeLimit` |
| `eW1NLz8FTBQ=` | `131385816` | `performance.memory.usedJSHeapSize` |
| `eW1NLz8ITR4=` | `166304664` | `performance.memory.totalJSHeapSize` |
| `X0crRRovKHE=` | `"x86"` | `navigator.userAgentData.architecture` |
| `JDhQOmFQUw8=` | `"64"` | `navigator.userAgentData.bitness` |

## 10.6 网络信息（6 字段）

`navigator.connection`（Network Information API）。

| Base64 Key | 值 | 浏览器 API |
|---|---|---|
| `KV0dX281GGw=` | `"4g"` | `navigator.connection.effectiveType` |
| `SBx8Xg53d28=` | `10` | `navigator.connection.downlink` |
| `Aho2WEd1MWs=` | `0` | `navigator.connection.rtt` |
| `AEQ0BkUsPj0=` | `0.2` | `saveData` 相关 |
| `BXlxO0ARdQA=` | `{"support":true,"status":{...}}` | 完整 connection 状态 |
| `AWV1J0QNfhQ=` | `"default"` | `Notification.permission` 或 `connection.type` |

## 10.7 插件信息（4 字段）

| Base64 Key | 值 | 浏览器 API |
|---|---|---|
| `EXVlN1QYYAw=` | `["PDF Viewer","Chrome PDF Viewer","Chromium PDF Viewer","Microsoft Edge PDF Viewer","WebKit built-in PDF"]` | `navigator.plugins` |
| `DhY6VEt5MWA=` | `5` | `navigator.plugins.length` |
| `PSEJY3hJD1Q=` | `{"plugext":{...},"plugins_len":5}` | 详细插件信息 |
| `bjYaNCtfGQ4=` | `[]` | `navigator.mimeTypes` 额外检测 |

## 10.8 Canvas / WebGL / 音频指纹（12 字段）

| Base64 Key | 值 | 含义 |
|---|---|---|
| `UipmKBRCZRI=` | `"49e5084e"` | Canvas 2D fingerprint hash |
| `UipmKBRDYBg=` | `"7c5f9724"` | Canvas 2D 第二组 hash |
| `Fw9jDVJgYTc=` | `"65d826e0"` | WebGL fingerprint hash |
| `LnZadGsfUUc=` | `"a9269e00"` | WebGL extensions hash |
| `GwNvAV1pZDM=` | `"50a5ec55"` | WebGL parameters hash |
| `b1dbVSo8XmU=` | `"73a0fb26"` | WebGL unmasked renderer hash |
| `DhY6VEt+PmU=` | `"537fea6e"` | AudioContext fingerprint hash |
| `DhY6VEt+OGE=` | `33` | AudioContext sampleRate/1000 |
| `bRFZEyh5XSA=` | `"ff702ecc"` | Audio oscillator fingerprint hash |
| `RBhwWgJ9dW8=` | `"missing"` | WebGL2 检测结果 |
| `MkpGCHciRD8=` | `"TypeError: ..."` | WebGL/Canvas error |
| `aHwcfi0UFkk=` | `"AudioData.SVGAnimatedAngle.SVGMetadataElement"` | DOM interface fingerprint |

### 10.8.1 哈希生成源码（main.js）

16 个哈希字段的生成位置：

| # | 指纹类型 | main.js 行号 | 函数 | 输入 |
|---|---|---|---|---|
| 1 | Canvas #1 (emoji) | 7487-7510 | `lp()` 内 Promise | `canvas 650×12, fillText(U+1F600~U+1F66E), toDataURL()` |
| 2 | Canvas #2 (glyph) | 7513-7544 | `lp()` 内 Promise | `canvas 860×6, 39 种 Unicode 字符, toDataURL()` |
| 3 | AudioContext | 7545-7597 | `lp()` 内 Promise | `OfflineAudioContext(1ch, 44100Hz), oscillator+compressor, samples[4500:5000] 绝对值求和` |
| 4 | 字体检测 | 6980-7058 | `Tv()` | DOM 元素宽高比较不同字体渲染差异 |
| 5 | Math 函数 | 7433-7448 | `sp()` 内 | `10 个 Math 函数 × 8 个常量 = 80 值` → JSON |
| 6 | 语音合成 | 7455-7470 | `sp()` 内 | `speechSynthesis.getVoices()` 属性遍历 |
| 7 | WebGL shader 渲染 | 7188-7246 | `Pv()` | fragment shader → `readPixels()` 蓝通道 26 采样点 |
| 8 | UIEvent 属性枚举 | 7360-7373 | `hp()` | `UIEvent.prototype` 所有属性拼接 → R() |
| 9 | WebKitCSSMatrix 枚举 | 7360-7373 | `hp()` | `WebKitCSSMatrix.prototype` 属性拼接 → R() |
| 10 | WebGLContextEvent 枚举 | 7360-7373 | `hp()` | `WebGLContextEvent.prototype` 属性拼接 → R() |
| 11-16 | 组合指纹（CRC32） | 7256-7389 | `np` 数组 | 屏幕/时区/语言/硬件/API 各维度 |

汇聚点：

```
lp() (line 7486) — 主入口
  ├── Promise.all() 并行采集:
  │   ├── Tv()          → 字体 MD5
  │   ├── Canvas #1     → emoji 渲染 MD5
  │   ├── Canvas #2     → glyph 渲染 MD5
  │   ├── AudioContext  → 音频 MD5
  │   ├── Pv()          → WebGL shader hash
  │   └── sp()          → Math + 语音 MD5
  ├── np 数组           → 同步采集 56+ 特征（含 CRC32）
  ├── hp()              → 构造器属性枚举 hash
  └── line 7598         → 合并所有结果到事件对象 d
```

### 10.8.2 关键认知：哈希不需要 Node 重新实现

⚠️ 16 个哈希值**不需要**在 Node 中重新实现 Canvas/WebGL/Audio 渲染。**同一浏览器 profile 下这些值是确定性的**：

1. 在真实浏览器（Chrome 145 + Windows + 目标 GPU）中运行 PX 脚本一次
2. 抓取哈希值
3. 写死到 generator

跨浏览器版本会变 → 维护多套（Chrome 140/145/148/150 各一套）。

## 10.9 API 与功能检测（56 字段）

检测浏览器支持哪些 Web API，返回布尔值。这是 PX 给浏览器做"能力指纹"的关键 —— 真实浏览器的 API 组合是独特的。

| Base64 Key | 值 | 浏览器 API |
|---|---|---|
| `fydLZTpMTlM=` | `true` | `navigator.sendBeacon` |
| `NAhASnFjRX0=` | `true` | `window.fetch` |
| `PkZKBHstTzA=` | `true` | `window.XMLHttpRequest` |
| `FCggKlFDJR8=` | `false` | `window.ActiveXObject`（IE only） |
| `MVUFV3Q+AG0=` | `true` | `window.WebSocket` |
| `Bh4yXEN1N2c=` | `true` | `window.Worker` |
| `Jn5SfGMVVk4=` | `true` | `window.SharedWorker` 或 `ServiceWorker` |
| `bHAYcikeGEU=` | `true` | `window.localStorage` |
| `ST09fwxSO0k=` | `true` | `window.sessionStorage` |
| `EmomaFQCIVo=` | `true` | `window.indexedDB` |
| `aR1dHy90Wis=` | `true` | `window.requestAnimationFrame` |
| `DhY6VEh+OWU=` | `true` | `window.performance` |
| `KV0dX281GW0=` | `true` | `navigator.connection`（Network Information） |
| `IxsXGWVyFC0=` | `true` | `window.Intl` |
| `ICRUJmVNUx0=` | `true` | `window.crypto` 或 `crypto.subtle` |
| `P2cLJXkMDRc=` | `true` | `window.Notification` |
| `b1dbVSk/X2E=` | `true` | `window.Promise` |
| `BFgwGkE2MiA=` | `true` | `window.Proxy` |
| `CzN/cU1ddEc=` | `true` | `window.Reflect` |
| `X0crRRkiIHE=` | `true` | `window.Symbol` |
| `HwdrBVpqbTQ=` | `true` | `document.createElement` |
| `fydLZTpOS1Y=` | `1` | `document.compatMode`（1=CSS1Compat） |
| `a1NfUS04W2c=` | `true` | `window.TextEncoder`/`TextDecoder` |
| `Jx8THWF6Fyg=` | `true` | `navigator.mediaDevices` |
| `bHAYcikcG0A=` | `true` | `window.AudioContext` |
| `KDxcPm1XWQ0=` | `true` | `window.OffscreenCanvas` |
| `fEAIAjkpDDc=` | `true` | `window.WebAssembly` |
| `fEAIAjkoDzg=` | `true` | `navigator.getBattery` |
| `ZHgQeiEQF0E=` | `true` | `navigator.credentials` |
| `TBB4Ugl7c2g=` | `true` | `window.IntersectionObserver` |
| `HUFpQ1gpbnU=` | `true` | `window.MutationObserver` |
| `fydLZTpKS1E=` | `true` | `window.ResizeObserver` |
| `Q3s3OQYVMQ0=` | `true` | `window.PerformanceObserver` |
| `Nk5CDHAmQzw=` | `true` | `window.AbortController` |
| `MDRENnVbRwA=` | `true` | `window.BroadcastChannel` |
| `ICRUJmZNURA=` | `true` | `window.Map`/`Set` |
| `XGBoYhoEaFg=` | `true` | `window.Blob`/`File` |
| `Jn5SfGAVUUw=` | `true` | `window.URL`/`URL.createObjectURL` |
| `Vi5iLBBGYh0=` | `true` | `document.fonts`（CSS Font Loading API） |
| `KDxcPm5SWgo=` | `true` | `window.queueMicrotask` |
| `IxsXGWZyFi0=` | `true` | `window.structuredClone` |
| `Q3s3OQURPQo=` | `true` | `navigator.locks`（Web Locks API） |
| `GU1tT18lb3o=` | `true` | `navigator.storage`（Storage API） |
| `Vi5iLBNGYx4=` | `true` | `window.Scheduler` |
| `eEwMDj0jCDQ=` | `true` | `window.ReportingObserver` |
| `R38zPQIUOAs=` | `true` | `window.isSecureContext` |
| `VGhgahIAZ1A=` | `false` | `window.showModalDialog`（已废弃） |
| `ICRUJmVJVR0=` | `false` | `window.opera` |
| `M2sHKXUABx0=` | `false` | `document.all`（IE） |
| `SBx8Xg1yf2g=` | `false` | `window.phantom`（PhantomJS） |
| `Azt3eUVVd0w=` | `false` | `navigator.webdriver` |
| `VGhgahEAalw=` | `false` | `window.domAutomation` |
| `Dzd7dUpffkE=` | `false` | `window.callPhantom` |
| `MVUFV3Q9Bmw=` | `false` | `navigator.plugins` 被 override |
| `X0crRRkpL3U=` | `false` | `navigator.permissions` 异常 |
| `S3M/MQ4YOwE=` | `false` | `navigator.brave` |

## 10.10 Cookie 与存储（6 字段）

| Base64 Key | 值 | 浏览器 API |
|---|---|---|
| `WiJuIB9JZBA=` | `true` | `navigator.cookieEnabled` |
| `WiJuIB9KbBY=` | `true` | `document.cookie` 可写入/读取 |
| `WGxsbh4Ja1s=` | `true` | `localStorage` 可用 |
| `ZRlRGyBxWio=` | `{"smd":{"ok":true,"ex":false}}` | Storage Manager API 检测 |
| `HCAoIllILBg=` | `{}` | Cookie jar 状态或第三方 cookie 检测 |
| `HCAoIllLKxI=` | `{"l":"o","7nJF":false}` | PX cookie/storage 内部状态 |

## 10.11 安全检测（42 字段）— Bot 检测最大重点

⭐ **42 个字段专门用于检测自动化工具**，占总字段 18.3%。PX 对 bot 检测投入极大。

| Base64 Key | 值 | 含义 |
|---|---|---|
| `Azt3eUVVd0w=` | `false` | `navigator.webdriver`（自动化标志） |
| `SBx8Xg1yf2g=` | `false` | PhantomJS 检测 |
| `Dzd7dUpffkE=` | `false` | `window.callPhantom` |
| `VGhgahEAalw=` | `false` | Selenium 检测 |
| `egIOQDxqD3Q=` | `false` | `window.emit` 或 CasperJS |
| `W0MvQR0oJHc=` | `false` | `window.__nightmare`（NightmareJS） |
| `dg4CTDBrBnk=` | `false` | `document.documentElement.getAttribute("webdriver")` |
| `TlZ6FAg9fi4=` | `false` | Headless 检测（`chrome.runtime === undefined`） |
| `Bz9zfUJReUg=` | `false` | `window.Buffer`（Node.js 环境） |
| `HwdrBVpqYDc=` | `0` | DevTools 检测分数 |
| `NAhASnJmS38=` | `0` | DevTools 尺寸差异 |
| `EFQkFlU8IiQ=` | `0` | `console.log` 时间差检测 |
| `cgoGSDdhBXw=` | `1` | PX 环境检查通过计数 |
| `GCwsLl1DLxs=` | `1` | 环境完整性评分 |
| `KnJecGwaXko=` | `3` | PX 信任等级（3=可信） |
| `GCwsLl5JJx0=` | `["loadTimes","csi","app"]` | `Object.keys(window.chrome)` |
| `GU1tT1wlbHk=` | 长 base64（Myanmar Unicode 编码签名） | 环境特征编码签名 |
| `Jn5SfGAQUU0=` | `false` | `window.cdc_adoQpoasnfa76pfcZLmcfl_Array`（ChromeDriver 检测） |
| `W0MvQR0rLXY=` | `false` | Puppeteer 检测 |
| `Dzd7dUpbe0Q=` | `false` | `window.domAutomationController` |
| `FCggKlFGJxg=` | `false` | `navigator.languages` 为空（headless 特征） |
| `YGQUZiYOFFw=` | `false` | `window.outerWidth === 0`（headless） |
| `EmomaFQAJ1k=` | `false` | `navigator.plugins.length === 0`（headless） |
| `fydLZTlJQF4=` | `false` | `Notification.permission === "denied"` |
| `fEAIAjolCDk=` | `false` | `window.chrome` 缺失（headless） |
| `SBx8Xg51eWw=` | `false` | WebGL renderer 含 "swiftshader"（headless） |
| `W0MvQR4vLHE=` | `false` | `navigator.permissions.query` 异常 |
| `fWFJIzsPTRk=` | `false` | `Function.prototype.toString` 被 hook |
| `AEQ0BkUqNjM=` | `false` | `Object.getOwnPropertyDescriptor` 被篡改 |
| `CX19P0wWeQw=` | `false` | iframe sandbox 环境检测 |
| `KnJecG8aVUU=` | `false` | `window.Cypress` |
| `Azt3eUVQfU8=` | `false` | `HTMLElement.prototype` 被篡改 |
| `cRVFFzR6TyE=` | `false` | `Element.prototype.attachShadow` 被覆盖 |
| `HmYqZFsOLVM=` | `false` | `toString` proxy detection |
| `GwNvAV5rZTA=` | `false` | `document.hasFocus() === false`（headless） |
| `X0crRRovKX8=` | `false` | `navigator.userAgentData.brands` 缺失 |
| `AWV1J0QKchw=` | `false` | `Error.captureStackTrace` 异常（V8 特征） |
| `ST09fw9TOUQ=` | `false` | PX tamper detection |
| `YGQUZiUKE1w=` | `false` | CDP 检测 |
| `KxMfEW5+HiI=` | `"false"` | `navigator.webdriver`（字符串化） |
| `SlJ+EA87fyM=` | `"false"` | headless mode（字符串化） |
| `HmYqZFgOL1Y=` | `4141` | Performance timing 差异 |

### 10.11.1 反检测关键点

- 必须确保 `navigator.webdriver === false` 且**不是**通过 `Object.defineProperty` 伪造的（PX 检测 descriptor 篡改）
- `Function.prototype.toString` 不能被 hook
- Canvas/WebGL 哈希必须与真实浏览器一致
- 四个时间戳的间隔必须合理（不能太快也不能太慢）
- 错误堆栈格式必须符合 V8 引擎规范
- `navigator.plugins` 必须返回 5 个 PDF 相关插件（Chromium 标准）
- `navigator.connection` API 必须完整实现
- `navigator.userAgentData` 与 `navigator.userAgent` 必须一致

## 10.12 PX 内部状态（33 字段）

PX 脚本内部生成的时间戳、会话 ID、事件标识。

| Base64 Key | 值 | 含义 |
|---|---|---|
| `eW1NLz8ETRw=` | `1771985206868` | PX 事件时间戳 |
| `b1dbVSk5W2U=` | `1771985207333` | 采集完成时间 |
| `KV0dX28zFmg=` | `1771985206622` | 脚本初始化时间 |
| `Rl5yHAMxeS4=` | `1771985208123` | payload 构建完成时间 |
| `fEAIAjopAjY=` | UUID | PX session UUID |
| `UTUldxRbJkI=` | `"PX11745"` | PX event type ID |
| `UBRkVhZ/YWw=` | `"pxhc"` | PX handler context |
| `QAR0RgVodnw=` | `"d6f5idih05as73cfjhg0"` | PX session ID（短格式） |
| `FUlhS1AiYng=` | `"3"` | PX request sequence number |
| `TBB4Ugl4fWQ=` | `"_Yzh0BIWEAws-fLVwkQbx17Pdl27vRvi..."` | `_px3` cookie 当前值 |
| `S3M/MQ4ZPAA=` | `"2f7b7d4363ccd1fe...:1bj7B/n4Yx3U..."` | `_pxde` 或 PX 加密 token（SHA256:base64:counter = PoW 答案） |
| `BXlxO0AQdw0=` | `8325` | PX internal counter（PoW 求解时间或事件计数） |
| `TlZ6FAs+fyM=` | `995` | PX timing metric（采集耗时 ms） |
| `KxMfEW58GCs=` | `3600` | PX token TTL |
| `Bz9zfUFVcEo=` | `501` | PX score / status code |
| `IUUVR2cvFnQ=` | `"17919146633600128771"` | PX entropy value |
| `dg4CTDNlAX4=` | `"cAzxw"` | PX obfuscation key fragment |
| `XGBoYhkLa1k=` | `"{H>Jc7\|)/KRfy{rZz"` | PX encrypted token / nonce |
| `V08jTRIjIns=` | `1` | PX version 或 bundle request number |
| `Zj4SPCBVEQc=` | `1` | PX protocol version |
| `MVUFV3Q5AGw=` | `1` | PX flags |
| `UipmKBROZRg=` | `1` | PX internal state counter |
| `HwdrBVpvYDU=` | `3` | PX collect stage（3=bundle phase） |
| `QAR0RgVqdHQ=` | `"109\|66\|66\|70\|80"` | PX timing chain（各阶段耗时 pipe-separated ms） |
| `ICRUJmVPVxE=` | `""` | PX error/debug field |
| `S3M/MQ4cNQI=` | `""` | PX previous session token |
| `eyNPYT5NRFo=` | `""` | PX referral token |
| `TTE5cwtZOEk=` | `""` | PX cached state |
| `OAxMTn1lR3o=` | `null` | PX deferred value |
| `;=3;3;><<99<::;82==;` | `"8>0808=??::?998;1>>8"` | **PX obfuscated key-value**（XOR/shift 编码的内部校验值，= anti-tamper 字段！） |
| `NAhASnJtQH8=` | `0` | PX error count |
| `TTE5cwtaOUM=` | `0` | PX retry count |
| `IxsXGWVyFCI=` | `0` | PX block count |

## 10.13 其他哈希（16 字段）

8 字符 hex 或 32 字符 MD5。

| Base64 Key | 值 | 含义 |
|---|---|---|
| `LnZadGgTWUI=` | `"f3fe87a85c90985c69d7a8566da77dc0"` | 综合指纹 MD5 (32 char) |
| `TTE5cwtbPkc=` | `"663433d45234e7269b3e033766fa335f"` | 环境指纹 MD5 |
| `Y1tXWSU1U2o=` | `"e8562ccdde5d5ab3e404bf8279feebd2"` | 浏览器特征组合 MD5 |
| `EwtnCVZjZDo=` | `"0498b8de2c168ecb09b8c15ab39f1d62"` | Canvas/WebGL 组合 MD5 |
| `YjoWOCdUEwg=` | `"f49f18dbec5558a76590af096c339826"` | 字体/插件组合 MD5 |
| `Jx8THWJ3Eig=` | `"3207084bd110f1ac964863e23aa78e04"` | UA Client Hints 组合 MD5 |
| `WiJuIBxKbhs=` | `"64556c77"` | 短指纹 hash (CRC32) |
| `HCAoIllPLBE=` | `"10207b2f"` | 存储指纹 CRC32 |
| `egIOQDxnCXs=` | `"10207b2f"` | 存储指纹 CRC32（与上相同=同一数据源） |
| `YjoWOCdTEw4=` | `"90e65465"` | API 检测组合 CRC32 |
| `KxMfEW14GiA=` | `"9f762773"` | 屏幕参数 CRC32 |
| `Qlp2GAc0cS0=` | `"dae10548"` | 时区/语言 CRC32 |
| `ICRUJmZBXxc=` | `"a3d12c4"` | 硬件参数 CRC32（7 字符，可能截断） |
| `HCAoIlpELhk=` | `"82002457"` | 网络参数 CRC32 |
| `UipmKBdDbRk=` | `"a3d12c4"` | 硬件参数 CRC32（与上相同） |
| `Jx8THWF6GSg=` | `"90e65465"` | API 检测 CRC32（与上相同） |

> 相同哈希出现多次（`a3d12c4`, `90e65465`, `10207b2f`）说明 **PX 故意做字段交叉验证** —— 单独伪造一个字段不行，必须保持哈希组之间的一致性。

## 10.14 错误捕获（2 字段）

故意触发 JS 错误，捕获堆栈作为指纹。

| Base64 Key | 值（截断） | 含义 |
|---|---|---|
| `Fm4ibFAKKVo=` | `"TypeError: Cannot read properties of null (reading '0')\n    at _r (https://client.px-cloud.net/PXO1GDTa7Q/main.min.js:2:21543)..."` | PX 主脚本内部 error trace |
| `MkpGCHciRD8=` | `"TypeError: Cannot read properties of undefined (reading 'width')"` | WebGL/Canvas 检测 error |

⚠️ 不同浏览器/Node 的堆栈格式不同，**这是一种高级指纹技术**。详见坑 #D7。

## 10.15 UA Client Hints API（6 字段）

`navigator.userAgentData` 及 `getHighEntropyValues()` 获取的数据。

| Base64 Key | 值 | 浏览器 API |
|---|---|---|
| `Jx8THWJ3ECc=` | `[{"brand":"Not:A-Brand","version":"99"},{"brand":"Microsoft Edge","version":"145"},{"brand":"Chromium","version":"145"}]` | `navigator.userAgentData.brands` |
| `XiZqJBtOaBc=` | `"Windows"` | `navigator.userAgentData.platform` |
| `Jx8THWJ3ES0=` | `"19.0.0"` | `platformVersion` |
| `DFA4Ekk4OiM=` | `"145.0.3800.70"` | `fullVersionList[x].version` |
| `X0crRRovKHE=` | `"x86"` | `architecture` |
| `JDhQOmFQUw8=` | `"64"` | `bitness` |

## 10.16 杂项与未分类（9 字段）

| Base64 Key | 值 | 推断 |
|---|---|---|
| `GCwsLl1DLxs=` | `1` | PX client version |
| `cgoGSDdhBXw=` | `1` | 环境验证通过次数 |
| `fydLZTpOS1Y=` | `1` | `document.compatMode === "CSS1Compat"` |
| `NAhASnJtQH8=` | `0` | Error counter |
| `Zj4SPCNTFgc=` | `false` | 未知布尔检测（可能 `navigator.doNotTrack === "1"`） |
| `HwdrBVpvYDU=` | `3` | 可能 `document.readyState`（3=complete） |
| `DhY6VEt+OGE=` | `33` | 可能 `navigator.maxTouchPoints` 或 AudioContext |
| `HmYqZFgOL1Y=` | `4141` | Performance timing 或 `PerformanceNavigationTiming.duration` |
| `BXlxO0AQdw0=` | `8325` | 事件采集耗时或 PoW 求解时间 |

## 10.17 伪造策略 — 按变化频率分三层

### 10.17.1 写死（~170 字段）—— 同一浏览器 profile 永远不变

- 56 个 API 检测布尔值
- 42 个 Bot 检测（全 false）
- 浏览器标识（UA, platform, vendor 等）
- 屏幕/显示（1920×1080, colorDepth=32）
- 语言/时区（zh-CN, Asia/Shanghai, -480）
- 硬件（8 cores, 4GB memory, x86/64）
- 插件（5 个 PDF viewer）
- Client Hints（brands, architecture）
- **6 个 MD5 + 10 个 CRC32 哈希**（同浏览器版本+系统+GPU 下不变）

### 10.17.2 每会话生成（~30 字段）

- uuid / sid / vid（会话 UUID）
- `_px3` cookie 值（从上次响应获取）
- PoW 答案（每次 ob 响应后计算）
- cs（从 ob 响应获取）
- WASM a() 输出（每次不同，跟 _pxUuid 绑）

### 10.17.3 每次请求动态（~30 字段）

- 4 个时间戳（init → collect → build → send，间隔需合理）
- seq / rsc（递增）
- `performance.memory`（heap size 每次微变）
- 错误堆栈（行号需匹配 main.min.js 版本）
- timing chain `"109|66|66|70|80"`

---

# 第十一部分：加密链 — 完整源码级

跟 Collector 共享算法层（70%），但 Bundle 有几处源码级差异。下面按 PX 在 main.js 里的实际函数顺序逐个还原。

## 11.1 加密总流程对比

```
                  Collector                            Bundle
加密流程:    JSON → XOR(50) → URL encode          JSON → XOR(50) → base64
             → base64 → 20 字符交织                → Jf() 20 字符交织
交织 key:    ee(Q(ni()), 10) (初始 no 值)          ee(Q(ni()), 10) (服务器时间戳)
偏移 key:    UUID → base64 → XOR(10)              UUID → base64 → XOR(10)
去交织:      splice(offsets[i]-1, 1) 从后往前      splice(offsets[i]-1, 1) 从后往前
```

差异只在两处：
1. Collector 多一步 URL encode（在 XOR(50) 之后、base64 之前）
2. Bundle 不做 URL encode（直接 base64）

## 11.2 Jf() Bundle 交织算法完整源码（main.js:3128）

```js
function Jf(events, config) {
    // Step 1: 获取交织密钥串（o, 20 chars）
    // ni() = 服务器时间戳（state.no），首请求时是默认 "1604064986000"
    var o = ee(Q(ni()), 10);   // base64(no) → XOR(10) → 密钥串

    // Step 2: 序列化 + 加密
    var jsonStr = it(events);    // 自定义 JSON 序列化（line 299）
    var xored = ee(jsonStr, 50); // XOR 每字符 ^ 50
    var a = Q(xored);             // base64 编码

    // Step 3: 计算插入位置数组（key = UUID, NOT appId!）
    // jf = "cu" (line 3126), config.cu = Xa() = UUID (line 4417)
    var h = ee(Q(config[jf]), 10);   // UUID → base64 → XOR(10) → hash 串

    // 第一轮: 找最大乘积 maxProduct
    var maxProduct = -1;
    for (var i = 0; i < o.length; i++) {
        var row = Math.floor(i / h.length) + 1;
        var col = i >= h.length ? i % h.length : i;
        var product = h.charCodeAt(col) * h.charCodeAt(row);
        if (product > maxProduct) maxProduct = product;
    }

    // 第二轮: 计算偏移量
    var indices = [];
    for (var i = 0; i < o.length; i++) {
        var row = Math.floor(i / h.length) + 1;
        var col = i % h.length;
        var product = h.charCodeAt(col) * h.charCodeAt(row);
        // Qf() 线性缩放到 [0, payloadLen-1]
        if (product >= a.length) {
            product = Qf(product, 0, maxProduct, 0, a.length - 1);
            // Qf = Math.floor((t-e)/(n-e)*(a-r)+r)
        }
        // 去重: 冲突则 +1
        while (indices.includes(product)) product += 1;
        indices.push(product);
    }
    indices.sort();

    // Step 4: 交织（编码方向）
    var result = "";
    var pos = 0;
    for (var u = 0; u < o.length; u++) {
        result += a.substring(pos, indices[u] - u - 1) + o[u];
        pos = indices[u] - u - 1;
    }
    result += a.substring(pos);
    // 结果: o[u] 被插入到 result 的位置 indices[u] - 1

    return result;
}
```

⚠️ **偏移量 key 是 `config[jf]` = `config.cu` = UUID，不是 appId！** 这是 Bundle 跟 Collector 最微妙的差异。

## 11.3 去交织（解密）

```js
/**
 * 逆向解密 Bundle payload
 *
 * 1. 用相同算法算 offsets (key=UUID, payloadLen=交织后总长)
 * 2. 从后往前，在 offsets[i]-1 位置删除字符 (splice)
 * 3. base64 decode → XOR(50) → JSON
 */
function decryptBundlePayload(payload, uuid, serverNo) {
    // 算 offsets
    const o_length = 20;   // 13 位时间戳 base64 = 20 字符
    const offsets = computeOffsets(o_length, payload.length, uuid);

    // 去交织
    const chars = payload.split('');
    for (let i = offsets.length - 1; i >= 0; i--) {
        chars.splice(offsets[i] - 1, 1);   // ⭐ 关键: offset - 1
    }
    const cleanPayload = chars.join('');

    // base64 → XOR(50) → JSON
    const xored = Buffer.from(cleanPayload, 'base64').toString('binary');
    let jsonStr = '';
    for (let i = 0; i < xored.length; i++) {
        jsonStr += String.fromCharCode(xored.charCodeAt(i) ^ 50);
    }
    return JSON.parse(jsonStr);
}
```

⚠️ **关键**：`splice(offsets[i] - 1, 1)` —— offsets 是 1-indexed，splice 是 0-indexed，必须减 1（坑 #8）。

## 11.4 自定义 JSON 序列化 `it()`（main.js:299-329）

PX 不用 `JSON.stringify()`，自己写了一套 serialize。差异：
- `undefined` → 字面字符串 `"undefined"`（不是省略）
- `NaN` / `Infinity` → `"null"`
- Date 对象格式化方式不同
- 数字精度差异

```js
function it(value, indent, ...) {
    // 简化伪代码
    if (value === undefined) return '"undefined"';
    if (value !== value) return '"null"';            // NaN
    if (value === Infinity || value === -Infinity) return '"null"';
    if (value === null) return 'null';
    if (typeof value === 'boolean') return String(value);
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return '"' + escapeString(value) + '"';
    if (Array.isArray(value)) {
        return '[' + value.map(it).join(',') + ']';
    }
    if (typeof value === 'object') {
        const pairs = [];
        for (const key of Object.keys(value)) {
            pairs.push('"' + key + '":' + it(value[key]));
        }
        return '{' + pairs.join(',') + '}';
    }
    return 'null';
}
```

⚠️ 必须保持**对象 key 的迭代顺序跟原对象一致**（不能重排），否则 serialize 出的 byte stream 跟 SDK 的不一样，PC 算错。

## 11.5 XOR 编解码 `ee()`（main.js:666-670）

```js
function ee(t, e) {
    var n = '';
    for (var i = 0; i < t.length; i++) {
        n += String.fromCharCode(t.charCodeAt(i) ^ e);
    }
    return n;
}
```

简单的逐字符 XOR。`e` 是单字节 key（如 50、10、120）。

## 11.6 `Q()` base64 编码

```js
function Q(t) {
    return btoa(encodeURIComponent(t).replace(/%([0-9A-F]{2})/g, function(_, hex) {
        return String.fromCharCode(parseInt(hex, 16));
    }));
    // = btoa(unescape(encodeURIComponent(t)))
    // = UTF-8 base64
}
```

⚠️ **UTF-8 base64**，不能用 Latin-1（坑 #2）。

## 11.7 `jt()` PC 校验完整算法（main.js:596-609）

```js
// jt(data, salt) — line 596
function jt(t, e) {
    var n = R(t, e);   // = hex(HMAC-MD5(salt=e, data=t))，32 hex chars

    // 处理每个字符:
    var digits = '';
    var nums = '';
    for (var i = 0; i < n.length; i++) {
        var ch = n.charCodeAt(i);
        if (ch >= 48 && ch <= 57) {       // 数字 0-9
            digits += n[i];
        } else if (ch >= 97 && ch <= 102) { // 字母 a-f
            nums += (ch % 10).toString();
            // a (97) → 7
            // b (98) → 8
            // c (99) → 9
            // d (100) → 0
            // e (101) → 1
            // f (102) → 2
        }
    }

    // 拼接: result = digits + nums
    var result = digits + nums;

    // 间隔取: result[0], result[2], result[4], ...
    var pc = '';
    for (var i = 0; i < result.length; i += 2) {
        pc += result[i];
    }

    return pc;   // ~16 位数字字符串
}

// 调用:
// pc = jt(it(events), [uuid, tag, ft].join(":"));
// salt = "eb30dfdf-11c5-11f1-...:O2MKZn0OEhI/ag==:388"
```

### 11.7.1 R() HMAC-MD5（main.js:75-84）

```js
function R(t, e) {
    if (e === undefined) {
        return U(V(t));     // 无 salt: hex(MD5(t))
    }
    return U(F(e, t));      // 有 salt: hex(HMAC-MD5(salt=e, data=t))
}
```

`M()` 函数的魔数 `1732584193, -271733879, -1732584194, 271733878` 确认为标准 MD5 init A/B/C/D。HMAC ipad/opad = `909522486 / 1549556828`。

## 11.8 `hh()` sid 隐写编码（main.js:4366-4373）

```js
function hh(t) {
    return t.split("").reduce(function(acc, ch) {
        var hex = ch.codePointAt(0).toString(16).padStart(2, "0");
        return acc + unescape("%uDB40%uDC" + hex);   // U+E0000 系列
    }, "");
}
```

把字符串转成 Unicode Tag Characters（U+E0100+ 不可见字符）。

```
"50" → U+E0035 U+E0030 → 两个不可见 Unicode 字符
```

实际抓包看到 sid UUID 后附加的 Unicode Tag Chars 编码的是 **cts 时间戳的每位**，不是 ni()：

```
U+E0131='1'
U+E0132='2'
...
U+E0139='9'
U+E0130='0'

sid = uuid + cts.split('').map(d => `U+E013${d}`).join('')
```

## 11.9 cs 是服务器下发（不是客户端算）

⚠️ **新手必踩**：以为 `cs=64hex` 是客户端 SHA-256 算出来的，试图自己实现。**不是**：

```
OB#1 响应 → atob → XOR(120) → split("~~~~")
   → segment[5] → III000 handler → qa = challenge_hash

mh() 构造时:
   l = Ho() → return qa
   p.push("cs=" + l)
```

`cs` 就是 OB#1 里 `III000` handler 提供的那个 64 字符 SHA-256 字符串原样回传。

## 11.10 `/ns` 接口（非 cs 来源！）

```
GET https://tzm.px-cloud.net/ns?c=PXO1GDTa7Q
  → 返回: "2qWXVXCIYzzIizvyGFRN..." (token 字符串)
  → 存储: Sm = responseText
```

`/ns` 的返回值放到 **payload 事件字段里**（`k.d[M(d)] = Sm`），**不是** cs 参数。

## 11.11 完整参数来源表（再次）

| 参数 | 来源 | 类型 | main.js 变量 |
|---|---|---|---|
| `payload` | `Jf(events, config)` | 客户端 | `v` |
| `appId` | 配置 | 固定 | `e[yn]` |
| `tag` | 脚本硬编码 | 固定 | `e[bn]` = `"O2MKZn0OEhI/ag=="` |
| `uuid` | `Xa()` | 客户端 | session 级 |
| `ft` | 配置 | 固定 | `e[In]` = `388` |
| `seq` | `ph++` | 计数器 | 递增 |
| `en` | 固定 `"NTA"` | base64("50") | XOR key 声明 |
| `bi` | 脚本硬编码 | 固定 | `It` = `"GwNqS048KWpd..."` |
| `cs` | **服务器 OB 响应** | III000 handler | `Ho()` = `qa` |
| `pc` | HMAC-MD5 | 客户端 | `jt(it(t), salt)` |
| `sid` | UUID + 隐写 | 客户端 | `uuid + hh(cts)` |
| `vid` | visitor ID | 客户端 | `Tt()` |
| `ci` | challenge ID | 服务器下发 | `as()` |
| `cts` | 时间戳 | 客户端 | `Ua` |
| `rsc` | 响应计数 | 客户端 | `++Cm` |
| `/ns token` | GET `/ns?c=appId` | 网络指纹 | `Sm` → payload 字段 |

## 11.12 指纹内部 PC 值（PX11804/PX11746/PX11371）

EV2 payload 内部还有 3 个 HMAC 字段（不是 POST 的 pc 参数）：

```
PX11804 = HMAC-MD5(user_agent, uuid)     → 32 hex
PX11746 = HMAC-MD5(user_agent, vid)      → 32 hex
PX11371 = HMAC-MD5(user_agent, sid)      → 32 hex
```

这 3 个**不提取**（不做"数字提取+间隔取"），直接保留 hex 字符串。

⚠️ HMAC 算时 `user_agent` 必须跟 HTTP 头 User-Agent **完全一致**（坑 #23），不然校验失败。

---

# 第十二部分：纯算端到端的 5 个 gap

实测纯算 Bundle generator 完成度 ~70%。**剩余 30%** 的 5 个 gap：

## 12.1 Gap 1: 鼠标贝塞尔轨迹合成质量

**现状**：纯算合成的 544 点轨迹对单次会话 7-9/10 通过；50+ 会话后开始有规律失败。

**根因**：合成轨迹的"速度曲线"（点跟点之间间距分布）跟真人不一样。真人按压：
- 启动加速（加速度大）
- 中段平稳（匀速 ~5px/ms）
- 结束减速（接近目标减速）

合成轨迹偏均匀，PX 长期行为分析能识别。

**修复方向**：
- 短期：用真抓的 5-10 条轨迹做种子，每次复制后加抖动（±5ms ±1px）
- 中期：扩到 50-100 条种子，按账号分发（坑 #B19）
- 长期：拟合真人速度曲线（贝塞尔速度曲线 + 减速段），完全合成

## 12.2 Gap 2: 错误栈跨 Chrome 版本

**现状**：当前 4 组错误栈模板对 Chrome 145 有效，换 Chrome 140 或 150 失败一半。

**根因**：V8 不同版本的函数内联策略不同，stack frame 数和行号位置都会变。captcha.js 里编码的"期望 stack 形状"跟当时主流 Chrome 版本绑定。

**修复方向**：维护多套 stack 模板，按 outgoing UA 里的 Chrome 大版本选（坑 #D7）。

## 12.3 Gap 3: WASM 常量更新检测

**现状**：WASM 常量（ChaCha20 seed、自定义字母表、HMAC key）每个 PX build 都不同。

**根因**：PX 在 build 时随机生成常量。每次 captcha.js 升级（2-3 周）WASM 也跟着升。

**修复方向**：
- 写自动化脚本，每次 captcha.js 抓到新版就提取 WASM data section，对比常量
- 常量变了就触发 alert + 自动跑 WASM 重分析

## 12.4 Gap 4: 轨迹池扩容

**现状**：当前 5 条种子轨迹，跑 50+ 会话被聚类。

**修复方向**：扩到 50-100 条种子。每条轨迹用账号 hash 分配（同一账号始终用同一条种子 + 抖动），跨账号轮换。

## 12.5 Gap 5: Bundle#4 行为完整性

**现状**：成功路径不发 Bundle#4。统计上跟真用户分布偏离。

**修复方向**：跟会话规模相关。每天 < 几百次不发；每天 > 上千次必发（坑 #B10，§8.2）。

---

# 第十三部分：Userscript 实战方案

Bundle 路径的唯一保留实战脚本：**[`../script/userscripts/px_bundle3_auto.user.js`](../script/userscripts/px_bundle3_auto.user.js)** —— 2131 行 / 237 KB / 实战 10/10 通过。

⚠️ **关键认知修正**："纯算过按压" **不是模拟按钮点击**。这个脚本的工作方式是：让 PX SDK 自己发 Bundle#1/#2 → 我们 hook fetch/XHR/iframe-XHR 拦截响应 → **自己算 PoW + WASM + 6 个事件，直接 fetch() POST Bundle#3 出去**。**完全不碰 captcha 按钮**。

## 13.1 设计思路

跟其它方案对比：

| 方案 | 工作方式 | 优 | 劣 |
|---|---|---|---|
| **A) 模拟点按钮**（pointerdown/up + 鼠标轨迹合成） | dispatchEvent 给真按钮发事件，让 PX SDK 自己完成 B3 | 不需要还原算法 | 难做对（mouse interactions / iframe Sandbox / shadow DOM） |
| **B) Userscript hook + 纯算 B3**（本方案 ⭐） | 拦截 B1/B2 → 自算 B3 → 直接 POST | 不碰按钮，所有 PX 校验项都在算法层 | 要还原全套算法 |
| **C) 完全纯算 Node 端** | Node 进程模拟 + WASM + 算 B1/B2/B3 全套 | 可大规模并发 | 要伪装 TLS / IP / UA / 行为指纹，工作量极大 |

iFood 实战选 **B**，因为：
- B1/B2 让 PX 自己发 = TLS 指纹真、UA 真、cookie 真 → 通过率最高
- 我们只算 B3（最复杂的那个）= 利用 PX SDK 已经预热的会话上下文
- 不点按钮 = 跳过 captcha 复杂的鼠标 / shadow DOM 检测

## 13.2 内嵌组件（2131 行结构）

完整自包含，**不依赖外部 JS / WASM / 数据池**：

```
Part 1: 纯 JS SHA256（同步 PoW solver）              line 23-79
Part 2: 内嵌全套 reverse 模块                       line 82-695
   ─ ob.js (decodeOb, executeSegments, writePx3Cookie, processOb)
   ─ payload.js (serialize, b64, interleave, generatePayload)
   ─ pc.js (MD5, HMAC-MD5, generatePC)
   ─ sid.js (hh, generateSid)
   ─ uuid / solvePow / ml / xorStr

Bundle #3 Generic Events Builder                   line 696-1264
   ─ Event #0 浏览器指纹 (78 字段) buildEvent0(opts)
   ─ Event Metrics ⭐ (18 字段) buildEventMetrics(opts)
   ─ Event #1 鼠标交互 (20 字段) buildEvent1(opts)
   ─ Event #2 PX561 核心 (95 字段) buildEvent2(opts)
   ─ Event #3 Captcha 完成回调 (27 字段) buildEvent3(opts)
   ─ Event #4 PX11994 交互总结 (24 字段) buildEvent4(opts)
   ─ buildBundle3Events(opts) 主装配
   ─ buildOpts(p) 必传 8 个 + 自动计算其余

Part 3: XHR/fetch Hook 拦截 B1/B2                   line 1266-1615
   ─ 匹配 /assets/js/bundle 或 collector-*.px-cloud.net
   ─ 自动判 seq=0/1，分流到 onB1Response / onB2Response
   ─ 触发 buildAndSendB3() 链路

Part 3.5: iframe Hook + appendChild MutationObserver  line 1617-2090
   ─ hookIframeXHR(iframe)  ← captcha 在 iframe 里，关键
   ─ Hook Document.appendChild — 同步检测 iframe 插入

Console 控制台 API                                  line 2091-2131
   ─ window.__pxAutoState        主页面拦截状态
   ─ window.__pxCaptchaState     captcha iframe 状态
   ─ window.__pxBuildB3()        手动触发 B3 构建（debug 用）
   ─ window.__pxReset()          重置全部状态
```

## 13.3 安装

```
1. 浏览器装 Tampermonkey（或 Greasemonkey/Violentmonkey）
2. Dashboard → Create new script → 把 px_bundle3_auto.user.js 内容贴进去 → Save
3. 访问 https://www.ifood.com.br/ → 脚本自动加载
```

## 13.4 工作流（实战）

```
浏览器加载 ifood.com.br
   ↓
[PX-AUTO] 脚本注入，安装 fetch/XHR hook，监听 iframe 插入
   ↓
PX main.min.js 自动跑 → 风险评分高 → 业务 API 返 403 + blockScript
   ↓
浏览器加载 captcha.js → 创建 captcha iframe
   ↓
我们的脚本: 检测 iframe 出现 → 装 iframe 内 XHR hook
   ↓
captcha.js 在 iframe 里发 Bundle#1 → 我们 hook 拦截响应
   ↓
   解 OB#1 → 提 state.no / state.appId / state.qa / state.to / pow.{suffix,target,difficulty}
   ↓
   本地算 PoW (~9-60ms 同步 SHA-256 暴力)
   ↓
   本地跑 WASM a() + b(powAnswer) （内嵌 base64 解码，每次 init 一次）
   ↓
captcha.js 自动发 Bundle#2 → 我们 hook 拦截响应
   ↓
   解 OB#2 → 拿首版 _px3 (jf=cu) + 新 state.cts
   ↓
[关键步骤] 不等用户按按钮，立刻自构 Bundle#3:
   ↓
   buildBundle3Events(opts) → 6 个事件数组
   ↓
   generatePayload(events, serverTs, uuid) → Jf 交织
   ↓
   generatePC(events, uuid, tag, ft=388) → 16 位 checksum
   ↓
   generateSid(pxsid, serverNo) + Unicode Tag 隐写
   ↓
   fetch('.../assets/js/bundle?seq=2&rsc=3', { body: ... })
   ↓
拦截 Bundle#3 响应 → 提取有效 _px3 (jf=success) → 写 document.cookie
   ↓
F12 控制台显示 [PX-AUTO] 成功，业务 API 重新请求 → 200
```

## 13.5 关键依赖：iframe XHR Hook

⚠️ **新人最容易栽这里**：PX 的 captcha 不在主页面发请求，**在 iframe 里发**。只 hook 主页面 fetch/XHR 收不到 B1/B2。

代码（line 1617+）：

```js
function hookIframeXHR(iframe) {
    var iframeWin;
    try { iframeWin = iframe.contentWindow; } catch(e) { return; }
    if (!iframeWin || !iframeWin.XMLHttpRequest) return;
    if (iframe._pxHooked) return;
    iframe._pxHooked = true;

    var origOpen = iframeWin.XMLHttpRequest.prototype.open;
    var origSend = iframeWin.XMLHttpRequest.prototype.send;
    iframeWin.XMLHttpRequest.prototype.open = function(method, url) {
        this._pxUrl = url;
        this._pxMethod = method;
        return origOpen.apply(this, arguments);
    };
    iframeWin.XMLHttpRequest.prototype.send = function(body) {
        // ... 拦截 + 解响应 + 触发 onB1Response / onB2Response
    };
}

// 同步检测 iframe 插入（MutationObserver 会有 race condition）
var origAppendChild = Document.prototype.appendChild;
Document.prototype.appendChild = function(node) {
    var result = origAppendChild.call(this, node);
    if (node.tagName === 'IFRAME' && node.src.includes('captcha')) {
        node.addEventListener('load', function() { hookIframeXHR(node); });
        // 也立即试一次，因为有些 captcha iframe 加载早于 onload
        hookIframeXHR(node);
    }
    return result;
};
```

## 13.6 跟其它方案对比

| 维度 | px_bundle3_auto.user.js (本方案) | 完全纯算 Node 端 | 模拟点按钮 |
|---|---|---|---|
| 部署复杂度 | 中（装 userscript） | 高（要懂全套算法 + 伪装 TLS） | 中（需理解 captcha DOM） |
| 并发能力 | 低（每 tab 一个会话） | **高**（Node 进程） | 低 |
| 反检测 | 极强（真浏览器、真 TLS、真 cookie） | 弱（要伪装 TLS / IP / UA） | 中（按钮检测难做对） |
| 跨版本维护 | 中（PX 改 captcha.js 要改对应 builder） | 高（每次升级重逆向） | 低 |
| 工作量 | **2131 行 user.js**（已搞定） | ~5000 行 Node 模块 + WASM 跑 | 难度看 captcha 复杂度 |
| 实测通过率 | **10/10** | 70%（5 gap 未解） | 部分场景 |
| 适用场景 | **生产首选**（账号注册 + 拿 cookie 复用 5 分钟） | 大规模数据采集（需 IP 池 + TLS 池） | 演示 / 学习 |

**实战经验**：iFood 在 2026-02 用本方案做账号注册（B 路径），collector 无感路径（C 类似）做数据采集。**两条路径混合使用**：用 userscript 拿到 _px3 cookie 后，Node 进程拿这个 cookie 调业务 API 复用 5 分钟，过期了 fallback 回 userscript 重新拿。

## 13.7 历史 + 来源

| 时间 | 事件 |
|---|---|
| 2026-03-01 | git commit `f256b7e`，初版 2131 行 user.js 入仓 |
| 2026-04-02 | git commit `007623b` cleanup 提交直接删了它，期望用 `build_userscript.js` regenerate 但构建器 line 319 转义错跑不通 |
| 2026-04-02 → 2026-05-21 | 成品孤本只活在 git 历史和 GitHub `warterbili/px3cookie` 镜像 |
| 2026-05-21 | 从 git f256b7e 恢复到本项目 `bundle/script/userscripts/`，SHA `a432e016422233cc1b61790b4dc99991da9579244ec40092ccbdddb52ecdd744`，**byte-for-byte** 跟历史原版一致 |

详细 userscript 安装 + 控制台 API + 操作流程，见 [`../script/userscripts/README.md`](../script/userscripts/README.md)。

---

# 第十四部分：跨平台移植 7 步法

把 Bundle 实现从一个 PX 站点搬到另一个站点的标准化流程。

## 14.1 共享 / 平台特有矩阵

| 维度 | 跨站点共享 | 平台特有 |
|---|---|---|
| payload 加密链 | ✅ 完全一样 | — |
| PC HMAC-MD5 算法 | ✅ | — |
| OB 解码（XOR + split + handler） | ✅ | — |
| SID Unicode 隐写 | ✅ | — |
| UUID v1 | ✅ | — |
| PoW 算法（SHA-256 + 16-bit） | ✅ | — |
| WASM 二进制框架 | ✅ | — |
| 鼠标贝塞尔 / 缅甸文编码 / 4 组 errstack | ✅ | — |
| TAG / AppID / FT 常量 | — | ✅ |
| Bundle AppID（OB#1 提取） | — | ✅（每会话变） |
| OB wire 字符（0/l vs o/I） | — | ✅ |
| WASM 内部常量（ChaCha20 seed） | — | ✅ |
| EV2/EV3 b64 key 字典（229 个） | — | ✅（每个 PX build 重新生成） |
| state.\* → EV2 注入位置 | — | ✅ |
| captcha iframe DOM 结构 | — | ✅（Myanmar 编码模板） |
| 字段数（Bundle#1 16, #2 228, #3 95） | 大致一致 | ±5 |

## 14.2 7 步法（按顺序）

### Step 1: 抓 captcha.js + WASM（10 分钟）

```bash
# 用 CDP 抓真浏览器
python skill/cdp/scripts/cdp.py navigate "https://www.目标站.com/"
# Network 找 captcha.js 下载

# 提取 WASM
node extract_wasm.js captcha.js
```

记录：
- captcha.js URL pattern
- WASM SHA-256
- WASM 大小

### Step 2: 提取新 Bundle AppID（30 分钟）

抓 3-5 次 Bundle#1 → OB#1，对比 segment #3：

```bash
node decode_response.js TAG bundle1_response.json
# 找 12-20 字符全小写字母数字那段 = Bundle AppID
```

### Step 3: 提取新 FT（15 分钟）

```bash
grep -o "ft=[0-9]*" bundle1_request.txt
# 期望: ft=388 或 ft=XXX
```

### Step 4: 提取 WASM 常量（1-2 小时）

```bash
wabt-objdump -j data px_captcha.wasm > wasm_data_dump.txt
diff old_wasm_data_dump.txt wasm_data_dump.txt
# 找 32 字节 ChaCha20 seed + 自定义字母表 + HMAC key
```

### Step 5: 适配 OB handler shape（30 分钟）

```bash
node decode_response.js NEW_TAG bundle1_response.json | jq '.segments | length'
# 期望 13 ± 2
```

### Step 6: 重建 Bundle 字段模板（2-4 小时）

```bash
# 抓 6 批
for i in 1 2 3 4 5 6; do
    python capture_bundle_via_cdp.py --site 目标站 --out bundle_samples/$i/
    sleep 60   # IP 节流
done

# 解码
for i in 1 2 3 4 5 6; do
    node decode_payload.js bundle_samples/$i/bundle2_request.txt \
        > bundle_samples/$i/decoded_bundle2.json
done

# 字段三分类
node diff_samples.js bundle_samples/{1..6}/decoded_bundle2.json > field_classes.json

# state.* → EV2 b64 key 映射
python find_state_keys.py bundle_samples/ > state_key_map.json
```

### Step 7: 端到端测试（30 分钟）

```bash
node generators/new_platform_bundle.js
# 期望: 跑 5 次都拿到 _px3 + 业务 API 200

for i in {1..10}; do
    sleep 30
    node generators/new_platform_bundle.js
done
# 期望 10/10
```

## 14.3 跨平台常见陷阱

| 陷阱 | 怎么发现 |
|---|---|
| Bundle AppID 提取错（取了 init AppID） | OB#1 segment #3 是 12-20 全小写 |
| FT 错（用了 Collector 的 401） | Bundle#2 直接 400 |
| state.* → EV2 key 用 iFood 的 | Bundle#2 返 200 但 OB#2 没 _px3 |
| WASM 常量没更新 | b() 输出跟真抓的对不上 |
| 缅甸文编码模板没更新 | Bundle#3 返 422 |
| Error stack 用了 iFood 的 captcha.js 行号 | Bundle#3 返 403 |

---

# 第十五部分：踩坑总集

完整 20 条 Bundle 专属踩坑 + 详细症状/根因/修复在 [`../../bug_report/2_bundle_path.md`](../../bug_report/2_bundle_path.md)。本节是摘要 + 严重度索引。

| # | 严重 | 标题 | 一句话 |
|---|---|---|---|
| B1 | ⭐⭐⭐ | `_pxUuid` before WASM init | `globalThis._pxUuid = uuid` 必须在 WASM instantiate 之前 |
| B2 | ⭐⭐⭐ | `instanceof_Window` 必须返 1 | Node mock 必填 |
| B3 | ⭐⭐ | WASM 内部常量按版本变 | ChaCha20 seed / 字母表 / HMAC key 每版本不同 |
| B4 | ⭐ | WASM b() 输出不是 base64 | 自定义字母表 `/=+!1@2#3$4%5^6&7*8(9)0-` 原样填 |
| B5 | ⭐⭐⭐ | PoW 必须同步 SHA-256 | `crypto.createHash` 不是 `crypto.subtle.digest` |
| B6 | ⭐⭐ | Handler param 故意打乱 | `Bs(t,e,n,r,a)` 内部调用顺序不是参数顺序 |
| B7 | ⭐⭐ | Bundle AppID ≠ Init AppID | Bundle 用 OB#1 下发的 |
| B8 | ⭐⭐⭐ | Bundle#3 事件顺序敏感 | 5 个事件位置不能换 |
| B9 | ⭐⭐ | 4 个 bundle 全程用同一 UUID | 不能换 |
| B10 | ⭐⭐ | Bundle#4 "发不发"取决于规模 | 小规模不发，大规模必发 |
| B11 | ⭐⭐⭐ | 按压时长必须 1-3s | `< 0.5s` 或 `> 5s` 都拒 |
| B12 | ⭐⭐ | 鼠标坐标必须浮点 | `clientX = 320.5` 不能 `320` |
| B13 | ⭐⭐ | 鼠标轨迹 ts 跟按压重叠 | `mouseEndTs ≈ pointerDown.ts ± 200ms` |
| B13a | ⭐⭐ | 显式 `pressDuration` = `ts 差` | 跟事件 timestamp 差必须吻合 |
| B14 | ⭐ | 缅甸文 DOM 编码 | DOM tag → JSON → XOR(4210) → b64 → U+1000-U+109F |
| B15 | ⭐ | Error stack 必须 4 组 | 单组 = 机器人 |
| B16 | ⭐ | `captcha.js` 不能跨会话缓存 | 每次新会话重下 |
| B17 | ⭐ | `captcha.js` 文件名不稳 | hash 后缀变 |
| B18 | ⭐⭐ | PoW cache 跨会话泄露 | 缓存 key 必须含 session UUID |
| B19 | ⭐⭐ | 鼠标轨迹池太小被聚类 | 5 → 50-100 条 |

---

# 第十六部分：SDK 漂移应对

PX 的"双链路"对维护带来一个特别的麻烦：**Collector 和 Bundle 的升级节奏不同**。

## 16.1 升级频率对比

| 文件 | 升级频率 | 影响 |
|---|---|---|
| `main.min.js` (Collector SDK) | 每月 1-2 次 | 无感路径要重新校准 b64 key |
| `captcha.js` (Bundle SDK) | **每 2-3 周** | Bundle 整套 + WASM 都要重新提 |
| `px_captcha.wasm` | 跟 captcha.js 同节奏 | ChaCha20 seed / 字母表都变 |

⚠️ Bundle 升级频率是 Collector 的 2-3 倍。如果你 generator 同时支持两条路径，需要**两套独立的 SDK_INFO**。

## 16.2 独立维护两套 SDK_INFO

```
stample/
├── ifood/
│   ├── source/
│   │   ├── main.min.js
│   │   └── SDK_INFO.md       ← Collector SDK info
│   └── ...
└── bundle/
    ├── source/
    │   ├── captcha.js
    │   ├── px_captcha.wasm
    │   └── SDK_INFO.md       ← Bundle SDK info ⭐ 独立
    └── ...
```

`bundle/source/SDK_INFO.md` 应该有：
- captcha.js SHA-256 + 大小
- WASM SHA-256 + 大小
- WASM ChaCha20 seed (hex)
- WASM 自定义字母表
- Bundle AppID 提取位置
- captcha iframe DOM 节点 tag 计数（缅甸文模板）
- 当时主流 Chrome 大版本（error stack 模板对应）

## 16.3 Chrome 版本绑定的 error stack 模板

⚠️ error stack 的行号是 V8 给的，V8 不同版本的函数内联策略不同 → frame 数和行号位置都会变。captcha.js 的 PX 校验逻辑**按当时主流 Chrome 版本设计的"期望 stack 形状"**。

```
error_stack_templates/
├── chrome_140.json
├── chrome_142.json
├── chrome_145.json       ⭐ 当前主流
├── chrome_148.json       ⭐ 当前主流
└── chrome_150.json
```

generator 里：

```js
function pickErrorStackTemplate(ua) {
    const match = ua.match(/Chrome\/(\d+)/);
    if (!match) throw new Error('UA must contain Chrome version');
    const major = parseInt(match[1]);
    const available = [140, 142, 145, 148, 150];
    const closest = available.reduce((a, b) =>
        Math.abs(b - major) < Math.abs(a - major) ? b : a
    );
    return require(`./error_stack_templates/chrome_${closest}.json`);
}
```

**规则**：你伪装的 UA 是哪个 Chrome 大版本，所有"Chrome 行为模板"（error stack / V8 错误信息格式 / performance.memory 数值范围）都要跟那个版本对应。

## 16.4 WASM 常量更新检测 SOP

```
1. 抓新 captcha.js
   ↓
2. SHA 跟旧版对比：变了？
   ↓ 是
3. 提取新 WASM（看 Us()[10] 位置可能变）
   ↓
4. WASM SHA 跟旧版对比：变了？
   ↓ 是
5. 用 wabt 提取 .data 段，跟旧版 diff
   - ChaCha20 seed (32 bytes) 变了？
   - 自定义字母表（24 chars）变了？
   - HMAC key 变了？
   ↓
6. 跑端到端测试看 b() 输出对不对
   ↓ 不对
7. 重新分析 WASM（高成本，1-2 天）
```

**实战经验**：常量变得多吗？
- ChaCha20 seed 经常变（每个 build）
- 自定义字母表偶尔（半年一次）
- HMAC key 几乎不变

## 16.5 Cookie TTL 中途过期处理

⚠️ `_px3` / `_px2` 有 TTL（330s / 500s），长跑任务必须主动 refresh（坑 #33）。

```js
class CookieManager {
    constructor() {
        this.cookies = new Map();   // sessionId → { value, expiresAt }
    }

    set(sessionId, cookie, ttl) {
        this.cookies.set(sessionId, {
            value: cookie.value,
            expiresAt: Date.now() + ttl * 1000,
        });
    }

    get(sessionId) {
        const c = this.cookies.get(sessionId);
        if (!c) return null;
        if (Date.now() > c.expiresAt - 30_000) {  // 提前 30s 刷
            return null;   // 触发 refresh
        }
        return c.value;
    }
}
```

---

# 第十七部分：iFood 业务+反爬层

Bundle 是 PX 反爬的一环，但要在 iFood 业务里跑通，还需要懂业务侧的协议 + 反爬层的 hook 入口。

## 17.1 iFood 业务接口分析

**主接口**：`https://cw-marketplace.ifood.com.br/v2/bm/home`（实测的 v1/v2 分布见 §17.5）

**请求模式**：`cors`
**Referrer**：`https://www.ifood.com.br/`
**ReferrerPolicy**：`strict-origin-when-cross-origin`
**Credentials**：`omit`

### 17.1.1 关键 headers

| Header | 值（示例） |
|---|---|
| `Content-Type` | `application/json` |
| `User-Agent` | Chrome 145.0.0.0 Edge |
| `X-Px-Authorization` | `1` 或自定义 token |
| `Cookie` | `_px3=...; _pxvid=...; ...` |

### 17.1.2 Body 参数

POST body 含搜索条件、地址、券、限制等业务字段。这部分跟 PX 反爬无关，但 `Cookie: _px3=` 是必填的，没有就 403。

## 17.2 _px3 生成行为链

完整生成流程：

```
1. 浏览器加载 ifood.com.br
   ↓
2. PX main.min.js 自动注入
   ↓ POST 到 collector
3. Collector#1 → _px3 (TTL 330)
   ↓
4. 业务 API 用 _px3 调
   ↓
5. ≈200 次后 → 403 + blockScript
   ↓
6. captcha.js 加载 → Bundle 流程
   ↓
7. Bundle#3 通过 → 新 _px3 (TTL 330)
   ↓
8. 业务 API 再用新 _px3
```

## 17.3 PerimeterX 切入点（hook 后堆栈分析）

### 17.3.1 怎么定位 PX 入口

```js
// 浏览器控制台
Object.keys(window).filter(k => k.includes('handler'));
// → ["_O1GDTa7Qhandler"]   ← PX 注册到 window 的对象

const h = window._O1GDTa7Qhandler;
Object.keys(h);
// → ["PX762", "PX12634", "PX1135"]   ← PoW 入口 + 视觉挑战

h.PX1135 === h.PX762;   // → true   ← 同函数注册两次
h.PX1135.toString();    // → "function Bs(r,n,t){..."   ← 跳进去看
```

### 17.3.2 collect 请求链分析

```
用户调业务 API
  ↓
PX 检查 _px3 是否还有效（TTL + jf=success）
  ├── 有效 → 直接通过，业务正常
  └── 无效 → 触发 collect 流程
       ↓
       PX collect 用 setTimeout 异步执行（不阻塞业务）
       ↓
       1. 收集浏览器指纹（mh 主构造）
       ↓
       2. 异步发 collector POST
       ↓
       3. 收到响应，存储新 cookie
```

### 17.3.3 ah 函数（第一个参数生成）

PX 的 `ah(t)` handler 设置 `ao = t`（HTTP 状态码）：

```js
function ah(t) {
    ao = t;   // 全局变量 ao
}
```

如果 OB#1 段 4 是 `0III0I00|401` → `ao = "401"`。生成器里这个值会被 mh() 用到（作为 payload 内部字段）。

## 17.4 第三个 collect 的复现

iFood Collector 路径会发 3 个 POST（不是 2 个）。Bundle 路径只发 4 个。区别：

| Collector 路径 | Bundle 路径 |
|---|---|
| POST#1（轻指纹） | Bundle#1（轻指纹） |
| POST#2（重指纹 + cs） | Bundle#2（重指纹 + PoW + WASM） |
| POST#3（行为追踪 EV3） | Bundle#3（按压 + 鼠标） |
| — | Bundle#4（telemetry） |

第三个 collect POST 是 EV3 事件（行为追踪 - 鼠标移动、滚动、可见性变化、performance entries）。**虽然 ≥200 次后会触发 Bundle，但 EV3 仍然要发**。

## 17.5 cw-marketplace vs marketplace TLS 区分（关键）

⚠️ iFood **不同子域走不同 CDN**：

| 子域 | CDN | TLS 校验 | 不带 _px3 拒？ |
|---|---|---|---|
| `marketplace.ifood.com.br` | Akamai | 宽松（不检查 TLS 指纹） | 是 |
| **`cw-marketplace.ifood.com.br`** | **Cloudflare WAF** | **严格** | 是 + 检查 TLS 一致性 |
| `static.ifood.com.br` | Akamai CDN | 静态资源，不检查 | 否 |

**Python `requests` 的 TLS 指纹（curl/OpenSSL）≠ Chrome 的指纹** → Cloudflare 一识别就拒，不管你 cookie 多正确。

**修复**：

```python
# ❌ 对 cw-marketplace 不行
import requests
requests.get("https://cw-marketplace.ifood.com.br/...")

# ✅ 用 curl_cffi 伪造 Chrome TLS
from curl_cffi import requests
requests.get("https://cw-marketplace.ifood.com.br/...", impersonate="chrome120")
```

详见 bug_report `3_environment.md` 坑 #E3。

## 17.6 /v1 vs /v2 API 差异

| 端点 | 状态 | 行为 |
|---|---|---|
| `/v1/cardstack/search/home` | ✅ 活跃 | 走宽松路由 |
| `/v2/cardstack/search/home` | ❌ 废弃 | Cloudflare WAF 严格策略 → 403 |

⚠️ 坑 #32。业务 API 用 `/v1`，不用 `/v2`。

---

# 第十八部分：外部资源 + Pr0t0ns v8.9.6 对照

## 18.1 GitHub 开源项目

| 项目 | 内容 | 价值 |
|---|---|---|
| `Pr0t0ns/perimeterx-v8.9.6` | PX v8.9.6 完整逆向技术文档（见下 §18.4） | 跨版本对照 |
| `kasada-bypass` | 类似 PX 的 Kasada WAF 逆向 | 算法思路可借鉴 |
| `px-bypass-research` | 多个站点 PX 抓包样本 | 测试数据源 |

## 18.2 技术博客主题

| 博客主题 | 一句话 |
|---|---|
| "破解 PX 无感模式" | 大部分讲 Collector，少有讲 Bundle |
| "WASM 逆向通用方法" | 工具链（wabt / wasm-objdump / wasm2c） |
| "ChaCha20 算法实现" | PX WASM 内部用的流密码 |
| "贝塞尔曲线鼠标轨迹合成" | 真人 vs 机器人轨迹的统计学差异 |

## 18.3 WASM 逆向工具

| 工具 | 用途 |
|---|---|
| `wabt` (`wasm2wat`, `wasm-objdump`) | WASM ↔ WAT 文本格式互转 + dump |
| `wasm2c` | WASM 反编译到 C |
| `wasm-decompile` (binaryen) | 反编译到伪 JS |
| `wasm-bindgen-cli` | 生成 wasm-bindgen 桥代码 |
| `chrome-devtools` | 在浏览器里 step-through WASM |
| `wasmtime` | 命令行跑 WASM 测试 |

## 18.4 Pr0t0ns v8.9.6 完整对照

**Pr0t0ns** 是另一个独立的 PX 逆向项目（针对 v8.9.6，arcteryx.com），跟我们的 v8.10+ iFood 实现可以做版本对照。完整文档在 （原素材已并入本文档）。

### 18.4.1 v8.9.6 vs v8.10+ 关键差异

| 维度 | v8.9.6（Pr0t0ns） | v8.10+（iFood 当前） |
|---|---|---|
| **OB wire 字符** | `1` / `o` | `0` / `l`（iFood）/ `I` / `o`（Grubhub） |
| **字段 key** | 明文 `"PX12095"` | base64 编码 |
| **tag** | 明文 `"v8.9.6"` | base64 `"O2MKZn0OEhI/ag=="` |
| **bi 参数** | 无 | base64 ~95 bytes |
| **OB XOR key** | `gt="DhY8E0h7J2cKHw=="` → 120 | 不同 gt → 86/100/91 |
| **Bundle 字段数** | 12 | 16 |
| **FT (Collector)** | 330 | 401 |

### 18.4.2 v8.9.6 Collector 完整流程（参考）

```
POST https://collector-{appid}.px-cloud.net/api/v2/collector

参数:
  payload  = encrypt(fingerprint_1)     ← XOR(50) + URL编码 + base64 + 交织(20字符)
  appId    = PXO1GDTa7Q
  tag      = v8.9.6                     ← SDK 版本（明文）
  uuid     = UUID v4
  ft       = 330                        ← Collector
  seq      = 0
  en       = NTA
  pc       = HMAC-MD5 校验值            ← key = "{uuid}:v8.9.6:{ft}"
  sid      = session ID
  vid      = visitor ID
  cts      = client timestamp token
  rsc      = 1
```

**Fingerprint #1 结构（PX12095）**：

```json
[{
    "t": "PX12095",
    "d": {
        "PX11645": "https://www.ifood.com.br",
        "PX12458": "Win32",
        "PX11902": 0,
        "PX11560": 3000,
        "PX12248": 3600,
        "PX11385": 1713737306091,
        "PX12280": 1713737306096,
        "PX11496": "uuid"
    }
}]
```

### 18.4.3 v8.9.6 PC 算法（跟当前完全一样）

```python
def generate_pc(key, fingerprint):
    """
    key = "{uuid}:v8.9.6:{ft}"
    输出: 数字字符串 (HMAC-MD5 → 提取数字 → 间隔取)
    """
    ipad = [0x36363636 ^ k for k in word_array(key)]
    opad = [0x5C5C5C5C ^ k for k in word_array(key)]
    inner = MD5(ipad + word_array(fingerprint))
    hmac  = MD5(opad + inner)

    digits = extract_digits(hex(hmac))
    return digits[::2]
```

跟 v8.10+ 完全一样 —— **算法层 3 年没变**。

### 18.4.4 v8.9.6 字段名跟 v8.10+ 对照

| 语义 | v8.9.6（明文） | v8.10+（base64） |
|---|---|---|
| URL | `PX11645` | `WQ0oDx9mKjg=` |
| platform | `PX12458` | `EFQhFlU9Iiw=` |
| 计数器 | `PX11902` | `KDxZPm5YXw4=` |
| 随机值 | `PX11560` | `MVUAV3c9AGU=` |
| 固定 3600 | `PX12248` | `Y1tSWSY0UGM=` |
| 起始时间戳 | `PX11385` | `InpTeGQUXU8=` |
| 结束时间戳 | `PX12280` | `eW1ILzwCRh0=` |
| UUID | `PX11496` | `FUlkS1Mga38=` |

**怎么用对照**：当我们当前的 v8.10+ 文档遇到不懂的地方，去翻 v8.9.6 那份看 PX 早期版本怎么做的 —— 算法层很少变，看 v8.9.6 实现对照能交叉验证。

## 18.5 业界 Bundle 进展

```
2023 — Bundle 路径首次被业界提及（Pr0t0ns 论坛帖）
2024 Q1 — WASM 被加进 captcha.js
2024 Q3 — 鼠标贝塞尔约束加严
2025 Q1 — Myanmar DOM 编码出现
2025 Q3 — Error stack 4 组扩到必须
2026 Q1 — iFood Bundle 完整逆向（本项目）
```

---

# 第十九部分：项目工作日志

## 19.1 完整项目文件索引（源项目）

```
ifood_PerimeterX-WAF_jsReverse/
│
├── main.js                      # PX bundle 主脚本 (10653行, 混淆)
│                                  关键位置: Ql(3933), ih(4310), oh(4276),
│                                  hr(1012), qu(2537), os(2589), ss(2610)
│
├── captcha.js                   # PX captcha 模块 (10492行, 混淆, 文件名每次变!)
│                                  关键位置: sha256(~7000), poi(7165), ws(7171),
│                                  Ks(7176), Bs(7411), registration(10348)
│
├── px_captcha.wasm              # 提取的 WASM 二进制 (~60KB)
│                                  导出: a() → PX12590, b(input) → PX12610
│
├── documents.md                 # 综合技术参考文档 (~1800行)
│
├── BUNDLE_COMPLETE_ANALYSIS.md  # 完整知识网 (2036行)
│
├── CLAUDE.md                    # Claude 项目配置
│
├── js_reverse/
│   ├── ob_handlers.js           # ★ 完整还原: 解码器 + 27个Handler + PoW solver
│   │                              导出: decodeOb, processOb, Ql, ih, solvePow, poi
│   ├── cookie_hook.js           # Tampermonkey 脚本: hook _px3 cookie 写入
│   ├── 第三个接口复用.js          # Collector #3 请求分析
│   └── 多维度对比collect请求链.js  # 多组 Collector 请求对比
│
├── utils/
│   ├── decode_ob.js             # ob 响应解码器模块
│   ├── decode_ob_bundle1.js     # Bundle #1 解码测试
│   ├── decode_ob_bundle2.js     # Bundle #2 解码测试
│   ├── test_handlers.js         # Handler 集成测试
│   ├── decode_bundle2_request.js # Bundle #2 请求完整解码
│   ├── parse_bundle2_full.js    # Bundle #2 payload 全量解析
│   ├── bundle2_raw.txt          # Bundle #2 原始 POST body
│   ├── bundle2_decoded.json     # Bundle #2 解码结果 JSON
│   ├── extract_wasm.js          # WASM 提取器 (10种解码路径)
│   ├── run_wasm.js              # WASM 运行器 (initWasm → {a, b})
│   ├── run_wasm_debug.js        # WASM 调试版 (trace 所有 wbg 调用)
│   └── trigger_captcha.js       # 无限循环请求触发 captcha
│
└── test/
    └── ifood_intercept.js       # CDP 拦截替换 main.min.js
```

## 19.2 7 个突破时刻

逆向过程中的关键发现：

| # | 时刻 | 突破 |
|---|---|---|
| 1 | 2025-12 | 确认 Bundle 路径用 `/assets/js/bundle` 不是 `/api/v2/collector` |
| 2 | 2026-01 | 解出 OB 用 4 个 `~` 分隔（不是 3 个） |
| 3 | 2026-01 | 确认 `cs` 是服务器 OB#1 III000 handler 下发，不是客户端算 |
| 4 | 2026-01 | `state.no` 必须 parseInt（无数人在此 debug 一周） |
| 5 | 2026-02 | PoW 必须用 `crypto.createHash` 同步 API（async 600s+） |
| 6 | 2026-02 | WASM `__wbg_instanceof_Window` 必须返 1；`globalThis._pxUuid` 必须在 instantiate 之前设置 |
| 7 | 2026-02 | Bundle#3 5 个事件顺序敏感 + PX561 95 字段 Tier 1-5 全破解 |

## 19.3 ROI 评估

| 路径 | 一次性逆向成本 | 跨平台移植成本 | 长期维护成本 |
|---|---|---|---|
| 无感 Collector | 1 周 | 1 天/站 | 1 月 1 次 |
| 按压 Bundle | **3-4 周**（WASM + 鼠标 + DOM） | 1 周/站 | 2-3 周 1 次 |
| Userscript（替代） | 1 天 | 1 天/站 | 跟随 SDK 自动适应 |

**结论**：
- 单站点：Userscript 性价比最高
- 多站点 + 高并发：纯算 Bundle 必要
- 中等规模（5-20 站点）：混合（拿 cookie 走 Userscript，规模化数据采集走 Collector + Bundle fallback 走 Userscript）

## 19.4 待完成项

### 已完成 ✓

- [x] Bundle #1 Request: URL, Headers, POST 参数, Payload 完整结构
- [x] Bundle #2 Request: POST 参数差异, Payload 解密 (80+ 浏览器指纹字段)
- [x] cs 来源确认: 服务器 OB 响应 III000 handler 下发
- [x] pc 算法确认: HMAC-MD5(salt="uuid:tag:ft", data=JSON(events)) → 提取+间隔取
- [x] sid 隐写确认: Unicode Tag Characters (U+E0130 系列) 编码 cts 时间戳
- [x] Jf() 交织算法: payload = base64(XOR(JSON,50)) + UUID 驱动的字符交织 (offsets[i]-1)
- [x] bi / tag 来源: 均为脚本硬编码固定值
- [x] /ns 接口: 返回值放入 payload 字段 (Sm), 非 cs 参数
- [x] Bundle URL & Headers: `/assets/js/bundle`, `application/x-www-form-urlencoded`
- [x] Fingerprint 字段映射: Bundle #1 前 12 字段 = Collector PX12095, Bundle #2 = 80+ 浏览器指纹
- [x] Jf() 交织逆向: 去交织算法已实现
- [x] **Bundle #3 5 事件 + PX561 95 字段** Tier 1-5 全破解
- [x] **WASM a()/b() 在 Node.js 中完全复现**

### 待完成

- [ ] **轨迹池扩容**：5 条 → 50-100 条
- [ ] **Chrome 多版本 error stack 模板库**
- [ ] **WASM 常量更新自动化检测**
- [ ] **跨平台移植到 Grubhub Bundle**（如果它触发的话）
- [ ] **视觉挑战 PX12634 完整逻辑**（拼图等其它挑战类型）
- [ ] **ss() 回调逻辑**：PoW 结果如何编码进 Bundle #2

---

# 第二十部分：Mobile SDK 对比

PX 不只 Web，还有 Android/iOS Mobile SDK。**算法层完全不同**，简要对比给读者了解。

## 20.1 vs Web SDK

| 维度 | Web SDK | Mobile SDK |
|---|---|---|
| **AppID** | `PXO1GDTa7Q` | `PXO97ybH4J`（Grubhub mobile） |
| **端点** | `/api/v2/collector` 或 `/assets/js/bundle` | `/api/v1/collector/mobile` |
| **Payload 类型** | PX12095/PX11590/PX11547 | PX315/PX329 |
| **加密** | XOR(50) + base64 + 交织 | base64（**无 XOR**、**无交织**） |
| **PoW** | SHA-256 暴力搜索 | 数学运算 switch-case |
| **WASM** | 嵌入在 captcha.js | **无 WASM** |
| **TLS** | Chrome TLS | okhttp3 TLS |

## 20.2 Mobile PoW 算法

跟 Web 的 SHA-256 暴力完全不同，Mobile 用 **switch-case 数学运算**：

```java
// 输入格式: appc|2|timestamp|hash|n1|n2|n3|n4|n5|n6
// 算法: pow(pow(n3, n4, n1, n6), n5, n2, n6)

int pow(int i12, int i13, int i14, int i15) {
    int op = (i15 % 10 != 0) ? i14 % (i15 % 10) : i14 % 10;
    switch (op) {
        case 0: return i13 + i12*i12;
        case 1: return i12 + i13*i13;
        case 2: return i13 * i12*i12;
        case 3: return i13 ^ i12;
        case 4: return i12 - i13*i13;
        case 5: int t = i12+783; return t*t + i13*i13;
        case 6: return i13 + (i12^i13);
        case 7: return i12*i12 - i13*i13;
        case 8: return i13 * i12;
        case 9: return (i13*i12) - i12;
    }
}

// PX257 = ByteBuffer.wrap(modelBytes).getInt() ^ powResult
```

Mobile 路径**没有 WASM、没有按压挑战、没有鼠标轨迹**。整体复杂度比 Web Bundle 路径低。

## 20.3 何时关心 Mobile SDK

- 反爬 iFood/Grubhub Android App 时
- 反爬 iOS App（用类似 okhttp 行为合成）
- 不在本文档范围（本文档只讲 Web）

---

# 附录 A：常量速查卡

## A.1 iFood Bundle 完整常量

```
Init AppID:        PXO1GDTa7Q
Bundle AppID:      PXd6f03jmq8h6c7382req0（每会话从 OB#1 解，举例某会话的值）
TAG:               U0MmDhUmOnhXSw==  （Collector）/ "O2MKZn0OEhI/ag=="（Bundle）
FT (Collector):    401
FT (Bundle):       388
Cookie:            _px3 (TTL 330s)
Collector URL:     https://collector-pxo1gdta7q.px-cloud.net/api/v2/collector
Bundle URL:        https://collector-pxo1gdta7q.px-cloud.net/assets/js/bundle
captcha.js URL:    https://client.px-cloud.net/PXO1GDTa7Q/captcha.js
main.min.js URL:   https://client.px-cloud.net/PXO1GDTa7Q/main.min.js
WASM 位置:          captcha.js Us()[10] base64
WASM 大小:          ~60862 bytes
WASM magic:        0061736d 01000000

OB XOR key:        ml(TAG) % 128 = 100 (iFood) / 91 (Grubhub) / 120 (v8.9.6 老)
OB delim:          ~~~~ (4 个波浪号)
OB handler 数:     27 (Collector) / 29 (Bundle，多 2 个 PoW dispatch)
OB wire chars:     0 + l (iFood 新版) / o + I (Grubhub 老版) / 1 + o (v8.9.6)

PoW difficulty:    16 bits (= 4 hex chars match)
PoW iterations:    ~65536 平均
PoW time:          9-60ms (同步 Node) / 600s+ (异步)
PoW maxCounter:    1 << 16 = 65536

WASM 自定义字母表: /=+!1@2#3$4%5^6&7*8(9)0-
缅甸文 base:       U+1000 (4096)
缅甸文 XOR key:    4210

Bundle#1 字段数:   16
Bundle#2 字段数:   228
Bundle#3 字段数:   5 events: PX10498/PX561/PX10496/PX535/PX11116
                              或 [browserFp, mouseout, PX561, onSolved, PX11994]
  PX561 字段数:    95
  PX561 Tier 分级: T1 写死 50 + T2 简单写活 25 + T3 Session 15 + T4 轨迹 5 + T5 WASM 3 = 98
鼠标轨迹点数:       544 (完整) / 150 (过滤) / 25 (子集)
按压时长:           1000-3000ms
鼠标坐标精度:       1 位小数（offsetX/Y 浮点）
错误栈组数:         4
错误栈匹配:         Chrome 大版本绑定（140/142/145/148/150）

PX 默认 fallback ts: 1604064986000 (2020-10-30T17:16:26Z)
```

## A.2 算法魔法常量（跨版本/跨站点都一样）

```
MD5 init A:        1732584193  (0x67452301)
MD5 init B:        -271733879  (0xEFCDAB89, signed)
MD5 init C:        -1732584194 (0x98BADCFE, signed)
MD5 init D:        271733878   (0x10325476)
HMAC ipad:         909522486   (0x36363636)
HMAC opad:         1549556828  (0x5C5C5C5C)
UUID v1 epoch:     122192928e5 (Gregorian → Unix 转换常数)
INT32_MAX:         2147483647  (ml() hash function)
base91 字母表:     F@bt...     (新版 PX SDK，老版可能不同)
XOR(50) for payload: 50         (固定，不跨版本)
XOR(10) for interleave key: 10  (固定)
XOR(120) for OB:   动态（ml(gt) % 128）
```

## A.3 主要 main.js 函数定位

| 函数 | 行号 | 功能 |
|---|---|---|
| `Ql` | 3933-4239 | Handler 注册表（27 个） |
| `ih()` | 4310-4339 | OB 段处理器（分发） |
| `mh()` | 4384-4444 | POST 参数构造 |
| `Jf()` | 3128-3171 | payload 加密 + 交织 |
| `jt()` | 596-609 | PC 计算（HMAC-MD5 变体） |
| `hh()` | 4366-4373 | sid 隐写编码 |
| `Ho()` | 1415-1417 | cs 取值（return qa） |
| `it()` | 299-329 | 自定义 JSON 序列化 |
| `ee()` | 666-670 | XOR 编码/解码 |
| `R()` | 75-84 | MD5/HMAC-MD5 |
| `Am()` | 8376-8406 | /ns 接口请求 |
| `oh()` | 4276-4309 | 设置 _px3 cookie |
| `fh()` | 4361 | 设置 to/eo |
| `ch()` | 4344 | 设置 no/ro |
| `ah()` | 4273 | 设置 ao |
| `hr()` | 1012-1034 | Cookie 写入 |
| `sr()` | 1002-1005 | Cookie 删除 |
| `Xr()` | 1171-1187 | Cookie 配置存储 |
| `qu()` | 2537-2542 | PoW 挑战入口（备用） |
| `os()` | 2589-2597 | PoW worker 启动 |
| `ss()` | 2610-2612 | PoW 结果回调 |
| `ds()` | 2659-2664 | PX763 回调 |
| `zu()` | 2516-2521 | PX1145 通知 |
| `ls()` | 2617-2620 | 获取 captcha 模块 |
| `bu()` | 2462-2464 | captcha 已加载? |
| `Rr` | 1138-1165 | 常量表（"cc"） |

## A.4 captcha.js 函数定位

| 函数 | 行号 | 功能 |
|---|---|---|
| `sha256()` | ~7000-7164 | 纯 JS SHA-256 |
| `poi()` | 7165-7170 | PoW 单次尝试 |
| `ws()` | 7171-7175 | Web Worker 循环 |
| `Ks()` | 7176-7219 | 创建 Web Worker |
| `Ts()` | 7406-7410 | 存储 PoW 结果 |
| `Bs()` | **7411-7524** | **完整 PoW 求解器** |
| Handler registration | 10348 | `window._O1GDTa7Qhandler = {PX762, PX1135, PX12634}` |

---

# 附录 B：调试命令速查

## B.1 解码命令

```bash
# 解 Bundle#1 payload
node skill/AI_re/scripts/decode_payload.js bundle1_request.txt

# 解 Bundle OB 响应
node skill/AI_re/scripts/decode_response.js U0MmDhUmOnhXSw== bundle1_response.json

# 提取 WASM
node bundle/script/extract_wasm.js captcha.js

# 跑 WASM
node bundle/script/run_wasm.js px_captcha.wasm <pow_answer>

# 跑 PoW
node -e "console.log(require('./revers/pow.js').solvePoW('7e3b', 'a3f5d7e9b1c2...', 16))"
```

## B.2 SHA 验证

```bash
# captcha.js 还是不是当前版？
sha256sum stample/bundle/source/captcha.js

# WASM 还是不是当前版？
sha256sum stample/bundle/source/px_captcha.wasm

# 提取 WASM data section（看 ChaCha20 seed 变了没）
wasm-objdump -j data px_captcha.wasm | head -50
```

## B.3 抓包

```bash
# CDP 抓 Bundle 全流程
python skill/cdp/scripts/capture_via_cdp_ifood_bundle.py \
    --target https://www.ifood.com.br/ \
    --burst-trigger \
    --out bundle_samples/N/
# 触发挑战需要先 burst（连发 200+ 请求让风险评分超阈值）
```

## B.4 跟生产环境对比

```bash
# 我生成的 Bundle#2 vs 真抓
python stample/bundle/script/compare_bundle2.py /tmp/my_bundle2.json bundle_samples/1/bundle2_request.txt

# 字段级 diff
python stample/bundle/script/diff_http.py /tmp/my_bundle2_request.txt bundle_samples/1/bundle2_request.txt
```

## B.5 浏览器控制台快速验证

```js
// 1. 找 PX handler
Object.keys(window).filter(k => k.includes('handler'));
// → ["_O1GDTa7Qhandler"]

// 2. 看注册的函数
const h = window._O1GDTa7Qhandler;
Object.keys(h);   // → ["PX762", "PX12634", "PX1135"]

// 3. 看 Bs 源码
h.PX1135.toString();

// 4. 截 _px3 cookie 写入
const orig = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
Object.defineProperty(document, 'cookie', {
    get: () => orig.get.call(document),
    set(v) {
        if (v.startsWith('_px3=')) console.log('_px3:', v);
        orig.set.call(document, v);
    }
});

// 5. 跑 WASM 看输出
window._pxUuid = 'test-uuid';
// 然后让 PX SDK 自然加载 → 看 console
```

---

# 附录 C：跟项目其它部分的关系

```
perimeter/
│
├── main/                  完整文档（无感为主，Bundle 在 §3 一笔带过）
│   └── ZH/PX_SDK_逆向技术文档.md
│
├── revers/                ⭐ 9 个算法模块（payload/pc/ob/sid/uuid/hash/memory/antitamper/ns）
│   │                        Bundle 沿用 7 个
│   │                        Bundle 缺：pow.js, wasm.js（待补）
│
├── skill/
│   ├── AI_re/              AI agent 逆向 skill（含 Bundle 提及）
│   └── cdp/                抓包 skill（Bundle 也用）
│
├── stample/
│   ├── ifood/              iFood 无感路径 generator + source + script + sample
│   └── grub/               同上 Grubhub
│
├── bundle/                ⭐ Bundle 路径（本文档的家，已归档）
│   ├── README.md          归档说明
│   ├── doc/
│   │   └── Bundle_完整技术文档.md      ⭐ 本文档（5070 行）
│   ├── source/                          captcha.js + px_captcha.wasm + SDK_INFO.md + WASM_ANALYSIS.md
│   ├── stample/
│   │   ├── sample/                      8 个 raw 抓包（4 Bundle POST + 4 OB 响应）
│   │   ├── decoded/                     8 个解码结果（4 EV JSON + 4 state JSON）
│   │   └── mouse_tracks/                51 文件（50 真鼠标轨迹 + mouse_pool.json）
│   └── script/userscripts/
│       └── px_bundle3_auto.user.js     ⭐⭐⭐ 实战 10/10 油猴脚本（2131 行）
│
└── bug_report/             68 条踩坑全集
    └── 2_bundle_path.md    Bundle 专属 20 条
```

**配套关系**：

| 我要做什么 | 去哪 |
|---|---|
| 看 Bundle 整体怎么回事 | 本文档 §1-2 |
| 写 Bundle generator | 本文档 §3-9（按 Bundle#1→#2→#3 顺序读）+ revers/ 模块 |
| 看 229 字段每个含义 | 本文档 §10（按 17 类详列） |
| 看加密链源码级 | 本文档 §11（Jf/jt/it/ee/hh 全函数还原） |
| 跑测试 | 待补 bundle/script/ + bundle/stample/ |
| 排查为什么拿不到 cookie | 本文档 §15 + `bug_report/2_bundle_path.md` |
| 跨平台移植 | 本文档 §14 |
| SDK 升级了 | 本文档 §16 + skill/AI_re/playbooks/identify-sdk-version.md |
| 看 PX v8.9.6 业界资料 | 本文档 §18（Pr0t0ns 完整对照已并入） |
| 看 Mobile SDK | 本文档 §20 |

---

## 文档版本 + 维护说明

| 项 | 值 |
|---|---|
| 版本 | v2.0（详细版） |
| 编写日期 | 2026-05-21 |
| 行数 | ~5500+ |
| 校验 SDK 版本 | iFood `b47a639c…` (Collector) + 配套 captcha.js (Bundle) |
| 校验状态 | 10/10 实测通过（含 Userscript + 部分纯算） |
| 下次大修 | 当 PX 推 SDK 大版本时（典型 3-6 个月） |

**素材来源**：本文档是 31 份原始文档（12000+ 行）的消化整合版。原素材合并完后已删除（按"跟无感重复 → 精简"原则）。原文件来源：
- 主线 EN 13 份（perimeterX_Re/docs/04_bundle）
- 字段表 + 踩坑 4 份（perimeter_X/docs/zh）
- 中文 pedagogical 4 份（Desktop 新建文件夹 (4)/docs）
- Deep-Dive 7 份（perimeter_X/docs/references）
- 业界视角 3 份（ifood-web 生产项目）

要回溯任意一段是从哪份原始文档来的，git history (`sourcing-cracked` 仓库 commit `007623b` 之前) 或 GitHub `warterbili/px3cookie` 仓库都还保留着完整原文。

本文档是上述 31 份的**消化整合版**，按"先理解再做"重新组织。引用具体细节时直接看 （原素材已并入本文档） 对应章节，本文档负责把它们串成一个连贯叙事。

---

*完。*
