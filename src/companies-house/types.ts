export type CompaniesHouseCollection = "officers" | "pscs";

export interface NormalizedOfficerRecord {
  recordLocator: string;
  sourceRef: string | null;
  personNumber: string | null;
  name: string | null;
  officerRole: string | null;
  resignedOn: string | null;
}

export interface NormalizedPscRecord {
  recordLocator: string;
  sourceRef: string | null;
  kind: string | null;
  name: string | null;
}

export interface CompaniesHouseUpstreamError {
  kind: "UPSTREAM_ERROR";
  source: "COMPANIES_HOUSE";
  collection: CompaniesHouseCollection;
  code:
    | "COMPANIES_HOUSE_CONFIGURATION"
    | "COMPANIES_HOUSE_AUTHENTICATION"
    | "COMPANIES_HOUSE_RATE_LIMITED"
    | "COMPANIES_HOUSE_UNAVAILABLE"
    | "COMPANIES_HOUSE_HTTP"
    | "COMPANIES_HOUSE_NETWORK"
    | "COMPANIES_HOUSE_TIMEOUT"
    | "COMPANIES_HOUSE_MALFORMED_JSON"
    | "COMPANIES_HOUSE_LIMIT_EXCEEDED";
  message: string;
  retryable: boolean;
  httpStatus?: number;
  retryAfterSeconds?: number;
}

export interface CompaniesHouseMalformedEnvelopeError {
  kind: "MALFORMED_ENVELOPE";
  source: "COMPANIES_HOUSE";
  collection: CompaniesHouseCollection;
  code: "COMPANIES_HOUSE_MALFORMED_RESPONSE";
  message: string;
  retryable: false;
}

export type CompaniesHouseCollectionError =
  | CompaniesHouseUpstreamError
  | CompaniesHouseMalformedEnvelopeError;

export type CollectionResult<T> =
  | { ok: true; records: T[] }
  | { ok: false; error: CompaniesHouseCollectionError };

export interface CompaniesHouseClientOptions {
  apiKey: string;
  fetchImplementation?: typeof fetch;
  baseUrl?: string;
  requestTimeoutMs?: number;
  maxPages?: number;
  maxStartIndex?: number;
}
