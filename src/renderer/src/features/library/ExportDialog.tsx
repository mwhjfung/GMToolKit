import { useRef, useState } from 'react'
import { X, FileDown } from 'lucide-react'
import { useContentStore, sourceInCampaign, SRD_SOURCE_ID } from '@/lib/store/contentStore'
import { useCampaignStore } from '@/lib/store/campaignStore'

export function ExportDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const visibleItems = useContentStore((s) => s.visibleItems)
  const sources = useContentStore((s) => s.sources)
  const activeId = useCampaignStore((s) => s.activeId)

  const sourceOptions = [
    { id: SRD_SOURCE_ID, label: 'SRD', count: visibleItems.filter((i) => i.source === 'srd').length },
    ...sources
      .filter((s) => sourceInCampaign(s, activeId))
      .map((s) => ({
        id: s.id,
        label: s.name,
        count: visibleItems.filter((i) => i.sourceId === s.id).length
      }))
  ].filter((s) => s.count > 0)

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(sourceOptions.map((s) => s.id))
  )

  const allChecked = sourceOptions.length > 0 && sourceOptions.every((s) => selected.has(s.id))
  const someChecked = sourceOptions.some((s) => selected.has(s.id))
  const allCheckRef = useRef<HTMLInputElement>(null)

  if (allCheckRef.current) {
    allCheckRef.current.indeterminate = someChecked && !allChecked
  }

  const toggleAll = (): void => {
    setSelected(allChecked ? new Set() : new Set(sourceOptions.map((s) => s.id)))
  }

  const toggle = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toExport = visibleItems.filter(
    (i) =>
      (i.source === 'srd' && selected.has(SRD_SOURCE_ID)) ||
      (i.sourceId != null && selected.has(i.sourceId))
  )

  const handleExport = (): void => {
    const blob = new Blob([JSON.stringify(toExport, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dmc-library-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-8"
    >
      <div
        className="panel mt-[8vh] w-[420px] max-w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Export library</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="p-4">
          <p className="mb-3 text-sm text-ink-muted">
            Choose which sources to include. Exports as a JSON file that can be re-imported into any
            GM Toolkit library.
          </p>

          {sourceOptions.length === 0 ? (
            <p className="rounded-md border border-border p-4 text-center text-sm text-ink-muted">
              No library content yet.
            </p>
          ) : (
            <div className="space-y-0.5 rounded-md border border-border p-2">
              <label className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 hover:bg-surface-3">
                <input
                  ref={allCheckRef}
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                />
                <span className="text-sm font-medium text-ink">All sources</span>
              </label>
              <div className="mx-2 border-t border-border" />
              {sourceOptions.map(({ id, label, count }) => (
                <label
                  key={id}
                  className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 hover:bg-surface-3"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(id)}
                    onChange={() => toggle(id)}
                  />
                  <span className="flex-1 text-sm text-ink">{label}</span>
                  <span className="text-xs text-ink-muted">{count} entries</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <span className="text-xs text-ink-muted">
            {toExport.length} {toExport.length === 1 ? 'entry' : 'entries'} selected
          </span>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-accent"
              disabled={toExport.length === 0}
              onClick={handleExport}
            >
              <FileDown size={15} />
              Export JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
