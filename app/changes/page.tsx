import Link from 'next/link';

import { AircraftApiError, getRecentAircraftChanges } from '@/src/lib/aircraftApi';
import {
  labelAircraftHistoryEvent,
  type AircraftChangeDiff,
  type AircraftChangeFeedResponse,
} from '@/src/lib/aircraftContract';

const formatTimestamp = (value: string): string => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : `${parsed.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  })} UTC`;
};

const formatField = (value: string): string => (
  value.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase())
);

const displayDiffValue = (diff: AircraftChangeDiff, side: 'before' | 'after'): string => {
  const value = diff[side];
  if (!value.available) return 'Withheld / unavailable';
  if (value.value === null) return 'Not reported';
  if (typeof value.value === 'object') {
    return value.value.modeSCodeHex || value.value.modeSCodeOctal || 'Not reported';
  }
  return String(value.value);
};

const requestErrorMessage = (error: unknown): string => {
  if (error instanceof AircraftApiError) {
    if (error.status === 401) return 'The configured API key was not accepted.';
    if (error.status === 429) {
      const retry = error.retryAfter ? ` Retry after about ${error.retryAfter} seconds.` : '';
      return `The Aircraft API usage limit was reached.${retry}`;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : 'Recent aircraft changes could not be loaded.';
};

export default async function ChangesPage() {
  const until = new Date();
  const since = new Date(until.getTime() - 24 * 60 * 60 * 1000);

  let changes: AircraftChangeFeedResponse | null = null;
  let errorMessage: string | null = null;
  try {
    changes = await getRecentAircraftChanges(since.toISOString(), until.toISOString());
  } catch (error) {
    errorMessage = requestErrorMessage(error);
  }

  return (
    <main>
      <section className="toolShell">
        <nav className="nav" aria-label="Primary">
          <Link className="brand" href="/"><span className="brandMark">N</span><span>Aircraft Registry Explorer</span></Link>
          <div className="navLinks">
            <Link href="/lookup">Lookup</Link>
            <Link href="/icao24">ICAO24</Link>
            <Link href="/status">Status</Link>
            <Link href="/changes">Changes</Link>
            <a href="https://grizzlybulls.com/aircraft-api">API</a>
          </div>
        </nav>

        <div className="toolIntro">
          <p className="kicker">Recent observed changes</p>
          <h1>See what changed across recent reviewed FAA registry observations.</h1>
          <p>
            This page requests a bounded 24-hour observation window and shows at most 20 events
            from the same privacy-safe change-feed contract available to developers.
          </p>
        </div>

        <div className="historyBoundary">
          <strong>Observation time is not transaction time</strong>
          <p>
            Events describe differences Grizzly Bulls observed between validated FAA snapshots.
            They do not mean “sold,” “ownership transferred,” or establish the exact moment a
            real-world change occurred. Sensitive historical registrant values are not reconstructed.
          </p>
        </div>

        {errorMessage ? <div className="errorPanel" role="alert"><strong>Recent changes unavailable</strong><p>{errorMessage}</p></div> : null}

        {changes ? (
          <section className="historySection" aria-labelledby="recent-changes-heading">
            <div className="historySectionHeading">
              <div>
                <p className="kicker">Observed feed</p>
                <h2 id="recent-changes-heading">Latest bounded sample</h2>
              </div>
              <span>{formatTimestamp(changes.window.since)} → {formatTimestamp(changes.window.until)}</span>
            </div>

            {changes.data.length ? (
              <div className="historyEventList">
                {changes.data.map(({ event, diffs }) => (
                  <article className="historyEvent" key={`${event.source.archiveSha256}-${event.eventType}-${event.nNumber}`}>
                    <div className="eventMarker" aria-hidden="true" />
                    <div className="eventBody">
                      <div className="eventHeader">
                        <div>
                          <p className="historyLabel">{event.nNumber}</p>
                          <h3>{labelAircraftHistoryEvent(event.eventType)}</h3>
                        </div>
                        <time>{formatTimestamp(event.observedAt)}</time>
                      </div>

                      {diffs.length ? (
                        <div className="diffList">
                          {diffs.map(diff => (
                            <div className="diffRow" key={diff.field}>
                              <strong>{formatField(diff.field)}</strong>
                              <span>{displayDiffValue(diff, 'before')}</span>
                              <span aria-hidden="true">→</span>
                              <span>{displayDiffValue(diff, 'after')}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="eventNote">No reviewed non-sensitive before/after diff values were available for this event.</p>
                      )}

                      <div className="eventMeta">
                        <Link href={{ pathname: '/status', query: { nNumber: event.nNumber } }}>Check current lifecycle state</Link>
                        <a href={event.source.sourceUrl}>Source snapshot location</a>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className="emptyState">No reviewed changes were returned in this 24-hour observation window.</p>}

            {changes.pagination.nextCursor ? (
              <p className="historyIntro">
                More events exist in this window. The public demo intentionally shows only the
                first bounded page; integrations can continue with the opaque cursor from the API.
              </p>
            ) : null}
          </section>
        ) : null}
      </section>
    </main>
  );
}
