// !! base64 key 随 PX 脚本版本变化, 更新后需重新提取
// !! 单事件: captcha 点击验证 (64-71 fields)
// !! Bundle #4 = 请求链最终环节, 发送后获取可用 _px3
//
// ═══════════════════════════════════════════════════════════
// 使用方式: buildBundle4Event(opts) → [event]
// ═══════════════════════════════════════════════════════════
//
// 请求链: #1 → ob → /ns → #2 → ob → #3(WebGL) → ob → #4(本文件) → ob → _px3
//
// ───────────────────────────────────────────────────────────
// 参数明细:
// ───────────────────────────────────────────────────────────
//
// 【必传 · 会话级】
//   uuid              — Xa() 生成的会话 UUID
//   nsTs              — /ns 端点响应时间戳 (number)
//   px3Cookie         — 当前 _px3 完整值 (hash:base64:1000:encrypted)
//   px3Token          — px3Cookie 冒号分割第 2 段 (base64url token)
//
// 【必传 · 挑战级 (来自 Bundle #1 ob)】
//   challengeHash     — handler III000 → qa (128 hex)
//   visualHash        — handler OlOlOl → visual_challenge hash (64 hex)
//
// 【必传 · 环境级】
//   blockedUrl        — 被 PX 拦截的原始 URL
//
// 【必传 · 交互数据】
//   pointerDown       — { offsetX, offsetY, clientX, clientY, ts }
//   pointerUp         — { offsetX, offsetY, clientX, clientY, ts }
//
// 【可选 · 有默认值】
//   captchaVer        — SDK 版本 (默认 "v2.7.7")
//   seq               — 事件序号 (默认 4)
//   screenW / screenH — 屏幕分辨率 (默认 1920/1080)
//   iframeW / iframeH — captcha iframe 尺寸 (默认 948/631)
//   btnTop/btnW/btnArea/btnH — 按钮布局 (默认 505/51/530/52)
//   domPaths / domProps — Shadow DOM (有默认值)
//   perfOrigin        — performance.timeOrigin 派生值 (默认随机 ~1000-2000)

function _randInt(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
}

