import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Plus, Trash2, Mic, MicOff, ChevronDown,
  MessageSquare, PanelLeftClose, PanelLeft,
  FileText, BookOpen, Brain, Sparkles, Zap,
  Clock, Calendar,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useChatSessions, useChatMessages, useSendMessage, useDeleteSession } from '@/hooks/useChat'
import { useVoice } from '@/hooks/useVoice'
import { DocumentSelector } from '@/components/shared/DocumentSelector'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatDateRelative } from '@/lib/utils'
import type { Citation } from '@/types'

// ── Citations panel ───────────────────────────────────────────────────────────
function CitationsPanel({ citations }: { citations: Citation[] }) {
  const [open, setOpen] = useState(false)
  if (!citations.length) return null
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown className={cn('h-3 w-3 transition-transform duration-150', open && 'rotate-180')} />
        <span className="font-medium">{citations.length} source{citations.length > 1 ? 's' : ''} cited</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="mt-2 space-y-2 overflow-hidden"
          >
            {citations.map((c, i) => (
              <div key={i} className="rounded-xl border border-border/60 bg-background/60 p-3 flex items-start gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-semibold text-foreground truncate">{c.document_title}</p>
                    {c.page_number && (
                      <span className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0">
                        p.{c.page_number}
                      </span>
                    )}
                    <span className="text-xs font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/25 rounded px-1.5 py-0.5 shrink-0">
                      {Math.round(c.score * 100)}% match
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{c.chunk_content}</p>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-end gap-2.5 mb-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full shrink-0"
        style={{ background: 'linear-gradient(135deg, hsl(168 76% 36%), #8b5cf6)' }}>
        <Sparkles className="h-4 w-4 text-white" />
      </div>
      <div className="rounded-2xl rounded-bl-sm bg-card border border-border px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-2 w-2 rounded-full"
              style={{ background: 'linear-gradient(135deg, hsl(168 76% 36%), #8b5cf6)' }}
              animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.8, delay: i * 0.18, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Suggestion categories ─────────────────────────────────────────────────────
const SUGGESTION_GROUPS = [
  {
    label: 'Understand',
    icon: BookOpen,
    color: 'text-teal-600 dark:text-teal-400',
    bg: 'bg-teal-50 dark:bg-teal-900/25',
    items: ['Summarize the main concepts', 'Explain the most important topic'],
  },
  {
    label: 'Review',
    icon: Brain,
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-900/25',
    items: ['What are the key takeaways?', 'Create revision notes for me'],
  },
  {
    label: 'Test',
    icon: Zap,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/25',
    items: ['What are likely exam questions?', 'Quiz me on this topic'],
  },
]

// ── Session grouping helper ───────────────────────────────────────────────────
function groupSessionsByDate(sessions: { id: string; title: string; updated_at: string }[]) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const week = new Date(today.getTime() - 6 * 86400000)

  const groups: { label: string; sessions: typeof sessions }[] = [
    { label: 'Today', sessions: [] },
    { label: 'Yesterday', sessions: [] },
    { label: 'This week', sessions: [] },
    { label: 'Older', sessions: [] },
  ]

  for (const s of sessions) {
    const d = new Date(s.updated_at)
    if (d >= today) groups[0].sessions.push(s)
    else if (d >= yesterday) groups[1].sessions.push(s)
    else if (d >= week) groups[2].sessions.push(s)
    else groups[3].sessions.push(s)
  }

  return groups.filter(g => g.sessions.length > 0)
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function ChatPage() {
  const { sessionId } = useParams<{ sessionId?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(sessionId)
  const [message, setMessage] = useState('')
  const [docIds, setDocIds] = useState<string[]>(() => {
    const doc = searchParams.get('doc')
    return doc ? [doc] : []
  })
  const [mode, setMode] = useState<'rag' | 'general'>('rag')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [localMessages, setLocalMessages] = useState<Array<{ role: string; content: string; citations?: Citation[]; suggested_questions?: string[]; timestamp?: Date }>>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { data: sessions = [], isLoading: sessionsLoading } = useChatSessions()
  const { data: dbMessages = [], error: messagesError } = useChatMessages(activeSessionId)
  const { mutateAsync: sendMsg } = useSendMessage()
  const { mutateAsync: deleteSession } = useDeleteSession()
  const { isListening, transcript, isSupported, startListening, stopListening } = useVoice()

  useEffect(() => { if (transcript) setMessage(transcript) }, [transcript])

  useEffect(() => {
    setLocalMessages(dbMessages.map((m) => ({
      role: m.role, content: m.content, citations: m.citations,
    })))
  }, [dbMessages])

  useEffect(() => {
    if (messagesError && activeSessionId) {
      setActiveSessionId(undefined)
      setLocalMessages([])
      navigate('/chat', { replace: true })
    }
  }, [messagesError, activeSessionId, navigate])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [localMessages, isTyping])

  const handleSend = async (overrideMessage?: string) => {
    const msgText = overrideMessage ?? message.trim()
    if (!msgText) return
    setMessage('')
    setSuggestions([])
    setLocalMessages(prev => [...prev, { role: 'user', content: msgText, timestamp: new Date() }])
    setIsTyping(true)
    if (textareaRef.current) textareaRef.current.style.height = '44px'
    try {
      const res = await sendMsg({ message: msgText, session_id: activeSessionId, document_ids: docIds, mode })
      if (!activeSessionId) {
        setActiveSessionId(res.session_id)
        navigate(`/chat/${res.session_id}`, { replace: true })
      }
      const newSuggestions = res.suggested_questions ?? []
      setSuggestions(newSuggestions)
      setLocalMessages(prev => [
        ...prev,
        { role: 'assistant', content: res.message, citations: res.citations, suggested_questions: newSuggestions, timestamp: new Date() },
      ])
    } catch {
      setLocalMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.', timestamp: new Date() },
      ])
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleNewChat = () => {
    setActiveSessionId(undefined)
    setLocalMessages([])
    navigate('/chat', { replace: true })
  }

  const sessionGroups = groupSessionsByDate(sessions as { id: string; title: string; updated_at: string }[])
  const activeSession = sessions.find(s => s.id === activeSessionId)

  return (
    <div className="flex h-[calc(100vh-4.5rem)] gap-0 -mx-4 md:-mx-6 overflow-hidden">

      {/* ── Conversations sidebar ── */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 268, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="shrink-0 flex flex-col border-r border-border bg-card overflow-hidden"
          >
            {/* Sidebar header — gradient accent */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0"
              style={{ background: 'linear-gradient(90deg, hsl(var(--primary)/0.08) 0%, transparent 100%)' }}>
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 flex items-center justify-center rounded-lg shrink-0"
                  style={{ background: 'linear-gradient(135deg, hsl(168 76% 36%), #8b5cf6)' }}>
                  <MessageSquare className="h-3.5 w-3.5 text-white" />
                </div>
                <h2 className="text-sm font-bold text-foreground">Conversations</h2>
                {sessions.length > 0 && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">{sessions.length}</Badge>
                )}
              </div>
              <button
                aria-label="Hide sidebar"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>

            {/* New Chat button */}
            <div className="px-3 py-2.5 border-b border-border shrink-0">
              <button
                onClick={handleNewChat}
                className="w-full flex items-center justify-center gap-2 h-9 rounded-xl text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ background: 'linear-gradient(90deg, hsl(168 76% 36%), #8b5cf6)' }}
              >
                <Plus className="h-4 w-4" />
                New Chat
              </button>
            </div>

            {/* Session list */}
            <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
              {sessionsLoading ? (
                <div className="space-y-1.5 px-3">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
                </div>
              ) : sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 gap-3">
                  <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-muted">
                    <MessageSquare className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">No chats yet</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Start a conversation above</p>
                  </div>
                </div>
              ) : (
                <div className="px-2 space-y-4">
                  {sessionGroups.map(group => (
                    <div key={group.label}>
                      {/* Group label */}
                      <div className="flex items-center gap-2 px-2 mb-1">
                        {group.label === 'Today' ? <Clock className="h-3 w-3 text-muted-foreground/60" /> : <Calendar className="h-3 w-3 text-muted-foreground/60" />}
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{group.label}</p>
                      </div>
                      <div className="space-y-0.5">
                        {group.sessions.map((s) => {
                          const isActive = s.id === activeSessionId
                          return (
                            <div
                              key={s.id}
                              className={cn(
                                'flex items-center justify-between rounded-xl px-3 py-2.5 cursor-pointer transition-all group',
                                isActive
                                  ? 'text-primary-foreground shadow-sm'
                                  : 'hover:bg-accent text-foreground',
                              )}
                              style={isActive ? { background: 'linear-gradient(90deg, hsl(168 76% 36%), #8b5cf6)' } : {}}
                              onClick={() => {
                                setActiveSessionId(s.id)
                                navigate(`/chat/${s.id}`)
                              }}
                            >
                              <div className="min-w-0 flex-1 flex items-start gap-2">
                                <MessageSquare className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', isActive ? 'text-primary-foreground/70' : 'text-muted-foreground')} />
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold truncate leading-tight">{s.title || 'New Chat'}</p>
                                  <p className={cn('text-xs truncate mt-0.5', isActive ? 'text-primary-foreground/65' : 'text-muted-foreground')}>
                                    {formatDateRelative(s.updated_at)}
                                  </p>
                                </div>
                              </div>
                              <button
                                aria-label="Delete chat"
                                className="opacity-0 group-hover:opacity-100 ml-1.5 shrink-0 p-1 rounded-lg hover:bg-black/10 transition-all"
                                onClick={(e) => { e.stopPropagation(); setDeleteId(s.id) }}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Chat area ── */}
      <div className="flex flex-1 flex-col overflow-hidden bg-background min-w-0">

        {/* Chat top bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card/60 backdrop-blur-sm shrink-0">
          {!sidebarOpen && (
            <button
              aria-label="Show sidebar"
              onClick={() => setSidebarOpen(true)}
              className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          )}

          {/* AI online indicator + session title */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="relative shrink-0">
              <div className="h-8 w-8 flex items-center justify-center rounded-full"
                style={{ background: 'linear-gradient(135deg, hsl(168 76% 36%), #8b5cf6)' }}>
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              {/* Online dot */}
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate leading-tight">
                {activeSession?.title || 'New Conversation'}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium leading-tight">AI Online</p>
            </div>
          </div>

          {/* Mode toggle */}
          <div className="flex items-center bg-muted rounded-xl p-1 shrink-0">
            {(['rag', 'general'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                  mode === m
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m === 'rag' ? <><FileText className="h-3 w-3" /> Doc Mode</> : <><Zap className="h-3 w-3" /> General</>}
              </button>
            ))}
          </div>
        </div>

        {/* Messages area */}
        <ScrollArea className="flex-1 px-4">
          <div className="py-6 max-w-3xl mx-auto">
            {localMessages.length === 0 ? (
              /* ── Empty state ── */
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-8 py-10"
              >
                {/* Animated brand icon */}
                <div className="relative">
                  <motion.div
                    className="h-20 w-20 flex items-center justify-center rounded-3xl"
                    style={{ background: 'linear-gradient(135deg, hsl(168 76% 36%), #8b5cf6, #ec4899)' }}
                    animate={{ rotate: [0, 3, -3, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Sparkles className="h-9 w-9 text-white" />
                  </motion.div>
                  {/* Glow ring */}
                  <div className="absolute inset-0 rounded-3xl opacity-20 blur-xl"
                    style={{ background: 'linear-gradient(135deg, hsl(168 76% 36%), #8b5cf6)' }} />
                </div>

                <div className="text-center max-w-sm">
                  <h3 className="text-xl font-bold tracking-tight">Start a conversation</h3>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    Ask me anything about your study materials. I'll use AI to give accurate, cited answers.
                  </p>
                </div>

                {/* Categorised suggestion chips */}
                <div className="w-full max-w-xl space-y-3">
                  {SUGGESTION_GROUPS.map(group => {
                    const Icon = group.icon
                    return (
                      <div key={group.label} className="flex items-start gap-3">
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg mt-1 ${group.bg}`}>
                          <Icon className={`h-3.5 w-3.5 ${group.color}`} />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {group.items.map(s => (
                            <button
                              key={s}
                              onClick={() => setMessage(s)}
                              className="rounded-xl border border-border bg-card text-foreground px-3.5 py-2 text-xs font-medium hover:bg-accent hover:border-primary/30 hover:text-foreground transition-all hover:-translate-y-0.5 hover:shadow-sm"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            ) : (
              /* ── Messages ── */
              <div className="space-y-5">
                <AnimatePresence initial={false}>
                  {localMessages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className={cn('flex items-end gap-2.5', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                    >
                      {/* AI avatar */}
                      {msg.role === 'assistant' && (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full mb-0.5"
                          style={{ background: 'linear-gradient(135deg, hsl(168 76% 36%), #8b5cf6)' }}>
                          <Sparkles className="h-4 w-4 text-white" />
                        </div>
                      )}

                      <div className="flex flex-col gap-0.5 max-w-[78%]">
                        {/* Bubble */}
                        <div
                          className={cn(
                            'rounded-2xl px-4 py-3 shadow-sm',
                            msg.role === 'user'
                              ? 'rounded-br-sm text-white'
                              : 'bg-card text-card-foreground border border-border/60 rounded-bl-sm',
                          )}
                          style={msg.role === 'user'
                            ? { background: 'linear-gradient(135deg, hsl(168 76% 36%), #7c3aed)' }
                            : {}
                          }
                        >
                          {msg.role === 'assistant' ? (
                            <div className="prose-chat">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                              {msg.citations && <CitationsPanel citations={msg.citations} />}
                            </div>
                          ) : (
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          )}
                        </div>
                        {/* Timestamp */}
                        {msg.timestamp && (
                          <p className={cn('text-[10px] text-muted-foreground/60 px-1', msg.role === 'user' ? 'text-right' : 'text-left')}>
                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>

                      {/* User avatar */}
                      {msg.role === 'user' && (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full mb-0.5 bg-muted border border-border text-xs font-bold text-foreground">
                          Me
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {isTyping && <TypingIndicator />}

                {/* Follow-up suggestions */}
                {!isTyping && suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-wrap gap-2 pl-10"
                  >
                    <p className="w-full text-xs text-muted-foreground font-medium mb-1 pl-1">Follow-up questions:</p>
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(s)}
                        className="rounded-xl border border-primary/30 bg-primary/5 text-foreground px-3.5 py-1.5 text-xs font-medium hover:bg-primary/10 hover:border-primary/50 transition-all text-left hover:-translate-y-0.5"
                      >
                        {s}
                      </button>
                    ))}
                  </motion.div>
                )}
                <div ref={scrollRef} />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* ── Input bar ── */}
        <div className="border-t border-border bg-card/60 backdrop-blur-sm shrink-0">
          {/* Document selector strip */}
          {mode === 'rag' && (
            <div className="px-4 pt-3 pb-0">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium text-muted-foreground">Context documents</span>
              </div>
              <DocumentSelector value={docIds} onChange={setDocIds} placeholder="Select documents for context…" />
            </div>
          )}

          <div className="px-4 py-3 space-y-2">
            {/* Textarea + actions */}
            <div className="flex items-end gap-2 rounded-2xl border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring focus-within:border-primary transition-all">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about your study material…"
                rows={1}
                className="flex-1 min-h-[36px] max-h-36 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none scrollbar-thin py-1"
                style={{ height: '36px' }}
                onInput={(e) => {
                  const t = e.target as HTMLTextAreaElement
                  t.style.height = '36px'
                  t.style.height = `${Math.min(t.scrollHeight, 144)}px`
                }}
              />
              <div className="flex items-center gap-1.5 shrink-0 pb-0.5">
                {/* Character count */}
                {message.length > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums">{message.length}</span>
                )}
                {/* Voice */}
                {isSupported && (
                  <button
                    onClick={isListening ? stopListening : startListening}
                    title={isListening ? 'Stop recording' : 'Voice input'}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg transition-all',
                      isListening
                        ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                    )}
                  >
                    {isListening
                      ? <MicOff className="h-4 w-4" />
                      : <Mic className="h-4 w-4" />}
                  </button>
                )}
                {/* Send */}
                <button
                  onClick={() => handleSend()}
                  disabled={!message.trim() || isTyping}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-95"
                  style={{ background: 'linear-gradient(135deg, hsl(168 76% 36%), #8b5cf6)' }}
                  title="Send message"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Hint bar */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                <kbd className="font-mono text-xs bg-muted border border-border rounded px-1 py-0.5">Enter</kbd> send ·{' '}
                <kbd className="font-mono text-xs bg-muted border border-border rounded px-1 py-0.5">Shift+Enter</kbd> new line
              </p>
              {isListening && (
                <motion.p
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className="text-xs text-destructive font-medium flex items-center gap-1"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive inline-block" />
                  Listening…
                </motion.p>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Chat"
        description="This will permanently delete this chat session and all messages."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleteId) {
            await deleteSession(deleteId)
            if (deleteId === activeSessionId) handleNewChat()
          }
        }}
      />
    </div>
  )
}
