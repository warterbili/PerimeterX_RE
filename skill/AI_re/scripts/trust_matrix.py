"""
4-way trust-localisation matrix (site-agnostic) — the strict+ diagnostic.

When your _pxN is byte-correct (field diff passes) but the PX-gated endpoint still
challenges, this tells you WHERE the wall is: the cookie's trust, or transport/IP.

It tests two cookies x two transports against the gated endpoint:

                    real browser (CDP)        curl_cffi (headless)
  REAL cookie       [1]                       [3]
  OUR cookie        [2]                       [4]

Read-out:
  [1] PASS, [3] PASS                 -> IP + curl transport are fine; a good cookie passes headless
  [2] BLOCK while [1] PASS           -> OUR cookie content is the gap (PX scores it bot) -> keep diffing
  [2] PASS but [4] BLOCK             -> OUR cookie is borderline-trust (real browser's live signals
                                        compensate; curl doesn't) -> improve mint authenticity
  [1]/[3] start BLOCKing too         -> the IP / proxy pool is reputation-degraded from your testing
                                        -> switch exit IP; do NOT mistake it for an algorithm regression

Usage (from anywhere):
  HOME=https://site/ GATED=https://site/gated COOKIE=_px3 VID=_pxvid \
  OUR_COOKIE="<our _px3>" OUR_VID="<our _pxvid>" python trust_matrix.py
  # REAL cookie is minted by the dedicated browser itself (visit HOME). OUR_COOKIE optional.
"""
import asyncio, os, sys, time, urllib.request
from pathlib import Path

# locate the cdp-browser skill helper (sibling skill)
for base in [Path(os.environ.get("USERPROFILE", "")) / ".claude" / "skills" / "cdp-browser" / "scripts",
             Path(os.environ.get("HOME", "")) / ".claude" / "skills" / "cdp-browser" / "scripts"]:
    if (base / "cdp.py").exists():
        sys.path.insert(0, str(base)); break
import cdp
from cdp import CDPClient

HOME = os.environ.get("HOME_URL") or os.environ.get("HOME") or sys.exit("set HOME_URL")
GATED = os.environ.get("GATED") or sys.exit("set GATED")
COOKIE = os.environ.get("COOKIE", "_px3")
VID = os.environ.get("VID", "_pxvid")
DOMAIN = os.environ.get("COOKIE_DOMAIN") or "." + GATED.split("/")[2].split(":")[0].replace("www.", "")
PORT = int(os.environ.get("CDP_PORT", "9337"))
UA = os.environ.get("PX_UA",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36")
BLOCK_MARK = os.environ.get("BLOCK_MARK", "/captcha/")
cdp.CDP_PORT = PORT; cdp.CDP_BASE = f"http://localhost:{PORT}"
PROFILE = Path(os.environ.get("CDP_PROFILE", "_trust_matrix_profile"))


def up():
    try:
        urllib.request.urlopen(f"{cdp.CDP_BASE}/json/version", timeout=1); return True
    except Exception:
        return False


def launch():
    if up(): return
    PROFILE.mkdir(parents=True, exist_ok=True)
    import subprocess
    subprocess.Popen([cdp.CHROME_BIN, f"--remote-debugging-port={PORT}", f"--user-data-dir={PROFILE.resolve()}",
                      "--no-first-run", "--no-default-browser-check", "--disable-blink-features=AutomationControlled", HOME],
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(40):
        if up(): break
        time.sleep(0.5)


def curl_edge(cookie):
    from curl_cffi import requests
    import urllib3; urllib3.disable_warnings()
    s = requests.Session(impersonate=os.environ.get("PX_IMPERSONATE", "chrome142"))
    s.get(HOME, headers={"User-Agent": UA}, timeout=40, verify=False, allow_redirects=True)
    r = s.get(GATED, headers={"User-Agent": UA, "Referer": HOME, "Cookie": cookie},
              timeout=30, verify=False, allow_redirects=False)
    return "BLOCK" if BLOCK_MARK in r.headers.get("location", "") else f"PASS-{r.status_code}"


async def browser_edge(c, ck):
    for name, val in ck.items():
        if val:
            await c.set_cookie(name, val, DOMAIN)
    await c.navigate(GATED, wait_ms=6000)
    href = await c.eval("location.href") or ""
    return "BLOCK" if (BLOCK_MARK in href or "challenge" in href.lower()) else "PASS"


async def main():
    launch()
    tabs = [t for t in cdp.get_tabs() if t.get("type") == "page" and t.get("webSocketDebuggerUrl")]
    if not tabs:
        print("no page tab on dedicated Chrome"); return
    async with CDPClient(tabs[0]["webSocketDebuggerUrl"]) as c:
        await c.send("Network.enable"); await c.send("Page.enable")
        await c.navigate(HOME, wait_ms=9000)                 # browser mints a REAL cookie
        ck = {x["name"]: x["value"] for x in await c.get_cookies(HOME)}
        real, real_vid = ck.get(COOKIE), ck.get(VID)
        print(f"[real cookie] {COOKIE}={'len ' + str(len(real)) if real else 'NONE'}  {VID}={real_vid}")

        m = {}
        if real:
            m["[1] real-browser + REAL "] = (await browser_edge(c, {COOKIE: real, VID: real_vid}))[0:5]
            m["[3] curl_cffi   + REAL "] = curl_edge(f"{COOKIE}={real}; {VID}={real_vid}")
        our, our_vid = os.environ.get("OUR_COOKIE"), os.environ.get("OUR_VID", real_vid)
        if our:
            m["[2] real-browser + OUR  "] = (await browser_edge(c, {COOKIE: our, VID: our_vid}))[0:5]
            m["[4] curl_cffi   + OUR  "] = curl_edge(f"{COOKIE}={our}; {VID}={our_vid}")
        print("\n  ── 4-way trust matrix ──")
        for k, v in m.items():
            print(f"   {k}: {v}")
        print("\n  read-out: [1]&[3] PASS = IP/curl fine. [2] BLOCK while [1] PASS = cookie content."
              "\n            [2] PASS & [4] BLOCK = borderline trust. [1]/[3] BLOCK = IP/pool degraded.")


if __name__ == "__main__":
    asyncio.run(main())
