// Nexus Sentinel — Electron main process
// CommonJS (.cjs) because package.json sets "type": "module".
//
// Run locally during dev:
//   npx electron electron/main.cjs
//
// In production, set NEXUS_DASHBOARD_URL to the published Lovable URL.

const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

const DASHBOARD_URL =
  process.env.NEXUS_DASHBOARD_URL || "http://localhost:5173";

let mainWindow = null;
let agentProcess = null;

function startSentinelAgent() {
  // When packaged, the PyInstaller binary lives in process.resourcesPath.
  const isPackaged = app.isPackaged;
  const exeName = process.platform === "win32" ? "sentinel_agent.exe" : "sentinel_agent";
  const candidate = isPackaged
    ? path.join(process.resourcesPath, exeName)
    : path.join(__dirname, "..", "scripts", "sentinel_agent.py");

  if (!fs.existsSync(candidate)) {
    console.warn("[sentinel] agent binary not found at", candidate);
    return;
  }

  const cmd = isPackaged ? candidate : "python";
  const args = isPackaged ? [] : [candidate];

  agentProcess = spawn(cmd, args, {
    env: { ...process.env },
    detached: false,
    stdio: "inherit",
  });

  agentProcess.on("exit", (code) => {
    console.log("[sentinel] agent exited with", code);
    agentProcess = null;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: "#FDFBF7",
    title: "Nexus Sentinel",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(DASHBOARD_URL);

  // External links open in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  startSentinelAgent();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (agentProcess) {
    try {
      agentProcess.kill();
    } catch (_) {
      /* noop */
    }
  }
  if (process.platform !== "darwin") app.quit();
});
