/**
 * Walmart _px3 generator — PX layer only (pure math, no browser).
 *
 * ⚠️ SCOPE: Walmart is Akamai (primary) + PerimeterX (secondary). This script
 * reverses ONLY the PerimeterX collector chain and produces a valid `_px3`
 * accepted by the PX collector (200 + cookie issued). It does NOT defeat
 * Akamai Bot Manager (`_abck`/`bm_sv` sensor), so a PX cookie alone will NOT
 * pass Walmart's business APIs. Out of this skill's scope by design.
 *
 * Deployment tier: LENIENT (third-party collector *.px-cloud.net, 2 POSTs,
 * seq=0 + seq=1, no EV3 beacon, no PX12xxx counter dict).
 *
 * Constants (live 2026-05-31 — tag/ft/bi rotate, fetched at runtime):
 *   AppID:  PXu6b0qd2S  (stable)
 *   TAG:    eW5CaD8AUB99Zg==   (rotates)  → OB key ml(tag)%128 = 41
 *   FT:     396                (rotates)
 *   Cookie: _px3
 *   Collector: https://collector-pxu6b0qd2s.px-cloud.net/api/v2/collector
 *   SDK:       https://www.walmart.com/px/PXu6b0qd2S/init.js
 *
 * Verified 6/6 against fresh batches:
 *   state.no→HwRkBVluazY= (parseInt), state.to→UBdrVhZ+Z2U=,
 *   state.eo→EFcrFlU9JSQ=, state.appId→LDNXMmlcWgg=
 *   HMAC(uuid,UA)→OkFBAHwnTTY=, HMAC(vid,UA)→GmEhYFwIKVQ=,
 *   HMAC(pxsid,UA)→MklJCHQkQjs=, MD5(vid)→CzBwcU5bfEI=
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const generatePayload = require('../../../revers/payload');
const { decodeOb } = require('../../../revers/ob');
const generatePC = require('../../../revers/pc');
const generateSid = require('../../../revers/sid');
const { getUUID } = require('../../../revers/uuid');

const APP_ID = 'PXu6b0qd2S';
const SDK_URL = 'https://www.walmart.com/px/PXu6b0qd2S/init.js';
const COLLECTOR_URL = 'https://collector-pxu6b0qd2s.px-cloud.net/api/v2/collector';
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';
const FALLBACK = { TAG: 'eW5CaD8AUB99Zg==', FT: '396',
    BI: 'Rl19VhNhNHcAAhNzXwpPdUd/YRFXUzxySkpqG30bP15FeTFvAhU+bCgNAS1HeHgPRWw5aG5eMDUvCSYfUjUkeFtLcC1TCUB7VXwwDgNIaX9KQjR+eRswXEgmMGtNBHo=' };

const TEMPLATES = __dirname;
const EV1_TEMPLATE = JSON.parse(fs.readFileSync(path.join(TEMPLATES, 'walmart_ev1_template.json'), 'utf8'));
const EV2_TEMPLATE = JSON.parse(fs.readFileSync(path.join(TEMPLATES, 'walmart_ev2_template.json'), 'utf8'));

const AT_RE = /^[0-9:;<=>?@]{15,30}$/;
const AT_CHARS = '0123456789:;<=>?';   // 0x30-0x3f (avoid 0x40 '@' to keep XOR-1 in range)

function te(t, e) {
    let r = '';
    for (let i = 0; i < t.length; i++) r += String.fromCharCode(t.charCodeAt(i) ^ e);
    return r;
}
function hmacMD5(data, key) { return crypto.createHmac('md5', key).update(data).digest('hex'); }

function fetchSdkConstants(ua) {
    return new Promise((resolve) => {
        const req = https.get(SDK_URL, { headers: { 'User-Agent': ua, 'Accept': '*/*', 'Referer': 'https://www.walmart.com/' } }, (res) => {
            let b = '';
            res.on('data', c => b += c);
            res.on('end', () => {
                const m = b.match(/="([A-Za-z0-9+/]{8,28}={0,2})",[A-Za-z$_]{1,4}="(\d{3})",[A-Za-z$_]{1,4}="PXu6b0qd2S",[A-Za-z$_]{1,4}="([^"]+)"/);
                if (m) resolve({ TAG: m[1], FT: m[2], BI: m[3] });
                else resolve({ ...FALLBACK, _fallback: true });
            });
        });
        req.on('error', () => resolve({ ...FALLBACK, _fallback: true }));
        req.setTimeout(10000, () => { req.destroy(); resolve({ ...FALLBACK, _fallback: true }); });
    });
}

