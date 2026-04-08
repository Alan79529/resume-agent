import React, { useState } from 'react';
import { Send, Sparkles, Save, X } from 'lucide-react';
import { useChatStore } from '../../stores/chat';
import { useCardsStore } from '../../stores/cards';
import { useWebviewStore } from '../../stores/webview';
import { MessageList } from './MessageList';
import { api } from '../../utils/ipc';
import type { Analysis, ExtractedContent } from '../../types';

export const ChatPanel: React.FC = () => {
  const [input, setInput] = useState('');
  const [pendingAnalysis, setPendingAnalysis] = useState<{
    extracted: ExtractedContent;
    analysis: Analysis;
  } | null>(null);
  
  const { addMessage, setLoading } = useChatStore();
  const { createCard } = useCardsStore();
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
      
      addMessage('assistant', `已提取: ${extracted.title}\n类型: ${extracted.pageType}`);
      
      const analysis = await api.analyzeContent(extracted);
      
      setPendingAnalysis({ extracted, analysis });
      
      const summary = `## 分析完成 ✅

**${extracted.title}**

**公司业务**: ${analysis.companySummary}

**高频问题**:
${analysis.commonQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

**注意事项**:
${analysis.warnings.map(w => `- ${w}`).join('\n')}

点击"保存为作战卡"将此分析保存，或继续浏览其他岗位。`;

      addMessage('assistant', summary);
    } catch (error: any) {
      addMessage('assistant', `❌ 分析失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCard = async () => {
    if (!pendingAnalysis) return;
    
    const { extracted, analysis } = pendingAnalysis;
    
    // Smart extraction of company and position from page content
    let companyName = '未知公司';
    let positionName = '未知岗位';
    
    // Try to extract from page content (Boss 直聘 pattern)
    const content = extracted.content;
    
    // Boss 直聘 JD page pattern: Look for company name after specific keywords
    const companyPatterns = [
      /公司名[称]?[：:]\s*([^\n]+)/i,
      /([^\n]+)\s*招聘\s*([^\n]+)实习/i,
      /([^\n]{2,20})\s*[·|]\s*([^\n]{2,30})/,
    ];
    
    for (const pattern of companyPatterns) {
      const match = content.match(pattern);
      if (match) {
        if (match[1] && match[1].trim().length > 1) {
          companyName = match[1].trim();
        }
        if (match[2] && match[2].trim().length > 1) {
          positionName = match[2].trim();
        }
        break;
      }
    }
    
    // If still not found, try from title (remove common suffixes)
    if (companyName === '未知公司') {
      const cleanTitle = extracted.title
        .replace(/_BOSS直聘$/, '')
        .replace(/招聘$/, '')
        .replace(/实习$/, '')
        .trim();
      
      const titleParts = cleanTitle.split(/[·|-]/);
      if (titleParts.length >= 2) {
        companyName = titleParts[0].trim();
        positionName = titleParts[1].trim();
      } else {
        companyName = cleanTitle || '未知公司';
      }
    }
    
    // Clean up company name (remove extra spaces and common noise)
    companyName = companyName
      .replace(/\s+/g, ' ')
      .replace(/招聘$/i, '')
      .trim();
    
    positionName = positionName
      .replace(/\s+/g, ' ')
      .trim();
    
    await createCard({
      companyName,
      positionName,
      status: 'preparing',
      analysis,
      schedule: {
        interviewTime: null,
        reminderMinutes: 60,
        location: ''
      },
      review: {
        actualQuestions: '',
        selfRating: 3,
        answerFeedback: '',
        interviewerFeedback: '',
        salaryRange: '',
        result: 'pending',
        recommend: false,
        notes: ''
      },
      sourceUrl: extracted.url
    });
    
    addMessage('assistant', `✅ 已创建作战卡: ${companyName} · ${positionName}`);
    setPendingAnalysis(null);
  };

  const handleCancel = () => {
    setPendingAnalysis(null);
    addMessage('assistant', '已取消保存');
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">AI 助手</h2>
            <p className="text-sm text-gray-500 mt-0.5">在浏览器中找到岗位后点击分析</p>
          </div>
          <div className="flex gap-2">
            {pendingAnalysis && (
              <>
                <button
                  onClick={handleSaveCard}
                  className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Save size={16} />
                  保存为作战卡
                </button>
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-colors"
                >
                  <X size={16} />
                  取消
                </button>
              </>
            )}
            <button
              onClick={handleExtract}
              disabled={!!pendingAnalysis}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles size={16} />
              提取并分析
            </button>
          </div>
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
