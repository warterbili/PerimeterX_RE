// !! base64 key 随 PX 脚本版本变化, 更新后需重新提取
// !! 标 [captcha] 的 key 来自 captcha.js, 跨 main.js 版本稳定
// !! 标 [main] 的 key 来自 main.js, 每次更新会变
// !! 5 个事件: 指纹 + 鼠标 + PX561 核心 + 完成回调 + 交互总结
//
// ═══════════════════════════════════════════════════════════
// 使用方式: buildOpts(params) → buildBundle3Events(opts)
// 只需传 10 个必传参数 + WASM/myanmarData/errorStack 全自动生成
// ═══════════════════════════════════════════════════════════
//
// 数据流 (Bundle #3 发送前的完整交互链):
//
//   ┌─ Bundle #1 请求 → 响应 ob 解码 ─────────────────────────┐
//   │  handler 0III0I0I  → no = "1772008318398"    ← serverTs  │
//   │  handler III000    → qa = "e3ac5e38..."       ← challengeHash│
//   │  handler OOllOl    → _px3 cookie (第一版)                 │
//   │  handler pow_start → 自动求解 → .pow.answer   ← powAnswer │
//   │  handler OlOlOl    → visual_challenge.hash    ← visualHash│
//   │  handler OOOOOl    → pow_challenge.uuid       ← captchaInstanceId│
//   └─────────────────────────────────────────────────────────┘
//                          ↓
//   ┌─ Bundle #2 请求 → 响应 ob 解码 ─────────────────────┐
//   │  handler OOllOl   → _px3 cookie (第二版)  ← px3Cookie│
//   │  px3Cookie 冒号分割第2段                   ← px3Token │
//   └──────────────────────────────────────────────────────┘
//                          ↓
//   ┌─ GET /ns 端点 ──────────────────────────────────────┐
//   │  响应 body → 时间戳                        ← nsTs    │
//   └──────────────────────────────────────────────────────┘
//                          ↓
//   ┌─ Captcha 页面渲染 + WASM 自动执行 ─────────────────┐
//   │  客户端 Xa() 生成                          ← uuid    │
//   │  WASM initWasm(uuid) → a()  → AE0zBkUsPjQ=  (自动) │
//   │  WASM b(powAnswer)   → MD1DNnVfRgQ=         (自动) │
//   │  captcha 页面内嵌数据                      ← myanmarData│
//   └──────────────────────────────────────────────────────┘
//                          ↓
//   ┌─ 环境级 (同浏览器/页面基本不变) ────────────────────┐
//   │  window._pxBlockedUrl                      ← blockedUrl│
//   │  window._pxVid (403 页面)                  ← vid       │
//   │  errorStack 4 种变体由 uuid+vid 模板自动生成 (自动) │
//   └──────────────────────────────────────────────────────┘
//                          ↓
//           await buildOpts(params) → opts
//              buildBundle3Events(opts) → 5 events
//
// ───────────────────────────────────────────────────────────
// 参数明细:
// ───────────────────────────────────────────────────────────
//
// 【必传 · 会话级】
//   uuid              — 客户端 Xa() 生成的会话 UUID (全局唯一)
//   serverTs          — Bundle #1 ob 响应解码 → handler 0III0I0I 设置的 no 字段 (字符串, 如 "1772008318398")
//   nsTs              — HTTP GET /ns 端点响应的时间戳 (number)
//   px3Cookie         — Bundle #2 ob 响应解码 → handler OOllOl(III0II) set_cookie 的 _px3 完整值
//   px3Token          — px3Cookie 按冒号分割取第 2 段 (base64 token 部分)
//
// 【必传 · 挑战级 (全部来自 Bundle #1 ob 响应)】
//   challengeHash     — handler III000 → qa (64 hex, PoW target)
//   powAnswer         — handler pow_start 自动求解 → result.pow.answer (64 hex, Es)
//   visualHash        — handler OlOlOl → visual_challenge result.hash (64 hex, 图像挑战哈希)
//   captchaInstanceId — handler OOOOOl → pow_challenge result.uuid (即 state.powUuid, 非页面 uuid!)
//
// 【必传 · 环境级】
//   vid               — 访客 ID, 403 拦截页 window._pxVid (也是 _pxvid cookie)
//   blockedUrl        — 触发 PX 拦截的原始请求 URL (调用者自己知道, 即被 block 的那个 API URL)
//
// 【自动生成 (buildOpts 内部调用)】
//   wasmA             — WASM a() → AE0zBkUsPjQ= (~100 hex, 含 UUID 片段, 非确定性)
//   wasmB             — WASM b(powAnswer) → MD1DNnVfRgQ= (~127 chars, ChaCha20 编码)
//   myanmarData       — DOM 标签计数 → JSON → XOR(4210) → base64 (captcha 页面 DOM 固定)
//   errorStack A/B/C/D — Fr() null[0] TypeError stack 4 种变体, 由 uuid+vid 模板生成
//
// 【可选 · 有默认值】
//   captchaVer        — SDK 版本 (默认 "v2.7.7")
//   perfOrigin        — performance.timeOrigin 精度 (默认 0.0999...)
//   challengeType     — 挑战类型 (默认 "mgb"), captcha.js 响应头 active-cdn 的值
//   mouseTrack        — 预生成轨迹对象 (不传则从 mouse_track/data/ 随机加载)
//   wasmA / wasmB     — 手动传入可覆盖 WASM 自动生成

