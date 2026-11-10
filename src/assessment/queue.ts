import { normalizeVettResponse } from "../vett/adapter.js";
import { normalizeVettInputName, type VettClient } from "../vett/client.js";
import type { VettError } from "../vett/types.js";
import type { AssessmentRecord, AssessmentSubject } from "./types.js";
import { AssessmentStore, isTerminal } from "./store.js";

export const MAX_ACTIVE_ASSESSMENTS = 1;
export const MAX_QUEUED_ASSESSMENTS = 2;
export const MAX_QUEUED_VETT_SUBJECTS = 20;
export const MAX_VETT_REQUESTS_PER_MINUTE = 10;
export const MAX_VETT_REQUESTS_PER_MONTH = 100;
export const DEFAULT_MAX_ATTEMPTS = 3;

export interface QueueClock {
  now(): number;
  sleep(milliseconds: number): Promise<void>;
  random(): number;
}

export interface QueueConfig {
  maxActiveAssessments?: number;
  maxQueuedAssessments?: number;
  maxQueuedVettSubjects?: number;
  requestsPerMinute?: number;
  requestsPerMonth?: number;
  maxAttempts?: number;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
  clock?: QueueClock;
}

export type QueueAdmission = {
  ok: true;
} | {
  ok: false;
  retryAfterSeconds?: number;
};

export class VettQueue {
  private readonly store: AssessmentStore;
  private readonly client: VettClient;
  private readonly maxActiveAssessments: number;
  private readonly maxQueuedAssessments: number;
  private readonly maxQueuedVettSubjects: number;
  private readonly requestsPerMinute: number;
  private readonly requestsPerMonth: number;
  private readonly maxAttempts: number;
  private readonly retryBaseDelayMs: number;
  private readonly retryMaxDelayMs: number;
  private readonly clock: QueueClock;
  private readonly assessmentIds: string[] = [];
  private readonly requestStarts: number[] = [];
  private monthlyBudgetKey: string;
  private monthlyRequests = 0;
  private running = false;
  private idleWaiters: Array<() => void> = [];
  private wakeWaiters: Array<() => void> = [];

  public constructor(store: AssessmentStore, client: VettClient, config: QueueConfig = {}) {
    this.store = store;
    this.client = client;
    this.maxActiveAssessments = config.maxActiveAssessments ?? MAX_ACTIVE_ASSESSMENTS;
    this.maxQueuedAssessments = config.maxQueuedAssessments ?? MAX_QUEUED_ASSESSMENTS;
    this.maxQueuedVettSubjects = config.maxQueuedVettSubjects ?? MAX_QUEUED_VETT_SUBJECTS;
    this.requestsPerMinute = config.requestsPerMinute ?? MAX_VETT_REQUESTS_PER_MINUTE;
    this.requestsPerMonth = config.requestsPerMonth ?? MAX_VETT_REQUESTS_PER_MONTH;
    this.maxAttempts = config.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.retryBaseDelayMs = config.retryBaseDelayMs ?? 1_000;
    this.retryMaxDelayMs = config.retryMaxDelayMs ?? 60_000;
    this.clock = config.clock ?? realClock;
    this.monthlyBudgetKey = monthKey(this.clock.now());
  }

  public canAdmit(subjectCount: number): QueueAdmission {
    const assessmentLimit = this.maxActiveAssessments + this.maxQueuedAssessments;
    if (this.store.activeAssessmentCount() >= assessmentLimit) {
      return { ok: false };
    }

    if (this.store.nonTerminalSubjectCount() + subjectCount > this.maxQueuedVettSubjects) {
      const retryAfterSeconds = this.nextRateWindowSeconds();
      return retryAfterSeconds === undefined
        ? { ok: false }
        : { ok: false, retryAfterSeconds };
    }

    return { ok: true };
  }

  public enqueue(record: AssessmentRecord): void {
    if (!this.assessmentIds.includes(record.assessmentId)) {
      this.assessmentIds.push(record.assessmentId);
    }
    this.wake();
    void this.pump();
  }

