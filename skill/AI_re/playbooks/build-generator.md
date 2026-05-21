# Playbook: 从 6 批抓包到能跑的 px_cookie 生成器

> 你已经有 5 个常量（APP_ID/TAG/FT/BI/Cookie）+ 6 批新鲜抓包。
> 本 playbook 把"从抓包到 generator 拿 cookie"的全流程拆成 8 个具体步骤。
>
> 预计时间：**3-8 小时**（含调试）

---

## 前置条件 checklist

跑这个 playbook 之前确认：

```bash
# ✅ 1. 项目里有 6 批抓包
ls stample/<site>/sample/{1..6}/request_1.txt | wc -l   # 应 6

# ✅ 2. 6 批 SDK SHA 一致
for i in 1 2 3 4 5 6; do
    jq -r '.sdk_sha256' stample/<site>/sample/$i/meta.json
done | sort -u   # 应只有 1 行

# ✅ 3. SDK 文件就位
ls stample/<site>/source/main.min.js

# ✅ 4. 5 个常量已知
echo "APP_ID=$APP_ID TAG=$TAG FT=$FT BI=${BI:0:20}... Cookie=$COOKIE"
```

少任何一个先去 [`extract-constants.md`](extract-constants.md) 或自己抓。

---

## Stage 1：解码所有 6 批样本（10 分钟）

对每批跑解码，输出 `decoded_payload_{1,2}.json` + `decoded_response_{1,2}.json`：

```bash
cd stample/<site>/sample
for i in 1 2 3 4 5 6; do
    node ../../../skill/AI_re/scripts/decode_payload.js  $i/request_1.txt \
        > $i/decoded_payload_1.json
    node ../../../skill/AI_re/scripts/decode_payload.js  $i/request_2.txt \
        > $i/decoded_payload_2.json
    node ../../../skill/AI_re/scripts/decode_response.js "$TAG" $i/response_1.json \
        > $i/decoded_response_1.json
    node ../../../skill/AI_re/scripts/decode_response.js "$TAG" $i/response_2.json \
        > $i/decoded_response_2.json
done
```

iFood 项目已有现成 wrapper：

```bash
cd stample/ifood/script
./decode_all.sh
```

### 校验：每批必须解出有效 JSON

```bash
for i in 1 2 3 4 5 6; do
    n=$(jq '.[0].d | keys | length' stample/<site>/sample/$i/decoded_payload_2.json 2>/dev/null)
    echo "batch $i EV2 字段数: $n"
done
# 期望: 每批 ~200 个字段
# 出 null 或 0 → 解码失败 → TAG 或 base64 处理错（看 gotchas.md #5）
```

---

## Stage 2：字段三分类（10 分钟）

对 6 批 EV2 做跨批次 diff，分 STATIC（每次都一样）/ DYNAMIC（每次都变）/ CONDITIONAL（部分批次有）：

```bash
node skill/AI_re/scripts/diff_samples.js \
    stample/<site>/sample/{1..6}/decoded_payload_2.json \
    --out field_classes_ev2.json
```

**典型输出**（iFood）：

```
STATIC      : 169 个字段   (81%) ← 直接抄模板
DYNAMIC     :  20 个字段   (10%) ← 要算法生成
CONDITIONAL :  14 个字段   ( 7%) ← warm visit 才有，cold 不发
其它        :   1 个字段   ( 1%) ← anti-tamper 槽
总计        : 204 个字段
```

⭐ **关注 DYNAMIC 那 20 个** — 这就是接下来要花时间搞定的所有"必须算法生成"的字段。

---

## Stage 3：构建 STATIC 模板（5 分钟）

用 batch 1 当 STATIC 模板（cold visit，最干净）：

```bash
# 取 batch 1 的 EV1 + EV2 当模板
cp stample/<site>/sample/1/decoded_payload_1.json templates/ev1_template.json
cp stample/<site>/sample/1/decoded_payload_2.json templates/ev2_template.json
```

或者用专门的 build_templates.js（带字段分类元数据）：

```bash
node skill/AI_re/scripts/build_templates.js \
    stample/<site>/sample/{1..6}/decoded_payload_{1,2}.json \
    --out templates/
```

---

## Stage 4：⭐⭐⭐ 找 state.\* 的注入位置（30-60 分钟）

**这是最关键也最容易踩坑的一步**。

state.\* 是从 OB#1 响应里解出来的（如 `state.no`、`state.to`、`state.appId`），
但它们要"注入"到 EV2 的具体 b64 key 位置 — **这映射没有算法可推，必须值匹配**。

