# Total Wine PX 分析脚本

8 个脚本，覆盖**抓包 → 解码 → 模板生成 → 严档诊断 → e2e 验证**全流程。

⚠️ 比 iFood/Grub 多 3 个脚本（严档独有诊断工具）：`diff_ev2_ours_vs_real.py`、`find_hmac_inputs.py`、`smoke_10x_e2e.py`。

---

## 脚本一览（按工作流顺序）

### Stage 1 — 抓包

| 脚本 | 用法 |
|---|---|
| **`capture_via_cdp_totalwine.py`** | 6 批 cold-visit 自动抓包（CDP + 真 Chrome）。环境变量 `PROXY_HOST/PORT/USER/PASS` 走住宅代理 |

```bash
python capture_via_cdp_totalwine.py 6
# 输出: ../sample/1..6/ 共 11 文件 × 6 批
```

### Stage 2 — 解码

| 脚本 | 用法 |
|---|---|
| **`decode_all.js`** | 把 6 批 request/response 解码成 JSON |

```bash
node decode_all.js
# 输出: ../sample/N/decoded_payload_{1,2,3}.json + decoded_response_{1,2,3}.json
```

### Stage 3 — 字段分类 + state.* 映射

| 脚本 | 用法 |
|---|---|
| **`build_templates.js`** | 跨 6 批做 STATIC/DYNAMIC/PARTIAL/CONDITIONAL 分类，输出模板 + field_map |
| **`find_state_keys.js`** | 跨 6 批用值匹配找 state.* → EV2 b64 key（Gotcha #11） |

```bash
node build_templates.js
# 输出: ../px_cookie/totalwine_ev{1,2,3}_template.json + ..._field_map.json

node find_state_keys.js
# 输出: ../px_cookie/state_key_map.json
```

### Stage 4 ⭐ — 严档独有诊断（NEW vs iFood/Grub）

写完 generator 后如果 cookie 签发 OK 但 Layer 3.5 失败，用这 3 个：

| 脚本 | 用法 |
|---|---|
| **`diff_ev2_ours_vs_real.py`** | 5 段诊断：字段集 / 类型 / STATIC 值 / 顺序 / counter 同步 |
| **`find_hmac_inputs.py`** | grep SDK 找 4 个 HMAC/MD5 字段的真实 input 函数 |
| **`smoke_10x_e2e.py`** | Layer 3.5 — 10 次独立 session 真打 PX-gated SRP，要 10/10 拿到 1.3 MB 真 HTML |

```bash
# 1. 先让 generator dump EV1/2/3 到 JSON
DUMP_EV_DIR=../sample/_our_ev node ../px_cookie/totalwine_px2.js

# 2. 跑诊断
python diff_ev2_ours_vs_real.py

# 3. 如果 HMAC 字段对不上，找 SDK input
python find_hmac_inputs.py

# 4. Layer 3.5 端到端验证
$env:HTTPS_PROXY = 'http://<user>-session-<id>:<pwd>@<host>:<port>'
python smoke_10x_e2e.py
```

---

## 跟 skill 通用工具的关系

本目录的 3 个严档独有脚本已经**泛化进 skill**：

| 本目录 (totalwine 实测版) | skill 通用版 (可复用到其他严档站点) |
|---|---|
| `diff_ev2_ours_vs_real.py` | [`skill/AI_re/scripts/diff_ev_ours_vs_real.py`](../../../skill/AI_re/scripts/diff_ev_ours_vs_real.py) |
| `find_hmac_inputs.py` | [`skill/AI_re/scripts/find_hmac_field_sources.py`](../../../skill/AI_re/scripts/find_hmac_field_sources.py) |
| `smoke_10x_e2e.py` (含本目录 site 配置) | [`skill/AI_re/scripts/replay_apples_to_apples.py`](../../../skill/AI_re/scripts/replay_apples_to_apples.py) |

skill 版用 env var 参数化，**对任何严档新站点都能跑**。本目录是 Total Wine 的具体 instance。

---

## 完整诊断流程图

```
            cookie 签发 OK 但 Layer 3.5 失败
                          │
                          ▼
        ┌───────────────────────────────────┐
        │ 1. DUMP_EV_DIR=… node generator   │  → ../sample/_our_ev/
        └─────────────────┬─────────────────┘
                          ▼
        ┌───────────────────────────────────┐
        │ 2. diff_ev2_ours_vs_real.py       │
        │                                    │
        │   字段集 ≠ 0?  → Gotcha #12 多/少字段│
        │   类型 ≠ 0?    → Gotcha #1/#10     │
        │   STATIC ≠ 0?  → 模板 bake 不对    │
        │   counter ≠ 同步? → Gotcha #17     │
        └─────────────────┬─────────────────┘
                          ▼ HMAC 字段值不对
        ┌───────────────────────────────────┐
        │ 3. find_hmac_inputs.py            │
        │   → 看 SDK 里 jm(X, Y) 的 X 是啥  │
        │   → 6 批 crypto 验证候选 input    │
        │   → 改 generator HMAC 公式        │
        └─────────────────┬─────────────────┘
                          ▼
        ┌───────────────────────────────────┐
        │ 4. smoke_10x_e2e.py               │
        │   → 10/10 拿到 1.3 MB 真 SRP HTML │
        └───────────────────────────────────┘
```

完整方法论：[`skill/AI_re/playbooks/validate-generator.md`](../../../skill/AI_re/playbooks/validate-generator.md) Layer 3.5 章节。
