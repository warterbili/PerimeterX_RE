# Walmart — 研究用途说明

本目录是 PerimeterX SDK 逆向研究的一个案例，**仅针对 walmart.com 的 PX 层**做
协议级分析，用于理解 PerimeterX collector 链路的算法与字段结构。

## 范围与限制
- Walmart 实际主防护是 **Akamai Bot Manager**，PerimeterX 是次级层。
- 本案例**只逆 PX 层**，产出能被 PX collector 接受的 `_px3`（200 + 签发 cookie）。
- **不涉及 Akamai**（`_abck`/`bm_sv` sensor），因此 `_px3` 单独**不能**通过
  Walmart 业务 API —— 这超出本 skill 范围，且本研究不尝试绕过 Akamai。
- 不做规模化请求、不针对真实账户、不绕过业务风控；仅本地少量验证算法正确性。

---

## 为什么做不了端到端（Layer 3.5）—— 实测证据

"端到端"指：用拿到的 cookie 请求**业务 API** 拿到真实业务 JSON。Walmart 做不到，
因为业务 API 的强制门是 **Akamai**（本 skill 范围外），不是 PX。下面三段都可复现。

### ① Akamai 与 PX 都部署在 walmart.com（活体指纹，2026-06-19/20 复验）

| 厂商 | 证据 |
|---|---|
| **Akamai** | 首页 `Set-Cookie: akavpau_p2=…`、响应头 `Server-Timing: ak_p` |
| **PerimeterX** | 首页加载 `/px/PXu6b0qd2S/init.js`（PX SDK） |

复现：`curl -s -D - https://www.walmart.com/ | grep -iE "akavpau|ak_p"` 与
`curl -s https://www.walmart.com/ | grep -o "/px/PX[A-Za-z0-9]*/init.js"`。

### ② 业务 API 的强制门是 Akamai，不是 PX

无任何 cookie 请求两个业务 graphql 端点，**都被 Akamai 边缘挡下**：

```
GET /orchestra/home/graphql        → 418  Server: AkamaiGHost
GET /orchestra/snb/graphql/search  → 418  Server: AkamaiGHost
   body: "Access Denied … Reference #0.37f00f17.<ts>.<id>"   ← Akamai 招牌拒绝页
```

判定依据：拒绝由 **`AkamaiGHost`（Akamai 边缘 server）** 返回、带 Akamai
`Reference #` 格式，**拒绝页里没有任何 PX 标记**（无 `px-captcha`、无 `_px*`）。
即拦截发生在 **Akamai 边缘、在 PX 评估之前**。要过这道门需要 Akamai 的
`_abck`/`bm_sv`（sensor），那是逆 Akamai，超出本 skill。

> 诚实边界：因为 Akamai **先**挡，我们无法观测 PX 是否会在 Akamai 之后**二次**
> 拦截 —— 测不到（根本到不了 PX 那一层）。可确证的是：Akamai 是**最外层的强制门**。

### ③ 怎么验证「PX 成功」—— collector 层差分（不是看 200！）

collector 对**任何** POST 都返回 200，所以 200 不是成功信号。真正的成功 = 我们的
合成 payload 让 PX **解码并吐出完整 OB 状态链**；同信封的垃圾 payload 则解不出东西。
脚本 [`script/px_success_proof.js`](script/px_success_proof.js) 做这个差分：

| | 状态码 | OB 段数 | state.no/appId/to | body |
|---|---|---|---|---|
| **正例**（真 payload） | 200 | ~12 段 | ✅ ✅ ✅ | ~880 B |
| **反例**（垃圾 payload，同信封） | 200 | 1 段 | ❌ ❌ ❌ | 10 B |

差分成立 → PX 真的解码并接受了我们合成的传感器数据。再叠加完整链路的
**`_px3` 10/10 签发**（collector#2 返回 set_cookie 段），即为本研究可达的 PX-层成功证明。

复现：`node script/px_success_proof.js`（正例 rich / 反例 empty）；
`node px_cookie/walmart_px3.js`（拿 `_px3`）。

详见 [`source/SDK_INFO.md`](source/SDK_INFO.md)。
