import { useState } from 'react'
import { Search, FileUp, Loader2 } from 'lucide-react'
import { useContentStore } from '@/lib/store/contentStore'
import { CONTENT_TYPE_LABELS, type ContentEntry, type ContentType } from '@/types/content'

const TYPE_ORDER: ContentType[] = [
  'spell', 'monster', 'item', 'weapon', 'condition',
  'class', 'subclass', 'feat', 'background', 'proficiency', 'worldentry', 'homebrew',
  'action'
]

export function JsonBatchReview({
  drafts,
  sourceName,
  onClose
}: {
  drafts: ContentEntry[]
  sourceName: string
  onClose: () => void
}): JSX.Element {
  const bulkImport = useContentStore((s) => s.bulkImport)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(drafts.map((d) => d.id))
  )
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)

  const q = query.toLowerCase()
  const filtered = q ? drafts.filter((d) => d.name.toLowerCase().includes(q)) : drafts

  const groups = TYPE_ORDER.map((type) => ({
    type,
    entries: filtered.filter((d) => d.type === type)
  })).filter((g) => g.entries.length > 0)

  const selectedCount = drafts.filter((d) => selectedIds.has(d.id)).length

  const toggleEntry = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleGroup = (entries: ContentEntry[], allSelected: boolean): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const e of entries) {
        if (allSelected) next.delete(e.id)
        else next.add(e.id)
      }
      return next
    })
  }

  const handleImport = async (): Promise<void> => {
    setSaving(true)
    try {
      await bulkImport(drafts.filter((d) => selectedIds.has(d.id)))
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/50 p-8">
      <div className="panel mt-[4vh] w-[600px] max-w-full" onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Review import</h2>
            <p className="text-xs text-ink-muted">
              {drafts.length} entries{sourceName ? ` · ${sourceName}` : ''}
            </p>
          </div>
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="input w-44 pl-8 text-xs"
            />
          </div>
        </div>

        {/* grouped list */}
        <div className="max-h-[60vh] divide-y divide-border overflow-y-auto">
          {groups.length === 0 ? (
            <p className="p-8 text-center text-sm text-ink-muted">No entries match your search.</p>
          ) : (
            groups.map(({ type, entries }) => {
              const allSelected = entries.every((e) => selectedIds.has(e.id))
              const anySelected = entries.some((e) => selectedIds.has(e.id))
              const groupSelectedCount = entries.filter((e) => selectedIds.has(e.id)).length
              return (
                <div key={type}>
                  <div className="flex items-center gap-2 bg-surface-2 px-4 py-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = !allSelected && anySelected
                      }}
                      onChange={() => toggleGroup(entries, allSelected)}
                    />
                    <span className="text-xs font-semibold text-ink">
                      {CONTENT_TYPE_LABELS[type]}
                    </span>
                    <span className="ml-auto text-xs text-ink-muted">
                      {groupSelectedCount}/{entries.length}
                    </span>
                  </div>
                  {entries.map((entry) => (
                    <label
                      key={entry.id}
                      className="flex cursor-pointer items-center gap-3 px-4 py-1.5 hover:bg-surface-2"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(entry.id)}
                        onChange={() => toggleEntry(entry.id)}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-ink">{entry.name}</div>
                        {entry.summary && (
                          <div className="truncate text-xs text-ink-muted">{entry.summary}</div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )
            })
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-accent"
            disabled={selectedCount === 0 || saving}
            onClick={() => void handleImport()}
          >
            {saving ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <FileUp size={15} />
            )}
            Import {selectedCount} selected
          </button>
        </div>
      </div>
    </div>
  )
}
