# Grubhub 专用脚本

一套**预配置 Grubhub** 的脚本 —— 路径写死、TAG 写死、一行命令出结果。

## 目录结构

```
stample/grub/
├── sample/          ← 6 批抓包数据（READMEs 已在那）
├── source/          ← Grubhub SDK 锁定（init.js + SDK_INFO.md）
├── px_cookie/       ← _px2 cookie 生成器
└── script/          ← 本目录（8 个工具 + README）
```

## 脚本一览

| 脚本 | 用途 | 用法示例 |
|---|---|---|
| **`decode_one.sh`** | 解一个批次（payload + response 全 4 个文件） | `./decode_one.sh 1` |
| **`decode_all.sh`** | 解全部 6 批（一行命令） | `./decode_all.sh` |
| **`diff_samples.py`** | 6 批 EV 字段三分类（STATIC/DYNAMIC/CONDITIONAL） | `python diff_samples.py 2` （EV2） |
| **`diff3.js`** | 6 批四分类（含 "common" 子类） | `node diff3.js` |
| **`find_state_keys.py`** | ⭐⭐⭐ state.\* → EV2 b64 key 值匹配（Stage 5） | `python find_state_keys.py` |
| **`compare_my_ev2.py`** | 我生成的 EV2 vs sample/1 真抓 EV2 逐字段对比 | `python compare_my_ev2.py /tmp/my_ev2.json` |
| **`diff_http.py`** | 我生成的 POST vs sample/1 真抓 POST 字节级 diff | `python diff_http.py /tmp/my_post.txt` |
| **`verify_all.sh`** | 验证 6 批解码闭环（回归测试） | `./verify_all.sh` |

> ⚠️ Grubhub 一次会话只有 2 个 collector POST（iFood 是 3 个），所以
> `decode_one.sh` 只解 `request_1/2.txt` + `response_1/2.json`，没有 `_3`。

## 标准使用流程

### 1. 从零开始：解码 + 字段分类（5 分钟）

```bash
cd stample/grub/script

# Step 1: 解所有 6 批
./decode_all.sh
# → sample/{1..6}/ 每批生成 4 个 decoded_*.json

# Step 2: 跑字段三分类
python diff_samples.py 1          # EV1（12 字段）
python diff_samples.py 2          # EV2（~205 字段）
# → ../field_classes_ev1.json + ../field_classes_ev2.json

# Step 3: 找 state.* 注入位置（关键）
python find_state_keys.py
# → ../state_key_map.json
# 预期看到（跟 iFood 完全不同）：
#   state.no    → UT0ndxdcJUQ=   6/6 ✓
#   state.to    → UBxmVhZ+Z2U=   6/6 ✓
#   state.appId → CXV/P0wRfwU=   6/6 ✓
```

### 2. 写好 generator 后：验证它（10 分钟）

```bash
# 把你的生成器输出存为 my_post.txt + my_ev2.json，然后：

# 跟真抓的 POST 对比
python diff_http.py /path/to/my_post2.txt
# → ❌🤖 user-agent 我少了 / ❌🌐 我多了 cs 字段 / payload_len 差 24 bytes

# 跟真抓的 EV2 字段级对比
python compare_my_ev2.py /path/to/my_ev2.json
# → ⚠️ UT0ndxdcJUQ= value mismatch (mine='1779...' real=1779...)
#   ☝️ 这种典型是 string vs number — 应 parseInt

# 跑全 6 批解码回归测试
./verify_all.sh
```

### 3. 调试拿不到 `_px2`

```bash
# 流程图：
#
# collector 返 200 但 do:null 永远没 _px2
#         ↓
# python compare_my_ev2.py /tmp/my_ev2.json
#         ↓
# 看输出哪个 ⚠️ 字段不对 → 改 generator
#         ↓
# 重生成 → python diff_http.py /tmp/my_post2.txt
#         ↓
# 全 ✓ → 应该拿到 cookie 了
```

## Grubhub 常量（脚本里都写死了，列在这供参考）

| 常量 | 值 |
|---|---|
| AppID | `PXO97ybH4J` |
| TAG | `FmYgK1gdJEAP` |
| FT | `359` |
| Cookie | `_px2` (ttl 500) |
| Collector | `sensor.grubhub.com/O97ybH4J/xhr/api/v2/collector` |
| SDK SHA | `5e81bffc53ba95808ae81795358d8b71d3b5ba9ebfdaa013ff65ecafa278aad1` |
| OB wire chars | `o` + `I`（老版） |

⚠️ 旧文档把 AppID 写成 `PXdRotaCw0` / FT 写成 `330` —— 都错了。
见 [`../source/SDK_INFO.md`](../source/SDK_INFO.md)。

## 配套资源

| 想看什么 | 去哪 |
|---|---|
| EV2 字段语义 | [`../../../main/ZH/PX_SDK_逆向技术文档.md`](../../../main/ZH/PX_SDK_逆向技术文档.md) 附录 E |
| 通用方法论（这些脚本怎么用、为什么这么用） | [`../../../main/ZH/PX_逆向方法论_通用版.md`](../../../main/ZH/PX_逆向方法论_通用版.md) |
| iFood 同款脚本对照 | [`../../ifood/script/`](../../ifood/script/) |
| 通用版脚本（不写死 Grubhub 的） | [`../../../skill/AI_re/scripts/`](../../../skill/AI_re/scripts/) |
| 怎么重抓 6 批 | [`../../../skill/cdp/scripts/capture_via_cdp_grubhub.py`](../../../skill/cdp/scripts/capture_via_cdp_grubhub.py) |
| 19 条踩坑 | [`../../../skill/AI_re/references/gotchas.md`](../../../skill/AI_re/references/gotchas.md) |

---

*这些脚本是从 Grubhub 2026-05 实战逆向中提炼的，全部 Grubhub 路径/常量已写死。
通用版（拿 TAG 作参数）见 `skill/AI_re/scripts/`。*
