# Milestone 1: Architecture & Security Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor Resume-Agent's AI layer to support pluggable providers, secure credential storage, streaming chat responses, and in-webview content extraction.

**Architecture:** Introduce an `AIProvider` abstraction with a concrete `OpenAICompatibleProvider`, encrypt API keys via Electron `safeStorage`, stream chat responses over custom IPC events, and inject `@mozilla/readability` directly into Webview processes for high-fidelity content extraction without blocking the main thread.

**Tech Stack:** Electron, React, TypeScript, Zustand, TailwindCSS, @mozilla/readability

---

## File Structure Map

### New Files
- `src/main/services/ai/provider.ts` — `AIProvider` interface
- `src/main/services/ai/openai-compatible.ts` — `OpenAICompatibleProvider` implementation
- `src/main/services/ai/index.ts` — analysis orchestrator (refactored from `src/main/services/ai.ts`)
- `src/main/services/secure-storage.ts` — `safeStorage` wrapper

### Modified Files
- `src/main/services/ai.ts` — delete (logic moves to `src/main/services/ai/index.ts`)
- `src/main/store/index.ts` — extended schema, secure storage integration
- `src/main/ipc/config.ts` — new handlers for base URL / model
- `src/main/ipc/ai.ts` — streaming handlers
- `src/main/ipc/webview.ts` — Readability injection
- `src/preload/index.ts` — new APIs (config + streaming)
- `src/renderer/src/types/index.ts` — add `AIChatMessage`
- `src/renderer/src/utils/ipc.ts` — type updates
- `src/renderer/src/stores/chat.ts` — streaming state
- `src/renderer/src/components/settings/SettingsPanel.tsx` — base URL / model inputs
- `src/renderer/src/components/chat/ChatPanel.tsx` — streaming integration + step messages
- `package.json` — add `@mozilla/readability` dependency

---

### Task 1: Provider Interface & OpenAICompatibleProvider

**Files:**
- Create: `src/main/services/ai/provider.ts`
- Create: `src/main/services/ai/openai-compatible.ts`

- [ ] **Step 1: Write provider interface**

`src/main/services/ai/provider.ts`:
```ts
import type { AIChatMessage } from '../../../renderer/src/types';

export interface AIProvider {
  chat(messages: AIChatMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<string>;
  chatStream(messages: AIChatMessage[], options?: { temperature?: number; maxTokens?: number }): AsyncGenerator<string, void>;
}
```

- [ ] **Step 2: Write OpenAICompatibleProvider**

`src/main/services/ai/openai-compatible.ts`:
```ts
import type { AIProvider, AIChatMessage } from './provider';

export interface OpenAICompatibleProviderConfig {
  baseURL: string;
  model: string;
  apiKey: string;
}

export class OpenAICompatibleProvider implements AIProvider {
  constructor(private config: OpenAICompatibleProviderConfig) {}

  async chat(messages: AIChatMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey.trim()) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(this.config.baseURL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI API 错误: ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content as string;
  }

  async *chatStream(messages: AIChatMessage[], options?: { temperature?: number; maxTokens?: number }): AsyncGenerator<string, void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey.trim()) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(this.config.baseURL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2000,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI API 错误: ${error}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (trimmed.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmed.slice(6));
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                yield delta;
              }
            } catch {
              // ignore malformed JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
```

- [ ] **Step 3: Commit**

Run:
```bash
git add src/main/services/ai/provider.ts src/main/services/ai/openai-compatible.ts
git commit -m "feat: add AIProvider interface and OpenAICompatibleProvider"
```

---

### Task 2: Extend Config Store, Types & IPC for Base URL / Model

**Files:**
- Modify: `src/renderer/src/types/index.ts`
- Modify: `src/main/store/index.ts`
- Modify: `src/main/ipc/config.ts`

- [ ] **Step 1: Add AIChatMessage to shared types**

In `src/renderer/src/types/index.ts`, add after `ExtractedContent` or near `ChatMessage`:

