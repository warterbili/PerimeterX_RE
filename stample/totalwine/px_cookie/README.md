# Total Wine `_px2` Cookie 生成器

Total Wine 的 `_px2` cookie 纯算生成器。⭐ **PX 严档部署案例**——同一 SDK 在不同客户那有不同的服务端校验强度，详见 [`skill/AI_re/references/deployment-tiers.md`](../../../skill/AI_re/references/deployment-tiers.md)。

> 🎯 **看研究目的 + 端到端实战例子** → [`../RESEARCH_PURPOSE.md`](../RESEARCH_PURPOSE.md)
> 🚀 **30 秒跑端到端 demo**：`node business_api_demo.js`（_px2 → SRP HTML 1.3 MB）

## 目录

```
px_cookie/
├── README.md
├── smoke_test.js                ⭐ 一键自检（require + 常量 + 模板 + 严档独有 6 项）
├── business_api_demo.js         ⭐ 端到端 demo（_px2 → totalwine.com/search 真 HTML）
├── totalwine_px2.js             ⭐ 主生成器
├── totalwine_ev1_template.json  (EV1, 13 字段)
├── totalwine_ev2_template.json  (EV2, 199 字段)
├── totalwine_ev3_template.json  (EV3, 11 字段) ⭐ 严档独有
├── totalwine_ev1_field_map.json (字段分类：STATIC/DYNAMIC/PARTIAL/CONDITIONAL)
├── totalwine_ev2_field_map.json
├── totalwine_ev3_field_map.json
└── state_key_map.json           (state.* → EV2 b64 key 跨批匹配)
```

## 跟 iFood/Grub 的差异（严档 vs 宽档）

