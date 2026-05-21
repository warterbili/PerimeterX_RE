# OB Handler 完整表（27 个，按参数形状匹配 - 跨版本通用）

## 推荐做法：按参数形状匹配（**不依赖** handler 名）

| 匹配规则 | 设置的 state | 含义 |
|---|---|---|
| 1 arg, `/^1[5-9]\d{11}$/` (13 位毫秒 ts) | `state.no` | 服务器时间戳 |
| 1 arg, `/^[0-9a-f]{64}$/` | `state.qa` | challenge_hash (cs) |
| 3 args, UUID + 数字 + flag | `state.vid` | visitor ID |
| 2 args, UUID + flag | `state.cts` | client timestamp |
| 1 arg, UUID | `state.pxsid` | session UUID |
| 1-2 args, `/^\d{16,}$/` | `state.to` | session token (anti-tamper 种子) |
| 1 arg, `/^\d{3}$/` | `state.ao` | 状态码 |
| **4+ args, `/^_?px/i`** | `state.px3 = {name, value, ttl}` | **⭐ set_cookie** |
| 1 arg, `/^[a-z0-9]{12,30}$/` | `state.appId` | session appId |
| 1 arg, `/^[a-z]{2,4}$/` | `state.jf` | control_flag |
| 1 arg, `/^\d{4,5}$/` | `state.o111val` | (未明确) |
| 3 args, `"cc"/"rf"/"tm"` + ttl + base64 | cookie_config | 配置 cookie |
| 1 arg, `"ai:N,uiii:N"` | feature_flags | 功能开关 |
| 2 args, b64hash:payload + "true" | pxhd 注入 | 暖访问独有 |

## Wire 字符编码版本对照

```
旧版 SDK (2025-): 字节字符集 'o', '1'
  例: 'o111oo1o' (timestamp handler)
  
新版 SDK (2026-05+): 字节字符集 '0', 'l'
  例: '0lll000l' (同一 handler)

SDK 函数名: 'lllOll', 'OOlOlO' 等 (大O小l, 与 wire 字符不一定对应)
```

## 旧 wire → 新 wire 对照

| handler | 旧 wire | 新 wire |
|---|---|---|
| timestamp | `o111oo1o` | `0lll000l` |
| challenge_hash | `1o1111` | `0lllll` |
| vid | `oooo11` | `0000ll` |
| cts | `o11o11o1` | `0ll0ll00` |
| pxsid | `oo1o1o` | `l0l0ll` |
| session_id (to) | `ooo11o` | `l0l0ll` |
| **set_cookie** | `o11111` | `000lll` |
| app_id | `o111o1` | `000ll0` |
| control_flag | `1o1o11` | `0lll0l` |
| o111val | `o111ooo1` | `0lll0000` |
| cookie_config | `o1111o` | `l00lll` |
| feature_flags | `o111oo` | `l00ll0` |

## 关键提醒

⚠️ **不要依赖 handler 名识别！** 每次 SDK 升级 wire 字符可能变。
✅ **按参数形状匹配** — `args.length` + 内容正则。

⚠️ **`set_cookie` 是 _px3 唯一来源**：4+ args 且第一个 arg 是 `_px3` (或类似 `_pxN`)。
✅ 提取 `state.px3 = { name: args[0], value: args[2], ttl: parseInt(args[1]) }`。
