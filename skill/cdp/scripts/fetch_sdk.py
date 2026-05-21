"""Capture the current Grubhub PerimeterX SDK .js source."""
import asyncio, base64, json, os, subprocess, sys, time, urllib.request
from pathlib import Path
import websockets

CHROME_BIN = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
CDP_PORT = 9223
PROFILE = Path(os.environ.get("TEMP", r"C:\Windows\Temp")) / "grubhub-sdk-capture"
SDK_DIR = Path(__file__).resolve().parent.parent / "sdk_cache"


def launch():
    PROFILE.mkdir(parents=True, exist_ok=True)
    subprocess.Popen([CHROME_BIN, f"--remote-debugging-port={CDP_PORT}",
                      f"--user-data-dir={PROFILE}", "--no-first-run",
                      "--no-default-browser-check", "about:blank"],
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(40):
        time.sleep(0.5)
        try:
            urllib.request.urlopen(f"http://localhost:{CDP_PORT}/json", timeout=2); return
        except Exception:
            pass
    raise RuntimeError("Chrome timeout")


async def main():
    SDK_DIR.mkdir(parents=True, exist_ok=True)
    launch()
    tabs = json.loads(urllib.request.urlopen(f"http://localhost:{CDP_PORT}/json").read())
    ws_url = next(t for t in tabs if t.get("type") == "page")["webSocketDebuggerUrl"]
    requests = {}
    px_finished = []

    async with websockets.connect(ws_url, max_size=80 * 1024 * 1024) as ws:
        cid = 0
        pending = {}

        async def listen():
            async for raw in ws:
                m = json.loads(raw)
                if "id" in m:
                    fut = pending.pop(m["id"], None)
                    if fut and not fut.done(): fut.set_result(m)
                else:
                    method = m.get("method", "")
                    p = m.get("params", {})
                    if method == "Network.requestWillBeSent":
                        rid = p.get("requestId")
                        url = p.get("request", {}).get("url", "")
                        requests[rid] = {"url": url}
                    elif method == "Network.responseReceived":
                        rid = p.get("requestId")
                        if rid in requests:
                            requests[rid]["status"] = p.get("response", {}).get("status")
                            requests[rid]["mime"] = p.get("response", {}).get("mimeType")
                    elif method == "Network.loadingFinished":
                        rid = p.get("requestId")
                        if rid in requests:
                            u = requests[rid].get("url", "")
                            if any(s in u for s in [
                                ".px-cdn.net", "px-cloud.net", "perimeterx", "sensor.grubhub.com",
                                "/captcha/", "/init.js",
                            ]):
                                px_finished.append(rid)

        async def send(method, params=None):
            nonlocal cid; cid += 1
            cur = cid
            fut = asyncio.get_event_loop().create_future()
            pending[cur] = fut
            await ws.send(json.dumps({"id": cur, "method": method, "params": params or {}}))
            r = await asyncio.wait_for(fut, timeout=30)
            if "error" in r: raise RuntimeError(r["error"])
            return r.get("result", {})

        listen_task = asyncio.create_task(listen())

        await send("Page.enable")
        await send("Network.enable")
        await send("Network.clearBrowserCookies")
        await send("Page.navigate", {"url": "https://www.grubhub.com/login"})

        await asyncio.sleep(20)

        print(f"\nMatched PX resources ({len(px_finished)}):")
        for rid in px_finished:
            r = requests[rid]
            print(f"  status={r.get('status')} mime={r.get('mime')}  url={r['url']}")
            try:
                resp = await send("Network.getResponseBody", {"requestId": rid})
                body = resp.get("body", "")
                if resp.get("base64Encoded"):
                    body = base64.b64decode(body)
                else:
                    body = body.encode("utf-8")
                # filename from url
                from urllib.parse import urlparse, unquote
                u = urlparse(r["url"])
                fname = (u.path.replace("/", "_").strip("_") or "root") + (".js" if "js" in (r.get("mime") or "") else ".bin")
                out = SDK_DIR / fname
                out.write_bytes(body)
                print(f"    -> saved {out.name} ({len(body)} bytes)")
            except Exception as e:
                print(f"    -> getResponseBody failed: {e}")

        # also dump all script URLs to logs/
        all_scripts = [r for r in requests.values()
                       if r.get("mime") and "javascript" in r["mime"]]
        scripts_log = SDK_DIR / "_all_scripts.txt"
        scripts_log.write_text("\n".join(f"{r.get('status')} {r['url']}" for r in all_scripts), encoding="utf-8")
        print(f"\n{len(all_scripts)} JS resources logged to {scripts_log.name}")

        listen_task.cancel()

asyncio.run(main())
