# Screenshot capture guide

README and distribution screenshots must come from the real local Aircraft Registry Explorer application.

Do not create mock aircraft records, generated imitation UI, or screenshots backed by a shared production API key.

## Setup

Run the application locally with your own Aircraft Intelligence API key:

```bash
pnpm install
cp .env.example .env.local
# add GRIZZLY_BULLS_API_KEY to .env.local
pnpm dev
```

Use a desktop browser at approximately 1440 x 1000 or wider. Capture the content area without browser bookmarks, extensions, account details, developer tools, terminal windows, or other unrelated personal information.

## Reviewed capture set

Capture these three images:

1. `lookup.png`
   - route: `/lookup?nNumber=<reviewed N-number>`
   - show the current-record heading plus representative aircraft/provenance fields
   - verify no API key appears anywhere
   - avoid framing registrant contact details as the product focus

2. `discover.png`
   - route: `/discover?<reviewed exact filters>`
   - show the search controls plus multiple bounded result rows when possible
   - do not expose or annotate the opaque cursor
   - use manufacturer/model/state filters only

3. `history.png`
   - route: `/history?nNumber=<reviewed N-number>`
   - show at least one observed version or PII-free event when available
   - include the observation-time interpretation copy in the frame when practical
   - verify historical registrant names, addresses, aliases, and postal information are not displayed

Store the reviewed files in this directory with exactly those names.

## Privacy and claim review

Before committing a screenshot:

- confirm no API key, cookie, token, account identifier, local file path, terminal content, or browser profile detail is visible;
- confirm no unsupported owner search, Mode S reverse lookup, global coverage, flight-tracking, legal-ownership, or real-time claim appears;
- confirm observed history is described as observation evidence rather than a legal ownership timeline;
- confirm current FAA withholding is not bypassed or contradicted; and
- confirm the image came from the real application rather than reconstructed or generated UI.

## README placement

Once all three reviewed images exist, add them near the top of the README in a compact product-tour section.

Prefer one lookup image first, then discovery and history. Keep alt text factual and specific.
