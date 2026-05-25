"""
Self-run capture for Total Wine & More (totalwine.com) PX traffic.

This site is US-only and aggressively flags non-US IPs straight into a
press-and-hold captcha. To get the no-touch collector flow we route Chrome
through BrightData's US residential proxy (zproxy.lum-superproxy.io:22225).
Auth is handled via the CDP Fetch domain on the browser-level WebSocket.

Findings from initial reconnaissance:
- AppID:               PXFF0j69T5
- First-party enabled: true
- Host URL:            /FF0j69T5/xhr
- Main SDK URL:        https://client.px-cloud.net/PXFF0j69T5/main.min.js
- Collector (no-touch GET):
                       https://collector-pxff0j69t5.px-client.net/b/g?payload=...
- Captcha bundle POST: https://www.totalwine.com/FF0j69T5/xhr/assets/js/bundle

Run from project root:
    python tmp/totalwine/script/capture_via_cdp_totalwine.py [N=6]
"""

import asyncio
import base64
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent.parent / "skill" / "cdp" / "scripts"))
from cdp import CDPClient, CHROME_BIN  # noqa: E402

ROOT = Path(os.environ.get("CAPTURE_ROOT") or str(HERE.parent))  # tmp/totalwine
SDK_DIR = ROOT / "source"
SAMPLES = ROOT / "sample"
LOG_DIR = ROOT / "log"
CHROME = CHROME_BIN
CDP_PORT = int(os.environ.get("CDP_PORT") or 9222)
PROFILE = ROOT / "chrome_profile"

URL = os.environ.get("PX_URL") or "https://www.totalwine.com/"
APP_ID_HINT = "PXFF0j69T5"

# ── Proxy (opt-in via env vars) ──────────────────────────────────────────────
# Default mode: no proxy — assume the host is already on a US VPN.
# To use a residential proxy (BrightData / Oxylabs / Smartproxy) via CDP
# Fetch.handleAuthRequired, set all four:
#   PROXY_HOST, PROXY_PORT, PROXY_USER, PROXY_PASS
PROXY_HOST = os.environ.get("PROXY_HOST")
PROXY_PORT = int(os.environ.get("PROXY_PORT") or 0) or None
PROXY_USER = os.environ.get("PROXY_USER")
PROXY_PASS = os.environ.get("PROXY_PASS")
USE_PROXY = all((PROXY_HOST, PROXY_PORT, PROXY_USER, PROXY_PASS))

SDK_URL_MATCHERS = [
    "client.px-cloud.net/PXFF0j69T5/main.min.js",
    "totalwine.com/FF0j69T5/init.js",
]
COLLECTOR_PATH_MATCHERS = [
    "/FF0j69T5/xhr/api/v2/collector",
    "/api/v2/collector",
    "collector-pxff0j69t5.px-client.net/b/g",
]
BUNDLE_PATH_MATCHERS = [
    "/FF0j69T5/xhr/assets/js/bundle",
]


def cdp_up() -> bool:
    try:
        urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json/version", timeout=1)
        return True
    except Exception:
        return False


def launch_chrome():
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
    if USE_PROXY:
        args += [
            f"--proxy-server=http://{PROXY_HOST}:{PROXY_PORT}",
            "--proxy-bypass-list=<-loopback>",
        ]
        print(f"[*] Launching Chrome through proxy http://{PROXY_HOST}:{PROXY_PORT} …")
    else:
        print("[*] Launching Chrome (no proxy — assuming host is on VPN) …")
    subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(60):
        if cdp_up():
            print("[*] CDP ready")
            return
        time.sleep(0.5)
    raise RuntimeError("Chrome did not start")


