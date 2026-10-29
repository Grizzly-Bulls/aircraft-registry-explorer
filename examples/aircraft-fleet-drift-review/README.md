# Check a known fleet for FAA registry identity drift

This dependency-free Node.js example compares **up to ten aircraft already in
your own system** with current, public FAA registry observations through the
[Grizzly Bulls Aircraft Intelligence API](https://grizzlybulls.com/aircraft-api).
It also reads **one bounded page** of recent observed events per N-number.
It is for manual fleet-data reconciliation, not automatic master-data updates.

A matching N-number is **not** enough to prove the same physical aircraft
still occupies a local record. The comparison checks manufacturer, model, and
serial number. A difference becomes a **manual review flag**—not proof of a
sale, new owner, reassignment, or legal status. An absent current record is
reported as unverified, never as an available N-number.

## Prepare your local input

Use a plain UTF-8 CSV with exactly four **unquoted** columns:

```csv
nNumber,manufacturer,model,serialNumber
N172SP,Cessna,172,ABC-123
N12345,Piper,PA-28,EXAMPLE-456
```

These are *illustrative local identity values*, not claims about either real
aircraft. Replace them with identity fields from a fleet you are authorized
to review. Do not include aircraft owners, customer names, contact details,
addresses, quoted values or extra columns.

The reader canonicalizes N-numbers, rejects duplicates and malformed CSV,
and limits a run to **ten unique N-numbers**. Missing identity fields are
allowed but flagged as unverified; no fuzzy matching or record joining occurs.

## Default dry run: no network, no credentials

From this repository root:

```bash
node examples/aircraft-fleet-drift-review/run.mjs \
  --input ./my-known-fleet.csv
```

This validates your local input and reports the worst-case request budget,
with **no API requests and no files written**.

## Explicit live review

Get a Free API key through the [Aircraft API page](https://grizzlybulls.com/aircraft-api)
and keep it in your private terminal environment:

```bash
export GRIZZLY_BULLS_API_KEY='your-private-key'
node examples/aircraft-fleet-drift-review/run.mjs \
  --input ./my-known-fleet.csv \
  --live \
  --output ./private-fleet-drift-report.json
```

Live mode makes **exactly two logical API reads per known N-number** in the
normal successful path: one current-record lookup and one history request
with `versionsLimit=10`, `eventsLimit=10`, offsets `0`. The current-record
helper may make bounded retries on documented 429/503 responses; no
unbounded retry or registry enumeration is allowed. Calls are sequential
and spaced at least 2.2 seconds apart for Free's 30-requests/minute limit.
Ten aircraft ordinarily consume 20 metered requests, out of the Free
1,000/month allocation. An error aborts instead of returning a deceptively
complete report.

The report is created locally with restrictive permissions (0600 where
supported) and **will not overwrite** an existing file. The program
does not print aircraft identity fields or an API key to the terminal.
Only a vetted subset of local identity, publicly allowed current fields,
FAA source-retrieval time, and PII-free observed event metadata is written.
Upstream registrant information and retained versions are discarded.

## How to interpret outcomes

| Outcome | Meaning |
| --- | --- |
| `matches_current_observation` | All three supplied local identity fields match current public FAA fields after case/space normalization, **as of the source snapshot**; no ownership or completeness claim |
| `identity_conflict_needs_review` | At least one manufacturer/model/serial field differs; do **not** automatically overwrite the local aircraft record or claim N-number reuse |
| `identity_incomplete_needs_review` | A local or current field is missing and cannot be compared |
| `no_current_registration_found` | Current exact lookup returned no registered record; does **not** mean legal N-number availability, aircraft disposal, or a confirmed deregistration |

Each row also shows a **bounded recent event sample**. Its
`moreEventsAvailable` flag indicates when that first page is incomplete.
Even a page with no remaining events is not proof that the full pre-baseline
FAA history was captured. `observedAt` is Grizzly Bulls observation time,
not the date of a transaction, and a nullable source-effective date remains
unknown unless supplied.

This prototype intentionally does **not** make a public lifecycle-status
request or claim continuity across historical N-number assignments. It does
not read old owner data or perform a 100-aircraft fleet-wide scrape. An
operator should review conflicts against authoritative source evidence
before modifying maintenance, insurance, or fleet-master records.

## Run the offline tests

```bash
node --test examples/aircraft-fleet-drift-review/*.test.mjs
```

Tests use mocked API responses and synthetic identifiers; no key, network
connection, or billable API use is required.

For signed notifications after intake, see the separate
[webhook receiver](../aircraft-webhook-receiver/README.md). Live watches are
paid; this Free read-based review does not create one.
