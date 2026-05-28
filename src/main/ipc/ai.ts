import { ipcMain, type IpcMainEvent } from 'electron';
import { analyzeJobContent } from '../services/ai';
import { createProvider } from '../services/ai';
import { profileStore } from '../store';
import { runPlannerExecutor } from '../services/agent';
import type { AgentProgressEvent } from '../services/agent';
import type { ExtractedContent, AIChatMessage } from '../../shared/types';

interface AgentRunContext {
  webContentId?: number;
  recentMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

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

// Agent 单任务锁
let agentRunning = false;

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

  // Agent 模式
  ipcMain.handle('ai:agentRun', async (event: IpcMainEvent, userMessage: string, context?: AgentRunContext) => {
    if (agentRunning) {
      throw new Error('AGENT_BUSY: 已有 Agent 任务在运行中');
    }

    agentRunning = true;

    try {
      const onProgress = (progressEvent: AgentProgressEvent) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('ai:agentRun:progress', progressEvent);
        }
      };

      // 将 context 信息注入到 userMessage 中
      let enhancedMessage = userMessage;
      if (context?.recentMessages?.length) {
        const history = context.recentMessages
          .slice(-8)
          .map((message) => `${message.role === 'user' ? '用户' : '助手'}: ${message.content.substring(0, 1500)}`)
          .join('\n\n');
        enhancedMessage = `[最近对话上下文]\n${history}\n\n[当前用户请求]\n${userMessage}`;
      }
      if (context?.webContentId) {
        enhancedMessage += `\n\n[系统提示: 用户当前浏览器页面的 webContentId 为 ${context.webContentId}，如需提取页面内容请使用 extract_job_page 工具]`;
      }

      if (context?.webContentId) {
        enhancedMessage += `\n[System context: current logged-in webview id is ${context.webContentId}. For Boss search and page extraction, use this browser context instead of asking the user to log in again.]`;
      }

      const result = await runPlannerExecutor(enhancedMessage, onProgress, context);

      if (!event.sender.isDestroyed()) {
        event.sender.send('ai:agentRun:done', result);
      }

      return result;
    } catch (error: any) {
      const errorMsg = error.message || 'Agent 执行失败';
      if (!event.sender.isDestroyed()) {
        event.sender.send('ai:agentRun:error', errorMsg);
      }
      throw error;
    } finally {
      agentRunning = false;
    }
  });
}
