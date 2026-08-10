import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, FileText } from 'lucide-react'
import { useSearch } from '@/hooks/useSearch'
import { PageHeader } from '@/components/shared/PageHeader'
import { DocumentSelector } from '@/components/shared/DocumentSelector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'

export function SearchPage() {
  const [query, setQuery] = useState('')
  const [docIds, setDocIds] = useState<string[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { mutate: search, data, isPending: loading, isSuccess: searched } = useSearch()

  const handleSearch = () => {
    if (!query.trim()) return
    search({
      query,
      document_ids: docIds.length ? docIds : undefined,
      limit: 10,
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const results = data?.results ?? []

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title="Semantic Search"
        subtitle="Search across all your study materials using AI"
      />

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search your study materials... (e.g., 'explain backpropagation')"
              className="flex-1"
            />
            <Button onClick={handleSearch} loading={loading} disabled={!query.trim()}>
              <Search className="mr-2 h-4 w-4" /> Search
            </Button>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5 text-muted-foreground">
              Filter by documents (optional — leave empty to search all)
            </label>
            <DocumentSelector value={docIds} onChange={setDocIds} />
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-2.5 w-24" />
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3.5 w-3/4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && searched && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {results.length === 0
              ? 'No results found. Try a different query.'
              : `${results.length} result${results.length > 1 ? 's' : ''} found`}
          </p>

          {results.map((r, i) => (
            <motion.div
              key={r.chunk_id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card
                className="cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => setExpandedId(expandedId === r.chunk_id ? null : r.chunk_id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm truncate">{r.document_title}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          {r.page_number && (
                            <Badge variant="outline" className="text-xs">
                              Page {r.page_number}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">Relevance</span>
                        <Progress value={r.score * 100} className="h-1.5 flex-1 max-w-24" />
                        <span className="text-xs font-medium">{(r.score * 100).toFixed(0)}%</span>
                      </div>

                      <p className={`text-sm text-muted-foreground mt-2 ${expandedId === r.chunk_id ? '' : 'line-clamp-3'}`}>
                        {r.content}
                      </p>

                      {expandedId !== r.chunk_id && r.content.length > 200 && (
                        <p className="text-xs text-primary mt-1">Click to expand</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
