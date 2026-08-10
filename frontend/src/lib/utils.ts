import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'MMM dd, yyyy')
}

export function formatDateRelative(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return formatDistanceToNow(d, { addSuffix: true })
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'MMM dd, yyyy HH:mm')
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

export function getFileTypeColor(fileType: string): string {
  const type = fileType.toLowerCase()
  switch (type) {
    case 'pdf': return 'text-red-500'
    case 'docx': case 'doc': return 'text-blue-500'
    case 'pptx': case 'ppt': return 'text-orange-500'
    case 'txt': return 'text-gray-500'
    case 'md': return 'text-purple-500'
    default: return 'text-gray-500'
  }
}

export function getFileTypeLabel(fileType: string): string {
  const type = fileType.toLowerCase()
  switch (type) {
    case 'pdf': return 'PDF'
    case 'docx': case 'doc': return 'Word'
    case 'pptx': case 'ppt': return 'PowerPoint'
    case 'txt': return 'Text'
    case 'md': return 'Markdown'
    default: return fileType.toUpperCase()
  }
}

export function getDifficultyColor(difficulty: string): string {
  switch (difficulty) {
    case 'easy': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
    case 'medium': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
    case 'hard': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
    default: return 'text-muted-foreground bg-muted'
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'ready': return 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
    case 'processing': return 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
    case 'pending': return 'text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
    case 'failed': return 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
    default: return 'text-muted-foreground bg-muted'
  }
}

export function generateInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ─── Weekly Study Hours ────────────────────────────────────────────────────────

export const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

const DAY_ABBR: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
  Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
}

/** Converts a raw weekly_hours array from the API into a Mon–Sun chart-ready array. */
export function buildWeeklyChartData(
  weeklyHours: Array<{ date: string; hours: number }> | undefined,
): Array<{ day: string; hours: number }> {
  const hoursByDay: Record<string, number> = {}
  if (weeklyHours) {
    for (const entry of weeklyHours) {
      if (entry && typeof entry === 'object' && entry.date) {
        const d = new Date(`${entry.date}T12:00:00`)
        const dayName = d.toLocaleDateString('en-US', { weekday: 'long' })
        const abbr = DAY_ABBR[dayName] ?? dayName.slice(0, 3)
        hoursByDay[abbr] = (hoursByDay[abbr] ?? 0) + (entry.hours ?? 0)
      }
    }
  }
  return WEEK_DAYS.map((day) => ({ day, hours: hoursByDay[day] ?? 0 }))
}
