# Playbook: SDK 关键函数定位（入口 / 调度 / 工具函数）

> 给一个全新 PX SDK，**怎么找到所有关键函数的位置**？
>
> 算法（MD5/HMAC/XOR/...）的定位见 [`reverse-algorithms.md`](reverse-algorithms.md)。
> 本 playbook 专讲**功能函数**：hQ 字典解码、/ns 探针、OB 调度、事件构造、
> 指纹采集、cookie 读写、captcha.js 加载、PoW、WASM。
>
> 预计时间：**30-60 分钟**

---

## ⚠️ 重要：两种路径，两个 SDK 文件

PX 有**两条路径**，函数也分布在**两个 SDK 文件**里 — 一定要先搞清楚自己在逆哪条：

```
┌────────────────────────────────────────┐
│  无感 Collector 路径（99% 流量）        │
│  SDK 文件: main.min.js                  │
│  2 个 POST → 直接拿 _px3/_px2 cookie     │
│  函数: hQ / /ns / OB / mh / Dd / ur/lr   │  ← 1-7 在这
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│  按压 Bundle 路径（被风险评分触发后才走）│
│  SDK 文件: captcha.js（独立下载）        │
│  4 个 POST + WASM + PoW + 鼠标按压挑战   │
│  函数: PoW 求解 / WASM 加载              │  ← 8-9 在这
└────────────────────────────────────────┘
```

**写无感 collector 路径的 generator → 只用 main.min.js + 函数 1-7。完全不需要 captcha.js / PoW / WASM。**

按压挑战才是 Bundle，那是另一套，本 playbook §8-9 单独讲。

---

## 总览：需要定位的 9 类关键函数

| # | 路径 | 函数语义 | 在哪个文件 | 跨版本稳定特征 | 难度 |
|---|---|---|---|---|---|
| 1 | 无感 | **hQ 字典三件套**（字典 + 解码器 + 查表） | `main.min.js` | base91 字母表 `F@bt` 标志 | ⭐⭐ |
| 2 | 无感 | **/ns 探针** | `main.min.js` | URL `tzm.px-cloud.net` 字面量 | ⭐ |
| 3 | 无感 | **OB 调度器** | `main.min.js` | `split("\|").shift()` 集中型 / `.do\|\|.ob` 分散型 | ⭐⭐⭐ |
| 4 | 无感 | **27 个 OB handler 注册表** | `main.min.js` | 字面 wire 字节 `0/l` 或 `o/I` | ⭐⭐ |
| 5 | 无感 | **事件构造主入口（mh）** | `main.min.js` | 组装 POST 参数 `"&pc="` `"&payload="` | ⭐⭐⭐ |
| 6 | 无感 | **指纹采集主入口（Dd）** | `main.min.js` | 连续短名函数调用 `ev(t); nv(t); ...` | ⭐⭐⭐⭐ |
| 7 | 无感 | **Cookie 读写工具（ur/lr）** | `main.min.js` | `document.cookie` 字面量 | ⭐⭐ |
| 8 | **Bundle** | **PoW 求解器** ⚠️ 仅按压路径用 | `captcha.js` | `crypto.subtle.digest("SHA-256")` | ⭐⭐ |
| 9 | **Bundle** | **WASM 加载器** ⚠️ 仅按压路径用 | `captcha.js` | `WebAssembly.instantiate` | ⭐ |

---

## 1. hQ 字典三件套

PX SDK 第 1-200 行就是这套。功能：把混淆字符串通过查表恢复（详见 [`reverse-algorithms.md`](reverse-algorithms.md) 算法 5）。

### 怎么定位

```bash
# 方法 1：找 base91 字母表（最稳）
grep -nE "F@bt" sdk.js
# → 应命中 1 行，那一行就在 hM 解码器函数体里

# 方法 2：找最长字符串数组（hP）
grep -boE 'hP\s*=\s*\[\s*"[^"]{1,30}"' sdk.js
# → iFood：hP=["B5e4T4AM&6+r9i}DvsKZ$@v]5]~~sT", ...

# 方法 3：找查表 + cache 模式（hQ）
grep -nE 'void\s+0\s*===.*\?.*=' sdk.js | head -5
# → hQ 函数体含 `void 0 === hO[t] ? hO[t] = hM(hP[t]) : hO[t]`
```

