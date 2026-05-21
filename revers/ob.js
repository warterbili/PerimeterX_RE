/**
 * PX ob 响应解码 + 指令执行
 *
 * 还原自 main.js line 500-509 (Et/gt) + line 1423-1505 (eh/ih) + captcha.js:7165 (poi/PoW)
 *
 * ═══ 输入 ═══
 *   responseJson: String — collect/bundle 响应体 JSON, 含 .ob 或 .do 字段
 *   gt:           String — XOR 种子, 来自 main.js Et(), 如 "DXJ9dEscZAAJeA=="
 *                          每次 PX 脚本加载会变, 必须从当前版本 main.js 提取
 *
 * ═══ 输出 ═══
 *   Object — {
 *     segments: String[],         // 解码后的原始段
 *     results:  Object[],         // 每段 handler 执行结果 { handler, args, result }
 *     state:    Object            // handler 设置的全局状态 (jf, no, qa, ao 等)
 *   }
 *
 * ═══ 算法链 ═══
 *   1. xorKey = parseInt(ml(gt), 10) % 128    — gt 哈希 → XOR key
 *   2. ob = JSON.parse(response).ob || .do
 *   3. decoded = base64(ob) → XOR(xorKey)
 *   4. segments = decoded.split("~~~~")
 *   5. 每段: fields = seg.split("|"), shift() 取 handler key (丢弃, 不依赖)
 *   6. 按参数特征自动识别 handler 类型 (不依赖 key 名, 兼容所有 PX 版本)
 *   7. "cc" 标记段优先执行 (unshift 到队头)
 *   8. 执行 handler, 收集 state 和 results
 *
 * ═══ state 字段 (POST 参数来源) ═══
 *   state.no     = 服务器时间戳 (用于 payload 交织 + sid 隐写)
 *   state.qa     = challenge hash → cs 参数
 *   state.vid    = visitor ID → vid 参数 (ob handler "00I0I0")
 *   state.cts    = client timestamp UUID → cts 参数 (ob handler "0III0000")
 *   state.pxsid  = session UUID → sid 参数的 UUID 部分 (ob handler "I0III0")
 *   state.jf     = 控制标志 ("cu")
 *   state.ao     = 状态码 ("401")
 *
 * 用法:
 *   const processOb = require('./ob')
 *   const { segments, results, state } = processOb(responseJson, gt)
 *   const sid = processOb.buildSid(state)   // pxsid + hh(no) 隐写
 */

const crypto = require('crypto');

// ═══ ml() — 哈希函数, 返回 3 位数字字符串 (main.js:2131) ═══

function ml(t) {
    let e = 0;
    for (let n = 0; n < t.length; n++)
        e = (31 * e + t.charCodeAt(n)) % 2147483647;
    return (e % 900 + 100).toString();
}

// ═══ ee() — XOR 编解码 (main.js:666-670) ═══

function xor(t, key) {
    let n = '';
    for (let i = 0; i < t.length; i++)
        n += String.fromCharCode(t.charCodeAt(i) ^ key);
    return n;
}

// ═══ sha256 ═══

