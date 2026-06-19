/**
 * PX-success differential proof (collector layer) — reproducible.
 *
 * WHY THIS EXISTS: Walmart's business APIs are gated by Akamai (out of scope),
 * so we cannot do a Layer-3.5 end-to-end "_px3 → real business JSON" check.
 * The achievable, falsifiable proof of PX success is a COLLECTOR-LEVEL
 * DIFFERENTIAL: the collector returns HTTP 200 for *any* POST, so 200 is NOT
 * a success signal. Success = our correct synthetic payload makes PX decode and
 * emit the full OB state chain (state.no/appId/to), whereas a garbage payload of
 * the same shape decodes to nothing. If the two differ, PX genuinely processed
 * our sensor data.
 *
 * Run:  node stample/walmart/script/px_success_proof.js
 * Expect: POSITIVE → ~12 segments + state.* true ; NEGATIVE → ~1 segment, no state.
 */
const https = require('https');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const generatePayload = require('../../../revers/payload');
const { decodeOb } = require('../../../revers/ob');
const generatePC = require('../../../revers/pc');
const { getUUID } = require('../../../revers/uuid');

const APP_ID = 'PXu6b0qd2S';
const SDK_URL = 'https://www.walmart.com/px/PXu6b0qd2S/init.js';
const COLLECTOR = 'https://collector-pxu6b0qd2s.px-cloud.net/api/v2/collector';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';
const EV1_TPL = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'px_cookie', 'walmart_ev1_template.json'), 'utf8'));

function fetchConst() {
  return new Promise(res => {
    https.get(SDK_URL, { headers: { 'User-Agent': UA, Referer: 'https://www.walmart.com/' } }, r => {
      let b = ''; r.on('data', c => b += c); r.on('end', () => {
        const m = b.match(/="([A-Za-z0-9+/]{8,28}={0,2})",[A-Za-z$_]{1,4}="(\d{3})",[A-Za-z$_]{1,4}="PXu6b0qd2S",[A-Za-z$_]{1,4}="([^"]+)"/);
        res(m ? { TAG: m[1], FT: m[2], BI: m[3] } : null);
      });
    }).on('error', () => res(null));
  });
}
function post(body) {
  return new Promise((resolve, reject) => {
    const u = new URL(COLLECTOR + '?seq=0&rsc=1');
    const req = https.request({ method: 'POST', hostname: u.hostname, path: u.pathname + u.search,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA, Accept: '*/*',
        Origin: 'https://www.walmart.com', Referer: 'https://www.walmart.com/' } }, r => {
      const c = []; r.on('data', x => c.push(x)); r.on('end', () => resolve({ status: r.statusCode, body: Buffer.concat(c).toString('utf8') }));
    });
    req.on('error', reject); req.write(body); req.end();
  });
}
const enc = o => Object.entries(o).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v).replace(/%20/g, '+')).join('&');

function buildEv1(uuid, t0) {
  const e = JSON.parse(JSON.stringify(EV1_TPL)); if (e[0]._meta) delete e[0]._meta;
  const d = e[0].d;
  d['Ahk5WERyM2o='] = 2000; d['ajERMCxcFQc='] = t0; d['U0goSRYkLHs='] = t0 + 17; d['HUJmQ1soY3c='] = uuid;
  return e;
}
function summarize(tag, resp) {
  try {
    const ob = decodeOb(resp.body, tag);
    let hasNo = false, hasAppId = false, hasTo = false;
    for (const seg of ob.segments) {
      const a = seg.split('|').slice(1);
      if (a.length === 1 && /^1[5-9]\d{11}$/.test(a[0])) hasNo = true;
      if (a.length === 1 && /^[a-z0-9]{12,30}$/.test(a[0])) hasAppId = true;
      if (a.length >= 1 && /^\d{16,}$/.test(a[0])) hasTo = true;
    }
    return { status: resp.status, segments: ob.segments.length, state_no: hasNo, state_appId: hasAppId, state_to: hasTo, body_len: resp.body.length };
  } catch (e) { return { status: resp.status, segments: 'decode-failed', body_len: resp.body.length }; }
}

(async () => {
  const C = await fetchConst();
  if (!C) { console.log('could not fetch SDK constants'); process.exit(1); }
  const { TAG, FT, BI } = C;
  const uuid = getUUID(), t0 = Date.now();

  const ev1 = buildEv1(uuid, t0);
  const p1 = generatePayload(ev1, null, uuid);
  const pc1 = generatePC(ev1, uuid, TAG, FT);
  const rPos = await post(enc({ payload: p1, appId: APP_ID, tag: TAG, uuid, ft: FT, seq: 0, en: 'NTA', bi: BI, pc: pc1, rsc: 1 }));

  const garbage = crypto.randomBytes(p1.length).toString('base64').slice(0, p1.length);
  const rNeg = await post(enc({ payload: garbage, appId: APP_ID, tag: TAG, uuid: getUUID(), ft: FT, seq: 0, en: 'NTA', bi: BI, pc: pc1, rsc: 1 }));

  console.log('constants: TAG=%s FT=%s', TAG, FT);
  console.log('POSITIVE (correct payload):', JSON.stringify(summarize(TAG, rPos)));
  console.log('NEGATIVE (garbage payload):', JSON.stringify(summarize(TAG, rNeg)));
  const pos = summarize(TAG, rPos), neg = summarize(TAG, rNeg);
  const proven = pos.state_no && pos.state_appId && !neg.state_no && pos.segments > neg.segments;
  console.log(proven ? '\n✅ PX-success PROVEN: PX decoded our payload (positive rich, negative empty).'
                     : '\n⚠️ inconclusive — re-run (IP throttle?) or re-derive constants.');
})();
