import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HistoryAuditError, parseAuditFleetCsv, projectHistory, reviewFleetHistory, reviewOne,
} from './history.mjs';
import { main, parseArguments } from './run.mjs';

const sampleEvent = (nNumber = 'N172SP') => ({
  contractVersion: 'aircraft-public-v1',
  nNumber,
  eventType: 'registration_record_changed',
  observedAt: '2026-10-25T01:20:00.000Z',
  sourceEffectiveDate: null,
  changedFields: ['aircraft_model', 'registration_status'],
  registrant: { name: 'SHOULD NEVER LEAVE UPSTREAM RESPONSE' },
  source: { secret: 'SHOULD NEVER LEAVE UPSTREAM RESPONSE' },
});

const response = (nNumber = 'N172SP', { events = [sampleEvent(nNumber)], total = events.length } = {}) => ({
  data: {
    nNumber,
    versions: [{ registrant: { name: 'SENSITIVE REGISTRANT' } }],
    events,
  },
  pagination: {
    versions: { limit: 10, offset: 0, total: 1, hasMore: false },
    events: { limit: 10, offset: 0, total, hasMore: total > events.length },
  },
});

test('dry-run input reuses exact one-column parser, canonicalizes, deduplicates, and caps at ten', () => {
  assert.deepEqual(parseAuditFleetCsv('nNumber\nn172sp\nN-172SP\nN12345\n'), ['N172SP', 'N12345']);
  const eleven = 'nNumber\n' + Array.from({ length: 11 }, (_, n) => 'N' + (n + 1)).join('\n');
  assert.throws(() => parseAuditFleetCsv(eleven), /limited to 10/);
  assert.throws(() => parseAuditFleetCsv('nNumber,owner\nN12345,Jane'), /one-column/);
  assert.throws(() => parseAuditFleetCsv('nNumber\nN0'), /Invalid U.S. N-number/);
});

test('projects ONLY allowlisted event metadata, never upstream versions or PII', () => {
  const item = projectHistory('N172SP', response());
  assert.equal(item.eventCountShown, 1);
  assert.equal(item.moreEventsAvailable, false);
  assert.deepEqual(Object.keys(item.events[0]), ['eventType', 'observedAt', 'sourceEffectiveDate', 'changedFields']);
  assert.doesNotMatch(JSON.stringify(item), /SENSITIVE REGISTRANT|SHOULD NEVER LEAVE UPSTREAM/);
  assert.deepEqual(item.events[0].changedFields, ['aircraft_model', 'registration_status']);
});

test('does not claim a complete history if the first bounded event page has more', () => {
  const item = projectHistory('N172SP', response('N172SP', { total: 14 }));
  assert.equal(item.moreEventsAvailable, true);
  assert.equal(item.totalObservedEventsReported, 14);
  assert.equal(item.eventCountShown, 1);
});

test('fail closed for unexpected event fields, identifiers, and contradictory pagination', () => {
  const badEvent = sampleEvent();
  badEvent.changedFields = ['registrant_name'];
  assert.throws(() => projectHistory('N172SP', response('N172SP', { events: [badEvent] })),
    HistoryAuditError);
  assert.throws(() => projectHistory('N12345', response('N172SP')), HistoryAuditError);
  assert.throws(() => projectHistory('N172SP', response('N172SP', { total: 0 })), HistoryAuditError);
  const wrong = response();
  wrong.pagination.events.limit = 500;
  assert.throws(() => projectHistory('N172SP', wrong), HistoryAuditError);
});

test('one explicit GET per N-number, no walking or response leakage', async () => {
  const urls = [];
  const headers = [];
  const result = await reviewFleetHistory(['N172SP', 'N12345'], {
    apiKey: 'fixture-key',
    sleep: async () => {},
    fetchImpl: async (url, init) => {
      urls.push(url);
      headers.push(init.headers.Authorization);
      return { status: 200, ok: true, json: async () => response(url.includes('N12345') ? 'N12345' : 'N172SP') };
    },
  });
  assert.equal(urls.length, 2);
  assert.ok(urls.every(url => url.includes('versionsLimit=10&versionsOffset=0&eventsLimit=10&eventsOffset=0')));
  assert.deepEqual(headers, ['Bearer fixture-key', 'Bearer fixture-key']);
  assert.equal(result.eventsAreBounded, true);
  assert.doesNotMatch(JSON.stringify(result), /fixture-key|SENSITIVE REGISTRANT/);
});

test('404 is missing retained history, not legal N-number availability; auth failure stops', async () => {
  const notFound = await reviewOne('N172SP', {
    apiKey: 'fixture-key',
    fetchImpl: async () => ({ status: 404, ok: false }),
  });
  assert.equal(notFound.status, 'no_retained_history_found');
  await assert.rejects(() => reviewOne('N172SP', {
    apiKey: 'fixture-key',
    fetchImpl: async () => ({ status: 401, ok: false }),
  }), /Authentication/);
});

test('CLI is genuinely offline by default and errors before network access', async () => {
  let called = false;
  const lines = [];
  const status = await main(['--input', 'fleet.csv'], {
    read: async () => 'nNumber\nN172SP\n',
    review: async () => { called = true; },
    print: line => lines.push(line),
  });
  assert.equal(status, 0);
  assert.equal(called, false);
  assert.match(lines.join('\n'), /DRY RUN/);
  assert.throws(() => parseArguments(['--input', 'fleet.csv', '--output', 'report.json']), /requires explicit/);
});

test('live CLI requires key and writes only reviewed report as a new private file', async () => {
  const errors = [];
  const noKey = await main(['--input', 'fleet.csv', '--live'], {
    read: async () => 'nNumber\nN172SP\n',
    environment: {},
    error: message => errors.push(message),
  });
  assert.equal(noKey, 1);
  assert.match(errors[0], /Set GRIZZLY_BULLS_API_KEY/);
  let wrote;
  const status = await main(['--input', 'fleet.csv', '--live', '--output', 'review.json'], {
    read: async () => 'nNumber\nN172SP\n',
    environment: { GRIZZLY_BULLS_API_KEY: 'never-print-this' },
    review: async () => ({ rows: [projectHistory('N172SP', response())] }),
    write: async (path, content, opts) => { wrote = { path, content, opts }; },
    print: () => {},
  });
  assert.equal(status, 0);
  assert.equal(wrote.path, 'review.json');
  assert.equal(wrote.opts.mode, 0o600);
  assert.equal(wrote.opts.flag, 'wx');
  assert.doesNotMatch(wrote.content, /never-print-this|SENSITIVE REGISTRANT/);
});
