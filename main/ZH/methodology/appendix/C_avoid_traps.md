# 附录 C：10 条避坑必读

> PX 逆向 3 年总结的 10 条**最致命**陷阱。**逆向之前必读**。
> *源自*: C/附录 C + bug_report/ 总结

完整 68 条踩坑见 [`../../../../bug_report/`](../../../../bug_report/)。本附录精选 10 条最容易毁全局的。

---

## 坑 1：抓包没清 cookie

**症状**：6 批抓包做字段三分类后 STATIC 占 90%+，DYNAMIC 只有 5%。

**原因**：常规 Chrome 保留 `_pxvid` cookie，PX 把你识别为 warm visit，某些字段（如 `pxhd`）填了 warm-visit 值，混入"模板"。你的模板**污染了**。

**修复**：每批必须用**新隐身窗口**。验证：`meta.json.warm_visit: false`。

详见 Stage 1 §1.3。

---

## 坑 2：JSON.stringify 替代 PX 自定义 serialize

**症状**：generator 跑出来的 payload 跟真抓字节级差 1-3 个字符，PC 算错，collector 返回 403。

**原因**：PX 自定义 `serialize()` 跟 `JSON.stringify` 在 5 个地方不同：
- `undefined` → `'"undefined"'` (PX) vs 跳过 (JS)
- `NaN` → `"null"` vs `null`
- `Date` 格式不同
- ...

**修复**：必须用 [`../../../../revers/payload.js`](../../../../revers/payload.js) 的 `serialize()`。**不能用任何标准库**。

详见 Stage 2 §2.2 + 踩坑 [`../../../../bug_report/1_collector_path.md`](../../../../bug_report/1_collector_path.md) #5。

---

## 坑 3：state.no 没 parseInt 转 number

**症状**：generator 字段对齐看起来全对，但 collector#2 返回 status=200 + 空 _px3 (低评分 cookie)。

**原因**：OB 解码出来 `state.no` 是 string `"1771962850771"`，写入 EV2 时**必须 `parseInt()` 转 number**，否则 PC 算错（serialize 一个 string 和一个 number 字节不同 — number 没引号）。

**修复**：

```javascript
ev2.d[keyMap.no] = parseInt(state.no);   // ✓
ev2.d[keyMap.no] = state.no;             // ✗ 错的
```

**踩这个坑通常浪费 3 小时**。详见 [`../../../../bug_report/1_collector_path.md`](../../../../bug_report/1_collector_path.md) #14。

---

## 坑 4：OB 解码用 UTF-8 不是 Latin-1 / binary

**症状**：解码 OB 响应输出乱码，state 提取不出来。

**原因**：

```javascript
Buffer.from(ob, 'base64').toString('utf-8')      // ✗ 错
Buffer.from(ob, 'base64').toString('latin1')     // ✓ 对
Buffer.from(ob, 'base64').toString('binary')     // ✓ 同义
```

OB 是二进制 XOR 之后的字节流，里面有 0x00-0x1F 等非 UTF-8 字节，`utf-8` decoder 会把它们换成 replacement char (U+FFFD)。

**修复**：用 `latin1` 或 `binary`。详见 Stage 2 §2.6。

---

## 坑 5：OB 分隔符是 "~~~~" 不是 "~~~"

**症状**：OB 分段后段数不对（少了 / 多了），handler 派发全错位。

**原因**：PX 用 **4 个波浪号** 作分隔符，不是 3 个。

**修复**：`split("~~~~")` 不是 `split("~~~")`。详见 Stage 2 §2.6。

---

## 坑 6：每次必须新 UUID

**症状**：generator 第 1 次拿到 _px3，第 2 次开始 403 / 拿到低评分 cookie。

**原因**：UUID 是 session 标识，**同一 UUID 多次用 PX 标记为 "重复 session" 直接拒**。

**修复**：每次 `generatePx3()` 调用先 `uuidV1()` 生成新 UUID。

```javascript
// 错
const SESSION_UUID = uuidV1();
async function generatePx3() { return ... SESSION_UUID ... }

// 对
async function generatePx3() {
    const uuid = uuidV1();
    return ... uuid ...
}
```

---

## 坑 7：BTOA 用 Node Buffer 不是 atob/btoa polyfill

