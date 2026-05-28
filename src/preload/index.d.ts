import { ElectronAPI } from '@electron-toolkit/preload'
import type { BattleCard, ExtractedContent, Analysis, AIChatMessage, ProfileData, JobPreferences, DataTransferResult } from '../shared/types'

interface AgentProgressEvent {
  type: 'step_start' | 'tool_call' | 'tool_result' | 'step_end' | 'answer' | 'error';
  step?: number;
  toolName?: string;
  args?: Record<string, unknown>;
  success?: boolean;
  result?: unknown;
  content?: string;
  message?: string;
}

interface AgentRunResult {
  finalAnswer: string;
  steps: Array<{
    stepNumber: number;
    thinking?: string;
    toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
    toolResults: Array<{ toolCallId: string; name: string; result?: unknown; error?: string }>;
    response?: string;
    timestamp: string;
  }>;
  artifacts?: { cardIds?: string[] };
}

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
  // Agent
  agentRun: (
    userMessage: string,
    context?: { webContentId?: number; recentMessages?: Array<{ role: 'user' | 'assistant'; content: string }> }
  ) => Promise<AgentRunResult>
  onAgentProgress: (callback: (event: AgentProgressEvent) => void) => () => void
  onAgentDone: (callback: (result: AgentRunResult) => void) => () => void
  onAgentError: (callback: (error: string) => void) => () => void
  // Config
  getApiKey: () => Promise<string>
  setApiKey: (key: string) => Promise<boolean>
  getApiBaseUrl: () => Promise<string>
  setApiBaseUrl: (url: string) => Promise<boolean>
  getModel: () => Promise<string>
  setModel: (model: string) => Promise<boolean>
  getProfile: () => Promise<ProfileData>
  setProfile: (profile: Partial<ProfileData>) => Promise<ProfileData>
  getPreferences: () => Promise<JobPreferences>
  setPreferences: (prefs: Partial<JobPreferences>) => Promise<JobPreferences>
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
