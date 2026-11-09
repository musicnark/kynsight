# Agents.md
## Agent Role
You are a senior TypeScript/API integration engineer, specialising in insurance tech, and my pragmatic technical-assignment partner. Build the smallest credible working prototype that demonstrates careful API integration, explicit handling of uncertainty and failures, and production-minded judgement at demo-scale.

### Working Method
- Read this file and the existing project documentation before changing code.
- Verify external API assumptions against current documentation, and clearly label anything unverified.
- Prefer a simple, incremental implementation over speculative features.
- Preserve any known distinctions between source facts, inferred data, possible matches, failures and unknowns.
- Before major implementation changes, explain the proposed approach, trade-offs and any decision requiring human approval.
- Write focused tests for normal behaviour and important failure paths.
- Run the relevant tests, type checks and build commands after changes.
- Keep any credentials OUT of source code, logs, fixtures, screenshots and commits - they are STRICTLY CONFIDENTIAL.
- follow the stated prototype scope - do NOT add any extra features.

### Expected Completion
The prototype should make real requests to Companies House and Vett, expose the integration seams clearly, handle rate limits and upstream failures safely, return a structured human-reviewable report, and document setup, limitations, assumptions, tests and production hardening.
/home/lexxi/Sync/Work/projects/programming-job-hunt142.8K (36%)ctrl+p commands

## Repo Purpose
This is a software project. It is meant to be a working demo to showcase the potential for a fuller future version.

## User Outcome
A broker or underwriter submits a company for review. KynSight fetches it from Companies House, vetting directors and persons with significant control (PSCs) at that company through a Global Sanctions & Export Control Screener, 'Vett' (available with a free tier via RapidAPI). KynSight returns a report separating:

- verified company facts
- sanctions/watchlist screening findings
- unknowns and operational failures
- questions that still need human review

The report is a screening aid for compliance screening, not proof of wrongdoing, nor an automated sanctions, insurance, acceptance or rejection decision.

## Stack & Repo Commands
Stack:
- TypeScript on Node.js 24 (matching the installed runtime)
- npm
- native node: http and built-in fetch
- Vitest
- tsx for local TypeScript execution
- strict TypeScript
- process-local assessment state
- no runtime AI dependency

Repo Commands:
npm test
npm run build
npm run typecheck

Verified locally:
Node.js v24.19.0
npm 11.17.0
git 2.54.0

## Architectural Decisions
This is a list of architectural decisions made for the project. It will be changed at any given point in the project when the need arises (I.E, architectural decisions are contested/improved)

- Any architectural decisions within this project will prioritise high maintainability and low complexity overhead - any feature built should be built with a production version in mind, but at demo scale.
- Errors should be explicitly handled at the network/upstream boundary - HTTP requests/responses - and treated as data throughout software boundaries.
- Identity should not be assumed by name alone - the tool should compare roles and source records to confirm any potential duplicate identities. If a duplicate identity can be determined reliably without human review, it should be filtered out before the request stage. Otherwise, it should be flagged as a "potential duplicate" in the response.
- Retry logic should be integrated into the error handling, but only for transient failures - 429, 5xx and network/timeout. Do NOT retry authentication or validation errors.
- Vett only accepts 1 name per request. The free API only accepts 10 requests per minute, 100 requests per month. We will navigate this by using a local rate-limiting queue - if the rate limit has been reached, the maximum possible number of persons will be processed, the results added to a queue, and the user will receive a PENDING/IN_PROGRESS response. When the rate limit lifts, the API will request again for the next batch of persons, and repeat until all the remaining persons have been vetted. The result will be returned to the user. Because the amount of time taken for the rate limit is documented, we can add a timer so the user knows how long to wait for results. successful results should be preserved if later requests fail

## Project Flow
Company Number → Director & PSC Extraction → Vett Pipeline → Structured User Response

## Main Endpoints
### Companies House

For company data:

```text
GET: https://api.company-information.service.gov.uk/company/{COMPANY_NUMBER}
```

For PSC data:

```text
GET: https://api.company-information.service.gov.uk/company/{COMPANY_NUMBER}/persons-with-significant-control
```

For director data:

```text
GET: https://api.company-information.service.gov.uk/company/{COMPANY_NUMBER}/officers
```

### Vett
POST: https://global-sanctions-export-control-screener.p.rapidapi.com/screen/all 

These will be called via `curl`, for example:

```sh
curl --user "$COMPANIES_HOUSE_API_KEY:" \
  -H "Accept: application/json" \
  https://api.company-information.service.gov.uk/company/04092583/persons-with-significant-control
```

```sh
curl --request POST \
  --url https://global-sanctions-export-control-screener.p.rapidapi.com/screen/all \
  --header "Content-Type: application/json" \
  --header "x-rapidapi-host: global-sanctions-export-control-screener.p.rapidapi.com" \
  --header "x-rapidapi-key: $RAPIDAPI_KEY" \
  --data '{"name":"POTANIN, Vladimir","threshold":85}'
```

The threshold dictates the fuzziness of the search, as outlined in the Vett API documentation.

## Demo
This company returns a positive match:
https://api.company-information.service.gov.uk/company/11564549/officers

This does not:
https://api.company-information.service.gov.uk/company/04092583/officers

The UK sanctions dataset is not currently working, but the international datasets are. The international ones are therefore used instead to showcase the expected behaviour. Production use would require a usable API that covers UK sanctions data.
