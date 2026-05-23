#!/usr/bin/env node
/**
 * smoke_test.js — Grubhub generator 端到端 smoke test（SDK 版本无关）
 *
 * 设计原则：
 *   - 不硬编码 SDK 版本特定的常量值（TAG/AppID 不写死）
 *   - 从 ../source/SDK_INFO.md 读"权威常量值"（单一可信源）
 *   - 只验证常量"格式"是否合法（AppID 起头 PX、TAG 是 base64 etc）
 *   - 检查生成器的常量跟 SDK_INFO 一致（保证三方同步）
 *
 * 这样 PX 推新 SDK：
 *   1. 你更新 source/init.js
 *   2. 你更新 source/SDK_INFO.md 里的常量值
 *   3. 你更新 generator 里的常量值
 *   4. smoke test 自动验证三方一致 ← 这里
 *
 * 用法:
 *   node smoke_test.js
 */

const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const SDK_INFO = path.join(HERE, '..', 'source', 'SDK_INFO.md');
const SDK_FILE = path.join(HERE, '..', 'source', 'init.js');
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

console.log('═══ Grubhub px_cookie smoke test (SDK 版本无关) ═══\n');

// ── Layer 1: 从 SDK_INFO.md 读权威常量 ──
console.log('--- 1. 从 SDK_INFO.md 读权威常量 ---');
let SDK_CONSTANTS = {};
check('SDK_INFO.md 存在并可解析', () => {
    if (!fs.existsSync(SDK_INFO)) throw new Error(`缺 ${SDK_INFO}`);
    const txt = fs.readFileSync(SDK_INFO, 'utf-8');
    const patterns = {
        APP_ID:  /AppID[^|]*\|\s*\*?\*?`([^`]+)`/,
        TAG:     /TAG[^|]*\|\s*\*?\*?`([^`]+)`/,
        FT:      /FT[^|]*\|\s*\*?\*?`([^`]+)`/,
        COOKIE:  /Cookie[^|]*\|\s*`(_px[0-9])`/,
        SHA:     /SHA-256[^|]*\|\s*`([a-f0-9]{64})`/,
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
    if (!fs.existsSync(SDK_FILE)) throw new Error(`缺 ${SDK_FILE}`);
    return `${fs.statSync(SDK_FILE).size} bytes`;
});

check('SDK SHA-256 跟 SDK_INFO.md 一致', () => {
    const crypto = require('crypto');
    // Normalize line endings (CRLF→LF) for cross-platform SHA stability.
    // Without this, Windows checkout (CRLF) and Linux/Mac (LF) compute different SHAs
    // for the same source file.
    const buf = fs.readFileSync(SDK_FILE);
    const normalized = Buffer.from(buf.toString('binary').replace(/\r\n/g, '\n'), 'binary');
    const sha = crypto.createHash('sha256').update(normalized).digest('hex');
    if (sha !== SDK_CONSTANTS.SHA) {
        throw new Error(`SDK 已变！\n          实际: ${sha}\n          预期: ${SDK_CONSTANTS.SHA}`);
    }
    return sha.slice(0, 16) + '…';
});

check('SDK 里能 grep 到 AppID', () => {
    const src = fs.readFileSync(SDK_FILE, 'utf-8');
    if (!src.includes(SDK_CONSTANTS.APP_ID)) throw new Error('SDK 里找不到 AppID 字面量');
    return `"${SDK_CONSTANTS.APP_ID}" 在 SDK 里`;
});

check('SDK 里能 grep 到 TAG', () => {
    const src = fs.readFileSync(SDK_FILE, 'utf-8');
    if (!src.includes(SDK_CONSTANTS.TAG)) throw new Error('SDK 里找不到 TAG 字面量');
    return `"${SDK_CONSTANTS.TAG}"`;
});

// ── Layer 3: 常量格式校验（跨版本通用）──
console.log('\n--- 3. 常量格式合法性（跨版本通用规则）---');
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

check('Cookie 是 _px2 或 _px3', () => {
    if (!/^_px[23]$/.test(SDK_CONSTANTS.COOKIE))
        throw new Error(`不是 _px2 或 _px3: ${SDK_CONSTANTS.COOKIE}`);
    return SDK_CONSTANTS.COOKIE;
});

check('Cookie 是 _px2（Grubhub 特有）', () => {
    if (SDK_CONSTANTS.COOKIE !== '_px2')
        throw new Error(`Grubhub 应是 _px2，实际 ${SDK_CONSTANTS.COOKIE}`);
    return '_px2';
});

// ── Layer 4: 模板文件 ──
console.log('\n--- 4. 模板文件 ---');
for (const f of ['grubhub_ev1_template.json', 'grubhub_ev2_template.json']) {
    check(`${f}`, () => {
        const fp = path.join(HERE, f);
        if (!fs.existsSync(fp)) throw new Error('缺');
        const data = JSON.parse(fs.readFileSync(fp, 'utf-8'));
        const fields = data[0]?.d ? Object.keys(data[0].d).length : 0;
        return `${fs.statSync(fp).size} bytes, ${fields} 字段`;
    });
}

// ── Layer 5: 生成器跟 SDK_INFO 同步 ──
console.log('\n--- 5. 生成器常量跟 SDK_INFO 同步 ---');
const src = fs.readFileSync(path.join(HERE, 'grubhub_px2.js'), 'utf-8');

check('grubhub_px2.js 含正确 AppID', () => {
    if (!src.includes(SDK_CONSTANTS.APP_ID))
        throw new Error(`Generator 用了不一致的 AppID（SDK_INFO 是 ${SDK_CONSTANTS.APP_ID}）`);
    return SDK_CONSTANTS.APP_ID;
});

check('grubhub_px2.js 含正确 TAG', () => {
    if (!src.includes(SDK_CONSTANTS.TAG))
        throw new Error(`Generator 用了不一致的 TAG`);
    return SDK_CONSTANTS.TAG;
});

check('grubhub_px2.js 含正确 FT', () => {
    const re = new RegExp(`\\bFT\\s*=\\s*['"]?${SDK_CONSTANTS.FT}['"]?`);
    if (!re.test(src))
        throw new Error(`Generator FT 不是 ${SDK_CONSTANTS.FT}`);
    return SDK_CONSTANTS.FT;
});

check('grubhub_px2.js 含正确 Collector URL', () => {
    if (!src.includes('sensor.grubhub.com/O97ybH4J/xhr/api/v2/collector'))
        throw new Error('Collector URL 不对');
    return 'sensor.grubhub.com/.../collector';
});

// ── Layer 6: 生成器加载 ──
console.log('\n--- 6. 生成器加载 ---');
check('grubhub_px2.js require()', () => {
    const gen = require(path.join(HERE, 'grubhub_px2.js'));
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
    console.log('  3. 模板字段数大变 → PX 升了 EV 结构，跑 stample/grub/script/diff_samples.py');
    process.exit(1);
}

console.log('\n下一步实战测试（打真 HTTP）：');
console.log('  node grubhub_px2.js');
