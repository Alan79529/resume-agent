import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

type AgentRunRequest = {
  userInstruction: string
  webContentId: number
  entryPoint?: 'chat-panel' | 'mock' | 'manual'
  [key: string]: unknown
}

type AgentRunPayload = Record<string, unknown> & {
  raw?: string
}

function parseAgentPayload(payload?: string): AgentRunPayload {
  if (!payload) {
    return {}
  }

  try {
    const parsed = JSON.parse(payload)
    if (parsed && typeof parsed === 'object') {
      return parsed as AgentRunPayload
    }
    return { value: parsed }
  } catch {
    return { raw: payload }
  }
}

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
    const handler = (_: any, requestId: string, chunk: string) => callback(requestId, chunk)
    ipcRenderer.on('ai:chatStream:chunk', handler)
    return () => ipcRenderer.removeListener('ai:chatStream:chunk', handler)
  },
  onChatStreamDone: (callback: (requestId: string) => void) => {
    const handler = (_: any, requestId: string) => callback(requestId)
    ipcRenderer.on('ai:chatStream:done', handler)
    return () => ipcRenderer.removeListener('ai:chatStream:done', handler)
  },
  onChatStreamError: (callback: (requestId: string, error: string) => void) => {
    const handler = (_: any, requestId: string, error: string) => callback(requestId, error)
    ipcRenderer.on('ai:chatStream:error', handler)
    return () => ipcRenderer.removeListener('ai:chatStream:error', handler)
  },

  // AI Agent
  agentRun: (request: AgentRunRequest, requestId: string) => ipcRenderer.send('ai:agentRun', request, requestId),
  agentAbort: (requestId: string) => ipcRenderer.send('ai:agentAbort', requestId),
  onAgentRunProgress: (callback: (requestId: string, payload: AgentRunPayload) => void) => {
    const handler = (_: any, requestId: string, payload?: string) => callback(requestId, parseAgentPayload(payload))
    ipcRenderer.on('ai:agentRun:progress', handler)
    return () => ipcRenderer.removeListener('ai:agentRun:progress', handler)
  },
  onAgentRunDone: (callback: (requestId: string, payload: AgentRunPayload) => void) => {
    const handler = (_: any, requestId: string, payload?: string) => callback(requestId, parseAgentPayload(payload))
    ipcRenderer.on('ai:agentRun:done', handler)
    return () => ipcRenderer.removeListener('ai:agentRun:done', handler)
  },
  onAgentRunError: (callback: (requestId: string, payload: AgentRunPayload) => void) => {
    const handler = (_: any, requestId: string, payload?: string) => callback(requestId, parseAgentPayload(payload))
    ipcRenderer.on('ai:agentRun:error', handler)
    return () => ipcRenderer.removeListener('ai:agentRun:error', handler)
  },

  // Config
  getApiKey: () => ipcRenderer.invoke('config:getApiKey'),
  setApiKey: (key: string) => ipcRenderer.invoke('config:setApiKey', key),
  getApiBaseUrl: () => ipcRenderer.invoke('config:getApiBaseUrl'),
  setApiBaseUrl: (url: string) => ipcRenderer.invoke('config:setApiBaseUrl', url),
  getModel: () => ipcRenderer.invoke('config:getModel'),
  setModel: (model: string) => ipcRenderer.invoke('config:setModel', model),
  getProfile: () => ipcRenderer.invoke('config:getProfile'),
  setProfile: (profile: { resumeText?: string; selfIntroText?: string }) =>
    ipcRenderer.invoke('config:setProfile', profile),
  importResumePdf: () => ipcRenderer.invoke('config:importResumePdf'),
  exportData: () => ipcRenderer.invoke('config:exportData'),
  importData: () => ipcRenderer.invoke('config:importData')
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
