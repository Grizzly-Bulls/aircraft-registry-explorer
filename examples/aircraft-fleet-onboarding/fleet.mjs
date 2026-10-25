/**
 * A small current-registration enrichment example for explicitly supplied
 * N-numbers. Never enumerates FAA records or persists registrant details.
 */
const BASE_URL = 'https://api.grizzlybulls.com/v1/aircraft/';
const NUMBER_PATTERN = /^N(?:[1-9][0-9]{0,4}|[1-9][0-9]{0,3}[A-HJ-NP-Z]|[1-9][0-9]{0,2}[A-HJ-NP-Z]{2})$/;
export const MAX_AIRCRAFT = 25;
export const REQUEST_SPACING_MS = 2200; // Below Free's 30 RPM rate ceiling.

export class FleetInputError extends Error {}
export class FleetApiError extends Error {
  constructor(message, status = null) {
    super(message);
    this.status = status;
  }
}

export function normalizeNNumber(value) {
  if (typeof value !== 'string') throw new FleetInputError('N-number must be a string');
  const normalized = value.trim().toUpperCase().replace(/^N-/, 'N');
  if (!NUMBER_PATTERN.test(normalized)) throw new FleetInputError('Invalid U.S. N-number input');
  return normalized;
}

/** Deliberately one-column only. Do not pretend to support generic CSV. */
export function parseFleetCsv(contents) {
  if (typeof contents !== 'string' || contents.length > 32_768 || contents.includes('\0')) {
    throw new FleetInputError('Invalid or oversized one-column input');
  }
  const lines = contents.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines.shift()?.trim() !== 'nNumber') {
    throw new FleetInputError('Expected a one-column CSV headed nNumber');
  }
  const results = [];
  const seen = new Set();
  for (const line of lines) {
    if (!line.trim()) continue;
    if (/[",\r]/.test(line)) throw new FleetInputError('Only one unquoted nNumber column is supported');
    const nNumber = normalizeNNumber(line);
    if (!seen.has(nNumber)) {
      seen.add(nNumber);
      results.push(nNumber);
      if (results.length > MAX_AIRCRAFT) throw new FleetInputError('Input exceeds 25 unique N-numbers');
    }
  }
  if (results.length === 0) throw new FleetInputError('Provide at least one N-number');
  return results;
}

function field(value) {
  return typeof value === 'string' ? value : null;
}

/** Copy allowlisted aircraft/source fields only, never the registrant object. */
export function projectCurrentRecord(expectedNNumber, payload) {
  const data = payload?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)
      || !data.registration || !data.aircraft || !data.source
      || data.registration.nNumber !== expectedNNumber) {
    throw new FleetApiError('Unexpected current-record response contract');
  }
  const retrievedAt = data.source.retrievedAt;
  if (typeof retrievedAt !== 'string' || !Number.isFinite(Date.parse(retrievedAt))) {
    throw new FleetApiError('Missing source retrieval timestamp');
  }
  const year = data.aircraft.manufactureYear;
  if (!(year === null || (Number.isInteger(year) && year >= 1900 && year <= 2100))) {
    throw new FleetApiError('Unexpected aircraft manufacture-year field');
  }
  return {
    nNumber: expectedNNumber,
    status: 'current_registration_found',
    manufacturer: field(data.aircraft.manufacturer),
    model: field(data.aircraft.model),
    manufactureYear: year,
    serialNumber: field(data.aircraft.serialNumber),
    sourceRetrievedAt: retrievedAt,
  };
}

function retryDelayMs(response, attempt) {
  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after');
    if (!retryAfter || !/^\d+$/.test(retryAfter)) return null;
    const seconds = Number(retryAfter);
    return Number.isSafeInteger(seconds) && seconds >= 1 && seconds <= 30 ? seconds * 1000 : null;
  }
  return response.status === 503 ? (attempt === 1 ? 2000 : 4000) : null;
}

/** Three attempts maximum; never automatically retry ambiguous network failures. */
export async function lookupOne(nNumber, {
  apiKey,
  fetchImpl = fetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new FleetInputError('Server-side API key is required');
  }
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(BASE_URL + encodeURIComponent(nNumber), {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new FleetApiError('Network request failed; inspect connectivity before manually retrying');
    }
    if (response.status === 404) return { nNumber, status: 'no_current_registration_found' };
    if (response.ok) {
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new FleetApiError('Invalid JSON from Aircraft API');
      }
      return projectCurrentRecord(nNumber, payload);
    }
    const delay = retryDelayMs(response, attempt);
    if (attempt < 3 && delay !== null) {
      await sleep(delay);
      continue;
    }
    throw new FleetApiError(
      response.status === 401 || response.status === 403
        ? 'Authentication or key scope failed; stop and inspect your key'
        : response.status === 429
          ? 'Rate or monthly quota reached; review Retry-After and account usage'
          : 'Aircraft API returned HTTP ' + response.status + '; operation stopped',
      response.status,
    );
  }
  throw new FleetApiError('Unreachable retry state');
}

/** Validate the entire batch before making the first metered request. */
export async function refreshFleet(nNumbers, options) {
  if (!Array.isArray(nNumbers) || nNumbers.length === 0 || nNumbers.length > MAX_AIRCRAFT
      || new Set(nNumbers).size !== nNumbers.length
      || nNumbers.some(n => normalizeNNumber(n) !== n)) {
    throw new FleetInputError('Expected 1–25 unique canonical N-numbers');
  }
  const sleep = options?.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const rows = [];
  for (const nNumber of nNumbers) {
    if (rows.length > 0) await sleep(REQUEST_SPACING_MS);
    rows.push(await lookupOne(nNumber, { ...options, sleep }));
  }
  return {
    schemaVersion: 'aircraft-fleet-refresh-example-v1',
    source: 'Grizzly Bulls Aircraft Intelligence API — current FAA registry only',
    rows,
  };
}
