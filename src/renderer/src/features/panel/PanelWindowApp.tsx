import { useEffect, useMemo, useRef, useState } from 'react'
import { GripVertical, X } from 'lucide-react'
import GridLayout, { type Layout, type LayoutItem } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import type { ContentEntry } from '@/types/content'
import { ContentDetail } from '@/components/ContentDetail'
import { useContentStore, subscribeContentSync } from '@/lib/store/contentStore'
import { useCampaignStore } from '@/lib/store/campaignStore'
import { useSessionStore } from '@/lib/store/sessionStore'
import { useSettingsStore } from '@/lib/store/settingsStore'
import { useUiStore } from '@/lib/store/uiStore'
import { findFirstOpenSlot, repackByReadingOrder, useContainerSize } from '@/lib/gridPack'

// Modular card heights: "small" is one grid row, sized around a compact
// single-condition card (e.g. Stunned) — a name, a badge, a couple lines of
// rules text. "large" is exactly two smalls (two grid rows), for statblock-
// heavy entries (monsters, classes) that need more room. Every card is
// capped at whichever it lands on and scrolls internally past that — cards
// never grow to fit their content, so the grid stays a predictable two-tier
// layout. Two small cards stacked in one column take up exactly the same
// height as one large card in the next, since react-grid-layout's vertical
// compaction packs both columns independently.
const ROW_H = 240
const GRID_MARGIN: [number, number] = [12, 12]
// Column count scales with the window's actual width — 2-ish at the default
// pop-out size, up to 4 once the window is maximized/full-screen — rather
// than a fixed count that either wastes a maximized window's width or
// crams too many columns into a small one.
const IDEAL_CARD_WIDTH = 380
const MAX_COLS = 4

function colsFor(width: number): number {
  return Math.min(MAX_COLS, Math.max(1, Math.round(width / IDEAL_CARD_WIDTH)))
}

function PanelCard({ entry, onClose }: { entry: ContentEntry; onClose: () => void }): JSX.Element {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
        {/* Not a <button> — dragConfig.cancel below is 'button' (so the Close
            button never starts a drag), and that selector would just as
            happily match this handle if it were one too. */}
        <div
          className="panel-card-drag-handle -m-1 cursor-grab p-1 text-ink-muted hover:text-ink active:cursor-grabbing"
          role="button"
          tabIndex={0}
          title="Drag to rearrange"
          aria-label="Drag to rearrange card"
        >
          <GripVertical size={15} />
        </div>
        <button type="button" className="icon-btn" title="Close" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <ContentDetail entry={entry} />
      </div>
    </div>
  )
}

/** Measures an entry's rendered content once and reports whether it fits in
 * one row or needs two — hidden off-screen at full width so the measurement
 * isn't affected by whatever height the grid currently has it clipped to. */
function CardSizeProbe({
  entry,
  width,
  onMeasured
}: {
  entry: ContentEntry
  width: number
  onMeasured: (id: string, h: 1 | 2) => void
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || width <= 0) return
    const check = (): void => {
      onMeasured(entry.id, el.scrollHeight > ROW_H ? 2 : 1)
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id, width])

  return (
    <div className="pointer-events-none fixed left-0 top-0 -z-10 opacity-0" style={{ width }}>
      <div ref={ref} className="p-4">
        <ContentDetail entry={entry} />
      </div>
    </div>
  )
}

