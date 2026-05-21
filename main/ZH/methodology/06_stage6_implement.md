# Stage 6: Implement — 写 generator（模板法）

> **时间预算**：熟练 1 h，第一次 4 h
> **产出**：`<site>_px3.js` —— 端到端 cookie generator
> *融合*: C/§5（实战）+ B/06_stage6_implement + A/§11（模板法 + 算法层）

---

## 章节定位

到这一章你已经有：
- 9 个算法模块 (`../../../revers/`)
- 锁定 SDK + 6 批样本 + decoded JSON
- `field_classes_ev2.json` (170/32/25 分类)
- `state_key_map.json` (7 字段映射)
- `<site>_ev2_template.json` (cold-visit 模板)

**这章把它们粘起来，写一个 generator**。

---

## 6.1 核心策略：**模板法**

> **STATIC 字段从模板拷贝，DYNAMIC 字段算法生成。**

```javascript
// generator 伪代码
async function generatePx3(site) {
    // 1. Load template
    const ev2 = deepClone(loadTemplate(`${site}_ev2_template.json`));

    // 2. Generate dynamic context
    const uuid = uuidV1();
    const initTs = Date.now();
    const ua = USER_AGENT;

    // 3. Collector#1 — EV1 + state injection
    const ev1 = buildEv1(uuid, initTs, ua);
    const response1 = await postCollector(payload(ev1), pc(ev1), sid(uuid), 1);
    const state = parseOBState(response1.body);
    // state = { no, appId, to, qa, vid, pxsid, jf }

    // 4. Override DYNAMIC fields in ev2 template
    overrideDynamicFields(ev2, {
        state,
        uuid,
        initTs,
        ua,
        keyMap: loadStateKeyMap(site)
    });

    // 5. Anti-tamper
    applyAntiTamper(ev2, state);

    // 6. Collector#2 → _px3
    const response2 = await postCollector(payload(ev2), pc(ev2), sid(uuid), 2);
    const _px3 = parseOBCookie(response2.body, '_px3');

    return _px3;
}
```

详见 [`../../../stample/ifood/px_cookie/ifood_px3.js`](../../../stample/ifood/px_cookie/ifood_px3.js) 完整实现。

---

## 6.2 DYNAMIC 字段覆盖（按子类）

### 6.2.1 时间戳字段（4 个）

```javascript
function overrideTimestamps(ev2, initTs) {
    const sendTs = initTs + randInt(200, 4500);   // 200ms-4.5s 后发出
    const perfNow = sendTs - initTs;

    ev2.d[KEY_INIT_TIME] = initTs.toString();
    ev2.d[KEY_SEND_TIME] = sendTs.toString();
    ev2.d[KEY_PERF_NOW]  = perfNow.toString();
    ev2.d[KEY_DATE_STR]  = new Date(initTs).toString();
}
```

`KEY_INIT_TIME` 等通过 Stage 4 的 grep + Stage 5 的值匹配确定。

### 6.2.2 UUID + HMAC（4 个）

```javascript
const uuid = uuidV1();   // session UUID, fixed for whole session
const hmacUuid = hmacMd5(ua, uuid);
const hmacVid = hmacMd5(ua, state.vid);
const hmacPxsid = hmacMd5(ua, state.pxsid);

ev2.d[KEY_UUID]       = uuid;
ev2.d[KEY_HMAC_UUID]  = hmacUuid;
ev2.d[KEY_HMAC_VID]   = hmacVid;
ev2.d[KEY_HMAC_PXSID] = hmacPxsid;
```

### 6.2.3 state.* 注入（7 个）⭐ Stage 5 关键产物

```javascript
const keyMap = loadStateKeyMap(site);

ev2.d[keyMap.no]    = parseInt(state.no);     // ⚠️ 必须 parseInt！见踩坑 #14
ev2.d[keyMap.appId] = state.appId;
ev2.d[keyMap.to]    = state.to;
ev2.d[keyMap.qa]    = state.qa;
ev2.d[keyMap.vid]   = state.vid;
ev2.d[keyMap.pxsid] = state.pxsid;
ev2.d[keyMap.jf]    = state.jf;
```

