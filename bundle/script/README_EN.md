# Bundle Script — Archived

> ⚠️ **Directory trimmed**: the previous 8 CLI tools (decode/diff/verify) have all been deleted — the Bundle path is no longer actively maintained.
>
> What remains: **1 userscript**.

## Contents

```
bundle/script/
├── README.md                       This file
└── userscripts/
    ├── README.md
    └── px_bundle3_auto.user.js     ⭐ The sole retained Bundle userscript (2,131-line artifact)
```

## Usage

See [`userscripts/README.md`](userscripts/README.md).

## Why the CLIs Were Deleted

There used to be 8 scripts:
- `decode_bundle.sh` / `decode_all.sh` — decode raw captures (we already have 4 batches in `../stample/sample/`; no new ones to decode)
- `extract_wasm.sh` / `run_wasm_test.sh` — WASM extract & test (no longer upgrading WASM)
- `solve_pow.sh` — PoW unit test (no longer debugging)
- `diff_bundle.py` / `find_bundle_state_keys.py` / `compare_my_bundle3.py` — cross-batch analysis (no new batches)

All "use-when-future-captures-arrive" tools. **Bundle is archived; no more captures**, so deleted.

If Bundle is ever rebuilt, refer to:
- [`../../stample/ifood/script/`](../../stample/ifood/script/) Collector-equivalent scripts (same idea)
- [`../../skill/AI_re/scripts/`](../../skill/AI_re/scripts/) Generic CLI (not Bundle-specific, but reusable)

## Relationship to Main Path

| Asset | Path |
|---|---|
| Main doc | [`../doc/Bundle_完整技术文档.md`](../doc/Bundle_完整技术文档.md) |
| Source materials (captcha.js + WASM) | [`../source/`](../source/) |
| Real captures | [`../stample/`](../stample/) |
| Userscript artifact | [`userscripts/px_bundle3_auto.user.js`](userscripts/px_bundle3_auto.user.js) |