```ts
export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

Also update `StoreSchema`:

```ts
export interface StoreSchema {
  battleCards: BattleCard[];
  config: {
    deepseekApiKey: string;
    apiBaseUrl: string;
    model: string;
    defaultReminderMinutes: number;
  };
  resources: ResourceFile[];
}
```

- [ ] **Step 2: Extend store schema defaults and configStore**

In `src/main/store/index.ts`, update defaults:

```ts
const store = new Store<StoreSchema>({
  name: 'resume-agent-data',
  defaults: {
    battleCards: [],
    config: {
      deepseekApiKey: '',
      apiBaseUrl: 'https://api.deepseek.com/v1/chat/completions',
      model: 'deepseek-chat',
      defaultReminderMinutes: 60
    },
    resources: []
  }
})
```

And add getters/setters to `configStore`:

```ts
export const configStore = {
  getApiKey: (): string => store.get('config').deepseekApiKey,
  setApiKey: (key: string): void => {
    store.set('config.deepseekApiKey', key)
  },
  getApiBaseUrl: (): string => store.get('config').apiBaseUrl,
  setApiBaseUrl: (url: string): void => {
    store.set('config.apiBaseUrl', url)
  },
  getModel: (): string => store.get('config').model,
  setModel: (model: string): void => {
    store.set('config.model', model)
  },
  getDefaultReminder: (): number => store.get('config').defaultReminderMinutes,
  setDefaultReminder: (minutes: number): void => {
    store.set('config.defaultReminderMinutes', minutes)
  }
}
```

- [ ] **Step 3: Add IPC handlers**

`src/main/ipc/config.ts`:
```ts
import { ipcMain } from 'electron';
import { configStore } from '../store';

export function setupConfigIPC(): void {
  ipcMain.handle('config:getApiKey', () => configStore.getApiKey());
  ipcMain.handle('config:setApiKey', (_, key: string) => {
    configStore.setApiKey(key);
    return true;
  });
  ipcMain.handle('config:getApiBaseUrl', () => configStore.getApiBaseUrl());
  ipcMain.handle('config:setApiBaseUrl', (_, url: string) => {
    configStore.setApiBaseUrl(url);
    return true;
  });
  ipcMain.handle('config:getModel', () => configStore.getModel());
  ipcMain.handle('config:setModel', (_, model: string) => {
    configStore.setModel(model);
    return true;
  });
}
```

- [ ] **Step 4: Commit**

Run:
```bash
git add src/renderer/src/types/index.ts src/main/store/index.ts src/main/ipc/config.ts
git commit -m "feat: extend config store and IPC for base URL and model"
```

---

### Task 3: Secure Storage Wrapper

**Files:**
- Create: `src/main/services/secure-storage.ts`

- [ ] **Step 1: Write secure storage wrapper**

`src/main/services/secure-storage.ts`:
```ts
import { safeStorage } from 'electron';

export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

export function encryptString(plaintext: string): string {
  if (!plaintext) return plaintext;
  if (!isEncryptionAvailable()) {
    console.warn('[secure-storage] Encryption not available, storing plaintext');
    return plaintext;
  }
  const encrypted = safeStorage.encryptString(plaintext);
  return encrypted.toString('base64');
}

