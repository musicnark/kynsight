## Vett Assessment Contract (v0)

This is the frozen v0 contract for the KynSight assessment response. The mandatory automated test matrix below is part of the contract. Implementation may revise this contract only when a concrete implementation result, test result, or verified provider response exposes a problem.

The response shape exercised by the Vett adapter tests contains exactly `input`, `is_match`, `matches`, `list_dates`, and `screened_at`; `PENDING` is a KynSight-local queue state, not a Vett job state. The sample provider payloads in `README.md` are documentation fixtures, not evidence of current live results. Current provider behavior and coverage remain verification risks. Vett HTTP error responses are handled by the client and are never passed to the successful-response adapter.

### Subject Selection

KynSight retrieves current Companies House officers and PSC records, then applies this selection policy:

- Screen individual PSCs when individual PSC records are available.
- If both individual and corporate PSCs exist, screen the individual PSCs only. Do not add director fallback.
- If no individual PSCs are available and one or more corporate PSC records exist, screen current directors as a clearly labelled fallback.
- Do not recursively resolve corporate PSCs into their directors or PSCs. That control-chain feature is out of scope for this version.
- Preserve corporate PSC records as source facts and report `CORPORATE_CONTROL_CHAIN_UNRESOLVED` for human review.
- Never label a director fallback as a confirmed PSC.
- If there are corporate PSCs but no current directors, report that no fallback subjects were available.
- If there are no individual or corporate PSC records, do not invent a PSC subject or apply director fallback under this policy.

Each selected subject should retain source-based identity and selection metadata:

```json
{
  "subjectId": "officer:appointment-id",
  "subjectType": "DIRECTOR_FALLBACK",
  "name": "Example Director",
  "roles": ["director"],
  "confirmedPsc": false,
  "selectionReason": "CORPORATE_PSC_FALLBACK",
  "sourceRefs": ["companies-house:officer:appointment-id"]
}
```

The corporate PSC remains a separate source record and is not a screened individual:

```json
{
  "sourceRef": "companies-house:psc:corporate-id",
  "subjectType": "CORPORATE_PSC",
  "name": "Example Holdings Ltd",
  "screened": false,
  "resolution": "OUT_OF_SCOPE",
  "reason": "Corporate control chain was not recursively resolved."
}
```

### Assessment Requests

The system should expose one assessment request operation; a separate status or polling endpoint is not required for demo scope.

```json
{
  "companyNumber": "04092583",
  "threshold": 85,
  "refresh": false
}
```

Draft behaviour:

- The first request creates an internal assessment record. The public response does not expose its process-local identifier.
- `threshold` is optional and defaults to `85`. It must be an integer from `50` through `100`.
- `refresh` defaults to `false`. Without refresh, the operation retrieves the latest assessment for the company, preserves its stored threshold, and re-enqueues pending work where possible.
- A successful `refresh: true` request creates a new internal assessment record. It is added before the response is returned and becomes the latest assessment for that company immediately, including while its status is `PENDING`. Repeating a `refresh: true` request intentionally creates another assessment. The earlier assessment remains unchanged.
- If queue admission fails, the request returns `503` without adding a new assessment record.
- A later `refresh: false` request returns the refreshed record, including its stored threshold and current pending state.
- A supplied threshold is used when creating a new assessment. It does not change the threshold of a reused assessment.

Before a name is sent to Vett, KynSight removes supported leading and trailing titles (`Mr`, `Mrs`, `Ms`, `Miss`, `Mx`, `Dr`, `Prof`, `Professor`, `Rev`, `Reverend`, `Sir`, `Dame`, `Lord`, `Lady`, `Hon`, `Judge`, `Capt`, `Captain`, `Col`, `Colonel`, `Maj`, `Major`, `Gen`, `General`, and `Lt`/`Lieutenant`), ignoring case and surrounding punctuation, and collapses repeated whitespace. The original Companies House name remains in the assessment subject.

### Lifecycle States

The top-level status is one of:

- `PENDING`: at least one subject is queued, in progress, or waiting for retry. Partial results may be present.
- `COMPLETE`: every selected subject has a terminal outcome: successful result, permanent per-subject error, or explicit skip. Use `partial: true` when one or more subjects did not produce a successful screening result.
- `ERROR`: an assessment-level failure means KynSight cannot produce a valid report, such as failed company retrieval, unrecoverable integration configuration, lost process state, or malformed critical source data. A permanent error for one or more subjects does not promote the assessment to `ERROR`.

