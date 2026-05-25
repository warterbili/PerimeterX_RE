# Playbook: HMAC / MD5 字段公式还原

> 当你的 EV2 含 32-字符 hex 字段（明显是 HMAC-MD5 或 MD5 结果）时，**这些字段的 input 必须 6 批 crypto 实测来确认，不能从其他站点抄**（Gotcha #18）。
>
> 预计时间：每个字段 **5-15 分钟**

## 什么时候要用这个 playbook

- 你正在写新站点 generator
- 你发现某些 EV2 字段是 32 字符 hex（疑似 md5/HMAC-md5 输出）
- 历史代码里这些字段的 input 是从其他站点 (iFood/Grub) 抄的、未经实测验证
- 或者 Layer 3.5 验证失败、`compare_ev2_field_by_field` 显示 HMAC 字段值不一致

## SOP（5 步）

### Step 1 — 找候选字段

```bash
# 看 EV2 模板里哪些字段是 32 字符 hex
python -c "
import json
ev2 = json.load(open('stample/<site>/sample/1/decoded_payload_2.json'))[0]['d']
for k, v in ev2.items():
    if isinstance(v, str) and len(v) == 32 and all(c in '0123456789abcdef' for c in v):
        print(f'  {k}  = {v}')
"
```

输出示例（totalwine）：

```
  Cho5UEx3PWY=  = 70f2bc836c01ecb903f202505091af03
  Lx8cFWl9HCE=  = 7ed349089b27e290590e527262334019
  UiJhKBREYhs=  = d224bc2e09bb708a1f3920fadc261bca
  EFwjFlU8JyU=  = f710b5af53612e6bff25c1bd44bf7f14
```

### Step 2 — 在 SDK 里 grep 每个 b64 key 的赋值点

```bash
python << 'EOF'
import re
sdk = open('stample/<site>/source/main.min.js', encoding='utf-8', errors='ignore').read()
for k in ['Cho5UEx3PWY=', 'Lx8cFWl9HCE=', 'UiJhKBREYhs=', 'EFwjFlU8JyU=']:
    print(f'\n=== {k} ===')
    for m in re.finditer(re.escape(k), sdk):
        s = max(0, m.start()-150); e = min(len(sdk), m.end()+150)
        print(f'  pos {m.start()}: ...{sdk[s:e]}...')
EOF
```

期望看到形如:

```js
n["<b64-key>="] = jm(X(), Y())   // jm = HMAC-MD5; X(), Y() = input + key
n["<b64-key>="] = qT()           // 单 arg → 内部是 md5/jl(i)
```

### Step 3 — 看 X() / Y() 函数定义

```bash
python << 'EOF'
import re
sdk = open('stample/<site>/source/main.min.js', encoding='utf-8', errors='ignore').read()
def find_braced(start_idx):
    depth = 0; in_str = False; quote = None
    i = sdk.index('{', start_idx); depth = 1; i += 1
    while i < len(sdk) and depth > 0 and (i - start_idx) < 4000:
        c = sdk[i]
        if in_str:
            if c == '\\': i += 2; continue
            if c == quote: in_str = False
        elif c in '"\'':
            in_str = True; quote = c
        elif c == '{': depth += 1
        elif c == '}': depth -= 1
        i += 1
    return sdk[start_idx:i]
for fn in ['oU', 'ku', 'qy', 'qT', 'jm']:   # 替换成你 Step 2 找到的函数名
    m = re.search(rf'function {re.escape(fn)}\(', sdk)
    if m: print(f'\n=== {fn} ===\n  {find_braced(m.start())[:500]}')
EOF
```

期望发现:
- `oU()` 返回 uuid (`oS=oY()||kL("uuid")||nS()`)
- `qy()` 返回 sessionStorage 某 key 的值
- `qT()` 返回 storage 某 key 的值
- `ku()` 返回某个全局 var（再 grep 这个 var 的赋值点）

### Step 4 — 跨 6 批 crypto 枚举验证

对每个 HMAC 字段，候选 input 通常是：
- `uuid`（最常见）
- `state.vid`、`state.pxsid`、`state.cts`（uuid 格式 state）
- `state.no`、`state.to`（数字格式 state）
- `state.qa`（64-hex sha256）
- response_1 里 `OOOllO` 段的 cookie 值（`cc`, `idp_c`）

