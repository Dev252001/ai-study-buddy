import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle, XCircle, ArrowLeft, ArrowRight, Trophy, Flag,
  Clock, Download, AlertCircle, Sparkles, RotateCcw, MessageSquare, Timer,
} from 'lucide-react'
import { useQuiz, useSubmitAttempt } from '@/hooks/useQuiz'
import { exportApi, getErrorMessage } from '@/lib/api'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { QuizAttemptResult, QuizQuestion } from '@/types'

// ── Timer config ───────────────────────────────────────────────────────────────
const TIMER_SECONDS = 30   // seconds per question (0 = no per-question timer)

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ── Per-question countdown bar ─────────────────────────────────────────────────
function QuestionTimer({
  seconds,
  total,
  onExpire,
}: {
  seconds: number
  total: number
  onExpire: () => void
}) {
  const pct = Math.max(0, (seconds / total) * 100)
  const urgent = seconds <= 5
  const warning = seconds <= 10

  useEffect(() => {
    if (seconds === 0) onExpire()
  }, [seconds, onExpire])

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className={cn(
          'flex items-center gap-1 text-xs font-semibold tabular-nums',
          urgent ? 'text-red-500' : warning ? 'text-amber-500' : 'text-muted-foreground'
        )}>
          <Timer className="h-3 w-3" />
          {seconds}s
        </span>
        <span className="text-xs text-muted-foreground">{total}s per question</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            urgent
              ? 'bg-red-500'
              : warning
                ? 'bg-amber-400'
                : 'bg-gradient-to-r from-teal-500 to-violet-500'
          )}
          style={{ width: `${pct}%`, transition: 'width 1s linear, background-color 0.3s' }}
        />
      </div>
    </div>
  )
}

