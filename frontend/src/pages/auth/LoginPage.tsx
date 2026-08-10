import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Sparkles, BookOpen, Brain, Zap } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BrandMark } from '@/components/shared/BrandLogo'
import { toast } from 'sonner'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().optional(),
})

type FormData = z.infer<typeof schema>

const features = [
  { icon: Brain, label: 'AI-Powered Quizzes', desc: 'Auto-generate quizzes from your notes' },
  { icon: BookOpen, label: 'Smart Flashcards', desc: 'Spaced repetition that actually works' },
  { icon: Zap, label: 'Instant Summaries', desc: 'Condense any document in seconds' },
]

export function LoginPage() {
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      await login(data.email, data.password, data.remember ?? false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid credentials'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-background">

      {/* ── Left panel — branded ── */}
      <div
        className="hidden lg:flex lg:w-[52%] flex-col justify-between p-12 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, hsl(168 76% 20%) 0%, hsl(258 70% 35%) 60%, hsl(320 65% 32%) 100%)',
        }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />
        <div className="absolute top-1/2 left-1/4 h-48 w-48 rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20">
            <BrandMark className="h-7 w-7 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold text-white tracking-tight">
              Study<span className="opacity-70">Buddy</span>{' '}
              <span className="text-sm font-extrabold bg-gradient-to-r from-teal-300 to-pink-300 bg-clip-text text-transparent">AI</span>
            </span>
            <p className="text-xs text-white/50 -mt-0.5">Learn smarter with AI</p>
          </div>
        </div>

        {/* Hero copy */}
        <div className="relative space-y-8">
          <div>
            <div className="flex items-center gap-2 text-white/60 text-sm mb-3">
              <Sparkles className="h-4 w-4" />
              <span>AI-Powered Learning Platform</span>
            </div>
            <h2 className="text-4xl font-bold text-white leading-tight">
              Study smarter,<br />
              <span className="bg-gradient-to-r from-teal-300 via-violet-300 to-pink-300 bg-clip-text text-transparent">
                not harder.
              </span>
            </h2>
            <p className="text-white/65 mt-3 text-base leading-relaxed max-w-sm">
              Upload your study materials and let AI turn them into quizzes, flashcards, summaries, and more — instantly.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-4">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 border border-white/15">
                  <Icon className="h-4 w-4 text-white/80" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="text-xs text-white/55 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer quote */}
        <p className="relative text-xs text-white/35 italic">
          "The secret of getting ahead is getting started." — Mark Twain
        </p>
      </div>

      {/* ── Right panel — login form ── */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-sm"
        >
          {/* Mobile-only logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary">
                <BrandMark className="h-7 w-7 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight tracking-tight">
                  Study<span className="opacity-70">Buddy</span>{' '}
                  <span className="text-sm font-extrabold bg-gradient-to-r from-teal-400 to-violet-400 bg-clip-text text-transparent">AI</span>
                </h1>
                <p className="text-xs text-muted-foreground">Learn smarter with AI</p>
              </div>
            </div>
          </div>

          <Card className="border-border/60 shadow-xl">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-xl tracking-tight">Welcome back</CardTitle>
              <CardDescription>Sign in to continue learning</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  label="Email address"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  error={errors.email?.message}
                  {...register('email')}
                />

                <div className="relative">
                  <Input
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    error={errors.password?.message}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-8 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input type="checkbox" {...register('remember')} className="rounded border-border" />
                    <span className="text-foreground">Remember me</span>
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-sm text-primary hover:underline font-medium"
                  >
                    Forgot password?
                  </Link>
                </div>

                <Button type="submit" className="w-full h-10 rounded-full" loading={loading}>
                  Sign In
                </Button>
              </form>

              <p className="mt-5 text-center text-sm text-muted-foreground">
                Don't have an account?{' '}
                <Link to="/register" className="text-primary font-medium hover:underline">
                  Create one
                </Link>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
