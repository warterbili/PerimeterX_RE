# Stage 3: 字段三分类

> **时间预算**：熟练 30 min，第一次 2 h
> **产出**：每个 EV 字段标记 STATIC / DYNAMIC / CONDITIONAL，分类 JSON 文件
> *融合*: C/§4（实战）+ B/03_stage3_classify（结构）+ A/§10（分类规则）

---

## 目标

把 ~220 个字段分 3 类，**让 Stage 6 知道"哪些字段照抄模板 / 哪些字段算法生成"**：

| 类别 | 比例 | 处理 |
|---|---|---|
| **STATIC** | ~75% (170/228) | 6 批同值 → 直接抄模板 |
| **DYNAMIC** | ~15% (32/228) | 6 批值不同 → 算法生成 |
| **CONDITIONAL** | ~10% (25/228) | 部分批次缺 → warm visit 字段，冷访可忽略 |

**这一步省后面 Stage 6 写代码时 80% 的时间**。

---

## 3.1 跨批 diff 脚本

```bash
cd ../../../stample/ifood/script/
python diff_samples.py 2   # 看 EV2 (主要)
# 输出:
#   STATIC      :  171 个字段
#   DYNAMIC     :   32 个字段
#   CONDITIONAL :   25 个字段
#   总计        :  228 个字段
# 写入: ../field_classes_ev2.json
```

也跑 EV1：

```bash
python diff_samples.py 1   # EV1
# STATIC      :  10
# DYNAMIC     :    4
# CONDITIONAL :    0
```

详细 diff 逻辑（伪代码）：

```python
samples = [batch1.ev2.d, batch2.ev2.d, ..., batch6.ev2.d]
all_keys = set().union(*[s.keys() for s in samples])

for k in all_keys:
    present_in = [i for i, s in enumerate(samples) if k in s]
    if len(present_in) < len(samples):
        result['conditional'][k] = {present_in, sample_value}
        continue
    values = [json.dumps(s[k]) for s in samples]
    if len(set(values)) == 1:
        result['static'][k] = samples[0][k]
    else:
        result['dynamic'][k] = {samples: [...]}
```

---

## 3.2 STATIC 字段（直接抄）

约 75% 的字段 6 批同值。包括：

| 类别 | 例 |
|---|---|
| 浏览器标识 | UA, navigator.platform, language |
| 屏幕显示 | screen.width/height, colorDepth |
| 硬件特征 | hardwareConcurrency, deviceMemory |
| 网络信息 | connection.effectiveType |
| API 支持检测 | 56 个 boolean 字段（"window.fetch" 存在吗等） |
| Bot 检测 | navigator.webdriver 等 42 个 boolean |
| 哈希字段 | Canvas/WebGL/Audio 指纹 hash（同 GPU 同浏览器固定） |

**STATIC 字段的处理**：用 batch6（最干净的 cold visit）做**模板 JSON**，直接 deep-clone 当 EV2 基线。

```bash
# 提模板（用 batch6）
cp samples/6/decoded_payload_2.json px_cookie/<site>_ev2_template.json
```

详细字段映射见 [`../../../revers/`](../../../revers/) 的算法模块代码 + [`../../../bundle/doc/Bundle_完整技术文档.md`](../../../bundle/doc/Bundle_完整技术文档.md) §10（229 字段完整分类）。

---

## 3.3 DYNAMIC 字段（要算法生成）

约 15% 字段每批值都不同。**这些是 Stage 6 要写代码生成的**。

实测 32 个 DYNAMIC 字段大致分类：

| 子类别 | 数量 | 例 | 怎么生成 |
|---|---|---|---|
| **时间戳** | 4 | initTime / sendTime / perfNow / dateString | `Date.now()` + 增量 |
| **UUID** | 1 | session uuid | `uuidV1()` |
| **HMAC** | 3 | HMAC(uuid, UA), HMAC(vid, UA), HMAC(pxsid, UA) | `crypto.createHmac('md5', UA).update(...)` |
| **state.\* 注入** | 4 | state.no, state.appId, state.to, state.qa | **从 OB#1 提取** ⭐ Stage 5 的事 |
| **anti-tamper** | 2 | key + value（每次值 + key 都变） | `te(state.to, state.no % 10 ± 1)` |
| **Memory** | 3 | usedJSHeapSize / totalJSHeapSize / jsHeapSizeLimit | 随机范围 30M-100M |
| **计数器** | ~5 | seq, perfMark, 各种 internal counter | 递增 / 随机 4-5 位数 |
| **/ns 结果** | 2 | sm + duration | `fetchNs(uuid)` 异步拿 |
| **错误栈** | 1 | TypeError stack | 浏览器抓的固定模板 |
| **timing chain** | 1 | `"109\|66\|66\|70\|80"` | 字符串拼时间戳差 |
| **performance.memory 数值** | 3 | 4294967296 等 | 实际硬编码 |
| **其它** | ~3 | 罕见状态字段 | 跟会话强相关 |

