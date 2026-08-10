import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, RotateCcw, Check, X, Trophy } from 'lucide-react'
import { useFlashcardSet, useFlashcardCards, useReviewCard } from '@/hooks/useFlashcards'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function FlashcardsPage() {
  const { setId } = useParams<{ setId: string }>()
  const navigate = useNavigate()
  const { data: set, isLoading: setLoading } = useFlashcardSet(setId)
  const { data: cards = [], isLoading: cardsLoading } = useFlashcardCards(setId)
  const { mutateAsync: reviewCard } = useReviewCard()

  const [current, setCurrent] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [reviewed, setReviewed] = useState<Set<string>>(new Set())
  const [correct, setCorrect] = useState(0)
  const [done, setDone] = useState(false)

  const handleReviewRef = useCallback(
    async (wasCorrect: boolean) => {
      const card = cards[current]
      if (!card || done) return
      await reviewCard({ flashcard_id: card.id, was_correct: wasCorrect })
      if (wasCorrect) setCorrect((c) => c + 1)
      setReviewed((r) => new Set([...r, card.id]))
      setFlipped(false)
      if (current + 1 >= cards.length) {
        setDone(true)
      } else {
        setCurrent((c) => c + 1)
      }
    },
    [cards, current, done, reviewCard],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't fire when typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (done) return
      switch (e.key) {
        case ' ':
        case 'Enter':
          e.preventDefault()
          setFlipped((f) => !f)
          break
        case 'ArrowRight':
          if (!flipped && current < cards.length - 1) {
            setCurrent((c) => c + 1)
            setFlipped(false)
          }
          break
        case 'ArrowLeft':
          if (!flipped && current > 0) {
            setCurrent((c) => c - 1)
            setFlipped(false)
          }
          break
        case 'y':
        case 'Y':
          if (flipped) handleReviewRef(true)
          break
        case 'n':
        case 'N':
          if (flipped) handleReviewRef(false)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flipped, current, cards.length, done, handleReviewRef])

  if (setLoading || cardsLoading) {
    return (
      <div className="max-w-lg mx-auto space-y-5">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (!set || cards.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">No flashcards found in this set.</p>
        <Button className="mt-4" onClick={() => navigate('/flashcards')}>Back to Flashcards</Button>
      </div>
    )
  }

  const card = cards[current]
  const progress = (reviewed.size / cards.length) * 100

  // handleReview is now handleReviewRef (defined above with useCallback for keyboard support)

  if (done) {
    const pct = Math.round((correct / cards.length) * 100)
    const passed = pct >= 70

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="max-w-md mx-auto text-center py-12"
      >
        <div className={cn(
          'flex h-20 w-20 items-center justify-center rounded-full mx-auto mb-4',
          passed ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-muted'
        )}>
          <Trophy className={cn('h-10 w-10', passed ? 'text-amber-500' : 'text-muted-foreground')} />
        </div>
        <h2 className="text-2xl font-bold">Session Complete!</h2>
        <p className="text-5xl font-bold mt-2 tabular-nums" style={{ color: passed ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}>
          {pct}%
        </p>
        <p className="text-muted-foreground mt-1">{correct} of {cards.length} correct</p>
        <div className="flex gap-2 mt-8">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              setCurrent(0); setFlipped(false); setReviewed(new Set()); setCorrect(0); setDone(false)
            }}
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Restart
          </Button>
          <Button className="flex-1" onClick={() => navigate('/flashcards')}>
            Done
          </Button>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate('/flashcards')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold truncate text-sm leading-tight">{set.title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Card {current + 1} of {cards.length} · {reviewed.size} reviewed
          </p>
        </div>
        {card.difficulty && (
          <Badge variant="outline" className="capitalize shrink-0">{card.difficulty}</Badge>
        )}
      </div>

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">{reviewed.size} reviewed</span>
          <span className="text-xs text-muted-foreground">{cards.length - reviewed.size} remaining</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Flip Card */}
      <div className="perspective-1000">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${current}-${flipped}`}
            initial={{ rotateY: flipped ? -90 : 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: flipped ? 90 : -90, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className={cn(
              'relative min-h-64 rounded-2xl border-2 p-8 cursor-pointer select-none',
              'flex flex-col items-center justify-center text-center',
              flipped
                ? 'bg-primary/5 border-primary/30 dark:bg-primary/10'
                : 'bg-card border-border hover:border-primary/20',
              'transition-colors'
            )}
            onClick={() => setFlipped(!flipped)}
          >
            {/* Side label */}
            <div className={cn(
              'absolute top-3 left-3 text-xs font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full',
              flipped ? 'text-primary bg-primary/10' : 'text-muted-foreground bg-muted'
            )}>
              {flipped ? 'Answer' : 'Question'}
            </div>

            <p className="text-lg font-semibold leading-relaxed mt-4">
              {flipped ? card.back : card.front}
            </p>

            {flipped && card.hint && (
              <div className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-2">
                <p className="text-sm text-amber-700 dark:text-amber-300">💡 {card.hint}</p>
              </div>
            )}

            {!flipped && (
              <p className="text-xs text-muted-foreground mt-5 flex items-center gap-1 opacity-60">
                <span>Click to reveal answer</span>
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Review buttons — only after flip */}
      {flipped ? (
        <div className="space-y-2">
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 h-11 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400 hover:border-red-400"
              onClick={() => handleReviewRef(false)}
            >
              <X className="mr-2 h-4 w-4" /> Didn't Know
            </Button>
            <Button
              className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white border-0"
              onClick={() => handleReviewRef(true)}
            >
              <Check className="mr-2 h-4 w-4" /> Got It!
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Press <kbd className="font-mono bg-muted border border-border rounded px-1">Y</kbd> for Got It ·{' '}
            <kbd className="font-mono bg-muted border border-border rounded px-1">N</kbd> for Didn't Know
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={current === 0}
              onClick={() => { setCurrent((c) => c - 1); setFlipped(false) }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Prev
            </Button>
            <div className="flex-1" />
            <Button className="h-10" onClick={() => setFlipped(true)}>
              Reveal Answer <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            <kbd className="font-mono bg-muted border border-border rounded px-1">Space</kbd> to flip ·{' '}
            <kbd className="font-mono bg-muted border border-border rounded px-1">←</kbd>{' '}
            <kbd className="font-mono bg-muted border border-border rounded px-1">→</kbd> to navigate
          </p>
        </div>
      )}
    </div>
  )
}
