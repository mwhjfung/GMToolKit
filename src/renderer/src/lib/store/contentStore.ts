import { create } from 'zustand'
import type { ContentEntry } from '@/types/content'
import { nextDuplicateName } from '@/lib/templates/schemas'
import {
  getAllContent,
  putContent,
  bulkPutContent,
  deleteContent,
  syncSrd,
  removeSrd as removeSrdFromDb,
  excludeFromSrdSync,
  getSetting,
  setSetting,
  type SyncProgress
} from '@/lib/db/content'
import { getActiveCampaignId } from './activeCampaign'
import { getActiveSessionId } from './activeSession'

// Pins are per-campaign + per-session (each session has its own board).
const pinsKey = (): string => `pinnedIds:${getActiveCampaignId()}:${getActiveSessionId()}`
// Matches DashboardPage's pinnedLayoutKey() — same per-campaign/session scope.
const pinnedLayoutKey = (): string => `pinnedLayout:${getActiveCampaignId()}:${getActiveSessionId()}`
// The custom-source registry is global (sources carry their own campaign info).
const SOURCES_KEY = 'sources'

const persistPins = (ids: string[]): void => {
  void setSetting(pinsKey(), ids)
}

// Unpinning leaves the card's saved grid position behind — if the same card
// gets pinned again later, that stale x/y (sized for whatever layout existed
// back then) gets reused as-is, which can reintroduce a gap. Drop it from
// the saved board layout too so a re-pin always gets a fresh slot.
const pruneSavedLayout = async (id: string): Promise<void> => {
  const saved = await getSetting<{ cardsPerRow: number; items: Array<{ i: string }> }>(pinnedLayoutKey())
  if (!saved || !Array.isArray(saved.items)) return
  const items = saved.items.filter((item) => item.i !== id)
  if (items.length === saved.items.length) return
  await setSetting(pinnedLayoutKey(), { ...saved, items })
}

const uuid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

/**
 * A managed collection of custom content (shown as a tab in the Library). Each
 * custom entry belongs to exactly one Source. A source lives in one campaign
 * and can be shared into others. The built-in SRD content is its own implicit
 * source (always available everywhere) and is not stored here.
 */
export interface Source {
  id: string
  name: string
  /** Home campaign this source was created in. */
  campaignId: string
  /** Extra campaigns it's shared into (when sharing is enabled). */
  sharedCampaignIds: string[]
  createdAt: number
}

/** The built-in SRD "source" — always present, in every campaign, not editable. */
export const SRD_SOURCE_ID = 'srd'

export function sourceInCampaign(src: Source, campaignId: string): boolean {
  return src.campaignId === campaignId || src.sharedCampaignIds.includes(campaignId)
}

/**
 * Find (or note the need to create) the source a custom entry belongs to, based
 * on its world/source name within the given campaign. Returns the resolved id,
 * the canonical name, and the (possibly extended) source list.
 */
function ensureSource(
  sources: Source[],
  world: string | undefined,
  campaignId: string
): { sourceId: string; name: string; sources: Source[] } {
  const name = (world ?? '').trim() || 'Homebrew'
  const visible = sources.filter((s) => sourceInCampaign(s, campaignId))
  const found = visible.find((s) => s.name.toLowerCase() === name.toLowerCase())
  if (found) return { sourceId: found.id, name: found.name, sources }
  const src: Source = {
    id: uuid(),
    name,
    campaignId,
    sharedCampaignIds: [],
    createdAt: Date.now()
  }
  return { sourceId: src.id, name, sources: [...sources, src] }
}

/**
 * Like ensureSource, but resolves against a source whose *home* is the given
 * campaign (used when moving content into another campaign, not just sharing).
 */
function ensureSourceHome(
  sources: Source[],
  world: string | undefined,
  campaignId: string
): { sourceId: string; name: string; sources: Source[] } {
  const name = (world ?? '').trim() || 'Homebrew'
  const found = sources.find(
    (s) => s.campaignId === campaignId && s.name.toLowerCase() === name.toLowerCase()
  )
  if (found) return { sourceId: found.id, name: found.name, sources }
  const src: Source = {
    id: uuid(),
    name,
    campaignId,
    sharedCampaignIds: [],
    createdAt: Date.now()
  }
  return { sourceId: src.id, name, sources: [...sources, src] }
}

