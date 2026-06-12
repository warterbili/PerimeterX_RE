---
name: px-reverse
description: PerimeterX / HUMAN Security SDK 逆向工程 skill —— 从抓包到生成 _px3/_px2 cookie 的端到端工作流。包含 9 个算法模块（payload/PC/OB/SID/UUID/anti-tamper/hash/memory/ns）、7 个 CLI 工具脚本、跨版本定位手册、27 个 OB handler 形状匹配表、23 条真实踩坑清单。Use when the user mentions PerimeterX, HUMAN Security, _pxN cookies, px-cloud.net, sensor.grubhub.com, pxcookie, or any reversing of PX collector POST traffic.
languages: [zh, en]
status: validated against ifood.com.br + grubhub.com (宽档) + totalwine.com (严档) + academy.com (严档+); all 10/10 (academy on clean residential IPs)
---

# PerimeterX SDK 逆向 Skill

> **TL;DR**：把 PX SDK 的 collector POST 链路（无感模式）完全用纯算复现。
> 输入：目标 URL + AppID。产出：稳定生成 `_px3` / `_px2` 的脚本。
>
> 所有常量、字段位置、字段类型都来自**实测抓包**，不靠记忆或旧文档。
>
> **TL;DR (EN)**: Pure-math reconstruction of PX's collector POST chain.
> Input: target URL + AppID. Output: stable `_px3` / `_px2` generator.
> All constants from **live captures**, validated 10/10 against iFood +
> Grubhub.

---

## 何时触发 / When to invoke

触发关键词：

- `PerimeterX`, `PX`, `_px3`, `_px2`, `_pxvid`, `HUMAN Security`
- `px-cloud.net`, `sensor.grubhub.com`, `b.px-cdn.net`
- `/api/v2/collector`, `/xhr/api/v2/collector`
- "逆向 PX", "PX 反爬", "px cookie 生成器", "reverse PX", "bypass PX"
- "更新 SDK"（在 PX 上下文中）

**只用于 PerimeterX**。Akamai / Cloudflare / DataDome / Imperva → 不要用本 skill。

---

## 项目里的配套资源

| 资源 | 路径 | 用途 |
|---|---|---|
| **完整技术文档（中）** | [`main/ZH/PX_SDK_逆向技术文档.md`](../../main/ZH/PX_SDK_逆向技术文档.md) | 2,597 行 — 所有算法 + 协议 + EV 字段表 |
| **完整技术文档（英）** | [`main/EN/PX_SDK_Reverse_Engineering.md`](../../main/EN/PX_SDK_Reverse_Engineering.md) | 2,683 行 — 英文版 |
| **通用方法论（中）** | [`main/ZH/PX_逆向方法论_通用版.md`](../../main/ZH/PX_逆向方法论_通用版.md) | 1,233 行 — 跨版本 grep 模式 |
| **通用方法论（英）** | [`main/EN/PX_Reverse_Methodology_Universal.md`](../../main/EN/PX_Reverse_Methodology_Universal.md) | 1,260 行 |
| **SDK 对照逆向（中）** | [`main/ZH/PX_完整SDK对照逆向方法论.md`](../../main/ZH/PX_完整SDK对照逆向方法论.md) | 1,441 行 — iFood vs Grubhub 真代码并排 |
| **SDK 对照逆向（英）** | [`main/EN/PX_Complete_SDK_Comparative_Methodology.md`](../../main/EN/PX_Complete_SDK_Comparative_Methodology.md) | 1,492 行 |
| **CDP 抓包 skill** | [`skill/cdp/`](../cdp/) | 真 Chrome + CDP 抓 collector POST |
| **PX 抓包脚本** | [`skill/cdp/scripts/capture_via_cdp_{ifood,grubhub}.py`](../cdp/scripts/) | iFood + Grubhub 专用 |

---

## 🔴 第一次用先读这 7 份（按顺序）

按效率排序：

