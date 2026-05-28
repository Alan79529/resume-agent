import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send, Sparkles, Save, X, Bot, Zap, Search, FileText, ChevronDown, ChevronRight, Loader2, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { useChatStore, type AgentStepUI } from '../../stores/chat';
import { useCardsStore } from '../../stores/cards';
import { useWebviewStore } from '../../stores/webview';
import { MessageList } from './MessageList';
import { ToolResultView } from './ToolResultView';
import { api } from '../../utils/ipc';
import type { AgentProgressEvent, AgentRunResult } from '../../utils/ipc';
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
  '女士', '先生', '活跃', '沟通', '微信', '招聘者', '招聘经理',
  '招聘主管', '校招经理', '校园招聘', 'hr', 'HR', '人事', '猎头'
];
const JOB_TOKENS = ['工程师', '开发', '实习', '算法', '测试', '产品', '运营', '岗位', 'AI', 'Agent', '后端', '前端'];
const COMPANY_TOKENS = ['有限公司', '公司', '科技', '信息', '集团', '网络', '教育', '软件', '银行', '研究院'];

function cleanDisplayText(value: string): string {
  const stripPrivateUse = (text: string) =>
    Array.from(text).filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return !((code >= 0xe000 && code <= 0xf8ff) || (code >= 0xf0000 && code <= 0xffffd) || (code >= 0x100000 && code <= 0x10fffd));
    }).join('');
  return stripPrivateUse(String(value || '')).replace(/�/g, '').replace(/[​-‍﻿]/g, '').replace(/﻿/g, '').replace(/\s+/g, ' ').trim();
}

function stripSalaryText(value: string): string {
  return cleanDisplayText(value).replace(/\s*\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\s*(?:k|K|千|万|元\/天|元\/月|万\/年)/g, '');
}

function isRecruiterText(value: string): boolean {
  const text = cleanDisplayText(value);
  if (!text) return false;
  return RECRUITER_TOKENS.some((token) => text.includes(token)) || /^[一-龥]{1,4}(女士|先生)/.test(text);
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
  return /[一-龥A-Za-z]/.test(value);
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
  const parts = cleanTitle.split(/[·|｜-]/).map((part) => stripSalaryText(part)).map((part) => cleanDisplayText(part)).filter(Boolean);
  const dedupedParts = Array.from(new Set(parts));
  const positionName = dedupedParts.find((part) => looksLikeJob(part)) ?? '';
  const companyName = dedupedParts.find((part) => looksLikeCompany(part)) ?? dedupedParts.find((part) => !isRecruiterText(part)) ?? '';
  return { companyName, positionName };
}

// 工具名 -> 图标映射
function getToolIcon(toolName: string): string {
  switch (toolName) {
    case 'extract_job_page': return '📄';
    case 'get_profile': return '👤';
    case 'save_battle_card': return '💾';
    case 'search_cards': return '🔍';
    case 'web_search': return '🌐';
    case 'boss_search': return '💼';
    default: return '🔧';
  }
}

// 工具名 -> 中文名
function getToolLabel(toolName: string): string {
  switch (toolName) {
    case 'extract_job_page': return '提取页面';
    case 'get_profile': return '读取简历';
    case 'save_battle_card': return '保存卡片';
    case 'search_cards': return '搜索卡片';
    case 'web_search': return '联网搜索';
    case 'boss_search': return 'Boss直聘搜索';
    default: return toolName;
  }
}

// 构建执行轨迹摘要
function buildTraceSummary(steps: AgentStepUI[]): string {
  const traceParts: string[] = [];
  for (const step of steps) {
    for (const tc of step.toolCalls) {
      const icon = getToolIcon(tc.name);
      const label = getToolLabel(tc.name);
      if (tc.name === 'save_battle_card') {
        traceParts.push(`${icon} 保存卡片`);
      } else {
        traceParts.push(`${icon} ${label}`);
      }
    }
  }
  // 去重相邻相同项
  const deduped = traceParts.filter((v, i) => i === 0 || v !== traceParts[i - 1]);
  return deduped.join(' → ');
}

