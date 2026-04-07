import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for card operations
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
  
  // Config
  getApiKey: () => ipcRenderer.invoke('config:getApiKey'),
  setApiKey: (key: string) => ipcRenderer.invoke('config:setApiKey', key)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
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
