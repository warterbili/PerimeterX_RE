/**
 * PX Anti-tamper checksum 生成器 (动态 key/value 字段)
 *
 * 还原自 main3.js line 6560-6596 ($d 函数) + line 657-661 (te 函数)
 *
 * ═══ 算法 ═══
 *   1. te(str, xorKey): 对字符串每个字符做 charCode ^ xorKey
 *   2. key   = te(state.to, state.no % 10 + 2)
 *   3. value = te(state.to, state.no % 10 + 1)
 *   4. event[key] = value
 *
 * ═══ 输入 ═══
 *   state.to:  String — ob 响应 HUVnQ1sranA= 字段, 20 位数字字符串 (如 "61450031257451364026")
 *   state.no:  Number — ob 响应 N2sNLXEGAx4= 字段, 服务器时间戳 ms (如 1772193280663)
 *
 * ═══ 输出 ═══
 *   { key: String, value: String } — 插入 event.d 的动态字段
 *
 * ═══ 原始实现 (main3.js:657-661) ═══
 *   function te(t, e) {
 *       for (var n = "", r = 0; r < t.length; r++)
 *           n += String.fromCharCode(e ^ t.charCodeAt(r));
 *       return n
 *   }
 *
 * ═══ 原始调用 (main3.js:6586) ═══
 *   t[te(t[S(n)] || t[S(i)], t[S(c)] % 10 + 2)] = te(t[S(n)] || t[S(u)], t[S(s)] % 10 + 1)
 *   其中:
 *     S(550) → HUVnQ1sranA= (state.to)
 *     S(834) → N2sNLXEGAx4= (state.no)
 *
 * ═══ 验证样本 ═══
 *   to=61450031257451364026, no=1772193280663 → key=34105564702104631573, val=25014475613015720462
 *   to=11344390866529290810, no=1772193440633 → key=446116<5=3307<7<5=45, val=557007=4<2216=6=4<54
 *   to=11544856010388826448, no=1772197721603 → key=44011=035456===7311=, val=55100<124547<<<6200<
 *
 * 用法:
 *   const { generateAntiTamper, te } = require('./antitamper')
 *   const { key, value } = generateAntiTamper(stateTo, stateNo)
 *   event.d[key] = value
 */

// ═══ te() — XOR cipher (main3.js line 657-661) ═══

function te(t, e) {
    for (var n = "", r = 0; r < t.length; r++)
        n += String.fromCharCode(e ^ t.charCodeAt(r));
    return n;
}

// ═══ generateAntiTamper — 主入口 ═══

/**
 * 生成 anti-tamper 动态 key/value
 *
 * @param {string} stateTo — ob 响应 state.to (HUVnQ1sranA= 字段, 20 位数字字符串)
 * @param {number} stateNo — ob 响应 state.no (N2sNLXEGAx4= 字段, 服务器时间戳 ms)
 * @returns {{ key: string, value: string }}
 */
function generateAntiTamper(stateTo, stateNo) {
    return {
        key:   te(stateTo, stateNo % 10 + 2),
        value: te(stateTo, stateNo % 10 + 1)
    };
}

module.exports = { generateAntiTamper, te };
