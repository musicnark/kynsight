import type { VettMatch, VettScreeningResult } from "./types.js";
import type { VettError } from "./types.js";

const RESPONSE_KEYS = ["input", "is_match", "matches", "list_dates", "screened_at"] as const;
const MATCH_KEYS = ["list_name", "name", "score", "source", "entity_type", "programs"] as const;
const LIST_DATE_KEYS = [
  "OFAC",
  "UK_OFSI",
  "UN_SC",
  "CSL",
  "EU_FSF",
  "CANADA_SEMA",
  "AUSTRALIA_DFAT",
] as const;

export type VettAdapterResult =
  | { ok: true; result: VettScreeningResult }
  | { ok: false; error: VettError };

export function normalizeVettResponse(body: unknown, expectedInput: string): VettAdapterResult {
  if (!isRecord(body) || !hasExactKeys(body, RESPONSE_KEYS)) {
    return malformed("Vett returned a successful response with an invalid object shape.");
  }

  const input = nonEmptyString(body.input);
  const isMatch = body.is_match;
  const matches = normalizeMatches(body.matches);
  const listDates = normalizeListDates(body.list_dates);
  const screenedAt = normalizeTimestamp(body.screened_at);
  if (input === null || typeof isMatch !== "boolean" || matches === null || listDates === null || screenedAt === null) {
    return malformed("Vett returned a successful response missing required screening fields.");
  }
  if (input !== expectedInput.trim()) {
    return malformed("Vett returned screening evidence for a different input name.");
  }

  if (!isMatch && matches.length !== 0) {
    return malformed("Vett returned contradictory match status and match evidence.");
  }
  if (isMatch && matches.length === 0) {
    return malformed("Vett reported a match without validated match evidence.");
  }

  return {
    ok: true,
    result: {
      input,
      outcome: isMatch ? "POSSIBLE_MATCH" : "NO_MATCH",
      matches,
      listDates,
      screenedAt,
    },
  };
}

function normalizeMatches(value: unknown): VettMatch[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalizedMatches: VettMatch[] = [];
  for (const match of value) {
    const normalized = normalizeMatch(match);
    if (normalized === null) {
      return null;
    }
    normalizedMatches.push(normalized);
  }
  return normalizedMatches;
}

function normalizeMatch(value: unknown): VettMatch | null {
  if (!isRecord(value) || !hasExactKeys(value, MATCH_KEYS)) {
    return null;
  }

  const listName = nonEmptyString(value.list_name);
  const name = nonEmptyString(value.name);
  const source = nonEmptyString(value.source);
  const entityType = nonEmptyString(value.entity_type);
  const score = value.score;
  const programs = value.programs;

  if (
    listName === null
    || name === null
    || source === null
    || entityType === null
    || typeof score !== "number"
    || !Number.isFinite(score)
    || score < 0
    || score > 100
    || !Array.isArray(programs)
    || programs.some((program) => nonEmptyString(program) === null)
  ) {
    return null;
  }

  return {
    listName,
    name,
    score,
    source,
    entityType,
    programs: programs.map((program) => String(program)),
  };
}

function normalizeListDates(value: unknown): Record<string, string> | null {
  if (!isRecord(value) || !hasExactKeys(value, LIST_DATE_KEYS)) {
    return null;
  }

  const result: Record<string, string> = {};
  for (const key of LIST_DATE_KEYS) {
    const date = value[key];
    if (!isValidListDate(date)) {
      return null;
    }
    result[key] = date;
  }
  return result;
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !ISO_TIMESTAMP_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    return null;
  }
  return value;
}

function isValidListDate(value: unknown): value is string {
  if (value === "unknown") {
    return true;
  }
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function hasExactKeys<T extends readonly string[]>(value: Record<string, unknown>, expectedKeys: T): boolean {
  const actualKeys = Object.keys(value).sort();
  const requiredKeys = [...expectedKeys].sort();
  return actualKeys.length === requiredKeys.length
    && actualKeys.every((key, index) => key === requiredKeys[index]);
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function malformed(message: string): VettAdapterResult {
  return {
    ok: false,
    error: {
      kind: "MALFORMED_RESPONSE",
      source: "VETT",
      code: "VETT_MALFORMED_RESPONSE",
      message,
      retryable: false,
      scope: "SUBJECT",
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
