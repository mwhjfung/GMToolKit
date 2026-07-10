import { useMemo, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { usePcStore, type PcUnit, type PcBackground } from '@/lib/store/pcStore'
import { useContentStore } from '@/lib/store/contentStore'
import { useUiStore } from '@/lib/store/uiStore'
import { makeNewEntry, recomputeSummary } from '@/lib/templates/schemas'
import { ALIGNMENTS, CREATURE_SIZES } from '@/lib/dnd/character'
import { cn } from '@/lib/cn'
import type { ContentEntry } from '@/types/content'

const CHARACTERISTICS: Array<{ key: keyof PcBackground; label: string }> = [
  { key: 'gender', label: 'Gender' },
  { key: 'age', label: 'Age' },
  { key: 'height', label: 'Height' },
  { key: 'weight', label: 'Weight' },
  { key: 'eyes', label: 'Eyes' },
  { key: 'hair', label: 'Hair' },
  { key: 'skin', label: 'Skin' },
  { key: 'faith', label: 'Faith' }
]

const CARDS: Array<{ key: keyof PcBackground; label: string }> = [
  { key: 'appearance', label: 'Appearance' },
  { key: 'personality', label: 'Personality traits' },
  { key: 'ideals', label: 'Ideals' },
  { key: 'bonds', label: 'Bonds' },
  { key: 'flaws', label: 'Flaws' }
]

// ─── Background picker modal ──────────────────────────────────────────────────

type PickerMode = 'library' | 'new'

function BackgroundPickerModal({
  pc,
  onClose
}: {
  pc: PcUnit
  onClose: () => void
}): JSX.Element {
  const updatePc = usePcStore((s) => s.updatePc)
  const upsert = useContentStore((s) => s.upsert)
  const items = useContentStore((s) => s.items)
  const bgEntries = useMemo(() => items.filter((i) => i.type === 'background'), [items])

  const [mode, setMode] = useState<PickerMode>('library')
  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newFeature, setNewFeature] = useState('')
  const [newFeatureDesc, setNewFeatureDesc] = useState('')
  const [newSkills, setNewSkills] = useState('')
  const [newTools, setNewTools] = useState('')
  const [newLangs, setNewLangs] = useState('')
  const [newEquip, setNewEquip] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? bgEntries.filter((b) => b.name.toLowerCase().includes(q)) : bgEntries
  }, [bgEntries, search])

  const selectEntry = (entry: ContentEntry): void => {
    updatePc(pc.id, {
      backgroundContentId: entry.id,
      background: { ...pc.background, name: entry.name }
    })
    onClose()
  }

  const createNew = async (): Promise<void> => {
    const name = newName.trim()
    if (!name) return
    const entry = makeNewEntry('background')
    entry.name = name
    entry.source = 'custom'
    entry.data = {
      description: newDesc,
      feature: newFeature,
      featureDescription: newFeatureDesc,
      skillProficiencies: newSkills,
      toolProficiencies: newTools,
      languages: newLangs,
      equipment: newEquip
    }
    entry.summary = recomputeSummary(entry)
    await upsert(entry)
    updatePc(pc.id, {
      backgroundContentId: entry.id,
      background: { ...pc.background, name }
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-8">
      <div className="panel mt-[8vh] flex max-h-[80vh] w-[500px] flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Select background</h2>
          <button type="button" className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="flex border-b border-border">
          {(['library', 'new'] as PickerMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'flex-1 border-b-2 py-2 text-sm font-medium transition-colors',
                mode === m ? 'border-accent text-ink' : 'border-transparent text-ink-muted hover:text-ink'
              )}
            >
              {m === 'library' ? 'From library' : 'Create new'}
            </button>
          ))}
        </div>

        {mode === 'library' ? (
          <>
            <div className="border-b border-border p-3">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  className="input pl-8"
                  autoFocus
                  placeholder="Search backgrounds…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <p className="px-2 py-4 text-center text-sm text-ink-muted">No backgrounds found.</p>
              ) : (
                filtered.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => selectEntry(entry)}
                    className={cn(
                      'flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-surface-3',
                      pc.backgroundContentId === entry.id && 'bg-accent/10'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">{entry.name}</p>
                      <p className="truncate text-xs text-ink-muted">{entry.summary}</p>
                    </div>
                    {pc.backgroundContentId === entry.id && (
                      <span className="shrink-0 text-xs text-accent">Current</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-3 p-4">
              <div>
                <label className="label">Background name</label>
                <input className="input" autoFocus placeholder="e.g. Street Rat" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Skill proficiencies</label>
                  <input className="input" placeholder="e.g. Deception, Stealth" value={newSkills} onChange={(e) => setNewSkills(e.target.value)} />
                </div>
                <div>
                  <label className="label">Tool proficiencies</label>
                  <input className="input" placeholder="e.g. Thieves' tools" value={newTools} onChange={(e) => setNewTools(e.target.value)} />
                </div>
                <div>
                  <label className="label">Languages</label>
                  <input className="input" placeholder="Any one language" value={newLangs} onChange={(e) => setNewLangs(e.target.value)} />
                </div>
                <div>
                  <label className="label">Equipment</label>
                  <input className="input" placeholder="Starting gear" value={newEquip} onChange={(e) => setNewEquip(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Feature name</label>
                <input className="input" placeholder="e.g. Street Sense" value={newFeature} onChange={(e) => setNewFeature(e.target.value)} />
              </div>
              <div>
                <label className="label">Feature description</label>
                <textarea className="input min-h-[60px]" placeholder="What this feature does…" value={newFeatureDesc} onChange={(e) => setNewFeatureDesc(e.target.value)} />
              </div>
              <div>
                <label className="label">Background description</label>
                <textarea className="input min-h-[60px]" placeholder="Background lore…" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
              </div>
              <button
                type="button"
                className="btn-accent w-full"
                disabled={!newName.trim()}
                onClick={() => { void createNew() }}
              >
                <Plus size={15} />
                Create &amp; select
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export function BackgroundTab({ pc }: { pc: PcUnit }): JSX.Element {
  const updatePc = usePcStore((s) => s.updatePc)
  const openDrawer = useUiStore((s) => s.openDrawer)
  const items = useContentStore((s) => s.items)
  const [pickerOpen, setPickerOpen] = useState(false)

  const bg = pc.background
  const linkedEntry = pc.backgroundContentId
    ? items.find((i) => i.id === pc.backgroundContentId)
    : null

  const set = (key: keyof PcBackground, value: string): void =>
    updatePc(pc.id, { background: { ...bg, [key]: value } })

  const bgData = linkedEntry?.data as {
    description?: string
    feature?: string
    featureDescription?: string
    skillProficiencies?: string
    toolProficiencies?: string
    languages?: string
    equipment?: string
  } | undefined

  return (
    <div className="max-w-3xl space-y-4 p-6">
      {/* Background card */}
      <div className="panel group relative rounded-lg p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Background</div>
            {linkedEntry ? (
              <button
                type="button"
                onClick={() => openDrawer(linkedEntry.id)}
                className="mt-0.5 text-left font-medium text-ink hover:text-accent"
              >
                {linkedEntry.name}
              </button>
            ) : (
              <p className="mt-0.5 text-sm text-ink-muted">Not linked to library</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              className="btn-outline text-xs"
              onClick={() => setPickerOpen(true)}
            >
              {linkedEntry ? 'Change' : 'Select'}
            </button>
            {linkedEntry && (
              <button
                type="button"
                className="icon-btn"
                title="Unlink"
                onClick={() => updatePc(pc.id, { backgroundContentId: undefined })}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {linkedEntry && bgData ? (
          <div className="mt-3 space-y-2.5">
            {/* Proficiency/equipment pills */}
            {(
              [
                { label: 'Skills', value: bgData.skillProficiencies },
                { label: 'Tools', value: bgData.toolProficiencies },
                { label: 'Languages', value: bgData.languages },
                { label: 'Equipment', value: bgData.equipment },
              ] as Array<{ label: string; value?: string }>
            ).filter((r) => r.value).map(({ label, value }) => (
              <div key={label} className="flex items-baseline gap-2 text-sm">
                <span className="w-20 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</span>
                <span className="text-ink-muted">{value}</span>
              </div>
            ))}

            {bgData.feature && (
              <div className="rounded-md border border-border bg-surface p-2.5">
                <p className="text-xs font-semibold text-ink">Feature: {bgData.feature}</p>
                {bgData.featureDescription && (
                  <p className="mt-1 line-clamp-3 text-xs text-ink-muted">{bgData.featureDescription}</p>
                )}
              </div>
            )}

            {bgData.description && (
              <p className="line-clamp-3 whitespace-pre-line text-sm text-ink-muted">{bgData.description}</p>
            )}
          </div>
        ) : !linkedEntry && (
          <button
            type="button"
            className="btn-outline mt-3 text-xs"
            onClick={() => setPickerOpen(true)}
          >
            <Plus size={13} />
            Select from library
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Alignment</label>
          <select className="input" value={bg.alignment} onChange={(e) => set('alignment', e.target.value)}>
            <option value="">—</option>
            {ALIGNMENTS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Size</label>
          <select className="input" value={bg.size} onChange={(e) => set('size', e.target.value)}>
            <option value="">—</option>
            {CREATURE_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {CHARACTERISTICS.map(({ key, label }) => (
          <div key={key}>
            <label className="label">{label}</label>
            <input className="input" value={bg[key]} onChange={(e) => set(key, e.target.value)} />
          </div>
        ))}
      </div>

      {CARDS.map(({ key, label }) => (
        <div key={key} className="panel space-y-1.5 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{label}</div>
          <textarea
            className="input min-h-[72px]"
            value={bg[key]}
            onChange={(e) => set(key, e.target.value)}
          />
        </div>
      ))}

      {pickerOpen && <BackgroundPickerModal pc={pc} onClose={() => setPickerOpen(false)} />}
    </div>
  )
}
