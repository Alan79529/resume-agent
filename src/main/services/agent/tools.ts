// Agent 工具注册与执行器
import { cardStore, profileStore, preferencesStore } from '../../store';
import { callPythonTool } from '../python-bridge';
import type { BattleCard } from '../../../shared/types';
import type { ToolDefinition, ToolCall, ToolResult } from './types';

export interface AgentToolContext {
  webContentId?: number;
}

// --- 工具 Schema 定义 (OpenAI function calling format) ---

const EXTRACT_JOB_PAGE: ToolDefinition = {
  name: 'extract_job_page',
  description: '从浏览器当前页面提取招聘信息（JD）。当用户打开了招聘页面时使用此工具提取内容。',
  parameters: {
    webContentId: {
      type: 'number',
      description: '浏览器 webContents ID，用于提取页面内容',
    },
  },
};

const GET_PROFILE: ToolDefinition = {
  name: 'get_profile',
  description: '读取用户的简历和自我介绍信息。当需要了解用户背景来匹配岗位时使用。',
  parameters: {},
};

const SAVE_BATTLE_CARD: ToolDefinition = {
  name: 'save_battle_card',
  description: '保存一个作战卡（岗位分析卡片）。当分析完成，用户确认要保存时使用。',
  parameters: {
    companyName: { type: 'string', description: '公司名称', required: true },
    positionName: { type: 'string', description: '岗位名称', required: true },
    companyLocation: { type: 'string', description: '公司地点' },
    sourceUrl: { type: 'string', description: '来源URL' },
    jdSummary: { type: 'string', description: 'JD核心要求摘要' },
    companySummary: { type: 'string', description: '公司业务摘要' },
    matchScore: { type: 'number', description: '简历匹配分数 0-100' },
  },
};

const SEARCH_CARDS: ToolDefinition = {
  name: 'search_cards',
  description: '搜索已保存的作战卡。当用户想查看之前保存的岗位信息时使用。',
  parameters: {
    keyword: { type: 'string', description: '搜索关键词（公司名或岗位名）', required: true },
  },
};

const WEB_SEARCH: ToolDefinition = {
  name: 'web_search',
  description: '联网搜索信息。当需要搜索公司背景、行业信息、面试经验等时使用。',
  parameters: {
    query: { type: 'string', description: '搜索关键词', required: true },
    numResults: { type: 'number', description: '返回结果数量，默认5' },
  },
};

const BOSS_SEARCH: ToolDefinition = {
  name: 'boss_search',
  description: '在Boss直聘上搜索职位。当用户想找工作时使用此工具搜索职位。',
  parameters: {
    keyword: { type: 'string', description: '搜索关键词，如"Python后端"', required: true },
    city: { type: 'string', description: '城市名称，如"北京"、"上海"，默认全国' },
    page: { type: 'number', description: '页码，默认1' },
  },
};

// 所有工具定义
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  EXTRACT_JOB_PAGE,
  GET_PROFILE,
  SAVE_BATTLE_CARD,
  SEARCH_CARDS,
  WEB_SEARCH,
  BOSS_SEARCH,
];

export function getToolDefinitions(): ToolDefinition[] {
  return TOOL_DEFINITIONS;
}

// --- 工具执行器 ---

async function executeExtractJobPage(args: Record<string, unknown>, context?: AgentToolContext): Promise<unknown> {
  const webContentId = (args.webContentId as number) || context?.webContentId;
  if (!webContentId) {
    throw new Error('缺少 webContentId 参数');
  }

  // 动态导入避免循环依赖
  const { extractWebviewContent } = await import('../webview-extractor');
  return extractWebviewContent(webContentId);
}

async function executeGetProfile(): Promise<unknown> {
  const profile = profileStore.get();
  const RESUME_LIMIT = 2000;
  const INTRO_LIMIT = 500;

  return {
    hasResume: Boolean(profile.resumeText?.trim()),
    resumeTextSnippet: profile.resumeText?.substring(0, RESUME_LIMIT) || '',
    selfIntroTextSnippet: profile.selfIntroText?.substring(0, INTRO_LIMIT) || '',
  };
}

