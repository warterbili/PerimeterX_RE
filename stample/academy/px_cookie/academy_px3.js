/**
 * academy.com _px3 generator — v2, locked to CURRENT SDK (2026-06-12 19:xx).
 *
 * REBUILT strictly per master-workflow on a single locked SDK version.
 *   SDK sha (normalized LF): 50debea8…   TAG: dgYGCzBjH3pyBg==   FT: 405   Cookie: _px3
 *   Collector: https://collector-pxqqxm841a.px-cloud.net/api/v2/collector
 *
 * ⚠️ academy ROTATES its SDK obfuscation periodically — TAG and every EV b64 field
 *    key change per version. This generator is locked to the version captured in
 *    the 6 batches under sample/. When academy ships a new SDK, re-run Stages 3-6 and rebuild.
 *
 * All keys/constants derived from sample/ (6 batches, one SDK):
 *   state.no→RBB0WgJxcGk= (parseInt)  state.to→ViZmLBBEYR8=  state.appId→a1tbUS4/XWs=
 *   state.echo→Slp6EA87eCY= (parseInt, ob1 nonce)
 *   HMAC(uuid,UA)→NABESnJtQ3w=  HMAC(vid,UA)→cgICSDRgAXw=  HMAC(pxsid,UA)→Xi5uJBhIbhc=
 *   MD5(vid)→QAxwRgVsd3U=
 * Cross-event (cross_event_consistency.py on v2):
 *   CONSTANT  page-load ts KDRYPm5SVwk= (same EV1/EV2/EV3), uuid ZRFVGyNwWy8=
 *   MONOTONIC perf AzNzeUVTcks=, current-ts InJSeGcVXUo=, performance.now ZjYWPCNWFws= (0→650→650)
 *   counter AEwwBkUuMjQ=: PX12738 monotonic, PX12739=PX12740=0
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
const fetchNs = require('../../../revers/ns');

// ═══ constants (v2 locked SDK) ═══
const APP_ID = 'PXqqxM841a';
const TAG    = 'dgYGCzBjH3pyBg==';
const FT     = '405';
const COLLECTOR_URL = 'https://collector-pxqqxm841a.px-cloud.net/api/v2/collector';
const NS_HOST = 'https://ift.px-cloud.net';
const BI = 'PSkNKWgeTwh7fWgMJHU0CjwAGm4sLEcPMTQbZAZpRCE6Bk8ReWFOHFNyelI8BwNwPhNCFxUhS0pUcwxjKE5ZAiI0XQYtczsEKQEecSM5FgoxNB8IBDQcKjIPGBduewE=';
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';
const FP_HASH = '45e8c64e47f06b474456b246b2f31d9e';   // STU5fwxTOE8= fingerprint (baked)

const TEMPLATES = __dirname;
// Rotate among the 6 real-Chrome captures so each mint presents a DIFFERENT genuine browser
// fingerprint. Strict tier correlates many cookies minted under ONE identical fingerprint and
// scores them down as bot; real browsers each carry a unique live fingerprint. Falls back to
// the single academy_ev*_template.json when the per-batch pool isn't present.
const _pool = [1, 2, 3, 4, 5, 6].filter(b => fs.existsSync(path.join(TEMPLATES, `academy_ev2_template_${b}.json`)));
const _pick = _pool.length ? _pool[Math.floor(Math.random() * _pool.length)] : 0;
function _tpl(name) {
    const rot = path.join(TEMPLATES, `academy_${name}_template_${_pick}.json`);
    const base = path.join(TEMPLATES, `academy_${name}_template.json`);
    return JSON.parse(fs.readFileSync(_pick && fs.existsSync(rot) ? rot : base, 'utf8'));
}
const EV1_TEMPLATE = _tpl('ev1');
const EV2_TEMPLATE = _tpl('ev2');
const EV3_TEMPLATE = _tpl('ev3');

const AT_RE = /^[0-9:;<=>?@]{15,25}$/;
const rint = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo));
const randHex = n => crypto.randomBytes(n).toString('hex').slice(0, n);
const randB64 = n => crypto.randomBytes(n).toString('base64');
const md5 = s => crypto.createHash('md5').update(s).digest('hex');
const hmacMD5 = (d, k) => crypto.createHmac('md5', k).update(d).digest('hex');
const randDigits = n => { let s = ''; for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10); return s; };

// counter AEwwBkUuMjQ=: PX12738 = monotonic event count. PX12739/PX12740 are EITHER 0 or
// ==PX12738 — never independent — and real browsers only ever emit one of THREE patterns:
//   (0,0)=b1,b2   (N,N)=b3   (N,0)=b4,b5,b6.   (0,N) NEVER occurs -> strict tier flags it.
// Match the pattern to the rotated template's own batch so the counter is coherent with the
// fingerprint we're replaying; default to the majority (N,0) when not rotating.
const CTR_PAT = ({ 1: [0, 0], 2: [0, 0], 3: [1, 1], 4: [1, 0], 5: [1, 0], 6: [1, 0] }[_pick]) || [1, 0];
const counter = n => ({ PX12738: n, PX12739: CTR_PAT[0] ? n : 0, PX12740: CTR_PAT[1] ? n : 0, PX12741: -1 });

// ═══ EV1 ═══
function buildEv1(ctx) {
    const e = JSON.parse(JSON.stringify(EV1_TEMPLATE));
    if (e[0]._meta) delete e[0]._meta;
    const d = e[0].d;
    d['AzNzeUVTcks=']  = Math.round(ctx.perf);   // = Math.round(performance.now())
    d['KDRYPm5SVwk=']  = ctx.initTime;        // page-load ts (CONSTANT across events)
    d['InJSeGcVXUo=']  = ctx.sendTime;        // current ts (monotonic)
    d['ZRFVGyNwWy8=']  = ctx.uuid;            // uuid (CONSTANT)
    d['NSEFa3NNAls=']  = ctx.smallCtr;        // small monotonic counter (0,1,4…)
    d['AEwwBkUuMjQ=']  = counter(ctx.counterN);
    // /ns: EV1 (seq=0) fires BEFORE /ns completes → cold values, exactly like ifood buildEv1
    //   (d['BzdyfUJXdks=']=null; d['DFg5Ekk4PSU=']=0). sm=null, duration=0.
    if ('MV0BV3Q9AGE=' in d) d['MV0BV3Q9AGE='] = null;   // /ns sm  → null in EV1
    if ('ZjYWPCNWFws=' in d) d['ZjYWPCNWFws='] = 0;      // /ns duration → 0 in EV1
    return e;
}

// ═══ EV2 ═══
function buildEv2(ctx) {
    const e = JSON.parse(JSON.stringify(EV2_TEMPLATE));
    if (e[0]._meta) delete e[0]._meta;
    const tpl = e[0].d;

    // state injection
    tpl['RBB0WgJxcGk=']  = parseInt(ctx.state.no);     // ⭐ number
    tpl['ViZmLBBEYR8=']  = ctx.state.to;
    tpl['a1tbUS4/XWs=']  = ctx.state.appId;
    tpl['Slp6EA87eCY=']  = parseInt(ctx.state.echo);   // ⭐ server-echoed nonce

    // identity + cross-event clock
    tpl['ZRFVGyNwWy8=']  = ctx.uuid;
    tpl['KnpacGwXWUI=']  = new Date(ctx.sendTime).toString();   // Date.toString
    tpl['KDRYPm5SVwk=']  = ctx.initTime;               // page-load ts (CONSTANT = EV1)
    tpl['InJSeGcVXUo=']  = ctx.sendTime;               // current ts (monotonic)
    tpl['JnZWfGAQUkw=']  = ctx.sendTime;  // exact, no random offset
    tpl['AzNzeUVTcks=']  = Math.round(ctx.perf);       // = Math.round(performance.now()) [SDK: ps()]
    tpl['ZjYWPCNWFws=']  = ctx.ns ? ctx.ns.duration : 0;  // = /ns fetch duration [SDK: ES()=EP]

    // HMAC / MD5 (formulas verified on v2)
    tpl['NABESnJtQ3w=']  = hmacMD5(ctx.uuid, ctx.ua);
    tpl['cgICSDRgAXw=']  = hmacMD5(ctx.state.vid, ctx.ua);
    tpl['Xi5uJBhIbhc=']  = hmacMD5(ctx.state.pxsid, ctx.ua);
    tpl['QAxwRgVsd3U=']  = md5(ctx.state.vid);
    tpl['STU5fwxTOE8=']  = FP_HASH;
    tpl['aRVZHyx1WS4=']  = randHex(8);                 // hex8 nonce
    tpl['NABESnFjQns=']  = '' + rint(1, 9) + randDigits(24);  // 25-digit entropy
    tpl['MV0BV3Q9AGE=']  = (ctx.ns && ctx.ns.sm) || randB64(96);  // = /ns response token [SDK: ER()=EO]

    // memory (used < total, tight gap — only if template has the keys)
    if ('GUVpT18lbHQ=' in tpl) {
        const used = rint(22_000_000, 33_000_000);
        tpl['GUVpT18lbHQ=']  = used;
        tpl['QS0xZwdANVY=']  = used + rint(2_000_000, 13_000_000);
    }

    tpl['AEwwBkUuMjQ=']  = counter(ctx.counterN);

    e[0].d = relocateAntiTamper(tpl, ctx.state);
    return e;
}

// ═══ EV3 (seq=2 confirmation beacon) ═══
function buildEv3(ctx) {
    const e = JSON.parse(JSON.stringify(EV3_TEMPLATE));
    if (e[0]._meta) delete e[0]._meta;
    const tpl = e[0].d;
    tpl['AzNzeUVTcks=']  = Math.round(ctx.perf);
    tpl['InJSeGcVXUo=']  = ctx.sendTime;
    tpl['ZRFVGyNwWy8=']  = ctx.uuid;
    tpl['MV0BV3Q9AGE=']  = (ctx.ns && ctx.ns.sm) || randB64(96);   // /ns token
    tpl['ZjYWPCNWFws=']  = ctx.ns ? ctx.ns.duration : 0;           // /ns duration
    tpl['MkJCCHcgRTk=']  = ctx.cookieValue;            // ⭐ cookie-confirmation
    tpl['NSEFa3NNAls=']  = ctx.smallCtr;
    tpl['AEwwBkUuMjQ=']  = counter(ctx.counterN);
    return e;
}

function te(t, x) { let r = ''; for (let i = 0; i < t.length; i++) r += String.fromCharCode(t.charCodeAt(i) ^ x); return r; }
function relocateAntiTamper(d, state) {
    const stateNo = parseInt(state.no);
    const atKey = te(state.to, stateNo % 10 + 2);
    const atVal = te(state.to, stateNo % 10 + 1);
    const out = {};
    for (const k of Object.keys(d)) {
        if (AT_RE.test(k) && AT_RE.test(String(d[k]))) out[atKey] = atVal;
        else out[k] = d[k];
    }
    return out;
}

function collectorHeaders(ua) {
    return {
        'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': ua, 'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9', 'Origin': 'https://www.academy.com', 'Referer': 'https://www.academy.com/',
        'sec-ch-ua': '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
        'sec-ch-ua-mobile': '?0', 'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty', 'sec-fetch-mode': 'cors', 'sec-fetch-site': 'same-site',
    };
}
// Persistent-session sidecar bridge (session_server.py on :8765) — ONE curl_cffi
// chrome131 session drives /ns + every collector POST + the edge test, so the whole
// mint carries a real Chrome TLS fingerprint + shared akamai cookies (like a real tab).
function sidecar(method, url, body, headers) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({ op: 'fwd', method, url, body: body || '', headers: headers || {} });
        const req = require('http').request(
            { host: '127.0.0.1', port: parseInt(process.env.PX_SIDECAR_PORT || '8765'), method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } },
            (res) => { const ch = []; res.on('data', c => ch.push(c));
                       res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(ch).toString('utf8'))); }
                                             catch (e) { reject(e); } }); });
        req.on('error', reject); req.write(payload); req.end();
    });
}
// /ns via the SAME chrome131 session — node's TLS yields a 432-char sm token, real
// Chrome TLS yields 504 (the /ns endpoint bakes the client JA3 into the token).
function fetchNsVia(uuid) {
    if (process.env.USE_SESSION === '1') {
        const t0 = Date.now();
        return sidecar('GET', NS_HOST + '/ns?c=' + uuid, '',
            { 'User-Agent': DEFAULT_UA, 'Accept': '*/*', 'Accept-Language': 'en-US,en;q=0.9',
              'Origin': 'https://www.academy.com', 'Referer': 'https://www.academy.com/' })
            .then(o => (o && o.status === 200 ? { sm: o.body, duration: Date.now() - t0, url: NS_HOST } : null))
            .catch(() => null);
    }
    return fetchNs(uuid, NS_HOST).catch(() => null);
}
function post(url, body, ua) {
    const headers = collectorHeaders(ua);
    if (process.env.USE_SESSION === '1') {
        return sidecar('POST', url, body, headers).then(o => ({ status: o.status, body: o.body }));
    }
    if (process.env.USE_CURL === '1') {
        const r = require('child_process').spawnSync('python',
            [path.join(__dirname, '..', 'script', 'curl_send.py')],
            { input: JSON.stringify({ method: 'POST', url, body, headers, impersonate: 'chrome120' }),
              encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
        if (r.status !== 0 || !r.stdout) throw new Error('curl_send failed: ' + (r.stderr || '').slice(0, 200));
        const out = JSON.parse(r.stdout.trim().split('\n').pop());
        return Promise.resolve({ status: out.status, body: out.body });
    }
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const req = https.request({ method: 'POST', hostname: u.hostname, path: u.pathname + u.search, headers }, (res) => {
            const ch = []; res.on('data', c => ch.push(c)); res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(ch).toString('utf8') }));
        });
        req.on('error', reject); req.write(body); req.end();
    });
}
function formEncode(obj) {
    return Object.entries(obj).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v).replace(/%20/g, '+')).join('&');
}

