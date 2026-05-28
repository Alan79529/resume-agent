// Agent 2.0 类型定义

export interface ToolParameter {
  type: string;
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result?: unknown;
  error?: string;
}

export interface AgentStep {
  stepNumber: number;
  thinking?: string;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  response?: string;
  timestamp: string;
}

export interface AgentRunRequest {
  userMessage: string;
  context?: {
    webContentId?: number;
  };
}

export interface AgentRunResult {
  finalAnswer: string;
  steps: AgentStep[];
  artifacts?: {
    cardIds?: string[];
  };
}

export type AgentProgressEvent =
  | { type: 'step_start'; step: number }
  | { type: 'tool_call'; toolName: string; args: Record<string, unknown> }
  | { type: 'tool_result'; toolName: string; success: boolean; result?: unknown }
  | { type: 'step_end'; step: number }
  | { type: 'answer'; content: string }
  | { type: 'error'; message: string };
