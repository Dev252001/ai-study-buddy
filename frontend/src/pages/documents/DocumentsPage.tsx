import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, MoreVertical, RefreshCw, Trash2, Eye,
  MessageSquare, Brain, Wand2, CreditCard, Search, X,
  LayoutGrid, List, Upload, BookOpen,
} from 'lucide-react'
import { useDocuments, useDeleteDocument, useUploadDocuments, useReprocessDocument } from '@/hooks/useDocuments'
import { FileUploadZone } from '@/components/shared/FileUploadZone'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatFileSize, formatDateRelative, getFileTypeLabel } from '@/lib/utils'
import { cn } from '@/lib/utils'

// ── File type icon ────────────────────────────────────────────────────────────
const FILE_TYPE_GRADIENTS: Record<string, string> = {
  pdf:  'from-rose-500 to-red-600',
  docx: 'from-blue-500 to-blue-700',
  pptx: 'from-amber-500 to-orange-600',
  txt:  'from-slate-400 to-slate-600',
  md:   'from-violet-500 to-purple-700',
}

function FileTypeIcon({ fileType }: { fileType: string }) {
  const gradient = FILE_TYPE_GRADIENTS[fileType.toLowerCase()] ?? 'from-muted-foreground to-muted-foreground/60'
  const label = getFileTypeLabel(fileType)
  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-sm`}>
      <span className="text-[10px] font-extrabold text-white tracking-wide">{label.slice(0, 3)}</span>
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  ready:      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-400 dark:border-emerald-800',
  processing: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/25 dark:text-blue-400 dark:border-blue-800',
  pending:    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/25 dark:text-amber-400 dark:border-amber-800',
  failed:     'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/25 dark:text-rose-400 dark:border-rose-800',
}

type StatusFilter = 'all' | 'ready' | 'processing' | 'pending' | 'failed'
type ViewMode = 'list' | 'grid'

export function DocumentsPage() {
  const { data: documents = [], isLoading } = useDocuments()
  const { mutateAsync: uploadDocs } = useUploadDocuments()
  const { mutateAsync: deleteDoc } = useDeleteDocument()
  const { mutateAsync: reprocessDoc } = useReprocessDocument()
  const navigate = useNavigate()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  const displayDocs = useMemo(() => {
    let result = [...documents]
    if (statusFilter !== 'all') result = result.filter(d => d.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(d => d.title.toLowerCase().includes(q) || d.filename.toLowerCase().includes(q))
    }
    return result
  }, [documents, search, statusFilter])

  const totalSize = documents.reduce((acc, d) => acc + (d.file_size || 0), 0)
  const readyCount = documents.filter(d => d.status === 'ready').length

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 shrink-0">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Documents</h2>
            <p className="text-sm text-muted-foreground">Upload and manage your study materials</p>
          </div>
        </div>
        {/* Stats pills */}
        {!isLoading && documents.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground">
              <BookOpen className="h-3 w-3 text-teal-500" />
              {documents.length} document{documents.length !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground">
              <Upload className="h-3 w-3 text-violet-500" />
              {formatFileSize(totalSize)}
            </span>
            <span className="flex items-center gap-1.5 rounded-full border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 border px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              ✓ {readyCount} ready
            </span>
          </div>
        )}
      </div>

      {/* ── Upload Zone ── */}
      <FileUploadZone onUpload={async (files) => { await uploadDocs(files) }} />

      {/* ── Search, filter, view toggle ── */}
      {!isLoading && documents.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or filename…"
              className="pl-8 h-9 text-sm rounded-xl"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="h-9 w-36 text-xs rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="ready">✓ Ready</SelectItem>
              <SelectItem value="processing">⟳ Processing</SelectItem>
              <SelectItem value="pending">◷ Pending</SelectItem>
              <SelectItem value="failed">✕ Failed</SelectItem>
            </SelectContent>
          </Select>
          {/* View toggle */}
          <div className="flex items-center bg-muted rounded-xl p-1 gap-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={cn('flex h-7 w-7 items-center justify-center rounded-lg transition-all',
                viewMode === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              aria-label="List view"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn('flex h-7 w-7 items-center justify-center rounded-lg transition-all',
                viewMode === 'grid' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>
          {(search || statusFilter !== 'all') && (
            <span className="text-xs text-muted-foreground font-medium">
              {displayDocs.length} of {documents.length} shown
            </span>
          )}
        </div>
      )}

      {/* ── Document list / grid ── */}
      {isLoading ? (
        <div className={cn(viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3' : 'space-y-2')}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className={cn('w-full rounded-2xl', viewMode === 'grid' ? 'h-36' : 'h-[72px]')} />
          ))}
        </div>
      ) : documents.length === 0 ? (
        /* Empty state — no documents at all */
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/60 py-16 gap-4">
          <div className="h-16 w-16 flex items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400/20 to-cyan-500/20 border border-teal-500/20">
            <FileText className="h-8 w-8 text-teal-500 dark:text-teal-400" />
          </div>
          <div className="text-center">
            <p className="font-bold text-foreground text-lg">No documents yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs leading-relaxed">
              Upload PDF, DOCX, PPTX, TXT or Markdown files above to start studying with AI.
            </p>
          </div>
        </div>
      ) : displayDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Search className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground font-medium">No documents match your search.</p>
          <button onClick={() => { setSearch(''); setStatusFilter('all') }}
            className="text-xs text-primary hover:underline font-semibold">Clear filters</button>
        </div>
      ) : viewMode === 'list' ? (
        /* ── List view ── */
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {displayDocs.map((doc, i) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card px-4 py-3.5 hover:border-border hover:shadow-sm transition-all group"
              >
                {/* File type icon */}
                <button className="shrink-0" onClick={() => navigate(`/documents/${doc.id}`)}>
                  <FileTypeIcon fileType={doc.file_type} />
                </button>

                {/* Title + meta */}
                <button
                  className="flex-1 min-w-0 text-left"
                  onClick={() => navigate(`/documents/${doc.id}`)}
                >
                  <p className="font-semibold text-sm truncate leading-tight group-hover:text-primary transition-colors">
                    {doc.title.replace(/_/g, ' ')}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className={`text-[10px] font-bold border rounded-md px-1.5 py-0.5 ${
                      doc.file_type === 'pdf'  ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800' :
                      doc.file_type === 'docx' ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' :
                      doc.file_type === 'pptx' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' :
                      'bg-muted text-muted-foreground border-border'
                    }`}>
                      {getFileTypeLabel(doc.file_type)}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)}</span>
                    {doc.page_count && (
                      <><span className="text-xs text-muted-foreground/40">·</span>
                      <span className="text-xs text-muted-foreground">{doc.page_count} pages</span></>
                    )}
                    {doc.word_count && (
                      <><span className="text-xs text-muted-foreground/40">·</span>
                      <span className="text-xs text-muted-foreground">{doc.word_count.toLocaleString()} words</span></>
                    )}
                    <span className="text-xs text-muted-foreground/40">·</span>
                    <span className="text-xs text-muted-foreground">{formatDateRelative(doc.created_at)}</span>
                  </div>
                </button>

                {/* Inline quick actions — visible on hover */}
                <div className="hidden lg:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-150 shrink-0">
                  <button
                    onClick={() => navigate(`/chat?doc=${doc.id}`)}
                    title="Chat about this"
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-900/25 text-violet-600 dark:text-violet-400 hover:bg-violet-100 transition-colors"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => navigate(`/quiz/generate?doc=${doc.id}`)}
                    title="Generate quiz"
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-900/25 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors"
                  >
                    <Brain className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => navigate(`/summaries?doc=${doc.id}`)}
                    title="Summarize"
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-900/25 text-teal-600 dark:text-teal-400 hover:bg-teal-100 transition-colors"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Status + menu */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`hidden sm:inline-flex text-xs font-semibold border rounded-full px-2.5 py-0.5 capitalize ${
                    STATUS_STYLES[doc.status] ?? 'bg-muted text-muted-foreground border-border'
                  }`}>
                    {doc.status}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
                        aria-label="Document actions">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => navigate(`/documents/${doc.id}`)}>
                        <Eye className="mr-2 h-4 w-4" /> View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/chat?doc=${doc.id}`)}>
                        <MessageSquare className="mr-2 h-4 w-4" /> Chat About This
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/quiz/generate?doc=${doc.id}`)}>
                        <Brain className="mr-2 h-4 w-4" /> Generate Quiz
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/summaries?doc=${doc.id}`)}>
                        <Wand2 className="mr-2 h-4 w-4" /> Summarize
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/flashcards?doc=${doc.id}`)}>
                        <CreditCard className="mr-2 h-4 w-4" /> Create Flashcards
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => reprocessDoc(doc.id)}>
                        <RefreshCw className="mr-2 h-4 w-4" /> Reprocess
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteId(doc.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        /* ── Grid view ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence initial={false}>
            {displayDocs.map((doc, i) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.03 }}
                className="group flex flex-col rounded-2xl border border-border/60 bg-card p-4 hover:border-border hover:shadow-md transition-all cursor-pointer hover:-translate-y-0.5"
                onClick={() => navigate(`/documents/${doc.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <FileTypeIcon fileType={doc.file_type} />
                  <span className={`text-xs font-semibold border rounded-full px-2.5 py-0.5 capitalize ${
                    STATUS_STYLES[doc.status] ?? 'bg-muted text-muted-foreground border-border'
                  }`}>
                    {doc.status}
                  </span>
                </div>
                <p className="font-semibold text-sm leading-snug line-clamp-2 flex-1 group-hover:text-primary transition-colors">
                  {doc.title.replace(/_/g, ' ')}
                </p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatFileSize(doc.file_size)}</span>
                    {doc.page_count && <><span>·</span><span>{doc.page_count}p</span></>}
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDateRelative(doc.created_at)}</span>
                </div>
                {/* Quick actions on hover */}
                <div className="flex items-center gap-1.5 mt-2.5 opacity-0 group-hover:opacity-100 transition-all">
                  {[
                    { icon: MessageSquare, to: `/chat?doc=${doc.id}`, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/25', label: 'Chat' },
                    { icon: Brain, to: `/quiz/generate?doc=${doc.id}`, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/25', label: 'Quiz' },
                    { icon: Wand2, to: `/summaries?doc=${doc.id}`, color: 'text-teal-500', bg: 'bg-teal-50 dark:bg-teal-900/25', label: 'AI' },
                  ].map(action => (
                    <button
                      key={action.to}
                      onClick={e => { e.stopPropagation(); navigate(action.to) }}
                      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold transition-colors ${action.bg} ${action.color}`}
                    >
                      <action.icon className="h-3 w-3" />
                      {action.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={open => !open && setDeleteId(null)}
        title="Delete Document"
        description="This will permanently delete the document and all associated data including chat history and quizzes."
        confirmLabel="Delete Document"
        onConfirm={async () => { if (deleteId) await deleteDoc(deleteId) }}
      />
    </motion.div>
  )
}
