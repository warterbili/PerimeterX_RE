// 从新 SDK main.js 抽出 hM 解码器 + hP 数组，输出完整 N → 字符串映射
//
// 用法: node extract_hQ.js <SDK路径> [输出JSON路径]
//   SDK路径:  PX 客户端 main.js / main.min.js
//   输出路径: 默认 ./hQ_map.json (相对 cwd)
const fs = require('fs');
const path = require('path');

const sdkPath = process.argv[2];
const outPath = process.argv[3] || path.resolve(process.cwd(), 'hQ_map.json');
if (!sdkPath) {
    console.error('用法: node extract_hQ.js <SDK路径> [输出JSON路径]');
    process.exit(1);
}
const sdk = fs.readFileSync(sdkPath, 'utf-8');

// hM 解码器（line 83-102）— 把 PX 自定义 base91-ish 编码解成 bytes，再 utf8 解
function hM(t) {
    var n = "" + (t || ""), e = n.length, r = [], h = 0, i = 0, o = -1, c = 0;
    for (; c < e; c++) {
        var a = 'F@bt;"m:x3&#LiZ[)TE/}%QD1Iu.6f0R]78|4{zvWC>`$Se(rJ=*c^2_?qOpB,d<AVy~YwoP!+9g5nXhUsNGjaMKHlk'.indexOf(n[c]);
        if (a !== -1) {
            if (o < 0) {
                o = a;
            } else {
                h |= (o += 91 * a) << i;
                i += (8191 & o) > 88 ? 13 : 14;
                do {
                    r.push(255 & h);
                    h >>= 8;
                    i -= 8;
                } while (i > 7);
                o = -1;
            }
        }
    }
    if (o > -1) r.push(255 & (h | (o << i)));
    return Buffer.from(r).toString('utf-8');
}

// 提取 hP 数组字面量 (line 29 起，一个超长 inline)
// 通过 marker 切片: `, hP = [` 开始，匹配到对应的 `]` 结束
const start = sdk.indexOf(', hP = [');
if (start < 0) { console.error('hP not found'); process.exit(1); }
let depth = 0, inStr = false, strCh = '', i = start;
// 跳到 [
i = sdk.indexOf('[', start);
const arrStart = i;
i++;
depth = 1;
while (i < sdk.length && depth > 0) {
    const c = sdk[i];
    if (inStr) {
        if (c === '\\' && i+1 < sdk.length) { i += 2; continue; }
        if (c === strCh) inStr = false;
        i++; continue;
    }
    if (c === '"' || c === "'") { inStr = true; strCh = c; i++; continue; }
    if (c === '[') depth++;
    else if (c === ']') depth--;
    i++;
}
const arrEnd = i;
const arrLit = sdk.slice(arrStart, arrEnd);

// 用 eval 解析数组字面量
let hP;
try { hP = eval(arrLit); } catch (e) { console.error('eval failed:', e.message); process.exit(1); }
console.log(`hP array length: ${hP.length}`);

// 解码每个元素
const map = {};
for (let n = 0; n < hP.length; n++) {
    try {
        map[n] = hM(hP[n]);
    } catch (e) {
        map[n] = `<decode err: ${e.message}>`;
    }
}

// 输出到 JSON
fs.writeFileSync(outPath, JSON.stringify(map, null, 2));
console.log('saved', outPath);

// 找出所有 base64-like 的条目（=结尾，A-Za-z0-9+/）
const b64keys = [];
for (const [n, v] of Object.entries(map)) {
    if (/^[A-Za-z0-9+/]+={0,2}$/.test(v) && v.length >= 8 && v.endsWith('=')) {
        b64keys.push({n: +n, key: v});
    }
}
console.log(`\nbase64-like entries: ${b64keys.length}`);
console.log('sample first 30:');
for (const {n, key} of b64keys.slice(0, 30)) {
    console.log(`  hQ(${n}) = "${key}"`);
}
