import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  AIRCRAFT_DISCOVERY_PAGE_SIZE,
  buildAircraftDiscoveryPath,
  buildAircraftLookupPath,
  buildDiscoveryPageUrl,
  normalizeAircraftDiscoveryCursor,
  normalizeAircraftDiscoveryFilters,
  normalizeAircraftNNumber,
  safeDiscoveryReturnUrl,
} from '../src/lib/aircraftContract';

const root = process.cwd();
const read = (relativePath: string): string =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

const contract = read('src/lib/aircraftContract.ts');
const apiClient = read('src/lib/aircraftApi.ts');
const lookupPage = read('app/lookup/page.tsx');
const discoveryPage = read('app/discover/page.tsx');
const homePage = read('app/page.tsx');
const readme = read('README.md');

test('exact N-number normalization matches the public integration contract', () => {
  assert.equal(normalizeAircraftNNumber(' n-123ab '), 'N123AB');
  assert.equal(normalizeAircraftNNumber('N1'), 'N1');
  assert.equal(normalizeAircraftNNumber('N99999'), 'N99999');
  assert.equal(normalizeAircraftNNumber('N0123'), null);
  assert.equal(normalizeAircraftNNumber('N123I'), null);
  assert.equal(normalizeAircraftNNumber('12345'), null);

  assert.equal(buildAircraftLookupPath('n-123ab'), '/aircraft/N123AB');
  assert.throws(() => buildAircraftLookupPath('invalid'), /valid U\.S\. N-number/);
});

test('discovery requires reviewed exact filters and normalizes them before requests', () => {
  assert.deepEqual(
    normalizeAircraftDiscoveryFilters({
      manufacturer: '  cessna ',
      model: ' 172n ',
      state: ' fl ',
    }),
    {
      manufacturer: 'CESSNA',
      model: '172N',
      state: 'FL',
    },
  );

  assert.throws(
    () => normalizeAircraftDiscoveryFilters({}),
    /At least one of manufacturer, model, or state is required/,
  );
  assert.throws(
    () => normalizeAircraftDiscoveryFilters({ state: 'Florida' }),
    /two-letter code/,
  );

  const filters = normalizeAircraftDiscoveryFilters({ manufacturer: 'cessna', state: 'fl' });
  const path = buildAircraftDiscoveryPath(filters);
  assert.equal(AIRCRAFT_DISCOVERY_PAGE_SIZE, 25);
  assert.match(path, /^\/aircraft\?/);
  assert.match(path, /manufacturer=CESSNA/);
  assert.match(path, /state=FL/);
  assert.match(path, /limit=25/);
  assert.doesNotMatch(path, /owner|sort|offset|total/i);
});

test('discovery cursors stay opaque and filter-bound in app navigation', () => {
  const cursor = 'opaque_CURSOR-123';
  assert.equal(normalizeAircraftDiscoveryCursor(cursor), cursor);
  assert.throws(() => normalizeAircraftDiscoveryCursor('bad cursor'), /cursor is invalid/);
  assert.doesNotMatch(contract, /Buffer\.from|base64url|JSON\.parse\([^\n]*cursor/i);

  const filters = normalizeAircraftDiscoveryFilters({ model: '172N', state: 'FL' });
  const apiPath = buildAircraftDiscoveryPath(filters, cursor);
  const pageUrl = buildDiscoveryPageUrl(filters, cursor);

  assert.match(apiPath, /model=172N/);
  assert.match(apiPath, /state=FL/);
  assert.match(apiPath, /cursor=opaque_CURSOR-123/);
  assert.match(pageUrl, /^\/discover\?/);
  assert.match(pageUrl, /cursor=opaque_CURSOR-123/);
});

test('return navigation accepts only the local discovery route', () => {
  assert.equal(
    safeDiscoveryReturnUrl('/discover?manufacturer=CESSNA&state=FL'),
    '/discover?manufacturer=CESSNA&state=FL',
  );
  assert.equal(safeDiscoveryReturnUrl('/lookup?nNumber=N1'), null);
  assert.equal(safeDiscoveryReturnUrl('//example.com/discover'), null);
  assert.equal(safeDiscoveryReturnUrl('https://example.com/discover'), null);
});

test('lookup and discovery execute through the server-only public API adapter', () => {
  assert.match(apiClient, /import 'server-only'/);
  assert.match(apiClient, /getAircraftByNNumber/);
  assert.match(apiClient, /searchAircraftRegistry/);
  assert.match(apiClient, /buildAircraftLookupPath/);
  assert.match(apiClient, /buildAircraftDiscoveryPath/);

  assert.match(lookupPage, /getAircraftByNNumber/);
  assert.match(discoveryPage, /searchAircraftRegistry/);
  assert.doesNotMatch(lookupPage, /api\.grizzlybulls\.com|Authorization|GRIZZLY_BULLS_API_KEY/);
  assert.doesNotMatch(discoveryPage, /api\.grizzlybulls\.com|Authorization|GRIZZLY_BULLS_API_KEY/);
  assert.doesNotMatch(lookupPage, /['"]use client['"]/);
  assert.doesNotMatch(discoveryPage, /['"]use client['"]/);
});

test('lookup presents current aircraft fields, provenance, and interpretation limits', () => {
  for (const label of [
    'Registration status code',
    'Manufacturer',
    'Model',
    'Manufacture year',
    'Airworthiness date',
    'Mode S / ICAO24 hex',
    'Mode S octal',
    'Retrieved at',
    'Source contract',
  ]) {
    assert.ok(lookupPage.includes(label), label);
  }

  assert.match(lookupPage, /not proof of[\s\S]*beneficial economic ownership/i);
  assert.match(lookupPage, /does not provide[\s\S]*reverse lookup/i);
  assert.match(lookupPage, /safeDiscoveryReturnUrl/);
});

test('discovery is bounded, links results to lookup, and exposes only next-cursor pagination', () => {
  for (const field of ['manufacturer', 'model', 'state']) {
    assert.match(discoveryPage, new RegExp(`name="${field}"`));
  }
  assert.match(discoveryPage, /At least one filter is required/);
  assert.match(discoveryPage, /opaque keyset pagination/);
  assert.match(discoveryPage, /results\.pagination\.nextCursor/);
  assert.match(discoveryPage, /pathname: '\/lookup'/);
  assert.match(discoveryPage, /from: currentPageUrl/);
  assert.doesNotMatch(discoveryPage, /previousCursor|pageNumber|totalCount|offset/);
  assert.doesNotMatch(discoveryPage, /name="owner"|name="registrant"|name="sort"/);
});

test('public copy advertises only implemented lookup and discovery surfaces', () => {
  for (const source of [homePage, readme]) {
    assert.match(source, /exact N-number|N-number lookup/i);
    assert.match(source, /manufacturer/);
    assert.match(source, /registrant state/);
    assert.match(source, /owner-name reverse search/i);
    assert.match(source, /Mode S|ICAO24/);
    assert.equal(source.includes(String.fromCharCode(0x2014)), false);
    assert.doesNotMatch(source, /\bAIR\d+[A-Z]*\b/);
  }

  assert.match(readme, /does not yet render that history as a timeline/);
  assert.match(readme, /does not decode cursors/);
});
