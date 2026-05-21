/**
 * PX pc (payload checksum) 生成器
 *
 * 还原自 main.js line 75-84 (R/HMAC-MD5) + line 299-329 (it/序列化) + line 596-609 (jt/数字提取)
 *
 * ═══ 输入 ═══
 *   events: Array — 事件数组 (PX collect payload 中的 events)
 *   uuid:   String — UUID v1, 如 "eb30dfdf-11c5-11f1-..."
 *   tag:    String — 固定值 "O2MKZn0OEhI/ag=="
 *   ft:     Number — bundle=388, collector=330
 *
 * ═══ 输出 ═══
 *   String — ~16 位纯数字字符串, 如 "9751268234020178"
 *
 * ═══ 算法链 ═══
 *   1. data = serialize(events)        — PX 自定义 JSON 序列化 (非标准 JSON.stringify!)
 *   2. salt = "uuid:tag:ft"
 *   3. hmac = HMAC-MD5(key=salt, data=data) → 32 hex chars
 *   4. 遍历 hmac 每个字符:
 *      - 数字 (0-9, ascii 48-57) → 保留到 digits
 *      - 字母 (a-f)              → charCode % 10 追加到 letters (a→7 b→8 c→9 d→0 e→1 f→2)
 *   5. 拼接: result = digits + letters
 *   6. 间隔取: pc = result[0] + result[2] + result[4] + ...
 *
 * ═══ 调用链 (main.js) ═══
 *   mh() line 4384 → h = jt(it(events), [ka(), e[bn], e[En]].join(":"))
 *                         ↑ jt  ↑ it       uuid   tag    ft
 *
 * 用法:
 *   const generatePC = require('./pc')
 *   const pc = generatePC(events, uuid, tag, ft)
 */

// ═══════════════════════════════════════
//  MD5 核心 (main.js line 69-206)
// ═══════════════════════════════════════

// w() — 32-bit words → binary string (line 69)
function w(t) {
    let n = '';
    for (let e = 0; e < 32 * t.length; e += 8)
        n += String.fromCharCode(t[e >> 5] >>> e % 32 & 255);
    return n;
}

// N() — safe 32-bit add (line 186)
function N(t, e) {
    const n = (65535 & t) + (65535 & e);
    return (t >> 16) + (e >> 16) + (n >> 16) << 16 | 65535 & n;
}

// X() — MD5 基础变换 (line 179)
function X(t, e, n, r, a, o) {
    const i = N(N(e, t), N(r, o));
    return N(i << a | i >>> 32 - a, n);
}

// k() — Round 1: F(b,c,d) = (b & c) | (~b & d) (line 176)
function k(t, e, n, r, a, o, i) {
    return X(e & n | ~e & r, t, e, a, o, i);
}

// P() — Round 2: G(b,c,d) = (b & d) | (c & ~d) (line 207)
function P(t, e, n, r, a, o, i) {
    return X(e & r | n & ~r, t, e, a, o, i);
}

// x() — Round 3: H(b,c,d) = b ^ c ^ d (line 164)
function x(t, e, n, r, a, o, i) {
    return X(e ^ n ^ r, t, e, a, o, i);
}

// C() — Round 4: I(b,c,d) = c ^ (b | ~d) (line 85)
function C(t, e, n, r, a, o, i) {
    return X(n ^ (e | ~r), t, e, a, o, i);
}

// B() — string → 32-bit word array (line 167)
function B(t) {
    const n = [];
    n[(t.length >> 2) - 1] = void 0;
    for (let e = 0; e < n.length; e++) n[e] = 0;
    for (let e = 0; e < 8 * t.length; e += 8)
        n[e >> 5] |= (255 & t.charCodeAt(e / 8)) << e % 32;
    return n;
}

// O() — UTF-8 encode (line 183)
function O(t) {
    return unescape(encodeURIComponent(t));
}

