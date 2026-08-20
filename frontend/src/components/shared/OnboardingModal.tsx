import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Brain, CreditCard, ArrowRight, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const ONBOARDING_KEY = 'studybuddyai_onboarded'

const steps = [
  {
    icon: FileText,
    gradient: 'from-teal-400 to-cyan-500',
    title: 'Upload your study material',
    desc: 'Drag & drop a PDF, DOCX, or PPTX. Our AI reads it and makes it searchable, summarizable, and quizzable instantly.',
    cta: 'Upload a Document',
    to: '/documents',
    color: 'teal',
  },
  {
    icon: Brain,
    gradient: 'from-violet-500 to-purple-600',
    title: 'Generate your first quiz',
    desc: 'Select any uploaded document and let AI create MCQ, True/False, or short-answer questions in seconds.',
    cta: 'Generate a Quiz',
    to: '/quiz/generate',
    color: 'violet',
  },
  {
    icon: CreditCard,
    gradient: 'from-blue-500 to-cyan-500',
    title: 'Study with Flashcards',
    desc: 'AI-generated spaced-repetition cards from your notes. Flip, mark as known or unknown, track your progress.',
    cta: 'Create Flashcards',
    to: '/flashcards',
    color: 'blue',
  },
]

interface OnboardingModalProps {
  open: boolean
  onClose: () => void
}

export function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()

  const handleCta = () => {
    localStorage.setItem(ONBOARDING_KEY, '1')
    onClose()
    navigate(steps[step].to)
  }

  const handleSkip = () => {
    localStorage.setItem(ONBOARDING_KEY, '1')
    onClose()
  }

  const handleNext = () => {
    if (step < steps.length - 1) setStep(s => s + 1)
  }

  const handlePrev = () => {
    if (step > 0) setStep(s => s - 1)
  }

  if (!open) return null

  const current = steps[step]
  const Icon = current.icon

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleSkip}
        />

        {/* Modal */}
        <motion.div
          key={step}
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.25 }}
          className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
        >
          {/* Top gradient band */}
          <div className={cn('h-1.5 w-full bg-gradient-to-r', current.gradient)} />

          {/* Close */}
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-full hover:bg-accent transition-colors text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="p-7">
            {/* Step counter */}
            <div className="flex items-center gap-1.5 mb-5">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    i === step
                      ? `flex-1 bg-gradient-to-r ${current.gradient}`
                      : i < step
                        ? 'flex-1 bg-muted-foreground/30'
                        : 'w-6 bg-muted'
                  )}
                />
              ))}
            </div>

            {/* Icon */}
            <div className={cn(
              'flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br mb-5 shadow-lg',
              current.gradient
            )}>
              <Icon className="h-8 w-8 text-white" />
            </div>

            {/* Label */}
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
              Step {step + 1} of {steps.length}
            </p>

            {/* Content */}
            <h2 className="text-xl font-extrabold text-foreground leading-tight mb-2">
              {current.title}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              {current.desc}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  onClick={handlePrev}
                  className="text-xs text-muted-foreground hover:text-foreground font-medium px-3 py-2 rounded-xl hover:bg-accent transition-colors"
                >
                  ← Back
                </button>
              )}
              <Button onClick={handleCta} className="flex-1 rounded-full gap-2">
                {current.cta} <ArrowRight className="h-4 w-4" />
              </Button>
              {step < steps.length - 1 ? (
                <button
                  onClick={handleNext}
                  className="text-xs text-muted-foreground hover:text-foreground font-medium px-3 py-2 rounded-xl hover:bg-accent transition-colors whitespace-nowrap"
                >
                  Skip →
                </button>
              ) : (
                <button
                  onClick={handleSkip}
                  className="text-xs text-muted-foreground hover:text-foreground font-medium px-3 py-2 rounded-xl hover:bg-accent transition-colors flex items-center gap-1"
                >
                  <Check className="h-3 w-3" /> Done
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

/** Call this to check if the user has completed onboarding */
export function hasOnboarded(): boolean {
  return !!localStorage.getItem(ONBOARDING_KEY)
}
