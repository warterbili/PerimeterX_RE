/**
 * PX payload 生成器 (Jf 函数)
 *
 * 还原自 main.js line 3128-3171 (Jf) + line 666-670 (ee) + line 226 (Q)
 *
 * ═══ 输入 ═══
 *   events:          Array  — 事件数组 (PX 收集的浏览器指纹/行为数据)
 *   serverTimestamp:  String — 服务器时间戳, 来自 ni() (ob response 或 collect response 返回)
 *                             首次请求传 null/undefined, 自动使用默认值 "1604064986000"
 *                             后续请求传 ob 响应中解出的 state.no
 *   uuid:            String — UUID v1, 来自 Xa()
 *
 * ═══ 输出 ═══
 *   String — 交织后的 payload 字符串, 可直接作为 POST 参数 payload= 的值
 *
 * ═══ 算法链 ═══
 *   1. json = serialize(events)              — PX 自定义 JSON 序列化 (it())
 *   2. xored = XOR(json, 50)                 — 逐字符异或 50
 *   3. b64 = base64(xored)                   — base64 编码 (Q())
 *   4. o = XOR(base64(serverTimestamp), 10)   — 交织 key, 20 chars
 *   5. offsets = getOffsets(o.length, b64.length, uuid) — 计算插入位置
 *   6. result = interleave(o, b64, offsets)   — 将 o 的字符插入 b64 中
 *
 * ═══ 解码 (逆向) ═══
 *   交织后 payload → 去交织 → base64 decode → XOR(50) → JSON
 *   去交织: 从后往前 splice(offsets[i]-1, 1)
 *
 * ═══ 默认时间戳 ═══
 *   首次请求 (Bundle #1 / 首个 collect) 时 ni() 返回 undefined,
 *   Jf 回退到 Wf() 字符串表中硬编码的 "1604064986000" (main.js:3110,3134)
 *   对应 2020-10-30T17:16:26Z — 不是真实时钟, 是 PX 脚本固定值
 *
 * 用法:
 *   const generatePayload = require('./payload')
 *   const payload = generatePayload(events, null, uuid)       // 首次请求
 *   const payload = generatePayload(events, state.no, uuid)   // 后续请求
 */

// ═══ serialize — PX 自定义 JSON 序列化 (main.js:299-329) ═══

