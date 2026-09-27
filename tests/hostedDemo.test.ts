import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  HOSTED_DEMO_GLOBAL_REQUESTS_PER_MINUTE,
  HOSTED_DEMO_PER_CLIENT_REQUESTS_PER_MINUTE,
  HostedDemoRateLimitError,
  createHostedDemoRateLimiter,
} from '../src/lib/hostedDemoLimiter';

const root = process.cwd();
const read = (relativePath: string): string => fs.readFileSync(path.join(root, relativePath), 'utf8');

const wrapper = read('src/lib/hostedDemo.ts');
const apiClient = read('src/lib/aircraftApi.ts');
const health = read('app/api/health/route.ts');
const home = read('app/page.tsx');
const layout = read('app/layout.tsx');
const dockerfile = read('Dockerfile');
const dockerignore = read('.dockerignore');
const readme = read('README.md');
const agents = read('AGENTS.md');

test('hosted demo rate limiter enforces per-client and global ceilings independently', () => {
  let now = 1_000_000;
  const limiter = createHostedDemoRateLimiter({
    perClientLimit: 2,
    globalLimit: 3,
    now: () => now,
  });

  limiter('client-a');
  limiter('client-a');
  assert.throws(
    () => limiter('client-a'),
    error => error instanceof HostedDemoRateLimitError && error.retryAfterSeconds > 0,
  );

  limiter('client-b');
  assert.throws(
    () => limiter('client-c'),
    error => error instanceof HostedDemoRateLimitError && error.retryAfterSeconds > 0,
  );

  now += 60_000;
  assert.doesNotThrow(() => limiter('client-a'));
});

test('hosted demo limits stay materially below the machine API safety ceiling', () => {
  assert.equal(HOSTED_DEMO_PER_CLIENT_REQUESTS_PER_MINUTE, 30);
  assert.equal(HOSTED_DEMO_GLOBAL_REQUESTS_PER_MINUTE, 300);
  assert.ok(HOSTED_DEMO_PER_CLIENT_REQUESTS_PER_MINUTE < HOSTED_DEMO_GLOBAL_REQUESTS_PER_MINUTE);
  assert.ok(HOSTED_DEMO_GLOBAL_REQUESTS_PER_MINUTE < 1_200);
});

test('hosted mode fingerprints trusted proxy address headers in memory before API transport', () => {
  assert.match(wrapper, /import 'server-only'/);
  assert.match(wrapper, /x-real-ip/);
  assert.match(wrapper, /x-forwarded-for/);
  assert.match(wrapper, /createHmac\('sha256', fingerprintKey\)/);
  assert.match(wrapper, /randomBytes\(32\)/);
  assert.doesNotMatch(wrapper, /console\.|writeFile|localStorage|cookie/i);

  assert.match(apiClient, /await enforceHostedDemoRequestLimit\(\)/);
  const limiterCall = apiClient.indexOf('await enforceHostedDemoRequestLimit()');
  const fetchCall = apiClient.indexOf('await fetch(');
  assert.ok(limiterCall >= 0 && fetchCall > limiterCall);
});

test('hosted health is dynamic, no-store, and does not expose the API key', () => {
  assert.match(health, /dynamic = 'force-dynamic'/);
  assert.match(health, /hostedDemo: isHostedDemo\(\)/);
  assert.match(health, /Cache-Control': 'no-store'/);
  assert.doesNotMatch(health, /GRIZZLY_BULLS_API_KEY|Authorization|Bearer/);
});

test('homepage provides one-click real API examples without inventing new scope', () => {
  assert.match(home, /\/lookup\?nNumber=N172SP/);
  assert.match(home, /\/discover\?state=FL/);
  assert.match(home, /\/history\?nNumber=N172SP/);
  assert.match(home, /No API key is sent[\s\S]*browser/);
  assert.doesNotMatch(home, /owner search|Mode S reverse|global registry|flight tracking/i);
});

test('hosted reference app stays out of the search index while allowing followed links', () => {
  assert.match(layout, /robots:/);
  assert.match(layout, /index: false/);
  assert.match(layout, /follow: true/);
});

test('standalone container keeps the hosted app unprivileged and excludes secrets from build context', () => {
  assert.match(dockerfile, /FROM node:24-alpine/);
  assert.match(dockerfile, /pnpm install --frozen-lockfile/);
  assert.match(dockerfile, /pnpm build/);
  assert.match(dockerfile, /\.next\/standalone/);
  assert.match(dockerfile, /USER nextjs/);
  assert.match(dockerfile, /CMD \["node", "server\.js"\]/);

  assert.match(dockerignore, /^\.env$/m);
  assert.match(dockerignore, /^\.env\.\*$/m);
  assert.match(dockerignore, /^node_modules$/m);
  assert.match(dockerignore, /^\.git$/m);
});

test('public copy explains the hosted demo without exposing internal project language', () => {
  assert.match(readme, /Try the live demo/);
  assert.match(readme, /https:\/\/aircraft-demo\.grizzlybulls\.com/);
  assert.match(readme, /dedicated first-party server credential/);
  assert.match(readme, /per-client and global abuse limits/);
  assert.match(readme, /does not consume a customer monthly quota/);

  assert.match(agents, /dedicated first-party demo credential/);
  assert.match(agents, /AIRCRAFT_DEMO_HOSTED=true/);
  for (const source of [readme, home]) {
    assert.doesNotMatch(source, /\bAIR\d+[A-Z]*\b/);
  }
});
