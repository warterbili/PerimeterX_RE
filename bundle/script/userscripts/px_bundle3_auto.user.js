// ==UserScript==
// @name         PX Bundle3 Auto
// @namespace    px-reverse
// @version      1.0.0
// @description  自动拦截 B1/B2, 构造 B3 并发送
// @match        https://www.ifood.com.br/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
'use strict';

var LOG_PREFIX = '[PX-AUTO]';
function log() { var a = [LOG_PREFIX].concat(Array.prototype.slice.call(arguments)); console.log.apply(console, a); }
function warn() { var a = [LOG_PREFIX].concat(Array.prototype.slice.call(arguments)); console.warn.apply(console, a); }
function err() { var a = [LOG_PREFIX].concat(Array.prototype.slice.call(arguments)); console.error.apply(console, a); }

log('脚本已加载, 等待 PX 请求...');

// ═══════════════════════════════════════════════════════════════════
// Part 1: 纯 JS SHA256 (同步, PoW 用)
// ═══════════════════════════════════════════════════════════════════

var SHA256_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function sha256(str) {
    // UTF-8 encode
    var msg = unescape(encodeURIComponent(str));
    var msgLen = msg.length;
    var bytes = [];
    for (var i = 0; i < msgLen; i++) bytes.push(msg.charCodeAt(i));

    // Padding
    bytes.push(0x80);
    var bitLen = msgLen * 8;
    while (bytes.length % 64 !== 56) bytes.push(0);
    // Length in bits (big-endian, 64-bit)
    for (var s = 56; s >= 0; s -= 8) bytes.push((bitLen / Math.pow(2, s)) & 0xff);

    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var W = new Array(64);

    for (var bi = 0; bi < bytes.length; bi += 64) {
        for (var t = 0; t < 16; t++)
            W[t] = (bytes[bi + t*4] << 24) | (bytes[bi + t*4+1] << 16) | (bytes[bi + t*4+2] << 8) | bytes[bi + t*4+3];
        for (var t = 16; t < 64; t++) {
            var s0 = (((W[t-15] >>> 7) | (W[t-15] << 25)) ^ ((W[t-15] >>> 18) | (W[t-15] << 14)) ^ (W[t-15] >>> 3)) | 0;
            var s1 = (((W[t-2] >>> 17) | (W[t-2] << 15)) ^ ((W[t-2] >>> 19) | (W[t-2] << 13)) ^ (W[t-2] >>> 10)) | 0;
            W[t] = (W[t-16] + s0 + W[t-7] + s1) | 0;
        }
        var a=H[0], b=H[1], c=H[2], d=H[3], e=H[4], f=H[5], g=H[6], h=H[7];
        for (var t = 0; t < 64; t++) {
            var S1 = (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) | 0;
            var ch = ((e & f) ^ (~e & g)) | 0;
            var temp1 = (h + S1 + ch + SHA256_K[t] + W[t]) | 0;
            var S0 = (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) | 0;
            var maj = ((a & b) ^ (a & c) ^ (b & c)) | 0;
            var temp2 = (S0 + maj) | 0;
            h=g; g=f; f=e; e=(d+temp1)|0; d=c; c=b; b=a; a=(temp1+temp2)|0;
        }
        H[0]=(H[0]+a)|0; H[1]=(H[1]+b)|0; H[2]=(H[2]+c)|0; H[3]=(H[3]+d)|0;
        H[4]=(H[4]+e)|0; H[5]=(H[5]+f)|0; H[6]=(H[6]+g)|0; H[7]=(H[7]+h)|0;
    }
    var hex = '';
    for (var i = 0; i < 8; i++)
        hex += ('00000000' + (H[i] >>> 0).toString(16)).slice(-8);
    return hex;
}

// ═══════════════════════════════════════════════════════════════════
// Part 2: 内嵌逆向模块 (浏览器适配)
// ═══════════════════════════════════════════════════════════════════

// ── ob.js ──

function ml(t) {
    var e = 0;
    for (var n = 0; n < t.length; n++)
        e = (31 * e + t.charCodeAt(n)) % 2147483647;
    return (e % 900 + 100).toString();
}

function xorStr(t, key) {
    var n = '';
    for (var i = 0; i < t.length; i++)
        n += String.fromCharCode(t.charCodeAt(i) ^ key);
    return n;
}

function solvePow(targetHash, suffix, difficulty) {
    difficulty = +difficulty || 16;
    var start = Date.now();
    var m = Math.ceil(difficulty / 4);
    var mask = (1 << (4 * m)) - 1;
    var lastHex = parseInt('0x' + suffix.charAt(suffix.length - 1), 16);
    var prefix = suffix.slice(0, -1);
    var max = 1 << difficulty;
    for (var r = 0; r < max; r++) {
        var low = ('0'.repeat(m) + (r & mask).toString(16)).slice(-m);
        var candidate = prefix + (lastHex + (r >> (m << 2))).toString(16) + low;
        if (sha256(candidate) === targetHash)
            return { answer: candidate, counter: r, elapsed: Date.now() - start };
    }
    return null;
}

function decodeOb(responseJson, gt) {
    var xorKey = parseInt(ml(gt), 10) % 128;
    var parsed = typeof responseJson === 'string' ? JSON.parse(responseJson) : responseJson;
    var obValue = parsed.do || parsed.ob;
    if (!obValue) return { xorKey: xorKey, segments: [] };
    var decoded = atob(obValue);
    var segments = xorStr(decoded, xorKey).split('~~~~');
    return { xorKey: xorKey, segments: segments };
}

var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function hh(t) {
    var r = '';
    for (var i = 0; i < t.length; i++)
        r += String.fromCodePoint(0xE0100 + t.charCodeAt(i));
    return r;
}

var HANDLER_RULES = [
    {
        name: 'set_cookie',
        match: function(args) { return args.length >= 4 && /^_?px/i.test(args[0]); },
        exec: function(state, args) {
            state.px3 = { name: args[0], value: args[2], ttl: +args[1], secure: args[3] === "true", maxAge: +args[4] };
            return { type: 'set_cookie', name: args[0], value: args[2], ttl: +args[1] };
        }
    },
    {
        name: 'pow_start',
        match: function(args) { return args.length === 5 && (args[0] === "1" || args[0] === "0") && /^[0-9a-f]{64}$/.test(args[2]) && /^\d{1,3}$/.test(args[3]); },
        exec: function(state, args) {
            if (args[0] !== "1") return { type: 'pow', enabled: false };
            var pow = solvePow(args[2], args[1], +args[3]);
            return { type: 'pow', enabled: true, suffix: args[1], targetHash: args[2], difficulty: +args[3], isTrusted: args[4] === "true", pow: pow };
        }
    },
    {
        name: 'pow_challenge',
        match: function(args) { return args.length >= 6 && (args[0] === "1" || args[0] === "0") && /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(args[1]); },
        exec: function(state, args) {
            if (args[0] !== "1") return { type: 'pow_challenge', enabled: false };
            var parts = (args[3] || "").split("_");
            if (parts.length !== 2) return { type: 'pow_challenge', error: 'bad challenge format' };
            var hash = parts[0];
            var suffix = '';
            for (var i = 0; i < parts[1].length; i++) suffix += String.fromCharCode(parts[1].charCodeAt(i) ^ 10);
            state.powUuid = args[1];
            return { type: 'pow_challenge', uuid: args[1], port: +args[2], hash: hash, suffix: suffix, extra: +args[4], tag: args[5] };
        }
    },
    {
        name: 'visual_challenge',
        match: function(args) { return args.length === 5 && /^\d{1,4}$/.test(args[0]) && /^\d{1,4}$/.test(args[1]) && /^[0-9a-f]{64}$/.test(args[4]); },
        exec: function(state, args) {
            return { type: 'visual_challenge', startWidth: +args[0], startHeight: +args[1], widthJump: +args[2], heightJump: +args[3], hash: args[4] };
        }
    },
    {
        name: 'timestamp',
        match: function(args) { return args.length === 1 && /^1[5-9]\d{11}$/.test(args[0]); },
        exec: function(state, args) { state.no = args[0]; state.ro = Math.floor(parseInt(args[0]) / 1000); }
    },
    {
        name: 'challenge_hash',
        match: function(args) { return args.length === 1 && /^[0-9a-f]{64}$/.test(args[0]); },
        exec: function(state, args) { state.qa = args[0]; }
    },
    {
        name: 'vid',
        match: function(args) { return args.length === 3 && UUID_RE.test(args[0]) && /^\d+$/.test(args[1]); },
        exec: function(state, args) { state.vid = args[0]; return { type: 'vid', value: args[0] }; }
    },
    {
        name: 'cts',
        match: function(args) { return args.length === 2 && UUID_RE.test(args[0]); },
        exec: function(state, args) { state.cts = args[0]; return { type: 'cts', value: args[0] }; }
    },
    {
        name: 'pxsid',
        match: function(args) { return args.length === 1 && UUID_RE.test(args[0]); },
        exec: function(state, args) { state.pxsid = args[0]; return { type: 'pxsid', value: args[0] }; }
    },
    {
        name: 'session_id',
        match: function(args) { return (args.length === 1 || args.length === 2) && /^\d{16,}$/.test(args[0]); },
        exec: function(state, args) { state.to = args[0]; state.eo = args[1] || null; }
    },
    {
        name: 'status_code',
        match: function(args) { return args.length === 1 && /^\d{3}$/.test(args[0]); },
        exec: function(state, args) { state.ao = args[0]; }
    },
    {
        name: 'app_id',
        match: function(args) { return args.length === 1 && /^[a-z0-9]{12,30}$/.test(args[0]); },
        exec: function(state, args) { state.appId = args[0]; }
    },
    {
        name: 'control_flag',
        match: function(args) { return args.length === 1 && /^[a-z]{2,4}$/.test(args[0]); },
        exec: function(state, args) { state.jf = args[0]; }
    },
    {
        name: 'feature_flags',
        match: function(args) { return args.length === 1 && /^[a-z]+:\d+(,[a-z]+:\d+)*$/.test(args[0]); },
        exec: function(state, args) {
            var items = {};
            args[0].split(",").forEach(function(item) { var kv = item.split(":"); if (kv[0]) items[kv[0]] = kv[1]; });
            state.features = Object.assign(state.features || {}, items);
            return { type: 'feature_flags', items: items };
        }
    },
    {
        name: 'cookie_config',
        match: function(args) { return (args.length === 3 || args.length === 4) && /^[a-zA-Z0-9_\-]{1,30}$/.test(args[0]) && /^\d+$/.test(args[1]); },
        exec: function(state, args) {
            state.cookies = state.cookies || {};
            state.cookies[args[0]] = { ttl: +args[1], value: args[2] };
            return { type: 'cookie_config', name: args[0], ttl: +args[1], value: args[2] };
        }
    },
    {
        name: 'storage_ttl',
        match: function(args) { return args.length === 5 && /^\d+$/.test(args[1]); },
        exec: function(state, args) { return { type: 'storage_ttl', key: args[0], ttl: args[1] }; }
    },
    {
        name: 'captcha_control',
        match: function(args) { return args.length === 1 && /^-?\d{1,3}$/.test(args[0]) && Math.abs(+args[0]) <= 100; },
        exec: function(state, args) { state.captchaSignal = +args[0]; return { type: 'captcha_control', signal: +args[0] }; }
    },
    {
        name: 'config_number',
        match: function(args) { return args.length === 1 && /^\d{4,6}$/.test(args[0]); },
        exec: function(state, args) { state.configNum = +args[0]; return { type: 'config_number', value: +args[0] }; }
    },
    {
        name: 'noop',
        match: function(args) { return args.length === 0; },
        exec: function() { return { type: 'noop' }; }
    }
];

function executeSegments(segments, state) {
    var deferred = null;
    var queue = [];
    for (var i = 0; i < segments.length; i++) {
        var seg = segments[i];
        if (!seg) continue;
        var fields = seg.split('|');
        var key = fields.shift();
        if (fields[0] === 'cc') { deferred = { key: key, args: fields }; continue; }
        queue.push({ key: key, args: fields });
    }
    if (deferred) queue.unshift(deferred);

    var results = [];
    for (var j = 0; j < queue.length; j++) {
        var item = queue[j];
        var rule = null;
        for (var k = 0; k < HANDLER_RULES.length; k++) {
            if (HANDLER_RULES[k].match(item.args)) { rule = HANDLER_RULES[k]; break; }
        }
        if (!rule) { results.push({ handler: item.key, handlerType: 'unknown', args: item.args }); continue; }
        try {
            var result = rule.exec(state, item.args);
            results.push({ handler: item.key, handlerType: rule.name, args: item.args, result: result });
        } catch(e) {
            results.push({ handler: item.key, handlerType: rule.name, args: item.args, error: e.message });
        }
    }
    return results;
}

// ── 写入 _px3 cookie + localStorage ──
function writePx3Cookie(px3Info) {
    var name = px3Info.name || '_px3';
    var value = px3Info.value;
    var maxAge = px3Info.maxAge || 300;
    var secure = px3Info.secure !== false;
    if (!value) return;

    // 写入 document.cookie
    var cookie = name + '=' + value + '; path=/; max-age=' + maxAge + '; SameSite=Lax';
    if (secure) cookie += '; Secure';
    document.cookie = cookie;
    log('[COOKIE] 写入 ' + name + ' (len=' + value.length + ', maxAge=' + maxAge + ')');

    // 同步写入 localStorage (PX SDK 也会读取)
    try {
        var lsKey = 'x-px-cookies';
        var lsData = {};
        try { lsData = JSON.parse(localStorage.getItem(lsKey) || '{}'); } catch(e) {}
        lsData[name] = { value: value, expiry: Date.now() + maxAge * 1000 };
        localStorage.setItem(lsKey, JSON.stringify(lsData));
        log('[COOKIE] 同步写入 localStorage["' + lsKey + '"]');
    } catch(e) {
        warn('[COOKIE] localStorage 写入失败:', e.message);
    }
}

function processOb(responseJson, gt) {
    var dec = decodeOb(responseJson, gt);
    var state = {};
    var results = executeSegments(dec.segments, state);
    return { xorKey: dec.xorKey, segments: dec.segments, results: results, state: state };
}

// ── payload.js (浏览器适配: btoa/atob 替代 Buffer) ──

var ESCAPE_RE_PL = new RegExp('[\\\"\x00-\x1f\x7f-\x9f\xad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]', 'g');
var ESCAPE_MAP_PL = { '\b': '\\b', '\t': '\\t', '\n': '\\n', '\f': '\\f', '\r': '\\r', '\v': '\\v', '"': '\\"', '\\': '\\\\' };

function escapeCharPL(ch) { return ESCAPE_MAP_PL[ch] || '\\u' + ('0000' + ch.charCodeAt(0).toString(16)).slice(-4); }
function quoteStringPL(t) { ESCAPE_RE_PL.lastIndex = 0; return '"' + (ESCAPE_RE_PL.test(t) ? t.replace(ESCAPE_RE_PL, escapeCharPL) : t) + '"'; }

function serialize(e) {
    var type = typeof e;
    if (type === 'undefined') return '"undefined"';
    if (type === 'boolean') return String(e);
    if (type === 'number') { var r = String(e); return (r === 'NaN' || r === 'Infinity') ? 'null' : r; }
    if (type === 'string') return quoteStringPL(e);
    if (e === null || e instanceof RegExp) return 'null';
    if (e instanceof Date)
        return ['"', e.getFullYear(), '-', e.getMonth()+1, '-', e.getDate(), 'T', e.getHours(), ':', e.getMinutes(), ':', e.getSeconds(), '.', e.getMilliseconds(), '"'].join('');
    if (Array.isArray(e)) {
        var n = ['['];
        for (var a = 0; a < e.length; a++) n.push(serialize(e[a]) || '"undefined"', ',');
        n[n.length > 1 ? n.length - 1 : n.length] = ']';
        return n.join('');
    }
    var n2 = ['{'];
    for (var o in e) {
        if (e.hasOwnProperty(o) && e[o] !== undefined)
            n2.push(quoteStringPL(o), ':', serialize(e[o]) || '"undefined"', ',');
    }
    n2[n2.length > 1 ? n2.length - 1 : n2.length] = '}';
    return n2.join('');
}

function b64encode(t) {
    // 等效 SDK 的 z(): encodeURIComponent (UTF-8) → btoa
    return btoa(encodeURIComponent(t).replace(/%([0-9A-F]{2})/g, function(_, p1) {
        return String.fromCharCode('0x' + p1);
    }));
}
function b64decode_str(t) { return atob(t); }

function Qf(t, e, n, r, a) { return Math.floor((t - e) / (n - e) * (a - r) + r); }

function getOffsets(paddingLen, payloadLen, uuid) {
    var h = xorStr(b64encode(uuid), 10);
    var maxProduct = -1;
    for (var p = 0; p < paddingLen; p++) {
        var row = Math.floor(p / h.length) + 1;
        var col = p >= h.length ? p % h.length : p;
        var product = h.charCodeAt(col) * h.charCodeAt(row);
        if (product > maxProduct) maxProduct = product;
    }
    var offsets = [];
    for (var b = 0; b < paddingLen; b++) {
        var row = Math.floor(b / h.length) + 1;
        var col = b % h.length;
        var product = h.charCodeAt(col) * h.charCodeAt(row);
        if (product >= payloadLen) product = Qf(product, 0, maxProduct, 0, payloadLen - 1);
        while (offsets.indexOf(product) !== -1) product += 1;
        offsets.push(product);
    }
    return offsets.sort(function(a, b) { return a - b; });
}

function interleave(keyStr, payload, offsets) {
    var result = '', pos = 0;
    var chars = keyStr.split('');
    for (var u = 0; u < keyStr.length; u++) {
        result += payload.substring(pos, offsets[u] - u - 1) + chars[u];
        pos = offsets[u] - u - 1;
    }
    result += payload.substring(pos);
    return result;
}

var DEFAULT_TIMESTAMP = "1604064986000";

function generatePayload(events, serverTimestamp, uuid) {
    var json = serialize(events);
    var encrypted = b64encode(xorStr(json, 50));
    var ts = serverTimestamp || DEFAULT_TIMESTAMP;
    var o = xorStr(b64encode(String(ts)), 10);
    var offsets = getOffsets(o.length, encrypted.length, uuid);
    return interleave(o, encrypted, offsets);
}

// ── pc.js (纯 JS, 无改动) ──

function w_md5(t) { var n=''; for(var e=0;e<32*t.length;e+=8) n+=String.fromCharCode(t[e>>5]>>>e%32&255); return n; }
function N_md5(t,e) { var n=(65535&t)+(65535&e); return(t>>16)+(e>>16)+(n>>16)<<16|65535&n; }
function X_md5(t,e,n,r,a,o) { var i=N_md5(N_md5(e,t),N_md5(r,o)); return N_md5(i<<a|i>>>32-a,n); }
function k_md5(t,e,n,r,a,o,i) { return X_md5(e&n|~e&r,t,e,a,o,i); }
function P_md5(t,e,n,r,a,o,i) { return X_md5(e&r|n&~r,t,e,a,o,i); }
function x_md5(t,e,n,r,a,o,i) { return X_md5(e^n^r,t,e,a,o,i); }
function C_md5(t,e,n,r,a,o,i) { return X_md5(n^(e|~r),t,e,a,o,i); }
function B_md5(t) { var n=[]; n[(t.length>>2)-1]=void 0; for(var e=0;e<n.length;e++) n[e]=0; for(var e=0;e<8*t.length;e+=8) n[e>>5]|=(255&t.charCodeAt(e/8))<<e%32; return n; }
function O_md5(t) { return unescape(encodeURIComponent(t)); }

function M_md5(t,e) {
    t[e>>5]|=128<<e%32; t[14+(e+64>>>9<<4)]=e;
    var n,r,a,o,i,c=1732584193,u=-271733879,s=-1732584194,f=271733878;
    for(n=0;n<t.length;n+=16) {
        r=c;a=u;o=s;i=f;
        c=k_md5(c,u,s,f,t[n],7,-680876936); f=k_md5(f,c,u,s,t[n+1],12,-389564586);
        s=k_md5(s,f,c,u,t[n+2],17,606105819); u=k_md5(u,s,f,c,t[n+3],22,-1044525330);
        c=k_md5(c,u,s,f,t[n+4],7,-176418897); f=k_md5(f,c,u,s,t[n+5],12,1200080426);
        s=k_md5(s,f,c,u,t[n+6],17,-1473231341); u=k_md5(u,s,f,c,t[n+7],22,-45705983);
        c=k_md5(c,u,s,f,t[n+8],7,1770035416); f=k_md5(f,c,u,s,t[n+9],12,-1958414417);
        s=k_md5(s,f,c,u,t[n+10],17,-42063); u=k_md5(u,s,f,c,t[n+11],22,-1990404162);
        c=k_md5(c,u,s,f,t[n+12],7,1804603682); f=k_md5(f,c,u,s,t[n+13],12,-40341101);
        s=k_md5(s,f,c,u,t[n+14],17,-1502002290);
        c=P_md5(c,u=k_md5(u,s,f,c,t[n+15],22,1236535329),s,f,t[n+1],5,-165796510);
        f=P_md5(f,c,u,s,t[n+6],9,-1069501632); s=P_md5(s,f,c,u,t[n+11],14,643717713);
        u=P_md5(u,s,f,c,t[n],20,-373897302); c=P_md5(c,u,s,f,t[n+5],5,-701558691);
        f=P_md5(f,c,u,s,t[n+10],9,38016083); s=P_md5(s,f,c,u,t[n+15],14,-660478335);
        u=P_md5(u,s,f,c,t[n+4],20,-405537848); c=P_md5(c,u,s,f,t[n+9],5,568446438);
        f=P_md5(f,c,u,s,t[n+14],9,-1019803690); s=P_md5(s,f,c,u,t[n+3],14,-187363961);
        u=P_md5(u,s,f,c,t[n+8],20,1163531501); c=P_md5(c,u,s,f,t[n+13],5,-1444681467);
        f=P_md5(f,c,u,s,t[n+2],9,-51403784); s=P_md5(s,f,c,u,t[n+7],14,1735328473);
        c=x_md5(c,u=P_md5(u,s,f,c,t[n+12],20,-1926607734),s,f,t[n+5],4,-378558);
        f=x_md5(f,c,u,s,t[n+8],11,-2022574463); s=x_md5(s,f,c,u,t[n+11],16,1839030562);
        u=x_md5(u,s,f,c,t[n+14],23,-35309556); c=x_md5(c,u,s,f,t[n+1],4,-1530992060);
        f=x_md5(f,c,u,s,t[n+4],11,1272893353); s=x_md5(s,f,c,u,t[n+7],16,-155497632);
        u=x_md5(u,s,f,c,t[n+10],23,-1094730640); c=x_md5(c,u,s,f,t[n+13],4,681279174);
        f=x_md5(f,c,u,s,t[n],11,-358537222); s=x_md5(s,f,c,u,t[n+3],16,-722521979);
        u=x_md5(u,s,f,c,t[n+6],23,76029189); c=x_md5(c,u,s,f,t[n+9],4,-640364487);
        f=x_md5(f,c,u,s,t[n+12],11,-421815835); s=x_md5(s,f,c,u,t[n+15],16,530742520);
        c=C_md5(c,u=x_md5(u,s,f,c,t[n+2],23,-995338651),s,f,t[n],6,-198630844);
        f=C_md5(f,c,u,s,t[n+7],10,1126891415); s=C_md5(s,f,c,u,t[n+14],15,-1416354905);
        u=C_md5(u,s,f,c,t[n+5],21,-57434055); c=C_md5(c,u,s,f,t[n+12],6,1700485571);
        f=C_md5(f,c,u,s,t[n+3],10,-1894986606); s=C_md5(s,f,c,u,t[n+10],15,-1051523);
        u=C_md5(u,s,f,c,t[n+1],21,-2054922799); c=C_md5(c,u,s,f,t[n+8],6,1873313359);
        f=C_md5(f,c,u,s,t[n+15],10,-30611744); s=C_md5(s,f,c,u,t[n+6],15,-1560198380);
        u=C_md5(u,s,f,c,t[n+13],21,1309151649); c=C_md5(c,u,s,f,t[n+4],6,-145523070);
        f=C_md5(f,c,u,s,t[n+11],10,-1120210379); s=C_md5(s,f,c,u,t[n+2],15,718787259);
        u=C_md5(u,s,f,c,t[n+9],21,-343485551);
        c=N_md5(c,r); u=N_md5(u,a); s=N_md5(s,o); f=N_md5(f,i);
    }
    return [c,u,s,f];
}

function U_md5(t) { var hex='0123456789abcdef'; var a=''; for(var n=0;n<t.length;n++) { var e=t.charCodeAt(n); a+=hex.charAt(e>>>4&15)+hex.charAt(15&e); } return a; }
function md5Raw(t) { return w_md5(M_md5(B_md5(O_md5(t)),8*O_md5(t).length)); }
function hmacMD5Raw(key, data) {
    var t=O_md5(key),e=O_md5(data),r=B_md5(t),a=[],o=[];
    a[15]=o[15]=void 0;
    if(r.length>16) { var padded=M_md5(r,8*t.length); for(var n=0;n<16;n++) { a[n]=909522486^padded[n]; o[n]=1549556828^padded[n]; } }
    else { for(var n=0;n<16;n++) { a[n]=909522486^r[n]; o[n]=1549556828^r[n]; } }
    var i=M_md5(a.concat(B_md5(e)),512+8*e.length);
    return w_md5(M_md5(o.concat(i),640));
}
function hmacMD5(data, key) { if(!key) return U_md5(md5Raw(data)); return U_md5(hmacMD5Raw(key, data)); }

function generatePC(events, uuid, tag, ft) {
    var data = serialize(events);
    var salt = uuid + ':' + tag + ':' + ft;
    var n = hmacMD5(data, salt);
    var digits = '', letters = '';
    for (var r = 0; r < n.length; r++) {
        var a = n.charCodeAt(r);
        if (a >= 48 && a <= 57) digits += n[r];
        else letters += a % 10;
    }
    var combined = digits + letters;
    var pc = '';
    for (var o = 0; o < combined.length; o += 2) pc += combined[o];
    return pc;
}

// ── sid.js (纯 JS) ──

function generateSid(uuid, serverTimestamp) {
    return uuid + hh(String(serverTimestamp));
}

// ── error_stack.js ──

var MAIN_JS_URL = 'https://client.px-cloud.net/PXO1GDTa7Q/main.min.js';
var ERR_MSG = "TypeError: Cannot read properties of null (reading '0')";

function captchaUrl(uuid, vid) {
    return 'https://captcha.px-cdn.net/PXO1GDTa7Q/captcha.js?a=c&m=0&u=' + uuid + '&v=' + vid;
}

function stackA() {
    return ERR_MSG + ' at Fr (' + MAIN_JS_URL + ':2:21510) at func (' + MAIN_JS_URL + ':2:143646) at ne (' + MAIN_JS_URL + ':2:13244) at ' + MAIN_JS_URL + ':2:146616';
}
function stackB() {
    return ERR_MSG + '\n    at Fr (' + MAIN_JS_URL + ':2:21510)\n    at HTMLBodyElement.gp (' + MAIN_JS_URL + ':2:147276)';
}
function stackC(uuid, vid) {
    var c = captchaUrl(uuid, vid);
    return ERR_MSG + '\n    at Fr (' + MAIN_JS_URL + ':2:21510)\n    at fl (' + MAIN_JS_URL + ':2:47621)\n    at dl (' + MAIN_JS_URL + ':2:48474)\n    at ' + c + ':2:582448\n    at Ws (' + c + ':2:334970)\n    at Object.A [as onSolvedCallback] (' + c + ':2:581928)\n    at t (' + c + ':2:320341)\n    at Object.n [as controllerCallback] (' + c + ':2:318230)\n    at Qf (' + c + ':2:307240)';
}
function stackD(uuid, vid) {
    var c = captchaUrl(uuid, vid);
    return ERR_MSG + '\n    at Fr (' + MAIN_JS_URL + ':2:21510)\n    at fl (' + MAIN_JS_URL + ':2:47621)\n    at Object.hl [as PX763] (' + MAIN_JS_URL + ':2:48430)\n    at ' + c + ':2:582496\n    at Ws (' + c + ':2:334970)\n    at Object.A [as onSolvedCallback] (' + c + ':2:581928)\n    at t (' + c + ':2:320341)\n    at Object.n [as controllerCallback] (' + c + ':2:318230)\n    at Qf (' + c + ':2:307240)';
}

