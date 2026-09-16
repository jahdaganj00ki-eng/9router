import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = path.join(root, ".next", "standalone");
const staging = path.join(root, ".build", "electron-standalone");
const rootNodeModules = path.join(root, "node_modules");

function exists(name) { return fs.existsSync(path.join(staging, name)); }
function copy(sourcePath, destinationPath) {
  if (!fs.existsSync(sourcePath)) return false;
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.cpSync(sourcePath, destinationPath, { recursive: true, force: true, dereference: true });
  return true;
}
function assertExists(name) {
  if (!exists(name)) throw new Error(`[electron-prepare] Missing required artifact: ${name}`);
}
function packageRoot(name) {
  try {
    return path.dirname(createRequire(import.meta.url).resolve(`${name}/package.json`));
  } catch {
    return null;
  }
}
function assertInsideStaging(file) {
  const real = fs.realpathSync(file);
  const relative = path.relative(staging, real);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`[electron-prepare] Artifact escapes staging directory: ${file} -> ${real}`);
  }
}

if (!fs.existsSync(path.join(root, "package-lock.json"))) {
  throw new Error("[electron-prepare] Root package-lock.json is required for a release build");
}
if (!fs.existsSync(source)) throw new Error("[electron-prepare] Run npm run build before preparing Electron");

fs.rmSync(staging, { recursive: true, force: true });
fs.mkdirSync(staging, { recursive: true });
copy(source, staging);
copy(path.join(root, "custom-server.js"), path.join(staging, "custom-server.js"));
copy(path.join(root, "public"), path.join(staging, "public"));
copy(path.join(root, ".next", "static"), path.join(staging, ".next", "static"));

// Next's tracer can omit external/dynamic runtime modules. Copy only the known runtime
// modules; do not copy the complete development node_modules tree into the installer.
for (const name of ["sql.js", "open", "node-machine-id", "node-forge", "selfsigned", "next"]) {
  const from = packageRoot(name) || path.join(rootNodeModules, name);
  const to = path.join(staging, "node_modules", name);
  if (from) copy(from, to);
}

for (const required of [
  "custom-server.js",
  "server.js",
  "package.json",
  ".next/static",
  "public",
  "node_modules/next",
  "node_modules/sql.js",
  "node_modules/sql.js/dist/sql-wasm.wasm",
  "node_modules/open/package.json",
  "node_modules/node-machine-id/package.json",
  "node_modules/node-forge/package.json",
  "node_modules/selfsigned/package.json"
]) assertExists(required);

function findSymlinks(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) assertInsideStaging(file);
    else if (entry.isDirectory()) findSymlinks(file);
  }
}
findSymlinks(staging);

// Validate from the final staging tree, not from the checkout's node_modules.
const stagingRequire = createRequire(path.join(staging, "package.json"));
for (const name of ["sql.js", "open", "node-machine-id", "node-forge", "selfsigned"]) {
  try { stagingRequire.resolve(name); }
  catch (error) { throw new Error(`[electron-prepare] Cannot resolve ${name} in staging: ${error.message}`); }
}

const metadata = {
  version: JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version,
  platform: "win32",
  arch: "x64",
  mitm: "disabled",
  updater: "disabled",
  sqliteFallback: "sql.js"
};
fs.writeFileSync(path.join(staging, "desktop-build-metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`);
console.log(`[electron-prepare] Prepared ${staging}`);
