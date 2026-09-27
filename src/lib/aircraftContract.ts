export const AIRCRAFT_N_NUMBER_PATTERN =
  /^N(?:[1-9][0-9]{0,4}|[1-9][0-9]{0,3}[A-HJ-NP-Z]|[1-9][0-9]{0,2}[A-HJ-NP-Z]{2})$/;

export const AIRCRAFT_DISCOVERY_MAX_FILTER_LENGTH = 100;
export const AIRCRAFT_DISCOVERY_MAX_CURSOR_LENGTH = 1024;
export const AIRCRAFT_DISCOVERY_PAGE_SIZE = 25;

export type AircraftDiscoveryFilters = {
  manufacturer: string | null;
  model: string | null;
  state: string | null;
};

export type AircraftDiscoveryInput = {
  manufacturer?: string;
  model?: string;
  state?: string;
};

export type AircraftPublicSourceSnapshot = {
  provider: 'faa-releasable-aircraft-registry';
  sourceContractVersion: string;
  sourceUrl: string;
  retrievedAt: string;
  archiveSha256: string;
};

export type AircraftPublicRegistration = {
  nNumber: string;
  sourceStatusCode: string | null;
  certificateIssueDate: string | null;
  expirationDate: string | null;
  lastActivityDate: string | null;
  fractionalOwnership: boolean | null;
};

export type AircraftPublicEngine = {
  manufacturer: string | null;
  model: string | null;
  sourceTypeCode: string | null;
  horsepower: number | null;
  thrust: number | null;
};

export type AircraftPublicCurrentRecord = {
  contractVersion: 'aircraft-public-v1';
  aircraftId: string | null;
  registration: AircraftPublicRegistration;
  aircraft: {
    serialNumber: string | null;
    manufactureYear: number | null;
    manufacturer: string | null;
    model: string | null;
    sourceAircraftTypeCode: string | null;
    sourceEngineTypeCode: string | null;
    sourceCategoryCode: string | null;
    sourceWeightClassCode: string | null;
    engineCount: number | null;
    seatCount: number | null;
    airworthinessDate: string | null;
    modeSCodeOctal: string | null;
    modeSCodeHex: string | null;
    typeCertificateDataSheet: string | null;
    typeCertificateHolder: string | null;
    engine: AircraftPublicEngine;
  };
  registrant: {
    sourceTypeCode: string | null;
    name: string | null;
    street1: string | null;
    street2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    countyCode: string | null;
    countryCode: string | null;
    otherNames: readonly string[];
  };
  source: AircraftPublicSourceSnapshot;
  history: {
    firstObservedAt: string;
    lastObservedAt: string;
    versionCount: number;
    eventCount: number;
  };
};

export type AircraftPublicDiscoveryRecord = {
  contractVersion: 'aircraft-discovery-v1';
  aircraftId: string | null;
  nNumber: string;
  sourceRegistrationStatusCode: string | null;
  manufactureYear: number | null;
  manufacturer: string | null;
  model: string | null;
  registrantState: string | null;
};

export type AircraftCurrentResponse = {
  data: AircraftPublicCurrentRecord;
};

export type AircraftDiscoveryResponse = {
  data: readonly AircraftPublicDiscoveryRecord[];
  pagination: {
    limit: number;
    nextCursor: string | null;
  };
};


export const AIRCRAFT_HISTORY_PAGE_SIZE = 10;
export const AIRCRAFT_HISTORY_MAX_OFFSET = 10_000;

export const AIRCRAFT_HISTORY_EVENT_TYPES = [
  'registration_added',
  'registration_removed',
  'registration_record_changed',
  'aircraft_assignment_changed',
  'status_changed',
  'registrant_changed',
  'registrant_pii_withheld',
  'registrant_pii_released',
] as const;

export type AircraftHistoryEventType = (typeof AIRCRAFT_HISTORY_EVENT_TYPES)[number];

