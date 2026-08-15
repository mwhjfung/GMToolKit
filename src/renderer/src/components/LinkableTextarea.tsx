import { useEffect, useRef, useState } from 'react'
import { X, Search } from 'lucide-react'
import { useContentStore } from '@/lib/store/contentStore'
import { fuzzyFind } from '@/lib/keywords'
import { TypeBadge } from '@/components/ContentBadge'

interface LinkableTextareaProps {
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
  rows?: number
}

interface PendingLink {
  start: number
  end: number
  text: string
  x: number
  y: number
}

/**
 * Drop-in replacement for a plain `<textarea>` that lets the user select text
 * and link it to an existing library entry. The link is persisted inline as
 * standard markdown (`[Selected Text](content:<id>)`) so it round-trips
 * through plain-text storage with zero schema changes — see `Markdown.tsx`
 * for the render side.
 */
export function LinkableTextarea({
  value,
  onChange,
  className,
  placeholder,
  rows
}: LinkableTextareaProps): JSX.Element {
  const ref = useRef<HTMLTextAreaElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<PendingLink | null>(null)
  const [query, setQuery] = useState('')
  const items = useContentStore((s) => s.visibleItems)

  const closePopover = (): void => setPending(null)

  // Only right-clicking an existing highlight opens the link popover — a
  // plain drag-to-select shouldn't pop anything up on its own. Right-
  // clicking inside a selection leaves it intact (standard textarea
  // behavior); right-clicking outside one collapses it before this fires,
  // so start === end there and the native context menu is left alone.
  const onContextMenu = (e: React.MouseEvent<HTMLTextAreaElement>): void => {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    if (start === end) return
    const text = value.slice(start, end).trim()
    if (!text || text.length > 80) return
    e.preventDefault()
    setPending({ start, end, text, x: e.clientX, y: e.clientY })
    setQuery(text)
  }

  const applyLink = (contentId: string): void => {
    if (!pending) return
    const linkText = value.slice(pending.start, pending.end)
    const md = `[${linkText}](content:${contentId})`
    const next = value.slice(0, pending.start) + md + value.slice(pending.end)
    onChange(next)
    setPending(null)
  }

  const results = pending ? fuzzyFind(items, query, 8) : []

  useEffect(() => {
    if (!pending) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [pending])

  useEffect(() => {
    if (!pending) return
    const onDown = (e: MouseEvent): void => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        e.target !== ref.current
      ) {
        closePopover()
      }
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closePopover()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [pending])

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onContextMenu={onContextMenu}
        className={className}
        placeholder={placeholder}
        rows={rows}
      />
      {pending && (
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: Math.min(pending.y, window.innerHeight - 280),
            left: Math.max(8, Math.min(pending.x, window.innerWidth - 264))
          }}
          className="panel z-50 w-64 p-2 shadow-2xl"
        >
          <div className="flex items-center gap-1 pb-1.5">
            <div className="relative flex-1">
              <Search
                size={13}
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-muted"
              />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && results[0]) applyLink(results[0].id)
                }}
                placeholder="Link to…"
                className="input h-7 pl-7 text-sm"
              />
            </div>
            <button type="button" className="icon-btn h-7 w-7 shrink-0" onClick={closePopover}>
              <X size={13} />
            </button>
          </div>
          <div className="max-h-48 space-y-0.5 overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => applyLink(r.id)}
                className="group flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-surface-3"
              >
                <TypeBadge type={r.type} />
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{r.name}</span>
              </button>
            ))}
            {results.length === 0 && (
              <p className="px-1.5 py-2 text-xs text-ink-muted">No matches</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
