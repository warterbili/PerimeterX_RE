#!/usr/bin/env node
/**
 * PX payload 解码脚本
 *
 * 从 request/ 下的 curl 文件中提取 payload 并解码为 JSON
 * 支持 Windows cmd (^转义) 和 Unix bash (\转义) 两种 curl 格式
 *
 * 用法:
 *   node script/decode_payload.js <curl文件> [服务器时间戳] [输出文件名]
 *
 * 示例:
 *   node script/decode_payload.js request/bundle#1.txt
 *   node script/decode_payload.js request/bundle#2.txt 1771962830422
 *   node script/decode_payload.js request/bundle#1.txt default bundle1
 *
 * 参数:
 *   curl文件       — 必填, 支持绝对/相对路径 (相对于项目根目录)
 *   服务器时间戳   — 可选, 不填或 "default" 使用默认值 "1604064986000"
 *   输出文件名     — 可选, 不含 .json 后缀, 不填则交互式确认
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { decodePayload, DEFAULT_TIMESTAMP } = require('../reverse/payload');

const ROOT = path.resolve(__dirname, '..');
const JSON_DIR = path.join(ROOT, 'event_json');

// ═══ 从 raw body 中手动提取参数 (不用 URLSearchParams, 保留 +) ═══
function getParam(body, name) {
    const prefix = name + '=';
    const start = body.indexOf(prefix);
    if (start === -1) return null;
    const valStart = start + prefix.length;
    const ampPos = body.indexOf('&', valStart);
    return ampPos === -1 ? body.substring(valStart) : body.substring(valStart, ampPos);
}

// ═══ 解析 curl 文件, 提取 POST body ═══
function extractBody(content) {
    // Windows cmd 格式: --data-raw ^"...^"
    let m = content.match(/--data-raw\s+\^"([\s\S]+?)\^"\s*$/m);
    if (m) {
        // 去 Windows cmd ^ 转义, 去换行续行
        return m[1].replace(/\^\n\s*/g, '').replace(/\^(.)/g, '$1');
    }
    // Unix bash 格式: --data-raw '...' 或 --data-raw "..."
    m = content.match(/--data-raw\s+['"](.+?)['"]\s*$/ms);
    if (m) return m[1];
    // 兜底: 直接找 payload= 开头
    m = content.match(/(payload=[A-Za-z0-9+/=%&;]+)/);
    if (m) return m[1];
    return null;
}

// ═══ 交互式输入 ═══
function ask(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

// ═══ main ═══
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.error('用法: node script/decode_payload.js <curl文件> [服务器时间戳] [输出文件名]');
        console.error('示例: node script/decode_payload.js request/bundle#1.txt');
        console.error('      node script/decode_payload.js request/bundle#2.txt 1771962830422');
        console.error('      node script/decode_payload.js request/bundle#2.txt 1771962830422 bundle2');
        process.exit(1);
    }

    // 1. 解析 curl 文件路径
    let curlPath = args[0];
    if (!path.isAbsolute(curlPath)) curlPath = path.resolve(ROOT, curlPath);
    if (!fs.existsSync(curlPath)) {
        console.error('文件不存在:', curlPath);
        process.exit(1);
    }

    // 2. 解析服务器时间戳
    let ts = args[1];
    if (!ts || ts === 'default' || ts === '0') ts = null;
    const tsDisplay = ts || DEFAULT_TIMESTAMP + ' (默认)';

    // 3. 读取 curl 文件, 提取 body
    const content = fs.readFileSync(curlPath, 'utf8');
    const body = extractBody(content);
    if (!body) {
        console.error('无法从 curl 文件中提取 POST body');
        process.exit(1);
    }

    const payload = getParam(body, 'payload');
    const uuid = getParam(body, 'uuid');
    if (!payload) { console.error('找不到 payload 参数'); process.exit(1); }
    if (!uuid) { console.error('找不到 uuid 参数'); process.exit(1); }

    console.error('─── 解码信息 ───');
    console.error('源文件:     ', path.basename(curlPath));
    console.error('uuid:       ', uuid);
    console.error('payload 长度:', payload.length);
    console.error('服务器时间戳:', tsDisplay);

    // 4. 解码
    let events;
    try {
        events = decodePayload(payload, ts, uuid);
    } catch (e) {
        console.error('解码失败:', e.message);
        process.exit(1);
    }

    const fieldCount = events[0] && events[0].d ? Object.keys(events[0].d).length : '?';
    console.error('事件类型:   ', events[0] && events[0].t);
    console.error('字段数:     ', fieldCount);

    // 5. 确定输出文件名
    let outName = args[2];
    if (!outName) {
        // 默认用源文件名
        const base = path.basename(curlPath, path.extname(curlPath));
        const suggestion = base;
        outName = await ask(`输出文件名 (不含.json, 直接回车=${suggestion}): `);
        if (!outName) outName = suggestion;
    }
    if (!outName.endsWith('.json')) outName += '.json';

    const outPath = path.join(JSON_DIR, outName);
    if (!fs.existsSync(JSON_DIR)) fs.mkdirSync(JSON_DIR, { recursive: true });

    // 6. 写入
    const jsonStr = JSON.stringify(events, null, 2);
    fs.writeFileSync(outPath, jsonStr, 'utf8');
    console.error('─── 完成 ───');
    console.error('写入:', outPath);
    console.error('大小:', jsonStr.length, 'bytes');
}

main().catch(e => { console.error(e); process.exit(1); });
