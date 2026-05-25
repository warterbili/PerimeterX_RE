/**
 * Total Wine _px2 generator — pure math, no browser, no PX SDK execution.
 *
 * Strategy (template + DYNAMIC override) — same pattern as ifood / grub:
 *   1. Deep-clone EV1 / EV2 from templates next to this file
 *   2. Replace DYNAMIC fields (4 in EV1, ~20 in EV2)
 *   3. Anti-tamper slot: find by regex, replace key + value with current
 *      `te(state.to, state.no % 10 ± 1)`
 *   4. POST collector#1 (seq=0), decode ob#1 → extract state.{no,qa,vid,pxsid,cts,to,appId,jf}
 *   5. POST collector#2 (seq=1) with state injected, decode ob#2, extract _px2
 *
 * Constants (verified against locked SDK 847732ea…, 6 fresh batches):
 *   AppID:  PXFF0j69T5
 *   TAG:    CFQ7WU4xIS8MXA==
 *   FT:     401
 *   Cookie: _px2  (TTL 330)
 *   Collector: https://www.totalwine.com/FF0j69T5/xhr/api/v2/collector
 *
 * State.* → EV2 b64 key mappings (from find_state_keys.js, 5/6 batches):
 *   state.no    → YQ1SBydsVTQ=     ⚠️ parseInt before injection
 *   state.to    → fEgPAjoqCzE=
 *   state.appId → Bzd0fUJTcUc=
 *
 * Usage:
 *   const generatePx2 = require('./totalwine_px2');
 *   const r = await generatePx2();
 *   console.log(r.cookie_name + '=' + r.cookie_value);   // _px2=eyJ1...
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

// ═══ constants ═══

const APP_ID = 'PXFF0j69T5';
const TAG    = 'CFQ7WU4xIS8MXA==';
const FT     = '401';
const COLLECTOR_URL = 'https://www.totalwine.com/FF0j69T5/xhr/api/v2/collector';
const BI = 'AhIxElclcDNERlc3G04LMQM7JVUTF3g3Dg8uXzldex0APXcvRlR6JmxJRWkDPDxLASh9LCoadHFrH2NQE35maRsPOzsXEgQ/Fzx3Sh1ef2MOCXBpaFp5Hw0ycnlYQD4=';
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

// Templates built from 6 fresh-capture batches (tmp/totalwine/sample/{1..6}/decoded_payload_*.json)
const TEMPLATES = __dirname;
const EV1_TEMPLATE = JSON.parse(fs.readFileSync(path.join(TEMPLATES, 'totalwine_ev1_template.json'), 'utf8'));
const EV2_TEMPLATE = JSON.parse(fs.readFileSync(path.join(TEMPLATES, 'totalwine_ev2_template.json'), 'utf8'));
const EV3_TEMPLATE = JSON.parse(fs.readFileSync(path.join(TEMPLATES, 'totalwine_ev3_template.json'), 'utf8'));

const AT_RE = /^[0-9:;<=>?@]{15,25}$/;

// ═══ EV1 — totalwine 13 fields, 4 DYNAMIC ═══

function buildEv1(ctx) {
    const e = JSON.parse(JSON.stringify(EV1_TEMPLATE));
    if (e[0]._meta) delete e[0]._meta;
    const d = e[0].d;
    // totalwine EV1 DYNAMIC keys (from build_templates):
    //   IxMQGWVzEis=  perf-like 4-digit int
    //   FmYlbFAAKVs=  timestamp ms
    //   eWVKLzwCRh0=  timestamp ms (close to send time)
    //   PSkOY3tIA1c=  request uuid
    d['IxMQGWVzEis=']  = 1500 + Math.floor(Math.random() * 4000);
    d['FmYlbFAAKVs=']  = ctx.sendTime;
    d['eWVKLzwCRh0=']  = ctx.sendTime + 5 + Math.floor(Math.random() * 30);
    d['PSkOY3tIA1c=']  = ctx.uuid;
    return e;
}

// ═══ EV2 — totalwine ~220 fields, ~21 DYNAMIC ═══

function buildEv2(ctx) {
    const e = JSON.parse(JSON.stringify(EV2_TEMPLATE));
    if (e[0]._meta) delete e[0]._meta;
    const tpl = e[0].d;

    // state.* injection (Gotcha #1 — parseInt for state.no)
    tpl['YQ1SBydsVTQ=']  = parseInt(ctx.state.no);
    tpl['fEgPAjoqCzE=']  = ctx.state.to;
    tpl['Bzd0fUJTcUc=']  = ctx.state.appId;

    // Timestamps & request identity
    tpl['IxMQGWVzEis=']  = 1500 + Math.floor(Math.random() * 4000);
    tpl['FmYlbFAAKVs=']  = ctx.sendTime;
    tpl['eWVKLzwCRh0=']  = ctx.sendTime + 1000 + Math.floor(Math.random() * 3000);
    tpl['IxMQGWV1Fyk=']  = ctx.sendTime + 500 + Math.floor(Math.random() * 1500);
    tpl['IxMQGWV+ECs=']  = new Date(ctx.sendTime).toString();
    tpl['PSkOY3tIA1c=']  = ctx.uuid;
    tpl['JxcUHWJ2FSs=']  = 5000 + Math.floor(Math.random() * 6000);

    // HMAC-MD5 / MD5 fingerprint slots — formulas recovered from SDK
    // (jm() = HMAC-MD5; pO.setItem(pQ, jm(state.vid)) = MD5 of vid)
    tpl['Cho5UEx3PWY=']  = hmacMD5(ctx.uuid, ctx.ua);              // HMAC(uuid, UA)
    tpl['Lx8cFWl9HCE=']  = hmacMD5(ctx.state.vid, ctx.ua);         // HMAC(state.vid, UA)
    tpl['UiJhKBREYhs=']  = hmacMD5(ctx.state.pxsid, ctx.ua);       // HMAC(state.pxsid, UA)
    tpl['EFwjFlU8JyU=']  = crypto.createHash('md5').update(ctx.state.vid).digest('hex');  // md5(state.vid)

    // Short hex hash + identifier
    tpl['ICxTJmVMUBc=']  = crypto.createHash('md5').update(ctx.uuid).digest('hex').slice(0, 8);

    // Performance memory-ish large ints
    tpl['fEgPAjooCTk=']  = 20_000_000 + Math.floor(Math.random() * 30_000_000);
    tpl['RTE2ewNcMUo=']  = 25_000_000 + Math.floor(Math.random() * 40_000_000);

    // Connection info + page lifetime ms
    tpl['bRleEyh5XSg=']  = { support: true, status: { effectiveType: '4g', rtt: 200 + Math.floor(Math.random()*150), downlink: 0.3 + Math.random() * 1.5, saveData: false } };
    tpl['ViZlLBNGZxs=']  = 900 + Math.random() * 400;

    // hid-like long base64 (transport opaque)
    tpl['ajoZMC9aGwY=']  = crypto.randomBytes(96).toString('base64').replace(/[+/=]/g, c => ({ '+':'-', '/':'_', '=':'' }[c]));

    // PX12738/PX12739/PX12740/PX12741 counters dict.
    // Real captures: PX12738 == PX12739 in same session (synchronized counters).
    // Stored on ctx so EV3 can keep monotonic growth.
    const n2 = 1000 + Math.floor(Math.random() * 2500);
    ctx._counter2 = n2;
    tpl['MDxDNnVeQgQ=']  = { PX12738: n2, PX12739: n2, PX12740: 0, PX12741: -1 };

    // Anti-tamper relocation (must preserve dictionary iteration order)
    e[0].d = relocateAntiTamper(tpl, ctx.state);
    return e;
}

// ═══ EV3 — totalwine 11 fields, 7 DYNAMIC ═══
//   Beacon back to PX confirming the just-issued _px2 was received.
//   Key field OkpJAH8oTTA= holds the cookie value PX gave us.
//   Without this beacon, PX backend keeps the session in "incomplete" state.

function buildEv3(ctx) {
    const e = JSON.parse(JSON.stringify(EV3_TEMPLATE));
    if (e[0]._meta) delete e[0]._meta;
    const tpl = e[0].d;
    tpl['IxMQGWVzEis=']  = 1500 + Math.floor(Math.random() * 9000);
    // EV3 counters must grow monotonically from EV2 (2-5x typically) AND stay synchronized.
    const n3 = (ctx._prevCounter || 1500) + 1500 + Math.floor(Math.random() * 5000);
    tpl['MDxDNnVeQgQ=']  = { PX12738: n3, PX12739: n3, PX12740: 0, PX12741: -1 };
    tpl['OkpJAH8oTTA=']  = ctx.cookieValue;                              // ⭐ confirmation field
    tpl['ajoZMC9aGwY=']  = crypto.randomBytes(96).toString('base64').replace(/[+/=]/g, c => ({ '+':'-', '/':'_', '=':'' }[c]));
    tpl['PSkOY3tIA1c=']  = ctx.uuid;
    tpl['eWVKLzwCRh0=']  = ctx.sendTime;
    tpl['ViZlLBNGZxs=']  = 900 + Math.random() * 1800;
    return e;
}

function te(t, e) {
    let r = '';
    for (let i = 0; i < t.length; i++) r += String.fromCharCode(t.charCodeAt(i) ^ e);
    return r;
}

function relocateAntiTamper(d, state) {
    const stateNo = parseInt(state.no);
    const atKey = te(state.to, stateNo % 10 + 2);
    const atVal = te(state.to, stateNo % 10 + 1);
    const out = {};
    for (const k of Object.keys(d)) {
        if (AT_RE.test(k) && AT_RE.test(String(d[k]))) {
            out[atKey] = atVal;
        } else {
            out[k] = d[k];
        }
    }
    return out;
}

function hmacMD5(data, key) {
    return crypto.createHmac('md5', key).update(data).digest('hex');
}

// ═══ HTTP ═══

function post(url, body, ua) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const req = https.request({
            method: 'POST',
            hostname: u.hostname,
            path: u.pathname + u.search,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': ua,
                'Accept': '*/*',
                'Origin': 'https://www.totalwine.com',
                'Referer': 'https://www.totalwine.com/',
            },
        }, (res) => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function formEncode(obj) {
    return Object.entries(obj).map(([k, v]) =>
        encodeURIComponent(k) + '=' + encodeURIComponent(v).replace(/%20/g, '+')
    ).join('&');
}

