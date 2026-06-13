# Playbook — 严档+ 站点端到端逆向（strict+ tier）

> 何时用：Stage 1.5 判档发现是**严档+**（collector 3-POST + 严档全套，且单看 cookie 内容无可挑剔仍被网关拒）。
> 严档+ 的关键认知：**字段全对 ≠ 通过。trust 还由 mint 的传输真实性 + 环境真实性 + IP 信誉决定。**
> 第一个样本：academy.com（见 [`deployment-tiers.md`](../references/deployment-tiers.md) 第三档、gotchas #19-#23）。

时长：宽档/严档基础打牢后，严档+ 额外约 1-3 h。每一步都对应一个工具或 gotcha。

---

## 0. 判档（Stage 1.5）—— 确认是严档+

宽档/严档判定见 [`deployment-tiers.md`](../references/deployment-tiers.md)。**严档+ 的增量信号**：
- 逐字段 diff **全过**（静态等、动态 shape 对）、collector 链全 200、cookie 正常签发，
- **但 PX-gated 端点仍被挑战且通过率抖动**（不是稳定 0，是 30-60% 飘）。

→ 别再盯单字段。问题在 **counter 合法模式 / 传输 TLS / 模板真实性 / IP 信誉** 四者之一。

## 1. 抓包 —— 纯算静态模板用真 Chrome CDP ⭐

```bash
python skill/cdp/scripts/capture_via_cdp_<site>.py 6     # 真 Chrome CDP，6 批，记 sdk_sha256
```
**纯算稳妥默认（Bug #22）**：写**纯算**时静态 EV 模板**优先真 Chrome CDP 抓**（203 字段，比 JSDOM dump 的
177 更全、传感器值更真）。多抓几批 → **轮换多指纹**避免同指纹被关联降分。
⚠️ **但 JSDOM 不是信任天花板**：node_bridge 跑真 SDK（live）在干净 IP 上实测能过 academy（1.2MB 真数据）——
它既是**逆向 oracle**，也是**零维护生产兜底**（SDK 轮换自动适配）。通过率真正由 **counter+TLS+IP**（Bug #23）决定。

## 2. 逐字段 diff —— 静态等 / 动态对 shape ⭐

```bash
python skill/AI_re/scripts/diff_ev_field_by_field.py our_ev2.json sample/2/decoded_payload_2.json override_keys.txt
```
- **STATIC MISMATCH** = 你改坏了模板字段 → 修。
- **TYPE MISMATCH** = number/string 错（Gotcha #1，如 state.no 要 parseInt）→ 修。
- **SHAPE DIFF** = 动态字段来源错（int 位数 / str 长度 / float-vs-int / dict 模式）→ 去 SDK 逆。

## 3. 写死 / 写活分类
[`field-categories.md`](../references/field-categories.md) + `diff_samples` 跨 6 批：多批不变 = 写死（锁模板），
变 = 写活（去逆）。

## 4. 写死：锁模板 + 注意类型
真 Chrome 模板 deep-clone，只覆盖写活字段。**类型**：从 OB 解出的数字串引用进 EV 一律 `parseInt`（Gotcha #1）。

## 5. 写活：逆 SDK 真实生成位置 ⭐
[`locate-field-sources.md`](locate-field-sources.md)：每个写活 b64 key 在 SDK 里 grep 字面量
`t["<b64key>"]=<expr>`，顺着 `<expr>` 逆出来源。严档+ 重点逆这几类：
- **HMAC/MD5**：输入每站实测，别抄（Bug #18，如 totalwine 用 state.vid 不是 uuid+:a）。
- **counter dict**：见第 6 步（最易踩）。
- **timestamp 双时钟**：`performance.now()`（距导航，大值）vs `Date.getTime()` 差（小值）别混；/ns duration 是 **float**。
- **CFF/VM 里逆不出的**（如某 entropy 度量）：确认它**后端不重算**（环境/timing 类）→ 取真抓范围值即可。

## 6. ⭐ Counter 合法模式（Bug #20）—— 严档+ 最隐蔽的坑
counter dict `{PX12738:N, PX12739:x, PX12740:y, PX12741:-1}`，`x/y ∈ {0, N}` **永不独立**。
**跨 6 批 cross-tabulate** 列出所有出现过的 `(x,y)` 组合 = 合法模式空间。真浏览器通常只有
`(0,0)/(N,N)/(N,0)` 三种，**`(0,N)` 非法**。生成器按抓到的 batch 用对应真实模式。
> academy 卡 ~40% 的真因就是错给了 `(0,N)`；改对 → 10/10。

## 7. 跨事件一致性（Bug #19）
```bash
python skill/AI_re/scripts/cross_event_consistency.py samples         # 真包提规则
python skill/AI_re/scripts/cross_event_consistency.py samples/_our_ev # 我们的，逐行对
```
CONSTANT 字段（页面加载 ts/uuid/platform）三事件必须**恒定**；MONOTONIC（perf/counter/now-ts）必须**递增**。

## 8. ⭐ /ns 走真 Chrome TLS（Bug #21）
`/ns?c=<uuid>` 返回的 `sm` 长度随客户端 TLS 变（node 432 / Chrome 504-512）。
用 node 取 = token 暴露"声称 Chrome 实为 node"。**/ns 必须和 collector 走同一个真 Chrome session**。

## 9. ⭐ 全链路传输：chrome142 持久 session（Bug #22/#23）
整链 **/ns + 3 个 collector POST + edge** 走**一个** curl_cffi `chrome142`（最接近真 149）持久 session +
首页预热拿 akamai cookie。用边车统一：
```bash
PX_IMPERSONATE=chrome142 PX_PROXY=<residential> python skill/AI_re/scripts/session_server.py
# generator 的 /ns 和每个 collector POST 都 forward 到 127.0.0.1:8765（USE_SESSION 模式）
```
node TLS 直接 mint → 低信任。

## 10. ⭐ 干净 IP，每 cookie 一个（Bug #23）
严档+ 对 mint 的出口 IP 信誉敏感：单 IP 高频 mint → 该 IP（甚至整个代理池）被降信任。
**Layer 3.5 必须在干净住宅 IP 上测，每 cookie 换新 IP**。"浏览器能开首页"≠"该 IP mint 被信任"。

## 11. ⭐ 卡住时用 4-way trust 矩阵定位（别瞎改）
```bash
HOME_URL=https://site/ GATED=https://site/gated COOKIE=_px3 OUR_COOKIE="<ours>" \
  python skill/AI_re/scripts/trust_matrix.py
```
- 真 cookie 两路过 + 我们 cookie 两路拒 → **cookie 内容**问题，回第 2 步 diff。
- 我们 cookie 真浏览器过 / curl 拒 → **borderline 信任**，查第 6/8/9 步。
- 真 cookie 也开始 curl 拒 → **IP/代理池被测污染**，换 IP，别误判算法回归。

---

## 验收
- `diff_ev_field_by_field` 0 problem + `cross_event_consistency` 全 match + counter 合法模式。
- 干净住宅 IP（每次换）跑 ≥10 次 Layer 3.5（真打 PX-gated 端点）→ 无 captcha 重定向 = 通过。

完整真实案例（私有包）：academy.com strict+，新住宅 IP **10/10**。方法论可复用于任何严档+ 站点。
