import { spawn, ChildProcess } from "child_process";
import path from "path";
import readline from "readline";
import { randomUUID } from "crypto";
import { operationalLog } from "./diagnostics";

type Pending = {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};
export class PythonBridge {
  private proc: ChildProcess | null = null;
  private pending = new Map<string, Pending>();
  private listeners = new Map<string, Set<(payload: any) => void>>();
  private ready: Promise<void> | null = null;
  private resolveReady?: () => void;
  private rejectReady?: (error: Error) => void;
  private startupTimer?: ReturnType<typeof setTimeout>;
  public state = "stopped";
  constructor(
    private memoryRoot: string,
    private options: {
      python?: string;
      script?: string;
      startupMs?: number;
      requestMs?: number;
      logDir?: string;
    } = {},
  ) {}
  start(): Promise<void> {
    if (this.proc && this.ready) return this.ready;
    const root = path.resolve(__dirname, "../..");
    this.state = "starting";
    this.log("core.starting");
    this.ready = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    this.startupTimer = setTimeout(() => {
      this.fail(new Error("STARTUP_TIMEOUT"));
      this.proc?.kill();
    }, this.options.startupMs || 15000);
    this.proc = spawn(
      this.options.python || path.join(root, ".venv/bin/python"),
      [
        this.options.script || path.join(root, "core/src/main.py"),
        "--memory-root",
        this.memoryRoot,
      ],
      { cwd: root, stdio: ["pipe", "pipe", "pipe"] },
    );
    readline
      .createInterface({ input: this.proc.stdout! })
      .on("line", (line) => {
        let message: any;
        try {
          message = JSON.parse(line);
        } catch {
          return;
        }
        if (message.event === "engine:ready") {
          clearTimeout(this.startupTimer);
          this.state = "ready";
          this.log("core.ready");
          this.resolveReady?.();
        }
        if (message.event)
          this.listeners
            .get(message.event)
            ?.forEach((fn) => fn(message.payload));
        const pending = this.pending.get(message.request_id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pending.delete(message.request_id);
        if (message.error || message.payload?.success === false)
          pending.reject(
            new Error(message.error || "CONFLICT: изменения не сохранены"),
          );
        else pending.resolve(message.payload);
      });
    // Python writes its own rotating operational logs. Drain stderr to avoid blocking.
    this.proc.stderr?.on("data", () => {});
    this.proc.stdin?.on("error", () => this.fail(new Error("PIPE_ERROR")));
    this.proc.on("error", () => this.fail(new Error("SPAWN_ERROR")));
    this.proc.on("exit", () => {
      this.proc = null;
      this.fail(new Error("CORE_EXITED"));
    });
    return this.ready;
  }
  private log(event: string, id = "", duration = 0, code?: string) {
    if (this.options.logDir)
      operationalLog(this.options.logDir, event, id, duration, code);
  }
  private fail(error: Error) {
    this.listeners
      .get("engine:unavailable")
      ?.forEach((fn) => fn({ error_code: error.message }));
    this.log("core.unavailable", "", 0, error.message);
    clearTimeout(this.startupTimer);
    this.state = "unavailable";
    this.rejectReady?.(error);
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    this.pending.clear();
  }
  async sendRequest<T = any>(type: string, payload: any = {}): Promise<T> {
    if (!this.ready) throw new Error("CORE_NOT_STARTED");
    await this.ready;
    if (this.state !== "ready" || !this.proc?.stdin?.writable)
      throw new Error("CORE_UNAVAILABLE");
    const id = randomUUID();
    const started = Date.now();
    this.log("request.started", id);
    const slow = /^(qa:|model:test|capture:)/.test(type);
    const operation = new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => {
          this.pending.delete(id);
          reject(new Error("REQUEST_TIMEOUT"));
        },
        this.options.requestMs || (slow ? 45000 : 10000),
      );
      this.pending.set(id, { resolve, reject, timer });
      this.proc!.stdin!.write(
        JSON.stringify({ version: "1.0", request_id: id, type, payload }) +
          "\n",
        (error) => {
          if (error) {
            clearTimeout(timer);
            this.pending.delete(id);
            reject(new Error("PIPE_ERROR"));
          }
        },
      );
    });
    return operation.then(
      (value) => {
        this.log("request.completed", id, Date.now() - started);
        return value;
      },
      (error) => {
        this.log("request.failed", id, Date.now() - started, "RPC_ERROR");
        throw error;
      },
    );
  }
  on(event: string, callback: (payload: any) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(callback);
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }
  shutdown(): Promise<void> {
    this.fail(new Error("CORE_STOPPED"));
    const child = this.proc;
    this.proc = null;
    this.state = "stopped";
    if (!child || child.exitCode !== null || child.signalCode !== null)
      return Promise.resolve();
    return new Promise((resolve) => {
      const deadline = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 2000);
      child.once("exit", () => {
        clearTimeout(deadline);
        resolve();
      });
      child.kill("SIGTERM");
    });
  }
}
