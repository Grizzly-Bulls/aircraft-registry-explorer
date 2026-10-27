# Review observed registry changes for a known fleet

This dependency-free Node.js 24 example helps flight-school, maintenance, and aviation-software developers review **observed FAA registration changes** for up to ten aircraft already in their system. It consumes the existing [Aircraft Intelligence API](https://grizzlybulls.com/aircraft-api) retained-history endpoint. It does not download FAA data, track beneficial ownership, collect registrant PII, or offer a new aircraft-history data service.

Unlike the [current fleet-enrichment starter](../aircraft-fleet-onboarding/README.md), this example inspects observed change events rather than refreshing make/model details. Unlike the [signed webhook receiver](../aircraft-webhook-receiver/README.md), it needs no paid watch, webhook endpoint, or public server. It intentionally **does not** page through full history: it shows at most ten events per aircraft and reports whether more are available.

## Offline dry run

From the repository root:

~~~bash
node examples/aircraft-fleet-history-review/run.mjs \
  --input examples/aircraft-fleet-onboarding/sample.csv
~~~

The fleet starter's sample is an exact one-column CSV with header nNumber; this example shares its strict input validation and N-number normalization. It accepts no additional columns or free-form query filters. The dry run makes **zero** API requests and reports the number that live mode would make.

## Live review with a Free key

Create a key at the [Aircraft API page](https://grizzlybulls.com/aircraft-api) and keep it in your private terminal environment:

~~~bash
export GRIZZLY_BULLS_API_KEY='your-private-key'

node examples/aircraft-fleet-history-review/run.mjs \
  --input examples/aircraft-fleet-onboarding/sample.csv \
  --live \
  --output ./local-fleet-history-review.json
~~~

The --live flag is always required. The CLI fetches exactly one history response per unique input, with independent versions/events pagination each set to limit 10 and offset 0. **Only the event page is projected.** Upstream version rows and registrant data are never exported. Live requests are sequential and spaced at least 2.2 seconds apart to respect Free's 30 RPM limit; this example does not retry uncertain requests. Free is a bounded evaluation tier, not authorization to enumerate the registry.

The output is a new, owner-only local JSON file (mode 0600 where supported) that will **not overwrite** an existing file. It contains only reviewed fields:

~~~json
{
  "schemaVersion": "aircraft-fleet-history-review-example-v1",
  "interpretation": "Observed FAA snapshot history, not legal ownership or transaction dates",
  "eventsAreBounded": true,
  "rows": [
    {
      "nNumber": "N172SP",
      "status": "observed_events_found",
      "eventCountShown": 1,
      "totalObservedEventsReported": 14,
      "moreEventsAvailable": true,
      "events": [
        {
          "eventType": "registration_record_changed",
          "observedAt": "2026-10-25T01:20:00.000Z",
          "sourceEffectiveDate": null,
          "changedFields": ["aircraft_model"]
        }
      ]
    }
  ]
}
~~~

This is **illustrative fixture data**, not a statement about N172SP. The flags and counts distinguish the first bounded event page from a complete historical record. A no_retained_history_found result means the history endpoint returned no retained record; it **never** means the N-number is legally available, that the FAA has no record, or that a registration has been canceled. A no_observed_events_in_retained_history result means the returned first event page was empty.

The API's observedAt describes observation between accepted FAA snapshots, **not the actual date of an ownership transaction or registration change**. A sourceEffectiveDate may be absent and must not be inferred. Events such as registrant_changed are privacy-safe event categories, not a basis for reconstructing current-withheld owner names or addresses. Do not ingest full upstream versions as a shortcut.

## Test locally without an API key

~~~bash
node --test examples/aircraft-fleet-history-review/*.test.mjs
~~~

Tests use synthetic in-memory upstream responses. They check exact input/caps, one call per known N-number, output projection, withheld PII exclusion, pagination incompleteness, bad contracts, 404/auth outcomes, and default offline behavior.

For complete history, production scheduling, persisted checkpoints, alerts, or incident/CRM integrations, build those as a separate reviewed integration using the [published OpenAPI contract](https://api.grizzlybulls.com/v1/openapi). This sample deliberately avoids a database, local history authority, unbounded pagination, and any inference about legal ownership.
