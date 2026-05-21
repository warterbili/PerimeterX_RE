# Bundle 油猴脚本

> ⚠️ 只保留 1 个 —— `px_bundle3_auto.user.js`，2131 行 / 237 KB，**实战 10/10 通过的成品**。
>
> 之前我（AI）写过 5 个编出来的脚本占了位，已经清理。**这里只剩 1 个真东西**。

## `px_bundle3_auto.user.js` — 完整纯算过按压

**核心思想**："纯算过按压"≠"模拟点按钮"。让 PX SDK 自己发 Bundle#1/#2 → 我们 hook 拦截响应 → **自己算 Bundle#3 直接 fetch() POST 出去**。完全不碰按压按钮。

### 内嵌的全套自包含组件

```
Part 1: 纯 JS SHA256（同步 PoW solver）              line 23-79
Part 2: 内嵌全套 reverse 模块                       line 82-695
   ─ ob.js (decodeOb, executeSegments, writePx3Cookie, processOb)
   ─ payload.js (serialize, b64, interleave, generatePayload)
   ─ pc.js (MD5, HMAC-MD5, generatePC)
   ─ sid.js (hh, generateSid)
   ─ uuid / solvePow / ml / xorStr

Bundle #3 Generic Events Builder                   line 696-1264
   ─ Event #0 浏览器指纹 (78 字段)
   ─ Event Metrics ⭐ (18 字段)
   ─ Event #1 鼠标交互 (20 字段)
   ─ Event #2 PX561 核心 (95 字段)
   ─ Event #3 Captcha 完成回调 (27 字段)
   ─ Event #4 PX11994 交互总结 (24 字段)
   ─ buildBundle3Events() / buildOpts()

Part 3: fetch/XHR Hook 拦截 B1/B2                   line 1266-1615

Part 3.5: iframe Hook + appendChild MutationObserver  line 1617-2090
   ─ hookIframeXHR(iframe)  ← captcha 在 iframe，必须 hook
   ─ Hook appendChild — 同步检测 iframe 插入

Console 控制台 API                                  line 2091-2131
   ─ __pxAutoState
   ─ __pxCaptchaState
   ─ __pxBuildB3()
   ─ __pxReset()
```

### 安装

1. 浏览器装 [Tampermonkey](https://www.tampermonkey.net/)
2. 在 Tampermonkey Dashboard → 加新脚本 → 把 `px_bundle3_auto.user.js` 内容贴进去 → 保存

### 用法

```
1. 装脚本（步骤如上）
2. 打开 https://www.ifood.com.br/
3. 浏览或主动让 PX 后端把你评分到 Bundle 挑战（业务 API 跑 ~200 次 → 收到 blockScript）
4. 脚本自动:
   - 拦截 Bundle#1 → 解 OB#1 → 提 state.* + PoW 参数
   - 算 PoW (~9-60ms 同步 SHA-256 暴力)
   - 跑 WASM a() / b(powAnswer)
   - 拦截 Bundle#2 → 解 OB#2 → 拿到首版 _px3 (jf=cu)
   - 自己构造 Bundle#3 (6 个事件) → fetch POST 直接发
   - 拦截 Bundle#3 响应 → 提取有效 _px3 → 写 document.cookie
5. F12 控制台看 [PX-AUTO] 日志

控制台命令:
  > __pxAutoState           看主页面拦截状态
  > __pxCaptchaState        看 captcha iframe 状态
  > __pxBuildB3()           手动触发 B3 构建（debug 用）
  > __pxReset()             重置全部状态
```

## 来源 + 历史

| 时间 | 事件 |
|---|---|
| 2026-03-01 | `sourcing-cracked` 首次 commit (`f256b7e`)，2131 行 user.js |
| 2026-04-02 | `007623b` cleanup 提交里**直接删了这个 user.js**（同时加入 build_userscript.js 构建器 + crypto_hook.user.js） |
| 2026-04-02 → 2026-05-21 | 成品孤本只存在 git 历史 + GitHub `warterbili/px3cookie` 镜像里。build_userscript.js 有 line 319 转义语法错跑不通 |
| 2026-05-21 | 从 git f256b7e 提取恢复到本目录。SHA `a432e016422233cc1b61790b4dc99991da9579244ec40092ccbdddb52ecdd744` |

SHA 跟 git f256b7e 原版**byte-for-byte 一致**。

## 跟 build_userscript.js 的关系

`../../stample/helpers/build_userscript.js` 理论上是用来从 WASM base64 + 5 条轨迹 + generator 代码**重新构造**这个 user.js 的"构建器"。但：

- ⚠️ **line 319 模板字符串嵌套转义错跑不通**
- ⚠️ Bundle 已归档，**不计划修**这个构建器

如果未来 PX 推新 SDK 要 regenerate user.js：
- 选项 A: 手动改这个 2131 行成品（费力但可行）
- 选项 B: 先修 build_userscript.js 的 line 319（要懂模板字符串嵌套转义）

实际上构建器代码 stample/helpers/build_userscript.js 现在也删了（归档时清掉了，只剩 user.js 自己）。

## 配套

| 想看什么 | 去哪 |
|---|---|
| Bundle 完整技术文档 | [`../../doc/Bundle_完整技术文档.md`](../../doc/Bundle_完整技术文档.md) |
| WASM 二进制 | [`../../source/px_captcha.wasm`](../../source/px_captcha.wasm) |
| Bundle 路径踩坑（20 条） | [`../../../bug_report/2_bundle_path.md`](../../../bug_report/2_bundle_path.md) |

---

*这是 Bundle 路径唯一保留的实战脚本。其它编出来的占位都清掉了。*
