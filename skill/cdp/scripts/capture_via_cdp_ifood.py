"""
Self-run validation: capture fresh PX collector traffic from ifood.com.br
via CDP, against a single locked SDK.

Per-batch isolation uses Target.createBrowserContext (a real incognito-like
profile partition), so we get a fresh session each time without the suspicious
"clear-cookies-then-revisit-same-URL" pattern.

Output layout:
  _test_run/
    sdk/
      main.min.js
      INFO.json
    samples/<N>/
      meta.json
      request_1.txt   response_1.json
      request_2.txt   response_2.json
      [request_3.txt  response_3.json]
"""

import asyncio
import hashlib
import json
import re
import shutil
import subprocess
import sys
import time
import urllib.request
import urllib.parse
from pathlib import Path

SKILL = r"C:\Users\lsd\.claude\skills\cdp-browser\scripts"
sys.path.insert(0, SKILL)
from cdp import CDPClient  # noqa: E402

ROOT = Path(r"C:\Users\lsd\lsd_projects\perimeter_X\_test_run")
SDK_DIR = ROOT / "sdk"
SAMPLES = ROOT / "samples"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
CDP_PORT = 9222
PROFILE = ROOT / "chrome_profile"
URL = "https://www.ifood.com.br/restaurantes"


def cdp_up():
    try:
        urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json/version", timeout=1)
        return True
    except Exception:
        return False


def launch_chrome_windows():
    if cdp_up():
        print(f"[*] Chrome already on :{CDP_PORT}")
        return
    PROFILE.mkdir(parents=True, exist_ok=True)
    args = [
        CHROME,
        f"--remote-debugging-port={CDP_PORT}",
        f"--user-data-dir={PROFILE}",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-popup-blocking",
        "--disable-blink-features=AutomationControlled",
    ]
    print("[*] Launching Chrome…")
    subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(40):
        if cdp_up():
            print("[*] CDP ready")
            return
        time.sleep(0.5)
    raise RuntimeError("Chrome did not start")


