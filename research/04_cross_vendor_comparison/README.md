# Study 4 — Cross-vendor comparison

> *Question*: How does PX's defensive design compare structurally to
> DataDome, Akamai BMP, and Cloudflare BMP?

## Method

Structural analysis of publicly-deployed JS payloads. Not effectiveness
testing — we compare design choices, not block rates.

## Results

Key observations:

1. **PX is moderate on every axis** — heavier than Cloudflare, lighter than
   Akamai. This makes it a useful study target.

2. **Sensorless mode is unusual** — only PX, DataDome, and Cloudflare
   support a 2-POST sensorless variant. Akamai requires sensored.

3. **Algorithm rotation cadence varies** — Akamai (weekly), PX (quarterly),
   Cloudflare BMP (config-driven). Faster rotation raises attacker
   maintenance burden.

4. **Obfuscation strategy** — PX is heavy but structured (base91 array +
   name table). Akamai is heavier (custom VM). Cloudflare is lighter
   (relies on server-side risk).

## Interpretation

PX is a popular target for RE writeups precisely because its complexity is
*tractable* — heavy enough to deter casual attackers, structured enough that
researchers can build cross-build decoders.

If we tried to do this same project for Akamai BMP, the methodology in
[Part 6](../../main/ZH/methodology/) would still apply but the time budget
would be ~5×.

## Limitations

- Only structural; no claim about effectiveness
- Vendor docs are sales-flavored; some claims are second-hand
- Doesn't include vendors below the top-4 (Imperva, F5, etc.)
