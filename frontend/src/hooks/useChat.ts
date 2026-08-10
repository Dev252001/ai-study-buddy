import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { chatApi, getErrorMessage, type SendMessageRequest } from '@/lib/api'
import { toast } from 'sonner'

const SESSIONS_KEY = 'chat-sessions'
const MESSAGES_KEY = 'chat-messages'

export function useChatSessions() {
  return useQuery({
    queryKey: [SESSIONS_KEY],
    queryFn: chatApi.listSessions,
    staleTime: 0,
  })
}

export function useChatSession(id: string | undefined) {
  return useQuery({
    queryKey: [SESSIONS_KEY, id],
    queryFn: () => chatApi.getSession(id!),
    enabled: !!id,
    retry: false,
  })
}

export function useChatMessages(sessionId: string | undefined) {
  return useQuery({
    queryKey: [MESSAGES_KEY, sessionId],
    queryFn: () => chatApi.getMessages(sessionId!),
    enabled: !!sessionId,
    retry: false,
  })
}

export function useCreateSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { title?: string; document_ids?: string[] }) =>
      chatApi.createSession(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SESSIONS_KEY] }),
  })
}

export function useDeleteSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => chatApi.deleteSession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SESSIONS_KEY] })
      toast.success('Chat session deleted')
    },
    onError: (err: Error) => toast.error(getErrorMessage(err, 'Failed to delete session')),
  })
}

export function useSendMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SendMessageRequest) => chatApi.sendMessage(data),
    onSuccess: (_, vars) => {
      if (vars.session_id) {
        qc.invalidateQueries({ queryKey: [MESSAGES_KEY, vars.session_id] })
      }
    },
    onError: (err: Error) => toast.error(getErrorMessage(err, 'Failed to send message')),
  })
}
