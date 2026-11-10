import { CompaniesHouseClient } from "../companies-house/client.js";
import type {
  CompaniesHouseCollectionError,
  CompaniesHouseMalformedEnvelopeError,
  CompaniesHouseUpstreamError,
  NormalizedOfficerRecord,
  NormalizedPscRecord,
} from "../companies-house/types.js";
import { extractSubjects } from "./extract.js";
import type { SubjectSelection } from "./types.js";

export type SubjectExtractionFailure =
  | {
      kind: "VALIDATION_ERROR";
      code: "INVALID_COMPANY_NUMBER";
      message: string;
      retryable: false;
    }
  | {
      kind: "UPSTREAM_ERROR";
      code: "COMPANIES_HOUSE_ENDPOINT_FAILURE";
      message: string;
      retryable: boolean;
      upstreamErrors: CompaniesHouseUpstreamError[];
    }
  | {
      kind: "ASSESSMENT_ERROR";
      code: "COMPANIES_HOUSE_MALFORMED_RESPONSE";
      message: string;
      retryable: false;
      endpoint: "officers" | "pscs";
    };

export type SubjectExtractionResult =
  | {
      ok: true;
      companyNumber: string;
      sourceRecords: {
        officers: NormalizedOfficerRecord[];
        pscs: NormalizedPscRecord[];
      };
      selection: SubjectSelection;
    }
  | { ok: false; failure: SubjectExtractionFailure };

export async function extractSubjectsForCompany(
  companyNumberInput: unknown,
  client: CompaniesHouseClient,
): Promise<SubjectExtractionResult> {
  const validation = validateCompanyNumber(companyNumberInput);
  if (!validation.ok) {
    return { ok: false, failure: validation.failure };
  }

  const [officersResult, pscsResult] = await Promise.all([
    client.listOfficers(validation.companyNumber),
    client.listPscs(validation.companyNumber),
  ]);

  const malformedError = [officersResult, pscsResult]
    .map((result) => result.ok ? null : result.error)
    .find((error): error is CompaniesHouseMalformedEnvelopeError => (
      error?.kind === "MALFORMED_ENVELOPE"
    ));
  if (malformedError !== undefined) {
    return {
      ok: false,
      failure: assessmentFailure(malformedError),
    };
  }

  const upstreamErrors = [officersResult, pscsResult].flatMap((result) => {
    if (result.ok || result.error.kind !== "UPSTREAM_ERROR") {
      return [];
    }

    return [result.error];
  });
  if (upstreamErrors.length > 0 || !officersResult.ok || !pscsResult.ok) {
    return {
      ok: false,
      failure: {
        kind: "UPSTREAM_ERROR",
        code: "COMPANIES_HOUSE_ENDPOINT_FAILURE",
        message: "Both Companies House collections are required before subjects can be selected.",
        retryable: upstreamErrors.some((error) => error.retryable),
        upstreamErrors,
      },
    };
  }

  const sourceRecords = {
    officers: officersResult.records,
    pscs: pscsResult.records,
  };

  return {
    ok: true,
    companyNumber: validation.companyNumber,
    sourceRecords,
    selection: extractSubjects(sourceRecords),
  };
}

export function validateCompanyNumber(
  value: unknown,
):
  | { ok: true; companyNumber: string }
  | { ok: false; failure: Extract<SubjectExtractionFailure, { kind: "VALIDATION_ERROR" }> } {
  if (typeof value !== "string") {
    return invalidCompanyNumber();
  }

  const companyNumber = value.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,8}$/.test(companyNumber)) {
    return invalidCompanyNumber();
  }

  return { ok: true, companyNumber };
}

function invalidCompanyNumber(): {
  ok: false;
  failure: Extract<SubjectExtractionFailure, { kind: "VALIDATION_ERROR" }>;
} {
  return {
    ok: false,
    failure: {
      kind: "VALIDATION_ERROR",
      code: "INVALID_COMPANY_NUMBER",
      message: "companyNumber must be a one-to-eight character alphanumeric string.",
      retryable: false,
    },
  };
}

function assessmentFailure(error: CompaniesHouseMalformedEnvelopeError): SubjectExtractionFailure {
  return {
    kind: "ASSESSMENT_ERROR",
    code: "COMPANIES_HOUSE_MALFORMED_RESPONSE",
    message: error.message,
    retryable: false,
    endpoint: error.collection,
  };
}

export function isCollectionError(
  error: CompaniesHouseCollectionError,
): error is CompaniesHouseUpstreamError | CompaniesHouseMalformedEnvelopeError {
  return error.kind === "UPSTREAM_ERROR" || error.kind === "MALFORMED_ENVELOPE";
}
