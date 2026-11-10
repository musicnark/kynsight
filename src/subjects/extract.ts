import type {
  NormalizedOfficerRecord,
  NormalizedPscRecord,
} from "../companies-house/types.js";
import type {
  CorporatePscRecord,
  SelectedSubject,
  SubjectSelection,
  UnresolvedFinding,
  UnknownPscRecord,
} from "./types.js";

const INDIVIDUAL_PSC_KIND = "individual-person-with-significant-control";
const CORPORATE_PSC_KIND = "corporate-entity-person-with-significant-control";

export function extractSubjects(records: {
  officers: readonly NormalizedOfficerRecord[];
  pscs: readonly NormalizedPscRecord[];
}): SubjectSelection {
  const unresolved: UnresolvedFinding[] = [];
  const unusablePscRecords: NormalizedPscRecord[] = [];
  const unusableOfficerRecords: NormalizedOfficerRecord[] = [];
  const individualPscs = uniqueBySourceRef(
    records.pscs.filter((record) => record.kind === INDIVIDUAL_PSC_KIND),
  );
  const corporatePscs = uniqueBySourceRef(
    records.pscs.filter((record) => record.kind === CORPORATE_PSC_KIND),
  );
  const unknownPscs = uniqueByRecordLocator(
    records.pscs.filter(
      (record) => record.kind !== INDIVIDUAL_PSC_KIND && record.kind !== CORPORATE_PSC_KIND,
    ),
  );

  const individualSubjects = individualPscs.flatMap((record) => {
    if (record.sourceRef === null || record.name === null) {
      unusablePscRecords.push(record);
      unresolved.push({
        code: "UNUSABLE_PSC_RECORD",
        message: "An individual PSC record did not contain a reliable source identity and name, so it was not screened.",
        sourceRefs: sourceRefsFor(record.sourceRef),
      });
      return [];
    }

    return [individualSubject(record)];
  });

  const corporateRecords = corporatePscs.map((record) => corporateRecord(record));
  for (const record of corporatePscs) {
    if (record.sourceRef === null || record.name === null) {
      unusablePscRecords.push(record);
      unresolved.push({
        code: "UNUSABLE_PSC_RECORD",
        message: "A corporate PSC record did not contain a reliable source identity and name, so it was preserved for manual review.",
        sourceRefs: sourceRefsFor(record.sourceRef),
      });
    }
  }

  const unknownRecords = unknownPscs.map((record) => unknownRecord(record));
  for (const record of unknownRecords) {
    const sourceRecord = unknownPscs.find((candidate) => candidate.recordLocator === record.recordLocator);
    unresolved.push({
      code: "UNRECOGNIZED_PSC_KIND",
      message: "A PSC record had an unrecognized kind and was not selected for screening.",
      sourceRefs: sourceRefsFor(record.sourceRef),
    });
    if (sourceRecord !== undefined && (sourceRecord.sourceRef === null || sourceRecord.name === null)) {
      unusablePscRecords.push(sourceRecord);
      unresolved.push({
        code: "UNUSABLE_PSC_RECORD",
        message: "An unrecognized PSC record did not contain a reliable source identity and name, so it was preserved for manual review.",
        sourceRefs: sourceRefsFor(sourceRecord.sourceRef),
      });
    }
  }

  if (individualPscs.length > 0) {
    if (corporateRecords.length > 0) {
      unresolved.push({
        code: "CORPORATE_CONTROL_CHAIN_UNRESOLVED",
        message: "The individual PSC was screened. The corporate PSC chain was not resolved.",
        sourceRefs: sourceRefsForRecords(corporateRecords),
      });
    }

    return {
      subjectSelection: {
        individualPscCount: individualPscs.length,
        corporatePscCount: corporatePscs.length,
        fallbackUsed: false,
        directorFallbackUsed: false,
        corporateControlChainResolved: false,
      },
      subjects: individualSubjects,
      corporatePscRecords: corporateRecords,
      unknownPscRecords: unknownRecords,
      unusablePscRecords,
      unusableOfficerRecords,
      unresolved,
    };
  }

  if (corporatePscs.length === 0) {
    return {
      subjectSelection: {
        individualPscCount: individualPscs.length,
        corporatePscCount: corporatePscs.length,
        fallbackUsed: false,
        directorFallbackUsed: false,
        corporateControlChainResolved: false,
      },
      subjects: [],
      corporatePscRecords: corporateRecords,
      unknownPscRecords: unknownRecords,
      unusablePscRecords,
      unusableOfficerRecords,
      unresolved,
    };
  }

  const currentDirectors = currentDirectorsByIdentity(records.officers);
  const fallbackSubjects = currentDirectors.flatMap((record) => {
    if (record.sourceRef === null || record.name === null) {
      unusableOfficerRecords.push(record);
      unresolved.push({
        code: "UNUSABLE_OFFICER_RECORD",
        message: "A current director record did not contain a reliable source identity and name, so it was not screened.",
        sourceRefs: sourceRefsFor(record.sourceRef),
      });
      return [];
    }

    return [directorFallbackSubject(record)];
  });

  if (corporatePscs.length > 0) {
    if (fallbackSubjects.length > 0) {
      unresolved.push({
        code: "CORPORATE_CONTROL_CHAIN_UNRESOLVED",
        message: "The screened directors are fallback subjects, not confirmed PSCs.",
        sourceRefs: sourceRefsForRecords(corporateRecords),
      });
    } else {
      unresolved.push({
        code: "CORPORATE_CONTROL_CHAIN_UNRESOLVED",
        message: "A corporate PSC was identified. KynSight does not recursively resolve its directors or PSCs.",
        sourceRefs: sourceRefsForRecords(corporateRecords),
      });
      unresolved.push({
        code: "NO_DIRECTOR_FALLBACK_SUBJECTS",
        message: "Corporate PSC records were identified, but no current directors were available for fallback screening.",
        sourceRefs: sourceRefsForRecords(corporateRecords),
      });
    }
  }

  addPotentialDuplicateFinding(fallbackSubjects, unresolved);

  return {
    subjectSelection: {
      individualPscCount: individualPscs.length,
      corporatePscCount: corporatePscs.length,
      fallbackUsed: fallbackSubjects.length > 0,
      directorFallbackUsed: fallbackSubjects.length > 0,
      corporateControlChainResolved: false,
    },
      subjects: corporatePscs.length > 0 ? fallbackSubjects : [],
      corporatePscRecords: corporateRecords,
      unknownPscRecords: unknownRecords,
      unusablePscRecords,
      unusableOfficerRecords,
      unresolved,
  };
}

