# PX 加密算法链完整还原

PX SDK 上报 collector POST 时使用的 5 个核心算法 —— 从原始 events 对象到能发上服务器的字符串，端到端可复现。所有代码与本仓库 `src/reverse/` 中的实现等价。

> 本文档说明：所有代码块统一使用 ASCII 转义（`U+XXXX` 文本或 `\\uXXXX` 字符串字面量）表达不可见字符。文件中**零字面控制字符**、**零 NUL 字节**、**零隐形 Unicode** —— VSCode / 任何编辑器都能正常打开。

## 总览

```
events (JS object)
   |
   |-> serialize()         (PX 自定义，不是 JSON.stringify)
   |       |
   |       v
   |   '[{"t":...,"d":{...}}]'   (PX 形状的 JSON 字符串)
   |       |
   |       |-> xor(., 50)         (字符级 XOR, key=50)
   |       v
   |   XOR 后的二进制串
   |       |
   |       |-> b64utf8encode()    (必须 UTF-8 不能 Latin-1)
   |       v
   |   base64 字符串
   |       |
   |       |-> interleave()       (按 offsets 插入 padding key)
   |       v
   |   payload  (送服务器)
   |
   |-> pc = jt(serialize(events), uuid:tag:ft)   (HMAC-MD5 + 数字提取)
   |
   |-> sid = state.pxsid + hh(state.no)          (Unicode Tag Char 隐写)
   |
   '-> ev2[at_key] = at_val                       (anti-tamper 动态 XOR)
        at_key = te(state.to, state.no%10+2)
        at_val = te(state.to, state.no%10+1)
```

---

## 1. PX 自定义 serialize（替代 JSON.stringify）

### 8 处与 JSON.stringify 的差异

| 输入 | JSON.stringify | PX serialize |
|---|---|---|
| `undefined` | 跳过 key | 输出 `'"undefined"'` 带引号字符串 |
| `NaN` | 抛错 / null | `'null'` |
| `Infinity` | 抛错 / null | `'null'` |
| `RegExp` | `'{}'` | `'null'` |
| `Date` | ISO 补零 | `"2026-5-19T3:45:30.123"` 不补零 |
| 值是 undefined 的属性 | 跳过 | 输出 `'"undefined"'` |
| Escape 字符集 | 标准 | 含 `\v` + 额外 Unicode 范围 |
| 空对象 | `'{}'` | `'{}'`（同）|

### 需要被 escape 的字符集合

原始 SDK 用一条正则 `/[\\\"...]/g` 表达。该正则字面包含**真实的不可见字符**，存进 markdown 文件会被工具判定为二进制。这里改用**纯 ASCII 谓词描述**：

```
需要 escape 的 code point：
  U+005C   反斜杠       (\)
  U+0022   双引号       (")
  U+0000 .. U+001F   C0 控制字符 (NUL .. US)
  U+007F .. U+009F   DEL + C1 控制字符
  U+00AD              软连字符
  U+0600 .. U+0604   阿拉伯数字符号
  U+070F              叙利亚缩写符
  U+17B4, U+17B5     高棉元音内置
  U+200C .. U+200F   零宽非连字符 / 零宽连字符 / 左右标记
  U+2028 .. U+202F   行/段分隔符 + 双向标记 + NNBSP
  U+2060 .. U+206F   字 joiner + 不可见运算符
  U+FEFF              BOM / 零宽不间断空格
  U+FFF0 .. U+FFFF   Specials 块
```

### 完整实现

