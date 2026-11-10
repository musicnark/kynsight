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
  vettClient: VettClient = client(),
): AssessmentService {
  const store = new AssessmentStore();
  const vettQueue = new VettQueue(store, vettClient);
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
      threshold: 85,
      progress: { total: 0, terminal: 0, successful: 0, queued: 0, inProgress: 0 },
      subjects: [],
    }));
  });

  it("reuses the latest compatible assessment for repeated refresh-false requests", async () => {
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

    const first = await assessmentService.request({ companyNumber: "12345678" });
    const second = await assessmentService.request({ companyNumber: "12345678", refresh: false });

    expect(extractionCalls).toBe(1);
    expect(second.body).toEqual(first.body);
  });

  it("creates a fresh assessment when refresh is true, including on repeats", async () => {
    const assessmentService = service(async (companyNumber) => ({
      ok: true,
      companyNumber: String(companyNumber),
      sourceRecords: { officers: [], pscs: [] },
      selection: selection(),
    }));

    const first = await assessmentService.request({ companyNumber: "12345678" });
    const second = await assessmentService.request({ companyNumber: "12345678", refresh: true });
    const third = await assessmentService.request({ companyNumber: "12345678", refresh: true });

    expect(first.body).not.toHaveProperty("assessmentId");
    expect(second.body).not.toHaveProperty("assessmentId");
    expect(third.body).not.toHaveProperty("assessmentId");
    expect(assessmentService.getStore().get("asmt_1")).toBeDefined();
    expect(assessmentService.getStore().get("asmt_2")).toBeDefined();
    expect(assessmentService.getStore().get("asmt_3")).toBeDefined();
  });

  it("makes a refreshed pending assessment the latest company assessment", async () => {
    let extractionCalls = 0;
    let screeningCalls = 0;
    let releaseScreening: (() => void) | undefined;
    const completedClient = client();
    const vettClient = {
      screen: async (name: string, threshold: number): Promise<VettAttemptResult> => {
        screeningCalls += 1;
        if (screeningCalls === 1) {
          return completedClient.screen(name, threshold);
        }
        return new Promise((resolve) => {
          releaseScreening = () => resolve({
            ok: true,
            body: {
              input: name,
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
          });
        });
      },
    } as unknown as VettClient;
    const firstSubject = {
      subjectId: "psc:1",
      subjectType: "INDIVIDUAL_PSC" as const,
      name: "PERSON 1",
      roles: ["psc"],
      confirmedPsc: true,
      selectionReason: "INDIVIDUAL_PSC" as const,
      sourceRefs: ["companies-house:psc:1"],
    };
    const assessmentService = service(async () => {
      extractionCalls += 1;
      return {
        ok: true,
        companyNumber: "12345678",
        sourceRecords: { officers: [], pscs: [] },
        selection: extractionCalls === 1
          ? selection([firstSubject])
          : selection([{ ...firstSubject, subjectId: "psc:2", name: "PERSON 2", sourceRefs: ["companies-house:psc:2"] }]),
      };
    }, vettClient);

    const first = await assessmentService.request({ companyNumber: "12345678", refresh: true, threshold: 85 });
    const firstRecord = assessmentService.getStore().get("asmt_1");
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    const firstState = JSON.stringify(firstRecord);
    const second = await assessmentService.request({ companyNumber: "12345678", refresh: true, threshold: 75 });
    const reused = await assessmentService.request({ companyNumber: "12345678", refresh: false });

    expect(extractionCalls).toBe(2);
    expect(screeningCalls).toBe(2);
    expect(first.body).toEqual(expect.objectContaining({ threshold: 85 }));
    expect(first.body).not.toHaveProperty("assessmentId");
    expect(firstRecord?.status).toBe("COMPLETE");
    expect(firstRecord?.subjects[0]?.screening.status).toBe("COMPLETE");
    expect(second.body).toEqual(expect.objectContaining({ threshold: 75, status: "PENDING" }));
    expect(second.body).not.toHaveProperty("assessmentId");
    expect(reused.body).toEqual(expect.objectContaining({ threshold: 75, status: "PENDING" }));
    expect(reused.body).not.toHaveProperty("assessmentId");
    expect(assessmentService.getStore().get("asmt_1")).toBe(firstRecord);
    expect(JSON.stringify(firstRecord)).toBe(firstState);
    expect(assessmentService.getStore().get("asmt_2")?.subjects[0]?.screening.status).toBe("IN_PROGRESS");
    releaseScreening?.();
  });

  it("passes the default and supplied threshold through to Vett", async () => {
    const thresholds: number[] = [];
    const vettClient = {
      screen: async (name: string, threshold: number): Promise<VettAttemptResult> => {
        thresholds.push(threshold);
        return {
          ok: true,
          body: {
            input: name,
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
        };
      },
    } as unknown as VettClient;
    const selectedSubject = {
      subjectId: "psc:1",
      subjectType: "INDIVIDUAL_PSC" as const,
      name: "PERSON 1",
      roles: ["psc"],
      confirmedPsc: true,
      selectionReason: "INDIVIDUAL_PSC" as const,
      sourceRefs: ["companies-house:psc:1"],
    };
    const assessmentService = service(async () => ({
      ok: true,
      companyNumber: "12345678",
      sourceRecords: { officers: [], pscs: [] },
      selection: selection([selectedSubject]),
    }), vettClient);

    await assessmentService.request({ companyNumber: "12345678" });
    await assessmentService.request({ companyNumber: "12345678", threshold: 90, refresh: true });

    expect(thresholds).toEqual([85, 90]);
  });

  it("keeps latest-assessment pointers independent for different companies", async () => {
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

    const first = await assessmentService.request({ companyNumber: "12345678", refresh: true, threshold: 75 });
    const second = await assessmentService.request({ companyNumber: "87654321", refresh: true, threshold: 90 });
    const reusedFirst = await assessmentService.request({ companyNumber: "12345678" });
    const reusedSecond = await assessmentService.request({ companyNumber: "87654321" });

    expect(extractionCalls).toBe(2);
    expect(reusedFirst.body).toEqual(expect.objectContaining({
      threshold: 75,
    }));
    expect(reusedSecond.body).toEqual(expect.objectContaining({
      threshold: 90,
    }));
    expect(assessmentService.getStore().latestForCompany("12345678")?.assessmentId).toBe("asmt_1");
    expect(assessmentService.getStore().latestForCompany("87654321")?.assessmentId).toBe("asmt_2");
  });

  it.each([
    null,
    49,
    101,
    85.5,
    "90",
  ])("rejects invalid threshold %s", async (threshold) => {
    const assessmentService = service(async () => ({
      ok: true,
      companyNumber: "12345678",
      sourceRecords: { officers: [], pscs: [] },
      selection: selection(),
    }));
    const result = await assessmentService.request({ companyNumber: "12345678", threshold });
    expect(result.statusCode).toBe(400);
    expect(result.body).toEqual(expect.objectContaining({
      assessmentError: expect.objectContaining({ code: "INVALID_REQUEST" }),
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
    expect(second.body).not.toHaveProperty("assessmentId");
    expect(store.latestForCompany("12345678")?.assessmentId).toBe("asmt_2");
  });
});
