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

export async function bulkDeleteContent(ids: string[]): Promise<void> {
  for (const id of ids) invalidateHaystack(id)
  await db.content.bulkDelete(ids)
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

const SRD_EXCLUDED_KEY = 'srdExcludedIds'

async function getSrdExcludedIds(): Promise<Set<string>> {
  const ids = await getSetting<string[]>(SRD_EXCLUDED_KEY)
  return new Set(ids ?? [])
}

/** Individually-deleted or adopted-as-custom SRD entries shouldn't come back
 * next time the user clicks Re-sync — remember their ids so future syncs
 * skip writing them, the same way a hand-edited entry (srdEdited) is left
 * alone. */
export async function excludeFromSrdSync(ids: string[]): Promise<void> {
  if (!ids.length) return
  const excluded = await getSrdExcludedIds()
  for (const id of ids) excluded.add(id)
  await setSetting(SRD_EXCLUDED_KEY, [...excluded])
}

/** Fetch the bundled SRD datasets and upsert them into the local database. */
export async function syncSrd(onProgress?: (p: SyncProgress) => void): Promise<{ entries: number }> {
  const total = SRD_GROUPS.length
  const excluded = await getSrdExcludedIds()
  let entries = 0
  for (let i = 0; i < SRD_GROUPS.length; i += 1) {
    const group = SRD_GROUPS[i]
    onProgress?.({ label: group.label, done: i, total })
    const mapped = await group.fetch()
    // Hand-edited entries (see EntryForm), ones adopted into a custom
    // source, and ones the user individually deleted are left alone —
    // re-syncing should fill in new/updated official entries, never clobber
    // local changes or resurrect something the user asked to be rid of.
    const existing = await db.content.bulkGet(mapped.map((e) => e.id))
    const toWrite = mapped.filter(
      (e, idx) => !existing[idx]?.srdEdited && existing[idx]?.source !== 'custom' && !excluded.has(e.id)
    )
    await db.content.bulkPut(toWrite)
    entries += toWrite.length
    onProgress?.({ label: group.label, done: i + 1, total, count: toWrite.length })
  }
  await setSetting('srdSyncedAt', Date.now())
  await setSetting('srdDisabled', false)
  return { entries }
}

/** Remove all SRD content from the local database. Doesn't touch the
 * bundled dataset itself — Re-sync brings it all back. Marks SRD as
 * user-disabled so the app doesn't silently re-download it on next launch,
 * and clears any individual-deletion history since a full Re-sync from here
 * should be a clean slate. */
export async function removeSrd(): Promise<void> {
  const ids = await db.content.where('source').equals('srd').primaryKeys()
  await bulkDeleteContent(ids as string[])
  await setSetting('srdDisabled', true)
  await setSetting(SRD_EXCLUDED_KEY, [])
}

// ---- generic settings (non-secret) ----------------------------------------

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const rec = await db.settings.get(key)
  return rec?.value as T | undefined
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value })
}
