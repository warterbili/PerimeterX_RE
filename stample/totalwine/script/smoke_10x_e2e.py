"""
End-to-end 10/10 stability test.

For each iteration:
  1. Fresh BrightData session (new sticky residential US IP)
  2. Generate _px2 via Node generator (through that proxy)
  3. curl_cffi GET SRP-HTML with the cookie (same proxy)
  4. Verdict: 200 (real HTML > 1MB) = PASS / PX-BLOCK = FAIL

Interval ≥ 15s per iteration to avoid PX IP throttle (Gotcha #13).

Pass standard: 10/10. Anything less = investigate the failing iteration.
"""

import json, os, secrets, subprocess, sys, time
from pathlib import Path
from curl_cffi import requests
import urllib3
urllib3.disable_warnings()

# Resolve project root from this script's location: stample/totalwine/script/ → repo root
HERE = Path(__file__).resolve().parent
SITE_ROOT = HERE.parent                                  # stample/totalwine
PROJECT_ROOT = SITE_ROOT.parent.parent                   # repo root
OUT = SITE_ROOT / "sample/_smoke_10x"
OUT.mkdir(parents=True, exist_ok=True)

# Proxy from env (DO NOT hard-code credentials).
# Set sticky-session residential proxy in HTTPS_PROXY:
#   $env:HTTPS_PROXY = 'http://<user>-session-<id>:<pwd>@zproxy.lum-superproxy.io:22225'
PROXY_TEMPLATE = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
if not PROXY_TEMPLATE:
    sys.stderr.write("❌ Set HTTPS_PROXY env var with sticky-session residential proxy URL\n")
    sys.exit(1)
TARGET_URL = os.environ.get("TARGET_URL", "https://www.totalwine.com/search/all?text=wine")
INTERVAL_S = int(os.environ.get("INTERVAL_S", "15"))


def build_proxy(session_id):
    """Inject a sticky-session segment so each iteration pins a different residential IP.
    Works for BrightData; other providers (Oxylabs, Smartproxy) use similar syntax."""
    if f"-session-" in PROXY_TEMPLATE:
        # Caller already pinned a session; rotate by replacing the existing id
        import re
        return re.sub(r"-session-[a-zA-Z0-9]+", f"-session-{session_id}", PROXY_TEMPLATE)
    proto, rest = PROXY_TEMPLATE.split("://", 1)
    creds, host = rest.split("@", 1)
    user, pwd = creds.split(":", 1)
    return f"{proto}://{user}-session-{session_id}:{pwd}@{host}"


def gen_px2(proxy_url):
    env = os.environ.copy()
    env["HTTPS_PROXY"] = proxy_url
    env["https_proxy"] = proxy_url
    js = """
    const url = process.env.HTTPS_PROXY;
    if (url) {
        const https = require('https');
        const { HttpsProxyAgent } = require('https-proxy-agent');
        const agent = new HttpsProxyAgent(url);
        const orig = https.request;
        https.request = function(options, ...args) {
            if (typeof options === 'string') options = new URL(options);
            if (options && !options.agent) options.agent = agent;
            return orig.call(this, options, ...args);
        };
    }
    require('./stample/totalwine/px_cookie/totalwine_px2')()
        .then(r => console.log(JSON.stringify(r)))
        .catch(e => { console.error(e); process.exit(1); });
    """
    r = subprocess.run(["node", "-e", js], env=env, capture_output=True, text=True,
                       cwd=str(PROJECT_ROOT), timeout=120)
    if r.returncode:
        return None, r.stderr[:300]
    try:
        return json.loads(r.stdout.strip()), None
    except Exception as e:
        return None, f"json parse err: {e}; stdout={r.stdout[:200]}"


