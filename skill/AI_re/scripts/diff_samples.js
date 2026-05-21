// 多批 ev2 字段三分法 (STATIC / DYNAMIC / CONDITIONAL)
//
// 用法:
//   node diff_samples.js <event_json目录> <样本名1> <样本名2> ... [--out <输出JSON>]
//   每个样本名对应 <目录>/<名>.json，文件内容为 [{ t, d }]
//
// 示例:
//   node diff_samples.js ./event_json batch1_2 batch2_2 batch3_2 batch4_2 --out diff_result.json
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const outIdx = argv.indexOf('--out');
const outPath = outIdx >= 0 ? argv[outIdx + 1] : path.resolve(process.cwd(), 'diff_result.json');
const positional = outIdx >= 0 ? argv.slice(0, outIdx).concat(argv.slice(outIdx + 2)) : argv;
if (positional.length < 3) {
    console.error('用法: node diff_samples.js <event_json目录> <样本1> <样本2> [...更多样本] [--out 输出]');
    console.error('  最少需要 2 个样本; 推荐 6 个以上才能稳定区分 STATIC/DYNAMIC');
    process.exit(1);
}
const ROOT = path.resolve(positional[0]);
const sampleNames = positional.slice(1);

function loadEv(name) {
    return JSON.parse(fs.readFileSync(path.join(ROOT, name + '.json')))[0].d;
}

const samples = {};
for (const n of sampleNames) samples[n] = loadEv(n);

const allKeys = new Set();
for (const s of Object.values(samples)) for (const k of Object.keys(s)) allKeys.add(k);

let common = [], conditional = [], staticAll = [], dynamicAll = [];
for (const k of allKeys) {
    const present = Object.entries(samples).filter(([_,v]) => k in v).map(([n,_])=>n);
    const NBATCHES = Object.keys(samples).length;
    if (present.length < NBATCHES) {
        conditional.push({k, in: present, values: Object.fromEntries(present.map(n=>[n, samples[n][k]]))});
    } else {
        common.push(k);
        const vals = Object.values(samples).map(s => JSON.stringify(s[k]));
        if (new Set(vals).size === 1) {
            staticAll.push({k, value: samples[sampleNames[0]][k]});
        } else {
            const o = {k};
            for (const n of Object.keys(samples)) o[n] = samples[n][k];
            dynamicAll.push(o);
        }
    }
}

const N = sampleNames.length;
console.log(`EV2 ${N} 批合集: ${allKeys.size} fields`);
console.log(`  COMMON (${N} 批都有): ${common.length}`);
console.log(`    ├─ STATIC (${N} 批值相同): ${staticAll.length}`);
console.log(`    └─ DYNAMIC (${N} 批值不同): ${dynamicAll.length}`);
console.log(`  CONDITIONAL (不全 ${N} 批都有): ${conditional.length}`);

console.log('\n--- CONDITIONAL fields (likely depends on session state) ---');
for (const c of conditional) {
    console.log(`  ${c.k}  [present in: ${c.in.join(',')}]`);
    for (const [n,v] of Object.entries(c.values)) {
        console.log(`    ${n}: ${JSON.stringify(v).slice(0,80)}`);
    }
}

fs.writeFileSync(outPath, JSON.stringify({
    summary: {total: allKeys.size, common: common.length, static: staticAll.length, dynamic: dynamicAll.length, conditional: conditional.length},
    staticAll, dynamicAll, conditional,
}, null, 2));
console.log('\nfull saved to', outPath);
