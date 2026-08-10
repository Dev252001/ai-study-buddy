import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6', className)}>
      <div className="min-w-0">
        <h2 className="text-2xl font-bold tracking-tight text-foreground leading-tight">{title}</h2>
        {subtitle && (
          <p className="text-muted-foreground mt-0.5 text-sm">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
