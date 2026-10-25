import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from "electron";
import path from "path";
import { PythonBridge } from "./pythonBridge";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let pythonBridge: PythonBridge | null = null;
let captureInterval: NodeJS.Timeout | null = null;
let isPaused = false;

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
  });

  const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

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
        isPaused = !isPaused;
        if (pythonBridge) {
          await pythonBridge.sendRequest("policy:set_pause", { paused: isPaused });
        }
        updateTrayMenu();
        if (mainWindow) {
          mainWindow.webContents.send("secondBrain:event:policy:changed", { is_paused: isPaused });
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

  tray.setToolTip(isPaused ? "Второй мозг (на паузе)" : "Второй мозг (активен)");
  tray.setContextMenu(contextMenu);
}

function setupTray() {
  // Create simple 16x16 icon
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  updateTrayMenu();
}

app.whenReady().then(async () => {
  // Initialize Python backend bridge
  try {
    const memoryRoot = path.resolve(__dirname, "../../runtime_data/Memory");
    pythonBridge = new PythonBridge(memoryRoot);
    pythonBridge.start();

    // Forward events from Python to renderer window
    pythonBridge.on("storage:file_changed", (payload) => {
      mainWindow?.webContents.send("secondBrain:event:storage:file_changed", payload);
    });

    pythonBridge.on("engine:ready", (payload) => {
      console.log("[Main] Python engine is ready:", payload);
      mainWindow?.webContents.send("secondBrain:event:engine:ready", payload);
    });

    // Start background window context capture ticker (every 5 seconds)
    captureInterval = setInterval(async () => {
      if (pythonBridge && !isPaused) {
        try {
          await pythonBridge.sendRequest("capture:tick", {});
        } catch (e) {
          // ignore tick errors
        }
      }
    }, 5000);
  } catch (err) {
    console.error("[Main] Failed to start Python bridge:", err);
  }

  // IPC handler for renderer requests
  ipcMain.handle("secondBrain:request", async (_, { type, payload }) => {
    if (!pythonBridge) {
      throw new Error("Python backend bridge is not initialized");
    }
    const res = await pythonBridge.sendRequest(type, payload);
    if (type === "policy:set_pause" && payload) {
      isPaused = Boolean(payload.paused);
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

app.on("will-quit", () => {
  if (captureInterval) {
    clearInterval(captureInterval);
  }
  if (pythonBridge) {
    pythonBridge.shutdown();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
