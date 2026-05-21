# Skill: `px_port_to_new_platform`

> A Claude Code skill that walks an AI agent through the 7-stage methodology
> for porting the generator to a new PX-protected site.

## When to invoke

User says:

- "Port the generator to `<sitename>`"
- "I have a new site to add"
- "Let's set up PX for `<sitename>`"

## Inputs

Required:

- `site_name`: short, kebab-case (e.g. `walmart`)
- `target_url`: a page that loads the PX SDK
- `business_api_example`: a URL we can test the cookie against

Optional:

- `cookie_name_hint`: `_px2` or `_px3` (else: derive from SDK)
- `expected_ua`: User-Agent to base the template on

## Steps

1. **Verify reachability** — CDP-fetch the target URL, confirm SDK loads
2. **Stage 1** — capture 6 batches via `skill/cdp/scripts/`
3. **Stage 2** — decode batches via `skill/AI_re/scripts/`
4. **Stage 3** — classify fields via `stample/<ref-site>/script/diff_samples.py`
5. **Stage 4** — locate constants from a real `request_1.txt`
6. **Stage 5** — value-match state via `find_state_keys.py`
7. **Stage 6** — copy `stample/ifood/px_cookie/ifood_px3.js` to
   `stample/<site>/px_cookie/<site>_<cookie>.js`, replace constants/maps
8. **Stage 7** — `verify_batch.js` + 10 live runs

## Output

- `stample/<site>/` populated
- `stample/<site>/px_cookie/<site>_*.js` created
- `main/ZH/case_studies/<site>.md` drafted
- 10/10 validation pass logged in the case study

## Gotcha cheatsheet

Before declaring done, confirm:

- [ ] Wire chars detected from SDK (not hard-coded — [Gotcha 9](../../../../bug_report/gotchas/09_wire_chars_confusion.md))
- [ ] state.* keys from value-match, not derivation ([Gotcha 11](../../../../bug_report/gotchas/11_state_to_ev2_key.md))
- [ ] PC length verified against captures ([Gotcha 4](../../../../bug_report/gotchas/04_pc_md5_slice.md))
- [ ] EV1 and EV2 use separate field maps ([Gotcha 12](../../../../bug_report/gotchas/12_cross_event_key_reuse.md))
- [ ] Test spacing ≥ 15s ([Gotcha 13](../../../../bug_report/gotchas/13_ip_rate_limit.md))

## Failure handling

If any stage fails, stop. Print the stage + reason. Do not proceed to
later stages — the entire chain depends on earlier stages being correct.

## Estimated time

4-6 hours per platform, first time. Subsequent platforms once you have
this skill internalized: ~2-3 hours.
