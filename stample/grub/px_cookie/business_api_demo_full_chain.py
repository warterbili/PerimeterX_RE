#!/usr/bin/env python3
"""
Grubhub 全链路 PX 验证 + 真实数据落地 demo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

本 demo 同时检测两件事：

  A. 【PX 验证】纯算 `_px2` 在所有 PX 守门端点是否通过
     —— 这是本项目（perimeter）的核心成果。
     判定：200 / 463-JSON 都算 PX-pass；只有 HTML px-captcha + 403 才算 PX-reject。

  B. 【业务落地】端到端拿到 grocery.grubhub.com 的 `__Host-instacart_sid`
     并用 sid 调一次 grocery 域接口，证明真实数据可访问。

跟 business_api_demo.js (JS 版) 的差异：
  JS 版只跑前 3 步（PX 守门 #1 + #2），不做 SSO；本 Python 版跑完 11 步。
  完整链路需要 curl_cffi 的 chrome120 TLS 指纹 + cookie jar 跨域保持，
  Node 原生 https 缺这两样，所以 SSO 部分写 Python。

链路 11 步：
  Stage 1   本地纯算生成 _px2 + _pxvid             ← 调本目录 grubhub_px2.js
  Stage 2   POST /auth (anonymous)                 ── PX 守门 #1
  Stage 3   POST /auth/login                       ── PX 守门 #2
                200 = device-trusted 直登         （PX-pass，业务也通过）
                463 = PX 通过 + 业务层要 OTP      （PX-pass，业务层 reject）
                403 = PX 拦                       （PX-reject）
  Stage 7   GET grocery.../awe/init                ── 无 PX
  Stage 8   GET api-gtm.../oauth2/authorize        ── 无 PX
  Stage 9   PUT api-gtm.../oauth2/{ud_id}/access   ── PX 守门 #3
                ⚠️ 用裸 GH_HEADERS + Bearer，不要加 perimeter-x header
                  （加 HMAC header 反而 403 — HMAC 公式跟其它端点不同）
  Stage 10  GET grocery.../awe/callback?code=...   ── 无 PX
                → Set-Cookie: __Host-instacart_sid ⭐
  Stage 11  GET grocery.grubhub.com/ (with sid)    ── 无 PX
                sid 工作证明，认证态成功 = 业务数据可达

依赖:
    pip install curl_cffi
    Node.js (本目录的 grubhub_px2.js generator)

一键跑用法:
    python business_api_demo_full_chain.py
        → 用内置默认代理 + 默认 device-trusted 账号

带自己的:
    export HTTPS_PROXY='http://<user>:<pwd>@<host>:<port>'   # US 住宅推荐
    export GRUBHUB_EMAIL='your@email'
    export GRUBHUB_PASSWORD='yourpassword'
    python business_api_demo_full_chain.py

退出码:
    0 = PX 验证全过（PX 视角 demo 成功，无论业务层是否 463）
    2 = PX 拦（403 出现在 PX 守门端点）
    3 = 生成器 / 网络 / 其它系统问题
"""
import os
import sys
import json
import time
import uuid
import logging
import subprocess
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import warnings
warnings.filterwarnings("ignore")

from curl_cffi import requests as cffi_req


# ═══════════════════════════════════════════════════════════════════════════
# 凭据占位符（必须替换或走 env var 覆盖）
# 推荐用 env var：把凭据保留在 shell session 里，避免入 git
# ═══════════════════════════════════════════════════════════════════════════
DEFAULT_BRD_PROXY = "http://brd-customer-hl_<YOUR_BRD_ID>-zone-residential-country-us:<YOUR_BRD_PASSWORD>@zproxy.lum-superproxy.io:22225"
DEFAULT_EMAIL     = "<YOUR_GRUBHUB_EMAIL>"          # ⚠️ 必须是 device-trusted 账号
DEFAULT_PASSWORD  = "<YOUR_GRUBHUB_PASSWORD>"

PROXY = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy") or DEFAULT_BRD_PROXY
PROXIES = {"http": PROXY, "https": PROXY}
EMAIL    = os.environ.get("GRUBHUB_EMAIL")    or DEFAULT_EMAIL
PASSWORD = os.environ.get("GRUBHUB_PASSWORD") or DEFAULT_PASSWORD

