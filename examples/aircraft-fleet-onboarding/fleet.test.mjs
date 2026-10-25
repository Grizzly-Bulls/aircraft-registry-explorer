import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FleetApiError, FleetInputError, MAX_AIRCRAFT, REQUEST_SPACING_MS,
  normalizeNNumber, parseFleetCsv, projectCurrentRecord, lookupOne, refreshFleet,
} from './fleet.mjs';
import { main, parseArguments } from './run.mjs';

const apiKey = 'test-only-credential';
const payload = nNumber => ({
  data: {
    registration: { nNumber },
    aircraft: {
      manufacturer: 'CESSNA', model: '172', manufactureYear: 1982,
      serialNumber: 'SERIAL-EXAMPLE', modeSCodeHex: 'A00001',
    },
    source: { retrievedAt: '2026-10-25T01:20:00.000Z' },
    registrant: { name: 'DO NOT STORE NAME', mailingStreet: 'DO NOT STORE ADDRESS' },
  },
});
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json', ...headers },
});
const context = (sequence, sleeps = []) => ({
  apiKey,
  fetchImpl: async (url, init) => {
    assert.equal(init.headers.Authorization, 'Bearer ' + apiKey);
    assert.equal(init.method, 'GET');
    assert.equal(init.headers.Accept, 'application/json');
    assert.match(url, /^https:\/\/api\.grizzlybulls\.com\/v1\/aircraft\/N/);
    assert.ok(sequence.length > 0, 'unexpected network call');
    return sequence.shift();
  },
  sleep: async ms => sleeps.push(ms),
});

test('validates only unique, bounded one-column N-numbers before network', async () => {
  assert.equal(normalizeNNumber(' n-123ab '), 'N123AB');
  assert.equal(normalizeNNumber('N1'), 'N1');
  assert.deepEqual(parseFleetCsv('\uFEFFnNumber\r\nN172SP\r\n n-172sp\r\nN234AB\r\n'), [
    'N172SP', 'N234AB',
  ]);
  for (const bad of ['N0123', 'N0', 'N-12IO', 'ABC', 'N123456', 'N123AB;', 'N10,Other', 'N10"']) {
    assert.throws(() => normalizeNNumber(bad), FleetInputError);
  }
  for (const invalid of [
    '', 'N123\n', 'nNumber\n', 'nNumber,owner\nN123,SECRET',
    'nNumber\nN123,SECRET', 'nNumber\n"N123"', 'nNumber\nN0001',
    'nNumber\n' + Array.from({ length: MAX_AIRCRAFT + 1 }, (_, i) => 'N' + (i + 1)).join('\n'),
    'nNumber\n' + 'N123\n'.repeat(10000),
  ]) assert.throws(() => parseFleetCsv(invalid), FleetInputError);
  assert.equal(parseFleetCsv('nNumber\nN123\nN123\n').length, 1);
  await assert.rejects(() => refreshFleet(['N123', 'N123'], context([])), FleetInputError);
  await assert.rejects(() => refreshFleet(['N123', 'invalid'], context([])), FleetInputError);
});

test('projects current-public aircraft/source fields only, never registrant PII', () => {
  const result = projectCurrentRecord('N172SP', payload('N172SP'));
  assert.deepEqual(Object.keys(result), [
    'nNumber', 'status', 'manufacturer', 'model', 'manufactureYear',
    'serialNumber', 'sourceRetrievedAt',
  ]);
  assert.equal(result.status, 'current_registration_found');
  assert.doesNotMatch(JSON.stringify(result), /DO NOT STORE|registrant|mailing/);
  assert.throws(() => projectCurrentRecord('N172SP', payload('N111')), FleetApiError);
  assert.throws(() => projectCurrentRecord('N172SP', {
    data: { ...payload('N172SP').data, source: {} },
  }), FleetApiError);
});

test('sequential lookups respect Free-plan pacing with no registry enumeration', async () => {
  const sleeps = [];
  const c = context([json(payload('N172SP')), json(payload('N12345'))], sleeps);
  const response = await refreshFleet(['N172SP', 'N12345'], c);
  assert.deepEqual(sleeps, [REQUEST_SPACING_MS]);
  assert.equal(response.schemaVersion, 'aircraft-fleet-refresh-example-v1');
  assert.equal(response.rows.length, 2);
  assert.equal(response.rows[1].nNumber, 'N12345');
  assert.doesNotMatch(JSON.stringify(response), /DO NOT STORE/);
});

test('404 means no current reviewed match, not N-number availability', async () => {
  const row = await lookupOne('N123', context([json({ error: { code: 'not_found' } }, 404)]));
  assert.deepEqual(row, { nNumber: 'N123', status: 'no_current_registration_found' });
});

test('bounded 429 Retry-After and 503 retry; immediate failure on auth/scope errors', async () => {
  const sleeps = [];
  const retry = context([
    json({}, 429, { 'retry-after': '3' }),
    json({}, 503),
    json(payload('N123')),
  ], sleeps);
  assert.equal((await lookupOne('N123', retry)).nNumber, 'N123');
  assert.deepEqual(sleeps, [3000, 4000]);
  for (const invalidDelay of ['', '3600', '-1', 'Wed, 25 Oct 2026 13:00:00 GMT']) {
    await assert.rejects(
      () => lookupOne('N123', context([json({}, 429, { 'retry-after': invalidDelay })])),
      e => e.status === 429,
    );
  }
  for (const status of [400, 401, 403, 500]) {
    await assert.rejects(() => lookupOne('N123', context([json({}, status)])), e => e.status === status);
  }
  await assert.rejects(() => lookupOne('N123', context([
    json({}, 503), json({}, 503), json({}, 503),
  ])), e => e.status === 503);
});

test('network failures never leak credentials or trigger ambiguous retries', async () => {
  let calls = 0;
  await assert.rejects(() => lookupOne('N123', {
    apiKey,
    fetchImpl: async () => { calls += 1; throw new Error('secret ' + apiKey); },
    sleep: async () => { throw new Error('unexpected retry'); },
  }), e => {
    assert.equal(e instanceof FleetApiError, true);
    assert.doesNotMatch(e.message, /secret|test-only-credential/);
    return true;
  });
  assert.equal(calls, 1);
});

test('CLI defaults to dry-run and refuses output writes without --live', async () => {
  assert.deepEqual(parseArguments(['--input', 'aircraft.csv']), {
    input: 'aircraft.csv', output: null, live: false,
  });
  assert.throws(() => parseArguments(['--input', 'a', '--output', 'b']), FleetInputError);
  assert.throws(() => parseArguments(['--input', 'a', '--live', '--bogus']), FleetInputError);
  const prints = [];
  const errors = [];
  const code = await main(['--input', 'aircraft.csv'], {
    read: async () => 'nNumber\nN123\nN-123',
    print: v => prints.push(v), error: v => errors.push(v),
    environment: { GRIZZLY_BULLS_API_KEY: 'SECRET' },
  });
  assert.equal(code, 0);
  assert.equal(errors.length, 0);
  assert.match(prints.join(' '), /DRY RUN: 1/);
  assert.doesNotMatch(prints.join(' '), /SECRET/);
});