// ── myanmar_encode.js (浏览器适配: btoa) ──

var CAPTCHA_DOM_TAGS = {"html":1,"head":1,"meta":3,"title":1,"style":2,"script":4,"body":1,"div":7,"br":1,"iframe":2};
var MYANMAR_XOR_KEY = 4210;

function ht_myanmar(obj) {
    var parts = ["{"], first = true;
    for (var key in obj) {
        if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
            if (!first) parts.push(",");
            parts.push('"' + key + '":' + obj[key]);
            first = false;
        }
    }
    parts.push("}");
    return parts.join("");
}

function ce_myanmar(str, key) {
    var out = "";
    for (var i = 0; i < str.length; i++) out += String.fromCharCode(str.charCodeAt(i) ^ key);
    return out;
}

function myanmarData(tagCounts) {
    var s = ce_myanmar(ht_myanmar(tagCounts || CAPTCHA_DOM_TAGS), MYANMAR_XOR_KEY);
    // Unicode-safe base64: encode UTF-16 chars via encodeURIComponent → percent → bytes
    var encoded = unescape(encodeURIComponent(s));
    return btoa(encoded);
}

// ── WASM (base64 内嵌) ──

var WASM_B64 = "AGFzbQEAAAABqgEYYAJ/fwF/YAN/f38Bf2ACf38AYAF/AX9gA39/fwBgAX8AYAR/f39/AGAAAX9gBX9/f39/AGAFf39/f38Bf2ABfwF+YAZ/f39/f38Bf2AAAGAEf39/fwF/YAd/f39/f39/AGAHf39/f39/fwF/YAN+f38Bf2AGf39/f39/AGAFf398f38AYAR/fH9/AGAFf39+f38AYAR/fn9/AGAFf399f38AYAR/fX9/AAKuCSIDd2JnFV9fd2JpbmRnZW5fc3RyaW5nX2dldAACA3diZxpfX3diaW5kZ2VuX29iamVjdF9kcm9wX3JlZgAFA3diZxVfX3diaW5kZ2VuX3N0cmluZ19uZXcAAAN3YmcoX193YmdfaW5zdGFuY2VvZl9XaW5kb3dfZTI2NmYwMmVlZTQzYjU3MAADA3diZxpfX3diZ19nZXRfZTZhZTQ4MGE0YjhkZjM2OAABA3diZx1fX3diZ19jcnlwdG9fYzQ4YTc3NGIwMjJkMjBhYwADA3diZxRfX3diaW5kZ2VuX2lzX29iamVjdAADA3diZx5fX3diZ19wcm9jZXNzXzI5ODczNGNmMjU1YTg4NWQAAwN3YmcfX193YmdfdmVyc2lvbnNfZTJlNzhlMTM0ZTNlNWQwMQADA3diZxtfX3diZ19ub2RlXzFjZDdhNWQ4NTNkYmVhNzkAAwN3YmcUX193YmluZGdlbl9pc19zdHJpbmcAAwN3YmceX193YmdfcmVxdWlyZV84ZjA4Y2VlY2VjMGY0ZmVlAAcDd2JnH19fd2JnX21zQ3J5cHRvX2JjYjk3MDY0MGY1MGExZTgAAwN3YmcmX193YmdfZ2V0UmFuZG9tVmFsdWVzXzM3ZmEyY2E5ZTRlMDdmYWIAAgN3YmclX193YmdfcmFuZG9tRmlsbFN5bmNfZGMxZTlhNjBjMTU4MzM2ZAACA3diZxZfX3diaW5kZ2VuX2lzX2Z1bmN0aW9uAAMDd2JnIF9fd2JnX25ld25vYXJnc18yYjhiNmJkNzc1M2M3NmJhAAADd2JnG19fd2JnX2NhbGxfOTVkMWVhNDg4ZDAzZTRlOAAAA3diZxpfX3diZ19uZXdfZjk4NzYzMjYzMjhmNDVlZAAHA3diZxtfX3diZ19zZWxmX2U3YzFmODI3MDU3ZjY1ODQABwN3YmcdX193Ymdfd2luZG93X2EwOWVjNjY0ZTE0YjFiODEABwN3YmchX193YmdfZ2xvYmFsVGhpc184N2NiYjg1MDZmZWNmM2E5AAcDd2JnHV9fd2JnX2dsb2JhbF9jODVhOTI1OWU2MjFmM2RiAAcDd2JnF19fd2JpbmRnZW5faXNfdW5kZWZpbmVkAAMDd2JnG19fd2JnX2NhbGxfOTQ5NWRlNjZmZGJlMDE2YgABA3diZx1fX3diZ19idWZmZXJfY2Y2NWMwN2RlMzRiOWEwOAADA3diZzFfX3diZ19uZXd3aXRoYnl0ZW9mZnNldGFuZGxlbmd0aF85ZmIyZjExMzU1ZWNhZGY1AAEDd2JnGl9fd2JnX25ld181MzdiNzM0MWNlOTBiYjMxAAMDd2JnGl9fd2JnX3NldF8xNzQ5OWU4YWE0MDAzZWJkAAQDd2JnJF9fd2JnX25ld3dpdGhsZW5ndGhfYjU2Yzg4MmI1NzgwNTczMgADA3diZx9fX3diZ19zdWJhcnJheV83NTI2NjQ5YjkxYTI1MmE2AAEDd2JnG19fd2JpbmRnZW5fb2JqZWN0X2Nsb25lX3JlZgADA3diZxBfX3diaW5kZ2VuX3Rocm93AAIDd2JnEV9fd2JpbmRnZW5fbWVtb3J5AAcDoQGfAQIIAAIOAQILAQkCAQEEAA8DCAAQAAAAAgAAAwAEAAQECAYGBgIABgAABQYIEQUEBgACAwkAAAAAAAAAAAICAAUDBAIEAgEBBQcEAgwEAgkFAgMGAAAAAAICAAAFAgYFAQALCBIUCRYGBQIBAwMDBQQNAgIBAAAACAABAAACAgAFAgADAwEEAAAEBAQAAQMFDAIBAQACAAMAAwoKCgoFBAQFAXABWVkFAwEAEQYJAX8BQYCAwAALB4oBCAZtZW1vcnkCAAFhAEsBYgA+EV9fd2JpbmRnZW5fbWFsbG9jAHMSX193YmluZGdlbl9yZWFsbG9jAIEBH19fd2JpbmRnZW5fYWRkX3RvX3N0YWNrX3BvaW50ZXIArwEPX193YmluZGdlbl9mcmVlAJQBFF9fd2JpbmRnZW5fZXhuX3N0b3JlAKEBCZcBAQBBAQtYnQGaAbABpgE4XL8BlgG/AZsBN1a/AVG5AboBvwFMtwG4AY0BYL8BeL8BPT+2AbsBnwHAAZcBjgG/AYIBrQG/AXygAXuPAb8Bd78BjAGJAYQB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cUECdkGUgcAAai0AADoAAAsgA0G4AmogBiAJEJEBIAMoArwCIQIgAyADKALAAiIBEF4gAyADKAIEIgY2AswCIAMgAygCADYCyAIgBiACIAEQtAEaIAMgATYC0AIgA0EDNgK8ASADQQE2ArQBIANBpYXAADYCsAEgA0EBNgKsASADQaSFwAA2AqgBIANBATYCpAEgA0GmhcAANgKgASADQaABaiECQQEhBQNAAkAgAyAFNgK4ASACKAIAIgFFDQAgA0HYAmogAygCzAIgA0HQAmoiBigCACABIAJBBGooAgBBgIDAAEEAECYgA0HIAmoQkAEgBiADQeACaigCADYCACADIAMpA9gCNwPIAiACQQhqIQIgBUEBaiIFQQRHDQELCyADQaABaiICIAMoAswCIANB0AJqIgEoAgBBqIXAAEEBQaeFwABBARAmIANByAJqIgYQkAEgASADQagBaiIFKAIAIgQ2AgAgAyADKQOgATcDyAIgAiADKALMAiAEQaqFwABBAUGphcAAQQEQJiAGEJABIAEgBSgCACIENgIAIAMgAykDoAE3A8gCIAIgAygCzAIgBEGshcAAQQFBq4XAAEEBECYgBhCQASABIAUoAgAiBDYCACADIAMpA6ABNwPIAiACIAMoAswCIARBroXAAEEBQa2FwABBARAmIAYQkAEgASAFKAIAIgQ2AgAgAyADKQOgATcDyAIgAiADKALMAiAEQbCFwABBAUGvhcAAQQEQJiAGEJABIAEgBSgCACIENgIAIAMgAykDoAE3A8gCIAIgAygCzAIgBEGyhcAAQQFBsYXAAEEBECYgBhCQASABIAUoAgAiBDYCACADIAMpA6ABNwPIAiACIAMoAswCIARBtIXAAEEBQbOFwABBARAmIAYQkAEgASAFKAIAIgQ2AgAgAyADKQOgATcDyAIgAiADKALMAiAEQbaFwABBAUG1hcAAQQEQJiAGEJABIAEgBSgCACIENgIAIAMgAykDoAE3A8gCIAIgAygCzAIgBEG4hcAAQQFBt4XAAEEBECYgBhCQASABIAUoAgAiBDYCACADIAMpA6ABNwPIAiACIAMoAswCIARBuoXAAEEBQbmFwABBARAmIAYQkAEgASAFKAIANgIAIAMgAykDoAE3A8gCIANB0ABqEJABIANB2ABqIAEoAgA2AgAgAyADKQPIAjcDUCADQbgCahCQASADQagCahCQASADQYgCahCQASADQfgBahCQASADQegBahCQAQsgDEGEAU8EQCAMEAELIAMoApwBIgFBhAFJDQAgARABCyANIAMpA1A3AgAgDUEIaiADQdgAaigCADYCAAwBC0GchsAAQQ0QAiEBIA1BADYCBCANIAE2AgAgA0HoAWoQkAEgDEGEAU8EQCAMEAELIAMoApwBIgFBhAFPBEAgARABCyADQdAAahCQAQsgDhCQASADQfACaiQAIAcoAiAhAgJ/IAcoAiQiAQRAIAcgBygCKDYCOCAHIAE2AjQgByACNgIwIAcgB0EwahB5IAcoAgQhAiAHKAIAIQFBAAwBC0EBIRIgAgshBiAAIBI2AgwgACAGNgIIIAAgAjYCBCAAIAE2AgAgB0FAayQAC9gBAQJ/IwBBIGsiAiQAIAJBCGogAUH8lcAAQQUQfwJAIAAoAgAiAEEATgRAIAIgADYCECACQQhqQciWwABBCCACQRBqQdCWwAAQMwwBCyACIAAQbCACKAIAIgEEQCACKAIEIQMgAiABNgIQIAIgAzYCFCACIAA2AhwgAkEIaiIAQaCWwABBDSACQRxqQZCWwAAQMyAAQa2WwABBCyACQRBqQbiWwAAQMwwBCyACIAA2AhAgAkEIakGBlsAAQQwgAkEQakGQlsAAEDMLIAJBCGoQVCACQSBqJAALygEBAn8jAEEgayIDJAACQAJAIAEgASACaiIBSw0AQQggACgCACICQQF0IgQgASABIARJGyIBIAFBCE0bIgFBf3NBH3YhBAJAIAIEQCADQQE2AhggAyACNgIUIAMgAEEEaigCADYCEAwBCyADQQA2AhgLIAMgASAEIANBEGoQRSADKAIEIQIgAygCAEUEQCAAIAE2AgAgACACNgIEDAILIANBCGooAgAiAEGBgICAeEYNASAARQ0AIAIgABCyAQALEG0ACyADQSBqJAALygEBAn8jAEEgayIDJAACQAJAIAEgASACaiIBSw0AQQggACgCACICQQF0IgQgASABIARJGyIBIAFBCE0bIgFBf3NBH3YhBAJAIAIEQCADQQE2AhggAyACNgIUIAMgAEEEaigCADYCEAwBCyADQQA2AhgLIAMgASAEIANBEGoQQyADKAIEIQIgAygCAEUEQCAAIAE2AgAgACACNgIEDAILIANBCGooAgAi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QRxqQQI2AgAgA0EsakEkNgIAIANBzKTAADYCECADQQA2AgggA0EkNgIkIAMgA0EgajYCGCADIAM2AiggAyADQQRqNgIgIANBCGogAhByAAtqAAJ/IAJBAnQiASADQQN0QYCAAWoiAiABIAJLG0GHgARqIgFBEHZAACICQX9GBEBBACECQQEMAQsgAkEQdCICQgA3AgQgAiACIAFBgIB8cWpBAnI2AgBBAAshAyAAIAI2AgQgACADNgIAC3IBA38jAEEgayICJAACf0EBIAAgARA2DQAaIAEoAgQhAyABKAIAIQQgAkEANgIcIAJB4KPAADYCGCACQQE2AhQgAkGQpMAANgIQIAJBADYCCEEBIAQgAyACQQhqECoNABogAEEEaiABEDYLIAJBIGokAAtxACMAQTBrIgEkAEHEyMAALQAABEAgAUEUakECNgIAIAFBHGpBATYCACABQcigwAA2AhAgAUEANgIIIAFBJDYCJCABIAA2AiwgASABQSBqNgIYIAEgAUEsajYCICABQQhqQfCgwAAQcgALIAFBMGokAAt2AQF/IAAtAAQhASAALQAFBEAgAUH/AXEhASAAAn9BASABDQAaIAAoAgAiAS0AGEEEcUUEQCABKAIAQbOmwABBAiABKAIEKAIMEQEADAELIAEoAgBBsqbAAEEBIAEoAgQoAgwRAQALIgE6AAQLIAFB/wFxQQBHC2sBAn8jAEEQayIGJAACQCAAIAEgAiADIAQQKyIFDQAgBkEIaiADIAAgASAEKAIMEQYAQQAhBSAGKAIIDQAgBigCDCIFIAIoAgA2AgggAiAFNgIAIAAgASACIAMgBBArIQULIAZBEGokACAFC1kBAX8jAEEgayICJAAgAiAAKAIANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpBvIbAACACQQhqECogAkEgaiQAC1kBAX8jAEEgayICJAAgAiAAKAIANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpB1J/AACACQQhqECogAkEgaiQAC1kBAX8jAEEgayICJAAgAiAAKAIANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpBlKLAACACQQhqECogAkEgaiQAC1MBAn8jAEEgayICJAAgASgCBCEDIAEoAgAgAkEYaiAAQRBqKQIANwMAIAJBEGogAEEIaikCADcDACACIAApAgA3AwggAyACQQhqECogAkEgaiQAC1kBAX8jAEEgayICJAAgAiAAKAIANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpBrKjAACACQQhqECogAkEgaiQAC1MBAn8jAEEgayICJAAgACgCBCEDIAAoAgAgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAyACQQhqECogAkEgaiQAC1YBAX8jAEEgayICJAAgAiAANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpBvIbAACACQQhqECogAkEgaiQAC1YBAX8jAEEgayICJAAgAiAANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpBrKjAACACQQhqECogAkEgaiQAC0cBAn8CQCABRQRAQQEhAgwBCyABQQBOBEAgASABQX9zQR92IgMQnAEiAg0BIAEgAxCyAQALEG0ACyAAIAI2AgQgACABNgIAC7YFAg5/BH4jAEEQayIIJAACQAJAIAApAzgiEEIAVw0AIAAoAkBBAEgNACAIQQhqIAEQngEgACAQIAgoAgxBAnStfTcDOCAAIAEQIgwBCyMAQRBrIgUkACAFQQhqIAEQngEgBSgCDCEMIwBBQGoiBCQAIARBCGohBiMAQZABayICJAAgAkEoaiIDQgA3AwAgAkEgaiIHQgA3AwAgAkEYaiIJQgA3AwAgAkIANwMQIAJBCGogAkEQahBmAkAgAigCCCIKRQRAIAJByABqIgogAykDADcDACACQUBrIg0gBykDADcDACACQThqIgMgCSkDADcDACACIAIpAxA3AzBBlIzAABBiIQlBmIzAABBiIQ4gAkHYAGoiDyADKQMANwMAIAIgAikDMDcDUCACQYABaiIDIAJB0ABqIgcQiwEgAikDgAEhECACKQOIASERIA8gCikDADcDACACIA0pAwA3A1AgAyAHEIsBIAIpA4ABIRIgAikDiAEhEyACIBE3A4gBIAIgEDcDgAEgByADEIsBIAIgEzcDiAEgAiASNwOAASACQeAAaiADEIsBIAIgDjYCjAEgAiAJNgKIASACQgA3AoABIAJB8ABqIAMQiwEgBkEIaiAHQTAQtAEaIAZBADYCAAwBCyACKAIMIQMgBiAKNgIEIAZBATYCACAGQQhqIAM2AgALIAJBkAFqJAACfyAEKAIIRQRAIAAgACkDMDcDOCAAIARBEGpBMBC0ARpBAAwBCyAEQRBqKAIAIQsgBCgCDAshAiAFIAs2AgQgBSACNgIAIARBQGskAAJAIAUoAgAiAkUNACACIAUoAgQiBCgCABEFACAEKAIEIgZFDQAgAiAGIAQoAggQpwELIABBADYCQCAAIAApAzAgDEECdK19NwM4IAAgARAiIAVBEGokAAsgCEEQaiQAC1cBAX8jAEEgayICJAAgAkEMakEBNgIAIAJBFGpBATYCACACQbiRwAA2AgggAkEANgIAIAJBIDYCHCACIAA2AhggAiACQRhqNgIQIAEgAhBbIAJBIGokAAtlAQV/IwBBEGsiAiQAIAJBCGohAxBqIgEQA0UhBCADIAE2AgQgAyAENgIAIAIoAgwhAQJAIAIoAghFBEBBASEFDAELIAFBhAFJDQAgARABCyAAIAE2AgQgACAFNgIAIAJBEGokAAsgAQF/IwBBIGsiASQAIAFBBDYCBCAAKAAAIAFBIGokAAtRAQF/IwBBIGsiAyQAIANBDGpBATYCACADQRRqQQA2AgAgA0Hgo8AANgIQIANBADYCACADIAE2AhwgAyAANgIYIAMgA0EYajYCCCADIAIQcgALSQEBfyMAQRBrIgIkACACQQhqIAAgAUEBEEgCQCACKAIMIgBBgYCAgHhHBEAgAEUNASACKAIIIAAQsgEACyACQRBqJAAPCxBtAAtJAQF/IwBBEGsiAyQAIANBCGogACABIAIQSAJAIAMoAgwiAEGBgICAeEcEQCAARQ0BIAMoAgggABCyAQALIANBEGokAA8LEG0ACz8BAX8CQCABQSAQdiIBBEBBBEEEEJwBIgJFDQEgAiABNgIACyAAQYyRwAA2AgQgACACNgIADwtBBEEEELIBAAtHAQF/IAIgACgCACIAKAIAIAAoAggiA2tLBEAgACADIAIQQCAAKAIIIQMLIAAoAgQgA2ogASACELQBGiAAIAIgA2o2AghBAAtHAQF/IAIgACgCACIAKAIAIAAoAggiA2tLBEAgACADIAIQQSAAKAIIIQMLIAAoAgQgA2ogASACELQBGiAAIAIgA2o2AghBAAtOAQF/AkACQAJAAkAgACgCAA4EAAEDAwELIAAoAgQiAEGDAUsNAQwCCyAAKAIEIgFBhAFPBEAgARABCyAAKAIIIgBBhAFJDQELIAAQAQsLSAECfyMAQRBrIgEkAEEAQcCcwAAoAgARAwAiAARAIAAoAgAQHyABQRBqJAAPC0HoncAAQcYAIAFBCGpBsJ7AAEGQn8AAEE0AC0IBAX8gAiAAKAIAIAAoAggiA2tLBH8gACADIAIQZSAAKAIIBSADCyAAKAIEaiABIAIQtAEaIAAgACgCCCACajYCCAtLAQF/AkAgAUGAgICAeHMiAUEOSwRAQQAhAQwBCyABQQJ0IgJBhJzAAGooAgAhASACQcibwABqKAIAIQILIAAgAjYCBCAAIAE2AgALSQEBfyMAQSBrIgAkACAAQRRqQQE2AgAgAEEcakEANgIAIABB3KLAADYCECAAQayiwAA2AhggAEEANgIIIABBCGpB5KLAABByAAtCACAAIAIoAgwgASgCDGo2AgwgACACKAIIIAEoAghqNgIIIAAgAigCBCABKAIEajYCBCAAIAIoAgAgASgCAGo2AgALRgECfyABKAIEIQIgASgCACEDQQhBBBCcASIBRQRAQQhBBBCyAQALIAEgAjYCBCABIAM2AgAgAEHMocAANgIEIAAgATYCAAs5AAJAAn8gAkGAgMQARwRAQQEgACACIAEoAhARAAANARoLIAMNAUEACw8LIAAgAyAEIAEoAgwRAQALPAEBfyAAKAIAIgAgACgCAEEBayIBNgIAAkAgAQ0AIAAgACgCBEEBayIBNgIEIAENACAAQdgCQQgQpwELC+ACAQJ/IwBBIGsiAiQAIAJBAToAGCACIAE2AhQgAiAANgIQIAJB3KTAADYCDCACQeCjwAA2AggjAEEQayIBJAACQCACQQhqIgAoAgwiAgRAIAAoAggiA0UNASABIAI2AgggASAANgIEIAEgAzYCACMAQRBrIgAkACAAQQhqIAFBCGooAgA2AgAgACABKQIANwMAIwBBEGsiASQAIAAoAgAiAkEUaigCACEDAkACfwJAAkAgAkEMaigCAA4CAAEDCyADDQJBACECQeyfwAAMAQsgAw0BIAIoAggiAygCBCECIAMoAgALIQMgASACNgIEIAEgAzYCACABQfChwAAgACgCBCIBKAIIIAAoAgggAS0AEBBCAAsgAUEANgIEIAEgAjYCDCABQdyhwAAgACgCBCIBKAIIIAAoAgggAS0AEBBCAAtB7J/AAEErQayhwAAQYwALQeyfwABBK0GcocAAEGMACzMAAkAgAEH8////B0sNACAARQRAQQQPCyAAIABB/f///wdJQQJ0EJwBIgBFDQAgAA8LAAshACABKAIAIAIgAxAEIgNFRSEBIAAgAzYCBCAAIAE2AgAL6wIBC38jAEEwayIHJAAjAEEwayICJAAgAkKYgICAwAQ3AyggAkKTgICA8AI3AyAgAkKOgICAoAI3AxggAkKJgICA0AE3AxAgAkKAgICAgAE3AwggB0EMaiIKQSQQtQEhCANAAkACQAJAAkAgAkEIaiAGQQN0aiIEKAIAIgUgBCgCBCIESQRAQRAgAyADQRBNGyEJA0AgAyAJRg0CIAVBJE8NAyAFIAhqIgsgACADai0AACIMQfABcUEEdkHsksAAai0AADoAACAFQSNGDQQgC0EBaiAMQQ9xQeySwABqLQAAOgAAIANBAWohAyAFQQJqIgUgBEkNAAsLIAZBBE8NAyAEQSNNBEAgBCAIakEtOgAADAQLIARBJEGElMAAEFAACyAJQRBB1JPAABBQAAsgBUEkQeSTwAAQUAALQSRBJEH0k8AAEFAACyAGQQFqIgZBBUcNAAsgAkEwaiQAIAEgCkEkEJUBIAdBMGokAAuSBAEIfyMAQRBrIgckACAHIAE2AgwgByAANgIIIAdBCGohAyMAQSBrIgEkAAJAAkBBAEGUlMAAKAIAEQMAIgIEQCACIAIoAgBBAkYiBEECdGooAgAhACAEDQIgAkEEaiACIAQbIQQgAEUEQCADKAIEIQIgAygCACEAA0AgAkUNAxAhIgMQGSIFIABB/////wcgAiACQf////8HTxsiBhAaIQggA0GEAU8EQCADEAELIAVBhAFPBEAgBRABCyAEKAIEIAgQDiAAIAZqIQAgAiAGayECIAEQfSABKAIARQ0AC0GNgICAeCEAIAEoAgQiAkGEAUkNAyACEAEMAwsgAygCBCICRQ0BIARBCGohCSADKAIAIQADQCABIAkoAgBBAEGAAiACIAJBgAJPGyIFEB4iAzYCFCAEKAIEIAMQDSABQQhqEH0gASgCCARAIAEoAgwiAEGEAU8EQCAAEAELIAEoAhQiAEGEAU8EQCAAEAELQYiAgIB4IQAMBAsgAiAFayECECEiBhAZIggQGyEDIAhBhAFPBEAgCBABCyADIAFBFGooAgAgABAcIANBhAFPBEAgAxABCyAGQYQBTwRAIAYQAQsgASgCFCIDQYQBTwRAIAMQAQsgACAFaiEAIAINAAsMAQtBnpTAAEHGACABQRhqQeSUwABBxJXAABBNAAtBACEACyABQSBqJAAgB0EQaiQAIAALMAAgACgCACEAIAEQpAFFBEAgARClAUUEQCAAIAEQrQEPCyAAIAEQSg8LIAAgARBJCyoBAX8jAEEQayIAJAAgAEEIaiICIAFBl6DAAEELEH8gAhBUIABBEGokAAvaAgEJfyAAIAEoAggiAyABKAIASQR/IwBBEGsiBCQAIARBCGohCCMAQSBrIgIkAAJAAkACQAJAIAMgASgCAE0EQCACQQhqIAEQeiACKAIQIglFDQMgAigCDCEFIAIoAgghBwJAIANFBEBBASEGIAUNAQwEC0EBIQogCUEBRg0CIANBARCcASIGRQ0FIAYgByADELQBGiAFRQ0DCyAHIAUgCRCnAQwCCyACQRRqQQE2AgAgAkEcakEANgIAIAJB9JzAADYCECACQdCcwAA2AhggAkEANgIIIAJBCGpByJ3AABByAAsgByAFQQEgAxCSASIGRQ0CCyABIAM2AgAgASAGNgIEC0GBgICAeCEKCyAIIAo2AgQgCCADNgIAIAJBIGokACAEKAIMIgNBgYCAgHhHBEAgBCgCCCADELIBAAsgBEEQaiQAIAEoAggFIAMLNgIEIAAgASgCBDYCAAsuAQF/IAEoAgAiAgRAIABBATYCCCAAIAI2AgQgACABKAIENgIADwsgAEEANgIICyoAAkAgARCkAUUEQCABEKUBDQEgACABEIIBDwsgACABEEkPCyAAIAEQSgsqAAJAIAEQpAFFBEAgARClAQ0BIAAgARCtAQ8LIAAgARBJDwsgACABEEoLOgECf0HUyMAALQAAIQFB1MjAAEEAOgAAQdjIwAAoAgAhAkHYyMAAQQA2AgAgACACNgIEIAAgATYCAAs0ACAAQQM6ACAgAEKAgICAgAQ3AhggAEEANgIQIABBADYCCCAAQdSBwAA2AgQgACABNgIACy0AIAEoAgAgAiADIAEoAgQoAgwRAQAhAiAAQQA6AAUgACACOgAEIAAgATYCAAsnAQF/AkAgAEEEaigCACIBRQ0AIAAoAgAiAEUNACABIABBARCnAQsLIwACQCABQfz///8HTQRAIAAgAUEEIAIQkgEiAA0BCwALIAALHgAgACgCACIArUIAIACsfSAAQQBOIgAbIAAgARA1Cx4AIABFBEAQsQEACyAAIAIgAyAEIAUgASgCEBEJAAscACAARQRAELEBAAsgACACIAMgBCABKAIQEQYACxwAIABFBEAQsQEACyAAIAIgAyAEIAEoAhAREwALHAAgAEUEQBCxAQALIAAgAiADIAQgASgCEBEVAAscACAARQRAELEBAAsgACACIAMgBCABKAIQEQ0ACxwAIABFBEAQsQEACyAAIAIgAyAEIAEoAhARFwALGgAgAEUEQBCxAQALIAAgAiADIAEoAhARBAALHQEBfyAAKAIAIgEEQCAAQQRqKAIAIAFBARCnAQsLHAAgACABKQIANwIAIABBCGogAUEIaikCADcCAAsYACAARQRAELEBAAsgACACIAEoAhARAAALxQYCCX8EfkHIyMAAKAIABH9ByMjAAAUCfyMAQYAGayIBJAACQAJAIAAEQCAAKAIAIQIgAEEANgIAIAINAQsgAUH4AmohAiMAQZABayIAJAAgAEEgaiIDQgA3AwAgAEEYaiIEQgA3AwAgAEEQaiIFQgA3AwAgAEIANwMIIAAgAEEIahBmAkAgACgCACIGRQRAIABBQGsiBiADKQMANwMAIABBOGoiByAEKQMANwMAIABBMGoiAyAFKQMANwMAIAAgACkDCDcDKEGUjMAAEGIhBUGYjMAAEGIhCCAAQdAAaiIJIAMpAwA3AwAgACAAKQMoNwNIIABB+ABqIgMgAEHIAGoiBBCLASAAKQN4IQogACkDgAEhCyAJIAYpAwA3AwAgACAHKQMANwNIIAMgBBCLASAAKQN4IQwgACkDgAEhDSAAIAs3A4ABIAAgCjcDeCAEIAMQiwEgACANNwOAASAAIAw3A3ggAEHYAGogAxCLASAAIAg2AoQBIAAgBTYCgAEgAEIANwJ4IABB6ABqIAMQiwEgAkEIaiAEQTAQtAEaIAJBADYCAAwBCyAAKAIEIQMgAiAGNgIEIAJBATYCACACQQhqIAM2AgALIABBkAFqJAAgASgC+AINASABQRBqIgIgAUGAA2pBMBC0ARogAUH4AmoiAEGAAhC1ARogAUHMBWogAkEwELQBGiABQQhqIAAQngEgASgCDCECIAFB+ABqIgMgAEGAAhC0ARogAUFAayIEIAFByAVqQTQQtAEaIAAgA0GAAhC0ARogASACNgL4BCABQfwEaiAEQTQQtAEaIAFBADYCwAUgAUKAgAQ3A7gFIAFCgIAENwOwBUHYAkEIEJwBIgJFBEBB2AJBCBCyAQALIAJCgYCAgBA3AwAgAkEIaiAAQdACELQBGgtByMjAACgCACEAQcjIwAAgAjYCACABIAA2AvgCIAAEQCABQfgCahBxCyABQYAGaiQAQcjIwAAMAQsgASABKQL8AjcDQCABQYQBakEBNgIAIAFBjAFqQQE2AgAgAUHYjcAANgKAASABQQA2AnggAUEWNgLMBSABIAFByAVqNgKIASABIAFBQGs2AsgFIAFB+ABqQcCOwAAQcgALCwugBgIHfwF+QbTAwAAoAgBBA0YEQCMAQSBrIgEkAAJAIAAEQCAAKQIAIQggAEEDNgIAIAFBGGoiBSAAQQhqKAIANgIAIAEgCDcDECAIp0EDRwRAIAFBCGogBSgCADYCACABIAEpAxA3AwAMAgsgAUEQahBpCyMAQTBrIgIkACACEGoiAzYCJAJAAkAgAxAFIgUQBkEBRgRAIAUhAAwBCwJAAkACQCADEAciABAGQQFHDQAgABAIIgQQBkEBRwRAIARBhAFJDQEgBBABDAELIAQQCSIGEAogBkGEAU8EQCAGEAELIARBhAFPBEAgBBABCyAAQYQBTwRAIAAQAQtBAUcNARALIQAgAkEYahB9AkAgAigCGARAIAIoAhwhAAwBCyAAEA8hAyACQRBqIgQgADYCBCAEIANBAUc2AgAgAigCFCEAIAIoAhANACACIAA2AiggAkGYlMAAQQYQAjYCLCMAQRBrIgAkACACQShqKAIAIAJBJGooAgAgAkEsaigCABAYIQMgAEEIahB9IAAoAgwhBCACQQhqIgYgACgCCCIHNgIAIAYgBCADIAcbNgIEIABBEGokACACKAIMIQACQCACKAIIRQRAIAEgADYCBCABQQA2AgAMAQsgAUKCgICAwIGAgIB/NwIAIABBhAFJDQAgABABCyACKAIsIgBBhAFPBEAgABABCyACKAIoIgBBhAFJDQMgABABDAMLIAFCgoCAgOCBgICAfzcCACAAQYQBSQ0CIAAQAQwCCyAAQYQBSQ0AIAAQAQsgAxAMIgAQBkEBRwRAIAFCgoCAgPCAgICAfzcCACAAQYQBSQ0BIAAQAQwBCyAFQYQBSQ0BIAUQAQwBCyAFQYQBTwRAIAUQAQsgAigCJCIAQYQBSQ0BIAAQAQwBCyABQYACEB02AgggASAANgIEIAFBATYCACADQYQBSQ0AIAMQAQsgAkEwaiQAC0G0wMAAKQIAIQhBtMDAACABKQMANwIAIAFBGGpBvMDAACgCADYCAEG8wMAAIAFBCGooAgA2AgAgASAINwMQIAFBEGoQaSABQSBqJAALQbTAwAALvwMBBn9BzMjAACgCAEUEQAJAAkAgAEUNACAAKAIAIQIgAEEANgIAIAAoAgQhAAJAIAIOAgECAAsgAEGEAUkNACAAEAELIwBBMGsiASQAEBMhACABQShqEH0CQAJAAkAgASgCKEUNACABKAIsIQIQFCEAIAFBIGoQfSABKAIgIQMgASgCJCACQYQBTwRAIAIQAQsgA0UNACAAIAMbIQIQFSEAIAFBGGoQfSABKAIYIQMgASgCHCACQYQBTwRAIAIQAQsgA0UNACAAIAMbIQMQFiEAIAFBEGoQfSABKAIUIQIgASgCECADQYQBTwRAIAMQAQtBASEDDQELIAAQF0EBRw0BQQAhAyAAQYQBTwRAIAAQAQsgACECC0HEnMAAQQsQECIAQYABEBEhBCABQQhqEH0CQCABKAIIIgVFDQAgASgCDCAEIAUbIgZBhAFJDQAgBhABCyAAQYQBTwRAIAAQAQtBgAEgBCAFGyEAIAMgAkGDAUtxRQ0AIAIQAQsgAUEwaiQAC0HQyMAAKAIAIQJB0MjAACAANgIAQczIwAAoAgBBzMjAAEEBNgIARSACQYQBSXJFBEAgAhABCwtB0MjAAAsaAQF/IAAoAgAiAQRAIAAoAgQgAUEBEKcBCwsXACAAIAI2AgggACABNgIEIAAgAjYCAAsrAQF/IAMgAhBHIgQEQCAEIAAgASADIAEgA0kbELQBGiAAIAEgAhAvCyAECxMAIAAgATYCBCAAIAFBQGs2AgALEAAgAQRAIAAgAUEEEKcBCwsWACAAKAIAIAEgAiAAKAIEKAIMEQEACxkAIAEoAgBBwLnAAEEFIAEoAgQoAgwRAQALFAAgACgCACABIAAoAgQoAhARAAALFAAgACgCACABIAAoAgQoAgwRAAALyggBA38jAEHwAGsiBSQAIAUgAzYCDCAFIAI2AggCQAJAAkACQCAFAn8CQAJAIAFBgQJPBEADQCAAIAZqIAZBAWshBkGAAmosAABBv39MDQALIAZBgQJqIgcgAUkNAiABQYECayAGRw0EIAUgBzYCFAwBCyAFIAE2AhQLIAUgADYCEEHgo8AAIQZBAAwBCyAAIAZqQYECaiwAAEG/f0wNASAFIAc2AhQgBSAANgIQQcirwAAhBkEFCzYCHCAFIAY2AhgCQCABIAJJIgYgASADSXJFBEACfwJAAkAgAiADTQRAAkACQCACRQ0AIAEgAk0EQCABIAJGDQEMAgsgACACaiwAAEFASA0BCyADIQILIAUgAjYCICACIAEiBkkEQCACQQFqIgYgAkEDayIDQQAgAiADTxsiA0kNBiAAIAZqIAAgA2prIQYDQCAGQQFrIQYgACACaiACQQFrIQIsAABBQEgNAAsgAkEBaiEGCwJAIAZFDQAgASAGTQRAIAEgBkYNAQwKCyAAIAZqLAAAQb9/TA0JCyABIAZGDQcCQCAAIAZqIgIsAAAiA0EASARAIAItAAFBP3EhACADQR9xIQEgA0FfSw0BIAFBBnQgAHIhAAwECyAFIANB/wFxNgIkQQEMBAsgAi0AAkE/cSAAQQZ0ciEAIANBcE8NASAAIAFBDHRyIQAMAgsgBUHkAGpBzQA2AgAgBUHcAGpBzQA2AgAgBUHUAGpBJDYCACAFQTxqQQQ2AgAgBUHEAGpBBDYCACAFQayswAA2AjggBUEANgIwIAVBJDYCTCAFIAVByABqNgJAIAUgBUEYajYCYCAFIAVBEGo2AlggBSAFQQxqNgJQIAUgBUEIajYCSAwICyABQRJ0QYCA8ABxIAItAANBP3EgAEEGdHJyIgBBgIDEAEYNBQsgBSAANgIkQQEgAEGAAUkNABpBAiAAQYAQSQ0AGkEDQQQgAEGAgARJGwshACAFIAY2AiggBSAAIAZqNgIsIAVBPGpBBTYCACAFQcQAakEFNgIAIAVB7ABqQc0ANgIAIAVB5ABqQc0ANgIAIAVB3ABqQc8ANgIAIAVB1ABqQdAANgIAIAVBgK3AADYCOCAFQQA2AjAgBUEkNgJMIAUgBUHIAGo2AkAgBSAFQRhqNgJoIAUgBUEQajYCYCAFIAVBKGo2AlggBSAFQSRqNgJQIAUgBUEgajYCSAwFCyAFIAIgAyAGGzYCKCAFQTxqQQM2AgAgBUHEAGpBAzYCACAFQdwAakHNADYCACAFQdQAakHNADYCACAFQfCrwAA2AjggBUEANgIwIAVBJDYCTCAFIAVByABqNgJAIAUgBUEYajYCWCAFIAVBEGo2AlAgBSAFQShqNgJIDAQLIAMgBkHErcAAEKwBAAsgACABQQAgByAEEJkBAAtB4KPAAEErIAQQYwALIAAgASAGIAEgBBCZAQALIAVBMGogBBByAAsRACAAKAIEIAAoAgggARCzAQsPACAAKAIAIAEgAhBrQQALCAAgACABEEcLEQAgACgCACAAKAIEIAEQswELEQAgAEHAADYCBCAAIAE2AgALEwAgAEEoNgIEIABB1JXAADYCAAucBwEOfwJ/IAAoAgAhByAAKAIEIQUCQAJAIAEoAgAiDEEiIAEoAgQiDSgCECIOEQAARQRAAkAgBUUEQAwBCyAFIAdqIQ8gByEIAkADQAJAIAgiCSwAACIDQQBOBEAgCUEBaiEIIANB/wFxIQQMAQsgCS0AAUE/cSEAIANBH3EhASADQV9NBEAgAUEGdCAAciEEIAlBAmohCAwBCyAJLQACQT9xIABBBnRyIQAgCUEDaiEIIANBcEkEQCAAIAFBDHRyIQQMAQsgAUESdEGAgPAAcSAILQAAQT9xIABBBnRyciIEQYCAxABGDQIgCUEEaiEIC0GCgMQAIQBBMCEDAkACQAJAAkACQAJAAkACQAJAIAQOIwYBAQEBAQEBAQIEAQEDAQEBAQEBAQEBAQEBAQEBAQEBAQEFAAsgBEHcAEYNBAsgBBAyRQRAIAQQPA0GCyAEQYGAxABGDQUgBEEBcmdBAnZBB3MhAyAEIQAMBAtB9AAhAwwDC0HyACEDDAILQe4AIQMMAQsgBCEDCyACIAZLDQECQCACRQ0AIAIgBU8EQCACIAVGDQEMAwsgAiAHaiwAAEFASA0CCwJAIAZFDQAgBSAGTQRAIAUgBkcNAwwBCyAGIAdqLAAAQb9/TA0CC0EBIAwgAiAHaiAGIAJrIA0oAgwRAQANCBpBBSELA0AgCyECIAAhAUGBgMQAIQBB3AAhCgJAAkACQAJAAkACQEEDIAFBgIDEAGsgAUH//8MATRtBAWsOAwEFAAILQQAhC0H9ACEKIAEhAAJAAkACQCACQf8BcUEBaw4FBwUAAQIEC0ECIQtB+wAhCgwFC0EDIQtB9QAhCgwEC0EEIQtB3AAhCgwDC0GAgMQAIQAgAyEKIANBgIDEAEcNAwsCf0EBIARBgAFJDQAaQQIgBEGAEEkNABpBA0EEIARBgIAESRsLIAZqIQIMBAsgAkEBIAMbIQtBMEHXACABIANBAnR2QQ9xIgBBCkkbIABqIQogA0EBa0EAIAMbIQMLIAEhAAsgDCAKIA4RAABFDQALQQEMCAsgBiAJayAIaiEGIAggD0cNAQwCCwsgByAFIAIgBkHgqMAAEJkBAAsgAkUEQEEAIQIMAQsgAiAFTwRAIAIgBUYNAQwECyACIAdqLAAAQb9/TA0DCyAMIAIgB2ogBSACayANKAIMEQEARQ0BC0EBDAILIAxBIiAOEQAADAELIAcgBSACIAVB8KjAABCZAQALCxYAQdjIwAAgADYCAEHUyMAAQQE6AAALEwAgAEHMocAANgIEIAAgATYCAAsQACABIAAoAgAgACgCBBAnCw0AIAAtABhBEHFBBHYLDQAgAC0AGEEgcUEFdgsMACAAIAEgAhBrQQALCgAgACABIAIQLwuTBAEFfyAAKAIAIQAjAEEQayIDJAACQAJ/AkACQCABQYABTwRAIANBADYCDCABQYAQSQ0BIAFBgIAETw0CIAMgAUE/cUGAAXI6AA4gAyABQQx2QeABcjoADCADIAFBBnZBP3FBgAFyOgANQQMMAwsgACgCCCICIAAoAgBGBEAjAEEgayIEJAACQAJAIAJBAWoiAkUNAEEIIAAoAgAiBUEBdCIGIAIgAiAGSRsiAiACQQhNGyICQX9zQR92IQYCQCAFBEAgBEEBNgIYIAQgBTYCFCAEIABBBGooAgA2AhAMAQsgBEEANgIYCyAEIAIgBiAEQRBqEEMgBCgCBCEFIAQoAgBFBEAgACACNgIAIAAgBTYCBAwCCyAEQQhqKAIAIgJBgYCAgHhGDQEgAkUNACAFIAIQsgEACxBtAAsgBEEgaiQAIAAoAgghAgsgACACQQFqNgIIIAAoAgQgAmogAToAAAwDCyADIAFBP3FBgAFyOgANIAMgAUEGdkHAAXI6AAxBAgwBCyADIAFBP3FBgAFyOgAPIAMgAUEGdkE/cUGAAXI6AA4gAyABQQx2QT9xQYABcjoADSADIAFBEnZBB3FB8AFyOgAMQQQLIQEgASAAKAIAIAAoAggiAmtLBEAgACACIAEQQSAAKAIIIQILIAAoAgQgAmogA0EMaiABELQBGiAAIAEgAmo2AggLIANBEGokAEEACw4AIAAoAgAaA0AMAAsAC3YBAX8jAEEwayIDJAAgAyABNgIEIAMgADYCACADQRRqQQI2AgAgA0EcakECNgIAIANBLGpBJDYCACADQeSpwAA2AhAgA0EANgIIIANBJDYCJCADIANBIGo2AhggAyADQQRqNgIoIAMgAzYCICADQQhqIAIQcgALdgEBfyMAQTBrIgMkACADIAE2AgQgAyAANgIAIANBFGpBAjYCACADQRxqQQI2AgAgA0EsakEkNgIAIANBhKrAADYCECADQQA2AgggA0EkNgIkIAMgA0EgajYCGCADIANBBGo2AiggAyADNgIgIANBCGogAhByAAt2AQF/IwBBMGsiAyQAIAMgATYCBCADIAA2AgAgA0EUakECNgIAIANBHGpBAjYCACADQSxqQSQ2AgAgA0G4qsAANgIQIANBADYCCCADQSQ2AiQgAyADQSBqNgIYIAMgA0EEajYCKCADIAM2AiAgA0EIaiACEHIACw0AIAA1AgBBASABEDULDQAgACgCACABIAIQLgsLACAAIwBqJAAjAAsHACAAEJABCwwAQaCfwABBMhAgAAsZACAAIAFB9MjAACgCACIAQTkgABsRAgAACwoAIAIgACABECcLswIBB38CQCACIgRBD00EQCAAIQIMAQsgAEEAIABrQQNxIgNqIQUgAwRAIAAhAiABIQYDQCACIAYtAAA6AAAgBkEBaiEGIAJBAWoiAiAFSQ0ACwsgBSAEIANrIghBfHEiB2ohAgJAIAEgA2oiA0EDcSIEBEAgB0EATA0BIANBfHEiBkEEaiEBQQAgBEEDdCIJa0EYcSEEIAYoAgAhBgNAIAUgBiAJdiABKAIAIgYgBHRyNgIAIAFBBGohASAFQQRqIgUgAkkNAAsMAQsgB0EATA0AIAMhAQNAIAUgASgCADYCACABQQRqIQEgBUEEaiIFIAJJDQALCyAIQQNxIQQgAyAHaiEBCyAEBEAgAiAEaiEDA0AgAiABLQAAOgAAIAFBAWohASACQQFqIgIgA0kNAAsLIAALnwEBA38CQCABIgJBD00EQCAAIQEMAQsgAEEAIABrQQNxIgRqIQMgBARAIAAhAQNAIAFBADoAACABQQFqIgEgA0kNAAsLIAMgAiAEayICQXxxIgRqIQEgBEEASgRAA0AgA0EANgIAIANBBGoiAyABSQ0ACwsgAkEDcSECCyACBEAgASACaiECA0AgAUEAOgAAIAFBAWoiASACSQ0ACwsgAAsJACAAQQA2AgALBAAgAQsEAEEACwUAQYAECwQAQQELDQBC7t7GuL39gorhAAsMAELr0N2RtuLCvEgLDQBCyLXgz8qG29OJfwsNAELPwqm27pmltJF/CwMAAQsDAAELC79ABQBBgIDAAAuRDGFzc2VydGlvbiBmYWlsZWQ6IG0gPD0gdXNpemU6Ok1BWCAvIDIvVXNlcnMveHh4eHh4eHh4Ly5jYXJnby9yZWdpc3RyeS9zcmMvZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzL2Jhc2U2NC1zaW1kLTAuOC4wL3NyYy9oZWFwLnJzACUAEABeAAAAFQAAAAkAAABBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvAwAAAAwAAAAEAAAABAAAAAUAAAAGAAAAYSBEaXNwbGF5IGltcGxlbWVudGF0aW9uIHJldHVybmVkIGFuIGVycm9yIHVuZXhwZWN0ZWRseQAHAAAAAAAAAAEAAAAIAAAAL3J1c3RjL2Q1YTgyYmJkMjZlMWFkOGI3NDAxZjZhNzE4YTljNTdjOTY5MDU0ODMvbGlicmFyeS9hbGxvYy9zcmMvc3RyaW5nLnJzADQBEABLAAAA6AkAAAkAAAAvcnVzdGMvZDVhODJiYmQyNmUxYWQ4Yjc0MDFmNmE3MThhOWM1N2M5NjkwNTQ4My9saWJyYXJ5L2NvcmUvc3JjL3N0ci9wYXR0ZXJuLnJzAJABEABPAAAApwUAACEAAACQARAATwAAALMFAAAUAAAAkAEQAE8AAACzBQAAIQAAAGNhbGxlZCBgT3B0aW9uOjp1bndyYXAoKWAgb24gYSBgTm9uZWAgdmFsdWVhc3NlcnRpb24gZmFpbGVkOiBzZWxmLmlzX2NoYXJfYm91bmRhcnkoaWR4KQA0ARAASwAAACsGAAAJAAAAkAEQAE8AAAA3BAAAFwAAAHNyYy9saWIucnMAAIgCEAAKAAAAVAAAAA4AAAAvPSshMUAyIzMkNCU1XjYmNyo4KDkpMC2IAhAACgAAACoAAAAhAAAAVXV4aXBkXwAAABAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABAAAAAAAIgCEAAKAAAAQQAAAB8AAABJbnZhbGlkIGVudHJ5AAAAAAAQAAAAAAAAABAAAAAAAAkAAAAEAAAABAAAAAoAAAALAAAADAAAAC9ydXN0Yy9kNWE4MmJiZDI2ZTFhZDhiNzQwMWY2YTcxOGE5YzU3Yzk2OTA1NDgzL2xpYnJhcnkvY29yZS9zcmMvc3RyL3BhdHRlcm4ucnMAVAMQAE8AAACnBQAAIQAAAFQDEABPAAAAswUAABQAAABUAxAATwAAALMFAAAhAAAAVAMQAE8AAAA3BAAAFwAAAC9Vc2Vycy9vb29vb29vb28vLmNhcmdvL3JlZ2lzdHJ5L3NyYy9naXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjMvcmFuZC0wLjguNS9zcmMvZGlzdHJpYnV0aW9ucy91bmlmb3JtLnJz5AMQAGgAAAA5AgAAAQAAAFVuaWZvcm1TYW1wbGVyOjpzYW1wbGVfc2luZ2xlX2luY2x1c2l2ZTogbG93ID4gaGlnaGNhbm5vdCBzYW1wbGUgZW1wdHkgcmFuZ2UvVXNlcnMveHh4eHh4eHh4Ly5jYXJnby9yZWdpc3RyeS9zcmMvZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzL3JhbmQtMC44LjUvc3JjL3JuZy5ycwAAqAQQAFYAAACGAAAACQAAAC9Vc2Vycy9vb29vb29vb28vLmNhcmdvL3JlZ2lzdHJ5L3NyYy9naXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjMvcmFuZF9jb3JlLTAuNi40L3NyYy9ibG9jay5ycwAAABAFEABdAAAAvwAAABUAAABhc3NlcnRpb24gZmFpbGVkOiBpbmRleCA8IHNlbGYucmVzdWx0cy5hc19yZWYoKS5sZW4oKQAAABAFEABdAAAArwAAAAkAAAANAAAAAAAAAAEAAAAOAAAADwAAABAAAAARAAAAAAAAAAEAAAAOAAAADwAAABAAAAARAAAABAAAAAQAAAASAAAAEwAAABQAAAAVAEGcjMAAC80PL1VzZXJzL3h4eHh4eHh4eC8uY2FyZ28vcmVnaXN0cnkvc3JjL2dpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyMy9yYW5kX2NoYWNoYS0wLjMuMS9zcmMvZ3V0cy5ycwAAHAYQAF4AAACkAAAAJwAAAGNhbGxlZCBgT3B0aW9uOjp1bndyYXAoKWAgb24gYSBgTm9uZWAgdmFsdWVjb3VsZCBub3QgaW5pdGlhbGl6ZSB0aHJlYWRfcm5nOiC3BhAAIQAAAC9Vc2Vycy9vb29vb29vb28vLmNhcmdvL3JlZ2lzdHJ5L3NyYy9naXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjMvcmFuZC0wLjguNS9zcmMvcm5ncy90aHJlYWQucnMAAOAGEABeAAAASAAAABEAAABjYW5ub3QgYWNjZXNzIGEgVGhyZWFkIExvY2FsIFN0b3JhZ2UgdmFsdWUgZHVyaW5nIG9yIGFmdGVyIGRlc3RydWN0aW9uAAAXAAAAAAAAAAEAAAAYAAAAL3J1c3RjL2Q1YTgyYmJkMjZlMWFkOGI3NDAxZjZhNzE4YTljNTdjOTY5MDU0ODMvbGlicmFyeS9zdGQvc3JjL3RocmVhZC9sb2NhbC5ycwCoBxAATwAAAKYBAAAJAAAABAAAAC9Vc2Vycy9vb29vb29vb28vLmNhcmdvL3JlZ2lzdHJ5L3NyYy9naXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjMvcmFuZF9jaGFjaGEtMC4zLjEvc3JjL2d1dHMucnMAAAwIEABeAAAA5gAAAAUAAAAZAAAABAAAAAQAAAAaAAAAGQAAAAQAAAAEAAAAGwAAABoAAAB8CBAAHAAAAB0AAAAeAAAAHAAAAB8AAAC4CBAAAAAAAGNvdWxkIG5vdCByZXRyaWV2ZSByYW5kb20gYnl0ZXMgZm9yIHV1aWQ6IAAAwAgQACoAAAAvVXNlcnMveHh4eHh4eHh4Ly5jYXJnby9yZWdpc3RyeS9zcmMvZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzL3V1aWQtMS40LjAvc3JjL3JuZy5ycwAA9AgQAFYAAAAJAAAADQAAADAxMjM0NTY3ODlBQkNERUYwMTIzNDU2Nzg5YWJjZGVmL1VzZXJzL3h4eHh4eHh4eC8uY2FyZ28vcmVnaXN0cnkvc3JjL2dpdGh1Yi5jb20tMWVjYzYyOTlkYjllYzgyMy91dWlkLTEuNC4wL3NyYy9mbXQucnMAAHwJEABWAAAApwAAABUAAAB8CRAAVgAAAKoAAAANAAAAfAkQAFYAAACrAAAADQAAAHwJEABWAAAArwAAAA0AAAAhAAAAY3J5cHRvY2Fubm90IGFjY2VzcyBhIFRocmVhZCBMb2NhbCBTdG9yYWdlIHZhbHVlIGR1cmluZyBvciBhZnRlciBkZXN0cnVjdGlvbiIAAAAAAAAAAQAAABgAAAAvcnVzdGMvZDVhODJiYmQyNmUxYWQ4Yjc0MDFmNmE3MThhOWM1N2M5NjkwNTQ4My9saWJyYXJ5L3N0ZC9zcmMvdGhyZWFkL2xvY2FsLnJzAHQKEABPAAAApgEAAAkAAABkZXNjcmlwdGlvbigpIGlzIGRlcHJlY2F0ZWQ7IHVzZSBEaXNwbGF5RXJyb3J1bmtub3duX2NvZGUAAAAlAAAABAAAAAQAAAAmAAAAaW50ZXJuYWxfY29kZWRlc2NyaXB0aW9uJQAAAAgAAAAEAAAAJwAAAG9zX2Vycm9yJQAAAAQAAAAEAAAAKAAAAFVua25vd24gRXJyb3I6IABgCxAADwAAAE9TIEVycm9yOiAAAHgLEAAKAAAATm9kZS5qcyBFUyBtb2R1bGVzIGFyZSBub3QgZGlyZWN0bHkgc3VwcG9ydGVkLCBzZWUgaHR0cHM6Ly9kb2NzLnJzL2dldHJhbmRvbSNub2RlanMtZXMtbW9kdWxlLXN1cHBvcnRDYWxsaW5nIE5vZGUuanMgQVBJIGNyeXB0by5yYW5kb21GaWxsU3luYyBmYWlsZWROb2RlLmpzIGNyeXB0byBDb21tb25KUyBtb2R1bGUgaXMgdW5hdmFpbGFibGVyYW5kU2VjdXJlOiBWeFdvcmtzIFJORyBtb2R1bGUgaXMgbm90IGluaXRpYWxpemVkQ2FsbGluZyBXZWIgQVBJIGNyeXB0by5nZXRSYW5kb21WYWx1ZXMgZmFpbGVkV2ViIENyeXB0byBBUEkgaXMgdW5hdmFpbGFibGVSRFJBTkQ6IGluc3RydWN0aW9uIG5vdCBzdXBwb3J0ZWRSRFJBTkQ6IGZhaWxlZCBtdWx0aXBsZSB0aW1lczogQ1BVIGlzc3VlIGxpa2VseVJ0bEdlblJhbmRvbTogV2luZG93cyBzeXN0ZW0gZnVuY3Rpb24gZmFpbHVyZVNlY1JhbmRvbUNvcHlCeXRlczogaU9TIFNlY3VyaXR5IGZyYW1ld29yayBmYWlsdXJlZXJybm86IGRpZCBub3QgcmV0dXJuIGEgcG9zaXRpdmUgdmFsdWVnZXRyYW5kb206IHRoaXMgdGFyZ2V0IGlzIG5vdCBzdXBwb3J0ZWQAAAAnAAAAJgAAAAAAAAAyAAAALQAAAC8AAAAhAAAAHQAAAC0AQfSbwAALMzEAAAAtAAAAMAAAAGUAAACeDRAAeA0QAAAAAABGDRAAGQ0QAOoMEADJDBAArAwQAH8MEABBsJzAAAuBJE4MEAAhDBAA8QsQAIwLEAApAAAAcmV0dXJuIHRoaXMAVHJpZWQgdG8gc2hyaW5rIHRvIGEgbGFyZ2VyIGNhcGFjaXR5UA4QACQAAAAvcnVzdGMvZDVhODJiYmQyNmUxYWQ4Yjc0MDFmNmE3MThhOWM1N2M5NjkwNTQ4My9saWJyYXJ5L2FsbG9jL3NyYy9yYXdfdmVjLnJzfA4QAEwAAACqAQAACQAAACoAAAAEAAAABAAAACsAAABjYW5ub3QgYWNjZXNzIGEgVGhyZWFkIExvY2FsIFN0b3JhZ2UgdmFsdWUgZHVyaW5nIG9yIGFmdGVyIGRlc3RydWN0aW9uAAAsAAAAAAAAAAEAAAAYAAAAL3J1c3RjL2Q1YTgyYmJkMjZlMWFkOGI3NDAxZjZhNzE4YTljNTdjOTY5MDU0ODMvbGlicmFyeS9zdGQvc3JjL3RocmVhZC9sb2NhbC5ycwBADxAATwAAAKYBAAAJAAAAY2xvc3VyZSBpbnZva2VkIHJlY3Vyc2l2ZWx5IG9yIGFmdGVyIGJlaW5nIGRyb3BwZWQAADoAAAAEAAAABAAAADsAAAA8AAAAPQAAAGNhbGxlZCBgT3B0aW9uOjp1bndyYXAoKWAgb24gYSBgTm9uZWAgdmFsdWVBY2Nlc3NFcnJvcm1lbW9yeSBhbGxvY2F0aW9uIG9mICBieXRlcyBmYWlsZWQKAAAAIhAQABUAAAA3EBAADgAAAGxpYnJhcnkvc3RkL3NyYy9hbGxvYy5yc1gQEAAY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";

