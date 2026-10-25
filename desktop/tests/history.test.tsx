import React from "react";
import { expect, it, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { HistoryScreen } from "../src/sections/HistoryScreen";
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
});
it("does not replace a newly selected date with a late old response", async () => {
  const pending = new Map<string, (value: any) => void>();
  const request = vi.fn(
    (date: string) => new Promise<any>((resolve) => pending.set(date, resolve)),
  );
  const days = ["2026-10-25", "2026-10-24"].map((date) => ({
    date,
    path: date,
    episodes_count: 1,
    notes_count: 0,
  }));
  render(<HistoryScreen days={days} onSelectDay={request} />);
  await waitFor(() => expect(pending.has("2026-10-25")).toBe(true));
  fireEvent.click(screen.getByRole("button", { name: /2026-10-24/ }));
  await waitFor(() => expect(pending.has("2026-10-24")).toBe(true));
  pending.get("2026-10-24")!({
    date: "2026-10-24",
    episodes: [
      {
        id: "new",
        title: "Selected day evidence",
        body: "new",
        created_at: "2026-10-24",
      },
    ],
    notes: [],
  });
  await screen.findByText("Selected day evidence");
  pending.get("2026-10-25")!({
    date: "2026-10-25",
    episodes: [
      {
        id: "old",
        title: "Old stale evidence",
        body: "old",
        created_at: "2026-10-25",
      },
    ],
    notes: [],
  });
  await waitFor(() =>
    expect(screen.queryByText("Old stale evidence")).not.toBeInTheDocument(),
  );
});
