import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  AIRCRAFT_HISTORY_EVENT_TYPES,
  AIRCRAFT_HISTORY_PAGE_SIZE,
  buildAircraftHistoryPath,
  buildHistoryPageUrl,
  labelAircraftHistoryEvent,
  normalizeAircraftHistoryOffset,
} from '../src/lib/aircraftContract';

const root = process.cwd();
const read = (relativePath: string): string =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

const contract = read('src/lib/aircraftContract.ts');
const apiClient = read('src/lib/aircraftApi.ts');
const historyPage = read('app/history/page.tsx');
const lookupPage = read('app/lookup/page.tsx');
const readme = read('README.md');
const agents = read('AGENTS.md');

test('history requests use bounded independent versions and events pagination', () => {
  assert.equal(AIRCRAFT_HISTORY_PAGE_SIZE, 10);
  assert.equal(normalizeAircraftHistoryOffset(undefined, 'versionsOffset'), 0);
  assert.equal(normalizeAircraftHistoryOffset('20', 'eventsOffset'), 20);
  assert.throws(
    () => normalizeAircraftHistoryOffset('-1', 'versionsOffset'),
    /non-negative integer/,
  );
  assert.throws(
    () => normalizeAircraftHistoryOffset('10001', 'eventsOffset'),
    /between 0 and 10000/,
  );

  const path = buildAircraftHistoryPath('n-123ab', {
    versionsOffset: 20,
    eventsOffset: 40,
  });
  assert.match(path, /^\/aircraft\/N123AB\/history\?/);
  assert.match(path, /versionsLimit=10/);
  assert.match(path, /versionsOffset=20/);
  assert.match(path, /eventsLimit=10/);
  assert.match(path, /eventsOffset=40/);
});

test('history page URLs preserve independent list offsets', () => {
  assert.equal(
    buildHistoryPageUrl('N123AB', { versionsOffset: 20, eventsOffset: 40 }),
    '/history?nNumber=N123AB&versionsOffset=20&eventsOffset=40',
  );
  assert.equal(
    buildHistoryPageUrl('N123AB', { versionsOffset: 0, eventsOffset: 40 }),
    '/history?nNumber=N123AB&eventsOffset=40',
  );

  assert.match(historyPage, /dimension === 'versions' \? 'versionsOffset' : 'eventsOffset'/);
  assert.match(historyPage, /const previousOffsets = \{ \.\.\.offsets, \[offsetKey\]: previousOffset \}/);
  assert.match(historyPage, /const nextOffsets = \{ \.\.\.offsets, \[offsetKey\]: nextOffset \}/);
  assert.doesNotMatch(historyPage, /combinedOffset|timelineOffset|pageNumber/);
});

test('history transport remains server-only and uses the public history endpoint', () => {
  assert.match(apiClient, /getAircraftHistory/);
  assert.match(apiClient, /buildAircraftHistoryPath/);
  assert.match(apiClient, /import 'server-only'/);
  assert.match(contract, /\/history\?/);

  assert.match(historyPage, /getAircraftHistory/);
  assert.doesNotMatch(historyPage, /['"]use client['"]/);
  assert.doesNotMatch(historyPage, /api\.grizzlybulls\.com|Authorization|GRIZZLY_BULLS_API_KEY/);
});

test('history event vocabulary stays aligned with the reviewed PII-free contract', () => {
  assert.deepEqual(AIRCRAFT_HISTORY_EVENT_TYPES, [
    'registration_added',
    'registration_removed',
    'registration_record_changed',
    'aircraft_assignment_changed',
    'status_changed',
    'registrant_changed',
    'registrant_pii_withheld',
    'registrant_pii_released',
  ]);

  for (const eventType of AIRCRAFT_HISTORY_EVENT_TYPES) {
    assert.ok(labelAircraftHistoryEvent(eventType).length > 0, eventType);
  }

  assert.match(historyPage, /PII-free events/);
  assert.match(historyPage, /They do not expose old registrant names or addresses/);
});

test('history UI treats observation windows as evidence, not legal ownership periods', () => {
  assert.match(historyPage, /Observed from/);
  assert.match(historyPage, /Observed through/);
  assert.match(historyPage, /not legal ownership periods/);
  assert.match(historyPage, /do not[\s\S]*establish the exact time a real-world change occurred/);
  assert.match(readme, /not legal ownership periods/);
  assert.match(agents, /Never derive an effective date from/);
});

test('source effective dates are rendered only when supplied', () => {
  assert.match(historyPage, /event\.sourceEffectiveDate \?/);
  assert.match(historyPage, /Source effective date:/);
  assert.doesNotMatch(historyPage, /Source effective date:[\s\S]{0,160}Not reported/);
  assert.match(readme, /shown only when the API supplies a non-null/);
});

test('history UI deliberately omits retained registrant personal details', () => {
  assert.doesNotMatch(historyPage, /version\.registrant|event\.registrant/);
  assert.doesNotMatch(historyPage, /\.street1|\.street2|\.postalCode|\.otherNames/);
  assert.match(
    historyPage,
    /Historical registrant names, addresses, aliases, and other personal details are not[\s\S]*displayed here/,
  );
  assert.match(historyPage, /Current FAA withholding remains authoritative over retained history/);
  assert.match(readme, /does not display retained registrant names, street addresses, aliases/);
});

test('current lookup links directly into observed history', () => {
  assert.match(lookupPage, /pathname: '\/history'/);
  assert.match(lookupPage, /nNumber: record\.registration\.nNumber/);
  assert.match(lookupPage, /View observed history/);
});

test('public history copy stays free of internal phase language', () => {
  for (const [name, source] of [
    ['history page', historyPage],
    ['README', readme],
  ] as const) {
    assert.doesNotMatch(source, /\bAIR\d+[A-Z]*\b/, name);
  }
});
