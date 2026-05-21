# SDK 版本漂移 — 踩坑全集

PX 每周/每月推 SDK，**算法层 3 年没动，但表面层每次都换**。这一页讲哪些
东西不能跨版本硬编码，每次升级都得重新提取。

跟一次性 debug 的坑不同，这一类是**结构性**问题——你写代码时就该按这些
规则避开，否则下次 SDK 升级整个 generator 都得重写。

---

### #D1 ⭐⭐⭐ Handler 名 + 行号 + 变量名跨版本必变

**症状**：文档里写"`Zf` 函数在第 4384 行"，新 SDK 出来既没有 `Zf` 也没有第 4384 行那段代码。

**根因**：PX 混淆每次推 SDK 都重新跑：
- 变量名（`Zf`, `yI`, `_O1GDTa7Qhandler` 等） — 几乎必变
- 函数体顺序（行号） — 必变
- handler key 字符串（`I0I0I0`, `oIIoII` 等） — 必变

**修复**：**不要按名字定位**，按**形状**定位：
- 函数：按参数个数 + 类型 + 返回值类型 grep（见 [`skill/AI_re/references/locate-by-pattern.md`](../skill/AI_re/references/locate-by-pattern.md)）
- 算法：按**魔法常量**定位（MD5 init `1732584193`、HMAC ipad `909522486`、UUID v1 `122192928e5`、INT32_MAX `2147483647`）—— **这些 3 年没动过**
- OB handler：按 args shape 匹配（见 [`skill/AI_re/references/handler-table.md`](../skill/AI_re/references/handler-table.md)），不按 handler 名

**来源**：Desktop/新建文件夹/px-reverse-skill/references/gotchas.md；多处档案确认

---

### #D2 ⭐⭐⭐ OB wire 字符集每版本/客户变

**症状**：手动定位 OB handler 名时按 `l0l0ll` grep 没有结果，新 SDK 用 `oIIoII`。

**根因**：PX 在不同版本/客户用不同字符集做 wire 编码：
- 老版 iFood：`o` / `1`（小写 o + 数字 1）
- 新版 iFood：`0` / `l`（数字 0 + 小写 L）
- Grubhub 当前：`I` / `o`（大写 I + 小写 o）

**修复**：从真实 OB decode 输出**动态**判断字符集，不要硬编码。Handler 形状匹配按 args 类型/数量做，**不依赖字符集**。

**来源**：Desktop/新建文件夹 (3)/docs/_gotchas_grubhub.md:145-154

---

### #D3 ⭐⭐⭐ EV1/EV2 b64 key 字典每次 SDK 升级全部重排

**症状**：硬编码的 b64 key → 字段值映射，跟新 SDK 真 payload 对不上。

**根因**：229 个 b64 key 是 SDK 里通过"基础数组 + 旋转 + offset 查表"动态生成的。PX 每次 build 都重新生成数组 / 改 offset，整张表全变。

**修复**：
- 每次 SDK 升级用 `skill/AI_re/scripts/extract_hQ.js` 从新 SDK 提字典
- 或拿 6 批新抓包跑 `find_state_keys.py` 做跨批值匹配
- **绝对不要把 b64 key → 字段语义的映射写进 generator 当常量**

**修复——更稳的做法**：generator 用"模板法"——保留真抓的 EV2 当 template，只覆盖少数 DYNAMIC 字段。模板里的 b64 key 跟当前 SDK 一致 = 自动跟版。

**来源**：`ifood-web/collector无感纯算还原/纯算还原.md:454-455`

---

### #D4 ⭐⭐ 算法层魔法常量 3 年没变 —— 可以放心硬编码

**反向坑**：这条不是"会踩"的坑，而是**容易过度防御**的反例。

**症状**：因为怕 SDK 升级，所有常量都"参数化"传进来，结果代码乱、性能差、bug 多。

**根因**：PX 算法层（payload / PC / OB 编解码 / UUID / Memory）的常量是**算法本身的常量**，不是 PX 自己选的：
- MD5 init `1732584193`、`-271733879`、`-1732584194`、`271733878`
- HMAC ipad `909522486` (0x36363636) / opad `1549556828` (0x5C5C5C5C)
- UUID v1 Gregorian epoch `122192928e5`
- INT32_MAX `2147483647`
- base91 字母表 `F@bt...`（新版 SDK）

**修复**：算法常量**直接写死**。3 年观察下来 PX 从未改过 —— 因为改了就不是 MD5/HMAC/UUID v1 了。

**只要做动态的**：协议常量（TAG / AppID / FT / Cookie 名）+ b64 key 字典 + 字段语义。

**来源**：[`skill/AI_re/references/algorithm-chain.md`](../skill/AI_re/references/algorithm-chain.md)；多处档案

---

### #D5 ⭐⭐ 跨平台移植不能假设字段语义不变

**症状**：iFood generator 直接搬到 Grubhub，逻辑都对但拿不到 `_px2`。

