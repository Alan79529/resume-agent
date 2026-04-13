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

### Header Compatibility
The provider must **not** inject an `Authorization` header when `apiKey` is empty or whitespace-only. This allows local models (e.g. Ollama, LM Studio) that do not require authentication to work without being rejected by a malformed `Bearer ` token.

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

### Silent Migration (Auto-Upgrade)
When `configStore.getApiKey()` is called:
1. Attempt to `decryptString()` the stored value.
2. If decryption throws (indicating the value is a legacy plaintext string), return the raw plaintext to the caller for immediate use.
3. **In the background, immediately invoke `configStore.setApiKey(rawPlaintext)`** so it gets re-encrypted transparently. The user does not need to open Settings or click Save.
4. To avoid a migration loop when `safeStorage` is unavailable, skip re-encryption if `isEncryptionAvailable()` is false.

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
The existing **"提取并分析"** flow (`analyzeJobContent`) still uses the blocking `chat()` method because it requires a complete JSON payload before parsing. To mitigate the long wait time, the frontend will display explicit step messages:
1. "正在提取网页内容..."
2. "正在请求大模型分析，预计需要 15-30 秒，请耐心等待..."

Streaming JSON partial parsing is considered an advanced optimization and is **out of scope for M1**; it may be revisited in Milestone 2.

### Files
- `src/main/services/ai/openai-compatible.ts` — SSE parser + `chatStream()`
- `src/main/ipc/ai.ts` — new streaming IPC handlers
- `src/preload/index.ts` — expose `chatStream` API
- `src/renderer/src/utils/ipc.ts` — type definitions
- `src/renderer/src/stores/chat.ts` — `updateLastAssistantMessage`, streaming state helpers
- `src/renderer/src/components/chat/ChatPanel.tsx` — wire `handleSend()` to streaming AI

---

## 4. Enhanced Web Content Extraction (Mozilla Readability in Webview)

### Goal
Improve the signal-to-noise ratio of extracted web pages. Currently we grab `document.body.innerText` and blindly truncate it, which includes nav bars, footers, ads, and side panels. We will run `@mozilla/readability` directly inside the Webview process, leveraging Chromium's native DOM engine instead of running CPU-heavy `jsdom` on the main thread.

### Architecture
- `@mozilla/readability` is a browser-oriented library with no Node-specific dependencies. We will bundle it as a string and inject it into the target Webview via `executeJavaScript`.
- The injected script:
  1. Runs `new Readability(document.cloneNode(true)).parse()`.
  2. If successful, returns `{ title, content: article.textContent, length: article.length, source: 'readability' }`.
  3. If `parse()` returns `null`, falls back to `document.body.innerText` and marks `source: 'fallback'`.
- Only the cleaned text (~a few KB) travels back over IPC; the heavy DOM parsing stays inside the Webview renderer process.
- The content length limit sent to the LLM prompt is reduced from 50 000 → 15 000 characters because the cleaned text is already highly compressed.

### Implementation Detail: Script Injection
In `src/main/ipc/webview.ts`, the `executeJavaScript` payload will be expanded to include the minified Readability UMD bundle inline (or as a bundled string imported from a local `.js` asset). For simplicity and to avoid build-tool complexity, we will vendor a minified Readability bundle into `src/main/assets/readability.js` and read it at runtime.

### Files
- `src/main/assets/readability.js` — vendored minified Readability bundle
- `src/main/ipc/webview.ts` — refactor extraction pipeline to inject & execute inside Webview

---

## Error Handling & Edge Cases

| Scenario | Handling |
|----------|----------|
| safeStorage unavailable (e.g. headless CI) | Fallback to plaintext with a console warning; skip silent migration |
| Readability parse fails | Fallback to raw `innerText` inside the same Webview script |
| Streaming connection drops mid-response | Send `ai:chatStream:error` with readable message; frontend stops spinner and appends error notice |
| Provider base URL is invalid / unreachable | Standard fetch error bubbles up; settings UI should validate URL format (optional) |
| Old plaintext API key exists | Transparent silent migration: read succeeds, immediate rewrite encrypts in background |
| apiKey is empty for local models | No `Authorization` header sent; request proceeds with only `Content-Type` |

---

## Testing Strategy

- **Build test:** After all changes, `npm run build` must exit 0.
- **Type-check test:** `npx tsc --noEmit` must pass.
- **Runtime smoke test:**
  1. Open app, go to Settings, enter Base URL + Model + API Key, save.
  2. Restart app, verify settings persist and API Key is encrypted in store file.
  3. Open browser to a Boss 直聘 JD page, click "提取并分析" — should still produce a BattleCard.
  4. In Chat Panel, type a message and send — should see a streamed assistant response.
  5. Verify that legacy plaintext API keys are silently migrated to encrypted form on first launch.

---

## Out of Scope (for this Milestone)

- Resume-to-JD matching analysis (Milestone 2)
- Mock interview mode (Milestone 2)
- Streaming partial JSON parsing for `analyzeJobContent` (Milestone 2 candidate)
- Auto-updater configuration (Milestone 3)
- Data export/import (Milestone 3)
- README rewrite (Milestone 3)
