import { useMutation } from '@tanstack/react-query'
import { searchApi } from '@/lib/api'
import { toast } from 'sonner'
import type { SearchResult } from '@/types'

export function useSearch() {
  return useMutation<
    { results: SearchResult[] },
    Error,
    { query: string; document_ids?: string[]; limit?: number }
  >({
    mutationFn: searchApi.search,
    onError: () => toast.error('Search failed'),
  })
}
