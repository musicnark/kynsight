import { randomUUID } from "node:crypto";
import { CompaniesHouseClient } from "../companies-house/client.js";
import { extractSubjectsForCompany } from "../subjects/service.js";
import type { SubjectSelection } from "../subjects/types.js";
import type {
  AssessmentError,
  AssessmentRecord,
  AssessmentSnapshot,
  AssessmentValidationError,
} from "./types.js";
import { AssessmentStore } from "./store.js";
import { VettQueue } from "./queue.js";
import {
  DEFAULT_VETT_THRESHOLD,
  MAX_VETT_THRESHOLD,
  MIN_VETT_THRESHOLD,
} from "../vett/types.js";

const SCREENING_POLICY_VERSION = "vett-fixture-v0";

export interface AssessmentServiceOptions {
  companiesHouseClient: CompaniesHouseClient;
  queue: VettQueue;
  store?: AssessmentStore;
  assessmentIdGenerator?: () => string;
  subjectExtraction?: typeof extractSubjectsForCompany;
  now?: () => number;
}

export interface AssessmentHttpResult {
  statusCode: number;
  body: AssessmentSnapshot | Record<string, unknown>;
  headers?: Record<string, string>;
}

export class AssessmentService {
  private readonly companiesHouseClient: CompaniesHouseClient;
  private readonly queue: VettQueue;
  private readonly store: AssessmentStore;
  private readonly assessmentIdGenerator: () => string;
  private readonly subjectExtraction: typeof extractSubjectsForCompany;
  private readonly now: () => number;

  public constructor(options: AssessmentServiceOptions) {
    this.companiesHouseClient = options.companiesHouseClient;
    this.queue = options.queue;
    this.store = options.store ?? new AssessmentStore();
    this.assessmentIdGenerator = options.assessmentIdGenerator ?? (() => `asmt_${randomUUID()}`);
    this.subjectExtraction = options.subjectExtraction ?? extractSubjectsForCompany;
    this.now = options.now ?? (() => Date.now());
  }

  public getStore(): AssessmentStore {
    return this.store;
  }

  public async request(input: unknown): Promise<AssessmentHttpResult> {
    const validated = validateRequest(input);
    if (!validated.ok) {
      return badRequest(validated.error);
    }

    if (!validated.refresh) {
      const latest = this.store.latestForCompany(validated.companyNumber);
      if (
        latest !== undefined
        && !isReadyForBudgetRetry(latest, this.now())
      ) {
        if (latest.status === "PENDING") {
          this.queue.enqueue(latest);
        }
        return this.snapshotResult(latest);
      }
    }

    const extraction = await this.subjectExtraction(
      validated.companyNumber,
      this.companiesHouseClient,
    );
    if (!extraction.ok) {
      const record = this.errorRecord(
        validated.companyNumber,
        validated.threshold,
        validated.fingerprint,
        extraction.failure,
      );
      this.store.add(record);
      return {
        statusCode: 502,
        body: this.store.snapshot(record),
      };
    }

    const admission = this.queue.canAdmit(extraction.selection.subjects.length);
    if (!admission.ok) {
      const headers = admission.retryAfterSeconds === undefined
        ? undefined
        : { "Retry-After": String(admission.retryAfterSeconds) };
      return {
        statusCode: 503,
        body: {
          status: "ERROR",
          partial: false,
          assessmentError: {
            code: "QUEUE_CAPACITY_EXCEEDED",
            message: "The assessment and subject queues are currently full.",
            retryable: true,
          },
        },
        ...(headers === undefined ? {} : { headers }),
      };
    }

    const record: AssessmentRecord = {
      assessmentId: this.assessmentIdGenerator(),
      companyNumber: validated.companyNumber,
      threshold: validated.threshold,
      fingerprint: validated.fingerprint,
      selection: extraction.selection,
      subjects: extraction.selection.subjects.map((subject) => ({
        ...subject,
        screening: { status: "QUEUED" },
      })),
      status: extraction.selection.subjects.length === 0 ? "COMPLETE" : "PENDING",
      createdAt: this.now(),
    };
    this.store.add(record);

    if (record.status === "PENDING") {
      this.queue.enqueue(record);
    }

    return this.snapshotResult(record);
  }