export type AircraftHistoryChangedField =
  | 'aircraft_assignment'
  | 'registration_identifier'
  | 'aircraft_model'
  | 'engine_model'
  | 'manufacture_year'
  | 'aircraft_type'
  | 'engine_type'
  | 'registration_status'
  | 'mode_s_code'
  | 'certificate_issue_date'
  | 'expiration_date'
  | 'last_activity_date'
  | 'airworthiness_date'
  | 'fractional_ownership'
  | 'registrant_type';

export type AircraftObservationBoundary = {
  retrievedAt: string;
  sourceContractVersion: string;
  sourceUrl: string;
  archiveSha256: string;
};

export type AircraftHistoryVersion = {
  contractVersion: 'aircraft-public-v1';
  aircraftId: string | null;
  registration: AircraftPublicRegistration;
  aircraft: {
    serialNumber: string | null;
    manufactureYear: number | null;
    sourceAircraftTypeCode: string | null;
    sourceEngineTypeCode: string | null;
    airworthinessDate: string | null;
    modeSCodeOctal: string | null;
    modeSCodeHex: string | null;
  };
  registrant: AircraftPublicCurrentRecord['registrant'];
  sourceProvider: 'faa-releasable-aircraft-registry';
  observedFrom: AircraftObservationBoundary;
  observedThrough: AircraftObservationBoundary;
};

export type AircraftHistoryEvent = {
  contractVersion: 'aircraft-public-v1';
  aircraftId: string | null;
  previousAircraftId: string | null;
  nNumber: string;
  eventType: AircraftHistoryEventType;
  oldSourceRegistrationStatusCode: string | null;
  newSourceRegistrationStatusCode: string | null;
  changedFields: readonly AircraftHistoryChangedField[];
  sourceEffectiveDate: string | null;
  observedAt: string;
  previousObservedAt: string | null;
  source: AircraftPublicSourceSnapshot;
};

export type AircraftHistoryPageMeta = {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
};

export type AircraftHistoryResponse = {
  data: {
    nNumber: string;
    versions: readonly AircraftHistoryVersion[];
    events: readonly AircraftHistoryEvent[];
  };
  pagination: {
    versions: AircraftHistoryPageMeta;
    events: AircraftHistoryPageMeta;
  };
};

export type AircraftHistoryOffsets = {
  versionsOffset: number;
  eventsOffset: number;
};

const normalizeTextFilter = (
  value: string | undefined,
  name: 'manufacturer' | 'model',
): string | null => {
  if (value === undefined) return null;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  if (normalized.length > AIRCRAFT_DISCOVERY_MAX_FILTER_LENGTH) {
    throw new Error(`${name} must be at most ${AIRCRAFT_DISCOVERY_MAX_FILTER_LENGTH} characters.`);
  }
  if (/[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new Error(`${name} contains unsupported control characters.`);
  }
  return normalized;
};

export const normalizeAircraftNNumber = (value: string): string | null => {
  const normalized = value.trim().toUpperCase().replace(/^N-/, 'N');
  return AIRCRAFT_N_NUMBER_PATTERN.test(normalized) ? normalized : null;
};

export const normalizeAircraftDiscoveryFilters = (
  input: AircraftDiscoveryInput,
): AircraftDiscoveryFilters => {
  const manufacturer = normalizeTextFilter(input.manufacturer, 'manufacturer');
  const model = normalizeTextFilter(input.model, 'model');

  let state: string | null = null;
  if (input.state !== undefined && input.state.trim()) {
    const normalizedState = input.state.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(normalizedState)) {
      throw new Error('state must be a two-letter code.');
    }
    state = normalizedState;
  }

  if (!manufacturer && !model && !state) {
    throw new Error('At least one of manufacturer, model, or state is required.');
  }

  return { manufacturer, model, state };
};

export const normalizeAircraftDiscoveryCursor = (
  cursor: string | undefined,
): string | null => {
  if (cursor === undefined || cursor === '') return null;
  if (
    cursor.length > AIRCRAFT_DISCOVERY_MAX_CURSOR_LENGTH
    || !/^[A-Za-z0-9_-]+$/.test(cursor)
  ) {
    throw new Error('cursor is invalid.');
  }
  return cursor;
};