```javascript
const ESC_MAP = {
    '\b': '\\b',
    '\t': '\\t',
    '\n': '\\n',
    '\f': '\\f',
    '\r': '\\r',
    '\v': '\\v',
    '"':  '\\"',
    '\\': '\\\\',
};

function needsEscape(ch) {
    const c = ch.charCodeAt(0);
    if (c < 0x20) return true;                     // C0 控制
    if (c >= 0x7F && c <= 0x9F) return true;       // DEL + C1
    if (c === 0xAD) return true;                   // 软连字符
    if (c >= 0x600 && c <= 0x604) return true;     // 阿拉伯
    if (c === 0x70F) return true;                  // 叙利亚
    if (c === 0x17B4 || c === 0x17B5) return true; // 高棉
    if (c >= 0x200C && c <= 0x200F) return true;   // ZWNJ/ZWJ/LRM/RLM
    if (c >= 0x2028 && c <= 0x202F) return true;   // LS/PS/bidi/NNBSP
    if (c >= 0x2060 && c <= 0x206F) return true;   // WJ + 不可见运算符
    if (c === 0xFEFF) return true;                 // BOM
    if (c >= 0xFFF0) return true;                  // Specials
    if (ch === '"' || ch === '\\') return true;
    return false;
}

function escapeChar(ch) {
    if (ch in ESC_MAP) return ESC_MAP[ch];
    return '\\u' + ('0000' + ch.charCodeAt(0).toString(16)).slice(-4);
}

function quoteString(t) {
    let out = '"';
    for (const ch of t) {
        out += needsEscape(ch) ? escapeChar(ch) : ch;
    }
    return out + '"';
}

function serialize(e) {
    const type = typeof e;
    if (type === 'undefined') return '"undefined"';
    if (type === 'boolean')   return String(e);
    if (type === 'number') {
        const r = String(e);
        return (r === 'NaN' || r === 'Infinity') ? 'null' : r;
    }
    if (type === 'string') return quoteString(e);
    if (e === null || e instanceof RegExp) return 'null';
    if (e instanceof Date) {
        return ['"', e.getFullYear(), '-', e.getMonth() + 1, '-', e.getDate(),
                'T', e.getHours(), ':', e.getMinutes(), ':', e.getSeconds(),
                '.', e.getMilliseconds(), '"'].join('');
    }
    if (Array.isArray(e)) {
        const n = ['['];
        for (let a = 0; a < e.length; a++) n.push(serialize(e[a]) || '"undefined"', ',');
        n[n.length > 1 ? n.length - 1 : n.length] = ']';
        return n.join('');
    }
    const n = ['{'];
    for (const o in e) {
        if (Object.prototype.hasOwnProperty.call(e, o) && e[o] !== undefined) {
            n.push(quoteString(o), ':', serialize(e[o]) || '"undefined"', ',');
        }
    }
    n[n.length > 1 ? n.length - 1 : n.length] = '}';
    return n.join('');
}
```

注意：原 SDK 用 `/[\\\"<...一堆字面控制字符...>]/g` 这条正则。这里用 `needsEscape()` 函数等价表达，避免在 markdown 中写入字面控制字符。

---

## 2. XOR / Base64 / 交织 (payload 加密)

### XOR (字符级)

```javascript
function xor(t, key) {
    let n = '';
    for (let i = 0; i < t.length; i++) {
        n += String.fromCharCode(t.charCodeAt(i) ^ key);
    }
    return n;
}

// anti-tamper 别名
const te = xor;
```

XOR key 使用场景速查：

| 场景 | key |
|---|---|
| payload 加密 | `50` |
| paddingKey 派生 | `10` |
| OB 解码 | `ml(TAG) % 128` |
| anti-tamper key | `parseInt(state.no) % 10 + 2` |
| anti-tamper value | `parseInt(state.no) % 10 + 1` |

### Base64 (必须 UTF-8)

```javascript
function b64encode(t) {
    return Buffer.from(t, 'utf-8').toString('base64');
}
```

致命陷阱：**必须 UTF-8 不能 Latin-1**。XOR(50) 后字符可能落在 0x80-0xFF 区间，UTF-8 编成 2-3 字节，Latin-1 编成 1 字节，长度不同 → PC 校验失败。

### 交织 (Jf 函数)

