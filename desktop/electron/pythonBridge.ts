import { spawn, ChildProcess } from "child_process";
import path from "path";
import readline from "readline";
import { app } from "electron";

export class PythonBridge {
  private proc: ChildProcess | null = null;
  private memoryRoot: string;
  private pendingRequests: Map<string, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();
  private eventListeners: Map<string, Array<(payload: any) => void>> = new Map();
  private isShuttingDown = false;

  constructor(memoryRoot?: string) {
    this.memoryRoot = memoryRoot || path.join(app.getPath("userData"), "Memory");
  }

  public start(): void {
    const projectRoot = path.resolve(__dirname, "../..");
    const pythonExe = path.join(projectRoot, ".venv/bin/python");
    const scriptPath = path.join(projectRoot, "core/src/main.py");

    console.log(`[PythonBridge] Starting backend with Python: ${pythonExe}`);
    console.log(`[PythonBridge] Script: ${scriptPath}, Memory root: ${this.memoryRoot}`);

    this.proc = spawn(pythonExe, [scriptPath, "--memory-root", this.memoryRoot], {
      stdio: ["pipe", "pipe", "inherit"],
      cwd: projectRoot,
    });

    if (!this.proc.stdout || !this.proc.stdin) {
      throw new Error("Failed to attach stdio pipes to Python core process");
    }

    const rl = readline.createInterface({
      input: this.proc.stdout,
      terminal: false,
    });

    rl.on("line", (line) => {
      this.handleLine(line);
    });

    this.proc.on("exit", (code, signal) => {
      console.log(`[PythonBridge] Python core process exited with code ${code}, signal ${signal}`);
      this.proc = null;
      if (!this.isShuttingDown) {
        // reject pending requests
        for (const [reqId, handler] of this.pendingRequests.entries()) {
          handler.reject(new Error("Python process terminated unexpectedly"));
        }
        this.pendingRequests.clear();
      }
    });
  }

  private handleLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const msg = JSON.parse(trimmed);

      // 1. Check if it's an asynchronous push event
      if (msg.event) {
        const listeners = this.eventListeners.get(msg.event) || [];
        listeners.forEach((fn) => fn(msg.payload));
        return;
      }

      // 2. Check if it's a request response
      if (msg.request_id) {
        const handler = this.pendingRequests.get(msg.request_id);
        if (handler) {
          this.pendingRequests.delete(msg.request_id);
          if (msg.error) {
            handler.reject(new Error(msg.error));
          } else {
            handler.resolve(msg.payload);
          }
        }
      }
    } catch (e) {
      console.error("[PythonBridge] Error parsing line from Python:", line, e);
    }
  }

  public sendRequest<T = any>(type: string, payload: any = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.proc || !this.proc.stdin) {
        return reject(new Error("Python backend process is not running"));
      }

      const requestId = `req-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      this.pendingRequests.set(requestId, { resolve, reject });

      const message = {
        version: "1.0",
        request_id: requestId,
        type,
        payload,
      };

      try {
        this.proc.stdin.write(JSON.stringify(message) + "\n");
      } catch (err) {
        this.pendingRequests.delete(requestId);
        reject(err);
      }
    });
  }

  public on(event: string, callback: (payload: any) => void): () => void {
    const list = this.eventListeners.get(event) || [];
    list.push(callback);
    this.eventListeners.set(event, list);

    return () => {
      const current = this.eventListeners.get(event) || [];
      this.eventListeners.set(
        event,
        current.filter((fn) => fn !== callback)
      );
    };
  }

  public shutdown(): void {
    this.isShuttingDown = true;
    if (this.proc) {
      this.proc.kill("SIGTERM");
      this.proc = null;
    }
  }
}
