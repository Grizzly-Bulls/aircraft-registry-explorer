import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { link, mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const MAX_BODY_BYTES = 2 * 1024 * 1024;
export const MAX_SIGNATURE_AGE_SECONDS = 5 * 60;

const watchPattern = /^aw_[a-f0-9]{24}$/;
const secretPattern = /^whsec_[A-Za-z0-9_-]{43}$/;
const idPattern = /^[A-Za-z][A-Za-z0-9_:-]{2,127}$/;
const nNumberPattern = /^N(?:[1-9][0-9]{0,4}|[1-9][0-9]{0,3}[A-HJ-NP-Z]|[1-9][0-9]{0,2}[A-HJ-NP-Z]{2})$/;

export class InvalidWebhookError extends Error {}

export function validateReceiverConfig({ signingSecret, watchId }) {
  if (typeof signingSecret !== 'string' || !secretPattern.test(signingSecret)) {
    throw new Error('AIRCRAFT_WEBHOOK_SIGNING_SECRET must be the whsec_ secret returned when a watch was created');
  }
  if (typeof watchId !== 'string' || !watchPattern.test(watchId)) {
    throw new Error('AIRCRAFT_WEBHOOK_WATCH_ID must be the aw_ identifier for that watch');
  }
}

function header(headers, name) {
  const value = headers[name];
  return typeof value === 'string' ? value : null;
}

/** Verify the exact sender contract before parsing untrusted JSON. */
export function verifyAircraftWebhook({ headers, rawBody, signingSecret, watchId, nowMs = Date.now() }) {
  validateReceiverConfig({ signingSecret, watchId });
  if (!Buffer.isBuffer(rawBody) || rawBody.length === 0 || rawBody.length > MAX_BODY_BYTES) {
    throw new InvalidWebhookError('invalid webhook body');
  }

  const timestamp = header(headers, 'x-grizzly-bulls-webhook-timestamp');
  const signature = header(headers, 'x-grizzly-bulls-signature');
  const eventId = header(headers, 'x-grizzly-bulls-event-id');
  const deliveryId = header(headers, 'x-grizzly-bulls-delivery-id');
  const attempt = header(headers, 'x-grizzly-bulls-delivery-attempt');
  if (!timestamp || !/^[1-9][0-9]{9,11}$/.test(timestamp)
      || !signature || !/^v1=[a-f0-9]{64}$/.test(signature)
      || !eventId || !idPattern.test(eventId)
      || !deliveryId || !/^awd_[a-f0-9]{24}$/.test(deliveryId)
      || !attempt || !/^[1-5]$/.test(attempt)) {
    throw new InvalidWebhookError('missing or invalid webhook headers');
  }
  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds)
      || !Number.isFinite(nowMs)
      || Math.abs(Math.floor(nowMs / 1000) - timestampSeconds) > MAX_SIGNATURE_AGE_SECONDS) {
    throw new InvalidWebhookError('webhook timestamp is outside the acceptance window');
  }

  // The sender signs timestamp + "." + rawBody with the returned whsec_
  // string as the HMAC key. Do not parse and reserialize the body first.
  const expected = createHmac('sha256', signingSecret)
    .update(timestamp + '.', 'utf8').update(rawBody).digest();
  const received = Buffer.from(signature.slice(3), 'hex');
  if (!timingSafeEqual(expected, received)) {
    throw new InvalidWebhookError('invalid webhook signature');
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw new InvalidWebhookError('invalid JSON');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
      || payload.version !== 'aircraft-webhook-v1'
      || payload.id !== eventId
      || !['aircraft.change', 'aircraft.digest', 'aircraft.webhook.test'].includes(payload.type)
      || !payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)
      || payload.data.watchId !== watchId
      || typeof payload.createdAt !== 'string'
      || !Number.isFinite(Date.parse(payload.createdAt))) {
    throw new InvalidWebhookError('invalid webhook envelope');
  }

  const nNumber = payload.data.nNumber;
  if (payload.type !== 'aircraft.digest' && (typeof nNumber !== 'string' || !nNumberPattern.test(nNumber))) {
    throw new InvalidWebhookError('invalid N-number');
  }
  if (payload.type === 'aircraft.change'
      && (!payload.data.change || typeof payload.data.change !== 'object' || Array.isArray(payload.data.change))) {
    throw new InvalidWebhookError('missing public change');
  }
  if (payload.type === 'aircraft.digest'
      && (!Array.isArray(payload.data.alerts))) {
    throw new InvalidWebhookError('invalid digest alerts');
  }

  // Deliberately omit the change body, any registrant data and all secrets.
  return {
    eventId,
    deliveryId,
    watchId,
    type: payload.type,
    ...(payload.type === 'aircraft.digest' ? { alertCount: payload.data.alerts.length } : { nNumber }),
    createdAt: payload.createdAt,
    receivedAt: new Date(nowMs).toISOString(),
  };
}

/**
 * Only side effect in this example: a minimal, durable receipt marker.
 * A flushed file followed by an atomic hard link makes simultaneous redeliveries
 * deduplicate without an in-memory cache or storing the full webhook payload.
 * Use a transactional database for crash-proof production side effects.
 */
export async function recordReceipt(directory, receipt) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const digest = createHash('sha256').update(receipt.watchId + '\n' + receipt.eventId).digest('hex');
  const destination = path.join(directory, digest + '.json');
  const temporary = path.join(directory, '.pending-' + randomBytes(16).toString('hex'));
  try {
    await writeFile(temporary, JSON.stringify(receipt) + '\n', {
      flag: 'wx', mode: 0o600, flush: true,
    });
    try {
      await link(temporary, destination);
      return 'recorded';
    } catch (error) {
      if (error?.code === 'EEXIST') return 'duplicate';
      throw error;
    }
  } finally {
    await unlink(temporary).catch(error => {
      if (error?.code !== 'ENOENT') throw error;
    });
  }
}