export function decryptString(ciphertext: string): string {
  if (!ciphertext) return ciphertext;
  if (!isEncryptionAvailable()) {
    return ciphertext;
  }
  const buffer = Buffer.from(ciphertext, 'base64');
  return safeStorage.decryptString(buffer);
}
```

- [ ] **Step 2: Commit**

Run:
```bash
git add src/main/services/secure-storage.ts
git commit -m "feat: add safeStorage wrapper for secure credential storage"
```

---

### Task 4: Integrate Secure Storage with Silent Migration

**Files:**
- Modify: `src/main/store/index.ts`

- [ ] **Step 1: Update configStore read/write with encryption**

Add import at the top of `src/main/store/index.ts`:
```ts
import { encryptString, decryptString, isEncryptionAvailable } from '../services/secure-storage';
```

Update only `getApiKey` and `setApiKey` inside `configStore`:

```ts
export const configStore = {
  getApiKey: (): string => {
    const raw = store.get('config').deepseekApiKey;
    if (!raw) return raw;
    try {
      return decryptString(raw);
    } catch (e) {
      // Legacy plaintext migration
      if (isEncryptionAvailable()) {
        store.set('config.deepseekApiKey', encryptString(raw));
      }
      return raw;
    }
  },
  setApiKey: (key: string): void => {
    store.set('config.deepseekApiKey', encryptString(key));
  },
  // getApiBaseUrl, setApiBaseUrl, getModel, setModel, getDefaultReminder, setDefaultReminder remain unchanged
  getApiBaseUrl: (): string => store.get('config').apiBaseUrl,
  setApiBaseUrl: (url: string): void => {
    store.set('config.apiBaseUrl', url)
  },
  getModel: (): string => store.get('config').model,
  setModel: (model: string): void => {
    store.set('config.model', model)
  },
  getDefaultReminder: (): number => store.get('config').defaultReminderMinutes,
  setDefaultReminder: (minutes: number): void => {
    store.set('config.defaultReminderMinutes', minutes)
  }
}
```

- [ ] **Step 2: Commit**

Run:
```bash
git add src/main/store/index.ts
git commit -m "feat: encrypt API key with safeStorage and add silent migration"
```

---

### Task 5: Refactor analyzeJobContent to Use Provider

**Files:**
- Create: `src/main/services/ai/index.ts`
- Delete: `src/main/services/ai.ts`

- [ ] **Step 1: Write refactored analysis orchestrator**

`src/main/services/ai/index.ts`:
```ts
import { configStore } from '../../store';
import { OpenAICompatibleProvider } from './openai-compatible';
import type { ExtractedContent, Analysis } from '../../../renderer/src/types';

export async function analyzeJobContent(extracted: ExtractedContent): Promise<Analysis> {
  const apiKey = configStore.getApiKey();
  const baseURL = configStore.getApiBaseUrl();
  const model = configStore.getModel();

  if (!apiKey) {
    throw new Error('请先配置 API Key');
  }

  const provider = new OpenAICompatibleProvider({ baseURL, model, apiKey });

  const prompt = `你是一个资深的互联网大厂面试官。请根据以下信息为求职者生成面试策略：

【页面内容】
标题: ${extracted.title}
URL: ${extracted.url}
类型: ${extracted.pageType}

内容:
${extracted.content.substring(0, 3000)}

请输出以下内容的 JSON 格式：
{
  "companySummary": "公司业务摘要（50字左右）",
  "jdSummary": "JD核心要求摘要",
  "experienceSummary": "面经要点摘要",
  "commonQuestions": ["高频问题1", "高频问题2", "高频问题3", "高频问题4", "高频问题5"],
  "warnings": ["注意事项1", "注意事项2", "注意事项3"],
  "checklist": ["准备事项1", "准备事项2", "准备事项3", "准备事项4", "准备事项5"],
  "selfIntroduction": "定制版1分钟自我介绍（200字左右）",
  "resumeSuggestions": ["简历建议1", "简历建议2", "简历建议3"],
  "keyPoints": ["八股重点1", "八股重点2", "八股重点3"]
}`;

  const content = await provider.chat(
    [
      { role: 'system', content: '你是一个专业的面试辅导助手，帮助求职者准备技术面试。' },
      { role: 'user', content: prompt }
    ],
    { temperature: 0.7, maxTokens: 2000 }
  );

  const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/({[\s\S]*})/);
  const jsonStr = jsonMatch ? jsonMatch[1] : content;

  try {
    const analysis: Analysis = JSON.parse(jsonStr);
    return analysis;
  } catch (e) {
    return {
      companySummary: content.substring(0, 200),
      jdSummary: '',
      experienceSummary: '',
      commonQuestions: [],
      warnings: ['AI 返回格式异常，请手动查看原始内容'],
      checklist: [],
      selfIntroduction: '',
      resumeSuggestions: [],
      keyPoints: []
    };
  }
}
```

- [ ] **Step 2: Delete old file**

Run:
```bash
git rm src/main/services/ai.ts
```

- [ ] **Step 3: Commit**

Run:
```bash
git add src/main/services/ai/index.ts
git commit -m "refactor: migrate analyzeJobContent to use AIProvider"
```

---

### Task 6: Preload & Renderer Types for Config + Streaming

**Files:**
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/utils/ipc.ts`
- Modify: `src/renderer/src/components/settings/SettingsPanel.tsx`

