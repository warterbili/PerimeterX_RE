# ifood pxcookie 纯算生成器更新 — 工作日志

- **任务起始**: 2026-05-19
- **工作机**: Windows 11
- **项目路径**: `<author's private sourcing project>/ifood-web/`
- **目标**: 验证旧的 pxcookie 生成器是否仍可用；若失效则更新 SDK 常量/字段
- **附加任务**: 删除本地 commit `b52c30945ff80831b2b6f3043f2fcfe3a1120f2a`（项目需与 GitHub 保持一致）

## 记录规则（死命令）

1. 每一步操作（命令、修改、决策）必须立刻写入本文档
2. 每分钟至少强制记录一次心跳，避免遗漏
3. 失败/成功/中间结果都要记，不能只记结论

---

## 步骤 0 — 环境摸底（已完成）

### 0.1 项目结构

```
ifood-web/collector无感纯算还原/
├── auto/px_cookie.js          # 端到端入口
├── reverse/                   # 9 个算法模块 (payload/pc/ob/sid/uuid/hash/memory/antitamper/ns)
├── script/                    # decode_payload.js / decode_ob.js
├── #1/, #2/                   # 历史抓包样本
└── 纯算还原.md                # 1804 行完整逆向文档
```

### 0.2 SDK 当前常量（写死在 px_cookie.js 顶部）

| 常量 | 当前值 |
|---|---|
| AppID | `PXO1GDTa7Q` |
| TAG/GT | `DhI0E0h7J2cKHw==` |
| FT | `388` |
| Collector URL | `https://collector-pxo1gdta7q.px-cloud.net/api/v2/collector` |
| /ns URL | `https://tzm.px-cloud.net/ns?c={uuid}` |
| 默认 UA | `Mozilla/5.0 ... Chrome/145.0.0.0 ... Edg/145.0.0.0` |

### 0.3 PX 验证语义（来自纯算还原.md）

- collector#2 返回 `{"do":null}` → **服务端接受指纹（成功）**
- collector#2 返回 `{"do":[]}` → 被判定为 bot（失败）
- 最终 `_px3` 来源有两处：
  - ob#1 的 `set_cookie` handler（`args[0]=_px3, args[2]=value`）
  - ob#2 的 `bake|_px3|...` 字符串

---

## 步骤 1 — 删除本地未推送 commit b52c309（已完成）

### 1.1 情况确认

- commit 作者：Shudong Lu（本人，2026-05-18 17:49）
- 内容：Grubhub 登录链路改动（在 mail.tm JWT pre-check 之前先尝试 /auth/login）
- 状态：本地 main 比 origin/main `ahead 1`，**未推送到 GitHub**

### 1.2 执行

```bash
git reset --hard origin/main
# HEAD is now at ae9659b docs: mark TripAdvisor complete
```

执行后 `git status -sb` → `## main...origin/main`（与远端一致）✓

非破坏性，未涉及 force-push。

---

## 步骤 2 — 跑旧 pxcookie 测试（进行中）

### 2.1 首次运行

命令：

```bash
cd "<author's private sourcing project>/ifood-web/auto"
node px_cookie.js
```

输出：

```
_px3: NONE
_pxvid: 2f585873-52e7-11f1-a346-d4886dca4670
status: 200
response: {"do":null,"ob":"YjxiPGJiLzAm"}
```

### 2.2 解读

- `status: 200` + `{"do":null}` = **collector#2 服务端接受了指纹（核心算法仍然有效）**
- `_pxvid` 正确生成 → ob#1 解码 vid 成功
- `_px3: NONE` → ob#1 未提取出 `set_cookie` 段；ob#2 的 `do` 是 null 所以也没 bake 串

### 2.3 待查

- 旧版样本里 ob#1 是否本来就返回 `_px3`？还是 PX 升级后改成只在 ob#2 通过 `bake|_px3|` 下发？
- 如果服务器现在只通过另一种方式下发 `_px3`，需要调整提取逻辑

