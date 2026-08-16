import { useCallback, useEffect, useRef, useState } from 'react'
import type { LayoutItem } from 'react-grid-layout'

/** Whether a w×h box at (x, y) overlaps any item in `items`. */
export function overlapsAny(items: LayoutItem[], x: number, y: number, w: number, h: number): boolean {
  return items.some((it) => x < it.x + it.w && x + w > it.x && y < it.y + it.h && y + h > it.y)
}

/** Smallest y at which a w×h box at column x clears every existing item. */
function nextOpenY(items: LayoutItem[], x: number, w: number, h: number): number {
  for (let y = 0; ; y += 1) {
    if (!overlapsAny(items, x, y, w, h)) return y
  }
}

/**
 * Where a w×h tile should land among `items`, given `cols` columns.
 *
 * Prefers finishing a column that already has something in it — over
 * starting a fresh one — as long as the tile fits without pushing past the
 * tallest point reached so far (the "frontier"). Only once every started
 * column is full up to the frontier does a new column open, and only once
 * every column (started or not) is full does the frontier itself grow. This
 * is what makes a small card slot in under an earlier small one instead of
 * jumping to unused space beside a taller neighbor, while still filling a
 * row left-to-right first for same-height tiles (an empty column always
 * clears the current frontier, so it loses to a same-row column that also
 * clears it, but wins over one that doesn't).
 */
export function findFirstOpenSlot(
  items: LayoutItem[],
  cols: number,
  w: number,
  h: number
): { x: number; y: number } {
  const frontier = Math.max(h, ...items.map((it) => it.y + it.h), 0)
  const touched = new Set(items.map((it) => it.x))

  for (const x of [...touched].sort((a, b) => a - b)) {
    if (x > cols - w) continue
    const y = nextOpenY(items, x, w, h)
    if (y + h <= frontier) return { x, y }
  }
  for (let x = 0; x <= cols - w; x += 1) {
    if (!touched.has(x)) return { x, y: 0 }
  }
  // Every column is touched and none has room within the frontier — open a
  // fresh row at the frontier line rather than wedging into whichever
  // column happens to have the least in it (which would leave that one
  // lone column oddly deeper than the rest, e.g. a large card burying
  // itself under a small one just because that column was least full).
  // Every column's content ends at or before the frontier by definition, so
  // placing here is always collision-free; prefer a column already caught
  // up to the frontier so this doesn't leave a fresh gap behind it either.
  for (let x = 0; x <= cols - w; x += 1) {
    if (nextOpenY(items, x, w, h) === frontier) return { x, y: frontier }
  }
  return { x: 0, y: frontier }
}

/**
 * Re-pack items into a gap-free sequence, using their current (possibly
 * gap-having, just-dragged) positions only to determine the new reading
 * order — top row first, then left to right — then placing each one in the
 * next open slot in that order. A drag is effectively a reorder, not a free
 * placement: there's never a lasting empty slot between items.
 */
export function repackByReadingOrder(items: LayoutItem[], cols: number): LayoutItem[] {
  const ordered = [...items].sort((a, b) => a.y - b.y || a.x - b.x)
  const packed: LayoutItem[] = []
  for (const item of ordered) {
    const slot = findFirstOpenSlot(packed, cols, item.w, item.h)
    packed.push({ ...item, x: slot.x, y: slot.y })
  }
  return packed
}

/**
 * Closes the hole a deletion leaves behind, without disturbing which column
 * anything else is in. A card only ever crosses columns here if its own
 * column is now completely empty (so the columns after it shift left to
 * take its place) — a card never jumps sideways just because something
 * above it in a *different* column disappeared. Within each surviving
 * column, cards pull straight up to close any vertical gap. Assumes every
 * item is one column wide (true for this app's cards).
 */
export function compactColumnStable(items: LayoutItem[]): LayoutItem[] {
  const usedXs = [...new Set(items.map((it) => it.x))].sort((a, b) => a - b)
  const xRemap = new Map(usedXs.map((x, i) => [x, i]))

  const byNewX = new Map<number, LayoutItem[]>()
  for (const it of items) {
    const x = xRemap.get(it.x)!
    const col = byNewX.get(x) ?? []
    col.push(it)
    byNewX.set(x, col)
  }

  const packed: LayoutItem[] = []
  for (const [x, col] of byNewX) {
    col.sort((a, b) => a.y - b.y)
    let nextY = 0
    for (const it of col) {
      packed.push({ ...it, x, y: nextY })
      nextY += it.h
    }
  }
  return packed
}

/** Tracks a container's pixel size — grid layouts need an explicit width
 * (and sometimes height) to lay out against. */
export function useContainerSize(): {
  width: number
  height: number
  ref: (el: HTMLDivElement | null) => void
} {
  const elRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  // Stable across renders — an inline ref callback is treated as a new ref on
  // every render, which re-attaches and re-runs setState in a loop.
  const measure = useCallback((): void => {
    const el = elRef.current
    if (!el) return
    setSize((prev) => {
      const next = { width: el.clientWidth, height: el.clientHeight }
      return prev.width === next.width && prev.height === next.height ? prev : next
    })
  }, [])

  const ref = useCallback(
    (el: HTMLDivElement | null): void => {
      elRef.current = el
      measure()
    },
    [measure]
  )

  useEffect(() => {
    const el = elRef.current
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure])

  return { ...size, ref }
}
