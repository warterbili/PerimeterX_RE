# Gotchas — 19 个命名的生产踩坑（细颗粒度版）

> 19 个具体 bug，每个**单文件**记录：症状 / 根因 / 难发现的原因 / 修复 / 防回归测试。
>
> ⚠️ **跟 [`../1_collector_path.md`](../1_collector_path.md) 等 4 大文件的关系**：
> - 那 4 个 `.md` 文件 = **聚合视图**（68 条按"路径"分类，速读）
> - 本目录 19 个 `.md` 文件 = **细颗粒度版**（每条独立，深度更深，含修复代码 + 测试代码）
> - 两者**互补**：先扫 4 个聚合，再针对要复现某条 deep-dive 这里
>
> *源自*: perimeterX_Re/docs/07_gotchas/，路径已适配到 perimeter/。

这些**不是算法 bug**。[`revers/`](../../revers/) 9 个算法没问题。
这些是**算法周围的 bug** — edge cases、off-by-ones、错的编码选择、平台 quirks，每个第一次踩都花了几小时。

新站点移植前先读一遍，每条都能省你一整晚。

## Index

| # | Bug | Time lost (first time) | Affects |
|---|---|---|---|
| 1 | [`state.no` as string vs number](01_state_no_parseint.md) | 2 h | Anti-tamper computation |
| 2 | [UTF-8 vs Latin-1 byte alignment in payload XOR](02_utf8_latin1_xor.md) | 3 h | All payloads |
| 3 | [Anti-tamper position off-by-one](03_antitamper_position.md) | 1.5 h | EV2 only |
| 4 | [PC digit-extract reads MD5 from wrong slice](04_pc_md5_slice.md) | 1 h | PC validation |
| 5 | [SID stego on TAG with even length](05_sid_stego_even_tag.md) | 1 h | SID assembly |
| 6 | [OB handler matched by name, not by shape](06_ob_handler_by_name.md) | 4 h | All OB decode |
| 7 | [UUID v1 wall-clock vs monotonic](07_uuid_v1_clock.md) | 30 min | UUID v1 only |
| 8 | [hQ dictionary character index off-by-one](08_hq_index_off_by_one.md) | 2 h | All b64-key lookups |
| 9 | [Wire chars `0/l` vs `O/I` misread](09_wire_chars_confusion.md) | 1 h | OB decode |
| 10 | [Interleave drops final byte on odd-length](10_interleave_odd_length.md) | 1.5 h | Payload encrypt |
| 11 | [`state.* → EV2 b64 key` not derivable](11_state_to_ev2_key.md) | 3 h | Cross-platform port |
| 12 | [Cross-event b64 key reuse assumption](12_cross_event_key_reuse.md) | 30 min | EV1 vs EV2 confusion |
| 13 | [IP rate-limit masquerading as algorithm fail](13_ip_rate_limit.md) | 30 min | Validation |
| 14 | [Cookie TTL silently expires mid-test](14_cookie_ttl.md) | 1 h | Long test runs |
| **Phase 2 — Bundle path（仅 [`../bundle/`](../../bundle/) 用到）** | | | |
| 15 | [Jf interleaving uses `offsets[u] - 1`](15_jf_offset_minus_one.md) | 4 h | Bundle #1/#2 payload |
| 16 | [`_pxUuid` not set before WASM init](16_pxuuid_wasm_init.md) | 3 h | WASM `b()` output |
| 17 | [Pointer coords must be floats](17_pointer_float_coords.md) | 1.5 h | Bundle #3 PX561 |
| 18 | [Press duration field must equal timing diff](18_press_duration_mismatch.md) | 1 h | Bundle #3 PX561 |
| 19 | [Myanmar DOM template must match captcha iframe](19_myanmar_template_drift.md) | 2 h | Bundle #3 Myanmar field |

Total: **22 hours** (sensorless) + **11.5 hours** (bundle) of debugging
encoded as recipes. That is the value of this chapter.

## How to read this chapter

1. Skim the table above before starting Stage 6 (Implement).
2. Re-read whichever bug fires.
3. If a bug fires that's not in this list — write a new file. The format is the
   six headings at the top of every chapter.

## Test coverage

Each bug has a corresponding regression test in
<!-- removed broken link: ../../tests/regression/ -->. The CI gate refuses to merge if
any of them fails. This is how 22 hours of debugging becomes permanent project
knowledge instead of tribal lore.

## Next

→ [7.1 `state.no` parseInt](01_state_no_parseint.md)
