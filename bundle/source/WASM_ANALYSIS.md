# PX Captcha WASM 完整分析

## 1. 概览

PerimeterX 在人机验证（captcha）阶段使用一个 Rust 编译的 WASM 模块，提供两个核心导出函数：

| 导出函数 | PX 标识 | 签名 | 用途 |
|---------|---------|------|------|
| `a()` | PX12590 | `() → string` | 生成指纹/哈希字符串 |
| `b(input)` | PX12610 | `(string) → string` | 验证计算，依赖 `window._pxUuid` |

WASM 结果直接嵌入 Bundle #3 请求的 PX561 事件中，是通过人机验证的关键字段。

---

## 2. 二进制文件

**文件**: `px_captcha.wasm`
**大小**: 60,862 bytes
**Magic**: `00 61 73 6D` (WASM v1)

### 2.1 Section 布局

| Section | 大小 (bytes) | 说明 |
|---------|-------------|------|
| type | 170 | 24 种函数类型签名 |
| import | 1,198 | 34 个 wbg 导入 |
| function | 161 | 161 个内部函数 |
| table | 5 | 函数表 |
| memory | 3 | 线性内存 |
| global | 9 | 全局变量（栈指针等） |
| export | 138 | 8 个导出 |
| element | 151 | 函数表初始化 |
| **code** | **50,611** | **主要逻辑** |
| data | 8,255 | 静态数据/字符串 |
| custom | 123 | 调试信息 |

### 2.2 导出函数

```
a          → func[75]    # PX12590
b          → func[62]    # PX12610
memory     → memory[0]
__wbindgen_malloc            → func[115]
__wbindgen_realloc           → func[129]
__wbindgen_add_to_stack_pointer → func[175]
__wbindgen_free              → func[148]
__wbindgen_exn_store         → func[161]
```

---

## 3. 编译工具链

从 data section 的字符串泄漏确认：

- **语言**: Rust
- **编译器**: rustc `d5a82bbd26e1ad8b7401f6a718a9c57c96905483`
- **绑定**: wasm-bindgen（标准 Rust→WASM 桥接库）
- **源文件**: `src/lib.rs`

### 3.1 Rust Crate 依赖

| Crate | 版本 | 用途 |
|-------|------|------|
| `base64-simd` | 0.8.0 | Base64 编解码 |
| `rand` | 0.8.5 | 随机数生成 |
| `rand_core` | 0.6.4 | 随机核心 trait |
| `rand_chacha` | 0.3.1 | ChaCha20 CSPRNG |
| `uuid` | 1.4.0 | UUID v4 生成 |
| `getrandom` | - | 安全随机种子 |

### 3.2 关键静态字符串

```
"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"  # 标准 base64
"/=+!1@2#3$4%5^6&7*8(9)0-"                                          # 自定义编码表
"Uuxipd_"                                                            # XOR key 或 salt
"0123456789ABCDEF"                                                   # 大写 hex
"0123456789abcdef"                                                   # 小写 hex
"return this"                                                        # 获取全局对象
"crypto"                                                             # 加密 API
```

---

## 4. 导入接口 (34 个 wbg imports)

### 4.1 对象/类型操作

| Import | 签名 | 说明 |
|--------|------|------|
| `__wbindgen_string_get` | (i32, i32) → void | 从 heap 读取字符串 |
| `__wbindgen_string_new` | (i32, i32) → i32 | 创建 JS 字符串 |
| `__wbindgen_object_drop_ref` | (i32) → void | 释放 heap 引用 |
| `__wbindgen_object_clone_ref` | (i32) → i32 | 克隆引用 |
| `__wbindgen_is_object` | (i32) → i32 | 类型检查 |
| `__wbindgen_is_string` | (i32) → i32 | 类型检查 |
| `__wbindgen_is_function` | (i32) → i32 | 类型检查 |
| `__wbindgen_is_undefined` | (i32) → i32 | 类型检查 |

### 4.2 关键业务 imports

| Import | 签名 | 说明 |
|--------|------|------|
| `__wbg_instanceof_Window` | (i32) → i32 | **必须返回 1**，否则 b() 失败 |
| `__wbg_get` | (i32, i32, i32) → i32 | 读取 `obj[key]`，**用于读 `window._pxUuid`** |
| `__wbg_require` | () → i32 | 获取 Node.js require 引用 |

### 4.3 Crypto imports

| Import | 说明 |
|--------|------|
| `__wbg_crypto` | 获取 `crypto` 对象 |
| `__wbg_getRandomValues` | `crypto.getRandomValues()` |
| `__wbg_randomFillSync` | `crypto.randomFillSync()` (Node.js) |
| `__wbg_msCrypto` | IE 兼容 `msCrypto` |

### 4.4 全局环境检测

```
__wbg_self       → self
__wbg_window     → window
__wbg_globalThis → globalThis
__wbg_global     → global
```

按顺序探测运行环境（浏览器 / Web Worker / Node.js）。

### 4.5 内存操作

