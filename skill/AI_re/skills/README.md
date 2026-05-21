# AI Skill Manifests

> AI agent 可调用的 4 个 skill — 用户意图入口（vs `../playbooks/` 是"怎么做"的操作手册）。
> *源自*: perimeterX_Re/ai/skills/，已适配到当前 perimeter/ 路径结构。

---

## 4 个 Skill

| Skill | 用户触发语句 | 输入 | 工作量 |
|---|---|---|---|
| [`px_capture`](px_capture/README.md) | "抓 N 批新样本" / "rebuild templates" | site_name + target_url + batch_count | 30 min |
| [`px_decode`](px_decode/README.md) | "decode batch N" / "what's in this payload" | batch_dir + platform | 5 min |
| [`px_port_to_new_platform`](px_port_to_new_platform/README.md) | "port to `<sitename>`" / "add new site" | site_name + target_url + business_api | 4-15 h |
| [`px_sdk_drift_audit`](px_sdk_drift_audit/README.md) | "did the SDK change?" / "audit drift" | site_name | 30 min - 2 h |

---

## Skill vs Playbook 的区别

| 类型 | 位置 | 视角 | 例 |
|---|---|---|---|
| **Skill** | `skill/AI_re/skills/` | AI agent 调用入口（用户意图） | `px_capture` → "我要抓样本" |
| **Playbook** | [`../playbooks/`](../playbooks/) | 工程步骤说明书（怎么做） | `master-workflow.md` → "7 阶段如何走" |

每个 skill 内部会引用 1 或多个 playbook。

---

## 调用方式

在 Claude Code / Cursor 里：

```
@skill/AI_re/skills/px_capture/README.md
帮我抓 6 批 ifood 样本
```

或者直接说：

```
@skill/AI_re/SKILL.md
帮我对 example.com 做 PerimeterX 逆向
```

`SKILL.md` 是顶层 skill 入口，会自动路由到相应的 4 个子 skill。

---

## 路径适配

这 4 个 skill 原本来自 perimeterX_Re/ai/skills/，路径已经全部适配过：

| 旧路径 (perimeterX_Re) | 新路径 (perimeter/) |
|---|---|
| `packages/px-decode/src/` | `skill/AI_re/scripts/` |
| `packages/px-generate/src/` | `stample/<site>/px_cookie/` |
| `packages/px-capture/` | `skill/cdp/scripts/` |
| `docs/06_methodology/` | `main/ZH/methodology/` |
| `docs/07_gotchas/` | `bug_report/gotchas/` |
| `sdk_artifacts/` | `stample/<site>/source/` |
| `platforms/<site>/samples/` | `stample/<site>/sample/` |
