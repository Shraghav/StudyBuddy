export type QuizStatus =
  | 'setup'
  | 'generating'
  | 'active'
  | 'grading'
  | 'completed'
  | 'error';

// Document Models
export interface DocumentItem {
  id: string;
  name: string;
  upload_date: string | null;
  status: 'Processing' | 'READY' | 'FAILED';
  file_url: string;
  clientTimeoutFailed?: boolean;
}

// Chat Models
export interface CitationItem {
  id: number;
  page: number;
  chunk_id?: string;
  snippet: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: string;
  citations?: CitationItem[];
}

export interface ChatSessionItem {
  id: string;
  title: string;
  document_id?: string | null;
  attachedDocName?: string;
  created_at?: string;
  messages?: ChatMessage[];
}

// Quiz Models
export interface QuizSessionSummary {
  session_id: string;
  title: string;
  document_id?: string | null;
  document_name?: string;
  status: QuizStatus;
}

export interface QuizQuestionActive {
  id: string;
  text: string;
  options: Record<string, string>;
}

export interface QuizQuestionCompleted {
  id: string;
  session_id?: string;
  text: string;
  options: Record<string, string>;
  user_answer: string | null;
  correct_answer: string;
  evaluation_score?: number | null;
  evaluation_feedback?: string | null;
}

export interface QuizSessionActive {
  session_id: string;
  title: string;
  document_id?: string | null;
  document_name?: string;
  status: 'active';
  questions: QuizQuestionActive[];
}

export interface QuizSessionCompleted {
  session_id: string;
  title: string;
  document_id?: string | null;
  document_name?: string;
  status: 'completed';
  score: number;
  feedback?: string;
  questions: QuizQuestionCompleted[];
}

export type QuizDetail = QuizSessionSummary | QuizSessionActive | QuizSessionCompleted;

export interface QuizGenerationParams {
  numQuestions: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  customPrompt?: string;
}

// Navigation state
export type NavTab = 'chat' | 'quiz' | 'documents';

