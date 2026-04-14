import { ipcMain, type IpcMainEvent } from 'electron';
import { analyzeJobContent } from '../services/ai';
import { createProvider } from '../services/ai';
import { profileStore } from '../store';
import type { ExtractedContent, AIChatMessage } from '../../shared/types';

function sendStreamEvent(
  sender: Electron.WebContents,
  channel: string,
  requestId: string,
  payload?: string
): void {
  if (!sender.isDestroyed()) {
    sender.send(channel, requestId, payload);
  }
}

export function setupAIIPC(): void {
  ipcMain.handle('ai:analyze', async (_, extracted: ExtractedContent) => {
    const profile = profileStore.get();
    return analyzeJobContent(extracted, profile);
  });

  ipcMain.on('ai:chatStream', async (event: IpcMainEvent, messages: AIChatMessage[], requestId: string) => {
    try {
      const provider = createProvider();

      const stream = provider.chatStream(messages, { temperature: 0.7, maxTokens: 2000 });
      for await (const chunk of stream) {
        sendStreamEvent(event.sender, 'ai:chatStream:chunk', requestId, chunk);
      }
      sendStreamEvent(event.sender, 'ai:chatStream:done', requestId);
    } catch (error: any) {
      sendStreamEvent(event.sender, 'ai:chatStream:error', requestId, error.message || '未知错误');
    }
  });
}
