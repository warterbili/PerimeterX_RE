# Playbook: 5 个常量在 SDK 源码里的统一定位方法学

> 给任意 PX SDK 文件，**5 分钟内**找到全部 5 个常量（AppID / TAG / FT / BI /
> Cookie 名 + GT/Collector URL）。
>
> 核心原则：**用跨版本稳定的特征**做锚点，不依赖变量名 / 行号。

---

## 总览：5 个常量怎么找

| 常量 | 长度 | 跨版本稳定特征 | 一行 grep |
|---|---|---|---|
| **AppID** | 10-13 字符 | `"PX"` 前缀 + 8-15 字符 ID | `grep -boE '"PX[A-Za-z0-9]{8,15}"' sdk.js` |
| **TAG** | 12-20 字符（base64 with `==`） | 跟 AppID 同 `var` 声明 | 由 AppID 推（见下文） |
| **FT** | 3 位数字（字符串） | 同 `var` 声明里的数字字符串 | `grep -oE '"(330\|388\|401\|359\|421)"' sdk.js` |
| **BI** | 100-200 字符 base64 | 跟 AppID 同 `var` 声明，最长 base64 | 由 AppID 推（见下文） |
| **Cookie 名** | `_px2` / `_px3` | OB 响应的 set_cookie 段第一个参数 | `grep -boE '"_px[0-9]"' sdk.js` |
| **GT (OB XOR key 种子)** | 12-20 字符 base64 | `ml(...)` 调用的参数 | `grep -oE 'ml\(\s*"[A-Za-z0-9+/=]{8,}=' sdk.js` |
| **Collector URL** | URL | 直接字面量 或 base64 形式 | `grep -boE '"/api/v2/collector"' sdk.js` |

---

## 核心心智模型

PX 把 4-5 个常量打包在**同一行 `var` 声明**（这是 PX build pipeline 写死的，
3 年没变过）：

```js
var jE = "U0MmDhUmOnhXSw==",                          // TAG (12-20 字符)
    jF = "401",                                         // FT (3 位数字字符串)
    jG = "PXO1GDTa7Q",                                   // AppID ("PX" 前缀)
    jH = "EwNmQ0Y0IWJVVwZmCl9aYBIqdAQCBilm...",         // BI (100-200 字符 base64)
    jI;                                                  // 占位
```

变量名 `jE/jF/jG/jH/jI` 每次混淆会换，但**结构永远是这样**：

- 5 个变量声明在一起，逗号分隔
- 中间夹 4 个 string literal + 1 个 undefined（最后那个 `jI`）
- 顺序：TAG → FT → AppID → BI

**结论：找到 AppID 就找到全部 4 个常量**。

---

## 步骤 1：定位 AppID（锚点）

### 方法 1.1：用 PX 业务前缀（最稳）

```bash
grep -boE '"PX[A-Za-z0-9]{8,15}"' sdk.js | head -3
# 输出:
#   175:"PXO1GDTa7Q"
```

**为什么稳定**：PX 给客户的 AppID 永远是 `PX` + 8-15 字符。**3 年内未见过例外**。

### 方法 1.2：搜全局暴露（部分平台才有）

```bash
grep -boE 'window\._pxAppId\s*=\s*"[^"]+"' sdk.js
# 输出 (Grubhub):
#   139:window._pxAppId="PXO97ybH4J"
```

Grubhub 风格把 AppID 暴露在 `window._pxAppId`，方便客户排查。iFood 没有。

### 方法 1.3：从 collector URL 反推

```bash
grep -boE '"https?://collector-[a-z0-9]+\.px-cloud\.net/' sdk.js
# 或 sensor.<host>.com
```

主机名 = `collector-<AppID 小写>.px-cloud.net`，从 URL 反推 AppID。

---

## 步骤 2：从 AppID 位置往后看，定位 TAG / FT / BI

拿到 AppID 字节位置后，**往后看 300-500 字节** 就是 TAG/FT/BI 全部：

```bash
# 1. 拿到 AppID 字节位置
APP_POS=$(grep -boE '"PXO1GDTa7Q"' sdk.js | head -1 | cut -d: -f1)

# 2. 看 AppID 前 400 字节 (TAG/FT 在前) + 后 300 字节 (BI 在后)
dd if=sdk.js bs=1 skip=$((APP_POS - 400)) count=700 2>/dev/null
```

实际输出（iFood）：

```
var jE="U0MmDhUmOnhXSw==",jF="401",jG="PXO1GDTa7Q",jH="EwNmQ0Y0IWJVVwZmCl9aYBIqdAQCBilm...",jI;
   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   TAG                          FT      AppID            BI（长的那个）
```

一次性提取 4 个：

```bash
# 字段切割
dd if=sdk.js bs=1 skip=$((APP_POS - 400)) count=700 2>/dev/null \
  | grep -oE 'var\s+\w+="[^"]+","[^"]+","[^"]+","[^"]+"' \
  | head -1
# → var jE="TAG",jF="FT",jG="AppID",jH="BI"
```

