import Link from 'next/link';

const capabilities = [
  {
    eyebrow: 'Lookup',
    title: 'Exact N-number records',
    body: 'Explore a current U.S. aircraft registration by N-number with normalized aircraft, registration, engine, airworthiness, and source metadata.',
  },
  {
    eyebrow: 'Discover',
    title: 'Bounded registry search',
    body: 'Search the current registry by exact manufacturer, model, or registrant state using the same authenticated API available to developers.',
  },
  {
    eyebrow: 'History',
    title: 'Observed changes over time',
    body: 'Turn retained versions and PII-free change events into a readable timeline while keeping observation time distinct from legal effective dates.',
  },
] as const;

const boundaries = [
  'U.S. FAA registry data only',
  'API key stays on the server',
  'No owner-name reverse search',
  'No Mode S or ICAO24 reverse lookup',
  'No claim that observed history is a legal ownership ledger',
] as const;

export default function Home() {
  return (
    <main>
      <section className="hero">
        <nav className="nav" aria-label="Primary">
          <Link className="brand" href="/" aria-label="Aircraft Registry Explorer home">
            <span className="brandMark">N</span>
            <span>Aircraft Registry Explorer</span>
          </Link>
          <div className="navLinks">
            <a href="https://grizzlybulls.com/aircraft-api">API</a>
            <a href="https://api.grizzlybulls.com/v1/openapi.json">OpenAPI</a>
            <a href="https://github.com/Grizzly-Bulls/aircraft-registry-explorer">GitHub</a>
          </div>
        </nav>

        <div className="heroGrid">
          <div>
            <p className="kicker">Open-source reference app</p>
            <h1>Explore the FAA aircraft registry through a developer API.</h1>
            <p className="lede">
              Aircraft Registry Explorer is built against the public Grizzly Bulls Aircraft
              Intelligence API. It is designed to show how a real application can combine current
              aircraft data, bounded registry discovery, source provenance, and observed history
              without maintaining the FAA bulk dataset itself.
            </p>
            <div className="actions">
              <a className="button primary" href="https://grizzlybulls.com/aircraft-api">
                Get a free API key
              </a>
              <a
                className="button secondary"
                href="https://github.com/Grizzly-Bulls/aircraft-registry-explorer"
              >
                View source
              </a>
            </div>
          </div>

          <aside className="terminal" aria-label="Example API request">
            <div className="terminalBar">
              <span />
              <span />
              <span />
              <strong>server.ts</strong>
            </div>
            <pre>
              <code>{`const response = await fetch(
  "https://api.grizzlybulls.com/v1/aircraft/N12345",
  {
    headers: {
      Authorization: \`Bearer \${process.env.GRIZZLY_BULLS_API_KEY}\`
    }
  }
);

const aircraft = await response.json();`}</code>
            </pre>
          </aside>
        </div>
      </section>

      <section className="contentSection" aria-labelledby="scope-heading">
        <div className="sectionHeading">
          <p className="kicker">Reference app scope</p>
          <h2 id="scope-heading">One small app, built like an API customer.</h2>
          <p>
            The repository deliberately stays narrow. It has no database, account system, FAA
            ingestion pipeline, or second copy of the Aircraft API contract.
          </p>
        </div>

        <div className="cardGrid">
          {capabilities.map((capability) => (
            <article className="card" key={capability.title}>
              <p className="cardEyebrow">{capability.eyebrow}</p>
              <h3>{capability.title}</h3>
              <p>{capability.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="boundarySection" aria-labelledby="boundary-heading">
        <div>
          <p className="kicker">Deliberate boundaries</p>
          <h2 id="boundary-heading">Useful without overstating the data.</h2>
        </div>
        <ul>
          {boundaries.map((boundary) => (
            <li key={boundary}>{boundary}</li>
          ))}
        </ul>
      </section>

      <footer>
        <p>
          Powered by the{' '}
          <a href="https://grizzlybulls.com/aircraft-api">
            Grizzly Bulls Aircraft Intelligence API
          </a>
          .
        </p>
        <a href="https://github.com/Grizzly-Bulls">Grizzly Bulls on GitHub</a>
      </footer>
    </main>
  );
}
