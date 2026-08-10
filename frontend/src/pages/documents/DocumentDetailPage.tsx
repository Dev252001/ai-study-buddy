import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, MessageSquare, Brain, CreditCard, Wand2, RefreshCw, Trash2, FileText, Hash, Type, BookOpen, Calendar, Tag, Loader2 } from 'lucide-react'
import { useDocument, useDocumentChunks, useDeleteDocument, useReprocessDocument } from '@/hooks/useDocuments'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { formatDate, formatFileSize, getStatusColor, getFileTypeLabel, getFileTypeColor } from '@/lib/utils'
import { useState } from 'react'

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: doc, isLoading } = useDocument(id)
  const { data: chunks = [] } = useDocumentChunks(id)
  const { mutateAsync: deleteDoc } = useDeleteDocument()
  const { mutateAsync: reprocess, isPending: reprocessing } = useReprocessDocument()
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3.5 w-32" />
          </div>
        </div>
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="text-center py-16">
        <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
        <p className="font-medium">Document not found</p>
        <p className="text-sm text-muted-foreground mt-1">This document may have been deleted</p>
        <Button className="mt-4" onClick={() => navigate('/documents')}>
          Back to Documents
        </Button>
      </div>
    )
  }

  const fileColor = getFileTypeColor(doc.file_type)
  const fileLabel = getFileTypeLabel(doc.file_type)

  const metaItems = [
    { icon: Type, label: 'File Type', value: fileLabel },
    { icon: Hash, label: 'File Size', value: formatFileSize(doc.file_size) },
    { icon: BookOpen, label: 'Pages', value: doc.page_count ?? 'N/A' },
    { icon: Type, label: 'Words', value: doc.word_count?.toLocaleString() ?? 'N/A' },
    { icon: Calendar, label: 'Uploaded', value: formatDate(doc.created_at) },
    { icon: Hash, label: 'Chunks', value: chunks.length },
    { icon: Tag, label: 'Tags', value: doc.tags?.join(', ') || 'None' },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Page header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/documents')} className="mt-0.5 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded bg-muted ${fileColor}`}>{fileLabel}</span>
            <Badge variant="outline" className={getStatusColor(doc.status)}>
              {doc.status}
            </Badge>
          </div>
          <h2 className="text-xl font-bold mt-1.5 leading-snug">{doc.title}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{doc.filename}</p>
        </div>
      </div>

      {/* Metadata card */}
      <Card>
        <CardContent className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {metaItems.map((item) => (
              <div key={item.label}>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{item.label}</p>
                <p className="font-semibold text-sm mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Actions</p>
        {doc.status !== 'ready' && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 mb-3">
            <Loader2 className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 animate-spin" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {doc.status === 'processing' || doc.status === 'pending'
                ? 'Document is still processing — AI actions will be available once ready.'
                : 'Document processing failed — try reprocessing below.'}
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={doc.status !== 'ready'}
            onClick={() => navigate(`/chat?doc=${doc.id}`)}
          >
            <MessageSquare className="mr-2 h-4 w-4" /> Chat About This
          </Button>
          <Button
            variant="outline"
            disabled={doc.status !== 'ready'}
            onClick={() => navigate(`/quiz/generate?doc=${doc.id}`)}
          >
            <Brain className="mr-2 h-4 w-4" /> Generate Quiz
          </Button>
          <Button
            variant="outline"
            disabled={doc.status !== 'ready'}
            onClick={() => navigate(`/flashcards?doc=${doc.id}`)}
          >
            <CreditCard className="mr-2 h-4 w-4" /> Create Flashcards
          </Button>
          <Button
            variant="outline"
            disabled={doc.status !== 'ready'}
            onClick={() => navigate(`/summaries?doc=${doc.id}`)}
          >
            <Wand2 className="mr-2 h-4 w-4" /> Summarize
          </Button>
          <Button
            variant="outline"
            onClick={() => reprocess(doc.id)}
            loading={reprocessing}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Reprocess
          </Button>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      {/* Document chunks */}
      {chunks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span>Document Chunks</span>
              <Badge variant="secondary" className="text-xs">{chunks.length} chunks</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-96">
              <div className="space-y-2 pr-4">
                {chunks.map((chunk) => (
                  <div key={chunk.id} className="rounded-lg border bg-muted/30 p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                        Chunk {chunk.chunk_index + 1}
                      </span>
                      {chunk.page_number && (
                        <span className="text-xs text-muted-foreground">Page {chunk.page_number}</span>
                      )}
                    </div>
                    <p className="text-sm text-foreground leading-relaxed line-clamp-4">
                      {chunk.content}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Document"
        description="This will permanently delete the document and all associated data."
        confirmLabel="Delete"
        onConfirm={async () => {
          await deleteDoc(doc.id)
          navigate('/documents')
        }}
      />
    </motion.div>
  )
}
