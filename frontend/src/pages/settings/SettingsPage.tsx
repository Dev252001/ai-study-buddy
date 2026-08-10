import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Shield, Palette, UserCircle, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { authApi } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'

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

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const [passwordLoading, setPasswordLoading] = useState(false)

  const {
    register: rw,
    handleSubmit: hw,
    reset: resetPw,
    formState: { errors: ew },
  } = useForm<PasswordData>({ resolver: zodResolver(passwordSchema) })

  const onChangePassword = async (data: PasswordData) => {
    setPasswordLoading(true)
    try {
      await authApi.changePassword({ current_password: data.current_password, new_password: data.new_password })
      toast.success('Password changed successfully')
      resetPw()
    } catch {
      toast.error('Failed to change password')
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl space-y-6">
      <PageHeader title="Settings" subtitle="Manage your account and preferences" />

      <Tabs defaultValue="preferences">
        <TabsList>
          <TabsTrigger value="preferences" className="gap-1"><Palette className="h-3.5 w-3.5" /> Preferences</TabsTrigger>
          <TabsTrigger value="security" className="gap-1"><Shield className="h-3.5 w-3.5" /> Security</TabsTrigger>
          <TabsTrigger value="profile" className="gap-1"><UserCircle className="h-3.5 w-3.5" /> Profile</TabsTrigger>
        </TabsList>

        {/* Preferences */}
        <TabsContent value="preferences" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
              <CardDescription>Customize your experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-medium text-sm">Theme</p>
                  <p className="text-xs text-muted-foreground">Choose your preferred colour scheme</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={theme === 'light' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('light')}
                  >
                    Light
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('dark')}
                  >
                    Dark
                  </Button>
                  <Button
                    variant={theme === 'system' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('system')}
                  >
                    System
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Keep your account secure with a strong password</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={hw(onChangePassword)} className="space-y-4">
                <Input
                  label="Current Password"
                  type="password"
                  error={ew.current_password?.message}
                  {...rw('current_password')}
                />
                <Input
                  label="New Password"
                  type="password"
                  error={ew.new_password?.message}
                  {...rw('new_password')}
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  error={ew.confirm_password?.message}
                  {...rw('confirm_password')}
                />
                <Button type="submit" loading={passwordLoading}>Change Password</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profile — link out to dedicated page */}
        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Edit your name, bio, and avatar on the Profile page</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => navigate('/profile')} className="gap-2">
                Go to Profile <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