`COMPLETE` does not mean every name screened successfully. It means every selected subject has a terminal outcome, even when the report is partial.

```json
{
  "partial": true,
  "progress": {
    "total": 3,
    "terminal": 1,
    "successful": 1,
    "failed": 0,
    "queued": 1,
    "inProgress": 1
  }
}
```

### Partial Results

Return the complete assessment envelope for `PENDING`, `COMPLETE`, and `ERROR` responses.

- Preserve completed subject results when later Vett calls fail.
- Include queued and in-progress subjects rather than omitting them.
- Include per-subject errors where screening cannot complete.
- Never convert a missing or malformed Vett result into `NO_MATCH`.
- Set `partial: true` when results are incomplete, subject errors exist, corporate control is unresolved, or an assessment-level error contains preserved data.

Unresolved corporate control is an explicit report limitation. It is not a person to be screened, a failed individual screening, or a `NO_MATCH` result. Represent it in the report's unresolved limitations, separate from the selected subjects and their screening outcomes.

### Per-Name Errors

Classify errors by scope:

- Subject-specific failures remain attached to that subject and must not block other screenings. Examples include a name-specific validation failure, a timeout after retry, a network failure after retry, or a malformed response for one Vett call.
- Provider-wide authentication or configuration failures are assessment-level errors. Stop remaining screenings, preserve any completed results, and return `status: ERROR` with the assessment-level failure.
- A provider failure is assessment-level only when it indicates a shared integration problem. Otherwise, attach it to the affected subject after the retry policy is exhausted.
- Short-term rate limiting is normally not a terminal error. Keep the affected subject queued with a retry time and continue other eligible work when possible.

Use normalized application errors and do not expose credentials, authorization headers, or uncontrolled provider response bodies:

```json
{
  "screening": {
    "status": "ERROR",
    "error": {
      "code": "VETT_TIMEOUT",
      "message": "Vett did not respond before the screening timeout.",
      "retryable": false,
      "attempts": 3
    }
  }
}
```

Provider-wide failure example:

```json
{
  "status": "ERROR",
  "error": {
    "code": "VETT_AUTHENTICATION",
    "message": "The Vett integration could not authenticate. Remaining screenings were not attempted.",
    "retryable": false,
    "scope": "ASSESSMENT"
  }
}
```

Initial error codes may include `VETT_AUTHENTICATION`, `VETT_CONFIGURATION`, `VETT_VALIDATION`, `VETT_RATE_LIMITED`, `VETT_TIMEOUT`, `VETT_NETWORK`, `VETT_UPSTREAM`, `VETT_MALFORMED_RESPONSE`, `QUEUE_CAPACITY_EXCEEDED`, `COMPANIES_HOUSE_UNAVAILABLE`, `COMPANIES_HOUSE_MALFORMED_RESPONSE`, and `ASSESSMENT_NOT_FOUND`.

### Queue And Rate Limiting

The local scheduler should:

- issue one Vett request per name;
- count retries as requests against the quota;
- enforce no more than 10 request starts in any rolling 60-second period;
- use one worker for demo scope;
- allow one active assessment at a time;
- allow up to two assessments waiting behind the active assessment;
- allow up to 20 queued Vett subject requests globally;
- queue requests beyond the minute limit rather than reject them;
- keep a subject in `QUEUED` state after a short-term `429`, with `retryable: true` and a `nextAttemptAt` when known;
- honour `Retry-After` when Vett provides it;
- use bounded exponential backoff with jitter when no retry delay is provided; and
- track the monthly 100-request budget locally, including retries.

The monthly limit is different from the minute limit. If the monthly budget is exhausted, the remaining subjects should not be queued indefinitely without an ETA. Where no reset time is known, return terminal per-subject `VETT_RATE_LIMITED` errors with `retryable: true` and require a later assessment request.

These prototype limits should be centralised configuration constants or settings, not scattered literals:

```text
MAX_ACTIVE_ASSESSMENTS = 1
MAX_QUEUED_ASSESSMENTS = 2
MAX_QUEUED_VETT_SUBJECTS = 20
```