if "<YOUR_BRD_" in PROXY:
    sys.exit("❌ 必须先设代理：编辑 DEFAULT_BRD_PROXY 或 export HTTPS_PROXY=...")
if EMAIL.startswith("<YOUR_") or PASSWORD.startswith("<YOUR_"):
    sys.exit("❌ 必须先设账号：编辑 DEFAULT_EMAIL/PASSWORD 或 export GRUBHUB_EMAIL/GRUBHUB_PASSWORD")


# ═══════════════════════════════════════════════════════════════════════════
# Grubhub 常量
# ═══════════════════════════════════════════════════════════════════════════
GH_CLIENT_ID = "beta_UmWlpstzQSFmocLy3h1UieYcVST"
GH_DEVICE_ID = "-981990071"   # ⚠️ 必须 string（int 会被业务层当陌生设备 → 463）
                              # 此值跟具体账号绑定 —— 换账号时必须换成那个账号 OTP 注册时用过的 device_id
GH_BRAND     = "GRUBHUB"

# ⚠️ UA 必须跟 impersonate='chrome120' 对齐到同一个 Chrome 版本
# Chrome 148 / 145 都会被 PX 识别为 TLS 指纹和 UA 不一致 → bot
GH_HEADERS = {
    "Content-Type":    "application/json",
    "Accept":          "application/json",
    "Origin":          "https://www.grubhub.com",
    "Referer":         "https://www.grubhub.com/",
    "User-Agent":      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

log = logging.getLogger("grub.full_chain")

_THIS_DIR = Path(__file__).resolve().parent


# ═══════════════════════════════════════════════════════════════════════════
# PX 守门跟踪
# ═══════════════════════════════════════════════════════════════════════════
class PxAudit:
    """记录每个 PX 守门端点的判定结果，最后汇总。"""
    def __init__(self):
        self.gates = []   # list of (name, verdict, detail)

    def record(self, name, status_code, body_snippet=""):
        """
        判定规则：
          - HTTP 200                            → PX-pass
          - HTTP 463 + JSON 有 verify_methods   → PX-pass，业务层 reject
          - HTTP 403 + HTML 含 px-captcha       → PX-reject
          - 其它 4xx/5xx                        → ambiguous
        """
        if status_code == 200:
            verdict, detail = "PX-pass", "HTTP 200"
        elif status_code == 463 and "verify_methods" in body_snippet:
            verdict, detail = "PX-pass", "HTTP 463 (业务层要 OTP，PX 已放行)"
        elif status_code == 403 and ("px-captcha" in body_snippet or "_pxAppId" in body_snippet):
            verdict, detail = "PX-reject", "HTTP 403 + px-captcha"
        elif status_code == 403:
            verdict, detail = "PX-reject?", f"HTTP 403 (非 captcha 页面，但 PX 层最可能)"
        else:
            verdict, detail = "ambiguous", f"HTTP {status_code}"
        self.gates.append((name, verdict, detail))
        return verdict

    def summary(self):
        """返回 (px_pass_count, px_reject_count, total)。"""
        ps = sum(1 for _, v, _ in self.gates if v == "PX-pass")
        pr = sum(1 for _, v, _ in self.gates if v.startswith("PX-reject"))
        return ps, pr, len(self.gates)

    def print_report(self):
        print("\n" + "─" * 72)
        print(" PX 守门验证报告")
        print("─" * 72)
        for name, verdict, detail in self.gates:
            icon = "✅" if verdict == "PX-pass" else "❌" if "reject" in verdict else "⚠️"
            print(f"  {icon} {name:<32} {verdict:<12} {detail}")
        ps, pr, total = self.summary()
        print("─" * 72)
        print(f"  PX-pass: {ps}/{total}   PX-reject: {pr}/{total}")
        print("─" * 72)


# ═══════════════════════════════════════════════════════════════════════════
# Stage 1 — 本地纯算生成 _px2（调本目录 grubhub_px2.js）
# ═══════════════════════════════════════════════════════════════════════════
def gen_px2():
    """调用本目录的 Node generator 拿 _px2 + _pxvid。

    返回 dict: {"cookie_value": "...", "vid": "..."}
    需要 PATH 上有 node。
    """
    snippet = (
        "require('./grubhub_px2')().then(r => "
        "process.stdout.write(JSON.stringify({"
        "cookie_value: r.cookie_value, "
        "vid: (r.state && r.state.vid) || ''"
        "})))"
    )
    try:
        proc = subprocess.run(
            ["node", "-e", snippet],
            cwd=str(_THIS_DIR),
            capture_output=True, text=True, timeout=30,
        )
    except FileNotFoundError:
        raise RuntimeError("`node` 不在 PATH 上。请安装 Node.js 或把本目录加进 PATH。")
    if proc.returncode != 0 or not proc.stdout.strip():
        raise RuntimeError(f"grubhub_px2.js 没产出 cookie：\nstdout={proc.stdout}\nstderr={proc.stderr}")
    try:
        return json.loads(proc.stdout.strip())
    except Exception:
        raise RuntimeError(f"无法解析 generator 输出: {proc.stdout!r}")


# ═══════════════════════════════════════════════════════════════════════════
# Stage 2 — POST /auth (anonymous scope) — PX 守门 #1
# ═══════════════════════════════════════════════════════════════════════════
def stage2_anon(session, audit):
    """返回 anon_token 或 None（PX-reject 时 None）。"""
    r = session.post(
        "https://api-gtm.grubhub.com/auth",
        headers=GH_HEADERS,
        json={
            "brand":     GH_BRAND,
            "client_id": GH_CLIENT_ID,
            "device_id": str(uuid.uuid4()),
            "scope":     "anonymous",
        },
        timeout=30,
    )
    print(f"   /auth                   HTTP {r.status_code}", flush=True)
    audit.record("PX#1 /auth (anonymous)", r.status_code, r.text[:500])
    if r.status_code != 200:
        return None
    return r.json()["session_handle"]["access_token"]


# ═══════════════════════════════════════════════════════════════════════════
# Stage 3 — POST /auth/login — PX 守门 #2
# ═══════════════════════════════════════════════════════════════════════════
def stage3_login(session, anon_token, email, password, audit):
    """
    返回 (access_token, refresh_token, ud_id) 或 (None, None, None)。

    PX-pass 但拿不到 token 的情况（如 463 业务层要 OTP）：
    audit 里依然标 PX-pass，但本函数返回 None tuple，让 main() 知道下游 SSO 没法跑。
    """
    H = {**GH_HEADERS, "Authorization": f"Bearer {anon_token}"}
    r = session.post(
        "https://api-gtm.grubhub.com/auth/login",
        headers=H,
        json={
            "brand":     GH_BRAND,
            "client_id": GH_CLIENT_ID,
            "device_id": GH_DEVICE_ID,   # string!
            "email":     email,
            "password":  password,
        },
        timeout=30,
    )
    print(f"   /auth/login             HTTP {r.status_code}", flush=True)
    audit.record("PX#2 /auth/login", r.status_code, r.text[:500])

    if r.status_code == 200:
        sh = r.json().get("session_handle", {})
        ud_id = sh.get("ud_id") or r.json().get("credential", {}).get("ud_id", "")
        return sh.get("access_token", ""), sh.get("refresh_token", ""), ud_id

    if r.status_code == 463:
        # PX 通过，但业务层 device-untrust 要 OTP；本 demo 不走 mail.tm OTP
        verify = r.json().get("verify_methods", {})
        print(f"   ↑ 业务层要 OTP: {list(verify.keys())}", flush=True)
        print(f"     (PX 已放行；要拿 token 须换 device-trusted 账号 or 走 OTP 流程)", flush=True)
        return None, None, None

    # 其它状态：403 / 401 / 500…
    print(f"   ❌ /auth/login 失败 (HTTP {r.status_code})", flush=True)
    print(f"      body: {r.text[:200]}", flush=True)
    return None, None, None


# ═══════════════════════════════════════════════════════════════════════════
# Stage 7-10 — SSO 4 步链路 → __Host-instacart_sid
# ═══════════════════════════════════════════════════════════════════════════
def stage7_10_sso(session, access_token, ud_id, audit):
    """OAuth2 SSO 4 步：grubhub.com access_token → grocery.grubhub.com __Host-instacart_sid

    返回 (sid, err)。
    SSO 第 3 步（Stage 9）是 PX 守门端点，会记录到 audit。
    """
    # Stage 7 — Init SSO
    r1 = session.get(
        "https://grocery.grubhub.com/rest/sso/auth/awe/init",
        headers=GH_HEADERS, allow_redirects=False, timeout=15,
    )
    print(f"   awe/init                HTTP {r1.status_code}", flush=True)
    if r1.status_code != 302:
        return None, f"init: http {r1.status_code}"
    auth_url = r1.headers.get("location", "")

    # Stage 8 — Follow authorize → 拿 state + redirect_uri
    r2 = session.get(auth_url, headers=GH_HEADERS, allow_redirects=False, timeout=15)
    print(f"   oauth2/authorize        HTTP {r2.status_code}", flush=True)
    if r2.status_code not in (301, 302, 303):
        return None, f"authorize: http {r2.status_code}"
    login_url = r2.headers.get("location", "")
    parsed = urlparse(login_url)
    params = parse_qs(parsed.query)
    state = params.get("state", [""])[0]
    redirect_uri = params.get("redirect_uri", [""])[0]
    if not state or not redirect_uri:
        return None, "missing state or redirect_uri"

    # Stage 9 — Grant OAuth access (PX 也守此端点)
    r3 = session.put(
        f"https://api-gtm.grubhub.com/oauth2/{ud_id}/access",
        headers={**GH_HEADERS, "Authorization": f"Bearer {access_token}"},
        params={
            "response_type": "code",
            "client_id":     "insta_B3vX9nL7qT",
            "redirect_uri":  redirect_uri,
            "scope":         "diner",
            "state":         state,
        },
        timeout=15,
    )
    print(f"   oauth2/.../access (PX!) HTTP {r3.status_code}", flush=True)
    audit.record("PX#3 oauth2/{ud_id}/access", r3.status_code, r3.text[:500])
    if r3.status_code != 200:
        return None, f"access: http {r3.status_code}"
    callback_url = r3.json().get("redirect_uri")
    if not callback_url:
        return None, "no redirect_uri in access response"

    # Stage 10 — Callback → Set-Cookie: __Host-instacart_sid
    for attempt in range(3):
        try:
            r4 = session.get(callback_url, headers=GH_HEADERS,
                             allow_redirects=True, timeout=20)
            print(f"   awe/callback            HTTP {r4.status_code}  (attempt {attempt+1})", flush=True)
        except Exception as e:
            log.debug(f"callback exc: {e}")
        for c in session.cookies.jar:
            if c.name == "__Host-instacart_sid" and c.value:
                return c.value, None
        if attempt < 2:
            time.sleep(3)
    return None, "no __Host-instacart_sid in jar after 3 callback attempts"


# ═══════════════════════════════════════════════════════════════════════════
# Stage 11 — sid 工作证明：调一次 grocery.grubhub.com 接口
# ═══════════════════════════════════════════════════════════════════════════
def stage11_verify_sid(session):
    """用拿到的 sid 调 grocery.grubhub.com/，证明 sid 在下游域被接受。

    判定：
      200            → sid 工作（直接渲染）
      302 → /store    → sid 工作（已登录跳到商店首页）
      302 → /login    → sid 无效
    """
    r = session.get(
        "https://grocery.grubhub.com/",
        headers=GH_HEADERS,
        allow_redirects=False, timeout=15,
    )
    location = r.headers.get("location", "") or ""
    print(f"   grocery.grubhub.com/    HTTP {r.status_code}"
          + (f"  → {location}" if location else ""),
          flush=True)

    if r.status_code == 200:
        return True, "grocery 域接受 sid，直接 200"
    if r.status_code in (301, 302) and "/login" not in location.lower():
        return True, f"重定向到 {location}（非 login），sid 已认证"
    return False, f"HTTP {r.status_code} → {location or '(no location)'}"


# ═══════════════════════════════════════════════════════════════════════════
# 主流程
# ═══════════════════════════════════════════════════════════════════════════
def main():
    logging.basicConfig(level=logging.WARNING)
    print("=" * 72)
    print(" Grubhub 全链路 PX 验证 + 真实数据落地 demo")
    print(f" account: {EMAIL[:6]}***@{EMAIL.split('@')[1]}")
    print(f" proxy:   {'env override' if os.environ.get('HTTPS_PROXY') else 'default BrightData country-us residential'}")
    print("=" * 72, flush=True)

    audit = PxAudit()
    t0 = time.time()

    # ─── Stage 1 ───
    print("\n━━━ Stage 1: 本地生成 _px2 ━━━", flush=True)
    t = time.time()
    px = gen_px2()
    px2, pxvid = px["cookie_value"], px["vid"]
    print(f"   ✅ _px2 = {px2[:50]}...  ({int((time.time()-t)*1000)}ms)", flush=True)
    if pxvid:
        print(f"      _pxvid = {pxvid}", flush=True)

    # build session
    session = cffi_req.Session(impersonate="chrome120")
    session.verify = False
    session.proxies = PROXIES
    session.cookies.set("_px2", px2, domain="grubhub.com")
    if pxvid:
        session.cookies.set("_pxvid", pxvid, domain="grubhub.com")

    # ─── Stage 2 ───
    print("\n━━━ Stage 2: /auth (anonymous) — PX 守门 #1 ━━━", flush=True)
    t = time.time()
    anon_token = stage2_anon(session, audit)
    print(f"   ({int((time.time()-t)*1000)}ms)", flush=True)
    if not anon_token:
        print("\n❌ PX 守门 #1 没过 — 整条链路无法继续", flush=True)
        audit.print_report()
        sys.exit(2)
    print(f"   anon_token = {anon_token[:30]}...", flush=True)

    # ─── Stage 3 ───
    print("\n━━━ Stage 3: /auth/login — PX 守门 #2 ━━━", flush=True)
    t = time.time()
    access_token, refresh_token, ud_id = stage3_login(session, anon_token, EMAIL, PASSWORD, audit)
    print(f"   ({int((time.time()-t)*1000)}ms)", flush=True)

    sid, sid_err, stage11_ok, stage11_msg = None, None, None, None

    if access_token:
        # 拿到 token，跑 SSO + Stage 11
        print(f"   access_token   = {access_token[:30]}...", flush=True)
        print(f"   refresh_token  = {refresh_token[:30]}...", flush=True)
        print(f"   ud_id          = {ud_id}", flush=True)

        # ─── Stage 7-10 ───
        print("\n━━━ Stage 7-10: SSO 4 步链路 → __Host-instacart_sid ━━━", flush=True)
        t = time.time()
        sid, sid_err = stage7_10_sso(session, access_token, ud_id, audit)
        print(f"   ({int((time.time()-t)*1000)}ms)", flush=True)

        if sid:
            # ─── Stage 11 ───
            print("\n━━━ Stage 11: 用 sid 调 grocery.grubhub.com (sid 工作证明) ━━━", flush=True)
            t = time.time()
            stage11_ok, stage11_msg = stage11_verify_sid(session)
            print(f"   {'✅' if stage11_ok else '❌'} {stage11_msg}  ({int((time.time()-t)*1000)}ms)", flush=True)
        else:
            print(f"\n⚠️  SSO 链路失败: {sid_err}", flush=True)
    else:
        # Stage 3 不是 200（最常见 463：PX-pass 但业务层 reject）
        # 这种情况下 SSO 跑不起来，但 PX 验证不算失败
        print("\n⚠️  没拿到 user access_token，跳过 SSO 7-10 + Stage 11", flush=True)
        print("    （这通常是账号 device-untrust，跟 PX 无关 —— 换 device-trusted 账号即可）", flush=True)

    # ─── 报告 ───
    audit.print_report()

    px_pass, px_reject, _ = audit.summary()
    print(f"\n业务链路结果:")
    print(f"  user access_token        : {'✅ 拿到' if access_token else '❌ 没拿到（463 / 业务层 reject）'}")
    print(f"  __Host-instacart_sid     : {'✅ ' + sid[:50] + '...' if sid else '❌ 没拿到'}")
    print(f"  grocery 域 sid 验证       : {'✅ ' + stage11_msg if stage11_ok else '❌ ' + (stage11_msg or 'skipped')}")
    print(f"\n总耗时: {time.time() - t0:.1f}s")

    print("\n" + "═" * 72)
    if px_reject > 0:
        print(" ❌ PX 验证失败 — 有 PX 守门端点拦截")
        print("═" * 72)
        sys.exit(2)
    elif sid and stage11_ok:
        print(" 🎯 完整成功 — PX 验证 + 业务数据落地双双通过")
    elif access_token:
        print(" ✅ PX 验证全过；业务部分卡在 SSO（看上面错误）")
    else:
        print(" ✅ PX 验证全过；业务部分卡在 /auth/login 463 (账号 device-untrust，跟 PX 无关)")
    print("═" * 72)


if __name__ == "__main__":
    main()
