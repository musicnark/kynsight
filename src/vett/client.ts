import {
  DEFAULT_VETT_REQUEST_TIMEOUT_MS,
  DEFAULT_VETT_THRESHOLD,
  VETT_BASE_URL,
  VETT_RAPIDAPI_HOST,
} from "./types.js";
import type { VettAttemptResult, VettClientOptions, VettError } from "./types.js";

export class VettClient {
  private readonly apiKey: string;
  private readonly fetchImplementation: typeof fetch;
  private readonly baseUrl: string;
  private readonly requestTimeoutMs: number;

  public constructor(options: VettClientOptions) {
    this.apiKey = options.apiKey;
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
    this.baseUrl = options.baseUrl ?? VETT_BASE_URL;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_VETT_REQUEST_TIMEOUT_MS;
  }

  public async screen(name: string, threshold = DEFAULT_VETT_THRESHOLD): Promise<VettAttemptResult> {
    if (this.apiKey.trim() === "") {
      return {
        ok: false,
        error: {
          kind: "UPSTREAM_ERROR",
          source: "VETT",
          code: "VETT_CONFIGURATION",
          message: "The Vett API key is not configured.",
          retryable: false,
          scope: "ASSESSMENT",
        },
      };
    }

    const url = new URL("/screen/all", this.baseUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    let response: Response;
    try {
      response = await this.fetchImplementation(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-rapidapi-host": VETT_RAPIDAPI_HOST,
          "x-rapidapi-key": this.apiKey,
        },
        body: JSON.stringify({ name: normalizeVettInputName(name), threshold }),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeout);
      return { ok: false, error: requestError(error, controller.signal.aborted) };
    }

    if (!response.ok) {
      clearTimeout(timeout);
      return { ok: false, error: httpError(response) };
    }

    let responseText: string;
    try {
      responseText = await response.text();
    } catch (error) {
      clearTimeout(timeout);
      return { ok: false, error: requestError(error, controller.signal.aborted) };
    }
    clearTimeout(timeout);

    try {
      return { ok: true, body: JSON.parse(responseText) as unknown };
    } catch {
      return {
        ok: false,
        error: {
          kind: "MALFORMED_RESPONSE",
          source: "VETT",
          code: "VETT_MALFORMED_RESPONSE",
          message: "Vett returned a successful response that was not valid JSON.",
          retryable: false,
          scope: "SUBJECT",
        },
      };
    }
  }
}

const SUPPORTED_TITLES = new Set([
  "captain",
  "capt",
  "colonel",
  "col",
  "dame",
  "dr",
  "general",
  "gen",
  "hon",
  "judge",
  "lady",
  "lieutenant",
  "lt",
  "lord",
  "major",
  "maj",
  "miss",
  "mr",
  "mrs",
  "ms",
  "mx",
  "prof",
  "professor",
  "reverend",
  "rev",
  "sir",
]);

export function normalizeVettInputName(name: string): string {
  const tokens = name.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  let removedTitle = true;
  while (removedTitle && tokens.length > 0) {
    removedTitle = isTitleToken(tokens[0]);
    if (removedTitle) {
      tokens.shift();
      removePunctuationOnlyToken(tokens, "start");
    }
  }

  removedTitle = true;
  while (removedTitle && tokens.length > 0) {
    const lastIndex = tokens.length - 1;
    removedTitle = isTitleToken(tokens[lastIndex]);
    if (removedTitle) {
      tokens.pop();
      removePunctuationOnlyToken(tokens, "end");
    }
  }

  return tokens.join(" ").replace(/^[,.;:]+|[,.;:]+$/g, "").trim();
}

function isTitleToken(token: string | undefined): boolean {
  if (token === undefined) {
    return false;
  }
  return SUPPORTED_TITLES.has(token.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "").toLowerCase());
}

function removePunctuationOnlyToken(tokens: string[], side: "start" | "end"): void {
  const index = side === "start" ? 0 : tokens.length - 1;
  const token = tokens[index];
  if (token !== undefined && /^[^A-Za-z0-9]+$/.test(token)) {
    tokens.splice(index, 1);
  }
}

function requestError(error: unknown, wasAborted: boolean): VettError {
  if (wasAborted || (error instanceof Error && error.name === "AbortError")) {
    return {
      kind: "UPSTREAM_ERROR",
      source: "VETT",
      code: "VETT_TIMEOUT",
      message: "Vett did not respond before the screening timeout.",
      retryable: true,
      scope: "SUBJECT",
    };
  }

  return {
    kind: "UPSTREAM_ERROR",
    source: "VETT",
    code: "VETT_NETWORK",
    message: "The Vett request could not be completed.",
    retryable: true,
    scope: "SUBJECT",
  };
}

function httpError(response: Response): VettError {
  const isAuthentication = response.status === 401 || response.status === 403;
  const isRateLimited = response.status === 429;
  const isServerError = response.status >= 500;
  const retryAfterSeconds = parseRetryAfter(response.headers.get("retry-after"));
  const error: VettError = {
    kind: "UPSTREAM_ERROR",
    source: "VETT",
    code: isAuthentication
      ? "VETT_AUTHENTICATION"
      : isRateLimited
        ? "VETT_RATE_LIMITED"
        : response.status === 400
          ? "VETT_VALIDATION"
          : isServerError
            ? "VETT_UPSTREAM"
            : "VETT_UPSTREAM",
    message: isAuthentication
      ? "The Vett integration could not authenticate."
      : isRateLimited
        ? "Vett rate limited the screening request."
        : response.status === 400
          ? "Vett rejected the screening name."
          : isServerError
            ? "Vett reported an upstream server failure."
            : "Vett rejected the screening request.",
    retryable: isRateLimited || isServerError,
    scope: isAuthentication ? "ASSESSMENT" : "SUBJECT",
    httpStatus: response.status,
  };

  if (retryAfterSeconds !== null) {
    error.retryAfterSeconds = retryAfterSeconds;
  }

  return error;
}

function parseRetryAfter(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}
