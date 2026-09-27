import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (relativePath: string): string =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

const apiClient = read('src/lib/aircraftApi.ts');
const readme = read('README.md');
const agents = read('AGENTS.md');
const page = read('app/page.tsx');
const envExample = read('.env.example');
const pnpmWorkspace = read('pnpm-workspace.yaml');

test('generated Next TypeScript artifacts stay out of source control', () => {
  const gitignore = read('.gitignore');
  const packageJson = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };

  assert.match(gitignore, /^next-env\.d\.ts$/m);
  assert.match(gitignore, /^\*\.tsbuildinfo$/m);
  assert.equal(packageJson.scripts?.typecheck, 'next typegen && tsc --noEmit');
});

test('pnpm build scripts are explicitly allowlisted for a non-interactive install', () => {
  assert.match(pnpmWorkspace, /allowBuilds:/);
  for (const dependency of ['esbuild', 'sharp', 'unrs-resolver']) {
    assert.match(pnpmWorkspace, new RegExp('^  ' + dependency + ': true$', 'm'));
  }
  assert.doesNotMatch(pnpmWorkspace, /dangerouslyAllowAllBuilds|ignoreScripts/);
});

test('the reference app is pinned to the public versioned Aircraft API', () => {
  assert.match(apiClient, /https:\/\/api\.grizzlybulls\.com\/v1/);
  assert.match(apiClient, /Authorization/);
  assert.match(apiClient, /Bearer/);
  assert.match(apiClient, /cache: 'no-store'/);
  assert.match(apiClient, /Retry-After/);
  assert.match(apiClient, /body\?\.error\?\.code/);
  assert.match(apiClient, /body\?\.error\?\.message/);
});

test('the API key stays server-only', () => {
  assert.match(envExample, /^GRIZZLY_BULLS_API_KEY=$/m);
  assert.match(envExample, /^AIRCRAFT_DEMO_HOSTED=false$/m);
  assert.doesNotMatch(envExample, /NEXT_PUBLIC/);
  assert.match(apiClient, /import 'server-only'/);
  assert.match(apiClient, /process\.env\.GRIZZLY_BULLS_API_KEY/);

  for (const publicCopy of [readme, page]) {
    assert.doesNotMatch(publicCopy, /NEXT_PUBLIC_GRIZZLY_BULLS_API_KEY/);
  }
});

test('public scope keeps unsupported Aircraft capabilities out', () => {
  for (const source of [readme, agents, page]) {
    assert.match(source, /owner-name reverse search|owner-name|owner\s+search/i);
    assert.match(source, /Mode S|ICAO24/);
    assert.match(source, /observed/i);
  }

  assert.match(readme, /does not prove the exact date/i);
  assert.match(agents, /must not be presented as legal ownership periods/i);
  assert.match(agents, /Current FAA releasability and withholding rules/i);
});

test('public copy stays free of internal roadmap language', () => {
  for (const source of [readme, page]) {
    assert.doesNotMatch(source, /\bAIR\d+[A-Z]*\b/);
    assert.doesNotMatch(source, /phase|roadmap frontier|ratchet/i);
  }
});