### 三个组件相邻

```
hP 数组（最长字面 array）
   ↓ 紧跟（同一 var 声明或几行内）
hM 解码器（含 F@bt 字母表）
   ↓ 紧跟
hQ 查表 + 缓存
   ↓ 紧跟
数组旋转 IIFE（启动时打乱 hP 顺序）
```

### 怎么验证

```js
// 用 hM + hP[0] 解码，应解出有意义字符串
const { hM } = require('./your-extracted-hM');
const hP_0 = "B5e4T4AM&6+r9i}DvsKZ$@v]5]~~sT";  // 从 SDK 复制
console.log(hM(hP_0));
// 期望: 应是 base64 key 或 navigator API 名（不是乱码）
```

### iFood / Grubhub 实测

| | iFood (新版) | 旧版 |
|---|---|---|
| 字典变量名 | `hP` | `Id()` 返回数组 |
| 解码器变量名 | `hM` | 内联在 `Rd` |
| 查表函数 | `hQ(N)` | `Rd(N)` 或 `wd(N)` |
| 偏移 | 无 | `-= 495` |

**关键**：变量名跨版本变，但 **`F@bt` 字母表 3 年没变过**。grep 它必命中。

---

## 2. /ns 探针 URL

PX 的网络指纹端点 — 部分平台用（iFood 用，Grubhub 不用）。

### 怎么定位

```bash
grep -boE '"tzm\.px-cloud\.net|"https://tzm\.' sdk.js
# → "https://tzm.px-cloud.net"

# 完整 URL 是 https://tzm.px-cloud.net/ns?c={uuid}
grep -nE 'tzm\.px-cloud\.net|/ns\?c=' sdk.js
```

### 为什么稳定

- `tzm.px-cloud.net` 是 PX 全局共享的 telemetry 主机，跨客户、跨年不变
- `/ns?c=<uuid>` 路径写死在 SDK，**不参与混淆**

### 怎么验证

```bash
curl "https://tzm.px-cloud.net/ns?c=$(uuidgen)"
# → 返回 base64 字符串（如 "3rxcTzITchdNlbg…"），就是 /ns sm 值
```

### 平台差异

| 平台 | 用 /ns? | 字段在 EV |
|---|---|---|
| iFood | ✅ 用 | EV2 含 BzdyfUJXdks= (/ns sm) + DFg5Ekk4PSU= (/ns duration) |
| Grubhub | ❌ 不用 | grep 不到 tzm.px-cloud.net |

**判断方法**：

```bash
[ "$(grep -c 'tzm.px-cloud.net' sdk.js)" -ge 1 ] && echo "用 /ns" || echo "不用 /ns"
```

---

## 3. OB 调度器（解码响应的核心函数）

把服务器返回的 `ob` 字段解开，跑 27 个 handler。

### 怎么定位（两种部署风格）

#### 风格 A：集中调度（iFood）

```bash
# 找 split("|") 紧跟 shift()
grep -boE 'split\("\|"\)[^;]{0,40}shift' sdk.js
# → 命中 1 处 = 集中调度器（iFood 叫 yU 函数）
```

那一行附近的 50 行就是 OB 主调度逻辑：

```js
// iFood (yU 函数等价物)
function ??(t, n) {
    for (var h = 0; h < t.length; h++) {
        var o = t[h].split("|"),   ← 命中的 grep
            c = o.shift(),          ← handler wire 字节
            a = registry[c];        ← 查表
        // ... 执行 handler
    }
}
```

#### 风格 B：分散调度（Grubhub）

```bash
# Grubhub 的 split("|") 是间接调用 r(n.y) 这种，grep 不到字面
# 改用：找 .do || .ob 处理逻辑
grep -boE '\.do\s*\|\|\s*\.ob|\.ob\)\s*\[' sdk.js
# → 命中 OB 入口（Grubhub 叫 Tf/Sf/wf/Af/Rf 多个函数）
```