- [ ] **Step 1: Update preload**

`src/preload/index.ts`:
```ts
import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // Cards
  getCards: () => ipcRenderer.invoke('cards:getAll'),
  getCard: (id: string) => ipcRenderer.invoke('cards:getById', id),
  createCard: (card: any) => ipcRenderer.invoke('cards:create', card),
  updateCard: (id: string, updates: any) => ipcRenderer.invoke('cards:update', id, updates),
  deleteCard: (id: string) => ipcRenderer.invoke('cards:delete', id),
  
  // Webview
  extractWebview: (webContentId: number) => ipcRenderer.invoke('webview:extract', webContentId),
  
  // AI Analysis
  analyzeContent: (extracted: any) => ipcRenderer.invoke('ai:analyze', extracted),
  
  // AI Chat Stream
  chatStream: (messages: any[], requestId: string) => ipcRenderer.send('ai:chatStream', messages, requestId),
  onChatStreamChunk: (callback: (requestId: string, chunk: string) => void) => {
    const handler = (_: any, requestId: string, chunk: string) => callback(requestId, chunk);
    ipcRenderer.on('ai:chatStream:chunk', handler);
    return () => ipcRenderer.removeListener('ai:chatStream:chunk', handler);
  },
  onChatStreamDone: (callback: (requestId: string) => void) => {
    const handler = (_: any, requestId: string) => callback(requestId);
    ipcRenderer.on('ai:chatStream:done', handler);
    return () => ipcRenderer.removeListener('ai:chatStream:done', handler);
  },
  onChatStreamError: (callback: (requestId: string, error: string) => void) => {
    const handler = (_: any, requestId: string, error: string) => callback(requestId, error);
    ipcRenderer.on('ai:chatStream:error', handler);
    return () => ipcRenderer.removeListener('ai:chatStream:error', handler);
  },

  // Config
  getApiKey: () => ipcRenderer.invoke('config:getApiKey'),
  setApiKey: (key: string) => ipcRenderer.invoke('config:setApiKey', key),
  getApiBaseUrl: () => ipcRenderer.invoke('config:getApiBaseUrl'),
  setApiBaseUrl: (url: string) => ipcRenderer.invoke('config:setApiBaseUrl', url),
  getModel: () => ipcRenderer.invoke('config:getModel'),
  setModel: (model: string) => ipcRenderer.invoke('config:setModel', model),
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('electronAPI', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.electronAPI = api
}
```

- [ ] **Step 2: Update renderer types**

`src/renderer/src/utils/ipc.ts`:
```ts
import type { BattleCard, ExtractedContent, Analysis, AIChatMessage } from '../types'

declare global {
  interface Window {
    electronAPI: {
      getCards: () => Promise<BattleCard[]>
      getCard: (id: string) => Promise<BattleCard | undefined>
      createCard: (card: BattleCard) => Promise<BattleCard>
      updateCard: (id: string, updates: Partial<BattleCard>) => Promise<BattleCard | undefined>
      deleteCard: (id: string) => Promise<boolean>
      extractWebview: (webContentId: number) => Promise<ExtractedContent>
      analyzeContent: (extracted: ExtractedContent) => Promise<Analysis>
      chatStream: (messages: AIChatMessage[], requestId: string) => void
      onChatStreamChunk: (callback: (requestId: string, chunk: string) => void) => () => void
      onChatStreamDone: (callback: (requestId: string) => void) => () => void
      onChatStreamError: (callback: (requestId: string, error: string) => void) => () => void
      getApiKey: () => Promise<string>
      setApiKey: (key: string) => Promise<boolean>
      getApiBaseUrl: () => Promise<string>
      setApiBaseUrl: (url: string) => Promise<boolean>
      getModel: () => Promise<string>
      setModel: (model: string) => Promise<boolean>
    }
  }
}

export const api = window.electronAPI
```

- [ ] **Step 3: Update SettingsPanel with new inputs**

