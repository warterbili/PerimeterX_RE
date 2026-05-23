# 🎯 iFood — 研究目的与实战案例

> 这个文件夹**不是**学术演示。它是**真实生产爬虫**的纯算 PX 模块，每天产生 _px3 → 直接调 iFood GraphQL → 抓 2000+ 商家数据。

---

## 1. 用途总览（一句话）

**用 `_px3` cookie 通过 PerimeterX 守门，直接调 iFood `cw-marketplace.ifood.com.br` GraphQL 抓取商家 + 菜单 + 商品数据。**

---

## 2. PX cookie 在业务链路的位置

```
            浏览器 / 爬虫
                │
                ▼
        ┌─────────────────┐
        │ ifood_px3.js    │  ← 本目录
        │ (~350ms 一个)    │
        └────────┬────────┘
                 │ _px3 + _pxvid + _pxcts
                 ▼
   ┌─────────────────────────────────────────┐
   │ POST cw-marketplace.ifood.com.br/       │
   │      v1/merchant-info/graphql           │
   │                                          │
   │ ← PX 守门，无 _px3 = 403                │
   └────────┬────────────────────────────────┘
            │
            ▼
        merchant data:
        { name, userRating, available, address, menu, products }
```

| Cookie | 来源 | 作用 |
|---|---|---|
| `_px3` | generator OB#2 set_cookie 段 | PX 主认证 |
| `_pxvid` | generator `state.vid` | PX 访客 ID（持续会话） |
| `_pxcts` | generator `state.cts` | PX 客户端时间戳 |

业务 API 端点：

| 端点 | 用途 |
|---|---|
| `POST .../v1/merchant-info/graphql` | 商家详情（name / rating / 营业状态） |
| `POST .../v2/cardstack/search/home` | 首页 feed（按地理位置） |
| `GET .../v1/merchants/restaurant/{id}/catalog` | 菜单 + 商品 |

---

## 3. 端到端示例（30 秒跑通）

### 准备

```bash
cd <repo-root>/stample/ifood/px_cookie
npm install https-proxy-agent     # 一次性，代理支持
node smoke_test.js                # 自检 21/21 ✓ 确认环境就绪
```

### 跑 demo

⚠️ **必须用巴西住宅代理**（Cloudflare 拦数据中心 IP + 非 BR IP）。本项目用 Bright Data：

```bash
# PowerShell
$env:HTTPS_PROXY = 'http://<BRD_USER>:<BRD_PASS>@zproxy.lum-superproxy.io:22225'
# bash
export HTTPS_PROXY='http://<BRD_USER>:<BRD_PASS>@<BRD_HOST>:<BRD_PORT>'

node business_api_demo.js
# 或指定商家 ID
node business_api_demo.js 5770dab7-943e-4046-9b71-1f9d39aec822
```

默认 `merchant_id = 5770dab7-…` (Bar e Lanches Estadão, São Paulo Centro) — 2026-05-23 实测仍活。
如果该 ID 失效，从首页 feed 拉一个新的：
`POST /v2/cardstack/search/home?latitude=-23.5505&longitude=-46.6333&channel=IFOOD&alias=HOME_MULTICATEGORY_V10`
读 `MERCHANT_LIST_V2.contents[].id`。

### ✅ 实测输出（2026-05-23 跑通）

```
[proxy] using http://<BRD_USER>:***@zproxy.lum-superproxy.io:22225
━━━ Step 1: 生成 _px3 ━━━
✅ _px3=bd8a1bd1b7a5292d…  ttl=330  (5103ms)
   uuid=...  vid=ee2defd8-5626-...

━━━ Step 2: 用 _px3 调 GraphQL 抓商家 ━━━
   merchant_id: 5770dab7-943e-4046-9b71-1f9d39aec822
   cookies: _px3, _pxvid, _pxcts

GraphQL response: HTTP 200  (1897ms)
✅ 业务 API 调通 — _px3 评分足够

{
  "data": {
    "merchant": {
      "available": true,
      "name": "Bar e Lanches Estadão",
      "userRating": 4.9
    }
  }
}

━━━ 总耗时: 7000ms  (gen 5103 + api 1897) ━━━
```

### 2026-05-23 demo 修复记录（之前 400 的根因）

之前的 demo 跑出来 400 "Merchant not found"，定位为 3 处叠加 bug，**单独修任一处都还是死，必须 3 处一起修才能通**：

| # | 位置 | 原代码 | 后果 | 修复 |
|---|---|---|---|---|
| 1 | `business_api_demo.js:87` | `path: u.pathname` | URL `?latitude&longitude&channel=IFOOD` query string 被丢，后端拿不到地理索引 → 400 not_found | `path: u.pathname + u.search` |
| 2 | 缺生产 header | 无 `platform / app_version / Country / browser` | 部分端点被 WAF 识别为非浏览器 | 4 个 header 全补 |
| 3 | `DEFAULT_MERCHANT_ID = ccd2ff85-…` | 2026-05-21 verified，但 2 天后该店下架 → 400 not_found | 换 `5770dab7-…` (Bar e Lanches Estadão) |

均已固化进 `business_api_demo.js`，开箱即跑。

### 关键发现（实测踩坑）

