import { ElectronAPI } from '@electron-toolkit/preload'
import type { BattleCard, ExtractedContent, Analysis, AIChatMessage } from '../renderer/src/types'

// Custom API interface
interface CustomAPI {
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

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    electronAPI: CustomAPI
  }
}
