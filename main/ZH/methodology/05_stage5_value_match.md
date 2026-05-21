# Stage 5: Value-match — state.* → EV2 b64 key ⭐⭐⭐

> **时间预算**：熟练 15 min，第一次 30 min
> **产出**：`state_key_map.json` — 把 4 个 state.* 字段映射到 EV2 中的具体 b64 key
> *融合*: C/§3.5（value-match 实战）+ A/§9（深入分析）+ B/05_stage5_value_match

---

## 章节定位

**这是整个方法论里最容易被跳过的一章。也是最坑的一章。**

如果你跳过 Stage 5 直接进 Stage 6（写 generator），你会盲猜 `state.no` 应该填到哪个 b64 key，**99.9% 概率猜错**，然后 generator 跑不通，你回过头来 debug，**浪费的时间 >>> 15 分钟**。

---

## 5.1 问题描述

PX collector#1 响应里有个 `state` 对象：

```json
{
  "state": {
    "appId": "PXO1GDTa7Q",
    "no": 1771962850771,
    "qa": "a1b2c3...64hex",
    "to": "16:9;3<>;7=",
    "vid": "c83577f0-...-uuid",
    "pxsid": "82de01a0-...-uuid",
    "cts": "82de01a0-...-uuid",
    "jf": "cu"
  }
}
```

这 8 个字段中**至少 4 个必须注入到 collector#2 的 EV2 payload 里**。但**EV2 用 b64 编码的 key**，比如：

```json
{
  "d": {
    "RTEwewNQMUg=": "1771962850771",   ← 这个是 state.no 吗？是哪个 state？
    "M2EHKXUOBB4=": "PXO1GDTa7Q",      ← 这是 state.appId ？
    "fyNFZTlCSFM=": "16:9;3<>;7=",     ← 这是 state.to？
    "Azs1JTQEEXM=": "c83577f0-...",    ← state.vid？state.cts？state.pxsid？
    ...
  }
}
```

**你怎么知道 b64 key 跟 state 字段的映射？**

`RTEwewNQMUg=` 是 b64-编码的内部混淆 key（不是原文），看名字看不出语义。Stage 4 给你的 hQ_map.json 也只告诉你 "key 的字符串是 `RTEwewNQMUg=`"，**不告诉你它对应哪个 state.\* 字段**。

---

## 5.2 解法：**值匹配**（value-matching）

核心思路：跨 6 批样本，**state.no 在每批不同**（13 位时间戳），**EV2 里也只有少数 key 是 13 位字符串**。如果**某个 b64 key 在 6 批的值跟 state.no 一一对应**，那就是它。

伪代码：

```python
for state_field in ['no', 'appId', 'to', 'qa', 'vid', 'pxsid', 'cts', 'jf']:
    state_values = [batch_i.state[state_field] for i in 1..6]

    candidates = []
    for b64_key in ev2_d.keys():
        ev2_values = [batch_i.ev2.d[b64_key] for i in 1..6]
        if str(ev2_values) == str(state_values):
            candidates.append(b64_key)

    print(state_field, '→', candidates)
```

---

## 5.3 实战脚本

```bash
cd ../../../stample/ifood/script/
python find_state_keys.py
```

期望输出：

```
state.no    → ["RTEwewNQMUg="]           ✓ 1 个唯一命中
state.appId → ["M2EHKXUOBB4="]           ✓
state.to    → ["fyNFZTlCSFM="]           ✓
state.qa    → ["Y3kSITcXEy0="]           ✓
state.vid   → ["Azs1JTQEEXM=", "..."]    ⚠ 多个候选
state.pxsid → ["I3oRZX4yBR8="]           ✓
state.cts   → []                          ✗ 0 候选 → cts 没注入 EV2
state.jf    → ["L19sZmwOR3M="]           ✓
```

### 输出格式（state_key_map.json）

```json
{
  "PXO1GDTa7Q": {
    "no":    "RTEwewNQMUg=",
    "appId": "M2EHKXUOBB4=",
    "to":    "fyNFZTlCSFM=",
    "qa":    "Y3kSITcXEy0=",
    "vid":   "Azs1JTQEEXM=",
    "pxsid": "I3oRZX4yBR8=",
    "jf":    "L19sZmwOR3M="
  }
}
```

这文件是 Stage 6 的**核心输入**。

---

## 5.4 多候选 / 0 候选的处理

### 5.4.1 多个候选（最常见）

某个 state 值匹配多个 b64 key，因为：

- 该字段是 UUID，多个 EV2 字段都用同一 UUID（vid 同时填到 cookie name + session id 等）
- 6 批样本不够，几个字段恰好同步变化

**修复**：

```python
# 增加样本数 6 → 9 或 12
# 或加入"类型先验":
#   state.no    → 必须 13 位 number 类型
#   state.to    → 必须 ":;<=>?@" 字符集，长度 15-25
#   state.vid   → 必须 UUID v1 格式
#   state.appId → 必须 12-30 字符 alphanumeric
#   state.qa    → 必须 64 hex chars
```