```
__wbg_buffer                      → ArrayBuffer
__wbg_newwithbyteoffsetandlength  → new Uint8Array(buf, off, len)
__wbg_new                         → new Uint8Array(buf)
__wbg_set                         → arr.set(src, offset)
__wbg_newwithlength               → new Uint8Array(len)
__wbg_subarray                    → arr.subarray(start, end)
__wbindgen_memory                 → wasm.memory
```

---

## 5. 函数分析

### 5.1 a() — PX12590

**调用**: `Ys.a()`
**参数**: 无
**返回**: hex 字符串

**调用约定** (wasm-bindgen retptr 模式):
```javascript
function wasmA() {
    const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
    wasm.a(retptr);                              // 结果写入 retptr
    const ptr = getInt32Memory0()[retptr / 4];   // 字符串指针
    const len = getInt32Memory0()[retptr / 4 + 1]; // 字符串长度
    return getStringFromWasm0(ptr, len);
}
```

**推测功能**:
- 使用 ChaCha20 CSPRNG 生成随机数据
- 经 base64 + hex 编码
- 每次调用结果不同（含随机成分）

### 5.2 b(input) — PX12610

**调用**: `Ys.b(Es)`
**参数**: `Es` = 字符串（来自 captcha 挑战的 hash）
**返回**: hex 字符串
**依赖**: `window._pxUuid` 必须已设置

**调用约定**:
```javascript
function wasmB(input) {
    const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
    const ptr0 = passStringToWasm0(input, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    wasm.b(retptr, ptr0, len0);                  // input 以 (ptr, len) 传入
    const ptr = getInt32Memory0()[retptr / 4];
    const len = getInt32Memory0()[retptr / 4 + 1];
    return getStringFromWasm0(ptr, len);
}
```

**推测功能**:
- 读取 `window._pxUuid`（通过 `__wbg_get(window, "_pxUuid")` import）
- 将 UUID + 输入 hash 混合运算
- 输出是 hex 编码的验证令牌
- 若 `_pxUuid` 未设置则返回空字符串

### 5.3 自定义编码表

```
/=+!1@2#3$4%5^6&7*8(9)0-
```

这个编码表在 Bundle #3 的 PX561 事件中可以看到实际使用。字段 `MD1DNnVfRgQ=` 的值包含：
```
WwxHRmkafTZyIxwTMBlGNmxDDxIHQWRYGCkhKEkRSAVeS@YvbgxuYSUQbnVqDGAQRDJ)RD$wVlpJSmcLSDw%PTw#Ji(MKloUVwZ&JBR^dxVMI@!xbnVDbSpYVAh(JSho
```

其中 `@`, `)`, `$`, `%`, `#`, `(`, `&`, `^`, `!` 全部来自这个自定义编码表。这说明 WASM 的输出（或中间处理）使用了自定义编码，将 hex/base64 映射为特殊字符混合的格式。

---

## 6. WASM 在 Bundle #3 中的使用

Bundle #3 是人机验证提交请求，其 PX561 事件（captcha core）中包含 WASM 计算结果。

### 6.1 相关字段

| 字段 (base64 key) | PX 代号 | 来源 | 值示例 |
|-------------------|---------|------|--------|
| `Slt5EA85fiI=` | PX12590 | **WASM a()** 返回值 | `440be25de15f...` (64 chars hex, 非确定性) |
| `MD1DNnVfRgQ=` | PX12573 | **WASM b(Es)** 返回值 | `WwxHRmkafTZy...@YvbgxuYSUQ...` (127 chars, 含特殊字符) |
| `AE0zBkUsPjQ=` | — | sensor 加密数据 | `b9f8af5d513c4657...` (101 chars hex) |
| `CXR6P08TfA==` | — | PoW answer = **Es** | `c3f363da449440...c2624` (64 chars hex) |
| `dgcFTDNhAXs=` | — | PoW challenge hash (targetHash) | `98e53eabe4546dc7...` (128 chars hex) |

### 6.2 数据流

```
Bundle #1 ob 响应
  ├── PoW challenge hash (dgcFTDNhAXs=) → targetHash
  └── Visual challenge hash (Slt5EA85fiI=)

PoW 求解 (Bs/poi):
  sha256(candidate) === targetHash
  → Es = candidate (PoW answer)        → CXR6P08TfA== (64 chars hex)

WASM 调用:
  Ys.a()      → PX12590 → Slt5EA85fiI= (64 chars hex, 非确定性)
  Ys.b(Es)    → PX12610 → MD1DNnVfRgQ= (127 chars 编码串, 确定性)
                   │
                   ├── 输入: Es = PoW answer
                   ├── 读取: window._pxUuid
                   ├── 运算: ChaCha20 + base64 + 自定义编码表
                   └── 输出: 含特殊字符 @$%^&!() 的编码串
```

### 6.3 captcha.js 调用链

