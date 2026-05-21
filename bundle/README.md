# Bundle 路径 — PerimeterX 按压挑战的完整解构

> **作者寄语**：这是项目里**最深入也最早做**的一部分。Bundle（PX 按压挑战）是我第一个攻克的 PX 路径，后来发现 Collector 无感路径能覆盖 99% 业务需求，Bundle 进入维护性归档。
>
> **但保留下来作完整知识档案**：它是项目"PX 全貌"的另一半，**任何想深入研究 PX 反爬系统的人都该读这一部分**。Collector 让你拿到 cookie；Bundle 让你**理解 PX 的全部牌**。
>
> **校验**：iFood Bundle 2026-02 实战 **10/10 通过**。当前文档基于真实抓包 + 真实成品。

---

## 5 分钟决定要不要继续读

### 你应该读这部分如果……

✅ 你已经做完 Collector 路径（[`../stample/ifood/px_cookie/`](../stample/ifood/px_cookie/)），想知道"PX 的另一半"是什么
✅ 你想完整理解 PX 反爬系统的**全部 5 个独家算法**（PoW / WASM / 贝塞尔轨迹 / 缅甸文 DOM / V8 错误栈）
✅ 你想了解"WebAssembly 在反爬里的实际用法"
✅ 你要做一个**学术研究**或**安全审计**，需要"全栈"PX 知识
✅ 你目标站的 PX 评分严格，**Collector 路径不够**，需要 Bundle fallback

### 你可以跳过这部分如果……

❌ 你只想拿到 `_px3` 跑业务 API，Collector 路径已经搞定
❌ 你的业务量小（< 几十次/天），用 Playwright + 真按压就行
❌ 你不需要"理解"PX，只要"能用"

---

## 学习路径：4 个深度

按你想花的时间挑：

| 深度 | 时间 | 你能掌握 | 怎么走 |
|---|---|---|---|
| **L1 — 速览** | **15 分钟** | Bundle 是什么 + 跟 Collector 差异 + 5 个独家算法 | 读本 README + [`doc/Bundle_完整技术文档.md`](doc/Bundle_完整技术文档.md) §1 |
| **L2 — 跑通油猴脚本** | **30 分钟** | 在浏览器里跑通成品 → 拿到 `_px3` | 装 [`script/userscripts/px_bundle3_auto.user.js`](script/userscripts/px_bundle3_auto.user.js) |
| **L3 — 完整理解** | **8-16 小时** | 看懂主文档 + 油猴脚本 + 真抓样本，能 review 别人的 Bundle 代码 | 读 [`doc/Bundle_完整技术文档.md`](doc/Bundle_完整技术文档.md) 4996 行 + 看 [`stample/`](stample/) 真抓样本 |
| **L4 — 从 0 重做** | **40-66 小时** | 自己能从零写一个 Bundle generator，支持新站点移植 | 跟着 [`../main/ZH/PX_Bundle_逆向方法论.md`](../main/ZH/PX_Bundle_逆向方法论.md) 8 阶段走一遍 |

⚠️ **L3 和 L4 之前必须先做 Collector**。Bundle 跟 Collector 共享 70% 算法，没 Collector 基础直接做 Bundle 实测**多花 3 周**。

---

## 决策树："我想……"

按你的目的挑下一步：

### "我想 30 分钟内拿到 `_px3`"

→ 安装 [`script/userscripts/px_bundle3_auto.user.js`](script/userscripts/px_bundle3_auto.user.js)（2131 行实战成品，10/10 通过）
→ 访问 iFood / Grubhub → 让 PX 自然触发挑战 → 脚本自动拿 cookie

⚠️ 跑这个**不要求懂 Bundle 原理**，会 Tampermonkey 装脚本就行。

### "我想理解 Bundle 是怎么工作的"

→ 读 [`doc/Bundle_完整技术文档.md`](doc/Bundle_完整技术文档.md) **§1-§2**（30 分钟，覆盖总览 + 协议层）
→ 想再深就继续读 **§3-§7**（Bundle#1/#2/#3 + PoW + WASM）
→ 想看实战字段就跳到 **§10**（229 字段完整分类）

### "我想看真实抓包数据"

→ [`stample/sample/`](stample/sample/) — 4 个 Bundle POST raw + 4 个 OB 响应
→ [`stample/decoded/`](stample/decoded/) — 8 个解码后 JSON（EV payload + state）
→ [`stample/mouse_tracks/`](stample/mouse_tracks/) — **50 条真实人按压的鼠标轨迹**（每条 540+ 点）