export const buildAircraftLookupPath = (nNumber: string): string => {
  const normalized = normalizeAircraftNNumber(nNumber);
  if (!normalized) throw new Error('A valid U.S. N-number is required.');
  return `/aircraft/${encodeURIComponent(normalized)}`;
};

export const buildAircraftDiscoveryPath = (
  filters: AircraftDiscoveryFilters,
  cursor: string | null = null,
): string => {
  const params = new URLSearchParams();
  if (filters.manufacturer) params.set('manufacturer', filters.manufacturer);
  if (filters.model) params.set('model', filters.model);
  if (filters.state) params.set('state', filters.state);
  params.set('limit', String(AIRCRAFT_DISCOVERY_PAGE_SIZE));
  if (cursor) params.set('cursor', cursor);
  return `/aircraft?${params.toString()}`;
};

export const buildDiscoveryPageUrl = (
  filters: AircraftDiscoveryFilters,
  cursor: string | null = null,
): string => {
  const params = new URLSearchParams();
  if (filters.manufacturer) params.set('manufacturer', filters.manufacturer);
  if (filters.model) params.set('model', filters.model);
  if (filters.state) params.set('state', filters.state);
  if (cursor) params.set('cursor', cursor);
  const query = params.toString();
  return query ? `/discover?${query}` : '/discover';
};

export const safeDiscoveryReturnUrl = (value: string | undefined): string | null => {
  if (!value || !value.startsWith('/')) return null;
  try {
    const base = new URL('https://aircraft-registry-explorer.invalid');
    const candidate = new URL(value, base);
    if (candidate.origin !== base.origin || candidate.pathname !== '/discover') return null;
    return `${candidate.pathname}${candidate.search}`;
  } catch {
    return null;
  }
};


export const normalizeAircraftHistoryOffset = (
  value: string | undefined,
  name: 'versionsOffset' | 'eventsOffset',
): number => {
  if (value === undefined || value === '') return 0;
  if (!/^[0-9]+$/.test(value)) throw new Error(`${name} must be a non-negative integer.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > AIRCRAFT_HISTORY_MAX_OFFSET) {
    throw new Error(`${name} must be between 0 and ${AIRCRAFT_HISTORY_MAX_OFFSET}.`);
  }
  return parsed;
};

export const buildAircraftHistoryPath = (
  nNumber: string,
  offsets: AircraftHistoryOffsets,
): string => {
  const normalized = normalizeAircraftNNumber(nNumber);
  if (!normalized) throw new Error('A valid U.S. N-number is required.');
  const params = new URLSearchParams({
    versionsLimit: String(AIRCRAFT_HISTORY_PAGE_SIZE),
    versionsOffset: String(offsets.versionsOffset),
    eventsLimit: String(AIRCRAFT_HISTORY_PAGE_SIZE),
    eventsOffset: String(offsets.eventsOffset),
  });
  return `/aircraft/${encodeURIComponent(normalized)}/history?${params.toString()}`;
};

export const buildHistoryPageUrl = (
  nNumber: string,
  offsets: AircraftHistoryOffsets,
): string => {
  const normalized = normalizeAircraftNNumber(nNumber);
  if (!normalized) throw new Error('A valid U.S. N-number is required.');
  const params = new URLSearchParams({ nNumber: normalized });
  if (offsets.versionsOffset > 0) params.set('versionsOffset', String(offsets.versionsOffset));
  if (offsets.eventsOffset > 0) params.set('eventsOffset', String(offsets.eventsOffset));
  return `/history?${params.toString()}`;
};

export const labelAircraftHistoryEvent = (eventType: AircraftHistoryEventType): string => ({
  registration_added: 'Registration added',
  registration_removed: 'Registration removed',
  registration_record_changed: 'Registration record changed',
  aircraft_assignment_changed: 'Aircraft assignment changed',
  status_changed: 'Registration status changed',
  registrant_changed: 'Registrant record changed',
  registrant_pii_withheld: 'Registrant information withheld',
  registrant_pii_released: 'Registrant information released',
})[eventType];