⚠️ **`state.no` 必须 `parseInt()`！** 服务端返回 number，OB 解码后是 string，写入 EV2 时必须转回 number 否则 PC 算错。这条坑花了 3 小时（见 [`../../../bug_report/1_collector_path.md`](../../../bug_report/1_collector_path.md) #14）。

### 6.2.4 Anti-tamper（2 个）

```javascript
// 公式: te(seed, n)
const noModN = parseInt(state.no) % 10;
const keyOffset = noModN + 2;
const valueOffset = noModN + 1;

const atKey = te(state.to, keyOffset);
const atValue = te(state.to, valueOffset);

// 注入 — atKey 本身就是 EV2 的字段名
ev2.d[atKey] = atValue;
```

详见 [`../../../revers/antitamper.js`](../../../revers/antitamper.js)。

### 6.2.5 Memory 字段（3 个）

```javascript
ev2.d[KEY_USED_JS_HEAP]   = randInt(30_000_000, 80_000_000);
ev2.d[KEY_TOTAL_JS_HEAP]  = randInt(80_000_000, 150_000_000);
ev2.d[KEY_JS_HEAP_LIMIT]  = 4294967296;   // 固定值（2^32），所有 Chrome 都是这个
```

详见 [`../../../revers/memory.js`](../../../revers/memory.js)。

### 6.2.6 计数器（5 个）

```javascript
ev2.d[KEY_SEQ]          = randInt(2, 8);
ev2.d[KEY_PERF_MARK]    = randInt(4000, 9000).toString();
ev2.d[KEY_COUNTER_1]    = randInt(1, 4);
ev2.d[KEY_COUNTER_2]    = randInt(0, 3);
// ...
```

### 6.2.7 /ns 字段（2 个）

```javascript
const ns = await fetchNs(uuid);   // 异步拿 /ns 响应
ev2.d[KEY_NS_SM]       = ns.sm;       // null 是 OK 的（坑 #25）
ev2.d[KEY_NS_DURATION] = ns.duration; // 0 是 OK 的
```

### 6.2.8 错误栈（1 个）

```javascript
ev2.d[KEY_ERROR_STACK] = TYPEERROR_STACK_TEMPLATE;
// 从抓包提取的固定字符串，详见 ../../../revers/payload.js 中的常量
```

### 6.2.9 timing chain（1 个）

```javascript
ev2.d[KEY_TIMING_CHAIN] = [109, 66, 66, 70, 80, randInt(60, 90)].join('|');
```

### 6.2.10 ENTROPY（Canvas / WebGL / Audio 指纹 hash，~5 个）

```javascript
// 当 STATIC 处理 —— 用浏览器抓出来的固定值
// 不要尝试在 Node 算！会被检测到（详见 bundle/doc/Bundle_完整技术文档.md §10.8）
ev2.d[KEY_CANVAS_HASH] = CANVAS_HASH_FROM_TEMPLATE;
ev2.d[KEY_WEBGL_HASH]  = WEBGL_HASH_FROM_TEMPLATE;
ev2.d[KEY_AUDIO_HASH]  = AUDIO_HASH_FROM_TEMPLATE;
```

---

## 6.3 序列化与发送

### 6.3.1 PX 自定义 serialize

```javascript
const { serialize, encryptPayload } = require('../../../revers/payload.js');

const ev2Json = serialize(ev2);   // ⚠️ 不是 JSON.stringify
const ev2Encrypted = encryptPayload(ev2Json, TAG);
```

### 6.3.2 PC（HMAC-MD5 完整性校验）

```javascript
const { computePC } = require('../../../revers/pc.js');
const pc = computePC(ev2Encrypted, TAG);
```

### 6.3.3 SID（Unicode Tag 隐写）

```javascript
const { encodeSid } = require('../../../revers/sid.js');
const sid = encodeSid(uuid);
```

### 6.3.4 POST