1. **`references/algorithm-chain.md`** — 5 大算法公式（XOR / B64 / 交织 / HMAC-MD5 / OB / SID / Anti-Tamper）
2. **`references/locate-by-pattern.md`** ⭐ — **跨版本定位手册**（grep 模式 + 魔法常量 + 控制流特征，**不依赖行号**）
3. **`references/handler-table.md`** — 27 个 OB handler 按**参数形状**匹配（跨版本通用，**不依赖 wire 字节名**）
4. **`references/field-categories.md`** — STATIC/DYNAMIC/CONDITIONAL 三分类规则
5. **`references/gotchas.md`** ⭐ — **23 条真实踩坑**（Bundle 路径 5 条 + 严档 #15-18 + 严档+ #19-23 academy），每条都付出过 debug 时间
6. **`references/deployment-tiers.md`** ⭐ — **PX 宽档 / 严档 / 严档+** 三档对照表，决定 generator 验证强度 + 哪些 Gotcha 适用
7. **`references/validated-sites.md`** ⭐ (NEW 2026-06-13) — **4 站全部常量 + 每站不同的 b64 键映射** 查找表，逆向新站点必查（防 #1 移植 bug）

## 🟢 操作手册 (Step-by-Step Playbooks)

`references/` 回答"**这是什么**"；`playbooks/` 回答"**怎么做**"：

| Playbook | 何时用 | 时长 |
|---|---|---|
| **`playbooks/master-workflow.md`** ⭐⭐⭐ | **端到端总览** — 从 cdp 抓包到 10/10 测试的全流程串联（Stage 0-8） | 总览 |
| **`playbooks/extract-constants.md`** | 拿到新站点，从抓包中提常量（运行时方法） | 5-15 分钟 |
| **`playbooks/locate-all-constants.md`** ⭐ | 从 SDK 源码里**统一定位**全部 5 常量（方法学，跨版本通用） | 5-10 分钟 |
| **`playbooks/identify-sdk-version.md`** | 拿到新 SDK 文件，判断版本 / 是否升级 / 已知不已知 | 2-10 分钟 |
| **`playbooks/reverse-algorithms.md`** ⭐⭐ | 从混淆 SDK 里逆出 9 个加密/编码算法（MD5/HMAC/XOR/UUID/base91/ml/PC/anti-tamper/SID） | 1-3 小时 |
| **`playbooks/locate-functions.md`** ⭐⭐ | 定位 9 类**功能函数**（hQ/`/ns`/OB 派发/27 handler/mh 入口/Dd 收集器/cookie ur+lr/PoW/WASM）⚠️ 区分无感 vs Bundle | 30-60 分钟 |
| **`playbooks/locate-field-sources.md`** ⭐⭐ | 定位每个 EV 字段的**值来源**（5 种方法 + 决策树） | 30-60 分钟 |
| **`playbooks/build-generator.md`** | 有了 6 批样本，从零写出能跑的 generator | 3-8 小时 |
| **`playbooks/validate-generator.md`** | 生成器写完了，验证 + 失败诊断决策树（含 NEW Layer 3.5） | 10-30 分钟 |
| **`playbooks/recover-hmac-formulas.md`** ⭐ NEW | HMAC/MD5 字段公式 5 步还原 SOP（SDK grep + 6 批 crypto 验证）—— 任何新站点都该走 | 30-60 分钟 |
| **`playbooks/reverse-strict-plus.md`** ⭐⭐ NEW | **严档+ 端到端**（counter 全模式 + /ns TLS + 真模板 + 持久 session + 干净 IP + 4-way 矩阵）—— 字段全对仍被拒时走这条 | 1-3 小时 |

### 整体流程跨两个 skill 协作

```
skill/cdp/    ← Stage 0-3: 起 Chrome + 抓包 + 下 SDK + 固定版本 + 重复 6 批
skill/AI_re/  ← Stage 4-8: 定位常量/函数 + 解码 + 字段分析 + 写 generator + 10/10
```

按时序完整串起来看 [`playbooks/master-workflow.md`](playbooks/master-workflow.md)。
里面也含**失败兜底**：cdp 抓不到时如何只靠静态 SDK 文件凭经验逆向。

