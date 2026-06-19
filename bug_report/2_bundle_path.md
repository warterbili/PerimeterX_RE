# 按压 Bundle 路径 — 踩坑全集

走 <1% 流量的按压模式（风险评分高时触发）。SDK 文件是独立的 `captcha.js`，
不是 `main.min.js`。涉及 PoW（SHA-256 迭代）+ WASM + 鼠标轨迹合成。

⚠️ **99% 场景写无感 generator 就够了**。这一页是给少数需要按压链路的人看的。

无感 Collector 路径的坑见 [`1_collector_path.md`](1_collector_path.md)。

---

## A. WASM 加载与初始化

### #B1 ⭐⭐⭐ WASM `b()` 需要 `globalThis._pxUuid`

**症状**：WASM `a()` 成功返回 hex，但 `b(input)` 返回空字符串或 panic。

**根因**：WASM 内部 `b()` 调用 `__wbg_get(window, "_pxUuid")`，如果 `globalThis._pxUuid` 是 undefined，函数走错误路径返回空。

**修复**：
```javascript
globalThis._pxUuid = uuid;   // 用 Bundle#1 的 state.pxsid
// 然后再调 wasmB(input)
```

4 个 bundle 事件全程**用同一个 uuid**（见 #B12）。

**来源**：上游逆向笔记（已归档，未随仓发布）

---

### #B2 ⭐⭐⭐ WASM `instanceof_Window` 在 Node 必须返回 1

**症状**：WASM 加载成功，但任何调用都立即 panic 或空返回。

**根因**：WASM 用 `__wbg_instanceof_Window` 检测"我在浏览器吗"。Node 默认返回 0 → 走错误路径。

**修复**：mock import：
```javascript
const imports = {
    wbg: {
        __wbg_instanceof_Window: () => 1,   // 假装在浏览器
        // ... 其它 imports
    }
};
WebAssembly.instantiate(wasmBytes, imports);
```

**来源**：上游逆向笔记（已归档，未随仓发布）

---

### #B3 ⭐⭐ WASM 内部常量每版本/客户不同（ChaCha20 seed、HMAC key、字母表）

**症状**：SDK 升级后或换站点后，WASM `b()` 输出跟真抓的对不上。

**根因**：WASM 二进制里嵌的"magic constants"（ChaCha20 seed、HMAC key、自定义 base91 字母表）每个客户/版本不一样。

**修复**：用 `wasm-tools` 提 WASM data section，对比新旧版本的 magic strings。变了就重新分析 WASM。

**来源**：上游逆向笔记（已归档，未随仓发布）

---

### #B4 ⭐ WASM `b()` 输出用自定义字母表，**不是** base64

**症状**：把 b() 输出当 base64 解码 → 字段内容损坏。

**根因**：WASM 输出用自定义字母表 `/=+!1@2#3$4%5^6&7*8(9)0-`，看起来像 base64，**不是**。

**修复**：b() 输出**原样**填到 Bundle#3 PX561 字段 `MD1DNnVfRgQ=`，**不要** base64 解码。

**来源**：上游逆向笔记（已归档，未随仓发布）

---

## B. PoW（Proof of Work）

### #B5 ⭐⭐⭐ PoW SHA-256 必须用同步 API，不能用 `crypto.subtle`

**症状**：PoW 解超时（>600s），或结果跟 WASM 输出不一致。

**根因**：Node 的 `crypto.subtle.digest()` 返回 Promise，每次循环 await 让 60ms 的 PoW 变成 600s+。WASM 用同步 SHA-256。

**修复**：
```javascript
// ❌ 错
const hash = await crypto.subtle.digest('SHA-256', buf);

// ✅ 对
const hash = crypto.createHash('sha256').update(s).digest('hex');
```

**来源**：上游逆向笔记（已归档，未随仓发布）

---

### #B6 ⭐⭐ Handler param remap：Bs() 参数位置被故意打乱

**症状**：PoW solver 算错的 hash。

**根因**：handler 接收 `(t,e,n,r,a)` 但 call `Bs(n,e,r,a==="true")`。第 1 形参没用、第 5 形参变布尔 — 故意混淆。

**修复**：跟到真正的调用点（不是 handler 入口）来看 Bs 的实际参数。I0I0I0 handler 是真正入口，实际签名是 `Bs(targetHash, suffix, "16", false)`。

**来源**：`BUNDLE_COMPLETE_ANALYSIS.md:1919-1921, 1934-1936`

---

## C. Bundle 事件结构

### #B7 ⭐⭐ Bundle 用的 AppID 跟 init AppID 不同

**症状**：Bundle#1 ob 解码或 state 提取失败。

**根因**：Bundle 端点用**另一个 appId**。iFood：
- Init AppID = `PXO1GDTa7Q`
- Bundle AppID = `PXd6f03jmq8h6c7382req0`