var wasmModule = null;
var wasmExports = null;

// WASM bindgen helpers
var wasmHeap = new Array(128).fill(undefined);
wasmHeap.push(undefined, null, true, false);
var wasmHeapNext = wasmHeap.length;

function addHeapObject(obj) { if(wasmHeapNext===wasmHeap.length) wasmHeap.push(wasmHeap.length+1); var idx=wasmHeapNext; wasmHeapNext=wasmHeap[idx]; wasmHeap[idx]=obj; return idx; }
function getObject(idx) { return wasmHeap[idx]; }
function dropObject(idx) { if(idx<132) return; wasmHeap[idx]=wasmHeapNext; wasmHeapNext=idx; }
function takeObject(idx) { var ret=getObject(idx); dropObject(idx); return ret; }

var cachedUint8Mem = null, cachedInt32Mem = null;
function getUint8Mem() { if(!cachedUint8Mem || cachedUint8Mem.byteLength===0) cachedUint8Mem=new Uint8Array(wasmExports.memory.buffer); return cachedUint8Mem; }
function getInt32Mem() { if(!cachedInt32Mem || cachedInt32Mem.byteLength===0) cachedInt32Mem=new Int32Array(wasmExports.memory.buffer); return cachedInt32Mem; }

var textEnc = new TextEncoder('utf-8');
var textDec = new TextDecoder('utf-8', {ignoreBOM:true,fatal:true});
var WASM_VEC_LEN = 0;