  private snapshotResult(record: AssessmentRecord): AssessmentHttpResult {
    const snapshot = this.store.snapshot(record);
    return {
      statusCode: snapshot.status === "PENDING" ? 202 : snapshot.status === "ERROR" ? 502 : 200,
      body: snapshot,
    };
  }

  private errorRecord(
    companyNumber: string,
    threshold: number,
    fingerprint: string,
    failure: {
      code: string;
      message: string;
      retryable: boolean;
      upstreamErrors?: Array<{ code: string }>;
    },
  ): AssessmentRecord {
    const code = failure.upstreamErrors?.[0]?.code ?? failure.code;
    const assessmentError: AssessmentError = {
      code,
      message: failure.message,
      retryable: failure.retryable,
      scope: "ASSESSMENT",
    };
    return {
      assessmentId: this.assessmentIdGenerator(),
      companyNumber,
      threshold,
      fingerprint,
      selection: emptySelection(),
      subjects: [],
      status: "ERROR",
      assessmentError,
      createdAt: this.now(),
    };
  }
}

function isReadyForBudgetRetry(record: AssessmentRecord, now: number): boolean {
  return record.status === "COMPLETE" && record.subjects.some((subject) => (
    subject.screening.status === "ERROR"
    && subject.screening.error.code === "VETT_RATE_LIMITED"
    && subject.screening.error.nextAttemptAt !== undefined
    && Date.parse(subject.screening.error.nextAttemptAt) <= now
  ));
}

function validateRequest(input: unknown):
  | {
      ok: true;
      companyNumber: string;
      threshold: number;
      refresh: boolean;
      fingerprint: string;
    }
  | { ok: false; error: AssessmentValidationError } {
  if (!isRecord(input)) {
    return { ok: false, error: invalidRequest("The assessment request must be a JSON object.") };
  }

  const companyNumber = typeof input.companyNumber === "string"
    ? input.companyNumber.trim().toUpperCase()
    : null;
  if (companyNumber === null || !/^[A-Z0-9]{1,8}$/.test(companyNumber)) {
    return { ok: false, error: invalidRequest("companyNumber must be a one-to-eight character alphanumeric string.") };
  }

  const threshold = input.threshold === undefined ? DEFAULT_VETT_THRESHOLD : input.threshold;
  if (
    typeof threshold !== "number"
    || !Number.isInteger(threshold)
    || threshold < MIN_VETT_THRESHOLD
    || threshold > MAX_VETT_THRESHOLD
  ) {
    return {
      ok: false,
      error: invalidRequest(`threshold must be an integer between ${MIN_VETT_THRESHOLD} and ${MAX_VETT_THRESHOLD}.`),
    };
  }

  const refresh = input.refresh === undefined ? false : input.refresh;
  if (typeof refresh !== "boolean") {
    return { ok: false, error: invalidRequest("refresh must be a boolean when supplied.") };
  }

  return {
    ok: true,
    companyNumber,
    threshold,
    refresh,
    fingerprint: JSON.stringify({
      companyNumber,
      threshold,
      policy: SCREENING_POLICY_VERSION,
    }),
  };
}

function badRequest(error: AssessmentValidationError): AssessmentHttpResult {
  return {
    statusCode: 400,
    body: {
      status: "ERROR",
      partial: false,
      assessmentError: error,
    },
  };
}

function emptySelection(): SubjectSelection {
  return {
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
  };
}

function invalidRequest(message: string): AssessmentValidationError {
  return { code: "INVALID_REQUEST", message, retryable: false };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
