import type { Dict } from "./i18n";

// Amendment field-change tracking (amend indicators item). An "amended" audit
// entry's `detail` JSON carries a `changedFields: string[]` array — which
// fields differ from before, never the old/new values themselves (per the
// requirement: flag *that* a field changed, not what it changed from).

/** Every field the amend flow can change, mapped to its existing Dict label
 *  key — reused verbatim so the badge/tooltip/PDF line read exactly like the
 *  rest of the app's field labels. */
export const AMEND_FIELD_LABELS: Record<string, keyof Dict> = {
  type: "colType",
  venue: "venue",
  compound: "compound",
  gate: "gate",
  date: "date",
  window: "window",
  vehicleType: "vehicleType",
  merchandiseType: "merchType",
  packagingType: "packType",
  quantity: "qty",
  weightKg: "weight",
  volumeM3: "volume",
  transporterName: "transporter",
  transporterContact: "transporterPhone",
  supplierContact: "supplierPhone",
  comments: "comments",
};

export function translateAmendedFields(fields: string[], t: Dict): string[] {
  return fields.map((f) => (AMEND_FIELD_LABELS[f] ? t[AMEND_FIELD_LABELS[f]] : f));
}

/** Parse the `changedFields` list back out of a stored audit-entry `detail`
 *  JSON blob. Defensive against older entries with no such field, and
 *  against a malformed/non-JSON value — both just yield "no changed fields". */
export function parseChangedFields(detail: string | null | undefined): string[] {
  if (!detail) return [];
  try {
    const parsed: unknown = JSON.parse(detail);
    const fields = (parsed as { changedFields?: unknown } | null)?.changedFields;
    return Array.isArray(fields) ? fields.filter((f): f is string => typeof f === "string") : [];
  } catch {
    return [];
  }
}
