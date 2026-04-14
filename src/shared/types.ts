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
  resources: ResourceFile[];
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
}

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
