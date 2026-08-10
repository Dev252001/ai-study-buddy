import axios, { AxiosError } from 'axios'

/** Extract a human-readable message from any thrown error (Axios or plain Error). */
export function getErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof AxiosError) {
    const detail = err.response?.data?.detail
    if (detail && typeof detail === 'string') {
      // OpenAI errors
      if (detail.includes('credit_balance_exhausted') || detail.includes('insufficient_quota'))
        return 'OpenAI account has no credits — add billing at platform.openai.com'
      if (detail.includes('invalid_api_key') || detail.includes('Incorrect API key'))
        return 'Invalid API key — update OPENAI_API_KEY or GROQ_API_KEY in backend/.env'
      // Groq errors
      if (detail.includes('invalid_api_key') || detail.includes('No API key'))
        return 'Invalid Groq API key — update GROQ_API_KEY in backend/.env'
      if (detail.includes('rate_limit') || detail.includes('429') || detail.includes('rate limit'))
        return 'Rate limit reached — please wait a moment and try again'
      return detail
    }
    if (err.response?.status === 502 || err.response?.status === 500)
      return 'AI service error — check the API key in backend/.env'
    if (err.response?.status === 401) return 'Session expired — please log in again'
    if (err.message) return err.message
  }
  if (err instanceof Error) return err.message
  return fallback
}

import type {
  User,
  TokenResponse,
  RegisterRequest,
  LoginRequest,
  Document,
  DocumentChunk,
  SearchResult,
  ChatSession,
  ChatMessage,
  Citation,
  Quiz,
  QuizAttemptResult,
  FlashcardSet,
  Flashcard,
  SummaryResponse,
  ConceptExplainResponse,
  UserAnalytics,
  ProgressData,
} from '@/types'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Token helpers
const TOKEN_KEY = 'access_token'
const REFRESH_KEY = 'refresh_token'

export const tokenStorage = {
  getAccess: () =>
    localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY),
  getRefresh: () =>
    localStorage.getItem(REFRESH_KEY) ?? sessionStorage.getItem(REFRESH_KEY),
  setTokens: (access: string, refresh: string, remember = true) => {
    const store = remember ? localStorage : sessionStorage
    store.setItem(TOKEN_KEY, access)
    store.setItem(REFRESH_KEY, refresh)
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(REFRESH_KEY)
  },
}

// Request interceptor: attach Bearer token
api.interceptors.request.use((config) => {
  const token = tokenStorage.getAccess()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor: handle 401 + auto-refresh
let refreshing = false
let refreshQueue: Array<(token: string) => void> = []

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as typeof error.config & { _retry?: boolean }
    if (error.response?.status === 401 && !original?._retry) {
      if (refreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token) => {
            if (original) {
              original.headers!.Authorization = `Bearer ${token}`
              resolve(api(original))
            }
          })
        })
      }
      original._retry = true
      refreshing = true
      const refreshToken = tokenStorage.getRefresh()
      if (!refreshToken) {
        tokenStorage.clear()
        window.location.href = '/login'
        return Promise.reject(error)
      }
      try {
        const { data } = await axios.post<TokenResponse>('/api/v1/auth/refresh', {
          refresh_token: refreshToken,
        })
        tokenStorage.setTokens(data.access_token, data.refresh_token)
        refreshQueue.forEach((cb) => cb(data.access_token))
        refreshQueue = []
        if (original) {
          original.headers!.Authorization = `Bearer ${data.access_token}`
          return api(original)
        }
      } catch {
        tokenStorage.clear()
        window.location.href = '/login'
        return Promise.reject(error)
      } finally {
        refreshing = false
      }
    }
    return Promise.reject(error)
  },
)

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (data: RegisterRequest) =>
    api.post<User>('/auth/register', data).then((r) => r.data),

  login: (data: LoginRequest) =>
    api.post<TokenResponse>('/auth/login', data).then((r) => r.data),

  logout: () => api.post('/auth/logout').then((r) => r.data),

  refreshToken: (refresh_token: string) =>
    api.post<TokenResponse>('/auth/refresh', { refresh_token }).then((r) => r.data),

  getMe: () => api.get<User>('/auth/me').then((r) => r.data),

  updateMe: (data: Partial<{ full_name: string; bio: string; avatar_url: string }>) =>
    api.put<User>('/auth/me', data).then((r) => r.data),

  changePassword: (data: { current_password: string; new_password: string }) =>
    api.post('/auth/change-password', data).then((r) => r.data),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }).then((r) => r.data),

  resetPassword: (data: { token: string; new_password: string; confirm_password: string }) =>
    api.post('/auth/reset-password', data).then((r) => r.data),
}