// M() — MD5 核心变换 (line 88-163)
function M(t, e) {
    t[e >> 5] |= 128 << e % 32;
    t[14 + (e + 64 >>> 9 << 4)] = e;
    let n, r, a, o, i, c = 1732584193, u = -271733879, s = -1732584194, f = 271733878;
    for (n = 0; n < t.length; n += 16) {
        r = c; a = u; o = s; i = f;
        c = k(c, u, s, f, t[n], 7, -680876936);
        f = k(f, c, u, s, t[n + 1], 12, -389564586);
        s = k(s, f, c, u, t[n + 2], 17, 606105819);
        u = k(u, s, f, c, t[n + 3], 22, -1044525330);
        c = k(c, u, s, f, t[n + 4], 7, -176418897);
        f = k(f, c, u, s, t[n + 5], 12, 1200080426);
        s = k(s, f, c, u, t[n + 6], 17, -1473231341);
        u = k(u, s, f, c, t[n + 7], 22, -45705983);
        c = k(c, u, s, f, t[n + 8], 7, 1770035416);
        f = k(f, c, u, s, t[n + 9], 12, -1958414417);
        s = k(s, f, c, u, t[n + 10], 17, -42063);
        u = k(u, s, f, c, t[n + 11], 22, -1990404162);
        c = k(c, u, s, f, t[n + 12], 7, 1804603682);
        f = k(f, c, u, s, t[n + 13], 12, -40341101);
        s = k(s, f, c, u, t[n + 14], 17, -1502002290);
        c = P(c, u = k(u, s, f, c, t[n + 15], 22, 1236535329), s, f, t[n + 1], 5, -165796510);
        f = P(f, c, u, s, t[n + 6], 9, -1069501632);
        s = P(s, f, c, u, t[n + 11], 14, 643717713);
        u = P(u, s, f, c, t[n], 20, -373897302);
        c = P(c, u, s, f, t[n + 5], 5, -701558691);
        f = P(f, c, u, s, t[n + 10], 9, 38016083);
        s = P(s, f, c, u, t[n + 15], 14, -660478335);
        u = P(u, s, f, c, t[n + 4], 20, -405537848);
        c = P(c, u, s, f, t[n + 9], 5, 568446438);
        f = P(f, c, u, s, t[n + 14], 9, -1019803690);
        s = P(s, f, c, u, t[n + 3], 14, -187363961);
        u = P(u, s, f, c, t[n + 8], 20, 1163531501);
        c = P(c, u, s, f, t[n + 13], 5, -1444681467);
        f = P(f, c, u, s, t[n + 2], 9, -51403784);
        s = P(s, f, c, u, t[n + 7], 14, 1735328473);
        c = x(c, u = P(u, s, f, c, t[n + 12], 20, -1926607734), s, f, t[n + 5], 4, -378558);
        f = x(f, c, u, s, t[n + 8], 11, -2022574463);
        s = x(s, f, c, u, t[n + 11], 16, 1839030562);
        u = x(u, s, f, c, t[n + 14], 23, -35309556);
        c = x(c, u, s, f, t[n + 1], 4, -1530992060);
        f = x(f, c, u, s, t[n + 4], 11, 1272893353);
        s = x(s, f, c, u, t[n + 7], 16, -155497632);
        u = x(u, s, f, c, t[n + 10], 23, -1094730640);
        c = x(c, u, s, f, t[n + 13], 4, 681279174);
        f = x(f, c, u, s, t[n], 11, -358537222);
        s = x(s, f, c, u, t[n + 3], 16, -722521979);
        u = x(u, s, f, c, t[n + 6], 23, 76029189);
        c = x(c, u, s, f, t[n + 9], 4, -640364487);
        f = x(f, c, u, s, t[n + 12], 11, -421815835);
        s = x(s, f, c, u, t[n + 15], 16, 530742520);
        c = C(c, u = x(u, s, f, c, t[n + 2], 23, -995338651), s, f, t[n], 6, -198630844);
        f = C(f, c, u, s, t[n + 7], 10, 1126891415);
        s = C(s, f, c, u, t[n + 14], 15, -1416354905);
        u = C(u, s, f, c, t[n + 5], 21, -57434055);
        c = C(c, u, s, f, t[n + 12], 6, 1700485571);
        f = C(f, c, u, s, t[n + 3], 10, -1894986606);
        s = C(s, f, c, u, t[n + 10], 15, -1051523);
        u = C(u, s, f, c, t[n + 1], 21, -2054922799);
        c = C(c, u, s, f, t[n + 8], 6, 1873313359);
        f = C(f, c, u, s, t[n + 15], 10, -30611744);
        s = C(s, f, c, u, t[n + 6], 15, -1560198380);
        u = C(u, s, f, c, t[n + 13], 21, 1309151649);
        c = C(c, u, s, f, t[n + 4], 6, -145523070);
        f = C(f, c, u, s, t[n + 11], 10, -1120210379);
        s = C(s, f, c, u, t[n + 2], 15, 718787259);
        u = C(u, s, f, c, t[n + 9], 21, -343485551);
        c = N(c, r); u = N(u, a); s = N(s, o); f = N(f, i);
    }
    return [c, u, s, f];
}

// U() — binary string → hex string (line 210)
function U(t) {
    const hex = '0123456789abcdef';
    let a = '';
    for (let n = 0; n < t.length; n++) {
        const e = t.charCodeAt(n);
        a += hex.charAt(e >>> 4 & 15) + hex.charAt(15 & e);
    }
    return a;
}

// ═══════════════════════════════════════
//  R() — MD5 / HMAC-MD5 (main.js line 75-84)
// ═══════════════════════════════════════

/**
 * MD5 / HMAC-MD5
 *
 * 输入:
 *   data: String — 待哈希的数据
 *   key:  String — HMAC 密钥 (可选, 不传=普通MD5)
 *   raw:  Boolean — true 返回 binary, false 返回 hex (可选, 默认 false)
 *
 * 输出:
 *   String — 32 hex chars (raw=false) 或 16 bytes binary string (raw=true)
 */
