# Bundle 路径样本目录

⚠️ **跟 Collector 路径的 `stample/{ifood,grub}/sample/` 不一样**。

Collector 路径保存了 **flat-file raw POST/响应抓包**（`request_*.txt` + `response_*.json` + `decoded_*.json`，每批 11 文件）。

**Bundle 路径没有保留这种 flat-file raw 抓包** —— 历史逆向工作都是在浏览器里 hook + Tampermonkey 跑，没把 POST body / OB 响应往磁盘存。

但 Bundle 有它自己的"真实数据 + 等价物"：

| 类型 | 路径 | 数量 | 价值 |
|---|---|---|---|
| ✅ 真实鼠标轨迹 | [`mouse_tracks/`](mouse_tracks/) | 5 条 | 真人按压抓取的 ~544 点轨迹 |
| ✅ EV payload 模板 | [`ev_templates/`](ev_templates/) | 5 个 | 4 个 Bundle EV 模板 + 1 个跨平台 generic |
| ✅ 行为合成工具 | [`helpers/`](helpers/) | 6 个 | 错误栈 / 缅甸文 / WASM 提取运行 / userscript 构建 |
| ✅ WASM 二进制 | [`wasm/`](wasm/) | 60862 字节 | 真 px_captcha.wasm + 分析文档 |
| ❌ raw POST body | — | 0 | 没保存（历史遗留） |
| ❌ raw OB response | — | 0 | 没保存 |