```bash
python skill/AI_re/scripts/find_state_keys_in_ev2.py \
    --samples stample/<site>/sample \
    --batches 1 2 3 4 5 6 \
    > templates/state_key_map.json
```

**输出例子**（iFood）：

```json
{
    "state.no":      "RTEwewNQMUg=",   ← 6 批一致命中
    "state.to":      "FCAhKlJCIxk=",
    "state.appId":   "Xi5rJBtKaB4=",
    "state.qa":      "WjFqHE4WKzM=",
    "state.vid":     "PRkqQAphHTM=",
    "state.pxsid":   "XSkoMTBYbAM=",
    "state.cts":     "MykPYjwoaC8=",
    "state.o111val": "Y0BIcEM0NSI="
}
```

如果任何 state.X 没出来 → 看 [`../references/gotchas.md`](../references/gotchas.md) #1
（state.no 必须 parseInt 后再值匹配）+ #11（跨平台 b64 key 不同）。

---

## Stage 5：识别其它 DYNAMIC 字段语义（30-60 分钟）

20 个 DYNAMIC 字段里除了 state.\*（9 个），剩下 ~11 个是其它语义（HMAC、时间戳、UUID、memory 等）。

```bash
python skill/AI_re/scripts/identify_dynamic_semantics.py \
    field_classes_ev2.json \
    --samples stample/<site>/sample \
    > templates/dynamic_semantic_map.json
```

**输出例子**：

```json
{
    "VQEgCxNnKjw=": { "role": "initTime",        "algorithm": "Date.now()" },
    "bHgZcikfE0A=": { "role": "sendTime",        "algorithm": "initTime + 1-2s" },
    "NSEAa3NAC18=": { "role": "uuid_v1",         "algorithm": "uuidV1()" },
    "Czt+cU1WeEM=": { "role": "Date.toString()", "algorithm": "new Date().toString()" },
    "M2MGKXUOBB8=": { "role": "HMAC(uuid, UA)",   "algorithm": "hmacMD5(uuid, UA)" },
    "NABBSnJgQXE=": { "role": "memory.used",     "algorithm": "random(40_000_000, 140_000_000)" },
    ...
}
```

不能自动识别的字段（少数）需要手动看 SDK 源码：

```bash
node skill/AI_re/scripts/probe_dynamic.js \
    field_classes_ev2.json \
    hQ_map.json \
    stample/<site>/source/main.min.js
```

输出每个未识别字段在 SDK 哪里赋值，从上下文猜语义。

---

## Stage 6：写 generator.js（1-3 小时）

参考现成的（**强烈推荐 — 改改常量即可**）：

```bash
# 拷一份 iFood 现成的作为起点
cp stample/ifood/px_cookie/ifood_px3.js stample/<site>/px_cookie/<site>_pxN.js
```

在新文件里改 4 处：

```js
// 1. 常量
const APP_ID = '<新 AppID>';
const TAG    = '<新 TAG>';
const FT     = '<新 FT>';
const COLLECTOR_URL = 'https://collector-<lowercase AppID>.px-cloud.net/api/v2/collector';

// 2. 模板路径
const EV1_TEMPLATE = require('./templates/ev1_template.json')[0];
const EV2_TEMPLATE = require('./templates/ev2_template.json')[0];

// 3. state.* → EV2 b64 key 映射（用 Stage 4 的输出）
const STATE_KEY_MAP = require('./templates/state_key_map.json');

// 4. buildEv2() 里把 DYNAMIC 字段覆盖（用 Stage 5 的输出）
function buildEv2(ctx) {
    const e = JSON.parse(JSON.stringify(EV2_TEMPLATE));   // deep clone STATIC
    const d = e.d;

    // 用 Stage 4 的 state.* 映射
    d[STATE_KEY_MAP['state.no']]    = parseInt(ctx.state.no);   // ⭐ 必须 parseInt
    d[STATE_KEY_MAP['state.to']]    = ctx.state.to;
    d[STATE_KEY_MAP['state.appId']] = ctx.state.appId;

    // 用 Stage 5 的 DYNAMIC 映射
    d['<key for initTime>']   = ctx.initTime;
    d['<key for sendTime>']   = ctx.sendTime;
    d['<key for uuid>']       = ctx.uuid;
    d['<key for HMAC(uuid)>'] = hmacMD5(ctx.uuid, ctx.UA);
    // ... 等等

    // anti-tamper（必须**原位置**替换 key + value）
    return injectAntiTamper(e, ctx.state);
}
```

**关键提醒**（必读，每个都付出过 debug 时间）：

