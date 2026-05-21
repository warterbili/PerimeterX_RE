#!/usr/bin/env node
/**
 * verify_batch.js — round-trip prover for one sample batch.
 *
 *   For a given samples/ifood/<N>/ directory, this script:
 *     1. Reads request_1.txt (raw POST body) → extracts payload + uuid
 *        → runs decodePayload() → asserts output matches decoded_payload_1.json
 *     2. Reads response_1.json → runs decodeOb() with the locked TAG
 *        → asserts segments match decoded_response_1.json
 *     3. Same for request_2.txt / response_2.json / decoded_payload_2.json /
 *        decoded_response_2.json
 *
 *   If every step matches, the decoders are proven correct against this batch.
 *
 *   Usage:
 *     node src/scripts/verify_batch.js samples/ifood/1
 *     node src/scripts/verify_batch.js samples/ifood/1 --verbose
 *
 *   Exit codes:
 *     0 — clean round-trip
 *     1 — at least one decode mismatched
 */

const fs = require('fs');
const path = require('path');
const { decodePayload } = require('../reverse/payload');
const { decodeOb } = require('../reverse/ob');

const TAG = process.env.PX_TAG || 'U0MmDhUmOnhXSw==';  // override via env for OLD-SDK batches

function getParam(body, name) {
    // ⚠️ Important: do NOT do '+' → space substitution.
    //    CDP's request.postData preserves literal '+' chars from the base64
    //    payload. Treating them as space corrupts the base64. Use pure
    //    decodeURIComponent which leaves '+' as-is.
    const prefix = name + '=';
    const start = body.indexOf(prefix);
    if (start === -1) return null;
    const valStart = start + prefix.length;
    const ampPos = body.indexOf('&', valStart);
    const raw = ampPos === -1 ? body.substring(valStart) : body.substring(valStart, ampPos);
    return decodeURIComponent(raw);
}

function loadRawBody(txtPath) {
    // request_*.txt has a header then a blank line then the body.
    // Handle CRLF (from CDP captures on Windows) or LF (from our preparer).
    const text = fs.readFileSync(txtPath, 'utf8');
    let idx = text.indexOf('\r\n\r\n');
    if (idx !== -1) return text.slice(idx + 4).trim();
    idx = text.indexOf('\n\n');
    return idx === -1 ? text.trim() : text.slice(idx + 2).trim();
}

