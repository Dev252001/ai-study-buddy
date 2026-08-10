import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CreditCard, Plus, Trash2, Download, Clock, ArrowUpDown, Zap, Layers } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useFlashcardSets, useDeleteFlashcardSet, useGenerateFlashcards } from '@/hooks/useFlashcards'
import { exportApi, getErrorMessage } from '@/lib/api'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DocumentSelector } from '@/components/shared/DocumentSelector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const schema = z.object({
  num_cards: z.coerce.number().min(1).max(50).default(10),
  topic: z.string().optional(),
  difficulty: z.string().optional(),
})
type FormData = z.infer<typeof schema>

type SortKey = 'date' | 'title' | 'cards'
type FilterDifficulty = 'all' | 'easy' | 'medium' | 'hard'

const difficultyAccent: Record<string, string> = {
  easy: 'from-emerald-400 to-teal-400',
  medium: 'from-amber-400 to-orange-400',
  hard: 'from-rose-400 to-pink-400',
}
const difficultyBadge: Record<string, string> = {
  easy: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  medium: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  hard: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
}

function cleanTitle(t: string) {
  return t.replace(/_/g, ' ').replace(/\s*\(\d+\)\s*$/, '').trim()
}

export function FlashcardsListPage() {
  const { data: sets = [], isLoading } = useFlashcardSets()
  const { mutateAsync: deleteSet } = useDeleteFlashcardSet()
  const { mutateAsync: generate, isPending } = useGenerateFlashcards()
  const navigate = useNavigate()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [docIds, setDocIds] = useState<string[]>([])
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [filterDifficulty, setFilterDifficulty] = useState<FilterDifficulty>('all')

  const displaySets = useMemo(() => {
    let result = [...sets]
    if (filterDifficulty !== 'all') {
      result = result.filter((s) => s.difficulty === filterDifficulty)
    }
    result.sort((a, b) => {
      if (sortKey === 'title') return a.title.localeCompare(b.title)
      if (sortKey === 'cards') {
        const aCount = a.cards?.length ?? a.card_count ?? 0
        const bCount = b.cards?.length ?? b.card_count ?? 0
        return bCount - aCount
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return result
  }, [sets, sortKey, filterDifficulty])

  const handleDownloadPdf = async (e: React.MouseEvent, setId: string) => {
    e.stopPropagation()
    setDownloadingId(setId)
    try {
      await exportApi.flashcards(setId)
      toast.success('PDF downloaded')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to download PDF'))
    } finally {
      setDownloadingId(null)
    }
  }

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { num_cards: 10, difficulty: 'medium' },
  })

  const onGenerate = async (data: FormData) => {
    if (!docIds.length) return
    const set = await generate({ ...data, document_id: docIds[0] })
    setGenerateOpen(false)
    navigate(`/flashcards/${set.id}`)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-sm">
            <CreditCard className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-foreground">Flashcards</h1>
            <p className="text-xs text-muted-foreground">Study smarter with AI-generated flashcards</p>
          </div>
          {!isLoading && sets.length > 0 && (
            <div className="flex items-center gap-2 ml-2">
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {sets.length} set{sets.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
        <Button onClick={() => setGenerateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Generate Flashcards
        </Button>
      </div>

      {/* Sort & filter */}
      {!isLoading && sets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Newest first</SelectItem>
              <SelectItem value="title">Title A–Z</SelectItem>
              <SelectItem value="cards">Most cards</SelectItem>
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
          {filterDifficulty !== 'all' && (
            <span className="text-xs text-muted-foreground">{displaySets.length} result{displaySets.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[160px] rounded-2xl" />)}
        </div>
      ) : sets.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No flashcard sets yet"
          description="Generate flashcards from your study materials to review key concepts"
          action={{ label: 'Generate Flashcards', onClick: () => setGenerateOpen(true) }}
        />
      ) : displaySets.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No sets match the current filter.{' '}
          <button onClick={() => setFilterDifficulty('all')} className="text-primary hover:underline">Clear filter</button>
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displaySets.map((set) => {
            const cardCount = set.cards?.length ?? set.card_count ?? 0
            const accent = difficultyAccent[set.difficulty ?? ''] ?? 'from-blue-400 to-cyan-400'
            const badge = difficultyBadge[set.difficulty ?? '']
            return (
              <Card
                key={set.id}
                className="cursor-pointer group hover:shadow-lg hover:-translate-y-0.5 transition-all overflow-hidden"
                onClick={() => navigate(`/flashcards/${set.id}`)}
              >
                {/* Top accent bar */}
                <div className={cn('h-1 w-full bg-gradient-to-r', accent)} />
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br', accent)}>
                      <CreditCard className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleDownloadPdf(e, set.id)}
                        disabled={downloadingId === set.id}
                        className="flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-40"
                        title="Download PDF"
                      >
                        <Download className={cn('h-3.5 w-3.5', downloadingId === set.id && 'animate-pulse')} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteId(set.id) }}
                        className="flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-semibold text-sm line-clamp-2 leading-snug">{cleanTitle(set.title)}</h3>

                  {set.difficulty && (
                    <span className={cn('mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize', badge)}>
                      {set.difficulty}
                    </span>
                  )}

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      {cardCount} card{cardCount !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(set.created_at)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Generate Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
                <Zap className="h-3.5 w-3.5 text-white" />
              </div>
              Generate Flashcards
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onGenerate)} className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium block mb-1.5">Study Material *</label>
              <DocumentSelector value={docIds} onChange={setDocIds} />
              {!docIds.length && (
                <p className="text-xs text-muted-foreground mt-1">Select a document to generate from</p>
              )}
            </div>
            <Input
              label="Number of Cards"
              type="number"
              min={1}
              max={50}
              error={errors.num_cards?.message}
              {...register('num_cards')}
            />
            <Input label="Topic (optional)" placeholder="e.g., Photosynthesis, Chapter 3" {...register('topic')} />
            <div>
              <label className="text-sm font-medium block mb-1.5">Difficulty</label>
              <Select value={watch('difficulty')} onValueChange={(v) => setValue('difficulty', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" loading={isPending} disabled={!docIds.length}>
              <Zap className="mr-2 h-4 w-4" /> Generate Flashcards
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Flashcard Set"
        description="This will permanently delete this flashcard set and all cards in it."
        confirmLabel="Delete"
        onConfirm={async () => { if (deleteId) await deleteSet(deleteId) }}
      />
    </motion.div>
  )
}