```js
// ❌ 错（永远 403）
d['RTEwewNQMUg='] = ctx.state.no;   // string

// ✅ 对
d['RTEwewNQMUg='] = parseInt(ctx.state.no);   // number
```

⭐ 看 [`../references/gotchas.md`](../references/gotchas.md) 必读 #1 + #3 + #4 + #5。

---

## Stage 7：本地 smoke test（5 分钟）

跑生成器，不打真 HTTP：

```bash
cd stample/<site>/px_cookie
node smoke_test.js  # 如果你写了 smoke 脚本，参考 ifood/px_cookie/smoke_test.js
```

或者最小 require 测试：

```bash
node -e "
const gen = require('./<site>_pxN.js');
console.log('loaded:', typeof gen);
// 不实际跑，只确保 require 不崩
"
```

如果有 `require` 错误 → 模板路径错 / reverse 模块路径错。

---

## Stage 8：⭐ 实战 10/10 验证（10-30 分钟）

```bash
node stample/<site>/px_cookie/<site>_pxN.js
```

预期输出：

```json
{
  "cookie_name": "_px3",
  "cookie_value": "eyJ1IjoiYWJjLi4uIn0=",
  "ttl": 330,
  "uuid": "...",
  "state": { "no": "...", ... },
  "ev1_fields": 14,
  "ev2_fields": 204
}
```

跑 10 次（间隔 ≥ 10 秒避免 IP throttle）：

```bash
for i in 1 2 3 4 5 6 7 8 9 10; do
    echo "── run $i ──"
    timeout 30s node stample/<site>/px_cookie/<site>_pxN.js | jq -r '.cookie_name + "=" + .cookie_value[0:30] + "..."'
    sleep 12
done
```

**通过标准**：10/10 全部输出 `_pxN=eyJ...` 形式。

---

## 失败诊断速查

按"症状 → 可能原因 → 修复"：

| 症状 | 看哪 |
|---|---|
| `collector#1 HTTP 403` | TLS fingerprint → 确认用 CDP 真 Chrome 不是脚本直发 |
| `collector#2 HTTP 200，do:null，没 _px3` | Stage 4 state.no 类型错（[gotchas #1](../references/gotchas.md)） |
| `collector#2 HTTP 200，有 _px3 但业务 API 还是 403` | EV2 多了/少了字段（[gotchas #11](../references/gotchas.md)） |
| `解码出来全是乱码` | TAG 或 base64 编码错（[gotchas #2 #4](../references/gotchas.md)） |
| `部分批次成功部分失败` | IP throttle，间隔 ≥ 10s（[gotchas #13](../references/gotchas.md)） |
| `跑一次能行，下次又不行` | UA 在 HMAC 跟 HTTP header 不一致（[gotchas #10](../references/gotchas.md)） |

完整 19 条详见 [`../references/gotchas.md`](../references/gotchas.md)。

---

## 进度跟踪表

| Stage | 时长 | 输出物 | 难点 |
|---|---|---|---|
| 1. 解码 6 批 | 10 min | 24 个 decoded_*.json | base64 + 的转义 |
| 2. 三分类 | 10 min | field_classes_ev2.json | 无 |
| 3. 模板 | 5 min | ev1/ev2_template.json | 无 |
| 4. state.* | 30-60 min | state_key_map.json | ⭐ 没算法可推 |
| 5. DYNAMIC 语义 | 30-60 min | dynamic_semantic_map.json | 部分要手动 |
| 6. 写 generator | 1-3 h | generator.js | 19 条 gotcha |
| 7. smoke test | 5 min | (通过) | 路径 |
| 8. 10/10 实战 | 10-30 min | (通过) | IP throttle |
| **总计** | **3-8 小时** | | |

---

## 配套资源

| 想看什么 | 去哪 |
|---|---|
| 5 大算法公式 | [`../references/algorithm-chain.md`](../references/algorithm-chain.md) |
| EV2 字段语义参考 | [`../../../main/ZH/PX_SDK_逆向技术文档.md`](../../../main/ZH/PX_SDK_逆向技术文档.md) 附录 E |
| 现成 iFood 生成器（最佳起点） | [`../../../stample/ifood/px_cookie/ifood_px3.js`](../../../stample/ifood/px_cookie/ifood_px3.js) |
| 9 个 reverse 算法模块 | [`../reverse/`](../reverse/) |
| 验证 / 排查 | [`validate-generator.md`](validate-generator.md) |

---

*成功跑出第一个 `_pxN=...` 时，把 `cookie_value` 喂给业务 API，
返回 200 → 全套完成。建议跑 10 次稳定性测试再说"做完了"。*
