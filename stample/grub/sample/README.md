# Grubhub PX 抓包样本

6 批从 grubhub.com 实抓的 PerimeterX collector POST + 响应 + 解码结果。

---

## 1. 目录结构速览

```
sample/
├── README.md              本文件
├── README_EN.md           英文版
├── 1/                     批次 1 (9 个文件)
├── 2/                     批次 2
├── 3/                     批次 3
├── 4/                     批次 4
├── 5/                     批次 5
└── 6/                     批次 6
```

**`1/` 到 `6/` 是 6 个独立的抓包批次** —— 6 次全新会话，每次都用全新的
Chrome profile（无 cookies、无 cache、新 UUID），打开 grubhub.com 等
20 秒，把 PX SDK 发出的所有 collector POST 全部抓下来。

**为什么要 6 批**：3 批不足以稳定区分 STATIC（每次都一样）和 DYNAMIC
（每次都变）字段，6 批让"模板法"生成器可以稳定提取出"哪些字段是死的、
哪些字段要算法生成"。详见 [`main/ZH/PX_逆向方法论_通用版.md`](../../../main/ZH/PX_逆向方法论_通用版.md) §10。

---

## 2. 每批里的 9 个文件 — 详解

打开任意一个批次（如 `1/`），里面 9 个文件分 3 类：

### 2.1 原始抓包（4 个文件，从浏览器抓的字节流）

```
request_1.txt       POST #1 完整请求（含 URL + headers + body）
request_2.txt       POST #2 完整请求
response_1.json     响应 #1（PX collector 返回的 JSON）
response_2.json     响应 #2
```

#### ⭐ 为什么是 2 个 request（iFood 是 3 个）？

**Grubhub 这版 PX SDK 在主页会话内只发 2 个 collector POST**（iFood 在
餐厅列表页会发 3 个，多一个 EV3 行为追踪）。两个 POST 的 URL 都是
`sensor.grubhub.com/O97ybH4J/xhr/api/v2/collector`，区别在 POST body
里的 `seq=` 和 `rsc=` 参数：

| 文件 | seq / rsc | body 大小 | 阶段 | 内容 |
|---|---|---|---|---|
| `request_1.txt` | `seq=0` / `rsc=1` | ~1.0 KB | **EV1 — 初次注册** | 12 字段轻量身份；目的是让 PX 服务器在响应里下发 `state.no` / `state.to` / `state.qa` 等会话状态 |
| `request_2.txt` | `seq=1` / `rsc=2` | ~9.4 KB | **EV2 — 完整指纹** | 205 字段完整浏览器指纹 + 注入上一步拿到的 state.\*；目的是拿到 `_px2` cookie |

**逆向流程**：

- POST #1 → 响应 #1 拿 `state.*`
- 把 state.* 注入 POST #2 → 响应 #2 里拿 `_px2` cookie

> ⚠️ **跟 iFood 的差异**：iFood 拿 `_px3`（TTL 330s），Grubhub 拿 `_px2`
> （TTL 500s）。Cookie 名 + TTL 是站点级配置，不是 SDK 版本差异。

### 2.2 解码结果（4 个文件，原始抓包用算法解出来的明文）

```
decoded_payload_1.json      request_1 的 payload 解码 → EV1 JSON (12 字段)
decoded_payload_2.json      request_2 的 payload 解码 → EV2 JSON (~205 字段)
decoded_response_1.json     response_1.ob 解码 → state.* 全部
decoded_response_2.json     response_2.ob 解码 → 含 _px2 cookie 段
```

### 2.3 批元数据（1 个文件）

```
meta.json                   批 ID + UUID + 常量 + 时间戳 + 响应 status
```

例子（batch 1）：

```json
{
  "batch_id": 1,
  "site": "https://www.grubhub.com/",
  "uuid": "3998c310-5422-11f1-931f-79511c482128",
  "tag": "FmYgK1gdJEAP",
  "ft": "359",
  "app_id": "PXO97ybH4J",
  "captured_at": "2026-05-20T08:02:24Z",
  "collector_post_count": 2,
  "status_post_1": 200,
  "status_post_2": 200
}
```

字段含义：

