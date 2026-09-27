# Contributing

Thanks for helping improve Aircraft Registry Explorer.

This repository is intentionally small. Contributions should make the public integration clearer, safer, or easier to use without turning the project into a second aircraft-data platform.

Before making a non-trivial change, read [AGENTS.md](./AGENTS.md). It defines the public API, privacy, server-only key, history, scope, and copy boundaries that contributions must preserve.

## Local setup

You need Node.js 24, pnpm 11, and a Grizzly Bulls Aircraft Intelligence API key.

```bash
git clone https://github.com/Grizzly-Bulls/aircraft-registry-explorer.git
cd aircraft-registry-explorer
pnpm install
cp .env.example .env.local
```

Set:

```bash
GRIZZLY_BULLS_API_KEY=your_key_here
```

Then run:

```bash
pnpm dev
```

The app has three primary integration surfaces:

- `/lookup` for exact current N-number lookup;
- `/discover` for bounded exact manufacturer/model/state discovery; and
- `/history` for retained observed versions and PII-free change events.

## Before opening a pull request

Run:

```bash
pnpm check
git status --short
```

The final status should be empty.

Keep pull requests focused. Explain:

1. the developer task or bug being addressed;
2. which existing public API contract the change relies on;
3. any privacy, data-interpretation, or server-only-secret boundary involved; and
4. how you validated the change.

## Scope boundaries

Do not add or imply unsupported API capabilities.

The reference app does not provide:

- owner-name or registrant-name reverse search;
- unfiltered registry walking or bulk export;
- fuzzy registry search;
- arbitrary sorting or registry totals;
- Mode S / ICAO24 reverse lookup;
- global aircraft registry coverage;
- flight tracking; or
- a hosted shared-key public search service.

A new UI control must correspond to a reviewed capability already present in the public API.

## Secrets and privacy

Never include API keys, credentials, copied FAA bulk datasets, registrant PII fixtures, or private Grizzly Bulls implementation details in issues, commits, tests, screenshots, or pull requests.

`GRIZZLY_BULLS_API_KEY` stays server-only. Do not add a `NEXT_PUBLIC_*` variant or direct browser request to the machine API.

Retained history must not become a way to recover personal information suppressed by current FAA public data. History UI should remain focused on observation boundaries, PII-free events, registration state, aircraft fields, and provenance.

## Screenshots

If a change modifies visible UI, use the capture checklist in [docs/screenshots/README.md](./docs/screenshots/README.md).

Use the real local application. Do not fabricate result data or generate imitation screenshots.

## Reporting bugs

Use the repository bug-report template when possible. Include the route, expected behavior, actual behavior, Node/pnpm versions, and a sanitized error message.

Never paste an API key or registrant personal information into an issue.

## Integration questions

Questions about how to call the public API, interpret discovery pagination, or read observed history can use the integration-question issue template.

For the full machine contract, see the [OpenAPI 3.1 document](https://api.grizzlybulls.com/v1/openapi.json).