| 现象 | 原因 | 修复 |
|---|---|---|
| 不带代理 → 403 HTML | Cloudflare 拦非 BR IP | BR 住宅代理 |
| `/v2/cardstack/search/home` 返回 px-captcha | feed 端点 PX 评分门槛比 GraphQL 高 | 用 `/v1/merchant-info/graphql` 端点验证 _px3 |
| 缺 `?latitude=&longitude=&channel=IFOOD` → 400 "Merchant not found" | iFood 后端按地区索引；`u.pathname` 默认丢 query string | URL 必须带这 3 参数，且 `https.request({ path })` 用 `u.pathname + u.search` |
| 400 "Merchant not found"（参数齐全） | merchant_id 已下架 / 改 ID | 换 ID；生产从 home feed 自动拉 |
| 缺 `platform / app_version / Country / browser` header → 部分端点 WAF 拦 | iFood 服务端做浏览器 header 完整性校验 | 4 个 header 全带 |
| iFood vs `cw-marketplace.ifood.com.br` 端点对比 | `marketplace.*` (移动 API) **无 PX**；`cw-marketplace.*` (web) **有 PX** | demo 用 cw- 因为我们的研究目标是测试 PX |

---

## 4. 验证脚本

| 脚本 | 用途 |
|---|---|
| `px_cookie/smoke_test.js` | 21/21 自检（验证 generator 算法正确性，不调真实 PX） |
| `px_cookie/business_api_demo.js` ⭐ | **端到端真实 API 调用** —— 这才是"_px3 工作"的真正证明 |
| `script/verify_all.sh` | 6 批样本解码闭环（验证解码器对当前 SDK 工作） |
| `script/diff_samples.py` | 字段三分类（STATIC/DYNAMIC/CONDITIONAL） |
| `script/find_state_keys.py` | state.* → EV2 b64 key 映射 |

**关键区别**：
- `smoke_test.js` = "我算的字节跟真抓字节一致" — 算法层 OK
- `business_api_demo.js` = "PX 实际接收并发 _px3 + 业务 API 接受这个 _px3" — **真实可用**

---

## 5. 生产链路图

```
              Bright Data 住宅代理 (Brazil IP)
                      │
                      ▼
         ┌──────────────────────────────────┐
         │ ifood_full_scraper.py            │ ← 外部生产爬虫（不在本仓）
         │ (Python, curl_cffi chrome120 TLS)│
         └──────┬───────────────────────────┘
                │ 每 ~300 次请求换 _px3
                │
                ├──> ifood_px3.js (本目录的 generator)
                │    生成 { _px3, _pxvid, _pxcts }
                │
                ├──> POST .../v2/cardstack/search/home  (首页 feed)
                │    {lat: -23.5505, lng: -46.6333}  ← 圣保罗
                │    ↓
                │    merchants list (40 家/页, 翻页)
                │
                ├──> POST .../v1/merchant-info/graphql  (并发 10-15 worker)
                │    每个 merchant_id 拉详情
                │    ↓
                │    { name, userRating, available, address }
                │
                └──> GET .../v1/merchants/restaurant/{id}/catalog
                     ↓
                     menu + products

         产出: data/merchants.jsonl (1.4 GB / 2000+ 商家)
```

实测吞吐量（来自 `benchmark_workers.py`）：

| Workers | Delay | 吞吐 | 429 率 |
|---|---|---|---|
| 5 | 0.3s | ~16 req/s | < 1% |
| 10 | 0.2s | ~50 req/s | < 5% |
| 15 | 0.1s | ~150 req/s | ~15% |

⭐ **关键认知**：`_px3` 有 ttl = 330 秒，一个 cookie 大约能用 300 次请求。生产里**每 ~300 次重新生成一次**。

---

## 6. 关联文档

### 本项目内

| 文档 | 用途 |
|---|---|
| [`px_cookie/README.md`](px_cookie/README.md) | 本目录详细技术说明 |
| [`px_cookie/ifood_px3.js`](px_cookie/ifood_px3.js) | _px3 generator 入口 |
| [`px_cookie/business_api_demo.js`](px_cookie/business_api_demo.js) ⭐ | 本研究目的的端到端 demo |
| [`source/SDK_INFO.md`](source/SDK_INFO.md) | 锁定 SDK 版本 + SHA256 + 常量 |
| [`../../main/ZH/methodology/`](../../main/ZH/methodology/) | 10 章方法论 |
| [`../../bug_report/1_collector_path.md`](../../bug_report/1_collector_path.md) | Collector 路径 33 条踩坑 |
| [`../../revers/`](../../revers/) | 9 个算法模块（payload/pc/ob/sid/uuid/...） |

### 生产项目（外部）

| 模块 | 用途 |
|---|---|
| Python 版 _px3 generator | 包了 Node.js 子进程，供生产调用 |
| iFood 主爬虫（商家 / 菜单 / 商品三级） | 消费纯算 _px3，跑 merchants + catalog + products |
| 并发性能测试 | 实测吞吐 / 429 率 |

---

## ⚠️ 法律 & 道德边界

- 本研究用于**自审你自己部署在 iFood 上的反爬效果**、**学术研究**、**安全审计**
- 不要用于**违反 iFood 服务条款的大规模爬取**或商业重新出售
- 高频率爬取请配住宅代理 + 间隔，不要给 iFood 制造异常流量
- iFood 公开商家信息属于"公开可获取"范畴，但**仍受 robots.txt 和 ToS 约束**

---

*校验时间 2026-05-23。生产实测 10/10 通过。Demo 已修复 3 处 bug（path + 生产 header + merchant ID），开箱即跑。
完整端到端 journal：[`../live_validation/journal/2026-05-23.md`](../live_validation/journal/2026-05-23.md)*