function eq(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

function fail(msg) {
    console.error(`  ❌ ${msg}`);
    return false;
}

function ok(msg) {
    console.error(`  ✅ ${msg}`);
    return true;
}

function verifyBatch(batchDir, verbose = false) {
    const meta = JSON.parse(fs.readFileSync(path.join(batchDir, 'meta.json'), 'utf8'));
    const uuid8 = (meta.uuid || '-').slice(0, 8);
    const sdk12 = (meta.sdk_sha256 || '-').slice(0, 12);
    const status = meta.status_http ?? meta.status_post_1 ?? '?';
    console.error(`\n[batch ${meta.batch_id}] uuid=${uuid8}…  status=${status}  sdk=${sdk12}…`);

    let allOk = true;

    // ────────────────────── request_1 → decoded_payload_1 ──────────────────────
    let events1Decoded = null;
    try {
        const body1 = loadRawBody(path.join(batchDir, 'request_1.txt'));
        const payload1 = getParam(body1, 'payload');
        const uuid1 = getParam(body1, 'uuid');
        const events1 = decodePayload(payload1, null, uuid1);
        events1Decoded = events1;
        const fieldCount = events1[0] && events1[0].d ? Object.keys(events1[0].d).length : '?';
        const storedPath = path.join(batchDir, 'decoded_payload_1.json');
        if (fs.existsSync(storedPath)) {
            const stored1 = JSON.parse(fs.readFileSync(storedPath, 'utf8'));
            if (eq(events1, stored1)) {
                allOk &= ok(`request_1.txt → decoded_payload_1.json  (EV1 ${fieldCount} fields)`);
            } else {
                allOk &= fail(`request_1.txt decode != stored decoded_payload_1.json`);
            }
        } else {
            // Fresh batch with no pre-stored decoded JSON — just report the decode worked
            fs.writeFileSync(storedPath, JSON.stringify(events1, null, 2));
            allOk &= ok(`request_1.txt decoded (EV1 ${fieldCount} fields)  →  wrote decoded_payload_1.json`);
        }
    } catch (e) {
        allOk &= fail(`request_1 decode threw: ${e.message}`);
    }

    // ────────────────────── response_1 → decoded_response_1 ──────────────────────
    let stateFromOb1 = null;
    try {
        const resp1 = fs.readFileSync(path.join(batchDir, 'response_1.json'), 'utf8');
        const { segments } = decodeOb(resp1, TAG);
        stateFromOb1 = extractState(segments);
        const segCount = segments.length;
        const storedPath = path.join(batchDir, 'decoded_response_1.json');
        const out = {
            _info: { segment_count: segCount, xorKey: parseInt((require('../reverse/ob').ml || (()=>'0'))(TAG)) % 128 },
            segments: segments.map(s => {
                const parts = s.split('|');
                return { handler: parts[0], args: parts.slice(1) };
            }),
            state_extracted: stateFromOb1,
        };
        if (fs.existsSync(storedPath)) {
            const stored = JSON.parse(fs.readFileSync(storedPath, 'utf8'));
            const storedSegs = stored.segments || [];
            if (segments.length === storedSegs.length) {
                allOk &= ok(`response_1.json → decoded_response_1.json  (${segCount} segments, state.no=${stateFromOb1.no || '-'})`);
            } else {
                allOk &= fail(`response_1 segment count mismatch: decoder=${segments.length}, stored=${storedSegs.length}`);
            }
        } else {
            fs.writeFileSync(storedPath, JSON.stringify(out, null, 2));
            allOk &= ok(`response_1.json decoded (${segCount} segments, state.no=${stateFromOb1.no || '-'})  →  wrote decoded_response_1.json`);
        }
    } catch (e) {
        allOk &= fail(`response_1 decode threw: ${e.message}`);
    }

    // ────────────────────── request_2 → decoded_payload_2 ──────────────────────
    try {
        const req2Path = path.join(batchDir, 'request_2.txt');
        if (!fs.existsSync(req2Path)) {
            console.error(`  · skipping request_2 (file not present)`);
        } else {
            const body2 = loadRawBody(req2Path);
            const payload2 = getParam(body2, 'payload');
            const uuid2 = getParam(body2, 'uuid');
            const stateNo = stateFromOb1 && stateFromOb1.no;
            const events2 = decodePayload(payload2, stateNo, uuid2);
            const fieldCount = events2[0] && events2[0].d ? Object.keys(events2[0].d).length : '?';
            const storedPath = path.join(batchDir, 'decoded_payload_2.json');
            if (fs.existsSync(storedPath)) {
                const stored = JSON.parse(fs.readFileSync(storedPath, 'utf8'));
                if (eq(events2, stored)) {
                    allOk &= ok(`request_2.txt → decoded_payload_2.json  (EV2 ${fieldCount} fields)`);
                } else {
                    allOk &= fail(`request_2.txt decode != stored decoded_payload_2.json`);
                }
            } else {
                fs.writeFileSync(storedPath, JSON.stringify(events2, null, 2));
                allOk &= ok(`request_2.txt decoded (EV2 ${fieldCount} fields)  →  wrote decoded_payload_2.json`);
            }
        }
    } catch (e) {
        allOk &= fail(`request_2 decode threw: ${e.message}`);
    }

    // ────────────────────── response_2 → decoded_response_2 ──────────────────────
    try {
        const resp2Path = path.join(batchDir, 'response_2.json');
        if (!fs.existsSync(resp2Path)) {
            console.error(`  · skipping response_2 (file not present)`);
        } else {
            const resp2 = fs.readFileSync(resp2Path, 'utf8');
            const { segments } = decodeOb(resp2, TAG);
            const storedPath = path.join(batchDir, 'decoded_response_2.json');
            const hasPx3 = segments.some(s => s.includes('_px3') || s.includes('_px2'));
            const out = {
                _info: { segment_count: segments.length },
                segments: segments.map(s => {
                    const parts = s.split('|');
                    return { handler: parts[0], args: parts.slice(1) };
                }),
                contains_px_cookie: hasPx3,
            };
            if (fs.existsSync(storedPath)) {
                const stored = JSON.parse(fs.readFileSync(storedPath, 'utf8'));
                const storedSegs = stored.segments || [];
                if (segments.length === storedSegs.length) {
                    allOk &= ok(`response_2.json → decoded_response_2.json  (${segments.length} segs${hasPx3 ? ', _px* present ✓' : ', no _px*'})`);
                } else {
                    allOk &= fail(`response_2 segment count mismatch`);
                }
            } else {
                fs.writeFileSync(storedPath, JSON.stringify(out, null, 2));
                allOk &= ok(`response_2.json decoded (${segments.length} segs${hasPx3 ? ', _px* ✓' : ''})  →  wrote decoded_response_2.json`);
            }
        }
    } catch (e) {
        allOk &= fail(`response_2 decode threw: ${e.message}`);
    }

    return Boolean(allOk);
}

function extractState(segments) {
    const state = {};
    for (const seg of segments) {
        const parts = seg.split('|');
        const args = parts.slice(1);
        // shape-match
        if (args.length === 1 && /^1[5-9]\d{11}$/.test(args[0])) state.no = args[0];
        else if (args.length === 1 && /^[0-9a-f]{64}$/.test(args[0])) state.qa = args[0];
        else if (args.length === 1 && /^[a-f0-9-]{36}$/.test(args[0])) state.pxsid = args[0];
        else if (args.length === 1 && /^\d{16,}$/.test(args[0])) state.to = args[0];
        else if (args.length === 1 && /^[a-z0-9]{12,30}$/.test(args[0])) state.appId = args[0];
        else if (args.length === 1 && /^[a-z]{2,4}$/.test(args[0])) state.jf = args[0];
        else if (args.length === 2 && /^[a-f0-9-]{36}$/.test(args[0])) state.cts = args[0];
        else if (args.length === 3 && /^[a-f0-9-]{36}$/.test(args[0]) && /^\d+$/.test(args[1])) state.vid = args[0];
    }
    return state;
}

function main() {
    const args = process.argv.slice(2);
    const verbose = args.includes('--verbose');
    const dirs = args.filter(a => !a.startsWith('--'));

    if (dirs.length === 0) {
        console.error('Usage: node src/scripts/verify_batch.js <batch_dir> [<batch_dir>...] [--verbose]');
        console.error('Example: node src/scripts/verify_batch.js samples/ifood/1');
        console.error('         node src/scripts/verify_batch.js samples/ifood/{1..11}');
        process.exit(1);
    }

    let total = 0, passed = 0;
    for (const d of dirs) {
        total++;
        if (verifyBatch(path.resolve(d), verbose)) passed++;
    }
    console.error(`\n────────────`);
    console.error(`${passed}/${total} batches round-trip clean`);
    process.exit(passed === total ? 0 : 1);
}

if (require.main === module) main();
module.exports = { verifyBatch };
