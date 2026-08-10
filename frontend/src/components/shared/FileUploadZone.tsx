import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, CheckCircle, AlertCircle, File } from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'

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
        file: f,
        progress: 0,
        status: 'pending',
      }))
      setFiles(newFiles)

      if (acceptedFiles.length > 0) {
        setUploading(true)
        setFiles((prev) => prev.map((f) => ({ ...f, status: 'uploading' as const, progress: 20 })))
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
    onDrop,
    accept,
    maxFiles,
    maxSize,
    disabled: uploading,
  })

  return (
    <div className={cn('space-y-3', className)}>
      <div
        {...getRootProps()}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors cursor-pointer',
          'hover:border-primary/50 hover:bg-primary/5',
          isDragActive ? 'border-primary bg-primary/10' : 'border-border',
          uploading && 'pointer-events-none opacity-60',
        )}
      >
        <input {...getInputProps()} />
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-4">
          <Upload className="h-7 w-7 text-primary" />
        </div>
        {isDragActive ? (
          <p className="text-primary font-medium">Drop files here...</p>
        ) : (
          <>
            <p className="font-semibold text-foreground">
              Drag & drop files here
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              or <span className="text-primary">browse</span> to upload
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              PDF, DOCX, PPTX, TXT, MD · Max {formatFileSize(maxSize)} per file
            </p>
          </>
        )}
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map(({ file, progress, status, error }, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border bg-card p-3">
              <File className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                {status === 'uploading' && (
                  <Progress value={progress} className="h-1 mt-1.5" />
                )}
                {error && <p className="text-xs text-destructive mt-0.5">{error}</p>}
              </div>
              <div className="shrink-0">
                {status === 'done' && <CheckCircle className="h-4 w-4 text-green-500" />}
                {status === 'error' && <AlertCircle className="h-4 w-4 text-destructive" />}
                {(status === 'pending' || status === 'uploading') && (
                  <button onClick={() => setFiles((f) => f.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
