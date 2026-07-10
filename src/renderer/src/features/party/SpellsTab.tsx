import { useMemo, useState } from 'react'
import { Plus, X, Search, Trash2, Library } from 'lucide-react'
import { usePcStore, type PcUnit, type PcSpell } from '@/lib/store/pcStore'
import { useContentStore } from '@/lib/store/contentStore'
import { useUiStore } from '@/lib/store/uiStore'
import { makeNewEntry, recomputeSummary } from '@/lib/templates/schemas'
import type { ContentEntry } from '@/types/content'
import { cn } from '@/lib/cn'

const uuid = (): string => crypto.randomUUID()

const LEVEL_LABELS: Record<number, string> = {
  0: 'Cantrips',
  1: '1st Level',
  2: '2nd Level',
  3: '3rd Level',
  4: '4th Level',
  5: '5th Level',
  6: '6th Level',
  7: '7th Level',
  8: '8th Level',
  9: '9th Level'
}

// --------------------------------------------------------------------------
// Add-spell dialog
// --------------------------------------------------------------------------

function AddSpellDialog({ pc, onClose }: { pc: PcUnit; onClose: () => void }): JSX.Element {
  const updatePc = usePcStore((s) => s.updatePc)
  const upsert = useContentStore((s) => s.upsert)
  const candidates = useContentStore((s) => s.visibleItems.filter((i) => i.type === 'spell'))
  const [q, setQ] = useState('')
  const [newName, setNewName] = useState('')
  const [mode, setMode] = useState<'search' | 'new'>('search')

  const existing = useMemo(() => new Set(pc.spells.map((s) => s.name.toLowerCase())), [pc.spells])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    const list = term ? candidates.filter((c) => c.name.toLowerCase().includes(term)) : candidates
    return [...list].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 60)
  }, [candidates, q])

  const addFromLibrary = (entry: ContentEntry): void => {
    if (existing.has(entry.name.toLowerCase())) { onClose(); return }
    const level = (entry.data as { level?: number }).level ?? 0
    const spell: PcSpell = { id: uuid(), name: entry.name, level, prepared: true, contentId: entry.id }
    updatePc(pc.id, { spells: [...pc.spells, spell] })
    onClose()
  }

  const addNew = async (): Promise<void> => {
    const name = newName.trim()
    if (!name) return
    const entry = makeNewEntry('spell')
    entry.name = name
    entry.summary = recomputeSummary(entry)
    await upsert(entry)
    const level = (entry.data as { level?: number }).level ?? 0
    const spell: PcSpell = { id: uuid(), name, level, prepared: true, contentId: entry.id }
    updatePc(pc.id, { spells: [...pc.spells, spell] })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-8"
    >
      <div
        className="panel mt-[8vh] flex max-h-[80vh] w-[460px] max-w-full flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Add spell</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="flex border-b border-border">
          {(['search', 'new'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'flex-1 border-b-2 py-2 text-sm font-medium transition-colors',
                mode === m
                  ? 'border-accent text-ink'
                  : 'border-transparent text-ink-muted hover:text-ink'
              )}
            >
              {m === 'search' ? 'From library' : 'New spell'}
            </button>
          ))}
        </div>

        {mode === 'search' ? (
          <>
            <div className="border-b border-border p-3">
              <div className="relative">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
                />
                <input
                  className="input pl-8"
                  autoFocus
                  placeholder="Search library spells…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <p className="px-2 py-4 text-center text-sm text-ink-muted">
                  No matching spells in library.
                </p>
              ) : (
                filtered.map((entry) => {
                  const level = (entry.data as { level?: number }).level ?? 0
                  const alreadyAdded = existing.has(entry.name.toLowerCase())
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      disabled={alreadyAdded}
                      onClick={() => addFromLibrary(entry)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-surface-3',
                        alreadyAdded ? 'cursor-default text-ink-muted' : 'text-ink'
                      )}
                    >
                      <span className="truncate">{entry.name}</span>
                      <span className="shrink-0 text-[10px] uppercase text-ink-muted">
                        {level === 0 ? 'Cantrip' : `Lv ${level}`}
                        {alreadyAdded && ' · added'}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-3 p-4">
            <div>
              <label className="label">Spell name</label>
              <input
                className="input"
                autoFocus
                placeholder="e.g. Fireball"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void addNew()
                }}
              />
            </div>
            <p className="text-xs text-ink-muted">
              Creates a library spell entry and adds it to this character.
            </p>
            <button
              type="button"
              className="btn-accent"
              disabled={!newName.trim()}
              onClick={() => void addNew()}
            >
              Create &amp; add
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------
// Main tab
// --------------------------------------------------------------------------

export function SpellsTab({ pc }: { pc: PcUnit }): JSX.Element {
  const updatePc = usePcStore((s) => s.updatePc)
  const openDrawer = useUiStore((s) => s.openDrawer)
  const [addOpen, setAddOpen] = useState(false)

  const patch = (id: string, p: Partial<PcSpell>): void =>
    updatePc(pc.id, { spells: pc.spells.map((s) => (s.id === id ? { ...s, ...p } : s)) })
  const remove = (id: string): void =>
    updatePc(pc.id, { spells: pc.spells.filter((s) => s.id !== id) })

  // Group spells by level, ordered 0-9. A leveled (non-cantrip) spell is also
  // echoed under every higher level the character has slots for — flagged with
  // its true level so you can see what's castable when up-casting into a bigger
  // slot. Echoes are derived for display only (the spell is stored once at its
  // native level), so they carry no prepared/remove controls of their own.
  const groups = useMemo(() => {
    const slotMax = (lvl: number): number => pc.slots.find((s) => s.level === lvl)?.max ?? 0
    const map = new Map<number, Array<{ spell: PcSpell; upcastFrom?: number }>>()
    const push = (lvl: number, entry: { spell: PcSpell; upcastFrom?: number }): void => {
      const arr = map.get(lvl) ?? []
      arr.push(entry)
      map.set(lvl, arr)
    }
    for (const spell of pc.spells) {
      const lvl = spell.level ?? 0
      push(lvl, { spell })
      // Up-cast echoes — only for prepared, leveled spells (cantrips don't use slots).
      if (lvl >= 1 && spell.prepared) {
        for (let up = lvl + 1; up <= 9; up++) {
          if (slotMax(up) > 0) push(up, { spell, upcastFrom: lvl })
        }
      }
    }
    return [...map.entries()]
      .sort(([a], [b]) => a - b)
      .map(([level, entries]) => ({
        level,
        label: LEVEL_LABELS[level] ?? `Level ${level}`,
        entries: [...entries].sort(
          (a, b) =>
            a.spell.name.localeCompare(b.spell.name) || (a.upcastFrom ?? 0) - (b.upcastFrom ?? 0)
        ),
        slot: level > 0 ? pc.slots.find((s) => s.level === level) : undefined
      }))
  }, [pc.spells, pc.slots])

  return (
    <div className="max-w-3xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-muted">
          {pc.spells.length} {pc.spells.length === 1 ? 'spell' : 'spells'}
        </span>
        <button type="button" className="btn-accent" onClick={() => setAddOpen(true)}>
          <Plus size={15} />
          Add spell
        </button>
      </div>

      {pc.spells.length === 0 ? (
        <p className="py-6 text-sm text-ink-muted">No spells yet.</p>
      ) : (
        <div className="space-y-4">
          {groups.map(({ level, label, entries, slot }) => (
            <div key={level}>
              {/* Level header */}
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {label}
                </span>
                {slot && (
                  <span
                    className={cn(
                      'text-xs',
                      slot.current === 0 ? 'text-danger' : 'text-ink-muted'
                    )}
                  >
                    {slot.current}/{slot.max} slots
                  </span>
                )}
              </div>

              {/* Spell rows */}
              <div className="space-y-1">
                {entries.map(({ spell, upcastFrom }) => (
                  <div
                    key={upcastFrom != null ? `${spell.id}@${level}` : spell.id}
                    className={cn(
                      'flex items-center gap-2 rounded-md border border-border px-3 py-1.5',
                      upcastFrom != null && 'border-dashed opacity-70'
                    )}
                  >
                    {/* Prepared checkbox — cantrips are always available; up-cast
                        echoes mirror their base spell, so they get no checkbox. */}
                    {upcastFrom != null ? (
                      <span className="w-4 shrink-0" />
                    ) : level > 0 ? (
                      <input
                        type="checkbox"
                        checked={spell.prepared}
                        title="Prepared"
                        onChange={(e) => patch(spell.id, { prepared: e.target.checked })}
                        className="shrink-0"
                      />
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}

                    {/* Spell name */}
                    {spell.contentId ? (
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left text-sm font-medium text-ink hover:text-accent"
                        title="Open in library"
                        onClick={() => spell.contentId && openDrawer(spell.contentId)}
                      >
                        {spell.name}
                      </button>
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{spell.name}</span>
                    )}

                    {/* Up-cast flag — shows the spell's true (lower) level. */}
                    {upcastFrom != null ? (
                      <span className="shrink-0 rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                        {upcastFrom === 0 ? 'Cantrip' : `Lv ${upcastFrom}`}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="icon-btn h-6 w-6 shrink-0 hover:text-danger"
                        title="Remove"
                        onClick={() => remove(spell.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {pc.spells.length > 0 && (
        <p className="flex items-center gap-1 pt-1 text-[11px] text-ink-muted">
          <Library size={12} />
          Library spells open their full entry. Prepared checkbox tracks daily preparation.
        </p>
      )}

      {addOpen && <AddSpellDialog pc={pc} onClose={() => setAddOpen(false)} />}
    </div>
  )
}