**关键 insight**：32 个 DYNAMIC 不是全要"算法生成" —— 其中 4 个 state.\* 来自 OB#1（Stage 5 解决）、3 个 HMAC 是机械计算、2 个 anti-tamper 公式确定。**真正难的是定位"哪个 b64 key 是什么语义"**，这是 Stage 4 的事。

---

## 3.4 CONDITIONAL 字段（部分批次缺）

约 10% 字段在 6 批里**有的批次出现有的不出现**。包括：

| 类别 | 出现规律 |
|---|---|
| `pxhd` cookie 字段 | 仅 warm visit 时出现，cold visit 为空 |
| 上一会话 state | 仅有上次会话残留时出现 |
| 重定向追踪字段 | 仅当用户从特定 referrer 来时 |
| performance entries | 浏览器 cache 命中时不同 |
| /ns sm 结果 | 仅 /ns 请求成功完成时（Collector#1 时大概率为 null） |

**处理原则**：**冷访问场景下这些可以是 null / 空 / 缺失**。模板用 cold visit 的 batch6，CONDITIONAL 字段不出现。

详见 [`../../../bug_report/1_collector_path.md`](../../../bug_report/1_collector_path.md) 第 #25 条（`/ns` 异步 sm/duration 是 null/0 正常）。

---

## 3.5 ENTROPY 子类（DYNAMIC 内的伪 DYNAMIC）

约 5-10 个字段在 6 批里值不同，但**同一个浏览器 profile + 同一个 GPU 下确定**。包括：

- Canvas fingerprint hash（依赖 GPU）
- WebGL fingerprint hash（依赖 GPU + driver）
- AudioContext fingerprint hash
- Font fingerprint hash

**处理**：当 STATIC 处理 —— 用 batch6 的值写死即可。**不要尝试在 Node 里重新算 Canvas/WebGL hash**（性能极差且容易错），用真浏览器抓出来固定值。

详见 [`../../../bundle/doc/Bundle_完整技术文档.md`](../../../bundle/doc/Bundle_完整技术文档.md) §10.8 哈希生成源码定位 + 伪造策略。

---

## 3.6 三分类输出格式

`diff_samples.py` 产出 `field_classes_ev2.json`：

```json
{
  "static": {
    "fyNFZTlCSFM=": false,
    "EwhjCVZnZTM=": "Win32",
    ...170 项
  },
  "dynamic": {
    "RTEwewNQMUg=": {
      "samples": ["1771962830422", "1771962850771", ...]
    },
    "M2MGKXUOBB8=": {
      "samples": ["abc123...", "def456...", ...]
    },
    ...32 项
  },
  "conditional": {
    "R3cyPQIVMAw=": {
      "present_in_batches": [3, 5],
      "sample_value": "<pxhd value>"
    },
    ...25 项
  }
}
```

这文件是 Stage 4-6 的**输入**。

---

## 3.7 Stage 3 完成标准 ✓

| 项 | 验证 |
|---|---|
| ✅ field_classes_ev2.json 生成 | 文件存在 |
| ✅ STATIC 占 ~75% | 170/228 ± 5 |
| ✅ DYNAMIC 占 ~15% | 32/228 ± 5 |
| ✅ CONDITIONAL 占 ~10% | 25/228 ± 5 |
| ✅ 没有"幽灵 STATIC" | 不应有"理论上应 DYNAMIC 但 6 批同值"的字段（如果有，说明 batch 之间不够独立，回 Stage 1 重抓） |

---

## 3.8 常见陷阱

| 症状 | 原因 | 修复 |
|---|---|---|
| STATIC 占 90%+，DYNAMIC 只 5% | 抓包没清 cookie，全是 warm visit | 隐身窗口重抓 6 批 |
| `pxhd` 在 6 批都有值 | 同上 | 同上 |
| `/ns` sm 字段全是 null | 抓包都是 cold visit，/ns 还没回 | **正常**，不是 bug（坑 #25） |
| DYNAMIC 字段类型不一致（有的 string 有的 number） | PX serialize bug 或抓包不一致 | 检查 type，可能是 PX 的 anti-replay 检测 |

---

## 3.9 进入 Stage 4

Stage 3 完成 → 你知道哪些字段是 DYNAMIC → 进入 [Stage 4: 字段语义定位](04_stage4_locate.md) 找它们在 SDK 哪里赋值。
