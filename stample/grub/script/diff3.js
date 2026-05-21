#!/usr/bin/env node
/**
 * diff3.js — Grubhub 6 批 EV2 四分类
 *
 * 比 diff_samples 多一个 "common" 类别：
 *   - common      : 6 批都存在且 6 批同值
 *   - static_all  : 6 批都存在但部分批次值不一样（一致结构，但有"半 STATIC"）
 *   - dynamic_all : 6 批都存在但每批值都不一样
 *   - conditional : 部分批次没有此 key
 *
 * 用法:
 *   node diff3.js          # 默认 EV2
 *   node diff3.js 1        # EV1
 */

const fs = require('fs');
const path = require('path');

const WHICH = process.argv[2] || '2';
const HERE = __dirname;
const SAMPLE_DIR = path.join(HERE, '..', 'sample');

function load(n) {
    const f = path.join(SAMPLE_DIR, String(n), `decoded_payload_${WHICH}.json`);
    return JSON.parse(fs.readFileSync(f, 'utf8'))[0].d;
}

const samples = {};
for (let n = 1; n <= 6; n++) samples[`batch${n}`] = load(n);

const allKeys = new Set();
for (const s of Object.values(samples)) for (const k of Object.keys(s)) allKeys.add(k);

const NBATCHES = Object.keys(samples).length;
const common = [], staticAll = [], dynamicAll = [], conditional = [];

for (const k of allKeys) {
    const present = Object.entries(samples).filter(([_, v]) => k in v).map(([n, _]) => n);
    if (present.length < NBATCHES) {
        conditional.push({ key: k, present_in: present });
        continue;
    }
    const values = present.map(n => JSON.stringify(samples[n][k]));
    const unique = new Set(values);
    if (unique.size === 1) {
        common.push({ key: k, value: samples[present[0]][k] });
    } else if (unique.size === NBATCHES) {
        dynamicAll.push({
            key: k,
            samples: present.map(n => samples[n][k])
        });
    } else {
        staticAll.push({
            key: k,
            unique_values: [...unique].map(v => JSON.parse(v))
        });
    }
}

const result = {
    summary: {
        total_keys: allKeys.size,
        common: common.length,
        static_all: staticAll.length,
        dynamic_all: dynamicAll.length,
        conditional: conditional.length
    },
    common: common.map(x => x.key),
    static_all: staticAll,
    dynamic_all: dynamicAll,
    conditional: conditional
};

console.log(`═══ Grubhub EV${WHICH} 四分类 ═══`);
console.log(JSON.stringify(result.summary, null, 2));

const out = path.join(HERE, '..', `diff3_ev${WHICH}.json`);
fs.writeFileSync(out, JSON.stringify(result, null, 2), 'utf8');
console.log(`\n→ 写入 ${out}`);

console.log(`\n前 5 个完全 DYNAMIC 字段（最关键 — 6 批每批都不一样）：`);
for (const d of dynamicAll.slice(0, 5)) {
    console.log(`  ${d.key}`);
    console.log(`    样本: ${d.samples.slice(0, 2).map(v => JSON.stringify(v).slice(0, 40))}...`);
}
