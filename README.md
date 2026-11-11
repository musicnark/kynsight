# KynSight

KynSight is a demo compliance-screening aid for brokers and underwriters. It retrieves company, officer, and persons-with-significant-control (PSC) records from Companies House, screens relevant people through Vett, and returns a structured report for human review.

KynSight is not proof of wrongdoing and does not make automated sanctions, insurance, acceptance, or rejection decisions.

## Integration endpoints

KynSight integrates with [Companies House](https://find-and-update.company-information.service.gov.uk/) and [Vett](https://rapidapi.com/Gorp405/api/global-sanctions-export-control-screener). The specific endpoints are as follows:

Companies House company data:

```text
GET https://api.company-information.service.gov.uk/company/{COMPANY_NUMBER}
```

Companies House PSC data:

```text
GET https://api.company-information.service.gov.uk/company/{COMPANY_NUMBER}/persons-with-significant-control
```

Companies House officer data:

```text
GET https://api.company-information.service.gov.uk/company/{COMPANY_NUMBER}/officers
```

Vett screening:

```text
POST https://global-sanctions-export-control-screener.p.rapidapi.com/screen/all
```

## Test the integration endpoints

Set `COMPANIES_HOUSE_API_KEY` and `RAPIDAPI_KEY` in the environment before running these examples. Do _not_ commit credentials or include them in logs, fixtures, screenshots, or reports.

Fetch PSC records from Companies House:

```sh
curl --user "$COMPANIES_HOUSE_API_KEY:" \
  -H "Accept: application/json" \
  https://api.company-information.service.gov.uk/company/04092583/persons-with-significant-control
```

Screen one person through Vett:

```sh
curl --request POST \
  --url https://global-sanctions-export-control-screener.p.rapidapi.com/screen/all \
  --header "Content-Type: application/json" \
  --header "x-rapidapi-host: global-sanctions-export-control-screener.p.rapidapi.com" \
  --header "x-rapidapi-key: $RAPIDAPI_KEY" \
  --data '{"name":"Vladimir Potanin","threshold":85}'
```

## Getting started

### Prerequisites

Use Node.js 24 and npm. The repository contains a `package-lock.json`, so `npm ci` is the preferred reproducible installation. Use `npm install` when you need npm to resolve or update dependencies locally.

You will also need to provide API keys for both [Companies House](https://find-and-update.company-information.service.gov.uk/) and [Vett](https://rapidapi.com/Gorp405/api/global-sanctions-export-control-screener).

Companies House does not charge for access to their API. Vett allows free access with up to 10 requests per minute, 100 per month.

### Configure the environment

Copy `.env.example` to `.env` and replace the placeholders with credentials supplied through your normal secret-management process:

```text
PORT=3000
COMPANIES_HOUSE_API_KEY={your_real_companies_house_key}
RAPIDAPI_KEY={your_real_rapidapi_key}
```

Do not commit `.env`, credentials, authorization headers, provider response bodies containing secrets, or credentials in logs, fixtures, screenshots, or reports.

### Install and run

```sh
npm ci
npm run dev
```

`npm run dev` loads `.env`, watches `src/index.ts`, and serves on `PORT` or port `3000` by default.

### Run checks

```sh
npm test
npm run typecheck
npm run build
```

The queue and integration tests use mocked upstream responses and fake clocks where timing or provider limits are involved. They do not require live credentials.

### Verify the service

You can conduct a health check via:

```sh
curl http://localhost:3000/
```

### Run a company assessment

Start an assessment with `curl`:

```sh
curl --request POST \
  --url http://localhost:3000/assessments \
  --header "Content-Type: application/json" \
  --data '{"companyNumber":"11564549"}'
```

The expected response is `"status":"PENDING"`:

```json
{
  "companyNumber": "11564549",
  "threshold": 85,
  "status": "PENDING",
  "partial": true,
  "progress": {
    "total": 1,
    "terminal": 0,
    "successful": 0,
    "queued": 0,
    "inProgress": 1
  },
  "subjectSelection": {
    "individualPscCount": 1,
    "corporatePscCount": 0,
    "fallbackUsed": false,
    "directorFallbackUsed": false,
    "corporateControlChainResolved": false
  },
  "unresolved": [],
  "corporatePscRecords": [],
  "unknownPscRecords": [],
  "subjects": [
    {
      "subjectId": "psc:9dzOWfHBj3fJGausOUqOMxlSwKE",
      "subjectType": "INDIVIDUAL_PSC",
      "name": "Mr Vladamir Potanin",
      "roles": [
        "psc"
      ],
      "confirmedPsc": true,
      "selectionReason": "INDIVIDUAL_PSC",
      "sourceRefs": [
        "companies-house:psc:9dzOWfHBj3fJGausOUqOMxlSwKE"
      ],
      "screening": {
        "status": "IN_PROGRESS",
        "attempts": 1
      }
    }
  ]
}
```

Check the status of your assessment by requesting the endpoint again:

```sh
curl --request POST \
  --url http://localhost:3000/assessments \
  --header "Content-Type: application/json" \
  --data '{"companyNumber":"11564549"}'
```

If an assessment is partially complete (because multiple people are being assessed and/or hitting temporary rate limits), the expected response will be:

```json
{
  "companyNumber": "09446231",
  "threshold": 85,
  "status": "PENDING",
  "partial": true,
  "progress": {
    "total": 8,
    "terminal": 0,
    "successful": 0,
    "queued": 7,
    "inProgress": 1
  },
  "subjectSelection": { ... },
  "unresolved": [ ... ],
  "corporatePscRecords": [ ... ],
  "unknownPscRecords": [ ... ],
  "subjects": [ ... ]
}
```

> [!NOTE]
> This response is shortened for readability.

When complete, the expected response is `"status":"COMPLETE"`:

```json
{
  "companyNumber": "11564549",
  "threshold": 85,
  "status": "COMPLETE",
  "partial": false,
  "progress": {
    "total": 1,
    "terminal": 1,
    "successful": 1,
    "queued": 0,
    "inProgress": 0
  },
  "subjectSelection": {
    "individualPscCount": 1,
    "corporatePscCount": 0,
    "fallbackUsed": false,
    "directorFallbackUsed": false,
    "corporateControlChainResolved": false
  },
  "unresolved": [],
  "corporatePscRecords": [],
  "unknownPscRecords": [],
  "subjects": [
    {
      "subjectId": "psc:9dzOWfHBj3fJGausOUqOMxlSwKE",
      "subjectType": "INDIVIDUAL_PSC",
      "name": "Mr Vladamir Potanin",
      "roles": [
        "psc"
      ],
      "confirmedPsc": true,
      "selectionReason": "INDIVIDUAL_PSC",
      "sourceRefs": [
        "companies-house:psc:9dzOWfHBj3fJGausOUqOMxlSwKE"
      ],
      "screening": {
        "status": "COMPLETE",
        "attempts": 1,
        "result": {
          "input": "Vladamir Potanin",
          "outcome": "NO_MATCH",
          "matches": [],
          "listDates": {
            "OFAC": "2026-11-10",
            "UK_OFSI": "2026-11-10",
            "UN_SC": "2026-11-10",
            "CSL": "unknown",
            "EU_FSF": "2026-11-10",
            "CANADA_SEMA": "2026-11-10",
            "AUSTRALIA_DFAT": "2026-11-10"
          },
          "screenedAt": "2026-11-10T16:35:09Z"
        }
      }
    }
  ]
}
```

You can `refresh` an assignment to re-assess a company, and/or assign a custom Vett `threshold`:

```sh
curl --request POST \
  --url http://localhost:3000/assessments \
  --header "Content-Type: application/json" \
  --data '{"companyNumber":"11564549", "refresh":true, "threshold":75}'
```

The Vett `threshold` determines the fuzziness of the search; a lower score will search for related or similar names, a higher score will be stricter.

The expected response from this particular request returns a `POSSIBLE_MATCH`:

```json
{
  "companyNumber": "11564549",
  "threshold": 75,
  "status": "COMPLETE",
  "partial": false,
  "progress": {
    "total": 1,
    "terminal": 1,
    "successful": 1,
    "queued": 0,
    "inProgress": 0
  },
  "subjectSelection": {
    "individualPscCount": 1,
    "corporatePscCount": 0,
    "fallbackUsed": false,
    "directorFallbackUsed": false,
    "corporateControlChainResolved": false
  },
  "unresolved": [],
  "corporatePscRecords": [],
  "unknownPscRecords": [],
  "subjects": [
    {
      "subjectId": "psc:9dzOWfHBj3fJGausOUqOMxlSwKE",
      "subjectType": "INDIVIDUAL_PSC",
      "name": "Mr Vladamir Potanin",
      "roles": [
        "psc"
      ],
      "confirmedPsc": true,
      "selectionReason": "INDIVIDUAL_PSC",
      "sourceRefs": [
        "companies-house:psc:9dzOWfHBj3fJGausOUqOMxlSwKE"
      ],
      "screening": {
        "status": "COMPLETE",
        "attempts": 1,
        "result": {
          "input": "Vladamir Potanin",
          "outcome": "POSSIBLE_MATCH",
          "matches": [
            {
              "listName": "OFAC",
              "name": "Vladimir Putin",
              "score": 80,
              "source": "OFAC_SDN",
              "entityType": "Individual",
              "programs": [
                "RUSSIA-EO14024"
              ]
            },
            {
              "listName": "UK_OFSI",
              "name": "Vladimir Putin",
              "score": 80,
              "source": "The Russia (Sanctions) (EU Exit) Regulations 2019",
              "entityType": "Individual",
              "programs": []
            },
            {
              "listName": "CSL",
              "name": "Putin Vladimir",
              "score": 80,
              "source": "Specially Designated Nationals (SDN) - Treasury Department",
              "entityType": "Individual",
              "programs": [
                "RUSSIA-EO14024"
              ]
            },
            {
              "listName": "AUSTRALIA_DFAT",
              "name": "Vladimir Plotnikov",
              "score": 76,
              "source": "Autonomous (Ukraine) - 2022-02-26",
              "entityType": "Person",
              "programs": []
            },
            {
              "listName": "AUSTRALIA_DFAT",
              "name": "Vladimir Konstantinov",
              "score": 75,
              "source": "Autonomous (Ukraine) - 2023-06-10",
              "entityType": "Person",
              "programs": []
            }
          ],
          "listDates": {
            "OFAC": "2026-11-10",
            "UK_OFSI": "2026-11-10",
            "UN_SC": "2026-11-10",
            "CSL": "unknown",
            "EU_FSF": "2026-11-10",
            "CANADA_SEMA": "2026-11-10",
            "AUSTRALIA_DFAT": "2026-11-10"
          },
          "screenedAt": "2026-11-10T16:34:29Z"
        }
      }
    }
  ]
}
```

## Demo companies
You can supply any valid company number, but here's a few to get you started:

- `04092583` - good first choice to test it's working
- `11564549` - with `"threshold":75`, this returns a `POSSIBLE_MATCH`, showing the intended use case
- `09446231` - a company with numerous people to be checked, good for testing queue/polling behaviour.

## Technical overview

### Problem and workflow

KynSight is a demo compliance-screening aid for brokers and underwriters. The workflow is:

```text
company number
  -> Companies House officers and PSC collections
  -> subject selection with source and role metadata
  -> one Vett request per selected person
  -> normalized screening result or explicit error
  -> structured report for human review
```

The report separates company source facts, screening findings, unresolved control-chain information, operational failures, and questions requiring human review. It is not proof of wrongdoing and does not make automated sanctions, insurance, acceptance, or rejection decisions.

### Runtime data flow

`POST /assessments` is handled by `src/http/server.ts`, which parses the JSON body and delegates to `AssessmentService`. `AssessmentService` validates the company number, threshold, and refresh flag, then either reuses the latest company-scoped record or extracts current Companies House officers and PSCs. `src/subjects/service.ts` fetches the officer and PSC collections concurrently and `src/subjects/extract.ts` applies the selection policy. The service stores an internal assessment record, enqueues selected subjects, and returns a public snapshot.

`VettQueue` runs the local worker. It selects eligible queued subjects, calls `VettClient`, retries only retryable failures, and passes successful bodies through `normalizeVettResponse`. The adapter rejects malformed, contradictory, unexpected, or mismatched-name responses rather than treating them as `NO_MATCH`.

### Public response and internal storage

These are deliberately different boundaries:

- The public `AssessmentSnapshot` contains `companyNumber`, the stored `threshold`, domain `status`, `partial`, progress, subject-selection summaries, unresolved findings, corporate and unknown PSC records, selected subjects, screening states, and an optional assessment-level error. It does not expose the process-local `assessmentId` or fingerprint.
- The internal `AssessmentRecord` contains `assessmentId`, normalized `companyNumber`, `threshold`, request fingerprint, source selection, mutable subject screening state, status, assessment error, and creation time.
- `AssessmentStore` keeps records in a process-local map and an insertion-order list. `latestForCompany()` searches that order from newest to oldest and filters by normalized company number.
- A refresh-created assessment is a new internal record. It does not mutate the earlier record. The new record becomes the latest record immediately, including while its status is `PENDING`.

### Latest reuse and refresh

`refresh` defaults to `false`.

- `refresh: false` returns the latest assessment for the normalized company number when it is not eligible for a monthly-budget retry. If it is pending, the service re-enqueues it before returning the current snapshot.
- `refresh: true` skips latest reuse, extracts the current source records, creates a new internal assessment record, and enqueues it when subjects exist.
- A later `refresh: false` request returns that new record, including its stored threshold and current pending state.
- A supplied threshold applies when creating a new record. It does not change the threshold of a reused record.
- A monthly-budget error becomes eligible for a fresh assessment only after its recorded retry time has been reached.
- If queue admission fails, the service returns `503` and does not add a new assessment record.

The final Vett-pipeline diff (`f7afcac`, covering `src/assessment/service.ts`, `src/assessment/store.ts`, `src/assessment/queue.ts`, the Vett client/types, and the assessment tests) is the implementation evidence for this behavior. The exact original production reproduction is not present in the repository, so the root-cause description below is an evidence-backed inference rather than a claim about an unrecorded request.

### Queue, retry, and rate limits

The demo queue uses these code-level defaults from `src/assessment/queue.ts`:

| Setting                                |     Default |
|----------------------------------------|------------:|
| Active assessments                     |         `1` |
| Queued assessments                     |         `2` |
| Non-terminal queued subjects           |        `20` |
| Vett request starts per rolling minute |        `10` |
| Vett requests per UTC month            |       `100` |
| Maximum attempts                       |         `3` |
| Vett request timeout                   | `10,000 ms` |

The queue counts retries against the request budgets. It respects a numeric `Retry-After` value when provided and otherwise uses bounded exponential backoff with jitter. Network errors, timeouts, `429`, and `5xx` responses are retryable. Authentication, validation, and malformed successful responses are not retryable. Completed subject results remain in the assessment when later work fails.

When the local monthly budget is exhausted, remaining non-terminal subjects become explicit `VETT_RATE_LIMITED` subject errors with the next UTC month start as `nextAttemptAt`. A later request can create a fresh assessment once the retry time is reached.

### HTTP behavior

Every response is JSON with `Content-Type: application/json`:

| Condition                                              | HTTP status |
|--------------------------------------------------------|------------:|
| Pending or in-progress assessment                      |       `202` |
| Complete assessment, including terminal subject errors |       `200` |
| Assessment-level Companies House or Vett failure       |       `502` |
| Invalid JSON or request fields                         |       `400` |
| Unsupported route or method                            |       `404` |
| Queue capacity exceeded                                |       `503` |
| Unexpected KynSight failure                            |       `500` |

The JSON domain status remains authoritative for assessment state. HTTP status is the transport signal and does not replace structured error fields.

### Verified facts, inference, and open questions

Verified facts are implementation and test observations. Inferred findings describe what the final Vett-pipeline diff indicates but do not claim an absent historical reproduction. Open questions are not presented as stable product behavior.

**Verified facts**

- Officer and PSC collections are required before subject selection; the assessment service does not call the Companies House company-profile endpoint.
- Individual PSCs are screened when available; corporate PSCs remain separate unresolved source records; directors can be selected as a clearly labelled fallback when no individual PSCs are available.
- Public snapshots omit `assessmentId`; internal records retain it for process-local storage and lookup.
- Repeated `refresh: false` requests reuse the latest company-scoped assessment, including pending records.
- Repeated `refresh: true` requests create separate internal records.
- Vett matches are normalized to `POSSIBLE_MATCH`; explicit empty validated results become `NO_MATCH`; malformed or contradictory responses become `VETT_MALFORMED_RESPONSE`.
- The previous design coupled reuse to caller-visible or caller-managed identity paths and that delayed retries could prevent other eligible subjects from progressing. The current design removes that public coupling and scans eligible subjects across queued assessments. This inference is supported by the changed service/queue/store code and the added regression tests, but the repository does not contain the original incident request.

**Open questions and limitations**

- Assessment and queue state are process-local. A restart can lose queued work and completed assessment state.
- There is no separate assessment status endpoint; the request returns the current snapshot.
- Current provider schema, threshold semantics, free-tier limits, UK sanctions coverage, and demo-company outcomes must be rechecked against provider documentation and live behavior before presentation or production use.
- The existing API examples include provider-shaped sample payloads, but they are not evidence of current results for the documented demo companies.
- The public documentation should not claim durable recovery, automated decisions, or verified provider coverage until those capabilities are implemented and verified.

## Evidence table

| Documentation claim                                              | Evidence reference                                                                                                                                                                   |
|------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Public assessment response omits `assessmentId`                  | `src/assessment/types.ts` (`AssessmentSnapshot`); `src/assessment/store.ts` (`snapshot()`); `test/assessment-service.test.ts` and `test/assessment-http.test.ts` assert it is absent |
| Internal records retain IDs and mutable state                    | `src/assessment/types.ts` (`AssessmentRecord`); `src/assessment/store.ts` (`records`, `order`, `get()`)                                                                              |
| Latest reuse is company-scoped                                   | `src/assessment/service.ts` (`latestForCompany()` call); `src/assessment/store.ts`; `test/assessment-service.test.ts` checks independent companies                                   |
| `refresh: true` creates a distinct latest record                 | `src/assessment/service.ts` (`refresh` branch and `store.add()`); `test/assessment-service.test.ts` covers repeated refreshes and pending refresh reuse                              |
| Stored threshold is preserved on reuse                           | `src/assessment/service.ts`, `src/assessment/store.ts`; `test/assessment-service.test.ts` checks thresholds `85` and `75`                                                            |
| Queue defaults and retry behavior                                | `src/assessment/queue.ts`; `test/assessment-queue.test.ts` and `test/assessment-http.test.ts` cover rolling limits, delayed retries, 5xx retries, and long mocked queues             |
| Vett request shape, threshold forwarding, timeout, and redaction | `src/vett/client.ts`; `test/vett-client.test.ts`                                                                                                                                     |
| Strict Vett response normalization                               | `src/vett/adapter.ts`; `test/vett-adapter.test.ts`                                                                                                                                   |
| HTTP routes and status mapping                                   | `src/http/server.ts`; `test/assessment-http.test.ts`                                                                                                                                 |
| Environment variables and npm commands                           | `.env.example`, `src/index.ts`, and `package.json`                                                                                                                                   |
| Documentation migration and final pipeline scope                 | `git show f7afcac --stat`; current `README.md`, `docs/vett-contract-v0.md`, and the `AGENTS.md` contract-path update                                                                 |

## Archive documentation

The v0 contract is maintained in [`docs/archive/vett-contract-v0.md`](docs/archive/vett-contract-v0.md). That document records the contract and mandatory test matrix; this README records the confirmed post-code implementation behavior, setup workflow, evidence references, and remaining verification risks.

[Integration API examples](docs/archive/integration-api-examples.md) can also be found in the archive, which were used as response shapes to build tests around.
