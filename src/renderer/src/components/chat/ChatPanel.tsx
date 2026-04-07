import React, { useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { useChatStore } from '../../stores/chat';
import { MessageList } from './MessageList';
import { api } from '../../utils/ipc';
import { useWebviewStore } from '../../stores/webview';

export const ChatPanel: React.FC = () => {
  const [input, setInput] = useState('');
  const { addMessage, setLoading } = useChatStore();
  const webviewRefs = useWebviewStore();

  const handleSend = () => {
    if (!input.trim()) return;
    addMessage('user', input);
    setInput('');
  };

  const handleExtract = async () => {
    const activeTab = webviewRefs.tabs.find(t => t.isActive);
    if (!activeTab) {
      addMessage('assistant', '请先在右侧浏览器中打开一个网页');
      return;
    }

    setLoading(true);
    addMessage('assistant', '正在提取页面内容...');

    try {
      const webview = document.querySelector(`webview[data-tab-id="${activeTab.id}"]`) as Electron.WebviewTag;
      if (!webview) {
        throw new Error('未找到浏览器窗口');
      }

      const extracted = await api.extractWebview(webview.getWebContentsId());
      
      addMessage('assistant', `已提取: ${extracted.title}`);
      
      const analysis = await api.analyzeContent(extracted);
      
      const summary = `## 分析完成 ✅

**${extracted.title}**

**公司业务**: ${analysis.companySummary}

**高频问题**:
${analysis.commonQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

正在创建作战卡...`;

      addMessage('assistant', summary);
    } catch (error: any) {
      addMessage('assistant', `❌ 分析失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">AI 助手</h2>
            <p className="text-sm text-gray-500 mt-0.5">在浏览器中找到岗位后点击分析</p>
          </div>
          <button
            onClick={handleExtract}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover transition-colors"
          >
            <Sparkles size={16} />
            提取并分析
          </button>
        </div>
      </div>
      
      <MessageList />
      
      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="输入消息..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            onClick={handleSend}
            className="p-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
