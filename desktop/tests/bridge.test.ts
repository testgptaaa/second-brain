// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { PythonBridge } from "../electron/pythonBridge";
const root = path.resolve(import.meta.dirname, "../..");
const python = path.join(root, ".venv/bin/python");
const dirs: string[] = [],
  bridges: PythonBridge[] = [];
function memory() {
  const dir = mkdtempSync(path.join(tmpdir(), "second-brain-test-"));
  dirs.push(dir);
  return dir;
}
function bridge(dir: string, options: any = {}) {
  const b = new PythonBridge(dir, {
    python,
    script: path.join(root, "core/src/main.py"),
    ...options,
  });
  bridges.push(b);
  return b;
}
afterEach(() => {
  bridges.forEach((b) => b.shutdown());
  bridges.length = 0;
  dirs.forEach((d) => rmSync(d, { recursive: true, force: true }));
  dirs.length = 0;
});
it("real subprocess persists notes, performs FTS, rejects stale edits, survives restart", async () => {
  const dir = memory(),
    b = bridge(dir);
  await b.start();
  expect((await b.sendRequest("ping")).pong).toBe(true);
  await b.sendRequest("notes:create", {
    title: "Bridge note",
    content: "UniqueBridgeToken",
  });
  const note = (await b.sendRequest("notes:list")).notes[0];
  await b.sendRequest("notes:update", {
    ...note,
    content: "UpdatedBridgeToken",
  });
  await expect(
    b.sendRequest("notes:update", { ...note, content: "stale" }),
  ).rejects.toThrow("CONFLICT");
  expect(
    (await b.sendRequest("search:query", { query: "UpdatedBridgeToken" }))
      .results,
  ).toHaveLength(1);
  b.shutdown();
  await new Promise<void>((resolve) => setTimeout(resolve, 200));
  const restarted = bridge(dir);
  await restarted.start();
  expect(
    (await restarted.sendRequest("notes:list")).notes[0].content.trim(),
  ).toBe("UpdatedBridgeToken");
  await restarted.sendRequest("notes:delete", { id: note.id });
  expect(
    (
      await restarted.sendRequest("search:query", {
        query: "UpdatedBridgeToken",
      })
    ).results,
  ).toHaveLength(0);
});
it("missing executable rejects startup and requests", async () => {
  const b = bridge(memory(), { python: "/nonexistent/second-brain-python" });
  await expect(b.start()).rejects.toThrow("SPAWN_ERROR");
  await expect(b.sendRequest("ping")).rejects.toThrow();
});
it("startup timeout is bounded", async () => {
  const dir = memory(),
    script = path.join(dir, "sleep.py");
  writeFileSync(script, "import time\ntime.sleep(60)\n");
  await expect(bridge(dir, { script, startupMs: 100 }).start()).rejects.toThrow(
    "STARTUP_TIMEOUT",
  );
});
it("request timeout and shutdown reject pending promises", async () => {
  const dir = memory(),
    script = path.join(dir, "stall.py");
  writeFileSync(
    script,
    'import time\nprint(\'{"event":"engine:ready"}\',flush=True)\ntime.sleep(60)\n',
  );
  const b = bridge(dir, { script, requestMs: 100 });
  await b.start();
  await expect(b.sendRequest("ping")).rejects.toThrow("REQUEST_TIMEOUT");
  const pending = b.sendRequest("ping");
  const check = expect(pending).rejects.toThrow("CORE_STOPPED");
  await new Promise<void>((r) => setTimeout(r, 10));
  b.shutdown();
  await check;
});