下一步：dump ob#1 原始解码内容，看所有段都包含什么。

---

## 步骤 3 — 配置 PostToolUse hook 强制提醒 + 保存全局记忆

### 3.1 动机

用户下死命令"每一步都要记录 + 每分钟强制心跳"，光靠 Claude 自觉不够，需要 hook 在每次工具调用后向 Claude 注入系统提醒。

### 3.2 操作

1. 在私有 sourcing 项目根下建项目级 `.claude` 目录
2. 写 `settings.local.json`：PostToolUse hook，matcher=`Bash|Edit|Write|Read|MultiEdit|NotebookEdit|Grep|Glob`，命令通过 stdout 输出 `{"hookSpecificOutput":{...,"additionalContext":"死命令记录提醒：..."},"suppressOutput":true}`
3. Pipe-test 命令：`echo '{...}' | bash -c "..."` → 输出 JSON 正常 ✓
4. Schema validate（用 node 代替 jq，本机无 jq）：matcher + command 都能读出 ✓

### 3.3 全局记忆同步

向项目级 `.claude` memory 目录写了两条记忆：

- `feedback_worklog_required.md` — WORKLOG 死命令规则
- `feedback_lookup_order.md` — 逆向查询优先级（宝典 → CDP → SDK 源码，禁止猜）

并建立 `MEMORY.md` 索引。

### 3.4 hook 验证结果

触发一次 Bash 命令后，**没有**收到 "死命令记录提醒" 注入 — 说明 settings watcher 没有跟踪新建的 `.claude/`，需要用户在 Claude Code 里执行 `/hooks` 或重启才能激活。**hook 已写好但本 session 暂不生效**，依靠 memory + 自觉硬记录。

---

## 步骤 4 — 用户方法论：4 步全链解码对比（进行中）

用户明确了方法论：
1. 拦截 #1 请求 → 解码 payload + pc (ev1)
2. 解码 #1 响应 → 检查 handler 函数表是否变化、字节表
3. 拦截 #2 请求 → 解码 payload + pc (ev2)
4. 解码 #2 响应 → 查看

### 4.1 第一步收获：ob#1 解码完成

debug 脚本 `px_cookie_debug.js` 跑了一次，ob#1 服务端响应：

```json
{"do":null,"ob":"PDxiPGI8L2ZkZmthZ2difmZhNmt+...(长串)"}
```

XOR key=83 (=`ml(GT)%128`)，分隔后**11 段**（旧宝典 resp1 只有 9 段）：

| # | handler 标签 | args | 解读 | 旧宝典 |
|---|---|---|---|---|
| 0 | `oo1o1o` | `[UUID]` | pxsid | resp3 才有 |
| 1 | `1o1o11` | `[cu]` | control_flag jf | ✓ resp1 |
| 2 | `ooo11o` | `[17853193978960284755]` | session_id (to) | ✓ resp1 |
| 3 | `o111oo1o` | `[1779129327660]` | timestamp (no) | ✓ resp1 |
| 4 | `o111o1` | `[d85lnrr7lo8c7398j5og]` | app_id | ✓ resp1 |
| 5 | `o111ooo1` | `[6425]` | unknown 4-5digit | ✓ resp1 |
| 6 | `o11o11o1` | `[UUID, true]` | cts | resp3 才有 |
| 7 | `1o1111` | `[64hex]` | challenge_hash (qa) | ✓ resp1 |
| **8** | **`oooo11`** | **`[UUID, 31536000, true]`** | **NEW: vid handler** | **resp3 (但格式不同？)** |
| 9 | `o1111o` | `[cc, 60, base64(SameSite=Lax;)]` | cookie_config | ✓ resp1 |
| 10 | `o111oo` | `[ai:0,uiii:0]` | feature_flags | ✓ resp1 |

### 4.2 🔴 关键变化（vs 旧宝典）

