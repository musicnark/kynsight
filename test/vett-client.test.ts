import { describe, expect, it, vi } from "vitest";
import { normalizeVettInputName, VettClient } from "../src/vett/client.js";

function client(fetchImplementation: typeof fetch): VettClient {
  return new VettClient({
    apiKey: "secret-key",
    fetchImplementation,
  });
}

describe("VettClient", () => {
  it("uses the RapidAPI deployment, headers, and request shape", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ input: "Example", is_match: false, matches: [] }), { status: 200 }),
    );

    const result = await client(fetchImplementation).screen("Example");

    expect(result.ok).toBe(true);
    const call = fetchImplementation.mock.calls[0];
    expect(String(call?.[0])).toBe("https://global-sanctions-export-control-screener.p.rapidapi.com/screen/all");
    expect(call?.[1]?.headers).toEqual({
      "Content-Type": "application/json",
      "x-rapidapi-host": "global-sanctions-export-control-screener.p.rapidapi.com",
      "x-rapidapi-key": "secret-key",
    });
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ name: "Example", threshold: 85 });
  });

  it("uses a supplied threshold and removes supported title tokens from the Vett input", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ input: "BLOCH, Nathan", is_match: false, matches: [] }), { status: 200 }),
    );

    await client(fetchImplementation).screen("BLOCH, Nathan, Mr.", 90);

    expect(JSON.parse(String(fetchImplementation.mock.calls[0]?.[1]?.body))).toEqual({
      name: "BLOCH, Nathan",
      threshold: 90,
    });
  });

  it.each([
    ["  dr.   Jane   Doe,  MR. ", "Jane Doe"],
    ["MS Jane Doe", "Jane Doe"],
    ["Jane Doe, PhD", "Jane Doe, PhD"],
    ["BLOCH, Nathan, Mr.", "BLOCH, Nathan"],
  ])("normalizes %s to %s without changing unsupported name parts", (input, expected) => {
    expect(normalizeVettInputName(input)).toBe(expected);
  });

  it("returns a safe configuration error when the API key is missing", async () => {
    const fetchImplementation = vi.fn<typeof fetch>();
    const result = await new VettClient({ apiKey: "", fetchImplementation }).screen("Example");

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "VETT_CONFIGURATION",
        scope: "ASSESSMENT",
      }),
    });
    expect(JSON.stringify(result)).not.toContain("x-rapidapi-key");
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("normalizes authentication and rate-limit failures without provider bodies", async () => {
    const authFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("secret provider error", { status: 403 }),
    );
    const authResult = await client(authFetch).screen("Example");
    expect(authResult).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "VETT_AUTHENTICATION",
        scope: "ASSESSMENT",
      }),
    });
    expect(JSON.stringify(authResult)).not.toContain("secret provider error");

    const limitedFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("secret provider error", { status: 429, headers: { "Retry-After": "30" } }),
    );
    const limitedResult = await client(limitedFetch).screen("Example");
    expect(limitedResult).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "VETT_RATE_LIMITED",
        retryable: true,
        retryAfterSeconds: 30,
      }),
    });
    expect(JSON.stringify(limitedResult)).not.toContain("secret provider error");
  });

  it("returns a malformed-response error for invalid successful JSON", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("not-json", { status: 200 }),
    );

    await expect(client(fetchImplementation).screen("Example")).resolves.toEqual({
      ok: false,
      error: expect.objectContaining({ code: "VETT_MALFORMED_RESPONSE" }),
    });
  });

  it("normalizes timeouts", async () => {
    vi.useFakeTimers();
    try {
      const fetchImplementation = vi.fn<typeof fetch>().mockImplementation(
        async (_input, init) => new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        }),
      );
      const vettClient = new VettClient({
        apiKey: "secret-key",
        fetchImplementation,
        requestTimeoutMs: 25,
      });
      const resultPromise = vettClient.screen("Example");
      await vi.advanceTimersByTimeAsync(25);
      await expect(resultPromise).resolves.toEqual({
        ok: false,
        error: expect.objectContaining({ code: "VETT_TIMEOUT", retryable: true }),
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
