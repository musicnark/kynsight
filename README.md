# KynSight

KynSight is a demo compliance-screening aid for brokers and underwriters. It retrieves company, officer, and persons-with-significant-control (PSC) records from Companies House, screens relevant people through Vett, and returns a structured report for human review.

KynSight is not proof of wrongdoing and does not make automated sanctions, insurance, acceptance, or rejection decisions.

## Integration Endpoints

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

## Request Examples

Set `COMPANIES_HOUSE_API_KEY` and `RAPIDAPI_KEY` in the environment before running these examples. Do not commit credentials or include them in logs, fixtures, screenshots, or reports.

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
  --data '{"name":"POTANIN, Vladimir","threshold":85}'
```

## Demo Companies

This company returns a positive match in the current demo data:

```text
https://api.company-information.service.gov.uk/company/11564549/officers
```

This company does not return a positive match in the current demo data:

```text
https://api.company-information.service.gov.uk/company/04092583/officers
```

Demo outcomes and upstream behaviour must be rechecked against current provider responses before being treated as stable.

## API Examples

### Companies House (Officers)

E.g.,
```text
GET: https://api.company-information.service.gov.uk/company/04092583/officers
```

#### Succesful Responses

```json
{
  "active_count": 4,
  "etag": "34fbaac554a88b663ce847e53dcead20741ed6e8",
  "items": [
    {
      "etag": "34fbaac554a88b663ce847e53dcead20741ed6e8",
      "address": {
        "address_line_1": "100 New London Road",
        "country": "United Kingdom",
        "locality": "Chelmsford",
        "postal_code": "CM2 0RG",
        "premises": "1st Floor County House",
        "region": "Essex"
      },
      "appointed_on": "2000-10-18",
      "is_pre_1992_appointment": false,
      "country_of_residence": "England",
      "date_of_birth": {
        "month": 9,
        "year": 1980
      },
      "links": {
        "self": "/company/04092583/appointments/hV1_dP1m-YVi0iqDUfuKr5vwA88",
        "officer": {
          "appointments": "/officers/ZRyC2paUG5Ib8faowIg165pLg78/appointments"
        }
      },
      "name": "BISHOP, Adam Roy",
      "nationality": "British",
      "officer_role": "director",
      "person_number": "68324340004",
      "identity_verification_details": {
        "appointment_verification_end_on": "9999-12-31",
        "appointment_verification_start_on": "2026-11-09"
      }
    },
    {
      "etag": "787a48a7a9acd7aca7c06917022abd72cac902ab",
      "address": {
        "address_line_1": "100 New London Road",
        "country": "United Kingdom",
        "locality": "Chelmsford",
        "postal_code": "CM2 0RG",
        "premises": "1st Floor County House",
        "region": "Essex"
      },
      "appointed_on": "2024-01-24",
      "is_pre_1992_appointment": false,
      "country_of_residence": "United Kingdom",
      "date_of_birth": {
        "month": 8,
        "year": 1977
      },
      "links": {
        "self": "/company/04092583/appointments/I2x4RM65h-0d8cngTNrHFIP9d9w",
        "officer": {
          "appointments": "/officers/trN4OFd8TCPnr7U0mOSVQ3q-a-k/appointments"
        }
      },
      "name": "BLOCH, Nathan, Mr.",
      "nationality": "British",
      "officer_role": "director",
      "person_number": "256167250002",
      "identity_verification_details": {
        "appointment_verification_end_on": "9999-12-31",
        "appointment_verification_start_on": "2026-11-09"
      }
    },
    {
      "etag": "d16750a19ebd51197831d8cafbf65dfc1159ad44",
      "address": {
        "address_line_1": "100 New London Road",
        "country": "United Kingdom",
        "locality": "Chelmsford",
        "postal_code": "CM2 0RG",
        "premises": "1st Floor County House",
        "region": "Essex"
      },
      "appointed_on": "2021-01-21",
      "is_pre_1992_appointment": false,
      "country_of_residence": "United Kingdom",
      "date_of_birth": {
        "month": 3,
        "year": 1987
      },
      "links": {
        "self": "/company/04092583/appointments/__3us32AN-P055-du4NysXveKpM",
        "officer": {
          "appointments": "/officers/K9pSTIIoO9Pe5hieiRmofkQILGg/appointments"
        }
      },
      "name": "COWLING, Simon",
      "nationality": "British",
      "officer_role": "director",
      "person_number": "279063080001",
      "identity_verification_details": {
        "appointment_verification_end_on": "9999-12-31",
        "appointment_verification_start_on": "2026-11-09"
      }
    },
    {
      "etag": "133f2da9ba245d9fe6163d63c770e163d66feef7",
      "address": {
        "address_line_1": "100 New London Road",
        "country": "United Kingdom",
        "locality": "Chelmsford",
        "postal_code": "CM2 0RG",
        "premises": "1st Floor County House",
        "region": "Essex"
      },
      "appointed_on": "2024-01-24",
      "is_pre_1992_appointment": false,
      "country_of_residence": "England",
      "date_of_birth": {
        "month": 9,
        "year": 1983
      },
      "links": {
        "self": "/company/04092583/appointments/OQPhNyO7LR7LosPqulGPuehrVzw",
        "officer": {
          "appointments": "/officers/7rHx3Wb-awd9C-j0xtMKBZ9dxpQ/appointments"
        }
      },
      "name": "MAKH, Suniel Singh",
      "nationality": "British",
      "officer_role": "director",
      "person_number": "245295100002",
      "identity_verification_details": {
        "appointment_verification_end_on": "9999-12-31",
        "appointment_verification_start_on": "2026-11-09"
      }
    },
    {
      "etag": "8c86e5f6d5bfa012a3a36afa50d3b858c7a97987",
      "address": {
        "address_line_1": "252 Maplin Way North",
        "locality": "Southend On Sea",
        "postal_code": "SS1 3NT",
        "region": "Essex"
      },
      "appointed_on": "2000-10-18",
      "is_pre_1992_appointment": false,
      "links": {
        "self": "/company/04092583/appointments/gBYXS1SkYlnKZRPL-AXD380vt7g",
        "officer": {
          "appointments": "/officers/7G9BWrZ-4FjaVi2Wetr3xQ_2dWs/appointments"
        }
      },
      "name": "BISHOP, Rowland Roy",
      "nationality": "British",
      "officer_role": "secretary",
      "resigned_on": "2021-03-10",
      "person_number": "69279260001"
    },
    {
      "etag": "5a3d56e5dee2b7d0ef6ac5e89684cbf4c9c92fdd",
      "address": {
        "address_line_1": "25 Hill Road",
        "address_line_2": "Theydon Bois",
        "locality": "Epping",
        "postal_code": "CM16 7LX",
        "region": "Essex"
      },
      "appointed_on": "2000-10-18",
      "is_pre_1992_appointment": false,
      "links": {
        "self": "/company/04092583/appointments/LTMsYjogjdFhW0OdBvSMj7LlAb8",
        "officer": {
          "appointments": "/officers/fK3CeAyC04VjYkiOCFNfE_Kw3Ug/appointments"
        }
      },
      "name": "THEYDON SECRETARIES LIMITED",
      "officer_role": "corporate-nominee-secretary",
      "resigned_on": "2000-10-18",
      "person_number": "900011300001"
    },
    {
      "etag": "531808bd3f87b4a64bc21502199d2fe04b608403",
      "address": {
        "country": "England",
        "locality": "Southend On Sea",
        "postal_code": "SS1 3NT",
        "premises": "252 Maplin Way North",
        "region": "Essex"
      },
      "appointed_on": "2015-04-16",
      "is_pre_1992_appointment": false,
      "country_of_residence": "England",
      "date_of_birth": {
        "month": 12,
        "year": 1951
      },
      "links": {
        "self": "/company/04092583/appointments/WTANpmKbKScQPSvVyiIXgCj4sIg",
        "officer": {
          "appointments": "/officers/7G9BWrZ-4FjaVi2Wetr3xQ_2dWs/appointments"
        }
      },
      "name": "BISHOP, Rowland Roy",
      "nationality": "British",
      "officer_role": "director",
      "resigned_on": "2021-03-10",
      "person_number": "69279260001"
    },
    {
      "etag": "9149b608cb1f8d946c5b8fcf12e09124d908e725",
      "address": {
        "address_line_1": "100 New London Road",
        "country": "United Kingdom",
        "locality": "Chelmsford",
        "postal_code": "CM2 0RG",
        "premises": "1st Floor County House",
        "region": "Essex"
      },
      "appointed_on": "2015-06-04",
      "is_pre_1992_appointment": false,
      "country_of_residence": "England",
      "date_of_birth": {
        "month": 6,
        "year": 1960
      },
      "links": {
        "self": "/company/04092583/appointments/NGQSsp2KxSzCcFADDDZKYfdMKs8",
        "officer": {
          "appointments": "/officers/82VfzSVxaTnsqQSbJAOdaWLzM-U/appointments"
        }
      },
      "name": "KIPPIN, Colin",
      "nationality": "British",
      "officer_role": "director",
      "resigned_on": "2026-01-06",
      "person_number": "199132790003",
      "identity_verification_details": {
        "appointment_verification_statement_due_on": "2026-10-29"
      }
    },
    {
      "etag": "d04e846667cfcf9c1046638d434046d515600ae8",
      "address": {
        "address_line_1": "19 Clifftown Road",
        "country": "United Kingdom",
        "locality": "Southend-On-Sea",
        "postal_code": "SS1 1AB",
        "premises": "1st Floor",
        "region": "Essex"
      },
      "appointed_on": "2021-01-21",
      "is_pre_1992_appointment": false,
      "country_of_residence": "United Kingdom",
      "date_of_birth": {
        "month": 5,
        "year": 1970
      },
      "links": {
        "self": "/company/04092583/appointments/UouS18xpSq2d-MVwdC-fUI5odRU",
        "officer": {
          "appointments": "/officers/c7ga19LCbWRA1V_F9mtIYzNQaJg/appointments"
        }
      },
      "name": "NEAL, Sean",
      "nationality": "British",
      "officer_role": "director",
      "resigned_on": "2024-08-30",
      "person_number": "279063090001"
    },
    {
      "etag": "3b2fbb4325c376e7ec1afaef67cac34fd9b223f0",
      "address": {
        "locality": "Southend On Sea",
        "postal_code": "SS1 1EH",
        "premises": "7 Nelson Street",
        "region": "Essex"
      },
      "appointed_on": "2015-12-09",
      "is_pre_1992_appointment": false,
      "country_of_residence": "United Kingdom",
      "date_of_birth": {
        "month": 7,
        "year": 1969
      },
      "links": {
        "self": "/company/04092583/appointments/1gib9s_YIKa9SwHqmZ1kgrgbb74",
        "officer": {
          "appointments": "/officers/R52zz4wwnvq7h1Nl2_5ZZdGVoug/appointments"
        }
      },
      "name": "PRICE, John Barry",
      "nationality": "British",
      "officer_role": "director",
      "resigned_on": "2020-01-23",
      "person_number": "91636770001"
    },
    {
      "etag": "37384188f53146e4bff852eecf3e22097414b4fb",
      "address": {
        "address_line_1": "25 Hill Road",
        "address_line_2": "Theydon Bois",
        "locality": "Epping",
        "postal_code": "CM16 7LX",
        "region": "Essex"
      },
      "appointed_on": "2000-10-18",
      "is_pre_1992_appointment": false,
      "links": {
        "self": "/company/04092583/appointments/NQrLQ-UL9XIWwlzjd4Ta7bIDKag",
        "officer": {
          "appointments": "/officers/ErqAB1SjwinvXO9y-aUGFwK67yA/appointments"
        }
      },
      "name": "THEYDON NOMINEES LIMITED",
      "officer_role": "corporate-nominee-director",
      "resigned_on": "2000-10-18",
      "person_number": "900010330001"
    }
  ],
  "items_per_page": 35,
  "kind": "officer-list",
  "links": {
    "self": "/company/04092583/officers"
  },
  "resigned_count": 7,
  "inactive_count": 0,
  "start_index": 0,
  "total_results": 11
}
```

#### Empty Responses
```json
{
  "active_count": 0,
  "etag": "",
  "items": [],
  "items_per_page": 35,
  "kind": "officer-list",
  "links": {},
  "resigned_count": 0,
  "inactive_count": 0,
  "start_index": 0,
  "total_results": 0
}
```

#### Error Responses
```json
{
  "timestamp": "2026-11-10T09:24:21.990451753",
  "message": "No static resource company/05092583/officer for request '/company/05092583/officer'.",
  "request_id": "ci5aafwvOHy-tnB0sSwrNDN-kYUl"
}
```

### Vett

E.g.,
```sh
curl --request POST \
  --url https://global-sanctions-export-control-screener.p.rapidapi.com/screen/all \
  --header "Content-Type: application/json" \
  --header "x-rapidapi-host: global-sanctions-export-control-screener.p.rapidapi.com" \
  --header "x-rapidapi-key: $RAPIDAPI_KEY" \
  --data '{"name":"POTANIN, Vladimir","threshold":85}'
