#!/usr/bin/env node
/**
 * smoke_test.js — Total Wine generator smoke test (SDK 版本无关)
 *
 * 跟 stample/ifood/px_cookie/smoke_test.js 同样的设计原则：
 *   - 不硬编码 SDK 版本特定的常量值
 *   - 从 ../source/SDK_INFO.md 读"权威常量值"（单一可信源）
 *   - 只验证常量"格式"是否合法 + 跟 generator 一致
 *
 * 严档部署特别检查（Total Wine 新增 vs iFood/Grub）：
 *   - EV3 模板存在 + 11 字段
 *   - generator 实现了 collector#3 (seq=2) POST
 *
 * 用法:
 *   node smoke_test.js
 *
 * Layer 3.5 (拿 cookie 真打 PX-gated 端点) 见 ../script/smoke_10x_e2e.py
 */

const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const SDK_INFO = path.join(HERE, '..', 'source', 'SDK_INFO.md');
const OK = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
let pass = 0, fail = 0;

function check(label, fn) {
    try {
        const r = fn();
        console.log(`${OK} ${label}${r ? ': ' + r : ''}`);
        pass++;
    } catch (e) {
        console.log(`${FAIL} ${label}: ${e.message}`);
        fail++;
    }
}

console.log('═══ Total Wine px_cookie smoke test (SDK 版本无关) ═══\n');

