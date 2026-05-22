# iFood `_px3` Cookie 生成器

两份 iFood `_px3` cookie 纯算生成器。**同一个 SDK，两种代码风格**。

> 🎯 **看这个目录的研究目的 + 端到端实战例子** → [`../RESEARCH_PURPOSE.md`](../RESEARCH_PURPOSE.md)
> 🚀 **30 秒跑端到端 demo**：`node business_api_demo.js`（_px3 → GraphQL → 真实商家数据）

## 目录

```
px_cookie/
├── README.md
├── smoke_test.js                ← 一键自检脚本（require + 常量 + 模板）
├── business_api_demo.js         ⭐ 端到端真实 API demo（_px3 → GraphQL → 商家数据）
│
├── ifood_px3.js                 (modular 版)
│   ├── ifood_ev1_template.json
│   └── ifood_ev2_template.json
│
└── px_cookie_v2.js              (self-contained 版)
    ├── ev1_template.json
    └── ev2_template.json
```

## 两个版本对比

| 维度 | `ifood_px3.js` | `px_cookie_v2.js` |
|---|---|---|
| 风格 | **模块版** | **单文件版** |
| 文件大小 | 10 KB | 19 KB |
| 行数 | 267 | 281 |
| 依赖 | 7 个 `../../../revers/*.js` 模块 | **零外部依赖**（只 Node 内置） |
| 模板 | `ifood_ev{1,2}_template.json` | `ev{1,2}_template.json` |
| EV2 字段数 | 203（精简） | 204（完整 cold visit） |
| 适用场景 | 跟项目集成、复用 reverse 模块 | 单文件丢哪都能跑 |
| CLI 入口 | `node ifood_px3.js` | 没有，用 `require()` |
| 来源 | legacy `perimeter_X` 项目 generators | 作者本地阶段性档案 |

## 都用同一个 SDK

两份生成器的所有协议常量**完全一致**（已 smoke test 验证）：

```
APP_ID = "PXO1GDTa7Q"
TAG    = "U0MmDhUmOnhXSw=="
FT     = 401
Cookie = _px3
SDK SHA = b47a639cde9df4f91bdc4138ae0d64ebf7ce8c876a1e4c9967fd3af3d2975eb8
```

它们不是不同 SDK 版本，只是**同一份 SDK 的两个生成器实现**。

## 使用

### 方式 1：先跑自检

```bash
cd stample/ifood/px_cookie
node smoke_test.js
# 13/13 ✓ 通过即可
```

### 方式 2：modular 版（推荐项目内使用）

```javascript
const generatePx3 = require('./ifood_px3');

(async () => {
    const r = await generatePx3();
    console.log(r.cookie_name + '=' + r.cookie_value);
    // 输出：_px3=eyJ1IjoiYWJjLi4uIn0=
})();
```

或者直接 CLI：

```bash
node ifood_px3.js
```

输出：

```json
{
  "cookie_name": "_px3",
  "cookie_value": "eyJ1...",
  "ttl": 330,
  "uuid": "...",
  "state": { "no": "...", "to": "...", ... },
  "ev1_fields": 14,
  "ev2_fields": 204
}
```

### 方式 3：self-contained 版（单文件部署）

```javascript
const px = require('./px_cookie_v2');
(async () => {
    const r = await px({ userAgent: 'Mozilla/5.0 ...' });
    console.log(r);
})();
```

可以直接拷 `px_cookie_v2.js` + `ev{1,2}_template.json` 这 3 个文件到任何地方独立跑。

## 用哪个？

| 场景 | 推荐 |
|---|---|
| 在本项目里跟其它模块联调 | `ifood_px3.js`（复用 AI_re/reverse） |
| 需要单文件丢 Lambda / Vercel / Cloudflare Worker | `px_cookie_v2.js` |
| 写测试 / mock 算法 | `ifood_px3.js`（容易 stub 各模块） |
| 想读懂全套算法、不跳来跳去 | `px_cookie_v2.js`（XOR/PC/MD5 全 inline） |

## 验证 SDK 是否还兼容

如果 PX 推了新 SDK，先跑 smoke test：

```bash
node smoke_test.js
# 然后实战:
node ifood_px3.js     # 看返回的 cookie_name == "_px3"
```

如果实战失败：

1. 检查 SDK SHA 是否还是 `b47a639c…` — 见 [`../../../main/ZH/PX_SDK_逆向技术文档.md`](../../../main/ZH/PX_SDK_逆向技术文档.md) §SDK 漂移应对
2. 跑 [`../script/verify_all.sh`](../script/verify_all.sh) — 看解码器还能不能解 6 批 sample
3. 跑 [`../script/diff_samples.py`](../script/diff_samples.py) — 看新 SDK 字段是不是动了

## 配套资源

| 想看什么 | 去哪 |
|---|---|
| 算法原理 | [`../../../main/ZH/PX_SDK_逆向技术文档.md`](../../../main/ZH/PX_SDK_逆向技术文档.md) |
| 用过的 6 批样本 | [`../sample/`](../sample/) |
| diff 调试工具 | [`../script/`](../script/) |
| 通用 reverse 模块 | [`../../../revers/`](../../../revers/) |

---

*来源：legacy `perimeter_X` 项目的 `ifood_px3.js` + 作者本地 `px_cookie_v2.js` 阶段性档案。
两份都对应同一份 iFood SDK（sha256 `b47a639c…`），smoke test 13/13 通过。*
