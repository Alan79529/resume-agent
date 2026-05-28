import { create } from 'zustand';
import type { ChatMessage } from '../types';

type ChatMode = 'chat' | 'mock' | 'agent';

export interface AgentStepUI {
  stepNumber: number;
  status: 'running' | 'done' | 'error';
  toolCalls: Array<{
    name: string;
    args: string;
    result?: string;
    resultData?: unknown;
    success?: boolean;
  }>;
  thinking?: string;
}

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  mode: ChatMode;
  mockCardId: string | null;
  mockQuestionIndex: number;
  mockMessages: ChatMessage[];
  agentSteps: AgentStepUI[];

  addMessage: (role: ChatMessage['role'], content: string) => void;
  updateLastAssistantMessage: (delta: string) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  enterMockMode: (cardId: string) => void;
  exitMockMode: () => void;
  resetMockState: () => void;
  incrementMockQuestionIndex: () => void;
  setAgentMode: (enabled: boolean) => void;
  setAgentSteps: (steps: AgentStepUI[]) => void;
  addAgentStep: (step: AgentStepUI) => void;
  updateLastAgentStep: (update: Partial<AgentStepUI>) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const welcomeMessage = `你好，我是你的面试助手。

开始使用：
1. 在右侧浏览器打开招聘岗位页面
2. 点击“提取并分析”
3. 查看分析后可保存为作战卡

提示：请先在设置中配置 API Key / Base URL / 模型。`;

function appendAssistantDelta(messages: ChatMessage[], delta: string): ChatMessage[] {
  const next = [...messages];
  const last = next[next.length - 1];
  if (last && last.role === 'assistant') {
    next[next.length - 1] = { ...last, content: last.content + delta };
    return next;
  }

  next.push({
    id: generateId(),
    role: 'assistant',
    content: delta,
    timestamp: new Date().toISOString()
  });
  return next;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [
    {
      id: 'welcome',
      role: 'assistant',
      content: welcomeMessage,
      timestamp: new Date().toISOString()
    }
  ],
  isLoading: false,
  mode: 'chat',
  mockCardId: null,
  mockQuestionIndex: 0,
  mockMessages: [],
  agentSteps: [],

  addMessage: (role, content) => {
    const message: ChatMessage = {
      id: generateId(),
      role,
      content,
      timestamp: new Date().toISOString()
    };

    set((state) => {
      if (state.mode === 'mock') {
        return {
          messages: [...state.messages, message],
          mockMessages: [...state.mockMessages, message]
        };
      }
      return { messages: [...state.messages, message] };
    });
  },

  updateLastAssistantMessage: (delta) => {
    set((state) => {
      if (state.mode === 'mock') {
        return {
          messages: appendAssistantDelta(state.messages, delta),
          mockMessages: appendAssistantDelta(state.mockMessages, delta)
        };
      }
      return { messages: appendAssistantDelta(state.messages, delta) };
    });
  },

  clearMessages: () => {
    set((state) => {
      if (state.mode === 'mock') {
        return { messages: [], mockMessages: [] };
      }
      return { messages: [] };
    });
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  enterMockMode: (cardId) => {
    set({
      mode: 'mock',
      mockCardId: cardId,
      mockQuestionIndex: 0,
      mockMessages: [],
      messages: []
    });
  },

  exitMockMode: () => {
    set({
      mode: 'chat',
      mockCardId: null,
      mockQuestionIndex: 0,
      mockMessages: [],
      messages: []
    });
  },

  resetMockState: () => {
    if (get().mode !== 'mock') {
      return;
    }
    set({
      mode: 'chat',
      mockCardId: null,
      mockQuestionIndex: 0,
      mockMessages: [],
      messages: []
    });
  },

  incrementMockQuestionIndex: () => {
    set((state) => ({ mockQuestionIndex: state.mockQuestionIndex + 1 }));
  },

  setAgentMode: (enabled) => {
    if (enabled) {
      set({ mode: 'agent', agentSteps: [], messages: [] });
    } else {
      set({
        mode: 'chat',
        agentSteps: [],
        messages: [{
          id: 'welcome',
          role: 'assistant',
          content: welcomeMessage,
          timestamp: new Date().toISOString()
        }]
      });
    }
  },

  setAgentSteps: (steps) => set({ agentSteps: steps }),

  addAgentStep: (step) => set((state) => ({ agentSteps: [...state.agentSteps, step] })),

  updateLastAgentStep: (update) => set((state) => {
    const steps = [...state.agentSteps];
    if (steps.length > 0) {
      steps[steps.length - 1] = { ...steps[steps.length - 1], ...update };
    }
    return { agentSteps: steps };
  }),
}));
