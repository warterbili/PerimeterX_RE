/**
 * WASM Binary Extractor for PerimeterX captcha.js
 *
 * 核心发现: ks() 使用自定义 base64 字母表（小写在前）+ URI decode
 * 解码链: Us()[10] → ks.XWzSIG() (custom b64 + URI) → 可能再经过 u() 或 Is()
 */

const fs = require('fs');
const path = require('path');

const captchaPath = path.join(__dirname, '..', 'captcha.js');
console.log('[*] Reading captcha.js...');
const src = fs.readFileSync(captchaPath, 'utf-8');

// ─── Extract Us() array ───
console.log('[*] Extracting Us() array...');
const usMatch = src.match(/function Us\(\)\s*\{[^[]*var r = \[/);
if (!usMatch) { console.error('[!] Us() not found'); process.exit(1); }

const arrayStart = usMatch.index + usMatch[0].length;
let depth = 1, pos = arrayStart;
while (depth > 0 && pos < src.length) {
    if (src[pos] === '[') depth++;
    else if (src[pos] === ']') depth--;
    if (depth > 0) pos++;
}

const strings = [];
const strRegex = /"((?:[^"\\]|\\.)*)"/g;
let m;
while ((m = strRegex.exec(src.substring(arrayStart, pos))) !== null) {
    strings.push(m[1]);
}
console.log(`[*] Found ${strings.length} strings, longest at index 10: ${strings[10].length} chars`);

const wasmStr = strings[10];

// ─── Decode functions ───

// 1. ks.XWzSIG: custom base64 (lowercase-first alphabet) + URI decode
const CUSTOM_B64 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=";
function ksXWzSIG(r) {
    let n, u, t = "", v = "";
    let e = 0, f = 0, ch;
    while (ch = r.charAt(f++)) {
        u = CUSTOM_B64.indexOf(ch);
        if (~u) {
            n = e % 4 ? 64 * n + u : u;
            if (e++ % 4) {
                t += String.fromCharCode(255 & (n >> (-2 * e & 6)));
            }
        }
    }
    // URL encode each byte then decodeURIComponent
    for (let s = 0; s < t.length; s++) {
        v += "%" + ("00" + t.charCodeAt(s).toString(16)).slice(-2);
    }
    return decodeURIComponent(v);
}

// 2. Standard atob
function myAtob(input) {
    return Buffer.from(input, 'base64').toString('binary');
}

// 3. u() = standard atob + XOR "zSLyhtf"
function decodeU(input) {
    const decoded = myAtob(input);
    const key = "zSLyhtf";
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
        result += String.fromCharCode(key.charCodeAt(i % 7) ^ decoded.charCodeAt(i));
    }
    return result;
}

// Helper
function toBytes(str) {
    const arr = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i);
    return arr;
}
function isWasm(b) { return b.length >= 4 && b[0]===0 && b[1]===0x61 && b[2]===0x73 && b[3]===0x6D; }
function show(label, bytes) {
    console.log(`  ${label}: ${bytes.length} bytes | ${Array.from(bytes.slice(0,20)).map(b=>b.toString(16).padStart(2,'0')).join(' ')}`);
    if (isWasm(bytes)) {
        console.log(`  ✓ WASM MAGIC FOUND!`);
        const out = path.join(__dirname, '..', 'px_captcha.wasm');
        fs.writeFileSync(out, bytes);
        console.log(`  → Saved: ${out}`);
        return true;
    }
    return false;
}

// ─── Try all decode paths ───
console.log('\n=== Trying all decode paths on Us()[10] ===\n');

// Path 1: ks.XWzSIG (custom b64 + URI decode) → raw bytes
try {
    console.log('[1] ksXWzSIG() only (custom b64 + URI decode)');
    const d = ksXWzSIG(wasmStr);
    if (show('result', toBytes(d))) process.exit(0);
} catch(e) { console.log('  ✗', e.message); }

// Path 2: ksXWzSIG → then standard base64 decode (double decode)
try {
    console.log('[2] ksXWzSIG() → standard atob');
    const d = myAtob(ksXWzSIG(wasmStr));
    if (show('result', toBytes(d))) process.exit(0);
} catch(e) { console.log('  ✗', e.message); }

