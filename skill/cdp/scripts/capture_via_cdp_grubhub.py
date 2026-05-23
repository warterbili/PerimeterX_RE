"""
Self-run capture for Grubhub PX traffic. Same pattern as the iFood script
but with Grubhub's app_id / URL / collector hostname.

Run against a US IP.
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

import os
SKILL = os.environ.get("CDP_SKILL_DIR") or str(Path.home() / ".claude" / "skills" / "cdp-browser" / "scripts")
sys.path.insert(0, SKILL)
# Also import the local cdp.py (lives next to this script) so we can reuse
# its cross-platform Chrome auto-detection.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from cdp import CDPClient, CHROME_BIN  # noqa: E402

ROOT = Path(os.environ.get("CAPTURE_ROOT") or str(Path(__file__).resolve().parent.parent / "capture_workspace" / "grubhub"))
SDK_DIR = ROOT / "sdk"
SAMPLES = ROOT / "samples"
# Chrome binary auto-detected by cdp.py (Mac / Windows / Linux); set
# CHROME_BIN env var to override.
CHROME = CHROME_BIN
CDP_PORT = 9222
PROFILE = ROOT / "chrome_profile"

# Grubhub homepage activates the PX collector; /login is also a good target
URL = "https://www.grubhub.com/"
APP_ID_HINT = "PXdRotaCw0"

# Grubhub serves PX via its own sensor host, NOT client.px-cloud.net
SDK_URL_MATCHERS = ["sensor.grubhub.com", "PXdRotaCw0"]
COLLECTOR_PATH_MATCHERS = ["/xhr/api/v2/collector", "/api/v2/collector"]


def launch_chrome() -> subprocess.Popen | None:
    try:
        urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json/version", timeout=1)
        print(f"[*] Chrome already on :{CDP_PORT}")
        return None
    except Exception:
        pass
    PROFILE.mkdir(parents=True, exist_ok=True)
    args = [
        CHROME,
        f"--remote-debugging-port={CDP_PORT}",
        f"--user-data-dir={PROFILE}",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-popup-blocking",
        "--disable-blink-features=AutomationControlled",
        URL,
    ]
    print("[*] Launching Chrome…")
    proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(40):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json/version", timeout=1)
            return proc
        except Exception:
            time.sleep(0.5)
    raise RuntimeError("Chrome did not start")


def get_target_tab():
    data = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json", timeout=3).read())
    for t in data:
        if t.get("type") == "page" and "grubhub.com" in (t.get("url") or ""):
            return t
    for t in data:
        if t.get("type") == "page":
            return t
    raise RuntimeError("No tabs")


async def capture_once(cdp: CDPClient, batch_id: int, batch_dir: Path) -> dict:
    print(f"\n[batch {batch_id}] navigating…")
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
            r = p.get("response", {})
            if rid in seen:
                seen[rid]["status"] = r.get("status")
                seen[rid]["responseHeaders"] = r.get("headers", {})
        await orig(msg)
    cdp._handle_event = patched

    await cdp.send("Network.enable", {
        "maxTotalBufferSize": 100 * 1024 * 1024,
        "maxResourceBufferSize": 50 * 1024 * 1024,
    })
    await cdp.send("Network.clearBrowserCookies")
    await cdp.send("Network.clearBrowserCache")

    await cdp.send("Page.enable")
    await cdp.send("Page.navigate", {"url": URL})

    print(f"[batch {batch_id}] waiting 14s for PX collector...")
    await asyncio.sleep(14)

    sdk_req = None
    posts = []
    for rid, r in seen.items():
        url = r.get("url") or ""
        if any(m in url for m in SDK_URL_MATCHERS) and ("init" in url or "main" in url or url.endswith(".js")):
            sdk_req = (rid, r)
        if r.get("method") == "POST" and any(p in url for p in COLLECTOR_PATH_MATCHERS):
            r["request_id"] = rid
            posts.append(r)

    print(f"[batch {batch_id}] sdk: {sdk_req is not None}; POSTs: {len(posts)}")

    if not posts:
        try:
            import base64
            batch_dir.mkdir(parents=True, exist_ok=True)
            shot = await cdp.send("Page.captureScreenshot", {"format": "png"})
            (batch_dir / "_failed_screenshot.png").write_bytes(base64.b64decode(shot["data"]))
        except Exception:
            pass

    batch_dir.mkdir(parents=True, exist_ok=True)

    if sdk_req:
        body = await cdp.get_response_body(sdk_req[0])
        if body:
            SDK_DIR.mkdir(parents=True, exist_ok=True)
            # Filename derived from URL last segment
            url = sdk_req[1].get("url", "")
            name = url.split("/")[-1].split("?")[0] or "main.min.js"
            (SDK_DIR / name).write_text(body, encoding="utf-8")
            print(f"[batch {batch_id}] saved SDK → {name} ({len(body)} chars)")

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

    if posts:
        p1 = posts[0].get("postData") or ""
        def gp(n):
            m = re.search(rf"(?:^|&){re.escape(n)}=([^&]*)", p1)
            return urllib.parse.unquote_plus(m.group(1)) if m else None
        meta = {
            "batch_id": batch_id,
            "site": "grubhub.com",
            "uuid": gp("uuid"),
            "tag": gp("tag"),
            "ft": gp("ft"),
            "app_id": gp("appId"),
            "captured_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "collector_post_count": len(posts),
            "status_post_1": posts[0].get("status"),
            "status_post_2": posts[1].get("status") if len(posts) > 1 else None,
        }
        (batch_dir / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
        return meta
    return {"batch_id": batch_id, "error": "no collector POST captured"}


async def main():
    launch_chrome()
    tab = get_target_tab()
    print(f"[*] tab: {tab.get('url')}")

    async with CDPClient(tab["webSocketDebuggerUrl"]) as cdp:
        N = int(sys.argv[1]) if len(sys.argv) > 1 else 6
        summary = []
        for i in range(1, N + 1):
            bd = SAMPLES / str(i)
            shutil.rmtree(bd, ignore_errors=True)
            meta = await capture_once(cdp, i, bd)
            summary.append(meta)
            if i < N:
                await asyncio.sleep(15)

        # SDK hash
        for sdk_file in SDK_DIR.glob("*.js"):
            h = hashlib.sha256(sdk_file.read_bytes()).hexdigest()
            (SDK_DIR / f"{sdk_file.name}.info.json").write_text(json.dumps({
                "sha256": h,
                "size": sdk_file.stat().st_size,
            }, indent=2), encoding="utf-8")
            print(f"[*] {sdk_file.name} sha256: {h}")
            for s in summary:
                if isinstance(s, dict) and "batch_id" in s and "error" not in s:
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
