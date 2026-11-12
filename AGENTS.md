# KynSight Agent Guide

## Mission

KynSight is a demo compliance-screening aid for brokers and underwriters. A user submits a company number; KynSight retrieves Companies House officer and PSC collections, screens relevant people through Vett, and returns a structured report for human review.

The report must keep these categories separate:

- verified company facts
- sanctions/watchlist screening findings
- unknowns and operational failures
- questions requiring human review

This is not proof of wrongdoing and must not make automated sanctions, insurance, acceptance, or rejection decisions. Build the smallest credible working prototype that demonstrates careful API integration, explicit uncertainty/failure handling, and production-minded judgement at demo scale. Do not add features outside this scope.

## Scope And Flow

```text
Company number -> Companies House officer/PSC collections -> Vett screening queue -> structured human-review report
```

The prototype should make real upstream requests and expose the integration seams clearly. It uses process-local assessment state and has no runtime AI dependency.

Primary upstream endpoints:

- Companies House officers: `GET https://api.company-information.service.gov.uk/company/{companyNumber}/officers`
- Companies House PSCs: `GET https://api.company-information.service.gov.uk/company/{companyNumber}/persons-with-significant-control`
- Vett: `POST https://global-sanctions-export-control-screener.p.rapidapi.com/screen/all`

Vett accepts one name per request. The documented free-tier limits are 10 requests per minute and 100 per month; the local queue must process as much as possible, queue the remainder, preserve successful results, and expose a clear top-level `PENDING` state with per-subject `QUEUED`/`IN_PROGRESS` states when work cannot finish immediately.

## Non-Negotiable Decisions

- Prefer high maintainability and low complexity. Design for a production version, but implement only demo-scale scope.
- Handle HTTP, network, timeout, rate-limit, and malformed-response failures explicitly at the upstream boundary. Treat failures as data throughout the application.
- Do not identify a person by name alone. Compare roles and source records. Filter a duplicate before screening only when identity is reliable; otherwise report a `potential duplicate` for human review.
- Retry only transient failures: `429`, `5xx`, network errors, and timeouts. Do not retry authentication or validation errors.
- Preserve completed Vett results if later requests fail.
- Keep source facts, inferences, possible matches, failures, and unknowns distinguishable in types and output.
- Keep credentials out of source code, logs, fixtures, screenshots, and commits. Use environment variables and redact sensitive values.

## Agent Working Method

1. Read this guide and the relevant repository documentation before changing code.
2. Verify external API assumptions against current provider documentation. Mark anything not verified in code or documentation rather than presenting it as fact.
3. Before a major implementation change, state the proposed approach, trade-offs, and any decision needing approval.
4. Make the smallest incremental change that satisfies the current scope.
5. Add focused tests for normal behaviour and important failure paths, especially retries, rate limits, partial results, identity ambiguity, and malformed upstream data.
6. Run the relevant tests, type checks, and build after changes. Report commands that could not run and why.
7. Do not silently broaden scope or replace human review with an automated judgement.

## Stack And Verification

The intended stack is TypeScript on Node.js 24, npm, native Node `http`/built-in `fetch`, Vitest, `tsx`, strict TypeScript, and process-local state.

Expected repository commands:

```sh
npm test
npm run typecheck
npm run build
```

The current repository has no `package.json` or application source yet, so these commands are intended checks rather than currently verified commands. Do not claim a check passed unless it was run successfully.

## Repository Map

- `AGENTS.md`: durable instructions, scope, architecture, and remaining verification risks for coding agents.
- `docs/roadmap.md`: implementation checklist and current delivery order; update it when project direction changes.
- `README.md`: recommended destination for setup, usage, copy/paste examples, example responses, and a short workflow explanation once implementation exists.
- `docs/assignment-writeup.md`: user-owned, no-write file for the user's personal use only. Do not create, edit, or populate it unless the user explicitly asks in a later request.
- `docs/prompt-history.txt`: command for exporting sanitized prompt history after the work is complete.

Keep implementation-specific API examples and detailed product specification out of this guide; put them in the README. Do not write assignment material to `docs/assignment-writeup.md` without explicit user instruction.

## Remaining Verification Risks

The v0 contract is frozen in `docs/archive/vett-contract-v0.md`. These are implementation and provider-verification risks, not open design questions:

- The current notes say the UK sanctions dataset is not working and international datasets are used for the demo. This is an unverified external-service assumption and must be rechecked against current Vett behaviour before implementation or presentation; production use requires reliable UK sanctions coverage.
- The Companies House and Vett request examples, threshold semantics, free-tier limits, and demo-company outcomes should be verified against current provider documentation before being treated as stable integration contracts.
