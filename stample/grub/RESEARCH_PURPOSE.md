# 🎯 Grubhub — 研究目的与实战案例

> 这个文件夹**不是**学术演示。它是**真实生产账号体系**的纯算 PX 模块，每天产生 _px2 → 自动注册/登录 Grubhub 账号 → 换出下游 Instacart 爬虫用的 sid。

---

## 1. 用途总览（一句话）

**用 `_px2` cookie 通过 PerimeterX 守门，调 `api-gtm.grubhub.com/auth` 系列端点完成账号注册/登录/刷新，最终通过 OAuth2 SSO 换出 `__Host-instacart_sid` 给下游 Instacart 商超爬虫使用。**

> ⭐ **关键认知**：Grubhub PX **守的是账号体系（grubhub.com）**，不是真实数据接口。
> 真正爬数据的 `grocery.grubhub.com` (Instacart white-label) **不用 PX** —— 走 `__Host-instacart_sid` 直接 GraphQL。

---

## 2. PX cookie 在业务链路的位置

```
           Bright Data Web Unlocker (注册时绕 PX)
                      │
                      ▼
        ┌─────────────────────────────────┐
        │ grubhub_px2.js                  │  ← 本目录
        │ (~350ms 一个)                    │
        └────────┬────────────────────────┘
                 │ _px2 + _pxhd
                 ▼
   ┌────────────────────────────────────────┐
   │ POST api-gtm.grubhub.com/auth          │
   │   (anonymous token)                    │  ← PX 守门
   │ POST api-gtm.grubhub.com/auth/login    │  ← PX 守门
   │ POST api-gtm.grubhub.com/auth/         │  ← PX 守门
   │      confirmation_code   (OTP)         │
   │ PUT  api-gtm.grubhub.com/oauth2/...    │  ← PX 守门
   └────────┬───────────────────────────────┘
            │ access_token + refresh_token
            │
            │ 4 步 OAuth2 SSO
            ▼
   ┌────────────────────────────────────────┐
   │ grocery.grubhub.com/rest/sso/auth/...  │  ← 无 PX！
   │ → Set-Cookie: __Host-instacart_sid     │
   └────────┬───────────────────────────────┘
            │
            ▼
   ┌────────────────────────────────────────┐
   │ grocery.grubhub.com/graphql            │  ← 无 PX！
   │ (Instacart 商超数据)                    │
   └────────────────────────────────────────┘
            │
            ▼
       2006 家门店 × 商品 ≈ 1.4 GB
```

| Cookie | 来源 | 作用 |
|---|---|---|
| `_px2` | generator OB#2 set_cookie 段 | PX 主认证 |
| `_pxhd` | generator OB#1 set_cookie 段 | PX 高熵 device |
| `_pxvid` | generator `state.vid` | PX 访客 ID |

业务 API 端点（全部走 `api-gtm.grubhub.com`）：

| 端点 | 用途 | 用 PX？ |
|---|---|---|
| `POST /auth` (scope=anonymous) | 匿名 token | ✅ |
| `POST /auth/login` | 邮箱密码登录 | ✅ |
| `POST /auth/confirmation_code` | 发 OTP | ✅ |
| `PUT  /auth/confirmation_code` | 验证 OTP | ✅ |
| `PUT  /oauth2/{ud_id}/access` | OAuth2 换 code | ✅ |
| `GET grocery.grubhub.com/rest/sso/auth/awe/callback` | 换 instacart_sid | ❌ |
| `POST grocery.grubhub.com/graphql` | Instacart 数据 | ❌ |

---

## 3. 端到端示例（30 秒跑通）

### 准备

```bash
cd <repo-root>/stample/grub/px_cookie
npm install https-proxy-agent     # 一次性，代理支持
node smoke_test.js                # 自检 17/17 ✓ 确认环境就绪
```

### 跑 demo

```bash
node business_api_demo.js
```

⭐ **2026-05-23 起，demo 自带默认 US 住宅代理 + 默认 device-trusted 测试账号** —— 直接 `node business_api_demo.js` 就能跑完 3 stage 全链路 200。
生产请用环境变量覆盖：

```bash
# PowerShell
$env:HTTPS_PROXY     = 'http://<user>:<pwd>@<host>:<port>'   # US 住宅
$env:GRUBHUB_EMAIL   = 'your@email.com'
$env:GRUBHUB_PASSWORD= 'yourpassword'
# bash
export HTTPS_PROXY='http://<user>:<pwd>@<host>:<port>'
export GRUBHUB_EMAIL='your@email.com'
export GRUBHUB_PASSWORD='yourpassword'

node business_api_demo.js
```

