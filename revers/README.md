# `revers/` — PX SDK 9 算法纯算还原（Node.js）

PerimeterX SDK 无感 Collector 路径用到的 9 个加密/编码/序列化算法的纯
JavaScript 实现。**不跑 SDK、不开浏览器、不用 V8 沙箱** —— 全靠 `require()`
就能在任意 Node 进程里生成 / 解码 PX 协议数据。

## 状态

| 维度 | 状态 |
|---|---|
| 来源 | 从 iFood + Grubhub 真 SDK 静态反混淆 + 6 批 × 2 站抓包对照确认 |
| 验证 | 跟 iFood `main.min.js` (sha `b47a639c…`) + Grubhub `init.js` (sha `5e81bffc…`) 12 批解码 round-trip 全过 |
| 实战 | iFood 10/10 + Grubhub 10/10 端到端 generator 用这 9 个模块拿到 `_px3` / `_px2` |
| 跨版本 | 算法层 3 年没动；这 9 个模块每次 PX 推新 SDK 都能直接复用 |

**顶层 canonical 位置** —— `skill/AI_re/reverse/` 曾经是另一份副本（byte-for-byte 一致），
2026-05-21 清理重复时删了。现在所有 generator 都 `require('../../../revers/...')` 指向本目录。

---

## 9 个模块速览

| 文件 | 默认导出 / 命名导出 | 一句话 |
|---|---|---|
| `payload.js` | `generatePayload(events, serverTs, uuid)` | EV 数组 → POST `payload=` 字符串（serialize → XOR(50) → b64 → 交织） |
| `pc.js` | `generatePC(events, uuid, tag, ft)` | events + uuid + tag + ft → 16 位纯数字 checksum |
| `ob.js` | `processOb(json, gt)` + 命名 `decodeOb` / `solvePow` / `ml` / `buildSid` | collector 响应 `.ob` 段解码 + handler 派发 |
| `sid.js` | `generateSid(pxsid, serverTs)` | Plane-14 Unicode Variation Selectors 隐写 → POST `sid=` |
| `uuid.js` | 命名 `uuidV1` / `getUUID` / `resetUUID` / `setUUID` / `formatUUID` / `getRandomBytes` | RFC 4122 v1（带 PX 兼容的 clockseq） |
| `hash.js` | 命名 `generateHash` / `Kt` | djb2 变体 |
| `memory.js` | 命名 `generateMemory` / `JS_HEAP_SIZE_LIMIT` | `performance.memory` 三元组合成 |
| `antitamper.js` | 命名 `generateAntiTamper` / `te` | 动态 XOR key/value 注入位 |
| `ns.js` | `fetchNs(uuid, appId)` | GET `tzm.px-cloud.net/ns?c=<uuid>` 同步 |

⚠️ `ob.js` 的导出比较"野"：`module.exports = processOb` **同时**挂了
`.decodeOb` / `.solvePow` / `.ml` / `.buildSid` / `.getParams` 在 function 对象上。
所以下面两种写法都对：

```js
const processOb = require('./ob');          // 拿 default
const { decodeOb, ml } = require('./ob');   // 拿命名 — generator 走这条
```

---

## 最小 demo（10 行解一个 iFood 抓包）

```javascript
const fs = require('fs');
const { decodeOb } = require('./revers/ob');

const TAG = 'U0MmDhUmOnhXSw==';   // iFood 固定 TAG（Grubhub 用 'FmYgK1gdJEAP'）
const resp = fs.readFileSync('stample/ifood/sample/1/response_1.json', 'utf8');

const { segments, results, state } = decodeOb(resp, TAG);
console.log('segments:', segments.length);          // 10
console.log('state.no:', state.no);                 // "1779263..."
console.log('state.qa:', state.qa);                 // 64 hex
```

---

## 端到端 generator（已实战）

| 站点 | 入口 | 用到的 reverse 模块 |
|---|---|---|
| iFood | [`stample/ifood/px_cookie/ifood_px3.js`](../stample/ifood/px_cookie/ifood_px3.js) | payload / pc / ob / sid / uuid / memory / ns |
| Grubhub | [`stample/grub/px_cookie/grubhub_px2.js`](../stample/grub/px_cookie/grubhub_px2.js) | payload / pc / ob / sid / uuid / memory |

generator 当前 `require` 的就是本目录：

```javascript
const generatePayload = require('../../../revers/payload');   // 从 stample/*/px_cookie/ 出发
```

---

## 跟项目其它部分的关系

| 配套 | 路径 |
|---|---|
| 算法原理 + 公式 | [`main/ZH/PX_SDK_逆向技术文档.md`](../main/ZH/PX_SDK_逆向技术文档.md) §算法层 |
| 算法链一页纸 | [`skill/AI_re/references/algorithm-chain.md`](../skill/AI_re/references/algorithm-chain.md) |
| 27 个 OB handler 形状匹配表 | [`skill/AI_re/references/handler-table.md`](../skill/AI_re/references/handler-table.md) |
| 模块调用方（generator） | [`stample/ifood/px_cookie/`](../stample/ifood/px_cookie/) + [`stample/grub/px_cookie/`](../stample/grub/px_cookie/) |
| 模块验证（解码闭环） | [`stample/{ifood,grub}/script/verify_all.sh`](../stample/) |
| AI agent 也用这一份 | [`../skill/AI_re/`](../skill/AI_re/) （引用 revers/，不再独立副本） |

---

## 不在这里的东西

| 不在 | 在哪 |
|---|---|
| Bundle 路径（captcha.js）的 PoW / WASM | **不在本目录**。`ob.js` 里有 `solvePow` 但只是骨架；完整按压路径见 [`main/ZH/PX_SDK_逆向技术文档.md`](../main/ZH/PX_SDK_逆向技术文档.md) §Bundle |
| CLI 工具（解码器、diff、回放） | [`skill/AI_re/scripts/`](../skill/AI_re/scripts/) + [`stample/{ifood,grub}/script/`](../stample/) |
| 真抓样本 | [`stample/ifood/sample/`](../stample/ifood/sample/) + [`stample/grub/sample/`](../stample/grub/sample/) |
| SDK 源码 | [`stample/ifood/source/`](../stample/ifood/source/) + [`stample/grub/source/`](../stample/grub/source/) |

---

## 怎么验证这 9 个模块还跟当前 SDK 兼容

```bash
# iFood 6 批解码 round-trip
cd stample/ifood/script && ./verify_all.sh

# Grubhub 6 批
cd stample/grub/script && ./verify_all.sh
```

12 批全过 = 9 个模块工作正常。任何一批失败，按
[`skill/AI_re/playbooks/validate-generator.md`](../skill/AI_re/playbooks/validate-generator.md) 决策树排查。

---

*9 模块 12 批 round-trip 验证通过，校验时间 2026-05-21。
PX 推新 SDK 时不一定要重写 —— 先看算法层魔法常量（MD5 init / HMAC ipad / UUID v1 / INT32_MAX）
是否还在新 SDK 里：3 年观察下来从未变过。*
