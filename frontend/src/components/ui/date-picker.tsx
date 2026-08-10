import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  isPast,
} from 'date-fns'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface DatePickerProps {
  label?: string
  value?: string          // ISO yyyy-MM-dd or ''
  onChange: (value: string) => void
  placeholder?: string
  disablePast?: boolean
  className?: string
}

export function DatePicker({
  label,
  value,
  onChange,
  placeholder = 'Pick a date',
  disablePast = false,
  className,
}: DatePickerProps) {
  const selected = value ? new Date(`${value}T12:00:00`) : null
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState<Date>(selected ?? new Date())
  const [yearEdit, setYearEdit] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [])

  // Sync viewDate when value changes externally
  useEffect(() => {
    const d = value ? new Date(`${value}T12:00:00`) : null
    if (d) setViewDate(d)
  }, [value])

  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewDate)),
    end:   endOfWeek(endOfMonth(viewDate)),
  })

  function selectDay(day: Date) {
    if (disablePast && isPast(day) && !isToday(day)) return
    onChange(format(day, 'yyyy-MM-dd'))
    setOpen(false)
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
  }

  const yearList = Array.from({ length: 15 }, (_, i) => viewDate.getFullYear() - 5 + i)

  return (
    <div ref={ref} className={cn('relative w-full', className)}>
      {label && (
        <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm',
          'ring-offset-background transition-colors',
          'hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          open && 'border-primary ring-2 ring-ring ring-offset-2',
          !selected && 'text-muted-foreground',
        )}
      >
        <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-left truncate">
          {selected ? format(selected, 'dd MMM yyyy') : placeholder}
        </span>
        {selected && (
          <span
            role="button"
            onClick={clear}
            className="shrink-0 rounded-sm p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-border bg-background shadow-xl overflow-hidden">

          {/* Month / Year header */}
          <div className="flex items-center gap-1 px-3 pt-3 pb-2">
            <button
              type="button"
              onClick={() => setViewDate(subMonths(viewDate, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex flex-1 items-center justify-center gap-1">
              {/* Month dropdown */}
              <select
                value={viewDate.getMonth()}
                onChange={(e) => setViewDate(new Date(viewDate.getFullYear(), +e.target.value, 1))}
                className="cursor-pointer appearance-none bg-transparent text-sm font-semibold text-foreground hover:text-primary transition-colors focus:outline-none"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>

              {/* Year — click to toggle inline year grid */}
              <button
                type="button"
                onClick={() => setYearEdit((y) => !y)}
                className="text-sm font-semibold text-foreground hover:text-primary transition-colors px-1 rounded"
              >
                {viewDate.getFullYear()}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setViewDate(addMonths(viewDate, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Year picker grid */}
          {yearEdit && (
            <div className="grid grid-cols-3 gap-1 px-3 pb-2 max-h-40 overflow-y-auto scrollbar-thin">
              {yearList.map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => { setViewDate(new Date(yr, viewDate.getMonth(), 1)); setYearEdit(false) }}
                  className={cn(
                    'rounded-md py-1 text-xs font-medium transition-colors',
                    yr === viewDate.getFullYear()
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {yr}
                </button>
              ))}
            </div>
          )}

          {!yearEdit && (
            <>
              {/* Weekday headers */}
              <div className="grid grid-cols-7 px-3 pb-1">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day grid */}
              <div className="grid grid-cols-7 gap-y-0.5 px-3 pb-3">
                {calendarDays.map((day) => {
                  const isSelected = selected ? isSameDay(day, selected) : false
                  const isCurrentDay = isToday(day)
                  const inMonth = isSameMonth(day, viewDate)
                  const disabled = disablePast && isPast(day) && !isToday(day)
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      disabled={disabled}
                      onClick={() => selectDay(day)}
                      className={cn(
                        'mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors',
                        !inMonth && 'text-muted-foreground/40',
                        inMonth && !isSelected && !disabled && 'hover:bg-muted text-foreground',
                        isCurrentDay && !isSelected && 'font-bold text-primary',
                        isSelected && 'bg-primary text-primary-foreground font-semibold shadow-sm',
                        disabled && 'cursor-not-allowed opacity-30',
                      )}
                    >
                      {format(day, 'd')}
                    </button>
                  )
                })}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-border px-3 py-2">
                <button
                  type="button"
                  onClick={() => onChange('')}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => { setViewDate(new Date()); onChange(format(new Date(), 'yyyy-MM-dd')); setOpen(false) }}
                  className="text-xs text-primary font-medium hover:underline transition-colors"
                >
                  Today
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
