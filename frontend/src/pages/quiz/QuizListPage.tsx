import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Brain, Plus, Trash2, Download, Clock, BarChart2, ArrowUpDown } from 'lucide-react'
import { useQuizzes, useDeleteQuiz } from '@/hooks/useQuiz'
import { exportApi, getErrorMessage } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate, getDifficultyColor } from '@/lib/utils'
import { toast } from 'sonner'
import { useState, useMemo } from 'react'

const quizTypeLabel: Record<string, string> = {
  mcq: 'MCQ',
  true_false: 'True/False',
  fill_blank: 'Fill in Blanks',
  short_answer: 'Short Answer',
  long_answer: 'Long Answer',
}

type SortKey = 'date' | 'title' | 'questions'
type FilterDifficulty = 'all' | 'easy' | 'medium' | 'hard'
type FilterType = 'all' | 'mcq' | 'true_false' | 'fill_blank' | 'short_answer' | 'long_answer'

export function QuizListPage() {
  const { data: quizzes = [], isLoading } = useQuizzes()
  const { mutateAsync: deleteQuiz } = useDeleteQuiz()
  const navigate = useNavigate()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [filterDifficulty, setFilterDifficulty] = useState<FilterDifficulty>('all')
  const [filterType, setFilterType] = useState<FilterType>('all')

  const displayQuizzes = useMemo(() => {
    let result = [...quizzes]
    if (filterDifficulty !== 'all') result = result.filter((q) => q.difficulty === filterDifficulty)
    if (filterType !== 'all') result = result.filter((q) => q.quiz_type === filterType)
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

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title="Quizzes"
        subtitle="Test your knowledge with AI-generated quizzes"
        actions={
          <Button onClick={() => navigate('/quiz/generate')}>
            <Plus className="mr-2 h-4 w-4" /> Generate Quiz
          </Button>
        }
      />

      {/* Sort & filter controls */}
      {!isLoading && quizzes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Newest first</SelectItem>
              <SelectItem value="title">Title A–Z</SelectItem>
              <SelectItem value="questions">Most questions</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterDifficulty} onValueChange={(v) => setFilterDifficulty(v as FilterDifficulty)}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All difficulties</SelectItem>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
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
            <span className="text-xs text-muted-foreground">{displayQuizzes.length} result{displayQuizzes.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[140px] w-full rounded-xl" />)}
        </div>
      ) : quizzes.length === 0 ? (
        <EmptyState
          icon={Brain}
          title="No quizzes yet"
          description="Generate a quiz from your study materials to test your knowledge"
          action={{ label: 'Generate Quiz', onClick: () => navigate('/quiz/generate') }}
        />
      ) : displayQuizzes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No quizzes match the current filters.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayQuizzes.map((quiz) => (
            <Card
              key={quiz.id}
              className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 group"
              onClick={() => navigate(`/quiz/${quiz.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/30">
                    <Brain className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleDownloadPdf(e, quiz.id)}
                      disabled={downloadingId === quiz.id}
                      className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-40"
                      title="Download PDF"
                      aria-label="Download quiz PDF"
                    >
                      <Download className={`h-3.5 w-3.5 ${downloadingId === quiz.id ? 'animate-pulse' : ''}`} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteId(quiz.id) }}
                      className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                      aria-label="Delete quiz"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="font-semibold text-sm line-clamp-2 leading-snug">{quiz.title}</h3>

                <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {quizTypeLabel[quiz.quiz_type] || quiz.quiz_type}
                  </Badge>
                  <Badge variant="outline" className={`text-xs capitalize ${getDifficultyColor(quiz.difficulty)}`}>
                    {quiz.difficulty}
                  </Badge>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <BarChart2 className="h-3 w-3" />
                    {quiz.total_questions} questions
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(quiz.created_at)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Quiz"
        description="This will permanently delete this quiz and all attempt records."
        confirmLabel="Delete"
        onConfirm={async () => { if (deleteId) await deleteQuiz(deleteId) }}
      />
    </motion.div>
  )
}