### 怎么验证

```bash
# 用解码器对一批真实 sample 跑通
node skill/AI_re/scripts/decode_response.js "<TAG>" /path/to/response_1.json
# 期望输出: { "state": { "no": "...", "to": "...", ... }, "segments": [...] }
```

如果 state.* 字段都解出来了 → OB 调度器对了。

---

## 4. 27 OB Handler 注册表

集中型部署有一个对象，键是 wire 字节，值是 handler 函数：

```bash
# iFood 风格：字面 wire 字节注册
grep -boE 'SP\["[0Il1o]{6,10}"\]' sdk.js | head -10
# → SP["00l00l"]=za, SP["0lllll"]=zj, ...

# 或更通用的（找任何对象+wire字节键）
grep -boE '\["?(I|0|o|l|1){6,}"?\]\s*=\s*[a-zA-Z_]+' sdk.js | head -20
```

### handler 形状匹配（跨版本通用）

⚠️ **不要用 wire 字节识别 handler**（如 `0lll0l`）— 每个版本可能换。
**用参数形状识别**：

| handler 语义 | 参数形状 |
|---|---|
| state.no (服务器时间戳) | 1 arg, `/^1[5-9]\d{11}$/` |
| state.qa (challenge_hash) | 1 arg, `/^[0-9a-f]{64}$/` |
| state.pxsid | 1 arg, UUID |
| **set_cookie** | **4+ args, 第 1 arg `/^_?px/i`** |
| state.to (session_token) | 1 arg, `/^[A-Za-z0-9]{16,}$/` |
| state.appId (bundle) | 1 arg, `/^[a-z0-9]{12,30}$/` |
| state.jf (control_flag) | 1 arg, `/^[a-z]{2,4}$/` |

完整表见 [`../references/handler-table.md`](../references/handler-table.md)。

---

## 5. 事件构造主入口（mh / 等价物）

构造 POST 请求的核心函数 — 它把 events + state 组合成最终的 collector POST。

### 怎么定位

```bash
# 它必然组装 POST 参数 payload= appId= pc= sid= 等
grep -nE '"payload="|"&payload=' sdk.js
grep -nE '"&pc=|"&cs=|"&sid=|"&uuid="' sdk.js
grep -nE '"appId="' sdk.js
```

通常这几行在同一个函数体内（POST body 字符串拼接逻辑）。

### 函数特征

```js
// 典型 mh 函数体（iFood 叫 mh）
function ??(events, config) {
    // 1. 把 events 加密成 payload
    var payload = Jf(events, ...);

    // 2. 算 PC
    var pc = jt(serialize(events), salt);

    // 3. 算 sid
    var sid = uuid + hh(state.no);

    // 4. 拼 POST body
    var body = "payload=" + encode(payload) +
               "&appId=" + APP_ID +
               "&tag=" + TAG +
               "&ft=" + FT +
               "&pc=" + pc +
               "&sid=" + sid +
               ...;

    // 5. 发 HTTPS POST
    fetch(collector_url, { method: 'POST', body: body });
}
```

### 怎么验证

它是**调用入口**，往上追：

```bash
# 看谁调用了它（mh 在 SDK 通常是被 setTimeout/setInterval 触发）
grep -nE '\bsetTimeout\([a-zA-Z_]+,' sdk.js | head -5
# 看哪个 setTimeout 的第一个参数指向 mh
```

---

## 6. 指纹采集主入口（Dd / 等价物）

收集 200+ 字段的核心函数。它会连续调用一组短名子函数，每个采集一组字段。

### 怎么定位

```bash
# 连续短名函数调用（typical 5-15 个连续）
grep -nE '\b[a-z]{1,3}\(t\);\s*[a-z]{1,3}\(t\);\s*[a-z]{1,3}\(t\)' sdk.js | head -5
```

### 函数特征

```js
function Dd(t) {
    ev(t);    // 安全检测一组
    nv(t);    // 浏览器属性一组
    av(t);    // 屏幕一组
    ov(t);    // navigator 一组
    iv(t);    // 插件一组
    cv(t);    // 字体一组
    $d(t);    // anti-tamper
    // ... 等等
}
```

