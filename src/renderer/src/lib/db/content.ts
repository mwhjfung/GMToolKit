import { db } from './db'
import type { ContentEntry, ContentSource, ContentType } from '@/types/content'
import { SRD_GROUPS } from '@/lib/api/fivetools'

export async function countContent(): Promise<number> {
  return db.content.count()
}

export async function countSrd(): Promise<number> {
  return db.content.where('source').equals('srd').count()
}

export async function getContent(id: string): Promise<ContentEntry | undefined> {
  return db.content.get(id)
}

export async function getAllContent(): Promise<ContentEntry[]> {
  return db.content.toArray()
}

export async function putContent(entry: ContentEntry): Promise<void> {
  await db.content.put(entry)
}

export async function bulkPutContent(entries: ContentEntry[]): Promise<void> {
  await db.content.bulkPut(entries)
}

export async function deleteContent(id: string): Promise<void> {
  invalidateHaystack(id)
  await db.content.delete(id)
}

export async function clearSrd(): Promise<void> {
  invalidateHaystack()
  await db.content.where('source').equals('srd').delete()
}

export async function clearAllContent(): Promise<void> {
  invalidateHaystack()
  await db.content.clear()
}

export interface ContentFilter {
  source?: ContentSource
  types?: ContentType[]
  query?: string
}

const haystackCache = new Map<string, { stamp: number; text: string }>()

/** Drop cached haystacks — pass an id, or nothing to clear all (e.g. after a bulk import). */
export function invalidateHaystack(id?: string): void {
  if (id === undefined) haystackCache.clear()
  else haystackCache.delete(id)
}

/** Lowercase searchable text for an entry: name, summary, tags, plus any
 * string-array data values (spell classes, weapon properties, …) and the
 * creature type. Cached per entry so per-keystroke filtering stays fast. */
export function entryHaystack(e: ContentEntry): string {
  const cached = haystackCache.get(e.id)
  if (cached && cached.stamp === e.updatedAt) return cached.text
  const parts: string[] = [e.name, e.summary, ...e.tags]
  const data = e.data as unknown as Record<string, unknown>
  for (const v of Object.values(data)) {
    if (Array.isArray(v)) {
      for (const x of v) if (typeof x === 'string') parts.push(x)
    }
  }
  if (typeof data.creatureType === 'string') parts.push(data.creatureType)
  const text = parts.join('\n').toLowerCase()
  haystackCache.set(e.id, { stamp: e.updatedAt, text })
  return text
}

/** Pure in-memory filter so the UI can load content once and filter per keystroke. */
export function filterContent(items: ContentEntry[], filter: ContentFilter): ContentEntry[] {
  let result = items
  if (filter.source) result = result.filter((i) => i.source === filter.source)
  if (filter.types && filter.types.length) {
    result = result.filter((i) => filter.types!.includes(i.type))
  }
  if (filter.query && filter.query.trim()) {
    const q = filter.query.toLowerCase().trim()
    result = result.filter((i) => entryHaystack(i).includes(q))
  }
  return [...result].sort((a, b) => a.name.localeCompare(b.name))
}

// ---- SRD sync -------------------------------------------------------------

export interface SyncProgress {
  label: string
  done: number
  total: number
  /** Number of entries written for the group that just finished. */
  count?: number
}

/** Fetch the SRD datasets from Open5e and upsert them into the local database. */
export async function syncSrd(onProgress?: (p: SyncProgress) => void): Promise<{ entries: number }> {
  const total = SRD_GROUPS.length
  let entries = 0
  for (let i = 0; i < SRD_GROUPS.length; i += 1) {
    const group = SRD_GROUPS[i]
    onProgress?.({ label: group.label, done: i, total })
    const mapped = await group.fetch()
    await db.content.bulkPut(mapped)
    entries += mapped.length
    onProgress?.({ label: group.label, done: i + 1, total, count: mapped.length })
  }
  await setSetting('srdSyncedAt', Date.now())
  return { entries }
}

// ---- generic settings (non-secret) ----------------------------------------

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const rec = await db.settings.get(key)
  return rec?.value as T | undefined
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value })
}
