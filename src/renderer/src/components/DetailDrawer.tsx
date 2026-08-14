import { Fragment, useEffect, useRef, useState } from 'react'
import { X, Pin, Pencil, Trash2, GripVertical, Copy, ExternalLink } from 'lucide-react'
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useUiStore, MAX_PANELS_PER_COLUMN } from '@/lib/store/uiStore'
import { useContentStore } from '@/lib/store/contentStore'
import { ContentDetail } from './ContentDetail'
import { cn } from '@/lib/cn'

const COL_PX = 360
const MIN_W = 0.15
const MIN_H = 0.1

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(v, hi))

/**
 * Tiling detail drawer. Opening an entry tiles a panel; when width runs out they
 * stack (max two, even heights, 10% min). Drag a panel by its grip to restack it
 * onto another column or reorder; drag the dividers to resize. Panels float over
 * the page so you can keep opening more.
 */
export function DetailDrawer(): JSX.Element {
  const cols = useUiStore((s) => s.drawerColumns)
  const setCols = useUiStore((s) => s.setDrawerColumns)
  const maxCols = useUiStore((s) => s.maxPanelColumns)
  const setMaxCols = useUiStore((s) => s.setMaxPanelColumns)
  const closePanel = useUiStore((s) => s.closePanel)
  const closeAll = useUiStore((s) => s.closeDrawer)

  const measureRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const el = measureRef.current
    if (!el) return
    const update = (): void => setMaxCols(Math.max(1, Math.floor(el.clientWidth / COL_PX)))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [setMaxCols])

  const open = cols.length > 0
  const total = cols.reduce((n, c) => n + c.length, 0)
  const sig = cols.map((c) => c.length).join('-')

  const [colW, setColW] = useState<number[]>([])
  const [rowH, setRowH] = useState<number[][]>([])
  useEffect(() => {
    setColW(cols.map(() => 1 / cols.length))
    setRowH(cols.map((c) => c.map(() => 1 / c.length)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && cols[0]?.[0]) closePanel(cols[0][0])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, cols, closePanel])

  const widths = colW.length === cols.length ? colW : cols.map(() => 1 / cols.length)

  const resizeWidth = (i: number, e: React.PointerEvent): void => {
    e.preventDefault()
    const totalPx = containerRef.current?.getBoundingClientRect().width ?? 1
    const startX = e.clientX
    const base = [...widths]
    const pair = base[i] + base[i + 1]
    const onMove = (ev: PointerEvent): void => {
      const a = clamp(base[i] + (ev.clientX - startX) / totalPx, MIN_W, pair - MIN_W)
      const next = [...base]
      next[i] = a
      next[i + 1] = pair - a
      setColW(next)
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const setColumnHeights = (c: number, next: number[]): void =>
    setRowH((prev) => {
      const copy = prev.map((a) => [...a])
      copy[c] = next
      return copy
    })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const onDragEnd = (e: DragEndEvent): void => {
    setDragging(false)
    const { active, over } = e
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    if (overId === activeId) return

    const copy = cols.map((c) => [...c])
    let removed = false
    for (const c of copy) {
      const i = c.indexOf(activeId)
      if (i >= 0) {
        c.splice(i, 1)
        removed = true
        break
      }
    }
    if (!removed) return

    const place = (): boolean => {
      if (overId === 'newcol') {
        if (copy.filter((c) => c.length > 0).length >= Math.max(1, maxCols)) return false
        copy.unshift([activeId])
        return true
      }
      if (overId.startsWith('column:')) {
        const ci = Number(overId.slice(7))
        if (!copy[ci] || copy[ci].length >= MAX_PANELS_PER_COLUMN) return false
        copy[ci].push(activeId)
        return true
      }
      for (const c of copy) {
        const i = c.indexOf(overId)
        if (i >= 0) {
          if (c.length >= MAX_PANELS_PER_COLUMN) return false
          c.splice(i, 0, activeId)
          return true
        }
      }
      return false
    }
    if (!place()) return
    setCols(copy.filter((c) => c.length > 0))
  }

  return (
    <>
      <div ref={measureRef} aria-hidden className="pointer-events-none absolute inset-0" />
      {open && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={() => setDragging(true)}
          onDragCancel={() => setDragging(false)}
          onDragEnd={onDragEnd}
        >
          <div
            ref={containerRef}
            className="pointer-events-none absolute right-0 top-0 z-30 flex h-full shadow-2xl"
            style={{ width: cols.length * COL_PX, maxWidth: '100%' }}
          >
            {dragging && <NewColumnDropZone />}
            {cols.map((ids, ci) => (
              <Fragment key={ci}>
                {ci > 0 && (
                  <div
                    onPointerDown={(e) => resizeWidth(ci - 1, e)}
                    title="Drag to resize"
                    className="pointer-events-auto w-1 shrink-0 cursor-col-resize bg-border hover:bg-accent/40"
                  />
                )}
                <Column
                  ids={ids}
                  colIndex={ci}
                  widthFrac={widths[ci]}
                  heightsFrac={rowH[ci]?.length === ids.length ? rowH[ci] : ids.map(() => 1 / ids.length)}
                  isNewest={ci === 0}
                  total={total}
                  onResize={(next) => setColumnHeights(ci, next)}
                  onClosePanel={closePanel}
                  onCloseAll={closeAll}
                />
              </Fragment>
            ))}
          </div>
        </DndContext>
      )}
    </>
  )
}

function NewColumnDropZone(): JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: 'newcol' })
  return (
    <div
      ref={setNodeRef}
      title="Drop here for a new column"
      className={cn(
        'pointer-events-auto mr-1 w-2 shrink-0 self-stretch rounded',
        isOver ? 'bg-accent/50' : 'bg-border/40'
      )}
    />
  )
}

