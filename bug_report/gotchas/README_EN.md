# Gotchas — 19 named production pitfalls (fine-grained)

> 19 concrete bugs, each in its **own file**: symptom / root cause / why it was hard
> to find / fix.
>
> ⚠️ **Relation to the 4 aggregate files ([`../1_collector_path_EN.md`](../1_collector_path_EN.md) etc.)**:
> - those 4 `.md` files = **aggregate view** (grouped by "path", quick scan)
> - this directory's 19 `.md` files = **fine-grained** (one per bug, deeper)
> - complementary: skim the 4 aggregates first, then deep-dive here for a specific one

> 🛑 **Accuracy note (revised 2026-06-20).** This directory was ported from an upstream
> `perimeterX_Re/docs/07_gotchas/` project, and the cross-references were not fully
> rewired during the port. Read accordingly:
> - **Code snippets are illustrative.** The real, runnable implementations live in
>   [`../../revers/`](../../revers/), exported as `generatePayload` / `generatePC` /
>   `decodeOb` / `generateSid` etc. The `computePC` / `dispatchOB` / `extractSidFromTag`
>   names in some files are descriptive placeholders, **not** the real `revers/` exports.
> - **`tests/regression/*.test.js` paths do not exist in this repo** (there is no `tests/`
>   directory); those are upstream leftovers — treat them as illustrative.
> - **`docs/0X_…` / `platforms/ifood/…` paths are also upstream leftovers** with no file here.
> - **SDK line numbers + minified function names (e.g. `gb`/`ke`/`hh`) are real** (verified
>   present in the per-site SDKs under `source/`).
> - **The authoritative, field-by-field-validated gotcha list** is
>   [`../../skill/AI_re/references/gotchas.md`](../../skill/AI_re/references/gotchas.md) (23 entries).
>   This directory is a narrative supplement; on conflict, that file wins.

These are **not algorithm bugs**. The 9 algorithms in [`../../revers/`](../../revers/) are fine.
These are **bugs around the algorithms** — edge cases, off-by-ones, wrong encoding choices,
platform quirks — each of which cost hours the first time.

Read once before porting to a new site; each one can save you a night.

## Index

| # | Bug | Time lost (first time) | Affects |
|---|---|---|---|
| 1 | [`state.no` as string vs number](01_state_no_parseint.md) | 2 h | Anti-tamper computation |
| 2 | [UTF-8 vs Latin-1 byte alignment in payload XOR](02_utf8_latin1_xor.md) | 3 h | All payloads |
| 3 | [Anti-tamper position off-by-one](03_antitamper_position.md) | 1.5 h | EV2 only |
| 4 | [PC digit-extract reads MD5 from wrong slice](04_pc_md5_slice.md) | 1 h | PC validation |
| 5 | [SID Variation-Selector steganography (charCode, not digit)](05_sid_stego_even_tag.md) | 1 h | SID assembly |
| 6 | [OB handler matched by name, not by shape](06_ob_handler_by_name.md) | 4 h | All OB decode |
| 7 | [UUID v1 wall-clock vs monotonic](07_uuid_v1_clock.md) | 30 min | UUID v1 only |
| 8 | [hQ dictionary character index off-by-one](08_hq_index_off_by_one.md) | 2 h | All b64-key lookups |
| 9 | [Wire chars `0/l` vs `O/I` misread](09_wire_chars_confusion.md) | 1 h | OB decode |
| 10 | [Interleave drops final byte on odd-length](10_interleave_odd_length.md) | 1.5 h | Payload encrypt |
| 11 | [`state.* → EV2 b64 key` not derivable](11_state_to_ev2_key.md) | 3 h | Cross-platform port |
| 12 | [Cross-event b64 key reuse assumption](12_cross_event_key_reuse.md) | 30 min | EV1 vs EV2 confusion |
| 13 | [IP rate-limit masquerading as algorithm fail](13_ip_rate_limit.md) | 30 min | Validation |
| 14 | [Cookie TTL silently expires mid-test](14_cookie_ttl.md) | 1 h | Long test runs |
| **Phase 2 — Bundle path (only [`../../bundle/`](../../bundle/) uses it)** | | | |
| 15 | [Jf interleaving uses `offsets[u] - 1`](15_jf_offset_minus_one.md) | 4 h | Bundle #1/#2 payload |
| 16 | [`_pxUuid` not set before WASM init](16_pxuuid_wasm_init.md) | 3 h | WASM `b()` output |
| 17 | [Pointer coords must be floats](17_pointer_float_coords.md) | 1.5 h | Bundle #3 PX561 |
| 18 | [Press duration field must equal timing diff](18_press_duration_mismatch.md) | 1 h | Bundle #3 PX561 |
| 19 | [Myanmar DOM template must match captcha iframe](19_myanmar_template_drift.md) | 2 h | Bundle #3 Myanmar field |

## How to read this chapter

1. Skim the table above before starting Stage 6 (Implement).
2. Re-read whichever bug fires.
3. If a bug fires that's not listed — write a new file using the same headings.

## Next

→ [7.1 `state.no` parseInt](01_state_no_parseint.md)