The live/demo cap is 20 queued Vett subject requests globally. If a configured queue limit is exceeded, fail explicitly with `QUEUE_CAPACITY_EXCEEDED`; do not silently drop names.

The client can experience the workflow as asynchronous without another endpoint: the request returns `PENDING` while the single local worker continues processing the active assessment. Additional assessments wait in the bounded assessment queue.

Automated queue tests should simulate longer queues of 50 or 100 subjects using mocked Vett responses and a fake clock. Those tests must exercise multiple rate-limit windows without consuming real Vett requests and do not change the live/demo cap of 20.

### Timeout, Restart, And Malformed Responses

The prototype's initial application policy is:

- 10-second timeout per Vett request, exposed as a configurable setting such as `VETT_REQUEST_TIMEOUT_MS = 10000`;
- three total attempts for network errors, timeouts, `429`, and `5xx`;
- configurable retry limit, exposed as a setting such as `VETT_MAX_ATTEMPTS = 3`;
- for `429` and `5xx`, honour `Retry-After` when provided;
- when no retry delay is provided, use bounded exponential backoff with jitter;
- do not retry authentication, validation, or malformed-response errors;
- malformed 2xx responses become `VETT_MALFORMED_RESPONSE`, never `NO_MATCH`;
- failure to retrieve or safely parse critical Companies House records becomes assessment-level `ERROR`; and
- completed subject results are preserved after later failures.

Because assessment state is process-local:

- a process restart may lose queued work and completed assessment state;
- the contract must not claim durable recovery or background processing after restart.

The JSON assessment `status` is the domain contract and must be present in every assessment response. HTTP status codes are transport-level signals only; clients must not infer detailed assessment state from HTTP codes alone. The exact mappings are defined below.

### HTTP Status Mapping

The transport-level HTTP status should accompany the JSON assessment status and any structured error details in the response body:

| Condition | HTTP status |
| --- | --- |
| Assessment is queued or still processing (`status: PENDING`) | `202 Accepted` |
| Assessment reached terminal subject outcomes (`status: COMPLETE`) | `200 OK` |
| Assessment-level upstream failure (`status: ERROR`) | `502 Bad Gateway` |
| Invalid client input | `400 Bad Request` |
| Unsupported route or method | `404 Not Found` |
| Queue capacity exceeded | `503 Service Unavailable` |
| Unexpected or other KynSight failure | `500 Internal Server Error` |

Additional rules:

- Every response includes the JSON assessment `status` where an assessment exists, plus structured error details where applicable.
- Assessment request bodies larger than 1,000,000 bytes return `400 Bad Request` with `INVALID_REQUEST` and do not start an assessment.
- A valid assessment with per-subject failures remains `status: COMPLETE`, `partial: true`, and `200 OK`.
- Queue-capacity responses should include `Retry-After` when a meaningful retry interval is known.
- HTTP status codes do not replace the JSON domain status or error code.

### Normalized Vett Results

Vett-specific response fields should be mapped through a dedicated adapter into a small KynSight result vocabulary:

- `NO_MATCH`: only when Vett returns an explicit, validated negative result.
- `POSSIBLE_MATCH`: only when Vett returns an explicit, validated possible-match or match finding that requires human review.

Vett does not currently provide a verified inconclusive state in the response contract used by KynSight, and inferring such a state is outside of the scope of v0. So, v0 does not expose `INDETERMINATE`. Valid borderline matches remain `POSSIBLE_MATCH` for human review. Missing, malformed, or contradictory data remains an explicit screening error, and must not be mapped to either outcome.

Missing, malformed, or otherwise schema-invalid Vett data must remain an explicit screening error. It must never be mapped to `NO_MATCH`. The adapter should preserve enough validated provider evidence and source metadata for human review without exposing an uncontrolled provider payload as the public contract.

### Example Responses

The Vett response shape above is authoritative. The `outcome` values below are KynSight-normalized values derived only from a fully validated Vett response.

#### Pending: Corporate PSC Fallback

