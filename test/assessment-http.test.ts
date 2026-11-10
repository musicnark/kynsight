import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { CompaniesHouseClient } from "../src/companies-house/client.js";
import { AssessmentService } from "../src/assessment/service.js";
import { AssessmentStore } from "../src/assessment/store.js";
import { VettQueue, type QueueClock, type QueueConfig } from "../src/assessment/queue.js";
import { createKynSightServer } from "../src/http/server.js";
import type { SubjectExtractionResult } from "../src/subjects/service.js";
import type { SelectedSubject } from "../src/subjects/types.js";
import type { VettClient } from "../src/vett/client.js";
import type { VettAttemptResult } from "../src/vett/types.js";
import type { AssessmentRecord } from "../src/assessment/types.js";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

interface Harness {
  server: Server;
  store: AssessmentStore;
  queue: VettQueue;
}

interface HarnessOptions {
  vettClient?: VettClient;
  queueConfig?: QueueConfig;
  subjectExtraction?: () => Promise<SubjectExtractionResult>;
}

function makeServer(options: HarnessOptions = {}): Server {
  return makeHarness(options).server;
}

function makeHarness(options: HarnessOptions = {}): Harness {
  const store = new AssessmentStore();
  const vettClient = options.vettClient ?? {
    screen: async (input: string): Promise<VettAttemptResult> => ({
      ok: true,
      body: successfulBody(input),
    }),
  } as unknown as VettClient;
  const queue = new VettQueue(store, vettClient, options.queueConfig);
  const service = new AssessmentService({
    companiesHouseClient: new CompaniesHouseClient({ apiKey: "test-key" }),
    queue,
    store,
    subjectExtraction: options.subjectExtraction ?? emptyExtraction,
  });
  const server = createKynSightServer({ assessmentService: service });
  servers.push(server);
  return { server, store, queue };
}

function emptyExtraction(): Promise<SubjectExtractionResult> {
  return Promise.resolve({
    ok: true,
    companyNumber: "12345678",
    sourceRecords: { officers: [], pscs: [] },
    selection: {
      subjectSelection: {
        individualPscCount: 0,
        corporatePscCount: 0,
        fallbackUsed: false,
        directorFallbackUsed: false,
        corporateControlChainResolved: false,
      },
      subjects: [],
      corporatePscRecords: [],
      unknownPscRecords: [],
      unusablePscRecords: [],
      unusableOfficerRecords: [],
      unresolved: [],
    },
  });
}

function selectedSubject(index = 1): SelectedSubject {
  return {
    subjectId: `psc:${index}`,
    subjectType: "INDIVIDUAL_PSC",
    name: `PERSON ${index}`,
    roles: ["psc"],
    confirmedPsc: true,
    selectionReason: "INDIVIDUAL_PSC",
    sourceRefs: [`companies-house:psc:${index}`],
  };
}

function successfulBody(input: string): Record<string, unknown> {
  return {
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
  };
}

function extractionWithSubjects(subjects: SelectedSubject[]): Promise<SubjectExtractionResult> {
  return Promise.resolve({
    ok: true,
    companyNumber: "12345678",
    sourceRecords: { officers: [], pscs: [] },
    selection: {
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
    },
  });
}

function assessmentRecord(assessmentId: string, subjectCount = 0): AssessmentRecord {
  const subjects = Array.from({ length: subjectCount }, (_, index) => selectedSubject(index + 1));
  return {
    assessmentId,
    companyNumber: "99999999",
    threshold: 85,
    fingerprint: assessmentId,
    selection: {
      subjectSelection: {
        individualPscCount: subjectCount,
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
    },
    subjects: subjects.map((subject) => ({ ...subject, screening: { status: "QUEUED" as const } })),
    status: "PENDING",
    createdAt: 0,
  };
}

class FakeClock implements QueueClock {
  private current: number;
  private readonly sleepers: Array<{ target: number; resolve: () => void }> = [];

  public constructor(start = 0) {
    this.current = start;
  }

  public now(): number {
    return this.current;
  }

  public sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      this.sleepers.push({ target: this.current + milliseconds, resolve });
    });
  }

  public random(): number {
    return 0;
  }

  public advance(milliseconds: number): void {
    this.current += milliseconds;
    const ready = this.sleepers.filter((sleeper) => sleeper.target <= this.current);
    this.sleepers.splice(0, this.sleepers.length, ...this.sleepers.filter((sleeper) => sleeper.target > this.current));
    for (const sleeper of ready) {
      sleeper.resolve();
    }
  }
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Test server did not expose a TCP address.");
  }
  return `http://127.0.0.1:${address.port}`;
}

