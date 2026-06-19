#!/usr/bin/env node
/**
 * For each walmart batch:
 *   - read state.* from decoded_response_1.json
 *   - read EV2 fields (.d) from decoded_payload_2.json
 *   - find which EV2 b64 keys equal each state.* value (string AND int form)
 *
 * A b64 key that consistently matches a state.* across 4+ batches → confirmed mapping.
 *
 * Output: tmp/walmart/px_cookie/state_key_map.json
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SAMPLES = path.join(ROOT, 'sample');
const OUT = path.join(ROOT, 'px_cookie');

const N = 6;
const tally = {};   // state field -> { b64_key -> count }
const sampleStates = [];

for (let b = 1; b <= N; b++) {
    const resp1 = path.join(SAMPLES, String(b), 'decoded_response_1.json');
    const ev2 = path.join(SAMPLES, String(b), 'decoded_payload_2.json');
    if (!fs.existsSync(resp1) || !fs.existsSync(ev2)) {
        console.error(`batch ${b}: missing files`);
        continue;
    }
    const st = JSON.parse(fs.readFileSync(resp1, 'utf8')).state || {};
    const ev = JSON.parse(fs.readFileSync(ev2, 'utf8'))[0];
    const d = ev.d || {};
    sampleStates.push(st);

    // For each state field, try matching against EV2 values (string + int form)
    const candidates = {
        'state.no':      [st.no, st.no ? parseInt(st.no) : null],
        'state.to':      [st.to, st.to ? parseInt(st.to) : null],
        'state.appId':   [st.appId],
        'state.vid':     [st.vid],
        'state.pxsid':   [st.pxsid],
        'state.cts':     [st.cts],
        'state.qa':      [st.qa],
        'state.jf':      [st.jf],
        'state.ro':      [st.ro, st.ro ? String(st.ro) : null],
        'state.eo':      [st.eo],
    };

    for (const [name, vals] of Object.entries(candidates)) {
        const cleanVals = vals.filter(v => v !== null && v !== undefined && v !== '');
        if (cleanVals.length === 0) continue;
        for (const [k, v] of Object.entries(d)) {
            if (cleanVals.some(cv => cv === v || (typeof cv === typeof v && JSON.stringify(cv) === JSON.stringify(v)))) {
                tally[name] = tally[name] || {};
                tally[name][k] = (tally[name][k] || 0) + 1;
            }
        }
    }
}

console.log('\n══════════════════════════════════════════');
console.log('Cross-batch state.* → EV2 b64 key mapping');
console.log('══════════════════════════════════════════');
const map = {};
for (const name of Object.keys(tally).sort()) {
    const cands = tally[name];
    const best = Object.entries(cands).sort((a, b) => b[1] - a[1])[0];
    if (best[1] >= 4) {
        map[name] = best[0];
        console.log(`  ${name.padEnd(14)} → ${best[0]}  (${best[1]}/${N} batches)`);
    } else {
        console.log(`  ${name.padEnd(14)} → AMBIGUOUS  ${JSON.stringify(cands)}`);
    }
}
// Also report sample state across batches for transparency
console.log('\nSample state (batch 1):');
console.log(JSON.stringify(sampleStates[0], null, 2));

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'state_key_map.json'), JSON.stringify(map, null, 2));
console.log(`\nwrote ${path.join(OUT, 'state_key_map.json')}`);
