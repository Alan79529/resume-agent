import type { AIChatMessage as SharedAIChatMessage } from '../../shared/types';

export type AIChatMessage = SharedAIChatMessage;

export interface AIToolDefinition {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

export interface AIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface AIChatWithToolsResult {
  content: string;
  toolCalls: AIToolCall[];
  finishReason: string | null;
}

export interface AIProvider {
  chat(
    messages: AIChatMessage[],
    options?: { temperature?: number; maxTokens?: number; signal?: AbortSignal }
  ): Promise<string>;
  chatStream(
    messages: AIChatMessage[],
    options?: { temperature?: number; maxTokens?: number; signal?: AbortSignal }
  ): AsyncGenerator<string, void>;
  chatWithTools(
    messages: AIChatMessage[],
    tools: AIToolDefinition[],
    options?: { temperature?: number; maxTokens?: number; toolChoice?: 'auto' | 'none'; signal?: AbortSignal }
  ): Promise<AIChatWithToolsResult>;
}
