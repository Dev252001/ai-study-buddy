import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { flashcardsApi, getErrorMessage, type FlashcardGenerateRequest } from '@/lib/api'
import { toast } from 'sonner'

const SETS_KEY = 'flashcard-sets'
const CARDS_KEY = 'flashcard-cards'

export function useFlashcardSets() {
  return useQuery({
    queryKey: [SETS_KEY],
    queryFn: () => flashcardsApi.listSets(),
  })
}

export function useFlashcardSet(id: string | undefined) {
  return useQuery({
    queryKey: [SETS_KEY, id],
    queryFn: () => flashcardsApi.getSet(id!),
    enabled: !!id,
  })
}

export function useFlashcardCards(setId: string | undefined) {
  return useQuery({
    queryKey: [CARDS_KEY, setId],
    queryFn: () => flashcardsApi.getCards(setId!),
    enabled: !!setId,
  })
}

export function useGenerateFlashcards() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: FlashcardGenerateRequest) => flashcardsApi.generate(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SETS_KEY] })
      toast.success('Flashcards generated!')
    },
    onError: (err: Error) => toast.error(getErrorMessage(err, 'Failed to generate flashcards')),
  })
}

export function useDeleteFlashcardSet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => flashcardsApi.deleteSet(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SETS_KEY] })
      toast.success('Flashcard set deleted')
    },
    onError: (err: Error) => toast.error(getErrorMessage(err, 'Failed to delete flashcard set')),
  })
}

export function useReviewCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { flashcard_id: string; was_correct: boolean }) =>
      flashcardsApi.reviewCard(data),
    // Don't invalidate per-card during a session — FlashcardsPage tracks state locally.
    // Invalidate the sets list so the card counts are fresh when navigating back.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SETS_KEY] })
    },
    onError: (err: Error) => toast.error(getErrorMessage(err, 'Failed to record review')),
  })
}
