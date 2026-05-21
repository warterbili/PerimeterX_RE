# Stage 1: 抓包准备

> **时间预算**：熟练 30 min，第一次 1 h
> **产出**：锁定 SDK + 9-10 批 cold-visit 抓包
> *融合*: C/§1（实战流程）+ A/§1（工具说明）+ B/01_stage1_capture（结构）

---

## 目标

你要拿到**确定不会变**的输入：

- 一份**锁定版**的 SDK（`main.min.js`），SHA256 已记录
- **9-10 批抓包**（每批两个 collector POST + 两个响应），同 SDK 版本

为什么必须锁定 SDK：PX 每次浏览器加载可能是新版本，**所有 base64 key 都会变**。如果你 6 批抓包来自 3 个 SDK 版本，你做出来的字段三分类是垃圾。

---

## 1.1 锁定 SDK 版本（必做）

PX 主 SDK URL：`https://client.px-cloud.net/<APP_ID>/main.min.js`

例：
- iFood: `https://client.px-cloud.net/PXO1GDTa7Q/main.min.js`
- Grubhub: `https://sensor.grubhub.com/O97ybH4J/init.js`（注意 Grubhub 文件名是 `init.js`）

### 方法 A: Chrome DevTools Local Overrides（推荐，最简单）

```
1. F12 打开 DevTools → Sources 标签
2. 左侧面板 → Overrides → Select folder for overrides → 选个空目录
3. 访问目标 URL（例：https://client.px-cloud.net/PXO1GDTa7Q/main.min.js）
4. 右键文件 → "Save for overrides"
5. 之后所有该文件的请求都会被本地副本覆盖
```

优点：UI 操作，无脚本。
缺点：只覆盖你这一个 Chrome profile，不能批量自动化。

### 方法 B: mitmproxy / Charles 重写

```python
# mitmproxy addon: lock_sdk.py
def response(flow):
    if 'px-cloud.net/PXO1GDTa7Q/main.min.js' in flow.request.url:
        with open('main_locked.js', 'rb') as f:
            flow.response.content = f.read()
```

优点：跨进程跨 profile，能批量自动化。
缺点：要装 mitmproxy + 配证书。

### 方法 C: CDP `Fetch.fulfillRequest`（自动化测试用）

参考本项目 [`../../../skill/cdp/scripts/`](../../../skill/cdp/scripts/) 实现。最灵活但代码量大。

### 1.1.x 记录 SHA256（必做）

```bash
sha256sum main.min.js
# b47a639cde9df4f91bdc4138ae0d64ebf7ce8c876a1e4c9967fd3af3d2975eb8

# 存到 SDK_INFO.md
echo "# iFood SDK Lock" > SDK_INFO.md
echo "" >> SDK_INFO.md
echo "| SHA256 | $(sha256sum main.min.js | cut -d' ' -f1) |" >> SDK_INFO.md
echo "| Size | $(stat -c%s main.min.js) bytes |" >> SDK_INFO.md
echo "| Captured | $(date -u +%Y-%m-%d) |" >> SDK_INFO.md
```

参考 [`../../../stample/ifood/source/SDK_INFO.md`](../../../stample/ifood/source/SDK_INFO.md) 格式。

---

## 1.2 准备 base 工具

| 工具 | 用途 | 安装 |
|---|---|---|
| `node` ≥ 18 | 跑 reverse 模块 + 解码工具 | nodejs.org |
| Chrome / Edge（带 DevTools） | 抓真实流量 | 浏览器 |
| Python 3 + `websockets` | cdp-browser skill | `pip install websockets` |
| 一个干净的脚本编辑器 | 写代码 | VS Code 等 |
| `mitmproxy`（可选） | 流量审计 + SDK 锁定 | `pip install mitmproxy` |
| `jq`（可选） | JSON 处理 | OS package |

本项目自带的工具：

```bash
# 9 个算法模块
ls ../../../revers/
# antitamper.js  hash.js  memory.js  ns.js  ob.js  payload.js  pc.js  sid.js  uuid.js

# 14 个 CLI 脚本
ls ../../../skill/AI_re/scripts/
```

---

## 1.3 抓 9-10 次样本

### 为什么 9-10 次

- **1-2 次** → 区分不出 STATIC vs DYNAMIC（很多字段恰好同值）
- **3-5 次** → 能区分 STATIC vs DYNAMIC，但 CONDITIONAL 字段容易漏判
- **6+ 次** ⭐ → 稳定区分 4 类：STATIC / DYNAMIC / CONDITIONAL / ENTROPY
- **9-10 次** → 能识别罕见分支（比如某个 1/8 概率才出现的字段）

