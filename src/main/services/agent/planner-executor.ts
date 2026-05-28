// Agent 主循环 - Planner/Executor
import { createProvider } from '../ai';
import { buildSystemPrompt } from './memory';
import { getToolDefinitions, executeTool } from './tools';
import type { AIChatMessage } from '../../../shared/types';
import type { AgentStep, AgentRunResult, AgentProgressEvent, ToolCall } from './types';

const MAX_STEPS = 6;
const MAX_TOOL_RETRIES = 2;
const SUMMARY_MAX_LEN = 500;

function logAgent(message: string, details?: unknown): void {
  if (details === undefined) {
    console.log(`[agent] ${message}`);
    return;
  }

  try {
    console.log(`[agent] ${message}`, JSON.stringify(details).substring(0, 1200));
  } catch {
    console.log(`[agent] ${message}`, String(details));
  }
}

function generateToolCallId(): string {
  return `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

// 将工具定义转换为 OpenAI function calling 格式
function toOpenAITools(definitions: ReturnType<typeof getToolDefinitions>) {
  return definitions.map((def) => ({
    type: 'function' as const,
    function: {
      name: def.name,
      description: def.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(def.parameters).map(([key, param]) => [
            key,
            { type: param.type, description: param.description },
          ])
        ),
        required: Object.entries(def.parameters)
          .filter(([_, param]) => param.required)
          .map(([key]) => key),
      },
    },
  }));
}

// 压缩工具结果为摘要（减少后续轮次的上下文大小）
function compressToolResult(name: string, result: unknown, error?: string): string {
  if (error) {
    return `错误: ${error}`;
  }

  if (!result) return '(无结果)';

  // web_search: 只保留标题列表
  if (name === 'web_search' && result && typeof result === 'object') {
    const data = result as { results?: Array<{ title: string; url: string }>; source?: string };
    if (data.results?.length) {
      const titles = data.results.map((r, i) => `${i + 1}. ${r.title} (${r.url})`).join('\n');
      return `[${data.source || 'search'}] 找到 ${data.results.length} 条结果:\n${titles}`;
    }
    return data.source ? `[${data.source}] 未找到结果` : '未找到结果';
  }

  // boss_search: 只保留职位列表摘要
  if (name === 'boss_search' && result && typeof result === 'object') {
    const data = result as { jobs?: Array<{ title: string; company: string; salary: string }>; source?: string };
    if (data.jobs?.length) {
      const jobs = data.jobs.map((j, i) => `${i + 1}. ${j.title} | ${j.company} | ${j.salary}`).join('\n');
      return `[zhipin] 找到 ${data.jobs.length} 个职位:\n${jobs}`;
    }
    return '未找到职位';
  }

  // save_battle_card: 简短确认
  if (name === 'save_battle_card' && result && typeof result === 'object') {
    const data = result as { companyName?: string; positionName?: string; cardId?: string };
    return `已保存: ${data.companyName || '?'} · ${data.positionName || '?'}`;
  }

  // 其他工具: 截断 JSON
  const json = JSON.stringify(result);
  return json.length > SUMMARY_MAX_LEN ? json.substring(0, SUMMARY_MAX_LEN) + '...' : json;
}

export async function runPlannerExecutor(
  userMessage: string,
  onProgress: (event: AgentProgressEvent) => void,
  context?: { webContentId?: number }
): Promise<AgentRunResult> {
  logAgent('run started', { messageLength: userMessage.length, webContentId: context?.webContentId });
  const provider = createProvider();
  const systemPrompt = buildSystemPrompt();
  const toolDefs = getToolDefinitions();
  const openAITools = toOpenAITools(toolDefs);

  const messages: AIChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  const steps: AgentStep[] = [];
  const createdCardIds: string[] = [];
  let finalAnswer = '';

  for (let stepNum = 1; stepNum <= MAX_STEPS; stepNum++) {
    logAgent('step started', { step: stepNum, messageCount: messages.length });
    onProgress({ type: 'step_start', step: stepNum });

    const step: AgentStep = {
      stepNumber: stepNum,
      toolCalls: [],
      toolResults: [],
      timestamp: new Date().toISOString(),
    };

    try {
      const response = await provider.chatWithTools(messages, toolDefs, {
        temperature: 0.7,
        maxTokens: 2000,
      });
      logAgent('model response received', {
        step: stepNum,
        hasContent: Boolean(response.content),
        hasReasoning: Boolean(response.reasoningContent),
        toolCalls: response.toolCalls.map((tool) => tool.name),
      });

      if (response.content) {
        step.thinking = response.content;
      }

      // 没有工具调用 = 最终回答
      if (!response.toolCalls || response.toolCalls.length === 0) {
        finalAnswer = response.content || '无法生成回答';
        step.response = finalAnswer;
        steps.push(step);
        logAgent('final answer received', { step: stepNum, answerLength: finalAnswer.length });
        onProgress({ type: 'answer', content: finalAnswer });
        onProgress({ type: 'step_end', step: stepNum });
        break;
      }

      step.toolCalls = response.toolCalls;

      // 把 assistant 的工具调用消息加入对话
      messages.push({
        role: 'assistant',
        content: response.content || '',
        reasoning_content: response.reasoningContent,
        tool_calls: response.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })),
      });

      for (const toolCall of response.toolCalls) {
        logAgent('tool call started', {
          step: stepNum,
          tool: toolCall.name,
          args: toolCall.arguments,
        });
        onProgress({ type: 'tool_call', toolName: toolCall.name, args: toolCall.arguments });

        const result = await executeTool(toolCall, context);
        step.toolResults.push(result);

        const success = !result.error;
        logAgent('tool call finished', {
          step: stepNum,
          tool: toolCall.name,
          success,
          error: result.error,
        });
        onProgress({ type: 'tool_result', toolName: toolCall.name, success, result: result.result });

        if (toolCall.name === 'save_battle_card' && success && result.result) {
          const r = result.result as { cardId?: string };
          if (r.cardId) createdCardIds.push(r.cardId);
        }

        // 从第二步开始，压缩工具结果以减少上下文
        const contentForLLM = stepNum >= 2
          ? compressToolResult(toolCall.name, result.result, result.error)
          : (result.error ? `错误: ${result.error}` : JSON.stringify(result.result));

        messages.push({
          role: 'tool',
          tool_call_id: result.toolCallId,
          name: result.name,
          content: contentForLLM,
        });
      }

      // 最后一步强制要求最终回答
      if (stepNum === MAX_STEPS) {
        messages.push({
          role: 'user',
          content: '已达到最大步骤数。请根据已收集的信息立即给出最终回答，不要再调用工具。',
        });
      }

      if (stepNum === MAX_STEPS && !finalAnswer) {
        finalAnswer = await provider.chat(messages, { temperature: 0.5, maxTokens: 1800 });
        step.response = finalAnswer;
        logAgent('forced final answer received', { step: stepNum, answerLength: finalAnswer.length });
        onProgress({ type: 'answer', content: finalAnswer });
      }

      steps.push(step);
      onProgress({ type: 'step_end', step: stepNum });
    } catch (error: any) {
      const errorMsg = error.message || 'Agent 执行出错';
      logAgent('run failed', { step: stepNum, error: errorMsg });
      step.response = errorMsg;
      steps.push(step);
      onProgress({ type: 'error', message: errorMsg });

      finalAnswer = finalAnswer || `执行过程中出现错误: ${errorMsg}`;
      break;
    }
  }

  if (!finalAnswer) {
    finalAnswer = `Agent 已执行 ${steps.length} 步但未能生成最终回答。请尝试更具体地描述你的需求。`;
  }

  logAgent('run finished', {
    steps: steps.length,
    hasArtifacts: createdCardIds.length > 0,
    finalAnswerLength: finalAnswer.length,
  });

  return {
    finalAnswer,
    steps,
    artifacts: createdCardIds.length > 0 ? { cardIds: createdCardIds } : undefined,
  };
}
