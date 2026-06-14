"""
Persistent curl_cffi session sidecar (like node_bridge's curl_requests.Session).
Holds ONE Chrome-impersonated session so the collector POSTs + edge test reuse the
same connection + akamai cookies + exit IP — reliable, no per-request TLS churn.

Listens on 127.0.0.1:8765. JSON POST body:
  {op:"fwd", method, url, body, headers}  -> forward via session, return {status, body, set}
  {op:"warmup", url}                       -> GET url to seed akamai cookies
  {op:"reset"}                             -> new clean session (cold visit between iters)
  {op:"cookies"}                           -> list session cookie names
"""
import json, os
from http.server import HTTPServer, BaseHTTPRequestHandler
from curl_cffi import requests
import urllib3; urllib3.disable_warnings()

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
IMP = os.environ.get("PX_IMPERSONATE", "chrome142")   # closest curl_cffi target to real Chrome 149
PROXY = os.environ.get("PX_PROXY")                     # optional residential exit for a clean-IP mint


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
                STATE["s"] = _new(req.get("proxy"))   # per-iteration fresh exit IP
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
    import sys as _sys
    _srv = HTTPServer(("127.0.0.1", 0), H)
    _sys.stdout.write("PXSIDECAR_PORT:%d\n" % _srv.server_address[1]); _sys.stdout.flush()
    _srv.serve_forever()
