import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Sparkles, Save, X } from 'lucide-react';
import { useChatStore } from '../../stores/chat';
import { useCardsStore } from '../../stores/cards';
import { useWebviewStore } from '../../stores/webview';
import { MessageList } from './MessageList';
import { api } from '../../utils/ipc';
import type { Analysis, ExtractedContent, AIChatMessage, BattleCard, ProfileData } from '../../types';

const DEFAULT_PROFILE: ProfileData = {
  resumeText: '',
  selfIntroText: ''
};

function buildMockPrompt(card: BattleCard, profile: ProfileData): string {
  const resumeSnippet = (profile.resumeText || '').trim().substring(0, 1200) || '候选人未提供简历';
  const questionList = card.analysis.commonQuestions.length
    ? card.analysis.commonQuestions.map((item, index) => `${index + 1}. ${item}`).join('\n')
    : '暂无高频题，请先从自我介绍开始再追问项目细节。';

  return `你是 ${card.companyName} 的面试官，正在面试 ${card.positionName} 岗位。

候选人简历摘要:
${resumeSnippet}

JD 摘要:
${card.analysis.jdSummary || '暂无 JD 摘要'}

高频问题候选池:
${questionList}

请遵守规则：
1. 先礼貌开场，再提出一个问题。
2. 每次候选人回答后，按如下格式回复：
   - 评分: X/10
   - 点评: 一段简明反馈
   - 优化表达: 一段可直接复述的优化回答
   - 下一题: 给出下一个问题
3. 保持专业、有一定压力但尊重候选人。`;
}

function getMatchSummary(analysis: Analysis): string {
  const missingSkills = analysis.missingSkills ?? [];
  const matchSuggestions = analysis.matchSuggestions ?? [];

  if (typeof analysis.matchScore !== 'number' || analysis.matchScore <= 0) {
    return '简历未启用匹配分析（请先在资源库保存简历文本）。';
  }

  const missing = missingSkills.length
    ? missingSkills.map((item) => `- ${item}`).join('\n')
    : '- 暂无明显缺失项';
  const suggestions = matchSuggestions.length
    ? matchSuggestions.map((item) => `- ${item}`).join('\n')
    : '- 暂无优化建议';

  return `**匹配分**: ${analysis.matchScore}\n\n**缺失技能**:\n${missing}\n\n**优化建议**:\n${suggestions}`;
}

const RECRUITER_TOKENS = [
  '女士',
  '先生',
  '活跃',
  '沟通',
  '微信',
  '招聘者',
  '招聘经理',
  '招聘主管',
  '校招经理',
  '校园招聘',
  'hr',
  'HR',
  '人事',
  '猎头'
];

const JOB_TOKENS = ['工程师', '开发', '实习', '算法', '测试', '产品', '运营', '岗位', 'AI', 'Agent', '后端', '前端'];
const COMPANY_TOKENS = ['有限公司', '公司', '科技', '信息', '集团', '网络', '教育', '软件', '银行', '研究院'];

