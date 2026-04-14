import { configStore } from '../../store';
import { OpenAICompatibleProvider } from './openai-compatible';
import type { AIProvider } from './provider';
import type { ExtractedContent, Analysis, ProfileData } from '../../shared/types';

const CONTENT_PROMPT_LIMIT = 3000;
const RESUME_PROMPT_LIMIT = 2000;

function clampScore(score: unknown): number | null {
  if (typeof score !== 'number' || Number.isNaN(score)) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeAnalysis(value: unknown, hasResume: boolean): Analysis {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<Analysis>;
  return {
    companySummary: typeof raw.companySummary === 'string' ? raw.companySummary : '',
    jdSummary: typeof raw.jdSummary === 'string' ? raw.jdSummary : '',
    experienceSummary: typeof raw.experienceSummary === 'string' ? raw.experienceSummary : '',
    commonQuestions: toStringArray(raw.commonQuestions),
    warnings: toStringArray(raw.warnings),
    checklist: toStringArray(raw.checklist),
    selfIntroduction: typeof raw.selfIntroduction === 'string' ? raw.selfIntroduction : '',
    resumeSuggestions: toStringArray(raw.resumeSuggestions),
    keyPoints: toStringArray(raw.keyPoints),
    matchScore: hasResume ? clampScore(raw.matchScore) : null,
    missingSkills: hasResume ? toStringArray(raw.missingSkills) : [],
    matchSuggestions: hasResume ? toStringArray(raw.matchSuggestions) : []
  };
}

function extractJson(content: string): string {
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1];
  }
  const objectMatch = content.match(/\{[\s\S]*\}/);
  return objectMatch?.[0] ?? content;
}

function buildAnalysisPrompt(extracted: ExtractedContent, profile?: ProfileData): string {
  const hasResume = Boolean(profile?.resumeText?.trim());
  const resumeSnippet = hasResume ? profile!.resumeText.trim().substring(0, RESUME_PROMPT_LIMIT) : '';

  return `你是资深互联网面试官。请根据岗位页面内容输出结构化面试分析。

【页面信息】
标题: ${extracted.title}
URL: ${extracted.url}
类型: ${extracted.pageType}

【页面正文】
${extracted.content.substring(0, CONTENT_PROMPT_LIMIT)}

${hasResume ? `【我的简历】
${resumeSnippet}
` : ''}
请严格输出 JSON 对象（不要输出 markdown）：
{
  "companySummary": "公司业务摘要（约80字）",
  "jdSummary": "JD核心要求摘要",
  "experienceSummary": "面经/准备要点摘要",
  "commonQuestions": ["高频问题1", "高频问题2", "高频问题3", "高频问题4", "高频问题5"],
  "warnings": ["注意事项1", "注意事项2", "注意事项3"],
  "checklist": ["准备项1", "准备项2", "准备项3", "准备项4", "准备项5"],
  "selfIntroduction": "定制1分钟自我介绍",
  "resumeSuggestions": ["简历建议1", "简历建议2", "简历建议3"],
  "keyPoints": ["面试重点1", "面试重点2", "面试重点3"],
  "matchScore": ${hasResume ? '简历与岗位匹配分数（0-100整数）' : 'null'},
  "missingSkills": ${hasResume ? '简历中缺失但岗位看重的技能关键词（最多5条）' : '[]'},
  "matchSuggestions": ${hasResume ? '针对该岗位的简历优化建议（最多5条）' : '[]'}
}`;
}

function createFallbackAnalysis(content: string, hasResume: boolean): Analysis {
  return {
    companySummary: content.substring(0, 200),
    jdSummary: '',
    experienceSummary: '',
    commonQuestions: [],
    warnings: ['AI 返回格式异常，请手动查看原始内容'],
    checklist: [],
    selfIntroduction: '',
    resumeSuggestions: [],
    keyPoints: [],
    matchScore: hasResume ? null : null,
    missingSkills: [],
    matchSuggestions: []
  };
}

export function createProvider(): AIProvider {
  const apiKey = configStore.getApiKey();
  const baseURL = configStore.getApiBaseUrl();
  const model = configStore.getModel();
  return new OpenAICompatibleProvider({ baseURL, model, apiKey });
}

export async function analyzeJobContent(extracted: ExtractedContent, profile?: ProfileData): Promise<Analysis> {
  const apiKey = configStore.getApiKey();
  if (!apiKey) {
    throw new Error('请先配置 API Key');
  }

  const hasResume = Boolean(profile?.resumeText?.trim());
  const provider = createProvider();
  const prompt = buildAnalysisPrompt(extracted, profile);

  const content = await provider.chat(
    [
      { role: 'system', content: '你是专业面试辅导助手，输出必须是严格 JSON。' },
      { role: 'user', content: prompt }
    ],
    { temperature: 0.7, maxTokens: 2000 }
  );

  try {
    const jsonStr = extractJson(content);
    const parsed = JSON.parse(jsonStr);
    return normalizeAnalysis(parsed, hasResume);
  } catch (error) {
    console.error('[analyzeJobContent] Failed to parse AI response as JSON:', error);
    return createFallbackAnalysis(content, hasResume);
  }
}