// Path 3: ksXWzSIG → then u() (atob + XOR)
try {
    console.log('[3] ksXWzSIG() → u() (atob + XOR)');
    const d = decodeU(ksXWzSIG(wasmStr));
    if (show('result', toBytes(d))) process.exit(0);
} catch(e) { console.log('  ✗', e.message); }

// Path 4: Direct standard atob
try {
    console.log('[4] Standard atob only');
    const d = myAtob(wasmStr);
    if (show('result', toBytes(d))) process.exit(0);
} catch(e) { console.log('  ✗', e.message); }

// Path 5: u() (atob + XOR)
try {
    console.log('[5] u() only (atob + XOR)');
    const d = decodeU(wasmStr);
    if (show('result', toBytes(d))) process.exit(0);
} catch(e) { console.log('  ✗', e.message); }

// Path 6: u() → then standard atob (u output is base64)
try {
    console.log('[6] u() → standard atob');
    const step1 = decodeU(wasmStr);
    const d = myAtob(step1);
    if (show('result', toBytes(d))) process.exit(0);
} catch(e) { console.log('  ✗', e.message); }

// Path 7: ksXWzSIG → u() → standard atob (triple)
try {
    console.log('[7] ksXWzSIG() → u() → atob');
    const step1 = ksXWzSIG(wasmStr);
    const step2 = decodeU(step1);
    const d = myAtob(step2);
    if (show('result', toBytes(d))) process.exit(0);
} catch(e) { console.log('  ✗', e.message); }

// Path 8: ksXWzSIG with STANDARD b64 alphabet (maybe I got it wrong)
try {
    console.log('[8] Standard b64 alphabet in ks-style decoder + URI decode');
    const STD_B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    function stdKsDecode(r) {
        let n, u, t = "", v = "";
        let e = 0, f = 0, ch;
        while (ch = r.charAt(f++)) {
            u = STD_B64.indexOf(ch);
            if (~u) {
                n = e % 4 ? 64 * n + u : u;
                if (e++ % 4) t += String.fromCharCode(255 & (n >> (-2 * e & 6)));
            }
        }
        for (let s = 0; s < t.length; s++) v += "%" + ("00" + t.charCodeAt(s).toString(16)).slice(-2);
        return decodeURIComponent(v);
    }
    const d = stdKsDecode(wasmStr);
    if (show('result', toBytes(d))) process.exit(0);
} catch(e) { console.log('  ✗', e.message); }

// Path 9: Just the raw ks custom b64 decode WITHOUT URI step → could be binary WASM
try {
    console.log('[9] ks custom b64 decode (NO URI step)');
    let n, u2, t = "";
    let e = 0, f = 0, ch;
    const r = wasmStr;
    while (ch = r.charAt(f++)) {
        u2 = CUSTOM_B64.indexOf(ch);
        if (~u2) {
            n = e % 4 ? 64 * n + u2 : u2;
            if (e++ % 4) t += String.fromCharCode(255 & (n >> (-2 * e & 6)));
        }
    }
    if (show('result', toBytes(t))) process.exit(0);
} catch(e) { console.log('  ✗', e.message); }

// Path 10: standard atob WITHOUT URI step
try {
    console.log('[10] standard atob (no URI)');
    const STD_B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    let n, u2, t = "";
    let e = 0, f = 0, ch;
    const r = wasmStr;
    while (ch = r.charAt(f++)) {
        u2 = STD_B64.indexOf(ch);
        if (~u2) {
            n = e % 4 ? 64 * n + u2 : u2;
            if (e++ % 4) t += String.fromCharCode(255 & (n >> (-2 * e & 6)));
        }
    }
    if (show('result', toBytes(t))) process.exit(0);
} catch(e) { console.log('  ✗', e.message); }

console.log('\n[!] No path produced WASM magic bytes.');
console.log('[!] The WASM binary might NOT be embedded in Us() array.');
console.log('[!] It might be fetched from a URL at runtime.');

// Check if there's a URL pattern for WASM loading
const wasmUrlMatch = src.match(/\.wasm/gi);
const fetchMatch = src.match(/fetch\s*\(/g);
console.log(`\n[*] ".wasm" references in captcha.js: ${wasmUrlMatch ? wasmUrlMatch.length : 0}`);
console.log(`[*] "fetch(" references: ${fetchMatch ? fetchMatch.length : 0}`);
