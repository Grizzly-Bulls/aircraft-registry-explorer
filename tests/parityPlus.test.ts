import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  buildAircraftChangesPath,
  buildAircraftIcao24Path,
  buildAircraftStatusPath,
  normalizeAircraftIcao24,
} from '../src/lib/aircraftContract';

const root = process.cwd();
const read = (relativePath: string): string =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

const apiClient = read('src/lib/aircraftApi.ts');
const home = read('app/page.tsx');
const icao = read('app/icao24/page.tsx');
const status = read('app/status/page.tsx');
const changes = read('app/changes/page.tsx');
const readme = read('README.md');
const agents = read('AGENTS.md');

test('exact ICAO24 normalization and path building remain bounded', () => {
  assert.equal(normalizeAircraftIcao24(' a12239 '), 'A12239');
  assert.equal(normalizeAircraftIcao24('ABCDEF'), 'ABCDEF');
  assert.equal(normalizeAircraftIcao24('0xA12239'), null);
  assert.equal(normalizeAircraftIcao24('A1223'), null);
  assert.equal(normalizeAircraftIcao24('A1223G'), null);
  assert.equal(buildAircraftIcao24Path('a12239'), '/aircraft/icao24/A12239');
  assert.throws(() => buildAircraftIcao24Path('bad'), /six hexadecimal digits/);
});

test('lifecycle and change paths preserve reviewed public bounds', () => {
  assert.equal(buildAircraftStatusPath('n-172sp'), '/aircraft/n-number/N172SP/status');
  const pathValue = buildAircraftChangesPath(
    '2026-09-29T00:00:00.000Z',
    '2026-09-30T00:00:00.000Z',
  );
  assert.match(pathValue, /^\/aircraft\/changes\?/);
  assert.match(pathValue, /limit=20/);
  assert.throws(
    () => buildAircraftChangesPath(
      '2026-09-20T00:00:00.000Z',
      '2026-09-30T00:00:00.000Z',
    ),
    /must not exceed seven days/,
  );
});

test('parity-plus demo requests stay on the server-only public API adapter', () => {
  for (const method of [
    'getAircraftByIcao24',
    'getAircraftNNumberStatus',
    'getRecentAircraftChanges',
  ]) {
    assert.match(apiClient, new RegExp(method));
  }
  for (const page of [icao, status, changes]) {
    assert.doesNotMatch(page, /['"]use client['"]/);
    assert.doesNotMatch(page, /api\.grizzlybulls\.com|Authorization|GRIZZLY_BULLS_API_KEY/);
  }
  assert.match(apiClient, /enforceHostedDemoRequestLimit/);
});

test('lifecycle demo keeps unknown separate from availability and reservation PII', () => {
  assert.match(status, /Unknown does not mean available/);
  assert.match(status, /availability: not_determined/);
  assert.match(status, /Reservation context deliberately excludes reserving-party names and addresses/);
  assert.doesNotMatch(status, /reserved\.registrant|reserved\.name|reserved\.street/);
});

test('recent changes demo keeps observation semantics and privacy-safe diffs', () => {
  assert.match(changes, /Observation time is not transaction time/);
  assert.match(changes, /do not mean “sold,” “ownership transferred,”/);
  assert.match(changes, /Sensitive historical registrant values are not reconstructed/);
  assert.match(changes, /displayDiffValue/);
  assert.match(changes, /Withheld \/ unavailable/);
  assert.doesNotMatch(changes, /registrant\.name|street1|street2|postalCode|otherNames/);
});

test('home and public guidance expose the four required hands-on proof jobs', () => {
  for (const route of ['/lookup', '/icao24', '/status', '/changes']) {
    assert.ok(home.includes(route), route);
    assert.ok(readme.includes(route), route);
  }
  assert.match(agents, /exact six-digit ICAO24 \/ Mode S lookup/);
  assert.match(agents, /N-number lifecycle status/);
  assert.match(agents, /bounded recent observed changes/);
  for (const source of [home, readme]) {
    assert.doesNotMatch(source, /\bAIR\d+[A-Z]*\b/);
  }
});
