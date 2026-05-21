# Skill: `px_decode`

> Decode a captured PX batch end-to-end: payloads, OB responses, and the
> resulting cookies.

## When to invoke

User says:

- "Decode batch N for `<site>`"
- "Verify this capture"
- "What's in this payload?"

## Inputs

- `batch_dir`: path to `stample/<site>/sample/N/`
- `platform`: site name (used for wire_chars + constants)

## Procedure

1. Read `request_1.txt`, extract `payload=` and `pc=`
2. Decode payload via `skill/AI_re/scripts/decode_payload.js`
3. Save as `decoded_payload_1.json`
4. Read `response_1.txt`, base64-decode body
5. Decode OB segments via `skill/AI_re/scripts/decode_response.js`
6. Save as `decoded_response_1.json` and `derived_state.json`
7. Repeat for request_2 / response_2
8. Verify state.* values from response_1 appear in EV2 (Stage 5 sanity check)

## Output

```
stample/<site>/sample/N/
├── decoded_payload_1.json
├── decoded_response_1.json
├── derived_state.json
├── decoded_payload_2.json
├── decoded_response_2.json
└── extracted_cookie.json
```

## Quality gates

- EV1 has expected field count (~12-14 depending on platform)
- EV2 has expected field count (~200+)
- OB#1 yields at least state.no, state.to, state.qa
- OB#2 yields a set_cookie segment

## Estimated time

~30 seconds per batch on a modern machine.
