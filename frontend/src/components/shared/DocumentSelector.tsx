import { useState, useEffect } from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useDocuments } from '@/hooks/useDocuments'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface DocumentSelectorProps {
  value: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
  onlyReady?: boolean
}

export function DocumentSelector({
  value,
  onChange,
  placeholder = 'Select documents...',
  onlyReady = true,
}: DocumentSelectorProps) {
  const { data: documents = [] } = useDocuments()
  const filtered = onlyReady ? documents.filter((d) => d.status === 'ready') : documents
  const [open, setOpen] = useState(false)

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  const selectedDocs = filtered.filter((d) => value.includes(d.id))

  return (
    <div className="space-y-2">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-full justify-between font-normal"
          >
            <span className="truncate text-muted-foreground">
              {value.length > 0 ? `${value.length} document(s) selected` : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80 max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-4 text-sm text-center text-muted-foreground">
              No ready documents found
            </div>
          ) : (
            filtered.map((doc) => (
              <DropdownMenuItem
                key={doc.id}
                onClick={() => toggle(doc.id)}
                className="flex items-center gap-2"
              >
                <Check
                  className={cn(
                    'h-4 w-4 shrink-0',
                    value.includes(doc.id) ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <span className="truncate flex-1">{doc.title}</span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedDocs.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedDocs.map((doc) => (
            <Badge key={doc.id} variant="secondary" className="gap-1 text-xs">
              {doc.title}
              <button onClick={() => toggle(doc.id)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