// ── EV1 — 12 fields, 4 DYNAMIC ──
// Cross-event invariants (cross_event_consistency.py, 6/6 — see references):
//   ajERMCxcFQc=  CONSTANT  — page-load epoch, MUST equal EV2's value
//   HUJmQ1soY3c=  CONSTANT  — uuid, MUST equal EV2's value
//   Ahk5WERyM2o=  MONOTONIC — EV2 value MUST be ≥ this one
//   U0goSRYkLHs=  MONOTONIC — wall-clock "now", EV2 ≥ this one
function buildEv1(s) {
    const e = JSON.parse(JSON.stringify(EV1_TEMPLATE));
    if (e[0]._meta) delete e[0]._meta;
    const d = e[0].d;
    d['Ahk5WERyM2o='] = s.e1perf;   // ~1.7-2.5k (real 1761-2194)
    d['ajERMCxcFQc='] = s.t0;       // page-load epoch (== EV2, CONSTANT)
    d['U0goSRYkLHs='] = s.e1now;    // t0 + ~17ms
    d['HUJmQ1soY3c='] = s.uuid;     // session uuid (== EV2, CONSTANT)
    return e;
}

// ── EV2 — 207 fields, ~20 DYNAMIC ──
function buildEv2(s) {
    const e = JSON.parse(JSON.stringify(EV2_TEMPLATE));
    if (e[0]._meta) delete e[0]._meta;
    const tpl = e[0].d;

    // state.* (Gotcha #1 — parseInt state.no)
    tpl['HwRkBVluazY='] = parseInt(s.state.no);
    tpl['UBdrVhZ+Z2U='] = s.state.to;
    if (s.state.eo) tpl['EFcrFlU9JSQ='] = s.state.eo;
    tpl['LDNXMmlcWgg='] = s.state.appId;

    // identity + timestamps — all derived from the single session epoch s.t0
    // so cross-event invariants hold (CONSTANT ajER/uuid, MONOTONIC Ahk5/U0go).
    tpl['HUJmQ1soY3c='] = s.uuid;                       // == EV1 (CONSTANT)
    tpl['X0QkRRkiLHc='] = new Date(s.t0).toString();    // page-load date string
    tpl['ajERMCxcFQc='] = s.t0;                         // == EV1 (CONSTANT)
    tpl['TlV1FAg4eiQ='] = s.e2tl;                        // t0 + ~600-850ms
    tpl['U0goSRYkLHs='] = s.e2now;                       // t0 + ~2s (> EV1)
    tpl['Ahk5WERyM2o='] = s.e2perf;                      // > EV1 (MONOTONIC)
    tpl['cHcLdjUdAkA='] = s.e2c;                         // 100-8000 (real 103-8033)

    // perf memory-ish
    tpl['ajERMCxaHws='] = 2_000_000 + Math.floor(Math.random() * 5_000_000);
    tpl['WG9jbh4JbF8='] = 4_000_000 + Math.floor(Math.random() * 6_000_000);
    tpl['SlFxEA86eyc='] = 620 + Math.random() * 45;      // EV1=0 baked, EV2 ≈640 (MONOTONIC)

    // HMAC-MD5 / MD5 — verified 6/6
    tpl['OkFBAHwnTTY='] = hmacMD5(s.uuid, s.ua);          // HMAC(uuid, UA)
    tpl['GmEhYFwIKVQ='] = hmacMD5(s.state.vid, s.ua);     // HMAC(vid, UA)
    tpl['MklJCHQkQjs='] = hmacMD5(s.state.pxsid, s.ua);   // HMAC(pxsid, UA)
    tpl['CzBwcU5bfEI='] = crypto.createHash('md5').update(s.state.vid).digest('hex'); // md5(vid)

    // long opaque token (hid/sd-like) — standard base64, real len 500-512 (6/6)
    tpl['AEc7BkUsMTA='] = crypto.randomBytes(375 + 3 * Math.floor(Math.random() * 4)).toString('base64');

    // Anti-tamper: val is a per-session 20-char string in [0x30-0x3f]; key = te(val,1).
    // (No derivable relation to wire-state on this lenient deployment.)
    e[0].d = relocateAntiTamper(tpl);
    return e;
}

