# DeepResearch: 9Router-Windows-Installer mit vollständig GitHub-Actions-basierten Builds

**Recherche-Stand:** 16. September 2026  
**Untersuchtes Repository:** [`jahdaganj00ki-eng/9router`](https://github.com/jahdaganj00ki-eng/9router)  
**Default-Branch:** `master`  
**Repository-Typ:** öffentliches Fork von [`decolua/9router`](https://github.com/decolua/9router)  
**Untersuchte Fork-Version:** Root `0.5.75`, CLI `0.5.75`  
**Ziel:** Ein echter Windows-Installer, der vollständig über GitHub Actions gebaut, getestet, versioniert und als GitHub-Release-Asset veröffentlicht wird.

> Diese Datei ist eine 9Router-spezifische Ableitung aus der OmniRoute-Installer-Recherche. Sie übernimmt nicht blind deren Electron-Komplexität, sondern unterscheidet zwischen dem bereits vorhandenen 9Router-CLI-Launcher, dem Next.js-Standalone-Server und einem neu hinzuzufügenden Windows-Desktop-Installer.
>
> **Konsistenzhinweis:** Die Abschnitte **27–46** sind der nachträgliche Gap-/Risk-Audit und die verfeinerte verbindliche Planung; sie haben Vorrang vor früheren Entwurfsbeispielen. Frühere Snippets mit `/api/health/ping`, `continue-on-error` für den Windows-Smoke, `latest.yml` in Release 1, implizitem Cross-Job-Build-Transfer oder einem „ersten passenden“ Portable-`.exe` sind historische Entwurfsstände und durch die verbindlichen Korrekturen ab Abschnitt 27 ersetzt.

---

## 1. Executive Summary

### 1.1 Wichtigstes Ergebnis

Im untersuchten Fork existiert **noch kein Windows-Installer** und auch kein Electron-Desktop-Projekt. Das Repository enthält aktuell:

- eine Next.js-16-Web-/Gateway-Anwendung im Root,
- eine separate npm-CLI unter `cli/`,
- einen bereits funktionierenden Next.js-Standalone-/CLI-Package-Build,
- Docker-/GHCR-/Docker-Hub-Publishing,
- aber keine Installer-Pipeline für `.exe`, keine `electron/`-Directory und keine Release-Assets im Fork.

Die GitHub-API bestätigt:

```text
Repository: jahdaganj00ki-eng/9router
Fork: ja
Parent: decolua/9router
Default branch: master
Root package: 9router-app@0.5.75
CLI package: 9router@0.5.75
Releases im Fork: []
Workflows im Fork: docker-publish.yml, gitbook-pages.yml
```

### 1.2 Empfohlene Zielarchitektur

Die beste Architektur für einen Windows-Installer ist eine **Electron-Shell mit dem bereits vorhandenen CLI-/Standalone-Server als eingebettetem Backend**:

```text
Git tag v0.5.76
  ↓
GitHub Actions: release-desktop.yml
  ↓
validate-version
  ↓
quality + Linux server build
  ↓
Windows runner: npm ci + CLI/standalone build
  ↓
Electron wrapper + embedded 9Router server
  ↓
electron-builder --win
  ↓
NSIS installer + portable EXE
  ↓
Windows packaged smoke test
  ↓
GitHub Actions artifacts
  ↓
release job
  ↓
GitHub Release v0.5.76
```

### 1.3 Warum nicht einfach `npm install -g 9router` in eine EXE umwandeln?

Das vorhandene CLI ist bereits ein Launcher, aber kein Installer:

```json
"bin": {
  "9router": "./cli.js"
}
```

Es startet den Server, öffnet den Browser, bietet ein Terminal-Menü, kann Tray-Modus starten und verwaltet Runtime-Abhängigkeiten. Ein Windows-Installer sollte diese Logik **wiederverwenden**, aber nicht einfach den npm-Cache oder eine globale npm-Installation des Benutzers voraussetzen.

Eine portable/native Desktop-Anwendung braucht:

- eine mitgelieferte Node-/Electron-Runtime,
- einen selbständigen Server-Bundle-Pfad,
- sichere Datenverzeichnisse,
- Prozessbaum-Kontrolle,
- Windows-Startmenü-/Desktop-Shortcuts,
- Update-Manifest oder eine bewusst deaktivierte Auto-Update-Funktion,
- reproduzierbare CI-Builds.

### 1.4 Empfohlene Produktvarianten

| Variante | Empfehlung | Zweck |
|---|---:|---|
| npm CLI | Beibehalten | Entwickler, Server, globale Installation |
| Portable Windows EXE | Bauen | Kein Installationsdialog, USB-/Testbetrieb |
| NSIS Windows Installer | Bauen | Normaler Endbenutzer-Installationsweg |
| Docker | Beibehalten | Server-/VPS-/Cloud-Betrieb |
| macOS/Linux Desktop | Später optional | Erst nach stabiler Windows-Pipeline |

---

## 2. Verifizierte Ausgangslage des 9Router-Forks

### 2.1 Repository-Metadaten

Die GitHub-API meldet:

| Eigenschaft | Beobachteter Wert |
|---|---|
| Full name | `jahdaganj00ki-eng/9router` |
| Sichtbarkeit | public |
| Fork | `true` |
| Parent | `decolua/9router` |
| Sprache | JavaScript |
| Default Branch | `master` |
| Root-Version | `0.5.75` |
| npm-CLI-Version | `0.5.75` |
| Lizenz | MIT |
| Releases im Fork | keine |
| GitHub Actions | Docker Publish, GitBook Pages |
| Homepage | `https://9router.com` |
| Standard-Port in README-Beispielen | `20128` |

Das ist wichtig: Der Fork ist aktuell ein junger Mirror/Fork ohne bestehende Release-Historie. Die erste Installer-Pipeline sollte deshalb nicht versuchen, alte Release-Konventionen zu erraten. Es muss eine neue, explizite Versionierungs- und Artefaktkonvention eingeführt werden.

### 2.2 Repository-Struktur

Verifiziert wurden unter anderem:

```text
.github/workflows/docker-publish.yml
.github/workflows/gitbook-pages.yml
cli/
custom-server.js
Dockerfile
next.config.mjs
open-sse/
package.json
scripts/copy-standalone-assets.mjs
src/
tests/
public/
```

Nicht gefunden wurden:

```text
electron/
electron/package.json
electron-builder.yml
.github/workflows/electron-release.yml
.github/workflows/release.yml
Windows-Installer-Konfiguration
NSIS-Script
GitHub-Release-Assets im Fork
```

### 2.3 Zwei getrennte npm-Artefakte

`CLAUDE.md` beschreibt ausdrücklich zwei veröffentlichte Einheiten:

1. **Root `9router-app`**
   - Next.js-Dashboard und Gateway.
2. **CLI `9router` unter `cli/`**
   - separater Launcher mit eigener `package.json`, eigener Version und eigenem Build.

Diese Trennung darf beim Installer nicht versehentlich zerstört werden. Für den Desktop-Installer ist der Root-Server die eigentliche Anwendung; die CLI liefert bereits wertvolle Launcher- und Windows-Verhaltenslogik.

---

## 3. Root-Package: Was bereits für Packaging vorhanden ist

### 3.1 Root-`package.json`

Verifiziert:

```json
{
  "name": "9router-app",
  "version": "0.5.75",
  "private": true,
  "scripts": {
    "dev": "next dev --port 20127",
    "build": "next build --webpack",
    "postbuild": "node scripts/copy-standalone-assets.mjs",
    "start": "node custom-server.js --port 20127",
    "build:bun": "bun --bun next build --webpack",
    "start:bun": "bun ./.next/standalone/custom-server.js",
    "cli:pack": "npm --prefix cli run pack:cli",
    "cli:publish": "npm --prefix cli run publish:cli"
  }
}
```

### 3.2 Tatsächliche Root-Build-Kette

Ein Produktionsbuild lautet:

```bash
npm run build
```

Das führt aus:

```text
next build --webpack
  ↓
postbuild
  ↓
node scripts/copy-standalone-assets.mjs
```

Das ist deutlich einfacher als die OmniRoute-Pipeline, aber für einen Installer fehlt noch eine zentrale Electron-/Packaging-Schicht.

### 3.3 Root-Dependencies

Für den Installer relevant sind unter anderem:

- `next` `^16.1.6`
- `react` `19.2.4`
- `react-dom` `19.2.4`
- `express` `^5.2.1`
- `selfsigned` `^5.5.0`
- `sql.js` `^1.14.1`
- `undici` `^7.19.2`
- `node-machine-id` `^1.1.12`
- `open` ist im Root-`package.json` des untersuchten Forks nicht als direkte Dependency sichtbar, obwohl `next.config.mjs` es als externes Package behandelt; das muss vor einem reproduzierbaren Release-Build gegen den tatsächlichen Installationsbaum geprüft werden.

Optional:

```json
"optionalDependencies": {
  "better-sqlite3": "^13.0.0"
}
```

Die README-/CLAUDE-Dokumentation beschreibt eine Fallback-Kette:

```text
bun:sqlite
  → better-sqlite3
  → node:sqlite
  → sql.js
```

Für Windows ist diese Fallback-Kette zentral: Der Installer darf nicht voraussetzen, dass ein Benutzer Visual Studio Build Tools installiert hat.

### 3.4 Fehlende Root-Lockdatei als Release-Risiko

In der vom GitHub-Contents-API gelieferten Root-Dateiliste war keine `package-lock.json` sichtbar. `npm install`/`npm ci`-Reproduzierbarkeit muss daher vor Einführung der Release-Pipeline geklärt werden.

Empfehlung:

```text
package-lock.json im Root committen
cli/package-lock.json separat committen
```

Ohne Lockfiles kann `npm ci` nicht zuverlässig als reproduzierbarer Produktionsinstallationsschritt verwendet werden. Ein Workflow sollte dann entweder:

- zuerst Lockfiles verbindlich einführen, oder
- bewusst `npm install` mit begrenzten Versionsbereichen verwenden und die daraus resultierende Nichtdeterministik dokumentieren.

Für einen öffentlichen Windows-Installer ist die erste Variante klar vorzuziehen.

---

## 4. `next.config.mjs`: Die kritischen Standalone-Einstellungen

Die aktuelle Next-Konfiguration ist für die spätere Installer-Architektur sehr wertvoll.

### 4.1 Standalone-Ausgabe

```js
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  output: "standalone",
};
```

Das produziert einen deploybaren Serverbaum unter:

```text
.next/standalone/
```

Ein Installer sollte diesen Tree nicht selbst nachbauen, sondern als Input der Packaging-Stufe verwenden.

### 4.2 Tracing Root

```js
const tracingRoot = process.env.NEXT_TRACING_ROOT_MODE === "workspace"
  ? join(projectRoot, "..")
  : projectRoot;
```

Für den normalen Root-Desktop-Build sollte `NEXT_TRACING_ROOT_MODE` **nicht** unnötig auf `workspace` gesetzt werden. Diese Option ist im vorhandenen CLI-Build speziell für die CLI-Workspace-Struktur vorgesehen. Ein Desktop-Workflow sollte zunächst die Root-Konfiguration verwenden:

```text
NEXT_TRACING_ROOT_MODE nicht gesetzt
NEXT_DIST_DIR=.next oder explizit .next-desktop
```

Wenn später CLI- und App-Tree in ein gemeinsames Bundle integriert werden, muss die Tracing-Root-Entscheidung separat getestet werden.

### 4.3 Externe Packages

```js
serverExternalPackages: [
  "better-sqlite3",
  "sql.js",
  "node:sqlite",
  "bun:sqlite",
  "open"
]
```

Das bedeutet: Diese Packages dürfen nicht einfach als normaler Browser-/Server-Bundle-Inhalt behandelt werden. Sie müssen im gepackten Server-`node_modules` tatsächlich vorhanden oder durch einen funktionierenden Runtime-Mechanismus auflösbar sein.

Besonders wichtig ist der Kommentar zu `open`: Ein Bundling auf einer Plattform kann `import.meta.url` auf einen absoluten Build-Maschinenpfad festschreiben. Für Windows muss daher sichergestellt werden, dass `open` zur Laufzeit als echtes externes Package geladen wird.

### 4.4 Rewrites

Die Next-Konfiguration mappt unter anderem:

```text
/v1/:path*       → /api/v1/:path*
/v1beta/:path*   → /api/v1beta/:path*
/codex/:path*    → /api/v1/responses
/responses       → /api/v1/responses
```

Ein Packaged-Smoke-Test muss nicht nur `/dashboard` laden, sondern mindestens einen lokalen Health-Endpunkt und die OpenAI-kompatible API-Routing-Schicht prüfen.

---

## 5. `scripts/copy-standalone-assets.mjs`: Aktueller Standalone-Postbuild

Das vorhandene Postbuild-Script kopiert:

```text
.next/static → .next/standalone/.next/static
public       → .next/standalone/public
custom-server.js → .next/standalone/custom-server.js
```

Bei `NEXT_TRACING_ROOT_MODE=workspace` beendet es sich frühzeitig:

```text
[standalone-assets] Skipping workspace-traced CLI build; CLI packaging handles assets
```

### 5.1 Warum das für einen Installer nicht ausreicht

Das Script berücksichtigt nicht explizit alle bekannten Standalone-Lücken:

- `src/mitm` als separater Kindprozess,
- `node-forge` für MITM-/Zertifikatswege,
- `next`-Runtime als Fallback,
- `sql.js/dist/sql-wasm.wasm`,
- `node-machine-id` via dynamischem `require`,
- optionale Native-Module je nach Windows-Build,
- absolute Buildpfade,
- mögliche Symlinks aus Workspace-/pnpm-Installationen,
- ESM-/CJS-Kontext des Standalone-Servers.

Der Dockerfile zeigt bereits, welche Ergänzungen die Autoren für den Docker-Runtime-Tree als notwendig betrachten. Der Windows-Installer sollte dieselbe Dependency-Analyse übernehmen, statt nur `.next/standalone` blind in `extraResources` zu kopieren.

---

## 6. `custom-server.js`: Der Server ist mehr als `next start`

Der aktuelle Custom Server erfüllt mehrere Runtime-Aufgaben.

### 6.1 Peer-IP-Stamping

Beim Start wird ein Prozess-Secret erzeugt:

```js
const PEER_TOKEN = crypto.randomBytes(24).toString("hex");
process.env.NINEROUTER_PEER_TOKEN = PEER_TOKEN;
```

Die HTTP-Schicht:

1. liest die TCP-Socket-Adresse,
2. entscheidet, ob ein Reverse Proxy loopback ist,
3. entfernt vom Client gelieferte Forwarding-Header,
4. setzt eigene interne Header,
5. reicht den Request an Next weiter.

Das ist für Local-only-/Management-Policies relevant. Ein Desktop-Wrapper darf nicht auf `next start` wechseln und damit diese Sicherheitssemantik verlieren.

### 6.2 Background Token Refresh

Nach `listening` wird versucht, `src/sse/services/backgroundTokenRefresh.js` dynamisch zu importieren. Der Packaged Tree muss daher entweder `src/sse/services/backgroundTokenRefresh.js` enthalten oder sicherstellen, dass die App-Bootstrap-Logik diesen Scheduler selbst startet.

### 6.3 h2c-Downgrade

Der Custom Server behandelt h2c-Upgrades und replayt sie als HTTP/1.1. Diese Logik ist Teil des Gateway-Verhaltens und darf im Installer nicht durch eine vereinfachte Startdatei verloren gehen.

### 6.4 Startmodus

Wenn `custom-server.js` neben `server.js` existiert, startet es den Standalone-Server. Im Repo-Checkout fällt es auf `next` zurück. Für den Installer muss der erste Pfad verifiziert werden:

```text
resources/app/custom-server.js
resources/app/server.js
```

---

## 7. Das vorhandene CLI ist der wichtigste Baustein für Windows

### 7.1 CLI-Package

`cli/package.json` beschreibt ein separates npm-Paket:

```json
{
  "name": "9router",
  "version": "0.5.75",
  "bin": {
    "9router": "./cli.js"
  },
  "scripts": {
    "build": "node scripts/build-cli.js",
    "pack:cli": "npm run build && npm pack --pack-destination ..",
    "publish:cli": "npm run build && npm publish",
    "postinstall": "node hooks/postinstall.js"
  }
}
```

Der CLI-Build ist bereits ein eigener Standalone-Package-Assembler. Er kann daher als Referenz für die Desktop-`prepare`-Stufe genutzt werden.

### 7.2 Was der CLI-Build bereits tut

`cli/scripts/build-cli.js`:

1. liest CLI- und Root-Package-Version,
2. synchronisiert die CLI-Version ins Root-Package,
3. setzt ein isoliertes Windows-ähnliches Build-HOME,
4. startet den Root-`npm run build` mit:
   - `NEXT_DIST_DIR=.next-cli-build`
   - `NEXT_TRACING_ROOT_MODE=workspace`
   - isoliertem `HOME`
   - isoliertem `USERPROFILE`
   - isoliertem `APPDATA`
   - isoliertem `LOCALAPPDATA`
5. findet Next.js-Standalone-Ausgaben auch bei verschachteltem Next-16-Layout,
6. kopiert den Standalone-Server nach `cli/app/`,
7. kopiert statische Dateien und `public`,
8. kopiert komplette Server-Artefakte nach `.next-cli-build/server`,
9. prüft erforderliche API-Routen,
10. kopiert `custom-server.js`,
11. kopiert `sql.js` und `open`,
12. entfernt `better-sqlite3` aus dem CLI-Bundle,
13. kopiert `src/mitm`,
14. kopiert Updater-Dateien,
15. baut den MITM-Server,
16. schreibt die fertige CLI-Package-Struktur.

Diese Liste ist fast schon ein vorhandenes Manifest für den Installer-Server.

### 7.3 Root- und CLI-Versionen

Der Installer sollte die Version aus einer einzigen Quelle beziehen. Der aktuelle Code versioniert Root und CLI getrennt und synchronisiert im CLI-Build von `cli/package.json` nach Root.

Für den Desktop-Release gibt es zwei praktikable Modelle:

#### Modell A: CLI-Version als Release-Version

```text
cli/package.json version = 0.5.76
root package.json version wird auf 0.5.76 synchronisiert
Tag v0.5.76
Installer 9Router.Setup.0.5.76.exe
```

Vorteil: passt zum bereits vorhandenen CLI-Publishing.  
Nachteil: Der Build mutiert im CI den Root-Package-Stand, wenn nicht vorher synchronisiert committed wird.

#### Modell B: Root-Version als Release-Version

```text
root package.json version = 0.5.76
cli/package.json version = 0.5.76
Tag v0.5.76
```

Vorteil: klarer Release-Vertrag.  
Empfehlung: Versionsgleichheit in `validate` hart prüfen und nicht still im Build ändern.

---

## 8. Windows-spezifische CLI-Logik, die wiederverwendet werden kann

### 8.1 Windows-Datenverzeichnis

Die CLI verwendet:

```js
process.platform === "win32"
  ? path.join(process.env.APPDATA || "", "9router")
  : path.join(os.homedir(), ".9router")
```

Für den Electron-Installer sollte der gleiche Datenpfad verwendet werden:

```text
%APPDATA%\9router
```

Nicht verwenden:

```text
C:\Program Files\9Router\data
```

Daten, SQLite, OAuth-Credentials und Logs gehören nicht in den schreibgeschützten Programmordner.

### 8.2 Serverstart

Die CLI verwendet:

```js
spawn(process.execPath, [
  "--dns-result-order=ipv4first",
  "--max-old-space-size=6144",
  serverPath
], {
  cwd: standaloneDir,
  detached: true,
  windowsHide: true,
  env: {
    ...buildEnvWithRuntime(process.env),
    PORT: port.toString(),
    HOSTNAME: host
  }
});
```

Eine Electron-Hülle sollte nicht den gesamten CLI-TUI-Flow kopieren. Sie sollte aber folgende Elemente übernehmen:

- `process.execPath` statt System-Node,
- `cwd` auf den eingebetteten Server,
- `PORT`, `HOSTNAME`, `DATA_DIR` kontrolliert setzen,
- `windowsHide: true`,
- `--dns-result-order=ipv4first`,
- Prozessbaum kontrolliert beenden.

### 8.3 Windows-Prozessbeendigung

Der vorhandene CLI-Code verwendet mehrfach `taskkill /T /PID`. Bei einer Übernahme sollte das nicht durch beliebige String-Interpolation erweitert werden. Für einen neuen Electron-Wrapper ist besser:

```js
spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
  windowsHide: true,
  shell: false,
});
```

### 8.4 Tray

Die vorhandene CLI-Tray-Implementierung ist kein Grund, den gesamten CLI-Prozess in eine Electron-App einzubetten. Zwei Tray-Systeme würden sich sonst überschneiden:

```text
Electron Tray + CLI systray2/NotifyIcon = doppelte Tray-Verantwortung
```

Empfehlung:

- Electron besitzt den Desktop-Tray.
- Die Desktop-Version startet den Server direkt.
- CLI-Tray bleibt ausschließlich im npm-CLI-Paket.
- Gemeinsame Daten- und Serverstart-Helfer können später extrahiert werden.

---

## 9. Warum ein Electron-Wrapper für 9Router sinnvoll ist

### 9.1 Vorteile gegenüber einer reinen NSIS-Verpackung von Node

Ein reiner Node-/NSIS-Installer müsste separat lösen:

- Node-Runtime-Auslieferung,
- Browser-/Dashboard-Eröffnung,
- Single Instance,
- Tray,
- Startmenü und Deinstallation,
- Serverprozess-Management,
- Update-Lifecycle,
- Prozessbaum und Zombie-Prozesse.

Electron bringt eine eingebettete Runtime und eine etablierte Packaging-Schicht. Der vorhandene Next.js-Server bleibt als `extraResources` erhalten.

### 9.2 Nachteile

- Große Installergröße wegen Chromium.
- Zusätzliche Sicherheitsfläche.
- Code Signing wird nötig.
- Zwei Runtime-Schichten: Electron und eingebettetes Node/Next.
- Native Dependencies müssen für Electron/Windows getestet werden.

### 9.3 Alternative: CLI + NSIS ohne Electron

Eine kleinere Variante ist möglich:

```text
NSIS → installiert Node.js portable + 9Router CLI + Server-Bundle
```

Das ist kleiner, aber komplizierter in der UX:

- Browser statt eingebetteter UI,
- eigenes Tray-Programm erforderlich,
- Node-Prozess- und Update-Management muss selbst gebaut werden,
- Nutzer sieht möglicherweise mehrere Prozesse/Fenster.

Für das Ziel „Installer wie OmniRoute Desktop“ ist Electron die passendere Variante. Für ein leichtgewichtiges Power-User-Produkt bleibt `npm install -g 9router` die bessere Option.

---

## 10. Empfohlene Zielstruktur im 9Router-Repository

Die minimale neue Struktur sollte sein:

```text
9router/
├── .github/
│   └── workflows/
│       ├── docker-publish.yml
│       ├── gitbook-pages.yml
│       └── desktop-release.yml              # neu
├── cli/
├── electron/                                # neu
│   ├── assets/
│   │   ├── icon.ico
│   │   ├── icon.png
│   │   └── tray-icon.png
│   ├── lib/
│   │   ├── processTree.js
│   │   ├── serverReadiness.js
│   │   └── resolveServerEntry.js
│   ├── main.js
│   ├── package.json
│   ├── package-lock.json
│   └── preload.js
├── scripts/
│   ├── copy-standalone-assets.mjs
│   ├── prepare-electron-standalone.mjs     # neu
│   └── smoke-electron-packaged.mjs         # neu
├── custom-server.js
├── next.config.mjs
├── package.json
└── package-lock.json                        # dringend empfohlen
```

### 10.1 Keine Änderung am API-Routing notwendig

Der Desktop-Installer sollte zunächst nur die Verpackung ändern. Die Next-Rewrites und `src/app/api/v1` bleiben unverändert.

### 10.2 `electron/package.json`-Entwurf

```json
{
  "name": "9router-desktop",
  "version": "0.5.76",
  "private": true,
  "main": "main.js",
  "scripts": {
    "build:win": "npm run prepare:bundle && electron-builder --win",
    "build:mac": "npm run prepare:bundle && electron-builder --mac",
    "build:linux": "npm run prepare:bundle && electron-builder --linux",
    "pack": "npm run prepare:bundle && electron-builder --dir",
    "prepare:bundle": "node ../scripts/prepare-electron-standalone.mjs"
  },
  "dependencies": {
    "electron-updater": "^6.8.9"
  },
  "devDependencies": {
    "electron": "^43.4.0",
    "electron-builder": "^26.15.3"
  },
  "build": {
    "appId": "com.9router.desktop",
    "productName": "9Router",
    "directories": {
      "output": "dist-electron",
      "buildResources": "assets"
    },
    "files": [
      "main.js",
      "preload.js",
      "lib/**/*",
      "package.json",
      "node_modules/**/*"
    ],
    "extraResources": [
      {
        "from": "../.build/electron-standalone",
        "to": "app",
        "filter": ["**/*"]
      },
      {
        "from": "assets",
        "to": "assets",
        "filter": ["icon.png", "tray-icon.png"]
      }
    ],
    "win": {
      "target": [
        { "target": "nsis", "arch": ["x64"] },
        { "target": "portable", "arch": ["x64"] }
      ],
      "icon": "assets/icon.ico"
    },
    "nsis": {
      "artifactName": "${productName}.Setup.${version}.${ext}",
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "installerIcon": "assets/icon.ico",
      "uninstallerIcon": "assets/icon.ico"
    },
    "publish": {
      "provider": "github",
      "owner": "jahdaganj00ki-eng",
      "repo": "9router"
    }
  }
}
```

Damit würde der geplante Installer heißen:

```text
9Router.Setup.0.5.76.exe
```

Der Name sollte nicht `9router-app.Setup...` lauten, da `productName` die sichtbare Produktidentität ist.

---

## 11. Vorbereitung des Standalone-Bundles für Electron

### 11.1 Empfohlene Reihenfolge

```text
Root npm ci
  ↓
npm run build
  ↓
postbuild: static + public + custom-server
  ↓
prepare-electron-standalone.mjs
  ↓
extra runtime modules / MITM / sql.js / next / node-machine-id
  ↓
absolute path and symlink validation
  ↓
Electron builder
```

### 11.2 Was das neue Prepare-Script prüfen sollte

Vor `electron-builder` hart abbrechen, wenn fehlt:

```text
.build/electron-standalone/custom-server.js
.build/electron-standalone/server.js
.build/electron-standalone/.next/static
.build/electron-standalone/public
.build/electron-standalone/node_modules/sql.js/dist/sql-wasm.wasm
.build/electron-standalone/node_modules/next
```

Wenn MITM-Funktionen Teil der Desktop-App bleiben:

```text
.build/electron-standalone/src/mitm/
.build/electron-standalone/node_modules/node-forge/
.build/electron-standalone/node_modules/selfsigned/
```

### 11.3 `sql.js` muss physisch vorhanden sein

Der Dockerfile-Kommentar sagt explizit, dass `sql.js` seine WASM-Datei per Pfad lädt und der Next-Tracer sie sonst nicht sicher erfasst:

```text
node_modules/sql.js/dist/sql-wasm.wasm
```

Das gilt für Windows genauso. Ein Installer, der `sql.js`-JavaScript kopiert, aber `sql-wasm.wasm` vergisst, fällt beim SQLite-Fallback erst zur Laufzeit aus.

### 11.4 `better-sqlite3`: Zwei vertretbare Strategien

#### Strategie 1: `better-sqlite3` nicht bundeln

```text
Installer enthält sql.js
Runtime verwendet node:sqlite oder sql.js
```

Vorteile:

- kein Electron-Native-ABI-Problem,
- kein node-gyp auf dem Benutzerrechner,
- einfacher Windows-Build.

Nachteil:

- sql.js ist WASM/pure JS und kann bei großen DBs langsamer oder speicherintensiver sein.

#### Strategie 2: `better-sqlite3` bundeln

```text
Windows runner npm ci
→ prebuild win32-x64 prüfen
→ in standalone kopieren
→ Packaged Smoke gegen native DB prüfen
```

Vorteile:

- native Performance.

Nachteile:

- native Binary im Installer,
- zusätzliche Antivirus-/Signierungsfragen,
- Prebuild-/ABI-Prüfung.

**Empfehlung für die erste 9Router-Windows-Version:** `sql.js` als garantierter Fallback und `better-sqlite3` nur dann in den Installer aufnehmen, wenn der Packaged-Smoke-Test den tatsächlichen Treiber bestätigt. Der aktuelle Code hat `better-sqlite3` optional gemacht; diese Fallback-Philosophie sollte beibehalten werden.

---

## 12. Empfohlenes Electron-Runtime-Verhalten

### 12.1 Start

`main.js` sollte:

1. Single-Instance-Lock anfordern.
2. Datenverzeichnis bestimmen:
   ```text
   %APPDATA%\9router
   ```
3. Port aus `OMNIROUTE_PORT`/`PORT` oder Default `20128` lesen.
4. `resources/app/custom-server.js` bestimmen.
5. Server mit `process.execPath` und `ELECTRON_RUN_AS_NODE=1` starten.
6. `DATA_DIR` und `HOSTNAME=127.0.0.1` standardmäßig setzen.
7. `/api/health/ping` pollen.
8. Dashboard laden.
9. Tray bereitstellen.

### 12.2 Security Default

Die CLI bindet standardmäßig `0.0.0.0`. Für eine Desktop-App ist das ein unnötiges Netzwerk-Risiko. Empfehlung:

```text
Desktop default: HOSTNAME=127.0.0.1
CLI default: bestehendes Verhalten nicht ungefragt ändern
```

Wenn Remote-Zugriff benötigt wird, sollte der Benutzer ihn explizit aktivieren. Das ist eine wichtige Anpassung zwischen Server-/CLI-Produkt und Desktop-Produkt.

### 12.3 Browser oder eingebettetes Fenster

Zwei UX-Optionen:

#### Option A: Electron BrowserWindow

```text
Electron → BrowserWindow → http://127.0.0.1:20128/dashboard
```

Das entspricht einem echten Desktop-Produkt.

#### Option B: Browser öffnen

```text
Electron/Launcher → Systembrowser → http://127.0.0.1:20128/dashboard
```

Das ist kleiner und näher an der vorhandenen CLI, aber kein vollwertiger Desktop-Installer.

**Empfehlung:** BrowserWindow für den Installer, Browser-Öffnung weiterhin im CLI.

---

## 13. Vollständige GitHub-Actions-Strategie

### 13.1 Ziele

Die Workflow-Datei `desktop-release.yml` sollte:

- auf Tags `v*` laufen,
- manuell mit Version ausführbar sein,
- alle Build-Schritte in GitHub Actions ausführen,
- keine lokale Entwicklerdatei oder lokale Binary voraussetzen,
- Windows auf `windows-latest` bauen,
- den Server vor Packaging prüfen,
- Installer und Portable-Binary als Actions-Artefakte sichern,
- erst nach erfolgreichem Build ein GitHub Release anlegen,
- Release-Assets verifizieren.

### 13.2 Phasen

```text
validate
  ↓
quality
  ↓
server-build
  ↓
package-windows
  ↓
package-linux/mac (optional)
  ↓
release
  ↓
verify-assets
```

### 13.3 Warum der Server-Build separat sein kann

Der 9Router-Server-Tree ist plattformüberwiegend JavaScript. Native Unterschiede liegen bei SQLite/optionalen Dependencies. Ein gemeinsamer Server-Build spart Zeit, ist aber bei der ersten Installer-Version riskanter als ein separater Windows-Build.

Empfohlene Einführung:

#### Phase 1

```text
Windows-Leg baut Root + Electron komplett auf windows-latest
```

Das maximiert Debuggability.

#### Phase 2

```text
Ubuntu server-build einmal
Windows package hydratisiert / verifiziert native Teile
```

Das entspricht der OmniRoute-Optimierung und reduziert Kosten.

Für 9Router ist **Phase 1 als erster produktiver Installer** vorzuziehen, weil es noch keine bekannte Electron-/Windows-Packaging-Historie gibt.

---

## 14. Konkreter Workflow-Entwurf

Der folgende Entwurf ist eine Startvorlage. Er muss nach Hinzufügen der Dateien mit `actionlint`/GitHub Actions validiert werden.

```yaml
name: Desktop Release

on:
  push:
    tags:
      - "v*"
  workflow_dispatch:
    inputs:
      version:
        description: "Release version, e.g. v0.5.76"
        required: true
        type: string

permissions:
  contents: read

concurrency:
  group: desktop-release-${{ github.ref }}
  cancel-in-progress: false

env:
  NODE_VERSION: "22.22.2"
  CI_JWT_SECRET: ci-build-secret-with-sufficient-length-for-validation
  CI_PORT: "20128"

jobs:
  validate:
    name: Validate release version
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.version.outputs.version }}
      version_without_v: ${{ steps.version.outputs.version_without_v }}
    steps:
      - name: Resolve version from tag or input
        id: version
        shell: bash
        env:
          EVENT_NAME: ${{ github.event_name }}
          INPUT_VERSION: ${{ inputs.version }}
          REF_NAME: ${{ github.ref_name }}
        run: |
          if [[ "$EVENT_NAME" == "push" ]]; then
            VERSION="$REF_NAME"
          else
            VERSION="$INPUT_VERSION"
          fi

          if [[ ! "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo "Invalid version: $VERSION" >&2
            exit 1
          fi

          VERSION_NO_V="${VERSION#v}"
          echo "version=$VERSION" >> "$GITHUB_OUTPUT"
          echo "version_without_v=$VERSION_NO_V" >> "$GITHUB_OUTPUT"

      - name: Show repository identity
        env:
          VERSION: ${{ steps.version.outputs.version }}
          REPOSITORY: ${{ github.repository }}
        run: |
          echo "Repository: $REPOSITORY"
          echo "Version: $VERSION"

  quality:
    name: Quality checks
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - name: Install root dependencies
        run: npm ci

      - name: ESLint
        run: npx eslint .

      - name: Build validation
        run: npm run build
        env:
          JWT_SECRET: ${{ env.CI_JWT_SECRET }}
          NEXT_PUBLIC_BASE_URL: http://127.0.0.1:${{ env.CI_PORT }}
          PORT: ${{ env.CI_PORT }}

  package-windows:
    name: Package Windows installer
    needs: [validate, quality]
    runs-on: windows-latest
    permissions:
      contents: read
    env:
      JWT_SECRET: ${{ env.CI_JWT_SECRET }}
      PORT: ${{ env.CI_PORT }}
      HOSTNAME: 127.0.0.1
      NEXT_PUBLIC_BASE_URL: http://127.0.0.1:${{ env.CI_PORT }}
      NODE_ENV: production
      DATA_DIR: ${{ runner.temp }}\\9router-data
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - name: Install root dependencies
        run: npm ci

      - name: Install Electron dependencies
        working-directory: electron
        run: npm ci --no-audit --no-fund

      - name: Build and package Windows
        working-directory: electron
        env:
          VERSION: ${{ needs.validate.outputs.version_without_v }}
        shell: pwsh
        run: |
          $pkg = Get-Content package.json | ConvertFrom-Json
          $pkg.version = $env:VERSION
          $pkg | ConvertTo-Json -Depth 100 | Set-Content package.json
          npm run build:win

      - name: Verify expected outputs
        shell: pwsh
        env:
          VERSION: ${{ needs.validate.outputs.version_without_v }}
        run: |
          $installer = "electron/dist-electron/9Router.Setup.$env:VERSION.exe"
          if (!(Test-Path $installer)) {
            throw "Installer not found: $installer"
          }

          $portable = Get-ChildItem electron/dist-electron -Filter "*.exe" |
            Where-Object { $_.Name -notlike "*Setup*" } |
            Select-Object -First 1
          if ($null -eq $portable) {
            throw "Portable EXE not found"
          }

          Get-ChildItem electron/dist-electron | Format-Table Name, Length

      - name: Packaged smoke test
        continue-on-error: true
        env:
          ELECTRON_SMOKE_TIMEOUT_MS: "60000"
        run: node scripts/smoke-electron-packaged.mjs

      - name: Collect Windows assets
        shell: pwsh
        env:
          VERSION: ${{ needs.validate.outputs.version_without_v }}
        run: |
          New-Item -ItemType Directory -Force release-assets | Out-Null
          Copy-Item "electron/dist-electron/9Router.Setup.$env:VERSION.exe" release-assets/

          $portable = Get-ChildItem electron/dist-electron -Filter "*.exe" |
            Where-Object { $_.Name -notlike "*Setup*" } |
            Select-Object -First 1
          Copy-Item $portable.FullName "release-assets/9Router.exe"

          Get-ChildItem electron/dist-electron -Filter "latest*.yml" |
            Copy-Item -Destination release-assets/ -Force

      - name: Hash Windows assets
        shell: pwsh
        run: |
          Get-ChildItem release-assets -File |
            Get-FileHash -Algorithm SHA256 |
            Format-Table Algorithm, Hash, Path
          Get-ChildItem release-assets -File |
            Get-FileHash -Algorithm SHA256 |
            ConvertTo-Json | Set-Content release-assets/SHA256SUMS.json

      - name: Upload Windows build artifact
        uses: actions/upload-artifact@v4
        with:
          name: windows-desktop-${{ needs.validate.outputs.version_without_v }}
          path: release-assets/
          if-no-files-found: error
          retention-days: 14

  release:
    name: Create GitHub Release
    needs: [validate, package-windows]
    if: ${{ !cancelled() && needs.validate.result == 'success' && needs.package-windows.result == 'success' }}
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
          fetch-depth: 0

      - name: Download Windows assets
        uses: actions/download-artifact@v4
        with:
          name: windows-desktop-${{ needs.validate.outputs.version_without_v }}
          path: release-assets

      - name: List release assets
        run: ls -lah release-assets

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ needs.validate.outputs.version }}
          name: 9Router ${{ needs.validate.outputs.version }}
          draft: false
          prerelease: false
          generate_release_notes: true
          fail_on_unmatched_files: true
          files: |
            release-assets/*.exe
            release-assets/*.yml
            release-assets/*.json
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  verify-release:
    name: Verify published assets
    needs: [validate, release]
    if: ${{ !cancelled() && needs.release.result == 'success' }}
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Check release asset list
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          VERSION: ${{ needs.validate.outputs.version }}
          REPOSITORY: ${{ github.repository }}
        run: |
          names="$(gh release view "$VERSION" --repo "$REPOSITORY" --json assets --jq '.assets[].name')"
          echo "$names"
          grep -qE '^9Router\.Setup\.[0-9]+\.[0-9]+\.[0-9]+\.exe$' <<< "$names"
          grep -qE '^9Router\.exe$' <<< "$names"
```

### 14.1 Wichtige Anpassung gegenüber OmniRoute

Der Beispielworkflow baut zunächst nur Windows und hält die Plattformmatrix klein. Das ist absichtlich:

- 9Router hat noch keine Electron-Build-Historie.
- Der Fork hat aktuell keine Release-Assets.
- Windows ist das explizite Ziel.
- Ein fehlgeschlagener macOS-/Linux-Leg sollte nicht die erste Windows-Veröffentlichung blockieren.

Später kann eine Matrix ergänzt werden:

```yaml
matrix:
  include:
    - platform: windows
      runner: windows-latest
      target: win
    - platform: linux
      runner: ubuntu-latest
      target: linux
    - platform: macos
      runner: macos-latest
      target: mac
```

---

## 15. Ein vollständiger Windows-Workflow versus Shared-Build

### 15.1 Empfohlener erster Release

```text
windows-latest
  ├─ root npm ci
  ├─ root npm run build
  ├─ copy standalone assets
  ├─ electron npm ci
  ├─ npm run build:win
  └─ smoke
```

Das ist langsamer, aber einfacher zu debuggen.

### 15.2 Späterer optimierter Release

```text
ubuntu-latest
  ├─ root npm ci
  ├─ npm run build
  ├─ pack .next/standalone + manifest
  └─ upload shared-server

windows-latest
  ├─ root npm ci
  ├─ download shared-server
  ├─ verify manifest
  ├─ hydrate Windows natives
  ├─ electron npm ci
  └─ electron-builder --win
```

### 15.3 Wann Shared-Build sinnvoll ist

Erst aktivieren, wenn:

- Windows-Packaging mehrfach erfolgreich lief,
- alle dynamisch geladenen Dependencies bekannt sind,
- `sql.js` und `better-sqlite3` auf Windows smoke-getestet sind,
- der Standalone-Tree kein Build-Maschinenpfadproblem enthält,
- die CI-Zeit tatsächlich relevant ist.

---

## 16. Windows-Smoke-Test für 9Router

### 16.1 Mindesttest

Der Packaged-Smoke sollte:

1. `electron/dist-electron/win-unpacked/9Router.exe` finden,
2. ein temporäres `%APPDATA%` und `DATA_DIR` setzen,
3. Port 20128 prüfen,
4. die gepackte Anwendung starten,
5. auf `http://127.0.0.1:20128/api/health/ping` oder einen im Code verifizierten Health-Endpunkt warten,
6. anschließend `/dashboard` laden,
7. den Prozessbaum beenden,
8. prüfen, dass der Port geschlossen ist.

### 16.2 Endpunkt nicht erfinden

Vor dem Implementieren des Smoke-Tests muss der Repository-Code nach einem tatsächlich existierenden Health-Endpunkt durchsucht werden. Wenn kein stabiler Health-Endpunkt existiert, sollte ein dedizierter, getesteter Endpoint ergänzt werden.

Nicht einfach eine nicht verifizierte URL aus einer fremden Electron-Recherche übernehmen.

### 16.3 API-Smoke

Zusätzlich sollte lokal geprüft werden:

```text
GET /v1/models
```

Nur wenn dieser Endpoint Authentifizierung benötigt, muss der Smoke-Test einen CI-Test-API-Key oder eine kontrollierte Testkonfiguration verwenden. Es dürfen keine Provider-Credentials in GitHub Actions benötigt werden.

### 16.4 SQLite-Smoke

Der Test sollte das tatsächlich ausgewählte DB-Verfahren aus Logs oder einem internen Diagnosepfad prüfen:

```text
better-sqlite3
node:sqlite
sql.js
```

Er soll nicht voraussetzen, dass `better-sqlite3` auf jedem Windows-Runner erfolgreich geladen wird, wenn der offiziell vorgesehene Fallback `sql.js` ist. Das Ziel ist: ein gültiger Treiber, keine stille Datenverlust-/DB-Initialisierungsfehler.

---

## 17. Release-Namensschema

### 17.1 Empfehlung

```text
Tag:        v0.5.76
Release:    9Router v0.5.76
Installer:  9Router.Setup.0.5.76.exe
Portable:   9Router.exe
Manifest:   latest.yml
Checksums:  SHA256SUMS.json
```

### 17.2 Warum `v` nicht in `package.json` gehört

Git-Tags verwenden:

```text
v0.5.76
```

npm-/Electron-Versionen verwenden:

```text
0.5.76
```

Die Pipeline muss beide Darstellungen sauber trennen:

```bash
VERSION=v0.5.76
VERSION_NO_V=0.5.76
```

### 17.3 Kein `latest`-Tag beim ersten Lauf

Bei einem neuen Fork sollte der erste Release-Workflow nicht automatisch mutable `latest`-Assets überschreiben. Erst wenn der normale Releasepfad stabil ist, kann `latest`/Auto-Update aktiviert werden.

---

## 18. GitHub-Berechtigungen und Secrets

### 18.1 Minimalrechte

Top-Level:

```yaml
permissions:
  contents: read
```

Build-Jobs brauchen nur read. Der Release-Job braucht:

```yaml
permissions:
  contents: write
```

### 18.2 Benötigte Secrets

Für den ersten lokalen Windows-Installer sollten keine Provider-Secrets notwendig sein. Mögliche GitHub-Secrets:

| Secret | Erforderlich? | Zweck |
|---|---:|---|
| `GITHUB_TOKEN` | automatisch | Release-/Artifact-Zugriff |
| `WINDOWS_CERTIFICATE_BASE64` | optional, empfohlen für Signing | Authenticode-Zertifikat |
| `WINDOWS_CERTIFICATE_PASSWORD` | optional, empfohlen | Zertifikatspasswort |
| `NPM_TOKEN` | nur CLI-Publishing | npm-Release |
| `DOCKERHUB_TOKEN` | bestehender Docker-Workflow | Docker Publishing |

Provider-OAuth-Credentials, API-Keys, JWT-Produktionsgeheimnisse und Benutzerpasswörter gehören nicht in den Installer-Build.

### 18.3 CI-JWT-Secret

Next.js kann beim Build eine ausreichend lange Dummy-Variable benötigen. Das CI-Secret muss ausschließlich für Build-/Testzwecke dienen:

```text
ci-build-secret-with-sufficient-length-for-validation
```

Es darf nicht mit einem Produktions-`JWT_SECRET` verwechselt werden.

---

## 19. Code Signing und Windows SmartScreen

### 19.1 Unsigned Installer

Ohne Authenticode-Signing kann Windows beim ersten Start Warnungen anzeigen. Das ist technisch funktionsfähig, aber für Endbenutzer problematisch.

### 19.2 Signierungsoption

Nach erfolgreichem Unsigned-Build:

```yaml
- name: Import certificate
  shell: pwsh
  env:
    CERTIFICATE_BASE64: ${{ secrets.WINDOWS_CERTIFICATE_BASE64 }}
    CERTIFICATE_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
  run: |
    [IO.File]::WriteAllBytes(
      "$env:RUNNER_TEMP\codesign.pfx",
      [Convert]::FromBase64String($env:CERTIFICATE_BASE64)
    )
```

`electron-builder` kann über Zertifikatsumgebungsvariablen signieren. Die genaue Konfiguration muss an den gewählten Zertifikatsanbieter angepasst werden. Niemals Zertifikatdatei oder Passwort in Repository-Dateien schreiben.

### 19.3 Signing muss vor Release-Upload erfolgen

Die Reihenfolge ist:

```text
build unsigned
  → sign installer/executable
  → verify Authenticode signature
  → hash signed artifact
  → upload artifact
  → release upload
```

Der Hash muss nach dem Signieren berechnet werden, da Signing die Datei verändert.

---

## 20. Auto-Update: bewusst in Phasen einführen

Der aktuelle 9Router-Fork hat CLI-eigenen npm-Update-Check:

```text
https://registry.npmjs.org/<package>/latest
```

Die Desktop-App sollte nicht ungeprüft denselben Mechanismus für eine EXE verwenden.

### Phase 1

- kein automatisches Update,
- GitHub-Release-Download manuell,
- `SHA256SUMS.json` veröffentlichen.

### Phase 2

- `electron-updater` installieren,
- `latest.yml` veröffentlichen,
- signierte Installer verwenden,
- Update-Download explizit vom Benutzer auslösen.

### Phase 3

- Auto-Download optional,
- Rollback-/Fehlerlogik,
- Serverprozess vor `quitAndInstall()` sauber beenden.

Für den ersten Fork-Release ist Phase 1 oder 2 angemessen; Auto-Download sollte erst nach einem stabilen signierten Release verwendet werden.

---

## 21. Docker-Workflow und Desktop-Workflow sind getrennte Produkte

Der bestehende `.github/workflows/docker-publish.yml`:

- läuft bei `v*`-Tags und manuell,
- baut auf Ubuntu,
- veröffentlicht GHCR und Docker Hub,
- baut `linux/amd64,linux/arm64`,
- setzt `provenance: false`, `sbom: false`.

Er erstellt keinen Windows-Installer.

Ein Desktop-Workflow sollte deshalb **nicht** versuchen, Docker-Output in eine Windows-EXE umzuwandeln. Die Produkte unterscheiden sich:

| Docker | Windows Desktop |
|---|---|
| Linux Container | Windows x64 EXE |
| `ENTRYPOINT /entrypoint.sh` | Electron Main Process |
| `/app/data` | `%APPDATA%\9router` |
| `HOSTNAME=0.0.0.0` | standardmäßig `127.0.0.1` |
| `su-exec node` | Prozessstart über Electron/Node |
| Docker Hub/GHCR | GitHub Release Assets |

---

## 22. Fork-spezifisches Release- und Upstream-Risiko

Das untersuchte Repository ist ein Fork und hat laut API aktuell keine eigenen Releases. Das Parent-Repository hat Releases, aber deren Assets sind leer. Daraus folgt:

1. Nicht automatisch vom Parent-Release-Workflow ausgehen.
2. Nicht voraussetzen, dass GitHub Actions in der Fork bereits Release-Rechte besitzt.
3. `jahdaganj00ki-eng/9router` als eigene Distribution behandeln.
4. GitHub Release-Tags im Fork erzeugen.
5. `github.repository` dynamisch verwenden, nicht `decolua/9router` hart codieren.
6. Docker-Publishing und Desktop-Publishing getrennt testen.

### 22.1 Repo-Owner in electron-builder

Für die Fork-Distribution muss die Electron-Konfiguration lauten:

```json
"publish": {
  "provider": "github",
  "owner": "jahdaganj00ki-eng",
  "repo": "9router"
}
```

Wenn später an das Parent-Repository veröffentlicht werden soll, ist das eine bewusst andere Release-Policy und darf nicht versehentlich durch eine kopierte Konfiguration passieren.

---

## 23. Konkreter Implementierungsplan

### Phase 0: Vorbedingungen

1. Root- und CLI-Version synchronisieren.
2. Root `package-lock.json` erzeugen und committen.
3. CLI `package-lock.json` erzeugen und committen.
4. Root-Build in sauberem Checkout prüfen.
5. `npm run build` + `npm run start` auf Windows testen.
6. tatsächliche Health-/Models-Endpoints im Code verifizieren.

### Phase 1: Electron-Shell

1. `electron/package.json` anlegen.
2. `electron/main.js` anlegen.
3. `electron/preload.js` mit IPC-Whitelist anlegen.
4. Icons bereitstellen.
5. `prepare-electron-standalone.mjs` anlegen.
6. `electron-builder --dir` lokal nur zur Strukturprüfung verwenden.

### Phase 2: Windows Packaging

1. `build:win` hinzufügen.
2. `win.target = nsis + portable` konfigurieren.
3. `dist-electron` prüfen.
4. `latest.yml`/Blockmap-Verhalten prüfen.
5. Packaged-App starten.
6. SQLite-Fallback prüfen.

### Phase 3: Actions

1. `desktop-release.yml` hinzufügen.
2. `validate` implementieren.
3. `quality` implementieren.
4. Windows-Build-Leg implementieren.
5. Actions-Artefakt hochladen.
6. Release-Job implementieren.
7. Asset-Verifikation implementieren.

### Phase 4: Signing

1. Zertifikat auswählen.
2. GitHub Secrets konfigurieren.
3. Signierungsstep hinzufügen.
4. `signtool verify` ausführen.
5. Hash nach Signing erzeugen.

### Phase 5: Auto-Update

1. signierte Release-Artefakte.
2. `latest.yml` prüfen.
3. `electron-updater` integrieren.
4. Update-Test gegen Test-Release.
5. erst danach produktives Auto-Update.

---

## 24. Akzeptanzkriterien für den ersten Installer

Ein Release darf nur als erfolgreich gelten, wenn:

### Build

- [ ] Tag entspricht `v<major>.<minor>.<patch>`.
- [ ] Root-Version und CLI-Version sind identisch.
- [ ] `npm ci` läuft auf Windows ohne manuellen Eingriff.
- [ ] `npm run build` erzeugt einen gültigen Standalone-Tree.
- [ ] `custom-server.js` ist im Bundle.
- [ ] `server.js` ist im Bundle.
- [ ] `public` und Next-static-Dateien sind vorhanden.
- [ ] `sql-wasm.wasm` ist vorhanden.
- [ ] MITM-Dateien sind entweder vollständig eingebettet oder bewusst deaktiviert.

### Packaging

- [ ] `electron-builder --win` beendet sich erfolgreich.
- [ ] `9Router.Setup.<version>.exe` existiert.
- [ ] portable `9Router.exe` existiert.
- [ ] Installer ist x64.
- [ ] Icon ist eingebettet.
- [ ] Programmordner enthält keinen Benutzer- oder Runner-Absolute-Pfad.

### Runtime

- [ ] App startet auf `windows-latest`.
- [ ] Server bindet standardmäßig nur auf Loopback.
- [ ] Dashboard öffnet.
- [ ] `/v1/models` funktioniert mit Testkonfiguration.
- [ ] Daten werden unter `%APPDATA%\9router` gespeichert.
- [ ] Ein Neustart verwendet dieselbe SQLite-Datenbank.
- [ ] Serverprozess wird vollständig beendet.
- [ ] Kein `MODULE_NOT_FOUND`.
- [ ] Kein `ERR_DLOPEN_FAILED` für den gewählten DB-Treiber.

### Release

- [ ] Actions-Artefakt ist vorhanden.
- [ ] SHA256SUMS-Datei entspricht den finalen Dateien.
- [ ] GitHub Release wurde erstellt.
- [ ] `.exe`-Assets sind vorhanden.
- [ ] Installer-Dateiname stimmt mit Versionsnummer überein.
- [ ] Release-Asset-Verifikation ist grün.
- [ ] Wenn Auto-Update aktiv ist: `latest.yml` referenziert den tatsächlich vorhandenen Installer.

---

## 25. Was ausdrücklich nicht aus OmniRoute kopiert werden sollte

Die OmniRoute-Research beschreibt eine sehr große, bereits gewachsene Pipeline. Für 9Router sollten folgende Teile nicht ungeprüft übernommen werden:

1. Vier-Plattform-Matrix, bevor Windows allein stabil ist.
2. Shared-Standalone-Archiv, bevor native Windows-Abhängigkeiten verstanden sind.
3. komplexe Manifest-/Hydration-Schicht ohne passende Tests.
4. Electron-Remote-Server-Modus, wenn 9Router zunächst lokal laufen soll.
5. macOS-Updater-Manifest-Merge für einen Windows-only Release.
6. `continue-on-error` beim Windows-Smoke als dauerhafte Lösung.
7. harte Versions-/Owner-Werte aus einem anderen Repository.
8. interne OmniRoute-Pfade wie `open-sse/services/compression`.
9. OmniRoute-Health-URLs, die im 9Router-Code nicht existieren.
10. die Annahme, dass ein Release-Asset bereits über eine veröffentlichte GitHub-Run-ID belegbar ist.

Die richtige Übertragung ist das **Muster**, nicht die komplette Dateimenge:

```text
validierter Tag
→ reproduzierbarer Build
→ server bundle
→ Windows-specific packaging
→ smoke
→ artifact
→ release
→ verify
```

---

## 26. Quellenverzeichnis

### 9Router-Fork

- [Repository](https://github.com/jahdaganj00ki-eng/9router)
- [Repository API](https://api.github.com/repos/jahdaganj00ki-eng/9router)
- [Root-Contents API](https://api.github.com/repos/jahdaganj00ki-eng/9router/contents)
- [Root `package.json`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/package.json)
- [`next.config.mjs`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/next.config.mjs)
- [`custom-server.js`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/custom-server.js)
- [`scripts/copy-standalone-assets.mjs`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/scripts/copy-standalone-assets.mjs)
- [`Dockerfile`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/Dockerfile)
- [`CLAUDE.md`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/CLAUDE.md)
- [CLI-Contents API](https://api.github.com/repos/jahdaganj00ki-eng/9router/contents/cli?ref=master)
- [CLI `package.json`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/cli/package.json)
- [`cli/scripts/build-cli.js`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/cli/scripts/build-cli.js)
- [`cli/cli.js`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/cli/cli.js)
- [`cli/hooks/postinstall.js`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/cli/hooks/postinstall.js)
- [`cli/hooks/sqliteRuntime.js`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/cli/hooks/sqliteRuntime.js)
- [`cli/hooks/trayRuntime.js`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/cli/hooks/trayRuntime.js)
- [`cli/src/cli/tray/trayWin.js`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/cli/src/cli/tray/trayWin.js)
- [`cli/src/cli/tray/tray.ps1`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/cli/src/cli/tray/tray.ps1)
- [`cli/src/cli/tray/autostart.js`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/cli/src/cli/tray/autostart.js)
- [9Router-Workflow-Liste](https://api.github.com/repos/jahdaganj00ki-eng/9router/contents/.github/workflows?ref=master)
- [`docker-publish.yml`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/.github/workflows/docker-publish.yml)
- [`.github/workflows` API](https://api.github.com/repos/jahdaganj00ki-eng/9router/contents/.github/workflows?ref=master)
- [`.env.example`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/.env.example)
- [`src/app/api/health/route.js`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/src/app/api/health/route.js)
- [`src/app/api/version/route.js`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/src/app/api/version/route.js)
- [`src/app/api/init/route.js`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/src/app/api/init/route.js)
- [`src/app/api/auth/login/route.js`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/src/app/api/auth/login/route.js)
- [`src/app/api/settings/route.js`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/src/app/api/settings/route.js)
- [`src/lib/auth/dashboardSession.js`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/src/lib/auth/dashboardSession.js)
- [`src/lib/dataDir.js`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/src/lib/dataDir.js)
- [`gitbook/content/en/getting-started/installation.md`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/gitbook/content/en/getting-started/installation.md)
- [`gitbook/content/en/deployment/localhost.md`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/gitbook/content/en/deployment/localhost.md)
- [`src/mitm/manager.js`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/src/mitm/manager.js)
- [`src/mitm/winElevated.js`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/src/mitm/winElevated.js)
- [`src/mitm/paths.js`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/src/mitm/paths.js)
- [`src/mitm/server.js`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/src/mitm/server.js)
- [`src/lib/db/driver.js`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/src/lib/db/driver.js)
- [`src/lib/db/paths.js`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/src/lib/db/paths.js)
- [`src/lib/db/migrate.js`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/src/lib/db/migrate.js)
- [`src/lib/db/schema.js`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/src/lib/db/schema.js)
- [`src/lib/db/adapters/sqljsAdapter.js`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/src/lib/db/adapters/sqljsAdapter.js)
- [`src/lib/db/adapters/nodeSqliteAdapter.js`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/src/lib/db/adapters/nodeSqliteAdapter.js)
- [`src/lib/db/backup.js`](https://raw.githubusercontent.com/jahdaganj00ki-eng/9router/master/src/lib/db/backup.js)
- [npm `9router@latest` metadata](https://registry.npmjs.org/9router/latest)
- [Fork tags API](https://api.github.com/repos/jahdaganj00ki-eng/9router/tags?per_page=100)

### Parent-Repository-Kontext

- [Parent `decolua/9router`](https://github.com/decolua/9router)
- [Parent Releases API](https://api.github.com/repos/decolua/9router/releases?per_page=20)
- [Parent Release v0.5.35](https://github.com/decolua/9router/releases/tag/v0.5.35)

### Vergleichsrecherche

- [OmniRoute Windows-Installer-Research im aktuellen Worktree](./2026-09-16-omniroute-windows-installer-github-actions.md)

---

## Schlussfolgerung

9Router besitzt bereits die schwierigsten Server-Bausteine für einen Windows-Installer: Next.js-Standalone-Build, `custom-server.js`, eine SQLite-Fallback-Strategie, einen eigenständigen CLI-Assembler und Windows-orientierte Prozess-/Datenpfadlogik. Was fehlt, ist eine dedizierte Desktop-Schicht und eine GitHub-Actions-Release-Pipeline.

Der sicherste Weg ist daher:

```text
bestehenden CLI-/Standalone-Build wiederverwenden
  → minimalen Electron-Wrapper hinzufügen
  → Windows-NSIS + portable EXE konfigurieren
  → direkt auf windows-latest bauen
  → gepackte Anwendung testen
  → Artefakte hashen und als GitHub Release veröffentlichen
```

Für die erste Version sollte der Workflow bewusst Windows-only, vollständig per GitHub Actions und ohne Shared-Bundle-Komplexität gebaut werden. Erst nach mehreren erfolgreichen Releases sollten Linux/macOS-Matrix, Shared-Standalone-Archive, automatische Updates und optionale native Optimierungen hinzukommen.

Der erwartete erste Download wäre:

```text
https://github.com/jahdaganj00ki-eng/9router/releases/download/v0.5.76/9Router.Setup.0.5.76.exe
```

Das ist eine **Plan-/Implementierungs-Research**, keine Behauptung, dass dieser Installer im untersuchten Fork bereits existiert. Die GitHub-API zeigt aktuell keine Releases und keine bestehende Electron-Workflow-Datei. Die vorgeschlagene Pipeline muss daher als neue, zu implementierende Release-Infrastruktur behandelt werden.

---

# 27. Zweiter Gap- und Risk-Audit: verifizierte Befunde

Dieser Abschnitt korrigiert den vorherigen Entwurf anhand weiterer direkter Quelltextprüfungen. Die Befunde sind in drei Klassen eingeteilt:

- **Blocker:** Der Installer kann so nicht zuverlässig gebaut oder gestartet werden.
- **Release-Risiko:** Der Build könnte grün sein, obwohl das ausgelieferte Verhalten falsch oder unsicher ist.
- **bewusst verschobenes Feature:** Für den ersten Release wird das Feature nicht stillschweigend behauptet, sondern explizit deaktiviert oder in eine spätere Phase verschoben.

## 27.1 Blocker: Der Beispielworkflow überträgt den Server-Build nicht

Im bisherigen Workflow baut `quality` auf Ubuntu:

```yaml
quality:
  run: npm run build
```

`package-windows` checkt danach einen neuen Runner aus und führt nur `npm ci` und `electron-builder` aus. GitHub-Actions-Job-Dateisysteme werden nicht geteilt. Die Ubuntu-Ausgabe `.next/standalone` existiert im Windows-Job daher **nicht**.

Das ist ein konkreter Planfehler. Es gibt nur zwei korrekte Varianten:

### Variante A — für den ersten Release empfohlen

Der Windows-Job führt den vollständigen Build selbst aus:

```text
Windows checkout
→ npm ci
→ npm run build
→ prepare desktop bundle
→ electron npm ci
→ electron-builder --win --publish never
```

Der `quality`-Build bleibt ein unabhängiger Validierungsbuild. Er liefert kein implizites Packaging-Input.

### Variante B — erst später

`quality` oder ein separater `server-build`-Job muss `.next` als explizites Actions-Artefakt hochladen. Der Windows-Job muss es downloaden und seine Windows-spezifischen Dependencies danach verifizieren/hydratisieren. Für den ersten 9Router-Installer ist das unnötige Komplexität.

**Verbindliche Korrektur:** Phase 1 verwendet Variante A. Kein Job darf sich auf ein nicht heruntergeladenes Cross-Job-Dateisystem verlassen.

## 27.2 Blocker: `npm ci` setzt Lockfiles voraus

Die GitHub-Contents-Prüfung des Root-Baums zeigte keine Root-`package-lock.json`; die CLI besitzt zwar eine eigene Package-Struktur, aber die Lockfile-Situation muss explizit hergestellt werden. Ein Workflow mit `npm ci` darf erst aktiviert werden, wenn folgende Dateien im Release-Commit vorhanden sind:

```text
/package-lock.json
/cli/package-lock.json
/electron/package-lock.json
```

Falls das CLI-Paket im Desktop-Build nicht installiert wird, ist `cli/package-lock.json` nicht zwingend für den Desktop-Job, aber für die bestehende npm-Distribution weiterhin empfehlenswert.

**Verbindliche Korrektur:** Phase 0 erzeugt und committet Root- und Electron-Lockfiles. Der Workflow prüft vor dem Installieren:

```bash
test -f package-lock.json
 test -f electron/package-lock.json
```

Auf Windows erfolgt die gleiche Prüfung in PowerShell. Kein Fallback auf unkontrolliertes `npm install` im Produktions-Packaging.

## 27.3 Release-Risiko: Root-Version, CLI-Version und Tag können auseinanderlaufen

`cli/scripts/build-cli.js` synchronisiert die CLI-Version in das Root-`package.json` und mutiert damit Dateien während des Builds. Für eine Desktop-Release-Pipeline ist das problematisch:

- ein CI-Build verändert den Checkout,
- die mutierte Version ist nicht zwingend im Tag-Commit enthalten,
- `src/app/api/version/route.js` liest die Root-Package-Version,
- Electron liest seine eigene Package-Version.

**Verbindliche Korrektur:** Der Release-Tag ist die einzige externe Release-Quelle. Vor dem Build werden Root- und CLI-Version nicht still geändert, sondern geprüft:

```text
root package.json version == cli/package.json version == tag ohne v
```

Das Desktop-`electron/package.json` wird in einem temporären Build-Staging auf die validierte Version gesetzt; die Pipeline committed diese Mutation nicht zurück. Wenn die Versionswerte nicht gleich sind, stoppt `validate` mit Fehler. Die vorhandene CLI-Synchronisierung wird im Desktop-Workflow nicht als versteckter Seiteneffekt aufgerufen.

## 27.4 Verifiziert: Der Health-Smoke muss `/api/health` nutzen

Im Repository existiert:

```text
src/app/api/health/route.js
```

Der GET-Handler liefert `{ ok: true }` und Status 200. Der bisherige Plan nannte teilweise `/api/health/ping`, was im untersuchten Quellbaum nicht belegt ist.

**Verbindliche Korrektur:** Der Packaged-Smoke pollt ausschließlich:

```text
GET http://127.0.0.1:<port>/api/health
```

`/api/health/ping` wird nicht mehr dokumentiert oder getestet. Ein zusätzlicher `/api/version`-Smoke ist möglich, aber nur als Netzwerktest; er darf wegen seines npm-Registry-Lookups nicht die Startbereitschaft blockieren.

## 27.5 Verifiziert: `/v1/models` ist kein anonymer Readiness-Test

Der API-Baum enthält `/api/v1` und `/api/models`, aber die LLM-/Provider-Routen können Authentifizierung oder konfigurierte Provider voraussetzen. Ein Installer-Smoke darf deshalb nicht behaupten, dass `/v1/models` ohne Benutzerkonfiguration erfolgreich sein muss.

**Verbindliche Korrektur:** Readiness-Gate:

```text
/api/health → 200 und JSON ok=true
```

Optionaler Funktionstest:

```text
/api/init → 200
```

Ein `/v1/models`-Test wird erst nach Login-/API-Key-Initialisierung als separater Integrationstest ausgeführt. Für den reinen Installer-Gate werden keine Provider-Secrets benötigt.

## 27.6 Blocker/Risiko: `custom-server.js` und `server.js` müssen gemeinsam validiert werden

`next.config.mjs` erzeugt `output: "standalone"`; `scripts/copy-standalone-assets.mjs` ergänzt statische Dateien und `custom-server.js`. Der Custom Server enthält jedoch mehr als einen simplen `next start`-Aufruf: Peer-IP-/Header-Logik, h2c-Behandlung und einen dynamischen Background-Refresh-Import.

**Verbindliche Korrektur:** `prepare-electron-standalone.mjs` muss vor dem Packaging hart prüfen:

```text
custom-server.js
server.js
.next/static/
public/
package.json
node_modules/next/
```

Zusätzlich muss ein Starttest zeigen, dass wirklich `custom-server.js` als Entry läuft. Ein erfolgreicher Start des nackten `server.js` allein reicht nicht als Abnahme.

## 27.7 Blocker: Externe Runtime-Dependencies werden vom Tracer nicht vollständig garantiert

`next.config.mjs` markiert ausdrücklich als extern:

```text
better-sqlite3
sql.js
node:sqlite
bun:sqlite
open
```

Der Dockerfile kopiert zusätzlich explizit:

```text
node-forge
next
sql.js
node-machine-id
```

Das ist ein starker Quellcode-Hinweis, dass ein blindes Kopieren von `.next/standalone` nicht genügt. Insbesondere:

- `sql.js` benötigt `dist/sql-wasm.wasm`.
- `node-machine-id` wird dynamisch geladen.
- `open` benötigt seine echte Laufzeit-`import.meta.url` und darf nicht auf einen Build-Maschinenpfad zeigen.
- `src/mitm` wird als separater Prozess gestartet und wird vom Next-Tracer nicht zwingend vollständig erfasst.

**Verbindliche Korrektur:** Das Prepare-Script kopiert bzw. validiert diese Module im finalen Staging-Tree und führt eine Laufzeitprüfung mit `require()`/dynamischem Import aus:

```text
sql.js + sql-wasm.wasm
open
node-machine-id
node-forge
selfsigned
next
```

Der Test muss den finalen Staging-Pfad verwenden, nicht den Root-`node_modules`-Pfad.

## 27.8 Release-Risiko: Runtime-`npm install` ist für einen Installer nicht zulässig

Die CLI-Hooks `cli/hooks/sqliteRuntime.js` und `cli/hooks/trayRuntime.js` installieren bei Bedarf Pakete in `%APPDATA%\9router\runtime` bzw. auf Unix-Systemen im Benutzerverzeichnis. Das ist eine sinnvolle Selbstheilung für ein npm-CLI, aber ein schlechter Default für einen signierten Desktop-Installer:

- der erste Start hängt vom Internetzugriff ab,
- ein Registry-/DNS-Ausfall ändert die Funktionalität,
- die tatsächlich installierte Version wird nicht allein durch das Installer-Binary bestimmt,
- Malware-/Registry-Supply-Chain-Risiko wird in den Laufzeitpfad verschoben,
- Enterprise-Umgebungen blockieren häufig npm.

**Verbindliche Korrektur:** Die Electron-Desktop-App verwendet nicht `cli/cli.js` als Server-Launcher und importiert keine CLI-Runtime-Hooks. Im Desktop-Modus gilt:

```text
kein npm install beim Start
kein systray2-Download
kein npm-Update-Check
kein globales CLI-Selbstupdate
```

`sql.js` wird physisch mitgeliefert. `better-sqlite3` ist optional und wird nur verwendet, wenn es im finalen Bundle erfolgreich geladen wird. Fällt es aus, muss die Anwendung deterministisch auf `sql.js` zurückfallen.

## 27.9 Verifiziert: MITM ist ein privilegiertes Feature, kein normaler Serverprozess

`src/mitm/manager.js` zeigt für Windows:

- MITM-Port `443`.
- Ermittlung und gegebenenfalls Beendigung eines Prozesses auf Port 443.
- Root-CA-Generierung und Installation in den System-Truststore.
- Änderungen an der Windows-Hosts-Datei.
- UAC-Eskalation über `Start-Process -Verb RunAs`.
- `setx NODE_EXTRA_CA_CERTS`.
- separaten MITM-Kindprozess und PID-/Lock-Dateien.

Das ist nicht mit einem normalen, unprivilegierten Electron-Start-Smoke abgedeckt. Ein automatisches Starten des MITM beim App-Start könnte UAC-Popups und potenziell destruktive Port-/Hosts-Änderungen auslösen.

**Verbindliche Korrektur für Release 1:**

```text
MITM standardmäßig deaktiviert.
Keine UAC-Anforderung beim normalen App-Start.
Kein automatisches Binden an Port 443.
Kein automatisches Ändern der Hosts-Datei.
```

Die UI darf MITM als „manuell aktivierbar, benötigt Administratorrechte“ anzeigen. Ein späterer MITM-Feature-Release braucht einen eigenen Windows-Test mit UAC/Administrator und darf nicht durch den normalen Installer-Smoke simuliert werden.

Wenn MITM im ersten Release bereits beworben werden muss, ist statt einer stillen Einbettung ein explizites Capability-Gate erforderlich:

```text
NINEROUTER_DESKTOP_MITM=disabled
```

Der Backend-Code muss diesen Modus respektieren und die Startaktion mit einer verständlichen Meldung ablehnen.

## 27.10 Verifiziert: Die PowerShell-Tray-Implementierung wird nicht in Electron übernommen

Die CLI verwendet `powershell.exe -ExecutionPolicy Bypass` und `tray.ps1`, um ein NotifyIcon zu erzeugen. Das ist für das CLI-Produkt eine bewusste AV-Vermeidungsstrategie, aber in Electron redundant:

```text
Electron Tray → ein Tray-Verantwortlicher
CLI PowerShell Tray → zweiter Tray-Verantwortlicher
```

**Verbindliche Korrektur:** Der Desktop-Wrapper nutzt ausschließlich `Tray` aus Electron. `tray.ps1`, `trayWin.js`, `systray2` und die CLI-Autostart-VBS-Datei werden nicht als Desktop-Runtime verwendet. Dadurch entfällt ein unnötiger `ExecutionPolicy Bypass`-Pfad und die Single-Instance-/Shutdown-Logik bleibt zentral im Electron-Main-Prozess.

## 27.11 Blocker: Manuelle Workflow-Runs müssen den Tag auschecken

Bei `workflow_dispatch` startet GitHub Actions standardmäßig auf dem Default-Branch, während die Eingabe nur `version: v0.5.76` lautet. Ein Workflow, der diese Eingabe lediglich als Dateinamen verwendet, könnte Code vom falschen Commit als `v0.5.76` veröffentlichen.

**Verbindliche Korrektur:** `validate` muss:

1. die Eingabe auf `^v[0-9]+\\.[0-9]+\\.[0-9]+$` prüfen,
2. bei manuellen Runs per `git ls-remote --exit-code origin "refs/tags/$VERSION"` prüfen, dass der Tag existiert,
3. den Tag-SHA auslesen,
4. als Output `source_ref=$VERSION` und `source_sha=<sha>` setzen,
5. alle Folgejobs mit `actions/checkout` auf `ref: ${{ needs.validate.outputs.source_ref }}` auschecken,
6. vor dem Release verifizieren, dass `git rev-parse HEAD` dem validierten SHA entspricht.

Ein manueller Run erzeugt damit kein Release aus dem aktuellen `master`, nur weil der Bediener einen Versionsstring eingetragen hat.

## 27.12 Release-Risiko: `electron-builder` darf nicht selbst veröffentlichen

Die Electron-Konfiguration kann einen GitHub-Publish-Provider enthalten. Wenn Packaging- und Release-Job gleichzeitig veröffentlichen dürfen, entstehen:

- doppelte Uploads,
- teilweise veröffentlichte Releases,
- schwer nachvollziehbare Retry-Zustände,
- unnötige Schreibrechte im Build-Job.

**Verbindliche Korrektur:**

```text
electron-builder --win --publish never
```

Der Windows-Job erhält nur `contents: read`. Ausschließlich der zentrale `release`-Job erhält `contents: write` und lädt die bereits geprüften Dateien hoch. Die `publish`-Konfiguration wird entweder weggelassen oder ausdrücklich so dokumentiert, dass sie im CI nicht aktiviert wird.

## 27.13 Widerspruch geschlossen: Updater zunächst deaktiviert

Der vorherige Entwurf verlangte gleichzeitig `latest.yml`/Blockmap und beschrieb Auto-Updates als späteres Feature. Das ist für Release 1 inkonsistent.

**Verbindliche Release-1-Entscheidung:**

```text
kein electron-updater
kein Auto-Download
keine Pflicht auf latest.yml
keine Blockmap-Abnahme
```

Release 1 veröffentlicht:

```text
9Router.Setup.<version>.exe
9Router.<version>.portable.exe oder 9Router.exe
SHA256SUMS.json
```

Erst Release 2 aktiviert `electron-updater`, signierte Artefakte, `latest.yml`, Blockmap-Prüfung und einen Test gegen einen separaten Test-Release. Wenn der Updater aktiviert wird, muss das Manifest den final signierten Installer referenzieren; der Hash wird nach Signing berechnet.

## 27.14 Release-Risiko: Portable-Dateiname nicht durch „erste EXE außer Setup“ bestimmen

Ein Glob wie „kopiere die erste `.exe`, die nicht `Setup` enthält“ ist nicht stabil. Electron Builder kann zusätzliche EXEs, Uninstaller oder Hilfsdateien erzeugen; Dateisystem-Reihenfolge ist kein Release-Vertrag.

**Verbindliche Korrektur:** Den Portable-Artifact-Namen explizit konfigurieren:

```json
"portable": {
  "artifactName": "9Router.${version}.portable.${ext}"
}
```

Danach wird exakt diese Datei geprüft und umbenannt bzw. unverändert veröffentlicht. Kein „first match“-Glob mehr.

## 27.15 Release-Risiko: `latest.yml` wird nicht implizit als korrekt angenommen

Falls der Updater später aktiviert wird, muss CI nicht nur auf den Dateinamen prüfen. Es muss YAML parsen und validieren:

```text
version == package version
path == tatsächlich vorhandener Installer
sha512/size == finaler Installer
```

Eine beliebige `latest.yml`-Datei oder ein beliebiges `.exe`-Asset ist kein Beweis für ein funktionierendes Update.

## 27.16 Security-Gap: Electron-IPC und lokale Origin

Der bisherige Entwurf nennt `preload.js`, definiert aber noch keine harten Sicherheitsparameter.

**Verbindliche Korrektur:**

```text
contextIsolation: true
nodeIntegration: false
sandbox: true, sofern mit der App kompatibel
webSecurity: true
```

Der Renderer darf nur eine eng begrenzte IPC-Whitelist erhalten, etwa `getStatus`, `openDataDir`, `requestQuit`, `toggleStartAtLogin`. Keine generische `execute`-/Shell-IPC-API. Navigationsversuche auf fremde Origins werden blockiert; nur `http://127.0.0.1:<port>` darf geladen werden. Externe Links werden über `shell.openExternal` nach expliziter URL-Validierung geöffnet.

## 27.17 Security-Gap: lokale Bind-Adresse muss Desktop-spezifisch erzwungen werden

Die CLI hat standardmäßig `0.0.0.0` und warnt vor Netzwerk-Exposition. Für einen Desktop-Installer ist das kein sicherer Default.

**Verbindliche Korrektur:** Der Electron-Main-Prozess setzt unabhängig von der Shell-Umgebung:

```text
HOSTNAME=127.0.0.1
```

Ein späterer Remote-Modus muss eine sichtbare Einstellung, eine Bestätigung und eine eigene Auth-/Firewall-Abnahme haben. `HOSTNAME` darf nicht ungeprüft aus einer globalen Benutzerumgebung übernommen werden.

## 27.18 Release-Risiko: Datenpfad und installierter Programmordner müssen getrennt bleiben

`src/mitm/paths.js` verwendet unter Windows `%APPDATA%\\9router`; der Installer darf daher keine Datenbank, Zertifikate, Logs oder PID-Dateien unter `Program Files` anlegen.

**Verbindliche Korrektur:**

```text
Programmcode: resources/app und Electron-Installationspfad
Daten:        %APPDATA%\\9router
Logs:         %APPDATA%\\9router\\logs
Runtime:      Release-1-Server ohne Runtime-npm-Install
```

Der Smoke-Test muss den Datenpfad explizit auf ein temporäres Verzeichnis setzen und nach dem Lauf prüfen, dass kein schreibpflichtiger Zustand im Installationsverzeichnis angelegt wurde.

## 27.19 Build-Risiko: Native SQLite muss im finalen Bundle, nicht nur im Root, getestet werden

Das Root-Package führt `better-sqlite3` als optionale Dependency mit `^12.6.2`; die CLI-Runtime pinnt abhängig vom Node-Major teils andere Versionen. Diese beiden Strategien dürfen nicht unbewusst vermischt werden.

**Verbindliche Release-1-Entscheidung:**

```text
sql.js ist der verpflichtende, offline verfügbare Fallback.
better-sqlite3 ist optional.
Desktop-Smoke akzeptiert beide nur nach echtem Load-Test.
```

Der Prepare-Schritt protokolliert:

```text
chosenDriver = better-sqlite3 | sql.js
```

und bricht ab, wenn `sql.js` oder `sql-wasm.wasm` fehlt. Ein erfolgreiches `require("better-sqlite3")` im Root reicht nicht; der Test muss aus `resources/app` bzw. dem Staging-Tree erfolgen.

## 27.20 Build-Risiko: MITM-Bundle und Desktop-Server sind verschiedene Entry Points

`cli/scripts/buildMitm.js` bundelt `src/mitm/server.js` separat, minifiziert und entfernt die Plain-Dateien. Das ist nicht dasselbe wie der Next.js-Server. Wenn MITM später unterstützt wird, muss der Desktop-Prepare-Aufruf den MITM-Build mit einem expliziten Ziel ausführen, zum Beispiel:

```text
NINEROUTER_CLI_APP_DIR=<electron-standalone>/src/mitm-output
node cli/scripts/buildMitm.js
```

Ein bloßes Kopieren von `src/mitm` liefert die CLI-/Source-Struktur, aber nicht automatisch den selbständigen Bundle-Entry.

**Release-1-Entscheidung:** MITM-Code wird nicht als startfähiges Feature versprochen. Release 2 ergänzt eine dedizierte `mitm-desktop`-Build-/UAC-Testmatrix.

## 27.21 Build-Risiko: CI-Action-Versionen und Supply Chain

Der ursprüngliche Entwurf verwendete bewegliche `@v4`-Tags. Für eine öffentlich verteilte Installer-Pipeline ist das eine Supply-Chain-Risikoquelle.

**Verbindliche Korrektur:** Vor produktiven Releases:

- Actions auf konkrete Commit-SHAs pinnen,
- Dependabot-/Renovate-Updates reviewen,
- `zizmor` und `actionlint` ausführen,
- `permissions` auf Job-Ebene minimal halten,
- keine Secrets in Build-Jobs, die sie nicht brauchen,
- Artifact-Download mit exaktem Namen und `if-no-files-found: error`.

Die Research schreibt bewusst keine erfundenen SHAs vor; sie müssen beim Implementieren aus den dann verwendeten offiziellen Action-Releases ermittelt und dokumentiert werden.

## 27.22 Release-Risiko: Signatur-/Hash-Reihenfolge

Ein Signatur- oder Hash-Schritt nach dem Upload ist falsch. Die verbindliche Reihenfolge ist:

```text
Electron-Build
→ optionales Authenticode-Signing
→ Signaturprüfung
→ SHA-256 und SHA512SUMS erzeugen
→ Actions-Artefakt hochladen
→ Release-Job lädt exakt diese Dateien hoch
→ Release-API verifizieren
```

Für Release 1 ist ein unsignierter Test-Release technisch möglich, aber kein als Endnutzer-Release zu bezeichnender Produktionsrelease. Vor der ersten öffentlichen Distribution sollte Signing als Release-Gate aktiviert werden.

## 27.23 Verifiziertes Gap-Audit-Ergebnis

Die ursprüngliche Architektur war in der Richtung richtig, aber folgende Punkte waren offen oder fehlerhaft und sind jetzt geschlossen:

| Punkt | Status nach Audit |
|---|---|
| Cross-Job-`.next`-Übertragung | geschlossen: Windows baut in Phase 1 selbst |
| Lockfile-Reproduzierbarkeit | geschlossen: Lockfiles sind Vorbedingung |
| Health-URL | geschlossen: `/api/health` ist die belegte URL |
| `/v1/models` ohne Auth | geschlossen: kein Readiness-Gate |
| Runtime-`npm install` | geschlossen: Desktop verwendet keine CLI-Selbstheilung |
| MITM/UAC/Port 443 | geschlossen: Release 1 deaktiviert, Release 2 eigener Test |
| PowerShell-Tray-Duplikat | geschlossen: Electron Tray allein |
| falscher Ref bei Dispatch | geschlossen: Tag-SHA wird validiert und ausgecheckt |
| Builder-Doppelupload | geschlossen: `--publish never`, Release-Job allein schreibt |
| Updater-Widerspruch | geschlossen: Updater in Release 1 deaktiviert |
| instabiler Portable-Glob | geschlossen: expliziter `artifactName` |
| externe/dynamische Module | geschlossen: finaler Staging-Load-Test |
| IPC-/Loopback-Sicherheit | geschlossen: harte Electron-Sicherheitsdefaults |
| Signing-/Hash-Reihenfolge | geschlossen: Hash nach Signing |

---

# 28. Korrigierter, implementierbarer Release-1-Plan

## 28.1 Release-1-Scope

Release 1 liefert ausschließlich:

```text
Windows x64
NSIS Installer
Portable EXE
lokaler eingebetteter Next.js-Server
Electron Tray/Window
SQLite-Fallback ohne Internetzugriff beim Start
kein MITM-Autostart
kein Auto-Updater
```

Nicht Teil von Release 1:

```text
macOS/Linux Builds
Shared-Standalone-Tarball
MITM-Port-443-Aktivierung
Windows-Authenticode als optionales Nice-to-have
Auto-Update
NPM-Runtime-Selbstinstallation
```

Die letzten drei Punkte dürfen in der Produktkommunikation nicht als vorhanden dargestellt werden, solange die jeweiligen Gates nicht implementiert sind.

## 28.2 Exakte Build-Reihenfolge

```text
1. validate: Tagformat, Tagexistenz, Tag-SHA, Versionsgleichheit
2. quality: lockfile-basierte Installation + Lint + Root-Build
3. package-windows:
   a. exakt validierten Tag auschecken
   b. Root-Lockfile prüfen
   c. npm ci
   d. Root npm run build auf Windows
   e. prepare-electron-standalone.mjs
   f. finalen Staging-Tree prüfen
   g. electron npm ci
   h. Electron-Version temporär setzen
   i. electron-builder --win --publish never
   j. win-unpacked starten und /api/health pollen
   k. Shutdown/Port/Prozessbaum prüfen
   l. finale Installer/Portable-Dateien signieren, falls Release-Gate aktiv
   m. finale Hashes erzeugen
   n. Actions-Artefakt hochladen
4. release: genaues Artifact herunterladen und GitHub Release erstellen
5. verify-release: Release-API, Namen, Größen, Hashmanifest und Download prüfen
```

## 28.3 Korrigierte zentrale Workflow-Regeln

```yaml
permissions:
  contents: read

jobs:
  package-windows:
    permissions:
      contents: read

  release:
    permissions:
      contents: write
```

Der Windows-Job enthält ausdrücklich:

```yaml
- name: Build server on Windows
  run: npm run build
```

und nicht nur einen Verweis auf den Build eines anderen Jobs. Der Builder wird mit:

```yaml
npm run build:win -- --publish never
```

oder gleichwertig mit einer im Script fest verankerten `--publish never`-Option ausgeführt.

## 28.4 Verbindliche Prepare-Assertions

`prepare-electron-standalone.mjs` beendet sich mit Exit-Code 1, wenn einer der folgenden Punkte fehlt:

```text
custom-server.js
server.js
package.json
.next/static
public
node_modules/next
node_modules/sql.js/index.js oder package.json
node_modules/sql.js/dist/sql-wasm.wasm
node_modules/open/package.json
node_modules/node-machine-id/package.json
node_modules/node-forge/package.json
node_modules/selfsigned/package.json
```

Es darf kein Symlink aus dem finalen Bundle auf einen Pfad außerhalb des Staging-Verzeichnisses zeigen. Alle Pfade werden mit `realpath` geprüft und gegen die Staging-Root validiert.

## 28.5 Verbindliche Runtime-Assertions

Vor dem Packaging:

```text
load sql.js aus dem Staging-Tree
prüfe sql-wasm.wasm
load open aus dem Staging-Tree
load node-machine-id aus dem Staging-Tree
```

Nach dem Packaging:

```text
starte resources/app/custom-server.js über Electron-Node
GET /api/health → 200, {ok:true}
GET /dashboard oder stabile Root-UI → 200/erwartete Navigation
beende Electron
Port 20128 geschlossen
kein Server-Kindprozess übrig
```

Die Tests verwenden keine Provider-Credentials und schreiben nur in temporäre CI-Datenpfade.

## 28.6 Verbindlicher Release-1-Dateivertrag

```text
9Router.Setup.<version>.exe
9Router.<version>.portable.exe
SHA256SUMS.json
build-metadata.json
```

`build-metadata.json` enthält mindestens:

```json
{
  "repository": "jahdaganj00ki-eng/9router",
  "tag": "v0.5.76",
  "commit": "<validated sha>",
  "version": "0.5.76",
  "platform": "win32",
  "arch": "x64",
  "nodeMajor": 22,
  "electronVersion": "<actual version>",
  "mitm": "disabled",
  "updater": "disabled"
}
```

Das Manifest darf keine Secrets, Tokens, absoluten Runnerpfade oder Benutzerpfade enthalten. Die Hashes werden erst nach allen finalen Dateiänderungen erzeugt.

## 28.7 Release-Verifikation muss Dateien und Inhalt prüfen

Der Verify-Job prüft nicht nur reguläre Ausdrücke, sondern:

1. lädt die Release-Asset-Liste,
2. verlangt exakt Installer, Portable, SHA-Manifest und Build-Metadaten,
3. lädt Installer/Portable/Manifest herunter,
4. berechnet SHA-256,
5. vergleicht gegen `SHA256SUMS.json`,
6. prüft `build-metadata.commit` gegen den validierten Tag-SHA,
7. prüft, dass kein `latest.yml` behauptet wird, solange der Updater deaktiviert ist.

Damit wird ein Release mit zufälligem `.exe`-Asset oder stale Manifest verhindert.

---

# 29. Offene Punkte, die nicht vortäuschend geschlossen werden dürfen

Die folgenden Punkte brauchen eine echte Implementierung oder einen echten Windows-Lauf; Quelltextanalyse allein kann sie nicht abschließend beweisen:

1. **Electron-Version gegen die aktuelle Node-/Next-Version:** Die vorgeschlagene Electron-Version muss festgelegt, gelockt und auf `windows-latest` tatsächlich getestet werden.
2. **Finale `electron-builder`-Filter:** Die genaue `extraResources`-Konfiguration muss nach dem ersten `--dir`-Build anhand des realen Output-Baums korrigiert werden.
3. **Next-16-Standalone-Layout:** Das tatsächliche Layout des Tag-Commits muss in CI inspiziert werden; der Plan darf nicht nur mögliche Layouts aufzählen.
4. **Dynamische Serverimports:** Jeder Import, der im Root-Build funktioniert, muss aus dem finalen `resources/app`-Tree geprüft werden.
5. **SQLite-Treiberwahl:** Es muss ein echter Test zeigen, ob `better-sqlite3` mit Electron-Node funktioniert. Falls nicht, bleibt `sql.js` der offizielle Treiber.
6. **Windows SmartScreen:** Nur ein signiertes, veröffentlichtes Artefakt kann die praktische Warnsituation messen.
7. **MITM:** UAC, Root-CA-Trust, Hosts-Datei, Port-443-Konflikte und Cleanup benötigen einen isolierten manuellen/Windows-Test; sie sind nicht Teil des normalen Release-1-Gates.
8. **Installer-Upgrade/Uninstall:** Ein echter Test muss prüfen, ob `%APPDATA%\\9router` bei Upgrade/Deinstallation erhalten bleibt.
9. **Antivirus/EDR:** Keine Repository-Analyse kann garantieren, dass jedes Endpoint-Produkt die EXE akzeptiert.
10. **Offline-Erststart:** Muss auf einem Windows-Testsystem ohne Registryzugriff/Internet ausgeführt werden; der CI-Smoke sollte mindestens `npm`- und Updater-Zugriffe aus dem Desktop-Prozess ausschließen.

Diese Punkte sind jetzt als **bewusste Abnahmeaufgaben** markiert, statt fälschlich als bereits gelöst zu gelten.

---

# 30. Aktualisierte Abnahmematrix

| Gate | Muss in Release 1 grün sein? | Nachweis |
|---|---:|---|
| Tag-Syntax und Tag-SHA | Ja | `validate`-Joboutput |
| Root/CLI/Tag-Version identisch | Ja | JSON-Prüfung |
| Root-Lockfile vorhanden | Ja | `npm ci` |
| Windows eigener Root-Build | Ja | Joblog + `.next`-Assertions |
| `custom-server.js` im finalen Bundle | Ja | Prepare-Manifest |
| `server.js` und static/public | Ja | Prepare-Manifest |
| `sql.js` plus WASM | Ja | finaler Load-Test |
| `open`, `node-machine-id`, `node-forge`, `selfsigned` | Ja | finaler Load-Test |
| Symlink außerhalb Staging | Nein | Symlink-Scan |
| NSIS x64 | Ja | electron-builder Output |
| Portable x64 | Ja | expliziter Artifact-Name |
| `/api/health` 200 | Ja | Windows packaged smoke |
| Loopback-Bindung | Ja | Port-/Socketprüfung |
| Prozessbaum-Shutdown | Ja | PID-/Portprüfung |
| Provider-Secrets nötig | Nein | CI-Konfiguration |
| Runtime-`npm install` | Nein | Offline-/Netzwerkprüfung |
| MITM-Port 443 automatisch | Nein | Desktop-Default |
| Auto-Updater | Nein in Release 1 | Metadaten + Asset-Schema |
| SHA-256 nach finalem Build | Ja | `SHA256SUMS.json` |
| Release-API-Verifikation | Ja | `verify-release` |
| Authenticode | Vor öffentlichem Endnutzerrelease | `signtool verify` |
| Upgrade/Uninstall-Erhaltung | Vor Produktionsfreigabe | Windows-Testmatrix |

---

# 31. Endgültige korrigierte Empfehlung

Die korrigierte Empfehlung lautet nicht „OmniRoute möglichst vollständig kopieren“, sondern:

```text
9Router-Root-Build auf Windows reproduzierbar machen
  → Standalone-Tree aus dem tatsächlichen Tag erzeugen
  → alle dynamischen/externalisierten Assets im finalen Tree beweisen
  → Electron als einzige Desktop-Shell verwenden
  → Desktop ohne CLI-Selbstinstallation und ohne MITM-Autostart starten
  → /api/health als belegten Readiness-Gate testen
  → NSIS + explizit benannte Portable-Datei bauen
  → optional signieren, danach hashen
  → nur den zentralen Release-Job schreiben lassen
  → Release-Assets inhaltlich verifizieren
```

Damit sind die wesentlichen offenen Punkte aus dem ursprünglichen Plan entweder technisch geschlossen oder sauber als reale Implementierungs-/Abnahmeaufgaben markiert. Der wichtigste Korrekturpunkt ist der Windows-eigene Root-Build: Ohne ihn war der vorherige Workflow kein vollständig ausführbarer Plan, weil Build-Ausgaben zwischen GitHub-Actions-Jobs nicht automatisch vorhanden sind.

---

# 32. Dritter Audit: Erststart, Authentifizierung und Dokumentationsverträge

## 32.1 Kritischer Erststartbefund: Login-Default `123456`

Die aktuelle Login-Route enthält folgende Logik:

```text
kein gespeicherter Passwort-Hash
  → INITIAL_PASSWORD verwenden
  → falls nicht gesetzt: 123456
```

Die Route stellt bei einem lokalen Request trotz Default-Passwort eine Session aus. Die besondere Blockade betrifft den Remote-Zugriff, nicht den lokalen Erststart. Für ein Desktop-Programm ist das zwar loopback-begrenzt, aber trotzdem kein guter Installationsvertrag: Ein Benutzer kann den Installer ausführen und erhält nicht automatisch eine sichere, dokumentierte Einrichtung.

Zusätzlich prüft `src/app/api/settings/route.js` beim erstmaligen Setzen eines Passworts derzeit gegen den hart codierten Wert `123456`, wenn noch kein Hash existiert. Eine zufällig vom Electron-Launcher gesetzte `INITIAL_PASSWORD` wäre mit diesem Pfad nicht automatisch kompatibel.

**Verbindliche Korrektur — kein zufälliger Passwortmechanismus ohne Serveränderung:**

Release 1 erhält einen expliziten Desktop-Erststartvertrag:

1. Electron setzt `NINEROUTER_DESKTOP=1`.
2. Der Server akzeptiert beim ersten lokalen Login weiterhin den vorhandenen Initialwert.
3. Die Login-Antwort enthält im Desktop-Erststart einen eindeutigen `mustChangePassword`-Status.
4. Die Desktop-Oberfläche erzwingt vor dem normalen Dashboard die Passwortänderung.
5. Die Settings-Route akzeptiert beim ersten Passwortwechsel den tatsächlich konfigurierten Initialwert (`process.env.INITIAL_PASSWORD`) und nicht nur `123456`.
6. Nach erfolgreichem Passwortwechsel wird der Hash in der DB gespeichert; der Initialwert wird nicht mehr als gültiger Fallback verwendet.
7. Der Desktop-Main-Prozess entfernt `INITIAL_PASSWORD` aus dem Environment erst nach einem Server-Neustart oder startet den Server nach erfolgreichem Onboarding kontrolliert neu.

Alternativ darf der Installer vor dem ersten Start einen kryptografisch zufälligen Initialwert erzeugen und ihn **einmalig in einem lokalen Onboarding-Fenster** anzeigen. Dann muss die Settings-Route genau diesen Wert als `currentPassword` akzeptieren. Ein zufälliges Environment allein, das der Benutzer nie sehen kann, ist kein gültiger Plan.

**Abnahme:** Ein sauberer Erststart darf nicht mit einem dauerhaft unkommunizierten Default-Passwort enden. Der Test muss prüfen:

```text
frische DATA_DIR
→ Erststart
→ Login/Onboarding
→ Passwortwechsel
→ App-Neustart
→ alter Initialwert abgewiesen
→ neues Passwort akzeptiert
```

## 32.2 JWT-Secret: vorhandene Selbstgenerierung explizit nutzen

`src/lib/auth/dashboardSession.js` erzeugt bereits ein JWT-Secret unter:

```text
%APPDATA%\\9router\\jwt-secret
```

wenn `JWT_SECRET` nicht gesetzt ist. Das ist für Desktop besser als ein im Installer eingebettetes Secret.

**Verbindliche Korrektur:** Der Desktop-Launcher setzt kein festes JWT-Secret in der EXE. Er verwendet entweder:

```text
kein JWT_SECRET → serverseitige Datei-Selbstgenerierung
```

oder einen einmalig generierten Wert außerhalb des Programmordners. Die Datei muss im benutzerspezifischen Datenverzeichnis liegen und bei Upgrades erhalten bleiben. Der CI-Smoke darf dagegen ein ephemeres CI-Secret setzen, damit Testläufe isoliert bleiben.

## 32.3 `DATA_DIR` muss aus dem Desktop-Launcher stammen

`src/lib/dataDir.js` verwendet unter Windows `%APPDATA%\\9router`, ignoriert aber Unix-artige absolute Pfade auf Windows und fällt dann auf den Default zurück. Das ist ein sinnvoller Schutz gegen eine Linux-Docker-Konfiguration im Benutzerumfeld.

**Verbindliche Korrektur:** Electron setzt für den Server:

```text
DATA_DIR=%APPDATA%\\9router
```

nur wenn kein expliziter, vom Benutzer bestätigter alternativer Pfad existiert. Der Pfad wird in `main.js` mit `app.getPath("appData")` konstruiert, nicht aus einer frei interpolierten Shell-Zeichenkette. Das Staging-/Installationsverzeichnis wird nie als Datenverzeichnis verwendet.

## 32.4 Dokumentations-Gap: `/health`, Port 3000 und `/api/health`

Die aktuelle Dokumentation ist nicht konsistent mit dem Quellcode:

- `src/app/api/health/route.js` stellt `/api/health` bereit.
- README und Installationsdokumentation nennen teilweise `/health`.
- Eine Localhost-Seite nennt für das Dashboard Port 3000, während der aktuelle CLI-/App-Vertrag Port 20128 verwendet.
- Das README beschreibt globale npm-Installation, während der Root-Workspace privat ist und die Desktop-App ein anderes Produkt ist.

**Verbindliche Korrektur:** Vor dem ersten Desktop-Release müssen README und GitBook-Dokumentation einen einzigen Desktop-Vertrag dokumentieren:

```text
Dashboard: http://127.0.0.1:20128/dashboard
Readiness: http://127.0.0.1:20128/api/health
API:       http://127.0.0.1:20128/v1
Data:      %APPDATA%\\9router
```

Die alten `/health`- und Port-3000-Beispiele werden entweder korrigiert oder ausdrücklich als veraltete Dokumentation entfernt. Ein Docs-Consistency-Gate soll die verifizierten Pfade gegen den Quellbaum prüfen.

## 32.5 Dashboard-URL nicht raten

Der CLI-Code verwendet `/dashboard`, während Dokumentationsbeispiele auch die Root-URL nennen. Electron darf nicht blind eine URL laden und einen erfolgreichen HTTP-Status mit einer funktionierenden UI verwechseln.

**Verbindliche Korrektur:** Der Starttest verwendet zwei getrennte Prüfungen:

```text
/api/health → Readiness des Servers
/dashboard  → Desktop-Navigationsziel
```

Der Renderer lädt erst nach erfolgreichem Health-Gate die Dashboard-URL. Bei Fehlern zeigt die Electron-Hülle einen lokalen, nicht vom Server abhängigen Fehlerbildschirm mit Log-/Retry-Aktion.

---

# 33. Vierter Audit: Node-, Electron- und Native-ABI-Vertrag

## 33.1 Node-Version ist aktuell nicht als Repository-Vertrag festgeschrieben

Die Installationsdokumentation sagt Node 20+, das Root-Package hat keinen eindeutigen `engines`-Vertrag, und die vorgeschlagene Workflow-Datei verwendete Node 22. Für den System-Node-Build ist das nicht ausreichend reproduzierbar.

**Verbindliche Korrektur:** Vor der ersten Release-Tag-Erstellung werden:

```text
engines.node im Root package.json
engines.npm im Root package.json, sofern erforderlich
.node-version oder .nvmrc
NODE_VERSION im Workflow
```

auf denselben unterstützten Node-LTS-Patchstand gebracht. Die konkrete Patchversion wird nicht aus OmniRoute übernommen, sondern aus dem tatsächlich validierten 9Router-Build festgelegt und im Commit gespeichert. Ein Workflow mit `22.x` ohne Repository-Pin gilt nicht als vollständig reproduzierbar.

## 33.2 System-Node und Electron-Node sind getrennte Laufzeiten

Der Root-Build läuft unter dem GitHub-Node. Der eingebettete Server läuft später entweder:

```text
Electron-Prozess mit ELECTRON_RUN_AS_NODE=1
```

oder als separater mitgelieferter Node-Runtime-Prozess. Diese Laufzeiten dürfen nicht verwechselt werden. Ein Native-Addon-Test im Root-Node beweist nicht, dass dasselbe Modul unter Electron funktioniert.

**Verbindliche Korrektur:** Der finale Windows-Smoke startet den Server über genau dieselbe Methode wie die installierte App. Zusätzlich gibt es einen kleinen Child-Runtime-Diagnosetest:

```text
process.execPath des gepackten Electron
→ ELECTRON_RUN_AS_NODE=1
→ custom-server.js
→ /api/health
```

Wenn `better-sqlite3` unter Electron nicht lädt, ist das kein Packaging-Fehler, solange der dokumentierte `sql.js`-Fallback erfolgreich initialisiert und persistente Daten lesen/schreiben kann.

## 33.3 `better-sqlite3` darf nicht still als Pflichtdependency gelten

Das Root-Package führt `better-sqlite3` optional mit einer Version aus dem 12er-Zweig. Die CLI-Runtime verwendet eine andere Versionsentscheidung abhängig vom Node-Major. Das ist für das Desktop-Bundle zu ambig.

**Verbindliche Release-1-Entscheidung:**

```text
Desktop-Pflicht: sql.js + sql-wasm.wasm
Desktop-Optional: better-sqlite3
Keine Laufzeitinstallation
Kein node-gyp auf dem Benutzerrechner
```

Die DB-Abstraktion muss beim Start den gewählten Driver protokollieren. Der Smoke testet mindestens eine echte Migration/Schreib-/Leseoperation im temporären Datenverzeichnis. Ein bloßes Modul-`require()` reicht nicht.

## 33.4 `sharp`-/Bild-Dependencies nicht ohne Output-Inspektion ausschließen

Der CLI-Assembler schließt `@img`, `sharp` und `detect-libc` explizit aus, weil die CLI unoptimierte Bilder nutzt. Der Desktop-Installer darf diese Regel nicht ungeprüft übernehmen: Next-/React-Builds können in einem anderen Tag oder bei späterer Konfiguration Bildoptimierung aktivieren.

**Verbindliche Korrektur:** `prepare-electron-standalone.mjs` liest den realen Standalone-Tree und entfernt nur Dependencies, die durch einen finalen Smoke-/Import-Scan als unbenötigt belegt sind. Keine statische Ausschlussliste ohne Test. Bei `images.unoptimized=true` kann die Entfernung als optimierte Variante erlaubt werden, aber das muss als Build-Assertion geprüft werden.

---

# 34. Fünfter Audit: Installer-, Upgrade- und Deinstallationsverhalten

## 34.1 Installationsmodus muss explizit entschieden werden

Ein NSIS-Installer kann je nach electron-builder-Konfiguration per Benutzer oder maschinenweit installiert werden. Das beeinflusst:

- UAC beim Installieren,
- Programmordner,
- Shortcut-Ziele,
- Zugriffsrechte,
- Upgrade-Verhalten,
- mehrere Windows-Benutzer.

**Verbindliche Release-1-Entscheidung:** Per-user-Installation ohne erhöhte Rechte, sofern die Produktanforderung keine systemweite Installation verlangt. Der Datenpfad bleibt immer benutzerbezogen. Falls `Program Files`/per-machine gewünscht ist, wird das als bewusste Variante mit eigenem UAC- und Multi-user-Test dokumentiert; es darf nicht implizit vom Builderdefault abhängen.

## 34.2 Daten bei Deinstallation erhalten

Der Server schreibt Credentials, API-Keys, SQLite-Daten, Logs und gegebenenfalls MITM-Zustand nach `%APPDATA%\\9router`. Ein Uninstaller darf diese Daten nicht versehentlich löschen.

**Verbindliche Builder-Regel:**

```text
deleteAppDataOnUninstall: false
```

Der Upgrade-/Uninstall-Test prüft:

```text
Install v0.5.76
→ Daten erzeugen
→ Upgrade auf v0.5.77
→ Daten vorhanden
→ Deinstallieren
→ Programmdateien entfernt
→ %APPDATA%\\9router weiterhin vorhanden
```

Ein separater „Daten vollständig löschen“-Befehl kann später als explizite Benutzeraktion implementiert werden.

## 34.3 Laufende Prozesse vor Upgrade/Uninstall

Ein laufender Electron-Main-Prozess, Child-Server oder Tray-Prozess kann Dateien sperren. Das muss als Installer-Verhalten getestet werden.

**Verbindliche Korrektur:** `main.js` implementiert eine idempotente Shutdown-Funktion; sie beendet:

```text
BrowserWindow
→ Electron Tray
→ Next/custom-server child
→ alle bekannten Child-Prozesse
```

Der Packaged-Smoke prüft nach Quit sowohl Port 20128 als auch Prozessbaum. Der Upgrade-Test wird einmal mit laufender App und einmal nach normalem Quit ausgeführt. Falls NSIS bei laufender App nicht sicher schließen kann, muss der Installer den Benutzer sichtbar zum Beenden auffordern statt Prozesse unkontrolliert zu löschen.

## 34.4 Single-instance und Portkonflikt

Die CLI räumt bestehende Prozesse aggressiv auf. Electron darf nicht beim Start beliebige Prozesse anhand eines Namens oder Ports beenden, weil dadurch fremde Anwendungen beschädigt werden können.

**Verbindliche Korrektur:**

- `app.requestSingleInstanceLock()` verwenden.
- Bei zweiter Instanz die erste Instanz fokussieren.
- Nur den eigenen Child-PID und dessen kontrollierte Nachfahren beenden.
- Wenn Port 20128 belegt ist, eine verständliche Fehlermeldung anzeigen.
- Nicht automatisch einen fremden Prozess auf dem Port beenden.
- Optional einen freien Port nur nach expliziter Produktentscheidung wählen; der Default bleibt stabil, weil API-Clients ihn erwarten.

---

# 35. Sechster Audit: Release- und Provenance-Vertrag

## 35.1 Tag muss vor dem Build unveränderlich aufgelöst werden

Ein Tagname allein reicht nicht. Force-pushes oder ein beweglicher Tag können dazu führen, dass `validate`, `package-windows` und `release` unterschiedliche Commits verwenden.

**Verbindliche Korrektur:** `validate` schreibt in seine Outputs:

```text
source_ref
source_sha
version
```

Jeder Folgejob checkt `source_sha` detached aus oder verifiziert nach Checkout:

```text
git rev-parse HEAD == source_sha
```

Der Release-Job schreibt `source_sha` in `build-metadata.json`. Ein nachträglich verschobener Tag wird durch die Asset-Metadaten erkennbar.

## 35.2 Release-Job darf keine unvollständigen Artifacts veröffentlichen

`fail_on_unmatched_files` schützt nur gegen fehlende Glob-Matches. Es beweist nicht, dass die Dateien zusammengehören.

**Verbindliche Korrektur:** Das Actions-Artefakt enthält genau:

```text
9Router.Setup.<version>.exe
9Router.<version>.portable.exe
SHA256SUMS.json
build-metadata.json
```

Der Release-Job:

1. prüft exakte Dateinamen,
2. prüft Versionsgleichheit in Dateinamen, Package und Metadata,
3. prüft Plattform/Architektur in Metadata,
4. prüft Hashmanifest lokal,
5. veröffentlicht erst danach.

## 35.3 GitHub-Release-Reruns idempotent machen

Ein fehlgeschlagener Verify-Job nach erfolgreichem Upload darf nicht bei jedem Retry unkontrolliert weitere Assets anhängen.

**Verbindliche Korrektur:**

- Concurrency pro Tag mit `cancel-in-progress: false`.
- Vor dem Upload Release-Status und vorhandene Assets lesen.
- Entweder einen Draft-Release erzeugen und erst nach Verifikation veröffentlichen, oder bei Retry exakt gleichnamige Assets ersetzen und die Asset-Liste erneut prüfen.
- Keine automatische Veröffentlichung aus einem anderen Tag.

Für Release 1 ist ein **Draft-Release bis nach Verify** sicherer als `draft: false` unmittelbar beim ersten Upload. Wenn die GitHub-Action diese Zweistufigkeit nicht sauber unterstützt, wird der Release-Job in Upload und Finalize getrennt.

## 35.4 Build-Metadaten dürfen keine Pfade oder Secrets enthalten

Das Metadatenfile muss forensisch nützlich sein, darf aber keine Runner- oder Benutzerpfade leaken.

**Erlaubte Felder:**

```text
repository
source_sha
tag
version
platform
arch
electron_version
node_build_version
sqlite_driver
mitm
updater
signed
```

**Verbotene Felder:**

```text
RUNNER_TEMP
GITHUB_WORKSPACE
USERPROFILE
DATA_DIR mit absolutem Pfad
JWT_SECRET
INITIAL_PASSWORD
API keys
```

## 35.5 Signing als harte Produktionsentscheidung

Die vorherige Matrix markierte Authenticode nur als Vorbedingung „vor öffentlichem Endnutzerrelease“, während der eigentliche Release-Plan einen unsignierten Release zuließ. Das ist widersprüchlich.

**Verbindliche Entscheidung:**

```text
CI-Prototyp: unsigniert erlaubt, nicht als Endnutzerrelease markieren
Produktionsrelease: Signaturprüfung ist blockierend
```

Ohne Zertifikat darf der Workflow höchstens ein internes Actions-Artefakt oder einen ausdrücklich unsignierten Preview-Release erzeugen. Der öffentliche stabile Release-Job wird bei fehlendem Signing-Secret übersprungen oder als Preview gekennzeichnet.

## 35.6 SBOM und Third-Party-Lizenzen

Der Installer enthält Electron, Chromium, Next.js, Provider-/OAuth-Code, `sql.js`, `node-forge`, `selfsigned` und möglicherweise native Dependencies. Die bestehende Repository-Lizenz reicht nicht automatisch als Endnutzer-Lizenzinventar.

**Verbindliche Korrektur:** Vor Produktionsfreigabe:

- Third-Party-Notices/License-Asset im Release erzeugen,
- npm-Produktionsbaum aus dem tatsächlichen finalen Staging-Tree scannen,
- optional SPDX-/CycloneDX-SBOM veröffentlichen,
- keine DevDependencies oder Testdaten in den Installer aufnehmen.

Das schließt keine juristische Beratung ein, aber es verhindert, dass der Installer ohne nachvollziehbare Dependency-Herkunft veröffentlicht wird.

---

# 36. Final verfeinerter Implementierungsplan

## Phase 0 — Produkt- und Source-Vertrag

1. Root-/CLI-Version synchronisieren und Versionsprüfung einführen.
2. Root- und Electron-Lockfiles committen.
3. Node-LTS-Patchstand festlegen und per `.nvmrc`/`.node-version` sowie `engines` festschreiben.
4. Dokumentationspfade korrigieren: `/api/health`, `/dashboard`, Port 20128.
5. Desktop-Default festlegen: Loopback, MITM aus, Updater aus.
6. Erststart-/Passwortwechselvertrag implementieren.
7. Installer-Produktname, AppId, per-user/per-machine-Entscheidung und Datenbehandlung dokumentieren.

## Phase 1 — Server-Staging

1. Root-Build auf `windows-latest` ausführen.
2. `.next/standalone`, static, public und custom server lokalisieren.
3. Staging-Verzeichnis außerhalb des Installations- und Datenpfads erzeugen.
4. `open`, `sql.js`, WASM, `next`, `node-machine-id`, `node-forge`, `selfsigned` explizit prüfen/kopieren.
5. Symlinks außerhalb des Staging-Trees auflösen oder ablehnen.
6. `sql.js` aus dem finalen Tree laden und eine temporäre DB-Operation durchführen.
7. MITM nicht als aktivierbaren Startpfad einbinden; wenn Code mitgeliefert wird, als ungenutztes/gesperrtes Capability-Modul markieren.
8. Staging-Manifest ohne absolute Pfade erzeugen.

## Phase 2 — Electron-Shell

1. `electron/main.js` implementieren.
2. Server ausschließlich über `process.execPath` plus `ELECTRON_RUN_AS_NODE=1` starten.
3. `DATA_DIR` auf `%APPDATA%\\9router` setzen.
4. `HOSTNAME=127.0.0.1` erzwingen.
5. `requestSingleInstanceLock()` und kontrollierten Child-PID-Shutdown implementieren.
6. `BrowserWindow` mit `contextIsolation`, `nodeIntegration: false`, URL-Allowlist und IPC-Allowlist konfigurieren.
7. Electron-Tray verwenden; CLI-Tray/PowerShell nicht wiederverwenden.
8. Erststart-Onboarding und Passwortwechsel integrieren.

## Phase 3 — Packaging

1. Electron- und electron-builder-Version pinnen.
2. `nsis` und `portable` x64 konfigurieren.
3. Portable-Dateiname explizit festlegen.
4. `deleteAppDataOnUninstall: false` konfigurieren.
5. `--publish never` erzwingen.
6. `electron-builder --dir` als Struktur-Gate ausführen.
7. Danach NSIS-/Portable-Build ausführen.
8. Exakte Dateien und Architektur prüfen.

## Phase 4 — Windows-Tests

1. `/api/health` pollen.
2. `/dashboard` laden.
3. Erststart und Passwortwechsel testen.
4. Daten persistieren, App beenden, neu starten.
5. SQLite-Schreib-/Leseoperation prüfen.
6. Netzwerkzugriff von außen auf den Loopback-Server ablehnen.
7. Zweite App-Instanz fokussiert die erste.
8. Portkonflikt zeigt Fehler und beendet sich sauber.
9. Child-Prozess und Port nach Quit prüfen.
10. Upgrade- und Uninstall-Erhaltung prüfen.
11. Offline-Erststart ohne npm-/Updater-Zugriff prüfen.

## Phase 5 — GitHub Actions

1. Tag-SHA validieren.
2. Alle Jobs auf exakt diesen SHA auschecken.
3. Lockfile-basierte Installationen ausführen.
4. Root-Build im Windows-Package-Job selbst ausführen.
5. Actions-Artifact mit exakt vier Release-Dateien erzeugen.
6. Signing durchführen, sofern Produktionsrelease.
7. Hashes nach allen Dateiänderungen erzeugen.
8. Metadata- und Hash-Checks durchführen.
9. Draft-Release erstellen.
10. Release-Assets erneut per API und Hash prüfen.
11. Erst danach als stabil veröffentlichen.

## Phase 6 — Spätere Erweiterungen

Erst nach einem stabilen Windows-Release:

```text
macOS/Linux Builds
Shared-Standalone-Artifact
MITM mit eigenem UAC-Test
Auto-Updater/latest.yml/Blockmap
Remote-Bind-Modus
Delta-/Differential-Updates
```

---

# 37. Verbleibende echte Risiken nach der Verfeinerung

Nach diesem Audit bleiben nur Punkte offen, die durch Implementierung oder einen realen Windows-Lauf entschieden werden müssen:

| Risiko | Warum Quellenanalyse nicht genügt | Verbindlicher Abschluss |
|---|---|---|
| Electron-Version/Next-Kompatibilität | tatsächliche Electron-Node-Laufzeit nötig | packaged smoke mit `ELECTRON_RUN_AS_NODE` |
| finaler Standalone-Tree | Next-Output entsteht erst im Build | Prepare-Manifest im CI |
| SQLite-Treiber | Native ABI/DB-Verhalten laufzeitabhängig | echte DB-Schreib-/Leseprüfung |
| Passwort-Onboarding | benötigt UI + Serveränderung | frischer DATA_DIR-Test |
| NSIS per-user/per-machine | Builder-/Windows-Verhalten | install/upgrade/uninstall-Matrix |
| Authenticode/SmartScreen | Zertifikat und Windows-Reputation nötig | signierter Preview-/Produktionslauf |
| MITM | UAC, Port 443, Trust Store | separater bewusst privilegierter Test |
| Antivirus/EDR | produktabhängig | signiertes Artefakt gegen Zielumgebungen testen |

Keiner dieser Punkte wird im Plan mehr als „durch Quelltext bereits bewiesen“ dargestellt.

---

# 38. Endgültige Planentscheidung

Der verfeinerte Plan baut zunächst **keinen maximalen OmniRoute-Klon**, sondern ein kontrolliertes 9Router-Desktop-Produkt:

```text
validierter unveränderlicher Git-Tag
  → reproduzierbarer Windows-Root-Build
  → explizit validiertes Next-Standalone-Staging
  → offlinefähige SQLite-Fallback-Kette
  → sichere Electron-Shell mit Loopback-only
  → echtes Erststart-/Passwort-Onboarding
  → NSIS + explizit benannte Portable-EXE
  → Prozess-/Daten-/Upgrade-Gates
  → Signierung vor öffentlichem Release
  → Hash-/Metadata-/API-Verifikation
```

Damit sind die zuvor offenen Planlücken nicht nur aufgelistet, sondern mit konkreten Entscheidungen geschlossen. Die einzigen verbleibenden offenen Punkte sind nun echte Implementierungs- und Windows-Abnahmetests, die nicht seriös durch weitere statische Recherche ersetzt werden können.

---

# 39. Siebter Audit: Distribution Identity, Tags und bestehende CI

## 39.1 Das npm-Paket ist kein neutraler Installer-Input

Die npm-Registry meldet für `9router@0.5.75`:

```text
npm name:       9router
npm publisher:  decolua
npm gitHead:    17c4cc76877bd1755030a8414f8d0083f48dcccf
engine:         >=18.0.0
shrinkwrap:     false
```

Der Fork `jahdaganj00ki-eng/9router` besitzt dagegen aktuell keine GitHub-Releases. Das npm-Paket und die GitHub-Release-Distribution sind daher zwei verschiedene Lieferketten. Der Desktop-Installer darf nicht einfach `npm install 9router` oder das veröffentlichte npm-Tarball als Serverquelle verwenden.

**Verbindliche Korrektur:** Der Desktop-Build verwendet ausschließlich:

```text
GitHub-Tag-SHA des Forks
→ Root checkout
→ lokaler Root-Build
→ lokales Electron-Staging
```

Kein npm-Laufzeitdownload des 9Router-Pakets. Die Desktop-App erhält eine eigene Electron-Identität, zum Beispiel:

```text
package name: 9router-desktop
appId:          com.jahdaganj00ki-eng.9router
release owner:  jahdaganj00ki-eng/9router
```

## 39.2 Der existierende Tag `v0.5.75` ist nicht `master`

Die GitHub-API zeigt:

```text
master      → 17c4cc76877bd1755030a8414f8d0083f48dcccf
v0.5.75     → 83af3f1853b295eda428f3d3d8f5ff96ca25bfab
```

Ein Plan, der `v0.5.75` als Synonym für den aktuellen `master` behandelt, ist falsch. Zwischen Tag und Branch können sich bereits Source-, Dependency- oder Security-Unterschiede befinden.

**Verbindliche Korrektur:**

- `v0.5.75` wird nicht nachträglich als Desktop-Build des aktuellen Masters umgedeutet.
- Die Desktop-Funktion wird auf einem neuen Commit implementiert.
- Erst danach wird ein neuer Desktop-fähiger Release-Tag erstellt, beispielsweise `v0.5.76`.
- `validate` prüft, dass `package.json`, CLI-Version und Tagversion des neuen Tags zusammenpassen.
- Die Research unterscheidet in allen Beispielen zwischen „historischer Source-Stand“ und „zukünftiger Desktop-Release-Tag“.

## 39.3 Bestehender Docker-Workflow kollidiert mit `v*`

Der vorhandene Docker-Workflow reagiert ebenfalls auf alle `v*`-Tags. Er verwendet außerdem:

```yaml
DOCKERHUB_IMAGE: decolua/9router
```

Für einen Fork ist das ein gefährlicher Cross-Repository-Vertrag: Ein neuer Desktop-Tag kann gleichzeitig versuchen, auf das Docker-Hub-Repository des Parent-/Upstream-Owners zu pushen.

**Verbindliche Korrektur vor dem ersten Desktop-Tag:** Eine der folgenden Strategien muss implementiert werden:

### Bevorzugte Strategie

Docker-Publishing im Fork wird auf Repository-Identität begrenzt:

```yaml
if: github.repository == 'decolua/9router'
```

oder der Docker-Hub-Name wird in eine Fork-spezifische Repository-Variable geändert. GHCR- und Docker-Hub-Publishing werden getrennt autorisiert.

### Alternative

Desktop-Tags verwenden einen separaten Namespace wie:

```text
desktop-v0.5.76
```

Dann muss der Release-Workflow die Version aus `desktop-v<semver>` ableiten und GitHub-Release-/Updater-Namen korrekt behandeln. Diese Variante ist technisch möglich, aber weniger kompatibel mit üblichen Release-Konventionen.

**Entscheidung:** Für eine normale Release-URL `v0.5.76` wird der bestehende Docker-Workflow fork-sicher gemacht; es wird nicht still auf `decolua/9router` veröffentlicht.

## 39.4 Dependabot-Branches sind keine Release-Basis

Die Fork-API zeigt eigene Branches für Updates von `actions/checkout` und `actions/setup-node`. Diese Branches dürfen nicht als Basis oder Source-Ref für einen Release-Dispatch verwendet werden.

**Verbindliche Korrektur:** Der Release-Workflow akzeptiert nur:

```text
push: refs/tags/v<semver>
workflow_dispatch: ein existierender v<semver>-Tag
```

Nicht erlaubt sind Default-Branch-, Dependabot- oder frei eingegebene Branch-Refs.

---

# 40. Achter Audit: SQLite, Migration, Backups und Datenintegrität

## 40.1 Der tatsächliche SQLite-Pfad ist `db/data.sqlite`

Die aktuelle DB-Schicht verwendet:

```text
%APPDATA%\\9router\\db\\data.sqlite
%APPDATA%\\9router\\db\\backups\\
```

Die ältere Dokumentation spricht teilweise von `db.json`, `usage.json` und `api-keys.json`. Diese Dateien sind nur Legacy-Importquellen und nicht mehr der primäre laufende Speicher.

**Verbindliche Korrektur:** Installer-, Upgrade- und Backup-Dokumentation verwendet:

```text
Primärdatenbank: %APPDATA%\\9router\\db\\data.sqlite
Backups:        %APPDATA%\\9router\\db\\backups\\
Legacy-Import:  nur beim erkannten Erstimport
```

## 40.2 Migration ist nicht nur „Daten bleiben vorhanden“

`migrate.js` führt mehrere Aktionen aus:

1. versionierte Migrationen,
2. additive Schema-Synchronisierung,
3. Backup vor Schemaänderungen,
4. einmaligen Legacy-JSON-Import,
5. Zeilenzahlassertions gegen Datenverlust,
6. Marker `.migrated-from-json`.

`backup.js` schließt die Tabelle `requestDetails` absichtlich aus. Ein allgemeiner Installer-Test darf deshalb nicht behaupten, dass jedes historische Detail in jedem Backup enthalten ist.

**Verbindliche Testfälle:**

```text
frische leere DB → Schema/Migration erfolgreich
Legacy JSON → SQLite importiert, Marker geschrieben
absichtlicher fehlerhafter Legacy-Datensatz → Migration bricht ab, JSON bleibt erhalten
Schema-Version erhöht → Backup vor Änderung vorhanden
requestDetails → ausdrücklich als nicht im Lite-Backup enthalten dokumentiert
```

## 40.3 `sql.js` speichert verzögert

Der `sql.js`-Adapter schreibt Änderungen mit einem Debounce von 100 ms in die Datei. Ein harter Prozessabbruch vor dem Timer kann dadurch den letzten Zustand verlieren.

**Verbindliche Korrektur:**

- Der Desktop-Shutdown sendet zunächst SIGTERM/Graceful-Stop.
- Der Server muss den DB-Adapter schließen bzw. flushen, bevor der Child-Prozess beendet wird.
- Der Electron-Main-Prozess wartet mit Timeout auf den Child-Exit.
- Erst danach darf ein Force-Kill als letzte Schutzmaßnahme erfolgen.
- Der Smoke führt nach Schreiboperation, Graceful Quit und Neustart eine Persistenzprüfung aus.
- Ein Test mit absichtlichem Force-Kill wird als erwarteter Verlust des letzten Debounce-Fensters dokumentiert, nicht als normaler Shutdown akzeptiert.

## 40.4 WAL-Dateien müssen beim Backup/Shutdown berücksichtigt werden

Die DB setzt `PRAGMA journal_mode = WAL`. Damit können neben `data.sqlite` auch `data.sqlite-wal` und `data.sqlite-shm` existieren. Ein Dateikopier-Backup der Hauptdatei allein kann inkonsistent sein.

**Verbindliche Korrektur:** Der Plan verlässt sich für laufende Daten nicht auf blindes `copyFile(data.sqlite)`. Entweder:

- der vorhandene adapterbasierte Backup-Pfad wird verwendet und vor dem Kopieren checkpointed, oder
- der Prozess wird sauber geschlossen und erst dann werden alle SQLite-Dateien archiviert.

Der Installer selbst führt keine eigene konkurrierende Datenbankkopie während laufender Requests durch.

## 40.5 Treiberwahl für Electron wird konkretisiert

Der Driver-Code enthält eine wichtige Runtime-Regel:

```text
Node < 22.5: node:sqlite nicht verfügbar
Node >= 22.5: node:sqlite möglich
Node >= 24: better-sqlite3 wird übersprungen, da bekannter SIGSEGV-Risiko-Pfad
```

Die Electron-Version muss deshalb nicht nur „irgendein Electron 43“ sein. Ihre eingebettete Node-Version muss in CI ausgelesen und in `build-metadata.json` geschrieben werden.

**Verbindliche Korrektur:** Der Desktop-Smoke schlägt fehl, wenn:

```text
better-sqlite3 nicht lädt
und node:sqlite nicht verfügbar ist
und sql.js/WASM nicht lädt
```

Er schlägt **nicht** fehl, wenn `better-sqlite3` übersprungen wird, solange `node:sqlite` oder `sql.js` tatsächlich funktioniert.

---

# 41. Neunter Audit: Server-Start, Next-Standalone und Ressourcenauflösung

## 41.1 Das npm-Tarball-Assembly ist nicht der Electron-Assembly

Das veröffentlichte CLI-Paket enthält einen bereits erzeugten `app/`-Tree und nutzt `postinstall`-/Runtime-Hooks. Der geplante Desktop-Installer darf nicht einfach diesen `app/`-Ordner aus dem npm-Tarball übernehmen, weil damit:

- npm-Publisher-/Fork-Identität vermischt,
- Build-SHA nicht eindeutig,
- Runtime-Downloads vorausgesetzt,
- und die Electron-Runtime nicht geprüft würden.

**Verbindliche Korrektur:** Das Electron-Prepare-Script wird eigenständig aus dem Root-Checkout ausgeführt. Das CLI-Assembly dient nur als Referenz für fehlende Assets.

## 41.2 `custom-server.js` muss der einzige Server-Entry sein

Der Installer darf nicht gleichzeitig:

```text
custom-server.js
server.js
next start
```

als alternative, ungetestete Startpfade behandeln.

**Verbindliche Korrektur:** Ein einziger Resolver wird implementiert:

```text
resources/app/custom-server.js
```

Fehlt diese Datei, beendet sich der Start mit einer diagnostizierbaren Fehlermeldung. Ein stiller Fallback auf `server.js` wird im Produktions-Desktop deaktiviert, weil dadurch Header-/Peer-IP-/h2c-Verhalten unbemerkt verloren gehen könnte.

## 41.3 `process.execPath`-Modus muss mit `cwd` und Resources getestet werden

Der Server benötigt relative Pfade für Standalone-Dateien und externe Module. Der Child-Prozess darf nicht mit dem Installationsverzeichnis als beliebigem `cwd` gestartet werden.

**Verbindliche Korrektur:**

```text
serverPath: resources/app/custom-server.js
cwd:        resources/app
env:        DATA_DIR=%APPDATA%\\9router
            HOSTNAME=127.0.0.1
            PORT=20128
```

Das finale Smoke-Script protokolliert nur relative Bundlepfade und entfernt absolute Pfade aus Diagnostics/Metadata.

## 41.4 Runtime-Module-Scan muss echte dynamische Imports abdecken

Ein statischer Dateiexistenztest erkennt nicht, ob ESM/CJS-Auflösung unter Electron funktioniert. Der Prepare-Gate führt deshalb im finalen Staging aus:

```text
import("open")
import("sql.js")
import("node-machine-id")
```

und testet `sql.js` mit dem finalen WASM-Pfad. Der Test muss mit der tatsächlichen `package.json`-/`type`-Struktur des Staging-Trees laufen.

---

# 42. Zehnter Audit: Netzwerk, Browser, OAuth und Offline-Grenzen

## 42.1 Loopback bedeutet nicht automatisch sichere Browser-Isolation

Ein lokaler Port kann von anderen lokalen Prozessen angesprochen werden. Die Dashboard-Session verwendet Cookies; API-Routen können weitere Auth-/CORS-Regeln haben. Electron darf nicht daraus schließen, dass jede lokale Route vertrauenswürdig ist.

**Verbindliche Korrektur:**

- Renderer lädt ausschließlich `127.0.0.1` mit erwartetem Port.
- Fremde Navigation und Redirects werden blockiert.
- `will-redirect`/`will-navigate` prüfen Origin.
- Externe OAuth-Flows öffnen explizit im Systembrowser oder in einem kontrollierten, dokumentierten Auth-Fenster.
- Keine Provider-Credentials über Electron-IPC schleusen.
- Renderer bekommt keine generische Netzwerk- oder Node-API.

## 42.2 OAuth kann nicht Teil des Offline-Smokes sein

Provider-OAuth, Cloud-Sync und `/api/version` können externe Netzwerke benötigen. Ein Offline-Smoke darf deshalb nicht alle Funktionen als offline verfügbar behaupten.

**Verbindliche Feature-Matrix:**

| Funktion | Offline-Erststart |
|---|---:|
| Serverstart | Ja |
| Dashboard-Grundstruktur | Ja |
| Login/Passwortwechsel | Ja |
| SQLite/Migration | Ja |
| Provider-OAuth | Nein, Netzwerk erforderlich |
| Cloud-Sync | Nein, optional |
| npm-Update | Release 1 deaktiviert |
| Electron-Updater | Release 1 deaktiviert |
| `/api/version` | darf soft-failen |

## 42.3 Proxy-Umgebungsvariablen dürfen nicht ungeprüft in den Desktop einfließen

`.env.example` unterstützt `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY` und `NO_PROXY`. Ein Electron-Launcher, der pauschal das gesamte Benutzer-Environment an den Server weitergibt, kann unbeabsichtigte Proxy-/Credential-Effekte erzeugen.

**Verbindliche Korrektur:** Der Launcher setzt eine Allowlist für vererbte Variablen. Serverrelevante Werte werden explizit gesetzt; sensible oder unkontrollierte Environment-Werte werden nicht automatisch an Renderer/IPC weitergereicht. Ein Benutzer-Proxy kann später über eine validierte Einstellung aktiviert werden.

## 42.4 Browser-Autostart und Windows-Startup sind getrennt

Die CLI schreibt bei Autostart eine VBS-Datei in den Startup-Ordner und startet `node cli.js`. Diese Datei darf nicht in die Electron-App übernommen werden.

**Verbindliche Korrektur:** Desktop nutzt ausschließlich Electron `app.setLoginItemSettings()` bzw. die passende API. Der Zustand wird über eine whitelisted IPC-Funktion angezeigt und geändert. Keine VBS-Datei, kein globaler Node-Pfad und kein `ExecutionPolicy Bypass`.

---

# 43. Elfter Audit: CI-Supply-Chain, Permissions und Artifact-Hygiene

## 43.1 Action-Tags und Fork-Rechte

Der bestehende Fork verwendet bewegliche Action-Tags wie `actions/checkout@v4`. Für eine Installer-Supply-Chain genügt das nicht.

**Verbindliche Korrektur:** Vor dem ersten stabilen Release:

- Actions auf geprüfte Commit-SHAs pinnen,
- Dependabot-Updatebranches nicht automatisch als Release-Source verwenden,
- `permissions` pro Job minimieren,
- Release-Schreibrechte ausschließlich im Release-Job,
- keine `GH_TOKEN`-Umgebung im Packaging-Job,
- `actionlint`, `zizmor` und Secret-Scanning ausführen.

## 43.2 Artifact-Namen müssen versions- und SHA-bezogen sein

Ein generischer Name wie `windows-desktop` kann bei Retries oder parallelen Tags verwechselt werden.

**Verbindliche Korrektur:**

```text
windows-desktop-v0.5.76-<shortsha>
```

Der Release-Job lädt exakt dieses Artifact über Workflow-Outputs herunter. Kein „download all artifacts“-Glob für den ersten Desktop-Release.

## 43.3 Temporäre Dateien und Logs dürfen keine Secrets enthalten

`INITIAL_PASSWORD`, OAuth-Credentials, JWT-Secrets und Provider-Tokens dürfen nicht in:

```text
GITHUB_STEP_SUMMARY
build-metadata.json
Smoke-Logs
Crash-Dumps
Artifact-Manifests
```

landen.

**Verbindliche Korrektur:** Logs werden auf bekannte Secret-Muster redigiert; Environment-Dumps sind verboten. Der Smoke-Test protokolliert nur Drivername, Statuscode, PID-Klassen und relative Pfade.

## 43.4 Artifact-Download und Release-Upload müssen gegen Substitution geschützt sein

Das Release-Job darf nicht nur Dateinamen prüfen. Es muss das aus dem Build-Job stammende Artifact anhand von:

```text
Artifact-Name
source_sha
build-metadata.json
SHA256SUMS.json
```

verknüpfen. Stimmen diese Werte nicht, stoppt der Upload.

---

# 44. Zwölfter Audit: Testdesign und Fehlersimulation

## 44.1 Ein einzelner Smoke-Test reicht nicht

Der bisherige Plan enthielt einen Starttest, aber nicht ausreichend Fehlerfälle. Release 1 benötigt mindestens folgende Testklassen:

### Fresh install

```text
leeres DATA_DIR
→ Installer
→ Erststart
→ Onboarding
→ Health
```

### Existing data

```text
vorhandene data.sqlite
→ Upgrade
→ Migration
→ Datenzählung vor/nach
```

### Legacy import

```text
legacy db.json/usage.json
→ Migration
→ Marker
→ Backup
→ keine still verworfenen Zeilen
```

### Missing optional native module

```text
better-sqlite3 nicht verfügbar
→ node:sqlite oder sql.js
→ App funktioniert
```

### Missing WASM

```text
sql-wasm.wasm fehlt
→ Prepare-Gate schlägt vor Packaging fehl
```

### Port conflict

```text
fremder Prozess auf 20128
→ App startet nicht still auf falscher Adresse
→ keine fremde Prozessbeendigung
```

### Child crash

```text
Server beendet sich unerwartet
→ Electron zeigt Fehler
→ begrenztes, kontrolliertes Restart-Verhalten
→ kein Restart-Sturm
```

### Offline

```text
Registry/Provider/DNS nicht erreichbar
→ lokaler Start und Login funktionieren
→ keine npm-Installation
```

## 44.2 Crash-Restart ist im Desktop anders als in der CLI

Die CLI versucht Serverneustarts und deaktiviert nach mehreren Abstürzen MITM. Diese Logik darf nicht unverändert in Electron übernommen werden.

**Verbindliche Korrektur:** Electron verwendet:

```text
maximal begrenzte Restarts
Backoff
sichtbarer Fehlerstatus
manuelles Retry
kein automatisches MITM-Deaktivieren
kein Kill fremder Prozesse
```

## 44.3 Testdaten dürfen nicht in Release-Artefakte gelangen

Der Build erzeugt möglicherweise `.next`, `cli/app`, Logs, `.build-home`, `data` oder lokale Config-Dateien. Vor dem Packen wird ein Artifact-Hygiene-Scan ausgeführt:

```text
keine .env*
keine JWT-/Token-Dateien
keine db.json/data.sqlite
keine Logs
keine `.build-home`
keine Testfixtures mit Credentials
keine absolute Pfade
```

---

# 45. Finale Gap-Abschlussmatrix

| Befund | Beleg | Verbindlicher Planabschluss |
|---|---|---|
| npm-Identität weicht vom Fork ab | npm latest metadata | Desktop baut nur aus Fork-Tag |
| `v0.5.75` ist nicht `master` | Tags-/Branches-API | neuer Desktop-Tag nach Implementierung |
| Docker-Hub-Ziel ist hart codiert | bestehender Docker-Workflow | Fork-sicheres Docker-Gate vor Tag |
| Root-Lockfiles fehlen | Root-Contents-API | Lockfiles als Phase-0-Blocker |
| CLI nutzt Runtime-npm-Install | `sqliteRuntime`, `postinstall` | Desktop nutzt keine CLI-Hooks |
| DB ist SQLite, nicht primär JSON | `db/paths.js` | data.sqlite-/WAL-/Migrationstests |
| SQL.js schreibt verzögert | `sqljsAdapter.js` | graceful flush vor Force-Kill |
| Node-Driver hängt von Electron-Node ab | `driver.js` | echte Electron-Runtime-Driverprüfung |
| Legacy-Migration kann abbrechen | `migrate.js` | row-count/backup/marker tests |
| `requestDetails` fehlt in Lite-Backup | `backup.js` | Backupumfang explizit dokumentiert |
| custom-server ist sicherheitsrelevant | `custom-server.js` | einziger Produktions-Entry |
| lokale Browserroute ist nicht automatisch sicher | Electron-/Cookie-Modell | Origin-/IPC-Allowlist |
| OAuth ist nicht offline | Provider-/Versioncode | Offline-Matrix mit Soft-Fail |
| VBS-/PowerShell-Tray ist CLI-spezifisch | CLI-Trayquellen | Electron-only Tray/Autostart |
| Release-Reruns können Assets vermischen | GitHub Release-Modell | SHA-verknüpftes Artifact/Draft |
| Signingstatus war widersprüchlich | bisheriger Plan | stabiler Release nur signiert |
| Smoke war zu klein | bisherige Abnahmekriterien | Fehler- und Migrationstestmatrix |

---

# 46. Endgültiger Red-Team-Beschluss

Nach dem erweiterten Audit ist der Plan nur dann vollständig, wenn er drei Produkte strikt auseinanderhält:

```text
1. npm-CLI von decolua/9router
2. Source-/Docker-Produkt des Forks jahdaganj00ki-eng/9router
3. neue, separat gepackte Windows-Electron-Distribution
```

Die Windows-Distribution darf keine implizite Mischung dieser Lieferketten sein. Der endgültige Vertrag lautet:

```text
neuer validierter Fork-Tag
  → Windows-Build aus Source, nicht aus npm
  → explizites SQLite-/Migration-Staging
  → Electron-Node real testen
  → loopback-only, sichere IPC, kein CLI-Self-Healing
  → Erststart-Onboarding ohne dauerhaftes 123456
  → MITM/UAC nicht beim Standardstart
  → sichere NSIS-Daten-/Upgrade-Regeln
  → Fork-sicheres Docker-Publishing
  → SHA-/Artifact-/Tag-Provenance
  → signierter stabiler Release
```

Damit sind alle durch statische Analyse schließbaren Gaps im Plan adressiert. Offen bleiben ausschließlich Nachweise, die ein realer Implementierungs-, CI- oder Windows-Lauf liefern muss. Diese werden nicht mehr als theoretische Aufgaben versteckt, sondern sind mit konkreten Tests, erwarteten Ergebnissen und Blockerstatus versehen.

