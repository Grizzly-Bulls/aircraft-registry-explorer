# Aircraft Registry Explorer contributor guide

Aircraft Registry Explorer is an open-source reference application for the Grizzly Bulls Aircraft Intelligence API.

The repository should remain small, understandable, and useful to developers who want to see a real integration rather than a second implementation of the Aircraft API.

## Product boundary

Use only the public, versioned Grizzly Bulls Aircraft Intelligence API at:

```text
https://api.grizzlybulls.com/v1
```

Do not import private Grizzly Bulls application modules, query Grizzly Bulls databases, ingest FAA bulk files directly, or create a second aircraft-data source of truth.

The application may demonstrate:

- exact U.S. N-number lookup;
- bounded current-registry discovery by supported public filters;
- current aircraft and registration details;
- source freshness and provenance;
- retained observed versions and PII-free change events; and
- a visual history timeline that clearly distinguishes observation time from legal or source-effective time.

Do not add owner-name reverse search, unfiltered registry walking, bulk export, fuzzy search, Mode S or ICAO24 reverse lookup, global registry coverage, flight tracking, or another aviation product unless the public API itself gains that reviewed capability and this reference app has a clear reason to demonstrate it.

## Current application surface

The implemented current-data UI has two server-rendered routes:

- `/lookup` performs exact N-number lookup and presents current aircraft, engine, registration, identifier, freshness, and provenance fields;
- `/discover` performs bounded exact current-registry discovery by manufacturer, model, and registrant state with opaque next-cursor pagination.

Discovery result rows may link into `/lookup` and carry only a validated local return URL. Do not decode discovery cursors, infer page numbers or totals, or introduce client-side API calls to make pagination look richer than the public contract.

The implemented `/history` route consumes the public retained-history endpoint and renders observed versions plus PII-free change events. Keep versions/events pagination independent, preserve the other list's offset when one list moves, and never merge them into one invented pagination authority.

History UI must not display retained registrant names, street addresses, aliases, or other personal details. Show a nullable source effective date only when the API supplies it. Never derive an effective date from `observedAt`, `observedFrom`, or `observedThrough`.

## API key and request boundary

`GRIZZLY_BULLS_API_KEY` is a server-only secret.

- Never expose it through `NEXT_PUBLIC_*`, rendered HTML, client JavaScript, browser storage, URLs, analytics, logs, screenshots, fixtures, or committed files.
- Browser components should call application-owned server routes or server actions. They should not call the machine API directly while browser CORS is intentionally disabled.
- Do not ship a public hosted demo backed by one unrestricted shared production key.
- Keep API errors bounded and useful without leaking secrets or internal implementation details.

## Data and privacy semantics

Treat the public API contract as authoritative for response shape and supported operations.

- An N-number is registration identity, not proof of beneficial economic ownership.
- Retained history is an observation stream. `observedFrom` and `observedThrough` must not be presented as legal ownership periods or exact real-world change times.
- A nullable source effective date stays unknown unless the public API supplies one.
- Current FAA releasability and withholding rules must not be bypassed through retained history.
- History change events are PII-free. Do not reconstruct old names, addresses, aliases, or other suppressed personal data.
- Prefer showing source freshness and provenance when they help a user interpret a result.

## Application architecture

Use Next.js App Router and TypeScript.

Keep the architecture lean:

```text
browser
  -> Next.js UI
  -> server-only application adapter
  -> Grizzly Bulls Aircraft Intelligence API
```

Do not add a database, user account system, queue, background worker, or another hosted service unless a measured requirement makes it necessary.

Keep domain transport and normalization out of presentation components. Reusable API request behavior belongs under `src/lib/`.

## Public copy

Write for developers and aviation-data users, not for the team maintaining the roadmap.

- Do not expose internal project phase names, codenames, test names, implementation milestones, or repository bookkeeping in the public UI or README.
- Do not use em dashes in authored public prose.
- Avoid generic AI-style filler, hype, and repetitive template structure.
- Describe only capabilities that exist in the public API and in the current application.
- Prefer concrete examples and explicit limitations over broad claims such as "complete," "global," "real-time," or "ownership history."

## Validation

Use Node.js 24 and pnpm 11.

Before a PR is ready:

```bash
pnpm install
pnpm check
```

When behavior changes, add focused tests for the contract being changed. Do not weaken a guard merely to make the suite pass.
