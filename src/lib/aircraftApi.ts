import 'server-only';

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