// ─── Documents ────────────────────────────────────────────────────────────────

export const documentsApi = {
  upload: (files: File[], onProgress?: (pct: number) => void) => {
    const form = new FormData()
    files.forEach((f) => form.append('files', f))
    return api
      .post<Document[]>('/documents/', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (onProgress && e.total) {
            onProgress(Math.round((e.loaded * 100) / e.total))
          }
        },
      })
      .then((r) => r.data)
  },
list: (skip = 0, limit = 20) => {
    const page = Math.floor(skip / limit) + 1
    return api.get<any>('/documents/', { params: { page, page_size: limit } }).then((r) => {
      const data = r.data
      if (Array.isArray(data)) return data as Document[]
      if (data && Array.isArray(data.items)) return data.items as Document[]
      if (data && Array.isArray(data.documents)) return data.documents as Document[]
      if (data && Array.isArray(data.data)) return data.data as Document[]
      return [] as Document[]
    })
  },

  get: (id: string) => api.get<Document>(`/documents/${id}`).then((r) => r.data),

  delete: (id: string) => api.delete(`/documents/${id}`).then((r) => r.data),

  reprocess: (id: string) => api.post(`/documents/${id}/reprocess`).then((r) => r.data),

  getChunks: (id: string) =>
    api.get<DocumentChunk[]>(`/documents/${id}/chunks`).then((r) => r.data),

  getStatus: (id: string) =>
    api.get<{ status: string; processing_error: string | null }>(`/documents/${id}/status`).then((r) => r.data),
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface SendMessageRequest {
  message: string
  session_id?: string
  document_ids?: string[]
  mode?: 'rag' | 'general' | 'explain' | 'summarize'
}

export interface ChatResponseData {
  message: string
  citations: Citation[]
  session_id: string
  tokens_used: number | null
  suggested_questions?: string[]
}

export const chatApi = {
  createSession: (data: { title?: string; document_ids?: string[] }) =>
    api.post<ChatSession>('/chat/sessions', data).then((r) => r.data),

  listSessions: () => api.get<ChatSession[]>('/chat/sessions').then((r) => r.data),

  getSession: (id: string) =>
    api.get<ChatSession>(`/chat/sessions/${id}`).then((r) => r.data),

  deleteSession: (id: string) =>
    api.delete(`/chat/sessions/${id}`).then((r) => r.data),

  sendMessage: (data: SendMessageRequest) =>
    api.post<ChatResponseData>('/chat/message', data).then((r) => r.data),

  getMessages: (sessionId: string) =>
    api.get<ChatMessage[]>(`/chat/sessions/${sessionId}/messages`).then((r) => r.data),
}

// ─── Quiz ─────────────────────────────────────────────────────────────────────

export interface QuizGenerateRequest {
  document_id: string
  quiz_type: string
  difficulty: string
  num_questions: number
  topics?: string[] | null
}

export const quizApi = {
  generate: (data: QuizGenerateRequest) =>
    api.post<Quiz>('/quiz/generate', data).then((r) => r.data),

  list: (skip = 0, limit = 20) =>
    api.get<Quiz[]>('/quiz/', { params: { skip, limit } }).then((r) => r.data),

  get: (id: string) => api.get<Quiz>(`/quiz/${id}`).then((r) => r.data),

  delete: (id: string) => api.delete(`/quiz/${id}`).then((r) => r.data),

  submitAttempt: (data: { quiz_id: string; answers: Record<string, string>; time_taken_seconds?: number }) =>
    api.post<QuizAttemptResult>('/quiz/attempt', data).then((r) => r.data),
}