```javascript
function Qf(t, e, n, r, a) {
    // 线性映射 [e, n] -> [r, a]
    return Math.floor((t - e) / (n - e) * (a - r) + r);
}

function getOffsets(paddingLen, payloadLen, uuid) {
    const h = xor(b64encode(uuid), 10);
    let maxProduct = -1;

    for (let p = 0; p < paddingLen; p++) {
        const row = Math.floor(p / h.length) + 1;
        const col = p % h.length;
        const product = h.charCodeAt(col) * h.charCodeAt(row);
        if (product > maxProduct) maxProduct = product;
    }

    const offsets = [];
    for (let b = 0; b < paddingLen; b++) {
        const row = Math.floor(b / h.length) + 1;
        const col = b % h.length;
        let product = h.charCodeAt(col) * h.charCodeAt(row);
        if (product >= payloadLen) {
            product = Qf(product, 0, maxProduct, 0, payloadLen - 1);
        }
        while (offsets.indexOf(product) !== -1) product += 1;  // 碰撞 +1
        offsets.push(product);
    }
    return offsets.sort((a, b) => a - b);
}

function interleave(key, payload, offsets) {
    let result = '', pos = 0;
    for (let i = 0; i < key.length; i++) {
        result += payload.substring(pos, offsets[i] - i - 1) + key[i];
        pos = offsets[i] - i - 1;
    }
    return result + payload.substring(pos);
}

function generatePayload(events, serverTs, uuid) {
    const json = serialize(events);
    const encrypted = b64encode(xor(json, 50));
    const ts = serverTs || '1604064986000';   // PX 默认 fallback ts
    const paddingKey = xor(b64encode(String(ts)), 10);   // 20 字符 key
    const offsets = getOffsets(paddingKey.length, encrypted.length, uuid);
    return interleave(paddingKey, encrypted, offsets);
}
```

服务器反向操作：用 `uuid + state.no` 重算 offsets → 删 padding 字符 → base64 decode → XOR(50) → JSON.parse。

---

## 3. PC = HMAC-MD5 + 数字提取

```javascript
function hmacMD5(data, key) {
    // PX 自带 MD5 + HMAC, 见 src/reverse/pc.js
    // Node 内置等价：
    //   require('crypto').createHmac('md5', key).update(data).digest('hex')
}

function generatePC(events, uuid, tag, ft) {
    const data = serialize(events);
    const salt = uuid + ':' + tag + ':' + ft;
    const n = hmacMD5(data, salt);   // 32 hex 字符

    let digits = '', letters = '';
    for (let r = 0; r < n.length; r++) {
        const a = n.charCodeAt(r);
        if (a >= 48 && a <= 57) {
            digits += n[r];           // '0'-'9' 原样保留
        } else {
            letters += a % 10;         // 'a'-'f' -> ASCII mod 10
        }
    }
    const combined = digits + letters;
    let pc = '';
    for (let o = 0; o < combined.length; o += 2) {
        pc += combined[o];             // 间隔取偶数位
    }
    return pc;   // 16 位
}
```

算法本质：把 32 hex 拆成"原始数字" + "字母转数字"两段，拼起来后**间隔取偶数位**得到 16 位 PC。

---

## 4. OB 解码

```javascript
function ml(t) {
    // djb2 变种 with INT32_MAX 取模
    let e = 0;
    for (let n = 0; n < t.length; n++) {
        e = (31 * e + t.charCodeAt(n)) % 2147483647;
    }
    return (e % 900 + 100).toString();
}

function decodeOb(responseJson, gt) {
    const xorKey = parseInt(ml(gt), 10) % 128;
    const parsed = JSON.parse(responseJson);
    const ob = parsed.do || parsed.ob;
    if (!ob) return { state: {} };

    // 关键：用 'binary' 不能用 'utf-8' —— OB 是服务端 binary 编码
    const decoded = Buffer.from(ob, 'base64').toString('binary');
    const segments = xor(decoded, xorKey).split('~~~~');

    const state = {};
    for (const seg of segments) {
        const fields = seg.split('|');
        fields.shift();   // 丢弃 handler 字节（按 args 形状识别更稳定）
        const args = fields;

        // 按参数形状匹配 (跨 SDK 版本稳定)
        if (args.length === 1 && /^1[5-9]\d{11}$/.test(args[0])) {
            state.no = args[0];   // 13 位毫秒 timestamp
        } else if (args.length === 1 && /^[0-9a-f]{64}$/.test(args[0])) {
            state.qa = args[0];   // 64 hex challenge hash
        } else if (args.length === 1 && /^[a-f0-9-]{36}$/.test(args[0])) {
            state.pxsid = args[0];
        } else if (args.length === 1 && /^\d{16,}$/.test(args[0])) {
            state.to = args[0];   // anti-tamper 种子
        } else if (args.length === 1 && /^[a-z0-9]{12,30}$/.test(args[0])) {
            state.appId = args[0];
        } else if (args.length === 1 && /^[a-z]{2,4}$/.test(args[0])) {
            state.jf = args[0];
        } else if (args.length === 2 && /^[a-f0-9-]{36}$/.test(args[0])) {
            state.cts = args[0];
        } else if (args.length === 3 && /^[a-f0-9-]{36}$/.test(args[0])) {
            state.vid = args[0];
        } else if (args.length >= 4 && /^_?px/i.test(args[0])) {
            state.px_cookie = {
                name: args[0],
                ttl: parseInt(args[1]),
                value: args[2]
            };
        }
    }
    return { state };
}
```

