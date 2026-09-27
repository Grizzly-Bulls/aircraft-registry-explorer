export const HOSTED_DEMO_PER_CLIENT_REQUESTS_PER_MINUTE = 30;
export const HOSTED_DEMO_GLOBAL_REQUESTS_PER_MINUTE = 300;

const WINDOW_MS = 60_000;
const MAX_TRACKED_CLIENTS = 5_000;

type Counter = {
  windowStart: number;
  count: number;
  lastSeen: number;
};

export class HostedDemoRateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(`The live demo is receiving a lot of traffic. Try again in about ${retryAfterSeconds} seconds.`);
    this.name = 'HostedDemoRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export const createHostedDemoRateLimiter = ({
  perClientLimit = HOSTED_DEMO_PER_CLIENT_REQUESTS_PER_MINUTE,
  globalLimit = HOSTED_DEMO_GLOBAL_REQUESTS_PER_MINUTE,
  now = () => Date.now(),
}: {
  perClientLimit?: number;
  globalLimit?: number;
  now?: () => number;
} = {}) => {
  let global: Counter = { windowStart: now(), count: 0, lastSeen: now() };
  const clients = new Map<string, Counter>();

  const resetIfExpired = (counter: Counter, at: number): Counter => (
    at - counter.windowStart >= WINDOW_MS
      ? { windowStart: at, count: 0, lastSeen: at }
      : counter
  );

  const retryAfter = (counter: Counter, at: number): number => (
    Math.max(1, Math.ceil((counter.windowStart + WINDOW_MS - at) / 1000))
  );

  const prune = (at: number): void => {
    if (clients.size < MAX_TRACKED_CLIENTS) return;
    for (const [key, counter] of clients) {
      if (at - counter.lastSeen >= WINDOW_MS * 2) clients.delete(key);
    }
  };

  return (clientId: string): void => {
    const at = now();
    global = resetIfExpired(global, at);
    if (global.count >= globalLimit) {
      throw new HostedDemoRateLimitError(retryAfter(global, at));
    }

    prune(at);
    const key = clients.has(clientId) || clients.size < MAX_TRACKED_CLIENTS
      ? clientId
      : '__overflow__';
    const current = resetIfExpired(
      clients.get(key) || { windowStart: at, count: 0, lastSeen: at },
      at,
    );
    if (current.count >= perClientLimit) {
      throw new HostedDemoRateLimitError(retryAfter(current, at));
    }

    global.count += 1;
    global.lastSeen = at;
    current.count += 1;
    current.lastSeen = at;
    clients.set(key, current);
  };
};
