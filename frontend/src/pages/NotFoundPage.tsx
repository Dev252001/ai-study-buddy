import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 overflow-hidden">
      {/* Background glow */}
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute right-1/4 bottom-1/4 h-[400px] w-[400px] rounded-full bg-pink-500/6 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative text-center max-w-md w-full"
      >
        {/* Huge 404 */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative mb-6 select-none"
        >
          <span
            className="text-[9rem] font-black leading-none tracking-tighter"
            style={{
              background: 'linear-gradient(135deg, hsl(168 76% 36%), #8b5cf6, #ec4899)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            404
          </span>
        </motion.div>

        {/* SVG illustration — simple floating astronaut-like figure */}
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}
          className="mx-auto mb-6 w-24 h-24"
        >
          <svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Body */}
            <circle cx="48" cy="48" r="32" fill="url(#pg404)" opacity="0.15" />
            <circle cx="48" cy="48" r="22" fill="url(#pg404)" opacity="0.25" />
            <circle cx="48" cy="48" r="14" fill="url(#pg404)" />
            {/* Question mark */}
            <text x="48" y="55" textAnchor="middle" fontSize="18" fontWeight="900" fill="white" fontFamily="system-ui">?</text>
            <defs>
              <linearGradient id="pg404" x1="16" y1="16" x2="80" y2="80" gradientUnits="userSpaceOnUse">
                <stop stopColor="hsl(168 76% 36%)" />
                <stop offset="0.5" stopColor="#8b5cf6" />
                <stop offset="1" stopColor="#ec4899" />
              </linearGradient>
            </defs>
          </svg>
        </motion.div>

        <h1 className="text-2xl font-extrabold mb-2">Page not found</h1>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto leading-relaxed">
          The page you're looking for doesn't exist or may have been moved.
        </p>

        <div className="flex items-center justify-center gap-3 mt-8">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
          <Button onClick={() => navigate('/dashboard')}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