interface ContentState {
  /** Everything in the database (all campaigns + SRD). */
  items: ContentEntry[]
  /** Items visible in the active campaign (SRD + sources mapped to it). */
  visibleItems: ContentEntry[]
  /** Custom-source registry (excludes the built-in SRD source). */
  sources: Source[]
  loaded: boolean
  syncing: boolean
  syncProgress: SyncProgress | null
  pinnedIds: string[]
  load: () => Promise<void>
  /** Recompute visibleItems for the active campaign. */
  refreshForCampaign: () => void
  /** Reload just the pinned-board list (called on campaign switch). */
  loadPins: () => Promise<void>
  sync: () => Promise<void>
  /** Remove all SRD content and remember that choice so it doesn't come back on next launch. */
  removeSrd: () => Promise<void>
  upsert: (entry: ContentEntry) => Promise<void>
  duplicate: (entry: ContentEntry) => Promise<ContentEntry>
  remove: (id: string) => Promise<void>
  /** Sources visible in the active campaign, in creation order. */
  campaignSources: () => Source[]
  addSource: (name: string, sharedCampaignIds?: string[]) => Source
  updateSource: (id: string, patch: Partial<Pick<Source, 'name' | 'sharedCampaignIds'>>) => void
  removeSource: (id: string) => Promise<void>
  /** Bulk actions over a set of custom entries (selected in the Library). */
  bulkAddTags: (ids: string[], tags: string[]) => Promise<void>
  bulkRemoveTags: (ids: string[], tags: string[]) => Promise<void>
  bulkSetSource: (ids: string[], sourceName: string) => Promise<void>
  bulkMoveToCampaign: (ids: string[], campaignId: string) => Promise<void>
  bulkRemove: (ids: string[]) => Promise<void>
  bulkSetHomebrew: (ids: string[], value: boolean) => Promise<void>
  bulkImport: (entries: ContentEntry[]) => Promise<void>
  pin: (id: string) => void
  unpin: (id: string) => void
  togglePin: (id: string) => void
  reorderPins: (ids: string[]) => void
  isPinned: (id: string) => boolean
}

function computeVisible(items: ContentEntry[], sources: Source[]): ContentEntry[] {
  const activeId = getActiveCampaignId()
  const visibleIds = new Set(
    sources.filter((s) => sourceInCampaign(s, activeId)).map((s) => s.id)
  )
  return items.filter(
    (e) => e.source === 'srd' || (e.sourceId != null && visibleIds.has(e.sourceId))
  )
}