| 字段 | 含义 |
|---|---|
| `batch_id` | 批次编号（1-6） |
| `site` | 抓包目标页 URL |
| `uuid` | 这批会话的 UUID v1（每批独立生成） |
| `tag` | PX 常量 TAG（PC 校验用） |
| `ft` | PX 常量 FT |
| `app_id` | PX 客户标识（**`PXO97ybH4J`** — 修正过旧文档错的 `PXdRotaCw0`） |
| `captured_at` | 抓包时间（UTC ISO） |
| `collector_post_count` | 抓到的 collector POST 个数（Grubhub 固定 2 个） |
| `status_post_1` / `status_post_2` | 两个 POST 的 HTTP status（200 = 成功） |

> ⚠️ 6 批 meta.json 都**没记** `sdk_sha256` 字段（抓包脚本当时是旧版），但
> 6 批是同一个 9 分钟窗口、同一个 SDK，SHA-256 见下方公共元数据表。

---

## 3. 公共元数据（6 批都一样）

| 维度 | 值 |
|---|---|
| 抓包目标 | `https://www.grubhub.com/` |
| App ID | **`PXO97ybH4J`** |
| TAG | `FmYgK1gdJEAP` |
| FT | `359` |
| Cookie | `_px2`（TTL 500s） |
| Collector URL | `https://sensor.grubhub.com/O97ybH4J/xhr/api/v2/collector` |
| EV1 event type | `YjIUOCdXHA8=` |
| EV2 event type | `ViZgLBBGaB4=` |
| SDK SHA-256 | `5e81bffc53ba95808ae81795358d8b71d3b5ba9ebfdaa013ff65ecafa278aad1` |
| SDK 大小 | ~263.7 KB |
| SDK 源 URL | `https://sensor.grubhub.com/O97ybH4J/init.js`（不叫 `main.min.js`） |
| 抓包时间 | 2026-05-20 08:02:24Z ~ 08:04:35Z UTC（2 分钟） |
| 抓包工具 | [`skill/cdp/scripts/capture_via_cdp_grubhub.py`](../../../skill/cdp/scripts/capture_via_cdp_grubhub.py) |
| 抓包方法 | CDP 直连真 Chrome，无 webdriver 痕迹 |

> ⚠️ **旧文档把 AppID 写成 `PXdRotaCw0` / FT 写成 `330`** —— 都错了。
> `PXdRotaCw0` 是 Grubhub 早期一个不同的 PX 项目，现在线上是
> `PXO97ybH4J`。本表的值是从这 6 批真实 POST body 直接提取的。

## 4. 6 批 UUID + 时间 一览

| 批 | UUID | 抓包时间 (UTC) |
|---|---|---|
| 1 | `3998c310-5422-11f1-931f-79511c482128` | 08:02:24 |
| 2 | `49810710-5422-11f1-8549-2d1696bebe37` | 08:02:50 |
| 3 | `57294620-5422-11f1-9c97-a7b3d175e3e3` | 08:03:15 |
| 4 | `6a3fbfa0-5422-11f1-bf15-cd6c1ad15185` | 08:03:45 |
| 5 | `7a06c000-5422-11f1-b4df-f773790aef2d` | 08:04:10 |
| 6 | `87cb60b0-5422-11f1-8b96-816dc76da612` | 08:04:35 |

---

## 5. ⚠️ Grubhub vs iFood —— 几个关键差异

虽然两个站都跑同一种 PX SDK，但 wire 字符、字段 key、cookie 都不同，
**生成器代码要分两套**。

| 维度 | iFood | Grubhub |
|---|---|---|
| AppID | `PXO1GDTa7Q` | `PXO97ybH4J` |
| Cookie | `_px3`（TTL 330） | `_px2`（TTL 500） |
| Collector URL | `collector-pxo1gdta7q.px-cloud.net/api/v2/collector` | `sensor.grubhub.com/O97ybH4J/xhr/api/v2/collector` |
| SDK 文件名 | `main.min.js` | `init.js` |
| 一次会话 POST 数 | 3（含 EV3） | 2 |
| EV1 字段数 | 14 | 12 |
| EV2 字段数 | ~204 | ~205 |
| OB wire 字符 | `0` 和 `l`（新版） | `o` 和 `I`（老版） |
| `state.no` 注入到 EV2 的 key | `RTEwewNQMUg=` | `UT0ndxdcJUQ=` |
| `state.to` 注入到 EV2 的 key | `FCAhKlJCIxk=` | `UBxmVhZ+Z2U=` |
| `state.no` 类型 | `parseInt(state.no)` ⭐ | `parseInt(state.no)` ⭐ |

