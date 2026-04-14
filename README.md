# Resume-Agent

Resume-Agent is a desktop app for job-search preparation. It helps you extract JD pages, generate interview battle cards, run AI mock interviews, and manage your personal resume/profile context.

## Download (v1.0.0)

- Release page: [v1.0.0](https://github.com/Alan79529/resume-agent/releases/tag/v1.0.0)
- Windows installer: [resume-agent-1.0.0-setup.exe](https://github.com/Alan79529/resume-agent/releases/download/v1.0.0/resume-agent-1.0.0-setup.exe)

> Note: current installer is not code-signed. Windows may show an "Unknown publisher" warning.
> This does not affect runtime behavior, but users should confirm the download source is the official GitHub release page above.

## Core Capabilities

- **JD Analysis + Battle Card**
  - Extract content from job pages in embedded webview
  - Generate structured AI analysis (company summary, checklist, common questions, etc.)
  - Save results as battle cards and track interview status

- **Resource Library (Milestone 2)**
  - Save resume text and self-introduction
  - Inject resume context into JD analysis automatically
  - Generate match score, missing skills, and resume optimization suggestions

- **AI Mock Interview (Milestone 2)**
  - Start mock interview from a selected battle card
  - AI asks questions, scores answers, and suggests better phrasing
  - Mock state is isolated per card to avoid context mixing

- **Productization (Milestone 3)**
  - GitHub-based auto-update channel (`electron-updater`)
  - JSON export/import for battle cards + resource library

## Screenshots

> Replace these placeholder files with real screenshots in your repo.

- `docs/screenshots/main-layout.png`
- `docs/screenshots/resource-library.png`
- `docs/screenshots/mock-interview.png`
- `docs/screenshots/settings-data-transfer.png`

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Run in development

```bash
npm run dev
```

### 3. Build production bundles

```bash
npm run build
```

### 4. Build Windows installer

```bash
npx electron-builder --win --x64 --config.win.signAndEditExecutable=false
```

Generated files are under `dist/`.

## API Configuration

Open **Settings** in the app and configure:

- `API Base URL`
- `Model`
- `API Key`

By default this project uses an OpenAI-compatible chat completion endpoint format.

## Data Export / Import

In **Settings > Data Management**:

- **Export Data**: write a JSON backup file containing:
  - `battleCards`
  - `profile`
  - `resources`
- **Import Data**: load the same JSON structure and replace local data

Notes:
- API secrets are not exported in backup JSON.
- Import success triggers UI reload to refresh local state.

## Auto Update (GitHub Releases)

This project uses `electron-updater` with GitHub publish provider.

Current builder publish config:

- owner: `Alan79529`
- repo: `resume-agent`
- releaseType: `release`

### Release Flow

1. Update app version in `package.json`.
2. Build desktop package:
   ```bash
   npm run build
   npx electron-builder --win --x64 --config.win.signAndEditExecutable=false
   ```
3. Upload these files to the same GitHub Release tag:
   - `resume-agent-<version>-setup.exe`
   - `resume-agent-<version>-setup.exe.blockmap`
   - `latest.yml`
4. End users already on packaged app will receive update checks automatically.

### Current Published Release

- Tag: `v1.0.0`
- Assets:
  - `resume-agent-1.0.0-setup.exe`
  - `resume-agent-1.0.0-setup.exe.blockmap`
  - `latest.yml`

## Security Notes

- API key is stored through secure storage wrapper (encrypted when system encryption is available).
- Backup export/import intentionally excludes API config and secrets.
- Webview extraction is sandboxed and content-truncated before model requests.

## Project Structure

- `src/main`: Electron main process + IPC + services
- `src/preload`: secure renderer bridge
- `src/renderer`: React UI
- `src/shared`: shared TypeScript types
- `docs/superpowers`: specs and implementation plans

## License

For internal/private project use unless you add your own OSS license.
