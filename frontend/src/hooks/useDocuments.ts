import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useEffect } from 'react'
import { documentsApi, getErrorMessage } from '@/lib/api'
import { toast } from 'sonner'
import type { Document } from '@/types'

export const DOCUMENTS_KEY = 'documents'

export function useDocuments(skip = 0, limit = 50) {
  const prevStatusMap = useRef<Record<string, string>>({})

  const query = useQuery({
    queryKey: [DOCUMENTS_KEY, skip, limit],
    queryFn: () => documentsApi.list(skip, limit),
    // Poll every 5s when any document is still pending or processing
    refetchInterval: (q) => {
      const docs = q.state.data as Document[] | undefined
      if (!docs) return false
      const hasActive = docs.some((d) => d.status === 'pending' || d.status === 'processing')
      return hasActive ? 5000 : false
    },
  })

  // Notify when a document transitions from processing/pending → ready/failed
  useEffect(() => {
    const docs = query.data
    if (!docs) return
    const prev = prevStatusMap.current
    for (const doc of docs) {
      const prevStatus = prev[doc.id]
      if (
        prevStatus &&
        (prevStatus === 'pending' || prevStatus === 'processing') &&
        prevStatus !== doc.status
      ) {
        if (doc.status === 'ready') {
          toast.success(`"${doc.title}" is ready`)
        } else if (doc.status === 'failed') {
          toast.error(`"${doc.title}" failed to process`)
        }
      }
    }
    prevStatusMap.current = Object.fromEntries(docs.map((d) => [d.id, d.status]))
  }, [query.data])

  return query
}

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: [DOCUMENTS_KEY, id],
    queryFn: () => documentsApi.get(id!),
    enabled: !!id,
  })
}

export function useDocumentChunks(id: string | undefined) {
  return useQuery({
    queryKey: [DOCUMENTS_KEY, id, 'chunks'],
    queryFn: () => documentsApi.getChunks(id!),
    enabled: !!id,
  })
}

export function useUploadDocuments() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (files: File[]) => documentsApi.upload(files),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [DOCUMENTS_KEY] })
      toast.success('Documents uploaded and processing started!')
    },
    onError: (err: Error) => toast.error(getErrorMessage(err, 'Upload failed')),
  })
}

export function useDeleteDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [DOCUMENTS_KEY] })
      toast.success('Document deleted')
    },
    onError: (err: Error) => toast.error(getErrorMessage(err, 'Delete failed')),
  })
}

export function useReprocessDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => documentsApi.reprocess(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [DOCUMENTS_KEY] })
      toast.success('Reprocessing started')
    },
    onError: (err: Error) => toast.error(getErrorMessage(err, 'Reprocess failed')),
  })
}
