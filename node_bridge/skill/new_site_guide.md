# 新站点 Bridge 适配教程（9 步实操）

> 把 iFood 模板适配到新站点。**每步显式标注用哪个上游 skill**。
>
> 假设新站点叫 `<site>`，目标是产出 `node_bridge/<site>/` + 跑通拿到目标 cookie。

> 🔝 **跑不通时升级到 sdenv**：[https://github.com/pysunday/sdenv](https://github.com/pysunday/sdenv)
> 判定条件见步骤末尾的"跑不通怎么办" + [`methodology.md §7`](methodology.md#7-何时升级到-sdenv)。

---

## 流程总览

```
[1] 抓 + 锁定 SDK             ← cdp-browser
[2] 识别基础常量              ← 看 SDK / 抓真请求
[3] 复制 ifood 模板           ← bash
[4] 改 SDK 路径 + 常量        ← Edit
[5] dump 真 Chrome 指纹       ← cdp-browser ⭐
[6] 第一次跑 + 收 crash       ← jni-env-patching ① + ②
[7] 配 TLS 层                 ← curl_cffi_integrate
[8] 差异比对 + 迭代修         ← cdp-browser + jni-env-patching ③
[9] 验证 + 写 journal         ← live_validation
```

预估总耗时 **4-8 小时**（同 PX 厂，第一次做）。

---

## Step 1：抓 + 锁定 SDK

**用 skill**：`cdp-browser`

```bash
# 启 Chrome + 访问目标站点
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py start
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py navigate "https://www.<site>.com"

# 抓 SDK 加载请求（PX SDK URL 通常含 client.px-cloud.net 或 sensor.<site>.com）
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py network 15 | \
    jq '.[] | select(.request.url | test("client\\.px-cloud|sensor\\.|main\\.min\\.js"))'

# 下载 SDK 锁定（用 mitmproxy / curl / DevTools save-as）
curl -o stample/<site>/source/main.min.js https://client.px-cloud.net/<APP_ID>/main.min.js
sha256sum stample/<site>/source/main.min.js > stample/<site>/source/SDK_INFO.md
```

**期望产出**：`stample/<site>/source/main.min.js` (锁定 SDK) + SHA256 记录。

---

## Step 2：识别基础常量

抓 SDK 加载页面的真实 collector POST 请求，提取 4 个常量：

| 常量 | 怎么找 | 例（iFood） |
|---|---|---|
| **AppID** | SDK URL 路径 / collector URL host | `PXO1GDTa7Q` |
| **Collector URL** | DevTools Network 看 collector POST 域名 | `https://collector-pxo1gdta7q.px-cloud.net/api/v2/collector` |
| **Cookie 名** | response 的 set-cookie / `do` array bake 指令 | `_px3` (iFood) / `_px2` (Grubhub) |
| **目标域** | 业务 API 主域 | `cw-marketplace.ifood.com.br` |

```bash
# 用 cdp-browser 抓 collector POST 提取 AppID
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py network 20 | \
    jq '.[] | select(.request.url | contains("collector")) | .request.url'
# → https://collector-PXOXXXXXX.px-cloud.net/api/v2/collector?app=PXOXXXXXX&tag=...
#                                                            ↑ AppID
```

**期望产出**：4 个常量记入 stample/<site>/source/SDK_INFO.md。

---

## Step 3：复制 ifood 模板

```bash
cd <repo-root>
cp -r node_bridge/ifood node_bridge/<site>
cd node_bridge/<site>

# 把锁定 SDK 放进去
cp ../../stample/<site>/source/main.min.js perimeterx/

# 清掉 iFood 残留
rm -rf node_modules .checkpoint
```

**期望产出**：`node_bridge/<site>/` 目录完整，含 iFood 模板代码 + 新站点 SDK。

---

## Step 4：改 SDK 路径 + 常量

改 **3 个文件** 里的常量（用 grep 找位置）：

### 4.1 `px_node_bridge.js` 改 SDK 路径（如果 SDK 文件名不一样）

```javascript
// 默认 main.min.js — 如果 SDK 文件名是 init.js / sensor.js 之类，改这行
const pxSdkPath = path.join(__dirname, 'perimeterx/main.min.js');
```

### 4.2 `px_cookie_generator.py` 改 4 个常量

```python
# 原 iFood：
SITE_BASE      = "https://www.ifood.com.br"
COLLECTOR_BASE = "https://collector-pxo1gdta7q.px-cloud.net"
APP_ID         = "PXO1GDTa7Q"
COOKIE_NAME    = "_px3"

# 改成 <site>：
SITE_BASE      = "https://www.<site>.com"
COLLECTOR_BASE = "https://collector-<appid_lowercase>.px-cloud.net"
APP_ID         = "<APP_ID>"
COOKIE_NAME    = "_px<2or3>"
```

### 4.3 `px-node-env/env/builder.js` 改 targetUrl

```javascript
buildEnvironment({
    targetUrl: 'https://www.<site>.com',     // ← 改这里
    userAgent: '...'                          // 通常不变（chrome131）
})
```

**期望产出**：4 个常量全部对应新站点。

---

## Step 5：dump 真 Chrome 指纹（关键一步）⭐

**用 skill**：`cdp-browser`

执行 [`methodology.md §3 dump 模板`](methodology.md#3-cdp-browser-skill-详细-dump-模板直接-paste-用) 的 5 组命令，输出**直接 paste** 进对应 env 文件：

```bash
# 5.1 navigator → paste 进 env/navigator.js
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py navigate "https://www.<site>.com"
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py eval "
  JSON.stringify({...})   # 用 methodology.md §3.1 完整模板
" > /tmp/<site>_navigator_dump.json

# 5.2 screen + window → paste 进 env/builder.js + env/px_intercept.js
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py eval "
  JSON.stringify({...})   # 用 methodology.md §3.2
" > /tmp/<site>_screen_dump.json

# 5.3 window enumerable keys → paste 进 env/px_intercept.js
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py eval "
  Object.keys(window).filter(k => !k.startsWith('_')).sort()
" > /tmp/<site>_window_keys.json

# 5.4 Canvas hash 校准（用 methodology.md §3.4）
# → 用同样的 JS 跑我们 bridge → diff hash → 调 env/canvas.js
```

**关键**：把 dump 出的真值**逐字段** paste 进对应 env/*.js 的 hardcoded 部分。

**期望产出**：
- `env/navigator.js` 含真 Chrome 的 navigator 完整属性
- `env/builder.js` 含真 screen / window 尺寸
- `env/px_intercept.js` 含真 Chrome `Object.keys(window)` 的差集补全

---

## Step 6：第一次跑 + 收 crash

```bash
cd node_bridge/<site>
npm install --ignore-scripts
npm install canvas@3        # Windows 必须用 @3 prebuilt

# 跑 Python 协调器（带代理）
SESSION="$(date +%s)$RANDOM"
export HTTPS_PROXY="http://<user>:<pwd>@<host>:<port>"   # 对应 <site> 所在地区
python px_cookie_generator.py 2>&1 | tee /tmp/<site>_first_run.log
```

**典型第一次跑会崩**。看 `[NODE]` stderr：

| crash 类型 | jni-env-patching 步骤 | 修复方法 |
|---|---|---|
| `TypeError: Cannot read property X of undefined` | ① 识别 crash | 缺 X → 补到对应 env 文件 |
| `TypeError: navigator.userAgentData.brands is not a function` | ① + ② | 缺 userAgentData → 补 env/navigator.js |
| `TypeError: window.AudioContext is not a constructor` | ① + ② | 缺 AudioContext → 补 env/audio.js |
| SDK 不崩但 PX 给 403 / px-captcha | ③ 给合理值不对 | 跳到 Step 8 差异比对 |

每个 crash 处理：
1. 看错在哪个 API
2. **用 cdp-browser dump 真 Chrome 对应 API 的值**（jni-env-patching ② "看真环境"）
3. paste 进对应 env/*.js（jni-env-patching ③ "给合理值"）
4. 重跑

直到 stderr 没有 TypeError。

**期望产出**：bridge 跑完不崩 + Node 输出 type=result JSON。但可能 _px3 还为空（继续 Step 7-8）。

---

## Step 7：配 TLS 层

**用 skill**：`curl_cffi_integrate_scrapy_performance`

检查 `px_cookie_generator.py` 的 session 配置：

```python
# 必须有这行
self.session = curl_requests.Session(impersonate="chrome131")
```

**关键 check**：
- ✅ impersonate 用 `chrome131`（跟 env/navigator.js 的 UA Chrome/131 对齐）
- ✅ Session 复用同一个（不要每次请求新建 session — TLS handshake 信息会变）
- ✅ 如果 site 是 HTTP/2 强制，确认 curl_cffi 是 0.7+（早期版本 H2 支持差）

```python
# 验证 TLS 指纹正确
python -c "
from curl_cffi import requests
s = requests.Session(impersonate='chrome131')
r = s.get('https://tls.peet.ws/api/all')
import json
d = r.json()
print('JA3:', d['tls']['ja3_hash'])
print('JA4:', d['tls']['ja4'])
print('HTTP/2 settings:', d['http2']['sent_frames'])
"
# 期望 JA3 跟真 Chrome 131 一致
```

**期望产出**：TLS 指纹完全模拟真 Chrome 131。

---

## Step 8：差异比对 + 迭代修 ⭐

**核心一环**：跑通了不崩但 _px3 评分低 → 用差异比对找出**哪个字段错**。

**用 skill**：`cdp-browser` + `jni-env-patching` ③④

### 8.1 抓真 Chrome 的 collector POST body

```bash
# 启 Chrome + clean session + 抓 30s
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py start
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py navigate "https://www.<site>.com"
python ~/projects/Sourcing-AI-Skills/cdp-browser/scripts/cdp.py network 30 > /tmp/<site>_real_chrome_traffic.json

# 提取 collector POST body
jq '.[] | select(.request.url | contains("collector")) | .request.postData' \
   /tmp/<site>_real_chrome_traffic.json > /tmp/<site>_real_post.txt
```

### 8.2 抓我们 bridge 的 collector POST body

修改 `px_cookie_generator.py` 的 `_proxy_request` 把 request body dump 到文件：

```python
def _proxy_request(self, msg):
    # 加这两行 (调试)
    with open(f'/tmp/<site>_bridge_post_{msg["id"]}.txt', 'w') as f:
        f.write(msg.get('body') or '')
    # ... 原代码
```

跑 bridge 拿到 dump。

### 8.3 diff EV1 / EV2 字段

```bash
# 用 revers/payload.js 解码（项目已有解码工具）
node skill/AI_re/scripts/decode_payload.js /tmp/<site>_real_post.txt > /tmp/<site>_real_decoded.json
node skill/AI_re/scripts/decode_payload.js /tmp/<site>_bridge_post.txt > /tmp/<site>_bridge_decoded.json

# diff
diff <(jq -S . /tmp/<site>_real_decoded.json) <(jq -S . /tmp/<site>_bridge_decoded.json)
```

**输出形式**：

```diff
- "field_001": "Win32"
+ "field_001": "MacIntel"
     ↑ navigator.platform 错 → 改 env/navigator.js
- "field_034": "5da3b8e2..."
+ "field_034": "00000000..."
     ↑ canvas hash 错 → 检查 env/canvas.js + @napi-rs/canvas 字体
- "field_087": "<hash>"
+ "field_087": "<other_hash>"
     ↑ Object.keys(window) hash 错 → 加 missing prop 到 env/px_intercept.js
```

### 8.4 逐字段修

每个 diff：
1. 用 **cdp-browser** 查真 Chrome 对应 API 的真值
2. paste 真值进 env/*.js
3. 重跑 → 重新 diff
4. 字段越来越少 diff 直到 EV1/EV2 完全一致

**期望产出**：bridge 跑通拿到非空 _px3 (例 `len > 500`)。

---

## Step 9：验证 + 写 journal

### 9.1 端到端业务 API 调通

参考 `stample/live_validation/journal/2026-05-21.md` 的模板：

```bash
# 1. 拿到 _px3 (Step 8 已成)
# 2. 用这个 _px3 调 <site> 真业务 API
python -c "
from px_cookie_generator import PXCookieGenerator
gen = PXCookieGenerator(verbose=True, proxy='$HTTPS_PROXY')
px3 = gen.generate()
# 用 _px3 调业务 API
import curl_cffi.requests as r
resp = r.get('https://<site>/v1/api/...', cookies={'_px<n>': px3}, ...)
print('Business API:', resp.status_code, resp.text[:200])
"
```

期望 HTTP 200 + 真业务数据。

### 9.2 写 journal

复制 `stample/live_validation/journal/2026-05-21.md` 模板，改成 `<YYYY-MM-DD>.md`：

```markdown
# YYYY-MM-DD <site> Node Bridge 实战记录

## 双站实测结论
- <site>: _px<n> via bridge + 业务 API HTTP 200 ✓

## Part 1 · <site>
### 1.1 接口介绍 (...)
### 1.2 风控架构 (...)
### 1.3 IP 要求 (...)
### 1.4 实战代码 → node_bridge/<site>/
### 1.5 实测请求 + 响应（完整 HTTP）
### 1.6 PX 研究 insights（这次发现的新东西）

## 踩坑列表
- ...
```

### 9.3 写本 site 的 README

`node_bridge/<site>/README.md` 加：

```markdown
# Node Bridge — <site>

## SDK 版本
SHA: <sha256>
锁定日期: YYYY-MM-DD

## 跑通命令
\`\`\`bash
npm install
export HTTPS_PROXY='http://<user>:<pwd>@<host>:<port>'   # <地区> 住宅
python px_cookie_generator.py
\`\`\`

## 期望输出
\`\`\`
✅ _px<n> SUCCESS! len=...
   first 80: ...
   _pxvid: ...
\`\`\`

## 跟 ifood 模板的差异
- AppID: ...
- Collector: ...
- Cookie: ...
- env/navigator.js 改动: ...

## journal
- 第一次跑通: stample/live_validation/journal/YYYY-MM-DD.md
```

**期望产出**：`node_bridge/<site>/README.md` + journal entry 完整。

---

## 完成 checklist

- [ ] Step 1：SDK 锁定 + SHA 记录
- [ ] Step 2：4 个常量识别
- [ ] Step 3：模板复制成功
- [ ] Step 4：3 文件常量改对
- [ ] Step 5：5 组真 Chrome dump paste 进 env/
- [ ] Step 6：bridge 不崩，拿到 type=result JSON
- [ ] Step 7：TLS 用 chrome131
- [ ] Step 8：EV1/EV2 diff 字段全部一致
- [ ] Step 9：业务 API 200 + journal 写完

---

## 跑不通怎么办？

按 [`methodology.md §7 何时升级到 sdenv`](methodology.md#7-何时升级到-sdenv) 的决策树判断：

- **报错是 `typeof document.all`、`Function.prototype.toString`、`Error().stack` 之类的 V8-level 检测** → 升级 sdenv
- **就是简单缺 API / 缺值不对** → 继续按 §2 4 手段迭代

---

*教程 v1.0 · 基于 iFood 实战编写 · 2026-05-22*
