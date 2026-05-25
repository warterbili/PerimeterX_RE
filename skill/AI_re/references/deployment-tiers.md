# PX 部署严格度对照（Deployment Tiers）

> 新发现 (2026-05-25)：PX 不是"一种"防护，是**同一 SDK 在不同客户那里有不同的服务端策略**。
> 同样的 generator 在宽档站点能用、在严档站点失败，不是算法 bug，是没覆盖到严档的额外校验。

## 为什么会有这一篇

iFood/Grubhub generator 历史上 10/10 通过 == 真能跑业务 API；按这个经验做 totalwine 的 generator，10/10 全 issue 了 cookie 但 cookie 一打受保护端点全 403。
反复测了 TLS / IP / 代理都救不了。最后发现是**严档部署的服务端校验项**没满足。

为了下次遇到新站点不踩同样的坑，本文档把 PX 部署按"严格度"分档，并对照已验过的 3 个站点。

## 两档总览

| 维度 | 宽档（iFood、Grubhub） | 严档（Total Wine） |
|---|---|---|
| **Collector POST 链长** | 2 POSTs (seq=0, 1) | **3 POSTs (seq=0, 1, 2)** |
| **Cookie 签发** | seq=1 响应 | seq=1 响应 |
| **Cookie 立即可用** | ✅ 拿到即可调业务 API | ❌ **必须发 seq=2 cookie-confirmation beacon 后才会被边缘接受** |
| **HMAC 字段后端校验** | 弱/不查 | **强校验**：服务端独立算一遍跟客户端上报对比 |
| **Counter 同步约束** | 不查 | **查** `PX12738 == PX12739`、跨 EV 单调递增 |
| **Collector 路径** | 三方 (`*.px-cloud.net`) | **一方** (`/<appPrefix>/xhr/api/v2/collector`) |
| **EV2 字段数** | ~200 | ~199 |
| **`state` 含 `hid`** | ❌ | ✅ |
| **失败时的拒绝形态** | 403 + captcha | **403 + PX bootstrap JSON**（短 JSON, 不发 captcha） |

## 怎么判断新站点在哪档（早期判定）

**Stage 1.5（建议加在主 workflow 抓 6 批之后立刻做）**：

```bash
# 1. 看 collector_post_count
jq '.collector_post_count' sample/{1..6}/meta.json
#   值长期是 2 → 宽档
#   值长期是 3+ → 严档（去解第 3 个 POST body 看是否含 cookie 字段确认）

# 2. 看 collector URL
grep first_collector_url sample/*/meta.json
#   *.px-cloud.net → 三方，倾向宽档
#   <appPrefix>/xhr/api/v2/collector → 一方部署，**严档概率高**

# 3. 看第 3 个 POST 是否回传 cookie
node skill/AI_re/scripts/decode_payload.js sample/1/request_3.txt > /tmp/ev3.json
jq '.[0].d | keys[]' /tmp/ev3.json | grep -c "OkpJAH8oTTA="
#   ≥1 → 严档，必须实现 EV3 cookie-confirmation beacon

# 4. 看 EV2 是否含 hid-shaped state field
# response_1 解码后看有没有 "OlllOOll|<base64>=:<base64>|true" 段
```

**用判定结果决定后续验证强度**:
- 宽档 → 走 skill 现有 `validate-generator.md` Layer 3（拿到 cookie 即可）
- 严档 → **必须**走 Layer 3.5（真打 PX-gated 端点）+ 用 `recover-hmac-formulas.md` 重新实测所有 HMAC 字段 input

## 已验证案例

### 宽档 #1: iFood
- AppID: `PXO1GDTa7Q`
- Collector: `https://collector-pxo1gdta7q.px-cloud.net/api/v2/collector`
- 部署特征: 2 POSTs, 三方 collector, `_px3` cookie
- 难度: 算法正确即过, 后端不深查 EV 字段语义

### 宽档 #2: Grubhub
- AppID: `PXO97ybH4J`
- Collector: `https://sensor.grubhub.com/O97ybH4J/xhr/api/v2/collector`（一方但宽档）
- 部署特征: 2 POSTs, 一方 collector, `_px2` cookie
- 难度: 算法正确 + 跨 6 批确定 state.no 在 EV2 的 b64 key 即过

### 严档 #1: Total Wine
- AppID: `PXFF0j69T5`
- Collector: `https://www.totalwine.com/FF0j69T5/xhr/api/v2/collector`
- 部署特征: 3 POSTs, 一方 collector, `_px2` cookie, EV2 有 hid state, counter 同步约束
- 难度: 算法对了之后**还有 4 个独立陷阱**（Bug #15-#18）

## 严档为什么更难

宽档下后端只查"该 session 上报的 PC 是否合法 + EV2 字段结构是否合理"，分数过线就放行。
严档下后端额外查：

1. 客户端上报的 HMAC = 服务端用真实 input（state.vid / state.pxsid 等）独立算的 HMAC？
2. Cookie 是否回传 (seq=2 beacon)？
3. 跨 event 的计数器是否同步且单调？
4. EV1/EV2/EV3 的字段集是否严格匹配 SDK 实际产出（不能多 / 不能少 / 不能跨 event 复用）？
5. State 里的 hid（device hardware id）是否原样回传？

任何一条不满足 → cookie 签发但 trust=low → 边缘拒。

## 未来扩展的建议

遇到新站点（特别是美国大型零售/酒类/银行/航空），先按 Stage 1.5 判档。
如果是严档，优先去找：

- [ ] EV3 cookie 回传字段（Gotcha #16）
- [ ] `MDxDNnVeQgQ=` 风格的 counter 字典字段是否有 PX12xxx 子字段相等约束（Gotcha #17）
- [ ] 所有 HMAC 字段的真实 input（Gotcha #18 / `recover-hmac-formulas.md`）
- [ ] state 是否多了 `hid` 之类的非常规字段（OlllOOll segment）

把判档结果写在 `tmp/<site>/log/RECON.md` 顶部，让下一个 maintainer 一眼就知道这个站点是哪档。