完整 27 handler 表见 `references/handler-table.md`。

---

## 5. SID Unicode Tag Char 隐写

```javascript
function hh(t) {
    let result = '';
    for (let i = 0; i < t.length; i++) {
        // Plane 14 Tag Characters 起点 U+E0100
        result += String.fromCodePoint(0xE0100 + t.charCodeAt(i));
    }
    return result;
}

function generateSid(pxsid, serverTimestamp) {
    return pxsid + hh(String(serverTimestamp));
}
```

输出特征：
- 肉眼看 sid 长度 = 36（UUID 部分）
- 实际 UTF-8 字节数 = `36 + |state.no| * 4`（每个 Tag Char 占 4 字节 UTF-8）
- 典型值：`36 + 13 * 4 = 88` 字节

防御目的：终端 / 某些 HTTP 客户端会**丢失** Tag Characters，导致 sid 字节数变化 → 服务端识别为非浏览器。详见 `docs/zh/16_sid_steg.md`。

---

## 6. Anti-Tamper 动态 XOR

```javascript
const ANTI_TAMPER_RE = /^[0-9:;<=>?@]{15,25}$/;

function injectAntiTamper(events_d, state) {
    const stateNo = parseInt(state.no, 10);
    const key = te(state.to, stateNo % 10 + 2);
    const val = te(state.to, stateNo % 10 + 1);

    // 关键：重建字典保持原顺序（不能 delete + add）
    const newD = {};
    for (const k of Object.keys(events_d)) {
        if (ANTI_TAMPER_RE.test(k) && ANTI_TAMPER_RE.test(String(events_d[k]))) {
            newD[key] = val;
        } else {
            newD[k] = events_d[k];
        }
    }
    return newD;
}
```

字符范围解释：`state.to` 是纯数字 ASCII (0x30-0x39)，XOR (1-12) 后输出落在 0x30-0x40 范围，对应字符 `0-9:;<=>?@`。

完整威胁模型分析见 `docs/references/ANTI_TAMPER_FORMALISM.md`。

---

## 7. UUID v1 (RFC 4122)

标准 RFC 4122 v1。关键魔法常量：`122192928e5` = 1582-10-15 到 1970-01-01 的毫秒数。完整实现见 `src/reverse/uuid.js`。

---

## 8. djb2 hash 变体 (Kt)

```javascript
function Kt(t) {
    t = '' + t;
    let e = 0;
    for (let n = 0; n < t.length; n++) {
        e = (e << 5) - e + t.charCodeAt(n);
        e |= 0;   // 强制 int32
    }
    if (e < 0) e += 4294967296;
    return e.toString(16);
}

function generateHash(serverNo, vid) {
    const ao = Math.floor(parseInt(serverNo) / 1000);
    return Kt(Math.floor((ao * 2863) / vid.charCodeAt(9)));
}
```

`2863` 与 `vid.charCodeAt(9)` 是 PX 写死的魔法常量。

---

## 实测一致性验证

本仓库 `src/reverse/` 模块已通过 12 批样本（iFood 6 + Grubhub 6）round-trip 验证：

```bash
node src/scripts/verify_batch.js samples/ifood/{1..6}
PX_TAG="FmYgK1gdJEAP" node src/scripts/verify_batch.js samples/grubhub/{1..6}
```

期望输出：`6/6 batches round-trip clean`（两次）。任一失败 = 算法实现与 SDK 不一致 → bisect `src/reverse/`。

详见 `docs/references/REPRODUCIBILITY.md` § 6。

---

## 相关文档

- `docs/zh/04_algorithm_chain.md` — 同主题的项目主文档
- `docs/references/PROTOCOL_GRAMMAR.md` — 形式化 BNF 文法
- `docs/references/ANTI_TAMPER_FORMALISM.md` — Anti-tamper 威胁模型
- `references/locate-by-pattern.md` — 跨版本定位
- `references/handler-table.md` — OB handler 完整表
- `references/gotchas.md` — 14 大踩坑
