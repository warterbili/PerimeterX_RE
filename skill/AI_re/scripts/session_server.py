"""
Persistent Chrome-TLS session sidecar (site-agnostic).

A strict+ PX deployment binds cookie trust to the MINT transport: the whole mint
(/ns + every collector POST + the edge test) must ride ONE real-Chrome TLS session
with shared akamai cookies — node TLS or a fresh-per-request client gets low trust.
This sidecar holds that single curl_cffi session so your generator (and the edge
test) just forward through it. Reliable (no per-request TLS churn), and a single
swap point for a clean residential proxy.

Run:  python session_server.py           # default chrome142 on 127.0.0.1:8765
Env:  PX_IMPERSONATE=chrome142            # closest curl_cffi target to current Chrome
      PX_PROXY=http://user:pass@host:port # optional residential exit IP
      PX_UA="Mozilla/5.0 ... Chrome/149..." # UA for warmup (match your generator)

JSON POST body (one op per request):
  {op:"fwd", method, url, body, headers}  -> forward via the session, returns {status, body, location}
  {op:"warmup", url}                       -> GET url to seed akamai cookies + the TLS handshake
  {op:"reset", proxy?}                     -> brand-new session (cold visit); optional per-iter fresh IP
  {op:"cookies"}                           -> list current session cookie names

Generator side (Node, USE_SESSION mode) — forward /ns + each collector POST here:
  http.request({host:'127.0.0.1',port:8765,method:'POST'}, ...) with the JSON body above.
"""
import json, os
from http.server import HTTPServer, BaseHTTPRequestHandler
from curl_cffi import requests
import urllib3; urllib3.disable_warnings()

UA = os.environ.get("PX_UA",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36")
IMP = os.environ.get("PX_IMPERSONATE", "chrome142")
PROXY = os.environ.get("PX_PROXY")
PORT = int(os.environ.get("PX_SIDECAR_PORT", "8765"))


def _new(proxy=None):
    s = requests.Session(impersonate=IMP)
    p = proxy or PROXY
    if p:
        s.proxies = {"http": p, "https": p}
    return s


STATE = {"s": _new()}


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        req = json.loads(self.rfile.read(n) or b"{}")
        op = req.get("op", "fwd")
        s = STATE["s"]
        try:
            if op == "reset":
                STATE["s"] = _new(req.get("proxy"))
                out = {"ok": True}
            elif op == "cookies":
                out = {"cookies": [c.name for c in s.cookies.jar]}
            elif op == "warmup":
                r = s.get(req["url"], headers={"User-Agent": UA, "Accept": "text/html,*/*"},
                          timeout=40, verify=False, allow_redirects=True)
                out = {"status": r.status_code, "len": len(r.text or "")}
            else:  # fwd
                h = req.get("headers", {})
                if req.get("method", "POST").upper() == "POST":
                    r = s.post(req["url"], data=req.get("body", ""), headers=h,
                               timeout=60, verify=False, allow_redirects=False)
                else:
                    r = s.get(req["url"], headers=h, timeout=60, verify=False, allow_redirects=False)
                out = {"status": r.status_code, "body": r.text, "location": r.headers.get("location", "")}
        except Exception as e:
            out = {"status": 0, "body": "", "error": str(e)[:200]}
        b = json.dumps(out).encode()
        self.send_response(200)
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)


if __name__ == "__main__":
    print(f"[*] PX session sidecar on 127.0.0.1:{PORT}  impersonate={IMP}  proxy={'yes' if PROXY else 'no'}")
    HTTPServer(("127.0.0.1", PORT), H).serve_forever()
