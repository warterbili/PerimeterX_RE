/**
 * PX performance.memory 指纹生成器
 *
 * 还原自 main3.js Dd() 函数 (line 6173-6271)
 *
 * ═══ 源码逻辑 ═══
 *   Ht = window.performance && window.performance.memory
 *   if (Ht) {
 *       e["YGAaZiYMFV0="] = Ht.usedJSHeapSize
 *       e["FU1vS1MhZ3w="] = Ht.jsHeapSizeLimit
 *       e["EFAqFlYxJCc="] = Ht.totalJSHeapSize
 *   }
 *
 * ═══ 样本值 ═══
 *   usedJSHeapSize:  47664718 / 96028824 / 86710049 / 133865036  (~45-130 MB)
 *   totalJSHeapSize: 62136442 / 123133176 / 96237933 / 144682232 (~60-140 MB)
 *   jsHeapSizeLimit: 4294967296 (固定, 4GB)
 *
 * ═══ 约束 ═══
 *   usedJSHeapSize < totalJSHeapSize < jsHeapSizeLimit
 *
 * 用法:
 *   const { generateMemory } = require('./memory')
 *   const mem = generateMemory()
 *   // mem.usedJSHeapSize, mem.totalJSHeapSize, mem.jsHeapSizeLimit
 */

var JS_HEAP_SIZE_LIMIT = 4294967296;

// 生成 [min, max] 范围内的随机整数
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 生成 performance.memory 三个字段
 *
 * @returns {{ usedJSHeapSize: number, totalJSHeapSize: number, jsHeapSizeLimit: number }}
 */
function generateMemory() {
    // used: 40MB ~ 140MB
    var used = randInt(40000000, 140000000);
    // total: used * 1.1 ~ used * 1.5, 保证 total > used
    var total = randInt(Math.floor(used * 1.1), Math.floor(used * 1.5));
    return {
        usedJSHeapSize: used,
        totalJSHeapSize: total,
        jsHeapSizeLimit: JS_HEAP_SIZE_LIMIT
    };
}

module.exports = { generateMemory, JS_HEAP_SIZE_LIMIT };
