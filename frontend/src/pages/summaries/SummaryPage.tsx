import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Wand2, Loader2, Download, BookOpen, Lightbulb, Map, Calendar, Calculator, BookMarked, Copy, Check } from 'lucide-react'
import { summariesApi, exportApi, getErrorMessage } from '@/lib/api'
import { DocumentSelector } from '@/components/shared/DocumentSelector'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { SummaryResponse, ConceptExplainResponse } from '@/types'

// ── Mind Map types & renderer ─────────────────────────────────────────────────
interface MindMapNode {
  topic: string
  children?: MindMapNode[]
}

const BRANCH_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
  '#f97316', '#6366f1',
]

function MindMapBranch({
  node,
  depth,
  color,
  isLast,
}: {
  node: MindMapNode
  depth: number
  color: string
  isLast: boolean
}) {
  const [collapsed, setCollapsed] = useState(false)
  const hasChildren = node.children && node.children.length > 0

  return (
    <div className="flex items-start">
      {/* Connector lines */}
      <div className="flex flex-col items-center mr-0" style={{ minWidth: depth > 0 ? 20 : 0 }}>
        {depth > 0 && (
          <>
            <div className="w-5 border-t-2" style={{ borderColor: color, marginTop: 14 }} />
          </>
        )}
      </div>

      <div>
        {/* Node pill */}
        <button
          onClick={() => hasChildren && setCollapsed((c) => !c)}
          className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium leading-snug transition-all hover:shadow-sm select-none mb-1"
          style={{
            borderColor: color,
            backgroundColor: depth === 0 ? color : `${color}18`,
            color: depth === 0 ? '#fff' : 'inherit',
            cursor: hasChildren ? 'pointer' : 'default',
            fontWeight: depth === 0 ? 700 : depth === 1 ? 600 : 400,
            fontSize: depth === 0 ? 15 : depth === 1 ? 13 : 12,
          }}
        >
          {hasChildren && (
            <span style={{ color: depth === 0 ? '#fff' : color, fontWeight: 700, fontSize: 10 }}>
              {collapsed ? '▶' : '▼'}
            </span>
          )}
          {node.topic}
        </button>

        {/* Children */}
        {hasChildren && !collapsed && (
          <div className="ml-5 border-l-2 pl-2 space-y-0.5" style={{ borderColor: `${color}50` }}>
            {node.children!.map((child, i) => (
              <MindMapBranch
                key={i}
                node={child}
                depth={depth + 1}
                color={color}
                isLast={i === node.children!.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MindMapTree({ node }: { node: MindMapNode }) {
  return (
    <div className="min-w-max">
      {/* Root node */}
      <div className="flex items-start gap-6">
        <div
          className="rounded-xl px-5 py-2.5 text-white font-bold text-base self-start mt-1 shrink-0"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
        >
          {node.topic}
        </div>

        {/* Branches */}
        {node.children && node.children.length > 0 && (
          <div className="flex flex-col gap-2 border-l-2 border-dashed border-border pl-6 pt-1">
            {node.children.map((child, i) => (
              <MindMapBranch
                key={i}
                node={child}
                depth={1}
                color={BRANCH_COLORS[i % BRANCH_COLORS.length]}
                isLast={i === node.children!.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? <Check className="mr-2 h-3.5 w-3.5 text-green-500" /> : <Copy className="mr-2 h-3.5 w-3.5" />}
      {copied ? 'Copied!' : 'Copy'}
    </Button>
  )
}

export function SummaryPage() {
  const [searchParams] = useSearchParams()
  const [docIds, setDocIds] = useState<string[]>(() => {
    const doc = searchParams.get('doc')
    return doc ? [doc] : []
  })
  const [loading, setLoading] = useState(false)
  const [summaryType, setSummaryType] = useState('short')
  const [summaryResult, setSummaryResult] = useState<SummaryResponse | null>(null)

  const [concept, setConcept] = useState('')
  const [explainLevel, setExplainLevel] = useState('college')
  const [explainResult, setExplainResult] = useState<ConceptExplainResponse | null>(null)

  const [mindMap, setMindMap] = useState<object | null>(null)
  const [studyPlan, setStudyPlan] = useState<object | null>(null)
  const [formulas, setFormulas] = useState<object | null>(null)
  const [glossary, setGlossary] = useState<object | null>(null)
  const [examDate, setExamDate] = useState('')

  const docId = docIds[0]

  const handleSummarize = async () => {
    if (!docId) { toast.error('Please select a document'); return }
    setLoading(true)
    try {
      const res = await summariesApi.summarize({ document_id: docId, summary_type: summaryType })
      setSummaryResult(res)
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to generate summary')) }
    finally { setLoading(false) }
  }

  const handleExplain = async () => {
    if (!concept.trim()) { toast.error('Please enter a concept'); return }
    setLoading(true)
    try {
      const res = await summariesApi.explain({ concept, document_id: docId, level: explainLevel, use_analogies: true, use_examples: true })
      setExplainResult(res)
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to explain concept')) }
    finally { setLoading(false) }
  }

  const handleMindMap = async () => {
    if (!docId) { toast.error('Please select a document'); return }
    setLoading(true)
    try {
      const res = await summariesApi.mindMap(docId)
      setMindMap(res.mind_map)
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to generate mind map')) }
    finally { setLoading(false) }
  }

  const handleStudyPlan = async () => {
    if (!docId) { toast.error('Please select a document'); return }
    setLoading(true)
    try {
      const res = await summariesApi.studyPlan({ document_id: docId, exam_date: examDate || undefined })
      setStudyPlan(res.study_plan)
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to generate study plan')) }
    finally { setLoading(false) }
  }

  const handleFormulas = async () => {
    if (!docId) { toast.error('Please select a document'); return }
    setLoading(true)
    try {
      const res = await summariesApi.formulaSheet(docId)
      // res = { formulas: [...] }
      setFormulas((res as Record<string, unknown>).formulas as object ?? [])
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to generate formula sheet')) }
    finally { setLoading(false) }
  }

  const handleGlossary = async () => {
    if (!docId) { toast.error('Please select a document'); return }
    setLoading(true)
    try {
      const res = await summariesApi.glossary(docId)
      // res = { glossary: { term: def, ... } }
      setGlossary((res as Record<string, unknown>).glossary as object ?? {})
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to generate glossary')) }
    finally { setLoading(false) }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader title="AI Tools" subtitle="Generate summaries, explanations, and study materials with AI" />

      <div>
        <label className="text-sm font-medium block mb-1.5">Select Document</label>
        <DocumentSelector value={docIds} onChange={setDocIds} />
      </div>

      <Tabs defaultValue="summary">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="summary" className="gap-1.5 text-xs"><BookOpen className="h-3.5 w-3.5" /> Summary</TabsTrigger>
          <TabsTrigger value="explain" className="gap-1.5 text-xs"><Lightbulb className="h-3.5 w-3.5" /> Explain</TabsTrigger>
          <TabsTrigger value="mindmap" className="gap-1.5 text-xs"><Map className="h-3.5 w-3.5" /> Mind Map</TabsTrigger>
          <TabsTrigger value="studyplan" className="gap-1.5 text-xs"><Calendar className="h-3.5 w-3.5" /> Study Plan</TabsTrigger>
          <TabsTrigger value="formulas" className="gap-1.5 text-xs"><Calculator className="h-3.5 w-3.5" /> Formulas</TabsTrigger>
          <TabsTrigger value="glossary" className="gap-1.5 text-xs"><BookMarked className="h-3.5 w-3.5" /> Glossary</TabsTrigger>
        </TabsList>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-4 mt-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-sm font-medium block mb-1.5">Summary Type</label>
              <Select value={summaryType} onValueChange={setSummaryType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short Overview (3-5 sentences)</SelectItem>
                  <SelectItem value="detailed">Detailed Summary</SelectItem>
                  <SelectItem value="bullet">Bullet Points</SelectItem>
                  <SelectItem value="one_page">One-Page Notes</SelectItem>
                  <SelectItem value="exam_revision">Exam Revision Notes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSummarize} loading={loading}>
              <Wand2 className="mr-2 h-4 w-4" /> Generate
            </Button>
          </div>
          {summaryResult && (
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Badge variant="secondary" className="text-xs">{summaryResult.word_count} words</Badge>
                  <div className="flex items-center gap-2">
                    <CopyButton text={[summaryResult.summary, ...(summaryResult.key_points.length ? ['\nKey Points:', ...summaryResult.key_points.map(p => `• ${p}`)] : [])].join('\n')} />
                    <Button variant="outline" size="sm" onClick={() => docId && exportApi.summary(docId, summaryType, 'pdf')}>
                      <Download className="mr-2 h-3.5 w-3.5" /> Export PDF
                    </Button>
                  </div>
                </div>
                <div className="prose-content border-t pt-4">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{summaryResult.summary}</ReactMarkdown>
                </div>
                {summaryResult.key_points.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold mb-3">Key Points</h4>
                    <ul className="space-y-2">
                      {summaryResult.key_points.map((p, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm">
                          <span className="text-primary mt-1 shrink-0">•</span>
                          <span className="leading-relaxed">{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Explain Tab */}
        <TabsContent value="explain" className="space-y-4 mt-4">
          <div className="flex gap-3">
            <Input
              className="flex-1"
              placeholder="Enter concept to explain (e.g., Neural Networks, Photosynthesis)"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
            />
            <Select value={explainLevel} onValueChange={setExplainLevel}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="school">School Student</SelectItem>
                <SelectItem value="college">College Student</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleExplain} loading={loading}>Explain</Button>
          </div>
          {explainResult && (
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="prose-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{explainResult.explanation}</ReactMarkdown>
                </div>
                {explainResult.analogy && (
                  <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1.5">Analogy</p>
                    <p className="text-sm leading-relaxed">{explainResult.analogy}</p>
                  </div>
                )}
                {explainResult.examples.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold mb-3">Examples</h4>
                    <ul className="space-y-2">
                      {explainResult.examples.map((ex, i) => (
                        <li key={i} className="text-sm flex items-start gap-2.5 leading-relaxed">
                          <span className="text-primary shrink-0 mt-0.5">→</span>
                          <span>{ex}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Mind Map Tab */}
        <TabsContent value="mindmap" className="space-y-4 mt-4">
          <Button onClick={handleMindMap} loading={loading}>
            <Wand2 className="mr-2 h-4 w-4" /> Generate Mind Map
          </Button>
          {mindMap && (
            <Card>
              <CardContent className="p-4 overflow-auto">
                <MindMapTree node={mindMap as MindMapNode} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Study Plan Tab */}
        <TabsContent value="studyplan" className="space-y-4 mt-4">
          <div className="flex items-end gap-3">
            <div className="w-52">
              <DatePicker
                label="Exam Date (optional)"
                value={examDate}
                onChange={setExamDate}
                placeholder="Pick exam date"
                disablePast
              />
            </div>
            <Button onClick={handleStudyPlan} loading={loading}>
              <Wand2 className="mr-2 h-4 w-4" /> Generate Plan
            </Button>
          </div>
          {studyPlan && (() => {
            // Normalise: may be { total_days, daily_schedule } or wrapped further
            const plan = (studyPlan as Record<string, unknown>)
            const days = Array.isArray(plan.daily_schedule)
              ? (plan.daily_schedule as Array<{
                  day: number; date: string; topics: string[];
                  duration_hours: number; tasks: Array<{ task: string; time?: number }>
                }>)
              : []
            const totalDays = (plan.total_days as number) ?? days.length

            return (
              <div className="space-y-3">
                <div className="flex items-center gap-3 mb-1">
                  <Badge variant="secondary">{totalDays} day plan</Badge>
                </div>
                {days.map((d, i) => (
                  <Card key={i} className="overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 border-b">
                      <span className="text-xs font-bold text-primary bg-primary/10 rounded-full w-7 h-7 flex items-center justify-center shrink-0">
                        {d.day}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{d.date}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {d.topics?.join(' · ')}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {d.duration_hours}h
                      </Badge>
                    </div>
                    <CardContent className="p-3">
                      <ul className="space-y-1">
                        {d.tasks?.map((t, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm">
                            <span className="text-primary mt-0.5 shrink-0">→</span>
                            <span>{t.task}</span>
                            {t.time && (
                              <span className="ml-auto text-xs text-muted-foreground shrink-0">{t.time}h</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          })()}
        </TabsContent>

        {/* Formulas Tab */}
        <TabsContent value="formulas" className="space-y-4 mt-4">
          <Button onClick={handleFormulas} loading={loading}>
            <Wand2 className="mr-2 h-4 w-4" /> Extract Formulas
          </Button>
          {formulas && (
            <Card>
              <CardContent className="p-5">
                {(() => {
                  // Backend returns either an array of formula objects or a dict
                  const items: Array<{ name: string; formula: string; description?: string; variables?: Record<string, string> }> =
                    Array.isArray(formulas)
                      ? formulas as Array<{ name: string; formula: string; description?: string; variables?: Record<string, string> }>
                      : Object.entries(formulas as Record<string, string>).map(([name, formula]) => ({ name, formula }))
                  if (items.length === 0) {
                    return <p className="text-sm text-muted-foreground">No formulas found in this document.</p>
                  }
                  return (
                    <div className="space-y-3">
                      {items.map((item, i) => (
                        <div key={i} className="rounded-lg border p-3 space-y-1">
                          <p className="text-sm font-semibold">{item.name}</p>
                          <code className="text-xs bg-muted px-2 py-1 rounded inline-block font-mono">{item.formula}</code>
                          {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                          {item.variables && Object.keys(item.variables).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(item.variables).map(([v, meaning]) => (
                                <span key={v} className="text-xs bg-primary/10 text-primary rounded px-1.5 py-0.5">
                                  <strong>{v}</strong>: {meaning}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Glossary Tab */}
        <TabsContent value="glossary" className="space-y-4 mt-4">
          <Button onClick={handleGlossary} loading={loading}>
            <Wand2 className="mr-2 h-4 w-4" /> Generate Glossary
          </Button>
          {glossary && (
            <Card>
              <CardContent className="p-5">
                {(() => {
                  const entries = Array.isArray(glossary)
                    ? (glossary as Array<{ term: string; definition: string }>).map((g) => [g.term, g.definition] as [string, string])
                    : Object.entries(glossary as Record<string, string>)
                  if (entries.length === 0) {
                    return <p className="text-sm text-muted-foreground">No glossary terms found in this document.</p>
                  }
                  return (
                    <div className="space-y-2">
                      {entries.map(([term, def]) => (
                        <div key={term} className="border-b pb-2 last:border-0">
                          <p className="text-sm font-semibold text-primary">{term}</p>
                          <p className="text-sm text-muted-foreground mt-0.5">{String(def)}</p>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