function passStr(arg, malloc, realloc) {
    var buf = textEnc.encode(arg);
    var ptr = malloc(buf.length, 1) >>> 0;
    getUint8Mem().subarray(ptr, ptr + buf.length).set(buf);
    WASM_VEC_LEN = buf.length;
    return ptr;
}
function getStr(ptr, len) { return textDec.decode(getUint8Mem().subarray(ptr>>>0, (ptr>>>0)+len)); }

function handleError(f, args) { try { return f.apply(null, args); } catch(e) { wasmExports.__wbindgen_exn_store(addHeapObject(e)); } }

var wasmImports = { wbg: {
    __wbindgen_string_get: function(arg0, arg1) {
        var obj=getObject(arg1); var ret=typeof obj==='string'?obj:undefined;
        var ptr1=typeof ret==='undefined'?0:passStr(ret,wasmExports.__wbindgen_malloc,wasmExports.__wbindgen_realloc);
        var len1=WASM_VEC_LEN;
        getInt32Mem()[arg0/4+1]=len1; getInt32Mem()[arg0/4+0]=ptr1;
    },
    __wbindgen_object_drop_ref: function(arg0) { takeObject(arg0); },
    __wbindgen_string_new: function(arg0,arg1) { return addHeapObject(getStr(arg0,arg1)); },
    __wbg_instanceof_Window_e266f02eee43b570: function(arg0) { try { return getObject(arg0) instanceof Object; } catch(e) { return false; } },
    __wbg_get_e6ae480a4b8df368: function(arg0,arg1,arg2) { var obj=getObject(arg0); var key=getStr(arg1,arg2); var val=obj[key]; log('[WASM-GET] key="' + key + '", val=' + (typeof val === 'string' ? '"' + val.substring(0, 60) + '"' : typeof val)); return typeof val==='undefined'?0:addHeapObject(val); },
    __wbg_crypto_c48a774b022d20ac: function(arg0) { return addHeapObject(getObject(arg0).crypto); },
    __wbindgen_is_object: function(arg0) { var v=getObject(arg0); return typeof v==='object'&&v!==null?1:0; },
    __wbg_process_298734cf255a885d: function(arg0) { return addHeapObject(getObject(arg0).process); },
    __wbg_versions_e2e78e134e3e5d01: function(arg0) { return addHeapObject(getObject(arg0).versions); },
    __wbg_node_1cd7a5d853dbea79: function(arg0) { return addHeapObject(getObject(arg0).node); },
    __wbindgen_is_string: function(arg0) { return typeof getObject(arg0)==='string'?1:0; },
    __wbg_require_8f08ceecec0f4fee: function() { return handleError(function() { return addHeapObject(undefined); }, arguments); },
    __wbg_msCrypto_bcb970640f50a1e8: function(arg0) { return addHeapObject(getObject(arg0).msCrypto); },
    __wbg_getRandomValues_37fa2ca9e4e07fab: function(arg0,arg1) { getObject(arg0).getRandomValues(getObject(arg1)); },
    __wbg_randomFillSync_dc1e9a60c158336d: function(arg0,arg1) { getObject(arg0).randomFillSync(getObject(arg1)); },
    __wbindgen_is_function: function(arg0) { return typeof getObject(arg0)==='function'?1:0; },
    __wbg_newnoargs_2b8b6bd7753c76ba: function(arg0,arg1) { throw new Error("newnoargs blocked"); },
    __wbg_call_95d1ea488d03e4e8: function() { return handleError(function(arg0,arg1) { return addHeapObject(getObject(arg0).call(getObject(arg1))); }, arguments); },
    __wbg_new_f9876326328f45ed: function() { return addHeapObject(new Object()); },
    __wbg_self_e7c1f827057f6584: function() { return handleError(function() { return addHeapObject(self); }, arguments); },
    __wbg_window_a09ec664e14b1b81: function() { return handleError(function() { return addHeapObject(window); }, arguments); },
    __wbg_globalThis_87cbb8506fecf3a9: function() { return handleError(function() { return addHeapObject(globalThis); }, arguments); },
    __wbg_global_c85a9259e621f3db: function() { return handleError(function() { return addHeapObject(window); }, arguments); },
    __wbindgen_is_undefined: function(arg0) { return getObject(arg0)===undefined?1:0; },
    __wbg_call_9495de66fdbe016b: function() { return handleError(function(arg0,arg1,arg2) { return addHeapObject(getObject(arg0).call(getObject(arg1),getObject(arg2))); }, arguments); },
    __wbg_buffer_cf65c07de34b9a08: function(arg0) { return addHeapObject(getObject(arg0).buffer); },
    __wbg_newwithbyteoffsetandlength_9fb2f11355ecadf5: function(arg0,arg1,arg2) { return addHeapObject(new Uint8Array(getObject(arg0),arg1>>>0,arg2>>>0)); },
    __wbg_new_537b7341ce90bb31: function(arg0) { return addHeapObject(new Uint8Array(getObject(arg0))); },
    __wbg_set_17499e8aa4003ebd: function(arg0,arg1,arg2) { getObject(arg0).set(getObject(arg1),arg2>>>0); },
    __wbg_newwithlength_b56c882b57805732: function(arg0) { return addHeapObject(new Uint8Array(arg0>>>0)); },
    __wbg_subarray_7526649b91a252a6: function(arg0,arg1,arg2) { return addHeapObject(getObject(arg0).subarray(arg1>>>0,arg2>>>0)); },
    __wbindgen_object_clone_ref: function(arg0) { return addHeapObject(getObject(arg0)); },
    __wbindgen_throw: function(arg0,arg1) { throw new Error(getStr(arg0,arg1)); },
    __wbindgen_memory: function() { return addHeapObject(wasmExports.memory); }
}};

function wasmA() {
    var o,q;
    try {
        var retptr=wasmExports.__wbindgen_add_to_stack_pointer(-16);
        wasmExports.a(retptr);
        var e=getInt32Mem()[retptr/4+0], f=getInt32Mem()[retptr/4+1], s=getInt32Mem()[retptr/4+2], m=getInt32Mem()[retptr/4+3];
        o=e; q=f;
        if(m) { o=0; q=0; throw takeObject(s); }
        return getStr(o,q);
    } finally {
        wasmExports.__wbindgen_add_to_stack_pointer(16);
        wasmExports.__wbindgen_free(o,q);
    }
}

function wasmB(input) {
    var o,q;
    try {
        var retptr=wasmExports.__wbindgen_add_to_stack_pointer(-16);
        var ptr0=passStr(input,wasmExports.__wbindgen_malloc,wasmExports.__wbindgen_realloc);
        var len0=WASM_VEC_LEN;
        wasmExports.b(retptr,ptr0,len0);
        var e=getInt32Mem()[retptr/4+0], f=getInt32Mem()[retptr/4+1], s=getInt32Mem()[retptr/4+2], m=getInt32Mem()[retptr/4+3];
        o=e; q=f;
        if(m) { o=0; q=0; throw takeObject(s); }
        return getStr(o,q);
    } finally {
        wasmExports.__wbindgen_add_to_stack_pointer(16);
        wasmExports.__wbindgen_free(o,q);
    }
}

async function initWasm(pxUuid) {
    if (pxUuid) window._pxUuid = pxUuid;
    var binary = Uint8Array.from(atob(WASM_B64), function(c) { return c.charCodeAt(0); });
    var instance = await WebAssembly.instantiate(binary.buffer, wasmImports);
    wasmExports = instance.instance.exports;
    wasmModule = instance;
    log('WASM 初始化完成');
    return { a: wasmA, b: wasmB };
}

// ── 鼠标轨迹 (内嵌 5 份) ──

