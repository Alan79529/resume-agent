import type {
  BattleCard,
  ExtractedContent,
  Analysis,
  AIChatMessage,
  ProfileData,
  DataTransferResult,
  ResumePdfImportResult
} from '../types'

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
      getProfile: () => Promise<ProfileData>
      setProfile: (profile: Partial<ProfileData>) => Promise<ProfileData>
      importResumePdf: () => Promise<ResumePdfImportResult>
      exportData: () => Promise<DataTransferResult>
      importData: () => Promise<DataTransferResult>
    }
  }
}

export const api = window.electronAPI
