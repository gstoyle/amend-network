import { parse } from "csv-parse/sync";
import { normalizeEmail } from "@/lib/crypto/pii";

export const INVITE_CSV_HEADERS = [
  "email",
  "first_name",
  "last_name",
  "network_name",
  "title",
  "doc_affiliation",
] as const;

export const INVITE_CSV_MAX_ROWS = 500;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

export type InviteCsvValidRow = {
  email: string;
  firstName: string;
  lastName: string;
  networkName: string;
  title: string;
  docAffiliation: string;
};

export type InviteCsvInvalidRow = {
  email: string;
  reason: "missing_required_field" | "malformed_email" | "duplicate_email_in_file";
};

export type ParseInviteCsvResult =
  | { ok: true; valid: InviteCsvValidRow[]; invalid: InviteCsvInvalidRow[] }
  | { ok: false; error: "bad_header" | "oversize" };

function cell(row: string[], index: number): string {
  return (row[index] ?? "").trim();
}

export function parseInviteCsv(input: string): ParseInviteCsvResult {
  let records: string[][];
  try {
    records = parse(input, {
      bom: true,
      relax_column_count: true,
      skip_empty_lines: true,
    });
  } catch {
    return { ok: false, error: "bad_header" };
  }

  if (records.length === 0) {
    return { ok: false, error: "bad_header" };
  }

  const header = records[0] ?? [];
  if (
    header.length !== INVITE_CSV_HEADERS.length ||
    INVITE_CSV_HEADERS.some((expected, index) => header[index] !== expected)
  ) {
    return { ok: false, error: "bad_header" };
  }

  const data = records.slice(1);
  if (data.length > INVITE_CSV_MAX_ROWS) {
    return { ok: false, error: "oversize" };
  }

  const valid: InviteCsvValidRow[] = [];
  const invalid: InviteCsvInvalidRow[] = [];
  const seen = new Set<string>();

  for (const row of data) {
    const email = cell(row, 0);
    const firstName = cell(row, 1);
    const lastName = cell(row, 2);
    const networkName = cell(row, 3);
    const title = cell(row, 4);
    const docAffiliation = cell(row, 5);

    if (!email || !firstName || !lastName || !networkName || !title || !docAffiliation) {
      invalid.push({ email, reason: "missing_required_field" });
      continue;
    }
    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      invalid.push({ email, reason: "malformed_email" });
      continue;
    }

    const key = normalizeEmail(email);
    if (seen.has(key)) {
      invalid.push({ email, reason: "duplicate_email_in_file" });
      continue;
    }
    seen.add(key);
    valid.push({
      email: key,
      firstName,
      lastName,
      networkName,
      title,
      docAffiliation,
    });
  }

  return { ok: true, valid, invalid };
}