```

#### Succesful Responses
```json
{
  "input": "POTANIN, Vladimir",
  "is_match": true,
  "matches": [
    {
      "list_name": "OFAC",
      "name": "Vladimir Olegovich Potanin",
      "score": 90,
      "source": "OFAC_SDN",
      "entity_type": "Individual",
      "programs": [
        "RUSSIA-EO14024"
      ]
    },
    {
      "list_name": "CSL",
      "name": "Potanin Vladimir Olegovich",
      "score": 90,
      "source": "Specially Designated Nationals (SDN) - Treasury Department",
      "entity_type": "Individual",
      "programs": [
        "RUSSIA-EO14024"
      ]
    },
    {
      "list_name": "AUSTRALIA_DFAT",
      "name": "Vladimir Olegovich Potanin",
      "score": 90,
      "source": "Autonomous (Russia) - 2022-04-06",
      "entity_type": "Person",
      "programs": []
    },
    {
      "list_name": "OFAC",
      "name": "Vladimir Putin",
      "score": 86,
      "source": "OFAC_SDN",
      "entity_type": "Individual",
      "programs": [
        "RUSSIA-EO14024"
      ]
    },
    {
      "list_name": "CSL",
      "name": "Putin Vladimir",
      "score": 86,
      "source": "Specially Designated Nationals (SDN) - Treasury Department",
      "entity_type": "Individual",
      "programs": [
        "RUSSIA-EO14024"
      ]
    }
  ],
  "list_dates": {
    "OFAC": "2026-11-10",
    "UK_OFSI": "2026-11-09",
    "UN_SC": "2026-11-10",
    "CSL": "unknown",
    "EU_FSF": "2026-11-10",
    "CANADA_SEMA": "2026-11-09",
    "AUSTRALIA_DFAT": "2026-11-10"
  },
  "screened_at": "2026-11-10T09:26:21Z"
}
```

#### Empty Responses
```json
{
  "input": "BISHOP, Adam Roy",
  "is_match": false,
  "matches": [],
  "list_dates": {
    "OFAC": "2026-11-10",
    "UK_OFSI": "2026-11-09",
    "UN_SC": "2026-11-10",
    "CSL": "unknown",
    "EU_FSF": "2026-11-10",
    "CANADA_SEMA": "2026-11-09",
    "AUSTRALIA_DFAT": "2026-11-10"
  },
  "screened_at": "2026-11-10T09:27:21Z"
}
```

#### Error Responses
```json
{
  "detail": [
    {
      "type": "string_too_short",
      "loc": [
        "body",
        "name"
      ],
      "msg": "String should have at least 1 character",
      "input": "",
      "ctx": {
        "min_length": 1
      }
    }
  ]
}
```

```json
{
  "detail": [
    {
      "type": "greater_than_equal",
      "loc": [
        "body",
        "threshold"
      ],
      "msg": "Input should be greater than or equal to 50",
      "input": -1,
      "ctx": {
        "ge": 50
      }
    }
  ]
}
```

```json
{
  "detail": [
    {
      "type": "less_than_equal",
      "loc": [
        "body",
        "threshold"
      ],
      "msg": "Input should be less than or equal to 100",
      "input": 99999999,
      "ctx": {
        "le": 100
      }
    }
  ]
}
```

```json
{
  "detail": [
    {
      "type": "missing",
      "loc": [
        "body",
        "name"
      ],
      "msg": "Field required",
      "input": {}
    }
  ]
}
```

```json
{
  "message": "You have exceeded the rate limit per minute for your plan, BASIC, by the API provider"
}
```

## Vett Assessment Contract (v0)

This is the frozen v0 contract for the KynSight assessment response. The mandatory automated test matrix below is part of the contract. Implementation may revise this contract only when a concrete implementation result, test result, or verified provider response exposes a problem.

The live RapidAPI response shown in the Vett examples above is authoritative for the adapter. It accepts only the exact `input`, `is_match`, `matches`, `list_dates`, and `screened_at` response shape shown there; `PENDING` is a KynSight-local queue state, not a Vett job state. Vett HTTP error responses are handled by the client and are never passed to the successful-response adapter.

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

### Assessment Identity And Requests

The system should expose one assessment request operation; a separate status or polling endpoint is not required for demo scope.

```json
{
  "companyNumber": "04092583",
  "assessmentId": "optional-existing-assessment-id",
  "idempotencyKey": "client-generated-key-for-this-user-action",
  "refresh": false
}
```

Draft behaviour:

- The first request creates a server-generated `assessmentId`.
- `refresh` defaults to `false`. Without refresh, the operation retrieves the current/latest assessment for the company and advances queued work where possible.
- `refresh: true` starts a new assessment run and returns a new `assessmentId`.
- Repeating the same `idempotencyKey` with the same request, including a refresh request, returns the same assessment and must not create duplicate Vett requests.
- Supplying an existing `assessmentId` returns its current snapshot and advances queued work where possible, unless `refresh: true` explicitly requests a new run.
- If no key is supplied, an active assessment for the same company and screening policy should be reused as a defensive fallback.

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
- an assessment that cannot be recovered after restart returns `ERROR` with `ASSESSMENT_NOT_FOUND`; and
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
| Assessment cannot be recovered (`ASSESSMENT_NOT_FOUND`) | `404 Not Found` |
| Queue capacity exceeded | `503 Service Unavailable` |
| Unexpected or other KynSight failure | `500 Internal Server Error` |

Additional rules:

- Every response includes the JSON assessment `status` where an assessment exists, plus structured error details where applicable.
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
  "assessmentId": "asmt_123",
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
  "assessmentId": "asmt_456",
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
  "assessmentId": "asmt_789",
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
  "assessmentId": "asmt_999",
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

#### Assessment Not Found

```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "assessmentId": "asmt_missing",
  "status": "ERROR",
  "partial": false,
  "assessmentError": {
    "code": "ASSESSMENT_NOT_FOUND",
    "message": "The assessment could not be recovered from process-local state.",
    "retryable": true
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
| T05 | Assessment cannot be recovered after process-local restart                           | `404 Not Found`; `Content-Type: application/json`                                                                                         | `status: ERROR`; `ASSESSMENT_NOT_FOUND`; no fabricated screening results                                                                                                                         |
| T06 | Active and queued assessment/subject capacity is full                                | `503 Service Unavailable`; `Content-Type: application/json`; include `Retry-After` only when KynSight knows a reliable retry interval     | `status: ERROR`; `QUEUE_CAPACITY_EXCEEDED`; `retryable: true`; error details explain that capacity is full                                                                                       |
| T07 | Short-term Vett rate limit                                                           | Initial snapshot uses `202 Accepted` and `Content-Type: application/json`; no extra rate-limit header is assumed unless KynSight owns one | Subject remains `QUEUED`; `status: PENDING`; `retryable: true`; `nextAttemptAt` is present when known; no `NO_MATCH` result; fake-clock advancement causes the retry and eventual completion     |
| T08 | Vett `5xx` with retry then success or exhausted retry budget                         | Assert the appropriate `202`/`200` snapshot status and `Content-Type: application/json` at each request                                   | `Retry-After` is respected when supplied; after exhausted retries, the subject has a terminal error while other subjects continue; a fully terminal assessment is `COMPLETE` and `partial: true` |
| T09 | Vett returns a malformed successful response                                         | `200 OK`; `Content-Type: application/json` when the assessment otherwise reaches terminal state                                           | Affected subject has `VETT_MALFORMED_RESPONSE`; no retry; no `NO_MATCH` outcome is produced                                                                                                      |
| T10 | Longer queue across multiple rate-limit windows                                      | Use a test-only queue-cap override to simulate 50 and 100 subjects, mocked Vett responses, and a fake clock; make no real Vett requests   | Assert at most 10 request starts per rolling 60-second window, correct queue progression, preserved results, and final `COMPLETE`/`partial` body semantics; the live cap remains 20              |
| T11 | Invalid client input                                                                 | `400 Bad Request`; `Content-Type: application/json`                                                                                       | Structured validation error details; no assessment is started and no Vett request is made                                                                                                        |
| T12 | Unexpected KynSight failure                                                          | `500 Internal Server Error`; `Content-Type: application/json`                                                                             | Safe structured error details; no credentials, raw provider payloads, or internal stack traces are exposed                                                                                       |

The live queue configuration remains `MAX_ACTIVE_ASSESSMENTS = 1`, `MAX_QUEUED_ASSESSMENTS = 2`, and `MAX_QUEUED_VETT_SUBJECTS = 20`. Test-only overrides must be explicit and isolated from production configuration.
