import { create } from 'zustand';
import type { ChatMessage } from '../types';

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  
  // Actions
  addMessage: (role: ChatMessage['role'], content: string) => void;
  updateLastAssistantMessage: (delta: string) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useChatStore = create<ChatState>((set) => ({
  messages: [
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是你的面试助手 🤖\n\n**开始使用：**\n1. 点击右侧浏览器中的 + 按钮打开 Boss 直聘\n2. 登录并搜索你感兴趣的实习岗位\n3. 打开岗位详情页\n4. 点击"提取并分析"按钮\n5. 我会为你生成完整的面试策略\n\n**需要先配置 API Key：**\n点击左上角的 ⚙️ 设置按钮，输入你的 API Key、Base URL 和模型名称',
      timestamp: new Date().toISOString()
    }
  ],
  isLoading: false,

  addMessage: (role, content) => {
    const message: ChatMessage = {
      id: generateId(),
      role,
      content,
      timestamp: new Date().toISOString()
    };
    set(state => ({ messages: [...state.messages, message] }));
  },

  updateLastAssistantMessage: (delta) => {
    set(state => {
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      if (last && last.role === 'assistant') {
        last.content += delta;
        return { messages };
      }
      messages.push({
        id: generateId(),
        role: 'assistant',
        content: delta,
        timestamp: new Date().toISOString()
      });
      return { messages };
    });
  },

  clearMessages: () => {
    set({ messages: [] });
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  }
}));
