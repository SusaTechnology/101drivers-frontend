// common/enum-list.util.ts
//
// URL filter params for enum lists arrive in EVERY shape depending on who
// built the link: a single value ("ACTIVE"), a comma-separated string
// ("DRAFT,QUOTED,LISTED,BOOKED,UNASSIGNED,ACTIVE"), a JSON-encoded array
// (TanStack Router's ?statuses=%5B%22ACTIVE%22%5D decodes to '["ACTIVE"]'),
// or a real router-parsed array. Prisma rejects anything that is not a
// proper enum value, and the raw strings crashed admin endpoints with
// "Expected EnumDeliveryRequestStatus[] ... provided String" (500s in
// adminDashboard getSummaryCards and getAdminDeliveries) — so every
// enum-list filter MUST go through this parser before entering a
// where-clause. Unknown tokens are DROPPED, not rejected: a stale shared
// URL with a retired status must still return the rows it can serve.

export function parseEnumList<T extends string>(
  raw: unknown,
  enumObj: Record<string, T>,
): T[] | undefined {
  let tokens: unknown[];

  if (Array.isArray(raw)) {
    // Router-parsed array (possibly nested) — flatten one level.
    tokens = raw.flat();
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      // JSON-encoded array form.
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        tokens = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        // Not valid JSON — fall back to CSV interpretation.
        tokens = trimmed.split(",");
      }
    } else {
      // Plain CSV or a single value.
      tokens = trimmed.split(",");
    }
  } else {
    return undefined;
  }

  const allowed = Object.values(enumObj) as string[];
  const values = tokens
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter((t) => t.length > 0)
    .filter((t): t is T => allowed.includes(t));

  return values.length ? Array.from(new Set(values)) : undefined;
}
