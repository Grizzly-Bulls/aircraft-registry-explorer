import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseInventoryCsv, assessRecord, reviewFleetDrift, FleetInputError,
} from './drift.mjs';
import { main, parseArguments } from './run.mjs';

const input = 'nNumber,manufacturer,model,serialNumber\nN172SP,Cessna,172,ABC-123\n';
const key = 'private-fixture-only';

const current = (nNumber, { serialNumber = 'ABC-123', manufacturer = 'CESSNA' } = {}) => ({
  data: {
    registration: { nNumber, registrantName: 'HIDDEN PERSON' },
    aircraft: { manufacturer, model: '172', manufactureYear: 1982, serialNumber },
    source: { retrievedAt: '2026-10-28T12:00:00.000Z' },
    registrant: { name: 'HIDDEN PERSON', address: 'PRIVATE ADDRESS' },
  },
});
const history = nNumber => ({
  data: {
    nNumber,
    versions: [{ registrant: { name: 'HIDDEN PAST PERSON' } }],
    events: [{
      contractVersion: 'aircraft-public-v1', nNumber,
      eventType: 'aircraft_assignment_changed', observedAt: '2026-10-27T12:00:00.000Z',
      sourceEffectiveDate: null, changedFields: ['aircraft_assignment'],
      registrant: { name: 'HIDDEN EVENT PERSON' },
    }],
  },
  pagination: {
    versions: { limit: 10, offset: 0, total: 1, hasMore: false },
    events: { limit: 10, offset: 0, total: 15, hasMore: true },
  },
});
const response = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status, headers: { 'content-type': 'application/json' },
});

test('strict small local inventory: canonical identifiers, no extra columns or PII', () => {
  assert.deepEqual(parseInventoryCsv('nNumber,manufacturer,model,serialNumber\nn-172sp,Cessna,172,ABC-123\n'), [
    { nNumber: 'N172SP', manufacturer: 'Cessna', model: '172', serialNumber: 'ABC-123' },
  ]);
  for (const invalid of [
    '', 'nNumber\nN172SP', 'nNumber,manufacturer,model,serialNumber,owner\nN1,A,B,C,PERSON',
    input + 'N-172SP,Cessna,172,ABC-123\n',
    input + 'N1,ACME,172,"S1"\n',
    input + 'N2,ACME,172,<script>\n',
    input + 'N0,ACME,172,S2\n',
    'nNumber,manufacturer,model,serialNumber\n' +
      Array.from({ length: 11 }, (_, i) => 'N' + (i + 1) + ',A,B,C').join('\n'),
  ]) assert.throws(() => parseInventoryCsv(invalid), FleetInputError);
});

test('pure comparison flags airframe identity conflicts without inventing reassignment', () => {
  const local = parseInventoryCsv(input)[0];
  const observation = {
    nNumber: 'N172SP', status: 'current_registration_found',
    manufacturer: 'CESSNA', model: '172', serialNumber: 'OTHER-999',
    sourceRetrievedAt: '2026-10-28T12:00:00Z',
    registrant: { name: 'SHOULD NEVER LEAK' },
  };
  const h = { nNumber: 'N172SP', status: 'observed_events_found',
    eventCountShown: 1, totalObservedEventsReported: 15, moreEventsAvailable: true,
    events: [{ eventType: 'aircraft_assignment_changed', observedAt: '2026-10-27T12:00:00Z',
      sourceEffectiveDate: null, changedFields: ['aircraft_assignment'] }],
  };
  const assessed = assessRecord(local, observation, h);
  assert.equal(assessed.outcome, 'identity_conflict_needs_review');
  assert.deepEqual(assessed.conflictingFields, ['serialNumber']);
  assert.equal(assessed.requiresManualReview, true);
  assert.equal(assessed.observedEventSample.moreEventsAvailable, true);
  assert.doesNotMatch(JSON.stringify(assessed), /SHOULD NEVER LEAK|registrant|reassigned|sold/);

  const match = assessRecord(local, { ...observation, serialNumber: 'abc-123' }, h);
  assert.equal(match.outcome, 'matches_current_observation');
  const unknown = assessRecord(local, { nNumber: 'N172SP', status: 'no_current_registration_found' }, h);
  assert.equal(unknown.outcome, 'no_current_registration_found');
  assert.equal(unknown.observedIdentity, null);
  const unverifiable = assessRecord(local, { ...observation, serialNumber: null }, h);
  assert.equal(unverifiable.outcome, 'identity_incomplete_needs_review');
  assert.deepEqual(unverifiable.unverifiedFields, ['serialNumber']);
  assert.throws(() => assessRecord(local, observation, { ...h, nNumber: 'N1' }), FleetInputError);
});

