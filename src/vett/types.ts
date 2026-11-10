export const VETT_BASE_URL = "https://global-sanctions-export-control-screener.p.rapidapi.com";
export const VETT_RAPIDAPI_HOST = "global-sanctions-export-control-screener.p.rapidapi.com";
export const DEFAULT_VETT_THRESHOLD = 85;
export const MIN_VETT_THRESHOLD = 50;
export const MAX_VETT_THRESHOLD = 100;
export const DEFAULT_VETT_REQUEST_TIMEOUT_MS = 10_000;

export type VettErrorCode =
  | "VETT_AUTHENTICATION"
  | "VETT_CONFIGURATION"
  | "VETT_VALIDATION"
  | "VETT_RATE_LIMITED"
  | "VETT_TIMEOUT"
  | "VETT_NETWORK"
  | "VETT_UPSTREAM"
  | "VETT_MALFORMED_RESPONSE";

export interface VettError {
  kind: "UPSTREAM_ERROR" | "MALFORMED_RESPONSE";
  source: "VETT";
  code: VettErrorCode;
  message: string;
  retryable: boolean;
  scope: "ASSESSMENT" | "SUBJECT";
  httpStatus?: number;
  retryAfterSeconds?: number;
  attempts?: number;
  nextAttemptAt?: string;
}

export interface VettMatch {
  listName: string;
  name: string;
  score: number;
  source: string;
  entityType: string;
  programs: string[];
}

export interface VettScreeningResult {
  input: string;
  outcome: "NO_MATCH" | "POSSIBLE_MATCH";
  matches: VettMatch[];
  listDates: Record<string, string> | null;
  screenedAt: string | null;
}

export interface VettClientOptions {
  apiKey: string;
  fetchImplementation?: typeof fetch;
  baseUrl?: string;
  requestTimeoutMs?: number;
}

export type VettAttemptResult =
  | { ok: true; body: unknown }
  | { ok: false; error: VettError };
