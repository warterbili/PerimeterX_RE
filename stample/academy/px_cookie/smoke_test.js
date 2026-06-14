/**
 * Academy _px3 generator — static self-check (no network).
 * Mirrors totalwine/smoke_test.js + the STRICT+ items unique to academy.
 * Run:  node smoke_test.js
 */
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const src = fs.readFileSync(path.join(HERE, 'academy_px3.js'), 'utf8');

let pass = 0, fail = 0;
function check(name, fn) {
    try { fn(); console.log(`  ✅ ${name}`); pass++; }
    catch (e) { console.log(`  ❌ ${name} — ${e.message}`); fail++; }
}
const tpl = n => JSON.parse(fs.readFileSync(path.join(HERE, n), 'utf8'));
const d2 = j => (Array.isArray(j) ? j[0].d : j.d || j);

console.log('Academy _px3 — static self-check\n');

// ── shared algorithm modules ───────────────────────────────
check('revers/ modules require', () => {
    for (const m of ['payload', 'pc', 'ob', 'sid', 'uuid', 'ns'])
        require(`../../../revers/${m}.js`);
});

// ── constants ──────────────────────────────────────────────
check("AppID = PXqqxM841a", () => { if (!/PXqqxM841a/.test(src)) throw new Error('missing'); });
check("TAG = dgYGCzBjH3pyBg==", () => { if (!/dgYGCzBjH3pyBg==/.test(src)) throw new Error('missing'); });
check("FT = 405", () => { if (!/FT\s*=\s*'?405'?/.test(src)) throw new Error('missing'); });
check("collector = collector-pxqqxm841a", () => { if (!/collector-pxqqxm841a\.px-cloud\.net/.test(src)) throw new Error('missing'); });

// ── templates: real-Chrome, not JSDOM ──────────────────────
check('EV2 template = 203 fields (real Chrome, not 177 JSDOM)', () => {
    const n = Object.keys(d2(tpl('academy_ev2_template.json'))).length;
    if (n < 200) throw new Error(`only ${n} fields — looks like a JSDOM/bridge template`);
});
check('rotation pool = 6 real EV2 fingerprints', () => {
    const have = [1, 2, 3, 4, 5, 6].filter(b => fs.existsSync(path.join(HERE, `academy_ev2_template_${b}.json`)));
    if (have.length < 6) throw new Error(`only ${have.length}/6 present`);
});

// ── STRICT+ item 1: counter never emits illegal (0,N) ──────
check('counter CTR_PAT valid — no illegal (PX12739=0, PX12740=N)', () => {
    if (!/CTR_PAT/.test(src)) throw new Error('CTR_PAT missing — counter not pattern-aware');
    // every mapped pattern must NOT be [0,1]
    const m = src.match(/CTR_PAT\s*=\s*\(\{([^}]+)\}/);
    if (!m) throw new Error('CTR_PAT table not found');
    const pats = [...m[1].matchAll(/\[(\d),\s*(\d)\]/g)].map(x => [+x[1], +x[2]]);
    for (const [a, b] of pats)
        if (a === 0 && b === 1) throw new Error('an illegal (0,N) pattern is present');
    if (!/PX12740:\s*CTR_PAT\[1\]\s*\?\s*n\s*:\s*0/.test(src)) throw new Error('PX12740 not driven by CTR_PAT');
});

// ── STRICT+ item 2: /ns through the Chrome-TLS session ─────
check('/ns fetched via Chrome session (USE_SESSION sidecar), not node https', () => {
    if (!/fetchNsVia/.test(src) || !/USE_SESSION/.test(src)) throw new Error('no session /ns path');
});

// ── STRICT+ item 3: perf = since-navigation clock ──────────
check('perf AzNzeUVTcks= uses navOffset (since-nav), not now-initTime', () => {
    if (!/navOffset/.test(src)) throw new Error('navOffset missing — EV1 perf would be ~10ms not ~5000ms');
});

// ── STRICT+ item 4: /ns duration is a float ────────────────
check('/ns duration ZjYWPCNWFws= is a float (644-706)', () => {
    if (!/644\s*\+\s*Math\.random\(\)\s*\*\s*62/.test(src)) throw new Error('duration not the float range');
});

// ── EV3 strict beacon present ──────────────────────────────
check('EV3 (seq=2) beacon built + posted', () => {
    if (!/buildEv3/.test(src) || !/seq=2/.test(src)) throw new Error('no EV3 beacon');
});

// ── anti-tamper formula ────────────────────────────────────
check('anti-tamper te(state.to, no%10±) present', () => {
    if (!/function te\(/.test(src) || !/state\.to/.test(src)) throw new Error('anti-tamper missing');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
