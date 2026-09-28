import 'server-only';

import { createHmac, randomBytes } from 'node:crypto';
import { headers } from 'next/headers';

import { createHostedDemoRateLimiter } from './hostedDemoLimiter';

const fingerprintKey = randomBytes(32);
const limiter = createHostedDemoRateLimiter();

const clientFingerprint = async (): Promise<string> => {
  const requestHeaders = await headers();
  const raw = (
    requestHeaders.get('x-real-ip')
    || requestHeaders.get('x-forwarded-for')?.split(',')[0]
    || 'unknown-client'
  ).trim().slice(0, 128);

  return createHmac('sha256', fingerprintKey).update(raw).digest('hex');
};

export const isHostedDemo = (): boolean => process.env.AIRCRAFT_DEMO_HOSTED === 'true';

export const enforceHostedDemoRequestLimit = async (): Promise<void> => {
  if (!isHostedDemo()) return;
  limiter(await clientFingerprint());
};
