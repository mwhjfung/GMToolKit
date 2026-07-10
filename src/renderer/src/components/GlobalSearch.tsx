import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useContentStore } from '@/lib/store/contentStore'
import { usePcStore } from '@/lib/store/pcStore'
import { useUiStore } from '@/lib/store/uiStore'
import { entryHaystack } from '@/lib/db/content'
import { TYPE_META } from '@/components/typeMeta'
import { cn } from '@/lib/cn'
import type { ContentType } from '@/types/content'

type ResultKind = 'pc' | 'content'

interface Result {
  id: string
  kind: ResultKind
  label: string
  sublabel: string
  contentType?: ContentType
}

export function GlobalSearch(): JSX.Element | null {
  const open = useUiStore((s) => s.searchOpen)
  const close = useUiStore((s) => s.closeSearch)
  const openDrawer = useUiStore((s) => s.openDrawer)
  const setActivePcId = useUiStore((s) => s.setActivePcId)
  const items = useContentStore((s) => s.visibleItems)
  const pcs = usePcStore((s) => s.pcs)
  const navigate = useNavigate()

  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQ('')
      setCursor(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handle = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [open, close])

  const results = useMemo((): Result[] => {
    const term = q.trim().toLowerCase()
    if (!term) return []

    const pcResults: Result[] = pcs
      .filter((p) => p.name.toLowerCase().includes(term) || (p.alias ?? '').toLowerCase().includes(term))
      .map((p) => ({
        id: p.id,
        kind: 'pc',
        label: p.name,
        sublabel: [p.charClass, p.race].filter(Boolean).join(' · ') || 'Character'
      }))

    const contentResults: Result[] = items
      .filter((i) => entryHaystack(i).includes(term))
      .slice(0, 40)
      .map((i) => ({
        id: i.id,
        kind: 'content',
        label: i.name,
        sublabel: TYPE_META[i.type]?.label ?? i.type,
        contentType: i.type
      }))

    return [...pcResults, ...contentResults].slice(0, 50)
  }, [q, pcs, items])

  // Reset cursor when results change
  useEffect(() => { setCursor(0) }, [results])

  const select = (r: Result): void => {
    if (r.kind === 'pc') {
      setActivePcId(r.id)
      navigate('/party')
    } else {
      openDrawer(r.id)
    }
    close()
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    } else if (e.key === 'Enter' && results[cursor]) {
      select(results[cursor])
    }
  }

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 pt-[12vh]"
      onClick={close}
    >
      <div
        className="animate-toast-in flex w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search size={17} className="shrink-0 text-ink-muted" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
            placeholder="Search characters, spells, items, feats…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
          />
          {q && (
            <button type="button" className="icon-btn shrink-0" onClick={() => setQ('')}>
              <X size={15} />
            </button>
          )}
        </div>

        {/* Results */}
        {q.trim() && (
          <div className="max-h-[60vh] overflow-y-auto py-1">
            {results.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink-muted">No results for "{q}"</p>
            ) : (
              results.map((r, i) => {
                const meta = r.contentType ? TYPE_META[r.contentType] : null
                const Icon = r.kind === 'pc' ? Users : meta?.icon ?? Search
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => select(r)}
                    onMouseEnter={() => setCursor(i)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                      cursor === i ? 'bg-surface-3' : 'hover:bg-surface-2'
                    )}
                  >
                    <Icon
                      size={15}
                      className={cn(
                        'shrink-0',
                        r.kind === 'pc' ? 'text-info' : (meta?.accent ?? 'text-ink-faint')
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{r.label}</p>
                    </div>
                    <span className={cn(
                      'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                      r.kind === 'pc'
                        ? 'bg-info/15 text-info'
                        : (meta?.badge ?? 'bg-surface-3 text-ink-muted')
                    )}>
                      {r.kind === 'pc' ? 'Character' : r.sublabel}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        )}

        {!q.trim() && (
          <p className="px-4 py-5 text-sm text-ink-muted">
            Type to search characters, library entries, and more.
          </p>
        )}

        <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[11px] text-ink-faint">
          <span><kbd className="rounded bg-surface-3 px-1 py-0.5 font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="rounded bg-surface-3 px-1 py-0.5 font-mono">↵</kbd> open</span>
          <span><kbd className="rounded bg-surface-3 px-1 py-0.5 font-mono">Esc</kbd> close</span>
        </div>
      </div>
    </div>,
    document.body
  )
}