1. **`set_cookie` (handler `o11111`) 消失了！** — 旧 SDK 在 ob#1 resp1 通过 4-arg `[_px3, ttl, value, secure...]` 下发 `_px3`，新 SDK 没有这一段
2. **多轮响应合并为一轮** — 旧 SDK 是 collector#1 发 3 次（resp1/2/3）拿不同段，新 SDK 一次响应含 11 段（pxsid/cts/vid 都齐了）
3. **新增 vid handler `oooo11`** — 3 args 格式（UUID + 31536000 + true），ifood 的 decodeOb 已经能正确识别（pattern: `args.length===3 && UUID_RE + 数字`），所以 `_pxvid` 工作正常
4. ifood 的 decodeOb 还**没识别** `cookie_config (o1111o)` 和 `feature_flags (o111oo)`，但这俩不影响 collector#2

### 4.3 待回答的核心问题

既然 ob#1 不再下发 `_px3`，新 SDK 的 `_px3` 从哪里来？候选：

- (a) collector#2 响应的 `do` 数组里 `bake|_px3|...`（当前代码已尝试，但 `do:null` 说明这次没有）
- (b) collector#2 响应的 `ob` 字段（当前响应有 `"ob":"YjxiPGJiLzAm"`，12 字符，未解码 — 必须解码！）
- (c) 一个独立的 cookie 端点（如 `https://www.ifood.com.br/_px/...`）
- (d) 客户端用 vid + 其他 token 拼出来
- (e) 实际上 ifood 现在只需要 `_pxvid` + session，不再需要 `_px3` cookie

下一步先解码 (b)：把 collector#2 响应的 `ob` 字段也跑一次解码看里面是什么。同时把 ev1/ev2 拦截下来对比。

---

## 步骤 5 — 10 次抓包批量验证（已完成）

### 5.1 工具

- 改造 `px_cookie_debug.js`：每次跑保存 `samples/<N>/dump.json`（含 ev1/payload1/pc1/r1/ob1/state/ev2/payload2/pc2/sid/r2/ob2）
- 命令：`for i in 1..10; node px_cookie_debug.js $i; sleep 1; done`

### 5.2 结果（10/10 全部 status=200）

| sample | ob1 段数 | ob2 段数 | r2.body | px3 |
|---|---|---|---|---|
| 1-10 | 11 | 1 | `{"do":null,"ob":"YjxiPGJiLzAm"}` | NONE |

所有 sample 一致表现：
- ob#1 = 11 段（pxsid + jf + to + no + appId + o111val + cts + qa + vid + cookie_config + feature_flags）
- ob#2 = **永远是常量** `YjxiPGJiLzAm` = `1o1o11|cu`（一个 control_flag handler，值 "cu"）
- `{"do":null}` = 服务端接受
- **从来没有 `_px3` 下发**

### 5.3 推论

`_px3` 必然通过其他途径：
- (i) HTTP **`Set-Cookie` 响应头**（我们的 debug `post()` 没记录 headers，盲区！）
- (ii) collector#3 / collector#4 等额外端点（旧 SDK 没有，新 SDK 可能加了）
- (iii) 真实浏览器里 SDK 拼出来

### 5.4 ob#2 解码常量

```
"YjxiPGJiLzAm"
  → b64 decode (9 bytes) → 62 3c 62 3c 62 62 2f 30 26 (hex)
  → XOR(83) → "1o1o11|cu"
  → 1 segment, handler=1o1o11 (control_flag), args=["cu"]
```

含义：服务端用 control_flag 把客户端的 `jf` 状态保持为 "cu"。无 cookie 下发。

---

## 步骤 6 — 检查 Set-Cookie 头 + cdp 抓真实 SDK（进行中）