### 怎么用它

知道 Dd 在哪后，**沿着它调用的函数链找每个字段的来源** — 这才能定位
"`d['XXX=']` 字段的值是从哪里来的"。详见 [`locate-field-sources.md`](locate-field-sources.md)。

---

## 7. Cookie 读写工具（ur / lr）

PX 自己实现的 cookie 读写函数（不直接用 `document.cookie`）。

### 怎么定位

```bash
# 找 document.cookie 操作
grep -nE 'document\.cookie\s*[=]|document\.cookie\s*\)' sdk.js
```

通常会命中 2 处：

```js
// ur(name) — 读 cookie
function ??(t) {
    var ck = document.cookie;
    // ... 从 ck 字符串里找 name= 的值
    return value;
}

// lr(name, value, ttl, opts) — 写 cookie
function ??(t, e, n, r) {
    document.cookie = t + "=" + e + "; expires=" + ...;
}
```

### 怎么验证

```js
// 用 SDK 的 ur('_px3') 应能读出当前 _px3 值
// 用 SDK 的 lr('_pxhd', value, ttl) 应写入 cookie
```

---

---

## ⚠️ 以下 §8 §9 是 Bundle 路径（按压挑战）才用

如果你逆向**无感 collector 路径**（99% 场景），到这里**就停**。
往下是 PX 风险评分超阈值后才触发的 Bundle（按压挑战）路径。需要的话再看。

---

## 8. PoW 求解器（仅 Bundle 路径，在 captcha.js）

Bundle 路径（按压挑战）才有。**main.min.js 里没有，无感场景不需要**。

### 怎么定位

```bash
grep -nE 'crypto\.subtle\.digest\("SHA-256"' captcha.js
grep -nE 'for\s*\([^)]*<<\s*1[56]' captcha.js   # 难度 16 的循环 mask
grep -nE '0xFFFF' captcha.js                      # 16-bit mask
```

### 函数特征

```js
// PoW 主函数 poi() 等价物
function ??(target, suffix, difficulty) {
    for (var i = 0; i < (1 << difficulty); i++) {
        var candidate = suffix + ('0000' + i.toString(16)).slice(-4);
        if (sha256(candidate) === target) return candidate;
    }
}
```

---

## 9. WASM 加载器（仅 Bundle 路径，在 captcha.js）

**main.min.js 里没有 WASM，无感场景不需要碰 WASM**。

### 怎么定位

```bash
grep -nE 'WebAssembly\.instantiate' captcha.js
grep -nE 'Us\(\)\[10\]' captcha.js   # 字典里第 10 项是 WASM b64
grep -nE '"\\\\x00asm"\|"\\u0000asm"' captcha.js   # WASM magic
```

### 函数体特征

```js
const wasmB64 = Us()[10];   // 从字典取 WASM base64
const wasmBin = atob(wasmB64);   // base64 → binary
WebAssembly.instantiate(wasmBin, imports).then(...);
```

---

## 一行命令：全 9 类函数同时探测

```bash
#!/bin/bash
SDK="path/to/main.min.js"
CAPTCHA="path/to/captcha.js"  # 可选

echo "═══ SDK 函数定位探测 ═══"
echo ""
echo "[main.min.js]"
echo "  hQ 字典三件套:"
echo "    base91 字母表 F@bt:    $(grep -c F@bt $SDK)"
echo "    hP 数组:              $(grep -c 'hP\s*=\s*\[' $SDK)"
echo "    void 0 === 缓存模式:  $(grep -cE 'void\s+0\s*===' $SDK)"
echo ""
echo "  /ns 探针:               $(grep -c 'tzm.px-cloud.net' $SDK)"
echo "  OB 集中调度:            $(grep -cE 'split\(\"\\|\"\)[^;]{0,40}shift' $SDK)"
echo "  OB 分散调度:            $(grep -cE '\.do\s*\|\|\s*\.ob' $SDK)"
echo "  27 handler 注册:        $(grep -cE 'SP\[\"[0Il1o]{6,10}\"\]' $SDK)"
echo "  事件构造 (payload=):    $(grep -cE '\"payload=\"|\"&payload=' $SDK)"
echo "  指纹采集 (连续调用):    $(grep -cE '\b[a-z]{1,3}\(t\);\s*[a-z]{1,3}\(t\);' $SDK | head -1)"
echo "  cookie 读写:            $(grep -c 'document.cookie' $SDK)"
echo ""
if [ -f "$CAPTCHA" ]; then
    echo "[captcha.js (Bundle 路径)]"
    echo "  PoW SHA-256:          $(grep -c 'crypto.subtle.digest..SHA-256' $CAPTCHA)"
    echo "  WASM 加载:             $(grep -c 'WebAssembly.instantiate' $CAPTCHA)"
fi
```

