import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { X, CheckCircle, AlertCircle, File, Cloud } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn, formatFileSize } from '@/lib/utils'

interface FileUploadState {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

interface FileUploadZoneProps {
  onUpload: (files: File[]) => Promise<void>
  accept?: Record<string, string[]>
  maxFiles?: number
  maxSize?: number
  className?: string
}

const DEFAULT_ACCEPT = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'text/plain': ['.txt'],
  'text/markdown': ['.md'],
}

const FORMAT_CHIPS = [
  { label: 'PDF',  color: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800'  },
  { label: 'DOCX', color: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' },
  { label: 'PPTX', color: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' },
  { label: 'TXT',  color: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-700' },
  { label: 'MD',   color: 'bg-violet-50 text-violet-600 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800' },
]

export function FileUploadZone({
  onUpload,
  accept = DEFAULT_ACCEPT,
  maxFiles = 10,
  maxSize = 50 * 1024 * 1024,
  className,
}: FileUploadZoneProps) {
  const [files, setFiles] = useState<FileUploadState[]>([])
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const newFiles: FileUploadState[] = acceptedFiles.map((f) => ({
        file: f, progress: 0, status: 'pending',
      }))
      setFiles(newFiles)
      if (acceptedFiles.length > 0) {
        setUploading(true)
        setFiles((prev) => prev.map((f) => ({ ...f, status: 'uploading' as const, progress: 30 })))
        try {
          await onUpload(acceptedFiles)
          setFiles((prev) => prev.map((f) => ({ ...f, status: 'done' as const, progress: 100 })))
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Upload failed'
          setFiles((prev) => prev.map((f) => ({ ...f, status: 'error' as const, error: msg })))
        } finally {
          setUploading(false)
          setTimeout(() => setFiles([]), 3000)
        }
      }
    },
    [onUpload],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept, maxFiles, maxSize, disabled: uploading,
  })

  return (
    <div className={cn('space-y-3', className)}>
      <div
        {...getRootProps()}
        className={cn(
          'relative flex items-center gap-5 rounded-2xl border-2 border-dashed px-6 py-5 cursor-pointer transition-all duration-200',
          isDragActive
            ? 'border-primary bg-primary/8 scale-[1.005]'
            : 'border-border hover:border-primary/50 hover:bg-primary/3',
          uploading && 'pointer-events-none opacity-60',
        )}
      >
        <input {...getInputProps()} />

        {/* Icon */}
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-transform duration-200"
          style={{
            background: isDragActive
              ? 'linear-gradient(135deg, hsl(168 76% 36%), #8b5cf6)'
              : 'linear-gradient(135deg, hsl(168 76% 36% / 0.15), #8b5cf6 / 0.15)',
            border: '1px solid hsl(168 76% 36% / 0.25)',
          }}
        >
          <Cloud
            className={cn('h-7 w-7 transition-colors', isDragActive ? 'text-white' : 'text-primary')}
          />
        </div>

        {isDragActive ? (
          <div>
            <p className="text-base font-bold text-primary">Drop files to upload!</p>
            <p className="text-sm text-primary/70 mt-0.5">Release to start processing</p>
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-foreground text-sm">Drag & drop files here</p>
              <span className="text-muted-foreground text-sm">or</span>
              <span className="text-sm font-bold text-primary underline underline-offset-2">browse</span>
              <span className="text-xs text-muted-foreground">· Max {formatFileSize(maxSize)} per file</span>
            </div>
            {/* Format chips */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {FORMAT_CHIPS.map(chip => (
                <span
                  key={chip.label}
                  className={`text-[10px] font-bold border rounded-md px-1.5 py-0.5 ${chip.color}`}
                >
                  {chip.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Upload progress list */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2 overflow-hidden"
          >
            {files.map(({ file, progress, status, error }, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-2.5">
                <div className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold',
                  status === 'done' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/25 dark:text-emerald-400' :
                  status === 'error' ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/25 dark:text-rose-400' :
                  'bg-primary/10 text-primary',
                )}>
                  {status === 'done' ? <CheckCircle className="h-4 w-4" /> :
                   status === 'error' ? <AlertCircle className="h-4 w-4" /> :
                   <File className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                    {status === 'uploading' && (
                      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: 'linear-gradient(90deg, hsl(168 76% 36%), #8b5cf6)' }}
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.4 }}
                        />
                      </div>
                    )}
                    {status === 'done' && <span className="text-xs text-emerald-500 font-semibold">Uploaded!</span>}
                    {error && <span className="text-xs text-destructive">{error}</span>}
                  </div>
                </div>
                {(status === 'pending' || status === 'uploading') && (
                  <button
                    onClick={() => setFiles(f => f.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
