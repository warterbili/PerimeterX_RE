"""
Byte-level diff: our collector#2 POST vs browser's collector#2 POST.

Compares:
  - HTTP request headers (set, order, value)
  - Form params (key set, key order, value patterns)
  - Body length deltas
"""
import os, sys, json, urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
_decoder_dir = os.environ.get("PX_PY_DECODER_DIR")
if not _decoder_dir:
    raise RuntimeError(
        "Set PX_PY_DECODER_DIR to the directory containing px_pure_cookie.py."
    )
sys.path.insert(0, _decoder_dir)
sys.path.insert(0, str(ROOT / "deliverables"))
from px_pure_cookie_v2 import _generate_cookie, DEFAULT_UA  # type: ignore

# Load a browser-captured request (#2)
b_txt = (ROOT / "samples" / "1" / "2.txt").read_text(encoding="utf-8")
b_lines = b_txt.split("\n")

# parse browser headers
hdr_start = b_lines.index("# request headers")
hdr_end = b_lines.index("", hdr_start)
browser_headers = {}
for l in b_lines[hdr_start+1:hdr_end]:
    if ":" in l:
        k, v = l.split(":", 1)
        browser_headers[k.strip().lower()] = v.strip()

# parse browser body
body_start = b_lines.index("# request body")
browser_body = "\n".join(b_lines[body_start+1:]).strip()
browser_params = {}
for p in browser_body.split("&"):
    if "=" in p:
        k, v = p.split("=", 1)
        browser_params[k] = urllib.parse.unquote(v)

# Now generate one round from our v2 and capture what WE send
import urllib.request, urllib.error
captured = {}
orig_request_class = urllib.request.Request

class Spy(urllib.request.Request):
    def __init__(self, url, data=None, headers={}, **kw):
        captured['url'] = url
        captured['data'] = data
        captured['headers'] = dict(headers)
        super().__init__(url, data=data, headers=headers, **kw)

urllib.request.Request = Spy
try:
    _generate_cookie()
except Exception as e:
    print("gen err:", e)

# captured may have only the last request (collector#2)
our_headers = {k.lower(): v for k, v in captured.get('headers', {}).items()}
our_body = (captured.get('data') or b'').decode('utf-8', errors='replace')
our_params = {}
for p in our_body.split("&"):
    if "=" in p:
        k, v = p.split("=", 1)
        our_params[k] = urllib.parse.unquote(v)

# ── DIFF ──
print("=" * 78)
print("HTTP HEADERS DIFF")
print("=" * 78)
all_h = sorted(set(browser_headers) | set(our_headers))
for k in all_h:
    b, o = browser_headers.get(k), our_headers.get(k)
    if b == o:
        continue
    flag = "  ✓" if b and o else ("❌🌐" if b and not o else "❌🤖")
    print(f"  {flag} {k:<30}  browser={(b or 'MISSING')[:50]!r}")
    print(f"      {' '*32}  ours   ={(o or 'MISSING')[:50]!r}")

print()
print("=" * 78)
print("FORM PARAMS DIFF")
print("=" * 78)
all_p = sorted(set(browser_params) | set(our_params))
for k in all_p:
    b, o = browser_params.get(k), our_params.get(k)
    if k == 'payload':  # payload always differs (encrypted, dynamic)
        print(f"  payload      browser_len={len(b or '')} ours_len={len(o or '')}")
        continue
    if b == o:
        print(f"  ✓ {k:<10} = {(b or '')[:60]}")
    else:
        flag = "  ✓" if b and o else ("❌🌐" if b and not o else "❌🤖")
        print(f"  {flag} {k:<10}")
        print(f"      browser = {(b or 'MISSING')[:80]!r}")
        print(f"      ours    = {(o or 'MISSING')[:80]!r}")

print()
print("=" * 78)
print("PARAM ORDER")
print("=" * 78)
print(f"  browser: {[p.split('=')[0] for p in browser_body.split('&')]}")
print(f"  ours:    {[p.split('=')[0] for p in our_body.split('&')]}")