export const useContentStore = create<ContentState>((set, get) => ({
  items: [],
  visibleItems: [],
  sources: [],
  loaded: false,
  syncing: false,
  syncProgress: null,
  pinnedIds: [],

  load: async () => {
    const [items, pins, stored] = await Promise.all([
      getAllContent(),
      getSetting<string[]>(pinsKey()),
      getSetting<Source[]>(SOURCES_KEY)
    ])
    let sources = stored ?? []

    // Give every custom entry a home source in the active campaign. Covers
    // pre-sources entries (no sourceId) and JSON re-imports whose sourceId
    // points at a source this install doesn't have. Resolved from the old world
    // name, falling back to "Homebrew".
    const activeId = getActiveCampaignId()
    const known = new Set(sources.map((s) => s.id))
    const orphans = items.filter(
      (e) => e.source === 'custom' && (!e.sourceId || !known.has(e.sourceId))
    )
    if (orphans.length) {
      for (const e of orphans) {
        const r = ensureSource(sources, e.world, activeId)
        sources = r.sources
        e.sourceId = r.sourceId
        e.world = r.name
        await putContent(e)
      }
      await setSetting(SOURCES_KEY, sources)
    }

    set({ items, sources, pinnedIds: pins ?? [], loaded: true })
    set({ visibleItems: computeVisible(items, sources) })

    // First launch (or a wiped database): there's no SRD content yet and the
    // user has never had a chance to click "Re-sync" — do it for them so the
    // Library isn't empty on first open. Skip it if they've deliberately
    // removed SRD content before — that's an explicit choice, not something
    // to silently undo on next launch.
    if (!items.some((e) => e.source === 'srd')) {
      const srdDisabled = await getSetting<boolean>('srdDisabled')
      if (!srdDisabled) await get().sync()
    }
  },

  refreshForCampaign: () => {
    set({ visibleItems: computeVisible(get().items, get().sources) })
  },

  loadPins: async () => {
    const pins = await getSetting<string[]>(pinsKey())
    set({ pinnedIds: pins ?? [] })
  },

  sync: async () => {
    set({ syncing: true, syncProgress: null })
    try {
      await syncSrd((p) => set({ syncProgress: p }))
      const items = await getAllContent()
      set({ items, visibleItems: computeVisible(items, get().sources) })
    } catch (err) {
      // Previously swallowed silently by callers doing `void sync()` — log
      // it so a real failure (e.g. IndexedDB locked by another running
      // instance) is at least visible in devtools instead of just doing
      // nothing when the user clicks Re-sync.
      console.error('SRD sync failed:', err)
      throw err
    } finally {
      set({ syncing: false, syncProgress: null })
    }
  },

  removeSrd: async () => {
    await removeSrdFromDb()
    const items = await getAllContent()
    const knownIds = new Set(items.map((e) => e.id))
    const pinnedIds = get().pinnedIds.filter((id) => knownIds.has(id))
    set({ items, visibleItems: computeVisible(items, get().sources), pinnedIds })
    persistPins(pinnedIds)
  },

  upsert: async (entry) => {
    let e = entry
    let sources = get().sources
    // Custom entries are filed under a source, resolved from their world name
    // within the active campaign (creating the source if it's new).
    if (e.source === 'custom') {
      const r = ensureSource(sources, e.world, getActiveCampaignId())
      e = { ...e, sourceId: r.sourceId, world: r.name }
      if (r.sources !== sources) {
        sources = r.sources
        void setSetting(SOURCES_KEY, sources)
      }
    }
    await putContent(e)
    set((s) => {
      const exists = s.items.some((i) => i.id === e.id)
      const items = exists ? s.items.map((i) => (i.id === e.id ? e : i)) : [...s.items, e]
      return { items, sources, visibleItems: computeVisible(items, sources) }
    })
  },

  duplicate: async (entry) => {
    const siblingNames = get()
      .items.filter((i) => i.type === entry.type)
      .map((i) => i.name)
    const ts = Date.now()
    const copy: ContentEntry = {
      ...entry,
      id: `custom:${crypto.randomUUID()}`,
      source: 'custom',
      name: nextDuplicateName(siblingNames, entry.name),
      createdAt: ts,
      updatedAt: ts
    }
    await get().upsert(copy)
    return copy
  },

  remove: async (id) => {
    await deleteContent(id)
    const pinnedIds = get().pinnedIds.filter((p) => p !== id)
    set((s) => {
      const items = s.items.filter((i) => i.id !== id)
      return { items, pinnedIds, visibleItems: computeVisible(items, s.sources) }
    })
    persistPins(pinnedIds)
  },

  campaignSources: () => {
    const activeId = getActiveCampaignId()
    return get().sources.filter((s) => sourceInCampaign(s, activeId))
  },

  addSource: (name, sharedCampaignIds = []) => {
    const src: Source = {
      id: uuid(),
      name: name.trim() || 'Untitled',
      campaignId: getActiveCampaignId(),
      sharedCampaignIds,
      createdAt: Date.now()
    }
    const sources = [...get().sources, src]
    set((s) => ({ sources, visibleItems: computeVisible(s.items, sources) }))
    void setSetting(SOURCES_KEY, sources)
    return src
  },

  updateSource: (id, patch) => {
    const sources = get().sources.map((s) => (s.id === id ? { ...s, ...patch } : s))
    // A rename also updates the display name (world) on the source's entries.
    const renamed = patch.name?.trim()
    set((s) => {
      const items = renamed
        ? s.items.map((e) => (e.sourceId === id ? { ...e, world: renamed } : e))
        : s.items
      if (renamed) {
        void Promise.all(items.filter((e) => e.sourceId === id).map((e) => putContent(e)))
      }
      return { items, sources, visibleItems: computeVisible(items, sources) }
    })
    void setSetting(SOURCES_KEY, sources)
  },

  removeSource: async (id) => {
    const doomed = get().items.filter((e) => e.sourceId === id)
    for (const e of doomed) await deleteContent(e.id)
    const sources = get().sources.filter((s) => s.id !== id)
    set((s) => {
      const items = s.items.filter((e) => e.sourceId !== id)
      return { items, sources, visibleItems: computeVisible(items, sources) }
    })
    void setSetting(SOURCES_KEY, sources)
  },

  bulkAddTags: async (ids, tags) => {
    const idset = new Set(ids)
    const add = tags.map((t) => t.trim()).filter(Boolean)
    if (!add.length) return
    const changed: ContentEntry[] = []
    const items = get().items.map((e) => {
      if (!idset.has(e.id)) return e
      const ne = { ...e, tags: [...new Set([...e.tags, ...add])], updatedAt: Date.now() }
      changed.push(ne)
      return ne
    })
    await Promise.all(changed.map((e) => putContent(e)))
    set({ items, visibleItems: computeVisible(items, get().sources) })
  },

  bulkRemoveTags: async (ids, tags) => {
    const idset = new Set(ids)
    const drop = new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))
    if (!drop.size) return
    const changed: ContentEntry[] = []
    const items = get().items.map((e) => {
      if (!idset.has(e.id)) return e
      const ne = { ...e, tags: e.tags.filter((t) => !drop.has(t.toLowerCase())), updatedAt: Date.now() }
      changed.push(ne)
      return ne
    })
    await Promise.all(changed.map((e) => putContent(e)))
    set({ items, visibleItems: computeVisible(items, get().sources) })
  },

  bulkSetSource: async (ids, sourceName) => {
    const idset = new Set(ids)
    const r = ensureSource(get().sources, sourceName, getActiveCampaignId())
    const changed: ContentEntry[] = []
    const adoptedSrdIds: string[] = []
    const items = get().items.map((e) => {
      if (!idset.has(e.id)) return e
      // An SRD entry assigned a source is being adopted into the user's own
      // library — from here it's a normal custom entry (editable, excluded
      // from future SRD re-syncs so it doesn't get overwritten back).
      if (e.source === 'srd') adoptedSrdIds.push(e.id)
      const ne = {
        ...e,
        source: 'custom' as const,
        sourceId: r.sourceId,
        world: r.name,
        updatedAt: Date.now()
      }
      changed.push(ne)
      return ne
    })
    await Promise.all(changed.map((e) => putContent(e)))
    if (adoptedSrdIds.length) void excludeFromSrdSync(adoptedSrdIds)
    void setSetting(SOURCES_KEY, r.sources)
    set({ items, sources: r.sources, visibleItems: computeVisible(items, r.sources) })
  },

  bulkMoveToCampaign: async (ids, campaignId) => {
    const idset = new Set(ids)
    let sources = get().sources
    const changed: ContentEntry[] = []
    const items = get().items.map((e) => {
      if (!idset.has(e.id) || e.source !== 'custom') return e
      const r = ensureSourceHome(sources, e.world, campaignId)
      sources = r.sources
      const ne = { ...e, sourceId: r.sourceId, world: r.name, updatedAt: Date.now() }
      changed.push(ne)
      return ne
    })
    await Promise.all(changed.map((e) => putContent(e)))
    void setSetting(SOURCES_KEY, sources)
    set({ items, sources, visibleItems: computeVisible(items, sources) })
  },

  bulkRemove: async (ids) => {
    const idset = new Set(ids)
    // Deleting an SRD entry should stick — otherwise the next Re-sync would
    // silently bring it right back.
    const removedSrdIds = get().items.filter((e) => idset.has(e.id) && e.source === 'srd').map((e) => e.id)
    for (const id of ids) await deleteContent(id)
    if (removedSrdIds.length) void excludeFromSrdSync(removedSrdIds)
    const pinnedIds = get().pinnedIds.filter((p) => !idset.has(p))
    const items = get().items.filter((e) => !idset.has(e.id))
    set({ items, pinnedIds, visibleItems: computeVisible(items, get().sources) })
    persistPins(pinnedIds)
  },

  bulkSetHomebrew: async (ids, value) => {
    const idset = new Set(ids)
    const changed: ContentEntry[] = []
    const items = get().items.map((e) => {
      if (!idset.has(e.id)) return e
      const ne = { ...e, homebrew: value, updatedAt: Date.now() }
      changed.push(ne)
      return ne
    })
    await Promise.all(changed.map((e) => putContent(e)))
    set({ items, visibleItems: computeVisible(items, get().sources) })
  },

  bulkImport: async (entries) => {
    let sources = get().sources
    const activeId = getActiveCampaignId()
    const mapped = entries.map((e) => {
      if (e.source !== 'custom') return e
      const r = ensureSource(sources, e.world, activeId)
      sources = r.sources
      return { ...e, sourceId: r.sourceId, world: r.name }
    })
    await bulkPutContent(mapped)
    void setSetting(SOURCES_KEY, sources)
    const items = await getAllContent()
    set({ items, sources, visibleItems: computeVisible(items, sources) })
  },

  pin: (id) => {
    const { pinnedIds } = get()
    if (pinnedIds.includes(id)) return
    const next = [...pinnedIds, id]
    set({ pinnedIds: next })
    persistPins(next)
  },

  unpin: (id) => {
    const next = get().pinnedIds.filter((p) => p !== id)
    set({ pinnedIds: next })
    persistPins(next)
    void pruneSavedLayout(id)
  },

  togglePin: (id) => {
    if (get().isPinned(id)) get().unpin(id)
    else get().pin(id)
  },

  reorderPins: (ids) => {
    set({ pinnedIds: ids })
    persistPins(ids)
  },

  isPinned: (id) => get().pinnedIds.includes(id)
}))
