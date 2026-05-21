# CDP Skill — 真 Chrome 控制器

> 通过 Chrome DevTools Protocol 控制真实 Chrome 浏览器。**无 webdriver 痕迹**，
> 不会被 PX / Cloudflare / DataDome 等反爬识破。

## 目录结构

```
skill/cdp/
├── README.md                          ← 本文件
├── SKILL.md                            ← 通用 skill 用法说明
├── scripts/
│   ├── cdp.py                          ← 通用 CDP 控制器（CLI + Python API）
│   ├── capture_via_cdp_ifood.py        ← PX 专用：抓 iFood collector
│   └── capture_via_cdp_grubhub.py      ← PX 专用：抓 Grubhub collector
└── references/
    └── reverse-tips.md                 ← 逆向技巧速查
```

## 两层架构

**Layer 1 — 通用 CDP 工具（`scripts/cdp.py`）**

任何 CDP 项目都能复用。提供 11 个 CLI 命令：

```bash
python skill/cdp/scripts/cdp.py start       # 启 Chrome
python skill/cdp/scripts/cdp.py navigate <URL>
python skill/cdp/scripts/cdp.py network <SEC>
python skill/cdp/scripts/cdp.py eval <JS>
python skill/cdp/scripts/cdp.py screenshot <PATH>
python skill/cdp/scripts/cdp.py html
python skill/cdp/scripts/cdp.py cookies
python skill/cdp/scripts/cdp.py click <SELECTOR>
python skill/cdp/scripts/cdp.py type <SELECTOR> <TEXT>
python skill/cdp/scripts/cdp.py status
python skill/cdp/scripts/cdp.py stop
```

也支持 Python 直接 import `CDPClient`。详见 [`SKILL.md`](SKILL.md)。

**Layer 2 — PX 专用抓包脚本（`scripts/capture_via_cdp_*.py`）**

基于 `cdp.py` 写的 PX 业务封装：

| 脚本 | 抓什么 |
|---|---|
| `capture_via_cdp_ifood.py` | iFood `collector-pxo1gdta7q.px-cloud.net/api/v2/collector` POST |
| `capture_via_cdp_grubhub.py` | Grubhub `sensor.grubhub.com/.../collector` POST |

每批做的事：

1. 全新 Chrome profile + 清 cookies/cache
2. 启 CDP，订阅 `Network.requestWillBeSent` / `Network.responseReceived` / `Network.loadingFinished`
3. 导航到目标页面，等 PX 完成 2 个 collector POST
4. 把 request body + response body 完整保存
5. 算 SDK SHA-256 写入 meta.json（跨批次一致性校验）

用法：

```bash
python skill/cdp/scripts/capture_via_cdp_ifood.py 1   # 抓批次 1
python skill/cdp/scripts/capture_via_cdp_ifood.py 2   # 抓批次 2
... 6 批
```

## 为什么不能用 Selenium / Playwright

| 工具 | webdriver 痕迹 | PX 反应 |
|---|---|---|
| Selenium | `navigator.webdriver = true` 等 10+ 信号 | 立刻 ban |
| Playwright（默认） | 同上 + 多个自动化痕迹 | 立刻 ban |
| **CDP 直连真 Chrome** | **零注入零痕迹** | **正常用户** |

CDP 直接通过 `--remote-debugging-port` 跟真 Chrome 进程对话，**不注入任何
JS、不改任何 navigator 属性**。这是目前唯一能抓干净 PX 流量的方式。

## 文档引用

完整使用手册见 [`../../main/ZH/PX_完整SDK对照逆向方法论.md`](../../main/ZH/PX_完整SDK对照逆向方法论.md)
★ 章节（"抓包与 SDK 固定"）。
