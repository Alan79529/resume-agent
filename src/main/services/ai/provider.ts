export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIProvider {
  chat(messages: AIChatMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<string>;
  chatStream(messages: AIChatMessage[], options?: { temperature?: number; maxTokens?: number }): AsyncGenerator<string, void>;
}
