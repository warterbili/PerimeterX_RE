# 🎯 Total Wine — 研究目的与实战案例

> 这个文件夹**不是**学术演示。它是**PX 严档部署**逆向的端到端实战，证明同一个 PX SDK 在不同客户那里有不同的服务端校验强度。
>
> 跟 [iFood](../ifood/RESEARCH_PURPOSE.md) / [Grubhub](../grub/RESEARCH_PURPOSE.md) 相比：底层算法 100% 共享，但服务端策略**完全不同档**——iFood/Grub 给 cookie 就能用，Total Wine 给 cookie 后还有 4 类额外校验。这套案例的价值在于让方法论补上"严档部署"那一档。

---

## 1. 用途总览（一句话）

**用 `_px2` cookie 通过 PerimeterX (严档部署) 守门，从 curl_cffi / Python 直接拿到 totalwine.com 搜索结果 + PDP 真实 HTML 内容。**

---

## 2. PX cookie 在业务链路的位置

```
            浏览器 / 爬虫
                │
                ▼
        ┌─────────────────┐
        │ totalwine_px2.js│  ← 本目录
        │  (3 POST 链)     │
        │  ⭐ seq=2 必发    │
        └────────┬────────┘
                 │ _px2 + _pxvid
                 ▼
   ┌─────────────────────────────────────────┐
   │ GET totalwine.com/search/all?text=wine  │
   │                                          │
   │ ← PX 严档守门：                          │
   │   无 cookie = 5,745 B px-captcha        │
   │   trust-low cookie = 427 B PX-block JSON│
   │   trust-verified cookie = 1.3 MB 真 HTML│
   └────────┬────────────────────────────────┘
            │
            ▼
        search results HTML
        (products / prices / inventory by store)
```

| Cookie | 来源 | 作用 |
|---|---|---|
| `_px2` | generator OB#2 set_cookie 段 + seq=2 beacon 确认 | PX 主认证 (trust=verified) |
| `_pxvid` | generator `state.vid` | PX 访客 ID（持续会话） |

业务 API 端点（实测可达）：

| 端点 | 用途 |
|---|---|
| `GET /search/all?text=<query>` | 商品搜索结果页（HTML） |
| `GET /spirits/.../p/<sku>` | 商品详情页（HTML） |
| `GET /site/resourceapi/global/header` | 站点导航 JSON（其实不 gate） |

---

## 3. 严档 vs 宽档：踩过的坑（5 个）

按照 iFood/Grub 经验做 Total Wine 时栽进去 5 个深坑。每个都需要重新方法论：

| # | 坑 | iFood/Grub | Total Wine |
|---|---|---|---|
| 1 | **Layer 3.5 验证标准** | "collector 签发 cookie" = OK | ❌ 必须真打 PX-gated 端点拿真实 HTML |
| 2 | **EV3 (seq=2) 角色** | 没这个 POST | ⭐ 强制 cookie 确认 beacon，body 含 `OkpJAH8oTTA=` = 刚拿到的 cookie |
| 3 | **HMAC 字段 input** | `hmac(uuid+':a/:b/:c', UA)`（猜测）| ❌ 完全不同：`hmac(state.vid, UA)` / `hmac(state.pxsid, UA)` / **`md5(state.vid)`** |
| 4 | **state.hid 字段** | 没这个 | ⭐ 从 `OlllOOll\|<b64>=:<b64>\|true` 段提取，seq=2 form 参数必传 |
| 5 | **Counter 同步性** | `PX12738` 和 `PX12739` 独立 random | ❌ 永远相等且跨 EV 单调递增 |

详见 [`skill/AI_re/references/gotchas.md`](../../skill/AI_re/references/gotchas.md) Bug #15-#18。

---

## 4. 30 秒跑端到端 demo

```bash
# 1. 设代理（必须美国住宅 IP）
$env:HTTPS_PROXY = 'http://<user>-session-<random>:<pwd>@<host>:<port>'

# 2. 跑生成器（3 POST 链，自动发 seq=2 beacon）
node stample/totalwine/px_cookie/totalwine_px2.js

# 3. 10/10 端到端稳定性测试
python stample/totalwine/script/smoke_10x_e2e.py
# 期望：10/10 PASS，每次拿到 ~1.3 MB 真实 SRP HTML
```

---

## 5. 文件结构

```
stample/totalwine/
├── RESEARCH_PURPOSE.md      ← 本文
├── RESEARCH_PURPOSE_EN.md
│
├── source/                   ← 锁版 SDK
│   ├── main.min.js              (326 KB, SHA-256: 9335db02… LF-norm)
│   └── SDK_INFO.md              (常量 + 验证方法)
│
├── sample/                   ← 6 批 cold-visit ground truth
│   ├── 1..6/
│   │   ├── request_{1,2,3}.txt
│   │   ├── response_{1,2,3}.json
│   │   ├── decoded_payload_{1,2,3}.json
│   │   ├── decoded_response_{1,2,3}.json
│   │   └── meta.json
│   └── README.md
│
├── px_cookie/                ← 生成器
│   ├── totalwine_px2.js         ⭐ 主入口
│   ├── totalwine_ev{1,2,3}_template.json
│   ├── totalwine_ev{1,2,3}_field_map.json
│   ├── state_key_map.json
│   ├── smoke_test.js
│   ├── business_api_demo.js     ⭐ 端到端 demo
│   └── README.md
│
└── script/                   ← 分析工具
    ├── capture_via_cdp_totalwine.py    (重抓 6 批)
    ├── decode_all.js                    (request/response → JSON)
    ├── build_templates.js              (6 批 → STATIC/DYNAMIC 分类 + 模板)
    ├── find_state_keys.js              (state.* → EV2 b64 key 跨批匹配)
    ├── diff_ev2_ours_vs_real.py        ⭐ 严档诊断主力
    ├── find_hmac_inputs.py             ⭐ HMAC 公式还原
    └── smoke_10x_e2e.py                ⭐ Layer 3.5 验证
```

---

## 6. 跟项目其它部分的关系

| 资源 | 路径 |
|---|---|
| 通用算法模块（XOR/HMAC/ml/anti-tamper） | [`../../revers/`](../../revers/) |
| PX SDK 逆向方法论（中文） | [`../../main/ZH/PX_SDK_逆向技术文档.md`](../../main/ZH/PX_SDK_逆向技术文档.md) |
| 跨厂家对照（iFood / Grub / **Total Wine**） | [`../../main/ZH/PX_完整SDK对照逆向方法论.md`](../../main/ZH/PX_完整SDK对照逆向方法论.md) §8 |
| 严档 vs 宽档对照表 | [`../../skill/AI_re/references/deployment-tiers.md`](../../skill/AI_re/references/deployment-tiers.md) |
| 18 条踩坑清单 | [`../../skill/AI_re/references/gotchas.md`](../../skill/AI_re/references/gotchas.md)（含 Bug #15-#18 严档坑） |
| HMAC 公式还原 SOP | [`../../skill/AI_re/playbooks/recover-hmac-formulas.md`](../../skill/AI_re/playbooks/recover-hmac-formulas.md) |

---

## 7. 道德声明

本项目仅用于**安全研究 / 防护机制学习**。具体使用规则同 [iFood RESEARCH_PURPOSE](../ifood/RESEARCH_PURPOSE.md) §道德声明。

爬 totalwine.com 时请：
- 仅用于了解 PX 防护机制学习
- 不绕过 `robots.txt`
- 不影响线上业务
- 不分发抓到的数据
