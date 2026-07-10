import { useMemo, useState } from 'react'
import { FolderInput, Tag, ArrowRightLeft, Trash2, Check, Wand2 } from 'lucide-react'
import { TagSelect } from '@/components/TagSelect'
import { useContentStore, sourceInCampaign } from '@/lib/store/contentStore'
import { useCampaignStore } from '@/lib/store/campaignStore'
import { getActiveCampaignId } from '@/lib/store/activeCampaign'
import { cn } from '@/lib/cn'

type Menu = 'source' | 'tags' | 'campaign' | 'homebrew' | null

interface BulkActionBarProps {
  ids: string[]
  onClear: () => void
  onSelectAll: () => void
  /** Number of custom entries in the current view (for "select all"). */
  totalShown: number
}

const BTN =
  'inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-ink hover:bg-surface-3'

export function BulkActionBar({ ids, onClear, onSelectAll, totalShown }: BulkActionBarProps): JSX.Element {
  const visibleItems = useContentStore((s) => s.visibleItems)
  const sources = useContentStore((s) => s.sources)
  const bulkSetSource = useContentStore((s) => s.bulkSetSource)
  const bulkAddTags = useContentStore((s) => s.bulkAddTags)
  const bulkRemoveTags = useContentStore((s) => s.bulkRemoveTags)
  const bulkMoveToCampaign = useContentStore((s) => s.bulkMoveToCampaign)
  const bulkRemove = useContentStore((s) => s.bulkRemove)
  const bulkSetHomebrew = useContentStore((s) => s.bulkSetHomebrew)
  const campaigns = useCampaignStore((s) => s.campaigns)
  const activeId = useCampaignStore((s) => s.activeId)

  const [menu, setMenu] = useState<Menu>(null)
  const [sourceName, setSourceName] = useState('')
  const [addTags, setAddTags] = useState<string[]>([])
  const [removeTags, setRemoveTags] = useState<string[]>([])

  const idset = useMemo(() => new Set(ids), [ids])
  const selectedEntries = useMemo(
    () => visibleItems.filter((e) => idset.has(e.id)),
    [visibleItems, idset]
  )
  const sourceOptions = useMemo(
    () =>
      sources
        .filter((s) => sourceInCampaign(s, getActiveCampaignId()))
        .map((s) => s.name)
        .sort((a, b) => a.localeCompare(b)),
    [sources]
  )
  const allTags = useMemo(
    () => [...new Set(visibleItems.flatMap((e) => e.tags))].sort((a, b) => a.localeCompare(b)),
    [visibleItems]
  )
  const presentTags = useMemo(
    () => [...new Set(selectedEntries.flatMap((e) => e.tags))].sort((a, b) => a.localeCompare(b)),
    [selectedEntries]
  )
  const otherCampaigns = campaigns.filter((c) => c.id !== activeId)

  const toggleMenu = (m: Menu): void => setMenu((cur) => (cur === m ? null : m))
  const done = (): void => {
    setMenu(null)
    setSourceName('')
    setAddTags([])
    setRemoveTags([])
    onClear()
  }

  const applySource = async (): Promise<void> => {
    if (!sourceName.trim()) return
    await bulkSetSource(ids, sourceName)
    done()
  }
  const applyTags = async (): Promise<void> => {
    if (addTags.length) await bulkAddTags(ids, addTags)
    if (removeTags.length) await bulkRemoveTags(ids, removeTags)
    done()
  }
  const applyMove = async (campaignId: string): Promise<void> => {
    await bulkMoveToCampaign(ids, campaignId)
    done()
  }
  const applyDelete = async (): Promise<void> => {
    if (
      window.confirm(`Delete ${ids.length} ${ids.length === 1 ? 'entry' : 'entries'}? This can't be undone.`)
    ) {
      await bulkRemove(ids)
      done()
    }
  }
  const applyHomebrew = async (value: boolean): Promise<void> => {
    await bulkSetHomebrew(ids, value)
    done()
  }

  return (
    <div className="shrink-0 border-b border-border bg-surface-2 px-6 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-ink">{ids.length} selected</span>
        <button type="button" className="text-xs text-ink-muted hover:text-ink" onClick={onSelectAll}>
          Select all {totalShown}
        </button>
        <button type="button" className="text-xs text-ink-muted hover:text-ink" onClick={onClear}>
          Clear
        </button>
        <div className="mx-1 h-4 w-px bg-border" />
        <button
          type="button"
          className={cn(BTN, menu === 'source' && 'bg-surface-3')}
          onClick={() => toggleMenu('source')}
        >
          <FolderInput size={15} />
          Change source
        </button>
        <button
          type="button"
          className={cn(BTN, menu === 'tags' && 'bg-surface-3')}
          onClick={() => toggleMenu('tags')}
        >
          <Tag size={15} />
          Tags
        </button>
        {otherCampaigns.length > 0 && (
          <button
            type="button"
            className={cn(BTN, menu === 'campaign' && 'bg-surface-3')}
            onClick={() => toggleMenu('campaign')}
          >
            <ArrowRightLeft size={15} />
            Move to campaign
          </button>
        )}
        <button
          type="button"
          className={cn(BTN, menu === 'homebrew' && 'bg-surface-3')}
          onClick={() => toggleMenu('homebrew')}
        >
          <Wand2 size={15} />
          Homebrew
        </button>
        <button type="button" className={cn(BTN, 'text-danger hover:bg-danger/10')} onClick={() => void applyDelete()}>
          <Trash2 size={15} />
          Delete
        </button>
      </div>

      {menu === 'source' && (
        <div className="mt-2 flex items-end gap-2">
          <div className="w-72">
            <TagSelect
              value={sourceName}
              options={sourceOptions}
              placeholder="Pick or name a source…"
              onChange={(v) => setSourceName(v as string)}
            />
          </div>
          <button type="button" className="btn-accent" disabled={!sourceName.trim()} onClick={() => void applySource()}>
            <Check size={15} />
            Apply
          </button>
        </div>
      )}

      {menu === 'tags' && (
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <div className="w-64">
            <label className="label">Add tags</label>
            <TagSelect
              multi
              value={addTags}
              options={allTags}
              placeholder="Tags to add…"
              onChange={(v) => setAddTags(v as string[])}
            />
          </div>
          <div className="w-64">
            <label className="label">Remove tags</label>
            <TagSelect
              multi
              value={removeTags}
              options={presentTags}
              placeholder="Tags to remove…"
              onChange={(v) => setRemoveTags(v as string[])}
            />
          </div>
          <button
            type="button"
            className="btn-accent"
            disabled={!addTags.length && !removeTags.length}
            onClick={() => void applyTags()}
          >
            <Check size={15} />
            Apply
          </button>
        </div>
      )}

      {menu === 'campaign' && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-muted">Move to:</span>
          {otherCampaigns.map((c) => (
            <button key={c.id} type="button" className={BTN} onClick={() => void applyMove(c.id)}>
              {c.icon ? `${c.icon} ` : ''}
              {c.name}
            </button>
          ))}
        </div>
      )}

      {menu === 'homebrew' && (
        <div className="mt-2 flex items-center gap-2">
          <button type="button" className={BTN} onClick={() => void applyHomebrew(true)}>
            <Wand2 size={14} />
            Mark as homebrew
          </button>
          <button type="button" className={BTN} onClick={() => void applyHomebrew(false)}>
            Remove homebrew
          </button>
        </div>
      )}
    </div>
  )
}
