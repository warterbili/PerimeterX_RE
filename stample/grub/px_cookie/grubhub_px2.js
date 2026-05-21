/**
 * Grubhub _px2 generator — pure math, no browser, no PX SDK execution.
 *
 * Strategy (template + DYNAMIC override):
 *   1. Deep-clone EV1 / EV2 from templates next to this file
 *   2. Replace ~4 DYNAMIC fields in EV1 and ~20 DYNAMIC fields in EV2
 *   3. Anti-tamper slot: find by regex, replace key + value with current
 *      `te(state.to, state.no % 10 ± 1)`
 *   4. POST collector#1, decode ob#1 → extract state.{no,qa,vid,pxsid,cts,to,appId,jf}
 *   5. POST collector#2 with state injected, decode ob#2, extract _px2
 *
 * Constants (verified against locked SDK 5e81bffc…, 10/10 validated):
 *   AppID:  PXO97ybH4J
 *   TAG:    FmYgK1gdJEAP
 *   FT:     359
 *   Cookie: _px2
 *   Collector: https://sensor.grubhub.com/O97ybH4J/xhr/api/v2/collector
 *
 * Usage:
 *   const generatePx2 = require('./grubhub_px2');
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
const { generateMemory } = require('../../../revers/memory');

// ═══ constants ═══

const APP_ID = 'PXO97ybH4J';
const TAG    = 'FmYgK1gdJEAP';
const FT     = '359';
const COLLECTOR_URL = 'https://sensor.grubhub.com/O97ybH4J/xhr/api/v2/collector';
const BI = 'EwNmQ0Y0IWJVVwZmCl9aYBIqdAQCBilmHx5zDihCKkkRLCB5V0IrfH1YFDgSLW0aEDksfTsLJSB6CjJcUGJtO18eam5RCVVuBit2G1VPejAfTXdjL0IpSUdyJSgYUW8=';
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

// Templates built from 6 fresh-capture batches (../sample/{1..6}/decoded_payload_*.json)
const TEMPLATES = __dirname;
const EV1_TEMPLATE = JSON.parse(fs.readFileSync(path.join(TEMPLATES, 'grubhub_ev1_template.json'), 'utf8'));
const EV2_TEMPLATE = JSON.parse(fs.readFileSync(path.join(TEMPLATES, 'grubhub_ev2_template.json'), 'utf8'));

const AT_RE = /^[0-9:;<=>?@]{15,25}$/;

// ═══ EV1 — Grubhub 12 fields (no /ns sm in EV1) ═══

function buildEv1(ctx) {
    const e = JSON.parse(JSON.stringify(EV1_TEMPLATE));
    const d = e[0].d;
    // Grubhub EV1 DYNAMIC keys (from diff_samples): aRVfHy9zVig=, GCQuLl1DJxw=, LDhaMmpZUgY=, FCAiKlJAJRg=
    d['aRVfHy9zVig=']  = ctx.initTime;
    d['GCQuLl1DJxw=']  = ctx.sendTime;
    d['LDhaMmpZUgY=']  = ctx.uuid;
    d['FCAiKlJAJRg=']  = 5000 + Math.floor(Math.random() * 15000); // perf-like 4-5 digit
    return e;
}

// ═══ EV2 — Grubhub ~204 fields ═══

function buildEv2(ctx) {
    const e = JSON.parse(JSON.stringify(EV2_TEMPLATE));
    const tpl = e[0].d;

    // Grubhub-specific state.* injection slots — these differ from iFood!
    tpl['UT0ndxdcJUQ=']  = parseInt(ctx.state.no);        // ⚠️ Grubhub state.no key (iFood uses RTEwewNQMUg=)
    tpl['UBxmVhZ+Z2U=']  = ctx.state.to;                  // Grubhub state.to key
    tpl['CXV/P0wRfwU=']  = ctx.state.appId;               // Grubhub state.appId key
    tpl['aRVfHy9zVig=']  = ctx.initTime;
    tpl['GCQuLl1DJxw=']  = ctx.sendTime;
    tpl['EX1nN1cbZQc=']  = ctx.sendTime + Math.floor(Math.random() * 600); // mid-time
    tpl['LDhaMmpZUgY=']  = ctx.uuid;
    tpl['UiJkKBRPYRo=']  = new Date(ctx.sendTime).toString();
    tpl['Pk5IBHsoTzQ=']  = hmacMD5(ctx.uuid, ctx.ua);
    tpl['cHwGdjYRB0A=']  = hmacMD5(ctx.uuid + ':secondary', ctx.ua); // pxsid-derived HMAC slot
    tpl['FUFjS1MhYHA=']  = 30000000 + Math.floor(Math.random() * 50_000_000);  // mem used
    tpl['W0stQR0mL3A=']  = 35000000 + Math.floor(Math.random() * 60_000_000);  // mem total
    tpl['FCAiKlJAJRg=']  = 8000 + Math.floor(Math.random() * 10000);
    tpl['Q3M1OQUfPQo=']  = 1 + Math.floor(Math.random() * 5);
    tpl['VQEjCxNsIT4=']  = 1 + Math.floor(Math.random() * 5);
    tpl['aHQefi4UHEQ=']  = 10 + Math.floor(Math.random() * 20);
    tpl['T385NQoePQM=']  = 3000 + Math.floor(Math.random() * 2000);
    tpl['BFAyGkE3Nyk=']  = 300 + Math.floor(Math.random() * 200);
    tpl['LVkbU2s6EmI=']  = 1.0 + Math.random() * 0.7;
    tpl['ICxWJmVMURE=']  = 1300 + Math.random() * 500;
    // Keep template defaults for: error stack, connection, "4g", long state-id-like string

    // Anti-tamper relocation
    e[0].d = relocateAntiTamper(tpl, ctx.state);
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
                'Origin': 'https://www.grubhub.com',
                'Referer': 'https://www.grubhub.com/',
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

    // ── collector#1 ──
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
    const state = extractState(ob1.segments);
    if (!state.no || !state.appId || !state.to) {
        throw new Error('ob#1 missing required state: ' + JSON.stringify(state));
    }

    // ── collector#2 ──
    const sendTime2 = Date.now();
    const ev2 = buildEv2({ uuid, initTime, sendTime: sendTime2, state, ua });
    const payload2 = generatePayload(ev2, state.no, uuid);
    const pc2 = generatePC(ev2, uuid, TAG, FT);
    const sid = generateSid(state.pxsid || uuid, state.no);

    const body2 = formEncode({
        payload: payload2, appId: APP_ID, tag: TAG, uuid, ft: FT,
        seq: 1, en: 'NTA', bi: BI, cs: state.qa || '', pc: pc2,
        sid, vid: state.vid || '', cts: state.cts || '', rsc: 2,
    });
    const r2 = await post(COLLECTOR_URL + '?seq=1&rsc=2', body2, ua);
    if (r2.status !== 200) throw new Error(`collector#2 HTTP ${r2.status}: ${r2.body.slice(0,200)}`);

    const ob2 = decodeOb(r2.body, TAG);
    for (const seg of ob2.segments) {
        const args = seg.split('|').slice(1);
        if (args.length >= 4 && /^_?px/i.test(args[0])) {
            return {
                cookie_name: args[0], cookie_value: args[2], ttl: parseInt(args[1]),
                uuid, state,
                ev1_fields: Object.keys(ev1[0].d).length,
                ev2_fields: Object.keys(ev2[0].d).length,
                ob1_segs: ob1.segments.length, ob2_segs: ob2.segments.length,
            };
        }
    }
    return { error: 'no _px2 issued', ob2_segs: ob2.segments.length, state };
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
