import type {
  NormalizedOfficerRecord,
  NormalizedPscRecord,
} from "../companies-house/types.js";

export interface SelectedSubject {
  subjectId: string;
  subjectType: "INDIVIDUAL_PSC" | "DIRECTOR_FALLBACK";
  name: string;
  roles: string[];
  confirmedPsc: boolean;
  selectionReason: "INDIVIDUAL_PSC" | "CORPORATE_PSC_FALLBACK";
  sourceRefs: string[];
}

export interface CorporatePscRecord {
  sourceRef: string | null;
  recordLocator: string;
  subjectType: "CORPORATE_PSC";
  name: string | null;
  screened: false;
  resolution: "OUT_OF_SCOPE";
  reason: "Corporate control chain was not recursively resolved.";
}

export interface UnknownPscRecord {
  sourceRef: string | null;
  recordLocator: string;
  subjectType: "UNKNOWN_PSC";
  name: string | null;
  screened: false;
  resolution: "UNCLASSIFIED";
  reason: "The PSC record kind was not recognized, so no individual screening was attempted.";
}

export interface UnresolvedFinding {
  code: string;
  message: string;
  sourceRefs: string[];
}

export interface SubjectSelectionSummary {
  individualPscCount: number;
  corporatePscCount: number;
  fallbackUsed: boolean;
  directorFallbackUsed: boolean;
  corporateControlChainResolved: false;
}

export interface SubjectSelection {
  subjectSelection: SubjectSelectionSummary;
  subjects: SelectedSubject[];
  corporatePscRecords: CorporatePscRecord[];
  unknownPscRecords: UnknownPscRecord[];
  unusablePscRecords: NormalizedPscRecord[];
  unusableOfficerRecords: NormalizedOfficerRecord[];
  unresolved: UnresolvedFinding[];
}

export interface NormalizedSourceRecords {
  officers: NormalizedOfficerRecord[];
  pscs: NormalizedPscRecord[];
}
