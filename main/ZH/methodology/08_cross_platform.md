# Stage 8（可选）：跨平台移植

> **时间预算**：每个目标语言 ~1-2 天
> **产出**：把 9 个算法模块（`revers/`）从 Node 移植到目标语言
> *融合*: B/08_cross_platform + C/§8（轻量提及）

---

## 8.1 该不该移植

Node 生态已经能跑大部分场景（高吞吐 fetch、CDP、worker_threads 多核）。**移植的理由**：

| 场景 | 建议 |
|---|---|
| 已有 Go 微服务架构 | 移植到 Go，避免引入 Node 维护负担 |
| 跟 Python 数据科学栈集成 | 移植到 Python |
| iOS/Android 客户端内嵌 | 移植到 Swift/Kotlin |
| 高吞吐 + 内存敏感 | 移植到 Rust/Go |
| 一次性脚本，吞吐不大 | **不移植**，直接 Node |

---

## 8.2 移植矩阵：9 模块跨语言难度

| 模块 | Node | Python | Go | C# | Rust |
|---|---|---|---|---|---|
| payload (XOR+b64+interleave) | 基线 | ⭐ 1h | ⭐⭐ 2h | ⭐ 1h | ⭐⭐ 2h |
| pc (HMAC-MD5+digit) | 基线 | ⭐ 1h | ⭐ 1h | ⭐ 1h | ⭐ 1h |
| ob (decode + 27 handlers) | 基线 | ⭐⭐ 3h | ⭐⭐ 3h | ⭐⭐ 3h | ⭐⭐⭐ 4h |
| sid (Unicode Variation-Selector steg) | 基线 | ⭐ 1h | ⭐⭐ 2h | ⭐⭐ 2h | ⭐⭐ 2h |
| uuid v1 (PX 兼容) | 基线 | ⭐ 30min | ⭐ 30min | ⭐ 30min | ⭐ 30min |
| hash (djb2 + ml) | 基线 | ⭐ 30min | ⭐ 30min | ⭐ 30min | ⭐ 30min |
| memory (synth) | 基线 | ⭐ 30min | ⭐ 30min | ⭐ 30min | ⭐ 30min |
| antitamper (XOR key/value) | 基线 | ⭐ 30min | ⭐ 30min | ⭐ 30min | ⭐ 30min |
| ns (probe) | 基线 | ⭐ 1h | ⭐ 1h | ⭐ 1h | ⭐ 1h |
| **总计** | — | **~10 h** | **~12 h** | **~10 h** | **~14 h** |

注：⭐=easy / ⭐⭐=medium / ⭐⭐⭐=hard

---

## 8.3 关键移植陷阱

### 8.3.1 base64 编码字节序

**Node `Buffer.from(str, 'utf-8').toString('base64')`** 和 **Python `base64.b64encode(s.encode('utf-8'))`** 输出一致。但：

- **Java `Base64.getEncoder().encode(s.getBytes("UTF-8"))`** 也一致
- ⚠️ 但 **Go `base64.StdEncoding.EncodeToString([]byte(s))`** 默认行为 OK，注意 URL-safe variant 别错用

### 8.3.2 整数溢出

PX 使用 32 位有符号整数：

```javascript
// Node — 自动 32-bit wraparound on bitwise
(1 << 31) === -2147483648   // true (JavaScript 把 bitwise 当 32-bit signed)
```

```python
# Python — 任意精度，需手动 mask
((1 << 31) & 0xFFFFFFFF) == 2147483648   # 不是 -2147483648
# 需要这样:
def to_int32(n):
    n &= 0xFFFFFFFF
    if n >= 0x80000000: n -= 0x100000000
    return n
```

```go
// Go — 必须明确类型
var n int32 = int32(1 << 31)   // 编译错: out of range
var n int32 = -2147483648      // OK
```

**移植到 Python/Go 时必检**：MD5 / HMAC / ml() / djb2 中的 bit 操作。

### 8.3.3 String charCodeAt vs ord vs []byte[i]

```javascript
// Node
"abc".charCodeAt(0)  // 97
```

```python
# Python
ord("abc"[0])  # 97
# 但 — 中文字符：
ord("中")  # 20013, 不是 utf-8 byte
# JavaScript 也是 UTF-16 code unit，所以中文行为类似
```

```go
// Go — strings 是 byte 不是 rune
"abc"[0]  // 97 (byte)
// 但中文:
"中"[0]   // 228 (E4 — UTF-8 第一字节)
// 要拿 codepoint:
[]rune("中")[0]  // 20013
```

