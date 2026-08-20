import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  FileText, MessageSquare, Brain, CreditCard,
  BarChart2, Clock, Flame, BookOpen, Plus,
  ArrowRight, Target, Edit2, Check, X,
  Sparkles, TrendingUp, Zap, Timer, Play, Pause, RotateCcw,
  CalendarCheck, Lightbulb,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useAnalytics, useProgress, useUpdateGoals } from '@/hooks/useAnalytics'
import { useDocuments } from '@/hooks/useDocuments'
import { useQuizzes } from '@/hooks/useQuiz'
import { useFlashcardSets } from '@/hooks/useFlashcards'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import { formatDate, getStatusColor, formatFileSize, buildWeeklyChartData } from '@/lib/utils'
import { OnboardingModal, hasOnboarded } from '@/components/shared/OnboardingModal'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

// ── Circular progress ring ────────────────────────────────────────────────────
function CircleProgress({ pct, size = 56 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const dash = (Math.min(pct, 100) / 100) * circ
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="hsl(var(--border))" strokeWidth={6} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="url(#goalGrad)" strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <defs>
        <linearGradient id="goalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(168 76% 42%)" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  title, value, icon: Icon, bg, loading, gradient,
}: {
  title: string; value: string | number; icon: React.ElementType
  bg: string; loading: boolean; gradient: string
}) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.15 }}
      className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 shadow-sm cursor-default"
    >
      {/* Top accent line */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${gradient}`} />
      {/* Glow */}
      <div className={`pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full opacity-10 blur-2xl ${bg}`} />
      {loading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-8 w-16" />
        </div>
      ) : (
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{title}</p>
            <p className="text-3xl font-extrabold mt-2 tabular-nums tracking-tight leading-none">{value}</p>
          </div>
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} shadow-md`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ── Custom bar tooltip ─────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-primary font-bold mt-0.5">{payload[0].value}h studied</p>
    </div>
  )
}

// ── Pomodoro Timer ────────────────────────────────────────────────────────────
const POMODORO_WORK = 25 * 60
const POMODORO_BREAK = 5 * 60