var fs = require('fs');
var path = require('path');

function _randInt(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
}

// ═══════════════════════════════════════════════════════════
// 公共尾部 12 字段 (所有 5 个事件共享)
// ═══════════════════════════════════════════════════════════
function _commonTail(opts, seq, perfNow) {
    return {
        "ST45fw9ZPk8=": seq,                          // [main] 全局事件序号 (2→3→5→6→7)
        "HCMsIlpILRA=": perfNow,                      // [main] performance.now()
        "KD9YPm5WXgU=": true,                         // [main] PX 初始化完成标志
        "KD9YPm1TVww=": opts.nsTs,                     // [main] /ns 响应时间戳
        "bRJdEyt4Uyc=": opts.uuid,                     // [main] _pxUuid
        "UTYhdxRdIEE=": opts.px3Token,                 // [main] _px3 token
        "Fm0mbFMGJ1s=": opts.perfOrigin,               // [main] performance.timeOrigin 精度
        "QSYxZwdLMVw=": false,                         // [main] 检测标志
        "ST45fwxTPko=": "PX11745",                     // [main] 公共事件标记
        "Rl12HAA1dyY=": "pxhc",                        // [main] PX Human Challenge
        "RTo1ewBXNkE=": false,                         // [main] 检测标志
        "b1RfVSo9WGQ=": opts.px3Cookie                 // [main] _px3 完整 cookie
    };
}