function cleanDisplayText(value: string): string {
  const stripPrivateUse = (text: string) =>
    Array.from(text)
      .filter((char) => {
        const code = char.codePointAt(0) ?? 0;
        const inBmpPrivate = code >= 0xe000 && code <= 0xf8ff;
        const inSupPrivateA = code >= 0xf0000 && code <= 0xffffd;
        const inSupPrivateB = code >= 0x100000 && code <= 0x10fffd;
        return !inBmpPrivate && !inSupPrivateA && !inSupPrivateB;
      })
      .join('');

  return stripPrivateUse(String(value || ''))
    .replace(/\uFFFD/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\ufeff/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripSalaryText(value: string): string {
  return cleanDisplayText(value).replace(
    /\s*\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\s*(?:k|K|千|万|元\/天|元\/月|万\/年)/g,
    ''
  );
}

function isRecruiterText(value: string): boolean {
  const text = cleanDisplayText(value);
  if (!text) return false;
  return RECRUITER_TOKENS.some((token) => text.includes(token)) || /^[\u4e00-\u9fa5]{1,4}(女士|先生)/.test(text);
}

function looksLikeJob(value: string): boolean {
  const text = stripSalaryText(value);
  return Boolean(text) && JOB_TOKENS.some((token) => text.includes(token)) && !isRecruiterText(text);
}

function looksLikeCompany(value: string): boolean {
  const text = cleanDisplayText(value);
  return Boolean(text) && COMPANY_TOKENS.some((token) => text.includes(token)) && !isRecruiterText(text);
}

function hasUsefulChars(value: string): boolean {
  return /[\u4e00-\u9fa5A-Za-z]/.test(value);
}

function normalizeCompanyName(value: string): string {
  const text = cleanDisplayText(value).replace(/招聘$/i, '').trim();
  if (!text || isRecruiterText(text) || !hasUsefulChars(text)) return '未知公司';
  return text;
}

function normalizePositionName(value: string): string {
  const text = stripSalaryText(value).trim();
  if (!text || isRecruiterText(text) || !hasUsefulChars(text)) return '未知岗位';
  if (/^(?:元\/天|元\/月|万\/年)$/i.test(text)) return '未知岗位';
  return text;
}

function parseFromTitle(title: string): { companyName: string; positionName: string } {
  const cleanTitle = cleanDisplayText(title).replace(/\s*[_-]\s*BOSS直聘.*$/i, '').trim();
  const parts = cleanTitle
    .split(/[·|｜-]/)
    .map((part) => stripSalaryText(part))
    .map((part) => cleanDisplayText(part))
    .filter(Boolean);

  const dedupedParts = Array.from(new Set(parts));
  const positionName = dedupedParts.find((part) => looksLikeJob(part)) ?? '';
  const companyName =
    dedupedParts.find((part) => looksLikeCompany(part)) ?? dedupedParts.find((part) => !isRecruiterText(part)) ?? '';

  return { companyName, positionName };
}

export const ChatPanel: React.FC = () => {
  const [input, setInput] = useState('');
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
  const [pendingAnalysis, setPendingAnalysis] = useState<{
    extracted: ExtractedContent;
    analysis: Analysis;
  } | null>(null);

  const requestIdRef = useRef<string | null>(null);
  const requestModeRef = useRef<'chat' | 'mock' | null>(null);

  const {
    addMessage,
    updateLastAssistantMessage,
    clearMessages,
    setLoading,
    mode,
    mockCardId,
    mockMessages,
    exitMockMode,
    incrementMockQuestionIndex
  } = useChatStore();
  const { createCard, cards, selectedCardId, selectCard } = useCardsStore();
  const webviewStore = useWebviewStore();

  const activeMockCard = useMemo(() => {
    if (mode !== 'mock') return null;
    const targetId = mockCardId ?? selectedCardId;
    return cards.find((card) => card.id === targetId) ?? null;
  }, [mode, mockCardId, selectedCardId, cards]);

  useEffect(() => {
    let ignore = false;
    api.getProfile().then((value) => {
      if (!ignore) {
        setProfile(value ?? DEFAULT_PROFILE);
      }
    });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (mode !== 'mock') return;
    let ignore = false;
    api.getProfile().then((value) => {
      if (!ignore) {
        setProfile(value ?? DEFAULT_PROFILE);
      }
    });
    return () => {
      ignore = true;
    };
  }, [mode]);

  useEffect(() => {
    const unsubscribeChunk = api.onChatStreamChunk((requestId, chunk) => {
      if (requestIdRef.current === requestId) {
        updateLastAssistantMessage(chunk);
      }
    });

    const unsubscribeDone = api.onChatStreamDone((requestId) => {
      if (requestIdRef.current === requestId) {
        if (requestModeRef.current === 'mock') {
          incrementMockQuestionIndex();
        }
        setLoading(false);
        requestIdRef.current = null;
        requestModeRef.current = null;
      }
    });

    const unsubscribeError = api.onChatStreamError((requestId, error) => {
      if (requestIdRef.current === requestId) {
        updateLastAssistantMessage(`\n\n错误: ${error}`);
        setLoading(false);
        requestIdRef.current = null;
        requestModeRef.current = null;
      }
    });

    return () => {
      unsubscribeChunk();
      unsubscribeDone();
      unsubscribeError();
    };
  }, [incrementMockQuestionIndex, setLoading, updateLastAssistantMessage]);

  useEffect(() => {
    if (mode !== 'mock' || !activeMockCard || mockMessages.length > 0 || requestIdRef.current) {
      return;
    }

    const requestId = Math.random().toString(36).substring(2, 9);
    requestIdRef.current = requestId;
    requestModeRef.current = 'mock';
    setLoading(true);
    addMessage('assistant', '');

    const systemPrompt = buildMockPrompt(activeMockCard, profile);
    const firstTurnMessages: AIChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '请开始面试，先做开场并提出第一个问题。' }
    ];
    api.chatStream(firstTurnMessages, requestId);
  }, [activeMockCard, addMessage, mockMessages.length, mode, profile, setLoading]);

  const handleSend = () => {
    const userInput = input.trim();
    if (!userInput || requestIdRef.current) return;

    setInput('');

    const requestId = Math.random().toString(36).substring(2, 9);
    requestIdRef.current = requestId;
    requestModeRef.current = mode;
    setLoading(true);

    if (mode === 'mock' && activeMockCard) {
      const history = mockMessages.map((message) => ({ role: message.role, content: message.content })) as Array<{
        role: 'user' | 'assistant';
        content: string;
      }>;

      addMessage('user', userInput);
      addMessage('assistant', '');

      api.chatStream(
        [
          { role: 'system', content: buildMockPrompt(activeMockCard, profile) },
          ...history,
          { role: 'user', content: userInput }
        ],
        requestId
      );
      return;
    }

    addMessage('user', userInput);
    addMessage('assistant', '');
    api.chatStream(
      [
        { role: 'system', content: '你是专业面试辅导助手，请用简洁实用的方式回答。' },
        { role: 'user', content: userInput }
      ],
      requestId
    );
  };

  const handleExtract = async () => {
    const activeTab = webviewStore.tabs.find((tab) => tab.isActive);
    if (!activeTab) {
      addMessage('assistant', '请先在右侧浏览器中打开岗位页面。');
      return;
    }

    setLoading(true);
    addMessage('assistant', '正在提取网页内容...');

    try {
      const webview = document.querySelector(`webview[data-tab-id="${activeTab.id}"]`) as Electron.WebviewTag | null;
      if (!webview) {
        throw new Error('未找到浏览器窗口');
      }

      const extracted = await api.extractWebview(webview.getWebContentsId());
      addMessage(
        'assistant',
        `已提取: ${extracted.title}\n类型: ${extracted.pageType}\n正文长度: ${extracted.content.length} 字（此处仅展示标题预览）\n\n正在请求 AI 分析，预计 15-30 秒...`
      );

      const analysis = await api.analyzeContent(extracted);
      setPendingAnalysis({ extracted, analysis });

      const summary = `## 分析完成\n\n**${extracted.title}**\n\n**公司业务**: ${analysis.companySummary}\n\n**高频问题**:\n${analysis.commonQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n**注意事项**:\n${analysis.warnings.map((w) => `- ${w}`).join('\n')}\n\n**简历匹配**:\n${getMatchSummary(analysis)}\n\n点击“保存为作战卡”将结果存档。`;

      addMessage('assistant', summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      addMessage('assistant', `分析失败: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCard = async () => {
    if (!pendingAnalysis) return;
    const { extracted, analysis } = pendingAnalysis;

    let companyName = '';
    let positionName = '';
    const content = extracted.content;

    const fromTitle = parseFromTitle(extracted.title);
    companyName = fromTitle.companyName;
    positionName = fromTitle.positionName;

    const companyPatterns = [
      /公司名称[:：]\s*([^\n]+)/i,
      /([^\n]+)\s*招聘\s*([^\n]+)实习/i,
      /([^\n]{2,20})\s*[|·-]\s*([^\n]{2,30})/
    ];

    if (!companyName || !positionName) {
      for (const pattern of companyPatterns) {
        const match = content.match(pattern);
        if (!match) continue;

        const matchedCompany = cleanDisplayText(match[1] ?? '');
        const matchedPosition = cleanDisplayText(match[2] ?? '');

        if (!companyName && matchedCompany.length > 1 && !isRecruiterText(matchedCompany)) {
          companyName = matchedCompany;
        }
        if (!positionName && matchedPosition.length > 1 && looksLikeJob(matchedPosition)) {
          positionName = stripSalaryText(matchedPosition);
        }

        if (companyName && positionName) {
          break;
        }
      }
    }

    if (!companyName || !positionName) {
      const topLines = content
        .split('\n')
        .map((line) => cleanDisplayText(line))
        .filter(Boolean)
        .slice(0, 40);

      for (const line of topLines) {
        if (!positionName && looksLikeJob(line)) {
          positionName = stripSalaryText(line);
        }
        if (!companyName && looksLikeCompany(line)) {
          companyName = line;
        }
        if (companyName && positionName) {
          break;
        }
      }
    }

    if (!companyName) {
      const cleanTitle = cleanDisplayText(extracted.title);
      const titleParts = cleanTitle.split(/[·|-]/).map((part) => cleanDisplayText(part));
      companyName = titleParts.find((part) => part && !isRecruiterText(part)) || '';
    }

    if (!positionName) {
      const cleanTitle = cleanDisplayText(extracted.title);
      const titleParts = cleanTitle.split(/[·|-]/).map((part) => cleanDisplayText(part));
      positionName = titleParts.find((part) => looksLikeJob(part)) || '';
    }

    let companyLocation = '';
    const locationPatterns = [/工作地[点址]?[：:\s]+([^\n,，]+)/i, /([\u4e00-\u9fa5]{2,10}(?:省|市))/];

    for (const pattern of locationPatterns) {
      const match = content.match(pattern);
      if (match?.[1]) {
        companyLocation = cleanDisplayText(match[1]);
        break;
      }
    }

    companyName = normalizeCompanyName(companyName);
    positionName = normalizePositionName(positionName);

    await createCard({
      companyName,
      companyLocation,
      positionName,
      status: 'preparing',
      analysis: {
        ...analysis,
        matchScore: analysis.matchScore ?? null,
        missingSkills: analysis.missingSkills ?? [],
        matchSuggestions: analysis.matchSuggestions ?? []
      },
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

    addMessage('assistant', `已创建作战卡: ${companyName} · ${positionName}`);
    setPendingAnalysis(null);
  };

  const handleCancelSave = () => {
    setPendingAnalysis(null);
    addMessage('assistant', '已取消保存。');
  };

  const handleExitMock = () => {
    requestIdRef.current = null;
    requestModeRef.current = null;
    setLoading(false);
    exitMockMode();
    selectCard(null);
    clearMessages();
    addMessage('assistant', '已退出模拟面试，返回普通对话模式。');
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{mode === 'mock' ? '模拟面试' : 'AI 助手'}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {mode === 'mock' ? '按真实面试节奏作答，AI 会即时评分并追问。' : '在浏览器中打开岗位后点击提取分析'}
            </p>
          </div>
          <div className="flex gap-2">
            {pendingAnalysis ? (
              <>
                <button
                  onClick={handleSaveCard}
                  className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Save size={16} />
                  保存为作战卡
                </button>
                <button
                  onClick={handleCancelSave}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-colors"
                >
                  <X size={16} />
                  取消
                </button>
              </>
            ) : null}

            {mode !== 'mock' ? (
              <button
                onClick={handleExtract}
                disabled={Boolean(pendingAnalysis)}
                className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles size={16} />
                提取并分析
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {mode === 'mock' && activeMockCard ? (
        <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 flex items-start justify-between gap-2">
          <p className="text-sm text-indigo-700 min-w-0 break-words">
            正在模拟面试: {activeMockCard.companyName} · {activeMockCard.positionName}
          </p>
          <button
            onClick={handleExitMock}
            className="px-2.5 py-1 text-xs text-indigo-700 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors shrink-0"
          >
            退出模拟面试
          </button>
        </div>
      ) : null}

      <MessageList />

      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder={mode === 'mock' ? '输入你的面试回答...' : '输入消息...'}
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
