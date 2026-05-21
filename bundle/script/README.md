# Bundle Script — 归档

> ⚠️ **目录精简过**：之前的 8 个 CLI 工具（decode/diff/verify）都删了 —— Bundle 路径不再主动维护。
>
> 现在只剩**1 个油猴脚本**。

## 内容

```
bundle/script/
├── README.md                       本文件
└── userscripts/
    ├── README.md
    └── px_bundle3_auto.user.js     ⭐ 唯一保留的 Bundle 油猴脚本（2131 行成品）
```

## 用法

详见 [`userscripts/README.md`](userscripts/README.md)。

## 为什么删那些 CLI

之前有 8 个脚本：
- `decode_bundle.sh` / `decode_all.sh` — 解 raw 抓包（已有 4 批样本在 `../stample/sample/`，不需要再解新的）
- `extract_wasm.sh` / `run_wasm_test.sh` — WASM 提取与测试（不再升级 WASM）
- `solve_pow.sh` — PoW 单元测试（不再 debug）
- `diff_bundle.py` / `find_bundle_state_keys.py` / `compare_my_bundle3.py` — 跨批分析（不再加新批）

全是"未来抓 raw 时用"的工具。**Bundle 归档了不会再抓**，所以删。

如果有一天要重做 Bundle，参考：
- [`../../stample/ifood/script/`](../../stample/ifood/script/) Collector 同款脚本（思路一致）
- [`../../skill/AI_re/scripts/`](../../skill/AI_re/scripts/) 通用版 CLI（不是 Bundle 专用，但能复用）

## 跟主路径关系

| 资产 | 路径 |
|---|---|
| 主文档 | [`../doc/Bundle_完整技术文档.md`](../doc/Bundle_完整技术文档.md) |
| 源材料（captcha.js + WASM） | [`../source/`](../source/) |
| 真抓样本 | [`../stample/`](../stample/) |
| 油猴成品 | [`userscripts/px_bundle3_auto.user.js`](userscripts/px_bundle3_auto.user.js) |