def fetch_srp(cookie_str, proxy_url):
    headers = {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.totalwine.com/",
        "Cookie": cookie_str,
    }
    proxies = {"http": proxy_url, "https": proxy_url}
    try:
        r = requests.get(TARGET_URL, headers=headers, impersonate="chrome124",
                         proxies=proxies, timeout=30, allow_redirects=False, verify=False)
        body = r.text or ""
        block_json = "PXFF0j69T5" in body[:600] and "jsClientSrc" in body[:600]
        captcha = "px-captcha" in body[:2000].lower()
        return {
            "status": r.status_code,
            "len": len(body),
            "verdict": ("PX-BLOCK-427" if block_json else
                        "PX-CAPTCHA-5745" if captcha else
                        f"PASS-{r.status_code}" if r.status_code == 200 else
                        f"OTHER-{r.status_code}"),
            "is_real_html": "site-header" in body or "twm-grid" in body or len(body) > 100_000,
        }
    except Exception as e:
        return {"status": None, "len": 0, "verdict": f"ERR: {str(e)[:80]}", "is_real_html": False}


def main():
    n_iter = 10
    print(f"━━━ 10/10 stability test ━━━")
    print(f"target = {TARGET_URL}")
    print(f"interval = {INTERVAL_S}s per iteration\n")

    results = []
    pass_count = 0
    fail_count = 0

    for i in range(1, n_iter + 1):
        sess = secrets.token_hex(4)
        proxy = build_proxy(sess)
        t0 = time.time()
        print(f"── iter {i}/{n_iter}  session={sess} ──")

        try:
            ip = requests.get("https://api.ipify.org?format=json",
                              proxies={"http": proxy, "https": proxy},
                              impersonate="chrome124", verify=False, timeout=15).json()["ip"]
        except Exception as e:
            print(f"  ❌ proxy fail: {e}")
            results.append({"iter": i, "verdict": "PROXY-FAIL", "elapsed_s": time.time() - t0})
            fail_count += 1
            time.sleep(INTERVAL_S)
            continue

        gen_info, err = gen_px2(proxy)
        if err or not gen_info:
            print(f"  ❌ generator fail: {err}")
            results.append({"iter": i, "verdict": "GEN-FAIL", "exit_ip": ip,
                            "error": err, "elapsed_s": time.time() - t0})
            fail_count += 1
            time.sleep(INTERVAL_S)
            continue

        cookie = gen_info["cookie_value"]
        vid = gen_info["state"].get("vid", "")
        cookie_str = f"_px2={cookie}; _pxvid={vid}" if vid else f"_px2={cookie}"

        r = fetch_srp(cookie_str, proxy)
        verdict = r["verdict"]
        is_pass = verdict.startswith("PASS") and r["is_real_html"]
        if is_pass:
            pass_count += 1
            flag = "✅"
        else:
            fail_count += 1
            flag = "🚫"

        print(f"  exit IP={ip}")
        print(f"  _px2={cookie[:40]}…")
        print(f"  {flag} {verdict}  body={r['len']:,}B  real_html={r['is_real_html']}")
        print(f"  elapsed: {time.time() - t0:.1f}s")

        results.append({
            "iter": i, "session": sess, "exit_ip": ip,
            "px2_prefix": cookie[:60],
            "uuid": gen_info["uuid"],
            "verdict": verdict, "body_len": r["len"], "is_real_html": r["is_real_html"],
            "elapsed_s": round(time.time() - t0, 1),
        })

        if i < n_iter:
            print(f"  sleep {INTERVAL_S}s …\n")
            time.sleep(INTERVAL_S)

    # Save + report
    summary = {
        "target": TARGET_URL,
        "iterations": n_iter,
        "interval_s": INTERVAL_S,
        "pass_count": pass_count,
        "fail_count": fail_count,
        "verdict": "10/10 PASS" if pass_count == n_iter else f"{pass_count}/{n_iter}",
        "results": results,
    }
    (OUT / "smoke_10x_result.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print(f"\n{'═'*40}")
    print(f"  {pass_count}/{n_iter} passed, {fail_count} failed")
    print(f"  verdict: {summary['verdict']}")
    print(f"{'═'*40}")
    print(f"→ {OUT/'smoke_10x_result.json'}")


if __name__ == "__main__":
    main()
