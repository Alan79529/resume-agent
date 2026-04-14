# Milestone 2: AI Feature Depth Design

> **Scope:** Resume-to-JD matching analysis, AI mock interview mode, and shared resource library for user profile data.

---

## 1. Resume / Profile Resource Library

### Goal
Provide a persistent place for users to store their resume text (either pasted or extracted from PDF). This stored profile will be fed to the AI during JD analysis to produce a personalized match report.

### Architecture
- Extend `StoreSchema` with a `profile` key:
  - `resumeText: string` — raw text content of the user's resume
  - `selfIntroText: string` — optional self-introduction text
- Add a new "资源库" (Resource Library) tab/panel in the left sidebar or as a modal. For M2, we keep it lightweight: a simple modal triggered from the left card-list header.
- The modal contains:
  - A large textarea labeled "我的简历文本"
  - A smaller textarea labeled "自我介绍"
  - "保存" and "取消" buttons
- When the user clicks "提取并分析" on a JD page, the system **automatically** includes the saved `resumeText` in the prompt if it is non-empty.

### Data Flow
1. User opens Resource Library → edits resume text → saves → persisted to `electron-store` under `profile`.
2. User opens a JD in webview → clicks "提取并分析".
3. `analyzeJobContent` receives `extracted` + optional `profile`.
4. If `profile.resumeText` exists, the prompt is extended with a "【我的简历】" section before the JSON generation instruction.
5. AI response format is extended to include `matchAnalysis` fields (see Section 2).

---

## 2. Resume-to-JD Matching Analysis

### Goal
When a JD is analyzed and the user has a saved resume, the AI should output a cross-comparison report: match score, missing skills, and tailored suggestions.

### Architecture
- Extend the `Analysis` type with three new fields:
  ```ts
  export interface Analysis {
    // ... existing fields ...
    matchScore?: number | null;   // 0-100, or null/undefined when no resume is available
    missingSkills: string[];      // skills or keywords absent from resume
    matchSuggestions: string[];   // specific resume tweaks for this JD
  }
  ```
- Update the prompt in `analyzeJobContent`:
  - If `resumeText` is present, append:
    ```
    【我的简历】
    ${resumeText.substring(0, 2000)}

    请同时输出：
    - "matchScore": 简历与岗位匹配度评分（0-100 的整数）
    - "missingSkills": 简历中明显缺失但该岗位看重的技能或关键词（最多5条）
    - "matchSuggestions": 针对该岗位，简历需要微调或突出的重点描述建议（最多5条）
    ```
- In `ChatPanel.handleSaveCard()`, the `analysis` object (now including match fields) is stored in the BattleCard as usual.
- In `CardDetail`, a new section **"匹配度分析"** is rendered when `matchScore > 0`.
  - Shows a colored score badge (red < 40, yellow 40-70, green > 70)
  - Lists missing skills and match suggestions in bullet points.

### Backward Compatibility
- If the user has no saved resume, `matchScore` is omitted or set to `null`, `missingSkills` and `matchSuggestions` default to empty arrays. The CardDetail shows a neutral placeholder (e.g. "完善资源库以获取匹配度评分") instead of a 0-score badge.
- Existing BattleCards without these fields continue to work because TypeScript interfaces are structural; missing fields are treated as `undefined`.

---

## 3. AI Mock Interview Mode

### Goal
Allow users to practice interviewing against a specific BattleCard. The AI acts as an interviewer, asking questions from `commonQuestions` one by one, evaluating the user's answers, and offering phrasing improvements.

### Architecture
- Add a new UI mode in the **Chat Panel**.
- When a BattleCard is selected, a new button **"开始模拟面试"** appears in the CardDetail header (next to the status dropdown).
- Clicking it:
  1. Switches the Chat Panel into "mock interview mode"
  2. Seeds the chat with a system message instructing the AI to be an interviewer
  3. The AI sends its first question (e.g., "请先做一个简短的自我介绍")
- Mock interview state is stored in `useChatStore`:
  - `mode: 'chat' | 'mock'`
  - `mockCardId: string | null`
  - `mockQuestionIndex: number`
  - `mockMessages: ChatMessage[]` — isolated conversation history for the mock session

### State Isolation
To prevent confusion when the user switches cards mid-interview, `useCardsStore` listens to `selectedCardId` changes. Whenever the active card changes while in mock mode, the store automatically:
1. Clears `chatStore.messages`
2. Resets `chatStore.mode` to `'chat'`
3. Clears `chatStore.mockCardId` and `chatStore.mockMessages`
This ensures the user never sees a mock interview from Card A mixed with the content of Card B.
- The UI indicates mock mode with a banner: "正在模拟面试：{companyName} · {positionName}"
- User answers in the same input box. After each user message in mock mode:
  - The AI evaluates the answer (score 1-10 + brief feedback + improved phrasing)
  - Then asks the next question from `commonQuestions` (or a follow-up if exhausted)

