import { randomUUID } from 'node:crypto';
import { webContents } from 'electron';
import { cardStore, profileStore } from '../../store';
import type { AIProvider } from '../ai/provider';
import { createProvider } from '../ai';
import { createAgentTools } from './tools';
import { createSingleRunLock } from './run-lock';
import { runPlannerExecutor } from './planner-executor';
import type {
  AgentProgressPayload,
  AgentRunRequest,
  AgentRunResult,
  AgentToolDependencies,
  AgentToolRuntime,
  ExtractJobPageResult,
  SaveBattleCardInput,
  SaveBattleCardResult,
} from './types';
import type { Analysis, BattleCard, Review, Schedule } from '../../../shared/types';

const runLock = createSingleRunLock();
const activeRuns = new Map<string, AbortController>();

class AgentBusyError extends Error {
  constructor() {
    super('AGENT_BUSY');
    this.name = 'AgentBusyError';
  }
}

function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeCompanyName(value: unknown): string {
  const text = cleanText(value);
  return text || 'Unknown Company';
}

function normalizePositionName(value: unknown): string {
  const text = cleanText(value);
  return text || 'Unknown Position';
}

function defaultAnalysis(): Analysis {
  return {
    companySummary: '',
    jdSummary: '',
    experienceSummary: '',
    commonQuestions: [],
    warnings: [],
    checklist: [],
    selfIntroduction: '',
    resumeSuggestions: [],
    keyPoints: [],
    matchScore: null,
    missingSkills: [],
    matchSuggestions: [],
  };
}

function mergeAnalysis(analysis?: Partial<Analysis>): Analysis {
  return {
    ...defaultAnalysis(),
    ...(analysis ?? {}),
    commonQuestions: Array.isArray(analysis?.commonQuestions) ? analysis.commonQuestions : [],
    warnings: Array.isArray(analysis?.warnings) ? analysis.warnings : [],
    checklist: Array.isArray(analysis?.checklist) ? analysis.checklist : [],
    resumeSuggestions: Array.isArray(analysis?.resumeSuggestions) ? analysis.resumeSuggestions : [],
    keyPoints: Array.isArray(analysis?.keyPoints) ? analysis.keyPoints : [],
    missingSkills: Array.isArray(analysis?.missingSkills) ? analysis.missingSkills : [],
    matchSuggestions: Array.isArray(analysis?.matchSuggestions) ? analysis.matchSuggestions : [],
    matchScore: typeof analysis?.matchScore === 'number' ? analysis.matchScore : null,
  };
}

function mergeSchedule(schedule?: Partial<Schedule>): Schedule {
  return {
    interviewTime: schedule?.interviewTime ?? null,
    reminderMinutes: typeof schedule?.reminderMinutes === 'number' ? schedule.reminderMinutes : 60,
    location: cleanText(schedule?.location ?? ''),
  };
}

function mergeReview(review?: Partial<Review>): Review {
  return {
    actualQuestions: review?.actualQuestions ?? '',
    selfRating: typeof review?.selfRating === 'number' ? review.selfRating : 3,
    answerFeedback: review?.answerFeedback ?? '',
    interviewerFeedback: review?.interviewerFeedback ?? '',
    salaryRange: review?.salaryRange ?? '',
    result: review?.result ?? 'pending',
    recommend: Boolean(review?.recommend),
    notes: review?.notes ?? '',
  };
}

function buildExtractJobPageScript(): string {
  return `(() => {
    const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const bodyText = normalize(document.body && typeof document.body.innerText === 'string' ? document.body.innerText : '');
    const title = normalize(document.title || '');
    const lines = bodyText.split('\\n').map((line) => normalize(line)).filter(Boolean).slice(0, 80);
    const salaryMatch = bodyText.match(/\\d+(?:\\.\\d+)?\\s*[kK]?(?:-|~|to)\\s*\\d+(?:\\.\\d+)?\\s*[kK]?(?:\\/month|\\/year)?/i);
    const requirementsSummary =
      lines.filter((line) => /require|skill|experience|responsibility|job|position/i.test(line)).slice(0, 8).join('; ') ||
      lines.slice(0, 5).join('; ');
    const parts = title.split(/[|\\-]/).map((part) => normalize(part)).filter(Boolean);
    return {
      url: location.href,
      title,
      companyName: parts[0] || '',
      positionName: parts[1] || parts[0] || '',
      salaryRange: salaryMatch ? salaryMatch[0] : '',
      requirementsSummary,
      content: bodyText.slice(0, 15000),
      pageType: 'jd',
      timestamp: Date.now(),
      source: 'fallback'
    };
  })()`;
}

