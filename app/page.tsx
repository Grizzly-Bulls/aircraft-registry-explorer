import Link from 'next/link';

const capabilities = [
  {
    eyebrow: 'Lookup',
    title: 'Exact N-number records',
    body: 'Explore a current U.S. aircraft registration by N-number with normalized aircraft, registration, engine, airworthiness, identifier, and source metadata.',
    href: '/lookup',
    action: 'Open lookup',
  },
  {
    eyebrow: 'Discover',
    title: 'Bounded registry search',
    body: 'Search the current registry by exact manufacturer, model, or registrant state using the same authenticated API available to developers.',
    href: '/discover',
    action: 'Search registry',
  },
  {
    eyebrow: 'Provenance',
    title: 'Freshness with the record',
    body: 'See the FAA registry source, retrieval timestamp, source contract, and observed-history summary alongside current aircraft details.',
    href: '/lookup',
    action: 'View record fields',
  },
] as const;

const boundaries = [
  'U.S. FAA registry data only',
  'API key stays on the server',
  'No owner-name reverse search',
  'No unfiltered registry walking or bulk export',
  'No Mode S or ICAO24 reverse lookup',
  'Registration data is not proof of beneficial ownership',
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
            <Link href="/lookup">Lookup</Link>
            <Link href="/discover">Discover</Link>
            <a href="https://grizzlybulls.com/aircraft-api">API</a>
            <a href="https://github.com/Grizzly-Bulls/aircraft-registry-explorer">GitHub</a>
          </div>
        </nav>

        <div className="heroGrid">
          <div>
            <p className="kicker">Open-source reference app</p>
            <h1>Explore the FAA aircraft registry through a developer API.</h1>
            <p className="lede">
              Look up an exact N-number or search the current U.S. registry by exact manufacturer,
              model, or registrant state. Every data request uses the public Grizzly Bulls Aircraft
              Intelligence API through this application&apos;s server.
            </p>
            <div className="actions">
              <Link className="button primary" href="/lookup">
                Look up an aircraft
              </Link>
              <Link className="button secondary" href="/discover">
                Search the registry
              </Link>
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
          <p className="kicker">Try the integration</p>
          <h2 id="scope-heading">A small app built like an API customer.</h2>
          <p>
            The repository has no aircraft database or FAA ingestion pipeline. The pages below use
            the same public API contract and Bearer-key authentication available to any developer.
          </p>
        </div>

        <div className="cardGrid">
          {capabilities.map((capability) => (
            <article className="card" key={capability.title}>
              <p className="cardEyebrow">{capability.eyebrow}</p>
              <h3>{capability.title}</h3>
              <p>{capability.body}</p>
              <Link className="cardLink" href={capability.href}>
                {capability.action} →
              </Link>
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
        <a href="https://api.grizzlybulls.com/v1/openapi.json">OpenAPI 3.1 contract</a>
      </footer>
    </main>
  );
}
