# Aircraft fleet onboarding: bounded current-registry enrichment

Use the [Grizzly Bulls Aircraft Intelligence API](https://grizzlybulls.com/aircraft-api)
to populate or refresh **a small, known list of U.S. aircraft registrations**
without maintaining the FAA ZIP download, parser, or registry refresh pipeline.
This is a dependency-free Node.js 24 CLI example, **not** bulk registry export,
a new backend service, or an unfiltered registry crawler.

Unlike the [interactive Explorer](../../README.md), this example is for a
fleet software integration: look up each supplied N-number and project just
manufacturer, model, manufacture year, serial number and the last accepted
FAA source retrieval timestamp. It can help with flight-school, maintenance,
quoting, and small-fleet onboarding. [Signed watch-list delivery](../aircraft-webhook-receiver/README.md)
is a separate paid change-monitoring workflow.

## First run: no API key or network required

From the repository root:

```bash
node examples/aircraft-fleet-onboarding/run.mjs \
  --input examples/aircraft-fleet-onboarding/sample.csv
```

The default **dry-run** checks the input, canonicalizes and deduplicates
N-numbers, and shows how many requests live mode would use. It makes **no
external requests**.

Input is intentionally **one-column UTF-8 CSV** with an exact `nNumber`
header and one U.S. N-number per line:

```csv
nNumber
N172SP
N12345
N-234AB
```

This is not a general-purpose CSV parser; other columns, quoted cells, and
malformed identifiers fail before any API usage is incurred. Equivalent
forms (such as `n-234ab`) deduplicate after canonicalization. Limit:
**25 unique N-numbers per run**. The sample identifiers demonstrate format
only and are not promised active aircraft records.

## Make real requests with a Free key

Create a Free key at [the Aircraft API page](https://grizzlybulls.com/aircraft-api).
Keep the key in your private server/terminal environment:

```bash
export GRIZZLY_BULLS_API_KEY='your-secret-key'
node examples/aircraft-fleet-onboarding/run.mjs \
  --input examples/aircraft-fleet-onboarding/sample.csv \
  --live \
  --output ./local-aircraft-enrichment.json
```

**`--live` is mandatory** for a network call. Each unique N-number is a
metered `current_lookup`, including valid no-match lookups. Free currently
includes 1,000 requests/month and 30 RPM. The sample sends requests
sequentially with at least 2.2 seconds between identifiers, handles bounded
`429` Retry-After and `503` retries, and stops on key/scope errors,
unbounded rate windows, invalid responses, or uncertain network failures.
It does not automatically exhaust a larger fleet or your quota.

The JSON output is written as a new local file with restrictive permissions
and never overwritten. It contains only allowlisted current-public fields:

```json
{
  "schemaVersion": "aircraft-fleet-refresh-example-v1",
  "source": "Grizzly Bulls Aircraft Intelligence API — current FAA registry only",
  "rows": [
    {
      "nNumber": "N172SP",
      "status": "current_registration_found",
      "manufacturer": "EXAMPLE MANUFACTURER",
      "model": "EXAMPLE MODEL",
      "manufactureYear": 2000,
      "serialNumber": "EXAMPLE-SERIAL",
      "sourceRetrievedAt": "2026-10-25T01:20:00.000Z"
    }
  ]
}
```

**The displayed JSON is illustrative, not a real FAA record.** No registrant
names, addresses, API secrets, or full upstream responses are stored.
A valid N-number that is absent from current reviewed FAA data returns
`no_current_registration_found`—**not** a legal availability, ownership,
lien, airworthiness, or deregistration determination.

## Offline tests

```bash
node --test examples/aircraft-fleet-onboarding/*.test.mjs
```

The tests use mocked responses, no live credentials and no network. They
cover exact identifiers, deduplication, 25-record cap, sequential pacing,
contract and provenance validation, PII exclusion, bounded retries, and
default dry-run behavior.

## Use in an application

Use the sanitized data to prefill or reconcile an **existing** aircraft
profile; display the FAA snapshot retrieval time so users understand
freshness. Daily observations do not prove the exact effective date of a
registration change or ownership transfer. Do not blindly overwrite
customer-maintained fields when the current public source omits a value.

For larger or recurring jobs, evaluate paid asynchronous query/export
options and implement explicit durable job queues, idempotency, privacy,
monitoring and budget controls. This example provides none of those,
and does not provide a source redistribution license or a second FAA
publication authority. The [public OpenAPI](https://api.grizzlybulls.com/v1/openapi)
remains the source for current routes, schemas, auth, and error behavior.
