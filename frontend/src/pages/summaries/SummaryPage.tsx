import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wand2, Loader2, Download, BookOpen, Lightbulb, Map,
  Calendar, Calculator, BookMarked, Copy, Check,
  ChevronRight, Sparkles,
} from 'lucide-react'
import { summariesApi, exportApi, getErrorMessage } from '@/lib/api'
import { DocumentSelector } from '@/components/shared/DocumentSelector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { SummaryResponse, ConceptExplainResponse } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────
interface MindMapNode { topic: string; children?: MindMapNode[] }

const BRANCH_COLORS = [
  '#14b8a6', '#8b5cf6', '#f59e0b', '#ef4444',
  '#3b82f6', '#ec4899', '#06b6d4', '#84cc16',
  '#f97316', '#6366f1',
]

// ── Mind Map renderer ─────────────────────────────────────────────────────────
function MindMapBranch({ node, depth, color }: { node: MindMapNode; depth: number; color: string; isLast: boolean }) {
  const [collapsed, setCollapsed] = useState(false)
  const hasChildren = node.children && node.children.length > 0
  return (
    <div className="flex items-start">
      <div className="flex flex-col items-center mr-0" style={{ minWidth: depth > 0 ? 20 : 0 }}>
        {depth > 0 && <div className="w-5 border-t-2" style={{ borderColor: color, marginTop: 14 }} />}
      </div>
      <div>
        <button
          onClick={() => hasChildren && setCollapsed(c => !c)}
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
        {hasChildren && !collapsed && (
          <div className="ml-5 border-l-2 pl-2 space-y-0.5" style={{ borderColor: `${color}50` }}>
            {node.children!.map((child, i) => (
              <MindMapBranch key={i} node={child} depth={depth + 1} color={color} isLast={i === node.children!.length - 1} />
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
      <div className="flex items-start gap-6">
        <div className="rounded-xl px-5 py-2.5 text-white font-bold text-base self-start mt-1 shrink-0"
          style={{ background: 'linear-gradient(135deg, hsl(168 76% 36%), #8b5cf6)' }}>
          {node.topic}
        </div>
        {node.children && node.children.length > 0 && (
          <div className="flex flex-col gap-2 border-l-2 border-dashed border-border pl-6 pt-1">
            {node.children.map((child, i) => (
              <MindMapBranch key={i} node={child} depth={1} color={BRANCH_COLORS[i % BRANCH_COLORS.length]} isLast={i === node.children!.length - 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard unavailable */ }
  }
  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? <Check className="mr-2 h-3.5 w-3.5 text-green-500" /> : <Copy className="mr-2 h-3.5 w-3.5" />}
      {copied ? 'Copied!' : 'Copy'}
    </Button>
  )
}

// ── Tool definitions ──────────────────────────────────────────────────────────
type ToolId = 'summary' | 'explain' | 'mindmap' | 'studyplan' | 'formulas' | 'glossary'

const TOOLS: { id: ToolId; label: string; icon: React.ElementType; desc: string; gradient: string }[] = [
  { id: 'summary',   label: 'Summarize',   icon: BookOpen,    desc: 'Condense any document into clear notes',     gradient: 'from-teal-500 to-cyan-500'    },
  { id: 'explain',   label: 'Explain',     icon: Lightbulb,   desc: 'Break down any concept at your level',       gradient: 'from-amber-500 to-orange-500' },
  { id: 'mindmap',   label: 'Mind Map',    icon: Map,         desc: 'Visualise topics as an interactive tree',    gradient: 'from-violet-500 to-purple-500'},
  { id: 'studyplan', label: 'Study Plan',  icon: Calendar,    desc: 'Build a personalised revision schedule',     gradient: 'from-rose-500 to-pink-500'   },
  { id: 'formulas',  label: 'Formulas',    icon: Calculator,  desc: 'Extract all equations and variables',        gradient: 'from-blue-500 to-indigo-500' },
  { id: 'glossary',  label: 'Glossary',    icon: BookMarked,  desc: 'Generate a full dictionary of key terms',    gradient: 'from-emerald-500 to-teal-500'},
]

// ── Page ──────────────────────────────────────────────────────────────────────
export function SummaryPage() {
  const [searchParams] = useSearchParams()
  const [docIds, setDocIds] = useState<string[]>(() => {
    const doc = searchParams.get('doc')
    return doc ? [doc] : []
  })
  const [loading, setLoading] = useState(false)
  const [activeTool, setActiveTool] = useState<ToolId>('summary')

  // Results
  const [summaryType, setSummaryType]       = useState('short')
  const [summaryResult, setSummaryResult]   = useState<SummaryResponse | null>(null)
  const [concept, setConcept]               = useState('')
  const [explainLevel, setExplainLevel]     = useState('college')
  const [explainResult, setExplainResult]   = useState<ConceptExplainResponse | null>(null)
  const [mindMap, setMindMap]               = useState<object | null>(null)
  const [studyPlan, setStudyPlan]           = useState<object | null>(null)
  const [formulas, setFormulas]             = useState<object | null>(null)
  const [glossary, setGlossary]             = useState<object | null>(null)
  const [examDate, setExamDate]             = useState('')

  const docId = docIds[0]

  const handleGenerate = async () => {
    switch (activeTool) {
      case 'summary': {
        if (!docId) { toast.error('Please select a document'); return }
        setLoading(true)
        try { setSummaryResult(await summariesApi.summarize({ document_id: docId, summary_type: summaryType })) }
        catch (err) { toast.error(getErrorMessage(err, 'Failed to generate summary')) }
        finally { setLoading(false) }
        break
      }
      case 'explain': {
        if (!concept.trim()) { toast.error('Please enter a concept'); return }
        setLoading(true)
        try { setExplainResult(await summariesApi.explain({ concept, document_id: docId, level: explainLevel, use_analogies: true, use_examples: true })) }
        catch (err) { toast.error(getErrorMessage(err, 'Failed to explain concept')) }
        finally { setLoading(false) }
        break
      }
      case 'mindmap': {
        if (!docId) { toast.error('Please select a document'); return }
        setLoading(true)
        try { const r = await summariesApi.mindMap(docId); setMindMap(r.mind_map) }
        catch (err) { toast.error(getErrorMessage(err, 'Failed to generate mind map')) }
        finally { setLoading(false) }
        break
      }
      case 'studyplan': {
        if (!docId) { toast.error('Please select a document'); return }
        setLoading(true)
        try { const r = await summariesApi.studyPlan({ document_id: docId, exam_date: examDate || undefined }); setStudyPlan(r.study_plan) }
        catch (err) { toast.error(getErrorMessage(err, 'Failed to generate study plan')) }
        finally { setLoading(false) }
        break
      }
      case 'formulas': {
        if (!docId) { toast.error('Please select a document'); return }
        setLoading(true)
        try { const r = await summariesApi.formulaSheet(docId); setFormulas((r as Record<string, unknown>).formulas as object ?? []) }
        catch (err) { toast.error(getErrorMessage(err, 'Failed to extract formulas')) }
        finally { setLoading(false) }
        break
      }
      case 'glossary': {
        if (!docId) { toast.error('Please select a document'); return }
        setLoading(true)
        try { const r = await summariesApi.glossary(docId); setGlossary((r as Record<string, unknown>).glossary as object ?? {}) }
        catch (err) { toast.error(getErrorMessage(err, 'Failed to generate glossary')) }
        finally { setLoading(false) }
        break
      }
    }
  }

  const currentTool = TOOLS.find(t => t.id === activeTool)!
  const hasResult = activeTool === 'summary' ? !!summaryResult
    : activeTool === 'explain' ? !!explainResult
    : activeTool === 'mindmap' ? !!mindMap
    : activeTool === 'studyplan' ? !!studyPlan
    : activeTool === 'formulas' ? !!formulas
    : !!glossary

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-violet-600 shrink-0">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">AI Tools</h2>
            <p className="text-sm text-muted-foreground">Generate summaries, explanations, and study materials</p>
          </div>
        </div>
      </div>

      {/* ── Document selector ── */}
      <Card>
        <CardContent className="p-4">
          <label className="text-sm font-semibold block mb-2 text-foreground">
            📄 Select Document
          </label>
          <DocumentSelector value={docIds} onChange={setDocIds} />
        </CardContent>
      </Card>

      {/* ── Tool picker grid ── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Choose a tool</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {TOOLS.map((tool) => {
            const Icon = tool.icon
            const isActive = activeTool === tool.id
            return (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive
                    ? 'border-primary/40 bg-primary/5 shadow-sm dark:bg-primary/10'
                    : 'border-border bg-card hover:border-border/80'
                }`}
              >
                {/* Gradient icon */}
                <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${tool.gradient} transition-transform duration-200 group-hover:scale-110`}>
                  <Icon className="h-4.5 w-4.5 text-white" style={{ width: 18, height: 18 }} />
                </div>
                <p className={`text-sm font-semibold leading-tight ${isActive ? 'text-primary' : 'text-foreground'}`}>
                  {tool.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug hidden sm:block">
                  {tool.desc}
                </p>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-violet-500 rounded-b-2xl" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Active tool config + Generate ── */}
      <Card className="border-border/60">
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className={`h-6 w-6 flex items-center justify-center rounded-lg bg-gradient-to-br ${currentTool.gradient}`}>
              <currentTool.icon className="h-3.5 w-3.5 text-white" />
            </div>
            {currentTool.label}
            <span className="text-muted-foreground font-normal text-xs ml-1">— {currentTool.desc}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="flex flex-wrap items-end gap-3">
            {/* Summary options */}
            {activeTool === 'summary' && (
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Summary Type</label>
                <Select value={summaryType} onValueChange={setSummaryType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Short Overview (3–5 sentences)</SelectItem>
                    <SelectItem value="detailed">Detailed Summary</SelectItem>
                    <SelectItem value="bullet">Bullet Points</SelectItem>
                    <SelectItem value="one_page">One-Page Notes</SelectItem>
                    <SelectItem value="exam_revision">Exam Revision Notes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* Explain options */}
            {activeTool === 'explain' && (
              <>
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Concept</label>
                  <Input
                    placeholder="e.g. Neural Networks, Photosynthesis, Quantum Entanglement"
                    value={concept}
                    onChange={e => setConcept(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                  />
                </div>
                <div className="w-44">
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Level</label>
                  <Select value={explainLevel} onValueChange={setExplainLevel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="school">School Student</SelectItem>
                      <SelectItem value="college">College Student</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {/* Study plan exam date */}
            {activeTool === 'studyplan' && (
              <div className="w-52">
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Exam Date <span className="opacity-50">(optional)</span></label>
                <DatePicker value={examDate} onChange={setExamDate} placeholder="Pick exam date" disablePast />
              </div>
            )}
            {/* Generic tools — no extra config, just a message */}
            {(['mindmap','formulas','glossary'] as ToolId[]).includes(activeTool) && (
              <p className="text-sm text-muted-foreground flex-1">
                {activeTool === 'mindmap'  && 'A visual topic tree will be generated from your selected document.'}
                {activeTool === 'formulas' && 'All equations and variables will be extracted from your document.'}
                {activeTool === 'glossary' && 'A dictionary of key terms and definitions will be built from your document.'}
              </p>
            )}

            <Button
              onClick={handleGenerate}
              loading={loading}
              className={`shrink-0 bg-gradient-to-r ${currentTool.gradient} text-white border-0 hover:opacity-90`}
            >
              {loading ? null : <Wand2 className="mr-2 h-4 w-4" />}
              Generate
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Results ── */}
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 gap-4"
          >
            <div className={`h-14 w-14 flex items-center justify-center rounded-2xl bg-gradient-to-br ${currentTool.gradient}`}>
              <Loader2 className="h-7 w-7 text-white animate-spin" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Generating {currentTool.label}…</p>
              <p className="text-sm text-muted-foreground mt-0.5">AI is analysing your document</p>
            </div>
          </motion.div>
        )}

        {!loading && !hasResult && (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-16 gap-4 rounded-2xl border-2 border-dashed border-border/60"
          >
            <div className={`h-16 w-16 flex items-center justify-center rounded-2xl bg-gradient-to-br ${currentTool.gradient} opacity-80`}>
              <currentTool.icon className="h-8 w-8 text-white" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground text-lg">{currentTool.label}</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">{currentTool.desc}. Select a document above and click Generate.</p>
            </div>
            <Button
              variant="outline"
              onClick={handleGenerate}
              className="gap-2 mt-1"
            >
              <Sparkles className="h-4 w-4" />
              Generate now
              <ChevronRight className="h-4 w-4" />
            </Button>
          </motion.div>
        )}

        {/* ── Summary result ── */}
        {!loading && activeTool === 'summary' && summaryResult && (
          <motion.div key="summary-result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader className="pb-3 flex-row items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 flex items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500">
                    <BookOpen className="h-3.5 w-3.5 text-white" />
                  </div>
                  <CardTitle className="text-sm font-semibold">Summary</CardTitle>
                  <Badge variant="secondary" className="text-xs">{summaryResult.word_count} words</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <CopyButton text={[summaryResult.summary, ...(summaryResult.key_points.length ? ['\nKey Points:', ...summaryResult.key_points.map(p => `• ${p}`)] : [])].join('\n')} />
                  <Button variant="outline" size="sm" onClick={() => docId && exportApi.summary(docId, summaryType, 'pdf')}>
                    <Download className="mr-2 h-3.5 w-3.5" /> PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-4">
                <div className="prose-content border-t pt-4">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{summaryResult.summary}</ReactMarkdown>
                </div>
                {summaryResult.key_points.length > 0 && (
                  <div className="rounded-xl bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 p-4">
                    <h4 className="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-widest mb-3">Key Points</h4>
                    <ul className="space-y-2">
                      {summaryResult.key_points.map((p, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm">
                          <span className="h-5 w-5 flex items-center justify-center rounded-full bg-teal-500 text-white text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                          <span className="leading-relaxed">{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Explain result ── */}
        {!loading && activeTool === 'explain' && explainResult && (
          <motion.div key="explain-result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader className="pb-3 flex-row items-center gap-2">
                <div className="h-7 w-7 flex items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500">
                  <Lightbulb className="h-3.5 w-3.5 text-white" />
                </div>
                <CardTitle className="text-sm font-semibold">{explainResult.concept}</CardTitle>
                <Badge variant="outline" className="capitalize text-xs ml-1">{explainResult.level}</Badge>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-4">
                <div className="prose-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{explainResult.explanation}</ReactMarkdown>
                </div>
                {explainResult.analogy && (
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-1.5">💡 Analogy</p>
                    <p className="text-sm leading-relaxed">{explainResult.analogy}</p>
                  </div>
                )}
                {explainResult.examples.length > 0 && (
                  <div className="rounded-xl bg-muted/50 border p-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Examples</h4>
                    <ul className="space-y-2">
                      {explainResult.examples.map((ex, i) => (
                        <li key={i} className="text-sm flex items-start gap-2.5 leading-relaxed">
                          <span className="text-amber-500 shrink-0 mt-0.5 font-bold">{i + 1}.</span>
                          <span>{ex}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Mind Map result ── */}
        {!loading && activeTool === 'mindmap' && mindMap && (
          <motion.div key="mindmap-result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader className="pb-3 flex-row items-center gap-2">
                <div className="h-7 w-7 flex items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-500">
                  <Map className="h-3.5 w-3.5 text-white" />
                </div>
                <CardTitle className="text-sm font-semibold">Mind Map</CardTitle>
              </CardHeader>
              <CardContent className="p-4 overflow-auto">
                <MindMapTree node={mindMap as MindMapNode} />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Study Plan result ── */}
        {!loading && activeTool === 'studyplan' && studyPlan && (() => {
          const plan = studyPlan as Record<string, unknown>
          const days = Array.isArray(plan.daily_schedule)
            ? (plan.daily_schedule as Array<{ day: number; date: string; topics: string[]; duration_hours: number; tasks: Array<{ task: string; time?: number }> }>)
            : []
          const totalDays = (plan.total_days as number) ?? days.length
          return (
            <motion.div key="plan-result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 flex items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-pink-500">
                  <Calendar className="h-3.5 w-3.5 text-white" />
                </div>
                <p className="font-semibold text-sm">Study Plan</p>
                <Badge variant="secondary">{totalDays} day plan</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {days.map((d, i) => (
                  <Card key={i} className="overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-2.5 border-b"
                      style={{ background: 'linear-gradient(90deg, hsl(var(--primary)/0.08), transparent)' }}>
                      <span className="text-xs font-bold text-primary bg-primary/15 rounded-full w-7 h-7 flex items-center justify-center shrink-0">
                        {d.day}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{d.date}</p>
                        <p className="text-xs text-muted-foreground truncate">{d.topics?.join(' · ')}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-xs">{d.duration_hours}h</Badge>
                    </div>
                    <CardContent className="p-3">
                      <ul className="space-y-1">
                        {d.tasks?.map((t, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm">
                            <span className="text-primary mt-0.5 shrink-0">→</span>
                            <span>{t.task}</span>
                            {t.time && <span className="ml-auto text-xs text-muted-foreground shrink-0">{t.time}h</span>}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          )
        })()}

        {/* ── Formulas result ── */}
        {!loading && activeTool === 'formulas' && formulas && (
          <motion.div key="formulas-result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader className="pb-3 flex-row items-center gap-2">
                <div className="h-7 w-7 flex items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500">
                  <Calculator className="h-3.5 w-3.5 text-white" />
                </div>
                <CardTitle className="text-sm font-semibold">Formula Sheet</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {(() => {
                  const items: Array<{ name: string; formula: string; description?: string; variables?: Record<string, string> }> =
                    Array.isArray(formulas)
                      ? formulas as Array<{ name: string; formula: string; description?: string; variables?: Record<string, string> }>
                      : Object.entries(formulas as Record<string, string>).map(([name, formula]) => ({ name, formula }))
                  if (items.length === 0) return <p className="text-sm text-muted-foreground">No formulas found in this document.</p>
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {items.map((item, i) => (
                        <div key={i} className="rounded-xl border bg-muted/30 p-4 space-y-2">
                          <p className="text-sm font-semibold">{item.name}</p>
                          <code className="text-sm bg-background border rounded-lg px-3 py-1.5 block font-mono text-primary">{item.formula}</code>
                          {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                          {item.variables && Object.keys(item.variables).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {Object.entries(item.variables).map(([v, meaning]) => (
                                <span key={v} className="text-xs bg-blue-50 dark:bg-blue-900/25 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-full px-2 py-0.5">
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
          </motion.div>
        )}

        {/* ── Glossary result ── */}
        {!loading && activeTool === 'glossary' && glossary && (
          <motion.div key="glossary-result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader className="pb-3 flex-row items-center gap-2">
                <div className="h-7 w-7 flex items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500">
                  <BookMarked className="h-3.5 w-3.5 text-white" />
                </div>
                <CardTitle className="text-sm font-semibold">Glossary</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {(() => {
                  const entries = Array.isArray(glossary)
                    ? (glossary as Array<{ term: string; definition: string }>).map(g => [g.term, g.definition] as [string, string])
                    : Object.entries(glossary as Record<string, string>)
                  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No glossary terms found in this document.</p>
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {entries.map(([term, def]) => (
                        <div key={term} className="rounded-xl border bg-muted/30 p-3">
                          <p className="text-sm font-semibold text-primary">{term}</p>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{String(def)}</p>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  )
}
