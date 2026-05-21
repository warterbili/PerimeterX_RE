const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..');

// 从样本中提取鼠标相关字段
// 每组数据必须内部一致(同一次真实交互)

const sources = ['b3_verify', 'b3_test4', 'b3_test5'];
const pool = [];

for (const name of sources) {
  const data = JSON.parse(fs.readFileSync(path.join(DIR, `event_json/${name}.json`), 'utf8'));
  const byType = {};
  data.forEach(e => byType[e.t] = e);

  const mo = byType['TlJ0FAs6eyU=']; // mouseover
  const px = byType['PX561'];
  const mt = byType['CXlzP0wUfwQ=']; // mouse_track
  const sub = byType['FU1vS1Mjans=']; // submit

  if (!mo || !px || !mt) {
    console.log(`${name}: missing events, skip`);
    continue;
  }

  const entry = {
    _source: name,

    // ── mouseover 事件 ──
    mouseover: {
      clientX: mo.d['EFAqFlU4Jyw='],          // mouseEvent1.clientX
      clientY: mo.d['KnZQcG8bXEY='],          // mouseEvent1.clientY
      eventType: mo.d['AEA6BkUqNzc='],        // "mouseover"/"mousemove"
      target: mo.d['QSE7ZwdOM1c='],           // DOM target
      perfNow: mo.d['LVUXU2s6E2g='],          // perfNow
    },

    // ── PX561 事件: 指针坐标 ──
    pointerDown: {
      offsetX: px.d['TTg+cwtVPkQ='],
      offsetY: px.d['RBF3WgF0dGw='],
      clientX: px.d['Ln9ddGgYWEU='],
      clientY: px.d['WitpIBxJaRA='],
      ts: px.d['eWRKLz8HSR8='],               // perfNow
    },
    pointerUp: {
      offsetX: px.d['Lx4cFWp6GiM='],
      offsetY: px.d['WitpIBxIaBs='],
      clientX: px.d['Dz58dUlefEI='],
      clientY: px.d['YQxSByduVTY='],
      ts: px.d['HCkvIllJKhc='],               // perfNow
    },

    // ── PX561 事件: 鼠标轨迹 ──
    holdDuration: px.d['QlNxGAc0fSg='],        // [upTs - downTs]
    buttonOffsetX: px.d['JxYUHWFxFi8='],       // Math.round(pointerDown.offsetX) 或按钮内X
    mouseInteractions: px.d['QlNxGAQ+dyw='],   // hover事件数组
    mouseTrackFiltered: px.d['EmMhaFQBLFI='],  // 过滤后轨迹
    mouseTrackFull: px.d['PAlPQnlqS3k='],     // 完整轨迹
    domProps: px.d['MkNBCHQuRTw='],            // DOM属性探测列表

    // ── PX561 事件: 派生时间字段 ──
    px561_perfNow: px.d['LVUXU2s6E2g='],       // PX561 perfNow
    displayToInteract: px.d['V0YkTREhJXg='],   // captcha显示到交互
    afterPointerUp: px.d['InNReGQUV0s='],      // pointerup后的perfNow
    pageLoadTs: px.d['QlNxGAcxci4='],          // 页面加载绝对时间戳
    interactionTs: px.d['Czp4cU5Ye0Y='],       // 关键交互绝对时刻
    counter1: px.d['IxIQGWVzFiI='],            // PX累计事件计数器
    counter2: px.d['RBF3WgJ9cGs='],            // PX累计字节计数器

    // ── submit 事件 ──
    submit_perfNow: sub ? sub.d['LVUXU2s6E2g='] : null,
    submit_timeout: sub ? sub.d['WitpIB9IbxE='] : null,
    px561_timeout: px.d['WitpIB9IbxE='],

    // ── mouse_track 事件 ──
    mouseEvents4: mt.d['OSkDb3xACl0='],        // 详细交互记录
    diffTrack: mt.d['GCgiLl5CJh8='],           // 差分轨迹
    trackSubset: mt.d['M28JKXUADRM='],         // 轨迹子集25点
    domInteractCount: mt.d['Az95eUZXcks='],    // DOM交互计数
    mt_absTimestamp: mt.d['NkpMDHMnRj4='],     // 绝对时间戳
  };

  pool.push(entry);

  // 统计
  const trackFull = Array.isArray(entry.mouseTrackFull) ? entry.mouseTrackFull.length : '?';
  const trackFilt = Array.isArray(entry.mouseTrackFiltered) ? entry.mouseTrackFiltered.length : '?';
  const interactions = Array.isArray(entry.mouseInteractions) ? entry.mouseInteractions.length : '?';
  const events4 = Array.isArray(entry.mouseEvents4) ? entry.mouseEvents4.length : '?';
  const subset = Array.isArray(entry.trackSubset) ? entry.trackSubset.length : '?';
  console.log(`${name}:`);
  console.log(`  pointer: down(${entry.pointerDown.clientX},${entry.pointerDown.clientY}) up(${entry.pointerUp.clientX},${entry.pointerUp.clientY})`);
  console.log(`  hold: ${entry.holdDuration}ms, buttonOffX: ${entry.buttonOffsetX}`);
  console.log(`  tracks: full=${trackFull}, filtered=${trackFilt}, subset=${subset}`);
  console.log(`  interactions: ${interactions}, events4: ${events4}`);
  console.log(`  diffTrack: ${(entry.diffTrack||'').length}c`);
}

const outPath = path.join(DIR, 'event_js/mouse_pool.json');
fs.writeFileSync(outPath, JSON.stringify(pool, null, 2));
console.log(`\n写入: ${outPath} (${pool.length} entries)`);
