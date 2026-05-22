<!--
Thanks for contributing! Please read CONTRIBUTING.md if you haven't yet.
By submitting this PR, you agree your contribution is released under the
project's dual-track license (AGPL-3.0 for code + CC BY-NC-SA 4.0 for docs).
-->

## What this PR does

<!-- One-paragraph summary. -->

## Type of change

- [ ] New-site port (`stample/<new-site>/`)
- [ ] SDK-drift fix
- [ ] New gotcha (`bug_report/gotchas/NN_*.md`)
- [ ] Methodology update (`main/{ZH,EN}/methodology/`)
- [ ] English translation
- [ ] Tooling / CLI script
- [ ] Bug fix in `revers/` or a generator
- [ ] Documentation only
- [ ] Other:

## Verification

<!-- Check whichever applies; PRs without verification will get bounced. -->

- [ ] Smoke test passes (paste output below)
- [ ] Generator produces valid `_px3` / `_px2` (paste cookie prefix + ttl)
- [ ] Byte-exact diff against real capture (paste diff summary)
- [ ] (End-to-end) Business API returned HTTP 200 with redacted response
- [ ] (Docs) Read end-to-end; cross-links resolved
- [ ] (Translation) Matches source structure section-by-section

<details>
<summary>Verification output</summary>

```
<paste smoke-test / diff / HTTP response here>
```

</details>

## Linked issues

Closes #
Refs #

## Notes for reviewer

<!-- Anything tricky? Non-obvious tradeoffs? Things you'd like a sanity check on? -->

## Checklist

- [ ] My changes follow [CONTRIBUTING.md](../CONTRIBUTING.md) style
- [ ] If I added a new site / generator, mirror structure matches `stample/grub/`
- [ ] If I touched bilingual files, ZH and EN are still in sync
- [ ] I did not commit large binary captures or secrets / personal credentials
- [ ] License headers / attribution preserved where required
