# EV2 字段三分法分类规则

## 总览

ev2 (collector#2 events) 通常 200+ 字段。多批样本对比后归类:

```
228 字段 (4 批合集)
├── STATIC (~75%, 171 字段): 4 批值相同 → 直接照搬模板
├── DYNAMIC (~15%, 32 字段): 每批不同 → 算法生成
└── CONDITIONAL (~10%, 25 字段): 仅暖访问有 → 冷访问可忽略
```

## DYNAMIC 字段必须算法生成的 (17 个核心)

| 字段语义 | 算法 |
|---|---|
| server timestamp | `parseInt(state.no)` ⭐ number 类型！ |
| initTime | `Date.now()` |
| sendTime | initTime + 1000~1500ms |
| pre-init ts | initTime - 200~400ms |
| session UUID | `uuidV1()` |
| Date.toString() | `new Date().toString()` |
| performance.now() | sendTime - initTime |
| HMAC(uuid, UA) | hmacMD5 |
| HMAC(vid, UA) | hmacMD5 |
| HMAC(pxsid, UA) | hmacMD5 |
| state.appId | 从 ob#1 拿 |
| state.to | 从 ob#1 拿 |
| memory used | random 40-140M |
| memory total | used × 1.1~1.5 |
| /ns sm | fetch /ns 拿 |
| /ns duration | fetch /ns 拿 |
| anti-tamper key/val | te(state.to, state.no%10+2/1) |

## ENTROPY 字段（DYNAMIC 但同浏览器同 GPU 固定）

这些字段值在**同浏览器同 GPU**应该总是同值。直接用模板即可：

- Canvas hash (32 hex)
- Audio fingerprint hash
- Error stack hash (kE(nk()))
- Font hash
- Mouse track AN() count

## CONDITIONAL 字段（暖访问独有）

batch1/2 比 batch3-6 多 25 字段。这些都是 session 注入相关:
- 历史 _px3 token
- pxhd / hid 上次值
- challenge state cache

**冷访问基线 = 204 字段，足够通过验证。** 暖访问的额外字段对结果无影响（甚至可能干扰）。

## STATIC 字段（直接用模板值）

剩余 ~170 字段是浏览器固定值，直接用真实抓包的模板。包括:

- screen.width = 1920
- screen.height = 1080
- navigator.platform = "Win32"
- hardwareConcurrency = 8
- deviceMemory = 8
- timezone = "Asia/Shanghai"
- timezone offset = -480
- navigator.languages = [...]
- userAgent (匹配 HTTP header 中的 UA!)
- navigator.plugins JSON
- 各种 webdriver/phantom/selenium 检测字段 = false
- 各种 API 存在性字段
- 等等
