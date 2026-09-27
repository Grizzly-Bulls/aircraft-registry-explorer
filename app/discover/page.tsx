import Link from 'next/link';

import { AircraftApiError, searchAircraftRegistry } from '@/src/lib/aircraftApi';
import {
  buildDiscoveryPageUrl,
  normalizeAircraftDiscoveryCursor,
  type AircraftDiscoveryFilters,
  type AircraftDiscoveryResponse,
} from '@/src/lib/aircraftContract';

type SearchParams = Record<string, string | string[] | undefined>;

const readSingle = (params: SearchParams, key: string): string | undefined => {
  const value = params[key];
  if (Array.isArray(value)) throw new Error(`${key} must be supplied at most once.`);
  return value;
};

const show = (value: string | number | null): string => (
  value === null || value === '' ? 'Not reported' : String(value)
);

const requestErrorMessage = (error: unknown): string => {
  if (error instanceof AircraftApiError) {
    if (error.status === 401) return 'The configured API key was not accepted.';
    if (error.status === 429) {
      const retry = error.retryAfter ? ` Retry after about ${error.retryAfter} seconds.` : '';
      return `The Aircraft API usage limit was reached.${retry}`;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : 'The registry search could not be completed.';
};

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  let manufacturer: string | undefined;
  let model: string | undefined;
  let state: string | undefined;
  let cursor: string | undefined;
  let parameterError: string | null = null;

  try {
    manufacturer = readSingle(params, 'manufacturer');
    model = readSingle(params, 'model');
    state = readSingle(params, 'state');
    cursor = readSingle(params, 'cursor');
  } catch (error) {
    parameterError = error instanceof Error ? error.message : 'Discovery parameters are invalid.';
  }

  const hasSearchInput = Boolean(
    manufacturer?.trim() || model?.trim() || state?.trim() || cursor,
  );

  let filters: AircraftDiscoveryFilters | null = null;
  let results: AircraftDiscoveryResponse | null = null;
  let errorMessage = parameterError;

  if (!errorMessage && hasSearchInput) {
    try {
      const search = await searchAircraftRegistry({ manufacturer, model, state }, cursor);
      filters = search.filters;
      results = search.response;
    } catch (error) {
      errorMessage = requestErrorMessage(error);
    }
  }

  let currentPageUrl = '/discover';
  let nextPageUrl: string | null = null;
  if (filters && results) {
    const normalizedCursor = normalizeAircraftDiscoveryCursor(cursor);
    currentPageUrl = buildDiscoveryPageUrl(filters, normalizedCursor);
    nextPageUrl = results.pagination.nextCursor
      ? buildDiscoveryPageUrl(filters, results.pagination.nextCursor)
      : null;
  }

  return (
    <main>
      <section className="toolShell">
        <nav className="nav" aria-label="Primary">
          <Link className="brand" href="/" aria-label="Aircraft Registry Explorer home">
            <span className="brandMark">N</span>
            <span>Aircraft Registry Explorer</span>
          </Link>
          <div className="navLinks">
            <Link href="/lookup">Lookup</Link>
            <Link href="/discover">Discover</Link>
            <Link href="/history">History</Link>
            <a href="https://grizzlybulls.com/aircraft-api">API</a>
          </div>
        </nav>

        <div className="toolIntro">
          <p className="kicker">Bounded registry discovery</p>
          <h1>Find aircraft by exact current-registry fields.</h1>
          <p>
            Search by manufacturer, model, registrant state, or a combination. Filters are
            normalized and matched exactly by the public API.
          </p>
        </div>

        <form className="discoveryForm" action="/discover" method="get">
          <label>
            <span>Manufacturer</span>
            <input
              name="manufacturer"
              type="text"
              placeholder="CESSNA"
              defaultValue={filters?.manufacturer ?? manufacturer ?? ''}
              autoComplete="off"
            />
          </label>
          <label>
            <span>Model</span>
            <input
              name="model"
              type="text"
              placeholder="172N"
              defaultValue={filters?.model ?? model ?? ''}
              autoComplete="off"
            />
          </label>
          <label>
            <span>Registrant state</span>
            <input
              name="state"
              type="text"
              placeholder="FL"
              maxLength={2}
              defaultValue={filters?.state ?? state ?? ''}
              autoComplete="off"
            />
          </label>
          <div className="formActions">
            <button type="submit">Search registry</button>
            <Link href="/discover">Clear</Link>
          </div>
        </form>

        <div className="searchBoundary">
          At least one filter is required. Results use exact matching and opaque keyset pagination.
          Owner-name search, fuzzy matching, arbitrary sorting, totals, and unfiltered registry
          walking are not provided.
        </div>

        {errorMessage ? (
          <div className="errorPanel" role="alert">
            <strong>Search unavailable</strong>
            <p>{errorMessage}</p>
          </div>
        ) : null}

        {results ? (
          <section className="resultsSection" aria-labelledby="results-heading">
            <div className="resultsHeading">
              <div>
                <p className="kicker">Current registry</p>
                <h2 id="results-heading">
                  {results.data.length === 0 ? 'No matching aircraft' : 'Matching aircraft'}
                </h2>
              </div>
              <span>Up to {results.pagination.limit} results per request</span>
            </div>

            {results.data.length ? (
              <div className="resultsTableWrap">
                <table className="resultsTable">
                  <thead>
                    <tr>
                      <th>N-number</th>
                      <th>Manufacturer</th>
                      <th>Model</th>
                      <th>Year</th>
                      <th>State</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.data.map((record) => (
                      <tr key={record.nNumber}>
                        <td>
                          <Link
                            className="resultLink"
                            href={{
                              pathname: '/lookup',
                              query: {
                                nNumber: record.nNumber,
                                from: currentPageUrl,
                              },
                            }}
                          >
                            {record.nNumber}
                          </Link>
                        </td>
                        <td>{show(record.manufacturer)}</td>
                        <td>{show(record.model)}</td>
                        <td>{show(record.manufactureYear)}</td>
                        <td>{show(record.registrantState)}</td>
                        <td>{show(record.sourceRegistrationStatusCode)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="emptyState">
                The search was valid, but the current registry did not return a matching record.
              </p>
            )}

            <div className="paginationBar">
              <span>Cursor pagination does not expose page numbers or total registry counts.</span>
              {nextPageUrl ? (
                <Link className="button primary" href={nextPageUrl}>
                  Next results
                </Link>
              ) : (
                <span className="endLabel">End of results</span>
              )}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