function hmacMD5(data, key, raw) {
    if (!key) return raw ? md5Raw(data) : U(md5Raw(data));
    if (!raw) return U(hmacMD5Raw(key, data));
    return hmacMD5Raw(key, data);
}

// V() — 普通 MD5 → binary string (line 202)
function md5Raw(t) {
    return w(M(B(O(t)), 8 * O(t).length));
}

// F() — HMAC-MD5 → binary string (line 190)
function hmacMD5Raw(key, data) {
    const t = O(key), e = O(data);
    const r = B(t);
    const a = [], o = [];
    a[15] = o[15] = void 0;
    if (r.length > 16) {
        const padded = M(r, 8 * t.length);
        for (let n = 0; n < 16; n++) { a[n] = 909522486 ^ padded[n]; o[n] = 1549556828 ^ padded[n]; }
    } else {
        for (let n = 0; n < 16; n++) { a[n] = 909522486 ^ r[n]; o[n] = 1549556828 ^ r[n]; }
    }
    const i = M(a.concat(B(e)), 512 + 8 * e.length);
    return w(M(o.concat(i), 640));
}

// ═══════════════════════════════════════
//  jt() → generatePC (main.js line 596-609)
// ═══════════════════════════════════════

// 常量 (main.js line 590-592)
const DIGIT_LOW  = 48;  // '0' ascii — Dt
const DIGIT_HIGH = 57;  // '9' ascii — Gt
const MOD_BASE   = 10;  // Ht

/**
 * 生成 pc 校验值
 *
 * @param {Array} events — 事件数组
 * @param {String} uuid — UUID v1
 * @param {String} tag — 固定值 "O2MKZn0OEhI/ag=="
 * @param {Number} ft — bundle=388, collector=330
 * @returns {String} ~16 位纯数字字符串
 */
function generatePC(events, uuid, tag, ft) {
    const data = serialize(events);
    const salt = uuid + ':' + tag + ':' + ft;
    const n = hmacMD5(data, salt);  // 32 hex chars

    // 分离数字和字母→数字
    let digits = '';
    let letters = '';
    for (let r = 0; r < n.length; r++) {
        const a = n.charCodeAt(r);
        if (a >= DIGIT_LOW && a <= DIGIT_HIGH)
            digits += n[r];           // '0'-'9' 直接保留
        else
            letters += a % MOD_BASE;  // 'a'→7, 'b'→8, 'c'→9, 'd'→0, 'e'→1, 'f'→2
    }
    const combined = digits + letters;

    // 间隔取: [0], [2], [4], ...
    let pc = '';
    for (let o = 0; o < combined.length; o += 2)
        pc += combined[o];

    return pc;
}

// ═══════════════════════════════════════
//  it() → serialize (main.js line 299-329)
//  PX 自定义 JSON 序列化 (非标准 JSON.stringify)
// ═══════════════════════════════════════

const ESCAPE_RE = /[\\\"\u0000-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
const ESCAPE_MAP = {
    '\b': '\\b', '\t': '\\t', '\n': '\\n', '\f': '\\f',
    '\r': '\\r', '\v': '\\v', '"': '\\"', '\\': '\\\\'
};

function escapeChar(ch) {
    return ESCAPE_MAP[ch] || '\\u' + ('0000' + ch.charCodeAt(0).toString(16)).slice(-4);
}

// ut() — 引号包裹 + 转义 (line 355)
function quoteString(t) {
    ESCAPE_RE.lastIndex = 0;
    return '"' + (ESCAPE_RE.test(t) ? t.replace(ESCAPE_RE, escapeChar) : t) + '"';
}

/**
 * PX 自定义 JSON 序列化
 *
 * 输入:
 *   value: Any — 要序列化的值 (通常是 events 数组)
 *
 * 输出:
 *   String — 类 JSON 字符串, 与标准 JSON.stringify 的差异:
 *            - undefined → "undefined" (带引号)
 *            - NaN/Infinity → "null"
 *            - RegExp → "null"
 *            - Date → "YYYY-M-DTHHH:MM:SS.mmm" (无补零)
 *            - 属性值为 undefined 的 key 不跳过 (输出 "undefined")
 *
 * 注意: pc 校验值依赖此函数的精确输出, 不能用 JSON.stringify 替代!
 */
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

    // Object
    const n = ['{'];
    for (const o in e) {
        if (e.hasOwnProperty(o) && e[o] !== undefined)
            n.push(quoteString(o), ':', serialize(e[o]) || '"undefined"', ',');
    }
    n[n.length > 1 ? n.length - 1 : n.length] = '}';
    return n.join('');
}

module.exports = generatePC;
module.exports.hmacMD5 = hmacMD5;
