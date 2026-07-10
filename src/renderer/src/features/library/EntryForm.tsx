import { useMemo, useState, type ReactNode } from 'react'
import { Plus, Trash2, X, GripVertical } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Markdown } from '@/components/Markdown'
import { TagSelect } from '@/components/TagSelect'
import { CommaListInput } from '@/components/CommaListInput'
import { useContentStore, sourceInCampaign } from '@/lib/store/contentStore'
import { getActiveCampaignId } from '@/lib/store/activeCampaign'
import { useUiStore } from '@/lib/store/uiStore'
import {
  TEMPLATES,
  CREATABLE_TYPES,
  recomputeSummary,
  makeNewEntry,
  makeStub,
  collectReferences,
  type FieldDef
} from '@/lib/templates/schemas'
import type {
  ContentEntry,
  ContentType,
  StatBlockEntry,
  ClassFeature,
  LeveledSpells
} from '@/types/content'
import { cn } from '@/lib/cn'

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn('relative h-5 w-9 rounded-full transition-colors', value ? 'bg-accent' : 'bg-surface-3')}
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all',
          value ? 'left-[18px]' : 'left-0.5'
        )}
      />
    </button>
  )
}

function MarkdownField({
  value,
  onChange
}: {
  value: string
  onChange: (v: string) => void
}): JSX.Element {
  const [preview, setPreview] = useState(false)
  return (
    <div>
      <div className="mb-1 flex justify-end">
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          className="text-[11px] text-ink-muted hover:text-ink"
        >
          {preview ? 'Edit' : 'Preview'}
        </button>
      </div>
      {preview ? (
        <div className="min-h-[96px] rounded-md border border-border bg-surface-2 p-2">
          <Markdown>{value || '_Nothing yet_'}</Markdown>
        </div>
      ) : (
        <textarea
          className="input min-h-[110px] font-mono text-[13px]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  )
}

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
type Abilities = Record<(typeof ABILITY_KEYS)[number], number>

function AbilitiesField({
  value,
  onChange
}: {
  value: Abilities
  onChange: (v: Abilities) => void
}): JSX.Element {
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {ABILITY_KEYS.map((k) => (
        <div key={k}>
          <label className="mb-0.5 block text-center text-[10px] font-semibold uppercase text-ink-muted">
            {k}
          </label>
          <input
            type="number"
            className="input px-1 text-center"
            value={value[k]}
            onChange={(e) => onChange({ ...value, [k]: Number(e.target.value) })}
          />
        </div>
      ))}
    </div>
  )
}

function StatblocksField({
  value,
  onChange
}: {
  value: StatBlockEntry[]
  onChange: (v: StatBlockEntry[]) => void
}): JSX.Element {
  const update = (i: number, patch: Partial<StatBlockEntry>): void =>
    onChange(value.map((e, j) => (j === i ? { ...e, ...patch } : e)))
  return (
    <div className="space-y-2">
      {value.map((entry, i) => (
        <div key={i} className="space-y-1 rounded-md border border-border p-2">
          <div className="flex gap-1">
            <input
              className="input"
              placeholder="Name"
              value={entry.name}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <button
              type="button"
              className="icon-btn shrink-0"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              <Trash2 size={14} />
            </button>
          </div>
          <textarea
            className="input min-h-[56px]"
            placeholder="Description"
            value={entry.desc}
            onChange={(e) => update(i, { desc: e.target.value })}
          />
        </div>
      ))}
      <button
        type="button"
        className="btn-ghost text-sm"
        onClick={() => onChange([...value, { name: '', desc: '' }])}
      >
        <Plus size={14} />
        Add
      </button>
    </div>
  )
}

function SortableRow({ id, children }: { id: number; children: ReactNode }): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex items-start gap-1', isDragging && 'opacity-60')}
    >
      <button
        type="button"
        className="mt-1.5 shrink-0 cursor-grab text-ink-muted hover:text-ink active:cursor-grabbing"
        title="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function SortableRows<T>({
  items,
  onReorder,
  renderRow
}: {
  items: T[]
  onReorder: (next: T[]) => void
  renderRow: (item: T, index: number) => ReactNode
}): JSX.Element {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const onDragEnd = (e: DragEndEvent): void => {
    const { active, over } = e
    if (over && active.id !== over.id) {
      onReorder(arrayMove(items, Number(active.id), Number(over.id)))
    }
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((_, i) => i)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {items.map((item, i) => (
            <SortableRow key={i} id={i}>
              {renderRow(item, i)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function LeveledFeaturesField({
  value,
  onChange
}: {
  value: ClassFeature[]
  onChange: (v: ClassFeature[]) => void
}): JSX.Element {
  const update = (i: number, patch: Partial<ClassFeature>): void =>
    onChange(value.map((e, j) => (j === i ? { ...e, ...patch } : e)))
  return (
    <div className="space-y-2">
      <SortableRows
        items={value}
        onReorder={onChange}
        renderRow={(f, i) => (
          <div className="space-y-1 rounded-md border border-border p-2">
            <div className="flex gap-1">
              <input
                type="number"
                min={1}
                className="input w-16 shrink-0"
                placeholder="Lvl"
                value={f.level}
                onChange={(e) => update(i, { level: Math.max(1, Number(e.target.value) || 1) })}
              />
              <input
                className="input"
                placeholder="Feature name"
                value={f.name}
                onChange={(e) => update(i, { name: e.target.value })}
              />
              <button
                type="button"
                className="icon-btn shrink-0"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <textarea
              className="input min-h-[56px]"
              placeholder="What it does"
              value={f.desc}
              onChange={(e) => update(i, { desc: e.target.value })}
            />
          </div>
        )}
      />
      <button
        type="button"
        className="btn-ghost text-sm"
        onClick={() => onChange([...value, { level: 1, name: '', desc: '' }])}
      >
        <Plus size={14} />
        Add feature
      </button>
    </div>
  )
}

function LeveledSpellsField({
  value,
  onChange
}: {
  value: LeveledSpells[]
  onChange: (v: LeveledSpells[]) => void
}): JSX.Element {
  const items = useContentStore((s) => s.visibleItems)
  const spellOptions = useMemo(
    () =>
      [...new Set(items.filter((i) => i.type === 'spell').map((i) => i.name))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [items]
  )
  const update = (i: number, patch: Partial<LeveledSpells>): void =>
    onChange(value.map((e, j) => (j === i ? { ...e, ...patch } : e)))
  return (
    <div className="space-y-2">
      <SortableRows
        items={value}
        onReorder={onChange}
        renderRow={(row, i) => (
          <div className="flex items-start gap-1">
            <select
              className="input w-20 shrink-0"
              value={row.level}
              onChange={(e) => update(i, { level: Number(e.target.value) })}
            >
              <option value={0}>C</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <div className="min-w-0 flex-1">
              <TagSelect
                multi
                value={row.spells}
                options={spellOptions}
                placeholder="Add spells…"
                onChange={(v) => update(i, { spells: v as string[] })}
              />
            </div>
            <button
              type="button"
              className="icon-btn shrink-0"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      />
      <button
        type="button"
        className="btn-ghost text-sm"
        onClick={() => onChange([...value, { level: 1, spells: [] }])}
      >
        <Plus size={14} />
        Add level
      </button>
    </div>
  )
}

function FieldRenderer({
  field,
  value,
  onChange
}: {
  field: FieldDef
  value: unknown
  onChange: (v: unknown) => void
}): JSX.Element {
  switch (field.kind) {
    case 'text':
      return (
        <input
          className="input"
          placeholder={field.placeholder}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'textarea':
      return (
        <textarea
          className="input min-h-[64px]"
          placeholder={field.placeholder}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'number':
      return (
        <input
          type="number"
          className="input"
          value={(value as number) ?? 0}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      )
    case 'boolean':
      return <Toggle value={Boolean(value)} onChange={onChange} />
    case 'select':
      return (
        <select className="input" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )
    case 'csv':
      return (
        <CommaListInput
          value={Array.isArray(value) ? (value as string[]) : []}
          placeholder={field.placeholder}
          onChange={onChange}
        />
      )
    case 'tag':
      return (
        <TagSelect value={(value as string) ?? ''} options={field.options ?? []} onChange={onChange} />
      )
    case 'tags':
      return (
        <TagSelect multi value={(value as string[]) ?? []} options={field.options ?? []} onChange={onChange} />
      )
    case 'markdown':
      return <MarkdownField value={(value as string) ?? ''} onChange={onChange} />
    case 'abilities':
      return <AbilitiesField value={value as Abilities} onChange={onChange} />
    case 'statblocks':
      return <StatblocksField value={(value as StatBlockEntry[]) ?? []} onChange={onChange} />
    case 'features':
      return <LeveledFeaturesField value={(value as ClassFeature[]) ?? []} onChange={onChange} />
    case 'leveledSpells':
      return <LeveledSpellsField value={(value as LeveledSpells[]) ?? []} onChange={onChange} />
  }
}

interface EntryFormProps {
  type: ContentType
  entry: ContentEntry | null
  onClose: () => void
  /** When provided, called after a successful save instead of closing + opening the drawer. */
  onSaved?: (entry: ContentEntry) => void
  /** Present when stepping through an import batch. */
  review?: { index: number; total: number; onSkip: () => void }
}

export function EntryForm({ type, entry, onClose, onSaved, review }: EntryFormProps): JSX.Element {
  const upsert = useContentStore((s) => s.upsert)
  const visibleItems = useContentStore((s) => s.visibleItems)
  const sources = useContentStore((s) => s.sources)
  const openDrawer = useUiStore((s) => s.openDrawer)
  const defaultWorld = useUiStore((s) => s.editorDefaultWorld)
  const [draft, setDraft] = useState<ContentEntry>(
    entry ?? { ...makeNewEntry(type), world: defaultWorld }
  )

  // Source options = the sources that exist in the active campaign.
  const worldOptions = useMemo(
    () =>
      sources
        .filter((s) => sourceInCampaign(s, getActiveCampaignId()))
        .map((s) => s.name)
        .sort((a, b) => a.localeCompare(b)),
    [sources]
  )

  // Parent-class options = classes visible in the active campaign.
  const classOptions = useMemo(
    () =>
      [...new Set(visibleItems.filter((i) => i.type === 'class').map((i) => i.name))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [visibleItems]
  )

  const template = TEMPLATES[draft.type]
  const isEdit = Boolean(entry)

  const setData = (key: string, value: unknown): void => {
    setDraft((d) => {
      const data = { ...(d.data as unknown as Record<string, unknown>), [key]: value }
      return { ...d, data } as unknown as ContentEntry
    })
  }

  // Convert a draft to a different type (used when correcting a "Mixed" import
  // guess), carrying name/tags/world and the descriptive text across.
  const changeType = (newType: ContentType): void => {
    setDraft((d) => {
      if (d.type === newType) return d
      const oldData = d.data as unknown as Record<string, unknown>
      const body =
        d.type === 'monster'
          ? ((oldData.lore as string) ?? '')
          : d.type === 'weapon'
            ? (d.notes ?? '')
            : ((oldData.description as string) ?? '')
      const next = makeNewEntry(newType)
      next.id = d.id
      next.name = d.name
      next.tags = d.tags
      next.world = d.world
      next.notes = d.type === 'weapon' ? '' : d.notes
      if (body) {
        const nd = next.data as unknown as Record<string, unknown>
        if (next.type === 'monster') nd.lore = body
        else if (next.type === 'weapon') next.notes = body
        else nd.description = body
      }
      next.summary = recomputeSummary(next)
      return next
    })
  }

  const save = async (): Promise<void> => {
    if (!draft.name.trim()) return
    const out: ContentEntry = { ...draft, name: draft.name.trim(), updatedAt: Date.now() }
    if (out.type === 'spell') {
      out.data = { ...out.data, levelText: out.data.level === 0 ? 'Cantrip' : `Level ${out.data.level}` }
    }
    out.summary = recomputeSummary(out)
    await upsert(out)

    // Auto-create blank library entries for anything this references that
    // doesn't exist yet (e.g. a new spell listed on a subclass), so it can be
    // opened and filled in later. Matched by type + name, case-insensitive.
    const seen = new Set(visibleItems.map((i) => `${i.type}:${i.name.toLowerCase()}`))
    seen.add(`${out.type}:${out.name.toLowerCase()}`)
    for (const ref of collectReferences(out)) {
      const key = `${ref.type}:${ref.name.toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      await upsert(makeStub(ref.type, ref.name))
    }

    if (onSaved) {
      onSaved(out)
    } else {
      onClose()
      openDrawer(out.id)
    }
  }

  const data = draft.data as unknown as Record<string, unknown>

  return (
    <div className="panel flex max-h-[86vh] w-[640px] max-w-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">
          {review ? `Import · ${template.label}` : `${isEdit ? 'Edit' : 'New'} ${template.label}`}
          {review && (
            <span className="ml-2 text-xs font-normal text-ink-muted">
              {review.index} of {review.total}
            </span>
          )}
        </h2>
        <button type="button" className="icon-btn" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {review && (
          <div>
            <label className="label">Type</label>
            <select
              className="input"
              value={draft.type}
              onChange={(e) => changeType(e.target.value as ContentType)}
            >
              {CREATABLE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TEMPLATES[t].label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label">Name</label>
          <input
            className="input"
            autoFocus
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Required"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Tags</label>
            <CommaListInput
              value={draft.tags}
              placeholder="comma, separated"
              onChange={(tags) => setDraft((d) => ({ ...d, tags }))}
            />
          </div>
          <div>
            <label className="label">Source</label>
            <TagSelect
              value={draft.world ?? ''}
              options={worldOptions}
              placeholder="Pick or name a source…"
              onChange={(v) => setDraft((d) => ({ ...d, world: v as string }))}
            />
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Toggle
            value={Boolean(draft.homebrew)}
            onChange={(v) => setDraft((d) => ({ ...d, homebrew: v }))}
          />
          <span className="text-sm text-ink">Homebrew</span>
        </div>

        {template.fields.map((field) => (
          <div key={field.key}>
            <label className="label">{field.label}</label>
            {field.key === 'parentClass' ? (
              <TagSelect
                value={(data.parentClass as string) ?? ''}
                options={classOptions}
                placeholder="Pick or type a class…"
                onChange={(v) => setData('parentClass', v as string)}
              />
            ) : (
              <FieldRenderer
                field={field}
                value={data[field.key]}
                onChange={(v) => setData(field.key, v)}
              />
            )}
          </div>
        ))}

        <div>
          <label className="label">Notes</label>
          <MarkdownField
            value={draft.notes ?? ''}
            onChange={(v) => setDraft((d) => ({ ...d, notes: v }))}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border px-4 py-3">
        {review ? (
          <>
            <button type="button" className="btn-ghost" onClick={review.onSkip}>
              Skip
            </button>
            <div className="flex-1" />
            <button
              type="button"
              className="btn-accent"
              disabled={!draft.name.trim()}
              onClick={() => void save()}
            >
              Save &amp; next
            </button>
          </>
        ) : (
          <>
            <div className="flex-1" />
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-accent"
              disabled={!draft.name.trim()}
              onClick={() => void save()}
            >
              {isEdit ? 'Save changes' : 'Create entry'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