```http
HTTP/1.1 202 Accepted
Content-Type: application/json

{
  "companyNumber": "04092583",
  "status": "PENDING",
  "partial": true,
  "subjectSelection": {
    "individualPscCount": 0,
    "corporatePscCount": 1,
    "fallbackUsed": true,
    "directorFallbackUsed": true,
    "corporateControlChainResolved": false
  },
  "unresolved": [
    {
      "code": "CORPORATE_CONTROL_CHAIN_UNRESOLVED",
      "message": "A corporate PSC was identified. KynSight does not recursively resolve its directors or PSCs.",
      "sourceRefs": ["companies-house:psc:corporate-id"]
    }
  ],
  "subjects": [
    {
      "subjectId": "officer:abc",
      "subjectType": "DIRECTOR_FALLBACK",
      "name": "Example Director",
      "roles": ["director"],
      "confirmedPsc": false,
      "selectionReason": "CORPORATE_PSC_FALLBACK",
      "screening": { "status": "IN_PROGRESS" }
    }
  ]
}
```

#### Complete: Individual And Corporate PSCs

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "companyNumber": "04092583",
  "status": "COMPLETE",
  "partial": true,
  "subjectSelection": {
    "individualPscCount": 1,
    "corporatePscCount": 1,
    "fallbackUsed": false,
    "directorFallbackUsed": false,
    "corporateControlChainResolved": false
  },
  "unresolved": [
    {
      "code": "CORPORATE_CONTROL_CHAIN_UNRESOLVED",
      "message": "The individual PSC was screened. The corporate PSC chain was not resolved.",
      "sourceRefs": ["companies-house:psc:corporate-id"]
    }
  ],
  "subjects": [
    {
      "subjectId": "psc:individual-id",
      "subjectType": "INDIVIDUAL_PSC",
      "name": "Example PSC",
      "roles": ["psc"],
      "confirmedPsc": true,
      "selectionReason": "INDIVIDUAL_PSC",
      "screening": {
        "status": "COMPLETE",
        "outcome": "POSSIBLE_MATCH"
      }
    }
  ]
}
```

This case must not contain a `DIRECTOR_FALLBACK` subject.

#### Complete: Corporate PSC Fallback With Results

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "companyNumber": "04092583",
  "status": "COMPLETE",
  "partial": true,
  "subjectSelection": {
    "individualPscCount": 0,
    "corporatePscCount": 1,
    "fallbackUsed": true,
    "directorFallbackUsed": true,
    "corporateControlChainResolved": false
  },
  "unresolved": [
    {
      "code": "CORPORATE_CONTROL_CHAIN_UNRESOLVED",
      "message": "The screened directors are fallback subjects, not confirmed PSCs.",
      "sourceRefs": ["companies-house:psc:corporate-id"]
    }
  ],
  "subjects": [
    {
      "subjectId": "officer:abc",
      "subjectType": "DIRECTOR_FALLBACK",
      "name": "Example Director",
      "roles": ["director"],
      "confirmedPsc": false,
      "selectionReason": "CORPORATE_PSC_FALLBACK",
      "screening": {
        "status": "COMPLETE",
        "outcome": "NO_MATCH"
      }
    }
  ]
}
```

#### Failed: Preserved Fallback Data

```http
HTTP/1.1 502 Bad Gateway
Content-Type: application/json

{
  "companyNumber": "04092583",
  "status": "ERROR",
  "partial": true,
  "subjectSelection": {
    "individualPscCount": 0,
    "corporatePscCount": 1,
    "fallbackUsed": true,
    "directorFallbackUsed": true,
    "corporateControlChainResolved": false
  },
  "unresolved": [
    {
      "code": "CORPORATE_CONTROL_CHAIN_UNRESOLVED",
      "message": "The corporate control chain was not resolved."
    }
  ],
  "subjects": [
    {
      "subjectId": "officer:abc",
      "subjectType": "DIRECTOR_FALLBACK",
      "name": "Example Director",
      "roles": ["director"],
      "confirmedPsc": false,
      "selectionReason": "CORPORATE_PSC_FALLBACK",
      "screening": {
        "status": "COMPLETE",
        "outcome": "NO_MATCH"
      }
    }
  ],
  "assessmentError": {
    "code": "VETT_AUTHENTICATION",
    "message": "The Vett integration could not authenticate. Remaining screenings were not attempted.",
    "retryable": false
  }
}
```

#### Queue Capacity Exceeded

When KynSight knows a reliable retry interval, it includes `Retry-After`. The value below is illustrative; the header is omitted when no reliable interval is available.

