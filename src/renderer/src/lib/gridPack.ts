import { useCallback, useEffect, useRef, useState } from 'react'
import type { LayoutItem } from 'react-grid-layout'

/**
 * First (x, y) an item of size w×h doesn't overlap any existing item,
 * scanning left to right then top to bottom — so a tile continues the
 * current row if there's room instead of always dropping to a fresh one.
 */
export function findFirstOpenSlot(
  items: LayoutItem[],
  cols: number,
  w: number,
  h: number
): { x: number; y: number } {
  const overlaps = (x: number, y: number): boolean =>
    items.some((it) => x < it.x + it.w && x + w > it.x && y < it.y + it.h && y + h > it.y)
  for (let y = 0; ; y += 1) {
    for (let x = 0; x <= cols - w; x += 1) {
      if (!overlaps(x, y)) return { x, y }
    }
  }
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
