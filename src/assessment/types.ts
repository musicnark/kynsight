import type { SubjectSelection } from "../subjects/types.js";
import type { VettError, VettScreeningResult } from "../vett/types.js";

export type AssessmentStatus = "PENDING" | "COMPLETE" | "ERROR";
export type ScreeningStatus = "QUEUED" | "IN_PROGRESS" | "COMPLETE" | "ERROR";

export interface AssessmentRequest {
  companyNumber: unknown;
  threshold?: unknown;
  refresh?: unknown;
}

export interface AssessmentSubject {
  subjectId: string;
  subjectType: "INDIVIDUAL_PSC" | "DIRECTOR_FALLBACK";
  name: string;
  roles: string[];
  confirmedPsc: boolean;
  selectionReason: "INDIVIDUAL_PSC" | "CORPORATE_PSC_FALLBACK";
  sourceRefs: string[];
  screening: ScreeningState;
}

export type ScreeningState =
  | { status: "QUEUED"; error?: VettError; nextAttemptAt?: string }
  | { status: "IN_PROGRESS"; attempts: number }
  | { status: "COMPLETE"; attempts: number; result: VettScreeningResult }
  | { status: "ERROR"; attempts: number; error: VettError };

export interface AssessmentProgress {
  total: number;
  terminal: number;
  successful: number;
  queued: number;
  inProgress: number;
}

export interface AssessmentError {
  code: string;
  message: string;
  retryable: boolean;
  scope?: "ASSESSMENT";
}

export interface AssessmentSnapshot {
  companyNumber: string;
  threshold: number;
  status: AssessmentStatus;
  partial: boolean;
  progress: AssessmentProgress;
  subjectSelection: SubjectSelection["subjectSelection"];
  unresolved: SubjectSelection["unresolved"];
  corporatePscRecords: SubjectSelection["corporatePscRecords"];
  unknownPscRecords: SubjectSelection["unknownPscRecords"];
  subjects: AssessmentSubject[];
  assessmentError?: AssessmentError;
}

export interface AssessmentRecord {
  assessmentId: string;
  companyNumber: string;
  threshold: number;
  fingerprint: string;
  selection: SubjectSelection;
  subjects: AssessmentSubject[];
  status: AssessmentStatus;
  assessmentError?: AssessmentError;
  createdAt: number;
}

export interface AssessmentValidationError {
  code: string;
  message: string;
  retryable: false;
}
