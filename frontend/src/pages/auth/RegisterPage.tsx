import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Check, Zap, BookOpen, Brain } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { BrandMark } from '@/components/shared/BrandLogo'

const schema = z
  .object({
    full_name: z.string().min(2, 'Full name must be at least 2 characters'),
    username: z.string().min(3, 'Username must be at least 3 characters').regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers, underscores only'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type FormData = z.infer<typeof schema>

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ chars', pass: password.length >= 8 },
    { label: 'Uppercase', pass: /[A-Z]/.test(password) },
    { label: 'Number', pass: /\d/.test(password) },
    { label: 'Symbol', pass: /[!@#$%^&*]/.test(password) },
  ]
  const strength = checks.filter((c) => c.pass).length
  const gradients = [
    'from-red-500 to-red-400',
    'from-orange-500 to-amber-400',
    'from-yellow-500 to-lime-400',
    'from-emerald-500 to-teal-400',
  ]
  const gradient = gradients[strength - 1] || ''

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={cn('h-1 flex-1 rounded-full transition-all duration-300',
            i <= strength ? `bg-gradient-to-r ${gradient}` : 'bg-muted'
          )} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {checks.map((c) => (
          <span key={c.label} className={cn('flex items-center gap-1 text-xs transition-colors',
            c.pass ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
          )}>
            <Check className={cn('h-3 w-3', c.pass ? 'opacity-100' : 'opacity-30')} />
            {c.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function RegisterPage() {
  const { register: registerUser } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const password = watch('password', '')

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      await registerUser({ full_name: data.full_name, username: data.username, email: data.email, password: data.password })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left hero panel */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-10 bg-gradient-to-br from-[hsl(168,76%,20%)] via-[hsl(258,70%,38%)] to-[hsl(330,70%,40%)] relative overflow-hidden">
        {/* Decorative grid */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`,
            backgroundSize: '28px 28px',
          }}
        />
        {/* Brand */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
            <BrandMark className="h-6 w-6 text-white" />
          </div>
          <span className="text-lg font-bold text-white">Learnify AI</span>
        </div>

        {/* Hero copy */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-3xl font-extrabold text-white leading-tight">
              Join thousands of<br />students studying smarter.
            </h2>
            <p className="text-white/70 mt-3 text-sm leading-relaxed">
              Create your free account and start turning any document into quizzes, flashcards, summaries, and mind maps in seconds.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { icon: Zap, label: 'Instant AI quiz generation', sub: 'MCQ, True/False, Short Answer & more' },
              { icon: BookOpen, label: 'Smart flashcards with spaced repetition', sub: 'Adaptive review that actually works' },
              { icon: Brain, label: 'AI Explainer & Summarizer', sub: 'Complex concepts made simple, fast' },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="text-xs text-white/60">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quote */}
        <div className="relative z-10 rounded-2xl bg-white/10 border border-white/20 p-5">
          <p className="text-sm text-white/80 italic leading-relaxed">
            "I went from barely passing to top of my class in one semester. Learnify made everything click."
          </p>
          <p className="text-xs text-white/50 mt-2 font-medium">— Aisha K., Computer Science student</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-sm"
        >
          {/* Mobile brand */}
          <div className="flex justify-center mb-7 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-violet-500">
                <BrandMark className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-foreground">Learnify AI</span>
            </div>
          </div>

          <div className="mb-7">
            <h1 className="text-2xl font-extrabold text-foreground">Create your account</h1>
            <p className="text-sm text-muted-foreground mt-1">Start your AI-powered learning journey today — it's free.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Full Name"
              placeholder="Jane Smith"
              autoComplete="name"
              error={errors.full_name?.message}
              {...register('full_name')}
            />
            <Input
              label="Username"
              placeholder="janesmith"
              autoComplete="username"
              error={errors.username?.message}
              {...register('username')}
            />
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
                placeholder="Create a strong password"
                autoComplete="new-password"
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
              {password && <PasswordStrength password={password} />}
            </div>
            <Input
              label="Confirm Password"
              type="password"
              placeholder="Confirm your password"
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />

            <Button type="submit" className="w-full h-11 text-sm font-semibold" loading={loading}>
              Create Account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-semibold hover:underline underline-offset-2">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