PX 的 XOR 和 charCodeAt 操作**都是基于 UTF-16 code units**（不是 UTF-8 bytes）。Go 移植必须明确转 `[]rune`，否则中文 / emoji 会算错。

### 8.3.4 时间 API

```javascript
Date.now()                        // 13-digit ms
performance.now()                 // 高精度 ms (浮点)
new Date().toString()             // "Tue Nov 25 2026 14:32:18 GMT+0800 (..."
```

```python
import time
int(time.time() * 1000)           # 13-digit ms
time.perf_counter() * 1000        # 高精度 ms
```

注意 `new Date().toString()` 在 Node/Browser 输出格式**完全一致**，但 Python 没有内置等价物。移植时要手写格式化。

### 8.3.5 PX 自定义 serialize

PX 的 `serialize()` 必须**逐字节复刻**到目标语言。最大的坑：

```javascript
// JavaScript
{a: undefined}  → '{"a":"undefined"}'   // PX 不丢 key，且 undefined 加引号
NaN             → "null"
new RegExp()    → "null"
```

```python
# Python 必须仿造
def px_serialize(obj):
    if obj is None: return "null"
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)): return "null"
    # ... 等等
```

**这是移植里最容易写出 silent bug 的地方**，建议跨语言跑同输入做字节比对。

---

## 8.4 移植测试策略

```
1. Node 版作为"金标准"先跑通（Stage 1-7 ✓）
2. 准备 10 组 (input, expected_output) test vectors
3. 目标语言实现，喂同样 input
4. assert 输出字节相等
5. 跑 100 组随机 input 做模糊测试（pre-generate 100 个 UUID/state，两边各算）
```

具体做法：预生成固定的 UUID/state 输入，两边各算后断言字节相等（对照 [`revers/`](../../../revers/) 的 Node 参考实现）。

---

## 8.5 简单的移植样板（Python）

为了让你 1 小时跑通：

```python
# requirements.txt
# pycryptodome  # MD5/HMAC
# requests      # HTTP

import hashlib
import hmac
import base64
import json
import time
import random
import uuid

# === payload.py ===
PX_XOR_KEY = 50

def px_serialize(obj):
    # 仿 JavaScript JSON.stringify + PX 自定义
    # ...略，需复刻 Node revers/payload.js 的逻辑
    pass

def encrypt_payload(json_str, tag):
    xor_key = int(ml(tag)) % 128
    xored = ''.join(chr(ord(c) ^ xor_key) for c in json_str)
    b64 = base64.b64encode(xored.encode('utf-8')).decode('ascii')
    # 加 interleave
    # ...
    return b64

def ml(tag):
    n = 0
    for c in tag:
        n = (31 * n + ord(c)) % 2147483647
    return str(n)

# === pc.py ===
def compute_pc(payload, tag):
    h = hmac.new(tag.encode('utf-8'), payload.encode('utf-8'), hashlib.md5).hexdigest()
    digits = ''.join(c for c in h if c.isdigit())
    return digits[:16].ljust(16, '0')

# === uuid.py ===
def uuid_v1():
    return str(uuid.uuid1())   # Python 标准库的 v1 大致兼容
    # 但 clockseq 行为不完全一致，PX 自己用 random
```

完整的 Python 移植（9 个模块）属后续工作（计划放在 `skill/AI_re/scripts/py_port/`），欢迎 PR。

---

## 8.6 跨语言 CI 策略

```yaml
# .github/workflows/cross-port.yml
- name: Node baseline
  run: node revers/test/golden.js > out_node.json
- name: Python port
  run: python revers_py/test/golden.py > out_py.json
- name: Diff
  run: diff out_node.json out_py.json
```

CI 跑一遍就知道任一语言是不是跟 Node baseline 一致。

---

## 8.7 移植到 Python 的实战例子（iFood）

(略 — 仅做框架性提示，真正动手再展开)

---

## 8.8 Stage 8 完成标准 ✓

| 项 | 验证 |
|---|---|
| ✅ 目标语言能跑通 generator | _px3 拿到 |
| ✅ 跟 Node baseline 字节相等 | 100 组 test vectors 全过 |
| ✅ 业务 API 调通 | 200 |
| ✅ 跨 IP / UA 稳定 | 跟 Node 版同等性能 |

---

## 8.9 进入 Stage 9

→ [Stage 9: SDK 升级响应](09_sdk_upgrade.md)