  public waitForIdle(): Promise<void> {
    if (!this.running && this.assessmentIds.length === 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.idleWaiters.push(resolve);
    });
  }

  private async pump(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      while (this.assessmentIds.length > 0) {
        this.removeTerminalAssessments();
        if (this.assessmentIds.length === 0) {
          break;
        }

        this.resetMonthlyBudgetIfNeeded();
        if (this.monthlyRequests >= this.requestsPerMonth) {
          for (const assessmentId of this.assessmentIds) {
            const record = this.store.get(assessmentId);
            if (record?.status === "PENDING") {
              this.markBudgetExhausted(record);
            }
          }
          continue;
        }

        const eligible = this.nextEligibleSubject();
        if (eligible !== undefined) {
          this.pruneRequestStarts();
          const rateWaitMs = this.rateLimitWaitMs();
          if (rateWaitMs > 0) {
            await this.waitForWake(rateWaitMs);
            continue;
          }

          await this.screenSubject(eligible.record, eligible.subject);
          if (
            eligible.record.status === "PENDING"
            && !eligible.record.subjects.some((subject) => subject.screening.status === "QUEUED")
          ) {
            eligible.record.status = "COMPLETE";
          }
          continue;
        }

        const nextAttemptAt = this.nextAttemptAt();
        if (nextAttemptAt === undefined) {
          break;
        }
        const waitMs = Math.max(1, nextAttemptAt - this.clock.now());
        await this.waitForWake(waitMs);
      }
    } finally {
      this.running = false;
      const waiters = this.idleWaiters.splice(0);
      for (const resolve of waiters) {
        resolve();
      }
    }
  }

  private removeTerminalAssessments(): void {
    for (let index = this.assessmentIds.length - 1; index >= 0; index -= 1) {
      const record = this.store.get(this.assessmentIds[index]!);
      if (record === undefined || record.status !== "PENDING") {
        this.assessmentIds.splice(index, 1);
      }
    }
  }

  private nextEligibleSubject(): { record: AssessmentRecord; subject: AssessmentSubject } | undefined {
    const now = this.clock.now();
    for (const assessmentId of this.assessmentIds) {
      const record = this.store.get(assessmentId);
      if (record === undefined || record.status !== "PENDING") {
        continue;
      }
      const subject = record.subjects.find((candidate) => (
        candidate.screening.status === "QUEUED"
        && (
          candidate.screening.nextAttemptAt === undefined
          || Number.isNaN(Date.parse(candidate.screening.nextAttemptAt))
          || Date.parse(candidate.screening.nextAttemptAt) <= now
        )
      ));
      if (subject !== undefined) {
        return { record, subject };
      }
    }
    return undefined;
  }

  private nextAttemptAt(): number | undefined {
    let earliest: number | undefined;
    for (const assessmentId of this.assessmentIds) {
      const record = this.store.get(assessmentId);
      if (record === undefined || record.status !== "PENDING") {
        continue;
      }
      for (const subject of record.subjects) {
        if (subject.screening.status !== "QUEUED" || subject.screening.nextAttemptAt === undefined) {
          continue;
        }
        const nextAttemptAt = Date.parse(subject.screening.nextAttemptAt);
        if (!Number.isNaN(nextAttemptAt) && (earliest === undefined || nextAttemptAt < earliest)) {
          earliest = nextAttemptAt;
        }
      }
    }
    return earliest;
  }

  private waitForWake(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      const timeout = this.clock.sleep(milliseconds);
      const wake = new Promise<void>((wakeResolve) => {
        this.wakeWaiters.push(wakeResolve);
      });
      void Promise.race([timeout, wake]).then(() => resolve());
    });
  }

  private wake(): void {
    const waiters = this.wakeWaiters.splice(0);
    for (const resolve of waiters) {
      resolve();
    }
  }

  private async screenSubject(record: AssessmentRecord, subject: AssessmentSubject): Promise<void> {
    const previousAttempts = subject.screening.status === "QUEUED"
      ? subject.screening.error?.attempts ?? 0
      : 0;
    const attempts = previousAttempts + 1;
    const vettInput = normalizeVettInputName(subject.name);
    subject.screening = { status: "IN_PROGRESS", attempts };
    this.requestStarts.push(this.clock.now());
    this.monthlyRequests += 1;

    let response;
    try {
      response = await this.client.screen(vettInput, record.threshold);
    } catch {
      response = {
        ok: false as const,
        error: {
          kind: "UPSTREAM_ERROR" as const,
          source: "VETT" as const,
          code: "VETT_UPSTREAM" as const,
          message: "The Vett screening request failed unexpectedly.",
          retryable: true,
          scope: "SUBJECT" as const,
        },
      };
    }

    const result = response.ok
      ? normalizeVettResponse(response.body, vettInput)
      : response;
    if (result.ok) {
      subject.screening = {
        status: "COMPLETE",
        attempts,
        result: result.result,
      };
      return;
    }

    const error = { ...result.error, attempts };
    if (error.scope === "ASSESSMENT") {
      record.status = "ERROR";
      record.assessmentError = {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
        scope: "ASSESSMENT",
      };
      subject.screening = { status: "ERROR", attempts, error };
      return;
    }

    if (error.retryable && attempts < this.maxAttempts) {
      const delayMs = this.retryDelayMs(error, attempts);
      const nextAttemptAt = this.clock.now() + delayMs;
      subject.screening = {
        status: "QUEUED",
        error: { ...error, nextAttemptAt: new Date(nextAttemptAt).toISOString() },
        nextAttemptAt: new Date(nextAttemptAt).toISOString(),
      };
      return;
    }

    subject.screening = {
      status: "ERROR",
      attempts,
      error: error.retryable ? { ...error, retryable: false } : error,
    };
  }

  private markBudgetExhausted(record: AssessmentRecord): void {
    const nextAttemptAt = nextUtcMonthStart(this.clock.now());
    for (const subject of record.subjects) {
      if (isTerminal(subject.screening)) {
        continue;
      }

      const attempts = subject.screening.status === "IN_PROGRESS"
        ? subject.screening.attempts
        : subject.screening.status === "QUEUED"
          ? subject.screening.error?.attempts ?? 0
          : 0;
      subject.screening = {
        status: "ERROR",
        attempts,
        error: {
          kind: "UPSTREAM_ERROR",
          source: "VETT",
          code: "VETT_RATE_LIMITED",
          message: "The local monthly Vett request budget is exhausted; retry in a later assessment.",
          retryable: true,
          scope: "SUBJECT",
          attempts,
          nextAttemptAt,
        },
      };
    }
    record.status = "COMPLETE";
  }

  private retryDelayMs(error: VettError, attempts: number): number {
    const exponential = Math.min(
      this.retryMaxDelayMs,
      this.retryBaseDelayMs * (2 ** Math.max(0, attempts - 1)),
    );
    const jitter = Math.floor(this.clock.random() * Math.min(exponential, 250));
    const requested = error.retryAfterSeconds === undefined ? 0 : error.retryAfterSeconds * 1_000;
    return Math.max(requested, Math.min(this.retryMaxDelayMs, exponential + jitter));
  }

  private pruneRequestStarts(): void {
    const cutoff = this.clock.now() - 60_000;
    while (this.requestStarts[0] !== undefined && this.requestStarts[0] <= cutoff) {
      this.requestStarts.shift();
    }
  }

  private rateLimitWaitMs(): number {
    if (this.requestStarts.length < this.requestsPerMinute) {
      return 0;
    }
    const oldest = this.requestStarts[0];
    return oldest === undefined ? 0 : Math.max(1, oldest + 60_000 - this.clock.now());
  }

  private nextRateWindowSeconds(): number | undefined {
    this.pruneRequestStarts();
    const oldest = this.requestStarts[0];
    if (oldest === undefined) {
      return undefined;
    }
    return Math.ceil(Math.max(0, oldest + 60_000 - this.clock.now()) / 1_000);
  }

  private resetMonthlyBudgetIfNeeded(): void {
    const currentKey = monthKey(this.clock.now());
    if (currentKey !== this.monthlyBudgetKey) {
      this.monthlyBudgetKey = currentKey;
      this.monthlyRequests = 0;
    }
  }
}

const realClock: QueueClock = {
  now: () => Date.now(),
  sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  random: () => Math.random(),
};

function monthKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 7);
}

function nextUtcMonthStart(timestamp: number): string {
  const date = new Date(timestamp);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString();
}
