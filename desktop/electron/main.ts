import {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  shell,
} from "electron";
import path from "path";
import fs from "fs";
import { PythonBridge } from "./pythonBridge";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let pythonBridge: PythonBridge | null = null;
let captureInterval: NodeJS.Timeout | null = null;
let isPaused = true;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    minWidth: 800,
    minHeight: 600,
    title: "Второй мозг — Помощник офисного сотрудника",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0f172a",
    show: false, // Show once ready-to-show to prevent flicker
  });

  const distIndexPath = path.join(__dirname, "../dist/index.html");
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  mainWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription, validatedURL) => {
      console.error(
        `[Electron] Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`,
      );
      if (
        fs.existsSync(distIndexPath) &&
        !validatedURL.includes("index.html")
      ) {
        console.log(`[Electron] Falling back to local file: ${distIndexPath}`);
        mainWindow?.loadFile(distIndexPath);
      }
    },
  );

  if (devServerUrl) {
    console.log(`[Electron] Loading from Vite dev server: ${devServerUrl}`);
    mainWindow.loadURL(devServerUrl);
  } else if (fs.existsSync(distIndexPath)) {
    console.log(`[Electron] Loading from built bundle: ${distIndexPath}`);
    mainWindow.loadFile(distIndexPath);
  } else {
    console.log("[Electron] Dist not found, attempting http://localhost:5173");
    mainWindow.loadURL("http://localhost:5173");
  }

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event) => event.preventDefault());

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function updateTrayMenu() {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: isPaused ? "⏸️ Наблюдение: НА ПАУЗЕ" : "🟢 Наблюдение: АКТИВНО",
      enabled: false,
    },
    { type: "separator" },
    {
      label: isPaused ? "Возобновить наблюдение" : "Поставить на паузу",
      click: async () => {
        if (pythonBridge) {
          const current = await pythonBridge.sendRequest("policy:get");
          if (!current.capture_consent) {
            mainWindow?.show();
            return;
          }
          const updated = await pythonBridge.sendRequest("policy:set_pause", {
            paused: !current.is_paused,
          });
          isPaused = updated.is_paused;
        }
        updateTrayMenu();
        if (mainWindow) {
          mainWindow.webContents.send("secondBrain:event:policy:changed", {
            is_paused: isPaused,
          });
        }
      },
    },
    {
      label: "Открыть главное окно",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    { type: "separator" },
    {
      label: "Завершить работу",
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip(
    isPaused ? "Второй мозг (на паузе)" : "Второй мозг (активен)",
  );
  if (process.platform === "darwin") {
    tray.setTitle(isPaused ? "⏸️ Мозг" : "🟢 Мозг");
  }
  tray.setContextMenu(contextMenu);
}

function setupTray() {
  try {
    const icon = nativeImage.createEmpty();
    tray = new Tray(icon);
    updateTrayMenu();
  } catch (e) {
    console.warn("[Electron] Tray initialization error:", e);
  }
}

if (process.env.SECOND_BRAIN_USER_DATA)
  app.setPath("userData", process.env.SECOND_BRAIN_USER_DATA);

app.whenReady().then(async () => {
  // Initialize Python backend bridge
  try {
    const legacyRoot = path.resolve(__dirname, "../../runtime_data/Memory");
    const memoryRoot =
      process.env.SECOND_BRAIN_MEMORY_ROOT ||
      (fs.existsSync(legacyRoot)
        ? legacyRoot
        : path.join(app.getPath("userData"), "Memory"));
    pythonBridge = new PythonBridge(memoryRoot, {
      logDir: path.join(app.getPath("userData"), "logs"),
    });
    pythonBridge.on("engine:unavailable", (payload) =>
      mainWindow?.webContents.send(
        "secondBrain:event:engine:unavailable",
        payload,
      ),
    );
    await pythonBridge.start();
    const initialPolicy = await pythonBridge.sendRequest("policy:get");
    isPaused = !initialPolicy.capture_consent || initialPolicy.is_paused;

    // Forward events from Python to renderer window
    pythonBridge.on("storage:file_changed", (payload) => {
      mainWindow?.webContents.send(
        "secondBrain:event:storage:file_changed",
        payload,
      );
    });

    pythonBridge.on("engine:ready", (payload) => {
      console.log("[Main] Python engine is ready:", payload);
      mainWindow?.webContents.send("secondBrain:event:engine:ready", payload);
    });

    // Capture remains off for M1; real permissions/OCR acceptance belongs to M2.
  } catch (err) {
    console.error("[Main] Failed to start Python bridge:", err);
  }

  // IPC handler for renderer requests
  ipcMain.handle("secondBrain:request", async (_, { type, payload }) => {
    if (type === "app:open_logs") {
      const directory = path.join(app.getPath("userData"), "logs");
      fs.mkdirSync(directory, { recursive: true });
      const error = await shell.openPath(directory);
      if (error) throw new Error("OPEN_LOGS_FAILED");
      return { success: true };
    }
    if (!pythonBridge) {
      throw new Error("Python backend bridge is not initialized");
    }
    const res = await pythonBridge.sendRequest(type, payload);
    if (type === "policy:set_pause" && payload) {
      const policy = await pythonBridge.sendRequest("policy:get");
      isPaused = !policy.capture_consent || policy.is_paused;
      updateTrayMenu();
    }
    if (type === "policy:set_consent") {
      isPaused = !res.capture_consent || res.is_paused;
      updateTrayMenu();
    }
    return res;
  });

  createWindow();
  setupTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

let quitting = false;
app.on("before-quit", (event) => {
  if (quitting || !pythonBridge) return;
  event.preventDefault();
  quitting = true;
  if (captureInterval) clearInterval(captureInterval);
  void pythonBridge.shutdown().finally(() => app.quit());
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
