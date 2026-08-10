import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, FileText, ChevronDown, ChevronUp, Sparkles, Clock, X,
  Zap, BookOpen, Brain, MessageSquare, TrendingUp, Lightbulb, Target,
  ArrowRight, Hash,
} from 'lucide-react'
import { useSearch } from '@/hooks/useSearch'
import { DocumentSelector } from '@/components/shared/DocumentSelector'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const EXAMPLE_QUERIES = [
  { label: 'Explain backpropagation',    icon: Brain,         category: 'Concept'    },
  { label: 'What is gradient descent?',  icon: Zap,           category: 'Definition' },
  { label: 'Summarise Chapter 3',        icon: BookOpen,      category: 'Summary'    },
  { label: 'How do transformers work?',  icon: MessageSquare, category: 'Question'   },
  { label: 'Key formulas in calculus',   icon: Sparkles,      category: 'Formulas'   },
  { label: 'Difference between supervised and unsupervised learning', icon: Brain, category: 'Concept' },
]

const SEARCH_TIPS = [
  { tip: 'Ask full questions',  desc: '"How does attention work?" finds more than just "attention"' },
  { tip: 'Use concepts not keywords', desc: '"memory storage" finds text about RAM even if the word doesn\'t appear' },
  { tip: 'Narrow with filters', desc: 'Select a specific document to limit results to that source only' },
  { tip: 'Try rephrasing',      desc: 'If results are weak, reword your query — synonyms change embedding vectors' },
]

const MAX_HISTORY = 8