async function extractJobPage(webContentId: number, signal?: AbortSignal): Promise<ExtractJobPageResult> {
  if (signal?.aborted) {
    const error = new Error('Agent run aborted');
    error.name = 'AbortError';
    throw error;
  }

  const wc = webContents.fromId(webContentId);
  if (!wc) {
    throw new Error(`Web contents not found: ${webContentId}`);
  }

  const result = (await wc.executeJavaScript(buildExtractJobPageScript())) as ExtractJobPageResult;
  return {
    ...result,
    url: cleanText(result.url),
    title: cleanText(result.title),
    companyName: normalizeCompanyName(result.companyName),
    positionName: normalizePositionName(result.positionName),
    salaryRange: cleanText(result.salaryRange),
    requirementsSummary: cleanText(result.requirementsSummary),
  };
}

function saveBattleCard(input: SaveBattleCardInput): Promise<SaveBattleCardResult> {
  const companyName = normalizeCompanyName(input.companyName);
  const positionName = normalizePositionName(input.positionName);
  const sourceUrl = cleanText(input.sourceUrl);
  const companyLocation = cleanText(input.companyLocation ?? '');
  const analysis = mergeAnalysis(input.analysis);
  const schedule = mergeSchedule(input.schedule);
  const review = mergeReview(input.review);

  const now = new Date().toISOString();
  const card: BattleCard = {
    id: randomUUID(),
    companyName,
    companyLocation,
    positionName,
    status: 'preparing',
    analysis,
    schedule,
    review,
    createdAt: now,
    updatedAt: now,
    sourceUrl,
  };

  cardStore.create(card);

  return Promise.resolve({
    cardId: card.id,
    companyName,
    positionName,
  });
}

function buildDefaultToolDependencies(allowedWebContentId: number): AgentToolDependencies {
  return {
    extractJobPage: (webContentId, signal) => {
      if (webContentId !== allowedWebContentId) {
        throw new Error(`webContentId ${webContentId} is not allowed for this run`);
      }
      return extractJobPage(webContentId, signal);
    },
    getProfile: () => profileStore.get(),
    saveBattleCard,
  };
}

export async function runAgentWorkflow(
  request: AgentRunRequest,
  options?: {
    provider?: AIProvider;
    tools?: AgentToolRuntime;
    onProgress?: (payload: AgentProgressPayload) => void;
    signal?: AbortSignal;
  }
): Promise<AgentRunResult> {
  if (!runLock.tryAcquire(request.requestId)) {
    throw new AgentBusyError();
  }

  const controller = new AbortController();
  const externalSignal = options?.signal;
  const abortHandler = (): void => controller.abort();

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', abortHandler, { once: true });
    }
  }

  activeRuns.set(request.requestId, controller);

  try {
    const provider = options?.provider ?? createProvider();
    const tools = options?.tools ?? createAgentTools(buildDefaultToolDependencies(request.webContentId));
    return await runPlannerExecutor({
      request,
      provider,
      tools,
      onProgress: options?.onProgress,
      signal: controller.signal,
      maxSteps: request.maxSteps ?? 6,
    });
  } finally {
    activeRuns.delete(request.requestId);
    runLock.release(request.requestId);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', abortHandler);
    }
  }
}

export function abortAgentRun(requestId: string): boolean {
  const controller = activeRuns.get(requestId);
  if (!controller) {
    return false;
  }

  controller.abort();
  return true;
}

export function isAgentBusy(): boolean {
  return runLock.isBusy();
}