### ✅ 实测输出（2026-05-23 跑通 — 全链路 3 stage 全 200）

```
[proxy] using http://<user>:<pwd>@zproxy.lum-superproxy.io:22225
━━━ Stage 1: 生成 _px2 ━━━
✅ _px2=eyJ1IjoiZDI0MWU4ZTAtNTY2MC0xMWYxLTk2ZTIt…  ttl=500  (3808ms)
   uuid=d241e8e0-5660-11f1-96e2-3b6ca74ffdb1  vid=d32cf7af-5660-...

━━━ Stage 2: /auth (anonymous scope) ━━━
   endpoint: https://api-gtm.grubhub.com/auth
   HTTP 200  (3752ms)
✅ PX 守门 #1 通过 — anon_token=9cd431b4-9ae9-4f…  expire_in=60min

━━━ Stage 3: /auth/login (real account) ━━━
   email: ****@***.***
   HTTP 200  (3295ms)
✅ PX 守门 #2 通过 — 登录成功
   user access_token: 35ae5c54-****-****-****-************…
   refresh_token:     54c8caee-****-****-****-************…
   ud_id:             8f04f320-****-****-****-************

━━━ Total time: 10855ms  (gen 3808 + anon 3752 + login 3295) ━━━
```

### 完整逻辑：demo 在干什么 + 之前为什么挂掉 + 现在为什么通了

> 详细 raw 实测数据：[`../live_validation/journal/2026-05-23.md`](../live_validation/journal/2026-05-23.md) §Part 2

#### 整条链路（demo 跑 3 stage，PX 守门 #1 + #2 验完为止）

```
[1] grubhub_px2.js  →  _px2 + _pxvid                          ← 本目录 generator
       (~3.8s，纯算)
            │
            ▼
[2] POST api-gtm.grubhub.com/auth (scope=anonymous)            ← PX 守门 #1
       headers: cookie=_px2; _pxvid;  Chrome 120 UA
       body:    { brand, client_id, device_id: <random UUID>, scope: "anonymous" }
       → HTTP 200 + anonymous_token (UUID)
            │
            ▼
[3] POST api-gtm.grubhub.com/auth/login                        ← PX 守门 #2
       headers: cookie=_px2; _pxvid;  Authorization: Bearer <anon_token>
       body:    { brand, client_id, device_id: "-981990071", email, password }
       → HTTP 200 + user access_token + refresh_token + ud_id   ✅ demo 结束
       → HTTP 463 = PX 通过 + 业务层风控要 OTP (device_id 陌生)
       → HTTP 403 = PX 评分不够，拦在 PX 层
            │
            │  下游生产项目（不在本 demo 范围）：
            ▼
[4-7] SSO 4 步 (init → authorize → /oauth2/<ud_id>/access → callback)
       → Set-Cookie: __Host-instacart_sid
            │
            ▼
[8] POST grocery.grubhub.com/graphql  (无 PX！直连)
       → Instacart 商超数据
```

#### 之前（2026-05-21）跑到哪一步挂掉

**先说结论**：PX SDK 部分（[1] [2]）**一直是绿的**，从 2026-05-21 旧 journal 起 Stage 2 `/auth` 就是 200。挂的是 **Stage 3 `/auth/login`，停在 HTTP 463**，老 demo 把 463 算作 "PX-pass" 就结束 —— 没拿到 user access_token，跑不了后面的 SSO，**端到端没通**。

为什么 Stage 3 老返回 463？4 个原因叠加：

| # | 原因 | 详细 |
|---|---|---|
| 1 | **`device_id` 每次随机 UUID** | 老代码用 `crypto.randomUUID()` 生成 device_id 传给 `/auth/login`。Grubhub 业务层看到「这个 email + 陌生 device」→ 强制 OTP 验证 → 463 |
| 2 | **`device_id` 即使固定了也用 integer** | 业务层信任记录按 **string** 存。即使账号有信任的 device_id，integer `-981990071` 跟 string `"-981990071"` 匹配不上 → 仍当陌生设备 |
| 3 | **UA Chrome 148 跟 TLS 指纹不一致** | demo 写 `Chrome 148.0.0.0` UA，但 curl_cffi/proxy 层的 TLS 指纹是 `impersonate='chrome120'`。PX 服务端交叉校验 UA header vs TLS ClientHello → 不一致 → 评分掉（虽然没掉到 403，但是给业务层加权了风控信号） |
| 4 | **账号池没维护** | 老 demo 期望用户自己传 `GRUBHUB_EMAIL`/`PASSWORD`，普通账号 device 都是陌生的 → 业务层一律要 OTP |

