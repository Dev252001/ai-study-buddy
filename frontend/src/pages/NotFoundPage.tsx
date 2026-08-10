import { useNavigate } from 'react-router-dom'
import { FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
        <FileQuestion className="h-10 w-10 text-muted-foreground" />
      </div>
      <div>
        <h1 className="text-4xl font-bold tabular-nums">404</h1>
        <p className="text-lg font-semibold mt-1">Page not found</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          The page you're looking for doesn't exist or may have been moved.
        </p>
      </div>
      <div className="flex gap-3">
        <Button onClick={() => navigate(-1)} variant="outline">Go Back</Button>
        <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
      </div>
    </div>
  )
}
