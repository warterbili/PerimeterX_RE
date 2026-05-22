---
name: New site port request
about: Propose adding a new PX-protected site (DoorDash / Zillow / etc.)
title: "[port] Add <site> generator"
labels: new-site
---

> **Before filing:** porting effort is ~8–12 hours per site even with full
> methodology in hand (~90% algorithm reuse + 5 site-specific constants).
> If you can do the port yourself, open a draft PR instead — issues are for
> coordinating who's doing what, not feature requests.

## Target site

- URL:
- Why this site (research/teaching motivation):
- Detected PX usage (network tab shows `/api/v2/collector` POSTs / `_px3` cookie):
  - [ ] Yes, confirmed
  - [ ] Unsure — please verify

## Reference mirror

Which existing site's mirror structure is closest? (pick the one with
matching `_px3` vs `_px2` cookie + similar regional considerations)

- [ ] [`stample/ifood/`](../../stample/ifood/) — `_px3`, BR-residential
- [ ] [`stample/grub/`](../../stample/grub/) — `_px2`, US

## Constants extraction status

The 5 site-specific constants needed (per
[`methodology/04_stage4_locate.md`](../../main/EN/methodology/04_stage4_locate.md)):

- [ ] AppID
- [ ] TAG
- [ ] FT
- [ ] Endpoint URL(s)
- [ ] `state.* → EV2 b64 key` mapping

## Volunteer

- [ ] I'm volunteering to do the port (I'll open a draft PR)
- [ ] I'm requesting — looking for someone else to take it on

## Captures (optional but helpful)

If you've already captured samples, attach a tarball or link to
6 batches under `stample/<site>/sample/<1..6>/`.