```bash
python << 'EOF'
import json, hmac, hashlib

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36'

def hm(s, k): return hmac.new(k.encode(), s.encode(), hashlib.md5).hexdigest()
def md5(s): return hashlib.md5(s.encode()).hexdigest()

# 你要验的字段
TARGET_FIELDS = ['Cho5UEx3PWY=', 'Lx8cFWl9HCE=', 'UiJhKBREYhs=', 'EFwjFlU8JyU=']

results = {f: {} for f in TARGET_FIELDS}
for i in range(1, 7):
    ev2 = json.load(open(f'stample/<site>/sample/{i}/decoded_payload_2.json'))[0]['d']
    resp1 = json.load(open(f'stample/<site>/sample/{i}/decoded_response_1.json'))
    meta = json.load(open(f'stample/<site>/sample/{i}/meta.json'))
    uuid = meta['uuid']

    # 从 response_1 段提 state（按你 SDK 的 segment shape 调整）
    state = {}
    for seg in resp1.get('segments', resp1 if isinstance(resp1, list) else []):
        if not isinstance(seg, str): continue
        parts = seg.split('|')
        if len(parts) >= 2:
            # 按 segment prefix 分类（举例）
            if parts[0] == 'OOllOO': state['pxsid'] = parts[1]
            elif parts[0] == 'lOlOOO': state['vid'] = parts[1]
            elif parts[0] == 'OlllOlll': state['cts'] = parts[1]
            # 添加你站点 SDK 的其他 prefix
            
    # 候选 inputs
    candidates = {
        'uuid': uuid,
        'state.vid': state.get('vid', ''),
        'state.pxsid': state.get('pxsid', ''),
        'state.cts': state.get('cts', ''),
        # 加更多候选
    }

    for fname in TARGET_FIELDS:
        real_val = ev2.get(fname)
        if not real_val: continue
        for cname, cval in candidates.items():
            if not cval: continue
            # HMAC variant
            if hm(cval, UA) == real_val:
                results[fname][f'HMAC({cname}, UA)'] = results[fname].get(f'HMAC({cname}, UA)', 0) + 1
            # MD5 variant
            if md5(cval) == real_val:
                results[fname][f'md5({cname})'] = results[fname].get(f'md5({cname})', 0) + 1

# 命中 6/6 即为公式确认
for fname, scores in results.items():
    print(f'\n{fname}:')
    for formula, count in sorted(scores.items(), key=lambda x: -x[1]):
        ok = '✅' if count == 6 else f'{count}/6'
        print(f'  {ok}  {formula}')
EOF
```

### Step 5 — 6/6 命中即采用

任何公式得 **6/6** = 跨所有 batch 都命中，确认无歧义。

如果有公式只有 5/6 或更少命中 → 通常是某个 state 字段提取错（如 `state.vid` 跟 `state.cts` 在某一批被互相混淆）。回 Step 4 检查 segment prefix 是否正确。

如果**所有候选都 0/6 命中** → 说明 input 不在你列的候选里。这时再扩展候选：
- canvas 指纹 hash？
- audio 指纹 hash？
- screen 维度字符串？
- WebGL renderer string？
- 多个 state 字段拼接（`uuid + state.no`、`state.vid + state.pxsid` …）？

## totalwine 实测结果（参考）

| 字段 | 公式 | 命中率 |
|---|---|---|
| `Cho5UEx3PWY=` | `HMAC(uuid, UA)` | 6/6 ✅ |
| `Lx8cFWl9HCE=` | `HMAC(state.vid, UA)` | 6/6 ✅ |
| `UiJhKBREYhs=` | `HMAC(state.pxsid, UA)` | 6/6 ✅ |
| `EFwjFlU8JyU=` | `md5(state.vid)` | 6/6 ✅ |

注意：`EFwjFlU8JyU=` 是 **md5**（单 arg `jl(i)`）不是 HMAC，光看输出 32-hex 形态分不出来 —— 必须 SDK grep 看是 `jm(X)` 还是 `jm(X, Y)`。

## 反模式（不要做）

- ❌ 看到 32-hex 就抄上一个站点的 `hmac(uuid+':a', UA)` 这种公式
- ❌ 只验证 1 个 batch，不做 6 批交叉
- ❌ 看到 HMAC 字段对的就停，不验剩下的（4 个字段每个都要单独验证）
- ❌ 忽略 SDK grep 直接 brute-force 枚举 —— 慢且容易错

## 通用规则

**任何 32-hex 字段、任何新站点、都要走这 5 步**。一次性投入 30 分钟实测，可以省掉之后调试 trust score 时几小时的乱猜。
