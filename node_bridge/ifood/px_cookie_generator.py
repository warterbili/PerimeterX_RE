#!/usr/bin/env python3
"""
PX Cookie Generator - Pure Python cold start using Node.js bridge + curl_cffi
 
Flow:
1. Start Node.js bridge (generates PX payloads via JSDOM env)
2. Node outputs collector requests as JSON lines to stdout
3. Python sends them via curl_cffi (chrome131 TLS) to PX collector
4. Python pipes responses back to Node via stdin
5. Node feeds responses to PX SDK, which generates _px3 cookie
6. Python extracts _px3 and uses it for API requests

Key insight: TLS fingerprint binding - curl_cffi chrome131 talks to both
PX collector AND ifood API, so TLS matches.
"""

import json
import subprocess
import sys
import os
import time
import threading
import queue
from typing import Optional, Dict

from curl_cffi import requests as curl_requests


IFOOD_BASE = "https://www.ifood.com.br"
COLLECTOR_BASE = "https://collector-pxo1gdta7q.px-cloud.net"
APP_ID = "PXO1GDTa7Q"
NODE_BRIDGE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "px_node_bridge.js")


class PXCookieGenerator:
    def __init__(self, verbose=True, proxy=None):
        self.verbose = verbose
        self.proxy = proxy  # e.g. "http://user:pass@host:port"
        self.session = curl_requests.Session(impersonate="chrome131")
        if proxy:
            self.session.proxies = {"http": proxy, "https": proxy}
            self.session.verify = False
        self._px3 = None
        self._pxvid = None
        self._pxcts = None
        
    def log(self, msg):
        if self.verbose:
            print(f"[PX] {msg}", file=sys.stderr)
    
    def generate(self) -> Optional[str]:
        """Generate a fresh _px3 cookie. Returns the cookie value or None."""
        self.log("Starting PX cookie generation via Node bridge...")
        
        # First, visit ifood homepage to establish session
        self.log("Visiting ifood homepage...")
        try:
            resp = self.session.get(
                IFOOD_BASE,
                headers={
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                    "accept-language": "zh-CN,zh;q=0.9",
                    "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"',
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": '"macOS"',
                    "sec-fetch-dest": "document",
                    "sec-fetch-mode": "navigate",
                    "sec-fetch-site": "none",
                    "sec-fetch-user": "?1",
                    "upgrade-insecure-requests": "1",
                },
                timeout=30,
            )
            self.log(f"Homepage: {resp.status_code}, cookies: {list(resp.cookies.keys())}")
        except Exception as e:
            self.log(f"Homepage visit failed: {e}")
        
        # Start Node bridge
        proc = subprocess.Popen(
            ["node", NODE_BRIDGE_PATH],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=os.path.dirname(NODE_BRIDGE_PATH),
        )
        
        # Read stderr in background
        stderr_lines = []
        def read_stderr():
            for line in proc.stderr:
                decoded = line.decode('utf-8', errors='replace').rstrip()
                stderr_lines.append(decoded)
                if self.verbose:
                    print(f"  [NODE] {decoded}", file=sys.stderr)
        
        stderr_thread = threading.Thread(target=read_stderr, daemon=True)
        stderr_thread.start()
        
        result = None
        try:
            # Read stdout line by line
            for line in proc.stdout:
                decoded = line.decode('utf-8', errors='replace').strip()
                if not decoded:
                    continue
                    
                try:
                    msg = json.loads(decoded)
                except json.JSONDecodeError:
                    self.log(f"Non-JSON from node: {decoded[:100]}")
                    continue
                
                if msg.get('type') == 'request':
                    # Node wants us to send a request
                    resp_data = self._proxy_request(msg)
                    # Send response back to node — 容错: Node 退出后 stdin 可能 close
                    try:
                        resp_json = json.dumps(resp_data) + '\n'
                        proc.stdin.write(resp_json.encode())
                        proc.stdin.flush()
                    except (OSError, BrokenPipeError) as e:
                        # Node 已 exit — 继续读 stdout 找 result
                        self.log(f"stdin closed (Node exited?): {e}")
                        continue

                elif msg.get('type') == 'result':
                    result = msg
                    self.log(f"Got result: px3={'yes' if msg.get('px3') else 'no'}")
                    break

        except Exception as e:
            self.log(f"Bridge error: {e}")
        finally:
            try:
                proc.stdin.close()
            except:
                pass
            try:
                proc.wait(timeout=5)
            except Exception:
                try:
                    proc.kill()
                    proc.wait(timeout=3)
                except Exception:
                    pass

        # 主路径: 拿到 result JSON
        if result and result.get('px3'):
            self._px3 = result['px3']
            self._pxvid = result.get('pxvid')
            self.log(f"Success! _px3 length: {len(self._px3)}")
            return self._px3

        # 兜底: Node bridge 在 Done. Cookies: ... 已打到 stderr
        # 即使 IPC 中断也能从 stderr_lines extract
        import re
        for line in stderr_lines:
            m = re.search(r'_px3=([^;\s]+)', line)
            if m:
                self._px3 = m.group(1)
                m2 = re.search(r'_pxvid=([^;\s]+)', line)
                if m2:
                    self._pxvid = m2.group(1)
                self.log(f"Success (via stderr fallback)! _px3 length: {len(self._px3)}")
                return self._px3

        self.log("Failed to generate _px3")
        return None
    
    def _proxy_request(self, msg: Dict) -> Dict:
        """Send request via curl_cffi and return response."""
        req_id = msg['id']
        method = msg['method']
        url = msg['url']
        headers = msg.get('headers', {})
        body = msg.get('body')
        
        self.log(f"Proxying request {req_id}: {method} {url[:80]}")
        
        # Add proper headers
        if 'referer' not in {k.lower() for k in headers}:
            headers['Referer'] = 'https://www.ifood.com.br/'
        if 'origin' not in {k.lower() for k in headers}:
            headers['Origin'] = 'https://www.ifood.com.br'
        
        try:
            if method.upper() == 'POST':
                # Determine content type
                ct = headers.get('content-type', headers.get('Content-Type', ''))
                resp = self.session.post(
                    url,
                    headers=headers,
                    data=body.encode() if isinstance(body, str) else body,
                    timeout=30,
                )
            else:
                resp = self.session.get(url, headers=headers, timeout=15)
            
            self.log(f"Response {req_id}: {resp.status_code} ({len(resp.text)} bytes)")
            
            # Extract set-cookie headers
            cookies = []
            for cookie_name, cookie_value in resp.cookies.items():
                cookies.append(f"{cookie_name}={cookie_value}")
            
            return {
                'id': req_id,
                'status': resp.status_code,
                'body': resp.text,
                'headers': dict(resp.headers),
                'cookies': cookies,
            }
            
        except Exception as e:
            self.log(f"Request {req_id} failed: {e}")
            return {
                'id': req_id,
                'status': 0,
                'body': '{}',
                'error': str(e),
            }
    
    def get_cookies_dict(self) -> Dict[str, str]:
        """Get all PX cookies as dict."""
        cookies = {}
        if self._px3:
            cookies['_px3'] = self._px3
        if self._pxvid:
            cookies['_pxvid'] = self._pxvid
        if self._pxcts:
            cookies['_pxcts'] = self._pxcts
        return cookies
    
    def verify(self, lat=-23.5505, lng=-46.6333) -> bool:
        """Verify the generated cookie works for ifood API."""
        if not self._px3:
            self.log("No _px3 cookie to verify")
            return False
        
        self.log(f"Verifying _px3 against ifood API (lat={lat}, lng={lng})...")
        
        headers = {
            "accept": "application/json",
            "x-client-application-key": "41a266ee-51b7-4c37-9e9d-5cd331f280d5",
            "referer": "https://www.ifood.com.br/",
            "origin": "https://www.ifood.com.br",
        }
        
        cookies = {"_px3": self._px3}
        if self._pxvid:
            cookies["_pxvid"] = self._pxvid
        
        try:
            # Test 1: cardstack home (merchant listing)
            resp = self.session.get(
                f"https://cw-marketplace.ifood.com.br/v2/cardstack/search/home"
                f"?latitude={lat}&longitude={lng}&channel=IFOOD&alias=HOME_MULTICATEGORY_V10",
                headers=headers,
                cookies=cookies,
                timeout=30,
            )
            self.log(f"Cardstack home: {resp.status_code}")
            
            # Test 2: search autocomplete
            resp2 = self.session.get(
                f"https://cw-marketplace.ifood.com.br/v1/search/autocomplete"
                f"?latitude={lat}&longitude={lng}&channel=IFOOD&term=pizza",
                headers=headers,
                cookies=cookies,
                timeout=30,
            )
            self.log(f"Search autocomplete: {resp2.status_code}")
            
            if resp.status_code == 200:
                data = resp.json()
                sections = data.get('sections', [])
                self.log(f"Success! Got {len(sections)} sections")
                return True
            else:
                self.log(f"Failed: {resp.text[:200]}")
                return False
                
        except Exception as e:
            self.log(f"Verification failed: {e}")
            return False


def main():
    gen = PXCookieGenerator(verbose=True)
    
    px3 = gen.generate()
    if px3:
        print(f"\n{'='*60}")
        print(f"Generated _px3: {px3[:80]}...")
        print(f"_pxvid: {gen._pxvid}")
        print(f"{'='*60}\n")
        
        if gen.verify():
            print("✅ Cookie verified - API returned 200!")
        else:
            print("❌ Cookie verification failed")
    else:
        print("❌ Failed to generate _px3 cookie")


if __name__ == '__main__':
    main()
