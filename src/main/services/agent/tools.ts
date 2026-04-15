import type {
  AgentToolDependencies,
  AgentToolDefinition,
  AgentToolExecutionInput,
  AgentToolExecutionFailure,
  AgentToolExecutionResult,
  AgentToolRuntime,
  SaveBattleCardInput,
} from './types';

function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';

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

  return stripPrivateUse(value)
    .replace(/\uFFFD/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\ufeff/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function limitText(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function normalizeHumanText(value: unknown, fallback: string): string {
  const text = cleanText(value);
  return text || fallback;
}

function sanitizeSaveBattleCardInput(input: SaveBattleCardInput): SaveBattleCardInput {
  return {
    ...input,
    companyName: normalizeHumanText(input.companyName, 'Unknown Company'),
    positionName: normalizeHumanText(input.positionName, 'Unknown Position'),
    sourceUrl: cleanText(input.sourceUrl),
    companyLocation: cleanText(input.companyLocation ?? ''),
  };
}

function toToolExecutionFailure(errorCode: AgentToolExecutionFailure['errorCode'], message: string): AgentToolExecutionResult {
  return {
    ok: false,
    errorCode,
    message,
  };
}

export const AGENT_TOOL_DEFINITIONS: AgentToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'extract_job_page',
      description: 'Extract structured job page content from the active web contents.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          webContentId: { type: 'number' },
        },
        required: ['webContentId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_profile',
      description: 'Read the current profile with fields reduced to safe snippets.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_battle_card',
      description: 'Persist a battle card with normalized fields.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          companyName: { type: 'string' },
          positionName: { type: 'string' },
          sourceUrl: { type: 'string' },
          companyLocation: { type: 'string' },
          analysis: { type: 'object' },
          schedule: { type: 'object' },
          review: { type: 'object' },
        },
        required: ['companyName', 'positionName', 'sourceUrl'],
      },
    },
  },
];

export function createAgentTools(dependencies: AgentToolDependencies): AgentToolRuntime {
  async function execute(input: AgentToolExecutionInput): Promise<AgentToolExecutionResult> {
    if (!AGENT_TOOL_DEFINITIONS.some((definition) => definition.function.name === input.name)) {
      return toToolExecutionFailure('TOOL_NOT_ALLOWED', `Tool not allowed: ${input.name}`);
    }

    let parsed: Record<string, unknown> = {};
    if (input.argumentsJson.trim()) {
      try {
        parsed = JSON.parse(input.argumentsJson) as Record<string, unknown>;
      } catch {
        return toToolExecutionFailure('TOOL_ARGUMENT_INVALID', 'Tool arguments must be valid JSON.');
      }
    }

    try {
      if (input.name === 'extract_job_page') {
        const webContentId = Number(parsed.webContentId);
        if (!Number.isFinite(webContentId)) {
          return toToolExecutionFailure('TOOL_ARGUMENT_INVALID', 'webContentId is required.');
        }
        const data = await dependencies.extractJobPage(webContentId, input.signal);
        return { ok: true, data };
      }

      if (input.name === 'get_profile') {
        const profile = dependencies.getProfile();
        return {
          ok: true,
          data: {
            resumeTextSnippet: limitText(cleanText(profile.resumeText), 1200),
            selfIntroTextSnippet: limitText(cleanText(profile.selfIntroText), 600),
            hasResume: Boolean(cleanText(profile.resumeText)),
          },
        };
      }

      const payload = sanitizeSaveBattleCardInput(parsed as SaveBattleCardInput);
      if (!payload.companyName || !payload.positionName || !payload.sourceUrl) {
        return toToolExecutionFailure('TOOL_ARGUMENT_INVALID', 'companyName, positionName, and sourceUrl are required.');
      }

      const data = await dependencies.saveBattleCard(payload);
      return { ok: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown tool execution error.';
      return toToolExecutionFailure('TOOL_EXECUTION_FAILED', message);
    }
  }

  return {
    definitions: AGENT_TOOL_DEFINITIONS,
    execute,
  };
}
