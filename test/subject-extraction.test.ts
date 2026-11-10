import { describe, expect, it, vi } from "vitest";
import { CompaniesHouseClient } from "../src/companies-house/client.js";
import type {
  NormalizedOfficerRecord,
  NormalizedPscRecord,
} from "../src/companies-house/types.js";
import { extractSubjects } from "../src/subjects/extract.js";
import { extractSubjectsForCompany, validateCompanyNumber } from "../src/subjects/service.js";

function officer(overrides: Partial<NormalizedOfficerRecord> = {}): NormalizedOfficerRecord {
  return {
    recordLocator: "companies-house:officer:page-0:item-0",
    sourceRef: "companies-house:officer:appointment-1",
    personNumber: "person-1",
    name: "DIRECTOR, Current",
    officerRole: "director",
    resignedOn: null,
    ...overrides,
  };
}

function psc(overrides: Partial<NormalizedPscRecord> = {}): NormalizedPscRecord {
  return {
    recordLocator: "companies-house:psc:page-0:item-0",
    sourceRef: "companies-house:psc:psc-1",
    kind: "individual-person-with-significant-control",
    name: "PSC, Individual",
    ...overrides,
  };
}

describe("extractSubjects", () => {
  it("selects individual PSCs and never adds director fallback when both PSC types exist", () => {
    const result = extractSubjects({
      officers: [officer()],
      pscs: [
        psc(),
        psc({
          recordLocator: "companies-house:psc:page-0:item-1",
          sourceRef: "companies-house:psc:corporate-1",
          kind: "corporate-entity-person-with-significant-control",
          name: "Example Holdings Ltd",
        }),
      ],
    });

    expect(result.subjectSelection).toEqual({
      individualPscCount: 1,
      corporatePscCount: 1,
      fallbackUsed: false,
      directorFallbackUsed: false,
      corporateControlChainResolved: false,
    });
    expect(result.subjects).toEqual([expect.objectContaining({
      subjectType: "INDIVIDUAL_PSC",
      confirmedPsc: true,
      selectionReason: "INDIVIDUAL_PSC",
    })]);
    expect(result.corporatePscRecords).toEqual([{
      sourceRef: "companies-house:psc:corporate-1",
      recordLocator: "companies-house:psc:page-0:item-1",
      subjectType: "CORPORATE_PSC",
      name: "Example Holdings Ltd",
      screened: false,
      resolution: "OUT_OF_SCOPE",
      reason: "Corporate control chain was not recursively resolved.",
    }]);
    expect(result.unresolved).toContainEqual({
      code: "CORPORATE_CONTROL_CHAIN_UNRESOLVED",
      message: "The individual PSC was screened. The corporate PSC chain was not resolved.",
      sourceRefs: ["companies-house:psc:corporate-1"],
    });
  });

  it("uses current directors as an explicit corporate PSC fallback", () => {
    const result = extractSubjects({
      officers: [
        officer(),
        officer({
          recordLocator: "companies-house:officer:page-0:item-1",
          sourceRef: "companies-house:officer:appointment-resigned",
          name: "DIRECTOR, Resigned",
          resignedOn: "2024-01-01",
        }),
        officer({
          recordLocator: "companies-house:officer:page-0:item-2",
          sourceRef: "companies-house:officer:appointment-secretary",
          name: "SECRETARY, Person",
          officerRole: "secretary",
        }),
      ],
      pscs: [psc({
        kind: "corporate-entity-person-with-significant-control",
        name: "Example Holdings Ltd",
      })],
    });

    expect(result.subjectSelection).toEqual({
      individualPscCount: 0,
      corporatePscCount: 1,
      fallbackUsed: true,
      directorFallbackUsed: true,
      corporateControlChainResolved: false,
    });
    expect(result.subjects).toEqual([expect.objectContaining({
      subjectId: "officer:appointment-1",
      subjectType: "DIRECTOR_FALLBACK",
      confirmedPsc: false,
      selectionReason: "CORPORATE_PSC_FALLBACK",
      roles: ["director"],
    })]);
    expect(result.unresolved).toContainEqual({
      code: "CORPORATE_CONTROL_CHAIN_UNRESOLVED",
      message: "The screened directors are fallback subjects, not confirmed PSCs.",
      sourceRefs: ["companies-house:psc:psc-1"],
    });
    expect(result.unresolved.filter((finding) => finding.code === "CORPORATE_CONTROL_CHAIN_UNRESOLVED")).toHaveLength(1);
  });

  it("reports no fallback subjects when corporate PSCs have no current directors", () => {
    const result = extractSubjects({
      officers: [officer({ resignedOn: "2024-01-01" })],
      pscs: [psc({ kind: "corporate-entity-person-with-significant-control" })],
    });

    expect(result.subjects).toEqual([]);
    expect(result.subjectSelection.fallbackUsed).toBe(false);
    expect(result.subjectSelection.directorFallbackUsed).toBe(false);
    expect(result.unresolved.filter((finding) => finding.code === "CORPORATE_CONTROL_CHAIN_UNRESOLVED")).toHaveLength(1);
    expect(result.unresolved).toContainEqual(expect.objectContaining({
      code: "NO_DIRECTOR_FALLBACK_SUBJECTS",
    }));
  });

  it("does not use directors as fallback when no PSC records exist", () => {
    const result = extractSubjects({
      officers: [officer()],
      pscs: [],
    });

    expect(result.subjectSelection).toEqual({
      individualPscCount: 0,
      corporatePscCount: 0,
      fallbackUsed: false,
      directorFallbackUsed: false,
      corporateControlChainResolved: false,
    });
    expect(result.subjects).toEqual([]);
    expect(result.unresolved).toEqual([]);
  });

  it("preserves an unknown PSC kind without screening or guessing from its name", () => {
    const result = extractSubjects({
      officers: [],
      pscs: [psc({
        kind: "future-provider-kind",
        name: "Example Holdings Ltd",
      })],
    });

    expect(result.subjects).toEqual([]);
    expect(result.unknownPscRecords).toEqual([{
      sourceRef: "companies-house:psc:psc-1",
      recordLocator: "companies-house:psc:page-0:item-0",
      subjectType: "UNKNOWN_PSC",
      name: "Example Holdings Ltd",
      screened: false,
      resolution: "UNCLASSIFIED",
      reason: "The PSC record kind was not recognized, so no individual screening was attempted.",
    }]);
    expect(result.unresolved).toContainEqual({
      code: "UNRECOGNIZED_PSC_KIND",
      message: "A PSC record had an unrecognized kind and was not selected for screening.",
      sourceRefs: ["companies-house:psc:psc-1"],
    });
  });

  it("keeps a problematic individual record out of subjects while processing valid records", () => {
    const result = extractSubjects({
      officers: [],
      pscs: [
        psc({ name: null }),
        psc({
          recordLocator: "companies-house:psc:page-0:item-1",
          sourceRef: "companies-house:psc:psc-2",
          name: "VALID, PSC",
        }),
      ],
    });

    expect(result.subjects).toHaveLength(1);
    expect(result.subjects[0]?.name).toBe("VALID, PSC");
    expect(result.unresolved).toContainEqual(expect.objectContaining({
      code: "UNUSABLE_PSC_RECORD",
    }));
  });

  it("does not fabricate a sourceRef for a PSC missing source identity", () => {
    const result = extractSubjects({
      officers: [],
      pscs: [psc({ sourceRef: null, name: "PSC Without Source Ref" })],
    });

    expect(result.subjects).toEqual([]);
    expect(result.unusablePscRecords).toEqual([expect.objectContaining({
      sourceRef: null,
      name: "PSC Without Source Ref",
    })]);
    expect(result.unresolved).toContainEqual({
      code: "UNUSABLE_PSC_RECORD",
      message: "An individual PSC record did not contain a reliable source identity and name, so it was not screened.",
      sourceRefs: [],
    });
  });
});