// ─── Flashcards ───────────────────────────────────────────────────────────────

export interface FlashcardGenerateRequest {
  document_id: string
  num_cards: number
  topic?: string
  difficulty?: string
}

export const flashcardsApi = {
  generate: (data: FlashcardGenerateRequest) =>
    api.post<FlashcardSet>('/flashcards/generate', data).then((r) => r.data),

  listSets: (skip = 0, limit = 20) =>
    api.get<FlashcardSet[]>('/flashcards/', { params: { skip, limit } }).then((r) => r.data),

  getSet: (id: string) => api.get<FlashcardSet>(`/flashcards/${id}`).then((r) => r.data),

  getCards: (setId: string) =>
    api.get<Flashcard[]>(`/flashcards/${setId}/cards`).then((r) => r.data),

  deleteSet: (id: string) => api.delete(`/flashcards/${id}`).then((r) => r.data),

  reviewCard: (data: { flashcard_id: string; was_correct: boolean }) =>
    api.post('/flashcards/review', data).then((r) => r.data),
}

// ─── Summaries ────────────────────────────────────────────────────────────────

export const summariesApi = {
  summarize: (data: { document_id: string; summary_type: string }) =>
    api.post<SummaryResponse>('/summaries/summarize', data).then((r) => r.data),

  explain: (data: {
    concept: string
    document_id?: string
    level: string
    use_analogies?: boolean
    use_examples?: boolean
  }) => api.post<ConceptExplainResponse>('/summaries/explain', data).then((r) => r.data),

  mindMap: (document_id: string) =>
    api.post<{ mind_map: object }>('/summaries/mind-map', { document_id }).then((r) => r.data),

  studyPlan: (data: { document_id: string; exam_date?: string }) =>
    api.post<{ study_plan: object }>('/summaries/study-plan', data).then((r) => r.data),

  formulaSheet: (document_id: string) =>
    api.post<{ formulas: object }>('/summaries/formula-sheet', { document_id }).then((r) => r.data),

  glossary: (document_id: string) =>
    api.post<{ glossary: object }>('/summaries/glossary', { document_id }).then((r) => r.data),
}

// ─── Search ───────────────────────────────────────────────────────────────────

export const searchApi = {
  search: (data: { query: string; document_ids?: string[]; limit?: number; threshold?: number }) =>
    api.post<{ results: SearchResult[] }>('/search/', data).then((r) => r.data),
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export const analyticsApi = {
  get: () => api.get<UserAnalytics>('/analytics/').then((r) => r.data),
  getProgress: () => api.get<ProgressData>('/analytics/progress').then((r) => r.data),
  startSession: (data: { activity_type: string; document_id?: string }) =>
    api.post('/analytics/session/start', data).then((r) => r.data),
  endSession: (sessionId: string) =>
    api.put(`/analytics/session/${sessionId}/end`).then((r) => r.data),
  updateGoals: (data: { daily_goal_hours?: number; weekly_goal_hours?: number }) =>
    api.put<UserAnalytics>('/analytics/goals', data).then((r) => r.data),
}

// ─── Export ───────────────────────────────────────────────────────────────────

async function downloadBlob(url: string, filename: string): Promise<void> {
  const response = await api.get(url, { responseType: 'blob' })
  const objectUrl = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = objectUrl
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(objectUrl)
}

export const exportApi = {
  summary: (documentId: string, summaryType: string, format: 'pdf' | 'docx' | 'markdown') => {
    const url = `/api/v1/export/summary/${documentId}?format=${format}&summary_type=${summaryType}`
    window.open(url, '_blank')
  },
  quiz: (quizId: string) =>
    downloadBlob(`/export/quiz/${quizId}?format=pdf`, `quiz_${quizId}.pdf`),
  flashcards: (setId: string) =>
    downloadBlob(`/export/flashcards/${setId}?format=pdf`, `flashcards_${setId}.pdf`),
}

export default api