**症状**：base64 输出跟 Node baseline 一样，但跟真浏览器抓的不一样。

**原因**：Node 18+ 全局有 `atob()` / `btoa()`，但它们**只接受 Latin-1 字符串**。而 PX SDK 在浏览器里：

```javascript
btoa(encodeURIComponent(s).replace(/%([0-9A-F]{2})/g, (m, h) =>
    String.fromCharCode("0x" + h)))   // UTF-8 → Latin-1 → btoa
```

Node 用 `Buffer.from(s, 'utf-8').toString('base64')` 直接 UTF-8 编码 → base64，跟浏览器结果一致。**不要用 Node 全局的 btoa**。

详见 Stage 4 §4.10.4。

---

## 坑 8：用了过期 / 错版本的 SDK

**症状**：抓包看起来正常，但 generator 通过率持续 < 50%。

**原因**：你下载 SDK 时 PX 给了一个老版本（CDN 边缘节点缓存），但抓包浏览器自动拿到了新版本。SDK SHA 跟抓包不一致。

**修复**：
1. 必须用 **DevTools Local Overrides** 锁定（Stage 1 §1.1）
2. SDK SHA256 必须跟 `meta.json.sdk_sha256` 一致
3. **不要从 CDN 直接下载 SDK 当作金标准**，用浏览器拉到的版本

---

## 坑 9：跨样本的 b64 key 字典对不上

**症状**：6 批样本，`field_classes_ev2.json` 显示**全部字段都 DYNAMIC**（包括 UA、screen.width 等本应 STATIC 的）。

**原因**：不同批次 SDK 版本不一样，**b64 key 字典刷新过**，导致 `Win32` 这个值在 batch1 是 `KEY_A` 而在 batch2 是 `KEY_B`，diff 工具按 key 比，得出"全 DYNAMIC"。

**修复**：
1. Stage 1 §1.1 锁定 SDK 必须严格
2. 验证 `meta.json.sdk_sha256` 6 批完全一致
3. 如果不一致 → 重抓

---

## 坑 10：/ns sm/duration 是 null/0 当 bug 修

**症状**：generator 抓到的 ev2 里 `ns_sm: null, ns_duration: 0`，跟真抓的 6 批一对比，发现真抓 **也** 是 null/0。

**误判**：以为 generator 有 bug，花时间 debug `fetchNs()` 函数。

**真相**：`/ns` 是异步 probe，**collector#2 发出时 /ns 还没回来**，所以 sm/duration 字段就是 null/0。**这是正常的**。

**修复**：不要 debug，写注释 `// /ns is async, null is OK` 跳过。

详见 [`../../../../bug_report/1_collector_path.md`](../../../../bug_report/1_collector_path.md) #25。

---

## 总结：10 条坑的根因分析

| 坑 # | 根因 | 频率 |
|---|---|---|
| 1 | 抓包卫生意识不够 | 高 |
| 2 | 用了通用工具替代 PX 自定义 | 高 |
| 3 | Type system 弱（JS string vs number） | 高 |
| 4 | 字符编码意识不够（UTF-8 vs Latin-1） | 中 |
| 5 | 协议常量记错 | 中 |
| 6 | 没 reproduce 真浏览器的"每次新会话" | 中 |
| 7 | 浏览器 vs Node API 微妙差异 | 高 |
| 8 | SDK 版本管理不严 | 中 |
| 9 | SDK 锁定失败 → 字段分类全乱 | 中 |
| 10 | 对异步行为理解不到位 | 低（但常误判） |

**反过来**：建立**严谨的抓包卫生 + Type 校对意识 + 协议常量速查表 + 严格的 SDK 锁定**，这 10 条坑能避免 8 条以上。

---

## 进阶踩坑 → 完整 68 条

[`../../../../bug_report/`](../../../../bug_report/)：
- `1_collector_path.md` — 33 条 Collector path 坑
- `2_bundle_path.md` — 20 条 Bundle path 坑
- `3_environment.md` — 8 条网络/IP/TLS 坑
- `4_sdk_drift.md` — 7 条 SDK 升级坑

---

## 完成方法论

→ 回到 [总览](../00_overview.md) 或 [README](../README.md)
