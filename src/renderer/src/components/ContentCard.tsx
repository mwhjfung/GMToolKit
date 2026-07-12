import { GripVertical, Pin } from 'lucide-react'
import type { ContentEntry } from '@/types/content'
import { TypeBadge, SourceTag } from './ContentBadge'
import { useUiStore } from '@/lib/store/uiStore'
import { useContentStore } from '@/lib/store/contentStore'
import { cn } from '@/lib/cn'

interface ContentCardProps {
  entry: ContentEntry
  /** Shows a visible grip handle (pinned board cards, which are draggable/resizable there). */
  draggable?: boolean
  /** CSS class the drag library targets to start a drag from the handle. */
  dragHandleClassName?: string
  /** Pinned board only: how many lines of summary text the card's current
   * height has room for. Wrapped text is clamped to exactly this many lines
   * with a trailing "…" rather than cutting off mid-line — resizing the card
   * taller passes a bigger number here, revealing more. */
  summaryMaxLines?: number
  /** Pinned board only: called before opening the drawer on click. Return
   * true to skip opening — used to swallow the native click a drag/resize
   * leaves behind, so rearranging cards doesn't also pop one open. */
  onBeforeClick?: () => boolean
  /** When provided, a selection checkbox is shown (Library grid only). */
  onToggleSelect?: () => void
  selected?: boolean
}

export function ContentCard({
  entry,
  draggable,
  dragHandleClassName,
  summaryMaxLines,
  onBeforeClick,
  onToggleSelect,
  selected
}: ContentCardProps): JSX.Element {
  const openDrawer = useUiStore((s) => s.openDrawer)
  const pinned = useContentStore((s) => s.pinnedIds.includes(entry.id))
  const togglePin = useContentStore((s) => s.togglePin)
  const selectable = Boolean(onToggleSelect)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        if (onBeforeClick?.()) return
        openDrawer(entry.id)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') openDrawer(entry.id)
      }}
      className={cn(
        'panel group flex h-full cursor-pointer gap-2 p-3 text-left transition-colors focus:border-accent focus:outline-none',
        selected ? 'border-accent/70 ring-1 ring-accent/40' : 'hover:border-border-strong',
        // The whole card is the drag handle (pinned board), not just a sub-element —
        // select-none keeps a drag attempt from turning into a text selection.
        draggable && dragHandleClassName,
        draggable && 'cursor-grab select-none active:cursor-grabbing'
      )}
      title={draggable ? 'Drag to move or resize' : undefined}
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
          <div className="flex min-w-0 items-center gap-1">
            {draggable && <GripVertical size={13} className="shrink-0 text-ink-muted" />}
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
        {summaryMaxLines ? (
          <p
            className="mt-0.5 w-full break-words text-sm text-ink-muted"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: summaryMaxLines,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {entry.summary || '—'}
          </p>
        ) : (
          <p
            className="mt-0.5 w-full truncate text-sm text-ink-muted"
            title={entry.summary || undefined}
          >
            {entry.summary || '—'}
          </p>
        )}
      </div>
    </div>
  )
}
