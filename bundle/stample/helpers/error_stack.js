// error_stack.js — PX Error Stack 模板生成
//
// Fr() 故意 null[0] 触发 TypeError, 抓 Error.stack
// 行号/列号固定于当前 main.min.js + captcha.js 版本
// 4 种 stack 对应 bundle#3 不同 event 的不同调用链

var MAIN = 'https://client.px-cloud.net/PXO1GDTa7Q/main.min.js';
var ERR = "TypeError: Cannot read properties of null (reading '0')";

function captchaUrl(uuid, vid) {
    return 'https://captcha.px-cdn.net/PXO1GDTa7Q/captcha.js?a=c&m=0&u=' + uuid + '&v=' + vid;
}

// Event #0 (Bh02XENxM2Y=) — 空格分隔, 4帧, main.min.js 指纹采集阶段
// ie() 处理: \n → 空格, 去掉 []()
function stackA() {
    return ERR +
        ' at Fr (' + MAIN + ':2:21510)' +
        ' at func (' + MAIN + ':2:143646)' +
        ' at ne (' + MAIN + ':2:13244)' +
        ' at ' + MAIN + ':2:146616';
}

// Event #1 mouseover (DXJ9M0sVcgU=) — \n 分隔, 2帧, body 事件回调
function stackB() {
    return ERR + '\n' +
        '    at Fr (' + MAIN + ':2:21510)\n' +
        '    at HTMLBodyElement.gp (' + MAIN + ':2:147276)';
}

// PX561 (DXJ9M0sVcgU=) — \n 分隔, 9帧, captcha 解题回调 via dl()
function stackC(uuid, vid) {
    var c = captchaUrl(uuid, vid);
    return ERR + '\n' +
        '    at Fr (' + MAIN + ':2:21510)\n' +
        '    at fl (' + MAIN + ':2:47621)\n' +
        '    at dl (' + MAIN + ':2:48474)\n' +
        '    at ' + c + ':2:582448\n' +
        '    at Ws (' + c + ':2:334970)\n' +
        '    at Object.A [as onSolvedCallback] (' + c + ':2:581928)\n' +
        '    at t (' + c + ':2:320341)\n' +
        '    at Object.n [as controllerCallback] (' + c + ':2:318230)\n' +
        '    at Qf (' + c + ':2:307240)';
}

// Last event (DXJ9M0sVcgU=) — \n 分隔, 9帧, captcha 解题回调 via Object.hl [as PX763]
function stackD(uuid, vid) {
    var c = captchaUrl(uuid, vid);
    return ERR + '\n' +
        '    at Fr (' + MAIN + ':2:21510)\n' +
        '    at fl (' + MAIN + ':2:47621)\n' +
        '    at Object.hl [as PX763] (' + MAIN + ':2:48430)\n' +
        '    at ' + c + ':2:582496\n' +
        '    at Ws (' + c + ':2:334970)\n' +
        '    at Object.A [as onSolvedCallback] (' + c + ':2:581928)\n' +
        '    at t (' + c + ':2:320341)\n' +
        '    at Object.n [as controllerCallback] (' + c + ':2:318230)\n' +
        '    at Qf (' + c + ':2:307240)';
}

module.exports = { stackA, stackB, stackC, stackD, MAIN, captchaUrl };