| 项 | iFood (`_px3`) | Grub (`_px2`) | **Total Wine (`_px2`)** ⭐ |
|---|---|---|---|
| 部署严格度 | 宽档 | 宽档 | **严档** |
| Collector POST 数 | 2 | 2 | **3** (seq=0/1/**2**) |
| EV3 (seq=2) | ✗ | ✗ | **✓ 必发**（cookie 确认 beacon） |
| `state.hid` 字段 | ✗ | ✗ | **✓** |
| HMAC 字段服务端校验 | 弱 | 弱 | **强** |
| Counter 同步性 | 不查 | 不查 | **`PX12738==PX12739` 强制相等** |
| Layer 3 (cookie 签发) | 通过 = 完成 | 通过 = 完成 | **通过 ≠ 完成**（必跑 Layer 3.5） |

## 常量

| 字段 | 值 | 来源 |
|---|---|---|
| AppID | `PXFF0j69T5` | live capture POST body |
| TAG (gt) | `CFQ7WU4xIS8MXA==` | live capture POST body |
| FT | `401` | live capture POST body |
| Cookie | `_px2` | decoded ob#2 first segment |
| TTL | `330` | decoded ob#2 |
| Collector | `https://www.totalwine.com/FF0j69T5/xhr/api/v2/collector` | first-party PX deployment |
| Bootstrap SDK | `https://client.px-cloud.net/PXFF0j69T5/main.min.js` | sha256 `9335db02…` (LF-norm) |

## 4 个 HMAC/MD5 字段公式（严档必须实测）

⚠️ 这 4 个公式**不能从 iFood/Grub 抄**。Total Wine 实测：

```
Cho5UEx3PWY=  = HMAC-MD5(uuid, UA)              ✓ 跟 iFood 偶然一致
Lx8cFWl9HCE=  = HMAC-MD5(state.vid, UA)         ⭐ 不是 uuid+':a'
UiJhKBREYhs=  = HMAC-MD5(state.pxsid, UA)       ⭐ 不是 uuid+':b'
EFwjFlU8JyU=  = MD5(state.vid)                   ⭐ 单 arg, 不是 HMAC
```

公式还原 SOP: [`skill/AI_re/playbooks/recover-hmac-formulas.md`](../../../skill/AI_re/playbooks/recover-hmac-formulas.md)
实测脚本: [`../script/find_hmac_inputs.py`](../script/find_hmac_inputs.py)

## state.* → EV2 b64 key 映射

| state field | EV2 key | 注入规则 |
|---|---|---|
| `state.no` | `YQ1SBydsVTQ=` | `parseInt(state.no)` ⚠️ Gotcha #1 |
| `state.to` | `fEgPAjoqCzE=` | string |
| `state.appId` | `Bzd0fUJTcUc=` | string |
| `state.vid` | (used in `Lx8c`/`EFwj`) | 不进 EV2 d，但喂 HMAC/MD5 输入 |
| `state.pxsid` | (used in `UiJh`) | 同上 |
| `state.hid` | (form param `hid=` of seq=2 POST) | ⭐ 严档独有 |
| `state.qa`, `state.cts`, `state.vid` | 走 POST form params (`cs=`, `cts=`, `vid=`) | 不进 EV2 payload |

## 使用

### 方式 1：先跑自检

```bash
cd stample/totalwine/px_cookie
node smoke_test.js
# 19+ 项全过即可 (含严档独有 6 项)
```

### 方式 2：直接生成 cookie (CLI)

```bash
# 需要美国住宅代理（非美 IP 会被 PX 直接 captcha）
$env:HTTPS_PROXY = 'http://<user>-session-<id>:<pwd>@<host>:<port>'
node totalwine_px2.js
```

### 方式 3：作为模块 require

```javascript
const generatePx2 = require('./totalwine_px2');

(async () => {
    const r = await generatePx2();
    console.log(r.cookie_name + '=' + r.cookie_value);
    // 输出：_px2=eyJ1IjoiYWJjLi4u
    console.log(`seq=2 beacon: ${r.collector3_status}`);   // 必须 200
})();
```

### 方式 4：端到端 demo (Layer 3.5 验证)

```bash
$env:HTTPS_PROXY = 'http://...'
node business_api_demo.js              # 默认搜索 "wine"
node business_api_demo.js "bourbon"    # 搜别的
```

### 方式 5：10/10 稳定性测试

```bash
python ../script/smoke_10x_e2e.py
# 期望 10/10 PASS，每次拿到 ~1.3 MB 真 HTML
```

## 调试模式：dump EV1/EV2/EV3 到 JSON

```bash
DUMP_EV_DIR=../sample/_our_ev node totalwine_px2.js
ls ../sample/_our_ev/
# our_ev1.json, our_ev2.json, our_ev3.json, our_state.json, our_ob1_segments.json
```

然后跟真实 batch 做对比：

```bash
python ../script/diff_ev2_ours_vs_real.py
```

诊断报告会展示：字段集差异、类型不一致、STATIC 值错位、Anti-tamper 位置、counter 同步性。

## 严档部署调试踩坑清单（5 个）

按命中频率排：

1. **EV2 模板从污染 batch bake 出来** → 重 bake 用 `build_templates.js`
2. **HMAC input 错** → 跑 `find_hmac_inputs.py` + 6 批 crypto 验证
3. **EV3 (seq=2) 漏发** → 检查 generator collector#3 实现
4. **state.hid 漏抽** → `extractState` 处理 `OlllOOll|...|true` 段
5. **counter 子字段独立 random** → `PX12738` 和 `PX12739` 必须同步

详见 [`skill/AI_re/references/gotchas.md`](../../../skill/AI_re/references/gotchas.md) Bug #15-#18。

## 验证标准

| Layer | 通过标准 |
|---|---|
| 1 | `node smoke_test.js` 全过（不打外网）|
| 2 | 6 批 sample 解码闭环 (`script/decode_all.js`) |
| 3 | `node totalwine_px2.js` 10 次拿到不同 `_px2` |
| **3.5** ⭐ | `python script/smoke_10x_e2e.py` **10/10** 真打 SRP 拿到 200 + 真 HTML |
| 业务 | `node business_api_demo.js` 拿到 1.3 MB SRP HTML |
