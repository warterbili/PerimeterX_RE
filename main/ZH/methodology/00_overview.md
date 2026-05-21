# 0 总览：7 阶段从 0 到 `_px3`

> **章节定位**：开始任何 PX 逆向工作前先读这章。**5 分钟**给你整体地图。
>
> *本章融合*: B/00_overview（结构）+ C/§0（时间预算）+ A/§0（稳/不稳分层）

---

## 0.1 7 阶段一图

```
Stage 1 — Capture           锁 SDK + 抓 6+ 批样本           ──┐
   ↓                                                          │ "知道我面对什么"
Stage 2 — Decode            解码 payload + OB → JSON          │
   ↓                                                          │
Stage 3 — Classify          STATIC/DYNAMIC/CONDITIONAL ────┐  │
   ↓                                                       │  │
                                                           │  ▼
Stage 4 — Locate            SDK 源码定位字段语义 ⭐         │
   ↓                                                       │
Stage 5 — Value-match       state.* → EV2 b64 key ⭐⭐⭐    │ "知道每个字段是啥"
   ↓                                                       │
                                                           ▼
Stage 6 — Implement         写 generator（模板法 + DYNAMIC）  ──┐
   ↓                                                            │ "做出来"
Stage 7 — Validate          10/10 + 业务 API 调通 ✓             │
                                                                ▼
                                                        ┌──────────────┐
                                                        │ 拿到 _px3 ✓  │
                                                        └──────────────┘
```

---

## 0.2 时间预算（按经验级别）

| 阶段 | 任务 | 熟练 | 第一次 |
|---|---|---|---|
| 1 | Capture 抓 6+ 批 | 30 min | 1 h |
| 2 | Decode 解码 + 算法验证 | 15 min | 1 h |
| 3 | Classify 三分类 | 30 min | 2 h |
| 4 | Locate 字段语义 ⭐ | 1 h | **4 h** |
| 5 | **Value-match** ⭐⭐⭐ | 15 min | 30 min |
| 6 | Implement | 1 h | 4 h |
| 7 | Validate | 30 min | 2 h |
| | **总计** | **~4 h** | **~15 h** |

**最重要的一句话**：**Stage 5 是 15 分钟的脚本，省后面 Stage 4/6 几小时盲猜**。很多生产逆向工程师跳过 Stage 5 浪费几小时，**我们写下来**就是为了让你别跳。

---

## 0.3 时间投入实际分布（实战 2026-05 复盘）

跑完 iFood + Grubhub 双站，6 批 × 2 抓包，12 次端到端测试，实测分布：

```
20% — 抓包 + 解码 + 对比样本                Stage 1+2
25% — SDK 源码逆向 + 字段语义定位            Stage 4
15% — 算法层移植                            Stage 2
30% — 字段表对齐 + 类型校对（最容易踩坑！）   Stage 5+6  ⭐⭐⭐
10% — 端到端联调 + 稳定性验证               Stage 7
```

> ⚠️ **关键警示**：30% 时间在"字段对齐 + 类型校对"——这超出大多数新人的预期。`state.no` 必须 `parseInt()` 转 number 这一条坑就花了 3 小时（详见 [`../../../bug_report/1_collector_path.md`](../../../bug_report/1_collector_path.md) #14）。**先看踩坑清单可以省一半时间**。

---

## 0.4 前置要求

- **运行环境**：`Node ≥ 18`，`Python ≥ 3.10`（可选，用于跨批分析脚本）
- **解码工具链**：本项目 [`../../../revers/`](../../../revers/) 9 个算法模块已就绪
- **浏览器**：Chromium 系（Chrome / Edge）+ DevTools
- **IP**：非数据中心 IP（PX 大概率拒数据中心 IP，需要住宅代理 / VPN）
- **可选但强烈推荐**：`mitmproxy` 或 Charles 用于流量审计

---

## 0.5 什么稳定 / 什么不稳定（必背）

PX 频繁旋转混淆。**搞清楚什么稳定**直接决定你逆向方法论的耐久度。

### 0.5.1 稳定层（3 年没变过）

PX **算法本身没换过**。这些常量你写死都行：

| 算法 | 魔法常量 | 跨版本？ |
|---|---|---|
| MD5 init A | `1732584193` (`0x67452301`) | ✅ |
| MD5 init B | `-271733879` (`0xEFCDAB89`, signed) | ✅ |
| MD5 init C | `-1732584194` (`0x98BADCFE`, signed) | ✅ |
| MD5 init D | `271733878` (`0x10325476`) | ✅ |
| HMAC ipad | `909522486` (`0x36363636`) | ✅ |
| HMAC opad | `1549556828` (`0x5C5C5C5C`) | ✅ |
| UUID v1 Gregorian epoch | `122192928e5` | ✅ |
| INT32_MAX（`ml()` hash） | `2147483647` | ✅ |
| base91 字母表（payload） | `F@bt...` 起头长字符串 | ✅ |
| XOR(50) — payload 加密 | `50` | ✅ |
| XOR(10) — paddingKey 加密 | `10` | ✅ |
| 默认 fallback ts | `1604064986000` | ✅ |

