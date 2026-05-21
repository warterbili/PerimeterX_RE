# Stage 2: 解码与算法层验证

> **时间预算**：熟练 15 min，第一次 1 h
> **产出**：把 6 批 raw 抓包全解码成 JSON，验证 9 个算法模块工作正常
> *融合*: C/§2（实战）+ B/02_stage2_decode（结构）+ A/§3-4（算法验证）

---

## 目标

把 raw 字节流变 JSON：

```
samples/1/request_1.txt  (raw POST body)
        ↓ decode_payload.js
samples/1/decoded_payload_1.json  (EV1 JSON, 14 字段)
```

完成后**你能用脚本解任何 PX 抓包**，跟 PX 服务器同步解析能力。

---

## 2.1 9 个算法模块（必备）

PX 算法层在每个站点都一样。本项目 [`../../../revers/`](../../../revers/) 已实现：

```
revers/
├── payload.js       XOR(50) + base64 + 交织 → POST `payload=`
├── pc.js            HMAC-MD5 + 数字提取 16 位 → POST `pc=`
├── ob.js            OB 解码 + 27 个 handler 派发
├── sid.js           Plane-14 Unicode Tag 隐写 → POST `sid=`
├── uuid.js          UUID v1 (PX 兼容 clockseq)
├── hash.js          djb2 变体
├── memory.js        performance.memory 合成
├── antitamper.js    动态 XOR key/value
└── ns.js            /ns 端点同步
```

**99% 情况你直接用本项目这套**，不用重写。新站点逆向只是验证这套对新站点是否能用。

---

## 2.2 PX 自定义 serialize（致命陷阱）

⚠️ **必须实现 PX 自定义 serialize，不能用 `JSON.stringify()`**。差异：

```javascript
// PX serialize vs JSON.stringify 差异:
undefined           → '"undefined"'             // 带引号！JSON.stringify 会跳过
NaN                 → 'null'
Infinity            → 'null'
RegExp              → 'null'
Date                → '"YYYY-M-DTHH:MM:SS.mmm"' // 不补零
property=undefined  → 输出 '"undefined"' 而非跳过 key
```

本项目 [`../../../revers/payload.js`](../../../revers/payload.js) 的 `serialize()` 函数已实现。

**为什么 PX 这么做**：故意跟 `JSON.stringify` 不一样，防止你直接抄 `JSON.stringify` 产生的 byte stream。一个字符不对 PC 就算错。

---

## 2.3 解码一个 batch

```bash
cd ../../../stample/ifood/script/

# 解 batch 1 的 4 个文件（request_1/2.txt + response_1/2.json）
./decode_one.sh 1

# 期望输出 samples/1/ 多出:
#   decoded_payload_1.json   ← EV1 (14 字段)
#   decoded_payload_2.json   ← EV2 (~204 字段)
#   decoded_response_1.json  ← state.* 全提取
#   decoded_response_2.json  ← _px3 cookie 解出来
```

`decode_one.sh` 内部调用：

```bash
node ../../../skill/AI_re/scripts/decode_payload.js samples/1/request_1.txt > samples/1/decoded_payload_1.json
node ../../../skill/AI_re/scripts/decode_response.js samples/1/response_1.json <TAG> > samples/1/decoded_response_1.json
```

---

## 2.4 解码 6 批全部

```bash
./decode_all.sh
# → samples/{1..6}/decoded_*.json
```

完成后每批 4 个 decoded 文件。

---

## 2.5 算法层正确性验证

解出来的 JSON 看起来"对不对"靠 4 个 sanity check：

### 2.5.1 EV1 字段数

```bash
jq '.[0].d | keys | length' samples/1/decoded_payload_1.json
# 期望: 14 (iFood) 或 12 (Grubhub)
```

如果输出乱码或 0 → 解码失败，查 §2.6 故障树。

### 2.5.2 EV2 字段数

```bash
jq '.[0].d | keys | length' samples/1/decoded_payload_2.json
# 期望: 204 (iFood) 或 200+ (Grubhub)
```

### 2.5.3 state 提取完整

```bash
jq '.state | keys' samples/1/decoded_response_1.json
# 期望: ["appId", "cts", "jf", "no", "pxsid", "qa", "to", "vid"]
```

如果 state.appId / state.no 缺失 → 解码 OB 失败，查 §2.6。

### 2.5.4 _px3 cookie 提取

```bash
jq '.segments[] | select(.args[0] == "_px3")' samples/1/decoded_response_2.json
# 期望: { handler: "...", args: ["_px3", 330, "<long base64>", ...] }
```

---

## 2.6 解码失败的故障树

```
跑 decode_payload 失败 / 输出乱码
   ├── XOR key 错（用了 100 但实际是 91）
   │   └── 重算: parseInt(ml(<TAG>)) % 128
   ├── UTF-8 vs Latin-1
   │   └── base64 编码必须 UTF-8，不能用 'latin1' / 'binary'
   ├── interleave 索引错
   │   └── `splice(offsets[i] - 1, 1)` 必须减 1，且从后往前
   └── PX 自定义 serialize 没用
       └── 必须用 revers/payload.js 的 serialize(),不能用 JSON.stringify

跑 decode_response 失败
   ├── OB binary vs UTF-8
   │   └── Buffer.from(ob, 'base64').toString('binary'), 不能 'utf-8'
   ├── 分隔符是 "~~~~" 不是 "~~~"
   │   └── 4 个波浪号
   └── Handler key 没 shift()
       └── 段首字段是 handler key，要 .shift() 去掉
```

具体每条详见 [`../../../bug_report/1_collector_path.md`](../../../bug_report/1_collector_path.md)。

---

## 2.6 跨版本算法验证（grep 魔法常量）

新 SDK 拿到手，**先 grep 一遍算法层魔法常量**确认算法没换：

```bash
grep -c "1732584193" main.min.js     # MD5 init A — 期望 1
grep -c "909522486"  main.min.js     # HMAC ipad — 期望 1
grep -c "122192928e5" main.min.js    # UUID v1 Gregorian — 期望 ≥ 1
grep -c "2147483647" main.min.js     # ml() INT32_MAX — 期望 ≥ 1
```

实测（iFood 当前版）：

| 常量 | 命中数 |
|---|---|
| `1732584193` (MD5 init) | 1 |
| `909522486` (HMAC ipad) | 1 |
| `122192928e5` (UUID v1) | 2 |
| `2147483647` (INT32_MAX) | 1 |
| `F@bt` (base91 字母表) | 1（注意 Grubhub 老版可能 0） |

⭐ **任何一个 grep 不到** → 算法层有变化，方法论的"算法 3 年不变"假设破产，需要从 SDK 静态分析重做算法。**这种情况 3 年没遇到过**，但有可能发生。

完整 grep 模式见 [`04_stage4_locate.md`](04_stage4_locate.md) §"算法层定位"。

---

## 2.7 Stage 2 完成标准 ✓

| 项 | 验证 |
|---|---|
| ✅ 6 批全解 | `./decode_all.sh` 跑通，每批 4 个 decoded_*.json |
| ✅ EV1/EV2 字段数符合预期 | 14 / 204 (iFood) |
| ✅ state.* 完整 | appId/no/qa/to/vid/pxsid/cts/jf 全有 |
| ✅ _px3 cookie 能提取 | jq query 拿到 ["_px3", 330, ...] |
| ✅ 算法层魔法常量在场 | 4 个核心常量 grep 全命中 |

---

## 2.8 进入 Stage 3

Stage 2 完成 → 你能把 raw 字节流变 JSON + 算法层可用 → 进入 [Stage 3: 字段三分类](03_stage3_classify.md)。