function sha256(data) {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

// ═══ solvePow — PoW 求解器 (captcha.js:7165-7170 + 7411) ═══
// PX1135 = PX762 = Bs
//
// 输入:
//   targetHash: String — 目标 SHA-256 hash
//   suffix:     String — 前缀字符串
//   difficulty: Number — 搜索位数 (默认 16)
//
// 输出:
//   { answer, counter, elapsed } 或 null

function solvePow(targetHash, suffix, difficulty) {
    difficulty = +difficulty || 16;
    const start = Date.now();
    const m = Math.ceil(difficulty / 4);
    const mask = (1 << (4 * m)) - 1;
    const lastHex = parseInt('0x' + suffix.charAt(suffix.length - 1), 16);
    const prefix = suffix.slice(0, -1);
    const max = 1 << difficulty;

    for (let r = 0; r < max; r++) {
        const low = ('0'.repeat(m) + (r & mask).toString(16)).slice(-m);
        const candidate = prefix + (lastHex + (r >> (m << 2))).toString(16) + low;
        if (sha256(candidate) === targetHash)
            return { answer: candidate, counter: r, elapsed: Date.now() - start };
    }
    return null;
}

// ═══ decodeOb — ob 字段解码 ═══

function decodeOb(responseJson, gt) {
    const xorKey = parseInt(ml(gt), 10) % 128;
    const parsed = typeof responseJson === 'string' ? JSON.parse(responseJson) : responseJson;
    const obValue = parsed.do || parsed.ob;
    if (!obValue) return { xorKey, segments: [] };

    const decoded = Buffer.from(obValue, 'base64').toString('binary');
    const segments = xor(decoded, xorKey).split('~~~~');
    return { xorKey, segments };
}

// ═══ UUID 正则 ═══
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ═══ hh() — sid 隐写编码 (main.js:4366-4373) ═══
function hh(t) {
    let r = '';
    for (let i = 0; i < t.length; i++)
        r += String.fromCodePoint(0xE0100 + t.charCodeAt(i));
    return r;
}

// ═══ 特征匹配规则 ═══
// 不依赖 handler key 名, 按参数内容自动识别 handler 类型
// 每条规则: { name, match(args), exec(state, args) }

const HANDLER_RULES = [
    // ── set_cookie (oh) ── args[0]=cookieName 含 "px", 5 个参数
    {
        name: 'set_cookie',
        match: (args) => args.length >= 4 && /^_?px/i.test(args[0]),
        exec: (state, args) => {
            const [cookieName, ttl, cookieValue, secure, maxAge] = args;
            state.px3 = { name: cookieName, value: cookieValue, ttl: +ttl,
                          secure: secure === "true", maxAge: +maxAge };
            return { type: 'set_cookie', name: cookieName, value: cookieValue, ttl: +ttl };
        }
    },
    // ── PoW start (PX1135=Bs) ── 5 args, args[0]="1"/"0", args[2]=64hex, args[3]=difficulty
    {
        name: 'pow_start',
        match: (args) => args.length === 5 && (args[0] === "1" || args[0] === "0")
            && /^[0-9a-f]{64}$/.test(args[2]) && /^\d{1,3}$/.test(args[3]),
        exec: (state, args) => {
            const [enabled, suffix, targetHash, difficulty, isTrusted] = args;
            if (enabled !== "1") return { type: 'pow', enabled: false };
            const pow = solvePow(targetHash, suffix, +difficulty);
            return { type: 'pow', enabled: true, suffix, targetHash,
                     difficulty: +difficulty, isTrusted: isTrusted === "true", pow };
        }
    },
    // ── PoW challenge (qu) ── 6+ args, args[0]="1"/"0", args[1]=UUID, args[2]=port
    {
        name: 'pow_challenge',
        match: (args) => args.length >= 6 && (args[0] === "1" || args[0] === "0")
            && /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(args[1]),
        exec: (state, args) => {
            const [enabled, uuid, port, challengeData, extra, tag] = args;
            if (enabled !== "1") return { type: 'pow_challenge', enabled: false };
            const parts = (challengeData || "").split("_");
            if (parts.length !== 2) return { type: 'pow_challenge', error: 'bad challenge format' };
            const hash = parts[0];
            let suffix = '';
            for (let i = 0; i < parts[1].length; i++)
                suffix += String.fromCharCode(parts[1].charCodeAt(i) ^ 10);
            state.powUuid = uuid;
            return { type: 'pow_challenge', uuid, port: +port, hash, suffix, extra: +extra, tag };
        }
    },
    // ── visual challenge (PX12634) ── 5 args, 前 4 小数字, 第 5 是 64hex
    {
        name: 'visual_challenge',
        match: (args) => args.length === 5 && /^\d{1,4}$/.test(args[0])
            && /^\d{1,4}$/.test(args[1]) && /^[0-9a-f]{64}$/.test(args[4]),
        exec: (state, args) => {
            const [startW, startH, wJump, hJump, hash] = args;
            return { type: 'visual_challenge', startWidth: +startW, startHeight: +startH,
                     widthJump: +wJump, heightJump: +hJump, hash };
        }
    },
    // ── timestamp (ch) ── 1 arg, 13 位时间戳
    {
        name: 'timestamp',
        match: (args) => args.length === 1 && /^1[5-9]\d{11}$/.test(args[0]),
        exec: (state, args) => {
            state.no = args[0];
            state.ro = Math.floor(parseInt(args[0]) / 1000);
        }
    },
    // ── challenge hash (cs=qa) ── 1 arg, 64 hex
    {
        name: 'challenge_hash',
        match: (args) => args.length === 1 && /^[0-9a-f]{64}$/.test(args[0]),
        exec: (state, args) => {
            state.qa = args[0];
        }
    },
    // ── vid (00I0I0) ── 3 args, UUID + TTL数字 + flag
    {
        name: 'vid',
        match: (args) => args.length === 3 && UUID_RE.test(args[0]) && /^\d+$/.test(args[1]),
        exec: (state, args) => {
            state.vid = args[0];
            return { type: 'vid', value: args[0], ttl: +args[1], flag: args[2] };
        }
    },
    // ── cts (0III0000) ── 2 args, UUID + flag
    {
        name: 'cts',
        match: (args) => args.length === 2 && UUID_RE.test(args[0]),
        exec: (state, args) => {
            state.cts = args[0];
            return { type: 'cts', value: args[0], flag: args[1] };
        }
    },
    // ── pxsid (I0III0) ── 1 arg, UUID
    {
        name: 'pxsid',
        match: (args) => args.length === 1 && UUID_RE.test(args[0]),
        exec: (state, args) => {
            state.pxsid = args[0];
            return { type: 'pxsid', value: args[0] };
        }
    },
    // ── session ID (fh) ── 1-2 args, 第一个是 16+ 位纯数字
    {
        name: 'session_id',
        match: (args) => (args.length === 1 || args.length === 2) && /^\d{16,}$/.test(args[0]),
        exec: (state, args) => {
            state.to = args[0];
            state.eo = args[1] || null;
        }
    },
    // ── status code (ah) ── 1 arg, 3 位数字 (如 401, 680)
    {
        name: 'status_code',
        match: (args) => args.length === 1 && /^\d{3}$/.test(args[0]),
        exec: (state, args) => {
            state.ao = args[0];
        }
    },
    // ── app ID ── 1 arg, 12-30 字符, 含小写字母和数字
    {
        name: 'app_id',
        match: (args) => args.length === 1 && /^[a-z0-9]{12,30}$/.test(args[0]),
        exec: (state, args) => {
            state.appId = args[0];
        }
    },
    // ── control flag (jf) ── 1 arg, 2-4 字符短字符串 (如 "cu")
    {
        name: 'control_flag',
        match: (args) => args.length === 1 && /^[a-z]{2,4}$/.test(args[0]),
        exec: (state, args) => {
            state.jf = args[0];
        }
    },
    // ── feature flags ── 1 arg, "key:val,key:val" 格式
    {
        name: 'feature_flags',
        match: (args) => args.length === 1 && /^[a-z]+:\d+(,[a-z]+:\d+)*$/.test(args[0]),
        exec: (state, args) => {
            const items = {};
            args[0].split(",").forEach(item => {
                const [k, v] = item.split(":");
                if (k) items[k] = v;
            });
            state.features = Object.assign(state.features || {}, items);
            return { type: 'feature_flags', items };
        }
    },
    // ── cookie config (ff) ── 3 args, name/ttl/value, name 是短字符串
    {
        name: 'cookie_config',
        match: (args) => (args.length === 3 || args.length === 4)
            && /^[a-zA-Z0-9_\-]{1,30}$/.test(args[0]) && /^\d+$/.test(args[1]),
        exec: (state, args) => {
            const [name, ttl, value] = args;
            state.cookies = state.cookies || {};
            state.cookies[name] = { ttl: +ttl, value: value };
            return { type: 'cookie_config', name, ttl: +ttl, value };
        }
    },
    // ── storage TTL ── 5 args, args[0] 是 key, args[1] 是数字 TTL
    {
        name: 'storage_ttl',
        match: (args) => args.length === 5 && /^\d+$/.test(args[1]),
        exec: (state, args) => {
            return { type: 'storage_ttl', key: args[0], ttl: args[1],
                     value: args[2], param: args[3], extra: args[4] };
        }
    },
    // ── captcha control (OllOlOOO) ── 1 arg, 小负数或小数字, 传给 PX764
    {
        name: 'captcha_control',
        match: (args) => args.length === 1 && /^-?\d{1,3}$/.test(args[0])
            && Math.abs(+args[0]) <= 100,
        exec: (state, args) => {
            state.captchaSignal = +args[0];
            return { type: 'captcha_control', signal: +args[0] };
        }
    },
    // ── 0 args → noop / reset / clear_cookie / px_control ──
    {
        name: 'noop',
        match: (args) => args.length === 0,
        exec: () => { return { type: 'noop' }; }
    },
];

// ═══ detectHandler — 按参数特征匹配 handler ═══

function detectHandler(args) {
    for (const rule of HANDLER_RULES) {
        if (rule.match(args)) return rule;
    }
    return null;
}

// ═══ executeSegments — 段处理器 ═══
// 1. 每段 "|" 分割, shift() 丢弃 handler key
// 2. "cc" 标记 → 延迟, unshift 到队头
// 3. 按特征匹配执行

function executeSegments(segments, state) {
    let deferred = null;
    const queue = [];

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (!seg) continue;
        const fields = seg.split('|');
        const key = fields.shift(); // handler key (仅记录, 不用于匹配)

        if (fields[0] === 'cc') {
            // "cc" 既是延迟标记, 也是实际的 cookie/config name
            // 不从 args 中去掉, 原样传给 handler
            deferred = { key, args: fields };
            continue;
        }
        queue.push({ key, args: fields });
    }
    if (deferred) queue.unshift(deferred);

    const results = [];
    for (const item of queue) {
        const rule = detectHandler(item.args);
        if (!rule) {
            results.push({ handler: item.key, handlerType: 'unknown', args: item.args });
            continue;
        }
        try {
            const result = rule.exec(state, item.args);
            results.push({ handler: item.key, handlerType: rule.name, args: item.args, result });
        } catch (e) {
            results.push({ handler: item.key, handlerType: rule.name, args: item.args, error: e.message });
        }
    }
    return results;
}

