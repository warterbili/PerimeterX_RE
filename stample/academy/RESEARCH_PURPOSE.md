# 🎯 Academy Sports — 研究目的与实战案例

> 这个文件夹是 **PX「严档+」部署**逆向的端到端实战 —— 比 [Total Wine](../totalwine/RESEARCH_PURPOSE.md) 又深一档。
> 它证明：同一个 PX SDK，在 academy.com 这个客户处不仅有 Total Wine 那套严档服务端校验，
> 还**额外把 cookie 信任分绑定到 mint 时的 TLS 指纹与 IP 信誉** —— 一个结构完全合法的 `_px3`，
> 若 mint 时用的是 node TLS / JSDOM 指纹 / 被污染的 IP，照样在网关页被挑战。

跟 iFood/Grub（宽档）相比：底层算法 100% 共享，但 academy 在 Total Wine 三档之上再加了
**三条新校验**（counter 全模式、/ns 的 TLS 指纹、必须真 Chrome 模板），把"严档"方法论补到第二个样本。

---

## 1. 一句话用途

**用纯算 `_px3` 通过 PerimeterX（严档+部署）守门，从 curl_cffi / Python 直接拿
academy.com 商品页（`/c/sports-outdoors` 等）真实 HTML，无需真浏览器。**

## 2. PX cookie 在业务链路的位置

```
        爬虫 / 自动化
             │
             ▼
   ┌──────────────────────┐   一条 chrome142 持久 session
   │ academy_px3.js        │   ┌─────────────────────────┐
   │  (3 POST 链 seq=0/1/2)│──▶│ session_server.py 边车   │
   │  ⭐ /ns 走同一 session │   │  /ns + collector + edge  │
   └──────────┬───────────┘   └─────────────────────────┘
              │ _px3 (TTL 330)
              ▼
   academy.com/c/sports-outdoors  → 真 HTML（非 /captcha 重定向）
```

## 3. 实测结论（端到端）

| 测量环境 | 结果 | 含义 |
|---|---|---|
| **新 US 住宅 IP（每次换）** | **10/10 PASS** | 算法 + 指纹完全正确，对标 Total Wine 10/10 |
| 4-way 矩阵（真浏览器/curl × 真cookie/我们cookie） | 真cookie 两路过；低信任cookie 仅真浏览器过 | 信任分在 **mint 时**由 collector 决定 |
| 本地 IP（重复 mint 后） | ~1/5 | 单 IP 高频 mint 拖垮该 IP collector 信誉 |
| node TLS / JSDOM 模板 | BLOCK | 传输/指纹不够真 → 低信任 |

## 4. 这个案例给方法论补了什么（之前样本没有的）

1. **Counter 子字段全模式** —— Total Wine 只记了 `PX12738==PX12739`，本案例挖出完整
   合法集 `(0,0)/(N,N)/(N,0)` 与"`(0,N)` 非法"这条（修它从 ~40% → 10/10）。
2. **`/ns` token 是 TLS 指纹化的** —— 第一个发现 /ns 响应长度随客户端 TLS 变（node 432 / Chrome 504）。
3. **模板必须真 Chrome** —— 第一个证明 JSDOM/node_bridge 模板信任分不足（其 cookie 也被网关拒）。
4. **持久 session 传输** —— 第一个必须用 curl_cffi chrome142 持久 session（/ns+collector+edge 一条 TLS）才过的站点。
5. **trust 诊断矩阵** —— 4-way（真浏览器/curl × 真/我们 cookie）定位"墙在 cookie 内容还是传输"。

详见同目录 [`px_cookie/README.md`](px_cookie/README.md) 与
skill [`deployment-tiers.md`](../../skill/AI_re/references/deployment-tiers.md) / 记忆 `px-strict-tier-gotchas`。

---

> 仅用于授权安全研究 / 方法论建设。与 iFood、Grubhub、Total Wine 同属一套"同 SDK 不同档"对照样本。
