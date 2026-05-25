#!/usr/bin/env node
/**
 * Decode all 6 batches of totalwine collector POSTs to JSON.
 * For each batch N:
 *   - request_1.txt → decoded_payload_1.json (EV1)
 *   - request_2.txt → decoded_payload_2.json (EV2)
 *   - response_2.json → decoded_response_2.json (OB segments)
 */
const fs = require('fs');
const path = require('path');
const { decodePayload } = require('../../../revers/payload');
const processOb = require('../../../revers/ob');

const ROOT = path.resolve(__dirname, '..');     // tmp/totalwine
const SAMPLES = path.join(ROOT, 'sample');

function getParam(body, name) {
    const prefix = name + '=';
    const start = body.indexOf(prefix);
    if (start === -1) return null;
    const valStart = start + prefix.length;
    const ampPos = body.indexOf('&', valStart);
    return ampPos === -1 ? body.substring(valStart) : body.substring(valStart, ampPos);
}

function extractBody(content) {
    // Tolerate \r\n and \n line endings; first blank line separates headers from body.
    let idx = content.indexOf('\r\n\r\n');
    let sep = 4;
    if (idx === -1) { idx = content.indexOf('\n\n'); sep = 2; }
    if (idx === -1) return null;
    return content.substring(idx + sep).trim();
}

function decodeOne(reqFile, ts = null) {
    const body = extractBody(fs.readFileSync(reqFile, 'utf8'));
    if (!body) throw new Error('no body in ' + reqFile);
    const payload = decodeURIComponent(getParam(body, 'payload') || '');
    const uuid = decodeURIComponent(getParam(body, 'uuid') || '');
    const events = decodePayload(payload, ts, uuid);
    return { events, uuid, tag: getParam(body, 'tag'), pc: getParam(body, 'pc'), seq: getParam(body, 'seq'), en: getParam(body, 'en') };
}

function decodeObSegments(responseJsonPath) {
    const raw = fs.readFileSync(responseJsonPath, 'utf8').trim();
    if (!raw) return null;
    // processOb expects the WHOLE response JSON string + gt (TAG)
    const TAG = 'CFQ7WU4xIS8MXA==';   // totalwine
    return processOb(raw, TAG);
}

const batches = [1, 2, 3, 4, 5, 6];
let summary = [];
for (const b of batches) {
    const dir = path.join(SAMPLES, String(b));
    if (!fs.existsSync(dir)) continue;

    const out = {};
    for (const i of [1, 2, 3]) {
        const rq = path.join(dir, `request_${i}.txt`);
        if (!fs.existsSync(rq)) continue;
        try {
            const dec = decodeOne(rq);
            fs.writeFileSync(path.join(dir, `decoded_payload_${i}.json`),
                JSON.stringify(dec.events, null, 2));
            out[`payload_${i}`] = {
                seq: dec.seq, en: dec.en,
                t: dec.events?.[0]?.t,
                fieldCount: dec.events?.[0]?.d ? Object.keys(dec.events[0].d).length : 0,
            };
        } catch (e) {
            out[`payload_${i}_error`] = e.message;
        }

        const rs = path.join(dir, `response_${i}.json`);
        if (fs.existsSync(rs)) {
            try {
                const obDec = decodeObSegments(rs);
                if (obDec) {
                    fs.writeFileSync(path.join(dir, `decoded_response_${i}.json`),
                        JSON.stringify(obDec, null, 2));
                    out[`response_${i}`] = {
                        state_keys: Object.keys(obDec.state || {}),
                        segments: (obDec.segments || []).length,
                    };
                }
            } catch (e) {
                out[`response_${i}_error`] = e.message;
            }
        }
    }
    summary.push({ batch: b, ...out });
}

console.log(JSON.stringify(summary, null, 2));
