import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Brain, ArrowLeft } from 'lucide-react'
import { useGenerateQuiz } from '@/hooks/useQuiz'
import { getErrorMessage } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DocumentSelector } from '@/components/shared/DocumentSelector'
import { toast } from 'sonner'

const schema = z.object({
  quiz_type: z.string().min(1),
  difficulty: z.string().min(1),
  num_questions: z.coerce.number().min(1).max(50),
  topics: z.string().optional(),
})

type FormData = z.infer<typeof schema>

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

  const onSubmit = async (data: FormData) => {
    if (!docIds.length) return
    try {
      // Backend expects topics as list[str] | null, not a bare string
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
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/quiz')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title="Generate Quiz" subtitle="Create an AI-powered quiz from your study materials" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-green-500" /> Quiz Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="text-sm font-medium block mb-1.5">Study Material *</label>
              <DocumentSelector value={docIds} onChange={setDocIds} />
              {!docIds.length && (
                <p className="text-xs text-destructive mt-1">Please select a document</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">Quiz Type</label>
                <Select
                  value={watch('quiz_type')}
                  onValueChange={(v) => setValue('quiz_type', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mcq">Multiple Choice</SelectItem>
                    <SelectItem value="true_false">True / False</SelectItem>
                    <SelectItem value="fill_blank">Fill in Blanks</SelectItem>
                    <SelectItem value="short_answer">Short Answer</SelectItem>
                    <SelectItem value="long_answer">Long Answer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5">Difficulty</label>
                <Select
                  value={watch('difficulty')}
                  onValueChange={(v) => setValue('difficulty', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Input
              label="Number of Questions"
              type="number"
              min={1}
              max={50}
              error={errors.num_questions?.message}
              {...register('num_questions')}
            />

            <Input
              label="Topics (optional)"
              placeholder="e.g., Chapter 3, Neural Networks, Gradient Descent"
              {...register('topics')}
            />

            <Button
              type="submit"
              className="w-full"
              loading={isPending}
              disabled={!docIds.length}
            >
              {isPending ? 'Generating Quiz with AI...' : 'Generate Quiz'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  )
}