var MOUSE_TRACKS = [
    {"mouseTrackFull":["532,843,18189","431,637,18190","372,505,18191","381,520,18192","378,521,18193","366,520,18194","362,514,18195","362,516,18196","369,514,18197","366,513,18198","387,515,18199","365,524,18200","374,504,18201","370,521,18202","365,520,18203","367,521,18204","377,505,18205","377,514,18206","380,519,18207","371,521,18210","362,517,18212","368,512,18217","376,523,18221","376,521,18226","363,523,18230","371,508,18236","375,512,18241","377,519,18248","369,522,18255","362,510,18261","373,510,18270","377,518,18278","373,521,18287","367,522,18296","366,508,18306","379,514,18317","375,521,18327","369,521,18337","364,515,18345","376,508,18353","378,521,18361","377,519,18368","368,523,18375","368,509,18382","373,510,18388","373,524,18392","371,522,18398","360,518,18402","378,512,18406","371,523,18410","373,524,18414","374,510,18416","378,522,18420","373,521,18422","366,521,18424","374,509,18426","372,508,18428","369,521,18429","362,518,18430","379,513,18431","378,511,18432","377,517,18433","375,524,18434","382,518,18435","379,513,18436","375,526,18437","380,519,18438","384,510,18439","378,506,18440","372,516,18441","375,516,19790","435,524,19793","495,529,19816","550,536,19838","608,543,19842","609,543,19851","608,543,19859","607,544,19866","608,542,19875","608,544,19878","608,543,19885","608,542,19889","608,542,19895","608,542,19901","609,542,19905","607,542,19910","607,542,19915","607,542,19919","608,542,19925","607,542,19928","608,542,19936","607,542,19938","607,543,19940","607,543,19947","607,542,19951","607,543,19956","607,541,19964","607,542,19974","607,542,19984","607,542,19994","606,542,19999","607,543,20001","607,542,20005","608,542,20011","606,542,20016","607,543,20020","607,543,20026","607,541,20036","605,541,20041","607,542,20046","606,542,20049","605,542,20057","606,543,20063","606,542,20065","605,541,20072","605,542,20075","607,542,20080","606,542,20082","607,542,20085","606,541,20092","606,542,20102","605,541,20107","605,544,20116","605,541,20123","606,542,20130","605,542,20138","605,541,20147","605,542,20151","603,542,20160","605,541,20168","605,542,20173","604,542,20183","606,540,20187","604,541,20195","604,541,20202","604,541,20207","605,542,20212","606,541,20214","604,541,20223","606,541,20231","604,541,20237","604,541,20247","603,541,20252","604,541,20259","604,541,20269","604,541,20277","603,541,20286","603,541,20290","603,542,20298","604,541,20305","604,541,20312","603,541,20315","604,541,20325","603,542,20334","603,541,20341","603,540,20346","603,542,20351","604,541,20355","603,541,20361","603,541,20366","603,540,20372","604,541,20377","603,542,20386","605,543,22324","602,543,22692"],"mouseTrackFiltered":["532,843,18189","372,505,18191","381,520,18192","378,521,18193","366,520,18194","366,513,18198","387,515,18199","365,524,18200","370,521,18202","365,520,18203","377,505,18205","380,519,18207","362,517,18212","368,512,18217","376,523,18221","376,521,18226","363,523,18230","371,508,18236","375,512,18241","377,519,18248","369,522,18255","362,510,18261","373,510,18270","373,521,18287","367,522,18296","366,508,18306","375,521,18327","369,521,18337","378,521,18361","377,519,18368","368,509,18382","360,518,18402","378,512,18406","371,523,18410","373,524,18414","373,521,18422","366,521,18424","374,509,18426","372,508,18428","369,521,18429","362,518,18430","379,513,18431","378,511,18432","377,517,18433","375,524,18434","382,518,18435","379,513,18436","375,526,18437","380,519,18438","384,510,18439","375,516,19790","435,524,19793","495,529,19816","608,543,19859","607,544,19866","608,542,19875","608,542,19895","608,542,19901","609,542,19905","607,542,19910","607,542,19915","607,542,19919","608,542,19925","608,542,19936","607,542,19951","607,543,19956","607,542,19974","606,542,19999","606,542,20016","607,541,20036","606,543,20063","606,542,20065","605,541,20072","605,541,20107","605,544,20116","605,541,20123","605,541,20147","605,542,20151","604,542,20183","606,541,20214","603,541,20252","604,541,20259","604,541,20269","604,541,20305","603,541,20315","603,541,20341","604,541,20355","603,541,20361","603,540,20372","603,542,20386","602,543,22692"],"mouseInteractions":[{"PX12343":"mouseout","PX11652":0,"PX11699":18191,"PX12270":"true"},{"PX12343":"mouseover","PX11652":1,"PX11699":18191,"PX12270":"true"},{"PX12343":"mouseout","PX11652":1,"PX11699":18201,"PX12270":"true"},{"PX12343":"mouseover","PX11652":2,"PX11699":18203,"PX12270":"true"},{"PX12343":"mouseout","PX11652":2,"PX11699":18212,"PX12270":"true"},{"PX12343":"mouseover","PX11652":4,"PX11699":18212,"PX12270":"true"},{"PX12343":"mouseout","PX11652":4,"PX11699":18248,"PX12270":"true"},{"PX12343":"mouseover","PX11652":0,"PX11699":18249,"PX12270":"true"},{"PX12343":"mouseout","PX11652":0,"PX11699":18327,"PX12270":"true"},{"PX12343":"mouseover","PX11652":2,"PX11699":18328,"PX12270":"true"},{"PX12343":"mouseout","PX11652":2,"PX11699":18402,"PX12270":"true"},{"PX12343":"mouseover","PX11652":4,"PX11699":18404,"PX12270":"true"},{"PX12343":"mouseout","PX11652":4,"PX11699":18428,"PX12270":"true"},{"PX12343":"mouseover","PX11652":0,"PX11699":18430,"PX12270":"true"},{"PX12343":"mouseout","PX11652":0,"PX11699":18438,"PX12270":"true"},{"PX12343":"mouseover","PX11652":2,"PX11699":18439,"PX12270":"true"},{"PX12343":"pointerup","PX11652":4,"PX11699":21438,"PX12270":"true"}],"pointerDown":{"offsetX":231.99,"offsetY":22.34,"clientX":608.5,"clientY":543.2,"ts":19842},"pointerUp":{"offsetX":231.25,"offsetY":19.62,"clientX":602.9,"clientY":542.3,"ts":21438},"mouseEvents4":[{"PX12343":"mousemove","PX12270":"true","PX12301":"532,843,18189|372,505,18191|381,520,18192|378,521,18193"},{"PX12343":"mouseout","PX12270":"true","PX11427":304,"PX12208":0,"PX11652":4,"PX11824":847,"PX11631":298,"PX12165":"div","PX12108":378,"PX12414":521,"PX11699":18193},{"PX12343":"mousemove","PX12270":"true","PX12301":"365,524,18200|370,521,18202"},{"PX12343":"mouseout","PX12270":"true","PX11427":345,"PX12208":0,"PX11652":3,"PX11824":847,"PX11631":64,"PX12165":"div","PX12108":370,"PX12414":521,"PX11699":18202},{"PX12343":"mousemove","PX12270":"true","PX12301":"376,521,18226|363,523,18230|371,508,18236|375,512,18241"},{"PX12343":"mouseout","PX12270":"true","PX11427":308,"PX12208":50.5,"PX11652":3,"PX11824":847,"PX11631":61,"PX12165":"div","PX12108":375,"PX12414":512,"PX11699":18241},{"PX12343":"mousemove","PX12270":"true","PX12301":"373,510,18270|373,521,18287|367,522,18296|366,508,18306"},{"PX12343":"mouseout","PX12270":"true","PX11427":0,"PX12208":50.5,"PX11652":2,"PX11824":847,"PX11631":179,"PX12165":"div","PX12108":366,"PX12414":508,"PX11699":18306}],"diffTrack":"0,0,18189|-160,-338,18191|9,15,18192|-3,1,18193|-12,-1,18194|0,-7,18198|21,2,18199|-22,9,18200|5,-3,18202|-5,-1,18203|12,-15,18205|3,14,18207|-18,-2,18212|6,-5,18217|8,11,18221|0,-2,18226|-13,2,18230|8,-15,18236|4,4,18241|2,7,18248|-8,3,18255|-7,-12,18261|11,0,18270|0,11,18287|-6,1,18296|-1,-14,18306|9,13,18327|-6,0,18337|9,0,18361|-1,-2,18368","trackSubset":["532,843,18189","378,521,18193","387,515,18199","365,520,18203","362,517,18212","376,521,18226","375,512,18241","362,510,18261","367,522,18296","369,521,18337","368,509,18382","371,523,18410","366,521,18424","369,521,18429","378,511,18432","382,518,18435","380,519,18438","435,524,19793","607,544,19866","608,542,19901","607,542,19915","608,542,19936","607,542,19974","607,541,20036","605,541,20072"],"domInteractCount":{"#px-captcha-wrapper>DIV1":1,"DIV2>DIV2":2,"#px-captcha-wrapper>DIV2":3,"#px-captcha":4,"DIV2>DIV4":5},"holdDuration":1596,"approachStartTs":18189,"pointerDownTs":19842,"pointerUpTs":21438,"totalPoints":165,"filteredPoints":91,"mouseEvent1":{"clientX":532,"clientY":843,"type":"mouseover","target":"#px-captcha-wrapper>DIV:nth-child(1)"}},
    {"mouseTrackFull":["748,832,25146","684,776,25147","633,740,25148","580,694,25149","523,642,25150","457,586,25151","398,532,25152","383,521,25153","386,518,25154","374,525,25155","383,521,25156","378,514,25157","380,509,25158","375,506,25159","378,514,25160","370,519,25161","377,515,25162","378,513,25163","381,521,25164","376,523,25165","383,513,25167","387,521,25170","387,522,25173","384,521,25178","369,513,25181","367,509,25186","369,506,25191","381,532,25196","379,525,25202","380,516,25209","383,512,25215","389,509,25222","388,513,25230","386,516,25238","385,517,25246","387,520,25255","372,514,25264","370,512,25272","375,512,25280","375,511,25287","376,506,25294","380,509,25299","379,513,25306","380,514,25311","373,521,25316","374,518,25321","366,521,25324","365,516,25329","369,515,25332","374,518,25336","372,514,25338","378,522,25341","380,527,25343","377,531,25345","376,527,25347","374,525,25349","374,525,25350","370,522,25351","388,515,25353","382,520,25354","387,531,25355","380,517,25356","383,514,25357","389,511,25358","386,516,25359","392,521,25360","382,519,25361","379,529,25362","382,505,25363","378,518,25364","382,518,26993","424,519,26994","473,521,26999","517,522,27015","566,521,27041","618,523,27057","672,524,27062","718,529,27063","718,529,27070","718,529,27080","718,530,27085","718,528,27093","718,529,27095","718,529,27101","718,529,27108","718,528,27111","717,530,27113","717,529,27120","717,530,27122","719,530,27130","717,529,27137","718,529,27142","718,529,27146","718,529,27153","718,529,27160","717,529,27166","717,530,27175","717,529,27183","717,529,27192","718,530,27200","717,529,27209","719,529,27218","718,529,27227","717,530,27234","716,529,27244","717,530,27251","718,529,27260","717,530,27264","717,530,27270","716,530,27274","717,529,27282","716,529,27289","717,530,27293","717,529,27295","716,530,27300","717,529,27309","717,528,27315","717,530,27323","717,530,27332","715,529,27336","716,530,27339","716,530,27346","716,530,27352","716,531,27362","717,530,27367","717,530,27369","716,529,27375","717,529,27382","716,530,27385","716,530,27387","716,530,27396","717,529,27400","715,530,27402","717,530,27411","716,530,27421","716,530,27423","716,530,27425","716,530,27429","716,529,27434","716,530,27440","715,530,27449","716,530,27458","716,530,27467","715,529,27475","716,530,27481","716,531,27484","716,530,27487","715,530,27494","716,529,27500","716,530,27507","716,530,27511","716,529,27514","714,531,27517","716,531,27522","716,531,27529","716,530,27539","715,530,27547","715,531,27550","716,528,29600","712,532,30176","718,532,30322","718,535,30885","714,536,31572"],"mouseTrackFiltered":["748,832,25146","684,776,25147","633,740,25148","580,694,25149","457,586,25151","383,521,25153","374,525,25155","378,514,25157","380,509,25158","375,506,25159","370,519,25161","377,515,25162","376,523,25165","383,513,25167","384,521,25178","369,513,25181","367,509,25186","369,506,25191","381,532,25196","379,525,25202","380,516,25209","389,509,25222","388,513,25230","386,516,25238","385,517,25246","387,520,25255","372,514,25264","370,512,25272","375,512,25280","375,511,25287","376,506,25294","380,509,25299","380,514,25311","373,521,25316","366,521,25324","365,516,25329","369,515,25332","377,531,25345","374,525,25349","370,522,25351","382,520,25354","380,517,25356","386,516,25359","382,519,25361","424,519,26994","473,521,26999","517,522,27015","566,521,27041","618,523,27057","718,530,27085","718,528,27093","718,529,27095","718,529,27101","718,528,27111","717,530,27113","717,530,27122","719,530,27130","717,529,27137","718,529,27146","718,529,27160","717,529,27166","717,529,27183","717,529,27192","719,529,27218","718,529,27227","717,530,27251","718,529,27260","717,530,27264","717,530,27270","717,529,27282","717,529,27295","717,528,27315","715,529,27336","716,530,27352","716,531,27362","717,530,27367","717,530,27369","716,530,27396","715,530,27402","716,530,27423","716,530,27425","716,530,27429","716,529,27434","716,530,27458","716,530,27481","716,529,27500","716,529,27514","716,530,27539","716,528,29600","714,536,31572"],"mouseInteractions":[{"PX12343":"mouseout","PX11652":0,"PX11699":25148,"PX12270":"true"},{"PX12343":"mouseover","PX11652":2,"PX11699":25150,"PX12270":"true"},{"PX12343":"mouseout","PX11652":2,"PX11699":25153,"PX12270":"true"},{"PX12343":"mouseover","PX11652":3,"PX11699":25156,"PX12270":"true"},{"PX12343":"mouseout","PX11652":3,"PX11699":25163,"PX12270":"true"},{"PX12343":"mouseover","PX11652":4,"PX11699":25166,"PX12270":"true"},{"PX12343":"mouseout","PX11652":4,"PX11699":25173,"PX12270":"true"},{"PX12343":"mouseover","PX11652":1,"PX11699":25173,"PX12270":"true"},{"PX12343":"mouseout","PX11652":1,"PX11699":25222,"PX12270":"true"},{"PX12343":"mouseover","PX11652":3,"PX11699":25224,"PX12270":"true"},{"PX12343":"mouseout","PX11652":3,"PX11699":25264,"PX12270":"true"},{"PX12343":"mouseover","PX11652":0,"PX11699":25266,"PX12270":"true"},{"PX12343":"mouseout","PX11652":0,"PX11699":25316,"PX12270":"true"},{"PX12343":"mouseover","PX11652":2,"PX11699":25318,"PX12270":"true"},{"PX12343":"mouseout","PX11652":2,"PX11699":25336,"PX12270":"true"},{"PX12343":"mouseover","PX11652":3,"PX11699":25339,"PX12270":"true"},{"PX12343":"mouseout","PX11652":3,"PX11699":25351,"PX12270":"true"},{"PX12343":"mouseover","PX11652":0,"PX11699":25354,"PX12270":"true"},{"PX12343":"mouseout","PX11652":0,"PX11699":25358,"PX12270":"true"},{"PX12343":"mouseover","PX11652":1,"PX11699":25359,"PX12270":"true"},{"PX12343":"mouseout","PX11652":1,"PX11699":26999,"PX12270":"true"},{"PX12343":"mouseover","PX11652":2,"PX11699":27000,"PX12270":"true"},{"PX12343":"pointerup","PX11652":4,"PX11699":28771,"PX12270":"true"}],"pointerDown":{"offsetX":335.02,"offsetY":10.86,"clientX":718.2,"clientY":529.3,"ts":27063},"pointerUp":{"offsetX":332.93,"offsetY":11.28,"clientX":715.7,"clientY":530.5,"ts":28771},"mouseEvents4":[{"PX12343":"mousemove","PX12270":"true","PX12301":"748,832,25146|684,776,25147"},{"PX12343":"mouseout","PX12270":"true","PX11427":0,"PX12208":50.5,"PX11652":4,"PX11824":847,"PX11631":948,"PX12165":"div","PX12108":684,"PX12414":776,"PX11699":25147},{"PX12343":"mousemove","PX12270":"true","PX12301":"378,514,25157|380,509,25158|375,506,25159|370,519,25161"},{"PX12343":"mouseout","PX12270":"true","PX11427":0,"PX12208":0,"PX11652":4,"PX11824":847,"PX11631":122,"PX12165":"div","PX12108":370,"PX12414":519,"PX11699":25161},{"PX12343":"mousemove","PX12270":"true","PX12301":"369,513,25181|367,509,25186|369,506,25191|381,532,25196"},{"PX12343":"mouseout","PX12270":"true","PX11427":301,"PX12208":0,"PX11652":2,"PX11824":847,"PX11631":948,"PX12165":"div","PX12108":381,"PX12414":532,"PX11699":25196},{"PX12343":"mousemove","PX12270":"true","PX12301":"388,513,25230|386,516,25238|385,517,25246"},{"PX12343":"mouseout","PX12270":"true","PX11427":373,"PX12208":50.5,"PX11652":4,"PX11824":847,"PX11631":51,"PX12165":"div","PX12108":385,"PX12414":517,"PX11699":25246}],"diffTrack":"0,0,25146|-64,-56,25147|-51,-36,25148|-53,-46,25149|-123,-108,25151|-74,-65,25153|-9,4,25155|4,-11,25157|2,-5,25158|-5,-3,25159|-5,13,25161|7,-4,25162|-1,8,25165|7,-10,25167|1,8,25178|-15,-8,25181|-2,-4,25186|2,-3,25191|12,26,25196|-2,-7,25202|1,-9,25209|9,-7,25222|-1,4,25230|-2,3,25238|-1,1,25246|2,3,25255|-15,-6,25264|-2,-2,25272|5,0,25280|0,-1,25287","trackSubset":["748,832,25146","580,694,25149","374,525,25155","375,506,25159","376,523,25165","369,513,25181","381,532,25196","389,509,25222","385,517,25246","370,512,25272","376,506,25294","373,521,25316","369,515,25332","370,522,25351","386,516,25359","473,521,26999","618,523,27057","718,529,27095","717,530,27113","717,529,27137","717,529,27166","719,529,27218","718,529,27260","717,529,27282","715,529,27336"],"domInteractCount":{"#px-captcha-wrapper>DIV1":1,"DIV2>DIV2":2,"#px-captcha-wrapper>DIV2":3,"#px-captcha":4,"DIV2>DIV4":5},"holdDuration":1708,"approachStartTs":25146,"pointerDownTs":27063,"pointerUpTs":28771,"totalPoints":163,"filteredPoints":90,"mouseEvent1":{"clientX":748,"clientY":832,"type":"mouseover","target":"#px-captcha-wrapper>DIV:nth-child(1)"}},
    {"mouseTrackFull":["662,636,21117","358,538,21118","347,538,21119","365,546,21120","374,534,21121","375,539,21122","368,542,21123","366,543,21124","360,545,21125","358,539,21126","363,535,21127","362,528,21128","371,525,21129","376,533,21130","374,540,21133","373,547,21137","366,552,21141","363,542,21146","362,539,21151","359,533,21157","363,529,21164","367,534,21171","370,535,21179","375,541,21188","363,533,21198","368,528,21208","372,534,21220","369,539,21232","371,543,21245","368,548,21260","362,543,21275","358,541,21291","355,533,21308","359,526,21327","368,529,21346","373,532,21364","380,540,21382","372,543,21398","367,542,21414","363,543,21428","356,540,21441","359,535,21453","364,535,21465","368,531,21475","363,539,21485","359,536,21494","360,531,21502","367,533,21509","369,535,21515","375,537,21522","374,543,21527","368,546,21532","362,547,21537","353,544,21540","354,535,21543","361,532,21546","367,527,21548","373,531,21551","372,537,21552","369,539,21553","368,546,21554","362,547,21555","362,540,21556","362,538,21557","367,542,21558","364,543,21559","358,543,21560","366,538,21561","370,538,22247","419,540,22248","469,543,22255","523,545,22275","575,546,22295","630,548,22302","678,551,22303","678,550,22313","678,550,22320","678,551,22329","678,551,22337","678,550,22344","678,551,22350","679,550,22359","677,551,22363","678,551,22371","675,550,22378","677,551,22380","678,551,22383","678,550,22385","678,550,22389","677,550,22393","677,551,22397","677,551,22400","677,551,22406","677,550,22416","678,551,22420","677,550,22430","677,551,22435","679,550,22441","678,551,22443","677,550,22448","676,550,22453","678,551,22457","677,549,22466","677,550,22474","677,550,22479","677,550,22487","677,551,22490","676,550,22498","676,551,22508","677,550,22515","678,551,22521","676,551,22526","676,550,22529","677,551,22539","675,550,22549","676,550,22555","676,550,22561","675,549,22564","676,550,22566","675,550,22572","676,550,22580","676,550,22589","676,550,22595","676,550,22602","676,549,22610","676,549,22618","677,550,22621","677,549,22630","677,550,22635","676,551,22643","676,549,22645","677,549,22650","676,550,22657","676,549,22661","675,550,22664","675,549,22668","674,550,22676","675,550,22679","677,550,22689","674,549,22695","674,549,22697","674,548,22707","675,549,22717","676,550,22725","675,549,22730","676,549,22737","676,549,22743","676,549,22747","675,549,22751","675,548,22759","675,548,22768","676,550,22775","674,549,22781","675,549,22788","674,549,22798","675,550,22801","675,548,22808","676,549,22815","675,549,22819","675,549,22821","675,549,22831","675,549,22833","675,549,22838","674,549,22848","675,549,22855","674,549,22857","675,549,22862","674,549,22871","675,549,22873","674,548,22882","674,548,22885","674,545,24562","674,544,24748","673,542,25155","672,543,25513"],"mouseTrackFiltered":["662,636,21117","358,538,21118","347,538,21119","365,546,21120","374,534,21121","375,539,21122","368,542,21123","366,543,21124","363,535,21127","362,528,21128","376,533,21130","373,547,21137","366,552,21141","363,542,21146","359,533,21157","370,535,21179","375,541,21188","363,533,21198","368,528,21208","372,534,21220","371,543,21245","362,543,21275","358,541,21291","355,533,21308","359,526,21327","368,529,21346","380,540,21382","372,543,21398","367,542,21414","363,543,21428","364,535,21465","368,531,21475","363,539,21485","369,535,21515","374,543,21527","368,546,21532","362,547,21537","354,535,21543","361,532,21546","367,527,21548","373,531,21551","372,537,21552","369,539,21553","368,546,21554","362,540,21556","362,538,21557","367,542,21558","364,543,21559","358,543,21560","366,538,21561","370,538,22247","419,540,22248","469,543,22255","523,545,22275","678,551,22303","678,550,22320","678,551,22329","678,550,22385","678,550,22389","677,550,22393","677,551,22397","677,551,22406","677,550,22416","678,551,22420","678,551,22443","677,550,22448","676,550,22453","678,551,22457","677,549,22466","677,550,22487","676,550,22498","676,550,22529","677,551,22539","676,550,22555","676,550,22561","676,550,22566","677,550,22621","677,549,22630","676,549,22645","676,549,22661","675,549,22668","674,550,22676","674,549,22695","676,549,22743","675,549,22751","674,549,22781","674,549,22798","675,550,22801","676,549,22815","675,549,22819","675,549,22831","674,549,22848","675,549,22855","675,549,22873","674,548,22885","674,545,24562","674,544,24748","673,542,25155","672,543,25513"],"mouseInteractions":[{"PX12343":"mouseout","PX11652":0,"PX11699":21118,"PX12270":"true"},{"PX12343":"mouseover","PX11652":1,"PX11699":21119,"PX12270":"true"},{"PX12343":"mouseout","PX11652":1,"PX11699":21123,"PX12270":"true"},{"PX12343":"mouseover","PX11652":2,"PX11699":21123,"PX12270":"true"},{"PX12343":"mouseout","PX11652":2,"PX11699":21129,"PX12270":"true"},{"PX12343":"mouseover","PX11652":3,"PX11699":21129,"PX12270":"true"},{"PX12343":"mouseout","PX11652":3,"PX11699":21157,"PX12270":"true"},{"PX12343":"mouseover","PX11652":0,"PX11699":21160,"PX12270":"true"},{"PX12343":"mouseout","PX11652":0,"PX11699":21198,"PX12270":"true"},{"PX12343":"mouseover","PX11652":1,"PX11699":21198,"PX12270":"true"},{"PX12343":"mouseout","PX11652":1,"PX11699":21308,"PX12270":"true"},{"PX12343":"mouseover","PX11652":3,"PX11699":21309,"PX12270":"true"},{"PX12343":"mouseout","PX11652":3,"PX11699":21382,"PX12270":"true"},{"PX12343":"mouseover","PX11652":0,"PX11699":21382,"PX12270":"true"},{"PX12343":"mouseout","PX11652":0,"PX11699":21485,"PX12270":"true"},{"PX12343":"mouseover","PX11652":1,"PX11699":21487,"PX12270":"true"},{"PX12343":"mouseout","PX11652":1,"PX11699":21515,"PX12270":"true"},{"PX12343":"mouseover","PX11652":2,"PX11699":21517,"PX12270":"true"},{"PX12343":"mouseout","PX11652":2,"PX11699":21548,"PX12270":"true"},{"PX12343":"mouseover","PX11652":3,"PX11699":21551,"PX12270":"true"},{"PX12343":"mouseout","PX11652":3,"PX11699":21557,"PX12270":"true"},{"PX12343":"mouseover","PX11652":4,"PX11699":21559,"PX12270":"true"},{"PX12343":"pointerup","PX11652":4,"PX11699":24133,"PX12270":"true"}],"pointerDown":{"offsetX":322.39,"offsetY":18.34,"clientX":678.3,"clientY":552,"ts":22303},"pointerUp":{"offsetX":322.22,"offsetY":20.04,"clientX":673.5,"clientY":546.4,"ts":24133},"mouseEvents4":[{"PX12343":"mousemove","PX12270":"true","PX12301":"662,636,21117|358,538,21118"},{"PX12343":"mouseout","PX12270":"true","PX11427":369,"PX12208":0,"PX11652":4,"PX11824":847,"PX11631":172,"PX12165":"div","PX12108":358,"PX12414":538,"PX11699":21118},{"PX12343":"mousemove","PX12270":"true","PX12301":"363,535,21127|362,528,21128|376,533,21130|373,547,21137"},{"PX12343":"mouseout","PX12270":"true","PX11427":367,"PX12208":0,"PX11652":2,"PX11824":847,"PX11631":73,"PX12165":"div","PX12108":373,"PX12414":547,"PX11699":21137},{"PX12343":"mousemove","PX12270":"true","PX12301":"375,541,21188|363,533,21198"},{"PX12343":"mouseout","PX12270":"true","PX11427":367,"PX12208":0,"PX11652":4,"PX11824":847,"PX11631":157,"PX12165":"div","PX12108":363,"PX12414":533,"PX11699":21198},{"PX12343":"mousemove","PX12270":"true","PX12301":"359,526,21327|368,529,21346|380,540,21382|372,543,21398"},{"PX12343":"mouseout","PX12270":"true","PX11427":316,"PX12208":50.5,"PX11652":2,"PX11824":847,"PX11631":948,"PX12165":"div","PX12108":372,"PX12414":543,"PX11699":21398}],"diffTrack":"0,0,21117|-304,-98,21118|-11,0,21119|18,8,21120|9,-12,21121|1,5,21122|-7,3,21123|-2,1,21124|-3,-8,21127|-1,-7,21128|14,5,21130|-3,14,21137|-7,5,21141|-3,-10,21146|-4,-9,21157|11,2,21179|5,6,21188|-12,-8,21198|5,-5,21208|4,6,21220|-1,9,21245|-9,0,21275|-4,-2,21291|-3,-8,21308|4,-7,21327|9,3,21346|12,11,21382|-8,3,21398|-5,-1,21414|-4,1,21428","trackSubset":["662,636,21117","365,546,21120","368,542,21123","362,528,21128","366,552,21141","370,535,21179","368,528,21208","362,543,21275","359,526,21327","372,543,21398","364,535,21465","369,535,21515","362,547,21537","367,527,21548","369,539,21553","362,538,21557","358,543,21560","419,540,22248","678,551,22303","678,550,22385","677,551,22397","678,551,22420","676,550,22453","677,550,22487","677,551,22539"],"domInteractCount":{"#px-captcha-wrapper>DIV1":1,"DIV2>DIV2":2,"#px-captcha-wrapper>DIV2":3,"#px-captcha":4,"DIV2>DIV4":5},"holdDuration":1830,"approachStartTs":21117,"pointerDownTs":22303,"pointerUpTs":24133,"totalPoints":175,"filteredPoints":99,"mouseEvent1":{"clientX":662,"clientY":636,"type":"mouseover","target":"#px-captcha-wrapper>DIV:nth-child(1)"}},
    {"mouseTrackFull":["726,907,25675","715,894,25676","707,884,25677","698,874,25678","689,862,25679","682,853,25680","674,842,25681","663,829,25682","656,822,25683","644,810,25684","634,800,25685","623,788,25687","614,778,25691","602,765,25695","594,756,25700","585,747,25706","574,738,25712","563,728,25720","552,719,25728","544,712,25737","534,703,25748","521,692,25759","508,681,25772","495,671,25785","484,661,25800","477,654,25817","467,642,25834","459,634,25853","446,622,25875","435,611,25896","427,604,25917","419,596,25936","413,588,25953","406,581,25969","396,567,25985","389,559,25999","381,548,26011","375,540,26023","364,529,26033","360,525,26042","363,528,26050","373,539,26057","377,543,26065","376,541,26070","368,534,26075","367,533,26079","372,539,26083","373,537,26085","364,535,26088","364,535,26090","372,538,26092","373,536,26093","366,538,26094","368,538,26095","378,535,26096","379,534,26097","372,536,26098","371,537,26099","375,537,26908","407,540,26909","437,542,26911","467,542,26919","498,543,26935","526,544,26957","561,546,26973","589,548,26981","621,550,26983","629,551,26985","629,551,26986","628,551,26995","629,552,27003","630,551,27009","631,552,27017","629,551,27021","630,552,27024","630,552,27028","630,551,27030","630,553,27039","628,551,27041","630,552,27047","631,552,27053","630,552,27059","630,552,27068","629,552,27071","631,552,27076","630,552,27083","631,552,27086","630,553,27088","630,552,27098","631,553,27106","629,553,27112","630,552,27118","631,552,27128","630,553,27135","631,553,27138","631,553,27146","631,554,27150","630,553,27152","629,553,27160","631,554,27168","630,553,27175","630,553,27178","631,553,27185","631,553,27190","632,554,27200","630,554,27202","631,554,27207","631,553,27215","632,553,27218","633,554,27226","632,555,27230","631,554,27240","631,555,27250","631,555,27259","631,555,27263","632,554,27266","630,555,27276","632,555,27282","633,555,27292","632,555,27296","632,556,27303","632,555,27309","632,554,27314","632,554,27324","632,555,27329","634,556,27338","633,554,27342","634,556,27344","632,556,27354","629,557,28714","629,555,29259","629,556,29428","631,557,29977","633,559,30592"],"mouseTrackFiltered":["726,907,25675","715,894,25676","707,884,25677","698,874,25678","689,862,25679","682,853,25680","674,842,25681","663,829,25682","656,822,25683","623,788,25687","594,756,25700","585,747,25706","574,738,25712","563,728,25720","552,719,25728","544,712,25737","534,703,25748","521,692,25759","508,681,25772","495,671,25785","484,661,25800","477,654,25817","467,642,25834","459,634,25853","435,611,25896","427,604,25917","419,596,25936","413,588,25953","396,567,25985","389,559,25999","381,548,26011","375,540,26023","360,525,26042","363,528,26050","373,539,26057","377,543,26065","376,541,26070","368,534,26075","367,533,26079","372,539,26083","364,535,26090","373,536,26093","366,538,26094","378,535,26096","372,536,26098","371,537,26099","375,537,26908","437,542,26911","498,543,26935","526,544,26957","621,550,26983","629,551,26986","631,552,27017","630,552,27028","630,553,27039","629,552,27071","631,552,27076","630,552,27118","631,552,27128","630,553,27135","631,554,27150","630,553,27152","630,553,27175","632,554,27200","631,554,27207","632,555,27230","631,554,27240","632,555,27282","633,555,27292","632,554,27314","632,554,27324","634,556,27344","629,557,28714","629,555,29259","629,556,29428","631,557,29977","633,559,30592"],"mouseInteractions":[{"PX12343":"mouseout","PX11652":0,"PX11699":25676,"PX12270":"true"},{"PX12343":"mouseover","PX11652":1,"PX11699":25676,"PX12270":"true"},{"PX12343":"mouseout","PX11652":1,"PX11699":25685,"PX12270":"true"},{"PX12343":"mouseover","PX11652":3,"PX11699":25685,"PX12270":"true"},{"PX12343":"mouseout","PX11652":3,"PX11699":25737,"PX12270":"true"},{"PX12343":"mouseover","PX11652":4,"PX11699":25739,"PX12270":"true"},{"PX12343":"mouseout","PX11652":4,"PX11699":25853,"PX12270":"true"},{"PX12343":"mouseover","PX11652":0,"PX11699":25855,"PX12270":"true"},{"PX12343":"mouseout","PX11652":0,"PX11699":25985,"PX12270":"true"},{"PX12343":"mouseover","PX11652":1,"PX11699":25988,"PX12270":"true"},{"PX12343":"mouseout","PX11652":1,"PX11699":26070,"PX12270":"true"},{"PX12343":"mouseover","PX11652":2,"PX11699":26072,"PX12270":"true"},{"PX12343":"mouseout","PX11652":2,"PX11699":26088,"PX12270":"true"},{"PX12343":"mouseover","PX11652":4,"PX11699":26090,"PX12270":"true"},{"PX12343":"mouseout","PX11652":4,"PX11699":26908,"PX12270":"true"},{"PX12343":"mouseover","PX11652":0,"PX11699":26910,"PX12270":"true"},{"PX12343":"pointerup","PX11652":4,"PX11699":28366,"PX12270":"true"}],"pointerDown":{"offsetX":262.13,"offsetY":17.64,"clientX":630,"clientY":551.6,"ts":26984},"pointerUp":{"offsetX":266.5,"offsetY":16.72,"clientX":631.8,"clientY":555.3,"ts":28366},"mouseEvents4":[{"PX12343":"mousemove","PX12270":"true","PX12301":"726,907,25675|715,894,25676|707,884,25677"},{"PX12343":"mouseout","PX12270":"true","PX11427":329,"PX12208":50.5,"PX11652":3,"PX11824":847,"PX11631":275,"PX12165":"div","PX12108":707,"PX12414":884,"PX11699":25677},{"PX12343":"mousemove","PX12270":"true","PX12301":"674,842,25681|663,829,25682|656,822,25683"},{"PX12343":"mouseout","PX12270":"true","PX11427":0,"PX12208":50.5,"PX11652":2,"PX11824":847,"PX11631":240,"PX12165":"div","PX12108":656,"PX12414":822,"PX11699":25683},{"PX12343":"mousemove","PX12270":"true","PX12301":"574,738,25712|563,728,25720|552,719,25728|544,712,25737"},{"PX12343":"mouseout","PX12270":"true","PX11427":343,"PX12208":0,"PX11652":4,"PX11824":847,"PX11631":948,"PX12165":"div","PX12108":544,"PX12414":712,"PX11699":25737},{"PX12343":"mousemove","PX12270":"true","PX12301":"495,671,25785|484,661,25800"},{"PX12343":"mouseout","PX12270":"true","PX11427":368,"PX12208":50.5,"PX11652":2,"PX11824":847,"PX11631":85,"PX12165":"div","PX12108":484,"PX12414":661,"PX11699":25800}],"diffTrack":"0,0,25675|-11,-13,25676|-8,-10,25677|-9,-10,25678|-9,-12,25679|-7,-9,25680|-8,-11,25681|-11,-13,25682|-7,-7,25683|-33,-34,25687|-29,-32,25700|-9,-9,25706|-11,-9,25712|-11,-10,25720|-11,-9,25728|-8,-7,25737|-10,-9,25748|-13,-11,25759|-13,-11,25772|-13,-10,25785|-11,-10,25800|-7,-7,25817|-10,-12,25834|-8,-8,25853|-24,-23,25896|-8,-7,25917|-8,-8,25936|-6,-8,25953|-17,-21,25985|-7,-8,25999","trackSubset":["726,907,25675","698,874,25678","674,842,25681","623,788,25687","574,738,25712","544,712,25737","508,681,25772","477,654,25817","435,611,25896","413,588,25953","381,548,26011","363,528,26050","376,541,26070","372,539,26083","366,538,26094","371,537,26099","498,543,26935","629,551,26986","630,553,27039","630,552,27118","631,554,27150","632,554,27200","631,554,27240","632,554,27314","629,557,28714"],"domInteractCount":{"#px-captcha-wrapper>DIV1":1,"DIV2>DIV2":2,"#px-captcha-wrapper>DIV2":3,"#px-captcha":4,"DIV2>DIV4":5},"holdDuration":1382,"approachStartTs":25675,"pointerDownTs":26984,"pointerUpTs":28366,"totalPoints":134,"filteredPoints":77,"mouseEvent1":{"clientX":726,"clientY":907,"type":"mouseover","target":"#px-captcha-wrapper>DIV:nth-child(1)"}},
    {"mouseTrackFull":["615,896,28428","582,851,28429","558,815,28430","519,765,28431","496,735,28432","462,690,28433","441,663,28434","409,621,28435","379,578,28436","361,545,28437","355,496,28438","358,517,28439","352,520,28440","356,516,28441","352,522,28442","356,520,28443","350,518,28444","362,516,28445","354,519,28446","356,516,28449","355,514,28453","361,520,28457","358,518,28461","358,520,28465","361,519,28470","359,518,28476","351,523,28482","355,521,28489","354,519,28496","348,512,28503","372,528,28511","347,513,28520","367,527,28528","341,509,28536","362,525,28543","341,501,28551","363,526,28557","349,513,28563","365,521,28569","362,520,28574","347,516,28578","362,517,28582","343,523,28586","363,514,28590","362,511,28593","351,522,28596","359,511,28599","349,532,28601","354,514,28603","356,524,28605","354,519,28606","344,517,28607","363,518,28608","349,524,28609","356,513,28610","355,516,28611","356,515,28612","356,519,28613","356,523,28614","354,514,28615","351,535,28616","363,508,28617","355,518,28618","359,518,30592","377,520,30593","395,520,30594","412,520,30595","432,521,30597","449,523,30601","464,523,30608","482,525,30616","501,526,30626","519,528,30633","537,529,30637","556,530,30640","573,531,30642","591,531,30643","600,532,30644","600,532,30650","600,533,30656","601,532,30662","599,531,30666","600,531,30671","600,532,30676","599,532,30684","599,533,30692","599,532,30697","598,532,30706","599,533,30710","599,531,30716","599,531,30719","599,531,30722","598,533,30730","598,532,30732","599,532,30738","597,532,30741","599,532,30746","599,532,30749","599,532,30755","598,532,30764","597,532,30766","597,532,30769","598,531,30775","597,532,30781","597,532,30783","598,532,30790","597,531,30798","598,531,30802","597,532,30806","598,533,30813","596,531,30822","596,532,30832","597,532,30841","596,532,30847","597,531,30855","596,532,30860","596,532,30866","596,532,30871","597,533,30881","596,532,30885","596,532,30889","595,532,30896","596,532,30899","595,532,30907","597,532,30912","596,531,30920","595,531,30925","594,530,30932","595,531,30937","595,532,30942","596,531,30945","595,531,30953","595,532,30956","595,532,30960","595,532,30964","595,532,30967","594,532,30973","595,531,30980","594,531,30989","594,531,30995","595,532,31001","593,532,31010","595,531,31016","594,532,31019","594,531,31026","593,532,31035","593,532,31041","594,531,31044","593,531,31050","593,531,31056","594,531,31062","593,532,32062","590,533,32339","591,534,32606","588,536,33223","590,539,34110","589,536,34954"],"mouseTrackFiltered":["615,896,28428","519,765,28431","496,735,28432","462,690,28433","441,663,28434","409,621,28435","379,578,28436","361,545,28437","355,496,28438","352,520,28440","356,516,28441","356,520,28443","350,518,28444","362,516,28445","354,519,28446","355,514,28453","361,520,28457","361,519,28470","359,518,28476","351,523,28482","355,521,28489","354,519,28496","341,509,28536","362,525,28543","341,501,28551","363,526,28557","349,513,28563","365,521,28569","362,520,28574","347,516,28578","362,517,28582","343,523,28586","363,514,28590","351,522,28596","349,532,28601","354,514,28603","356,524,28605","354,519,28606","356,513,28610","355,516,28611","356,515,28612","356,519,28613","356,523,28614","354,514,28615","351,535,28616","363,508,28617","395,520,30594","412,520,30595","449,523,30601","464,523,30608","501,526,30626","537,529,30637","600,533,30656","601,532,30662","600,531,30671","600,532,30676","598,532,30706","599,531,30719","598,533,30730","599,532,30746","599,532,30755","598,532,30764","597,532,30766","597,532,30783","598,532,30790","597,532,30806","596,532,30832","596,532,30847","597,531,30855","595,532,30896","596,532,30899","596,531,30920","595,531,30925","594,530,30932","595,531,30937","595,531,30953","595,532,30956","595,532,30960","594,531,30989","595,531,31016","594,532,31019","593,532,31041","593,531,31056","594,531,31062","593,532,32062","590,539,34110","589,536,34954"],"mouseInteractions":[{"PX12343":"mouseout","PX11652":0,"PX11699":28428,"PX12270":"true"},{"PX12343":"mouseover","PX11652":1,"PX11699":28428,"PX12270":"true"},{"PX12343":"mouseout","PX11652":1,"PX11699":28434,"PX12270":"true"},{"PX12343":"mouseover","PX11652":2,"PX11699":28434,"PX12270":"true"},{"PX12343":"mouseout","PX11652":2,"PX11699":28443,"PX12270":"true"},{"PX12343":"mouseover","PX11652":4,"PX11699":28446,"PX12270":"true"},{"PX12343":"mouseout","PX11652":4,"PX11699":28453,"PX12270":"true"},{"PX12343":"mouseover","PX11652":1,"PX11699":28455,"PX12270":"true"},{"PX12343":"mouseout","PX11652":1,"PX11699":28476,"PX12270":"true"},{"PX12343":"mouseover","PX11652":3,"PX11699":28478,"PX12270":"true"},{"PX12343":"mouseout","PX11652":3,"PX11699":28536,"PX12270":"true"},{"PX12343":"mouseover","PX11652":4,"PX11699":28537,"PX12270":"true"},{"PX12343":"mouseout","PX11652":4,"PX11699":28574,"PX12270":"true"},{"PX12343":"mouseover","PX11652":1,"PX11699":28577,"PX12270":"true"},{"PX12343":"mouseout","PX11652":1,"PX11699":28586,"PX12270":"true"},{"PX12343":"mouseover","PX11652":2,"PX11699":28588,"PX12270":"true"},{"PX12343":"mouseout","PX11652":2,"PX11699":28603,"PX12270":"true"},{"PX12343":"mouseover","PX11652":4,"PX11699":28603,"PX12270":"true"},{"PX12343":"mouseout","PX11652":4,"PX11699":28613,"PX12270":"true"},{"PX12343":"mouseover","PX11652":1,"PX11699":28614,"PX12270":"true"},{"PX12343":"mouseout","PX11652":1,"PX11699":28618,"PX12270":"true"},{"PX12343":"mouseover","PX11652":3,"PX11699":28620,"PX12270":"true"},{"PX12343":"mouseout","PX11652":3,"PX11699":30608,"PX12270":"true"},{"PX12343":"mouseover","PX11652":4,"PX11699":30611,"PX12270":"true"},{"PX12343":"pointerup","PX11652":4,"PX11699":31982,"PX12270":"true"}],"pointerDown":{"offsetX":227.97,"offsetY":13.77,"clientX":599.7,"clientY":532.3,"ts":30642},"pointerUp":{"offsetX":231.95,"offsetY":14.74,"clientX":594.3,"clientY":530.9,"ts":31982},"mouseEvents4":[{"PX12343":"mousemove","PX12270":"true","PX12301":"615,896,28428|519,765,28431|496,735,28432|462,690,28433"},{"PX12343":"mouseout","PX12270":"true","PX11427":347,"PX12208":0,"PX11652":4,"PX11824":847,"PX11631":948,"PX12165":"div","PX12108":462,"PX12414":690,"PX11699":28433},{"PX12343":"mousemove","PX12270":"true","PX12301":"361,545,28437|355,496,28438|352,520,28440"},{"PX12343":"mouseout","PX12270":"true","PX11427":364,"PX12208":50.5,"PX11652":3,"PX11824":847,"PX11631":125,"PX12165":"div","PX12108":352,"PX12414":520,"PX11699":28440},{"PX12343":"mousemove","PX12270":"true","PX12301":"354,519,28446|355,514,28453"},{"PX12343":"mouseout","PX12270":"true","PX11427":326,"PX12208":50.5,"PX11652":2,"PX11824":847,"PX11631":948,"PX12165":"div","PX12108":355,"PX12414":514,"PX11699":28453},{"PX12343":"mousemove","PX12270":"true","PX12301":"354,519,28496|341,509,28536"},{"PX12343":"mouseout","PX12270":"true","PX11427":0,"PX12208":50.5,"PX11652":4,"PX11824":847,"PX11631":948,"PX12165":"div","PX12108":341,"PX12414":509,"PX11699":28536}],"diffTrack":"0,0,28428|-96,-131,28431|-23,-30,28432|-34,-45,28433|-21,-27,28434|-32,-42,28435|-30,-43,28436|-18,-33,28437|-6,-49,28438|-3,24,28440|4,-4,28441|0,4,28443|-6,-2,28444|12,-2,28445|-8,3,28446|1,-5,28453|6,6,28457|0,-1,28470|-2,-1,28476|-8,5,28482|4,-2,28489|-1,-2,28496|-13,-10,28536|21,16,28543|-21,-24,28551|22,25,28557|-14,-13,28563|16,8,28569|-3,-1,28574|-15,-4,28578","trackSubset":["615,896,28428","462,690,28433","379,578,28436","352,520,28440","350,518,28444","355,514,28453","359,518,28476","354,519,28496","341,501,28551","365,521,28569","362,517,28582","351,522,28596","356,524,28605","355,516,28611","356,523,28614","363,508,28617","449,523,30601","537,529,30637","600,531,30671","599,531,30719","599,532,30755","597,532,30783","596,532,30832","595,532,30896","595,531,30925"],"domInteractCount":{"#px-captcha-wrapper>DIV1":1,"DIV2>DIV2":2,"#px-captcha-wrapper>DIV2":3,"#px-captcha":4,"DIV2>DIV4":5},"holdDuration":1340,"approachStartTs":28428,"pointerDownTs":30642,"pointerUpTs":31982,"totalPoints":157,"filteredPoints":87,"mouseEvent1":{"clientX":615,"clientY":896,"type":"mouseover","target":"#px-captcha-wrapper>DIV:nth-child(1)"}}
];

