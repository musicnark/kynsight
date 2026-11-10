import type {
  CollectionResult,
  CompaniesHouseClientOptions,
  CompaniesHouseCollection,
  CompaniesHouseCollectionError,
  CompaniesHouseMalformedEnvelopeError,
  CompaniesHouseUpstreamError,
  NormalizedOfficerRecord,
  NormalizedPscRecord,
} from "./types.js";

const DEFAULT_BASE_URL = "https://api.company-information.service.gov.uk";
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_PAGES = 100;
const DEFAULT_MAX_START_INDEX = 10_000;

type JsonRecord = Record<string, unknown>;

interface CollectionPage {
  items: unknown[];
  startIndex: number;
  itemsPerPage: number;
  totalResults: number;
}

export class CompaniesHouseClient {
  private readonly apiKey: string;
  private readonly fetchImplementation: typeof fetch;
  private readonly baseUrl: string;
  private readonly requestTimeoutMs: number;
  private readonly maxPages: number;
  private readonly maxStartIndex: number;

  public constructor(options: CompaniesHouseClientOptions) {
    this.apiKey = options.apiKey;
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
    this.maxStartIndex = options.maxStartIndex ?? DEFAULT_MAX_START_INDEX;
  }

  public listOfficers(companyNumber: string): Promise<CollectionResult<NormalizedOfficerRecord>> {
    return this.listCollection(companyNumber, "officers");
  }

  public listPscs(companyNumber: string): Promise<CollectionResult<NormalizedPscRecord>> {
    return this.listCollection(companyNumber, "pscs");
  }

  private async listCollection<T extends NormalizedOfficerRecord | NormalizedPscRecord>(
    companyNumber: string,
    collection: CompaniesHouseCollection,
  ): Promise<CollectionResult<T>> {
    const records: T[] = [];
    let startIndex = 0;

    for (let pageNumber = 0; pageNumber < this.maxPages; pageNumber += 1) {
      if (startIndex > this.maxStartIndex) {
        return {
          ok: false,
          error: this.limitError(collection),
        };
      }

      const pageResult = await this.fetchPage(companyNumber, collection, startIndex);
      if (!pageResult.ok) {
        return pageResult;
      }

      const page = pageResult.page;
      records.push(...page.items.map((item, index) => this.normalizeRecord(
        item,
        collection,
        page.startIndex,
        index,
      ) as T));

      const nextStartIndex = page.startIndex + page.itemsPerPage;
      if (nextStartIndex >= page.totalResults) {
        return { ok: true, records };
      }

      if (nextStartIndex <= startIndex || nextStartIndex > page.totalResults) {
        return {
          ok: false,
          error: this.malformedEnvelopeError(
            collection,
            "Companies House pagination did not make bounded forward progress.",
          ),
        };
      }

      startIndex = nextStartIndex;
    }

    return {
      ok: false,
      error: this.limitError(collection),
    };
  }

  private async fetchPage(
    companyNumber: string,
    collection: CompaniesHouseCollection,
    startIndex: number,
  ): Promise<
    | { ok: true; page: CollectionPage }
    | { ok: false; error: CompaniesHouseCollectionError }
  > {
    if (this.apiKey.trim() === "") {
      return {
        ok: false,
        error: {
          kind: "UPSTREAM_ERROR",
          source: "COMPANIES_HOUSE",
          collection,
          code: "COMPANIES_HOUSE_CONFIGURATION",
          message: "The Companies House API key is not configured.",
          retryable: false,
        },
      };
    }

    const path = collection === "officers"
      ? "officers"
      : "persons-with-significant-control";
    const url = new URL(
      `/company/${encodeURIComponent(companyNumber)}/${path}`,
      this.baseUrl,
    );
    url.searchParams.set("start_index", String(startIndex));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    let response: Response;
    try {
      response = await this.fetchImplementation(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${this.apiKey}:`, "utf8").toString("base64")}`,
        },
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeout);
      return {
        ok: false,
        error: this.requestError(error, collection, controller.signal.aborted),
      };
    }
    if (!response.ok) {
      clearTimeout(timeout);
      return {
        ok: false,
        error: this.httpError(response, collection),
      };
    }

    let responseText: string;
    try {
      responseText = await response.text();
    } catch (error) {
      clearTimeout(timeout);
      return {
        ok: false,
        error: this.requestError(error, collection, controller.signal.aborted),
      };
    }

    clearTimeout(timeout);

    let body: unknown;
    try {
      body = JSON.parse(responseText) as unknown;
    } catch {
      return {
        ok: false,
        error: {
          kind: "UPSTREAM_ERROR",
          source: "COMPANIES_HOUSE",
          collection,
          code: "COMPANIES_HOUSE_MALFORMED_JSON",
          message: "Companies House returned a successful response that was not valid JSON.",
          retryable: false,
        },
      };
    }

