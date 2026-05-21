# 网站逆向分析技巧

## 1. 抓 API 端点

```python
# 监听所有 XHR/Fetch 请求
await cdp.send("Network.enable")
await cdp.navigate("https://target.com")
await asyncio.sleep(10)  # 等待页面加载完成

reqs = list(cdp._network_requests.values())
api_calls = [r for r in reqs if r.get("type") in ("XHR", "Fetch")]
for r in api_calls:
    print(r["method"], r["url"])
    if r.get("postData"):
        print("  Body:", r["postData"])
```

## 2. 获取响应体

```python
# 需要在 Network.enable 后，请求发送时保存 requestId
# 通过 _events 找到对应的 requestId
for evt in cdp._events:
    if evt.get("method") == "Network.responseReceived":
        req_id = evt["params"]["requestId"]
        url = evt["params"]["response"]["url"]
        if "api" in url:
            body = await cdp.get_response_body(req_id)
            print(f"API: {url}")
            print(f"Response: {body[:500]}")
```

## 3. Hook XHR/Fetch（JS 注入）

```python
# 在页面加载前注入 hook，捕获所有请求
hook_js = """
window._captured_requests = [];
const origFetch = window.fetch;
window.fetch = function(...args) {
    window._captured_requests.push({type:'fetch', url: args[0], options: args[1]});
    return origFetch.apply(this, args);
};
const origOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url) {
    window._captured_requests.push({type:'xhr', method, url});
    return origOpen.apply(this, arguments);
};
"""
await cdp.send("Page.addScriptToEvaluateOnNewDocument", {"source": hook_js})
await cdp.navigate("https://target.com")
await asyncio.sleep(5)
requests = await cdp.eval("JSON.stringify(window._captured_requests)")
print(requests)
```

## 4. 分析全局 JS 变量

```python
# 列出页面所有全局变量（非标准的）
globals_js = """
Object.keys(window).filter(k => {
    try {
        return !['undefined','object','function'].includes(typeof window[k]) ||
               (typeof window[k] === 'object' && window[k] !== null && 
                !['document','history','location','navigator','screen','window'].includes(k));
    } catch(e) { return false; }
}).slice(0, 50)
"""
result = await cdp.eval(globals_js)
print(result)

# 读取特定变量
data = await cdp.eval("JSON.stringify(window.__INITIAL_STATE__ || window.__NEXT_DATA__ || {})")
```

## 5. 绕过简单反爬

```python
# 伪装 navigator
await cdp.eval("""
Object.defineProperty(navigator, 'webdriver', {get: () => false});
Object.defineProperty(navigator, 'plugins', {get: () => [1,2,3,4,5]});
Object.defineProperty(navigator, 'languages', {get: () => ['pt-BR','en']});
""")

# 设置自定义 UA
await cdp.set_user_agent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/145.0.0.0 Safari/537.36"
)
```

## 6. WebSocket 流量分析

```python
# 监听 WebSocket 帧
ws_frames = []
async def handle_event(msg):
    if msg.get("method") in ("Network.webSocketFrameReceived", "Network.webSocketFrameSent"):
        ws_frames.append(msg["params"])

cdp._handle_event = handle_event  # 覆盖事件处理
await cdp.send("Network.enable")
await cdp.navigate("https://target.com")
await asyncio.sleep(15)
for frame in ws_frames:
    print(frame.get("response", {}).get("payloadData", "")[:200])
```

## 7. 截取完整长页面

```python
await cdp.screenshot("/tmp/full_page.png", full_page=True)
```

## 8. 处理 SPA（单页应用）

```python
# 等待数据加载完成（等 loading 消失）
await cdp.navigate("https://target.com")
await cdp.wait_for_selector(".content-loaded", timeout=20)

# 或等待特定 JS 变量
for _ in range(20):
    data = await cdp.eval("window.__DATA_LOADED__")
    if data:
        break
    await asyncio.sleep(0.5)
```

## 9. 多标签页操作

```python
import urllib.request, json, urllib.parse

# 新建标签页
res = urllib.request.urlopen("http://localhost:9222/json/new?about:blank").read()
new_tab = json.loads(res)

# 连接新 tab
async with CDPClient(new_tab["webSocketDebuggerUrl"]) as cdp2:
    await cdp2.navigate("https://other-site.com")
```

## 10. 保存/恢复 Session

```python
# 保存 cookies 到文件
cookies = await cdp.get_cookies()
with open("session.json", "w") as f:
    json.dump(cookies, f)

# 恢复 cookies
with open("session.json") as f:
    cookies = json.load(f)
for c in cookies:
    await cdp.set_cookie(c["name"], c["value"], c["domain"], c.get("path", "/"))
```
