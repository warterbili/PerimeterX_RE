/**
 * PX Captcha 鼠标轨迹生成器
 *
 * 基于 WindMouse 算法 + 人类行为建模
 * 输出 Bundle #3 所需的全部 5 种轨迹格式
 */

// ─── 数学工具 ───

function gaussRandom(mean, sigma) {
    if (mean === undefined) mean = 0;
    if (sigma === undefined) sigma = 1;
    var u, v;
    do { u = Math.random(); } while (u === 0);
    do { v = Math.random(); } while (v === 0);
    return mean + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

function hypot(dx, dy) {
    return Math.sqrt(dx * dx + dy * dy);
}

function randInt(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
}

function randFloat(min, max) {
    return min + Math.random() * (max - min);
}

// ─── WindMouse 核心 ───
// 重力 = 拉向目标, 风 = 随机扰动
// 产生自然的加速→匀速→减速曲线

function windMouse(xs, ys, xe, ye, opts) {
    var gravity = (opts && opts.gravity) || 9;
    var wind = (opts && opts.wind) || 3;
    var maxStep = (opts && opts.maxStep) || 15;
    var targetArea = (opts && opts.targetArea) || 12;

    var points = [];
    var x = xs, y = ys;
    var windX = 0, windY = 0;
    var veloX = 0, veloY = 0;
    var sqrt2 = Math.sqrt(2);
    var sqrt3 = Math.sqrt(3);
    var sqrt5 = Math.sqrt(5);
    var step = maxStep;
    var limit = 2000; // 防无限循环

    while (limit-- > 0) {
        var dist = hypot(xe - x, ye - y);
        if (dist < 1) break;

        // 远离目标: 大风扰动; 靠近目标: 风衰减
        if (dist >= targetArea) {
            var wMag = Math.min(wind, dist);
            windX = windX / sqrt3 + (Math.random() * 2 - 1) * wMag / sqrt5;
            windY = windY / sqrt3 + (Math.random() * 2 - 1) * wMag / sqrt5;
        } else {
            windX /= sqrt2;
            windY /= sqrt2;
            if (step < 3) step = randFloat(3, 6);
        }

        veloX += windX + gravity * (xe - x) / dist;
        veloY += windY + gravity * (ye - y) / dist;

        var veloMag = hypot(veloX, veloY);
        if (veloMag > step) {
            var randDist = step / 2 + Math.random() * step / 2;
            veloX = veloX / veloMag * randDist;
            veloY = veloY / veloMag * randDist;
        }

        x += veloX;
        y += veloY;
        points.push([Math.round(x), Math.round(y)]);
    }

    // 确保精确到达终点
    var last = points[points.length - 1];
    if (!last || last[0] !== Math.round(xe) || last[1] !== Math.round(ye)) {
        points.push([Math.round(xe), Math.round(ye)]);
    }

    return points;
}

// ─── 重采样: 控制点密度, 模拟浏览器 pointermove 采样率 ───
// 接近阶段 ~1-3ms 间隔 → 约 50-80 点/200ms
// 按压阶段 ~4-10ms 间隔 → 约 100-200 点/2s

function resample(points, targetCount) {
    if (points.length <= targetCount) return points;
    var result = [points[0]];
    var step = (points.length - 1) / (targetCount - 1);
    for (var i = 1; i < targetCount - 1; i++) {
        var idx = Math.round(i * step);
        result.push(points[idx]);
    }
    result.push(points[points.length - 1]);
    return result;
}

// ─── 时间分配 (ease-in-out cubic) ───

function applyTiming(points, startTs, duration) {
    var n = points.length;
    if (n === 0) return [];
    if (n === 1) return [[points[0][0], points[0][1], startTs]];

    var result = [];
    var prevTs = startTs - 1;

    for (var i = 0; i < n; i++) {
        var t = i / (n - 1);
        // ease-in-out cubic
        var eased = t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2;

        var ts = Math.round(startTs + eased * duration + gaussRandom(0, 0.3));
        // 保证单调递增
        if (ts <= prevTs) ts = prevTs + 1;
        prevTs = ts;

        result.push([points[i][0], points[i][1], ts]);
    }

    return result;
}

// ─── 按压阶段: 微漂移 + 抖动 ───

function generateHoldPhase(cx, cy, holdMs, startTs) {
    var points = [];
    var x = cx, y = cy;
    var ts = startTs;

    // 缓慢漂移方向 (按压时手指不可能完全静止)
    var driftX = gaussRandom(0, 4);
    var driftY = gaussRandom(0, 3);
    // 真实数据: 整条轨迹 ~200 点, hold 占 ~60%
    // hold 点数 ≈ holdMs/20, 3000ms → ~150 点
    var numPoints = Math.floor(holdMs / 20) + randInt(-10, 10);
    if (numPoints < 10) numPoints = 10;

    for (var i = 0; i < numPoints; i++) {
        var progress = i / numPoints;
        x = cx + driftX * progress + gaussRandom(0, 0.7);
        y = cy + driftY * progress + gaussRandom(0, 0.5);
        ts += randInt(2, 10);

        points.push([Math.round(x), Math.round(y), ts]);
    }

    return points;
}

// ─── 释放后微移 ───

function generatePostRelease(lastX, lastY, startTs) {
    var points = [];
    var x = lastX, y = lastY, ts = startTs;
    var count = randInt(2, 6);

    for (var i = 0; i < count; i++) {
        x += gaussRandom(0, 2);
        y += gaussRandom(0, 1.5);
        ts += randInt(50, 900);
        points.push([Math.round(x), Math.round(y), ts]);
    }

    return points;
}

// ─── 过滤轨迹: 模拟 PX 的采样逻辑 ───
// 接近阶段 ~70% 保留, 按压阶段 ~45% 保留

function filterTrack(fullTrack, pointerDownTs) {
    var result = [];
    for (var i = 0; i < fullTrack.length; i++) {
        var isHold = fullTrack[i][2] >= pointerDownTs;
        var rate = isHold ? 0.45 : 0.7;
        if (i === 0 || i === fullTrack.length - 1 || Math.random() < rate) {
            result.push(fullTrack[i]);
        }
    }
    return result;
}

// ─── 生成 mouseover/mouseout 交互序列 ───
// 鼠标穿越 Shadow DOM 边界时触发

function generateMouseInteractions(approachTrack, pointerUpTs) {
    var events = [];
    // 模拟穿越 4~6 个 DOM 元素边界 (Shadow DOM 嵌套结构)
    var numElements = 5; // 0~4
    var crossings = randInt(8, 14); // 穿越次数
    var currentElement = 0;

    // 从接近轨迹中选取穿越时间点
    var approachLen = approachTrack.length;
    var crossInterval = Math.max(1, Math.floor(approachLen / crossings));

    for (var i = 0; i < crossings; i++) {
        var idx = Math.min(i * crossInterval + randInt(0, 3), approachLen - 1);
        var ts = approachTrack[idx][2];
        var nextElement = (currentElement + randInt(1, 2)) % numElements;

        // mouseout from current
        events.push({
            "PX12343": "mouseout",
            "PX11652": currentElement,
            "PX11699": ts,
            "PX12270": "true"
        });
        // mouseover to next
        events.push({
            "PX12343": "mouseover",
            "PX11652": nextElement,
            "PX11699": ts + randInt(0, 3),
            "PX12270": "true"
        });

        currentElement = nextElement;
    }

    // 最终 pointerup
    events.push({
        "PX12343": "pointerup",
        "PX11652": 4,
        "PX11699": pointerUpTs,
        "PX12270": "true"
    });

    return events;
}

// ─── Event #4 的详细交互记录 ───

function generateEvent4Interactions(filteredTrack, pointerDownTs, buttonLayout) {
    var events = [];
    var bx = buttonLayout.x || 305;
    var by = buttonLayout.y || 505;
    var bw = buttonLayout.w || 530;
    var bh = buttonLayout.h || 52;
    var iframeW = buttonLayout.iframeW || 847;
    var iframeH = buttonLayout.iframeH || 948;

    // 取前几个轨迹点作为 mousemove
    var moveCount = Math.min(4, Math.floor(filteredTrack.length / 8));
    for (var i = 0; i < moveCount; i++) {
        var idx = Math.floor(i * filteredTrack.length / (moveCount * 3));
        var pt = filteredTrack[idx];
        var nextIdx = Math.min(idx + randInt(1, 3), filteredTrack.length - 1);
        var batchPts = [];
        for (var j = idx; j <= nextIdx; j++) {
            batchPts.push(filteredTrack[j][0] + ',' + filteredTrack[j][1] + ',' + filteredTrack[j][2]);
        }
        events.push({
            "PX12343": "mousemove",
            "PX12270": "true",
            "PX12301": batchPts.join('|')
        });

        // 穿越 DOM 边界 → mouseout
        var element = randInt(2, 4);
        events.push({
            "PX12343": "mouseout",
            "PX12270": "true",
            "PX11427": Math.random() < 0.3 ? 0 : randInt(300, 380),
            "PX12208": Math.random() < 0.3 ? 0 : 50.5,
            "PX11652": element,
            "PX11824": iframeW,
            "PX11631": Math.random() < 0.3 ? iframeH : randInt(24, 340),
            "PX12165": "div",
            "PX12108": filteredTrack[nextIdx][0],
            "PX12414": filteredTrack[nextIdx][1],
            "PX11699": filteredTrack[nextIdx][2]
        });
    }

    return events;
}

// ─── 差分轨迹 ───

function buildDiffTrack(track, maxPoints) {
    if (!maxPoints) maxPoints = 30;
    var parts = [];
    var subset = track.slice(0, maxPoints);

    for (var i = 0; i < subset.length; i++) {
        if (i === 0) {
            parts.push('0,0,' + subset[i][2]);
        } else {
            var dx = subset[i][0] - subset[i - 1][0];
            var dy = subset[i][1] - subset[i - 1][1];
            parts.push(dx + ',' + dy + ',' + subset[i][2]);
        }
    }

    return parts.join('|');
}

// ─── 轨迹子集 ───

function buildTrackSubset(track, count) {
    if (!count) count = 25;
    var interval = Math.max(1, Math.floor(track.length / count));
    var result = [];
    for (var i = 0; i < track.length && result.length < count; i += interval) {
        result.push(track[i][0] + ',' + track[i][1] + ',' + track[i][2]);
    }
    return result;
}

// ═══════════════════════════════════════════════════════════
// 主入口
// ═══════════════════════════════════════════════════════════

/**
 * @param {Object} opts
 * @param {number} [opts.startX=680]    起始 X (页面随机位置)
 * @param {number} [opts.startY=800]    起始 Y
 * @param {number} [opts.buttonCX=370]  按钮中心 X
 * @param {number} [opts.buttonCY=525]  按钮中心 Y
 * @param {number} [opts.buttonW=530]   按钮宽度
 * @param {number} [opts.buttonH=52]    按钮高度
 * @param {number} [opts.startTs=23000] 起始 performance.now() 时间戳
 * @param {number} [opts.holdMs]        按压持续时间 (默认随机 1200~4000ms)
 * @param {number} [opts.iframeW=847]   captcha iframe 高 (clientHeight)
 * @param {number} [opts.iframeH=948]   captcha iframe 高
 * @returns {Object} 包含全部轨迹数据, 可直接填入 event builder
 */
function generateMouseData(opts) {
    if (!opts) opts = {};

    var startX   = opts.startX   !== undefined ? opts.startX   : randInt(500, 750);
    var startY   = opts.startY   !== undefined ? opts.startY   : randInt(700, 900);
    var buttonCX = opts.buttonCX !== undefined ? opts.buttonCX : 370;
    var buttonCY = opts.buttonCY !== undefined ? opts.buttonCY : 525;
    var buttonW  = opts.buttonW  !== undefined ? opts.buttonW  : 530;
    var buttonH  = opts.buttonH  !== undefined ? opts.buttonH  : 52;
    var startTs  = opts.startTs  !== undefined ? opts.startTs  : randInt(22000, 26000);
    var holdMs   = opts.holdMs   !== undefined ? opts.holdMs   : randInt(1200, 4000);
    var iframeW  = opts.iframeW  || 631;
    var iframeH  = opts.iframeH  || 948;

    // ── Phase 1: 接近按钮 ──
    var approachTarget = [
        buttonCX + Math.round(gaussRandom(0, 8)),
        buttonCY + Math.round(gaussRandom(0, 4))
    ];
    var approachPts = windMouse(startX, startY, approachTarget[0], approachTarget[1], {
        gravity: 9, wind: 3, maxStep: 18, targetArea: 15
    });
    // 重采样: 真实数据接近阶段约 50-80 点
    approachPts = resample(approachPts, randInt(45, 75));
    var approachMs = randInt(180, 450);
    var approachTrack = applyTiming(approachPts, startTs, approachMs);

    // ── 悬停间隙 (看到按钮 → 决定按下) ──
    var pauseMs = randInt(400, 2000);

    // ── Phase 2: 微调到按压点 ──
    var pressX = buttonCX + Math.round(buttonW * randFloat(0.3, 0.7));
    var pressY = buttonCY + Math.round(buttonH * randFloat(0.2, 0.8));
    var lastApproach = approachTrack[approachTrack.length - 1];
    var microPts = windMouse(lastApproach[0], lastApproach[1], pressX, pressY, {
        gravity: 12, wind: 1.5, maxStep: 6, targetArea: 5
    });
    microPts = resample(microPts, randInt(5, 15));
    var microStartTs = startTs + approachMs + pauseMs;
    var microMs = randInt(40, 120);
    var microTrack = applyTiming(microPts, microStartTs, microMs);

    // ── pointerdown ──
    var pdTs = microStartTs + microMs;
    var pdOffsetX = pressX - buttonCX + gaussRandom(0, 1.5);
    var pdOffsetY = pressY - buttonCY + gaussRandom(0, 0.8);

    // ── Phase 3: 按压保持 ──
    var holdTrack = generateHoldPhase(pressX, pressY, holdMs, pdTs);

    // ── pointerup ──
    var puTs = pdTs + holdMs;
    var lastHold = holdTrack.length > 0 ? holdTrack[holdTrack.length - 1] : [pressX, pressY, puTs];
    var puOffsetX = pdOffsetX + gaussRandom(0, 2.5);
    var puOffsetY = pdOffsetY + gaussRandom(0, 1.5);

    // ── Phase 4: 释放后微移 ──
    var postTrack = generatePostRelease(lastHold[0], lastHold[1], puTs + randInt(3, 20));

    // ═══ 合并全轨迹 ═══
    var fullTrack = [].concat(approachTrack, microTrack, holdTrack, postTrack);

    // ═══ 过滤轨迹 ═══
    var filteredTrack = filterTrack(fullTrack, pdTs);

    // ═══ 格式化输出 ═══
    var fullStrings = fullTrack.map(function(p) { return p[0] + ',' + p[1] + ',' + p[2]; });
    var filteredStrings = filteredTrack.map(function(p) { return p[0] + ',' + p[1] + ',' + p[2]; });

    // ═══ 交互事件序列 (PX561 QlNxGAQ+dyw=) ═══
    var preButtonTrack = approachTrack.concat(microTrack);
    var mouseInteractions = generateMouseInteractions(preButtonTrack, puTs);

    // ═══ Event #4 详细交互 ═══
    var mouseEvents4 = generateEvent4Interactions(
        filteredTrack, pdTs,
        { x: buttonCX, y: buttonCY, w: buttonW, h: buttonH, iframeW: iframeW, iframeH: iframeH }
    );

    // ═══ 差分轨迹 ═══
    var diffTrack = buildDiffTrack(filteredTrack, 30);

    // ═══ 轨迹子集 ═══
    var trackSubset = buildTrackSubset(filteredTrack, 25);

    // ═══ DOM 交互计数 ═══
    var domInteractCount = {
        "#px-captcha-wrapper>DIV1": 1,
        "DIV2>DIV2": 2,
        "#px-captcha-wrapper>DIV2": 3,
        "#px-captcha": 4,
        "DIV2>DIV4": 5
    };

    return {
        // PX561 Event #2 字段
        mouseTrackFull: fullStrings,          // PAlPQnlqS3k= 完整轨迹
        mouseTrackFiltered: filteredStrings,   // EmMhaFQBLFI= 过滤轨迹
        mouseInteractions: mouseInteractions,  // QlNxGAQ+dyw= 交互事件序列

        // pointer 数据
        pointerDown: {
            offsetX: Math.round(pdOffsetX * 100) / 100,
            offsetY: Math.round(pdOffsetY * 100) / 100,
            clientX: pressX + Math.round(gaussRandom(0, 0.5) * 10) / 10,
            clientY: pressY + Math.round(gaussRandom(0, 0.5) * 10) / 10,
            ts: pdTs
        },
        pointerUp: {
            offsetX: Math.round(puOffsetX * 100) / 100,
            offsetY: Math.round(puOffsetY * 100) / 100,
            clientX: lastHold[0] + Math.round(gaussRandom(0, 0.5) * 10) / 10,
            clientY: lastHold[1] + Math.round(gaussRandom(0, 0.5) * 10) / 10,
            ts: puTs
        },

        // Event #4 字段
        mouseEvents4: mouseEvents4,            // aH8Yfi0RG0w= 详细交互记录
        diffTrack: diffTrack,                  // VGtkahIGals= 差分轨迹
        trackSubset: trackSubset,              // EXZhN1cebw0= 轨迹子集
        domInteractCount: domInteractCount,    // RTo1ewBVNEk= DOM 交互计数

        // 计时辅助值 (可直接填入 event builder)
        holdDuration: holdMs,
        approachStartTs: startTs,
        pointerDownTs: pdTs,
        pointerUpTs: puTs,
        totalPoints: fullTrack.length,
        filteredPoints: filteredTrack.length,

        // Event #1 鼠标事件数据
        mouseEvent1: {
            clientX: approachTrack[0][0],
            clientY: approachTrack[0][1],
            type: "mouseover",
            target: "#px-captcha-wrapper>DIV:nth-child(1)"
        }
    };
}

// ─── 导出 ───
module.exports = { generateMouseData };

// ─── CLI 测试 ───
if (require.main === module) {
    var result = generateMouseData({
        startX: 680, startY: 800,
        buttonCX: 370, buttonCY: 525,
        startTs: 23000, holdMs: 3000
    });

    console.log('=== 轨迹统计 ===');
    console.log('完整轨迹点数:', result.mouseTrackFull.length);
    console.log('过滤轨迹点数:', result.mouseTrackFiltered.length);
    console.log('过滤/完整比例:', (result.mouseTrackFiltered.length / result.mouseTrackFull.length * 100).toFixed(1) + '%');
    console.log('交互事件数:', result.mouseInteractions.length);
    console.log('Event#4 交互数:', result.mouseEvents4.length);
    console.log('差分轨迹段数:', result.diffTrack.split('|').length);
    console.log('子集点数:', result.trackSubset.length);

    console.log('\n=== Pointer 数据 ===');
    console.log('pointerDown:', JSON.stringify(result.pointerDown));
    console.log('pointerUp:', JSON.stringify(result.pointerUp));
    console.log('按压时长:', result.holdDuration + 'ms');

    console.log('\n=== 轨迹前 5 点 ===');
    result.mouseTrackFull.slice(0, 5).forEach(function(s) { console.log('  ' + s); });
    console.log('  ...');
    result.mouseTrackFull.slice(-3).forEach(function(s) { console.log('  ' + s); });

    console.log('\n=== 速度分析 ===');
    var full = result.mouseTrackFull.map(function(s) {
        var p = s.split(','); return [+p[0], +p[1], +p[2]];
    });
    var speeds = [];
    for (var i = 1; i < full.length; i++) {
        var dt = full[i][2] - full[i - 1][2];
        if (dt > 0) {
            var d = hypot(full[i][0] - full[i - 1][0], full[i][1] - full[i - 1][1]);
            speeds.push(d / dt);
        }
    }
    speeds.sort(function(a, b) { return a - b; });
    console.log('最小速度: ' + speeds[0].toFixed(3) + ' px/ms');
    console.log('中位速度: ' + speeds[Math.floor(speeds.length / 2)].toFixed(3) + ' px/ms');
    console.log('最大速度: ' + speeds[speeds.length - 1].toFixed(3) + ' px/ms');
    console.log('平均速度: ' + (speeds.reduce(function(a, b) { return a + b; }, 0) / speeds.length).toFixed(3) + ' px/ms');

    console.log('\n=== 交互事件序列 (前5) ===');
    result.mouseInteractions.slice(0, 5).forEach(function(e) { console.log('  ' + JSON.stringify(e)); });

    console.log('\n=== 差分轨迹 (前10段) ===');
    console.log('  ' + result.diffTrack.split('|').slice(0, 10).join('|'));
}