---

## 步骤 3：定位 GT（OB XOR key 种子）

GT 是 OB 响应解码的 XOR key seed，**不是 TAG**（但很多 SDK 巧合两者相同，
所以容易混淆）。GT 是 `ml()` 函数的输入参数。

### 方法 3.1：grep `ml(...)` 调用

```bash
grep -oE 'ml\(\s*"[A-Za-z0-9+/=]{8,}=' sdk.js | head -3
# 输出:
#   ml("DhY8E0h7J2cKHw==
```

### 方法 3.2：从抓包反推

如果 GT grep 不出来（可能 `ml` 名字混淆了），可以反推：

```bash
# 用候选 base64 常量算 ml(x) % 128，看哪个等于真实 OB XOR key
for candidate in <list-of-base64-constants-from-SDK>; do
    key=$(node -e "
        const ml = require('revers/ob').ml;
        console.log(parseInt(ml('$candidate'), 10) % 128);
    ")
    echo "GT 候选 '$candidate' → XOR key = $key"
done
```

**iFood 实测**：GT = TAG = `U0MmDhUmOnhXSw==`，但**不是所有 SDK 都这样**（旧版有 GT ≠ TAG）。

---

## 步骤 4：定位 Cookie 名

### 方法 4.1：直接 grep `_pxN`

```bash
grep -boE '"_px[0-9]"' sdk.js | head -5
# 输出:
#   ...:"_px3"
#   ...:"_px2"
#   ...:"_pxhd"     ← 这个是 history cookie 不是主 cookie
#   ...:"_pxvid"    ← visitor ID cookie
```

通常 SDK 同时含 `_px2` 和 `_px3`（兼容代码），**主 cookie 看哪个被 set_cookie handler 用**。

### 方法 4.2：从 OB#2 响应 set_cookie 段确认

```bash
node skill/AI_re/scripts/decode_response.js "<TAG>" /path/to/response_2.json
# 输出含: { "segments": [..., { args: ["_px3", "330", "eyJ1..."] }, ...] }
```

set_cookie 段第一个参数就是当前实际用的 cookie 名。

---

## 步骤 5：定位 Collector URL

### 方法 5.1：grep 明文

```bash
grep -boE '"https://collector-[a-z0-9]+\.px-cloud\.net/api/v2/collector"' sdk.js
grep -boE '"/api/v2/collector"' sdk.js
```

### 方法 5.2：grep base64 形式（Grubhub 风格）

```bash
# "/api/v2/collector" 的 base64 = L2FwaS92Mi9jb2xsZWN0b3I=
grep -boE 'L2FwaS92Mi9jb2xsZWN0b3I' sdk.js
```

部分平台（Grubhub）把端点 URL **同时存明文 + base64** — 后者可能用于
某些防扫描的场合。

---

## 跨厂家对比（证明方法跨版本通用）

### iFood (2026-05)

```js
// 一行包 4 个常量
var jE="U0MmDhUmOnhXSw==",jF="401",jG="PXO1GDTa7Q",jH="EwNm...",jI;
```

| 常量 | 值 |
|---|---|
| AppID | `PXO1GDTa7Q` |
| TAG | `U0MmDhUmOnhXSw==` |
| FT | `401` |
| BI | `EwNmQ0Y0IWJVVwZm...` (136 chars) |
| GT | `U0MmDhUmOnhXSw==` (= TAG) |
| Cookie | `_px3` |

### Grubhub (2026-05)

```js
// 全局暴露 AppID
window._pxAppId = "PXO97ybH4J"
// 其它常量分散（不在一个 var 里！这是厂家差异）
yt = "FmYgK1gdJEAP"   // TAG（单独一行）
gt = "359"             // FT
bt = "PXO97ybH4J"       // AppID 重复
```

| 常量 | 值 |
|---|---|
| AppID | `PXO97ybH4J` |
| TAG | `FmYgK1gdJEAP` |
| FT | `359` |
| BI | （Grubhub 部分 SDK 没有 BI 字段） |
| Cookie | `_px2` |

**关键观察**：

- ✅ AppID 始终用 `"PX..."` 前缀 → grep 跨版本稳定
- ✅ TAG / FT 字符特征跨版本不变（base64 with `==` / 3 位数字）
- ⚠️ **打包方式厂家有差异**（iFood 一行 4 个，Grubhub 分散）
- ⚠️ BI **不是所有平台都有**（Grubhub 部分配置可省）

---

## 一行命令：完整 5 常量提取（iFood 风格）

