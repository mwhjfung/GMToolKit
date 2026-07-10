import { Pin } from 'lucide-react'
import type { ContentEntry } from '@/types/content'
import { TypeBadge, SourceTag } from './ContentBadge'
import { useUiStore } from '@/lib/store/uiStore'
import { useContentStore } from '@/lib/store/contentStore'
import { cn } from '@/lib/cn'

interface ContentCardProps {
  entry: ContentEntry
  /** Optional drag handle props (from dnd-kit) for pinned cards. */
  dragHandle?: React.HTMLAttributes<HTMLElement>
  /** When provided (custom entries only), a selection checkbox is shown. */
  onToggleSelect?: () => void
  selected?: boolean
}

export function ContentCard({ entry, dragHandle, onToggleSelect, selected }: ContentCardProps): JSX.Element {
  const openDrawer = useUiStore((s) => s.openDrawer)
  const pinned = useContentStore((s) => s.pinnedIds.includes(entry.id))
  const togglePin = useContentStore((s) => s.togglePin)
  const selectable = Boolean(onToggleSelect) && entry.source === 'custom'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openDrawer(entry.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') openDrawer(entry.id)
      }}
      className={cn(
        'panel group flex h-full cursor-pointer gap-2 p-3 text-left transition-colors focus:border-accent focus:outline-none',
        selected ? 'border-accent/70 ring-1 ring-accent/40' : 'hover:border-border-strong'
      )}
    >
      {selectable && (
        <input
          type="checkbox"
          checked={Boolean(selected)}
          onClick={(e) => e.stopPropagation()}
          onChange={() => onToggleSelect?.()}
          title="Select"
          className="mt-1 h-4 w-4 shrink-0 accent-accent"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2" {...dragHandle}>
            <TypeBadge type={entry.type} />
            <SourceTag source={entry.source} homebrew={entry.homebrew} />
          </div>
          <button
            type="button"
            title={pinned ? 'Unpin' : 'Pin to board'}
            onClick={(e) => {
              e.stopPropagation()
              togglePin(entry.id)
            }}
            className={cn(
              'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors',
              pinned
                ? 'text-accent hover:bg-accent/10'
                : 'text-ink-muted hover:bg-surface-3 hover:text-ink'
            )}
          >
            <Pin size={15} className={pinned ? 'fill-accent' : ''} />
          </button>
        </div>
        <h3 className="mt-1.5 w-full truncate font-medium text-ink" title={entry.name}>{entry.name}</h3>
        <p className="mt-0.5 w-full truncate text-sm text-ink-muted" title={entry.summary || undefined}>{entry.summary || '—'}</p>
      </div>
    </div>
  )
}
