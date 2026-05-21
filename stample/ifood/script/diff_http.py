#!/usr/bin/env python3
"""
diff_http.py — 把"我生成的 iFood POST"vs"真抓的 iFood POST" 字节级对比

对比项目：
  - HTTP request headers（含集、顺序、值）
  - Form params（key 集、顺序、值）
  - body 长度差

用途：debug 我的 POST 为什么跟真 POST 不一样。
能告诉你 "header 少了 user-agent 还是 form param 顺序不对" 这种 PC 算对了但
collector 拒绝的常见原因。

用法:
  python diff_http.py <my_post.txt>
    my_post.txt 是我生成器写出的 HTTP request 文本（含 headers + body）
    格式跟 sample/1/request_2.txt 一样：
      POST <url>
      Header-X: value
      ...
      （空行）
      param=value&param=value&...

  reference 默认 = ../sample/1/request_2.txt
"""
import json, sys, urllib.parse
from pathlib import Path

HERE = Path(__file__).resolve().parent
REF = HERE.parent / "sample" / "1" / "request_2.txt"

if len(sys.argv) < 2:
    print(f"用法: python {Path(__file__).name} <my_post.txt>")
    print(f"  reference 默认: {REF}")
    sys.exit(1)

my_file = Path(sys.argv[1])
if not my_file.exists():
    print(f"❌ 不存在: {my_file}")
    sys.exit(1)


def parse_post_txt(txt):
    """解 sample/N/request_X.txt 格式：第一行 POST <url>，后面 headers，空行，body"""
    lines = txt.replace("\r\n", "\n").split("\n")
    # 第一行 "POST <url>"
    url = lines[0].split(" ", 1)[1] if lines[0].startswith("POST ") else ""
    # headers 直到空行
    headers = {}
    i = 1
    while i < len(lines) and lines[i].strip():
        if ":" in lines[i]:
            k, v = lines[i].split(":", 1)
            headers[k.strip().lower()] = v.strip()
        i += 1
    # 跳过空行
    i += 1
    # 剩下是 body
    body = "\n".join(lines[i:]).strip()
    # form params
    params = {}
    param_order = []
    for p in body.split("&"):
        if "=" in p:
            k, v = p.split("=", 1)
            params[k] = urllib.parse.unquote(v)  # 注意：不用 unquote_plus（base64 的 + 是字面字符）
            param_order.append(k)
    return url, headers, body, params, param_order


m_url, m_hdr, m_body, m_params, m_order = parse_post_txt(my_file.read_text(encoding="utf-8"))
r_url, r_hdr, r_body, r_params, r_order = parse_post_txt(REF.read_text(encoding="utf-8"))

print(f"═══ iFood POST byte-level diff ═══")
print(f"  我:    {my_file}")
print(f"  真抓:  {REF.name}")
print()

# URL
print(f"── URL ──")
if m_url == r_url:
    print(f"  ✓  {m_url}")
else:
    print(f"  ⚠️  mine: {m_url}")
    print(f"      real: {r_url}")
print()

# Headers
print(f"── HTTP HEADERS ──")
all_h = sorted(set(m_hdr) | set(r_hdr))
for k in all_h:
    mv, rv = m_hdr.get(k), r_hdr.get(k)
    if mv == rv:
        continue
    if not mv:
        print(f"  ❌🤖 {k:<25}  MISSING in mine; real={rv[:50]!r}")
    elif not rv:
        print(f"  ❌🌐 {k:<25}  EXTRA in mine;   mine={mv[:50]!r}")
    else:
        print(f"  ⚠️  {k:<25}")
        print(f"      mine={mv[:60]!r}")
        print(f"      real={rv[:60]!r}")

# Form params
print(f"\n── FORM PARAMS ──")
all_p = sorted(set(m_params) | set(r_params))
for k in all_p:
    mv, rv = m_params.get(k), r_params.get(k)
    if k == "payload":
        # payload 永远不同（动态加密），只对比长度
        print(f"  payload      mine_len={len(mv or '')}  real_len={len(rv or '')}")
        continue
    if mv == rv:
        print(f"  ✓ {k:<10} = {(mv or '')[:50]}")
    else:
        if not mv:
            print(f"  ❌🤖 {k:<10}  MISSING in mine; real={rv[:60]!r}")
        elif not rv:
            print(f"  ❌🌐 {k:<10}  EXTRA in mine;   mine={mv[:60]!r}")
        else:
            print(f"  ⚠️  {k:<10}")
            print(f"      mine={mv[:60]!r}")
            print(f"      real={rv[:60]!r}")

# Param 顺序
print(f"\n── PARAM ORDER ──")
print(f"  mine: {m_order}")
print(f"  real: {r_order}")
if m_order != r_order:
    print(f"  ⚠️  顺序不一样！可能影响 PC 校验。")

# Body 长度
print(f"\n── BODY LENGTH ──")
print(f"  mine: {len(m_body)} bytes")
print(f"  real: {len(r_body)} bytes")
print(f"  Δ   : {len(m_body) - len(r_body):+d} bytes")