行动计划：
1. ✓ 给 debug `post()` 加 response headers — **collector#1/#2 都没有 Set-Cookie**
2. 走偏：陷入读 SDK 代码（main_pretty.js 9459 行）— 用户喊停 "走偏了"
3. 用户选定 → **cdp 抓真实浏览器流量**：打开 ifood.com.br，看真实 SDK 加载后浏览器里 `_px3` 是否真存在、值是什么、哪个请求设置的

### 6.1 已确认事实

- 当前 pxcookie 纯算 ≥9 次抓包稳定 status=200，`{"do":null}` 服务端接受指纹
- ob#1 共 11 段，**`set_cookie (o11111)` 段已消失**
- ob#2 永远是常量 ACK `1o1o11|cu`（control_flag）
- 两个 collector 响应**均无 Set-Cookie 头**
- 故 `_px3` 不来自 ob 段、不来自 HTTP header → **必然来自其他端点或客户端逻辑**

### 6.2 SDK 源码笔记（已读到的）

- `main_pretty.js` line 872 `ur(t)` — 按名读 cookie
- `main_pretty.js` line 878 `lr(t, e, n, r)` — 按名写 cookie（参数：name, ttl, value, isSecure）
- line 4097 `var c = ur("_px3")` — SDK 读 _px3 放进字段 `bjIcNCtcGQU=`（注意：旧 px_cookie.js 用的是 `BX1/O0ATcgo=`，**字段名变了**）
- 新 handler 函数名格式：`lllOll`、`OOlOlO`、`lOlllO` 等（小写 l / 大写 O，模仿 0/1）
- 旧 wire 格式仍是 `1`/`o`，所以解码段头名字像 `1o1o11`

下一步：cdp。

---

## 步骤 7 — 用户提供真实 curl + 响应（关键突破）

### 7.1 数据来源

用户从浏览器复制了真实的 collector#1 和 collector#2：
- `1.txt` + `1响应.txt` （collector#1 + ob#1）
- `2.txt` + `2响应.txt` （collector#2 + ob#2）

### 7.2 用现成 script 解码

`collector无感纯算还原/script/decode_payload.js` + `decode_ob.js` 直接可用。

#### 7.2.1 #1 payload 解码（seq=0, 14 字段, 事件类型 `R3cyPQISOQo=`）

文件：`event_json/user_curl1.json`

字段对比（旧→新 base64 key）：
- URL: `U08pSRUgIH4=` → `cgIHSDRhAX8=`
- platform "Win32": `JDxeOmFRVgA=` → `dEABCjEhBjA=`
- counter 0: `cHAKdjYQB0Y=` → `egoPQDxmDXA=`
- initTime: `FCwuKlJGKx0=` → `VQEgCxNnKjw=`
- sendTime: `BFw+GkE3Oyg=` → `bHgZcikfE0A=`
- uuid: `eEgCDj4lBjo=` → `NSEAa3NAC18=`
- /ns sm: `Ah44WEdyM24=` → `BzdyfUJXdks=`
- /ns dur: `DFQ2Ekk4PSU=` → `DFg5Ekk4PSU=`
- 等等

新增字段（旧版没有）：
- `R3cyPQIVMAw=` → pxhd（含 vid）："`194693e2bce104232d97ad4d8df7c2224f1d23da747ff6f71c338a9806f731c7:ppC4...`"
- `cyNGaTZBQVs=` → PX12738~12741 系列计数器: `{"PX12738":12, ...}`

#### 7.2.2 #1 ob 响应解码（XOR key=100, 11 段）

文件：`responce_result/user_curl1_ob.json`

```
[cookie_config] l00lll → {name:"cc", ttl:60, value:base64(SameSite=Lax;)}
[control_flag]  0lll0l → (jf=cu)
[session_id]    l0l0ll → state.to
[timestamp]     0lll000l → state.no = 1779130115184
[app_id]        000ll0
[unknown]       0lll0000
[cts]           0ll0ll00 → state.cts
[challenge_hash] 0lllll  → state.qa = 0cf210f9a296cb58e73b...
[cookie_config] l00lll → {name:"rf", ttl:60, value:"1"} ← 新增
[feature_flags] l00ll0 → {ai:0, uiii:0}
[unknown]       0ll0l000
```

