# Stage 7: Validate — 10/10 + 故障排查

> **时间预算**：熟练 30 min，第一次 2 h
> **产出**：generator 端到端跑 10 次拿 10 次 `_px3` + 业务 API 调通
> *融合*: C/§6（实战）+ B/07_stage7_validate + A/§12（故障树）

---

## 章节目标

让 generator 通过 3 关：

```
关 1: generator 跑通拿 _px3 cookie  (algorithm level OK)
   ↓
关 2: _px3 业务 API 调通（不返回 403 / 验证码）
   ↓
关 3: 10/10 稳定通过 + 跨多 IP 跨多 UA
```

---

## 7.1 关 1：generator 端到端

```bash
cd ../../../stample/ifood/px_cookie/
node ifood_px3.js
# 期望输出:
# [collector#1] POST OK, state.no=1771962850771, state.vid=c8357...
# [collector#2] POST OK, _px3=<long base64>...
# ✓ _px3 generated in 1.2s
```

跑 10 次：

```bash
for i in {1..10}; do
    node ifood_px3.js | grep -E "✓|✗"
done
# 期望: 10/10 ✓
```

如果不是 10/10 → 进 7.4 故障树。

---

## 7.2 关 2：业务 API

generator 拿到的 `_px3` 必须能让目标业务 API 不返回 403：

```javascript
const _px3 = await generatePx3('ifood');

const res = await fetch('https://www.ifood.com.br/api/restaurants/...', {
    headers: {
        'Cookie': `_px3=${_px3}; _pxvid=${vid}; ...`,
        'User-Agent': USER_AGENT
    }
});

console.log(res.status);   // 期望: 200 (or 200 + JSON data)
```

详见 [`../../../stample/ifood/px_cookie/smoke_test.sh`](../../../stample/ifood/px_cookie/smoke_test.sh)。

---

## 7.3 关 3：10/10 + 稳定性矩阵

```
单 IP 单 UA      → 10/10
单 IP 多 UA(5)   → 50/50
多 IP(5) 单 UA   → 50/50
多 IP(5) 多 UA(5) → 250/250
```

如果某个组合通过率 < 100% → 你的 generator 有"恰好对某些 UA/IP 不工作"的 bug。

### 7.3.1 稳定性 smoke test 脚本

```bash
# 单 IP 10 次
./smoke_test.sh ifood 10

# 跨 5 个 UA × 10 次
for ua in chrome120 chrome121 firefox119 edge120 chrome_mac; do
    USER_AGENT=$(ua_lookup $ua) ./smoke_test.sh ifood 10
done
```

详见 [`../../../skill/AI_re/scripts/smoke_test.sh`](../../../skill/AI_re/scripts/smoke_test.sh)。

---

## 7.4 故障排查决策树

```
跑 generator 失败
├── HTTP 403 / Cloudflare blocked
│   ├── IP 评分太低 → 换住宅代理
│   ├── TLS 指纹被识别 → 换 axios → fetch (Node 18+) 或用 curl_cffi
│   └── 频率太高 → 加间隔（每 IP ≥ 30s/次）
│
├── HTTP 200 但 _px3 为空
│   ├── EV1 部分错（collector#1 拿不到 state） → 查 EV1 字段，state.* 应该全有
│   └── OB 解码错 → 查 ../../../revers/ob.js
│
├── HTTP 200 + _px3 拿到，但业务 API 403
│   ├── _px3 是"低评分"cookie → PX 给了个 cookie 但标记你
│   │   修复:
│   │     - 检查 anti-tamper key/value 算法对不对
│   │     - 检查 PC 算法 (HMAC-MD5 + digit 提取)
│   │     - 检查 SID Unicode Tag 编码
│   ├── _px3 expired 太快 → 你 SDK 锁版过旧
│   └── 缺其它 cookie（_pxvid 等）
│
├── 跑 1-3 次 OK 然后开始 403
│   ├── PX 检测到机器人特征（请求模式过于规律）
│   │   修复: 在请求间加 randInt(500, 3000) 抖动
│   ├── 同 UUID 重用 → 每次必须新 UUID
│   └── 同 IP 频率过高
│
├── 报错 "PC mismatch"
│   ├── XOR key 错 → parseInt(ml(TAG)) % 128
│   ├── 没用 PX 自定义 serialize() → 必须用 ../../../revers/payload.js
│   └── 字段顺序错 → 用 deepClone 保持模板顺序
│
└── 算法层报错（base64 / MD5 / HMAC）
    ├── 算法实现有 bug → 跑 test/test_revers.js
    └── Node 版本太老（< 18） → 升级
```

---

## 7.5 PC mismatch 调试

PC 算错是**最常见**的失败模式。调试方法：

```javascript
// 在 generator 里输出 PC 中间值
const ev2Json = serialize(ev2);
console.log('ev2Json length:', ev2Json.length);
console.log('ev2Json first 200:', ev2Json.substring(0, 200));

const pc = computePC(ev2Json, TAG);
console.log('pc:', pc);

// 跟真抓的 batch 对比 PC
const realPc = extractPc('samples/1/request_2.txt');
console.log('real pc:', realPc);
console.log('match:', pc === realPc);
```

如果不 match：

1. 检查 ev2Json 字节级跟真抓是否一致（用 diff 工具）
2. 检查 TAG 是不是从 SDK 提取的正确版本
3. 检查 serialize() 是 PX 版还是 JSON.stringify

详见 [`../../../bug_report/1_collector_path.md`](../../../bug_report/1_collector_path.md) §"PC mismatch"。

---

## 7.6 IP 评分 / TLS 指纹问题（独立于纯算）

⚠️ **以下不属于纯算 generator 责任，但会让你以为 generator 错了**：

| 现象 | 真原因 |
|---|---|
| 单 IP 跑 5 次后 403 | IP 评分进黑名单 |
| 数据中心 IP 直接 403 | PX 拉黑数据中心 ASN |
| Node fetch 通过率 80%，curl 100% | TLS 指纹差异（Node fetch 是 Node 自己的 ALPN） |
| 同算法换浏览器 UA 通过率不同 | UA-IP 一致性问题（巴西 IP 配美国 UA 减分） |

**纯算的责任只在 generator 的输入输出对等**。这些是网络层问题，详见 [`../../../bug_report/3_environment.md`](../../../bug_report/3_environment.md)。

---

## 7.7 关 3 完成标准 ✓

| 项 | 验证 |
|---|---|
| ✅ 10/10 单 IP 单 UA | 100% |
| ✅ 业务 API 200 | 不返回 403 / 验证码 |
| ✅ 跨 5 UA 稳定 | 50/50 |
| ✅ 跨 3 IP 稳定 | 30/30（住宅代理） |
| ✅ 总耗时 < 3s / 次 | generator + collector 网络 |
| ✅ 错误率 < 1% (随机错误) | 网络抖动可接受 |

---

## 7.8 持续监控（生产级别）

generator 上线后**持续监控**：

```bash
# 每小时跑 1 次 smoke test
0 * * * * /path/to/smoke_test.sh ifood 5 >> /var/log/px_smoke.log 2>&1
```

如果某天通过率突然下降 → PX 升级了，紧急走 [`09_sdk_upgrade.md`](09_sdk_upgrade.md)。

---

## 7.9 进入 Stage 8/9

Stage 7 完成 = **纯算 PX 逆向核心完成**。

继续两章可选学习：

→ [Stage 8: 跨平台移植](08_cross_platform.md)（如需 Python/Go/C# 版）
→ [Stage 9: SDK 升级响应](09_sdk_upgrade.md)（PX 升级后该做什么）