### "我想看 captcha.js 真文件"

→ [`source/captcha.js`](source/captcha.js)（821 KB 真 SDK）
→ [`source/px_captcha.wasm`](source/px_captcha.wasm)（60862 字节 WASM 二进制）
→ [`source/SDK_INFO.md`](source/SDK_INFO.md) 看 SHA + 提取方法 + 常量

### "我想从 0 学怎么逆向 Bundle"

→ 先做完 Collector（看 [`../main/ZH/PX_逆向方法论_通用版.md`](../main/ZH/PX_逆向方法论_通用版.md)）
→ 然后读 [`../main/ZH/PX_Bundle_逆向方法论.md`](../main/ZH/PX_Bundle_逆向方法论.md)（**973 行专门教 Bundle**，8 阶段）

### "我想看 PX 拒绝 Bundle 是什么样"

→ [`../bug_report/2_bundle_path.md`](../bug_report/2_bundle_path.md) — Bundle 路径 20 条实战踩坑
→ 主文档 [`doc/Bundle_完整技术文档.md`](doc/Bundle_完整技术文档.md) **§15** — 失败诊断决策树

### "我想 review 或修 油猴脚本"

→ 读 [`script/userscripts/README.md`](script/userscripts/README.md) — 2131 行脚本的内部架构
→ 主文档 **§13** — userscript 工作流详解（拦截 B1/B2 + 自构 B3）

### "我想跨平台移植 Bundle 到新站点"

→ 主文档 **§14** — 跨平台移植 7 步法
→ 方法论 [`../main/ZH/PX_Bundle_逆向方法论.md`](../main/ZH/PX_Bundle_逆向方法论.md) **§15** — Bundle 独家 12 步移植

### "PX 推了新 SDK，我现在生成器跑不通"

→ 主文档 **§16** — SDK 漂移应对
→ 方法论 [`../main/ZH/PX_Bundle_逆向方法论.md`](../main/ZH/PX_Bundle_逆向方法论.md) **§16** — Bundle SDK 升级响应

### "我想做学术研究 / 安全审计"

→ 主文档 **§18** — 外部资源 + Pr0t0ns v8.9.6 完整对照（业界其它独立逆向作品）
→ [`../bug_report/`](../bug_report/) — 68 条踩坑全集（项目最独家资产）
→ 主文档 **§20** — Mobile SDK 对比（PX Web vs Android/iOS）

### "我想用 AI（Claude / Cursor）来做 Bundle 逆向"

→ [`../skill/AI_re/`](../skill/AI_re/) — AI agent skill（playbook + 工具）
→ 但**说实话**：AI 单独做 Bundle 成功率 20-40%。建议人 + AI 配合（详见主文档 §13.6）

---

## 当前状态

| 维度 | 状态 |
|---|---|
| 整体 | **归档**（2026-05 之后不主动维护，但保留完整知识） |
| 主文档 | ✅ `doc/Bundle_完整技术文档.md` (4996 行) |
| Bundle 方法论 | ✅ `../main/ZH/PX_Bundle_逆向方法论.md` (973 行) |
| 油猴脚本 | ✅ `script/userscripts/px_bundle3_auto.user.js` (2131 行实战 10/10) |
| 源代码（captcha.js + WASM） | ✅ `source/` (8 文件) |
| 真抓样本 | ✅ `stample/sample/` 8 文件 + `stample/decoded/` 8 文件 |
| 鼠标轨迹池 | ✅ `stample/mouse_tracks/` 50 条真实轨迹 + 工具 |
| Bundle EV 模板 + helpers | ✅ `stample/ev_templates/` 5 个 + `stample/helpers/` 6 个 |
| 不再更新 | Node 端 generator（user.js 已自包含）<br>验证脚本 (script/ 不再扩 CLI)<br>多版本 captcha.js 跟版 |

---

## 目录结构

