import { expect, it } from "vitest";
import { ordered, localDate } from "../src/lib/list";
it("sorts a whole set before pagination, resolves ties, keeps null last both directions", () => {
  const rows = Array.from({ length: 51 }, (_, i) => ({
    id: String(i).padStart(2, "0"),
    due:
      i % 3 === 0 ? null : `2026-10-${String(1 + (i % 25)).padStart(2, "0")}`,
  }));
  const sorted = ordered(rows, "due");
  expect(sorted.slice(0, 3).map((r) => r.id)).toEqual(["25", "50", "01"]);
  expect(
    new Set(
      [
        ...sorted.slice(0, 20),
        ...sorted.slice(20, 40),
        ...sorted.slice(40),
      ].map((r) => r.id),
    ).size,
  ).toBe(51);
  expect(sorted.at(-1)?.due).toBeNull();
  expect(ordered(rows, "due", -1).at(-1)?.due).toBeNull();
  expect(rows[0].id).toBe("00");
});
it("uses Russian title order with deterministic ID tie-break", () => {
  expect(
    ordered(
      [
        { id: "3", title: "Я" },
        { id: "2", title: "А" },
        { id: "1", title: "А" },
      ],
      "title",
    ).map((r) => r.id),
  ).toEqual(["1", "2", "3"]);
});
it("formats local calendar dates without UTC conversion", () => {
  expect(localDate(new Date(2026, 9, 25, 0, 1))).toBe("2026-10-25");
});
it("puts invalid dates last and compares instants across offsets", () => {
  const rows = [
    { id: "invalid", created_at: "not-a-date" },
    { id: "later", created_at: "2026-10-25T00:00:00Z" },
    { id: "earlier", created_at: "2026-10-25T01:00:00+03:00" },
  ];
  expect(ordered(rows, "created_at").map((r) => r.id)).toEqual([
    "earlier",
    "later",
    "invalid",
  ]);
  expect(ordered(rows, "created_at", -1).map((r) => r.id)).toEqual([
    "later",
    "earlier",
    "invalid",
  ]);
});
it("task due ties use newest creation first, missing due stays last", () => {
  expect(
    ordered(
      [
        { id: "old", due_date: "2026-10-25", created_at: "2026-10-01" },
        { id: "new", due_date: "2026-10-25", created_at: "2026-10-02" },
        { id: "none", due_date: null, created_at: "2026-10-03" },
      ],
      "due_date",
    ).map((r) => r.id),
  ).toEqual(["new", "old", "none"]);
});
