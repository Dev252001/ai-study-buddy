import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, Palette, UserCircle, Settings,
  Sun, Moon, Monitor, Check, Eye, EyeOff, Lock, Bell,
  Globe, Keyboard, ChevronRight,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { authApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { generateInitials } from '@/lib/utils'

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

type PasswordData = z.infer<typeof passwordSchema>
type Tab = 'preferences' | 'security' | 'profile'

const TABS: { id: Tab; label: string; icon: React.ElementType; gradient: string; desc: string }[] = [
  { id: 'preferences', label: 'Preferences', icon: Palette,    gradient: 'from-teal-500 to-violet-500',  desc: 'Theme & display'  },
  { id: 'security',    label: 'Security',    icon: Shield,     gradient: 'from-rose-500 to-pink-500',    desc: 'Password & access' },
  { id: 'profile',     label: 'Profile',     icon: UserCircle, gradient: 'from-blue-500 to-cyan-500',    desc: 'Name, bio & avatar' },
]

const THEME_OPTIONS = [
  { id: 'light',  label: 'Light',  icon: Sun,     desc: 'Warm ivory tones'   },
  { id: 'dark',   label: 'Dark',   icon: Moon,    desc: 'Deep slate palette'  },
  { id: 'system', label: 'System', icon: Monitor, desc: 'Follow OS setting'   },
] as const

// Password strength checker
function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ chars',  pass: password.length >= 8 },
    { label: 'Uppercase', pass: /[A-Z]/.test(password) },
    { label: 'Number',    pass: /\d/.test(password) },
    { label: 'Symbol',    pass: /[!@#$%^&*]/.test(password) },
  ]
  const strength = checks.filter((c) => c.pass).length
  const gradients = [
    'from-red-500 to-red-400',
    'from-orange-500 to-amber-400',
    'from-yellow-500 to-lime-400',
    'from-emerald-500 to-teal-400',
  ]
  const labels = ['Weak', 'Fair', 'Good', 'Strong']
  const gradient = gradients[strength - 1] || ''

  if (!password) return null

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex gap-1 flex-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={cn('h-1.5 flex-1 rounded-full transition-all duration-300',
              i <= strength ? `bg-gradient-to-r ${gradient}` : 'bg-muted'
            )} />
          ))}
        </div>
        {strength > 0 && (
          <span className="text-xs font-medium text-muted-foreground">{labels[strength - 1]}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {checks.map((c) => (
          <span key={c.label} className={cn('flex items-center gap-1 text-xs transition-colors',
            c.pass ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
          )}>
            <Check className={cn('h-3 w-3', c.pass ? 'opacity-100' : 'opacity-20')} />
            {c.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab]     = useState<Tab>('preferences')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew]         = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [newPassword, setNewPassword] = useState('')

  const { register: rw, handleSubmit: hw, reset: resetPw, formState: { errors: ew } } = useForm<PasswordData>({
    resolver: zodResolver(passwordSchema),
  })

  const onChangePassword = async (data: PasswordData) => {
    setPasswordLoading(true)
    try {
      await authApi.changePassword({ current_password: data.current_password, new_password: data.new_password })
      toast.success('Password changed successfully')
      resetPw()
      setNewPassword('')
    } catch {
      toast.error('Failed to change password')
    } finally {
      setPasswordLoading(false)
    }
  }

  const initials = user ? generateInitials(user.full_name || user.username) : '??'

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-violet-500 shadow-sm">
          <Settings className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-foreground">Settings</h1>
          <p className="text-xs text-muted-foreground">Manage your account and preferences</p>
        </div>
      </div>

      <div className="flex gap-5 items-start">
        {/* Sidebar nav */}
        <div className="flex flex-col gap-1 w-48 shrink-0">
          {TABS.map(({ id, label, icon: Icon, gradient, desc }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-all group',
                activeTab === id
                  ? 'bg-gradient-to-r ' + gradient + ' text-white shadow-sm'
                  : 'hover:bg-muted/60 text-foreground'
              )}
            >
              <div className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all',
                activeTab === id
                  ? 'bg-white/20'
                  : 'bg-muted group-hover:bg-muted/80'
              )}>
                <Icon className={cn('h-4 w-4', activeTab === id ? 'text-white' : 'text-muted-foreground')} />
              </div>
              <div className="min-w-0">
                <p className={cn('text-sm font-semibold leading-none', activeTab === id ? 'text-white' : 'text-foreground')}>{label}</p>
                <p className={cn('text-xs mt-0.5 leading-none', activeTab === id ? 'text-white/70' : 'text-muted-foreground')}>{desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {activeTab === 'preferences' && (
              <motion.div key="preferences" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }} className="space-y-4">

                {/* Theme */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Palette className="h-4 w-4 text-primary" /> Appearance
                    </CardTitle>
                    <CardDescription>Choose how StudyBuddy AI looks on your screen</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-3">
                      {THEME_OPTIONS.map(({ id, label, icon: Icon, desc }) => (
                        <button
                          key={id}
                          onClick={() => setTheme(id)}
                          className={cn(
                            'flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all',
                            theme === id
                              ? 'border-primary bg-primary/8 ring-1 ring-primary/30'
                              : 'border-border hover:border-primary/30 hover:bg-muted/50'
                          )}
                        >
                          <div className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-xl transition-all',
                            theme === id
                              ? 'bg-gradient-to-br from-teal-500 to-violet-500 text-white shadow-sm'
                              : 'bg-muted text-muted-foreground'
                          )}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className={cn('text-sm font-semibold', theme === id ? 'text-primary' : 'text-foreground')}>{label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                          </div>
                          {theme === id && (
                            <span className="flex items-center gap-1 rounded-full bg-primary/15 text-primary px-2 py-0.5 text-xs font-semibold">
                              <Check className="h-3 w-3" /> Active
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Keyboard shortcuts info */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Keyboard className="h-4 w-4 text-primary" /> Keyboard Shortcuts
                    </CardTitle>
                    <CardDescription>Handy shortcuts available across the app</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {[
                        { keys: ['A', 'B', 'C', 'D'], desc: 'Select MCQ option during a quiz' },
                        { keys: ['←', '→'],           desc: 'Navigate quiz questions'          },
                        { keys: ['Space'],             desc: 'Flip a flashcard'                 },
                        { keys: ['Y'],                 desc: 'Mark flashcard as correct'        },
                        { keys: ['N'],                 desc: 'Mark flashcard as incorrect'      },
                        { keys: ['Esc'],               desc: 'Close dropdowns / dismiss menus'  },
                      ].map(({ keys, desc }) => (
                        <div key={desc} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors">
                          <span className="text-sm text-muted-foreground">{desc}</span>
                          <div className="flex items-center gap-1">
                            {keys.map((k) => (
                              <kbd key={k} className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs font-mono font-semibold text-foreground">{k}</kbd>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Language / Region (informational) */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Language & Region</p>
                          <p className="text-xs text-muted-foreground">English (US) · UTC+0</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground font-medium">Auto-detected</span>
                    </div>
                  </CardContent>
                </Card>

              </motion.div>
            )}

            {activeTab === 'security' && (
              <motion.div key="security" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }} className="space-y-4">

                {/* Change password */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lock className="h-4 w-4 text-primary" /> Change Password
                    </CardTitle>
                    <CardDescription>Keep your account secure with a strong, unique password</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={hw(onChangePassword)} className="space-y-4">
                      {/* Current password */}
                      <div className="relative">
                        <Input
                          label="Current Password"
                          type={showCurrent ? 'text' : 'password'}
                          error={ew.current_password?.message}
                          {...rw('current_password')}
                        />
                        <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                          className="absolute right-3 top-8 text-muted-foreground hover:text-foreground transition-colors">
                          {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>

                      {/* New password with strength */}
                      <div className="relative">
                        <Input
                          label="New Password"
                          type={showNew ? 'text' : 'password'}
                          error={ew.new_password?.message}
                          {...rw('new_password', { onChange: (e) => setNewPassword(e.target.value) })}
                        />
                        <button type="button" onClick={() => setShowNew(!showNew)}
                          className="absolute right-3 top-8 text-muted-foreground hover:text-foreground transition-colors">
                          {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <PasswordStrength password={newPassword} />
                      </div>

                      {/* Confirm password */}
                      <div className="relative">
                        <Input
                          label="Confirm New Password"
                          type={showConfirm ? 'text' : 'password'}
                          error={ew.confirm_password?.message}
                          {...rw('confirm_password')}
                        />
                        <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                          className="absolute right-3 top-8 text-muted-foreground hover:text-foreground transition-colors">
                          {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>

                      <Button type="submit" loading={passwordLoading} className="gap-2">
                        <Lock className="h-4 w-4" /> Update Password
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* Security tips */}
                <Card className="bg-gradient-to-br from-rose-500/5 to-pink-500/5 border-rose-500/20">
                  <CardContent className="p-4 space-y-2.5">
                    <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-widest">Security tips</p>
                    {[
                      'Use a unique password not used on other sites',
                      'Include uppercase letters, numbers, and symbols',
                      'Avoid using personal information like your name or birthdate',
                      'Consider using a password manager to store credentials safely',
                    ].map((tip) => (
                      <div key={tip} className="flex items-start gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                        <p className="text-xs text-muted-foreground leading-relaxed">{tip}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Account actions */}
                <Card>
                  <CardContent className="p-4 space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Account</p>
                    {[
                      { label: 'Two-factor authentication', desc: 'Add an extra layer of security', badge: 'Coming soon' },
                      { label: 'Active sessions',           desc: 'Manage where you\'re logged in',  badge: 'Coming soon' },
                    ].map(({ label, desc, badge }) => (
                      <div key={label} className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors">
                        <div>
                          <p className="text-sm font-medium text-foreground">{label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                        </div>
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground font-medium whitespace-nowrap">{badge}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {activeTab === 'profile' && (
              <motion.div key="profile" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }} className="space-y-4">

                {/* Mini profile preview card */}
                {user && (
                  <Card className="overflow-hidden">
                    <div className="h-16 bg-gradient-to-r from-teal-500 via-violet-500 to-pink-500" />
                    <CardContent className="px-5 pb-5">
                      <div className="flex items-end gap-4 -mt-8 mb-3">
                        <div className="h-16 w-16 rounded-full p-[3px] bg-gradient-to-br from-teal-400 to-violet-500 shadow-md">
                          <Avatar className="h-full w-full border-2 border-card">
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback className="bg-gradient-to-br from-teal-500 to-violet-500 text-white font-bold">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <div className="pb-1">
                          <p className="font-bold text-foreground">{user.full_name || user.username}</p>
                          <p className="text-xs text-muted-foreground">@{user.username}</p>
                        </div>
                      </div>
                      {user.bio && <p className="text-sm text-muted-foreground leading-relaxed">{user.bio}</p>}
                    </CardContent>
                  </Card>
                )}

                {/* Go to full profile */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-sm">
                          <UserCircle className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">Edit full profile</p>
                          <p className="text-xs text-muted-foreground">Update name, bio, and avatar photo</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigate('/profile')} className="gap-1.5 shrink-0">
                        Open <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Notifications (informational) */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Bell className="h-4 w-4 text-primary" /> Notifications
                    </CardTitle>
                    <CardDescription>Control what updates you receive</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {[
                      { label: 'Study streak reminders', desc: 'Daily nudge to keep your streak alive' },
                      { label: 'Quiz results summary',   desc: 'Email recap when you finish a quiz'    },
                      { label: 'New feature updates',    desc: 'Be the first to know what\'s new'      },
                    ].map(({ label, desc }) => (
                      <div key={label} className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors">
                        <div>
                          <p className="text-sm font-medium">{label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                        </div>
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">Coming soon</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
