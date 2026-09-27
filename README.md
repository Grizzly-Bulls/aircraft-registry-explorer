# Aircraft Registry Explorer

Aircraft Registry Explorer is an open-source reference application for the [Grizzly Bulls Aircraft Intelligence API](https://grizzlybulls.com/aircraft-api).

The goal is simple: show how a real application can use the public API to explore current U.S. FAA aircraft registrations, bounded registry search, source provenance, and retained observed history without maintaining the FAA bulk dataset itself.

The application uses the same public API contract available to any developer. It does not import private Grizzly Bulls code or connect to Grizzly Bulls databases.

## What this app demonstrates

The reference app is intentionally narrow:

- exact U.S. N-number lookup;
- bounded current-registry discovery by manufacturer, model, or registrant state;
- current aircraft, engine, airworthiness, and registration fields;
- source freshness and provenance;
- retained observed versions and PII-free change events; and
- a visual timeline that keeps observation dates distinct from legal or source-effective dates.

It does not provide owner-name reverse search, Mode S or ICAO24 reverse lookup, global registry coverage, flight tracking, bulk registry export, or an unfiltered registry walk.

## Local setup

You need Node.js 24, pnpm 11, and a Grizzly Bulls Aircraft Intelligence API key.

```bash
git clone https://github.com/Grizzly-Bulls/aircraft-registry-explorer.git
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

Open [http://localhost:3000](http://localhost:3000).

You can create a free API key from the [Aircraft Intelligence API page](https://grizzlybulls.com/aircraft-api). The machine-readable contract is available as [OpenAPI 3.1](https://api.grizzlybulls.com/v1/openapi.json).

## Architecture

The API key stays on the server:

```text
browser
  |
  v
Next.js application
  |
  | server-side Bearer request
  v
https://api.grizzlybulls.com/v1
```

The repository has no database, authentication system, FAA ingestion pipeline, or second aircraft-data authority. The public Grizzly Bulls API remains the source for aircraft data and API semantics.

Browser code should not call the machine API directly. Browser CORS is intentionally not enabled, and `GRIZZLY_BULLS_API_KEY` must never be exposed through a `NEXT_PUBLIC_*` variable or client bundle.

## History semantics

Registration history in this app means states that Grizzly Bulls observed in validated FAA registry snapshots.

An observed interval is not automatically a legal ownership interval. It also does not prove the exact date on which a real-world registration change occurred. The app should leave an effective date unknown when the source does not establish one.

Current FAA public withholding also takes precedence over retained history. The reference app must not be used to recover personal data that the current public source no longer releases.

## Development

Run the full local check before opening a PR:

```bash
pnpm check
```

The repository uses TypeScript, Next.js App Router, ESLint, and lightweight Node-based regression tests. See [AGENTS.md](./AGENTS.md) for the contributor and data-boundary rules.

## License

MIT. See [LICENSE](./LICENSE).
