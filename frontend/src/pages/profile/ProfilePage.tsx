import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Camera, FileText, MessageSquare, Brain, Clock, Flame, CalendarDays, ShieldCheck, Edit3, Save } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { authApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAnalytics } from '@/hooks/useAnalytics'
import { toast } from 'sonner'
import { formatDate, generateInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'

const schema = z.object({
  full_name: z.string().min(2),
  bio: z.string().optional(),
  avatar_url: z.string().url().optional().or(z.literal('')),
})
type FormData = z.infer<typeof schema>

const STAT_CONFIG = [
  { key: 'total_documents',       label: 'Documents',   icon: FileText,      from: 'from-blue-500',   to: 'to-cyan-500',   format: (v: number) => v },
  { key: 'total_questions_asked', label: 'AI Questions', icon: MessageSquare, from: 'from-violet-500', to: 'to-purple-500', format: (v: number) => v },
  { key: 'total_quizzes_taken',   label: 'Quizzes',     icon: Brain,         from: 'from-emerald-500',to: 'to-teal-500',   format: (v: number) => v },
  { key: 'total_study_hours',     label: 'Study Hours', icon: Clock,         from: 'from-amber-500',  to: 'to-orange-400', format: (v: number) => `${v.toFixed(1)}h` },
  { key: 'streak_days',           label: 'Day Streak',  icon: Flame,         from: 'from-rose-500',   to: 'to-pink-500',   format: (v: number) => v },
] as const

export function ProfilePage() {
  const { user, updateUser } = useAuth()
  const { data: analytics } = useAnalytics()
  const [loading, setLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name:  user?.full_name  ?? '',
      bio:        user?.bio        ?? '',
      avatar_url: user?.avatar_url ?? '',
    },
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const updated = await authApi.updateMe(data)
      updateUser(updated)
      toast.success('Profile updated!')
      setEditMode(false)
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string
      try {
        const updated = await authApi.updateMe({ avatar_url: dataUrl })
        updateUser(updated)
        toast.success('Avatar updated!')
      } catch {
        toast.error('Failed to update avatar')
      }
    }
    reader.readAsDataURL(file)
  }

  if (!user) return null

  const initials = generateInitials(user.full_name || user.username)

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl space-y-5">

      {/* ── Profile hero card ── */}
      <Card className="overflow-hidden">
        {/* Gradient cover banner */}
        <div
          className="h-28 w-full relative"
          style={{ background: 'linear-gradient(135deg, hsl(168 76% 28%), #8b5cf6 60%, #ec4899)' }}
        >
          {/* Dot-grid texture */}
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />
        </div>

        <CardContent className="px-6 pb-6">
          {/* Avatar — overlaps banner */}
          <div className="flex items-end justify-between -mt-12 mb-4">
            <div className="relative">
              {/* Gradient ring */}
              <div className="h-[88px] w-[88px] rounded-full p-[3px] bg-gradient-to-br from-teal-400 via-violet-500 to-pink-500 shadow-lg">
                <Avatar className="h-full w-full border-[3px] border-card">
                  <AvatarImage src={user.avatar_url || undefined} />
                  <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-teal-500 to-violet-500 text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-violet-500 text-white shadow-md hover:opacity-90 transition-opacity border-2 border-card"
                aria-label="Change avatar"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Edit toggle */}
            <button
              onClick={() => setEditMode(!editMode)}
              className={cn(
                'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all',
                editMode
                  ? 'border-primary/40 bg-primary/8 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'
              )}
            >
              <Edit3 className="h-3.5 w-3.5" />
              {editMode ? 'Cancel' : 'Edit Profile'}
            </button>
          </div>

          {/* Name + meta */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-extrabold text-foreground">{user.full_name || user.username}</h2>
              {user.is_admin && (
                <span className="flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 px-2 py-0.5 text-xs font-semibold">
                  <ShieldCheck className="h-3 w-3" /> Admin
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">@{user.username} · {user.email}</p>
            {user.bio && (
              <p className="text-sm text-muted-foreground leading-relaxed pt-1 max-w-lg">{user.bio}</p>
            )}
            <div className="flex items-center gap-1.5 pt-1">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/60" />
              <span className="text-xs text-muted-foreground">Member since {formatDate(user.created_at)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Stats row ── */}
      {analytics && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {STAT_CONFIG.map(({ key, label, icon: Icon, from, to, format }) => {
            const raw = (analytics as unknown as Record<string, number>)[key] ?? 0
            return (
              <Card key={key} className="overflow-hidden">
                <div className={cn('h-1 w-full bg-gradient-to-r', from, to)} />
                <CardContent className="p-4 text-center">
                  <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br mx-auto mb-2', from, to)}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <p className="text-xl font-extrabold tabular-nums">{format(raw)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Edit form ── */}
      {editMode && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-violet-500">
                  <Edit3 className="h-3.5 w-3.5 text-white" />
                </div>
                Edit Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Full Name"
                    error={errors.full_name?.message}
                    {...register('full_name')}
                  />
                  <Input
                    label="Avatar URL"
                    type="url"
                    placeholder="https://…"
                    error={errors.avatar_url?.message}
                    {...register('avatar_url')}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Bio</label>
                  <textarea
                    placeholder="Tell others about yourself…"
                    rows={3}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none transition-shadow"
                    {...register('bio')}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="submit" loading={loading} className="gap-2">
                    <Save className="h-4 w-4" /> Save Changes
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEditMode(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Account info strip ── */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
            {[
              { label: 'Username',   value: `@${user.username}` },
              { label: 'Email',      value: user.email           },
              { label: 'Account ID', value: `#${user.id?.toString().padStart(6, '0') ?? '—'}` },
            ].map(({ label, value }) => (
              <div key={label} className="py-3 sm:py-0 sm:px-4 first:pt-0 last:pb-0 sm:first:pl-0 sm:last:pr-0">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
                <p className="text-sm font-semibold text-foreground mt-0.5 truncate">{value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    </motion.div>
  )
}
