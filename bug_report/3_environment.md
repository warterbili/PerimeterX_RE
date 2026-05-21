# 环境 / 基础设施 — 踩坑全集

跟算法无关，但能让 100% 正确的 generator 仍然被拒的"环境层"问题。
**先排除这些再排算法问题**。

---

### #E1 ⭐⭐⭐ PX 服务器 IP 节流：连续调用会触发"假失败"

**症状**：前 3 次运行返回 200 + 拿到 `_px2`/`_px3`，但快速跑 5-10 次后随机失败 403；重启脚本 → 又能成功几次；改算法没用。

**根因**：PX 后端对**单个 IP 的 collector POST 频率**有节流。脚本如果间隔 1.5-2s 跑 collector#1+#2，10 连发就会触发 IP 节流（**不是算法错**）。

**怎么判断是不是节流（而不是算法坑）**：
- 切换 IP（开热点 / 切代理）后立即重试 → 立刻成功 = 节流
- 等 30s 后重试 → 成功 = 节流
- 失败时算法 byte-for-byte 等于成功时 = 节流

**修复（开发期）**：测试稳定性时**运行间隔 ≥15-30s**。

**修复（生产期）**：
- 每个账号用独立住宅 IP（推荐 BrightData 住宅）
- bootstrap 60 个账号分批，每批 10 个，批间隔 60s
- 单 IP 单账号每天 ≤ 几十次 collector

**来源**：Desktop/新建文件夹/px-reverse-skill/references/gotchas.md:193-205；Desktop/新建文件夹 (3)/docs/_gotchas_grubhub.md:70-91

---

### #E2 ⭐⭐⭐ User-Agent 不能含 `Scrapy/`

**症状**：所有请求 403 "Forbidden"，服务器返回不带任何错误细节；改任何其它 UA 立刻能用。

**根因**：iFood 在 WAF 层有 UA 黑名单，包含 `Scrapy/` 字面字符串就拒。实测 `Scrapy/2.12.0 (+https://scrapy.org)` 30/30 全拒。

**修复**：UA 用 Chrome / Firefox / Safari / `python-requests` / 自定义都行，**避免**任何带 `Scrapy/` 的字符串。

**注意**：换成自定义 UA 也别带 `bot` / `crawler` / `spider` 等明显关键词。

**来源**：`ifood-web/pentest_api/doc/02_ifood_risk_control_analysis.md:146-149`

---

### #E3 ⭐⭐⭐ TLS 指纹是**按域名**检测的（不是全站一刀切）

**症状**：iFood `marketplace.ifood.com.br` 用 Python `requests` 能拿到数据，但 `cw-marketplace.ifood.com.br` 同样请求 403；同 IP 同 header。

**根因**：iFood 不同子域走不同 CDN：
- `marketplace.*` → Akamai（**不**校验 TLS 指纹）
- `cw-marketplace.*` → Cloudflare WAF（**严格**校验 TLS）

Python `requests` 的 TLS 指纹（curl/OpenSSL 风格）≠ Chrome 的指纹。Cloudflare 一识别就拒。

**修复**：对 Cloudflare 保护的子域用 `curl_cffi`（伪造 Chrome TLS 指纹）。普通的 Akamai 子域用 `requests` 即可。

```python
# ❌ 对 cw-marketplace 不行
import requests
requests.get("https://cw-marketplace.ifood.com.br/...")

# ✅ 用 curl_cffi
from curl_cffi import requests
requests.get("https://cw-marketplace.ifood.com.br/...", impersonate="chrome120")
```

**来源**：`ifood-web/pentest_api/doc/02_ifood_risk_control_analysis.md:170-175, 5.2-5.5`

---

### #E4 ⭐⭐ Bash 解析 `$a`：node -e 里的 `$a` 会被 shell 吃成空字符串

**症状**：在 bash 里跑 `node -e "..."` 调密码学算法，输出的 key 变成乱的；同样代码写文件再跑就对。

**根因**：bash 在执行前对 `"..."` 双引号字符串做变量展开。`$a` 不存在 → 替换为空。所以你写的 `var $a = ...` 或代码里有 `$a` 字面字符（如某些混淆代码）都会被吃。

**修复**：
- 写文件再跑：`node script.js` 而不是 `node -e "..."`
- 必须 inline：用单引号 `'...'`（bash 不展开），或转义 `\$a`
- PowerShell 没这问题（用 `$null` 等），但有它自己的特殊字符问题

**来源**：`ifood-web/collector无感纯算还原/纯算还原.md:639, 1931`

---

### #E5 ⭐⭐ Python `requests` 把 sid 里的 Unicode Tag Char 丢了

**症状**：Python 实现 sid 算法正确，但发出去服务器拒；用 Node 跑等价代码就过。

**根因**：sid 含 Plane 14 Unicode Tag Chars（U+E0100+），人眼"不可见"。Python `requests` 默认按 URL 标准编码，某些版本会丢 / 转 `?`。

**修复**：
```python
from urllib.parse import quote_plus
sid_encoded = quote_plus(sid, safe='')

# 验证字节数正确
assert len(sid.encode('utf-8')) == expected_byte_count
```

**别用**：Chrome "Copy as cURL"（也丢 Unicode Tag）。

**来源**：Desktop/新建文件夹/px-reverse-skill/references/gotchas.md:101-111

---

### #E6 ⭐ Cookie 复用：6 批之间必须**完全切换** Chrome profile

**症状**：跨 6 批抓出来的字段分类有"幽灵 STATIC"——本应该 DYNAMIC 的字段连续两批同值。

**根因**：cdp-browser 复用同一个 profile → `_pxvid` / localStorage / IndexedDB 残留，让 PX 把 6 次都识别成"同一用户 warm visit"，部分字段从 DYNAMIC 退化成 STATIC。

**修复**：
- 用临时 profile 路径，每批跑完 `rm -rf` 整个 profile 目录
- 或用 incognito mode
- 或验证：每批 UUID 都不同 + `_pxvid` 不连续

**来源**：Desktop/新建文件夹 (2)/scripts/（抓包脚本注释）

---

### #E7 ⭐ webdriver / Playwright / Selenium 留 navigator 标记

**症状**：算法正确、IP/UA/TLS 都没问题，但 collector 总返 cookie 但用 cookie 跑 API 仍 403。

**根因**：Selenium / Playwright / Chromium-headless 默认会有 `navigator.webdriver = true` 等标记，PX SDK 在浏览器端就检测到，把"我被自动化"信息写进 EV2 的隐藏字段，服务器收到后判定 bot。

**修复**：
- 用 CDP 直接控真 Chrome（无 webdriver 注入）—— 见 [`skill/cdp/`](../skill/cdp/)
- 或用 `playwright-stealth` / `undetected-chromedriver` 之类的反检测插件
- 或纯算 generator（本项目的主路径，不开浏览器）

**来源**：`skill/cdp/SKILL.md`；多处实战记录

---

### #E8 ⭐ Node `https.request` 默认走 IPv6，慢甚至 timeout

**症状**：Generator 在生产偶尔 timeout，本地开发没问题。

**根因**：Node 18+ `https.request` 默认 `family: 0`（自动），可能选 IPv6。PX collector 在某些区域 IPv6 路由慢/不通。

**修复**：
```javascript
const req = https.request({
    ...,
    family: 4,   // 强制 IPv4
});
```

**来源**：iFood 生产排查记录

---

*SDK 版本漂移的 5 条坑见 [`4_sdk_drift.md`](4_sdk_drift.md)*