```
用户按下验证按钮
  → onSolvedCallback
    → Ws() (captcha.js:334970)
      → controllerCallback → Qf() (captcha.js:307240)
        → PX561 事件构造
          → Ys.a()  → PX12590 结果
          → Ys.b(Es) → PX12610 结果
        → PX763 → fl() → dl() (main.min.js)
          → Bundle #3 请求发送
```

---

## 7. WASM 加载链

### 7.1 嵌入位置

WASM 二进制编码后嵌入 `captcha.js` 的字符串表函数 `Us()` 中：

```
captcha.js → Us() → array[10] → 编码后的 WASM 字符串
```

### 7.2 解码链

```
Us()[10] (编码字符串, ~80K chars)
  → ks.XWzSIG()  自定义 base64 解码 (小写在前: abcdef...xyzABCDEF...XYZ0-9+/=)
  → URI decode (decodeURIComponent)
  → 原始二进制 (60,862 bytes)
  → WebAssembly.instantiate(binary, imports)
  → WASM instance ready
```

### 7.3 captcha.js 每次加载变化

captcha.js 的文件名**每次加载都会变化**，URL 格式：
```
https://captcha.px-cdn.net/PXO1GDTa7Q/captcha.js?a=c&m=0&u={uuid}&v={version}
```

因此无法通过固定行号设断点，但 Us() 字符串表的结构是稳定的。

---

## 8. 运行环境要求

### 8.1 必须的全局变量

| 变量 | 说明 |
|------|------|
| `window._pxUuid` | PX 会话 UUID，b() 函数必需 |
| `window` / `self` | 全局对象，instanceof_Window 检查 |
| `crypto.getRandomValues` | 安全随机数生成 |

### 8.2 Node.js 环境模拟

`run_wasm.js` 通过以下方式在 Node.js 中运行 WASM：

```javascript
globalThis.self = globalThis;
globalThis.window = globalThis;
globalThis.crypto = crypto.webcrypto || {
    getRandomValues(arr) { crypto.randomFillSync(arr); return arr; }
};
globalThis._pxUuid = uuid;  // 必须设置
```

### 8.3 heap slab (wasm-bindgen 标准)

```javascript
const heap = new Array(128).fill(undefined);
heap.push(undefined, null, true, false);  // index 128-131
let heap_next = heap.length;              // 132
```

前 128 个 slot 保留，132 开始为用户对象。标准的引用计数 + 空闲链表管理。

---

## 9. 逆向要点

### 9.1 已确认

- [x] WASM 是 Rust 编译，使用 wasm-bindgen
- [x] 两个导出函数 a() 和 b()，对应 PX12590 和 PX12610
- [x] b() 依赖 `window._pxUuid`
- [x] 使用 ChaCha20 CSPRNG + base64 + hex + 自定义编码
- [x] `instanceof_Window` 必须返回 1
- [x] 34 个 wbg imports 全部已实现（run_wasm.js）
- [x] 结果写入 Bundle #3 的 PX561 事件

### 9.2 已确认的输入输出

- `Es` = **PoW 原像**（Proof of Work answer），即 `sha256(candidate) === targetHash` 的 candidate
- captcha.js 中 `Ts()` (7406-7410) 存储：`Es = answer, Js = elapsed(ms)`
- Bundle #3 中对应字段 `CXR6P08TfA==` = PoW answer (64 chars hex)
- `Slt5EA85fiI=` = PX12590 = `a()` 输出 (64 chars hex，含随机数+UUID)
- `MD1DNnVfRgQ=` = PX12573 = `b(Es)` 输出 (127 chars 编码串，Es+UUID→确定性结果)

### 9.3 待深入

- [ ] 自定义编码表 `/=+!1@2#3$4%5^6&7*8(9)0-` 的完整映射逻辑
- [ ] WASM 内部是否包含时间戳验证或防重放逻辑
- [ ] `Uuxipd_` 字符串的具体用途（可能是 XOR key）

---

## 10. 文件清单

| 文件 | 说明 | 状态 |
|------|------|------|
| `px_captcha.wasm` | WASM 二进制 (60,862 bytes) | 核心文件，保留 |
| `run_wasm.js` | Node.js WASM 运行器，模块化导出 | 核心工具，保留 |
| `extract_wasm.js` | 从 captcha.js 提取 WASM 的工具 | 保留（PX 更新时需重新提取） |

### 10.1 使用方法

**作为模块调用：**
```javascript
const { initWasm } = require('./source/wasm_captcha/run_wasm');
const { a, b } = await initWasm(uuid);
const resultA = a();           // PX12590
const resultB = b(challengeHash);  // PX12610
```

**命令行测试：**
```bash
node source/wasm_captcha/run_wasm.js <uuid> <Es>
# 示例:
node source/wasm_captcha/run_wasm.js "68303b30-1224-11f1-a20a-312c66e49e40" "440be25de15f8e8a59b590f3233558683cdf89b5df1579ae849d052a16ed2490"
```

**重新提取 WASM（PX 更新后）：**
```bash
# 先把新的 captcha.js 放到 source/captcha/ 目录
node source/wasm_captcha/extract_wasm.js
```
