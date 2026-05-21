# Playbook: 识别 SDK 版本 / 判断是否升级

> 你的生成器**昨天还能拿 cookie，今天不行了** — 是 PX 升 SDK 了吗？
> 或者你拿到一份**新 SDK 文件**，要判断是不是 PX、什么版本、跟已知版本差多远。
>
> 预计时间：**2-10 分钟**

---

## 三种场景，分别怎么办

### 场景 A：判断一个 .js 文件**是不是** PX SDK

```bash
SDK="path/to/main.min.js"

# 5 个魔法常量任一命中 = 是 PX
echo "MD5 init (1732584193):    $(grep -c 1732584193 "$SDK")"
echo "HMAC ipad (909522486):    $(grep -c 909522486 "$SDK")"
echo "UUID v1 (122192928e5):    $(grep -c 122192928e5 "$SDK")"
echo "ml() (2147483647):        $(grep -c 2147483647 "$SDK")"
echo "base91 字母表 (F@bt):     $(grep -c "F@bt" "$SDK")"
```

**判定**：

- 5/5 命中 → ✅ 标准 PX SDK
- 4/5 命中 → ⚠️ 可能是 PX 变种或精简版，深查
- 3/5 命中 → ⚠️⚠️ 可能不是 PX
- ≤2/5 命中 → ❌ 不是 PX（去看 Akamai / Cloudflare / DataDome）

这 5 个常量是 RFC 标准 + PX 自选魔数，**3 年内从未变过**。

### 场景 B：识别 PX SDK 的"小版本"（同站点的版本差异）

```bash
# 1. 算 SHA-256
sha256sum "$SDK"
# → b47a639cde9df4f91bdc4138ae0d64ebf7ce8c876a1e4c9967fd3af3d2975eb8

# 2. 跟已知版本对比
cat stample/ifood/source/SDK_INFO.md | grep "SHA-256"
# → b47a639c... = 同版本

# 3. 如果 SHA 不同，看大小是否相近
ls -la "$SDK" stample/ifood/source/main.min.js
# 大小差 < 5% → 同主版本小更新（hQ 字典轮换、字段微调）
# 大小差 > 10% → 大版本（可能新增字段或加 captcha 路径）
```

### 场景 C：判断这个 SDK 跟我已知的版本差**多远**

```bash
NEW_SDK="new.min.js"
OLD_SDK="stample/ifood/source/main.min.js"

# 各项对照检查
for f in "$NEW_SDK" "$OLD_SDK"; do
    echo "── $f ──"
    echo "  size:           $(wc -c < $f) bytes"
    echo "  AppID:          $(grep -oE '"PX[A-Za-z0-9]{8,15}"' $f | head -1)"
    echo "  TAG (候选):      $(grep -oE 'var\s+\w+\s*=\s*"[A-Za-z0-9+/=]{12,}=="' $f | head -1)"
    echo "  FT (候选):       $(grep -oE '"(330|388|401|359|421)"' $f | head -1)"
    echo "  endpoints:       $(grep -oE '"/api/v2/collector"' $f | head -1)"
    echo "  hP[0]:          $(grep -oE 'hP\s*=\s*\[\s*"[^"]{1,30}"' $f | head -1 | cut -c1-50)"
done
```

**差异类型**：

| 哪里变了 | 严重性 | 后续动作 |
|---|---|---|
| AppID / TAG / FT 任一变 | ⭐⭐⭐⭐⭐ 严重 | 全部生成器报废，常量全更新 |
| 行号变（大小相近、SHA 不同） | ⭐ 轻微 | 生成器**通常**不受影响（用 grep 模式定位，不用行号） |
| hP[0] 字符串变了 | ⭐⭐⭐ 中等 | hQ 字典轮换，所有 b64 key 可能要重新值匹配 |
| 大小差 > 10% | ⭐⭐⭐⭐ 重 | 可能新增功能（如 Bundle 路径），需要看新增部分 |
| 算法常量（5 个魔法常量）不再命中 | ⭐⭐⭐⭐⭐ 致命 | PX 算法本身换了 — 3 年没见过的情况 |

---

## 步骤 1：抓一份新 SDK

```bash
# 方式 A：从 CDN 直拉（最快）
APP_ID="PXO1GDTa7Q"   # 替换成目标站的 AppID
curl -sS "https://client.px-cloud.net/${APP_ID}/main.min.js" > new_sdk.js

# 方式 B：用 CDP 在浏览器里抓（最稳，能验证浏览器真在用这版本）
python skill/cdp/scripts/cdp.py navigate "https://www.<site>.com/"
python skill/cdp/scripts/cdp.py network 5 | grep -E "main\.min\.js|init\.js"

# 方式 C：用 fetch_sdk 脚本（自动算 SHA、保存）
python skill/cdp/scripts/fetch_sdk.py
```

## 步骤 2：跑 5-点探测

```bash
SDK="new_sdk.js"
echo "=== PX SDK 探测 ==="
echo "MD5 init:       $(grep -c 1732584193 "$SDK")"
echo "HMAC ipad:      $(grep -c 909522486 "$SDK")"
echo "UUID v1:        $(grep -c 122192928e5 "$SDK")"
echo "ml() INT32_MAX: $(grep -c 2147483647 "$SDK")"
echo "base91 字母表:   $(grep -c "F@bt" "$SDK")"
echo "OB 分隔符:       $(grep -c '~~~~' "$SDK")"
echo "SID 隐写:        $(grep -c "0xE0100\|fromCodePoint" "$SDK")"
echo "anti-tamper:    $(grep -cE "% *10 *\+ *[12]" "$SDK")"
echo "/api/v2/coll:   $(grep -c '/api/v2/collector' "$SDK")"
echo "fallback ts:    $(grep -c '1604064986' "$SDK")"
echo ""
echo "SDK 大小:        $(wc -c < "$SDK") bytes"
echo "SHA-256:        $(sha256sum "$SDK" | cut -d' ' -f1)"
```

