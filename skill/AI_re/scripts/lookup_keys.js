// 反查每个 ev2 key 在 hQ 表里的 N，或者标记"明文 SDK 出现"
//
// 用法: node lookup_keys.js <hQ_map.json> <SDK路径> <ev2样本JSON> [输出JSON]
//   ev2样本: 一个 [{t,d}] 数组（如 event_json/batch1_2.json）
const fs = require('fs');
const path = require('path');

if (process.argv.length < 5) {
    console.error('用法: node lookup_keys.js <hQ_map.json> <SDK路径> <ev2样本JSON> [输出JSON]');
    process.exit(1);
}
const hqMapPath = path.resolve(process.argv[2]);
const sdkPath = path.resolve(process.argv[3]);
const ev2Path = path.resolve(process.argv[4]);
const outPath = process.argv[5] || path.resolve(process.cwd(), 'lookup_result.json');

const map = require(hqMapPath);
const sdk = fs.readFileSync(sdkPath, 'utf-8');
const ev2 = require(ev2Path)[0].d;

// 反查表: string -> N
const rev = {};
for (const [n, v] of Object.entries(map)) {
    if (!(v in rev)) rev[v] = +n;
}

const found_via_hQ = [];
const found_plain = [];
const not_found = [];

for (const key of Object.keys(ev2)) {
    if (key in rev) {
        found_via_hQ.push({key, N: rev[key]});
    } else {
        // 检查 SDK 是否有 "KEY" 明文
        const lit = `"${key}"`;
        if (sdk.includes(lit)) {
            found_plain.push({key});
        } else {
            not_found.push({key});
        }
    }
}

console.log(`EV2 keys (${Object.keys(ev2).length} total):`);
console.log(`  via hQ(N): ${found_via_hQ.length}`);
console.log(`  plain "key=" in SDK: ${found_plain.length}`);
console.log(`  not found anywhere: ${not_found.length}`);

console.log('\n--- found_plain (前30) ---');
for (const o of found_plain.slice(0,30)) console.log(`  "${o.key}"`);

console.log('\n--- found_via_hQ (前 30) ---');
for (const o of found_via_hQ.slice(0,30)) console.log(`  ${o.key} = hQ(${o.N})`);

console.log('\n--- not_found (full list) ---');
for (const o of not_found) console.log(`  "${o.key}"`);

fs.writeFileSync(outPath, JSON.stringify({found_via_hQ, found_plain, not_found}, null, 2));
console.log('\nsaved', outPath);
