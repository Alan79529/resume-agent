import { ipcMain, type IpcMainEvent } from 'electron';
import { analyzeJobContent } from '../services/ai';
import { OpenAICompatibleProvider } from '../services/ai/openai-compatible';
import { configStore } from '../store';
import type { ExtractedContent, AIChatMessage } from '../../renderer/src/types';

export function setupAIIPC(): void {
  ipcMain.handle('ai:analyze', async (_, extracted: ExtractedContent) => {
    return analyzeJobContent(extracted);
  });

  ipcMain.on('ai:chatStream', async (event: IpcMainEvent, messages: AIChatMessage[], requestId: string) => {
    const apiKey = configStore.getApiKey();
    const baseURL = configStore.getApiBaseUrl();
    const model = configStore.getModel();

    if (!apiKey) {
      event.sender.send('ai:chatStream:error', requestId, '请先配置 API Key');
      return;
    }

    const provider = new OpenAICompatibleProvider({ baseURL, model, apiKey });

    try {
      const stream = provider.chatStream(messages, { temperature: 0.7, maxTokens: 2000 });
      for await (const chunk of stream) {
        event.sender.send('ai:chatStream:chunk', requestId, chunk);
      }
      event.sender.send('ai:chatStream:done', requestId);
    } catch (error: any) {
      event.sender.send('ai:chatStream:error', requestId, error.message || '未知错误');
    }
  });
}
