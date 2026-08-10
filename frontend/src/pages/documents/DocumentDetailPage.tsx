import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, MessageSquare, Brain, CreditCard, Wand2,
  RefreshCw, Trash2, FileText, Hash, Type, BookOpen,
  Calendar, Tag, Loader2, Layers,
} from 'lucide-react'
import { useDocument, useDocumentChunks, useDeleteDocument, useReprocessDocument } from '@/hooks/useDocuments'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { formatDate, formatFileSize, getStatusColor, getFileTypeLabel, getFileTypeColor } from '@/lib/utils'
import { useState } from 'react'
import { cn } from '@/lib/utils'

/* ── Gradient palette for action buttons ── */
const ACTIONS = [
  {
    label: 'Chat About This',
    icon: MessageSquare,
    from: 'from-teal-500',
    to: 'to-cyan-400',
    route: (id: string) => `/chat?doc=${id}`,
    requiresReady: true,
  },
  {
    label: 'Generate Quiz',
    icon: Brain,
    from: 'from-violet-500',
    to: 'to-purple-400',
    route: (id: string) => `/quiz/generate?doc=${id}`,
    requiresReady: true,
  },
  {
    label: 'Create Flashcards',
    icon: CreditCard,
    from: 'from-pink-500',
    to: 'to-rose-400',
    route: (id: string) => `/flashcards?doc=${id}`,
    requiresReady: true,
  },
  {
    label: 'Summarize',
    icon: Wand2,
    from: 'from-amber-500',
    to: 'to-orange-400',
    route: (id: string) => `/summaries?doc=${id}`,
    requiresReady: true,
  },
] as const

const META_ITEMS = [
  { icon: Type,     label: 'File Type' },
  { icon: Hash,     label: 'File Size' },
  { icon: BookOpen, label: 'Pages' },
  { icon: Type,     label: 'Words' },
  { icon: Calendar, label: 'Uploaded' },
  { icon: Hash,     label: 'Chunks' },
  { icon: Tag,      label: 'Tags' },
] as const

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: doc, isLoading } = useDocument(id)
  const { data: chunks = [] } = useDocumentChunks(id)
  const { mutateAsync: deleteDoc } = useDeleteDocument()
  const { mutateAsync: reprocess, isPending: reprocessing } = useReprocessDocument()
  const [deleteOpen, setDeleteOpen] = useState(false)

  /* ── Loading skeleton ── */
  if (isLoading) {
    return (
      <div className="space-y-5 max-w-4xl">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-52" />
            <Skeleton className="h-3.5 w-36" />
          </div>
        </div>
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-52 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    )
  }

  /* ── Not found ── */
  if (!doc) {
    return (
      <div className="text-center py-20">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mx-auto mb-4">
          <FileText className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <p className="font-semibold text-lg">Document not found</p>
        <p className="text-sm text-muted-foreground mt-1">This document may have been deleted.</p>
        <Button className="mt-5" onClick={() => navigate('/documents')}>
          Back to Documents
        </Button>
      </div>
    )
  }

  const fileLabel = getFileTypeLabel(doc.file_type)
  const fileColor = getFileTypeColor(doc.file_type)

  const metaValues = [
    fileLabel,
    formatFileSize(doc.file_size),
    doc.page_count ?? 'N/A',
    doc.word_count?.toLocaleString() ?? 'N/A',
    formatDate(doc.created_at),
    chunks.length,
    doc.tags?.join(', ') || 'None',
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-4xl">

      {/* ── Header ── */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="mt-1 shrink-0"
          onClick={() => navigate('/documents')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-xs font-bold px-2 py-0.5 rounded-md bg-muted', fileColor)}>
              {fileLabel}
            </span>
            <Badge variant="outline" className={getStatusColor(doc.status)}>
              {doc.status}
            </Badge>
          </div>
          <h1 className="text-xl font-extrabold mt-2 leading-snug">{doc.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{doc.filename}</p>
        </div>
      </div>

      {/* ── Metadata grid ── */}
      <Card>
        <CardContent className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {META_ITEMS.map(({ icon: Icon, label }, i) => (
              <div key={label} className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0 mt-0.5">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                  <p className="font-semibold text-sm mt-0.5">{String(metaValues[i])}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Processing warning ── */}
      {doc.status !== 'ready' && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
          <Loader2 className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 animate-spin" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {doc.status === 'processing' || doc.status === 'pending'
              ? 'Document is still processing — AI actions will be available once ready.'
              : 'Document processing failed — try reprocessing below.'}
          </p>
        </div>
      )}

      {/* ── Action cards ── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">AI Actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ACTIONS.map(({ label, icon: Icon, from, to, route, requiresReady }) => (
            <button
              key={label}
              disabled={requiresReady && doc.status !== 'ready'}
              onClick={() => navigate(route(doc.id))}
              className={cn(
                'group relative flex flex-col items-center justify-center gap-2 rounded-2xl border border-transparent',
                'bg-gradient-to-br p-5 text-white transition-all duration-200',
                'hover:scale-[1.03] hover:shadow-lg active:scale-[0.98]',
                'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none',
                from, to,
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-semibold text-center leading-tight">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Secondary actions ── */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => reprocess(doc.id)} loading={reprocessing}>
          <RefreshCw className="mr-2 h-4 w-4" /> Reprocess
        </Button>
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="mr-2 h-4 w-4" /> Delete Document
        </Button>
      </div>

      {/* ── Document chunks ── */}
      {chunks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              Document Chunks
              <Badge variant="secondary" className="ml-auto text-xs">{chunks.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-96">
              <div className="space-y-2 pr-4">
                {chunks.map((chunk) => (
                  <div key={chunk.id} className="rounded-xl border bg-muted/30 p-3.5 group hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-muted-foreground bg-muted rounded-md px-2 py-0.5">
                        Chunk {chunk.chunk_index + 1}
                      </span>
                      {chunk.page_number && (
                        <span className="text-[11px] text-muted-foreground">Page {chunk.page_number}</span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed line-clamp-4">{chunk.content}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* ── Delete confirm ── */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Document"
        description="This will permanently delete the document and all associated data. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={async () => {
          await deleteDoc(doc.id)
          navigate('/documents')
        }}
      />
    </motion.div>
  )
}
