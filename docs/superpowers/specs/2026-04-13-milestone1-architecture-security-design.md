# Milestone 1: Architecture & Security Foundation Design

> **Scope:** Provider-pattern LLM decoupling, credential secure storage, streaming response infrastructure, and enhanced web content extraction.

---

## 1. Provider-Pattern LLM Decoupling

### Goal
Replace the hard-coded DeepSeek API call with a pluggable `AIProvider` interface so users can switch to any OpenAI-compatible endpoint (Kimi, Ollama, custom proxies, etc.).

### Architecture
- Introduce an `AIProvider` TypeScript interface with two methods: `chat` (blocking) and `chatStream` (SSE async iterable).
- Implement `OpenAICompatibleProvider` that consumes a configurable `baseURL`, `model`, and `apiKey`.
- Keep the existing `analyzeJobContent` behavior (blocking JSON response) but have it delegate to `provider.chat()`.
- Store `apiBaseUrl` and `model` alongside `deepseekApiKey` in `electron-store` defaults.
- Settings UI gains two extra inputs: **Base URL** and **Model Name**.

### Backward Compatibility
If the store lacks `apiBaseUrl` or `model`, fall back to `https://api.deepseek.com/v1/chat/completions` and `deepseek-chat` so existing users are unaffected.

### Files
- `src/main/services/ai/provider.ts` — new interface
- `src/main/services/ai/openai-compatible.ts` — new provider impl
- `src/main/services/ai/index.ts` — refactored analysis orchestrator
- `src/main/store/index.ts` — extended schema defaults
- `src/main/ipc/config.ts` — new handlers for base URL / model
- `src/preload/index.ts` & `src/renderer/src/utils/ipc.ts` — new preload APIs
- `src/renderer/src/components/settings/SettingsPanel.tsx` — two new inputs

---

## 2. Secure Credential Storage (Electron safeStorage)

### Goal
Stop storing the API key in plain text inside `electron-store` JSON. Use Electron’s built-in `safeStorage` module (DPAPI on Windows, Keychain on macOS, secret-service on Linux) for transparent OS-level encryption.

### Architecture
- Create a tiny `secureStorage` wrapper in the main process.
- `encrypt(plainText)` → returns a base64 string when `safeStorage.isEncryptionAvailable()` is true; otherwise returns plaintext as a graceful fallback.
- `decrypt(cipherText)` → reverses the above.
- Hook this wrapper into `configStore.getApiKey()` and `configStore.setApiKey()`.
- **Migration path:** On `getApiKey()`, attempt decryption. If it throws (because the old value was plaintext), return the raw value and immediately re-encrypt it on the next `setApiKey()` call.

### Files
- `src/main/services/secure-storage.ts` — new wrapper
- `src/main/store/index.ts` — modify `configStore` read/write path

---

## 3. Streaming Response Infrastructure

### Goal
Lay the groundwork for real-time AI typing effects. The immediate beneficiary is the Chat Panel: when the user sends a free-text message, the assistant reply should stream in word-by-word instead of blocking until the full response is ready.

### Architecture
- **Backend:** `OpenAICompatibleProvider.chatStream()` opens a `fetch` request with `stream: true`, reads the `ReadableStream`, parses SSE chunks, and yields partial `content` strings via an `AsyncGenerator`.
- **IPC pattern:** Because Electron `ipcRenderer.invoke` cannot natively carry async iterables, we use a request-id event pattern:
  1. Renderer calls `window.electronAPI.chatStream(messages, requestId)`.
  2. Main process handler `ipcMain.on('ai:chatStream', ...)` initiates the stream and pushes chunks via `event.sender.send('ai:chatStream:chunk', requestId, chunk)` until `[DONE]`, then sends `ai:chatStream:done` or `ai:chatStream:error`.
  3. Preload registers listeners for these events and forwards them to renderer callbacks.
- **Frontend:**
  - `useChatStore` gains a `updateLastAssistantMessage(delta: string)` action that appends text in-place.
  - `ChatPanel.handleSend()` now actually calls the AI (via `chatStream`) instead of just appending a dead user message.
  - `MessageList` already shows a loading spinner when `isLoading` is true; during streaming we set `isLoading = true` until the `done` event arrives.

### Scope Note
The existing **"提取并分析"** flow (`analyzeJobContent`) still uses the blocking `chat()` method because it requires a complete JSON payload before parsing. Streaming is intentionally introduced for open-ended chat and the upcoming mock-interview feature.

### Files
- `src/main/services/ai/openai-compatible.ts` — SSE parser + `chatStream()`
- `src/main/ipc/ai.ts` — new streaming IPC handlers
- `src/preload/index.ts` — expose `chatStream` API
- `src/renderer/src/utils/ipc.ts` — type definitions
- `src/renderer/src/stores/chat.ts` — `updateLastAssistantMessage`, streaming state helpers
- `src/renderer/src/components/chat/ChatPanel.tsx` — wire `handleSend()` to streaming AI

---

## 4. Enhanced Web Content Extraction (Mozilla Readability)

### Goal
Improve the signal-to-noise ratio of extracted web pages. Currently we grab `document.body.innerText` and blindly truncate it, which includes nav bars, footers, ads, and side panels. We will pass the raw HTML to the main process, run it through `@mozilla/readability` inside a `jsdom` context, and only send the cleaned article text to the LLM.

### Architecture
- Inject script now returns `document.documentElement.outerHTML` (or the previous `innerText` as a fallback).
- In `setupWebviewIPC`, after receiving the HTML:
  1. Create a `JSDOM` instance.
  2. Run `new Readability(dom.window.document).parse()`.
  3. If successful, use `article.textContent` as `content`.
  4. If `parse()` returns `null` (common on non-article pages like raw JD listings), fall back to the old `innerText` logic.
- Because the cleaned text is already much shorter, we can reduce the hard truncation limit from 50 000 → 15 000 characters while keeping the prompt limit at 3000 tokens.

### Dependencies
- `jsdom` (dev + runtime in main process)
- `@mozilla/readability`

### Files
- `src/main/ipc/webview.ts` — refactor extraction pipeline
- `package.json` — add deps

---

## Error Handling & Edge Cases

| Scenario | Handling |
|----------|----------|
| safeStorage unavailable (e.g. headless CI) | Fallback to plaintext with a console warning |
| Readability parse fails | Fallback to raw `innerText` |
| Streaming connection drops mid-response | Send `ai:chatStream:error` with readable message; frontend stops spinner and appends error notice |
| Provider base URL is invalid / unreachable | Standard fetch error bubbles up; settings UI should validate URL format (optional) |
| Old plaintext API key exists | Transparent migration: read succeeds, rewrite encrypts on next save |

---

## Testing Strategy

- **Build test:** After all changes, `npm run build` must exit 0.
- **Type-check test:** `npx tsc --noEmit` must pass.
- **Runtime smoke test:**
  1. Open app, go to Settings, enter Base URL + Model + API Key, save.
  2. Restart app, verify settings persist and are encrypted in store file.
  3. Open browser to a Boss 直聘 JD page, click "提取并分析" — should still produce a BattleCard.
  4. In Chat Panel, type a message and send — should see a streamed assistant response.

---

## Out of Scope (for this Milestone)

- Resume-to-JD matching analysis (Milestone 2)
- Mock interview mode (Milestone 2)
- Auto-updater configuration (Milestone 3)
- Data export/import (Milestone 3)
- README rewrite (Milestone 3)