#### 7.2.3 #2 payload 解码（seq=1, **225 字段**, 事件类型 `EFwlFlY8LiQ=`）

文件：`event_json/user_curl2.json`（19772 字节，225 字段）

#### 7.2.4 #2 ob 响应解码 🔴 关键

文件：`responce_result/user_curl2_ob.json`

```
[set_cookie]   000lll → {name:"_px3", ttl:?, value:"f6925223a427e1d7c9ca10dedf4267a2a9a8..."}
[control_flag] 0lll0l → (jf=cu)
[unknown]      0ll0l000 × 3
```

**`_px3` 是在 collector#2 响应里下发的，不是 collector#1！** 这跟旧宝典 ob_analysis.md 完全不同。旧版（ifood）：set_cookie 在 resp1。新版：set_cookie 在 collector#2 response。

### 7.3 SDK 版本变更（汇总）

| 项 | 旧（当前 px_cookie.js） | 新 SDK（用户 curl） |
|---|---|---|
| tag | `DhI0E0h7J2cKHw==` | **`U0MmDhUmOnhXSw==`** |
| ft | 388 | **401** |
| ob XOR key | 83 | **100** |
| seq #2 | 2 | **1** |
| ev1 字段数 | 12 | **14** |
| ev2 字段数 | 203 | **225** |
| ev1 事件类型 | `EFAqFlU5LiE=` | **`R3cyPQISOQo=`** |
| ev2 事件类型 | `XQUnAxtpIzE=` | **`EFwlFlY8LiQ=`** |
| handler 编码 | `o`/`1` (eg `o11111`) | `0`/`l` (eg `000lll`) |
| _px3 下发位置 | ob#1 `set_cookie` 段 | **ob#2 `set_cookie` 段** |
| URL 字段 key | `U08pSRUgIH4=` | `cgIHSDRhAX8=` |

handler 解码逻辑 (`reverse/ob.js`) 按参数形状匹配，跨版本仍有效。

### 7.4 注意：用户 curl 含已有 session

用户的 curl#1 已经包含 `vid`, `sid`, `cts`, `pxhd`, `hid` — 浏览器里已有 session cookies。首次访问的 curl#1 不应该有这些。但 SDK 看到 cookies 就会带上。所以纯算复刻时：
- 首次（无 cookies）：seq=0 不带 vid/sid/cts/pxhd/hid → 生成完整流程拿到 _px3
- 后续（有 cookies）：带上已有的，仍走 #1 → #2

### 7.5 接下来要做

1. ✓ 解码两份 curl，建立新旧字段映射
2. → patch `px_cookie.js`：更新 tag/ft/seq 三个标量
3. → 重写 ev1 / ev2 的字段（用户 curl#1 #2 是参考样本）
4. → 跑一次纯算，看是否拿到 `_px3`
5. → 20 次稳定性测试

---

## 步骤 8 — 4 批样本三分法分类

### 8.1 样本汇总

| 批次 | 来源 | uuid | ev1 字段 | ev2 字段 | ob#1 段 | ob#2 段 | _px3 |
|---|---|---|---|---|---|---|---|
| batch1 | 用户 1.txt | 2bd832d0-... | 14 | 225 | 11 | 5 | f692... |
| batch2 | re/#1.txt | 6b0623c0-... | 14 | 225 | 11 | 5 | 28cb... |
| batch3 | re/若/#1.txt | dd1e3560-... | 15 | 204 | 10 | 4 | ffca... |
| batch4 | re/值/#1.txt | (新 uuid) | 14 | 204 | 10 | 4 | 0189... |

batch1/2 = "暖访问"（已有 session），batch3/4 = "冷访问"。

### 8.2 EV2 4 路 diff 分类