function getRandomTrack() {
    return MOUSE_TRACKS[Math.floor(Math.random() * MOUSE_TRACKS.length)];
}

// ── bundle3_generic.js (浏览器适配) ──

function _randInt(min, max) { return Math.floor(min + Math.random() * (max - min + 1)); }

// Event builders (完全复制自 bundle3_generic.js, 只去掉 require)

// ═══════════════════════════════════════════════════════════════════
// Bundle #3 Generic Events Builder
// 字段顺序严格对齐 event_json/bundle#3.json
// 值来源参考 event_js/bundle#3.js
//
// 用法:
//   var opts = await buildOpts(params);
//   var events = buildBundle3Events(opts);
// ═══════════════════════════════════════════════════════════════════






// ═══════════════════════════════════════════════════════════════════
// Event #0 — 浏览器指纹 (78 字段)
// type: "N2sCLXEHBBg="
// ═══════════════════════════════════════════════════════════════════
function buildEvent0(opts) {
    var perfNow = opts._perfNow0 || 8329;
    return {
        "t": "N2sCLXEHBBg=",
        "d": {
            // ── 字段 1~10: WebGL 指纹 (硬编码) ──
            "U08mSRYjI3s=": "84e74b246fab079c4860fc58c01c2b1e",    // #1  WebGL hash 1
            "DhI7VEh4PGQ=": "f1b218478d268063dec4ab19157e27e8",    // #2  WebGL hash 2
            "BX1wO0AWews=": "WebKit",                              // #3  WebGL vendor
            "S3c+MQ0bOgQ=": "WebKit WebGL",                        // #4  WebGL renderer
            "eWlMLzwATR8=": "WebGL 1.0 (OpenGL ES 2.0 Chromium)",  // #5  WebGL version
            "In5XeGQSVkw=": [                                       // #6  WebGL extensions
                "ANGLE_instanced_arrays", "EXT_blend_minmax", "EXT_clip_control",
                "EXT_color_buffer_half_float", "EXT_depth_clamp", "EXT_disjoint_timer_query",
                "EXT_float_blend", "EXT_frag_depth", "EXT_polygon_offset_clamp",
                "EXT_shader_texture_lod", "EXT_texture_compression_bptc",
                "EXT_texture_compression_rgtc", "EXT_texture_filter_anisotropic",
                "EXT_texture_mirror_clamp_to_edge", "EXT_sRGB",
                "KHR_parallel_shader_compile", "OES_element_index_uint",
                "OES_fbo_render_mipmap", "OES_standard_derivatives",
                "OES_texture_float", "OES_texture_float_linear",
                "OES_texture_half_float", "OES_texture_half_float_linear",
                "OES_vertex_array_object", "WEBGL_blend_func_extended",
                "WEBGL_color_buffer_float", "WEBGL_compressed_texture_s3tc",
                "WEBGL_compressed_texture_s3tc_srgb", "WEBGL_debug_renderer_info",
                "WEBGL_debug_shaders", "WEBGL_depth_texture", "WEBGL_draw_buffers",
                "WEBGL_lose_context", "WEBGL_multi_draw", "WEBGL_polygon_mode"
            ],
            "QAB1RgVoc30=": [                                       // #7  WebGL params
                "[1, 1]", "[1, 1024]", 8, "yes", 8, 24, 8, 16, 32, 16384,
                1024, 16384, 16, 16384, 30, 16, 16, 4095, "[32767, 32767]",
                "no_fp", 23,127,127, 23,127,127, 23,127,127, 23,127,127,
                23,127,127, 23,127,127, 23,127,127, 23,127,127, 23,127,127,
                23,127,127, 23,127,127, 23,127,127
            ],
            "EXFkN1QbYwc=": "Google Inc. (NVIDIA)",                 // #8  GPU vendor
            "NS0Aa3NAB1w=": "ANGLE (NVIDIA, NVIDIA GeForce RTX 5070 Ti (0x00002C05) Direct3D11 vs_5_0 ps_5_0, D3D11)", // #9 GPU renderer
            "XGRpYhoIaFQ=": "WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)", // #10 GLSL version

            // ── 字段 11~20: Canvas/Audio/Font 哈希 (硬编码) ──
            "Z1tSXSI3UGw=": "96ff435b6ebac2817a4d5bfc475aa8e4",    // #11 canvas hash 1
            "XiJrJBtOaRQ=": "931fc10c8a3da4140c796dbaf146decc",    // #12 canvas hash 2
            "OAhNTn5oTXs=": "2bbca34741cd16b0718bf14cac3d94a9",    // #13 canvas hash 3
            "R3syPQIXNw0=": "6514f8ca399bed0b1d259c1f8c0413b1",    // #14 canvas hash 4
            "GwduAV5pbzc=": "[63,63,63,63,0,191,191,191,191,0,191,191,191,191,191,191,191,191,191,127,127,127,127,127,127,127]", // #15 canvas pixel
            "EXFkN1ccYQI=": "126.86972438948578",                   // #16 audio hash
            "Ui5nKBdGZRM=": "2dce8c55c6897067fdf0c76ddf6e6d50",    // #17 font hash
            "DXV4M0gffwU=": "c96716ab2f0338a92eb85790119bcc05",    // #18 plugin hash
            "OSkMb3xGDF8=": "016beb17dd57a6e446b36265284c0c9c",    // #19 media hash
            "HCQpIllIKRU=": "ce87152eb9832a605dc98452be644176",    // #20 speech hash

            // ── 字段 21~30: 功能标志 + PX窗口变量 ──
            "GUlsT1wlbHs=": "d41d8cd98f00b204e9800998ecf8427e",    // #21 empty MD5
            "IUEUR2chEn0=": 2,                                     // #22 touchPoints
            "LVUYU2s1Emc=": true,                                   // #23 WebGL supported
            "DXV4M0gecwg=": true,                                   // #24 功能标志
            "QSE0ZwRLNVQ=": false,                                  // #25 检测标志
            "EXFkN1cbZwM=": false,                                  // #26 检测标志
            "dEwBCjIhBzA=": true,                                   // #27 功能标志
            "QAB1RgVofnI=": "missing",                              // #28 特性检测
            "V0siTRImIng=": [                                       // #29 window._px* 变量列表
                "_pxModal", "_pxBlockedUrl", "_pxVid", "_pxUuid", "_pxAppId",
                "_pxHostUrl", "_pxJsClientSrc", "_pxFirstPartyEnabled",
                "_pxAction", "_PXO1GDTa7Q", "_pxSelectedLocale", "_pxTranslation",
                "_pxOnCaptchaSuccess", "_pxOnMobileCaptchaSuccess",
                "_pxOnOfflineCallback", "_pxMobile", "_O1GDTa7Qhandler", "_pxInit"
            ],
            "WGhtbh4Ja14=": [],                                     // #30 空数组

            // ── 字段 31~40: 插件/时间/错误/环境 ──
            "PARJQnlpSHk=": [                                        // #31 navigator.plugins
                "PDF Viewer::Portable Document Format::application/pdf~pdf::text/pdf~pdf",
                "Chrome PDF Viewer::Portable Document Format::application/pdf~pdf::text/pdf~pdf",
                "Chromium PDF Viewer::Portable Document Format::application/pdf~pdf::text/pdf~pdf",
                "Microsoft Edge PDF Viewer::Portable Document Format::application/pdf~pdf::text/pdf~pdf",
                "WebKit built-in PDF::Portable Document Format::application/pdf~pdf::text/pdf~pdf"
            ],
            "QSE0ZwdBP1Y=": opts.serverTs,                           // #32 serverTs (动态, ob响应no字段)
            "CFg9Hk0zPSQ=": opts.stackA,                             // #33 errorStack A (动态, main.min.js堆栈)
            "BX1wO0AWegE=": true,                                    // #34 环境标志
            "RlpzHAM3dSg=": 33,                                      // #35 检测计数
            "JV0QW2A2EW8=": "fd7149bbfb316699ef918fa7bb7510a8",     // #36 环境hash1
            "PkJLBHgoST8=": "d41d8cd98f00b204e9800998ecf8427e",     // #37 空MD5
            "PSUIY3tJD1A=": "fd7149bbfb316699ef918fa7bb7510a8",     // #38 环境hash2
            "bHQZcikYE0Y=": 3,                                       // #39 devicePixelRatio相关
            "eEgNDj4pCz8=": 1920,                                    // #40 screen.width

            // ── 字段 41~50: 屏幕/设备/语言 ──
            "WQksDx9nJjw=": 1080,                                    // #41 screen.height
            "FwtiDVJjYj4=": 1920,                                    // #42 availWidth
            "HUVoQ1gvYnY=": "1920X1080",                             // #43 分辨率字符串
            "JDxROmJWWwg=": 32,                                      // #44 colorDepth
            "S3c+MQ4ePAA=": 32,                                      // #45 pixelDepth
            "Ix8WGWZ3FiM=": 1032,                                    // #46 availHeight
            "bHQZcioVH0k=": "10207b2f",                              // #47 CRC32
            "VGxhahIAa1s=": "zh-CN",                                 // #48 navigator.language
            "SBh9Xg11emQ=": "Win32",                                 // #49 navigator.platform
            "YGAVZiYOElA=": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0", // #50 UA

            // ── 字段 51~60: 浏览器环境 ──
            "TTU4cwtaMkA=": ["zh-CN", "en", "en-GB", "en-US"],      // #51 navigator.languages
            "YQFUByRoVTI=": true,                                    // #52 cookie enabled
            "QSE0ZwdONFQ=": 8,                                       // #53 hardwareConcurrency
            "DhI7VEh9MWM=": 16,                                      // #54 deviceMemory
            "LVUYU2s/E2E=": -480,                                    // #55 timezoneOffset
            "OSkMb39GCVU=": false,                                   // #56 检测标志
            "KDhdPm5ZWww=": new Date().toString(),                    // #57 Date.toString() (动态)
            "SBh9Xg50e2w=": true,                                    // #58 功能标志
            "HUVoQ1spaXg=": "64556c77",                              // #59 CRC32
            "eWlMLz8FSxg=": 4294967296,                              // #60 jsHeapSizeLimit

            // ── 字段 61~70: 哈希 + common tail 前半 ──
            "Z1tSXSE2VW0=": "7c5f9724",                              // #61 CRC32
            "NS0Aa3BBAF4=": "3207084bd110f1ac964863e23aa78e04",     // #62 综合hash
            "FmojbFMHKVg=": null,                                    // #63 null值
            "egYPQD9sC3A=": "f49f18dbec5558a76590af096c339826",     // #64 指纹hash
            "dytCbTJHQF4=": "f1085bff8e362a00440c9e55d5a4c9d0",     // #65 MD5指纹
            "U08mSRUvJHk=": 2,                                       // #66 seq=2 (Event#0固定)
            "eEgNDj4kCTw=": perfNow,                                 // #67 performance.now()
            "ZHwReiISEkE=": true,                                    // #68 PX初始化完成
            "Ah43WEd1PWo=": opts.nsTs,                               // #69 /ns时间戳 (动态)
            "ICBVJmZNXhI=": opts.uuid,                               // #70 uuid (动态)

            // ── 字段 71~78: common tail 后半 + 页面URL ──
            "DFQ5Ekk4PSQ=": opts.px3Token,                           // #71 px3Token (动态)
            "DhI7VEt+P2M=": opts.perfOrigin,                         // #72 perfOrigin (动态)
            "AWF0J0cLcRw=": false,                                   // #73 检测标志
            "dW1AKzAHQh4=": "PX11745",                               // #74 事件标记
            "YGAVZiYPEVw=": "pxhc",                                  // #75 PX Human Challenge
            "VQ0gCxBnJjE=": false,                                   // #76 检测标志
            "JDxROmFSUws=": opts.px3Cookie,                          // #77 _px3 cookie (动态)
            "AEA1BkYvMzE=": opts.blockedUrl                          // #78 被拦截URL (动态)
        }
    };
}

// ═══════════════════════════════════════════════════════════════════
// Event Metrics — PX内部指标上报 (18 字段)
// type: "eEgNDj0nBzw="
// 位于 WebGL 和 mouse 之间, seq=3
// ═══════════════════════════════════════════════════════════════════
function buildEventMetrics(opts) {
    var metricsPerf = opts._metricsPerfNow || 5283;
    return {
        "t": "eEgNDj0nBzw=",
        "d": {
            // ── 字段 1~6: timing + encrypted metrics ──
            "DXV4M0gbewg=": opts._metricsT1 || 3623,                    // #1 timing (html解析完成)
            "X0MqRRotKnc=": opts._metricsT2 || 4659,                    // #2 timing (js加载完成)
            "PARJQnlqSXE=": opts._metricsT3 || 4668,                    // #3 timing (加密开始)
            "SBh9Xg12fW4=": metricsPerf,                                // #4 timing (执行完成)
            "Ew9mCVZgbDo=": opts.metricsPayload || {                    // #5 encrypted metrics
                "en": "",
                "mtr": { "v": 1.008, "html": 654, "js": 274, "enc": 2, "exec": 628 }
            },
            "EFAlFlY9JCU=": opts._pageLoadTs || Date.now() - 30000,     // #6 页面加载时间戳

            // ── 字段 7~18: common tail ──
            "U08mSRUvJHk=": 3,                                          // #7  seq=3 (Metrics固定)
            "eEgNDj4kCTw=": metricsPerf,                                // #8  performance.now()
            "ZHwReiISEkE=": true,                                       // #9  PX初始化完成
            "Ah43WEd1PWo=": opts.nsTs,                                  // #10 /ns时间戳 (动态)
            "ICBVJmZNXhI=": opts.uuid,                                  // #11 uuid (动态)
            "DFQ5Ekk4PSQ=": opts.px3Token,                              // #12 px3Token (动态)
            "DhI7VEt+P2M=": opts.perfOrigin,                            // #13 perfOrigin (动态)
            "AWF0J0cLcRw=": false,                                      // #14 检测标志
            "dW1AKzAHQh4=": "PX11745",                                  // #15 事件标记
            "YGAVZiYPEVw=": "pxhc",                                     // #16 PX Human Challenge
            "VQ0gCxBnJjE=": false,                                      // #17 检测标志
            "JDxROmFSUws=": opts.px3Cookie                              // #18 _px3 cookie (动态)
        }
    };
}

// ═══════════════════════════════════════════════════════════════════
// Event #1 — 鼠标交互 (20 字段)
// type: "FCwhKlFEIRs="
// ═══════════════════════════════════════════════════════════════════
function buildEvent1(opts) {
    var perfNow = opts._perfNow1 || 27342;
    return {
        "t": "FCwhKlFEIRs=",
        "d": {
            // ── 字段 1~10: 鼠标事件 + 部分 common tail ──
            "bHQZcikcG0g=": opts._mouseEvent1.clientX || 630,       // #1  clientX (动态)
            "cRFEFzR8RyE=": opts._mouseEvent1.clientY || 289,       // #2  clientY (动态)
            "ICBVJmZAXxA=": opts.stackB,                             // #3  mouseover错误堆栈 (动态)
            "X0MqRRopKHQ=": opts._mouseEvent1.type || "mouseover",   // #4  事件类型
            "Q382OQUQPQI=": perfNow,                                 // #5  performance.now()
            "QAB1RgZgf3M=": "true",                                  // #6  冒泡 (字符串"true")
            "BFwxGkExNSk=": true,                                    // #7  isTrusted
            "aRlcHy92Wy8=": opts._mouseEvent1.target || "#px-captcha-wrapper>DIV:nth-child(1)", // #8 DOM路径
            "U08mSRUvJHk=": 4,                                       // #9  seq=4 (Event#1固定)
            "eEgNDj4kCTw=": perfNow,                                 // #10 performance.now()

            // ── 字段 11~20: common tail ──
            "ZHwReiISEkE=": true,                                    // #11 PX初始化完成
            "Ah43WEd1PWo=": opts.nsTs,                               // #12 /ns时间戳 (动态)
            "ICBVJmZNXhI=": opts.uuid,                               // #13 uuid (动态)
            "DFQ5Ekk4PSQ=": opts.px3Token,                           // #14 px3Token (动态)
            "DhI7VEt+P2M=": opts.perfOrigin,                         // #15 perfOrigin (动态)
            "AWF0J0cLcRw=": false,                                   // #16 检测标志
            "dW1AKzAHQh4=": "PX11745",                               // #17 事件标记
            "YGAVZiYPEVw=": "pxhc",                                  // #18 PX Human Challenge
            "VQ0gCxBnJjE=": false,                                   // #19 检测标志
            "JDxROmFSUws=": opts.px3Cookie                          // #20 _px3 cookie (动态)
        }
    };
}

// ═══════════════════════════════════════════════════════════════════
// Event #2 — PX561 核心 (95 字段)
// type: "PX561"
// !! 不使用 Object.assign: KD9YPm5WXgU= 必须在第 1 位
// ═══════════════════════════════════════════════════════════════════
function buildEvent2(opts) {
    var perfNow = opts._perfNow2 || 38073;
    var pdTs = opts.pointerDown.ts;
    var puTs = opts.pointerUp.ts;
    var holdDuration = puTs - pdTs;

    return {
        "t": "PX561",
        "d": {
            // ── 字段 1~10: 初始化/可见性/Myanmar/计数 ──
            "ZHwReiISEkE=": true,                                          // #1  PX初始化完成
            "ICBVJmZAXxA=": opts.stackC,                                   // #2  PX561完整堆栈 (动态)
            "VGxhahIMYFs=": true,                                          // #3  captcha可见性
            "W0cuQR0qKXc=": "visible",                                     // #4  visibilityState
            "DXV4M0gccwg=": opts.myanmarData,                              // #5  Myanmar编码 (动态)
            "Q382OQUQPQI=": perfNow,                                       // #6  performance.now()
            "TlJ7FAs6eyA=": true,                                          // #7  challenge类型标志
            "LDRZMmpbXgc=": 4,                                             // #8  事件内部序号
            "dytCbTJHQF4=": "f1085bff8e362a00440c9e55d5a4c9d0",           // #9  MD5指纹
            "bRVYEyh5WCE=": true,                                          // #10 按压检测启用

            // ── 字段 11~20: 计数器 + 鼠标交互 + 轨迹 ──
            "GCgtLl5IJh0=": 1,                                             // #11 点击次数
            "OkZPAHwnTjU=": 0,                                             // #12 失败计数
            "HmIrZFgNKlQ=": 0,                                             // #13 重试计数
            "aHgdfi4VH0U=": 0,                                             // #14 超时计数
            "QlNxGAQ+dyw=": opts.mouseInteractions,                        // #15 mouse事件数组 (动态)
            "EmMhaFQBLFI=": opts.mouseTrackFiltered,                       // #16 过滤轨迹 (动态)
            "PAlPQnlqS3k=": opts.mouseTrackFull,                           // #17 完整轨迹 (动态)
            "Dh89VEt6P2Y=": opts.domPaths,                                 // #18 DOM路径 (动态)
            "dEEHCjIhAT8=": 505,                                           // #19 按钮offsetTop
            "M2IAKXYEBBM=": 159,                                           // #20 按钮宽度偏移

            // ── 字段 21~30: 按钮/屏幕/DOM/pointer ──
            "XGlvYhoFaVQ=": 530,                                           // #21 按钮clientY区域
            "eypIYT1IT1I=": 52,                                            // #22 按钮高度
            "PAlPQnplT3M=": 1920,                                          // #23 screen.width
            "cRxCFzd/TiQ=": 1080,                                          // #24 screen.height
            "MkNBCHQuRTw=": opts.domProps,                                  // #25 DOM属性探测 (动态)
            "TTg+cwtVPkQ=": opts.pointerDown.offsetX,                      // #26 pointerdown offsetX (动态)
            "RBF3WgF0dGw=": opts.pointerDown.offsetY,                      // #27 pointerdown offsetY (动态)
            "RTA2ewNcOks=": "pointerdown",                                 // #28 事件类型
            "WitpIBxJaRA=": opts.pointerDown.clientY,                      // #29 pointerdown clientY (动态)
            "Ln9ddGgYWEU=": opts.pointerDown.clientX,                      // #30 pointerdown clientX (动态)

            // ── 字段 31~40: pointerdown时间/计数器/pointerup ──
            "eWRKLz8HSR8=": pdTs,                                          // #31 pointerdown ts (动态)
            "IxIQGWVzFiI=": opts._counter1 || 67184994,                    // #32 累计事件计数器
            "FUBmS1MhZ3w=": 4294967296,                                    // #33 2^32常量
            "RBF3WgJ9cGs=": opts._counter2 || 79466182,                    // #34 累计字节计数器
            "Lx4cFWp6GiM=": opts.pointerUp.offsetX,                       // #35 pointerup offsetX (动态)
            "WitpIBxIaBs=": opts.pointerUp.offsetY,                        // #36 pointerup offsetY (动态)
            "JVAWW2M8G28=": "pointerup",                                   // #37 事件类型
            "YQxSByduVTY=": opts.pointerUp.clientY,                        // #38 pointerup clientY (动态)
            "Dz58dUlefEI=": opts.pointerUp.clientX,                        // #39 pointerup clientX (动态)
            "HCkvIllJKhc=": puTs,                                          // #40 pointerup ts (动态)

            // ── 字段 41~50: 持续时长/按钮/语言/challenge ──
            "QlNxGAc0fSg=": [holdDuration],                                // #41 按压持续时长
            "JxYUHWFxFi8=": opts._buttonOffsetX || 319,                    // #42 按钮内offsetX
            "UiNhKBRAZh8=": true,                                          // #43 交互验证通过
            "VGFnahINZFw=": "zh-CN",                                       // #44 navigator.language
            "dgcFTDNhAXs=": opts.challengeHash,                            // #45 challenge hash (动态)
            "V0YkTREhJXg=": opts._displayToInteract || 3793,               // #46 captcha显示→交互
            "InNReGQUV0s=": opts._afterPointerUp || 30101,                 // #47 pointerup后perfNow
            "QlNxGAcxci4=": opts._pageLoadTs,                              // #48 页面加载时间戳 (动态)
            "Czp4cU5Ye0Y=": opts._interactionTimestamps || [opts.nsTs + 26000], // #49 关键交互时刻
            "IxIQGWZwEy0=": opts._wasmCallTimestamps || [],                // #50 WASM调用时刻

            // ── 字段 51~60: bot检测标志 ──
            "VidlLBBAZB8=": false,                                         // #51 bot检测
            "eEULDj4oDjU=": false,                                         // #52 自动化检测
            "NAFHSnJiQng=": false,                                         // #53 devtools检测
            "GwpoAV5qbDQ=": false,                                         // #54 模拟器检测
            "V0YkTRImIX4=": 948,                                           // #55 iframe clientWidth
            "RTA2ewNQO00=": 847,                                           // #56 iframe clientHeight
            "MD1DNnVbQQE=": 1,                                             // #57 尝试次数
            "ZjcVPCNXGQc=": opts.captchaVer,                               // #58 SDK版本 (动态)
            "DXh+M0gYcwg=": false,                                         // #59 headless
            "OSQKb3xFDl0=": false,                                         // #60 selenium

            // ── 字段 61~70: 环境检测/WASM ──
            "Hm8tZFsOK1c=": true,                                          // #61 环境检测通过
            "YG0TZiUMFVY=": false,                                         // #62 puppeteer
            "R3Y0PQIXMgc=": true,                                          // #63 功能支持
            "cH0DdjUcBU0=": false,                                         // #64 phantom
            "WitpIB9IbxE=": opts._timeout || 4102,                         // #65 超时值
            "AWxyJ0QOdBE=": false,                                         // #66 代理检测
            "cgMBSDdiBnI=": true,                                           // #67 功能支持
            "KntZcG8aXkU=": 8,                                             // #68 DOM层级
            "NkdFDHMlQzs=": 97,                                            // #69 挑战难度
            "Slt5EA85fyQ=": 100,                                            // #70 confidence score

            // ── 字段 71~80: WASM结果/perfNow/PoW ──
            "aHUbfi0XHUs=": 1,                                              // #71 常量
            "RBF3WgFzcWA=": 4,                                              // #72 hardwareConcurrency
            "Slt5EA85fiI=": opts.visualHash,                                // #73 visual challenge hash (动态)
            "CXR6P0wWfQw=": opts._coordOrTime || 814,                      // #74 坐标/时间差
            "AhMxWEdxNmg=": opts._pressToWasm || 1536,                     // #75 按压→WASM完成
            "cyJAaTZDQF8=": true,                                           // #76 验证完成
            "InNReGcSXUM=": "succeeded",                                    // #77 WASM执行状态
            "AE0zBkUsPjQ=": opts.wasmA,                                     // #78 WASM a()输出 (动态)
            "MD1DNnVfRgQ=": opts.wasmB,                                     // #79 WASM b()输出 (动态)
            "JxYUHWFxEw==": opts._hiResPerfNow || 16258.39999999106,       // #80 高精度perfNow

            // ── 字段 81~90: PoW/挑战类型/common tail ──
            "CXR6P08TfA==": opts.powAnswer,                                 // #81 PoW answer (动态)
            "Slt5EA86fSY=": opts._wasmCompleteTs || 30104,                  // #82 WASM完成时间
            "FwZkDVJnZDg=": false,                                          // #83 检测标志
            "Q3IwOQYQMwg=": opts.challengeType,                             // #84 挑战类型 (动态)
            "U08mSRUvJHk=": 6,                                              // #85 seq=6 (Event#2固定)
            "eEgNDj4kCTw=": perfNow,                                        // #86 performance.now()
            "Ah43WEd1PWo=": opts.nsTs,                                      // #87 /ns时间戳 (动态)
            "ICBVJmZNXhI=": opts.uuid,                                      // #88 uuid (动态)
            "DFQ5Ekk4PSQ=": opts.px3Token,                                  // #89 px3Token (动态)
            "DhI7VEt+P2M=": opts.perfOrigin,                                // #90 perfOrigin (动态)

            // ── 字段 91~95: common tail 剩余 ──
            "AWF0J0cLcRw=": false,                                          // #91 检测标志
            "dW1AKzAHQh4=": "PX11745",                                      // #92 事件标记
            "YGAVZiYPEVw=": "pxhc",                                         // #93 PX Human Challenge
            "VQ0gCxBnJjE=": false,                                          // #94 检测标志
            "JDxROmFSUws=": opts.px3Cookie                                  // #95 _px3 cookie (动态)
        }
    };
}

