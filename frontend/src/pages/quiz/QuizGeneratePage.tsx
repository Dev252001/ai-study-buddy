import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Brain, ArrowLeft, CheckSquare, ToggleLeft, AlignLeft, Type, FileText, Zap } from 'lucide-react'
import { useGenerateQuiz } from '@/hooks/useQuiz'
import { getErrorMessage } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { DocumentSelector } from '@/components/shared/DocumentSelector'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const schema = z.object({
  quiz_type: z.string().min(1),
  difficulty: z.string().min(1),
  num_questions: z.coerce.number().min(1).max(50),
  topics: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const quizTypes = [
  { value: 'mcq',          label: 'Multiple Choice', icon: CheckSquare, color: 'from-violet-500 to-purple-600' },
  { value: 'true_false',   label: 'True / False',    icon: ToggleLeft,  color: 'from-blue-500 to-cyan-500'    },
  { value: 'fill_blank',   label: 'Fill in Blanks',  icon: Type,        color: 'from-amber-500 to-orange-500' },
  { value: 'short_answer', label: 'Short Answer',    icon: AlignLeft,   color: 'from-emerald-500 to-teal-500' },
  { value: 'long_answer',  label: 'Long Answer',     icon: FileText,    color: 'from-rose-500 to-pink-500'    },
]

const difficulties = [
  { value: 'easy',   label: 'Easy',   dot: 'bg-emerald-400', active: 'bg-emerald-500 text-white shadow-sm' },
  { value: 'medium', label: 'Medium', dot: 'bg-amber-400',   active: 'bg-amber-500 text-white shadow-sm'   },
  { value: 'hard',   label: 'Hard',   dot: 'bg-rose-400',    active: 'bg-rose-500 text-white shadow-sm'    },
]

export function QuizGeneratePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [docIds, setDocIds] = useState<string[]>(() => {
    const doc = searchParams.get('doc')
    return doc ? [doc] : []
  })
  const { mutateAsync: generate, isPending } = useGenerateQuiz()

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { quiz_type: 'mcq', difficulty: 'medium', num_questions: 10 },
  })

  const selectedType = watch('quiz_type')
  const selectedDifficulty = watch('difficulty')

  const onSubmit = async (data: FormData) => {
    if (!docIds.length) return
    try {
      const topics = data.topics
        ? data.topics.split(',').map((t) => t.trim()).filter(Boolean)
        : null
      const quiz = await generate({ ...data, topics, document_id: docIds[0] })
      navigate(`/quiz/${quiz.id}`)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to generate quiz'))
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/quiz')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
          <Brain className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-extrabold text-foreground">Generate Quiz</h1>
          <p className="text-xs text-muted-foreground">Create an AI-powered quiz from your study materials</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        {/* Step 1 — Document */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <StepBadge n={1} />
              <p className="text-sm font-semibold">Study Material</p>
            </div>
            <DocumentSelector value={docIds} onChange={setDocIds} />
            {!docIds.length && (
              <p className="text-xs text-destructive mt-1.5">Select a document to continue</p>
            )}
          </CardContent>
        </Card>

        {/* Step 2 — Quiz Type: compact horizontal list */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <StepBadge n={2} />
              <p className="text-sm font-semibold">Quiz Type</p>
            </div>
            <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
              {quizTypes.map(({ value, label, icon: Icon, color }) => {
                const active = selectedType === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setValue('quiz_type', value)}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-all',
                      active
                        ? 'bg-primary/8'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    <div className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br transition-opacity',
                      color,
                      !active && 'opacity-60'
                    )}>
                      <Icon className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className={cn(
                      'text-sm flex-1 transition-colors',
                      active ? 'font-semibold text-foreground' : 'text-muted-foreground'
                    )}>{label}</span>
                    {active && (
                      <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Step 3 — Difficulty: segmented pill toggle */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <StepBadge n={3} />
              <p className="text-sm font-semibold">Difficulty</p>
            </div>
            <div className="flex gap-1.5 rounded-xl bg-muted p-1">
              {difficulties.map(({ value, label, dot, active: activeClass }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setValue('difficulty', value)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all',
                    selectedDifficulty === value
                      ? activeClass
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <div className={cn('h-2 w-2 rounded-full', dot)} />
                  {label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Step 4 — Count + Topics inline */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <StepBadge n={4} />
              <p className="text-sm font-semibold">Fine-tune</p>
              <span className="text-xs text-muted-foreground ml-1">optional</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Questions"
                type="number"
                min={1}
                max={50}
                error={errors.num_questions?.message}
                {...register('num_questions')}
              />
              <Input
                label="Topics"
                placeholder="e.g., Chapter 3, Neural Networks"
                {...register('topics')}
              />
            </div>
          </CardContent>
        </Card>

        <Button
          type="submit"
          className="w-full h-11 text-sm font-semibold"
          loading={isPending}
          disabled={!docIds.length}
        >
          <Zap className="mr-2 h-4 w-4" />
          {isPending ? 'Generating…' : 'Generate Quiz'}
        </Button>
      </form>
    </motion.div>
  )
}

function StepBadge({ n }: { n: number }) {
  return (
    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-violet-500 text-white text-[10px] font-bold shrink-0">
      {n}
    </div>
  )
}
