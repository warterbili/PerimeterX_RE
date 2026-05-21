# 附录 A：14 个 CLI 工具速查

> 本项目 [`../../../../skill/AI_re/scripts/`](../../../../skill/AI_re/scripts/) 下的全部 CLI 工具。按 Stage 分组。
> *源自*: C/附录 A（原本就是工具书）

---

## Stage 1（抓包阶段）

### A.1 `capture_via_cdp_ifood.py` — 自动抓 N 批

```bash
python capture_via_cdp_ifood.py --batches 6 --site ifood --out ../../../stample/ifood/sample/
```

- 启 Chrome（无 webdriver 痕迹）
- 每批新隐身窗口 → 访问目标站 → 等 10s 抓 collector POST
- 自动落 `request_N.txt` / `response_N.json` / `meta.json`

### A.2 `verify_batch.js` — 检查单批完整性

```bash
node verify_batch.js samples/1/
# 期望: ✓ request_1.txt (4521 bytes)
#       ✓ response_1.json (1843 bytes)
#       ✓ request_2.txt (62718 bytes)
#       ✓ response_2.json (4319 bytes)
#       ✓ meta.json (UUID + ts present)
```

### A.3 `verify_all.sh` — 检查所有 6 批

```bash
./verify_all.sh
# 输出: 6/6 通过 ✓
```

---

## Stage 2（解码阶段）

### A.4 `decode_payload.js` — payload= 还原成 JSON

```bash
node decode_payload.js samples/1/request_1.txt > samples/1/decoded_payload_1.json
```

参数：
- `--tag <TAG>` 显式给 TAG（默认从 URL 提取）
- `--xor-key <N>` 显式给 XOR key（默认 `parseInt(ml(TAG)) % 128`）

### A.5 `decode_response.js` — OB 响应还原

```bash
node decode_response.js samples/1/response_1.json > samples/1/decoded_response_1.json
```

输出包含：
- `state.*` 7 字段
- `_px3 cookie segment`（如果有）
- 全部 27 个 handler 段

### A.6 `decode_one.sh` — 一批 4 文件全解

```bash
./decode_one.sh 1
# 等价于 4 个 decode_* 调用
```

### A.7 `decode_all.sh` — 6 批全解

```bash
./decode_all.sh
# 解 samples/{1..6}/*.txt → samples/{1..6}/decoded_*.json
```

---

## Stage 3（分类阶段）

### A.8 `diff_samples.py` — 跨批字段三分类

```bash
python diff_samples.py 2     # EV2
python diff_samples.py 1     # EV1
# 输出: STATIC/DYNAMIC/CONDITIONAL 比例 + field_classes_ev{N}.json
```

参数：
- `--samples-dir <path>` 样本目录（默认 ../sample/）
- `--out <path>` 输出 JSON 路径

---

## Stage 4（语义定位阶段）

### A.9 `extract_hQ.js` — 提取查表函数映射

```bash
node extract_hQ.js ../source/main.min.js > ../px_cookie/hQ_map.json
# 输出: 1000+ 条 index → 字符串 映射
```

### A.10 `lookup_keys.js` — 反查 b64 key → SDK 上下文

```bash
node lookup_keys.js RTEwewNQMUg= ../source/main.min.js ../px_cookie/hQ_map.json
# 输出: 找到 hQ(212) = "RTEwewNQMUg=" → SDK line 35621 上下文
```

### A.11 `probe_dynamic.js` — 批量探查所有 DYNAMIC 字段

```bash
node probe_dynamic.js \
    ../field_classes_ev2.json \
    ../px_cookie/hQ_map.json \
    ../source/main.min.js > dynamic_locations.txt
# 输出: 每个 DYNAMIC 字段在 SDK 中的赋值上下文
```

---

## Stage 5（值匹配阶段）

### A.12 `find_state_keys.py` — state.* → EV2 b64 key 映射

```bash
python find_state_keys.py
# 输出: state_key_map.json，含 7 字段映射
```

---

## Stage 6/7（实现 + 验证阶段）

### A.13 `<site>_px3.js` — 端到端 generator

```bash
node ../px_cookie/ifood_px3.js
# 输出: _px3=<long base64> ✓
```

参数（环境变量）：
- `USER_AGENT` — 自定义 UA
- `HTTP_PROXY` — 代理
- `DEBUG=1` — 打开调试日志

### A.14 `smoke_test.sh` — 端到端稳定性测试

```bash
./smoke_test.sh ifood 10
# 跑 10 次，输出: 10/10 ✓
```

参数：
- `--ua-list <file>` 跨 UA 测试
- `--proxy-list <file>` 跨代理测试

---

## 跨 Stage 工具

### `bug_log.py` — 一键查踩坑库

```bash
python bug_log.py "PC mismatch"
# 输出: bug_report/1_collector_path.md 相关条目（#5, #14, #22）
```

### `golden_test.js` — 算法层测试套件

```bash
node golden_test.js
# 跑 100 个 test vectors，输出: 100/100 ✓
```

---

## 工具依赖关系

```
verify_all
├── verify_batch (per batch)
    └── 检查文件齐全 + meta.json

decode_all
├── decode_one (per batch)
    ├── decode_payload (request_1/2)
    └── decode_response (response_1/2)

diff_samples
└── 输入: samples/{1..6}/decoded_*.json
└── 输出: field_classes_ev{1,2}.json

extract_hQ
└── 输入: source/main.min.js
└── 输出: hQ_map.json

probe_dynamic
├── 输入: field_classes_ev2.json
├── 输入: hQ_map.json
└── 输入: source/main.min.js

find_state_keys
├── 输入: samples/{1..6}/decoded_*.json
├── 输入: state_key_map_lookup.json (可选)
└── 输出: state_key_map.json

<site>_px3.js
├── 输入: ev2_template.json
├── 输入: state_key_map.json
├── 输入: 9 个 revers/ 模块
└── 输出: _px3 cookie
```

---

## 工具源码定位

每个工具的实现见 [`../../../../skill/AI_re/scripts/`](../../../../skill/AI_re/scripts/)。

下一节：[Appendix B: 关键算法伪代码](B_algorithms.md)。