// ═══════════════════════════════════════════════════════════
// Event #0 — 浏览器指纹 (78 字段)
// 与 Bundle #2 指纹事件结构相同 (WebGL/Canvas/UA/插件)
// ═══════════════════════════════════════════════════════════
function buildEvent0(opts) {
    var now = opts._perfNow0 || 8329;
    return {
        "t": "YGcQZiYME1M=",                                      // [main] event type
        "d": Object.assign({

            // ═══ WebGL 指纹 ═══
            "QAdwRgVscHQ=": "84e74b246fab079c4860fc58c01c2b1e",    // [main] WebGL hash 1
            "GC8oLl5CKh4=": "f1b218478d268063dec4ab19157e27e8",    // [main] WebGL hash 2
            "Y1hTWSY0XWk=": "WebKit",                              // [main] WebGL vendor
            "GC8oLl5EKRs=": "WebKit WebGL",                        // [main] WebGL renderer string
            "R3w3PQISMw0=": "WebGL 1.0 (OpenGL ES 2.0 Chromium)",  // [main] WebGL version
            "KxAbEW17HyU=": [                                       // [main] WebGL extensions
                "ANGLE_instanced_arrays", "EXT_blend_minmax", "EXT_clip_control",
                "EXT_color_buffer_half_float", "EXT_depth_clamp", "EXT_disjoint_timer_query",
                "EXT_float_blend", "EXT_frag_depth", "EXT_polygon_offset_clamp",
                "EXT_shader_texture_lod", "EXT_texture_compression_bptc",
                "EXT_texture_compression_rgtc", "EXT_texture_filter_anisotropic",
                "EXT_texture_mirror_clamp_to_edge", "EXT_sRGB",
                "KHR_parallel_shader_compile", "OES_element_index_uint",
                "OES_fbo_render_mipmap", "OES_standard_derivatives",
                "OES_texture_float", "OES_texture_float_linear",
                "OES_texture_half_float", "OES_texture_half_float_linear",
                "OES_vertex_array_object", "WEBGL_blend_func_extended",
                "WEBGL_color_buffer_float", "WEBGL_compressed_texture_s3tc",
                "WEBGL_compressed_texture_s3tc_srgb", "WEBGL_debug_renderer_info",
                "WEBGL_debug_shaders", "WEBGL_depth_texture", "WEBGL_draw_buffers",
                "WEBGL_lose_context", "WEBGL_multi_draw", "WEBGL_polygon_mode"
            ],
            "eE8IDj0gCzU=": [                                       // [main] WebGL params
                "[1, 1]", "[1, 1024]", 8, "yes", 8, 24, 8, 16, 32, 16384,
                1024, 16384, 16, 16384, 30, 16, 16, 4095, "[32767, 32767]",
                "no_fp", 23,127,127, 23,127,127, 23,127,127, 23,127,127,
                23,127,127, 23,127,127, 23,127,127, 23,127,127, 23,127,127,
                23,127,127, 23,127,127, 23,127,127
            ],
            "ZRpVGyB3Vys=": "Google Inc. (NVIDIA)",                 // [main] GPU vendor
            "CX55P08Uewg=": "ANGLE (NVIDIA, NVIDIA GeForce RTX 5070 Ti (0x00002C05) Direct3D11 vs_5_0 ps_5_0, D3D11)", // [main] GPU renderer
            "CF84Hk40PCg=": "WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)", // [main] GLSL version
            "DhU+VEt+OWU=": "96ff435b6ebac2817a4d5bfc475aa8e4",    // [main] canvas hash 1
            "NSoFa3BBAls=": "931fc10c8a3da4140c796dbaf146decc",    // [main] canvas hash 2
            "SB94Xg54fWs=": "2bbca34741cd16b0718bf14cac3d94a9",    // [main] canvas hash 3
            "LnVedGseXkQ=": "6514f8ca399bed0b1d259c1f8c0413b1",    // [main] canvas hash 4
            "a1BbUS45X2c=": "[63,63,63,63,0,191,191,191,191,0,191,191,191,191,191,191,191,191,191,127,127,127,127,127,127,127]", // [main] canvas pixel
            "UiliKBRDYh0=": "126.86972438948578",                   // [main] audio hash
            "KxAbEW5/HCo=": "2dce8c55c6897067fdf0c76ddf6e6d50",    // [main] font hash
            "FUplS1AnZ30=": "c96716ab2f0338a92eb85790119bcc05",    // [main] plugin hash
            "ZRpVGyByUCs=": "016beb17dd57a6e446b36265284c0c9c",    // [main] media hash
            "Jn1WfGMWU0s=": "ce87152eb9832a605dc98452be644176",    // [main] speech hash
            "TTI9cwhZOEc=": "d41d8cd98f00b204e9800998ecf8427e",    // [main] empty MD5
            "LnVedGgSXU4=": 2,                                     // [main] touchPoints
            "CX55P08Zdgs=": true,                                   // [main] WebGL支持
            "RTo1ewBWO0A=": true,                                   // [main] 功能标志
            "InlSeGcUVks=": false,                                  // [main] 检测标志
            "KV4ZX28zH2s=": false,                                  // [main] 检测标志
            "dg0GTDBnBXY=": true,                                   // [main] 功能标志
            "bHMccikcEkY=": "missing",                              // [main] 特性检测

            // ═══ PX 窗口变量 ═══
            "bjUeNCtfGwE=": [                                       // [main] window._px* 变量列表
                "_pxModal", "_pxBlockedUrl", "_pxVid", "_pxUuid", "_pxAppId",
                "_pxHostUrl", "_pxJsClientSrc", "_pxFirstPartyEnabled",
                "_pxAction", "_PXO1GDTa7Q", "_pxSelectedLocale", "_pxTranslation",
                "_pxOnCaptchaSuccess", "_pxOnMobileCaptchaSuccess",
                "_pxOnOfflineCallback", "_pxMobile", "_O1GDTa7Qhandler", "_pxInit"
            ],
            "CF84Hk45Oy4=": [],                                     // [main] 空数组
            "ICdQJmVNVB0=": [                                        // [main] navigator.plugins
                "PDF Viewer::Portable Document Format::application/pdf~pdf::text/pdf~pdf",
                "Chrome PDF Viewer::Portable Document Format::application/pdf~pdf::text/pdf~pdf",
                "Chromium PDF Viewer::Portable Document Format::application/pdf~pdf::text/pdf~pdf",
                "Microsoft Edge PDF Viewer::Portable Document Format::application/pdf~pdf::text/pdf~pdf",
                "WebKit built-in PDF::Portable Document Format::application/pdf~pdf::text/pdf~pdf"
            ],

            // ═══ 时间戳 / 服务器参数 ═══
            "UTYhdxdRL0Y=": opts.serverTs,                           // [main] ob 服务器时间戳 (字符串)

            // ═══ 错误堆栈 ═══
            "Bh02XENxM2Y=": opts.stackA,                              // [main] main.min.js 错误堆栈 (空格分隔)

            // ═══ 环境标志 ═══
            "AEcwBkUrPzw=": true,                                   // [main] 环境标志
            "UBdgVhV9Y2I=": 33,                                     // [main] 检测计数
            "bjUeNCtZGgA=": "fd7149bbfb316699ef918fa7bb7510a8",    // [main] 环境 hash 1
            "HUJtQ1svang=": "d41d8cd98f00b204e9800998ecf8427e",    // [main] 空 MD5
            "UBdgVhZ8YmU=": "fd7149bbfb316699ef918fa7bb7510a8",    // [main] 环境 hash 2

            // ═══ 屏幕 / 设备 ═══
            "eyBLYT5LRFU=": 3,                                      // [main] devicePixelRatio 相关
            "OA9ITn5pS38=": 1920,                                   // [main] screen.width
            "egEKQDxoBXM=": 1080,                                   // [main] screen.height
            "Vi1mLBNCYx8=": 1920,                                   // [main] availWidth
            "AhkyWEd0PW0=": "1920X1080",                            // [main] 分辨率字符串
            "GwBrAV1tZDM=": 32,                                     // [main] colorDepth
            "GwBrAV5ubDA=": 32,                                     // [main] pixelDepth
            "MDdANnVYRQw=": 1032,                                   // [main] availHeight
            "Y1hTWSU+UGI=": "10207b2f",                             // [main] CRC32
            "MklCCHQiTTk=": "zh-CN",                                // [main] navigator.language
            "HmUuZFsPLF4=": "Win32",                                // [main] navigator.platform
            "P2QPJXkNDRM=": navigator.userAgent,                     // [main] UA
            "FwxnDVFkaD4=": ["zh-CN", "en", "en-GB", "en-US"],     // [main] navigator.languages
            "Zj0WPCNTEgk=": true,                                   // [main] cookie enabled
            "ZHsUeiITEUk=": 8,                                      // [main] hardwareConcurrency
            "KV4ZX282Fmg=": 16,                                     // [main] deviceMemory
            "W0ArQR0tJXM=": -480,                                   // [main] timezoneOffset
            "IxgTGWVwEyM=": false,                                  // [main] 检测标志
            "cyhDaTVOQFs=": new Date().toString(),                   // [main] Date().toString()
            "KV4ZX281Gm0=": true,                                   // [main] 功能标志
            "N2wHLXEHAxY=": "64556c77",                             // [main] CRC32
            "Vi1mLBBGZBs=": 4294967296,                             // [main] jsHeapSizeLimit
            "OkFKAHwrSDA=": "7c5f9724",                             // [main] CRC32
            "Jn1WfGMWU0k=": "3207084bd110f1ac964863e23aa78e04",    // [main] 综合 hash
            "GwBrAV5qZDU=": null,                                   // [main] null 值
            "KnFacG8cW0A=": "f49f18dbec5558a76590af096c339826",    // [main] 指纹 hash
            "DXJ9M0gZegA=": opts.sessionHash,                        // [main] 会话级 MD5 (跨会话变, 会话内固定; 可能 md5(PX 内部状态/cookie))

        }, _commonTail(opts, 2, now), {
            "PSINY3tKDlQ=": "https://www.ifood.com.br/restaurantes" // [main] 当前页面 URL
        })
    };
}

