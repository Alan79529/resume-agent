# Resume-Agent

Resume-Agent is a desktop app for job-search preparation. It helps you extract JD pages, generate interview battle cards, run AI mock interviews, and manage your personal resume/profile context.

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

1. Build and publish new app version with `electron-builder`.
2. Ensure release artifacts and `latest.yml` are uploaded to the GitHub Release.
3. End users receive update checks automatically in packaged app.

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
