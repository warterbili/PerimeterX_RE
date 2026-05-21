/**
 * PX Captcha WASM Runner
 *
 * 复现 captcha.js 中的 Ys.a() 和 Ys.b(Es) 调用
 * imports 严格匹配 captcha.js 行为 (captcha.js:8333-8566)
 *
 * 字段映射:
 *   a() → AE0zBkUsPjQ= (~100 hex, 含 UUID 片段, 非确定性)
 *   b(Es) → MD1DNnVfRgQ= (~127 chars, ChaCha20 编码, 确定性)
 *
 * 关键差异修正 (vs 旧版):
 *   - __wbg_get: undefined 返回 0 (不是 heapRef)
 *   - __wbg_newnoargs: throw Error (不是 new Function)
 *   - __wbg_require: 包在 handleError 中
 *   - a()/b() wrapper: 读 4 个 int32 含错误处理
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { TextEncoder, TextDecoder } = require('util');

// ─── 伪造浏览器全局环境 ───
globalThis.self = globalThis;
globalThis.window = globalThis;
globalThis.crypto = crypto.webcrypto || {
    getRandomValues(arr) { crypto.randomFillSync(arr); return arr; }
};

// ─── Object reference slab (wasm-bindgen standard) ───
const heap = new Array(128).fill(undefined);
heap.push(undefined, null, true, false);
let heap_next = heap.length;

function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];
    heap[idx] = obj;
    return idx;
}
function getObject(idx) { return heap[idx]; }
function dropObject(idx) { if (idx < 132) return; heap[idx] = heap_next; heap_next = idx; }
function takeObject(idx) { const ret = getObject(idx); dropObject(idx); return ret; }

// ─── Memory views ───
let cachedUint8Memory0 = null;
let cachedInt32Memory0 = null;

function getUint8Memory0() {
    if (cachedUint8Memory0 === null || cachedUint8Memory0.byteLength === 0)
        cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);
    return cachedUint8Memory0;
}
function getInt32Memory0() {
    if (cachedInt32Memory0 === null || cachedInt32Memory0.byteLength === 0)
        cachedInt32Memory0 = new Int32Array(wasm.memory.buffer);
    return cachedInt32Memory0;
}

// ─── String helpers ───
const textEncoder = new TextEncoder('utf-8');
const textDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
let WASM_VECTOR_LEN = 0;

function passStringToWasm0(arg, malloc, realloc) {
    const buf = textEncoder.encode(arg);
    const ptr = malloc(buf.length, 1) >>> 0;
    getUint8Memory0().subarray(ptr, ptr + buf.length).set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr;
}
function getStringFromWasm0(ptr, len) {
    return textDecoder.decode(getUint8Memory0().subarray(ptr >>> 0, (ptr >>> 0) + len));
}

// ─── Error handler ───
let wasm;
function handleError(f, args) {
    try { return f.apply(null, args); }
    catch (e) { wasm.__wbindgen_exn_store(addHeapObject(e)); }
}

// ─── wbg imports (严格匹配 captcha.js:8333-8566) ───
const imports = { wbg: {
    __wbindgen_string_get(arg0, arg1) {
        const obj = getObject(arg1);
        const ret = typeof obj === 'string' ? obj : undefined;
        const ptr1 = typeof ret === 'undefined' ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getInt32Memory0()[arg0 / 4 + 1] = len1;
        getInt32Memory0()[arg0 / 4 + 0] = ptr1;
    },
    __wbindgen_object_drop_ref(arg0) { takeObject(arg0); },
    __wbindgen_string_new(arg0, arg1) { return addHeapObject(getStringFromWasm0(arg0, arg1)); },

    // captcha.js:8361-8368 — try/catch instanceof Window
    __wbg_instanceof_Window_e266f02eee43b570(arg0) {
        var n;
        try { n = getObject(arg0) instanceof Object; }
        catch (e) { n = false; }
        return n;
    },

    // captcha.js:8371-8374 — undefined 返回 0
    __wbg_get_e6ae480a4b8df368(arg0, arg1, arg2) {
        const obj = getObject(arg0);
        const key = getStringFromWasm0(arg1, arg2);
        const val = obj[key];
        return typeof val === 'undefined' ? 0 : addHeapObject(val);
    },

    __wbg_crypto_c48a774b022d20ac(arg0) { return addHeapObject(getObject(arg0).crypto); },
    __wbindgen_is_object(arg0) { const v = getObject(arg0); return typeof v === 'object' && v !== null ? 1 : 0; },
    __wbg_process_298734cf255a885d(arg0) { return addHeapObject(getObject(arg0).process); },
    __wbg_versions_e2e78e134e3e5d01(arg0) { return addHeapObject(getObject(arg0).versions); },
    __wbg_node_1cd7a5d853dbea79(arg0) { return addHeapObject(getObject(arg0).node); },
    __wbindgen_is_string(arg0) { return typeof getObject(arg0) === 'string' ? 1 : 0; },

    // captcha.js:8413-8421 — 包在 handleError 中
    __wbg_require_8f08ceecec0f4fee() {
        return handleError(function() { return addHeapObject(module.require); }, arguments);
    },

    __wbg_msCrypto_bcb970640f50a1e8(arg0) { return addHeapObject(getObject(arg0).msCrypto); },
    __wbg_getRandomValues_37fa2ca9e4e07fab(arg0, arg1) { getObject(arg0).getRandomValues(getObject(arg1)); },
    __wbg_randomFillSync_dc1e9a60c158336d(arg0, arg1) { getObject(arg0).randomFillSync(getObject(arg1)); },
    __wbindgen_is_function(arg0) { return typeof getObject(arg0) === 'function' ? 1 : 0; },

    // captcha.js:8453-8455 — throw Error (不执行 new Function)
    __wbg_newnoargs_2b8b6bd7753c76ba(arg0, arg1) {
        throw new Error("newnoargs blocked");
    },

    __wbg_call_95d1ea488d03e4e8() {
        return handleError(function(arg0, arg1) {
            return addHeapObject(getObject(arg0).call(getObject(arg1)));
        }, arguments);
    },
    __wbg_new_f9876326328f45ed() { return addHeapObject(new Object()); },
    __wbg_self_e7c1f827057f6584() { return handleError(function() { return addHeapObject(self); }, arguments); },
    __wbg_window_a09ec664e14b1b81() { return handleError(function() { return addHeapObject(window); }, arguments); },
    __wbg_globalThis_87cbb8506fecf3a9() { return handleError(function() { return addHeapObject(globalThis); }, arguments); },
    __wbg_global_c85a9259e621f3db() { return handleError(function() { return addHeapObject(global); }, arguments); },
    __wbindgen_is_undefined(arg0) { return getObject(arg0) === undefined ? 1 : 0; },
    __wbg_call_9495de66fdbe016b() {
        return handleError(function(arg0, arg1, arg2) {
            return addHeapObject(getObject(arg0).call(getObject(arg1), getObject(arg2)));
        }, arguments);
    },
    __wbg_buffer_cf65c07de34b9a08(arg0) { return addHeapObject(getObject(arg0).buffer); },
    __wbg_newwithbyteoffsetandlength_9fb2f11355ecadf5(arg0, arg1, arg2) {
        return addHeapObject(new Uint8Array(getObject(arg0), arg1 >>> 0, arg2 >>> 0));
    },
    __wbg_new_537b7341ce90bb31(arg0) { return addHeapObject(new Uint8Array(getObject(arg0))); },
    __wbg_set_17499e8aa4003ebd(arg0, arg1, arg2) { getObject(arg0).set(getObject(arg1), arg2 >>> 0); },
    __wbg_newwithlength_b56c882b57805732(arg0) { return addHeapObject(new Uint8Array(arg0 >>> 0)); },
    __wbg_subarray_7526649b91a252a6(arg0, arg1, arg2) { return addHeapObject(getObject(arg0).subarray(arg1 >>> 0, arg2 >>> 0)); },
    __wbindgen_object_clone_ref(arg0) { return addHeapObject(getObject(arg0)); },
    __wbindgen_throw(arg0, arg1) { throw new Error(getStringFromWasm0(arg0, arg1)); },
    __wbindgen_memory() { return addHeapObject(wasm.memory); },
}};

// ─── Exported wrapper functions (匹配 captcha.js:8624-8674, 读 4 个 int32) ───

// Ys.a() → AE0zBkUsPjQ= (hex, ~100 chars, 含 UUID 片段)
function wasmA() {
    var o, q;
    try {
        var retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        wasm.a(retptr);
        var e = getInt32Memory0()[retptr / 4 + 0];
        var f = getInt32Memory0()[retptr / 4 + 1];
        var s = getInt32Memory0()[retptr / 4 + 2];
        var m = getInt32Memory0()[retptr / 4 + 3];
        o = e; q = f;
        if (m) { o = 0; q = 0; throw takeObject(s); }
        return getStringFromWasm0(o, q);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_free(o, q);
    }
}

// Ys.b(input) → MD1DNnVfRgQ= (~127 chars, ChaCha20 编码)
function wasmB(input) {
    var o, q;
    try {
        var retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        var ptr0 = passStringToWasm0(input, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        wasm.b(retptr, ptr0, len0);
        var e = getInt32Memory0()[retptr / 4 + 0];
        var f = getInt32Memory0()[retptr / 4 + 1];
        var s = getInt32Memory0()[retptr / 4 + 2];
        var m = getInt32Memory0()[retptr / 4 + 3];
        o = e; q = f;
        if (m) { o = 0; q = 0; throw takeObject(s); }
        return getStringFromWasm0(o, q);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_free(o, q);
    }
}

// ─── 导出为模块 ───
let wasmInstance = null;

async function initWasm(pxUuid) {
    if (pxUuid) globalThis._pxUuid = pxUuid;
    const wasmPath = path.join(__dirname, 'px_captcha.wasm');
    const wasmBuf = fs.readFileSync(wasmPath);
    const instance = await WebAssembly.instantiate(wasmBuf, imports);
    wasm = instance.instance.exports;
    wasmInstance = instance;
    return { a: wasmA, b: wasmB };
}

module.exports = { initWasm, wasmA, wasmB };

// ─── CLI 模式 ───
if (require.main === module) {
    (async () => {
        const uuid = process.argv[2] || '11111111-1111-1111-1111-111111111111';
        const es = process.argv[3] || 'a2c115a9dcd443927dd5cf7270f7b840d9fda4d520491b40d1b36bb2a3c602d8';

        console.log('[*] Loading WASM...');
        console.log('[*] _pxUuid:', uuid);
        const { a, b } = await initWasm(uuid);
        console.log('[*] WASM ready!\n');

        console.log('=== Ys.a() → AE0zBkUsPjQ= ===');
        const resultA = a();
        console.log('Result:', resultA);
        console.log('Length:', resultA.length);

        console.log('\n=== Ys.b(Es) → MD1DNnVfRgQ= ===');
        console.log('Input Es:', es);
        const resultB = b(es);
        console.log('Result:', resultB);
        console.log('Length:', resultB.length);

        // 验证多次调用
        console.log('\n=== 稳定性测试 (5次 a + b) ===');
        for (let i = 0; i < 5; i++) {
            const ra = a();
            const rb = b(es);
            console.log(`[${i+1}] a.len=${ra.length} b.len=${rb.length} b=${rb.substring(0,40)}...`);
        }
    })().catch(e => console.error('Fatal:', e));
}
