# Deep Research: OmniRoute-Windows-Installer `OmniRoute.Setup.3.8.50.exe`

**Stand der Recherche:** 16. September 2026  
**Repository:** [`diegosouzapw/OmniRoute`](https://github.com/diegosouzapw/OmniRoute)  
**Untersuchter Basis-Branch:** `release/v3.8.50`  
**Ziel-Asset:** [`OmniRoute.Setup.3.8.50.exe`](https://github.com/diegosouzapw/OmniRoute/releases/download/v3.8.50/OmniRoute.Setup.3.8.50.exe)

> Dieses Dokument rekonstruiert die Pipeline aus dem tatsächlich vorhandenen Quellcode, der GitHub-Actions-Datei, den Build-Skripten und der GitHub-Release-API. Es beschreibt daher die nachprüfbare Implementierung und kennzeichnet ausdrücklich, wo die öffentlich sichtbaren Daten keine vollständigen Laufprotokolle mehr liefern.

---

## 1. Kurzfassung

Der Windows-Installer wird **nicht** durch einen separaten Windows-Installer-Workflow und auch nicht durch einen manuellen Upload gebaut. Der relevante Pfad ist:

```text
Git tag v3.8.50
  ↓
.github/workflows/electron-release.yml
  ↓
validate (Tag-/Versionsprüfung)
  ↓
web-build (ein gemeinsamer Next.js-Standalone-Build auf Ubuntu)
  ↓
build-Matrix → Windows: windows-latest
  ↓
Windows: npm ci + native dependency hydration
  ↓
electron/package.json → npm run build:win
  ↓
electron-builder --win
  ↓
NSIS-Installer + portable EXE
  ↓
release-assets/
  ↓
GitHub Actions Artifact electron-windows
  ↓
release-Job lädt alle Plattform-Artefakte
  ↓
softprops/action-gh-release@v3
  ↓
GitHub Release v3.8.50
```

Der Dateiname entsteht durch die `electron-builder`-Konfiguration:

```json
"nsis": {
  "artifactName": "${productName}.Setup.${version}.${ext}"
}
```

Mit:

```json
"productName": "OmniRoute"
```

und der von der Pipeline gesetzten Electron-Version `3.8.50` ergibt sich:

```text
OmniRoute.Setup.3.8.50.exe
```

Die konkrete Datei ist laut GitHub-API ein hochgeladenes Windows-Binary mit:

| Merkmal | Wert |
|---|---|
| Asset-Name | `OmniRoute.Setup.3.8.50.exe` |
| Asset-ID | `535719367` |
| Größe | `526,572,556` Bytes, etwa `502 MiB` |
| SHA-256 | `70d7c3a4a2fccac3fae41ce2523ed786fd0dbf6bc5c4399e9872399eea1f72d1` |
| Content-Type | `application/x-msdos-program` |
| GitHub-Uploader | `github-actions[bot]` |
| Release | `v3.8.50` |
| Release-Zeitpunkt | 26. August 2026, 19:30 UTC |
| Asset erstellt | 29. August 2026, 20:51 UTC |

Die Release-Seite enthält außerdem die portable Datei `OmniRoute.exe`. Beide Windows-Dateien stammen aus **demselben Windows-Matrix-Lauf**; nur der NSIS-Installer wird als `OmniRoute.Setup.3.8.50.exe` bezeichnet.

---

## 2. Quellen und Beweislage

### Primäre Repository-Quellen

Die entscheidenden Dateien im Branch `release/v3.8.50` sind:

1. `.github/workflows/electron-release.yml`
   - Trigger, Jobs, Matrix, Artefakte, Release-Erstellung.
2. `electron/package.json`
   - Electron-Version, `electron-builder`, Plattformziele und NSIS-Konfiguration.
3. `scripts/build/prepare-electron-standalone.mjs`
   - Vorbereitung des eingebetteten Next.js-Servers.
4. `scripts/build/standaloneBundle.mjs`
   - Packen, Wiederherstellen und Verifizieren des gemeinsamen Web-Bundles.
5. `scripts/build/standaloneManifest.mjs`
   - Byte-/Hash-Manifest des Standalone-Baums.
6. `scripts/build/standaloneTarball.mjs`
   - Deterministische Tarball-Erzeugung und Extraktion.
7. `scripts/build/hydrateNativeDeps.mjs`
   - Ersetzen plattformabhängiger nativer Optional-Dependencies.
8. `scripts/dev/smoke-electron-packaged.mjs`
   - Start-/Readiness-/Shutdown-Smoke-Test des gepackten Programms.
9. `electron/main.js`
   - Laufzeitverhalten des installierten Electron-Programms.
10. `scripts/release/merge-mac-update-manifest.mjs`
    - Für Windows nicht direkt relevant, aber Teil des gemeinsamen Release-Jobs.

### Externe GitHub-Daten

Verifiziert wurden:

- GitHub-Release-API: `GET /repos/diegosouzapw/OmniRoute/releases/tags/v3.8.50`
- GitHub-Asset-API: `GET /repos/diegosouzapw/OmniRoute/releases/assets/535719367`
- GitHub-Actions-API für `electron-release.yml` und Ref `v3.8.50`
- Release-Seite: `https://github.com/diegosouzapw/OmniRoute/releases/tag/v3.8.50`

### Wichtiger Reproduzierbarkeitsvorbehalt

Die öffentliche Actions-API zeigt für den Workflow bei `v3.8.50` einen Lauf mit:

```text
run_number: 307
run_id: 33005490476
head_branch: v3.8.50
head_sha: 5458026c216f77a3da68ea49152dc33470cfe2cb
conclusion: startup_failure
```

Dieser Lauf hat laut API **keine Jobs** (`total_count: 0`). Er kann daher nicht als erfolgreiches Produktionsprotokoll des konkreten EXE-Builds interpretiert werden. Die Assets wurden laut Asset-API erst am 29. August hochgeladen, während der Release-Eintrag am 26. August veröffentlicht wurde. Öffentlich sichtbar ist also die finale Release-Datei, aber nicht mehr ein vollständiger, erfolgreicher Job-/Step-Log, der ihre Erzeugung lückenlos beweist. Die Pipeline und das Artefaktformat sind jedoch im Tag-Quellcode und in den Release-Assets eindeutig nachvollziehbar.

---

## 3. Auslöser der Pipeline

`electron-release.yml` besitzt zwei Auslöser:

```yaml
on:
  push:
    tags:
      - "v*"
  workflow_dispatch:
    inputs:
      version:
        description: "Release version (e.g., v1.6.8)"
        required: true
        type: string
```

### 3.1 Normaler Release-Pfad

Beim Push eines Tags wie `v3.8.50` wird die Pipeline automatisch gestartet. Die Versionsnummer wird aus dem Git-Ref extrahiert:

```bash
VERSION="${GITHUB_REF#refs/tags/}"
```

Bei `refs/tags/v3.8.50` wird daraus `v3.8.50`.

### 3.2 Manueller Pfad

Bei `workflow_dispatch` muss die Bedienperson `version` angeben, beispielsweise `v3.8.50`. Der Wert wird nicht blind verwendet, sondern gegen diesen regulären Ausdruck geprüft:

```regex
^v[0-9]+\.[0-9]+\.[0-9]+$
```

Akzeptiert werden beispielsweise:

- `v3.8.50`
- `v1.6.8`

Abgelehnt werden beispielsweise:

- `3.8.50`
- `v3.8`
- `v3.8.50-rc.1`
- `v3.8.50; command`

Die geprüfte Version wird über `$GITHUB_OUTPUT` als Job-Output weitergereicht:

```bash
echo "version=$VERSION" >> "$GITHUB_OUTPUT"
```

Dadurch verwenden alle Folgejobs exakt dieselbe validierte Versionsquelle.

---

## 4. Job 1: `validate`

```yaml
validate:
  name: Validate version
  runs-on: ubuntu-latest
```

Der Job:

1. checkt den Commit mit `actions/checkout@v7` aus,
2. nutzt `persist-credentials: false`,
3. lädt bei `fetch-depth: 0` die vollständige Historie,
4. bestimmt die Version aus Tag oder Input,
5. prüft das Versionsformat,
6. exportiert `version` für die abhängigen Jobs.

Die Berechtigungen sind minimal:

```yaml
permissions:
  contents: read
```

Der Build wird nur fortgesetzt, wenn dieser Job erfolgreich ist.

---

## 5. Job 2: `web-build` — gemeinsamer Next.js-Build

### 5.1 Zweck

Früher hätten alle vier Desktop-Matrix-Legs — Windows, macOS Intel, macOS ARM64 und Linux — jeweils den vollständigen Next.js-Standalone-Build ausgeführt. Die aktuelle Pipeline baut den plattformunabhängigen Web-/Serverteil einmal auf Ubuntu und verteilt ihn anschließend.

Der Job ist nur aktiv, wenn das Repository-Variable-Feature nicht abgeschaltet wurde:

```yaml
if: ${{ !cancelled() && needs.validate.result == 'success' && vars.ELECTRON_SHARED_STANDALONE != 'disabled' }}
```

Rollback-Schalter:

```text
ELECTRON_SHARED_STANDALONE=disabled
```

Ist dieser Schalter gesetzt, wird `web-build` übersprungen und jede Plattform baut ihren Next.js-Teil selbst. Das Windows-Leg bleibt dadurch funktionsfähig, nur ohne Shared-Bundle-Optimierung.

### 5.2 Setup

Runner:

```yaml
runs-on: ubuntu-latest
```

Node:

```yaml
node-version: 24
```

Installation:

```bash
npm ci
```

Dabei wird gesetzt:

```yaml
NPM_CONFIG_LEGACY_PEER_DEPS: true
```

Das Root-`package.json` verlangt Node `>=22.22.2 <23 || >=24.0.0 <27`; der Workflow verwendet Node 24.

### 5.3 Next.js-Produktionserstellung

```yaml
env:
  JWT_SECRET: ci-build-secret-with-sufficient-length-for-validation
  NODE_OPTIONS: "--max_old_space_size=6144"
  OMNIROUTE_USE_TURBOPACK: "0"
run: npm run build
```

`npm run build` ruft auf Root-Ebene auf:

```json
"build": "node scripts/build/build-next-isolated.mjs"
```

Für diesen zentralen Build wird bewusst Webpack statt Turbopack erzwungen. Hintergrund laut Workflow-Kommentar: Turbopack verwendet native/Rust-Speicherstrukturen, die nicht vollständig durch `--max_old_space_size` begrenzt werden; auf GitHub-Runnern kann der Prozess dadurch vom Runner beendet werden.

Das Ergebnis ist ein Next.js-Standalone-Baum unter `.build/next`.

### 5.4 Packen des Shared-Bundles

```bash
node scripts/build/standaloneBundle.mjs pack --out web-bundle.tar.gz
```

Dabei passieren mehrere Dinge:

1. Der Baum `.build/next` wird gescannt.
2. Ein deterministisches Entry-Manifest wird aufgebaut.
3. Der Tree wird als `web-bundle.tar.gz` gepackt.
4. Der SHA-256 des Archivs wird berechnet.
5. Die Archivgröße und der SHA-256 werden in `web-bundle.tar.gz.manifest.json` geschrieben.
6. Für jeden Eintrag werden Existenz, Größe, Inhaltshash und Symlink-Ziel festgehalten.

Das Manifest enthält sinngemäß:

```json
{
  "version": "<manifest-version>",
  "archive": {
    "name": "web-bundle.tar.gz",
    "bytes": 123,
    "sha256": "..."
  },
  "entries": [
    {
      "path": "...",
      "type": "file",
      "bytes": 123,
      "sha256": "..."
    }
  ]
}
```

### 5.5 Upload als Actions-Artefakt

```yaml
uses: actions/upload-artifact@v7
with:
  name: web-standalone-bundle
  compression-level: 0
  retention-days: 3
  path: |
    web-bundle.tar.gz
    web-bundle.tar.gz.manifest.json
```

`compression-level: 0` ist Absicht: Das Payload ist bereits ein komprimiertes `tar.gz`; ein zweites ZIP-Komprimieren würde vor allem CPU kosten.

---

## 6. Job 3: `build` mit Matrix — der Windows-Pfad

Der zentrale Packaging-Job lautet:

```yaml
build:
  name: Build Electron (${{ matrix.platform }})
  needs: [validate, web-build]
```

Die Matrix lautet:

| `platform` | Runner | `target` | Output-Endung | OS-Parameter | Architektur |
|---|---|---|---|---|---|
| `windows` | `windows-latest` | `win` | `.exe` | `win32` | `x64` |
| `macos-intel` | `macos-15-intel` | `mac-x64` | `.dmg` | `darwin` | `x64` |
| `macos-arm64` | `macos-latest` | `mac-arm64` | `-arm64.dmg` | `darwin` | `arm64` |
| `linux` | `ubuntu-latest` | `linux` | `.AppImage` | `linux` | `x64,arm64` |

Die Matrix hat:

```yaml
fail-fast: false
```

Das bedeutet: Ein fehlerhafter Linux-Leg beendet nicht sofort die bereits laufenden Windows-/macOS-Legs.

Die Build-Legs laufen nur weiter, wenn `validate` erfolgreich war und `web-build` entweder erfolgreich oder bewusst übersprungen wurde:

```yaml
if: ${{ !cancelled() && needs.validate.result == 'success' && (needs.web-build.result == 'success' || needs.web-build.result == 'skipped') }}
```

Für den Windows-Installer ist ausschließlich dieser Matrix-Eintrag relevant:

```yaml
- platform: windows
  runner: windows-latest
  target: win
  ext: .exe
  os: win32
  arch: x64
```

Der Matrix-Leg erhält Schreibrechte auf Repository-Inhalte, weil `electron-builder` grundsätzlich GitHub-Publishing-Unterstützung konfiguriert hat:

```yaml
permissions:
  contents: write
```

Der eigentliche Release-Upload wird später trotzdem zentral im `release`-Job durchgeführt.

---

## 7. Windows-Matrix-Leg im Detail

### 7.1 Checkout und Node

```yaml
- uses: actions/checkout@v7
  with:
    persist-credentials: false

- name: Setup Node
  uses: actions/setup-node@v7
  with:
    node-version: 24
    cache: npm
```

Der Windows-Runner checkt den Tag-Commit aus und verwendet Node 24. Der npm-Cache reduziert wiederholte Installationskosten.

### 7.2 Root-Abhängigkeiten

```yaml
- name: Install dependencies
  run: npm ci
  env:
    NPM_CONFIG_LEGACY_PEER_DEPS: true
```

`npm ci` installiert anhand der Lockdatei deterministisch. Die Root-Abhängigkeiten enthalten unter anderem:

- Next.js 16.3.1
- React 19.2.8
- TypeScript 6
- `better-sqlite3` als optionale Dependency
- `sharp`, `onnxruntime-node`, `keytar`, `wreq-js` und weitere native/optionale Pakete

### 7.3 Windows-Home-Verzeichnis bereinigen

```yaml
- name: Sanitize Windows home directory
  if: runner.os == 'Windows'
  shell: bash
  run: |
    mkdir -p "$RUNNER_TEMP/home"
    echo "USERPROFILE=$RUNNER_TEMP/home" >> "$GITHUB_ENV"
```

Das ist ein Windows-spezifischer Stabilitätsfix. Das Standard-`USERPROFILE` des GitHub-Runners enthält Junctions, darunter `Application Data`. Next.js-Standalone-Glob-Scans können diese Junctions mit `EPERM` fehlschlagen lassen.

Die Pipeline setzt daher für den weiteren Job ein sauberes temporäres `USERPROFILE`.

### 7.4 Fallback: eigener Next.js-Build

Dieser Schritt läuft nur, wenn `web-build` übersprungen wurde:

```yaml
if: needs.web-build.result == 'skipped'
```

Windows würde dann den Root-Build lokal auf dem Windows-Runner ausführen. Bei aktiviertem Shared-Bundle wird dieser Schritt nicht ausgeführt.

### 7.5 Shared-Bundle herunterladen

Im Normalfall:

```yaml
- name: Download shared web bundle
  if: needs.web-build.result == 'success'
  uses: actions/download-artifact@v8
  with:
    name: web-standalone-bundle
```

### 7.6 Wiederherstellen und prüfen

```bash
node scripts/build/standaloneBundle.mjs restore --archive web-bundle.tar.gz
node scripts/build/standaloneBundle.mjs hydrate --platform win32 --arch x64
```

#### `restore`

`restore`:

1. liest das Manifest,
2. prüft die Manifest-Version,
3. prüft die Archivgröße,
4. berechnet den SHA-256 des übertragenen Archivs,
5. vergleicht ihn mit dem Manifest,
6. löscht den alten Zielbaum,
7. extrahiert das Archiv nach `.build/next`,
8. verifiziert danach den gesamten restaurierten Tree byteweise.

Damit wird sowohl Transferbeschädigung als auch eine unvollständige Extraktion erkannt.

#### `hydrate`

Das Shared-Bundle wurde auf Ubuntu erzeugt. Einige Dependencies sind jedoch maschinen-/plattformabhängig. `hydrate` ersetzt die entsprechenden Linux-Forks durch diejenigen, die das Windows-`npm ci` installiert hat.

Laut Workflow-Kommentar betrifft das unter anderem:

- `@img/sharp-*`
- `@img/sharp-libvips-*`
- `@ngrok/ngrok-*`
- `fsevents`
- koffi-Plattformvarianten
- `better-sqlite3`-Prebuilds
- `wreq-js`
- `onnxruntime`

Anschließend wird geprüft, dass der Bundle-Tree `win32/x64` bedienen kann. Ohne diesen Schritt könnte ein auf Linux gebauter nativer Binary im Windows-Installer landen und erst beim Benutzerstart fehlschlagen.

---

## 8. Versionsübertragung in den Electron-Teil

Nach der Build-/Bundle-Phase wird die validierte Tag-Version in `electron/package.json` geschrieben:

```yaml
- name: Sync version in electron/package.json
  shell: bash
  env:
    VERSION: ${{ needs.validate.outputs.version }}
```

Im Script:

```bash
VERSION_NO_V="${VERSION#v}"
```

Aus `v3.8.50` wird `3.8.50`.

Dann wird `electron/package.json` gelesen, dessen `version` geändert und zurückgeschrieben:

```js
const pkg = JSON.parse(fs.readFileSync('electron/package.json'));
pkg.version = '$VERSION_NO_V';
fs.writeFileSync('electron/package.json', JSON.stringify(pkg, null, 2) + '\n');
```

Das ist für den Dateinamen entscheidend. Die Workflow-Version ist mit `v` versehen; npm/Electron package versions verwenden `3.8.50` ohne `v`.

---

## 9. Electron-Abhängigkeiten installieren

Im Unterprojekt `electron/` läuft:

```yaml
- name: Install Electron dependencies
  working-directory: electron
  run: npm ci --no-audit --no-fund
```

Das Electron-Package definiert:

```json
"dependencies": {
  "electron-updater": "^6.8.9"
},
"devDependencies": {
  "electron": "^43.4.0",
  "electron-builder": "^26.15.3"
}
```

Relevante Scripts:

```json
"build:win": "npm run prepare:bundle && electron-builder --win"
```

Der Windows-Packaging-Aufruf ist damit nicht nur `electron-builder --win`, sondern immer:

```text
npm run build:win
  ├─ npm run prepare:bundle
  └─ electron-builder --win
```

---

## 10. `prepare:bundle`: Was in den Installer gelangt

### 10.1 Standalone-Bundle lokalisieren

`scripts/build/prepare-electron-standalone.mjs` sucht den Next-Server unter:

```text
.build/next/standalone/server.js
```

und berücksichtigt außerdem mögliche verschachtelte Layouts wie:

```text
.build/next/standalone/projects/OmniRoute/server.js
.build/next/standalone/<basename>/server.js
```

Wenn kein `server.js` gefunden wird, bricht die Vorbereitung ab und fordert einen vorherigen `npm run build` auf.

### 10.2 Symlink-Schutz

Ein `node_modules`-Symlink im Standalone-Bundle wird abgelehnt. Hintergrund: `electron-builder` würde einen solchen Symlink bewahren, wodurch das installierte Programm auf einen absoluten Pfad der Build-Maschine zeigen könnte.

Die Pipeline verlangt deshalb ein echtes Verzeichnis.

### 10.3 Assembly

Aufgerufen wird unter anderem:

```js
assembleStandalone({
  distDir: DIST_DIR,
  outDir: ELECTRON_STANDALONE_DIR,
  projectRoot: ROOT,
  sanitizePaths: true,
  patchTurbopackChunks: true,
  copyNatives: true,
  materializeSymlinks: true,
});
```

Das erzeugt:

```text
.build/electron-standalone/
```

Enthalten werden typischerweise:

- Next-Standalone-Server
- `.next/static` bzw. `.build/next/static`
- `public`
- Runtime-`node_modules`
- native Module
- korrigierte/normalisierte Imports
- materialisierte Symlink-Inhalte

### 10.4 Compression Worker

Ein TypeScript-Worker wird mit esbuild in eine ESM-Datei gebündelt:

```text
open-sse/services/compression/compressionWorker.ts
→ .build/electron-standalone/open-sse/services/compression/compressionWorker.js
```

### 10.5 Runtime-Dokumente

Authoring-Dokumente werden aus dem Desktop-Staging-Bundle entfernt, um die Installationsgröße zu reduzieren.

### 10.6 Native SQLite-Prüfung

Das Script prüft `better-sqlite3`-Prebuilds für die aktuelle Build-Plattform und Architektur.

Seit `better-sqlite3` 13 wird Node-API/N-API verwendet. Dadurch ist der Binary nicht an eine einzelne Electron-Node-ABI gebunden wie frühere Varianten. Das Script:

1. prüft, ob `better-sqlite3` vorhanden ist,
2. prüft, ob ein passender Prebuild für `win32/x64` existiert,
3. entfernt Compile-Inputs und alte Build-Ausgaben (`build`, `deps`, `src`),
4. entfernt `keytar`, damit Electron Builder dessen passende Electron-Variante verwalten kann,
5. bricht bei stale native copies ab.

Die alte Strategie eines vollständigen Source-Rebuilds wurde bewusst ersetzt, weil sie bei jeder Plattform langsam und fehleranfällig war.

### 10.7 Optionale Packs

Am Ende werden optionale ML-/Browser-Abhängigkeiten über `stageOptionalPacks` in versionierte, checksum-basierte Packs außerhalb des Basispakets verschoben:

```text
.build/optional-packs/
```

Im Hauptbundle bleibt ein Index (`optional-packs.index.json`). Die Laufzeit kann diese Packs später im Datenverzeichnis installieren. Das reduziert die Basispaket-Kopplung, bedeutet aber auch, dass optionale Funktionen über einen separaten Runtime-Pfad geladen werden.

---

## 11. `electron-builder`-Konfiguration und die konkrete EXE

Die zentrale Konfiguration liegt direkt in `electron/package.json`.

### 11.1 Produktidentität

```json
"appId": "online.omniroute.desktop",
"productName": "OmniRoute",
"copyright": "Copyright © 2025 OmniRoute"
```

Der Anzeigename und der Dateinamenspräfix stammen aus `productName`, nicht aus dem npm-Paketnamen `omniroute-desktop`.

### 11.2 Ausgabeverzeichnis

```json
"directories": {
  "output": "dist-electron",
  "buildResources": "assets"
}
```

Die Builder-Ergebnisse liegen im Windows-Leg daher unter:

```text
electron/dist-electron/
```

### 11.3 Eingeschlossene Electron-Dateien

Unter `files` werden unter anderem gepackt:

```text
main.js
preload.js
loginManager.js
processTree.js
sqlite-inspection.js
remoteServerPromptPreload.js
remoteServerPromptRenderer.js
lib/resolveServerEntry.js
lib/resolveNodeHelper.js
lib/windowLifecycle.js
lib/loginHeaderCapture.js
lib/resolveRemoteServerUrl.js
lib/remoteServerPreferences.js
lib/serverReadiness.js
lib/windowClosePolicy.js
assets/remoteServerPrompt.html
package.json
node_modules/**/*
```

### 11.4 Eingebetteter Server als `extraResources`

```json
"extraResources": [
  {
    "from": "../.build/electron-standalone",
    "to": "app",
    "filter": ["**/*", "node_modules/**/*"]
  },
  {
    "from": "../.build/electron-standalone/node_modules",
    "to": "app/node_modules",
    "filter": ["**/*"]
  },
  {
    "from": "assets",
    "to": "assets",
    "filter": ["icon.png", "tray-icon.png"]
  }
]
```

Das Electron-Shell-Programm und der Next.js-Server werden also getrennt behandelt:

```text
Electron-Hülle
  ├─ main.js und Preload/IPC-Code
  ├─ node_modules für Electron-seitige Dependencies
  └─ resources/app/ → eingebetteter OmniRoute-Standalone-Server
```

### 11.5 Windows-Ziele

```json
"win": {
  "target": [
    {
      "target": "nsis",
      "arch": ["x64"]
    },
    {
      "target": "portable",
      "arch": ["x64"]
    }
  ],
  "icon": "assets/icon.ico"
}
```

Der Windows-Leg erzeugt daher zwei `.exe`-Arten:

1. **NSIS Installer** — installiert OmniRoute normal in Windows.
2. **Portable EXE** — direkt ausführbar ohne Installation.

### 11.6 NSIS-Konfiguration

```json
"nsis": {
  "artifactName": "${productName}.Setup.${version}.${ext}",
  "oneClick": false,
  "allowToChangeInstallationDirectory": true,
  "createDesktopShortcut": true,
  "createStartMenuShortcut": true,
  "installerIcon": "assets/icon.ico",
  "uninstallerIcon": "assets/icon.ico"
}
```

Bedeutung:

- `artifactName`: erzeugt `OmniRoute.Setup.3.8.50.exe`.
- `oneClick: false`: normaler mehrstufiger Installer statt stiller One-Click-Installation.
- `allowToChangeInstallationDirectory: true`: der Benutzer kann den Zielordner ändern.
- `createDesktopShortcut: true`: Desktop-Verknüpfung.
- `createStartMenuShortcut: true`: Startmenü-Verknüpfung.
- `installerIcon`/`uninstallerIcon`: Windows-Icon aus `electron/assets/icon.ico`.

Es ist keine Code-Signing-Konfiguration im `electron/package.json` erkennbar. Der Installer wird daher nach dieser Konfiguration nicht mit einem im Repository referenzierten Windows-Code-Signing-Zertifikat signiert. Das erklärt, warum Windows SmartScreen bei einer öffentlichen, nicht signierten Build-Datei warnen kann.

---

## 12. Der entscheidende Builder-Schritt

Im Workflow:

```yaml
- name: Build Electron for ${{ matrix.platform }}
  working-directory: electron
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: npm run build:${{ matrix.target }}
```

Für Windows wird `${{ matrix.target }}` zu `win`, daher:

```bash
cd electron
npm run build:win
```

Das expandiert zu:

```bash
npm run prepare:bundle && electron-builder --win
```

`electron-builder --win` liest die `build`-Konfiguration aus `electron/package.json`, startet den NSIS-Builder und erzeugt auf `windows-latest` die x64-Dateien.

`GH_TOKEN` wird gesetzt, weil `electron-builder` den GitHub-Publish-Provider kennt:

```json
"publish": {
  "provider": "github",
  "owner": "diegosouzapw",
  "repo": "OmniRoute"
}
```

Der Workflow verwendet den Builder jedoch primär zur lokalen Erstellung. Die Pipeline kopiert die erzeugten Dateien anschließend in ein Actions-Artefakt und veröffentlicht sie zentral im `release`-Job.

---

## 13. Smoke-Test des Windows-Pakets

Nach dem Builder läuft im Windows-Leg:

```yaml
- name: Smoke packaged Electron app
  if: matrix.platform != 'linux'
  continue-on-error: ${{ matrix.platform == 'windows' || matrix.platform == 'macos-arm64' }}
  env:
    ELECTRON_SMOKE_TIMEOUT_MS: 60000
    ELECTRON_SMOKE_STREAM_LOGS: "1"
  run: npm run electron:smoke:packaged
```

`npm run electron:smoke:packaged` ruft auf:

```bash
node scripts/dev/smoke-electron-packaged.mjs
```

### 13.1 Was der Test macht

Für Windows:

1. findet `electron/dist-electron/win-unpacked/OmniRoute.exe`,
2. legt ein temporäres `DATA_DIR` an,
3. baut ein isoliertes Windows-Umfeld (`USERPROFILE`, `APPDATA`, `LOCALAPPDATA`, `TEMP`),
4. prüft, dass Port 20128 frei ist,
5. startet die gepackte EXE,
6. wartet bis `http://127.0.0.1:20128/login` HTTP 200 liefert,
7. sammelt stdout/stderr,
8. sucht fatale Muster wie:
   - `Cannot find module`
   - `MODULE_NOT_FOUND`
   - `ERR_DLOPEN_FAILED`
   - `Server exited with code: <non-zero>`
   - `Failed to start server`
   - `Unhandled Rejection`
   - `Uncaught Exception`
9. beendet den gesamten Prozessbaum,
10. prüft, dass der Port nach dem Shutdown geschlossen ist.

Die Smoke-Prüfung testet daher nicht nur, ob `electron-builder` eine Datei geschrieben hat, sondern ob der gepackte Server tatsächlich startet.

### 13.2 Warum Windows trotzdem advisory ist

Der Schritt ist für Windows mit:

```yaml
continue-on-error: true
```

ausgeführt. Der Workflow-Kommentar nennt die bekannte Windows-Schwäche beim `requestSingleInstanceLock()` und beim Runner-`USERPROFILE` als Grund für den best-effort-Charakter.

Das ist ein wichtiger Unterschied:

- **Packaging-Schritt:** blockierend — wenn `electron-builder` scheitert, wird kein Windows-Artefakt erzeugt.
- **Windows-Packaged-Smoke:** advisory — ein Smoke-Test-Fehler verhindert nicht zwangsläufig die Veröffentlichung.

Damit kann ein formal erfolgreich erzeugter Installer trotz rotem/advisory Smoke-Verhalten im Release landen. Der CI- und Release-Entwurf akzeptiert dieses Risiko bewusst.

---

## 14. Einsammeln der Windows-Dateien

Nach dem Smoke-Schritt:

```yaml
- name: Collect installers
  shell: bash
  run: |
    mkdir -p release-assets
    cd electron/dist-electron
    for file in *${{ matrix.ext }}; do
      [ -f "$file" ] && cp "$file" ../../release-assets/
    done
```

Für Windows ist `matrix.ext` gleich `.exe`. Somit werden zunächst alle EXE-Dateien aus `electron/dist-electron` in `release-assets/` kopiert.

Danach wird die portable Datei standardisiert umbenannt:

```bash
if [ "${{ matrix.platform }}" = "windows" ]; then
  for file in *.exe; do
    case "$file" in *Setup*) continue ;; esac
    [ -f "$file" ] && cp "$file" "../../release-assets/OmniRoute.exe" && break
  done
fi
```

Das ist wichtig:

- Der Installer enthält `Setup` im Namen und wird übersprungen.
- Die erste andere EXE wird als `OmniRoute.exe` kopiert.
- Diese Datei ist die portable Variante.

Ergebnis des Windows-Legs in `release-assets/`:

```text
OmniRoute.Setup.3.8.50.exe
OmniRoute.exe
latest.yml        # falls von electron-builder erzeugt
*.blockmap       # falls von electron-builder erzeugt
```

### Update-Manifest

Zusätzlich werden alle `latest*.yml` kopiert:

```bash
for file in latest*.yml; do
  [ -f "$file" ] && cp "$file" ../../release-assets/
done
```

Für Windows ist insbesondere `latest.yml` relevant. `electron-updater` benötigt dieses Manifest, um eine neuere Windows-Version und ihre Hash-/Dateiinformationen zu finden.

### Actions-Artefakt

```yaml
- name: Upload artifacts
  uses: actions/upload-artifact@v7
  with:
    name: electron-${{ matrix.platform }}
    path: release-assets/
```

Für Windows lautet der Artefaktname:

```text
electron-windows
```

Das ist zunächst noch kein GitHub-Release-Asset. Es ist ein temporäres, jobübergreifendes Actions-Artefakt.

---

## 15. Job 4: `release` — aus Actions-Artefakten werden Release-Dateien

Der Release-Job hängt von `validate` und der Matrix `build` ab:

```yaml
release:
  name: Create Release
  needs: [validate, build]
```

Er läuft mit:

```yaml
if: ${{ !cancelled() && needs.validate.result == 'success' }}
```

Das ist absichtlich nicht der einfache Default-Gate-Mechanismus, der bei einem fehlgeschlagenen Matrix-Leg alle Artefakte verwerfen würde. Die Pipeline soll partial/fail-partial funktionieren: erfolgreich gebaute Plattformen werden angehängt; anschließend wird ein unvollständiger Desktop-Kanal separat sichtbar gemacht.

### 15.1 Alle Matrix-Artefakte herunterladen

```yaml
- name: Download all artifacts
  uses: actions/download-artifact@v8
  with:
    path: artifacts
```

Die Artefakte liegen getrennt in Unterverzeichnissen, beispielsweise sinngemäß:

```text
artifacts/
  electron-windows/
    OmniRoute.Setup.3.8.50.exe
    OmniRoute.exe
    latest.yml
  electron-macos-intel/
    ...
  electron-macos-arm64/
    ...
  electron-linux/
    ...
```

### 15.2 Plattformdateien einsammeln

```bash
mkdir -p release-assets
find artifacts -type f ! -name latest-mac.yml -exec cp -n {} release-assets/ \;
```

`latest-mac.yml` wird ausgespart, weil es aus zwei macOS-Legs zusammengeführt werden muss. Für Windows wird `latest.yml` direkt übernommen.

### 15.3 Quellarchive

Der Release-Job erzeugt zusätzlich:

```bash
git archive --format=tar.gz --prefix="OmniRoute-${VERSION}/" HEAD \
  -o "release-assets/OmniRoute-${VERSION}.source.tar.gz"

git archive --format=zip --prefix="OmniRoute-${VERSION}/" HEAD \
  -o "release-assets/OmniRoute-${VERSION}.source.zip"
```

Die Windows-EXE stammt nicht aus diesen Quellarchiven. Die Source-Archive werden lediglich parallel als Release-Assets beigefügt.

### 15.4 GitHub Release-Erstellung

```yaml
- name: Create Release
  uses: softprops/action-gh-release@v3
  with:
    tag_name: ${{ needs.validate.outputs.version }}
    draft: false
    prerelease: false
    generate_release_notes: true
    fail_on_unmatched_files: false
    files: |
      release-assets/*.dmg
      release-assets/*.exe
      release-assets/*.AppImage
      release-assets/*.deb
      release-assets/*.blockmap
      release-assets/*.yml
      release-assets/*.source.tar.gz
      release-assets/*.source.zip
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Weil die globale Version `v3.8.50` ist, wird `OmniRoute.Setup.3.8.50.exe` an den Release `v3.8.50` angehängt.

Das erklärt den vom Benutzer angegebenen Downloadpfad vollständig:

```text
https://github.com/diegosouzapw/OmniRoute/releases/download/v3.8.50/OmniRoute.Setup.3.8.50.exe
```

---

## 16. Job 5: `verify-desktop-assets`

Nach dem Release wird nicht nur der Jobstatus geprüft, sondern die GitHub-Release-API:

```yaml
verify-desktop-assets:
  needs: [validate, release]
```

Der Job ruft auf:

```bash
gh release view "$VERSION" \
  --repo "$GITHUB_REPOSITORY" \
  --json assets \
  --jq '.assets[].name'
```

Danach verlangt er mindestens Muster für:

```text
\.exe$
\.dmg$
\.AppImage$
\.deb$
^latest.*\.yml$
\.source\.tar\.gz$
```

Für den Windows-Kanal genügt damit formal mindestens eine `.exe`; die tatsächliche Release `v3.8.50` enthält sogar:

```text
OmniRoute.Setup.3.8.50.exe
OmniRoute.exe
```

Dieser Job verhindert insbesondere das frühere Problem, dass ein Release grün sein konnte, obwohl ein Plattform-Leg ausgefallen war und das Release keine Desktop-Binaries enthielt.

---

## 17. Was befindet sich nach der Installation in Windows?

Die installierte Anwendung ist keine reine GUI-Datei. Sie enthält eine Electron-Shell und den eingebetteten OmniRoute-Server.

### 17.1 Electron-Main-Prozess

`electron/main.js`:

- fordert einen Single-Instance-Lock an,
- startet bzw. verwaltet den eingebetteten Server,
- erzeugt das BrowserWindow,
- baut System-Tray-Menüs,
- stellt IPC bereit,
- verwaltet Server-Port und Neustarts,
- lädt die Next.js-Oberfläche,
- konfiguriert `electron-updater`.

### 17.2 Eingebetteter Server

Der Pfad wird im gepackten Programm aus `process.resourcesPath` abgeleitet:

```text
<resources>/app
```

Der Server wird über den Electron-eigenen Node-Runtime-Pfad gestartet. Auf Windows betrifft das auch die Prozessbaum-Kontrolle, weil ein einfacher Kill des direkten Prozesses Kindprozesse zurücklassen könnte.

### 17.3 Standarddatenverzeichnis

Wenn `DATA_DIR` nicht gesetzt ist, verwendet der Windows-Pfad sinngemäß:

```text
%APPDATA%\omniroute
```

Dort können unter anderem Konfiguration, SQLite-Datenbank, Präferenzen, Credentials und optionale Runtime-Packs liegen.

### 17.4 Readiness

Das Electron-Fenster wird erst normal angezeigt, nachdem der eingebettete Server erreichbar ist. Dadurch sollte beim Start nicht sofort eine leere/weiße Oberfläche angezeigt werden, während der Next-Server noch hochfährt.

---

## 18. Update-Mechanismus unter Windows

`electron/main.js` konfiguriert:

```js
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
```

Das bedeutet:

- Updates werden nicht automatisch sofort heruntergeladen.
- Ein Update kann geprüft und vom Benutzer ausgelöst werden.
- Nach dem Download wird bei Beenden/Installieren die neue Version eingesetzt.

Das `latest.yml`-Manifest muss neben dem Windows-Installer veröffentlicht sein. Es beschreibt typischerweise:

- Version
- Installer-Dateiname
- SHA-512 des Installers
- Größe
- Release-Datum
- gegebenenfalls Blockmap-Informationen

Die Pipeline kopiert die `latest*.yml`-Dateien deshalb ausdrücklich ins Release.

Der Installername muss stabil sein. Die NSIS-Konfiguration verwendet deshalb explizit:

```text
OmniRoute.Setup.<version>.exe
```

---

## 19. Warum der Installer ungefähr 526 MB groß ist

Die GitHub-API meldet für den konkreten Installer `526,572,556` Bytes. Das ist für eine Electron-App mit eingebettetem Next.js-Server plausibel, weil die Datei mehrere Schichten enthält:

1. Electron Runtime 43.
2. Chromium-/V8-Bestandteile.
3. Electron-Main-/Preload-Code.
4. Das komplette Next.js-Standalone-Runtime-Bundle.
5. `node_modules` und serverseitige Dependencies.
6. Native SQLite-/Bild-/Runtime-Module.
7. Assets und Icons.
8. NSIS-Installer-Overhead.
9. Komprimierte bzw. eingebettete Ressourcen.

Die optionalen Pack-Auslagerungen reduzieren die Basiskopplung, aber nicht zwingend den gesamten Installer auf eine kleine Datei, weil das Kernsystem weiterhin viele Servermodule enthält.

---

## 20. Sicherheits- und Supply-Chain-Eigenschaften

### Positiv

- Tag-/Input-Version wird strikt validiert.
- GitHub Actions haben global `contents: read`; Schreibrechte werden jobweise erteilt.
- Checkout nutzt `persist-credentials: false`.
- Shared-Bundle wird per Archiv-SHA-256 und Entry-Manifest geprüft.
- Symlinks im Standalone-Tree werden materialisiert bzw. problematische Symlinks abgelehnt.
- Native Prebuilds werden vor Packaging validiert.
- Windows- und andere Plattformen werden auf passenden Runnern gebaut.
- Release-Assets werden nach der Veröffentlichung per `gh release view` geprüft.
- Der konkrete Release-Asset-Digest ist öffentlich über die GitHub-API verifizierbar.

### Einschränkungen

- Die öffentliche Release-API zeigt für den bekannten `v3.8.50`-Workflow-Lauf `startup_failure` und keine Jobs; der vollständige erfolgreiche Producer-Log ist öffentlich nicht mehr rekonstruierbar.
- Windows-Smoke-Test ist `continue-on-error: true`; Packaging und Smoke sind deshalb unterschiedlich stark abgesichert.
- In der Electron-Konfiguration ist kein Windows-Code-Signing-Zertifikat angegeben.
- `fail_on_unmatched_files: false` erlaubt dem Release-Upload, bei nicht passenden Globs nicht automatisch zu scheitern; der separate Asset-Verifikationsjob soll dieses Risiko reduzieren.
- `GH_TOKEN` wird im Electron-Leg gesetzt, obwohl die zentrale Veröffentlichung im `release`-Job erfolgt; dies ist kompatibel mit dem konfigurierten GitHub-Publish-Provider, macht aber den Pipelinepfad weniger minimal als ein reines lokales Packaging.

---

## 21. Exakte Rekonstruktion für einen lokalen Windows-Build

Ein lokaler Build auf Windows folgt konzeptionell diesen Schritten:

```powershell
# Root des Repository
npm ci

# Next.js Standalone vorbereiten
$env:JWT_SECRET = "ci-build-secret-with-sufficient-length-for-validation"
$env:OMNIROUTE_USE_TURBOPACK = "0"
npm run build

# Electron-Abhängigkeiten
cd electron
npm ci --no-audit --no-fund

# Windows-Installer und portable EXE
npm run build:win
```

Korrekt ohne Tippfehler lautet der letzte Befehl:

```powershell
npm run build:win
```

Der Befehl erzeugt:

```text
electron/dist-electron/OmniRoute.Setup.3.8.50.exe
electron/dist-electron/OmniRoute-3.8.50.exe   # Builder-interner portable Name, je nach Version
```

Die Release-Pipeline kopiert die portable Datei danach bewusst auf:

```text
release-assets/OmniRoute.exe
```

Ein lokaler Build ist nicht garantiert bitidentisch zum GitHub-Asset, weil Runner-Umgebung, npm-Cache, native Prebuild-Auswahl, Electron-Builder-Version und Zeit-/Metadaten variieren können. Für Reproduzierbarkeit müssen insbesondere Commit, Lockdateien, Node 24, Windows-Architektur und exakt derselbe Builder-Stand verwendet werden.

---

## 22. End-to-End-Dateifluss als Tabelle

| Phase | Ort | Datei/Output |
|---|---|---|
| Tag | GitHub | `v3.8.50` |
| Version | Actions Output | `v3.8.50` |
| Web-Build | Ubuntu Runner | `.build/next` |
| Shared-Transfer | Actions Artifact | `web-bundle.tar.gz` + Manifest |
| Windows-Restore | Windows Runner | `.build/next` |
| Electron-Staging | Windows Runner | `.build/electron-standalone` |
| Builder-Input | `electron/package.json` | `productName=OmniRoute`, `version=3.8.50` |
| NSIS-Output | `electron/dist-electron` | `OmniRoute.Setup.3.8.50.exe` |
| Portable-Output | `electron/dist-electron` | zweite `.exe` |
| Normalisierte portable Datei | `release-assets` | `OmniRoute.exe` |
| Job-Artifact | Actions | `electron-windows` |
| Release-Sammlung | Ubuntu Runner | `release-assets/*.exe` |
| GitHub Release | GitHub | `v3.8.50` |
| Endgültiger Download | GitHub CDN | `/releases/download/v3.8.50/OmniRoute.Setup.3.8.50.exe` |

---

## 23. Konkrete Antwort auf die Kernfrage

**Wie wird genau der Installer `OmniRoute.Setup.3.8.50.exe` gemacht?**

1. Ein Tag `v3.8.50` löst `.github/workflows/electron-release.yml` aus.
2. `validate` extrahiert und validiert `v3.8.50`.
3. `web-build` erstellt auf Ubuntu einmal den Next.js-Standalone-Server mit Node 24, Webpack und einem CI-JWT-Secret.
4. Der Standalone-Baum wird als Hash-verifiziertes Archiv hochgeladen.
5. Die Windows-Matrix startet auf `windows-latest`.
6. Der Runner installiert Root-Abhängigkeiten mit `npm ci`.
7. `USERPROFILE` wird auf ein junction-freies Temp-Verzeichnis umgestellt.
8. Das Shared-Bundle wird heruntergeladen, SHA-256-verifiziert, extrahiert und gegen `win32/x64` native Dependencies hydratisiert.
9. Die Workflow-Version `v3.8.50` wird in `electron/package.json` als `3.8.50` gesetzt.
10. `electron` installiert seine Dependencies.
11. `npm run build:win` startet `prepare:bundle` und danach `electron-builder --win`.
12. `electron-builder` liest `win.target = nsis + portable`.
13. Der NSIS-Builder verwendet `productName=OmniRoute`, `version=3.8.50` und `artifactName=${productName}.Setup.${version}.${ext}`.
14. Dadurch wird der NSIS-Installer `OmniRoute.Setup.3.8.50.exe` erzeugt.
15. Eine Windows-Smoke-Prüfung startet die gepackte App und wartet auf HTTP 200 von `/login`; dieser Check ist Windows-seitig advisory.
16. Der Installer wird nach `release-assets/` kopiert.
17. Der portable Build wird in `release-assets/OmniRoute.exe` umbenannt.
18. Beide Dateien werden als `electron-windows`-Actions-Artefakt hochgeladen.
19. Der zentrale `release`-Job lädt das Artefakt herunter.
20. `softprops/action-gh-release@v3` hängt alle `*.exe`-Dateien an Release `v3.8.50`.
21. `verify-desktop-assets` fragt die Release-Assets erneut über GitHub CLI ab und prüft, dass mindestens eine EXE vorhanden ist.
22. Der konkrete GitHub-Asset-Download liefert die oben dokumentierte 526-MB-Datei mit SHA-256 `70d7...f72d1`.

---

## 24. Quellenverzeichnis

### Repository

- [`electron-release.yml`](https://github.com/diegosouzapw/OmniRoute/blob/release/v3.8.50/.github/workflows/electron-release.yml)
- [`electron/package.json`](https://github.com/diegosouzapw/OmniRoute/blob/release/v3.8.50/electron/package.json)
- [`prepare-electron-standalone.mjs`](https://github.com/diegosouzapw/OmniRoute/blob/release/v3.8.50/scripts/build/prepare-electron-standalone.mjs)
- [`assembleStandalone.mjs`](https://github.com/diegosouzapw/OmniRoute/blob/release/v3.8.50/scripts/build/assembleStandalone.mjs)
- [`standaloneBundle.mjs`](https://github.com/diegosouzapw/OmniRoute/blob/release/v3.8.50/scripts/build/standaloneBundle.mjs)
- [`standaloneManifest.mjs`](https://github.com/diegosouzapw/OmniRoute/blob/release/v3.8.50/scripts/build/standaloneManifest.mjs)
- [`standaloneTarball.mjs`](https://github.com/diegosouzapw/OmniRoute/blob/release/v3.8.50/scripts/build/standaloneTarball.mjs)
- [`hydrateNativeDeps.mjs`](https://github.com/diegosouzapw/OmniRoute/blob/release/v3.8.50/scripts/build/hydrateNativeDeps.mjs)
- [`electronRebuildPlan.mjs`](https://github.com/diegosouzapw/OmniRoute/blob/release/v3.8.50/scripts/build/electronRebuildPlan.mjs)
- [`optionalPackStaging.mjs`](https://github.com/diegosouzapw/OmniRoute/blob/release/v3.8.50/scripts/build/optionalPackStaging.mjs)
- [`buildToolRunner.mjs`](https://github.com/diegosouzapw/OmniRoute/blob/release/v3.8.50/scripts/build/buildToolRunner.mjs)
- [`build-next-isolated.mjs`](https://github.com/diegosouzapw/OmniRoute/blob/release/v3.8.50/scripts/build/build-next-isolated.mjs)
- [`smoke-electron-packaged.mjs`](https://github.com/diegosouzapw/OmniRoute/blob/release/v3.8.50/scripts/dev/smoke-electron-packaged.mjs)
- [`electron/main.js`](https://github.com/diegosouzapw/OmniRoute/blob/release/v3.8.50/electron/main.js)
- [`electron/preload.js`](https://github.com/diegosouzapw/OmniRoute/blob/release/v3.8.50/electron/preload.js)
- [`electron/processTree.js`](https://github.com/diegosouzapw/OmniRoute/blob/release/v3.8.50/electron/processTree.js)
- [`electron/lib/serverReadiness.js`](https://github.com/diegosouzapw/OmniRoute/blob/release/v3.8.50/electron/lib/serverReadiness.js)
- [`electron/README.md`](https://github.com/diegosouzapw/OmniRoute/blob/release/v3.8.50/electron/README.md)

### GitHub Release und API

- [Release v3.8.50](https://github.com/diegosouzapw/OmniRoute/releases/tag/v3.8.50)
- [Ziel-Asset](https://github.com/diegosouzapw/OmniRoute/releases/download/v3.8.50/OmniRoute.Setup.3.8.50.exe)
- [Release-API](https://api.github.com/repos/diegosouzapw/OmniRoute/releases/tags/v3.8.50)
- [Asset-API für den Installer](https://api.github.com/repos/diegosouzapw/OmniRoute/releases/assets/535719367)
- [Actions-Workflow-Datei](https://raw.githubusercontent.com/diegosouzapw/OmniRoute/release/v3.8.50/.github/workflows/electron-release.yml)
- [Öffentlich sichtbarer Actions-Lauf](https://github.com/diegosouzapw/OmniRoute/actions/runs/33005490476)

---

# Addendum: vertiefte technische Rekonstruktion

Die folgenden Abschnitte ergänzen die erste Analyse auf Implementierungs-, Dateisystem-, ABI-, Prozess- und Fehlerbehandlungsebene. Sie erklären insbesondere, warum der Build nicht bei `electron-builder` beginnt und warum ein scheinbar erfolgreiches Next.js-`build` für den Desktop noch nicht ausreicht.

## 25. Drei verschiedene Artefakte, die nicht verwechselt werden dürfen

Im Ablauf existieren drei unterschiedliche Artefaktklassen:

### 25.1 Next.js-Build-Tree

```text
.build/next/
```

Das ist zunächst ein Build-Ergebnis des Root-Projekts. Es enthält Next-Ausgaben, unter anderem `standalone`, statische Assets und serverseitige Chunks. Es ist noch kein Electron-Programm und noch kein Windows-Installer.

### 25.2 Electron-Staging-Tree

```text
.build/electron-standalone/
```

Dieser Tree wird durch `prepare-electron-standalone.mjs` erzeugt. Er ist eine speziell für Electron vorbereitete Kopie des Next-Standalone-Servers. In diesem Schritt werden Pfade, native Module, dynamische Imports, Symlinks, Worker und zusätzliche Sidecars korrigiert.

### 25.3 Finales `electron-builder`-Output

```text
electron/dist-electron/
```

Hier liegen die plattformspezifischen Ergebnisse:

```text
win-unpacked/                     # entpackte Windows-Testinstallation
OmniRoute.Setup.3.8.50.exe       # NSIS-Installer
<portable-builder-output>.exe     # portable Zielvariante
latest.yml                       # Windows-Updater-Manifest, falls erzeugt
*.blockmap                       # inkrementelles Update-Mapping, falls erzeugt
```

Erst die dritte Ebene enthält die Dateien, die das Workflow-Script nach `release-assets/` kopiert.

---

## 26. Der Root-Build und die Electron-Vorbereitung sind zwei Assembly-Stufen

### 26.1 Root-Script

Das Root-`package.json` definiert:

```json
"build": "node scripts/build/build-next-isolated.mjs"
```

`build-next-isolated.mjs` startet nicht einfach `next build`, sondern setzt den Build in eine kontrollierte Umgebung:

- `OMNIROUTE_BUILDING=1`
- `NEXT_TELEMETRY_DISABLED=1`
- isoliertes Windows-HOME/`USERPROFILE` bei Windows-Aufrufen
- standardmäßig bis zu 8192 MB V8-Heap, sofern kein expliziter Heap gesetzt ist
- `--webpack`, wenn `OMNIROUTE_USE_TURBOPACK=0` gesetzt ist
- sonst Node-seitig standardmäßig `--turbopack`
- temporäres Verschieben problematischer Build-Workspace-Pfade
- Wiederherstellung der verschobenen Pfade in `finally`

Die Actions setzen `OMNIROUTE_USE_TURBOPACK=0` im Shared-Job. Dadurch ist der zentrale Bundle-Build reproduzierbarer und weniger empfindlich gegenüber dem nativen Turbopack-Speicherverbrauch.

### 26.2 Postbuild und Electron

Im Root-Package ist außerdem ein `postbuild`-Hook vorhanden:

```json
"postbuild": "node scripts/build/colocate-standalone.mjs"
```

Dieser Hook co-located Worker, darunter den Call-Log-Artifact-Worker und Compression-/LLMLingua-Worker. Der Electron-spezifische Pfad verwendet anschließend nochmals `prepare-electron-standalone.mjs`, weil der rohe Next-Output für ein verschobenes, gepacktes Electron-Programm zusätzliche Anforderungen hat.

### 26.3 Warum doppeltes Assembly sinnvoll ist

Next.js Output File Tracing kann nur statische Abhängigkeiten sicher erkennen. OmniRoute verwendet aber unter anderem:

- `worker_threads` mit dynamischen Worker-Pfaden,
- dynamische `require`-/`import`-Aufrufe,
- Kindprozesse für MITM/Tunnel/Services,
- native `.node`-, `.so`- und Rust-Dateien,
- optionale Dependencies,
- platform-spezifische Packages,
- Turbopack-generierte Hash-Namen und Symlinks.

Der normale Server-Build optimiert für Next-Ausführung. Der Electron-Assembler optimiert zusätzlich für Verschiebung auf eine andere Maschine und für die Ressourcenstruktur von `electron-builder`.

---

## 27. Was `assembleStandalone.mjs` tatsächlich zusätzlich kopiert

Die zentrale Liste `NATIVE_ASSET_ENTRIES` und `EXTRA_MODULE_ENTRIES` ist eine wichtige, oft übersehene Schicht. Sie verhindert, dass ein Build nur deshalb scheinbar erfolgreich ist, weil die fehlende Dependency erst auf einem seltenen Runtime-Pfad geladen wird.

### 27.1 Native Assets

Für den Electron-Tree werden je nach Vorhandensein kopiert:

```text
node_modules/better-sqlite3/build
node_modules/better-sqlite3/prebuilds
node_modules/onnxruntime-node/bin
src/mitm/tproxy/native/build/Release/transparent.node   # optional Linux
```

`onnxruntime-node/bin` ist besonders wichtig, weil `libonnxruntime.so.1` dynamisch geladen wird und deshalb für den statischen Next-Tracer nicht zwingend sichtbar ist.

### 27.2 Runtime-Module und Sidecars

Die Liste umfasst unter anderem:

```text
wreq-js
@swc/helpers
pino-abstract-transport
pino-pretty
split2
selfsigned
playwright-core
undici
ws
sql.js
sqlite-vec
sqlite-vec-<plattform>-<arch>
```

Zusätzlich werden nicht aus `node_modules` stammende Dateien kopiert:

```text
migrations/
src/mitm/server.cjs
src/mitm/_internal/
dev/run-standalone.mjs
server-ws.mjs
peer-stamp.mjs
main-server-timeouts.mjs
systemd-notify.mjs
http-method-guard.cjs
head-response-guard.cjs
responses-ws-proxy.mjs
webdav-handler.mjs
tls-options.mjs
build/runtime-env.mjs
build/bootstrap-env.mjs
healthcheck.mjs
public/
```

### 27.3 Warum `ws` und `undici` explizit repariert werden

Der Code dokumentiert zwei konkrete Fehlerklassen:

1. Der Standalone-Tracer kann für ein externalisiertes Package einen leeren bzw. hohlen Package-Ordner erzeugen. Dieser Ordner kann dann die vollständige Dependency im äußeren `node_modules` überschattet.
2. Ein MCP-/WS-Server kann beim Modul-Linking scheitern, obwohl das Package in der Root-Installation existiert.

Die Assembly-Stufe overlayt deshalb die vollständigen Root-Package-Inhalte auf den Standalone-Tree. Das ist keine pauschale Kopie des gesamten Root-`node_modules`, sondern eine gezielte Liste bekannter dynamischer oder problematischer Module.

### 27.4 Keine blind überschreibenden Kopien

Vor jeder Kopie werden zwei Situationen geprüft:

- Quelle und Ziel sind bereits derselbe reale Pfad.
- Das Ziel existiert als falscher Node-Typ oder stale Symlink.

Bei einem stale Ziel wird es über `lstat` erkannt und entfernt, bevor `cpSync`/`fs.cp` ausgeführt wird. Das adressiert Race-/Typfehler wie:

```text
ERR_FS_CP_EINVAL
ERR_FS_CP_DIR_TO_NON_DIR
ERR_FS_CP_NON_DIR_TO_DIR
```

---

## 28. Absolute Pfade, `type: module` und CommonJS: drei Packaging-Fallen

### 28.1 Absolute Build-Pfade

Next kann den Root-Pfad des Build-Rechners in `server.js` oder `required-server-files.json` einbetten. Das wäre im GitHub-Runner etwa ein Pfad unter `D:\a\...` bzw. ein Linux-Pfad im Shared-Build.

`assembleStandalone(... sanitizePaths: true)` ersetzt die Build-Root-Referenzen durch relative Werte. Ohne diese Sanierung könnte das auf dem Benutzerrechner zu einem nicht existierenden Pfad zeigen.

### 28.2 Root-`type: module`

Das Root-Repository ist ESM-orientiert, der Next-Standalone-`server.js` ist aber CommonJS und verwendet `require()`. Deshalb entfernt `patchStandalonePackageJson` aus der kopierten Standalone-`package.json` das Root-Feld:

```json
"type": "module"
```

Würde dieses Feld im Root des gepackten Standalone-Trees verbleiben, könnte Node `server.js` als ESM interpretieren und mit `require is not defined in ES module scope` abbrechen.

### 28.3 ESM-Worker benötigen lokale Scopes

Einige per esbuild erzeugte Worker werden als ESM ausgegeben, behalten aber `.js` als Endung. Die Lösung ist nicht, den gesamten Server wieder zu ESM zu machen, sondern neben den jeweiligen Worker-Verzeichnissen ein lokales Package-Scope mit:

```json
{
  "type": "module"
}
```

So bleiben gleichzeitig möglich:

```text
Root server.js       → CommonJS
Worker.js            → ESM
```

---

## 29. Deterministischer Shared-Bundle-Transfer im Detail

### 29.1 Manifest

`standaloneManifest.mjs` setzt:

```js
export const MANIFEST_VERSION = 1;
```

Der Verzeichnis-Walk:

- sortiert Directory-Einträge lexikografisch,
- verwendet relative Forward-Slash-Pfade,
- speichert keine Zeitstempel,
- speichert für Dateien Größe und SHA-256,
- speichert bei Symlinks ausschließlich das Link-Ziel,
- sortiert das Endmanifest nochmals nach Pfad.

Große Dateien werden gestreamt gehasht. Das ist für `onnxruntime` wichtig, weil native Runtime-Dateien sehr groß sein können und nicht komplett in den JavaScript-Heap geladen werden sollen.

### 29.2 Deterministischer Tarball

`standaloneTarball.mjs` verwendet einen eigenen Node-basierten USTAR/Gzip-Pfad statt blind auf das Betriebssystem-`tar` zu vertrauen. Gründe:

- Windows-Long-Path-Verhalten von `bsdtar` ist nicht überall gleich.
- Windows und Unix sollen denselben Node-Dateisystempfad verwenden.
- Pfade werden sortiert.
- `mtime`, UID und GID werden auf deterministische Werte gesetzt.
- Dateimodi werden auf `0644` bzw. ausführbare `0755` normalisiert.
- Lange Pfade werden mit GNU-LongLink-Mechanismus unterstützt.

Die Gzip-Stufe nutzt Level 1. Das priorisiert Geschwindigkeit während des kurzlebigen Actions-Artefakttransfers; der Inhalt ist bereits tar-komprimiert.

### 29.3 Restore-Vertrag

Die Restore-Reihenfolge ist absichtlich:

```text
Manifest lesen
  → Manifest-Version prüfen
  → Archivgröße prüfen
  → Archiv-SHA-256 prüfen
  → Zielbaum löschen
  → extrahieren
  → jeden Eintrag prüfen
  → unlisted files suchen
```

Ein zusätzlicher oder eingeschleuster Dateiinhalt kann damit nicht unbemerkt im restaurierten Tree bleiben. Danach darf `hydrate` den Tree gezielt verändern; die Manifest-Prüfung bezieht sich auf den Transfer vor der plattformabhängigen Hydration.

---

## 30. Native Dependency Matrix für Windows

Die Workflow-Matrix übergibt an `hydrate`:

```text
platform = win32
arch     = x64
```

`verifyBundledNatives` prüft mindestens:

| Dependency | Erwarteter Windows-Nachweis |
|---|---|
| `koffi` | `build/koffi/win32_x64` |
| `better-sqlite3` | `prebuilds/win32-x64.node` |
| `wreq-js` | Rust-Binary mit `win32-x64`-Prefix |
| `onnxruntime-node` | `bin/napi-v6/win32/x64` |

Die bewusst nicht komplett umkopierten Dependencies sind in zwei Klassen geteilt:

### 30.1 Für alle Plattformen im Bundle enthalten

- `koffi` mit mehreren Triplets,
- `better-sqlite3` v13 mit mehreren N-API-Prebuilds,
- `wreq-js` mit Rust-Binaries,
- `onnxruntime-node` mit Plattform-/Architekturpfaden.

### 30.2 Vom jeweiligen Matrix-Leg hydratisiert

- `@img/sharp-*`
- `@img/sharp-libvips-*`
- `@ngrok/ngrok-*`
- `fsevents`

Der Linux-Shared-Tree darf nicht einfach unverändert als Windows-Tree verwendet werden. `hydratePlatformNatives` sammelt sowohl Forks aus dem Shared-Tree als auch Forks aus dem lokalen Windows-`node_modules`, entfernt die alte Variante und kopiert die Windows-Variante hinein. Fehlt eine auf der Zielplattform nicht passende Dependency, wird sie entfernt statt als falsche Binary zu verbleiben.

### 30.3 SQLite: N-API statt Electron-Rebuild

`electronRebuildPlan.mjs` erklärt, dass `better-sqlite3` v13 N-API-Prebuilds verwendet. Der historische Source-Rebuild gegen Electron-Header ist für diesen Pfad nicht mehr erforderlich.

Das Script emuliert die Loader-Auswahl:

```text
win32 + x64 → prebuilds/win32-x64.node
linux + glibc → prebuilds/linux-x64.node
linux ohne glibc report → prebuilds/linuxmusl-x64.node
```

Fehlt der konkret ausgewählte Prebuild, bricht Packaging ab. Das ist besser als ein Installer, der erst auf einem Benutzergerät auf `sql.js` zurückfällt und bei einer großen Datenbank mit massiv höherem Speicherbedarf unbrauchbar wird.

---

## 31. Optional-Packs: Was wirklich aus dem Installer herauswandert

`optionalPackStaging.mjs` läuft erst nach Assembly und Native-Schritten und ausschließlich gegen:

```text
.build/electron-standalone
```

Nicht verändert wird der allgemeine Docker-/Nicht-Electron-Standalone-Baum.

Für jede konfigurierte Pack-Gruppe:

1. werden Mitglieder im Staging-Baum gesucht,
2. die Mitglieder werden in `.build/optional-packs/<name>/node_modules` verschoben,
3. ein Checksum-Index wird erzeugt,
4. ein `optional-pack-<name>.tar.gz` kann erstellt werden,
5. der Pack wird nur indiziert, wenn alle erwarteten Mitglieder vorhanden sind.

Die Suche ist begrenzt und berücksichtigt verschachtelte `node_modules`-Orte. Verschobene Dateien werden nicht nur kopiert, sondern nach Möglichkeit innerhalb desselben Volumes umbenannt. Dadurch bleibt der Desktop-Basistree kleiner, während die Packs separat versioniert und prüfbar bleiben.

Wichtige Semantik: `fail-open` bedeutet hier nicht, dass ein unvollständiger Pack heimlich als vollständig gilt. Fehlende Mitglieder werden übersprungen; ein unvollständiger Pack wird nicht indiziert. Die App darf dann die optionale Funktion ohne diesen Pack nicht als installiert ansehen.

---

## 32. Windows-Prozessmodell des installierten Programms

### 32.1 Eingebetteter Node-Server

Die Electron-Shell verwendet im gepackten Zustand `process.execPath`, also die Electron-Executable, für den Serverprozess und setzt `ELECTRON_RUN_AS_NODE=1`. Dadurch wird nicht irgendein separat installiertes System-Node verwendet.

Das schützt insbesondere vor:

- fehlendem Node auf dem Zielrechner,
- falscher Node-Version,
- falscher CPU-Architektur,
- ABI-Mismatch zwischen System-Node und ausgelieferten Dependencies.

### 32.2 Prozessbaum

Der Server kann seinerseits weitere Prozesse starten. Unter Windows beendet `ChildProcess.kill()` nur den direkten Prozess. OmniRoute verwendet deshalb:

```text
taskkill /PID <pid> /T /F
```

Die Argumente werden als Array und ohne Shell-Interpolation übergeben. `/T` beendet Nachkommen; `/F` erzwingt die Beendigung.

Ohne diesen Prozessbaum-Mechanismus könnten beim Update folgende Probleme entstehen:

- `omniroute.exe` bleibt gesperrt,
- `quitAndInstall()` kann nicht überschreiben,
- der alte Server läuft nach dem Beenden der GUI weiter,
- der Smoke-Test sieht einen weiterhin offenen Port.

### 32.3 Server-Entry-Auswahl

`resolveServerEntry.js` bevorzugt:

```text
server-ws.mjs
```

und fällt nur auf:

```text
server.js
```

zurück.

Der WS-Wrapper installiert den vertrauenswürdigen Peer-IP-Stamp, der für loopback-/LAN-geschützte lokale Routes benötigt wird. Ohne den Wrapper könnten lokale MCP-/Service-/AgentBridge-Routen aus dem Desktopprozess heraus fälschlich als nicht lokal behandelt und mit 403 beantwortet werden.

---

## 33. Readiness, HTTP und Fenstersichtbarkeit

Es existieren zwei leicht unterschiedliche Readiness-Mechanismen:

### 33.1 Electron-Runtime

`serverReadiness.js` baut:

```text
<base-url>/api/health/ping
```

und pollt standardmäßig:

- maximal 180 Sekunden,
- pro Request maximal 2 Sekunden,
- alle 500 ms.

Bei Timeout warnt der Code und zeigt das Fenster trotzdem an. Das ist eine bewusste User-Experience-Entscheidung: Die App soll nicht für immer unsichtbar bleiben, auch wenn der Server langsam oder fehlerhaft ist.

### 33.2 CI-Packaged-Smoke

Der Smoke-Test fragt dagegen:

```text
http://127.0.0.1:20128/login
```

mit einem konfigurierten Timeout von 60 Sekunden ab. Er verlangt dort HTTP 200 und prüft zusätzlich den Logzustand. Ein Runtime-Timeout führt also nicht zwangsläufig zu identischem Verhalten wie der CI-Test.

Diese Differenz ist wichtig für die Interpretation:

- Die Runtime kann nach Timeout ein Fenster zeigen.
- Der CI-Smoke kann bei fehlendem HTTP 200 fehlschlagen.
- Der Windows-Smoke-Fehler blockiert wegen `continue-on-error` dennoch nicht automatisch den Release-Job.

---

## 34. IPC- und Renderer-Sicherheitsmodell

`preload.js` veröffentlicht keine beliebigen Electron-APIs, sondern eine Whitelist:

```text
invoke:
  get-app-info
  open-external
  get-data-dir
  restart-server
  check-for-updates
  download-update
  install-update
  login:*
  remote-server-prompt:*

send:
  window-minimize
  window-maximize
  window-close
  remote-server-prompt:*

receive:
  server-status
  port-changed
  update-status
  login:status
```

Die BrowserWindow-Konfiguration in `main.js` verwendet:

```js
contextIsolation: true
nodeIntegration: false
webSecurity: true
webviewTag: false
```

Externe Links werden im Main-Prozess auf `http:`/`https:` begrenzt. Dadurch ist der Installer nicht nur eine beliebige Chromium-Hülle, sondern enthält ein eingeschränktes IPC-Modell zwischen Next.js-Renderer und Electron-Main-Prozess.

---

## 35. Release-Asset- und Updater-Konsistenz

### 35.1 Warum der Dateiname nicht geändert werden sollte

`latest.yml` enthält einen konkreten Pfad-/URL-Namen und Hash für das Update. Wenn ein späterer manueller Upload die Datei anders benennt als die Manifest-Referenz, kann der Updater zwar den Release finden, aber den Installer nicht laden.

Deshalb ist die Kombination stabil:

```text
productName = OmniRoute
version     = 3.8.50
artifact    = OmniRoute.Setup.3.8.50.exe
```

### 35.2 Release-Globs

Der zentrale Upload akzeptiert:

```text
*.dmg
*.exe
*.AppImage
*.deb
*.blockmap
*.yml
*.source.tar.gz
*.source.zip
```

Das erklärt, warum die portable Datei und der NSIS-Installer beide im Release erscheinen. Die Pipeline unterscheidet nicht im zentralen Upload nach Installer-Typ; diese Unterscheidung geschieht vorher beim Einsammeln und durch den Dateinamen.

### 35.3 Was in v3.8.50 tatsächlich verifiziert wurde

Aus der GitHub-Release-API wurden unter anderem diese Assets bestätigt:

```text
OmniRoute.Setup.3.8.50.exe
OmniRoute.exe
OmniRoute-3.8.50.AppImage
OmniRoute-3.8.50-arm64.AppImage
OmniRoute-3.8.50.dmg
OmniRoute-3.8.50-arm64.dmg
omniroute-desktop_3.8.50_amd64.deb
omniroute-desktop_3.8.50_arm64.deb
latest.yml
latest-linux.yml
latest-linux-arm64.yml
latest-mac.yml
OmniRoute-v3.8.50.source.tar.gz
OmniRoute-v3.8.50.source.zip
```

Ein Abruf des `.blockmap`-Links für den konkreten Installer antwortete mit 404. Das bedeutet: Für diesen untersuchten Release-Stand ist kein separater `OmniRoute.Setup.3.8.50.exe.blockmap`-Download verifiziert. Die Workflow-Konfiguration erlaubt Blockmaps, garantiert ihre Veröffentlichung aber nicht.

### 35.4 `latest.yml`-Download

Der direkte Download von `latest.yml` wurde von der Recherche-Extraktion als `application/octet-stream` zurückgegeben und konnte deshalb nicht als lesbarer YAML-Text über das URL-Tool angezeigt werden. Die Existenz und Asset-Größe des Manifests ist über die Release-API bestätigt; der genaue Inhalt sollte für forensische Zwecke mit einem Binär-/HTTP-Client heruntergeladen und lokal als Text betrachtet werden.

---

## 36. Branch, Tag und Produktionsstand: sorgfältige Interpretation

Die Untersuchung verwendete `release/v3.8.50` als vom Betreiber bestätigte Basis. GitHub zeigt für den Release jedoch:

```text
tag: v3.8.50
head_sha: 5458026c216f77a3da68ea49152dc33470cfe2cb
target_commitish: main
```

Ein Release-Branchname, ein Tag und der `target_commitish`-Wert sind nicht zwangsläufig derselbe Ref. Für eine absolut bitgenaue historische Rekonstruktion muss deshalb immer der Tag-Commit herangezogen werden, nicht automatisch der aktuelle Release-Branch-Tip.

Die Actions-Datei am Tag enthält jedoch denselben wesentlichen Electron-Mechanismus wie die untersuchte Release-Branch-Datei: Version validieren, Shared-Build, Windows-Matrix, `npm run build:win`, Einsammeln und zentraler GitHub-Release.

Die beste forensische Praxis lautet:

```text
1. Produktions-Asset-Name/Hash aus Release-API
2. exact tag commit für source/build configuration
3. workflow run SHA prüfen
4. successful job logs/artifacts über Actions API suchen
5. erst dann eine einzelne Run-ID als Producer behaupten
```

Für `v3.8.50` ist Schritt 4 wegen des öffentlich sichtbaren `startup_failure`-Runs unvollständig. Daher sagt diese Recherche präzise: Die Datei entspricht dem beschriebenen Release-/Builder-Vertrag; der konkrete erfolgreiche Producer-Run ist aus den aktuell öffentlichen API-Daten nicht vollständig belegbar.

---

## 37. Fehleranalyse: Wo kann der Windows-Installer scheitern?

### Stufe A: Trigger und Validate

Mögliche Fehler:

- Tag ist nicht `v<major>.<minor>.<patch>`.
- Manual Input fehlt.
- Workflow-Datei kann wegen Syntax/Permissions nicht starten.

Auswirkung: kein Build.

### Stufe B: Shared `web-build`

Mögliche Fehler:

- npm-Installation scheitert.
- Next-Webpack-Build überschreitet Speicher.
- JWT-Validierung schlägt fehl.
- Tarball/Manifest-Erzeugung scheitert.

Auswirkung bei aktiviertem Shared-Modus: Build-Matrix startet nicht; es gibt keinen Windows-Installer. Es gibt keinen stillen Wechsel auf einen lokalen Vierfach-Build, wenn der Shared-Job tatsächlich fehlgeschlagen ist.

### Stufe C: Windows Restore/Hydration

Mögliche Fehler:

- Archivgröße passt nicht.
- SHA-256 passt nicht.
- Manifest-Eintrag fehlt.
- unlisted file wird gefunden.
- `win32/x64`-Prebuild fehlt.
- Windows-Fork von Sharp/Ngrok fehlt.

Auswirkung: Windows-Matrix-Leg scheitert vor `electron-builder`; kein Windows-Artefakt.

### Stufe D: `prepare:bundle`

Mögliche Fehler:

- `server.js` nicht auffindbar.
- absolute Pfade/Symlink-Materialisierung fehlschlagen.
- `better-sqlite3`-Prebuild fehlt.
- esbuild-Worker kann nicht erzeugt werden.
- optionales Pack kann unvollständig sein.

Auswirkung: normalerweise Fehler im `npm run build:win`-Command; kein Installer.

### Stufe E: electron-builder

Mögliche Fehler:

- fehlende `electron`- oder `electron-builder`-Installation,
- falsche Icon-Datei,
- Windows-NSIS-Toolchainfehler,
- zu lange Pfade/Dateinamen,
- Packaging-Filter schließen benötigte Dateien aus.

Auswirkung: kein `.exe`-Output.

### Stufe F: Smoke

Mögliche Fehler:

- `requestSingleInstanceLock()` beendet die App mit Code 0.
- AppData-Verzeichnis fehlt.
- Windows-Prozessbaum bleibt offen.
- Server bindet nicht an 20128.
- native Dependency meldet `ERR_DLOPEN_FAILED`.
- `MODULE_NOT_FOUND`.

Auswirkung: Wegen `continue-on-error` kann der Build-Leg trotzdem Artefakte hochladen. Das ist die wichtigste bewusst advisory geschaltete Lücke.

### Stufe G: Collect/Release

Mögliche Fehler:

- Installer-Glob findet keine Datei.
- portable Datei wird versehentlich als Setup erkannt oder umgekehrt.
- Actions-Artefakt-Upload scheitert.
- Release-Upload scheitert.
- Release-Asset-Verifikation findet keine `.exe`.

Auswirkung: kein oder unvollständiger Desktop-Release; der separate Verify-Job soll dies sichtbar machen.

---

## 38. Sicherheitsbewertung des konkreten Installers

### 38.1 Integrität

Der GitHub-Asset-Digest ist:

```text
SHA-256:
70d7c3a4a2fccac3fae41ce2523ed786fd0dbf6bc5c4399e9872399eea1f72d1
```

Ein Benutzer kann den Download nach dem Transfer lokal verifizieren. Der Digest beweist die Integrität relativ zum GitHub-Asset, aber nicht automatisch die Vertrauenswürdigkeit jedes enthaltenen Drittanbieter-Binaries.

### 38.2 Herkunft

Die Release-API nennt `github-actions[bot]` als Uploader. Das zeigt, dass das Asset über GitHub Actions hochgeladen wurde. Es ist kein Nachweis, dass Windows Authenticode-Signing durchgeführt wurde.

### 38.3 Code Signing

In der sichtbaren `electron/package.json` fehlen:

```json
"certificateFile"
"certificatePassword"
"win.signingHashAlgorithms"
```

Außerdem ist im Workflow keine separate Signierungsaktion erkennbar. Daraus folgt: Eine private Zertifikats-/Signing-Konfiguration ist im Repository und im Workflow nicht dokumentiert. Sie könnte theoretisch über externe Builder-/Umgebungsmechanismen existieren, ist aus den untersuchten Quellen aber nicht belegbar.

### 38.4 Shell-/Command-Sicherheit

Für Windows-Build-Tools adressiert `buildToolRunner.mjs` explizit den Unterschied zwischen:

```text
node_modules/.bin/esbuild       # POSIX-Shellscript
node_modules/.bin/esbuild.cmd   # Windows-CMD-Shim
```

Die bevorzugte Strategie liest den `bin`-Eintrag aus dem Package und startet die echte JS-Datei oder native Executable direkt, ohne Shell. Das verhindert unter anderem den Build-Abbruch `ENOENT` auf Windows und reduziert Argument-/Shell-Escaping-Risiken.

Der Prozessbaum-Killer verwendet ebenfalls Argument-Arrays für `taskkill`, nicht eine interpolierte Shell-Zeichenkette.

---

## 39. Performance-Design und Kosten des Shared-Builds

Der Shared-Job ist nicht nur eine Optimierung der Laufzeit, sondern auch eine Konsistenzmaßnahme:

### Vorher

```text
Ubuntu Next build → Windows Next build → Windows package
Ubuntu Next build → macOS Intel Next build → macOS package
Ubuntu Next build → macOS ARM Next build → macOS package
Ubuntu Next build → Linux Next build → Linux package
```

Derselbe plattformunabhängige Tree wurde viermal erzeugt.

### Aktuell

```text
Ubuntu Next build einmal
  ├─ Windows: restore + Windows native hydration + package
  ├─ macOS Intel: restore + Intel hydration + package
  ├─ macOS ARM: restore + ARM hydration + package
  └─ Linux: restore + x64/arm64 native verification + package
```

Vorteile:

- weniger CPU-/Runner-Minuten,
- identischer JavaScript-/Next-Tree über Plattformen,
- Fehler im Transfer sind durch Manifest sichtbar,
- native Unterschiede bleiben ausdrücklich im jeweiligen Leg.

Risiko:

- Der Shared-Job ist ein zentraler Single Point of Failure für alle Desktop-Legs.
- Deshalb existiert der Repository-Variable-Rollback auf Legacy-Per-Leg-Build.
- Ein erfolgreicher Restore garantiert nicht, dass die plattformabhängige Hydration vollständig korrekt ist; dafür gibt es die Native-Verifikation und den Packaged-Smoke.

---

## 40. Reproduktions- und Forensik-Checkliste

### 40.1 Source-Identität

```bash
git rev-parse v3.8.50
git show v3.8.50:.github/workflows/electron-release.yml
git show v3.8.50:electron/package.json
```

### 40.2 Version

```bash
node -e 'console.log(require("./electron/package.json").version)'
```

Im Actions-Leg wird diese Datei erst zur Laufzeit auf die validierte Tag-Version synchronisiert.

### 40.3 Build-Konfiguration

```bash
npm ci
npm run build
cd electron
npm ci --no-audit --no-fund
npm run build:win
```

### 40.4 Output-Inspektion

```text
electron/dist-electron/
```

Prüfen:

- existiert `OmniRoute.Setup.3.8.50.exe`?
- existiert eine portable `.exe`?
- existiert `win-unpacked/OmniRoute.exe`?
- existiert `latest.yml`?
- referenziert `latest.yml` exakt den Setup-Dateinamen?

### 40.5 Hashprüfung

Für den heruntergeladenen Release-Installer sollte der lokale Hash exakt sein:

```text
70d7c3a4a2fccac3fae41ce2523ed786fd0dbf6bc5c4399e9872399eea1f72d1
```

### 40.6 Runtime-Test

```text
Port 20128 frei
→ Installer/portable App starten
→ /api/health/ping bzw. /login prüfen
→ Login-Seite laden
→ App beenden
→ Prozessbaum und Port prüfen
→ erneut starten
→ SQLite-Treiberlog prüfen
```

Der Linux-Smoke führt zusätzlich einen Cold-Restart durch und prüft einen nativen SQLite-Treiber beim zweiten Start. Der Windows-Smoke führt diesen Cold-Restart-Gate aktuell nicht blockierend aus.

---

## 41. Verbesserungsmöglichkeiten, die aus der Analyse folgen

Diese Punkte sind keine Behauptungen über bereits implementierte Änderungen, sondern technische Schlussfolgerungen aus dem untersuchten Code:

1. **Windows-Smoke blockierend machen**, sobald `requestSingleInstanceLock()`-/`USERPROFILE`-Flakiness stabil gelöst ist.
2. **Installer signieren**, falls der Release für normale Windows-Endbenutzer bestimmt ist.
3. **SHA-256-Prüfsumme prominent in Release Notes veröffentlichen**, nicht nur über API verfügbar machen.
4. **Producer-Run-ID und Build-SHA als Release-Metadaten anhängen**, damit das konkrete Asset forensisch eindeutig einem erfolgreichen Run zugeordnet werden kann.
5. **`latest.yml` in CI direkt parsen**, um zu verifizieren, dass der dort referenzierte Installer exakt als Release-Asset vorhanden ist.
6. **`latest.yml`-Download und Manifest-Hash automatisiert testen**, nicht nur auf Dateinamenmuster `latest.*.yml` prüfen.
7. **Ein veröffentlichter SBOM-/Provenance-Asset für den Electron-Installer** würde die Herkunft der eingebetteten nativen Dependencies transparenter machen.
8. **Blockmap-Erzeugung explizit verifizieren**, falls inkrementelle Updates für Windows benötigt werden.
9. **Optional-Pack-Dateien im Release-Job explizit berücksichtigen**, falls sie nicht nur lokal oder in einem anderen Workflow verteilt werden sollen.
10. **Asset-Verifikation nach Plattform und Architektur verschärfen**: eine beliebige `.exe` beweist derzeit nicht ausdrücklich, dass sowohl Setup- als auch portable Windows-Datei vorhanden sind.

---

## 42. Erweiterte Schlussfolgerung

Der Installer `OmniRoute.Setup.3.8.50.exe` ist das Endprodukt einer mehrstufigen Supply-/Build-Kette:

```text
validierter Git-Tag
  → kontrollierter Root-Next-Build
  → deterministischer, gehashter Shared-Tree
  → Windows-spezifische Native-Hydration
  → Electron-Staging mit Pfad-, Symlink-, Worker- und Sidecar-Reparaturen
  → N-API-/native-Prebuild-Verifikation
  → optionale Pack-Auslagerung
  → Electron Builder
  → NSIS x64
  → best-effort Runtime-Smoke
  → Actions-Artefakt
  → zentraler GitHub-Release-Upload
  → Release-Asset-Prüfung
```

Der wesentliche technische Kern ist nicht die eine Zeile `electron-builder --win`, sondern die Vorbereitung davor. `electron-builder` verpackt nur das, was ihm in `electron/package.json` als Electron-Dateien und `extraResources` übergeben wird. Die tatsächliche Funktionsfähigkeit des ausgelieferten Windows-Programms hängt daher entscheidend von `prepare-electron-standalone.mjs`, `assembleStandalone.mjs`, `hydrateNativeDeps.mjs`, den Manifestprüfungen und dem Prozess-/Readiness-Code ab.

Der konkrete Release-Download ist nach den öffentlich verfügbaren GitHub-Daten ein 526.572.556-Byte großes x64-Windows-NSIS-Executable mit dem SHA-256-Digest:

```text
70d7c3a4a2fccac3fae41ce2523ed786fd0dbf6bc5c4399e9872399eea1f72d1
```

Die Architektur ist damit vollständig als **Electron-Shell plus eingebetteter OmniRoute-Next.js-Server plus NSIS-Installationsschicht** zu verstehen — nicht als einfacher Wrapper um eine separat installierte Node-Anwendung.

---

## Schlussfolgerung

Der Windows-Installer ist ein **x64-NSIS-Electron-Installer**, der auf `windows-latest` über `electron-builder --win` gebaut wird. Der installierte Client enthält nicht nur die Desktop-Hülle, sondern ein eingebettetes OmniRoute-Next.js-Standalone-System. Die aktuelle Pipeline trennt den plattformunabhängigen Web-Build vom plattformspezifischen Packaging, verifiziert den Bundle-Transfer kryptografisch, ersetzt native Dependencies für Windows, erzeugt parallel NSIS und portable EXE, führt einen best-effort Starttest aus und veröffentlicht die Dateien erst im separaten Release-Job als GitHub-Release-Assets.
