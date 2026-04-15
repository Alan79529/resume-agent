// Shared types used across main, preload, and renderer processes

export type CardStatus =
  | 'pending_analysis'
  | 'preparing'
  | 'scheduled'
  | 'interviewed'
  | 'reviewed';

export interface Analysis {
  companySummary: string;
  jdSummary: string;
  experienceSummary: string;
  commonQuestions: string[];
  warnings: string[];
  checklist: string[];
  selfIntroduction: string;
  resumeSuggestions: string[];
  keyPoints: string[];
  matchScore?: number | null;
  missingSkills: string[];
  matchSuggestions: string[];
}

export interface ProfileData {
  resumeText: string;
  selfIntroText: string;
}

export interface Schedule {
  interviewTime: string | null;
  reminderMinutes: number;
  location: string;
}

export interface Review {
  actualQuestions: string;
  selfRating: number;
  answerFeedback: string;
  interviewerFeedback: string;
  salaryRange: string;
  result: 'passed' | 'rejected' | 'pending' | 'withdrawn';
  recommend: boolean;
  notes: string;
}

export interface BattleCard {
  id: string;
  companyName: string;
  companyLocation: string;
  positionName: string;
  status: CardStatus;
  analysis: Analysis;
  schedule: Schedule;
  review: Review;
  createdAt: string;
  updatedAt: string;
  sourceUrl: string;
}

export interface ResourceFile {
  id: string;
  name: string;
  path: string;
  category: 'resume' | 'self_intro' | 'basics' | 'projects';
  tags: string[];
  createdAt: string;
}

export interface StoreSchema {
  battleCards: BattleCard[];
  config: {
    deepseekApiKey: string;
    apiBaseUrl: string;
    model: string;
    defaultReminderMinutes: number;
  };
  profile: ProfileData;
  resources: ResourceFile[];
}

export interface AppDataBackup {
  version: 1;
  exportedAt: string;
  battleCards: BattleCard[];
  profile: ProfileData;
  resources: ResourceFile[];
}

export interface DataTransferResult {
  success: boolean;
  message: string;
  filePath?: string;
}

export interface ResumePdfImportResult {
  success: boolean;
  message: string;
  filePath?: string;
  text?: string;
}

export interface WebviewTab {
  id: string;
  url: string;
  title: string;
  isActive: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export type PageType = 'jd' | 'company' | 'experience' | 'unknown';

export interface ExtractedContent {
  url: string;
  title: string;
  content: string;
  pageType: PageType;
  timestamp: number;
  source: 'readability' | 'fallback';
  companyName?: string;
  positionName?: string;
  salaryRange?: string;
  requirementsSummary?: string;
}

export interface AIChatToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: AIChatToolCall[];
}