A 文档（PX_逆向方法论_通用版.md 1233 行版）的 §9 详细讲了**类型先验** + **范围先验**。

### 5.4.2 0 候选

某个 state 字段没匹配上：

```
state.cts → []
```

可能原因：

- **该字段没注入 EV2**（如 `cts` 通常只用于内部追踪，不一定上 wire）
- **被 anti-tamper 包装了**（值不是直接拷贝，要先过 anti-tamper 编码）
- **被 hash 包装了**（如 `HMAC(vid, UA)` 而不是直接 vid）

**处理**：
- 用 hex/UTF-8 转换试一下（有的字段会 base64 一遍）
- 检查 anti-tamper key 是不是它（te(state.to, state.no % 10) 公式）
- 大部分情况是"没注入"，可以忽略

---

## 5.5 一种容易遗漏的字段：anti-tamper key+value

EV2 里有 2 个字段每次值都变 **而且 key 也变**：

```json
{
  "fyNFZTlCSFM=": "16:9;3<>;7=",       ← anti-tamper value (覆盖 state.to)
  "n5J4PSdfdU8=": "<encoded>",          ← anti-tamper "辅助" 字段（key 是 anti-tamper 公式产生）
}
```

第二个 key `n5J4PSdfdU8=` 看上去也是 b64，但其实是 **`te(state.to, state.no % 10 + offset)` 函数的输出**。

```javascript
// 公式（实测）:
function te(seed, n) {
    return base64encode(
        seed.split('').map((c, i) =>
            String.fromCharCode(c.charCodeAt(0) ^ ((n + i * something) & 0xFF))
        ).join('')
    );
}
```

详见 [`../../../revers/antitamper.js`](../../../revers/antitamper.js) 完整实现。

### 5.5.1 怎么验证 anti-tamper key 计算正确

```bash
# 跑 6 批，看 anti-tamper key 在 6 批的值
jq '.[0].d | with_entries(select(.key | test("^[A-Za-z0-9+/]{12}="))) | keys' samples/{1..6}/decoded_payload_2.json
```

如果其中两个 b64 key **跨 6 批每次都不一样**，那就是 anti-tamper key/value 字段。

---

## 5.6 跨版本失效的处理

PX 大版本升级时（每 6-12 月）**所有 b64 key 都会变**，`state_key_map.json` **作废**，必须重做 Stage 5。

幸运的是 Stage 5 是机械步骤：

1. 重新抓 6 批（Stage 1）
2. 重新解码（Stage 2）
3. 重新分类（Stage 3）—— 注意 STATIC/DYNAMIC 比例应该差不多
4. **重跑 find_state_keys.py** → 新的 `state_key_map.json`

整个过程 30 分钟以内能搞定。

⭐ **这是为什么 Stage 5 是 15 分钟脚本**：升级响应时间最短的环节。

---

## 5.7 跨站点的处理

⚠️ **`state_key_map.json` 不能跨站点复用**。

iFood 的 `state.no` 对应 `RTEwewNQMUg=`，Grubhub 的 `state.no` 可能对应完全不同的 b64 key（不同 SDK build → 不同 b64 字典）。

每个站点都要**单独跑一次 Stage 5**。

---

## 5.8 完整 7 字段映射典型实例

iFood + Grubhub 实测（仅供参考，每次 SDK 升级会变）：

| state 字段 | iFood EV2 key | Grubhub EV2 key |
|---|---|---|
| `no` | `RTEwewNQMUg=` | `U0swdkVRcEM=` |
| `appId` | `M2EHKXUOBB4=` | `aR1dHy91Vi4=` |
| `to` | `fyNFZTlCSFM=` | `cFomU3ZbVjI=` |
| `qa` | `Y3kSITcXEy0=` | `bxlIElJaVgg=` |
| `vid` | `Azs1JTQEEXM=` | `b1MtCSQrChE=` |
| `pxsid` | `I3oRZX4yBR8=` | `EwhjCVZnZTM=` |
| `jf` | `L19sZmwOR3M=` | `c20vNgkEC1Y=` |

(注：示例 key 仅供说明跨站差异；当前抓的 SDK 可能跟这里完全不同，**总是用你 Stage 5 跑出来的为准**)

---

## 5.9 Stage 5 完成标准 ✓

| 项 | 验证 |
|---|---|
| ✅ state_key_map.json 生成 | 文件存在，含 7+ 字段映射 |
| ✅ 至少 7 个字段唯一命中 | no/appId/to/qa/vid/pxsid/jf |
| ✅ 0 个 "0 候选" | 如果有，检查是不是 anti-tamper 包装 |
| ✅ 多候选已收敛 | 用类型先验筛掉假候选 |

---

## 5.10 进入 Stage 6

Stage 5 完成 → 你知道每个 state.* 该写到 EV2 哪个 b64 key → **可以写 generator 了** → 进入 [Stage 6: Implement](06_stage6_implement.md)。
