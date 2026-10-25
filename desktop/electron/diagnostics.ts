import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
const session = randomUUID();
export function operationalLog(
  directory: string,
  event: string,
  requestId = "",
  duration = 0,
  errorCode?: string,
) {
  try {
    fs.mkdirSync(directory, { recursive: true });
    const file = path.join(directory, "electron.jsonl");
    if (fs.existsSync(file) && fs.statSync(file).size >= 5 * 1024 * 1024) {
      for (let i = 4; i >= 1; i--) {
        const old = i === 1 ? file : `${file}.${i - 1}`;
        if (fs.existsSync(old)) fs.renameSync(old, `${file}.${i}`);
      }
    }
    fs.appendFileSync(
      file,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: errorCode ? "ERROR" : "INFO",
        component: "electron.bridge",
        event,
        session_id: session,
        request_id: requestId,
        duration_ms: duration,
        error_code: errorCode,
      }) + "\n",
    );
  } catch {
    /* Diagnostics must never take down IPC. No payload fallback. */
  }
}
