"""
academy.com _px3 end-to-end validation (PX STRICT tier).

Mints a pure-math _px3 and proves it on the PX-gated endpoint /c/sports-outdoors.
The whole flow (homepage warmup -> /ns -> 3 collector POSTs -> edge test) rides ONE
persistent curl_cffi chrome142 session via the local sidecar, so every request carries
a genuine Chrome TLS fingerprint + shared akamai cookies (academy STRICT tier scores
the cookie's trust at mint time; node TLS / JSDOM mints get challenged on the gate).

Usage (from anywhere):
    python e2e.py [N]            # N iters, each on a FRESH US residential IP (clean measurement)
    python e2e.py [N] --local    # N iters on the LOCAL IP (no proxy)

Clean residential IPs validate 10/10. The LOCAL IP only passes if its collector-mint
reputation is fresh — heavy repeated minting from one IP sinks its trust (see
skill memory px-strict-tier-gotchas). Set SCRAPEOPS_KEY for the proxy mode.
"""
import json, os, re, subprocess, sys, time, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
GEN = str(HERE / "academy_px3.js")
SERVER = str(HERE / "session_server.py")
HOME = "https://www.academy.com/"
GATED = "https://www.academy.com/c/backpack"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
API_KEY = os.environ.get("SCRAPEOPS_KEY", "")  # bring your own residential proxy key
LOCAL = "--local" in sys.argv
args = [a for a in sys.argv[1:] if not a.startswith("--")]
N = int(args[0]) if args else 5
DELAY = int(args[1]) if len(args) > 1 else 8


def proxy_url(s):
    return f"http://scrapeops.country=US.session={s}:{API_KEY}@residential-proxy.scrapeops.io:8181"


PORT = 0


def sc(op, **kw):
    b = json.dumps({"op": op, **kw}).encode()
    return json.loads(urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:%d" % PORT, data=b, method="POST"), timeout=120).read())


def mint():
    p = subprocess.run(["node", GEN], capture_output=True, text=True, timeout=180,
                       env={**os.environ, "JSON_OUT": "1", "USE_SESSION": "1", "PX_SIDECAR_PORT": str(PORT)})
    m = re.search(r"PXJSON:(\{.*\})", p.stdout + p.stderr)
    if not m:
        return None, ((p.stdout + p.stderr).strip().splitlines() or ["no out"])[-1][:140]
    r = json.loads(m.group(1))
    return r, f"ev={r.get('ev1_fields')}/{r.get('ev2_fields')}/{r.get('ev3_fields')} c3={r.get('collector3_status')}"


def edge(px3, vid):
    h = {"User-Agent": UA, "Accept": "text/html,*/*;q=0.8", "Referer": HOME,
         "Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Dest": "document",
         "Cookie": f"_px3={px3}; _pxvid={vid}"}
    o = sc("fwd", method="GET", url=GATED, headers=h, follow=True)
    body = o.get("body") or ""
    if "/captcha/" in (o.get("final_url") or "") or "/captcha/" in (o.get("location") or ""):
        return "BLOCK"
    return f"PASS-200({len(body)}B)" if o.get("status") == 200 and len(body) > 50000 else f"BLOCK-{o.get('status')}"


srv = subprocess.Popen([sys.executable, SERVER], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True,
                       env={**os.environ, "PX_IMPERSONATE": "chrome142"})
PORT = int(srv.stdout.readline().strip().split(":")[1])
print(f"[*] sidecar up on :{PORT} | mode={'LOCAL IP' if LOCAL else 'fresh US residential IP/iter'}")

passes = 0
try:
    for i in range(1, N + 1):
        sess = f"acad{i}{int.from_bytes(os.urandom(2), 'big')}"
        try:
            sc("reset", proxy=None if LOCAL else proxy_url(sess))
            w = sc("warmup", url=HOME)
        except Exception as e:
            print(f"[{i}/{N}] WARMUP-FAIL {str(e)[:70]}"); continue
        if w.get("status") != 200:
            print(f"[{i}/{N}] warmup status={w.get('status')} {str(w.get('error',''))[:50]}"); continue
        time.sleep(1)
        r, info = mint()
        if not r or not r.get("cookie_value"):
            print(f"[{i}/{N}] MINT-FAIL {info}")
        else:
            vid = (r.get("state") or {}).get("vid") or r.get("uuid")
            verdict = edge(r["cookie_value"], vid)
            ok = verdict.startswith("PASS"); passes += ok
            tail = "" if LOCAL else f"ip={sess}"
            print(f"[{i}/{N}] {verdict:9} _px3 len={len(r['cookie_value'])} {info} {tail}")
        if i < N:
            time.sleep(DELAY)
finally:
    srv.terminate()
tag = "LOCAL IP" if LOCAL else "fresh US residential IP each"
print(f"\n==== {passes}/{N} PASS ({tag}) ====")
