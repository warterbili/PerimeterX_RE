---
name: cdp-browser
description: 通过 CDP（Chrome DevTools Protocol）控制真实 Chrome 浏览器进行网页操作、逆向分析和资料搜索。无 webdriver 特征，不触发反爬虫。适用场景：(1) 网站逆向分析（抓 API、分析 JS、拦截网络请求）；(2) 网页搜索和信息采集；(3) 需要绕过 bot 检测的网页自动化；(4) 分析 XHR/Fetch/WebSocket 流量；(5) 任何需要真实浏览器访问网站的任务。优先于 web_search、web_fetch 和 browser 工具使用。
---

# CDP Browser Skill

用真实 Chrome + CDP 协议控制浏览器，无 webdriver 注入，无 bot 特征。

## 核心脚本

`scripts/cdp.py` — 所有操作的入口。先读取该脚本了解 API，再按需调用。

## 快速使用

### 1. 启动 Chrome + 连接

```bash
# 启动 Chrome（如未运行）
python3 ~/.claude/skills/cdp-browser/scripts/cdp.py start

# 检查状态
python3 ~/.claude/skills/cdp-browser/scripts/cdp.py status
```

### 2. 常用操作（exec 直接运行）

```bash
# 导航到网页
python3 ~/.claude/skills/cdp-browser/scripts/cdp.py navigate "https://example.com"

# 截图（保存到 workspace）
python3 ~/.claude/skills/cdp-browser/scripts/cdp.py screenshot "/path/to/save.png"

# 获取页面 HTML
python3 ~/.claude/skills/cdp-browser/scripts/cdp.py html

# 执行 JS
python3 ~/.claude/skills/cdp-browser/scripts/cdp.py eval "document.title"

# 抓取网络请求（监听 N 秒）
python3 ~/.claude/skills/cdp-browser/scripts/cdp.py network 10

# 点击元素（CSS selector）
python3 ~/.claude/skills/cdp-browser/scripts/cdp.py click "#submit-btn"

# 输入文字
python3 ~/.claude/skills/cdp-browser/scripts/cdp.py type "#search-input" "关键词"

# 滚动页面
python3 ~/.claude/skills/cdp-browser/scripts/cdp.py scroll 0 500

# 等待元素出现
python3 ~/.claude/skills/cdp-browser/scripts/cdp.py wait ".result-list" 10

# 获取 Cookies
python3 ~/.claude/skills/cdp-browser/scripts/cdp.py cookies

# 停止 Chrome
python3 ~/.claude/skills/cdp-browser/scripts/cdp.py stop
```

### 3. Python 脚本内嵌使用

对于复杂流程，直接写 Python 脚本调用 `CDPClient`：

```python
import asyncio, sys
sys.path.insert(0, '/Users/linusgao/.openclaw/skills/cdp-browser/scripts')
from cdp import CDPClient, launch_chrome, get_tabs

async def main():
    launch_chrome()  # 如果没启动则启动
    tabs = get_tabs()
    async with CDPClient(tabs[0]['webSocketDebuggerUrl']) as cdp:
        await cdp.navigate('https://example.com')
        await cdp.wait_for_selector('.content')
        html = await cdp.get_html()
        requests = await cdp.capture_network(5)
        print(requests)

asyncio.run(main())
```

## 逆向分析工作流

1. `navigate` 到目标网站
2. `network` 监听请求，找 API 端点
3. `eval` 执行 JS 分析页面变量、全局对象
4. `html` 获取完整 DOM
5. 用 `screenshot` 记录页面状态

详细逆向技巧见 `references/reverse-tips.md`。

## ⚡ 推荐替代：agent-browser native 模式

`agent-browser` 的 `--native` 模式是更轻量的纯 Rust CDP 方案，适合逆向分析场景：

```bash
# 必须用 env var 启动（--native flag 有 bug，daemon 已运行时会被忽略）
export AGENT_BROWSER_NATIVE=1

# 打开页面
agent-browser open https://example.com

# 捕获网络请求（推荐两步走）
agent-browser network requests --clear
agent-browser open https://target.com
sleep 2
agent-browser network requests

# 截图
agent-browser screenshot --output /path/to/save.png

# 执行 JS
agent-browser eval "document.title"

# 获取 HTML
agent-browser html

# 停止 daemon
pkill -f agent-browser
```

**对比 cdp.py 脚本的优势：**
- 无需 Node.js/Playwright，纯 Rust，更快启动
- 网络请求捕获更干净（直接 CDP）
- 支持 Chromium + Safari（不支持 Firefox/WebKit）

**两步网络捕获原因：** native daemon 只记录打开后的请求，需先 `--clear` 再 `open`。

---

## 技术说明

- Chrome 进程：使用用户独立 profile（默认 `tempfile.gettempdir() / chrome-cdp-profile`，
  即 macOS/Linux 走 `/tmp/...`，Windows 走 `%TEMP%\...`），与正常浏览器隔离。
  可通过 `CHROME_PROFILE` env 覆盖。
- Chrome 二进制：按 `sys.platform` 自动检测
    - macOS:   `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
    - Windows: `C:\Program Files\Google\Chrome\Application\chrome.exe`
    - Linux:   `/usr/bin/google-chrome` / `/usr/bin/chromium` 等
  可通过 `CHROME_BIN` env 覆盖。
- CDP 端口：`localhost:9222`
- 依赖：Python 3 标准库 + `websockets`（已安装）
- 无 Playwright/Selenium，无 webdriver 特征
