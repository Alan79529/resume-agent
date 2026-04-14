# Milestone 2 AI Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Milestone 2 features from the approved design: profile resource library, resume-to-JD match analysis, mock interview mode, and TypeScript cleanup.

**Architecture:** Extend shared schema and IPC with `profile`; inject `profile.resumeText` into analysis prompt and normalize new match fields; add mock interview state isolation in chat store; extend ChatPanel/CardDetail/CardList UI for resource library + interview mode while preserving existing streaming IPC flow.

**Tech Stack:** Electron, React, Zustand, TypeScript, TailwindCSS

---

## File Structure Map

### Create
- `src/renderer/src/components/resources/ResourceLibraryModal.tsx`

### Modify
- `src/shared/types.ts`
- `src/main/store/index.ts`
- `src/main/ipc/config.ts`
- `src/main/ipc/ai.ts`
- `src/main/services/ai/index.ts`
- `src/preload/index.ts`
- `src/preload/index.d.ts`
- `src/renderer/src/utils/ipc.ts`
- `src/renderer/src/stores/chat.ts`
- `src/renderer/src/stores/cards.ts`
- `src/renderer/src/components/chat/ChatPanel.tsx`
- `src/renderer/src/components/cards/CardDetail.tsx`
- `src/renderer/src/components/cards/CardList.tsx`
- `src/renderer/src/components/cards/CardItem.tsx`
- `src/renderer/src/components/webview/WebviewPanel.tsx`

---

### Task 1: Extend Shared Types and Persistent Profile Store

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/main/store/index.ts`

- [ ] Add `ProfileData` and extend `Analysis` with `matchScore`, `missingSkills`, `matchSuggestions`.
- [ ] Extend `StoreSchema` with `profile` default object.
- [ ] Add `profileStore.get()` / `profileStore.set()` in main store.
- [ ] Verify by running `npm.cmd exec tsc --noEmit` and confirm no new type regressions from schema changes.

### Task 2: Expose Profile IPC APIs and Analysis Input Wiring

**Files:**
- Modify: `src/main/ipc/config.ts`
- Modify: `src/main/ipc/ai.ts`
- Modify: `src/main/services/ai/index.ts`

- [ ] Add IPC handlers `config:getProfile` and `config:setProfile`.
- [ ] Update `ai:analyze` handler to fetch profile and pass into `analyzeJobContent`.
- [ ] Update `analyzeJobContent(extracted, profile?)` prompt assembly:
  - include resume snippet (max 2000 chars) when available,
  - request match fields in output,
  - normalize fallback/default values for backward compatibility.
- [ ] Verify with `npm.cmd exec tsc --noEmit`.

### Task 3: Preload and Renderer API Contract for Profile

**Files:**
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Modify: `src/renderer/src/utils/ipc.ts`

- [ ] Add `getProfile` / `setProfile` preload bridge methods.
- [ ] Keep type signatures aligned between preload d.ts and renderer IPC typing.
- [ ] Verify via `npm.cmd exec tsc --noEmit`.

### Task 4: Build Resource Library Modal and Entry Point

**Files:**
- Create: `src/renderer/src/components/resources/ResourceLibraryModal.tsx`
- Modify: `src/renderer/src/components/cards/CardList.tsx`

- [ ] Create modal with two textareas (`resumeText`, `selfIntroText`) and save/cancel controls.
- [ ] Load existing profile when modal opens; persist via `api.setProfile`.
- [ ] Add header button in card list (FileText icon) to open modal.
- [ ] Verify UI compiles with `npm.cmd exec tsc --noEmit`.

### Task 5: Add Mock Interview State and Isolation Rules

**Files:**
- Modify: `src/renderer/src/stores/chat.ts`
- Modify: `src/renderer/src/stores/cards.ts`

- [ ] Extend chat store with mode state: `mode`, `mockCardId`, `mockQuestionIndex`, `mockMessages`.
- [ ] Add actions to enter/exit mock mode and append/clear mock messages.
- [ ] In cards store `selectCard`, auto reset chat mock state and clear chat messages when card changes during mock mode.
- [ ] Verify with `npm.cmd exec tsc --noEmit`.

### Task 6: Extend ChatPanel for Mock Interview + Match Summary

**Files:**
- Modify: `src/renderer/src/components/chat/ChatPanel.tsx`

- [ ] During extraction summary, include match-score-related output when present.
- [ ] Build dynamic mock prompt (`buildMockPrompt`) using selected card + profile.
- [ ] In mock mode, stream with payload `[system(mock prompt), ...mockMessages, user input]`.
- [ ] Add top banner in chat panel showing active mock target and `退出模拟面试` action.
- [ ] Ensure normal chat mode behavior remains unchanged.
- [ ] Verify with `npm.cmd exec tsc --noEmit`.

### Task 7: Extend CardDetail for Match Analysis and Mock Entry

**Files:**
- Modify: `src/renderer/src/components/cards/CardDetail.tsx`

- [ ] Add `开始模拟面试` button in header when card selected.
- [ ] Render new match analysis section with score badge color mapping and bullet lists.
- [ ] Show neutral placeholder when no resume/match data.
- [ ] Remove unused imports and keep existing sections functional.
- [ ] Verify with `npm.cmd exec tsc --noEmit`.

### Task 8: TypeScript Cleanup + Full Verification

**Files:**
- Modify: `src/renderer/src/components/cards/CardItem.tsx`
- Modify: `src/renderer/src/components/webview/WebviewPanel.tsx`

- [ ] Remove unused `MoreVertical`, `showDelete`, `setShowDelete`, and stale imports.
- [ ] Fix webview `allowpopups` boolean typing issue.
- [ ] Run verification commands:
  - `npm.cmd exec tsc --noEmit`
  - `npm.cmd run build`
- [ ] Confirm both commands exit 0 before reporting completion.

---

## Spec Coverage Check

- Profile resource library + persistence: Task 1, 3, 4
- Resume-to-JD matching fields + prompt extension: Task 1, 2, 6, 7
- Mock interview mode + state isolation + streaming: Task 5, 6, 7
- Deferred PDF parsing: no scope added in this plan
- TS pre-existing cleanup: Task 8
- Build/type-check verification: Task 8
