# iFood PX 抓包样本

6 批从 ifood.com.br 实抓的 PerimeterX collector POST + 响应 + 解码结果。

---

## 1. 目录结构速览

```
sample/
├── README.md              本文件
├── 1/                     批次 1 (11 个文件)
├── 2/                     批次 2
├── 3/                     批次 3
├── 4/                     批次 4
├── 5/                     批次 5
└── 6/                     批次 6
```

**`1/` 到 `6/` 是 6 个独立的抓包批次** —— 6 次全新会话，每次都用全新的
Chrome profile（无 cookies、无 cache、新 UUID），打开 iFood 等 20 秒，把
PX SDK 发出的所有 collector POST 全部抓下来。

**为什么要 6 批**：3 批不足以稳定区分 STATIC（每次都一样）和 DYNAMIC
（每次都变）字段，6 批让"模板法"生成器可以稳定提取出"哪些字段是死的、
哪些字段要算法生成"。详见 [`main/ZH/PX_逆向方法论_通用版.md`](../../../main/ZH/PX_逆向方法论_通用版.md) §10。

---

## 2. 每批里的 11 个文件 — 详解

打开任意一个批次（如 `1/`），里面 11 个文件分 3 类：

### 2.1 原始抓包（6 个文件，从浏览器抓的字节流）

```
request_1.txt       POST #1 完整请求（含 URL + headers + body）
request_2.txt       POST #2 完整请求
request_3.txt       POST #3 完整请求
response_1.json     响应 #1 (PX collector 返回的 JSON)
response_2.json     响应 #2
response_3.json     响应 #3
```

#### ⭐ 为什么是 3 个 request（不是 2 个）？

**PX SDK 在浏览器加载后一次会话内连发 3 个 collector POST**，URL 都是
`collector-pxo1gdta7q.px-cloud.net/api/v2/collector`，区别在 POST body
里的 `seq=` 和 `rsc=` 参数：

| 文件 | seq / rsc | body 大小 | 阶段 | 内容 |
|---|---|---|---|---|
| `request_1.txt` | `seq=0` / `rsc=1` | ~2.5 KB | **EV1 — 初次注册** | 14 字段轻量身份；目的是让 PX 服务器在响应里下发 `state.no` / `state.to` / `state.qa` 等会话状态 |
| `request_2.txt` | `seq=1` / `rsc=2` | ~18 KB | **EV2 — 完整指纹** | 204 字段完整浏览器指纹 + 注入上一步拿到的 state.\*；目的是拿到 `_px3` cookie |
| `request_3.txt` | `seq=2` / `rsc=3` | ~30-50 KB | **EV3 — 行为追踪** | 用户在页面停留时持续收集鼠标轨迹、performance entries、可见性变化等 |

**逆向核心是前 2 个**：

- POST #1 → 响应 #1 拿 `state.*`
- 把 state.* 注入 POST #2 → 响应 #2 里拿 `_px3` cookie

POST #3 是**后续行为上报**，跟拿 cookie 无关，但抓下来做参考。

> 批 5 的 `request_3.txt` 只有 ~2.8 KB（其它批次是 30-50 KB），是因为那
> 20 秒内"用户"没操作，所以 EV3 收集到的行为数据少。不是文件缺失。

### 2.2 解码结果（4 个文件，原始抓包用算法解出来的明文）

```
decoded_payload_1.json      request_1 的 payload 解码 → EV1 JSON（14 字段）
decoded_payload_2.json      request_2 的 payload 解码 → EV2 JSON（~204 字段）
decoded_response_1.json     response_1.ob 解码 → state.* 全部
decoded_response_2.json     response_2.ob 解码 → 含 _px3 cookie 段
```

**没有 decoded_payload_3 / decoded_response_3** —— 因为第 3 个 POST 跟拿
cookie 无关，我们没解它。要解可以用 `skill/AI_re/scripts/decode_payload.js`。

### 2.3 批元数据（1 个文件）

```
meta.json                   批 ID + UUID + 常量 + 时间戳 + 响应 status
```

例子（batch 1）：

```json
{
  "batch_id": 1,
  "site": "https://www.ifood.com.br/restaurantes",
  "uuid": "c83577f0-5420-11f1-9150-e1cff29e25cc",
  "tag": "U0MmDhUmOnhXSw==",
  "ft": "401",
  "app_id": "PXO1GDTa7Q",
  "captured_at": "2026-05-20T07:52:08Z",
  "collector_post_count": 3,
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
| `app_id` | PX 客户标识 |
| `captured_at` | 抓包时间（UTC ISO） |
| `collector_post_count` | 抓到的 collector POST 个数（这版抓包脚本固定抓 3 个） |
| `status_post_1` / `status_post_2` | 前两个 POST 的 HTTP status（200 = 成功） |
| `sdk_sha256`（仅批 4-6） | SDK 文件 SHA-256（批 1-3 因脚本旧版没记录） |

---

## 3. 公共元数据（6 批都一样）

| 维度 | 值 |
|---|---|
| 抓包目标 | `https://www.ifood.com.br/restaurantes` |
| App ID | `PXO1GDTa7Q` |
| TAG | `U0MmDhUmOnhXSw==` |
| FT | `401` |
| Cookie | `_px3` |
| SDK SHA-256 | `b47a639cde9df4f91bdc4138ae0d64ebf7ce8c876a1e4c9967fd3af3d2975eb8` |
| 抓包时间 | 2026-05-20 07:52:08Z ~ 08:00:41Z UTC（9 分钟） |
| 抓包工具 | [`skill/cdp/scripts/capture_via_cdp_ifood.py`](../../../skill/cdp/scripts/capture_via_cdp_ifood.py) |
| 抓包方法 | CDP 直连真 Chrome，无 webdriver 痕迹 |

