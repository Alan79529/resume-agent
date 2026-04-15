import type { AIChatMessage, AIProvider, AIToolCall, AIToolDefinition, AIChatWithToolsResult } from './provider';

export interface OpenAICompatibleProviderConfig {
  baseURL: string;
  model: string;
  apiKey: string;
}

export class OpenAICompatibleProvider implements AIProvider {
  constructor(private config: OpenAICompatibleProviderConfig) {}

  private buildRequestBody(
    messages: AIChatMessage[],
    options?: { temperature?: number; maxTokens?: number; tools?: AIToolDefinition[]; toolChoice?: 'auto' | 'none' },
    stream = false
  ) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey.trim()) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    const body = JSON.stringify({
      model: this.config.model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2000,
      ...(Array.isArray(options?.tools) && options.tools.length ? { tools: options.tools, tool_choice: options.toolChoice ?? 'auto' } : {}),
      ...(stream ? { stream: true } : {}),
    });
    return { headers, body };
  }

  private parseToolCalls(toolCalls: unknown): AIToolCall[] {
    if (!Array.isArray(toolCalls)) {
      return [];
    }

    return toolCalls
      .map((toolCall, index): AIToolCall | null => {
        if (!toolCall || typeof toolCall !== 'object') return null;
        const record = toolCall as {
          id?: unknown;
          type?: unknown;
          function?: { name?: unknown; arguments?: unknown };
        };
        const name = record.function?.name;
        if (typeof name !== 'string' || !name.trim()) return null;
        const args = record.function?.arguments;
        return {
          id: typeof record.id === 'string' && record.id.trim() ? record.id : `tool_call_${index + 1}`,
          type: 'function',
          function: {
            name,
            arguments: typeof args === 'string' ? args : JSON.stringify(args ?? {}),
          },
        };
      })
      .filter((item): item is AIToolCall => item !== null);
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

  async chat(
    messages: AIChatMessage[],
    options?: { temperature?: number; maxTokens?: number; signal?: AbortSignal }
  ): Promise<string> {
    const { headers, body } = this.buildRequestBody(messages, options);
    const response = await fetch(this.config.baseURL, { method: 'POST', headers, body, signal: options?.signal });

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

  async *chatStream(
    messages: AIChatMessage[],
    options?: { temperature?: number; maxTokens?: number; signal?: AbortSignal }
  ): AsyncGenerator<string, void> {
    const { headers, body } = this.buildRequestBody(messages, options, true);
    const response = await fetch(this.config.baseURL, { method: 'POST', headers, body, signal: options?.signal });

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
    tools: AIToolDefinition[],
    options?: { temperature?: number; maxTokens?: number; toolChoice?: 'auto' | 'none'; signal?: AbortSignal }
  ): Promise<AIChatWithToolsResult> {
    const { headers, body } = this.buildRequestBody(messages, { ...options, tools }, false);
    const response = await fetch(this.config.baseURL, { method: 'POST', headers, body, signal: options?.signal });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI API 錯誤: ${error}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0] ?? {};
    const message = choice.message ?? {};

    return {
      content: typeof message.content === 'string' ? message.content : '',
      toolCalls: this.parseToolCalls(message.tool_calls),
      finishReason: typeof choice.finish_reason === 'string' ? choice.finish_reason : null,
    };
  }
}
