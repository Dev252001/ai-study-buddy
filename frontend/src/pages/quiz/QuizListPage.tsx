import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, Trash2, Download, Clock,
  BarChart2, ArrowUpDown, Sparkles, Trophy,
  Target, Zap, BookOpen, FileQuestion, AlignLeft,
  ToggleLeft, CheckSquare,
} from 'lucide-react'
import { useQuizzes, useDeleteQuiz } from '@/hooks/useQuiz'
import { exportApi, getErrorMessage } from '@/lib/api'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { useState, useMemo } from 'react'
import { useAnalytics } from '@/hooks/useAnalytics'

// ── Constants ─────────────────────────────────────────────────────────────────
const QUIZ_TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  mcq:          { label: 'MCQ',           icon: CheckSquare, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/25' },
  true_false:   { label: 'True/False',    icon: ToggleLeft,  color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-900/25'   },
  fill_blank:   { label: 'Fill Blanks',   icon: FileQuestion,color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/25' },
  short_answer: { label: 'Short Answer',  icon: AlignLeft,   color: 'text-teal-600 dark:text-teal-400',   bg: 'bg-teal-50 dark:bg-teal-900/25'   },
  long_answer:  { label: 'Long Answer',   icon: BookOpen,    color: 'text-rose-600 dark:text-rose-400',    bg: 'bg-rose-50 dark:bg-rose-900/25'   },
}

const DIFFICULTY_META: Record<string, { gradient: string; border: string; label: string; icon: React.ElementType }> = {
  easy:   { gradient: 'from-emerald-400 to-teal-500',    border: 'border-t-emerald-400', label: 'Easy',   icon: Zap    },
  medium: { gradient: 'from-amber-400 to-orange-500',    border: 'border-t-amber-400',   label: 'Medium', icon: Target },
  hard:   { gradient: 'from-rose-500 to-pink-600',       border: 'border-t-rose-500',    label: 'Hard',   icon: Trophy },
}

type SortKey = 'date' | 'title' | 'questions'
type FilterDifficulty = 'all' | 'easy' | 'medium' | 'hard'
type FilterType = 'all' | 'mcq' | 'true_false' | 'fill_blank' | 'short_answer' | 'long_answer'

// ── Clean quiz title (strip underscores, trim doc suffixes) ───────────────────
function cleanTitle(title: string) {
  return title.replace(/_/g, ' ').replace(/\(\d+\)/g, '').trim()
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function QuizListPage() {
  const { data: quizzes = [], isLoading } = useQuizzes()
  const { data: analytics } = useAnalytics()
  const { mutateAsync: deleteQuiz } = useDeleteQuiz()
  const navigate = useNavigate()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [filterDifficulty, setFilterDifficulty] = useState<FilterDifficulty>('all')
  const [filterType, setFilterType] = useState<FilterType>('all')

  const displayQuizzes = useMemo(() => {
    let result = [...quizzes]
    if (filterDifficulty !== 'all') result = result.filter(q => q.difficulty === filterDifficulty)
    if (filterType !== 'all') result = result.filter(q => q.quiz_type === filterType)
    result.sort((a, b) => {
      if (sortKey === 'title') return a.title.localeCompare(b.title)
      if (sortKey === 'questions') return b.total_questions - a.total_questions
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return result
  }, [quizzes, sortKey, filterDifficulty, filterType])

  const handleDownloadPdf = async (e: React.MouseEvent, quizId: string) => {
    e.stopPropagation()
    setDownloadingId(quizId)
    try {
      await exportApi.quiz(quizId)
      toast.success('PDF downloaded')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to download PDF'))
    } finally {
      setDownloadingId(null)
    }
  }

  const totalQuestions = quizzes.reduce((a, b) => a + b.total_questions, 0)
  const avgScore = analytics?.avg_quiz_score ?? 0

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 shrink-0">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Quizzes</h2>
            <p className="text-sm text-muted-foreground">Test your knowledge with AI-generated quizzes</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Stats pills */}
          {!isLoading && quizzes.length > 0 && (
            <>
              <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold">
                <Brain className="h-3 w-3 text-rose-500" />
                {quizzes.length} quiz{quizzes.length !== 1 ? 'zes' : ''}
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold">
                <BarChart2 className="h-3 w-3 text-violet-500" />
                {totalQuestions} questions
              </span>
              {avgScore > 0 && (
                <span className="flex items-center gap-1.5 rounded-full border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 border px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <Trophy className="h-3 w-3" />
                  {avgScore.toFixed(0)}% avg
                </span>
              )}
            </>
          )}
          <Button onClick={() => navigate('/quiz/generate')} className="gap-2 rounded-full">
            <Sparkles className="h-4 w-4" /> Generate Quiz
          </Button>
        </div>
      </div>

      {/* ── Sort & filter ── */}
      {!isLoading && quizzes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <ArrowUpDown className="h-3.5 w-3.5" />
            Sort:
          </div>
          <Select value={sortKey} onValueChange={v => setSortKey(v as SortKey)}>
            <SelectTrigger className="h-8 w-36 text-xs rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Newest first</SelectItem>
              <SelectItem value="title">Title A–Z</SelectItem>
              <SelectItem value="questions">Most questions</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterDifficulty} onValueChange={v => setFilterDifficulty(v as FilterDifficulty)}>
            <SelectTrigger className="h-8 w-36 text-xs rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All difficulties</SelectItem>
              <SelectItem value="easy">🟢 Easy</SelectItem>
              <SelectItem value="medium">🟡 Medium</SelectItem>
              <SelectItem value="hard">🔴 Hard</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={v => setFilterType(v as FilterType)}>
            <SelectTrigger className="h-8 w-40 text-xs rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="mcq">MCQ</SelectItem>
              <SelectItem value="true_false">True/False</SelectItem>
              <SelectItem value="fill_blank">Fill in Blanks</SelectItem>
              <SelectItem value="short_answer">Short Answer</SelectItem>
              <SelectItem value="long_answer">Long Answer</SelectItem>
            </SelectContent>
          </Select>
          {(filterDifficulty !== 'all' || filterType !== 'all') && (
            <span className="text-xs text-muted-foreground font-medium">
              {displayQuizzes.length} of {quizzes.length} shown
            </span>
          )}
        </div>
      )}

      {/* ── Quiz grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[160px] w-full rounded-2xl" />
          ))}
        </div>
      ) : quizzes.length === 0 ? (
        /* ── Empty state ── */
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/60 py-20 gap-5">
          <motion.div
            className="h-20 w-20 flex items-center justify-center rounded-3xl"
            style={{ background: 'linear-gradient(135deg, hsl(168 76% 36%), #8b5cf6, #ec4899)' }}
            animate={{ rotate: [0, 3, -3, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Brain className="h-9 w-9 text-white" />
          </motion.div>
          <div className="text-center max-w-xs">
            <p className="text-lg font-bold text-foreground">No quizzes yet</p>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Generate your first AI quiz from any uploaded document — MCQ, True/False, Fill-in-Blanks and more.
            </p>
          </div>
          <Button onClick={() => navigate('/quiz/generate')} className="gap-2 rounded-full">
            <Sparkles className="h-4 w-4" /> Generate your first quiz
          </Button>
        </div>
      ) : displayQuizzes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Brain className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground font-medium">No quizzes match the current filters.</p>
          <button
            onClick={() => { setFilterDifficulty('all'); setFilterType('all') }}
            className="text-xs text-primary hover:underline font-semibold"
          >Clear filters</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence initial={false}>
            {displayQuizzes.map((quiz, i) => {
              const typeMeta = QUIZ_TYPE_META[quiz.quiz_type] ?? QUIZ_TYPE_META.mcq
              const diffMeta = DIFFICULTY_META[quiz.difficulty] ?? DIFFICULTY_META.medium
              const TypeIcon = typeMeta.icon
              const DiffIcon = diffMeta.icon
              return (
                <motion.div
                  key={quiz.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.04 }}
                  className="group relative flex flex-col rounded-2xl border border-border/60 bg-card overflow-hidden cursor-pointer hover:border-border hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
                  onClick={() => navigate(`/quiz/${quiz.id}`)}
                >
                  {/* Difficulty top accent bar */}
                  <div className={`h-1 w-full bg-gradient-to-r ${diffMeta.gradient}`} />

                  <div className="p-4 flex flex-col flex-1">
                    {/* Header row */}
                    <div className="flex items-start justify-between mb-3">
                      {/* Type icon */}
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${typeMeta.bg}`}>
                        <TypeIcon className={`h-5 w-5 ${typeMeta.color}`} />
                      </div>

                      {/* Action buttons — appear on hover */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-150">
                        <button
                          onClick={e => handleDownloadPdf(e, quiz.id)}
                          disabled={downloadingId === quiz.id}
                          className="flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-40"
                          title="Download PDF"
                        >
                          <Download className={`h-3.5 w-3.5 ${downloadingId === quiz.id ? 'animate-pulse' : ''}`} />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteId(quiz.id) }}
                          className="flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                          title="Delete quiz"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="font-bold text-sm line-clamp-2 leading-snug flex-1 group-hover:text-primary transition-colors">
                      {cleanTitle(quiz.title)}
                    </h3>

                    {/* Type + difficulty badges */}
                    <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                      <span className={`flex items-center gap-1 text-[10px] font-bold border rounded-full px-2 py-0.5 ${typeMeta.bg} ${typeMeta.color}`}
                        style={{ borderColor: 'transparent' }}>
                        <TypeIcon className="h-2.5 w-2.5" />
                        {typeMeta.label}
                      </span>
                      <span className={`flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-gradient-to-r ${diffMeta.gradient} text-white`}>
                        <DiffIcon className="h-2.5 w-2.5" />
                        {diffMeta.label}
                      </span>
                    </div>

                    {/* Footer stats */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <BarChart2 className="h-3 w-3 shrink-0" />
                        {quiz.total_questions} question{quiz.total_questions !== 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-3 w-3 shrink-0" />
                        {formatDate(quiz.created_at)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={open => !open && setDeleteId(null)}
        title="Delete Quiz"
        description="This will permanently delete this quiz and all attempt records."
        confirmLabel="Delete"
        onConfirm={async () => { if (deleteId) await deleteQuiz(deleteId) }}
      />
    </motion.div>
  )
}
