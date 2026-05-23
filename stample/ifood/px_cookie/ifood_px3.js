/**
 * iFood _px3 generator — pure math, no browser, no PX SDK execution.
 *
 * Strategy (template + DYNAMIC override):
 *   1. Deep-clone EV1 / EV2 from templates/ifood_ev{1,2}_template.json
 *   2. Replace ~6 DYNAMIC fields in EV1 and ~17 DYNAMIC fields in EV2
 *   3. Anti-tamper slot: find by regex, replace key + value with current
 *      `te(state.to, state.no % 10 ± 1)`
 *   4. POST collector#1, decode ob#1 → extract state.{no,qa,vid,pxsid,cts,to,appId,jf}
 *   5. POST collector#2 with state injected, decode ob#2, extract _px3
 *
 * Constants (verified against locked SDK e042d5dede9d…, 10/10 validated):
 *   AppID:  PXO1GDTa7Q
 *   TAG:    U0MmDhUmOnhXSw==
 *   FT:     401
 *   Cookie: _px3
 *
 * Usage:
 *   const generatePx3 = require('./ifood_px3');
 *   const r = await generatePx3();
 *   console.log(r.cookie_name + '=' + r.cookie_value);
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
const fetchNs = require('../../../revers/ns');

// ═══ constants ═══

const APP_ID = 'PXO1GDTa7Q';
const TAG    = 'U0MmDhUmOnhXSw==';
const FT     = '401';
const COLLECTOR_URL = 'https://collector-pxo1gdta7q.px-cloud.net/api/v2/collector';
const BI = 'EwNmQ0Y0IWJVVwZmCl9aYBIqdAQCBilmHx5zDihCKkkRLCB5V0IrfH1YFDgSLW0aEDksfTsLJSB6CjJcUGJtO18eam5RCVVuBit2G1VPejAfTXdjL0IpSUdyJSgYUW8=';
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

// Templates built from 6 fresh-capture batches (see src/scripts/analysis/build_templates.js).
// Each is annotated with STATIC/DYNAMIC categories — see templates/ifood_ev*_field_map.json
const TEMPLATES = __dirname;
const EV1_TEMPLATE = JSON.parse(fs.readFileSync(path.join(TEMPLATES, 'ifood_ev1_template.json'), 'utf8'));
const EV2_TEMPLATE = JSON.parse(fs.readFileSync(path.join(TEMPLATES, 'ifood_ev2_template.json'), 'utf8'));

// Anti-tamper detector
const AT_RE = /^[0-9:;<=>?@]{15,25}$/;

// ═══ EV1 builder ═══

function buildEv1(ctx) {
    const e = JSON.parse(JSON.stringify(EV1_TEMPLATE));
    const d = e[0].d;

    d['VQEgCxNnKjw='] = ctx.initTime;
    d['bHgZcikfE0A='] = ctx.sendTime;
    d['NSEAa3NAC18='] = ctx.uuid;
    d['PSkIY3tJDFE='] = ctx.sendTime - ctx.initTime + Math.floor(Math.random() * 200);
    d['cyNGaTZBQVs='] = { PX12738: 8 + Math.floor(Math.random() * 12), PX12739: 0, PX12740: 0, PX12741: -1 };
    // pxhd: cold visit → empty (template's pxhd is warm; we want cold)
    d['R3cyPQIVMAw='] = '';
    // /ns sm/duration: cold → null/0
    d['BzdyfUJXdks='] = null;
    d['DFg5Ekk4PSU='] = 0;

    return e;
}

// ═══ EV2 builder (template + DYNAMIC overrides + anti-tamper relocation) ═══

function buildEv2(ctx) {
    const e = JSON.parse(JSON.stringify(EV2_TEMPLATE));
    const tpl = e[0].d;

    // ── Group A: timestamps + ID ──
    tpl['RTEwewNQMUg=']  = parseInt(ctx.state.no);          // ⭐ number, not string
    tpl['VQEgCxNnKjw=']  = ctx.initTime;
    tpl['bHgZcikfE0A=']  = ctx.sendTime + 1200 + Math.floor(Math.random() * 400);
    tpl['NSEAa3NAC18=']  = ctx.uuid;
    tpl['Czt+cU1WeEM=']  = new Date(ctx.sendTime).toString();
    tpl['PSkIY3tJDFE=']  = ctx.sendTime - ctx.initTime;

    // ── Group B: HMACs ──
    tpl['M2MGKXUOBB8=']  = hmacMD5(ctx.uuid, ctx.ua);
    if (ctx.state.vid)   tpl['FmYjbFAEJVg='] = hmacMD5(ctx.state.vid, ctx.ua);
    if (ctx.state.pxsid) tpl['BzdyfUFRd04='] = hmacMD5(ctx.state.pxsid, ctx.ua);

    // ── Group C: state injection ──
    tpl['Xi5rJBtKaB4=']  = ctx.state.appId;
    tpl['FCAhKlJCIxk=']  = ctx.state.to;

    // ── Group D: memory ──
    const mem = generateMemory();
    tpl['NABBSnJgQXE=']  = mem.used;
    tpl['EX1kN1cQZQY=']  = mem.total;

    // ── Group E: /ns ──
    if (ctx.ns) {
        tpl['BzdyfUJXdks='] = ctx.ns.sm;
        tpl['DFg5Ekk4PSU='] = ctx.ns.duration;
    }

    // ── Conditional: pxhd injection cold-visit empty ──
    tpl['R3cyPQIVMAw='] = '';
    tpl['cyNGaTZBQVs='] = { PX12738: 1000 + Math.floor(Math.random() * 2000), PX12739: 0, PX12740: 0, PX12741: -1 };

    // ── Group F: ANTI-TAMPER (find old slot, replace with current state-derived) ──
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

// ═══ HTTP post ═══

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
                'Origin': 'https://www.ifood.com.br',
                'Referer': 'https://www.ifood.com.br/',
            },
        }, (res) => {
            let chunks = [];
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

// ═══ Main flow ═══

async function generatePx3() {
    const ua = DEFAULT_UA;
    const uuid = getUUID();
    const initTime = Date.now();

    // ── /ns probe in parallel ──
    const nsPromise = fetchNs(uuid).catch(() => ({ sm: null, duration: 0 }));

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
    if (r1.status !== 200) throw new Error(`collector#1 HTTP ${r1.status}`);

    const ob1 = decodeOb(r1.body, TAG);
    const state = extractState(ob1.segments);
    if (!state.no || !state.appId || !state.to) {
        throw new Error('ob#1 missing required state: ' + JSON.stringify(state));
    }

    const ns = await nsPromise;

    // ── collector#2 ──
    const sendTime2 = Date.now();
    const ev2 = buildEv2({ uuid, initTime, sendTime: sendTime2, state, ua, ns });
    const payload2 = generatePayload(ev2, state.no, uuid);
    const pc2 = generatePC(ev2, uuid, TAG, FT);
    const sid = generateSid(state.pxsid || uuid, state.no);

    const body2 = formEncode({
        payload: payload2, appId: APP_ID, tag: TAG, uuid, ft: FT,
        seq: 1, en: 'NTA', bi: BI, cs: state.qa, pc: pc2,
        sid, vid: state.vid || '', cts: state.cts || '', rsc: 2,
    });
    const r2 = await post(COLLECTOR_URL + '?seq=1&rsc=2', body2, ua);
    if (r2.status !== 200) throw new Error(`collector#2 HTTP ${r2.status}`);

    const ob2 = decodeOb(r2.body, TAG);
    for (const seg of ob2.segments) {
        const args = seg.split('|').slice(1);
        if (args.length >= 4 && /^_?px/i.test(args[0])) {
            return {
                cookie_name: args[0], cookie_value: args[2], ttl: parseInt(args[1]),
                uuid, state, ev1_fields: Object.keys(ev1[0].d).length, ev2_fields: Object.keys(ev2[0].d).length,
                ob1_segs: ob1.segments.length, ob2_segs: ob2.segments.length,
            };
        }
    }
    return { error: 'no _px3 issued', ob2_segs: ob2.segments.length, state };
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

// ═══ CLI ═══

if (require.main === module) {
    (async () => {
        try {
            const result = await generatePx3();
            console.log(JSON.stringify(result, (k, v) => k === 'cookie_value' && typeof v === 'string' ? v.slice(0, 60) + '...' : v, 2));
            if (result.cookie_name) console.log(`\n✅ ${result.cookie_name}=${result.cookie_value.slice(0,40)}…  ttl=${result.ttl}`);
            else console.log('\n❌', result.error || 'unknown');
        } catch (e) {
            console.error('❌', e.message);
            process.exit(1);
        }
    })();
}

module.exports = generatePx3;
