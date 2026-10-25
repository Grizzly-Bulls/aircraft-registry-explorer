import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import {
  InvalidWebhookError,
  MAX_BODY_BYTES,
  recordReceipt,
  verifyAircraftWebhook,
} from './receiver.mjs';
import { createRequestHandler } from './server.mjs';

const secret = 'whsec_' + 'S'.repeat(43);
const watchId = 'aw_' + 'a'.repeat(24);
const eventId = 'aevt_' + 'a'.repeat(32);
const deliveryId = 'awd_' + 'b'.repeat(24);
const time = 1792915200;
const nowMs = time * 1000;
const change = {
  version: 'aircraft-webhook-v1', id: eventId,
  type: 'aircraft.change', createdAt: new Date(nowMs).toISOString(),
  data: { watchId, nNumber: 'N172SP', change: { event: { eventType: 'status_changed' } } },
};

function signed({ payload = change, timestamp = time, attempt = '1', body = JSON.stringify(payload), secretKey = secret } = {}) {
  return {
    body: Buffer.from(body),
    headers: {
      'content-type': 'application/json',
      'x-grizzly-bulls-event-id': payload.id,
      'x-grizzly-bulls-delivery-id': deliveryId,
      'x-grizzly-bulls-delivery-attempt': attempt,
      'x-grizzly-bulls-webhook-timestamp': String(timestamp),
      'x-grizzly-bulls-signature': 'v1=' + createHmac('sha256', secretKey)
        .update(timestamp + '.' + body).digest('hex'),
    },
  };
}

function verify(packet) {
  return verifyAircraftWebhook({
    headers: packet.headers, rawBody: packet.body,
    watchId, signingSecret: secret, nowMs,
  });
}

test('matches the exact v1 wire signature, without normalizing JSON body', () => {
  const packet = signed();
  const receipt = verify(packet);
  assert.equal(receipt.eventId, eventId);
  assert.equal(receipt.nNumber, 'N172SP');
  assert.equal(receipt.type, 'aircraft.change');
  assert.deepEqual(Object.keys(receipt).sort(), [
    'deliveryId', 'eventId', 'nNumber', 'createdAt', 'receivedAt', 'type', 'watchId',
  ].sort());
  assert.throws(
    () => verify({ ...packet, body: Buffer.from(packet.body.toString() + ' ') }),
    InvalidWebhookError,
  );
  assert.throws(() => verifyAircraftWebhook({
    headers: packet.headers, rawBody: packet.body,
    watchId, signingSecret: secret.slice(0, -1), nowMs,
  }), Error);
});

test('rejects stale/future timestamps and mismatched or ambiguous headers', () => {
  const packet = signed();
  assert.throws(() => verify(signed({ timestamp: time - 301 })), InvalidWebhookError);
  assert.throws(() => verify(signed({ timestamp: time + 301 })), InvalidWebhookError);
  assert.ok(verify(signed({ timestamp: time - 300 })));
  for (const [key, value] of [
    ['x-grizzly-bulls-signature', 'v1=xyz'],
    ['x-grizzly-bulls-signature', [packet.headers['x-grizzly-bulls-signature']]],
    ['x-grizzly-bulls-event-id', 'other'],
    ['x-grizzly-bulls-delivery-id', '../evil'],
    ['x-grizzly-bulls-delivery-attempt', '6'],
    ['x-grizzly-bulls-webhook-timestamp', 'bad'],
  ]) {
    assert.throws(
      () => verify({ ...packet, headers: { ...packet.headers, [key]: value } }),
      InvalidWebhookError,
    );
  }
  const wrongWatch = signed({
    payload: { ...change, data: { ...change.data, watchId: 'aw_' + 'f'.repeat(24) } },
  });
  assert.throws(() => verify(wrongWatch), InvalidWebhookError);
  assert.throws(
    () => verify({ ...packet, body: Buffer.alloc(MAX_BODY_BYTES + 1) }),
    InvalidWebhookError,
  );
});

test('accepts synthetic tests and digests, without treating them as real changes', () => {
  const synthetic = signed({ payload: {
    ...change, id: 'aevt_test_' + 'c'.repeat(24), type: 'aircraft.webhook.test',
    data: { watchId, nNumber: 'N12345', test: true },
  } });
  assert.equal(verify(synthetic).type, 'aircraft.webhook.test');
  const digest = signed({ payload: {
    ...change, id: 'aevt_digest_' + 'd'.repeat(24), type: 'aircraft.digest',
    data: { watchId, alerts: [{ eventId }] },
  } });
  assert.equal(verify(digest).alertCount, 1);
  assert.equal(verify(digest).nNumber, undefined);
});

test('concurrent and repeated deliveries persist only one event receipt', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'air-receipts-'));
  try {
    const receipt = verify(signed());
    const results = await Promise.all(
      Array.from({ length: 8 }, () => recordReceipt(dir, receipt)),
    );
    assert.equal(results.filter(x => x === 'recorded').length, 1);
    assert.equal(results.filter(x => x === 'duplicate').length, 7);
    const files = await readdir(dir);
    assert.equal(files.length, 1);
    const stored = await readFile(path.join(dir, files[0]), 'utf8');
    assert.equal(JSON.parse(stored).eventId, eventId);
    assert.doesNotMatch(stored, /whsec_/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

let server;
let endpoint;
let receiptsDir;
before(async () => {
  receiptsDir = await mkdtemp(path.join(os.tmpdir(), 'air-receiver-http-'));
  server = createServer(createRequestHandler({
    signingSecret: secret, watchId, receiptsDir, now: () => nowMs,
  }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  endpoint = 'http://127.0.0.1:' + server.address().port;
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  await rm(receiptsDir, { recursive: true, force: true });
});

async function post(packet, pathname = '/webhooks/aircraft') {
  const response = await fetch(endpoint + pathname, {
    method: 'POST', headers: packet.headers, body: packet.body,
  });
  return { status: response.status, body: await response.json() };
}

test('HTTP receiver acknowledges only verified persisted deliveries', async () => {
  const packet = signed();
  assert.deepEqual(await post(packet), { status: 200, body: { status: 'recorded' } });
  assert.deepEqual(
    await post(signed({ attempt: '2' })),
    { status: 200, body: { status: 'duplicate' } },
  );
  const tampered = {
    ...packet, body: Buffer.from(JSON.stringify({ ...change, id: 'different' })),
  };
  assert.deepEqual(
    await post(tampered), { status: 401, body: { error: 'invalid_webhook' } },
  );
  assert.equal((await post(signed({ timestamp: time - 500 }))).status, 401);
  assert.equal((await post(signed(), '/other')).status, 404);
  const health = await fetch(endpoint + '/health');
  assert.deepEqual(await health.json(), { status: 'ok' });
  assert.equal((await fetch(endpoint + '/webhooks/aircraft')).status, 405);
  assert.equal((await post({
    headers: { ...packet.headers, 'content-type': 'text/plain' }, body: packet.body,
  })).status, 415);
});