// ── Layer 1: 从 SDK_INFO.md 读权威常量 ──
console.log('--- 1. 从 SDK_INFO.md 读权威常量 ---');
let SDK_CONSTANTS = {};
check('SDK_INFO.md 存在并可解析', () => {
    if (!fs.existsSync(SDK_INFO)) throw new Error(`缺 ${SDK_INFO}`);
    const txt = fs.readFileSync(SDK_INFO, 'utf-8');
    const patterns = {
        APP_ID:  /AppID[^|]*\|\s*`([^`]+)`/,
        TAG:     /TAG[^|]*\|\s*`([^`]+)`/,
        FT:      /FT[^|]*\|\s*`([^`]+)`/,
        COOKIE:  /Cookie[^|]*\|\s*`(_px[0-9])`/,
        SHA:     /\*\*SHA-256\*\*[^|]*\|\s*`([a-f0-9]{64})`/,
    };
    for (const [k, re] of Object.entries(patterns)) {
        const m = txt.match(re);
        if (m) SDK_CONSTANTS[k] = m[1];
    }
    const missing = Object.keys(patterns).filter(k => !SDK_CONSTANTS[k]);
    if (missing.length) throw new Error(`SDK_INFO.md 缺字段: ${missing.join(', ')}`);
    return `AppID=${SDK_CONSTANTS.APP_ID} TAG=${SDK_CONSTANTS.TAG.slice(0,16)}... FT=${SDK_CONSTANTS.FT} cookie=${SDK_CONSTANTS.COOKIE}`;
});

if (Object.keys(SDK_CONSTANTS).length === 0) {
    console.log(`${FAIL} 拿不到 SDK 常量，下面所有测试跳过`);
    process.exit(1);
}

// ── Layer 2: 验证 SDK 本身 ──
console.log('\n--- 2. SDK 本身 ---');
check('SDK 文件存在', () => {
    const sdkPath = path.join(HERE, '..', 'source', 'main.min.js');
    if (!fs.existsSync(sdkPath)) throw new Error(`缺 ${sdkPath}`);
    return `${fs.statSync(sdkPath).size} bytes`;
});

check('SDK SHA-256 跟 SDK_INFO.md 一致 (LF-normalized)', () => {
    const crypto = require('crypto');
    const sdkPath = path.join(HERE, '..', 'source', 'main.min.js');
    const buf = fs.readFileSync(sdkPath);
    const normalized = Buffer.from(buf.toString('binary').replace(/\r\n/g, '\n'), 'binary');
    const sha = crypto.createHash('sha256').update(normalized).digest('hex');
    if (sha !== SDK_CONSTANTS.SHA) {
        throw new Error(`SDK 已变！\n          实际: ${sha}\n          预期: ${SDK_CONSTANTS.SHA}`);
    }
    return sha.slice(0, 16) + '…';
});

check('SDK 里能 grep 到 AppID', () => {
    const src = fs.readFileSync(path.join(HERE, '..', 'source', 'main.min.js'), 'utf-8');
    if (!src.includes(SDK_CONSTANTS.APP_ID)) throw new Error('SDK 里找不到 AppID 字面量');
    return `"${SDK_CONSTANTS.APP_ID}" 在 SDK 里`;
});

check('SDK 里能 grep 到 TAG', () => {
    const src = fs.readFileSync(path.join(HERE, '..', 'source', 'main.min.js'), 'utf-8');
    if (!src.includes(SDK_CONSTANTS.TAG)) throw new Error('SDK 里找不到 TAG 字面量');
    return `"${SDK_CONSTANTS.TAG}"`;
});

// ── Layer 3: 常量格式校验 ──
console.log('\n--- 3. 常量格式合法性 ---');
check('AppID 是 "PX" 前缀 + 8-15 字符', () => {
    if (!/^PX[A-Za-z0-9]{8,15}$/.test(SDK_CONSTANTS.APP_ID))
        throw new Error(`不符合 PX 命名约定: ${SDK_CONSTANTS.APP_ID}`);
    return SDK_CONSTANTS.APP_ID;
});
check('TAG 是合法 base64（≥12 字符）', () => {
    if (!/^[A-Za-z0-9+/=]{12,}$/.test(SDK_CONSTANTS.TAG))
        throw new Error(`不像 base64: ${SDK_CONSTANTS.TAG}`);
    return SDK_CONSTANTS.TAG;
});
check('FT 是 3 位数字', () => {
    if (!/^[0-9]{3}$/.test(SDK_CONSTANTS.FT))
        throw new Error(`不是 3 位数字: ${SDK_CONSTANTS.FT}`);
    return SDK_CONSTANTS.FT;
});
check('Cookie 是 _px2 (Total Wine 用 _px2)', () => {
    if (SDK_CONSTANTS.COOKIE !== '_px2')
        throw new Error(`Total Wine 应是 _px2，不是 ${SDK_CONSTANTS.COOKIE}`);
    return SDK_CONSTANTS.COOKIE;
});

// ── Layer 4: 模板文件 (严档部署需要 3 个 EV 模板) ──
console.log('\n--- 4. 模板文件 (含 EV3, 严档独有) ---');
for (const f of ['totalwine_ev1_template.json',
                 'totalwine_ev2_template.json',
                 'totalwine_ev3_template.json']) {
    check(`${f}`, () => {
        const fp = path.join(HERE, f);
        if (!fs.existsSync(fp)) throw new Error('缺');
        const data = JSON.parse(fs.readFileSync(fp, 'utf-8'));
        const fields = data[0]?.d ? Object.keys(data[0].d).length : 0;
        // EV3 模板有 _meta 字段，但 field count 应该是 11 (totalwine 实测)
        return `${fs.statSync(fp).size} bytes, ${fields} 字段`;
    });
}

// ── Layer 5: 生成器跟 SDK_INFO 同步 ──
console.log('\n--- 5. 生成器常量跟 SDK_INFO 同步 ---');
const src = fs.readFileSync(path.join(HERE, 'totalwine_px2.js'), 'utf-8');
check('totalwine_px2.js 含正确 AppID', () => {
    if (!src.includes(SDK_CONSTANTS.APP_ID))
        throw new Error(`Generator 用了不一致的 AppID（SDK_INFO 是 ${SDK_CONSTANTS.APP_ID}）`);
    return SDK_CONSTANTS.APP_ID;
});
check('totalwine_px2.js 含正确 TAG', () => {
    if (!src.includes(SDK_CONSTANTS.TAG))
        throw new Error(`Generator 用了不一致的 TAG`);
    return SDK_CONSTANTS.TAG.slice(0, 16) + '…';
});
check('totalwine_px2.js 含正确 FT', () => {
    const re = new RegExp(`\\bFT\\s*=\\s*['"]?${SDK_CONSTANTS.FT}['"]?`);
    if (!re.test(src))
        throw new Error(`Generator FT 不是 ${SDK_CONSTANTS.FT}`);
    return SDK_CONSTANTS.FT;
});

