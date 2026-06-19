# Gotcha 5 — SID Variation-Selector steganography (charCode, not digit)

> ⚠️ **This file was rewritten 2026-06-20.** The earlier version described a
> non-existent "SID-derived-from-TAG, loop over planes 1..14" algorithm with a
> degenerate `(p*tagLen)%tagLen` index (which is identically 0) and a function
> `extractSidFromTag` that is **not** in `revers/sid.js`. That was fabricated
> scaffolding. The real mechanism is below, grounded in the actual code.

## What `sid` actually is

`sid` is a POST form param = a **visible** prefix (`pxsid`, or `uuid` on the
no-touch path) + an **invisible** steganographic tail that encodes a server
counter (`state.no`, and on the bundle path also `cts`).

Real implementation — [`revers/sid.js`](../../revers/sid.js):

```js
function hh(t) {                       // encode each char as an invisible codepoint
    let result = '';
    for (let i = 0; i < t.length; i++)
        result += String.fromCodePoint(0xE0100 + t.charCodeAt(i));
    return result;
}
function generateSid(visiblePrefix, serverTimestamp) {
    return visiblePrefix + hh(String(serverTimestamp));   // pxsid + hh(state.no)
}
```

SDK origin: `main.js` lines 4365–4373 (`lh`/`hh`/`dh`), where
`lh = "%uDB40%uDD"` and `unescape(lh + twoHexCharCode)` builds the surrogate
pair — e.g. `unescape("%uDB40%uDD31")` → (0xDB40, 0xDD31) → **U+E0131**.

## The two real pitfalls

### 5a — it's `U+E0100 + charCode`, NOT `U+E0100 + digitValue`

The base is added to the character **code**, not the numeric value of the digit:

```
'7' has charCode 0x37  →  U+E0100 + 0x37 = U+E0137     ✅
                          (NOT U+E0107 — that's the off-by-0x30 trap)
```

So a digit string lands in **U+E0130–U+E0139**, never U+E0100–U+E0109. A decoder
that does `digits += (cp - 0xE0100)` returns charcodes (55, 56, …) as a run-on
number — garbage. The correct decode is `String.fromCharCode(cp - 0xE0100)`
(see `dh()` in `revers/sid.js`).

### 5b — the invisible tail gets dropped in transit

These are **Variation Selectors Supplement** codepoints (U+E0100–U+E01EF) —
Plane-14, invisible. Terminals, `copy as cURL`, naïve logging, and some HTTP
clients **strip or normalize** them. If the tail is lost, the server sees a
`sid` whose UTF-8 byte length (`36 + |state.no|*4`) is wrong → flagged as
non-browser. In Python: `urllib.parse.quote_plus(sid, safe='')` to preserve them
(this is the real basis of the old "Python requests drops sid characters" note).

## Naming note

The block is the **Variation Selectors Supplement** (U+E0100–U+E01EF), *not* the
Unicode **Tags** block (U+E0000–U+E007F). Earlier docs called these "Tag
Characters" — a misnomer (both live in Plane-14 and are invisible, but they are
different blocks). The implementation is correct; only the label was wrong.

## Related

- Real algorithm + clarification: [`revers/sid.js`](../../revers/sid.js)
- Authoritative gotcha list: [`skill/AI_re/references/gotchas.md`](../../skill/AI_re/references/gotchas.md)

## Next

→ [Gotcha 6 — OB handler matched by name](06_ob_handler_by_name.md)
