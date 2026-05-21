/**
 * PX 指纹 hash 生成器 (RT0/ewBRNUo= 字段)
 *
 * 还原自 main3.js line 5711-5799
 *
 * ═══ 算法链 ═══
 *   1. ao = Math.floor(parseInt(serverNo) / 1000)  — 服务器时间戳秒
 *   2. vid = visitor ID (_pxvid cookie)
 *   3. 选择 hash 函数:
 *      - Ed() 字符串数组经 rotation 后, gd(112) = "bHFLMw==" → atob → "lqK3" → reverse → "3Kql"
 *      - Gh = "3Kql" 匹配 yd() 函数 (gd(124) = "3Kql")
 *      - 注: 选择器和 hash 函数体随 PX 脚本版本变化
 *   4. yd(): (ao * 2863) / vid.charCodeAt(9)
 *   5. bd(): Kt("" + Math.floor(result)) → 8位 hex
 *
 * ═══ 函数对照 (main3.js 版本) ═══
 *   Sd(t)       → 主入口, 设置 Nh=event, _h=[ao, Xt(), Pa()], 计算 Gh, 调用所有 hash 函数
 *   yd()        → 当前版本匹配的 hash 函数: (i * 2863) / t.charCodeAt(9)
 *   bd(t)       → 写入结果: Nh["RT0/ewBRNUo="] = Kt("" + Math.floor(t))
 *   Kt(t)       → djb2 hash 变体, seed=0 → unsigned 32-bit hex
 *   Xt()        → 返回 vid (main3.js 中变量名为 gt, 通过 wt() 设置)
 *   ao          → Math.floor(parseInt(state.no) / 1e3)
 *
 * ═══ 关键发现 ═══
 *   - gd() 使用 Ed() 小数组 (25元素), 经 rotation 后:
 *     gd(104) = "RT0/ewBRNUo="  (输出字段key)
 *     gd(110) = "floor"          (Math.floor)
 *     gd(112) = "bHFLMw=="       (选择器输入)
 *     gd(123) = "apply"          (Function.apply)
 *     gd(124) = "3Kql"           (匹配 yd)
 *   - 10 个 hash 函数 (sd/ld/fd/hd/dd/vd/pd/Ad/Td/yd), 仅 yd() 匹配当前版本
 *   - Pa() (UUID) 作为参数传入但 yd() 未使用
 *   - 结果仅依赖 ao (服务器时间戳秒) 和 vid.charCodeAt(9)
 *
 * 用法:
 *   const { generateHash, Kt } = require('./hash')
 *   generateHash(serverNo, vid)  // → 8位 hex string
 */

// ═══ Kt() — djb2 hash 变体 (main3.js line 625-635) ═══
// seed Wt = 0 (line 592)
function Kt(t) {
    t = '' + t;
    var e = 0;
    for (var n = 0; n < t.length; n++) {
        e = (e << 5) - e + t.charCodeAt(n);
        e |= 0;  // 保持 32-bit 整数
    }
    // unsigned 转换
    if (e < 0) e += 4294967296;
    return e.toString(16);
}

// ═══ yd() — 当前版本的 hash 函数 (main3.js line 5699-5710) ═══
// function(i, t, c) { return (i * 2863) / t.charCodeAt(9) }
// i = ao, t = vid, c = uuid (未使用)
function hashFunc(ao, vid) {
    return (ao * 2863) / vid.charCodeAt(9);
}

// ═══ bd() — 写入结果 (main3.js line 5711-5716) ═══
// Nh["RT0/ewBRNUo="] = Kt("" + Math.floor(result))

/**
 * 生成 RT0/ewBRNUo= 字段值
 *
 * @param {string|number} serverNo — OB 响应 state.no (服务器时间戳 ms, 如 "1772176017914")
 * @param {string} vid — visitor ID (_pxvid cookie, 如 "44a3b886-1353-11f1-93c8-59c3048eeccc")
 * @returns {string} 8位 hex string (如 "2ebab2fd")
 */
function generateHash(serverNo, vid) {
    var ao = Math.floor(parseInt(serverNo) / 1e3);
    var result = hashFunc(ao, vid);
    return Kt('' + Math.floor(result));
}

module.exports = { generateHash, Kt };
