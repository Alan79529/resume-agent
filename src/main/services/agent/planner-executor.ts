import type { AIChatMessage, AIToolCall } from '../ai/provider';
import type {
  AgentProgressPayload,
  AgentRunArtifacts,
  AgentRunResult,
  AgentRunTrace,
  AgentToolExecutionResult,
  AgentToolName,
  AgentToolRuntime,
  RunPlannerExecutorInput,
} from './types';

const DEFAULT_MAX_STEPS = 6;
const MAX_CONTENT_SNIPPET = 1200;
const SELF_HEALING_HINT =
  'The previous tool call failed. Analyze the error, decide whether to retry with different arguments or explain the blocker to the user. Do not repeat identical arguments indefinitely.';
const CIRCUIT_BREAKER_MESSAGE = '检测到重复工具调用死循环，任务已提前中止。';
const ABORT_ERROR_MESSAGE = 'Agent run aborted';

function createAbortError(): Error {
  const error = new Error(ABORT_ERROR_MESSAGE);
  error.name = 'AbortError';
  return error;
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function normalizeArguments(argumentsJson: string): string {
  const trimmed = argumentsJson.trim();
  if (!trimmed) return '{}';
  try {
    const parsed = JSON.parse(trimmed);
    return stableStringify(parsed);
  } catch {
    return trimmed;
  }
}

function fingerprintToolCall(call: AIToolCall): string {
  return `${call.function.name}::${normalizeArguments(call.function.arguments)}`;
}

function emptyTrace(runId: string): AgentRunTrace {
  return {
    runId,
    steps: 0,
    toolCalls: [],
    errors: [],
  };
}

function emptyArtifacts(): AgentRunArtifacts {
  return {};
}

function compressToolPayload(
  step: number,
  toolName: AgentToolName,
  toolResult: AgentToolExecutionResult,
  includeFullExtractContent: boolean
): Record<string, unknown> {
  if (!toolResult.ok) {
    return {
      step,
      toolName,
      ok: false,
      errorCode: toolResult.errorCode,
      message: toolResult.message,
    };
  }

  if (toolName === 'extract_job_page') {
    const data = toolResult.data as {
      title?: string;
      companyName?: string;
      positionName?: string;
      salaryRange?: string;
      requirementsSummary?: string;
      url?: string;
      content?: string;
    };

    return {
      step,
      toolName,
      ok: true,
      title: data.title ?? '',
      companyName: data.companyName ?? '',
      positionName: data.positionName ?? '',
      salaryRange: data.salaryRange ?? '',
      requirementsSummary: data.requirementsSummary ?? '',
      url: data.url ?? '',
      contentSnippet: String(data.content ?? '').slice(0, MAX_CONTENT_SNIPPET),
      ...(includeFullExtractContent
        ? {
            content: String(data.content ?? ''),
            contentDropped: false,
          }
        : { contentDropped: true }),
    };
  }

  return {
    step,
    toolName,
    ok: true,
    data: toolResult.data,
  };
}

function buildSystemPrompt(): string {
  return [
    'You are Agent 2.0 running a single-loop planner/executor.',
    'Use only these tools: extract_job_page, get_profile, save_battle_card.',
    'Prefer concise progress and act deterministically.',
    'When a tool fails, self-heal before retrying. Avoid repeating identical tool calls.',
  ].join(' ');
}

function buildUserPrompt(userInstruction: string, webContentId: number): string {
  return [
    `User instruction: ${userInstruction.trim() || 'Extract the current job page and create a battle card.'}`,
    `webContentId: ${webContentId}`,
    'If needed, first extract the page, then read the profile, then save the battle card.',
  ].join('\n');
}

async function executeToolCall(
  tools: AgentToolRuntime,
  call: AIToolCall,
  signal?: AbortSignal
): Promise<{ result: AgentToolExecutionResult; durationMs: number }> {
  const startedAt = Date.now();
  const result = await tools.execute({
    name: call.function.name,
    argumentsJson: call.function.arguments,
    signal,
  });
  return {
    result,
    durationMs: Date.now() - startedAt,
  };
}

export async function runPlannerExecutor(input: RunPlannerExecutorInput): Promise<AgentRunResult> {
  const maxSteps = input.maxSteps ?? input.request.maxSteps ?? DEFAULT_MAX_STEPS;
  const trace = emptyTrace(input.request.requestId);
  const artifacts = emptyArtifacts();
  const messages: AIChatMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: buildUserPrompt(input.request.userInstruction, input.request.webContentId) },
  ];

  let previousFingerprint = '';
  let repeatedSameCallCount = 0;
  let fullExtractContentIncluded = false;

  for (let step = 1; step <= maxSteps; step += 1) {
    assertNotAborted(input.signal);
    trace.steps = step;
    input.onProgress?.({
      runId: input.request.requestId,
      step,
      phase: 'model',
      message: `step ${step}: planning`,
    });

    const response = await input.provider.chatWithTools(messages, input.tools.definitions, {
      temperature: 0.7,
      maxTokens: 2000,
      toolChoice: 'auto',
      signal: input.signal,
    });

    if (!response.toolCalls.length) {
      input.onProgress?.({
        runId: input.request.requestId,
        step,
        phase: 'final',
        message: `step ${step}: finalizing`,
      });

      return {
        finalAnswer: response.content.trim() || 'Task completed without a textual final answer.',
        trace,
        artifacts,
      };
    }

    messages.push({
      role: 'assistant',
      content: response.content ?? '',
      tool_calls: response.toolCalls,
    });

    for (const call of response.toolCalls) {
      assertNotAborted(input.signal);
      const fingerprint = fingerprintToolCall(call);
      repeatedSameCallCount = fingerprint === previousFingerprint ? repeatedSameCallCount + 1 : 1;
      previousFingerprint = fingerprint;

      if (repeatedSameCallCount >= 3) {
        trace.errors.push(`CIRCUIT_BREAKER: ${fingerprint}`);
        return {
          finalAnswer: CIRCUIT_BREAKER_MESSAGE,
          trace,
          artifacts,
        };
      }

      input.onProgress?.({
        runId: input.request.requestId,
        step,
        phase: 'tool',
        message: `step ${step}: ${call.function.name}`,
      });

      const { result, durationMs } = await executeToolCall(input.tools, call, input.signal);
      trace.toolCalls.push({
        step,
        toolName: call.function.name as AgentToolName,
        argumentsJson: call.function.arguments,
        ok: result.ok,
        durationMs,
        errorCode: result.ok ? undefined : result.errorCode,
      });

      if (result.ok && call.function.name === 'save_battle_card') {
        const data = result.data as { cardId?: string; companyName?: string; positionName?: string };
        if (typeof data.cardId === 'string') {
          artifacts.cardId = data.cardId;
        }
        if (typeof data.companyName === 'string') {
          artifacts.companyName = data.companyName;
        }
        if (typeof data.positionName === 'string') {
          artifacts.positionName = data.positionName;
        }
      }

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        name: call.function.name,
        content: JSON.stringify(
          compressToolPayload(
            step,
            call.function.name as AgentToolName,
            result,
            call.function.name === 'extract_job_page' && !fullExtractContentIncluded
          )
        ),
      });

      if (result.ok && call.function.name === 'extract_job_page') {
        fullExtractContentIncluded = true;
      }

      if (!result.ok) {
        trace.errors.push(`${call.function.name}:${result.errorCode}`);
        messages.push({
          role: 'system',
          content: SELF_HEALING_HINT,
        });
      }
    }
  }

  trace.errors.push('MAX_STEPS_EXCEEDED');
  return {
    finalAnswer: 'Agent run stopped after reaching the maximum step limit.',
    trace,
    artifacts,
  };
}
