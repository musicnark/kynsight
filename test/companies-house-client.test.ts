import { describe, expect, it, vi } from "vitest";
import { CompaniesHouseClient } from "../src/companies-house/client.js";

type MockFetch = ReturnType<typeof vi.fn<typeof fetch>>;

function collectionResponse(
  items: unknown[],
  options: { startIndex: number; itemsPerPage: number; totalResults: number } = {
    startIndex: 0,
    itemsPerPage: items.length || 1,
    totalResults: items.length,
  },
): Response {
  return new Response(JSON.stringify({
    items,
    items_per_page: options.itemsPerPage,
    start_index: options.startIndex,
    total_results: options.totalResults,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function client(fetchImplementation: MockFetch, options: Partial<ConstructorParameters<typeof CompaniesHouseClient>[0]> = {}): CompaniesHouseClient {
  return new CompaniesHouseClient({
    apiKey: "test-key",
    fetchImplementation,
    ...options,
  });
}

describe("CompaniesHouseClient", () => {
  it("issues real-shaped authenticated requests and paginates from collection metadata", async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(collectionResponse([
        {
          name: "FIRST, Person",
          links: { self: "/company/12345678/appointments/first" },
          officer_role: "director",
        },
        {
          name: "SECOND, Person",
          links: { self: "/company/12345678/appointments/second" },
          officer_role: "director",
        },
      ], { startIndex: 0, itemsPerPage: 2, totalResults: 3 }))
      .mockResolvedValueOnce(collectionResponse([
        {
          name: "THIRD, Person",
          links: { self: "/company/12345678/appointments/third" },
          officer_role: "director",
        },
      ], { startIndex: 2, itemsPerPage: 2, totalResults: 3 }));

    const result = await client(fetchImplementation).listOfficers("12345678");

    expect(result).toEqual({
      ok: true,
      records: [
        expect.objectContaining({ sourceRef: "companies-house:officer:first" }),
        expect.objectContaining({ sourceRef: "companies-house:officer:second" }),
        expect.objectContaining({ sourceRef: "companies-house:officer:third" }),
      ],
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);

    const firstCall = fetchImplementation.mock.calls[0];
    const secondCall = fetchImplementation.mock.calls[1];
    expect(new URL(String(firstCall?.[0])).searchParams.get("start_index")).toBe("0");
    expect(new URL(String(secondCall?.[0])).searchParams.get("start_index")).toBe("2");
    expect(firstCall?.[1]?.headers).toEqual({
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from("test-key:").toString("base64")}`,
    });
  });

  it("supports a synthetic collection containing 26 PSC records", async () => {
    const pscs = Array.from({ length: 26 }, (_, index) => ({
      kind: "individual-person-with-significant-control",
      name: `PERSON ${index + 1}`,
      links: { self: `/company/12345678/persons-with-significant-control/psc-${index + 1}` },
    }));
    const fetchImplementation = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(collectionResponse(pscs.slice(0, 25), {
        startIndex: 0,
        itemsPerPage: 25,
        totalResults: 26,
      }))
      .mockResolvedValueOnce(collectionResponse(pscs.slice(25), {
        startIndex: 25,
        itemsPerPage: 25,
        totalResults: 26,
      }));

    const result = await client(fetchImplementation).listPscs("12345678");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.records).toHaveLength(26);
      expect(result.records[25]).toEqual(expect.objectContaining({
        name: "PERSON 26",
        sourceRef: "companies-house:psc:psc-26",
      }));
    }
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    const secondCall = fetchImplementation.mock.calls[1];
    expect(new URL(String(secondCall?.[0])).searchParams.get("start_index")).toBe("25");
  });

  it("rejects a repeated page instead of treating it as progress", async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(collectionResponse(Array.from({ length: 25 }, (_, index) => ({
        name: `PERSON ${index + 1}`,
      })), { startIndex: 0, itemsPerPage: 25, totalResults: 26 }))
      .mockResolvedValueOnce(collectionResponse([{}], {
        startIndex: 0,
        itemsPerPage: 25,
        totalResults: 26,
      }));

    const result = await client(fetchImplementation).listPscs("12345678");

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        kind: "MALFORMED_ENVELOPE",
        code: "COMPANIES_HOUSE_MALFORMED_RESPONSE",
      }),
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("returns a limit error when a bound is reached before total_results", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      collectionResponse(Array.from({ length: 25 }, (_, index) => ({
        name: `PERSON ${index + 1}`,
      })), { startIndex: 0, itemsPerPage: 25, totalResults: 26 }),
    );

    const result = await client(fetchImplementation, { maxPages: 1 }).listPscs("12345678");

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        kind: "UPSTREAM_ERROR",
        code: "COMPANIES_HOUSE_LIMIT_EXCEEDED",
      }),
    });
    expect(fetchImplementation).toHaveBeenCalledOnce();
  });

  it("returns a malformed-envelope error for invalid collection metadata", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ items: [], start_index: 0 }), { status: 200 }),
    );

    const result = await client(fetchImplementation).listPscs("12345678");

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        kind: "MALFORMED_ENVELOPE",
        code: "COMPANIES_HOUSE_MALFORMED_RESPONSE",
      }),
    });
  });

  it("keeps malformed JSON as a normalized upstream error", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("not-json", { status: 200 }),
    );

    const result = await client(fetchImplementation).listPscs("12345678");

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        kind: "UPSTREAM_ERROR",
        code: "COMPANIES_HOUSE_MALFORMED_JSON",
        retryable: false,
      }),
    });
  });

  it("normalizes non-2xx rate limits without exposing the provider body", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("secret provider details", {
        status: 429,
        headers: { "Retry-After": "30" },
      }),
    );

    const result = await client(fetchImplementation).listPscs("12345678");

    expect(result).toEqual({
      ok: false,
      error: {
        kind: "UPSTREAM_ERROR",
        source: "COMPANIES_HOUSE",
        collection: "pscs",
        code: "COMPANIES_HOUSE_RATE_LIMITED",
        message: "Companies House rate limited the request.",
        retryable: true,
        httpStatus: 429,
        retryAfterSeconds: 30,
      },
    });
    expect(JSON.stringify(result)).not.toContain("secret provider details");
  });

  it("normalizes network and timeout failures", async () => {
    const networkFetch = vi.fn<typeof fetch>().mockRejectedValue(new Error("socket details"));
    const networkResult = await client(networkFetch).listPscs("12345678");
    expect(networkResult).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "COMPANIES_HOUSE_NETWORK",
        retryable: true,
      }),
    });

    vi.useFakeTimers();
    try {
      const timeoutFetch = vi.fn<typeof fetch>().mockImplementation(
        async (_input, init) => new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        }),
      );
      const resultPromise = client(timeoutFetch, { requestTimeoutMs: 25 }).listPscs("12345678");
      await vi.advanceTimersByTimeAsync(25);
      const timeoutResult = await resultPromise;

      expect(timeoutResult).toEqual({
        ok: false,
        error: expect.objectContaining({
          code: "COMPANIES_HOUSE_TIMEOUT",
          retryable: true,
        }),
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns a configuration error when the API key is missing", async () => {
    const fetchImplementation = vi.fn<typeof fetch>();
    const result = await new CompaniesHouseClient({
      apiKey: "",
      fetchImplementation,
    }).listPscs("12345678");

    expect(result).toEqual({
      ok: false,
      error: {
        kind: "UPSTREAM_ERROR",
        source: "COMPANIES_HOUSE",
        collection: "pscs",
        code: "COMPANIES_HOUSE_CONFIGURATION",
        message: "The Companies House API key is not configured.",
        retryable: false,
      },
    });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("applies the timeout while reading a successful response body", async () => {
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | undefined;
      const response = {
        ok: true,
        status: 200,
        headers: new Headers(),
        text: vi.fn(() => new Promise<string>((_resolve, reject) => {
          signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        })),
      } as unknown as Response;
      const fetchImplementation = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
        signal = init?.signal ?? undefined;
        return response;
      });

      const resultPromise = new CompaniesHouseClient({
        apiKey: "test-key",
        fetchImplementation,
        requestTimeoutMs: 25,
      }).listPscs("12345678");
      await vi.advanceTimersByTimeAsync(25);
      const result = await resultPromise;

      expect(result).toEqual({
        ok: false,
        error: expect.objectContaining({
          code: "COMPANIES_HOUSE_TIMEOUT",
          retryable: true,
        }),
      });
      expect(response.text).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});
