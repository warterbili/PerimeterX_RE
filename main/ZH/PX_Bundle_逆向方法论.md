# PerimeterX **Bundle 路径**逆向方法论（中文）

> **本文档配套**：[`PX_逆向方法论_通用版.md`](PX_逆向方法论_通用版.md)（Collector 方法论，1233 行）
>
> **本文档定位**：站在已经懂 Collector 路径的基础上，**Bundle 路径独有的额外方法学**。
>
> **目标**：让"懂 Collector 的人"在**5 天**之内能上手 Bundle 逆向到拿 `_px3`。
>
> **校验**：基于 iFood Bundle 2026-02 实战 10/10 的真实流程整理。
>
> **配套油猴成品**：[`../../bundle/script/userscripts/px_bundle3_auto.user.js`](../../bundle/script/userscripts/px_bundle3_auto.user.js)（2131 行，已通过）

---

## 目录

- [§0 写在前面：先读 Collector 方法论](#0-写在前面先读-collector-方法论)
- [§1 Bundle 路径 vs Collector 路径 — 决策表](#1-bundle-路径-vs-collector-路径--决策表)
- [§2 Bundle 逆向 8 阶段总览](#2-bundle-逆向-8-阶段总览)
- [§3 Stage B1 — 锁定 captcha.js + WASM](#3-stage-b1--锁定-captchajs--wasm)
- [§4 Stage B2 — 解 OB#1 / OB#2（沿用 Collector decoder）](#4-stage-b2--解-ob1--ob2)
- [§5 Stage B3 — 算 PoW（Bundle 独有）](#5-stage-b3--算-pow)
- [§6 Stage B4 — 跑 WASM（Bundle 独有）](#6-stage-b4--跑-wasm)
- [§7 Stage B5 — 拼 Bundle#3 六个事件（Bundle 独有）](#7-stage-b5--拼-bundle3-六个事件)
- [§8 Stage B6 — iframe XHR Hook 拦截 B1/B2（"纯算过按压" 关键）](#8-stage-b6--iframe-xhr-hook-拦截-b1b2)
- [§9 Stage B7 — 用真浏览器验证](#9-stage-b7--用真浏览器验证)
- [§10 Stage B8 — 打包成 Tampermonkey userscript](#10-stage-b8--打包成-tampermonkey-userscript)
- [§11 跟 Collector 方法论的差异表（10 处对比）](#11-跟-collector-方法论的差异表)
- [§12 Bundle 路径独有的 6 个踩坑](#12-bundle-路径独有的-6-个踩坑)
- [§13 时间预算](#13-时间预算)
- [§14 失败诊断决策树](#14-失败诊断决策树)
- [§15 跨平台 Bundle 移植](#15-跨平台-bundle-移植)
- [§16 SDK 升级响应](#16-sdk-升级响应)
- [§17 当你应该放弃 Bundle 路径](#17-当你应该放弃-bundle-路径)

---

# §0 写在前面：先读 Collector 方法论

⚠️ **不要直接从这里开始**。Bundle 路径**共享 Collector 路径 70% 的算法**（payload XOR/b64/交织、PC HMAC-MD5、OB 解码、SID 隐写、UUID v1、HMAC 算法、anti-tamper），不掌握 Collector 你看不懂 Bundle。

**推荐学习路径**：

```
Week 1: 读 PX_SDK_逆向技术文档.md (2597 行)
Week 1: 读 PX_逆向方法论_通用版.md (1233 行, 7 阶段)
Week 1: 跑通 stample/ifood/px_cookie/ifood_px3.js → 拿 _px3 ✓
   ↓ 现在你懂 Collector，可以开始 Bundle ↓
Week 2: 读本文 §1-§11（理解 Bundle 跟 Collector 的差异）
Week 3: 跑通 bundle/script/userscripts/px_bundle3_auto.user.js（浏览器拿 _px3）
Week 4: 自己写一个 Bundle generator 复现成品（参考本文 §3-§10）
Week 5: 跨平台移植 Bundle 到新站点（参考本文 §15）
```

如果跳过 Collector 直接做 Bundle：实测**至少多花 3 周**，多踩 15 条本可以避免的坑（在 Collector 那边都遇过）。

---

# §1 Bundle 路径 vs Collector 路径 — 决策表

## 1.1 什么时候必须做 Bundle

✅ **必做**：
- 业务 API 被 PX 评分为 bot → 403 + `blockScript: ".../captcha.js"`
- 单个 IP/账号被 PX 标记成需要"按压挑战"才能拿 cookie
- 想做"账号注册"流程（PX 对注册路径特别严格）

❌ **不需要**：
- 普通数据采集（99% 场景 Collector 路径就够）
- 你能用真浏览器（Playwright）+ 住宅代理 IP（直接走真按压）
- 单次任务、低频率（< 几十次/天）

**实战经验**：iFood 2026 跑数据采集，**99% 流量走 Collector** + 1% 触发 Bundle 时**fallback 到 Userscript**。Bundle 纯算方案做了但实际很少用。

## 1.2 Bundle vs Collector — 算法差异（共享 70%）

| 算法 | Collector | Bundle |
|---|---|---|
| payload 加密链 | XOR(50) → b64 → 20 字符交织 | **同**（交织 key 用 UUID 而非 AppID） |
| PC HMAC-MD5 + 数字提取 | ✓ | **同**（FT 不同：401 → 388） |
| OB 解码（XOR + `~~~~` split + handler 派发） | 27 个 handler | **27 + 2 个 PoW handler** |
| SID + Unicode Tag Char 隐写 | ✓ | **同**（Bundle#2+ 隐写 cts 时间戳） |
| UUID v1 with PX 兼容 clockseq | ✓ | **同** |
| `/ns` probe | ✓ | **同** |
| **Proof of Work** (SHA-256 16-bit 暴力) | ✗ | **新增** ⭐ |
| **WebAssembly fingerprint** (a()/b() ChaCha20) | ✗ | **新增** ⭐⭐ |
| **鼠标贝塞尔轨迹** (544 点) | ✗ | **新增** ⭐ |
| **Myanmar DOM 编码** (XOR 4210 → 缅甸文) | ✗ | **新增** ⭐ |
| **错误栈模板** (4 组 V8 stack) | ✗ | **新增** ⭐ |

**Bundle 比 Collector 多 5 个独有算法**，但每个都比 Collector 任一算法**复杂 10 倍**。

## 1.3 数据流差异

```
Collector:                           Bundle:
─────────                            ─────
浏览器加载 main.min.js                浏览器加载 main.min.js + captcha.js + px_captcha.wasm
   ↓                                    ↓
POST collector#1                       POST bundle#1 (16 字段)
   ↓                                    ↓
OB#1 → state.{no,qa,...}              OB#1 → state + PoW 参数 (suffix/target/difficulty)
   ↓                                    ↓
                                       本地算 PoW (~9-60ms 同步 SHA-256)
                                       本地跑 WASM a() + b(powAnswer)
                                       ↓
POST collector#2 (204 字段)            POST bundle#2 (228 字段 + PoW answer + WASM 输出)
   ↓                                    ↓
OB#2 → _px3 (jf=success)              OB#2 → 首版 _px3 (jf=cu, 待确认)
   ↓                                    ↓
完成 ✓                                 用户按压 / 我们自构 Bundle#3 (6 事件)
                                       ↓
                                       POST bundle#3 (5070 字段共计)
                                       ↓
                                       OB#3 → 有效 _px3 (jf=success)
                                       ↓
                                       (可选) POST bundle#4 telemetry
                                       ↓
                                       完成 ✓✓
```

Bundle 比 Collector **多 2 个 POST + 5 个新算法**。

---

# §2 Bundle 逆向 8 阶段总览

类比 Collector 的 7 阶段，Bundle 是 **8 阶段**（多 1 个 PoW+WASM 阶段）：

```
Stage B1 — Capture        锁 captcha.js + 提 WASM        ──┐
   ↓                                                       │
Stage B2 — Decode         解 OB#1 / OB#2 (沿用 collector)   │ 沿用 collector 方法
   ↓                                                       │ (你已会)
Stage B3 — PoW            算 PoW (Bundle 独有)            ──┤
   ↓                                                       │
Stage B4 — WASM           Node 模拟跑 WASM a()/b()        ──┤ Bundle 独有
   ↓                                                       │
Stage B5 — Events         拼 Bundle#3 六个事件 244+ 字段  ──┘
   ↓
Stage B6 — Hook           iframe XHR Hook 拦 B1/B2
   ↓                       （"纯算过按压"的关键）
   ↓
Stage B7 — Validate       真浏览器测 10× ✓
   ↓
Stage B8 — Package        打包 Tampermonkey 油猴脚本
```

## 时间预算

| Stage | 任务 | 熟练 | 第一次 |
|---|---|---|---|
| B1 | 锁 captcha.js + WASM | 30 min | 2 h |
| B2 | 解 OB#1/#2（沿用） | 15 min | 1 h |
| B3 | PoW 还原 | 1 h | 4 h |
| B4 | **WASM 在 Node 跑通** ⭐⭐ | **3 h** | **8-16 h** |
| B5 | 拼 Bundle#3 六个事件 | 2 h | 6 h |
| B6 | iframe Hook | 1 h | 3 h |
| B7 | 验证 10/10 | 1 h | 4 h |
| B8 | 打 userscript | 30 min | 2 h |
| | **总计** | **~9 h** | **~40 h** |

跟 Collector 对比：

| 路径 | 熟练 | 第一次 |
|---|---|---|
| Collector | 4 h | 15 h |
| **Bundle** | **9 h** | **40 h** |

**Bundle 是 Collector 工作量的 ~2.5x**。绝大部分时间花在 Stage B4（WASM 在 Node 跑通），单这一项就 8-16 小时。

## 单个最关键的阶段

跟 Collector 的"Stage 5 Value-match"是关键不同 ——

**Bundle 路径的关键 Stage 是 B4（WASM 在 Node 跑通）**。原因：
- 其它阶段（B1/B2/B3/B5/B7）跟 Collector 类似，能用现成方法
- **B4 没有现成方法可借鉴** —— wasm-bindgen 桥接 + 34 个 wbg imports + ChaCha20 seed 提取，每一步都要从 0 调
- 这一步过不去，整个 Bundle 路径就跑不通

---

# §3 Stage B1 — 锁定 captcha.js + WASM

## 3.1 触发挑战拿 captcha.js URL

```js
// 浏览器 console 跑（或参考 bundle/script/userscripts/px_bundle3_auto.user.js）
async function triggerCaptcha() {
    for (let i = 0; i < 250; i++) {
        const resp = await fetch('https://cw-marketplace.ifood.com.br/v1/cardstack/search/home', {
            method: 'POST',
            credentials: 'include',
            body: JSON.stringify({...})
        });
        if (resp.status === 403) {
            const body = await resp.json();
            if (body.blockScript) {
                console.log('captcha URL:', body.blockScript);
                return body;
            }
        }
        await new Promise(r => setTimeout(r, 100));
    }
}
```

输出例：
```
captcha URL: https://client.px-cloud.net/PXO1GDTa7Q/captcha_7f2a3b1c.js?v=...
```

⚠️ **文件名带 hash 后缀，每次会话变**。要在 Network 面板**保存 raw response body** 当 SDK 锁定时点。

## 3.2 提 WASM

`captcha.js` 内嵌 WASM（base64 在 `Us()[10]`）。提取脚本：

```js
// bundle/stample/helpers/extract_wasm.js（已有）
const captchaJs = fs.readFileSync('captcha.js', 'utf8');
const m = captchaJs.match(/"(AGFzbQ[A-Za-z0-9+/=]{50000,})"/);
const wasmBytes = Buffer.from(m[1], 'base64');
fs.writeFileSync('px_captcha.wasm', wasmBytes);
```

期望输出 60862 字节 + magic `\0asm 01 00 00 00`。

如果提不出来（base64 字符集变了），试 10 种解码路径（见 `bundle/source/SDK_INFO.md` §2）。

## 3.3 SDK_INFO.md 锁定

把 SHA + 大小 + 提取时间 写到 `bundle/source/SDK_INFO.md`：

```markdown
| File | SHA-256 | Size | Captured |
|---|---|---|---|
| captcha.js | `acdf2dcfa042...` | 821113 字节 | 2026-05-21 |
| px_captcha.wasm | `900a9b07c1de...` | 60862 字节 | 2026-05-21 |
```

跟 Collector 的 `stample/ifood/source/SDK_INFO.md` 同结构。

---

# §4 Stage B2 — 解 OB#1 / OB#2

## 4.1 OB 解码沿用 Collector

```js
// 跟 Collector 完全一样的代码
const xorKey = parseInt(ml(tag), 10) % 128;
const raw = Buffer.from(obBase64, 'base64').toString('binary');   // ⚠️ binary 不是 utf-8
const decoded = xorString(raw, xorKey);
const segments = decoded.split('~~~~');                            // 4 个 ~
```

直接复用 [`../../revers/ob.js`](../../revers/ob.js) 的 `decodeOb()`。

## 4.2 Bundle 多 2 个 PoW handler

OB#1 比 Collector 多 2 段：

```
段 7: I0I0I0|1|<60-char suffix>|<64-char target>|16|false
   → PoW dispatch（主路径）
段 8: 0II0I0|1|<uuid>|<port>|<challengeData>|1|
   → PoW 备用路径（via qu/os）
```

跟 Collector 比，**多 2 个 handler 形状要识别**。详见 [`bundle/doc/Bundle_完整技术文档.md`](../../bundle/doc/Bundle_完整技术文档.md) §3.5。

## 4.3 提取的 state（多 PoW 参数）

```js
// Collector state
{ no, qa, to, vid, pxsid, appId, cts, jf }

// Bundle state（多 PoW + Bundle AppID）
{
    no, qa, to, vid, pxsid, cts, jf,
    appId,                                       // ⚠️ Bundle AppID 跟 Collector AppID 是 2 个值
    pow: { suffix, target, difficulty }          // 新增
}
```

⚠️ **Bundle AppID** 跟 Collector AppID **不同**（iFood: `PXd6f03jmq8h6c7382req0` vs `PXO1GDTa7Q`）。详见 `bundle/doc/Bundle_完整技术文档.md` §1.5。

---

# §5 Stage B3 — 算 PoW

## 5.1 PoW 公式

```
sha256(suffix + counter.toString(16).padStart(4, '0')) 的前 4 hex 字符 == target.slice(0, 4)
```

求解：枚举 counter 从 0 到 65536（2^16），直到 hash 前 4 hex 字符匹配。

## 5.2 关键陷阱：必须用同步 SHA-256

⚠️ **Bundle 路径最致命的陷阱之一**：

```js
// ❌ 错（Node 异步）
const hashBuf = await crypto.subtle.digest('SHA-256', buf);
// → 每次 await 切 event loop +10ms → 65536 次 = 600s+ → PX session 早超时

// ✅ 对（Node 同步）
const hash = crypto.createHash('sha256').update(s).digest('hex');
// → 9-60ms
```

详见 [`bug_report/2_bundle_path.md`](../../bug_report/2_bundle_path.md) 第 #B5 条。

## 5.3 Node 实现

```js
function solvePow(targetHash, suffix, difficulty = 16) {
    const m = Math.ceil(difficulty / 4);
    const padding = '0'.repeat(m);
    const mask = (1 << (4 * m)) - 1;
    const lastHexDigit = parseInt('0x' + suffix.charAt(suffix.length - 1), 16);
    const prefix = suffix.slice(0, -1);
    const maxCounter = 1 << difficulty;

    for (let r = 0; r < maxCounter; r++) {
        const lowPart = (padding + (r & mask).toString(16)).slice(-m);
        const candidate = prefix + (lastHexDigit + (r >> (m << 2))).toString(16) + lowPart;
        if (crypto.createHash('sha256').update(candidate).digest('hex') === targetHash) {
            return { answer: candidate, counter: r };
        }
    }
    throw new Error('PoW no solution');
}
```

## 5.4 浏览器实现（Web Worker）

PX 在浏览器里用 Web Worker 跑 PoW（避免阻塞主线程）。如果你想跟 PX 同款实现：

```js
// Web Worker 内
function ws(suffix, target, difficulty, startTime) {
    const m = Math.ceil(difficulty / 4);
    // ... 同 Node 但同步 sha256 实现要 inline 进 Worker（Worker 没 require）
    for (let counter = 0; counter < (1 << difficulty); counter++) {
        const candidate = ...;
        if (sha256(candidate) === target) {
            postMessage({ answer: candidate, elapsed: Date.now() - startTime });
            return;
        }
    }
}
```

## 5.5 验证（用 OB#1 真数据）

```
suffix     = "ab317b680dfb5a3dc7c52a4fefedce5adb20cedd066ce5408ce6887aee9c"
targetHash = "7bb57f904e7b938c8442e522a97d754d23a35964a1030857244c7d2c803a1169"
difficulty = 16

期望:
  answer  = "ab317b680dfb5a3dc7c52a4fefedce5adb20cedd066ce5408ce6887aee9c24da"
  counter = 9434 (0x24da)
  耗时    = 9-60ms
```

---

# §6 Stage B4 — 跑 WASM ⭐⭐⭐

**这是 Bundle 路径最难的阶段**。预算 8-16 小时（第一次）。

## 6.1 WASM 概览

PX 用 wasm-bindgen 生成的 Rust 模块，60862 字节，导出 2 个函数：

```
a()              → 64-hex 字符串（每次不同，含 globalThis._pxUuid + 随机源）
b(input: str)    → 127-char 自定义编码（确定性，ChaCha20 变换）
```

## 6.2 关键陷阱

⚠️ 3 个必踩的坑：

### 坑 #B1: `globalThis._pxUuid` 必须在 instantiate 之前设置

```js
// ❌ 错
const { instance } = await WebAssembly.instantiate(wasmBytes, imports);
globalThis._pxUuid = uuid;
const a = instance.exports.a();
// → a() 返空字符串

// ✅ 对
globalThis._pxUuid = uuid;
const { instance } = await WebAssembly.instantiate(wasmBytes, imports);
const a = instance.exports.a();
```

### 坑 #B2: `instanceof_Window` 必须返 1

Node 默认没 Window class，WASM 用 `__wbg_instanceof_Window` 判断时返 0 → 错误路径 → 返空。

```js
imports.wbg = {
    ...
    __wbg_instanceof_Window: () => 1,   // ⭐ 必须返 1
    __wbg_instanceof_Document: () => 1,
    __wbg_instanceof_HTMLElement: () => 1,
};
```

### 坑 #B4: b() 输出**不是 base64**

```
b() 字母表: /=+!1@2#3$4%5^6&7*8(9)0-
```

跟标准 base64 不一样。**当字面字符串原样填到 Bundle#3 字段**，不要 base64-decode。

## 6.3 34 个 wbg imports（关键 8 个）

完整 34 个见 `bundle/doc/Bundle_完整技术文档.md` §5.3。Node mock 最少需要：

```js
const imports = {
    wbg: {
        // 1. 环境检测（必返 1）
        __wbg_instanceof_Window: () => 1,
        __wbg_instanceof_Document: () => 1,
        __wbg_instanceof_HTMLElement: () => 1,

        // 2. 全局对象
        __wbg_window: () => mockWindow,
        __wbg_document: () => mockDocument,
        __wbg_navigator: () => mockNavigator,
        __wbg_screen: () => mockScreen,
        __wbg_self: () => globalThis,
        __wbg_globalThis: () => globalThis,

        // 3. 属性 Reflect
        __wbg_get: (target, key) => Reflect.get(target, key),
        __wbg_set: (target, key, value) => { Reflect.set(target, key, value); return true; },

        // 4. 随机数（必须真随机，否则 a() 输出可重复 → fingerprint 异常）
        __wbg_getRandomValues: (cryptoObj, buf) => {
            require('crypto').randomFillSync(buf);
            return buf;
        },
        __wbg_randomFillSync: (cryptoObj, buf) => {
            require('crypto').randomFillSync(buf);
        },

        // 5. 时间
        __wbg_now: () => Date.now(),
        __wbg_performance: () => ({ now: () => performance.now() }),

        // 6-8. 控制台 / 内存 / 字符串桥（wasm-bindgen 标准）
        __wbg_log: () => {}, __wbg_warn: () => {}, __wbg_error: () => {},
        __wbindgen_throw: (ptr, len) => { throw new Error('wasm throw'); },
        __wbindgen_memory: () => instance.exports.memory,
    },
};
```

## 6.4 wasm-bindgen 桥代码

WASM 跟 JS 字符串传参靠 wasm-bindgen 的桥。完整桥见 `bundle/doc/Bundle_完整技术文档.md` §5.5。简版：

```js
function passStringToWasm(s) {
    const buf = textEncoder.encode(s);
    const ptr = wasm.__wbindgen_malloc(buf.length);
    new Uint8Array(wasm.memory.buffer).set(buf, ptr);
    WASM_VECTOR_LEN = buf.length;
    return ptr;
}

function getStringFromWasm(ptr, len) {
    return textDecoder.decode(new Uint8Array(wasm.memory.buffer).subarray(ptr, ptr + len));
}

function wasmA() {
    const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
    try {
        wasm.a(retptr);
        const r0 = new Int32Array(wasm.memory.buffer)[retptr / 4];
        const r1 = new Int32Array(wasm.memory.buffer)[retptr / 4 + 1];
        const s = getStringFromWasm(r0, r1);
        wasm.__wbindgen_free(r0, r1);
        return s;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}
```

## 6.5 验证 a() / b() 输出

```js
// 跟真抓的 Bundle#2 payload 对比
const aResult = wasmA();
const bResult = wasmB(powCounter);

console.log('a:', aResult);    // 期望 64 hex chars
console.log('b:', bResult);    // 期望 127 自定义编码 chars
console.log('a 重复调:', wasmA() === aResult ? '错' : '对');  // a() 非确定性
console.log('b 重复调:', wasmB(powCounter) === bResult ? '对' : '错');  // b() 确定性
```

跟真抓的 `bundle/stample/decoded/bundle2_event.json` 里的 `Slt5EA85fiI=` (a 输出) + `MD1DNnVfRgQ=` (b 输出) 对比，**字符级一致**。

## 6.6 跨版本：ChaCha20 seed 提取

每次 PX build WASM 内部 ChaCha20 seed 都变（32 字节嵌在 `.data` 段）。提取：

```bash
wasm-objdump -j data px_captcha.wasm | head -30
# 找 segment[0]，那 32 字节就是疑似 seed
```

跨版本 b() 输出对不上 = seed 变了。**这是最难修复的 SDK 升级场景**（要重新做 WASM 静态分析）。

---

# §7 Stage B5 — 拼 Bundle#3 六个事件

## 7.1 事件结构（顺序敏感！）

Bundle#3 EV 数组**严格 6 个事件**：

```js
[
    Event #0  (78 字段) — 浏览器指纹（WebGL/Canvas/UA）            seq=2
    Event Metrics ⭐ (18 字段) — PX 内部指标上报                    seq=3
    Event #1  (20 字段) — mouseout 单次交互                         seq=4
    Event #2  (95 字段) — PX561 核心（按压+WASM+鼠标轨迹）          seq=6
    Event #3  (27 字段) — Captcha onSolvedCallback                  seq=7
    Event #4  (24 字段) — PX11994 交互总结                          seq=8
]
```

PC HMAC 校验对 `serialize([ev0, evMetrics, ev1, ev2, ev3, ev4])` 计算，**换顺序 = 拒**。

> ⚠️ **关键修正**：早期文档写 5 事件（漏 Metrics）。**必须 6 事件，少一个被拒**。

## 7.2 PX561 95 字段的 Tier 分级

PX561 是 Bundle#3 最复杂的事件。按"伪造难度"分 5 Tier：

| Tier | 数量 | 内容 | 难度 |
|---|---|---|---|
| T1 写死 | ~50 | 21 布尔 + 10 屏幕常量 + 7 字符串常量 + 12 公共尾部 | 零 |
| T2 简单写活 | ~25 | 递增计数器 + perf.now + 时间戳 | 低 |
| T3 Session 依赖 | ~15 | UUID / _px3 token / state.* | 中（从前序请求拿） |
| T4 鼠标轨迹 ⚠️ | 5 | 544 点完整 + 150 点过滤 + 差分 + 25 点子集 + 32 项 interactions | **高** |
| T5 WASM 计算 | 3 | a() / b(pow) / sensor 加密 | **已搞定**（§6） |

详见 `bundle/doc/Bundle_完整技术文档.md` §7.4。

## 7.3 鼠标轨迹（Tier 4 难点）

```js
function generateMouseTrajectory(startX, startY, endX, endY, durationMs) {
    // 4 控制点贝塞尔（不要直线、不要匀速）
    const ctrl1 = randomCtrl(startX, startY, endX, endY, 0.3);
    const ctrl2 = randomCtrl(startX, startY, endX, endY, 0.7);

    const points = [];
    for (let i = 0; i < 544; i++) {
        const t = i / 543;
        const x = cubicBezier(startX, ctrl1.x, ctrl2.x, endX, t);
        const y = cubicBezier(startY, ctrl1.y, ctrl2.y, endY, t);

        // ⚠️ 浮点坐标，1 位小数（坑 #B12）
        points.push({
            x: Math.round(x * 10) / 10,
            y: Math.round(y * 10) / 10,
            ts: Math.round(startTs + durationMs * t)
        });
    }
    return points;
}
```

**关键约束**：
- 544 点（PX 期望值，±10% 容忍）
- 浮点坐标（整数 = 机器人）
- 时间戳分布跟按压时长对齐（坑 #B13）
- 起止点跟 pointerdown/up 对齐
- 鼠标 interactions ts 必须 ≈ pointerdown.ts ± 200ms

## 7.4 缅甸文 DOM 编码

```js
function myanmarEncode(domNodes) {
    // 1. DOM tag 计数
    const counts = {};
    for (const node of domNodes) counts[node.tagName.toLowerCase()] = (counts[...] || 0) + 1;

    // 2. JSON 序列化（按字母排序）
    const json = Object.entries(counts).sort().map(([t,c]) => `${t}:${c}`).join(',');

    // 3. XOR 4210
    let xored = '';
    for (let i = 0; i < json.length; i++) xored += String.fromCharCode(json.charCodeAt(i) ^ 4210);

    // 4. base64 + Unicode 缅甸文映射（U+1000-U+109F）
    const b64 = btoa(xored);
    let myanmar = '';
    for (const ch of b64) myanmar += String.fromCharCode(0x1000 + base64Index(ch));
    return myanmar;
}
```

⚠️ DOM tag counts **必须跟 captcha iframe 实际渲染**一致。captcha.js 升级一个 `<img>` tracking pixel → 整个编码废了。

## 7.5 4 组错误栈

```js
const errors = [
    (() => { try { return (null)[0]; } catch (e) { return e.stack; } })(),       // TypeError
    (() => { try { return undefinedVar; } catch (e) { return e.stack; } })(),     // ReferenceError
    (() => { try { return new Array(-1); } catch (e) { return e.stack; } })(),    // RangeError
    (() => { try { return JSON.parse('not json'); } catch (e) { return e.stack; } })(),  // SyntaxError
];
ev3['error_stacks_key'] = errors;   // 4 元素数组
```

⚠️ Node 跑的 stack 跟浏览器 V8 跑的格式不同 → **必须用浏览器抓出来的 stack 模板**，按 Chrome 大版本（140/145/148）维护多套（详见 `bug_report/4_sdk_drift.md` 第 #D7 条）。

---

# §8 Stage B6 — iframe XHR Hook 拦截 B1/B2

## 8.1 关键 insight：captcha 在 iframe 里发请求

⚠️ **新人最容易栽这里**：PX captcha **不在主页面发 Bundle#1/#2**，**在 captcha iframe 里发**。

如果你只 hook 主页面 fetch / XHR → **拦不到 B1/B2** → "我的 hook 没触发，PX 出 bug 了？" → 不是 PX 出 bug，是你 hook 错地方。

## 8.2 解决方案：iframe XHR Hook

```js
function hookIframeXHR(iframe) {
    let iframeWin;
    try { iframeWin = iframe.contentWindow; } catch(e) { return; }
    if (!iframeWin || !iframeWin.XMLHttpRequest) return;
    if (iframe._pxHooked) return;
    iframe._pxHooked = true;

    const origOpen = iframeWin.XMLHttpRequest.prototype.open;
    const origSend = iframeWin.XMLHttpRequest.prototype.send;

    iframeWin.XMLHttpRequest.prototype.open = function(method, url) {
        this._pxUrl = url;
        this._pxMethod = method;
        return origOpen.apply(this, arguments);
    };

    iframeWin.XMLHttpRequest.prototype.send = function(body) {
        const urlStr = this._pxUrl || '';
        if (/\/assets\/js\/bundle/.test(urlStr)) {
            this.addEventListener('load', () => {
                // 拿响应 → 触发我们的 onBundle1Response / onBundle2Response
                onBundleResponse(urlStr, body, this.responseText);
            });
        }
        return origSend.apply(this, arguments);
    };
}
```

## 8.3 同步检测 iframe 插入

`MutationObserver` 异步检测 iframe，有时晚于 captcha 加载第一个 XHR → 拦不到 B#1。

```js
// 同步 hook appendChild，第一时间装 XHR hook
const origAppendChild = Document.prototype.appendChild;
Document.prototype.appendChild = function(node) {
    const result = origAppendChild.call(this, node);
    if (node.tagName === 'IFRAME' && (node.src || '').includes('captcha')) {
        // 立即 hook
        hookIframeXHR(node);
        // 也加 load listener 二保险
        node.addEventListener('load', () => hookIframeXHR(node));
    }
    return result;
};
```

这就是 [`bundle/script/userscripts/px_bundle3_auto.user.js`](../../bundle/script/userscripts/px_bundle3_auto.user.js) 的 Part 3.5（line 1617+）。

---

# §9 Stage B7 — 用真浏览器验证

## 9.1 装 userscript 测全流程

```
1. Tampermonkey 装 px_bundle3_auto.user.js
2. 打开 https://www.ifood.com.br/
3. F12 → 看 [PX-AUTO] 日志
4. 触发挑战:
   - 浏览或快速跑业务 API 让 PX 评分到 Bundle
5. 看脚本自动:
   - 拦截 Bundle#1 → 解 OB#1 → 提 state + PoW 参数
   - 算 PoW (~9-60ms)
   - 跑 WASM a() + b()
   - 拦截 Bundle#2 → 拿首版 _px3
   - 自构 Bundle#3 → fetch POST
   - 拦截 Bundle#3 → 提取有效 _px3
6. F12 控制台:
   > __pxAutoState        看主页面拦截状态
   > __pxCaptchaState     看 captcha iframe 状态
   > __pxBuildB3()        手动 debug 触发
   > __pxReset()          清状态重试
```

## 9.2 验证矩阵

| 测试 | 期望 |
|---|---|
| 全流程 1 次 | ✓ 拿到 `_px3` (jf=success) |
| 重复 5 次（间隔 30s） | 5/5 全过 |
| 业务 API 用拿到的 _px3 | 200 OK |
| 清 cookie 重试 | 仍 5/5 |
| 跨账号 5 个 | 5/5 |
| **10/10 稳定** | **all pass** |

## 9.3 失败诊断（决策树见 §14）

如果 10 次有 1 次失败：
- jf=blocked → IP 评分太低（换 IP）
- jf=cu → Bundle#3 字段没对（看 §14 子流程）
- _px3 业务 API 拒 → cookie 拿到但有问题（看 stack）

---

# §10 Stage B8 — 打包成 Tampermonkey userscript

## 10.1 选项 A：手动维护 user.js

直接用 `bundle/script/userscripts/px_bundle3_auto.user.js` 2131 行成品。改 const 区域的 TAG / AppID / FT 等常量 → 适配新版/新站。

## 10.2 选项 B：用构建器（待修）

`bundle/stample/helpers/build_userscript.js` 设计是从 WASM base64 + 5 条轨迹 + generator 代码自动拼出 user.js。

⚠️ **当前 line 319 模板字符串嵌套转义错跑不通**。修法：
1. 把内嵌的 ESCAPE_RE_PL regex 提到外部 string concat
2. 不要在 template literal 里嵌 `` ` `` 字符
3. 跑通后 `node build_userscript.js` 输出 px_bundle3_auto.user.js

> **后续工作**：修构建器。卡点是模板字符串转义（legacy `build_userscript.js`
> 第 319 行）。当前路径是手维护 2131 行成品
> [`bundle/script/userscripts/px_bundle3_auto.user.js`](../../bundle/script/userscripts/px_bundle3_auto.user.js)。
> 如果你修了构建器，欢迎提 PR。

## 10.3 Tampermonkey 元数据

```js
// ==UserScript==
// @name         PX Bundle3 Auto
// @namespace    px-reverse
// @version      <bumpversion>
// @description  自动拦截 B1/B2, 构造 B3 并发送
// @match        https://www.ifood.com.br/*
// @run-at       document-start    ← ⭐ 关键，必须 document-start 才能 hook 早期
// @grant        none              ← 不要任何 GM_ 权限，最大兼容
// ==/UserScript==
```

---

# §11 跟 Collector 方法论的差异表

逐项对比 7 阶段 Collector vs 8 阶段 Bundle：

| 维度 | Collector | Bundle | 差异说明 |
|---|---|---|---|
| 阶段数 | 7 | 8 | Bundle 多 1 个 PoW+WASM 阶段 |
| 关键阶段 | Stage 5 Value-match | **Stage B4 WASM Node 模拟** | Bundle 难在 WASM，不在 value match |
| SDK 文件 | main.min.js (231 KB) | captcha.js (821 KB) + px_captcha.wasm (60 KB) | Bundle 文件大 4x |
| 时间预算（熟练） | 4 h | **9 h** | Bundle 2.25x |
| 时间预算（第一次） | 15 h | **40 h** | Bundle 2.7x |
| 算法层共享 | 100%（基线） | 70% | 共享 payload/PC/OB/SID/UUID/HMAC/Anti-tamper |
| 算法层新增 | 0 | 5（PoW/WASM/贝塞尔/缅甸文/error stack） | Bundle 多 5 个 |
| 字段总数 | EV1(14) + EV2(204) ≈ 220 | Bundle#1(16) + #2(228) + #3(262) ≈ 500 | Bundle 2.3x |
| POST 个数 | 2 | 4 | Bundle 2x |
| Hook 复杂度 | 仅主页面 fetch | **iframe XHR + appendChild MutationObserver** | Bundle 多 1 个层 |
| 成品体积 | ifood_px3.js ~270 行 | px_bundle3_auto.user.js **2131 行** | Bundle 8x |
| 时序约束 | ~5 秒会话 | **10-15 秒 + 多个内部 time check** | Bundle 严格得多 |

**总结**：Bundle 是 Collector 的"plus 版"。如果你做过 Collector，Bundle 是个**已知套路 + 5 个新坑 + 大量字段**。

---

# §12 Bundle 路径独有的 6 个踩坑

完整 20 条见 [`bug_report/2_bundle_path.md`](../../bug_report/2_bundle_path.md)。**Bundle 独有最坑的 6 条**：

| # | 严重 | 标题 | 一句话 |
|---|---|---|---|
| B1 | ⭐⭐⭐ | `_pxUuid` before WASM init | `globalThis._pxUuid = uuid` 必须在 instantiate 之前 |
| B2 | ⭐⭐⭐ | `instanceof_Window` 必须返 1 | Node mock 必填 |
| B5 | ⭐⭐⭐ | PoW 必须同步 SHA-256 | 异步 600s+ 必超时 |
| B8 | ⭐⭐⭐ | Bundle#3 6 事件顺序敏感 | 换顺序 = PC 不对 |
| B11 | ⭐⭐⭐ | 按压时长 1-3s | < 0.5s 或 > 5s 都拒 |
| **B(new)** | ⭐⭐⭐ | iframe XHR Hook | 只 hook 主页面 fetch 拦不到 B1/B2 |

后两条 Collector 完全没有。

---

# §13 时间预算

## 第一次做 Bundle（从 0 学起）

```
Week 1: 学 Collector 路径前置          15 h
Week 2: 读本文 + Bundle 完整技术文档    10 h
Week 3: 复现 Bundle#1/#2 (Stage B1-B3) 10 h
Week 4: 攻克 WASM (Stage B4) ⭐⭐⭐    16 h
Week 5: 拼 Bundle#3 + iframe Hook       10 h
Week 6: 验证 10/10 + 打 userscript       5 h
─────────────────────────────────────────────
                                 总  ≈ 66 h
```

## 第二次做 Bundle（新站点移植，已有 iFood Bundle 经验）

```
Day 1: 抓 captcha.js + WASM + 提取常量    2 h
Day 2: 适配 OB 解码 + 跨版本字符集         3 h
Day 3: WASM 跨版本 ChaCha20 seed         4 h
Day 4: 鼠标轨迹池 + DOM 编码模板          3 h
Day 5: 验证                              4 h
─────────────────────────────────────────────
                                 总 ≈ 16 h
```

跟 Collector 跨平台移植对比：

| 路径 | 第一次 | 跨平台移植（已有经验） |
|---|---|---|
| Collector | 15 h | 1 天/站 |
| **Bundle** | **66 h** | **2 天/站** |

---

# §14 失败诊断决策树

```
拿不到 _px3 → 检查 jf
   │
   ├── jf 缺失（没拿到 OB#2 / OB#3）
   │   └── PC 错 / payload 加密错 → §6 Stage 5 Value-match
   │
   ├── jf=blocked
   │   └── IP 评分太低 → 换住宅 IP / 等 30 分钟
   │
   ├── jf=cu 但没拿到 _px3 后续
   │   ├── Bundle#3 全 PC 错       → Stage B5 字段错（看 compare_my_bundle3）
   │   ├── Bundle#3 200 但 jf=cu  → 时序/按压时长/鼠标轨迹错（见 §7）
   │   └── Bundle#3 200 jf=success 但业务 API 拒 → 时序窗口超限（重抓）
   │
   ├── jf=success 但业务 API 仍拒
   │   ├── TLS 指纹错（curl_cffi 解决）
   │   ├── UA 跟 HMAC 不一致（坑 #23）
   │   └── 子域不同 WAF 策略（如 cw-marketplace WAF 严格）
   │
   └── 完全没响应（timeout）
       ├── PoW 用了 crypto.subtle 异步 → 改同步 (§5.2)
       ├── /assets/js/bundle URL 错（用了 /api/v2/collector）
       └── ft 错（用了 401 → 该 388）
```

---

# §15 跨平台 Bundle 移植

跟 Collector 7 步法（见通用版方法论 §6.8）类似，Bundle 是 **7 步 + 5 个独家步骤**：

## 共享 7 步（跟 Collector 同）

1. 抓新站点 captcha.js + WASM
2. 提取 Bundle AppID（OB#1 segment#3）
3. 提取新 FT（看 POST body 的 `ft=`）
4. 适配 OB handler shape
5. 适配 wire 字符集（`0/l` vs `o/I`）
6. 重建 EV2 字段模板（6 批跨批 diff）
7. 端到端测试

## Bundle 独家 5 步

8. **WASM 常量提取**（ChaCha20 seed / HMAC key / 自定义字母表）
9. **error_stack 模板**（按 Chrome 版本采集）
10. **缅甸文 DOM 编码模板**（按新 captcha iframe 渲染采集）
11. **鼠标轨迹池**（如果新站点 captcha 按钮位置/大小不同，要重新采）
12. **iframe Hook 适配**（不同站点 captcha iframe URL pattern 不同）

详见 `bundle/doc/Bundle_完整技术文档.md` §14。

---

# §16 SDK 升级响应

跟 Collector 升级响应（通用版方法论 §6.9）类似，**Bundle 额外要检查**：

| 检查项 | 频率 |
|---|---|
| Collector main.min.js SHA | 月 1-2 次 |
| **Bundle captcha.js SHA** | **每 2-3 周一次**（比 Collector 频率高 3x） |
| **Bundle WASM SHA + ChaCha20 seed** | 同 captcha.js（捆绑升级） |
| **error_stack 模板**（按 Chrome 版本） | Chrome 大版本升级时 |
| **缅甸文 DOM 模板**（按 captcha iframe HTML） | captcha.js 升级时 |

**关键认知**：**Bundle 升级频率是 Collector 的 2-3 倍**。维护一份 Bundle generator 长期成本远高于 Collector。

---

# §17 当你应该放弃 Bundle 路径

考虑放弃 Bundle 纯算的 3 种场景：

## 17.1 业务 90% 流量不触发 Bundle

如果只有 1% 流量需要 Bundle，**用 Userscript fallback 比纯算 generator 性价比高 10x**：
- 拿到 cookie 后复用 5 分钟 → 100 个用户 = 1 个 Userscript 会话能服务一段时间
- 不用维护 2131 行成品
- 不用应对 captcha.js 每 2-3 周升级

iFood 2026 实战就是这个选择。

## 17.2 PX 大改 WASM

如果 PX 把 WASM 模块从 wasm-bindgen 切换到别的工具链（如 emscripten），或者从 ChaCha20 换到别的流密码 —— **预计 16+ 小时重新分析**。

考虑：
- 业务可以用 Userscript 撑过去吗？
- WASM 替代有多大概率？（实测 PX 3 年没换过工具链）
- 投入 16h 维护 vs 不做 Bundle 的损失？

## 17.3 你的目标不是 PX 反爬

Bundle 路径**只对 PX 客户站点有用**。如果你的下一个目标站用的是 Cloudflare Turnstile / Akamai / DataDome / Imperva —— Bundle 知识**不通用**。

那些 WAF 的"按压挑战"机制各自不同，得从 0 重学。

---

# §18 参考资源

| 资源 | 路径 |
|---|---|
| Bundle 完整技术文档（4996 行） | [`../../bundle/doc/Bundle_完整技术文档.md`](../../bundle/doc/Bundle_完整技术文档.md) |
| Collector 方法论（前置阅读，1233 行） | [`PX_逆向方法论_通用版.md`](PX_逆向方法论_通用版.md) |
| PX SDK 完整技术文档（前置） | [`PX_SDK_逆向技术文档.md`](PX_SDK_逆向技术文档.md) |
| iFood/Grubhub SDK 对照（前置） | [`PX_完整SDK对照逆向方法论.md`](PX_完整SDK对照逆向方法论.md) |
| Bundle 路径 20 条踩坑 | [`../../bug_report/2_bundle_path.md`](../../bug_report/2_bundle_path.md) |
| Bundle 实战成品 userscript | [`../../bundle/script/userscripts/px_bundle3_auto.user.js`](../../bundle/script/userscripts/px_bundle3_auto.user.js) |
| Bundle SDK 源材料 | [`../../bundle/source/`](../../bundle/source/) |
| Bundle 真抓样本 | [`../../bundle/stample/`](../../bundle/stample/) |
| WASM 工具链（wabt） | https://github.com/WebAssembly/wabt |
| wasm-bindgen（PX 用这个） | https://rustwasm.github.io/wasm-bindgen/ |

---

*校验时间 2026-05-21。本文档基于 iFood Bundle 2026-02 实战 10/10 + Pr0t0ns v8.9.6 对照整理。下次大改：当 PX 推 Bundle 大版本时（典型 6 个月-1 年）。*
