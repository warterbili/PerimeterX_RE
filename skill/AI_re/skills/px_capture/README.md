# Skill: `px_capture`

> Capture 6 fresh PX batches via CDP-controlled Chrome.

## When to invoke

User says:

- "Capture fresh samples for `<site>`"
- "I need new captures"
- "Rebuild the templates" (which requires fresh captures first)

## Inputs

- `site_name`: e.g. `ifood`
- `target_url`: a page that loads the SDK
- `batch_count`: default 6
- `out_dir`: default `stample/<site>/sample/`

## Procedure

1. Start Chrome via CDP if not running
2. For each batch:
   a. Clear cookies / open incognito tab
   b. Navigate to target URL
   c. Wait 10s for PX 2-POST exchange
   d. Capture request_1, response_1, request_2, response_2
   e. Save to `out_dir/N/`
   f. Extract tag/ft/uuid from bodies → meta.json
3. Verify all 6 batches share the same SDK SHA

## Quality gates

Fail loudly if:

- Cloudflare 403 before PX exchange → user must fix TLS / IP
- Different SDKs across batches → SDK rolled mid-capture; restart
- Fewer than 2 POSTs per batch → something blocked

## Output

```
stample/<site>/sample/
├── 1/
│   ├── request_1.txt
│   ├── response_1.txt
│   ├── request_2.txt
│   ├── response_2.txt
│   └── meta.json
├── 2/
... 6 total
```

## Estimated time

10 minutes for 6 batches.
