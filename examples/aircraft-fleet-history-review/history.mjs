/**
 * Bounded review of observed FAA history for an explicitly supplied small fleet.
 * Project only allowlisted event metadata; never store version rows or registrant PII.
 */
import { FleetInputError, normalizeNNumber, parseFleetCsv, REQUEST_SPACING_MS } from '../aircraft-fleet-onboarding/fleet.mjs';

export { FleetInputError, parseFleetCsv };
export const MAX_HISTORY_AUDIT_AIRCRAFT = 10;
export const MAX_EVENTS_PER_AIRCRAFT = 10;

const BASE = 'https://api.grizzlybulls.com/v1/aircraft/';
const EVENT_TYPES = new Set([
  'registration_added', 'registration_removed', 'registration_record_changed',
  'aircraft_assignment_changed', 'status_changed', 'registrant_changed',
  'registrant_pii_withheld', 'registrant_pii_released',
]);
const CHANGED_FIELDS = new Set([
  'aircraft_assignment', 'registration_identifier', 'aircraft_model',
  'engine_model', 'manufacture_year', 'aircraft_type', 'engine_type',
  'registration_status', 'mode_s_code', 'certificate_issue_date',
  'expiration_date', 'last_activity_date', 'airworthiness_date',
  'fractional_ownership', 'registrant_type',
]);

export class HistoryAuditError extends Error {}

const isTimestamp = value => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T/.test(value)
  && !Number.isNaN(Date.parse(value));

function projectEvent(nNumber, event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)
      || event.contractVersion !== 'aircraft-public-v1'
      || event.nNumber !== nNumber || !EVENT_TYPES.has(event.eventType)
      || !isTimestamp(event.observedAt)
      || !(event.sourceEffectiveDate === null
        || (typeof event.sourceEffectiveDate === 'string'
          && /^\d{4}-\d{2}-\d{2}$/.test(event.sourceEffectiveDate)))
      || !Array.isArray(event.changedFields)
      || event.changedFields.some(field => !CHANGED_FIELDS.has(field))) {
    throw new HistoryAuditError('Unexpected history event contract');
  }
  return {
    eventType: event.eventType,
    observedAt: event.observedAt,
    sourceEffectiveDate: event.sourceEffectiveDate,
    changedFields: [...event.changedFields],
  };
}

/**
 * History paginates versions and events separately; this example intentionally
 * requests one bounded page and never presents it as complete if hasMore=true.
 */
export function projectHistory(nNumber, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
      || !payload.data || payload.data.nNumber !== nNumber
      || !Array.isArray(payload.data.versions)
      || !Array.isArray(payload.data.events)
      || !payload.pagination || !payload.pagination.events) {
    throw new HistoryAuditError('Unexpected Aircraft history response contract');
  }
  const page = payload.pagination.events;
  if (!Number.isInteger(page.limit) || page.limit !== MAX_EVENTS_PER_AIRCRAFT
      || page.offset !== 0 || !Number.isSafeInteger(page.total) || page.total < 0
      || typeof page.hasMore !== 'boolean'
      || payload.data.events.length > MAX_EVENTS_PER_AIRCRAFT
      || payload.data.events.length > page.total
      || page.hasMore !== (page.total > payload.data.events.length)) {
    throw new HistoryAuditError('Invalid bounded event-page metadata');
  }
  const events = payload.data.events.map(event => projectEvent(nNumber, event));
  return {
    nNumber,
    status: events.length ? 'observed_events_found' : 'no_observed_events_in_retained_history',
    eventCountShown: events.length,
    totalObservedEventsReported: page.total,
    moreEventsAvailable: page.hasMore,
    events,
  };
}

export function parseAuditFleetCsv(input) {
  const nNumbers = parseFleetCsv(input);
  if (nNumbers.length > MAX_HISTORY_AUDIT_AIRCRAFT) {
    throw new FleetInputError('History review is limited to 10 unique N-numbers per run');
  }
  return nNumbers;
}

export async function reviewOne(nNumber, { apiKey, fetchImpl = fetch }) {
  if (normalizeNNumber(nNumber) !== nNumber || !apiKey || typeof apiKey !== 'string') {
    throw new FleetInputError('Valid N-number and private API key required');
  }
  const params = '?versionsLimit=10&versionsOffset=0&eventsLimit=10&eventsOffset=0';
  let response;
  try {
    response = await fetchImpl(BASE + encodeURIComponent(nNumber) + '/history' + params, {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new HistoryAuditError('Network failed. Inspect connectivity; do not assume a completed request.');
  }
  if (response.status === 404) {
    return { nNumber, status: 'no_retained_history_found', eventCountShown: 0,
      totalObservedEventsReported: null, moreEventsAvailable: false, events: [] };
  }
  if (!response.ok) {
    throw new HistoryAuditError(
      response.status === 401 || response.status === 403
        ? 'Authentication or API-key scope failed'
        : response.status === 429
          ? 'API rate or quota limit reached; inspect usage before another attempt'
          : 'Aircraft API returned HTTP ' + response.status + '; review stopped',
    );
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new HistoryAuditError('Invalid JSON from Aircraft API');
  }
  return projectHistory(nNumber, payload);
}

export async function reviewFleetHistory(nNumbers, options = {}) {
  if (!Array.isArray(nNumbers) || nNumbers.length < 1
      || nNumbers.length > MAX_HISTORY_AUDIT_AIRCRAFT
      || new Set(nNumbers).size !== nNumbers.length
      || nNumbers.some(value => normalizeNNumber(value) !== value)) {
    throw new FleetInputError('Expected 1–10 distinct, canonical U.S. N-numbers');
  }
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const rows = [];
  for (const nNumber of nNumbers) {
    if (rows.length) await sleep(REQUEST_SPACING_MS);
    rows.push(await reviewOne(nNumber, options));
  }
  return {
    schemaVersion: 'aircraft-fleet-history-review-example-v1',
    interpretation: 'Observed FAA snapshot history, not legal ownership or transaction dates',
    eventsAreBounded: true,
    rows,
  };
}