// ═══ Main ═══

async function generatePx2() {
    const ua = DEFAULT_UA;
    const uuid = getUUID();
    const initTime = Date.now();

    // ── collector#1 (seq=0, en=NTA) ──
    const sendTime1 = Date.now();
    const ev1 = buildEv1({ uuid, initTime, sendTime: sendTime1 });
    const payload1 = generatePayload(ev1, null, uuid);
    const pc1 = generatePC(ev1, uuid, TAG, FT);

    const body1 = formEncode({
        payload: payload1, appId: APP_ID, tag: TAG, uuid, ft: FT,
        seq: 0, en: 'NTA', bi: BI, pc: pc1, rsc: 1,
    });
    const r1 = await post(COLLECTOR_URL + '?seq=0&rsc=1', body1, ua);
    if (r1.status !== 200) throw new Error(`collector#1 HTTP ${r1.status}: ${r1.body.slice(0,200)}`);

    const ob1 = decodeOb(r1.body, TAG);
    if (process.env.DUMP_EV_DIR) {
        fs.mkdirSync(process.env.DUMP_EV_DIR, { recursive: true });
        fs.writeFileSync(path.join(process.env.DUMP_EV_DIR, 'our_ob1_segments.json'), JSON.stringify(ob1.segments, null, 2));
    }
    const state = extractState(ob1.segments);
    if (!state.no || !state.appId || !state.to) {
        throw new Error('ob#1 missing required state: ' + JSON.stringify(state));
    }

    // ── collector#2 (seq=1, en=NTA) ──
    const sendTime2 = Date.now();
    const ev2Ctx = { uuid, initTime, sendTime: sendTime2, state, ua };
    const ev2 = buildEv2(ev2Ctx);
    const payload2 = generatePayload(ev2, state.no, uuid);
    const pc2 = generatePC(ev2, uuid, TAG, FT);
    const sid = generateSid(state.pxsid || uuid, state.no);

    // Diagnostic dump (skill compare workflow) — set DUMP_EV_DIR to write ev1+ev2 JSON
    if (process.env.DUMP_EV_DIR) {
        const dumpDir = process.env.DUMP_EV_DIR;
        fs.mkdirSync(dumpDir, { recursive: true });
        fs.writeFileSync(path.join(dumpDir, 'our_ev1.json'), JSON.stringify(ev1, null, 2));
        fs.writeFileSync(path.join(dumpDir, 'our_ev2.json'), JSON.stringify(ev2, null, 2));
        fs.writeFileSync(path.join(dumpDir, 'our_state.json'), JSON.stringify({ uuid, state, sendTime1, sendTime2, initTime }, null, 2));
        console.error(`[dump] wrote ev1/ev2/state → ${dumpDir}`);
    }

    const body2 = formEncode({
        payload: payload2, appId: APP_ID, tag: TAG, uuid, ft: FT,
        seq: 1, en: 'NTA', bi: BI, cs: state.qa || '', pc: pc2,
        sid, vid: state.vid || '', cts: state.cts || '', rsc: 2,
    });
    const r2 = await post(COLLECTOR_URL + '?seq=1&rsc=2', body2, ua);
    if (r2.status !== 200) throw new Error(`collector#2 HTTP ${r2.status}: ${r2.body.slice(0,200)}`);

    const ob2 = decodeOb(r2.body, TAG);
    let cookieName = null, cookieValue = null, cookieTtl = null;
    for (const seg of ob2.segments) {
        const args = seg.split('|').slice(1);
        if (args.length >= 4 && /^_?px/i.test(args[0])) {
            cookieName = args[0]; cookieTtl = parseInt(args[1]); cookieValue = args[2];
            break;
        }
    }
    if (!cookieValue) {
        return { error: 'no _px2 issued', ob2_segs: ob2.segments.length, state };
    }

    // ── collector#3 (seq=2, en=NTA) — confirmation beacon ──
    // PX uses this to mark the session as fully bootstrapped. Without it,
    // the just-issued cookie is held in "low trust" mode → edge blocks.
    await new Promise(r => setTimeout(r, 1500 + Math.floor(Math.random() * 3000)));
    const sendTime3 = Date.now();
    const ev3 = buildEv3({ uuid, sendTime: sendTime3, cookieValue, _prevCounter: ev2Ctx._counter2 });
    const payload3 = generatePayload(ev3, state.no, uuid);
    const pc3 = generatePC(ev3, uuid, TAG, FT);
    const sid3 = generateSid(state.pxsid || uuid, state.no);

    if (process.env.DUMP_EV_DIR) {
        fs.writeFileSync(path.join(process.env.DUMP_EV_DIR, 'our_ev3.json'), JSON.stringify(ev3, null, 2));
    }

    const body3 = formEncode({
        payload: payload3, appId: APP_ID, tag: TAG, uuid, ft: FT,
        seq: 2, en: 'NTA', bi: BI, cs: state.qa || '', pc: pc3,
        sid: sid3, vid: state.vid || '', cts: state.cts || '',
        hid: state.hid || '', rsc: 3,
    });
    let r3_status = null;
    try {
        const r3 = await post(COLLECTOR_URL + '?seq=2&rsc=3', body3, ua);
        r3_status = r3.status;
    } catch (e) {
        r3_status = 'err:' + e.message;
    }

    return {
        cookie_name: cookieName, cookie_value: cookieValue, ttl: cookieTtl,
        uuid, state,
        ev1_fields: Object.keys(ev1[0].d).length,
        ev2_fields: Object.keys(ev2[0].d).length,
        ev3_fields: Object.keys(ev3[0].d).length,
        ob1_segs: ob1.segments.length, ob2_segs: ob2.segments.length,
        collector3_status: r3_status,
    };
}

