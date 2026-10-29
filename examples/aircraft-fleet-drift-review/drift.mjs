/**
 * Review source-observed drift for a small customer-supplied fleet.
 * Reuses only the public exact N-number and bounded history sample APIs.
 * No FAA bulk files, owner information, automatic master-data writes or
 * inferred legal transfers / N-number reassignment.
 */
import {
  FleetInputError, FleetApiError, lookupOne, normalizeNNumber, REQUEST_SPACING_MS,
} from '../aircraft-fleet-onboarding/fleet.mjs';
import { HistoryAuditError, reviewOne } from '../aircraft-fleet-history-review/history.mjs';

export { FleetInputError, FleetApiError, HistoryAuditError };
export const MAX_DRIFT_AIRCRAFT = 10;
const HEAD = 'nNumber,manufacturer,model,serialNumber';
const FIELDS = ['manufacturer', 'model', 'serialNumber'];

function localField(value) {
  const trimmed = value.trim();
  if (trimmed.length > 100 || !/^[A-Za-z0-9 ._&()\/+\-']*$/.test(trimmed)) {
    throw new FleetInputError('Invalid local aircraft identity field');
  }
  return trimmed || null;
}

export function parseInventoryCsv(contents) {
  if (typeof contents !== 'string' || contents.length > 16_384 || contents.includes('\0')) {
    throw new FleetInputError('Invalid or oversized inventory CSV');
  }
  const lines = contents.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines.shift()?.trim() !== HEAD) {
    throw new FleetInputError('Expected exact header nNumber,manufacturer,model,serialNumber');
  }
  const seen = new Set();
  const records = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    if (/[\r"]/.test(line)) throw new FleetInputError('Quoted/multiline CSV is not supported');
    const cells = line.split(',');
    if (cells.length !== 4) throw new FleetInputError('Expected four unquoted fields per aircraft');
    const nNumber = normalizeNNumber(cells[0]);
    if (seen.has(nNumber)) throw new FleetInputError('Duplicate N-number in local inventory');
    seen.add(nNumber);
    records.push({
      nNumber,
      manufacturer: localField(cells[1]),
      model: localField(cells[2]),
      serialNumber: localField(cells[3]),
    });
    if (records.length > MAX_DRIFT_AIRCRAFT) {
      throw new FleetInputError('Inventory review is limited to ten known aircraft');
    }
  }
  if (!records.length) throw new FleetInputError('Inventory must include an aircraft');
  return records;
}

function compareIdentity(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim().replace(/\s+/g, ' ').toUpperCase()
    : null;
}

export function assessRecord(local, current, history) {
  if (!local || !current || !history || local.nNumber !== current.nNumber
      || local.nNumber !== history.nNumber) {
    throw new FleetInputError('Cannot reconcile inconsistent aircraft identifiers');
  }
  const currentFound = current.status === 'current_registration_found';
  if (!currentFound && current.status !== 'no_current_registration_found') {
    throw new FleetInputError('Unexpected current lookup status');
  }
  const conflictingFields = [];
  const unverifiedFields = [];
  if (currentFound) {
    for (const field of FIELDS) {
      const left = compareIdentity(local[field]);
      const right = compareIdentity(current[field]);
      if (!left || !right) unverifiedFields.push(field);
      else if (left !== right) conflictingFields.push(field);
    }
  }
  const outcome = !currentFound ? 'no_current_registration_found'
    : conflictingFields.length ? 'identity_conflict_needs_review'
      : unverifiedFields.length ? 'identity_incomplete_needs_review'
        : 'matches_current_observation';
  return {
    nNumber: local.nNumber,
    outcome,
    localIdentity: Object.fromEntries(FIELDS.map(f => [f, local[f]])),
    observedIdentity: currentFound
      ? Object.fromEntries(FIELDS.map(f => [f, current[f]]))
      : null,
    sourceRetrievedAt: currentFound ? current.sourceRetrievedAt : null,
    conflictingFields,
    unverifiedFields,
    observedEventSample: {
      status: history.status,
      eventCountShown: history.eventCountShown,
      totalObservedEventsReported: history.totalObservedEventsReported,
      moreEventsAvailable: history.moreEventsAvailable,
      events: history.events,
    },
    requiresManualReview: outcome !== 'matches_current_observation',
  };
}

export async function reviewFleetDrift(inventory, {
  apiKey, fetchImpl = fetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
} = {}) {
  if (!Array.isArray(inventory) || inventory.length < 1 || inventory.length > MAX_DRIFT_AIRCRAFT) {
    throw new FleetInputError('Expected 1–10 known inventory records');
  }
  // Validate every record before the first metered request.
  const normalized = parseInventoryCsv(HEAD + '\n' + inventory.map(r => [
    r.nNumber, r.manufacturer ?? '', r.model ?? '', r.serialNumber ?? '',
  ].join(',')).join('\n'));
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new FleetInputError('Set GRIZZLY_BULLS_API_KEY privately before --live');
  }
  const rows = [];
  for (const local of normalized) {
    if (rows.length) await sleep(REQUEST_SPACING_MS);
    const current = await lookupOne(local.nNumber, { apiKey, fetchImpl, sleep });
    await sleep(REQUEST_SPACING_MS);
    const history = await reviewOne(local.nNumber, { apiKey, fetchImpl });
    rows.push(assessRecord(local, current, history));
  }
  return {
    schemaVersion: 'aircraft-known-fleet-drift-review-v1',
    interpretation: 'Observed public FAA data only; no legal title, airworthiness, confirmed N-number reuse or automatic fleet update',
    observationCoverage: 'At most ten recent history events per N-number; not complete historical coverage',
    requestCount: normalized.length * 2,
    rows,
  };
}
