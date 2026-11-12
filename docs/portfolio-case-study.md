# KynSight: Integration Service Case Study

KynSight is a small TypeScript/Node service built to explore a realistic integration workflow: use a Companies House company number to identify relevant officers and persons with significant control, screen selected people through Vett, and return a report that a human can review.

This is a demo screening aid, not a compliance decision engine. It does _not_ decide whether a person or company should be accepted, rejected, or insured, nor act as evidence of any wrongdoing.

For more information, see the main [README.md](../README.md)

## The problem

A screening workflow has to combine records from one source with a separate provider's name-matching service. The difficult part is not making two HTTP requests, but deciding which people should be screened, preserving where each record came from, handling incomplete control information, and making upstream failures visible without turning them into a misleading negative result.

## The implemented flow

```text
company number
  -> Companies House officer and PSC collections
  -> source-aware subject selection
  -> bounded Vett queue
  -> validated screening result or explicit failure
  -> structured human-review report
```

The current implementation uses the Companies House officer and PSC collection endpoints. The company number scopes the assessment; KynSight does not currently fetch the separate Companies House company-profile endpoint.

## Engineering decisions

- **Keep source facts separate from screening findings.** Corporate PSC records that are not recursively resolved remain visible as unresolved control-chain information, _not_ treated an individual result.
- **Use source-aware identity metadata.** Selected subjects retain roles, source references and selection reasons. A director fallback is labelled as such, and is never presented as a confirmed PSC.
- **Treat upstream work as asynchronous.** The local queue bounds active assessments and queued subjects, preserves completed results, honours retry delays where available, and exposes `PENDING` progress while work remains.
- **Retry only transient failures.** Network errors, timeouts, `429` responses and `5xx` responses are retryable; authentication, validation and malformed successful responses are _not_ silently retried.
- **Validate provider responses at the boundary.** An empty validated response may become `NO_MATCH`; malformed or contradictory data becomes an explicit error and is _not_ downgraded to a false negative.
- **Keep the prototype honest about its scope.** Assessment state is process-local, so a restart can lose queued and completed state. Durable storage, authentication, observability, and a production compliance policy are outside the demo scope.

## Evidence in the repository

- HTTP boundary: `src/http/server.ts`
- Companies House client and pagination: `src/companies-house/client.ts`
- Source-aware subject selection: `src/subjects/extract.ts`
- Queue, retries and rate limits: `src/assessment/queue.ts`
- Provider response validation: `src/vett/adapter.ts`
- Assessment state and public snapshots: `src/assessment/store.ts` and `src/assessment/types.ts`
- Failure-path and integration-boundary tests: `test/`

Run the checks locally with:

```sh
npm ci
npm test
npm run typecheck
npm run build
```

The tests use mocked upstream responses and fake clocks where timing and provider limits are involved, so they do not require credentials.

## What this demonstrates

KynSight is evidence of typed API integration, explicit failure modelling, queue and rate-limit design, testable service boundaries, and documentation that distinguishes verified results from unknowns.

## Limits and next steps

At this stage, KynSight is a demo of the integration and workflow, _not_ a production compliance system. Before relying on it for real compliance needs, I would recheck the Companies House and Vett contracts against their current documentation and live responses — especially the schemas, limits, coverage, and match behaviour. A production version would also need persistent state and restart recovery, authentication and authorisation, structured logging and metrics, a clearly defined compliance policy, and a more authoritative screening data source.