const ESCAPE_RE = /[\\\"\u0000-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
const ESCAPE_MAP = {
    '\b': '\\b', '\t': '\\t', '\n': '\\n', '\f': '\\f',
    '\r': '\\r', '\v': '\\v', '"': '\\"', '\\': '\\\\'
};

function escapeChar(ch) {
    return ESCAPE_MAP[ch] || '\\u' + ('0000' + ch.charCodeAt(0).toString(16)).slice(-4);
}

function quoteString(t) {
    ESCAPE_RE.lastIndex = 0;
    return '"' + (ESCAPE_RE.test(t) ? t.replace(ESCAPE_RE, escapeChar) : t) + '"';
}

function serialize(e) {
    const type = typeof e;
    if (type === 'undefined') return '"undefined"';
    if (type === 'boolean') return String(e);
    if (type === 'number') {
        const r = String(e);
        return (r === 'NaN' || r === 'Infinity') ? 'null' : r;
    }
    if (type === 'string') return quoteString(e);
    if (e === null || e instanceof RegExp) return 'null';
    if (e instanceof Date)
        return ['"', e.getFullYear(), '-', e.getMonth() + 1, '-', e.getDate(),
                'T', e.getHours(), ':', e.getMinutes(), ':', e.getSeconds(),
                '.', e.getMilliseconds(), '"'].join('');
    if (Array.isArray(e)) {
        const n = ['['];
        for (let a = 0; a < e.length; a++)
            n.push(serialize(e[a]) || '"undefined"', ',');
        n[n.length > 1 ? n.length - 1 : n.length] = ']';
        return n.join('');
    }
    const n = ['{'];
    for (const o in e) {
        if (e.hasOwnProperty(o) && e[o] !== undefined)
            n.push(quoteString(o), ':', serialize(e[o]) || '"undefined"', ',');
    }
    n[n.length > 1 ? n.length - 1 : n.length] = '}';
    return n.join('');
}

// ═══ ee() — XOR 编解码 (main.js:666-670) ═══

function xor(t, key) {
    let r = '';
    for (let i = 0; i < t.length; i++) r += String.fromCharCode(t.charCodeAt(i) ^ key);
    return r;
}

// ═══ z() — base64 编码 (main.js:224-247) ═══
// SDK 的 z() 先做 encodeURIComponent (UTF-8 编码) 再 btoa
// 等价于 Buffer.from(str, 'utf-8').toString('base64')
// 注意: 不能用 'binary' (Latin-1), 否则 ≥0x80 的字符编码字节数不同

function b64encode(t) {
    return Buffer.from(t, 'utf-8').toString('base64');
}

function b64decode_utf8(t) {
    return Buffer.from(t, 'base64').toString('utf-8');
}

// ═══ Qf() — 线性缩放 (main.js:3126) ═══

function Qf(t, e, n, r, a) {
    return Math.floor((t - e) / (n - e) * (a - r) + r);
}

// ═══ getOffsets — 计算交织偏移量 (main.js:3138-3157) ═══
// paddingLen = o.length (交织 key 长度)
// payloadLen = base64 payload 长度
// uuid = UUID 字符串

function getOffsets(paddingLen, payloadLen, uuid) {
    const h = xor(b64encode(uuid), 10);
    let maxProduct = -1;

    for (let p = 0; p < paddingLen; p++) {
        const row = Math.floor(p / h.length) + 1;
        const col = p >= h.length ? p % h.length : p;
        const product = h.charCodeAt(col) * h.charCodeAt(row);
        if (product > maxProduct) maxProduct = product;
    }

    const offsets = [];
    for (let b = 0; b < paddingLen; b++) {
        const row = Math.floor(b / h.length) + 1;
        const col = b % h.length;
        let product = h.charCodeAt(col) * h.charCodeAt(row);
        if (product >= payloadLen) product = Qf(product, 0, maxProduct, 0, payloadLen - 1);
        while (offsets.indexOf(product) !== -1) product += 1;
        offsets.push(product);
    }

    return offsets.sort((a, b) => a - b);
}

// ═══ interleave — 将 key 字符插入 payload (main.js:3158-3169) ═══

function interleave(keyStr, payload, offsets) {
    let result = '', pos = 0;
    const chars = keyStr.split('');
    for (let u = 0; u < keyStr.length; u++) {
        result += payload.substring(pos, offsets[u] - u - 1) + chars[u];
        pos = offsets[u] - u - 1;
    }
    result += payload.substring(pos);
    return result;
}

// ═══ deInterleave — 去交织 (逆向) ═══

function deInterleave(payload, offsets) {
    let chars = payload.split('');
    for (let i = offsets.length - 1; i >= 0; i--)
        chars.splice(offsets[i] - 1, 1);
    return chars.join('');
}

// ═══ 默认时间戳 — 首次请求回退值 (main.js:3110 Wf 字符串表) ═══
const DEFAULT_TIMESTAMP = "1604064986000";

// ═══ generatePayload — 主入口 ═══

function generatePayload(events, serverTimestamp, uuid) {
    // 1. serialize → XOR(50) → base64
    const json = serialize(events);
    const encrypted = b64encode(xor(json, 50));

    // 2. 交织 key: XOR(base64(serverTimestamp || 默认值), 10)
    const ts = serverTimestamp || DEFAULT_TIMESTAMP;
    const o = xor(b64encode(String(ts)), 10);

    // 3. 计算偏移量
    const offsets = getOffsets(o.length, encrypted.length, uuid);

    // 4. 交织
    return interleave(o, encrypted, offsets);
}

// ═══ decodePayload — 解码入口 ═══
// serverTimestamp: 传入已知值, 或传 null 自动用默认值
//   首次请求 payload 用默认值 "1604064986000"
//   后续请求 payload 需传 ob 响应中的 state.no

function decodePayload(payload, serverTimestamp, uuid) {
    // 1. 交织 key
    const ts = serverTimestamp || DEFAULT_TIMESTAMP;
    const o = xor(b64encode(String(ts)), 10);

    // 2. 偏移量 (用交织前的 base64 长度, 和编码端一致)
    const b64Len = payload.length - o.length;
    const offsets = getOffsets(o.length, b64Len, uuid);

    // 3. 去交织
    const clean = deInterleave(payload, offsets);

    // 4. base64 decode (UTF-8) → XOR(50)
    const xoredStr = b64decode_utf8(clean);
    let json = '';
    for (let i = 0; i < xoredStr.length; i++)
        json += String.fromCharCode(xoredStr.charCodeAt(i) ^ 50);

    return JSON.parse(json);
}

module.exports = generatePayload;
module.exports.decodePayload = decodePayload;
module.exports.DEFAULT_TIMESTAMP = DEFAULT_TIMESTAMP;