    return this.parsePage(body, collection, startIndex);
  }

  private parsePage(
    body: unknown,
    collection: CompaniesHouseCollection,
    requestedStartIndex: number,
  ): { ok: true; page: CollectionPage } | { ok: false; error: CompaniesHouseMalformedEnvelopeError } {
    if (!isJsonRecord(body) || !Array.isArray(body.items)) {
      return {
        ok: false,
        error: this.malformedEnvelopeError(
          collection,
          "Companies House returned a malformed collection envelope.",
        ),
      };
    }

    const startIndex = getInteger(body.start_index);
    const itemsPerPage = getInteger(body.items_per_page);
    const totalResults = getInteger(body.total_results);

    if (
      startIndex === null
      || itemsPerPage === null
      || totalResults === null
      || startIndex < 0
      || itemsPerPage <= 0
      || totalResults < 0
      || startIndex !== requestedStartIndex
      || startIndex > totalResults
      || body.items.length > itemsPerPage
      || startIndex + body.items.length > totalResults
      || (totalResults === 0 && body.items.length !== 0)
      || (totalResults > startIndex && body.items.length === 0)
    ) {
      return {
        ok: false,
        error: this.malformedEnvelopeError(
          collection,
          "Companies House returned invalid collection pagination metadata.",
        ),
      };
    }

    return {
      ok: true,
      page: {
        items: body.items,
        startIndex,
        itemsPerPage,
        totalResults,
      },
    };
  }

  private normalizeRecord(
    item: unknown,
    collection: CompaniesHouseCollection,
    startIndex: number,
    index: number,
  ): NormalizedOfficerRecord | NormalizedPscRecord {
    const record = isJsonRecord(item) ? item : {};
    const recordLocator = `companies-house:${collection === "officers" ? "officer" : "psc"}:page-${startIndex}:item-${index}`;
    const sourceRef = sourceReference(record, collection);
    const name = stringValue(record.name);

    if (collection === "officers") {
      return {
        recordLocator,
        sourceRef,
        personNumber: stringValue(record.person_number),
        name,
        officerRole: stringValue(record.officer_role),
        resignedOn: stringValue(record.resigned_on),
      };
    }

    return {
      recordLocator,
      sourceRef,
      kind: stringValue(record.kind),
      name,
    };
  }

  private requestError(
    error: unknown,
    collection: CompaniesHouseCollection,
    wasAborted: boolean,
  ): CompaniesHouseUpstreamError {
    if (wasAborted || (error instanceof Error && error.name === "AbortError")) {
      return {
        kind: "UPSTREAM_ERROR",
        source: "COMPANIES_HOUSE",
        collection,
        code: "COMPANIES_HOUSE_TIMEOUT",
        message: "Companies House did not respond before the request timeout.",
        retryable: true,
      };
    }

    return {
      kind: "UPSTREAM_ERROR",
      source: "COMPANIES_HOUSE",
      collection,
      code: "COMPANIES_HOUSE_NETWORK",
      message: "The Companies House request could not be completed.",
      retryable: true,
    };
  }

  private httpError(response: Response, collection: CompaniesHouseCollection): CompaniesHouseUpstreamError {
    const retryAfterSeconds = parseRetryAfter(response.headers.get("retry-after"));
    const isRateLimited = response.status === 429;
    const isUnavailable = response.status >= 500;
    const error: CompaniesHouseUpstreamError = {
      kind: "UPSTREAM_ERROR",
      source: "COMPANIES_HOUSE",
      collection,
      code: isRateLimited
        ? "COMPANIES_HOUSE_RATE_LIMITED"
        : response.status === 401 || response.status === 403
          ? "COMPANIES_HOUSE_AUTHENTICATION"
          : isUnavailable
            ? "COMPANIES_HOUSE_UNAVAILABLE"
            : "COMPANIES_HOUSE_HTTP",
      message: isRateLimited
        ? "Companies House rate limited the request."
        : response.status === 401 || response.status === 403
          ? "Companies House authentication failed."
          : isUnavailable
            ? "Companies House is unavailable."
            : "Companies House rejected the request.",
      retryable: isRateLimited || isUnavailable,
      httpStatus: response.status,
    };

    if (retryAfterSeconds !== null) {
      error.retryAfterSeconds = retryAfterSeconds;
    }

    return error;
  }

  private malformedEnvelopeError(
    collection: CompaniesHouseCollection,
    message: string,
  ): CompaniesHouseMalformedEnvelopeError {
    return {
      kind: "MALFORMED_ENVELOPE",
      source: "COMPANIES_HOUSE",
      collection,
      code: "COMPANIES_HOUSE_MALFORMED_RESPONSE",
      message,
      retryable: false,
    };
  }

  private limitError(collection: CompaniesHouseCollection): CompaniesHouseUpstreamError {
    return {
      kind: "UPSTREAM_ERROR",
      source: "COMPANIES_HOUSE",
      collection,
      code: "COMPANIES_HOUSE_LIMIT_EXCEEDED",
      message: "The Companies House collection exceeded the configured pagination bound.",
      retryable: true,
    };
  }
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function stringValue(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function sourceReference(
  record: JsonRecord,
  collection: CompaniesHouseCollection,
): string | null {
  const links = isJsonRecord(record.links) ? record.links : null;
  const self = links === null ? null : stringValue(links.self);
  if (self === null) {
    return null;
  }

  const identifier = self.split("/").filter(Boolean).at(-1);
  if (identifier === undefined || identifier === "") {
    return null;
  }

  return `companies-house:${collection === "officers" ? "officer" : "psc"}:${identifier}`;
}

function parseRetryAfter(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}