```bash
SDK="path/to/main.min.js"

# AppID
APP_ID=$(grep -oE '"PX[A-Za-z0-9]{8,15}"' "$SDK" | head -1 | tr -d '"')
echo "AppID: $APP_ID"

# 从 AppID 字节位置往前看 400 字节 + 后 300 字节
APP_POS=$(grep -boE '"'$APP_ID'"' "$SDK" | head -1 | cut -d: -f1)
RANGE=$(dd if="$SDK" bs=1 skip=$((APP_POS - 400)) count=700 2>/dev/null)

# TAG (第一个 base64 ending in ==)
TAG=$(echo "$RANGE" | grep -oE '"[A-Za-z0-9+/]{12,}=="' | head -1 | tr -d '"')
echo "TAG: $TAG"

# FT (3 位数字字符串)
FT=$(echo "$RANGE" | grep -oE '"(330|388|401|359|421|330|421)"' | head -1 | tr -d '"')
echo "FT:  $FT"

# BI (最长的 base64)
BI=$(echo "$RANGE" | grep -oE '"[A-Za-z0-9+/=]{100,200}=="' | head -1 | tr -d '"')
echo "BI:  $(echo $BI | cut -c1-30)... ($(echo -n $BI | wc -c) chars)"

# Cookie 名
COOKIE=$(grep -boE '"_px[0-9]"' "$SDK" | head -1 | sed 's/.*"_px\([0-9]\)"/_px\1/')
echo "Cookie: $COOKIE"
```

**典型输出（iFood 2026-05）**：

```
AppID: PXO1GDTa7Q
TAG: U0MmDhUmOnhXSw==
FT:  401
BI:  EwNmQ0Y0IWJVVwZmCl9aYBIqdAQCBilm... (136 chars)
Cookie: _px3
```

---

## 决策树：如果某个常量 grep 不出来

```
没找到 AppID？
  ├─ "PX" 前缀正则没命中
  │     → 试 window._pxAppId
  │     → 还没有就从 SDK 加载 URL 路径反推
  └─ 多个候选
        → 跟 collector URL 路径里的小写部分对比，挑匹配的

没找到 TAG？
  ├─ AppID 字节位置往前 400 字节有 base64 with == 吗
  │     → 有 → 那就是 TAG
  ├─ Grubhub 风格分散，AppID 附近没有 TAG
  │     → 在 SDK 全局搜独立 var：
  │       grep -oE 'var\s+\w{1,3}\s*=\s*"[A-Za-z0-9+/]{8,16}=="' sdk.js
  └─ TAG 也可能不在源码里，要从 collector POST 抓
        → 步骤 2：抓 collector POST 看 tag= 参数

没找到 FT？
  ├─ 在 AppID 附近往前找 "3 位数字字符串"
  │     → 通常 330/359/388/401/421 之一
  └─ 全局搜：grep -oE '"[0-9]{3}"' sdk.js | sort -u
        → 看哪个候选数字"语义"对（FT 跟 collector URL 风格相关）

没找到 BI？
  ├─ AppID 附近 300 字节有 100+ 字符 base64 吗
  │     → 有 → 就是 BI
  └─ 真没有
        → 部分 PX 配置不发 bi= 字段
        → 看真抓 POST：grep -oE 'bi=[^&]+' real_request.txt
          没结果 = 这个 PX 部署不用 BI

没找到 Cookie 名？
  ├─ grep '_px2' / '_px3' 都没命中
  │     → SDK 用 hQ 字典间接引用，需先提 hQ
  └─ 命中 _px2 和 _px3 各一次
        → 看 set_cookie handler 实际写哪个
```

---

## 跨版本稳定性总结

| 常量 | 跨版本稳定 | 跨厂家稳定 | 定位难度 |
|---|---|---|---|
| AppID | ✅ "PX" 前缀写死 | ✅ | ⭐ 最易 |
| TAG | ✅ base64 + `==` 结尾 | ✅ | ⭐⭐ 易（找到 AppID 即得） |
| FT | ✅ 3 位数字字符串 | ✅ | ⭐⭐ 易 |
| BI | ✅ 100+ 字符 base64 | ⚠️ 部分平台无 | ⭐⭐ 易 |
| Cookie 名 | ⚠️ 跨大版本 _px2 → _px3 | ✅ | ⭐ 最易 |
| GT (OB XOR seed) | ✅ ml() 输入 | ✅ | ⭐⭐⭐ 中（部分要反推） |
| Collector URL | ✅ 字面量 或 base64 | ✅ | ⭐ 最易 |

---

## 配套资源

| 想看什么 | 去哪 |
|---|---|
| 真实 iFood vs Grubhub 对照 | [`../../../main/ZH/PX_完整SDK对照逆向方法论.md`](../../../main/ZH/PX_完整SDK对照逆向方法论.md) §4 |
| 怎么从抓包提常量（运行时） | [`extract-constants.md`](extract-constants.md) |
| 怎么判断 SDK 是不是 PX | [`identify-sdk-version.md`](identify-sdk-version.md) |
| 完整 grep 模式索引 | [`../references/locate-by-pattern.md`](../references/locate-by-pattern.md) |

---

*这套方法 3 年内对所有观察过的 PX SDK 都适用（iFood、Grubhub、跨季度的 SDK 升级）。
如果哪个常量 grep 不出来，先看决策树，再考虑可能是 PX 整体重构（极少）。*
