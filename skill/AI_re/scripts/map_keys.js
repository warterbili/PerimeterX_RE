// 旧 ev2 → 新 ev2 base64 key 映射器
// 策略：按值匹配。旧版每个 key 有已知值，新版 batch1 有相同值的就是同一个语义字段。
//
// 用法: node map_keys.js <旧px_cookie.js> <新ev2样本JSON> [输出JSON]
//   旧 px_cookie.js: 旧版生成器，需包含 ev2 硬编码 d 对象, 起点 "XQUnAxtpIzE="，
//                    终点 "// anti-tamper" 注释。如果你的旧脚本不符合此格式，
//                    请改成手动准备 oldEv2.json (key→raw 字符串) 然后绕过解析逻辑。
const fs = require('fs');
const path = require('path');

if (process.argv.length < 4) {
    console.error('用法: node map_keys.js <旧px_cookie.js> <新ev2样本JSON> [输出JSON]');
    process.exit(1);
}
const oldPxCookiePath = path.resolve(process.argv[2]);
const newEv2Path = path.resolve(process.argv[3]);
const outPath = process.argv[4] || path.resolve(process.cwd(), 'key_mapping.json');

const pxCookie = fs.readFileSync(oldPxCookiePath, 'utf-8');

// 找到 ev2 hardcoded 的 d{} 部分。手动定位：line ~302 起，ev2[0].d = {...}
// 简单方法：截取从 'XQUnAxtpIzE=' (旧 t) 到 anti-tamper 那行之前
const startMatch = pxCookie.indexOf('"XQUnAxtpIzE="');
const endMatch = pxCookie.indexOf('// anti-tamper');
if (startMatch === -1 || endMatch === -1) { console.error('failed to locate old ev2 in px_cookie.js'); process.exit(1); }
const blob = pxCookie.slice(startMatch, endMatch);

// 提取每行 "key":value 模式（不解析 JS，只 regex）
const oldEv2 = {};
const reLine = /"([A-Za-z0-9+/=]{8,16})"\s*:\s*(.+?)(?=,\s*"[A-Za-z0-9+/=]{8,16}"\s*:|,\s*$|$)/gms;
// 简化：按 key 切分
// 正则全文匹配 "key":<value> 模式，value 可能是 字符串/数字/对象/数组/布尔/null
// 用一个状态机简单切：找到 "KEY":  然后括号/引号匹配吞掉 value
let cursor = 0;
while (cursor < blob.length) { let i = cursor;
    const m = /"([A-Za-z0-9+/=]{8,16}=)"\s*:\s*/.exec(blob.slice(i));
    if (!m) break;
    const keyStart = i + m.index;
    const k = m[1];
    let valStart = keyStart + m[0].length;
    // 扫描 value 直到匹配的逗号/大括号/方括号
    let depth = 0, inStr = false, strCh = '', j = valStart;
    while (j < blob.length) {
        const c = blob[j];
        if (inStr) {
            if (c === '\\' && j+1 < blob.length) { j += 2; continue; }
            if (c === strCh) { inStr = false; j++; continue; }
            j++; continue;
        }
        if (c === '"' || c === "'") { inStr = true; strCh = c; j++; continue; }
        if (c === '{' || c === '[' || c === '(') { depth++; j++; continue; }
        if (c === '}' || c === ']' || c === ')') {
            if (depth === 0) break;
            depth--; j++; continue;
        }
        if (c === ',' && depth === 0) break;
        j++;
    }
    const rawV = blob.slice(valStart, j).trim().replace(/,$/, '');
    oldEv2[k] = rawV;
    cursor = j + 1;
}
console.log('Old ev2 keys parsed:', Object.keys(oldEv2).length);

// 加载新版 batch1 ev2 实际值
const newEv2 = JSON.parse(fs.readFileSync(newEv2Path))[0].d;
console.log('New ev2 keys (batch1):', Object.keys(newEv2).length);

// 对每个旧 key，找新版里值相同的 key
// 跳过过于通用的值（true/false/null/0/1）— 这些值会有大量碰撞
const TOO_GENERIC = new Set(['true','false','null','0','1','""','-1','2','3','4','5','8']);

const mapping = {};
const unmapped_old = [];
let mapped = 0;

for (const [oldK, oldV] of Object.entries(oldEv2)) {
    const oldVTrim = oldV.trim();
    if (TOO_GENERIC.has(oldVTrim)) continue;

    // 旧 V 可能是 JS 表达式 (函数调用 / 变量) — 跳过
    if (oldVTrim.includes('(') || oldVTrim.match(/^[a-zA-Z_]\w*$/) || oldVTrim.includes('?')) {
        continue;
    }

    // 试着把旧值当作 JS 字面量 eval (字符串 / 数字 / 简单对象)
    let oldValParsed;
    try { oldValParsed = eval('(' + oldVTrim + ')'); } catch(e) { continue; }

    const oldJSON = JSON.stringify(oldValParsed);

    // 在新版 ev2 找值完全相等的 key
    const candidates = [];
    for (const [newK, newV] of Object.entries(newEv2)) {
        if (JSON.stringify(newV) === oldJSON) candidates.push(newK);
    }

    if (candidates.length === 1) {
        mapping[oldK] = {new: candidates[0], value: oldValParsed};
        mapped++;
    } else if (candidates.length > 1) {
        mapping[oldK] = {new: candidates, value: oldValParsed, ambiguous: true};
    } else {
        unmapped_old.push({old: oldK, value: oldValParsed});
    }
}

console.log(`\nMapped (unique): ${mapped}`);
console.log(`Ambiguous: ${Object.values(mapping).filter(v => v.ambiguous).length}`);
console.log(`Unmapped old: ${unmapped_old.length}`);

// 找出新版独有的 key（没有任何旧 key 映射到这些）
const mappedNewKeys = new Set();
for (const m of Object.values(mapping)) {
    if (Array.isArray(m.new)) m.new.forEach(k => mappedNewKeys.add(k));
    else mappedNewKeys.add(m.new);
}
const unmapped_new = Object.keys(newEv2).filter(k => !mappedNewKeys.has(k));
console.log(`Unmapped new: ${unmapped_new.length}`);

fs.writeFileSync(outPath, JSON.stringify({
    summary: {old_total: Object.keys(oldEv2).length, new_total: Object.keys(newEv2).length, mapped_unique: mapped, ambiguous: Object.values(mapping).filter(v=>v.ambiguous).length, unmapped_old: unmapped_old.length, unmapped_new: unmapped_new.length},
    mapping, unmapped_old, unmapped_new
}, null, 2));
console.log('\nsaved to', outPath);

// 展示前 30 个唯一映射
console.log('\nfirst 30 unique mappings:');
let i = 0;
for (const [oldK, m] of Object.entries(mapping)) {
    if (i++ >= 30) break;
    if (m.ambiguous) continue;
    const vs = JSON.stringify(m.value).slice(0,40);
    console.log(`  ${oldK}  →  ${m.new}    (${vs})`);
}
