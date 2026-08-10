// User & Auth Types
export interface User {
  id: string
  email: string
  username: string
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  is_active: boolean
  is_verified: boolean
  is_admin: boolean
  created_at: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface RegisterRequest {
  email: string
  username: string
  password: string
  full_name: string
}

export interface LoginRequest {
  email: string
  password: string
}

// Document Types
export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'failed'
export type FileType = 'pdf' | 'docx' | 'pptx' | 'txt' | 'md'

export interface Document {
  id: string
  user_id: string
  title: string
  filename: string
  file_type: string
  file_size: number
  status: DocumentStatus
  processing_error: string | null
  page_count: number | null
  word_count: number | null
  char_count: number | null
  subject: string | null
  tags: string[]
  description: string | null
  created_at: string
  updated_at: string
}

export interface DocumentChunk {
  id: string
  document_id: string
  chunk_index: number
  content: string
  page_number: number | null
  char_start: number | null
  char_end: number | null
}

export interface SearchResult {
  chunk_id: string
  document_id: string
  document_title: string
  content: string
  score: number
  page_number: number | null
}

// Chat Types
export type MessageRole = 'user' | 'assistant' | 'system'

export interface Citation {
  document_id: string
  document_title: string
  chunk_content: string
  page_number: number | null
  score: number
}

export interface ChatMessage {
  id: string
  session_id: string
  role: MessageRole
  content: string
  citations: Citation[]
  tokens_used: number | null
  created_at: string
  suggested_questions?: string[] | null
}

export interface ChatSession {
  id: string
  title: string
  document_ids: string[]
  created_at: string
  updated_at: string
}

// Quiz Types
export type QuizType = 'mcq' | 'true_false' | 'fill_blank' | 'short_answer' | 'long_answer'
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface QuizQuestion {
  id: string
  question_text: string
  question_type: QuizType
  options: string[] | null
  correct_answer: string
  explanation: string | null
  order_index: number
}

export interface Quiz {
  id: string
  title: string
  quiz_type: QuizType
  difficulty: Difficulty
  total_questions: number
  created_at: string
  questions?: QuizQuestion[]
}

export interface QuizAttemptResult {
  attempt_id: string
  quiz_id: string
  score: number
  max_score: number
  percentage: number
  correct: number
  incorrect: number
  time_taken_seconds: number | null
  completed_at: string
  feedback: QuestionFeedback[]
}

export interface QuestionFeedback {
  id: string
  question_text: string
  question_type: string
  options: string[] | null
  order_index: number
  correct_answer: string
  explanation: string | null
  is_correct: boolean
  user_answer: string
}

// Flashcard Types
export interface FlashcardSet {
  id: string
  user_id: string
  document_id: string | null
  title: string
  description: string | null
  topic: string | null
  difficulty: Difficulty | null
  created_at: string
  updated_at: string
  cards: Flashcard[]
  card_count?: number  // computed convenience field
}

export interface Flashcard {
  id: string
  set_id: string
  front: string
  back: string
  hint: string | null
  topic: string | null
  difficulty: Difficulty | null
  order_index: number
  times_reviewed: number
  times_correct: number
  last_reviewed: string | null
}

// Summary Types
export type SummaryType = 'short' | 'detailed' | 'bullet' | 'one_page' | 'exam_revision'
export type ExplainLevel = 'beginner' | 'school' | 'college' | 'advanced'

export interface SummaryResponse {
  summary: string
  key_points: string[]
  word_count: number
}

export interface ConceptExplainResponse {
  concept: string
  explanation: string
  analogies: string[]
  analogy: string | null
  examples: string[]
  related_concepts: string[]
  level: string
}

// Analytics Types
export interface UserAnalytics {
  id: string
  user_id: string
  total_documents: number
  total_questions_asked: number
  total_quizzes_taken: number
  total_flashcards_reviewed: number
  total_study_hours: number
  avg_quiz_score: number
  streak_days: number
  last_active: string | null
  updated_at: string
  daily_goal_hours: number
  weekly_goal_hours: number
}

export interface WeeklyHoursEntry {
  date: string
  hours: number
}

export interface QuizScoreEntry {
  quiz_id: string
  title: string
  percentage: number
  completed_at: string
}

export interface ProgressData {
  weekly_hours: WeeklyHoursEntry[]
  quiz_scores: QuizScoreEntry[]
  documents_uploaded: number
  total_study_hours: number
  avg_quiz_score: number
  streak_days: number
  total_flashcards_reviewed: number
  total_questions_asked: number
}

// API Response wrappers
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface ApiError {
  detail: string
  error_code?: string
}
