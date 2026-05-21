/**
 * PX sid 隐写编码
 *
 * 还原自 main.js line 4365-4381 (lh/hh/dh) + line 4424-4426 (sid 构造)
 *
 * ═══ 输入 ═══
 *   uuid:            String — UUID v1, 来自 Xa()
 *   serverTimestamp:  String — 服务器时间戳, 来自 ni() (ob 响应中解出)
 *
 * ═══ 输出 ═══
 *   String — uuid + Unicode Tag Characters 编码的时间戳
 *            如 "12b6d3c0-dc88-11f0-af79-f50eccdcaab9󠄱󠄷󠄷..." (36 + 13*2 = 62 chars)
 *
 * ═══ 算法 ═══
 *   hh(t): 每个字符 → U+E0100 + charCode (Unicode Tag Characters, Plane 14)
 *   sid = uuid + hh(serverTimestamp)
 *
 *   编码表 (数字):
 *     '0' (0x30) → U+E0130    '5' (0x35) → U+E0135
 *     '1' (0x31) → U+E0131    '6' (0x36) → U+E0136
 *     '2' (0x32) → U+E0132    '7' (0x37) → U+E0137
 *     '3' (0x33) → U+E0133    '8' (0x38) → U+E0138
 *     '4' (0x34) → U+E0134    '9' (0x39) → U+E0139
 *
 * ═══ 原始实现 (main.js:4365-4373) ═══
 *   var lh = "%uDB40%uDD";
 *   function hh(t) {
 *       return (t||"").split("").reduce(function(t,e){
 *           var n = "" + I(e,0).toString(16), r = T(n,2,"0");
 *           return t + unescape(lh + r)     // 拼接 surrogate pair
 *       },"")
 *   }
 *   // 浏览器: unescape("%uDB40%uDD31") → surrogate pair (0xDB40, 0xDD31) → U+E0131
 *
 * 用法:
 *   const generateSid = require('./sid')
 *   const sid = generateSid(uuid, serverTimestamp)
 */

// ═══ hh() — 隐写编码 (main.js:4366-4373) ═══
// 每个字符 → Unicode Tag Character (U+E0100 + charCode)

function hh(t) {
    let result = '';
    for (let i = 0; i < t.length; i++)
        result += String.fromCodePoint(0xE0100 + t.charCodeAt(i));
    return result;
}

// ═══ dh() — 隐写解码 (main.js:4374-4381) ═══

function dh(sid) {
    const uuid = sid.substring(0, 36);
    let timestamp = '';
    for (const ch of sid.substring(36)) {
        const cp = ch.codePointAt(0);
        if (cp >= 0xE0100)
            timestamp += String.fromCharCode(cp - 0xE0100);
    }
    return { uuid, timestamp };
}

// ═══ generateSid — 主入口 ═══

function generateSid(uuid, serverTimestamp) {
    return uuid + hh(String(serverTimestamp));
}

module.exports = generateSid;
module.exports.decodeSid = dh;
