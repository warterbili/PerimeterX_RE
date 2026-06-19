# Walmart `_px3` Cookie 生成器

Walmart 的 `_px3` cookie 纯算生成器。**PX 宽档（lenient）部署案例**。

> ⚠️ **多厂商站点。** Walmart 主防护是 **Akamai Bot Manager**，PerimeterX 是**次级**层。
> 本目录**只逆 PX 层**，产出能被 PX collector 接受的 `_px3`（200 + 签发 cookie）。
> `_px3` 单独**不能**通过 Walmart 业务 API —— Akamai（`_abck`/`bm_sv` sensor）才是主门，
> 超出本 skill 范围且本研究不尝试绕过。
>
> 🎯 研究目的 → [`../RESEARCH_PURPOSE.md`](../RESEARCH_PURPOSE.md) ·
> SDK 快照/常量/字段映射 → [`../source/SDK_INFO.md`](../source/SDK_INFO.md)

## 目录

```
px_cookie/
├── README.md
├── smoke_test.js                ⭐ 一键自检（require + 常量 + 模板 + 跨事件 15 项）
├── walmart_px3.js               ⭐ 主生成器（2-POST，seq=0/1）
├── walmart_ev1_template.json    (EV1, 12 字段)
├── walmart_ev2_template.json    (EV2, 207 字段)
├── walmart_ev1_field_map.json   (字段分类：STATIC/DYNAMIC/PARTIAL/CONDITIONAL)
├── walmart_ev2_field_map.json
└── state_key_map.json           (state.* → EV2 b64 key 跨批匹配)
```

## 常量（tag/ft/bi 运行时从 SDK 拉取，AppID 稳定）

| 字段 | 值 | 来源 |
|---|---|---|
| AppID | `PXu6b0qd2S` | live capture POST body（稳定） |
| TAG | `eW5CaD8AUB99Zg==` | SDK 运行时（轮换；fallback 内置） |
| FT | `396` | SDK 运行时（轮换） |
| Cookie | `_px3`（hex 格式，ttl 330） | decoded ob#2 |
| Collector | `https://collector-pxu6b0qd2s.px-cloud.net/api/v2/collector` | 第三方 |
| OB XOR key | `41` = `ml(TAG) % 128` | 实测 |
| EV1 / EV2 event type | `eW5CLzwARxg=` / `bRJWEyt5UyE=` | decoded payload `t` |

## 部署档位：**LENIENT（宽档）**

| 项 | Walmart (`_px3`) |
|---|---|
| Collector POST 数 | **2**（seq=0 / seq=1，无 EV3 beacon） |
| Collector | 第三方 `*.px-cloud.net` |
| PX12xxx counter dict | **无**（totalwine 严档才有） |
| 按压验证码 bundle | 抓包 6/6 `bundle_post_count=0`（无感全程） |

## state.* → EV2 b64 key 映射（6/6 实测）

| state field | EV2 key | 注入规则 |
|---|---|---|
| `state.no` | `HwRkBVluazY=` | `parseInt(state.no)` ⚠️ Gotcha #1 |
| `state.to` | `UBdrVhZ+Z2U=` | string |
| `state.eo` | `EFcrFlU9JSQ=` | string |
| `state.appId` | `LDNXMmlcWgg=` | string |
| `state.vid` | `GmEhYFwIKVQ=`(HMAC) / `CzBwcU5bfEI=`(MD5) | 喂 HMAC/MD5 输入 |
| `state.pxsid` | `MklJCHQkQjs=`(HMAC) | 喂 HMAC 输入 |
| `state.qa/cts/vid` | POST form params `cs=`/`cts=`/`vid=` | 不进 EV2 payload |

## HMAC/MD5 字段（6/6 实测，不能从别站抄）

```
OkFBAHwnTTY=  = HMAC-MD5(uuid,        UA)
GmEhYFwIKVQ=  = HMAC-MD5(state.vid,   UA)
MklJCHQkQjs=  = HMAC-MD5(state.pxsid, UA)
CzBwcU5bfEI=  = MD5(state.vid)            ⭐ 单 arg, 不是 HMAC
```

## 跨事件一致性（⭐ updated-skill 新增 — `cross_event_consistency.py`）

生成器把全部 session 时间绑到单一页面加载 epoch `t0`，满足 EV1↔EV2 不变量：

- **CONSTANT**（EV1==EV2）：`ajERMCxcFQc=`（=t0）、`HUJmQ1soY3c=`（uuid）
- **MONOTONIC**（EV2≥EV1）：`Ahk5WERyM2o=`、`U0goSRYkLHs=`、`SlFxEA86eyc=`
- **VARY**：`AEc7BkUsMTA=`（标准 base64，长 500-512）

详见 [`../source/SDK_INFO.md`](../source/SDK_INFO.md) 跨事件不变量表。

## 使用

```bash
cd stample/walmart/px_cookie

# 1) 静态自检（不打外网，15 项）
node smoke_test.js

# 2) 生成 _px3（直连第三方 collector；需美国出口 IP）
node walmart_px3.js
# → ✅ _px3=a2426f96…  ttl=330  ev1=12 ev2=207

# 3) 作为模块
node -e "require('./walmart_px3')().then(r=>console.log(r.cookie_name,'=',r.cookie_value.slice(0,40)))"
```

### 调试：dump EV1/EV2 与真抓逐字段对比

```bash
PX_DUMP="C:/path/to/dump" node walmart_px3.js          # 写 mine_ev1.json / mine_ev2.json
python ../../../skill/AI_re/scripts/diff_ev_field_by_field.py \
    mine_ev2.json ../sample/1/decoded_payload_2.json override.txt
python ../../../skill/AI_re/scripts/cross_event_consistency.py ../sample
```

## 验证标准

| Layer | 通过标准 | 状态 |
|---|---|---|
| 1 | `node smoke_test.js` 全过（不打外网） | **15/15** ✅ |
| 2 | 6 批 sample 解码闭环（`script/decode_all.js`） | ✅ |
| 3 | `node walmart_px3.js` 10 次拿到不同 `_px3` | **10/10** ✅ |
| 3.5 | 业务 API 200 | ⛔ 不尝试（Akamai 主门，超范围） |