> 用 OB handler 名（`oIIoIIIo` 等）跨版本不可靠 —— **按 args shape 匹配**。
> 详见 [`skill/AI_re/references/handler-table.md`](../../../skill/AI_re/references/handler-table.md)。

---

## 6. 怎么用

### 看一个 EV1（轻量指纹）

```bash
jq '.[0].d | keys | length' sample/1/decoded_payload_1.json
# → 12 字段

jq '.[0].d' sample/1/decoded_payload_1.json | head -20
```

### 看一个 EV2（完整指纹）

```bash
jq '.[0].d | keys | length' sample/1/decoded_payload_2.json
# → ~205 字段
```

### 看 state.*（从 OB 解码出来的会话状态）

```bash
jq '.segments' sample/1/decoded_response_1.json
# → 12 段，含 state.no / state.to / state.qa / state.vid / state.pxsid / state.appId / state.cts / state.jf
```

### 看 set_cookie 段（拿到的 _px2）

```bash
jq '.segments[] | select(.args[0]=="_px2")' sample/1/decoded_response_2.json
# → { handler: "...", args: ["_px2", ttl, value, ...] }
```

### 跨 6 批 diff（字段三分类）

```bash
node ../../../skill/AI_re/scripts/diff_samples.js \
    sample/1/decoded_payload_2.json \
    sample/2/decoded_payload_2.json \
    sample/3/decoded_payload_2.json \
    sample/4/decoded_payload_2.json \
    sample/5/decoded_payload_2.json \
    sample/6/decoded_payload_2.json \
    > field_classes.json
```

### 重新解码（验证解码器对当前 SDK 通用）

```bash
node ../../../skill/AI_re/scripts/decode_payload.js sample/1/request_1.txt
node ../../../skill/AI_re/scripts/decode_response.js sample/1/response_1.json FmYgK1gdJEAP
```

---

## 7. 完整性校验

```bash
# 1. 6 批必须每批 9 文件
for i in 1 2 3 4 5 6; do
    n=$(ls sample/$i/ 2>/dev/null | wc -l)
    [ "$n" -eq 9 ] && echo "batch $i: OK" || echo "batch $i: $n files (BAD)"
done

# 2. 所有响应必须 status=200
for i in 1 2 3 4 5 6; do
    jq -r '"batch \(.batch_id): post1=\(.status_post_1) post2=\(.status_post_2)"' sample/$i/meta.json
done

# 3. 跟 SDK 公共表的 SHA 对一下（确认 6 批同一份 SDK）
sha256sum ../source/init.js
# 应等于 5e81bffc53ba95808ae81795358d8b71d3b5ba9ebfdaa013ff65ecafa278aad1
```

预期输出：6 行 `batch X: OK` + 6 行 `post1=200 post2=200`。

---

## 8. 配套资源

| 想看什么 | 去哪 |
|---|---|
| EV1/EV2 字段语义 | [`main/ZH/PX_SDK_逆向技术文档.md`](../../../main/ZH/PX_SDK_逆向技术文档.md) 附录 E |
| 解码原理 + 算法 | [`main/ZH/PX_完整SDK对照逆向方法论.md`](../../../main/ZH/PX_完整SDK对照逆向方法论.md) |
| iFood vs Grubhub 对照 | [`main/ZH/PX_完整SDK对照逆向方法论.md`](../../../main/ZH/PX_完整SDK对照逆向方法论.md) §8 |
| 怎么写解码器 | [`skill/AI_re/scripts/`](../../../skill/AI_re/scripts/) |
| 怎么自己抓 6 批 | [`skill/cdp/scripts/capture_via_cdp_grubhub.py`](../../../skill/cdp/scripts/capture_via_cdp_grubhub.py) |
| Grubhub SDK 源 + SDK_INFO | [`../source/`](../source/) |
| Grubhub generator | [`../script/`](../script/) |

---

*抓包来源：原 `perimeter_X/samples/grubhub/`，校验时间 2026-05-21。
全部 6 批响应 status=200，已用 [`skill/AI_re/scripts/decode_payload.js`](../../../skill/AI_re/scripts/decode_payload.js)
回放验证通过。英文版见 [`README_EN.md`](README_EN.md)。*