// ═══════════════════════════════════════════════════════════
// Event #1 — 鼠标交互事件 (20 字段)
// mouseover/mouseout, 坐标+DOM路径+时间
// ═══════════════════════════════════════════════════════════
function buildEvent1(opts) {
    var now = opts._perfNow1 || 27342;
    return {
        "t": "TlV+FAs6eyU=",                                       // [main] event type
        "d": Object.assign({
            "DhU+VEt6OW4=": opts._mouseEvent1.clientX || 630,      // [main] clientX
            "BXp1O0AQcw0=": opts._mouseEvent1.clientY || 289,      // [main] clientY
            "DXJ9M0sVcgU=": opts.stackB,                             // [main] mouseover 错误堆栈 (2帧)
            "PSINY3hPClI=": opts._mouseEvent1.type || "mouseover",  // [main] 事件类型
            "PANMQnprQnk=": now,                                    // [main] performance.now()
            "JVoVW2M9Gm4=": "true",                                 // [main] 冒泡
            "GwBrAV5qajI=": true,                                   // [main] isTrusted
            "cHcAdjYfAkY=": opts._mouseEvent1.target || "#px-captcha-wrapper>DIV:nth-child(1)" // [main] DOM路径
        }, _commonTail(opts, 3 + opts._seqOffset, now))
    };
}

