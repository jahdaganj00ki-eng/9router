import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

if (process.platform !== "win32") {
  console.log("[electron-smoke] Windows-only smoke test skipped on this platform");
  process.exit(0);
}

const root = process.cwd();
const unpacked = path.join(root, "electron", "dist-electron", "win-unpacked", "9Router.exe");
if (!fs.existsSync(unpacked)) throw new Error(`Packaged executable not found: ${unpacked}`);

const tempData = path.join(process.env.RUNNER_TEMP || path.join(root, ".build"), "9router-smoke-data");
fs.rmSync(tempData, { recursive: true, force: true });
fs.mkdirSync(tempData, { recursive: true });
const child = spawn(unpacked, [], {
  env: { ...process.env, DATA_DIR: tempData, NINEROUTER_PORT: "20128" },
  windowsHide: true,
  stdio: "ignore"
});

const base = "http://127.0.0.1:20128";
const deadline = Date.now() + Number(process.env.ELECTRON_SMOKE_TIMEOUT_MS || 60000);
let response;
while (Date.now() < deadline) {
  try {
    response = await fetch(`${base}/api/health`);
    if (response.ok && (await response.json()).ok === true) break;
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 250));
}
if (!response?.ok) {
  child.kill();
  throw new Error("Packaged app did not answer /api/health");
}
const dashboard = await fetch(`${base}/dashboard`);
if (!dashboard.ok) throw new Error(`Dashboard returned HTTP ${dashboard.status}`);

child.kill();
await new Promise((resolve) => child.once("exit", resolve));
console.log("[electron-smoke] health, dashboard and shutdown passed");