function PomodoroTimer() {
  const [mode, setMode] = useState<'work' | 'break'>('work')
  const [seconds, setSeconds] = useState(POMODORO_WORK)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const total = mode === 'work' ? POMODORO_WORK : POMODORO_BREAK
  const pct = Math.max(0, (seconds / total) * 100)

  const stop = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    setRunning(false)
  }, [])

  const start = useCallback(() => {
    intervalRef.current = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          clearInterval(intervalRef.current!)
          intervalRef.current = null
          setRunning(false)
          // switch mode — the useEffect on mode will reset seconds
          setMode(prev => prev === 'work' ? 'break' : 'work')
          return 0
        }
        return s - 1
      })
    }, 1000)
    setRunning(true)
  }, [])

  // Reset when mode changes
  useEffect(() => {
    stop()
    setSeconds(mode === 'work' ? POMODORO_WORK : POMODORO_BREAK)
  }, [mode, stop])

  useEffect(() => () => stop(), [stop])

  const mm = Math.floor(seconds / 60).toString().padStart(2, '0')
  const ss = (seconds % 60).toString().padStart(2, '0')
  const r = 26
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ

  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500">
            <Timer className="h-3.5 w-3.5 text-white" />
          </div>
          <p className="text-sm font-bold">Pomodoro Timer</p>
          {/* Mode toggle */}
          <div className="ml-auto flex items-center gap-1 rounded-lg bg-muted p-0.5">
            {(['work', 'break'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition-all ${
                  mode === m ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m === 'work' ? 'Focus' : 'Break'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-5">
          {/* Ring */}
          <div className="relative shrink-0">
            <svg width={68} height={68} className="-rotate-90">
              <circle cx={34} cy={34} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={5} />
              <circle
                cx={34} cy={34} r={r} fill="none"
                stroke={mode === 'work' ? '#f59e0b' : '#10b981'}
                strokeWidth={5} strokeLinecap="round"
                strokeDasharray={`${dash} ${circ}`}
                style={{ transition: 'stroke-dasharray 1s linear' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-extrabold tabular-nums">{mm}:{ss}</span>
            </div>
          </div>

          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-2">
              {mode === 'work' ? 'Focus session — stay off distractions' : 'Short break — stretch or hydrate'}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={running ? stop : start}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                  running
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200'
                    : 'bg-gradient-to-r from-amber-400 to-orange-500 text-white hover:opacity-90 shadow-sm'
                }`}
              >
                {running ? <><Pause className="h-3 w-3" /> Pause</> : <><Play className="h-3 w-3" /> Start</>}
              </button>
              <button
                onClick={() => { stop(); setSeconds(mode === 'work' ? POMODORO_WORK : POMODORO_BREAK) }}
                className="flex items-center justify-center h-6 w-6 rounded-full border border-border hover:bg-accent transition-colors"
                title="Reset"
              >
                <RotateCcw className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function DashboardPage() {
  const { user } = useAuth()
  const { data: analytics, isLoading: analyticsLoading } = useAnalytics()
  const { data: progress, isLoading: progressLoading } = useProgress()
  const { data: documents = [], isLoading: docsLoading } = useDocuments()
  const { data: quizzes = [], isLoading: quizzesLoading } = useQuizzes()
  const { data: flashcardSets = [] } = useFlashcardSets()
  const { mutateAsync: updateGoals, isPending: savingGoals } = useUpdateGoals()

  // Due-today: cards not reviewed today (last_reviewed is null or not today)
  const today = new Date().toDateString()
  const dueCardCount = flashcardSets.reduce((total, set) => {
    const cards = set.cards ?? []
    return total + cards.filter(c => {
      if (!c.last_reviewed) return true
      return new Date(c.last_reviewed).toDateString() !== today
    }).length
  }, 0)
  const navigate = useNavigate()

  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')
  const [showOnboarding, setShowOnboarding] = useState(() => !hasOnboarded())

  const weeklyData = buildWeeklyChartData(progress?.weekly_hours)
  const todayAbbr = new Date().toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3)
  const todayHours = weeklyData.find(d => d.day === todayAbbr)?.hours ?? 0
  const dailyGoal = analytics?.daily_goal_hours ?? 2
  const dailyPct = Math.min(100, (todayHours / dailyGoal) * 100)
  const maxHours = Math.max(...weeklyData.map(d => d.hours), 0.1)

  const handleSaveGoal = async () => {
    const val = parseFloat(goalInput)
    if (!isNaN(val) && val > 0) await updateGoals({ daily_goal_hours: val })
    setEditingGoal(false)
  }

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.full_name?.split(' ')[0] || user?.username

  const stats = [
    { title: 'Documents',    value: analytics?.total_documents ?? 0,       icon: FileText,      bg: 'bg-teal-50 dark:bg-teal-900/25',     gradient: 'from-teal-400 to-cyan-500'    },
    { title: 'AI Questions', value: analytics?.total_questions_asked ?? 0,  icon: MessageSquare, bg: 'bg-violet-50 dark:bg-violet-900/25', gradient: 'from-violet-500 to-purple-600' },
    { title: 'Quizzes Taken',value: analytics?.total_quizzes_taken ?? 0,    icon: Brain,         bg: 'bg-rose-50 dark:bg-rose-900/25',     gradient: 'from-rose-500 to-pink-500'    },
    { title: 'Study Hours',  value: `${analytics?.total_study_hours?.toFixed(1) ?? '0'}h`, icon: Clock, bg: 'bg-amber-50 dark:bg-amber-900/25', gradient: 'from-amber-400 to-orange-500' },
  ]

  const quickActions = [
    { label: 'Start AI Chat',    desc: 'Ask anything, get cited answers', icon: MessageSquare, to: '/chat',          gradient: 'from-violet-500 to-purple-600' },
    { label: 'Generate Quiz',    desc: 'Test your knowledge instantly',   icon: Brain,         to: '/quiz/generate', gradient: 'from-rose-500 to-pink-500'    },
    { label: 'Create Flashcards',desc: 'Spaced repetition study cards',   icon: CreditCard,    to: '/flashcards',    gradient: 'from-teal-400 to-cyan-500'    },
    { label: 'AI Summarizer',    desc: 'Condense docs in seconds',        icon: BookOpen,      to: '/summaries',     gradient: 'from-amber-400 to-orange-500' },
  ]

  return (
    <>
    <OnboardingModal open={showOnboarding} onClose={() => setShowOnboarding(false)} />
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5">

      {/* ── Welcome Banner ── */}
      <motion.div variants={itemVariants}>
        <style>{`
          @keyframes wave {
            0%,100% { transform: rotate(0deg); }
            20%      { transform: rotate(20deg); }
            40%      { transform: rotate(-10deg); }
            60%      { transform: rotate(18deg); }
            80%      { transform: rotate(-8deg); }
          }
          @keyframes launch {
            0%,100% { transform: translateY(0) rotate(-45deg); }
            50%     { transform: translateY(-5px) rotate(-45deg); }
          }
          @keyframes orb-drift {
            0%,100% { transform: translate(0,0) scale(1); }
            50%     { transform: translate(18px,-14px) scale(1.08); }
          }
          @keyframes orb-drift2 {
            0%,100% { transform: translate(0,0) scale(1); }
            50%     { transform: translate(-12px,10px) scale(1.05); }
          }
          @keyframes shimmer {
            0%   { transform: translateX(-100%) skewX(-15deg); }
            100% { transform: translateX(250%) skewX(-15deg); }
          }
        `}</style>
        <div
          className="relative overflow-hidden rounded-2xl px-6 py-6 sm:px-8 sm:py-7"
          style={{ background: 'linear-gradient(135deg, hsl(168 76% 22%) 0%, hsl(258 70% 40%) 55%, hsl(320 68% 42%) 100%)' }}
        >
          {/* Dot grid decoration */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }} />
          {/* Animated glow blobs */}
          <div className="pointer-events-none absolute -top-12 -right-12 h-56 w-56 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, white 0%, transparent 65%)', animation: 'orb-drift 7s ease-in-out infinite' }} />
          <div className="pointer-events-none absolute -bottom-10 left-1/4 h-40 w-40 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, white 0%, transparent 65%)', animation: 'orb-drift2 9s ease-in-out infinite' }} />
          {/* Shimmer sweep */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent"
              style={{ animation: 'shimmer 4s ease-in-out infinite' }} />
          </div>

          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <p className="text-sm font-medium text-white/70 flex items-center gap-1.5">
                  {greeting}
                  {/* Animated waving hand */}
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" style={{ display:'inline', transformOrigin:'70% 80%', animation:'wave 2.4s ease-in-out infinite' }}>
                    <path d="M8.5 3.5a1 1 0 0 1 1-1h.01a1 1 0 0 1 1 1v6" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
                    <path d="M10.5 3.5V2a1 1 0 0 1 2 0v7" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
                    <path d="M12.5 4a1 1 0 0 1 2 0v5.5" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
                    <path d="M14.5 5.5a1 1 0 0 1 2 0v6.5c0 3.314-2.686 6-6 6s-6-2.686-6-6V10a1 1 0 0 1 2 0v2" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                </p>
                {/* Streak badge */}
                {analytics?.streak_days ? (
                  <span className="flex items-center gap-1 rounded-full bg-white/15 border border-white/20 px-2.5 py-0.5 text-xs font-bold text-white backdrop-blur-sm">
                    <Flame className="h-3 w-3 text-orange-300" />
                    {analytics.streak_days} day streak
                  </span>
                ) : null}
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight tracking-tight">
                Welcome back,{' '}
                <span>{firstName}</span>!
              </h2>
              <p className="text-white/70 text-sm leading-relaxed max-w-md flex items-center gap-1.5">
                {analytics?.streak_days
                  ? `You're on a ${analytics.streak_days}-day streak — incredible! Keep pushing today.`
                  : <>
                      Ready to master your classes today with AI? Let's go!
                      {/* Animated rocket */}
                      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" style={{ display:'inline', flexShrink:0, animation:'launch 1.6s ease-in-out infinite' }}>
                        <path d="M12 2C12 2 7 6 7 13h10c0-7-5-11-5-11z" fill="white" fillOpacity="0.9"/>
                        <path d="M9 13v3a3 3 0 0 0 6 0v-3H9z" fill="white" fillOpacity="0.7"/>
                        <circle cx="12" cy="10" r="1.5" fill="hsl(258 70% 55%)"/>
                        <path d="M7 13c-1 0-2.5 1-2.5 2.5S7 16 7 16" stroke="white" strokeOpacity="0.6" strokeWidth="1.4" strokeLinecap="round"/>
                        <path d="M17 13c1 0 2.5 1 2.5 2.5S17 16 17 16" stroke="white" strokeOpacity="0.6" strokeWidth="1.4" strokeLinecap="round"/>
                      </svg>
                    </>
                }
              </p>
            </div>

            {/* Right side: streak stat + button */}
            <div className="flex flex-col items-start sm:items-end gap-3 shrink-0">
              {analytics && !analyticsLoading && (
                <div className="flex items-center gap-4 bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 backdrop-blur-sm">
                  <div className="text-center">
                    <p className="text-lg font-extrabold text-white tabular-nums">{analytics.avg_quiz_score?.toFixed(0) ?? 0}%</p>
                    <p className="text-[10px] font-semibold text-white/55 uppercase tracking-wider">Avg Score</p>
                  </div>
                  <div className="w-px h-8 bg-white/20" />
                  <div className="text-center">
                    <p className="text-lg font-extrabold text-white tabular-nums">{analytics.total_flashcards_reviewed}</p>
                    <p className="text-[10px] font-semibold text-white/55 uppercase tracking-wider">Cards</p>
                  </div>
                </div>
              )}
              <Button
                onClick={() => navigate('/documents')}
                className="bg-white/15 hover:bg-white/25 text-white border border-white/25 backdrop-blur-sm rounded-full"
                variant="outline"
              >
                <Plus className="mr-2 h-4 w-4" /> Upload Material
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Stats grid ── */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((s) => (
          <StatCard key={s.title} {...s} loading={analyticsLoading} />
        ))}
      </motion.div>

      {/* ── Pomodoro + Study Plan row ── */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pomodoro */}
        <PomodoroTimer />

        {/* Today's Study Plan */}
        <Card className="lg:col-span-2 border-border/50">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                <CalendarCheck className="h-3.5 w-3.5 text-white" />
              </div>
              <p className="text-sm font-bold">Today's Study Plan</p>
              {dueCardCount > 0 && (
                <span className="ml-auto flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold px-2 py-0.5 border border-amber-200 dark:border-amber-800">
                  <CreditCard className="h-3 w-3" />
                  {dueCardCount} card{dueCardCount !== 1 ? 's' : ''} due today
                </span>
              )}
            </div>
            <div className="space-y-2">
              {/* Due flashcards task */}
              {dueCardCount > 0 && (
                <button
                  onClick={() => navigate('/flashcards')}
                  className="w-full flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 px-3 py-2.5 text-left hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors group"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm">
                    <CreditCard className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight">Review Flashcards</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{dueCardCount} card{dueCardCount !== 1 ? 's' : ''} due for review today</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
                </button>
              )}
              {/* Take a quiz task */}
              {quizzes.length > 0 && (
                <button
                  onClick={() => navigate(`/quiz/${quizzes[0].id}`)}
                  className="w-full flex items-center gap-3 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-900/10 px-3 py-2.5 text-left hover:bg-violet-100/50 dark:hover:bg-violet-900/20 transition-colors group"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
                    <Brain className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight">Retake Latest Quiz</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{quizzes[0].title}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
                </button>
              )}
              {/* Upload or summarize */}
              <button
                onClick={() => navigate(documents.length ? '/summaries' : '/documents')}
                className="w-full flex items-center gap-3 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-900/10 px-3 py-2.5 text-left hover:bg-teal-100/50 dark:hover:bg-teal-900/20 transition-colors group"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-400 to-cyan-500 shadow-sm">
                  <Lightbulb className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-tight">
                    {documents.length ? 'Generate a Summary' : 'Upload Study Material'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {documents.length ? 'Condense your notes into key points' : 'Add documents to unlock AI tools'}
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Daily Goal + Weekly Chart + Quick Actions ── */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Daily Goal — circular ring */}
        <Card className="border-border/50">
          <CardContent className="p-5">
            {analyticsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-14 w-14 rounded-full" />
              </div>
            ) : (
              <div className="flex items-center gap-5">
                {/* Ring */}
                <div className="relative shrink-0">
                  <CircleProgress pct={dailyPct} size={64} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-extrabold tabular-nums">{Math.round(dailyPct)}%</span>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5 text-primary shrink-0" />
                      <p className="text-sm font-bold">Daily Goal</p>
                    </div>
                    {editingGoal ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number" min={0.5} max={24} step={0.5}
                          value={goalInput}
                          onChange={e => setGoalInput(e.target.value)}
                          className="w-14 h-6 text-xs border border-border rounded-lg px-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          autoFocus
                        />
                        <span className="text-xs text-muted-foreground">h</span>
                        <button onClick={handleSaveGoal} disabled={savingGoals}
                          className="text-emerald-500 hover:text-emerald-600 p-0.5 rounded transition-colors">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setEditingGoal(false)}
                          className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setGoalInput(String(dailyGoal)); setEditingGoal(true) }}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Edit goal"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-2xl font-extrabold tabular-nums tracking-tight">
                    {todayHours.toFixed(1)}<span className="text-sm font-semibold text-muted-foreground">/{dailyGoal}h</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 leading-snug">
                    {dailyPct >= 100
                      ? <span className="text-emerald-500 font-semibold">🎉 Goal reached!</span>
                      : <>{(dailyGoal - todayHours).toFixed(1)}h remaining today</>}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weekly Activity Chart — span 2 cols */}
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-1 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <div className="h-6 w-6 flex items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                  <BarChart2 className="h-3.5 w-3.5 text-white" />
                </div>
                Weekly Study Activity
              </CardTitle>
              {progress && (
                <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>{weeklyData.reduce((a, b) => a + b.hours, 0).toFixed(1)}h this week</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-4">
            {progressLoading ? (
              <Skeleton className="h-44 w-full rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height={176}>
                <BarChart data={weeklyData} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(168 76% 42%)" stopOpacity={0.8} />
                    </linearGradient>
                    <linearGradient id="barGradToday" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0.85} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false} tickLine={false}
                    domain={[0, Math.max(maxHours * 1.25, 1)]}
                    tickCount={4}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.5)', radius: 4 }} />
                  <Bar dataKey="hours" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    {weeklyData.map((entry) => (
                      <Cell
                        key={entry.day}
                        fill={entry.day === todayAbbr ? 'url(#barGradToday)' : 'url(#barGrad)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Quick Actions + Recent Documents ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Quick Actions */}
        <motion.div variants={itemVariants}>
          <Card className="h-full border-border/50">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <div className="h-6 w-6 flex items-center justify-center rounded-lg bg-gradient-to-br from-teal-400 to-cyan-500">
                  <Zap className="h-3.5 w-3.5 text-white" />
                </div>
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-4 space-y-1">
              {quickActions.map((action) => (
                <button
                  key={action.to}
                  className="w-full flex items-center justify-between rounded-xl px-3 py-3 hover:bg-accent transition-all group hover:-translate-y-0.5"
                  onClick={() => navigate(action.to)}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${action.gradient} shadow-sm`}>
                      <action.icon className="h-4 w-4 text-white" />
                    </span>
                    <span className="min-w-0 text-left">
                      <span className="text-sm font-semibold block leading-tight">{action.label}</span>
                      <span className="text-xs text-muted-foreground leading-tight">{action.desc}</span>
                    </span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </button>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Documents */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="h-full border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <div className="h-6 w-6 flex items-center justify-center rounded-lg bg-gradient-to-br from-teal-400 to-cyan-500">
                  <FileText className="h-3.5 w-3.5 text-white" />
                </div>
                Recent Documents
              </CardTitle>
              <Button variant="ghost" size="sm"
                className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground rounded-lg"
                onClick={() => navigate('/documents')}>
                View all →
              </Button>
            </CardHeader>
            <CardContent className="pt-0 px-3 pb-4">
              {docsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
                </div>
              ) : !Array.isArray(documents) || documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-muted">
                    <FileText className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">No documents yet</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Upload your first study material</p>
                  </div>
                  <Button size="sm" onClick={() => navigate('/documents')}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Upload now
                  </Button>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {(Array.isArray(documents) ? documents : []).slice(0, 5).map((doc) => (
                    <button
                      key={doc.id}
                      className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-accent transition-all text-left group hover:-translate-y-0.5"
                      onClick={() => navigate(`/documents/${doc.id}`)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400/20 to-cyan-500/20 border border-teal-500/20">
                          <FileText className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate leading-tight">{doc.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatFileSize(doc.file_size)} · {formatDate(doc.created_at)}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`shrink-0 text-xs ml-2 capitalize rounded-full ${getStatusColor(doc.status)}`}
                      >
                        {doc.status}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Recent Quizzes ── */}
      <motion.div variants={itemVariants}>
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <div className="h-6 w-6 flex items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-pink-500">
                <Brain className="h-3.5 w-3.5 text-white" />
              </div>
              Recent Quizzes
            </CardTitle>
            <Button variant="ghost" size="sm"
              className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground rounded-lg"
              onClick={() => navigate('/quiz')}>
              View all →
            </Button>
          </CardHeader>
          <CardContent className="pt-0 px-3 pb-4">
            {quizzesLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            ) : quizzes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-muted">
                  <Brain className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">No quizzes yet</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Generate a quiz from your documents</p>
                </div>
                <Button size="sm" onClick={() => navigate('/quiz/generate')}>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Generate Quiz
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {quizzes.slice(0, 6).map((quiz) => (
                  <button
                    key={quiz.id}
                    className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-left hover:bg-accent hover:border-border transition-all hover:-translate-y-0.5 hover:shadow-sm"
                    onClick={() => navigate(`/quiz/${quiz.id}`)}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 border border-rose-500/20 mt-0.5">
                      <Brain className="h-4 w-4 text-rose-500 dark:text-rose-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate leading-tight">{quiz.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{quiz.total_questions} questions</p>
                      <Badge variant="outline" className="text-[10px] mt-1.5 capitalize rounded-full h-4 px-2">
                        {quiz.difficulty}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

    </motion.div>
    </>
  )
}