// 语音合成朗读
function speakText(text: string, onEnd?: () => void): SpeechSynthesisUtterance | null {
  if (!window.speechSynthesis) return null;
  window.speechSynthesis.cancel();
  // 清理 markdown 标记
  const clean = text.replace(/[*#_`~\[\]()]/g, '').replace(/\n+/g, '。').substring(0, 2000);
  if (!clean.trim()) return null;
  const utter = new SpeechSynthesisUtterance(clean);
  utter.lang = 'zh-CN';
  utter.rate = 1.0;
  utter.onend = () => onEnd?.();
  window.speechSynthesis.speak(utter);
  return utter;
}

// Agent 步骤组件
const AgentStepCard: React.FC<{ step: AgentStepUI }> = ({ step }) => {
  const [expanded, setExpanded] = useState(step.status === 'running');

  const statusIcon = step.status === 'running'
    ? <Loader2 size={14} className="animate-spin text-amber-500" />
    : step.status === 'error'
      ? <span className="text-red-500 text-xs">✕</span>
      : <span className="text-green-500 text-xs">✓</span>;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
      >
        {statusIcon}
        <span className="text-xs font-semibold text-slate-700">步骤 {step.stepNumber}</span>
        <div className="flex flex-1 min-w-0 flex-wrap gap-1 overflow-hidden">
          {step.toolCalls.map((tc, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-xs bg-slate-50 border border-slate-200 rounded-md px-1.5 py-0.5 shrink-0">
              <span>{getToolIcon(tc.name)}</span>
              <span className="text-slate-600">{getToolLabel(tc.name)}</span>
              {tc.success !== undefined && (
                <span className={tc.success ? 'text-green-500' : 'text-red-500'}>
                  {tc.success ? '✓' : '✕'}
                </span>
              )}
            </span>
          ))}
        </div>
        {expanded ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
      </button>
      {expanded && (
        <div className="border-t border-slate-100 px-3 pb-3 pt-2 space-y-2">
          {step.toolCalls.map((tc, i) => (
            <div key={i} className="text-xs text-slate-500">
              <div className="flex min-w-0 items-center gap-1">
                <span className="font-mono">{tc.name}</span>
                {tc.args && <span className="min-w-0 break-all text-slate-400">({tc.args.length > 60 ? tc.args.substring(0, 60) + '...' : tc.args})</span>}
              </div>
              {tc.resultData ? (
                <ToolResultView toolName={tc.name} resultData={tc.resultData} />
              ) : tc.result ? (
                <div className="mt-1 text-slate-600 bg-slate-50 rounded-md px-2 py-1 border border-slate-100">{tc.result.length > 150 ? tc.result.substring(0, 150) + '...' : tc.result}</div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const ChatPanel: React.FC = () => {
  const [input, setInput] = useState('');
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
  const [pendingAnalysis, setPendingAnalysis] = useState<{
    extracted: ExtractedContent;
    analysis: Analysis;
  } | null>(null);
  const [agentTrace, setAgentTrace] = useState<string | null>(null);
  const [pythonReady, setPythonReady] = useState<boolean | null>(null);

  // Mock 语音模式
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const requestIdRef = useRef<string | null>(null);
  const requestModeRef = useRef<'chat' | 'mock' | null>(null);

  const {
    addMessage, updateLastAssistantMessage, clearMessages, setLoading,
    mode, mockCardId, mockMessages, exitMockMode, incrementMockQuestionIndex,
    agentSteps, setAgentMode, addAgentStep, updateLastAgentStep
  } = useChatStore();
  const { createCard, cards, selectedCardId, selectCard, loadCards } = useCardsStore();
  const webviewStore = useWebviewStore();

  const activeMockCard = useMemo(() => {
    if (mode !== 'mock') return null;
    const targetId = mockCardId ?? selectedCardId;
    return cards.find((card) => card.id === targetId) ?? null;
  }, [mode, mockCardId, selectedCardId, cards]);

  const hasActiveRun = Boolean(requestIdRef.current);

  useEffect(() => {
    let ignore = false;
    api.getProfile().then((value) => { if (!ignore) setProfile(value ?? DEFAULT_PROFILE); });
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    if (mode !== 'mock') return;
    let ignore = false;
    api.getProfile().then((value) => { if (!ignore) setProfile(value ?? DEFAULT_PROFILE); });
    return () => { ignore = true; };
  }, [mode]);

  // Chat stream listeners
  useEffect(() => {
    const unsubscribeChunk = api.onChatStreamChunk((requestId, chunk) => {
      if (requestIdRef.current === requestId) updateLastAssistantMessage(chunk);
    });
    const unsubscribeDone = api.onChatStreamDone((requestId) => {
      if (requestIdRef.current === requestId) {
        if (requestModeRef.current === 'mock') incrementMockQuestionIndex();
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
    return () => { unsubscribeChunk(); unsubscribeDone(); unsubscribeError(); };
  }, [incrementMockQuestionIndex, setLoading, updateLastAssistantMessage]);

  // Agent progress listeners
  useEffect(() => {
    if (mode !== 'agent') return;

    const unsubscribeProgress = api.onAgentProgress((event: AgentProgressEvent) => {
      switch (event.type) {
        case 'step_start':
          addAgentStep({ stepNumber: event.step!, status: 'running', toolCalls: [] });
          break;
        case 'tool_call': {
          const currentSteps = useChatStore.getState().agentSteps;
          updateLastAgentStep({
            toolCalls: [
              ...(currentSteps[currentSteps.length - 1]?.toolCalls || []),
              { name: event.toolName!, args: JSON.stringify(event.args || {}).substring(0, 100) }
            ]
          });
          break;
        }
        case 'tool_result': {
          const currentSteps = useChatStore.getState().agentSteps;
          const currentStep = currentSteps[currentSteps.length - 1];
          if (currentStep) {
            const updatedCalls = [...currentStep.toolCalls];
            const lastCall = updatedCalls[updatedCalls.length - 1];
            if (lastCall && lastCall.name === event.toolName) {
              lastCall.success = event.success;
              if (event.result !== undefined) {
                lastCall.resultData = event.result;
              }
            }
            updateLastAgentStep({ toolCalls: updatedCalls });
          }
          break;
        }
        case 'step_end':
          updateLastAgentStep({ status: 'done' });
          break;
        case 'error':
          updateLastAgentStep({ status: 'error' });
          break;
      }
    });

    const unsubscribeDone = api.onAgentDone((result: AgentRunResult) => {
      addMessage('assistant', result.finalAnswer);
      const savedCardIds = result.artifacts?.cardIds ?? [];
      if (savedCardIds.length > 0) {
        void loadCards().then(() => {
          selectCard(savedCardIds[savedCardIds.length - 1]);
        });
      }
      // 构建执行轨迹
      const currentSteps = useChatStore.getState().agentSteps;
      const trace = buildTraceSummary(currentSteps);
      if (trace) setAgentTrace(trace);
      setLoading(false);
    });

    const unsubscribeError = api.onAgentError((error: string) => {
      let msg = `Agent 执行出错: ${error}`;
      if (error.includes('Python sidecar is not running')) {
        msg = '⚠️ Python 子进程未就绪。请确认已安装 Python 依赖（pip install -r requirements.txt），然后重启应用。';
      } else if (error.includes('timed out')) {
        msg = '⏱️ 操作超时，搜索或爬虫可能被目标网站限流。请稍后重试。';
      } else if (error.includes('AGENT_BUSY')) {
        msg = '⏳ 已有 Agent 任务在运行中，请等待当前任务完成。';
      }
      addMessage('assistant', msg);
      setLoading(false);
    });

    return () => { unsubscribeProgress(); unsubscribeDone(); unsubscribeError(); };
  }, [mode, addAgentStep, updateLastAgentStep, addMessage, setLoading, loadCards, selectCard]);

  // Mock mode auto-start
  useEffect(() => {
    if (mode !== 'mock' || !activeMockCard || mockMessages.length > 0 || requestIdRef.current) return;
    const requestId = Math.random().toString(36).substring(2, 9);
    requestIdRef.current = requestId;
    requestModeRef.current = 'mock';
    setLoading(true);
    addMessage('assistant', '');
    const systemPrompt = buildMockPrompt(activeMockCard, profile);
    api.chatStream([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '请开始面试，先做开场并提出第一个问题。' }
    ], requestId);
  }, [activeMockCard, addMessage, mockMessages.length, mode, profile, setLoading]);

  // Mock 模式语音朗读 AI 回答
  useEffect(() => {
    if (mode !== 'mock' || !voiceEnabled) return;
    const unsubscribeDone = api.onChatStreamDone((requestId) => {
      if (requestIdRef.current === requestId) {
        // 找到最后一条 assistant 消息并朗读
        const msgs = useChatStore.getState().messages;
        const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant');
        if (lastAssistant?.content) {
          speakText(lastAssistant.content);
        }
      }
    });
    return () => { unsubscribeDone(); };
  }, [mode, voiceEnabled]);

  // 语音识别（SpeechRecognition）
  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addMessage('assistant', '当前浏览器不支持语音识别，请使用 Chrome。');
      return;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => prev + transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [addMessage]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  // 切换模式时清理语音
  useEffect(() => {
    if (mode !== 'mock') {
      window.speechSynthesis?.cancel();
      recognitionRef.current?.stop();
      setIsListening(false);
    }
  }, [mode]);

  const handleSend = () => {
    const userInput = input.trim();
    if (!userInput || hasActiveRun) return;
    setInput('');

    if (mode === 'agent') {
      // Agent 模式
      setLoading(true);
      addMessage('user', userInput);
      addMessage('assistant', '');

      const activeTab = webviewStore.tabs.find((tab) => tab.isActive);
      const recentMessages = useChatStore.getState().messages
        .filter((message) => message.content.trim())
        .slice(-8)
        .map((message) => ({
          role: message.role,
          content: message.content.substring(0, 2000)
        }));
      const webviewContext = activeTab
        ? (() => {
            const webview = document.querySelector(`webview[data-tab-id="${activeTab.id}"]`) as Electron.WebviewTag | null;
            return webview ? { webContentId: webview.getWebContentsId() } : {};
          })()
        : {};
      const context = { ...webviewContext, recentMessages };

      api.agentRun(userInput, context).catch((err) => {
        const errMsg = err.message || '';
        let msg = `Agent 启动失败: ${errMsg}`;
        if (errMsg.includes('AGENT_BUSY')) {
          msg = '⏳ 已有 Agent 任务在运行中，请等待完成后再试。';
        } else if (errMsg.includes('Python sidecar is not running')) {
          msg = '⚠️ Python 子进程未就绪，请等待几秒后重试。';
        }
        addMessage('assistant', msg);
        setLoading(false);
      });
      return;
    }

    // 普通聊天 / Mock 模式
    const requestId = Math.random().toString(36).substring(2, 9);
    requestIdRef.current = requestId;
    requestModeRef.current = mode;
    setLoading(true);

    if (mode === 'mock' && activeMockCard) {
      const history = mockMessages.map((m) => ({ role: m.role, content: m.content })) as AIChatMessage[];
      addMessage('user', userInput);
      addMessage('assistant', '');
      api.chatStream([
        { role: 'system', content: buildMockPrompt(activeMockCard, profile) },
        ...history,
        { role: 'user', content: userInput }
      ], requestId);
      return;
    }

    addMessage('user', userInput);
    addMessage('assistant', '');
    api.chatStream([
      { role: 'system', content: '你是专业面试辅导助手，请用简洁实用的方式回答。' },
      { role: 'user', content: userInput }
    ], requestId);
  };

  const handleExtract = async () => {
    if (hasActiveRun) return;
    const activeTab = webviewStore.tabs.find((tab) => tab.isActive);
    if (!activeTab) { addMessage('assistant', '请先在右侧浏览器中打开岗位页面。'); return; }

    setLoading(true);
    addMessage('assistant', '正在提取网页内容...');

    try {
      const webview = document.querySelector(`webview[data-tab-id="${activeTab.id}"]`) as Electron.WebviewTag | null;
      if (!webview) throw new Error('未找到浏览器窗口');

      const extracted = await api.extractWebview(webview.getWebContentsId());
      addMessage('assistant', `已提取: ${extracted.title}\n类型: ${extracted.pageType}\n正文长度: ${extracted.content.length} 字\n\n正在请求 AI 分析，预计 15-30 秒...`);

      const analysis = await api.analyzeContent(extracted);
      setPendingAnalysis({ extracted, analysis });

      const summary = `## 分析完成\n\n**${extracted.title}**\n\n**公司业务**: ${analysis.companySummary}\n\n**高频问题**:\n${analysis.commonQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n**注意事项**:\n${analysis.warnings.map((w) => `- ${w}`).join('\n')}\n\n**简历匹配**:\n${getMatchSummary(analysis)}\n\n点击"保存为作战卡"将结果存档。`;
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

    const fromTitle = parseFromTitle(extracted.title);
    let companyName = fromTitle.companyName;
    let positionName = fromTitle.positionName;
    const content = extracted.content;

    if (!companyName || !positionName) {
      const topLines = content.split('\n').map((line) => cleanDisplayText(line)).filter(Boolean).slice(0, 40);
      for (const line of topLines) {
        if (!positionName && looksLikeJob(line)) positionName = stripSalaryText(line);
        if (!companyName && looksLikeCompany(line)) companyName = line;
        if (companyName && positionName) break;
      }
    }

    companyName = normalizeCompanyName(companyName);
    positionName = normalizePositionName(positionName);

    let companyLocation = '';
    const locationMatch = content.match(/工作地[点址]?[：:\s]+([^\n,，]+)/i);
    if (locationMatch?.[1]) companyLocation = cleanDisplayText(locationMatch[1]);

    await createCard({
      companyName, companyLocation, positionName, status: 'preparing',
      analysis: { ...analysis, matchScore: analysis.matchScore ?? null, missingSkills: analysis.missingSkills ?? [], matchSuggestions: analysis.matchSuggestions ?? [] },
      schedule: { interviewTime: null, reminderMinutes: 60, location: '' },
      review: { actualQuestions: '', selfRating: 3, answerFeedback: '', interviewerFeedback: '', salaryRange: '', result: 'pending', recommend: false, notes: '' },
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

  const toggleAgentMode = () => {
    setAgentMode(mode !== 'agent');
    setAgentTrace(null);
  };

  const placeholderText = mode === 'mock'
    ? '输入你的面试回答...'
    : mode === 'agent'
      ? '告诉我你想找什么样的工作...'
      : '输入消息...';

  return (
    <div className="h-full min-w-0 flex flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white/95 px-5 py-4 min-w-0">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-slate-950">
              {mode === 'mock' ? '模拟面试' : mode === 'agent' ? 'Agent 模式' : 'AI 助手'}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {mode === 'mock'
                ? '按真实面试节奏作答，AI 会即时评分并追问。'
                : mode === 'agent'
                  ? 'Agent 自主使用工具完成求职任务'
                  : '在浏览器中打开岗位后点击提取分析'}
            </p>
          </div>
          <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
            {pendingAnalysis && mode !== 'agent' && (
              <>
                <button onClick={handleSaveCard} className="flex shrink-0 items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700">
                  <Save size={16} /> 保存为作战卡
                </button>
                <button onClick={handleCancelSave} className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                  <X size={16} /> 取消
                </button>
              </>
            )}

            {mode !== 'mock' && (
              <>
                <button
                  onClick={toggleAgentMode}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    mode === 'agent'
                      ? 'bg-slate-900 text-white hover:bg-slate-800'
                      : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100'
                  }`}
                >
                  <Zap size={16} />
                  {mode === 'agent' ? '退出 Agent' : 'Agent 模式'}
                </button>
                {mode !== 'agent' && (
                  <button
                    onClick={handleExtract}
                    disabled={Boolean(pendingAnalysis) || hasActiveRun}
                    className="flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles size={16} /> 提取并分析
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mock mode banner */}
      {mode === 'mock' && activeMockCard && (
        <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between gap-2">
          <p className="text-sm text-indigo-700 min-w-0 break-words">
            正在模拟面试: {activeMockCard.companyName} · {activeMockCard.positionName}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`p-1.5 rounded-md transition-colors ${
                voiceEnabled ? 'bg-indigo-200 text-indigo-800' : 'text-indigo-400 hover:bg-indigo-100'
              }`}
              title={voiceEnabled ? '关闭语音' : '开启语音（AI朗读+语音输入）'}
            >
              {voiceEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>
            <button onClick={handleExitMock} className="px-2.5 py-1 text-xs text-indigo-700 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors">
              退出
            </button>
          </div>
        </div>
      )}

      {/* Agent steps */}
      {mode === 'agent' && agentSteps.length > 0 && (
        <div className="mx-5 mt-3 max-h-[34vh] space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
          {agentSteps.map((step) => (
            <AgentStepCard key={step.stepNumber} step={step} />
          ))}
          {agentTrace && (
            <div className="flex min-w-0 items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 overflow-hidden">
              <span className="shrink-0 font-medium">执行轨迹:</span>
              <span className="truncate">{agentTrace}</span>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <MessageList />

      {/* Input */}
      <div className="border-t border-slate-200 bg-white px-5 py-4">
        <div className="flex min-w-0 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5 shadow-sm">
          {/* Mock 语音模式麦克风按钮 */}
          {mode === 'mock' && voiceEnabled && (
            <button
              onClick={isListening ? stopListening : startListening}
              className={`p-2 rounded-lg transition-colors shrink-0 ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
              title={isListening ? '停止录音' : '语音输入'}
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={hasActiveRun}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder={isListening ? '正在录音...' : placeholderText}
            className="min-w-0 flex-1 rounded-lg border-0 bg-transparent px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:text-slate-400"
          />
          <button
            onClick={handleSend}
            disabled={hasActiveRun}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
