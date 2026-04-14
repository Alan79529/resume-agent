# Milestone 3 Productization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Milestone 3 with production-oriented capabilities: GitHub auto-update channel, JSON data export/import, and a complete README.

**Architecture:** Add a dedicated updater module based on `electron-updater`, switch electron-builder publish target to GitHub, expose import/export IPC through preload for renderer actions, and keep backup scope limited to battle cards + resource library data to avoid sensitive config leakage.

**Tech Stack:** Electron, electron-builder, electron-updater, React, TypeScript

---

## File Structure Map

### Create
- `src/main/services/updater.ts`
- `README.md`

### Modify
- `package.json`
- `package-lock.json`
- `electron-builder.yml`
- `src/main/index.ts`
- `src/shared/types.ts`
- `src/main/store/index.ts`
- `src/main/ipc/config.ts`
- `src/preload/index.ts`
- `src/preload/index.d.ts`
- `src/renderer/src/utils/ipc.ts`
- `src/renderer/src/components/settings/SettingsPanel.tsx`

---

### Task 1: Add Auto-Updater Foundation
- [ ] Install `electron-updater` dependency.
- [ ] Add `src/main/services/updater.ts` with update lifecycle listeners and restart prompt.
- [ ] Wire updater in `src/main/index.ts` after window creation (production only).
- [ ] Update `electron-builder.yml` publish target to GitHub (`Alan79529/resume-agent`).

### Task 2: Implement Data Export / Import Pipeline
- [ ] Add backup type in shared types.
- [ ] Add store replace helpers for cards/resources.
- [ ] Add `config:exportData` and `config:importData` IPC handlers using file dialogs + JSON validation.
- [ ] Expose API in preload and renderer typings.

### Task 3: Connect UI Controls in Settings Panel
- [ ] Add “导出数据” and “导入数据” controls in settings panel.
- [ ] Show operation status and reload UI after successful import.
- [ ] Keep existing API config saving behavior unchanged.

### Task 4: Write Product README
- [ ] Create `README.md` with: project intro, core capabilities, quick start, API key setup, build/release guidance, auto-update notes, security tips, and screenshot placeholders.

### Task 5: Verification
- [ ] Run `npx.cmd tsc --noEmit`.
- [ ] Run `npm.cmd run build`.
- [ ] Confirm both commands pass before completion claim.
