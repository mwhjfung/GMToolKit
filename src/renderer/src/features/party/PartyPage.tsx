import { useEffect, useState } from 'react'
import { Plus, Users, Download, Upload, X } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import { SortableContext, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Page } from '@/components/Page'
import { EmptyState } from '@/components/EmptyState'
import { usePcStore, newPc, type PcUnit } from '@/lib/store/pcStore'
import { useUiStore } from '@/lib/store/uiStore'
import { exportCharacters } from '@/lib/data/partyData'
import { CharacterSheet } from './CharacterSheet'
import { ImportCharactersDialog } from './ImportCharactersDialog'
import { cn } from '@/lib/cn'

function PcTab({
  pc,
  active,
  onSelect,
  onClose
}: {
  pc: PcUnit
  active: boolean
  onSelect: () => void
  onClose: () => void
}): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pc.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group flex shrink-0 items-center gap-1 whitespace-nowrap border-b-2 pl-5 pr-2 text-sm font-medium transition-colors',
        isDragging && 'opacity-60',
        active ? 'border-accent text-ink' : 'border-transparent text-ink-muted hover:text-ink'
      )}
    >
      <button type="button" className="cursor-pointer py-2.5" onClick={onSelect} {...attributes} {...listeners}>
        {pc.name || 'Unnamed'}
      </button>
      <button
        type="button"
        title={`Delete ${pc.name || 'character'}`}
        className="rounded p-0.5 text-ink-faint opacity-0 transition-opacity hover:bg-danger/15 hover:text-danger group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      >
        <X size={13} />
      </button>
    </div>
  )
}

export function PartyPage(): JSX.Element {
  const pcs = usePcStore((s) => s.pcs)
  const addPc = usePcStore((s) => s.addPc)
  const removePc = usePcStore((s) => s.removePc)
  const reorderPcs = usePcStore((s) => s.reorderPcs)
  const activePcId = useUiStore((s) => s.activePcId)
  const setActivePcId = useUiStore((s) => s.setActivePcId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [status, setStatus] = useState('')

  const selected = pcs.find((p) => p.id === selectedId) ?? pcs[0] ?? null

  const handleAdd = (): void => {
    const id = addPc(newPc())
    setSelectedId(id)
    setEditingId(id)
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const onTabDragEnd = (e: DragEndEvent): void => {
    const { active, over } = e
    if (over && active.id !== over.id) {
      reorderPcs(
        pcs.findIndex((p) => p.id === active.id),
        pcs.findIndex((p) => p.id === over.id)
      )
    }
  }

  useEffect(() => {
    if (!activePcId) return
    setSelectedId(activePcId)
    setActivePcId(null)
  }, [activePcId, setActivePcId])

  useEffect(() => {
    if (!status) return
    const t = setTimeout(() => setStatus(''), 5000)
    return () => clearTimeout(t)
  }, [status])

  return (
    <Page
      title="Party"
      flush
      actions={
        <>
          {pcs.length > 0 && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                exportCharacters()
                setStatus('Exported characters.')
              }}
            >
              <Download size={15} />
              Export
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={() => setImportOpen(true)}>
            <Upload size={15} />
            Import
          </button>
          <button type="button" className="btn-accent" onClick={handleAdd}>
            <Plus size={15} />
            Add character
          </button>
        </>
      }
    >
      <div className="flex h-full flex-col">
        {status && (
          <div className="shrink-0 border-b border-border bg-surface-2 px-6 py-1.5 text-xs text-ink-muted">
            {status}
          </div>
        )}

        {pcs.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No characters yet"
            description="Add your players' characters to keep their full sheets at hand — or import a JSON export."
          >
            <button type="button" className="btn-accent" onClick={handleAdd}>
              <Plus size={16} />
              Add character
            </button>
          </EmptyState>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 overflow-x-auto border-b border-border">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onTabDragEnd}
              >
                <SortableContext items={pcs.map((p) => p.id)} strategy={horizontalListSortingStrategy}>
                  {pcs.map((pc) => (
                    <PcTab
                      key={pc.id}
                      pc={pc}
                      active={selected?.id === pc.id}
                      onSelect={() => setSelectedId(pc.id)}
                      onClose={() => {
                        if (window.confirm(`Delete "${pc.name || 'this character'}"? This can't be undone.`)) {
                          removePc(pc.id)
                          if (selectedId === pc.id) setSelectedId(null)
                          if (editingId === pc.id) setEditingId(null)
                        }
                      }}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
            <div className="min-h-0 flex-1">
              {selected && (
                <CharacterSheet
                  key={selected.id}
                  pc={selected}
                  editing={editingId === selected.id}
                  onToggleEdit={() =>
                    setEditingId((cur) => (cur === selected.id ? null : selected.id))
                  }
                />
              )}
            </div>
          </div>
        )}
      </div>

      {importOpen && (
        <ImportCharactersDialog onClose={() => setImportOpen(false)} onDone={(m) => setStatus(m)} />
      )}
    </Page>
  )
}
