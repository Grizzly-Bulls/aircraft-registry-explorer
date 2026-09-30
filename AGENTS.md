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
- exact six-digit ICAO24 / Mode S lookup against the current U.S. FAA registry;
- evidence-backed N-number lifecycle status across registered, reserved, deregistered, and unknown states;
- bounded current-registry discovery by supported public filters;
- bounded recent observed changes with privacy-safe diffs;
- current aircraft and registration details;
- source freshness and provenance;
- retained observed versions and PII-free change events; and
- a visual history timeline that clearly distinguishes observation time from legal or source-effective time.

Do not add owner-name reverse search, ICAO24 ranges, unfiltered registry walking, bulk export, fuzzy search, global registry coverage, flight tracking, live ADS-B positions, or another aviation product unless the public API itself gains that reviewed capability and this reference app has a clear reason to demonstrate it.

## Current application surface

The implemented current-data UI is server-rendered and includes:

- `/lookup` for exact N-number lookup;
- `/icao24` for exact six-digit ICAO24 / Mode S lookup;
- `/status` for evidence-backed N-number lifecycle state;
- `/changes` for a bounded recent observation-time change-feed sample; and
- `/discover` for bounded exact current-registry discovery with opaque next-cursor pagination.

Discovery result rows may link into `/lookup` and carry only a validated local return URL. Do not decode discovery cursors, infer page numbers or totals, or introduce client-side API calls to make pagination look richer than the public contract.

The implemented `/history` route consumes the public retained-history endpoint and renders observed versions plus PII-free change events. Keep versions/events pagination independent, preserve the other list's offset when one list moves, and never merge them into one invented pagination authority.

History UI must not display retained registrant names, street addresses, aliases, or other personal details. Show a nullable source effective date only when the API supplies it. Never derive an effective date from `observedAt`, `observedFrom`, or `observedThrough`.

## API key and request boundary

`GRIZZLY_BULLS_API_KEY` is a server-only secret.

- Never expose it through `NEXT_PUBLIC_*`, rendered HTML, client JavaScript, browser storage, URLs, analytics, logs, screenshots, fixtures, or committed files.
- Browser components should call application-owned server routes or server actions. They should not call the machine API directly while browser CORS is intentionally disabled.
- Hosted deployment is allowed only with the reviewed dedicated first-party demo credential, server-only secret handling, application-side per-client/global abuse limits, and the machine API's separate aggregate demo ceiling. Never use a normal customer key as the public shared credential.
- Keep API errors bounded and useful without leaking secrets or internal implementation details.

## Data and privacy semantics

Treat the public API contract as authoritative for response shape and supported operations.

- An N-number is registration identity, not proof of beneficial economic ownership.
- Lifecycle `unknown` never means an N-number is available; availability remains `not_determined`.
- Reservation context must remain non-PII.
- Change-feed events describe observed snapshot differences, not inferred sales, ownership transfers, or exact transaction times.
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

When `AIRCRAFT_DEMO_HOSTED=true`, every machine-API request must pass the server-only abuse limiter before transport. Client identity may be derived only from trusted reverse-proxy address headers, fingerprinted in process memory, and never persisted or logged. Health checks do not consume the demo request budget.

## Open-source packaging

README and GitHub packaging must stay aligned with the real application and public API.

- Keep a short clone-to-run path for Node.js 24, pnpm 11, `.env.local`, and `GRIZZLY_BULLS_API_KEY`.
- Endpoint examples must match implemented public routes and remain safe for server or command-line use. Do not imply browser CORS or client-side secret handling.
- Repository screenshots must come from the real local application. Do not fabricate aircraft records, generate imitation UI screenshots, or capture API keys, credentials, registrant personal details, terminal content, or browser-profile information.
- Use the reviewed screenshot checklist in `docs/screenshots/README.md`.
- Keep issue and pull request templates focused on reproducibility, integration context, local validation, secret hygiene, privacy, and unsupported-scope checks.
- GitHub description/topics/website should follow `docs/github-metadata.md`. The website may point to the reviewed hosted demo once it is live, but metadata must not imply unsupported owner search, Mode S reverse lookup, global coverage, or flight tracking.

## Public copy

Write for developers and aviation-data users, not for the team maintaining the roadmap.

- Do not expose internal project phase names, codenames, test names, implementation milestones, or repository bookkeeping in the public UI or README.
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
