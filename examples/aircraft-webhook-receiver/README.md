# Signed Aircraft change webhook receiver

A small, dependency-free Node.js example that **receives**, authenticates, and
records signed [Grizzly Bulls Aircraft Intelligence API](https://grizzlybulls.com/aircraft-api)
notifications. It demonstrates the push side of registry-change monitoring.
The main [Aircraft Registry Explorer](../../README.md) already demonstrates
read-side lookups, observed changes, and history; this example does not repeat
those workflows or run a separate FAA ingestion pipeline.

The receiver understands the published `aircraft-webhook-v1` envelope:
`aircraft.change` (realtime), `aircraft.digest` (daily/weekly), and
`aircraft.webhook.test` (synthetic delivery test). It verifies the **raw**
HTTP request bytes before parsing JSON, enforces a five-minute timestamp
window, checks the configured watch ID, and writes a minimal event receipt.
Redeliveries for the same watch/event return `200` without another receipt.
It does **not** save registrant data, full webhook bodies, signing secrets,
API keys, or purported legal ownership-change dates.

## 1. Run the receiver locally without a paid account

You need Node.js 24. There are no dependencies or build steps.
From the repository root, use a **clearly synthetic** watch ID and secret:

```bash
export AIRCRAFT_WEBHOOK_WATCH_ID='aw_aaaaaaaaaaaaaaaaaaaaaaaa'
export AIRCRAFT_WEBHOOK_SIGNING_SECRET="whsec_$(node -e 'process.stdout.write("A".repeat(43))')"
node examples/aircraft-webhook-receiver/server.mjs
```

In a second shell with the **same two environment variables**:

```bash
node examples/aircraft-webhook-receiver/send-test.mjs
```

Expected: `Local synthetic webhook: HTTP 200 recorded` and a sanitized
`webhook recorded` message in the server console. The generated message is
explicitly synthetic and **not an observed FAA change**. Its local signer
exists only to test the receiver; no real Aircraft API request occurs.

The receiver listens on `127.0.0.1:8787` by default, stores minimal receipt
JSON files under `.webhook-receipts/`, and answers `GET /health`. Set `PORT`
and `AIRCRAFT_WEBHOOK_RECEIPTS_DIR` to override the local port and receipt
location. Do not commit this receipt directory.

Run the full offline suite:

```bash
node --test examples/aircraft-webhook-receiver/receiver.test.mjs
```

## 2. Connect a real Developer or Business watch

Free supports the bounded observed-change **read** feed. Realtime webhook
watches and scheduled digests require a [Developer or Business plan](https://grizzlybulls.com/aircraft-api#pricing).

For a real delivery, first deploy the receiver **behind a public HTTPS reverse
proxy on port 443**, using a DNS hostname you control. The Aircraft API rejects
localhost, private IPs, non-HTTPS endpoints, and non-443 ports. Do not bind the
sample plaintext HTTP port directly to the public Internet. Configure the
proxy to preserve the raw request body and the `X-Grizzly-Bulls-*` headers;
restrict its route to `POST /webhooks/aircraft`. Keep the signing secret and
receipt storage outside public web roots. Production workloads should use a
transactional database and durable queues for business effects instead of
this example's file receipts.

Create a named watch from a trusted shell or server (never browser code):

```bash
curl --fail-with-body \
  -X POST 'https://api.grizzlybulls.com/v1/aircraft/watch-lists' \
  -H "Authorization: Bearer $GRIZZLY_BULLS_API_KEY" \
  -H 'Content-Type: application/json' \
  --data '{
    "name": "Fleet registry updates",
    "nNumbers": ["N172SP"],
    "endpointUrl": "https://YOUR_PUBLIC_DOMAIN.example/webhooks/aircraft",
    "eventTypes": ["registration_record_changed", "status_changed"],
    "frequency": "realtime"
  }'
```

The `201` JSON response's `data.watchId` and `data.signingSecret` are required
by the receiver:

```bash
export AIRCRAFT_WEBHOOK_WATCH_ID='aw_...from the create response...'
export AIRCRAFT_WEBHOOK_SIGNING_SECRET='whsec_...from the create response...'
```

**Capture the signing secret once, privately.** It is returned when the watch
is created and cannot be retrieved later. Do not paste actual values into
issues, logs, source files, screenshots, analytics, or a public shell history.
Manage them as deployment secrets. You can create a separate named watch for
a different endpoint, with its own secret.

An incoming realtime change has the same `data.change` public, privacy-safe
change record exposed by the Aircraft API. A digest carries an array of
source-backed alerts. Neither proves the legal date of a registration change,
a transfer of beneficial ownership, or N-number availability. Always use the
API's explicit observation/source timestamps and evidence semantics.

## Verification and retries

The Aircraft API signs the exact UTF-8 JSON body with the **watch-specific**
`whsec_` string from creation:

```text
X-Grizzly-Bulls-Webhook-Timestamp: <unix-seconds>
X-Grizzly-Bulls-Event-Id: <public-event-id>
X-Grizzly-Bulls-Delivery-Id: <delivery-id>
X-Grizzly-Bulls-Delivery-Attempt: <1..5>
X-Grizzly-Bulls-Signature: v1=<hex-hmac-sha256>
HMAC key: signingSecret
HMAC input: timestamp + "." + rawBody
```

The receiver verifies the signature using constant-time comparison, rejects
headers or payloads that disagree, and only then writes a receipt. It stores
one minimal marker keyed by **watch ID + event ID**, not by delivery attempt.
The same logical event may be delivered again after network errors or a lost
acknowledgment, so acknowledge duplicates with `200`. Malformed or unsigned
requests return `401`, unsupported media `415`, and temporary disk failures
`503` to allow the API's bounded retry policy. The sample caps incoming bodies
at 2 MiB and requires a reasonably synchronized server clock.

The local filesystem receipt marker is **a demonstration of idempotent
receipt recording**, not exactly-once execution of downstream business jobs.
If a production consumer updates a fleet database, sends notifications, or
runs multiple instances, make the event receipt and the business side effect
one transactional operation, establish cleanup/retention, and monitor failures.
Keep `/health` private or access-controlled at the proxy if exposing status
would leak deployment topology.

## Boundaries

- This is an **inbound receiver**, not another implementation of the Aircraft
  API or a replacement for the existing Explorer.
- The HTTP listener is intentionally local/plaintext; real delivery requires
  your own TLS terminator and public DNS.
- Never put `GRIZZLY_BULLS_API_KEY` or `AIRCRAFT_WEBHOOK_SIGNING_SECRET` in
  frontend code, a URL, a query parameter, a committed `.env` file, or logs.
- Registration changes are observations between accepted FAA snapshots,
  not claims about ownership transfers, aircraft tracking, or legal status.
- Source and signing contracts are owned by the
  [public OpenAPI](https://api.grizzlybulls.com/v1/openapi); this example
  consumes them without importing private Grizzly Bulls implementation code.
