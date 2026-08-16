import { TYPE_META } from './typeMeta'
import type { ContentSource, ContentType } from '@/types/content'
import { cn } from '@/lib/cn'

export function TypeBadge({ type, className }: { type: ContentType; className?: string }): JSX.Element | null {
  if (type === 'homebrew') return null
  // `type` is typed as ContentType, but it ultimately comes from persisted
  // data — an entry saved under an older schema (or copied over from the
  // pre-rename "DM Command" profile, see dataMigration.ts) can carry a type
  // value that's since been renamed or dropped. TYPE_META has no entry for
  // that, so fall back to a plain, icon-less badge instead of crashing the
  // whole app on render.
  const meta = TYPE_META[type] as (typeof TYPE_META)[ContentType] | undefined
  if (!meta) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium bg-surface-2 text-ink-muted',
          className
        )}
      >
        {type}
      </span>
    )
  }
  const Icon = meta.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium',
        meta.badge,
        className
      )}
    >
      <Icon size={11} />
      {meta.label}
    </span>
  )
}

export function SourceTag({
  source,
  homebrew
}: {
  source: ContentSource
  homebrew?: boolean
}): JSX.Element | null {
  if (source === 'srd') {
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">SRD</span>
    )
  }
  if (homebrew) {
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">HOMEBREW</span>
    )
  }
  return null
}