`src/renderer/src/components/settings/SettingsPanel.tsx`:
```tsx
import React, { useState, useEffect } from 'react';
import { Key, Save, Check, Globe, Cpu } from 'lucide-react';
import { api } from '../../utils/ipc';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.getApiKey().then(key => setApiKey(key || ''));
      api.getApiBaseUrl().then(url => setBaseUrl(url || ''));
      api.getModel().then(m => setModel(m || ''));
    }
  }, [isOpen]);

  const handleSave = async () => {
    await api.setApiKey(apiKey);
    await api.setApiBaseUrl(baseUrl);
    await api.setModel(model);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">设置</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <Globe size={16} />
                  API Base URL
                </div>
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.deepseek.com/v1/chat/completions"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <Cpu size={16} />
                  模型名称
                </div>
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="deepseek-chat"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <Key size={16} />
                  API Key
                </div>
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <p className="text-xs text-gray-500 mt-1">
                在 <a href="https://platform.deepseek.com" target="_blank" className="text-primary hover:underline">DeepSeek 平台</a> 获取 API Key
              </p>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
                ${saved 
                  ? 'bg-green-600 text-white' 
                  : 'bg-primary text-white hover:bg-primary-hover'
                }
              `}
            >
              {saved ? <Check size={18} /> : <Save size={18} />}
              {saved ? '已保存' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Commit**

Run:
```bash
git add src/preload/index.ts src/renderer/src/utils/ipc.ts src/renderer/src/components/settings/SettingsPanel.tsx
git commit -m "feat: expose config and streaming APIs in preload and settings UI"
```

---

### Task 7: Streaming IPC Handlers (Main Process)

**Files:**
- Modify: `src/main/ipc/ai.ts`

- [ ] **Step 1: Add streaming handler**

`src/main/ipc/ai.ts`:
```ts
import { ipcMain, type IpcMainEvent } from 'electron';
import { analyzeJobContent } from '../services/ai';
import { OpenAICompatibleProvider } from '../services/ai/openai-compatible';
import { configStore } from '../store';
import type { ExtractedContent, AIChatMessage } from '../../renderer/src/types';

export function setupAIIPC(): void {
  ipcMain.handle('ai:analyze', async (_, extracted: ExtractedContent) => {
    return analyzeJobContent(extracted);
  });

  ipcMain.on('ai:chatStream', async (event: IpcMainEvent, messages: AIChatMessage[], requestId: string) => {
    const apiKey = configStore.getApiKey();
    const baseURL = configStore.getApiBaseUrl();
    const model = configStore.getModel();

    if (!apiKey) {
      event.sender.send('ai:chatStream:error', requestId, '请先配置 API Key');
      return;
    }

    const provider = new OpenAICompatibleProvider({ baseURL, model, apiKey });

    try {
      const stream = provider.chatStream(messages, { temperature: 0.7, maxTokens: 2000 });
      for await (const chunk of stream) {
        event.sender.send('ai:chatStream:chunk', requestId, chunk);
      }
      event.sender.send('ai:chatStream:done', requestId);
    } catch (error: any) {
      event.sender.send('ai:chatStream:error', requestId, error.message || '未知错误');
    }
  });
}
```

- [ ] **Step 2: Commit**

Run:
```bash
git add src/main/ipc/ai.ts
git commit -m "feat: implement streaming chat IPC handler in main process"
```

---

### Task 8: Chat Store Streaming State Management

**Files:**
- Modify: `src/renderer/src/stores/chat.ts`

- [ ] **Step 1: Add streaming actions**

`src/renderer/src/stores/chat.ts`:
```ts
import { create } from 'zustand';
import type { ChatMessage } from '../types';

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  
  // Actions
  addMessage: (role: ChatMessage['role'], content: string) => void;
  updateLastAssistantMessage: (delta: string) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useChatStore = create<ChatState>((set) => ({
  messages: [
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是你的面试助手 🤖\n\n**开始使用：**\n1. 点击右侧浏览器中的 + 按钮打开 Boss 直聘\n2. 登录并搜索你感兴趣的实习岗位\n3. 打开岗位详情页\n4. 点击"提取并分析"按钮\n5. 我会为你生成完整的面试策略\n\n**需要先配置 API Key：**\n点击左上角的 ⚙️ 设置按钮，输入你的 API Key、Base URL 和模型名称',
      timestamp: new Date().toISOString()
    }
  ],
  isLoading: false,

  addMessage: (role, content) => {
    const message: ChatMessage = {
      id: generateId(),
      role,
      content,
      timestamp: new Date().toISOString()
    };
    set(state => ({ messages: [...state.messages, message] }));
  },

  updateLastAssistantMessage: (delta) => {
    set(state => {
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      if (last && last.role === 'assistant') {
        last.content += delta;
        return { messages };
      }
      messages.push({
        id: generateId(),
        role: 'assistant',
        content: delta,
        timestamp: new Date().toISOString()
      });
      return { messages };
    });
  },

  clearMessages: () => {
    set({ messages: [] });
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  }
}));
```

- [ ] **Step 2: Commit**

Run:
```bash
git add src/renderer/src/stores/chat.ts
git commit -m "feat: add streaming state management to chat store"
```

---

### Task 9: ChatPanel HandleSend with Streaming

**Files:**
- Modify: `src/renderer/src/components/chat/ChatPanel.tsx`

- [ ] **Step 1: Rewrite handleSend and register stream listeners**

Replace the content of `src/renderer/src/components/chat/ChatPanel.tsx` with:

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, Save, X } from 'lucide-react';
import { useChatStore } from '../../stores/chat';
import { useCardsStore } from '../../stores/cards';
import { useWebviewStore } from '../../stores/webview';
import { MessageList } from './MessageList';
import { api } from '../../utils/ipc';
import type { Analysis, ExtractedContent } from '../../types';

