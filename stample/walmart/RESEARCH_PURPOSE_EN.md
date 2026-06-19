# Walmart — Research Purpose

This directory is one case study of PerimeterX SDK reverse-engineering research.
It performs protocol-level analysis of **only the PX layer** of walmart.com, to
understand the algorithms and field structure of the PerimeterX collector chain.

## Scope & limitations
- Walmart's primary defense is **Akamai Bot Manager**; PerimeterX is a secondary layer.
- This case reverses **the PX layer only**, producing a `_px3` accepted by the PX
  collector (200 + cookie issued).
- It does **not** touch Akamai (`_abck`/`bm_sv` sensor). Consequently a `_px3`
  alone **cannot** pass Walmart's business APIs — that is outside this skill's
  scope, and this research does not attempt to bypass Akamai.
- No large-scale requests, no targeting of real accounts, no business risk-control
  bypass; only small local runs to verify algorithm correctness.

---

## Why no end-to-end (Layer 3.5) — reproducible evidence

"End-to-end" means: use the obtained cookie to call a **business API** and get real
business JSON. That is not achievable on Walmart because the enforcing gate on
business APIs is **Akamai** (out of this skill's scope), not PX. All three parts below
are reproducible.

### ① Both Akamai and PX are deployed on walmart.com (live, re-verified 2026-06-19/20)

| Vendor | Evidence |
|---|---|
| **Akamai** | homepage `Set-Cookie: akavpau_p2=…`; response header `Server-Timing: ak_p` |
| **PerimeterX** | homepage loads `/px/PXu6b0qd2S/init.js` (PX SDK) |

Reproduce: `curl -s -D - https://www.walmart.com/ | grep -iE "akavpau|ak_p"` and
`curl -s https://www.walmart.com/ | grep -o "/px/PX[A-Za-z0-9]*/init.js"`.

### ② The enforcing gate on business APIs is Akamai, not PX

With no cookies, two business graphql endpoints are both **blocked at the Akamai edge**:

```
GET /orchestra/home/graphql        → 418  Server: AkamaiGHost
GET /orchestra/snb/graphql/search  → 418  Server: AkamaiGHost
   body: "Access Denied … Reference #0.37f00f17.<ts>.<id>"   ← Akamai's signature deny page
```

Basis: the block is returned by **`AkamaiGHost` (Akamai's edge server)** with Akamai's
`Reference #` format, and the deny page carries **no PX markers** (no `px-captcha`, no
`_px*`). So the block happens at the **Akamai edge, before any PX evaluation**. Passing
it needs Akamai's `_abck`/`bm_sv` (sensor) — that is reversing Akamai, out of scope.

> Honest boundary: because Akamai blocks **first**, we cannot observe whether PX would
> **also** block behind it — it is untestable (you never reach the PX layer). What is
> provable: Akamai is the **outermost enforcing gate**.

### ③ How "PX success" is verified — a collector-level differential (not the 200!)

The collector returns 200 for **any** POST, so 200 is not a success signal. Real success
= our synthetic payload makes PX **decode and emit the full OB state chain**, whereas a
garbage payload of the same shape decodes to nothing. The script
[`script/px_success_proof.js`](script/px_success_proof.js) runs this differential:

| | status | OB segments | state.no/appId/to | body |
|---|---|---|---|---|
| **Positive** (correct payload) | 200 | ~12 | ✅ ✅ ✅ | ~880 B |
| **Negative** (garbage payload, same envelope) | 200 | 1 | ❌ ❌ ❌ | 10 B |

The differential holding ⇒ PX genuinely decoded and accepted our synthetic sensor data.
Combined with full-chain **`_px3` issued 10/10** (collector#2 returns the set_cookie
segment), this is the achievable PX-layer proof of success.

Reproduce: `node script/px_success_proof.js` (positive rich / negative empty);
`node px_cookie/walmart_px3.js` (obtain `_px3`).

See [`source/SDK_INFO_EN.md`](source/SDK_INFO_EN.md).