describe("assessment HTTP seam", () => {
  it("keeps the health response and returns JSON assessment responses", async () => {
    const baseUrl = await listen(makeServer());
    const health = await fetch(`${baseUrl}/`);
    expect(health.status).toBe(200);
    expect(health.headers.get("content-type")).toContain("application/json");
    expect(await health.json()).toEqual({ name: "KynSight", status: "ok" });

    const assessment = await fetch(`${baseUrl}/assessments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyNumber: "12345678" }),
    });
    expect(assessment.status).toBe(200);
    expect(assessment.headers.get("content-type")).toContain("application/json");
    expect(await assessment.json()).toEqual(expect.objectContaining({ status: "COMPLETE" }));
  });

  it("returns 400 for invalid JSON without starting an assessment", async () => {
    const baseUrl = await listen(makeServer());
    const response = await fetch(`${baseUrl}/assessments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual(expect.objectContaining({
      status: "ERROR",
      assessmentError: expect.objectContaining({ code: "INVALID_REQUEST" }),
    }));
  });

  it("returns 400 for invalid client input", async () => {
    const baseUrl = await listen(makeServer());
    const response = await fetch(`${baseUrl}/assessments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyNumber: "not-valid!" }),
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual(expect.objectContaining({
      status: "ERROR",
      assessmentError: expect.objectContaining({ code: "INVALID_REQUEST" }),
    }));
  });

  it("rejects request bodies over the HTTP limit without starting an assessment", async () => {
    let extractionCalls = 0;
    const baseUrl = await listen(makeServer({
      subjectExtraction: async () => {
        extractionCalls += 1;
        return emptyExtraction();
      },
    }));
    const response = await fetch(`${baseUrl}/assessments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyNumber: "12345678", padding: "x".repeat(1_000_100) }),
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual(expect.objectContaining({
      status: "ERROR",
      assessmentError: expect.objectContaining({ code: "INVALID_REQUEST" }),
    }));
    expect(extractionCalls).toBe(0);
  });

  it("returns the documented JSON error for unsupported routes and methods", async () => {
    const baseUrl = await listen(makeServer());
    const unsupportedRoute = await fetch(`${baseUrl}/unsupported`);
    const unsupportedMethod = await fetch(`${baseUrl}/assessments`, { method: "GET" });

    expect(unsupportedRoute.status).toBe(404);
    expect(unsupportedRoute.headers.get("content-type")).toContain("application/json");
    expect(await unsupportedRoute.json()).toEqual(expect.objectContaining({
      status: "ERROR",
      assessmentError: expect.objectContaining({ code: "NOT_FOUND" }),
    }));
    expect(unsupportedMethod.status).toBe(404);
    expect(unsupportedMethod.headers.get("content-type")).toContain("application/json");
    expect(await unsupportedMethod.json()).toEqual(expect.objectContaining({
      status: "ERROR",
      assessmentError: expect.objectContaining({ code: "NOT_FOUND" }),
    }));
  });

  it("returns 202 with selected subjects that are still queued", async () => {
    const clock = new FakeClock();
    const vettClient = {
      screen: async (): Promise<VettAttemptResult> => new Promise(() => undefined),
    } as unknown as VettClient;
    const baseUrl = await listen(makeServer({
      vettClient,
      queueConfig: { clock },
      subjectExtraction: () => extractionWithSubjects([selectedSubject()]),
    }));
    const response = await fetch(`${baseUrl}/assessments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyNumber: "12345678" }),
    });
    const body = await response.json() as { status: string; subjects: Array<{ screening: { status: string } }> };

    expect(response.status).toBe(202);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body.status).toBe("PENDING");
    expect(body.subjects[0]?.screening.status).toBe("IN_PROGRESS");
  });

  it("returns 200 when all selected subjects complete successfully", async () => {
    const harness = makeHarness({
      subjectExtraction: () => extractionWithSubjects([selectedSubject(1), selectedSubject(2)]),
    });
    const baseUrl = await listen(harness.server);
    const first = await fetch(`${baseUrl}/assessments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyNumber: "12345678" }),
    });
    await first.json();
    await harness.queue.waitForIdle();
    const response = await fetch(`${baseUrl}/assessments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyNumber: "12345678" }),
    });
    const body = await response.json() as {
      status: string;
      partial: boolean;
      subjects: Array<{ screening: { status: string; result?: unknown } }>;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body).not.toHaveProperty("assessmentId");
    expect(body.status).toBe("COMPLETE");
    expect(body.partial).toBe(false);
    expect(body.subjects.every((subject) => subject.screening.status === "COMPLETE")).toBe(true);
    expect(body.subjects.every((subject) => subject.screening.result !== undefined)).toBe(true);
  });

  it("returns 200 for terminal subject errors without promoting them to assessment errors", async () => {
    const vettClient = {
      screen: async (): Promise<VettAttemptResult> => ({
        ok: false,
        error: {
          kind: "MALFORMED_RESPONSE",
          source: "VETT",
          code: "VETT_MALFORMED_RESPONSE",
          message: "Malformed.",
          retryable: false,
          scope: "SUBJECT",
        },
      }),
    } as unknown as VettClient;
    const harness = makeHarness({
      vettClient,
      subjectExtraction: () => extractionWithSubjects([selectedSubject()]),
    });
    const baseUrl = await listen(harness.server);
    const first = await fetch(`${baseUrl}/assessments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyNumber: "12345678" }),
    });
    await first.json();
    await harness.queue.waitForIdle();
    const response = await fetch(`${baseUrl}/assessments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyNumber: "12345678" }),
    });
    const body = await response.json() as { status: string; partial: boolean; assessmentError?: unknown };

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body).toEqual(expect.objectContaining({ status: "COMPLETE", partial: true }));
    expect(body.assessmentError).toBeUndefined();
  });

  it("returns 502 for an assessment-level provider failure", async () => {
    const vettClient = {
      screen: async (): Promise<VettAttemptResult> => ({
        ok: false,
        error: {
          kind: "UPSTREAM_ERROR",
          source: "VETT",
          code: "VETT_AUTHENTICATION",
          message: "Authentication failed.",
          retryable: false,
          scope: "ASSESSMENT",
        },
      }),
    } as unknown as VettClient;
    const harness = makeHarness({
      vettClient,
      subjectExtraction: () => extractionWithSubjects([selectedSubject()]),
    });
    const baseUrl = await listen(harness.server);
    const first = await fetch(`${baseUrl}/assessments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyNumber: "12345678" }),
    });
    await first.json();
    await harness.queue.waitForIdle();
    const response = await fetch(`${baseUrl}/assessments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyNumber: "12345678" }),
    });
    const body = await response.json() as { status: string; assessmentError: { code: string } };

    expect(response.status).toBe(502);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body).toEqual(expect.objectContaining({
      status: "ERROR",
      assessmentError: expect.objectContaining({ code: "VETT_AUTHENTICATION" }),
    }));
  });

  it("returns 503 when active assessment capacity is full", async () => {
    const harness = makeHarness({ subjectExtraction: () => extractionWithSubjects([selectedSubject()]) });
    for (let index = 0; index < 3; index += 1) {
      harness.store.add(assessmentRecord(`asmt_${index}`));
    }
    const baseUrl = await listen(harness.server);
    const response = await fetch(`${baseUrl}/assessments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyNumber: "12345678" }),
    });
    const body = await response.json() as { status: string; assessmentError: { code: string } };

    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body).toEqual(expect.objectContaining({
      status: "ERROR",
      assessmentError: expect.objectContaining({ code: "QUEUE_CAPACITY_EXCEEDED", retryable: true }),
    }));
  });

  it("keeps a short-term Vett rate limit queued and retries after the fake clock advances", async () => {
    const clock = new FakeClock();
    let calls = 0;
    const vettClient = {
      screen: async (input: string): Promise<VettAttemptResult> => {
        calls += 1;
        return calls === 1
          ? {
              ok: false,
              error: {
                kind: "UPSTREAM_ERROR",
                source: "VETT",
                code: "VETT_RATE_LIMITED",
                message: "Rate limited.",
                retryable: true,
                scope: "SUBJECT",
                retryAfterSeconds: 1,
              },
            }
          : { ok: true, body: successfulBody(input) };
      },
    } as unknown as VettClient;
    const harness = makeHarness({
      vettClient,
      queueConfig: { clock },
      subjectExtraction: () => extractionWithSubjects([selectedSubject()]),
    });
    const baseUrl = await listen(harness.server);
    const first = await fetch(`${baseUrl}/assessments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyNumber: "12345678" }),
    });
    await first.json();
    expect(first.status).toBe(202);
    expect(first.headers.get("content-type")).toContain("application/json");
    await flush();
    const queued = await fetch(`${baseUrl}/assessments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyNumber: "12345678" }),
    });
    const queuedBody = await queued.json() as { status: string; subjects: Array<{ screening: { status: string } }> };

    expect(queued.status).toBe(202);
    expect(queuedBody.status).toBe("PENDING");
    expect(queuedBody.subjects[0]?.screening.status).toBe("QUEUED");
    clock.advance(1_000);
    await harness.queue.waitForIdle();

    expect(calls).toBe(2);
  });

  it("retries a Vett 5xx and returns the successful terminal assessment", async () => {
    const clock = new FakeClock();
    let calls = 0;
    const vettClient = {
      screen: async (input: string): Promise<VettAttemptResult> => {
        calls += 1;
        return calls === 1
          ? {
              ok: false,
              error: {
                kind: "UPSTREAM_ERROR",
                source: "VETT",
                code: "VETT_UPSTREAM",
                message: "Server failure.",
                retryable: true,
                scope: "SUBJECT",
                retryAfterSeconds: 1,
              },
            }
          : { ok: true, body: successfulBody(input) };
      },
    } as unknown as VettClient;
    const harness = makeHarness({
      vettClient,
      queueConfig: { clock },
      subjectExtraction: () => extractionWithSubjects([selectedSubject()]),
    });
    const baseUrl = await listen(harness.server);
    const first = await fetch(`${baseUrl}/assessments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyNumber: "12345678" }),
    });
    await first.json();
    await flush();
    clock.advance(1_000);
    await harness.queue.waitForIdle();
    const response = await fetch(`${baseUrl}/assessments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyNumber: "12345678" }),
    });
    const body = await response.json() as { status: string; partial: boolean };

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body).toEqual(expect.objectContaining({ status: "COMPLETE", partial: false }));
    expect(calls).toBe(2);
  });

  it("returns 200 with a per-subject malformed-response error", async () => {
    const vettClient = {
      screen: async (): Promise<VettAttemptResult> => ({
        ok: true,
        body: { ...successfulBody("PERSON 1"), matches: [{ invalid: true }] },
      }),
    } as unknown as VettClient;
    const harness = makeHarness({
      vettClient,
      subjectExtraction: () => extractionWithSubjects([selectedSubject()]),
    });
    const baseUrl = await listen(harness.server);
    const first = await fetch(`${baseUrl}/assessments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyNumber: "12345678" }),
    });
    await first.json();
    const harnessStore = harness.store;
    await harness.queue.waitForIdle();
    const response = await fetch(`${baseUrl}/assessments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyNumber: "12345678" }),
    });
    const body = await response.json() as {
      status: string;
      partial: boolean;
      subjects: Array<{ screening: { error?: { code: string } } }>;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body).toEqual(expect.objectContaining({ status: "COMPLETE", partial: true }));
    expect(body.subjects[0]?.screening.error?.code).toBe("VETT_MALFORMED_RESPONSE");
    expect(harnessStore.latestForCompany("12345678")?.subjects[0]?.screening.status).toBe("ERROR");
  });

  it.each([50, 100])("returns a complete HTTP envelope after %s queued subjects", async (subjectCount) => {
    const clock = new FakeClock();
    const harness = makeHarness({
      queueConfig: { clock, maxQueuedVettSubjects: subjectCount },
      subjectExtraction: () => extractionWithSubjects(
        Array.from({ length: subjectCount }, (_, index) => selectedSubject(index + 1)),
      ),
    });
    const baseUrl = await listen(harness.server);
    const first = await fetch(`${baseUrl}/assessments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyNumber: "12345678" }),
    });
    await first.json();
    expect(first.status).toBe(202);
    expect(first.headers.get("content-type")).toContain("application/json");
    await flush();
    while (harness.store.latestForCompany("12345678")?.status === "PENDING") {
      clock.advance(60_000);
      await flush();
    }
    await harness.queue.waitForIdle();
    const response = await fetch(`${baseUrl}/assessments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyNumber: "12345678" }),
    });
    const body = await response.json() as { status: string; partial: boolean; progress: { total: number } };

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body).toEqual(expect.objectContaining({ status: "COMPLETE", partial: false }));
    expect(body.progress.total).toBe(subjectCount);
  });

  it("returns 500 with safe JSON for unexpected KynSight failures", async () => {
    const harness = makeHarness({
      subjectExtraction: async () => {
        throw new Error("internal secret");
      },
    });
    const baseUrl = await listen(harness.server);
    const response = await fetch(`${baseUrl}/assessments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyNumber: "12345678" }),
    });
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(text).not.toContain("internal secret");
    expect(JSON.parse(text)).toEqual(expect.objectContaining({
      status: "ERROR",
      assessmentError: expect.objectContaining({ code: "INTERNAL_ERROR" }),
    }));
  });
});
