import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Camera } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { authApi } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useAnalytics } from '@/hooks/useAnalytics'
import { toast } from 'sonner'
import { formatDate, generateInitials } from '@/lib/utils'

const schema = z.object({
  full_name: z.string().min(2),
  bio: z.string().optional(),
  avatar_url: z.string().url().optional().or(z.literal('')),
})
type FormData = z.infer<typeof schema>

export function ProfilePage() {
  const { user, updateUser } = useAuth()
  const { data: analytics } = useAnalytics()
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: user?.full_name ?? '',
      bio: user?.bio ?? '',
      avatar_url: user?.avatar_url ?? '',
    },
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const updated = await authApi.updateMe(data)
      updateUser(updated)
      toast.success('Profile updated!')
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

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl space-y-6">
      <PageHeader title="Profile" subtitle="Your public profile and account information" />

      {/* Profile header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-5 flex-wrap sm:flex-nowrap">
            <div className="relative shrink-0">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user.avatar_url || undefined} />
                <AvatarFallback className="text-xl font-semibold bg-primary/10 text-primary">
                  {generateInitials(user.full_name || user.username)}
                </AvatarFallback>
              </Avatar>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFile}
              />
              <button
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
                aria-label="Change avatar"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-bold leading-snug">{user.full_name || user.username}</h3>
              <p className="text-muted-foreground text-sm mt-0.5">@{user.username}</p>
              <p className="text-muted-foreground text-sm">{user.email}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="secondary" className="text-xs font-normal">
                  Member since {formatDate(user.created_at)}
                </Badge>
                {user.is_admin && <Badge className="text-xs">Admin</Badge>}
              </div>
            </div>
          </div>

          {user.bio && (
            <>
              <Separator className="my-4" />
              <p className="text-sm text-muted-foreground leading-relaxed">{user.bio}</p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      {analytics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Documents', value: analytics.total_documents },
            { label: 'AI Questions', value: analytics.total_questions_asked },
            { label: 'Quizzes', value: analytics.total_quizzes_taken },
            { label: 'Study Hours', value: `${analytics.total_study_hours.toFixed(1)}h` },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold tabular-nums">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Edit Profile</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input label="Full Name" error={errors.full_name?.message} {...register('full_name')} />
            <Input label="Bio" placeholder="Tell others about yourself" {...register('bio')} />
            <Input label="Avatar URL" type="url" placeholder="https://..." error={errors.avatar_url?.message} {...register('avatar_url')} />
            <Button type="submit" loading={loading}>Save Changes</Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  )
}
