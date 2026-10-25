export type Row = { id: string; [key: string]: any };
const collator = new Intl.Collator("ru", {
  numeric: true,
  sensitivity: "base",
});
export function ordered<T extends Row>(
  rows: T[],
  field: string,
  direction = 1,
): T[] {
  const dateField = /_at$|^due_date$/.test(field);
  const empty = (value: any) =>
    value === null ||
    value === undefined ||
    value === "" ||
    (dateField && !Number.isFinite(Date.parse(value)));
  return [...rows].sort((a, b) => {
    const av = a[field],
      bv = b[field];
    if (empty(av) !== empty(bv)) return empty(av) ? 1 : -1;
    const result = empty(av)
      ? 0
      : dateField
        ? Date.parse(av) - Date.parse(bv)
        : collator.compare(String(av), String(bv));
    const tie =
      field === "due_date"
        ? String(b.created_at || "").localeCompare(String(a.created_at || ""))
        : 0;
    return result * direction || tie || a.id.localeCompare(b.id);
  });
}
export function localDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
