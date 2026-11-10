import { describe, expect, it } from "vitest";
import type { SelectedSubject, SubjectSelection } from "../src/subjects/types.js";
import type { VettClient } from "../src/vett/client.js";
import type { VettAttemptResult } from "../src/vett/types.js";
import { AssessmentStore } from "../src/assessment/store.js";
import {
  MAX_QUEUED_VETT_SUBJECTS,
  VettQueue,
  type QueueClock,
} from "../src/assessment/queue.js";
import type { AssessmentRecord } from "../src/assessment/types.js";

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

function subject(index: number): SelectedSubject {
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

function selection(subjects: SelectedSubject[]): SubjectSelection {
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

function record(subjects: SelectedSubject[], assessmentId = "asmt_test"): AssessmentRecord {
  return {
    assessmentId,
    companyNumber: "12345678",
    fingerprint: "fingerprint",
    idempotencyKey: null,
    selection: selection(subjects),
    subjects: subjects.map((value) => ({ ...value, screening: { status: "QUEUED" as const } })),
    status: "PENDING",
    createdAt: 0,
  };
}

function successfulResult(input: string): VettAttemptResult {
  return {
    ok: true,
    body: successfulBody(input),
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

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("VettQueue", () => {
  it("processes duplicate names independently when subject identities differ", async () => {
    const store = new AssessmentStore();
    const names: string[] = [];
    const client = {
      screen: async (name: string): Promise<VettAttemptResult> => {
        names.push(name);
        return successfulResult(name);
      },
    } as unknown as VettClient;
    const queue = new VettQueue(store, client);
    const assessment = record([subject(1), { ...subject(2), name: "PERSON 1" }]);
    store.add(assessment);
    queue.enqueue(assessment);
    await queue.waitForIdle();

    expect(names).toEqual(["PERSON 1", "PERSON 1"]);
    expect(assessment.status).toBe("COMPLETE");
    expect(assessment.subjects.every((value) => value.screening.status === "COMPLETE")).toBe(true);
  });

  it("validates returned identity on the production queue path", async () => {
    const store = new AssessmentStore();
    const client = {
      screen: async (): Promise<VettAttemptResult> => ({
        ok: true,
        body: successfulBody("A DIFFERENT PERSON"),
      }),
    } as unknown as VettClient;
    const queue = new VettQueue(store, client);
    const assessment = record([subject(1)]);
    store.add(assessment);
    queue.enqueue(assessment);
    await queue.waitForIdle();

    expect(assessment.status).toBe("COMPLETE");
    expect(assessment.subjects[0]?.screening).toEqual(expect.objectContaining({
      status: "ERROR",
      error: expect.objectContaining({ code: "VETT_MALFORMED_RESPONSE" }),
    }));
  });

  it("enforces the rolling request limit with deterministic fake time", async () => {
    const store = new AssessmentStore();
    const clock = new FakeClock();
    let calls = 0;
    const client = {
      screen: async (): Promise<VettAttemptResult> => {
        calls += 1;
        return successfulResult("Example");
      },
    } as unknown as VettClient;
    const queue = new VettQueue(store, client, {
      requestsPerMinute: 2,
      clock,
    });
    const assessment = record([subject(1), subject(2), subject(3)]);
    store.add(assessment);
    queue.enqueue(assessment);
    await flush();

    expect(calls).toBe(2);
    expect(assessment.subjects[2]?.screening.status).toBe("QUEUED");
    clock.advance(60_000);
    await queue.waitForIdle();

    expect(calls).toBe(3);
    expect(assessment.status).toBe("COMPLETE");
  });

  it("retries transient failures and preserves the successful result", async () => {
    const store = new AssessmentStore();
    const clock = new FakeClock();
    let calls = 0;
    const client = {
      screen: async (): Promise<VettAttemptResult> => {
        calls += 1;
        if (calls === 1) {
          return {
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
          };
        }
        return successfulResult("PERSON 1");
      },
    } as unknown as VettClient;
    const queue = new VettQueue(store, client, { clock, retryBaseDelayMs: 10 });
    const assessment = record([subject(1)]);
    store.add(assessment);
    queue.enqueue(assessment);
    await flush();

    expect(calls).toBe(1);
    expect(assessment.subjects[0]?.screening.status).toBe("QUEUED");
    clock.advance(1_000);
    await queue.waitForIdle();

    expect(calls).toBe(2);
    expect(assessment.status).toBe("COMPLETE");
    expect(assessment.subjects[0]?.screening).toEqual(expect.objectContaining({
      status: "COMPLETE",
      attempts: 2,
    }));
  });

  it("keeps permanent subject errors separate from successful subjects", async () => {
    const store = new AssessmentStore();
    const client = {
      screen: async (name: string): Promise<VettAttemptResult> => name === "PERSON 1"
        ? {
            ok: false,
            error: {
              kind: "MALFORMED_RESPONSE",
              source: "VETT",
              code: "VETT_MALFORMED_RESPONSE",
              message: "Malformed.",
              retryable: false,
              scope: "SUBJECT",
            },
          }
        : successfulResult(name),
    } as unknown as VettClient;
    const queue = new VettQueue(store, client);
    const assessment = record([subject(1), subject(2)]);
    store.add(assessment);
    queue.enqueue(assessment);
    await queue.waitForIdle();

    expect(assessment.status).toBe("COMPLETE");
    expect(assessment.subjects[0]?.screening.status).toBe("ERROR");
    expect(assessment.subjects[1]?.screening.status).toBe("COMPLETE");
    expect(store.snapshot(assessment).partial).toBe(true);
    expect(store.snapshot(assessment).assessmentError).toBeUndefined();
  });

  it("does not let an assessment-level failure consume subject capacity", async () => {
    const store = new AssessmentStore();
    const client = {
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
    const queue = new VettQueue(store, client);
    const assessment = record([subject(1), subject(2)]);
    store.add(assessment);
    queue.enqueue(assessment);
    await queue.waitForIdle();

    expect(assessment.status).toBe("ERROR");
    expect(assessment.subjects[1]?.screening.status).toBe("QUEUED");
    expect(store.nonTerminalSubjectCount()).toBe(0);
    expect(queue.canAdmit(2)).toEqual({ ok: true });
  });

  it("marks queued and in-progress screening as partial", () => {
    const store = new AssessmentStore();
    const assessment = record([subject(1)]);
    store.add(assessment);

    expect(store.snapshot(assessment)).toEqual(expect.objectContaining({
      status: "PENDING",
      partial: true,
      progress: { total: 1, terminal: 0, successful: 0, queued: 1, inProgress: 0 },
    }));
  });

  it("marks an exhausted transient retry as terminal and non-retryable", async () => {
    const store = new AssessmentStore();
    const clock = new FakeClock();
    const client = {
      screen: async (): Promise<VettAttemptResult> => ({
        ok: false,
        error: {
          kind: "UPSTREAM_ERROR",
          source: "VETT",
          code: "VETT_TIMEOUT",
          message: "Timed out.",
          retryable: true,
          scope: "SUBJECT",
        },
      }),
    } as unknown as VettClient;
    const queue = new VettQueue(store, client, {
      clock,
      maxAttempts: 2,
      retryBaseDelayMs: 1,
    });
    const assessment = record([subject(1)]);
    store.add(assessment);
    queue.enqueue(assessment);
    await flush();
    clock.advance(1);
    await queue.waitForIdle();

    expect(assessment.status).toBe("COMPLETE");
    expect(assessment.subjects[0]?.screening).toEqual(expect.objectContaining({
      status: "ERROR",
      attempts: 2,
      error: expect.objectContaining({ code: "VETT_TIMEOUT", retryable: false }),
    }));
  });

  it.each([50, 100])("processes %s subjects across multiple rolling rate windows", async (subjectCount) => {
    const store = new AssessmentStore();
    const clock = new FakeClock();
    const requestStarts: number[] = [];
    const client = {
      screen: async (name: string): Promise<VettAttemptResult> => {
        requestStarts.push(clock.now());
        return successfulResult(name);
      },
    } as unknown as VettClient;
    const queue = new VettQueue(store, client, {
      clock,
      maxQueuedVettSubjects: subjectCount,
    });
    const assessment = record(Array.from({ length: subjectCount }, (_, index) => subject(index)));
    store.add(assessment);
    queue.enqueue(assessment);
    await flush();

    while (assessment.status === "PENDING") {
      clock.advance(60_000);
      await flush();
    }
    await queue.waitForIdle();

    expect(assessment.status).toBe("COMPLETE");
    expect(assessment.subjects.every((value) => value.screening.status === "COMPLETE")).toBe(true);
    expect(requestStarts).toHaveLength(subjectCount);
    for (let index = 10; index < requestStarts.length; index += 1) {
      expect(requestStarts[index]! - requestStarts[index - 10]!).toBeGreaterThanOrEqual(60_000);
    }
  });

  it("resets the local monthly budget at the next UTC calendar month", async () => {
    const store = new AssessmentStore();
    const clock = new FakeClock(Date.UTC(2026, 0, 31, 23, 59, 59));
    const client = {
      screen: async (): Promise<VettAttemptResult> => successfulResult("Example"),
    } as unknown as VettClient;
    const queue = new VettQueue(store, client, { clock, requestsPerMonth: 1 });

    const first = record([subject(1)], "asmt_first");
    store.add(first);
    queue.enqueue(first);
    await queue.waitForIdle();

    const second = record([subject(2)], "asmt_second");
    store.add(second);
    queue.enqueue(second);
    await queue.waitForIdle();
    expect(second.subjects[0]?.screening).toEqual(expect.objectContaining({
      status: "ERROR",
      error: expect.objectContaining({ code: "VETT_RATE_LIMITED" }),
    }));

    clock.advance(1_000);
    const third = record([subject(3)], "asmt_third");
    store.add(third);
    queue.enqueue(third);
    await queue.waitForIdle();
    expect(third.status).toBe("COMPLETE");
  });

  it("admits a complete assessment atomically against the subject cap", () => {
    const store = new AssessmentStore();
    const client = { screen: async (): Promise<VettAttemptResult> => successfulResult("Example") } as unknown as VettClient;
    const queue = new VettQueue(store, client);

    expect(queue.canAdmit(MAX_QUEUED_VETT_SUBJECTS)).toEqual({ ok: true });
    const first = record(Array.from({ length: MAX_QUEUED_VETT_SUBJECTS }, (_, index) => subject(index)));
    store.add(first);
    expect(queue.canAdmit(1).ok).toBe(false);
    expect(store.get(first.assessmentId)?.subjects).toHaveLength(MAX_QUEUED_VETT_SUBJECTS);
  });
});
