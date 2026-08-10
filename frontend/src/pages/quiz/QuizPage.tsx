import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, ArrowLeft, ArrowRight, Trophy, Flag, Clock, Download, AlertCircle, Sparkles } from 'lucide-react'
import { useQuiz, useSubmitAttempt } from '@/hooks/useQuiz'
import { exportApi, getErrorMessage } from '@/lib/api'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { QuizAttemptResult } from '@/types'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [timerRunning, setTimerRunning] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [flagged, setFlagged] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (result || showReview) return
      const qs = quiz?.questions
      if (!qs) return
      const q = qs[current]
      const key = e.key.toUpperCase()
      if (q?.question_type === 'mcq' && q.options) {
        const idx = key.charCodeAt(0) - 65
        if (idx >= 0 && idx < q.options.length) {
          e.preventDefault()
          setAnswers((prev) => ({ ...prev, [q.id]: q.options![idx] }))
          setTextAnswer('')
          return
        }
      }
      if (e.key === 'ArrowLeft' && current > 0) { e.preventDefault(); setCurrent((c) => c - 1) }
      else if (e.key === 'ArrowRight' && current < qs.length - 1) { e.preventDefault(); setCurrent((c) => c + 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [result, showReview, quiz, current])

  useEffect(() => {
    if (quiz && quiz.questions?.length && !timerRunning && !result) {
      setTimerRunning(true)
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [quiz, result]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!quiz?.questions) return
    const q = quiz.questions[current]
    if (!q) return
    if (q.question_type === 'fill_blank' || q.question_type === 'short_answer') {
      setTextAnswer(answers[q.id] ?? '')
    }
  }, [current]) // eslint-disable-line react-hooks/exhaustive-deps

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setTimerRunning(false)
  }

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

  const questions = quiz.questions
  const question = questions[current]
  const progress = ((current + 1) / questions.length) * 100
  const answeredCount = Object.keys(answers).length
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
    stopTimer()
    const finalAnswers = { ...answers }
    if (textAnswer && question) finalAnswers[question.id] = textAnswer
    const res = await submitAttempt({ quiz_id: id, answers: finalAnswers, time_taken_seconds: elapsed })
    setResult(res)
    setShowReview(false)
  }

  // ── Results screen ─────────────────────────────────────────────────────────
  if (result) {
    const pct = result.percentage
    const passed = pct >= 70

    // Score ring arc fill angle
    const arcPct = Math.min(pct / 100, 1)
    const circumference = 2 * Math.PI * 44
    const dashOffset = circumference * (1 - arcPct)

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="max-w-2xl mx-auto space-y-4"
      >
        {/* Score hero card */}
        <Card className="overflow-hidden">
          {/* Top gradient band */}
          <div className={cn(
            'h-1.5 w-full',
            passed ? 'bg-gradient-to-r from-teal-400 via-violet-500 to-pink-500' : 'bg-gradient-to-r from-slate-400 to-slate-500'
          )} />
          <CardContent className="p-8">
            <div className="flex flex-col sm:flex-row items-center gap-8">
              {/* SVG ring + trophy */}
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
                  You got <span className="font-bold text-foreground">{result.correct}</span> out of <span className="font-bold text-foreground">{result.max_score}</span> questions correct.
                </p>
                {result.time_taken_seconds != null && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1 sm:justify-start justify-center">
                    <Clock className="h-3.5 w-3.5" /> Completed in {formatTime(result.time_taken_seconds)}
                  </p>
                )}

                {/* Mini stat pills */}
                <div className="flex flex-wrap gap-2 mt-4 sm:justify-start justify-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-3 py-1 text-xs font-semibold">
                    <CheckCircle className="h-3.5 w-3.5" /> {result.correct} correct
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-3 py-1 text-xs font-semibold">
                    <XCircle className="h-3.5 w-3.5" /> {result.max_score - result.correct} wrong
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
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Question Review
            </p>
            <div className="space-y-2">
              {result.feedback.map((f, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-xl border bg-card px-4 py-3 flex items-start gap-3',
                    'border-l-4',
                    f.is_correct
                      ? 'border-l-emerald-500 border-border'
                      : 'border-l-red-500 border-border'
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
                      <p className="text-xs mt-1">
                        <span className="text-muted-foreground">Correct: </span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{f.correct_answer}</span>
                      </p>
                    )}
                    {f.explanation && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.explanation}</p>
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

            <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin">
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
    <div className="max-w-2xl mx-auto space-y-5">
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
          <p className="text-xs text-muted-foreground mt-0.5">Question {current + 1} of {questions.length}</p>
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

      {/* Gradient progress bar */}
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
                  aria-label={flagged.has(question.id) ? 'Unflag question' : 'Flag for review'}
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
                  className="w-full rounded-xl border border-input bg-background text-foreground px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none placeholder:text-muted-foreground transition-shadow scrollbar-thin"
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
    </div>
  )
}
