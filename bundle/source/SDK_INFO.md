# Bundle Path — Locked SDK Snapshot

iFood 当前生产的 Bundle 路径完整 SDK 源码集合。

> ⚠️ **`captcha.js` 没保存** —— PX 的 `captcha.js` 每次浏览器加载文件名都变（带 hash 后缀），全网项目都没人下载存盘。但我们有它**核心解出的 WASM** + **会触发它的 main.min.js**，足以做大部分 Bundle 路径的逆向工作。需要 captcha.js 时按 [§4](#4-captchajs-动态获取) 实时抓取。

---

## 1. 文件清单

| 文件 | 大小 | SHA-256（前 16） | 内容 |
|---|---|---|---|
| [`main.min.js`](main.min.js) | 231,438 字节 | `b47a639cde9df4f9…` | **当前 iFood SDK 主文件**（混淆版，生产路径） |
| [`main_pretty.js`](main_pretty.js) | 527,580 字节 | `61eba79a853753c5…` | `main.min.js` 反混淆/格式化版（阅读用） |
| [`px_captcha.wasm`](px_captcha.wasm) | 60,862 字节 | `900a9b07c1de9cf3…` | **Bundle WASM 二进制**（核心 a()/b() 函数） |
| [`main_legacy_pre_split.js`](main_legacy_pre_split.js) | 430,842 字节 | `0868d0ac0d925dba…` | **老版 PX SDK**（captcha + collector 合体，无 captcha.js 拆分前的版本，历史对照用） |

完整 SHA-256：

```
b47a639cde9df4f91bdc4138ae0d64ebf7ce8c876a1e4c9967fd3af3d2975eb8  main.min.js
61eba79a853753c5af06d6a52197bccbbeac9071dc241ad0abb30d388c85b340  main_pretty.js
900a9b07c1de9cf37175a48470f77445dcb8515841d51469c0b24c207c8b090d  px_captcha.wasm
0868d0ac0d925dba9a58d0c7e8f8557cc638b15cbe66d9e53ece31d8e1edcd72  main_legacy_pre_split.js
```

## 2. 文件详解

### 2.1 `main.min.js` — 当前 PX 主 SDK ⭐

**所有 iFood 浏览器访问都先加载它**（无论走 Collector 还是 Bundle 路径）。它是入口，会：

1. 自动发 Collector POST（拿初始 `_px3`）
2. 注册 `window._O1GDTa7Qhandler`（接 Bundle 挑战的回调）
3. **触发 Bundle 时下载 captcha.js**（动态 URL）
4. 解码所有 OB 响应（27 + 2 个 handler 都在这里）

| 维度 | 值 |
|---|---|
| Source URL | `https://client.px-cloud.net/PXO1GDTa7Q/main.min.js` |
| Captured | 2026-05-20 via cdp-browser |
| 大小 | 231,438 字节 |
| 行数 | 10,653（混淆，约 2 行长行） |
| SHA-256 | `b47a639cde9df4f91bdc4138ae0d64ebf7ce8c876a1e4c9967fd3af3d2975eb8` |
| Init AppID | `PXO1GDTa7Q` |
| Bundle AppID | 由 OB#1 segment#3 动态下发（如 `d6f03jmq8h6c7382req0`） |
| Collector TAG | `U0MmDhUmOnhXSw==` |
| Bundle TAG | `O2MKZn0OEhI/ag==`（嵌在 captcha.js，不在 main.min.js） |
| Collector FT | `401` |
| Bundle FT | `388` |
| OB XOR key | `100` = `ml("U0MmDhUmOnhXSw==") % 128`（Collector）/ `120` = `ml("DhY8E0h7J2cKHw==") % 128`（Bundle） |

⚠️ **这份文件跟 [`../../stample/ifood/source/main.min.js`](../../stample/ifood/source/main.min.js) 是同一份**（SHA 一致）。`stample/ifood/source/` 是从 Collector 视角维护；这里 `bundle/source/` 是从 Bundle 视角 mirror 一份方便整套自包含。

### 2.2 `main_pretty.js` — 反混淆版（阅读用）

```bash
$ wc -l main_pretty.js
~15000 行
$ ls -la main_pretty.js
527580 字节
```

`main.min.js` 是混淆的（变量名 a/b/c/...，2 行长行）。`main_pretty.js` 是用 `prettier` / `js-beautify` 处理过的版本：
- 加了换行 + 缩进
- **变量名仍然是混淆的**（无法自动反混淆）
- 但行号 + 函数边界清楚 → DevTools 断点可用

用法：
- DevTools "Local Overrides" 把 `main.min.js` 替换为 `main_pretty.js` → 可以单步调试
- 跨版本 grep 时按"魔法常量"定位（`1732584193` MD5 init / `909522486` HMAC ipad / `122192928e5` UUID epoch）

⚠️ **不要把 pretty 版直接用作 generator 的输入**（pretty 完的 JS 跟 minified 行号对不上，OB 解码里有些 handler 假设特定字符串位置）。pretty 版只用来阅读。

### 2.3 `px_captcha.wasm` — Bundle WASM 二进制 ⭐⭐⭐

Bundle 路径的核心 —— 60862 字节 wasm-bindgen 生成的 Rust 模块。

| 维度 | 值 |
|---|---|
| Source | `captcha.js` 内嵌（base64 in `Us()[10]`） |
| 大小 | 60,862 字节 |
| Magic | `\0asm 0x01000000`（前 8 字节：`0061736d 01000000`） |
| SHA-256 | `900a9b07c1de9cf37175a48470f77445dcb8515841d51469c0b24c207c8b090d` |
| 导出函数 | `a()` → 64 hex 字符串（非确定性）<br>`b(input)` → 127 字符自定义编码（确定性，ChaCha20 变换） |
| 导入 | 34 个 wbg imports（见 [`../doc/Bundle_完整技术文档.md`](../doc/Bundle_完整技术文档.md) §5.3） |
| 加载顺序 | `captcha.js` 解码 Us()[10] → 自定义 base64 + URI decode → WebAssembly.instantiate |

提取方法：

```bash
# 方法 1: 从 captcha.js 直接提（如果你有 captcha.js）
node bundle/stample/helpers/extract_wasm.js captcha.js
# 输出: px_captcha.wasm

# 方法 2: 用 wabt 验证 WASM 结构
wasm-objdump -h px_captcha.wasm    # section 信息
wasm-objdump -j data px_captcha.wasm | head -50    # data 段（含 ChaCha20 seed）
wasm-objdump -j Import px_captcha.wasm    # 34 个 wbg imports
wasm2wat px_captcha.wasm -o px_captcha.wat   # 转 WAT 文本格式
```

⚠️ **WASM 内部常量每次 build 都变**（ChaCha20 seed 32 字节、自定义字母表 24 chars、HMAC key）。如果 SHA 跟这个不一致：
1. 抓新的 captcha.js
2. 重新提 WASM
3. 用 `wasm-objdump -j data` 对比常量
4. 跑 [`../stample/helpers/run_wasm.js`](../stample/helpers/run_wasm.js) 测 a()/b() 输出

详见 [`../doc/Bundle_完整技术文档.md`](../doc/Bundle_完整技术文档.md) §5 + §16.4。

### 2.4 `main_legacy_pre_split.js` — 老版 PX（合体 SDK）

PX **早期版本**的 main.js（约 2024 上半年），**captcha + collector 代码合在一个文件**里（10684 行）。没拆 captcha.js 之前的状态。

| 维度 | 值 |
|---|---|
| TAG | `DhI0E0h7J2cKHw==`（**老版**，跟当前 `U0MmDhUmOnhXSw==` 不同） |
| AppID | `PXO1GDTa7Q`（同当前） |
| OB XOR key | `120`（老版） |
| 含 captcha | ✅（grep "captcha" 16 次匹配，PX1135/PX762/PX12634 各 4 次） |
| 含 PoW | ✅（含 Bs/poi/sha256） |
| 含 WebAssembly 加载 | ✅（grep "WebAssembly" 1 次） |
| 拆分进度 | **未拆**（一个文件管全部） |

**用途**：
- 历史对照（看 PX 怎么从合体 SDK 演进到 main.min.js + captcha.js 分离）
- 旧版逆向资料（如 Pr0t0ns v8.9.6）对应的 SDK 形态
- 跨版本 grep 算法层魔法常量（验证算法 3 年没变）

不能直接拿这个跑生产 —— TAG / OB XOR key / b64 key 字典都跟当前 iFood 不一致。

## 3. 4 份文件的关系

```
2024 早期版本（合体 SDK）
   ↓
   ├──→ main_legacy_pre_split.js
   │    （这份）430 KB，captcha + collector 都在里面
   │
   │     PX 后来拆分成两个文件 ──→
   │
   ▼
2024-2026 当前版本（拆分 SDK）
   ↓
   ├──→ main.min.js (这份) — Collector 主入口 + Bundle 调度
   │    231 KB 混淆版，10,653 行
   │
   ├──→ main_pretty.js (这份) — 反混淆/格式化版
   │    527 KB，阅读用
   │
   ├──→ captcha.js ❌ 未保存
   │    每次浏览器加载文件名都变
   │    内嵌 px_captcha.wasm 的 base64
   │
   └──→ px_captcha.wasm (这份) — Bundle WASM
        从 captcha.js Us()[10] 解码出
        60 KB
```

## 4. captcha.js 动态获取

如果你需要 `captcha.js` 本身（比如对比新版差异、提取 EV2 b64 key 字典），实时抓取：

### 方法 1：CDP 自动抓

```bash
python skill/cdp/scripts/cdp.py navigate "https://www.ifood.com.br/restaurantes"
# 浏览器加载完成后
python skill/cdp/scripts/cdp.py network 20    # 等 20 秒
# Network 列表里找含 "captcha" 的 URL
```

或写专用脚本：

```python
# capture_captcha_js.py
import asyncio
from cdp import CDPClient

async def main():
    async with CDPClient(...) as cdp:
        await cdp.navigate('https://www.ifood.com.br/')
        # 触发 captcha
        # (跑 bundle/stample/helpers/trigger_captcha 类似的循环)

        captures = await cdp.capture_network(30)
        for req in captures:
            if 'captcha' in req['url']:
                # 用 Network.getResponseBody 拿内容
                body = await cdp.get_response_body(req['requestId'])
                with open('captcha.js', 'w') as f:
                    f.write(body)
                print(f'Saved {len(body)} bytes')
                break
```

### 方法 2：burst 触发挑战

```js
// trigger_captcha.js（在浏览器 console 跑）
async function trigger() {
    for (let i = 0; i < 250; i++) {
        const r = await fetch('https://cw-marketplace.ifood.com.br/v1/...', {
            method: 'POST',
            headers: { 'Cookie': document.cookie }
        });
        if (r.status === 403) {
            const body = await r.json();
            if (body.blockScript) {
                console.log(`触发！第 ${i} 次。captcha URL:`, body.blockScript);
                // 浏览器自动加载 → 在 Network 里另存
                return body.blockScript;
            }
        }
        await new Promise(r => setTimeout(r, 50));
    }
}
trigger();
```

抓到的 captcha.js 文件名带 hash（如 `captcha_7f2a3b1c.js`），重命名为 `captcha.js` 保存。

⚠️ captcha.js 内嵌 uuid，跨会话不能复用（坑 #B16）。每次抓的版本只对应那次会话。

## 5. 提取 SDK 内部常量

### 5.1 验证算法层魔法常量

```bash
cd bundle/source

# MD5 init A
grep -c "1732584193" main.min.js     # → 1
grep -c "1732584193" main_legacy_pre_split.js  # → 1

# HMAC ipad
grep -c "909522486" main.min.js      # → 1

# UUID v1 Gregorian epoch
grep -c "122192928e5" main.min.js    # → 2

# INT32_MAX (ml() hash)
grep -c "2147483647" main.min.js     # → ≥1

# TAG 自身
grep -c "U0MmDhUmOnhXSw==" main.min.js  # → ≥1
```

跨版本 grep 模式见 [`../../skill/AI_re/references/locate-by-pattern.md`](../../skill/AI_re/references/locate-by-pattern.md)。

### 5.2 提取 OB XOR key

```bash
# Bundle 路径用的 OB XOR key 是 ml(gt) % 128
# 当前 gt = "DhY8E0h7J2cKHw==" → 120
node -e "
function ml(t){var r=0;for(var i=0;i<t.length;i++)r=(31*r+t.charCodeAt(i))%2147483647;return (r%900+100).toString();}
const gt = 'DhY8E0h7J2cKHw==';
console.log('XOR key =', parseInt(ml(gt)) % 128);
"
# → 120
```

### 5.3 从 WASM 提 ChaCha20 seed

```bash
wasm-objdump -j data px_captcha.wasm | head -30
# 找 segment[0] 那 32 字节，那是 ChaCha20 seed（疑似）
```

跨版本 SDK 升级时，**这 32 字节几乎肯定会变**。

## 6. 跟项目其它部分的关系

| 资源 | 路径 | 关系 |
|---|---|---|
| **Bundle EV 模板 + WASM helpers** | [`../stample/`](../stample/) | 解出来的等价物（templates / mouse_tracks / helpers / wasm 同 SHA 副本） |
| **完整技术文档** | [`../doc/Bundle_完整技术文档.md`](../doc/Bundle_完整技术文档.md) | 5038 行，含所有算法详解 |
| **Collector 路径 SDK**（同份 main.min.js） | [`../../stample/ifood/source/main.min.js`](../../stample/ifood/source/main.min.js) | SHA 一致，这里 mirror 一份 |
| **Grubhub Collector SDK** | [`../../stample/grub/source/init.js`](../../stample/grub/source/init.js) | Grubhub 用 init.js 不是 main.min.js |
| **算法模块** | [`../../revers/`](../../revers/) | 9 个模块（payload/pc/ob/sid/uuid 等），Bundle 沿用 7 个 |
| **Bundle 路径踩坑** | [`../../bug_report/2_bundle_path.md`](../../bug_report/2_bundle_path.md) | 20 条专属坑 |

## 7. 完整性校验

```bash
cd bundle/source

# 验所有 SHA
sha256sum main.min.js
# 期望: b47a639cde9df4f91bdc4138ae0d64ebf7ce8c876a1e4c9967fd3af3d2975eb8

sha256sum main_pretty.js
# 期望: 61eba79a853753c5af06d6a52197bccbbeac9071dc241ad0abb30d388c85b340

sha256sum px_captcha.wasm
# 期望: 900a9b07c1de9cf37175a48470f77445dcb8515841d51469c0b24c207c8b090d

sha256sum main_legacy_pre_split.js
# 期望: 0868d0ac0d925dba9a58d0c7e8f8557cc638b15cbe66d9e53ece31d8e1edcd72

# 验 WASM magic
xxd px_captcha.wasm | head -1
# 期望: 0061 736d 0100 0000 ...   (= "\0asm" 01 00 00 00)

# 验 main.min.js 含必要常量
grep -c "PXO1GDTa7Q" main.min.js      # 应 ≥ 1
grep -c "U0MmDhUmOnhXSw==" main.min.js  # 应 ≥ 1
grep -c "1732584193" main.min.js      # 应 1（MD5 init）
```

---

## 8. 维护说明

| 项 | 值 |
|---|---|
| 当前版本 | iFood 2026-05 SDK |
| Captured | 2026-05-20 |
| Validation | 6 fresh batches + 10× live-generator runs，10/10 通过（Collector 路径） |
| Bundle 验证 | 10/10（Userscript），70%（纯算） |
| 下次抓 SDK | 当 PX 推新版（典型每月 1-2 次 main.min.js / 每 2-3 周 captcha.js） |

升级流程：
1. 抓新 main.min.js + 算 SHA
2. 跟旧版 diff 看变了多少
3. 跑 [`../../stample/ifood/script/verify_all.sh`](../../stample/ifood/script/verify_all.sh) 看解码闭环还过不过
4. 抓新 captcha.js + 提新 WASM + SHA 对比
5. WASM 变了的话跑 [`../stample/helpers/run_wasm.js`](../stample/helpers/run_wasm.js) 看 b() 输出

详细 SDK 漂移应对见 [`../doc/Bundle_完整技术文档.md`](../doc/Bundle_完整技术文档.md) §16。

---

*建立时间 2026-05-21。源 SDK 整理自 perimeterX_Re/sdk_artifacts/ + ifood-web 生产项目。*
