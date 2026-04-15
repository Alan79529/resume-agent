import { ElectronAPI } from '@electron-toolkit/preload'
import type { BattleCard, ExtractedContent, Analysis, AIChatMessage, ProfileData, DataTransferResult } from '../shared/types'

interface AgentRunRequest {
  userInstruction: string
  webContentId: number
  entryPoint?: 'chat-panel' | 'mock' | 'manual'
  [key: string]: unknown
}

interface AgentRunPayload {
  raw?: string
  [key: string]: unknown
}

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
  agentRun: (request: AgentRunRequest, requestId: string) => void
  agentAbort: (requestId: string) => void
  onAgentRunProgress: (callback: (requestId: string, payload: AgentRunPayload) => void) => () => void
  onAgentRunDone: (callback: (requestId: string, payload: AgentRunPayload) => void) => () => void
  onAgentRunError: (callback: (requestId: string, payload: AgentRunPayload) => void) => () => void
  getApiKey: () => Promise<string>
  setApiKey: (key: string) => Promise<boolean>
  getApiBaseUrl: () => Promise<string>
  setApiBaseUrl: (url: string) => Promise<boolean>
  getModel: () => Promise<string>
  setModel: (model: string) => Promise<boolean>
  getProfile: () => Promise<ProfileData>
  setProfile: (profile: Partial<ProfileData>) => Promise<ProfileData>
  exportData: () => Promise<DataTransferResult>
  importData: () => Promise<DataTransferResult>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    electronAPI: CustomAPI
  }
}
