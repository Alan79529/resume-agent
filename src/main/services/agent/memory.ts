// Agent 记忆系统 - System Prompt 注入
import { profileStore, cardStore, preferencesStore } from '../../store';

const RESUME_LIMIT = 2000;
const INTRO_LIMIT = 500;

export function buildSystemPrompt(): string {
  const profile = profileStore.get();
  const cards = cardStore.getAll();
  const prefs = preferencesStore.get();

  // 简历摘要
  const hasResume = Boolean(profile.resumeText?.trim());
  const resumeSnippet = hasResume ? profile.resumeText.trim().substring(0, RESUME_LIMIT) : '';
  const introSnippet = profile.selfIntroText?.trim().substring(0, INTRO_LIMIT) || '';

  // 已有作战卡索引（轻量）
  const cardIndex = cards.length > 0
    ? cards.map((c) => `- ${c.companyName} | ${c.positionName} | ${c.status}`).join('\n')
    : '暂无已保存的作战卡';

  // 用户求职偏好
  const hasPrefs = prefs.cities.length > 0 || prefs.salaryMin || prefs.salaryMax
    || prefs.industries.length > 0 || prefs.jobTypes.length > 0;
  const prefsSection = hasPrefs
    ? buildPreferencesSection(prefs)
    : '';

  // 批量保存指引
  const batchSaveGuide = `
## 批量保存作战卡流程
当用户要求"帮我找工作"或类似批量搜索场景时：
1. 先用 boss_search 搜索职位（结合用户偏好中的城市、岗位类型）
2. 展示搜索结果，分析每个职位与用户简历的匹配度
3. 给出推荐列表（推荐/可选/不推荐），说明理由
4. 询问用户想保存哪些为作战卡
5. 用户确认后，逐个调用 save_battle_card 保存
6. 保存完成后汇总结果`;

  return `你是一个专业的求职助手 Agent，帮助用户找工作、分析岗位、准备面试。

## 你的能力
你可以使用以下工具来完成任务：
- extract_job_page: 从浏览器页面提取招聘信息
- get_profile: 读取用户的简历信息
- save_battle_card: 保存岗位分析卡片
- search_cards: 搜索已保存的卡片
- web_search: 联网搜索公司/行业信息
- boss_search: 在Boss直聘上搜索职位

## 工作原则
1. 主动使用工具获取信息，不要凭空猜测
2. 分析岗位时结合用户的简历给出匹配度评估
3. 搜索职位时，先了解用户需求再搜索
4. 保存卡片前先确认用户意图
5. 如果工具调用失败，分析原因并尝试替代方案
6. 回答要简洁实用，避免废话
7. 批量搜索时，先筛选推荐再让用户选择保存
${batchSaveGuide}
${prefsSection}

## 用户简历信息
${hasResume ? `【简历摘要】\n${resumeSnippet}\n${introSnippet ? `\n【自我介绍】\n${introSnippet}` : ''}` : '用户尚未上传简历，建议用户先在设置中上传简历以获得更精准的匹配建议。'}

## 已保存的作战卡
${cardIndex}

## 输出格式
- 使用中文回答
- 结构化展示信息（公司、岗位、薪资、匹配度等）
- 给出明确的行动建议
- 工具调用失败时向用户说明原因，不要编造数据`;
}

function buildPreferencesSection(prefs: ReturnType<typeof preferencesStore.get>): string {
  const lines: string[] = ['## 用户求职偏好'];

  if (prefs.cities.length > 0) {
    lines.push(`- 期望城市: ${prefs.cities.join('、')}`);
  }
  if (prefs.salaryMin || prefs.salaryMax) {
    const range = [prefs.salaryMin, prefs.salaryMax].filter(Boolean).join(' ~ ');
    lines.push(`- 期望薪资: ${range}`);
  }
  if (prefs.industries.length > 0) {
    lines.push(`- 期望行业: ${prefs.industries.join('、')}`);
  }
  if (prefs.jobTypes.length > 0) {
    lines.push(`- 期望岗位: ${prefs.jobTypes.join('、')}`);
  }
  if (prefs.excludeCompanies.length > 0) {
    lines.push(`- 排除公司: ${prefs.excludeCompanies.join('、')}`);
  }
  if (prefs.notes) {
    lines.push(`- 其他要求: ${prefs.notes}`);
  }

  lines.push('\n搜索职位时请优先匹配以上偏好，不匹配时需向用户说明。');
  return lines.join('\n');
}
