// @vitest-environment node
import { expect, it } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from "fs";
import { tmpdir } from "os";
import path from "path";
import { operationalLog } from "../electron/diagnostics";
it("rotates logs, preserves request correlation and tolerates an unwritable destination", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "second-brain-logs-"));
  try {
    writeFileSync(
      path.join(dir, "electron.jsonl"),
      "x".repeat(5 * 1024 * 1024),
    );
    operationalLog(dir, "request.completed", "request-123", 42);
    expect(existsSync(path.join(dir, "electron.jsonl.1"))).toBe(true);
    const record = JSON.parse(
      readFileSync(path.join(dir, "electron.jsonl"), "utf8"),
    );
    expect(record.request_id).toBe("request-123");
    expect(record.duration_ms).toBe(42);
    expect(record).not.toHaveProperty("payload");
    const file = path.join(dir, "not-a-directory");
    writeFileSync(file, "");
    expect(() => operationalLog(file, "failure")).not.toThrow();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
