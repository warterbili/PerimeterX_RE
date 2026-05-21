# Playbook: 提取 SDK 常量（APP_ID / TAG / FT / BI / Cookie 名）

> 你拿到一个**新的 PX 保护站点**，第一件事就是抓到它的 5 个协议常量：
> AppID、TAG、FT、BI（可选）、Cookie 名。
>
> 这 5 个值是后面所有逆向工作的输入。少一个 → 后面全废。
>
> 预计时间：**5-15 分钟**

---

## 你需要的输入

至少其中一个：

- **目标站点 URL**（如 `https://www.<site>.com/`）— 用 CDP 现场抓
- **一次 collector POST 抓包**（curl 文本或 .har 文件）
- **SDK 文件 main.min.js / init.js**

## 5 个常量分别是什么

| 常量 | 例子 | 用途 |
|---|---|---|
| `AppID` | `PXO1GDTa7Q` | URL 路径 + POST 参数 `appId=` |
| `TAG` | `U0MmDhUmOnhXSw==` | PC 校验 salt、OB XOR key 种子 |
| `FT` | `401` | PC 校验 salt |
| `BI` | `EwNmQ0Y0IWJVVwZmCl9aYBI…` 95+ 字节 base64 | POST 参数 `bi=`，部分平台才有 |
| `Cookie 名` | `_px3` 或 `_px2` | 最终下发的 cookie 名 |

---

## 步骤 1：先用 CDP 抓一次 collector POST（最稳）

```bash
# 启 CDP Chrome
python skill/cdp/scripts/cdp.py start

# 导航
python skill/cdp/scripts/cdp.py navigate "https://www.<目标站点>.com"

# 抓 15 秒所有 collector 流量
python skill/cdp/scripts/cdp.py network 15 | grep -E "px-cloud|sensor\." | head -10
```

输出会看到类似：

```
POST https://collector-pxo1gdta7q.px-cloud.net/api/v2/collector?seq=0&rsc=1   200
POST https://collector-pxo1gdta7q.px-cloud.net/api/v2/collector?seq=1&rsc=2   200
```

→ 从 URL 路径 `pxo1gdta7q` 就能反推 AppID = `PXO1GDTa7Q`（首字母大写 + PX 前缀）。

## 步骤 2：从 POST body 取所有 5 个常量

CDP 抓到的 POST body 形如：

```
appId=PXO1GDTa7Q&tag=U0MmDhUmOnhXSw%3D%3D&ft=401&seq=0&en=NTA&uuid=...&bi=EwNm...
```

URL-decode 后：

```
appId=PXO1GDTa7Q              ← AppID
tag=U0MmDhUmOnhXSw==           ← TAG
ft=401                          ← FT
bi=EwNmQ0Y0IWJVVwZmCl9aYBIqdA…  ← BI（如有）
```

**5 行命令搞定**：

```bash
# 假设你把 collector POST body 存到了 /tmp/post1.txt
PARAMS="/tmp/post1.txt"
echo "APP_ID: $(grep -oE 'appId=[^&]+' $PARAMS | head -1)"
echo "TAG:    $(grep -oE 'tag=[^&]+' $PARAMS | python -c 'import sys,urllib.parse;print(urllib.parse.unquote(sys.stdin.read()))')"
echo "FT:     $(grep -oE 'ft=[^&]+' $PARAMS | head -1)"
echo "BI:     $(grep -oE 'bi=[^&]+' $PARAMS | python -c 'import sys,urllib.parse;print(urllib.parse.unquote(sys.stdin.read())[:60])')"
```

> ⚠️ **注意**：用 `urllib.parse.unquote`（**不**用 `unquote_plus`） — base64 的 `+` 是字面字符，不能被替换成空格。
> 详见 [`../references/gotchas.md`](../references/gotchas.md) #5。

## 步骤 3：从抓到的响应找 Cookie 名

```bash
# response_2.json 含 OB 响应，里面有 set_cookie handler
node skill/AI_re/scripts/decode_response.js "<TAG>" /path/to/response_2.json
```

输出：

```json
{
  "state": {...},
  "segments": [
    { "handler": "000lll", "args": ["_px3", "330", "eyJ1...", "...", "..."] },
    ...
  ]
}
```

