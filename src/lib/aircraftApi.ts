import 'server-only';

import { enforceHostedDemoRequestLimit } from './hostedDemo';

import {
  buildAircraftChangesPath,
  buildAircraftDiscoveryPath,
  buildAircraftHistoryPath,
  buildAircraftIcao24Path,
  buildAircraftLookupPath,
  buildAircraftStatusPath,
  normalizeAircraftDiscoveryCursor,
  normalizeAircraftDiscoveryFilters,
  type AircraftChangeFeedResponse,
  type AircraftCurrentResponse,
  type AircraftDiscoveryInput,
  type AircraftDiscoveryResponse,
  type AircraftHistoryOffsets,
  type AircraftHistoryResponse,
  type AircraftNNumberStatusResponse,
} from './aircraftContract';

export const AIRCRAFT_API_BASE_URL = 'https://api.grizzlybulls.com/v1';

type AircraftApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class AircraftApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly retryAfter: string | null;

  constructor(options: {
    message: string;
    status: number;
    code?: string | null;
    retryAfter?: string | null;
  }) {
    super(options.message);
    this.name = 'AircraftApiError';
    this.status = options.status;
    this.code = options.code ?? null;
    this.retryAfter = options.retryAfter ?? null;
  }
}

const getApiKey = (): string => {
  const apiKey = process.env.GRIZZLY_BULLS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'GRIZZLY_BULLS_API_KEY is required. Copy .env.example to .env.local and add your API key.',
    );
  }
  return apiKey;
};

export const aircraftApiRequest = async <T>(
  path: `/${string}`,
  init: RequestInit = {},
): Promise<T> => {
  await enforceHostedDemoRequestLimit();

  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('Authorization', `Bearer ${getApiKey()}`);

  const response = await fetch(`${AIRCRAFT_API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    let body: AircraftApiErrorBody | null = null;
    try {
      body = await response.json() as AircraftApiErrorBody;
    } catch {
      body = null;
    }

    throw new AircraftApiError({
      message: body?.error?.message || `Aircraft API request failed with status ${response.status}.`,
      status: response.status,
      code: body?.error?.code ?? null,
      retryAfter: response.headers.get('Retry-After'),
    });
  }

  return response.json() as Promise<T>;
};

export const getAircraftByNNumber = async (nNumber: string): Promise<AircraftCurrentResponse> => (
  aircraftApiRequest<AircraftCurrentResponse>(buildAircraftLookupPath(nNumber) as `/${string}`)
);

export const getAircraftByIcao24 = async (hex: string): Promise<AircraftCurrentResponse> => (
  aircraftApiRequest<AircraftCurrentResponse>(buildAircraftIcao24Path(hex) as `/${string}`)
);

export const getAircraftNNumberStatus = async (
  nNumber: string,
): Promise<AircraftNNumberStatusResponse> => (
  aircraftApiRequest<AircraftNNumberStatusResponse>(
    buildAircraftStatusPath(nNumber) as `/${string}`,
  )
);

export const getRecentAircraftChanges = async (
  since: string,
  until: string,
): Promise<AircraftChangeFeedResponse> => (
  aircraftApiRequest<AircraftChangeFeedResponse>(
    buildAircraftChangesPath(since, until) as `/${string}`,
  )
);

export const searchAircraftRegistry = async (
  input: AircraftDiscoveryInput,
  cursorInput?: string,
): Promise<{
  filters: ReturnType<typeof normalizeAircraftDiscoveryFilters>;
  response: AircraftDiscoveryResponse;
}> => {
  const filters = normalizeAircraftDiscoveryFilters(input);
  const cursor = normalizeAircraftDiscoveryCursor(cursorInput);
  const path = buildAircraftDiscoveryPath(filters, cursor);
  const response = await aircraftApiRequest<AircraftDiscoveryResponse>(path as `/${string}`);
  return { filters, response };
};


export const getAircraftHistory = async (
  nNumber: string,
  offsets: AircraftHistoryOffsets,
): Promise<AircraftHistoryResponse> => (
  aircraftApiRequest<AircraftHistoryResponse>(
    buildAircraftHistoryPath(nNumber, offsets) as `/${string}`,
  )
);