```
228 unique fields (4 批合集)
├── COMMON (4 批都有): 203
│   ├── STATIC (4 批值相同): 171  ← 直接照搬值
│   └── DYNAMIC (4 批值不同):  32  ← 算法生成
└── CONDITIONAL (部分批次有): 25  ← 暖访问独有 (session 注入)
```

### 8.3 旧 → 新 base64 key 映射（值匹配法）

跑 `map_keys.js` 用旧版 px_cookie.js 的 ev2 硬编码值，在 batch1 ev2 找相同值的 key：

```
解析旧 ev2: 202 keys
找到映射:
  - 唯一映射 (旧 key → 新 key): 31
  - 歧义 (一个值多个候选): 12
  - 旧 key 找不到对应新 key: 29
  - 新 key 找不到对应旧 key: 178 (大多是 true/false 类通用值)
```

部分确定映射（语义已知）：

| 旧 key | 新 key | 值 | 含义 |
|---|---|---|---|
| `JDxeOmFRVgA=` | `dEABCjEhBjA=` | `"Win32"` | navigator.platform |
| `b1NVVSo/XWQ=` | `UT0kdxRdI0Y=` | `"Asia/Shanghai"` | 时区 |
| `KVkTX2w1GGo=` | `MkJHCHciQz0=` | `"w3c"` | screen orientation |
| `KnZQcG8aWkQ=` | `fg4LRDtuDnA=` | `"screen"` | screen |
| `b1NVVSkzWG8=` | `JnZTfGAaUUY=` | `"20030107"` | navigator.product |
| `aHgSfi4ZHU0=` | `NkZDDHArQz8=` | `"Netscape"` | navigator.appName |
| `SBhyXg51eGU=` | `X08qRRkuL34=` | `"Mozilla"` | navigator.vendor |
| `VGxuahEAYlk=` | `R3cyPQIXMQ4=` | `"Windows"` | UA platform |
| `FU1vS1Mna3k=` | `OARNTn5iRnw=` | `-480` | timezone offset |
| `eEgCDj4lBjo=` | `NSEAa3NAC18=` | uuid | 会话 UUID |
| `Yj4YOCdSFw0=` | `MV0EV3Q9BGI=` | `"3207084bd1..."` | DOM Myanmar hash |
| `JxsdHWJxEy8=` | `PSkIY3hPCVE=` | `"109|66|66|70|80"` | timing chain |
| `DzN1dUlScEY=` | `YjIXOCRfHQs=` | `["loadTimes","csi","app"]` | chrome.* APIs |

完整映射在 `key_mapping.json`。

### 8.4 EV1 14 字段对照

| 旧 key | 新 key | 含义 | DYN/STATIC |
|---|---|---|---|
| `U08pSRUgIH4=` | `cgIHSDRhAX8=` | URL | STATIC |
| `ZR1fGyB2Ui4=` | `XQkoAxhuKjY=` | type=0 | STATIC |
| `JDxeOmFRVgA=` | `dEABCjEhBjA=` | "Win32" | STATIC |
| `cHAKdjYQB0Y=` | `egoPQDxmDXA=` | counter=0 | STATIC |
| `Rlp8HAA2dy4=` | `PSkIY3tJDFE=` | perfNow | DYNAMIC |
| `JxsdHWJwFCc=` | `Tl57FAs5fS4=` | tz=3600 | STATIC |
| `FCwuKlJGKx0=` | `VQEgCxNnKjw=` | initTime | DYNAMIC |
| `BFw+GkE3Oyg=` | `bHgZcikfE0A=` | sendTime | DYNAMIC |
| `eEgCDj4lBjo=` | `NSEAa3NAC18=` | uuid | DYNAMIC |
| `Ah44WEdyM24=` | `BzdyfUJXdks=` | /ns sm | STATIC (null) |
| `DFQ2Ekk4PSU=` | `DFg5Ekk4PSU=` | /ns dur | STATIC (0) |
| `QSE7ZwdLMVw=` | `bHgZcioeHEk=` | flag=false | STATIC |
| (无) | `R3cyPQIVMAw=` | **pxhd**（新增） | CONDITIONAL |
| (无) | `cyNGaTZBQVs=` | **PX12738-12741**（新增） | DYNAMIC |