function extractState(segments) {
    const state = {};
    for (const seg of segments) {
        const args = seg.split('|').slice(1);
        if (args.length === 1 && /^1[5-9]\d{11}$/.test(args[0])) state.no = args[0];
        else if (args.length === 1 && /^[0-9a-f]{64}$/.test(args[0])) state.qa = args[0];
        else if (args.length === 1 && /^[a-f0-9-]{36}$/.test(args[0])) state.pxsid = args[0];
        else if (args.length === 1 && /^\d{16,}$/.test(args[0])) state.to = args[0];
        else if (args.length === 1 && /^[a-z0-9]{12,30}$/.test(args[0])) state.appId = args[0];
        else if (args.length === 1 && /^[a-z]{2,4}$/.test(args[0])) state.jf = args[0];
        else if (args.length === 2 && /^[a-f0-9-]{36}$/.test(args[0])) state.cts = args[0];
        else if (args.length === 3 && /^[a-f0-9-]{36}$/.test(args[0])) state.vid = args[0];
        else if (args.length === 2 && args[1] === 'true' && /=:/.test(args[0])) state.hid = args[0];
    }
    return state;
}

if (require.main === module) {
    (async () => {
        try {
            const r = await generatePx2();
            console.log(JSON.stringify(r, (k, v) => k === 'cookie_value' && typeof v === 'string' ? v.slice(0, 60) + '...' : v, 2));
            if (r.cookie_name) console.log(`\n✅ ${r.cookie_name}=${r.cookie_value.slice(0,40)}…  ttl=${r.ttl}`);
            else console.log('\n❌', r.error || 'unknown');
        } catch (e) {
            console.error('❌', e.message);
            process.exit(1);
        }
    })();
}

module.exports = generatePx2;