跟 [`1_collector_path.md` 坑 #16](1_collector_path.md#16) 那个 init vs collector AppID 又不一样 —— Bundle 是**第 3 个 AppID**。

**修复**：从真抓的 Bundle POST 提取 Bundle AppID 单独硬编码。

**来源**：上游逆向笔记（已归档，未随仓发布）；`ifood-web/collector无感纯算还原/纯算还原.md:38-50`

---

### #B8 ⭐⭐⭐ Bundle#3 事件数组**顺序敏感**

**症状**：每个事件单独看都对，端到端被拒。

**根因**：PC HMAC 校验的是 `serialize([event1, event2, ...])`。顺序错 → 字节流不同 → pc 不匹配。

**修复**：严格顺序：
```
[px10498 press,
 px561 captcha+WASM,
 px10496 mouse interaction,
 px535 mouse trajectory,
 px11116 DOM+errors]
```

**来源**：上游逆向笔记（已归档，未随仓发布）

---

### #B9 ⭐⭐ 4 个 bundle 事件全程用同一个 UUID

**症状**：Bundle#2/#3 被拒，state.vid 跟 `_pxvid` cookie 对不上。

**根因**：PX 校验整个挑战会话使用相同 uuid：
```
uuid_bundle#1 = uuid_bundle#2 = uuid_bundle#3 = uuid_bundle#4
```
`state.pxsid` / `state.vid` 也是会话内不变。

**修复**：生成 1 个 uuid，4 个 bundle 全用它。

**来源**：上游逆向笔记（已归档，未随仓发布）

---

### #B10 ⭐⭐ Bundle#4 — "什么时候发"两种说法矛盾，看场景

**症状**：两份内部资料给的指导**完全相反**：
- A 说："Bundle#4 是出错路径，正常成功不要发"
- B 说："Bundle#4 是 telemetry，真浏览器**总是**会发；不发本身是一个 fingerprint"

**根因**：两边都对，**取决于规模和时间窗**：
- **单次 / 小批量**（每天 < 几十次）：A 对 —— 成功路径不发 Bundle#4，发了就提示前面有 bug
- **长期大批量**（几千次 / 多账号）：B 对 —— 你的所有会话都不发 Bundle#4，统计上跟真用户分布偏离 → 被 PX 长期行为分析识别

**修复**：
- 短期 / 实验：成功路径不发 Bundle#4
- 生产 / 大批量：构造一个最小的 Bundle#4 telemetry（含 `result=success`、duration、attempt count）跟在 Bundle#3 后面发；保持跟真浏览器的发包统计一致

**来源**：上游逆向笔记（已归档，未随仓发布）；`perimeterX_Re/docs/04_bundle/05_bundle4_fallback.md`

---

## D. 鼠标 + 按压行为合成

### #B11 ⭐⭐⭐ 按压时长必须在 1-3 秒之间

**症状**：Bundle#3 字段、顺序都对，仍 422/403 拒。

**根因**：PX 校验按压时长：
- `< 500ms` → "太快，机器人"
- `> 5000ms` → "太慢，sleep 检测"

**修复**：
```javascript
const pressDuration = 1000 + Math.random() * 2000;   // 1000-3000ms
```

**来源**：上游逆向笔记（已归档，未随仓发布）

---

### #B12 ⭐⭐ 鼠标坐标必须是浮点数，不能是整数

**症状**：鼠标轨迹/按压被识别为机器人。

**根因**：真浏览器的 `pointerdown.clientX` 是**亚像素浮点**（320.5、247.3）；机器人通常生成整数。

**修复**：保留 1 位小数：
```javascript
x = Math.round(bezierX(t) * 10) / 10;
```

**来源**：上游逆向笔记（已归档，未随仓发布）

---

### #B13a ⭐⭐ 显式 `pressDuration` 字段必须**等于** `pointerup.ts - pointerdown.ts`

**症状**：所有字段都填了、duration 也在 1-3s 范围（满足 #B11），仍被拒。

**根因**：PX 不只校验 `pressDuration` 字段值，还会**交叉对比**它跟事件时间戳之差：
- 显式字段 `QlNxGAc0fSg= = [1600]`
- 实际事件 `pointerdown.ts=37468, pointerup.ts=38936` → 差 1468ms
- 差 132ms > 100ms 容忍度 → 判定 "synthetic event"

**修复**：永远从事件**派生**duration，不要独立硬编码：
```javascript
const pressDuration = ctx.pointerUp.ts - ctx.pointerDown.ts;
ev3['QlNxGAc0fSg='] = [pressDuration];   // ✅ 一致
```

**通用规则**：任何"事件 + 描述事件的元字段"对，元字段必须**算出来**而不是猜。

**来源**：`perimeterX_Re/docs/07_gotchas/18_press_duration_mismatch.md`

---

### #B13 ⭐⭐ 鼠标轨迹 timestamps 必须跟按压时长匹配

**症状**：按压 1.5s，但鼠标轨迹时长 5s → 拒。

**根因**：PX 校验时序：
- `mouseEndTs ≈ pressDownTs ± 100ms`
- `mouseStartTs = mouseEndTs - pressDuration`

错位 = 机器人。

**修复**：
```javascript
const mouseEndTs = pressDownTs - randInt(50, 150);
const mouseStartTs = mouseEndTs - pressDuration;
// 544 个轨迹点均匀分布在 [mouseStartTs, mouseEndTs]
```

**来源**：上游逆向笔记（已归档，未随仓发布）

---

## E. DOM + Error 收集

### #B14 ⭐ DOM 编码用缅甸文字符（不是 base64）

**症状**：PX11116 字段值跟真 sample 对不上。

**根因**：PX 用缅甸文 Unicode 块（U+1000-U+109F）编码 DOM 结构，不是随机 base64。

**修复**：用 iFood 项目里现成的 `myanmar_encode.js`，传真实 DOM 节点列表。

**来源**：上游逆向笔记（已归档，未随仓发布）

---

### #B15 ⭐ Error stack 必须有 4 组（不是 1 组）

**症状**：PX11116 含 error stack 但仍拒。

**根因**：真 SDK 故意抛 4 个不同位置/类型的错误，收 4 组 stack。1 组 = 机器人走捷径。

**修复**：用 iFood `error_stack.js`，返回 4 元素数组。

**来源**：上游逆向笔记（已归档，未随仓发布）

---

## F. 资源缓存 / 路径

### #B16 ⭐ `captcha.js` 不能跨会话缓存复用

**症状**：把抓到的 captcha.js 存下来给第二个会话用 → 失败。

**根因**：captcha.js 的 URL 含 uuid 参数；每个新会话都要新 URL。文件里嵌的 uuid-bound 状态会过期。

**修复**：每个新挑战会话重新下载 captcha.js。

**来源**：上游逆向笔记（已归档，未随仓发布）

---

### #B17 ⭐ `captcha.js` 文件名不稳定，不能 hardcode 断点

**症状**：DevTools 上想给 captcha.js 设断点，每次刷新它换名字。

**根因**：captcha.js 是每次请求动态生成的，文件名带随机后缀（如 `captcha_7f2a3b1c.js`）。

**修复**：
- 给 `main.js` 设断点（这个稳定）
- 或用 CDP/DevTools 的 Network interception
- 或 hook `window._O1GDTa7Qhandler` 在加载完成后

**来源**：`BUNDLE_COMPLETE_ANALYSIS.md:1923-1928`

---

## G. 生产部署陷阱（PoW 缓存 + 轨迹池）

### #B18 ⭐⭐ PoW 答案缓存按 `(suffix, target)` 做 key 会跨会话泄露

**症状**：开了 PoW 缓存优化生产，跑多账号场景几次后某些账号 100% 失败 —— 同一个 `(suffix, target)` 对在不同会话出现，缓存返回上次的答案，**但 PX 后端按 session UUID 校验答案**。

**根因**：PoW `(suffix, target)` 偶尔会跨会话重复出现，单凭它们做 cache key 等于把别人会话的答案给当前会话用 → PX 检测到 answer 跟 session UUID 绑定不一致。

**修复**：
- 缓存 key 加 session UUID：`cache[sessionUuid + suffix + target] = answer`
- 会话结束清缓存
- 单 IP/小批量（< 1000 会话/天）：PoW 才 9ms（不优化的实现），**直接不缓存**最安全

**来源**：`perimeterX_Re/docs/04_bundle/06_pow.md:124`

---

### #B19 ⭐⭐ 鼠标轨迹池过小，跑 50+ 会话被 PX 长期行为分析识别

**症状**：纯算 generator 在测试期 7-10/10 通过，生产跑 50+ 会话开始有规律性失败 —— 单看每次请求都对。

**根因**：常见做法是采 5-10 条真实鼠标轨迹，generator 里轮换使用（pool rotation）。**单次看每条都"真"**，但 PX 后端有按 IP / 账号的长期行为聚类，50 会话用 5 条轨迹意味着每条轨迹**重复 10 次**，统计上跟真人偏离。

**修复**：
- 短期：池子扩到 50-100 条真实轨迹
- 中期：加合成贝塞尔轨迹 + 池子混用，每个会话加 UUID 抖动（轨迹基础上叠少量随机偏移）
- 长期：每个目标账号有独立轨迹池（账号间不共用）

**来源**：`perimeterX_Re/docs/04_bundle/12_pure_algo_e2e_gap.md` (Gap 1, Gap 5)

---

*环境/基础设施类的 8 条坑见 [`3_environment.md`](3_environment.md)*