export function PanelWindowApp(): JSX.Element {
  const loadContent = useContentStore((s) => s.load)
  const items = useContentStore((s) => s.items)
  const loadCampaigns = useCampaignStore((s) => s.load)
  const loadSessions = useSessionStore((s) => s.load)
  const loadAppSettings = useSettingsStore((s) => s.load)
  const ids = useUiStore((s) => s.panelWindowIds)
  const setPanelWindowIds = useUiStore((s) => s.setPanelWindowIds)
  const setIsPanelWindowRenderer = useUiStore((s) => s.setIsPanelWindowRenderer)

  // Mirror AppLayout's bootstrap: campaigns, then that campaign's sessions,
  // then content — otherwise getActiveCampaignId() reads '' in this window,
  // which causes any upsert here (e.g. RefLink's auto-stub creation) to
  // pollute the shared Source list with a campaign-less source, and filters
  // all existing custom content out of this window's visibleItems. Also load
  // settings so the theme is applied here too (a light-mode user shouldn't
  // get a dark pop-out window by default).
  useEffect(() => {
    void (async () => {
      await loadCampaigns()
      await loadSessions()
      await loadContent()
    })()
    void loadAppSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // This renderer IS a panel window (this component only ever mounts on the
  // /panel route), but resolve it via the same isPanelWindow() IPC used
  // elsewhere rather than assuming, so uiStore.openDrawer's guard is driven
  // by the authoritative main-process answer.
  useEffect(() => {
    void window.dmc.panel.isPanelWindow().then(setIsPanelWindowRenderer)
  }, [setIsPanelWindowRenderer])

  // Content edited/created/deleted in the main window doesn't touch this
  // window's Zustand cache (Dexie is shared, in-memory state isn't) —
  // refetch here whenever the main window broadcasts a change.
  useEffect(() => {
    return subscribeContentSync()
  }, [])

  useEffect(() => {
    const unsubscribe = window.dmc.panel.onBroadcast('panel:show', (payload) => {
      setPanelWindowIds(payload as string[])
    })
    // Ask the main window for the current state. The immediate `panel:show`
    // broadcast sent right after `window.dmc.panel.open()` resolves can be
    // lost — this component (and its listener above) may not exist yet when
    // that first broadcast is sent. `panel:ready` asks for it again, so this
    // window ends up populated whether it lands the first time or not.
    window.dmc.panel.broadcast('panel:ready', null)
    return unsubscribe
  }, [setPanelWindowIds])

  const { width, ref: containerRef } = useContainerSize()
  const cols = colsFor(width)

  // Which row-height bucket (1 = small, 2 = large) each open entry measured
  // into. Defaults to small until the hidden probe below reports otherwise.
  const [sizeById, setSizeById] = useState<Map<string, 1 | 2>>(new Map())
  const onMeasured = (id: string, h: 1 | 2): void => {
    setSizeById((prev) => (prev.get(id) === h ? prev : new Map(prev).set(id, h)))
  }

  // User-arranged positions, updated on drag. New/resized entries fall into
  // the first open slot; the rest keep exactly where they were dragged to.
  const [layout, setLayout] = useState<Layout>([])

  // A column count change (window resized wider/narrower) makes existing x/y
  // values stale — an item sitting in column 3 is out of bounds once cols
  // drops to 2. Re-flow into the new column count via the same reading-order
  // repack a drag uses, rather than a fixed count.
  const prevColsRef = useRef(cols)
  useEffect(() => {
    if (prevColsRef.current === cols) return
    prevColsRef.current = cols
    setLayout((prev) => repackByReadingOrder([...prev], cols))
  }, [cols])

  const layoutById = useMemo(() => new Map(layout.map((l) => [l.i, l])), [layout])
  const displayLayout = useMemo(() => {
    const next: LayoutItem[] = []
    for (const id of ids) {
      const h = sizeById.get(id) ?? 1
      const existing = layoutById.get(id)
      if (existing && existing.h === h) {
        next.push(existing)
        continue
      }
      const slot = findFirstOpenSlot(next, cols, 1, h)
      next.push({ i: id, x: slot.x, y: slot.y, w: 1, h })
    }
    return next
  }, [ids, layoutById, sizeById, cols])

  const openEntries = ids.map((id) => items.find((i) => i.id === id)).filter((e): e is ContentEntry => !!e)

  return (
    <div className="h-screen overflow-y-auto bg-surface text-ink">
      {openEntries.map((entry) => (
        <CardSizeProbe key={entry.id} entry={entry} width={Math.max(0, width / cols - GRID_MARGIN[0])} onMeasured={onMeasured} />
      ))}
      {ids.length === 0 && (
        <div className="flex h-full items-center justify-center text-sm text-ink-muted">
          Nothing open
        </div>
      )}
      {ids.length > 0 && (
        <div ref={containerRef} className="w-full p-3">
          {width > 0 && (
            <GridLayout
              width={width - GRID_MARGIN[0] * 2}
              layout={displayLayout}
              gridConfig={{ cols, rowHeight: ROW_H, margin: GRID_MARGIN, containerPadding: [0, 0], maxRows: Infinity }}
              dragConfig={{ handle: '.panel-card-drag-handle', cancel: 'button', threshold: 8 }}
              resizeConfig={{ enabled: false }}
              autoSize
              onDragStop={(l) => setLayout(repackByReadingOrder([...l], cols))}
            >
              {openEntries.map((entry) => (
                <div key={entry.id}>
                  <PanelCard
                    entry={entry}
                    onClose={() => setPanelWindowIds(ids.filter((i) => i !== entry.id))}
                  />
                </div>
              ))}
            </GridLayout>
          )}
        </div>
      )}
    </div>
  )
}