```
bundle/                          95 文件，2.3 MB
├── README.md                    本文件
│
├── doc/
│   └── Bundle_完整技术文档.md    ⭐ 主文档 4996 行
│
├── source/                       SDK 真源（8 文件）
│   ├── captcha.js                Bundle 主 SDK 真文件 821 KB
│   ├── px_captcha.wasm           WASM 二进制 60862 字节
│   ├── main_legacy_with_captcha.js   老版 PX SDK（captcha 合体）
│   ├── captcha_html_request.txt  captcha 加载抓包元数据
│   ├── captcha_js_request.txt
│   ├── captcha_response.txt
│   ├── SDK_INFO.md               常量 + SHA + 提取方法
│   └── WASM_ANALYSIS.md          WASM 反编译分析
│
├── stample/                      真实数据
│   ├── sample/                   8 文件（4 Bundle POST + 4 OB 响应）
│   ├── decoded/                  8 文件（4 EV JSON + 4 state JSON）
│   ├── ev_templates/             5 文件（bundle#1-4 EV builder + generic）
│   ├── helpers/                  6 文件（error_stack/myanmar/extract_wasm/run_wasm/gen_bundle3/build_userscript）
│   └── mouse_tracks/             54 文件
│       ├── track_001-050.json    50 条真实抓取的鼠标轨迹
│       ├── mouse_pool.json       合并的轨迹池
│       └── 3 个工具 .js (generate/mouse_trajectory/gen_mouse_pool)
│
└── script/
    ├── README.md
    └── userscripts/
        ├── README.md
        └── px_bundle3_auto.user.js   ⭐⭐⭐ 实战 10/10 油猴脚本（2131 行）
```

---

## 历史 + 版本

| 时间 | 事件 |
|---|---|
| 2026-Q1 | Bundle 路径首次完整逆向（iFood，4 周工作） |
| 2026-02 | px_bundle3_auto.user.js 10/10 通过测试 |
| 2026-03 | 沉淀进 sourcing-cracked git 仓库（commit `f256b7e`） |
| 2026-04 | `007623b` cleanup 提交期望用 build_userscript regenerate，但构建器 bug，成品孤本只剩 git history |
| 2026-05 | Collector 路径完全跑通，Bundle 实质归档 |
| 2026-05-21 | 资料整理进 `perimeter/bundle/`，写主文档 + 方法论 + 学习引导（本次） |

---

## 跟项目其它部分的关系

| 资源 | 路径 | 何时去 |
|---|---|---|
| **Collector 主路径**（活跃维护） | [`../stample/ifood/`](../stample/ifood/) / [`../stample/grub/`](../stample/grub/) | 你的实际生产用 |
| 算法模块（9 个，Bundle 复用 7 个） | [`../revers/`](../revers/) | 看具体算法 |
| Collector 完整文档 | [`../main/ZH/`](../main/ZH/) | 学 Collector |
| Bundle 方法论 | [`../main/ZH/PX_Bundle_逆向方法论.md`](../main/ZH/PX_Bundle_逆向方法论.md) | 学 Bundle 怎么从 0 做 |
| 踩坑全集（68 条含 Bundle 20 条） | [`../bug_report/`](../bug_report/) | 排查问题 |
| AI agent skill | [`../skill/AI_re/`](../skill/AI_re/) | 用 AI 辅助逆向 |
| CDP 抓包 skill | [`../skill/cdp/`](../skill/cdp/) | 抓真实流量 |

---

## 作者寄语 / 给观众的话

我做 Bundle 时，前 3 周完全在 WASM 这一关卡死 —— Node 模拟环境怎么 mock、`globalThis._pxUuid` 必须 instantiate 之前设置、`__wbg_instanceof_Window` 必须返 1，每一个都是几小时 debug 才发现。

后来做 Collector 时发现"算法层 3 年不变"这个 insight —— 把方法论建立在 MD5/HMAC/UUID 标准常量上，而不是 PX 的混淆函数名。这个认知让我**重做 Collector 只花 1 周**。

Bundle 之所以归档不是因为它不重要，而是 **Collector 已经覆盖 99% 业务需求**，Bundle 维护成本（每 2-3 周跟 captcha.js 升级）划不来。

**但 Bundle 仍然是项目的灵魂部分** —— 它展示了 PX 反爬系统的**全部独家算法**。一个只懂 Collector 的人不算完整懂 PX。如果你想做反爬研究 / 写文章 / 教学，Bundle 这部分的内容含金量比 Collector 高得多（因为业界写过 Bundle 的人远少于写 Collector 的）。

**祝你逆向愉快**。如果跑通了 [`px_bundle3_auto.user.js`](script/userscripts/px_bundle3_auto.user.js) 拿到了 `_px3`，那一刻你会理解为什么这个项目叫"perimeter" —— 你已经穿过了 PX 设的全部外围防线。

---

*文档校验时间：2026-05-21。本目录所有内容均来自实战 10/10 验证（除标 ⚠️ 的 build_userscript.js 跑不通的构建器）。*