## 4. 6 批 UUID + 时间 一览

| 批 | UUID | 抓包时间 (UTC) | SDK SHA 字段 |
|---|---|---|---|
| 1 | `c83577f0-5420-11f1-9150-e1cff29e25cc` | 07:52:08 | — |
| 2 | `d71c9fa0-5420-11f1-b025-9117175cbd66` | 07:52:33 | — |
| 3 | `e5e801f0-5420-11f1-b77b-a38d8b11732d` | 07:52:58 | — |
| 4 | `dccaacc0-5421-11f1-bba4-69ba559d3bad` | 07:59:51 | ✓ `b47a639c…` |
| 5 | `eb306f70-5421-11f1-b21d-afdecf3ed7d5` | 08:00:16 | ✓ `b47a639c…` |
| 6 | `fa165ea0-5421-11f1-85cb-e97d388bd2ae` | 08:00:41 | ✓ `b47a639c…` |

> 批 1-3 的 `meta.json` **缺** `sdk_sha256` 字段（抓包脚本在批 4 才加上
> 这字段记录），但**实际 SDK 跟批 4-6 是同一份** —— 9 分钟内 PX 不会推新版。

---

## 5. 怎么用

### 看一个 EV1（轻量指纹）

```bash
jq '.[0].d | keys | length' sample/1/decoded_payload_1.json
# → 14 字段

jq '.[0].d' sample/1/decoded_payload_1.json | head -20
# 看具体字段
```

### 看一个 EV2（完整指纹）

```bash
jq '.[0].d | keys | length' sample/1/decoded_payload_2.json
# → ~204 字段
```

### 看 state.* (从 OB 解码出来的会话状态)

```bash
jq '.state' sample/1/decoded_response_1.json
# → { no: "1779...", to: "...", qa: "64hex...", vid: "uuid", pxsid: "uuid", appId: "...", cts: "...", jf: "cu" }
```

### 看 set_cookie 段（拿到的 _px3）

```bash
jq '.segments[] | select(.args[0]=="_px3")' sample/1/decoded_response_2.json
# → { handler: "...", args: ["_px3", ttl, value, ...] }
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
# 输出: { static: [...], dynamic: [...], conditional: [...] }
```

### 重新解码（验证解码器对当前 SDK 通用）

```bash
node ../../../skill/AI_re/scripts/decode_payload.js sample/1/request_1.txt
node ../../../skill/AI_re/scripts/decode_response.js sample/1/response_1.json U0MmDhUmOnhXSw==
```

---

## 6. 完整性校验

```bash
# 1. 6 批必须每批 11 文件
for i in 1 2 3 4 5 6; do
    n=$(ls sample/$i/ 2>/dev/null | wc -l)
    [ "$n" -eq 11 ] && echo "batch $i: OK" || echo "batch $i: $n files (BAD)"
done

# 2. 所有响应必须 status=200
for i in 1 2 3 4 5 6; do
    jq -r '"batch \(.batch_id): post1=\(.status_post_1) post2=\(.status_post_2)"' sample/$i/meta.json
done
```

预期输出全部 `batch X: OK` + `post1=200 post2=200`。

---

## 7. 配套资源

| 想看什么 | 去哪 |
|---|---|
| EV1/EV2 字段语义 | [`main/ZH/PX_SDK_逆向技术文档.md`](../../../main/ZH/PX_SDK_逆向技术文档.md) 附录 E |
| 解码原理 + 算法 | [`main/ZH/PX_完整SDK对照逆向方法论.md`](../../../main/ZH/PX_完整SDK对照逆向方法论.md) |
| 怎么写解码器 | [`skill/AI_re/scripts/`](../../../skill/AI_re/scripts/) |
| 怎么自己抓 6 批 | [`skill/cdp/scripts/capture_via_cdp_ifood.py`](../../../skill/cdp/scripts/capture_via_cdp_ifood.py) |
| 跨厂家对比 | [`main/ZH/PX_完整SDK对照逆向方法论.md`](../../../main/ZH/PX_完整SDK对照逆向方法论.md) §8 |

---

*抓包来源：作者本地 legacy `perimeter_X` 项目的 iFood 样本目录，校验时间 2026-05-21。
全部 6 批响应 status=200，已用 [`skill/AI_re/scripts/decode_payload.js`](../../../skill/AI_re/scripts/decode_payload.js)
回放验证通过。英文版见 [`README_EN.md`](README_EN.md)。*
