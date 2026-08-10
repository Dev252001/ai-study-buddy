import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Plus, Trash2, Mic, MicOff, ChevronDown, MessageSquare, PanelLeftClose, PanelLeft } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useChatSessions, useChatMessages, useSendMessage, useDeleteSession } from '@/hooks/useChat'
import { useVoice } from '@/hooks/useVoice'
import { DocumentSelector } from '@/components/shared/DocumentSelector'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatDateRelative } from '@/lib/utils'
import type { Citation } from '@/types'

function CitationsPanel({ citations }: { citations: Citation[] }) {
  const [open, setOpen] = useState(false)
  if (!citations.length) return null
  return (
    <div className="mt-2.5">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown className={cn('h-3 w-3 transition-transform duration-150', open && 'rotate-180')} />
        <span>{citations.length} source{citations.length > 1 ? 's' : ''}</span>
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
              <div key={i} className="rounded-lg border border-border/60 bg-background/50 p-2.5">
                <p className="text-xs font-semibold text-foreground">{c.document_title}</p>
                {c.page_number && (
                  <p className="text-xs text-muted-foreground mt-0.5">Page {c.page_number}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{c.chunk_content}</p>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2.5 mb-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
        <span className="text-xs font-semibold text-primary">AI</span>
      </div>
      <div className="rounded-2xl rounded-bl-sm bg-card border border-border px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-2 w-2 rounded-full bg-muted-foreground"
              animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 0.7, delay: i * 0.15, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

const SUGGESTIONS = [
  "Summarize the main concepts",
  "Explain the most important topic",
  "What are the key takeaways?",
  "Create revision notes for me",
  "What are likely exam questions?",
]

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
  const [localMessages, setLocalMessages] = useState<Array<{ role: string; content: string; citations?: Citation[]; suggested_questions?: string[] }>>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { data: sessions = [], isLoading: sessionsLoading } = useChatSessions()
  const { data: dbMessages = [], error: messagesError } = useChatMessages(activeSessionId)
  const { mutateAsync: sendMsg } = useSendMessage()
  const { mutateAsync: deleteSession } = useDeleteSession()
  const { isListening, transcript, isSupported, startListening, stopListening } = useVoice()

  useEffect(() => {
    if (transcript) setMessage(transcript)
  }, [transcript])

  useEffect(() => {
    const msgs = dbMessages.map((m) => ({
      role: m.role,
      content: m.content,
      citations: m.citations,
    }))
    setLocalMessages(msgs)
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

  const allMessages = localMessages

  const handleSend = async (overrideMessage?: string) => {
    const msgText = overrideMessage ?? message.trim()
    if (!msgText) return
    setMessage('')
    setSuggestions([])
    setLocalMessages((prev) => [...prev, { role: 'user', content: msgText }])
    setIsTyping(true)
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px'
    }

    try {
      const res = await sendMsg({
        message: msgText,
        session_id: activeSessionId,
        document_ids: docIds,
        mode,
      })
      if (!activeSessionId) {
        setActiveSessionId(res.session_id)
        navigate(`/chat/${res.session_id}`, { replace: true })
      }
      const newSuggestions = res.suggested_questions ?? []
      setSuggestions(newSuggestions)
      setLocalMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.message, citations: res.citations, suggested_questions: newSuggestions },
      ])
    } catch {
      setLocalMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
      ])
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    handleSend(suggestion)
  }

  const handleNewChat = () => {
    setActiveSessionId(undefined)
    setLocalMessages([])
    navigate('/chat', { replace: true })
  }

  return (
    <div className="flex h-[calc(100vh-4.5rem)] gap-0 -mx-4 md:-mx-6 overflow-hidden">
      {/* Sessions sidebar */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="shrink-0 flex flex-col border-r border-border bg-card overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Conversations</h2>
              <button
                aria-label="Hide sidebar"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>

            <div className="px-3 py-2 border-b border-border">
              <Button size="sm" className="w-full h-8 text-xs" onClick={handleNewChat}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> New Chat
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5 scrollbar-thin">
              {sessionsLoading ? (
                <div className="space-y-1.5 px-1">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 px-3">
                  <MessageSquare className="h-7 w-7 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No conversations yet</p>
                </div>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.id}
                    className={cn(
                      'flex items-center justify-between rounded-lg px-3 py-2.5 cursor-pointer transition-colors group',
                      s.id === activeSessionId
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent text-foreground',
                    )}
                    onClick={() => {
                      setActiveSessionId(s.id)
                      navigate(`/chat/${s.id}`)
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate leading-tight">{s.title || 'New Chat'}</p>
                      <p className={cn(
                        'text-xs truncate mt-0.5',
                        s.id === activeSessionId ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      )}>
                        {formatDateRelative(s.updated_at)}
                      </p>
                    </div>
                    <button
                      aria-label="Delete chat"
                      className="opacity-0 group-hover:opacity-100 ml-1.5 shrink-0 p-1 rounded hover:bg-black/10 transition-all"
                      onClick={(e) => { e.stopPropagation(); setDeleteId(s.id) }}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat area */}
      <div className="flex flex-1 flex-col overflow-hidden bg-background min-w-0">
        {/* Chat header bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card/50 shrink-0">
          {!sidebarOpen && (
            <button
              aria-label="Show sidebar"
              onClick={() => setSidebarOpen(true)}
              className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {activeSessionId
                ? sessions.find((s) => s.id === activeSessionId)?.title || 'Chat'
                : 'New Conversation'}
            </p>
          </div>
          {/* Mode toggle */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            {(['rag', 'general'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                  mode === m
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m === 'rag' ? 'Document Mode' : 'General'}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4">
          <div className="py-4 max-w-3xl mx-auto">
            {allMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-6 py-16">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
                  <MessageSquare className="h-7 w-7 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold">Start a conversation</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                    Ask me anything about your study materials or any topic
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center max-w-md">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setMessage(s)}
                      className="rounded-full border border-border bg-card text-foreground px-3.5 py-1.5 text-xs font-medium hover:bg-accent hover:border-accent-foreground/20 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <AnimatePresence initial={false}>
                  {allMessages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                    >
                      {msg.role === 'assistant' && (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 mr-2.5 mt-1 select-none">
                          <span className="text-xs font-semibold text-primary">AI</span>
                        </div>
                      )}
                      <div
                        className={cn(
                          'max-w-[78%] rounded-2xl px-4 py-3',
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-br-sm shadow-sm'
                            : 'bg-card text-card-foreground border border-border rounded-bl-sm shadow-sm',
                        )}
                      >
                        {msg.role === 'assistant' ? (
                          <div className="prose-chat">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.content}
                            </ReactMarkdown>
                            {msg.citations && <CitationsPanel citations={msg.citations} />}
                          </div>
                        ) : (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {isTyping && <TypingIndicator />}

                {/* Follow-up suggestions after last AI message */}
                {!isTyping && suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-wrap gap-2 pl-10"
                  >
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestionClick(s)}
                        className="rounded-full border border-border bg-card text-foreground px-3.5 py-1.5 text-xs font-medium hover:bg-accent hover:border-accent-foreground/20 transition-colors text-left"
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

        {/* Input area */}
        <div className="border-t border-border bg-card/50 px-4 py-3 space-y-2.5 shrink-0">
          {mode === 'rag' && (
            <DocumentSelector value={docIds} onChange={setDocIds} placeholder="Select documents for context..." />
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your study material..."
              rows={1}
              className={cn(
                'flex-1 min-h-[44px] max-h-36 resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                'placeholder:text-muted-foreground transition-shadow',
                'scrollbar-thin',
              )}
              style={{ height: '44px' }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement
                t.style.height = '44px'
                t.style.height = `${Math.min(t.scrollHeight, 144)}px`
              }}
            />
            {isSupported && (
              <Button
                variant={isListening ? 'destructive' : 'outline'}
                size="icon"
                className="h-11 w-11 rounded-xl shrink-0"
                onClick={isListening ? stopListening : startListening}
                title={isListening ? 'Stop recording' : 'Start voice input'}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            )}
            <Button
              className="h-11 px-4 rounded-xl shrink-0"
              onClick={() => handleSend()}
              disabled={!message.trim() || isTyping}
              title="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Press <kbd className="font-mono text-xs bg-muted border border-border rounded px-1">Enter</kbd> to send,{' '}
            <kbd className="font-mono text-xs bg-muted border border-border rounded px-1">Shift+Enter</kbd> for new line
          </p>
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
