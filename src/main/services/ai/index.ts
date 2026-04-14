import { configStore } from '../../store';
import { OpenAICompatibleProvider } from './openai-compatible';
import type { AIProvider } from './provider';
import type { ExtractedContent, Analysis } from '../../shared/types';

export function createProvider(): AIProvider {
  const apiKey = configStore.getApiKey();
  const baseURL = configStore.getApiBaseUrl();
  const model = configStore.getModel();
  return new OpenAICompatibleProvider({ baseURL, model, apiKey });
}

export async function analyzeJobContent(extracted: ExtractedContent): Promise<Analysis> {
  const apiKey = configStore.getApiKey();

  if (!apiKey) {
    throw new Error('请先配置 API Key');
  }

  const provider = createProvider();

  const prompt = `你是一个资深的互联网大厂面试官。请根据以下信息为求职者生成面试策略：

【页面内容】
标题: ${extracted.title}
URL: ${extracted.url}
类型: ${extracted.pageType}

内容:
${extracted.content.substring(0, 3000)}

请输出以下内容的 JSON 格式：
{
  "companySummary": "公司业务摘要（50字左右）",
  "jdSummary": "JD核心要求摘要",
  "experienceSummary": "面经要点摘要",
  "commonQuestions": ["高频问题1", "高频问题2", "高频问题3", "高频问题4", "高频问题5"],
  "warnings": ["注意事项1", "注意事项2", "注意事项3"],
  "checklist": ["准备事项1", "准备事项2", "准备事项3", "准备事项4", "准备事项5"],
  "selfIntroduction": "定制版1分钟自我介绍（200字左右）",
  "resumeSuggestions": ["简历建议1", "简历建议2", "简历建议3"],
  "keyPoints": ["八股重点1", "八股重点2", "八股重点3"]
}`;

  const content = await provider.chat(
    [
      { role: 'system', content: '你是一个专业的面试辅导助手，帮助求职者准备技术面试。' },
      { role: 'user', content: prompt }
    ],
    { temperature: 0.7, maxTokens: 2000 }
  );

  const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/({[\s\S]*?})/);
  const jsonStr = jsonMatch ? jsonMatch[1] : content;

  try {
    const analysis: Analysis = JSON.parse(jsonStr);
    return analysis;
  } catch (e) {
    console.error('[analyzeJobContent] Failed to parse AI response as JSON:', e);
    return {
      companySummary: content.substring(0, 200),
      jdSummary: '',
      experienceSummary: '',
      commonQuestions: [],
      warnings: ['AI 返回格式异常，请手动查看原始内容'],
      checklist: [],
      selfIntroduction: '',
      resumeSuggestions: [],
      keyPoints: []
    };
  }
}
