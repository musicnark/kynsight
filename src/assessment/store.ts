import type {
  AssessmentRecord,
  AssessmentSnapshot,
  AssessmentSubject,
  ScreeningState,
} from "./types.js";

export class AssessmentStore {
  private readonly records = new Map<string, AssessmentRecord>();
  private readonly order: string[] = [];

  public add(record: AssessmentRecord): void {
    this.records.set(record.assessmentId, record);
    this.order.push(record.assessmentId);
  }

  public get(assessmentId: string): AssessmentRecord | undefined {
    return this.records.get(assessmentId);
  }

  public latestForCompany(companyNumber: string): AssessmentRecord | undefined {
    for (let index = this.order.length - 1; index >= 0; index -= 1) {
      const assessmentId = this.order[index];
      const record = assessmentId === undefined ? undefined : this.records.get(assessmentId);
      if (record?.companyNumber === companyNumber) {
        return record;
      }
    }
    return undefined;
  }

  public activeAssessmentCount(): number {
    return [...this.records.values()].filter((record) => record.status === "PENDING").length;
  }

  public nonTerminalSubjectCount(): number {
    return [...this.records.values()].reduce(
      (total, record) => record.status === "PENDING"
        ? total + record.subjects.filter((subject) => !isTerminal(subject.screening)).length
        : total,
      0,
    );
  }

  public snapshot(record: AssessmentRecord): AssessmentSnapshot {
    const progress = progressFor(record.subjects);
    const hasSubjectErrors = record.subjects.some((subject) => subject.screening.status === "ERROR");
    const hasIncompleteSubjects = record.subjects.some((subject) => !isTerminal(subject.screening));
    const hasUnresolved = record.selection.unresolved.length > 0;
    const partial = hasSubjectErrors
      || hasIncompleteSubjects
      || hasUnresolved
      || record.assessmentError !== undefined;

    return {
      companyNumber: record.companyNumber,
      threshold: record.threshold,
      status: record.status,
      partial,
      progress,
      subjectSelection: record.selection.subjectSelection,
      unresolved: record.selection.unresolved,
      corporatePscRecords: record.selection.corporatePscRecords,
      unknownPscRecords: record.selection.unknownPscRecords,
      subjects: record.subjects,
      ...(record.assessmentError === undefined ? {} : { assessmentError: record.assessmentError }),
    };
  }
}

export function isTerminal(screening: ScreeningState): boolean {
  return screening.status === "COMPLETE" || screening.status === "ERROR";
}

export function progressFor(subjects: readonly AssessmentSubject[]): {
  total: number;
  terminal: number;
  successful: number;
  queued: number;
  inProgress: number;
} {
  return {
    total: subjects.length,
    terminal: subjects.filter((subject) => isTerminal(subject.screening)).length,
    successful: subjects.filter((subject) => subject.screening.status === "COMPLETE").length,
    queued: subjects.filter((subject) => subject.screening.status === "QUEUED").length,
    inProgress: subjects.filter((subject) => subject.screening.status === "IN_PROGRESS").length,
  };
}