→ 看 `set_cookie` 段第一个参数：`_px3` 或 `_px2`。

## 步骤 3.5：⭐ 从 SDK 源码里定位 BI（特殊处理）

BI 跟其它 4 个常量不一样 — 它是个**长 base64 字符串**（135-140 字符），
没有像 AppID 那样的 `PX*` 前缀做锚点。但 PX 把它和 TAG/FT/AppID **打包在同
一个 var 声明里**，所以**找到 AppID 就找到 BI**：

```js
// SDK 里典型样子（PX 用 short 变量名打包 4-5 个常量）
var jE = "U0MmDhUmOnhXSw==",      // TAG
    jF = "401",                     // FT
    jG = "PXO1GDTa7Q",               // AppID
    jH = "EwNmQ0Y0IWJVVwZmCl9aYBIq...",   // ← BI（紧跟 AppID 后）
    jI;
```

### 方法 1：grep AppID 然后看后面（最稳）

```bash
# 先 grep AppID，拿到字节位置
grep -boE '"PXO1GDTa7Q"' sdk.js | head -1
# → 175:"PXO1GDTa7Q"

# 从 AppID 位置开始往后看 300 字节
dd if=sdk.js bs=1 skip=175 count=300 2>/dev/null
# → "PXO1GDTa7Q","EwNmQ0Y0IWJVVwZmCl9aYBIqdAQCBilmHx5z…"  ← BI 就在这
```

### 方法 2：直接 grep 长 base64 字面量（次稳）

```bash
# BI 是 100+ 字符 base64，TAG 通常 12-20 字符 — 长度过滤
grep -oE '"[A-Za-z0-9+/=]{100,200}=="' sdk.js | head -5
```

输出会有几个候选（含 BI 和别的长 base64 hash），人工挑挑就行 — BI
是**唯一以 `==` 结尾且 130+ 字符**的。

### 方法 3：grep 整个 var 声明（最全）

```bash
# 找一行声明 4 个常量的 var
grep -oE 'var\s+\w+\s*=\s*"[A-Za-z0-9+/=]{12,}=="[^;]{0,300}' sdk.js | head -3
```

会命中 TAG 那行（开头是 TAG），后面跟的就是 FT、AppID、BI 几个。
直接看完整原文就行。

### 跨版本观察（2026-05 vs 旧版）

| 时期 | BI 值前 30 字符 | 长度 | SDK 内变量名 |
|---|---|---|---|
| 旧版（~2024） | `dgoMBiMxRCcwUmMjb1o/JXcvEUFnA0…` | 140 | `Et = "dgoMBi…"` |
| 新版（2026-05） | `EwNmQ0Y0IWJVVwZmCl9aYBIqdAQCBilm…` | 136 | `jH = "EwNm…"` |

**关键**：

- **变量名换了**（`Et` → `jH`） — 用变量名定位不通用
- **BI 值换了**（每次 SDK 升级会轮换）
- **方法（"AppID 后跟的长 base64"）跨版本通用**

### 服务器是否真的检测 BI？

实测观察：

- 6 批抓包的 `bi=` 值**完全相同**（不是动态生成）
- 不参与 PC 计算（PC salt 是 `uuid:tag:ft`，无 bi）
- 不参与 OB 解码（XOR key 来自 ml(TAG)）
- 不参与 anti-tamper（用 state.to/no）

**结论**：BI 大概率是 PX **被动统计** 用的，**服务器不严格校验内容**。

实验性验证（如果想确认）：

```bash
# 把生成器里 BI 改成全 A，跑生成器
sed -i "s/const BI = '[^']*'/const BI = 'A'.repeat(136)/" your_generator.js
node your_generator.js
# 如果还能拿到 _px3 → 服务器真不检 BI 内容
```

但**保险起见**还是用 SDK 里的真实值。万一哪天 PX 加了 BI 校验，全 A 就废。

---

## 步骤 4：从 SDK 文件验证（确保 5 个常量在场）

下 SDK，验证常量确实在源码里：