// ═══════════════════════════════════════════════════════════════════
// Event #3 — Captcha完成回调 (27 字段)
// type: "TBR5Ugp6c2I="
// !! 不使用 Object.assign: KD9YPm5WXgU= 必须在第 1 位
// ═══════════════════════════════════════════════════════════════════
function buildEvent3(opts) {
    var perfNow = opts._perfNow3 || 38073;
    return {
        "t": "TBR5Ugp6c2I=",
        "d": {
            // ── 字段 1~10: 初始化/可见性/Myanmar/captcha信息 ──
            "ZHwReiISEkE=": true,                                          // #1  PX初始化完成
            "ICBVJmZAXxA=": opts.stackD,                                   // #2  Last完整堆栈 (动态)
            "VGxhahIMYFs=": true,                                          // #3  captcha可见性
            "W0cuQR0qKXc=": "visible",                                     // #4  visibilityState
            "DXV4M0gccwg=": opts.myanmarData,                              // #5  Myanmar编码 (动态)
            "Q382OQUQPQI=": perfNow,                                       // #6  performance.now()
            "egsJQD9vCHU=": "pxCaptcha",                                   // #7  captcha类型
            "Tl99FAg/cCY=": "www.ifood.com.br",                            // #8  目标域名
            "VGFnahINZFw=": "zh-CN",                                       // #9  navigator.language
            "fy5MZTpKTF4=": false,                                         // #10 移动端标志

            // ── 字段 11~20: SDK版本/URL/验证/超时/captchaId/common tail ──
            "ZjcVPCNXGQc=": opts.captchaVer,                               // #11 SDK版本 (动态)
            "BXB2O0ARegw=": opts.blockedUrl,                                // #12 被拦截API URL (动态)
            "X04sRRovIXE=": true,                                          // #13 验证通过
            "aHUbfi0XHkQ=": false,                                         // #14 离线标志
            "WitpIB9IbxE=": opts._timeout || 4102,                         // #15 超时值
            "OAhNSHpk": opts.captchaInstanceId,                             // #16 pow_challenge.uuid (动态)
            "U08mSRUvJHk=": 7,                                              // #17 seq=7 (Event#3固定)
            "eEgNDj4kCTw=": perfNow,                                        // #18 performance.now()
            "Ah43WEd1PWo=": opts.nsTs,                                      // #19 /ns时间戳 (动态)
            "ICBVJmZNXhI=": opts.uuid,                                      // #20 uuid (动态)

            // ── 字段 21~27: common tail 剩余 ──
            "DFQ5Ekk4PSQ=": opts.px3Token,                                  // #21 px3Token (动态)
            "DhI7VEt+P2M=": opts.perfOrigin,                                // #22 perfOrigin (动态)
            "AWF0J0cLcRw=": false,                                          // #23 检测标志
            "dW1AKzAHQh4=": "PX11745",                                      // #24 事件标记
            "YGAVZiYPEVw=": "pxhc",                                         // #25 PX Human Challenge
            "VQ0gCxBnJjE=": false,                                          // #26 检测标志
            "JDxROmFSUws=": opts.px3Cookie                                  // #27 _px3 cookie (动态)
        }
    };
}

// ═══════════════════════════════════════════════════════════════════
// Event #4 — PX11994 交互总结 (24 字段)
// type: "XQUoAxhoKzg="
// ═══════════════════════════════════════════════════════════════════
function buildEvent4(opts) {
    var perfNow = opts._perfNow4 || 38073;
    return {
        "t": "XQUoAxhoKzg=",
        "d": {
            // ── 字段 1~10: 交互数据/事件码/URL/DOM/轨迹 ──
            "PkJLBHsrTTY=": opts.mouseEvents4,                              // #1  详细交互记录 (动态)
            "In5XeGcWUko=": "PX11994",                                      // #2  事件码
            "KDhdPm5YXAg=": opts.blockedUrl,                                // #3  页面URL (动态)
            "VGxhahEEZVg=": opts.domInteractCount,                           // #4  DOM交互计数 (动态)
            "WQksDx9oKTg=": opts.uuid,                                       // #5  _pxUuid (动态)
            "W0cuQR0mKHc=": 0,                                              // #6  计数器
            "MVEEV3Q8AGA=": true,                                            // #7  标志
            "BX1wO0MXewo=": opts.diffTrack,                                  // #8  差分鼠标轨迹 (动态)
            "TBR5Ugl7eWE=": "",                                              // #9  键盘输入 (空)
            "fWVIIzgITRE=": opts._absTimestamp || Date.now() - 30000,        // #10 绝对时间戳

            // ── 字段 11~20: 轨迹子集/视口/common tail ──
            "DXV4M0sacwk=": opts.trackSubset,                               // #11 轨迹子集 (动态)
            "LxMaFWl8Hy4=": "847x0",                                        // #12 视口位置
            "U08mSRUvJHk=": 8,                                              // #13 seq=8 (Event#4固定)
            "eEgNDj4kCTw=": perfNow,                                        // #14 performance.now()
            "ZHwReiISEkE=": true,                                           // #15 PX初始化完成
            "Ah43WEd1PWo=": opts.nsTs,                                      // #16 /ns时间戳 (动态)
            "ICBVJmZNXhI=": opts.uuid,                                      // #17 uuid (动态)
            "DFQ5Ekk4PSQ=": opts.px3Token,                                  // #18 px3Token (动态)
            "DhI7VEt+P2M=": opts.perfOrigin,                                // #19 perfOrigin (动态)
            "AWF0J0cLcRw=": false,                                          // #20 检测标志

            // ── 字段 21~24: common tail 剩余 ──
            "dW1AKzAHQh4=": "PX11745",                                      // #21 事件标记
            "YGAVZiYPEVw=": "pxhc",                                         // #22 PX Human Challenge
            "VQ0gCxBnJjE=": false,                                          // #23 检测标志
            "JDxROmFSUws=": opts.px3Cookie                                  // #24 _px3 cookie (动态)
        }
    };
}

// ═══════════════════════════════════════════════════════════════════
// 主构建函数 — 返回 6 个事件的数组 (匹配 real B3 顺序)
// opts.skipMetrics = true 可跳过 metrics event (en 加密暂未还原)
// ═══════════════════════════════════════════════════════════════════
function buildBundle3Events(opts) {
    var events = [
        buildEvent0(opts),       // WebGL (seq=2)
    ];
    if (!opts.skipMetrics) {
        events.push(buildEventMetrics(opts)); // Metrics (seq=3)
    }
    events.push(
        buildEvent1(opts),       // Mouse (seq=4)
        buildEvent2(opts),       // PX561 (seq=6)
        buildEvent3(opts),       // Callback (seq=7)
        buildEvent4(opts)        // Summary (seq=8)
    );
    return events;
}

// ═══════════════════════════════════════════════════════════════════
// buildOpts — 从必传参数 + WASM 自动生成构造完整 opts
// ═══════════════════════════════════════════════════════════════════

async function buildOpts(p) {
    var required = ['uuid', 'vid', 'serverTs', 'nsTs', 'px3Cookie', 'px3Token', 'challengeHash', 'blockedUrl'];
    for (var i = 0; i < required.length; i++) {
        if (p[required[i]] === undefined || p[required[i]] === null)
            throw new Error('buildOpts: missing required param "' + required[i] + '"');
    }

    // WASM
    var _wasmA = p.wasmA, _wasmB = p.wasmB;
    if (!_wasmA || !_wasmB) {
        var wasm = await initWasm(p.uuid);
        if (!_wasmA) {
            log('[WASM] 调用 a()...');
            try { _wasmA = wasm.a(); log('[WASM] a() 返回: ' + (_wasmA || '').substring(0, 60)); }
            catch(e) { log('[WASM] a() 抛出: ' + e.message); throw e; }
        }
        // powAnswer 为 null 时跳过 wasmB (WASM b() 不接受空字符串)
        if (!_wasmB) {
            if (p.powAnswer) {
                log('[WASM] 调用 b("' + p.powAnswer.substring(0, 40) + '")...');
                try { _wasmB = wasm.b(p.powAnswer); log('[WASM] b() 返回: ' + (_wasmB || '').substring(0, 60)); }
                catch(e) { log('[WASM] b() 抛出: typeof=' + typeof e + ', val=' + String(e)); throw e; }
            } else {
                log('[WASM] 无 powAnswer, 跳过 b()');
                _wasmB = '';
            }
        }
    }

    // Myanmar
    var _myanmarData = p.myanmarData || myanmarData();

    // Error stacks
    var _stackA = p.errorStackShort || stackA();
    var _stackB = p.errorStackMouse || stackB();
    var _stackC = p.errorStack || stackC(p.uuid, p.vid);
    var _stackD = p.errorStackLast || stackD(p.uuid, p.vid);

    // 鼠标轨迹
    var track = p.mouseTrack || getRandomTrack();

    var pdTs = track.pointerDown.ts;
    var puTs = track.pointerUp.ts;
    var holdMs = track.holdDuration;
    var approachStart = track.approachStartTs;

    var wasmMs = _randInt(20, 80);
    var completePerfNow = puTs + wasmMs;
    var nowMs = Date.now();
    var pageLoadTs = nowMs - Math.round(completePerfNow);

    return {
        uuid: p.uuid, serverTs: p.serverTs, nsTs: p.nsTs,
        px3Cookie: p.px3Cookie, px3Token: p.px3Token,
        perfOrigin: p.perfOrigin || 0.09999990463256836,
        captchaVer: p.captchaVer || "v2.7.7",
        challengeType: p.challengeType || "hgb",
        challengeHash: p.challengeHash, powAnswer: p.powAnswer,
        visualHash: p.visualHash, wasmA: _wasmA, wasmB: _wasmB,
        myanmarData: _myanmarData,
        captchaInstanceId: p.captchaInstanceId,
        blockedUrl: p.blockedUrl,
        stackA: _stackA, stackB: _stackB, stackC: _stackC, stackD: _stackD,
        mouseTrackFull: track.mouseTrackFull,
        mouseTrackFiltered: track.mouseTrackFiltered,
        mouseInteractions: track.mouseInteractions,
        pointerDown: track.pointerDown, pointerUp: track.pointerUp,
        mouseEvents4: track.mouseEvents4, diffTrack: track.diffTrack,
        trackSubset: track.trackSubset, domInteractCount: track.domInteractCount,
        _mouseEvent1: track.mouseEvent1,
        domPaths: ["#px-captcha-wrapper>DIV1","DIV2>DIV2","#px-captcha-wrapper>DIV2","#px-captcha","","DIV2>DIV4"],
        domProps: ["nodeType","ELEMENT_NODE","matches","matches","matches","childNodes","parentNode","parentNode","getAttribute","className","nodeType","DOCUMENT_NODE","nodeName","nodeName","childNodes","nodeName","nodeName"],
        _perfNow0: _randInt(7000, 10000), _perfNow1: approachStart,
        _perfNow2: completePerfNow, _perfNow3: completePerfNow + _randInt(0, 3),
        _perfNow4: completePerfNow + _randInt(3, 8),
        _timeout: Math.round(pdTs - approachStart) + _randInt(3000, 5000),
        _buttonOffsetX: Math.round(track.pointerDown.offsetX),
        _displayToInteract: Math.round(pdTs - _randInt(500, 2000)),
        _afterPointerUp: completePerfNow + _randInt(20, 50),
        _pageLoadTs: pageLoadTs,
        _interactionTimestamps: [pageLoadTs + pdTs],
        _wasmCallTimestamps: Math.random() < 0.5 ? [] : [pageLoadTs + puTs + _randInt(5, 30)],
        _pressToWasm: holdMs + wasmMs,
        _coordOrTime: _randInt(700, 900),
        _hiResPerfNow: completePerfNow + Math.random() * 0.5 - 0.1,
        _wasmCompleteTs: completePerfNow + _randInt(1, 10),
        _counter1: _randInt(50000000, 100000000),
        _counter2: _randInt(50000000, 200000000),
        _absTimestamp: pageLoadTs
    };
}





// ═══════════════════════════════════════════════════════════════════
// Part 3: XHR/fetch Hook — 拦截 B1/B2 请求和响应
// ═══════════════════════════════════════════════════════════════════

var FT = 388;
var EN = "NTA";
// 匹配 PX bundle URL: /assets/js/bundle 或 collector-*.px-cloud.net
var BUNDLE_URL_PATTERN = /\/assets\/js\/bundle|collector-[^.]*\.px-cloud\.net/;

var pxState = {
    b1Request: null,
    b1Response: null,
    b2Response: null,
    bundleCount: 0,    // 0=等B1, 1=等B2, 2+=已收B2,继续监控
    tag: null,
    bi: null,
    uuid: null,
    vid: null,
    sid: null,
    cts: null,
    appId: null,
    bundleUrl: null,
    processing: false,
    _debugXhrCount: 0,
    _debugFetchCount: 0,
    // 后续 ob 累积的 PoW 数据
    powAnswer: null,
    visualHash: null,
    captchaInstanceId: null,
    latestPx3: null,
    latestServerTs: null,
    latestChallengeHash: null,
    _b3Timeout: null
};

var captchaState = {
    detected: false,
    b1Response: null, b2Response: null,
    bundleCount: 0,
    tag: null, bi: null, uuid: null, vid: null, sid: null, cts: null, appId: null,
    bundleUrl: null,
    serverTs: null, challengeHash: null,
    powAnswer: null, visualHash: null, captchaInstanceId: null,
    px3Cookie: null, px3Token: null, serverTs2: null
};

// 处理 B2 之后的 bundle ob — 寻找 PoW 挑战
function processLaterOb(resp) {
    if (!resp.ob || resp.ob.length <= 50) {
        log('[DEBUG] bundle #' + pxState.bundleCount + ' ob太短 (' + (resp.ob || '').length + '), 跳过');
        return;
    }
    log('═══ 检测到后续 bundle ob #' + pxState.bundleCount + ' (len=' + resp.ob.length + ') ═══');
    try {
        var decoded = processOb(resp, pxState.tag);
        log('  segments: ' + decoded.segments.length + ', state keys: ' + Object.keys(decoded.state).join(', '));
        for (var ii = 0; ii < decoded.results.length; ii++) {
            var rr = decoded.results[ii];
            log('  handler[' + ii + ']: type=' + rr.handlerType + ', key=' + rr.handler +
                (rr.result ? ', result=' + JSON.stringify(rr.result).substring(0, 80) : '') +
                (rr.handlerType === 'unknown' ? ', args=' + JSON.stringify(rr.args) : ''));
        }
        // 更新 state
        if (decoded.state.px3 && decoded.state.px3.value) {
            pxState.latestPx3 = decoded.state.px3.value;
            writePx3Cookie(decoded.state.px3);
            log('  ★ 更新 _px3: ' + pxState.latestPx3.substring(0, 40) + '...');
        }
        if (decoded.state.no) {
            pxState.latestServerTs = decoded.state.no;
            log('  ★ 更新 serverTs: ' + pxState.latestServerTs);
        }
        if (decoded.state.qa) {
            pxState.latestChallengeHash = decoded.state.qa;
            log('  ★ 更新 challengeHash: ' + pxState.latestChallengeHash.substring(0, 20) + '...');
        }
        // 检查 PoW
        for (var ii = 0; ii < decoded.results.length; ii++) {
            var rr = decoded.results[ii];
            if (rr.handlerType === 'pow_start' && rr.result && rr.result.pow) {
                pxState.powAnswer = rr.result.pow.answer;
                log('  ★ PoW answer: ' + pxState.powAnswer.substring(0, 20) + '... (elapsed=' + rr.result.pow.elapsed + 'ms)');
            }
            if (rr.handlerType === 'visual_challenge' && rr.result) {
                pxState.visualHash = rr.result.hash;
                log('  ★ visualHash: ' + pxState.visualHash.substring(0, 20) + '...');
            }
            if (rr.handlerType === 'pow_challenge' && rr.result) {
                pxState.captchaInstanceId = rr.result.uuid;
                log('  ★ captchaInstanceId: ' + pxState.captchaInstanceId);
            }
        }
        if (pxState.powAnswer && !pxState.processing) {
            if (pxState._b3Timeout) { clearTimeout(pxState._b3Timeout); pxState._b3Timeout = null; }
            pxState.processing = true;
            log('>>> 触发 B3 构建 (已获取 PoW) <<<');
            setTimeout(function() { buildAndSendB3(); }, 500);
        }
    } catch(e) {
        err('解码后续 ob 失败:', e.message);
    }
}

log('=== Hook 安装开始 ===');

// ────────────────────────────────────────────
// XHR Hook
// ────────────────────────────────────────────
var OrigXHR = window.XMLHttpRequest;
var origXhrOpen = OrigXHR.prototype.open;
var origXhrSend = OrigXHR.prototype.send;
var origXhrAddEvt = OrigXHR.prototype.addEventListener;

OrigXHR.prototype.open = function(method, url) {
    this._pxMethod = method;
    this._pxUrl = url;
    // DEBUG: 记录所有 XHR open
    if (method === 'POST') {
        log('[DEBUG-XHR] open POST → ' + String(url).substring(0, 120));
    }
    return origXhrOpen.apply(this, arguments);
};

OrigXHR.prototype.send = function(body) {
    var xhr = this;
    var url = this._pxUrl || '';
    var isBundle = this._pxMethod === 'POST' && BUNDLE_URL_PATTERN.test(url);

    if (isBundle) {
        pxState._debugXhrCount++;
        pxState.bundleUrl = url;
        log('[DEBUG-XHR] send bundle #' + pxState._debugXhrCount + ' → ' + url.substring(0, 80));
        log('[DEBUG-XHR] body type=' + typeof body + ', len=' + (body ? body.length : 0));
        log('[DEBUG-XHR] bundleCount=' + pxState.bundleCount);

        // 解析 B1 请求参数 (仅第一次)
        if (pxState.bundleCount === 0 && body) {
            log('═══ 捕获 B1 请求 (XHR) ═══');
            try {
                var params = new URLSearchParams(body);
                pxState.b1Request = body;
                pxState.tag = (params.get('tag') || '').replace(/ /g, '+');
                pxState.bi = (params.get('bi') || '').replace(/ /g, '+');
                pxState.uuid = params.get('uuid');
                pxState.vid = params.get('vid');
                pxState.sid = (params.get('sid') || '').replace(/ /g, '+');
                pxState.cts = params.get('cts');
                pxState.appId = params.get('appId');
                log('  tag   = ' + (pxState.tag || 'NULL'));
                log('  bi    = ' + (pxState.bi || 'NULL').substring(0, 30) + '...');
                log('  uuid  = ' + (pxState.uuid || 'NULL'));
                log('  vid   = ' + (pxState.vid || 'NULL'));
                log('  appId = ' + (pxState.appId || 'NULL'));
                log('  sid   = ' + (pxState.sid || 'NULL').substring(0, 40));
                // 列出所有参数名
                var allKeys = [];
                params.forEach(function(v, k) { allKeys.push(k); });
                log('  所有参数: ' + allKeys.join(', '));
            } catch(e) { err('解析 B1 请求失败:', e.message, e.stack); }
        } else if (pxState.bundleCount === 1 && body) {
            log('═══ 检测到 B2 请求 (XHR) ═══');
            log('  body len=' + body.length);
        }

        // 用 _handled 标志防止重复处理
        var _handled = false;
        function handleBundleResponse() {
            if (_handled) return;
            if (xhr.readyState !== 4) return;
            _handled = true;
            log('[DEBUG-XHR] 响应到达: status=' + xhr.status + ', readyState=' + xhr.readyState);
            log('[DEBUG-XHR] responseText len=' + (xhr.responseText || '').length);
            log('[DEBUG-XHR] responseText preview=' + (xhr.responseText || '').substring(0, 100));

            if (xhr.status !== 200) {
                warn('[DEBUG-XHR] 非200状态: ' + xhr.status);
                return;
            }
            try {
                var resp = JSON.parse(xhr.responseText);
                log('[DEBUG-XHR] 响应 JSON keys: ' + Object.keys(resp).join(', '));

                if (pxState.bundleCount === 0) {
                    pxState.b1Response = resp;
                    pxState.bundleCount = 1;
                    log('═══ 捕获 B1 响应 ═══');
                    log('  ob字段: ' + (resp.ob ? resp.ob.substring(0, 30) + '... (len=' + resp.ob.length + ')' : 'NULL'));
                    log('  do字段: ' + (resp.do ? resp.do.substring(0, 30) + '... (len=' + resp.do.length + ')' : 'NULL'));
                } else if (pxState.bundleCount === 1) {
                    pxState.b2Response = resp;
                    pxState.bundleCount = 2;
                    log('═══ 捕获 B2 响应 ═══');
                    log('  ob字段: ' + (resp.ob ? resp.ob.substring(0, 30) + '... (len=' + resp.ob.length + ')' : 'NULL'));
                    log('  do字段: ' + (resp.do ? resp.do.substring(0, 30) + '... (len=' + resp.do.length + ')' : 'NULL'));
                    // B2 到达 → 等待后续 ob 中的 PoW (不立即构建)
                    log('>>> B2 已捕获, 等待后续 ob 中的 PoW 挑战 (最多 15s) <<<');
                    pxState._b3Timeout = setTimeout(function() {
                        if (!pxState.processing) {
                            pxState.processing = true;
                            log('>>> 超时 15s 未找到 PoW, 尝试无 PoW 构建 <<<');
                            buildAndSendB3();
                        }
                    }, 15000);
                } else {
                    // bundleCount >= 2: 继续监控后续 ob
                    pxState.bundleCount++;
                    processLaterOb(resp);
                }
            } catch(e) {
                err('解析 bundle 响应 JSON 失败:', e.message);
                err('  responseText 前200字符:', (xhr.responseText || '').substring(0, 200));
            }
        }

        // 关键修复: 直接用原生 addEventListener 注册 loadend 监听
        // 不依赖 PX 何时设置回调，loadend 在请求完成后一定会触发
        origXhrAddEvt.call(xhr, 'loadend', function() {
            log('[DEBUG-XHR] loadend 事件触发, readyState=' + xhr.readyState + ', status=' + xhr.status);
            handleBundleResponse();
        });
    }

    return origXhrSend.apply(this, arguments);
};

log('[DEBUG] XHR hook 已安装');