function Column({
  ids,
  colIndex,
  widthFrac,
  heightsFrac,
  isNewest,
  total,
  onResize,
  onClosePanel,
  onCloseAll
}: {
  ids: string[]
  colIndex: number
  widthFrac: number
  heightsFrac: number[]
  isNewest: boolean
  total: number
  onResize: (next: number[]) => void
  onClosePanel: (id: string) => void
  onCloseAll: () => void
}): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null)
  const { setNodeRef: setDropRef } = useDroppable({ id: `column:${colIndex}` })

  const resizeRow = (r: number, e: React.PointerEvent): void => {
    e.preventDefault()
    const totalPx = ref.current?.getBoundingClientRect().height ?? 1
    const startY = e.clientY
    const base = [...heightsFrac]
    const pair = base[r] + base[r + 1]
    const onMove = (ev: PointerEvent): void => {
      const a = clamp(base[r] + (ev.clientY - startY) / totalPx, MIN_H, pair - MIN_H)
      const next = [...base]
      next[r] = a
      next[r + 1] = pair - a
      onResize(next)
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      ref={(el) => {
        ref.current = el
        setDropRef(el)
      }}
      className="flex h-full min-w-0 flex-col"
      style={{ flexGrow: widthFrac, flexBasis: 0 }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {ids.map((id, r) => (
          <Fragment key={id}>
            {r > 0 && (
              <div
                onPointerDown={(e) => resizeRow(r - 1, e)}
                title="Drag to resize"
                className="pointer-events-auto h-1 shrink-0 cursor-row-resize bg-border hover:bg-accent/40"
              />
            )}
            <div className="min-h-0" style={{ flexGrow: heightsFrac[r], flexBasis: 0 }}>
              <SortablePanel
                id={id}
                onClose={() => onClosePanel(id)}
                onCloseAll={onCloseAll}
                showCloseAll={isNewest && r === 0 && total > 1}
              />
            </div>
          </Fragment>
        ))}
      </SortableContext>
    </div>
  )
}

function SortablePanel({
  id,
  onClose,
  onCloseAll,
  showCloseAll
}: {
  id: string
  onClose: () => void
  onCloseAll: () => void
  showCloseAll: boolean
}): JSX.Element | null {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const entry = useContentStore((s) => s.items.find((i) => i.id === id))
  const pinned = useContentStore((s) => (entry ? s.pinnedIds.includes(entry.id) : false))
  const togglePin = useContentStore((s) => s.togglePin)
  const remove = useContentStore((s) => s.remove)
  const duplicate = useContentStore((s) => s.duplicate)
  const openEdit = useUiStore((s) => s.openEdit)
  const openInNewWindow = useUiStore((s) => s.openInNewWindow)

  // Dragging a panel to the edge of the window's content area pops it out —
  // the closest DOM-observable proxy for "drag it past the OS window edge",
  // since the browser stops delivering pointer events once the pointer
  // actually leaves the window.
  useEffect(() => {
    if (!isDragging) return
    const EDGE = 8
    const onMove = (e: PointerEvent): void => {
      if (e.clientX <= EDGE || e.clientX >= window.innerWidth - EDGE) {
        void openInNewWindow(id)
      }
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [isDragging, id, openInNewWindow])

  if (!entry) return null

  return (
    <aside
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'pointer-events-auto flex h-full w-full flex-col border-l border-border bg-surface',
        isDragging ? 'z-50 opacity-70' : 'drawer-panel-enter'
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-2 py-2.5">
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            className="shrink-0 cursor-grab text-ink-muted hover:text-ink active:cursor-grabbing"
            title="Drag to rearrange"
            aria-label="Drag to rearrange panel"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={15} />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Open in new window"
            onClick={() => void openInNewWindow(id)}
          >
            <ExternalLink size={15} />
          </button>
          {showCloseAll ? (
            <button type="button" className="text-xs font-medium text-ink-muted hover:text-ink" onClick={onCloseAll}>
              Close all
            </button>
          ) : (
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Details</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="icon-btn"
            title="Duplicate"
            onClick={async () => {
              const copy = await duplicate(entry)
              openEdit(copy)
            }}
          >
            <Copy size={15} />
          </button>
          {entry.source === 'custom' && (
            <>
              <button type="button" className="icon-btn" title="Edit" onClick={() => openEdit(entry)}>
                <Pencil size={15} />
              </button>
              <button
                type="button"
                className="icon-btn hover:text-danger"
                title="Delete"
                onClick={() => {
                  if (window.confirm(`Delete “${entry.name}”? This can't be undone.`)) {
                    void remove(entry.id)
                    onClose()
                  }
                }}
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
          <button
            type="button"
            className="icon-btn"
            title={pinned ? 'Unpin' : 'Pin to board'}
            onClick={() => togglePin(entry.id)}
          >
            <Pin size={16} className={pinned ? 'fill-accent text-accent' : ''} />
          </button>
          <button type="button" className="icon-btn" title="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <ContentDetail entry={entry} />
      </div>
    </aside>
  )
}