function individualSubject(record: NormalizedPscRecord): SelectedSubject {
  const sourceRef = record.sourceRef as string;
  return {
    subjectId: sourceRef.replace("companies-house:", ""),
    subjectType: "INDIVIDUAL_PSC",
    name: record.name as string,
    roles: ["psc"],
    confirmedPsc: true,
    selectionReason: "INDIVIDUAL_PSC",
    sourceRefs: [sourceRef],
  };
}

function directorFallbackSubject(record: NormalizedOfficerRecord): SelectedSubject {
  const sourceRef = record.sourceRef as string;
  return {
    subjectId: sourceRef.replace("companies-house:", ""),
    subjectType: "DIRECTOR_FALLBACK",
    name: record.name as string,
    roles: [record.officerRole as string],
    confirmedPsc: false,
    selectionReason: "CORPORATE_PSC_FALLBACK",
    sourceRefs: [sourceRef],
  };
}

function corporateRecord(record: NormalizedPscRecord): CorporatePscRecord {
  return {
    sourceRef: record.sourceRef,
    recordLocator: record.recordLocator,
    subjectType: "CORPORATE_PSC",
    name: record.name,
    screened: false,
    resolution: "OUT_OF_SCOPE",
    reason: "Corporate control chain was not recursively resolved.",
  };
}

function unknownRecord(record: NormalizedPscRecord): UnknownPscRecord {
  return {
    sourceRef: record.sourceRef,
    recordLocator: record.recordLocator,
    subjectType: "UNKNOWN_PSC",
    name: record.name,
    screened: false,
    resolution: "UNCLASSIFIED",
    reason: "The PSC record kind was not recognized, so no individual screening was attempted.",
  };
}

function currentDirectorsByIdentity(
  officers: readonly NormalizedOfficerRecord[],
): NormalizedOfficerRecord[] {
  const currentDirectors = officers.filter(
    (record) => record.officerRole === "director" && record.resignedOn === null,
  );
  const byPersonNumber = new Map<string, NormalizedOfficerRecord>();
  const withoutPersonNumber: NormalizedOfficerRecord[] = [];

  for (const record of currentDirectors) {
    if (record.personNumber === null || !record.personNumber) {
      withoutPersonNumber.push(record);
      continue;
    }

    const existing = byPersonNumber.get(record.personNumber);
    if (existing === undefined) {
      byPersonNumber.set(record.personNumber, record);
    } else {
      byPersonNumber.set(record.personNumber, {
        ...existing,
        sourceRef: existing.sourceRef ?? record.sourceRef,
      });
    }
  }

  return [...byPersonNumber.values(), ...withoutPersonNumber];
}

function addPotentialDuplicateFinding(
  subjects: readonly SelectedSubject[],
  unresolved: UnresolvedFinding[],
): void {
  const byName = new Map<string, SelectedSubject[]>();
  for (const subject of subjects) {
    const key = subject.name.toLocaleLowerCase();
    const group = byName.get(key) ?? [];
    group.push(subject);
    byName.set(key, group);
  }

  for (const group of byName.values()) {
    if (group.length > 1) {
      unresolved.push({
        code: "POTENTIAL_DUPLICATE",
        message: "Multiple current director records share a name without a reliable person identifier; they were not merged.",
        sourceRefs: group.flatMap((subject) => subject.sourceRefs),
      });
    }
  }
}

function uniqueBySourceRef<T extends { sourceRef: string | null; recordLocator: string }>(
  records: readonly T[],
): T[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    if (record.sourceRef === null) {
      return true;
    }

    if (seen.has(record.sourceRef)) {
      return false;
    }

    seen.add(record.sourceRef);
    return true;
  });
}

function uniqueByRecordLocator<T extends { recordLocator: string }>(records: readonly T[]): T[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    if (seen.has(record.recordLocator)) {
      return false;
    }

    seen.add(record.recordLocator);
    return true;
  });
}

function sourceRefsFor(sourceRef: string | null): string[] {
  if (sourceRef === null) {
    return [];
  }

  return [sourceRef];
}

function sourceRefsForRecords(records: readonly { sourceRef: string | null }[]): string[] {
  return records.flatMap((record) => sourceRefsFor(record.sourceRef));
}