// ═══════════════════════════════════════════════════════════
// Event #2 — PX561 核心 (95 字段)
// 按压验证 + WASM 结果 + 鼠标轨迹
// !! 不使用 Object.assign+commonTail: KD9YPm5WXgU= 必须在第 1 位
// ═══════════════════════════════════════════════════════════
function buildEvent2(opts) {
    var perfNow = opts._perfNow2 || 38073;
    var pdTs = opts.pointerDown.ts;
    var puTs = opts.pointerUp.ts;
    var holdDuration = puTs - pdTs;

    return {
        "t": "PX561",
        "d": {
            "KD9YPm5WXgU=": true,                                          // #1  PX 初始化完成
            "DXJ9M0sVcgU=": opts.stackC,                                   // #2  PX561 完整堆栈
            "QllyGAQ+dik=": true,                                          // #3  captcha 可见性
            "InlSeGQTUE4=": "visible",                                     // #4  visibilityState
            "Bh02XENzOGc=": opts.myanmarData,                              // #5  Myanmar 编码
            "PANMQnprQnk=": perfNow,                                       // #6  performance.now()
            "CzB7cU5ffkU=": true,                                          // #7  challenge 类型标志
            "cgkCSDRhAH0=": 4,                                             // #8  事件内部序号
            "DXJ9M0gZegA=": opts.sessionHash,                              // #9  会话级 MD5 (同 Event 0 #64)
            "GwBrAV5rbjM=": true,                                          // #10 按压检测启用
            "dEsECjIsCjk=": 1,                                             // #11 点击次数
            "N2wHLXEKAxg=": 0,                                             // #12 失败计数
            "UBdgVhZ/ZGY=": 0,                                             // #13 重试计数
            "NAtESnJhQ3E=": 0,                                             // #14 超时计数
            "QlNxGAQ+dyw=": opts.mouseInteractions,                        // #15 mouse 事件数组
            "EmMhaFQBLFI=": opts.mouseTrackFiltered,                       // #16 过滤轨迹
            "PAlPQnlqS3k=": opts.mouseTrackFull,                           // #17 完整轨迹
            "Dh89VEt6P2Y=": opts.domPaths,                                 // #18 DOM 路径
            "dEEHCjIhAT8=": 505,                                           // #19 按钮 offsetTop
            "M2IAKXYEBBM=": opts._buttonMarginLeft,                        // #20 按钮水平偏移 (captcha 布局相关, 51~159)
            "XGlvYhoFaVQ=": 530,                                           // #21 按钮 clientY 区域
            "eypIYT1IT1I=": 52,                                            // #22 按钮高度
            "PAlPQnplT3M=": 1920,                                          // #23 screen.width
            "cRxCFzd/TiQ=": 1080,                                          // #24 screen.height
            "MkNBCHQuRTw=": opts.domProps,                                  // #25 DOM 属性探测
            "TTg+cwtVPkQ=": opts.pointerDown.offsetX,                      // #26 pointerdown offsetX
            "RBF3WgF0dGw=": opts.pointerDown.offsetY,                      // #27 pointerdown offsetY
            "RTA2ewNcOks=": "pointerdown",                                 // #28 事件类型
            "WitpIBxJaRA=": opts.pointerDown.clientY,                      // #29 pointerdown clientY
            "Ln9ddGgYWEU=": opts.pointerDown.clientX,                      // #30 pointerdown clientX
            "eWRKLz8HSR8=": pdTs,                                          // #31 pointerdown ts
            "IxIQGWVzFiI=": opts._counter1 || 67184994,                    // #32 累计事件计数器
            "FUBmS1MhZ3w=": 4294967296,                                    // #33 2^32 常量
            "RBF3WgJ9cGs=": opts._counter2 || 79466182,                    // #34 累计字节计数器
            "Lx4cFWp6GiM=": opts.pointerUp.offsetX,                       // #35 pointerup offsetX
            "WitpIBxIaBs=": opts.pointerUp.offsetY,                        // #36 pointerup offsetY
            "JVAWW2M8G28=": "pointerup",                                   // #37 事件类型
            "YQxSByduVTY=": opts.pointerUp.clientY,                        // #38 pointerup clientY
            "Dz58dUlefEI=": opts.pointerUp.clientX,                        // #39 pointerup clientX
            "HCkvIllJKhc=": puTs,                                          // #40 pointerup ts
            "QlNxGAc0fSg=": [holdDuration],                                // #41 按压持续时长
            "JxYUHWFxFi8=": opts._buttonOffsetX || 319,                    // #42 按钮内 offsetX
            "UiNhKBRAZh8=": true,                                          // #43 交互验证通过
            "VGFnahINZFw=": "zh-CN",                                       // #44 navigator.language
            "dgcFTDNhAXs=": opts.challengeHash,                            // #45 challenge hash
            "V0YkTREhJXg=": opts._displayToInteract || 3793,               // #46 captcha显示→交互
            "InNReGQUV0s=": opts._afterPointerUp || 30101,                 // #47 pointerup 后 perfNow
            "QlNxGAcxci4=": opts._pageLoadTs,                              // #48 页面加载时间戳
            "Czp4cU5Ye0Y=": opts._interactionTimestamps || [opts.nsTs + 26000], // #49 关键交互时刻
            "IxIQGWZwEy0=": opts._wasmCallTimestamps || [],                // #50 WASM 调用时刻
            "VidlLBBAZB8=": false,                                         // #51 bot 检测
            "eEULDj4oDjU=": false,                                         // #52 自动化检测
            "NAFHSnJiQng=": false,                                         // #53 devtools 检测
            "GwpoAV5qbDQ=": false,                                         // #54 模拟器检测
            "V0YkTRImIX4=": 948,                                           // #55 iframe clientWidth
            "RTA2ewNQO00=": opts._iframeHeight,                             // #56 iframe clientHeight (631~847, 取决于浏览器窗口)
            "MD1DNnVbQQE=": 1,                                             // #57 尝试次数
            "ZjcVPCNXGQc=": opts.captchaVer,                               // #58 SDK 版本
            "DXh+M0gYcwg=": false,                                         // #59 headless
            "OSQKb3xFDl0=": false,                                         // #60 selenium
            "Hm8tZFsOK1c=": true,                                          // #61 环境检测通过
            "YG0TZiUMFVY=": false,                                         // #62 puppeteer
            "R3Y0PQIXMgc=": true,                                          // #63 功能支持
            "cH0DdjUcBU0=": false,                                         // #64 phantom
            "WitpIB9IbxE=": opts._timeout || 4102,                         // #65 超时值
            "AWxyJ0QOdBE=": false,                                         // #66 代理检测
            "cgMBSDdiBnI=": true,                                           // #67 功能支持
            "KntZcG8aXkU=": 8,                                             // #68 DOM 层级
            "NkdFDHMlQzs=": 97,                                            // #69 挑战难度
            "Slt5EA85fyQ=": 100,                                            // #70 confidence score
            "aHUbfi0XHUs=": 1,                                              // #71 常量
            "RBF3WgFzcWA=": 4,                                              // #72 hardwareConcurrency
            "Slt5EA85fiI=": opts.visualHash,                                // #73 visual challenge hash
            "CXR6P0wWfQw=": opts._coordOrTime || 814,                      // #74 坐标/时间差
            "AhMxWEdxNmg=": opts._pressToWasm || 1536,                     // #75 按压→WASM完成
            "cyJAaTZDQF8=": true,                                           // #76 验证完成
            "InNReGcSXUM=": "succeeded",                                    // #77 WASM 执行状态
            "AE0zBkUsPjQ=": opts.wasmA,                                     // #78 WASM a() 输出
            "MD1DNnVfRgQ=": opts.wasmB,                                     // #79 WASM b() 输出
            "JxYUHWFxEw==": opts._hiResPerfNow || 16258.39999999106,       // #80 高精度 perfNow
            "CXR6P08TfA==": opts.powAnswer,                                 // #81 PoW answer
            "Slt5EA86fSY=": opts._wasmCompleteTs || 30104,                  // #82 WASM 完成时间
            "FwZkDVJnZDg=": false,                                          // #83 检测标志
            "Q3IwOQYQMwg=": opts.challengeType,                             // #84 挑战类型
            "ST45fw9ZPk8=": 5,                                              // #85 事件序号
            "HCMsIlpILRA=": perfNow,                                        // #86 performance.now()
            "KD9YPm1TVww=": opts.nsTs,                                      // #87 /ns 时间戳
            "bRJdEyt4Uyc=": opts.uuid,                                      // #88 uuid
            "UTYhdxRdIEE=": opts.px3Token,                                  // #89 px3Token
            "Fm0mbFMGJ1s=": opts.perfOrigin,                                // #90 perfOrigin
            "QSYxZwdLMVw=": false,                                          // #91 检测标志
            "ST45fwxTPko=": "PX11745",                                      // #92 事件标记
            "Rl12HAA1dyY=": "pxhc",                                         // #93 PX Human Challenge
            "RTo1ewBXNkE=": false,                                          // #94 检测标志
            "b1RfVSo9WGQ=": opts.px3Cookie                                  // #95 _px3 cookie
        }
    };
}

