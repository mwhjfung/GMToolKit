import { db } from '@/lib/db/db'
import { getAllContent, invalidateHaystack } from '@/lib/db/content'
import type { ContentEntry } from '@/types/content'

interface ExportBundle {
  app: 'gm-toolkit'
  version: 1
  exportedAt: string
  content: ContentEntry[]
}

/** Download all custom content as a JSON file. */
export async function exportCustomContent(): Promise<number> {
  const all = await getAllContent()
  const content = all.filter((c) => c.source === 'custom')
  const bundle: ExportBundle = {
    app: 'gm-toolkit',
    version: 1,
    exportedAt: new Date().toISOString(),
    content
  }
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `gm-toolkit-content-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  return content.length
}

/** Import content entries from a JSON file (accepts our bundle or a bare array). */
export async function importContentFromFile(file: File): Promise<number> {
  const text = await file.text()
  const parsed = JSON.parse(text) as ExportBundle | ContentEntry[]
  const entries = Array.isArray(parsed) ? parsed : parsed.content
  if (!Array.isArray(entries)) throw new Error('That file does not look like GM Toolkit content.')
  const valid = entries.filter((e) => e && e.id && e.type && e.name)
  // Imported entries are treated as custom so they remain editable.
  const normalised = valid.map((e) => ({ ...e, source: 'custom' as const }))
  await db.content.bulkPut(normalised)
  invalidateHaystack()
  return normalised.length
}

/** Wipe all content and the pinned-board list. Config (voice/LLM settings) is kept. */
export async function clearAllContent(): Promise<void> {
  await db.content.clear()
  await db.settings.delete('pinnedIds')
}
