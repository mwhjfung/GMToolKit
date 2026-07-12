import { useMemo, useRef, useState, useEffect } from 'react'
import {
  Search,
  Download,
  RefreshCw,
  Loader2,
  PencilLine,
  Plus,
  Upload,
  FolderPlus,
  Pencil,
  FileDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Trash2
} from 'lucide-react'
import { Page } from '@/components/Page'
import { EmptyState } from '@/components/EmptyState'
import { ContentGrid } from '@/components/ContentGrid'
import { useContentStore, sourceInCampaign, SRD_SOURCE_ID, type Source } from '@/lib/store/contentStore'
import { useCampaignStore } from '@/lib/store/campaignStore'
import { useUiStore } from '@/lib/store/uiStore'
import { filterContent } from '@/lib/db/content'
import { CONTENT_TYPE_LABELS, type ContentType } from '@/types/content'
import { cn } from '@/lib/cn'
import { SourceDialog } from './SourceDialog'
import { BulkActionBar } from './BulkActionBar'
import { ExportDialog } from './ExportDialog'
import { AddToLibraryDialog } from './AddToLibraryDialog'

const ALL_TAB = 'all'
type DialogState = { mode: 'add' } | { mode: 'edit'; source: Source } | null

export function LibraryPage(): JSX.Element {
  const visibleItems = useContentStore((s) => s.visibleItems)
  const sources = useContentStore((s) => s.sources)
  const sync = useContentStore((s) => s.sync)
  const removeSrd = useContentStore((s) => s.removeSrd)
  const syncing = useContentStore((s) => s.syncing)
  const syncProgress = useContentStore((s) => s.syncProgress)
  const activeId = useCampaignStore((s) => s.activeId)
  const openImport = useUiStore((s) => s.openImport)
  const openTemplateSelect = useUiStore((s) => s.openTemplateSelect)

  const [tab, setTab] = useState<string>(ALL_TAB)
  const [query, setQuery] = useState('')
  const [activeTypes, setActiveTypes] = useState<Set<ContentType>>(new Set())
  const [dialog, setDialog] = useState<DialogState>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [exportOpen, setExportOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [sourceOpen, setSourceOpen] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)
  const sourceRef = useRef<HTMLDivElement>(null)
  const chipsRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const campaignSources = useMemo(
    () =>
      sources
        .filter((s) => sourceInCampaign(s, activeId))
        .sort((a, b) => a.createdAt - b.createdAt),
    [sources, activeId]
  )

  // Fallback to All if active tab disappears
  useEffect(() => {
    const allIds = [ALL_TAB, SRD_SOURCE_ID, ...campaignSources.map((s) => s.id)]
    if (!allIds.includes(tab)) setTab(ALL_TAB)
  }, [campaignSources, tab])

  // "/" focuses search
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Close source dropdown on outside click
  useEffect(() => {
    if (!sourceOpen) return
    const handler = (e: MouseEvent): void => {
      if (!sourceRef.current?.contains(e.target as Node)) setSourceOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [sourceOpen])

  const isAll = tab === ALL_TAB
  const isSrd = tab === SRD_SOURCE_ID
  const activeSource = campaignSources.find((s) => s.id === tab)

  const tabItems = useMemo(() => {
    if (isAll) return visibleItems
    if (isSrd) return visibleItems.filter((i) => i.source === 'srd')
    return visibleItems.filter((i) => i.sourceId === tab)
  }, [visibleItems, tab, isAll, isSrd])

  const typesPresent = useMemo(() => {
    const set = new Set<ContentType>()
    tabItems.forEach((i) => set.add(i.type))
    return (Object.keys(CONTENT_TYPE_LABELS) as ContentType[]).filter(
      (t) => set.has(t) && t !== 'homebrew'
    )
  }, [tabItems])

  // Track whether filter chip strip can scroll left/right — must be after typesPresent
  useEffect(() => {
    const el = chipsRef.current
    if (!el) return
    const update = (): void => {
      setCanScrollLeft(el.scrollLeft > 0)
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
    }
    update()
    el.addEventListener('scroll', update)
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', update); ro.disconnect() }
  }, [typesPresent])

  const filtered = useMemo(
    () => filterContent(tabItems, { query, types: activeTypes.size ? [...activeTypes] : undefined }),
    [tabItems, query, activeTypes]
  )
  const toggleType = (t: ContentType): void => {
    setActiveTypes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  const clearSelection = (): void => setSelectedIds(new Set())
  const toggleSelect = (id: string): void =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const selectAll = (): void => setSelectedIds(new Set(filtered.map((e) => e.id)))

  const resetTabView = (id: string): void => {
    setTab(id)
    setActiveTypes(new Set())
    setQuery('')
    clearSelection()
    setSourceOpen(false)
  }

  const srdCount = useMemo(() => visibleItems.filter((i) => i.source === 'srd').length, [visibleItems])
  const countFor = (id: string): number =>
    id === ALL_TAB
      ? visibleItems.length
      : id === SRD_SOURCE_ID
        ? srdCount
        : visibleItems.filter((i) => i.sourceId === id).length

  const sourceLabel =
    tab === ALL_TAB
      ? 'All sources'
      : tab === SRD_SOURCE_ID
        ? 'SRD'
        : (activeSource?.name ?? 'Unknown')

  const actions = (
    <>
      {isSrd && srdCount > 0 && (
        <>
          <button type="button" className="btn-ghost" disabled={syncing} onClick={() => void sync()}>
            {syncing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            Re-sync
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={syncing}
            onClick={() => {
              if (
                window.confirm(
                  `Remove all ${srdCount} SRD entries? Your own content is unaffected, and you can bring SRD back any time with Re-sync.`
                )
              ) {
                void removeSrd()
              }
            }}
          >
            <Trash2 size={15} />
            Remove SRD
          </button>
        </>
      )}
      {activeSource && (
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setDialog({ mode: 'edit', source: activeSource })}
        >
          <Pencil size={15} />
          Edit source
        </button>
      )}
      <button type="button" className="btn-ghost" onClick={() => setExportOpen(true)}>
        <FileDown size={15} />
        Export
      </button>
      <button type="button" className="btn-ghost" onClick={() => openImport(activeSource?.name)}>
        <Upload size={15} />
        Import
      </button>
      <button type="button" className="btn-accent" onClick={() => setAddOpen(true)}>
        <Plus size={15} />
        Add to library
      </button>
    </>
  )

  return (
    <Page title="Library" actions={actions}>
      <div className="flex h-full flex-col">
        {selectedIds.size > 0 && (
          <BulkActionBar
            ids={[...selectedIds]}
            onClear={clearSelection}
            onSelectAll={selectAll}
            totalShown={filtered.length}
          />
        )}

        {isSrd && srdCount === 0 ? (
          <SrdEmpty syncing={syncing} progress={syncProgress} onSync={() => void sync()} />
        ) : tabItems.length === 0 ? (
          <EmptyState
            icon={isAll ? Download : PencilLine}
            title={isAll ? 'Your library is empty' : `Nothing in ${activeSource?.name ?? 'this source'} yet`}
            description="Create your own spells, monsters, NPCs, items and world entries — your beholder included."
          >
            <div className="flex items-center gap-2">
              {isAll && srdCount === 0 && (
                <button type="button" className="btn-outline" onClick={() => void sync()}>
                  <Download size={16} />
                  Download SRD
                </button>
              )}
              <button
                type="button"
                className="btn-outline"
                onClick={() => openImport(activeSource?.name)}
              >
                <Upload size={16} />
                Import a document
              </button>
              <button
                type="button"
                className="btn-accent"
                onClick={() => openTemplateSelect(activeSource?.name)}
              >
                <Plus size={16} />
                New entry
              </button>
            </div>
          </EmptyState>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex shrink-0 items-center gap-2 px-6 py-3">
              {/* Search */}
              <div className="relative shrink-0">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
                />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…  ( / )"
                  className="input w-52 pl-8"
                />
              </div>

              {/* Source dropdown */}
              <div ref={sourceRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setSourceOpen((o) => !o)}
                  className="input flex w-44 items-center justify-between gap-1.5 text-left text-sm"
                >
                  <span className="truncate">{sourceLabel}</span>
                  <ChevronDown
                    size={13}
                    className={cn('shrink-0 transition-transform', sourceOpen && 'rotate-180')}
                  />
                </button>
                {sourceOpen && (
                  <div className="absolute left-0 top-full z-20 mt-1 min-w-[200px] overflow-hidden rounded-lg border border-border bg-surface-2 py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => resetTabView(ALL_TAB)}
                      className={cn(
                        'flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-surface-3',
                        tab === ALL_TAB ? 'text-ink' : 'text-ink-muted'
                      )}
                    >
                      <span className="truncate">All sources</span>
                      <span className="ml-4 shrink-0 text-xs text-ink-muted">{visibleItems.length}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => resetTabView(SRD_SOURCE_ID)}
                      className={cn(
                        'flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-surface-3',
                        tab === SRD_SOURCE_ID ? 'text-ink' : 'text-ink-muted'
                      )}
                    >
                      <span className="truncate">SRD</span>
                      <span className="ml-4 shrink-0 text-xs text-ink-muted">{srdCount}</span>
                    </button>
                    {campaignSources.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => resetTabView(s.id)}
                        className={cn(
                          'flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-surface-3',
                          tab === s.id ? 'text-ink' : 'text-ink-muted'
                        )}
                      >
                        <span className="truncate">{s.name}</span>
                        <span className="ml-4 shrink-0 text-xs text-ink-muted">{countFor(s.id)}</span>
                      </button>
                    ))}
                    <div className="my-1 border-t border-border" />
                    <button
                      type="button"
                      onClick={() => { setSourceOpen(false); setDialog({ mode: 'add' }) }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-3 hover:text-ink"
                    >
                      <FolderPlus size={13} />
                      Add source
                    </button>
                  </div>
                )}
              </div>

              {/* Type filter chips — horizontally scrollable strip with chevron controls */}
              <div className="relative flex min-w-0 flex-1 items-center">
                {canScrollLeft && (
                  <button
                    type="button"
                    onClick={() => chipsRef.current?.scrollBy({ left: -120, behavior: 'smooth' })}
                    className="mr-0.5 shrink-0 rounded p-0.5 text-ink-muted hover:bg-surface-3 hover:text-ink"
                  >
                    <ChevronLeft size={14} />
                  </button>
                )}
                <div
                  ref={chipsRef}
                  className="flex min-w-0 gap-1 overflow-x-auto"
                  style={{ scrollbarWidth: 'none' }}
                >
                  {typesPresent.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleType(t)}
                      className={cn(
                        'shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                        activeTypes.has(t)
                          ? 'border-accent/60 bg-accent/15 text-accent'
                          : 'border-border text-ink-muted hover:border-border-strong hover:text-ink'
                      )}
                    >
                      {CONTENT_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
                {canScrollRight && (
                  <button
                    type="button"
                    onClick={() => chipsRef.current?.scrollBy({ left: 120, behavior: 'smooth' })}
                    className="ml-0.5 shrink-0 rounded p-0.5 text-ink-muted hover:bg-surface-3 hover:text-ink"
                  >
                    <ChevronRight size={14} />
                  </button>
                )}
              </div>

              {/* Count — flush right */}
              <span className="ml-2 shrink-0 text-xs text-ink-muted">{filtered.length} shown</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
              {filtered.length === 0 ? (
                <EmptyState icon={Search} title="No matches" description="Try a different search or filter." />
              ) : (
                <ContentGrid items={filtered} selectedIds={selectedIds} onToggleSelect={toggleSelect} />
              )}
            </div>
          </>
        )}
      </div>

      {dialog && (
        <SourceDialog
          mode={dialog.mode}
          source={dialog.mode === 'edit' ? dialog.source : undefined}
          onClose={() => setDialog(null)}
          onSaved={(id) => resetTabView(id)}
          onDeleted={() => resetTabView(ALL_TAB)}
        />
      )}

      {addOpen && (
        <AddToLibraryDialog
          sourceName={activeSource?.name}
          onClose={() => setAddOpen(false)}
        />
      )}

      {exportOpen && <ExportDialog onClose={() => setExportOpen(false)} />}
    </Page>
  )
}

function SrdEmpty({
  syncing,
  progress,
  onSync
}: {
  syncing: boolean
  progress: { label: string; done: number; total: number } | null
  onSync: () => void
}): JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-10 text-center">
      <Download size={32} strokeWidth={1.5} className="text-ink-muted" />
      <div>
        <p className="text-sm font-medium text-ink">No SRD content yet</p>
        <p className="mt-1 max-w-sm text-sm text-ink-muted">
          Download the official 5e SRD from Open5e — spells, monsters, magic items, weapons,
          conditions and classes. Stored locally so it works offline.
        </p>
      </div>
      {syncing ? (
        <div className="flex w-64 flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-ink-muted">
            <Loader2 size={15} className="animate-spin" />
            {progress ? `Fetching ${progress.label}…` : 'Starting…'}
          </div>
          {progress && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full bg-accent transition-[width]"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
          )}
        </div>
      ) : (
        <button type="button" className="btn-accent" onClick={onSync}>
          <Download size={16} />
          Download SRD content
        </button>
      )}
    </div>
  )
}