def list_targets():
    return json.loads(urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json", timeout=3).read())


def get_browser_ws():
    return json.loads(urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json/version", timeout=3).read())["webSocketDebuggerUrl"]


async def capture_one_batch(batch_id: int, batch_dir: Path, sdk_target_path: Path) -> dict:
    """Open a fresh browser-context tab, navigate, collect, save."""
    print(f"\n[batch {batch_id}] creating isolated browser context…")

    # 1. Connect to the **browser-level** CDP endpoint (allows BrowserContext ops)
    browser_ws = get_browser_ws()
    async with CDPClient(browser_ws) as browser:
        # 2. Create a fresh BrowserContext (incognito-equivalent)
        ctx = await browser.send("Target.createBrowserContext", {"disposeOnDetach": True})
        ctx_id = ctx["browserContextId"]

        # 3. Create a new page Target in that context
        target = await browser.send("Target.createTarget", {
            "url": "about:blank",
            "browserContextId": ctx_id,
        })
        target_id = target["targetId"]

        # 4. Find the target's WS endpoint
        time.sleep(0.5)
        targets = list_targets()
        tab_ws = None
        for t in targets:
            if t.get("id") == target_id and t.get("type") == "page":
                tab_ws = t["webSocketDebuggerUrl"]
                break
        if not tab_ws:
            for t in targets:
                if t.get("type") == "page" and "about:blank" in (t.get("url") or ""):
                    tab_ws = t["webSocketDebuggerUrl"]
                    target_id = t["id"]
                    break
        if not tab_ws:
            raise RuntimeError("Could not find new tab WS")

        # 5. Drive the tab
        async with CDPClient(tab_ws) as cdp:
            seen: dict[str, dict] = {}
            orig = cdp._handle_event

            async def patched(msg):
                m = msg.get("method", "")
                p = msg.get("params", {})
                if m == "Network.requestWillBeSent":
                    rid = p["requestId"]
                    r = p.get("request", {})
                    seen[rid] = {
                        "url": r.get("url"),
                        "method": r.get("method"),
                        "headers": r.get("headers", {}),
                        "postData": r.get("postData"),
                        "type": p.get("type"),
                        "ts": p.get("timestamp"),
                    }
                elif m == "Network.responseReceived":
                    rid = p["requestId"]
                    rr = p.get("response", {})
                    if rid in seen:
                        seen[rid]["status"] = rr.get("status")
                        seen[rid]["responseHeaders"] = rr.get("headers", {})
                await orig(msg)
            cdp._handle_event = patched

            await cdp.send("Network.enable", {
                "maxTotalBufferSize": 100 * 1024 * 1024,
                "maxResourceBufferSize": 50 * 1024 * 1024,
            })
            await cdp.send("Page.enable")
            await cdp.send("Page.navigate", {"url": URL})

            print(f"[batch {batch_id}] waiting 14s for PX collector…")
            await asyncio.sleep(14)

            sdk_req = None
            posts = []
            for rid, r in seen.items():
                url = r.get("url") or ""
                if "client.px-cloud.net" in url and "main.min.js" in url:
                    sdk_req = (rid, r)
                elif "/api/v2/collector" in url and r.get("method") == "POST":
                    r["request_id"] = rid
                    posts.append(r)
                elif "collector-" in url and r.get("method") == "POST":
                    r["request_id"] = rid
                    posts.append(r)

            print(f"[batch {batch_id}] sdk:{'Y' if sdk_req else 'N'}  collector POSTs: {len(posts)}")

            batch_dir.mkdir(parents=True, exist_ok=True)

            # Save SDK once (or replace if missing)
            if sdk_req and (not sdk_target_path.exists() or sdk_target_path.stat().st_size < 1000):
                body = await cdp.get_response_body(sdk_req[0])
                if body:
                    sdk_target_path.parent.mkdir(parents=True, exist_ok=True)
                    sdk_target_path.write_text(body, encoding="utf-8")
                    print(f"[batch {batch_id}] saved SDK → {sdk_target_path}")
            elif sdk_req:
                # Verify identical
                body = await cdp.get_response_body(sdk_req[0])
                if body:
                    new_sha = hashlib.sha256(body.encode("utf-8")).hexdigest()
                    cur_sha = hashlib.sha256(sdk_target_path.read_bytes()).hexdigest()
                    if new_sha != cur_sha:
                        print(f"[batch {batch_id}] ⚠️ SDK CHANGED! old={cur_sha[:12]}…  new={new_sha[:12]}…")
                        (batch_dir / f"_sdk_diff_{new_sha[:8]}.js").write_text(body, encoding="utf-8")
                    else:
                        print(f"[batch {batch_id}] SDK unchanged ({cur_sha[:12]}…)")

            posts.sort(key=lambda r: r.get("ts") or 0)
            for i, r in enumerate(posts[:3], 1):
                post = r.get("postData") or ""
                lines = [f"POST {r['url']}"]
                for k, v in (r.get("headers") or {}).items():
                    lines.append(f"{k}: {v}")
                lines.append("")
                lines.append(post)
                (batch_dir / f"request_{i}.txt").write_text("\n".join(lines), encoding="utf-8")
                resp = await cdp.get_response_body(r["request_id"]) or ""
                (batch_dir / f"response_{i}.json").write_text(resp, encoding="utf-8")

            meta = {"batch_id": batch_id}
            if posts:
                p1 = posts[0].get("postData") or ""

                def gp(n):
                    m = re.search(rf"(?:^|&){re.escape(n)}=([^&]*)", p1)
                    return urllib.parse.unquote_plus(m.group(1)) if m else None

                meta.update({
                    "uuid": gp("uuid"),
                    "tag": gp("tag"),
                    "ft": gp("ft"),
                    "app_id": gp("appId"),
                    "captured_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "collector_post_count": len(posts),
                    "status_post_1": posts[0].get("status"),
                    "status_post_2": posts[1].get("status") if len(posts) > 1 else None,
                })
            else:
                # Screenshot for debug
                try:
                    import base64
                    shot = await cdp.send("Page.captureScreenshot", {"format": "png"})
                    (batch_dir / "_failed_screenshot.png").write_bytes(base64.b64decode(shot["data"]))
                except Exception:
                    pass
                meta["error"] = "no collector POST"

            (batch_dir / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

        # 6. Dispose the BrowserContext (kills all its tabs, cookies, storage)
        try:
            await browser.send("Target.disposeBrowserContext", {"browserContextId": ctx_id})
        except Exception:
            pass

        return meta


async def main():
    launch_chrome_windows()

    N = int(sys.argv[1]) if len(sys.argv) > 1 else 6
    sdk_path = SDK_DIR / "main.min.js"

    summary = []
    for i in range(1, N + 1):
        bd = SAMPLES / str(i)
        shutil.rmtree(bd, ignore_errors=True)
        meta = await capture_one_batch(i, bd, sdk_path)
        summary.append(meta)
        if i < N:
            print(f"[*] sleeping 18s before batch {i+1}…")
            await asyncio.sleep(18)

    # Final SDK hash
    if sdk_path.exists():
        h = hashlib.sha256(sdk_path.read_bytes()).hexdigest()
        (SDK_DIR / "INFO.json").write_text(json.dumps({
            "sha256": h,
            "size": sdk_path.stat().st_size,
            "url": "https://client.px-cloud.net/PXO1GDTa7Q/main.min.js",
            "captured_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }, indent=2), encoding="utf-8")
        print(f"\n[*] SDK sha256: {h}")
        for s in summary:
            if isinstance(s, dict) and "error" not in s:
                p = SAMPLES / str(s["batch_id"]) / "meta.json"
                if p.exists():
                    m = json.loads(p.read_text(encoding="utf-8"))
                    m["sdk_sha256"] = h
                    p.write_text(json.dumps(m, indent=2), encoding="utf-8")

    print("\n────── SUMMARY ──────")
    for s in summary:
        print(json.dumps(s, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
