/** Send one explicitly synthetic request to a local receiver, not to the Aircraft API. */
import { createHmac, randomBytes } from 'node:crypto';
import { validateReceiverConfig } from './receiver.mjs';

const signingSecret = process.env.AIRCRAFT_WEBHOOK_SIGNING_SECRET;
const watchId = process.env.AIRCRAFT_WEBHOOK_WATCH_ID;
validateReceiverConfig({ signingSecret, watchId });
const timestamp = Math.floor(Date.now() / 1000);
const eventId = 'aevt_test_' + randomBytes(12).toString('hex');
const rawBody = JSON.stringify({
  version: 'aircraft-webhook-v1',
  id: eventId,
  type: 'aircraft.webhook.test',
  createdAt: new Date(timestamp * 1000).toISOString(),
  data: {
    watchId, nNumber: 'N172SP', test: true,
    message: 'Local synthetic test; this does not represent an FAA registration change.',
  },
});
const signature = createHmac('sha256', signingSecret)
  .update(timestamp + '.' + rawBody).digest('hex');
const port = Number(process.env.PORT || '8787');
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a valid TCP port');
}
const response = await fetch('http://127.0.0.1:' + port + '/webhooks/aircraft', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Grizzly-Bulls-Event-Id': eventId,
    'X-Grizzly-Bulls-Delivery-Id': 'awd_' + randomBytes(12).toString('hex'),
    'X-Grizzly-Bulls-Delivery-Attempt': '1',
    'X-Grizzly-Bulls-Webhook-Timestamp': String(timestamp),
    'X-Grizzly-Bulls-Signature': 'v1=' + signature,
  },
  body: rawBody,
});
const reply = await response.json();
console.log('Local synthetic webhook: HTTP ' + response.status + ' ' + (reply.status || reply.error));
if (!response.ok) process.exitCode = 1;
