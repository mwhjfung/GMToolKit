import { useMemo, useState } from 'react'
import { Plus, X, Trash2, Sparkles, Search, Library } from 'lucide-react'
import { usePcStore, type PcUnit, type PcItem } from '@/lib/store/pcStore'
import { useContentStore } from '@/lib/store/contentStore'
import { useUiStore } from '@/lib/store/uiStore'
import { makeNewEntry, recomputeSummary } from '@/lib/templates/schemas'
import type { ContentEntry } from '@/types/content'
import { cn } from '@/lib/cn'

const uuid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

function AddItemDialog({ pc, onClose }: { pc: PcUnit; onClose: () => void }): JSX.Element {
  const updatePc = usePcStore((s) => s.updatePc)
  const upsert = useContentStore((s) => s.upsert)
  const candidates = useContentStore((s) =>
    s.visibleItems.filter((i) => i.type === 'weapon' || i.type === 'item')
  )
  const [q, setQ] = useState('')
  const [newName, setNewName] = useState('')
  const [mode, setMode] = useState<'search' | 'new'>('search')

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    const list = term ? candidates.filter((c) => c.name.toLowerCase().includes(term)) : candidates
    return [...list].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 50)
  }, [candidates, q])

  const addFromLibrary = (entry: ContentEntry): void => {
    const item: PcItem = {
      id: uuid(),
      name: entry.name,
      quantity: 1,
      equipped: false,
      requiresAttunement: Boolean((entry.data as { attunement?: boolean }).attunement),
      attuned: false,
      contentId: entry.id,
      notes: ''
    }
    updatePc(pc.id, { inventory: [...pc.inventory, item] })
    onClose()
  }

  const addNew = async (): Promise<void> => {
    const name = newName.trim()
    if (!name) return
    // Create library entry
    const entry = makeNewEntry('item')
    entry.name = name
    entry.summary = recomputeSummary(entry)
    await upsert(entry)
    // Add to inventory linked to the new entry
    const item: PcItem = {
      id: uuid(),
      name,
      quantity: 1,
      equipped: false,
      requiresAttunement: false,
      attuned: false,
      contentId: entry.id,
      notes: ''
    }
    updatePc(pc.id, { inventory: [...pc.inventory, item] })
    onClose()
  }

  const addBlank = (): void => {
    updatePc(pc.id, {
      inventory: [
        ...pc.inventory,
        { id: uuid(), name: '', quantity: 1, equipped: false, requiresAttunement: false, attuned: false, notes: '' }
      ]
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-8">
      <div className="panel mt-[8vh] flex max-h-[80vh] w-[460px] flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Add item</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* mode toggle */}
        <div className="flex border-b border-border">
          {(['search', 'new'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'flex-1 border-b-2 py-2 text-sm font-medium transition-colors',
                mode === m ? 'border-accent text-ink' : 'border-transparent text-ink-muted hover:text-ink'
              )}
            >
              {m === 'search' ? 'From library' : 'New item'}
            </button>
          ))}
        </div>

        {mode === 'search' ? (
          <>
            <div className="border-b border-border p-3">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  className="input pl-8"
                  autoFocus
                  placeholder="Search library weapons & items…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <p className="px-2 py-4 text-center text-sm text-ink-muted">No matching library items.</p>
              ) : (
                filtered.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => addFromLibrary(entry)}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-ink hover:bg-surface-3"
                  >
                    <span className="truncate">{entry.name}</span>
                    <span className="shrink-0 text-[10px] uppercase text-ink-muted">{entry.type}</span>
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-border p-3">
              <button type="button" className="btn-outline w-full" onClick={addBlank}>
                <Plus size={15} />
                Add a custom item (no library entry)
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-3 p-4">
            <div>
              <label className="label">Item name</label>
              <input
                className="input"
                autoFocus
                placeholder="e.g. Bag of Holding"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void addNew() }}
              />
            </div>
            <p className="text-xs text-ink-muted">
              This will create a library entry for the item and add it to the inventory.
            </p>
            <button type="button" className="btn-accent" disabled={!newName.trim()} onClick={() => void addNew()}>
              Create &amp; add
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function InventoryTab({ pc }: { pc: PcUnit }): JSX.Element {
  const updatePc = usePcStore((s) => s.updatePc)
  const openDrawer = useUiStore((s) => s.openDrawer)
  const [addOpen, setAddOpen] = useState(false)

  const items = pc.inventory
  const set = (inv: PcItem[]): void => updatePc(pc.id, { inventory: inv })
  const patch = (id: string, p: Partial<PcItem>): void =>
    set(items.map((i) => (i.id === id ? { ...i, ...p } : i)))
  const remove = (id: string): void => set(items.filter((i) => i.id !== id))
  const attuned = items.filter((i) => i.attuned).length

  return (
    <div className="max-w-3xl space-y-3 p-6">
      <div className="flex items-center justify-between">
        <span className={cn('text-xs', attuned > 3 ? 'font-medium text-danger' : 'text-ink-muted')}>
          Attuned {attuned}/3
        </span>
        <button type="button" className="btn-accent" onClick={() => setAddOpen(true)}>
          <Plus size={15} />
          Add item
        </button>
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-sm text-ink-muted">Nothing carried yet.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((i) => (
            <div key={i.id} className="flex items-center gap-2 rounded-md border border-border p-2">
              <label className="flex items-center gap-1.5 text-xs text-ink-muted" title="Equipped">
                <input type="checkbox" checked={i.equipped} onChange={(e) => patch(i.id, { equipped: e.target.checked })} />
              </label>
              {i.contentId ? (
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-sm font-medium text-ink hover:text-accent"
                  title="Open in library"
                  onClick={() => i.contentId && openDrawer(i.contentId)}
                >
                  {i.name}
                </button>
              ) : (
                <input
                  className="input flex-1"
                  placeholder="Item name"
                  value={i.name}
                  onChange={(e) => patch(i.id, { name: e.target.value })}
                />
              )}
              <input
                type="number"
                min={1}
                value={i.quantity}
                onChange={(e) => patch(i.id, { quantity: Math.max(1, Number(e.target.value)) })}
                className="w-12 rounded bg-surface-2 px-1 py-0.5 text-center text-sm text-ink focus:outline-none"
                title="Quantity"
              />
              <button
                type="button"
                onClick={() => patch(i.id, { attuned: !i.attuned })}
                title={i.requiresAttunement ? 'Requires attunement — toggle attuned' : 'Toggle attuned'}
                className={cn(
                  'inline-flex h-7 items-center gap-1 rounded px-1.5 text-xs',
                  i.attuned ? 'text-accent' : 'text-ink-muted hover:text-ink'
                )}
              >
                <Sparkles size={14} className={i.attuned ? 'fill-accent' : ''} />
                {(i.attuned || i.requiresAttunement) && <span>Attune</span>}
              </button>
              <button
                type="button"
                className="icon-btn h-7 w-7 shrink-0 hover:text-danger"
                title="Remove"
                onClick={() => remove(i.id)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <p className="flex items-center gap-1 pt-1 text-[11px] text-ink-muted">
          <Library size={12} />
          Library items open their full entry — custom ones are editable inline.
        </p>
      )}

      {addOpen && <AddItemDialog pc={pc} onClose={() => setAddOpen(false)} />}
    </div>
  )
}