**典型输出（iFood 2026-05）**：

```
MD5 init:       1
HMAC ipad:      1
UUID v1:        1
ml() INT32_MAX: 1
base91 字母表:   1
OB 分隔符:       1
SID 隐写:        1     ← iFood 用，Grubhub 是 0
anti-tamper:    2
/api/v2/coll:   1
fallback ts:    1

SDK 大小:        231438 bytes
SHA-256:        b47a639cde9df4f91bdc4138ae0d64ebf7ce8c876a1e4c9967fd3af3d2975eb8
```

## 步骤 3：跟现有 SDK_INFO.md 对比

```bash
# 看本项目里已知 SDK 的 SHA
for f in stample/*/source/SDK_INFO.md; do
    site=$(echo "$f" | cut -d/ -f2)
    sha=$(grep -oE '[a-f0-9]{64}' "$f" | head -1)
    echo "  $site: $sha"
done

# 跟我刚抓的 new_sdk.js 比
NEW_SHA=$(sha256sum new_sdk.js | cut -d' ' -f1)
echo "  new:   $NEW_SHA"
```

**判定**：

- 相同 SHA → 同版本，不用动
- 不同 SHA + 同尺寸（±5%） → 小版本（hQ 轮换）
- 不同 SHA + 大尺寸差异 → 大版本（功能变动）

## 步骤 4：如果 SDK 变了，判断对生成器的影响

### 4.1 用现有解码器测试新 SDK

```bash
# 抓 1 批新的样本（用新 SDK）
python skill/cdp/scripts/capture_via_cdp_ifood.py 100  # batch 100 = 测试批

# 用现有 TAG 解新批
node skill/AI_re/scripts/decode_payload.js stample/ifood/sample/100/request_2.txt
```

**结果分类**：

| 解码结果 | 说明 | 严重性 |
|---|---|---|
| ✅ 合法 JSON 出来了 | TAG 没变，算法层 OK | 生成器**大概率**还能用，跑一次 verify_batch 确认 |
| ❌ 解出来是 JSON 但字段名都不一样 | hQ 字典轮换，base64 key 重排 | 模板和 key 映射要重做 |
| ❌ 完全乱码 | TAG 或 ml() 算法变了 | 重新走 extract-constants 提常量 |

### 4.2 跑现有 sample 的 verify_batch 看解码器是否还工作

```bash
bash stample/ifood/script/verify_all.sh
# 通过 → 解码器对当前 SDK 通用，生成器层面也大概率没问题
# 失败 → 看哪个 stage 失败：常量/算法/字段全要重新映射
```

### 4.3 跑现有生成器 + 实战测试

```bash
node stample/ifood/px_cookie/ifood_px3.js
# 返回 { cookie_name: "_px3", cookie_value: "..." } → 生成器还能用 ✅
# 返回 { error: "..." } → 看具体 error
```

## 步骤 5：根据严重程度决定下一步

```
新 SDK 探测完
  │
  ├─ 5 个魔法常量全过 + 现有生成器能拿 cookie
  │     → ✅ 啥都不用做，更新 SDK_INFO.md 里的 SHA 就行
  │
  ├─ 现有生成器拿不到 cookie，但解码器还工作
  │     → 字段或模板变了 — 用现有 sample 跑 diff_samples.py 看
  │       哪些字段值变了，更新模板
  │
  ├─ 解码器都不工作了（解出乱码）
  │     → TAG 或 ml() 算法变了 — 走 extract-constants 重新提取
  │
  └─ 5 个魔法常量有失败
        → 3 年没见过 — 真的换 SDK 厂商了？或者抓错文件了？
        → 重新抓 SDK（步骤 1）
```

---

## 决策树速查

```
我手里有什么          下一步去哪
─────────────────    ────────────────────────────────
1 个 .js 文件         步骤 1-2 跑探测
我的生成器失败        步骤 4.3 → 看错误
SHA 跟我记的不一样    步骤 4.1 + 4.2
PX 大版本升级        重新跑全 build-generator.md
```

---

## 跨年稳定性参考

PX 过去 3 年的 SDK 升级模式：

| 频率 | 变了什么 |
|---|---|
| 每周 | (几乎无) |
| 每 2-3 周 | captcha.js (Bundle 路径) |
| 每季度 | main.min.js（hQ 字典轮换、变量名重命名） |
| 每半年 | 偶尔字段轮换 |
| 每年 | 偶尔加新字段 |
| 从未观察过 | RFC 标准算法常量变 |
| 从未观察过 | 协议分隔符 `~~~~` `\|` 变 |
| 从未观察过 | 端点 URL 大改 |

**结论**：把生成器建立在**算法层 + RFC 常量**上 → 跨季度稳定。
建立在**变量名 / 行号**上 → 每次都崩。

---

## 配套资源

| 想看什么 | 去哪 |
|---|---|
| 完整 grep 模式索引 | [`../references/locate-by-pattern.md`](../references/locate-by-pattern.md) |
| 跨版本稳定性矩阵 | [`../../../main/ZH/PX_完整SDK对照逆向方法论.md`](../../../main/ZH/PX_完整SDK对照逆向方法论.md) §11 |
| 拿到新 SDK 后怎么提常量 | [`extract-constants.md`](extract-constants.md) |
| 重做生成器的全步骤 | [`build-generator.md`](build-generator.md) |

---

*跨版本核心原则：**不依赖行号、不依赖变量名、只依赖算法常量和控制流特征**。*
