/**
 * Myanmar Encode — 复现 main.js Ju() → Lo(ht(t)) 的 DOM 指纹编码
 *
 * 链路: DOM 标签计数 → ht() JSON 序列化 → ce(str, 4210) XOR → Q() base64
 *
 * captcha iframe 页面 DOM 结构 (PX 模板, 基本固定):
 *   html(1) head(1) meta(3) title(1) style(2) script(4) body(1) div(7) br(1) iframe(2)
 *   来源: <html><head> 3个meta + title </head><body> 2个style + 4个script + 7个div + 1个br + 2个iframe </body></html>
 */

// captcha 页面默认 DOM 标签计数 (PX 模板固定结构)
var CAPTCHA_DOM_TAGS = {
    "html": 1, "head": 1, "meta": 3, "title": 1,
    "style": 2, "script": 4, "body": 1, "div": 7,
    "br": 1, "iframe": 2
};

var XOR_KEY = 4210;

// ht() — 自定义 JSON 序列化 (main1.js:444)
// 对于简单 {string: number} 对象, 等价于 JSON.stringify 但 key 顺序跟随 for...in
function ht(obj) {
    var parts = ["{"];
    var first = true;
    for (var key in obj) {
        if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
            if (!first) parts.push(",");
            parts.push('"' + key + '":' + obj[key]);
            first = false;
        }
    }
    parts.push("}");
    return parts.join("");
}

// ce(t, e) — XOR 编码 (main1.js:762)
function ce(str, key) {
    var out = "";
    for (var i = 0; i < str.length; i++) {
        out += String.fromCharCode(str.charCodeAt(i) ^ key);
    }
    return out;
}

// Q(t) — Unicode-safe base64 (main1.js:226)
// Node.js 等价: Buffer.from(str, 'utf8').toString('base64')
function Q(str) {
    return Buffer.from(str, 'utf8').toString('base64');
}

// Lo(t) = Q(ce(t, No)) — 完整编码 (main1.js:1415, No=4210)
function encode(tagCounts) {
    return Q(ce(ht(tagCounts), XOR_KEY));
}

// 解码 (逆向验证用)
function decode(b64) {
    var decoded = Buffer.from(b64, 'base64').toString('utf8');
    return ce(decoded, XOR_KEY);
}

// 生成 myanmarData (直接调用, 使用 captcha 页面默认 DOM)
function myanmarData(tagCounts) {
    return encode(tagCounts || CAPTCHA_DOM_TAGS);
}

module.exports = { myanmarData, encode, decode, CAPTCHA_DOM_TAGS, XOR_KEY };

if (require.main === module) {
    var result = myanmarData();
    console.log('=== Myanmar Encode ===');
    console.log('DOM tags:', JSON.stringify(CAPTCHA_DOM_TAGS));
    console.log('ht():', ht(CAPTCHA_DOM_TAGS));
    console.log('encoded:', result);
    console.log('length:', result.length);

    // 验证: 解码回原文
    console.log('\n=== 解码验证 ===');
    console.log('decode:', decode(result));

    // 和真实捕获对比
    var real = '4YCJ4YGQ4YCa4YCG4YCf4YCe4YGQ4YGI4YGD4YGe4YGQ4YCa4YCX4YCT4YCW4YGQ4YGI4YGD4YGe4YGQ4YCf4YCX4YCG4YCT4YGQ4YGI4YGB4YGe4YGQ4YCG4YCb4YCG4YCe4YCX4YGQ4YGI4YGD4YGe4YGQ4YCB4YCG4YCL4YCe4YCX4YGQ4YGI4YGA4YGe4YGQ4YCB4YCR4YCA4YCb4YCC4YCG4YGQ4YGI4YGG4YGe4YGQ4YCQ4YCd4YCW4YCL4YGQ4YGI4YGD4YGe4YGQ4YCW4YCb4YCE4YGQ4YGI4YGF4YGe4YGQ4YCQ4YCA4YGQ4YGI4YGD4YGe4YGQ4YCb4YCU4YCA4YCT4YCf4YCX4YGQ4YGI4YGA4YCP';
    console.log('\n=== 真实值对比 ===');
    console.log('match:', result === real);
    console.log('real decode:', decode(real));
}