function relocateAntiTamper(d) {
    // find the AT slot in the template (key & value both AT-shaped)
    let len = 20;
    for (const k of Object.keys(d)) {
        if (AT_RE.test(k) && AT_RE.test(String(d[k]))) { len = k.length; break; }
    }
    let val = '';
    for (let i = 0; i < len; i++) val += AT_CHARS[Math.floor(Math.random() * AT_CHARS.length)];
    const key = te(val, 1);
    const out = {};
    for (const k of Object.keys(d)) {
        if (AT_RE.test(k) && AT_RE.test(String(d[k]))) out[key] = val;
        else out[k] = d[k];
    }
    return out;
}

function post(url, body, ua) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const req = https.request({
            method: 'POST', hostname: u.hostname, path: u.pathname + u.search,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': ua,
                'Accept': '*/*', 'Origin': 'https://www.walmart.com', 'Referer': 'https://www.walmart.com/',
            },
        }, (res) => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
        });
        req.on('error', reject);
        req.write(body); req.end();
    });
}
function formEncode(obj) {
    return Object.entries(obj).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v).replace(/%20/g, '+')).join('&');
}
function findCookie(segments) {
    for (const seg of segments) {
        const args = seg.split('|').slice(1);
        if (args.length >= 4 && /^_?px/i.test(args[0]))
            return { name: args[0], ttl: parseInt(args[1]), value: args[2] };
    }
    return null;
}
function extractState(segments) {
    const state = {};
    for (const seg of segments) {
        const args = seg.split('|').slice(1);
        if (args.length === 1 && /^1[5-9]\d{11}$/.test(args[0])) state.no = args[0];
        else if (args.length === 1 && /^[0-9a-f]{64}$/.test(args[0])) state.qa = args[0];
        else if (args.length === 1 && /^[a-f0-9-]{36}$/.test(args[0])) state.pxsid = args[0];
        else if (args.length === 2 && /^\d{16,}$/.test(args[0]) && /^\d{16,}$/.test(args[1])) { state.to = args[0]; state.eo = args[1]; }
        else if (args.length === 1 && /^\d{16,}$/.test(args[0])) state.to = args[0];
        else if (args.length === 1 && /^[a-z0-9]{12,30}$/.test(args[0])) state.appId = args[0];
        else if (args.length === 1 && /^[a-z]{2,4}$/.test(args[0])) state.jf = args[0];
        else if (args.length === 2 && /^[a-f0-9-]{36}$/.test(args[0])) state.cts = args[0];
        else if (args.length === 3 && /^[a-f0-9-]{36}$/.test(args[0])) state.vid = args[0];
    }
    return state;
}

