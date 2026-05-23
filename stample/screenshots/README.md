# Screenshots — 实战成果截图 / Live Demo Screenshots

这个目录放项目的「实战 200」证据截图，给公开 README / 文档当**真实运行证明**用。

| 文件 | 内容 |
|---|---|
| `ifood_200.png` | iFood demo: `_px3` → GraphQL → HTTP 200 + 真实商家数据 `Bar e Lanches Estadão (4.9★)` |
| `grub_full_chain_200.png` | Grub Python full-chain demo: PX 3/3 PX-pass + `__Host-instacart_sid` obtained + grocery 域已认证 |
| `ifood_200.html` | iFood 截图的渲染源 HTML |
| `grub_full_chain_200.html` | Grub 截图的渲染源 HTML |

## 截图怎么做的

1. 跑对应 demo，把终端输出录下来
2. 用脚本生成 HTML（含语法高亮、敏感字段 `*****` mask）
3. 用 cdp-browser skill 把 HTML 渲染成网页 + 全页截图

```bash
# 1. 启动 Chrome (headless OK)
python skill/cdp/scripts/cdp.py start

# 2. 导航 + 截图
python skill/cdp/scripts/cdp.py navigate "file:///$(pwd)/stample/screenshots/ifood_200.html"
python skill/cdp/scripts/cdp.py screenshot "$(pwd)/stample/screenshots/ifood_200.png" --full
```

## 已 mask 的敏感字段

| 字段 | 占位 |
|---|---|
| BrightData customer ID / password | `hl_*****` / `*****` |
| Grubhub 账号 username + 域名 | `do****@***.***` |
| `_px2` cookie | `eyJ1Ijoi*****…` |
| `_pxvid` / `access_token` / `refresh_token` / `ud_id` / `anon_token` | 8 字符前缀 + `****-****-****-************` |
| `__Host-instacart_sid` | `v2.<env-prefix>.*****` |

凭据轮换后这些截图仍然安全，因为：(a) 真值早已脱敏；(b) 8-char UUID 前缀不可暴力枚举。

## 重新做截图

如果 demo 输出有更新（新的 HTTP 200 / 新的 SDK 验证），重做流程：

1. 跑 demo 拿新鲜输出（必须设好 env var：`HTTPS_PROXY` / `GRUBHUB_EMAIL` / `GRUBHUB_PASSWORD`）
2. 编辑 `*.html` 里 `<pre class="out">` 段落的内容
3. 用上面的 cdp 命令重截