**最少抓 6 次，推荐 9 次**。

### 抓包步骤（每次）

```
0. 打开 Chrome 隐身窗口 ⭐⭐⭐（每次都重开，cookies 清干净）
1. F12 → Network → 勾 "Preserve log" → Filter 输入 "/api/v2/collector"
2. 访问 https://www.ifood.com.br/restaurantes（或目标站）
3. 等 5-10 秒
4. 看到 2-3 个 collector POST 请求（rsc=1, rsc=2, [rsc=3]）
5. 每个请求：右键 → Copy → Copy as cURL (bash) → 保存为 request_N.txt
6. 每个响应：复制 Response body → 保存为 response_N.json
7. 记录 meta：UUID、时间戳、SDK SHA256
```

> ⚠️ **必须用隐身窗口**：常规 Chrome 会保留 `_pxvid` cookie → PX 识别为 warm visit → 某些字段（如 `pxhd`）填值跟 cold visit 不同 → 你的"STATIC 模板"被污染。**这是最常被忽视的步骤**。

### 目录结构推荐

镜像本项目 [`../../../stample/ifood/sample/`](../../../stample/ifood/sample/) 结构：

```
stample/<site>/sample/
├── 1/
│   ├── request_1.txt           collector#1 curl
│   ├── response_1.json         collector#1 response
│   ├── request_2.txt           collector#2 curl
│   ├── response_2.json         collector#2 response
│   ├── request_3.txt           collector#3 curl（可选，EV3 行为追踪）
│   ├── response_3.json
│   ├── meta.json               { uuid, ts, sdk_sha256, ... }
│   └── decoded_*.json          ← Stage 2 解码后存这里
├── 2/
│   ...
└── 6/
```

`meta.json` 格式参考 [`../../../stample/ifood/sample/1/meta.json`](../../../stample/ifood/sample/1/meta.json)：

```json
{
  "site": "ifood.com.br",
  "uuid": "c83577f0-5420-11f1-9150-e1cff29e25cc",
  "captured_at": "2026-05-20T14:32:18Z",
  "sdk_sha256": "b47a639c...",
  "warm_visit": false,
  "collector_count": 3
}
```

### 自动化抓包（推荐）

手动抓 6 批很累。本项目有 CDP 自动化脚本：

```bash
# 用 cdp-browser skill 自动抓 N 批
cd ../../../skill/cdp/scripts/
python capture_via_cdp_ifood.py --batches 6 --out ../../../stample/ifood/sample/
```

详见 [`../../../skill/cdp/SKILL.md`](../../../skill/cdp/SKILL.md)。

---

## 1.4 验证抓包完整性

跑完抓包后用 `verify_all.sh` 检查每批文件齐全：

```bash
cd ../../../stample/ifood/script/
./verify_all.sh
# 期望: 6/6 通过
```

如果某批文件不齐，回去重抓。

---

## 1.5 Stage 1 完成标准 ✓

| 项 | 验证 |
|---|---|
| ✅ SDK 锁定 | `sha256sum main.min.js` 输出固定 |
| ✅ SDK_INFO.md 记录 | 包含 SHA + Size + Captured |
| ✅ 6+ 批抓包 | 每批含 request/response/meta 完整 |
| ✅ 所有批次同 SDK | meta.json 里的 `sdk_sha256` 全相同 |
| ✅ 全是 cold visit | meta.json `warm_visit: false`，每批用新隐身窗口 |
| ✅ 响应都是 status=200 | curl 提取的响应都是成功的 |

---

## 1.6 常见陷阱

| 症状 | 原因 | 修复 |
|---|---|---|
| 6 批字段三分类后 STATIC 字段奇高（90%+） | 抓包没清 cookie，全是 warm visit | 用隐身窗口重抓 |
| 部分批次 collector#2 拿不到 cookie | IP 评分掉了 / 频率太高 | 换 IP / 加间隔（≥ 30s/批） |
| SDK SHA 跨批不一致 | PX 中途升级了 SDK | 用 Local Overrides 锁定 |
| `meta.json` 没记 UUID | 抓包脚本旧版本 | 升级抓包脚本，从 POST body 直接 grep `uuid=` |

---

## 1.7 进入 Stage 2

Stage 1 完成 → 你有锁定 SDK + 6+ 批样本 → 进入 [Stage 2: 解码](02_stage2_decode.md)。