function extractState(segments) {
    const state = {};
    for (const seg of segments) {
        const args = seg.split('|').slice(1);
        if (args.length === 1 && /=:/.test(args[0])) state.hid = args[0];
        else if (args.length === 1 && /^1[5-9]\d{11}$/.test(args[0])) state.no = args[0];
        else if (args.length === 1 && /^[0-9a-f]{64}$/.test(args[0])) state.qa = args[0];
        else if (args.length === 1 && /^[a-f0-9-]{36}$/.test(args[0])) state.pxsid = args[0];
        else if (args.length === 1 && /^\d{16,}$/.test(args[0])) state.to = args[0];
        else if (args.length === 1 && /^[a-z0-9]{12,30}$/.test(args[0])) state.appId = args[0];
        else if (args.length === 1 && /^\d{1,6}$/.test(args[0])) state.echo = args[0];
        else if (args.length === 1 && /^[a-z]{2,4}$/.test(args[0])) state.jf = args[0];
        else if (args.length === 2 && /^[a-f0-9-]{36}$/.test(args[0])) state.cts = args[0];
        else if (args.length === 3 && /^[a-f0-9-]{36}$/.test(args[0])) state.vid = args[0];
    }
    return state;
}

async function generatePx3() {
    const ua = DEFAULT_UA;
    const uuid = getUUID();
    const initTime = Date.now();
    const nsPromise = fetchNsVia(uuid);

    // cross-event monotonic series (matches v2 real CDP behavior)
    const c1 = rint(7, 15);                                    // real EV1 PX12738: 7-14
    const counterEv2 = rint(1366, 2186);                       // real EV2 PX12738: 1366-2186
    const counterEv3 = counterEv2 + rint(850, 1000);           // real EV2->EV3 delta ~925
    const perfNow = 620 + Math.random() * 90;
    // AzNzeUVTcks= = Math.round(performance.now()) = ms since NAVIGATION start. PX init.js
    // loads late into page-load, so real EV1 perf is 4500-16000ms — NOT (now-initTime ~10ms).
    // perf then advances by ns.duration (~650) to EV2 (real: EV2perf = EV1perf + nsDur). The
    // Date gap InJSeGcVXUo=-KDRYPm5SVwk= is a SEPARATE clock (EV1 ~10ms, EV2 ~1400ms).
    const navOffset = rint(4200, 12000);

    const sendTime1 = Date.now();
    const ev1 = buildEv1({ uuid, initTime, sendTime: sendTime1, perf: navOffset, counterN: c1, smallCtr: 0, perfNow: 0 });
    const pc1 = generatePC(ev1, uuid, TAG, FT);
    const body1 = formEncode({ payload: generatePayload(ev1, null, uuid), appId: APP_ID, tag: TAG, uuid, ft: FT, seq: 0, en: 'NTA', bi: BI, pc: pc1, rsc: 1 });
    const r1 = await post(COLLECTOR_URL + '?seq=0&rsc=1', body1, ua);
    if (r1.status !== 200) throw new Error(`collector#1 HTTP ${r1.status}: ${r1.body.slice(0, 120)}`);
    const ob1 = decodeOb(r1.body, TAG);
    const state = extractState(ob1.segments);
    if (!state.no || !state.appId || !state.to) throw new Error('ob#1 missing state: ' + JSON.stringify(state));

    const ns = await nsPromise;   // ⭐ /ns probe result: { sm = response token, duration = fetch ms }
    // ZjYWPCNWFws= (=/ns duration) is a FLOAT in real captures (644-706ms, a perf.now() delta),
    // not the raw node fetch int. Override to the real range so type+magnitude match the fingerprint.
    if (ns) ns.duration = 644 + Math.random() * 62;
    const nsDur = ns ? Math.round(ns.duration) : 650;   // perf advance EV1->EV2 = /ns fetch time
    await new Promise(r => setTimeout(r, rint(1000, 1700)));  // perf -> oracle range 1354-2162

    const sendTime2 = Date.now();
    // SDK-verified field sources (from init.js static reverse):
    //   MV0BV3Q9AGE= = ER()=EO = /ns responseText (ns.sm)  — NETWORK FINGERPRINT, not random
    //   ZjYWPCNWFws= = ES()=EP = /ns fetch duration (ns.duration)
    //   AzNzeUVTcks= = Math.round(performance.now())
    //   InJSeGcVXUo= = (new Date).getTime();  RBB0WgJxcGk= = parseInt(state.no) [server ts]
    const ev2 = buildEv2({ uuid, initTime, sendTime: sendTime2, state, ua, ns, perf: navOffset + nsDur, counterN: counterEv2, smallCtr: rint(1, 3) });
    const pc2 = generatePC(ev2, uuid, TAG, FT);
    const sid = generateSid(state.pxsid || uuid, state.no);
    if (process.env.DUMP_EV_DIR) { fs.mkdirSync(process.env.DUMP_EV_DIR, { recursive: true }); fs.writeFileSync(path.join(process.env.DUMP_EV_DIR, 'our_ev1.json'), JSON.stringify(ev1, null, 2)); fs.writeFileSync(path.join(process.env.DUMP_EV_DIR, 'our_ev2.json'), JSON.stringify(ev2, null, 2)); }
    const body2 = formEncode({ payload: generatePayload(ev2, state.no, uuid), appId: APP_ID, tag: TAG, uuid, ft: FT, seq: 1, en: 'NTA', bi: BI, cs: state.qa || '', pc: pc2, sid, vid: state.vid || '', cts: state.cts || '', hid: state.hid || '', rsc: 2 });
    const r2 = await post(COLLECTOR_URL + '?seq=1&rsc=2', body2, ua);
    if (r2.status !== 200) throw new Error(`collector#2 HTTP ${r2.status}: ${r2.body.slice(0, 120)}`);
    const ob2 = decodeOb(r2.body, TAG);
    let name = null, value = null, ttl = null;
    for (const seg of ob2.segments) { const a = seg.split('|').slice(1); if (a.length >= 3 && /^_?px\d?$/i.test(a[0])) { name = a[0]; ttl = parseInt(a[1]); value = a[2]; break; } }
    if (!value) return { error: 'no _px3 issued', ob2_segs: ob2.segments.length, state };

    await new Promise(r => setTimeout(r, rint(1500, 4500)));  // totalwine beacon timing
    const sendTime3 = Date.now();
    const ev3 = buildEv3({ uuid, sendTime: sendTime3, cookieValue: value, ns, perf: navOffset + nsDur + (sendTime3 - sendTime2), counterN: counterEv3, smallCtr: rint(3, 6) });
    const pc3 = generatePC(ev3, uuid, TAG, FT);
    const sid3 = generateSid(state.pxsid || uuid, state.no);
    if (process.env.DUMP_EV_DIR) fs.writeFileSync(path.join(process.env.DUMP_EV_DIR, 'our_ev3.json'), JSON.stringify(ev3, null, 2));
    const body3 = formEncode({ payload: generatePayload(ev3, state.no, uuid), appId: APP_ID, tag: TAG, uuid, ft: FT, seq: 2, en: 'NTA', bi: BI, cs: state.qa || '', pc: pc3, sid: sid3, vid: state.vid || '', cts: state.cts || '', hid: state.hid || '', rsc: 3 });
    let c3s = null; try { c3s = (await post(COLLECTOR_URL + '?seq=2&rsc=3', body3, ua)).status; } catch (e) { c3s = 'err'; }

    return { cookie_name: name, cookie_value: value, ttl, uuid, state, collector3_status: c3s,
             ev1_fields: Object.keys(ev1[0].d).length, ev2_fields: Object.keys(ev2[0].d).length, ev3_fields: Object.keys(ev3[0].d).length };
}

if (require.main === module) {
    (async () => {
        try {
            const r = await generatePx3();
            if (process.env.JSON_OUT) console.log('PXJSON:' + JSON.stringify(r));
            if (r.cookie_name) console.log(`✅ ${r.cookie_name}=${r.cookie_value.slice(0, 40)}…  ttl=${r.ttl}  c3=${r.collector3_status}  ev=${r.ev1_fields}/${r.ev2_fields}/${r.ev3_fields}`);
            else console.log('❌', r.error || 'unknown', JSON.stringify(r.state || {}).slice(0, 120));
        } catch (e) { console.error('❌', e.message); process.exit(1); }
    })();
}
module.exports = generatePx3;
