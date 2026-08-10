import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react'
import { authApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { BrandMark } from '@/components/shared/BrandLogo'

const schema = z.object({ email: z.string().email('Invalid email address') })
type FormData = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      await authApi.forgotPassword(data.email)
      setSubmitted(true)
    } catch {
      toast.error('Failed to send reset email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">

      {/* Subtle radial glow behind the card */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-primary/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="relative w-full max-w-md"
      >
        {/* Brand header */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <BrandMark className="h-10 w-10" />
          <span className="text-xl font-extrabold tracking-tight">StudyBuddy AI</span>
        </div>

        {/* Card */}
        <div className="rounded-3xl border bg-card shadow-lg overflow-hidden">
          {/* Top gradient bar */}
          <div className="h-1 w-full bg-gradient-to-r from-teal-500 via-violet-500 to-pink-500" />

          <div className="p-8">
            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="text-center py-4"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-400 mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-xl font-extrabold">Check your inbox!</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                  We've sent password reset instructions to your email address.
                </p>
                <Link to="/login" className="block mt-6">
                  <Button className="w-full">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
                  </Button>
                </Link>
              </motion.div>
            ) : (
              <>
                <div className="mb-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-400 mx-auto mb-4">
                    <Mail className="h-5 w-5 text-white" />
                  </div>
                  <h1 className="text-2xl font-extrabold">Reset your password</h1>
                  <p className="text-sm text-muted-foreground mt-1.5">
                    Enter your email and we'll send you reset instructions.
                  </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <Input
                    label="Email address"
                    type="email"
                    placeholder="you@example.com"
                    error={errors.email?.message}
                    {...register('email')}
                  />
                  <Button type="submit" className="w-full" loading={loading}>
                    Send Reset Link
                  </Button>
                </form>

                <div className="mt-5 text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Login
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tagline */}
        <p className="text-center text-xs text-muted-foreground mt-5">
          StudyBuddy AI — master your classes with AI
        </p>
      </motion.div>
    </div>
  )
}
