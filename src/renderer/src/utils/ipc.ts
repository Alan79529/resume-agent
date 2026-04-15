import type {
  BattleCard,
  ExtractedContent,
  Analysis,
  AIChatMessage,
  ProfileData,
  DataTransferResult,
  ResumePdfImportResult
} from '../types'

export interface AgentRunRequest {
  userInstruction: string
  webContentId: number
  entryPoint?: 'chat-panel' | 'mock' | 'manual'
  [key: string]: unknown
}

export interface AgentRunProgressPayload {
  stage?: string
  phase?: 'model' | 'tool' | 'final' | string
  message?: string
  step?: number
  totalSteps?: number
  trace?: unknown
  raw?: string
  [key: string]: unknown
}

export interface AgentRunDonePayload {
  finalAnswer?: string
  trace?: {
    toolCalls?: Array<{ toolName?: string; tool?: string }>
    [key: string]: unknown
  } | Array<{ toolName?: string; tool?: string } | string>
  artifacts?: {
    cardId?: string
    companyName?: string
    positionName?: string
    [key: string]: unknown
  }
  cardId?: string
  summary?: string
  raw?: string
  [key: string]: unknown
}

export interface AgentRunErrorPayload {
  message?: string
  code?: string
  details?: unknown
  raw?: string
  [key: string]: unknown
}

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
      agentRun: (request: AgentRunRequest, requestId: string) => void
      agentAbort: (requestId: string) => void
      onAgentRunProgress: (callback: (requestId: string, payload: AgentRunProgressPayload) => void) => () => void
      onAgentRunDone: (callback: (requestId: string, payload: AgentRunDonePayload) => void) => () => void
      onAgentRunError: (callback: (requestId: string, payload: AgentRunErrorPayload) => void) => () => void
      getApiKey: () => Promise<string>
      setApiKey: (key: string) => Promise<boolean>
      getApiBaseUrl: () => Promise<string>
      setApiBaseUrl: (url: string) => Promise<boolean>
      getModel: () => Promise<string>
      setModel: (model: string) => Promise<boolean>
      getProfile: () => Promise<ProfileData>
      setProfile: (profile: Partial<ProfileData>) => Promise<ProfileData>
      importResumePdf: () => Promise<ResumePdfImportResult>
      exportData: () => Promise<DataTransferResult>
      importData: () => Promise<DataTransferResult>
    }
  }
}

export const api = window.electronAPI
