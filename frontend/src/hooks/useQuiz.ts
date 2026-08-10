import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { quizApi, getErrorMessage, type QuizGenerateRequest } from '@/lib/api'
import { toast } from 'sonner'

const QUIZZES_KEY = 'quizzes'

export function useQuizzes() {
  return useQuery({
    queryKey: [QUIZZES_KEY],
    queryFn: () => quizApi.list(),
  })
}

export function useQuiz(id: string | undefined) {
  return useQuery({
    queryKey: [QUIZZES_KEY, id],
    queryFn: () => quizApi.get(id!),
    enabled: !!id,
  })
}

export function useGenerateQuiz() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: QuizGenerateRequest) => quizApi.generate(data),
    onSuccess: (quiz) => {
      // Seed the individual quiz cache so QuizPage has data immediately on navigate
      qc.setQueryData([QUIZZES_KEY, quiz.id], quiz)
      qc.invalidateQueries({ queryKey: [QUIZZES_KEY] })
      toast.success('Quiz generated successfully!')
    },
    onError: (err: Error) => toast.error(getErrorMessage(err, 'Failed to generate quiz')),
  })
}

export function useDeleteQuiz() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => quizApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUIZZES_KEY] })
      toast.success('Quiz deleted')
    },
  })
}

export function useSubmitAttempt() {
  return useMutation({
    mutationFn: (data: { quiz_id: string; answers: Record<string, string>; time_taken_seconds?: number }) =>
      quizApi.submitAttempt(data),
    onError: (err: Error) => toast.error(err.message || 'Failed to submit attempt'),
  })
}
