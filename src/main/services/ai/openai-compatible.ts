import type { AIProvider } from './provider';
import type { AIChatMessage } from '../../shared/types';
import type { ToolDefinition, ToolCall } from '../agent/types';

export interface OpenAICompatibleProviderConfig {
  baseURL: string;
  model: string;
  apiKey: string;
}

export class OpenAICompatibleProvider implements AIProvider {
  constructor(private config: OpenAICompatibleProviderConfig) {}

  private buildRequestBody(
    messages: AIChatMessage[],
    options?: { temperature?: number; maxTokens?: number },
    stream = false,
    tools?: ToolDefinition[]
  ) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey.trim()) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    const bodyObj: Record<string, unknown> = {
      model: this.config.model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2000,
    };
    if (stream) bodyObj.stream = true;
    if (tools && tools.length > 0) {
      bodyObj.tools = tools.map((def) => ({
        type: 'function',
        function: {
          name: def.name,
          description: def.description,
          parameters: {
            type: 'object',
            properties: Object.fromEntries(
              Object.entries(def.parameters).map(([key, param]) => [
                key,
                { type: param.type, description: param.description },
              ])
            ),
            required: Object.entries(def.parameters)
              .filter(([_, param]) => param.required)
              .map(([key]) => key),
          },
        },
      }));
      bodyObj.tool_choice = 'auto';
    }
    const body = JSON.stringify(bodyObj);
    return { headers, body };
  }

  private *parseSSELines(lines: string[]): Generator<string> {
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (trimmed.startsWith('data: ')) {
        try {
          const json = JSON.parse(trimmed.slice(6));
          const delta = json.choices?.[0]?.delta?.content;
          if (typeof delta === 'string') {
            yield delta;
          }
        } catch (err) {
          console.warn('[OpenAICompatibleProvider] Malformed SSE line:', trimmed, err);
        }
      }
    }
  }

  async chat(messages: AIChatMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<string> {
    const { headers, body } = this.buildRequestBody(messages, options);
    const response = await fetch(this.config.baseURL, { method: 'POST', headers, body });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI API 错误: ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('Invalid response format from AI API');
    }
    return content;
  }

  async *chatStream(messages: AIChatMessage[], options?: { temperature?: number; maxTokens?: number }): AsyncGenerator<string, void> {
    const { headers, body } = this.buildRequestBody(messages, options, true);
    const response = await fetch(this.config.baseURL, { method: 'POST', headers, body });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI API 错误: ${error}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const delta of this.parseSSELines(lines)) {
          yield delta;
        }
      }

      // Flush decoder and process remaining buffer
      buffer += decoder.decode();
      const finalLines = buffer.split('\n');
      for (const delta of this.parseSSELines(finalLines)) {
        yield delta;
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }

  async chatWithTools(
    messages: AIChatMessage[],
    tools: ToolDefinition[],
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<{ content: string | null; reasoningContent?: string; toolCalls: ToolCall[] }> {
    const { headers, body } = this.buildRequestBody(messages, options, false, tools);
    const response = await fetch(this.config.baseURL, { method: 'POST', headers, body });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI API 错误: ${error}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;

    if (!message) {
      throw new Error('Invalid response format from AI API');
    }

    const content: string | null = typeof message.content === 'string' ? message.content : null;
    const reasoningContent: string | undefined =
      typeof message.reasoning_content === 'string' ? message.reasoning_content : undefined;

    // 解析 tool_calls
    const toolCalls: ToolCall[] = [];
    if (Array.isArray(message.tool_calls)) {
      for (const tc of message.tool_calls) {
        try {
          const args = typeof tc.function?.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : tc.function?.arguments || {};
          toolCalls.push({
            id: tc.id || `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: tc.function?.name || '',
            arguments: args,
          });
        } catch (err) {
          console.warn('[OpenAICompatibleProvider] Failed to parse tool call arguments:', err);
        }
      }
    }

    return { content, reasoningContent, toolCalls };
  }
}