// ═══════════════════════════════════════════════════════════
// Event #3 — Captcha 完成回调 (27 字段)
// onSolvedCallback 触发
// !! 不使用 Object.assign+commonTail: KD9YPm5WXgU= 必须在第 1 位
// ═══════════════════════════════════════════════════════════
function buildEvent3(opts) {
    var perfNow = opts._perfNow3 || 38073;
    return {
        "t": "Bzx3fUFVeE0=",
        "d": {
            "KD9YPm5WXgU=": true,                                          // #1  PX 初始化完成
            "DXJ9M0sVcgU=": opts.stackD,                                   // #2  Last 完整堆栈
            "QllyGAQ+dik=": true,                                          // #3  captcha 可见性
            "InlSeGQTUE4=": "visible",                                     // #4  visibilityState
            "Bh02XENzOGc=": opts.myanmarData,                              // #5  Myanmar 编码
            "PANMQnprQnk=": perfNow,                                       // #6  performance.now()
            "egsJQD9vCHU=": "pxCaptcha",                                   // #7  captcha 类型
            "Tl99FAg/cCY=": "www.ifood.com.br",                            // #8  目标域名
            "VGFnahINZFw=": "zh-CN",                                       // #9  navigator.language
            "fy5MZTpKTF4=": false,                                         // #10 移动端标志
            "ZjcVPCNXGQc=": opts.captchaVer,                               // #11 SDK 版本
            "BXB2O0ARegw=": opts.blockedUrl,                                // #12 被拦截 API URL
            "X04sRRovIXE=": true,                                          // #13 验证通过
            "aHUbfi0XHkQ=": false,                                         // #14 离线标志
            "WitpIB9IbxE=": opts._timeout || 4102,                         // #15 超时值
            "FUplTVch": opts.captchaInstanceId,                             // #16 pow_challenge.uuid
            "ST45fw9ZPk8=": 6,                                              // #17 事件序号
            "HCMsIlpILRA=": perfNow,                                        // #18 performance.now()
            "KD9YPm1TVww=": opts.nsTs,                                      // #19 /ns 时间戳
            "bRJdEyt4Uyc=": opts.uuid,                                      // #20 uuid
            "UTYhdxRdIEE=": opts.px3Token,                                  // #21 px3Token
            "Fm0mbFMGJ1s=": opts.perfOrigin,                                // #22 perfOrigin
            "QSYxZwdLMVw=": false,                                          // #23 检测标志
            "ST45fwxTPko=": "PX11745",                                      // #24 事件标记
            "Rl12HAA1dyY=": "pxhc",                                         // #25 PX Human Challenge
            "RTo1ewBXNkE=": false,                                          // #26 检测标志
            "b1RfVSo9WGQ=": opts.px3Cookie                                  // #27 _px3 cookie
        }
    };
}