test('live integration is exactly one current and one bounded history request per known aircraft', async () => {
  const requests = [];
  const sleeps = [];
  const responses = [response(current('N172SP')), response(history('N172SP'))];
  const report = await reviewFleetDrift(parseInventoryCsv(input), {
    apiKey: key,
    fetchImpl: async (url, options) => {
      assert.equal(options.headers.Authorization, 'Bearer ' + key);
      assert.equal(options.method, 'GET');
      requests.push(url);
      return responses.shift();
    },
    sleep: async ms => sleeps.push(ms),
  });
  assert.deepEqual(requests, [
    'https://api.grizzlybulls.com/v1/aircraft/N172SP',
    'https://api.grizzlybulls.com/v1/aircraft/N172SP/history?versionsLimit=10&versionsOffset=0&eventsLimit=10&eventsOffset=0',
  ]);
  assert.deepEqual(sleeps, [2200]);
  assert.equal(report.requestCount, 2);
  assert.equal(report.rows[0].outcome, 'matches_current_observation');
  assert.equal(report.rows[0].observedEventSample.moreEventsAvailable, true);
  assert.match(report.observationCoverage, /not complete historical coverage/);
  assert.doesNotMatch(JSON.stringify(report), /HIDDEN PERSON|PRIVATE ADDRESS|HIDDEN PAST|HIDDEN EVENT/);
});

test('validation and uncertain request errors fail closed before publishing output', async () => {
  let calls = 0;
  await assert.rejects(
    reviewFleetDrift([{ nNumber: 'N0' }], { apiKey: key, fetchImpl: () => { calls++; } }),
    FleetInputError,
  );
  assert.equal(calls, 0);
  await assert.rejects(
    reviewFleetDrift(parseInventoryCsv(input), {
      apiKey: key, fetchImpl: () => { throw new Error('network uncertain'); },
    }), /Network request failed/,
  );
});

test('CLI defaults to zero network, requires explicit live output and writes owner-only new file', async () => {
  assert.deepEqual(parseArguments(['--input', 'fleet.csv']), { input: 'fleet.csv', output: null, live: false });
  for (const argv of [
    ['--input', 'fleet.csv', '--live'],
    ['--input', 'fleet.csv', '--output', 'report.json'],
    ['--input', 'fleet.csv', '--live', '--output', './fleet.csv'],
  ]) assert.throws(() => parseArguments(argv), FleetInputError);
  let calls = 0;
  const lines = [];
  const dry = await main(['--input', 'fleet.csv'], {
    read: async () => input,
    review: () => { calls++; throw new Error('not called'); },
    write: async () => { calls++; throw new Error('not called'); },
    print: message => lines.push(message),
  });
  assert.equal(dry, 0);
  assert.equal(calls, 0);
  assert.match(lines.join(' '), /2 metered API requests/);
  let writeOpts, written;
  const live = await main(['--input', 'fleet.csv', '--live', '--output', 'private.json'], {
    read: async () => input, environment: { GRIZZLY_BULLS_API_KEY: key },
    review: async () => ({ rows: [{ nNumber: 'N172SP', outcome: 'matches_current_observation' }] }),
    write: async (_, bytes, opts) => { written = bytes; writeOpts = opts; },
    print: () => {},
  });
  assert.equal(live, 0);
  assert.equal(writeOpts.mode, 0o600);
  assert.equal(writeOpts.flag, 'wx');
  assert.doesNotMatch(written, /private-fixture-only/);
});
