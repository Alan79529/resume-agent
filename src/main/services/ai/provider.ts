import type { ToolDefinition, ToolCall } from '../agent/types';

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  reasoning_content?: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface AIProvider {
  chat(messages: AIChatMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<string>;
  chatStream(messages: AIChatMessage[], options?: { temperature?: number; maxTokens?: number }): AsyncGenerator<string, void>;
  chatWithTools(
    messages: AIChatMessage[],
    tools: ToolDefinition[],
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<{ content: string | null; reasoningContent?: string; toolCalls: ToolCall[] }>;
}
