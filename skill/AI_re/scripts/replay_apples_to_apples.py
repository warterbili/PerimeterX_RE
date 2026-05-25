"""
Apples-to-apples replay: SAME proxy session, SAME TLS, SAME headers — only
the cookie differs. Eliminates per-IP confounding when comparing your
generated cookie vs a control (browser's own cookie).

Use case: Layer 3.5 from playbooks/validate-generator.md — distinguish
"our cookie is bot-flagged" from "this proxy IP is hot".

Order of tests within ONE proxy session (sticky IP):
  1. Generate your generator's _px2 through this proxy
  2. Read browser's _px2 from CDP (issued earlier by real Chrome)
  3. Hit a PX-gated URL with each cookie in turn:
     a. browser's (control)
     b. ours (test)
     c. no cookie (baseline)
  4. Compare verdicts:
     - browser=200 AND ours=200 → ✅ generator OK
     - browser=200 AND ours=PX-BLOCK → cookie content flagged (Gotcha #15)
     - browser=PX-BLOCK → proxy IP is hot, re-run with new session

Requires HTTPS_PROXY env var with sticky-session residential proxy:
  export HTTPS_PROXY='http://<user>-session-<random>:<pwd>@<host>:<port>'

Adapt these for your site:
  - ROOT_NODE: where your Node generator lives
  - TARGET_URL: a PX-gated URL on your site (one that returns 403 with no cookie)
  - GENERATOR_REL_PATH: relative path from ROOT_NODE to your generator module
"""

import json, secrets, subprocess, os, sys
from pathlib import Path
from curl_cffi import requests
import urllib3
urllib3.disable_warnings()

# ──────── Adapt these for your site ────────
ROOT_NODE = Path(os.environ.get("ROOT_NODE", "."))
TARGET_URL = os.environ.get("TARGET_URL", "https://www.totalwine.com/search/all?text=wine")
GENERATOR_REL_PATH = os.environ.get("GENERATOR_REL_PATH", "./tmp/totalwine/px_cookie/totalwine_px2")

# Proxy from env (DO NOT hard-code credentials in skill scripts):
PROXY_URL = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
if not PROXY_URL:
    sys.stderr.write("❌ Set HTTPS_PROXY env var with sticky-session residential proxy URL\n")
    sys.exit(1)


def build_proxy(session_id):
    """Pin the proxy to a single residential IP by injecting -session-<id> into the username.
    Works for BrightData; other providers (Oxylabs, Smartproxy) have similar `session-` or `sticky-` syntax."""
    if "-session-" in PROXY_URL:
        return PROXY_URL  # caller already pinned
    # Insert session_id before the password separator (`:`) in the user portion
    # Example: http://user:pwd@host:port → http://user-session-<id>:pwd@host:port
    proto, rest = PROXY_URL.split("://", 1)
    creds, host = rest.split("@", 1)
    user, pwd = creds.split(":", 1)
    return f"{proto}://{user}-session-{session_id}:{pwd}@{host}"


def gen_px2(proxy_url):
    env = os.environ.copy()
    env["HTTPS_PROXY"] = proxy_url
    env["https_proxy"] = proxy_url
    js = f"""
    const url = process.env.HTTPS_PROXY;
    if (url) {{
        const https = require('https');
        const {{ HttpsProxyAgent }} = require('https-proxy-agent');
        const agent = new HttpsProxyAgent(url);
        const orig = https.request;
        https.request = function(options, ...args) {{
            if (typeof options === 'string') options = new URL(options);
            if (options && !options.agent) options.agent = agent;
            return orig.call(this, options, ...args);
        }};
    }}
    require('{GENERATOR_REL_PATH}')()
        .then(r => console.log(JSON.stringify(r)))
        .catch(e => {{ console.error(e); process.exit(1); }});
    """
    r = subprocess.run(["node", "-e", js], env=env, capture_output=True, text=True,
                       cwd=str(ROOT_NODE), timeout=120)
    if r.returncode: raise RuntimeError(r.stderr)
    return json.loads(r.stdout.strip())


def get_browser_px2(site_domain):
    """Read browser-issued _px2 from CDP. site_domain is matched substring."""
    r = subprocess.run(["python", str(Path.home() / ".claude/skills/cdp-browser/scripts/cdp.py"), "cookies"],
                       capture_output=True, text=True, timeout=15)
    cookies = json.loads(r.stdout)
    return next((c for c in cookies if c["name"] == "_px2" and site_domain in c["domain"]), None)


def fetch(url, cookie_str, proxy_url):
    headers = {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    if cookie_str: headers["Cookie"] = cookie_str
    proxies = {"http": proxy_url, "https": proxy_url}
    r = requests.get(url, headers=headers, impersonate="chrome124",
                     proxies=proxies, timeout=25, allow_redirects=False, verify=False)
    body = r.text or ""
    block_json = "PXFF0j69T5" in body[:600] and "jsClientSrc" in body[:600]
    captcha = "px-captcha" in body[:2000].lower()
    return r.status_code, len(body), ("PX-BLOCK-427" if block_json else
                                       "PX-CAPTCHA-5745" if captcha else
                                       "200" if r.status_code == 200 else
                                       f"OTHER-{r.status_code}")


def main():
    session_id = secrets.token_hex(4)
    proxy = build_proxy(session_id)
    print(f"[*] proxy session = {session_id}")

    # Confirm exit IP
    ip = requests.get("https://api.ipify.org?format=json", proxies={"http": proxy, "https": proxy},
                      impersonate="chrome124", verify=False, timeout=15).json()["ip"]
    print(f"[*] exit IP = {ip}\n")

    # 1. Get browser's cookie (issued by PX to real Chrome from home IP)
    # Pass your site's domain substring (e.g. "totalwine", "ifood", "grubhub")
    site_domain = os.environ.get("SITE_DOMAIN", "totalwine")
    browser_px2 = get_browser_px2(site_domain)
    if not browser_px2:
        print(f"❌ no browser _px2 for domain={site_domain!r} — navigate the browser first")
        sys.exit(1)
    print(f"[*] browser _px2: {browser_px2['value'][:50]}…\n")

    # 2. Generate ours through this proxy session
    print("[*] generating ours via SAME proxy session…")
    ours = gen_px2(proxy)
    cookie_name = ours.get('cookie_name', '_px2')
    print(f"    our {cookie_name}: {ours['cookie_value'][:50]}…")
    print(f"    state.pxsid={ours['state'].get('pxsid')}, vid={ours['state'].get('vid')}\n")

    # 3. Hit the gated URL with three jars — same proxy IP, same TLS
    url = TARGET_URL
    jars = {
        "A. browser cookie": f"{cookie_name}={browser_px2['value']}",
        "B. our cookie": f"{cookie_name}={ours['cookie_value']}",
        "C. our + pxvid": f"{cookie_name}={ours['cookie_value']}; _pxvid={ours['state'].get('vid', '')}",
        "D. no cookie": "",
    }
    print(f"=== {url} via proxy IP {ip} ===")
    for label, jar in jars.items():
        status, length, verdict = fetch(url, jar, proxy)
        flag = "✅" if verdict == "200" else "🚫"
        print(f"  {flag} {label:<20} → {verdict:<18}  {length:>7}B")

    # Diagnostic dump
    print(f"\n→ if A=200 and B=PX-BLOCK-427: PX-edge accepts browser cookie but flags ours")
    print(f"   (confirms PX backend records OUR session as bot via collector chain)")
    print(f"   if A=200 and B=200: ✅ fix works")
    print(f"   if A=PX-CAPTCHA-5745 (or worse): proxy IP is hot, re-run")


if __name__ == "__main__":
    main()
