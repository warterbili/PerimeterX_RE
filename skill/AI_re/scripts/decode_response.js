#!/usr/bin/env node
/**
 * PX ob 响应解码脚本
 *
 * 从 responce/ 下的 JSON 文件中提取 ob 字段并解码, 输出 handler 执行结果
 *
 * 用法:
 *   node script/decode_ob.js <gt值> <响应JSON文件> [输出文件名]
 *
 * 示例:
 *   node script/decode_ob.js "DXJ9dEscZAAJeA==" responce/bundle#1.json
 *   node script/decode_ob.js "DXJ9dEscZAAJeA==" responce/bundle#2.json bundle2_ob
 *
 * 参数:
 *   gt值         — 必填! XOR 种子, 硬编码在 PX 主脚本 (main.min.js) 中
 *                   在 main.min.js 中全局搜索 "gt" 即可找到, 是一个 base64 字符串
 *                   如 "DXJ9dEscZAAJeA==", "DhY8E0h7J2cKHw==" 等
 *                   每次 PX 脚本版本更新后 gt 值会变化!
 *   响应JSON文件 — 必填, 含 .ob 或 .do 字段的 JSON
 *   输出文件名   — 可选, 不含 .json 后缀, 不填则交互式确认
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const processOb = require('../reverse/ob');
const { ml, buildSid, getParams } = processOb;

const ROOT = path.resolve(__dirname, '..');
const RESULT_DIR = path.join(ROOT, 'responce_result');

// ═══ 交互式输入 ═══
function ask(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

// ═══ 格式化输出 ═══
function formatResults(data) {
    const { xorKey, segments, results, state } = data;
    const output = {
        _info: {
            xorKey,
            segmentCount: segments.length,
            handlerCount: results.length,
        },
        state,
        params: getParams(state),
        segments: segments.map((seg, i) => {
            const r = results.find((_, j) => j === i) || results[i];
            return {
                index: i,
                raw: seg.length > 200 ? seg.substring(0, 200) + '...' : seg,
                ...(r || {})
            };
        }),
    };

    // sid 隐写
    const sid = buildSid(state);
    if (sid) output.params.sid_visible = sid.replace(/[^\x20-\x7e]/g, '');

    return output;
}

// ═══ main ═══
async function main() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.error('用法: node script/decode_ob.js <gt值> <响应JSON文件> [输出文件名]');
        console.error('');
        console.error('gt值: 硬编码在 PX 主脚本 main.min.js 中, 全局搜索 "gt" 找到的 base64 字符串');
        console.error('      每次 PX 脚本版本更新后会变化!');
        console.error('');
        console.error('示例: node script/decode_ob.js "DXJ9dEscZAAJeA==" responce/bundle#1.json');
        console.error('      node script/decode_ob.js "DXJ9dEscZAAJeA==" responce/bundle#2.json bundle2_ob');
        process.exit(1);
    }

    // 1. gt 值 (必填)
    const gt = args[0];

    // 2. 解析文件路径
    let filePath = args[1];
    if (!path.isAbsolute(filePath)) filePath = path.resolve(ROOT, filePath);
    if (!fs.existsSync(filePath)) {
        console.error('文件不存在:', filePath);
        process.exit(1);
    }

    // 3. 读取 JSON
    const content = fs.readFileSync(filePath, 'utf8');
    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch (e) {
        console.error('JSON 解析失败:', e.message);
        process.exit(1);
    }

    const xorKey = parseInt(ml(gt), 10) % 128;
    console.error('─── 解码信息 ───');
    console.error('源文件:', path.basename(filePath));
    console.error('gt:    ', gt);
    console.error('XOR key:', xorKey);

    // 4. 解码 + 执行 handlers
    const data = processOb(parsed, gt);

    console.error('段数:  ', data.segments.length);
    console.error('─── Handler 结果 ───');
    for (const r of data.results) {
        const type = r.handlerType || 'unknown';
        const detail = r.result ? JSON.stringify(r.result).substring(0, 80) : '';
        console.error(`  [${type}] ${r.handler} → ${detail || '(state updated)'}`);
    }

    // 5. state 摘要
    console.error('─── State ───');
    if (data.state.no) console.error('  no (服务器时间戳):', data.state.no);
    if (data.state.qa) console.error('  qa (cs hash):     ', data.state.qa.substring(0, 20) + '...');
    if (data.state.ao) console.error('  ao (status):      ', data.state.ao);
    if (data.state.jf) console.error('  jf (control):     ', data.state.jf);
    if (data.state.vid) console.error('  vid:              ', data.state.vid);
    if (data.state.cts) console.error('  cts:              ', data.state.cts);
    if (data.state.pxsid) console.error('  pxsid:           ', data.state.pxsid);
    if (data.state.px3) console.error('  _px3 cookie:      ', data.state.px3.value.substring(0, 30) + '...');

    // 6. 确定输出文件名 (必须由用户指定)
    let outName = args[2];
    while (!outName) {
        outName = await ask('输出文件名 (不含.json, 必填): ');
    }
    if (!outName.endsWith('.json')) outName += '.json';

    const outPath = path.join(RESULT_DIR, outName);
    if (!fs.existsSync(RESULT_DIR)) fs.mkdirSync(RESULT_DIR, { recursive: true });

    // 7. 写入
    const output = formatResults(data);
    const jsonStr = JSON.stringify(output, null, 2);
    fs.writeFileSync(outPath, jsonStr, 'utf8');
    console.error('─── 完成 ───');
    console.error('写入:', outPath);
}

main().catch(e => { console.error(e); process.exit(1); });