// ═══════════════════════════════════════════════════════════
// Event #4 — PX11994 交互总结 (24 字段)
// 差分轨迹 + DOM 统计
// ═══════════════════════════════════════════════════════════
function buildEvent4(opts) {
    var perfNow = opts._perfNow4 || 38073;
    return {
        "t": "U0gjSRYiJXI=",                                        // [main] event type
        "d": Object.assign({

            // ═══ 交互数据 ═══
            "aH8Yfi0RG0w=": opts.mouseEvents4,                       // [main] 详细交互记录
            "ZHsUeiEUFEg=": "PX11994",                               // [main] 事件码
            "WQ4pDx9pLTk=": "https://www.ifood.com.br/restaurantes", // [main] 页面 URL
            "RTo1ewBVNEk=": opts.domInteractCount,                    // [main] DOM 交互计数
            "dWpFKzMMRRw=": opts.uuid,                                // [main] _pxUuid
            "Y1hTWSU+UG8=": 0,                                       // [main] 计数器
            "QSYxZwRMMFA=": true,                                     // [main] 标志
            "VGtkahIGals=": opts.diffTrack,                            // [main] 差分鼠标轨迹 "dx,dy,ts|..."
            "HwRvBVpsajY=": "",                                       // [main] 键盘输入 (空)
            "ChE6UE97OmI=": opts._absTimestamp || Date.now() - 30000, // [main] 绝对时间戳
            "EXZhN1cebw0=": opts.trackSubset,                         // [main] 轨迹子集 ["x,y,ts", ...]
            "PkVOBHgtTj8=": "631x0"                                   // [main] 视口位置

        }, _commonTail(opts, 7, perfNow))
    };
}

// ═══════════════════════════════════════════════════════════
// 主构建函数 — 返回 5 个事件的数组
// ═══════════════════════════════════════════════════════════
function buildBundle3Events(opts) {
    return [
        buildEvent0(opts),
        buildEvent1(opts),
        buildEvent2(opts),
        buildEvent3(opts),
        buildEvent4(opts)
    ];
}

// ═══════════════════════════════════════════════════════════
// buildOpts — 从 13 个必传参数 + WASM 自动生成构造完整 opts
// ═══════════════════════════════════════════════════════════
//
// 用法 (async! WASM 加载需要 await):
//   var opts = await buildOpts({
//       // 会话级 (Bundle #1 ob → no, Bundle #2 ob → _px3, /ns → ts)
//       uuid: "...",  serverTs: "1772008318398",  nsTs: 1772008320000,
//       px3Cookie: "hash:token:1000:enc",  px3Token: "token",
//       // 挑战级 (全部来自 Bundle #1 ob)
//       challengeHash: "e3ac5e38...",  powAnswer: "c3f363da...",
//       visualHash: "440be25d...",
//       captchaInstanceId: "73138de0-...",  // pow_challenge.uuid (NOT 页面 uuid!)
//       // 环境级
//       vid: "6749e049-...",  // 403 页面 window._pxVid
//       blockedUrl: "https://..."
//   });
//   var events = buildBundle3Events(opts);

