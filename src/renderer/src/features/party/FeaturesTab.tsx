import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Pencil, Trash2, X, Search } from 'lucide-react'
import { usePcStore, type PcUnit, type PcFeature, type FeatureCategory } from '@/lib/store/pcStore'
import { useContentStore } from '@/lib/store/contentStore'
import { useUiStore } from '@/lib/store/uiStore'
import { cn } from '@/lib/cn'
import type { ContentEntry } from '@/types/content'

const uuid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

const CATEGORIES: Array<{ key: FeatureCategory; label: string }> = [
  { key: 'class', label: 'Class features' },
  { key: 'species', label: 'Species features' },
  { key: 'feat', label: 'Feats' },
  { key: 'other', label: 'Other' }
]

function AutoTextarea({
  value,
  onChange,
  placeholder,
  className
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}): JSX.Element {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      className={cn('input resize-none', className)}
      style={{ minHeight: '56px', overflow: 'hidden' }}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onInput={(e) => {
        const el = e.currentTarget
        el.style.height = 'auto'
        el.style.height = `${el.scrollHeight}px`
      }}
    />
  )
}

// ─── Feat-specific modal (always requires library link) ───────────────────────

type FeatModalMode = 'library' | 'new'

function FeatModal({
  initial,
  onSave,
  onClose
}: {
  initial?: PcFeature
  onSave: (f: Omit<PcFeature, 'id'>) => void
  onClose: () => void
}): JSX.Element {
  const items = useContentStore((s) => s.items)
  const upsert = useContentStore((s) => s.upsert)
  const featEntries = useMemo(() => items.filter((i) => i.type === 'feat'), [items])

  const [mode, setMode] = useState<FeatModalMode>('library')
  const [search, setSearch] = useState('')
  const [selectedEntry, setSelectedEntry] = useState<ContentEntry | null>(
    () => (initial?.contentId ? (items.find((i) => i.id === initial.contentId) ?? null) : null)
  )
  const [notes, setNotes] = useState(initial?.description ?? '')

  // "Create new" fields
  const [newName, setNewName] = useState('')
  const [newPrereq, setNewPrereq] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [initiativeBonus, setInitiativeBonus] = useState(0)
  const [acBonus, setAcBonus] = useState(0)
  const [speedBonus, setSpeedBonus] = useState(0)
  const [ppBonus, setPpBonus] = useState(0)
  const [piBonus, setPiBonus] = useState(0)

  const filteredFeats = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? featEntries.filter((f) => f.name.toLowerCase().includes(q)) : featEntries
  }, [featEntries, search])

  const canSave =
    mode === 'library' ? selectedEntry !== null : newName.trim().length > 0

  const save = async (): Promise<void> => {
    if (!canSave) return

    if (mode === 'library' && selectedEntry) {
      onSave({
        name: selectedEntry.name,
        category: 'feat',
        description: notes,
        contentId: selectedEntry.id
      })
      onClose()
      return
    }

    // Create a new library feat entry then link it
    const id = `feat-custom:${uuid()}`
    const ts = Date.now()
    const effects: Record<string, number> = {}
    if (initiativeBonus) effects.initiativeBonus = initiativeBonus
    if (acBonus) effects.acBonus = acBonus
    if (speedBonus) effects.speedBonus = speedBonus
    if (ppBonus) effects.passivePerceptionBonus = ppBonus
    if (piBonus) effects.passiveInvestigationBonus = piBonus

    await upsert({
      id,
      source: 'custom',
      name: newName.trim(),
      summary: newPrereq ? `Prerequisite: ${newPrereq}` : 'Feat',
      tags: [],
      notes: '',
      createdAt: ts,
      updatedAt: ts,
      type: 'feat',
      data: {
        prerequisite: newPrereq,
        description: newDesc,
        ...effects
      }
    })

    onSave({
      name: newName.trim(),
      category: 'feat',
      description: notes,
      contentId: id
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-8"
    >
      <div className="panel w-[520px] max-w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">
            {initial ? 'Edit feat' : 'Add feat'}
          </h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Mode toggle */}
        {!initial && (
          <div className="flex border-b border-border">
            {(['library', 'new'] as FeatModalMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'flex-1 py-2 text-sm font-medium transition-colors',
                  mode === m
                    ? 'border-b-2 border-accent text-ink'
                    : 'text-ink-muted hover:text-ink'
                )}
              >
                {m === 'library' ? 'From library' : 'Create new'}
              </button>
            ))}
          </div>
        )}

        <div className="max-h-[60vh] space-y-3 overflow-y-auto p-4">
          {mode === 'library' || initial ? (
            <>
              {!initial && (
                <div>
                  <label className="label">Search library feats</label>
                  <div className="relative">
                    <Search
                      size={14}
                      className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
                    />
                    <input
                      className="input pl-8"
                      placeholder="Alert, Mobile…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
              )}

              {!initial && (
                <div className="max-h-48 overflow-y-auto rounded-md border border-border">
                  {filteredFeats.length === 0 ? (
                    <p className="px-3 py-4 text-center text-sm text-ink-muted">No feats found.</p>
                  ) : (
                    filteredFeats.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setSelectedEntry(f)}
                        className={cn(
                          'flex w-full items-start gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-3',
                          selectedEntry?.id === f.id && 'bg-accent/10'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-ink">{f.name}</p>
                          <p className="truncate text-xs text-ink-muted">{f.summary}</p>
                        </div>
                        {selectedEntry?.id === f.id && (
                          <span className="shrink-0 text-xs text-accent">Selected</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}

              {initial && selectedEntry && (
                <div>
                  <label className="label">Linked feat</label>
                  <div className="rounded-md border border-border bg-surface-2 px-3 py-2">
                    <p className="text-sm font-medium text-ink">{selectedEntry.name}</p>
                    <p className="text-xs text-ink-muted">{selectedEntry.summary}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="label">Personal notes (optional)</label>
                <AutoTextarea
                  value={notes}
                  onChange={setNotes}
                  placeholder="How this feat was acquired, how the character uses it…"
                />
              </div>
            </>
          ) : (
            // Create new mode
            <>
              <div>
                <label className="label">Feat name</label>
                <input
                  className="input"
                  autoFocus
                  placeholder="e.g. Shadow Touched"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Prerequisite (optional)</label>
                <input
                  className="input"
                  placeholder="e.g. 4th level"
                  value={newPrereq}
                  onChange={(e) => setNewPrereq(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Description</label>
                <AutoTextarea
                  value={newDesc}
                  onChange={setNewDesc}
                  placeholder="What this feat does…"
                />
              </div>
              <div>
                <label className="label">Stat bonuses</label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['Initiative', initiativeBonus, setInitiativeBonus],
                      ['AC', acBonus, setAcBonus],
                      ['Speed (ft)', speedBonus, setSpeedBonus],
                      ['Passive Perc.', ppBonus, setPpBonus],
                      ['Passive Inv.', piBonus, setPiBonus]
                    ] as Array<[string, number, (n: number) => void]>
                  ).map(([label, val, setter]) => (
                    <div key={label}>
                      <label className="label">{label}</label>
                      <input
                        className="input px-2 text-center"
                        type="number"
                        value={val || ''}
                        placeholder="0"
                        onChange={(e) => setter(Number(e.target.value) || 0)}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Personal notes (optional)</label>
                <AutoTextarea
                  value={notes}
                  onChange={setNotes}
                  placeholder="How this feat was acquired…"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-accent"
            disabled={!canSave}
            onClick={() => { void save() }}
          >
            {initial ? 'Save' : 'Add feat'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Generic feature modal (class / species / other) ─────────────────────────

function FeatureModal({
  initial,
  defaultCategory,
  onSave,
  onClose
}: {
  initial?: PcFeature
  defaultCategory: FeatureCategory
  onSave: (f: Omit<PcFeature, 'id'>) => void
  onClose: () => void
}): JSX.Element {
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState<FeatureCategory>(initial?.category ?? defaultCategory)
  const [description, setDescription] = useState(initial?.description ?? '')

  const save = (): void => {
    if (!name.trim()) return
    onSave({ name: name.trim(), category, description, contentId: undefined })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-8"
    >
      <div className="panel w-[500px] max-w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">
            {initial ? 'Edit feature' : 'Add feature'}
          </h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              autoFocus
              placeholder="Feature name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save() }}
            />
          </div>
          <div>
            <label className="label">Category</label>
            <select
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value as FeatureCategory)}
            >
              <option value="class">Class feature</option>
              <option value="species">Species feature</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="label">Description</label>
            <AutoTextarea
              value={description}
              onChange={setDescription}
              placeholder="What this feature does…"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-accent"
            disabled={!name.trim()}
            onClick={save}
          >
            {initial ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main tab ────────────────────────────────────────────────────────────────

type ModalState =
  | { kind: 'add-generic'; category: FeatureCategory }
  | { kind: 'add-feat' }
  | { kind: 'edit-generic'; feature: PcFeature }
  | { kind: 'edit-feat'; feature: PcFeature }

export function FeaturesTab({ pc }: { pc: PcUnit }): JSX.Element {
  const updatePc = usePcStore((s) => s.updatePc)
  const openDrawer = useUiStore((s) => s.openDrawer)
  const items = useContentStore((s) => s.items)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [activeTab, setActiveTab] = useState<FeatureCategory | 'all'>('all')

  const set = (features: PcFeature[]): void => updatePc(pc.id, { features })
  const add = (data: Omit<PcFeature, 'id'>): void =>
    set([...pc.features, { id: uuid(), ...data }])
  const update = (id: string, data: Omit<PcFeature, 'id'>): void =>
    set(pc.features.map((f) => (f.id === id ? { ...f, ...data } : f)))
  const remove = (id: string): void => set(pc.features.filter((f) => f.id !== id))

  const visibleCategories = CATEGORIES.filter(({ key }) => activeTab === 'all' || activeTab === key)

  return (
    <div>
      {/* Sticky category tab bar */}
      <div className="sticky top-0 z-10 flex overflow-x-auto border-b border-border bg-bg px-4">
        {([{ key: 'all' as const, label: 'All' }, ...CATEGORIES] as Array<{ key: FeatureCategory | 'all'; label: string }>).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={cn(
              'whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              activeTab === key
                ? 'border-accent text-ink'
                : 'border-transparent text-ink-muted hover:text-ink'
            )}
          >
            {label}
            {key !== 'all' && (
              <span className="ml-1.5 rounded-full bg-surface-3 px-1.5 text-[10px] text-ink-muted">
                {pc.features.filter((f) => f.category === key).length}
              </span>
            )}
          </button>
        ))}
      </div>

    <div className="max-w-3xl space-y-6 p-6">
      {visibleCategories.map(({ key, label }) => {
        const entries = pc.features.filter((f) => f.category === key)
        const isFeat = key === 'feat'
        return (
          <section key={key} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                {label}
              </h3>
              <button
                type="button"
                className="btn-accent text-xs"
                onClick={() =>
                  isFeat
                    ? setModal({ kind: 'add-feat' })
                    : setModal({ kind: 'add-generic', category: key })
                }
              >
                <Plus size={13} />
                Add
              </button>
            </div>

            {entries.length === 0 ? (
              <p className="text-sm text-ink-muted">None yet.</p>
            ) : (
              <div className="space-y-2">
                {entries.map((f) => {
                  const libEntry = f.contentId ? items.find((i) => i.id === f.contentId) : null
                  const libData = libEntry?.data as { description?: string; prerequisite?: string; feature?: string; featureDescription?: string } | undefined
                  const libDesc = libData?.description
                  const prereq = libData?.prerequisite
                  return (
                  <div key={f.id} className="panel group rounded-md p-3">
                    <div className="flex items-start justify-between gap-2">
                      {f.contentId ? (
                        <button
                          type="button"
                          className="text-left font-medium text-ink hover:text-accent"
                          onClick={() => openDrawer(f.contentId!)}
                        >
                          {f.name || <span className="italic text-ink-muted">Untitled</span>}
                        </button>
                      ) : (
                        <p className="font-medium text-ink">
                          {f.name || <span className="italic text-ink-muted">Untitled</span>}
                        </p>
                      )}
                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          className="icon-btn h-6 w-6"
                          title="Edit"
                          onClick={() =>
                            isFeat
                              ? setModal({ kind: 'edit-feat', feature: f })
                              : setModal({ kind: 'edit-generic', feature: f })
                          }
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn h-6 w-6 hover:text-danger"
                          title="Delete"
                          onClick={() => remove(f.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    {prereq && (
                      <p className="mt-0.5 text-[11px] text-ink-muted">
                        Prerequisite: {prereq}
                      </p>
                    )}
                    {libDesc && (
                      <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap text-sm text-ink-muted">
                        {libDesc}
                      </p>
                    )}
                    {f.description && (
                      <p className={cn('text-xs italic text-ink-faint', libDesc ? 'mt-1.5 border-t border-border pt-1.5' : 'mt-1.5')}>
                        {f.description}
                      </p>
                    )}
                  </div>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}

      {modal?.kind === 'add-feat' && (
        <FeatModal
          onSave={add}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === 'edit-feat' && (
        <FeatModal
          initial={modal.feature}
          onSave={(data) => update(modal.feature.id, data)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === 'add-generic' && (
        <FeatureModal
          defaultCategory={modal.category}
          onSave={add}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === 'edit-generic' && (
        <FeatureModal
          initial={modal.feature}
          defaultCategory={modal.feature.category}
          onSave={(data) => update(modal.feature.id, data)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
    </div>
  )
}
