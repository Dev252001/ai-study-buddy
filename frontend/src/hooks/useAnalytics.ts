import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { analyticsApi } from '@/lib/api'
import { toast } from 'sonner'

const ANALYTICS_KEY = 'analytics'
const PROGRESS_KEY = 'analytics-progress'

export function useAnalytics() {
  return useQuery({
    queryKey: [ANALYTICS_KEY],
    queryFn: analyticsApi.get,
  })
}

export function useProgress() {
  return useQuery({
    queryKey: [PROGRESS_KEY],
    queryFn: analyticsApi.getProgress,
  })
}

export function useUpdateGoals() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { daily_goal_hours?: number; weekly_goal_hours?: number }) =>
      analyticsApi.updateGoals(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [ANALYTICS_KEY] })
      toast.success('Goals saved')
    },
    onError: () => toast.error('Failed to save goals'),
  })
}