async function executeSaveBattleCard(args: Record<string, unknown>): Promise<unknown> {
  const now = new Date().toISOString();
  const cardId = `card-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const card: BattleCard = {
    id: cardId,
    companyName: (args.companyName as string) || '未知公司',
    companyLocation: (args.companyLocation as string) || '',
    positionName: (args.positionName as string) || '未知岗位',
    status: 'pending_analysis',
    analysis: {
      companySummary: (args.companySummary as string) || '',
      jdSummary: (args.jdSummary as string) || '',
      experienceSummary: '',
      commonQuestions: [],
      warnings: [],
      checklist: [],
      selfIntroduction: '',
      resumeSuggestions: [],
      keyPoints: [],
      matchScore: typeof args.matchScore === 'number' ? args.matchScore : null,
      missingSkills: [],
      matchSuggestions: [],
    },
    schedule: { interviewTime: null, reminderMinutes: 60, location: '' },
    review: {
      actualQuestions: '',
      selfRating: 0,
      answerFeedback: '',
      interviewerFeedback: '',
      salaryRange: '',
      result: 'pending',
      recommend: false,
      notes: '',
    },
    createdAt: now,
    updatedAt: now,
    sourceUrl: (args.sourceUrl as string) || '',
  };

  const existing = cardStore.getAll().find((item) =>
    item.companyName === card.companyName &&
    item.positionName === card.positionName &&
    (!card.sourceUrl || !item.sourceUrl || item.sourceUrl === card.sourceUrl)
  );

  if (existing) {
    cardStore.update(existing.id, {
      ...card,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: now,
    });
    return { cardId: existing.id, companyName: card.companyName, positionName: card.positionName, updated: true };
  }

  cardStore.create(card);
  return { cardId, companyName: card.companyName, positionName: card.positionName, created: true };
}

async function executeSearchCards(args: Record<string, unknown>): Promise<unknown> {
  const keyword = (args.keyword as string)?.trim().toLowerCase() || '';
  if (!keyword) {
    return { cards: [] };
  }

  const allCards = cardStore.getAll();
  const matched = allCards.filter(
    (c) =>
      c.companyName.toLowerCase().includes(keyword) ||
      c.positionName.toLowerCase().includes(keyword)
  );

  return {
    cards: matched.map((c) => ({
      id: c.id,
      companyName: c.companyName,
      positionName: c.positionName,
      status: c.status,
      matchScore: c.analysis.matchScore,
      createdAt: c.createdAt,
    })),
    total: matched.length,
  };
}

async function executeWebSearch(args: Record<string, unknown>): Promise<unknown> {
  const query = args.query as string;
  if (!query?.trim()) {
    throw new Error('缺少搜索关键词');
  }
  const result = await callPythonTool('web_search', {
    query: query.trim(),
    numResults: (args.numResults as number) || 5,
    timeout: 8,
  }, 45000);
  if (result && typeof result === 'object' && typeof (result as { error?: unknown }).error === 'string') {
    throw new Error((result as { error: string }).error);
  }
  return result;
}

async function executeBossSearch(args: Record<string, unknown>, context?: AgentToolContext): Promise<unknown> {
  const keyword = args.keyword as string;
  if (!keyword?.trim()) {
    throw new Error('缺少搜索关键词');
  }
  const webContentId = (args.webContentId as number) || context?.webContentId;
  if (webContentId) {
    const { searchBossInWebview } = await import('../webview-extractor');
    const result = await searchBossInWebview(
      webContentId,
      keyword.trim(),
      (args.city as string) || '鍏ㄥ浗',
      (args.page as number) || 1
    );
    if (result && typeof result.error === 'string') {
      throw new Error(result.error);
    }
    return result;
  }

  const result = await callPythonTool('boss_search', {
    keyword: keyword.trim(),
    city: (args.city as string) || '全国',
    page: (args.page as number) || 1,
  }, 45000);
  if (result && typeof result === 'object' && typeof (result as { error?: unknown }).error === 'string') {
    throw new Error((result as { error: string }).error);
  }
  return result;
}

// --- 工具执行入口 ---

export async function executeTool(toolCall: ToolCall, context?: AgentToolContext): Promise<ToolResult> {
  const { id, name, arguments: args } = toolCall;

  try {
    let result: unknown;

    switch (name) {
      case 'extract_job_page':
        result = await executeExtractJobPage(args, context);
        break;
      case 'get_profile':
        result = await executeGetProfile();
        break;
      case 'save_battle_card':
        result = await executeSaveBattleCard(args);
        break;
      case 'search_cards':
        result = await executeSearchCards(args);
        break;
      case 'web_search':
        result = await executeWebSearch(args);
        break;
      case 'boss_search':
        result = await executeBossSearch(args, context);
        break;
      default:
        throw new Error(`未知工具: ${name}`);
    }

    return { toolCallId: id, name, result };
  } catch (error: any) {
    return { toolCallId: id, name, error: error.message || String(error) };
  }
}