describe("extractSubjectsForCompany", () => {
  it("applies the company-number validation policy before fetching", async () => {
    const fetchImplementation = vi.fn<typeof fetch>();
    const client = new CompaniesHouseClient({ apiKey: "test-key", fetchImplementation });

    const result = await extractSubjectsForCompany("bad/123", client);

    expect(result).toEqual({
      ok: false,
      failure: {
        kind: "VALIDATION_ERROR",
        code: "INVALID_COMPANY_NUMBER",
        message: "companyNumber must be a one-to-eight character alphanumeric string.",
        retryable: false,
      },
    });
    expect(fetchImplementation).not.toHaveBeenCalled();
    expect(validateCompanyNumber("  ab001234 ")).toEqual({ ok: true, companyNumber: "AB001234" });
    expect(validateCompanyNumber(12345678).ok).toBe(false);
    expect(validateCompanyNumber("123456789").ok).toBe(false);
  });

  it("returns normalized upstream errors when one required endpoint fails", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/officers")) {
        return new Response(JSON.stringify({
          items: [], items_per_page: 35, start_index: 0, total_results: 0,
        }), { status: 200 });
      }

      return new Response("provider details", { status: 503 });
    });
    const client = new CompaniesHouseClient({ apiKey: "test-key", fetchImplementation });

    const result = await extractSubjectsForCompany("12345678", client);

    expect(result).toEqual({
      ok: false,
      failure: {
        kind: "UPSTREAM_ERROR",
        code: "COMPANIES_HOUSE_ENDPOINT_FAILURE",
        message: "Both Companies House collections are required before subjects can be selected.",
        retryable: true,
        upstreamErrors: [expect.objectContaining({
          collection: "pscs",
          code: "COMPANIES_HOUSE_UNAVAILABLE",
          httpStatus: 503,
        })],
      },
    });
  });

  it("fetches both endpoints and passes normalized records to the pure extractor", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/officers")) {
        return new Response(JSON.stringify({
          items: [{
            name: "DIRECTOR, Current",
            officer_role: "director",
            links: { self: "/company/12345678/appointments/appointment-1" },
          }],
          items_per_page: 35,
          start_index: 0,
          total_results: 1,
        }), { status: 200 });
      }

      return new Response(JSON.stringify({
        items: [{
          kind: "individual-person-with-significant-control",
          name: "PSC, Individual",
          links: { self: "/company/12345678/persons-with-significant-control/psc-1" },
        }],
        items_per_page: 50,
        start_index: 0,
        total_results: 1,
      }), { status: 200 });
    });
    const client = new CompaniesHouseClient({ apiKey: "test-key", fetchImplementation });

    const result = await extractSubjectsForCompany("  12345678 ", client);

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      companyNumber: "12345678",
    }));
    if (result.ok) {
      expect(result.sourceRecords.officers[0]).toEqual(expect.objectContaining({
        name: "DIRECTOR, Current",
        sourceRef: "companies-house:officer:appointment-1",
      }));
      expect(result.selection.subjects).toEqual([expect.objectContaining({
        subjectType: "INDIVIDUAL_PSC",
        name: "PSC, Individual",
      })]);
    }
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("returns an assessment error only for a malformed list envelope", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/officers")) {
        return new Response(JSON.stringify({ items: [], start_index: 0 }), { status: 200 });
      }

      return new Response(JSON.stringify({
        items: [], items_per_page: 35, start_index: 0, total_results: 0,
      }), { status: 200 });
    });
    const client = new CompaniesHouseClient({ apiKey: "test-key", fetchImplementation });

    const result = await extractSubjectsForCompany("12345678", client);

    expect(result).toEqual({
      ok: false,
      failure: expect.objectContaining({
        kind: "ASSESSMENT_ERROR",
        code: "COMPANIES_HOUSE_MALFORMED_RESPONSE",
        endpoint: "officers",
      }),
    });
  });
});
