import { useEffect, useMemo, useState } from 'react'
import { X, Trash2, Search } from 'lucide-react'
import { useVoiceStore } from '@/lib/store/voiceStore'
import { useContentStore } from '@/lib/store/contentStore'
import { TypeBadge } from '@/components/ContentBadge'
import { cn } from '@/lib/cn'

export function LearnedCorrectionsModal({ onClose }: { onClose: () => void }): JSX.Element {
  const aliases = useVoiceStore((s) => s.aliases)
  const removeAlias = useVoiceStore((s) => s.removeAlias)
  const items = useContentStore((s) => s.items)
  const [selected, setSelected] = useState<string>('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const entryOf = (id: string): (typeof items)[number] | undefined => items.find((i) => i.id === id)

  // Group phrases by the entry they correct to.
  const groups = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const [phrase, id] of Object.entries(aliases)) {
      const list = map.get(id) ?? []
      list.push(phrase)
      map.set(id, list)
    }
    return [...map.entries()]
      .map(([id, phrases]) => ({ id, phrases, name: entryOf(id)?.name ?? '(removed)' }))
      .sort((a, b) => a.name.localeCompare(b.name))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aliases, items])

  const total = Object.keys(aliases).length

  const q = query.trim().toLowerCase()
  const filteredGroups = q
    ? groups.filter(
        (g) => g.name.toLowerCase().includes(q) || g.phrases.some((p) => p.toLowerCase().includes(q))
      )
    : groups

  const rows =
    selected === 'all'
      ? Object.entries(aliases).map(([phrase, id]) => ({ phrase, id }))
      : (groups.find((g) => g.id === selected)?.phrases ?? []).map((phrase) => ({
          phrase,
          id: selected
        }))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-8"
    >
      <div
        className="panel flex h-[70vh] w-[680px] max-w-full flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Learned corrections</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* left: grouped by entry */}
          <div className="flex w-56 shrink-0 flex-col border-r border-border">
            <div className="shrink-0 border-b border-border p-2">
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
                />
                <input
                  className="input pl-8"
                  placeholder="Search corrections…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              <button
                type="button"
                onClick={() => setSelected('all')}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm',
                  selected === 'all'
                    ? 'bg-accent/15 text-accent'
                    : 'text-ink-muted hover:bg-surface-3'
                )}
              >
                <span>All</span>
                <span className="text-xs text-ink-muted">{total}</span>
              </button>
              {filteredGroups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelected(g.id)}
                className={cn(
                  'mt-0.5 flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm',
                  selected === g.id ? 'bg-accent/15 text-accent' : 'text-ink-muted hover:bg-surface-3'
                )}
              >
                <span className="truncate">{g.name}</span>
                <span className="shrink-0 text-xs text-ink-muted">{g.phrases.length}</span>
              </button>
              ))}
            </div>
          </div>

          {/* right: the corrections themselves */}
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {rows.length === 0 ? (
              <p className="p-4 text-sm text-ink-muted">No corrections here.</p>
            ) : (
              <div className="divide-y divide-border">
                {rows.map(({ phrase, id }) => {
                  const entry = entryOf(id)
                  return (
                    <div key={`${id}:${phrase}`} className="flex items-center justify-between gap-2 px-2 py-2">
                      <div className="flex min-w-0 items-center gap-2 text-sm">
                        <span className="truncate text-ink">“{phrase}”</span>
                        {selected === 'all' && entry && (
                          <>
                            <span className="text-ink-muted">→</span>
                            <TypeBadge type={entry.type} />
                            <span className="truncate text-ink-muted">{entry.name}</span>
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        className="icon-btn h-7 w-7 shrink-0 hover:text-danger"
                        title="Forget this correction"
                        onClick={() => removeAlias(phrase)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