```http
HTTP/1.1 503 Service Unavailable
Content-Type: application/json
Retry-After: 30

{
  "status": "ERROR",
  "partial": false,
  "assessmentError": {
    "code": "QUEUE_CAPACITY_EXCEEDED",
    "message": "The assessment and subject queues are currently full.",
    "retryable": true
  }
}
```

### Mandatory Automated Test Matrix

Every scenario must assert the HTTP status, the response headers that KynSight owns, and the JSON response body. All JSON responses must include `Content-Type: application/json`. Queue and rate-limit scenarios must use mocked Vett responses and a fake clock; they must not consume real Vett requests.

| ID  | Scenario                                                                             | Required HTTP assertions                                                                                                                  | Required JSON assertions                                                                                                                                                                         |
|-----|--------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| T01 | Assessment has queued or in-progress subjects                                        | `202 Accepted`; `Content-Type: application/json`                                                                                          | `status: PENDING`; progress counts; selected subjects retain `QUEUED` or `IN_PROGRESS` state; completed subjects remain present                                                                  |
| T02 | All selected subjects complete successfully                                          | `200 OK`; `Content-Type: application/json`                                                                                                | `status: COMPLETE`; `partial: false`; every selected subject has a terminal successful result                                                                                                    |
| T03 | All selected subjects reach terminal state with one or more permanent subject errors | `200 OK`; `Content-Type: application/json`                                                                                                | `status: COMPLETE`; `partial: true`; errors remain attached to affected subjects; no assessment-level error is created                                                                           |
| T04 | Assessment-level Companies House or provider configuration failure                   | `502 Bad Gateway`; `Content-Type: application/json`                                                                                       | `status: ERROR`; assessment-level error code and details; any completed subject results are preserved                                                                                            |
| T05 | Unsupported route or method                                                          | `404 Not Found`; `Content-Type: application/json`                                                                                         | `status: ERROR`; `NOT_FOUND`; safe structured error details                                                                                                                                      |
| T06 | Active and queued assessment/subject capacity is full                                | `503 Service Unavailable`; `Content-Type: application/json`; include `Retry-After` only when KynSight knows a reliable retry interval     | `status: ERROR`; `QUEUE_CAPACITY_EXCEEDED`; `retryable: true`; error details explain that capacity is full                                                                                       |
| T07 | Short-term Vett rate limit                                                           | Initial snapshot uses `202 Accepted` and `Content-Type: application/json`; no extra rate-limit header is assumed unless KynSight owns one | Subject remains `QUEUED`; `status: PENDING`; `retryable: true`; `nextAttemptAt` is present when known; no `NO_MATCH` result; fake-clock advancement causes the retry and eventual completion     |
| T08 | Vett `5xx` with retry then success or exhausted retry budget                         | Assert the appropriate `202`/`200` snapshot status and `Content-Type: application/json` at each request                                   | `Retry-After` is respected when supplied; after exhausted retries, the subject has a terminal error while other subjects continue; a fully terminal assessment is `COMPLETE` and `partial: true` |
| T09 | Vett returns a malformed successful response                                         | `200 OK`; `Content-Type: application/json` when the assessment otherwise reaches terminal state                                           | Affected subject has `VETT_MALFORMED_RESPONSE`; no retry; no `NO_MATCH` outcome is produced                                                                                                      |
| T10 | Longer queue across multiple rate-limit windows                                      | Use a test-only queue-cap override to simulate 50 and 100 subjects, mocked Vett responses, and a fake clock; make no real Vett requests   | Assert at most 10 request starts per rolling 60-second window, correct queue progression, preserved results, and final `COMPLETE`/`partial` body semantics; the live cap remains 20              |
| T11 | Invalid client input                                                                 | `400 Bad Request`; `Content-Type: application/json`                                                                                       | Structured validation error details; no assessment is started and no Vett request is made                                                                                                        |
| T12 | Unexpected KynSight failure                                                          | `500 Internal Server Error`; `Content-Type: application/json`                                                                             | Safe structured error details; no credentials, raw provider payloads, or internal stack traces are exposed                                                                                       |

The live queue configuration remains `MAX_ACTIVE_ASSESSMENTS = 1`, `MAX_QUEUED_ASSESSMENTS = 2`, and `MAX_QUEUED_VETT_SUBJECTS = 20`. Test-only overrides must be explicit and isolated from production configuration.