// ────────────────────────────────────────────
// fetch Hook
// ────────────────────────────────────────────
var origFetch = window.fetch;
window.fetch = function(input, init) {
    var url = '';
    if (typeof input === 'string') url = input;
    else if (input instanceof Request) url = input.url;
    else if (input && input.url) url = input.url;

    var method = (init && init.method) || (input instanceof Request ? input.method : 'GET');
    var isPost = method.toUpperCase() === 'POST';
    var isBundle = isPost && BUNDLE_URL_PATTERN.test(url);

    // DEBUG: 记录所有 POST fetch
    if (isPost) {
        log('[DEBUG-FETCH] POST → ' + url.substring(0, 120));
    }

    if (isBundle) {
        pxState._debugFetchCount++;
        pxState.bundleUrl = url;
        var body = init ? init.body : null;
        log('[DEBUG-FETCH] bundle #' + pxState._debugFetchCount + ', bundleCount=' + pxState.bundleCount);
        log('[DEBUG-FETCH] body type=' + typeof body + ', len=' + (body ? body.length : 0));

        // 解析 B1 请求
        if (pxState.bundleCount === 0 && body) {
            log('═══ 捕获 B1 请求 (fetch) ═══');
            try {
                var params = new URLSearchParams(body);
                pxState.b1Request = body;
                pxState.tag = (params.get('tag') || '').replace(/ /g, '+');
                pxState.bi = (params.get('bi') || '').replace(/ /g, '+');
                pxState.uuid = params.get('uuid');
                pxState.vid = params.get('vid');
                pxState.sid = (params.get('sid') || '').replace(/ /g, '+');
                pxState.cts = params.get('cts');
                pxState.appId = params.get('appId');
                log('  tag   = ' + (pxState.tag || 'NULL'));
                log('  bi    = ' + (pxState.bi || 'NULL').substring(0, 30) + '...');
                log('  uuid  = ' + (pxState.uuid || 'NULL'));
                log('  vid   = ' + (pxState.vid || 'NULL'));
                log('  appId = ' + (pxState.appId || 'NULL'));
                var allKeys = [];
                params.forEach(function(v, k) { allKeys.push(k); });
                log('  所有参数: ' + allKeys.join(', '));
            } catch(e) { err('解析 B1 fetch 请求失败:', e.message); }
        } else if (pxState.bundleCount === 1 && body) {
            log('═══ 检测到 B2 请求 (fetch) ═══');
        }

        return origFetch.apply(this, arguments).then(function(response) {
            log('[DEBUG-FETCH] 响应到达: status=' + response.status);
            // clone 读 body, 不影响原始 response
            var cloned = response.clone();
            cloned.text().then(function(text) {
                log('[DEBUG-FETCH] responseText len=' + text.length);
                log('[DEBUG-FETCH] responseText preview=' + text.substring(0, 120));
                try {
                    var resp = JSON.parse(text);
                    log('[DEBUG-FETCH] 响应 JSON keys: ' + Object.keys(resp).join(', '));

                    if (pxState.bundleCount === 0) {
                        pxState.b1Response = resp;
                        pxState.bundleCount = 1;
                        log('═══ 捕获 B1 响应 (fetch) ═══');
                        log('  ob: ' + (resp.ob ? resp.ob.substring(0, 30) + '...' : 'NULL'));
                        log('  do: ' + (resp.do ? resp.do.substring(0, 30) + '...' : 'NULL'));
                    } else if (pxState.bundleCount === 1) {
                        pxState.b2Response = resp;
                        pxState.bundleCount = 2;
                        log('═══ 捕获 B2 响应 (fetch) ═══');
                        log('  ob: ' + (resp.ob ? resp.ob.substring(0, 30) + '...' : 'NULL'));
                        log('  do: ' + (resp.do ? resp.do.substring(0, 30) + '...' : 'NULL'));
                        log('>>> B2 已捕获, 等待后续 ob 中的 PoW 挑战 (最多 15s) <<<');
                        pxState._b3Timeout = setTimeout(function() {
                            if (!pxState.processing) {
                                pxState.processing = true;
                                log('>>> 超时 15s 未找到 PoW, 尝试无 PoW 构建 <<<');
                                buildAndSendB3();
                            }
                        }, 15000);
                    } else {
                        // bundleCount >= 2: 继续监控
                        pxState.bundleCount++;
                        processLaterOb(resp);
                    }
                } catch(e) {
                    err('解析 bundle fetch 响应 JSON 失败:', e.message);
                    err('  text 前200字符:', text.substring(0, 200));
                }
            }).catch(function(e) {
                err('[DEBUG-FETCH] 读取响应 body 失败:', e.message);
            });
            return response;
        }).catch(function(e) {
            err('[DEBUG-FETCH] fetch 请求失败:', e.message);
            throw e;
        });
    }

    return origFetch.apply(this, arguments);
};

log('[DEBUG] fetch hook 已安装');

// ── 额外保险: 拦截 navigator.sendBeacon (PX 极少用, 但以防万一) ──
if (navigator.sendBeacon) {
    var origBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function(url, data) {
        if (BUNDLE_URL_PATTERN.test(url)) {
            log('[DEBUG-BEACON] sendBeacon → ' + url.substring(0, 80));
        }
        return origBeacon(url, data);
    };
    log('[DEBUG] sendBeacon hook 已安装');
}

log('=== Hook 安装完成 ===');
log('如果长时间没有看到 [DEBUG-XHR] 或 [DEBUG-FETCH] 日志,');
log('说明 PX SDK 还未发送请求, 或使用了其他方式发送。');
log('请在 Network 面板查看是否有 POST 到 /assets/js/bundle 的请求。');

// ═══════════════════════════════════════════════════════════════════
// Part 3.5: iframe Hook — 拦截 captcha iframe 内的 XHR
// ═══════════════════════════════════════════════════════════════════

function hookIframeXHR(iframe) {
    var iframeWin;
    try { iframeWin = iframe.contentWindow; } catch(e) { return; }
    if (!iframeWin || !iframeWin.XMLHttpRequest) return;
    if (iframe._pxHooked) return;
    iframe._pxHooked = true;

    var iid = iframe.id || iframe.className || 'anon';
    log('[IFRAME] hook XHR: iframe#' + iid);

    var IframeXHR = iframeWin.XMLHttpRequest;
    var origOpen = IframeXHR.prototype.open;
    var origSend = IframeXHR.prototype.send;

    IframeXHR.prototype.open = function(method, url) {
        this._pxMethod = method;
        this._pxUrl = url;
        if (method === 'POST') log('[IFRAME-XHR] open POST → ' + String(url).substring(0, 120));
        return origOpen.apply(this, arguments);
    };

    IframeXHR.prototype.send = function(body) {
        var xhr = this;
        var url = this._pxUrl || '';
        var isBundle = this._pxMethod === 'POST' && BUNDLE_URL_PATTERN.test(url);

        if (isBundle) {
            captchaState.detected = true;
            captchaState.bundleUrl = url;
            log('[IFRAME-XHR] captcha bundle #' + (captchaState.bundleCount + 1) + ', body len=' + (body ? body.length : 0));

            // 解析请求参数
            if (captchaState.bundleCount === 0 && body) {
                log('═══ [CAPTCHA] B1 请求 ═══');
                try {
                    var params = new URLSearchParams(body);
                    captchaState.tag = (params.get('tag') || '').replace(/ /g, '+');
                    captchaState.bi = (params.get('bi') || '').replace(/ /g, '+');
                    captchaState.uuid = params.get('uuid');
                    captchaState.vid = params.get('vid');
                    captchaState.sid = (params.get('sid') || '').replace(/ /g, '+');
                    captchaState.cts = params.get('cts');
                    captchaState.appId = params.get('appId');
                    log('  tag=' + (captchaState.tag || 'NULL') + ', uuid=' + (captchaState.uuid || 'NULL'));
                    log('  vid=' + (captchaState.vid || 'NULL') + ', appId=' + (captchaState.appId || 'NULL'));
                } catch(e) { err('[CAPTCHA] 解析 B1 请求失败:', e.message); }
            } else if (captchaState.bundleCount === 1) {
                log('═══ [CAPTCHA] B2 请求 ═══');
            }

            // 监听响应
            var _handled = false;
            xhr.addEventListener('loadend', function() {
                if (_handled || xhr.readyState !== 4) return;
                _handled = true;
                if (xhr.status !== 200) {
                    log('[IFRAME-XHR] 非200: status=' + xhr.status);
                    return;
                }
                try {
                    var resp = JSON.parse(xhr.responseText);
                    log('[IFRAME-XHR] 响应 keys=' + Object.keys(resp).join(',') + ', ob len=' + (resp.ob ? resp.ob.length : 0));

                    if (captchaState.bundleCount === 0) {
                        captchaState.b1Response = resp;
                        captchaState.bundleCount = 1;
                        log('═══ [CAPTCHA] B1 响应 ═══');
                        if (resp.ob && resp.ob.length > 50) {
                            try {
                                var b1 = processOb(resp, captchaState.tag);
                                log('  segments=' + b1.segments.length + ', state=' + Object.keys(b1.state).join(','));
                                captchaState.serverTs = b1.state.no;
                                captchaState.challengeHash = b1.state.qa;
                                for (var i = 0; i < b1.results.length; i++) {
                                    var r = b1.results[i];
                                    log('  [' + i + '] ' + r.handlerType + (r.result ? ' → ' + JSON.stringify(r.result).substring(0, 60) : ''));
                                    if (r.handlerType === 'pow_start' && r.result && r.result.pow) {
                                        captchaState.powAnswer = r.result.pow.answer;
                                        log('  ★ PoW: ' + captchaState.powAnswer.substring(0, 20) + '... (' + r.result.pow.elapsed + 'ms)');
                                    }
                                    if (r.handlerType === 'visual_challenge' && r.result) {
                                        captchaState.visualHash = r.result.hash;
                                        log('  ★ visualHash: ' + captchaState.visualHash.substring(0, 20) + '...');
                                    }
                                    if (r.handlerType === 'pow_challenge' && r.result) {
                                        captchaState.captchaInstanceId = r.result.uuid;
                                        log('  ★ captchaInstanceId: ' + captchaState.captchaInstanceId);
                                    }
                                }
                            } catch(e) { err('[CAPTCHA] 解码 B1 ob 失败:', e.message, e.stack); }
                        }

                    } else if (captchaState.bundleCount === 1) {
                        captchaState.b2Response = resp;
                        captchaState.bundleCount = 2;
                        log('═══ [CAPTCHA] B2 响应 ═══');
                        if (resp.ob && resp.ob.length > 50) {
                            try {
                                var b2 = processOb(resp, captchaState.tag);
                                for (var i = 0; i < b2.results.length; i++) {
                                    var r = b2.results[i];
                                    log('  [' + i + '] ' + r.handlerType + (r.result ? ' → ' + JSON.stringify(r.result).substring(0, 60) : ''));
                                    if (r.handlerType === 'set_cookie' && r.result && r.result.name === '_px3')
                                        captchaState.px3Cookie = r.result.value;
                                }
                                if (!captchaState.px3Cookie && b2.state.px3 && b2.state.px3.value)
                                    captchaState.px3Cookie = b2.state.px3.value;
                                if (captchaState.px3Cookie)
                                    captchaState.px3Token = captchaState.px3Cookie.split(':')[1];
                                captchaState.serverTs2 = b2.state.no;
                                log('  ★ px3: ' + (captchaState.px3Cookie ? captchaState.px3Cookie.substring(0, 40) + '...' : 'NULL'));
                            } catch(e) { err('[CAPTCHA] 解码 B2 ob 失败:', e.message, e.stack); }
                        }

                        // ★ captcha B2 到达 → 触发 B3 构建
                        if (!pxState.processing) {
                            if (pxState._b3Timeout) { clearTimeout(pxState._b3Timeout); pxState._b3Timeout = null; }
                            pxState.processing = true;
                            log('>>> [CAPTCHA] B2 已到, 500ms 后构建 B3 <<<');
                            setTimeout(function() { buildAndSendB3(); }, 500);
                        }

                    } else {
                        captchaState.bundleCount++;
                        log('[IFRAME-XHR] 后续 captcha bundle #' + captchaState.bundleCount);
                    }
                } catch(e) { err('[IFRAME-XHR] 解析响应失败:', e.message); }
            });
        }

        return origSend.apply(this, arguments);
    };

    log('[IFRAME] XHR hook 安装完成');
}

// Hook appendChild — 同步检测 iframe 插入
var origAppendChild = Node.prototype.appendChild;
Node.prototype.appendChild = function(child) {
    var result = origAppendChild.apply(this, arguments);
    try {
        if (child && (child.tagName === 'IFRAME' || child instanceof HTMLIFrameElement)) {
            log('[IFRAME-DETECT] iframe 插入: id=' + (child.id || 'none') + ', src=' + (child.src || 'about:blank'));
            hookIframeXHR(child);
        }
    } catch(e) { /* ignore */ }
    return result;
};

log('[DEBUG] iframe appendChild hook 已安装');

// ═══════════════════════════════════════════════════════════════════
// Part 4: 自动构建 + 发送 B3
// ═══════════════════════════════════════════════════════════════════

var DEFAULT_BLOCKED_URL = "https://cw-marketplace.ifood.com.br/v2/bm/home?latitude=-26.2253962&longitude=-48.8026583&channel=IFOOD&size=20&alias=HOME_FOOD_DELIVERY_V3";

async function buildAndSendB3() {
    try {
        log('═══ 开始构建 Bundle #3 ═══');

        // 如果 captcha iframe 有数据, 覆盖 pxState (captcha 数据优先)
        if (captchaState.detected && captchaState.bundleCount >= 2) {
            log('★ 使用 captcha iframe 数据覆盖 pxState');
            if (captchaState.tag) pxState.tag = captchaState.tag;
            if (captchaState.bi) pxState.bi = captchaState.bi;
            if (captchaState.uuid) pxState.uuid = captchaState.uuid;
            if (captchaState.vid) pxState.vid = captchaState.vid;
            if (captchaState.sid) pxState.sid = captchaState.sid;
            if (captchaState.appId) pxState.appId = captchaState.appId;
            pxState.b1Response = captchaState.b1Response;
            pxState.b2Response = captchaState.b2Response;
            if (captchaState.bundleUrl) pxState.bundleUrl = captchaState.bundleUrl;
            if (captchaState.powAnswer) pxState.powAnswer = captchaState.powAnswer;
            if (captchaState.visualHash) pxState.visualHash = captchaState.visualHash;
            if (captchaState.captchaInstanceId) pxState.captchaInstanceId = captchaState.captchaInstanceId;
            if (captchaState.serverTs) pxState.latestServerTs = captchaState.serverTs;
            if (captchaState.challengeHash) pxState.latestChallengeHash = captchaState.challengeHash;
            if (captchaState.px3Cookie) pxState.latestPx3 = captchaState.px3Cookie;
        }

        var GT = pxState.tag;
        var TAG = pxState.tag;
        var BI = pxState.bi;
        var uuid = pxState.uuid;
        var vid = pxState.vid;
        var pxsid = pxState.sid;
        var APP_ID = pxState.appId;

        if (!GT || !uuid || !vid) {
            err('缺少必要参数: tag=' + GT + ', uuid=' + uuid + ', vid=' + vid);
            pxState.processing = false;
            return;
        }

        // Step 1: 解码 B1 ob
        log('Step 1: 解码 B1 ob...');
        log('  B1 响应内容:', JSON.stringify(pxState.b1Response).substring(0, 200));
        log('  GT/tag:', GT);
        var b1 = processOb(pxState.b1Response, GT);
        log('  B1 segments数量:', b1.segments.length);
        log('  B1 state keys:', Object.keys(b1.state).join(', '));
        log('  B1 results数量:', b1.results.length);
        // 打印每个 handler
        for (var i = 0; i < b1.results.length; i++) {
            var r = b1.results[i];
            log('  B1 handler[' + i + ']: type=' + r.handlerType + ', key=' + r.handler +
                (r.result ? ', result=' + JSON.stringify(r.result).substring(0, 80) : '') +
                (r.error ? ', ERROR=' + r.error : '') +
                (r.handlerType === 'unknown' ? ', args=' + JSON.stringify(r.args) : ''));
        }
        var serverTs = b1.state.no;
        var challengeHash = b1.state.qa;
        var powAnswer = null, visualHash = null, captchaInstanceId = null;

        for (var i = 0; i < b1.results.length; i++) {
            var r = b1.results[i];
            if (r.handlerType === 'pow_start' && r.result && r.result.pow) {
                powAnswer = r.result.pow.answer;
                log('  PoW answer: ' + powAnswer.substring(0, 16) + '... (' + r.result.pow.elapsed + 'ms, counter=' + r.result.pow.counter + ')');
            }
            if (r.handlerType === 'visual_challenge' && r.result) {
                visualHash = r.result.hash;
                log('  visual_challenge hash: ' + visualHash.substring(0, 16) + '...');
            }
            if (r.handlerType === 'pow_challenge' && r.result) {
                captchaInstanceId = r.result.uuid;
                log('  pow_challenge uuid: ' + captchaInstanceId);
            }
        }
        // 合并后续 ob 累积的 PoW 数据
        if (!powAnswer && pxState.powAnswer) {
            powAnswer = pxState.powAnswer;
            log('  使用后续 ob 中的 PoW answer: ' + powAnswer.substring(0, 20) + '...');
        }
        if (!visualHash && pxState.visualHash) {
            visualHash = pxState.visualHash;
            log('  使用后续 ob 中的 visualHash: ' + visualHash.substring(0, 20) + '...');
        }
        if (!captchaInstanceId && pxState.captchaInstanceId) {
            captchaInstanceId = pxState.captchaInstanceId;
            log('  使用后续 ob 中的 captchaInstanceId: ' + captchaInstanceId);
        }
        if (pxState.latestServerTs) {
            serverTs = pxState.latestServerTs;
            log('  使用后续 ob 中的最新 serverTs: ' + serverTs);
        }
        if (pxState.latestChallengeHash) {
            challengeHash = pxState.latestChallengeHash;
            log('  使用后续 ob 中的最新 challengeHash: ' + challengeHash.substring(0, 20) + '...');
        }
        log('  serverTs      = ' + serverTs);
        log('  challengeHash = ' + (challengeHash || 'NULL'));
        log('  powAnswer     = ' + (powAnswer || 'NULL'));
        log('  visualHash    = ' + (visualHash || 'NULL'));
        log('  captchaInstId = ' + (captchaInstanceId || 'NULL'));

        // Step 2: 解码 B2 ob
        log('Step 2: 解码 B2 ob...');
        log('  B2 响应内容:', JSON.stringify(pxState.b2Response).substring(0, 200));
        var b2 = processOb(pxState.b2Response, GT);
        log('  B2 segments数量:', b2.segments.length);
        log('  B2 state keys:', Object.keys(b2.state).join(', '));
        log('  B2 results数量:', b2.results.length);
        for (var i = 0; i < b2.results.length; i++) {
            var r = b2.results[i];
            log('  B2 handler[' + i + ']: type=' + r.handlerType + ', key=' + r.handler +
                (r.result ? ', result=' + JSON.stringify(r.result).substring(0, 80) : '') +
                (r.error ? ', ERROR=' + r.error : ''));
        }
        var px3Cookie = null;
        for (var i = 0; i < b2.results.length; i++) {
            var r = b2.results[i];
            if (r.handlerType === 'set_cookie' && r.result && r.result.name === '_px3')
                px3Cookie = r.result.value;
        }
        if (!px3Cookie && b2.state.px3 && b2.state.px3.value) px3Cookie = b2.state.px3.value;
        // 后续 ob 中可能有更新的 _px3
        if (pxState.latestPx3) {
            px3Cookie = pxState.latestPx3;
            log('  使用后续 ob 中的最新 _px3');
        }
        var px3Token = px3Cookie ? px3Cookie.split(':')[1] : null;
        var serverTs2 = b2.state.no;
        log('  px3Cookie = ' + (px3Cookie ? px3Cookie.substring(0, 40) + '... (len=' + px3Cookie.length + ')' : 'NULL'));
        log('  px3Token  = ' + (px3Token ? px3Token.substring(0, 30) + '...' : 'NULL'));
        log('  serverTs2 = ' + (serverTs2 || 'NULL'));

        // 校验
        var missing = [];
        if (!serverTs) missing.push('serverTs');
        if (!challengeHash) missing.push('challengeHash');
        if (!px3Cookie) missing.push('px3Cookie');
        if (!px3Token) missing.push('px3Token');
        if (missing.length) {
            log('[ERROR] 缺少必要参数: ' + missing.join(', '));
            pxState.processing = false;
            return;
        }
        if (!powAnswer) {
            log('[WARN] powAnswer 为空 (本次会话无 PoW 挑战), 继续构建...');
        }

        // Step 3: nsTs
        var nsTs = Date.now();
        log('Step 3: nsTs=' + nsTs);

        // Step 4: 构建 events
        log('Step 4: 构建 B3 events...');
        log('  初始化 WASM + buildOpts...');
        var buildOptsInput = {
            uuid: uuid, vid: vid, serverTs: serverTs, nsTs: nsTs,
            px3Cookie: px3Cookie, px3Token: px3Token,
            challengeHash: challengeHash, powAnswer: powAnswer,
            visualHash: visualHash, captchaInstanceId: captchaInstanceId,
            blockedUrl: DEFAULT_BLOCKED_URL, challengeType: "mgb"
        };
        log('  buildOpts 输入:', JSON.stringify(buildOptsInput, function(k, v) {
            if (typeof v === 'string' && v.length > 40) return v.substring(0, 40) + '...';
            return v;
        }));

        var opts;
        try {
            opts = await buildOpts(buildOptsInput);
            log('  buildOpts 成功!');
            log('  wasmA = ' + (opts.wasmA || 'NULL').substring(0, 30) + '...');
            log('  wasmB = ' + (opts.wasmB || 'NULL').substring(0, 30) + '...');
            log('  myanmarData = ' + (opts.myanmarData || 'NULL').substring(0, 30) + '...');
        } catch(e) {
            log('[ERROR] buildOpts 失败:', e.message);
            log('[ERROR] stack:', e.stack);
            pxState.processing = false;
            return;
        }

        var events;
        try {
            events = buildBundle3Events(opts);
            log('  生成 ' + events.length + ' 个事件');
            for (var i = 0; i < events.length; i++) {
                log('  Event[' + i + ']: type=' + events[i].t + ', fields=' + Object.keys(events[i].d).length);
            }
        } catch(e) {
            log('[ERROR] buildBundle3Events 失败:', e.message);
            log('[ERROR] stack:', e.stack);
            pxState.processing = false;
            return;
        }

        // Step 5: 加密
        log('Step 5: 加密 payload...');
        var payloadTs = serverTs2 || serverTs;
        log('  payloadTs = ' + payloadTs);
        var payload, pc, sid;
        try {
            payload = generatePayload(events, payloadTs, uuid);
            log('  payload = ' + payload.length + ' chars');
        } catch(e) {
            log('[ERROR] generatePayload 失败:', e.message);
            log('[ERROR] stack:', e.stack);
            pxState.processing = false;
            return;
        }
        try {
            pc = generatePC(events, uuid, TAG, FT);
            log('  pc = ' + pc);
        } catch(e) {
            log('[ERROR] generatePC 失败:', e.message);
            log('[ERROR] stack:', e.stack);
            pxState.processing = false;
            return;
        }
        try {
            sid = generateSid(pxsid || uuid, serverTs);
            log('  sid = ' + sid.substring(0, 36) + '... (len=' + sid.length + ')');
        } catch(e) {
            log('[ERROR] generateSid 失败:', e.message);
            pxState.processing = false;
            return;
        }

        // Step 6: 构建 POST body + 发送
        log('Step 6: 构建 POST body...');
        var postParams = new URLSearchParams();
        postParams.append('payload', payload);
        postParams.append('appId', APP_ID);
        postParams.append('tag', TAG);
        postParams.append('uuid', uuid);
        postParams.append('ft', String(FT));
        postParams.append('seq', String(events[0] && events[0].d && events[0].d["U08mSRUvJHk="] || 2));
        postParams.append('en', EN);
        postParams.append('bi', BI);
        postParams.append('pc', pc);
        postParams.append('sid', sid);
        postParams.append('vid', vid);
        postParams.append('cts', String(Date.now()));
        postParams.append('rsc', '3');
        if (challengeHash) postParams.append('cs', challengeHash);
        if (captchaInstanceId) postParams.append('ci', captchaInstanceId);

        var b3Body = postParams.toString();
        log('  POST body: ' + b3Body.length + ' bytes');
        // 列出所有参数
        postParams.forEach(function(v, k) {
            var display = v.length > 60 ? v.substring(0, 60) + '...' : v;
            log('  ' + k.padEnd(10) + ' = ' + display);
        });

        var bundleUrl = pxState.bundleUrl || 'https://collector-pxo1gdta7q.px-cloud.net/api/v2/collector';
        log('Step 6: 发送 B3 (XHR) → ' + bundleUrl);

        // 用原生 XHR 发送, 完全复用浏览器环境 (cookie/origin/referer)
        try {
            var b3Result = await new Promise(function(resolve, reject) {
                var xhr = new OrigXHR();
                origXhrOpen.call(xhr, 'POST', bundleUrl);
                xhr.setRequestHeader('accept', '*/*');
                xhr.setRequestHeader('content-type', 'application/x-www-form-urlencoded');
                xhr.onload = function() {
                    resolve({ status: xhr.status, text: xhr.responseText });
                };
                xhr.onerror = function() {
                    reject(new Error('XHR network error'));
                };
                origXhrSend.call(xhr, b3Body);
            });

            log('B3 响应 HTTP status: ' + b3Result.status);
            log('B3 响应 body (' + b3Result.text.length + ' chars):');
            log(b3Result.text.substring(0, 500));

            try {
                var respJson = JSON.parse(b3Result.text);
                log('═══ B3 响应 JSON ═══');
                log(JSON.stringify(respJson, null, 2));

                // 尝试解码 B3 ob 响应
                if (respJson.ob || respJson.do) {
                    log('解码 B3 ob 响应...');
                    var b3 = processOb(respJson, GT);
                    log('B3 state:', JSON.stringify(b3.state, null, 2));
                    for (var i = 0; i < b3.results.length; i++) {
                        var r = b3.results[i];
                        log('  B3 handler[' + i + ']: ' + r.handlerType + ' → ' + JSON.stringify(r.result || r.args).substring(0, 100));
                    }
                    if (b3.state.px3) {
                        writePx3Cookie(b3.state.px3);
                        log('新 _px3 cookie 已写入: ' + b3.state.px3.value.substring(0, 40) + '...');
                    }
                } else {
                    warn('B3 响应无 ob/do 字段, keys:', Object.keys(respJson).join(', '));
                }
            } catch(e) {
                warn('B3 响应不是 JSON:', e.message);
            }
        } catch(e) {
            log('[ERROR] B3 XHR 请求失败:', e.message);
            log('[ERROR] stack:', e.stack);
        }

        log('═══ B3 流程结束 ═══');

    } catch(e) {
        log('[ERROR] B3 构建/发送异常:', e.message);
        log('[ERROR] stack:', e.stack);
        console.error(e);
    }
    pxState.processing = false;
}

// ═══════════════════════════════════════════════════════════════════
// 手动触发 (在 console 中调用)
// ═══════════════════════════════════════════════════════════════════

window.__pxAutoState = pxState;
window.__pxCaptchaState = captchaState;
window.__pxBuildB3 = buildAndSendB3;
window.__pxReset = function() {
    pxState.bundleCount = 0;
    pxState.b1Request = null;
    pxState.b1Response = null;
    pxState.b2Response = null;
    pxState.processing = false;
    pxState.powAnswer = null;
    pxState.visualHash = null;
    pxState.captchaInstanceId = null;
    pxState.latestPx3 = null;
    pxState.latestServerTs = null;
    pxState.latestChallengeHash = null;
    if (pxState._b3Timeout) { clearTimeout(pxState._b3Timeout); pxState._b3Timeout = null; }
    captchaState.detected = false;
    captchaState.b1Response = null;
    captchaState.b2Response = null;
    captchaState.bundleCount = 0;
    captchaState.tag = null; captchaState.bi = null;
    captchaState.uuid = null; captchaState.vid = null;
    captchaState.sid = null; captchaState.appId = null;
    captchaState.serverTs = null; captchaState.challengeHash = null;
    captchaState.powAnswer = null; captchaState.visualHash = null;
    captchaState.captchaInstanceId = null;
    captchaState.px3Cookie = null; captchaState.px3Token = null;
    captchaState.serverTs2 = null;
    log('状态已重置 (pxState + captchaState)');
};

log('就绪! 控制台命令:');
log('  __pxAutoState      — 主页面状态');
log('  __pxCaptchaState   — captcha iframe 状态');
log('  __pxBuildB3()      — 手动触发 B3 构建');
log('  __pxReset()        — 重置全部状态');

})();