export function QuizPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: quiz, isLoading, isFetching } = useQuiz(id)
  const { mutateAsync: submitAttempt, isPending: submitting } = useSubmitAttempt()

  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<QuizAttemptResult | null>(null)
  const [textAnswer, setTextAnswer] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [timerRunning, setTimerRunning] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [flagged, setFlagged] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState(false)

  // Per-question countdown
  const [questionSeconds, setQuestionSeconds] = useState(TIMER_SECONDS)
  const questionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerEnabled = TIMER_SECONDS > 0

  // Retry mode — only wrong questions
  const [retryQuestions, setRetryQuestions] = useState<QuizQuestion[] | null>(null)
  const activeQuestions = retryQuestions ?? quiz?.questions ?? []

  // ── Elapsed (total quiz) timer ─────────────────────────────────────────────
  useEffect(() => {
    if (quiz && quiz.questions?.length && !timerRunning && !result) {
      setTimerRunning(true)
      elapsedRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    }
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current) }
  }, [quiz, result]) // eslint-disable-line react-hooks/exhaustive-deps

  const stopElapsedTimer = useCallback(() => {
    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null }
    setTimerRunning(false)
  }, [])

  // ── Per-question countdown ─────────────────────────────────────────────────
  const startQuestionTimer = useCallback(() => {
    if (!timerEnabled) return
    if (questionTimerRef.current) clearInterval(questionTimerRef.current)
    setQuestionSeconds(TIMER_SECONDS)
    questionTimerRef.current = setInterval(() => {
      setQuestionSeconds((s) => {
        if (s <= 1) {
          clearInterval(questionTimerRef.current!)
          questionTimerRef.current = null
          return 0
        }
        return s - 1
      })
    }, 1000)
  }, [timerEnabled])

  const stopQuestionTimer = useCallback(() => {
    if (questionTimerRef.current) { clearInterval(questionTimerRef.current); questionTimerRef.current = null }
  }, [])

  useEffect(() => {
    if (!result && !showReview && activeQuestions.length) {
      startQuestionTimer()
    }
    return stopQuestionTimer
  }, [current, result, showReview]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => () => { stopQuestionTimer(); stopElapsedTimer() }, [stopQuestionTimer, stopElapsedTimer])

  // Restore text answer when navigating
  useEffect(() => {
    if (!activeQuestions.length) return
    const q = activeQuestions[current]
    if (!q) return
    if (q.question_type === 'fill_blank' || q.question_type === 'short_answer') {
      setTextAnswer(answers[q.id] ?? '')
    }
  }, [current]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (result || showReview) return
      const q = activeQuestions[current]
      if (!q) return
      const key = e.key.toUpperCase()
      if (q.question_type === 'mcq' && q.options) {
        const idx = key.charCodeAt(0) - 65
        if (idx >= 0 && idx < q.options.length) {
          e.preventDefault()
          setAnswers((prev) => ({ ...prev, [q.id]: q.options![idx] }))
          setTextAnswer('')
          return
        }
      }
      if (e.key === 'ArrowLeft' && current > 0) { e.preventDefault(); setCurrent((c) => c - 1) }
      else if (e.key === 'ArrowRight' && current < activeQuestions.length - 1) { e.preventDefault(); setCurrent((c) => c + 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [result, showReview, activeQuestions, current])

  // ── Auto-advance on timer expire ──────────────────────────────────────────
  const handleTimerExpire = useCallback(() => {
    // Mark as unanswered (no action needed — just advance)
    toast.info("Time's up! Moving to next question.", { duration: 1500 })
    if (current < activeQuestions.length - 1) {
      setCurrent((c) => c + 1)
    } else {
      setShowReview(true)
    }
  }, [current, activeQuestions.length])

  const handleDownloadPdf = async () => {
    if (!id) return
    setDownloading(true)
    try {
      await exportApi.quiz(id)
      toast.success('PDF downloaded')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to download PDF'))
    } finally {
      setDownloading(false)
    }
  }

  if (isLoading || isFetching) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-2.5 w-full rounded-full" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (!quiz || !quiz.questions?.length) {
    return (
      <div className="text-center py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mx-auto mb-4">
          <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
        </div>
        <p className="font-semibold text-foreground">Quiz not found</p>
        <p className="text-sm text-muted-foreground mt-1">This quiz may have no questions or doesn't exist.</p>
        <Button className="mt-5" onClick={() => navigate('/quiz')}>Back to Quizzes</Button>
      </div>
    )
  }

  const questions = activeQuestions
  const question = questions[current]
  const progress = ((current + 1) / questions.length) * 100
  const answeredCount = Object.keys(answers).filter(k => questions.some(q => q.id === k)).length
  const unansweredCount = questions.length - answeredCount
  const flaggedQuestions = questions.filter((q) => flagged.has(q.id))

  const selectAnswer = (answer: string) => {
    if (!question) return
    setAnswers((prev) => ({ ...prev, [question.id]: answer }))
    setTextAnswer('')
  }

  const toggleFlag = () => {
    if (!question) return
    setFlagged((prev) => {
      const next = new Set(prev)
      if (next.has(question.id)) next.delete(question.id)
      else next.add(question.id)
      return next
    })
  }

  const handleSubmit = async () => {
    if (!id) return
    stopElapsedTimer()
    stopQuestionTimer()
    const finalAnswers = { ...answers }
    if (textAnswer && question) finalAnswers[question.id] = textAnswer
    const res = await submitAttempt({ quiz_id: id, answers: finalAnswers, time_taken_seconds: elapsed })
    setResult(res)
    setShowReview(false)
    setRetryQuestions(null)
  }

  const handleRetryWrong = () => {
    if (!result) return
    const wrongIds = result.feedback.filter(f => !f.is_correct).map(f => f.id)
    const wrongQs = (quiz.questions ?? []).filter(q => wrongIds.includes(q.id))
    if (!wrongQs.length) { toast.info('No wrong answers to retry!'); return }
    setResult(null)
    setAnswers({})
    setTextAnswer('')
    setElapsed(0)
    setCurrent(0)
    setFlagged(new Set())
    setRetryQuestions(wrongQs)
    setTimerRunning(false)
    // Restart elapsed timer
    elapsedRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    setTimerRunning(true)
    toast.info(`Retrying ${wrongQs.length} wrong answer${wrongQs.length > 1 ? 's' : ''}`)
  }

  // ── Results screen ─────────────────────────────────────────────────────────
  if (result) {
    const pct = result.percentage
    const passed = pct >= 70
    const circumference = 2 * Math.PI * 44
    const dashOffset = circumference * (1 - Math.min(pct / 100, 1))
    const wrongCount = result.max_score - result.correct

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="max-w-2xl mx-auto space-y-4"
      >
        {/* Score hero card */}
        <Card className="overflow-hidden">
          <div className={cn(
            'h-1.5 w-full',
            passed ? 'bg-gradient-to-r from-teal-400 via-violet-500 to-pink-500' : 'bg-gradient-to-r from-slate-400 to-slate-500'
          )} />
          <CardContent className="p-8">
            <div className="flex flex-col sm:flex-row items-center gap-8">
              {/* SVG ring */}
              <div className="relative shrink-0 flex items-center justify-center" style={{ width: 120, height: 120 }}>
                <svg width="120" height="120" className="-rotate-90">
                  <circle cx="60" cy="60" r="44" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
                  <circle
                    cx="60" cy="60" r="44" fill="none"
                    stroke="url(#scoreGrad)" strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                  />
                  <defs>
                    <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor={passed ? '#14b8a6' : '#94a3b8'} />
                      <stop offset="100%" stopColor={passed ? '#8b5cf6' : '#64748b'} />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Trophy className={cn('h-7 w-7 mb-0.5', passed ? 'text-amber-400' : 'text-muted-foreground/50')} />
                  <span className={cn(
                    'text-xl font-extrabold tabular-nums leading-none',
                    passed ? 'text-foreground' : 'text-muted-foreground'
                  )}>{pct.toFixed(0)}%</span>
                </div>
              </div>

              {/* Text summary */}
              <div className="flex-1 text-center sm:text-left">
                <h2 className="text-2xl font-extrabold">{passed ? '🎉 Well done!' : 'Keep practicing!'}</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  You got <span className="font-bold text-foreground">{result.correct}</span> of{' '}
                  <span className="font-bold text-foreground">{result.max_score}</span> correct.
                </p>
                {result.time_taken_seconds != null && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1 sm:justify-start justify-center">
                    <Clock className="h-3.5 w-3.5" /> Completed in {formatTime(result.time_taken_seconds)}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-4 sm:justify-start justify-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-3 py-1 text-xs font-semibold">
                    <CheckCircle className="h-3.5 w-3.5" /> {result.correct} correct
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-3 py-1 text-xs font-semibold">
                    <XCircle className="h-3.5 w-3.5" /> {wrongCount} wrong
                  </span>
                  <span className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
                    passed ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'bg-muted text-muted-foreground'
                  )}>
                    {passed ? '✓ Passed' : '✗ Not passed'} (70% to pass)
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Question Review card */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Question Review
              </p>
              {wrongCount > 0 && (
                <button
                  onClick={handleRetryWrong}
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Retry {wrongCount} wrong answer{wrongCount > 1 ? 's' : ''}
                </button>
              )}
            </div>
            <div className="space-y-2">
              {result.feedback.map((f, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-xl border bg-card px-4 py-3 flex items-start gap-3',
                    'border-l-4',
                    f.is_correct ? 'border-l-emerald-500 border-border' : 'border-l-red-500 border-border'
                  )}
                >
                  <div className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                    f.is_correct ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-red-100 dark:bg-red-900/40'
                  )}>
                    {f.is_correct
                      ? <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      : <XCircle className="h-3.5 w-3.5 text-red-500" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug">{f.question_text}</p>
                    {!f.is_correct && (
                      <div className="mt-1 space-y-0.5">
                        <p className="text-xs">
                          <span className="text-muted-foreground">Your answer: </span>
                          <span className="font-semibold text-red-500">{f.user_answer || '(unanswered)'}</span>
                        </p>
                        <p className="text-xs">
                          <span className="text-muted-foreground">Correct: </span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{f.correct_answer}</span>
                        </p>
                      </div>
                    )}
                    {f.explanation && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.explanation}</p>
                    )}
                    {/* Explain this in AI Chat */}
                    {!f.is_correct && (
                      <button
                        onClick={() => navigate(`/chat?q=${encodeURIComponent(`Explain this question: "${f.question_text}". The correct answer is "${f.correct_answer}". Why is this correct?`)}`)}
                        className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                      >
                        <MessageSquare className="h-3 w-3" />
                        Explain this in AI Chat
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} loading={downloading}>
            <Download className="mr-2 h-4 w-4" /> Download PDF
          </Button>
          <Button variant="outline" className="flex-1 min-w-[100px]" onClick={() => navigate('/quiz')}>
            Back to Quizzes
          </Button>
          <Button className="flex-1 min-w-[100px]" onClick={() => navigate('/quiz/generate')}>
            Try Another Quiz
          </Button>
        </div>
      </motion.div>
    )
  }

  // ── Review screen ──────────────────────────────────────────────────────────
  if (showReview) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Review Before Submitting</h2>
                <p className="text-sm text-muted-foreground">Check your answers before final submission.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-2xl font-bold tabular-nums">{questions.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Total</p>
              </div>
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{answeredCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Answered</p>
              </div>
              <div className={cn('rounded-xl p-3 text-center', unansweredCount > 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-muted/50')}>
                <p className={cn('text-2xl font-bold tabular-nums', unansweredCount > 0 ? 'text-amber-600 dark:text-amber-400' : '')}>{unansweredCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Unanswered</p>
              </div>
              <div className={cn('rounded-xl p-3 text-center', flaggedQuestions.length > 0 ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-muted/50')}>
                <p className={cn('text-2xl font-bold tabular-nums', flaggedQuestions.length > 0 ? 'text-orange-500' : '')}>{flaggedQuestions.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Flagged</p>
              </div>
            </div>

            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  className="w-full flex items-center gap-2 rounded-xl border p-2.5 text-sm cursor-pointer hover:bg-muted/50 transition-colors text-left"
                  onClick={() => { setCurrent(i); setShowReview(false) }}
                >
                  <span className="w-7 text-xs font-semibold text-muted-foreground shrink-0 text-right">Q{i + 1}</span>
                  <span className="flex-1 truncate text-foreground">{q.question_text}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {flagged.has(q.id) && <Flag className="h-3.5 w-3.5 text-orange-500" />}
                    {answers[q.id]
                      ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                      : <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                    }
                  </div>
                </button>
              ))}
            </div>

            {unansweredCount > 0 && (
              <div className="flex items-center gap-2 mt-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {unansweredCount} question{unansweredCount > 1 ? 's' : ''} unanswered — you can still go back.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setShowReview(false)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Quiz
          </Button>
          <Button className="flex-1" onClick={handleSubmit} loading={submitting}>
            Submit Quiz
          </Button>
        </div>
      </motion.div>
    )
  }

  // ── Active quiz screen ─────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/quiz')}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card hover:bg-accent transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm truncate leading-tight">{quiz.title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Question {current + 1} of {questions.length}
            {retryQuestions && <span className="ml-1.5 text-primary font-medium">(Retry mode)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className={cn(
            'flex items-center gap-1.5 text-sm font-mono tabular-nums rounded-xl px-2.5 py-1.5 border',
            elapsed > 3600
              ? 'text-red-500 border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30'
              : 'text-muted-foreground border-border bg-muted/30'
          )}>
            <Clock className="h-3.5 w-3.5" />
            {formatTime(elapsed)}
          </div>
          <Badge variant="outline" className="capitalize">{quiz.difficulty}</Badge>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">{answeredCount} answered</span>
          <span className="text-xs text-muted-foreground">{questions.length - answeredCount} remaining</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal-500 to-violet-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Per-question countdown */}
      {timerEnabled && !result && (
        <QuestionTimer
          key={current}
          seconds={questionSeconds}
          total={TIMER_SECONDS}
          onExpire={handleTimerExpire}
        />
      )}

      {/* Question card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.18 }}
        >
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                      {current + 1} / {questions.length}
                    </span>
                    {flagged.has(question.id) && (
                      <span className="text-xs text-orange-500 flex items-center gap-1">
                        <Flag className="h-3 w-3" fill="currentColor" /> Flagged
                      </span>
                    )}
                  </div>
                  <p className="text-base font-medium leading-relaxed text-foreground">{question.question_text}</p>
                </div>
                <button
                  onClick={toggleFlag}
                  title={flagged.has(question.id) ? 'Unflag question' : 'Flag for review'}
                  className={cn(
                    'shrink-0 flex h-8 w-8 items-center justify-center rounded-xl transition-colors',
                    flagged.has(question.id)
                      ? 'text-orange-500 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100'
                      : 'text-muted-foreground hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20',
                  )}
                >
                  <Flag className="h-4 w-4" fill={flagged.has(question.id) ? 'currentColor' : 'none'} />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pb-5">
              {question.question_type === 'mcq' && question.options?.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => selectAnswer(opt)}
                  className={cn(
                    'w-full text-left rounded-xl border-2 px-4 py-3 text-sm transition-all',
                    answers[question.id] === opt
                      ? 'border-primary bg-primary/8 font-medium text-foreground ring-1 ring-primary/30'
                      : 'border-border hover:border-primary/40 hover:bg-muted/50',
                  )}
                >
                  <kbd className="inline-flex items-center justify-center h-5 w-5 rounded-md border border-border bg-muted text-xs font-bold text-muted-foreground mr-2 shrink-0">
                    {String.fromCharCode(65 + i)}
                  </kbd>
                  {opt}
                </button>
              ))}

              {question.question_type === 'true_false' && (
                <div className="grid grid-cols-2 gap-2">
                  {['True', 'False'].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => selectAnswer(opt)}
                      className={cn(
                        'rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all',
                        answers[question.id] === opt
                          ? 'border-primary bg-primary/8 text-foreground ring-1 ring-primary/30'
                          : 'border-border hover:border-primary/40 hover:bg-muted/50',
                      )}
                    >
                      {opt === 'True' ? '✓ True' : '✗ False'}
                    </button>
                  ))}
                </div>
              )}

              {(question.question_type === 'fill_blank' || question.question_type === 'short_answer') && (
                <textarea
                  value={textAnswer}
                  onChange={(e) => {
                    setTextAnswer(e.target.value)
                    setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))
                  }}
                  placeholder="Type your answer here..."
                  className="w-full rounded-xl border border-input bg-background text-foreground px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none placeholder:text-muted-foreground transition-shadow"
                  rows={4}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Question navigation dots */}
      <div className="flex flex-wrap gap-1.5 justify-center">
        {questions.map((q, i) => (
          <button
            key={q.id}
            onClick={() => setCurrent(i)}
            className={cn(
              'h-7 w-7 rounded-lg text-xs font-semibold transition-all',
              i === current
                ? 'bg-gradient-to-br from-teal-500 to-violet-500 text-white shadow-sm'
                : answers[q.id]
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                  : flagged.has(q.id)
                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600'
                    : 'bg-muted text-muted-foreground hover:bg-accent',
            )}
            aria-label={`Question ${i + 1}`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setCurrent((c) => c - 1)} disabled={current === 0}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Previous
        </Button>
        <div className="flex-1" />
        {current < questions.length - 1 ? (
          <Button onClick={() => setCurrent((c) => c + 1)}>
            Next <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={() => setShowReview(true)}>
            Review &amp; Submit
          </Button>
        )}
      </div>

      {/* Keyboard hint */}
      <p className="text-xs text-muted-foreground text-center">
        <kbd className="font-mono bg-muted border border-border rounded px-1.5 py-0.5">A</kbd>–
        <kbd className="font-mono bg-muted border border-border rounded px-1.5 py-0.5">D</kbd> select ·{' '}
        <kbd className="font-mono bg-muted border border-border rounded px-1.5 py-0.5">←</kbd>{' '}
        <kbd className="font-mono bg-muted border border-border rounded px-1.5 py-0.5">→</kbd> navigate
      </p>
    </div>
  )
}