**这意味着**：用 `grep` 这些常量定位算法是**永久有效的方法**，不会因 PX 升级失效。

### 0.5.2 半稳定层（每 6-12 月动一次）

| 项 | 频率 | 例 |
|---|---|---|
| OB XOR key | 每个新 TAG | `ml(TAG) % 128`（动态算） |
| OB wire 字符 | 大版本 | `0/l` ↔ `o/I` ↔ `1/o` |
| EV1/EV2 字段数 | 每年微调 | 14 → 16，204 → 228 |
| ChaCha20 seed（Bundle WASM） | 每个 build | 32 字节嵌 .data 段 |

### 0.5.3 不稳定层（每月-每周变）

| 项 | 频率 | 应对 |
|---|---|---|
| 函数名（混淆） | 每次 build | **不要按名 grep**，按 args shape / 魔法常量 |
| 行号 | 每次 build | 不要 hardcode 行号 |
| **b64 key 字典**（229 个） | 每次 build | 每次升级用 `extract_hQ.js` 重新生成 |
| state.* → EV2 b64 key 映射 | 每个站点 | **用值匹配脚本**（Stage 5）—— 不要看类型猜 |
| 协议常量（TAG / FT / Cookie 名） | 每个站点 + 偶尔升级 | 从真抓 POST body 直接提，不靠文档记忆 |

**核心 insight**：**把方法论建立在稳定层，避开不稳定层**。这是这套方法 3 年不需要重写的原因。

---

## 0.6 什么时候**不应该**纯算逆向

3 个场景考虑放弃：

### 0.6.1 业务量小

如果一天 < 几百次请求，**用 Playwright + 住宅代理走真浏览器**比纯算 generator 性价比高 10 倍。
- 不用维护算法跨版本
- 不用应对 SDK 每月升级
- 反检测自然最强

纯算 generator 的成本是"维护代价"，业务量太小回本不了。

### 0.6.2 你有更轻量的"后门"

如果目标站有：
- API 内部接口（不走 PX 保护）
- 服务端注册流程能绕开
- 你能买到 PX SDK 订阅做"自己人"

**先用这些，不要做逆向**。逆向应该是"没办法的办法"。

### 0.6.3 你的目标不是 PX

PX 知识**只对 PX 客户站点有用**。如果目标是 Cloudflare Turnstile / Akamai / DataDome / Imperva —— **本方法论不通用**，那些 WAF 各自机制完全不同。

---

## 0.7 什么时候**应该**纯算逆向

3 个最佳场景：

| 场景 | 为什么纯算适合 |
|---|---|
| 高吞吐数据采集 | 真浏览器 5× 慢，跑不动规模 |
| 多 IP / TLS 指纹隔离 | 纯算可灵活控制 TLS 指纹 |
| 自审你自己的部署 | 知道 PX 在你站点上具体做了什么 |
| 学术研究 / 安全审计 | 知识深度要求 |

---

## 0.8 何时该放弃（脚本跑不通）

两种情况建议放弃当前路径：

### 0.8.1 SDK 大改

实测 PX 算法 3 年没变过，但**理论上有可能换**。如果：
- 算法层魔法常量 grep 不到了
- payload 加密链结构变了
- OB 解码无法理解

**临时方案**：用真浏览器（Playwright）桥接 PX session，纯算部分等重新逆向。

### 0.8.2 分数低过门槛

如果你 generator **逐字节匹配真抓但仍然拿不到 cookie**，可能：
- PX 加了新字段（你模板没有）
- 你的 IP 评分 < PX 阈值（Layer 1 不够）
- 你的 TLS 指纹被识别

详见 [`07_stage7_validate.md`](07_stage7_validate.md) §故障排查决策树。

---

## 0.9 这个方法论的产出

走完 Stage 1-7 你应该有：

- `stample/<site>/source/main.min.js` — 锁定 SDK 文件（含 SHA256）
- `stample/<site>/source/SDK_INFO.md` — 站点常量（AppID, TAG, FT, Cookie 名, Collector URL）
- `stample/<site>/sample/{1..6}/` — 6+ 批对齐的抓包样本
- `stample/<site>/px_cookie/<site>_ev1_template.json` — 冷访问 EV1 基线
- `stample/<site>/px_cookie/<site>_ev2_template.json` — 冷访问 EV2 基线（200+ 字段）
- `stample/<site>/px_cookie/state_key_map.json` — state.* → EV2 b64 key 映射
- `stample/<site>/px_cookie/<site>_px3.js` — 端到端 generator
- 10/10 验证 ✓

**这是金标准**。少于这个 = "逆向中"，不是"逆向完成"。

---

## 0.10 下一章

→ [Stage 1: Capture 抓包准备](01_stage1_capture.md)