```javascript
const body = `payload=${encodeURIComponent(ev2Encrypted)}&pc=${pc}&sid=${sid}&ft=${FT}`;
const response = await fetch(`https://${COLLECTOR_HOST}/api/v2/collector?app=${APP_ID}&tag=${TAG}&...`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
});
```

详见 [`../../../stample/ifood/px_cookie/ifood_px3.js`](../../../stample/ifood/px_cookie/ifood_px3.js) `postCollector()`。

---

## 6.4 _px3 cookie 提取

```javascript
const { decodeOB, extractCookie } = require('../../../revers/ob.js');

const ob = await response.text();
const segments = decodeOB(ob, TAG);
const _px3 = extractCookie(segments, '_px3');
// 形式: { value, expires, domain, path, ... }
```

详见 [`../../../revers/ob.js`](../../../revers/ob.js)。

---

## 6.5 防写错的"对比验证模式"

写完 generator 后，在 Stage 7 跑通前，**先做一次对比验证**：

```javascript
// generator 生成 EV2
const evMy = generateEv2(uuid='c83577f0-...', initTs=1771962830422, ...);

// 跟某批真抓的 EV2 对比
const evReal = loadDecoded('samples/1/decoded_payload_2.json');

const diff = diffJson(evMy, evReal);
console.log(diff);   // 期望: 只有 DYNAMIC 字段不同，STATIC 全相同
```

如果有 STATIC 字段不一致 → 你模板加载错了。
如果有 DYNAMIC 字段在 generator 里**缺失**（key 在 evReal 有但 evMy 没有） → 你 Stage 4 / 5 漏了字段。
如果 type 不一致（number vs string） → 这是 PX 最常见的 silent bug。

---

## 6.6 Anti-tamper 完整调用顺序

```
1. parseInt(state.no) % 10 → noModN
2. atKey = te(state.to, noModN + 2)
3. atValue = te(state.to, noModN + 1)
4. ev2.d[atKey] = atValue
5. serialize(ev2) → ev2Json
6. encryptPayload(ev2Json, TAG) → payload=
7. computePC(ev2Encrypted, TAG) → pc=
8. POST collector#2
```

**顺序错了一步 → PC 算错 → 服务端拒**。

---

## 6.7 模板更新策略

`<site>_ev2_template.json` 不是永久的：

| SDK 变化 | 模板需要重做？ |
|---|---|
| 小版本（每周补丁） | 通常不需要 |
| 大版本（每月） | 需要 — 重抓 1 批，确认字段数一致；如果新增字段，补到模板 |
| 大版本 + b64 key 字典变 | **整套重做**（Stage 1 → 5 → 6） |

模板 freshness：**每月跑一遍 Stage 7，如果还能 _px3 验证通过，就不用更新**。

---

## 6.8 跨平台移植（轻提，详见 [`08_cross_platform.md`](08_cross_platform.md)）

- Node ✓ — 本项目主目标
- Python — 需要把 `revers/*.js` 翻译成 Python（MD5/HMAC/UUID/base64 都有标准库，大约 1-2 天工作量）
- Go — 类似，大约 1-2 天
- C# / Java — 类似

**关键**：保持算法层的 9 个模块跨语言一致。

---

## 6.9 Stage 6 完成标准 ✓

| 项 | 验证 |
|---|---|
| ✅ `<site>_px3.js` 写好 | 可调用 generatePx3() |
| ✅ 对比验证通过 | generator EV2 vs 真抓 EV2，STATIC 全等 |
| ✅ DYNAMIC 字段不缺 | generator EV2 包含所有 32 个 DYNAMIC key |
| ✅ Type 都对 | parseInt 该转 number 的转，state.* 都正确转 |
| ✅ Anti-tamper key 计算正确 | 跨 6 批样本对比 atKey 一致 |

---

## 6.10 进入 Stage 7

Stage 6 完成 → 你的 generator 能跑了，但还没在真网络上验证 → 进入 [Stage 7: Validate](07_stage7_validate.md)。