export const ChatPanel: React.FC = () => {
  const [input, setInput] = useState('');
  const [pendingAnalysis, setPendingAnalysis] = useState<{
    extracted: ExtractedContent;
    analysis: Analysis;
  } | null>(null);
  const requestIdRef = useRef<string | null>(null);
  
  const { addMessage, updateLastAssistantMessage, setLoading } = useChatStore();
  const { createCard } = useCardsStore();
  const webviewRefs = useWebviewStore();

  useEffect(() => {
    const unsubscribeChunk = api.onChatStreamChunk((requestId, chunk) => {
      if (requestIdRef.current === requestId) {
        updateLastAssistantMessage(chunk);
      }
    });
    const unsubscribeDone = api.onChatStreamDone((requestId) => {
      if (requestIdRef.current === requestId) {
        setLoading(false);
        requestIdRef.current = null;
      }
    });
    const unsubscribeError = api.onChatStreamError((requestId, error) => {
      if (requestIdRef.current === requestId) {
        updateLastAssistantMessage(`\n\n❌ 错误: ${error}`);
        setLoading(false);
        requestIdRef.current = null;
      }
    });

    return () => {
      unsubscribeChunk();
      unsubscribeDone();
      unsubscribeError();
    };
  }, [updateLastAssistantMessage, setLoading]);

  const handleSend = () => {
    if (!input.trim()) return;
    addMessage('user', input);
    const userInput = input;
    setInput('');

    const requestId = Math.random().toString(36).substring(2, 9);
    requestIdRef.current = requestId;
    setLoading(true);
    addMessage('assistant', '');

    api.chatStream(
      [
        { role: 'system', content: '你是一个专业的面试辅导助手，帮助求职者准备技术面试。回答要简洁、实用。' },
        { role: 'user', content: userInput }
      ],
      requestId
    );
  };

  const handleExtract = async () => {
    const activeTab = webviewRefs.tabs.find(t => t.isActive);
    if (!activeTab) {
      addMessage('assistant', '请先在右侧浏览器中打开一个网页');
      return;
    }

    setLoading(true);
    addMessage('assistant', '🔍 正在提取网页内容...');

    try {
      const webview = document.querySelector(`webview[data-tab-id="${activeTab.id}"]`) as Electron.WebviewTag;
      if (!webview) {
        throw new Error('未找到浏览器窗口');
      }

      const extracted = await api.extractWebview(webview.getWebContentsId());
      
      addMessage('assistant', `✅ 已提取: ${extracted.title}\n类型: ${extracted.pageType}\n\n⏳ 正在请求大模型分析，预计需要 15-30 秒，请耐心等待...`);
      
      const analysis = await api.analyzeContent(extracted);
      
      setPendingAnalysis({ extracted, analysis });
      
      const summary = `## 分析完成 ✅\n\n**${extracted.title}**\n\n**公司业务**: ${analysis.companySummary}\n\n**高频问题**:\n${analysis.commonQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n**注意事项**:\n${analysis.warnings.map(w => `- ${w}`).join('\n')}\n\n点击"保存为作战卡"将此分析保存，或继续浏览其他岗位。`;

      addMessage('assistant', summary);
    } catch (error: any) {
      addMessage('assistant', `❌ 分析失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCard = async () => {
    if (!pendingAnalysis) return;
    const { extracted, analysis } = pendingAnalysis;
    
    let companyName = '未知公司';
    let positionName = '未知岗位';
    const content = extracted.content;
    
    const companyPatterns = [
      /公司名[称]?[：:]\s*([^\n]+)/i,
      /([^\n]+)\s*招聘\s*([^\n]+)实习/i,
      /([^\n]{2,20})\s*[·|]\s*([^\n]{2,30})/,
    ];
    
    for (const pattern of companyPatterns) {
      const match = content.match(pattern);
      if (match) {
        if (match[1] && match[1].trim().length > 1) {
          companyName = match[1].trim();
        }
        if (match[2] && match[2].trim().length > 1) {
          positionName = match[2].trim();
        }
        break;
      }
    }
    
    if (companyName === '未知公司') {
      const cleanTitle = extracted.title
        .replace(/_BOSS直聘$/, '')
        .replace(/招聘$/, '')
        .replace(/实习$/, '')
        .trim();
      
      const titleParts = cleanTitle.split(/[·|-]/);
      if (titleParts.length >= 2) {
        companyName = titleParts[0].trim();
        positionName = titleParts[1].trim();
      } else {
        companyName = cleanTitle || '未知公司';
      }
    }
    
    let companyLocation = '';
    const locationPatterns = [
      /工作地[点]?[：:]\s*([^\n]+)/i,
      /地[点址][\s:：]+([^\n,，]+)/,
      /([\u4e00-\u9fa5]{2,10}[省市])/,
    ];
    
    for (const pattern of locationPatterns) {
      const match = typeof pattern === 'object' && 'exec' in pattern 
        ? pattern 
        : content.match(pattern as RegExp);
      if (match && match[1]) {
        companyLocation = match[1].trim();
        break;
      }
    }
    
    companyName = companyName.replace(/\s+/g, ' ').replace(/招聘$/i, '').trim();
    positionName = positionName.replace(/\s+/g, ' ').trim();
    
    await createCard({
      companyName,
      companyLocation,
      positionName,
      status: 'preparing',
      analysis,
      schedule: {
        interviewTime: null,
        reminderMinutes: 60,
        location: ''
      },
      review: {
        actualQuestions: '',
        selfRating: 3,
        answerFeedback: '',
        interviewerFeedback: '',
        salaryRange: '',
        result: 'pending',
        recommend: false,
        notes: ''
      },
      sourceUrl: extracted.url
    });
    
    addMessage('assistant', `✅ 已创建作战卡: ${companyName} · ${positionName}`);
    setPendingAnalysis(null);
  };

  const handleCancel = () => {
    setPendingAnalysis(null);
    addMessage('assistant', '已取消保存');
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">AI 助手</h2>
            <p className="text-sm text-gray-500 mt-0.5">在浏览器中找到岗位后点击分析</p>
          </div>
          <div className="flex gap-2">
            {pendingAnalysis && (
              <>
                <button
                  onClick={handleSaveCard}
                  className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Save size={16} />
                  保存为作战卡
                </button>
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-colors"
                >
                  <X size={16} />
                  取消
                </button>
              </>
            )}
            <button
              onClick={handleExtract}
              disabled={!!pendingAnalysis}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles size={16} />
              提取并分析
            </button>
          </div>
        </div>
      </div>
      
      <MessageList />
      
      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="输入消息..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            onClick={handleSend}
            className="p-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

Run:
```bash
git add src/renderer/src/components/chat/ChatPanel.tsx
git commit -m "feat: integrate streaming chat into ChatPanel with step loading messages"
```

---

### Task 10: Install @mozilla/readability & Refactor Webview Extraction

**Files:**
- Modify: `package.json`
- Modify: `src/main/ipc/webview.ts`

- [ ] **Step 1: Install dependency**

Run:
```bash
npm install @mozilla/readability
```

- [ ] **Step 2: Refactor webview extraction with in-webview Readability**

`src/main/ipc/webview.ts`:
```ts
import { ipcMain, webContents } from 'electron';
import { readFileSync } from 'fs';
import type { ExtractedContent } from '../../renderer/src/types';

// Resolve Readability.js from node_modules so it runs inside the Webview
const readabilityPath = require.resolve('@mozilla/readability/Readability.js');
const readabilityScript = readFileSync(readabilityPath, 'utf-8');

export function setupWebviewIPC(): void {
  ipcMain.handle('webview:extract', async (_, webContentId: number): Promise<ExtractedContent> => {
    const wc = webContents.fromId(webContentId);
    if (!wc) {
      throw new Error('Webview not found');
    }

    const result = await wc.executeJavaScript(`
      (() => {
        ${readabilityScript}
        
        const url = window.location.href;
        const title = document.title;
        
        let article = null;
        try {
          article = new Readability(document.cloneNode(true)).parse();
        } catch (e) {
          // Readability failed
        }
        
        let content = '';
        let source = 'fallback';
        if (article && article.textContent) {
          content = article.textContent;
          source = 'readability';
        } else {
          content = document.body.innerText;
        }
        
        // Detect page type
        let pageType = 'unknown';
        if (url.includes('zhipin.com/job_detail')) {
          pageType = 'jd';
        } else if (url.includes('zhipin.com/gongs')) {
          pageType = 'company';
        } else if (url.includes('nowcoder.com/discuss')) {
          pageType = 'experience';
        } else if (url.includes('nowcoder.com/company')) {
          pageType = 'company';
        }
        
        return {
          url,
          title,
          content: content.substring(0, 15000),
          pageType,
          timestamp: Date.now(),
          source
        };
      })()
    `);

    return result;
  });
}
```

- [ ] **Step 3: Commit**

Run:
```bash
git add package.json package-lock.json src/main/ipc/webview.ts
git commit -m "feat: inject Readability directly into webview for high-quality extraction"
```

---

### Task 11: Build & Type Check Verification

**Files:** N/A (verification only)

- [ ] **Step 1: Run TypeScript type check**

Run:
```bash
npx tsc --noEmit
```

Expected: exit 0, no errors.

- [ ] **Step 2: Run build**

Run:
```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 3: Commit if any auto-generated changes**

If `package-lock.json` or `tsconfig.tsbuildinfo` changed during build:
```bash
git add -u
git commit -m "chore: update lockfile and build info after milestone 1 changes" || echo "Nothing to commit"
```

---

## Spec Coverage Check

| Spec Requirement | Task |
|------------------|------|
| Provider interface | Task 1 |
| OpenAICompatibleProvider with chat + chatStream | Task 1 |
| Header compatibility (empty apiKey = no Bearer) | Task 1 |
| analyzeJobContent uses provider.chat() | Task 5 |
| Config store extended for baseURL & model | Task 2 |
| Config IPC handlers | Task 2 |
| Settings UI inputs for baseURL & model | Task 6 |
| Secure storage wrapper | Task 3 |
| Silent migration of plaintext API key | Task 4 |
| Streaming SSE parser | Task 1 |
| Streaming IPC handlers (main) | Task 7 |
| Preload streaming APIs | Task 6 |
| Chat store streaming state | Task 8 |
| ChatPanel streaming integration | Task 9 |
| Step messages for blocking analysis | Task 9 |
| Readability injected in webview | Task 10 |
| Build & type check pass | Task 11 |
