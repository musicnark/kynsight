import { describe, expect, it } from "vitest";
import { CompaniesHouseClient } from "../src/companies-house/client.js";
import type { SubjectExtractionResult } from "../src/subjects/service.js";
import type { SubjectSelection } from "../src/subjects/types.js";
import { AssessmentService } from "../src/assessment/service.js";
import { AssessmentStore } from "../src/assessment/store.js";
import { VettQueue } from "../src/assessment/queue.js";
import type { QueueClock } from "../src/assessment/queue.js";
import type { VettClient } from "../src/vett/client.js";
import type { VettAttemptResult } from "../src/vett/types.js";

function selection(subjects: SubjectSelection["subjects"] = []): SubjectSelection {
  return {
    subjectSelection: {
      individualPscCount: subjects.length,
      corporatePscCount: 0,
      fallbackUsed: false,
      directorFallbackUsed: false,
      corporateControlChainResolved: false,
    },
    subjects,
    corporatePscRecords: [],
    unknownPscRecords: [],
    unusablePscRecords: [],
    unusableOfficerRecords: [],
    unresolved: [],
  };
}

function client(): VettClient {
  return {
    screen: async (input: string): Promise<VettAttemptResult> => ({
      ok: true,
      body: {
        input,
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
      },
    }),
  } as unknown as VettClient;
}

function service(
  extraction: (companyNumber: unknown, client: CompaniesHouseClient) => Promise<SubjectExtractionResult>,
): AssessmentService {
  const store = new AssessmentStore();
  const vettQueue = new VettQueue(store, client());
  return new AssessmentService({
    companiesHouseClient: new CompaniesHouseClient({ apiKey: "test-key", fetchImplementation: async () => new Response() }),
    queue: vettQueue,
    store,
    assessmentIdGenerator: (() => {
      let index = 0;
      return () => `asmt_${++index}`;
    })(),
    subjectExtraction: extraction,
  });
}

describe("AssessmentService", () => {
  it("completes immediately when no subjects are selected", async () => {
    const assessmentService = service(async () => ({
      ok: true,
      companyNumber: "12345678",
      sourceRecords: { officers: [], pscs: [] },
      selection: selection(),
    }));

    const result = await assessmentService.request({ companyNumber: "12345678" });

    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual(expect.objectContaining({
      status: "COMPLETE",
      partial: false,
      progress: { total: 0, terminal: 0, successful: 0, queued: 0, inProgress: 0 },
      subjects: [],
    }));
  });

  it("reuses an idempotent request without starting another assessment", async () => {
    let extractionCalls = 0;
    const assessmentService = service(async () => {
      extractionCalls += 1;
      return {
        ok: true,
        companyNumber: "12345678",
        sourceRecords: { officers: [], pscs: [] },
        selection: selection(),
      };
    });

    const first = await assessmentService.request({ companyNumber: "12345678", idempotencyKey: "key-1" });
    const second = await assessmentService.request({ companyNumber: "12345678", idempotencyKey: "key-1" });

    expect(extractionCalls).toBe(1);
    expect(second.body).toEqual(first.body);
  });

  it("rejects an idempotency key reused with changed input", async () => {
    const assessmentService = service(async (companyNumber) => ({
      ok: true,
      companyNumber: String(companyNumber),
      sourceRecords: { officers: [], pscs: [] },
      selection: selection(),
    }));

    await assessmentService.request({ companyNumber: "12345678", idempotencyKey: "key-1" });
    const result = await assessmentService.request({ companyNumber: "87654321", idempotencyKey: "key-1" });

    expect(result.statusCode).toBe(400);
    expect(result.body).toEqual(expect.objectContaining({
      assessmentError: expect.objectContaining({ code: "IDEMPOTENCY_KEY_REUSED" }),
    }));
  });

  it("returns an assessment-level Companies House failure without starting Vett work", async () => {
    const assessmentService = service(async () => ({
      ok: false,
      failure: {
        kind: "ASSESSMENT_ERROR",
        code: "COMPANIES_HOUSE_MALFORMED_RESPONSE",
        message: "Malformed collection.",
        retryable: false,
        endpoint: "officers",
      },
    }));

    const result = await assessmentService.request({ companyNumber: "12345678" });

    expect(result.statusCode).toBe(502);
    expect(result.body).toEqual(expect.objectContaining({
      status: "ERROR",
      assessmentError: expect.objectContaining({ code: "COMPANIES_HOUSE_MALFORMED_RESPONSE" }),
    }));
  });

  it("starts a fresh assessment after a monthly budget error becomes eligible", async () => {
    let current = Date.UTC(2026, 0, 31, 23, 59, 59);
    const clock: QueueClock = {
      now: () => current,
      sleep: async () => undefined,
      random: () => 0,
    };
    const store = new AssessmentStore();
    const vettQueue = new VettQueue(store, client(), {
      clock,
      requestsPerMonth: 1,
    });
    let extractionCalls = 0;
    const selectedSubject = {
      subjectId: "psc:1",
      subjectType: "INDIVIDUAL_PSC" as const,
      name: "PERSON 1",
      roles: ["psc"],
      confirmedPsc: true,
      selectionReason: "INDIVIDUAL_PSC" as const,
      sourceRefs: ["companies-house:psc:1"],
    };
    const assessmentService = new AssessmentService({
      companiesHouseClient: new CompaniesHouseClient({ apiKey: "test-key" }),
      queue: vettQueue,
      store,
      now: () => clock.now(),
      assessmentIdGenerator: (() => {
        let index = 0;
        return () => `asmt_${++index}`;
      })(),
      subjectExtraction: async () => {
        extractionCalls += 1;
        return {
          ok: true,
          companyNumber: "12345678",
          sourceRecords: { officers: [], pscs: [] },
          selection: selection([selectedSubject, { ...selectedSubject, subjectId: "psc:2", name: "PERSON 2" }]),
        };
      },
    });

    const first = await assessmentService.request({ companyNumber: "12345678" });
    await vettQueue.waitForIdle();
    expect(first.statusCode).toBe(202);
    expect(store.latestForCompany("12345678")?.subjects[1]?.screening).toEqual(expect.objectContaining({
      status: "ERROR",
      error: expect.objectContaining({ code: "VETT_RATE_LIMITED" }),
    }));

    current += 1_000;
    const second = await assessmentService.request({ companyNumber: "12345678" });

    expect(extractionCalls).toBe(2);
    expect(second.body).toEqual(expect.objectContaining({ assessmentId: "asmt_2" }));
  });
});