老 demo 拿 463 直接 return，注释里写 "463 算 PX-pass"，**但实战拿不到 user token = 没法继续**。

#### 现在（2026-05-23）为什么 Stage 3 直接 200

3 处改动让业务层直接放行：

| # | 改动 | 代码位置 | 为什么有效 |
|---|---|---|---|
| 1 | **`device_id` 用 fixed string `"-981990071"`** | `business_api_demo.js:205` | 业务层 trust 记录按 string 存，且这个数字**跟具体账号一一绑定**（换账号必须换 device_id）。错一位 → 463 |
| 2 | **UA 改 Chrome 120，跟 TLS 对齐** | `business_api_demo.js:102` | UA / TLS 指纹一致 → PX 评分稳，业务层信任度提升 |
| 3 | **默认账号换成 device-trusted 维护账号** | `DEFAULT_EMAIL` (line 68) | device-trusted 账号 = 此前完整跑过 OTP 注册，业务层把它的 device_id 入了信任白名单 → 直接 200 |

#### 还有 2 处改动是下游生产项目做的（不在本 demo）

为完整起见列出，**本 demo 不需要**：

| # | 改动 | 干什么 |
|---|---|---|
| A | **入口路径改成 `/auth/refresh` 优先**，refresh 失败才 fallback `/auth/login` | `/auth/refresh` 是 PX 低门槛端点 + 不查 device_id；refresh_token 活的账号根本不打 /login |
| B | **SSO step 3 (`PUT /oauth2/<ud_id>/access`) 用裸 `_GH_HEADERS + Bearer`**，不加 `perimeter-x` HMAC header | 该端点也被 PX 守，但加 HMAC header 反而 403（HMAC 公式跟其它端点不同）。让 PX cookie 在 jar 里自动带就行 |

A 跟 B 是为了拿到 `__Host-instacart_sid` 落地 grocery.grubhub.com 数据，跟本 demo 验证 PX SDK 这事无关。

### 关键发现（实测踩坑）

| 现象 | 原因 | 修复 |
|---|---|---|
| Stage 2 HTTP 403 | _px2 评分不够 / 数据中心 IP / TLS 指纹不对 | 换 US 住宅代理；UA 对齐 TLS chrome120 |
| Stage 3 HTTP 463 (OTP needed) | 账号 device_id 业务层不熟悉 | 换 device-trusted 账号 or 走 mail.tm OTP 流程 |
| Stage 3 HTTP 403 | PX 守门 #2 没过 | 多半是 `_px2` cookie 没带或 jar 里 expire 了 |
| Stage 3 HTTP 401 "Invalid client_id" | demo 写了过期 client_id | 用 `beta_UmWlpstzQSFmocLy3h1UieYcVST` |
| /auth 返回 UUID 不是 JWT | anonymous scope 给简单 token | 业务正常 — Stage 3 拿到的 user access_token 才是长期凭据 |
| 不带代理也能跑（本机 IP） | Grubhub 美国站对全球 IP 都接受，但 PX 评分会降 | 用 US 住宅代理保险（demo 自带默认） |

### 全链路（拿 `__Host-instacart_sid`）

本 JS demo 只到 Stage 3（拿 user access_token + refresh_token + ud_id）。继续拿下游 grocery.grubhub.com 用的 `__Host-instacart_sid` 需要再走 SSO 4 步，由下游生产项目负责（详见 journal §2.2 [7]-[10]）。**本仓职责到 Stage 3 为止 —— 证明 PX SDK 的 _px2 在 2 个守门端点都被服务端接受。**

---

## 4. 验证脚本

| 脚本 | 用途 |
|---|---|
| `px_cookie/smoke_test.js` | 17/17 自检（验证 generator 算法正确性） |
| `px_cookie/business_api_demo.js` ⭐ | **端到端真实 API 调用** —— _px2 工作的真正证明 |
| `script/verify_all.sh` | 6 批样本解码闭环（验证解码器对当前 SDK 工作） |
| `script/diff_samples.py` | 字段三分类（STATIC/DYNAMIC/CONDITIONAL） |
| `script/find_state_keys.py` | state.* → EV2 b64 key 映射（Grubhub 跟 iFood 的映射完全不同！） |

---

## 5. 生产链路图（完整 8 步）

