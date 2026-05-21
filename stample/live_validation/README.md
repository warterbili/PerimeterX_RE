# Live Validation — 真实生产 API 端到端验证

> "纯算 cookie 在真实业务接口上是否真的工作" 的可审计证据库。
> 不是 smoke_test（只验证字节对齐），是**真打代理 + 真调业务 API + 真返回数据**。

---

## 这个目录在干什么

整个项目有 **3 个层次**的验证，互相补足：

```
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 1: 算法层 smoke_test                                          │
│   stample/{ifood,grub}/px_cookie/smoke_test.js  (21/21 + 17/17)     │
│   验证: 算法字节级正确 (require 通过 + 常量 + 模板加载 OK)            │
│   产物: pass/fail                                                    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 2: 解码闭环                                                    │
│   stample/{ifood,grub}/script/verify_all.sh  (6/6 + 6/6)            │
│   验证: 6 批真抓样本能被解码器还原                                    │
│   产物: pass/fail                                                    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ⭐ Layer 3: 端到端业务 API 验证 (本目录)                              │
│   stample/{ifood,grub}/px_cookie/business_api_demo.js               │
│   验证: 纯算 cookie 真的让 PX 评分通过 + 业务 API 真返回数据          │
│   产物: 时间戳 journal + 真实 HTTP request/response 全文              │
└─────────────────────────────────────────────────────────────────────┘
```

**为什么有 Layer 3**：Layer 1+2 都是"我们自己跟自己对"。Layer 3 才证明 **PX 服务端真的认我们的 cookie**。这是项目"完工"的最终标准。

---

## 目录结构

```
stample/live_validation/
├── README.md            ← 本文件（验证体系 + 怎么读 journal + 怎么写新 journal）
└── journal/
    └── 2026-05-21.md    ← 每次验证一份，按日期命名
```

journal 是**时间线档案**，**只追加**（SDK 升级 / 重新验证后加新文件，不改老的）。

---

## 已验证记录

| 日期 | 站点 | 结果 | 详情 |
|---|---|---|---|
| 2026-05-21 | iFood + Grubhub | ✅ 双站全过 | [journal/2026-05-21.md](journal/2026-05-21.md) |

---

## journal 是什么 + 怎么读

每份 journal 是一次**完整端到端实测**的可审计证据。结构：

```
Part 0: 双站实测结论 (一目了然表格)

Part 1: <站点 A>
  1.1 接口介绍          ← 这个站点有哪些业务接口，哪些走 PX
  1.2 风控架构          ← 服务侧叠了几层（PX + Cloudflare + Akamai ?）
  1.3 IP 要求           ← 数据中心 / 本国住宅 / 哪国 IP 能过
  1.4 实战代码          ← 引用 stample/<site>/px_cookie/business_api_demo.js
  1.5 实测请求 + 响应   ← raw HTTP request/response 全文（不 truncate）
  1.6 PX 研究 insights  ← 这次实测发现的 PX 行为 (不是 debug 过程)

Part 2: <站点 B>
  ... 同上

复跑命令
```

**只记录 PX 研究 insights**（如端点评分门槛 / Akamai 叠加 / HTTP 463 判定），**不记录 debug 过程**（如"AI 哪里 grep 找到的 URL 参数"那种过程史 — 那些靠抓包就有）。

---

## 怎么写新 journal

SDK 升级 / 重新做 6 批样本 / 想验证某个新发现的端点 后，加一份新 journal：

```bash
# 1. 复制旧 journal 当模板
cp journal/2026-05-21.md journal/$(date +%Y-%m-%d).md

# 2. 跑 demo 拿真实输出
node stample/ifood/px_cookie/business_api_demo.js          # iFood
node stample/grub/px_cookie/business_api_demo.js           # Grubhub

# 3. 把实测 request/response 填到 journal 对应章节
# 4. 加这次的新发现到 "PX 研究 insights"
```

每份新 journal 末尾留时间戳 + 运行人。

---

## 复跑命令

详细参数见 journal 末尾。简版：

```bash
cd <project-root>
npm install

# iFood
export HTTPS_PROXY='http://<user>:<pwd>@<host>:<port>'   # BR 巴西住宅
node stample/ifood/px_cookie/business_api_demo.js

# Grubhub
export GRUBHUB_EMAIL='your@email.com'                    # 可选 (跑 full chain 需要)
export GRUBHUB_PASSWORD='yourpassword'                   # 可选
node stample/grub/px_cookie/business_api_demo.js
```

⚠️ **凭据**：本目录所有内容**绝不嵌任何凭据**（代理 user/pass / 邮箱密码 / Bright Data customer ID）。
全部通过环境变量传入。新 journal 也必须遵守这条 — 业务响应里如有真实邮箱/用户名也要 mask。