export function SearchPage() {
  const [query, setQuery]             = useState('')
  const [docIds, setDocIds]           = useState<string[]>([])
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [lastQuery, setLastQuery]     = useState('')
  const [history, setHistory]         = useState<string[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { mutate: search, data, isPending: loading, isSuccess: searched } = useSearch()

  const runSearch = (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) return
    setLastQuery(trimmed)
    setHistory((prev) => [trimmed, ...prev.filter((h) => h !== trimmed)].slice(0, MAX_HISTORY))
    setShowHistory(false)
    setExpandedId(null)
    search({ query: trimmed, document_ids: docIds.length ? docIds : undefined, limit: 10 })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') runSearch(query)
    if (e.key === 'Escape') setShowHistory(false)
  }

  const clearQuery = () => { setQuery(''); inputRef.current?.focus() }

  const results  = data?.results ?? []
  const topScore = results.length ? results[0].score : 0

  // Derive unique documents from results for the sidebar stats
  const uniqueDocs = [...new Set(results.map((r) => r.document_title))]

  const getRelevanceColor = (score: number) => {
    if (score >= 0.8) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
    if (score >= 0.6) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40'
    return 'text-muted-foreground bg-muted'
  }

  const getBarColor = (score: number) => {
    if (score >= 0.8) return 'from-emerald-500 to-teal-400'
    if (score >= 0.6) return 'from-amber-500 to-orange-400'
    return 'from-slate-400 to-slate-500'
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 shadow-sm">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-foreground">Semantic Search</h1>
          <p className="text-xs text-muted-foreground">AI-powered meaning search — find concepts, not just keywords</p>
        </div>
      </div>

      {/* Search card — full width */}
      <Card className="overflow-visible">
        <CardContent className="p-4 space-y-3">
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShowHistory(e.target.value.length === 0) }}
                onFocus={() => { if (!query) setShowHistory(true) }}
                onBlur={() => setTimeout(() => setShowHistory(false), 150)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about your study materials…"
                className="w-full rounded-xl border border-input bg-background pl-9 pr-9 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
              />
              {query && (
                <button onClick={clearQuery} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button onClick={() => runSearch(query)} loading={loading} disabled={!query.trim()}>
              <Search className="mr-2 h-4 w-4" /> Search
            </Button>

            {/* History dropdown */}
            <AnimatePresence>
              {showHistory && history.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
                  className="absolute top-full left-0 right-24 mt-1.5 z-50 rounded-xl border border-border bg-card shadow-lg overflow-hidden"
                >
                  <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent searches</span>
                    <button onClick={() => setHistory([])} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Clear all</button>
                  </div>
                  {history.map((h) => (
                    <button key={h} onMouseDown={() => { setQuery(h); runSearch(h) }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-muted/60 transition-colors">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate text-foreground">{h}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1.5">
              <FileText className="h-3 w-3" />
              Filter by document
              <span className="text-muted-foreground/60 font-normal">(leave empty to search all)</span>
            </label>
            <DocumentSelector value={docIds} onChange={setDocIds} />
          </div>
        </CardContent>
      </Card>

      {/* ── Two-column body ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 items-start">

        {/* LEFT — results / empty state */}
        <div className="space-y-3 min-w-0">

          {/* Loading */}
          {loading && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 w-40" />
              </div>
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="flex gap-2">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-5 w-16 rounded-full ml-auto" />
                        </div>
                        <Skeleton className="h-1.5 w-32 rounded-full" />
                        <Skeleton className="h-3.5 w-full" />
                        <Skeleton className="h-3.5 w-4/5" />
                        <Skeleton className="h-3.5 w-2/3" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Results */}
          {!loading && searched && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn('flex h-2 w-2 rounded-full', results.length > 0 ? 'bg-emerald-500' : 'bg-muted-foreground')} />
                  <p className="text-sm text-muted-foreground">
                    {results.length === 0
                      ? 'No results — try rephrasing your query'
                      : <><span className="font-semibold text-foreground">{results.length}</span> result{results.length > 1 ? 's' : ''} for <span className="font-semibold text-foreground">"{lastQuery}"</span></>
                    }
                  </p>
                </div>
                {results.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Best: <span className={cn('font-semibold', topScore >= 0.8 ? 'text-emerald-600 dark:text-emerald-400' : topScore >= 0.6 ? 'text-amber-600 dark:text-amber-400' : '')}>{Math.round(topScore * 100)}%</span>
                  </span>
                )}
              </div>

              <AnimatePresence>
                {results.map((r, i) => {
                  const isExpanded = expandedId === r.chunk_id
                  const scorePct   = Math.round(r.score * 100)
                  return (
                    <motion.div key={r.chunk_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                      <Card
                        className="cursor-pointer hover:shadow-md transition-all hover:-translate-y-px group"
                        onClick={() => setExpandedId(isExpanded ? null : r.chunk_id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex flex-col items-center gap-1 shrink-0">
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500">
                                <FileText className="h-4 w-4 text-white" />
                              </div>
                              <span className="text-[10px] font-bold text-muted-foreground/50">#{i + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <p className="font-semibold text-sm truncate">{r.document_title}</p>
                                <div className="flex items-center gap-2 shrink-0">
                                  {r.page_number && (
                                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">p.{r.page_number}</span>
                                  )}
                                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', getRelevanceColor(r.score))}>{scorePct}%</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 mb-2.5">
                                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-36">
                                  <motion.div
                                    className={cn('h-full rounded-full bg-gradient-to-r', getBarColor(r.score))}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${scorePct}%` }}
                                    transition={{ delay: i * 0.04 + 0.1, duration: 0.5, ease: 'easeOut' }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground">semantic relevance</span>
                              </div>
                              <p className={cn('text-sm text-muted-foreground leading-relaxed', !isExpanded && 'line-clamp-3')}>{r.content}</p>
                              {r.content.length > 200 && (
                                <button className="flex items-center gap-1 text-xs text-primary mt-1.5 hover:underline">
                                  {isExpanded ? <><ChevronUp className="h-3 w-3" />Show less</> : <><ChevronDown className="h-3 w-3" />Read full passage</>}
                                </button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </AnimatePresence>

              {results.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="p-6 text-center space-y-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted mx-auto">
                      <Search className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">No matches found</p>
                      <p className="text-xs text-muted-foreground mt-1">Try different words, a shorter phrase, or remove document filters.</p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {['Be more specific', 'Use keywords', 'Remove filters'].map((tip) => (
                        <span key={tip} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{tip}</span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Empty initial state */}
          {!loading && !searched && (
            <div className="space-y-5">
              <div className="flex flex-col items-center justify-center pt-4 pb-2 gap-4 text-center">
                <SearchHeroIllustration />
                <div>
                  <p className="font-bold text-foreground text-lg">AI-powered semantic search</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    Unlike keyword search, this understands <em>meaning</em>. Ask in plain English and it finds the most relevant passages from your documents.
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Try one of these</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {EXAMPLE_QUERIES.map(({ label, icon: Icon, category }) => (
                    <button
                      key={label}
                      onClick={() => { setQuery(label); runSearch(label) }}
                      className="flex items-center gap-3 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/50 px-4 py-3 text-left transition-all group"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500/20 to-cyan-500/20 group-hover:from-teal-500 group-hover:to-cyan-500 transition-all">
                        <Icon className="h-4 w-4 text-teal-600 dark:text-teal-400 group-hover:text-white transition-colors" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{label}</p>
                        <p className="text-xs text-muted-foreground">{category}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — persistent sidebar */}
        <div className="space-y-4 lg:sticky lg:top-4">

          {/* Search Stats — only when results exist */}
          {searched && results.length > 0 && (
            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" /> Search Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-muted/60 p-3 text-center">
                      <p className="text-xl font-extrabold tabular-nums">{results.length}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">passages</p>
                    </div>
                    <div className="rounded-xl bg-muted/60 p-3 text-center">
                      <p className="text-xl font-extrabold tabular-nums">{uniqueDocs.length}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">documents</p>
                    </div>
                  </div>
                  {/* Score distribution */}
                  <div className="space-y-1.5">
                    {[
                      { label: 'High (≥80%)',  count: results.filter((r) => r.score >= 0.8).length, color: 'bg-emerald-500' },
                      { label: 'Good (60–79%)', count: results.filter((r) => r.score >= 0.6 && r.score < 0.8).length, color: 'bg-amber-400' },
                      { label: 'Weak (<60%)',  count: results.filter((r) => r.score < 0.6).length, color: 'bg-slate-400' },
                    ].map(({ label, count, color }) => (
                      <div key={label} className="flex items-center gap-2 text-xs">
                        <span className={cn('h-2 w-2 rounded-full shrink-0', color)} />
                        <span className="text-muted-foreground flex-1">{label}</span>
                        <span className="font-semibold tabular-nums text-foreground">{count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Sources — which docs appear in results */}
          {searched && uniqueDocs.length > 0 && (
            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" /> Sources
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-1.5">
                  {uniqueDocs.map((doc) => {
                    const count = results.filter((r) => r.document_title === doc).length
                    const best  = Math.max(...results.filter((r) => r.document_title === doc).map((r) => r.score))
                    return (
                      <div key={doc} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-teal-500 to-cyan-500">
                          <FileText className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-xs text-foreground truncate flex-1">{doc}</span>
                        <div className="flex flex-col items-end shrink-0 gap-0.5">
                          <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{count} hit{count !== 1 ? 's' : ''}</span>
                          <span className={cn('text-[10px] font-bold', best >= 0.8 ? 'text-emerald-500' : best >= 0.6 ? 'text-amber-500' : 'text-muted-foreground')}>{Math.round(best * 100)}%</span>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Recent Searches */}
          {history.length > 0 && (
            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: 0.08 }}>
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Recent</span>
                    <button onClick={() => setHistory([])} className="text-[10px] text-muted-foreground hover:text-foreground normal-case tracking-normal transition-colors">Clear</button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-0.5">
                  {history.slice(0, 5).map((h) => (
                    <button
                      key={h}
                      onClick={() => { setQuery(h); runSearch(h) }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted/60 transition-colors group"
                    >
                      <Hash className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                      <span className="text-xs text-foreground truncate flex-1">{h}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors shrink-0" />
                    </button>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Search Tips — always visible */}
          <Card className="bg-gradient-to-br from-teal-500/5 to-cyan-500/5 border-teal-500/20">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-widest text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5" /> Search Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {SEARCH_TIPS.map(({ tip, desc }) => (
                <div key={tip}>
                  <p className="text-xs font-semibold text-foreground">{tip}</p>
                  <p className="text-xs text-muted-foreground leading-snug mt-0.5">{desc}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* How it works */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" /> How it works
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {[
                { n: '1', title: 'Type anything', desc: 'Ask a question in plain English' },
                { n: '2', title: 'AI matches meaning', desc: 'Embeddings find semantically similar content' },
                { n: '3', title: 'Ranked results', desc: 'Passages scored by relevance — best first' },
              ].map(({ n, title, desc }) => (
                <div key={n} className="flex gap-2.5">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 text-white text-[10px] font-bold mt-0.5">
                    {n}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground leading-snug">{desc}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

        </div>
      </div>
    </motion.div>
  )
}

function SearchHeroIllustration() {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 200, height: 200 }}>
      <svg className="absolute inset-0" width="200" height="200">
        <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="1"
          className="text-teal-500/10 dark:text-teal-400/10" strokeDasharray="6 5" />
        <circle r="5" fill="#14b8a6" opacity="0.8">
          <animateMotion dur="6s" repeatCount="indefinite">
            <mpath xlinkHref="#orbitPath" />
          </animateMotion>
        </circle>
        <path id="orbitPath" d="M 100,10 A 90,90 0 1,1 99.99,10" fill="none" />
      </svg>
      <svg className="absolute inset-0" width="200" height="200">
        <circle cx="100" cy="100" r="64" fill="none" stroke="currentColor" strokeWidth="1"
          className="text-violet-500/15 dark:text-violet-400/15" strokeDasharray="4 6" />
        <circle r="4" fill="#8b5cf6" opacity="0.7">
          <animateMotion dur="9s" repeatCount="indefinite">
            <mpath xlinkHref="#orbitPath2" />
          </animateMotion>
        </circle>
        <path id="orbitPath2" d="M 100,36 A 64,64 0 1,0 99.99,36" fill="none" />
      </svg>
      <div className="absolute" style={{ top: 22, right: 20 }}>
        <div className="flex items-center gap-1 rounded-full bg-card border border-border shadow-sm px-2 py-0.5 text-[10px] font-medium text-muted-foreground whitespace-nowrap">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />92% match
        </div>
      </div>
      <div className="absolute" style={{ bottom: 30, left: 8 }}>
        <div className="flex items-center gap-1 rounded-full bg-card border border-border shadow-sm px-2 py-0.5 text-[10px] font-medium text-muted-foreground whitespace-nowrap">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />74% match
        </div>
      </div>
      <div className="absolute" style={{ top: '50%', right: 0, transform: 'translateY(-50%)' }}>
        <div className="flex items-center gap-1 rounded-full bg-card border border-border shadow-sm px-2 py-0.5 text-[10px] font-medium text-muted-foreground whitespace-nowrap">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-400 shrink-0" />p. 14
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-24 w-24 rounded-full bg-gradient-to-br from-teal-500/20 to-violet-500/20 blur-2xl" />
      </div>
      <div className="relative flex flex-col items-center justify-center h-20 w-20 rounded-2xl shadow-xl"
        style={{ background: 'linear-gradient(135deg, #0d9488, #8b5cf6)' }}>
        <svg className="absolute inset-0 w-full h-full rounded-2xl opacity-10" viewBox="0 0 80 80">
          <line x1="0" y1="26" x2="80" y2="26" stroke="white" strokeWidth="1" />
          <line x1="0" y1="54" x2="80" y2="54" stroke="white" strokeWidth="1" />
          <line x1="26" y1="0" x2="26" y2="80" stroke="white" strokeWidth="1" />
          <line x1="54" y1="0" x2="54" y2="80" stroke="white" strokeWidth="1" />
        </svg>
        <div className="relative">
          <Search className="h-8 w-8 text-white drop-shadow-sm" />
          <div className="absolute -top-1.5 -right-1.5 h-3 w-3 rounded-full bg-amber-400 border-2 border-white/80 flex items-center justify-center">
            <span className="text-[6px] font-black text-white leading-none">AI</span>
          </div>
        </div>
      </div>
    </div>
  )
}
