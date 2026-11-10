import { describe, expect, it } from "vitest";
import { normalizeVettResponse } from "../src/vett/adapter.js";

function match(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    list_name: "OFAC",
    name: "Example Person",
    score: 91,
    source: "OFAC_SDN",
    entity_type: "Individual",
    programs: ["EXAMPLE"],
    ...overrides,
  };
}

function response(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    input: "Example Person",
    is_match: false,
    matches: [],
    list_dates: {
      OFAC: "2026-11-10",
      UK_OFSI: "2026-11-09",
      UN_SC: "2026-11-10",
      CSL: "unknown",
      EU_FSF: "2026-11-10",
      CANADA_SEMA: "2026-11-09",
      AUSTRALIA_DFAT: "2026-11-10",
    },
    screened_at: "2026-11-10T09:26:21Z",
    ...overrides,
  };
}

describe("normalizeVettResponse", () => {
  it("maps an explicit empty result to NO_MATCH", () => {
    expect(normalizeVettResponse(response(), "Example Person")).toEqual({
      ok: true,
      result: expect.objectContaining({
        input: "Example Person",
        outcome: "NO_MATCH",
        matches: [],
      }),
    });
  });

  it("maps validated matches, including borderline results, to POSSIBLE_MATCH", () => {
    const result = normalizeVettResponse(response({
      is_match: true,
      matches: [match({ score: 75 })],
    }), "Example Person");

    expect(result).toEqual({
      ok: true,
      result: expect.objectContaining({ outcome: "POSSIBLE_MATCH" }),
    });
  });

  it("accepts the live RapidAPI response shape with a variable match count", () => {
    const result = normalizeVettResponse(response({
      input: "POTANIN, Vladimir",
      is_match: true,
      matches: [
        match({ name: "Vladimir Olegovich Potanin", score: 90 }),
        match({ list_name: "CSL", name: "Potanin Vladimir Olegovich", score: 90 }),
        match({ list_name: "AUSTRALIA_DFAT", name: "Vladimir Olegovich Potanin", entity_type: "Person", programs: [] }),
        match({ name: "Vladimir Putin", score: 86 }),
        match({ list_name: "CSL", name: "Putin Vladimir", score: 86 }),
      ],
    }), "POTANIN, Vladimir");

    expect(result).toEqual({
      ok: true,
      result: expect.objectContaining({
        input: "POTANIN, Vladimir",
        outcome: "POSSIBLE_MATCH",
        matches: expect.arrayContaining([
          expect.objectContaining({ name: "Vladimir Olegovich Potanin", score: 90 }),
          expect.objectContaining({ name: "Putin Vladimir", score: 86 }),
        ]),
      }),
    });
  });

  it("rejects screening evidence for a different requested name", () => {
    expect(normalizeVettResponse(response(), "Different Person")).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "VETT_MALFORMED_RESPONSE" }),
    });
  });

  it.each([
    response({ is_match: false, matches: [match()] }),
    response({ is_match: true, matches: [] }),
    response({ matches: undefined }),
    response({ matches: [match({ score: 101 })] }),
    response({ matches: [match({ programs: ["", "VALID"] })] }),
    response({ matches: [match({ extra: true })] }),
    response({ list_dates: { OFAC: "2026-11-10" } }),
    response({ list_dates: {
      OFAC: "2026-02-30",
      UK_OFSI: "2026-11-09",
      UN_SC: "2026-11-10",
      CSL: "unknown",
      EU_FSF: "2026-11-10",
      CANADA_SEMA: "2026-11-09",
      AUSTRALIA_DFAT: "2026-11-10",
    } }),
    response({ list_dates: {
      OFAC: "2026-11-10",
      UK_OFSI: "2026-11-09",
      UN_SC: "2026-11-10",
      CSL: "unknown",
      EU_FSF: "2026-11-10",
      CANADA_SEMA: "2026-11-09",
      AUSTRALIA_DFAT: "2026-11-10",
      EXTRA_LIST: "2026-11-10",
    } }),
    response({ screened_at: "not-a-timestamp" }),
  ])("rejects malformed or contradictory success payloads", (payload) => {
    expect(normalizeVettResponse(payload, "Example Person")).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "VETT_MALFORMED_RESPONSE",
        retryable: false,
      }),
    });
  });

  it.each([
    response({ results: {} }),
    response({ total_matches: 0 }),
    response({ list_date: "2026-11-10" }),
  ])("rejects alternate Vett response schemas", (payload) => {
    expect(normalizeVettResponse(payload, "Example Person")).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "VETT_MALFORMED_RESPONSE",
        retryable: false,
      }),
    });
  });
});
