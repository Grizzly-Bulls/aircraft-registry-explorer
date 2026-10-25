import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  InvalidWebhookError,
  MAX_BODY_BYTES,
  recordReceipt,
  validateReceiverConfig,
  verifyAircraftWebhook,
} from './receiver.mjs';

function json(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(body));
}

function readRawBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let oversized = false;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        oversized = true;
        chunks.length = 0;
      } else if (!oversized) {
        chunks.push(chunk);
      }
    });
    request.on('end', () => oversized
      ? reject(new InvalidWebhookError('webhook body too large'))
      : resolve(Buffer.concat(chunks)));
    request.on('error', reject);
    request.setTimeout(10_000, () => request.destroy());
  });
}

export function createRequestHandler({ signingSecret, watchId, receiptsDir, now = Date.now }) {
  validateReceiverConfig({ signingSecret, watchId });
  if (!receiptsDir || typeof receiptsDir !== 'string') throw new Error('receiptsDir is required');
  return async (request, response) => {
    if (request.url === '/health' && request.method === 'GET') {
      json(response, 200, { status: 'ok' });
      return;
    }
    if (request.url !== '/webhooks/aircraft') {
      json(response, 404, { error: 'not_found' });
      return;
    }
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      json(response, 405, { error: 'method_not_allowed' });
      return;
    }
    if (typeof request.headers['content-type'] !== 'string'
        || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers['content-type'])) {
      json(response, 415, { error: 'unsupported_media_type' });
      return;
    }
    try {
      const rawBody = await readRawBody(request);
      const receipt = verifyAircraftWebhook({
        headers: request.headers, rawBody, signingSecret, watchId, nowMs: now(),
      });
      const result = await recordReceipt(receiptsDir, receipt);
      // The receipt is the example's complete business-side effect. Respond
      // 2xx only after persistence, so a temporary disk failure is retryable.
      json(response, 200, { status: result });
      console.info('webhook ' + result + ' type=' + receipt.type + ' event=' + receipt.eventId);
    } catch (error) {
      if (error instanceof InvalidWebhookError) {
        json(response, error.message === 'webhook body too large' ? 413 : 401, {
          error: 'invalid_webhook',
        });
        return;
      }
      // Never log body, signing secret, header values, or exception details.
      console.error('webhook storage unavailable');
      json(response, 503, { error: 'temporarily_unavailable' });
    }
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const signingSecret = process.env.AIRCRAFT_WEBHOOK_SIGNING_SECRET;
  const watchId = process.env.AIRCRAFT_WEBHOOK_WATCH_ID;
  const port = Number(process.env.PORT || '8787');
  const host = process.env.HOST || '127.0.0.1';
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port');
  }
  const handler = createRequestHandler({
    signingSecret, watchId,
    receiptsDir: process.env.AIRCRAFT_WEBHOOK_RECEIPTS_DIR || '.webhook-receipts',
  });
  createServer(handler).listen(port, host, () => {
    console.info('Webhook example listening on http://' + host + ':' + port + '/webhooks/aircraft');
  });
}