```bash
curl "https://client.px-cloud.net/<APP_ID>/main.min.js" > sdk.js
# 或
curl "https://sensor.<site>.com/<short_id>/init.js" > sdk.js

# 验证 4 个常量都在源码（应每个命中 ≥ 1 次）
for c in '"PXO1GDTa7Q"' '"U0MmDhUmOnhXSw=="' '"401"' '"_px3"'; do
    echo "$c: $(grep -c "$c" sdk.js) 次命中"
done
```

预期：每个常量在 SDK 里都能 grep 到。如果命中 0 次，可能 SDK 用 hQ
字典间接引用 — 那就需要先提 hQ 字典（详见 [`identify-sdk-version.md`](identify-sdk-version.md)）。

---

## 备选定位策略（如果直接 grep 失败）

按优先级排（前面失败再用后面的）：

### 策略 A：用 PX 业务前缀正则（最稳）

```bash
grep -boE '"PX[A-Za-z0-9]{8,15}"' sdk.js | head -3
# → 0:175  "PXO1GDTa7Q"
```

PX 给客户的 AppID 永远是 `PX` 开头 + 8-15 字符 — 这是 PX 命名约定，跨版本不变。

### 策略 B：搜全局暴露（Grubhub 风格）

```bash
grep -boE 'window\._px[a-zA-Z]+\s*=' sdk.js | head -5
# → window._pxAppId = "PXO97ybH4J"
```

部分 PX 部署（如 Grubhub）会把 AppID 暴露在 window 上。

### 策略 C：搜常见 FT 值

```bash
grep -boE '"(330|388|401|359|421)"' sdk.js | head -5
```

PX 常见 FT 值在这几个之间。命中后再看上下文，TAG 和 AppID 通常在同一行附近。

### 策略 D：搜 base64 形式的 collector URL

```bash
# /api/v2/collector 的 base64 = L2FwaS92Mi9jb2xsZWN0b3I=
grep -boE '"L2FwaS92Mi9jb2xsZWN0b3I' sdk.js
```

部分平台（Grubhub）把端点 URL 也存了 base64 形式，紧邻 AppID。

### 策略 F：找 BI 的"紧跟在 AppID 后"模式 ⭐

详见步骤 3.5。这个模式跨版本最稳 — 因为 PX 把 4-5 个常量打包同 var 声明
已经写死在他们的 build pipeline 里（3 年没变过）。

### 策略 E：从浏览器 Console 直接读

如果在真浏览器里：

```js
window._pxAppId      // → "PXO1GDTa7Q"
document.cookie       // 看现有 _px* cookie 推 Cookie 名
```

---

## 验证收集到的常量是否正确

```bash
# 用这 5 个常量解一次抓到的 POST 应该出有效 JSON
node skill/AI_re/scripts/decode_payload.js /path/to/post1.txt
# 如果输出 [{"t":"...","d":{...}}] 的合法 JSON → 常量对了

# 用 TAG 解 OB 响应应该出 state.*
node skill/AI_re/scripts/decode_response.js "<TAG>" /path/to/response1.json
# 如果输出 { "state": { "no": "...", "to": "...", ... } } → TAG 对了
```

**如果解码出来是乱码** → 5 个常量中有错的，重新核对。

---

## 决策树：拿到常量后下一步去哪

```
拿到 AppID / TAG / FT
  │
  ├─ 想知道这个 SDK 版本是不是已知的
  │     → 看 identify-sdk-version.md
  │
  ├─ 想抓 6 批样本开始逆向
  │     → 看 build-generator.md
  │
  └─ 抓不到 collector POST（前置层就 403）
        → TLS fingerprint 问题，必须用真 Chrome + CDP
        → 别用 Selenium / Playwright
```

---

## 配套资源

| 想看什么 | 去哪 |
|---|---|
| grep 模式细节 | [`../references/locate-by-pattern.md`](../references/locate-by-pattern.md) §5.3 |
| 跨平台常量对比（iFood vs Grubhub） | [`../../../main/ZH/PX_完整SDK对照逆向方法论.md`](../../../main/ZH/PX_完整SDK对照逆向方法论.md) §4 |
| 解码 base64 时的 + 字符坑 | [`../references/gotchas.md`](../references/gotchas.md) #5 |
| 现成的 iFood + Grubhub 常量对比 | 同上文档 §8 |

---

*平均提取时间：iFood 5 分钟、Grubhub 10 分钟（多花的时间是因为它常量分散）。*
