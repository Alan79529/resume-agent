import type { AIProvider, AIToolDefinition } from '../ai/provider';
import type { Analysis, BattleCard, ExtractedContent, ProfileData, Review, Schedule } from '../../../shared/types';

export const AGENT_TOOL_NAMES = ['extract_job_page', 'get_profile', 'save_battle_card'] as const;
export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number];

export interface AgentToolDefinition extends AIToolDefinition {
  function: AIToolDefinition['function'] & {
    name: AgentToolName;
  };
}

export interface AgentToolExecutionInput {
  name: string;
  argumentsJson: string;
  signal?: AbortSignal;
}

export interface AgentToolExecutionSuccess<T = unknown> {
  ok: true;
  data: T;
}

export interface AgentToolExecutionFailure {
  ok: false;
  errorCode: 'TOOL_NOT_ALLOWED' | 'TOOL_ARGUMENT_INVALID' | 'TOOL_EXECUTION_FAILED';
  message: string;
}

export type AgentToolExecutionResult<T = unknown> = AgentToolExecutionSuccess<T> | AgentToolExecutionFailure;

export interface ExtractJobPageResult extends ExtractedContent {
  companyName: string;
  positionName: string;
  salaryRange: string;
  requirementsSummary: string;
}

export interface SaveBattleCardInput {
  companyName: string;
  positionName: string;
  sourceUrl: string;
  companyLocation?: string;
  analysis?: Partial<Analysis>;
  schedule?: Partial<Schedule>;
  review?: Partial<Review>;
}

export interface SaveBattleCardResult {
  cardId: string;
  companyName: string;
  positionName: string;
}

export interface AgentToolDependencies {
  extractJobPage: (webContentId: number, signal?: AbortSignal) => Promise<ExtractJobPageResult>;
  getProfile: () => ProfileData;
  saveBattleCard: (input: SaveBattleCardInput) => Promise<SaveBattleCardResult>;
}

export interface AgentToolRuntime {
  definitions: AgentToolDefinition[];
  execute: (input: AgentToolExecutionInput) => Promise<AgentToolExecutionResult>;
}

export interface AgentProgressPayload {
  runId: string;
  step: number;
  phase: 'model' | 'tool' | 'final';
  message: string;
}

export interface AgentToolCallRecord {
  step: number;
  toolName: AgentToolName;
  argumentsJson: string;
  ok: boolean;
  durationMs: number;
  errorCode?: AgentToolExecutionFailure['errorCode'];
}

export interface AgentRunTrace {
  runId: string;
  steps: number;
  toolCalls: AgentToolCallRecord[];
  errors: string[];
}

export interface AgentRunArtifacts {
  cardId?: string;
  companyName?: string;
  positionName?: string;
}

export interface AgentRunResult {
  finalAnswer: string;
  trace: AgentRunTrace;
  artifacts: AgentRunArtifacts;
}

export interface AgentRunRequest {
  requestId: string;
  userInstruction: string;
  webContentId: number;
  maxSteps?: number;
}

export interface RunPlannerExecutorInput {
  request: AgentRunRequest;
  provider: AIProvider;
  tools: AgentToolRuntime;
  onProgress?: (payload: AgentProgressPayload) => void;
  signal?: AbortSignal;
  maxSteps?: number;
}
