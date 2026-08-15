import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type Ref
} from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutGrid, Maximize2, Minimize2, Plus, Archive, Pencil,
  X, Check, Trash2, RotateCcw, Users, Copy, Search, PanelRightClose, Pin, SquareCheck,
  MoveDiagonal2
} from 'lucide-react'
import GridLayout, { type Layout, type LayoutItem, type ResizeHandleAxis } from 'react-grid-layout'
import { gridBounds, minMaxSize, type LayoutConstraint } from 'react-grid-layout/core'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { Page } from '@/components/Page'
import { EmptyState } from '@/components/EmptyState'
import { ContentCard } from '@/components/ContentCard'
import { ContentDetail } from '@/components/ContentDetail'
import { TypeBadge, SourceTag } from '@/components/ContentBadge'
import { useContentStore } from '@/lib/store/contentStore'
import { useSessionStore, type DashSession } from '@/lib/store/sessionStore'
import { useCombatStore } from '@/lib/store/combatStore'
import { usePcStore, type PcUnit } from '@/lib/store/pcStore'
import { InitiativeTracker } from '@/features/session/InitiativeTracker'
import { SplitButton } from '@/components/SplitButton'
import { NotesPanel } from './NotesPanel'
import { SessionDialog } from './SessionDialog'
import { getSetting, setSetting } from '@/lib/db/content'
import { findFirstOpenSlot, repackByReadingOrder, useContainerSize } from '@/lib/gridPack'
import { getActiveCampaignId } from '@/lib/store/activeCampaign'
import { getActiveSessionId } from '@/lib/store/activeSession'
import { CONTENT_TYPE_LABELS } from '@/types/content'
import type { ContentEntry, ContentType } from '@/types/content'
import { useNotesStore } from '@/lib/store/notesStore'
import type { Note } from '@/lib/store/notesStore'
import type { CombatUnit } from '@/lib/store/combatStore'
import { cn } from '@/lib/cn'

type SectionId = 'pins' | 'initiative' | 'notes'
type MainTab = 'latest' | 'archive'

const SECTION_TITLE: Record<SectionId, string> = {
  pins: 'Pinned cards',
  initiative: 'Initiative',
  notes: 'Notes'
}

const fmtDate = (ts: number): string =>
  new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

const fmtFull = (ts: number): string =>
  new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

// ---- dashboard page --------------------------------------------------------