### ⚠️ 关键区分：无感 Collector vs 按压 Bundle 两条路径

| 路径 | SDK 文件 | 触发 | 函数 | 占比 |
|---|---|---|---|---|
| **无感 Collector** | `main.min.js` | 自动 | hQ + `/ns` + OB + mh + Dd + cookie ur/lr | **99%** |
| **按压 Bundle** | **`captcha.js`** | 风险评分高 | + PoW solver + WASM loader + 按压交互 | <1% |

99% 场景写无感 generator 就够了，**完全不要碰 `captcha.js` / PoW / WASM**。
详见 [`playbooks/locate-functions.md`](playbooks/locate-functions.md) 顶部路径区分章节。

---

## 🛠️ Skill 内含工具（全部 Node.js，无外部依赖）

### `reverse/` — 9 个算法模块（可直接 `require()`）

| 模块 | 默认导出 | 用途 |
|---|---|---|
| `payload.js` | `generatePayload` + `.decodePayload` | 算法链：serialize → XOR(50) → b64 (UTF-8) → 交织 |
| `pc.js` | `generatePC` + `.hmacMD5` | HMAC-MD5 + 数字提取 → 16 位 PC |
| `ob.js` | `decodeOb`, `ml`, ... | OB 段解码 + handler 形状识别 |
| `sid.js` | `generateSid` | Plane 14 Tag Char Unicode 隐写 |
| `uuid.js` | `getUUID`, `uuidV1`, ... | RFC 4122 v1（带 PX 兼容 clockseq） |
| `hash.js` | `generateHash`, `Kt` | djb2 hash 变体 |
| `memory.js` | `generateMemory` | `performance.memory` 合成 |
| `antitamper.js` | `generateAntiTamper`, `te` | XOR-based anti-tamper key/value 注入 |
| `ns.js` | `fetchNs` | GET `/ns` 端点同步 |

完整算法说明见 [`references/algorithm-chain.md`](references/algorithm-chain.md)。

### `scripts/` — 14 个 CLI 工具（按功能分类）

#### 解码器（3 个 — 把抓包字节流变 JSON）

| 脚本 | 用途 | 输入 | 输出 |
|---|---|---|---|
| `decode_payload.js` | 从 curl 文件解 EV1/EV2 | `request_*.txt` | EV JSON |
| `decode_response.js` | 从 collector 响应解 OB 段 | `response_*.txt` + TAG | state + segments |
| `extract_hQ.js` | 从 main.min.js 提 1152 项 hQ 字典 | `main.js` | `hQ_map.json` |

#### 跨批次分析（4 个 — 多批 capture 之间相互对比）

| 脚本 | 用途 | 输入 | 输出 |
|---|---|---|---|
| `diff_samples.js` | N 批 EV 字段三分类 | 多个 EV JSON | `field_classes.json` |
| `diff_samples.py` | 同上的 Python 版 | 同上 | 同上 |
| **`build_templates.js`** | ⭐ 从 6 批自动构建 STATIC 字段模板 | N 批 decoded_payload | `templates/<site>_ev*_template.json` + field_map |
| **`identify_dynamic_semantics.py`** | DYNAMIC 字段语义自动分类（timestamp/UUID/HMAC/…） | DYNAMIC keys + 多批值 | `semantic.json` |

#### state.* 跨样本值匹配（1 个 — ⭐ 方法论 Stage 5 最关键）

| 脚本 | 用途 | 输入 | 输出 |
|---|---|---|---|
| **`find_state_keys_in_ev2.py`** | ⭐⭐⭐ 为 state.no/to/qa/vid/pxsid/appId 找 EV2 b64 key | 6 批 state + 6 批 EV2 | `state_key_map.json` |

#### 字段定位（2 个 — b64 key ↔ SDK 源码位置）

