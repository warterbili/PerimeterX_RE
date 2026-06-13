# Stage 9：SDK 升级响应（应急流程）

> **时间预算**：常规 30 min - 2 h，最坏情况 1-2 天
> **产出**：恢复 generator 通过率到 100%
> *融合*: C/§7（升级 playbook）+ B/09_sdk_upgrade

---

## 9.1 触发场景

generator 在生产中跑得好好的，**某天通过率突然下降** → PX 升级了。

升级有 3 个级别，对应不同响应：

| 级别 | 频率 | 现象 | 应对时间 |
|---|---|---|---|
| **小版本（修 bug）** | 每周 | 通过率 100% → 98% | 通常自愈，观察 24h |
| **中版本（加字段 / 改 b64 字典）** | 每月 | 通过率 → 70-90% | 重做 Stage 3/4/5（**~2 h**） |
| **大版本（换算法 / 换协议）** | 每 6-12 月 | 通过率 → 0% | 重做 Stage 4/2，可能要 1-2 天 |

---

## 9.2 应急响应 playbook

### 9.2.1 第一步：诊断（5 分钟）

```bash
# 1. 抓 1 批新流量
chrome-incognito → ifood → F12 → save curl
node ../../../skill/AI_re/scripts/decode_payload.js new_request_2.txt > new_decoded.json

# 2. 跟旧模板对比字段数
jq '.[0].d | keys | length' new_decoded.json    # 新值
jq '.[0].d | keys | length' samples/6/decoded_payload_2.json  # 老值

# 3. 检查 SDK SHA256 是否变化
sha256sum source/main.min.js      # 老
curl -s https://client.px-cloud.net/PXO1GDTa7Q/main.min.js | sha256sum  # 新
```

### 9.2.2 第二步：分诊（根据 diff）

```
SDK SHA 变了？
├── 否 → 应该不是 SDK 升级，可能是 IP 评分 / 网络层 → 查 ../../../bug_report/3_environment.md
│
└── 是 → SDK 升级了
    │
    EV2 字段数变了？
    ├── 否（仍 228） → 中版本（仅改 b64 字典）
    │   → 跳到 9.3
    │
    └── 是（变 230 / 240 / 220） → 中-大版本（加字段）
        │
        算法层魔法常量都还在？
        ├── 是 (1732584193, 909522486, ...) → 中版本
        │   → 跳到 9.3
        │
        └── 否 → 大版本，算法换了 → 跳到 9.4
```

---

## 9.3 中版本响应（~2 h 流程）

最常见。SDK b64 key 字典刷新，但算法没换。**6-12 个月内的常规事件**。

```
[1] 重新抓 6 批（Stage 1, 30 min）
    ⚠️ 必须重抓！老样本的 b64 key 跟新 SDK 字典对不上
    cd ../../../stample/ifood/sample/
    rm -rf {1..6}
    # 重抓 6 批 cold visit

[2] 重新解码（Stage 2, 15 min）
    cd ../script
    ./decode_all.sh

[3] 重新提取 hQ 映射（Stage 4, 5 min）
    node ../../../skill/AI_re/scripts/extract_hQ.js ../source/main.min.js \
        > ../px_cookie/hQ_map.json

[4] 重新三分类（Stage 3, 10 min）
    python diff_samples.py 2

[5] 重新跑 value-match（Stage 5, 15 min）
    python find_state_keys.py
    # 期望: 新的 state_key_map.json, 字段映射的 b64 key 应该全部都变了

[6] 重新提模板（Stage 6 部分, 5 min）
    cp samples/6/decoded_payload_2.json ../px_cookie/ifood_ev2_template.json

[7] 跑 generator（Stage 7, 30 min）
    node smoke_test.js                       # 常量同步 ✓
    for i in $(seq 10); do node ifood_px3.js; done
    # 期望: 10/10 个不同的有效 cookie
```

**全程 ~2 小时**。

---

## 9.4 大版本响应（最坏 1-2 天）

PX 换了算法（理论上没发生过，但可能）。响应：

```
[1] grep 算法层魔法常量（Stage 2 §2.6）
    grep -c "1732584193" main.min.js   # MD5?
    grep -c "909522486"  main.min.js   # HMAC?
    grep -c "122192928e5" main.min.js  # UUID v1?
    grep -c "F@bt" main.min.js         # base91?
    grep -c "~~~~" main.min.js         # OB 分隔符?

[2] 看缺哪个 → 重新逆向哪个
    缺 MD5 → 可能换了 SHA-256 / SHA-512 → 重读 PC 实现
    缺 HMAC ipad → 可能换了 HMAC 实现 → 重读
    缺 UUID v1 → 可能换了 v4 → 改 uuidV1() 为 uuidV4()
    缺 base91 → 可能换了 base85 / base92 → 重写 hM()

[3] 如果是 wire 协议变了（"~~~~" 没了 → "###" 或别的）
    → 重读 ../../../revers/ob.js 找新分隔符

[4] 如果是新算法层（从未见过的算法）
    → 走完整 Stage 1-7 重新逆向
    → 预估 1-2 天
```

---

## 9.5 应急储备（建议常备）

为了缩短响应时间：

1. **抓包工具脚本化**：CDP 自动化抓 6 批 < 10 分钟
2. **解码工具齐全**：[`../../../skill/AI_re/scripts/`](../../../skill/AI_re/scripts/) 14 个 CLI 用熟
3. **每周冷启动测试**：每周一跑各站 `smoke_test.js`（常量同步）+ 几次 `node <site>_px3.js`，趁早发现问题
4. **保留 N-1 版本 SDK**：上次成功的 SDK 留一份，对比 diff 用
5. **监控告警**：通过率 < 95% → Slack/email 告警

---

## 9.6 历史升级记录（PX 项目实测）

| 日期 | 升级类型 | 修复时间 | 备注 |
|---|---|---|---|
| 2026-05-18 | iFood SDK 中版本 (b64 字典刷新) | 2 h | 详见 [`../../../bug_report/4_sdk_drift.md`](../../../bug_report/4_sdk_drift.md) #1 |
| 2026-04-03 | Grubhub SDK 小版本 | 0 (自愈) | 通过率波动 |
| ... | ... | ... | ... |

---

## 9.7 何时该放弃维护

3 个信号建议放弃纯算路线，转去用真浏览器（Playwright + 住宅代理）：

1. **连续 3 次升级响应都 > 1 天** → 维护成本 >> 收益
2. **PX 引入 Bundle / 视觉挑战路径** → 详见 [`../../../bundle/`](../../../bundle/)，纯算成本 5×
3. **业务量降到几百次/天** → 真浏览器够用了

详见 [`00_overview.md`](00_overview.md) §0.6（什么时候不应该纯算）。

---

## 9.8 Stage 9 完成标准 ✓

升级响应"完成"的标准跟 Stage 7 一致：

| 项 | 验证 |
|---|---|
| ✅ generator 10/10 | 100% |
| ✅ 业务 API 200 | 不返回 403 |
| ✅ 跨 UA / IP 稳定 | 50/50 / 30/30 |

---

## 9.9 进入附录

10 章正文完结。继续 3 个附录：

→ [Appendix A: 14 个 CLI 工具速查](appendix/A_tools.md)
→ [Appendix B: 关键算法伪代码](appendix/B_algorithms.md)
→ [Appendix C: 10 条避坑必读](appendix/C_avoid_traps.md)