function buildBundle4Event(opts) {
    // 必传参数校验
    var required = [
        'uuid', 'nsTs', 'px3Cookie', 'px3Token',
        'challengeHash', 'visualHash', 'blockedUrl',
        'pointerDown', 'pointerUp'
    ];
    for (var i = 0; i < required.length; i++) {
        if (opts[required[i]] === undefined || opts[required[i]] === null) {
            throw new Error('buildBundle4Event: 缺少必传参数 "' + required[i] + '"');
        }
    }

    var pdTs = opts.pointerDown.ts;
    var puTs = opts.pointerUp.ts;
    var holdDuration = puTs - pdTs;

    // 时间链推导
    var afterPu = puTs + _randInt(10, 30);
    var nowMs = Date.now();
    var pageLoadTs = nowMs - Math.round(afterPu);
    var perfNow = afterPu + _randInt(3000, 8000);

    return [{
        "t": "Pk9NBHsuSzU=",                                     // [main] event type
        "d": {

            "Dh89VEt6P2Y=": opts.domPaths || [                   // [captcha] Shadow DOM 路径
                "#px-captcha-wrapper>DIV1",
                "#px-captcha-wrapper>DIV2",
                "DIV2>DIV1",
                "#px-captcha",
                ""
            ],
            "dEEHCjIhAT8=": opts.btnTop  || 505,                 // [captcha] 按钮 offsetTop,
            "M2IAKXYEBBM=": opts.btnW    || 51,                  // [captcha] 按钮宽度偏移,
            "XGlvYhoFaVQ=": opts.btnArea || 530,                 // [captcha] 按钮 clientY 区域,
            "eypIYT1IT1I=": opts.btnH    || 52,                  // [captcha] 按钮高度,
            "PAlPQnplT3M=": opts.screenW || 1920,                // [captcha] screen.width,
            "cRxCFzd/TiQ=": opts.screenH || 1080,                // [captcha] screen.height,
            "MkNBCHQuRTw=": opts.domProps || [                    // [captcha] DOM 属性探测
                "nodeType", "ELEMENT_NODE", "matches", "matches", "matches",
                "childNodes", "nodeType", "ELEMENT_NODE", "matches", "matches",
                "matches", "childNodes", "parentNode", "parentNode", "parentNode",
                "parentNode", "getAttribute", "className", "nodeName", "nodeName"
            ],
            "TTg+cwtVPkQ=": opts.pointerDown.offsetX,             // [captcha] pointerdown offsetX,
            "RBF3WgF0dGw=": opts.pointerDown.offsetY,             // [captcha] pointerdown offsetY,
            "RTA2ewNcOks=": "pointerdown",                        // [captcha] 事件类型,
            "WitpIBxJaRA=": opts.pointerDown.clientY,             // [captcha] pointerdown clientY,
            "Ln9ddGgYWEU=": opts.pointerDown.clientX,             // [captcha] pointerdown clientX,
            "eWRKLz8HSR8=": pdTs,                                 // [captcha] pointerdown performance.now(),
            "IxIQGWVzFiI=": opts._counter1 || _randInt(50000000, 100000000), // [captcha] 累计事件计数器,
            "FUBmS1MhZ3w=": 4294967296,                           // [captcha] 2^32 常量,
            "RBF3WgJ9cGs=": opts._counter2 || _randInt(50000000, 200000000), // [captcha] 累计字节计数器,
            "Lx4cFWp6GiM=": opts.pointerUp.offsetX,              // [captcha] pointerup offsetX,
            "WitpIBxIaBs=": opts.pointerUp.offsetY,              // [captcha] pointerup offsetY,
            "JVAWW2M8G28=": "pointerup",                          // [captcha] 事件类型,
            "YQxSByduVTY=": opts.pointerUp.clientY,              // [captcha] pointerup clientY,
            "Dz58dUlefEI=": opts.pointerUp.clientX,              // [captcha] pointerup clientX,
            "HCkvIllJKhc=": puTs,                                 // [captcha] pointerup performance.now(),
            "QlNxGAc0fSg=": [holdDuration],                      // [captcha] 按压持续时长 [ms],
            "JxYUHWFxFi8=": Math.round(opts.pointerDown.offsetX), // [captcha] 按钮内 offsetX (整数),
            "UiNhKBRAZh8=": true,                                 // [captcha] 交互验证通过,
            "VGFnahINZFw=": "zh-CN",                               // [captcha] navigator.language,
            "dgcFTDNhAXs=": opts.challengeHash,                   // [captcha] challenge hash (128 hex),
            "V0YkTREhJXg=": opts._displayToInteract || Math.round(pdTs - _randInt(500, 2000)), // [captcha] captcha 展示→首次交互,
            "InNReGQUV0s=": afterPu,                               // [captcha] pointerup 后 perfNow,
            "QlNxGAcxci4=": pageLoadTs,                            // [captcha] 页面加载绝对时间戳,
            "Czp4cU5Ye0Y=": [pageLoadTs + pdTs],                  // [captcha] 关键交互绝对时刻,
            "IxIQGWZwEy0=": [],                                    // [captcha] WASM 调用时刻 (空),
            "VidlLBBAZB8=": false,                                // [captcha] bot 检测,
            "eEULDj4oDjU=": false,                                // [captcha] 自动化检测,
            "NAFHSnJiQng=": false,                                // [captcha] devtools 检测,
            "GwpoAV5qbDQ=": false,                                // [captcha] 模拟器检测,
            "V0YkTRImIX4=": opts.iframeW   || 948,                // [captcha] iframe clientWidth,
            "RTA2ewNQO00=": opts.iframeH   || 631,                // [captcha] iframe clientHeight,
            "MD1DNnVbQQE=": 1,                                    // [captcha] 尝试次数,
            "ZjcVPCNXGQc=": opts.captchaVer || "v2.7.7",         // [captcha] SDK 版本,
            "DXh+M0gYcwg=": false,                                // [captcha] headless,
            "OSQKb3xFDl0=": false,                                // [captcha] selenium,
            "Hm8tZFsOK1c=": true,                                // [captcha] 环境检测通过,
            "YG0TZiUMFVY=": false,                                // [captcha] puppeteer,
            "R3Y0PQIXMgc=": true,                                 // [captcha] 功能支持,
            "cH0DdjUcBU0=": false,                                // [captcha] phantom,
            "WitpIB9IbxE=": opts._timeout || Math.round(pdTs) + _randInt(3000, 5000), // [captcha] 超时值,
            "AWxyJ0QOdBE=": false,                                // [captcha] 代理检测,
            "cgMBSDdiBnI=": true,                                  // [captcha] 功能支持,
            "KntZcG8aXkU=": 8,                                    // [captcha] DOM 层级深度,
            "NkdFDHMlQzs=": 97,                                   // [captcha] 挑战难度,
            "Slt5EA85fyQ=": 100,                                   // [captcha] confidence score,
            "aHUbfi0XHUs=": 1,                                    // [captcha] 常量,
            "RBF3WgFzcWA=": 4,                                    // [captcha] 硬件参数 (deviceMemory),
            "Slt5EA85fiI=": opts.visualHash,                       // [ob] visual challenge hash (64 hex),
            "CXR6P0wWfQw=": opts._coordOrTime || _randInt(700, 900), // [captcha] 坐标/时间差,
            "AhMxWEdxNmg=": opts._pressToComplete || Math.round(holdDuration + _randInt(20, 80)), // [captcha] 按压→完成时间,
            "QlNxGAQzcC4=": "visible",                             // [captcha] document.visibilityState,
            "ST45fw9ZPk8=": opts.seq || 4,                         // [main] 事件序号,
            "HCMsIlpILRA=": perfNow,                               // [main] performance.now(),
            "KD9YPm1TVww=": opts.nsTs,                             // [main] /ns 响应时间戳,
            "bRJdEyt4Uyc=": opts.uuid,                             // [main] _pxUuid,
            "UTYhdxRdIEE=": opts.px3Token,                         // [main] _px3 token (base64url),
            "Fm0mbFMGJ1s=": opts.perfOrigin || (Math.random() * 2000), // [main] performance.timeOrigin 派生,
            "QSYxZwdLMVw=": false,                                 // [main] 检测标志,
            "ST45fwxTPko=": "PX11745",                             // [main] 事件标记,
            "Rl12HAA1dyY=": "pxhc",                                // [main] PX Human Challenge,
            "RTo1ewBXNkE=": false,                                 // [main] 检测标志,
            "b1RfVSo9WGQ=": opts.px3Cookie,                       // [main] _px3 完整 cookie,
            "PSINY3tKDlQ=": opts.blockedUrl                        // [main] 被拦截的 URL
        }
    }];
}

module.exports = { buildBundle4Event };