| 脚本 | 用途 | 输入 | 输出 |
|---|---|---|---|
| `lookup_keys.js` | hQ_map 反查 base64 key → SDK 位置 | b64 key + hQ_map + SDK | `via/idx` 信息 |
| `probe_dynamic.js` | DYNAMIC 字段定位 SDK 赋值点 | DYNAMIC keys + 多批值 | `semantic.json` |

#### 我生成 vs 真抓的对比（5 个 — 写 generator 时 debug 用）

| 脚本 | 用途 | 输入 | 输出 |
|---|---|---|---|
| **`diff_http_request.py`** | ⭐ **我的 POST vs 浏览器 POST** 字节级 diff（headers + form params + 顺序） | 1 个浏览器抓的 request + 我的 generator | console 输出差异表 |
| **`compare_ev2_field_by_field.py`** | 我生成的 EV2 vs 真抓 EV2 逐字段相等检查 | 我的 ev2.json + 真 ev2.json | 字段级 diff 报告 |
| **`diff_ev_ours_vs_real.py`** ⭐ | (NEW 2026-05-25) 5 段诊断：字段集 / 类型 / STATIC 值 / 顺序 / counter 同步性 —— 严档部署调试主力（[deployment-tiers.md](references/deployment-tiers.md)） | 我的 ev dump + 6 批真抓 ev | console 报告 + json 摘要 |
| **`cross_event_consistency.py`** ⭐⭐⭐ | (NEW 2026-06-12) **跨事件一致性**——上面所有 diff 都是单张快照、看不到的维度：CONSTANT（页面加载 ts/uuid/platform 跨 EV 恒定）+ MONOTONIC（perf/counter/now-ts 跨 EV 递增）。**严档低 trust 的隐藏根因**（[gotchas.md Bug #19](references/gotchas.md)）。先跑真实包提规则，再跑 generator dump 逐行对 | `samples/` 含 N/decoded_payload_{1,2,3}.json | console 规则表（标 "MUST preserve"） |
| **`find_hmac_field_sources.py`** ⭐ | (NEW 2026-05-25) [`recover-hmac-formulas.md`](playbooks/recover-hmac-formulas.md) 的 Step 2+3 — grep SDK 找 HMAC 字段赋值点 + helper 函数体 | SDK 路径 + 目标 b64 keys | console 出 fn 体，喂给 Step 4 |
| **`replay_apples_to_apples.py`** ⭐ | (NEW 2026-05-25) Layer 3.5 验证工具 — 同 proxy 同 TLS 下浏览器 cookie vs ours vs 空 cookie 三路对比，区分 "cookie 内容被标 bot" vs "transport 问题" | HTTPS_PROXY env + TARGET_URL env | console 出 4-way 矩阵 |
| **`session_server.py`** ⭐⭐ | (NEW 2026-06-13 严档+) 站点无关**持久 chrome-TLS 边车**：整链 /ns+collector+edge 走一个 curl_cffi chrome142 session（Bug #21/#22/#23）。generator 的 /ns 和每个 POST forward 到 :8765 | `PX_IMPERSONATE`/`PX_PROXY`/`PX_UA` env | 常驻 HTTP 服务 |
| **`trust_matrix.py`** ⭐⭐ | (NEW 2026-06-13 严档+) 站点无关 **4-way trust 矩阵**：真浏览器/curl × 真/我们 cookie，定位"墙在 cookie 内容 vs 传输/IP"（替代 replay，全自动 CDP+curl）| `HOME_URL`/`GATED`/`COOKIE`/`OUR_COOKIE` env | 4 格判定 + 读法 |
| **`diff_ev_field_by_field.py`** ⭐⭐ | (NEW 2026-06-13) 站点无关逐字段 diff：STATIC MISMATCH / TYPE MISMATCH / SHAPE DIFF 三类问题字段（[reverse-strict-plus.md](playbooks/reverse-strict-plus.md) Step 2）| `mine.json real.json [override_keys.txt]` | 问题字段数 + 退出码 |

#### 跨版本迁移（1 个）

| 脚本 | 用途 | 输入 | 输出 |
|---|---|---|---|
| `map_keys.js` | 旧 SDK key → 新 SDK key 值匹配迁移 | 旧 px_cookie + 新 EV 样本 | 迁移映射 |

#### 端到端验证（1 个 — ⭐ 回归测试）

| 脚本 | 用途 | 输入 | 输出 |
|---|---|---|---|
| **`verify_batch.js`** | ⭐⭐ 对一批 sample 跑解码闭环，断言解码输出 = decoded_*.json | `samples/<site>/<N>/` 整批 | 通过 / 失败哪里 |

---

### 跨工具关系矩阵（哪个工具干哪个活）

```
                     1 个真抓             N 个真抓             我生成 1 个
                     ───────             ───────             ─────────
1 个真抓             —                   diff_samples.*       diff_http_request.py
                                         compare_ev2_*        compare_ev2_field_*
                                         find_state_keys_*
N 个真抓             —                   build_templates.js   (—)
                                         identify_dynamic_*
我生成 1 个          diff_http_request    (—)                  —
                     compare_ev2_*

单独：
  decode_payload     curl/txt → EV JSON
  decode_response    response → state + ob segments
  extract_hQ         SDK → hQ_map.json
  lookup_keys        b64 key → SDK location
  probe_dynamic      DYNAMIC keys → SDK assignment context
  map_keys           old SDK → new SDK key migration
  verify_batch       round-trip prover（解码闭环）
```

---

## 📋 标准工作流（从零逆向新 PX 站点）

```
Stage 1 [15-30 min] —— 抓 6+ 批新鲜样本
  使用 skill/cdp/scripts/capture_via_cdp_ifood.py（或仿写新平台版本）
  每批输出: samples/N/{request_1.txt, response_1.json, request_2.txt,
                        response_2.json, meta.json}
  meta.json 必须含 sdk_sha256 —— 用于证明 6 批同 SDK
  SDK 同时保存到 sdk/<site>/main.min.js (或 init.js)

Stage 2 [10 min] —— 用 verify_batch 跑闭环（如已实现）
  让所有批生成 decoded_payload_{1,2}.json + decoded_response_{1,2}.json
  失败立即停止 → 解码器对这站常量不对

Stage 3 [10 min] —— 字段三分类
  node scripts/diff_samples.js samples/{1..6} > field_classes.json
  关注 DYNAMIC 集合（一般 15-30 个字段）—— 这些是要算法生成的

Stage 4 [1-3 h] —— ⭐ 字段语义识别（最容易踩坑）
  state.* 注入字段最危险 —— 它们要 parseInt 不能保持 string
  对每个 state.{no,to,appId,o111val,qa,vid,pxsid,cts}:
    在每批 EV2 找匹配的 base64 key，跨 6 批一致命中 = 确定
  其余 DYNAMIC（HMAC、timestamps、memory、Date.toString、performance.now、
    /ns sm+duration、错误栈、网络连接）一般是 SDK 函数调用结果

Stage 5 [1-2 h] —— 写 generator.js
  1) 常量: APP_ID, TAG, FT, COLLECTOR_URL, BI
  2) 模板路径: templates/<site>_ev{1,2}_template.json
  3) buildEv1/buildEv2 中 DYNAMIC key 名
  4) extractState 不用改（按 shape 匹配，已通用）
  关键: 用 PX_TAG 环境变量调试时一定传对

Stage 6 [10 min] —— 10/10 稳定性测试
  间隔 10-15 秒一次，避免 IP throttle
  期望: 全部 status=200 + 不同 _pxN 值
  失败按 references/gotchas.md 顺序排查
```

---

## ⚡ 模板法（**核心方法论**）

**EV1/EV2 大部分字段不变**：iFood EV2 共 209 字段，169 STATIC (81%)、
20 DYNAMIC (10%)、14 PARTIAL/CONDITIONAL（含 anti-tamper slot）、6 CONDITIONAL。

**意思**：手写 200 字段错一个就 403。**用真实抓包做模板，只覆盖
DYNAMIC 字段**：

```javascript
const template = JSON.parse(fs.readFileSync('templates/ifood_ev2_template.json'));
const ev2 = JSON.parse(JSON.stringify(template));   // deep clone

// 只覆盖 ~17 个 DYNAMIC（其余 192 个不动）
ev2[0].d['RTEwewNQMUg='] = parseInt(state.no);    // ⭐ parseInt!
ev2[0].d['M2MGKXUOBB8='] = hmacMD5(uuid, UA);
ev2[0].d['Xi5rJBtKaB4='] = state.appId;
// …
```

**比 SDK 反汇编 + 字段重写法快 10 倍，错误率低 10 倍**。

> ⚠️ **模板法是必要非充分 —— 严档/严档+ 站点光套模板会卡在低 trust（这是最大的认知陷阱）。**
> 模板搞定 STATIC 字段，但严档后端校验的是 **DYNAMIC 字段的语义 + 跨事件一致性 + counter 合法模式
> + mint 传输真实性**，这些套模板看不出来。严档/严档+ 站点**必须**额外走：
> 1. **逐字段 diff**（我的 EV vs 真抓）：静态必等、动态对 shape + **合法取值模式**（不止"有值"）。
> 2. **跨事件一致性**（`cross_event_consistency.py`）：CONSTANT 跨 EV 恒定、MONOTONIC 跨 EV 递增。
> 3. **写活字段去 SDK 逆真实来源**（grep b64 键字面量 `t["<key>"]=<expr>`），别猜值的形状。
> 4. **trust 4-way 矩阵**（真浏览器/curl × 真/我们 cookie）定位"墙在 cookie 内容还是传输/IP"。
> 5. **严档+（academy 类）**：模板**必须真 Chrome CDP 抓**（JSDOM 信任分不够），/ns 走真 Chrome TLS，
>    每 cookie 一个新住宅 IP。详见 Bug #19-#23 + [`deployment-tiers.md`](references/deployment-tiers.md) 第三档。
>
> 一句话：**模板法负责"不缺字段"，深度逆向负责"动态字段对、跨事件一致、传输够真"。两者都要。**

---

## ⚠️ Top 5 Gotchas（必记 — 完整 23 条在 `references/gotchas.md`）

### Gotcha #1 — `state.no` 必须是 number ⭐⭐⭐

从 OB 解出的 `state.no` 是字符串 `"1779263519570"`，**注入 EV2 时必须 parseInt**：

```js
ev2.d['RTEwewNQMUg='] = parseInt(state.no);   // ✅ iFood
ev2.d['UT0ndxdcJUQ='] = parseInt(state.no);   // ✅ Grubhub (不同 key!)
```

**症状**：collector#2 返回 `{"do":null}`（PC 通过）但 OB 只有 2 段，永远没 _px3。

### Gotcha #2 — base64 必须 UTF-8 ⭐⭐

```js
Buffer.from(t, 'utf-8').toString('base64')   // ✅
// 用 Latin-1 一编码就错
```

### Gotcha #3 — Anti-tamper 必须保留模板**原位置** ⭐⭐⭐

```js
// ❌ 错（key 跑到末尾改变迭代顺序）
delete d[oldKey]; d[newKey] = newVal;

// ✅ 对（重建字典保持位置）
const out = {};
for (const k of Object.keys(d)) {
    out[ANTI_TAMPER_RE.test(k) ? newKey : k] = (
        ANTI_TAMPER_RE.test(k) ? newVal : d[k]
    );
}
```

### Gotcha #4 — OB 解码用 binary 不能 utf-8 ⭐⭐

```js
Buffer.from(ob, 'base64').toString('binary')   // ✅
// utf-8 会把 ≥0x80 字节坏掉
```

### Gotcha #5 — 解 POST body 时**不要**把 base64 的 `+` 替换成空格 ⭐⭐⭐

```js
// ❌ 错（base64 的 + 被吃成空格）
const v = decodeURIComponent(raw.replace(/\+/g, '%20'));

// ✅ 对
const v = decodeURIComponent(raw);
```

完整 23 条（Bundle 5 条 + 严档 #15-18 + 严档+ academy #19-23）见 [`references/gotchas.md`](references/gotchas.md)。

---

## 🎯 已验证的四个站点（参考）—— 横跨 3 档

| 站点 | 档位 | AppID | TAG | FT | Cookie | 实测 |
|---|---|---|---|---|---|---|
| ifood.com.br | 宽档 | `PXO1GDTa7Q` | `U0MmDhUmOnhXSw==` | `401` | `_px3` (ttl 330) | **10/10** |
| grubhub.com | 宽档 | `PXO97ybH4J` | `FmYgK1gdJEAP` | `359` | `_px2` (ttl 500) | **10/10** |
| totalwine.com | 严档 | `PXFF0j69T5` | `CFQ7WU4xIS8MXA==` | `401` | `_px2` (ttl 330) | **10/10** |
| **academy.com** | **严档+** | `PXqqxM841a` | `dgYGCzBjH3pyBg==` | `405` | `_px3` (ttl 330) | **10/10**（干净住宅 IP）|

⚠️ 旧文档把 Grubhub AppID 写成 `PXdRotaCw0` / FT 写成 `330` —— **都错了**。
本 skill 列的值是从真实抓包 POST body 直接提取的。

📖 **四站全部常量 + 每站不同的 b64 键映射（state/HMAC/counter）+ wire char + 冷热策略**
→ [`references/validated-sites.md`](references/validated-sites.md)（逆向新站点的查找表）。

> academy 是**严档+**（第三档）：在 totalwine 严档之上，trust 还绑定到 mint 的 **传输 TLS +
> /ns 的 TLS 指纹 + 模板必须真 Chrome + 出口 IP 信誉**（gotchas Bug #20-#23）。
> 它也是第一个**逐字段 diff 全过但仍低 trust** 的站点 —— 真因是一个**非法 counter 模式**（Bug #20）。

---

## ✅ 验证标准

| 阶段 | 通过标准 |
|---|---|
| 解码闭环 | 自己生成的 payload 解码后 = 真实抓包解码 |
| collector#1 | status=200，OB 含 `state.no` + `state.appId` + `state.to` |
| collector#2 | status=200，OB 含 set_cookie 段 (4+ args，`_px*` 开头) |
| 端到端 | 跑 ≥ 5 次，全部拿到不同的 `_pxN` 字符串 |
| 业务 API | 用拿到的 cookie 请求业务 API → 200 OK |

---

## ❌ 不该犯的"自然语言陷阱"

1. **"差不多就行"** —— 算法层精度敏感，一个字节差就 403
2. **"应该是 XXX"** —— 必须 SDK 源码或样本对比验证，不能猜
3. **"用 JSON.stringify"** —— 错，必须 PX 自定义 serialize
4. **"随机一下试试"** —— 错，DYNAMIC 字段也有合理范围，用真实统计值
5. **"加点 sleep 看看"** —— 时序不是问题，加密才是
6. **"文档写的就是这样"** —— 旧文档可能错（已查出 Grubhub AppID 错过）。
   **直接看抓包**

---

## 文档导航

完整文档体系：

```
perimeter/
├── main/
│   ├── ZH/  ← 中文版（3 份，7271 行）
│   └── EN/  ← 英文版（3 份，5435 行）
├── skill/
│   ├── AI_re/   ← 本 skill（你正在读）
│   └── cdp/     ← 抓包工具
```

如果用户问的是：

- "怎么从头逆向新 PX 站点" → 走本文 §标准工作流
- "EV2 字段怎么找" → `references/handler-table.md` + `field-categories.md`
- "新 SDK 行号都不一样" → `references/locate-by-pattern.md`
- "我的 generator 拿不到 _px3" → `references/gotchas.md` 按顺序排查
- "PX vs Akamai / Cloudflare" → 不在本 skill 范围

---

*本 skill 已校验 2026-05-21，对应文档体系最新版。*
