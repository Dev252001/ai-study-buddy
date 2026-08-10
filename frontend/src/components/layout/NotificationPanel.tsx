import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bell, Brain, BookOpen, Flame, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { analyticsApi, documentsApi } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'
import { useNavigate } from 'react-router-dom'

// ─── Types ────────────────────────────────────────────────────────────────────

type NotifType = 'success' | 'error' | 'warning' | 'info' | 'milestone'

interface NotificationItem {
  id: string
  type: NotifType
  icon: React.ReactNode
  title: string
  description: string
  time: string
  href?: string
}

// ─── Colour maps ──────────────────────────────────────────────────────────────

const iconBg: Record<NotifType, string> = {
  success:   'bg-green-500/15 text-green-500',
  error:     'bg-destructive/15 text-destructive',
  warning:   'bg-amber-500/15 text-amber-500',
  info:      'bg-primary/15 text-primary',
  milestone: 'bg-orange-500/15 text-orange-500',
}

const badgeStyle: Record<NotifType, string> = {
  success:   'bg-green-500/10 text-green-600 dark:text-green-400',
  error:     'bg-destructive/10 text-destructive',
  warning:   'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  info:      'bg-primary/10 text-primary',
  milestone: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
}

const badgeLabel: Record<NotifType, string> = {
  success:   'Ready',
  error:     'Failed',
  warning:   'Processing',
  info:      'Info',
  milestone: 'Milestone',
}

// ─── Builder ──────────────────────────────────────────────────────────────────

function buildNotifications(
  docs: Awaited<ReturnType<typeof documentsApi.list>>,
  quizScores: { quiz_id: string; title: string; percentage: number; completed_at: string }[],
  analytics: Awaited<ReturnType<typeof analyticsApi.get>> | undefined,
): NotificationItem[] {
  const items: NotificationItem[] = []

  const recentDocs = [...docs]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5)

  for (const doc of recentDocs) {
    if (doc.status === 'ready') {
      items.push({
        id: `doc-ready-${doc.id}`,
        type: 'success',
        icon: <CheckCircle className="h-4 w-4" />,
        title: doc.title,
        description: 'Document processed and ready to use.',
        time: formatDistanceToNow(new Date(doc.updated_at), { addSuffix: true }),
        href: '/documents',
      })
    } else if (doc.status === 'failed') {
      items.push({
        id: `doc-failed-${doc.id}`,
        type: 'error',
        icon: <AlertCircle className="h-4 w-4" />,
        title: doc.title,
        description: 'Processing failed. Try re-uploading.',
        time: formatDistanceToNow(new Date(doc.updated_at), { addSuffix: true }),
        href: '/documents',
      })
    } else if (doc.status === 'processing') {
      items.push({
        id: `doc-processing-${doc.id}`,
        type: 'warning',
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        title: doc.title,
        description: 'Currently being processed…',
        time: formatDistanceToNow(new Date(doc.updated_at), { addSuffix: true }),
        href: '/documents',
      })
    }
  }

  const recentQuizzes = [...quizScores]
    .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
    .slice(0, 3)

  for (const q of recentQuizzes) {
    const passed = q.percentage >= 70
    items.push({
      id: `quiz-${q.quiz_id}`,
      type: passed ? 'success' : 'warning',
      icon: <Brain className="h-4 w-4" />,
      title: q.title,
      description: `Scored ${Math.round(q.percentage)}% — ${passed ? 'Great work!' : 'Keep practising!'}`,
      time: formatDistanceToNow(new Date(q.completed_at), { addSuffix: true }),
      href: '/quiz',
    })
  }

  if (analytics && analytics.streak_days > 0) {
    items.push({
      id: 'streak',
      type: 'milestone',
      icon: <Flame className="h-4 w-4" />,
      title: `${analytics.streak_days}-day study streak`,
      description: "You're on a roll — keep it up!",
      time: 'today',
    })
  }

  if (analytics && analytics.total_flashcards_reviewed > 0) {
    items.push({
      id: 'flashcards',
      type: 'milestone',
      icon: <BookOpen className="h-4 w-4" />,
      title: 'Flashcard milestone',
      description: `${analytics.total_flashcards_reviewed} card${analytics.total_flashcards_reviewed === 1 ? '' : 's'} reviewed in total.`,
      time: '',
      href: '/flashcards',
    })
  }

  // Sort: timed items first (newest), then timeless milestones
  return items
    .sort((a, b) => {
      if (!a.time && b.time) return 1
      if (a.time && !b.time) return -1
      return 0
    })
    .slice(0, 8)
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-start gap-2.5 px-3.5 py-2 animate-pulse">
      <div className="h-7 w-7 rounded-md bg-muted shrink-0" />
      <div className="flex-1 space-y-1.5 pt-0.5">
        <div className="h-2.5 w-2/3 rounded bg-muted" />
        <div className="h-2 w-full rounded bg-muted" />
        <div className="h-2 w-1/3 rounded bg-muted" />
      </div>
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

interface NotificationPanelProps {
  onClose: () => void
}

export function NotificationPanel({ onClose }: NotificationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const { data: docs = [], isLoading: loadingDocs } = useQuery({
    queryKey: ['documents-notif'],
    queryFn: () => documentsApi.list(0, 20),
    staleTime: 30_000,
  })
  const { data: progress, isLoading: loadingProgress } = useQuery({
    queryKey: ['progress-notif'],
    queryFn: analyticsApi.getProgress,
    staleTime: 30_000,
  })
  const { data: analytics, isLoading: loadingAnalytics } = useQuery({
    queryKey: ['analytics-notif'],
    queryFn: analyticsApi.get,
    staleTime: 30_000,
  })

  const isLoading = loadingDocs || loadingProgress || loadingAnalytics

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const notifications = buildNotifications(docs, progress?.quiz_scores ?? [], analytics)

  function handleItemClick(href?: string) {
    if (href) { navigate(href); onClose() }
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Notifications"
      className="absolute right-0 top-full mt-2 w-[280px] rounded-xl border border-border bg-background shadow-xl z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Bell className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">Notifications</span>
          {!isLoading && notifications.length > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {notifications.length}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="max-h-[280px] overflow-y-auto scrollbar-thin">
        {isLoading ? (
          <div className="divide-y divide-border/50">
            <SkeletonRow /><SkeletonRow /><SkeletonRow />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Bell className="h-5 w-5 opacity-40" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">All caught up!</p>
              <p className="text-xs mt-0.5 opacity-70">No recent activity to show.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/50 py-1">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleItemClick(n.href)}
                className={`flex items-start gap-2.5 px-3.5 py-2.5 transition-colors ${n.href ? 'cursor-pointer hover:bg-muted/60' : ''}`}
              >
                {/* Icon bubble */}
                <div className={`shrink-0 h-7 w-7 rounded-md flex items-center justify-center ${iconBg[n.type]}`}>
                  {n.icon}
                </div>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium text-foreground leading-snug truncate max-w-[140px]">
                      {n.title}
                    </p>
                    <span className={`shrink-0 text-[9px] font-semibold px-1 py-0.5 rounded-full ${badgeStyle[n.type]}`}>
                      {badgeLabel[n.type]}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-1">
                    {n.description}
                  </p>
                  {n.time && (
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{n.time}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {!isLoading && notifications.length > 0 && (
        <div className="border-t border-border px-3.5 py-2 bg-muted/30">
          <button
            onClick={() => { navigate('/analytics'); onClose() }}
            className="w-full text-[11px] text-center text-muted-foreground hover:text-primary transition-colors font-medium"
          >
            View all activity in Analytics →
          </button>
        </div>
      )}
    </div>
  )
}
