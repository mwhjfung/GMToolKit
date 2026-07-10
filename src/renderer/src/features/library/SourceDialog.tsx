import { useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { useContentStore, type Source } from '@/lib/store/contentStore'
import { useCampaignStore } from '@/lib/store/campaignStore'
import { useSettingsStore } from '@/lib/store/settingsStore'
import { cn } from '@/lib/cn'

interface SourceDialogProps {
  mode: 'add' | 'edit'
  source?: Source
  onClose: () => void
  /** Called with the source id after a successful add/save. */
  onSaved?: (id: string) => void
  onDeleted?: () => void
}

/**
 * Create or edit a Source (a Library tab / collection of custom content). When
 * "Share custom content across campaigns" is on, a campaign checklist lets you
 * choose which campaigns the source appears in; its home campaign is always
 * included.
 */
export function SourceDialog({
  mode,
  source,
  onClose,
  onSaved,
  onDeleted
}: SourceDialogProps): JSX.Element {
  const addSource = useContentStore((s) => s.addSource)
  const updateSource = useContentStore((s) => s.updateSource)
  const removeSource = useContentStore((s) => s.removeSource)
  const campaigns = useCampaignStore((s) => s.campaigns)
  const activeId = useCampaignStore((s) => s.activeId)
  const share = useSettingsStore((s) => s.shareCustomContent)

  const homeId = source?.campaignId ?? activeId
  const [name, setName] = useState(source?.name ?? '')
  const [shared, setShared] = useState<string[]>(source?.sharedCampaignIds ?? [])

  const toggle = (id: string): void =>
    setShared((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const save = (): void => {
    if (!name.trim()) return
    if (mode === 'add') {
      const src = addSource(name, shared)
      onSaved?.(src.id)
    } else if (source) {
      updateSource(source.id, { name: name.trim(), sharedCampaignIds: shared })
      onSaved?.(source.id)
    }
    onClose()
  }

  const del = (): void => {
    if (!source) return
    if (
      window.confirm(
        `Delete the source “${source.name}” and every entry in it? This can't be undone.`
      )
    ) {
      void removeSource(source.id)
      onDeleted?.()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-8">
      <div className="panel mt-[8vh] w-[440px] max-w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">
            {mode === 'add' ? 'Add source' : 'Edit source'}
          </h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              autoFocus
              value={name}
              placeholder="e.g. Modern Magic"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save()
              }}
            />
          </div>

          {share && (
            <div>
              <label className="label">Show in campaigns</label>
              <div className="space-y-1.5">
                {campaigns.map((c) => {
                  const isHome = c.id === homeId
                  const checked = isHome || shared.includes(c.id)
                  return (
                    <label
                      key={c.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm',
                        checked ? 'border-accent/50 bg-accent/10 text-ink' : 'border-border text-ink-muted',
                        isHome && 'cursor-default opacity-70'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isHome}
                        onChange={() => toggle(c.id)}
                      />
                      <span>
                        {c.icon ? `${c.icon} ` : ''}
                        {c.name}
                        {isHome && <span className="text-ink-muted"> · home</span>}
                      </span>
                    </label>
                  )
                })}
              </div>
              <p className="mt-1 text-xs text-ink-muted">Its home campaign is always included.</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          {mode === 'edit' && (
            <button type="button" className="btn-ghost text-danger hover:bg-danger/10" onClick={del}>
              <Trash2 size={15} />
              Delete
            </button>
          )}
          <div className="flex-1" />
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-accent" disabled={!name.trim()} onClick={save}>
            {mode === 'add' ? 'Add source' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