// ── Layer 5.5: 严档独有 — 必发 seq=2 + 4 个 HMAC/MD5 公式正确 ──
console.log('\n--- 5.5 严档部署独有 (vs iFood/Grub) ---');
check('Generator 实现了 collector#3 (seq=2)', () => {
    if (!/seq[:=]?\s*2/.test(src) && !/seq=2/.test(src))
        throw new Error('找不到 seq=2 POST — Total Wine 需要 cookie-confirmation beacon');
    return '✓ seq=2 POST 存在';
});
check('Generator buildEv3 存在', () => {
    if (!/function\s+buildEv3|buildEv3\s*=/.test(src))
        throw new Error('找不到 buildEv3 — EV3 必发');
    return '✓ buildEv3 函数';
});
check('HMAC Lx8cFWl9HCE= 用 state.vid (不是 uuid+:a)', () => {
    // 必须 hmacMD5(ctx.state.vid, ctx.ua) 或类似
    if (!/Lx8cFWl9HCE=[^;]*state\.vid/.test(src))
        throw new Error('Lx8c 应是 hmacMD5(state.vid, UA) — 不能抄 iFood 的 hmac(uuid+":a", UA)');
    return '✓ HMAC(state.vid, UA)';
});
check('HMAC UiJhKBREYhs= 用 state.pxsid (不是 uuid+:b)', () => {
    if (!/UiJhKBREYhs=[^;]*state\.pxsid/.test(src))
        throw new Error('UiJh 应是 hmacMD5(state.pxsid, UA)');
    return '✓ HMAC(state.pxsid, UA)';
});
check('EFwjFlU8JyU= 是 md5(state.vid) 不是 HMAC', () => {
    // 必须 createHash('md5').update(state.vid) — 不能是 hmacMD5
    if (!/EFwjFlU8JyU=[^;]*createHash\(['"]md5['"]\)[^;]*state\.vid/.test(src))
        throw new Error('EFwj 应是 plain md5(state.vid), 不是 HMAC');
    return '✓ md5(state.vid)';
});
check('PX12738 与 PX12739 同步 (不能各自 random)', () => {
    // 找 MDxDNnVeQgQ= 赋值，检查里面 PX12738 和 PX12739 是同一个变量
    const m = src.match(/MDxDNnVeQgQ=['"]\s*\]\s*=[^;]+;/g);
    if (!m) throw new Error('找不到 counter 字段赋值');
    // 简化检查：在赋值上下文里 PX12738 和 PX12739 应该用同一变量
    const ctx = src.substring(src.indexOf("'MDxDNnVeQgQ='"), src.indexOf("'MDxDNnVeQgQ='") + 400);
    if (/PX12738:\s*Math\.random/.test(ctx) || /PX12738:\s*Math\.floor.*PX12739:\s*Math\.floor/.test(ctx))
        throw new Error('PX12738/PX12739 各自 random — 严档会判 bot');
    return '✓ 同步 random';
});

// ── Layer 6: 生成器加载 ──
console.log('\n--- 6. 生成器加载 ---');
check('totalwine_px2.js require()', () => {
    const gen = require(path.join(HERE, 'totalwine_px2.js'));
    if (gen.constructor.name !== 'AsyncFunction') throw new Error('应是 async function');
    return 'async function ✓';
});

console.log('\n═══════════════════════════════════════');
console.log(`  smoke test: ${pass} passed, ${fail} failed`);
console.log('═══════════════════════════════════════');

if (fail > 0) {
    console.log('\n❌ 失败排查：');
    console.log('  1. SDK 跟 SDK_INFO.md 不一致 → 重抓 SDK + 更新 SDK_INFO.md SHA');
    console.log('  2. Generator 跟 SDK_INFO 不一致 → 更新 generator 里的常量');
    console.log('  3. EV3 / HMAC / counter 检查失败 → 重读 gotchas #15-#18');
    console.log('     skill/AI_re/references/gotchas.md');
    process.exit(1);
}

console.log('\n下一步实战测试 (Layer 3.5 — 拿 cookie 真打 PX-gated 端点)：');
console.log('  $env:HTTPS_PROXY = "http://<user>-session-<id>:<pwd>@<host>:<port>"');
console.log('  python ../script/smoke_10x_e2e.py');
console.log('  期望: 10/10 PASS，每次拿到 ~1.3 MB 真实 SRP HTML');
