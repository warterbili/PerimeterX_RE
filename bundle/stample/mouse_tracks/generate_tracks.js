/**
 * 批量预生成鼠标轨迹数据
 * 生成 50 组不同参数的轨迹, 保存为 JSON 文件
 * 使用时随机选一组填入 Bundle #3 event builder
 */

const fs = require('fs');
const path = require('path');
const { generateMouseData } = require('./mouse_trajectory');

const OUTPUT_DIR = path.join(__dirname, 'data');
const COUNT = 50;

// 随机整数
function randInt(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
}

// 随机浮点
function randFloat(min, max) {
    return min + Math.random() * (max - min);
}

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log(`生成 ${COUNT} 组轨迹数据到 ${OUTPUT_DIR}/\n`);

var stats = { full: [], filtered: [], hold: [], ratio: [] };

for (var i = 0; i < COUNT; i++) {
    // 每组用不同的随机参数, 模拟不同用户行为
    var opts = {
        // 起始位置: 页面随机区域
        startX: randInt(400, 800),
        startY: randInt(600, 950),
        // 按钮位置: 真实范围内微调
        buttonCX: 370 + randInt(-15, 15),
        buttonCY: 525 + randInt(-10, 10),
        buttonW: 530,
        buttonH: 52,
        // performance.now() 起始时间
        startTs: randInt(18000, 35000),
        // 按压时长: 覆盖各种行为模式
        holdMs: i < 15 ? randInt(1200, 2000)    // 30% 快速按压
             : i < 35 ? randInt(2000, 3500)      // 40% 正常按压
             : randInt(3500, 5500),               // 30% 慢速按压
        iframeW: 631,
        iframeH: 948
    };

    var result = generateMouseData(opts);

    // 记录统计
    stats.full.push(result.totalPoints);
    stats.filtered.push(result.filteredPoints);
    stats.hold.push(result.holdDuration);
    stats.ratio.push(result.filteredPoints / result.totalPoints);

    // 写入 JSON
    var filename = 'track_' + String(i + 1).padStart(3, '0') + '.json';
    fs.writeFileSync(
        path.join(OUTPUT_DIR, filename),
        JSON.stringify(result, null, 2)
    );

    // 进度
    if ((i + 1) % 10 === 0) {
        console.log(`  已生成 ${i + 1}/${COUNT}`);
    }
}

// 统计摘要
function avg(arr) { return arr.reduce(function(a, b) { return a + b; }, 0) / arr.length; }
function min(arr) { return Math.min.apply(null, arr); }
function max(arr) { return Math.max.apply(null, arr); }

console.log('\n═══ 生成统计 ═══');
console.log('完整轨迹点数: ' + min(stats.full) + ' ~ ' + max(stats.full) + ' (avg ' + avg(stats.full).toFixed(0) + ')');
console.log('过滤轨迹点数: ' + min(stats.filtered) + ' ~ ' + max(stats.filtered) + ' (avg ' + avg(stats.filtered).toFixed(0) + ')');
console.log('过滤/完整比例: ' + (min(stats.ratio) * 100).toFixed(1) + '% ~ ' + (max(stats.ratio) * 100).toFixed(1) + '% (avg ' + (avg(stats.ratio) * 100).toFixed(1) + '%)');
console.log('按压时长: ' + min(stats.hold) + 'ms ~ ' + max(stats.hold) + 'ms (avg ' + avg(stats.hold).toFixed(0) + 'ms)');
console.log('\n完成! 使用方法:');
console.log('  const tracks = require("./data/track_001.json");');
console.log('  // 或 随机选取:');
console.log('  const idx = Math.floor(Math.random() * 50) + 1;');
console.log('  const tracks = require(`./data/track_${String(idx).padStart(3, "0")}.json`);');