// ═══ processOb — 主入口 ═══

function processOb(responseJson, gt) {
    const { xorKey, segments } = decodeOb(responseJson, gt);
    const state = {};
    const results = executeSegments(segments, state);
    return { xorKey, segments, results, state };
}

// ═══ buildSid — 从 state 构造 sid (含隐写) ═══
// sid = pxsid + hh(no)
// 首次请求 (无 ob 响应): 返回 null, mh() 不发 sid 参数

function buildSid(state) {
    if (!state.pxsid && !state.no) return null;
    const uuid = state.pxsid || '';
    const ts = state.no || '';
    return (uuid || null) && (uuid + hh(String(ts)));
}

// ═══ getParams — 从 state 提取 POST 所需的所有 ob 参数 ═══

function getParams(state) {
    return {
        vid: state.vid || null,      // → vid=
        cts: state.cts || null,      // → cts=
        cs: state.qa || null,        // → cs=
        sid: buildSid(state),        // → sid= (含隐写)
        no: state.no || null,        // 服务器时间戳 → payload 交织用
    };
}

module.exports = processOb;
module.exports.decodeOb = decodeOb;
module.exports.solvePow = solvePow;
module.exports.ml = ml;
module.exports.buildSid = buildSid;
module.exports.getParams = getParams;