如果未来你想抓 raw Bundle 流量做 flat-file sample（跟 ifood/sample/N/ 同款），见 [§4](#4-后续怎么补真-raw-抓包) 的抓包脚本规划。

---

## 1. 目录结构

```
bundle/stample/
├── README.md              本文件
│
├── mouse_tracks/          ⭐ 5 条真实抓取的鼠标轨迹
│   ├── track_001.json    一条按压轨迹（含 544 点 + 时间戳）
│   ├── track_002.json    同上
│   ├── track_003.json
│   ├── track_004.json
│   ├── track_005.json
│   ├── mouse_trajectory.js  贝塞尔曲线生成器
│   ├── generate_tracks.js    合成轨迹工具
│   └── gen_mouse_pool.js     轨迹池构建工具
│
├── ev_templates/          ⭐ Bundle EV payload 模板（5 个）
│   ├── bundle#1.js       Bundle#1 EV 16 字段模板
│   ├── bundle#2.js       Bundle#2 EV 228 字段模板（含真实指纹哈希）
│   ├── bundle#3.js       Bundle#3 EV 5 事件模板
│   ├── bundle#4.js       Bundle#4 telemetry 模板
│   └── bundle3_generic.js  跨平台版（参数化所有常量）
│
├── helpers/               ⭐ 行为合成 + WASM 工具
│   ├── error_stack.js     4 组 V8 错误栈模板生成
│   ├── myanmar_encode.js  DOM tag → 缅甸文 Unicode 编码
│   ├── extract_wasm.js    从 captcha.js 提取 WASM
│   ├── run_wasm.js        Node.js 运行 WASM（含 _pxUuid mock）
│   ├── gen_bundle3.js     Bundle#3 完整生成器
│   └── build_userscript.js  用上面所有 helper 构建 Tampermonkey 脚本
│
└── wasm/                  ⭐ WASM 二进制 + 分析
    ├── px_captcha.wasm   60862 字节真 WASM
    ├── extract_wasm.js   提取脚本（跟 helpers/ 同份）
    ├── run_wasm.js       运行脚本（同上）
    └── WASM_ANALYSIS.md  WASM 反编译分析文档
```

## 2. 各子目录详解

### 2.1 `mouse_tracks/` — 5 条真实鼠标轨迹

每条 `track_NNN.json` 是真人在 captcha 按压挑战时**抓出来的完整鼠标轨迹**。格式：

```json
{
  "mouseTrackFull": [
    "532,843,18189",   // x,y,timestamp (ms)
    "431,637,18190",
    ...
    // 通常 540-600 点
  ],
  "mouseTrackFiltered": [
    "532,843,18189",
    "362,514,18195",
    // ~半数采样（每隔一个取）
  ],
  "mouseInteractions": [
    {
      "type": "mouseover",
      "ts":   18200,
      "x":    370,
      "y":    520,
      "target": "DIV"
    },
    // 30+ 项
  ],
  "pointerdown": { "offsetX": 309.5, "offsetY": 17.44, "clientX": 602.5, "clientY": 364, "ts": 37468 },
  "pointerup":   { "offsetX": 309.5, "offsetY": 17.44, "clientX": 602.5, "clientY": 364, "ts": 38936 }
}
```

**用法**：generator 从 5 条池子随机选一条 → 起止点对齐当前按压坐标 → 时间戳重新分布 → 加 ±1px ±5ms 抖动 → 注入 Bundle#3 PX561 字段。

⚠️ **5 条池子太小**，跑 50+ 会话被 PX 长期行为分析聚类（坑 #B19）。生产建议扩到 50-100 条。

工具：
- `mouse_trajectory.js` — 三次贝塞尔曲线 544 点合成器
- `generate_tracks.js` — 批量合成新轨迹
- `gen_mouse_pool.js` — 把多条真抓 + 合成混合成轨迹池

### 2.2 `ev_templates/` — Bundle EV payload 模板

这些**不是 raw 抓包**，是**逆向后整理的 EV 数据结构** —— 跟 Collector 路径的 `decoded_payload_*.json` 类似但是 JS 代码形式（含字段含义注释 + 动态计算逻辑）。

| 文件 | 行 | 含 EV 字段数 | 内容 |
|---|---|---|---|
| `bundle#1.js` | 27 | 16 | `buildBundle1Event(uuid)` — 初始指纹 |
| `bundle#2.js` | 254 | 228 | `buildBundle2Event(opts)` — 完整指纹 + state.* + PoW + WASM |
| `bundle#3.js` | 631 | 5 事件（78+20+95+27+24=244 字段） | `buildBundle3Events(opts)` — 按压挑战 |
| `bundle#4.js` | 159 | telemetry | `buildBundle4Event(...)` — 错误上报 |
| `bundle3_generic.js` | 575 | 同 #3 | 跨平台版（所有常量参数化） |

每个文件顶部都有详细注释，举例 `bundle#2.js` 的字段都标了类型 + 来源 + 是否需要每次生成：

```js
"JxwXHWF2Ey4=": opts.serverTs,       // #1  ob 服务器时间戳
"GC8oLl1DLxs=": 1,                   // #2  blockScript flag（写死）
"DXJ9M0sVcgU=": "TypeError: ...",   // #4  error stack（需跟 SDK 版本对齐）
"eyBLYT1GTFc=": "4f19f01bd85bb...",  // #10 综合指纹 MD5（同浏览器 profile 写死）
"EwhjCVZnZTM=": opts.obAppId,        // #11 ob appId（每会话变）
// ...
```

**用途**：
1. 拿这些当 generator 的起点（不用从零写）
2. 学习 EV 字段的语义
3. 跨平台移植时改 base64 key + 常量哈希

### 2.3 `helpers/` — 行为合成 + WASM 工具

Bundle 路径独有的 5 件套实现：

| 文件 | 行 | 功能 |
|---|---|---|
| `error_stack.js` | 61 | 4 组 V8 错误堆栈模板生成 |
| `myanmar_encode.js` | 86 | DOM tag 计数 → JSON → XOR(4210) → base64 → 缅甸文字符 |
| `extract_wasm.js` | 213 | 从 captcha.js 用 10 种解码路径提取 WASM |
| `run_wasm.js` | 251 | Node.js 中跑 WASM（含 `_pxUuid` mock + `instanceof_Window` mock） |
| `gen_bundle3.js` | 166 | Bundle#3 完整生成入口（串联所有 helper） |
| `build_userscript.js` | 1107 | 把所有 helper 打包成 Tampermonkey 油猴脚本 |

详细用法 + 代码注释见各文件顶部。

### 2.4 `wasm/` — WASM 二进制 + 反编译

| 文件 | 大小 | 内容 |
|---|---|---|
| `px_captcha.wasm` | **60862 字节** | 真实 PX WASM 模块（iFood `PXO1GDTa7Q` 当前版） |
| `extract_wasm.js` | 7714 | 提取脚本（同 helpers/） |
| `run_wasm.js` | 10728 | 运行脚本（同 helpers/） |
| `WASM_ANALYSIS.md` | 384 行 | WASM 反编译分析（imports / exports / ChaCha20 seed 提取） |

**WASM SHA-256**：

```bash
sha256sum bundle/stample/wasm/px_captcha.wasm
# → 900a9b07c1de9cf37175a48470f77445dcb8515841d51469c0b24c207c8b090d
```

⚠️ WASM **每 2-3 周更新一次**（坑 #D6）。如果你的 SHA 跟这个不一样，说明 captcha.js 已经升级，需要：
1. 抓新 captcha.js
2. 用 `extract_wasm.js` 提新 WASM
3. 对比 data section 看 ChaCha20 seed 等常量是否变了
4. 重跑 `run_wasm.js` 看 b() 输出是否还对

详见 `bundle/doc/Bundle_完整技术文档.md` §16（SDK 漂移应对）。

## 3. 跟 Collector 路径 (`stample/{ifood,grub}/sample/`) 的对应关系

| Collector 概念 | Bundle 等价物 | 备注 |
|---|---|---|
| `sample/N/request_1.txt` (raw POST body) | ❌ 没有 | 历史遗留，没保存 |
| `sample/N/response_1.json` (raw OB) | ❌ 没有 | 同上 |
| `sample/N/decoded_payload_1.json` | ✅ `ev_templates/bundle#1.js` | EV 结构等价（JS 形式带注释） |
| `sample/N/decoded_payload_2.json` | ✅ `ev_templates/bundle#2.js` | 228 字段 |
| `sample/N/decoded_response_1.json` (state.*) | ⚠️ 部分 | state 提取逻辑见 `bundle/doc/Bundle_完整技术文档.md` §3.5 |
| `sample/N/meta.json` | ⚠️ 部分 | 常量见 `bundle/doc/Bundle_完整技术文档.md` 附录 A |
| `px_cookie/ifood_px3.js` (generator) | ✅ `helpers/gen_bundle3.js` | Bundle 主入口 |
| `script/decode_*.sh` | ⚠️ 待补 | 未来加 Bundle 专用解码 shell 脚本 |
| `script/verify_all.sh` | ❌ 没有 | 因为没 raw 样本可以 verify |
| `source/main.min.js` + `SDK_INFO.md` | ⚠️ Bundle 用 `captcha.js` | 见 [`../source/`](../source/)（待补） |

## 4. 后续怎么补真 raw 抓包

如果未来想把 Bundle 也变成 `stample/{ifood,grub}/sample/N/` 那种 raw flat-file 结构，**需要重新抓包**。流程：

### 4.1 写 Bundle 抓包脚本

`skill/cdp/scripts/capture_via_cdp_ifood_bundle.py`（待补），逻辑：

```python
1. CDP 启 Chrome
2. 跑 trigger_captcha.js 触发 403 + blockScript
3. captcha.js 加载后用 Network domain 拦截：
   - POST /assets/js/bundle?seq=0&rsc=1 → 存 bundle1_request.txt
   - 响应 → 存 bundle1_response.json
   - 同样 seq=1/2/3 → bundle2/3/4
4. 用户在 iframe 里按压挑战完成
5. 输出每批：
   bundle_samples/N/
     bundle1_request.txt
     bundle1_response.json
     bundle2_request.txt
     bundle2_response.json
     bundle3_request.txt
     bundle3_response.json
     bundle4_request.txt    （可选，看是否发了）
     meta.json
```

### 4.2 写解码闭环

`bundle/script/decode_bundle.sh`（待补）：

```bash
# 用 revers/ 模块解码 bundle/stample/sample/N/ 全部
node ../../skill/AI_re/scripts/decode_payload.js bundle_samples/$N/bundle1_request.txt \
    > bundle_samples/$N/decoded_payload_1.json
# 同 #2 #3
node ../../skill/AI_re/scripts/decode_response.js TAG bundle_samples/$N/bundle1_response.json \
    > bundle_samples/$N/decoded_response_1.json
# 同 #2 #3
```

### 4.3 跨批 diff

抓 6+ 批后跑：
```bash
node ../../skill/AI_re/scripts/diff_samples.js bundle_samples/{1..6}/decoded_payload_2.json
# → 字段三分类：STATIC ~160, DYNAMIC ~50, CONDITIONAL ~18
```

## 5. 配套资源

| 想看什么 | 去哪 |
|---|---|
| Bundle 完整技术文档 | [`../doc/Bundle_完整技术文档.md`](../doc/Bundle_完整技术文档.md)（5038 行） |
| Bundle 踩坑（20 条专属） | [`../../bug_report/2_bundle_path.md`](../../bug_report/2_bundle_path.md) |
| 算法层模块 | [`../../revers/`](../../revers/)（Bundle 沿用 7 个，待补 pow.js + wasm.js） |
| AI agent 逆向 skill | [`../../skill/AI_re/`](../../skill/AI_re/) |
| 抓包 skill | [`../../skill/cdp/`](../../skill/cdp/) |
| Collector 路径对照 | [`../../stample/ifood/`](../../stample/ifood/) / [`../../stample/grub/`](../../stample/grub/) |

---

## 6. 完整性校验

```bash
# 1. 5 条鼠标轨迹存在
ls -la bundle/stample/mouse_tracks/track_*.json
# 期望: 5 个文件，每个 ~10 KB

# 2. EV 模板存在
ls -la bundle/stample/ev_templates/bundle*.js
# 期望: 5 个文件（bundle#1-4 + bundle3_generic）

# 3. WASM SHA 还是当前版
sha256sum bundle/stample/wasm/px_captcha.wasm
# 期望: 900a9b07c1de9cf37175a48470f77445dcb8515841d51469c0b24c207c8b090d

# 4. WASM magic 头正确
xxd bundle/stample/wasm/px_captcha.wasm | head -1
# 期望开头: 0061 736d 0100 0000 (= \0asm 01 00 00 00)
```

---

*建立时间 2026-05-21。本目录是 Bundle 路径所有"非 raw 抓包"形式的资产汇总。raw 抓包未来抓到了补到 `sample/` 子目录（参考 [§4](#4-后续怎么补真-raw-抓包)）。*