async function generatePx3() {
    const ua = DEFAULT_UA;
    const uuid = getUUID();
    const C = await fetchSdkConstants(ua);
    const TAG = C.TAG, FT = C.FT, BI = C.BI;

    // ── session timing (single page-load epoch t0 → cross-event coherence) ──
    const t0 = Date.now();                                  // page-load epoch (CONSTANT field)
    const e1perf = 1700 + Math.floor(Math.random() * 800);  // Ahk5 EV1 (real 1761-2194)
    const sess = {
        uuid, ua, t0,
        e1now: t0 + 15 + Math.floor(Math.random() * 8),     // U0go EV1 (t0 + ~17ms)
        e1perf,
    };

    // ── collector#1 (seq=0) ──
    const ev1 = buildEv1(sess);
    const payload1 = generatePayload(ev1, null, uuid);
    const pc1 = generatePC(ev1, uuid, TAG, FT);
    const body1 = formEncode({ payload: payload1, appId: APP_ID, tag: TAG, uuid, ft: FT, seq: 0, en: 'NTA', bi: BI, pc: pc1, rsc: 1 });
    const r1 = await post(COLLECTOR_URL + '?seq=0&rsc=1', body1, ua);
    if (r1.status !== 200) throw new Error(`collector#1 HTTP ${r1.status}: ${r1.body.slice(0,200)}`);
    const ob1 = decodeOb(r1.body, TAG);
    const state = extractState(ob1.segments);
    let cookie = findCookie(ob1.segments);
    if (!state.no || !state.appId || !state.to) throw new Error('ob#1 missing state: ' + JSON.stringify(state));

    // ── collector#2 (seq=1) — EV2 timing derived from the same t0 ──
    sess.state = state;
    sess.e2now = t0 + 1900 + Math.floor(Math.random() * 400);   // U0go EV2 (~2s after t0, > EV1)
    sess.e2tl = t0 + 600 + Math.floor(Math.random() * 250);     // TlV1 EV2 (t0 + ~600-850ms)
    sess.e2perf = e1perf + 500 + Math.floor(Math.random() * 400); // Ahk5 EV2 (> EV1, MONOTONIC)
    sess.e2c = 100 + Math.floor(Math.random() * 7900);          // cHcL EV2 (real 103-8033)
    const ev2 = buildEv2(sess);
    if (process.env.PX_DUMP) {
        fs.writeFileSync(path.join(process.env.PX_DUMP, 'mine_ev1.json'), JSON.stringify(ev1, null, 2));
        fs.writeFileSync(path.join(process.env.PX_DUMP, 'mine_ev2.json'), JSON.stringify(ev2, null, 2));
    }
    const payload2 = generatePayload(ev2, state.no, uuid);
    const pc2 = generatePC(ev2, uuid, TAG, FT);
    const sid = generateSid(state.pxsid || uuid, state.no);
    const body2 = formEncode({
        payload: payload2, appId: APP_ID, tag: TAG, uuid, ft: FT, seq: 1, en: 'NTA', bi: BI,
        cs: state.qa || '', pc: pc2, sid, vid: state.vid || '', cts: state.cts || '', rsc: 2,
    });
    const r2 = await post(COLLECTOR_URL + '?seq=1&rsc=2', body2, ua);
    if (r2.status !== 200) throw new Error(`collector#2 HTTP ${r2.status}: ${r2.body.slice(0,200)}`);
    const ob2 = decodeOb(r2.body, TAG);
    cookie = findCookie(ob2.segments) || cookie;

    if (!cookie) return { error: 'no _px3 issued', ob1_segs: ob1.segments.length, ob2_segs: ob2.segments.length, state, constants: C };
    return {
        cookie_name: cookie.name, cookie_value: cookie.value, ttl: cookie.ttl,
        uuid, tag: TAG, ft: FT, constants_live: !C._fallback,
        ev1_fields: Object.keys(ev1[0].d).length, ev2_fields: Object.keys(ev2[0].d).length,
        ob1_segs: ob1.segments.length, ob2_segs: ob2.segments.length,
        state_keys: Object.keys(state),
    };
}

if (require.main === module) {
    (async () => {
        try {
            const r = await generatePx3();
            console.log(JSON.stringify(r, (k, v) => k === 'cookie_value' && typeof v === 'string' ? v.slice(0, 60) + '...' : v, 2));
            if (r.cookie_name) console.log(`\n✅ ${r.cookie_name}=${r.cookie_value.slice(0,40)}…  ttl=${r.ttl}`);
            else console.log('\n❌', r.error || 'unknown');
        } catch (e) { console.error('❌', e.message); process.exit(1); }
    })();
}
module.exports = generatePx3;
