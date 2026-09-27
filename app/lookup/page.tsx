import Link from 'next/link';

import { AircraftApiError, getAircraftByNNumber } from '@/src/lib/aircraftApi';
import {
  normalizeAircraftNNumber,
  safeDiscoveryReturnUrl,
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
    if (error.status === 429) {
      const retry = error.retryAfter ? ` Retry after about ${error.retryAfter} seconds.` : '';
      return `The Aircraft API usage limit was reached.${retry}`;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : 'The aircraft lookup could not be completed.';
};

const Detail = ({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) => (
  <div className="detailItem">
    <dt>{label}</dt>
    <dd>{show(value)}</dd>
  </div>
);

const AircraftResult = ({ record }: { record: AircraftPublicCurrentRecord }) => {
  const aircraft = record.aircraft;
  const registration = record.registration;

  return (
    <div className="resultStack">
      <section className="resultHero" aria-labelledby="aircraft-result-heading">
        <div>
          <p className="kicker">Current FAA registry record</p>
          <h2 id="aircraft-result-heading">{registration.nNumber}</h2>
          <p className="resultSummary">
            {show(aircraft.manufacturer)} {show(aircraft.model)}
            {aircraft.manufactureYear ? ` · ${aircraft.manufactureYear}` : ''}
          </p>
        </div>
        <div className="statusBlock">
          <span>Registration status code</span>
          <strong>{show(registration.sourceStatusCode)}</strong>
        </div>
      </section>

      <section className="resultPanel" aria-labelledby="aircraft-heading">
        <div className="panelHeading">
          <p className="kicker">Aircraft</p>
          <h3 id="aircraft-heading">Airframe and identifiers</h3>
        </div>
        <dl className="detailGrid">
          <Detail label="Manufacturer" value={aircraft.manufacturer} />
          <Detail label="Model" value={aircraft.model} />
          <Detail label="Manufacture year" value={aircraft.manufactureYear} />
          <Detail label="Serial number" value={aircraft.serialNumber} />
          <Detail label="Aircraft type code" value={aircraft.sourceAircraftTypeCode} />
          <Detail label="Category code" value={aircraft.sourceCategoryCode} />
          <Detail label="Weight class code" value={aircraft.sourceWeightClassCode} />
          <Detail label="Seats" value={aircraft.seatCount} />
          <Detail label="Engines" value={aircraft.engineCount} />
          <Detail label="Airworthiness date" value={aircraft.airworthinessDate} />
          <Detail label="Mode S / ICAO24 hex" value={aircraft.modeSCodeHex} />
          <Detail label="Mode S octal" value={aircraft.modeSCodeOctal} />
        </dl>
        <p className="interpretationNote">
          Mode S / ICAO24 values are fields returned for this N-number. This app does not provide
          reverse lookup from a Mode S or ICAO24 identifier.
        </p>
      </section>

      <section className="resultPanel" aria-labelledby="engine-heading">
        <div className="panelHeading">
          <p className="kicker">Engine</p>
          <h3 id="engine-heading">Reported engine details</h3>
        </div>
        <dl className="detailGrid">
          <Detail label="Manufacturer" value={aircraft.engine.manufacturer} />
          <Detail label="Model" value={aircraft.engine.model} />
          <Detail label="Engine type code" value={aircraft.engine.sourceTypeCode} />
          <Detail label="Horsepower" value={aircraft.engine.horsepower} />
          <Detail label="Thrust" value={aircraft.engine.thrust} />
          <Detail label="Type certificate holder" value={aircraft.typeCertificateHolder} />
        </dl>
      </section>

      <section className="resultPanel" aria-labelledby="registration-heading">
        <div className="panelHeading">
          <p className="kicker">Registration</p>
          <h3 id="registration-heading">Current registration metadata</h3>
        </div>
        <dl className="detailGrid">
          <Detail label="Certificate issue date" value={registration.certificateIssueDate} />
          <Detail label="Expiration date" value={registration.expirationDate} />
          <Detail label="Last activity date" value={registration.lastActivityDate} />
          <Detail label="Registrant state" value={record.registrant.state} />
          <Detail
            label="Fractional ownership flag"
            value={
              registration.fractionalOwnership === null
                ? null
                : registration.fractionalOwnership
                  ? 'Yes'
                  : 'No'
            }
          />
        </dl>
        <p className="interpretationNote">
          FAA registration data identifies the public registrant record. It is not proof of
          beneficial economic ownership.
        </p>
      </section>

      <section className="sourcePanel" aria-labelledby="source-heading">
        <div>
          <p className="kicker">Provenance</p>
          <h3 id="source-heading">Source and freshness</h3>
        </div>
        <dl className="detailGrid compact">
          <Detail label="Provider" value="FAA releasable aircraft registry" />
          <Detail label="Retrieved at" value={record.source.retrievedAt} />
          <Detail label="Source contract" value={record.source.sourceContractVersion} />
          <Detail label="First observed" value={record.history.firstObservedAt} />
          <Detail label="Last observed" value={record.history.lastObservedAt} />
          <Detail label="Observed versions" value={record.history.versionCount} />
        </dl>
        <a className="textLink" href={record.source.sourceUrl}>
          Open source location
        </a>
      </section>
    </div>
  );
};

export default async function LookupPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  let rawNNumber: string | undefined;
  let from: string | undefined;
  let parameterError: string | null = null;
  try {
    rawNNumber = readSingle(params, 'nNumber');
    from = readSingle(params, 'from');
  } catch (error) {
    parameterError = error instanceof Error ? error.message : 'Lookup parameters are invalid.';
  }

  const returnUrl = safeDiscoveryReturnUrl(from);
  let record: AircraftPublicCurrentRecord | null = null;
  let errorMessage = parameterError;

  if (!errorMessage && rawNNumber) {
    const normalized = normalizeAircraftNNumber(rawNNumber);
    if (!normalized) {
      errorMessage = 'Enter a valid U.S. N-number such as N12345 or N-123AB.';
    } else {
      try {
        record = (await getAircraftByNNumber(normalized)).data;
      } catch (error) {
        errorMessage = requestErrorMessage(error);
      }
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
            <a href="https://grizzlybulls.com/aircraft-api">API</a>
          </div>
        </nav>

        <div className="toolIntro">
          <p className="kicker">Exact N-number lookup</p>
          <h1>Look up a current U.S. aircraft registration.</h1>
          <p>
            Enter one N-number. The request is made server-side using your configured Grizzly Bulls
            Aircraft Intelligence API key.
          </p>
        </div>

        <form className="lookupForm" action="/lookup" method="get">
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
          <button type="submit">Look up aircraft</button>
        </form>

        {returnUrl ? (
          <p className="contextLink">
            <Link href={returnUrl}>← Back to discovery results</Link>
          </p>
        ) : null}

        {errorMessage ? (
          <div className="errorPanel" role="alert">
            <strong>Lookup unavailable</strong>
            <p>{errorMessage}</p>
          </div>
        ) : null}

        {record ? <AircraftResult record={record} /> : null}
      </section>
    </main>
  );
}