async function buildOpts(p) {
    // ── 必传参数校验 (10 个) ──
    var required = [
        'uuid', 'vid', 'serverTs', 'nsTs', 'px3Cookie', 'px3Token',
        'challengeHash', 'powAnswer', 'visualHash', 'captchaInstanceId',
        'blockedUrl'
    ];
    for (var i = 0; i < required.length; i++) {
        if (p[required[i]] === undefined || p[required[i]] === null) {
            throw new Error('buildOpts: 缺少必传参数 "' + required[i] + '"');
        }
    }

    // ── WASM 自动生成 (可手动覆盖) ──
    var _wasmA = p.wasmA;
    var _wasmB = p.wasmB;
    if (!_wasmA || !_wasmB) {
        var { initWasm } = require(path.join(__dirname, '..', 'source', 'wasm', 'run_wasm.js'));
        var wasm = await initWasm(p.uuid);
        if (!_wasmA) _wasmA = wasm.a();
        if (!_wasmB) _wasmB = wasm.b(p.powAnswer);
    }

    // ── myanmarData 自动生成 (可手动覆盖) ──
    var _myanmarData = p.myanmarData;
    if (!_myanmarData) {
        var { myanmarData } = require(path.join(__dirname, '..', 'source', 'main_source', 'myanmar_encode.js'));
        _myanmarData = myanmarData();  // 默认 captcha 页面 DOM 标签计数
    }

    // ── errorStack 4 变体自动生成 (模板, uuid+vid 替换) ──
    var _es = require(path.join(__dirname, '..', 'source', 'main_source', 'error_stack.js'));
    var _stackA = p.errorStackShort || _es.stackA();           // Event #0 指纹
    var _stackB = p.errorStackMouse || _es.stackB();           // Event #1 mouseover
    var _stackC = p.errorStack      || _es.stackC(p.uuid, p.vid); // PX561
    var _stackD = p.errorStackLast  || _es.stackD(p.uuid, p.vid); // Last event

    // ── 加载鼠标轨迹 ──
    var track = p.mouseTrack;
    if (!track) {
        var trackDir = path.join(__dirname, '..', 'mouse_track', 'data');
        var trackIdx = _randInt(1, 50);
        var trackFile = path.join(trackDir, 'track_' + String(trackIdx).padStart(3, '0') + '.json');
        track = JSON.parse(fs.readFileSync(trackFile, 'utf8'));
    }

    // ── 从轨迹提取关键时间 ──
    var pdTs = track.pointerDown.ts;           // pointerdown performance.now()
    var puTs = track.pointerUp.ts;             // pointerup performance.now()
    var holdMs = track.holdDuration;           // 按压时长
    var approachStart = track.approachStartTs; // 接近阶段开始

    // ── 计算时间链 ──
    var wasmMs = _randInt(20, 80);             // WASM 处理耗时
    var completePerfNow = puTs + wasmMs;       // captcha 完成时的 performance.now()
    var nowMs = Date.now();
    var pageLoadTs = nowMs - Math.round(completePerfNow); // 页面加载绝对时间

    // ── 返回完整 opts ──
    return {
        // ────────────────────────────────────
        // 必传 · 会话级 (直传)
        // ────────────────────────────────────
        uuid:              p.uuid,
        serverTs:          p.serverTs,
        nsTs:              p.nsTs,
        px3Cookie:         p.px3Cookie,
        px3Token:          p.px3Token,
        perfOrigin:        p.perfOrigin || 0.09999990463256836,

        // ────────────────────────────────────
        // 必传 · 挑战级 (直传 + WASM 自动)
        // ────────────────────────────────────
        captchaVer:        p.captchaVer || "v2.7.7",
        challengeType:     p.challengeType || "mgb",
        challengeHash:     p.challengeHash,
        powAnswer:         p.powAnswer,
        visualHash:        p.visualHash,
        wasmA:             _wasmA,
        wasmB:             _wasmB,
        myanmarData:       _myanmarData,

        // ────────────────────────────────────
        // 环境级 (直传 + errorStack 自动生成)
        // ────────────────────────────────────
        captchaInstanceId: p.captchaInstanceId,
        blockedUrl:        p.blockedUrl,
        stackA:            _stackA,   // Event #0 指纹 (空格分隔, main.min.js)
        stackB:            _stackB,   // Event #1 mouseover (2帧, main.min.js)
        stackC:            _stackC,   // PX561 (完整 captcha 调用链 via dl)
        stackD:            _stackD,   // Last event (完整 captcha 调用链 via PX763)

        // ────────────────────────────────────
        // 自动 · 鼠标轨迹 (from mouseTrack)
        // ────────────────────────────────────
        mouseTrackFull:     track.mouseTrackFull,
        mouseTrackFiltered: track.mouseTrackFiltered,
        mouseInteractions:  track.mouseInteractions,
        pointerDown:        track.pointerDown,
        pointerUp:          track.pointerUp,
        mouseEvents4:       track.mouseEvents4,
        diffTrack:          track.diffTrack,
        trackSubset:        track.trackSubset,
        domInteractCount:   track.domInteractCount,

        // ────────────────────────────────────
        // 自动 · Event #1 鼠标事件
        // ────────────────────────────────────
        _mouseEvent1:       track.mouseEvent1,

        // ────────────────────────────────────
        // 自动 · Shadow DOM (captcha widget 固定结构)
        // ────────────────────────────────────
        domPaths: [
            "#px-captcha-wrapper>DIV1",
            "#px-captcha-wrapper>DIV2",
            "DIV2>DIV1",
            "#px-captcha",
            ""
        ],
        domProps: [
            "nodeType", "ELEMENT_NODE", "matches", "matches", "matches",
            "childNodes", "nodeType", "ELEMENT_NODE", "matches", "matches",
            "matches", "childNodes", "parentNode", "parentNode", "parentNode",
            "parentNode", "getAttribute", "className", "nodeName", "nodeName"
        ],

        // ────────────────────────────────────
        // 自动 · 时间链 (从轨迹 + Date.now() 推导)
        // ────────────────────────────────────
        _perfNow0:    _randInt(7000, 10000),                       // 指纹采集时 (~页面加载后 8s)
        _perfNow1:    approachStart,                               // 鼠标首次进入 captcha 区域
        _perfNow2:    completePerfNow,                             // captcha 验证完成
        _perfNow3:    completePerfNow + _randInt(0, 3),            // 完成回调
        _perfNow4:    completePerfNow + _randInt(3, 8),            // 交互总结

        _timeout:              Math.round(pdTs - approachStart) + _randInt(3000, 5000),  // captcha 显示→超时差
        _buttonOffsetX:        Math.round(track.pointerDown.offsetX),                    // 按钮内 offsetX
        _displayToInteract:    Math.round(pdTs - _randInt(500, 2000)),                   // captcha 展示→首次交互
        _afterPointerUp:       completePerfNow + _randInt(20, 50),                       // pointerup 后的 perfNow
        _pageLoadTs:           pageLoadTs,                                                // 页面加载绝对时间戳
        _interactionTimestamps: [pageLoadTs + pdTs],                                     // 关键交互绝对时刻
        _wasmCallTimestamps:   Math.random() < 0.5 ? [] : [pageLoadTs + puTs + _randInt(5, 30)],
        _pressToWasm:          holdMs + wasmMs,                                          // 按压→WASM完成
        _coordOrTime:          _randInt(700, 900),                                       // 坐标/时间差值
        _hiResPerfNow:         completePerfNow + Math.random() * 0.5 - 0.1,             // 高精度 performance.now()
        _wasmCompleteTs:       completePerfNow + _randInt(1, 10),                        // WASM 完成时间
        _counter1:             _randInt(50000000, 100000000),                             // PX 累计事件计数器
        _counter2:             _randInt(50000000, 200000000),                             // PX 累计字节计数器
        _absTimestamp:         pageLoadTs                                                 // Event #4 绝对时间戳
    };
}

module.exports = {
    buildOpts,
    buildBundle3Events,
    buildEvent0,
    buildEvent1,
    buildEvent2,
    buildEvent3,
    buildEvent4
};