```
[1] grubhub_px2.js → _px2 + _pxhd                                 ← 本目录

[2] POST api-gtm.grubhub.com/auth (scope=anonymous)              ← /auth
       → anonymous_token  ✅ Bearer

[3] POST api-gtm.grubhub.com/auth/login                          ← /auth/login
       (email + password)
       → 200: access_token + refresh_token  或  463: 需要 OTP

[4] if 463:
       POST api-gtm.grubhub.com/auth/confirmation_code          ← /OTP send
       → mail.tm 轮询邮件
       PUT api-gtm.grubhub.com/auth/confirmation_code
       → access_token + refresh_token

[5] GET grocery.grubhub.com/rest/sso/auth/awe/init               ← OAuth2 Step 1
       → 302 redirect to authorize URL

[6] GET api-gtm.grubhub.com/oauth2/authorize?...                 ← OAuth2 Step 2
       → 302 redirect to grubhub login

[7] PUT api-gtm.grubhub.com/oauth2/{ud_id}/access                ← OAuth2 Step 3
       Authorization: Bearer <access_token>
       → { status: "GRANTED", redirect_uri: "...?code=xxx" }

[8] GET grocery.grubhub.com/rest/sso/auth/awe/callback?code=xxx  ← OAuth2 Step 4
       → Set-Cookie: __Host-instacart_sid=v2.xxx  ✅

[9] 下游：crawler_full.py 用 __Host-instacart_sid 调
       POST grocery.grubhub.com/graphql  (无 PX！)
       → 商超数据
```

**实测**：
- 单账号注册（含 OTP）：~30 秒
- Refresh token 刷新：~3 秒（直连，无需代理）
- access_token 有效期：60 分钟
- refresh_token 有效期：30 天

---

## 6. 关联文档

### 本项目内

| 文档 | 用途 |
|---|---|
| [`px_cookie/README.md`](px_cookie/README.md) | 本目录详细技术说明 |
| [`px_cookie/grubhub_px2.js`](px_cookie/grubhub_px2.js) | _px2 generator 入口 |
| [`px_cookie/business_api_demo.js`](px_cookie/business_api_demo.js) ⭐ | 本研究目的的端到端 demo |
| [`source/SDK_INFO.md`](source/SDK_INFO.md) | 锁定 SDK 版本 + SHA256 + 常量 |
| [`../../main/ZH/PX_完整SDK对照逆向方法论.md`](../../main/ZH/PX_完整SDK对照逆向方法论.md) | iFood vs Grubhub 字段对照（1441 行） |
| [`../../bug_report/1_collector_path.md`](../../bug_report/1_collector_path.md) | Collector 路径 33 条踩坑 |
| [`../../revers/`](../../revers/) | 9 个算法模块（跟 iFood 共享） |

### 生产项目（外部）

| 模块 | 用途 |
|---|---|
| Grubhub 账号体系（注册 / 登录 / token 刷新机） | 走完 9 步链路拿 `__Host-instacart_sid` |
| Python 版 _px2 generator | 包了 Node.js 子进程，供生产调用 |
| 下游 Instacart 爬虫 | **无 PX**，承接上游账号 token |

---

## ⚠️ iFood vs Grubhub 关键对比

| 维度 | iFood | Grubhub |
|---|---|---|
| **PX 守的是什么** | 数据 API（GraphQL） | 账号体系（auth + SSO） |
| **PX cookie** | _px3 + _pxvid + _pxcts | _px2 + _pxhd + _pxvid |
| **TLD** | ifood.com.br | grubhub.com (api-gtm.grubhub.com) |
| **业务 API** | 一步直接调 | **多步链路**：anon → login → OTP → SSO |
| **后续数据爬取还用 PX 吗** | ✅ 每次请求都过 PX | ❌ instacart_sid 域名不用 PX |
| **生产策略** | 持续生成 _px3（~300 次/cookie） | 一次注册 → token 滚动刷新 |

⭐ **这就是为什么 Grubhub 不需要"高频生成 _px2"**：拿到 instacart_sid 后下游全部走 grocery.grubhub.com，PX 完全脱离链路。Grubhub 的 _px2 价值是**账号体系入场券**，不是数据采集 token。

---

## ⚠️ 法律 & 道德边界

- 本研究用于**自审你自己部署在 Grubhub 上的反爬效果**、**账号体系安全审计**
- **不要用于批量注册虚假账号或绕过 OTP 进行欺诈**
- mail.tm 仅用于**研究用途的临时邮箱**，不要用于绕过 KYC
- 注册的账号应**仅用于研究目的**，不要伪冒身份

---

*校验时间 2026-05-23。本 JS demo 3 stage 全 200（device-trusted 账号，10.9s 全链路）。
完整端到端 journal：[`../live_validation/journal/2026-05-23.md`](../live_validation/journal/2026-05-23.md)*
