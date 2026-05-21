// 对每个 DYNAMIC 字段，在 SDK 中定位赋值上下文
//
// 用法: node probe_dynamic.js <diff_result.json> <hQ_map.json> <SDK路径>
const fs = require('fs');
const path = require('path');

if (process.argv.length < 5) {
    console.error('用法: node probe_dynamic.js <diff_result.json> <hQ_map.json> <SDK路径>');
    process.exit(1);
}
const diff = require(path.resolve(process.argv[2]));
const hQmap = require(path.resolve(process.argv[3]));
const sdk = fs.readFileSync(path.resolve(process.argv[4]), 'utf-8');
const sdkLines = sdk.split('\n');

const rev = {};
for (const [n, v] of Object.entries(hQmap)) if (!(v in rev)) rev[v] = +n;

function lineOf(idx) {
    // 转换 char index → line number
    let line = 1, c = 0;
    for (let i = 0; i < idx; i++) if (sdk[i] === '\n') line++;
    return line;
}

function findPlain(key) {
    const lit = `"${key}"`;
    const idx = sdk.indexOf(lit);
    if (idx < 0) return null;
    return {line: lineOf(idx), context: sdk.slice(idx, idx + 200).replace(/\n/g, ' ')};
}

function findHQ(N) {
    // 找 hQ(N) 或 hQ(<spaces>N<spaces>)
    const reN = new RegExp(`hQ\\(\\s*${N}\\s*\\)`, 'g');
    const matches = [];
    let m;
    while ((m = reN.exec(sdk)) !== null) {
        matches.push({line: lineOf(m.index), context: sdk.slice(m.index, m.index + 200).replace(/\n/g, ' ')});
        if (matches.length >= 3) break;
    }
    return matches;
}

console.log('=== DYNAMIC fields probe ===\n');

for (const d of diff.dynamicAll) {
    const k = d.k;
    console.log(`\n### "${k}"`);
    const sample = [d.batch1, d.batch2, d.batch3, d.batch4].filter(v => v !== undefined);
    const vstr = sample.map(v => typeof v === 'object' ? JSON.stringify(v).slice(0,30) : String(v).slice(0,30));
    console.log(`  values across batches: ${vstr.join(' | ')}`);
    const plain = findPlain(k);
    if (plain) {
        console.log(`  [plain] L${plain.line}: ${plain.context.slice(0,160)}`);
        continue;
    }
    const N = rev[k];
    if (N !== undefined) {
        console.log(`  [hQ(${N})]`);
        for (const m of findHQ(N)) {
            console.log(`    L${m.line}: ${m.context.slice(0,160)}`);
        }
    } else {
        console.log(`  NOT FOUND in SDK (likely anti-tamper dynamic key)`);
    }
}