### 8.5 下一步

(a) **抓 3-5 批冷访问**（清 cookies 重新进），让 STATIC 分类更稳
(b) 或者基于现有 4 批的 STATIC 直接 patch px_cookie_v2.js 跑通端到端

---

## 步骤 9 — 完成：px_cookie_v2.js 端到端跑通

### 9.1 决定性 bug

经过反复测试 + cdp 浏览器替换排除 IP/TLS/header 干扰，最终定位：

**`RTEwewNQMUg=` 字段类型 mismatch！**

- 我们的 ob decoder 把 server timestamp 解码为 **string** `"1779132990495"`
- 但 SDK 期望该字段是 **number** `1779132990495`
- 我们的 `serialize()` 给 string 加引号、给 number 不加引号 → **生成的 payload bytes 在该字段位置多了 2 个引号**
- 服务器算我们的 PC HMAC 时虽然能匹配（因为我们用同样的 serialize 算 PC），但服务器对实际事件值的语义校验 → 看到 timestamp 是字符串就识别为"伪造"，**虽 do:null 不拒绝但不下发 _px3**

修复一行：`d['RTEwewNQMUg='] = parseInt(ctx.state.no);`

### 9.2 端到端验证

10 次连续测试：

```
run 1: px3=f75c9edc018a92edd2ff636291bd9c.. segs=3 status=200
run 2: px3=e6428c0cda6c546b37971415bf8d15.. segs=3 status=200
run 3: px3=55a4ae8cf985e0e78c9ef7d75d2d9f.. segs=3 status=200
run 4: px3=13160e5f0955120f3f79e21433e961.. segs=3 status=200
run 5: px3=95c55a88645533a3b2e27dc122eb6d.. segs=3 status=200
run 6: px3=15af8f82a4e6b253c4ad8ed9a6008b.. segs=3 status=200
run 7: px3=840afc2d79194e1f19785d0a23c910.. segs=3 status=200
run 8: px3=1333c095beff227f6412cbbbd7e161.. segs=3 status=200
run 9: px3=da918797cd92fe23f0390e8f23776b.. segs=3 status=200
run 10: px3=cdfd99b581a925aa8e2da0694fa6ee.. segs=3 status=200
```

**10/10 成功率，每次独立 _px3。✅**

### 9.3 最终文件

- `px_cookie_v2.js` — 端到端生成器（依赖 ev1_template.json + ev2_template.json）
- `ev1_template.json` — batch6 ev1 模板（14 字段）
- `ev2_template.json` — batch6 ev2 模板（204 字段）

### 9.4 关键改动清单 vs 旧版 px_cookie.js

| 项 | 旧 | 新 |
|---|---|---|
| `TAG` | `DhI0E0h7J2cKHw==` | `U0MmDhUmOnhXSw==` |
| `FT` | 388 | 401 |
| `seq` #2 | 2 | 1 |
| `ev1` 字段数 | 12 | 14（新增 pxhd 占位 + PX12738 计数器）|
| `ev2` 字段数 | 203 | 204（cold visit）|
| ev1 事件类型 | `EFAqFlU5LiE=` | `R3cyPQISOQo=` |
| ev2 事件类型 | `XQUnAxtpIzE=` | `EFwlFlY8LiQ=` |
| handler 编码 wire | `o`/`1` | `0`/`l` |
| _px3 来源 | r2.body `do` 数组的 `bake\|_px3\|...` | r2.body `ob` 字段 set_cookie handler |
| state.no 字段值类型 | string | **必须 parseInt 转 number** |






