const { app, BrowserWindow, dialog, ipcMain, Menu, shell, Tray } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const DEFAULT_PORT = 20128;
const SERVER_HOST = "127.0.0.1";
let serverProcess = null;
let mainWindow = null;
let tray = null;
let isQuitting = false;

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

function getPort() {
  const value = Number(process.env.NINEROUTER_PORT || DEFAULT_PORT);
  return Number.isInteger(value) && value > 0 && value < 65536 ? value : DEFAULT_PORT;
}

function getDataDir() {
  return path.join(app.getPath("appData"), "9router");
}

function getServerPath() {
  const serverPath = path.join(process.resourcesPath, "app", "custom-server.js");
  if (!fs.existsSync(serverPath)) throw new Error(`Packaged server not found: ${serverPath}`);
  return serverPath;
}

function prepareInitialPassword() {
  const passwordFile = path.join(getDataDir(), "desktop-initial-password");
  let password;
  try {
    password = fs.readFileSync(passwordFile, "utf8").trim();
  } catch {
    password = crypto.randomBytes(18).toString("base64url");
    fs.writeFileSync(passwordFile, `${password}\n`, { mode: 0o600 });
  }
  return { password, passwordFile };
}

function startServer(initialPassword) {
  const port = getPort();
  const dataDir = getDataDir();
  fs.mkdirSync(dataDir, { recursive: true });
  const env = {
    ...process.env,
    NODE_ENV: "production",
    ELECTRON_RUN_AS_NODE: "1",
    HOSTNAME: SERVER_HOST,
    PORT: String(port),
    DATA_DIR: dataDir,
    NINEROUTER_DESKTOP: "1",
    INITIAL_PASSWORD: initialPassword,
    // Release 1 does not start privileged MITM functionality.
    NINEROUTER_DESKTOP_MITM: "disabled"
  };
  delete env.ELECTRON_NO_ATTACH_CONSOLE;
  serverProcess = spawn(process.execPath, ["--dns-result-order=ipv4first", "--max-old-space-size=6144", getServerPath()], {
    cwd: path.dirname(getServerPath()),
    env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  serverProcess.stdout.on("data", (chunk) => console.log(`[server] ${chunk}`));
  serverProcess.stderr.on("data", (chunk) => console.error(`[server] ${chunk}`));
  serverProcess.once("exit", (code, signal) => {
    serverProcess = null;
    if (!isQuitting && code !== 0) showStartupError(new Error(`9Router server exited (${code ?? signal})`));
  });
}

async function waitForHealth(timeoutMs = 60000) {
  const url = `http://${SERVER_HOST}:${getPort()}/api/health`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok && (await response.json()).ok === true) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`9Router did not become ready at ${url}`);
}

function isAllowedUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" && parsed.hostname === SERVER_HOST && parsed.port === String(getPort());
  } catch {
    return false;
  }
}

function isExternalUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAllowedUrl(url) && isExternalUrl(url)) shell.openExternal(url).catch(() => {});
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedUrl(url)) event.preventDefault();
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => { mainWindow = null; });
}

function createTray() {
  // A native tray icon is intentionally optional until the project supplies a branded ICO.
  // The app remains fully usable through its window and taskbar entry.
  const icon = process.platform === "win32" ? path.join(process.resourcesPath, "app", "public", "favicon.ico") : null;
  if (!icon || !fs.existsSync(icon)) return;
  tray = new Tray(icon);
  tray.setToolTip("9Router");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Show 9Router", click: () => mainWindow?.show() },
    { type: "separator" },
    { label: "Quit", click: () => { isQuitting = true; app.quit(); } }
  ]));
  tray.on("double-click", () => mainWindow?.show());
}

function showStartupError(error) {
  dialog.showErrorBox("9Router konnte nicht gestartet werden", `${error.message}\n\nDaten: ${getDataDir()}`);
  isQuitting = true;
  app.quit();
}

function terminateServer() {
  if (!serverProcess || serverProcess.killed) return;
  const pid = serverProcess.pid;
  if (process.platform === "win32") {
    spawn("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true, shell: false });
  } else {
    serverProcess.kill("SIGTERM");
  }
  serverProcess = null;
}

ipcMain.handle("9router:get-status", () => ({ port: getPort(), dataDir: getDataDir(), running: Boolean(serverProcess) }));
ipcMain.handle("9router:open-data-dir", () => shell.openPath(getDataDir()));
ipcMain.handle("9router:quit", () => { isQuitting = true; app.quit(); });

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return;
  try {
    const { password } = prepareInitialPassword();
    startServer(password);
    await waitForHealth();
    const firstRun = await dialog.showMessageBox({
      type: "info",
      title: "9Router Erststart",
      message: "Setze beim ersten Login ein eigenes Dashboard-Passwort.",
      detail: `Initiales Passwort: ${password}`,
      buttons: ["OK"]
    });
    void firstRun;
    createWindow();
    createTray();
    await mainWindow.loadURL(`http://${SERVER_HOST}:${getPort()}/dashboard`);
  } catch (error) {
    showStartupError(error);
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  tray?.destroy();
  terminateServer();
});

app.on("window-all-closed", (event) => {
  // Keep the process alive on macOS; on Windows the window close exits normally.
  if (process.platform === "darwin") event.preventDefault();
});
