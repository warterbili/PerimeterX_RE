# Grubhub `_px2` Cookie 生成器

Grubhub `_px2` cookie 纯算生成器（不跑 PX SDK、不开浏览器）。

> 🎯 **看这个目录的研究目的 + 端到端实战例子** → [`../RESEARCH_PURPOSE.md`](../RESEARCH_PURPOSE.md)
> 🚀 **30 秒跑端到端 demo**：`node business_api_demo.js`（_px2 → /auth → 匿名 token）
> ⭐ 关键认知：Grubhub PX 守的是**账号体系**，不是数据接口（Instacart 数据走 `__Host-instacart_sid`，无 PX）

## 目录

```
px_cookie/
├── README.md
├── smoke_test.js                ← 一键自检脚本（require + 常量 + 模板）
├── business_api_demo.js         ⭐ 端到端真实 API demo（_px2 → /auth → 匿名 token）
├── grubhub_px2.js               ← 生成器主体
├── grubhub_ev1_template.json    ← EV1 模板（12 字段，从 6 批抓包构建）
└── grubhub_ev2_template.json    ← EV2 模板（204 字段）
```

## 常量

跟 `../source/SDK_INFO.md` 完全同步（`smoke_test.js` 会强制校验）：

```
APP_ID  = "PXO97ybH4J"
TAG     = "FmYgK1gdJEAP"
FT      = 359
Cookie  = _px2  (TTL 500)
Collector = https://sensor.grubhub.com/O97ybH4J/xhr/api/v2/collector
SDK SHA = 4accf1a5f251a924856784815e9e1032b37f37d6756138c3c7550621960e5301
```

> ⚠️ 旧文档把 AppID 写成 `PXdRotaCw0` / FT 写成 `330` —— 都错。
> 见 [`../source/SDK_INFO.md`](../source/SDK_INFO.md)。

## 使用

### 方式 1：先跑自检

```bash
cd stample/grub/px_cookie
node smoke_test.js
# 17/17 ✓ 通过即可
```

### 方式 2：在项目里 `require`

```javascript
const generatePx2 = require('./grubhub_px2');

(async () => {
    const r = await generatePx2();
    console.log(r.cookie_name + '=' + r.cookie_value);
    // 输出：_px2=eyJ1IjoiYWJjLi4uIn0=
})();
```

### 方式 3：CLI

```bash
node grubhub_px2.js
```

输出：

```json
{
  "cookie_name": "_px2",
  "cookie_value": "eyJ1...",
  "ttl": 500,
  "uuid": "...",
  "state": { "no": "...", "to": "...", "appId": "...", ... },
  "ev1_fields": 12,
  "ev2_fields": 204
}
```

## 模板法核心思路

EV1/EV2 大部分字段每批都一样（STATIC）。手写 200 字段错一个就 403，所以：

1. 从 6 批真抓的 `decoded_payload_*.json` 取一份做 base template
2. 只覆盖 ~20 个 DYNAMIC 字段（时间戳、UUID、HMAC、内存数等）
3. **state.\* 注入到 EV2 的位置跟 iFood 完全不同** —— Grubhub 用：
   - `state.no` → `UT0ndxdcJUQ=`（iFood 是 `RTEwewNQMUg=`）
   - `state.to` → `UBxmVhZ+Z2U=`（iFood 是 `FCAhKlJCIxk=`）
   - `state.appId` → `CXV/P0wRfwU=`（iFood 是 `Xi5rJBtKaB4=`）

```javascript
tpl['UT0ndxdcJUQ=']  = parseInt(state.no);   // ⭐ 必须 parseInt！
tpl['UBxmVhZ+Z2U=']  = state.to;
tpl['CXV/P0wRfwU=']  = state.appId;
```

4. 重定位 anti-tamper key/value（保持模板里原位置！）

详细方法论见
[`../../../skill/AI_re/playbooks/build-generator.md`](../../../skill/AI_re/playbooks/build-generator.md)。

## 验证 SDK 是否还兼容

如果 PX 推了新 SDK，先跑 smoke test：

```bash
node smoke_test.js
# 然后实战：
node grubhub_px2.js     # 看返回的 cookie_name == "_px2"
```

实战失败时按 [`../script/`](../script/) 决策树：

1. 检查 SDK SHA 是否还是 `4accf1a5…` — 见 [`../../../main/ZH/PX_SDK_逆向技术文档.md`](../../../main/ZH/PX_SDK_逆向技术文档.md) §SDK 漂移应对
2. 跑 [`../script/verify_all.sh`](../script/verify_all.sh) — 看解码器还能不能解 6 批 sample
3. 跑 [`../script/diff_samples.py`](../script/diff_samples.py) — 看新 SDK 字段是不是动了
4. 跑 [`../script/find_state_keys.py`](../script/find_state_keys.py) — 看 state.* → EV2 key 映射有没有变

## 跟 iFood generator 的差异

| 维度 | iFood | Grubhub |
|---|---|---|
| 入口 | `ifood_px3.js` | `grubhub_px2.js` |
| 模板 | `ifood_ev{1,2}_template.json` | `grubhub_ev{1,2}_template.json` |
| 模板字段数 | 14 / 204 | 12 / 204 |
| 拿到的 cookie | `_px3` (TTL 330) | `_px2` (TTL 500) |
| 一次会话 POST 数 | 3（用了 EV3） | 2 |
| state 注入位置 | iFood-specific keys | Grubhub-specific keys（见上） |
| 自检脚本测试数 | 13 | 17 |

> 算法层（payload/PC/OB/SID/UUID/Memory）**完全共用** `revers/`
> 里的模块。只有"哪个字段放哪个 key"和协议常量是平台特定的。

## 配套资源

| 想看什么 | 去哪 |
|---|---|
| 算法原理 | [`../../../main/ZH/PX_SDK_逆向技术文档.md`](../../../main/ZH/PX_SDK_逆向技术文档.md) |
| 用过的 6 批样本 | [`../sample/`](../sample/) |
| diff 调试工具 | [`../script/`](../script/) |
| 通用 reverse 模块 | [`../../../revers/`](../../../revers/) |
| iFood 同款生成器 | [`../../ifood/px_cookie/`](../../ifood/px_cookie/) |

---

*来源：legacy `perimeter_X` 项目的 `grubhub_px2.js` + `templates/grubhub_ev*_template.json`。
对应 Grubhub SDK sha256 `4accf1a5…`，6 批解码闭环 + 5× live-generator runs，10/10 通过。*
