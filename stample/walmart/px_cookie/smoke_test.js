/**
 * Walmart _px3 generator — static self-check (no network).
 * Mirrors academy/totalwine smoke_test.js, adapted to walmart's LENIENT tier
 * + the cross-event-consistency refinements from the updated skill.
 * Run:  node smoke_test.js
 *
 * SCOPE: PX layer only. Walmart's primary gate is Akamai Bot Manager — out of
 * this skill's scope. A _px3 alone does NOT pass Walmart business APIs.
 */
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const src = fs.readFileSync(path.join(HERE, 'walmart_px3.js'), 'utf8');

let pass = 0, fail = 0;
function check(name, fn) {
    try { fn(); console.log(`  ✅ ${name}`); pass++; }
    catch (e) { console.log(`  ❌ ${name} — ${e.message}`); fail++; }
}
const tpl = n => JSON.parse(fs.readFileSync(path.join(HERE, n), 'utf8'));
const d2 = j => (Array.isArray(j) ? j[0].d : j.d || j);

console.log('Walmart _px3 — static self-check\n');

// ── shared algorithm modules ───────────────────────────────
check('revers/ modules require', () => {
    for (const m of ['payload', 'pc', 'ob', 'sid', 'uuid'])
        require(`../../../revers/${m}.js`);
});

// ── constants (live tag/ft/bi rotate; AppID stable) ────────
check('AppID = PXu6b0qd2S', () => { if (!/PXu6b0qd2S/.test(src)) throw new Error('missing'); });
check('TAG fallback = eW5CaD8AUB99Zg==', () => { if (!/eW5CaD8AUB99Zg==/.test(src)) throw new Error('missing'); });
check("FT = 396", () => { if (!/FT:\s*'?396'?/.test(src)) throw new Error('missing'); });
check('collector = collector-pxu6b0qd2s.px-cloud.net', () => { if (!/collector-pxu6b0qd2s\.px-cloud\.net/.test(src)) throw new Error('missing'); });
check('first-party SDK = walmart.com/px/.../init.js', () => { if (!/www\.walmart\.com\/px\/PXu6b0qd2S\/init\.js/.test(src)) throw new Error('missing'); });

// ── templates ──────────────────────────────────────────────
check('EV1 template = 12 fields', () => {
    const n = Object.keys(d2(tpl('walmart_ev1_template.json'))).length;
    if (n !== 12) throw new Error(`got ${n} fields, expected 12`);
});
check('EV2 template = 207 fields', () => {
    const n = Object.keys(d2(tpl('walmart_ev2_template.json'))).length;
    if (n !== 207) throw new Error(`got ${n} fields, expected 207`);
});

// ── Gotcha #1: state.no parseInt'd into EV2 ────────────────
check('state.no parseInt (Gotcha #1)', () => {
    if (!/parseInt\(s\.state\.no\)/.test(src)) throw new Error('state.no not parseInt');
});

// ── cross-event invariants (cross_event_consistency.py, 6/6) ─
check('ajERMCxcFQc= CONSTANT across EV1/EV2 (single t0)', () => {
    // both buildEv1 and buildEv2 must set this key from s.t0
    const ev1 = /ajERMCxcFQc='\]\s*=\s*s\.t0/.test(src);
    const occurrences = (src.match(/ajERMCxcFQc='\]\s*=\s*s\.t0/g) || []).length;
    if (!ev1 || occurrences < 2) throw new Error('ajER not bound to a single t0 in both events');
});
check('Ahk5WERyM2o= MONOTONIC (EV2 = EV1 perf + delta)', () => {
    if (!/e2perf\s*=\s*e1perf\s*\+/.test(src)) throw new Error('EV2 perf not derived as EV1 + delta');
});
check('U0goSRYkLHs= MONOTONIC (e2now = t0 + ~2s > e1now)', () => {
    if (!/e2now\s*=\s*t0\s*\+\s*1900/.test(src)) throw new Error('e2now not t0+~2s');
});

// ── opaque token shape (real standard-base64, len 500-512) ──
check('AEc7BkUsMTA= token = standard base64, len 500-512', () => {
    if (!/randomBytes\(375\s*\+\s*3\s*\*/.test(src)) throw new Error('token length not 500-512');
    if (/base64url|\[\+\/=\]/.test(src.split("AEc7")[1].split('\n')[0] || '')) throw new Error('token should be standard base64, not url-safe');
});

// ── anti-tamper relocation keeps template iteration order ──
check('anti-tamper relocated in-place (Gotcha #3)', () => {
    if (!/relocateAntiTamper/.test(src) || !/function te\(/.test(src)) throw new Error('anti-tamper relocate missing');
});

// ── scope guard ────────────────────────────────────────────
check('scope note: Akamai out of scope', () => {
    if (!/Akamai/i.test(src)) throw new Error('missing Akamai scope note');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
