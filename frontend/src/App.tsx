import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { Layout } from '@/components/layout/Layout'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'

import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { DocumentsPage } from '@/pages/documents/DocumentsPage'
import { DocumentDetailPage } from '@/pages/documents/DocumentDetailPage'
import { ChatPage } from '@/pages/chat/ChatPage'
import { QuizListPage } from '@/pages/quiz/QuizListPage'
import { QuizGeneratePage } from '@/pages/quiz/QuizGeneratePage'
import { QuizPage } from '@/pages/quiz/QuizPage'
import { FlashcardsListPage } from '@/pages/flashcards/FlashcardsListPage'
import { FlashcardsPage } from '@/pages/flashcards/FlashcardsPage'
import { SummaryPage } from '@/pages/summaries/SummaryPage'
import { SearchPage } from '@/pages/search/SearchPage'
import { AnalyticsPage } from '@/pages/analytics/AnalyticsPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'
import { ProfilePage } from '@/pages/profile/ProfilePage'
import { NotFoundPage } from '@/pages/NotFoundPage'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
              <Route path="/documents" element={<ErrorBoundary><DocumentsPage /></ErrorBoundary>} />
              <Route path="/documents/:id" element={<ErrorBoundary><DocumentDetailPage /></ErrorBoundary>} />
              <Route path="/chat" element={<ErrorBoundary><ChatPage /></ErrorBoundary>} />
              <Route path="/chat/:sessionId" element={<ErrorBoundary><ChatPage /></ErrorBoundary>} />
              <Route path="/quiz" element={<ErrorBoundary><QuizListPage /></ErrorBoundary>} />
              <Route path="/quiz/generate" element={<ErrorBoundary><QuizGeneratePage /></ErrorBoundary>} />
              <Route path="/quiz/:id" element={<ErrorBoundary><QuizPage /></ErrorBoundary>} />
              <Route path="/flashcards" element={<ErrorBoundary><FlashcardsListPage /></ErrorBoundary>} />
              <Route path="/flashcards/:setId" element={<ErrorBoundary><FlashcardsPage /></ErrorBoundary>} />
              <Route path="/summaries" element={<ErrorBoundary><SummaryPage /></ErrorBoundary>} />
              <Route path="/search" element={<ErrorBoundary><SearchPage /></ErrorBoundary>} />
              <Route path="/analytics" element={<ErrorBoundary><AnalyticsPage /></ErrorBoundary>} />
              <Route path="/settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
              <Route path="/profile" element={<ErrorBoundary><ProfilePage /></ErrorBoundary>} />
            </Route>
          </Route>

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  )
}
