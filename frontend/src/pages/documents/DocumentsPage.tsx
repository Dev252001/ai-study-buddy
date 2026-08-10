import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FileText, MoreVertical, RefreshCw, Trash2, Eye, MessageSquare, Brain, Wand2, CreditCard, Search, X } from 'lucide-react'
import { useDocuments, useDeleteDocument, useUploadDocuments, useReprocessDocument } from '@/hooks/useDocuments'
import { PageHeader } from '@/components/shared/PageHeader'
import { FileUploadZone } from '@/components/shared/FileUploadZone'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatFileSize, formatDateRelative, getStatusColor, getFileTypeLabel, getFileTypeColor } from '@/lib/utils'

function FileTypeIcon({ fileType }: { fileType: string }) {
  const color = getFileTypeColor(fileType)
  const label = getFileTypeLabel(fileType)
  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold ${color}`}>
      {label.slice(0, 3)}
    </div>
  )
}

type StatusFilter = 'all' | 'ready' | 'processing' | 'pending' | 'failed'

export function DocumentsPage() {
  const { data: documents = [], isLoading } = useDocuments()
  const { mutateAsync: uploadDocs } = useUploadDocuments()
  const { mutateAsync: deleteDoc } = useDeleteDocument()
  const { mutateAsync: reprocessDoc } = useReprocessDocument()
  const navigate = useNavigate()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const displayDocs = useMemo(() => {
    let result = [...documents]
    if (statusFilter !== 'all') result = result.filter((d) => d.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (d) => d.title.toLowerCase().includes(q) || d.filename.toLowerCase().includes(q),
      )
    }
    return result
  }, [documents, search, statusFilter])

  const handleUpload = async (files: File[]) => {
    await uploadDocs(files)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <PageHeader
        title="Documents"
        subtitle="Upload and manage your study materials"
      />

      <FileUploadZone onUpload={handleUpload} />

      {/* Search & filter */}
      {!isLoading && documents.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents..."
              className="pl-8 h-9 text-sm"
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
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="h-9 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          {(search || statusFilter !== 'all') && (
            <span className="text-xs text-muted-foreground self-center">
              {displayDocs.length} of {documents.length}
            </span>
          )}
        </div>
      )}

      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
          ))
        ) : documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents yet"
            description="Upload PDF, DOCX, PPTX, TXT or Markdown files to get started with AI-powered studying"
          />
        ) : displayDocs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No documents match your search.</p>
        ) : (
          displayDocs.map((doc, i) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center justify-between rounded-xl border bg-card px-4 py-3.5 hover:shadow-sm transition-all group"
            >
              <button
                className="flex items-center gap-4 min-w-0 flex-1 text-left"
                onClick={() => navigate(`/documents/${doc.id}`)}
              >
                <FileTypeIcon fileType={doc.file_type} />
                <div className="min-w-0">
                  <p className="font-medium truncate text-sm leading-tight">{doc.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      {getFileTypeLabel(doc.file_type)}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)}</span>
                    {doc.page_count && (
                      <>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{doc.page_count} pages</span>
                      </>
                    )}
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{formatDateRelative(doc.created_at)}</span>
                  </div>
                </div>
              </button>

              <div className="flex items-center gap-2 shrink-0 ml-3">
                <Badge variant="outline" className={`text-xs hidden sm:inline-flex ${getStatusColor(doc.status)}`}>
                  {doc.status}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      aria-label="Document actions"
                    >
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
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Document"
        description="This will permanently delete the document and all associated data including chat history and quizzes."
        confirmLabel="Delete Document"
        onConfirm={async () => {
          if (deleteId) await deleteDoc(deleteId)
        }}
      />
    </motion.div>
  )
}
