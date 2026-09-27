import Link from 'next/link';

import { AircraftApiError, getAircraftHistory } from '@/src/lib/aircraftApi';
import {
  AIRCRAFT_HISTORY_PAGE_SIZE,
  buildHistoryPageUrl,
  labelAircraftHistoryEvent,
  normalizeAircraftHistoryOffset,
  normalizeAircraftNNumber,
  type AircraftHistoryEvent,
  type AircraftHistoryOffsets,
  type AircraftHistoryPageMeta,
  type AircraftHistoryResponse,
  type AircraftHistoryVersion,
} from '@/src/lib/aircraftContract';

type SearchParams = Record<string, string | string[] | undefined>;

const readSingle = (params: SearchParams, key: string): string | undefined => {
  const value = params[key];
  if (Array.isArray(value)) throw new Error(`${key} must be supplied at most once.`);
  return value;
};

const show = (value: string | number | null | undefined): string => (
  value === null || value === undefined || value === '' ? 'Not reported' : String(value)
);

const formatTimestamp = (value: string): string => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }) + ' UTC';
};

const formatField = (value: string): string => (
  value.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase())
);

const requestErrorMessage = (error: unknown): string => {
  if (error instanceof AircraftApiError) {
    if (error.status === 401) return 'The configured API key was not accepted.';
    if (error.status === 404) return 'No retained observed history was found for that N-number.';
    if (error.status === 429) {
      const retry = error.retryAfter ? ` Retry after about ${error.retryAfter} seconds.` : '';
      return `The Aircraft API usage limit was reached.${retry}`;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : 'Aircraft history could not be loaded.';
};

const VersionCard = ({ version }: { version: AircraftHistoryVersion }) => (
  <article className="historyVersion">
    <div className="historyVersionRail" aria-hidden="true">
      <span />
    </div>
    <div className="historyVersionBody">
      <div className="historyVersionHeader">
        <div>
          <p className="historyLabel">Observed registration state</p>
          <h3>{version.registration.nNumber}</h3>
        </div>
        <span className="historyStatus">
          Status {show(version.registration.sourceStatusCode)}
        </span>
      </div>

      <div className="observationWindow">
        <div>
          <span>Observed from</span>
          <strong>{formatTimestamp(version.observedFrom.retrievedAt)}</strong>
        </div>
        <div>
          <span>Observed through</span>
          <strong>{formatTimestamp(version.observedThrough.retrievedAt)}</strong>
        </div>
      </div>

      <dl className="historyDetailGrid">
        <div>
          <dt>Manufacture year</dt>
          <dd>{show(version.aircraft.manufactureYear)}</dd>
        </div>
        <div>
          <dt>Serial number</dt>
          <dd>{show(version.aircraft.serialNumber)}</dd>
        </div>
        <div>
          <dt>Aircraft type code</dt>
          <dd>{show(version.aircraft.sourceAircraftTypeCode)}</dd>
        </div>
        <div>
          <dt>Engine type code</dt>
          <dd>{show(version.aircraft.sourceEngineTypeCode)}</dd>
        </div>
        <div>
          <dt>Airworthiness date</dt>
          <dd>{show(version.aircraft.airworthinessDate)}</dd>
        </div>
        <div>
          <dt>Mode S / ICAO24 hex</dt>
          <dd>{show(version.aircraft.modeSCodeHex)}</dd>
        </div>
        <div>
          <dt>Certificate issue date</dt>
          <dd>{show(version.registration.certificateIssueDate)}</dd>
        </div>
        <div>
          <dt>Expiration date</dt>
          <dd>{show(version.registration.expirationDate)}</dd>
        </div>
      </dl>

      <div className="historySourceRow">
        <span>Source contract {version.observedFrom.sourceContractVersion}</span>
        <a href={version.observedFrom.sourceUrl}>Source snapshot location</a>
      </div>
    </div>
  </article>
);

const EventCard = ({ event }: { event: AircraftHistoryEvent }) => (
  <article className="historyEvent">
    <div className="eventMarker" aria-hidden="true" />
    <div className="eventBody">
      <div className="eventHeader">
        <div>
          <p className="historyLabel">Observed change event</p>
          <h3>{labelAircraftHistoryEvent(event.eventType)}</h3>
        </div>
        <time>{formatTimestamp(event.observedAt)}</time>
      </div>

      {event.sourceEffectiveDate ? (
        <p className="effectiveDate">
          Source effective date: <strong>{event.sourceEffectiveDate}</strong>
        </p>
      ) : null}

      {event.oldSourceRegistrationStatusCode !== null
        || event.newSourceRegistrationStatusCode !== null ? (
        <p className="statusTransition">
          Registration status: {show(event.oldSourceRegistrationStatusCode)} →{' '}
          {show(event.newSourceRegistrationStatusCode)}
        </p>
      ) : null}

      {event.changedFields.length ? (
        <div className="changedFields" aria-label="Changed fields">
          {event.changedFields.map(field => (
            <span key={field}>{formatField(field)}</span>
          ))}
        </div>
      ) : (
        <p className="eventNote">No non-PII field list was reported for this event.</p>
      )}

      <div className="eventMeta">
        <span>
          Previous observation:{' '}
          {event.previousObservedAt ? formatTimestamp(event.previousObservedAt) : 'Not reported'}
        </span>
        <a href={event.source.sourceUrl}>Source snapshot location</a>
      </div>
    </div>
  </article>
);

const Pager = ({
  label,
  meta,
  nNumber,
  offsets,
  dimension,
}: {
  label: string;
  meta: AircraftHistoryPageMeta;
  nNumber: string;
  offsets: AircraftHistoryOffsets;
  dimension: 'versions' | 'events';
}) => {
  const offsetKey = dimension === 'versions' ? 'versionsOffset' : 'eventsOffset';
  const previousOffset = Math.max(0, meta.offset - meta.limit);
  const nextOffset = meta.offset + meta.limit;

  const previousOffsets = { ...offsets, [offsetKey]: previousOffset };
  const nextOffsets = { ...offsets, [offsetKey]: nextOffset };

  return (
    <div className="historyPager" aria-label={`${label} pagination`}>
      <span>
        Showing {meta.total === 0 ? 0 : meta.offset + 1}
        {'–'}
        {Math.min(meta.offset + meta.limit, meta.total)} of {meta.total}
      </span>
      <div>
        {meta.offset > 0 ? (
          <Link className="pagerLink" href={buildHistoryPageUrl(nNumber, previousOffsets)}>
            Previous {dimension}
          </Link>
        ) : null}
        {meta.hasMore ? (
          <Link className="pagerLink primaryPager" href={buildHistoryPageUrl(nNumber, nextOffsets)}>
            Next {dimension}
          </Link>
        ) : null}
      </div>
    </div>
  );
};

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  let rawNNumber: string | undefined;
  let offsets: AircraftHistoryOffsets = { versionsOffset: 0, eventsOffset: 0 };
  let parameterError: string | null = null;

  try {
    rawNNumber = readSingle(params, 'nNumber');
    offsets = {
      versionsOffset: normalizeAircraftHistoryOffset(
        readSingle(params, 'versionsOffset'),
        'versionsOffset',
      ),
      eventsOffset: normalizeAircraftHistoryOffset(
        readSingle(params, 'eventsOffset'),
        'eventsOffset',
      ),
    };
  } catch (error) {
    parameterError = error instanceof Error ? error.message : 'History parameters are invalid.';
  }

  const nNumber = rawNNumber ? normalizeAircraftNNumber(rawNNumber) : null;
  let history: AircraftHistoryResponse | null = null;
  let errorMessage = parameterError;

  if (!errorMessage && rawNNumber && !nNumber) {
    errorMessage = 'Enter a valid U.S. N-number such as N12345 or N-123AB.';
  }

  if (!errorMessage && nNumber) {
    try {
      history = await getAircraftHistory(nNumber, offsets);
    } catch (error) {
      errorMessage = requestErrorMessage(error);
    }
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
          <p className="kicker">Observed registry history</p>
          <h1>See how an N-number appeared across retained FAA snapshots.</h1>
          <p>
            History here means states and change events observed by Grizzly Bulls in validated FAA
            registry snapshots. Observation windows are not legal ownership periods and do not
            establish the exact time a real-world change occurred.
          </p>
        </div>

        <form className="lookupForm" action="/history" method="get">
          <label>
            <span>N-number</span>
            <input
              name="nNumber"
              type="text"
              placeholder="N12345"
              defaultValue={rawNNumber ?? ''}
              autoComplete="off"
              spellCheck={false}
              required
            />
          </label>
          <button type="submit">View observed history</button>
        </form>

        <div className="historyBoundary">
          <strong>How to read this page</strong>
          <p>
            “Observed from” and “observed through” are FAA snapshot retrieval boundaries, not legal
            ownership dates. A source effective date appears only when the API supplies one.
            Historical registrant names, addresses, aliases, and other personal details are not
            displayed here. Current FAA withholding remains authoritative over retained history.
          </p>
        </div>

        {nNumber ? (
          <p className="contextLink">
            <Link href={{ pathname: '/lookup', query: { nNumber } }}>
              ← Back to current record
            </Link>
          </p>
        ) : null}

        {errorMessage ? (
          <div className="errorPanel" role="alert">
            <strong>History unavailable</strong>
            <p>{errorMessage}</p>
          </div>
        ) : null}

        {history && nNumber ? (
          <div className="historyLayout">
            <section className="historySection" aria-labelledby="versions-heading">
              <div className="historySectionHeading">
                <div>
                  <p className="kicker">Observed versions</p>
                  <h2 id="versions-heading">Registration states over time</h2>
                </div>
                <span>{AIRCRAFT_HISTORY_PAGE_SIZE} per request</span>
              </div>

              {history.data.versions.length ? (
                <div className="historyVersionList">
                  {history.data.versions.map((version, index) => (
                    <VersionCard
                      key={`${version.aircraftId ?? history.data.nNumber}-${version.observedFrom.retrievedAt}-${index}`}
                      version={version}
                    />
                  ))}
                </div>
              ) : (
                <p className="emptyState">No observed versions were returned for this page.</p>
              )}

              <Pager
                label="Observed versions"
                meta={history.pagination.versions}
                nNumber={nNumber}
                offsets={offsets}
                dimension="versions"
              />
            </section>

            <section className="historySection" aria-labelledby="events-heading">
              <div className="historySectionHeading">
                <div>
                  <p className="kicker">PII-free events</p>
                  <h2 id="events-heading">Observed change events</h2>
                </div>
                <span>{AIRCRAFT_HISTORY_PAGE_SIZE} per request</span>
              </div>

              <p className="historyIntro">
                Events describe reviewed registration, aircraft, status, and privacy-state changes.
                They do not expose old registrant names or addresses.
              </p>

              {history.data.events.length ? (
                <div className="historyEventList">
                  {history.data.events.map((event, index) => (
                    <EventCard
                      key={`${event.eventType}-${event.observedAt}-${index}`}
                      event={event}
                    />
                  ))}
                </div>
              ) : (
                <p className="emptyState">No observed change events were returned for this page.</p>
              )}

              <Pager
                label="Observed events"
                meta={history.pagination.events}
                nNumber={nNumber}
                offsets={offsets}
                dimension="events"
              />
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
