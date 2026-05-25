# Total Wine PX 抓包样本

6 批从 totalwine.com 实抓的 PerimeterX collector POST + 响应 + 解码结果。⭐ **严档部署**——seq=0/1/2 三 POST 全程，含 `OkpJAH8oTTA=` cookie 确认 beacon。

---

## 1. 目录结构速览

```
sample/
├── README.md              本文件
├── 1/                     批次 1
├── 2/                     批次 2
├── 3/                     批次 3
├── 4/                     批次 4
├── 5/                     批次 5
└── 6/                     批次 6
```

**6 批是 6 个独立 cold-visit 会话**——每次新 Chrome profile（无 cookies、无 cache），打开 totalwine.com 等 ~20 秒，把 PX SDK 发出的**全部 3 个 collector POST** + 响应 OB 抓下来。

跟 iFood/Grub 的 2-POST 链不同：Total Wine 每次会话**永远有 3 个 POST**（seq=0/1/2），第 3 个 (seq=2) 是 cookie 确认 beacon。

---

## 2. 每批里的文件

```
1/
├── meta.json                    批次元数据 (UUID/proxy/timing/SDK SHA)
├── request_1.txt                seq=0 POST (HTTP headers + form body)
├── request_2.txt                seq=1 POST (拿到 _px2 的那次)
├── request_3.txt                seq=2 POST ⭐ cookie 确认 beacon
├── response_1.json              seq=0 响应（state 来源）
├── response_2.json              seq=1 响应（含 set_cookie _px2 段）
├── response_3.json              seq=2 响应
├── decoded_payload_1.json       request_1 解码后的 EV1 (~13 字段)
├── decoded_payload_2.json       request_2 解码后的 EV2 (~199 字段)
├── decoded_payload_3.json       request_3 解码后的 EV3 (~11 字段)
├── decoded_response_1.json      response_1 OB 解码后的 state 段
├── decoded_response_2.json      response_2 OB 解码后的 segments
└── decoded_response_3.json      response_3 OB 解码后的 segments
```

每批的解码 JSON 由 [`../script/decode_all.js`](../script/decode_all.js) 一键产出。

---

## 3. 关键文件用途速查

| 文件 | 用法 |
|---|---|
| `decoded_payload_1.json` | EV1 模板 + DYNAMIC 字段集（13 字段，4 个 DYNAMIC）|
| `decoded_payload_2.json` | EV2 模板 + state.* 注入位置（199 字段，18 DYNAMIC）|
| `decoded_payload_3.json` | EV3 模板 + cookie 确认 beacon 字段（11 字段）|
| `decoded_response_1.json` | state.{no,qa,pxsid,to,appId,jf,cts,vid,hid} 提取 |
| `decoded_response_2.json` | 含 `OOOllO|_px2|330|<cookie>` 段 — _px2 来源 |
| `meta.json` | sdk_sha256, collector_post_count, captured_at |

---

## 4. 跨批 STATIC/DYNAMIC 分类

跑 [`../script/build_templates.js`](../script/build_templates.js) 在 6 批上做交集：

```
EV1: 13 keys (8 STATIC, 4 DYNAMIC, 1 PARTIAL)
EV2: 204 keys (167 STATIC, 18 DYNAMIC, 13 PARTIAL, 6 CONDITIONAL)
EV3: 11 keys (2 STATIC, 7 DYNAMIC, 2 PARTIAL)
```

输出: `../px_cookie/totalwine_ev{1,2,3}_template.json` + `..._field_map.json`

---

## 5. state.* 跨批匹配 (Gotcha #11)

```
state.no    → YQ1SBydsVTQ=     (parseInt 后 inject — Gotcha #1)
state.to    → fEgPAjoqCzE=
state.appId → Bzd0fUJTcUc=
state.vid   → 不在 EV2 d, 用作 HMAC(state.vid, UA) 输入 = Lx8cFWl9HCE=
state.pxsid → 不在 EV2 d, 用作 HMAC(state.pxsid, UA) 输入 = UiJhKBREYhs=
state.hid   → 不在 EV2 d, 走 seq=2 POST 的 form 参数 hid=
```

实测脚本: [`../script/find_state_keys.js`](../script/find_state_keys.js)

---

## 6. 重抓

如果 SDK SHA 跟 `../source/SDK_INFO.md` 不一致 (PX 推了新 SDK)：

```bash
python ../script/capture_via_cdp_totalwine.py 6
```

新抓 6 批后跑 `node ../script/build_templates.js` 重建模板。
