/**
 * PX UUID v1 生成器
 *
 * 还原自 main.js line 1257-1349
 * PX 使用 UUID v1 (时间戳 + 随机节点), 不是 v4
 *
 * 函数对照:
 *   Gr() → getRandomBytes    随机字节生成
 *   Lr[] → byteToHex         byte→hex 查找表
 *   Qr() → formatUUID        16 字节 → UUID 字符串
 *   ta() → uuidV1            UUID v1 核心算法
 *   Xa() → getUUID           带缓存的获取入口
 *
 * 用法:
 *   const { uuidV1, getUUID } = require('./uuid')
 *   uuidV1()   // 每次生成新 UUID
 *   getUUID()  // 单例, 首次生成后缓存
 */

const crypto = require('crypto');

// ═══ Gr() — 随机字节生成 (main.js:1261-1281) ═══
function getRandomBytes() {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    return buf;
}

// ═══ Lr[] — byte→hex 查找表 (main.js:1282-1283) ═══
const byteToHex = [];
for (let i = 0; i < 256; i++)
    byteToHex[i] = (i + 256).toString(16).substr(1);

// ═══ Qr() — 16字节 → UUID 字符串 (main.js:1284-1288) ═══
function formatUUID(bytes, offset) {
    const n = offset || 0;
    const r = byteToHex;
    return r[bytes[n]]     + r[bytes[n + 1]]  + r[bytes[n + 2]]  + r[bytes[n + 3]] + '-'
         + r[bytes[n + 4]] + r[bytes[n + 5]]  + '-'
         + r[bytes[n + 6]] + r[bytes[n + 7]]  + '-'
         + r[bytes[n + 8]] + r[bytes[n + 9]]  + '-'
         + r[bytes[n + 10]] + r[bytes[n + 11]] + r[bytes[n + 12]]
         + r[bytes[n + 13]] + r[bytes[n + 14]] + r[bytes[n + 15]];
}

// ═══ 初始化状态 (main.js:1289-1293) ═══
// Jr = Gr() — 初始随机字节
const initRandom = getRandomBytes();
// zr = node — 6字节随机节点 (首字节 OR 1 = multicast bit)
const node = [1 | initRandom[0], initRandom[1], initRandom[2],
              initRandom[3], initRandom[4], initRandom[5]];
// Kr = clockseq — 14位随机时钟序列
let clockseq = 16383 & (initRandom[6] << 8 | initRandom[7]);
// qr = lastMsecs, $r = lastNsecs
let lastMsecs = 0;
let lastNsecs = 0;

// ═══ ta() → uuidV1 — UUID v1 核心 (main.js:1294-1331) ═══
function uuidV1(options) {
    options = options || {};

    const buf = [];
    let idx = 0;

    let s = options.clockseq !== undefined ? options.clockseq : clockseq;
    // Ot() = +new Date (main.js:547)
    let msecs = options.msecs !== undefined ? options.msecs : +new Date;
    let nsecs = options.nsecs !== undefined ? options.nsecs : lastNsecs + 1;

    const dt = msecs - lastMsecs + (nsecs - lastNsecs) / 1e4;

    if (dt < 0 && options.clockseq === undefined)
        s = s + 1 & 16383;
    if ((dt < 0 || msecs > lastMsecs) && options.nsecs === undefined)
        nsecs = 0;
    if (nsecs >= 1e4)
        throw new Error("uuid.v1(): Can't create more than 10M uuids/sec");

    lastMsecs = msecs;
    lastNsecs = nsecs;
    clockseq = s;

    // 时间戳: 自 1582-10-15 以来的 100ns 间隔
    // 122192928e5 = 0x01B21DD213814000 (格里高利历偏移)
    msecs += 122192928e5;

    // time_low (4 bytes)
    const timeLow = (1e4 * (268435455 & msecs) + nsecs) % 4294967296;
    buf[idx++] = timeLow >>> 24 & 255;
    buf[idx++] = timeLow >>> 16 & 255;
    buf[idx++] = timeLow >>> 8 & 255;
    buf[idx++] = 255 & timeLow;

    // time_mid (2 bytes)
    const timeMid = msecs / 4294967296 * 1e4 & 268435455;
    buf[idx++] = timeMid >>> 8 & 255;
    buf[idx++] = 255 & timeMid;

    // time_hi_and_version (2 bytes) — version=1 (0x1x)
    buf[idx++] = timeMid >>> 24 & 15 | 16;
    buf[idx++] = timeMid >>> 16 & 255;

    // clock_seq_hi_and_reserved (1 byte) — variant=10x
    buf[idx++] = s >>> 8 | 128;
    // clock_seq_low (1 byte)
    buf[idx++] = 255 & s;

    // node (6 bytes)
    const n = options.node || node;
    for (let m = 0; m < 6; m++)
        buf[idx + m] = n[m];

    return formatUUID(buf);
}

// ═══ Xa() → getUUID — 带缓存的入口 (main.js:1343-1349) ═══
let cachedUUID = null;

function getUUID() {
    if (!cachedUUID)
        cachedUUID = uuidV1();
    return cachedUUID;
}

function resetUUID() {
    cachedUUID = null;
}

function setUUID(uuid) {
    cachedUUID = uuid;
}

module.exports = { uuidV1, getUUID, resetUUID, setUUID, formatUUID, getRandomBytes };
