#!/usr/bin/env node
/**
 * Build EV1 / EV2 templates for walmart from the 6 captured batches.
 *
 * Outputs:
 *   tmp/walmart/px_cookie/walmart_ev1_template.json
 *   tmp/walmart/px_cookie/walmart_ev2_template.json
 *   tmp/walmart/px_cookie/walmart_ev1_field_map.json
 *   tmp/walmart/px_cookie/walmart_ev2_field_map.json
 *
 * Categories per key across the N batches:
 *   STATIC      — same value everywhere → bake into template
 *   DYNAMIC     — different in every batch → generator must produce
 *   PARTIAL     — sometimes the same → likely DYNAMIC, occasional collision
 *   CONDITIONAL — missing in ≥1 batch
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SAMPLES = path.join(ROOT, 'sample');
const OUT = path.join(ROOT, 'px_cookie');
fs.mkdirSync(OUT, { recursive: true });

function classify(values) {
    const uniq = new Set(values.map(v => JSON.stringify(v)));
    return uniq.size === 1 ? 'STATIC'
        : uniq.size === values.length ? 'DYNAMIC'
        : 'PARTIAL';
}

function buildTable(evNum) {
    const batches = [];
    for (let i = 1; i <= 6; i++) {
        const p = path.join(SAMPLES, String(i), `decoded_payload_${evNum}.json`);
        if (!fs.existsSync(p)) continue;
        const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (!arr || !arr[0]) continue;
        batches.push(arr[0]);
    }
    if (batches.length < 2) {
        console.error(`EV${evNum}: only ${batches.length} batches; skipping`);
        return null;
    }
    const t0 = batches[0];
    const allKeys = new Set();
    batches.forEach(b => Object.keys(b.d || {}).forEach(k => allKeys.add(k)));

    const fieldMap = {};
    for (const k of allKeys) {
        const vals = batches.map(b => b.d ? b.d[k] : undefined);
        const present = vals.filter(v => v !== undefined);
        const category = present.length < batches.length
            ? 'CONDITIONAL'
            : classify(present);
        fieldMap[k] = {
            category,
            sample_values: vals.slice(0, 3),
            present_in: present.length + '/' + batches.length,
        };
    }

    // Use batch 1 as base template
    const template = JSON.parse(JSON.stringify(t0));
    template._meta = {
        site: 'walmart.com',
        ev_num: evNum,
        event_type_t: t0.t,
        n_batches: batches.length,
        n_keys: allKeys.size,
        n_static:  Object.values(fieldMap).filter(f => f.category === 'STATIC').length,
        n_dynamic: Object.values(fieldMap).filter(f => f.category === 'DYNAMIC').length,
        n_partial: Object.values(fieldMap).filter(f => f.category === 'PARTIAL').length,
        n_conditional: Object.values(fieldMap).filter(f => f.category === 'CONDITIONAL').length,
    };

    fs.writeFileSync(
        path.join(OUT, `walmart_ev${evNum}_template.json`),
        JSON.stringify([template], null, 2));
    fs.writeFileSync(
        path.join(OUT, `walmart_ev${evNum}_field_map.json`),
        JSON.stringify(fieldMap, null, 2));

    console.log(`EV${evNum}: ${batches.length} batches, ${allKeys.size} keys ` +
        `(${template._meta.n_static} STATIC, ${template._meta.n_dynamic} DYNAMIC, ` +
        `${template._meta.n_partial} PARTIAL, ${template._meta.n_conditional} CONDITIONAL)`);

    // Print DYNAMIC + PARTIAL keys (these are what the generator must compute)
    const dyn = Object.entries(fieldMap)
        .filter(([k, f]) => f.category === 'DYNAMIC' || f.category === 'PARTIAL' || f.category === 'CONDITIONAL')
        .map(([k, f]) => ({ key: k, category: f.category, present_in: f.present_in, sample: f.sample_values[0] }));
    console.log(`\n--- EV${evNum} variable keys (${dyn.length}) ---`);
    dyn.forEach(d => console.log(`  [${d.category.padEnd(11)}] ${d.key}  ←  ${String(JSON.stringify(d.sample)).slice(0,80)}`));
    return { template, fieldMap, batches };
}

buildTable(1);
buildTable(2);
buildTable(3);