def list_targets():
    return json.loads(urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json", timeout=3).read())


def get_browser_ws() -> str:
    data = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json/version", timeout=3).read())
    return data["webSocketDebuggerUrl"]


async def install_proxy_auth(cdp: CDPClient, scope: str = "page"):
    """Subscribe to Fetch.authRequired on this CDP client and inject
    BrightData credentials. Wrap the existing _handle_event so other
    handlers (e.g. Network capture) still run."""
    orig = cdp._handle_event

    async def patched(msg):
        m = msg.get("method", "")
        p = msg.get("params", {})
        if m == "Fetch.authRequired":
            req_id = p.get("requestId")
            try:
                await cdp.send("Fetch.continueWithAuth", {
                    "requestId": req_id,
                    "authChallengeResponse": {
                        "response": "ProvideCredentials",
                        "username": PROXY_USER,
                        "password": PROXY_PASS,
                    },
                })
            except Exception as e:
                print(f"[proxy-auth] continueWithAuth failed: {e}")
        elif m == "Fetch.requestPaused":
            req_id = p.get("requestId")
            # No URL patterns are registered, so requestPaused only fires
            # for the auth challenge round-trip — just resume.
            try:
                await cdp.send("Fetch.continueRequest", {"requestId": req_id})
            except Exception:
                pass
        await orig(msg)

    cdp._handle_event = patched
    # No patterns → no requestPaused for normal traffic; only auth gets handled.
    await cdp.send("Fetch.enable", {"handleAuthRequests": True})
    print(f"[proxy-auth/{scope}] installed for '{PROXY_USER[:24]}…'")


async def capture_one_batch(browser: CDPClient, batch_id: int, batch_dir: Path, sdk_target_path: Path) -> dict:
    print(f"\n[batch {batch_id}] creating isolated browser context…")

    ctx = await browser.send("Target.createBrowserContext", {"disposeOnDetach": True})
    ctx_id = ctx["browserContextId"]

    target = await browser.send("Target.createTarget", {
        "url": "about:blank",
        "browserContextId": ctx_id,
    })
    target_id = target["targetId"]

    time.sleep(0.6)
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

    async with CDPClient(tab_ws) as cdp:
        if USE_PROXY:
            # Install proxy auth FIRST so the very first request gets credentials.
            await install_proxy_auth(cdp, scope=f"batch{batch_id}")

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

        print(f"[batch {batch_id}] waiting 18s for PX collector chain…")
        await asyncio.sleep(18)

        sdk_req = None
        posts = []
        bundles = []
        for rid, r in seen.items():
            url = r.get("url") or ""
            if any(m in url for m in SDK_URL_MATCHERS):
                sdk_req = (rid, r)
            if any(p in url for p in COLLECTOR_PATH_MATCHERS):
                r["request_id"] = rid
                posts.append(r)
            if r.get("method") == "POST" and any(p in url for p in BUNDLE_PATH_MATCHERS):
                r["request_id"] = rid
                bundles.append(r)

        print(f"[batch {batch_id}] sdk:{'Y' if sdk_req else 'N'}  collector: {len(posts)}  bundle: {len(bundles)}")

        batch_dir.mkdir(parents=True, exist_ok=True)

        if sdk_req and (not sdk_target_path.exists() or sdk_target_path.stat().st_size < 1000):
            body = await cdp.get_response_body(sdk_req[0])
            if body:
                sdk_target_path.parent.mkdir(parents=True, exist_ok=True)
                sdk_target_path.write_text(body, encoding="utf-8")
                print(f"[batch {batch_id}] saved SDK → {sdk_target_path} ({len(body)} chars)")
        elif sdk_req:
            body = await cdp.get_response_body(sdk_req[0])
            if body:
                new_sha = hashlib.sha256(body.encode("utf-8")).hexdigest()
                cur_sha = hashlib.sha256(sdk_target_path.read_bytes()).hexdigest()
                if new_sha != cur_sha:
                    print(f"[batch {batch_id}] ⚠️ SDK CHANGED  old={cur_sha[:12]}  new={new_sha[:12]}")
                    (batch_dir / f"_sdk_diff_{new_sha[:8]}.js").write_text(body, encoding="utf-8")
                else:
                    print(f"[batch {batch_id}] SDK unchanged ({cur_sha[:12]}…)")

        posts.sort(key=lambda r: r.get("ts") or 0)
        for i, r in enumerate(posts[:3], 1):
            method = r.get("method") or "?"
            post = r.get("postData") or ""
            lines = [f"{method} {r['url']}"]
            for k, v in (r.get("headers") or {}).items():
                lines.append(f"{k}: {v}")
            lines.append("")
            lines.append(post)
            (batch_dir / f"request_{i}.txt").write_text("\n".join(lines), encoding="utf-8")
            resp = await cdp.get_response_body(r["request_id"]) or ""
            (batch_dir / f"response_{i}.json").write_text(resp, encoding="utf-8")

        for i, r in enumerate(bundles[:2], 1):
            method = r.get("method") or "?"
            post = r.get("postData") or ""
            lines = [f"{method} {r['url']}"]
            for k, v in (r.get("headers") or {}).items():
                lines.append(f"{k}: {v}")
            lines.append("")
            lines.append(post)
            (batch_dir / f"bundle_request_{i}.txt").write_text("\n".join(lines), encoding="utf-8")
            resp = await cdp.get_response_body(r["request_id"]) or ""
            (batch_dir / f"bundle_response_{i}.json").write_text(resp, encoding="utf-8")

        meta = {"batch_id": batch_id, "proxy": f"{PROXY_HOST}:{PROXY_PORT}"}
        if posts:
            p1 = posts[0]
            method0 = p1.get("method") or ""
            body_or_query = (
                urllib.parse.urlparse(p1.get("url") or "").query
                if method0 == "GET"
                else (p1.get("postData") or "")
            )

            def gp(n):
                m = re.search(rf"(?:^|&){re.escape(n)}=([^&]*)", body_or_query)
                return urllib.parse.unquote_plus(m.group(1)) if m else None

            meta.update({
                "site": "totalwine.com",
                "uuid": gp("uuid"),
                "tag": gp("tag"),
                "ft": gp("ft"),
                "app_id": gp("appId"),
                "seq": gp("seq"),
                "en": gp("en"),
                "method_post_1": method0,
                "captured_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "collector_post_count": len(posts),
                "bundle_post_count": len(bundles),
                "status_post_1": posts[0].get("status"),
                "status_post_2": posts[1].get("status") if len(posts) > 1 else None,
                "first_collector_url": posts[0].get("url"),
            })
        else:
            try:
                LOG_DIR.mkdir(parents=True, exist_ok=True)
                shot = await cdp.send("Page.captureScreenshot", {"format": "png"})
                (batch_dir / "_failed_screenshot.png").write_bytes(base64.b64decode(shot["data"]))
                seen_urls = sorted({(r.get("method") or "?") + " " + (r.get("url") or "") for r in seen.values()})
                (batch_dir / "_seen_urls.txt").write_text("\n".join(seen_urls), encoding="utf-8")
            except Exception as e:
                print(f"[batch {batch_id}] debug capture failed: {e}")
            meta["error"] = "no collector POST"

        (batch_dir / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    try:
        await browser.send("Target.disposeBrowserContext", {"browserContextId": ctx_id})
    except Exception:
        pass

    return meta


async def main():
    launch_chrome()

    N = int(sys.argv[1]) if len(sys.argv) > 1 else 6
    sdk_path = SDK_DIR / "main.min.js"

    browser_ws = get_browser_ws()
    async with CDPClient(browser_ws) as browser:
        summary = []
        for i in range(1, N + 1):
            bd = SAMPLES / str(i)
            shutil.rmtree(bd, ignore_errors=True)
            meta = await capture_one_batch(browser, i, bd, sdk_path)
            summary.append(meta)
            if i < N:
                print(f"[*] sleeping 18s before batch {i+1}…")
                await asyncio.sleep(18)

        if sdk_path.exists():
            h = hashlib.sha256(sdk_path.read_bytes()).hexdigest()
            (SDK_DIR / "INFO.json").write_text(json.dumps({
                "sha256": h,
                "size": sdk_path.stat().st_size,
                "url": "https://client.px-cloud.net/PXFF0j69T5/main.min.js",
                "captured_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }, indent=2), encoding="utf-8")
            print(f"\n[*] SDK sha256: {h}")
            for s in summary:
                if isinstance(s, dict) and "error" not in s and "batch_id" in s:
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
