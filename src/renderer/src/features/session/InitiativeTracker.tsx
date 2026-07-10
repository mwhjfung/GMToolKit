import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  Dices,
  SkipForward,
  RotateCcw,
  Plus,
  X,
  Swords,
  Lock,
  LockOpen,
  Search,
  PanelRightClose,
  Users
} from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { ContentDetail } from '@/components/ContentDetail'
import { useCombatStore, type CombatUnit } from '@/lib/store/combatStore'
import { useContentStore } from '@/lib/store/contentStore'
import { useUiStore } from '@/lib/store/uiStore'
import { ConditionsCell } from './ConditionsCell'
import { TypeBadge, SourceTag } from '@/components/ContentBadge'
import { cn } from '@/lib/cn'
import type { ContentEntry } from '@/types/content'

const parseHp = (s: string | undefined): number => (s ? parseInt(s, 10) || 0 : 0)

function hpColor(current: number, max: number): string {
  if (max <= 0) return 'bg-ink-faint'
  const pct = current / max
  if (pct > 0.5) return 'bg-success'
  if (pct > 0.25) return 'bg-amber-400'
  return 'bg-danger'
}

// ---- temp HP pie (mirrors the one in SheetView) -----------------------------

function TempHpPie({ value, max }: { value: number; max: number }): JSX.Element {
  const size = 22
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 1.5
  const pct = max > 0 ? Math.min(1, value / max) : 0

  let wedge: string | null = null
  if (pct > 0 && pct < 1) {
    const start = -Math.PI / 2
    const end = start + pct * 2 * Math.PI
    const x1 = cx + r * Math.cos(start)
    const y1 = cy + r * Math.sin(start)
    const x2 = cx + r * Math.cos(end)
    const y2 = cy + r * Math.sin(end)
    wedge = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${pct > 0.5 ? 1 : 0} 1 ${x2} ${y2} Z`
  }

  return (
    <svg width={size} height={size} className="shrink-0" aria-hidden>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={1.5} className="text-blue-400/30" />
      {pct >= 1 && <circle cx={cx} cy={cy} r={r} className="fill-blue-400/70" />}
      {wedge && <path d={wedge} className="fill-blue-400/70" />}
    </svg>
  )
}

// ---- monster pick card (for the add modal) ----------------------------------

function EntryPickCard({
  entry,
  selected,
  onSelect
}: {
  entry: ContentEntry
  selected: boolean
  onSelect: (e: ContentEntry) => void
}): JSX.Element {
  return (
    <button
      type="button"
      data-entry-id={entry.id}
      onClick={() => onSelect(entry)}
      className={cn(
        'panel flex w-full flex-col gap-1 overflow-hidden p-3 text-left focus:outline-none',
        selected
          ? 'border-accent bg-accent/5'
          : 'hover:border-accent/70 hover:bg-accent/5'
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <TypeBadge type={entry.type} />
        <SourceTag source={entry.source} homebrew={entry.homebrew} />
      </div>
      <span className="mt-1.5 w-full truncate font-medium text-ink" title={entry.name}>{entry.name}</span>
      <span className="mt-0.5 w-full truncate text-sm text-ink-muted" title={entry.summary || undefined}>{entry.summary || '—'}</span>
    </button>
  )
}

// ---- add combatant modal (card view) ----------------------------------------

function AddCombatantModal({ onClose }: { onClose: () => void }): JSX.Element {
  const addUnit = useCombatStore((s) => s.addUnit)
  const monsters = useContentStore((s) => s.visibleItems.filter((i) => i.type === 'monster'))
  const [query, setQuery] = useState('')
  const [init, setInit] = useState('')
  const [count, setCount] = useState(1)
  const [sourceFilter, setSourceFilter] = useState('all')
  const [selectedEntry, setSelectedEntry] = useState<ContentEntry | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const availableSources = useMemo(() => {
    const worlds = new Set(monsters.map((m) => m.world).filter(Boolean) as string[])
    return Array.from(worlds).sort()
  }, [monsters])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    const bySource = sourceFilter === 'all' ? monsters : monsters.filter((m) => m.world === sourceFilter)
    return q ? bySource.filter((m) => m.name.toLowerCase().includes(q)) : bySource
  }, [monsters, query, sourceFilter])

  const rollInit = (): void => setInit(String(Math.floor(Math.random() * 20) + 1))

  const handleSelect = (entry: ContentEntry): void => {
    setSelectedEntry((prev) => (prev?.id === entry.id ? null : entry))
  }

  const canAdd = selectedEntry !== null || query.trim().length > 0

  const doAdd = (closeAfter = false): void => {
    const n = Math.max(1, Math.floor(Number(count) || 1))
    const initVal = init !== '' ? Number(init) : 0
    if (selectedEntry) {
      const hpMax = parseHp((selectedEntry.data as { hp?: string }).hp)
      for (let i = 0; i < n; i++) {
        addUnit({
          name: n > 1 ? `${selectedEntry.name} ${i + 1}` : selectedEntry.name,
          contentId: selectedEntry.id,
          isPC: false,
          initiative: initVal,
          locked: false,
          hpCurrent: hpMax,
          hpMax,
          hpTemp: 0,
          conditions: []
        })
      }
    } else {
      const trimmed = query.trim()
      if (!trimmed) return
      for (let i = 0; i < n; i++) {
        addUnit({
          name: n > 1 ? `${trimmed} ${i + 1}` : trimmed,
          isPC: false,
          initiative: initVal,
          locked: false,
          hpCurrent: 0,
          hpMax: 0,
          hpTemp: 0,
          conditions: []
        })
      }
    }
    setQuery('')
    setSelectedEntry(null)
    setCount(1)
    setInit('')
    if (closeAfter) {
      onClose()
    } else {
      searchRef.current?.focus()
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-8"
    >
      <div
        className="panel mt-[8vh] flex h-[72vh] w-[820px] flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Add to initiative</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Search + Source */}
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
          <div className="relative min-w-0 flex-1">
            <Search
              size={13}
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              ref={searchRef}
              className="input h-8 pl-7 text-sm"
              placeholder="Search library or enter name…"
              value={query}
              autoFocus
              onChange={(e) => {
                setQuery(e.target.value)
                setSelectedEntry(null)
              }}
            />
          </div>
          {availableSources.length > 0 && (
            <select
              className="input h-8 w-auto shrink-0 text-sm"
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value)
                setSelectedEntry(null)
              }}
            >
              <option value="all">All sources</option>
              {availableSources.map((src) => (
                <option key={src} value={src}>{src}</option>
              ))}
            </select>
          )}
        </div>

        {/* Body: card grid + detail panel side-by-side */}
        <div className="flex min-h-0 flex-1">
          {/* Card grid */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {filtered.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
                {filtered.map((entry) => (
                  <EntryPickCard
                    key={entry.id}
                    entry={entry}
                    selected={selectedEntry?.id === entry.id}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8">
                <p className="text-sm text-ink-muted">
                  {query.trim() ? `No matches for "${query.trim()}".` : 'No monsters in library yet.'}
                </p>
              </div>
            )}
          </div>

          {/* Detail panel (right drawer) */}
          {selectedEntry && (
            <div className="flex w-[280px] shrink-0 flex-col border-l border-border">
              <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Details</span>
                <button type="button" className="icon-btn" title="Close drawer" onClick={() => setSelectedEntry(null)}>
                  <PanelRightClose size={15} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <ContentDetail entry={selectedEntry} hideAddToInitiative />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-3">
          {/* Left: Initiative + Count */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-ink-muted">Initiative</span>
              <input
                className="input h-8 w-14 text-center text-sm"
                type="number"
                value={init}
                placeholder="—"
                onChange={(e) => setInit(e.target.value)}
              />
              <button
                type="button"
                className="icon-btn h-8 w-8 shrink-0"
                title="Roll d20"
                onClick={rollInit}
              >
                <Dices size={14} />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-ink-muted">Count</span>
              <input
                className="input h-8 w-14 text-center text-sm"
                type="number"
                min={1}
                value={count}
                onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
          </div>
          {/* Right: Add buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-ghost"
              disabled={!canAdd}
              onClick={() => doAdd(true)}
            >
              Add and close
            </button>
            <button
              type="button"
              className="btn-accent"
              disabled={!canAdd}
              onClick={() => doAdd()}
            >
              <Plus size={14} />
              Add to initiative
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- combat row -------------------------------------------------------------

function CombatRow({
  unit,
  current,
  style
}: {
  unit: CombatUnit
  current: boolean
  style?: CSSProperties
}): JSX.Element {
  const update = useCombatStore((s) => s.updateUnit)
  const remove = useCombatStore((s) => s.removeUnit)
  const sort = useCombatStore((s) => s.sort)
  const openDrawer = useUiStore((s) => s.openDrawer)
  const [amt, setAmt] = useState('')
  const [tempHpMax, setTempHpMax] = useState(unit.hpTemp)

  const applyDamage = (sign: number): void => {
    const n = Number(amt)
    if (!n) return
    if (sign > 0 && unit.hpTemp > 0) {
      const tempDrain = Math.min(unit.hpTemp, n)
      const remaining = n - tempDrain
      update(unit.id, {
        hpTemp: unit.hpTemp - tempDrain,
        hpCurrent: Math.max(0, Math.min(unit.hpMax, unit.hpCurrent - remaining))
      })
    } else {
      update(unit.id, { hpCurrent: Math.max(0, Math.min(unit.hpMax, unit.hpCurrent - sign * n)) })
    }
    setAmt('')
  }

  return (
    <div
      style={style}
      className={cn(
        'flex items-center gap-3 rounded-lg border p-2.5 transition-opacity',
        current ? 'border-accent bg-accent/5' : 'border-border bg-surface opacity-50 hover:opacity-100'
      )}
    >
      {/* Remove button */}
      <button
        type="button"
        className="icon-btn h-7 w-7 shrink-0 self-center hover:text-danger"
        title="Remove"
        onClick={() => remove(unit.id)}
      >
        <X size={15} />
      </button>

      {/* Initiative column */}
      <div className="flex w-12 shrink-0 flex-col items-center gap-0.5">
        <input
          type="number"
          value={unit.initiative}
          onChange={(e) => update(unit.id, { initiative: Number(e.target.value) })}
          onBlur={sort}
          className="w-12 rounded bg-surface-2 py-0.5 text-center text-lg font-semibold text-ink focus:outline-none"
        />
        <div className="flex items-center gap-1">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">init</span>
          <button
            type="button"
            title={unit.locked ? 'Unlock — Roll all can change it' : 'Lock — Roll all leaves it alone'}
            onClick={() => update(unit.id, { locked: !unit.locked })}
            className={cn('hover:text-ink', unit.locked ? 'text-accent' : 'text-ink-muted')}
          >
            {unit.locked ? <Lock size={12} /> : <LockOpen size={12} />}
          </button>
        </div>
      </div>

      {/* Name + conditions */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {current && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
          {unit.contentId ? (
            <button
              type="button"
              className="truncate font-medium text-ink hover:text-accent"
              onClick={() => unit.contentId && openDrawer(unit.contentId)}
            >
              {unit.name}
            </button>
          ) : (
            <span className="truncate font-medium text-ink">{unit.name}</span>
          )}
          {unit.isPC && (
            <span className="rounded bg-info/15 px-1 text-[10px] font-semibold uppercase text-info">PC</span>
          )}
        </div>
        <div className="mt-1.5">
          <ConditionsCell
            conditions={unit.conditions}
            onChange={(next) => update(unit.id, { conditions: next })}
          />
        </div>
      </div>

      {/* HP panel — styled like the character sheet */}
      <div className="flex shrink-0 flex-col gap-1.5 self-center">
        {/* Bar + temp pie */}
        <div className="flex items-center gap-2">
          <div className="h-2.5 min-w-[72px] flex-1 overflow-hidden rounded-full bg-surface-3">
            <div
              className={cn('h-full transition-all', hpColor(unit.hpCurrent, unit.hpMax))}
              style={{ width: `${unit.hpMax ? Math.min(100, (unit.hpCurrent / unit.hpMax) * 100) : 0}%` }}
            />
          </div>
          <TempHpPie value={unit.hpTemp} max={tempHpMax} />
        </div>
        {/* HP controls + temp HP inline */}
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={unit.hpCurrent}
            onChange={(e) => update(unit.id, { hpCurrent: Number(e.target.value) })}
            className="w-12 rounded bg-surface-2 px-1 py-0.5 text-center text-sm text-ink focus:outline-none"
          />
          <span className="text-ink-muted">/</span>
          <input
            type="number"
            value={unit.hpMax}
            onChange={(e) => update(unit.id, { hpMax: Number(e.target.value) })}
            className="w-12 rounded bg-surface-2 px-1 py-0.5 text-center text-sm text-ink-muted focus:outline-none"
          />
          <input
            type="number"
            value={amt}
            placeholder="±"
            onChange={(e) => setAmt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyDamage(1)}
            className="ml-1 w-10 rounded border border-border bg-surface-2 px-1 py-0.5 text-center text-sm focus:outline-none"
          />
          <button
            type="button"
            className="rounded bg-danger/15 px-1.5 py-0.5 text-xs text-danger hover:bg-danger/25"
            title="Damage"
            onClick={() => applyDamage(1)}
          >
            −
          </button>
          <button
            type="button"
            className="rounded bg-success/15 px-1.5 py-0.5 text-xs text-success hover:bg-success/25"
            title="Heal"
            onClick={() => applyDamage(-1)}
          >
            +
          </button>
          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-blue-400">Tmp</span>
          <input
            type="number"
            value={unit.hpTemp}
            onChange={(e) => {
              const val = Math.max(0, Number(e.target.value))
              update(unit.id, { hpTemp: val })
              if (val > 0) setTempHpMax(val)
            }}
            title="Temporary HP"
            className="w-10 rounded bg-surface-2 px-1 py-0.5 text-center text-sm text-ink focus:outline-none"
          />
          <span className="text-ink-muted">/</span>
          <span className="text-sm text-ink-muted">{tempHpMax}</span>
        </div>
      </div>

    </div>
  )
}

// ---- initiative tracker -----------------------------------------------------

interface InitiativeTrackerProps {
  addOpen: boolean
  onCloseAdd: () => void
  onAdd: () => void
  onAddParty: () => void
}

export function InitiativeTracker({
  addOpen,
  onCloseAdd,
  onAdd,
  onAddParty
}: InitiativeTrackerProps): JSX.Element {
  const units = useCombatStore((s) => s.units)
  const round = useCombatStore((s) => s.round)
  const turnId = useCombatStore((s) => s.turnId)
  const nextTurn = useCombatStore((s) => s.nextTurn)
  const rollAll = useCombatStore((s) => s.rollAll)
  const reset = useCombatStore((s) => s.reset)
  const scrollRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [anim, setAnim] = useState<{ order: CombatUnit[]; ghost: CombatUnit; shift: number } | null>(
    null
  )

  const ordered = useMemo(() => [...units].sort((a, b) => b.initiative - a.initiative), [units])
  const turnIdx = ordered.findIndex((u) => u.id === turnId)
  const rotated = turnIdx >= 0 ? [...ordered.slice(turnIdx), ...ordered.slice(0, turnIdx)] : ordered

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [turnId])

  const advance = (): void => {
    if (anim) return
    if (rotated.length < 2) {
      nextTurn()
      return
    }
    const firstEl = listRef.current?.firstElementChild as HTMLElement | null
    const shift = -((firstEl?.offsetHeight ?? 64) + 8)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    setAnim({ order: rotated, ghost: rotated[0], shift: 0 })
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setAnim((a) => (a ? { ...a, shift } : a)))
    )
    window.setTimeout(() => {
      nextTurn()
      setAnim(null)
    }, 400)
  }
  const advanceRef = useRef(advance)
  advanceRef.current = advance

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.code !== 'Space') return
      const el = document.activeElement
      if (el && /INPUT|TEXTAREA|SELECT/.test(el.tagName)) return
      e.preventDefault()
      advanceRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const isEmpty = (anim ? anim.order : rotated).length === 0

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-muted">
            Round <span className="text-lg font-semibold text-ink">{round}</span>
          </span>
          <button type="button" className="btn-ghost" onClick={advance} disabled={!units.length}>
            <SkipForward size={15} />
            Next
            <kbd className="ml-1 rounded bg-black/20 px-1 text-[10px]">Space</kbd>
          </button>
        </div>
        {!isEmpty && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={rollAll}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink-muted hover:bg-surface-3 hover:text-ink"
            >
              <Dices size={13} />
              Roll all
            </button>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink-muted hover:bg-surface-3 hover:text-ink"
            >
              <RotateCcw size={13} />
              Reset
            </button>
          </div>
        )}
      </div>

      <div
        ref={scrollRef}
        className={cn('min-h-0 flex-1 p-4', anim ? 'overflow-hidden' : 'overflow-y-auto')}
      >
        {isEmpty ? (
          <EmptyState
            icon={Swords}
            title="No combatants"
            description="Add players and monsters, roll initiative, and run the fight — Space advances the turn."
          >
            <div className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={onAddParty}>
                <Users size={15} />
                Add party
              </button>
              <button type="button" className="btn-accent" onClick={onAdd}>
                <Plus size={15} />
                Add
              </button>
            </div>
          </EmptyState>
        ) : (
          <div
            ref={listRef}
            className="space-y-2"
            style={
              anim
                ? {
                    transform: `translateY(${anim.shift}px)`,
                    transition: anim.shift !== 0 ? 'transform 380ms cubic-bezier(0.4,0,0.2,1)' : 'none'
                  }
                : undefined
            }
          >
            {(anim ? anim.order : rotated).map((u, i) => (
              <CombatRow
                key={u.id}
                unit={u}
                current={u.id === turnId}
                style={
                  anim && i === 0
                    ? { opacity: anim.shift !== 0 ? 0 : 1, transition: 'opacity 380ms ease' }
                    : anim && i === 1
                      ? { opacity: anim.shift !== 0 ? 1 : 0.5, transition: 'opacity 380ms ease' }
                      : undefined
                }
              />
            ))}
            {anim && (
              <CombatRow
                key={`ghost-${anim.ghost.id}`}
                unit={anim.ghost}
                current={false}
                style={{ opacity: anim.shift !== 0 ? 0.5 : 0, transition: 'opacity 380ms ease' }}
              />
            )}
          </div>
        )}
      </div>

      {addOpen && <AddCombatantModal onClose={onCloseAdd} />}
    </div>
  )
}