**典型输出（iFood 2026-05）**：

```
[main.min.js]
  hQ 字典三件套:
    base91 字母表 F@bt:    1
    hP 数组:              1
    void 0 === 缓存模式:  ~5
  /ns 探针:               1
  OB 集中调度:            1     ← iFood 是集中型
  OB 分散调度:            0
  27 handler 注册:        ~17   ← 字面注册 17 个，其它通过 hQ 引用
  事件构造 (payload=):    1
  指纹采集 (连续调用):    1
  cookie 读写:            2     ← 一读一写
```

如果 grep 全过 → 函数布局跟 iFood 一致，可以直接借鉴 iFood 的 generator 改改常量即可。

---

## 跨版本稳定性矩阵

| 函数 | iFood vs Grubhub | iFood 新版 vs 旧版 | 跨年 |
|---|---|---|---|
| hQ 字典 | 都用，字母表相同 | 都用，字母表相同 | ✅ |
| /ns 探针 | iFood 用，Grubhub 不用 | iFood 始终用 | ✅ |
| OB 调度结构 | iFood 集中 vs Grubhub 分散 | 同厂家稳定 | ✅ |
| 27 handler | 完全相同 | 完全相同 | ✅ |
| 事件构造 mh | 完全相同（POST 字段集） | 完全相同 | ✅ |
| 指纹采集 Dd | 字段数差，但结构同 | 字段数偶变 | ✅ |
| cookie ur/lr | 完全相同（document.cookie API） | 完全相同 | ✅ |
| PoW（仅 captcha） | iFood 触发过 | iFood 始终有 | ✅ |
| WASM（仅 captcha） | iFood 触发过 | iFood 始终有 | ✅ |

---

## 决策树：拿到新 SDK 后

```
跑全 9 类函数探测脚本
  │
  ├─ 9 类全部命中
  │     → 标准 PX SDK，可以走 build-generator.md
  │
  ├─ /ns 探针不命中
  │     → 像 Grubhub，generator 里把 /ns 字段省了
  │
  ├─ OB 集中调度命中 0 但分散调度命中
  │     → 像 Grubhub，OB 处理逻辑在多个函数里
  │       → 用形状匹配解码，不用看 handler 名
  │
  ├─ 27 handler 注册命中 ≪ 17
  │     → 该 SDK 把 handler 也通过 hQ 引用了
  │       → 先 dump hQ 字典再回过来对照
  │
  └─ 几乎全部不命中
        → 不是 PX SDK（去看 Akamai / DataDome）
        → 或 PX 推了大改版（3 年没见过）
```

---

## 配套资源

| 想看什么 | 去哪 |
|---|---|
| 算法层（MD5/HMAC/等）逆向 | [`reverse-algorithms.md`](reverse-algorithms.md) |
| 常量定位 | [`locate-all-constants.md`](locate-all-constants.md) |
| **字段值来源定位**（每个字段从哪算来） | [`locate-field-sources.md`](locate-field-sources.md) |
| 27 handler 完整表 | [`../references/handler-table.md`](../references/handler-table.md) |
| 完整 grep 模式索引 | [`../references/locate-by-pattern.md`](../references/locate-by-pattern.md) |

---

*这 9 类函数 + 9 个算法 = 完整 SDK 函数地图。任何新 PX SDK，用本 playbook
30-60 分钟能定位所有关键位置。*
