import { ipcMain, type IpcMainEvent } from 'electron';
import { analyzeJobContent, createProvider } from '../services/ai';
import { abortAgentRun, runAgentWorkflow } from '../services/agent';
import type { AgentProgressPayload, AgentRunRequest } from '../services/agent/types';
import { profileStore } from '../store';
import type { AIChatMessage, ExtractedContent } from '../../shared/types';

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

  ipcMain.on('ai:agentRun', (event: IpcMainEvent, payload: AgentRunRequest, requestId: string) => {
    const sender = event.sender;
    const cleanupOnDestroy = (): void => {
      abortAgentRun(requestId);
    };
    sender.once('destroyed', cleanupOnDestroy);

    void (async () => {
      const runRequest: AgentRunRequest = {
        ...payload,
        requestId,
      };

      try {
        const result = await runAgentWorkflow(runRequest, {
          onProgress: (progress: AgentProgressPayload) => {
            sendStreamEvent(event.sender, 'ai:agentRun:progress', requestId, JSON.stringify(progress));
          },
        });

        sendStreamEvent(event.sender, 'ai:agentRun:done', requestId, JSON.stringify(result));
      } catch (error: any) {
        const code =
          error?.message === 'AGENT_BUSY'
            ? 'AGENT_BUSY'
            : error?.name === 'AbortError'
              ? 'AGENT_ABORTED'
              : 'AGENT_FAILED';
        const message = error?.message || '未知错误';
        sendStreamEvent(event.sender, 'ai:agentRun:error', requestId, JSON.stringify({ code, message }));
      } finally {
        sender.removeListener('destroyed', cleanupOnDestroy);
      }
    })();
  });

  ipcMain.on('ai:agentAbort', (_, requestId: string) => {
    abortAgentRun(requestId);
  });
}
