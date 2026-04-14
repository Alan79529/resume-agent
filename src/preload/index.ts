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
  getProfile: () => ipcRenderer.invoke('config:getProfile'),
  setProfile: (profile: { resumeText?: string; selfIntroText?: string }) =>
    ipcRenderer.invoke('config:setProfile', profile),
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