**根因**：哪怕同一类 SDK，不同站点：
- state.* → EV2 b64 key 完全不同（[1_collector_path.md 坑 #19](1_collector_path.md#19)）
- 同语义在 EV1 vs EV2 是不同 key（[1_collector_path.md 坑 #20](1_collector_path.md#20)）
- 字段集大小不同（iFood EV1=14, Grubhub EV1=12；EV2 也差异）
- 协议 POST 次数不同（iFood 3 个 collector POST，Grubhub 2 个）
- OB wire 字符集不同（见 #D2）
- TAG / AppID / FT 不同（协议常量）
- Cookie 名 + TTL 不同（iFood `_px3` ttl 330，Grubhub `_px2` ttl 500）

**修复**：每个站点跑完整流程：
1. CDP 抓 6 批
2. 用 `verify_all.sh` 跑通解码闭环
3. 用 `find_state_keys.py` 找 state.* 注入位置
4. 用 `diff_samples.py` 字段三分类
5. 复制 generator 改 5 个常量 + 改 state.* key

**用 [`skill/AI_re/playbooks/master-workflow.md`](../skill/AI_re/playbooks/master-workflow.md) 的 Stage 0-8 流程，每个 stage 都不能跳。**

**来源**：Desktop/新建文件夹 (3) 全部内容；`stample/grub/` 实战记录

---

### #D6 ⭐⭐ `captcha.js` 升级频率比 `main.min.js` 高得多，Bundle 模板要单独跟版

**症状**：Bundle generator 上周 10/10 通过，这周突然失败一半；`main.min.js` 没变（SHA 同），但 captcha.js 变了。

**根因**：PX 在 `main.min.js`（无感 collector）和 `captcha.js`（按压 bundle）的升级节奏**完全不同**：
- `main.min.js` —— 每月 1-2 次小改
- `captcha.js` —— **每 2-3 周一次**，含 iframe HTML 模板的微调（多 / 少一个 `<img>` tracking pixel 等）

Bundle#3 的"缅甸文 DOM 编码"（坑 #B14）把 captcha iframe 的 DOM 节点数 / tag 类型按 Unicode 编码进去。captcha.js 改个 `<img>` → 计数变 → 模板就废了。

**修复**：
- Bundle generator 跟版要看 **captcha.js 的 SHA**，不是 main.min.js
- 用一套独立的"captcha.js SDK_INFO" + 模板，跟主 SDK_INFO 分开维护
- 每次跑 Bundle 前先 fetch 一次 captcha.js 对 SHA

**通用规则**：**两条路径两份 SDK 版本管理**，不要混。

**来源**：`perimeterX_Re/docs/07_gotchas/19_myanmar_template_drift.md`

---

### #D7 ⭐⭐ Error stack 模板按 **Chrome 大版本**漂移（不只是按 PX SDK）

**症状**：纯算 Bundle 模板在 Chrome 145 上 10/10，换到 Chrome 140 全失败 —— 还是同一个 PX SDK 版本。

**根因**：Error stack（坑 #B15 那 4 组错误）里的行号是 V8 给的，V8 不同版本的函数内联策略不同 → 同样代码的 stack frame 数 / 行号位置都会变。PX 的 captcha.js 编码的"期望 stack 形状"是按当时的主流 Chrome 版本对的，跟 Chrome 大版本绑定。

**修复**：
- 按 Chrome 大版本（145 / 140 / 138 ...）维护多套 error_stack 模板
- generator 根据 outgoing UA 里的 `Chrome/<major>.0.0.0` 选模板
- UA 选哪个 Chrome 版本，就用哪套模板

**通用规则**：你伪装的 UA 是哪个 Chrome 大版本，所有"Chrome 行为模板"（error stack、JS 引擎错误信息、performance.memory 数值范围）都要跟那个版本对应。

**来源**：`perimeterX_Re/docs/04_bundle/10_error_stacks.md` + `12_pure_algo_e2e_gap.md`

---

## 升级流程总览（应对每次 SDK 推新版本）

```
PX 推新 SDK
   ↓
1. 重新抓 SDK → 看 SHA 跟当前 SDK_INFO 是否变 [skill/AI_re/playbooks/identify-sdk-version.md]
   ↓ 变了
2. 跑 verify_all.sh → 9 个 reverse 模块还能不能解新 SDK 抓的 sample
   ↓ 失败
3. 看是算法层还是表面层
   - 表面层（b64 key / handler 字符集 / 行号）→ 重提模板 + 字典，不动 reverse 模块
   - 算法层（XOR seed / 4 tildes / base91 字母表）→ 极少见，但出现就按 reverse-algorithms.md 重新逆向
   ↓
4. 跑 diff_samples.py 看新字段集 → 哪个 DYNAMIC 不一样
   ↓
5. 用 find_state_keys.py 重新校准 state.* → EV2 b64 key
   ↓
6. 更新 generator 里的 state 注入 key + SDK_INFO.md 里的 SHA
   ↓
7. smoke_test.js → 17/17 过 → 实战 10/10
```

详细步骤见 [`skill/AI_re/playbooks/master-workflow.md`](../skill/AI_re/playbooks/master-workflow.md)。

---

*这是踩坑全集的最后一页。*

**完整目录回到 [`README.md`](README.md)。**
