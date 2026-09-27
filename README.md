# Aircraft Registry Explorer

Aircraft Registry Explorer is an open-source reference application for the [Grizzly Bulls Aircraft Intelligence API](https://grizzlybulls.com/aircraft-api).

The app shows how a real application can use the public API for current U.S. FAA aircraft lookup and bounded registry discovery without maintaining the FAA bulk dataset itself.

The application uses the same public API contract available to any developer. It does not import private Grizzly Bulls code or connect to Grizzly Bulls databases.

## What this app demonstrates

The current application supports:

- exact U.S. N-number lookup;
- bounded current-registry discovery by exact manufacturer, model, or registrant state;
- current aircraft, engine, airworthiness, registration, and Mode S / ICAO24 fields returned for an N-number;
- source freshness and provenance alongside current records;
- opaque keyset pagination for discovery results; and
- click-through from a discovery result to the current N-number record.

It does not provide owner-name reverse search, Mode S or ICAO24 reverse lookup, global registry coverage, flight tracking, bulk registry export, fuzzy search, arbitrary discovery sorting, registry totals, or an unfiltered registry walk.

The public Aircraft Intelligence API also exposes retained observed history. The current reference-app UI intentionally focuses on current lookup and discovery, so it does not yet render that history as a timeline.

## Local setup

You need Node.js 24, pnpm 11, and a Grizzly Bulls Aircraft Intelligence API key.

```bash
git clone git@github.com:Grizzly-Bulls/aircraft-registry-explorer.git
cd aircraft-registry-explorer
pnpm install
cp .env.example .env.local
```

Add your key to `.env.local`:

```bash
GRIZZLY_BULLS_API_KEY=your_key_here
```

Then run:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Use `/lookup` for exact N-number lookup and `/discover` for bounded current-registry search.

You can create a free API key from the [Aircraft Intelligence API page](https://grizzlybulls.com/aircraft-api). The machine-readable contract is available as [OpenAPI 3.1](https://api.grizzlybulls.com/v1/openapi.json).

## Architecture

The API key stays on the server:

```text
browser
  |
  v
Next.js server-rendered page
  |
  | server-side Bearer request
  v
https://api.grizzlybulls.com/v1
```

The repository has no database, authentication system, FAA ingestion pipeline, or second aircraft-data authority. The public Grizzly Bulls API remains the source for aircraft data and API semantics.

Browser code does not call the machine API directly. Browser CORS is intentionally not enabled, and `GRIZZLY_BULLS_API_KEY` must never be exposed through a `NEXT_PUBLIC_*` variable or client bundle.

## Discovery semantics

Registry discovery mirrors the public API contract:

- at least one of manufacturer, model, or two-letter registrant state is required;
- manufacturer, model, and state filters are normalized and matched exactly;
- combined filters use AND semantics;
- results are bounded to 25 records per request in this app;
- pagination uses the opaque `nextCursor` returned by the API; and
- cursors are reused only with the same search filters.

The application does not decode cursors or infer page numbers or registry totals from them.

## Data interpretation

FAA registration data identifies the public registrant record. It is not proof of beneficial economic ownership.

Mode S / ICAO24 values shown on a lookup page are fields returned for that N-number. Their presence does not imply that the app supports reverse lookup from those identifiers.

Retained history in the underlying API represents states that Grizzly Bulls observed in validated FAA registry snapshots. An observed interval is not automatically a legal ownership interval and does not prove the exact date on which a real-world registration change occurred.

Current FAA public withholding takes precedence over retained history. The reference app must not be used to recover personal data that the current public source no longer releases.

## Development

Run the full local check before opening a PR:

```bash
pnpm check
```

The repository uses TypeScript, Next.js App Router, ESLint, and lightweight Node-based regression tests. See [AGENTS.md](./AGENTS.md) for the contributor and data-boundary rules.

## License

MIT. See [LICENSE](./LICENSE).
