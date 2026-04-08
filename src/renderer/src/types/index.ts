// Battle Card Status
export type CardStatus = 
  | 'pending_analysis' 
  | 'preparing' 
  | 'scheduled' 
  | 'interviewed' 
  | 'reviewed';

// Analysis Result
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

// Schedule Info
export interface Schedule {
  interviewTime: string | null;
  reminderMinutes: number;
  location: string;
}

// Review Info
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

// Battle Card (Main Entity)
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

// Resource File in Library
export interface ResourceFile {
  id: string;
  name: string;
  path: string;
  category: 'resume' | 'self_intro' | 'basics' | 'projects';
  tags: string[];
  createdAt: string;
}

// Electron Store Schema
export interface StoreSchema {
  battleCards: BattleCard[];
  config: {
    deepseekApiKey: string;
    defaultReminderMinutes: number;
  };
  resources: ResourceFile[];
}

// Webview Tab
export interface WebviewTab {
  id: string;
  url: string;
  title: string;
  isActive: boolean;
}

// Message in Chat
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// Page Type for Extraction
export type PageType = 'jd' | 'company' | 'experience' | 'unknown';

// Extracted Content
export interface ExtractedContent {
  url: string;
  title: string;
  content: string;
  pageType: PageType;
  timestamp: number;
}
