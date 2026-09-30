import Link from 'next/link';

import { AircraftApiError, getAircraftNNumberStatus } from '@/src/lib/aircraftApi';
import {
  normalizeAircraftNNumber,
  type AircraftNNumberStatusResponse,
} from '@/src/lib/aircraftContract';

type SearchParams = Record<string, string | string[] | undefined>;
type StatusData = AircraftNNumberStatusResponse['data'];

const readSingle = (params: SearchParams, key: string): string | undefined => {
  const value = params[key];
  if (Array.isArray(value)) throw new Error(`${key} must be supplied at most once.`);
  return value;
};

const show = (value: string | number | null | undefined): string => (
  value === null || value === undefined || value === '' ? 'Not reported' : String(value)
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
  return error instanceof Error ? error.message : 'N-number status could not be loaded.';
};

const Context = ({ status }: { status: StatusData }) => {
  if (status.state === 'registered' && status.registered) {
    return (
      <dl className="detailGrid">
        <div className="detailItem"><dt>Manufacturer</dt><dd>{show(status.registered.aircraft.manufacturer)}</dd></div>
        <div className="detailItem"><dt>Model</dt><dd>{show(status.registered.aircraft.model)}</dd></div>
        <div className="detailItem"><dt>Registration status</dt><dd>{show(status.registered.registration.sourceStatusCode)}</dd></div>
      </dl>
    );
  }
  if (status.state === 'reserved' && status.reserved) {
    return (
      <dl className="detailGrid">
        <div className="detailItem"><dt>Reserve date</dt><dd>{show(status.reserved.reserveDate)}</dd></div>
        <div className="detailItem"><dt>Reservation type code</dt><dd>{show(status.reserved.sourceReservationTypeCode)}</dd></div>
        <div className="detailItem"><dt>Purge date</dt><dd>{show(status.reserved.purgeDate)}</dd></div>
      </dl>
    );
  }
  if (status.state === 'deregistered' && status.deregistered) {
    return (
      <dl className="detailGrid">
        <div className="detailItem"><dt>Cancellation date</dt><dd>{show(status.deregistered.cancellationDate)}</dd></div>
        <div className="detailItem"><dt>Manufacture year</dt><dd>{show(status.deregistered.manufactureYear)}</dd></div>
        <div className="detailItem"><dt>ICAO24 / Mode S hex</dt><dd>{show(status.deregistered.modeSCodeHex)}</dd></div>
      </dl>
    );
  }
  return <p className="emptyState">The N-number was absent from the reviewed current, reservation, and deregistration publication authorities in this source observation.</p>;
};

export default async function StatusPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  let rawNNumber: string | undefined;
  let parameterError: string | null = null;

  try {
    rawNNumber = readSingle(params, 'nNumber');
  } catch (error) {
    parameterError = error instanceof Error ? error.message : 'Status parameters are invalid.';
  }

  const nNumber = rawNNumber ? normalizeAircraftNNumber(rawNNumber) : null;
  let status: StatusData | null = null;
  let errorMessage = parameterError;

  if (!errorMessage && rawNNumber && !nNumber) {
    errorMessage = 'Enter a valid U.S. N-number such as N12345 or N-123AB.';
  }
  if (!errorMessage && nNumber) {
    try {
      status = (await getAircraftNNumberStatus(nNumber)).data;
    } catch (error) {
      errorMessage = requestErrorMessage(error);
    }
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
          <p className="kicker">N-number lifecycle status</p>
          <h1>Check whether an N-number is registered, reserved, deregistered, or unknown.</h1>
          <p>
            The answer is evidence from reviewed FAA publication authorities with source
            observation time. It is not an FAA availability determination.
          </p>
        </div>

        <form className="lookupForm" action="/status" method="get">
          <label>
            <span>N-number</span>
            <input name="nNumber" type="text" placeholder="N172SP" defaultValue={rawNNumber ?? ''} autoComplete="off" spellCheck={false} required />
          </label>
          <button type="submit">Check status</button>
        </form>

        <div className="historyBoundary">
          <strong>Unknown does not mean available</strong>
          <p>
            Registry and reservation state can change as FAA requests are processed. This resolver
            intentionally reports <code>availability: not_determined</code> for every state and
            does not promise that an N-number can be acquired.
          </p>
        </div>

        {errorMessage ? <div className="errorPanel" role="alert"><strong>Status unavailable</strong><p>{errorMessage}</p></div> : null}

        {status ? (
          <div className="resultStack">
            <section className="resultHero">
              <div><p className="kicker">Reviewed lifecycle state</p><h2>{status.nNumber}</h2><p className="resultSummary">Observed {status.observedAt}</p></div>
              <div className="statusBlock"><span>State</span><strong>{status.state}</strong></div>
            </section>
            <section className="resultPanel">
              <div className="panelHeading"><p className="kicker">State context</p><h3>Evidence appropriate to this state</h3></div>
              <Context status={status} />
              <p className="interpretationNote">
                Reservation context deliberately excludes reserving-party names and addresses.
                Deregistration context is non-PII. Current registration details remain subject to
                current FAA public releasability.
              </p>
            </section>
            <section className="sourcePanel">
              <p className="kicker">Provenance</p><h3>Source observation</h3>
              <dl className="detailGrid compact">
                <div className="detailItem"><dt>Retrieved at</dt><dd>{status.source.retrievedAt}</dd></div>
                <div className="detailItem"><dt>Availability</dt><dd>{status.availability}</dd></div>
              </dl>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