### Context Assembly for Each Mock Turn
Because the LLM backend is stateless, the full system context must be re-injected on every user turn. The frontend **does not** show the long system prompt in the UI message list. Instead, `ChatPanel` constructs the API payload dynamically:

```ts
const apiMessages = [
  { role: 'system', content: buildMockPrompt(card, profile) },
  ...mockMessages.map(m => ({ role: m.role, content: m.content })),
  { role: 'user', content: userAnswer }
];
```

This keeps the chat UI clean while guaranteeing the AI never forgets which company, position, or candidate it is interviewing.

- The AI prompt for mock mode (`buildMockPrompt`):
  ```
  你是 {companyName} 的面试官，正在面试 {positionName} 岗位。
  当前候选人的简历要点：{resumeText snippet}
  岗位JD摘要：{jdSummary}
  高频面试问题列表：{commonQuestions}

  请按以下规则进行：
  1. 先问候选人，然后提出第一个问题（从 commonQuestions 中选择最相关的一个，或让候选人自我介绍）。
  2. 候选人回答后，给出评分（1-10分）和简评，然后提供一版更优的话术参考。
  3. 紧接着提出下一个问题。
  4. 保持面试官的专业、略带压力但尊重候选人的语气。
  ```
- A "退出模拟面试" button in the mock banner returns the chat to normal mode and clears mock state.

### Streaming
- Mock mode responses use the same `chatStream` IPC infrastructure as normal chat. The streamed output includes the evaluation + next question in one continuous assistant message.

---

## 4. Resource Library UI Details

### Placement
- In `CardList.tsx`, add a new icon button next to the Settings gear: a **FileText** icon that opens the Resource Library modal.
- The modal is a simple full-screen overlay (similar to `SettingsPanel`) with two textareas.

### Files Involved
- New: `src/renderer/src/components/resources/ResourceLibraryModal.tsx`
- Modify: `src/renderer/src/components/cards/CardList.tsx` — add open button
- Modify: `src/main/store/index.ts` — add `profile` schema and operations
- Modify: `src/main/ipc/config.ts` — add `getProfile` / `setProfile` handlers
- Modify: `src/preload/index.ts` + `src/renderer/src/utils/ipc.ts` — expose new APIs

---

## 5. PDF Parsing (Deferred / Optional)

### Decision
For M2, **PDF file parsing is explicitly deferred** to keep scope focused. Users paste or type their resume text directly into the Resource Library textarea. This avoids:
- Adding heavy binary dependencies (`pdf-parse`, `pdfjs-dist`) to the bundle
- Cross-platform file-picker and drag-anddrop complexity
- Potential security/policy issues with parsing arbitrary PDFs

A future milestone can add a "导入 PDF" button that extracts text and populates the textarea.

---

## 6. Pre-existing TypeScript Cleanup

### Goal
Milestone 1 left 5 pre-existing TS errors. We will fix them now to ensure a clean build:
1. `CardDetail.tsx` — remove unused `Bell` import
2. `CardItem.tsx` — remove unused `MoreVertical`, `showDelete`, `setShowDelete`
3. `ChatPanel.tsx` — fix the `RegExpExecArray` → `RegExp` invalid cast in location extraction
4. `WebviewPanel.tsx` — fix the `string` assigned to `boolean | undefined` on the webview attribute

---

## Error Handling & Edge Cases

| Scenario | Handling |
|----------|----------|
| User has no saved resume | `matchScore` defaults to 0; CardDetail hides match section; prompt omits resume section |
| Resume text exceeds prompt budget | Truncate to 2000 characters before sending to AI |
| User exits mock interview mid-way | Clear mock state, return to normal chat, prepend a system notice: "已退出模拟面试" |
| AI returns malformed JSON during analysis | Existing fallback in `analyzeJobContent` applies; match fields default to empty/zero |
| No commonQuestions in card | Mock mode asks a generic opening question and improvises follow-ups based on JD |

---

## Testing Strategy

- **Build test:** `npm run build` exits 0.
- **Type-check test:** `npx tsc --noEmit` passes with 0 errors.
- **Runtime smoke tests:**
  1. Open Resource Library, enter resume text, save, restart app — text persists.
  2. Analyze a JD with resume saved — chat output includes match score and suggestions.
  3. Save as BattleCard — CardDetail shows match section with colored badge.
  4. Click "开始模拟面试" — AI starts asking questions; answering triggers evaluation + next question.
  5. Click "退出模拟面试" — chat returns to normal mode.