export function DashboardPage(): JSX.Element {
  const [showNewSession, setShowNewSession] = useState(false)
  const [expanded, setExpanded] = useState<SectionId | null>(null)
  const [mainTab, setMainTab] = useState<MainTab>('latest')

  return (
    <Page title="Dashboard" flush>
      <div className="flex h-full flex-col">
        {/* main tabs */}
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 pt-3">
          <div className="flex flex-1 items-center gap-1">
            {(['latest', 'archive'] as MainTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setMainTab(t)}
                className={cn(
                  'whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                  mainTab === t
                    ? 'border-accent text-ink'
                    : 'border-transparent text-ink-muted hover:text-ink'
                )}
              >
                {t === 'latest' ? 'Latest' : 'View archive'}
              </button>
            ))}
          </div>
          {mainTab === 'latest' && (
            <div className="mb-1 flex shrink-0 items-center gap-1">
              <button
                type="button"
                title="Reset session — clears pins, initiative and notes"
                onClick={() => {
                  if (window.confirm('Reset this session? This will clear all pins, initiative and notes. This cannot be undone.')) {
                    void useSessionStore.getState().resetLatest()
                  }
                }}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink-muted hover:bg-surface-3 hover:text-ink"
              >
                <RotateCcw size={13} />
                Reset
              </button>
              <button
                type="button"
                onClick={() => setShowNewSession(true)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink-muted hover:bg-surface-3 hover:text-ink"
              >
                <Plus size={14} />
                New session
              </button>
            </div>
          )}
        </div>

        {/* content */}
        <div className="min-h-0 flex-1">
          {mainTab === 'latest' ? (
            <div className="h-full overflow-y-auto p-4">
              {expanded ? (
                <div className="h-full">
                  {expanded === 'initiative' ? (
                    <InitiativeDashSection
                      expanded={true}
                      onToggle={() => setExpanded(null)}
                    />
                  ) : expanded === 'notes' ? (
                    <NotesDashSection
                      expanded={true}
                      onToggle={() => setExpanded(null)}
                    />
                  ) : (
                    <PinsDashSection
                      expanded={true}
                      onToggle={() => setExpanded(null)}
                    />
                  )}
                </div>
              ) : (
                <div className="flex h-full flex-col gap-4">
                  <div className="min-h-0" style={{ flexGrow: 60, flexBasis: 0 }}>
                    <PinsDashSection
                      expanded={false}
                      onToggle={() => setExpanded('pins')}
                    />
                  </div>
                  <div className="flex min-h-0 flex-wrap gap-4" style={{ flexGrow: 40, flexBasis: 0 }}>
                    <div className="min-w-[300px] flex-1 basis-[300px]">
                      <InitiativeDashSection
                        expanded={false}
                        onToggle={() => setExpanded('initiative')}
                      />
                    </div>
                    <div className="min-w-[300px] flex-1 basis-[300px]">
                      <NotesDashSection
                        expanded={false}
                        onToggle={() => setExpanded('notes')}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <ArchiveView />
          )}
        </div>
      </div>

      {showNewSession && (
        <SessionDialog mode="add" onClose={() => setShowNewSession(false)} />
      )}
    </Page>
  )
}

// ---- dash section wrapper --------------------------------------------------

function DashSection({
  title,
  expanded,
  onToggle,
  children
}: {
  title: string
  expanded: boolean
  onToggle: () => void
  children: ReactNode
}): JSX.Element {
  return (
    <div className="panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{title}</span>
        <button
          type="button"
          className="icon-btn h-6 w-6"
          title={expanded ? 'Contract' : 'Expand'}
          onClick={onToggle}
        >
          {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  )
}

// ---- initiative dash section (custom header) --------------------------------

function InitiativeDashSection({
  expanded,
  onToggle
}: {
  expanded: boolean
  onToggle: () => void
}): JSX.Element {
  const pcs = usePcStore((s) => s.pcs)
  const units = useCombatStore((s) => s.units)
  const addUnit = useCombatStore((s) => s.addUnit)
  const [addOpen, setAddOpen] = useState(false)

  const addAllParty = (): void => {
    const existing = new Set(units.map((u) => u.name.toLowerCase()))
    pcs.forEach((pc) => {
      if (existing.has(pc.name.toLowerCase())) return
      addUnit({
        name: pc.name,
        isPC: true,
        initiative: 0,
        locked: false,
        hpCurrent: pc.currentHp,
        hpMax: pc.maxHp,
        hpTemp: pc.tempHp,
        conditions: []
      })
    })
  }

  const addOnePc = (pc: PcUnit): void => {
    const existing = new Set(units.map((u) => u.name.toLowerCase()))
    if (existing.has(pc.name.toLowerCase())) return
    addUnit({
      name: pc.name,
      isPC: true,
      initiative: 0,
      locked: false,
      hpCurrent: pc.currentHp,
      hpMax: pc.maxHp,
      hpTemp: pc.tempHp,
      conditions: []
    })
  }

  return (
    <div className="panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Initiative</span>

        <div className="flex items-center gap-1.5">
          <SplitButton
            label="Add party"
            icon={<Users size={13} />}
            onMain={addAllParty}
            disabled={pcs.length === 0}
            dropdownContent={
              <>
                <p className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  Add individual
                </p>
                {pcs.map((pc) => {
                  const already = units.some((u) => u.name.toLowerCase() === pc.name.toLowerCase())
                  return (
                    <button
                      key={pc.id}
                      type="button"
                      disabled={already}
                      onClick={() => addOnePc(pc)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm text-ink hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-40"
                    >
                      <span className="truncate">{pc.name}</span>
                      {already && <Check size={12} className="shrink-0 text-accent" />}
                    </button>
                  )
                })}
              </>
            }
          />
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex h-[26px] items-center gap-1 rounded-md bg-accent px-2.5 text-xs font-medium text-accent-fg hover:bg-accent-strong"
          >
            <Plus size={13} />
            Add
          </button>
          <button
            type="button"
            className="icon-btn h-5 w-5"
            title={expanded ? 'Minimize' : 'Expand'}
            onClick={onToggle}
          >
            {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <InitiativeTracker
          addOpen={addOpen}
          onCloseAdd={() => setAddOpen(false)}
          onAdd={() => setAddOpen(true)}
          onAddParty={addAllParty}
        />
      </div>
    </div>
  )
}

// ---- notes dash section ----------------------------------------------------

function NotesDashSection({
  expanded,
  onToggle
}: {
  expanded: boolean
  onToggle: () => void
}): JSX.Element {
  const notes = useNotesStore((s) => s.notes)
  const add = useNotesStore((s) => s.add)
  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState(false)

  const submit = (): void => {
    if (!draft.trim()) return
    add(draft)
    setDraft('')
  }

  const copyAll = (): void => {
    const text = notes.map((n) => `[${fmtFull(n.createdAt)}] ${n.text}`).join('\n')
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Notes{notes.length > 0 && ` (${notes.length})`}
        </span>
        <div className="flex items-center gap-1.5">
          {notes.length > 0 && (
            <button
              type="button"
              className="flex h-[26px] items-center gap-1 rounded-md px-2.5 text-xs font-medium text-ink-muted hover:bg-surface-3 hover:text-ink"
              onClick={copyAll}
            >
              {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy all'}
            </button>
          )}
          <button
            type="button"
            className="flex h-[26px] items-center gap-1 rounded-md bg-accent px-2.5 text-xs font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-40"
            disabled={!draft.trim()}
            onClick={submit}
          >
            <Plus size={13} />
            Add
          </button>
          <button
            type="button"
            className="icon-btn h-5 w-5"
            title={expanded ? 'Minimize' : 'Expand'}
            onClick={onToggle}
          >
            {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>
      <NotesPanel expanded={expanded} draft={draft} setDraft={setDraft} onSubmit={submit} />
    </div>
  )
}

// ---- pin add modal ---------------------------------------------------------

function PinPickCard({
  entry,
  checked,
  preview,
  pinned,
  onSelect
}: {
  entry: ContentEntry
  checked: boolean
  preview: boolean
  pinned: boolean
  onSelect: (e: ContentEntry) => void
}): JSX.Element {
  return (
    <button
      type="button"
      data-entry-id={entry.id}
      onClick={() => onSelect(entry)}
      className={cn(
        'panel flex w-full flex-col gap-1 overflow-hidden p-3 text-left focus:outline-none',
        preview
          ? 'border-accent bg-accent/10'
          : checked
            ? 'border-accent/60 bg-accent/5'
            : 'hover:border-accent/40 hover:bg-accent/5'
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <TypeBadge type={entry.type} />
          <SourceTag source={entry.source} homebrew={entry.homebrew} />
        </div>
        <div className="flex items-center gap-1">
          {pinned && (
            <Pin
              size={12}
              className="shrink-0 text-ink-muted"
              style={{ fill: 'currentColor' }}
            />
          )}
          {checked && <SquareCheck size={13} className="shrink-0 text-accent" />}
        </div>
      </div>
      <span className="mt-1.5 w-full truncate font-medium text-ink" title={entry.name}>{entry.name}</span>
      <span className="mt-0.5 w-full truncate text-sm text-ink-muted" title={entry.summary || undefined}>{entry.summary || '—'}</span>
    </button>
  )
}

function PinAddModal({ onClose }: { onClose: () => void }): JSX.Element {
  const allItems = useContentStore((s) => s.visibleItems)
  const pinnedIds = useContentStore((s) => s.pinnedIds)
  const pin = useContentStore((s) => s.pin)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<ContentType | 'all'>('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [previewEntry, setPreviewEntry] = useState<ContentEntry | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds])

  const availableTypes = useMemo(() => {
    const present = new Set(allItems.map((i) => i.type))
    return (Object.keys(CONTENT_TYPE_LABELS) as ContentType[]).filter(
      (t) => present.has(t) && t !== 'homebrew'
    )
  }, [allItems])

  const availableSources = useMemo(() => {
    const worlds = new Set(allItems.map((i) => i.world).filter(Boolean) as string[])
    return Array.from(worlds).sort()
  }, [allItems])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    const byType = typeFilter === 'all' ? allItems : allItems.filter((i) => i.type === typeFilter)
    const bySource = sourceFilter === 'all' ? byType : byType.filter((i) => i.world === sourceFilter)
    return q ? bySource.filter((i) => i.name.toLowerCase().includes(q)) : bySource
  }, [allItems, query, typeFilter, sourceFilter])

  const handleSelect = (entry: ContentEntry): void => {
    setPreviewEntry(entry)
    setPendingIds((prev) => {
      const next = new Set(prev)
      if (next.has(entry.id)) next.delete(entry.id)
      else next.add(entry.id)
      return next
    })
  }

  const doPin = (closeAfter = false): void => {
    if (pendingIds.size === 0) return
    for (const id of pendingIds) pin(id)
    setPendingIds(new Set())
    if (closeAfter) {
      onClose()
    } else {
      searchRef.current?.focus()
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-8"
    >
      <div
        className="panel mt-[8vh] flex h-[72vh] w-[820px] max-w-full flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Add to board</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Search + source + type filters */}
        <div className="shrink-0 border-b border-border px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                size={13}
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-muted"
              />
              <input
                ref={searchRef}
                className="input h-8 w-full pl-7 text-sm"
                placeholder="Search library…"
                value={query}
                autoFocus
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {availableSources.length > 0 && (
              <select
                className="input h-8 w-auto shrink-0 text-sm"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
              >
                <option value="all">All sources</option>
                {availableSources.map((src) => (
                  <option key={src} value={src}>{src}</option>
                ))}
              </select>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(['all', ...availableTypes] as Array<ContentType | 'all'>).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                  typeFilter === t
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-ink-muted hover:border-accent/60 hover:text-ink'
                )}
              >
                {t === 'all' ? 'All' : CONTENT_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1">
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {filtered.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
                {filtered.map((entry) => (
                  <PinPickCard
                    key={entry.id}
                    entry={entry}
                    checked={pendingIds.has(entry.id)}
                    preview={previewEntry?.id === entry.id}
                    pinned={pinnedSet.has(entry.id)}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-ink-muted">
                {query.trim() ? `No matches for "${query.trim()}".` : 'Nothing in library yet.'}
              </p>
            )}
          </div>

          {previewEntry && (
            <div className="flex w-[280px] shrink-0 flex-col border-l border-border">
              <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Details</span>
                <button type="button" className="icon-btn" onClick={() => setPreviewEntry(null)}>
                  <PanelRightClose size={15} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <ContentDetail entry={previewEntry} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-3">
          {pendingIds.size > 0 && (
            <span className="mr-auto text-xs text-ink-muted">{pendingIds.size} selected</span>
          )}
          <button
            type="button"
            className="btn-ghost"
            disabled={pendingIds.size === 0}
            onClick={() => doPin(true)}
          >
            Add and close
          </button>
          <button
            type="button"
            className="btn-accent"
            disabled={pendingIds.size === 0}
            onClick={() => doPin()}
          >
            <Plus size={14} />
            Add to board
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- pins dash section -----------------------------------------------------

function PinsDashSection({
  expanded,
  onToggle
}: {
  expanded: boolean
  onToggle: () => void
}): JSX.Element {
  const [addOpen, setAddOpen] = useState(false)

  return (
    <div className="panel flex h-full min-h-0 flex-col overflow-hidden">
      {/* px-4 (not the px-3 other panel headers use) to line up with the
          cards grid below, which sits at a 16px (p-4) inset. */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Pinned cards</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex h-[26px] items-center gap-1 rounded-md bg-accent px-2.5 text-xs font-medium text-accent-fg hover:bg-accent-strong"
          >
            <Plus size={13} />
            Add
          </button>
          <button
            type="button"
            className="icon-btn h-5 w-5"
            title={expanded ? 'Minimize' : 'Expand'}
            onClick={onToggle}
          >
            {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <PinnedBoard onAdd={() => setAddOpen(true)} />
      </div>
      {addOpen && <PinAddModal onClose={() => setAddOpen(false)} />}
    </div>
  )
}

// ---- pinned cards board ----------------------------------------------------

// One grid column/row = exactly one card's width/height, so resizing steps in
// whole cards (2 wide, 2 tall, ...) instead of arbitrary pixel amounts. Both
// the column count and the row height scale with the panel's actual size
// (cardsPerRowFor / rowHeightFor) so cards fill it edge to edge in both
// directions — targeting ~5 across and ~3 visible rows at a typical panel
// size, more/fewer at other sizes, rather than a fixed pixel grid.
const CARD_MARGIN: [number, number] = [12, 12]
const DEFAULT_CARD_W = 1
const DEFAULT_CARD_H = 1
const IDEAL_CARD_WIDTH = 220
const TARGET_VISIBLE_ROWS = 3
const MIN_ROW_HEIGHT = 70
const ADD_TILE_ID = '__add__'

// Rough estimate of everything above the summary text (padding, badge row,
// name line) so its available height — and therefore how many lines of
// summary text fit — can be derived from the card's actual pixel height.
const CARD_CONTENT_OVERHEAD = 80
const SUMMARY_LINE_HEIGHT = 20

function cardHeightPx(h: number, rowHeightPx: number): number {
  return h * rowHeightPx + Math.max(0, h - 1) * CARD_MARGIN[1]
}

function summaryMaxLinesFor(heightPx: number): number {
  return Math.max(1, Math.floor((heightPx - CARD_CONTENT_OVERHEAD) / SUMMARY_LINE_HEIGHT))
}

function cardsPerRowFor(width: number): number {
  // Round rather than floor — flooring always biases toward cards wider than
  // ideal (sometimes a lot, right after a column drops); rounding keeps
  // actual card width closer to IDEAL_CARD_WIDTH on average.
  return Math.max(1, Math.round(width / IDEAL_CARD_WIDTH))
}

function rowHeightFor(height: number): number {
  const perRow = (height - CARD_MARGIN[1] * (TARGET_VISIBLE_ROWS + 1)) / TARGET_VISIBLE_ROWS
  return Math.max(MIN_ROW_HEIGHT, perRow)
}

/** Position right after the last item in reading order (bottom row, then its
 * rightmost edge) — unlike findFirstOpenSlot, this never jumps backward into
 * a gap a user just created by dragging a card away from its old spot. Used
 * for the Add tile specifically, since it visibly "teleporting" into a
 * freshly-vacated gap after every drag was confusing. */
function findEndSlot(items: LayoutItem[], cols: number, w: number): { x: number; y: number } {
  if (items.length === 0) return { x: 0, y: 0 }
  const maxY = items.reduce((max, it) => Math.max(max, it.y), 0)
  const lastRow = items.filter((it) => it.y === maxY)
  const rightEdge = lastRow.reduce((max, it) => Math.max(max, it.x + it.w), 0)
  const rowHeight = lastRow.reduce((max, it) => Math.max(max, it.h), 1)
  if (rightEdge + w <= cols) return { x: rightEdge, y: maxY }
  return { x: 0, y: maxY + rowHeight }
}

function CardResizeHandle(_axis: ResizeHandleAxis, ref: Ref<HTMLElement>): ReactElement {
  return (
    <div
      ref={ref as Ref<HTMLDivElement>}
      className="react-resizable-handle react-resizable-handle-se z-10 flex !h-6 !w-6 cursor-se-resize items-center justify-center rounded-tl-md bg-surface-3/80 text-ink-muted hover:text-ink"
    >
      <MoveDiagonal2 size={13} className="pointer-events-none" />
    </div>
  )
}

const pinnedLayoutKey = (): string =>
  `pinnedLayout:${getActiveCampaignId()}:${getActiveSessionId()}`

/** Saved alongside the positions themselves — if the panel's current column
 * count doesn't match what the layout was saved under (window/panel
 * resized to a different width bracket since), the old x/y values no longer
 * make sense: cards would leave newly-available columns sitting empty
 * forever since they just keep reusing coordinates sized for the old column
 * count. Detecting the mismatch and re-flowing everything beats a
 * permanently stuck gap. */
interface SavedPinnedLayout {
  cardsPerRow: number
  items: Layout
}

function isSavedPinnedLayout(value: unknown): value is SavedPinnedLayout {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as SavedPinnedLayout).cardsPerRow === 'number' &&
    Array.isArray((value as SavedPinnedLayout).items)
  )
}

function PinnedBoard({ onAdd }: { onAdd: () => void }): JSX.Element {
  const items = useContentStore((s) => s.items)
  const pinnedIds = useContentStore((s) => s.pinnedIds)

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const validPinnedIds = useMemo(() => pinnedIds.filter((id) => byId.has(id)), [pinnedIds, byId])
  const pinned = useMemo(
    () => validPinnedIds.map((id) => byId.get(id) as ContentEntry),
    [validPinnedIds, byId]
  )

  const { width, height, ref } = useContainerSize()
  const cardsPerRow = cardsPerRowFor(width)
  const rowHeight = rowHeightFor(height)
  const [savedLayout, setSavedLayout] = useState<Layout>([])
  const [savedCardsPerRow, setSavedCardsPerRow] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)

  // A genuine drag/resize is followed by a native click on mouseup, which
  // would otherwise pop open the card's detail drawer — annoying when all
  // you're doing is rearranging. Only suppress it when the position/size
  // actually changed, so a real click (no movement) still opens the card.
  const suppressNextClickRef = useRef(false)

  // While dragging (not resizing), cap the grid at the rows already in use
  // so a card can't be dragged down past the last row into new, otherwise-
  // empty space — reordering should only ever move a card among existing
  // rows. Resizing still needs room to grow past the current bottom row
  // (e.g. making the last row's card taller), so it's left uncapped.
  const [dragMaxRows, setDragMaxRows] = useState<number | null>(null)
  const onDragStart = (): void => {
    const rows = displayLayout.reduce((max, item) => Math.max(max, item.y + item.h), 0)
    setDragMaxRows(rows)
  }

  // A drag/resize is a reorder, not a free placement — repack (via persist,
  // defined below) into a gap-free sequence in the new reading order so a
  // card can never end up sitting past where the Add tile belongs, and there
  // is never a lasting empty slot between cards.
  const onDragOrResizeStop = (layout: Layout, oldItem: LayoutItem | null, newItem: LayoutItem | null): void => {
    setDragMaxRows(null)
    if (oldItem && newItem && (oldItem.x !== newItem.x || oldItem.y !== newItem.y || oldItem.w !== newItem.w || oldItem.h !== newItem.h)) {
      suppressNextClickRef.current = true
      persist(layout)
    }
  }
  const consumeClickSuppression = (): boolean => {
    if (!suppressNextClickRef.current) return false
    suppressNextClickRef.current = false
    return true
  }

  useEffect(() => {
    setLoaded(false)
    void getSetting<unknown>(pinnedLayoutKey()).then((saved) => {
      if (isSavedPinnedLayout(saved)) {
        setSavedLayout(saved.items)
        setSavedCardsPerRow(saved.cardsPerRow)
      } else {
        // Old plain-array format, or nothing saved yet — cardsPerRow unknown,
        // so treat as a mismatch below and let everything re-flow fresh.
        setSavedLayout(Array.isArray(saved) ? (saved as Layout) : [])
        setSavedCardsPerRow(null)
      }
      setLoaded(true)
    })
  }, [])

  // Unpinning drops the card from view but its old saved x/y otherwise stays
  // in this in-memory copy for the rest of the session — if the same card
  // gets pinned again before a reload, it would reuse that stale position
  // (sized for whatever layout existed back then) instead of getting a fresh
  // slot. Prune it out as soon as a card leaves validPinnedIds so a same-
  // session re-pin always re-flows cleanly. (The persisted copy is pruned
  // separately, at unpin time, in contentStore.)
  useEffect(() => {
    if (!loaded) return
    const validIds = new Set(validPinnedIds)
    setSavedLayout((prev) => {
      const pruned = prev.filter((item) => validIds.has(item.i))
      return pruned.length === prev.length ? prev : pruned
    })
  }, [validPinnedIds, loaded])

  // Drop entries for cards no longer pinned; give newly-pinned cards (no
  // saved position yet) the first open slot, same as the Add tile below — so
  // the Add tile always sits exactly where the next new card would land,
  // continuing the current row if there's room rather than always starting
  // a fresh one. If the column count doesn't match what was saved (panel
  // resized to a different width bracket), the old x/y values would leave
  // the newly-available column(s) permanently empty — ignore them and
  // re-flow everything fresh instead.
  const displayLayout = useMemo(() => {
    const columnsMatch = savedCardsPerRow === cardsPerRow
    const known = new Map(columnsMatch ? savedLayout.map((l) => [l.i, l]) : [])
    const next: LayoutItem[] = []
    for (const id of validPinnedIds) {
      const existing = known.get(id)
      if (existing) {
        next.push(existing)
        continue
      }
      const slot = findFirstOpenSlot(next, cardsPerRow, DEFAULT_CARD_W, DEFAULT_CARD_H)
      next.push({
        i: id,
        x: slot.x,
        y: slot.y,
        w: DEFAULT_CARD_W,
        h: DEFAULT_CARD_H,
        minW: 1,
        minH: 1
      })
    }
    const addSlot = findEndSlot(next, cardsPerRow, DEFAULT_CARD_W)
    next.push({
      i: ADD_TILE_ID,
      x: addSlot.x,
      y: addSlot.y,
      w: DEFAULT_CARD_W,
      h: DEFAULT_CARD_H,
      static: true
    })
    return next
  }, [savedLayout, savedCardsPerRow, validPinnedIds, cardsPerRow])

  const layoutById = useMemo(() => new Map(displayLayout.map((l) => [l.i, l])), [displayLayout])

  // Reject any drag target at or past the Add tile in reading order (same
  // row, further right, or any row after) — Add is static so it already
  // blocks landing directly on it, but cells beside/after it in an
  // under-full row are otherwise free real estate a card could be dropped
  // into. Clamping here (rather than only after drop) also keeps the drag
  // placeholder itself from ever rendering in a disallowed cell.
  const addPos = layoutById.get(ADD_TILE_ID)
  const constraints = useMemo((): LayoutConstraint[] => {
    if (!addPos) return [gridBounds, minMaxSize]
    const noPastAdd: LayoutConstraint = {
      name: 'noPastAdd',
      constrainPosition(_item, x, y, ctx) {
        const idx = y * ctx.cols + x
        const addIdx = addPos.y * ctx.cols + addPos.x
        if (idx < addIdx) return { x, y }
        const clampedIdx = Math.max(0, addIdx - 1)
        return { x: clampedIdx % ctx.cols, y: Math.floor(clampedIdx / ctx.cols) }
      }
    }
    return [gridBounds, minMaxSize, noPastAdd]
  }, [addPos?.x, addPos?.y])

  const persist = (layout: Layout): void => {
    const real = layout.filter((l) => l.i !== ADD_TILE_ID)
    const repacked = repackByReadingOrder(real, cardsPerRow)
    setSavedLayout(repacked)
    setSavedCardsPerRow(cardsPerRow)
    void setSetting(pinnedLayoutKey(), { cardsPerRow, items: repacked } satisfies SavedPinnedLayout)
  }

  if (pinned.length === 0) {
    return (
      <EmptyState
        icon={LayoutGrid}
        title="No pinned cards"
        description="Pin spells, monsters, items and more from the Library to keep them on this session's board."
      >
        <button type="button" className="btn-accent" onClick={onAdd}>
          <Plus size={16} />
          Add
        </button>
      </EmptyState>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* clientWidth/clientHeight of the padded div above would include the
          padding itself, telling the grid it has more room than it actually
          does and leaving a gap on the right — measure this inner,
          padding-free wrapper instead so it matches the grid's real space. */}
      <div ref={ref} className="h-full w-full">
        {width > 0 && height > 0 && loaded && (
          <GridLayout
            width={width}
            layout={displayLayout}
            gridConfig={{
              cols: cardsPerRow,
              rowHeight,
              margin: CARD_MARGIN,
              containerPadding: [0, 0],
              maxRows: dragMaxRows ?? Infinity
            }}
            dragConfig={{ handle: '.card-drag-handle', cancel: 'button', threshold: 8 }}
            resizeConfig={{ handles: ['se'], handleComponent: CardResizeHandle }}
            constraints={constraints}
            onDragStart={onDragStart}
            onDragStop={onDragOrResizeStop}
            onResizeStop={onDragOrResizeStop}
          >
            {pinned.map((entry) => {
              const h = layoutById.get(entry.id)?.h ?? DEFAULT_CARD_H
              const maxLines = summaryMaxLinesFor(cardHeightPx(h, rowHeight))
              return (
                <div key={entry.id} className="h-full w-full overflow-hidden">
                  <ContentCard
                    entry={entry}
                    draggable
                    dragHandleClassName="card-drag-handle"
                    summaryMaxLines={maxLines}
                    onBeforeClick={consumeClickSuppression}
                  />
                </div>
              )
            })}
            <div key={ADD_TILE_ID} className="h-full w-full">
              <button
                type="button"
                onClick={onAdd}
                className="btn-accent flex h-full w-full flex-col items-center justify-center gap-1.5"
              >
                <Plus size={18} />
                Add
              </button>
            </div>
          </GridLayout>
        )}
      </div>
    </div>
  )
}

// ---- archive view ----------------------------------------------------------

function ArchiveView(): JSX.Element {
  const sessions = useSessionStore((s) => s.sessions)
  const activeId = useSessionStore((s) => s.activeId)

  const archived = useMemo(
    () =>
      sessions
        .filter((s) => s.id !== activeId)
        .sort((a, b) => b.createdAt - a.createdAt),
    [sessions, activeId]
  )

  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Auto-select first when list changes
  useEffect(() => {
    if (archived.length > 0 && (!selectedId || !archived.find((s) => s.id === selectedId))) {
      setSelectedId(archived[0].id)
    }
  }, [archived, selectedId])

  if (archived.length === 0) {
    return (
      <EmptyState
        icon={Archive}
        title="No archived sessions yet"
        description="When you start a new session, the previous one moves here."
      />
    )
  }

  const selected = archived.find((s) => s.id === selectedId)

  return (
    <div className="flex h-full min-h-0">
      {/* session list */}
      <div className="flex w-48 shrink-0 flex-col border-r border-border">
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {archived.map((s) => (
            <div
              key={s.id}
              className={cn(
                'group flex items-center rounded-md transition-colors',
                selectedId === s.id ? 'bg-accent/15' : 'hover:bg-surface-3'
              )}
            >
              <button
                type="button"
                onClick={() => setSelectedId(s.id)}
                className="min-w-0 flex-1 px-3 py-2 text-left"
              >
                <p className={cn('truncate text-sm font-medium', selectedId === s.id ? 'text-ink' : 'text-ink-muted group-hover:text-ink')}>{s.name}</p>
                <p className="text-[11px] text-ink-muted">{fmtDate(s.createdAt)}</p>
              </button>
              <button
                type="button"
                title="Delete session"
                onClick={() => {
                  if (window.confirm(`Delete "${s.name}"? Its notes, pins and initiative will be permanently removed.`)) {
                    void useSessionStore.getState().remove(s.id)
                  }
                }}
                className="mr-1 shrink-0 rounded p-1 text-ink-muted opacity-0 hover:text-danger group-hover:opacity-100"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* detail */}
      <div className="min-w-0 flex-1 overflow-y-auto">
        {selected ? (
          <ArchiveSessionDetail key={selected.id} session={selected} />
        ) : null}
      </div>
    </div>
  )
}

// ---- archived session detail -----------------------------------------------

function ArchiveSessionDetail({ session }: { session: DashSession }): JSX.Element {
  const campaignId = getActiveCampaignId()
  const allItems = useContentStore((s) => s.items)
  const rename = useSessionStore((s) => s.rename)

  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(session.name)
  const [notes, setNotes] = useState<Note[]>([])
  const [pinnedIds, setPinnedIds] = useState<string[]>([])
  const [combatUnits, setCombatUnits] = useState<CombatUnit[]>([])
  const [loaded, setLoaded] = useState(false)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    setLoaded(false)
    const load = async (): Promise<void> => {
      const [n, p, c] = await Promise.all([
        getSetting<Note[]>(`notes:${campaignId}:${session.id}`),
        getSetting<string[]>(`pinnedIds:${campaignId}:${session.id}`),
        getSetting<{ units: CombatUnit[] }>(`combatState:${campaignId}:${session.id}`)
      ])
      setNotes(n ?? [])
      setPinnedIds(p ?? [])
      setCombatUnits(c?.units ?? [])
      setLoaded(true)
    }
    void load()
  }, [session.id, campaignId])

  const persistNotes = async (next: Note[]): Promise<void> => {
    setNotes(next)
    await setSetting(`notes:${campaignId}:${session.id}`, next)
  }

  const addNote = (): void => {
    const t = draft.trim()
    if (!t) return
    void persistNotes([
      ...notes,
      { id: crypto.randomUUID(), text: t, createdAt: Date.now() }
    ])
    setDraft('')
  }

  const removeNote = (id: string): void => void persistNotes(notes.filter((n) => n.id !== id))

  const saveEdit = (): void => {
    if (editName.trim()) rename(session.id, editName)
    setIsEditing(false)
  }

  const cancelEdit = (): void => {
    setEditName(session.name)
    setIsEditing(false)
  }

  const pinnedEntries = useMemo(
    () => pinnedIds.map((id) => allItems.find((i) => i.id === id)).filter(Boolean) as ContentEntry[],
    [pinnedIds, allItems]
  )

  if (!loaded) {
    return <p className="p-6 text-sm text-ink-muted">Loading…</p>
  }

  return (
    <div className="space-y-6 p-6">
      {/* header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <input
              className="input w-full text-base font-semibold"
              value={editName}
              autoFocus
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit()
                if (e.key === 'Escape') cancelEdit()
              }}
            />
          ) : (
            <h2 className="truncate text-lg font-semibold text-ink">{session.name}</h2>
          )}
          <p className="mt-0.5 text-xs text-ink-muted">{fmtDate(session.createdAt)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isEditing ? (
            <>
              <button type="button" className="btn-ghost" onClick={cancelEdit}>
                Cancel
              </button>
              <button type="button" className="btn-accent" onClick={saveEdit}>
                <Check size={14} />
                Done
              </button>
            </>
          ) : (
            <button type="button" className="btn-outline" onClick={() => setIsEditing(true)}>
              <Pencil size={13} />
              Edit
            </button>
          )}
        </div>
      </div>

      {/* notes */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Notes{notes.length > 0 && ` (${notes.length})`}
        </h3>

        {isEditing && (
          <div className="space-y-2">
            <textarea
              className="input min-h-[60px] w-full resize-none"
              placeholder="Add a note… (⌘+Enter to add)"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  addNote()
                }
              }}
            />
            <button
              type="button"
              className="btn-outline"
              disabled={!draft.trim()}
              onClick={addNote}
            >
              <Plus size={14} />
              Add note
            </button>
          </div>
        )}

        {notes.length === 0 ? (
          <p className="text-sm text-ink-muted">No notes for this session.</p>
        ) : (
          <div className="space-y-2">
            {[...notes].reverse().map((n) => (
              <div key={n.id} className="rounded-md border border-border bg-surface-2 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="whitespace-pre-wrap text-sm text-ink">{n.text}</p>
                  {isEditing && (
                    <button
                      type="button"
                      className="icon-btn h-6 w-6 shrink-0 hover:text-danger"
                      title="Delete note"
                      onClick={() => removeNote(n.id)}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-ink-muted">{fmtDate(n.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* pinned cards */}
      {pinnedEntries.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Pinned cards ({pinnedEntries.length})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {pinnedEntries.map((e) => (
              <span key={e.id} className="chip">{e.name}</span>
            ))}
          </div>
        </section>
      )}

      {/* initiative */}
      {combatUnits.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Initiative ({combatUnits.length})
          </h3>
          <div className="space-y-1">
            {[...combatUnits].sort((a, b) => b.initiative - a.initiative).map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 rounded-md border border-border px-3 py-1.5 text-sm"
              >
                <span className="w-6 text-center text-xs font-semibold text-accent">
                  {u.initiative}
                </span>
                <span className="flex-1 text-ink">{u.name}</span>
                <span className="text-xs text-ink-muted">
                  {u.hpCurrent}/{u.hpMax} HP
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {pinnedEntries.length === 0 && combatUnits.length === 0 && notes.length === 0 && (
        <p className="text-sm text-ink-muted">Nothing recorded for this session.</p>
      )}
    </div>
  )
}
