import Link from 'next/link';

import { AircraftApiError, getAircraftByIcao24 } from '@/src/lib/aircraftApi';
import {
  normalizeAircraftIcao24,
  type AircraftPublicCurrentRecord,
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

const requestErrorMessage = (error: unknown): string => {
  if (error instanceof AircraftApiError) {
    if (error.status === 401) return 'The configured API key was not accepted.';
    if (error.status === 404) return 'No current public FAA registration was found for that ICAO24 / Mode S address.';
    if (error.status === 429) {
      const retry = error.retryAfter ? ` Retry after about ${error.retryAfter} seconds.` : '';
      return `The Aircraft API usage limit was reached.${retry}`;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : 'ICAO24 lookup could not be completed.';
};

const Result = ({ record }: { record: AircraftPublicCurrentRecord }) => (
  <div className="resultStack">
    <section className="resultHero">
      <div>
        <p className="kicker">Current FAA registry match</p>
        <h2>{record.registration.nNumber}</h2>
        <p className="resultSummary">
          {show(record.aircraft.manufacturer)} {show(record.aircraft.model)}
          {record.aircraft.manufactureYear ? ` · ${record.aircraft.manufactureYear}` : ''}
        </p>
      </div>
      <div className="statusBlock">
        <span>ICAO24 / Mode S hex</span>
        <strong>{show(record.aircraft.modeSCodeHex)}</strong>
      </div>
    </section>

    <section className="resultPanel">
      <div className="panelHeading">
        <p className="kicker">Resolved identifiers</p>
        <h3>One current public registration</h3>
      </div>
      <dl className="detailGrid">
        <div className="detailItem"><dt>N-number</dt><dd>{record.registration.nNumber}</dd></div>
        <div className="detailItem"><dt>ICAO24 / Mode S hex</dt><dd>{show(record.aircraft.modeSCodeHex)}</dd></div>
        <div className="detailItem"><dt>Mode S octal</dt><dd>{show(record.aircraft.modeSCodeOctal)}</dd></div>
        <div className="detailItem"><dt>Manufacturer</dt><dd>{show(record.aircraft.manufacturer)}</dd></div>
        <div className="detailItem"><dt>Model</dt><dd>{show(record.aircraft.model)}</dd></div>
        <div className="detailItem"><dt>Serial number</dt><dd>{show(record.aircraft.serialNumber)}</dd></div>
      </dl>
      <p className="interpretationNote">
        This is exact resolution against the current reviewed U.S. FAA registry, not a live ADS-B
        position lookup or global flight-tracking service.
      </p>
      <div className="recordActions">
        <Link className="button primary" href={{ pathname: '/lookup', query: { nNumber: record.registration.nNumber } }}>
          Open full N-number record
        </Link>
      </div>
    </section>

    <section className="sourcePanel">
      <p className="kicker">Provenance</p>
      <h3>Source and observation</h3>
      <dl className="detailGrid compact">
        <div className="detailItem"><dt>Provider</dt><dd>FAA releasable aircraft registry</dd></div>
        <div className="detailItem"><dt>Retrieved at</dt><dd>{record.source.retrievedAt}</dd></div>
      </dl>
    </section>
  </div>
);

export default async function Icao24Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  let rawHex: string | undefined;
  let parameterError: string | null = null;

  try {
    rawHex = readSingle(params, 'hex');
  } catch (error) {
    parameterError = error instanceof Error ? error.message : 'ICAO24 parameters are invalid.';
  }

  const hex = rawHex ? normalizeAircraftIcao24(rawHex) : null;
  let record: AircraftPublicCurrentRecord | null = null;
  let errorMessage = parameterError;

  if (!errorMessage && rawHex && !hex) {
    errorMessage = 'Enter exactly six hexadecimal digits, such as A12239.';
  }

  if (!errorMessage && hex) {
    try {
      record = (await getAircraftByIcao24(hex)).data;
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
          <p className="kicker">Exact ICAO24 / Mode S lookup</p>
          <h1>Resolve a six-digit ICAO24 address to its current FAA registration.</h1>
          <p>
            Enter one hexadecimal surveillance address. The server calls the same versioned public
            Aircraft Intelligence API available to developers.
          </p>
        </div>

        <form className="lookupForm" action="/icao24" method="get">
          <label>
            <span>ICAO24 / Mode S hex</span>
            <input name="hex" type="text" placeholder="A12239" defaultValue={rawHex ?? ''} autoComplete="off" spellCheck={false} required />
          </label>
          <button type="submit">Resolve aircraft</button>
        </form>

        {errorMessage ? <div className="errorPanel" role="alert"><strong>ICAO24 lookup unavailable</strong><p>{errorMessage}</p></div> : null}
        {record ? <Result record={record} /> : null}
      </section>
    </main>
  );
}
