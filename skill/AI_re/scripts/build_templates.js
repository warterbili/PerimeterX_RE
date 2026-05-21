#!/usr/bin/env node
/**
 * Build EV1 / EV2 templates from fresh-capture batches.
 *
 *  For each site (ifood, grubhub):
 *    - Read samples/<site>/{1..N}/decoded_payload_{1,2}.json
 *    - Run diff → STATIC / DYNAMIC / CONDITIONAL classification
 *    - Pick batch 1 as base template
 *    - Annotate every field with its category in the output JSON
 *    - Save:
 *        templates/<site>_ev1_template.json    (annotated, ready-to-use)
 *        templates/<site>_ev2_template.json
 *        templates/<site>_ev1_field_map.json   (key → {category, sample_values})
 *        templates/<site>_ev2_field_map.json
 *
 *  Output JSON includes both the values (ready for deep-clone) AND a
 *  `_fields` map describing each key — useful as living documentation.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SAMPLES = path.join(ROOT, 'samples');
const TEMPLATES = path.join(ROOT, 'templates');

const ANTI_TAMPER_RE = /^[0-9:;<=>?@]{15,25}$/;

function classify(values) {
    const uniq = new Set(values.map(v => JSON.stringify(v)));
    return uniq.size === 1 ? 'STATIC'
         : uniq.size === values.length ? 'DYNAMIC'
         : 'PARTIAL';
}
function classifyKey(key, vals) {
    if (vals.every(v => v === undefined)) return 'CONDITIONAL';
    return classify(vals);
}

function buildOneTable(site, evNum) {
    const batches = [];
    for (let i = 1; i <= 16; i++) {
        const p = path.join(SAMPLES, site, String(i), `decoded_payload_${evNum}.json`);
        if (fs.existsSync(p)) batches.push(JSON.parse(fs.readFileSync(p, 'utf8'))[0]);
    }
    if (batches.length < 2) {
        console.error(`[${site}] EV${evNum}: only ${batches.length} batches; skipping`);
        return;
    }
    const eventType = batches[0].t;
    const allKeys = new Set();
    batches.forEach(b => Object.keys(b.d).forEach(k => allKeys.add(k)));

    // Detect anti-tamper as a slot (keys all match AT_RE, each batch has a unique key)
    const atKeys = [...allKeys].filter(k => ANTI_TAMPER_RE.test(k) && batches.some(b => k in b.d));
    const atIsSlot = atKeys.length >= Math.floor(batches.length * 0.5);

    const fields = {};
    for (const k of allKeys) {
        if (atIsSlot && atKeys.includes(k)) continue;   // handled separately
        const vals = batches.map(b => b.d[k]);
        const presence = vals.map(v => v !== undefined);
        const presentAll = presence.every(p => p);
        const category = presentAll ? classify(vals) : 'CONDITIONAL';
        fields[k] = {
            category,
            sample: presentAll ? vals[0] : (vals.find(v => v !== undefined) ?? null),
            unique_values: new Set(vals.filter(v => v !== undefined).map(v => JSON.stringify(v))).size,
            present_in: presence.map((p,i) => p ? (i+1) : null).filter(x => x !== null),
        };
    }

    // Build the actual template (use batch 1's values exactly)
    const tplD = { ...batches[0].d };
    // Strip the anti-tamper slot from the template's d (callers must inject fresh)
    if (atIsSlot) {
        for (const k of atKeys) {
            if (k in tplD) delete tplD[k];
        }
    }

    const template = [{ t: eventType, d: tplD }];

    // Field map — pretty-printed
    const orderedFields = Object.fromEntries(Object.entries(fields).sort((a,b) => {
        const order = { STATIC: 0, DYNAMIC: 1, CONDITIONAL: 2, PARTIAL: 3 };
        return (order[a[1].category] ?? 9) - (order[b[1].category] ?? 9);
    }));

    const fieldMap = {
        site,
        ev: `EV${evNum}`,
        event_type_b64: eventType,
        sample_batches: batches.length,
        total_keys: allKeys.size,
        anti_tamper: {
            is_slot: atIsSlot,
            distinct_keys_observed_across_batches: atKeys.length,
            example_keys: atKeys.slice(0, 3),
            example_values: atKeys.slice(0, 3).map(k => batches.find(b => b.d[k] !== undefined)?.d[k]),
            note: 'Anti-tamper key/value are generated per-session as te(state.to, state.no%10±). '
                + 'They must be re-derived in the generator and inserted at the same template position.',
        },
        counts: Object.fromEntries(
            ['STATIC','DYNAMIC','CONDITIONAL','PARTIAL'].map(c => [c, Object.values(fields).filter(f => f.category === c).length])
        ),
        fields: orderedFields,
    };

    fs.writeFileSync(path.join(TEMPLATES, `${site}_ev${evNum}_template.json`), JSON.stringify(template, null, 2));
    fs.writeFileSync(path.join(TEMPLATES, `${site}_ev${evNum}_field_map.json`), JSON.stringify(fieldMap, null, 2));

    console.error(`[${site}] EV${evNum}: total=${allKeys.size}  ${JSON.stringify(fieldMap.counts)}  AT-slot=${atIsSlot}`);
}

if (!fs.existsSync(TEMPLATES)) fs.mkdirSync(TEMPLATES, { recursive: true });

for (const site of ['ifood', 'grubhub']) {
    for (const ev of [1, 2]) buildOneTable(site, ev);
}
